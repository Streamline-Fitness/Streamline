import { describe, expect, it } from "vitest";
import { createSeedData } from "../domain/seed";
import { createRecoveryDraftStore, type RecoveryDraft } from "./recoveryDraft";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  };
}

function recoveryDraft(expectedVersion = 4): RecoveryDraft {
  return {
    expectedVersion,
    savedAt: 1_800_000_000_000,
    data: createSeedData(),
  };
}

describe("recovery draft storage", () => {
  it("round-trips validated drafts and isolates each account", () => {
    const memory = memoryStorage();
    const store = createRecoveryDraftStore(memory.storage);
    const draft = recoveryDraft();

    store.write("user-one", draft);

    expect(store.read("user-one")).toEqual(draft);
    expect(store.read("user-two")).toBeNull();
    expect([...memory.values.keys()]).toEqual(["training-log-recovery-v1:user-one"]);
  });

  it("rejects malformed or unsupported recovery documents", () => {
    const memory = memoryStorage();
    const store = createRecoveryDraftStore(memory.storage);
    memory.values.set("training-log-recovery-v1:user-one", JSON.stringify({
      expectedVersion: 1,
      savedAt: 10,
      data: { version: 7 },
    }));

    expect(() => store.read("user-one")).toThrow("Could not read the on-device recovery copy");
  });

  it("reports browser storage failures instead of treating them as missing data", () => {
    const storageError = new Error("storage denied");
    const store = createRecoveryDraftStore({
      getItem: () => { throw storageError; },
      setItem: () => { throw storageError; },
      removeItem: () => { throw storageError; },
    });

    expect(() => store.read("user-one")).toThrow("Could not read the on-device recovery copy: storage denied");
    expect(() => store.write("user-one", recoveryDraft())).toThrow("Could not create an on-device recovery copy: storage denied");
    expect(() => store.clear("user-one")).toThrow("Could not clear the on-device recovery copy: storage denied");
  });

  it("compares serialized data independent of object key order", () => {
    const draft = recoveryDraft();
    const reordered = JSON.parse(JSON.stringify(draft.data)) as typeof draft.data;
    reordered.exercises = Object.fromEntries(Object.entries(reordered.exercises).reverse());

    expect(createRecoveryDraftStore(memoryStorage().storage).matches(draft, reordered)).toBe(true);
  });
});
