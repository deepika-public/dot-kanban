# Architecture : de la ligne à la carte, et retour

Les notes possèdent les tâches ; le cache de métadonnées d'Obsidian sait où elles sont ; le
plugin ne possède rien. Un tableau n'a pas d'état enregistré : il est recalculé depuis le
vault, et une action sur une carte n'est qu'une réécriture de la ligne de la tâche dans sa
note. C'est ce qui garde les tâches lisibles sans le plugin, et ce qui permet à plusieurs
tableaux de montrer les mêmes tâches sans se contredire.

## Les modules

| Fichier | Rôle | Dépend d'Obsidian |
| --- | --- | --- |
| `src/statuses.ts` | Les neuf statuts : coche, nom, type Tasks | Non |
| `src/dates.ts` | Jours du calendrier, dates des requêtes, libellés relatifs | Non |
| `src/task.ts` | Lit et réécrit **une ligne** au format Tasks (coche, priorité, dates, récurrence, champs) ; retrouve une tâche dans un fichier ; défait une écriture | Non |
| `src/collect.ts` | Les tâches d'une note : cartes, sous-tâches, champs hérités, section | Non |
| `src/query.ts` | Lit le bloc `dot-kanban` : colonnes, filtres, tris, groupes, affichage, erreurs | Non |
| `src/board.ts` | Colonnes, tri, limites, groupes, tâches écartées et leur raison ; l'écriture d'un changement de groupe | Non |
| `src/i18n.ts` | Textes en anglais et en français | Non |
| `src/vault.ts` | Un index pour tous les tableaux : lit le cache d'Obsidian et le texte des notes demandées, ne relit que ce qui a changé, prévient les tableaux | Oui |
| `src/view.ts` | Le tableau affiché : barre d'outils, cartes, menus, écriture, annulation, clavier | Oui |
| `src/dnd.ts` | Le glisser par Pointer Events | DOM seulement |
| `src/icons.ts`, `src/modals.ts` | Icônes des statuts ; fenêtres de légende et des tâches écartées | Oui |
| `src/tasks-api.ts` | L'API du module Tasks, s'il est là | Oui |
| `src/settings.ts` | Le réglage du dessin des coches dans les notes : une classe sur `body`, que vise `styles.css` | Oui |
| `src/main.ts` | Enregistre le bloc `dot-kanban`, la commande d'insertion et le réglage | Oui |

Tout ce qui décide est pur et testé sans Obsidian (`test/unit`) ; ce qui touche Obsidian
est mince et vérifié dans une vraie fenêtre (`npm run test:desktop`).

## Lire

Obsidian crée un `TikBoard` (un `MarkdownRenderChild`) par bloc affiché et le détruit
quand le bloc change ou sort de l'écran : le bloc est lu une fois. Les choix de la barre
d'outils et les groupes repliés sont gardés en mémoire par note et texte du bloc, pour
qu'un bloc recréé revienne comme il était.

Un seul `TaskIndex`, créé par le plugin, sert tous les tableaux : un bloc recréé par
Obsidian retrouve les notes déjà lues. Un tableau lui demande les notes de son périmètre :
les lignes du bloc qui ne portent que sur `path` ou `filename` sont testées sur le chemin,
avant toute lecture. Pour chaque note retenue dont le cache signale une case à cocher
(`listItems[].task`), l'index lit son texte (`cachedRead`), par lots de 50 pour laisser
Obsidian dessiner entre deux, et en tire les tâches : le cache donne les lignes, les
parents et les titres de section, le texte donne le contenu. Une note n'est relue que si sa
date ou sa taille a changé ; relue à l'identique, elle garde ses objets tâche. Puis
`layoutBoard` applique les filtres du bloc, ceux de la barre, range par coche, trie, limite
et note ce qui est écarté et pourquoi.

Une cellule dessine 50 cartes ; **Afficher 50 de plus** dessine les suivantes. Un titre sans
Markdown (ni lien, ni tag, ni emphase…) est écrit comme texte, sans passer par le moteur
Markdown.

