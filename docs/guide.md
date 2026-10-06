# dot-kanban en une page

Un tableau kanban des tâches du vault, dans n'importe quelle note. Une colonne par statut,
c'est-à-dire par coche ; une carte par tâche. Agir sur une carte réécrit la ligne de la
tâche dans sa note : il n'y a pas d'autre donnée que vos notes. Le détail est dans la
[syntaxe du bloc](reference/syntax.md) et le [format des tâches](reference/task-format.md).

## 1. Écrire ses tâches

Des cases à cocher ordinaires, avec les conventions du module Tasks.

```markdown
---
owner: Alice
---
## Contenu
- [ ] Rédiger la page d'accueil ⏫ 📅 2026-10-12 [client:: ACME]
    - [x] Plan
    - [ ] Textes
- [/] Choisir une police [o:: Bob]
- [?] Valider le logo
```

| Élément | S'écrit | Remarque |
| --- | --- | --- |
| **Statut** | la coche : `[ ]` to-do, `[/]` incomplete, `[x]` done, `[-]` canceled, `[>]` forwarded, `[<]` scheduling, `[?]` question, `[!]` important, `[*]` star | une autre coche n'apparaît dans aucune colonne ; dans les notes aussi, chacune a sa couleur et sa marque |
| **Priorité** | 🔺 highest, ⏫ high, 🔼 medium, 🔽 low, ⏬ lowest | rien = none |
| **Dates** | 📅 échéance, ⏳ planifiée, 🛫 début, ➕ création, ✅ faite, ❌ annulée, suivies de `AAAA-MM-JJ` | ou en champs Dataview `[due:: …]` |
| **Récurrence** | 🔁 every week… | terminée depuis le tableau seulement avec Tasks |
| **Personnes** | `[owner:: Alice, Bob]`, abrégé `[o:: Alice]` ; `[[Alice]]` accepté | |
| **Autres champs** | `[clé:: valeur]`, autant qu'on veut | |
| **Sous-tâches** | tâches indentées sous une tâche | ne sont pas des cartes : elles font la progression `1/2` de leur parente |

**Héritage.** Un champ absent de la ligne est pris à la tâche parente, puis aux propriétés
de la note. Ci-dessus, « Valider le logo » est à Alice par la propriété `owner`.

## 2. Écrire un tableau

Un bloc de code `dot-kanban`, une instruction par ligne ; `#` en début de ligne commente. Bloc vide :
quatre colonnes `[ ]`, `[<]`, `[/]`, `[x]` (to-do, scheduling, incomplete, done) sur tout le vault. La commande **Insérer un tableau dot-kanban**
colle un modèle.

````markdown
```dot-kanban
column [ ] À faire
column [<] Planifié
column [/] En cours
column [x] Fait | sort by done reverse | limit 20

path includes Projets/
owner includes Alice
sort by priority, due
group by owner
show client
hide path
width 220px
```
````

