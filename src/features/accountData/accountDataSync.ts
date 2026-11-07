import type { DataDocument } from "../../domain/model";
import { createSeedData } from "../../domain/seed";
import {
  clearRecoveryDraft,
  readRecoveryDraft,
  recoveryDraftMatches,
  writeRecoveryDraft,
  type RecoveryDraft,
} from "../../storage/recoveryDraft";
import { supabaseRepository } from "../../storage/supabaseRepository";

type AccountDataRepository = Pick<typeof supabaseRepository, "load" | "save">;
type RecoveryDraftStore = {
  read: typeof readRecoveryDraft;
  write: typeof writeRecoveryDraft;
  clear: typeof clearRecoveryDraft;
  matches: typeof recoveryDraftMatches;
};

export type AccountDataSyncState = {
  loadError: string;
  saveError: string;
  saveCanRetry: boolean;
  syncStatus: string;
  recoveryDraft?: RecoveryDraft;
  recoveryConflict: boolean;
};

type Dependencies = {
  repository?: AccountDataRepository;
  recoveryDraftStore?: RecoveryDraftStore;
  createSeedData?: typeof createSeedData;
  now?: () => number;
  onHydrate: (data: DataDocument, options?: { needsOnboarding: boolean; saveAfterHydrate: boolean }) => void;
  onStateChange?: (state: AccountDataSyncState) => void;
};

