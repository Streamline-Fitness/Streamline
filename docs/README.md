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

Open **Training Log Work List** from the Copilot canvas picker. Work is shown in a single, searchable list grouped by status, so no sideways scrolling is needed. The Done section starts collapsed; expand or collapse any status section as needed. Drag cards between sections to change status. **Work with Copilot** and **Add a work item** are collapsible to leave more room for the list. Wait until Copilot finishes its current response before sending a discussion or implementation request; the current session must be idle. Use the Copilot discussion to refine scope, dependencies, and done criteria; it does not add a card automatically, and its transcript lasts only for that open canvas instance. If a discussion request fails or Copilot returns no text, the error is shown and the message remains in the composer so you can retry. Each card's **Implement** button sends its title and description to Copilot as an implementation request and moves it to **In progress**. Expand **Edit card** to change its title or description; use **Delete card** to remove it. Changes are saved to `PROTOTYPE_BOARD.json` in this directory. The agent can view and update the same cards with `list-board`, `create-card`, `update-card`, `move-card`, and `delete-card`; open work lists pick up those edits automatically.

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
