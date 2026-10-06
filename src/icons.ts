// Status icons, drawn like the checkboxes of the Minimal theme: one per dot-kanban status. The
// colors come from the theme through CSS (`.dot-kanban-status[data-status]`).
import type { Status } from "./statuses";

const NS = "http://www.w3.org/2000/svg";

type Shape = [tag: string, attrs: Record<string, string>];

const ring: Shape = ["circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", "stroke-width": "1.5" }];
const disc: Shape = ["circle", { cx: "8", cy: "8", r: "7", fill: "currentColor" }];
const mark = (d: string): Shape => ["path", { d, class: "dot-kanban-status-mark", fill: "none", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round" }];
const line = (d: string): Shape => ["path", { d, fill: "none", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" }];

const SHAPES: Record<string, Shape[]> = {
  " ": [ring],
  "/": [ring, ["path", { d: "M8 1.75A6.25 6.25 0 0 1 8 14.25Z", fill: "currentColor" }]],
  x: [disc, mark("M5.2 8.2l1.9 1.9 3.7-3.9")],
  "-": [ring, line("M5.25 8h5.5")],
  ">": [ring, line("M5.5 8h4.5M8.25 5.75 10.5 8l-2.25 2.25")],
  "<": [line("M3 4.5h10v8.5H3zM3 7h10M5.75 3v2.5M10.25 3v2.5")],
  "?": [disc, mark("M6.2 6.3a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4M8 11.6v.1")],
  "!": [["path", { d: "M8 1.5 15 14H1z", fill: "currentColor", "stroke-linejoin": "round" }], mark("M8 6v3.5M8 11.7v.1")],
  "*": [["path", { d: "M8 1.3l2 4.2 4.6.6-3.4 3.2.9 4.6L8 11.6l-4.1 2.3.9-4.6L1.4 6.1 6 5.5z", fill: "currentColor" }]],
};

/** The icon of a status, or of an unknown checkbox (a dashed ring). */
export function statusIcon(parent: HTMLElement, status: Status | null): HTMLElement {
  const span = parent.createSpan({ cls: "dot-kanban-status", attr: { "data-status": status?.name ?? "unknown", "aria-hidden": "true" } });
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  const shapes = status ? SHAPES[status.symbol] : [["circle", { ...ring[1], "stroke-dasharray": "2 2" }] as Shape];
  for (const [tag, attrs] of shapes) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.appendChild(el);
  }
  span.appendChild(svg);
  return span;
}
