// The vault's tasks, read from Obsidian's metadata cache and each note's text. One index for
// every board: a note is read only when a board needs it, and again only once it changed.
import { getAllTags, TFile, type App, type CachedMetadata, type Plugin } from "obsidian";
import { collectTasks, type NoteData, type Task } from "./collect";

interface Entry {
  stamp: string;
  data: NoteData;
  tasks: Task[];
}

/** Notes read at once; Obsidian draws between two batches. */
const BATCH = 50;

/** The notes a board looks at, by path. */
export type Scope = (path: string) => boolean;
/** Notes that changed; `live` for an edit not saved yet or a board's own write. */
export type Listener = (paths: string[], live: boolean) => void;

const stampOf = (file: TFile) => `${file.stat.mtime}:${file.stat.size}`;
const hasTasks = (cache: CachedMetadata | null) => !!cache?.listItems?.some((item) => item.task !== undefined);
const nextTask = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));
const linesOf = (content: string) => content.split("\n").map((l) => l.replace(/\r$/, ""));
const sameLines = (a: string[], b: string[]) => a.length === b.length && a.every((l, i) => l === b[i]);
/** What the cache says of a note, as text to compare. */
const cacheKey = (d: NoteData) => JSON.stringify([d.frontmatter, d.tags, d.headings, d.items]);

export class TaskIndex {
  private notes = new Map<string, Entry>();
  /**
   * The read under way of each note: two boards opening together read it once. A change
   * of the note drops it, and a dropped read writes nothing to the index.
   */
  private reading = new Map<string, { stamp: string; cache: CachedMetadata; entry: Promise<Entry> }>();
  private listeners = new Set<Listener>();

  constructor(private readonly app: App) {}

  /** Follows the vault and the editor while `plugin` is loaded, and tells the boards. */
  watch(plugin: Plugin) {
    plugin.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        this.invalidate(file.path);
        this.emit([file.path], false);
      }),
    );
    // An edit shows on the boards before Obsidian saves the note (a second or two later).
    plugin.registerEvent(
      this.app.workspace.on("editor-change", (editor, info) => {
        if (info.file && this.edited(info.file, () => editor.getValue())) this.emit([info.file.path], true);
      }),
    );
    plugin.registerEvent(
      this.app.vault.on("delete", (file) => {
        this.notes.delete(file.path);
        this.emit([file.path], false);
      }),
    );
    plugin.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.notes.delete(oldPath);
        this.emit([oldPath, file.path], false);
      }),
    );
  }

  /** Calls `listener` on every change; returns what stops it. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(paths: string[], live: boolean) {
    for (const listener of this.listeners) listener(paths, live);
  }

  /** The note changed: read it again next time. */
  invalidate(path: string) {
    this.reading.delete(path);
    const entry = this.notes.get(path);
    if (entry) this.notes.set(path, { ...entry, stamp: "" });
  }

  /** The tasks of the notes in `scope`, reading only those that changed, in batches. */
  async tasks(scope: Scope): Promise<Task[]> {
    const files: { file: TFile; cache: CachedMetadata }[] = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!scope(file.path)) continue;
      const cache = this.app.metadataCache.getFileCache(file);
      if (hasTasks(cache)) files.push({ file, cache: cache! });
    }
    const entries = new Map<string, Entry>();
    const stale: typeof files = [];
    for (const f of files) {
      const entry = this.notes.get(f.file.path);
      if (entry && entry.stamp === stampOf(f.file)) entries.set(f.file.path, entry);
      else stale.push(f);
    }
    for (let i = 0; i < stale.length; i += BATCH) {
      if (i) await nextTask();
      await Promise.all(stale.slice(i, i + BATCH).map(async ({ file, cache }) => entries.set(file.path, await this.read(file, cache))));
    }
    for (const path of [...this.notes.keys()]) if (scope(path) && !entries.has(path)) this.notes.delete(path);
    return files.flatMap(({ file }) => entries.get(file.path)!.tasks);
  }

  private read(file: TFile, cache: CachedMetadata): Promise<Entry> {
    const stamp = stampOf(file);
    const pending = this.reading.get(file.path);
    // Same text and same cache only: the cache may be parsed again after the text changed.
    if (pending && pending.stamp === stamp && pending.cache === cache) return pending.entry;
    const reading = { stamp, cache, entry: this.readNow(file, cache, stamp) };
    this.reading.set(file.path, reading);
    const current = () => this.reading.get(file.path) === reading;
    reading.entry.then(
      (entry) => {
        if (!current()) return;
        this.reading.delete(file.path);
        this.notes.set(file.path, entry);
      },
      () => {
        if (current()) this.reading.delete(file.path);
      },
    );
    return reading.entry;
  }

  private async readNow(file: TFile, cache: CachedMetadata, stamp: string): Promise<Entry> {
    const data = this.noteData(file, cache, await this.app.vault.cachedRead(file));
    // Read again as it was (saved after an edit or a write of the board): the same tasks,
    // so the boards need not be drawn again.
    const old = this.notes.get(file.path);
    const same = old && sameLines(old.data.lines, data.lines) && cacheKey(old.data) === cacheKey(data);
    return same ? { ...old, stamp } : { stamp, data, tasks: collectTasks(data) };
  }

  /**
   * A board just wrote `content` to the note. While the line count is unchanged the
   * cache's positions still hold: the cards follow at once, before Obsidian re-reads it.
   */
  wrote(file: TFile, content: string) {
    const entry = this.notes.get(file.path);
    if (!entry) return;
    // A read under way holds the text from before.
    this.reading.delete(file.path);
    const lines = linesOf(content);
    // Lines added (a recurrence): the old cards stay until Obsidian has re-read the note.
    if (lines.length !== entry.data.lines.length) {
      this.notes.set(file.path, { ...entry, stamp: stampOf(file) });
      return;
    }
    const data = { ...entry.data, lines };
    this.notes.set(file.path, { stamp: stampOf(file), data, tasks: collectTasks(data) });
    this.emit([file.path], true);
  }

  /**
   * The note is being edited: its text, not yet saved. While the line count is unchanged
   * the cache's positions still hold, and the cards follow the editor at once; otherwise
   * they wait for Obsidian to save and re-read the note. True when the cards changed. The
   * text is asked for only for a note some board has read.
   */
  private edited(file: TFile, text: () => string): boolean {
    const entry = this.notes.get(file.path);
    if (!entry) return false;
    const lines = linesOf(text());
    if (lines.length !== entry.data.lines.length || sameLines(lines, entry.data.lines)) return false;
    const data = { ...entry.data, lines };
    this.reading.delete(file.path);
    this.notes.set(file.path, { ...entry, data, tasks: collectTasks(data) });
    return true;
  }

  private noteData(file: TFile, cache: CachedMetadata, content: string): NoteData {
    return {
      path: file.path,
      frontmatter: cache.frontmatter,
      tags: getAllTags(cache) ?? [],
      headings: (cache.headings ?? []).map((h) => ({ line: h.position.start.line, heading: h.heading })),
      items: (cache.listItems ?? []).map((i) => ({ line: i.position.start.line, parent: i.parent, task: i.task })),
      lines: linesOf(content),
    };
  }
}
