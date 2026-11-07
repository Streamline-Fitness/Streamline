import { describe, expect, it } from "vitest";
import { expandSessionPlan, getScheduledDayForDate, todayISO, weekdayFromISO } from "../domain/plan";
import { createSeedData } from "../domain/seed";
import { createImportedPlan, createSharedWorkoutPlanContent, isPlanEligibleForSharing } from "../domain/sharedPlans";
import { createInitialState } from "./appState";
import { reducer } from "./reducer";

describe("app reducer", () => {
  it("starts a session with an immutable plan snapshot", () => {
    const data = createSeedData();
    const state = createInitialState(data);
    const now = Date.now();
    const date = todayISO(now);
    const planId = "plan_demo_weekly_template";
    const day = getScheduledDayForDate(data, planId, date);

    if (!day) throw new Error("Seed plan should have a day scheduled for every weekday.");

    const next = reducer(state, {
      type: "START_SESSION",
      sessionId: "session-new",
      date,
      planId,
      planDayId: day.id,
      now,
    });

    expect(next.activeSessionId).toBe("session-new");
    expect(Object.values(next.data.sessionPlanItems).length).toBeGreaterThan(0);
    expect(state.data.sessions["session-new"]).toBeUndefined();
    expect(state.data.sessionPlanItems).toEqual({});
  });

  it("adds a copied shared plan as an independent, inactive plan", () => {
    const data = createSeedData();
    const shared = createSharedWorkoutPlanContent(data, "plan_demo_weekly_template");
    let id = 0;
    const importedPlan = createImportedPlan(shared, (prefix) => `${prefix}_import_${++id}`, 4567);
    const state = createInitialState(data);

    const next = reducer(state, { type: "IMPORT_SHARED_PLAN", importedPlan });

    expect(next.data.plans[importedPlan.plan.id]).toMatchObject({ name: shared.name, isActive: false, createdAt: 4567 });
    expect(next.data.plans["plan_demo_weekly_template"]).toEqual(data.plans["plan_demo_weekly_template"]);
    expect(Object.values(next.data.planDays).filter((day) => day.planId === importedPlan.plan.id)).toHaveLength(shared.days.length);
    expect(Object.values(next.data.sessions)).toEqual(Object.values(data.sessions));
    expect(next.route).toBe("plans");
    expect(state.data.plans[importedPlan.plan.id]).toBeUndefined();
  });

  it("requires a real plan edit before a starter or copied plan can be shared", () => {
    const data = createSeedData();
    const shared = createSharedWorkoutPlanContent(data, "plan_demo_weekly_template");
    let id = 0;
    const importedPlan = createImportedPlan(shared, (prefix) => `${prefix}_import_${++id}`, 4567);
    data.plans[importedPlan.plan.id] = importedPlan.plan;
    for (const day of importedPlan.days) data.planDays[day.id] = day;
    const state = createInitialState(data);

    expect(isPlanEligibleForSharing(state.data.plans["plan_demo_weekly_template"])).toBe(false);
    expect(isPlanEligibleForSharing(state.data.plans[importedPlan.plan.id])).toBe(false);

    const editedStarter = reducer(state, {
      type: "UPDATE_PLAN",
      planId: "plan_demo_weekly_template",
      name: "My Weekly Plan",
      description: state.data.plans["plan_demo_weekly_template"].description ?? "",
      now: 9999,
    });
    const editedCopy = reducer(state, {
      type: "ADD_PLAN_DAY",
      planId: importedPlan.plan.id,
      dayId: "extra-day",
      name: "Extra day",
    });

    expect(isPlanEligibleForSharing(editedStarter.data.plans["plan_demo_weekly_template"])).toBe(true);
    expect(isPlanEligibleForSharing(editedCopy.data.plans[importedPlan.plan.id])).toBe(true);
    expect(isPlanEligibleForSharing(state.data.plans["plan_demo_weekly_template"])).toBe(false);
    expect(editedCopy.data.plans[importedPlan.plan.id]).toMatchObject({ shareOrigin: "copy", hasBeenEdited: true });
  });

  it("recognizes starter plans in existing documents that predate share-origin metadata", () => {
    const data = createSeedData();
    delete data.plans["plan_demo_weekly_template"].shareOrigin;
    const state = createInitialState(data);

    const next = reducer(state, { type: "HYDRATE", data: state.data });

    expect(next.data.plans["plan_demo_weekly_template"].shareOrigin).toBe("starter");
    expect(isPlanEligibleForSharing(next.data.plans["plan_demo_weekly_template"])).toBe(false);
  });

  it("counts editing an exercise used by a starter or copied plan as a plan edit", () => {
    const data = createSeedData();
    const shared = createSharedWorkoutPlanContent(data, "plan_demo_weekly_template");
    let id = 0;
    const importedPlan = createImportedPlan(shared, (prefix) => `${prefix}_import_${++id}`, 4567);
    data.plans[importedPlan.plan.id] = importedPlan.plan;
    for (const day of importedPlan.days) data.planDays[day.id] = day;
    for (const block of importedPlan.blocks) data.planBlocks[block.id] = block;
    for (const item of importedPlan.planExercises) data.planExercises[item.id] = item;
    for (const exercise of importedPlan.exercises) data.exercises[exercise.id] = exercise;
    const state = createInitialState(data);
    const exercise = importedPlan.exercises[0];
    if (!exercise) throw new Error("The shared plan should include an exercise.");

    const next = reducer(state, {
      type: "UPDATE_EXERCISE",
      exerciseId: exercise.id,
      name: `${exercise.name} variation`,
      category: exercise.category,
      metric: exercise.metric,
      pattern: exercise.pattern,
      skillId: exercise.skillId,
      leadInS: exercise.leadInS,
      defaultHoldS: exercise.defaultHoldS,
      sideMode: exercise.sideMode,
    });

    expect(isPlanEligibleForSharing(next.data.plans[importedPlan.plan.id])).toBe(true);
    expect(next.data.plans["plan_demo_weekly_template"].hasBeenEdited).toBeUndefined();
  });

  it("rejects a shared-plan copy with IDs that collide with existing records", () => {
    const data = createSeedData();
    const shared = createSharedWorkoutPlanContent(data, "plan_demo_weekly_template");
    let id = 0;
    const importedPlan = createImportedPlan(shared, (prefix) => prefix === "day" ? "day_demo_monday" : `${prefix}_copy_${++id}`, 4567);
    const state = createInitialState(data);

    const next = reducer(state, { type: "IMPORT_SHARED_PLAN", importedPlan });

    expect(next.data.plans[importedPlan.plan.id]).toBeUndefined();
    expect(next.error).toContain("one of its IDs already exists");
    expect(state.data.plans[importedPlan.plan.id]).toBeUndefined();
  });

  it("deletes plan structure, switches the active plan, and preserves completed history snapshots", () => {
    const data = createSeedData();
    const planId = "plan_demo_weekly_template";
    const now = Date.now();
    const date = todayISO(now);
    const replacementPlanId = "plan_replacement";
    const replacementDayId = "day_replacement";
    data.plans[replacementPlanId] = {
      id: replacementPlanId,
      name: "Replacement plan",
      isActive: false,
      createdAt: now,
      updatedAt: now,
    };
    data.planDays[replacementDayId] = {
      id: replacementDayId,
      planId: replacementPlanId,
      name: "Today",
      weekday: weekdayFromISO(date),
      order: 0,
    };
    data.sessions["session-history"] = {
      id: "session-history",
      date,
      weekday: weekdayFromISO(date),
      planId,
      planDayId: "day_demo_monday",
      finishedAt: now,
      note: "Keep this history",
    };
    const snapshots = expandSessionPlan(data, "session-history", "day_demo_monday");
    for (const snapshot of snapshots) data.sessionPlanItems[snapshot.id] = snapshot;
    const originalExerciseIds = Object.keys(data.exercises);
    const state = { ...createInitialState(data), route: "plan-editor" as const, editorPlanId: planId };

    const next = reducer(state, { type: "DELETE_PLAN", planId });

    expect(next.data.plans[planId]).toBeUndefined();
    expect(next.data.plans[replacementPlanId]?.isActive).toBe(true);
    expect(next.selectedPlanId).toBe(replacementPlanId);
    expect(next.selectedPlanDayId).toBe(replacementDayId);
    expect(next.editorPlanId).toBe(replacementPlanId);
    expect(next.route).toBe("plans");
    expect(next.data.planDays).toEqual({ [replacementDayId]: data.planDays[replacementDayId] });
    expect(next.data.planBlocks).toEqual({});
    expect(next.data.planExercises).toEqual({});
    expect(Object.keys(next.data.exercises)).toEqual(originalExerciseIds);
    expect(next.data.sessions["session-history"]).toEqual(data.sessions["session-history"]);
    expect(next.data.sessionPlanItems).toEqual(data.sessionPlanItems);
  });

  it("rejects sessions started for a date other than today", () => {
    const state = createInitialState();
    const now = Date.now();
    const next = reducer(state, {
      type: "START_SESSION",
      sessionId: "session-old",
      date: "2000-01-01",
      planId: "plan_demo_weekly_template",
      planDayId: "day_demo_monday",
      now,
    });

    expect(next.data.sessions["session-old"]).toBeUndefined();
    expect(next.error).toContain("only be started for today");
  });

  it("requires a valid journal category and non-empty text before saving", () => {
    const state = createInitialState();
    const next = reducer(state, {
      type: "SAVE_JOURNAL_ENTRY",
      entryId: "entry-invalid",
      date: todayISO(),
      text: "   ",
      categoryId: "category-missing",
      updatedAt: Date.now(),
    });

    expect(next.data.journalEntries["entry-invalid"]).toBeUndefined();
    expect(next.error).toBe("Choose a journal category before saving.");
  });

  it("keeps journal text when deleting its category", () => {
    let state = createInitialState();
    state = reducer(state, { type: "ADD_JOURNAL_CATEGORY", categoryId: "category-notes", name: " Notes " });
    state = reducer(state, {
      type: "SAVE_JOURNAL_ENTRY",
      entryId: "entry-notes",
      date: todayISO(),
      text: "Workout felt strong.",
      categoryId: "category-notes",
      updatedAt: Date.now(),
    });

    const next = reducer(state, { type: "DELETE_JOURNAL_CATEGORY", categoryId: "category-notes" });

    expect(next.data.journalCategories["category-notes"]).toBeUndefined();
    expect(next.data.journalEntries["entry-notes"]).toMatchObject({ text: "Workout felt strong." });
    expect(next.data.journalEntries["entry-notes"].categoryId).toBeUndefined();
  });

  it("rejects duplicate journal category names without case sensitivity", () => {
    let state = createInitialState();
    state = reducer(state, { type: "ADD_JOURNAL_CATEGORY", categoryId: "category-one", name: "Training" });

    const next = reducer(state, { type: "ADD_JOURNAL_CATEGORY", categoryId: "category-two", name: "training" });

    expect(next.data.journalCategories["category-two"]).toBeUndefined();
    expect(next.error).toBe("That journal category already exists.");
  });
});
