#!/usr/bin/env node
// build-archives.mjs — build a `.c3addon` package from each `archive-sources/<id>/` tree.
//
// A `.c3addon` is just a zip of the addon's files; there is no official build
// tool. The container metadata (entry order, directory entries, timestamps,
// version-made-by) is therefore NOT normative — the shipped packages here were
// produced by different zip tools and legitimately differ in all of it. What
// defines an addon is its *content*: the set of entry names and each entry's
// bytes. `scripts/validate.mjs` compares on exactly that basis.
//
// Because of that, this script does NOT overwrite `project/addons/**` by
// default — there is no reason to churn shipped bytes. It writes to `build/`
// unless `--write` is passed.
//
// Usage:
//   node scripts/build-archives.mjs            # build all sources into build/
//   node scripts/build-archives.mjs --write    # regenerate in project/addons/<kind>/
//
// ENTRY NAMES ARE LOAD-BEARING. Zip entries must be relative POSIX paths —
// forward slashes, no `./` prefix, no leading `/`. The Construct editor rejects
// a package whose entries look like `./aces.json`, and the resulting zip still
// unzips cleanly with any normal tool, so the bug is silent. `toPosixEntryName`
// below is the single place that guarantees this.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES_DIR = path.join(REPO_ROOT, "archive-sources");
const DEFAULT_KIND = "plugin";

// DOS zip timestamps only cover 1980-2099, so the Unix epoch is not valid here.
// A fixed mtime keeps rebuilds from unchanged sources byte-stable.
const FIXED_MTIME = new Date("2020-01-01T00:00:00Z");

/**
 * Normalize a path relative to an addon source root into a zip entry name:
 * relative POSIX, forward slashes, no `./` prefix, no leading `/`, no `..`.
 */
function toPosixEntryName(relPath) {
  const name = relPath.split(path.sep).join("/").replace(/^\.\//, "").replace(/^\/+/, "");
  if (name === "" || name.startsWith("../") || name.includes("/../")) {
    throw new Error(`refusing to emit unsafe zip entry name: ${JSON.stringify(relPath)}`);
  }
  return name;
}

/** Recursively list files under `dir`, as entry names relative to it. */
function listFiles(dir) {
  const out = [];
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, dirent.name);
    if (dirent.isDirectory()) out.push(...listFiles(abs).map((n) => `${dirent.name}/${n}`));
    else out.push(dirent.name);
  }
  return out.sort();
}

/** Real C3-exported `addon.json` ships a UTF-8 BOM, which `JSON.parse` rejects. */
function readJsonStrippingBom(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
}

/**
 * Build one addon package from its source tree.
 *
 * Returns the addon id, its kind (from `addon.json`'s `type`), the zipped
 * bytes, and the raw per-entry content — the latter is what `validate.mjs`
 * compares against a shipped package, since the container is not normative.
 */
export function buildAddonArchive(sourceDir) {
  const id = path.basename(sourceDir);
  const addonJson = path.join(sourceDir, "addon.json");
  if (!fs.existsSync(addonJson)) throw new Error(`${id}: no addon.json in ${sourceDir}`);

  const kind = readJsonStrippingBom(addonJson).type ?? DEFAULT_KIND;

  const entries = {};
  const zipInput = {};
  for (const relPath of listFiles(sourceDir)) {
    const name = toPosixEntryName(relPath);
    const data = fs.readFileSync(path.join(sourceDir, relPath));
    entries[name] = data;
    zipInput[name] = [data, { mtime: FIXED_MTIME }];
  }

  return { id, kind, entries, data: zipSync(zipInput, { mtime: FIXED_MTIME }) };
}

/** Absolute paths of every `archive-sources/<id>/` tree. */
export function listAddonSources() {
  if (!fs.existsSync(SOURCES_DIR)) return [];
  return fs
    .readdirSync(SOURCES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(SOURCES_DIR, d.name))
    .sort();
}

function main() {
  const write = process.argv.includes("--write");
  const sources = listAddonSources();
  if (sources.length === 0) {
    console.error(`no addon sources found under ${path.relative(REPO_ROOT, SOURCES_DIR)}/`);
    process.exitCode = 1;
    return;
  }

  for (const sourceDir of sources) {
    const { id, kind, data } = buildAddonArchive(sourceDir);
    const outDir = write ? path.join(REPO_ROOT, "project", "addons", kind) : path.join(REPO_ROOT, "build", kind);
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `${id}.c3addon`);
    fs.writeFileSync(outFile, data);
    console.log(`built ${id} (${kind}) -> ${path.relative(REPO_ROOT, outFile).split(path.sep).join("/")}`);
  }

  if (!write) {
    console.log("\n(wrote to build/ — pass --write to regenerate in project/addons/)");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
