# Format des tâches

Ce que le tableau lit dans une ligne de tâche, et ce qu'il y écrit. Il ne touche qu'à la
ligne de la tâche visée et seulement aux éléments ci-dessous ; le reste du texte,
l'indentation, un identifiant de bloc `^id` final et les fins de ligne (LF ou CRLF) sont
conservés. Ce qui vient du module Tasks s'écrit comme dans Tasks, en emojis ou en champs
Dataview selon ce que la ligne utilise déjà.

## Tâche et carte

Toute case à cocher : `- [ ]`, `* [ ]`, `+ [ ]`, `1. [ ]`, `1) [ ]`, indentée ou non. Une
tâche sans tâche au-dessus d'elle dans sa liste est une carte ; une sous-tâche n'en est pas
une : elle compte dans la progression de sa parente. Une sous-tâche hérite des champs de sa
parente, ce qui compte pour ses propres sous-tâches. Le tableau
lit le cache d'Obsidian : une tâche dans un bloc de code n'en est pas une.

## Statuts

Le statut d'une tâche est sa coche, et seulement elle. Neuf statuts, une colonne chacun :

| Coche | Nom | Type Tasks | En entrant, le tableau écrit aussi |
| --- | --- | --- | --- |
| `[ ]` | to-do | TODO | — |
| `[/]` | incomplete | IN_PROGRESS | — |
| `[x]` | done | DONE | `✅ date du jour` |
| `[-]` | canceled | CANCELLED | `❌ date du jour` |
| `[>]` | forwarded | TODO | — |
| `[<]` | scheduling | TODO | — |
| `[?]` | question | TODO | — |
| `[!]` | important | TODO | — |
| `[*]` | star | TODO | — |

`[X]` se lit `[x]`. Une date ✅ ou ❌ déjà présente est gardée ; quitter `done` ou `canceled`
retire la sienne. Une autre coche (`[r]`…) n'est dans aucune colonne : la tâche compte parmi
les écartées.

**Dans les notes**, le plugin dessine aussi ces neuf coches, avec la couleur et la marque
qu'elles ont sur les cartes, et ne barre que `[x]` et `[-]` (Obsidian dessine sinon toute
coche non vide comme une case cochée, et barre `[x]`). La forme de la case reste celle du
thème. À désactiver dans **Paramètres → dot-kanban → Dessiner les coches dans les notes** si le thème
(Minimal, Things…) les dessine déjà.

**Tâche récurrente (🔁) vers `done`.** Il faut aussi écrire l'occurrence suivante. Le
tableau ne recalcule pas les règles de récurrence : il passe la ligne à Tasks
(`executeToggleTaskDoneCommand`), autant de fois qu'il faut pour que le cycle de statuts de
Tasks atteigne `[x]` ([configurer Tasks](../how-to/tasks.md)), et écrit les lignes que Tasks
rend, selon ses réglages.
Sans Tasks, le geste est refusé avec une notification et la note n'est pas modifiée.

## Champs

`[clé:: valeur]` ou `(clé:: valeur)`, comme Dataview. Plusieurs valeurs séparées par des
virgules ; une virgule dans un `[[lien]]` ne sépare pas. Clé sans casse. Un champ se
résout du plus précis au plus général :

1. la ligne de la tâche ;
2. la tâche parente, pour une sous-tâche ;
3. la propriété de même nom de la note (`owner: Alice` ou `owner: [Alice, "[[Bob]]"]`).

**`owner`** désigne les personnes assignées ; **`o`** en est l'abréviation, sur la ligne
(`[o:: Alice]`) comme en propriété (`o: Alice`). `[[Alice]]` s'affiche « Alice ». Quand le
tableau écrit ce champ, il écrit `owner` et retire `o`.

Les champs de Tasks en format Dataview (`due`, `scheduled`, `start`, `created`,
`completion`, `cancelled`, `priority`, `repeat`, `id`, `dependsOn`, `onCompletion`) ne
sont pas des champs utilisateur : ils sont lus comme dates, priorité et récurrence.

## Priorité

| Emoji | 🔺 | ⏫ | 🔼 | aucun | 🔽 | ⏬ |
| --- | --- | --- | --- | --- | --- | --- |
| Nom | highest | high | medium | none | low | lowest |

Plusieurs emojis : le plus haut l'emporte. Changer la priorité retire les anciens et écrit
le nouveau en fin de ligne (`[priority:: high]` sur une ligne au format Dataview).

## Dates

Lues : 📅 échéance, ⏳ planifiée, 🛫 début, ➕ création, ✅ achèvement, ❌ annulation,
suivies de `AAAA-MM-JJ`, ou leurs champs Dataview. Écrites : ✅ et ❌ (statuts), 📅 (menu
**Échéance**), toujours à la date locale.

## Titre de la carte

La première ligne sans sa coche, dont on retire seulement les emojis de Tasks avec leur
valeur : priorité, dates (📅 2026-10-12…), récurrence (🔁 every week), `🆔`, `⛔`, `🏁`. Le
reste, champs `[clé:: valeur]` et `^id` compris, est rendu en Markdown ; le HTML est
affiché comme du texte.

## Retrouver la tâche avant d'écrire

Une action relit la note et cherche la tâche à la ligne où le tableau l'a vue, en comparant
ses mots, sans ce que le tableau écrit (coche, emojis de Tasks, champs). Si la ligne a bougé, la tâche de même titre
la plus proche est prise. Sinon rien n'est écrit et une notification l'indique. Le détail :
[architecture](../explanation/architecture.md).
