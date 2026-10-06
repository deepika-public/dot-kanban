# dot-kanban (dot-kanban) — spécification de la refonte

*Lots 1 et 2 implémentés ; la [syntaxe du bloc](reference/syntax.md) et le [format des tâches](reference/task-format.md) font foi, cette page garde les choix et leurs raisons.* dot-kanban affiche les
tâches du vault en colonnes dans un bloc ` ```dot-kanban ` : une colonne par statut, une carte par
tâche. Les tâches restent des lignes Markdown ordinaires ; le tableau n'a pas d'état propre.

## 1. Objectifs

| Problème actuel | Réponse |
| --- | --- |
| Design daté : emojis-boutons, six boutons par carte, couleurs fixes | Cartes sobres aux couleurs du thème, actions dans un menu (§6, §7) |
| On ne sait pas ce qu'on va voir | Contenu de carte défini élément par élément, provenance au survol, tâches écartées comptées (§5, §8) |
| Déplacer une carte demande plusieurs clics | Glisser-déposer, souris et tactile, avec annulation (§6) |
| Syntaxe opaque : `[status:: x]`, JSON, coche implicite | Une ligne = une instruction ; une colonne = une coche, nommée par la table §3.1 (§4) |

Hors périmètre : cartes-notes (une note = une carte), sous-tâches déplaçables. Les coches
des notes sont dessinées comme sur les cartes, sauf si on désactive ce réglage.

## 2. Principes

1. **La note est la source.** Le tableau ne fait que lire et réécrire une ligne.
2. **Tasks d'abord.** Ce que Tasks sait exprimer s'écrit comme dans Tasks ; Tasks reste
   optionnel.
3. **Rien de caché.** Toute tâche lue mais non affichée est comptée, avec sa raison ; tout
   élément d'une carte dit d'où il vient.
4. **Sans Dataview.** Le cache de métadonnées d'Obsidian (`listItems`, `frontmatter`,
   `headings`) suffit.

| Emprunté à Tasks | Propre à dot-kanban |
| --- | --- |
| Priorités 🔺 ⏫ 🔼 🔽 ⏬, dates 📅 ⏳ 🛫 ➕ ✅ ❌, récurrence 🔁 | Table des statuts §3.1 et colonnes |
| Filtres `path includes`, `heading includes`, `description includes`, `due before`… | Champs `[clé:: valeur]` hérités : `owner` et les autres (§3.2) |
| `sort by`, `group by`, `show` / `hide`, `limit` | Filtres sur la note (`note.<propriété>`) |
| Cocher une tâche récurrente (API Tasks, §3.1) | Glisser-déposer, groupes modifiables (§6) |

## 3. Modèle

### 3.1 Statuts

Le statut d'une tâche est sa coche, et seulement elle (`[status:: …]` disparaît). dot-kanban
connaît neuf statuts ; une colonne en est un.

| Coche | Nom | Icône | Type Tasks | En entrant, dot-kanban écrit aussi |
| --- | --- | --- | --- | --- |
| `[ ]` | to-do | cercle vide | TODO | — |
| `[/]` | incomplete | demi-cercle | IN_PROGRESS | — |
| `[x]` | done | cercle coché | DONE | `✅ date du jour` |
| `[-]` | canceled | tiret, texte barré | CANCELLED | `❌ date du jour` |
| `[>]` | forwarded | flèche | TODO | — |
| `[<]` | scheduling | calendrier | TODO | — |
| `[?]` | question | point d'interrogation, orange | TODO | — |
| `[!]` | important | triangle, rouge | TODO | — |
| `[*]` | star | étoile, jaune | TODO | — |

Quitter `done` ou `canceled` retire la date ✅ ou ❌. `[X]` est lu comme `[x]`. Toute autre
coche n'est dans aucune colonne et compte parmi les tâches écartées (§8).

**Tâche récurrente (🔁) vers `done`.** Cocher une tâche 🔁 doit aussi créer l'occurrence
suivante (nouvelle ligne avec les dates avancées). dot-kanban ne recalcule pas les règles de
récurrence : si Tasks est installé, dot-kanban lui passe la ligne (`executeToggleTaskDoneCommand`,
API Tasks) et écrit les lignes qu'il rend ; sinon le dépôt est refusé avec une notification.

### 3.2 Champs `[clé:: valeur]`

Syntaxe des champs en ligne : `[owner:: [[Alice]], Bob]`, ou `[o:: …]`. Une valeur est une liste séparée
par des virgules ; un `[[lien]]` reste un lien. Tout champ se résout de la même façon, du
plus précis au plus général :

1. la ligne de la tâche ;
2. la tâche parente (pour une sous-tâche) ;
3. la propriété de même nom dans le frontmatter de la note.

`owner` (abrégé `o`) désigne les personnes assignées : `owner: [Alice]` dans la note assigne
par défaut toutes ses tâches. Les autres clés (`client`, `sprint`…) s'affichent, se filtrent et se groupent de
la même façon, sans configuration.

### 3.3 Ordre

L'ordre dans une colonne est **calculé**, jamais stocké : `sort by` (défaut : priorité, puis
échéance, puis ordre dans la note).

## 4. Syntaxe du bloc

Une instruction par ligne, à la manière des requêtes Tasks (plutôt que du YAML : la coche
s'y lit telle quelle) ; `#` en début de ligne commente. Les `column` donnent l'ordre des
colonnes, les autres instructions sont en ordre libre.

