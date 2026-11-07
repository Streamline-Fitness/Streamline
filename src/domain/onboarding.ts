import type { DataDocument, Exercise, PlanBlock, PlanDay, PlanExercise, Plan } from "./model";
import { createSeedData } from "./seed";

export type TrainingExperience = "beginner" | "intermediate" | "advanced";

type WorkoutExercise = Pick<PlanExercise, "exerciseId" | "repsMin" | "repsMax" | "secondsMin" | "secondsMax" | "sideMode">;
type WorkoutDay = { weekday: number; name: string; exercises: WorkoutExercise[] };
type StarterTemplate = {
  name: string;
  description: string;
  roundsMin: number;
  roundsMax: number;
  restMinS: number;
  restMaxS: number;
  days: WorkoutDay[];
};

const exercises: Exercise[] = [
  { id: "exercise_chair_squat", name: "Chair Squat", category: "strength", metric: "reps", source: "system", pattern: "legs", sideMode: "none" },
  { id: "exercise_bodyweight_squat", name: "Bodyweight Squat", category: "strength", metric: "reps", source: "system", pattern: "legs", sideMode: "none" },
  { id: "exercise_reverse_lunge", name: "Reverse Lunge", category: "strength", metric: "reps", source: "system", pattern: "legs", sideMode: "eachSide" },
  { id: "exercise_incline_pushup", name: "Incline Push-up", category: "strength", metric: "reps", source: "system", pattern: "push", sideMode: "none" },
  { id: "exercise_pushups", name: "Push-up", category: "strength", metric: "reps", source: "system", pattern: "push", sideMode: "none" },
  { id: "exercise_dead_bug", name: "Dead Bug", category: "strength", metric: "reps", source: "system", pattern: "core", sideMode: "eachSide" },
  { id: "exercise_bird_dog", name: "Bird Dog", category: "strength", metric: "reps", source: "system", pattern: "core", sideMode: "eachSide" },
  { id: "exercise_backpack_row", name: "Backpack Row", category: "strength", metric: "reps", source: "system", pattern: "pull", sideMode: "none" },
];

const rep = (exerciseId: string, repsMin: number, repsMax: number, sideMode: WorkoutExercise["sideMode"] = "none"): WorkoutExercise => ({
  exerciseId,
  repsMin,
  repsMax,
  sideMode,
});

const hold = (exerciseId: string, secondsMin: number, secondsMax: number, sideMode: WorkoutExercise["sideMode"] = "none"): WorkoutExercise => ({
  exerciseId,
  secondsMin,
  secondsMax,
  sideMode,
});

