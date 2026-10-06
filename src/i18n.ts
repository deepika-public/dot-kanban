// Words shown to the user, in English and French. The language follows Obsidian's. Pure.

const en = {
  // block errors
  unknownInstruction: "Unknown instruction “{text}”",
  didYouMean: "did you mean “{word}”?",
  unknownStatus: "Unknown status “{ref}”: use [ ] [/] [x] [-] [>] [<] [?] [!] [*] or their names",
  duplicateColumn: "Column {ref} is already on the board",
  badDate: "Unknown date “{text}”: use today, tomorrow, in 3 days, 2 days ago or YYYY-MM-DD",
  badPriority: "Unknown priority “{text}”: use highest, high, medium, none, low, lowest",
  badWidth: "Unknown width “{text}”: use a length such as 280px",
  badLimit: "“{text}” is not a number of cards",
  badSort: "Cannot sort by “{text}”",
  badGroup: "Cannot group by “{text}”",
  emptyList: "Nothing listed after “{text}”",
  // toolbar
  search: "Search…",
  searchLabel: "Search the cards",
  peopleAll: "owner: everyone",
  peopleOne: "owner: {name}",
  lanesNone: "Group by: none",
  lanesBy: "Group by: {key}",
  tasks: "{n} tasks",
  task: "1 task",
  hidden: "{n} hidden",
  hiddenOne: "1 hidden",
  legend: "Columns legend",
  editSource: "Edit the block",
  more: "More actions",
  empty: "No task to show.",
  emptyFilters: "No task matches {filters}.",
  showMore: "Show {n} more",
  // hidden tasks
  hiddenTitle: "Tasks read but not shown",
  reasonNoColumn: "status “{status}” has no column",
  reasonUnknown: "checkbox [{symbol}] is not a dot-kanban status",
  reasonLimit: "beyond the column limit of {n}",
  reasonToolbar: "hidden by the search or the toolbar filters",
  // legend
  legendWrites: "writes {what}",
  legendDone: "today's ✅ date",
  legendCancelled: "today's ❌ date",
  legendNothing: "the checkbox only",
  // cards
  inherited: "{key}: inherited from {source}",
  fromParent: "the parent task",
  fromNote: "the note’s properties ({note})",
  subtasks: "{done} of {total} subtasks done",
  recurring: "Recurs {rule}",
  laneNone: "No {key}",
  // menu
  moveTo: "Move to",
  priority: "Priority",
  due: "Due date",
  today: "Today",
  tomorrow: "Tomorrow",
  nextWeek: "In a week",
  noDate: "Remove the date",
  edit: "Edit with Tasks",
  openNote: "Open the note alongside",
  priorities: { highest: "Highest", high: "High", medium: "Medium", none: "None", low: "Low", lowest: "Lowest" },
  // notices
  moved: "“{title}” → {column}",
  updated: "“{title}” updated",
  undo: "Undo",
  undone: "Undone",
  cannotUndo: "Cannot undo: the line has changed since.",
  notFound: "Task not found: its note changed since the board read it. Nothing was written.",
  missingFile: "Note not found: {path}",
  recurringNeedsTasks: "This task recurs (🔁): check it in its note, or install the Tasks plugin so the board can create the next occurrence.",
  recurringFailed: "Tasks did not complete this recurring task. Nothing was written.",
  insertBoard: "Insert a dot-kanban board",
  settingCheckboxes: "Draw checkboxes in notes",
  settingCheckboxesDesc: "Gives each status its own checkbox in your notes, as on the cards: [/] half, [-] dash, [?] question… and only [x] and [-] crossed out. Turn it off if your theme already draws them.",
};

export type Strings = typeof en;

