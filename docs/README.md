# Documentation Guide

This directory contains detailed project information that should be loaded only when it is relevant to the task. The root `AGENTS.md` is intentionally short and acts as the context-loading map.

## Read by task

| Task | Read |
| --- | --- |
| Understand the original product requirements | `requirements/Training Log iOS App Spec v2.md` |
| Make a structural or architectural change | `PROTOTYPE_ARCHITECTURE.md` |
| Find the current implementation state or next slice | `PROTOTYPE_STATUS.md` |
| Manage prototype work in the Copilot kanban canvas | `PROTOTYPE_BOARD.json` |
| Change product behavior, data shape, scope, or architecture | `DESIGN_DECISIONS.md` |
| Verify a completed workflow | `PROTOTYPE_ARCHITECTURE.md` acceptance walkthrough |

## Documentation rules

- Do not load every document for every task. Start with `AGENTS.md`, then load only the documents listed for the task.
- Update `docs/PROTOTYPE_STATUS.md` after meaningful implementation or verification work.
- Append meaningful decisions to `docs/DESIGN_DECISIONS.md`; do not silently rewrite history.
- Update `docs/PROTOTYPE_ARCHITECTURE.md` when the prototype boundary, module structure, domain model, or build order changes.
- Keep source documents in their appropriate subdirectory rather than adding more large files to the repository root.

## Copilot kanban board

Open **Training Log Kanban Board** from the Copilot canvas picker. Add work in the form above the board. The four columns remain side by side; scroll horizontally using a trackpad/shift-wheel, the scrollbar at the board's bottom, or its Previous/Next buttons. Move cards by dragging them to another column, or choose a **Destination** from the card's dropdown and click **Move card**. Expand **Edit card** to change its title or description; use **Delete card** to remove it. Changes are saved to `PROTOTYPE_BOARD.json` in this directory. The agent can view and update the same cards with `list-board`, `create-card`, `update-card`, `move-card`, and `delete-card`; open board panels pick up those edits automatically.

## Current documentation map

```text
docs/
├─ README.md                         # this context-loading guide
├─ PROTOTYPE_ARCHITECTURE.md        # current prototype design
├─ PROTOTYPE_STATUS.md              # living implementation status
├─ DESIGN_DECISIONS.md              # append-only decision history
└─ requirements/
   └─ Training Log iOS App Spec v2.md # original product specification
```
