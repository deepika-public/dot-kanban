# Publier une release

Une release, c'est un tag `X.Y.Z` sur `main`, **sans `v`** : Obsidian exige un tag égal à
la version du manifest. Deux publications en découlent :

- **GitLab**, la source : la CI construit le ZIP du plugin, le dépose dans le registre de
  paquets et crée la page de release ;
- **GitHub**, le miroir `github.com/deepika-public/dot-kanban` : le miroir y pousse le tag,
  et le workflow `.github/workflows/release.yml` crée la release GitHub avec `main.js`,
  `manifest.json` et `styles.css`. C'est elle que lit le catalogue des plugins
  Obsidian, qui propose la mise à jour aux utilisateurs.

Rien n'est publié sur npm.

## Prérequis, une fois

- Un runner GitLab Docker Linux x86_64, le registre de paquets générique activé, et dans
  les réglages du **groupe**, **Packages and registries → Generic**, *Allow duplicates*
  désactivé. Tags `*.*.*` protégés.
- Côté GitLab, aucune variable ni jeton : les jobs n'utilisent que `CI_JOB_TOKEN`.
- Le miroir vers GitHub : *Settings → Repository → Mirroring repositories*, direction
  *Push*, adresse `https://github.com/deepika-public/dot-kanban.git`, authentification par
  un jeton GitHub (accès en écriture au contenu de ce seul dépôt), *Mirror only protected
  branches* coché.

Sur une branche ou une merge request, le pipeline vérifie la documentation, construit,
lance les tests unitaires et les contrôles de distribution, puis empaquette. Sur un tag, il
publie en plus.

## Le CHANGELOG

[`CHANGELOG.md`](../../CHANGELOG.md), à la racine, suit
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) : une section par version, des
rubriques **Ajouté**, **Modifié**, **Corrigé**, **Supprimé**, écrites pour qui utilise le
plugin, pas pour qui lit le code. Chaque merge request qui change ce que voit
l'utilisateur ajoute sa ligne sous `## [Non publié]`.

La section de la version est le texte des releases : le job `package` l'écrit dans
`dist/RELEASE_NOTES.md` (`scripts/release-notes.py`, liens relatifs rendus absolus), que
reprennent la release GitLab et le workflow GitHub. Un pied de page y ajoute ce qui ne
vaut que pour la release : version d'Obsidian requise (`versions.json`), lien vers la mise
à jour, vers le CHANGELOG complet et vers les changements depuis la version précédente ;
sur GitHub, où se trouvent le ZIP et `SHA256SUMS`. Sans section, ou avec une section
vide, le packaging échoue : une version ne part pas sans dire ce qui change.

Le CHANGELOG fait foi : le texte d'une release ne s'édite pas à la main. Sur GitHub, le
workflow `.github/workflows/release-notes.yml` réécrit le texte de toutes les releases
quand `main` change le CHANGELOG, `versions.json` ou le script (et à la demande, onglet
**Actions**). Sur GitLab, la release prend son texte à sa création ; pour en corriger une
existante :

```bash
python3 scripts/release-notes.py X.Y.Z > dist/notes.md
glab api -X PUT "projects/deepika-public%2Fdeepika-obsidian-toolbox%2Fdot-kanban/releases/X.Y.Z" \
  -F "description=@$PWD/dist/notes.md"
```

```bash
python3 scripts/release-notes.py          # texte de la version du manifest
python3 scripts/release-notes.py X.Y.Z    # d'une autre version
```

## Publier

1. Sur une branche : passer la version dans `package.json`, `package-lock.json` et
   `manifest.json` (le build refuse une divergence) ; garder l'identifiant
   `dot-kanban` ; relever `minAppVersion` si les API utilisées l'exigent, et ajouter la
   paire version → `minAppVersion` dans `versions.json`. Dans le CHANGELOG, renommer
   `## [Non publié]` en `## [X.Y.Z] - AAAA-MM-JJ`, remettre un `## [Non publié]` vide
   au-dessus et mettre à jour les liens du bas (`[Non publié]` compare depuis `X.Y.Z`,
   nouveau lien `[X.Y.Z]`). Dans [compatibilité](../reference/compatibility.md), mettre à
   jour la version de Tasks testée si elle a changé dans `scripts/obsidian.mjs`, et les
   exigences si elles ont changé.
2. Lancer `npm run test:desktop` en local (la CI n'a pas d'affichage) et faire les essais
   à la main de [tester](test.md).
3. Merge request, pipeline vert, fusion. **Attendre que le pipeline de `main` soit vert**
   avant de taguer.
4. Poser le tag sur ce commit de `main`, jamais réutilisé ni déplacé :

   ```bash
   git fetch origin && git switch --detach origin/main
   git tag -a X.Y.Z -m 'dot-kanban X.Y.Z'
   git push origin X.Y.Z
   ```

5. Attendre le job `release`, puis vérifier sur la
   [page des releases](https://gitlab.com/deepika-public/deepika-obsidian-toolbox/dot-kanban/-/releases)
   la présence de `dot-kanban-X.Y.Z.zip` et de `SHA256SUMS` (« Source code »
   n'est pas le plugin), et le texte de la section du CHANGELOG. Télécharger et refaire [l'installation](install.md) sur un vault
   neuf : `sha256sum -c`, version dans le manifest, `BUILD.json` avec le bon commit.
6. Vérifier sur [GitHub](https://github.com/deepika-public/dot-kanban/releases) la release
   `X.Y.Z`, ses trois fichiers et le même texte : le catalogue Obsidian la proposera sous quelques heures.

## Catalogue Obsidian, la première fois

Une seule fois, après la première release GitHub : sur
[community.obsidian.md](https://community.obsidian.md), lier le compte GitHub, puis ajouter
le plugin (dépôt `deepika-public/dot-kanban`). Une revue automatique puis humaine suit ;
ses demandes de correction arrivent sur ce même site. Les versions suivantes ne demandent
rien de plus que le tag.

Le packaging refuse un tag divergent et un checkout modifié. Les fichiers d'une release
existante ne sont jamais modifiés, seul son texte suit le CHANGELOG : en cas d'erreur dans
le plugin, publier la version suivante.

## Construire le ZIP localement

```bash
npm ci && npm test && npm run package
(cd dist && sha256sum -c SHA256SUMS)
```

Le ZIP contient, sous `dot-kanban/`, `main.js`, `manifest.json`, `styles.css`, le README,
le CHANGELOG, la documentation et `BUILD.json` (commit, version, arbre propre ou non). Ni `node_modules`, ni
sources. Il faut un dépôt Git avec au moins un commit : `BUILD.json` nomme le commit, et sa
date fixe celle des fichiers de l'archive, ce qui la rend reproductible.

Références GitLab : [paquets génériques](https://docs.gitlab.com/user/packages/generic_packages/),
[releases CI](https://docs.gitlab.com/ci/yaml/#release).
