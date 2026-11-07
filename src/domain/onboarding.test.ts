import { describe, expect, it } from "vitest";
import { createOnboardingPlans } from "./onboarding";

function exerciseIdsForPlan(data: ReturnType<typeof createOnboardingPlans>, level: "beginner" | "intermediate" | "advanced") {
  const planId = `plan_onboarding_${level}`;
  const dayIds = new Set(Object.values(data.planDays).filter((day) => day.planId === planId).map((day) => day.id));
  const blockIds = new Set(Object.values(data.planBlocks).filter((block) => dayIds.has(block.dayId)).map((block) => block.id));
  return new Set(Object.values(data.planExercises).filter((exercise) => blockIds.has(exercise.blockId)).map((exercise) => exercise.exerciseId));
}

describe("onboarding plan generation", () => {
  it.each([
    ["beginner", "Beginner Full-Body Plan", 2, 2],
    ["intermediate", "Intermediate Full-Body Plan", 3, 3],
    ["advanced", "Advanced Bodyweight Plan", 4, 3],
  ] as const)("creates all starter plans and activates %s with level-appropriate weekly volume", (experience, name, dayCount, rounds) => {
    const data = createOnboardingPlans(experience, 123);
    const plan = Object.values(data.plans).find((candidate) => candidate.isActive);
    const days = Object.values(data.planDays).filter((day) => day.planId === plan?.id);
    const dayIds = new Set(days.map((day) => day.id));
    const blocks = Object.values(data.planBlocks).filter((block) => dayIds.has(block.dayId));

    expect(plan).toMatchObject({ name, isActive: true, createdAt: 123 });
    expect(days).toHaveLength(dayCount);
    expect(blocks).toHaveLength(dayCount);
    expect(blocks.every((block) => block.roundsMin === rounds)).toBe(true);
    expect(Object.values(data.planExercises).length).toBeGreaterThan(dayCount * 2);
    expect(Object.values(data.plans)).toHaveLength(3);
    expect(Object.values(data.plans).filter((candidate) => candidate.isActive)).toHaveLength(1);
  });

  it("uses easier movements and lower volume for beginners than for advanced trainees", () => {
    const beginner = createOnboardingPlans("beginner");
    const advanced = createOnboardingPlans("advanced");
    const beginnerExerciseIds = exerciseIdsForPlan(beginner, "beginner");
    const advancedExerciseIds = exerciseIdsForPlan(advanced, "advanced");

    expect(beginnerExerciseIds).toContain("exercise_incline_pushup");
    expect(beginnerExerciseIds).toContain("exercise_chair_squat");
    expect(beginnerExerciseIds).not.toContain("exercise_regular_pullups");
    expect(advancedExerciseIds).toContain("exercise_regular_pullups");
    expect(advancedExerciseIds).toContain("exercise_bulgarian_split_squats");
    const beginnerBlock = Object.values(beginner.planBlocks).find((block) => block.dayId.startsWith("plan_onboarding_beginner_"));
    const advancedBlock = Object.values(advanced.planBlocks).find((block) => block.dayId.startsWith("plan_onboarding_advanced_"));
    expect(beginnerBlock?.roundsMax).toBeLessThan(advancedBlock?.roundsMax ?? 0);
  });

  it("preserves the shared exercise library while replacing the generic demo plan", () => {
    const data = createOnboardingPlans("beginner");

    expect(data.exercises.exercise_pike_pushups).toBeDefined();
    expect(data.plans.plan_demo_weekly_template).toBeUndefined();
    expect(Object.values(data.plans).map((plan) => plan.name)).toEqual([
      "Beginner Full-Body Plan",
      "Intermediate Full-Body Plan",
      "Advanced Bodyweight Plan",
    ]);
    expect(Object.values(data.sessions)).toHaveLength(0);
  });

  it.each(["beginner", "intermediate", "advanced"] as const)("creates valid exercise references and matching target metrics for %s", (experience) => {
    const data = createOnboardingPlans(experience);

    for (const planExercise of Object.values(data.planExercises)) {
      const exercise = data.exercises[planExercise.exerciseId];
      expect(exercise).toBeDefined();
      expect(exercise.metric === "reps" ? planExercise.repsMin : planExercise.secondsMin).toBeDefined();
    }
  });
});
