# Training Log Web Prototype Architecture

> **Prototype — not production code.** This document describes a browser prototype whose purpose is to validate the training-log workflow and state model before implementing the native SwiftUI app.

## 1. Question this prototype answers

Can a person create or select their own training plan, complete a planned training day quickly and understandably, and build enough structured data to support progression, PRs, consistency, volume, and the Sunday review?

The prototype is not intended to answer whether iCloud, Live Activities, WidgetKit, HealthKit, or App Store distribution work. Those are deliberately outside the prototype boundary because they are native-platform concerns rather than MVP product behavior.

## 2. Prototype boundary

### Included

The web-first prototype must make these requirements interactive:

- A user can create, name, edit, and activate their own training plan.
- A plan can contain training days, ordered blocks, and exercises with target ranges.
- Blocks can represent straight sets, supersets, circuits, or ordered timed sequences.
- A scheduled day opens pre-filled from the active plan; an unscheduled day can be started from the plan.
- A session can be started, paused by leaving the page, and manually finished.
- Starting a session enters guided mode: one exercise is current, its block opens automatically, and completing it advances to rest and then the next planned exercise.
- Rep exercises use a previous-result default and a stepper.
- Hold exercises have a lead-in, timestamp-based stopwatch, floor rounding, raw decimal retention, level/equipment defaults, and clean/shaky/bailed form selection.
- Every recorded set can be edited or undone.
- Rest runs after logging a set and supports ending early.
- The stretch block is a timed, ordered sequence with transitions, custom duration, ratings, and skips with reasons.
- Sessions derive `done`, `partial`, or `skipped` status.
- Skipped days are represented with a reason.
- A finished session has a summary with PRs, notes, and optional sleep hours.
- The finished-session summary shows the actual sets/reps/hold times performed, skipped-block reasons, editable note/sleep, and an analytics snapshot of totals contributed by the session.
- After finishing, Today renders the full completed summary in place for that date; it does not replace it with a generic saved-session card and plan accordions.
- Timer milestones provide browser sound cues for hold start, hold completion, rest start, and rest completion when the browser permits audio.
- A history screen can inspect and edit prior sessions.
- Sunday review drafts from the week, can be saved, and becomes stale after later edits.
- Analytics render from actual stored records: hold trend, strength trend, hard sets, consistency, session length, benchmark, mobility, and PRs.
- Users sign in with passwords and recover access by email; each account's training data is isolated by Postgres row-level security.
- The supplied legacy history is migrated only into the designated account; ambiguous source values are retained rather than guessed.
- Data survives a browser refresh and is available across devices through Supabase.
- JSON and CSV export work from the beginning.

### Deliberately excluded

These are represented, at most, by a note or a simulated visual state and are not acceptance criteria for this prototype:

- CloudKit/iCloud synchronization
- Live Activities and lock-screen behavior
- WidgetKit
- background local notifications
- HealthKit
- Siri, App Intents, and Action Button integration
- native haptics and native sound behavior
- social features, coaching, and nutrition

The prototype can show a visual “timer complete” cue and optionally use browser audio, but the product decision being validated is the timer and logging flow—not the iOS delivery mechanism.

## 3. Technology choice

Use a small Vite + React + TypeScript application developed in VS Code.

- **UI:** React and plain CSS. Avoid a component library so the wireframe can change shape quickly.
- **Routing:** a tiny hash route (`#/today`, `#/history`, and so on) rather than adding a router dependency.
- **Auth and persistence:** Supabase Auth email/password sign-in and recovery links plus a versioned account-owned Postgres JSONB document, protected by row-level security and optimistic version checks.
- **Hosting:** GitHub Pages serves the static prototype from the repository's `github.io` URL; Supabase remains the backend. Deployment credentials are limited to browser-safe Supabase project settings.
- **Charts:** lightweight SVG/CSS primitives generated from selectors. Do not introduce a charting dependency until the chart questions are validated.
- **Data:** one versioned `DataDocument` per authenticated user. New accounts receive the generic plan seed; the supplied personal training log is imported only into its designated account.

