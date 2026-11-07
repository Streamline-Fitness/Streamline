import { expandSessionPlan, getScheduledDayForDate, todayISO, weekdayFromISO, weekStartForDate } from "../domain/plan";
import { newId } from "../domain/ids";
import { cloneData } from "../domain/seed";
import { currentGuidedPlanExercise, isSessionFinished, latestFinishedSession, nextGuidedPlanExercise, nextPlanExerciseAfterEntry, shouldRestAfterEntry } from "../domain/session";
import type {
  Exercise,
  ID,
  Session,
  SetEntry,
  SkippedBlock,
} from "../domain/model";
import type { Action } from "./actions";
import { journalReducer } from "./journalReducer";
import type { AppState, GuidedTimer } from "./appState";

export type { Action } from "./actions";

function updateState(state: AppState, data: AppState["data"]): AppState {
  return { ...state, data, error: undefined };
}

function hasImportedIdCollision<T extends { id: ID }>(existing: Record<ID, T>, incoming: T[]): boolean {
  const ids = new Set(incoming.map((record) => record.id));
  return ids.size !== incoming.length || incoming.some((record) => record.id in existing);
}

function markPlanEdited(data: AppState["data"], planId: ID | undefined): void {
  const plan = planId ? data.plans[planId] : undefined;
  if (plan) plan.hasBeenEdited = true;
}

function planIdForDay(data: AppState["data"], dayId: ID): ID | undefined {
  return data.planDays[dayId]?.planId;
}

function planIdForBlock(data: AppState["data"], blockId: ID): ID | undefined {
  const block = data.planBlocks[blockId];
  return block ? planIdForDay(data, block.dayId) : undefined;
}

