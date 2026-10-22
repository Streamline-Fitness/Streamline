import { useEffect, useMemo, useRef, useState } from "react";
import { newId } from "../domain/ids";
import { entriesForPlanExercise, entriesForSession, itemsForSession, latestFinishedSession, previousEntryForExercise, sessionDurationMinutes } from "../domain/session";
import { getActivePlan, getPlanDays, getScheduledDayForDate, shiftDate, todayISO, weekdayFromISO } from "../domain/plan";
import type { SessionPlanItem } from "../domain/model";
import type { AppState } from "../state/appState";
import type { Action } from "../state/reducer";
import { ExerciseCard } from "../ui/ExerciseCard";
import { playEventSound, primeEventSounds } from "../ui/sounds";
import { SessionSummaryScreen } from "./SessionSummaryScreen";
import { WeeklyReviewScreen } from "./WeeklyReviewScreen";

type Props = { state: AppState; dispatch: (action: Action) => void };

export function TodayScreen({ state, dispatch }: Props) {
  useEffect(() => {
    const prime = () => {
      primeEventSounds();
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
    window.addEventListener("pointerdown", prime, { once: true });
    window.addEventListener("keydown", prime, { once: true });
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => dispatch({ type: "CLOCK_TICK", now: Date.now() }), 250);
    return () => window.clearInterval(id);
  }, [dispatch]);

  const previousTimerPhase = useRef(state.guidedTimer.phase);
  useEffect(() => {
    const previous = previousTimerPhase.current;
    const current = state.guidedTimer.phase;
    if (previous !== current) {
      if ((previous === "idle" && current === "exercise") || (previous === "preparation" && current === "exercise")) playEventSound("holdStart");
      if (previous === "exercise" && current !== "exercise") playEventSound("holdComplete");
      if (previous === "rest" && current !== "rest") playEventSound("restComplete");
      previousTimerPhase.current = current;
    }
  }, [state.guidedTimer.phase]);

  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({});
  const activePlan = getActivePlan(state.data);
  const days = activePlan ? getPlanDays(state.data, activePlan.id) : [];
  const weekday = weekdayFromISO(state.selectedDate);
  const scheduledDays = days.filter((day) => day.weekday === weekday);
  const scheduledDay = activePlan ? getScheduledDayForDate(state.data, activePlan.id, state.selectedDate, state.selectedPlanDayId) : undefined;
  const selectedDayId = scheduledDay?.id;
  const selectedDay = selectedDayId ? state.data.planDays[selectedDayId] : undefined;
  const activeSession = state.activeSessionId
    ? state.data.sessions[state.activeSessionId]
    : Object.values(state.data.sessions).find((session) => session.date === state.selectedDate && !session.finishedAt);
  const viewedSession = state.viewedSessionId ? state.data.sessions[state.viewedSessionId] : undefined;
  const completedSession = viewedSession?.date === state.selectedDate && viewedSession.finishedAt
    ? viewedSession
    : latestFinishedSession(state.data, state.selectedDate);
  const sessionItems = activeSession ? itemsForSession(state.data, activeSession.id) : [];
  const planPreview = selectedDay
    ? Object.values(state.data.planBlocks)
      .filter((block) => block.dayId === selectedDay.id)
      .sort((a, b) => a.order - b.order)
      .flatMap((block) => Object.values(state.data.planExercises)
        .filter((item) => item.blockId === block.id)
        .sort((a, b) => a.order - b.order)
        .map((item) => ({ item, block })))
    : [];
  const items: SessionPlanItem[] = activeSession
    ? sessionItems
    : planPreview.map(({ item, block }) => ({
      id: item.id,
      sessionId: "preview",
      blockId: block.id,
      planExerciseId: item.id,
      blockOrder: block.order,
      exerciseOrder: item.order,
      blockName: block.name,
      blockType: block.type,
      roundsMin: block.roundsMin,
      roundsMax: block.roundsMax,
      restMinS: block.restMinS,
      restMaxS: block.restMaxS,
      exerciseId: item.exerciseId,
      exerciseName: state.data.exercises[item.exerciseId]?.name ?? "Exercise",
      repsMin: item.repsMin,
      repsMax: item.repsMax,
      secondsMin: item.secondsMin,
      secondsMax: item.secondsMax,
      sideMode: item.sideMode,
    }));
  const grouped = useMemo(
    () => items.reduce<Record<string, SessionPlanItem[]>>((groups, item) => {
      (groups[item.blockId] ??= []).push(item);
      return groups;
    }, {}),
    [items],
  );
  const isToday = state.selectedDate === todayISO();
  const priorDate = activeSession?.date ?? state.selectedDate;
  const weekdayName = new Date(`${state.selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" });
  const showDayPicker = !activeSession && !completedSession && scheduledDays.length > 1;

  return <section className="screen today-screen">
    <div className="today-header">
      <div>
        <div className="eyebrow">{isToday ? "TODAY" : "PLANNED DAY"}</div>
        <h2>{new Date(`${state.selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2>
        <p>{activePlan ? activePlan.name : "Create a plan to get started."}</p>
      </div>
      <div className="date-controls">
        <button className="icon-button" title="View the previous day" aria-label="Previous day" onClick={() => dispatch({ type: "SELECT_DATE", date: shiftDate(state.selectedDate, -1) })}>←</button>
        <button className="date-chip" title="Return to today's date" onClick={() => dispatch({ type: "SELECT_DATE", date: todayISO() })}>Today</button>
        <button className="icon-button" title="View the next day" aria-label="Next day" onClick={() => dispatch({ type: "SELECT_DATE", date: shiftDate(state.selectedDate, 1) })}>→</button>
      </div>
    </div>

    {!activePlan ? <div className="empty-panel"><h3>No active plan</h3><p>Create a plan before logging a day.</p><button className="button primary" onClick={() => dispatch({ type: "NAVIGATE", route: "plans" })}>Open plans</button></div>
      : !scheduledDay ? <div className="empty-panel no-plan-day"><div className="eyebrow">NOT PLANNED</div><h3>No training day for this date</h3><p>Your active plan has no day assigned to {new Date(`${state.selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" })}.</p><button className="button primary" onClick={() => dispatch({ type: "NAVIGATE", route: "plans" })}>Open Plans to add a day</button></div>
        : <>
           {showDayPicker && <div className="plan-selector"><label htmlFor="day-selector">Choose your {weekdayName} workout</label><select id="day-selector" title={`Choose which ${weekdayName} workout to do`} value={selectedDayId ?? ""} onChange={(event) => dispatch({ type: "SELECT_PLAN_DAY", dayId: event.target.value })}>{scheduledDays.map((day) => <option key={day.id} value={day.id}>{day.name}</option>)}</select><span>Your active plan has multiple workouts scheduled for {weekdayName}.</span></div>}
          {completedSession?.date === state.selectedDate && !activeSession ? <SessionSummaryScreen state={state} dispatch={dispatch} sessionId={completedSession.id} embedded /> : selectedDay?.isRestDay && selectedDay.reflectionEnabled ? <WeeklyReviewScreen key={state.selectedDate} state={state} dispatch={dispatch} embedded /> : selectedDay?.isRestDay ? <div className="rest-day-panel empty-panel"><div className="eyebrow">REST DAY</div><h3>{selectedDay.name}</h3><p>Take today off from planned training.</p></div> : <>
            {activeSession && <div className="session-running"><div><span className="live-dot" /> Session in progress</div><span>Started {activeSession.startedAt ? new Date(activeSession.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "now"}</span></div>}
            {!activeSession && selectedDay && <button className="button primary start-button" title="Start a session from this plan-day snapshot" onClick={() => dispatch({ type: "START_SESSION", sessionId: newId("session"), date: state.selectedDate, planId: activePlan.id, planDayId: selectedDay.id, now: Date.now() })}>Start session <span>→</span></button>}
            {Object.entries(grouped).map(([blockId, blockItems]) => <TodayBlock key={blockId} blockId={blockId} blockItems={blockItems} state={state} dispatch={dispatch} openBlocks={openBlocks} setOpenBlocks={setOpenBlocks} priorDate={priorDate} />)}
            {activeSession && <div className="finish-bar"><div><strong>Ready to finish?</strong><span>{entriesForSession(state.data, activeSession.id).length} set(s) logged · {sessionDurationMinutes({ ...activeSession, finishedAt: Date.now() }) ?? 0} min elapsed</span></div><button className="button primary" title="End this session and open its summary" onClick={() => dispatch({ type: "FINISH_SESSION", sessionId: activeSession.id, now: Date.now() })}>Finish session</button></div>}
          </>}
        </>}
  </section>;
}

function TodayBlock({ blockId, blockItems, state, dispatch, openBlocks, setOpenBlocks, priorDate }: { blockId: string; blockItems: SessionPlanItem[]; state: AppState; dispatch: (action: Action) => void; openBlocks: Record<string, boolean>; setOpenBlocks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>; priorDate: string }) {
  const activeSession = state.activeSessionId ? state.data.sessions[state.activeSessionId] : undefined;
  const block = blockItems[0];
  const skipped = activeSession ? Object.values(state.data.skippedBlocks).find((item) => item.sessionId === activeSession.id && item.blockId === blockId) : undefined;
  const isOpen = !skipped && (activeSession ? blockItems.some((item) => item.planExerciseId === state.guidedPlanExerciseId) || openBlocks[blockId] : openBlocks[blockId] ?? false);
  const timer = state.guidedTimer;
  const restSummary = block.restMinS === 0 && block.restMaxS === 0 ? "" : ` · ${block.restMinS}–${block.restMaxS}s rest`;

  const skipBlock = () => {
    if (!activeSession) return;
    const reason = window.prompt(`Why are you skipping ${block.blockName}?`);
    if (reason?.trim()) dispatch({ type: "SKIP_GUIDED_BLOCK", skippedBlockId: newId("skipped-block"), sessionId: activeSession.id, blockId, reason, now: Date.now() });
  };

  return <section className={isOpen ? "today-block open" : "today-block"}>
    <div className="today-block-header">
      <button className="today-block-toggle" type="button" aria-expanded={isOpen} aria-label={`${isOpen ? "Collapse" : "Expand"} ${block.blockName}`} title={isOpen ? "Collapse this block" : "Expand this block to log exercises"} onClick={() => setOpenBlocks((current) => ({ ...current, [blockId]: !isOpen }))}><span className="accordion-chevron">{isOpen ? "⌄" : "›"}</span></button>
      <div className="today-block-title"><div className="eyebrow">BLOCK {(block.blockOrder + 1).toString().padStart(2, "0")}</div><h3>{block.blockName}</h3></div>
      <span className="today-block-summary">{skipped ? "Skipped" : `${block.roundsMax} rounds${restSummary}`}</span>
      {activeSession && !skipped && <button className="text-button skip-block-button" title="Skip this entire block and record a reason" onClick={skipBlock}>Skip block</button>}
    </div>
    {skipped ? <div className="today-block-content skipped-block-content"><div className="skipped-block-note">This block was skipped: {skipped.reason}.</div>{blockItems.map((item) => <LoggedBlockExercise key={item.id} item={item} state={state} activeSession={activeSession} />)}</div> : isOpen && <div className="today-block-content">{blockItems.map((item) => <TodayExercise key={item.id} item={item} state={state} dispatch={dispatch} activeSession={activeSession} timer={timer} priorDate={priorDate} />)}</div>}
  </section>;
}

function LoggedBlockExercise({ item, state, activeSession }: { item: SessionPlanItem; state: AppState; activeSession?: AppState["data"]["sessions"][string] }) {
  const entries = activeSession ? entriesForPlanExercise(state.data, activeSession.id, item.planExerciseId) : [];
  return <div className="logged-block-exercise"><strong>{item.exerciseName}</strong><span>{entries.length ? `${entries.length} set${entries.length === 1 ? "" : "s"} logged` : "No sets logged"}</span>{entries.length > 0 && <div className="logged-block-sets">{entries.map((entry) => <span key={entry.id}>{entry.reps !== undefined ? `${entry.reps} reps` : `${entry.seconds ?? 0}s`}</span>)}</div>}</div>;
}

function TodayExercise({ item, state, dispatch, activeSession, timer, priorDate }: { item: SessionPlanItem; state: AppState; dispatch: (action: Action) => void; activeSession?: AppState["data"]["sessions"][string]; timer: AppState["guidedTimer"]; priorDate: string }) {
  const entries = activeSession ? entriesForPlanExercise(state.data, activeSession.id, item.planExerciseId) : [];
  const isGuided = Boolean(activeSession && item.planExerciseId === state.guidedPlanExerciseId);
  const isTimed = item.secondsMax !== undefined || state.data.exercises[item.exerciseId]?.metric === "seconds";
  const preparationRunning = isGuided && timer.phase === "preparation";
  const timerRunning = isGuided && timer.phase === "exercise";
  const restBelongsToItem = isGuided && timer.phase === "rest" && timer.planExerciseId === item.planExerciseId;
  const timerSeconds = preparationRunning ? Math.max(0, (timer.endsAt - state.clockNow) / 1000) : timerRunning ? Math.max(0, (state.clockNow - timer.startedAt) / 1000) : restBelongsToItem ? Math.max(0, (timer.endsAt - state.clockNow) / 1000) : 0;
  const timerLabel = preparationRunning ? `Get ready ${Math.ceil(timerSeconds)}s` : restBelongsToItem ? `Rest ${Math.ceil(timerSeconds)}s` : `${Math.floor(timerSeconds / 60).toString().padStart(2, "0")}:${Math.floor(timerSeconds % 60).toString().padStart(2, "0")}`;
  const onContinue = isGuided && isTimed && !preparationRunning && !restBelongsToItem ? () => timerRunning ? dispatch({ type: "CONTINUE_GUIDED_EXERCISE", sessionId: activeSession!.id, planExerciseId: item.planExerciseId, now: Date.now() }) : dispatch({ type: "START_GUIDED_EXERCISE", sessionId: activeSession!.id, planExerciseId: item.planExerciseId, now: Date.now() }) : undefined;
  return <ExerciseCard item={item} entries={entries} previous={previousEntryForExercise(state.data, item.exerciseId, priorDate)} isGuided={isGuided} disabled={!activeSession || !isGuided || preparationRunning || (timer.phase === "rest" && !restBelongsToItem)} showTimer={isGuided && (isTimed || restBelongsToItem)} timerLabel={timerLabel} timerRunning={timerRunning} onContinue={onContinue} onSkipRest={restBelongsToItem && activeSession ? () => dispatch({ type: "SKIP_REST", sessionId: activeSession.id, planExerciseId: item.planExerciseId, now: Date.now() }) : undefined} onCommit={(reps) => { if (!activeSession) return; dispatch({ type: "COMMIT_REP_SET", setId: newId("set"), sessionId: activeSession.id, planExerciseId: item.planExerciseId, exerciseId: item.exerciseId, setNo: entries.length + 1, reps, now: Date.now() }); }} />;
}
