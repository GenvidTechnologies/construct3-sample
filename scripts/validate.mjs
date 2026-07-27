#!/usr/bin/env node
/**
 * Canonical-fixture self-validation gate.
 *
 * c3source is the *validator* of this repo, not its owner: it ships no CLI, so
 * this small script drives its library API. Four checks, all hard-failing —
 * any violation prints every failure and exits non-zero (never swallows):
 *
 *   1. JSON well-formedness — BOM-tolerant JSON.parse of every *.json under
 *      project/ (real C3 exports occasionally ship a UTF-8 BOM that JSON.parse
 *      rejects; strip it, mirroring construct3-chef's addonReader BOM fix).
 *   2. Manifest <-> disk consistency — detectManifestDrift(project).inSync.
 *   3. Editor-load validity — validateForEditor(sheet) === [] for every event
 *      sheet (the same structural rules the C3 editor enforces on import).
 *   4. Addon package <-> archive-sources consistency — every bundled .c3addon
 *      is content-equivalent to a rebuild from its archive-sources/<id>/ tree,
 *      and every entry name is a clean relative POSIX path.
 *
 * These are NECESSARY BUT NOT SUFFICIENT: c3source's parser is lenient, so a
 * green run does not prove the project loads in the real C3 editor. A manual
 * editor-import checkpoint remains the authority on load validity (see README).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { openProject, detectManifestDrift, validateForEditor } from "@genvidtech/c3source";
import { unzipSync } from "fflate";
import { buildAddonArchive, listAddonSources } from "./build-archives.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..", "project");
const ADDONS_ROOT = path.join(PROJECT_ROOT, "addons");

/** Strip a leading UTF-8 BOM, then JSON.parse. */
function parseJson(file) {
  const raw = readFileSync(file, "utf-8").replace(/^﻿/, "");
  return JSON.parse(raw);
}

/**
 * `tsconfig.json` (and variants) is TypeScript tooling config that C3 ships in
 * scripts/ for the project's .ts files — it is JSONC (comments + trailing commas
 * allowed), NOT C3 project data, and C3 never parses it as strict JSON. Exclude
 * it from the well-formedness check rather than mis-flag a valid export artifact.
 */
const JSONC_EXCEPTIONS = /^tsconfig(\..+)?\.json$/;

/** Recursively collect every strict-JSON file under `dir` (C3 data + manifest). */
function findJsonFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...findJsonFiles(full));
    else if ((entry.endsWith(".json") || entry.endsWith(".c3proj")) && !JSONC_EXCEPTIONS.test(entry)) out.push(full);
  }
  return out;
}

const failures = [];

// 1. JSON well-formedness (every *.json + project.c3proj under project/).
for (const file of findJsonFiles(PROJECT_ROOT)) {
  try {
    parseJson(file);
  } catch (err) {
    failures.push(`[json] ${path.relative(PROJECT_ROOT, file)}: ${err.message}`);
  }
}

// 2. Manifest <-> disk consistency.
try {
  const drift = detectManifestDrift(PROJECT_ROOT);
  if (!drift.inSync) {
    failures.push(`[manifest] project.c3proj is out of sync with disk:\n${JSON.stringify(drift, null, 2)}`);
  }
} catch (err) {
  failures.push(`[manifest] detectManifestDrift threw: ${err.message}`);
}

// 3. Editor-load validity for every event sheet.
try {
  const project = openProject(PROJECT_ROOT);
  for (const sheetPath of project.findAllEventSheets()) {
    let issues;
    try {
      issues = validateForEditor(parseJson(sheetPath));
    } catch (err) {
      failures.push(`[editor] ${path.relative(PROJECT_ROOT, sheetPath)}: could not validate: ${err.message}`);
      continue;
    }
    for (const issue of issues) {
      failures.push(`[editor] ${path.relative(PROJECT_ROOT, sheetPath)} ${issue.path} [${issue.rule}]: ${issue.message}`);
    }
  }
} catch (err) {
  failures.push(`[editor] openProject/findAllEventSheets threw: ${err.message}`);
}

