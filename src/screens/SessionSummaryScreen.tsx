import { completedExerciseCount, entriesForSession, isSessionFinished, itemsForSession, latestFinishedSession, sessionDurationMinutes, sessionStatus, totalHoldSecondsForSession, totalRepsForSession } from "../domain/session";
import type { AppState } from "../state/appState";
import type { Action } from "../state/reducer";

export function SessionSummaryScreen({ state, dispatch, sessionId: requestedSessionId, embedded = false }: { state: AppState; dispatch: (action: Action) => void; sessionId?: string; embedded?: boolean }) {
  const candidateIds = [requestedSessionId, state.viewedSessionId, state.lastFinishedSessionId].filter((id): id is string => Boolean(id));
  const session = candidateIds
    .map((id) => state.data.sessions[id])
    .find((candidate) => candidate && isSessionFinished(candidate))
    ?? latestFinishedSession(state.data, state.selectedDate)
    ?? latestFinishedSession(state.data);
  if (!session) return <section className={embedded ? "embedded-summary empty-panel" : "screen empty-panel"}><h3>No finished session selected</h3>{!embedded && <button className="button primary" onClick={() => dispatch({ type: "NAVIGATE", route: "today" })}>Back to Today</button>}</section>;
  const status = sessionStatus(state.data, session);
  const entries = entriesForSession(state.data, session.id);
  const items = itemsForSession(state.data, session.id);
  const grouped = items.reduce<Record<string, typeof items>>((groups, item) => { (groups[item.blockId] ??= []).push(item); return groups; }, {});
  return <section className={embedded ? "embedded-summary summary-screen" : "screen summary-screen"}>
    <div className="summary-hero"><div className="eyebrow">{session.isHistorical ? "HISTORICAL SESSION" : "SESSION COMPLETE"}</div><h2>{session.isHistorical ? "From your log." : "Good work."}</h2><span className={`status-pill ${status}`}>{status}</span><p>{session.date}{sessionDurationMinutes(session) === undefined ? "" : ` · ${sessionDurationMinutes(session)} minutes`}</p></div>
    <div className="summary-metrics"><div><strong>{entries.length}</strong><span>sets logged</span></div><div><strong>{completedExerciseCount(state.data, session.id)}</strong><span>exercises touched</span></div><div><strong>{totalRepsForSession(state.data, session.id)}</strong><span>total reps</span></div><div><strong>{totalHoldSecondsForSession(state.data, session.id)}s</strong><span>hold time</span></div></div>
    <section className="summary-section"><div className="eyebrow">WHAT YOU DID</div><h3>Session details</h3>{Object.entries(grouped).map(([blockId, blockItems]) => { const hasRedundantHeading = blockItems.length === 1 && blockItems[0]?.blockName === blockItems[0]?.exerciseName; return <div className="summary-block" key={blockId}>{!hasRedundantHeading && <div className="summary-block-heading"><strong>{blockItems[0]?.blockName}</strong><span>{blockItems[0]?.blockType}</span></div>}{blockItems.map((item) => { const itemEntries = entries.filter((entry) => entry.planExerciseId === item.planExerciseId); return <div className="summary-exercise" key={item.planExerciseId}><strong>{item.exerciseName}</strong><span>{itemEntries.length ? itemEntries.map((entry) => entry.reps !== undefined ? `${entry.reps} reps` : `${entry.seconds ?? 0}s`).join(" · ") : "No set logged"}</span></div>; })}</div>; })}</section>
    {Object.values(state.data.skippedBlocks).filter((skipped) => skipped.sessionId === session.id).map((skipped) => <div className="summary-skipped" key={skipped.id}><strong>Skipped block: {skipped.blockName}</strong><span>{skipped.reason}</span></div>)}
    {session.hasUnresolvedHistory && <div className="legacy-history-notice">Some source values could not be represented as sets without guessing. They remain in the original log excerpt below.</div>}
    {session.sourceText && <details className="legacy-source-details"><summary>Original log excerpt</summary><pre className="legacy-source-text">{session.sourceText}</pre></details>}
    <div className="summary-grid"><label><span>Session note</span><textarea value={session.note} onChange={(event) => dispatch({ type: "UPDATE_SESSION_NOTE", sessionId: session.id, note: event.target.value })} placeholder="How did it feel?" /></label><label><span>Sleep last night (optional)</span><input type="number" min="0" max="24" step="0.5" value={session.sleepHours ?? ""} onChange={(event) => dispatch({ type: "UPDATE_SLEEP_HOURS", sessionId: session.id, sleepHours: event.target.value ? Number(event.target.value) : undefined })} placeholder="7.5" /></label></div>
    <div className="info-panel"><strong>Analytics snapshot</strong><p>{entries.length ? `This session contributed ${totalRepsForSession(state.data, session.id)} reps and ${totalHoldSecondsForSession(state.data, session.id)} seconds of holds to your history. PR detection, progression signals, and weekly charts will build on these records.` : "No sets were logged in this session. Its status and any skipped reasons remain recorded."}</p></div>
    {!embedded && <button className="button primary" onClick={() => dispatch({ type: "DISMISS_SESSION_SUMMARY" })}>Back to Today</button>}
  </section>;
}
