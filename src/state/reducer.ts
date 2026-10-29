import { expandSessionPlan, getScheduledDayForDate, todayISO, weekdayFromISO, weekStartForDate } from "../domain/plan";
import { newId } from "../domain/ids";
import { cloneData } from "../domain/seed";
import { currentGuidedPlanExercise, latestFinishedSession, nextGuidedPlanExercise, nextPlanExerciseAfterEntry } from "../domain/session";
import type {
  ExerciseCategory,
  Exercise,
  ID,
  Metric,
  Pattern,
  PlanBlockType,
  SideMode,
  Session,
  SetEntry,
  SkippedBlock,
} from "../domain/model";
import type { AppState, GuidedTimer, Route } from "./appState";

export type Action =
  | { type: "HYDRATE"; data: AppState["data"] }
  | { type: "NAVIGATE"; route: Route }
  | { type: "SELECT_DATE"; date: string }
  | { type: "SELECT_PLAN"; planId: ID }
  | { type: "SELECT_PLAN_DAY"; dayId: ID }
  | { type: "CREATE_PLAN"; planId: ID; name: string; now: number }
  | { type: "UPDATE_PLAN"; planId: ID; name: string; description: string; now: number }
  | { type: "ACTIVATE_PLAN"; planId: ID }
  | { type: "ADD_PLAN_DAY"; dayId: ID; planId: ID; name: string; weekday?: number }
  | { type: "UPDATE_PLAN_DAY"; dayId: ID; name: string; weekday?: number; isRestDay?: boolean; reflectionEnabled?: boolean }
  | { type: "DELETE_PLAN_DAY"; dayId: ID }
  | { type: "ADD_PLAN_BLOCK"; blockId: ID; dayId: ID; name: string; blockType: PlanBlockType }
  | { type: "UPDATE_PLAN_BLOCK"; blockId: ID; name: string; blockType: PlanBlockType; roundsMin: number; roundsMax: number; restMinS: number; restMaxS: number }
  | { type: "DELETE_PLAN_BLOCK"; blockId: ID }
  | { type: "ADD_PLAN_EXERCISE"; planExerciseId: ID; blockId: ID; exerciseId: ID; repsMin?: number; repsMax?: number; secondsMin?: number; secondsMax?: number; sideMode: SideMode }
  | { type: "REMOVE_PLAN_EXERCISE"; planExerciseId: ID }
  | { type: "CREATE_CUSTOM_EXERCISE"; exerciseId: ID; name: string; category: ExerciseCategory; metric: Metric; pattern?: Pattern; skillId?: string; leadInS?: number; defaultHoldS?: number; sideMode: SideMode }
  | { type: "UPDATE_EXERCISE"; exerciseId: ID; name: string; category: ExerciseCategory; metric: Metric; pattern?: Pattern; skillId?: string; leadInS?: number; defaultHoldS?: number; sideMode: SideMode }
  | { type: "DELETE_EXERCISE"; exerciseId: ID }
  | { type: "START_SESSION"; sessionId: ID; date: string; planId: ID; planDayId: ID; now: number }
  | { type: "START_GUIDED_EXERCISE"; sessionId: ID; planExerciseId: ID; now: number }
  | { type: "CLOCK_TICK"; now: number }
  | { type: "CONTINUE_GUIDED_EXERCISE"; sessionId: ID; planExerciseId: ID; now: number }
  | { type: "SKIP_REST"; sessionId: ID; planExerciseId: ID; now: number }
  | { type: "UPDATE_SETTINGS"; defaultLeadInS: number }
  | { type: "SAVE_WEEKLY_REVIEW"; weekStart: string; reflection: string; nextWeekGoal: string; reviewedAt: number }
  | { type: "COMMIT_REP_SET"; setId: ID; sessionId: ID; planExerciseId: ID; exerciseId: ID; setNo: number; reps: number; now: number }
  | { type: "SKIP_GUIDED_EXERCISE"; setId: ID; sessionId: ID; planExerciseId: ID; exerciseId: ID; setNo: number; reason: string; now: number }
  | { type: "SKIP_GUIDED_BLOCK"; skippedBlockId: ID; sessionId: ID; blockId: ID; reason: string; now: number }
  | { type: "FINISH_SESSION"; sessionId: ID; now: number }
  | { type: "VIEW_SESSION"; sessionId: ID }
  | { type: "DISMISS_SESSION_SUMMARY" }
  | { type: "UPDATE_SESSION_NOTE"; sessionId: ID; note: string }
  | { type: "UPDATE_SLEEP_HOURS"; sessionId: ID; sleepHours?: number };

