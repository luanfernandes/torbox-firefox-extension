import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const artifactsDir = resolve(root, "web-ext-artifacts");
const releaseDir = resolve(root, "release-artifacts");

function git(args, options = {}) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", ...options });
}

const trackedChanges = git(["status", "--porcelain", "--untracked-files=no"]).trim();
if (trackedChanges) {
  throw new Error("Commit tracked changes before creating release archives so the source ZIP matches the extension ZIP.");
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(root, "src/static/manifest.json"), "utf8"));
if (packageJson.version !== manifest.version) {
  throw new Error(`Version mismatch: package ${packageJson.version}, manifest ${manifest.version}`);
}

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("Run this script through pnpm package:release.");
await rm(artifactsDir, { recursive: true, force: true });
await mkdir(artifactsDir, { recursive: true });
execFileSync(process.execPath, [pnpmCli, "package"], { cwd: root, stdio: "inherit" });

const packageFiles = (await readdir(artifactsDir)).filter((name) => name.endsWith(".zip"));
if (packageFiles.length !== 1) {
  throw new Error(`Expected one packaged extension ZIP, found ${packageFiles.length}.`);
}

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

const version = manifest.version;
const uploadPath = resolve(releaseDir, `torbox-web-helper-${version}-firefox-amo-upload.zip`);
const sourcePath = resolve(releaseDir, `torbox-web-helper-${version}-source.zip`);
await copyFile(resolve(artifactsDir, packageFiles[0]), uploadPath);
git([
  "archive",
  "--format=zip",
  `--prefix=torbox-firefox-extension-${version}/`,
  `--output=${sourcePath}`,
  "HEAD",
]);

const checksumLines = [];
for (const path of [uploadPath, sourcePath]) {
  const hash = createHash("sha256").update(await readFile(path)).digest("hex");
  checksumLines.push(`${hash}  ${basename(path)}`);
}
await writeFile(resolve(releaseDir, "SHA256SUMS.txt"), `${checksumLines.join("\n")}\n`, "utf8");

process.stdout.write(`AMO upload: ${uploadPath}\nSource archive: ${sourcePath}\n`);
