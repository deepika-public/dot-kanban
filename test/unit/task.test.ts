import { describe, expect, it } from "vitest";
import { dayLabel, dayOf, formatDay, localDay, parseDay, resolveDay } from "../../src/dates";
import {
  checkboxOf,
  locateTask,
  normalizeTaskText,
  parseLine,
  revertRewrite,
  rewriteTask,
  setDate,
  setField,
  setPriority,
  setStatus,
  splitValues,
  toggleUntilDone,
  taskBody,
  valueText,
} from "../../src/task";

const today = dayOf(2026, 10, 1);

describe("days", () => {
  it("reads and writes calendar dates, refusing impossible ones", () => {
    expect(formatDay(parseDay("2026-02-28")!)).toBe("2026-02-28");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("tomorrow")).toBeNull();
    expect(localDay(new Date(2026, 9, 1, 0, 5))).toBe(today);
  });

  it("resolves the dates of a query", () => {
    expect(resolveDay("today", today)).toBe(today);
    expect(resolveDay("Tomorrow", today)).toBe(today + 1);
    expect(resolveDay("in 3 days", today)).toBe(today + 3);
    expect(resolveDay("2 weeks ago", today)).toBe(today - 14);
    expect(resolveDay("2026-12-25", today)).toBe(dayOf(2026, 12, 25));
    expect(resolveDay("3 days", today)).toBeNull();
  });

  it("labels days relative to today", () => {
    expect(dayLabel(today + 1, today, "en")).toBe("tomorrow");
    expect(dayLabel(today - 1, today, "fr")).toBe("hier");
    expect(dayLabel(dayOf(2026, 10, 12), today, "en")).toBe("Oct 12");
    expect(dayLabel(dayOf(2027, 1, 3), today, "en")).toBe("Jan 3, 2027");
  });
});

describe("reading a task line", () => {
  it("finds the checkbox after any list marker", () => {
    for (const line of ["- [x] a", "  * [x] a", "+ [x] a", "1. [x] a", "12) [x] a", "-[x] a"]) expect(checkboxOf(line), line).toBe("x");
    expect(checkboxOf("- not a task")).toBeNull();
    expect(taskBody("\t- [ ]  Write the plan")).toBe("Write the plan");
    expect(parseLine("- [X] Shout")?.symbol).toBe("x");
  });

  it("reads Tasks emojis: priority, dates, recurrence", () => {
    const info = parseLine("- [ ] Ship #web ⏫ 🔁 every week when done 📅 2026-10-12 ⏳ 2026-10-10 ➕ 2026-09-01 ^ship")!;
    expect(info.description).toBe("Ship #web");
    expect(info.title).toBe("Ship #web ^ship");
    expect(info.priority).toBe(5);
    expect(info.recurrence).toBe("every week when done");
    expect(info.dates).toEqual({ due: dayOf(2026, 10, 12), scheduled: dayOf(2026, 10, 10), created: dayOf(2026, 9, 1) });
    expect(info.tags).toEqual(["#web"]);
    expect(info.dataview).toBe(false);
  });

  it("reads the Dataview format of Tasks, and the user's own fields", () => {
    const info = parseLine("- [/] Draft [due:: 2026-10-12] [priority:: highest] (repeat:: every day) [o:: [[People/Alice|Ali]], Bob] [Client:: ACME]")!;
    expect(info.description).toBe("Draft");
    expect(info.title).toBe("Draft [due:: 2026-10-12] [priority:: highest] (repeat:: every day) [o:: [[People/Alice|Ali]], Bob] [Client:: ACME]");
    expect(info.priority).toBe(6);
    expect(info.recurrence).toBe("every day");
    expect(info.dates.due).toBe(dayOf(2026, 10, 12));
    expect(info.fields).toEqual({ owner: ["[[People/Alice|Ali]]", "Bob"], client: ["ACME"] });
    expect(info.dataview).toBe(true);
  });

  it("splits values without breaking links, and reads links as their text", () => {
    expect(splitValues("Alice, [[Bob, the builder]] ,")).toEqual(["Alice", "[[Bob, the builder]]"]);
    expect(valueText("[[People/Alice]]")).toBe("Alice");
    expect(valueText("[[Alice|Ali]]")).toBe("Ali");
    expect(valueText("Bob")).toBe("Bob");
  });

  it("takes the highest of several priority emojis, none when absent", () => {
    expect(parseLine("- [ ] a 🔽 🔺")?.priority).toBe(6);
    expect(parseLine("- [ ] a")?.priority).toBe(3);
  });
});