function updateState(state: AppState, data: AppState["data"]): AppState {
  return { ...state, data, error: undefined };
}

function withSession(state: AppState, sessionId: ID, update: (session: Session) => Session): AppState {
  const session = state.data.sessions[sessionId];
  if (!session) return { ...state, error: "That session is no longer available." };
  const data = cloneData(state.data);
  data.sessions[sessionId] = update(session);
  markReviewStale(data, session.date);
  return updateState(state, data);
}

function markReviewStale(data: AppState["data"], date: string): void {
  const review = data.weeklyReviews[weekStartForDate(date)];
  if (review?.reviewedAt !== undefined) review.isStale = true;
}

function timerForTimedItem(data: AppState["data"], sessionId: ID, planExerciseId: ID, now: number, includePreparation: boolean): GuidedTimer {
  const item = Object.values(data.sessionPlanItems).find((candidate) => candidate.sessionId === sessionId && candidate.planExerciseId === planExerciseId);
  if (!item) return { phase: "idle" };
  const exercise = data.exercises[item.exerciseId];
  const targetSeconds = item.secondsMax ?? exercise?.defaultHoldS ?? 0;
  const preparationSeconds = exercise?.leadInS ?? data.settings.defaultLeadInS;
  if (includePreparation && preparationSeconds > 0) {
    return { phase: "preparation", sessionId, planExerciseId, endsAt: now + preparationSeconds * 1000, targetSeconds };
  }
  return { phase: "exercise", sessionId, planExerciseId, startedAt: now, targetSeconds };
}

function restTimerForEntry(data: AppState["data"], sessionId: ID, planExerciseId: ID, now: number, nextPlanExerciseId?: ID): GuidedTimer {
  const item = Object.values(data.sessionPlanItems).find((candidate) => candidate.sessionId === sessionId && candidate.planExerciseId === planExerciseId);
  const durationSeconds = item?.restMaxS || item?.restMinS || 0;
  if (!durationSeconds) return { phase: "idle" };
  return { phase: "rest", sessionId, planExerciseId, nextPlanExerciseId, startedAt: now, endsAt: now + durationSeconds * 1000, durationSeconds };
}

