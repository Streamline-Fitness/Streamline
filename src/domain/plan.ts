import type {
  DataDocument,
  ID,
  PlanBlock,
  PlanDay,
  PlanExercise,
  SessionPlanItem,
} from "./model";

export function getActivePlan(data: DataDocument) {
  return Object.values(data.plans).find((plan) => plan.isActive);
}

export function getPlanDays(data: DataDocument, planId: ID): PlanDay[] {
  return Object.values(data.planDays)
    .filter((day) => day.planId === planId)
    .sort((a, b) => {
      if (a.weekday === undefined && b.weekday !== undefined) return 1;
      if (a.weekday !== undefined && b.weekday === undefined) return -1;
      if (a.weekday !== undefined && b.weekday !== undefined && a.weekday !== b.weekday) return a.weekday - b.weekday;
      return a.order - b.order;
    });
}

export function getScheduledDayForDate(data: DataDocument, planId: ID, date: string, preferredDayId?: ID): PlanDay | undefined {
  const weekday = weekdayFromISO(date);
  const scheduledDays = getPlanDays(data, planId).filter((day) => day.weekday === weekday);
  return scheduledDays.find((day) => day.id === preferredDayId) ?? scheduledDays[0];
}

export function getPlanBlocks(data: DataDocument, dayId: ID): PlanBlock[] {
  return Object.values(data.planBlocks)
    .filter((block) => block.dayId === dayId)
    .sort((a, b) => a.order - b.order);
}

export function getBlockExercises(data: DataDocument, blockId: ID): PlanExercise[] {
  return Object.values(data.planExercises)
    .filter((exercise) => exercise.blockId === blockId)
    .sort((a, b) => a.order - b.order);
}

export function expandSessionPlan(data: DataDocument, sessionId: ID, dayId: ID): SessionPlanItem[] {
  const items: SessionPlanItem[] = [];
  for (const block of getPlanBlocks(data, dayId)) {
    for (const planExercise of getBlockExercises(data, block.id)) {
      const exercise = data.exercises[planExercise.exerciseId];
      if (!exercise) continue;
      items.push({
        id: `${sessionId}_${planExercise.id}`,
        sessionId,
        blockId: block.id,
        planExerciseId: planExercise.id,
        blockOrder: block.order,
        exerciseOrder: planExercise.order,
        blockName: block.name,
        blockType: block.type,
        roundsMin: block.roundsMin,
        roundsMax: block.roundsMax,
        restMinS: block.restMinS,
        restMaxS: block.restMaxS,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        repsMin: planExercise.repsMin,
        repsMax: planExercise.repsMax,
        secondsMin: planExercise.secondsMin,
        secondsMax: planExercise.secondsMax,
        sideMode: planExercise.sideMode,
      });
    }
  }
  return items;
}

export function formatTarget(item: Pick<SessionPlanItem, "repsMin" | "repsMax" | "secondsMin" | "secondsMax" | "sideMode">): string {
  if (item.repsMin !== undefined) {
    return `${item.repsMin === item.repsMax ? item.repsMin : `${item.repsMin}–${item.repsMax}`} reps${item.sideMode === "eachSide" ? " each side" : ""}`;
  }
  if (item.secondsMin !== undefined) {
    return `${item.secondsMin === item.secondsMax ? item.secondsMin : `${item.secondsMin}–${item.secondsMax}`} sec${item.sideMode === "eachSide" ? " each side" : ""}`;
  }
  return "No target set";
}

export function formatRange(min: number | undefined, max: number | undefined, unit: string): string {
  if (min === undefined && max === undefined) return `No ${unit} target`;
  if (min !== undefined && max !== undefined && min === max) return `${min} ${unit}`;
  if (min !== undefined && max !== undefined) return `${min}–${max} ${unit}`;
  return `${min ?? max} ${unit}`;
}

export function weekdayFromISO(date: string): number {
  const day = new Date(`${date}T12:00:00`).getDay();
  return day === 0 ? 7 : day;
}

export function todayISO(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T12:00:00`);
  shifted.setDate(shifted.getDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function weekStartForDate(date: string): string {
  const weekday = weekdayFromISO(date);
  return shiftDate(date, 1 - weekday);
}