## Rester à jour

L'index écoute le cache (`metadataCache` `changed`), les renommages et les suppressions, et
prévient les tableaux ; un tableau ne se recalcule que si la note touchée est dans son
périmètre, et les mises à jour rapprochées sont regroupées (200 ms). Une note ouverte dans
l'éditeur n'est enregistrée qu'une ou deux secondes après la frappe : l'index suit donc
aussi l'éditeur (`editor-change`), avec son texte non enregistré, tant que le nombre de
lignes ne change pas (les positions du cache restent justes) ; sinon il attend
l'enregistrement. Si les tâches lues sont les mêmes objets qu'avant, le tableau n'est pas
redessiné ; après une action, il l'est toujours. Seul le corps est reconstruit : barre
d'outils, recherche et défilement restent. La recherche s'applique quand la frappe marque
une pause (150 ms).

## Écrire

Une action passe par `Vault.process`, qui lit et réécrit la note d'un seul tenant, sans
course avec l'éditeur ni avec une autre action. Dans le texte lu à cet instant, la tâche est
cherchée à la ligne attendue, puis, si elle a bougé, à la ligne de même titre la plus
proche. Le titre exclut tout ce que le tableau écrit (coche, priorité, dates, champs) : une
tâche reste reconnue après n'importe quelle suite d'actions du tableau, mais pas si
quelqu'un a changé ses mots. Dans ce cas rien n'est écrit, et une notification l'explique.

La transformation est une fonction pure (`setStatus`, `setPriority`, `setDate`, `setField`)
qui garde l'indentation, le marqueur, l'identifiant de bloc et la fin de ligne. Une tâche
🔁 qui passe à `done` est confiée à Tasks, qui rend une ou deux lignes. Chaque écriture
garde les lignes d'avant et d'après : **Annuler** remet les premières si les secondes sont
toujours là, telles quelles. Après l'écriture, les cartes se mettent à jour sans attendre
le cache, qui confirme ensuite.

## Glisser

`CardDrag` écoute les Pointer Events : un mouvement de 5 px à la souris, un appui long de
300 ms au toucher, démarre le glisser. Une copie de la carte suit le pointeur ; la cellule
visée (colonne, et groupe s'il y en a) reçoit un emplacement à la place que le tri donnera
à la carte. Dans une colonne triée d'abord par priorité, prendre une carte range les cartes
en bandes, une par priorité ; la bande sous le pointeur reçoit l'emplacement, et le dépôt
écrit sa priorité en même temps que la coche et le groupe. Près des bords, le tableau et la note défilent. L'API HTML5 de glisser-déposer
n'est pas utilisée : elle ne se déclenche pas au toucher.

## Afficher sans interpréter

Le titre d'une carte vient d'une note, donc de n'importe qui avec qui le vault est partagé.
Il est rendu par le moteur Markdown d'Obsidian après avoir écrit `<` et `&` comme du texte :
liens, tags et emphase s'affichent, aucun HTML n'est interprété.

## Toute la largeur du panneau

Une note limite ses lignes à la « longueur de ligne lisible » ; un tableau n'est pas une
ligne de texte. Une fois le bloc dans sa note, le tableau mesure le panneau (marges
comprises) et s'y étend par une marge négative, recalculée à chaque redimensionnement. En
aperçu en direct, l'éditeur coupe un bloc à la colonne de texte par une règle `contain:
paint` marquée importante : le tableau la lève sur son seul bloc, par un style en ligne
lui-même important.

## Ouvrir une note à côté

**Ouvrir la note à côté** (ou `Ctrl`/`Cmd`+clic) partage le panneau du tableau
(`getLeaf("split")`) et y ouvre la note, curseur sur la tâche ; le tableau reste en vue.
Tant que cet onglet reste ouvert, il est réutilisé, et un simple clic sur une carte y montre
sa tâche sans prendre le focus au tableau.

Quand quelque chose ne va pas : [dépanner](../how-to/troubleshoot.md).
