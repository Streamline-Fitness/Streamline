import type { DataDocument, ID } from "../domain/model";
import { createSeedData } from "../domain/seed";
import { getScheduledDayForDate, todayISO } from "../domain/plan";

export type Route = "plans" | "plan-editor" | "today" | "summary" | "settings" | "review" | "history";

export type GuidedTimer =
  | { phase: "idle" }
  | { phase: "preparation"; sessionId: ID; planExerciseId: ID; endsAt: number; targetSeconds: number }
  | { phase: "exercise"; sessionId: ID; planExerciseId: ID; startedAt: number; targetSeconds: number }
  | { phase: "rest"; sessionId: ID; planExerciseId: ID; nextPlanExerciseId?: ID; startedAt: number; endsAt: number; durationSeconds: number };

export type AppState = {
  data: DataDocument;
  route: Route;
  selectedDate: string;
  selectedPlanId?: ID;
  selectedPlanDayId?: ID;
  editorPlanId?: ID;
  activeSessionId?: ID;
  guidedPlanExerciseId?: ID;
  guidedTimer: GuidedTimer;
  clockNow: number;
  lastFinishedSessionId?: ID;
  viewedSessionId?: ID;
  hydrated: boolean;
  error?: string;
};

export function createInitialState(data?: DataDocument): AppState {
  const seeded = data ?? createSeedData();
  const activePlan = Object.values(seeded.plans).find((plan) => plan.isActive);
  const selectedDate = todayISO();
  return {
    data: seeded,
    route: "today",
    selectedDate,
    selectedPlanId: activePlan?.id,
    selectedPlanDayId: activePlan ? getScheduledDayForDate(seeded, activePlan.id, selectedDate)?.id : undefined,
    editorPlanId: activePlan?.id,
    guidedTimer: { phase: "idle" },
    clockNow: Date.now(),
    hydrated: Boolean(data),
  };
}
