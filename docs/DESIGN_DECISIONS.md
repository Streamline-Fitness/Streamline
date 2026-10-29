# Design Decisions

> Append-only decision log for the browser prototype. Record meaningful product, interaction, data-model, and architecture decisions here. If a decision is later reversed, add a new entry rather than rewriting history.

## Decision status

- **Accepted** — use this decision in the current prototype.
- **Open** — intentionally unresolved; expose it in the prototype instead of hiding an assumption.
- **Superseded** — retained for history, but replaced by a later decision.

## D-001 — Build an interactive browser prototype first

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Validate the core training-log workflow in a browser before implementing the native SwiftUI app.
- **Why:** The MVP behavior—logging, timers, edits, reviews, import, analytics, and offline use—can be exercised without native Apple integrations. This lets product and state-model decisions be tested on Windows in VS Code.
- **Consequence:** The prototype validates behavior and interaction, not iOS platform integration. It must be clearly labelled as a prototype and remain easy to replace.

## D-002 — The prototype is not a production web app (superseded)

- **Status:** Superseded by D-068
- **Date:** 2026-10-21
- **Decision:** Do not add accounts, a backend, deployment infrastructure, social features, or production web concerns.
- **Why:** The eventual product is a native, offline-first iOS app. The browser exists to answer product questions before native implementation.
- **Consequence:** This decision excluded web accounts and backend storage; D-068 expands the prototype to validate those concerns.

## D-003 — Use React, TypeScript, Vite, and plain CSS

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Implement the prototype with React, TypeScript, Vite, and plain CSS.
- **Why:** This matches the available Windows/VS Code environment and supports a responsive interactive prototype without committing to a large UI framework.
- **Consequence:** Favor local UI modules and simple CSS that can be changed quickly. Do not optimize for production web deployment.

## D-004 — Keep records close to the future SwiftData model

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Model exercises, progression levels, user-owned plans, plan days, plan blocks, plan exercises, sessions, session plan snapshots, set entries, weekly reviews, and settings as explicit TypeScript records with stable IDs.
- **Why:** The prototype should settle vocabulary, data shape, and edge cases that will later be represented in SwiftData.
- **Consequence:** Do not collapse the model into UI-only state or hard-code logged values into screens.

## D-005 — Use a reducer as the application state seam

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** UI actions dispatch explicit actions to a pure reducer. Components must not calculate domain rules or mutate records directly.
- **Why:** Explicit transitions make timer, status, review-staleness, edit, and undo behavior visible and portable to the eventual native implementation.
- **Consequence:** Browser effects are limited to persistence, clock redraws, and navigation. The reducer receives the current time as an argument.

## D-006 — Timers use timestamps, not interval ticks

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Store timer timestamps and derive elapsed time from the injected current time. For holds, store `secondsRaw` and use `floor(secondsRaw)` for `seconds`.
- **Why:** Browser intervals can be delayed or throttled. Timestamp arithmetic reflects actual elapsed time and matches the source requirement.
- **Consequence:** A fast-demo clock can accelerate the prototype without changing timer behavior. The interval only redraws the UI.

## D-007 — Use localStorage behind a repository adapter (superseded)

- **Status:** Superseded by D-068
- **Date:** 2026-10-21
- **Decision:** Persist the versioned prototype document through a repository interface backed by `localStorage`.
- **Why:** Offline browser persistence is part of the workflow to validate, while CloudKit is explicitly outside the browser prototype.
- **Consequence:** This local-only persistence approach is replaced by account-backed Supabase storage in D-068.

## D-008 — Add a fast-demo clock

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Provide a visible real-time/fast-demo time mode for exercising long holds, rest periods, transitions, and stretches.
- **Why:** A prototype should make timing behavior testable without requiring the reviewer to wait for every real duration.
- **Consequence:** Fast-demo mode is a prototype tool, not a product requirement and must not become part of the eventual iOS feature set.

## D-009 — Keep native-only integrations out of MVP validation

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Do not implement real CloudKit, Live Activities, WidgetKit, HealthKit, App Intents, native local notifications, or native haptics in the browser prototype.
- **Why:** These are platform mechanisms, while the current product questions concern workflow, timing, state, and analytics.
- **Consequence:** The prototype may use visual or browser cues where useful, but those cues are not evidence that the native integration is solved.

## D-010 — Preserve ambiguous imports for review (superseded)

- **Status:** Superseded by D-067
- **Date:** 2026-10-21
- **Decision:** Imported text that cannot be parsed confidently is shown as unresolved and is never silently guessed or discarded.
- **Why:** Training history is user data, and incorrect historical records would contaminate PRs and analytics.
- **Consequence:** This decision described a user-facing import flow, which is not part of the prototype after D-067.

