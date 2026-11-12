# Versions, compatibilité, plateformes

La version du plugin est celle de `manifest.json` (et de `package.json`, le build refuse
une divergence). Cette page et le [CHANGELOG](../../CHANGELOG.md) sont **les seuls endroits** de la
documentation où des numéros de version sont écrits.

## Ce que le plugin exige

| Composant | Version | Pourquoi |
| --- | --- | --- |
| Obsidian | **1.7.2** ou plus (`minAppVersion`) | `Workspace.revealLeaf` pour amener au premier plan l'onglet où s'ouvre une note ; `Vault.process` pour écrire une ligne sans course avec l'éditeur ; `FileManager.processFrontMatter` pour écrire la propriété d'une carte de note ; cache des listes (`listItems`) ; ouverture d'une note sur une ligne. Validé avec **1.13.7** |
| Tasks | Facultatif. **7.2.0** ou plus pour terminer une tâche 🔁 depuis le tableau (`executeToggleTaskDoneCommand`), **7.21.0** pour **Éditer avec Tasks** (`editTaskLineModal`) ; la fenêtre de création de **Ajouter** (`createTaskLineModal`) est plus ancienne que ces deux-là. Testé avec **8.4.0**, la version épinglée par `npm run test:desktop` | Récurrences, fenêtres d'édition et de création ; sans Tasks, tout le reste fonctionne |

Les sous-menus du menu de carte apparaissent quand Obsidian les propose ; sinon les choix
sont listés à plat.

## Journal des versions

Les changements de chaque version sont dans le [CHANGELOG](../../CHANGELOG.md), qui fait
aussi le texte des releases.

## Numérotation

Tags `X.Y.Z` (`vX.Y.Z` jusqu'à 0.3.0). PATCH corrige sans rupture, MINOR ajoute une
fonctionnalité compatible ; avant `1.0`, une rupture de la syntaxe du bloc ou du format
écrit dans les notes demande un changement de MINOR, décrit dans le CHANGELOG.

## Plateformes

| Plateforme | État |
| --- | --- |
| Linux, Obsidian Desktop | Validé : tests dans de vraies fenêtres Obsidian, avec et sans Tasks (`npm run test:desktop`) |
| macOS, Windows | **Non validé.** Rien n'y est propre à une plateforme ; ce qui manque est un essai réel |
| Obsidian mobile | **Non validé.** Le plugin n'utilise aucune API Node ; le glisser au toucher (appui long) et l'ouverture d'une note à côté n'y ont pas été essayés |
