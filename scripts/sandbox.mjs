// A disposable Obsidian with this plugin, Tasks and sample boards, left open for trying
// the plugin by hand. Never touches your Obsidian profile or vaults.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchObsidian, makeVault, TASKS_STATUSES } from "./obsidian.mjs";

export const SAMPLE = {
  "Tableau.md": [
    "# Tableau des projets",
    "",
    "```dot-kanban",
    "column [ ] À faire",
    "column [<] Planifié",
    "column [/] En cours",
    "column [x] Fait | sort by done reverse | limit 10",
    "path includes Projets/",
    "```",
    "",
    "## Par personne",
    "",
    "```dot-kanban",
    "column [ ] À faire",
    "column [<] Planifié",
    "column [/] En cours",
    "column [x] Fait",
    "path includes Projets/",
    "group by owner",
    "```",
    "",
  ].join("\n"),
  "Projets/Site web.md": [
    "---",
    "owner: [Alice]",
    "client: ACME",
    "---",
    "## Contenu",
    "- [ ] Rédiger la page d'accueil ⏫ 📅 2026-10-02",
    "    - [x] Plan",
    "    - [x] Titres",
    "    - [ ] Textes",
    "    - [ ] Relecture",
    "    - [ ] Images",
    "- [/] Migrer les articles du blog 🔼 📅 2026-10-20 [owner:: Alice, Bruno]",
    "## Technique",
    "- [<] Choisir l'hébergeur 🔼 📅 2026-10-14 [o:: Bruno]",
    "- [ ] Relire les CGV 📅 2026-10-22 [owner:: ]",
    "## Design",
    "- [/] Maquette mobile ⏫ [owner:: Bruno]",
    "    - [x] Accueil",
    "    - [x] Article",
    "    - [x] Contact",
    "    - [ ] Menu",
    "- [<] Valider le logo avec le client 📅 2026-09-30",
    "- [x] Acheter le domaine ✅ 2026-09-29 [owner:: Bruno]",
    "- [ ] Sauvegarde hebdomadaire 🔁 every week 📅 2026-10-05",
    "",
  ].join("\n"),
  "Coches.md": [
    "# Les neuf coches",
    "",
    "- [ ] to-do",
    "- [/] incomplete",
    "- [x] done",
    "- [-] canceled",
    "- [>] forwarded",
    "- [<] scheduling",
    "- [?] question",
    "- [!] important",
    "- [*] star",
    "",
  ].join("\n"),
  "Projets/ACME.md": [
    "---",
    "title: Client ACME",
    "o: Chloé",
    "---",
    "- [ ] Préparer le devis",
    "- [?] Budget photo : qui le porte ?",
    "- [x] Atelier de lancement ✅ 2026-09-28 [o:: Alice, Chloé]",
    "- [-] Ancienne piste abandonnée",
    "",
  ].join("\n"),
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = mkdtempSync(join(tmpdir(), "dot-kanban-sandbox-"));
  const processes = [];
  const sockets = [];
  const vault = await makeVault(base, SAMPLE, { tasks: true, tasksData: TASKS_STATUSES });
  const { dev, app } = await launchObsidian(base, vault, { processes, sockets, detached: true, name: "sandbox" });
  await dev.eval(`app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath('Tableau.md'),{state:{mode:'preview'}}).then(()=>true)`);
  for (const s of sockets) s.close();

  console.log(`Obsidian est ouvert sur un coffre jetable, avec Tasks réglé sur les neuf statuts (cycle
[ ] → [<] → [/] → [x]) ; la fenêtre reste en place après ce
script.

  Coffre :  ${vault}
  Profil :  ${join(base, "profile")}

À essayer, en ouvrant la note d'une carte (Ctrl+clic, ou clic droit › Ouvrir) pour voir sa ligne
changer :
  1. Glisser une carte d'une colonne à l'autre, puis « Annuler » dans la notification
  2. Cocher « Sauvegarde hebdomadaire » : Tasks écrit l'occurrence suivante
  3. Dans « Par personne », glisser une carte d'un couloir à l'autre : [owner:: …] change
  4. Clic droit sur une carte : priorité, échéance, Ouvrir › Panneau ou Note
  5. « 1 écartée » dans le résumé, le bouton ? de légende, et </> pour modifier le bloc
  6. La note « Coches » : les neuf coches dessinées (réglage du plugin, désactivable)

Arrêter et nettoyer :
  kill ${app.pid}; rm -rf "${base}"
`);
}
