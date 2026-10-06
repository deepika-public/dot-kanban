// Disposable Obsidian Desktop instances driven over the Chrome DevTools Protocol, for
// the desktop test and the sandbox. Each one has its own profile and vault under a
// temporary folder: it never attaches to a running Obsidian nor opens the user's vaults.
import { mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createHash } from "node:crypto";

export const pluginRoot = fileURLToPath(new URL("../", import.meta.url));
export const PLUGIN_ID = "dot-kanban";
export const TASKS_ID = "obsidian-tasks-plugin";

// The Tasks release the harness runs against, pinned by content. dot-kanban works without it;
// with it, recurring tasks can be completed from the board.
const TASKS = {
  version: "8.4.0",
  files: {
    "main.js": "c1e3333bce3fee7c1a06397ea2989cd27e1659cc30795c53ed5a60e7941e48fa",
    "manifest.json": "499cfa146ba9cbdd70ccfc9d16b6b6cbfb4243158d14335b2b336259e867c33f",
    "styles.css": "3b2ca53d3b74162b5899b251d18b695f532546181ebaed6354befbe72c29935d",
  },
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function until(fn, ms = 30000, what = "condition") {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      last = e;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${what}${last ? `: ${last.message}` : ""}`);
}

/**
 * The Tasks plugin folder: `TASKS_DIR` if set, else the pinned release, downloaded once
 * into ~/.cache/dot-kanban and checked by SHA-256.
 */
export async function tasksDir() {
  if (process.env.TASKS_DIR) return process.env.TASKS_DIR;
  const dir = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "dot-kanban", `tasks-${TASKS.version}`);
  mkdirSync(dir, { recursive: true });
  for (const [name, sum] of Object.entries(TASKS.files)) {
    const path = join(dir, name);
    if (!existsSync(path)) {
      const url = `https://github.com/obsidian-tasks-group/obsidian-tasks/releases/download/${TASKS.version}/${name}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Cannot download ${url}: HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== sum) throw new Error(`${url}: SHA-256 ${actual}, expected ${sum}`);
      writeFileSync(path, bytes);
    }
    const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
    if (actual !== sum) throw new Error(`${path} does not match the pinned Tasks ${TASKS.version}; delete it`);
  }
  return dir;
}

/** The Tasks settings dot-kanban suggests: its nine statuses, cycling ` ` → `/` → `x` → ` `. */
export const TASKS_STATUSES = JSON.parse(readFileSync(new URL("../docs/how-to/tasks-statuses.json", import.meta.url), "utf8"));

/** A vault with `files` ({ relative path: content }), this plugin and, if asked, Tasks with `tasksData`. */
export async function makeVault(home, files, { tasks = false, tasksData = null } = {}) {
  const vault = join(home, "vault");
  const plugins = join(vault, ".obsidian", "plugins");
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(vault, path)), { recursive: true });
    writeFileSync(join(vault, path), content);
  }
  const installed = [[PLUGIN_ID, pluginRoot]];
  if (tasks) installed.push([TASKS_ID, await tasksDir()]);
  for (const [id, from] of installed) {
    mkdirSync(join(plugins, id), { recursive: true });
    for (const file of ["main.js", "manifest.json", "styles.css"]) {
      if (!existsSync(join(from, file))) throw new Error(`${join(from, file)} is missing; run npm run build`);
      copyFileSync(join(from, file), join(plugins, id, file));
    }
  }
  if (tasks && tasksData) writeFileSync(join(plugins, TASKS_ID, "data.json"), JSON.stringify(tasksData));
  writeFileSync(join(vault, ".obsidian", "community-plugins.json"), JSON.stringify(installed.map(([id]) => id)));
  writeFileSync(join(vault, ".obsidian", "app.json"), JSON.stringify({ safeMode: false, livePreview: true }));
  return vault;
}

async function freePort() {
  const s = createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const port = s.address().port;
  await new Promise((r) => s.close(r));
  return port;
}

async function devtools(port, sockets) {
  const pages = await until(async () => {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    return list.some((x) => x.type === "page") && list;
  }, 30000, "the Obsidian window");
  const ws = new WebSocket(pages.find((p) => p.type === "page").webSocketDebuggerUrl);
  sockets.push(ws);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const request = ++id;
      const timer = setTimeout(() => {
        pending.delete(request);
        reject(new Error("CDP timeout: " + method));
      }, 15000);
      pending.set(request, {
        resolve: (v) => (clearTimeout(timer), resolve(v)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
      ws.send(JSON.stringify({ id: request, method, params }));
    });
  return {
    call,
    eval: async (expression) => {
      const r = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
      return r.result.value;
    },
  };
}

/**
 * Starts Obsidian on `vault` with a fresh profile under `home`, trusts the vault and
 * enables the vault's plugins. Returns the DevTools handle and the process;
 * `detached` leaves the window open after the script ends.
 */
export async function launchObsidian(home, vault, { processes, sockets, name = "kanban", detached = false }) {
  const profile = join(home, "profile");
  mkdirSync(profile, { recursive: true });
  writeFileSync(join(profile, "obsidian.json"), JSON.stringify({ vaults: { [name]: { path: vault, ts: Date.now(), open: true } } }));
  const port = await freePort();
  const app = spawn(
    process.env.OBSIDIAN_BINARY || "/usr/bin/obsidian",
    [
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${port}`,
      "--remote-debugging-address=127.0.0.1",
      "--no-sandbox",
      // A window behind others must keep rendering: reading view draws on animation frames.
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
    ],
    { stdio: ["ignore", "ignore", detached ? "ignore" : "pipe"], detached },
  );
  processes.push(app);
  // A detached window outlives the script that opened it.
  if (detached) app.unref();
  else app.stderr.on("data", (b) => writeFileSync(join(home, "obsidian.stderr"), b, { flag: "a" }));
  const dev = await devtools(port, sockets);
  // A window behind others draws no frame, and reading view renders on frames: keep the
  // test window in front and its page active.
  await dev.call("Page.bringToFront").catch(() => {});
  await dev.call("Page.setWebLifecycleState", { state: "active" }).catch(() => {});
  await dev.call("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
  await until(() => dev.eval('typeof app !== "undefined" && !!app.workspace?.layoutReady'), 60000, "the workspace");
  // The vault trust modal can appear late and follows the system language.
  await until(
    () =>
      dev.eval(
        `(()=>{const b=[...document.querySelectorAll('button')].find(b=>/Trust author and enable plugins|Faites confiance/.test(b.textContent));b?.click();return !!b})()`,
      ),
    5000,
  ).catch(() => {});
  await sleep(500);
  const ids = JSON.parse(readFileSync(join(vault, ".obsidian", "community-plugins.json"), "utf8"));
  await dev.eval(
    `(async()=>{for(const id of ${JSON.stringify(ids)})if(!app.plugins.enabledPlugins.has(id))await app.plugins.enablePluginAndSave(id);return true})()`,
  );
  await until(() => dev.eval(`${JSON.stringify(ids)}.every((id)=>!!app.plugins.plugins[id])`), 30000, "the plugins");
  return { dev, app };
}

/** Stops what the harness started, politely then not. */
export async function shutdown(processes, sockets) {
  for (const s of sockets) s.close();
  for (const p of processes) p.kill("SIGTERM");
  await sleep(300);
  for (const p of processes) if (p.exitCode === null && p.signalCode === null) p.kill("SIGKILL");
}
