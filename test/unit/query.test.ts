import { beforeEach, describe, expect, it } from "vitest";
import { dayOf } from "../../src/dates";
import { setLanguage } from "../../src/i18n";
import { inScope, parseFilter, parseQuery, shownPath } from "../../src/query";
import { tasksOf } from "./fixtures";

const today = dayOf(2026, 10, 1);
beforeEach(() => setLanguage("en"));

describe("the block", () => {
  it("defaults to the cycle's four columns, the default sort and card", () => {
    const q = parseQuery("");
    expect(q.columns.map((c) => [c.status.symbol, c.label])).toEqual([[" ", "to-do"], ["<", "scheduling"], ["/", "incomplete"], ["x", "done"]]);
    expect(q.sort.map((s) => s.key)).toEqual(["priority", "due", "file order"]);
    expect([...q.show]).toEqual(["priority", "due", "subtasks", "owner", "path"]);
    expect(q.errors).toEqual([]);
  });

  it("reads columns by checkbox or name, with label, sort and limit", () => {
    const q = parseQuery(["column [ ]", "column question À clarifier", "column [x] Fait | sort by done reverse | limit 20"].join("\n"));
    expect(q.columns.map((c) => [c.status.symbol, c.label, c.limit])).toEqual([[" ", "to-do", null], ["?", "À clarifier", null], ["x", "Fait", 20]]);
    expect(q.columns[2].sort).toEqual([{ key: "done", reverse: true }]);
  });

  it("reads sort, group, show, hide, width; ignores comments", () => {
    const q = parseQuery("# a comment\nsort by due reverse, client\ngroup by o\nshow client, recurrence\nhide note\nwidth 300px");
    expect(q.sort).toEqual([{ key: "due", reverse: true }, { key: "client", reverse: false }]);
    expect(q.groupBy).toBe("owner");
    expect(q.show.has("client") && q.show.has("recurrence") && !q.show.has("note")).toBe(true);
    expect(q.width).toBe("300px");
  });

  it("reports what it does not understand, with the line and a suggestion, and keeps the rest", () => {
    const q = parseQuery("colum [x]\ncolumn [r]\ncolumn [x]\ncolumn [x]\nwidth wide\ndue before someday\npriority is urgent\ncolumn [/] | limit 0");
    expect(q.errors.map((e) => e.line)).toEqual([1, 2, 4, 5, 6, 7, 8]);
    expect(q.errors[0].message).toContain("did you mean “column”?");
    expect(q.columns.map((c) => c.status.symbol)).toEqual(["x"]);
  });
});

describe("filters", () => {
  const tasks = tasksOf(
    "Projects/Site.md",
    [
      "## Design",
      "- [ ] Logo #design 📅 2026-09-30 ⏫ [owner:: [[Alice]]]",
      "- [ ] Fonts 📅 2026-10-05 🔁 every week",
      "- [ ] Budget [client:: ACME]",
    ].join("\n"),
    { team: "Web" },
    ["#project/web"],
  );
  const match = (line: string) => tasks.filter((t) => parseFilter(line).test(t, today)).map((t) => t.info.description);

  it("filters on the note, heading and text, like Tasks", () => {
    expect(match("path includes projects/")).toHaveLength(3);
    expect(match("path does not include Projects")).toEqual([]);
    expect(match("heading includes desi")).toHaveLength(3);
    expect(match("description includes LOGO")).toEqual(["Logo #design"]);
    expect(match("tags include #design")).toEqual(["Logo #design"]);
    expect(match("note.tags includes project/")).toHaveLength(3);
    expect(match("note.team is web")).toHaveLength(3);
  });

  it("filters on dates, priority and recurrence", () => {
    expect(match("due before today")).toEqual(["Logo #design"]);
    expect(match("due on or after tomorrow")).toEqual(["Fonts"]);
    expect(match("no due date")).toEqual(["Budget"]);
    expect(match("priority above medium")).toEqual(["Logo #design"]);
    expect(match("is recurring")).toEqual(["Fonts"]);
  });

  it("filters on fields, inherited or not; combines with not and OR", () => {
    expect(match("o is alice")).toEqual(["Logo #design"]);
    expect(match("client includes acm")).toEqual(["Budget"]);
    expect(match("not owner is Alice")).toEqual(["Fonts", "Budget"]);
    expect(match("owner is Alice OR client is ACME")).toEqual(["Logo #design", "Budget"]);
  });
});

