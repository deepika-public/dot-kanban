# Un premier tableau

Cinq minutes, dans un vault d'essai ou le vôtre : une note de projet, un tableau, et les
gestes qui modifient les tâches. Le plugin doit être installé et activé
([installer](../how-to/install.md)) ; Tasks est facultatif.

## 1. Des tâches dans une note

Créer `Projets/Site.md` :

```markdown
---
owner: Alice
---
## Contenu
- [ ] Rédiger la page d'accueil 🔼 📅 2026-12-01
    - [x] Plan
    - [ ] Textes
- [/] Choisir une police [o:: Bob]
- [<] Valider le logo
- [x] Acheter le domaine ✅ 2026-01-15
```

Rien de propre au plugin : des cases à cocher, un champ `[o:: …]` (abréviation de `[owner:: …]`), l'emoji de priorité
et les dates de Tasks.

## 2. Le tableau

Dans une autre note, `Tableau.md` (ou par la commande **Insérer un tableau dot-kanban**) :

````markdown
```dot-kanban
column [ ] À faire
column [<] Planifié
column [/] En cours
column [x] Fait | sort by done reverse
path includes Projets/
```
````

Passer en lecture ou rester en aperçu en direct. Quatre colonnes de même hauteur
apparaissent, chacune avec l'icône et la coche de son statut. « Rédiger la page
d'accueil » montre son échéance, sa progression **1/2**, la pastille **A** en italique
(Alice vient des propriétés de la note, faute de `owner` sur la ligne ; le survol le dit) et le
chemin `Projets/Site.md`. « Choisir une
police » est à Bob.

## 3. Faire avancer une tâche

1. **Glisser** « Rédiger la page d'accueil » vers **En cours**. Dans chaque colonne triée par
   priorité, des bandes apparaissent (la plus haute … aucune … la plus basse) : la déposer
   dans la bande **Moyenne**, la sienne. Dans la note, la ligne devient `- [/] …`.
2. **Annuler** dans la notification : la ligne redevient `- [ ] …`.
3. **Glisser** « Choisir une police » vers le haut de sa colonne, dans la bande **La plus
   haute** : l'emplacement annonce la priorité, la ligne gagne 🔺.
4. Cliquer la **coche** de « Rédiger la page d'accueil » : elle passe dans **Fait**, en tête ;
   la ligne devient `- [x] … ✅ <date du jour>`.
5. **Clic droit** sur une carte → **Priorité** → **Haute** : sa priorité devient ⏫.
6. Au clavier : cliquer une carte, `Espace`, `→`, `Espace` la déplace d'une colonne.

Pour voir chaque ligne changer : **clic droit** sur une carte → **Ouvrir la note à côté**
ouvre `Projets/Site.md` à côté du tableau, curseur sur la tâche (`Ctrl`+clic aussi).
Ensuite, un simple clic sur une autre carte y montre sa tâche.

## 4. Ce qui n'est pas montré

Ajouter `- [-] Ancienne piste` à la note. Le résumé indique **1 écartée** : un clic montre
la tâche et sa raison, sa coche `[-]` n'a pas de colonne. **?** rappelle quelle coche
chaque colonne écrit.

## 5. Par personne

Ajouter `group by owner` au bloc (ou choisir **Group by : owner** dans la barre). Une rangée
par personne apparaît ; glisser une carte de la rangée d'Alice à celle de Bob écrit
`[owner:: Bob]` sur sa ligne.

## Et ensuite

La [syntaxe du bloc](../reference/syntax.md) filtre par dossier, tag, champ ou date et
choisit ce que montrent les cartes ; le [format des tâches](../reference/task-format.md) dit
tout ce que le tableau lit et écrit. Si une carte ne bouge pas : [dépanner](../how-to/troubleshoot.md).
