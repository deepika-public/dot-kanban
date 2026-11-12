# Changelog

Les changements de chaque version de dot-kanban, de la plus récente à la plus ancienne. Le
format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; la numérotation est
décrite dans [compatibilité](docs/reference/compatibility.md#numérotation). La section
d'une version devient le texte de sa release, sur GitLab et sur GitHub.

## [Non publié]

## [0.8.0] - 2026-11-12

### Ajouté

- **Ordre des rangées** : `group by priorite | order reverse` les inverse ;
  `| order "1 · Haute", Basse` met ces valeurs d'abord, les autres suivent ;
  `| order alphanumeric` est l'ordre par défaut. La rangée sans valeur reste la dernière.
  Un autre groupement choisi dans la barre d'outils garde l'ordre alphanumérique.
- **Barre de défilement en haut** : un tableau plus large que le panneau a une seconde
  barre au-dessus des colonnes, synchronisée avec celle du bas.
- **Bouton Ajouter** dans la barre d'outils : il ouvre la fenêtre de création de Tasks,
  ou sans Tasks une fenêtre qui demande la description (coche de la première colonne
  ouverte). La tâche est écrite à la fin de la note réglée dans **Note des nouvelles
  tâches**, créée avec ses dossiers au besoin ; **Annuler** la retire. Pas de bouton sur
  un tableau de notes.

### Modifié

- Les rangées sont par défaut en ordre naturel : les nombres par leur valeur (`2` avant
  `10`), sans tenir compte de la casse ni des accents.

## [0.7.0] - 2026-11-05

### Ajouté

- **Couleur de colonne** : `column [/] En cours | color blue` teinte le fond de la colonne
  avec une couleur du thème (`red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`,
  `pink`), dans les rangées aussi ; une autre valeur est signalée.
- **Tailles de carte** : `size small` (une ligne : coche, titre, priorité ; `short`
  accepté), `medium` (défaut), `large` (avec les sous-tâches et leur coche), pour le
  tableau ou une colonne (`| size large`).
- **Tableau de notes** : `cards notes` + `columns by statut` fait une carte par note,
  rangée selon la valeur de la propriété (`column "en cours" Maintenant`). Titre = nom de
  la note, propriétés en champs (`show`, filtres, `group by`), `priority` et dates lues
  dans les propriétés, progression et liste des tâches de la note. Glisser écrit la
  propriété dans la note (et celle du groupe), **Annuler** la remet. Les notes sans la
  propriété ou sans colonne sont comptées parmi les écartées.

### Modifié

- **Colonne seule** : un tableau d'une colonne ne s'étire plus sur la page, la colonne
  mesure `width` (`240px` par défaut).

### Corrigé

- Déposer une carte dans une bande de priorité écrit la priorité de la bande où
  l'emplacement est montré. Avant, retirer l'emplacement pouvait raccourcir la bande et
  faire écrire celle d'en dessous (colonnes étroites, cartes hautes).

## [0.6.0] - 2026-10-07

### Ajouté

- **Chemins plus courts sur les cartes** : instruction de bloc `path root <dossier>`
  (`path root samm-workspace`, `path root Clients/ACME`). Les cartes affichent le chemin de
  la note à partir de ce dossier, le chemin complet au survol. Même chemin dans la
  recherche, les groupes `note`, la source d'un champ hérité et la liste des écartées. Les
  filtres et le tri gardent le chemin dans le vault ; une note hors du dossier garde son
  chemin. Pas de réglage global.

## [0.5.1] - 2026-10-07

### Corrigé

- **Blocage d'Obsidian** : le cache d'Obsidian peut donner à une ligne deux éléments de
  liste, l'un se déclarant son propre parent ; la remontée vers la tâche parente tournait
  alors à l'infini, et le premier tableau dont le périmètre contenait une telle note
  figeait Obsidian. Un parent est désormais toujours une ligne au-dessus, et la tâche
  l'emporte sur une ligne à deux éléments.

## [0.5.0] - 2026-10-06

### Modifié

- **Tableaux plus rapides sur un grand coffre** : un seul index des tâches pour tous les
  tableaux, notes lues par lots ; une ligne `path` ou `filename` seule écarte les notes
  avant toute lecture ; tableau non redessiné si ses tâches n'ont pas changé ; recherche
  appliquée après une pause de frappe.
- Une cellule dessine 50 cartes, puis **Afficher 50 de plus**.

### Corrigé

- Le titre de section le plus proche est retrouvé quel que soit l'ordre du cache.

## Versions antérieures

Publiées avant le dépôt actuel : leurs dates n'ont pas été conservées.

## 0.4.2

### Modifié

- Classes CSS renommées de `tik-*` en `dot-kanban-*` (et `.tik` en `.dot-kanban`,
  variables `--tik-*` en `--dot-kanban-*`) : un snippet CSS qui visait les anciennes classes
  est à mettre à jour. Aucun changement de fonctionnement.

## 0.4.1

### Ajouté

- Releases GitHub accompagnées d'attestations de provenance (`main.js`, `manifest.json`,
  `styles.css` construits depuis le dépôt) ; section « Divulgations » du README. Aucun
  changement de fonctionnement.

