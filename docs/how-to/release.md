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

## Publier

1. Sur une branche : passer la version dans `package.json`, `package-lock.json` et
   `manifest.json` (le build refuse une divergence) ; garder l'identifiant
   `dot-kanban` ; relever `minAppVersion` si les API utilisées l'exigent, et ajouter la
   paire version → `minAppVersion` dans `versions.json` ; ajouter
   l'entrée de version dans [compatibilité](../reference/compatibility.md), et y mettre à
   jour la version de Tasks testée si elle a changé dans `scripts/obsidian.mjs`.
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
   n'est pas le plugin). Télécharger et refaire [l'installation](install.md) sur un vault
   neuf : `sha256sum -c`, version dans le manifest, `BUILD.json` avec le bon commit.
6. Vérifier sur [GitHub](https://github.com/deepika-public/dot-kanban/releases) la release
   `X.Y.Z` et ses trois fichiers : le catalogue Obsidian la proposera sous quelques heures.

## Catalogue Obsidian, la première fois

Une seule fois, après la première release GitHub : sur
[community.obsidian.md](https://community.obsidian.md), lier le compte GitHub, puis ajouter
le plugin (dépôt `deepika-public/dot-kanban`). Une revue automatique puis humaine suit ;
ses demandes de correction arrivent sur ce même site. Les versions suivantes ne demandent
rien de plus que le tag.

Le packaging refuse un tag divergent et un checkout modifié. Une release existante n'est
jamais modifiée : en cas d'erreur, publier la version suivante.

## Construire le ZIP localement

```bash
npm ci && npm test && npm run package
(cd dist && sha256sum -c SHA256SUMS)
```

Le ZIP contient, sous `dot-kanban/`, `main.js`, `manifest.json`, `styles.css`, la
documentation et `BUILD.json` (commit, version, arbre propre ou non). Ni `node_modules`, ni
sources. Il faut un dépôt Git avec au moins un commit : `BUILD.json` nomme le commit, et sa
date fixe celle des fichiers de l'archive, ce qui la rend reproductible.

Références GitLab : [paquets génériques](https://docs.gitlab.com/user/packages/generic_packages/),
[releases CI](https://docs.gitlab.com/ci/yaml/#release).
