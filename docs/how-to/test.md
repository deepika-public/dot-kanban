# Tester

Depuis ce dépôt, avec Node.js 24+, npm et Python 3, sans Obsidian :

```bash
python3 scripts/check-docs.py     # la doc : pas de version ni de lien figé, pas de lien mort
npm ci
npm run build                     # vérifie les types et l'accord des versions
npm test
python3 test/release/test_package.py
```

C'est ce que lance la CI.

## Tests unitaires

`test/unit` couvre toute la logique, sans Obsidian :

- **ligne de tâche et dates** (`task.test.ts`) : marqueurs et coches, emojis et format
  Dataview de Tasks, champs et liens, écriture des statuts avec dates ✅ ❌, des priorités,
  dates et champs, identifiant de bloc gardé ; retrouver une tâche déplacée ou refuser de
  deviner ; CRLF ; annulation, y compris d'une récurrence sur deux lignes ;
- **collecte** (`collect.test.ts`) : cartes et sous-tâches, progression, champs résolus
  ligne → parente → note, section et chemin, `o` lu comme `owner` ;
- **bloc** (`query.test.ts`) : colonnes, tris, groupes, affichage, erreurs numérotées avec
  suggestion, chaque famille de filtres, `not` et `OR`, notes écartées avant lecture par
  les filtres de chemin ;
- **tableau** (`board.test.ts`) : tris et limites par colonne, tâches écartées et leur
  raison, barre d'outils sans casse ni accents, groupes, écriture d'un changement de
  groupe.

`test/unit/fixtures.ts` fabrique ce que le cache d'Obsidian dirait d'une note à partir de
son Markdown.

## Application Obsidian réelle

Sous Linux, avec Obsidian installé et un affichage :

```bash
npm run build && npm run test:desktop
```

Le harnais (`scripts/test-obsidian.mjs`) utilise `/usr/bin/obsidian`, remplaçable par
`OBSIDIAN_BINARY`. Il crée un profil et un vault temporaires, y installe ce plugin et Tasks
(d'abord désactivé, réglé par la pré-configuration de [configurer Tasks](tasks.md)), ouvre une fenêtre pilotée par le protocole DevTools, la garde au
premier plan, et vérifie, en relisant les fichiers sur le disque après chaque geste :

- une colonne par coche, tri par priorité, filtre de chemin, sous-tâches repliées ;
- personnes en ligne et héritées, progression, chemin de la note, échéance dépassée, HTML
  affiché comme du texte ;
- `</>` qui ouvre le bloc en édition ; les coches d'une note dessinées (couleur de `[?]`,
  `[/]` non barrée, `[x]` barrée) ;
- la liste des tâches écartées et leurs raisons ;
- un **vrai glisser à la souris** vers une autre colonne ;
- la coche, la date ✅, le tri `done reverse`, puis **Annuler** ;
- le menu de carte et son sous-menu de priorité ;
- le déplacement au clavier ;
- une tâche 🔁 refusée sans Tasks, puis terminée par Tasks avec l'occurrence suivante, à
  travers son cycle `[ ]` → `[<]` → `[/]` → `[x]` ;
- les erreurs du bloc, les groupes par personne, un glisser entre groupes, CRLF gardé ;
- une note modifiée hors d'Obsidian ; une modification dans l'éditeur suivie par le tableau
  avant l'enregistrement de la note ; un glisser dans une bande de priorité ; la recherche ;
  un clic qui ne fait que sélectionner, **Ouvrir la note à côté** curseur sur la tâche, puis
  un clic qui y montre une autre tâche, `Ctrl`+clic qui réutilise le même onglet ; une note renommée dont les cartes restent modifiables.

Tasks vient de `TASKS_DIR` (un dossier avec `main.js`, `manifest.json`, `styles.css`) si la
variable est définie, sinon de sa release GitHub, téléchargée une fois dans
`~/.cache/dot-kanban/` et vérifiée par SHA-256 : la version et les empreintes sont
épinglées dans `scripts/obsidian.mjs`. En cas d'échec, le dossier temporaire est gardé, son
chemin affiché avec le contenu des tableaux, l'état d'Obsidian et une capture d'écran ;
`KEEP=1` le garde aussi en cas de succès. Le harnais ne se connecte jamais à votre Obsidian
ni à vos vaults.

## Un Obsidian jetable, pour essayer à la main

```bash
npm run build && npm run sandbox
```

Ouvre un Obsidian avec Tasks et un vault d'exemple (un tableau, un tableau par personne, une
tâche récurrente, une note des neuf coches) et **rend la main** : la fenêtre reste ouverte. Le script
affiche les chemins, les essais les plus révélateurs et la commande pour tout arrêter. Il
n'affirme rien : c'est vous qui observez.

## Contrôles de distribution

`test/release/test_package.py` empaquette une copie jetable du dépôt, dans son propre
dépôt Git, et vérifie : contenu exact du ZIP (plugin, documentation, `BUILD.json` au bon
commit), somme `SHA256SUMS`, archive identique octet pour octet d'un passage à l'autre,
refus d'un tag qui ne nomme pas la version, d'une release depuis un checkout modifié et de
versions divergentes. Il a besoin de `main.js` : lancer `npm run build` avant.

## À la main, avant une release

Ce que les harnais ne couvrent pas : votre vrai vault, avec vos thèmes et vos autres
modules. Dans une copie du vault : glisser une carte dans chaque colonne et entre groupes,
au doigt sur un écran tactile si possible, la terminer, annuler, changer sa priorité et son
échéance ; relire chaque fois la ligne dans la note ; vérifier le rendu en thème clair et
sombre. Noter **réussi**, **échoué** ou **non exécuté**, avec les versions d'Obsidian, de
Tasks et du plugin. Un essai non exécuté reste à valider.
