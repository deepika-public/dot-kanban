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
    expect(q.columns.map((c) => [c.status!.symbol, c.label])).toEqual([[" ", "to-do"], ["<", "scheduling"], ["/", "incomplete"], ["x", "done"]]);
    expect(q.sort.map((s) => s.key)).toEqual(["priority", "due", "file order"]);
    expect([...q.show]).toEqual(["priority", "due", "subtasks", "owner", "path"]);
    expect(q.errors).toEqual([]);
  });

  it("reads columns by checkbox or name, with label, sort and limit", () => {
    const q = parseQuery(["column [ ]", "column question À clarifier", "column [x] Fait | sort by done reverse | limit 20"].join("\n"));
    expect(q.columns.map((c) => [c.status!.symbol, c.label, c.limit])).toEqual([[" ", "to-do", null], ["?", "À clarifier", null], ["x", "Fait", 20]]);
    expect(q.columns[2].sort).toEqual([{ key: "done", reverse: true }]);
  });

  it("reads sort, group, show, hide, width; ignores comments", () => {
    const q = parseQuery("# a comment\nsort by due reverse, client\ngroup by o\nshow client, recurrence\nhide note\nwidth 300px");
    expect(q.sort).toEqual([{ key: "due", reverse: true }, { key: "client", reverse: false }]);
    expect(q.groupBy).toBe("owner");
    expect(q.show.has("client") && q.show.has("recurrence") && !q.show.has("note")).toBe(true);
    expect(q.width).toBe("300px");
  });

  it("reads the order of the lanes after group by", () => {
    expect(parseQuery("group by statut").groupOrder).toEqual({ kind: "natural", values: [] });
    expect(parseQuery("group by statut | order reverse").groupOrder).toEqual({ kind: "reverse", values: [] });
    expect(parseQuery('group by statut | order "2 · ▶️ À faire", "a, b", c').groupOrder).toEqual({ kind: "custom", values: ["2 · ▶️ À faire", "a, b", "c"] });
    const bad = parseQuery("group by statut | order\ngroup by statut | sort x");
    expect(bad.errors.map((e) => e.line)).toEqual([1, 2]);
  });

  it("reports what it does not understand, with the line and a suggestion, and keeps the rest", () => {
    const q = parseQuery("colum [x]\ncolumn [r]\ncolumn [x]\ncolumn [x]\nwidth wide\ndue before someday\npriority is urgent\ncolumn [/] | limit 0");
    expect(q.errors.map((e) => e.line)).toEqual([1, 2, 4, 5, 6, 7, 8]);
    expect(q.errors[0].message).toContain("did you mean “column”?");
    expect(q.columns.map((c) => c.status!.symbol)).toEqual(["x"]);
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
    expect(match('description is "log*"')).toEqual(["Logo #design"]);
    expect(match('client is "AC*"')).toEqual(["Budget"]);
    expect(match('note.team is "W*"')).toHaveLength(3);
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

  it("reads quoted values and wildcards", () => {
    const scope = 'path includes "1. Projets/*/P*/P*" OR path includes "Tableaux/Cases vides/"';
    expect(reads(scope, "Coffre/1. Projets/Web/Portail/Portail.md")).toBe(true);
    expect(reads(scope, "Coffre/1. Projets/Web/Portail/Notes.md")).toBe(false);
    expect(reads(scope, "Coffre/3. Archives/Projets/Portail/Portail.md")).toBe(false);
    expect(reads(scope, "Coffre/Tableaux/Cases vides/Haute.md")).toBe(true);
    expect(reads('path includes "Projets/**/Site"', "Projets/A/B/Site.md")).toBe(true);
    expect(reads('path includes "Projets/*/Site"', "Projets/A/B/Site.md")).toBe(false);
    expect(reads('filename is "*.md"', "Projets/Site.md")).toBe(true);
    expect(reads('filename is "S*"', "Projets/Site.md")).toBe(true);
    expect(reads('filename is "X*"', "Projets/Site.md")).toBe(false);
    expect(reads('path includes "A OR B/"', "A OR B/x.md")).toBe(true);
    expect(reads('path includes "A OR B/"', "B/x.md")).toBe(false);
    expect(reads("filename is a\\*b.md", "a*b.md")).toBe(true);
    expect(reads("filename is a\\*b.md", "axb.md")).toBe(false);
    expect(reads('path includes " Old "', "Archives/ Old /x.md")).toBe(true);
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
  const note = "📁 Perso/0. Travail/mon-coffre/1. 📂 Projets/Site web/Site web.md";

  it("is read apart from the path filters, the last line winning", () => {
    const q = parseQuery("path root mon-coffre\npath includes Projets");
    expect(q.pathRoot).toBe("mon-coffre");
    expect(q.filters.map((f) => f.text)).toEqual(["path includes Projets"]);
    expect(q.errors).toEqual([]);
    expect(parseQuery("PATH ROOT /clients/mon-coffre/\npath root  Other").pathRoot).toBe("Other");
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
    expect(shownPath(note, "mon-coffre")).toBe("1. 📂 Projets/Site web/Site web.md");
    expect(shownPath("mon-coffre/Notes/a.md", "mon-coffre")).toBe("Notes/a.md");
    expect(shownPath(note, parseQuery("path root 0. Travail/mon-coffre/").pathRoot)).toBe("1. 📂 Projets/Site web/Site web.md");
    expect(shownPath("a/notes/b/notes/c.md", "notes")).toBe("c.md");
    expect(shownPath(note, null)).toBe(note);
  });

  it("keeps the vault path of a note out of the root, or only partly named", () => {
    expect(shownPath("Perso/Courses.md", "mon-coffre")).toBe("Perso/Courses.md");
    expect(shownPath("old-mon-coffre/a.md", "mon-coffre")).toBe("old-mon-coffre/a.md");
    expect(shownPath("MON-COFFRE/a.md", "mon-coffre")).toBe("MON-COFFRE/a.md");
    expect(shownPath("Work/a.md", "clients/Work")).toBe("Work/a.md");
    expect(shownPath("a/mon-coffre", "mon-coffre")).toBe("a/mon-coffre");
  });

  it("matches accents written in NFC or NFD alike", () => {
    const nfd = "Clients/Équipe/Été.md".normalize("NFD");
    expect(shownPath(nfd, parseQuery("path root Clients/Équipe".normalize("NFC")).pathRoot)).toBe("Été.md".normalize("NFD"));
    expect(shownPath("Clients/Équipe/Été.md".normalize("NFC"), parseQuery("path root Équipe".normalize("NFD")).pathRoot)).toBe("Été.md");
  });

  it("leaves the path filters on the path in the vault", () => {
    const q = parseQuery("path root mon-coffre\npath includes mon-coffre/1.");
    expect(inScope(q, note)).toBe(true);
    expect(inScope(q, "Perso/1. a.md")).toBe(false);
  });
});

describe("add to", () => {
  it("names the note of the Add button, .md added, the last line kept", () => {
    expect(parseQuery("column [ ]").addTo).toBeNull();
    expect(parseQuery("add to /Inbox/New").addTo).toBe("Inbox/New.md");
    const q = parseQuery("ADD TO 🌐 Sync/🌱.md\nadd to  Other.MD");
    expect(q.errors).toEqual([]);
    expect(q.addTo).toBe("Other.MD");
  });

  it("reports a missing note, and leaves any other line starting with add to the filters", () => {
    const q = parseQuery("add to\nadd includes x");
    expect(q.errors.map((e) => e.line)).toEqual([1]);
    expect(q.addTo).toBeNull();
    expect(q.filters.map((f) => f.text)).toEqual(["add includes x"]);
  });
});
