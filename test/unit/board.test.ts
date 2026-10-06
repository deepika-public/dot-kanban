import { beforeEach, describe, expect, it } from "vitest";
import { laneEdit, layoutBoard, type Toolbar } from "../../src/board";
import { dayOf } from "../../src/dates";
import { setLanguage } from "../../src/i18n";
import { parseQuery } from "../../src/query";
import { tasksOf } from "./fixtures";

const today = dayOf(2026, 10, 1);
const none: Toolbar = { search: "", person: "", groupBy: null };
beforeEach(() => setLanguage("en"));

const tasks = [
  ...tasksOf(
    "Projects/Site.md",
    [
      "- [ ] Low 🔽",
      "- [ ] Due late 📅 2026-10-20",
      "- [ ] Due soon 📅 2026-10-02",
      "- [ ] High ⏫ [owner:: Bob]",
      "- [/] Doing [owner:: Alice, Bob]",
      "- [x] Done old ✅ 2026-09-01",
      "- [x] Done new ✅ 2026-09-20",
      "- [-] Canceled",
      "- [r] Mystery",
    ].join("\n"),
    { owner: "Alice", title: "Site web" },
  ),
  ...tasksOf("Café.md", "- [ ] Beans [owner:: Clément]"),
];
const titles = (cards: { info: { description: string } }[]) => cards.map((c) => c.info.description);

describe("columns", () => {
  it("sorts by priority, then due date, then file order", () => {
    const board = layoutBoard(tasks, parseQuery(""), none, today);
    expect(titles(board.columns[0].cards)).toEqual(["High", "Due soon", "Due late", "Beans", "Low"]);
  });

  it("sorts and limits each column on its own", () => {
    const board = layoutBoard(tasks, parseQuery("column [x] | sort by done reverse | limit 1"), none, today);
    expect(titles(board.columns[0].cards)).toEqual(["Done new"]);
  });

  it("lists what it does not show, and why", () => {
    const board = layoutBoard(tasks, parseQuery("column [x] | limit 1"), none, today);
    const reasons = Object.fromEntries(board.hidden.map((h) => [h.task.info.description, h.reason.kind]));
    expect(reasons).toMatchObject({ "Due late": "noColumn", Canceled: "noColumn", Mystery: "unknown", "Done new": "limit" });
    expect(board.shown).toBe(1);
    const searched = layoutBoard(tasks, parseQuery(""), { ...none, search: "beans" }, today);
    expect(searched.hidden.find((h) => h.task.info.description === "Low")?.reason.kind).toBe("toolbar");
  });

  it("leaves the block's own filters out of the hidden list", () => {
    const board = layoutBoard(tasks, parseQuery("path includes Projects/"), none, today);
    expect(board.hidden.some((h) => h.task.path === "Café.md")).toBe(false);
  });
});

describe("toolbar", () => {
  it("filters by person and search, without case nor accents, the search reading the path too", () => {
    const q = parseQuery("");
    expect(titles(layoutBoard(tasks, q, { ...none, person: "clement" }, today).columns[0].cards)).toEqual(["Beans"]);
    expect(titles(layoutBoard(tasks, q, { ...none, search: "CAFE" }, today).columns[0].cards)).toEqual(["Beans"]);
    expect(layoutBoard(tasks, q, { ...none, search: "projects/site" }, today).shown).toBe(7);
    expect(layoutBoard(tasks, q, none, today).people).toEqual(["Alice", "Bob", "Clément"]);
  });
});

describe("lanes", () => {
  it("groups by a field, a card under each of its values, no value last", () => {
    const board = layoutBoard(tasks, parseQuery("column [ ]\ncolumn [/]"), { ...none, groupBy: "owner" }, today);
    expect(board.lanes!.map((l) => [l.label, l.count])).toEqual([["Alice", 4], ["Bob", 2], ["Clément", 1]]);
    expect(titles(board.lanes![1].cells[1])).toEqual(["Doing"]);
  });

  it("groups by priority, highest first", () => {
    const board = layoutBoard(tasks, parseQuery("column [ ]"), { ...none, groupBy: "priority" }, today);
    expect(board.lanes!.map((l) => l.value)).toEqual(["high", "none", "low"]);
  });

  it("writes the lane's value in place of the one the card left", () => {
    const doing = tasks.find((t) => t.info.description === "Doing")!;
    expect(laneEdit(doing, "owner", "Alice", "[[Carol]]")!("- [/] Doing [o:: Alice, Bob]")).toBe("- [/] Doing [owner:: Bob, [[Carol]]]");
    const inherited = tasks.find((t) => t.info.description === "Low")!;
    expect(laneEdit(inherited, "owner", "Alice", "Bob")!("- [ ] Low 🔽")).toBe("- [ ] Low 🔽 [owner:: Bob]");
    expect(laneEdit(inherited, "priority", "low", "high")!("- [ ] Low 🔽")).toBe("- [ ] Low ⏫");
    expect(laneEdit(inherited, "note", "a", "b")).toBeNull();
  });
});
