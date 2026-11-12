# Syntaxe du bloc

Un tableau est un bloc de code de langage `dot-kanban`, dans n'importe quelle note, affiché en
lecture et en aperçu en direct, sur toute la largeur du panneau (même avec la longueur de
ligne lisible). Plusieurs blocs sont des tableaux indépendants. Le plugin
a deux réglages globaux, le dessin des coches dans les notes ([format des tâches](task-format.md#statuts)) et la note où le bouton **Ajouter** écrit les nouvelles tâches ([la barre d'outils](#la-barre-doutils)) : tout le tableau se règle dans le bloc.

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
# chemins affichés à partir de Projets/ : « Site web.md »
path root Projets
width 240px
```
````

## Instructions

| Instruction | Rôle | Sans elle |
| --- | --- | --- |
| `column [c] Libellé` | Une colonne pour le statut de coche `c`, voir les [statuts](task-format.md#statuts). `column question` vaut `column [?]`. Libellé facultatif : le nom du statut. Sur un [tableau de notes](#tableau-de-notes), `column "valeur" Libellé` | `[ ]`, `[<]`, `[/]`, `[x]`, le cycle de [configurer Tasks](../how-to/tasks.md) |
| `… \| sort by … \| limit n` | Tri et nombre de cartes propres à cette colonne | ceux du tableau, sans limite ; 50 cartes dessinées par cellule, puis **Afficher 50 de plus** |
| `… \| color c` | Fond de la colonne teinté de la couleur `c` du thème : `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `pink` (`colour` accepté). Une autre valeur est une erreur | fond neutre |
| `… \| size s` | Taille des cartes de cette colonne, voir [tailles de carte](#tailles-de-carte) | celle du tableau |
| `size small` · `medium` · `large` | Taille des cartes du tableau ; `short` vaut `small` | `medium` |
| `cards notes` + `columns by p` | Une carte par note, rangée selon la valeur de sa propriété `p`, voir [tableau de notes](#tableau-de-notes). `cards tasks` revient au défaut | une carte par tâche |
| `sort by a, b reverse` | Ordre des cartes : `priority` (la plus haute d'abord), `due`, `scheduled`, `start`, `created`, `done`, `cancelled` (la plus proche d'abord), `path`, `file order`, ou un champ (`client`). Sans valeur, en dernier | `priority, due, file order` |
| `group by x` | Une rangée par valeur de `x` : un champ (`owner`, `client`…), `priority`, `note` ou `heading`. Changeable dans la barre d'outils | aucun groupe |
| `group by x \| order …` | Ordre des rangées : `alphanumeric`, `reverse`, ou une liste de valeurs, voir [ordre des rangées](#ordre-des-rangées) | `alphanumeric` |
| `show a, b` · `hide a, b` | Éléments des cartes, voir [ce qu'affiche une carte](#ce-quaffiche-une-carte) | `priority, due, subtasks, owner, path` |
| `width 200px` | Largeur minimale d'une colonne ; largeur exacte d'une colonne seule, qui ne s'étire pas | `240px` |
| `path root dossier` | Dossier à partir duquel le chemin des notes est affiché, voir [le chemin affiché](#le-chemin-affiché). Un ou plusieurs segments (`Clients/ACME`), `/` au début ou à la fin indifférent. Sans dossier : erreur. Si plusieurs lignes, la dernière l'emporte. Ce n'est pas un filtre | chemin dans le vault |
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

## Ordre des rangées

Les rangées de `group by` se rangent par défaut dans l'ordre **alphanumérique** de leur
valeur : sans casse ni accents, et les nombres par leur valeur (`2` avant `10`) ; pour
`priority`, de la plus haute à la plus basse. `| order` après `group by` impose un autre
ordre :

| Option | Ordre |
| --- | --- |
| `\| order alphanumeric` | celui par défaut, écrit pour être explicite |
| `\| order reverse` | l'inverse : `10`, `2`, `1` ; pour `priority`, de la plus basse à la plus haute |
| `\| order a, b, c` | les valeurs nommées d'abord, dans l'ordre écrit, puis les autres dans l'ordre alphanumérique. Valeur comparée sans casse ni accents ; entre guillemets si elle contient une virgule (`"a, b"`) |

La rangée sans valeur (« Sans `x` ») reste toujours la dernière. L'ordre vaut pour le
`group by` du bloc ; un autre groupement choisi dans la barre d'outils est en ordre
alphanumérique.

````markdown
```dot-kanban
cards notes
columns by statut
column "2 · ▶️ À faire" À faire
group by priorite | order "1 · 🔥 Haute", "2 · Moyenne", "3 · Basse"
```
````

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
| `path` | note | chemin de la note dans le vault, ou à partir de `path root` (chemin complet au survol) |

Un champ hérité de la tâche parente ou de la note s'affiche en italique et dit sa source au
survol.

### Tailles de carte

`size` règle tout le tableau, `| size` une colonne, qui l'emporte.

| Taille | La carte montre |
| --- | --- |
| `small` (ou `short`) | une ligne : coche, titre tronqué, priorité, `⋯` |
| `medium` | la carte décrite ci-dessus |
| `large` | la même, plus la liste de ses sous-tâches, chacune avec sa coche ; sur un tableau de notes, les tâches de la note |

```dot-kanban
column [ ] À faire | size small
column [/] En cours | size large | color blue
column [x] Fait | size small | color green
```

### Largeur des colonnes

Les colonnes se partagent la largeur du tableau, chacune au moins `width`. **Une colonne
seule** ne s'étire pas : elle mesure `width`, ce qui convient aux listes comme « Décisions
attendues » ou « Points d'attention ».

### Le chemin affiché

Sans `path root`, une carte affiche le chemin de sa note dans le vault. Avec
`path root samm-workspace`, si ce chemin contient le dossier `samm-workspace`, au début ou au
milieu, la carte n'affiche que ce qui le suit :

| Chemin dans le vault | Affiché |
| --- | --- |
| `Deepika/Work/samm-workspace/1. Chantiers/Planning/Planning.md` | `1. Chantiers/Planning/Planning.md` |
| `samm-workspace/Notes.md` | `Notes.md` |
| `Perso/Courses.md` (hors du dossier) | `Perso/Courses.md` |
| `old-samm-workspace/a.md` (pas le même dossier) | `old-samm-workspace/a.md` |

- Le dossier est comparé segment entier par segment entier, **casse comprise**, comme les
  chemins d'Obsidian ; un accent écrit en forme composée ou décomposée (NFC, NFD) compte
  pour le même. `path root Clients/ACME` exige les deux dossiers à la suite.
- Si le dossier apparaît plusieurs fois dans le chemin, c'est la dernière occurrence qui
  compte.
- Le même chemin raccourci sert partout où le tableau **montre** un chemin : la carte, la
  source d'un champ hérité de la note au survol, la recherche de la barre d'outils (qui
  cherche donc dans ce qui est affiché), le titre des groupes `note` et la liste des
  écartées.
- Il ne change rien au reste : les filtres `path` et `filename` et le tri `sort by path`
  portent toujours sur le chemin dans le vault, deux notes de même chemin raccourci restent
  deux groupes `note`, et les notifications (note introuvable) donnent le chemin complet.

## Tableau de notes

`cards notes` fait **une carte par note** au lieu d'une carte par tâche. `columns by p`
nomme la propriété dont la valeur donne la colonne ; chaque `column` nomme une valeur,
entre guillemets si elle contient une espace :

````markdown
```dot-kanban
cards notes
columns by statut
column "en cours" Maintenant | color blue
column "à faire" Ensuite
column livré Livré | color green | size small
path includes Chantiers/
show theme, cible
```
````

| | Règle |
| --- | --- |
| Notes lues | toutes celles que les filtres de chemin laissent passer, avec ou sans tâches ; les propriétés viennent du cache d'Obsidian, seules les notes à tâches sont lues |
| Colonne | la valeur de la propriété, comparée sans casse ni accents ; pour une liste, la première valeur qui a une colonne |
| Titre | le nom de la note, sans `.md` ; une icône de page remplace la coche |
| Champs | les propriétés de la note (`show theme`), filtrables (`theme is IA`) et groupables (`group by theme`) |
| Priorité, dates | propriétés `priority: high`, `due: 2026-11-30` (et les autres dates), lues comme sur une tâche |
| `subtasks` | tâches de la note sans tâche au-dessus d'elles, cochées / total, annulées non comptées |
| Écartées | une note sans la propriété, ou dont la valeur n'a pas de colonne, avec sa raison |

Glisser une carte vers une autre colonne **écrit la propriété dans les propriétés de la
note** (`statut: livré`), avec la casse qu'elle y avait ; vers un autre groupe, la valeur du
groupe (`theme`). **Annuler** remet la valeur d'avant, si elle n'a pas changé depuis. Le menu
d'une carte de note propose **Déplacer vers…** et **Ouvrir la note à côté** ; pas de
priorité, d'échéance ni de bandes de priorité. Sans `columns by`, ou sans colonne, le bloc
signale l'erreur.

## La barre d'outils

Recherche (titre et chemin affiché, sans casse ni accents), puce **owner** (une personne), puce
**Group by** (aucun, `owner`, `priority`, `note`, `heading`), bouton **Ajouter**, puis le **résumé** :
nombre de cartes, filtres du bloc, et **écartées**, qui liste les tâches lues mais non
montrées avec leur raison (coche sans colonne, coche inconnue, au-delà de `limit`, barre
d'outils). **?** ouvre la légende des colonnes : coche, statut, ce qui est écrit en y
entrant. **`</>`** passe la note en édition, curseur dans le bloc, pour le modifier. Les choix de la barre ne sont pas enregistrés dans la note ; ils restent tant que
la note est ouverte.

**Ajouter** crée une tâche et l'écrit **à la fin de la note choisie dans les réglages**
(**Paramètres → dot-kanban → Note des nouvelles tâches**, `.md` facultatif), créée avec
ses dossiers si elle n'existe pas. Avec Tasks, sa fenêtre de création
s'ouvre : description, priorité, dates, statut, comme dans Tasks. Sans Tasks, une fenêtre
demande la description ; la tâche prend la coche de la première colonne qui n'est ni
`[x]` ni `[-]`. **Annuler** retire la ligne, si elle n'a pas changé depuis. Sans note
choisie, une notification indique le réglage. La tâche n'apparaît sur le tableau que si
ses filtres la laissent passer. Pas de bouton sur un [tableau de notes](#tableau-de-notes).

Un tableau plus large que le panneau défile de côté par **deux barres**, au-dessus et
au-dessous des colonnes, qui se suivent ; celle du haut n'apparaît que si le tableau
déborde.

## Gestes

| Geste | Effet dans la note |
| --- | --- |
| Glisser vers une autre colonne | Coche de la colonne, avec dates ✅ / ❌, voir [statuts](task-format.md#statuts) |
| Glisser vers un autre groupe | Valeur du groupe écrite sur la ligne (`[owner:: Bob]`, emoji de priorité), à la place de celle quittée. Pas pour les groupes `note` et `heading` |
| Glisser une carte de note | La propriété `columns by` (ou celle du groupe) écrite dans les propriétés de la note, voir [tableau de notes](#tableau-de-notes) |
| Glisser vers le haut ou le bas | Dans une colonne triée d'abord par `priority` (le défaut), une bande par priorité apparaît pendant le glisser : 🔺 la plus haute … aucune … ⏬ la plus basse. Déposer dans une bande écrit sa priorité ; l'emplacement l'annonce quand elle change. Se combine avec un changement de colonne ou de groupe. Ailleurs, et dans sa propre bande, rien : l'ordre est calculé |
| Clic sur la coche | `[x]` et ✅, ou `[ ]` depuis `[x]` |
| Clic droit, ou `⋯` | Déplacer vers…, priorité, échéance (aujourd'hui, demain, dans une semaine, retirer), éditer avec Tasks, **Ouvrir la note à côté** (dans un onglet à côté du tableau, le même à chaque fois tant qu'il reste ouvert) |
| Clic sur la carte | La sélectionne ; si une note est ouverte à côté, y montre sa tâche. Avec `Ctrl`/`Cmd`, ouvre la note à côté |
| `Ctrl+Z` dans le tableau, ou **Annuler** | Défait la dernière écriture, si la ligne n'a pas changé depuis |
| Clavier | Flèches entre les cartes, `Espace` prend la carte, `←` `→` choisissent la colonne, `Espace` dépose, `Échap` renonce, `Entrée` ouvre la note à côté |

Sur écran tactile, un appui long prend la carte.
