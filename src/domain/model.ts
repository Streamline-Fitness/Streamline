export type ID = string;
export type ISODate = string;

export type Metric = "seconds" | "reps";
export type ExerciseCategory = "skill" | "strength" | "stretch";
export type Pattern = "push" | "pull" | "legs" | "core" | "mobility";
export type FormFlag = "clean" | "shaky" | "bailed";
export type SessionStatus = "done" | "partial" | "skipped";
export type SideMode = "none" | "eachSide";
export type PlanBlockType =
  | "straightSets"
  | "superset"
  | "circuit"
  | "timedSequence";

export type Exercise = {
  id: ID;
  name: string;
  category: ExerciseCategory;
  metric: Metric;
  source: "system" | "user";
  skillId?: string;
  pattern?: Pattern;
  leadInS?: number;
  defaultHoldS?: number;
  sideMode: SideMode;
};

export type ProgressionLevel = {
  id: ID;
  skillId: string;
  rank: number;
  name: string;
};

export type Plan = {
  id: ID;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
};

export type PlanDay = {
  id: ID;
  planId: ID;
  weekday?: number;
  name: string;
  order: number;
  isRestDay?: boolean;
  reflectionEnabled?: boolean;
};

export type PlanBlock = {
  id: ID;
  dayId: ID;
  name: string;
  type: PlanBlockType;
  order: number;
  roundsMin: number;
  roundsMax: number;
  restMinS: number;
  restMaxS: number;
  transitionS?: number;
};

export type PlanExercise = {
  id: ID;
  blockId: ID;
  exerciseId: ID;
  order: number;
  repsMin?: number;
  repsMax?: number;
  secondsMin?: number;
  secondsMax?: number;
  sideMode: SideMode;
  leftRepsMin?: number;
  leftRepsMax?: number;
  rightRepsMin?: number;
  rightRepsMax?: number;
  leftSecondsMin?: number;
  leftSecondsMax?: number;
  rightSecondsMin?: number;
  rightSecondsMax?: number;
};

/** Immutable plan expansion captured when a session begins. */
export type SessionPlanItem = {
  id: ID;
  sessionId: ID;
  blockId: ID;
  planExerciseId: ID;
  blockOrder: number;
  exerciseOrder: number;
  blockName: string;
  blockType: PlanBlockType;
  roundsMin: number;
  roundsMax: number;
  restMinS: number;
  restMaxS: number;
  exerciseId: ID;
  exerciseName: string;
  repsMin?: number;
  repsMax?: number;
  secondsMin?: number;
  secondsMax?: number;
  sideMode: SideMode;
  leftRepsMin?: number;
  leftRepsMax?: number;
  rightRepsMin?: number;
  rightRepsMax?: number;
  leftSecondsMin?: number;
  leftSecondsMax?: number;
  rightSecondsMin?: number;
  rightSecondsMax?: number;
};

export type Session = {
  id: ID;
  date: ISODate;
  weekday: number;
  planId?: ID;
  planDayId?: ID;
  startedAt?: number;
  finishedAt?: number;
  finishMode?: "auto" | "manual";
  note: string;
  skipReason?: string;
  sleepHours?: number;
  importKey?: string;
  isHistorical?: boolean;
  durationSeconds?: number;
  sourceText?: string;
  hasUnresolvedHistory?: boolean;
};

export type SetEntry = {
  id: ID;
  sessionId: ID;
  planExerciseId?: ID;
  exerciseId: ID;
  levelId?: ID;
  setNo: number;
  reps?: number;
  seconds?: number;
  secondsRaw?: number;
  startedAt?: number;
  endedAt?: number;
  restS?: number;
  equipment?: string;
  formFlag?: FormFlag;
  edited: boolean;
  rating?: number;
  skipReason?: string;
  importKey?: string;
};

export type SkippedBlock = {
  id: ID;
  sessionId: ID;
  blockId: ID;
  blockName: string;
  reason: string;
  skippedAt: number;
};

export type WeeklyReview = {
  weekStart: ISODate;
  reflection: string;
  nextWeekGoal: string;
  reviewedAt?: number;
  isStale: boolean;
};

export type Settings = {
  defaultLeadInS: number;
  transitionS: number;
  levelUpCleanHoldS: number;
  levelUpRequiredHolds: number;
};

export type DataDocument = {
  version: 1;
  exercises: Record<ID, Exercise>;
  levels: Record<ID, ProgressionLevel>;
  plans: Record<ID, Plan>;
  planDays: Record<ID, PlanDay>;
  planBlocks: Record<ID, PlanBlock>;
  planExercises: Record<ID, PlanExercise>;
  sessionPlanItems: Record<ID, SessionPlanItem>;
  sessions: Record<ID, Session>;
  setEntries: Record<ID, SetEntry>;
  skippedBlocks: Record<ID, SkippedBlock>;
  weeklyReviews: Record<ISODate, WeeklyReview>;
  settings: Settings;
};

export const planBlockLabels: Record<PlanBlockType, string> = {
  straightSets: "Straight sets",
  superset: "Superset",
  circuit: "Circuit",
  timedSequence: "Timed sequence",
};

export const weekdayLabels = [
  "Unscheduled",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
