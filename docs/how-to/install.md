# Installer, mettre à jour

Le plugin n'a besoin d'aucun autre module. Le module communautaire **Tasks** est
facultatif : avec lui, une tâche récurrente se termine depuis le tableau et le menu d'une
carte propose sa fenêtre d'édition. Prérequis : Obsidian à la version donnée dans
[compatibilité](../reference/compatibility.md).

## Depuis le catalogue Obsidian

Une fois le plugin accepté au catalogue : **Paramètres → Modules complémentaires →
Parcourir**, chercher **dot-kanban**, installer puis activer. Les mises à jour arrivent
par le même chemin.

## Depuis la dernière release

Télécharger depuis les [releases](https://gitlab.com/deepika-public/deepika-obsidian-toolbox/dot-kanban/-/releases)
`dot-kanban-<version>.zip` et `SHA256SUMS`, dans un même dossier. Puis, **Obsidian fermé**, en adaptant seulement le chemin du vault :

```bash
MY_VAULT="$HOME/mon-vault"
(
  set -e
  test -d "$MY_VAULT"
  mkdir -p "$MY_VAULT/.obsidian/plugins"      # absent d'un vault sans aucun module
  cd ~/Téléchargements && sha256sum -c SHA256SUMS
  unzip -o dot-kanban-*.zip -d "$MY_VAULT/.obsidian/plugins"
  grep '"version"' "$MY_VAULT/.obsidian/plugins/dot-kanban/manifest.json"
)
```

Résultat attendu : **OK**, puis la version installée. Le bloc s'arrête si la vérification
échoue. Le ZIP contient aussi cette documentation et `BUILD.json`, qui nomme le commit.

## Depuis les sources

Avec Node.js 24+ et npm, depuis la racine de ce dépôt :

```bash
npm ci && npm run build
```

Copier `main.js`, `manifest.json` et `styles.css` dans `<vault>/.obsidian/plugins/dot-kanban/`
(créer le dossier).

## Activer

Ouvrir le vault, puis **Paramètres → Modules complémentaires** : autoriser les modules
communautaires, activer **dot-kanban**. Les tableaux se configurent dans chaque bloc,
voir la [syntaxe du bloc](../reference/syntax.md). Un seul réglage global : **Dessiner les
coches dans les notes**, actif par défaut, à couper si le thème les dessine déjà. Avec
Tasks : [configurer Tasks](tasks.md) pour qu'il connaisse les neuf statuts.

## Mettre à jour

Obsidian fermé, refaire l'installation depuis la release : l'archive se décompresse
par-dessus. Le plugin n'écrit aucun fichier à lui dans le vault. Les changements de chaque
version sont dans le journal de [compatibilité](../reference/compatibility.md).

Ensuite : [un premier tableau](../tutorials/first-board.md).

## Depuis Tasks in Kanban

Avant son renommage (voir [compatibilité](../reference/compatibility.md)), le plugin s'appelait **Tasks in Kanban** (identifiant
`tasks-in-kanban`, bloc ` ```tik `). Obsidian y voit un autre plugin :

1. Installer dot-kanban, comme ci-dessus.
2. Pour garder ses réglages : copier `<vault>/.obsidian/plugins/tasks-in-kanban/data.json`
   dans `<vault>/.obsidian/plugins/dot-kanban/`.
3. Désactiver puis supprimer Tasks in Kanban.

Le bloc s'appelle désormais ` ```dot-kanban ` : ` ```tik ` n'est plus reconnu. Renommer les
tableaux existants, par exemple depuis la racine du vault :

```bash
grep -rlZ --include='*.md' '^```tik' . | xargs -0 sed -i 's/^```tik$/```dot-kanban/'
```
