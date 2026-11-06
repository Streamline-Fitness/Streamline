import type { DataDocument, JournalEntry } from "../domain/model";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeJournalEntries(value: Record<string, unknown>): DataDocument["journalEntries"] {
  return Object.fromEntries(Object.entries(value).map(([key, rawEntry]) => {
    if (!isRecord(rawEntry)) throw new Error("The saved journal entry is invalid.");
    if (typeof rawEntry.id === "string" && typeof rawEntry.date === "string" && typeof rawEntry.text === "string" && typeof rawEntry.updatedAt === "number") {
      const entry: JournalEntry = {
        id: rawEntry.id,
        date: rawEntry.date,
        text: rawEntry.text,
        categoryId: typeof rawEntry.categoryId === "string" ? rawEntry.categoryId : undefined,
        updatedAt: rawEntry.updatedAt,
      };
      return [entry.id, entry];
    }
    if (typeof rawEntry.date === "string" && typeof rawEntry.text === "string" && typeof rawEntry.updatedAt === "number") {
      const id = `journal_${key}`;
      const entry: JournalEntry = { id, date: rawEntry.date, text: rawEntry.text, updatedAt: rawEntry.updatedAt };
      return [id, entry];
    }
    throw new Error("The saved journal entry is invalid.");
  }));
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
    || ("journalEntries" in value && !isRecord(value.journalEntries))
    || ("journalCategories" in value && !isRecord(value.journalCategories))
    || !isRecord(value.settings)
  ) {
    throw new Error("The saved training data is not a supported document.");
  }
  return {
    ...value,
    journalEntries: normalizeJournalEntries(isRecord(value.journalEntries) ? value.journalEntries : {}),
    journalCategories: isRecord(value.journalCategories) ? value.journalCategories : {},
  } as DataDocument;
}