The prototype should run with one command:

```text
npm run dev
```

It should be clearly labelled **PROTOTYPE** in the UI and README so it is not mistaken for the production iOS implementation.

## 4. Module layout

```text
training-log-prototype/
├─ package.json
├─ index.html
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ domain/
│  │  ├─ model.ts          # SwiftData-shaped records and value types
│  │  ├─ seed.ts           # exercises, levels, and generic starter plan
│  │  ├─ plan.ts           # plan/day/block selectors and target expansion
│  │  ├─ session.ts        # pure session status and set operations
│  │  ├─ timers.ts         # timestamp-based timer transitions
│  │  ├─ analytics.ts      # PRs and chart-ready projections
│  │  ├─ review.ts         # Sunday draft and stale rules
│  ├─ state/
│  │  ├─ appState.ts       # state shape and actions
│  │  └─ reducer.ts        # pure domain reducer
│  ├─ storage/
│  │  ├─ database.types.ts # Supabase schema types
│  │  ├─ supabaseClient.ts # configured Supabase client
│  │  ├─ supabaseRepository.ts # per-user cloud document adapter
│  │  └─ document.ts      # persisted document validation
│  ├─ screens/
│  │  ├─ AuthScreen.tsx    # email-code and password sign-in
│  │  ├─ TodayScreen.tsx
│  │  ├─ PlansScreen.tsx
│  │  ├─ PlanEditorScreen.tsx
│  │  ├─ SessionSummaryScreen.tsx
│  │  ├─ HistoryScreen.tsx
│  │  ├─ AnalyticsScreen.tsx
│  │  ├─ ReviewScreen.tsx
│  │  └─ SettingsScreen.tsx
│  ├─ ui/
│  │  ├─ AppShell.tsx
│  │  ├─ AccountSecurity.tsx # initials avatar, account menu, and password management
│  │  ├─ ExerciseCard.tsx
│  │  ├─ PlanBlockEditor.tsx
│  │  ├─ TimerPanel.tsx
│  │  ├─ SetRow.tsx
│  │  ├─ Modal.tsx
│  │  └─ PrototypeBanner.tsx
│  └─ styles/
│     └─ prototype.css
├─ scripts/
│  ├─ importLegacyHistory.ts # private one-time account migration
│  └─ legacyHistory.ts       # migration-only normalization; not in the browser app
└─ private/
   └─ legacyHistory.json    # local-only personal source, ignored by Git
└─ README.md
```

The domain modules are the part worth preserving if the prototype teaches us something. The screens and CSS are disposable.

Before Slice 1 begins, the corresponding `src/` directories are scaffolded in the repository. Empty directories are represented with `.gitkeep` files until implementation files replace them. Keep this separation as the prototype grows:

- `domain/` contains pure product rules and data types.
- `state/` contains application state and reducer transitions.
- `storage/` contains persistence interfaces and browser adapters.
- `screens/` contains route-level compositions.
- `ui/` contains reusable visual modules that do not own business rules.
- `styles/` contains prototype CSS.

## 5. Domain model

The TypeScript records intentionally stay close to the future SwiftData models. IDs are stable strings in the browser and become UUIDs in SwiftData.