function markPlansUsingExerciseEdited(data: AppState["data"], exerciseId: ID): void {
  for (const item of Object.values(data.planExercises)) {
    if (item.exerciseId === exerciseId) markPlanEdited(data, planIdForBlock(data, item.blockId));
  }
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

function timerForTimedItem(data: AppState["data"], sessionId: ID, planExerciseId: ID, now: number): GuidedTimer {
  const item = Object.values(data.sessionPlanItems).find((candidate) => candidate.sessionId === sessionId && candidate.planExerciseId === planExerciseId);
  if (!item) return { phase: "idle" };
  const exercise = data.exercises[item.exerciseId];
  const targetSeconds = item.secondsMax ?? exercise?.defaultHoldS ?? 0;
  const preparationSeconds = exercise?.leadInS ?? data.settings.defaultLeadInS;
  if (preparationSeconds > 0) {
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

function stateAfterEntry(data: AppState["data"], sessionId: ID, planExerciseId: ID, now: number): Pick<AppState, "guidedPlanExerciseId" | "guidedTimer"> {
  const nextPlanExerciseId = nextPlanExerciseAfterEntry(data, sessionId, planExerciseId);
  if (shouldRestAfterEntry(data, sessionId, planExerciseId, nextPlanExerciseId)) {
    const restTimer = restTimerForEntry(data, sessionId, planExerciseId, now, nextPlanExerciseId);
    if (restTimer.phase === "rest") return { guidedPlanExerciseId: planExerciseId, guidedTimer: restTimer };
  }

  return {
    guidedPlanExerciseId: nextPlanExerciseId,
    guidedTimer: { phase: "idle" },
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "HYDRATE":
      {
        const data = action.data;
        for (const plan of Object.values(data.plans)) {
          if (plan.id === "plan_demo_weekly_template" || plan.id.startsWith("plan_onboarding_")) {
            plan.shareOrigin ??= "starter";
          }
        }
        for (const exercise of Object.values(data.exercises)) exercise.sideMode ??= "none";
        data.skippedBlocks ??= {};
        data.journalEntries ??= {};
        data.journalCategories ??= {};
        const activePlan = Object.values(data.plans).find((plan) => plan.isActive);
        const latestFinished = latestFinishedSession(data);
        const activeSession = Object.values(data.sessions).find((session) => session.date === state.selectedDate && !isSessionFinished(session));
        return {
          ...state,
          data,
          selectedPlanId: activePlan?.id,
           selectedPlanDayId: activePlan ? getScheduledDayForDate(data, activePlan.id, state.selectedDate, state.selectedPlanDayId)?.id : undefined,
          activeSessionId: activeSession?.id,
          guidedPlanExerciseId: activeSession ? currentGuidedPlanExercise(data, activeSession.id) : undefined,
          guidedTimer: { phase: "idle" },
          clockNow: Date.now(),
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
    case "SAVE_JOURNAL_ENTRY":
    case "DELETE_JOURNAL_ENTRY":
    case "ADD_JOURNAL_CATEGORY":
    case "RENAME_JOURNAL_CATEGORY":
    case "DELETE_JOURNAL_CATEGORY":
      return journalReducer(state, action);
    case "CREATE_PLAN": {
      const data = cloneData(state.data);
      data.plans[action.planId] = { id: action.planId, name: action.name, isActive: false, createdAt: action.now, updatedAt: action.now };
      return { ...updateState(state, data), editorPlanId: action.planId, selectedPlanId: action.planId, route: "plan-editor" };
    }
    case "DELETE_PLAN": {
      const plan = state.data.plans[action.planId];
      if (!plan) return state;
      const data = cloneData(state.data);
      delete data.plans[action.planId];
      const dayIds = new Set(
        Object.values(data.planDays)
          .filter((day) => day.planId === action.planId)
          .map((day) => day.id),
      );
      for (const dayId of dayIds) delete data.planDays[dayId];
      const blockIds = new Set(
        Object.values(data.planBlocks)
          .filter((block) => dayIds.has(block.dayId))
          .map((block) => block.id),
      );
      for (const blockId of blockIds) delete data.planBlocks[blockId];
      for (const item of Object.values(data.planExercises)) {
        if (blockIds.has(item.blockId)) delete data.planExercises[item.id];
      }

      const removedActivePlan = plan.isActive;
      const nextActivePlan = removedActivePlan
        ? Object.values(data.plans)[0]
        : Object.values(data.plans).find((candidate) => candidate.isActive);
      if (removedActivePlan && nextActivePlan) {
        for (const candidate of Object.values(data.plans)) candidate.isActive = candidate.id === nextActivePlan.id;
      }
      const selectedPlanId = nextActivePlan?.id
        ?? (state.selectedPlanId && data.plans[state.selectedPlanId] ? state.selectedPlanId : undefined);
      const deletingEditorPlan = state.editorPlanId === action.planId;
      return {
        ...updateState(state, data),
        selectedPlanId,
        selectedPlanDayId: selectedPlanId
          ? getScheduledDayForDate(data, selectedPlanId, state.selectedDate)?.id
          : undefined,
        editorPlanId: deletingEditorPlan ? selectedPlanId : state.editorPlanId,
        route: deletingEditorPlan && state.route === "plan-editor" ? "plans" : state.route,
      };
    }
    case "IMPORT_SHARED_PLAN": {
      const { importedPlan } = action;
      if (
        hasImportedIdCollision(state.data.plans, [importedPlan.plan])
        || hasImportedIdCollision(state.data.planDays, importedPlan.days)
        || hasImportedIdCollision(state.data.planBlocks, importedPlan.blocks)
        || hasImportedIdCollision(state.data.planExercises, importedPlan.planExercises)
        || hasImportedIdCollision(state.data.exercises, importedPlan.exercises)
      ) {
        return { ...state, error: "This copied plan could not be added because one of its IDs already exists. Try copying it again." };
      }
      const data = cloneData(state.data);
      data.plans[importedPlan.plan.id] = importedPlan.plan;
      for (const day of importedPlan.days) data.planDays[day.id] = day;
      for (const block of importedPlan.blocks) data.planBlocks[block.id] = block;
      for (const item of importedPlan.planExercises) data.planExercises[item.id] = item;
      for (const exercise of importedPlan.exercises) data.exercises[exercise.id] = exercise;
      return {
        ...updateState(state, data),
        editorPlanId: importedPlan.plan.id,
        selectedPlanId: importedPlan.plan.id,
        route: "plans",
      };
    }
    case "UPDATE_PLAN": {
      const plan = state.data.plans[action.planId];
      if (!plan) return state;
      const data = cloneData(state.data);
      const description = action.description || undefined;
      const wasEdited = plan.name !== action.name || plan.description !== description;
      data.plans[action.planId] = {
        ...plan,
        name: action.name,
        description,
        updatedAt: wasEdited ? action.now : plan.updatedAt,
        hasBeenEdited: plan.hasBeenEdited || wasEdited,
      };
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
      markPlanEdited(data, action.planId);
      const order = Object.values(data.planDays).filter((day) => day.planId === action.planId).length;
      data.planDays[action.dayId] = { id: action.dayId, planId: action.planId, name: action.name, weekday: action.weekday, order };
      return { ...updateState(state, data), selectedPlanDayId: action.dayId };
    }
    case "UPDATE_PLAN_DAY": {
      const day = state.data.planDays[action.dayId];
      if (!day) return state;
      const nextDay = {
        ...day,
        name: action.name,
        weekday: action.weekday,
        isRestDay: action.isRestDay ?? day.isRestDay ?? false,
        reflectionEnabled: action.isRestDay === false ? false : action.reflectionEnabled ?? day.reflectionEnabled ?? false,
      };
      const wasEdited = day.name !== nextDay.name
        || day.weekday !== nextDay.weekday
        || day.isRestDay !== nextDay.isRestDay
        || day.reflectionEnabled !== nextDay.reflectionEnabled;
      const data = cloneData(state.data);
      data.planDays[action.dayId] = nextDay;
      if (wasEdited) markPlanEdited(data, day.planId);
      return updateState(state, data);
    }
    case "DELETE_PLAN_DAY": {
      const day = state.data.planDays[action.dayId];
      if (!day) return state;
      const data = cloneData(state.data);
      markPlanEdited(data, day.planId);
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
      const day = data.planDays[action.dayId];
      markPlanEdited(data, day?.planId);
      const order = Object.values(data.planBlocks).filter((block) => block.dayId === action.dayId).length;
      data.planBlocks[action.blockId] = { id: action.blockId, dayId: action.dayId, name: action.name, type: action.blockType, order, roundsMin: 1, roundsMax: 1, restMinS: 45, restMaxS: 60 };
      return updateState(state, data);
    }
    case "UPDATE_PLAN_BLOCK": {
      const block = state.data.planBlocks[action.blockId];
      if (!block) return state;
      const data = cloneData(state.data);
      const wasEdited = block.name !== action.name
        || block.type !== action.blockType
        || block.roundsMin !== action.roundsMin
        || block.roundsMax !== action.roundsMax
        || block.restMinS !== action.restMinS
        || block.restMaxS !== action.restMaxS;
      data.planBlocks[action.blockId] = { ...block, name: action.name, type: action.blockType, roundsMin: action.roundsMin, roundsMax: action.roundsMax, restMinS: action.restMinS, restMaxS: action.restMaxS };
      if (wasEdited) markPlanEdited(data, planIdForBlock(data, action.blockId));
      return updateState(state, data);
    }
    case "DELETE_PLAN_BLOCK": {
      const block = state.data.planBlocks[action.blockId];
      if (!block) return state;
      const data = cloneData(state.data);
      markPlanEdited(data, planIdForBlock(data, action.blockId));
      delete data.planBlocks[action.blockId];
      for (const item of Object.values(data.planExercises)) {
        if (item.blockId === action.blockId) delete data.planExercises[item.id];
      }
      return updateState(state, data);
    }
    case "ADD_PLAN_EXERCISE": {
      const data = cloneData(state.data);
      markPlanEdited(data, planIdForBlock(data, action.blockId));
      const order = Object.values(data.planExercises).filter((item) => item.blockId === action.blockId).length;
      data.planExercises[action.planExerciseId] = { id: action.planExerciseId, blockId: action.blockId, exerciseId: action.exerciseId, order, repsMin: action.repsMin, repsMax: action.repsMax, secondsMin: action.secondsMin, secondsMax: action.secondsMax, sideMode: action.sideMode };
      return updateState(state, data);
    }
    case "REMOVE_PLAN_EXERCISE": {
      const data = cloneData(state.data);
      const planExercise = data.planExercises[action.planExerciseId];
      if (!planExercise) return state;
      markPlanEdited(data, planIdForBlock(data, planExercise.blockId));
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
      const wasEdited = updated.name !== exercise.name
        || updated.category !== exercise.category
        || updated.metric !== exercise.metric
        || updated.pattern !== exercise.pattern
        || updated.skillId !== exercise.skillId
        || updated.leadInS !== exercise.leadInS
        || updated.defaultHoldS !== exercise.defaultHoldS
        || updated.sideMode !== exercise.sideMode;
      data.exercises[action.exerciseId] = updated;
      if (wasEdited && isUsedInPlan) markPlansUsingExerciseEdited(data, action.exerciseId);
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
      if (action.date !== todayISO(action.now)) {
        return { ...state, error: "Sessions can only be started for today. Return to today's date to begin this workout." };
      }
      const existing = Object.values(state.data.sessions).find((session) => session.date === action.date && !session.finishedAt && !session.isHistorical);
      if (existing) {
        const current = currentGuidedPlanExercise(state.data, existing.id);
        return { ...state, activeSessionId: existing.id, guidedPlanExerciseId: current, guidedTimer: { phase: "idle" }, clockNow: action.now, route: "today" };
      }
      const data = cloneData(state.data);
      const session: Session = { id: action.sessionId, date: action.date, weekday: weekdayFromISO(action.date), planId: action.planId, planDayId: action.planDayId, startedAt: action.now, note: "" };
      data.sessions[session.id] = session;
      markReviewStale(data, session.date);
      for (const item of expandSessionPlan(data, session.id, action.planDayId)) data.sessionPlanItems[item.id] = item;
      const firstItem = expandSessionPlan(data, session.id, action.planDayId)[0];
      return { ...updateState(state, data), activeSessionId: session.id, guidedPlanExerciseId: firstItem?.planExerciseId, guidedTimer: { phase: "idle" }, clockNow: action.now, route: "today" };
    }
    case "START_GUIDED_EXERCISE": {
      const item = Object.values(state.data.sessionPlanItems).find((candidate) => candidate.sessionId === action.sessionId && candidate.planExerciseId === action.planExerciseId);
      if (!item) return state;
      const exercise = state.data.exercises[item.exerciseId];
      const timer = timerForTimedItem(state.data, action.sessionId, action.planExerciseId, action.now);
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
      return { ...updateState(state, data), guidedPlanExerciseId: next?.planExerciseId, guidedTimer: { phase: "idle" }, clockNow: action.now };
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
        return { ...updateState(state, data), ...stateAfterEntry(data, timer.sessionId, timer.planExerciseId, action.now), clockNow: action.now };
      }
      if (state.guidedTimer.phase === "rest" && action.now >= state.guidedTimer.endsAt) {
        const timer = state.guidedTimer;
        const nextId = timer.nextPlanExerciseId;
        return { ...state, guidedPlanExerciseId: nextId, guidedTimer: { phase: "idle" }, clockNow: action.now };
      }
      return { ...state, clockNow: action.now };
    }
    case "PAUSE_GUIDED_EXERCISE": {
      if (state.guidedTimer.phase !== "exercise") return state;
      const timer = state.guidedTimer;
      if (timer.targetSeconds > 0 && action.now >= timer.startedAt + timer.targetSeconds * 1000) {
        return reducer(state, { type: "CLOCK_TICK", now: action.now });
      }
      return {
        ...state,
        guidedTimer: {
          phase: "paused",
          sessionId: timer.sessionId,
          planExerciseId: timer.planExerciseId,
          elapsedSeconds: Math.max(0, (action.now - timer.startedAt) / 1000),
          targetSeconds: timer.targetSeconds,
        },
        clockNow: action.now,
      };
    }
    case "RESUME_GUIDED_EXERCISE": {
      if (state.guidedTimer.phase !== "paused") return state;
      const timer = state.guidedTimer;
      return {
        ...state,
        guidedTimer: {
          phase: "exercise",
          sessionId: timer.sessionId,
          planExerciseId: timer.planExerciseId,
          startedAt: action.now - timer.elapsedSeconds * 1000,
          targetSeconds: timer.targetSeconds,
        },
        clockNow: action.now,
      };
    }
    case "CONTINUE_GUIDED_EXERCISE": {
      const item = Object.values(state.data.sessionPlanItems).find((candidate) => candidate.sessionId === action.sessionId && candidate.planExerciseId === action.planExerciseId);
      const timer = state.guidedTimer;
      if (!item || (timer.phase !== "exercise" && timer.phase !== "paused")) return state;
      const secondsRaw = timer.phase === "paused" ? timer.elapsedSeconds : Math.max(0, (action.now - timer.startedAt) / 1000);
      const startedAt = action.now - secondsRaw * 1000;
      const entry: SetEntry = { id: newId("set"), sessionId: action.sessionId, planExerciseId: action.planExerciseId, exerciseId: item.exerciseId, setNo: Object.values(state.data.setEntries).filter((candidate) => candidate.sessionId === action.sessionId && candidate.planExerciseId === action.planExerciseId).length + 1, seconds: Math.floor(secondsRaw), secondsRaw, startedAt, endedAt: action.now, edited: false };
      const data = cloneData(state.data);
      data.setEntries[entry.id] = entry;
      const session = data.sessions[action.sessionId];
      if (session) markReviewStale(data, session.date);
      return { ...updateState(state, data), ...stateAfterEntry(data, action.sessionId, action.planExerciseId, action.now), clockNow: action.now };
    }
    case "SKIP_REST": {
      if (state.guidedTimer.phase !== "rest" || state.guidedTimer.sessionId !== action.sessionId || state.guidedTimer.planExerciseId !== action.planExerciseId) return state;
      const nextId = state.guidedTimer.nextPlanExerciseId;
      return { ...state, guidedPlanExerciseId: nextId, guidedTimer: { phase: "idle" }, clockNow: action.now };
    }
    case "COMMIT_REP_SET": {
      const data = cloneData(state.data);
      const entry: SetEntry = { id: action.setId, sessionId: action.sessionId, planExerciseId: action.planExerciseId, exerciseId: action.exerciseId, setNo: action.setNo, reps: action.reps, startedAt: action.now, endedAt: action.now, edited: false };
      data.setEntries[entry.id] = entry;
      const session = data.sessions[action.sessionId];
      if (session) markReviewStale(data, session.date);
      return { ...updateState(state, data), ...stateAfterEntry(data, action.sessionId, action.planExerciseId, action.now), clockNow: action.now };
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
    case "DELETE_IN_PROGRESS_SESSION": {
      const session = state.data.sessions[action.sessionId];
      if (!session) return { ...state, error: "That session is no longer available." };
      if (isSessionFinished(session) || session.isHistorical) {
        return { ...state, error: "Only an in-progress session can be discarded." };
      }

      const data = cloneData(state.data);
      delete data.sessions[action.sessionId];
      for (const [id, item] of Object.entries(data.sessionPlanItems)) {
        if (item.sessionId === action.sessionId) delete data.sessionPlanItems[id];
      }
      for (const [id, entry] of Object.entries(data.setEntries)) {
        if (entry.sessionId === action.sessionId) delete data.setEntries[id];
      }
      for (const [id, skippedBlock] of Object.entries(data.skippedBlocks)) {
        if (skippedBlock.sessionId === action.sessionId) delete data.skippedBlocks[id];
      }
      markReviewStale(data, session.date);
      return {
        ...updateState(state, data),
        activeSessionId: state.activeSessionId === action.sessionId ? undefined : state.activeSessionId,
        guidedPlanExerciseId: state.activeSessionId === action.sessionId ? undefined : state.guidedPlanExerciseId,
        guidedTimer: state.activeSessionId === action.sessionId ? { phase: "idle" } : state.guidedTimer,
        viewedSessionId: state.viewedSessionId === action.sessionId ? undefined : state.viewedSessionId,
        lastFinishedSessionId: state.lastFinishedSessionId === action.sessionId ? undefined : state.lastFinishedSessionId,
      };
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
