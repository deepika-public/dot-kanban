// Tasks of one note, from Obsidian's metadata cache and the note's text. Pure: the cache
// is handed over as plain data, so this is testable without Obsidian.
import { statusOf, type Status } from "./statuses";
import { fieldKey, parseLine, splitValues, type LineInfo } from "./task";

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

export interface Task {
  /** `path:line`, stable while the board shows it. */
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
}

/** A property value as a list of texts: `Alice, Bob`, `[Alice, Bob]`, `[[Alice]]`. */
export function propValues(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(propValues);
  if (typeof value === "string") return splitValues(value);
  if (typeof value === "number" || typeof value === "boolean") return splitValues(String(value));
  return [];
}

function noteOf(data: NoteData): Note {
  const props: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(data.frontmatter ?? {})) {
    const k = fieldKey(key);
    props[k] = [...(props[k] ?? []), ...propValues(value)];
  }
  return { props, tags: data.tags };
}

/**
 * The cards of a note: its tasks with no task above them in their list. A sub-task is
 * not a card; it counts in its parent's progress and hands it its fields.
 */
export function collectTasks(data: NoteData): Task[] {
  const note = noteOf(data);
  const byLine = new Map(data.items.map((item) => [item.line, item]));
  const childTasks = new Map<number, NoteData["items"]>();
  for (const item of data.items) {
    if (item.task === undefined || item.parent < 0) continue;
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
    let parent = byLine.get(line)?.parent ?? -1;
    while (parent >= 0) {
      const item = byLine.get(parent);
      if (!item) return null;
      if (item.task !== undefined) return item;
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
  for (const item of data.items) {
    if (item.task === undefined || parentTask(item.line)) continue;
    const text = data.lines[item.line] ?? "";
    const info = parseLine(text);
    if (!info) continue;
    const counted = (childTasks.get(item.line) ?? []).filter((c) => c.task !== "-");
    tasks.push({
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
    });
  }
  return tasks;
}

export const fieldValues = (task: Task, key: string) => task.fields[key]?.values ?? [];
