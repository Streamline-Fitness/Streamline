import type {
  DataDocument,
  Exercise,
  ID,
  Plan,
  PlanBlock,
  PlanDay,
  PlanExercise,
} from "./model";
import { getBlockExercises, getPlanBlocks, getPlanDays } from "./plan";

export type SharedPlanDay = Omit<PlanDay, "planId">;

export type SharedWorkoutPlanContent = {
  name: string;
  description: string;
  days: SharedPlanDay[];
  blocks: PlanBlock[];
  planExercises: PlanExercise[];
  exercises: Exercise[];
};

export type ImportedPlan = {
  plan: Plan;
  days: PlanDay[];
  blocks: PlanBlock[];
  planExercises: PlanExercise[];
  exercises: Exercise[];
};

export function isPlanEligibleForSharing(plan: Pick<Plan, "shareOrigin" | "hasBeenEdited">): boolean {
  return plan.shareOrigin === undefined || plan.hasBeenEdited === true;
}

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: RecordValue, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value) throw new Error(`The shared workout plan has an invalid ${key}.`);
  return value;
}

function optionalNumber(record: RecordValue, key: string): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`The shared workout plan has an invalid ${key}.`);
  return value;
}

function requiredNonnegativeNumber(record: RecordValue, key: string): number {
  const value = optionalNumber(record, key);
  if (value === undefined) throw new Error(`The shared workout plan is missing ${key}.`);
  if (value < 0) throw new Error(`The shared workout plan has an invalid ${key}.`);
  return value;
}

function orderedRange(record: RecordValue, minimum: string, maximum: string): [number | undefined, number | undefined] {
  const min = optionalNumber(record, minimum);
  const max = optionalNumber(record, maximum);
  if ((min !== undefined && min < 0) || (max !== undefined && max < 0) || (min !== undefined && max !== undefined && max < min)) {
    throw new Error("The shared workout plan has an invalid target range.");
  }
  return [min, max];
}

function optionalString(record: RecordValue, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`The shared workout plan has an invalid ${key}.`);
  return value;
}

function parseDay(value: unknown): SharedPlanDay {
  if (!isRecord(value)) throw new Error("The shared workout plan has an invalid training day.");
  const weekday = optionalNumber(value, "weekday");
  if (weekday !== undefined && (!Number.isInteger(weekday) || weekday < 1 || weekday > 7)) {
    throw new Error("The shared workout plan has an invalid weekday.");
  }
  const order = requiredNonnegativeNumber(value, "order");
  if (!Number.isInteger(order)) throw new Error("The shared workout plan has an invalid day order.");
  if (value.isRestDay !== undefined && typeof value.isRestDay !== "boolean") {
    throw new Error("The shared workout plan has an invalid rest-day setting.");
  }
  if (value.reflectionEnabled !== undefined && typeof value.reflectionEnabled !== "boolean") {
    throw new Error("The shared workout plan has an invalid reflection setting.");
  }
  return {
    id: requiredString(value, "id"),
    name: requiredString(value, "name"),
    order,
    weekday,
    isRestDay: typeof value.isRestDay === "boolean" ? value.isRestDay : undefined,
    reflectionEnabled: typeof value.reflectionEnabled === "boolean" ? value.reflectionEnabled : undefined,
  };
}

const blockTypes = ["straightSets", "superset", "circuit", "timedSequence"] as const;

function parseBlock(value: unknown): PlanBlock {
  if (!isRecord(value) || !blockTypes.includes(value.type as typeof blockTypes[number])) {
    throw new Error("The shared workout plan has an invalid training block.");
  }
  const transitionS = optionalNumber(value, "transitionS");
  if (transitionS !== undefined && transitionS < 0) throw new Error("The shared workout plan has an invalid transition duration.");
  const order = requiredNonnegativeNumber(value, "order");
  const roundsMin = requiredNonnegativeNumber(value, "roundsMin");
  const roundsMax = requiredNonnegativeNumber(value, "roundsMax");
  const restMinS = requiredNonnegativeNumber(value, "restMinS");
  const restMaxS = requiredNonnegativeNumber(value, "restMaxS");
  if (
    !Number.isInteger(order)
    || !Number.isInteger(roundsMin)
    || !Number.isInteger(roundsMax)
    || roundsMax < roundsMin
    || restMaxS < restMinS
  ) {
    throw new Error("The shared workout plan has an invalid block range.");
  }
  return {
    id: requiredString(value, "id"),
    dayId: requiredString(value, "dayId"),
    name: requiredString(value, "name"),
    type: value.type as PlanBlock["type"],
    order,
    roundsMin,
    roundsMax,
    restMinS,
    restMaxS,
    transitionS,
  };
}