```ts
type ID = string;
type ISODate = string; // YYYY-MM-DD

type Metric = "seconds" | "reps";
type ExerciseCategory = "skill" | "strength" | "stretch";
type Pattern = "push" | "pull" | "legs" | "core";
type FormFlag = "clean" | "shaky" | "bailed";
type SessionStatus = "done" | "partial" | "skipped";

type Exercise = {
  id: ID;
  name: string;
  category: ExerciseCategory;
  metric: Metric;
  source: "system" | "user";
  skillId?: string;
  pattern?: Pattern;
  leadInS?: number;
  defaultHoldS?: number;
  order?: number;
};

type ProgressionLevel = {
  id: ID;
  skillId: string;
  rank: number;
  name: string;
};

type Plan = {
  id: ID;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
};

type PlanDay = {
  id: ID;
  planId: ID;
  weekday?: number; // Monday = 1, Sunday = 7; absent means an unscheduled day
  name: string;
  order: number;
  isRestDay?: boolean;
  reflectionEnabled?: boolean;
};

type PlanBlockType = "straightSets" | "superset" | "circuit" | "timedSequence";

type PlanBlock = {
  id: ID;
  dayId: ID;
  name: string;
  type: PlanBlockType;
  order: number;
  roundsMin: number;
  roundsMax: number;
  restMinS: number;
  restMaxS: number;
  transitionS?: number;
};

type PlanExercise = {
  id: ID;
  blockId: ID;
  exerciseId: ID;
  order: number;
  repsMin?: number;
  repsMax?: number;
  secondsMin?: number;
  secondsMax?: number;
  sideMode: "none" | "eachSide";
};

type SessionPlanItem = {
  id: ID;
  sessionId: ID;
  blockId: ID;
  planExerciseId: ID;
  blockOrder: number;
  exerciseOrder: number;
  blockName: string;
  blockType: PlanBlockType;
  roundsMin: number;
  roundsMax: number;
  restMinS: number;
  restMaxS: number;
  exerciseId: ID;
  exerciseName: string;
  repsMin?: number;
  repsMax?: number;
  secondsMin?: number;
  secondsMax?: number;
  sideMode: "none" | "eachSide";
};

// A plan day is independent of the user's personal routine. The prototype
// seeds one example plan, but all plans use this same shape.

type Session = {
  id: ID;
  date: ISODate;
  weekday: number;
  planId?: ID;
  planDayId?: ID;
  startedAt?: number;
  finishedAt?: number;
  finishMode?: "auto" | "manual";
  note: string;
  skipReason?: string;
  sleepHours?: number;
  importKey?: string;
  isHistorical?: boolean;
  durationSeconds?: number;
  sourceText?: string;
  hasUnresolvedHistory?: boolean;
};

type SetEntry = {
  id: ID;
  sessionId: ID;
  exerciseId: ID;
  levelId?: ID;
  setNo: number;
  reps?: number;
  seconds?: number;
  secondsRaw?: number;
  startedAt?: number;
  endedAt?: number;
  restS?: number;
  equipment?: string;
  formFlag?: FormFlag;
  edited: boolean;
  rating?: number;
  skipReason?: string;
  importKey?: string;
};

type WeeklyReview = {
  weekStart: ISODate;
  reflection: string;
  nextWeekGoal: string;
  reviewedAt?: number;
  isStale: boolean;
};

type Settings = {
  defaultLeadInS: number;
  transitionS: number;
  levelUpCleanHoldS: number;
  levelUpRequiredHolds: number;
};
```

### Plan authoring model

Plans are user-owned arrangements, not hard-coded weekday templates. The plan editor must let a user:

1. Create or rename a plan.
2. Add one or more training days and optionally assign each day to a weekday.
3. Add ordered blocks to a day.
4. Choose a block type: straight sets, superset, circuit, or timed sequence.
5. Add an exercise from the library or create a custom exercise.
6. Set the target metric/range, round count, side mode, and rest range.
7. Reorder or remove blocks and exercises.
8. Activate one plan for Today.

The demo plan is based on the supplied routine, but the routine is only seed content. The phrase “side blank” is interpreted as **side plank**; this interpretation should remain easy to change in the demo seed.

