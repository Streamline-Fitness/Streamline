import { describe, expect, it } from "vitest";
import { expandSessionPlan, formatTarget, getScheduledDayForDate, weekdayFromISO } from "./plan";
import { createSeedData } from "./seed";

describe("plan rules", () => {
  it("uses ISO weekdays with Monday as 1 and Sunday as 7", () => {
    expect(weekdayFromISO("2026-11-02")).toBe(1);
    expect(weekdayFromISO("2026-11-08")).toBe(7);
  });

  it("selects the scheduled day for a date and respects a preferred matching day", () => {
    const data = createSeedData();

    expect(getScheduledDayForDate(data, "plan_demo_weekly_template", "2026-11-02")?.id).toBe("day_demo_monday");
    expect(getScheduledDayForDate(data, "plan_demo_weekly_template", "2026-11-02", "day_demo_tuesday")?.id).toBe("day_demo_monday");
  });

  it("expands blocks and exercises in order into a session snapshot", () => {
    const data = createSeedData();
    const items = expandSessionPlan(data, "session-test", "day_demo_monday");

    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toMatchObject({
      sessionId: "session-test",
      blockId: "block_mon_active_stretches",
      blockOrder: 0,
      exerciseOrder: 0,
      exerciseName: "Cat Cow",
    });
    expect(items.every((item) => item.id === `session-test_${item.planExerciseId}`)).toBe(true);
  });

  it("formats equal and ranged targets consistently", () => {
    expect(formatTarget({ repsMin: 8, repsMax: 8, sideMode: "none" })).toBe("8 reps");
    expect(formatTarget({ secondsMin: 10, secondsMax: 15, sideMode: "eachSide" })).toBe("10–15 sec each side");
    expect(formatTarget({ sideMode: "none" })).toBe("No target set");
  });
});
