# Prototype Status

> Living document. Update this file whenever a meaningful prototype change is made. The goal is to let a new agent understand what exists, what was learned, and what should happen next without reconstructing the entire conversation.

## Current state

- **Overall phase:** Implementation
- **Current slice:** Seeded weekly training template and optional rest-day reflection
- **Next implementation slice:** Hands-on walkthrough of the seeded week
- **Prototype runnable:** Yes — run `npm install` then `npm run dev`
- **Last updated:** 2026-10-21

## Completed

- Read and reviewed `docs/requirements/Training Log iOS App Spec v2.md`.
- Defined the browser prototype boundary in `docs/PROTOTYPE_ARCHITECTURE.md`.
- Defined the prototype's domain records, reducer seam, timer semantics, screens, build slices, and acceptance walkthrough.
- Revised the model so users create and activate their own plans instead of using a hard-coded routine.
- Added explicit plan days, block types, round/rest ranges, exercise targets, side modes, and session plan snapshots.
- Replaced the initial lower-body demo routine with the supplied Monday-Sunday weekly training template, including active/passive mobility and progression tests.
- Seeded Sunday as a rest day with weekly reflection enabled; plan days can independently enable reflection when marked as rest days.
- Added a weekly reflection screen with a Monday-Sunday activity summary, editable reflection and next-week goal, persistence, and stale-review state when the week's sessions change.
- Scaffolded the Vite + React + TypeScript application.
- Implemented the first plan-authoring flow: plans, training days, blocks, exercise targets, side mode, custom exercises, and active-plan selection.
- Implemented Today plan preview, rep logging, previous-result display, session finish, summary editing, and local browser persistence.
- Implemented session plan snapshots so later plan edits do not rewrite started-session targets.
- Changed the app to open on Today and automatically select the active plan's day for the viewed date.
- Added a direct Plans action when the active plan has no training day scheduled for the viewed date.
- Added plan name/description editing, training-day renaming/deletion, and Monday–Sunday day ordering.
- Restored the plan's actual name as the Plan Editor heading and added an editable exercise-library section.
- Changed the exercise library to a dropdown with one focused exercise editor instead of showing all exercise forms at once.
- Added contextual tooltips and accessible labels to compact, icon, date, plan, block, target, and exercise-library controls.
- Compact target ranges now display equal values once (for example, `60 sec` instead of `60–60 sec`).
- Add-exercise controls now start blank with placeholders and require an explicit exercise and valid target range before adding.
- Custom exercise creation and library editing now include category, metric, pattern, skill ID, lead-in, and default hold fields.
- The exercise-library editor now starts with a “Choose an exercise to edit…” placeholder instead of selecting the first exercise automatically.
- Plan blocks now render as closed accordions by default with explicit expand/collapse controls.
- Removed the duplicate block-type summary from accordion headers; the block type now appears only in its selector.
- Added confirmed block deletion; deleting a block also removes its plan-exercise assignments without changing historical session snapshots.
- Added exercise-library side mode so users can mark movements as “One side / total” or “Both sides.”
- Corrected the side-mode formatting and reorganized the exercise detail fields into readable rows.
- Default-hold inputs now appear only for stretch or seconds-based exercises and are cleared when no longer applicable.
- Today training blocks now use closed accordions with individual expand/collapse controls.
- Starting a session now enters guided mode: the current block opens, one exercise is highlighted, and logging/skip advances through the plan.
- Timed guided exercises now show an on-screen timestamp-based timer; Continue records the hold, enters rest, and automatically advances when rest ends.
- Fixed the initial Start hold action so idle timed exercises start their timestamp timer instead of attempting to continue an inactive timer.
- Added block-level skipping with a required reason, persisted `SkippedBlock` records, and visible skipped-block state in Today.
- The first hold in each block now uses that block's designated rest time as a visible preparation countdown before automatically starting.
- Start session now immediately enters the preparation countdown when the first exercise is a timed hold; the hold begins automatically after the displayed countdown.
- Strength/reps now show a visible Rest countdown after Log set, using the block's designated rest duration before the guide advances.
- Reset demo now clears all skipped-block indicators because Today derives skip state only from persisted session data.
- Reset demo now also clears the selected date and active-session view, preventing the previous session's skipped-block state from being displayed after reset.
- Changed timed preparation so every hold/stretch uses the configurable lead-in instead of block rest; added Settings with a default of 3 seconds.
- Skipped blocks now retain all entries logged before the skip and display the skip reason plus completed sets on Today.
- Finished sessions now retain their completed summary context; Today shows a saved-session card instead of a new Start session button, and the summary can be reopened after refresh.
- Completed summaries now display actual sets/reps/hold times by block and exercise, skipped reasons, editable note/sleep, and session analytics totals.
- After finishing, Today now renders the full summary in place rather than a generic saved-session card.
- Today now derives the latest finished session for the viewed date when needed, so the full summary remains visible after a refresh even if transient view state was not restored.
- Fixed the in-place summary to pass the resolved persisted session ID directly, preventing the summary from saying “No finished session selected.”
- Kept Today’s date picker/header visible while rendering the completed summary inline; removed the misleading Back to Today action from the embedded summary.
- Session duration now rounds up to the next whole minute so a short completed session does not display as 0 minutes.
- Added best-effort browser sound cues for hold start, hold completion/rest start, and rest completion.
- Primed the browser AudioContext from the first user gesture and made the hold-complete cue more distinct before rest begins.
- Removed the duplicate rest-start sound because hold completion and rest start are the same transition.
- Added a persistent top-level Rest banner so strength recovery remains visible even while the current block is expanded or the exercise card is below the fold.
- Moved the strength Rest countdown onto the just-completed exercise card; the guide keeps that card current until rest ends, then advances to the next exercise.
- Added Skip rest on the completed exercise card so the user can advance before the configured rest ends.
- Rep entry no longer clamps input to the target minimum or maximum; the target range is guidance and actual logged performance may fall outside it.
- Seeded the supplied active stretches before Monday, Wednesday, and Friday workouts, and passive mobility before Tuesday, Thursday, and Saturday progressions.
- Grouped Monday's push/pull work, Wednesday's push/pull work, and Friday's three exercise pairs into supersets; grouped Tuesday, Thursday, and Saturday mobility into a single Passive Stretches block each.
- Added stopwatch logging for seconds-based exercises without a prescribed duration, preserving untargeted tests and holds without inventing goals.
- Untargeted timed exercises such as Dead Hang now remain on the stopwatch until Continue; only exercises with a positive duration target auto-finish.
- Fixed guided timed-exercise progression when a block has zero rest: Continue and automatic target completion now advance immediately to the next exercise.
- Fixed the hold-complete sound cue so timed exercises ending into preparation or idle also play it, not only exercises that enter Rest.
- Added `AGENTS.md` with repository purpose and working rules.
- Organized detailed project documents under `docs/` and added `docs/README.md` as a task-based context-loading guide.
- Created the organized `src/` directory scaffold for domain, state, storage, screens, UI, and styles.
- Expanded the root `README.md` with setup instructions, current capabilities, usage walkthrough, data model, architecture, scope, development workflow, and troubleshooting guidance.
- Preserved explicit Today selection when an active plan has multiple training days on the same weekday, and made the completed summary recover from persisted finished sessions when transient summary identity is stale or missing.
- Clarified Today plan-day selection: the app auto-uses the only workout scheduled for a weekday, and shows a clearly labelled selector only when multiple workouts share that weekday; it remains hidden during active sessions and completed summaries.
- Decided that native-only integrations such as iCloud, Live Activities, WidgetKit, HealthKit, native notifications, and App Intents are outside the browser prototype's validation scope.