export const initialAccountDataSyncState: AccountDataSyncState = {
  loadError: "",
  saveError: "",
  saveCanRetry: false,
  syncStatus: "Loading account data…",
  recoveryConflict: false,
};

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export class AccountDataSync {
  private readonly repository: AccountDataRepository;
  private readonly recoveryDraftStore: RecoveryDraftStore;
  private readonly createSeedData: typeof createSeedData;
  private readonly now: () => number;
  private readonly onHydrate: Dependencies["onHydrate"];
  private readonly onStateChange?: Dependencies["onStateChange"];
  private state: AccountDataSyncState = initialAccountDataSyncState;
  private version = 0;
  private writeBlocked = false;
  private recoveryBaseVersion: number | null = null;
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(private readonly userId: string, dependencies: Dependencies) {
    this.repository = dependencies.repository ?? supabaseRepository;
    this.recoveryDraftStore = dependencies.recoveryDraftStore ?? {
      read: readRecoveryDraft,
      write: writeRecoveryDraft,
      clear: clearRecoveryDraft,
      matches: recoveryDraftMatches,
    };
    this.createSeedData = dependencies.createSeedData ?? createSeedData;
    this.now = dependencies.now ?? Date.now;
    this.onHydrate = dependencies.onHydrate;
    this.onStateChange = dependencies.onStateChange;
  }

  get snapshot(): AccountDataSyncState {
    return this.state;
  }

  get canAutoRetry(): boolean {
    return this.writeBlocked && !this.state.recoveryConflict;
  }

  get isWriteBlocked(): boolean {
    return this.writeBlocked;
  }

  load(): { cancel: () => void; completed: Promise<void> } {
    let active = true;
    this.updateState({ loadError: "", syncStatus: "Loading account data…" });

    const completed = this.loadAccountData(() => active);
    return {
      cancel: () => { active = false; },
      completed,
    };
  }

  enqueueSave(data: DataDocument): Promise<void> {
    const snapshot = structuredClone(data);
    this.saveQueue = this.saveQueue.then(() => this.saveSnapshot(snapshot));
    return this.saveQueue;
  }

  retrySave(data: DataDocument): Promise<void> {
    if (this.state.recoveryConflict) return Promise.resolve();
    this.writeBlocked = false;
    this.updateState({ saveError: "", saveCanRetry: false });
    return this.enqueueSave(data);
  }

  private updateState(patch: Partial<AccountDataSyncState>): void {
    this.state = { ...this.state, ...patch };
    this.onStateChange?.(this.state);
  }

  private hydrate(data: DataDocument, isActive: () => boolean, needsOnboarding = false, saveAfterHydrate = false): void {
    if (isActive()) this.onHydrate(data, { needsOnboarding, saveAfterHydrate });
  }

  private async loadAccountData(isActive: () => boolean): Promise<void> {
    let stored: Awaited<ReturnType<AccountDataRepository["load"]>>;
    try {
      stored = await this.repository.load(this.userId);
    } catch (error) {
      if (!isActive()) return;
      const message = messageFrom(error, "Could not load your account data.");
      let pendingDraft: RecoveryDraft | null;
      try {
        pendingDraft = this.recoveryDraftStore.read(this.userId);
      } catch (recoveryError) {
        const recoveryMessage = messageFrom(recoveryError, "Could not read the on-device recovery copy.");
        this.updateState({ loadError: `${message} ${recoveryMessage}` });
        return;
      }
      if (pendingDraft) {
        this.version = pendingDraft.expectedVersion;
        this.recoveryBaseVersion = pendingDraft.expectedVersion;
        this.writeBlocked = true;
        this.updateState({
          recoveryConflict: false,
          recoveryDraft: pendingDraft,
          saveCanRetry: true,
          saveError: `${message} Your unsynced recovery copy has been opened on this device. Reconnect and retry to save it to your account.`,
          syncStatus: "Unsynced recovery copy loaded",
        });
        this.hydrate(pendingDraft.data, isActive);
        return;
      }
      this.updateState({ loadError: message });
      return;
    }

    if (!isActive()) return;
    const serverVersion = stored?.version ?? 0;
    const serverData = stored?.data ?? this.createSeedData();
    this.version = serverVersion;
    this.writeBlocked = false;

    let pendingDraft: RecoveryDraft | null;
    try {
      pendingDraft = this.recoveryDraftStore.read(this.userId);
    } catch (error) {
      this.writeBlocked = true;
      this.updateState({
        recoveryConflict: true,
        saveError: `${messageFrom(error, "Could not read the on-device recovery copy.")} Cloud data was not changed. Keep this tab open and do not clear browser data.`,
        syncStatus: "Recovery copy needs attention",
      });
      this.hydrate(serverData, isActive);
      return;
    }

    if (pendingDraft && !this.recoveryDraftStore.matches(pendingDraft, serverData)) {
      this.recoveryBaseVersion = pendingDraft.expectedVersion;
      this.updateState({ recoveryDraft: pendingDraft });
      if (pendingDraft.expectedVersion === serverVersion) {
        this.updateState({ recoveryConflict: false });
        this.hydrate(pendingDraft.data, isActive, false, true);
        return;
      }
      this.writeBlocked = true;
      this.updateState({
        recoveryConflict: true,
        saveError: "This device has unsynced training changes, but your cloud data has since changed. Download the recovery copy before continuing; it has not been merged or overwritten.",
        syncStatus: "Recovery copy needs attention",
      });
      this.hydrate(pendingDraft.data, isActive);
      return;
    }

    let cleanupWarning = "";
    if (pendingDraft) {
      try {
        this.recoveryDraftStore.clear(this.userId);
      } catch (error) {
        cleanupWarning = `Your cloud data is current, but ${messageFrom(error, "Could not clear the on-device recovery copy.")}`;
      }
    }
    this.recoveryBaseVersion = null;
    this.updateState({
      recoveryDraft: undefined,
      recoveryConflict: false,
      saveError: cleanupWarning,
      saveCanRetry: false,
    });
    this.hydrate(serverData, isActive, stored === null && pendingDraft === null);
  }

  private async saveSnapshot(snapshot: DataDocument): Promise<void> {
    if (this.writeBlocked) {
      const pendingDraft: RecoveryDraft = {
        data: snapshot,
        expectedVersion: this.recoveryBaseVersion ?? this.version,
        savedAt: this.now(),
      };
      try {
        this.recoveryDraftStore.write(this.userId, pendingDraft);
        this.recoveryBaseVersion = pendingDraft.expectedVersion;
        this.updateState({ recoveryDraft: pendingDraft });
      } catch (error) {
        const message = messageFrom(error, "Could not update the on-device recovery copy.");
        this.updateState({ saveError: `${this.state.saveError} ${message} Keep this tab open.` });
      }
      return;
    }

    this.updateState({ syncStatus: "Saving…" });
    const pendingDraft: RecoveryDraft = {
      data: snapshot,
      expectedVersion: this.version,
      savedAt: this.now(),
    };
    let recoveryCopySaved = false;
    let recoveryCopyError = "";
    try {
      this.recoveryDraftStore.write(this.userId, pendingDraft);
      this.recoveryBaseVersion = pendingDraft.expectedVersion;
      recoveryCopySaved = true;
      this.updateState({ recoveryDraft: pendingDraft });
    } catch (error) {
      recoveryCopyError = messageFrom(error, "Could not create an on-device recovery copy.");
    }

    try {
      this.version = await this.repository.save(this.userId, snapshot, this.version);
      if (recoveryCopySaved) {
        try {
          this.recoveryDraftStore.clear(this.userId);
          this.recoveryBaseVersion = null;
          this.updateState({ recoveryDraft: undefined });
        } catch (error) {
          this.updateState({
            saveError: `Your data was saved to your account. ${messageFrom(error, "Could not clear the on-device recovery copy.")}`,
            saveCanRetry: false,
            syncStatus: "Saved to account; local copy remains",
          });
          return;
        }
      }
      this.updateState({
        saveError: recoveryCopyError ? `Your data was saved to your account, but ${recoveryCopyError}` : "",
        saveCanRetry: false,
        syncStatus: recoveryCopyError ? "Saved to account; local backup unavailable" : "Saved to your account",
      });
    } catch (error) {
      this.writeBlocked = true;
      const message = messageFrom(error, "Could not save your training data.");
      const conflict = message.includes("changed in another session");
      this.updateState({
        recoveryConflict: conflict,
        saveCanRetry: !conflict,
        saveError: `${message}${recoveryCopySaved ? " Your unsynced changes are saved in this browser." : ` ${recoveryCopyError} Keep this tab open and retry.`}`,
        syncStatus: conflict ? "Recovery copy needs attention" : "Not saved — retry",
      });
    }
  }
}
