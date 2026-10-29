import { entriesForSession, isSessionFinished, itemsForSession, sessionDurationMinutes, sessionStatus } from "../domain/session";
import type { AppState } from "../state/appState";
import type { Action } from "../state/reducer";

type Props = { state: AppState; dispatch: (action: Action) => void };

function displayDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function HistoryScreen({ state, dispatch }: Props) {
  const sessions = Object.values(state.data.sessions).sort((a, b) => b.date.localeCompare(a.date) || (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
  return <section className="screen narrow-screen history-screen">
    <div className="section-heading">
      <div><div className="eyebrow">YOUR TRAINING</div><h2>History</h2><p>Review your saved training sessions.</p></div>
    </div>
    {sessions.length ? <div className="history-list">{sessions.map((session) => {
      const entries = entriesForSession(state.data, session.id);
      const items = itemsForSession(state.data, session.id);
      const finished = isSessionFinished(session);
      const status = finished ? sessionStatus(state.data, session) : "partial";
      const exerciseNames = new Set(items.map((item) => item.exerciseName));
      return <button className="history-session" key={session.id} onClick={() => dispatch({ type: "VIEW_SESSION", sessionId: session.id })}>
        <div className="history-session-top"><strong>{displayDate(session.date)}</strong><span className={`status-pill ${status}`}>{finished ? status : "in progress"}</span></div>
        <div className="history-session-meta">
          <span>{exerciseNames.size} exercises · {entries.filter((entry) => !entry.skipReason).length} entries</span>
          <span>{sessionDurationMinutes(session) === undefined ? "Duration not recorded" : `${sessionDurationMinutes(session)} min`}</span>
        </div>
        {session.hasUnresolvedHistory && <p className="history-skip-reason">Some source values need interpretation. The original log excerpt is in the session summary.</p>}
        {session.note && <p>{session.note}</p>}
        {session.skipReason && <p className="history-skip-reason">{session.skipReason}</p>}
      </button>;
    })}</div> : <div className="empty-panel"><h3>No sessions yet</h3><p>Start a session from Today to see it here.</p></div>}
  </section>;
}