## In progress

- The seeded week and Sunday reflection workflow build successfully. The next work is to walk through weekday ordering, set/rest behavior, untargeted hold logging, and saving/revisiting a weekly reflection in the browser.
- Browser smoke verification confirmed the seeded Sunday rest day, reflection toggle, review save across reload, and stale marking after starting a session in the reviewed week. On reflection-enabled rest days, Today renders the weekly reflection and editable form directly; the extra rest-day card and open button are gone. Browser verification confirmed the reflection is visible on Sunday with no rest-day intro. The full seeded-week walkthrough remains pending.

## Not yet implemented

- History, import, PRs, richer analytics, and export

## Recommended next step

Verify the seeded weekly template in the browser:

1. Use Reset demo to load the new seed; existing browser storage is intentionally not overwritten.
2. Check active stretches remain separate on Monday/Wednesday/Friday, the requested exercise pairs are supersets, and Tuesday/Thursday/Saturday each have one Passive Stretches block.
3. Confirm each 60-second active stretch advances after Continue despite the block's 0-second rest; log a Dead Hang or Saturday progression test and confirm the stopwatch records seconds without a target range.
4. Check progression rest behavior, especially the 2-3 minute between-exercise note on Tuesday and Thursday.
5. Finish a session, add a session note, and confirm the duration is calculated from session timestamps.
6. Confirm Sunday shows the weekly reflection directly, save both fields, and verify later changes to that week's sessions mark the review stale.
7. In Plans, disable reflection on the Sunday rest day and confirm the reflection action no longer appears; re-enable it and verify the review is still available.

