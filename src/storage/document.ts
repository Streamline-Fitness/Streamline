import type { DataDocument } from "../domain/model";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseDataDocument(value: unknown): DataDocument {
  if (
    !isRecord(value)
    || value.version !== 1
    || !isRecord(value.exercises)
    || !isRecord(value.levels)
    || !isRecord(value.plans)
    || !isRecord(value.planDays)
    || !isRecord(value.planBlocks)
    || !isRecord(value.planExercises)
    || !isRecord(value.sessionPlanItems)
    || !isRecord(value.sessions)
    || !isRecord(value.setEntries)
    || !isRecord(value.skippedBlocks)
    || !isRecord(value.weeklyReviews)
    || !isRecord(value.settings)
  ) {
    throw new Error("The saved training data is not a supported document.");
  }
  return value as DataDocument;
}
