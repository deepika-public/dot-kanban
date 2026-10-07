// One rendered ```dot-kanban block. Obsidian recreates it when the block changes: the block is
// read once, the tasks every time a note in its scope changes.
import {
  Component,
  debounce,
  Keymap,
  MarkdownRenderChild,
  MarkdownRenderer,
  MarkdownView,
  Menu,
  Notice,
  TFile,
  setIcon,
  type App,
  type MarkdownPostProcessorContext,
  type MenuItem,
  type WorkspaceLeaf,
} from "obsidian";
import { compareTasks, laneEdit, layoutBoard, type BoardModel, type Lane, type Toolbar } from "./board";
import { fieldValues, type Task } from "./collect";
import { dayLabel, localDay, type Day } from "./dates";
import { CardDrag } from "./dnd";
import { language, priorityName, t } from "./i18n";
import { statusIcon } from "./icons";
import { HiddenModal, LegendModal } from "./modals";
import { BUILT_IN_SHOW, inScope, parseQuery, shownPath, type ColumnDef, type Query } from "./query";
import { statusOf, type Status } from "./statuses";
import { tasksApi } from "./tasks-api";
import {
  checkboxOf,
  locateTask,
  PRIORITIES,
  priorityByLevel,
  type Priority,
  revertRewrite,
  rewriteTask,
  setDate,
  setPriority,
  setStatus,
  toggleUntilDone,
  valueText,
  OWNER,
  type DateKind,
  type Rewrite,
} from "./task";
import { TaskIndex } from "./vault";

const REFRESH_DELAY = 200;
/** After a keystroke or a click in an open note. */
const LIVE_DELAY = 50;
/** After a keystroke in the search. */
const SEARCH_DELAY = 150;
/** Cards drawn per cell, and added by each « Show more ». */
const CARD_PAGE = 50;
const UNDO_DEPTH = 20;
const DATE_ICONS: Record<DateKind, string> = {
  due: "calendar",
  scheduled: "clock",
  start: "play",
  created: "plus",
  done: "check",
  cancelled: "x",
};
const PRIORITY_ICONS: Record<string, string> = {
  highest: "chevrons-up",
  high: "chevrons-up",
  medium: "chevron-up",
  low: "chevron-down",
  lowest: "chevrons-down",
};
const PERSON_COLORS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"];

interface Undo {
  path: string;
  rewrite: Rewrite;
}

interface Shell {
  bar: HTMLElement;
  legend: HTMLButtonElement;
  person: HTMLButtonElement;
  lanes: HTMLButtonElement;
  summary: HTMLElement;
  scroller: HTMLElement;
  board: HTMLElement;
}

/**
 * The toolbar, folded lanes and cards shown of each board, by note and block text. Reading view
 * re-creates a block scrolled far away; the board comes back as it was left.
 */
const memory = new Map<string, { toolbar: Toolbar; collapsed: Set<string>; drawn: Map<string, number> }>();

/** Where dot-kanban last opened a note, shared by the boards: a click on a card follows there. */
let opened: WorkspaceLeaf | null = null;

/** Initials of a name: `Alice` → `A`, `Jean Dupont` → `JD`. */
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]?.toUpperCase() ?? "").join("") || "?";

function personColor(name: string): string {
  let hash = 0;
  for (const c of name.toLowerCase()) hash = (hash * 31 + c.codePointAt(0)!) >>> 0;
  return PERSON_COLORS[hash % PERSON_COLORS.length];
}

/** Markdown of a card title; `<` written as text so no HTML from a note is interpreted. */
const safeMarkdown = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * A title Markdown would show as is: no link, tag, emphasis, code, math, comment, URL, nor
 * block marker at the start. Written as text, it spares the Markdown renderer.
 */
