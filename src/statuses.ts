// The nine statuses dot-kanban knows: a task's status is its checkbox character. Pure.

export type StatusType = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export interface Status {
  /** Checkbox character, `x` for done. */
  symbol: string;
  name: string;
  type: StatusType;
}

export const STATUSES: readonly Status[] = [
  { symbol: " ", name: "to-do", type: "TODO" },
  { symbol: "/", name: "incomplete", type: "IN_PROGRESS" },
  { symbol: "x", name: "done", type: "DONE" },
  { symbol: "-", name: "canceled", type: "CANCELLED" },
  { symbol: ">", name: "forwarded", type: "TODO" },
  { symbol: "<", name: "scheduling", type: "TODO" },
  { symbol: "?", name: "question", type: "TODO" },
  { symbol: "!", name: "important", type: "TODO" },
  { symbol: "*", name: "star", type: "TODO" },
];

/** The board without `column`, and the cycle suggested for Tasks: to-do, scheduling, incomplete, done. */
export const DEFAULT_COLUMNS = [" ", "<", "/", "x"];

/** `X` is read as `x`, as Obsidian does. */
export const canonicalSymbol = (symbol: string) => (symbol === "X" ? "x" : symbol);

export function statusOf(symbol: string): Status | null {
  const canonical = canonicalSymbol(symbol);
  return STATUSES.find((s) => s.symbol === canonical) ?? null;
}

/** A status by its checkbox (`[?]`, `?`) or its name (`question`). */
export function findStatus(ref: string): Status | null {
  const box = ref.match(/^\[(.)\]$/);
  if (box) return statusOf(box[1]);
  if ([...ref].length === 1) return statusOf(ref);
  const name = ref.toLowerCase();
  return STATUSES.find((s) => s.name === name) ?? null;
}

