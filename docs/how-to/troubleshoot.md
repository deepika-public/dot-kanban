# Dépanner

D'abord ce que dit le tableau ou la notification, puis la console d'Obsidian.

## Ce que dit le tableau

**Une liste rouge au-dessus du tableau** (« Instruction inconnue », « Statut inconnu »…).
Une ligne du bloc, dont le numéro est donné, n'a pas été comprise et a été ignorée ; le
reste du tableau est correct. Corriger la ligne selon la [syntaxe du bloc](../reference/syntax.md).

**« N écartées » dans le résumé.** Des tâches sont lues mais pas montrées ; un clic donne
chacune et sa raison : coche sans colonne (ajouter `column [-]`…), coche inconnue (`[r]`
n'est pas un statut dot-kanban), au-delà de `limit`, ou masquée par la recherche et les puces.

**« Tâche introuvable ».** La tâche n'a pas été retrouvée dans sa note : son texte a changé
depuis que le tableau l'a lue, ou elle a été supprimée. Rien n'a été écrit. Le tableau se
met à jour seul ; refaire le geste sur la carte rafraîchie.

**« Impossible d'annuler ».** La ligne a changé depuis l'écriture à défaire ; rien n'a été
modifié. La corriger dans la note.

**« Cette tâche se répète (🔁) ».** Terminer une tâche récurrente demande le module Tasks,
qui écrit l'occurrence suivante. Installer Tasks, ou cocher la tâche dans sa note.

## Une tâche n'apparaît pas

Dans l'ordre :

1. Est-ce une case à cocher qu'Obsidian reconnaît ? Une liste sans `[ ]`, ou une tâche dans
   un bloc de code, n'en est pas une.
2. Est-ce une sous-tâche ? Elle compte dans la progression de sa parente, pas comme carte.
3. Le résumé la compte-t-il parmi les écartées ? Sa raison y est.
4. Passe-t-elle les filtres du bloc ? `path`, `tags`, `note.tags`… : tester en retirant les
   lignes une à une. `tags include` porte sur la ligne, `note.tags includes` sur la note.

## Le tableau est lent

Un tableau lit chaque note à tâches de son périmètre, puis seulement celles qui changent.

1. Restreindre le périmètre par une ligne `path` ou `filename` seule (`path includes
   Projets/`) : les autres notes ne sont pas lues. Mêlée à un autre filtre par `OR`, elle
   ne restreint plus la lecture.
2. Plafonner les colonnes qui grossissent sans fin : `column [x] | sort by done reverse |
   limit 20`. Sans `limit`, une cellule dessine 50 cartes et propose d'en montrer plus.

## Une carte ne bouge pas, ou revient

Un geste écrit la note, puis Obsidian la relit et le tableau se recalcule. Si la carte
revient à sa place, un autre outil a réécrit la ligne entre-temps (synchronisation, autre
plugin), ou la note est ouverte dans un éditeur externe qui l'a sauvegardée par-dessus.
Vérifier la ligne dans la note : elle fait foi. Une carte glissée dans sa propre bande de
priorité, ou dans une colonne qui n'est pas triée par priorité, reprend sa place : l'ordre
est calculé par `sort by`.

## Le tableau déborde

Le tableau prend toute la largeur du panneau de la note. Les colonnes ont une largeur
minimale (`width`, 240 px par défaut) : quand elles ne tiennent pas, le tableau défile
horizontalement. Réduire `width`, ou élargir le panneau.

## Un clic sur une carte n'ouvre pas la note

Voulu : un clic sélectionne la carte. Pour ouvrir la note : clic droit → **Ouvrir la note à
côté**, ou `Ctrl`/`Cmd`+clic. Ensuite, tant que cette note reste ouverte
à côté, un simple clic sur une carte y montre sa tâche.

## Où est le bouton `</>` du bloc ?

Dans la barre d'outils du tableau, à gauche de **?**, en lecture comme en aperçu en direct :
il passe la note en édition, curseur sur la première ligne du bloc. Le tableau occupe la
largeur du panneau et recouvrirait le bouton d'Obsidian, qui est masqué.

## Les coches des notes ont un drôle d'air

Le plugin dessine les neuf coches dans les notes. Si le thème les dessine aussi, les deux
se mélangent : désactiver **Paramètres → dot-kanban → Dessiner les coches dans les notes**.

## La console

`Ctrl+Maj+I` (`Cmd+Option+I` sur Mac), onglet **Console**, filtrer sur `dot-kanban`.
Une erreur du plugin y apparaît avec la pile d'appels ; clic droit → **Save as…** pour la
joindre à un rapport, avec la ligne de la tâche concernée et le bloc du tableau. Retirer ce
qui est privé.

## Reproduire hors de son vault

`npm run sandbox` ouvre un Obsidian jetable, avec Tasks et des tableaux d'exemple, sans
toucher à votre profil ni à vos vaults ([tester](test.md)). Y recopier la tâche et le bloc
qui posent problème isole le défaut de votre configuration.