## D-011 — Represent skipped stretch reasons on SetEntry temporarily

- **Status:** Open
- **Date:** 2026-10-21
- **Decision:** The prototype temporarily uses optional `skipReason` on `SetEntry` to represent a skipped planned stretch.
- **Why:** The source specification requires a skip reason but does not define where it is stored.
- **Consequence:** The behavior can be exercised now, but the field must be accepted, moved to a dedicated record, or rejected before the SwiftData schema is finalized.

## D-012 — Prototype architecture supersedes unresolved implementation details in the source spec

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** `docs/PROTOTYPE_ARCHITECTURE.md` is the current implementation guide when it makes a concrete prototype choice that the source specification leaves open.
- **Why:** A runnable prototype needs explicit defaults while still recording unresolved decisions.
- **Consequence:** Open questions remain visible in both the architecture and this log; they are not treated as permanently settled product requirements.

## D-013 — Organize the prototype by responsibility

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Keep source code separated into `domain`, `state`, `storage`, `screens`, `ui`, and `styles` directories under `src/`.
- **Why:** The prototype needs to remain easy to inspect, change, and eventually translate into the native app. Separating pure rules from browser effects and presentation prevents business behavior from spreading through screens.
- **Consequence:** Route-level screens compose modules but do not own domain calculations. Persistence stays behind `storage/`, and reusable UI stays behind `ui/`. Temporary `.gitkeep` files preserve the scaffold until implementation files are added.

## D-014 — Keep detailed project context in docs/ and keep AGENTS.md concise

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Keep only concise, always-needed operating rules in the root `AGENTS.md`. Move detailed requirements, architecture, status, and decision history into `docs/`, with `AGENTS.md` and `docs/README.md` pointing agents to the relevant file for each task.
- **Why:** Most tasks do not need the entire product specification, architecture, status history, and decision log in context. Task-based loading reduces noise while preserving discoverability.
- **Consequence:** Agents must read `AGENTS.md` first and then load only the relevant document. The detailed documents remain authoritative for their respective concerns and must be kept current.

## D-015 — Plans are user-created, not hard-coded to one routine

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** The app's core planning model supports user-created plans with days, ordered blocks, exercise targets, round ranges, rest ranges, and side modes. The supplied lower-body routine is demo seed content only.
- **Why:** The product must be useful to anyone, not only the person whose routine inspired the prototype.
- **Consequence:** Plan creation and editing are part of the first vertical slice. The Today screen reads from the active plan rather than from a fixed Friday template.

## D-016 — Support block structures explicitly

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Represent straight sets, supersets, circuits, and timed sequences as explicit plan block types. Keep block round counts/rest ranges separate from each exercise's reps/seconds targets and side mode.
- **Why:** Supersets and timed mobility sequences are meaningful workflow structures, not merely display grouping. Keeping them explicit allows the logger and analytics to understand the user's plan.
- **Consequence:** The plan editor must expose block type, round range, exercise order, target range, side mode, and rest range.

## D-017 — Snapshot the plan when a session starts

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Expand the selected plan day into immutable session plan items when a session starts. Historical session status and targets use that snapshot, even if the user edits the plan later.
- **Why:** Editing a plan for next week must not rewrite what an earlier session meant or alter historical analytics.
- **Consequence:** The prototype has a `SessionPlanItem` record in addition to editable plan records. This decision should translate to a SwiftData snapshot or equivalent immutable session-planning representation.

## D-018 — Preserve side mode as data

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Exercises can specify `sideMode: "none" | "eachSide"`; the user does not need to duplicate an exercise to express left/right work.
- **Why:** The supplied routine includes Bulgarian split squats, lunges, and side planks performed on each side, and many users will have similar unilateral movements.
- **Consequence:** The logger must make side handling visible and analytics must avoid treating “10 each side” as indistinguishable from “10 total.”

## D-019 — Interpret “side blank” as “side plank” in demo data

- **Status:** Open
- **Date:** 2026-10-21
- **Decision:** The supplied phrase “side blank” is seeded as “side plank” for the example routine.
- **Why:** “Side plank” is the likely intended exercise, but the source phrase may be a typo or shorthand.
- **Consequence:** Keep this alias easy to change and do not treat it as a universal exercise-name correction during import.

