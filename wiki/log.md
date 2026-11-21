# Wiki Log

Record of every `ingest` run: what changed, why, and which `raw/` source
drove it, grouped under `## YYYY-MM-DD` date headings (ISO 8601) with the
**newest date group first**. Entries are prose bullets, e.g. `* **Update**:
…`, `* **Creation**: …`, `* **Deprecation**: …` — the leading bold word is a
convention, not a requirement.

**Add newest first, never edit or remove a prior entry.** "Newest first"
means a new entry (and, if today isn't already the top group, a new
`## YYYY-MM-DD` heading) is *prepended* above everything else — the
insertion point moves from the bottom to the top, but prepending never
touches a prior entry's text, so the append-only guarantee holds exactly as
before. If a past entry itself needs correcting, add a new entry that says
so; never edit or remove the old one in place. See [schema.md](schema.md) for
the full maintenance schema.

## 2026-11-21

* **Creation**: decisions/0001-consumption-mechanism.md, moved from `docs/decisions/` with OKF frontmatter added; the body is unchanged (#8).
* **Creation**: decisions/index.md, the list of decision records, linked from index.md (#8).
* **Update**: index.md gains a Decisions section that links decisions/index.md (#8).

## 2026-11-13

* **Creation**: schema.md, index.md and log.md, scaffolded from the gvt-wiki `maintain-wiki` templates.
* **Creation**: issue-triage.md, the triage contract, scaffolded from the gvt-dev `triage-issues` structured template.
