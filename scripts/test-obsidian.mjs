// Acceptance test in a real Obsidian Desktop, on a disposable vault and profile. Drives
// the board as a user would (pointer drags, clicks, keys, menus) and checks the Markdown
// files on disk after each action. Tasks is installed, first disabled, then enabled.
import { mkdtempSync, readFileSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { launchObsidian, makeVault, shutdown, sleep, until, TASKS_ID, TASKS_STATUSES } from "./obsidian.mjs";

const pad = (n) => String(n).padStart(2, "0");
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const BOARD = [
  "# Board",
  "",
  "```dot-kanban",
  "column [ ]",
  "column [/]",
  "column [?] Clarify",
  "column [x] | sort by done reverse",
  "path does not include Archive/",
  "width 150px",
  "```",
  "",
].join("\n");

const LANES = ["```dot-kanban", "column [ ]", "path includes Projects/", "group by o", "hide path, due", "colum [x]", "```", ""].join("\n");

const ALPHA = [
  "---",
  "title: Alpha project",
  "owner: Carol",
  "---",
  "# Alpha",
  "",
  "- [ ] Plan the launch ⏫ [owner:: Alice, Bob]",
  "- [/] Build the thing",
  "    - [x] Sub done",
  "    - [ ] Sub open",
  "- [?] Ask the client",
  "- [x] Old done ✅ 2026-01-02",
  "- [ ] Water plants 🔁 every week 📅 2026-01-05",
  '- [ ] Read [the spec](https://example.com/spec) <img src=x onerror="window.__pwned=1">',
  "- [-] Dropped",
  "- [r] Mystery",
  "",
].join("\n");

const files = {
  "Board.md": BOARD,
  "Lanes.md": LANES,
  "Projects/Alpha.md": ALPHA,
  "Projects/Windows.md": "- [ ] Crlf task [o:: Dana]\r\n- [ ] Other line\r\n",
  "Archive/Old.md": "- [ ] Archived task\n",
};

const base = mkdtempSync(join(tmpdir(), "dot-kanban-obs-"));
const processes = [];
const sockets = [];
let failed = false;
let dev;
try {
  console.log("Isolated profile and vault:", base);
  // Tasks cycles ` ` → `<` → `/` → `x`: completing a recurring task goes through them.
  const vault = await makeVault(base, files, { tasks: true, tasksData: TASKS_STATUSES });
  const read = (path) => readFileSync(join(vault, path), "utf8");
  ({ dev } = await launchObsidian(base, vault, { processes, sockets }));
  await dev.eval(`app.plugins.disablePlugin('${TASKS_ID}').then(()=>true)`);

  // Helpers living in the page: boards, columns and cards as the user sees them.
  const helpers = `window.__k = {
    board: (i = 0) => document.querySelectorAll('.markdown-reading-view .dot-kanban')[i],
    columns: (i = 0) => Object.fromEntries([...(window.__k.board(i)?.querySelectorAll('.dot-kanban-column') ?? [])].map((c) =>
      [c.dataset.status, [...c.querySelectorAll('.dot-kanban-card-title')].map((t) => t.textContent.trim())])),
    card: (title, i = 0) => [...window.__k.board(i).querySelectorAll('.dot-kanban-card')].find((c) =>
      c.querySelector('.dot-kanban-card-title').textContent.includes(title)),
    notices: () => [...document.querySelectorAll('.notice')].map((n) => n.textContent),
  }; true`;
  const columns = (i = 0) => dev.eval(`window.__k.columns(${i})`);
  const inColumn = (status, title, i = 0) => async () => (await columns(i))[status]?.some((t) => t.includes(title));
  const openBoard = (file = "Board.md") =>
    dev.eval(`(async()=>{const leaf=app.workspace.getLeaf(false);await leaf.setViewState({type:'markdown',state:{file:'${file}',mode:'preview'}});app.workspace.setActiveLeaf(leaf,{focus:true});return true})()`);
  const mouse = (type, x, y, buttons) => dev.call("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons, clickCount: 1 });
  /** A real pointer drag, from the middle of a card's title to the middle of a cell. */
  const drag = async (cardExpr, cellExpr) => {
    await dev.eval(`(${cardExpr}).scrollIntoView({block:'center'}), true`);
    // Reading view renders the sections it scrolls to: let the layout settle first.
    await sleep(500);
    const a = await dev.eval(`(()=>{const r=(${cardExpr}).querySelector('.dot-kanban-card-title').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    // Pick the card up first: priority bands appear then, and move what is below.
    await mouse("mousePressed", a.x, a.y, 1);
    for (let i = 1; i <= 3; i++) await mouse("mouseMoved", a.x + i * 3, a.y, 1);
    await sleep(100);
    const b = await dev.eval(`(()=>{const r=(${cellExpr}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+Math.min(r.height/2,30)}})()`);
    for (let i = 1; i <= 12; i++) await mouse("mouseMoved", a.x + ((b.x - a.x) * i) / 12, a.y + ((b.y - a.y) * i) / 12, 1);
    await sleep(100);
    await mouse("mouseReleased", b.x, b.y, 0);
  };
  const clickUndo = () => dev.eval(`(()=>{const b=[...document.querySelectorAll('.dot-kanban-notice-undo')].pop();b.click();return true})()`);

  await dev.eval(`(()=>{window.__errors=[];const o=console.error;console.error=(...a)=>{window.__errors.push(a.map((x)=>x?.stack??String(x)).join(' ').slice(0,500));o(...a)};
    window.addEventListener('error',(e)=>window.__errors.push(String(e.error?.stack??e.message).slice(0,500)));
    window.addEventListener('unhandledrejection',(e)=>window.__errors.push(String(e.reason?.stack??e.reason).slice(0,500)));return true})()`);
  await openBoard();
  await dev.eval(helpers);
  const first = await until(async () => {
    const c = await columns();
    return c["to-do"]?.some((t) => t.includes("Water plants")) && c;
  }, 30000, "the board");
  assert.deepEqual(Object.keys(first), ["to-do", "incomplete", "question", "done"]);
  assert.deepEqual(first.incomplete, ["Build the thing"]);
  assert.deepEqual(first.question, ["Ask the client"]);
  assert.equal(first["to-do"][0], "Plan the launch [owner:: Alice, Bob]", "priority first; only Tasks emojis leave the title");
  assert.ok(first["to-do"].includes("Crlf task [o:: Dana]") && !JSON.stringify(first).includes("Archived task"), "path filter");
  assert.ok(!JSON.stringify(first).includes("Sub open"), "sub-tasks are not cards");
  console.log("PASS: one column per checkbox, sort, path filter, sub-tasks folded.");

  // Card content: people (inherited or not), progress, note, safe title.
  const card = await dev.eval(`(()=>{const k=window.__k;const plan=k.card('Plan the launch'),build=k.card('Build the thing'),read=k.card('Read');
    return {plan:[...plan.querySelectorAll('.dot-kanban-person')].map(p=>p.getAttribute('aria-label')),
      build:[...build.querySelectorAll('.dot-kanban-person')].map(p=>p.getAttribute('aria-label')),
      inherited:build.querySelector('.dot-kanban-people').classList.contains('is-inherited'),
      progress:build.querySelector('.dot-kanban-meta').textContent, source:build.querySelector('.dot-kanban-card-source').textContent,
      img:!!read.querySelector('img'), pwned:!!window.__pwned, href:read.querySelector('a.external-link')?.getAttribute('href'),
      overdue:k.card('Water plants').querySelector('.dot-kanban-meta.is-overdue')!==null}})()`);
  assert.deepEqual(card, {
    plan: ["Alice", "Bob"],
    build: ["Carol"],
    inherited: true,
    progress: "1/2",
    source: "Projects/Alpha.md",
    img: false,
    pwned: false,
    href: "https://example.com/spec",
    overdue: true,
  });
  console.log("PASS: people, inheritance, progress, source, overdue date, HTML shown as text.");

  // The board's </> opens the block's source; then back to reading.
  await dev.eval(`[...window.__k.board().querySelectorAll('.dot-kanban-icon-button')].find((b)=>/bloc|block/.test(b.getAttribute('aria-label'))).click(), true`);
  await until(() => dev.eval(`(()=>{const e=app.workspace.activeEditor?.editor;return app.workspace.activeLeaf.view.getMode()==='source'&&e&&e.getLine(e.getCursor().line)==='column [ ]'})()`), 5000, "</> in the block's source");
  await openBoard();
  await until(() => dev.eval(`window.__k.board()?.querySelectorAll('.dot-kanban-card').length > 0`), 10000, "the board again");
  console.log("PASS: </> opens the block's source.");

  // The note's own checkboxes: [?] drawn in its color, [/] not crossed out, [x] crossed out.
  await dev.eval(`(async()=>{const leaf=app.workspace.getLeaf(false);await leaf.setViewState({type:'markdown',state:{file:'Projects/Alpha.md',mode:'preview'}});return true})()`);
  const boxes = await until(() => dev.eval(`(()=>{const li=(t)=>[...document.querySelectorAll('.markdown-reading-view li.task-list-item')].find((l)=>l.textContent.includes(t));
    const ask=li('Ask the client'), build=li('Build the thing'), old=li('Old done');
    return ask && {body:document.body.classList.contains('dot-kanban-checkboxes'),
      ask:getComputedStyle(ask.querySelector('input')).backgroundColor, done:getComputedStyle(old.querySelector('input')).backgroundColor,
      build:getComputedStyle(build).textDecorationLine, old:getComputedStyle(old).textDecorationLine}})()`), 10000, "the note's checkboxes");
  assert.ok(boxes.body && boxes.ask !== boxes.done, `[?] has its own color: ${JSON.stringify(boxes)}`);
  assert.ok(!boxes.build.includes("line-through") && boxes.old.includes("line-through"), JSON.stringify(boxes));
  await openBoard();
  await until(() => dev.eval(`window.__k.board()?.querySelectorAll('.dot-kanban-card').length > 0`), 10000, "the board again");
  console.log("PASS: checkboxes drawn in notes.");

  // What is read but not shown is counted and listed with its reason.
  await dev.eval(`window.__k.board().querySelector('.dot-kanban-summary .dot-kanban-link').click(), true`);
  const hidden = await until(() => dev.eval(`[...document.querySelectorAll('.dot-kanban-hidden-item')].map(i=>i.textContent)`), 5000, "hidden list");
  assert.equal(hidden.length, 2);
  assert.ok(hidden.some((h) => h.includes("Dropped")) && hidden.some((h) => h.includes("Mystery")));
  await dev.eval(`document.querySelector('.modal-close-button').click(), true`);
  console.log("PASS: hidden tasks listed with their reason.");

  // Drag a card to another column: the checkbox changes, nothing else.
  // Dropped in the band of its own priority (none): only the checkbox changes.
  await drag(`window.__k.card('Build the thing')`, `window.__k.board().querySelector('.dot-kanban-column[data-status="question"] .dot-kanban-band[data-priority="none"]')`);
  await until(() => read("Projects/Alpha.md").includes("- [?] Build the thing\n"), 10000, "drag written");
  await until(inColumn("question", "Build the thing"), 10000, "drag shown");
  console.log("PASS: a pointer drag changes the checkbox.");

  // The checkbox completes and dates; Undo puts the line back.
  await dev.eval(`window.__k.card('Plan the launch').querySelector('.dot-kanban-check').click(), true`);
  await until(() => read("Projects/Alpha.md").includes(`- [x] Plan the launch ⏫ [owner:: Alice, Bob] ✅ ${today}`), 10000, "check written");
  await until(async () => (await columns()).done?.[0]?.startsWith("Plan the launch"), 10000, "newest done first");
  await clickUndo();
  await until(() => read("Projects/Alpha.md").includes("- [ ] Plan the launch ⏫ [owner:: Alice, Bob]\n"), 10000, "undo written");
  console.log("PASS: check, done date, sort by done reverse, undo.");

  // Right click: the menu's Priority submenu writes the Tasks emoji.
  await dev.eval(`(()=>{const c=window.__k.card('Read');const r=c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:r.left+20,clientY:r.top+10}));return true})()`);
  const item = (pattern) =>
    dev.eval(`(()=>{const i=[...document.querySelectorAll('.menu-item')].find((m)=>${pattern}.test(m.textContent.trim()));if(!i)return false;
      i.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));i.click();return true})()`);
  await until(() => item("/^Priorit/"), 5000, "the Priority item");
  await until(() => item("/^(Haute|High)$/"), 5000, "the High item");
  await until(() => read("Projects/Alpha.md").includes('<img src=x onerror="window.__pwned=1"> ⏫'), 10000, "priority written");
  console.log("PASS: card menu, priority submenu.");

  // Keyboard: Space lifts, → targets the next column, Space drops.
  const key = (title, k) => dev.eval(`(()=>{const c=window.__k.card(${JSON.stringify(title)});c.focus();c.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true}));return true})()`);
  await key("Ask the client", " ");
  await key("Ask the client", "ArrowRight");
  await key("Ask the client", " ");
  await until(() => read("Projects/Alpha.md").includes(`- [x] Ask the client ✅ ${today}`), 10000, "keyboard move written");
  console.log("PASS: keyboard move.");

  // A recurring task waits for Tasks; with Tasks, the next occurrence is written.
  const before = read("Projects/Alpha.md");
  await dev.eval(`window.__k.card('Water plants').querySelector('.dot-kanban-check').click(), true`);
  await until(() => dev.eval(`window.__k.notices().some(n=>n.includes('🔁'))`), 5000, "recurring notice");
  await sleep(300);
  assert.equal(read("Projects/Alpha.md"), before);
  await dev.eval(`app.plugins.enablePlugin('${TASKS_ID}').then(()=>true)`);
  await until(() => dev.eval(`!!app.plugins.plugins['${TASKS_ID}']?.apiV1`), 15000, "Tasks API");
  // Tasks read the suggested statuses: its cycle goes from [ ] to [<].
  assert.equal(await dev.eval(`app.plugins.plugins['${TASKS_ID}'].apiV1.executeToggleTaskDoneCommand('- [ ] a', 'a.md')`), "- [<] a");
  await dev.eval(`window.__k.card('Water plants').querySelector('.dot-kanban-check').click(), true`);
  await until(() => /- \[ \] Water plants 🔁 every week 📅 2026-01-12\n- \[x\] Water plants 🔁 every week 📅 2026-01-05 ✅ \d{4}-\d{2}-\d{2}\n/.test(read("Projects/Alpha.md")), 10000, "recurrence written by Tasks");
  console.log("PASS: recurring tasks: refused without Tasks, next occurrence with it, through Tasks' cycle.");

  // Lanes: errors listed with a suggestion; a drag to another lane rewrites `to`, CRLF kept.
  await openBoard("Lanes.md");
  await until(() => dev.eval(`window.__k.board()?.querySelectorAll('.dot-kanban-lane').length >= 4`), 15000, "the lanes");
  const errors = await dev.eval(`window.__k.board().querySelector('.dot-kanban-errors')?.textContent`);
  assert.match(errors, /colum/);
  assert.match(errors, /column/);
  const lanes = await dev.eval(`[...window.__k.board().querySelectorAll('.dot-kanban-lane-label')].map(l=>l.textContent)`);
  assert.deepEqual(lanes.slice(0, 4), ["Alice", "Bob", "Carol", "Dana"]);
  await drag(
    `[...window.__k.board().querySelectorAll('.dot-kanban-card')].find(c=>c.textContent.includes('Crlf task'))`,
    `[...window.__k.board().querySelectorAll('.dot-kanban-lane')].find(l=>l.textContent.includes('Carol')).querySelector('.dot-kanban-cell[data-column="0"] .dot-kanban-band[data-priority="none"]')`,
  );
  await until(() => read("Projects/Windows.md") === "- [ ] Crlf task [owner:: Carol]\r\n- [ ] Other line\r\n", 10000, "lane drag written");
  console.log("PASS: block errors, lanes by person, drag between lanes, CRLF kept.");
  await openBoard();

  const lineOf = (text) => read("Projects/Alpha.md").split("\n").findIndex((l) => l.includes(text));
  // A change made outside Obsidian reaches the board.
  await openBoard();
  appendFileSync(join(vault, "Projects/Alpha.md"), "- [ ] Added from outside\n");
  await until(inColumn("to-do", "Added from outside"), 15000, "external change");
  writeFileSync(join(vault, "Projects/Alpha.md"), read("Projects/Alpha.md").replace("Added from outside", "Renamed outside"));
  await until(inColumn("to-do", "Renamed outside"), 15000, "external edit");
  console.log("PASS: external changes are followed.");

  // An edit in an open note shows on the board before Obsidian saves the note.
  const editLine = lineOf("Renamed outside");
  await dev.eval(`(async()=>{const leaf=app.workspace.getLeaf('split');await leaf.setViewState({type:'markdown',state:{file:'Projects/Alpha.md',mode:'source',source:false}});
    leaf.view.editor.setLine(${editLine}, '- [/] Renamed outside');return true})()`);
  const started = Date.now();
  await until(inColumn("incomplete", "Renamed outside"), 3000, "the board following the editor");
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 1500 && read("Projects/Alpha.md").includes("- [ ] Renamed outside"), `followed in ${elapsed} ms, before the save`);
  await until(() => read("Projects/Alpha.md").includes("- [/] Renamed outside"), 5000, "the editor's save");
  await dev.eval(`app.workspace.getLeavesOfType('markdown').filter((l)=>l.view.file?.path!=='Board.md').forEach((l)=>l.detach()), true`);
  console.log(`PASS: an edit in an open note shows on the board in ${elapsed} ms, before the save.`);

  // A drag into a priority band of the same column writes the priority.
  await drag(`window.__k.card('Renamed outside')`, `window.__k.board().querySelector('.dot-kanban-column[data-status="incomplete"] .dot-kanban-band[data-priority="highest"]')`);
  await until(() => read("Projects/Alpha.md").includes("- [/] Renamed outside 🔺"), 10000, "the band's priority written");
  // The note is written first, the board drawn again a moment later.
  await until(() => dev.eval(`window.__k.board().querySelectorAll('.dot-kanban-band').length === 0`), 2000, "bands only while dragging");
  console.log("PASS: a drag into a priority band writes the priority.");

  // Toolbar: search, case and accent-insensitive, applied once the typing pauses.
  await dev.eval(`(()=>{const i=window.__k.board().querySelector('.dot-kanban-search input');i.value='CRLF';i.dispatchEvent(new Event('input'));return true})()`);
  await until(async () => (await columns())["to-do"]?.length === 1, 5000, "the search applied");
  assert.deepEqual((await columns())["to-do"], ["Crlf task [owner:: Carol]"]);
  await dev.eval(`(()=>{const i=window.__k.board().querySelector('.dot-kanban-search input');i.value='';i.dispatchEvent(new Event('input'));return true})()`);
  await until(async () => (await columns())["to-do"]?.length > 1, 5000, "the search cleared");
  console.log("PASS: search.");

  // A click only selects the card while no note is open alongside; right click › Open the
  // note alongside opens it in a split next to the board, cursor on the task; then a click
  // on another card shows its task there; Ctrl+click reuses that split.
  const leaves = () =>
    dev.eval(`app.workspace.getLeavesOfType('markdown').map((l)=>l.view.file?.path)`);
  await dev.eval(`window.__k.card('Old done').querySelector('.dot-kanban-card-source').click(), true`);
  await sleep(500);
  assert.ok(!(await leaves()).includes("Projects/Alpha.md"), "a click opens nothing");
  assert.ok(await dev.eval(`window.__k.card('Old done').classList.contains('is-focused')`), "a click selects the card");
  await dev.eval(`(()=>{const c=window.__k.card('Old done');const r=c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:r.left+20,clientY:r.top+10}));return true})()`);
  await until(() => item("/^(Ouvrir la note à côté|Open the note alongside)$/"), 5000, "the Open item");
  const alongside = () =>
    dev.eval(`(()=>{const l=app.workspace.getLeavesOfType('markdown').find(l=>l.view.file?.path==='Projects/Alpha.md');
      return l && {line:l.view.editor.getCursor().line,board:!!window.__k.board(),leaves:app.workspace.getLeavesOfType('markdown').length}})()`);
  await until(async () => (await alongside())?.line === lineOf("Old done"), 5000, "the cursor on the task").catch(() => {});
  assert.deepEqual(await alongside(), { line: lineOf("Old done"), board: true, leaves: 2 });
  await dev.eval(`window.__k.card('Ask the client').querySelector('.dot-kanban-card-source').click(), true`);
  await until(async () => (await alongside())?.line === lineOf("Ask the client"), 5000, "the note following the click");
  await dev.eval(`window.__k.card('Build the thing').querySelector('.dot-kanban-card-source').dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true,metaKey:true})), true`);
  await until(async () => (await alongside())?.line === lineOf("Build the thing"), 5000, "Ctrl+click in the same split");
  assert.equal((await alongside()).leaves, 2, "one note alongside, reused");
  console.log("PASS: click selects, then follows alongside; Open the note alongside; Ctrl+click reuses the split.");
  // Back to the board alone: close the notes the gestures opened.
  await dev.eval(`app.workspace.getLeavesOfType('markdown').filter((l)=>l.view.file?.path!=='Board.md').forEach((l)=>l.detach()), true`);
  await openBoard();
  await until(() => dev.eval(`!!window.__k.board()`), 10000, "the board again");

  // Renaming a note keeps its cards writable.
  await dev.eval(`app.fileManager.renameFile(app.vault.getAbstractFileByPath('Projects/Windows.md'),'Projects/Renamed.md').then(()=>true)`);
  await until(async () => (await dev.eval(`window.__k.card('Crlf task')?.querySelector('.dot-kanban-card-source')?.textContent`)) === "Projects/Renamed.md", 10000, "rename");
  await dev.eval(`window.__k.card('Crlf task').querySelector('.dot-kanban-check').click(), true`);
  await until(() => read("Projects/Renamed.md").startsWith(`- [x] Crlf task [owner:: Carol] ✅ ${today}\r\n`), 10000, "write after rename");
  console.log("PASS: renamed notes stay writable.");
  console.log("ALL PASS");
} catch (error) {
  failed = true;
  console.error(error);
  const shown = await dev
    ?.eval(`JSON.stringify([...(document.querySelectorAll('.markdown-reading-view .dot-kanban') ?? [])].map((b) => b.innerText.replace(/\\s+/g, " ").slice(0, 600)))`)
    .catch(() => null);
  if (shown) console.error("Boards:", shown);
  const state = await dev
    ?.eval(`JSON.stringify({leaves:app.workspace.getLeavesOfType('markdown').map((l)=>[l.view.file?.path,l.view.getMode()]),
      modals:[...document.querySelectorAll('.modal-container')].map((m)=>m.innerText.slice(0,120)),
      plugins:[...app.plugins.enabledPlugins], loaded:Object.keys(app.plugins.plugins), dot-kanban:document.querySelectorAll('.dot-kanban').length, errors:window.__errors,
      reading:[...document.querySelectorAll('.markdown-reading-view')].map((r)=>r.innerText.slice(0,200))})`)
    .catch(() => null);
  if (state) console.error("Obsidian:", state);
  const shot = await dev?.call("Page.captureScreenshot", { format: "png" }).catch(() => null);
  if (shot) {
    writeFileSync(join(base, "failure.png"), Buffer.from(shot.data, "base64"));
    console.error("Screenshot:", join(base, "failure.png"));
  }
  console.error("Kept for inspection:", base);
} finally {
  await shutdown(processes, sockets);
  if (!failed && !process.env.KEEP) rmSync(base, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
