import type { DataDocument } from "../domain/model";
import { parseDataDocument } from "./document";

export type RecoveryDraft = {
  expectedVersion: number;
  savedAt: number;
  data: DataDocument;
};

function storageKey(userId: string): string {
  return `training-log-recovery-v1:${userId}`;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown browser storage error.";
}

export function readRecoveryDraft(userId: string): RecoveryDraft | null {
  let serialized: string | null;
  try {
    serialized = window.localStorage.getItem(storageKey(userId));
  } catch (error) {
    throw new Error(`Could not read the on-device recovery copy: ${describeError(error)}`);
  }
  if (!serialized) return null;

  try {
    const value: unknown = JSON.parse(serialized);
    if (
      typeof value !== "object"
      || value === null
      || !("expectedVersion" in value)
      || typeof value.expectedVersion !== "number"
      || !Number.isSafeInteger(value.expectedVersion)
      || value.expectedVersion < 0
      || !("savedAt" in value)
      || typeof value.savedAt !== "number"
      || !Number.isFinite(value.savedAt)
      || value.savedAt < 0
      || !("data" in value)
    ) {
      throw new Error("The recovery copy has an invalid format.");
    }
    return {
      expectedVersion: value.expectedVersion,
      savedAt: value.savedAt,
      data: parseDataDocument(value.data),
    };
  } catch (error) {
    throw new Error(`Could not read the on-device recovery copy: ${describeError(error)}`);
  }
}

export function writeRecoveryDraft(userId: string, draft: RecoveryDraft): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(draft));
  } catch (error) {
    throw new Error(`Could not create an on-device recovery copy: ${describeError(error)}`);
  }
}

export function clearRecoveryDraft(userId: string): void {
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch (error) {
    throw new Error(`Could not clear the on-device recovery copy: ${describeError(error)}`);
  }
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (typeof value !== "object" || value === null) return JSON.stringify(value) ?? "undefined";
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

export function recoveryDraftMatches(draft: RecoveryDraft, data: DataDocument): boolean {
  return stableSerialize(draft.data) === stableSerialize(data);
}
