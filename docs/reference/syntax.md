# Syntaxe du bloc

Un tableau est un bloc de code de langage `dot-kanban`, dans n'importe quelle note, affiché en
lecture et en aperçu en direct, sur toute la largeur du panneau (même avec la longueur de
ligne lisible). Plusieurs blocs sont des tableaux indépendants. Le plugin
n'a qu'un réglage global, le dessin des coches dans les notes ([format des tâches](task-format.md#statuts)) : tout le tableau se règle dans le bloc.

Une instruction par ligne, à la manière des requêtes Tasks. Une ligne qui commence par `#`
est un commentaire. Les `column` donnent l'ordre des colonnes ; les autres lignes sont en
ordre libre. Une ligne non comprise est listée au-dessus du tableau avec son numéro et, si
possible, la correction (« `colum` : vouliez-vous dire `column` ? ») ; le reste s'applique.

````markdown
```dot-kanban
column [ ] À faire
column [<] Planifié
column [/] En cours
column [x] Fait | sort by done reverse | limit 20

path includes Projets/
path does not include Projets/Archive/
owner includes Alice
sort by priority, due
# facultatif : un groupe par personne
group by owner
show client
width 240px
```
````

## Instructions

| Instruction | Rôle | Sans elle |
| --- | --- | --- |
| `column [c] Libellé` | Une colonne pour le statut de coche `c`, voir les [statuts](task-format.md#statuts). `column question` vaut `column [?]`. Libellé facultatif : le nom du statut | `[ ]`, `[<]`, `[/]`, `[x]`, le cycle de [configurer Tasks](../how-to/tasks.md) |
| `… \| sort by … \| limit n` | Tri et nombre de cartes propres à cette colonne | ceux du tableau, sans limite ; 50 cartes dessinées par cellule, puis **Afficher 50 de plus** |
| `sort by a, b reverse` | Ordre des cartes : `priority` (la plus haute d'abord), `due`, `scheduled`, `start`, `created`, `done`, `cancelled` (la plus proche d'abord), `path`, `file order`, ou un champ (`client`). Sans valeur, en dernier | `priority, due, file order` |
| `group by x` | Une rangée par valeur de `x` : un champ (`owner`, `client`…), `priority`, `note` ou `heading`. Changeable dans la barre d'outils | aucun groupe |
| `show a, b` · `hide a, b` | Éléments des cartes, voir [ce qu'affiche une carte](#ce-quaffiche-une-carte) | `priority, due, subtasks, owner, path` |
| `width 200px` | Largeur minimale d'une colonne | `240px` |
| Un filtre | Ne garder que les tâches qui le vérifient. Plusieurs lignes : toutes doivent l'être | tout le vault |

## Filtres

Ceux de Tasks, plus les champs et les propriétés de la note. Texte comparé sans casse ni
accents ; `includes` cherche un morceau, `is` la valeur entière.

| Filtre | Exemple |
| --- | --- |
| `path`, `filename`, `heading`, `description` + `includes`, `does not include`, `is`, `is not` | `path includes Projets/` |
| `tags include`, `tags do not include` (tags de la ligne) | `tags include #urgent` |
| `note.tags includes` (tags de la note, propriétés et corps) | `note.tags includes projet/` |
| `note.<propriété> is`, `includes`… | `note.client is ACME` |
| `<champ> is`, `includes`… (champ résolu, voir [champs](task-format.md#champs)) | `owner includes Alice` |
| `due`, `scheduled`, `start`, `created`, `done`, `cancelled` + `before`, `after`, `on`, `on or before`, `on or after` + date | `due before in 7 days` |
| `has due date`, `no due date` (idem pour les autres dates) | `no scheduled date` |
| `priority is`, `is not`, `above`, `below` + `highest`, `high`, `medium`, `none`, `low`, `lowest` | `priority above medium` |
| `is recurring`, `is not recurring` | |
| `not <filtre>` ; `<filtre> OR <filtre>` | `path includes Pro/ OR path includes Perso/` |

Dates : `today`, `tomorrow`, `yesterday`, `in 3 days`, `2 weeks ago`, `AAAA-MM-JJ`.

Les filtres du bloc définissent le périmètre du tableau ; les tâches qu'ils écartent ne sont
pas comptées comme « écartées ».

Une ligne qui ne porte que sur `path` ou `filename` (avec `not` et `OR` si besoin) est
appliquée avant de lire les notes : celles qu'elle écarte ne sont jamais ouvertes. Sur un
grand vault, `path includes Projets/` rend donc le tableau rapide ; une ligne qui mêle
autre chose (`path includes A/ OR owner is Alice`) oblige à lire toutes les notes.

## Ce qu'affiche une carte

```
◐  Rédiger la page d'accueil            ⇈
   📅 demain  ☑ 2/5  client: ACME   (A)(B)
   Projets/Site web.md
```

| Élément | Lu dans | Règle |
| --- | --- | --- |
| coche | ligne | icône du statut ; un clic passe à `[x]`, ou revient à `[ ]` depuis `[x]` |
| titre | ligne | première ligne sans la coche ni les emojis de Tasks et leur valeur (priorité, dates, 🔁…) ; les champs `[clé:: valeur]` restent ; rendu en Markdown, HTML affiché comme du texte |
| `priority` | ligne | chevrons, colorés pour `high` et `highest` ; rien pour `none` |
| `due`, `scheduled`, `start`, `created`, `done`, `cancelled` | ligne | date relative (« demain », « 12 oct. ») ; échéance dépassée en rouge |
| `subtasks` | sous-tâches | cochées / total, annulées non comptées |
| `recurrence` | ligne | règle de 🔁 |
| `owner` | champ `owner` (ou `o`) | pastilles à initiales, nom au survol ; dans un groupe `owner`, la personne du groupe n'est pas répétée |
| `<champ>` | champ | `champ: valeur` |
| `path` | note | chemin de la note dans le vault |

Un champ hérité de la tâche parente ou de la note s'affiche en italique et dit sa source au
survol.

## La barre d'outils

Recherche (titre et chemin, sans casse ni accents), puce **owner** (une personne), puce
**Group by** (aucun, `owner`, `priority`, `note`, `heading`), puis le **résumé** :
nombre de cartes, filtres du bloc, et **écartées**, qui liste les tâches lues mais non
montrées avec leur raison (coche sans colonne, coche inconnue, au-delà de `limit`, barre
d'outils). **?** ouvre la légende des colonnes : coche, statut, ce qui est écrit en y
entrant. **`</>`** passe la note en édition, curseur dans le bloc, pour le modifier. Les choix de la barre ne sont pas enregistrés dans la note ; ils restent tant que
la note est ouverte.

## Gestes

| Geste | Effet dans la note |
| --- | --- |
| Glisser vers une autre colonne | Coche de la colonne, avec dates ✅ / ❌, voir [statuts](task-format.md#statuts) |
| Glisser vers un autre groupe | Valeur du groupe écrite sur la ligne (`[owner:: Bob]`, emoji de priorité), à la place de celle quittée. Pas pour les groupes `note` et `heading` |
| Glisser vers le haut ou le bas | Dans une colonne triée d'abord par `priority` (le défaut), une bande par priorité apparaît pendant le glisser : 🔺 la plus haute … aucune … ⏬ la plus basse. Déposer dans une bande écrit sa priorité ; l'emplacement l'annonce quand elle change. Se combine avec un changement de colonne ou de groupe. Ailleurs, et dans sa propre bande, rien : l'ordre est calculé |
| Clic sur la coche | `[x]` et ✅, ou `[ ]` depuis `[x]` |
| Clic droit, ou `⋯` | Déplacer vers…, priorité, échéance (aujourd'hui, demain, dans une semaine, retirer), éditer avec Tasks, **Ouvrir la note à côté** (dans un onglet à côté du tableau, le même à chaque fois tant qu'il reste ouvert) |
| Clic sur la carte | La sélectionne ; si une note est ouverte à côté, y montre sa tâche. Avec `Ctrl`/`Cmd`, ouvre la note à côté |
| `Ctrl+Z` dans le tableau, ou **Annuler** | Défait la dernière écriture, si la ligne n'a pas changé depuis |
| Clavier | Flèches entre les cartes, `Espace` prend la carte, `←` `→` choisissent la colonne, `Espace` dépose, `Échap` renonce, `Entrée` ouvre la note à côté |

Sur écran tactile, un appui long prend la carte.
