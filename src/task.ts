// Reading and rewriting one Markdown task line, in the Tasks plugin's formats (emoji or
// Dataview fields). Pure: no Obsidian import.
import { formatDay, parseDay, type Day } from "./dates";
import { canonicalSymbol, statusOf } from "./statuses";

// `- [ ]`, `* [x]`, `+ [/]`, `1. [ ]`, `1) [-]`, indented or not.
const TASK = /^(\s*(?:[-*+]|\d+[.)])\s*\[)(.)\]/;

const isTaskLine = (line: string) => TASK.test(line);

export function checkboxOf(line: string): string | null {
  return line.match(TASK)?.[2] ?? null;
}

/** The line without its list marker and checkbox. */
export const taskBody = (line: string) => line.replace(TASK, "").replace(/^\s+/, "");

/* ---------- vocabulary of the Tasks plugin ---------- */

export interface Priority {
  level: number;
  name: string;
  emoji: string;
}

/** Highest first. `none` writes nothing. */
export const PRIORITIES: readonly Priority[] = [
  { level: 6, name: "highest", emoji: "🔺" },
  { level: 5, name: "high", emoji: "⏫" },
  { level: 4, name: "medium", emoji: "🔼" },
  { level: 3, name: "none", emoji: "" },
  { level: 2, name: "low", emoji: "🔽" },
  { level: 1, name: "lowest", emoji: "⏬" },
];
export const NO_PRIORITY = 3;
export const priorityByName = (name: string) => PRIORITIES.find((p) => p.name === name.toLowerCase()) ?? null;
export const priorityByLevel = (level: number) => PRIORITIES.find((p) => p.level === level) ?? PRIORITIES[3];

export type DateKind = "due" | "scheduled" | "start" | "created" | "done" | "cancelled";
export const DATE_KINDS: readonly DateKind[] = ["due", "scheduled", "start", "created", "done", "cancelled"];

const DATE_EMOJI: Record<DateKind, string[]> = {
  due: ["📅", "📆", "🗓"],
  scheduled: ["⏳", "⌛"],
  start: ["🛫"],
  created: ["➕"],
  done: ["✅"],
  cancelled: ["❌"],
};
/** Field name of each date in the Tasks plugin's Dataview format. */
const DATE_FIELD: Record<DateKind, string> = {
  due: "due",
  scheduled: "scheduled",
  start: "start",
  created: "created",
  done: "completion",
  cancelled: "cancelled",
};
const RECURRENCE = "🔁";
/** Dataview-format fields that belong to Tasks, not to the user. */
const TASKS_FIELDS = new Set([...Object.values(DATE_FIELD), "priority", "repeat", "id", "dependson", "oncompletion"]);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const VS = "\\uFE0F?";
const SIGNIFIERS = "📅📆🗓⏳⌛🛫➕✅❌🔁🔺⏫🔼🔽⏬🆔⛔🏁";
const emojiDate = (kind: DateKind) =>
  new RegExp(`\\s*(?:${DATE_EMOJI[kind].join("|")})${VS}\\s*(\\d{4}-\\d{2}-\\d{2})`, "gu");
const PRIORITY_EMOJI = new RegExp(`\\s*(?:${PRIORITIES.filter((p) => p.emoji).map((p) => p.emoji).join("|")})${VS}`, "gu");
const RECURRENCE_RULE = new RegExp(`\\s*${RECURRENCE}${VS}\\s*([^${SIGNIFIERS}\\[#^]*)`, "gu");
const OTHER_SIGNIFIERS = new RegExp(`\\s*(?:🆔${VS}\\s*[\\w-]+|⛔${VS}\\s*[\\w-]+(?:\\s*,\\s*[\\w-]+)*|🏁${VS}\\s*\\w+)`, "gu");
const BLOCK_ID = /\s+\^[\w-]+\s*$/;
// `[key:: value]` or `(key:: value)`; a value may hold `[[links]]`.
const FIELD = /\[([\w][\w -]*?)::\s*((?:\[\[[^\]]*\]\]|[^\]])*)\]|\(([\w][\w -]*?)::\s*((?:\[\[[^\]]*\]\]|[^)])*)\)/g;
const TAG = /(^|\s)(#[^\s#,.;:!?()[\]{}"'`]*[^\s#,.;:!?()[\]{}"'`\d][^\s#,.;:!?()[\]{}"'`]*)/g;

/** The field naming who a task is for. */
export const OWNER = "owner";
/** Short spellings of fields: `[o:: Alice]` is `[owner:: Alice]`. */
const FIELD_ALIASES: Record<string, string> = { o: OWNER };

/** A field key as the board knows it: lower case, aliases resolved. */
export function fieldKey(key: string): string {
  const k = key.trim().toLowerCase().replace(/\s+/g, "-");
  return FIELD_ALIASES[k] ?? k;
}

/** The spellings of a field in a line: `owner` and `o`. */
export const fieldSpellings = (key: string) => [key, ...Object.keys(FIELD_ALIASES).filter((a) => FIELD_ALIASES[a] === key)];

/** `Alice, [[Bob, the builder]]` → two values; commas inside a link do not split. */
export function splitValues(raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < raw.length; i++) {
    if (raw.startsWith("[[", i)) depth++;
    if (raw.startsWith("]]", i)) depth = Math.max(0, depth - 1);
    if (raw[i] === "," && depth === 0) {
      out.push(current);
      current = "";
    } else current += raw[i];
  }
  out.push(current);
  return out.map((v) => v.trim()).filter((v) => v.length > 0);
}

