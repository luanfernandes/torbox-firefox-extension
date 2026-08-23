import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const extensionId = "torbox-web-helper@luanfernandes.github.io";
const zenBinary = process.argv.slice(2).find((argument) => argument !== "--") || process.env.TORBOX_ZEN_BINARY;
if (!zenBinary) {
  throw new Error("Pass the Zen executable path or set TORBOX_ZEN_BINARY.");
}
const profile = await mkdtemp(join(tmpdir(), "torbox-zen-smoke-"));
const webExt = resolve(root, "node_modules/web-ext/bin/web-ext.js");
const args = [
  webExt,
  "run",
  "--verbose",
  "--source-dir", resolve(root, "dist"),
  "--firefox", zenBinary,
  "--firefox-profile", profile,
  "--profile-create-if-missing",
  "--keep-profile-changes",
  "--pre-install",
  "--no-reload",
  "--no-input",
  "--start-url", "about:blank",
  "--args=-headless",
];

const child = spawn(process.execPath, args, {
  cwd: root,
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (chunk) => { output += String(chunk); });
child.stderr.on("data", (chunk) => { output += String(chunk); });

await new Promise((resolveWait) => setTimeout(resolveWait, 10_000));

let installed = false;
try {
  const extensions = JSON.parse(await readFile(join(profile, "extensions.json"), "utf8"));
  installed = Array.isArray(extensions.addons)
    && extensions.addons.some((addon) => addon.id === extensionId && addon.active !== false);
} catch {
  installed = false;
}

if (child.pid) {
  spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
}
await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });

if (!installed) {
  process.stderr.write(output || "Zen did not record the extension in the isolated profile.\n");
  process.exitCode = 1;
} else {
  process.stdout.write(`Zen loaded ${extensionId} in an isolated headless profile.\n`);
}