````markdown
```dot-kanban
column [ ]
column [<] Planifié
column [/]
column [x] | sort by done reverse | limit 20

path includes Projets/
path does not include Projets/Archive/
owner includes Alice
sort by priority, due
# facultatif : un groupe par personne
group by owner
show due, owner, path
```
````

| Instruction | Rôle | Défaut |
| --- | --- | --- |
| `column [c] Libellé` | Colonne du statut de coche `c` (§3.1), avec son icône. Le libellé est facultatif : nom du statut par défaut | `[ ]`, `[<]`, `[/]`, `[x]` |
| `… \| sort by … \| limit n` | Tri et plafond propres à une colonne | ceux du tableau |
| Filtres Tasks | `path`, `heading`, `description`, `tags`, `due`, `priority` : `includes`, `does not include`, `before`, `after`, `is` | tout le vault |
| `<clé> includes v`, `<clé> is v` | Filtre sur un champ (§3.2) : `owner includes Alice` | — |
| `note.<prop> is v`, `note.tags includes t` | Filtre sur une propriété ou les tags de la note | — |
| `not …`, `… OR …` | Inverser, combiner | — |
| `sort by` | `priority`, `due`, `scheduled`, `start`, `done`, `created`, `path`, `file order`, `<clé>` ; `reverse` | `priority, due, file order` |
| `group by` | Groupes en rangées : `<clé>` (dont `owner`), `priority`, `note`, `heading` | aucun |
| `show` / `hide` | Éléments de la carte (§5) | §5 |
| `width 200px` | Largeur minimale des colonnes ; le tableau prend toute la largeur du panneau | `240px` |

Erreurs : une ligne non comprise est signalée sous le tableau avec son numéro et, si
possible, la correction (« `colum` : vouliez-vous dire `column` ? »). Le reste s'affiche.
La commande **dot-kanban : insérer un tableau** colle un bloc commenté prêt à modifier.

## 5. Ce qu'affiche une carte

```
┌──────────────────────────────────────┐
│ ◐  Rédiger la page d'accueil      ⏫ │  ① coche   ② titre   ③ priorité
│    📅 demain  ·  ☑ 2/5  ·  ⏳ 12 oct  │  ④ dates   ⑤ sous-tâches
│    (A)(B)  ·  client: ACME            │  ⑥ owner   ⑦ autres champs
│    Projets/Site web.md                │  ⑧ chemin de la note
└──────────────────────────────────────┘
```

| | Élément (`show` / `hide`) | Lu dans | Règle | Défaut |
| --- | --- | --- | --- | --- |
| ① | coche | ligne | icône du statut (§3.1), cliquable : passe à `done`, ou revient à `to-do` depuis `done` | toujours |
| ② | titre | ligne | première ligne, moins la coche et les emojis de Tasks avec leur valeur ; champs gardés ; rendue en Markdown, HTML affiché comme du texte | toujours |
| ③ | `priority` | ligne | chevrons selon l'emoji Tasks, colorés pour ⏫ 🔺 | affiché |
| ④ | `due`, `scheduled`, `start`, `created`, `done` | ligne | date relative ; échéance dépassée en rouge | `due` |
| ⑤ | `subtasks` | sous-éléments | cochées / total | affiché s'il y en a |
| ⑥ | `owner` | champ `owner` (§3.2) | pastilles à initiales, nom au survol | affiché |
| ⑦ | `<clé>` | champ (§3.2) | `clé: valeur` | masqué |
| ⑧ | `path` | note | chemin de la note dans le vault | affiché |
| | `recurrence` | ligne | 🔁 et sa règle | masqué |

Au survol, un élément hérité dit sa source : « to : hérité des propriétés de la note (Projets/Site web.md) ».

## 6. Interactions