| Instruction | Effet | Par défaut |
| --- | --- | --- |
| `column [c] Libellé` | une colonne par coche, dans l'ordre écrit ; libellé facultatif ; `\| sort by …` et `\| limit n` propres à la colonne | `[ ]`, `[<]`, `[/]`, `[x]` |
| filtre | ne garder que les tâches qui le vérifient (toutes les lignes s'appliquent) | tout le vault |
| `sort by a, b reverse` | ordre des cartes : `priority`, une date, `path`, `file order`, un champ | `priority, due, file order` |
| `group by x` | une rangée par valeur : un champ (`owner`…), `priority`, `note`, `heading` | aucun |
| `show` / `hide` | éléments des cartes | `priority, due, subtasks, owner, path` |
| `width` | largeur minimale d'une colonne | `240px` |

**Filtres**, à la manière de Tasks, sans casse ni accents :

- `path`, `filename`, `heading`, `description` + `includes`, `does not include`, `is`, `is not` ;
- `tags include #x` (tags de la ligne), `note.tags includes x` (tags de la note) ;
- `note.<propriété> is v`, `<champ> includes v` (`owner includes Alice`, `client is ACME`) ;
- `due before tomorrow`, `scheduled on or after 2026-10-01`, `has due date`, `no start date` ;
- `priority above medium`, `is recurring` ;
- `not …` inverse, `… OR …` combine.

Dates : `today`, `tomorrow`, `yesterday`, `in 3 days`, `2 weeks ago`, `AAAA-MM-JJ`.

Une ligne non comprise est listée en rouge au-dessus du tableau, avec son numéro et une
suggestion (« vouliez-vous dire `column` ? ») ; le reste s'applique.

## 3. Ce qu'on voit

```
[Rechercher…] [owner : tous] [Group by : aucun]     11 tâches · path includes Projets/ · 1 écartée  [</>] [?]

 ○ À faire  [ ]  5     ▣ Planifié  [<]  2     ◐ En cours  [/]  2     ✓ Fait  [x]  2
 ┌───────────────────────────────────────┐
 │ ○  Rédiger la page d'accueil       ⇈ │  coche · titre · priorité
 │    demain  1/2  client: ACME     (A) │  dates · progression · champs · personnes
 │    Projets/Site.md                    │  chemin de la note
 └───────────────────────────────────────┘
```

- **Le tableau** occupe toute la largeur du panneau, aux couleurs du thème actif (clair ou
  sombre) ; les colonnes ont la même hauteur.
- **Une colonne** : icône du statut, libellé, coche, nombre de cartes.
- **Une carte** :

| Élément | Réglage | Par défaut |
| --- | --- | --- |
| coche, titre | toujours | le titre est la ligne sans sa coche ni les emojis de Tasks ; les champs restent |
| priorité (chevrons) | `priority` | affichée |
| dates relatives, échéance dépassée en rouge | `due`, `scheduled`, `start`, `created`, `done`, `cancelled` | `due` |
| progression des sous-tâches | `subtasks` | affichée |
| personnes (pastilles, nom au survol ; italique si héritées) | `owner` | affichées |
| autre champ, `clé: valeur` | son nom (`show client`) | masqué |
| règle de récurrence | `recurrence` | masquée |
| chemin de la note | `path` | affiché |

- **Groupes** (`group by`) : les colonnes restent en haut ; une rangée repliable par valeur ;
  dans un groupe `owner`, la personne du groupe n'est pas répétée sur ses cartes.
- **Le résumé** : nombre de cartes, filtres du bloc, et **écartées** : les tâches lues mais
  non montrées, avec leur raison (coche sans colonne, coche inconnue, au-delà de `limit`,
  recherche ou puce).
- **?** : la légende des colonnes (coche, statut, ce qui est écrit en y entrant).

## 4. Ce qu'on peut faire

| Geste | Effet dans la note |
| --- | --- |
| Glisser vers une autre colonne | la coche de la colonne ; ✅ ou ❌ daté du jour en entrant dans `[x]` ou `[-]`, retiré en en sortant |
| Glisser vers un autre groupe | la valeur du groupe sur la ligne (`[owner:: Bob]`, emoji de priorité) |
| Glisser vers le haut ou le bas | dans une colonne triée par priorité, des bandes 🔺 … ⏬ apparaissent : déposer dans une bande écrit sa priorité (annoncée par l'emplacement) ; possible en changeant aussi de colonne |
| Clic sur la coche | `[x]` et ✅ ; depuis `[x]`, retour à `[ ]` |
| Clic sur la carte | la sélectionne ; si une note est ouverte à côté, y montre sa tâche |
| `Ctrl`/`Cmd`+clic | ouvre la note à côté du tableau, curseur sur la tâche |
| Clic droit, ou `⋯` | Déplacer vers… · Priorité · Échéance (aujourd'hui, demain, dans une semaine, retirer) · Éditer avec Tasks · Ouvrir la note à côté |
| **Annuler** dans la notification, ou `Ctrl+Z` | défait la dernière écriture, si la ligne n'a pas changé depuis |
| Clavier | flèches entre cartes ; `Espace` prend, `←` `→` choisissent, `Espace` dépose, `Échap` renonce ; `Entrée` ouvre |
| Toucher | appui long pour prendre une carte |
| Barre d'outils | rechercher, choisir une personne, changer de groupement ; `</>` ouvre le bloc en édition |

Rien n'est écrit si la tâche a changé depuis que le tableau l'a lue : une notification le
dit. Une tâche 🔁 qui passe à `[x]` est confiée à Tasks, qui écrit l'occurrence suivante ;
sans Tasks, le geste est refusé.

## 5. Ce qu'on peut configurer

| Où | Quoi |
| --- | --- |
| Le bloc | colonnes et libellés, filtres, tri et limite (tableau ou colonne), groupement, éléments des cartes, largeur des colonnes |
| La barre d'outils | recherche, personne, groupement : le temps de la session, sans toucher la note |
| Les propriétés d'une note | les valeurs par défaut de ses tâches (`owner`, `client`…) |
| Le thème Obsidian | toutes les couleurs, polices et arrondis du tableau ; un snippet CSS peut viser les classes `dot-kanban-*` |

| Paramètres → dot-kanban | **Dessiner les coches dans les notes** (actif) : les neuf coches de la §1 avec leur couleur et leur marque dans les notes, seules `[x]` et `[-]` barrées ; à couper si le thème les dessine |

Deux tableaux sont indépendants, même dans une seule note.

## 6. Avec ou sans Tasks

Le plugin lit et écrit seul le format de Tasks. Le module Tasks, facultatif, ajoute :
terminer une tâche 🔁 depuis le tableau, sa fenêtre d'édition dans le menu d'une carte, et
dans les notes un clic qui fait avancer une tâche dans un cycle `[ ]` → `[<]` → `[/]` → `[x]`. Une
pré-configuration des neuf statuts et de ce cycle est prête : [configurer Tasks](how-to/tasks.md).