## D-020 — Open on Today and derive its plan day from the viewed date

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** The app opens on the Today route. For the active plan and currently viewed date, Today automatically selects the plan day assigned to that weekday.
- **Why:** The primary user question on opening the app is “what am I doing today?” A manually remembered plan-day selection can show the wrong workout and undermines the pre-filled plan behavior.
- **Consequence:** Changing the viewed date recomputes the selected plan day. If no plan day is assigned for that date, Today shows an explanation and a direct action to open Plans. Users can still choose another plan day only when the date has a scheduled day.

## D-021 — Order plan days by weekday

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Training days in a plan editor and plan summaries are ordered Monday through Sunday. Unscheduled days appear afterward, ordered by creation order.
- **Why:** A weekly plan is easier to understand and edit when it follows the calendar rather than the order in which days happened to be created.
- **Consequence:** Changing a day’s weekday can change its position in the list. The underlying `order` remains available as a tie-breaker for multiple unscheduled days.

## D-022 — Make the exercise library editable with safe deletion

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** The Plan Editor includes an exercise-library section where users can edit exercise names, categories, patterns, and metrics. Built-in exercises can be edited but not deleted. Custom exercises can be deleted only when they are not used by a plan or historical set.
- **Why:** User-created plans require movements beyond the seeded library, and exercise naming or classification may need correction. Deleting an exercise referenced by a plan or history would orphan data.
- **Consequence:** The UI displays whether an exercise is built-in/custom and in use. Metric changes are prevented while an exercise is already used, preserving the meaning of existing targets and entries.

## D-023 — Edit one library exercise at a time

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** The exercise library is represented by a dropdown plus one focused editor for the selected exercise, rather than rendering every exercise as an open form.
- **Why:** An always-open form makes the Plan Editor noisy and turns the library into a second large editing screen. A focused selection keeps the common plan-authoring task primary while preserving access to library maintenance.
- **Consequence:** Selecting another exercise swaps the focused editor. The existing built-in/in-use deletion and metric safeguards remain active.

## D-024 — Use tooltips for controls whose purpose is not self-evident

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Add concise native browser tooltips and accessible labels to icon buttons, compact controls, date navigation, plan actions, block configuration, target fields, and exercise-library actions where the visible label alone may be ambiguous.
- **Why:** The prototype is intentionally dense and wireframe-like. Short controls such as arrows, ×, “Make active,” “Each side,” and numeric range fields need contextual help without adding permanent explanatory copy everywhere.
- **Consequence:** Tooltips supplement—not replace—visible labels and accessible names. Avoid adding tooltips to obvious text labels or every control.

## D-025 — Display exact targets without duplicated range endpoints

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** When an exercise's minimum and maximum target are equal, display one value with its unit, such as `60 sec` or `10 reps`, instead of `60–60 sec`.
- **Why:** Equal endpoints represent an exact target, not a range. Repeating the value looks like a formatting error and makes seeded stretch targets appear unfinished.
- **Consequence:** The same range formatter is used in plan editing and future target displays.

## D-026 — Do not prefill new plan exercises with demo values

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Each Add exercise row starts with an empty exercise selector, empty minimum/maximum target inputs, and an explicit placeholder. The Add button remains disabled until the user supplies a valid selection and range.
- **Why:** The seeded routine is demo content, not a default assumption for every new block. Prefilling Bulgarian split squat, 8–12, and Total makes it easy to accidentally add incorrect training data.
- **Consequence:** Adding a plan exercise is an intentional action. After an exercise is added, the row resets to blank for the next addition.

## D-027 — Capture complete exercise metadata when adding a custom exercise

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Custom exercise creation captures name, category, metric, pattern, optional skill ID, optional lead-in seconds, and optional default hold seconds. The focused exercise-library editor exposes and saves the same fields.
- **Why:** Creating an exercise with only a name and metric leaves important timer, progression, and analytics behavior undefined. Users should not have to create a partial exercise and immediately hunt for missing fields.
- **Consequence:** The add form is slightly larger but creates a complete exercise record. Optional fields remain blank when they do not apply.

## D-028 — Start exercise-library editing with no selection

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** The exercise-library dropdown starts with `Choose an exercise to edit…` and does not automatically select the first library entry.
- **Why:** Automatically opening the first exercise suggests that it is being edited and creates the same accidental-default problem as prefilled add-exercise rows.
- **Consequence:** The editor stays empty until the user intentionally chooses an exercise.

## D-029 — Keep plan blocks closed by default

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Each plan block in the editor is a closed accordion initially. The block opens through an explicit expand control to reveal rounds, rest, exercises, and add-exercise fields.
- **Why:** Plans with many blocks become difficult to scan when every block's settings and exercise rows are expanded. The user usually needs to choose which block to edit first.
- **Consequence:** The closed header shows the block name and exercise count; the block type remains editable in its selector without repeating the same value in the header. Expand/collapse controls have accessible state and tooltips.