/** What a value reads as: `[[People/Alice|Ali]]` → `Ali`, `[[Alice]]` → `Alice`. */
export function valueText(value: string): string {
  const link = value.match(/^\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]$/);
  if (!link) return value;
  return (link[2] ?? link[1].split("/").pop() ?? link[1]).trim();
}

/* ---------- reading ---------- */

export interface LineInfo {
  /** Checkbox character, `X` read as `x`. */
  symbol: string;
  /** The task as shown on a card: the line without the Tasks emojis and their values. Markdown. */
  title: string;
  /** The task's words, without Tasks signifiers, fields nor block id: what identifies it. */
  description: string;
  priority: number;
  dates: Partial<Record<DateKind, Day>>;
  recurrence: string | null;
  /** The user's inline fields, keys in lower case. Tasks' own fields are not here. */
  fields: Record<string, string[]>;
  tags: string[];
  /** The line writes Tasks data as Dataview fields (`[due:: …]`) rather than emojis. */
  dataview: boolean;
}

export function parseLine(line: string): LineInfo | null {
  const box = checkboxOf(line);
  if (box === null) return null;
  const body = taskBody(line);
  const fields: Record<string, string[]> = {};
  const tasksFields: Record<string, string> = {};
  for (const m of body.matchAll(FIELD)) {
    const key = fieldKey(m[1] ?? m[3]);
    const raw = (m[2] ?? m[4]).trim();
    if (TASKS_FIELDS.has(key)) tasksFields[key] ??= raw;
    else fields[key] = [...(fields[key] ?? []), ...splitValues(raw)];
  }

  const dates: Partial<Record<DateKind, Day>> = {};
  for (const kind of DATE_KINDS) {
    const emoji = [...body.matchAll(emojiDate(kind))][0]?.[1];
    const day = parseDay(emoji ?? tasksFields[DATE_FIELD[kind]] ?? "");
    if (day !== null) dates[kind] = day;
  }

  // PRIORITIES is highest first: the highest emoji present wins.
  const named = tasksFields.priority ? priorityByName(tasksFields.priority) : null;
  const priority = named?.level ?? PRIORITIES.find((p) => p.emoji && body.includes(p.emoji))?.level ?? NO_PRIORITY;

  const rule = [...body.matchAll(RECURRENCE_RULE)][0]?.[1]?.trim() || tasksFields.repeat || null;
  const recurrence = rule ?? (body.includes(RECURRENCE) ? "" : null);

  let title = body;
  for (const kind of DATE_KINDS) title = title.replace(emojiDate(kind), " ");
  title = title.replace(RECURRENCE_RULE, " ").replace(PRIORITY_EMOJI, " ").replace(OTHER_SIGNIFIERS, " ").replace(/\s+/g, " ").trim();
  const description = title.replace(FIELD, " ").replace(BLOCK_ID, "").replace(/\s+/g, " ").trim();

  return {
    symbol: canonicalSymbol(box),
    title,
    description,
    priority,
    dates,
    recurrence,
    fields,
    tags: [...description.matchAll(TAG)].map((m) => m[2]),
    dataview: Object.keys(tasksFields).length > 0,
  };
}

/* ---------- writing ---------- */

/** Appends before a trailing block id (`^abc`), which must stay last. */
function append(line: string, piece: string): string {
  const id = line.match(BLOCK_ID);
  const head = (id ? line.slice(0, id.index) : line).trimEnd();
  return `${head} ${piece}${id ? id[0].trimEnd() : ""}`;
}

const removeField = (line: string, key: string) =>
  line.replace(new RegExp(`\\s*(?:\\[${escape(key)}::(?:\\[\\[[^\\]]*\\]\\]|[^\\]])*\\]|\\(${escape(key)}::(?:\\[\\[[^\\]]*\\]\\]|[^)])*\\))`, "gi"), "");

const usesDataview = (line: string) => parseLine(line)?.dataview ?? false;

export function setDate(line: string, kind: DateKind, day: Day | null, dataview = usesDataview(line)): string {
  const out = removeField(line.replace(emojiDate(kind), ""), DATE_FIELD[kind]).trimEnd();
  if (day === null) return out;
  return append(out, dataview ? `[${DATE_FIELD[kind]}:: ${formatDay(day)}]` : `${DATE_EMOJI[kind][0]} ${formatDay(day)}`);
}

const withCheckbox = (line: string, symbol: string) => line.replace(TASK, (_, head: string) => `${head}${symbol}]`);

/**
 * Writes the checkbox. Entering a done status adds today's `✅` date, entering a
 * cancelled one today's `❌` date; leaving them removes the date. A date already
 * there is kept.
 */
