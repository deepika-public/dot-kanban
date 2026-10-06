// The plugin's only global setting: whether it draws its checkboxes in the notes.
import { PluginSettingTab, Setting, type App, type Plugin } from "obsidian";
import { t } from "./i18n";

export interface Settings {
  /** Draw the nine statuses' checkboxes in notes, as on the cards. Off when a theme does it. */
  noteCheckboxes: boolean;
}

export const DEFAULT_SETTINGS: Settings = { noteCheckboxes: true };

/** The body class that turns the checkbox styles of `styles.css` on. */
export const CHECKBOXES_CLASS = "dot-kanban-checkboxes";

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
  }
}