## D-030 — Allow blocks to be deleted as a unit

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** A plan block can be deleted from its accordion header after confirmation. Deleting the block also deletes its plan-exercise assignments.
- **Why:** Plan editing must support removing a complete section, not just removing exercises one at a time. Leaving orphaned block exercises would make the plan model inconsistent.
- **Consequence:** The delete action is visible in every block header, has a tooltip and accessible name, and warns that the block's exercises will be removed from the plan. Historical session snapshots are unaffected.

## D-031 — Mark bilateral exercises in the exercise library

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** An exercise has a library-level `sideMode` of `none` or `eachSide`. Users set this while creating or editing the exercise, and every plan using that exercise inherits the setting.
- **Why:** The requested distinction is whether the movement is performed on both sides, not separate left/right programming targets. Side behavior belongs to the exercise definition rather than being repeated for every plan block.
- **Consequence:** The exercise library shows “One side / total” or “Both sides.” Plan exercise rows and Today targets display “each side” when the selected library exercise is bilateral.

## D-032 — Use concise side-mode labels

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** The side-mode control uses exactly two labels: `Total` and `Both Sides`.
- **Why:** The control answers a simple binary question. Longer labels made the form visually noisy and caused the side-mode change to dominate the surrounding exercise details.
- **Consequence:** Side mode remains descriptive in tooltips and accessible labels, while the visible options stay concise.

## D-033 — Show default hold only for timed exercises

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** The default-hold field is shown only when an exercise is a stretch or records seconds. It is hidden and cleared for rep-only exercises.
- **Why:** A default hold duration has no meaning for a rep-count exercise and makes the exercise form noisier.
- **Consequence:** Changing an exercise from timed/stretch to reps removes the incompatible default-hold value before save.

## D-034 — Use closed accordions for Today blocks

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Training blocks on Today are closed by default and expand individually to reveal their exercise cards and logging controls.
- **Why:** The user needs to see the shape of the session without being presented with every exercise at once. Individual expansion keeps the active logging context focused, especially for longer plans.
- **Consequence:** Each closed header shows the block number, name, rounds, and rest. The expand control has accessible state and a tooltip. Logging remains disabled until a session is started, as before.

## D-035 — Start sessions in guided exercise order

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Pressing Start session enters guided mode. The first planned exercise becomes current, its block opens automatically, and logging controls are enabled only for the current exercise. Completing an exercise advances through rest, then the block, rounds, and next block.
- **Why:** Starting a session should lead the user through the workout rather than presenting a full plan with no indication of what to do next.
- **Consequence:** The current exercise is visually highlighted. Other exercise controls remain visible for context but disabled. A future skip action can be added without changing the guided ordering seam.

## D-036 — Timed guided exercises own the visible hold/rest timer

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** A timed current exercise shows its elapsed timer on screen. Continue records `secondsRaw` from timestamps and `seconds = floor(secondsRaw)`, then starts the configured rest countdown. When rest reaches its endpoint, the next exercise starts automatically.
- **Why:** A guided workout must tell the user what to do now and remove manual transitions between a timed hold, rest, and the next exercise.
- **Consequence:** The browser interval only dispatches clock redraws. Timer truth remains in timestamps and reducer state. Rep exercises continue using their rep logging control and enter the same rest flow after logging.

## D-037 — Separate Start hold from Continue

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** An idle timed exercise's primary button starts the timestamp-based timer. Once the timer is running, the same control becomes Continue and records the elapsed hold.
- **Why:** Start hold and Continue are different state transitions. Treating both as Continue made the initial button appear to do nothing because no timer start had been recorded.
- **Consequence:** A resumed session can start an idle current hold; a running hold can be stopped and recorded; rest disables the current exercise until the rest countdown completes.

## D-038 — Allow guided blocks to be skipped with a reason

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** During a guided session, the current block can be skipped through a block-level action that requires a reason. The skip is stored as a `SkippedBlock` record and the guide advances to the next block.
- **Why:** A user may need to abandon an entire block because of time, equipment, pain, or a change in plan. Recording only skipped exercises loses the meaningful unit of the decision.
- **Consequence:** Today displays the skipped block and reason, and historical data can distinguish a skipped block from a block that was never planned or not yet reached.

