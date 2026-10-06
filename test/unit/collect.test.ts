import { describe, expect, it } from "vitest";
import { collectTasks, fieldValues, propValues } from "../../src/collect";
import { noteData, tasksOf } from "./fixtures";

const NOTE = [
  "# Site",
  "## Contenu",
  "- [ ] Write the home page [owner:: [[Bob]]]",
  "    - [x] Outline",
  "    - [ ] Draft [o:: Carol]",
  "        - [ ] Nested deeper",
  "    - [-] Dropped",
  "- [?] Validate the logo",
  "- plain item",
  "    - [ ] Under a plain item",
  "- [r] Unknown checkbox",
].join("\n");

describe("collecting the tasks of a note", () => {
  const tasks = tasksOf("Projects/Site.md", NOTE, { title: "Site web", owner: ["[[Alice]]"], client: "ACME" }, ["#project/web"]);
  const byText = (text: string) => tasks.find((t) => t.info.description === text)!;

  it("makes a card of each task with no task above it", () => {
    expect(tasks.map((t) => t.info.description)).toEqual([
      "Write the home page",
      "Validate the logo",
      "Under a plain item",
      "Unknown checkbox",
    ]);
    expect(byText("Unknown checkbox").status).toBeNull();
    expect(byText("Validate the logo").status?.name).toBe("question");
  });

  it("counts sub-tasks, canceled ones aside", () => {
    expect(byText("Write the home page").subtasks).toEqual({ done: 1, total: 2 });
    expect(byText("Validate the logo").subtasks).toBeNull();
  });

  it("resolves fields from the line, then the parent task, then the note", () => {
    expect(byText("Write the home page").fields.owner).toEqual({ values: ["[[Bob]]"], source: "line" });
    expect(byText("Validate the logo").fields.owner).toEqual({ values: ["[[Alice]]"], source: "note" });
    expect(fieldValues(byText("Validate the logo"), "client")).toEqual(["ACME"]);
  });

  it("knows its note and heading", () => {
    const task = byText("Write the home page");
    expect(task.path).toBe("Projects/Site.md");
    expect(task.note.tags).toEqual(["#project/web"]);
    expect(task.heading).toBe("Contenu");
    expect(task.id).toBe("Projects/Site.md:2");
  });

  it("reads each top-level task's own fields", () => {
    const parent = tasksOf("a.md", "- [ ] top\n    - [ ] mid [owner:: Carol]\n- [ ] other [o:: Dana]");
    expect(parent[1].fields.owner).toEqual({ values: ["Dana"], source: "line" });
  });

  it("reads property values as lists", () => {
    expect(propValues("Alice, Bob")).toEqual(["Alice", "Bob"]);
    expect(propValues(["[[Alice]]", 3, null])).toEqual(["[[Alice]]", "3"]);
    expect(propValues({ nested: true })).toEqual([]);
  });

  it("reads `o` as `owner`, on the line and in the note's properties", () => {
    const [task] = tasksOf("a.md", "- [ ] short [o:: Alice] [owner:: Bob]");
    expect(fieldValues(task, "owner")).toEqual(["Alice", "Bob"]);
    const [inherited] = tasksOf("b.md", "- [ ] inherited", { o: "Carol" });
    expect(fieldValues(inherited, "owner")).toEqual(["Carol"]);
  });

  it("takes the nearest heading above, whatever order the cache lists them in", () => {
    const data = noteData("d.md", "# One\n- [ ] a\n# Two\n- [ ] b");
    data.headings.reverse();
    expect(collectTasks(data).map((t) => t.heading)).toEqual(["One", "Two"]);
  });

  it("hands a parent's fields down to its sub-tasks, which count in its progress", () => {
    const [top] = tasksOf("c.md", "- [ ] top [owner:: Dana]\n    - [x] a\n    - [ ] b", { owner: "Eve" });
    expect(top.fields.owner.values).toEqual(["Dana"]);
    expect(top.subtasks).toEqual({ done: 1, total: 2 });
  });
});
