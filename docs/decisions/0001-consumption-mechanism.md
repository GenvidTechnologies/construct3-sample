# 0001. Canonical C3 fixture: standalone repo consumed as a submodule

- **Status:** Accepted
- **Date:** 2026-07-21
- **Issues:** [c3source#51](https://github.com/GenvidTechnologies/c3source/issues/51),
  [construct3-chef#130](https://github.com/GenvidTechnologies/construct3-chef/issues/130)

## Context

Multiple GenvidTechnologies tools operate on Construct 3 projects on disk —
[construct3-chef](https://github.com/GenvidTechnologies/construct3-chef) (edits
projects and renders a read-surface), [c3-domain-manager](https://github.com/GenvidTechnologies/c3-domain-manager)
(domain analysis), and the [gvt-construct3 plugin](https://github.com/GenvidTechnologies/claude-code-plugin-gvt-construct3).
Each needs a realistic C3 project to test against, but only construct3-chef had
one (`test/fixtures/construct3-chef-sample/`, the fullest real export). With the
fixture living inside one consumer, the others either had no fixture or would
copy it, and every copy is free to drift — so the tools' shared notion of "what a
C3 project looks like on disk" had no single owner.

The goal is one **canonical** C3 project, versioned independently, that every tool
consumes without drift — while still letting each tool keep the small, tool-specific
tweaks its own tests need.

## Decision

**A standalone repo (`construct3-sample`) holding the canonical C3 project, consumed
by each tool as a git submodule pinned to a tag. c3source is the validator, not the
owner. Each consumer materializes its working fixture from the submodule plus a local
delta.**

Concretely:

- **The canonical bytes live here**, under `project/`, as a faithful C3 editor export.
  The boundary is **provenance, not file type**: this repo owns artifacts originating from
  the C3 editor or the official Construct SDK — never hand-authored data, and never a
  *consumer's* own rendering/read-surface. Verbatim SDK addon sources and the script that
  zips them into a `.c3addon` are therefore in scope; construct3-chef's `extracted/` DSL
  rendering is not.
- **Consumers add this repo as a submodule** pinned to a semver **tag** (not a moving
  branch), so a fixture change is an explicit, reviewable pin bump.
- **Each consumer runs a prep script** that materializes a **gitignored** working fixture:
  the canonical `project/` bytes + the consumer's own **additive overlay** and **strip-list**
  (subtractive changes — degenerate/test-only inputs — that can't be expressed as additions).
  The submodule stays the single source of the canonical bytes; the consumer's delta stays
  small and lives in the consumer repo.
- **c3source validates, it does not own.** c3source's library (`validateForEditor`,
  `detectManifestDrift`) backs this repo's CI gate ([`scripts/validate.mjs`](../../scripts/validate.mjs)),
  but the fixture is not vendored into c3source and c3source does not gate its releases on it.
- **A manual C3-editor import remains the authority on load validity** — CI can check
  structural/editor-load rules but cannot perform a real editor round-trip.

### Rejected alternatives

- **Keep the fixture inside construct3-chef; other tools copy it.** The status quo.
  Rejected: no single owner, so every copy drifts, which is exactly the problem.
- **Publish the fixture as an npm package** the consumers depend on. Rejected: npm is
  for code, not a multi-file project tree with binary assets; pinning + materialization is
  clumsier than a submodule, and it would pull test data into production dependency graphs.
- **Vendor a tarball** into each consumer. Rejected: a tarball is opaque to review and
  re-introduces per-consumer copies (the drift problem) with worse diffability than a
  submodule at a pinned SHA/tag.
- **c3source owns the fixture.** Rejected: c3source is the schema/validator layer; owning
  a large binary-bearing fixture would couple its release cadence to fixture edits and blur
  the validator-vs-owner boundary. c3source validates the canonical fixture; it doesn't house it.

## Consequences

- One canonical project, versioned on its own cadence; consumers opt into changes by moving
  a pin, not by absorbing silent drift.
- Each consumer keeps a small, explicit local delta instead of a full fork of the fixture.
- Bootstrapping cost: consumers must wire a submodule + a prep script (tracked per consumer;
  construct3-chef is the prototype — [construct3-chef#130](https://github.com/GenvidTechnologies/construct3-chef/issues/130)).
- Validation is partly manual: the automated gate is necessary but not sufficient, so a human
  editor-import checkpoint is part of the update protocol (see the repo README).
- The fixture temporarily exists in two places — here and in construct3-chef's in-tree copy —
  until each consumer migrates to the submodule. Until then a manual sync discipline applies.
- **Bundled addon sources came in-scope under the provenance reading**
  ([construct3-chef#139](https://github.com/GenvidTechnologies/construct3-chef/issues/139)).
  The original wording excluded "fixture-build tooling" outright, which read as a file-type
  whitelist; the actual bar is where an artifact comes from. Both bundled addons are verbatim
  Construct SDK samples, so `archive-sources/` and `scripts/build-archives.mjs` now live here
  rather than in a consumer, and `scripts/validate.mjs` gained a check that every shipped
  `.c3addon` still matches its sources — a guarantee no repo previously made. This also ends
  the drift risk of a consumer keeping its own copy of the same sources.
- A `.c3addon` is just a zip and no official tool builds one, so the **container is not
  normative** — the shipped packages were made by different zip tools and differ in entry
  order, directory entries and timestamps. The gate therefore compares **content** (entry-name
  set + per-entry bytes), not bytes of the archive. See the README for the two standing rules
  (never edit a copied SDK file; entry names must be relative POSIX paths).