## D-039 — Use configurable lead-in before every timed hold (supersedes D-039's prior block-rest behavior)

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Every timed hold/stretch uses the configurable lead-in as the preparation countdown. When preparation ends, the hold timer starts automatically; preparation time is not counted as hold time.
- **Why:** Every hold needs the same predictable time to get into position. The user explicitly changed the earlier decision that limited preparation to the first hold in a block and used block rest.
- **Consequence:** Preparation is represented as its own timestamp-based timer phase for every timed exercise. The on-screen label says `Get ready`, then changes to the hold timer automatically. Block rest remains post-set recovery/preparation between exercises, not the hold lead-in.
- **Clarification:** Starting a session on a timed first exercise enters this preparation phase immediately; the user does not need to press Start hold first.

## D-047 — Make the default hold lead-in configurable in Settings

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Settings exposes the default hold lead-in, initially 3 seconds. Timed exercises use this value unless an exercise-specific lead-in override exists.
- **Why:** Three seconds is the current preferred cue, but users may need more or less time to get into position.
- **Consequence:** Changing the setting affects future timer phases and is persisted in the local prototype document.

## D-040 — Use rest timing according to exercise type

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** When the current exercise is a timed stretch/hold and is first in its block, the block rest is a visible `Get ready` countdown before the hold. When the current exercise is strength/reps, the block rest starts after `Log set` and is displayed as a visible `Rest` countdown.
- **Why:** The same configured duration serves two different workflow purposes: preparation before a hold and recovery after strength work. The label must explain which one is happening.
- **Consequence:** Rest is not silently applied. The timer phase and label make preparation versus recovery explicit. The next guided exercise remains unavailable until post-set rest completes.

## D-041 — Derive skipped-block display from persisted session data

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Today does not keep a separate local skipped-block flag. It derives the display from `data.skippedBlocks` for the active session.
- **Why:** A local UI flag survived Reset demo and showed a block as skipped after the persisted demo data had been cleared.
- **Consequence:** Resetting data, changing sessions, or refreshing the browser cannot leave a stale skipped label. The reducer remains the only source of truth.

## D-042 — Reset demo also resets Today context

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Reset demo restores the seeded document and resets Today to the current date with no active session, guided exercise, timer, or stale view context.
- **Why:** Replacing data alone is not enough if the screen remains pointed at an old active session or date. That can make new seed data appear to retain the old session's skipped state.
- **Consequence:** Reset demo is a complete prototype reset, not only a data replacement.

## D-043 — Keep post-set Rest visible above Today content

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** When a strength set starts a rest phase, Today shows a top-level Rest banner with a live countdown in addition to the current exercise context.
- **Why:** The exercise card can be below the fold or hidden by accordion content. Rest is a session-level state the user must be able to see immediately after pressing Log set.
- **Consequence:** The rest timer is visually distinct from a stretch's `Get ready` timer and remains visible until the reducer advances the guide.

## D-044 — Anchor strength rest to the completed exercise

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** After a strength set is logged, the completed exercise remains the guided/current exercise while its Rest timer runs. The next exercise becomes current only after rest ends.
- **Why:** Rest is recovery from the exercise just completed, not a timer belonging to the next exercise. Moving the current marker immediately made the workflow semantically confusing.
- **Consequence:** The completed card shows `Rest` and its countdown; the next card remains unavailable until the countdown finishes.

## D-045 — Allow rest to be skipped

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** A user can press `Skip rest` on the completed exercise's rest timer to advance immediately to the next guided exercise.
- **Why:** The planned rest is a guide, not a hard lock. Users may be ready early or may need to adjust the session pace.
- **Consequence:** Skipping rest does not change the recorded set; it only ends the current rest phase and advances the guide. Actual rest timing can be derived later from timestamps.

## D-048 — Preserve partial block data when the block is skipped

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Skipping a block records a `SkippedBlock` marker but does not remove or invalidate any set entries already logged in that block. The skipped block displays its reason and logged entries, and analytics continue to use those entries.
- **Why:** A user may complete part of a block before running out of time, changing exercises, or needing to stop. Those completed sets remain valid training data and should contribute to volume, PR, consistency, and review calculations.
- **Consequence:** Skipped is a status of the planned block, not a command to erase its history. Future analytics must distinguish completed entries within a skipped block from exercises with no entries.

## D-049 — Keep the completed session summary discoverable

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Finishing a session preserves its records and summary identity. Today shows a saved-session card for the viewed date with a View summary action instead of immediately presenting Start session again. Hydration restores the latest finished summary context when the app was on the summary route.
- **Why:** Finishing must not make the logged data appear to disappear. The user needs confirmation that the session was saved and a direct route back to its summary.
- **Consequence:** `viewedSessionId` is separate from `activeSessionId`. A finished session is no longer active, but its data remains available for summary, review, and analytics.

