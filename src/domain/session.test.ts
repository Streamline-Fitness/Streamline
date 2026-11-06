import { describe, expect, it } from "vitest";
import type { DataDocument, Session, SessionPlanItem, SetEntry } from "./model";
import { createSeedData } from "./seed";
import { currentGuidedPlanExercise, sessionDurationMinutes, sessionStatus } from "./session";

function dataWithSession(): { data: DataDocument; session: Session; items: SessionPlanItem[] } {
  const data = createSeedData();
  const session: Session = {
    id: "session-test",
    date: "2026-11-02",
    weekday: 1,
    note: "",
  };
  const items: SessionPlanItem[] = [
    {
      id: "item-first",
      sessionId: session.id,
      blockId: "block-test",
      planExerciseId: "plan-exercise-first",
      blockOrder: 0,
      exerciseOrder: 0,
      blockName: "Pair",
      blockType: "superset",
      roundsMin: 1,
      roundsMax: 2,
      restMinS: 30,
      restMaxS: 30,
      exerciseId: "exercise_pike_pushups",
      exerciseName: "Pike Pushups",
      repsMin: 8,
      repsMax: 12,
      sideMode: "none",
    },
    {
      id: "item-second",
      sessionId: session.id,
      blockId: "block-test",
      planExerciseId: "plan-exercise-second",
      blockOrder: 0,
      exerciseOrder: 1,
      blockName: "Pair",
      blockType: "superset",
      roundsMin: 1,
      roundsMax: 2,
      restMinS: 30,
      restMaxS: 30,
      exerciseId: "exercise_regular_pullups",
      exerciseName: "Regular Pull-ups",
      repsMin: 8,
      repsMax: 12,
      sideMode: "none",
    },
  ];
  data.sessions[session.id] = session;
  for (const item of items) data.sessionPlanItems[item.id] = item;
  return { data, session, items };
}

function addEntry(data: DataDocument, id: string, planExerciseId: string): void {
  const entry: SetEntry = {
    id,
    sessionId: "session-test",
    planExerciseId,
    exerciseId: planExerciseId === "plan-exercise-first" ? "exercise_pike_pushups" : "exercise_regular_pullups",
    setNo: 1,
    reps: 10,
    edited: false,
  };
  data.setEntries[id] = entry;
}

describe("session rules", () => {
  it("reports done only after each planned exercise has an entry", () => {
    const { data, session } = dataWithSession();

    expect(sessionStatus(data, session)).toBe("partial");
    addEntry(data, "entry-first", "plan-exercise-first");
    expect(sessionStatus(data, session)).toBe("partial");
    addEntry(data, "entry-second", "plan-exercise-second");
    expect(sessionStatus(data, session)).toBe("done");
  });

  it("reports a skipped session when no sets were recorded and a skip reason exists", () => {
    const { data, session } = dataWithSession();
    session.skipReason = "Rest day";

    expect(sessionStatus(data, session)).toBe("skipped");
  });

  it("rounds session duration up to a whole minute", () => {
    const { session } = dataWithSession();
    session.startedAt = 1_000;
    session.finishedAt = 61_001;

    expect(sessionDurationMinutes(session)).toBe(2);
  });

  it("guides a superset round-robin and stops after the planned rounds", () => {
    const { data, session, items } = dataWithSession();

    expect(currentGuidedPlanExercise(data, session.id)).toBe(items[0].planExerciseId);
    addEntry(data, "entry-first-1", items[0].planExerciseId);
    expect(currentGuidedPlanExercise(data, session.id)).toBe(items[1].planExerciseId);
    addEntry(data, "entry-second-1", items[1].planExerciseId);
    expect(currentGuidedPlanExercise(data, session.id)).toBe(items[0].planExerciseId);
    addEntry(data, "entry-first-2", items[0].planExerciseId);
    expect(currentGuidedPlanExercise(data, session.id)).toBe(items[1].planExerciseId);
    addEntry(data, "entry-second-2", items[1].planExerciseId);
    expect(currentGuidedPlanExercise(data, session.id)).toBeUndefined();
  });
});
