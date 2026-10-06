# Configurer Tasks pour dot-kanban

Tasks est facultatif. Avec lui, une tâche 🔁 se termine depuis le tableau, le menu d'une
carte propose sa fenêtre d'édition, et **un clic sur une case dans une note fait avancer la
tâche dans un cycle de statuts** (`[ ]` → `[<]` → `[/]` → `[x]`) au lieu de seulement la cocher.
Pour que ce cycle connaisse les neuf statuts de dot-kanban, il faut les déclarer dans Tasks.

## Le cycle proposé

| Coche | Nom | Type | Un clic la fait passer à |
| --- | --- | --- | --- |
| `[ ]` | to-do | TODO | `[<]` |
| `[<]` | scheduling | TODO | `[/]` |
| `[/]` | incomplete | IN_PROGRESS | `[x]` |
| `[x]` | done | DONE | `[ ]` |
| `[-]` | canceled | CANCELLED | `[ ]` |
| `[>]` `[?]` `[!]` `[*]` | forwarded, question, important, star | TODO | `[x]` |

Mêmes noms et mêmes types que dans dot-kanban : Tasks et le tableau parlent des mêmes statuts. Les
quatre étapes du cycle sont aussi les colonnes d'un tableau sans `column`.

## Pré-configuration, par fichier

[`tasks-statuses.json`](tasks-statuses.json) contient exactement ce cycle. **Obsidian fermé**,
le fusionner dans les réglages de Tasks (les autres réglages sont gardés) :

```bash
VAULT=~/Documents/MonVault
python3 - "$VAULT" <<'EOF'
import json, sys, pathlib
data = pathlib.Path(sys.argv[1], ".obsidian/plugins/obsidian-tasks-plugin/data.json")
settings = json.loads(data.read_text()) if data.exists() else {}
settings.update(json.loads(pathlib.Path("tasks-statuses.json").read_text()))
data.write_text(json.dumps(settings, indent=2, ensure_ascii=False))
EOF
```

(à lancer depuis le dossier qui contient `tasks-statuses.json` : `docs/how-to/` du dépôt, ou
le même dossier dans le plugin installé). Au redémarrage, **Paramètres → Tasks → Statuts des
tâches** montre les neuf statuts.

## Pré-configuration, par l'interface

**Paramètres → Tasks → Statuts des tâches**, section des statuts personnalisés : le bouton
**Minimal Theme** ajoute 21 statuts, dont les neuf de dot-kanban avec les mêmes noms et types. Dans
cette collection, chaque statut passe directement à `[x]`. Pour le cycle proposé, modifier
(icône crayon) le **symbole du statut suivant** de `[ ]` (`<`) et de `[<]` (`/`) ; les statuts
en trop peuvent être supprimés, dot-kanban les ignore.

## Où le cycle s'applique

| Geste | Effet |
| --- | --- |
| Clic sur une case dans une note | le statut suivant du cycle (Tasks) |
| Commande **Tasks: Toggle task done** (nom traduit selon la langue ; à mettre sur un raccourci) | idem |
| Glisser une carte, menu **Déplacer vers…** | directement la coche de la colonne visée : le cycle ne s'applique pas |
| Coche d'une carte | `[x]`, ou `[ ]` depuis `[x]` |
| Tâche 🔁 vers `[x]` sur le tableau | Tasks fait avancer la tâche dans son cycle jusqu'à `[x]`, et écrit alors l'occurrence suivante |

Si le cycle n'atteint jamais `[x]` à partir de la coche de la tâche, le tableau ne termine
pas la tâche 🔁 et le dit : rien n'est écrit.
