import type { SessionPlanItem, SetEntry } from "../domain/model";
import { formatTarget } from "../domain/plan";
import { displayResult } from "../domain/session";

type Props = {
  item: SessionPlanItem;
  entries: SetEntry[];
  previous?: SetEntry;
  onCommit: (reps: number) => void;
  onContinue?: () => void;
  onPauseToggle?: () => void;
  onSkipRest?: () => void;
  timerLabel?: string;
  timerRunning?: boolean;
  timerPaused?: boolean;
  showTimer?: boolean;
  isGuided?: boolean;
  disabled?: boolean;
};

export function ExerciseCard({ item, entries, previous, onCommit, onContinue, onPauseToggle, onSkipRest, timerLabel, timerRunning = false, timerPaused = false, showTimer = false, isGuided = false, disabled }: Props) {
  const [min, max] = item.repsMin !== undefined ? [item.repsMin, item.repsMax ?? item.repsMin] : [0, 0];
  const nextSet = entries.length + 1;
  const defaultReps = entries.at(-1)?.reps ?? previous?.reps ?? min;
  return (
    <article className={isGuided ? "exercise-card guided-exercise" : "exercise-card"}>
      <div className="exercise-heading">
        <div>
          <h3>{item.exerciseName}{isGuided && <span className="guided-label">Current</span>}</h3>
          <div className="target-line">Target <strong>{formatTarget(item)}</strong></div>
        </div>
        <span className="set-count">{entries.length}/{item.roundsMax} sets</span>
      </div>
      <div className="previous-result">Last time <strong>{displayResult(previous)}</strong></div>
      {item.repsMin !== undefined && !showTimer ? (
        <div className="entry-row">
          <label htmlFor={`reps-${item.id}`}>Set {nextSet} reps</label>
          <input id={`reps-${item.id}`} type="number" min="0" defaultValue={defaultReps} title={`Enter reps for set ${nextSet}; target is ${formatTarget(item)}`} disabled={disabled} onKeyDown={(event) => { if (event.key === "Enter") onCommit(Number(event.currentTarget.value)); }} />
          <button className="button primary small" title={`Save set ${nextSet} and add it to this session`} disabled={disabled} onClick={(event) => { const input = event.currentTarget.parentElement?.querySelector("input"); onCommit(Number(input instanceof HTMLInputElement ? input.value : defaultReps)); }}>Log set</button>
        </div>
      ) : showTimer || onContinue ? (
        <div className="guided-timer-panel"><div className="timer-label">{timerPaused ? "Hold paused" : timerRunning ? "Hold time" : timerLabel?.startsWith("Rest") ? "Rest" : "Ready to hold"}</div><div className="timer-display">{timerLabel ?? "00:00"}</div><div className="guided-timer-actions">{onContinue && <button className="button primary continue-button" disabled={disabled} title="Record the hold time and continue to rest" onClick={onContinue}>{timerRunning || timerPaused ? "Continue" : "Start hold"}</button>}{onPauseToggle && <button className="button secondary pause-button" disabled={disabled} title={timerPaused ? "Resume the hold timer" : "Pause the hold timer"} onClick={onPauseToggle}>{timerPaused ? "Resume" : "Pause"}</button>}</div>{onSkipRest && <button className="text-button skip-rest-button" disabled={disabled} title="End rest now and move to the next exercise" onClick={onSkipRest}>Skip rest</button>}</div>
      ) : <div className="hold-placeholder">Timer controls appear when this exercise is current.</div>}
      {entries.length > 0 && (
        <div className="set-list">
          {entries.map((entry) => <div className="logged-set" key={entry.id}><span>Set {entry.setNo}</span><strong>{entry.reps ?? `${entry.seconds}s`}</strong><span className="set-status">saved</span></div>)}
        </div>
      )}
    </article>
  );
}
