import { describe, expect, it, vi } from "vitest";
import { createSeedData } from "../../domain/seed";
import { createRecoveryDraftStore, type RecoveryDraft } from "../../storage/recoveryDraft";
import { AccountDataSync } from "./accountDataSync";

function seedData() {
  return structuredClone(createSeedData());
}

function createHarness(options: {
  serverVersion?: number;
  serverData?: ReturnType<typeof seedData>;
  loadError?: Error;
  draft?: RecoveryDraft;
  save?: (version: number) => Promise<number>;
} = {}) {
  const values = new Map<string, string>();
  const recoveryDraftStore = createRecoveryDraftStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  });
  if (options.draft) recoveryDraftStore.write("user-one", options.draft);

  const hydrated: ReturnType<typeof seedData>[] = [];
  const saveCalls: Array<{ version: number; data: ReturnType<typeof seedData> }> = [];
  const repository = {
    load: vi.fn(async () => {
      if (options.loadError) throw options.loadError;
      return options.serverData
        ? { data: options.serverData, version: options.serverVersion ?? 0 }
        : null;
    }),
    save: vi.fn(async (userId: string, data: ReturnType<typeof createSeedData>, version: number) => {
      void userId;
      saveCalls.push({ version, data });
      if (options.save) return options.save(version);
      return version + 1;
    }),
  };
  const sync = new AccountDataSync("user-one", {
    repository,
    recoveryDraftStore,
    now: () => 1_800_000_000_100,
    onHydrate: (data) => hydrated.push(data),
  });
  const load = sync.load();

  return { recoveryDraftStore, hydrated, saveCalls, sync, load };
}

function draft(data = seedData(), expectedVersion = 4): RecoveryDraft {
  return { data, expectedVersion, savedAt: 1_800_000_000_000 };
}

describe("account data synchronization", () => {
  it("hydrates a matching-version recovery draft and saves it against that version", async () => {
    const savedData = seedData();
    savedData.plans.plan_demo_weekly_template.name = "Recovered plan";
    const { load, hydrated, recoveryDraftStore, saveCalls, sync } = createHarness({
      serverVersion: 4,
      serverData: seedData(),
      draft: draft(savedData, 4),
    });

    await load.completed;

    expect(hydrated).toEqual([savedData]);
    expect(sync.snapshot.recoveryConflict).toBe(false);
    expect(sync.snapshot.recoveryDraft?.data.plans.plan_demo_weekly_template.name).toBe("Recovered plan");

    await sync.enqueueSave(savedData);

    expect(saveCalls.map((call) => call.version)).toEqual([4]);
    expect(recoveryDraftStore.read("user-one")).toBeNull();
    expect(sync.snapshot.syncStatus).toBe("Saved to your account");
  });

  it("blocks saving when both the cloud and the recovery copy changed", async () => {
    const recovered = seedData();
    recovered.plans.plan_demo_weekly_template.name = "Unsynced edit";
    const { load, hydrated, saveCalls, sync, recoveryDraftStore } = createHarness({
      serverVersion: 7,
      serverData: seedData(),
      draft: draft(recovered, 4),
    });

    await load.completed;
    await sync.enqueueSave(recovered);

    expect(hydrated).toEqual([recovered]);
    expect(sync.snapshot.recoveryConflict).toBe(true);
    expect(sync.snapshot.saveError).toContain("cloud data has since changed");
    expect(saveCalls).toEqual([]);
    expect(recoveryDraftStore.read("user-one")?.expectedVersion).toBe(4);
  });

  it("opens a recovery copy after a load failure and retries it without losing its base version", async () => {
    const recovered = seedData();
    recovered.plans.plan_demo_weekly_template.name = "Offline edit";
    const { load, hydrated, recoveryDraftStore, saveCalls, sync } = createHarness({
      loadError: new Error("network unavailable"),
      draft: draft(recovered, 3),
    });

    await load.completed;

    expect(hydrated).toEqual([recovered]);
    expect(sync.canAutoRetry).toBe(true);
    expect(sync.snapshot.saveCanRetry).toBe(true);

    await sync.retrySave(recovered);

    expect(saveCalls.map((call) => call.version)).toEqual([3]);
    expect(recoveryDraftStore.read("user-one")).toBeNull();
    expect(sync.snapshot.syncStatus).toBe("Saved to your account");
  });

  it("retains a local copy after a failed save and clears it only after retry succeeds", async () => {
    const savedData = seedData();
    let fail = true;
    const { load, recoveryDraftStore, saveCalls, sync } = createHarness({
      serverVersion: 2,
      serverData: seedData(),
      save: async (version) => {
        if (fail) throw new Error("Network unavailable.");
        return version + 1;
      },
    });

    await load.completed;
    await sync.enqueueSave(savedData);

    expect(sync.canAutoRetry).toBe(true);
    expect(sync.snapshot.saveCanRetry).toBe(true);
    expect(recoveryDraftStore.read("user-one")?.expectedVersion).toBe(2);

    fail = false;
    await sync.retrySave(savedData);

    expect(saveCalls.map((call) => call.version)).toEqual([2, 2]);
    expect(recoveryDraftStore.read("user-one")).toBeNull();
    expect(sync.snapshot.syncStatus).toBe("Saved to your account");
  });

  it("serializes rapid saves using the version returned by the prior save", async () => {
    const first = seedData();
    const second = seedData();
    first.plans.plan_demo_weekly_template.name = "First edit";
    second.plans.plan_demo_weekly_template.name = "Second edit";
    const { load, saveCalls, sync } = createHarness({
      serverVersion: 5,
      serverData: seedData(),
    });

    await load.completed;
    await Promise.all([sync.enqueueSave(first), sync.enqueueSave(second)]);

    expect(saveCalls.map(({ version }) => version)).toEqual([5, 6]);
    expect(saveCalls.map(({ data }) => data.plans.plan_demo_weekly_template.name)).toEqual(["First edit", "Second edit"]);
    expect(sync.snapshot.syncStatus).toBe("Saved to your account");
  });

  it("does not hydrate data when a cancelled load resolves later", async () => {
    let resolveLoad: ((value: { data: ReturnType<typeof seedData>; version: number } | null) => void) | undefined;
    const repository = {
      load: () => new Promise<{ data: ReturnType<typeof seedData>; version: number } | null>((resolve) => { resolveLoad = resolve; }),
      save: async (_userId: string, _data: ReturnType<typeof seedData>, version: number) => version + 1,
    };
    const hydrated: ReturnType<typeof seedData>[] = [];
    const sync = new AccountDataSync("user-one", {
      repository,
      recoveryDraftStore: createRecoveryDraftStore({
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      }),
      onHydrate: (data) => hydrated.push(data),
    });
    const loading = sync.load();
    loading.cancel();
    resolveLoad?.({ data: seedData(), version: 1 });

    await loading.completed;

    expect(hydrated).toEqual([]);
  });
});
