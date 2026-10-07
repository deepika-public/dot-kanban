// What a ```dot-kanban block asks for: one instruction per line, in the manner of Tasks
// queries. Read once per block; a line not understood is reported, the rest applies. Pure.
import { fieldValues, type Task } from "./collect";
import { resolveDay, type Day } from "./dates";
import { t } from "./i18n";
import { DEFAULT_COLUMNS, findStatus, statusOf, type Status } from "./statuses";
import { DATE_KINDS, fieldKey, OWNER, priorityByName, valueText, type DateKind } from "./task";

export interface SortKey {
  /** `priority`, a date kind, `path`, `file order`, or a field key. */
  key: string;
  reverse: boolean;
}

export interface ColumnDef {
  status: Status;
  label: string;
  sort: SortKey[] | null;
  limit: number | null;
}

export interface Filter {
  /** The line as written, for the summary. */
  text: string;
  test: (task: Task, today: Day) => boolean;
  /**
   * The same test on a note's path, when the line looks at nothing else: the notes it
   * rejects need not be read. Null otherwise.
   */
  path: ((path: string) => boolean) | null;
}

export interface QueryError {
  /** 1-based line of the block. */
  line: number;
  text: string;
  message: string;
}

export interface Query {
  columns: ColumnDef[];
  filters: Filter[];
  sort: SortKey[];
  groupBy: string | null;
  /** Card elements shown, §5 of the spec. */
  show: Set<string>;
  width: string | null;
  /**
   * `path root`: the folder the cards' paths are shown from, its segments without the
   * surrounding `/`, in NFC. Null to show the path in the vault. Display only.
   */
  pathRoot: string | null;
  errors: QueryError[];
}

const DEFAULT_SORT: SortKey[] = [
  { key: "priority", reverse: false },
  { key: "due", reverse: false },
  { key: "file order", reverse: false },
];
const DEFAULT_SHOW = ["priority", "due", "subtasks", OWNER, "path"];
/** Card elements that are not fields. */
export const BUILT_IN_SHOW = ["priority", ...DATE_KINDS, "subtasks", "recurrence", OWNER, "path"];
const isBuiltInGroup = (key: string) => ["priority", "note", "heading"].includes(key);
const BUILT_IN_SORTS = ["priority", ...DATE_KINDS, "path", "file order"];
const KEYWORDS = [
  "column", "sort", "group", "show", "hide", "width", "not", "path", "heading", "description", "filename",
  "tags", "tag", "priority", "has", "no", "is", ...DATE_KINDS,
];

/** Case- and accent-insensitive form: "Clément" and "CLEMENT" compare equal. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/** The keyword a typo was meant to be, if one is close enough. */
function nearKeyword(word: string): string | null {
  const w = word.toLowerCase();
  // Short words are too often real field names (`to`, `due` vs `dues`…).
  if (KEYWORDS.includes(w) || w.length < 4) return null;
  const best = KEYWORDS.map((k) => ({ k, d: distance(w, k) })).sort((a, b) => a.d - b.d)[0];
  return best && best.d <= 1 ? best.k : null;
}

class ParseError extends Error {}
const fail = (message: string): never => {
  throw new ParseError(message);
};

const list = (text: string) => text.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

function parseSort(text: string): SortKey[] {
  const keys = list(text).map((part) => {
    const reverse = /\s+reverse$/i.test(part);
    const raw = part.replace(/\s+reverse$/i, "").trim().toLowerCase();
    const key = BUILT_IN_SORTS.includes(raw) ? raw : fieldKey(raw);
    if (!BUILT_IN_SORTS.includes(key) && !/^[\w][\w-]*$/.test(key)) fail(t("badSort", { text: part }));
    return { key, reverse };
  });
  if (!keys.length) fail(t("emptyList", { text: "sort by" }));
  return keys;
}

/* ---------- filters ---------- */

type Test = Filter["test"];
type TextOp = "includes" | "does not include" | "is" | "is not";
const TEXT_OP = /^(includes?|does not include|do not include|is not|is)\s+(.+)$/i;

function textMatch(op: string, wanted: string): (values: string[]) => boolean {
  const w = fold(wanted.trim());
  const normalized = op.toLowerCase().replace(/^include$/, "includes").replace("do not", "does not") as TextOp;
  const any = (values: string[], match: (v: string) => boolean) => values.some((v) => match(fold(v)));
  switch (normalized) {
    case "includes":
      return (values) => any(values, (v) => v.includes(w));
    case "does not include":
      return (values) => !any(values, (v) => v.includes(w));
    case "is":
      return (values) => any(values, (v) => v === w);
    default:
      return (values) => !any(values, (v) => v === w);
  }
}

function textTest(op: string, wanted: string, values: (task: Task) => string[]): Test {
  const match = textMatch(op, wanted);
  return (task) => match(values(task));
}

