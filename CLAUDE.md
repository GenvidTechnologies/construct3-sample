# CLAUDE.md

## Purpose

This repository holds the canonical Construct 3 reference project under `project/`. Other GenvidTechnologies tools test against it as a git submodule. `README.md` gives the full rules: provenance, the bundled addon sources, third-party assets, how the fixture is updated, and versioning. Read it before any change under `project/` or `archive-sources/`.

## Validate

```
npm install
npm run validate
```

`npm run validate` runs `scripts/validate.mjs`. It checks the JSON, the manifest against the disk, the event sheets against the editor rules, and each bundled `.c3addon` against its sources. A green run does not prove that the project loads in the Construct 3 editor. The manual import checkpoint in `README.md` ("Updating the fixture", step 5) stays required.

A change that touches only `wiki/`, `CLAUDE.md`, `README.md` or `.gvt-agent.json` does not change what the gate checks.

## Documentation

The wiki (`wiki/`, `wiki.wikiDir` in `.gvt-agent.json`) is the documentation home. `wiki/index.md` lists the pages, `wiki/log.md` records changes to the page set, and `wiki/schema.md` holds the rules.

`docs/decisions/` still holds ADR 0001. Moving it into the wiki is #8.

## Issue triage

The triage contract is `wiki/issue-triage.md`, from the structured template. The `bugTracker` block in `.gvt-agent.json` holds the queries; each one passes `--repo GenvidTechnologies/construct3-sample`.

Labels on the tracker:

- `type:bug`, `type:crash`, `type:regression`: defects only. A docs, enhancement or chore issue has no `type:*` label and keeps its category label (`documentation`, `enhancement`).
- `priority/P0` to `priority/P3`: exactly one per triaged issue.
- `area:project` (the C3 export under `project/`), `area:addons` (the bundled addon sources), `area:tooling` (`scripts/`, `package.json`, CI), `area:docs` (README, wiki, decisions).
- `needs-info` and `triaged`.

The contract names a `chore` category label that the tracker does not have. Create it before the first chore issue.

## Commits

- Subject line in the Conventional Commits form used by the history (`feat:`, `fix:`, `docs:`).
- The body explains why, not what.
