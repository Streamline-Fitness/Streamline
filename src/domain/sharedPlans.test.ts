import { describe, expect, it } from "vitest";
import { createImportedPlan, createSharedWorkoutPlanContent, isPlanEligibleForSharing, parseSharedWorkoutPlanContent } from "./sharedPlans";
import { createSeedData } from "./seed";

describe("shared workout plans", () => {
  it("shares only the selected plan structure and exercises, never account history", () => {
    const data = createSeedData();
    const shared = createSharedWorkoutPlanContent(data, "plan_demo_weekly_template");

    expect(shared.days.length).toBeGreaterThan(0);
    expect(shared.planExercises.length).toBeGreaterThan(0);
    expect(shared.exercises.every((exercise) => Object.values(data.planExercises)
      .some((item) => item.exerciseId === exercise.id && shared.blocks.some((block) => block.id === item.blockId)))).toBe(true);
    expect(shared).not.toHaveProperty("sessions");
    expect(shared).not.toHaveProperty("setEntries");
    expect(shared).not.toHaveProperty("journalEntries");
    expect(shared.days.every((day) => !("planId" in day))).toBe(true);
  });

  it("validates public references and remaps all IDs when copying a plan", () => {
    const shared = createSharedWorkoutPlanContent(createSeedData(), "plan_demo_weekly_template");
    const parsed = parseSharedWorkoutPlanContent(shared);
    let id = 0;
    const imported = createImportedPlan(parsed, (prefix) => `${prefix}_copy_${++id}`, 1234);

    expect(imported.plan).toMatchObject({ name: shared.name, isActive: false, createdAt: 1234, shareOrigin: "copy", hasBeenEdited: false });
    expect(imported.days.every((day) => day.planId === imported.plan.id)).toBe(true);
    expect(imported.blocks.every((block) => imported.days.some((day) => day.id === block.dayId))).toBe(true);
    expect(imported.planExercises.every((item) => imported.blocks.some((block) => block.id === item.blockId))).toBe(true);
    expect(imported.planExercises.every((item) => imported.exercises.some((exercise) => exercise.id === item.exerciseId))).toBe(true);
    expect(imported.exercises.every((exercise) => exercise.source === "user")).toBe(true);
    expect(imported.plan.id).not.toBe(shared.days[0]?.id);
  });

  it("allows sharing user-authored plans, but requires editing starter and copied plans", () => {
    expect(isPlanEligibleForSharing({})).toBe(true);
    expect(isPlanEligibleForSharing({ shareOrigin: "starter" })).toBe(false);
    expect(isPlanEligibleForSharing({ shareOrigin: "copy", hasBeenEdited: false })).toBe(false);
    expect(isPlanEligibleForSharing({ shareOrigin: "starter", hasBeenEdited: true })).toBe(true);
    expect(isPlanEligibleForSharing({ shareOrigin: "copy", hasBeenEdited: true })).toBe(true);
  });

  it("rejects malformed or dangling public plan references", () => {
    expect(() => parseSharedWorkoutPlanContent({ name: "Broken", days: [], blocks: [], planExercises: [], exercises: [{}] }))
      .toThrow("invalid exercise");
    expect(() => parseSharedWorkoutPlanContent({
      name: "Broken",
      days: [],
      blocks: [{
        id: "block",
        dayId: "missing",
        name: "Block",
        type: "circuit",
        order: 0,
        roundsMin: 1,
        roundsMax: 1,
        restMinS: 0,
        restMaxS: 0,
      }],
      planExercises: [],
      exercises: [],
    })).toThrow("without a training day");
  });

  it("rejects invalid target ranges instead of copying corrupt public data", () => {
    expect(() => parseSharedWorkoutPlanContent({
      name: "Broken",
      days: [{ id: "day", name: "Day", order: 0 }],
      blocks: [{
        id: "block",
        dayId: "day",
        name: "Block",
        type: "circuit",
        order: 0,
        roundsMin: 3,
        roundsMax: 1,
        restMinS: 0,
        restMaxS: 0,
      }],
      planExercises: [],
      exercises: [],
    })).toThrow("invalid block range");
  });
});