Do not begin analytics or visual polish until this complete path is usable.

## Verification history

| Date | Change | Verification |
| --- | --- | --- |
| 2026-10-21 | Made untargeted hold timers manual-stop | `npm run build` passes; browser walkthrough pending |
| 2026-10-21 | Added optional weekly reflection on rest days | `npm run build` passes; browser verified seed, toggle visibility, persistence after reload, and stale state after a same-week session start |
| 2026-10-21 | Made reflection the rest-day content | `npm run build` passes; browser confirmed Sunday renders the reflection form directly without the rest-day intro or a separate open button |
| 2026-10-21 | Fixed hold-complete sound on zero-rest transitions | `npm run build` passes; browser audio check pending |
| 2026-10-21 | Fixed timed progression with zero rest | `npm run build` passes; browser walkthrough pending |
| 2026-10-21 | Seeded the supplied weekly training template | `npm run build` passes; browser walkthrough pending |
| 2026-10-21 | Created prototype architecture | Document reviewed against the source specification |
| 2026-10-21 | Created agent instructions | Scope and build rules recorded in `AGENTS.md` |
| 2026-10-21 | Organized project documentation | Detailed documents moved under `docs/`; task-based loading added |
| 2026-10-21 | Created source directory scaffold | Responsibility-based `src/` folders are ready for Slice 1 |
| 2026-10-21 | Generalized routine model | User-created plans, explicit supersets, side modes, and session snapshots added |
| 2026-10-21 | Implemented Slice 1 | Vite app builds; plan authoring, rep logging, summary, and local persistence added; `npm run build` passes |
| 2026-10-21 | Improved Today entry behavior | App opens on Today, derives the plan day from the viewed date, and links to Plans when unplanned |
| 2026-10-21 | Improved plan editing | Plan details and training days can be edited/deleted; scheduled days sort Monday through Sunday |
| 2026-10-21 | Added exercise library editing | Exercise metadata can be edited; built-in and in-use deletion is guarded; `npm run build` passes |
| 2026-10-21 | Focused exercise library editor | A dropdown selects one exercise for editing; `npm run build` passes |
| 2026-10-21 | Added useful control tooltips | Ambiguous controls now provide concise context; `npm run build` passes |
| 2026-10-21 | Fixed equal target range display | Exact targets display once instead of as duplicated min/max values; `npm run build` passes |
| 2026-10-21 | Fixed add-exercise defaults | Exercise and target inputs start as placeholders instead of defaulting to Bulgarian split squat, 8–12, and Total; `npm run build` passes |
| 2026-10-21 | Expanded exercise metadata | Custom exercise creation and editing capture the complete exercise details; `npm run build` passes |
| 2026-10-21 | Fixed exercise-library picker default | Library editing starts blank with an explicit selection placeholder; `npm run build` passes |
| 2026-10-21 | Closed plan block accordions | Block details are collapsed by default and expose accessible expand/collapse controls; `npm run build` passes |
| 2026-10-21 | Simplified block accordion headers | Removed duplicate block-type text from the header; `npm run build` passes |
| 2026-10-21 | Added block deletion | Blocks can be deleted with confirmation and their child assignments are removed; `npm run build` passes |
| 2026-10-21 | Added exercise-library side mode | Bilateral behavior is configured once in the exercise library and inherited by plans; `npm run build` passes |
| 2026-10-21 | Fixed side-mode formatting | Side controls now use exactly `Total` and `Both Sides`; exercise forms are laid out in grouped rows; `npm run build` passes |
| 2026-10-21 | Scoped default-hold fields | Rep-only exercises no longer show or retain a default-hold value; `npm run build` passes |
| 2026-10-21 | Added Today block accordions | Today blocks are collapsed by default and expand to show exercise logging controls; `npm run build` passes |
| 2026-10-21 | Added guided session flow | Start session opens the current block and advances through planned exercises after logging or skipping; `npm run build` passes |
| 2026-10-21 | Added guided hold/rest timer | Timed exercises record floored elapsed seconds on Continue, show rest countdown, and advance automatically; `npm run build` passes |
| 2026-10-21 | Fixed Start hold action | Start hold now dispatches the timer-start transition before Continue records elapsed time; `npm run build` passes |
| 2026-10-21 | Added guided block skip | Current blocks can be skipped with a reason that is persisted and displayed; `npm run build` passes |
| 2026-10-21 | Added block-rest hold preparation | The first hold in a block shows the block rest countdown before automatically starting; `npm run build` passes |
| 2026-10-21 | Corrected initial hold preparation timing | Starting on a first-block hold immediately shows its preparation countdown; `npm run build` passes |
| 2026-10-21 | Added strength rest display | Rep logging now starts a visible post-set Rest timer before advancing; `npm run build` passes |
| 2026-10-21 | Fixed reset skipped state | Reset demo no longer leaves a stale “Skipped” block label in Today; `npm run build` passes |
| 2026-10-21 | Fixed reset session context | Reset demo returns Today to the current date with no active session; `npm run build` passes |
| 2026-10-21 | Made hold lead-in configurable | Every timed hold uses the Settings lead-in, initially 3 seconds; Settings screen added; `npm run build` passes |
| 2026-10-21 | Preserved partial skipped-block data | Skipping a block keeps its logged sets available to Today and future analytics; `npm run build` passes |
| 2026-10-21 | Preserved completed session summary | Finish keeps session data and exposes View summary from Today, including after hydration; `npm run build` passes |
| 2026-10-21 | Expanded completed summary | Summary now shows performed work, skips, notes, sleep, and calculated analytics totals; `npm run build` passes |
| 2026-10-21 | Integrated summary and timer sounds | Today shows the full completed summary after finish; Web Audio cues mark timer transitions; `npm run build` passes |
| 2026-10-21 | Restored summary from persisted session date | Today finds the latest finished session for the viewed date when transient summary identity is missing; `npm run build` passes |
| 2026-10-21 | Fixed resolved summary identity | Today passes the finished session ID into the detailed summary; `npm run build` passes |
| 2026-10-21 | Kept summary inside Today context | Date navigation remains visible and embedded summaries no longer show Back to Today; `npm run build` passes |
| 2026-10-21 | Rounded session duration up | Completed session duration uses ceiling-minute display; `npm run build` passes |
| 2026-10-21 | Improved hold-complete sound reliability | Audio is primed from a user gesture and hold completion uses a stronger three-tone cue; `npm run build` passes |
| 2026-10-21 | Removed duplicate rest-start cue | Hold completion provides the single transition sound; rest completion remains audible; `npm run build` passes |
| 2026-10-21 | Added persistent rest banner | Post-set strength rest is visible at the top of Today with a live seconds countdown; `npm run build` passes |
| 2026-10-21 | Anchored strength rest to completed card | Rest now remains on the exercise that was just logged instead of moving the current marker to the next exercise; `npm run build` passes |
| 2026-10-21 | Added skip-rest control | Rest can be ended early from the completed exercise card and advances the guide; `npm run build` passes |
| 2026-10-21 | Allowed reps outside target range | Rep inputs accept any non-negative count while displaying the planned target for comparison; `npm run build` passes |
| 2026-10-21 | Expanded project README | Added setup, usage, architecture, persistence, scope, development, documentation, and troubleshooting guidance; `npm run build` passes |
| 2026-10-21 | Fixed duplicate-Friday selection and summary recovery | Same-weekday plan-day choices remain selectable; completed summaries fall back to persisted finished sessions; `npm run build` passes |
| 2026-10-21 | Simplified active-session Today view | Training-day selection is hidden after session start; `npm run build` passes |
| 2026-10-21 | Simplified completed-session Today view | Training-day selection is also hidden while the completed summary is visible; `npm run build` passes |
| 2026-10-21 | Clarified duplicate-weekday workout selector | Selector now appears only for multiple workouts on the viewed weekday, lists only those workouts, and explains its purpose; `npm run build` passes |

## How to update this file

After a meaningful change, update:

- `Current state` if the active slice or runnable state changed.
- `Completed` when a workflow or architectural task is actually verified.
- `In progress` and `Not yet implemented` to prevent stale claims.
- `Recommended next step` when the next best action changes.
- `Verification history` with the date, change, and command or walkthrough used to verify it.

Do not record every small CSS edit. Record changes that affect scope, behavior, architecture, data shape, or what another agent should do next.
