# Figma File Cleanup — Team Quickstart

A reusable, on-demand Codex skill for organizing existing Figma Design files. Paste a file link, answer any missing status questions, and the workflow cleans the sidebar and canvases. It does not create a recurring background job.

## Set up once per teammate

1. Share `figma-file-cleanup.zip` with the teammate.
2. Ask Codex: “Install the attached figma-file-cleanup skill for me.” The package contains a standard skill folder with `SKILL.md`, UI metadata, and an operations reference. A manual installation places that folder under the teammate's Codex skills directory (`$CODEX_HOME/skills`, or `~/.codex/skills` by default).
3. Make the Figma plugin and its read/write tools available, with access to the target file. The workflow uses the Figma plugin's current skills and API documentation. A read-only Figma connection cannot execute cleanup.
4. Start a new task if the installed skill is not yet available in the current task's skill list.

The skill is already installed locally for the person who requested this package. Installation for other teammates and their Figma access still need to be set up.

## Start a cleanup

Use this prompt:

> Use $figma-file-cleanup on this file: [Figma URL]. Clean up the sidebar and canvases for handover. Ask me about any design statuses you cannot establish.

If known, include the following upfront:

- Current live frame: [link]
- Approved but not implemented: [link, or none]
- Active experimental page: [link, or none]
- Pages that must retain their URLs or remain untouched: [list, or none]

The agent inspects first, asks targeted questions, then performs authorized cleanup. Unknown design status stays unknown. It will not infer that the newest or “Final” frame is the live design.

## Smaller scopes

> Use $figma-file-cleanup on [URL]. Sidebar only: improve names, categories, and ordering. Do not move designs between pages.

> Use $figma-file-cleanup on [URL]. Audit only; suggest consolidation without editing.

## Multiple files

> Use $figma-file-cleanup on these files: [URLs]. Start with the first file and reuse the six-category convention across the rest. Confirm live/approved/experimental references separately where unclear.

The agent keeps per-file checkpoints in the task workspace and verifies each file before advancing. Very large batches can be handled in smaller task-sized groups using the same skill. Access to one file does not authorize editing every file in the team.

## Default sidebar

- 🏠 Current designs — live and approved-but-unimplemented pages remain distinct.
- 🧪 Explorations — current concepts and studies.
- 🎨 Feature designs — related flows and states grouped by feature.
- 🧩 Components — existing reusable assets.
- 🔍 Research — investigations and evidence.
- 🗂️ History — older references and archives.

Categories use numbered empty divider pages. Empty categories may be omitted. Closely related pages are merged into named sections, while existing designs and prototype dependencies are preserved. The workflow should arrange existing content rather than add overview documents or redundant labels.

## What to check in the result

Look for a shorter sidebar, meaningful names, distinct live/approved references, and readable screen groups. The agent should report completed changes, affected destination links, unresolved status, and what it verified.

Moving existing nodes preserves their IDs where supported. Removing a merged source page changes page-level links; ask to retain a page if its URL is important. Prototype-start preservation is a structural check, not proof that every interaction was played through.

## Validation status

This package was checked with the skill-creator structural validator and reviewed against the workflow developed in the source cleanup task. It has not yet been independently trialed as an installed skill on another team's file. Pilot it on one representative file before applying it broadly.