```text
Example plan: Lower Body + Core
Day: Friday / Lower Body + Core

Block 1 — Active mobility (timed sequence)
- Active stretch 1 — 60 seconds
- Active stretch 2 — 60 seconds
- Active stretch 3 — 60 seconds
- Active stretch 4 — 60 seconds
- Active stretch 5 — 60 seconds
- Active stretch 6 — 60 seconds

Block 2 — Split squat + knee raise (superset, 4 rounds)
- Bulgarian split squat — 8–12 reps, each side
- Hanging knee raise — 8–12 reps
- Rest — 45–60 seconds

Block 3 — Glute bridge + hollow-body hold (superset, 3 rounds)
- Glute bridge — 10–15 reps
- Hollow-body hold — 30–60 seconds
- Rest — 45–60 seconds

Block 4 — Lunge + side plank (superset, 3 rounds)
- Lunge — 10 reps, each side
- Side plank — 20–30 seconds, each side
- Rest — 45–60 seconds
```

The seed must preserve the distinction between a block's **round count**, an exercise's **target range**, and an exercise's **side mode**. A user should not need to duplicate a bilateral exercise into separate left/right exercises just to express “each side.” Side mode is an exercise-library property and is inherited when the exercise is added to a plan.

### Plan and session snapshot rule

Plans are editable, but a historical session must not silently change when its plan is edited later. When a session starts, the active plan day is expanded into `SessionPlanItem` records. Session status, target ranges, and history use that snapshot rather than rereading the current plan.

This keeps the user-created plan model flexible while preserving the meaning of historical training data. The plan itself remains editable for future sessions.

### One deliberate model correction

The original data table says a stretch can be skipped with a reason, but it does not provide a field for that reason. The prototype adds optional `skipReason` to `SetEntry`, allowing a skipped planned stretch to remain an explicit row without pretending it was completed. This must be accepted, rejected, or moved to a dedicated model before the SwiftData schema is frozen.

`SessionStatus` is not stored as authoritative state. A selector computes it from the weekday plan and set entries:

```text
done    = every planned slot has at least one completed entry
partial = at least one, but not every, planned slot has an entry
skipped = no completed entries and the session has a skip reason
```

## 6. Application state and seam

The UI talks to one reducer rather than writing records directly. This gives the prototype a small, portable interface that can later be translated to Swift methods or an observable model.

```ts
type AppState = {
  data: {
    plans: Record<ID, Plan>;
    planDays: Record<ID, PlanDay>;
    planBlocks: Record<ID, PlanBlock>;
    planExercises: Record<ID, PlanExercise>;
    sessionPlanItems: Record<ID, SessionPlanItem>;
    exercises: Record<ID, Exercise>;
    levels: Record<ID, ProgressionLevel>;
    sessions: Record<ID, Session>;
    setEntries: Record<ID, SetEntry>;
    weeklyReviews: Record<ISODate, WeeklyReview>;
    settings: Settings;
  };
  route: "today" | "summary" | "history" | "analytics" | "review" | "settings";
  selectedDate: ISODate;
  activeSessionId?: ID;
  timer: TimerState;
  pendingHold?: PendingHold;
  pendingStretchRating?: ID;
  lastError?: string;
};

type TimerState =
  | { kind: "idle" }
  | { kind: "leadIn"; exerciseId: ID; endsAt: number }
  | { kind: "hold"; exerciseId: ID; startedAt: number }
  | { kind: "rest"; setId: ID; startedAt: number; readyAt: number; endsAt: number }
  | { kind: "stretchHold"; exerciseId: ID; endsAt: number }
  | { kind: "transition"; nextExerciseId: ID; endsAt: number };
```

The reducer interface is:

```ts
reduce(state: AppState, action: Action, now: number): AppState
```

It is pure. `now` is passed in rather than read inside the reducer, so timer behavior is deterministic and can be driven by either real browser time or a fast-forward prototype clock.

The browser shell owns only three effects:

1. Load and save the versioned document through the repository.
2. Dispatch a `CLOCK_TICK` action on an interval while a timer is active.
3. Change the URL hash when navigation changes.

Components do not calculate elapsed time, PRs, session status, or review staleness.

