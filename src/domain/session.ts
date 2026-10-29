import type { DataDocument, ID, Session, SessionPlanItem, SessionStatus, SetEntry } from "./model";

export function entriesForSession(data: DataDocument, sessionId: ID): SetEntry[] {
  return Object.values(data.setEntries).filter((entry) => entry.sessionId === sessionId);
}

export function latestFinishedSession(data: DataDocument, date?: string): Session | undefined {
  return Object.values(data.sessions)
    .filter((session) => isSessionFinished(session) && (date === undefined || session.date === date))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.finishedAt ?? 0) - (a.finishedAt ?? 0))[0];
}

export function isSessionFinished(session: Session): boolean {
  return session.finishedAt !== undefined || session.isHistorical === true;
}

export function itemsForSession(data: DataDocument, sessionId: ID): SessionPlanItem[] {
  return Object.values(data.sessionPlanItems)
    .filter((item) => item.sessionId === sessionId)
    .sort((a, b) => a.blockOrder - b.blockOrder || a.exerciseOrder - b.exerciseOrder);
}

export function entriesForPlanExercise(data: DataDocument, sessionId: ID, planExerciseId: ID): SetEntry[] {
  return entriesForSession(data, sessionId).filter((entry) => entry.planExerciseId === planExerciseId);
}

export function sessionStatus(data: DataDocument, session: Session): SessionStatus {
  const entries = entriesForSession(data, session.id).filter((entry) => !entry.skipReason);
  if (entries.length === 0 && session.skipReason) return "skipped";
  if (session.hasUnresolvedHistory) return "partial";
  const items = itemsForSession(data, session.id);
  if (items.length > 0 && items.every((item) => entries.some((entry) => entry.planExerciseId === item.planExerciseId))) {
    return "done";
  }
  return "partial";
}

export function sessionDurationMinutes(session: Session): number | undefined {
  if (session.durationSeconds !== undefined) return Math.ceil(session.durationSeconds / 60);
  if (!session.startedAt || !session.finishedAt) return undefined;
  return Math.max(0, Math.ceil((session.finishedAt - session.startedAt) / 60000));
}

export function previousEntryForExercise(data: DataDocument, exerciseId: ID, beforeDate: string): SetEntry | undefined {
  const sessions = Object.values(data.sessions)
    .filter((session) => session.date < beforeDate && isSessionFinished(session))
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const session of sessions) {
    const entry = entriesForSession(data, session.id).find((candidate) => candidate.exerciseId === exerciseId);
    if (entry) return entry;
  }
  return undefined;
}

export function displayResult(entry?: SetEntry): string {
  if (!entry) return "No previous result";
  if (entry.reps !== undefined) return `${entry.reps} reps`;
  if (entry.seconds !== undefined) return `${entry.seconds}s`;
  return "Recorded";
}

export function totalRepsForSession(data: DataDocument, sessionId: ID): number {
  return entriesForSession(data, sessionId).reduce((total, entry) => total + (entry.reps ?? 0), 0);
}

export function totalHoldSecondsForSession(data: DataDocument, sessionId: ID): number {
  return entriesForSession(data, sessionId).reduce((total, entry) => total + (entry.seconds ?? 0), 0);
}

export function completedExerciseCount(data: DataDocument, sessionId: ID): number {
  return new Set(entriesForSession(data, sessionId).filter((entry) => !entry.skipReason).map((entry) => entry.planExerciseId ?? entry.exerciseId)).size;
}

export function nextGuidedPlanExercise(data: DataDocument, sessionId: ID, currentPlanExerciseId: ID): ID | undefined {
  const items = itemsForSession(data, sessionId);
  const current = items.find((item) => item.planExerciseId === currentPlanExerciseId);
  if (!current) return items[0]?.planExerciseId;
  const sameBlock = items.filter((item) => item.blockId === current.blockId);
  const currentIndex = sameBlock.findIndex((item) => item.planExerciseId === currentPlanExerciseId);
  if (currentIndex < sameBlock.length - 1) return sameBlock[currentIndex + 1]?.planExerciseId;
  const completedRounds = entriesForPlanExercise(data, sessionId, currentPlanExerciseId).length;
  if (completedRounds < current.roundsMax) return sameBlock[0]?.planExerciseId;
  return items.find((item) => item.blockOrder > current.blockOrder && item.exerciseOrder === 0)?.planExerciseId;
}

export function nextPlanExerciseAfterEntry(data: DataDocument, sessionId: ID, currentPlanExerciseId: ID): ID | undefined {
  const items = itemsForSession(data, sessionId);
  const current = items.find((item) => item.planExerciseId === currentPlanExerciseId);
  if (!current) return undefined;
  const sameBlock = items.filter((item) => item.blockId === current.blockId);
  const currentIndex = sameBlock.findIndex((item) => item.planExerciseId === currentPlanExerciseId);
  if (currentIndex < sameBlock.length - 1) return sameBlock[currentIndex + 1]?.planExerciseId;
  const completedRounds = entriesForPlanExercise(data, sessionId, currentPlanExerciseId).length;
  if (completedRounds < current.roundsMax) return sameBlock[0]?.planExerciseId;
  return items.find((item) => item.blockOrder > current.blockOrder && item.exerciseOrder === 0)?.planExerciseId;
}

export function currentGuidedPlanExercise(data: DataDocument, sessionId: ID): ID | undefined {
  const items = itemsForSession(data, sessionId);
  const blockOrders = [...new Set(items.map((item) => item.blockOrder))].sort((a, b) => a - b);
  for (const blockOrder of blockOrders) {
    const blockItems = items.filter((item) => item.blockOrder === blockOrder);
    const rounds = blockItems[0]?.roundsMax ?? 1;
    for (let round = 0; round < rounds; round += 1) {
      const pending = blockItems.find((item) => entriesForPlanExercise(data, sessionId, item.planExerciseId).length <= round);
      if (pending) return pending.planExerciseId;
    }
  }
  return undefined;
}