function parsePlanExercise(value: unknown): PlanExercise {
  if (!isRecord(value) || (value.sideMode !== "none" && value.sideMode !== "eachSide")) {
    throw new Error("The shared workout plan has an invalid exercise target.");
  }
  const order = requiredNonnegativeNumber(value, "order");
  if (!Number.isInteger(order)) throw new Error("The shared workout plan has an invalid exercise order.");
  const [repsMin, repsMax] = orderedRange(value, "repsMin", "repsMax");
  const [secondsMin, secondsMax] = orderedRange(value, "secondsMin", "secondsMax");
  const [leftRepsMin, leftRepsMax] = orderedRange(value, "leftRepsMin", "leftRepsMax");
  const [rightRepsMin, rightRepsMax] = orderedRange(value, "rightRepsMin", "rightRepsMax");
  const [leftSecondsMin, leftSecondsMax] = orderedRange(value, "leftSecondsMin", "leftSecondsMax");
  const [rightSecondsMin, rightSecondsMax] = orderedRange(value, "rightSecondsMin", "rightSecondsMax");
  return {
    id: requiredString(value, "id"),
    blockId: requiredString(value, "blockId"),
    exerciseId: requiredString(value, "exerciseId"),
    order,
    repsMin,
    repsMax,
    secondsMin,
    secondsMax,
    sideMode: value.sideMode,
    leftRepsMin,
    leftRepsMax,
    rightRepsMin,
    rightRepsMax,
    leftSecondsMin,
    leftSecondsMax,
    rightSecondsMin,
    rightSecondsMax,
  };
}

function parseExercise(value: unknown): Exercise {
  if (
    !isRecord(value)
    || !["skill", "strength", "stretch"].includes(value.category as string)
    || (value.metric !== "seconds" && value.metric !== "reps")
    || (value.sideMode !== "none" && value.sideMode !== "eachSide")
  ) {
    throw new Error("The shared workout plan has an invalid exercise.");
  }
  const pattern = optionalString(value, "pattern");
  if (pattern !== undefined && !["push", "pull", "legs", "core", "mobility"].includes(pattern)) {
    throw new Error("The shared workout plan has an invalid exercise pattern.");
  }
  const leadInS = optionalNumber(value, "leadInS");
  const defaultHoldS = optionalNumber(value, "defaultHoldS");
  if ((leadInS !== undefined && leadInS < 0) || (defaultHoldS !== undefined && defaultHoldS < 0)) {
    throw new Error("The shared workout plan has an invalid exercise duration.");
  }
  return {
    id: requiredString(value, "id"),
    name: requiredString(value, "name"),
    category: value.category as Exercise["category"],
    metric: value.metric,
    source: "user" as const,
    skillId: optionalString(value, "skillId"),
    pattern: pattern as Exercise["pattern"],
    leadInS,
    defaultHoldS,
    sideMode: value.sideMode,
  };
}

function requireUniqueIds<T extends { id: ID }>(records: T[], kind: string): void {
  const ids = new Set(records.map((record) => record.id));
  if (ids.size !== records.length) throw new Error(`The shared workout plan has duplicate ${kind} IDs.`);
}

export function parseSharedWorkoutPlanContent(value: unknown): SharedWorkoutPlanContent {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim() || value.name.length > 100) {
    throw new Error("The shared workout plan has an invalid name.");
  }
  if (value.description !== undefined && (typeof value.description !== "string" || value.description.length > 500)) {
    throw new Error("The shared workout plan has an invalid description.");
  }
  if (!Array.isArray(value.days) || !Array.isArray(value.blocks) || !Array.isArray(value.planExercises) || !Array.isArray(value.exercises)) {
    throw new Error("The shared workout plan is incomplete.");
  }
  const days = value.days.map(parseDay);
  const blocks = value.blocks.map(parseBlock);
  const planExercises = value.planExercises.map(parsePlanExercise);
  const exercises = value.exercises.map(parseExercise);
  requireUniqueIds(days, "training day");
  requireUniqueIds(blocks, "block");
  requireUniqueIds(planExercises, "plan exercise");
  requireUniqueIds(exercises, "exercise");

  const dayIds = new Set(days.map((day) => day.id));
  const blockIds = new Set(blocks.map((block) => block.id));
  const exerciseIds = new Set(exercises.map((exercise) => exercise.id));
  if (blocks.some((block) => !dayIds.has(block.dayId))) throw new Error("The shared workout plan contains a block without a training day.");
  if (planExercises.some((item) => !blockIds.has(item.blockId) || !exerciseIds.has(item.exerciseId))) {
    throw new Error("The shared workout plan contains an exercise with a missing reference.");
  }
  const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  if (planExercises.some((item) => {
    const exercise = exercisesById.get(item.exerciseId);
    return exercise?.metric === "reps"
      ? item.secondsMin !== undefined || item.secondsMax !== undefined || item.leftSecondsMin !== undefined || item.leftSecondsMax !== undefined || item.rightSecondsMin !== undefined || item.rightSecondsMax !== undefined
      : item.repsMin !== undefined || item.repsMax !== undefined || item.leftRepsMin !== undefined || item.leftRepsMax !== undefined || item.rightRepsMin !== undefined || item.rightRepsMax !== undefined;
  })) {
    throw new Error("The shared workout plan has a target that does not match its exercise metric.");
  }

  return {
    name: value.name.trim(),
    description: typeof value.description === "string" ? value.description : "",
    days,
    blocks,
    planExercises,
    exercises,
  };
}

