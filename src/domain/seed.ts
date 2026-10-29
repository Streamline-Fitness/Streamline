import type {
  DataDocument,
  Exercise,
  ID,
  Plan,
  PlanBlock,
  PlanBlockType,
  PlanDay,
  PlanExercise,
  SideMode,
} from "./model";

const now = Date.UTC(2026, 9, 21, 12);

const activeStretchDefinitions = [
  ["exercise_cat_cow", "Cat Cow"],
  ["exercise_wall_calf_pumps", "Wall Calf Pumps"],
  ["exercise_worlds_greatest_stretch", "Alternating Worlds Greatest Stretch"],
  ["exercise_step_back_lunge_reach", "Step-Back Lunge w/ Overhead Reach"],
  ["exercise_squat_to_pike", "Squat-to-Pike"],
  ["exercise_wall_angels", "Wall Angels"],
  ["exercise_arm_circles", "Arm Circles"],
] as const;

const passiveStretchDefinitions = [
  ["exercise_wrist_front", "Wrist Mobility: Front"],
  ["exercise_wrist_out", "Wrist Mobility: Out"],
  ["exercise_wrist_back", "Wrist Mobility: Back"],
  ["exercise_wrist_reverse", "Wrist Mobility: Reverse"],
  ["exercise_butterfly", "Butterfly"],
  ["exercise_seated_straddle_fold", "Seated Straddle Fold"],
  ["exercise_seated_toe_touch", "Seated Toe Touch"],
  ["exercise_child_pose", "Child Pose"],
] as const;

function makeStretchExercises(definitions: readonly (readonly [string, string])[], defaultHoldS: number): Exercise[] {
  return definitions.map(([id, name]) => ({
    id,
    name,
    category: "stretch",
    metric: "seconds",
    source: "system",
    pattern: "mobility",
    defaultHoldS,
    sideMode: "none",
  }));
}

const exercises: Exercise[] = [
  { id: "exercise_pike_pushups", name: "Pike Pushups", category: "strength", metric: "reps", source: "system", pattern: "push", sideMode: "none" },
  { id: "exercise_regular_pullups", name: "Regular Pull-ups", category: "strength", metric: "reps", source: "system", pattern: "pull", sideMode: "none" },
  { id: "exercise_dips", name: "Dips", category: "strength", metric: "reps", source: "system", pattern: "push", sideMode: "none" },
  { id: "exercise_wall_handstand", name: "Wall Handstand", category: "skill", metric: "seconds", source: "system", skillId: "handstand", pattern: "push", leadInS: 3, sideMode: "none" },
  { id: "exercise_parallel_l_sit", name: "Parallel L-Sit", category: "skill", metric: "seconds", source: "system", skillId: "l-sit", pattern: "core", sideMode: "none" },
  { id: "exercise_pseudo_planche_pushups", name: "Pseudo Planche Pushups", category: "strength", metric: "reps", source: "system", pattern: "push", sideMode: "none" },
  { id: "exercise_australian_inverted_rows", name: "Australian Inverted Rows", category: "strength", metric: "reps", source: "system", pattern: "pull", sideMode: "none" },
  { id: "exercise_dead_hang", name: "Dead Hang", category: "skill", metric: "seconds", source: "system", pattern: "pull", sideMode: "none" },
  { id: "exercise_planche_lean", name: "Planche Lean", category: "skill", metric: "seconds", source: "system", skillId: "planche", pattern: "push", sideMode: "none" },
  { id: "exercise_bulgarian_split_squats", name: "Bulgarian Split Squats", category: "strength", metric: "reps", source: "system", pattern: "legs", sideMode: "eachSide" },
  { id: "exercise_hanging_knee_raises", name: "Hanging Knee Raises", category: "strength", metric: "reps", source: "system", pattern: "core", sideMode: "none" },
  { id: "exercise_glute_bridge", name: "Glute Bridge", category: "strength", metric: "reps", source: "system", pattern: "legs", sideMode: "none" },
  { id: "exercise_hollow_body_hold", name: "Hollow Body Hold", category: "skill", metric: "seconds", source: "system", pattern: "core", sideMode: "none" },
  { id: "exercise_lunges", name: "Lunges", category: "strength", metric: "reps", source: "system", pattern: "legs", sideMode: "eachSide" },
  { id: "exercise_side_plank", name: "Side Plank", category: "skill", metric: "seconds", source: "system", pattern: "core", sideMode: "eachSide" },
  { id: "exercise_tucked_front_lever", name: "Tucked Front Lever", category: "skill", metric: "seconds", source: "system", skillId: "front-lever", pattern: "pull", sideMode: "none" },
  ...makeStretchExercises(activeStretchDefinitions, 60),
  ...makeStretchExercises(passiveStretchDefinitions, 30),
];