describe("notes to read", () => {
  const reads = (block: string, path: string) => inScope(parseQuery(block), path);

  it("skips the notes the path filters reject, before reading them", () => {
    const block = "column [ ]\npath includes Projets/";
    expect(reads(block, "Projets/Site.md")).toBe(true);
    expect(reads(block, "projets/site.md")).toBe(true);
    expect(reads(block, "Journal/2026-10-06.md")).toBe(false);
    expect(reads("not path includes Archives", "Archives/Old.md")).toBe(false);
    expect(reads("filename is Site.md", "Projets/Site.md")).toBe(true);
    expect(reads("path includes A/ OR path includes B/", "B/x.md")).toBe(true);
    expect(reads("path includes A/ OR path includes B/", "C/x.md")).toBe(false);
  });

  it("reads every note when a filter looks at more than the path", () => {
    expect(parseFilter("path includes A/ OR owner is Alice").path).toBeNull();
    expect(parseFilter("heading includes Design").path).toBeNull();
    expect(reads("path includes A/ OR owner is Alice", "C/x.md")).toBe(true);
    expect(reads("column [ ]", "anything.md")).toBe(true);
  });

  it("agrees with the filter on tasks", () => {
    const tasks = [...tasksOf("Projets/Site.md", "- [ ] a"), ...tasksOf("Perso/Courses.md", "- [ ] b")];
    for (const line of ["path includes projets", "not filename is courses.md", "path is Perso/Courses.md OR path includes Site"]) {
      const filter = parseFilter(line);
      for (const task of tasks) expect(filter.path!(task.path)).toBe(filter.test(task, today));
    }
  });
});

describe("path root", () => {
  const note = "🧿 Deepika/0. ☕ Work/samm-workspace/1. 🪚 Chantiers/Planning référent/Planning référent.md";

  it("is read apart from the path filters, the last line winning", () => {
    const q = parseQuery("path root samm-workspace\npath includes Chantiers");
    expect(q.pathRoot).toBe("samm-workspace");
    expect(q.filters.map((f) => f.text)).toEqual(["path includes Chantiers"]);
    expect(q.errors).toEqual([]);
    expect(parseQuery("PATH ROOT /clients/samm-workspace/\npath root  Other").pathRoot).toBe("Other");
    expect(parseQuery("path includes x").pathRoot).toBeNull();
  });

  it("reports a root without folder, with its line, in both languages", () => {
    const q = parseQuery("column [ ]\npath root\npath root /");
    expect(q.errors.map((e) => e.line)).toEqual([2, 3]);
    expect(q.errors[0].message).toBe("No folder after “path root”: name one, such as path root Projects");
    expect(q.pathRoot).toBeNull();
    setLanguage("fr");
    expect(parseQuery("path root  ").errors[0].message).toBe("Aucun dossier après « path root » : en nommer un, comme path root Projets");
  });

  it("shows what follows the root folder, at the start or within the path", () => {
    expect(shownPath(note, "samm-workspace")).toBe("1. 🪚 Chantiers/Planning référent/Planning référent.md");
    expect(shownPath("samm-workspace/Notes/a.md", "samm-workspace")).toBe("Notes/a.md");
    expect(shownPath(note, parseQuery("path root 0. ☕ Work/samm-workspace/").pathRoot)).toBe("1. 🪚 Chantiers/Planning référent/Planning référent.md");
    expect(shownPath("a/samm/b/samm/c.md", "samm")).toBe("c.md");
    expect(shownPath(note, null)).toBe(note);
  });

  it("keeps the vault path of a note out of the root, or only partly named", () => {
    expect(shownPath("Perso/Courses.md", "samm-workspace")).toBe("Perso/Courses.md");
    expect(shownPath("old-samm-workspace/a.md", "samm-workspace")).toBe("old-samm-workspace/a.md");
    expect(shownPath("SAMM-workspace/a.md", "samm-workspace")).toBe("SAMM-workspace/a.md");
    expect(shownPath("Work/a.md", "clients/Work")).toBe("Work/a.md");
    expect(shownPath("a/samm-workspace", "samm-workspace")).toBe("a/samm-workspace");
  });

  it("matches accents written in NFC or NFD alike", () => {
    const nfd = "Clients/Référent/Été.md".normalize("NFD");
    expect(shownPath(nfd, parseQuery("path root Clients/Référent".normalize("NFC")).pathRoot)).toBe("Été.md".normalize("NFD"));
    expect(shownPath("Clients/Référent/Été.md".normalize("NFC"), parseQuery("path root Référent".normalize("NFD")).pathRoot)).toBe("Été.md");
  });

  it("leaves the path filters on the path in the vault", () => {
    const q = parseQuery("path root samm-workspace\npath includes samm-workspace/1.");
    expect(inScope(q, note)).toBe(true);
    expect(inScope(q, "Perso/1. a.md")).toBe(false);
  });
});
