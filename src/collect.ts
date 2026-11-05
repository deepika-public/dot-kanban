// Tasks of one note, from Obsidian's metadata cache and the note's text. Pure: the cache
// is handed over as plain data, so this is testable without Obsidian.
import { resolveDay } from "./dates";
import { statusOf, type Status } from "./statuses";
import { DATE_KINDS, fieldKey, NO_PRIORITY, parseLine, priorityByName, splitValues, type DateKind, type LineInfo } from "./task";

export interface NoteData {
  path: string;
  frontmatter?: Record<string, unknown>;
  /** Every tag of the note, frontmatter and body. */
  tags: string[];
  headings: { line: number; heading: string }[];
  /** Obsidian's `listItems`: `parent` is the parent item's line, negative at the top level. */
  items: { line: number; parent: number; task?: string }[];
  /** The note's text, one entry per line, without line endings. */
  lines: string[];
}

export interface Note {
  /** Frontmatter properties, keys as fields (lower case, `o` read as `owner`), values as text lists. */
  props: Record<string, string[]>;
  tags: string[];
}

export type FieldSource = "line" | "parent" | "note";

export interface ResolvedField {
  values: string[];
  source: FieldSource;
}

/** A sub-task as a large card lists it. */
export interface Child {
  symbol: string;
  /** Markdown, as a card title. */
  title: string;
}

export interface Task {
  /** `task`: a line of a note; `note`: the note itself, on a board of notes. */
  kind: "task" | "note";
  /** `path:line`, or the path of a note card; stable while the board shows it. */
  id: string;
  path: string;
  /** 0-based line, when read. */
  line: number;
  /** The line as read, to find the task again before writing. */
  text: string;
  info: LineInfo;
  /** Null for a checkbox dot-kanban does not know. */
  status: Status | null;
  note: Note;
  /** Nearest heading above the task. */
  heading: string | null;
  /** Fields as resolved: line, then parent task, then note. */
  fields: Record<string, ResolvedField>;
  subtasks: { done: number; total: number } | null;
  /** The sub-tasks, in note order: a task's, or the cards of a note card's note. */
  children: Child[];
}

/** A property value as a list of texts: `Alice, Bob`, `[Alice, Bob]`, `[[Alice]]`. */
export function propValues(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(propValues);
  if (typeof value === "string") return splitValues(value);
  if (typeof value === "number" || typeof value === "boolean") return splitValues(String(value));
  return [];
}

function noteOf(data: Pick<NoteData, "frontmatter" | "tags">): Note {
  const props: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(data.frontmatter ?? {})) {
    const k = fieldKey(key);
    props[k] = [...(props[k] ?? []), ...propValues(value)];
  }
  return { props, tags: data.tags };
}

const isDone = (symbol: string) => symbol === "x" || symbol === "X";

/**
 * A note as one card, on a board of notes: its name as title, its properties as fields,
 * its cards (tasks with no task above them) as sub-tasks. A `priority` or date property
 * (`due: 2026-11-30`) reads as on a task.
 */
export function noteCard(path: string, frontmatter: Record<string, unknown> | undefined, tags: string[], tasks: readonly Task[]): Task {
  const note = noteOf({ frontmatter, tags });
  const name = (path.split("/").pop() ?? path).replace(/\.md$/i, "");
  const dates: LineInfo["dates"] = {};
  for (const kind of DATE_KINDS) {
    const value = note.props[kind]?.[0];
    const day = value && /^\d{4}-\d{2}-\d{2}/.test(value) ? resolveDay(value.slice(0, 10), 0) : null;
    if (day !== null) dates[kind as DateKind] = day;
  }
  const priority = note.props.priority?.[0];
  const info: LineInfo = {
    symbol: "",
    title: name,
    description: name,
    priority: (priority ? priorityByName(priority)?.level : undefined) ?? NO_PRIORITY,
    dates,
    recurrence: null,
    fields: note.props,
    tags: [],
    dataview: false,
  };
  const counted = tasks.filter((task) => task.info.symbol !== "-");
  return {
    kind: "note",
    id: path,
    path,
    line: -1,
    text: "",
    info,
    status: null,
    note,
    heading: null,
    // The note's own properties: shown as written on the card, not as inherited.
    fields: Object.fromEntries(Object.entries(note.props).map(([k, values]) => [k, { values, source: "line" as const }])),
    subtasks: counted.length ? { done: counted.filter((task) => isDone(task.info.symbol)).length, total: counted.length } : null,
    children: tasks.map((task) => ({ symbol: task.info.symbol, title: task.info.title })),
  };
}