const fileName = (path: string) => path.split("/").pop() ?? "";

const tagText = (tag: string) => tag.replace(/^#/, "");

function dateTest(kind: DateKind, rest: string): Test {
  const m = rest.match(/^(on or before|on or after|before|after|on|is)\s+(.+)$/i);
  if (!m) fail(t("unknownInstruction", { text: `${kind} ${rest}` }));
  const [, op, expr] = m!;
  if (resolveDay(expr, 0) === null) fail(t("badDate", { text: expr }));
  return (task, today) => {
    const day = task.info.dates[kind];
    const target = resolveDay(expr, today)!;
    if (day === undefined) return false;
    switch (op.toLowerCase()) {
      case "before": return day < target;
      case "after": return day > target;
      case "on or before": return day <= target;
      case "on or after": return day >= target;
      default: return day === target;
    }
  };
}

function priorityTest(rest: string): Test {
  const m = rest.match(/^(is not|is|above|below)\s+(\S+)$/i);
  if (!m) fail(t("unknownInstruction", { text: `priority ${rest}` }));
  const p = priorityByName(m![2]) ?? fail(t("badPriority", { text: m![2] }));
  const level = p.level;
  switch (m![1].toLowerCase()) {
    case "is": return (task) => task.info.priority === level;
    case "is not": return (task) => task.info.priority !== level;
    case "above": return (task) => task.info.priority > level;
    default: return (task) => task.info.priority < level;
  }
}

function singleFilter(text: string): Test {
  const negated = text.match(/^not\s+(.+)$/i);
  if (negated) {
    const inner = singleFilter(negated[1]);
    return (task, today) => !inner(task, today);
  }
  const lower = text.toLowerCase();
  if (lower === "is recurring") return (task) => task.info.recurrence !== null;
  if (lower === "is not recurring") return (task) => task.info.recurrence === null;
  const has = lower.match(/^(has|no) (\w+) date$/);
  if (has && (DATE_KINDS as readonly string[]).includes(has[2])) {
    const kind = has[2] as DateKind;
    return has[1] === "has" ? (task) => task.info.dates[kind] !== undefined : (task) => task.info.dates[kind] === undefined;
  }

  const m = text.match(/^([\w.][\w.-]*)\s+(.+)$/);
  if (!m) fail(t("unknownInstruction", { text }));
  const subject = m![1].toLowerCase();
  const rest = m![2];
  if ((DATE_KINDS as readonly string[]).includes(subject)) return dateTest(subject as DateKind, rest);
  if (subject === "priority") return priorityTest(rest);

  const op = rest.match(TEXT_OP);
  if (!op) {
    const near = nearKeyword(subject);
    fail(t("unknownInstruction", { text }) + (near ? `, ${t("didYouMean", { word: near })}` : ""));
  }
  const [, verb, wanted] = op!;
  switch (subject) {
    case "path": return textTest(verb, wanted, (task) => [task.path]);
    case "filename": return textTest(verb, wanted, (task) => [fileName(task.path)]);
    case "heading": return textTest(verb, wanted, (task) => (task.heading ? [task.heading] : []));
    case "description": return textTest(verb, wanted, (task) => [task.info.description]);
    case "tags":
    case "tag": return textTest(verb, tagText(wanted), (task) => task.info.tags.map(tagText));
    case "note.tags":
    case "note.tag": return textTest(verb, tagText(wanted), (task) => task.note.tags.map(tagText));
  }
  if (subject.startsWith("note.")) {
    const prop = fieldKey(subject.slice(5));
    return textTest(verb, valueText(wanted.trim()), (task) => (task.note.props[prop] ?? []).map(valueText));
  }
  const near = nearKeyword(subject);
  if (near) fail(t("unknownInstruction", { text }) + `, ${t("didYouMean", { word: near })}`);
  const key = fieldKey(subject);
  return textTest(verb, valueText(wanted.trim()), (task) => fieldValues(task, key).map(valueText));
}

/* ---------- paths shown ---------- */

const segments = (path: string) => path.normalize("NFC").split("/").filter((s) => s.length > 0);

/**
 * A note's path as a board shows it: what follows the last occurrence of the `path root`
 * folder, compared segment by segment, with case, NFC and NFD alike. A note out of that
 * folder, or no root, keeps its path in the vault.
 */
export function shownPath(path: string, root: string | null): string {
  if (!root) return path;
  const wanted = segments(root);
  const parts = path.split("/");
  const normalized = parts.map((part) => part.normalize("NFC"));
  for (let i = parts.length - wanted.length - 1; i >= 0; i--) {
    if (wanted.every((segment, j) => normalized[i + j] === segment)) return parts.slice(i + wanted.length).join("/");
  }
  return path;
}

/** A part as a test on the note's path, when it is about `path` or `filename` only. */
function pathPart(text: string): ((path: string) => boolean) | null {
  const negated = text.match(/^not\s+(.+)$/i);
  if (negated) {
    const inner = pathPart(negated[1]);
    return inner && ((path) => !inner(path));
  }
  const m = text.match(/^(path|filename)\s+(.+)$/i);
  const op = m?.[2].match(TEXT_OP);
  if (!m || !op) return null;
  const match = textMatch(op[1], op[2]);
  return m[1].toLowerCase() === "path" ? (path) => match([path]) : (path) => match([fileName(path)]);
}

/** A filter line: `a OR b`, each part optionally prefixed by `not`. */
export function parseFilter(text: string): Filter {
  const parts = text.split(/\s+OR\s+/).map((part) => part.trim());
  const tests = parts.map(singleFilter);
  const paths = parts.map(pathPart);
  const path = paths.every((p) => p !== null) ? (p: string) => paths.some((test) => test!(p)) : null;
  return { text, test: (task, today) => tests.some((test) => test(task, today)), path };
}

/** Whether the block's filters on paths let a note's tasks through: false needs no reading. */
export function inScope(query: Query, path: string): boolean {
  return query.filters.every((f) => !f.path || f.path(path));
}

/* ---------- the block ---------- */

function parseColumn(rest: string, query: Query) {
  const [head, ...options] = rest.split("|").map((s) => s.trim());
  const m = head.match(/^(\[.\]|\S+)\s*(.*)$/);
  const status = m ? findStatus(m[1]) : null;
  if (!m || !status) return fail(t("unknownStatus", { ref: m?.[1] ?? head }));
  if (query.columns.some((c) => c.status === status)) fail(t("duplicateColumn", { ref: `[${status.symbol}]` }));
  const column: ColumnDef = { status, label: m[2].trim() || status.name, sort: null, limit: null };
  for (const option of options) {
    const sort = option.match(/^sort by\s+(.+)$/i);
    const limit = option.match(/^limit\s+(.+)$/i);
    if (sort) column.sort = parseSort(sort[1]);
    else if (limit) {
      const n = Number(limit[1]);
      if (!Number.isInteger(n) || n < 1) fail(t("badLimit", { text: limit[1] }));
      column.limit = n;
    } else fail(t("unknownInstruction", { text: option }));
  }
  query.columns.push(column);
}

export function parseQuery(source: string): Query {
  const query: Query = {
    columns: [],
    filters: [],
    sort: DEFAULT_SORT,
    groupBy: null,
    show: new Set(DEFAULT_SHOW),
    width: null,
    pathRoot: null,
    errors: [],
  };
  source.split("\n").forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    try {
      const [, word, rest = ""] = line.match(/^(\S+)\s*(.*)$/)!;
      switch (word.toLowerCase()) {
        case "column":
          return parseColumn(rest, query);
        case "sort": {
          const m = rest.match(/^by\s+(.+)$/i) ?? fail(t("badSort", { text: rest }));
          query.sort = parseSort(m[1]);
          return;
        }
        case "group": {
          const m = rest.match(/^by\s+([\w][\w-]*)$/i) ?? fail(t("badGroup", { text: rest }));
          query.groupBy = isBuiltInGroup(m[1].toLowerCase()) ? m[1].toLowerCase() : fieldKey(m[1]);
          return;
        }
        case "show":
        case "hide": {
          const items = list(rest.toLowerCase());
          if (!items.length) fail(t("emptyList", { text: word }));
          for (const item of items.map((i) => (BUILT_IN_SHOW.includes(i) ? i : fieldKey(i)))) {
            if (word.toLowerCase() === "show") query.show.add(item);
            else query.show.delete(item);
          }
          return;
        }
        case "path": {
          // `path root …` sets how paths are shown; any other `path …` is a filter.
          const root = rest.match(/^root(?:\s+(.*))?$/i);
          if (!root) return void query.filters.push(parseFilter(line));
          const folder = segments(root[1] ?? "");
          if (!folder.length) fail(t("badPathRoot"));
          query.pathRoot = folder.join("/");
          return;
        }
        case "width":
          if (!/^\d+(\.\d+)?(px|rem|em|%)$/.test(rest)) fail(t("badWidth", { text: rest }));
          query.width = rest;
          return;
        default:
          query.filters.push(parseFilter(line));
      }
    } catch (error) {
      if (!(error instanceof ParseError)) throw error;
      query.errors.push({ line: index + 1, text: line, message: error.message });
    }
  });
  if (!query.columns.length) {
    for (const symbol of DEFAULT_COLUMNS) {
      const status = statusOf(symbol)!;
      query.columns.push({ status, label: status.name, sort: null, limit: null });
    }
  }
  return query;
}