function stateAfterTimedEntry(data: AppState["data"], sessionId: ID, planExerciseId: ID, now: number): Pick<AppState, "guidedPlanExerciseId" | "guidedTimer"> {
  const nextPlanExerciseId = nextPlanExerciseAfterEntry(data, sessionId, planExerciseId);
  const restTimer = restTimerForEntry(data, sessionId, planExerciseId, now, nextPlanExerciseId);
  if (restTimer.phase === "rest") return { guidedPlanExerciseId: planExerciseId, guidedTimer: restTimer };

  const nextItem = nextPlanExerciseId
    ? Object.values(data.sessionPlanItems).find((item) => item.sessionId === sessionId && item.planExerciseId === nextPlanExerciseId)
    : undefined;
  const nextExercise = nextItem ? data.exercises[nextItem.exerciseId] : undefined;
  const nextIsTimed = nextItem && (nextItem.secondsMax !== undefined || nextExercise?.metric === "seconds");
  return {
    guidedPlanExerciseId: nextPlanExerciseId,
    guidedTimer: nextPlanExerciseId && nextIsTimed ? timerForTimedItem(data, sessionId, nextPlanExerciseId, now, true) : { phase: "idle" },
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "HYDRATE":
      {
        const data = action.data;
        for (const exercise of Object.values(data.exercises)) exercise.sideMode ??= "none";
        data.skippedBlocks ??= {};
        const activePlan = Object.values(data.plans).find((plan) => plan.isActive);
        const latestFinished = latestFinishedSession(data);
        return {
          ...state,
          data,
          selectedPlanId: activePlan?.id,
           selectedPlanDayId: activePlan ? getScheduledDayForDate(data, activePlan.id, state.selectedDate, state.selectedPlanDayId)?.id : undefined,
          viewedSessionId: state.route === "summary" ? latestFinished?.id : state.viewedSessionId,
          lastFinishedSessionId: state.route === "summary" ? latestFinished?.id : state.lastFinishedSessionId,
          hydrated: true,
        };
      }
    case "NAVIGATE":
      return { ...state, route: action.route, error: undefined };
    case "SELECT_DATE":
      {
        const activePlan = Object.values(state.data.plans).find((plan) => plan.isActive);
        return {
          ...state,
          selectedDate: action.date,
          selectedPlanDayId: activePlan ? getScheduledDayForDate(state.data, activePlan.id, action.date)?.id : undefined,
        };
      }
    case "SELECT_PLAN":
      return { ...state, selectedPlanId: action.planId, editorPlanId: action.planId };
    case "SELECT_PLAN_DAY":
      {
        const day = state.data.planDays[action.dayId];
        const activePlan = Object.values(state.data.plans).find((plan) => plan.isActive);
        const isSelectableForDate = Boolean(day && activePlan?.id === day.planId && day.weekday === weekdayFromISO(state.selectedDate));
        return isSelectableForDate ? { ...state, selectedPlanDayId: action.dayId } : state;
      }
    case "VIEW_SESSION":
      return { ...state, viewedSessionId: action.sessionId, lastFinishedSessionId: action.sessionId, route: "summary" };
    case "UPDATE_SETTINGS": {
      const data = cloneData(state.data);
      data.settings.defaultLeadInS = Math.max(0, action.defaultLeadInS);
      return updateState(state, data);
    }
    case "SAVE_WEEKLY_REVIEW": {
      const data = cloneData(state.data);
      data.weeklyReviews[action.weekStart] = {
        weekStart: action.weekStart,
        reflection: action.reflection,
        nextWeekGoal: action.nextWeekGoal,
        reviewedAt: action.reviewedAt,
        isStale: false,
      };
      return updateState(state, data);
    }
    case "CREATE_PLAN": {
      const data = cloneData(state.data);
      data.plans[action.planId] = { id: action.planId, name: action.name, isActive: false, createdAt: action.now, updatedAt: action.now };
      return { ...updateState(state, data), editorPlanId: action.planId, selectedPlanId: action.planId, route: "plan-editor" };
    }
    case "UPDATE_PLAN": {
      const plan = state.data.plans[action.planId];
      if (!plan) return state;
      const data = cloneData(state.data);
      data.plans[action.planId] = { ...plan, name: action.name, description: action.description, updatedAt: action.now };
      return updateState(state, data);
    }
    case "ACTIVATE_PLAN": {
      const data = cloneData(state.data);
      for (const plan of Object.values(data.plans)) plan.isActive = plan.id === action.planId;
      return {
        ...updateState(state, data),
        selectedPlanId: action.planId,
        selectedPlanDayId: getScheduledDayForDate(data, action.planId, state.selectedDate)?.id,
      };
    }
    case "ADD_PLAN_DAY": {
      const data = cloneData(state.data);
      const order = Object.values(data.planDays).filter((day) => day.planId === action.planId).length;
      data.planDays[action.dayId] = { id: action.dayId, planId: action.planId, name: action.name, weekday: action.weekday, order };
      return { ...updateState(state, data), selectedPlanDayId: action.dayId };
    }
    case "UPDATE_PLAN_DAY": {
      const day = state.data.planDays[action.dayId];
      if (!day) return state;
      const data = cloneData(state.data);
      data.planDays[action.dayId] = {
        ...day,
        name: action.name,
        weekday: action.weekday,
        isRestDay: action.isRestDay ?? day.isRestDay ?? false,
        reflectionEnabled: action.isRestDay === false ? false : action.reflectionEnabled ?? day.reflectionEnabled ?? false,
      };
      return updateState(state, data);
    }
    case "DELETE_PLAN_DAY": {
      const day = state.data.planDays[action.dayId];
      if (!day) return state;
      const data = cloneData(state.data);
      delete data.planDays[action.dayId];
      for (const block of Object.values(data.planBlocks)) {
        if (block.dayId === action.dayId) {
          delete data.planBlocks[block.id];
          for (const item of Object.values(data.planExercises)) {
            if (item.blockId === block.id) delete data.planExercises[item.id];
          }
        }
      }
      return { ...updateState(state, data), selectedPlanDayId: undefined };
    }
    case "ADD_PLAN_BLOCK": {
      const data = cloneData(state.data);
      const order = Object.values(data.planBlocks).filter((block) => block.dayId === action.dayId).length;
      data.planBlocks[action.blockId] = { id: action.blockId, dayId: action.dayId, name: action.name, type: action.blockType, order, roundsMin: 1, roundsMax: 1, restMinS: 45, restMaxS: 60 };
      return updateState(state, data);
    }
    case "UPDATE_PLAN_BLOCK": {
      const block = state.data.planBlocks[action.blockId];
      if (!block) return state;
      const data = cloneData(state.data);
      data.planBlocks[action.blockId] = { ...block, name: action.name, type: action.blockType, roundsMin: action.roundsMin, roundsMax: action.roundsMax, restMinS: action.restMinS, restMaxS: action.restMaxS };
      return updateState(state, data);
    }
    case "DELETE_PLAN_BLOCK": {
      const block = state.data.planBlocks[action.blockId];
      if (!block) return state;
      const data = cloneData(state.data);
      delete data.planBlocks[action.blockId];
      for (const item of Object.values(data.planExercises)) {
        if (item.blockId === action.blockId) delete data.planExercises[item.id];
      }
      return updateState(state, data);
    }
    case "ADD_PLAN_EXERCISE": {
      const data = cloneData(state.data);
      const order = Object.values(data.planExercises).filter((item) => item.blockId === action.blockId).length;
      data.planExercises[action.planExerciseId] = { id: action.planExerciseId, blockId: action.blockId, exerciseId: action.exerciseId, order, repsMin: action.repsMin, repsMax: action.repsMax, secondsMin: action.secondsMin, secondsMax: action.secondsMax, sideMode: action.sideMode };
      return updateState(state, data);
    }
    case "REMOVE_PLAN_EXERCISE": {
      const data = cloneData(state.data);
      delete data.planExercises[action.planExerciseId];
      return updateState(state, data);
    }
    case "CREATE_CUSTOM_EXERCISE": {
      const data = cloneData(state.data);
      data.exercises[action.exerciseId] = { id: action.exerciseId, name: action.name, category: action.category, metric: action.metric, source: "user", pattern: action.pattern, skillId: action.skillId, leadInS: action.leadInS, defaultHoldS: action.defaultHoldS, sideMode: action.sideMode };
      return updateState(state, data);
    }
    case "UPDATE_EXERCISE": {
      const exercise = state.data.exercises[action.exerciseId];
      if (!exercise) return { ...state, error: "That exercise is no longer available." };
      const isUsedInPlan = Object.values(state.data.planExercises).some((item) => item.exerciseId === action.exerciseId);
      const isUsedInHistory = Object.values(state.data.setEntries).some((entry) => entry.exerciseId === action.exerciseId);
      const data = cloneData(state.data);
      const metric = isUsedInPlan || isUsedInHistory ? exercise.metric : action.metric;
      const updated: Exercise = { ...exercise, name: action.name, category: action.category, metric, pattern: action.pattern, skillId: action.skillId, leadInS: action.leadInS, defaultHoldS: action.defaultHoldS, sideMode: action.sideMode };
      data.exercises[action.exerciseId] = updated;
      return updateState(state, data);
    }
    case "DELETE_EXERCISE": {
      const exercise = state.data.exercises[action.exerciseId];
      if (!exercise) return state;
      if (exercise.source === "system") return { ...state, error: "Built-in exercises cannot be deleted." };
      const isUsed = Object.values(state.data.planExercises).some((item) => item.exerciseId === action.exerciseId) || Object.values(state.data.setEntries).some((entry) => entry.exerciseId === action.exerciseId);
      if (isUsed) return { ...state, error: "This exercise is in use and cannot be deleted. Remove it from plans first." };
      const data = cloneData(state.data);
      delete data.exercises[action.exerciseId];
      return updateState(state, data);
    }
    case "START_SESSION": {
      const existing = Object.values(state.data.sessions).find((session) => session.date === action.date && !session.finishedAt && !session.isHistorical);
      if (existing) {
        const current = currentGuidedPlanExercise(state.data, existing.id);
        const currentItem = current ? Object.values(state.data.sessionPlanItems).find((item) => item.sessionId === existing.id && item.planExerciseId === current) : undefined;
        const currentIsTimed = currentItem ? currentItem.secondsMax !== undefined || state.data.exercises[currentItem.exerciseId]?.metric === "seconds" : false;
        const timer = current && currentIsTimed ? timerForTimedItem(state.data, existing.id, current, action.now, true) : { phase: "idle" as const };
        return { ...state, activeSessionId: existing.id, guidedPlanExerciseId: current, guidedTimer: timer, clockNow: action.now, route: "today" };
      }
      const data = cloneData(state.data);
      const session: Session = { id: action.sessionId, date: action.date, weekday: weekdayFromISO(action.date), planId: action.planId, planDayId: action.planDayId, startedAt: action.now, note: "" };
      data.sessions[session.id] = session;
      markReviewStale(data, session.date);
      for (const item of expandSessionPlan(data, session.id, action.planDayId)) data.sessionPlanItems[item.id] = item;
      const firstItem = expandSessionPlan(data, session.id, action.planDayId)[0];
      const firstIsTimed = firstItem ? firstItem.secondsMax !== undefined || data.exercises[firstItem.exerciseId]?.metric === "seconds" : false;
      const firstTimer = firstItem && firstIsTimed ? timerForTimedItem(data, session.id, firstItem.planExerciseId, action.now, true) : { phase: "idle" as const };
      return { ...updateState(state, data), activeSessionId: session.id, guidedPlanExerciseId: firstItem?.planExerciseId, guidedTimer: firstTimer, clockNow: action.now, route: "today" };
    }
    case "START_GUIDED_EXERCISE": {
      const item = Object.values(state.data.sessionPlanItems).find((candidate) => candidate.sessionId === action.sessionId && candidate.planExerciseId === action.planExerciseId);
      if (!item) return state;
      const exercise = state.data.exercises[item.exerciseId];
      const timer = timerForTimedItem(state.data, action.sessionId, action.planExerciseId, action.now, true);
      if (timer.phase === "idle") return { ...state, error: "This exercise does not have a timed target." };
      return { ...state, guidedPlanExerciseId: action.planExerciseId, guidedTimer: timer, clockNow: action.now };
    }
    case "SKIP_GUIDED_BLOCK": {
      const data = cloneData(state.data);
      const item = Object.values(data.sessionPlanItems).find((candidate) => candidate.sessionId === action.sessionId && candidate.blockId === action.blockId);
      if (!item || !action.reason.trim()) return state;
      const skipped: SkippedBlock = { id: action.skippedBlockId, sessionId: action.sessionId, blockId: action.blockId, blockName: item.blockName, reason: action.reason.trim(), skippedAt: action.now };
      data.skippedBlocks[skipped.id] = skipped;
      const session = data.sessions[action.sessionId];
      if (session) markReviewStale(data, session.date);
      const next = Object.values(data.sessionPlanItems).filter((candidate) => candidate.sessionId === action.sessionId && candidate.blockOrder > item.blockOrder).sort((a, b) => a.blockOrder - b.blockOrder || a.exerciseOrder - b.exerciseOrder)[0];
      const nextExercise = next ? data.exercises[next.exerciseId] : undefined;
      const nextTimer = next && (next.secondsMax !== undefined || nextExercise?.metric === "seconds") ? timerForTimedItem(data, action.sessionId, next.planExerciseId, action.now, true) : { phase: "idle" as const };
      return { ...updateState(state, data), guidedPlanExerciseId: next?.planExerciseId, guidedTimer: nextTimer, clockNow: action.now };
    }
    case "CLOCK_TICK": {
      if (state.guidedTimer.phase === "idle") return { ...state, clockNow: action.now };
      if (state.guidedTimer.phase === "preparation" && action.now >= state.guidedTimer.endsAt) {
        const timer = state.guidedTimer;
        return { ...state, guidedTimer: { phase: "exercise", sessionId: timer.sessionId, planExerciseId: timer.planExerciseId, startedAt: timer.endsAt, targetSeconds: timer.targetSeconds }, clockNow: action.now };
      }
      if (state.guidedTimer.phase === "exercise" && state.guidedTimer.targetSeconds > 0 && action.now >= state.guidedTimer.startedAt + state.guidedTimer.targetSeconds * 1000) {
        const timer = state.guidedTimer;
        const item = Object.values(state.data.sessionPlanItems).find((candidate) => candidate.sessionId === timer.sessionId && candidate.planExerciseId === timer.planExerciseId);
        if (!item) return { ...state, guidedTimer: { phase: "idle" }, clockNow: action.now };
        const data = cloneData(state.data);
        const setNo = Object.values(data.setEntries).filter((entry) => entry.sessionId === timer.sessionId && entry.planExerciseId === timer.planExerciseId).length + 1;
        const secondsRaw = Math.max(0, (action.now - timer.startedAt) / 1000);
        const entry: SetEntry = { id: newId("set"), sessionId: timer.sessionId, planExerciseId: timer.planExerciseId, exerciseId: item.exerciseId, setNo, seconds: Math.floor(secondsRaw), secondsRaw, startedAt: timer.startedAt, endedAt: action.now, edited: false };
        data.setEntries[entry.id] = entry;
        const session = data.sessions[timer.sessionId];
        if (session) markReviewStale(data, session.date);
        return { ...updateState(state, data), ...stateAfterTimedEntry(data, timer.sessionId, timer.planExerciseId, action.now), clockNow: action.now };
      }
      if (state.guidedTimer.phase === "rest" && action.now >= state.guidedTimer.endsAt) {
        const timer = state.guidedTimer;
        const nextId = timer.nextPlanExerciseId;
        const nextItem = nextId ? Object.values(state.data.sessionPlanItems).find((candidate) => candidate.sessionId === timer.sessionId && candidate.planExerciseId === nextId) : undefined;
        const nextExercise = nextItem ? state.data.exercises[nextItem.exerciseId] : undefined;
        const nextTimer = nextId && nextItem && (nextItem.secondsMax !== undefined || nextExercise?.metric === "seconds") ? timerForTimedItem(state.data, timer.sessionId, nextId, action.now, true) : { phase: "idle" as const };
        return { ...state, guidedPlanExerciseId: nextId, guidedTimer: nextTimer, clockNow: action.now };
      }
      return { ...state, clockNow: action.now };
    }
    case "CONTINUE_GUIDED_EXERCISE": {
      const item = Object.values(state.data.sessionPlanItems).find((candidate) => candidate.sessionId === action.sessionId && candidate.planExerciseId === action.planExerciseId);
      if (!item || state.guidedTimer.phase !== "exercise") return state;
      const secondsRaw = Math.max(0, (action.now - state.guidedTimer.startedAt) / 1000);
      const entry: SetEntry = { id: newId("set"), sessionId: action.sessionId, planExerciseId: action.planExerciseId, exerciseId: item.exerciseId, setNo: Object.values(state.data.setEntries).filter((candidate) => candidate.sessionId === action.sessionId && candidate.planExerciseId === action.planExerciseId).length + 1, seconds: Math.floor(secondsRaw), secondsRaw, startedAt: state.guidedTimer.startedAt, endedAt: action.now, edited: false };
      const data = cloneData(state.data);
      data.setEntries[entry.id] = entry;
      const session = data.sessions[action.sessionId];
      if (session) markReviewStale(data, session.date);
      return { ...updateState(state, data), ...stateAfterTimedEntry(data, action.sessionId, action.planExerciseId, action.now), clockNow: action.now };
    }
    case "SKIP_REST": {
      if (state.guidedTimer.phase !== "rest" || state.guidedTimer.sessionId !== action.sessionId || state.guidedTimer.planExerciseId !== action.planExerciseId) return state;
      const nextId = state.guidedTimer.nextPlanExerciseId;
      const nextItem = nextId ? Object.values(state.data.sessionPlanItems).find((item) => item.sessionId === action.sessionId && item.planExerciseId === nextId) : undefined;
      const nextExercise = nextItem ? state.data.exercises[nextItem.exerciseId] : undefined;
      const nextTimer = nextId && nextItem && (nextItem.secondsMax !== undefined || nextExercise?.metric === "seconds") ? timerForTimedItem(state.data, action.sessionId, nextId, action.now, true) : { phase: "idle" as const };
      return { ...state, guidedPlanExerciseId: nextId, guidedTimer: nextTimer, clockNow: action.now };
    }
    case "COMMIT_REP_SET": {
      const data = cloneData(state.data);
      const entry: SetEntry = { id: action.setId, sessionId: action.sessionId, planExerciseId: action.planExerciseId, exerciseId: action.exerciseId, setNo: action.setNo, reps: action.reps, startedAt: action.now, endedAt: action.now, edited: false };
      data.setEntries[entry.id] = entry;
      const session = data.sessions[action.sessionId];
      if (session) markReviewStale(data, session.date);
      const next = nextGuidedPlanExercise(data, action.sessionId, action.planExerciseId);
      const item = Object.values(data.sessionPlanItems).find((candidate) => candidate.sessionId === action.sessionId && candidate.planExerciseId === action.planExerciseId);
        return { ...updateState(state, data), guidedPlanExerciseId: action.planExerciseId, guidedTimer: restTimerForEntry(data, action.sessionId, action.planExerciseId, action.now, next), clockNow: action.now };
    }
    case "SKIP_GUIDED_EXERCISE": {
      const data = cloneData(state.data);
      const entry: SetEntry = { id: action.setId, sessionId: action.sessionId, planExerciseId: action.planExerciseId, exerciseId: action.exerciseId, setNo: action.setNo, skipReason: action.reason, startedAt: action.now, endedAt: action.now, edited: false };
      data.setEntries[entry.id] = entry;
      const session = data.sessions[action.sessionId];
      if (session) markReviewStale(data, session.date);
      const next = nextGuidedPlanExercise(data, action.sessionId, action.planExerciseId);
      return { ...updateState(state, data), guidedPlanExerciseId: next, guidedTimer: { phase: "idle" } };
    }
    case "FINISH_SESSION": {
      const next = withSession(state, action.sessionId, (session) => ({ ...session, finishedAt: action.now, finishMode: "manual" }));
      return { ...next, activeSessionId: undefined, guidedPlanExerciseId: undefined, guidedTimer: { phase: "idle" }, lastFinishedSessionId: action.sessionId, viewedSessionId: action.sessionId, route: "today" };
    }
    case "DISMISS_SESSION_SUMMARY":
      return { ...state, viewedSessionId: undefined, lastFinishedSessionId: undefined, route: "today" };
    case "UPDATE_SESSION_NOTE":
      return withSession(state, action.sessionId, (session) => ({ ...session, note: action.note }));
    case "UPDATE_SLEEP_HOURS":
      return withSession(state, action.sessionId, (session) => ({ ...session, sleepHours: action.sleepHours }));
  }
}

export function newActionId(prefix: string): string {
  return newId(prefix);
}
