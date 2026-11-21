# Decision Records

This directory contains Architecture Decision Records (ADRs) in **MADR-lite** format.

**Template:** the MADR-lite template is bundled in the `gvt-dev` plugin at `plugin/docs/decision-record.template.md`. `gvt-dev:tech-writer` fills it.

**To add or insert a record:** run `/gvt-dev:create-adr`. It handles numbering, chronological insertion and renumbering. Do not hand-number files.

**Location:** the records are wiki pages (`type: decision-context`) in `wiki/decisions/`. `.gvt-agent.json` points `paths['docs/decisions/']` at this folder, so `/gvt-dev:create-adr` writes new records here. Each record opens with frontmatter; its body heading `# NNNN. Title` keeps the number.

## Records

This list is the index of the records. The [wiki index](../index.md) links it.

- [0001](0001-consumption-mechanism.md) - Canonical C3 fixture: standalone repo consumed as a submodule