| Geste | Effet |
| --- | --- |
| Glisser vers une autre colonne | Écrit la coche de la colonne (§3.1) |
| Glisser vers un autre groupe (`group by`) | Écrit la valeur du groupe : `[owner:: Bob]`, emoji de priorité. Groupes `note` et `heading` non modifiables (déplacer une ligne entre notes est hors périmètre) |
| Glisser vers le haut ou le bas | Si la colonne est triée d'abord par priorité : des bandes 🔺 … ⏬ apparaissent pendant le glisser, déposer dans une bande écrit sa priorité, annoncée par l'emplacement ; se combine avec un changement de colonne. Sinon rien : l'ordre est calculé |
| Clic sur la coche | Passe à `done`, ou revient à `to-do` |
| Clic sur la carte | La sélectionne, et montre sa tâche dans la note ouverte à côté s'il y en a une ; `Ctrl`/`Cmd` : ouvre la note à côté |
| Clic droit / `⋯` | Menu : déplacer vers…, priorité, échéance, éditer (fenêtre Tasks si présent), ouvrir la note à côté |
| `Ctrl+Z` ou « Annuler » dans la notification | Défait la dernière action du tableau |
| Clavier | Flèches pour se déplacer, `Espace` prend/dépose, `Entrée` ouvre |

Le glisser-déposer a donc deux axes : horizontal = statut, vertical = valeur du groupe, ou priorité à l'intérieur d'une colonne triée par priorité.
Quand un champ venait de la note (§3.2), le dépôt l'écrit sur la ligne, qui l'emporte.

Écriture : relire la note, retrouver la ligne (même règle qu'aujourd'hui), réécrire par
`Vault.process` ; la carte bouge tout de suite, le cache confirme ensuite. Si la ligne a
changé entre-temps, rien n'est écrit, la carte revient, une notification l'explique.

Glisser-déposer par Pointer Events (l'API HTML5 ne réagit pas au toucher sur mobile), sans
dépendance.

## 7. Design

Piste retenue : **D, doux clair** (maquette D du canevas « dot-kanban — pistes
visuelles »). La maquette fixe la forme ; **les couleurs, polices et rayons viennent du
thème Obsidian actif**, clair ou sombre, thème communautaire compris. dot-kanban ne définit aucune
couleur en dur.

| Élément | Forme | Variables du thème |
| --- | --- | --- |
| Colonne | Panneau arrondi, toutes de même hauteur (jusqu'en bas du tableau), largeur égale | `--background-secondary`, `--radius-l` |
| Carte | Fond plein, filet fin, coins arrondis, trois lignes (§5) | `--background-primary`, `--background-modifier-border`, `--radius-m` |
| En-tête de colonne | Icône du statut, libellé, coche en police mono (`[?]`), compteur | `--text-normal`, `--text-muted`, `--font-monospace` |
| Métadonnées | Petite taille, couleur atténuée ; échéance dépassée en rouge | `--font-ui-small`, `--text-muted`, `--text-error` |
| Statuts, priorités | Couleur de l'icône seulement | `--color-blue`, `--color-orange`, `--text-faint` |
| Sélection, dépôt | Contour et emplacement en pointillés | `--interactive-accent` |
| Personnes | Pastille ronde à initiale, couleur stable dérivée du nom | `--color-*` du thème |

- Icônes Lucide d'Obsidian (`setIcon`), pas d'emojis comme boutons.
- Barre d'outils : recherche, puces `owner` et `Group by` (aucun par défaut), résumé
  (§8), légende.
- **Groupes** (`group by`, désactivés par défaut) : les en-têtes de colonnes restent en
  haut ; chaque groupe a un titre repliable (pastille, nom, nombre de tâches) puis une
  rangée de panneaux de même hauteur. Sur une carte, la personne du groupe n'est pas
  répétée, seuls les autres assignés s'affichent.
- Classes CSS `dot-kanban-*`, stables et documentées : un snippet peut tout ajuster sans toucher
  au plugin.

## 8. Transparence

- **Résumé** sous la barre d'outils : « 42 tâches · Projets/ · owner: Alice · 3 écartées ».
- **Écartées** : un clic liste les tâches lues mais non affichées et la raison (coche sans
  colonne ou inconnue, `limit`, recherche).
- **État vide** : rappelle les filtres actifs plutôt qu'un tableau blanc.

## 9. Compatibilité

- Identifiant `dot-kanban`, nom « dot-kanban », bloc `dot-kanban`.
- Tasks optionnel ; avec lui : tâches 🔁 terminables depuis le tableau, fenêtre d'édition.
  Fonctions utilisées : `executeToggleTaskDoneCommand` et `editTaskLineModal`, voir
  [compatibilité](reference/compatibility.md) pour les versions requises.

## 10. Lots

1. **Socle** (fait) : lecture par le cache Obsidian, statuts §3.1, champs §3.2, syntaxe §4,
   carte §5, design §7, transparence §8.
2. **Gestes** (fait) : glisser-déposer entre colonnes et groupes, menu, annulation,
   clavier, API Tasks.
3. **Confort** (à faire) : complétion dans le bloc, création d'une tâche depuis une
   colonne.
