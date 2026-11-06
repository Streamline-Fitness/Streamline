import { describe, expect, it } from "vitest";
import { getScheduledDayForDate, todayISO } from "../domain/plan";
import { createSeedData } from "../domain/seed";
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
