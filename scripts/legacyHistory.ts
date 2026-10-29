import type { DataDocument, Exercise, ExerciseCategory, ID, Metric, SessionPlanItem, SideMode } from "../src/domain/model";
import { cloneData } from "../src/domain/seed";
import legacyHistory from "../private/legacyHistory.json";

type LegacyMove = (typeof legacyHistory.sessions)[number]["moves"][number];
type LegacySession = (typeof legacyHistory.sessions)[number];

function normalizedName(name: string): string {
  return name.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function stableHash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function metricFor(value: string | null): Metric | undefined {
  if (value === null) return undefined;
  if (value === "reps" || value === "seconds") return value;
  throw new Error(`Unsupported historical exercise metric: ${value}`);
}

function categoryFor(value: string): ExerciseCategory {
  if (value === "skill" || value === "strength" || value === "stretch") return value;
  throw new Error(`Unsupported historical exercise category: ${value}`);
}

function exerciseFor(data: DataDocument, move: LegacyMove): Exercise | undefined {
  const metric = metricFor(move.metric);
  if (!metric) return undefined;
  const existing = Object.values(data.exercises).find(
    (exercise) => normalizedName(exercise.name) === normalizedName(move.name) && exercise.metric === metric,
  );
  if (existing) return existing;

  const exercise: Exercise = {
    id: `legacy_exercise_${stableHash(`${normalizedName(move.name)}:${metric}`)}`,
    name: move.name,
    category: categoryFor(move.category),
    metric,
    source: "user",
    sideMode: "none",
  };
  data.exercises[exercise.id] = exercise;
  return exercise;
}

function planItemFor(
  session: LegacySession,
  move: LegacyMove,
  exercise: Exercise,
  moveIndex: number,
  sectionOrder: number,
  exerciseOrder: number,
): SessionPlanItem {
  const sessionId = `legacy_session_${session.date.replace(/-/g, "")}`;
  const itemId = `legacy_item_${stableHash(`${session.date}:${moveIndex}:${normalizedName(move.name)}`)}`;
  const blockId = `legacy_block_${stableHash(`${session.date}:${move.section}`)}`;
  return {
    id: itemId,
    sessionId,
    blockId,
    planExerciseId: itemId,
    blockOrder: sectionOrder,
    exerciseOrder,
    blockName: move.section,
    blockType: "straightSets",
    roundsMin: 1,
    roundsMax: Math.max(1, move.values?.length ?? 1),
    restMinS: 0,
    restMaxS: 0,
    exerciseId: exercise.id,
    exerciseName: move.name,
    sideMode: (move.sideMode === "eachSide" ? "eachSide" : "none") satisfies SideMode,
    ...(move.targetMin !== null ? { repsMin: move.metric === "reps" ? move.targetMin : undefined, secondsMin: move.metric === "seconds" ? move.targetMin : undefined } : {}),
    ...(move.targetMax !== null ? { repsMax: move.metric === "reps" ? move.targetMax : undefined, secondsMax: move.metric === "seconds" ? move.targetMax : undefined } : {}),
  };
}

export function withLegacyHistory(sourceData: DataDocument): DataDocument {
  const data = cloneData(sourceData);
  for (const legacy of legacyHistory.sessions) {
    const sessionId = `legacy_session_${legacy.date.replace(/-/g, "")}`;
    if (data.sessions[sessionId] || Object.values(data.sessions).some((session) => session.importKey === `legacy-log:${legacy.date}`)) continue;

    data.sessions[sessionId] = {
      id: sessionId,
      date: legacy.date,
      weekday: legacy.weekday,
      note: legacy.note,
      skipReason: legacy.skipReason ?? undefined,
      isHistorical: true,
      durationSeconds: legacy.durationSeconds ?? undefined,
      sourceText: legacy.sourceText,
      hasUnresolvedHistory: legacy.hasUnresolvedHistory,
      importKey: `legacy-log:${legacy.date}`,
    };

    const sectionOrders = new Map<string, number>();
    const sectionExerciseOrders = new Map<string, number>();
    legacy.moves.forEach((move, moveIndex) => {
      const exercise = exerciseFor(data, move);
      if (!exercise) return;
      const sectionOrder = sectionOrders.get(move.section) ?? sectionOrders.size;
      sectionOrders.set(move.section, sectionOrder);
      const exerciseOrder = sectionExerciseOrders.get(move.section) ?? 0;
      sectionExerciseOrders.set(move.section, exerciseOrder + 1);
      const item = planItemFor(legacy, move, exercise, moveIndex, sectionOrder, exerciseOrder);
      data.sessionPlanItems[item.id] = item;

      move.values?.forEach((value, valueIndex) => {
        const importKey = `legacy-log:${legacy.date}:${moveIndex}:${valueIndex + 1}`;
        const entryId = `legacy_entry_${stableHash(importKey)}`;
        data.setEntries[entryId] = {
          id: entryId,
          sessionId,
          planExerciseId: item.planExerciseId,
          exerciseId: exercise.id,
          setNo: valueIndex + 1,
          ...(move.metric === "reps" ? { reps: value } : { seconds: Math.floor(value), secondsRaw: value }),
          edited: false,
          importKey,
        };
      });
    });
  }

  for (const review of legacyHistory.weeklyReviews) {
    if (!data.weeklyReviews[review.weekStart]) {
      data.weeklyReviews[review.weekStart] = {
        weekStart: review.weekStart,
        reflection: review.reflection,
        nextWeekGoal: "",
        isStale: false,
      };
    }
  }

  return data;
}