const demoPlan: Plan = {
  id: "plan_demo_weekly_template",
  name: "Weekly Training Template",
  description: "Commonly tight areas include the hamstrings, hip flexors, upper trapezius, calves, and erector spinae. Do active stretches before workouts and passive stretches before progressions. Take 2-3 minutes between progression exercises on Tuesday and Thursday. Sunday is a rest day with weekly reflection enabled. Session notes are recorded after each workout, and session time is calculated from its start and finish. The prototype does not yet enforce rest between progression blocks.",
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

const planDays: PlanDay[] = [
  { id: "day_demo_monday", planId: demoPlan.id, weekday: 1, name: "Exercise", order: 0 },
  { id: "day_demo_tuesday", planId: demoPlan.id, weekday: 2, name: "Progressions", order: 1 },
  { id: "day_demo_wednesday", planId: demoPlan.id, weekday: 3, name: "Active Exercise", order: 2 },
  { id: "day_demo_thursday", planId: demoPlan.id, weekday: 4, name: "Progressions", order: 3 },
  { id: "day_demo_friday", planId: demoPlan.id, weekday: 5, name: "Active Exercise", order: 4 },
  { id: "day_demo_saturday", planId: demoPlan.id, weekday: 6, name: "Progression Evaluation Day", order: 5 },
  { id: "day_demo_sunday", planId: demoPlan.id, weekday: 7, name: "Rest day", order: 6, isRestDay: true, reflectionEnabled: true },
];

function createBlock(
  id: string,
  dayId: string,
  name: string,
  order: number,
  roundsMin: number,
  roundsMax: number,
  restMinS: number,
  restMaxS: number,
  type: PlanBlockType = "straightSets",
): PlanBlock {
  return { id, dayId, name, type, order, roundsMin, roundsMax, restMinS, restMaxS };
}

const blocks: PlanBlock[] = [
  createBlock("block_mon_active_stretches", "day_demo_monday", "Active Stretches", 0, 1, 1, 0, 0, "timedSequence"),
  createBlock("block_mon_push_pull", "day_demo_monday", "Pike Pushups + Regular Pull-ups", 1, 3, 4, 60, 90, "superset"),
  createBlock("block_mon_dips", "day_demo_monday", "Dips", 2, 1, 2, 45, 60),
  createBlock("block_tue_passive_stretches", "day_demo_tuesday", "Passive Stretches", 0, 1, 1, 0, 0, "timedSequence"),
  createBlock("block_tue_wall_handstand", "day_demo_tuesday", "Wall Handstand", 1, 4, 4, 45, 60),
  createBlock("block_tue_l_sit", "day_demo_tuesday", "Parallel L-Sit", 2, 3, 3, 60, 90),
  createBlock("block_wed_active_stretches", "day_demo_wednesday", "Active Stretches", 0, 1, 1, 0, 0, "timedSequence"),
  createBlock("block_wed_push_pull", "day_demo_wednesday", "Pseudo Planche Pushups + Australian Inverted Rows", 1, 3, 4, 60, 90, "superset"),
  createBlock("block_wed_dead_hang", "day_demo_wednesday", "Dead Hang", 2, 1, 2, 45, 60),
  createBlock("block_thu_passive_stretches", "day_demo_thursday", "Passive Stretches", 0, 1, 1, 0, 0, "timedSequence"),
  createBlock("block_thu_wall_handstand", "day_demo_thursday", "Wall Handstand", 1, 4, 4, 45, 60),
  createBlock("block_thu_planche_lean", "day_demo_thursday", "Planche Lean", 2, 3, 3, 45, 60),
  createBlock("block_fri_active_stretches", "day_demo_friday", "Active Stretches", 0, 1, 1, 0, 0, "timedSequence"),
  createBlock("block_fri_squat_raise", "day_demo_friday", "Bulgarian Split Squats + Hanging Knee Raises", 1, 3, 4, 45, 60, "superset"),
  createBlock("block_fri_bridge_hollow", "day_demo_friday", "Glute Bridge + Hollow Body Hold", 2, 2, 3, 45, 60, "superset"),
  createBlock("block_fri_lunge_plank", "day_demo_friday", "Lunges + Side Plank", 3, 2, 3, 45, 60, "superset"),
  createBlock("block_sat_passive_stretches", "day_demo_saturday", "Passive Stretches", 0, 1, 1, 0, 0, "timedSequence"),
  createBlock("block_sat_wall_handstand", "day_demo_saturday", "Wall Handstand Test", 1, 1, 1, 120, 180),
  createBlock("block_sat_l_sit", "day_demo_saturday", "Parallel L-Sit Test", 2, 1, 1, 120, 180),
  createBlock("block_sat_planche_lean", "day_demo_saturday", "Planche Lean Test", 3, 1, 1, 120, 180),
  createBlock("block_sat_front_lever", "day_demo_saturday", "Tucked Front Lever Test", 4, 1, 1, 120, 180),
];

type ExerciseTarget = Omit<PlanExercise, "id" | "blockId" | "order">;

function assignExercises(blockId: string, targets: ExerciseTarget[]): PlanExercise[] {
  return targets.map((target, order) => ({ id: `${blockId}_exercise_${order + 1}`, blockId, order, ...target }));
}

const activeStretchTargets: ExerciseTarget[] = activeStretchDefinitions.map(([exerciseId]) => ({ exerciseId, secondsMin: 60, secondsMax: 60, sideMode: "none" }));
const wristStretchTargets: ExerciseTarget[] = passiveStretchDefinitions.slice(0, 4).map(([exerciseId]) => ({ exerciseId, secondsMin: 30, secondsMax: 30, sideMode: "none" }));
const legStretchTargets: ExerciseTarget[] = passiveStretchDefinitions.slice(4, 7).map(([exerciseId]) => ({ exerciseId, secondsMin: 30, secondsMax: 30, sideMode: "none" }));
const shoulderStretchTargets: ExerciseTarget[] = [{ exerciseId: "exercise_child_pose", secondsMin: 30, secondsMax: 30, sideMode: "none" }];

const planExercises: PlanExercise[] = [
  ...assignExercises("block_mon_active_stretches", activeStretchTargets),
  ...assignExercises("block_mon_push_pull", [
    { exerciseId: "exercise_pike_pushups", repsMin: 8, repsMax: 12, sideMode: "none" },
    { exerciseId: "exercise_regular_pullups", repsMin: 8, repsMax: 12, sideMode: "none" },
  ]),
  ...assignExercises("block_mon_dips", [{ exerciseId: "exercise_dips", repsMin: 8, repsMax: 12, sideMode: "none" }]),
  ...assignExercises("block_tue_passive_stretches", [...wristStretchTargets, ...legStretchTargets, ...shoulderStretchTargets]),
  ...assignExercises("block_tue_wall_handstand", [{ exerciseId: "exercise_wall_handstand", secondsMin: 15, secondsMax: 20, sideMode: "none" }]),
  ...assignExercises("block_tue_l_sit", [{ exerciseId: "exercise_parallel_l_sit", secondsMin: 10, secondsMax: 15, sideMode: "none" }]),
  ...assignExercises("block_wed_active_stretches", activeStretchTargets),
  ...assignExercises("block_wed_push_pull", [
    { exerciseId: "exercise_pseudo_planche_pushups", repsMin: 8, repsMax: 12, sideMode: "none" },
    { exerciseId: "exercise_australian_inverted_rows", repsMin: 8, repsMax: 12, sideMode: "none" },
  ]),
  ...assignExercises("block_wed_dead_hang", [{ exerciseId: "exercise_dead_hang", sideMode: "none" }]),
  ...assignExercises("block_thu_passive_stretches", [...wristStretchTargets, ...legStretchTargets, ...shoulderStretchTargets]),
  ...assignExercises("block_thu_wall_handstand", [{ exerciseId: "exercise_wall_handstand", secondsMin: 15, secondsMax: 20, sideMode: "none" }]),
  ...assignExercises("block_thu_planche_lean", [{ exerciseId: "exercise_planche_lean", secondsMin: 10, secondsMax: 15, sideMode: "none" }]),
  ...assignExercises("block_fri_active_stretches", activeStretchTargets),
  ...assignExercises("block_fri_squat_raise", [
    { exerciseId: "exercise_bulgarian_split_squats", repsMin: 8, repsMax: 12, sideMode: "eachSide" },
    { exerciseId: "exercise_hanging_knee_raises", repsMin: 10, repsMax: 15, sideMode: "none" },
  ]),
  ...assignExercises("block_fri_bridge_hollow", [
    { exerciseId: "exercise_glute_bridge", repsMin: 10, repsMax: 15, sideMode: "none" },
    { exerciseId: "exercise_hollow_body_hold", secondsMin: 20, secondsMax: 40, sideMode: "none" },
  ]),
  ...assignExercises("block_fri_lunge_plank", [
    { exerciseId: "exercise_lunges", repsMin: 10, repsMax: 10, sideMode: "eachSide" },
    { exerciseId: "exercise_side_plank", secondsMin: 20, secondsMax: 30, sideMode: "eachSide" },
  ]),
  ...assignExercises("block_sat_passive_stretches", [...wristStretchTargets, ...legStretchTargets, ...shoulderStretchTargets]),
  ...assignExercises("block_sat_wall_handstand", [{ exerciseId: "exercise_wall_handstand", sideMode: "none" }]),
  ...assignExercises("block_sat_l_sit", [{ exerciseId: "exercise_parallel_l_sit", sideMode: "none" }]),
  ...assignExercises("block_sat_planche_lean", [{ exerciseId: "exercise_planche_lean", sideMode: "none" }]),
  ...assignExercises("block_sat_front_lever", [{ exerciseId: "exercise_tucked_front_lever", sideMode: "none" }]),
];

function asRecord<T extends { id: ID }>(items: T[]): Record<ID, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export function createSeedData(): DataDocument {
  return {
    version: 1,
    exercises: asRecord(exercises),
    levels: {},
    plans: asRecord([demoPlan]),
    planDays: asRecord(planDays),
    planBlocks: asRecord(blocks),
    planExercises: asRecord(planExercises),
    sessionPlanItems: {},
    sessions: {},
    setEntries: {},
    skippedBlocks: {},
    weeklyReviews: {},
    settings: {
      defaultLeadInS: 3,
      transitionS: 5,
      levelUpCleanHoldS: 15,
      levelUpRequiredHolds: 3,
    },
  };
}

export function cloneData(data: DataDocument): DataDocument {
  return structuredClone(data);
}