export function setStatus(line: string, symbol: string, today: Day): string {
  const before = parseLine(line);
  if (!before) return line;
  const from = statusOf(before.symbol)?.type;
  const to = statusOf(symbol)?.type;
  let out = withCheckbox(line, symbol);
  for (const [type, kind] of [["DONE", "done"], ["CANCELLED", "cancelled"]] as const) {
    if (to === type && before.dates[kind] === undefined) out = setDate(out, kind, today, before.dataview);
    else if (from === type && to !== type) out = setDate(out, kind, null);
  }
  return out;
}

/** Replaces any priority by `level`; `none` writes nothing. */
export function setPriority(line: string, level: number): string {
  const dataview = usesDataview(line);
  const out = removeField(line.replace(PRIORITY_EMOJI, ""), "priority").trimEnd();
  const p = priorityByLevel(level);
  if (p.level === NO_PRIORITY) return out;
  return append(out, dataview ? `[priority:: ${p.name}]` : p.emoji);
}

/** Writes `[key:: a, b]` in place of any field of that key (or its aliases); no values removes it. */
export function setField(line: string, key: string, values: readonly string[]): string {
  let out = line;
  for (const spelling of fieldSpellings(key)) out = removeField(out, spelling);
  out = out.trimEnd();
  return values.length ? append(out, `[${key}:: ${values.join(", ")}]`) : out;
}

/**
 * Toggles a line with Tasks until it is done: Tasks follows its own cycle of statuses
 * (` ` → `/` → `x`…) and writes the next occurrence of a recurring task only on reaching
 * done. The lines Tasks returns then, or null if done is never reached.
 */
export function toggleUntilDone(line: string, toggle: (line: string) => string, max = STATUSES_IN_A_CYCLE): string[] | null {
  let current = line;
  for (let i = 0; i < max; i++) {
    const out = toggle(current).split("\n").filter((l) => l.trim().length > 0);
    if (out.some((l) => statusOf(checkboxOf(l) ?? "")?.type === "DONE")) return out;
    if (out.length !== 1 || out[0] === current) return null;
    current = out[0];
  }
  return null;
}
/** More toggles than any cycle of statuses needs. */
const STATUSES_IN_A_CYCLE = 12;

/* ---------- finding a task again ---------- */

/**
 * The part of a task the board never writes: its words, without list marker, checkbox,
 * Tasks signifiers, fields nor spacing. Same text, same task, whatever the board did.
 */
export function normalizeTaskText(line: string): string {
  const info = parseLine(line.split("\n")[0]);
  return (info ? info.description : line).replace(/\s+/g, " ").trim();
}

export interface TaskRef {
  /** 0-based line where the task was seen. */
  line: number;
  /** Its text then. */
  text: string;
}

/**
 * Where the task is now: the expected line if it still holds the same task, otherwise
 * the closest task line with the same text. Null rather than a guess.
 */
export function locateTask(lines: readonly string[], ref: TaskRef): number | null {
  const wanted = normalizeTaskText(ref.text);
  const same = (i: number) => isTaskLine(lines[i]) && normalizeTaskText(lines[i]) === wanted;
  if (ref.line >= 0 && ref.line < lines.length && same(ref.line)) return ref.line;
  let best: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (same(i) && (best === null || Math.abs(i - ref.line) < Math.abs(best - ref.line))) best = i;
  }
  return best;
}

export interface Rewrite {
  content: string;
  /** Line where the replacement starts. */
  line: number;
  before: string[];
  after: string[];
}

const splitLines = (content: string) => {
  const lines = content.split("\n");
  const crlf = lines.map((l) => l.endsWith("\r"));
  return { lines, crlf, bare: lines.map((l, i) => (crlf[i] ? l.slice(0, -1) : l)) };
};

function replaceLines(content: string, at: number, count: number, replacement: readonly string[]): string {
  const { lines, crlf } = splitLines(content);
  const eol = crlf[at] ? "\r" : "";
  lines.splice(at, count, ...replacement.map((l) => l + eol));
  return lines.join("\n");
}

/**
 * Replaces the task by what `edit` makes of its line (several lines for a recurring
 * task). Line endings are kept. Null when the task cannot be found: nothing is written.
 */
export function rewriteTask(content: string, ref: TaskRef, edit: (line: string) => string[]): Rewrite | null {
  const { bare } = splitLines(content);
  const index = locateTask(bare, ref);
  if (index === null) return null;
  const after = edit(bare[index]);
  return { content: replaceLines(content, index, 1, after), line: index, before: [bare[index]], after };
}

/** Undoes a rewrite if its lines are still there, unchanged; null otherwise. */
export function revertRewrite(content: string, done: Pick<Rewrite, "line" | "before" | "after">): string | null {
  const { bare } = splitLines(content);
  const matches = (i: number) => done.after.every((l, k) => bare[i + k] === l);
  let best: number | null = null;
  for (let i = 0; i + done.after.length <= bare.length; i++) {
    if (matches(i) && (best === null || Math.abs(i - done.line) < Math.abs(best - done.line))) best = i;
  }
  return best === null ? null : replaceLines(content, best, done.after.length, done.before);
}
