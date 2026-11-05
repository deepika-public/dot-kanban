// Card sizes, column colors and boards of notes.
import { beforeEach, describe, expect, it } from "vitest";
import { layoutBoard, laneValues, type Toolbar } from "../../src/board";
import { noteCard } from "../../src/collect";
import { dayOf } from "../../src/dates";
import { setLanguage } from "../../src/i18n";
import { parseQuery } from "../../src/query";
import { priorityByName } from "../../src/task";
import { tasksOf } from "./fixtures";

const today = dayOf(2026, 10, 1);
const none: Toolbar = { search: "", person: "", groupBy: null };
beforeEach(() => setLanguage("en"));

describe("size and color", () => {
  it("reads a board size and column options", () => {
    const q = parseQuery("size small\ncolumn [/] Now | color blue | size large\ncolumn [x] Done | colour Green");
    expect(q.errors).toEqual([]);
    expect(q.size).toBe("small");
    expect(q.columns.map((c) => [c.label, c.color, c.size])).toEqual([["Now", "blue", "large"], ["Done", "green", null]]);
  });

  it("takes short for small, and reports unknown sizes and colors", () => {
    expect(parseQuery("size short").size).toBe("small");
    const q = parseQuery("size huge\ncolumn [ ] | color teal");
    expect(q.errors.map((e) => e.line)).toEqual([1, 2]);
    expect(q.errors[1].message).toContain("red, orange");
  });
});

describe("large cards", () => {
  it("keep the sub-tasks of a task, in order", () => {
    const [top] = tasksOf("a.md", "- [/] Top\n    - [x] One **bold**\n    - [ ] Two ⏫");
    expect(top.children).toEqual([{ symbol: "x", title: "One **bold**" }, { symbol: " ", title: "Two" }]);
  });
});

describe("boards of notes", () => {
  const card = (path: string, fm: Record<string, unknown>, markdown = "") => noteCard(path, fm, [], tasksOf(path, markdown, fm));
  const notes = [
    card("P/Alpha.md", { statut: "en cours", theme: "IA", due: "2026-10-20" }, "- [x] a\n- [ ] b\n- [-] c"),
    card("P/Beta.md", { Statut: "À faire", priority: "high" }),
    card("P/Gamma.md", { statut: "abandonné" }),
    card("P/Delta.md", {}),
  ];

  it("needs columns by, and names columns by value", () => {
    expect(parseQuery("cards notes\ncolumn todo").errors[0].message).toContain("columns by");
    const q = parseQuery('column "en cours" Now | color blue\ncolumn à_faire\ncards notes\ncolumns by Statut');
    expect(q.errors).toEqual([]);
    expect(q.cards).toBe("notes");
    expect(q.columnsBy).toBe("statut");
    expect(q.columns.map((c) => [c.value, c.label, c.status, c.color])).toEqual([["en cours", "Now", null, "blue"], ["à_faire", "à_faire", null, null]]);
  });

  it("makes a card of a note: name, properties, progress, sub-tasks, dates and priority", () => {
    const [alpha, beta] = notes;
    expect(alpha.kind).toBe("note");
    expect(alpha.info.title).toBe("Alpha");
    expect(alpha.fields.theme).toEqual({ values: ["IA"], source: "line" });
    expect(alpha.subtasks).toEqual({ done: 1, total: 2 });
    expect(alpha.children.map((c) => c.symbol)).toEqual(["x", " ", "-"]);
    expect(alpha.info.dates.due).toBe(dayOf(2026, 10, 20));
    expect(beta.info.priority).toBe(priorityByName("high")!.level);
  });

  it("puts each note in the column of its value, case and accents aside, and says why others are left out", () => {
    const q = parseQuery('cards notes\ncolumns by statut\ncolumn "en cours"\ncolumn "a faire"');
    const board = layoutBoard(notes, q, none, today);
    expect(board.columns.map((c) => c.cards.map((n) => n.info.title))).toEqual([["Alpha"], ["Beta"]]);
    expect(board.hidden.map((h) => [h.task.info.title, h.reason.kind])).toEqual([["Gamma", "noValueColumn"], ["Delta", "noValue"]]);
  });

  it("filters notes on their properties and path", () => {
    const q = parseQuery('cards notes\ncolumns by statut\ncolumn "en cours"\ncolumn "à faire"\ntheme is IA');
    expect(layoutBoard(notes, q, none, today).shown).toBe(1);
  });

  it("moves a note between lanes of a property", () => {
    expect(laneValues(notes[0], "theme", "IA", "Data")).toEqual(["Data"]);
    expect(laneValues(notes[0], "theme", null, "Data")).toEqual(["IA", "Data"]);
  });
});