## D-050 — Make the completed summary a record of what happened

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** The completed summary displays each planned block and exercise with the actual logged reps/seconds, skipped-block reasons, session note, sleep, and calculated session totals for sets, exercises touched, reps, and hold seconds.
- **Why:** A summary that only says a session is complete does not let the user verify what was recorded or understand its immediate contribution to analytics.
- **Consequence:** Summary selectors derive from stored set entries and skipped-block records. Later PR and trend selectors can reuse the same data.

## D-051 — Show the full summary in Today after finishing

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** After a session finishes, Today renders the detailed completed-session summary directly for the viewed date. The user can return to the regular plan view through the summary's Back to Today action.
- **Why:** The immediate post-session question is “what did I do?” A generic saved card plus collapsed plan does not answer that without another tap.
- **Consequence:** Today temporarily composes the summary screen when a finished session is being viewed. The summary remains persisted and can be reopened after refresh.

## D-054 — Derive Today summary from the latest finished session

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** When Today has no active session, it looks for the latest finished session on the viewed date if no transient `viewedSessionId` is available. That session's detailed summary is rendered in place.
- **Why:** The session records are persisted, but transient UI state may be lost during hydration or refresh. The user should not see Start session and empty plan blocks when a completed session already exists for that date.
- **Consequence:** Summary visibility is grounded in persisted session data. Reset demo clears the seeded sessions and therefore returns to the normal Start session state.

## D-055 — Pass resolved session identity into in-place summary

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** When Today resolves a finished session by date, it passes that session ID directly to the summary composition instead of relying only on transient app state.
- **Why:** The summary component previously looked only at `viewedSessionId`/`lastFinishedSessionId`, so Today could resolve a valid persisted session while the summary still reported no selection.
- **Consequence:** The summary has an explicit session identity at the composition seam and can render the correct stored records.

## D-056 — Keep Today navigation around the embedded summary

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** A completed session summary is rendered below Today’s normal date header and picker. It does not replace the Today route context or show a Back to Today button when embedded.
- **Why:** The summary is part of the Today experience for the selected date. Removing date navigation makes the user lose context and creates a nonsensical Back to Today action while already on Today.
- **Consequence:** Users can still change dates from the summary view. The detailed summary is shown only for the selected date’s finished session.

## D-057 — Round displayed session duration up

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Displayed session duration uses ceiling-minute rounding: any non-zero elapsed portion counts as the next whole minute.
- **Why:** A session lasting a few seconds should not appear to have lasted zero minutes in its summary.
- **Consequence:** A 2-minute-1-second session displays as 3 minutes. Timestamp precision remains available in the underlying session fields.

## D-052 — Use browser sound cues for timer milestones

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** The prototype plays short Web Audio cues for hold start, hold completion/rest start, and rest completion. Audio is best-effort because browsers require user interaction and may block playback.
- **Why:** Audible transitions are important during a workout, but native haptics/notifications are outside browser validation.
- **Consequence:** Timer state remains authoritative; sound is a presentation effect and never controls progression.

## D-053 — Prime audio from a user gesture and avoid duplicate transition cues

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Prime the browser AudioContext on the first pointer or keyboard gesture, before timer events need to play. Use one distinct three-tone cue for hold completion, which also marks the simultaneous start of rest; do not play a second rest-start sound.
- **Why:** Browsers commonly block audio contexts created or resumed from timer callbacks. The previous completion cue could therefore be silent even though the timer transitioned correctly.
- **Consequence:** Sound remains best-effort, but normal user interaction now unlocks the context before asynchronous timer milestones occur. Rest completion remains separately audible.

## D-046 — Treat rep targets as guidance, not validation limits

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Rep inputs accept any non-negative value, including values below the planned minimum or above the planned maximum. The target range remains visible as a comparison.
- **Why:** A training log must record what actually happened. A user may have a difficult set, stop early, exceed the target, or intentionally work outside the plan.
- **Consequence:** The browser input no longer uses the target range as HTML min/max validation. Later analytics can distinguish on-target and out-of-target performance without losing the set.

## Open decisions to resolve through use

These remain open unless a later entry resolves them:

- Planned versus actual rest duration in `restS`
- Separate left/right stretch entries versus one double-length entry
- Whether lead-in applies to rep exercises
- Whether transitions run between stretch and hold blocks
- One level-up rule versus per-skill/per-level rules
- Session day cutoff for late-night training
- Whether skipped-stretch reasons belong on `SetEntry` or a dedicated record
- Skill as a table versus a fixed identifier set