const templates: Record<TrainingExperience, StarterTemplate> = {
  beginner: {
    name: "Beginner Full-Body Plan",
    description: "A two-day bodyweight starting plan with manageable volume. Use a sturdy elevated surface for incline push-ups. Choose a version you can do with comfortable, controlled form; edit exercises and training days any time.",
    roundsMin: 2,
    roundsMax: 2,
    restMinS: 60,
    restMaxS: 90,
    days: [
      { weekday: 1, name: "Full Body A", exercises: [rep("exercise_chair_squat", 8, 10), rep("exercise_incline_pushup", 6, 10), rep("exercise_glute_bridge", 8, 12), rep("exercise_dead_bug", 6, 8, "eachSide")] },
      { weekday: 4, name: "Full Body B", exercises: [rep("exercise_reverse_lunge", 6, 8, "eachSide"), rep("exercise_incline_pushup", 6, 10), rep("exercise_bird_dog", 6, 8, "eachSide"), rep("exercise_glute_bridge", 8, 12)] },
    ],
  },
  intermediate: {
    name: "Intermediate Full-Body Plan",
    description: "A three-day bodyweight strength plan with moderate volume. Backpack rows use a securely closed backpack with a comfortable load. Keep a few good-form reps in reserve and adjust targets in Plans.",
    roundsMin: 3,
    roundsMax: 3,
    restMinS: 60,
    restMaxS: 90,
    days: [
      { weekday: 1, name: "Full Body A", exercises: [rep("exercise_bodyweight_squat", 8, 12), rep("exercise_pushups", 6, 12), rep("exercise_backpack_row", 8, 12), rep("exercise_dead_bug", 8, 10, "eachSide")] },
      { weekday: 3, name: "Full Body B", exercises: [rep("exercise_reverse_lunge", 8, 10, "eachSide"), rep("exercise_incline_pushup", 8, 12), rep("exercise_backpack_row", 8, 12), hold("exercise_hollow_body_hold", 15, 25)] },
      { weekday: 5, name: "Full Body A", exercises: [rep("exercise_bodyweight_squat", 8, 12), rep("exercise_pushups", 6, 12), rep("exercise_backpack_row", 8, 12), rep("exercise_bird_dog", 8, 10, "eachSide")] },
    ],
  },
  advanced: {
    name: "Advanced Bodyweight Plan",
    description: "A four-day upper/lower split with more weekly volume and advanced bodyweight variations. Pull-ups and dips require appropriate equipment; swap any movement that does not suit your setup in Plans.",
    roundsMin: 3,
    roundsMax: 4,
    restMinS: 90,
    restMaxS: 120,
    days: [
      { weekday: 1, name: "Upper A", exercises: [rep("exercise_pike_pushups", 6, 10), rep("exercise_regular_pullups", 4, 8), rep("exercise_dips", 6, 10), hold("exercise_hollow_body_hold", 20, 40)] },
      { weekday: 2, name: "Lower A", exercises: [rep("exercise_bulgarian_split_squats", 8, 12, "eachSide"), rep("exercise_hanging_knee_raises", 8, 12), rep("exercise_glute_bridge", 12, 15)] },
      { weekday: 4, name: "Upper B", exercises: [rep("exercise_pseudo_planche_pushups", 6, 10), rep("exercise_australian_inverted_rows", 8, 12), hold("exercise_dead_hang", 20, 40), hold("exercise_side_plank", 20, 35, "eachSide")] },
      { weekday: 6, name: "Lower B", exercises: [rep("exercise_lunges", 10, 12, "eachSide"), rep("exercise_bulgarian_split_squats", 8, 12, "eachSide"), rep("exercise_hanging_knee_raises", 8, 12), hold("exercise_hollow_body_hold", 20, 40)] },
    ],
  },
};

export function createOnboardingPlans(experience: TrainingExperience, now = Date.now()): DataDocument {
  if (!Object.hasOwn(templates, experience)) throw new Error("Choose a training experience level to create your plan.");

  const data = createSeedData();
  for (const exercise of exercises) data.exercises[exercise.id] = exercise;

  data.plans = {};
  data.planDays = {};
  data.planBlocks = {};
  data.planExercises = {};

  for (const [level, template] of Object.entries(templates) as [TrainingExperience, StarterTemplate][]) {
    const planId = `plan_onboarding_${level}`;
    const plan: Plan = {
      id: planId,
      name: template.name,
      description: template.description,
      isActive: level === experience,
      createdAt: now,
      updatedAt: now,
    };
    data.plans[planId] = plan;

    template.days.forEach((workout, dayIndex) => {
      const dayId = `${planId}_day_${dayIndex + 1}`;
      const blockId = `${planId}_block_${dayIndex + 1}`;
      const day: PlanDay = { id: dayId, planId, weekday: workout.weekday, name: workout.name, order: dayIndex };
      const block: PlanBlock = {
        id: blockId,
        dayId,
        name: workout.name,
        type: "straightSets",
        order: 0,
        roundsMin: template.roundsMin,
        roundsMax: template.roundsMax,
        restMinS: template.restMinS,
        restMaxS: template.restMaxS,
      };
      data.planDays[dayId] = day;
      data.planBlocks[blockId] = block;
      workout.exercises.forEach((target, exerciseIndex) => {
        const planExercise: PlanExercise = {
          id: `${blockId}_exercise_${exerciseIndex + 1}`,
          blockId,
          order: exerciseIndex,
          ...target,
        };
        data.planExercises[planExercise.id] = planExercise;
      });
    });
  }

  return data;
}
