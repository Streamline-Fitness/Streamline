# AGENTS.md

## Repository goal

This repository develops a **web-first interactive prototype** of the Training Log app. It is being built in Windows/VS Code to validate workflow, account access, durable data storage, interaction design, state, timing, and analytics before a native SwiftUI iOS implementation.

This is not the production iOS app and is not intended to become a production web app.

## Context loading

Keep agent context focused. Read this file first, then load only the detailed document needed for the task:

- `docs/README.md` — documentation map and task-based reading guide.
- `docs/requirements/Training Log iOS App Spec v2.md` — original requirements; read when checking product scope or source behavior.
- `docs/PROTOTYPE_ARCHITECTURE.md` — current prototype boundary, domain model, state architecture, screens, build slices, and acceptance walkthrough; read before structural changes.
- `docs/PROTOTYPE_STATUS.md` — current implementation state and next step; read at the start of implementation and update after meaningful work.
- `docs/DESIGN_DECISIONS.md` — decision history and unresolved questions; read before changing behavior, scope, data shape, or architecture and append new decisions when needed.

Do not read every detailed document automatically. Use the task table in `docs/README.md` to choose the smallest relevant context.

## Non-negotiable prototype rules

- Use React, TypeScript, Vite, plain CSS, and a narrow phone-friendly layout.
- Keep source organized by responsibility: pure rules in `src/domain`, state transitions in `src/state`, persistence adapters in `src/storage`, route-level compositions in `src/screens`, reusable presentation modules in `src/ui`, and CSS in `src/styles`.
- Keep domain records close to the future SwiftData models.
- Keep timing, session status, PR, analytics, review, and import rules in pure domain modules.
- Keep UI modules from calculating business rules directly.
- Use a reducer or similarly explicit action interface for state changes.
- Inject current time into timer logic; never model elapsed time by counting interval ticks.
- Use a fast-demo clock for long timers.
- Use Supabase Auth and per-user Postgres row-level security for account-backed data; never treat browser storage as the source of truth.
- Label the application visibly as a prototype.
- Never silently discard, guess, or “clean up” user training data during import.

## Scope boundary

Validate web sign-in, private account data, logging, holds, stretches, rest, editing, undo, session status, summaries, history, review staleness, analytics, safe history migration, and export.

Do not implement real CloudKit/iCloud, Live Activities, WidgetKit, HealthKit, Siri/App Intents, native notifications/haptics, social features, coaching, or nutrition tracking. These are later native iOS concerns.

## Working rules

- Build vertical slices in this order: user-created plans and logging; holds/edit/undo/rest; guided stretches; history/import; review/PRs/analytics; export and prototype notes.
- Favor a complete usable workflow over isolated screens or visual polish.
- Keep prototype code easy to replace. Do not copy it line-for-line into the SwiftUI app.
- When a requirement is unclear, expose the choice and record it rather than hiding an assumption in a screen.
- After meaningful implementation or verification, update `docs/PROTOTYPE_STATUS.md` with the state, verification, and next step.
- When behavior, data shape, scope, or architecture changes, append an entry to `docs/DESIGN_DECISIONS.md`.
- When the module structure, domain model, prototype boundary, or build order changes, update `docs/PROTOTYPE_ARCHITECTURE.md`.

## Definition of useful progress

A change is useful when someone can open the prototype and answer a product question by using it—for example, whether a full user-created session is fast to log, whether hold rounding feels correct, whether undo is obvious, whether stretches feel manageable, whether Sunday review reflects the week, or whether charts answer their stated questions.
