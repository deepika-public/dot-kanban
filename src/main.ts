import { moment, Plugin, type Editor } from "obsidian";
import * as obsidian from "obsidian";
import { setLanguage, t } from "./i18n";
import { CHECKBOXES_CLASS, DEFAULT_SETTINGS, TikSettingTab, type Settings } from "./settings";
import { TaskIndex } from "./vault";
import { TikBoard } from "./view";

/** Language of the code blocks rendered as boards. */
const BLOCK = "dot-kanban";

const TEMPLATE = [
  "```dot-kanban",
  "column [ ]",
  "column [<]",
  "column [/]",
  "column [x] | sort by done reverse | limit 20",
  "# path includes Projects/",
  "# to includes Alice",
  "# group by to",
  "```",
  "",
].join("\n");

export default class DotKanban extends Plugin {
  private options: Settings = { ...DEFAULT_SETTINGS };

  async onload() {
    const getLanguage = (obsidian as { getLanguage?: () => string }).getLanguage;
    setLanguage(getLanguage?.() ?? moment.locale());
    this.options = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<Settings> | null) };
    this.applyOptions();
    this.register(() => document.body.removeClass(CHECKBOXES_CLASS));
    this.addSettingTab(new TikSettingTab(this.app, this, this.options, () => this.saveOptions()));
    // Shared by the boards: a board re-created by Obsidian finds the notes already read.
    const index = new TaskIndex(this.app);
    index.watch(this);
    this.registerMarkdownCodeBlockProcessor(BLOCK, (source, el, ctx) => {
      ctx.addChild(new TikBoard(el, this.app, index, source, ctx));
    });
    this.addCommand({
      id: "insert-board",
      name: t("insertBoard"),
      editorCallback: (editor: Editor) => editor.replaceSelection(TEMPLATE),
    });
  }

  private applyOptions() {
    document.body.toggleClass(CHECKBOXES_CLASS, this.options.noteCheckboxes);
  }

  private async saveOptions() {
    await this.saveData(this.options);
    this.applyOptions();
  }
}