## 7. Action vocabulary

The first implementation should use explicit actions rather than generic mutations:

```text
START_SESSION
CREATE_PLAN
UPDATE_PLAN
ADD_PLAN_DAY
ADD_PLAN_BLOCK
ADD_PLAN_EXERCISE
CREATE_CUSTOM_EXERCISE
ACTIVATE_PLAN
SKIP_DAY
BEGIN_REP_ENTRY
COMMIT_REP_SET
BEGIN_HOLD
CLOCK_TICK
STOP_HOLD
CONFIRM_HOLD_FORM
UNDO_SET
EDIT_SET
BEGIN_REST
SKIP_REST
START_STRETCH_BLOCK
CHANGE_STRETCH_DURATION
COMPLETE_STRETCH
SKIP_STRETCH
SET_STRETCH_RATING
FINISH_SESSION
UPDATE_SESSION_NOTE
UPDATE_SLEEP_HOURS
SAVE_WEEKLY_REVIEW
IMPORT_RECORDS
EXPORT_JSON
EXPORT_CSV
```

Actions that change a session also call one internal rule: if that session belongs to a week with a saved review, mark that review stale. This prevents edit paths from accidentally disagreeing about staleness.

## 8. Timer semantics

Timers are the highest-risk behavior in the logging flow and should be implemented before visual polish.

### Hold

1. `BEGIN_HOLD` creates a lead-in timer ending at `now + leadInS`.
2. When `CLOCK_TICK` observes that the lead-in has ended, it changes to `hold` with `startedAt = leadIn.endsAt`.
3. The display computes `now - startedAt` on every render.
4. `STOP_HOLD` computes:

   ```text
   secondsRaw = max(0, (now - startedAt) / 1000)
   seconds    = floor(secondsRaw)
   ```

5. The UI asks for clean, shaky, or bailed, then commits the set and starts rest.

The interval only causes redraws. It never increments a counter.

### Rest

Rest shows the configured range. `readyAt` is the minimum rest endpoint and `endsAt` is the maximum endpoint. The user can begin the next set after `readyAt`, skip early, or let the timer reach `endsAt`. When the next set starts, actual rest is computed from the preceding set's `startedAt`/rest timestamp rather than copied from the planned range.

The exact decision about whether `restS` means planned or actual is still open in the source spec. The prototype displays both planned range and actual elapsed rest so that decision can be made from the interaction.

### Stretch sequence

The sequence obtains stretches in `order`, records a completed stretch as a seconds-based entry, prompts for a rating where required, then starts the transition timer. Completion of the final stretch triggers automatic session finish. A manual finish is always available.

### Demo clock

The prototype has a visible `Real time / Fast demo` control. Fast demo advances the injected clock without changing timer formulas, allowing a reviewer to exercise a 30-second hold or five-minute stretch sequence immediately. This is a prototype convenience, not a product feature.

## 9. Screen architecture

### Plans

Plan list and activation surface.

- active plan indicator
- create, rename, duplicate, activate, and delete plans
- create custom exercises for movements not in the shared exercise library
- select an exercise from a dropdown and edit its name, category, pattern, metric, skill ID, lead-in, and—only for stretch/seconds exercises—default hold duration
- delete custom exercises that are not used by a plan or history
- open a plan in the editor

### Plan editor

The plan editor is a required part of the MVP because the app must serve users with different routines.

- plan name
- edit plan name and description
- training days and optional weekday assignment
- rename and delete training days
- training days displayed Monday through Sunday, with unscheduled days after scheduled days
- ordered blocks
- blocks appear as closed accordions by default and open only when their details need editing; the closed header shows the block name and exercise count, while the block type remains in the selector
- blocks can be deleted with confirmation; deleting a block removes its plan-exercise assignments
- block type, round range, and rest range
- exercises within each block
- choose from the exercise library or create a custom exercise
- reps/seconds target range and side mode
- exercise-library side mode (`none` or `eachSide`) used to mark whether the movement is performed on both sides
- reorder and remove controls
- preview of the resulting Today day

