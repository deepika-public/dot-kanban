// A note as Obsidian's metadata cache describes it, built from its Markdown.
import { collectTasks, type NoteData, type Task } from "../../src/collect";

/**
 * List items, headings and tasks of `markdown`, the way Obsidian reports them: a list
 * item's parent is the nearest less-indented item above, else negative.
 */
export function noteData(path: string, markdown: string, frontmatter: Record<string, unknown> = {}, tags: string[] = []): NoteData {
  const lines = markdown.split("\n");
  const items: NoteData["items"] = [];
  const headings: NoteData["headings"] = [];
  const stack: { indent: number; line: number }[] = [];
  lines.forEach((text, line) => {
    const heading = text.match(/^#+\s+(.*)$/);
    if (heading) headings.push({ line, heading: heading[1] });
    const item = text.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(?:\[(.)\])?/);
    if (!item) {
      if (!text.trim()) stack.length = 0;
      return;
    }
    const indent = item[1].length;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    items.push({ line, parent: stack.length ? stack[stack.length - 1].line : -1, task: item[2] });
    stack.push({ indent, line });
  });
  return { path, frontmatter, tags, headings, items, lines };
}

export const tasksOf = (path: string, markdown: string, frontmatter: Record<string, unknown> = {}, tags: string[] = []): Task[] =>
  collectTasks(noteData(path, markdown, frontmatter, tags));
