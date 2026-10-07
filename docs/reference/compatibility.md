# Versions, compatibilité, plateformes

La version du plugin est celle de `manifest.json` (et de `package.json`, le build refuse
une divergence). Cette page est **le seul endroit** de la documentation où des numéros de
version sont écrits.

## Ce que le plugin exige

| Composant | Version | Pourquoi |
| --- | --- | --- |
| Obsidian | **1.7.2** ou plus (`minAppVersion`) | `Workspace.revealLeaf` pour amener au premier plan l'onglet où s'ouvre une note ; `Vault.process` pour écrire une ligne sans course avec l'éditeur ; cache des listes (`listItems`) ; ouverture d'une note sur une ligne. Validé avec **1.13.7** |
| Tasks | Facultatif. **7.2.0** ou plus pour terminer une tâche 🔁 depuis le tableau (`executeToggleTaskDoneCommand`), **7.21.0** pour **Éditer avec Tasks** (`editTaskLineModal`). Testé avec **8.4.0**, la version épinglée par `npm run test:desktop` | Récurrences et fenêtre d'édition ; sans Tasks, tout le reste fonctionne |

Les sous-menus du menu de carte apparaissent quand Obsidian les propose ; sinon les choix
sont listés à plat.

## Journal des versions

| Version | Changements |
| --- | --- |
| 0.5.1 | **Correction d'un blocage d'Obsidian** : le cache d'Obsidian peut donner à une ligne deux éléments de liste, l'un se déclarant son propre parent ; la remontée vers la tâche parente tournait alors à l'infini, et le premier tableau dont le périmètre contenait une telle note figeait Obsidian. Un parent est désormais toujours une ligne au-dessus, et la tâche l'emporte sur une ligne à deux éléments |
| 0.5.0 | **Tableaux plus rapides sur un grand coffre** : un seul index des tâches pour tous les tableaux, notes lues par lots ; une ligne `path` ou `filename` seule écarte les notes avant toute lecture ; tableau non redessiné si ses tâches n'ont pas changé ; recherche appliquée après une pause de frappe. Une cellule dessine 50 cartes, puis **Afficher 50 de plus**. Titre de section le plus proche retrouvé quel que soit l'ordre du cache |
| 0.4.2 | Classes CSS renommées de `tik-*` en `dot-kanban-*` (et `.tik` en `.dot-kanban`, variables `--tik-*` en `--dot-kanban-*`) : un snippet CSS qui visait les anciennes classes est à mettre à jour. Aucun changement de fonctionnement |
| 0.4.1 | Releases GitHub accompagnées d'attestations de provenance (`main.js`, `manifest.json`, `styles.css` construits depuis le dépôt) ; section « Divulgations » du README. Aucun changement de fonctionnement |
| 0.4.0 | **Nouveau nom, publication au catalogue Obsidian** : dot-kanban, identifiant `dot-kanban`, bloc ` ```dot-kanban ` : ` ```tik ` n'est plus reconnu, les tableaux existants sont à renommer. Obsidian y voit un nouveau plugin : voir [la migration](../how-to/install.md#depuis-tasks-in-kanban). Dépôt `deepika-public/deepika-obsidian-toolbox/dot-kanban`, miroir GitHub `deepika-public/dot-kanban`, licence MIT. Tags sans `v`. Les styles qui élargissent le tableau en aperçu en direct passent du code à `styles.css`. Obsidian 1.7.2 minimum (`revealLeaf`), au lieu de 1.5.0 |
| 0.3.0 | **Refonte, nouveau nom** : Tasks in Kanban, identifiant `tasks-in-kanban`, bloc ` ```tik ` (voir la [spécification](../spec.md)). Une colonne est une coche parmi neuf statuts ; personnes en `[owner:: …]` ou `[o:: …]` ; plus de Dataview, le cache d'Obsidian suffit. **Nouveautés** : glisser-déposer souris, tactile et clavier, entre colonnes et entre groupes (`group by`), et vers une bande de priorité ; annulation ; menu de carte (priorité, échéance, édition Tasks) ; tâches 🔁 terminées par Tasks ; champs hérités de la tâche parente et de la note ; filtres à la manière de Tasks ; tâches écartées comptées et expliquées ; légende ; erreurs du bloc avec numéro de ligne et suggestion ; design aux couleurs du thème, tableau sur toute la largeur du panneau ; coches des neuf statuts dessinées dans les notes (réglage), avec le même bleu pour `[/]` et `[x]` ; pré-configuration des statuts de Tasks ; interface en français et en anglais |
| 0.2.0 | Le plugin quitte `obsidian_features` pour son propre dépôt, avec tests, CI et releases. Titre de carte affiché comme du texte, date `✅` locale, cartes d'une note renommée modifiables, fins de ligne CRLF conservées, options inconnues signalées |
| 0.1.0 | Version d'origine, dans le dépôt `obsidian_features` (`deepika-kanban/`) |

Règles de numérotation : tags `X.Y.Z` (`vX.Y.Z` jusqu'à 0.3.0). PATCH corrige sans rupture, MINOR ajoute une
fonctionnalité compatible ; avant `1.0`, une rupture de la syntaxe du bloc ou du format
écrit dans les notes demande un changement de MINOR, décrit ici.

## Plateformes

| Plateforme | État |
| --- | --- |
| Linux, Obsidian Desktop | Validé : tests dans de vraies fenêtres Obsidian, avec et sans Tasks (`npm run test:desktop`) |
| macOS, Windows | **Non validé.** Rien n'y est propre à une plateforme ; ce qui manque est un essai réel |
| Obsidian mobile | **Non validé.** Le plugin n'utilise aucune API Node ; le glisser au toucher (appui long) et l'ouverture d'une note à côté n'y ont pas été essayés |