### Today

Primary logging surface.

- date and weekday
- active plan and selected training day
- automatic plan-day selection based on the viewed date
- direct Plans action when no day is scheduled for the viewed date
- Today training blocks are closed accordions by default and expand to reveal their exercise cards
- Timed guided exercises show a timestamp-based on-screen timer. Continue records the elapsed hold with floor rounding, enters rest/transition, and automatically advances when rest ends.
- The current guided block can be skipped with a required reason; the skip is persisted and shown in the session.
- Skipping a block never deletes or hides entries already logged in that block. Today shows the skip reason and any completed sets, and analytics continue to consume those entries.
- Every timed hold/stretch uses the configurable lead-in as a visible preparation countdown to get into position; the hold starts automatically when it reaches zero. Preparation is not counted as hold time and applies immediately when Start session reaches a timed first exercise.
- For strength/rep exercises, the same designated rest is a post-set countdown that starts after Log set is pressed and remains visible until the next exercise is ready.
- planned blocks and target ranges
- previous session's result beside each exercise
- Start session
- exercise cards with rep or hold entry
- active timer panel
- completed set rows with Edit and Undo
- rest state
- Skip day
- Finish

The screen should be usable in a narrow phone-sized viewport, but remain inspectable on desktop. Compact or ambiguous controls provide concise tooltips and accessible labels without turning every visible label into extra explanatory copy.

### Session summary

- done/partial/skipped status
- duration
- new PRs
- completed and skipped exercises
- note field
- sleep hours
- return to Today or History

Post-finish fields are editable and do not block finishing.

### History

- calendar/list of sessions by date
- status and duration
- skipped-day reasons
- expand a session to inspect and edit sets
- indication that a saved weekly review is stale

### Analytics

Selectors return chart-ready values, not UI-specific markup:

- best hold per session and rolling three-session best
- clean-hold level-up readiness
- best set and total reps
- weekly hard sets by pattern
- consistency by date/status/reason
- session length versus target
- Saturday benchmark best-of-two
- mobility rating trend
- sleep/performance only when at least eight weeks exist
- PR list

Charts can initially be simple SVG lines, bars, dots, and a calendar grid. The point is to verify whether the metrics answer the questions in the spec.

### Sunday review

- Rest days can optionally enable a weekly reflection; the seeded Sunday is a rest day with reflection enabled.
- On a reflection-enabled rest day, the reflection is the Today page content rather than a separate prompt or destination.
- Weeks run Monday through Sunday. The review shows logged sessions, completed/partial/skipped counts, set entries, reps, and hold seconds.
- Reflection and next-week goal are editable and stored with the week's Monday start date.
- Starting or changing a session in that week marks a saved review stale; saving again clears the stale state.
- PRs and richer planned-versus-completed analytics remain future additions.

### Supplied legacy history

- Normalize the user's supplied log into dated historical sessions, set entries, and weekly reflections in a local one-time migration.
- Store historical records in the same `DataDocument` collections as sessions created in the app.
- Merge the private fixture into the explicitly selected account by stable IDs; do not overwrite existing user records.
- Preserve the original session excerpt for any value that cannot be represented without guessing.
- Keep date-only historical sessions date-only; store a recorded duration separately rather than inventing a time of day.

The supplied log begins Tuesday, 2026-08-18 and contains eleven numbered weeks. Its source fixture is retained only at the ignored local path `private/legacyHistory.json`; it is not part of the repository or browser bundle. A local admin script imports it into only the explicitly configured account. It is not included in sign-up data or offered as a general in-app import flow.

### Settings

- default lead-in
- transition duration
- level-up threshold
- export JSON/CSV
- fast-demo clock control

## 10. Build slices

Build in vertical slices so each slice can be tried in the browser.

### Slice 1 — plans and first logging flow

