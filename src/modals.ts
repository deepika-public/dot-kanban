// The two windows that explain a board: its columns, and the tasks it leaves out.
import { Modal, type App } from "obsidian";
import type { Hidden, Reason } from "./board";
import type { Task } from "./collect";
import { t } from "./i18n";
import { statusIcon } from "./icons";
import type { ColumnDef } from "./query";

/** Which checkbox each column writes, and what else. */
export class LegendModal extends Modal {
  constructor(app: App, private readonly columns: readonly ColumnDef[]) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText(t("legend"));
    const table = this.contentEl.createEl("table", { cls: "dot-kanban-legend" });
    for (const column of this.columns) {
      const row = table.createEl("tr");
      statusIcon(row.createEl("td"), column.status);
      row.createEl("td", { text: column.label });
      row.createEl("td", { cls: "dot-kanban-mono", text: `[${column.status.symbol}]` });
      const writes =
        column.status.type === "DONE" ? t("legendDone") : column.status.type === "CANCELLED" ? t("legendCancelled") : t("legendNothing");
      row.createEl("td", { cls: "dot-kanban-muted", text: `${column.status.name} · ${t("legendWrites", { what: writes })}` });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

function reasonText(reason: Reason): string {
  switch (reason.kind) {
    case "noColumn": return t("reasonNoColumn", { status: `[${reason.status.symbol}] ${reason.status.name}` });
    case "unknown": return t("reasonUnknown", { symbol: reason.symbol });
    case "limit": return t("reasonLimit", { n: reason.limit });
    default: return t("reasonToolbar");
  }
}

/** The tasks read but not shown, each with its path as the board shows it and its reason; a click opens it. */
export class HiddenModal extends Modal {
  constructor(
    app: App,
    private readonly hidden: readonly Hidden[],
    private readonly pathOf: (task: Task) => string,
    private readonly openTask: (task: Task) => void,
  ) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText(t("hiddenTitle"));
    const list = this.contentEl.createEl("ul", { cls: "dot-kanban-hidden-list" });
    for (const { task, reason } of this.hidden) {
      const item = list.createEl("li");
      const button = item.createEl("button", { cls: "dot-kanban-hidden-item" });
      statusIcon(button, task.status);
      const text = button.createDiv({ cls: "dot-kanban-hidden-text" });
      text.createDiv({ text: task.info.description || task.text.trim() });
      text.createDiv({ cls: "dot-kanban-muted", text: `${this.pathOf(task)} · ${reasonText(reason)}` });
      button.onclick = () => {
        this.close();
        this.openTask(task);
      };
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
