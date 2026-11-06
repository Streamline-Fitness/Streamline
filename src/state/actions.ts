import type {
  ExerciseCategory,
  ID,
  Metric,
  Pattern,
  PlanBlockType,
  SideMode,
} from "../domain/model";
import type { AppState, Route } from "./appState";

export type Action =
  | { type: "HYDRATE"; data: AppState["data"] }
  | { type: "NAVIGATE"; route: Route }
  | { type: "SELECT_DATE"; date: string }
  | { type: "SELECT_PLAN"; planId: ID }
  | { type: "SELECT_PLAN_DAY"; dayId: ID }
  | { type: "CREATE_PLAN"; planId: ID; name: string; now: number }
  | { type: "UPDATE_PLAN"; planId: ID; name: string; description: string; now: number }
  | { type: "ACTIVATE_PLAN"; planId: ID }
  | { type: "ADD_PLAN_DAY"; dayId: ID; planId: ID; name: string; weekday?: number }
  | { type: "UPDATE_PLAN_DAY"; dayId: ID; name: string; weekday?: number; isRestDay?: boolean; reflectionEnabled?: boolean }
  | { type: "DELETE_PLAN_DAY"; dayId: ID }
  | { type: "ADD_PLAN_BLOCK"; blockId: ID; dayId: ID; name: string; blockType: PlanBlockType }
  | { type: "UPDATE_PLAN_BLOCK"; blockId: ID; name: string; blockType: PlanBlockType; roundsMin: number; roundsMax: number; restMinS: number; restMaxS: number }
  | { type: "DELETE_PLAN_BLOCK"; blockId: ID }
  | { type: "ADD_PLAN_EXERCISE"; planExerciseId: ID; blockId: ID; exerciseId: ID; repsMin?: number; repsMax?: number; secondsMin?: number; secondsMax?: number; sideMode: SideMode }
  | { type: "REMOVE_PLAN_EXERCISE"; planExerciseId: ID }
  | { type: "CREATE_CUSTOM_EXERCISE"; exerciseId: ID; name: string; category: ExerciseCategory; metric: Metric; pattern?: Pattern; skillId?: string; leadInS?: number; defaultHoldS?: number; sideMode: SideMode }
  | { type: "UPDATE_EXERCISE"; exerciseId: ID; name: string; category: ExerciseCategory; metric: Metric; pattern?: Pattern; skillId?: string; leadInS?: number; defaultHoldS?: number; sideMode: SideMode }
  | { type: "DELETE_EXERCISE"; exerciseId: ID }
  | { type: "START_SESSION"; sessionId: ID; date: string; planId: ID; planDayId: ID; now: number }
  | { type: "START_GUIDED_EXERCISE"; sessionId: ID; planExerciseId: ID; now: number }
  | { type: "CLOCK_TICK"; now: number }
  | { type: "PAUSE_GUIDED_EXERCISE"; now: number }
  | { type: "RESUME_GUIDED_EXERCISE"; now: number }
  | { type: "CONTINUE_GUIDED_EXERCISE"; sessionId: ID; planExerciseId: ID; now: number }
  | { type: "SKIP_REST"; sessionId: ID; planExerciseId: ID; now: number }
  | { type: "UPDATE_SETTINGS"; defaultLeadInS: number }
  | { type: "SAVE_WEEKLY_REVIEW"; weekStart: string; reflection: string; nextWeekGoal: string; reviewedAt: number }
  | { type: "SAVE_JOURNAL_ENTRY"; entryId: ID; date: string; text: string; categoryId: ID; updatedAt: number }
  | { type: "DELETE_JOURNAL_ENTRY"; entryId: ID }
  | { type: "ADD_JOURNAL_CATEGORY"; categoryId: ID; name: string }
  | { type: "RENAME_JOURNAL_CATEGORY"; categoryId: ID; name: string }
  | { type: "DELETE_JOURNAL_CATEGORY"; categoryId: ID }
  | { type: "COMMIT_REP_SET"; setId: ID; sessionId: ID; planExerciseId: ID; exerciseId: ID; setNo: number; reps: number; now: number }
  | { type: "SKIP_GUIDED_EXERCISE"; setId: ID; sessionId: ID; planExerciseId: ID; exerciseId: ID; setNo: number; reason: string; now: number }
  | { type: "SKIP_GUIDED_BLOCK"; skippedBlockId: ID; sessionId: ID; blockId: ID; reason: string; now: number }
  | { type: "FINISH_SESSION"; sessionId: ID; now: number }
  | { type: "DELETE_IN_PROGRESS_SESSION"; sessionId: ID }
  | { type: "VIEW_SESSION"; sessionId: ID }
  | { type: "DISMISS_SESSION_SUMMARY" }
  | { type: "UPDATE_SESSION_NOTE"; sessionId: ID; note: string }
  | { type: "UPDATE_SLEEP_HOURS"; sessionId: ID; sleepHours?: number };
