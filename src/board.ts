// Which cards a board shows, where, in what order, and which it leaves out and why. Pure.
import { fieldValues, type Task } from "./collect";
import type { Day } from "./dates";
import { fold, type ColumnDef, type Query, type SortKey } from "./query";
import type { Status } from "./statuses";
import { DATE_KINDS, NO_PRIORITY, OWNER, PRIORITIES, priorityByLevel, setField, setPriority, valueText, type DateKind } from "./task";

/** The toolbar's choices, on top of the block. */
export interface Toolbar {
  search: string;
  /** An `owner` value, "" for everyone. */
  person: string;
  /** Groups: a field key, `priority`, `note`, `heading`; null for none. */
  groupBy: string | null;
}

export type Reason =
  | { kind: "noColumn"; status: Status }
  | { kind: "unknown"; symbol: string }
  | { kind: "limit"; limit: number }
  | { kind: "toolbar" };

export interface Hidden {
  task: Task;
  reason: Reason;
}

export interface Lane {
  /** Value written when a card is dropped in this lane; null for the lane without value. */
  value: string | null;
  label: string;
  /** One list of cards per column. */
  cells: Task[][];
  count: number;
}

export interface BoardModel {
  columns: { def: ColumnDef; cards: Task[] }[];
  lanes: Lane[] | null;
  /** Cards can change lane: false for lanes by note or heading. */
  lanesEditable: boolean;
  shown: number;
  hidden: Hidden[];
  /** `owner` values met in the block's scope, for the toolbar. */
  people: string[];
}

/* ---------- order ---------- */

type SortValue = number | string | null;

function sortValue(task: Task, key: string): SortValue {
  if (key === "priority") return -task.info.priority;
  if ((DATE_KINDS as readonly string[]).includes(key)) return task.info.dates[key as DateKind] ?? null;
  if (key === "path") return fold(task.path);
  if (key === "file order") return null;
  const first = fieldValues(task, key)[0];
  return first === undefined ? null : fold(valueText(first));
}

/** Missing values go last, reversed or not; ties fall back to the order in the vault. */
export function compareTasks(keys: readonly SortKey[]): (a: Task, b: Task) => number {
  return (a, b) => {
    for (const { key, reverse } of keys) {
      if (key === "file order") {
        const diff = a.path.localeCompare(b.path) || a.line - b.line;
        if (diff) return reverse ? -diff : diff;
        continue;
      }
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      if (va === vb) continue;
      if (va === null) return 1;
      if (vb === null) return -1;
      const diff = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      if (diff) return reverse ? -diff : diff;
    }
    return a.path.localeCompare(b.path) || a.line - b.line;
  };
}

/* ---------- lanes ---------- */

interface LaneKey {
  id: string;
  value: string | null;
  label: string;
  rank: number;
}

function laneKeys(task: Task, groupBy: string): LaneKey[] {
  if (groupBy === "priority") {
    const p = priorityByLevel(task.info.priority);
    return [{ id: p.name, value: p.name, label: p.name, rank: -p.level }];
  }
  if (groupBy === "note") return [{ id: task.path, value: task.path, label: task.path, rank: 0 }];
  if (groupBy === "heading") {
    return task.heading ? [{ id: fold(task.heading), value: task.heading, label: task.heading, rank: 0 }] : [];
  }
  return fieldValues(task, groupBy).map((v) => ({ id: fold(valueText(v)), value: v, label: valueText(v), rank: 0 }));
}

function layoutLanes(columns: BoardModel["columns"], groupBy: string): Lane[] {
  const lanes = new Map<string, LaneKey & { cells: Task[][]; tasks: Set<string> }>();
  const none: LaneKey = { id: "\u0000none", value: null, label: "", rank: Number.MAX_SAFE_INTEGER };
  columns.forEach((column, c) => {
    for (const task of column.cards) {
      const keys = laneKeys(task, groupBy);
      for (const key of keys.length ? keys : [none]) {
        let lane = lanes.get(key.id);
        if (!lane) {
          lane = { ...key, cells: columns.map(() => []), tasks: new Set() };
          lanes.set(key.id, lane);
        }
        lane.cells[c].push(task);
        lane.tasks.add(task.id);
      }
    }
  });
  return [...lanes.values()]
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .map(({ value, label, cells, tasks }) => ({ value, label, cells, count: tasks.size }));
}

/* ---------- the board ---------- */

/** The toolbar's test, its texts folded once for every card. */
function toolbarTest(toolbar: Toolbar): (task: Task) => boolean {
  const search = fold(toolbar.search.trim());
  const person = fold(toolbar.person);
  return (task) => {
    if (search && !fold(`${task.info.description} ${task.path}`).includes(search)) return false;
    if (person && !fieldValues(task, OWNER).some((v) => fold(valueText(v)) === person)) return false;
    return true;
  };
}

export function layoutBoard(tasks: readonly Task[], query: Query, toolbar: Toolbar, today: Day): BoardModel {
  const scope = tasks.filter((task) => query.filters.every((f) => f.test(task, today)));
  const hidden: Hidden[] = [];
  const columns = query.columns.map((def) => ({ def, cards: [] as Task[] }));
  const passesToolbar = toolbarTest(toolbar);

  for (const task of scope) {
    if (!passesToolbar(task)) hidden.push({ task, reason: { kind: "toolbar" } });
    else if (!task.status) hidden.push({ task, reason: { kind: "unknown", symbol: task.info.symbol } });
    else {
      const column = columns.find((c) => c.def.status === task.status);
      if (column) column.cards.push(task);
      else hidden.push({ task, reason: { kind: "noColumn", status: task.status } });
    }
  }
  for (const column of columns) {
    column.cards.sort(compareTasks(column.def.sort ?? query.sort));
    const limit = column.def.limit;
    if (limit !== null && column.cards.length > limit) {
      for (const task of column.cards.splice(limit)) hidden.push({ task, reason: { kind: "limit", limit } });
    }
  }

  const people = new Map<string, string>();
  for (const v of scope.flatMap((task) => fieldValues(task, OWNER)).map(valueText)) if (!people.has(fold(v))) people.set(fold(v), v);

  return {
    columns,
    lanes: toolbar.groupBy ? layoutLanes(columns, toolbar.groupBy) : null,
    lanesEditable: toolbar.groupBy !== "note" && toolbar.groupBy !== "heading",
    shown: columns.reduce((n, c) => n + c.cards.length, 0),
    hidden,
    people: [...people.values()].sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * The edit of a card dropped from lane `from` into lane `to`: the lane's value replaces
 * the one it left. A value inherited from the parent or the note is written on the line,
 * which then wins. Null when lanes of this kind cannot be changed.
 */
export function laneEdit(task: Task, groupBy: string, from: string | null, to: string | null): ((line: string) => string) | null {
  if (groupBy === "note" || groupBy === "heading") return null;
  if (groupBy === "priority") {
    const level = PRIORITIES.find((p) => p.name === to)?.level ?? NO_PRIORITY;
    return (line) => setPriority(line, level);
  }
  const same = (a: string, b: string) => fold(valueText(a)) === fold(valueText(b));
  const values = fieldValues(task, groupBy).filter((v) => from === null || !same(v, from));
  if (to !== null && !values.some((v) => same(v, to))) values.push(to);
  return (line) => setField(line, groupBy, values);
}