## D-067 — Bundle the supplied log as history, not an app import flow (superseded)

- **Status:** Superseded by D-068
- **Date:** 2026-10-29
- **Decision:** Normalize the user's supplied log into historical records bundled with the prototype. Merge those sessions, set entries, and weekly reflections into the existing local `DataDocument`; do not add a user-facing import screen or button.
- **Why:** The user wants this specific log to appear as history, not a workflow for importing arbitrary future files. Its free-form notes and ambiguous results must remain intact rather than being guessed.
- **Consequence:** This decision kept the supplied personal data in the client bundle and is replaced by account-specific migration in D-068.

## D-068 — Use account-backed cloud storage for the web prototype

- **Status:** Accepted
- **Date:** 2026-10-29
- **Decision:** Use Supabase Auth and store one versioned `DataDocument` JSONB row per authenticated user in Postgres. Enforce row-level security for reads and use a version-checked server function for writes. Keep the Supabase publishable key in browser configuration; never expose the service-role key to the browser.
- **Why:** The user wants to start with web and does not want training history to exist only in one browser's local cache. Account ownership and durable cloud storage are core product questions, not implementation details to defer.
- **Consequence:** The current state model stays intact while the source of truth moves to Postgres. Concurrent edits from another session fail visibly instead of silently overwriting. Offline edits and automatic conflict merging remain future work. The supplied personal history is migrated only to its designated account using a local admin script, never seeded for every registrant.

## D-069 — Support email codes and passwords for web sign-in (superseded)

- **Status:** Superseded by D-071
- **Date:** 2026-10-29
- **Decision:** Offer six-digit email-code sign-in alongside email/password sign-in. Let authenticated passwordless users set a password in the app, and provide email-code password recovery.
- **Why:** The user needs to authenticate directly in the VS Code browser viewer, where opening an email link on the same host is inconvenient.
- **Consequence:** This added email-code functionality but has been simplified to password-only sign-in and standard recovery links by D-071.

## D-071 — Default to password sign-in and use email only for recovery

- **Status:** Accepted
- **Date:** 2026-10-29
- **Decision:** Make email/password the only sign-in method shown. Remove in-app email-code sign-in, keep password account creation, and use Supabase's standard recovery email link for forgotten passwords.
- **Why:** The user wants to sign in directly in the VS Code viewer and does not want regular sign-in to depend on opening email.
- **Consequence:** Password recovery requires receiving and opening a recovery link in the app browser, unless the local admin password command is used when email delivery is rate-limited. No custom SMTP or OTP email template is required for password sign-in.

## D-060 — Show duplicate-weekday selection only before a session

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Today automatically uses the only plan day scheduled for the viewed weekday. It shows a clearly labelled workout selector only when multiple plan days share that weekday, and hides the selector during an active session or completed summary.
- **Why:** A dropdown containing every training day made its purpose unclear and implied that any day could be selected for the current date. The only meaningful choice is between duplicate weekday options, such as two different Friday workouts.
- **Consequence:** The selector is labelled “Choose your [weekday] workout,” contains only the plan days scheduled for that weekday, and explains why it appears. The selected plan day remains available in the persisted session snapshot.

## D-058 — Preserve an explicitly selected duplicate weekday

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** If an active plan contains multiple training days assigned to the same weekday, Today preserves the explicitly selected day for that weekday. Moving to another date recomputes the scheduled day for the new weekday.
- **Why:** A user may intentionally create two Friday options, such as a strength Friday and a mobility Friday. Falling back to the first Friday every render makes the selector appear to change successfully while the selected session or summary can refer to a different day.
- **Consequence:** The scheduled-day selector accepts a same-weekday plan day as the current choice. Selecting a day from another weekday is ignored, and changing dates resets selection to the first day scheduled for the new weekday.

## D-059 — Recover completed summaries from persisted sessions

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** The summary view validates transient session IDs against persisted finished sessions and falls back to the latest finished session for the selected date, then the latest finished session overall.
- **Why:** Route and view identity are transient browser state. A refresh, stale hash route, or plan-day change must not produce “No finished session selected” when a completed session is still stored.
- **Consequence:** Summary rendering remains grounded in persisted session records, while unfinished or missing transient IDs cannot replace a valid completed-session fallback.

