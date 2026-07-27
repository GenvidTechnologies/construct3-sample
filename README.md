# construct3-sample

The **canonical Construct 3 reference project** for GenvidTechnologies' C3 tooling.

A single, real C3 editor export lives under [`project/`](project/). It is the shared golden
fixture that [construct3-chef](https://github.com/GenvidTechnologies/construct3-chef),
[c3-domain-manager](https://github.com/GenvidTechnologies/c3-domain-manager), and the
[gvt-construct3 plugin](https://github.com/GenvidTechnologies/claude-code-plugin-gvt-construct3)
test against — so their notion of "a C3 project on disk" can't drift apart.

## What this is

`project/` is a faithful C3 export deliberately loaded with the awkward cases real tooling has
to survive:

- nested `objectTypes/` subfolders (`global/`, `images/`, `tiles/`) mirroring the manifest tree;
- a **family** plus a family-member behavior and effect application;
- a Sprite with a nested animation subfolder;
- Tilemap / TiledBackground objects with a `tilemapBrushes/` tree;
- a JPEG-backed object (non-`.png` image extension resolution);
- `.ts` scripts with an SDK `ts-defs/` tree;
- `timelines/` with nested and **unnamed** subfolders (`transitions/`);
- a `System.compare-two-values` condition;
- a **bundled custom behavior** (`MyCompany_MyBehavior`) and a **bundled custom effect**
  (`MyCompany_MyEffect`), both declared in `project.c3proj` `usedAddons` and applied in the project.

**Deliberately *not* included**, and why:

| Excluded | Why |
|---|---|
| a read-surface / `extracted/` rendering | that's a *consumer's* presentation layer (e.g. construct3-chef's DSL/index), versioned with that tool, not canonical C3 data |
| `*.uistate.json` | editor-local state; the C3 editor regenerates it on open and gitignores it on export |

The bar is **provenance**, not file type: everything here originates from the C3 editor or the
official Construct SDK, never hand-authored. That is why the bundled addons' sources *are* included
(below) while a consumer's own rendering is not.

## Bundled addon sources

[`archive-sources/`](archive-sources/) holds the source tree of each addon the project bundles, and
[`scripts/build-archives.mjs`](scripts/build-archives.mjs) packages one into a `.c3addon`. Both are
**verbatim Construct SDK samples**, copied unmodified:

| Addon | SDK source |
|---|---|
| `MyCompany_MyEffect` | `SDK/effect-sdk/sample-tint` |
| `MyCompany_MyBehavior` | `SDK/behavior-sdk/`**`v2`**`/sample-behavior` — the **v2 (TypeScript)** variant; `v1` is the JavaScript one and differs |

A `.c3addon` is **just a zip of the addon's files** — there is no official tool that builds one, and
the editor stores the package you upload as-is. So the container is *not* normative: the two shipped
packages were produced by different zip tools and legitimately differ in entry order, directory
entries, timestamps and version-made-by. What defines an addon is its **content** — the entry-name
set and each entry's bytes — and that is what [`scripts/validate.mjs`](scripts/validate.mjs) checks
each package against its sources.

Two rules when touching any of this:

- **Never edit a copied SDK file.** `MyCompany_MyBehavior/addon.json` keeps its
  `"$schema": "../behavior.addon.schema.json"`, which resolves inside the SDK tree and dangles
  here. It is present byte-for-byte in the shipped package, so "fixing" it would break the gate.
- **Zip entry names must be relative POSIX paths** — forward slashes, no `./` prefix, no leading
  `/`. The editor rejects a package whose entries look like `./aces.json`, yet such a zip unzips
  cleanly with any normal tool, so the failure is silent. `validate.mjs` asserts this on every
  shipped package, hand-made ones included.

`build-archives.mjs` does **not** overwrite `project/addons/**` by default — it builds into
`build/`. Pass `--write` to regenerate a package in place.

## How it's consumed

Each consumer adds this repo as a **git submodule pinned to a tag**, then a small prep script
**materializes a working fixture** its tests run against: the canonical `project/` bytes plus the
consumer's own local delta (an additive overlay + a strip-list for anything it needs removed).
The materialized fixture is gitignored — the submodule stays the single source of the canonical
bytes. See [`docs/decisions/0001-consumption-mechanism.md`](docs/decisions/0001-consumption-mechanism.md)
for the full rationale, and each consumer's own docs for its delta.

## Updating the fixture

When the project changes (a C3 editor upgrade + re-export, or new coverage):

1. **Edit + re-save the project *in the C3 editor*, then export the folder.** The canonical
   `project/` is a straight editor round-trip — do **not** hand-author project JSON. A real editor
   save is what completes half-authored data (e.g. an effect declared in an object's `effectTypes`
   but never given its per-instance `effects` block — the exact defect that made the seed
   non-loadable until it was applied and re-saved in the editor).
2. **Re-apply any curation a plain export can't express** — subtractive/degenerate inputs, or repo
   metadata the export carries from its origin. The current seed's only curation is the project
   `name` (`construct3-sample`), renamed from the `construct3-chef-sample` the export inherited, so
   the canonical fixture isn't named after one consumer.
3. **Run the automated gate** — `npm install && node scripts/validate.mjs` (JSON well-formedness,
   `detectManifestDrift().inSync`, `validateForEditor` clean). CI runs this on every push/PR.
4. **Cross-check addons** — run construct3-chef's `validate-addons --project-dir project` to confirm
   `usedAddons` still matches the bundled `.c3addon` packages.
5. **Manual C3-editor import checkpoint (human).** Import `project/` into the actual Construct 3
   editor and confirm it loads with no errors and the custom addons resolve. **This is required** —
   see the caveat below.
6. **Re-classify new files** — decide canonical vs. consumer-local for anything new, and update the
   consumers' delta/strip-list if the contract moved.
7. **Bump the tag** (see below) and file pin-bump requests on the consumers.

## Versioning

Consumers pin the submodule to a **semver tag**:

- **major** — a structural change that forces consumers to update their overlay/strip-list;
- **minor** — additive fixture content (a new object type, a new addon);
- **patch** — a curation fix that doesn't move the consumer contract.

The C3 editor release the fixture was last saved/validated with (`savedWithRelease`, currently
**r49500**) is recorded as provenance in the tag message and here — not in the tag name (a
content-only fix has no new editor release to bump to).

## A note on validation

The automated gate is **necessary but not sufficient.** c3source's parser is lenient — it types
fields the C3 editor *requires* (e.g. `variable.comment`, `group.description`) as optional — so a
green `validate.mjs` run does **not** prove the project loads in the real editor. The **manual
editor import** (step 5) is the only authority on load validity. Never conclude "faithful" from CI
alone.