const isPlain = (text: string) =>
  !/[[\]*_`~=#\\$%^@]|:\/\/|www\./.test(text) && !/^(?:[-+>]\s|\d+[.)]\s)/.test(text);

export class TikBoard extends MarkdownRenderChild {
  private readonly query: Query;
  private readonly toolbar: Toolbar;
  private tasks: Task[] = [];
  /** The day the cards were drawn for: their dates read relative to it. */
  private day: Day | null = null;
  private model: BoardModel | null = null;
  private shell: Shell | null = null;
  private rendered: Component | null = null;
  private readonly collapsed: Set<string>;
  /** Cards drawn in each cell once « Show more » was used, by cell. */
  private readonly drawn: Map<string, number>;
  private focused: string | null = null;
  private lifted: { id: string; column: number } | null = null;
  private placeholder: HTMLElement | null = null;
  private hovered: { cell: HTMLElement | null; band: HTMLElement | null } | null = null;
  private undos: Undo[] = [];
  private timer: number | null = null;
  private generation = 0;
  /** An action asked for the board to be drawn again, even with the same tasks. */
  private mustRender = false;
  private page: HTMLElement | null = null;
  private readonly renderSoon = debounce(() => this.render(), SEARCH_DELAY, true);
  /** Whether a note's tasks can be on this board. */
  private readonly reads = (path: string) => inScope(this.query, path);

  constructor(
    containerEl: HTMLElement,
    private readonly app: App,
    private readonly index: TaskIndex,
    source: string,
    private readonly ctx: MarkdownPostProcessorContext,
  ) {
    super(containerEl);
    this.query = parseQuery(source);
    const key = `${ctx.sourcePath}\n${source}`;
    const kept = memory.get(key);
    this.toolbar = kept?.toolbar ?? { search: "", person: "", groupBy: this.query.groupBy };
    this.collapsed = kept?.collapsed ?? new Set();
    this.drawn = kept?.drawn ?? new Map<string, number>();
    memory.set(key, { toolbar: this.toolbar, collapsed: this.collapsed, drawn: this.drawn });
  }

  onload() {
    this.containerEl.addClass("dot-kanban");
    this.shell = this.buildShell();
    const drag = new CardDrag(this.shell.board, {
      cardSelector: ".dot-kanban-card",
      targetSelector: ".dot-kanban-cell",
      start: () => this.showBands(),
      hover: (card, target, y) => this.showPlaceholder(card, target, y),
      drop: (card, target, y) => {
        this.hidePlaceholder();
        if (target) void this.dropCard(card, target, y);
        else this.render();
      },
      cancel: () => {
        this.hidePlaceholder();
        this.render();
      },
    });
    this.register(drag.attach());

    // Notes out of the block's scope change nothing here.
    this.register(
      this.index.subscribe((paths, live) => {
        if (paths.some(this.reads)) this.scheduleRefresh(live ? LIVE_DELAY : REFRESH_DELAY, true);
      }),
    );
    this.registerDomEvent(this.containerEl, "keydown", (e) => this.onKey(e));
    this.register(() => this.cancelRefresh());
    this.register(() => this.renderSoon.cancel());
    this.app.workspace.onLayoutReady(() => void this.refresh());
  }

  /* ---------- reading ---------- */

  /** `quiet`: a note changed; the board is drawn again only if its tasks did. */
  private scheduleRefresh(delay = REFRESH_DELAY, quiet = false) {
    this.cancelRefresh();
    if (!quiet) this.mustRender = true;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.refresh(true);
    }, delay);
  }

  private cancelRefresh() {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  /**
   * Reads the tasks and draws the board. After an action the board is always drawn again:
   * that is what lifts the bands, the placeholder and a lifted card. `quiet` (a note
   * changed) skips the drawing when the tasks are the same.
   */
  async refresh(quiet = false) {
    this.cancelRefresh();
    if (!quiet) this.mustRender = true;
    const generation = ++this.generation;
    const tasks = await this.index.tasks(this.reads);
    if (generation !== this.generation) return;
    // An unchanged note keeps its task objects: same objects, same day, same board.
    const day = this.today();
    const same = day === this.day && tasks.length === this.tasks.length && tasks.every((task, i) => task === this.tasks[i]);
    if (same && !this.mustRender) return;
    this.mustRender = false;
    this.tasks = tasks;
    this.day = day;
    this.render();
  }

  private today(): Day {
    return localDay(new Date());
  }

  /* ---------- shell: errors, toolbar ---------- */

  private buildShell(): Shell {
    const root = this.containerEl;
    root.empty();
    if (this.query.width) root.style.setProperty("--dot-kanban-column-width", this.query.width);
    if (this.query.errors.length) {
      const list = root.createEl("ul", { cls: "dot-kanban-errors" });
      for (const e of this.query.errors) list.createEl("li", { text: `${e.line} · ${e.message}` });
    }

    const bar = root.createDiv({ cls: "dot-kanban-toolbar" });
    const search = bar.createEl("label", { cls: "dot-kanban-search" });
    setIcon(search.createSpan({ cls: "dot-kanban-search-icon" }), "search");
    const input = search.createEl("input", { type: "search", placeholder: t("search"), attr: { "aria-label": t("searchLabel") } });
    input.value = this.toolbar.search;
    input.oninput = () => {
      this.toolbar.search = input.value;
      this.renderSoon();
    };
    const chip = (onClick: (e: MouseEvent) => void) => {
      const b = bar.createEl("button", { cls: "dot-kanban-chip" });
      b.onclick = onClick;
      return b;
    };
    const person = chip((e) => this.choosePerson(e));
    const lanes = chip((e) => this.chooseLanes(e));
    bar.createDiv({ cls: "dot-kanban-spacer" });
    const summary = bar.createDiv({ cls: "dot-kanban-summary" });
    const edit = bar.createEl("button", { cls: "dot-kanban-icon-button", attr: { "aria-label": t("editSource") } });
    setIcon(edit, "code-2");
    edit.onclick = () => void this.editSource();
    const legend = bar.createEl("button", { cls: "dot-kanban-icon-button", attr: { "aria-label": t("legend") } });
    setIcon(legend, "help-circle");
    legend.onclick = () => new LegendModal(this.app, this.query.columns).open();

    const scroller = root.createDiv({ cls: "dot-kanban-scroller" });
    const board = scroller.createDiv({ cls: "dot-kanban-board" });
    return { bar, legend, person, lanes, summary, scroller, board };
  }

  private choosePerson(e: MouseEvent) {
    const menu = new Menu();
    for (const person of ["", ...(this.model?.people ?? [])]) {
      menu.addItem((item) =>
        item
          .setTitle(person || t("peopleAll"))
          .setChecked(this.toolbar.person === person)
          .onClick(() => {
            this.toolbar.person = person;
            this.render();
          }),
      );
    }
    menu.showAtMouseEvent(e);
  }

  private chooseLanes(e: MouseEvent) {
    const keys = [OWNER, "priority", "note", "heading"];
    if (this.query.groupBy && !keys.includes(this.query.groupBy)) keys.push(this.query.groupBy);
    const menu = new Menu();
    for (const key of [null, ...keys]) {
      menu.addItem((item) =>
        item
          .setTitle(key ? t("lanesBy", { key }) : t("lanesNone"))
          .setChecked(this.toolbar.groupBy === key)
          .onClick(() => {
            this.toolbar.groupBy = key;
            this.render();
          }),
      );
    }
    menu.showAtMouseEvent(e);
  }

  /* ---------- width ---------- */

  /**
   * A board is wider than a line of text: it takes the whole width of its pane, margins
   * kept, even when "Readable line length" narrows the note. Followed on every resize.
   */
  private followPageWidth() {
    if (this.page) return;
    // Known only once Obsidian has put the block in its note.
    const page = this.containerEl.closest<HTMLElement>(".markdown-preview-view, .cm-scroller");
    if (!page) return;
    this.page = page;
    const embed = this.containerEl.closest<HTMLElement>(".cm-embed-block");
    if (embed) this.fitLivePreview(embed);
    const observer = new ResizeObserver(() => this.widen(page));
    observer.observe(page);
    this.register(() => observer.disconnect());
  }

  /**
   * In live preview the editor clips an embedded block to the text column. The class lets
   * styles.css lift the clip, drop the outline, and hide the block's `</>` button: the
   * toolbar's `</>` replaces it.
   */
  private fitLivePreview(embed: HTMLElement) {
    embed.addClass("dot-kanban-embed");
    this.register(() => embed.removeClass("dot-kanban-embed"));
  }

  /** `</>`: the note in edit mode, cursor on the block's first instruction. */
  private async editSource() {
    const view = this.app.workspace
      .getLeavesOfType("markdown")
      .map((leaf) => leaf.view)
      .find((v): v is MarkdownView => v instanceof MarkdownView && v.containerEl.contains(this.containerEl));
    const info = this.ctx.getSectionInfo(this.containerEl);
    if (!view || !info) return;
    if (view.getMode() === "preview") await view.setState({ ...view.getState(), mode: "source" }, { history: false });
    view.editor.setCursor({ line: Math.min(info.lineStart + 1, info.lineEnd), ch: 0 });
    view.editor.focus();
  }

  private widen(page: HTMLElement) {
    const el = this.containerEl;
    el.setCssStyles({ marginLeft: "", width: "" });
    const style = getComputedStyle(page);
    const box = page.getBoundingClientRect();
    const scrollbar = page.offsetWidth - page.clientWidth;
    const left = box.left + parseFloat(style.paddingLeft);
    const right = box.right - parseFloat(style.paddingRight) - scrollbar;
    const natural = el.getBoundingClientRect();
    if (right - left <= natural.width + 1) return;
    el.setCssStyles({ marginLeft: `${left - natural.left}px`, width: `${right - left}px` });
  }

  /* ---------- board ---------- */

  private render() {
    const shell = this.shell;
    if (!shell) return;
    const model = layoutBoard(this.tasks, this.query, this.toolbar, this.today());
    this.model = model;
    const lifted = this.lifted;
    this.lifted = null;

    const personLabel = model.people.find((p) => p.toLowerCase() === this.toolbar.person.toLowerCase()) ?? this.toolbar.person;
    shell.person.setText(this.toolbar.person ? t("peopleOne", { name: personLabel }) : t("peopleAll"));
    shell.person.toggleClass("is-active", !!this.toolbar.person);
    shell.lanes.setText(this.toolbar.groupBy ? t("lanesBy", { key: this.toolbar.groupBy }) : t("lanesNone"));
    shell.lanes.toggleClass("is-active", !!this.toolbar.groupBy);

    shell.summary.empty();
    const parts = [model.shown === 1 ? t("task") : t("tasks", { n: model.shown }), ...this.query.filters.map((f) => f.text)];
    shell.summary.createSpan({ text: parts.join(" · ") });
    if (model.hidden.length) {
      shell.summary.appendText(" · ");
      const hidden = shell.summary.createEl("button", { cls: "dot-kanban-link", text: model.hidden.length === 1 ? t("hiddenOne") : t("hidden", { n: model.hidden.length }) });
      hidden.onclick = () =>
        new HiddenModal(this.app, model.hidden, (task) => this.shownPath(task), (task) => void this.openTask(task, "side")).open();
    }

    const left = shell.scroller.scrollLeft;
    const hadFocus = this.containerEl.contains(document.activeElement);
    if (this.rendered) this.removeChild(this.rendered);
    this.rendered = this.addChild(new Component());
    const board = shell.board;
    board.empty();
    board.style.setProperty("--dot-kanban-columns", String(model.columns.length));
    board.toggleClass("is-grouped", !!model.lanes);

    if (!model.shown && !model.lanes) {
      const filters = this.query.filters.map((f) => `« ${f.text} »`).join(", ");
      this.containerEl.querySelector(".dot-kanban-empty")?.remove();
      shell.scroller.createDiv({ cls: "dot-kanban-empty", text: filters ? t("emptyFilters", { filters }) : t("empty") });
    } else this.containerEl.querySelector(".dot-kanban-empty")?.remove();

    if (model.lanes) {
      const headers = board.createDiv({ cls: "dot-kanban-lane-headers" });
      model.columns.forEach((c) => this.columnHeader(headers.createDiv({ cls: "dot-kanban-column-head is-standalone" }), c.def, c.cards.length));
      model.lanes.forEach((lane, l) => this.renderLane(board, lane, l));
    } else {
      model.columns.forEach((column, c) => {
        const section = board.createDiv({ cls: "dot-kanban-column", attr: { "data-status": column.def.status.name } });
        this.columnHeader(section.createDiv({ cls: "dot-kanban-column-head" }), column.def, column.cards.length);
        const cell = section.createDiv({ cls: "dot-kanban-cell", attr: { "data-column": String(c), "data-lane": "-1" } });
        this.renderCell(cell, column.cards, c, -1, null);
      });
    }
    shell.scroller.scrollLeft = left;
    this.followPageWidth();
    if (hadFocus && this.focused) this.cardEl(this.focused)?.focus({ preventScroll: true });
    // A card lifted with the keyboard stays lifted when a note changes meanwhile.
    const liftedEl = lifted && this.cardEl(lifted.id);
    if (lifted && liftedEl) {
      this.lifted = lifted;
      liftedEl.addClass("is-lifted");
      this.liftTarget(liftedEl, lifted.column);
    }
  }

  private columnHeader(head: HTMLElement, def: ColumnDef, count: number) {
    head.setAttr("data-status", def.status.name);
    statusIcon(head, def.status);
    head.createSpan({ cls: "dot-kanban-column-label", text: def.label });
    head.createSpan({ cls: "dot-kanban-column-symbol dot-kanban-mono", text: `[${def.status.symbol}]` });
    head.createSpan({ cls: "dot-kanban-column-count", text: String(count) });
  }

  private laneId(lane: Lane) {
    return `${this.toolbar.groupBy}:${lane.value ?? ""}`;
  }

  private laneLabel(lane: Lane) {
    if (lane.value === null) return t("laneNone", { key: this.toolbar.groupBy ?? "" });
    return this.toolbar.groupBy === "priority" ? priorityName(lane.label) : lane.label;
  }

  private renderLane(board: HTMLElement, lane: Lane, index: number) {
    const id = this.laneId(lane);
    const open = !this.collapsed.has(id);
    const wrap = board.createDiv({ cls: "dot-kanban-lane" });
    const title = wrap.createEl("button", { cls: "dot-kanban-lane-title", attr: { "aria-expanded": String(open) } });
    setIcon(title.createSpan({ cls: "dot-kanban-lane-chevron" }), open ? "chevron-down" : "chevron-right");
    if (this.toolbar.groupBy === OWNER && lane.value !== null) this.person(title, lane.label);
    title.createSpan({ cls: "dot-kanban-lane-label", text: this.laneLabel(lane) });
    title.createSpan({ cls: "dot-kanban-column-count", text: String(lane.count) });
    title.onclick = () => {
      if (open) this.collapsed.add(id);
      else this.collapsed.delete(id);
      this.render();
    };
    if (!open) return;
    const row = wrap.createDiv({ cls: "dot-kanban-lane-row" });
    lane.cells.forEach((cards, c) => {
      const cell = row.createDiv({ cls: "dot-kanban-cell", attr: { "data-column": String(c), "data-lane": String(index) } });
      this.renderCell(cell, cards, c, index, lane);
    });
  }

  /* ---------- cards ---------- */

  /** The first cards of a cell, a page at a time: a long column costs only what is seen. */
  private renderCell(cell: HTMLElement, cards: Task[], column: number, lane: number, inLane: Lane | null) {
    const key = `${inLane ? this.laneId(inLane) : ""}\n${column}`;
    const count = this.drawn.get(key) ?? CARD_PAGE;
    for (const task of cards.slice(0, count)) this.renderCard(cell, task, column, lane, inLane);
    const rest = cards.length - count;
    if (rest <= 0) return;
    const more = cell.createEl("button", { cls: "dot-kanban-show-more", text: t("showMore", { n: Math.min(rest, CARD_PAGE) }) });
    more.onclick = () => {
      this.drawn.set(key, count + CARD_PAGE);
      this.render();
    };
  }

  private cardEl(id: string): HTMLElement | null {
    return this.shell?.board.querySelector<HTMLElement>(`.dot-kanban-card[data-id="${CSS.escape(id)}"]`) ?? null;
  }

  private taskOf(el: HTMLElement): Task | null {
    return this.tasks.find((task) => task.id === el.dataset.id) ?? null;
  }

  private renderCard(cell: HTMLElement, task: Task, column: number, lane: number, inLane: Lane | null) {
    const show = this.query.show;
    const today = this.today();
    const el = cell.createDiv({
      cls: "dot-kanban-card",
      attr: { "data-id": task.id, "data-column": String(column), "data-lane": String(lane), tabindex: "0", "data-status": task.status?.name ?? "unknown" },
    });
    el.toggleClass("is-focused", task.id === this.focused);

    const row = el.createDiv({ cls: "dot-kanban-card-row" });
    const check = row.createEl("button", { cls: "dot-kanban-check", attr: { "aria-label": task.status?.type === "DONE" ? statusOf(" ")!.name : statusOf("x")!.name } });
    statusIcon(check, task.status);
    check.onclick = (e) => {
      e.stopPropagation();
      void this.setTaskStatus(task, statusOf(task.status?.type === "DONE" ? " " : "x")!);
    };
    const title = row.createDiv({ cls: "dot-kanban-card-title" });
    if (!task.info.title || isPlain(task.info.title)) title.createEl("p", { text: task.info.title || "…", attr: { dir: "auto" } });
    else void MarkdownRenderer.render(this.app, safeMarkdown(task.info.title), title, task.path, this.rendered!);
    const level = priorityByLevel(task.info.priority);
    if (show.has("priority") && PRIORITY_ICONS[level.name]) {
      const p = row.createSpan({ cls: "dot-kanban-priority", attr: { "data-priority": level.name, "aria-label": `${t("priority")} : ${priorityName(level.name)}` } });
      setIcon(p, PRIORITY_ICONS[level.name]);
    }
    const more = row.createEl("button", { cls: "dot-kanban-card-more", attr: { "aria-label": t("more") } });
    setIcon(more, "more-horizontal");
    more.onclick = (e) => {
      e.stopPropagation();
      this.cardMenu(task, e);
    };

    const meta = createDiv({ cls: "dot-kanban-card-meta" });
    for (const kind of ["due", "scheduled", "start", "created", "done", "cancelled"] as DateKind[]) {
      const day = task.info.dates[kind];
      if (!show.has(kind) || day === undefined) continue;
      const chip = meta.createSpan({ cls: "dot-kanban-meta", attr: { "data-date": kind, "aria-label": kind } });
      setIcon(chip.createSpan({ cls: "dot-kanban-meta-icon" }), DATE_ICONS[kind]);
      chip.createSpan({ text: dayLabel(day, today, language()) });
      const open = task.status?.type !== "DONE" && task.status?.type !== "CANCELLED";
      chip.toggleClass("is-overdue", kind === "due" && open && day < today);
    }
    if (show.has("subtasks") && task.subtasks) {
      const chip = meta.createSpan({ cls: "dot-kanban-meta", attr: { "aria-label": t("subtasks", task.subtasks) } });
      setIcon(chip.createSpan({ cls: "dot-kanban-meta-icon" }), "list-checks");
      chip.createSpan({ text: `${task.subtasks.done}/${task.subtasks.total}` });
    }
    if (show.has("recurrence") && task.info.recurrence !== null) {
      const chip = meta.createSpan({ cls: "dot-kanban-meta", attr: { "aria-label": t("recurring", { rule: task.info.recurrence }) } });
      setIcon(chip.createSpan({ cls: "dot-kanban-meta-icon" }), "repeat");
      if (task.info.recurrence) chip.createSpan({ text: task.info.recurrence });
    }
    for (const key of show) {
      if (BUILT_IN_SHOW.includes(key)) continue;
      const values = fieldValues(task, key);
      if (!values.length) continue;
      const chip = meta.createSpan({ cls: "dot-kanban-meta dot-kanban-field", text: `${key}: ${values.map(valueText).join(", ")}` });
      this.source(chip, task, key);
    }
    if (show.has(OWNER)) {
      const lanePerson = this.toolbar.groupBy === OWNER && inLane?.value ? valueText(inLane.value).toLowerCase() : null;
      const people = fieldValues(task, OWNER).map(valueText).filter((p) => p.toLowerCase() !== lanePerson);
      if (people.length) {
        const group = meta.createSpan({ cls: "dot-kanban-people" });
        for (const p of people) this.person(group, p);
        this.source(group, task, OWNER);
      }
    }
    if (meta.childElementCount) el.appendChild(meta);

    if (show.has("path")) {
      const path = this.shownPath(task);
      // Shown from the `path root`: the path in the vault on hover.
      el.createDiv({ cls: "dot-kanban-card-source", text: path, attr: path === task.path ? {} : { "aria-label": task.path } });
    }

    el.addEventListener("click", (e) => this.onCardClick(e, task));
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.cardMenu(task, e);
    });
    el.addEventListener("focus", () => (this.focused = task.id));
  }

  /** The note's path as the block shows it (`path root`). */
  private shownPath(task: Task): string {
    return shownPath(task.path, this.query.pathRoot);
  }

  private person(parent: HTMLElement, name: string) {
    const span = parent.createSpan({ cls: "dot-kanban-person", text: initials(name), attr: { "aria-label": name, "data-color": personColor(name) } });
    return span;
  }

  /** Says where an inherited field comes from, on hover. */
  private source(el: HTMLElement, task: Task, key: string) {
    const field = task.fields[key];
    if (!field || field.source === "line") {
      if (key === OWNER) el.setAttr("aria-label", fieldValues(task, key).map(valueText).join(", "));
      return;
    }
    const source = field.source === "parent" ? t("fromParent") : t("fromNote", { note: this.shownPath(task) });
    el.setAttr("aria-label", t("inherited", { key, source }));
    el.addClass("is-inherited");
  }

  private onCardClick(e: MouseEvent, task: Task) {
    const link = (e.target as HTMLElement).closest("a");
    if (link) {
      e.stopPropagation();
      if (link.hasClass("internal-link")) {
        e.preventDefault();
        const target = link.getAttr("data-href") ?? link.getAttr("href") ?? "";
        void this.app.workspace.openLinkText(target, task.path, Keymap.isModEvent(e));
      } else if (link.hasClass("tag")) e.preventDefault();
      return;
    }
    // A click selects the card, and shows its task in the tab alongside if one is open;
    // Ctrl/Cmd-click opens that tab.
    if (Keymap.isModEvent(e)) return void this.openTask(task, "side");
    this.focus(task.id);
    const follow = this.openedLeaf();
    if (follow) void this.openTask(task, follow);
  }

  private cardMenu(task: Task, e: MouseEvent) {
    const menu = new Menu();
    const sub = (title: string, icon: string, fill: (m: Menu) => void) => {
      let nested = false;
      menu.addItem((item) => {
        item.setTitle(title).setIcon(icon);
        const submenu = (item as MenuItem & { setSubmenu?: () => Menu }).setSubmenu?.();
        if (submenu) {
          nested = true;
          fill(submenu);
        } else item.setIsLabel(true);
      });
      // Without submenus, the choices follow the title, flat.
      if (!nested) fill(menu);
    };
    sub(t("moveTo"), "arrow-right-left", (m) => {
      for (const column of this.query.columns) {
        if (column.status === task.status) continue;
        m.addItem((item) => item.setTitle(column.label).onClick(() => void this.setTaskStatus(task, column.status)));
      }
    });
    sub(t("priority"), "signal", (m) => {
      for (const p of PRIORITIES) {
        m.addItem((item) =>
          item
            .setTitle(priorityName(p.name))
            .setChecked(task.info.priority === p.level)
            .onClick(() => void this.write(task, (line) => [setPriority(line, p.level)])),
        );
      }
    });
    sub(t("due"), "calendar", (m) => {
      const today = this.today();
      const set = (day: Day | null) => () => void this.write(task, (line) => [setDate(line, "due", day)]);
      m.addItem((item) => item.setTitle(t("today")).onClick(set(today)));
      m.addItem((item) => item.setTitle(t("tomorrow")).onClick(set(today + 1)));
      m.addItem((item) => item.setTitle(t("nextWeek")).onClick(set(today + 7)));
      if (task.info.dates.due !== undefined) m.addItem((item) => item.setTitle(t("noDate")).onClick(set(null)));
    });
    menu.addSeparator();
    const edit = tasksApi(this.app)?.editTaskLineModal;
    if (edit) {
      menu.addItem((item) =>
        item
          .setTitle(t("edit"))
          .setIcon("pencil")
          .onClick(async () => {
            const result = await edit(task.text);
            if (result) await this.write(task, () => result.split("\n"));
          }),
      );
    }
    menu.addItem((item) => item.setTitle(t("openNote")).setIcon("columns-2").onClick(() => void this.openTask(task, "side")));
    menu.showAtMouseEvent(e);
  }

  /* ---------- dragging ---------- */

  private target(cell: HTMLElement) {
    const model = this.model!;
    const column = model.columns[Number(cell.dataset.column)];
    const laneIndex = Number(cell.dataset.lane);
    return { column, lane: laneIndex >= 0 ? model.lanes?.[laneIndex] ?? null : null, laneIndex };
  }

  /**
   * The priority bands of a column, highest first (lowest first when reversed): only when
   * its sort starts with the priority, and not when the groups already are priorities.
   */
  private bandLevels(def: ColumnDef): Priority[] | null {
    const first = (def.sort ?? this.query.sort)[0];
    if (first?.key !== "priority" || this.toolbar.groupBy === "priority") return null;
    return first.reverse ? [...PRIORITIES].reverse() : [...PRIORITIES];
  }

  /** Picking a card up splits each column sorted by priority into one band per priority. */
  private showBands() {
    if (!this.model) return;
    for (const cell of Array.from(this.shell?.board.querySelectorAll<HTMLElement>(".dot-kanban-cell") ?? [])) {
      const levels = this.bandLevels(this.model.columns[Number(cell.dataset.column)].def);
      if (!levels) continue;
      const cards = Array.from(cell.querySelectorAll<HTMLElement>(":scope > .dot-kanban-card"));
      cell.addClass("is-banded");
      for (const level of levels) {
        const band = cell.createDiv({ cls: "dot-kanban-band", attr: { "data-priority": level.name, "data-level": String(level.level) } });
        const label = band.createDiv({ cls: "dot-kanban-band-label" });
        if (PRIORITY_ICONS[level.name]) setIcon(label.createSpan({ cls: "dot-kanban-band-icon" }), PRIORITY_ICONS[level.name]);
        label.createSpan({ text: priorityName(level.name) });
        for (const card of cards) if (this.taskOf(card)?.info.priority === level.level) band.appendChild(card);
      }
    }
  }

  /** The band of `cell` at height `y`: the one it is over, else the nearest. */
  private bandAt(cell: HTMLElement, y: number): HTMLElement | null {
    const bands = Array.from(cell.querySelectorAll<HTMLElement>(":scope > .dot-kanban-band"));
    if (!bands.length) return null;
    return bands.find((b) => y < b.getBoundingClientRect().bottom) ?? bands[bands.length - 1];
  }

  private showPlaceholder(card: HTMLElement, cell: HTMLElement | null, y: number | null = null) {
    const task = this.taskOf(card);
    const band = cell && y !== null ? this.bandAt(cell, y) : null;
    if (this.placeholder && this.hovered?.cell === cell && this.hovered?.band === band) return;
    this.hidePlaceholder();
    this.hovered = { cell, band };
    if (!cell || !task || !this.model) return;
    const { column, laneIndex } = this.target(cell);
    if (laneIndex !== Number(card.dataset.lane) && !this.model.lanesEditable) return;
    const level = band ? Number(band.dataset.level) : task.info.priority;
    const sameCell = cell.dataset.column === card.dataset.column && cell.dataset.lane === card.dataset.lane;
    const placeholder = createDiv({ cls: "dot-kanban-placeholder" });
    placeholder.setCssStyles({ height: `${card.offsetHeight}px` });
    if (sameCell && level === task.info.priority) {
      placeholder.addClass("is-home");
      placeholder.setText((column.def.sort ?? this.query.sort).map((s) => s.key).join(", "));
      card.after(placeholder);
    } else {
      const moved = { ...task, info: { ...task.info, priority: level } };
      const container = band ?? cell;
      const cards = Array.from(container.querySelectorAll<HTMLElement>(":scope > .dot-kanban-card"))
        .map((el) => ({ el, task: this.taskOf(el) }))
        .filter((c) => c.task && c.task.id !== task.id);
      const compare = compareTasks(column.def.sort ?? this.query.sort);
      const before = cards.find((c) => compare(moved, c.task!) < 0)?.el ?? container.querySelector(":scope > .dot-kanban-show-more");
      container.insertBefore(placeholder, before);
      // A priority that changes is said, never silently written.
      if (level !== task.info.priority) {
        const name = priorityByLevel(level).name;
        const label = placeholder.createDiv({ cls: "dot-kanban-placeholder-label" });
        if (PRIORITY_ICONS[name]) setIcon(label.createSpan({ cls: "dot-kanban-band-icon" }), PRIORITY_ICONS[name]);
        label.createSpan({ text: `${t("priority")} : ${priorityName(name)}` });
      }
    }
    (band ?? cell).addClass("is-target");
    this.placeholder = placeholder;
  }

  private hidePlaceholder() {
    this.placeholder?.remove();
    this.placeholder = null;
    this.hovered = null;
    this.shell?.board.querySelectorAll(".is-target").forEach((c) => c.removeClass("is-target"));
  }

  /**
   * A card dropped in a cell: the column gives the status, the group the group's value,
   * the band the priority. Nothing changes: the board is drawn again, bands gone.
   */
  private async dropCard(card: HTMLElement, cell: HTMLElement, y: number) {
    const task = this.taskOf(card);
    const band = this.bandAt(cell, y);
    if (!task || !this.model) return this.render();
    const fromLane = Number(card.dataset.lane);
    const { column, lane, laneIndex } = this.target(cell);
    if (laneIndex !== fromLane && !this.model.lanesEditable) return this.render();
    const fromValue = fromLane >= 0 ? this.model.lanes?.[fromLane]?.value ?? null : null;
    const laneFn = laneIndex !== fromLane && lane !== null && this.toolbar.groupBy ? laneEdit(task, this.toolbar.groupBy, fromValue, lane.value) : null;
    const level = band ? Number(band.dataset.level) : task.info.priority;
    const priorityFn = level !== task.info.priority ? (line: string) => setPriority(line, level) : null;
    if (column.def.status === task.status && !laneFn && !priorityFn) return this.render();
    const edits = [laneFn, priorityFn].filter((f): f is (line: string) => string => f !== null);
    const where = [lane ? this.laneLabel(lane) : null, priorityFn ? priorityName(priorityByLevel(level).name) : null].filter(Boolean).join(" · ");
    await this.setTaskStatus(task, column.def.status, edits.length ? (line) => edits.reduce((l, f) => f(l), line) : undefined, where || undefined);
  }

  /* ---------- keyboard ---------- */

  private onKey(e: KeyboardEvent) {
    const card = (e.target as HTMLElement).closest<HTMLElement>(".dot-kanban-card");
    if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey) && !e.shiftKey && this.undos.length) {
      if ((e.target as HTMLElement).closest("input")) return;
      e.preventDefault();
      void this.undo();
      return;
    }
    if (!card || (e.target as HTMLElement).closest("button, input")) return;
    const task = this.taskOf(card);
    if (!task || !this.model) return;
    const columns = this.model.columns.length;
    const column = Number(card.dataset.column);
    if (this.lifted) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = Math.max(0, Math.min(columns - 1, this.lifted.column + (e.key === "ArrowLeft" ? -1 : 1)));
        this.lifted.column = next;
        this.liftTarget(card, next);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        const target = this.model.columns[this.lifted.column].def.status;
        this.dropLift(card);
        if (target !== task.status) void this.setTaskStatus(task, target);
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.dropLift(card);
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void this.openTask(task, "side");
    } else if (e.key === " ") {
      e.preventDefault();
      this.lifted = { id: task.id, column };
      card.addClass("is-lifted");
      this.liftTarget(card, column);
    } else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const cell = card.parentElement!;
      const cards = [...cell.querySelectorAll<HTMLElement>(".dot-kanban-card")];
      const i = cards.indexOf(card);
      let next: HTMLElement | undefined;
      if (e.key === "ArrowUp") next = cards[i - 1];
      else if (e.key === "ArrowDown") next = cards[i + 1];
      else {
        const lane = card.dataset.lane;
        const target = column + (e.key === "ArrowLeft" ? -1 : 1);
        const other = this.shell!.board.querySelector(`.dot-kanban-cell[data-column="${target}"][data-lane="${lane}"]`);
        const others = [...(other?.querySelectorAll<HTMLElement>(".dot-kanban-card") ?? [])];
        next = others[Math.min(i, others.length - 1)];
      }
      next?.focus();
    }
  }

  private liftTarget(card: HTMLElement, column: number) {
    this.hidePlaceholder();
    const cell = this.shell!.board.querySelector<HTMLElement>(`.dot-kanban-cell[data-column="${column}"][data-lane="${card.dataset.lane}"]`);
    if (cell) this.showPlaceholder(card, cell);
  }

  private dropLift(card: HTMLElement) {
    this.lifted = null;
    card.removeClass("is-lifted");
    this.hidePlaceholder();
  }

  /* ---------- opening ---------- */

  private fileAt(path: string): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  /** Opens the task's note, cursor on the task: in the right sidebar, opened if folded, or in a new tab. */
  /**
   * Opens the task's note, cursor on the task: in a tab alongside the board (`side`, the
   * same one each time while it stays open), or in a given leaf keeping the focus on the
   * board.
   */
  private async openTask(task: Task, where: "side" | WorkspaceLeaf) {
    this.focus(task.id);
    const file = this.fileAt(task.path);
    if (!file) return void new Notice(t("missingFile", { path: task.path }));
    const lines = (await this.app.vault.cachedRead(file)).split("\n").map((l) => l.replace(/\r$/, ""));
    const line = locateTask(lines, { line: task.line, text: task.text });
    const follow = typeof where !== "string";
    const leaf = follow ? where : this.sideLeaf();
    await leaf.openFile(file, { active: !follow, eState: line === null ? undefined : { line } });
    if (!follow) await this.app.workspace.revealLeaf(leaf);
    if (line !== null && leaf.view instanceof MarkdownView) leaf.view.editor.setCursor({ line, ch: 0 });
    opened = leaf;
  }

  /** The tab alongside the board: the one dot-kanban opened before if still there, else a new split. */
  private sideLeaf(): WorkspaceLeaf {
    const ws = this.app.workspace;
    if (opened && this.isOpen(opened) && opened.getRoot() === ws.rootSplit) return opened;
    const board = ws.getLeavesOfType("markdown").find((l) => l.view.containerEl.contains(this.containerEl));
    if (board) ws.setActiveLeaf(board, { focus: false });
    return ws.getLeaf("split", "vertical");
  }

  private isOpen(leaf: WorkspaceLeaf): boolean {
    return this.app.workspace.getLeavesOfType("markdown").includes(leaf);
  }

  /** The tab alongside where dot-kanban last opened a note, if it is still open. */
  private openedLeaf(): WorkspaceLeaf | null {
    if (!opened || !this.isOpen(opened) || opened.view.containerEl.contains(this.containerEl)) return null;
    return opened;
  }

  private focus(id: string) {
    this.focused = id;
    this.shell?.board.querySelectorAll(".dot-kanban-card").forEach((el) => el.toggleClass("is-focused", el.getAttribute("data-id") === id));
  }

  /* ---------- writing ---------- */

  /**
   * Rewrites the task in one atomic read-modify-write of its note, after finding it again
   * by its text. `edit` returns the new lines, or null to write nothing.
   */
  private async write(task: Task, edit: (line: string) => string[] | null, message?: string): Promise<boolean> {
    this.cancelRefresh();
    const file = this.fileAt(task.path);
    if (!file) {
      new Notice(t("missingFile", { path: task.path }));
      return false;
    }
    const outcome: { rewrite: Rewrite | null; refused: boolean } = { rewrite: null, refused: false };
    await this.app.vault.process(file, (data) => {
      outcome.rewrite = rewriteTask(data, { line: task.line, text: task.text }, (line) => {
        const out = edit(line);
        if (!out) outcome.refused = true;
        return out ?? [line];
      });
      return outcome.rewrite && !outcome.refused ? outcome.rewrite.content : data;
    });
    if (outcome.refused) return false;
    const rewrite = outcome.rewrite;
    if (!rewrite) {
      new Notice(t("notFound"), 8000);
      this.scheduleRefresh(0);
      return false;
    }
    this.undos.push({ path: task.path, rewrite });
    if (this.undos.length > UNDO_DEPTH) this.undos.shift();
    this.index.wrote(file, rewrite.content);
    // The task itself is the last line Tasks writes for a recurrence.
    this.focused = `${task.path}:${rewrite.line + rewrite.after.length - 1}`;
    await this.refresh();
    this.notify(message ?? t("updated", { title: task.info.description }));
    return true;
  }

  private notify(message: string) {
    const fragment = createFragment((f) => {
      f.createSpan({ text: message });
      const button = f.createEl("button", { cls: "dot-kanban-notice-undo", text: t("undo") });
      button.onclick = () => void this.undo();
    });
    new Notice(fragment, 6000);
  }

  /**
   * Gives the task `status`, and runs `alsoEdit` (a lane change) on the result. A
   * recurring task reaching done is handed to Tasks, which writes the next occurrence.
   */
  private async setTaskStatus(task: Task, status: Status, alsoEdit?: (line: string) => string, where?: string) {
    const today = this.today();
    const then = (lines: string[]) => (alsoEdit ? lines.map((l) => (checkboxOf(l) === null ? l : alsoEdit(l))) : lines);
    const column = this.query.columns.find((c) => c.status === status)?.label ?? status.name;
    const message = t("moved", { title: task.info.description, column: where ? `${column} · ${where}` : column });
    const enteringDone = status.type === "DONE" && task.status?.type !== "DONE";
    if (enteringDone && task.info.recurrence !== null) {
      const toggle = tasksApi(this.app)?.executeToggleTaskDoneCommand;
      if (!toggle) return void new Notice(t("recurringNeedsTasks"), 10000);
      let failed = false;
      await this.write(
        task,
        (line) => {
          const out = toggleUntilDone(line, (l) => toggle(l, task.path));
          if (!out) failed = true;
          return out && then(out);
        },
        message,
      );
      if (failed) new Notice(t("recurringFailed"), 8000);
      return;
    }
    await this.write(task, (line) => then([task.status === status ? line : setStatus(line, status.symbol, today)]), message);
  }

  private async undo() {
    const last = this.undos.pop();
    if (!last) return;
    const file = this.fileAt(last.path);
    if (!file) return;
    let ok = false;
    await this.app.vault.process(file, (data) => {
      const reverted = revertRewrite(data, last.rewrite);
      ok = reverted !== null;
      return reverted ?? data;
    });
    new Notice(ok ? t("undone") : t("cannotUndo"));
    if (ok) {
      this.index.invalidate(last.path);
      this.focused = `${last.path}:${last.rewrite.line}`;
      this.scheduleRefresh(0);
    }
  }
}
