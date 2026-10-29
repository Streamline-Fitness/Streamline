import { useEffect, useState } from "react";
import { entriesForSession, isSessionFinished, sessionStatus } from "../domain/session";
import { shiftDate, weekStartForDate } from "../domain/plan";
import type { AppState } from "../state/appState";
import type { Action } from "../state/reducer";

type Props = { state: AppState; dispatch: (action: Action) => void; embedded?: boolean };

function displayDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function WeeklyReviewScreen({ state, dispatch, embedded = false }: Props) {
  const [weekStart, setWeekStart] = useState(() => weekStartForDate(state.selectedDate));
  const review = state.data.weeklyReviews[weekStart];
  const [reflection, setReflection] = useState(review?.reflection ?? "");
  const [nextWeekGoal, setNextWeekGoal] = useState(review?.nextWeekGoal ?? "");
  const weekEnd = shiftDate(weekStart, 6);
  const weekSessions = Object.values(state.data.sessions)
    .filter((session) => session.date >= weekStart && session.date <= weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date));
  const entries = weekSessions.flatMap((session) => entriesForSession(state.data, session.id));
  const completedSessions = weekSessions.filter((session) => isSessionFinished(session) && sessionStatus(state.data, session) === "done").length;
  const partialSessions = weekSessions.filter((session) => isSessionFinished(session) && sessionStatus(state.data, session) === "partial").length;
  const skippedSessions = weekSessions.filter((session) => isSessionFinished(session) && sessionStatus(state.data, session) === "skipped").length;
  const totalReps = entries.reduce((sum, entry) => sum + (entry.reps ?? 0), 0);
  const totalHoldSeconds = entries.reduce((sum, entry) => sum + (entry.seconds ?? 0), 0);

  useEffect(() => {
    setReflection(review?.reflection ?? "");
    setNextWeekGoal(review?.nextWeekGoal ?? "");
  }, [review]);

  const saveReview = () => dispatch({
    type: "SAVE_WEEKLY_REVIEW",
    weekStart,
    reflection: reflection.trim(),
    nextWeekGoal: nextWeekGoal.trim(),
    reviewedAt: Date.now(),
  });

  return <section className={embedded ? "screen narrow-screen weekly-review-screen embedded-review" : "screen narrow-screen weekly-review-screen"}>
    {!embedded && <button className="back-link" onClick={() => dispatch({ type: "NAVIGATE", route: "today" })}>← Back to Today</button>}
    <div className="section-heading">
      <div><div className="eyebrow">WEEKLY CHECK-IN</div><h2>Weekly reflection</h2><p>Notice what went well and choose one focus for the week ahead.</p></div>
    </div>
    <div className="review-week-controls">
      <button className="icon-button" aria-label="Previous week" title="Review the previous week" onClick={() => setWeekStart((date) => shiftDate(date, -7))}>←</button>
      <strong>{displayDate(weekStart)} – {displayDate(weekEnd)}</strong>
      <button className="icon-button" aria-label="Next week" title="Review the next week" onClick={() => setWeekStart((date) => shiftDate(date, 7))}>→</button>
    </div>
    <div className="review-summary-card">
      <div className="subheading">YOUR WEEK AT A GLANCE</div>
      {weekSessions.length ? <>
        <div className="review-stats">
          <div><strong>{completedSessions}</strong><span>complete</span></div>
          <div><strong>{partialSessions}</strong><span>partial</span></div>
          <div><strong>{skippedSessions}</strong><span>skipped</span></div>
          <div><strong>{entries.length}</strong><span>logged entries</span></div>
        </div>
        <p>{totalReps} reps · {totalHoldSeconds} seconds of holds logged</p>
        <ul className="review-session-list">{weekSessions.map((session) => <li key={session.id}>
          <span>{displayDate(session.date)}</span>
          <strong>{isSessionFinished(session) ? sessionStatus(state.data, session) : "In progress"}</strong>
          <span>{entriesForSession(state.data, session.id).length} entries</span>
        </li>)}</ul>
      </> : <p>No sessions were recorded for this week yet.</p>}
    </div>
    {review?.isStale && <div className="review-stale-panel" role="status">Training data for this week changed after the last review. Save again to refresh it.</div>}
    <div className="weekly-review-form">
      <label><strong>How did this week feel?</strong><span>What went well? What would you change?</span><textarea value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="Write a few notes about your week..." /></label>
      <label><strong>One focus for next week</strong><span>Keep it small and specific.</span><textarea value={nextWeekGoal} onChange={(event) => setNextWeekGoal(event.target.value)} placeholder="What is one thing you want to focus on?" /></label>
      <div className="review-save-row">
        {review?.reviewedAt && <span>Last saved {new Date(review.reviewedAt).toLocaleString()}</span>}
        <button className="button primary" onClick={saveReview}>Save reflection</button>
      </div>
    </div>
  </section>;
}