export function createSharedWorkoutPlanContent(data: DataDocument, planId: ID): SharedWorkoutPlanContent {
  const plan = data.plans[planId];
  if (!plan) throw new Error("That plan is no longer available.");
  const days = getPlanDays(data, planId);
  const blocks = days.flatMap((day) => getPlanBlocks(data, day.id)).map((block) => ({
    id: block.id,
    dayId: block.dayId,
    name: block.name,
    type: block.type,
    order: block.order,
    roundsMin: block.roundsMin,
    roundsMax: block.roundsMax,
    restMinS: block.restMinS,
    restMaxS: block.restMaxS,
    transitionS: block.transitionS,
  }));
  const planExercises = blocks.flatMap((block) => getBlockExercises(data, block.id)).map((item) => ({
    id: item.id,
    blockId: item.blockId,
    exerciseId: item.exerciseId,
    order: item.order,
    repsMin: item.repsMin,
    repsMax: item.repsMax,
    secondsMin: item.secondsMin,
    secondsMax: item.secondsMax,
    sideMode: item.sideMode,
    leftRepsMin: item.leftRepsMin,
    leftRepsMax: item.leftRepsMax,
    rightRepsMin: item.rightRepsMin,
    rightRepsMax: item.rightRepsMax,
    leftSecondsMin: item.leftSecondsMin,
    leftSecondsMax: item.leftSecondsMax,
    rightSecondsMin: item.rightSecondsMin,
    rightSecondsMax: item.rightSecondsMax,
  }));
  const exerciseIds = new Set(planExercises.map((item) => item.exerciseId));
  const exercises = [...exerciseIds].map((id) => {
    const exercise = data.exercises[id];
    if (!exercise) throw new Error(`The plan references a missing exercise (${id}).`);
    return {
      id: exercise.id,
      name: exercise.name,
      category: exercise.category,
      metric: exercise.metric,
      source: "user" as const,
      skillId: exercise.skillId,
      pattern: exercise.pattern,
      leadInS: exercise.leadInS,
      defaultHoldS: exercise.defaultHoldS,
      sideMode: exercise.sideMode,
    };
  });
  return {
    name: plan.name,
    description: plan.description ?? "",
    days: days.map((day) => ({
      id: day.id,
      name: day.name,
      order: day.order,
      weekday: day.weekday,
      isRestDay: day.isRestDay,
      reflectionEnabled: day.reflectionEnabled,
    })),
    blocks,
    planExercises,
    exercises,
  };
}

export function createImportedPlan(
  shared: SharedWorkoutPlanContent,
  createId: (prefix: string) => ID,
  now: number,
): ImportedPlan {
  const planId = createId("plan");
  const dayIds = new Map(shared.days.map((day) => [day.id, createId("day")]));
  const blockIds = new Map(shared.blocks.map((block) => [block.id, createId("block")]));
  const planExerciseIds = new Map(shared.planExercises.map((item) => [item.id, createId("planExercise")]));
  const exerciseIds = new Map(shared.exercises.map((exercise) => [exercise.id, createId("exercise")]));

  return {
    plan: {
      id: planId,
      name: shared.name,
      description: shared.description,
      isActive: false,
      createdAt: now,
      updatedAt: now,
      shareOrigin: "copy",
      hasBeenEdited: false,
    },
    days: shared.days.map((day) => ({
      ...day,
      id: dayIds.get(day.id)!,
      planId,
    })),
    blocks: shared.blocks.map((block) => ({
      ...block,
      id: blockIds.get(block.id)!,
      dayId: dayIds.get(block.dayId)!,
    })),
    planExercises: shared.planExercises.map((item) => ({
      ...item,
      id: planExerciseIds.get(item.id)!,
      blockId: blockIds.get(item.blockId)!,
      exerciseId: exerciseIds.get(item.exerciseId)!,
    })),
    exercises: shared.exercises.map((exercise) => ({
      ...exercise,
      id: exerciseIds.get(exercise.id)!,
      source: "user" as const,
    })),
  };
}
