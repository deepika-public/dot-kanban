# dot-kanban

*A kanban board of the vault's tasks, in any note: a `dot-kanban` code block shows one column per checkbox status and one card per task; dragging a card rewrites the task's checkbox in its note. No database: tasks stay plain Markdown lines, in the formats of the Tasks plugin. No network access. Documentation below is in French (see « Divulgations » for vault access); the interface is in English and French.*

Un tableau kanban des tâches du vault, dans n'importe quelle note : un bloc de code
` ```dot-kanban ` affiche une colonne par statut, c'est-à-dire par coche (`[ ]`, `[<]`, `[/]`, `[x]`,
`[?]`…), et une carte par tâche. Glisser une carte d'une colonne à l'autre réécrit la coche
de la tâche dans sa note. Il n'y a ni base de données ni fichier propre au tableau : la
tâche reste une ligne de Markdown ordinaire, lisible sans le plugin.

Aucune dépendance. Les priorités, dates et récurrences s'écrivent comme dans le module
[Tasks](https://publish.obsidian.md/tasks/) ; s'il est installé, le tableau sait aussi
terminer une tâche récurrente et ouvrir sa fenêtre d'édition.

## Installer

Depuis Obsidian, une fois le plugin au catalogue : **Paramètres → Modules complémentaires →
Parcourir**, chercher **dot-kanban**. Anciennement **Tasks in Kanban** : voir
[la migration](docs/how-to/install.md#depuis-tasks-in-kanban).

Ou depuis les [releases](https://gitlab.com/deepika-public/deepika-obsidian-toolbox/dot-kanban/-/releases),
Obsidian fermé :

```bash
VAULT=~/Documents/MonVault
mkdir -p "$VAULT/.obsidian/plugins"
unzip -o dot-kanban-*.zip -d "$VAULT/.obsidian/plugins"
```

Puis activer **dot-kanban** dans les modules complémentaires. Le détail, avec
vérification des sommes, est dans [installer](docs/how-to/install.md) ; depuis les sources, `npm ci && npm run build`.

## Divulgations

Ce que le plugin fait du coffre, comme le demandent les règles du catalogue :

- **Liste des notes** : pour rassembler les tâches du coffre, le plugin parcourt la liste de ses notes Markdown. Il interroge d'abord le cache d'Obsidian et **ne lit le contenu que des notes qui contiennent des tâches**. Le filtre `path includes` d'un tableau restreint ce qui est affiché, pas ce qui est parcouru.
- **Écriture** : seulement quand vous déplacez, cochez ou modifiez une carte, et seulement **la ligne de cette tâche**, si elle est retrouvée intacte ; sinon rien n'est écrit.
- **Ni réseau, ni compte, ni télémétrie, ni publicité.** Aucun fichier hors du coffre. Code source ouvert, licence MIT ; les releases GitHub portent une attestation de provenance.

## Utiliser

Dans une note, en lecture ou en aperçu en direct (la commande **Insérer un tableau dot-kanban**
colle un bloc commenté) :

````markdown
```dot-kanban
column [ ] À faire
column [<] Planifié
column [/] En cours
column [x] Fait | sort by done reverse | limit 20
path includes Projets/
```
````

Chaque tâche `- [ ]` des notes retenues devient une carte. Une carte se **glisse** vers une
autre colonne (souris, tactile ou clavier) ; sa **coche** la termine ; **clic droit** règle
priorité et échéance et **Ouvrir** la note, à côté ou dans un onglet. Chaque
écriture se défait par **Annuler** dans la notification ou `Ctrl+Z`.

`[owner:: Alice]` (ou `[o:: Alice]`) assigne une tâche ; `owner: Alice` dans les propriétés
d'une note assigne toutes ses tâches. `group by owner` range les cartes par personne ; d'un
groupe à l'autre, une carte se glisse aussi.

Tout tient en une page dans le [guide](docs/guide.md) ; le [premier tableau](docs/tutorials/first-board.md)
déroule ces étapes ; la [syntaxe du bloc](docs/reference/syntax.md) et le [format des tâches](docs/reference/task-format.md)
décrivent le reste.

## Ce qu'il garantit, et ce qu'il ne fait pas

- Une action ne modifie que la ligne de la tâche, et seulement si elle la retrouve : si la
  tâche a changé entre-temps, rien n'est écrit et une notification le dit.
- Rien n'est caché sans le dire : les tâches lues mais non affichées sont comptées dans le
  résumé, avec leur raison ; une ligne du bloc non comprise est signalée avec son numéro.
- Le HTML d'une tâche est affiché comme du texte, jamais interprété.
- Pas d'ordre manuel dans une colonne : l'ordre est calculé (`sort by`). Pas de création
  de tâche depuis le tableau. Linux validé dans de vraies fenêtres Obsidian ; macOS,
  Windows et mobile pas encore, voir [compatibilité](docs/reference/compatibility.md).

## Documentation

[Index](docs/README.md) · [Dépanner](docs/how-to/troubleshoot.md) ·
[Architecture](docs/explanation/architecture.md) · [Tester](docs/how-to/test.md) ·
[Publier une release](docs/how-to/release.md) · [Spécification](docs/spec.md).
