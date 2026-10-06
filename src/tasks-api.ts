// The Tasks plugin's API, when Tasks is installed and enabled. Optional everywhere.
import type { App } from "obsidian";

export interface TasksApi {
  /** Tasks 7.2+: the line toggled as the user configured it; two lines for a recurrence. */
  executeToggleTaskDoneCommand?: (line: string, path: string) => string;
  /** Tasks 7.21+: the edit dialog, pre-filled; "" when cancelled. */
  editTaskLineModal?: (line: string) => Promise<string>;
}

export function tasksApi(app: App): TasksApi | null {
  const plugins = (app as App & { plugins?: { plugins?: Record<string, { apiV1?: TasksApi } | undefined> } }).plugins;
  return plugins?.plugins?.["obsidian-tasks-plugin"]?.apiV1 ?? null;
}
