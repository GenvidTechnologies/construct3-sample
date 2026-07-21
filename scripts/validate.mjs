#!/usr/bin/env node
/**
 * Canonical-fixture self-validation gate.
 *
 * c3source is the *validator* of this repo, not its owner: it ships no CLI, so
 * this small script drives its library API. Three checks, all hard-failing —
 * any violation prints every failure and exits non-zero (never swallows):
 *
 *   1. JSON well-formedness — BOM-tolerant JSON.parse of every *.json under
 *      project/ (real C3 exports occasionally ship a UTF-8 BOM that JSON.parse
 *      rejects; strip it, mirroring construct3-chef's addonReader BOM fix).
 *   2. Manifest <-> disk consistency — detectManifestDrift(project).inSync.
 *   3. Editor-load validity — validateForEditor(sheet) === [] for every event
 *      sheet (the same structural rules the C3 editor enforces on import).
 *
 * These are NECESSARY BUT NOT SUFFICIENT: c3source's parser is lenient, so a
 * green run does not prove the project loads in the real C3 editor. A manual
 * editor-import checkpoint remains the authority on load validity (see README).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { openProject, detectManifestDrift, validateForEditor } from "@genvidtech/c3source";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..", "project");

/** Strip a leading UTF-8 BOM, then JSON.parse. */
function parseJson(file) {
  const raw = readFileSync(file, "utf-8").replace(/^﻿/, "");
  return JSON.parse(raw);
}

/** Recursively collect every *.json file under `dir`. */
function findJsonFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...findJsonFiles(full));
    else if (entry.endsWith(".json") || entry.endsWith(".c3proj")) out.push(full);
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

if (failures.length > 0) {
  console.error(`construct3-sample validation FAILED (${failures.length} issue(s)):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("construct3-sample validation passed: JSON well-formed, manifest in sync, event sheets editor-valid.");