## 0.4.0

### Modifié

- **Nouveau nom, publication au catalogue Obsidian** : dot-kanban, identifiant
  `dot-kanban`, bloc ` ```dot-kanban `. Obsidian y voit un nouveau plugin : voir
  [la migration](docs/how-to/install.md#depuis-tasks-in-kanban).
- Dépôt `deepika-public/deepika-obsidian-toolbox/dot-kanban`, miroir GitHub
  `deepika-public/dot-kanban`, licence MIT. Tags sans `v`.
- Les styles qui élargissent le tableau en aperçu en direct passent du code à
  `styles.css`.
- Obsidian 1.7.2 minimum (`revealLeaf`), au lieu de 1.5.0.

### Supprimé

- Le bloc ` ```tik ` n'est plus reconnu : les tableaux existants sont à renommer.

## 0.3.0

### Modifié

- **Refonte, nouveau nom** : Tasks in Kanban, identifiant `tasks-in-kanban`, bloc
  ` ```tik ` (voir la [spécification](docs/spec.md)). Une colonne est une coche parmi neuf
  statuts ; personnes en `[owner:: …]` ou `[o:: …]` ; plus de Dataview, le cache
  d'Obsidian suffit.

### Ajouté

- Glisser-déposer souris, tactile et clavier, entre colonnes et entre groupes
  (`group by`), et vers une bande de priorité ; annulation.
- Menu de carte (priorité, échéance, édition Tasks) ; tâches 🔁 terminées par Tasks.
- Champs hérités de la tâche parente et de la note ; filtres à la manière de Tasks.
- Tâches écartées comptées et expliquées ; légende ; erreurs du bloc avec numéro de ligne
  et suggestion.
- Design aux couleurs du thème, tableau sur toute la largeur du panneau ; coches des neuf
  statuts dessinées dans les notes (réglage), avec le même bleu pour `[/]` et `[x]`.
- Pré-configuration des statuts de Tasks ; interface en français et en anglais.

## 0.2.0

### Modifié

- Le plugin quitte `obsidian_features` pour son propre dépôt, avec tests, CI et releases.

### Corrigé

- Titre de carte affiché comme du texte, date `✅` locale, cartes d'une note renommée
  modifiables, fins de ligne CRLF conservées, options inconnues signalées.

## 0.1.0

- Version d'origine, dans le dépôt `obsidian_features` (`deepika-kanban/`).

[Non publié]: https://gitlab.com/deepika-public/deepika-obsidian-toolbox/dot-kanban/-/compare/0.8.0...main
[0.8.0]: https://gitlab.com/deepika-public/deepika-obsidian-toolbox/dot-kanban/-/releases/0.8.0
[0.7.0]: https://gitlab.com/deepika-public/deepika-obsidian-toolbox/dot-kanban/-/releases/0.7.0
[0.6.0]: https://gitlab.com/deepika-public/deepika-obsidian-toolbox/dot-kanban/-/releases/0.6.0
[0.5.1]: https://gitlab.com/deepika-public/deepika-obsidian-toolbox/dot-kanban/-/releases/0.5.1
[0.5.0]: https://gitlab.com/deepika-public/deepika-obsidian-toolbox/dot-kanban/-/releases/0.5.0
