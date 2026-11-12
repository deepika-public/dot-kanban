// The plugin's global settings: whether it draws its checkboxes in the notes, and the note
// where the boards' « Add » button writes new tasks.
import { AbstractInputSuggest, normalizePath, PluginSettingTab, Setting, type App, type Plugin, type TFile } from "obsidian";
import { t } from "./i18n";

export interface Settings {
  /** Draw the nine statuses' checkboxes in notes, as on the cards. Off when a theme does it. */
  noteCheckboxes: boolean;
  /** Path in the vault of the note new tasks are added at the end of; "" until chosen. */
  newTaskFile: string;
}

export const DEFAULT_SETTINGS: Settings = { noteCheckboxes: true, newTaskFile: "" };

/** The body class that turns the checkbox styles of `styles.css` on. */
export const CHECKBOXES_CLASS = "dot-kanban-checkboxes";

/** The note new tasks go to, `.md` added if missing; null when none is set. */
export function newTaskPath(setting: string): string | null {
  const path = setting.trim().replace(/^\/+/, "");
  if (!path) return null;
  return normalizePath(/\.md$/i.test(path) ? path : `${path}.md`);
}

/** The vault's notes, suggested as the setting is typed. */
class NoteSuggest extends AbstractInputSuggest<TFile> {
  constructor(
    app: App,
    input: HTMLInputElement,
    private readonly pick: (path: string) => void,
  ) {
    super(app, input);
  }

  protected getSuggestions(query: string): TFile[] {
    const q = query.toLowerCase();
    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.toLowerCase().includes(q))
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, 50);
  }

  renderSuggestion(file: TFile, el: HTMLElement) {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile) {
    this.setValue(file.path);
    this.pick(file.path);
    this.close();
  }
}

export class TikSettingTab extends PluginSettingTab {
  constructor(app: App, plugin: Plugin, private readonly settings: Settings, private readonly save: () => Promise<void>) {
    super(app, plugin);
  }

  display() {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName(t("settingCheckboxes"))
      .setDesc(t("settingCheckboxesDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.settings.noteCheckboxes).onChange(async (value) => {
          this.settings.noteCheckboxes = value;
          await this.save();
        }),
      );
    new Setting(this.containerEl)
      .setName(t("settingNewTaskFile"))
      .setDesc(t("settingNewTaskFileDesc"))
      .addText((text) => {
        const set = async (value: string) => {
          this.settings.newTaskFile = value.trim();
          await this.save();
        };
        text.setPlaceholder("Inbox.md").setValue(this.settings.newTaskFile).onChange(set);
        new NoteSuggest(this.app, text.inputEl, (path) => void set(path));
      });
  }
}