// 4. Bundled .c3addon packages <-> their archive-sources/ trees.
//
// A .c3addon is just a zip and there is no official tool to build one, so the
// container is NOT normative — the shipped packages were produced by different
// zip tools and legitimately differ in entry order, directory entries,
// timestamps and version-made-by. Compare CONTENT: the entry-name set and each
// entry's bytes. Also assert entry names are clean relative POSIX paths, since
// the editor rejects e.g. "./aces.json" while any normal unzip tool accepts it —
// that check guards hand-made packages, not just rebuilds.
//
// Deliberately no "no source, skip" escape hatch in either direction: a package
// without sources, or sources never packaged, is exactly the drift this gate
// exists to catch.
const BAD_ENTRY_NAME = /^\.\/|^\/|\\|\/\.\.\//;

/** Recursively collect every bundled `.c3addon` under project/addons/. */
function findAddonPackages(dir) {
  if (!statSyncSafe(dir)?.isDirectory()) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...findAddonPackages(full));
    else if (entry.endsWith(".c3addon")) out.push(full);
  }
  return out;
}

function statSyncSafe(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

try {
  const shippedPackages = findAddonPackages(ADDONS_ROOT);
  const sourceDirs = listAddonSources();
  const built = new Map();

  for (const sourceDir of sourceDirs) {
    try {
      const archive = buildAddonArchive(sourceDir);
      built.set(archive.id, archive);
    } catch (err) {
      failures.push(`[addons] ${path.basename(sourceDir)}: could not build from sources: ${err.message}`);
    }
  }

  const seen = new Set();
  for (const pkgPath of shippedPackages) {
    const rel = path.relative(PROJECT_ROOT, pkgPath).split(path.sep).join("/");
    const id = path.basename(pkgPath, ".c3addon");
    seen.add(id);

    let entries;
    try {
      entries = unzipSync(new Uint8Array(readFileSync(pkgPath)));
    } catch (err) {
      failures.push(`[addons] ${rel}: not a readable zip: ${err.message}`);
      continue;
    }

    const shippedNames = Object.keys(entries).filter((n) => !n.endsWith("/"));
    for (const name of shippedNames.filter((n) => BAD_ENTRY_NAME.test(n))) {
      failures.push(`[addons] ${rel}: entry name is not a clean relative POSIX path: ${JSON.stringify(name)}`);
    }

    const archive = built.get(id);
    if (archive === undefined) {
      failures.push(`[addons] ${rel}: no archive-sources/${id}/ tree — every bundled package must be rebuildable`);
      continue;
    }

    const builtNames = Object.keys(archive.entries);
    for (const name of shippedNames.filter((n) => !builtNames.includes(n))) {
      failures.push(`[addons] ${rel}: entry ${name} is in the package but not in archive-sources/${id}/`);
    }
    for (const name of builtNames.filter((n) => !shippedNames.includes(n))) {
      failures.push(`[addons] ${rel}: entry ${name} is in archive-sources/${id}/ but not in the package`);
    }
    for (const name of shippedNames.filter((n) => builtNames.includes(n))) {
      if (!Buffer.from(entries[name]).equals(archive.entries[name])) {
        failures.push(`[addons] ${rel}: entry ${name} differs from archive-sources/${id}/${name}`);
      }
    }
  }

  for (const id of built.keys()) {
    if (!seen.has(id)) {
      failures.push(`[addons] archive-sources/${id}/ has no bundled package under project/addons/ — build it with \`npm run build-archives -- --write\``);
    }
  }
} catch (err) {
  failures.push(`[addons] addon package check threw: ${err.message}`);
}

if (failures.length > 0) {
  console.error(`construct3-sample validation FAILED (${failures.length} issue(s)):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  "construct3-sample validation passed: JSON well-formed, manifest in sync, event sheets editor-valid, addon packages match their sources.",
);
