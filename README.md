# Training Log Prototype

> **PROTOTYPE — web-first validation, not the production iOS app.**

Training Log is a web-first prototype for exploring the workflow, account access, and durable data model of a future Training Log app. It uses Supabase Auth for email/password sign-in and stores each signed-in user's versioned training document in Postgres protected by row-level security.

The web prototype uses React, TypeScript, Vite, plain CSS, and Supabase. It is not the production iOS app and does not connect to iCloud, HealthKit, or other native iOS services.

## Contents

- [What is implemented](#what-is-implemented)
- [Quick start](#quick-start)
- [Using the prototype](#using-the-prototype)
- [How data works](#how-data-works)
- [Project structure](#project-structure)
- [Technology choices](#technology-choices)
- [Prototype scope](#prototype-scope)
- [Current status and next steps](#current-status-and-next-steps)
- [Development workflow](#development-workflow)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)

## What is implemented

The current implementation includes plan authoring, guided session logging, weekly reflection, history browsing, email/password sign-in, password recovery, and per-account cloud persistence. The supplied training log is migrated only into the designated account, never automatically copied to every new user.

### Plans and exercises

- Today is the default screen.
- Plans can be created, renamed, edited, and activated.
- Plans can have multiple training days.
- Training days can be assigned to Monday–Sunday or left unscheduled.
- Training days can be renamed or deleted.
- Blocks can be configured as:
  - Straight sets
  - Supersets
  - Circuits
  - Timed sequences
- Blocks support configurable round and rest ranges.
- Exercises can be selected from the exercise library or created as custom exercises.
- Exercise metadata includes category, metric, pattern, side mode, optional skill ID, lead-in, and default hold duration where relevant.
- Exercise targets can be expressed as rep or seconds ranges.
- Bilateral movements can be marked as **Total** or **Both Sides**.
- Plan blocks and Today blocks use collapsible sections so long routines remain manageable on a phone-sized screen.

### Today and logging

- The active plan automatically supplies the day scheduled for the selected date.
- The date can be changed to inspect another planned day.
- An unscheduled date provides a direct link back to Plans.
- Starting a session creates an immutable snapshot of the plan for that session.
- Previous results are shown beside exercises when available.
- Rep-based exercises accept any non-negative value; the planned target is guidance, not an input clamp.
- Guided mode opens the current block and advances through the session.
- Timed exercises have a visible preparation countdown and timestamp-based hold timer.
- Strength logging shows a visible post-set rest countdown.
- Rest can be skipped.
- A whole block can be skipped with a required reason.
- Sets logged before a block is skipped remain visible and are not discarded.
- Browser sound cues are used for hold start, hold completion, and rest completion when the browser permits audio.

### Session completion

- Sessions can be finished manually.
- The completed session summary remains available after finishing and after a refresh.
- The summary shows:
  - Sets logged
  - Exercises touched
  - Total reps
  - Total hold seconds
  - Skipped blocks and reasons
  - Session note
  - Sleep hours
  - Session duration
- Summary fields can be edited after the session is finished.
- The session's original plan targets remain unchanged if the plan is edited later.

### History

- History lists saved sessions and opens their editable summaries.
- The supplied 11-week log is normalized into historical sessions, set entries, and weekly reflections.
- Historical records are added to the designated account with a one-time private migration that merges rather than overwrites.
- Original session excerpts remain available in the session summary; unclear results are not guessed.
- Historical sessions retain the date and recorded duration without fabricating a start time.

### Settings and account data

- The default timed-hold lead-in can be changed in Settings.
- Users can sign in with a password, create accounts, and request a password-recovery email.
- Settings, password management, and sign-out are available from the top-corner initials avatar.
- Training data is stored in a versioned Postgres JSON document owned by the signed-in Supabase user.
- Row-level security protects reads; a version-checked database function prevents concurrent sessions from silently overwriting one another.

## Quick start

### Requirements

- Node.js with npm
- A modern browser
- Windows, macOS, or Linux
- A Supabase project

Check that Node and npm are available:

```bash
node --version
npm --version
```

### Install dependencies

From the project directory:

```bash
npm install
```

### Configure Supabase

1. Create a Supabase project and enable the Email provider in **Authentication → Providers**.
2. In the Supabase SQL Editor, run [`supabase/migrations/20261029103000_user_training_documents.sql`](supabase/migrations/20261029103000_user_training_documents.sql).
3. In **Authentication → URL Configuration**, set the local site URL to `http://localhost:5173` and allow that redirect URL.
4. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the project API settings. The publishable/anon key is intended for browser use; never put a service-role key in a `VITE_` variable.

### Start the development server

```bash
npm run dev
```

Vite will print a local URL, usually similar to:

```text
http://localhost:5173/
```

Open that URL in a browser. The interface is designed for a narrow phone-sized viewport, but it can also be explored in a desktop browser.
Sign in using your email and password. Choose **Create an account** if you have not registered. If you have an existing passwordless account, use **Forgot password?** and open the recovery link in the same browser; after it returns to the app, set a password from the top-corner initials avatar menu. If the recovery email limit is exhausted, use the local password setup command below instead. Open **Settings** from the same avatar menu.

### Add the supplied history to your account

After you have signed in once, add your account email and the Supabase service-role key to the ignored local `.env.local` file as `TRAINING_LOG_TARGET_EMAIL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key is only used by the local one-time script; never share it or deploy it to the browser. The personal source fixture stays at the ignored `private/legacyHistory.json` path and is not included in Git. From the original workspace that contains this file, run:

```bash
npm run import:legacy-history
```

The script targets only the configured email, preserves any existing training document, and is safe to rerun. The history has already been migrated to the designated account; the ignored source file is retained locally, not pushed. Remove the service-role key from `.env.local` after the import.

### Set a password without sending another email (Windows)

If Supabase's built-in email quota is exhausted, you can set a password on your existing account locally with the admin key. Put `SUPABASE_SERVICE_ROLE_KEY` back in `.env.local` temporarily if you removed it. In PowerShell, from the repository root, run:

```powershell
$securePassword = Read-Host "New password (minimum 8 characters)" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:TRAINING_LOG_NEW_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  npm.cmd run set:account-password
} finally {
  Remove-Item Env:TRAINING_LOG_NEW_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
```

The command updates only the existing user matching `TRAINING_LOG_TARGET_EMAIL`; it does not send an email or create an account. The password is not saved in a file or printed. Remove `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` when the command succeeds. Then choose **Password** in the app and sign in with that email and password.

### Create a production build locally

```bash
npm run build
```

This runs TypeScript's project build and then creates a Vite production bundle in `dist/`.

To preview the production bundle locally:

```bash
npm run preview
```

The `dist/` folder is generated output and is intentionally excluded from Git.

## Using the prototype

The quickest way to explore the current slice is:

1. Open the app and confirm that the **PROTOTYPE** label is visible.
2. Open **Plans**.
3. Use the seeded **Lower Body + Core** plan, or create a new plan.
4. Edit the plan and add a training day if needed.
5. Add or edit blocks and exercises.
6. Assign a weekday to the training day if you want Today to select it automatically.
7. Click **Make active** for the plan you want to use.
8. Open **Today** and navigate to the date assigned to the training day.
9. Click **Start session**.
10. Expand the current block and log one or more rep sets.
11. For timed exercises, use the preparation countdown and hold controls.
12. Try skipping a rest or skipping a block with a reason.
13. Finish the session.
14. Edit the note or sleep field in the completed summary.
15. Refresh the browser and confirm that the plan and completed session remain.
16. Edit the plan, then inspect the completed session again. Its historical plan snapshot should remain unchanged.
17. Open History, inspect a saved session, and return to its editable summary.
18. Open one of the bundled historical sessions, inspect its values and original excerpt, and confirm it remains after refresh.

## How data works

The prototype keeps structured records rather than storing a screen-shaped form. Important records include:

- `Exercise` — an exercise-library entry
- `Plan` — a user-owned training plan
- `PlanDay` — a training day within a plan
- `PlanBlock` — an ordered block within a training day
- `PlanExercise` — an exercise assignment and target within a block
- `Session` — a training session for a date
- `SessionPlanItem` — the immutable plan expansion captured when a session starts
- `SetEntry` — a completed, edited, or skipped exercise entry
- `SkippedBlock` — a skipped block and its reason
- `WeeklyReview` — a saved weekly reflection and next-week goal
- `Settings` — prototype timing settings

The supplied historical log is normalized into `Session`, `SessionPlanItem`, `SetEntry`, and `WeeklyReview` records. A one-time local admin script merges those records into the designated account's existing `DataDocument`; normal sign-up never seeds the supplied personal log. Historical sessions keep date and duration without fabricated start timestamps; unresolved source values remain in each session's original excerpt.

Each account currently stores one JSONB `DataDocument` row. This preserves the app's existing typed state model while moving the source of truth to Postgres. Writes include an expected version, so another browser/device cannot silently overwrite a newer copy. This prototype does not yet support offline edits or automatic conflict merging.

### Why sessions use snapshots

Plans are editable. Historical training should not silently change when a user edits a plan for the future. When a session starts, the active plan day is expanded into `SessionPlanItem` records. The session and its summary read from that snapshot instead of re-reading the current plan.

This is one of the important behaviors being tested before the data model is translated to SwiftData.

### Timer behavior

Timer displays are derived from timestamps rather than interval tick counts. The interval only causes the UI to redraw. This keeps the behavior accurate if a browser tab is delayed or temporarily inactive and makes the timer logic easier to test and move to native code later.

Timed holds use these concepts:

1. A preparation countdown begins.
2. The hold starts automatically when preparation ends.
3. Elapsed time is calculated from the hold's start timestamp.
4. The displayed completed hold is floored to whole seconds.
5. Rest begins after the hold or rep set is recorded.

The prototype is intentionally using a browser-friendly implementation. Native notification delivery, haptics, Live Activities, and background execution are outside its scope.

## Project structure

```text
training-log-prototype/
├─ index.html
├─ package.json
├─ package-lock.json
├─ vite.config.ts
├─ tsconfig*.json
├─ README.md
├─ AGENTS.md
├─ docs/
│  ├─ README.md
│  ├─ PROTOTYPE_ARCHITECTURE.md
│  ├─ PROTOTYPE_STATUS.md
│  ├─ DESIGN_DECISIONS.md
│  └─ requirements/
│     └─ Training Log iOS App Spec v2.md
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ domain/
   │  ├─ model.ts
   │  ├─ ids.ts
   │  ├─ seed.ts
   │  ├─ plan.ts
   │  └─ session.ts
   ├─ state/
   │  ├─ appState.ts
   │  └─ reducer.ts
   ├─ storage/
   │  ├─ database.types.ts
   │  ├─ document.ts
   │  ├─ supabaseClient.ts
   │  └─ supabaseRepository.ts
   ├─ screens/
   │  ├─ AuthScreen.tsx
   │  ├─ TodayScreen.tsx
   │  ├─ PlansScreen.tsx
   │  ├─ PlanEditorScreen.tsx
   │  ├─ SessionSummaryScreen.tsx
   │  └─ SettingsScreen.tsx
   ├─ ui/
   │  ├─ AppShell.tsx
   │  ├─ AccountSecurity.tsx
   │  ├─ ExerciseCard.tsx
   │  ├─ PrototypeNotice.tsx
   │  └─ sounds.ts
   └─ styles/
      └─ prototype.css
```

The source is organized by responsibility:

- **`domain/`** contains data types, seed data, selectors, and pure training rules.
- **`state/`** contains application state and explicit reducer actions.
- **`storage/`** contains the Supabase client, persisted-document validation, and account repository.
- **`screens/`** contains route-level screen compositions.
- **`ui/`** contains reusable visual components.
- **`styles/`** contains the plain CSS for the prototype.

The domain and state seams are the most valuable parts to carry forward conceptually. The screen markup and CSS are intentionally disposable.

## Technology choices

| Area | Choice | Reason |
| --- | --- | --- |
| UI | React | Fast iteration on interactive workflow questions |
| Language | TypeScript | Makes the evolving record and action shapes explicit |
| Build tool | Vite | Small, fast browser prototype setup |
| Styling | Plain CSS | Keeps visual changes easy while the interface is unsettled |
| State | Explicit reducer actions | Makes session transitions and timer behavior inspectable |
| Authentication | Supabase Auth email codes and passwords | Supports in-viewer sign-in without opening an email link; Supabase handles credentials |
| Persistence | Versioned Postgres JSONB document with row-level security | Provides durable account-owned data and detects concurrent writes |
| Navigation | Small hash-based routes | Avoids adding a router dependency to a prototype |
| Timers | Injected timestamps | Avoids counting interval ticks as elapsed time |

## Prototype scope

### In scope

The broader prototype is intended to validate:

- User-created plans and training days
- Rep logging
- Timed holds and guided stretches
- Rest behavior
- Editing and undo
- Session status and summaries
- History
- Preservation of ambiguous values in supplied historical data
- Sunday review and stale review behavior
- PRs and analytics
- JSON and CSV export
- Account sign-in and private cross-device data
- Safe, account-specific migration of supplied history

### Not in scope

The web prototype does not implement production versions of:

- CloudKit or iCloud synchronization
- Live Activities or lock-screen updates
- WidgetKit
- HealthKit
- Siri or App Intents
- Native notifications or haptics
- Social features
- Coaching
- Nutrition tracking

These are later native iOS concerns. A browser sound cue may simulate a timer milestone, but it is not intended to validate the final iOS delivery mechanism.

## Current status and next steps

### Current status

The current implementation has completed the plan, logging, reflection, and history slices. Supabase email magic-link auth and private cloud-document persistence are wired; a project must be configured and the migration applied before the web app can be used.

### Planned slices

1. **Slice 1 — Plans and first logging flow**
   - Plan authoring, plan selection, Today, logging, finish, summary, and persistence.
2. **Slice 2 — Hold behavior**
   - Hold details, form flags, defaults, editing, undo, and rest behavior.
3. **Slice 3 — Guided stretches**
   - Ordered stretch sequences, transitions, ratings, skips, and auto-finish.
4. **Slice 4 — History and legacy data**
   - History browsing and the supplied log normalized into the designated account's history.
5. **Slice 5 — Review and analytics**
   - Sunday review, stale behavior, PRs, and chart-ready selectors.
6. **Slice 6 — Export and prototype cleanup**
   - JSON/CSV export and prototype notes.

See [`docs/PROTOTYPE_STATUS.md`](docs/PROTOTYPE_STATUS.md) for the living implementation status and recommended next step.

## Development workflow

### Useful commands

```bash
npm install       # install dependencies
npm run dev       # start the Vite development server
npm run build     # type-check and create a production build
npm run preview   # serve the production build locally
```

### Before making changes

Read the smallest relevant amount of project context:

1. Start with [`AGENTS.md`](AGENTS.md) for repository rules.
2. Use [`docs/README.md`](docs/README.md) to identify the relevant detailed document.
3. Read [`docs/PROTOTYPE_STATUS.md`](docs/PROTOTYPE_STATUS.md) before implementation work.
4. Read [`docs/PROTOTYPE_ARCHITECTURE.md`](docs/PROTOTYPE_ARCHITECTURE.md) before structural changes.
5. Read [`docs/DESIGN_DECISIONS.md`](docs/DESIGN_DECISIONS.md) before changing behavior, data shape, or scope.

### Implementation guidelines

- Keep business rules in `src/domain`, not inside screen components.
- Use explicit reducer actions for state transitions.
- Inject current time into timer transitions.
- Do not model elapsed time by counting interval callbacks.
- Keep account persistence behind the Supabase repository; do not use browser storage as the source of truth.
- Preserve supplied historical data; never silently guess or discard ambiguous values.
- Keep the app visibly labelled as a prototype.
- Prefer a complete workflow that answers a product question over isolated visual polish.

### Verification

At minimum, run:

```bash
npm run build
```

For behavior changes, also walk through the relevant browser workflow. The main current walkthrough is:

1. Create or edit a plan.
2. Add a training day, block, and exercises.
3. Activate the plan.
4. Open the scheduled day in Today.
5. Start a session and log multiple sets.
6. Finish and edit the summary.
7. Refresh the browser.
8. Confirm the data remains and historical plan targets are unchanged after a plan edit.

After meaningful implementation or verification work, update `docs/PROTOTYPE_STATUS.md`.

## Documentation

- [`AGENTS.md`](AGENTS.md) — repository purpose, scope boundaries, and working rules.
- [`docs/README.md`](docs/README.md) — documentation map and task-based reading guide.
- [`docs/PROTOTYPE_ARCHITECTURE.md`](docs/PROTOTYPE_ARCHITECTURE.md) — prototype boundary, model, state seam, timer semantics, screens, build slices, and acceptance walkthrough.
- [`docs/PROTOTYPE_STATUS.md`](docs/PROTOTYPE_STATUS.md) — current implementation status, verification history, and next step.
- [`docs/DESIGN_DECISIONS.md`](docs/DESIGN_DECISIONS.md) — decision history and unresolved product questions.
- [`docs/requirements/Training Log iOS App Spec v2.md`](docs/requirements/Training%20Log%20iOS%20App%20Spec%20v2.md) — source product requirements.

## Troubleshooting

### The app is blank or does not load

Stop the development server and restart it:

```bash
npm run dev
```

Then check the browser developer console for errors. Also confirm that dependencies were installed with `npm install`.

### Changes do not appear

Refresh the browser. If account data does not load, verify the Supabase project URL/key, SQL migration, email provider, and redirect URL. Loading and saving failures are shown in the interface rather than replaced with local-only data.

### Old data is interfering with testing

Verify that the current signed-in account is the expected one. Training data is stored remotely in that account, not in browser cache; there is no reset button that deletes account data.

### Audio cues do not play

Browsers may block audio until the page receives a user gesture. Click or tap in the app first, and check that the browser tab is not muted. Audio is best-effort and is not required for the core logging workflow.

### Build errors after pulling changes

Reinstall dependencies and run the build again:

```bash
npm install
npm run build
```

Do not commit `node_modules/` or `dist/`; they are generated locally and excluded by `.gitignore`.

## License and production note

This repository is an exploratory prototype for validating a future Training Log iOS app. It should not be treated as production web application code or copied line-for-line into the eventual SwiftUI implementation. Its value is the workflow, vocabulary, state transitions, data shape, and product decisions it helps validate.
