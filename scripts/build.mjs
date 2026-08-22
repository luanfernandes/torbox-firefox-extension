import { build, context } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outdir = resolve(root, "dist");
const watch = process.argv.includes("--watch");

const entryPoints = {
  background: resolve(root, "src/background/index.ts"),
  scanner: resolve(root, "src/scanner/index.ts"),
  popup: resolve(root, "src/popup/index.ts"),
  batch: resolve(root, "src/batch-page/index.ts"),
  settings: resolve(root, "src/settings/index.ts"),
};

async function copyStatic() {
  await mkdir(outdir, { recursive: true });
  await cp(resolve(root, "src/static"), outdir, { recursive: true });
}

const options = {
  entryPoints,
  bundle: true,
  entryNames: "[name]",
  format: "iife",
  target: "firefox142",
  outdir,
  sourcemap: false,
  minify: false,
  logLevel: "info",
};

await rm(outdir, { recursive: true, force: true });
await copyStatic();

if (watch) {
  const buildContext = await context(options);
  await buildContext.watch();
  console.log("Watching extension sources...");
} else {
  await build(options);
}