/**
 * The cards of a note: its tasks with no task above them in their list. A sub-task is
 * not a card; it counts in its parent's progress and hands it its fields.
 */
export function collectTasks(data: NoteData): Task[] {
  const note = noteOf(data);
  // A list marker nested on its line (`- - [ ] …`) gives two items on one line, the inner
  // one naming that very line as its parent. The task stands for its line, and a parent
  // is only ever a line above: anything else would loop for ever.
  const byLine = new Map<number, NoteData["items"][number]>();
  for (const item of data.items) if (!byLine.has(item.line) || item.task !== undefined) byLine.set(item.line, item);
  const childTasks = new Map<number, NoteData["items"]>();
  for (const item of data.items) {
    if (item.task === undefined || item.parent < 0 || item.parent >= item.line) continue;
    const siblings = childTasks.get(item.parent);
    if (siblings) siblings.push(item);
    else childTasks.set(item.parent, [item]);
  }
  // Nearest heading above a line: headings are in line order.
  const headings = [...data.headings].sort((a, b) => a.line - b.line);
  const headingAbove = (line: number) => {
    let lo = 0;
    let hi = headings.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (headings[mid].line < line) lo = mid + 1;
      else hi = mid;
    }
    return lo ? headings[lo - 1].heading : null;
  };
  const parentTask = (line: number) => {
    let below = line;
    let parent = byLine.get(line)?.parent ?? -1;
    while (parent >= 0 && parent < below) {
      const item = byLine.get(parent);
      if (!item) return null;
      if (item.task !== undefined) return item;
      below = parent;
      parent = item.parent;
    }
    return null;
  };

  const noteFields: Record<string, ResolvedField> = {};
  for (const [key, values] of Object.entries(note.props)) noteFields[key] = { values, source: "note" };

  const resolved = new Map<number, Record<string, ResolvedField>>();
  const resolve = (line: number, info: LineInfo): Record<string, ResolvedField> => {
    const known = resolved.get(line);
    if (known) return known;
    const parent = parentTask(line);
    const parentInfo = parent ? parseLine(data.lines[parent.line] ?? "") : null;
    const inherited = parent && parentInfo
      ? Object.fromEntries(
          Object.entries(resolve(parent.line, parentInfo)).map(([k, f]) => [k, f.source === "note" ? f : { ...f, source: "parent" as const }]),
        )
      : noteFields;
    const own = Object.fromEntries(Object.entries(info.fields).map(([k, values]) => [k, { values, source: "line" as const }]));
    const fields = { ...inherited, ...own };
    resolved.set(line, fields);
    return fields;
  };

  const tasks: Task[] = [];
  const seen = new Set<number>();
  for (const item of data.items) {
    if (item.task === undefined || seen.has(item.line) || parentTask(item.line)) continue;
    seen.add(item.line);
    const text = data.lines[item.line] ?? "";
    const info = parseLine(text);
    if (!info) continue;
    const counted = (childTasks.get(item.line) ?? []).filter((c) => c.task !== "-");
    const children = childTasks.get(item.line) ?? [];
    tasks.push({
      kind: "task",
      id: `${data.path}:${item.line}`,
      path: data.path,
      line: item.line,
      text,
      info,
      status: statusOf(info.symbol),
      note,
      heading: headingAbove(item.line),
      fields: resolve(item.line, info),
      subtasks: counted.length
        ? { done: counted.filter((c) => c.task === "x" || c.task === "X").length, total: counted.length }
        : null,
      children: children.map((c) => ({ symbol: c.task!, title: parseLine(data.lines[c.line] ?? "")?.title ?? "" })),
    });
  }
  return tasks;
}

export const fieldValues = (task: Task, key: string) => task.fields[key]?.values ?? [];