describe("writing a task line", () => {
  it("writes the checkbox, and dates the entry into done or canceled", () => {
    expect(setStatus("- [ ] Write", "/", today)).toBe("- [/] Write");
    expect(setStatus("- [/] Write ^id", "x", today)).toBe("- [x] Write ✅ 2026-10-01 ^id");
    expect(setStatus("- [x] Write ✅ 2026-09-01", "x", today)).toBe("- [x] Write ✅ 2026-09-01");
    expect(setStatus("- [x] Write ✅ 2026-09-01 📅 2026-10-12", "?", today)).toBe("- [?] Write 📅 2026-10-12");
    expect(setStatus("- [x] Write ✅ 2026-09-01", "-", today)).toBe("- [-] Write ❌ 2026-10-01");
    expect(setStatus("  1. [ ] Write [due:: 2026-10-12]", "x", today)).toBe("  1. [x] Write [due:: 2026-10-12] [completion:: 2026-10-01]");
  });

  it("writes priorities in the line's format", () => {
    expect(setPriority("- [ ] a 🔼 📅 2026-10-12", 6)).toBe("- [ ] a 📅 2026-10-12 🔺");
    expect(setPriority("- [ ] a 🔼", 3)).toBe("- [ ] a");
    expect(setPriority("- [ ] a [due:: 2026-10-12]", 1)).toBe("- [ ] a [due:: 2026-10-12] [priority:: lowest]");
  });

  it("writes dates and fields", () => {
    expect(setDate("- [ ] a 📅 2026-10-12", "due", today + 1)).toBe("- [ ] a 📅 2026-10-02");
    expect(setDate("- [ ] a 📅 2026-10-12", "due", null)).toBe("- [ ] a");
    expect(setField("- [ ] a [owner:: Alice] 🔼", "owner", ["Bob", "[[Carol]]"])).toBe("- [ ] a 🔼 [owner:: Bob, [[Carol]]]");
    expect(setField("- [ ] a [o:: [[Alice]]] b", "owner", [])).toBe("- [ ] a b");
  });
});

describe("finding a task again", () => {
  const lines = ["# Title", "- [ ] Write the plan", "- [ ] Other", "", "- [/] Write the plan ⏫ [owner:: Bob] ✅ 2026-10-01"];

  it("ignores what the board writes", () => {
    expect(normalizeTaskText("* [x] Write   the plan 🔺 [o:: A] ✅ 2026-10-01")).toBe("Write the plan");
  });

  it("prefers the expected line, then the nearest same text, never a guess", () => {
    expect(locateTask(lines, { line: 1, text: "- [ ] Write the plan" })).toBe(1);
    expect(locateTask(lines, { line: 4, text: "- [ ] Write the plan" })).toBe(4);
    expect(locateTask(lines, { line: 3, text: "- [ ] Write the plan" })).toBe(4);
    expect(locateTask(lines, { line: 2, text: "- [ ] Write the plans" })).toBeNull();
  });

  it("rewrites one line, keeping CRLF, and undoes it while unchanged", () => {
    const content = "- [ ] a\r\n- [ ] b\r\n";
    const done = rewriteTask(content, { line: 1, text: "- [ ] b" }, (l) => [setStatus(l, "x", today)])!;
    expect(done.content).toBe("- [ ] a\r\n- [x] b ✅ 2026-10-01\r\n");
    expect(revertRewrite(done.content, done)).toBe(content);
    expect(revertRewrite("- [ ] a\r\n- [x] b edited\r\n", done)).toBeNull();
  });

  it("replaces a task by several lines, as Tasks does for a recurrence", () => {
    const content = "- [ ] water 🔁 every day 📅 2026-10-01\n";
    const done = rewriteTask(content, { line: 0, text: content.trim() }, () => [
      "- [ ] water 🔁 every day 📅 2026-10-02",
      "- [x] water 🔁 every day 📅 2026-10-01 ✅ 2026-10-01",
    ])!;
    expect(done.content.split("\n")).toHaveLength(3);
    expect(revertRewrite(done.content, done)).toBe(content);
  });
});

describe("completing with Tasks", () => {
  // Tasks with a cycle ` ` → `/` → `x`, writing the next occurrence on reaching `x`.
  const next: Record<string, string> = { " ": "/", "/": "x", x: " " };
  const toggle = (line: string) => {
    const box = line.match(/\[(.)\]/)![1];
    const out = line.replace(`[${box}]`, `[${next[box]}]`);
    return next[box] === "x" ? `${line.replace(`[${box}]`, "[ ]")} (next)\n${out}` : out;
  };

  it("follows Tasks' cycle up to done, then keeps both lines", () => {
    expect(toggleUntilDone("- [ ] water 🔁 every day", toggle)).toEqual(["- [ ] water 🔁 every day (next)", "- [x] water 🔁 every day"]);
  });

  it("gives up when done is never reached", () => {
    expect(toggleUntilDone("- [ ] a", (l) => l)).toBeNull();
    expect(toggleUntilDone("- [?] a", (l) => l.replace("[?]", "[!]").replace("[!]", "[?]"))).toBeNull();
  });
});