const fr: Strings = {
  unknownInstruction: "Instruction inconnue « {text} »",
  didYouMean: "vouliez-vous dire « {word} » ?",
  unknownStatus: "Statut inconnu « {ref} » : utiliser [ ] [/] [x] [-] [>] [<] [?] [!] [*] ou leur nom",
  duplicateColumn: "La colonne {ref} est déjà sur le tableau",
  badDate: "Date inconnue « {text} » : utiliser today, tomorrow, in 3 days, 2 days ago ou AAAA-MM-JJ",
  badPriority: "Priorité inconnue « {text} » : utiliser highest, high, medium, none, low, lowest",
  badWidth: "Largeur inconnue « {text} » : utiliser une longueur comme 280px",
  badLimit: "« {text} » n'est pas un nombre de cartes",
  badSort: "Impossible de trier par « {text} »",
  badGroup: "Impossible de grouper par « {text} »",
  emptyList: "Rien après « {text} »",
  search: "Rechercher…",
  searchLabel: "Rechercher dans les cartes",
  peopleAll: "owner : tous",
  peopleOne: "owner : {name}",
  lanesNone: "Group by : aucun",
  lanesBy: "Group by : {key}",
  tasks: "{n} tâches",
  task: "1 tâche",
  hidden: "{n} écartées",
  hiddenOne: "1 écartée",
  legend: "Légende des colonnes",
  editSource: "Modifier le bloc",
  more: "Plus d'actions",
  empty: "Aucune tâche à afficher.",
  emptyFilters: "Aucune tâche ne correspond à {filters}.",
  showMore: "Afficher {n} de plus",
  hiddenTitle: "Tâches lues mais non affichées",
  reasonNoColumn: "le statut « {status} » n'a pas de colonne",
  reasonUnknown: "la coche [{symbol}] n'est pas un statut dot-kanban",
  reasonLimit: "au-delà de la limite de {n} cartes de la colonne",
  reasonToolbar: "masquée par la recherche ou les filtres de la barre",
  legendWrites: "écrit {what}",
  legendDone: "la date ✅ du jour",
  legendCancelled: "la date ❌ du jour",
  legendNothing: "la coche seulement",
  inherited: "{key} : hérité de {source}",
  fromParent: "la tâche parente",
  fromNote: "les propriétés de la note ({note})",
  subtasks: "{done} sous-tâches faites sur {total}",
  recurring: "Se répète {rule}",
  laneNone: "Sans {key}",
  moveTo: "Déplacer vers",
  priority: "Priorité",
  due: "Échéance",
  today: "Aujourd'hui",
  tomorrow: "Demain",
  nextWeek: "Dans une semaine",
  noDate: "Retirer la date",
  edit: "Éditer avec Tasks",
  openNote: "Ouvrir la note à côté",
  priorities: { highest: "La plus haute", high: "Haute", medium: "Moyenne", none: "Aucune", low: "Basse", lowest: "La plus basse" },
  moved: "« {title} » → {column}",
  updated: "« {title} » modifiée",
  undo: "Annuler",
  undone: "Annulé",
  cannotUndo: "Impossible d'annuler : la ligne a changé depuis.",
  notFound: "Tâche introuvable : sa note a changé depuis la lecture du tableau. Rien n'a été écrit.",
  missingFile: "Note introuvable : {path}",
  recurringNeedsTasks: "Cette tâche se répète (🔁) : la cocher dans sa note, ou installer le module Tasks pour que le tableau crée l'occurrence suivante.",
  recurringFailed: "Tasks n'a pas terminé cette tâche récurrente. Rien n'a été écrit.",
  insertBoard: "Insérer un tableau dot-kanban",
  settingCheckboxes: "Dessiner les coches dans les notes",
  settingCheckboxesDesc: "Donne à chaque statut sa propre coche dans vos notes, comme sur les cartes : [/] à moitié, [-] tiret, [?] question… et seules [x] et [-] barrées. À désactiver si votre thème les dessine déjà.",
};

let strings: Strings = en;
let current = "en";

/** `fr`, `fr-CA`… select French; anything else English. */
export function setLanguage(language: string) {
  current = language || "en";
  strings = current.toLowerCase().startsWith("fr") ? fr : en;
}

export const language = () => current;

type Key = Exclude<keyof Strings, "priorities">;

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  return strings[key].replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export const priorityName = (name: string) => strings.priorities[name as keyof Strings["priorities"]] ?? name;