## D-061 — Seed the supplied Monday-Sunday training template

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** New and reset demo data uses the supplied weekly template. Active stretches precede the Monday, Wednesday, and Friday workouts; passive mobility precedes Tuesday, Thursday, and Saturday progressions. Exercises without a stated hold duration remain untargeted and use the stopwatch.
- **Why:** The template's weekly order, mobility placement, ranges, and test days are the behavior the prototype should make usable and reviewable.
- **Consequence:** Existing browser storage is preserved and must be explicitly reset to load the new seed. Unilateral Bulgarian split squats, lunges, and side planks are marked as each-side work. The app cannot enforce the 2-3 minute rest between Tuesday/Thursday progression blocks, so that instruction is included in the plan description; Saturday test rests are represented by their block rest. Session notes use the existing session-note field, and session time is calculated from timestamps. Sunday is a reflection-only plan day until the weekly-review workflow is implemented.

## D-062 — Group the weekly template blocks as specified

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Keep Active Stretches as the first standalone block on Monday, Wednesday, and Friday. Make Monday's blocks 2-3, Wednesday's blocks 2-3, and Friday's blocks 2-3, 4-5, and 6-7 supersets. Combine the three passive mobility categories into one block named `Passive Stretches` on Tuesday, Thursday, and Saturday.
- **Why:** This is the user's clarified intended workout grouping and should be visible in the plan and guided session flow.
- **Consequence:** Exercise order and per-block round/rest ranges are retained inside the new groups. Passive stretches remain an ordered timed sequence. The earlier grouping implied by the initial seed is superseded.

## D-063 — Advance immediately when timed work has no rest

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** After a timed entry, if the current block has no positive rest duration, immediately select the next planned exercise and start its preparation phase when it is timed.
- **Why:** A zero-rest stretch sequence should move to the next stretch rather than leave the just-completed exercise selected for another set.
- **Consequence:** Continue and automatic target completion use the same progression rule. Positive rest durations retain the existing rest phase and advance when rest ends.

## D-064 — Play the hold-complete cue on every timed-exercise exit

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Play the hold-complete sound whenever a timed exercise exits its exercise phase, whether it transitions to Rest, preparation for the next timed exercise, or idle.
- **Why:** Zero-rest stretch sequences advance directly instead of entering Rest, but completion still needs an audible cue.
- **Consequence:** The separate rest-complete cue remains tied to leaving the Rest phase. Browser audio remains best-effort and requires a prior user gesture.

## D-065 — Stop untargeted holds manually

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Seconds-based exercises without a positive target duration use an open-ended stopwatch and finish only when the user presses Continue.
- **Why:** Evaluation tests and holds such as Dead Hang have no prescribed time, so treating an absent target as zero ends them immediately and loses the user's actual result.
- **Consequence:** Positive timed targets still auto-finish at their target. Untargeted exercises use the same set and rest progression after the user stops the stopwatch.

## D-066 — Make weekly reflection optional on rest days

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision:** Model rest days on plan days, with an independent option to enable the weekly reflection workflow. The seeded Sunday is a rest day with reflection enabled. Weekly reviews cover Monday through Sunday and are keyed by the Monday date.
- **Why:** Reflection should fit naturally into a user's chosen rest day rather than require a special workout or a fixed Sunday-only feature.
- **Consequence:** This resolves the open Monday-versus-Tuesday week-start question in favor of Monday. Rest-day workouts are hidden from Today without deleting their plan blocks. The review summarizes the week's recorded sessions and supports an editable reflection and next-week goal. Starting or changing a session in that week marks an already-saved review stale.

## D-070 — Put account and settings actions behind an initials avatar

- **Status:** Accepted
- **Date:** 2026-10-29
- **Decision:** Replace the always-visible password/sign-out controls and Settings navigation tab with a top-corner account avatar. Use the user's initials when no profile image exists; the avatar menu contains Settings, password management, and sign-out.
- **Why:** The user wants account actions and Settings grouped behind a familiar profile control rather than occupying the primary navigation and header.
- **Consequence:** Keep workout navigation focused on Plans, Today, and History. Settings remains accessible from the account menu on every screen.

## D-072 — Host the prototype on GitHub Pages

- **Status:** Accepted
- **Date:** 2026-10-29
- **Decision:** Publish the static web prototype through GitHub Pages using a GitHub Actions workflow and the repository's `github.io` URL. Keep Supabase as the authentication and data backend.
- **Why:** The user wants a hosted app without purchasing or configuring a custom domain.
- **Consequence:** Build the Vite app with the repository path as its base URL and configure Supabase Auth redirects for the hosted path. Only the Supabase URL and publishable key are used at build time; never expose the service-role key. Treat the site as a public prototype, not a production service.