Seed the generic starter plan, implement plan selection and the minimum plan editor, then implement Today, session start, rep stepper, set rows, finish, and account-backed persistence. Done when a user can create or select a plan, log a full training day from it, and the session survives a refresh. The example plan may be assigned to Friday for demonstration, but the logging flow must not depend on Friday or on this particular routine.

### Slice 2 — hold behavior

Add lead-in, hold timestamps, floor/raw rounding, form flag, level/equipment defaults, edit, undo, and rest. Done when a hold can be logged without waiting on a real timer using Fast demo.

### Slice 3 — guided stretches

Add ordered stretch sequence, transitions, custom duration, ratings, stretch skips, manual finish, auto-finish, and partial status.

### Slice 4 — history and legacy data

Add history browsing/editing and normalize the supplied legacy log into the same session records. Keep ambiguous values visible in the original excerpts rather than guessing.

### Slice 5 — review and analytics

The optional rest-day weekly reflection and stale behavior are implemented. Add PRs and chart selectors; render only the charts needed to assess whether the metrics are useful.

### Slice 6 — export and prototype cleanup

Add JSON/CSV export, reset/demo controls, README run instructions, and a short `PROTOTYPE_NOTES.md` recording what the prototype taught us. Do not polish it into a production app.

## 11. Acceptance walkthrough

The prototype is useful when a reviewer can perform this walkthrough without consulting implementation details:

1. Open Plans and see the example plan based on the supplied routine.
2. Create or edit a plan, add a day, add a superset block, and save it.
3. Activate that plan and open Today on its scheduled day.
4. Start the session and log a rep exercise.
5. Start a hold, fast-forward through lead-in, stop it, choose `clean`, and see the floored value and raw decimal.
6. Edit the value and observe `edited = true`; undo another set and confirm it disappears.
7. Complete or skip the stretch block and finish the session.
8. See status, duration, PRs, note, and sleep on the summary.
9. Refresh the browser and confirm the session remains.
10. Edit the plan, return to the old session, and confirm its historical targets are unchanged.
11. Open Analytics and see the new records reflected.
12. Enable reflection on a rest day, save the week's review, then start or change a session in that week and see the review become stale.
13. Open a historical session and confirm its recorded entries, note, duration, and original excerpt are visible.
14. Confirm the bundled legacy sessions coexist with newly logged sessions after refresh.

If any step feels awkward, the prototype has found a product or state-model problem before SwiftUI work begins.

## 12. Translation seam to SwiftUI

The browser prototype does not make the eventual app automatic, but it preserves the decisions most expensive to rediscover:

| Prototype | Later native implementation |
| --- | --- |
| `Exercise`, `Session`, `SetEntry`, and related records | SwiftData models |
| Reducer actions | Observable model methods / feature reducers |
| `timers.ts` timestamp rules | Swift timer state and ActivityKit content state |
| Analytics selectors | Swift Charts data preparation |
| Local-storage repository | SwiftData/CloudKit persistence adapter |
| Hash routes and screens | SwiftUI navigation destinations |
| Fast demo clock | Preview/test clock, not shipped behavior |

The prototype should not be copied line-for-line into the iOS app. Its value is the validated workflow, vocabulary, data shape, and explicit edge-case decisions.

## 13. Decisions to resolve while using the prototype

The source spec leaves these questions open. The prototype should make each one visible rather than burying a choice in UI code:

- whether rest records planned or actual duration
- whether side-specific stretches are separate entries
- whether lead-in applies to reps
- whether transitions run between stretch and hold blocks
- one level-up rule or per-skill/per-level rules
- day cutoff for sessions crossing midnight
- whether `skipReason` belongs on `SetEntry` or a separate record
- whether a skill is a table or a fixed identifier set
- whether user-created exercises should be private to the user or available across plans

The first implementation should use the simplest explicit defaults, label them in Settings, and make the resulting data easy to inspect and export.
