import { useEffect, useReducer, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSeedData } from "./domain/seed";
import { AuthGate } from "./features/auth/AuthGate";
import { supabase, type AppSupabaseClient } from "./storage/supabaseClient";
import { supabaseRepository } from "./storage/supabaseRepository";
import { clearRecoveryDraft, readRecoveryDraft, recoveryDraftMatches, writeRecoveryDraft, type RecoveryDraft } from "./storage/recoveryDraft";
import { createInitialState } from "./state/appState";
import { reducer, type Action } from "./state/reducer";
import { AppShell } from "./ui/AppShell";
import { PrototypeNotice } from "./ui/PrototypeNotice";
import { PlansScreen } from "./screens/PlansScreen";
import { PlanEditorScreen } from "./screens/PlanEditorScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { SessionSummaryScreen } from "./screens/SessionSummaryScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { WeeklyReviewScreen } from "./screens/WeeklyReviewScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { JournalScreen } from "./screens/JournalScreen";
import "./styles/prototype.css";

function routeFromHash(): "plans" | "plan-editor" | "today" | "summary" | "settings" | "review" | "history" | "journal" {
  const route = window.location.hash.replace("#", "");
  return route === "plan-editor" || route === "today" || route === "summary" || route === "settings" || route === "review" || route === "history" || route === "journal" ? route : "today";
}

function AuthenticatedApp({ client, session }: { client: AppSupabaseClient; session: Session }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...createInitialState(), route: routeFromHash() }));
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [saveCanRetry, setSaveCanRetry] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Loading account data…");
  const [journalDirty, setJournalDirty] = useState(false);
  const [recoveryDraft, setRecoveryDraft] = useState<RecoveryDraft>();
  const [recoveryConflict, setRecoveryConflict] = useState(false);
  const version = useRef(0);
  const writeBlocked = useRef(false);
  const recoveryConflictRef = useRef(false);
  const recoveryBaseVersion = useRef<number | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const latestState = useRef(state);
  latestState.current = state;

  function navigateDispatch(action: Action) {
    if (action.type === "NAVIGATE" && state.route === "journal" && journalDirty) {
      if (!window.confirm("You have unsaved journal changes. Leave without saving them?")) {
        window.history.replaceState(null, "", `#${state.route}`);
        return;
      }
      setJournalDirty(false);
    }
    dispatch(action);
    if (action.type === "NAVIGATE") window.history.replaceState(null, "", `#${action.route}`);
  }

  useEffect(() => {
    let active = true;
    setLoadError("");
    setSyncStatus("Loading account data…");
    void supabaseRepository.load(session.user.id).then((stored) => {
      if (!active) return;
      const serverVersion = stored?.version ?? 0;
      const serverData = stored?.data ?? createSeedData();
      version.current = serverVersion;
      writeBlocked.current = false;
      let pendingDraft: RecoveryDraft | null;
      try {
        pendingDraft = readRecoveryDraft(session.user.id);
      } catch (error) {
        writeBlocked.current = true;
        recoveryConflictRef.current = true;
        setRecoveryConflict(true);
        const message = error instanceof Error ? error.message : "Could not read the on-device recovery copy.";
        setSaveError(`${message} Cloud data was not changed. Keep this tab open and do not clear browser data.`);
        setSyncStatus("Recovery copy needs attention");
        dispatch({ type: "HYDRATE", data: serverData });
        return;
      }
      if (pendingDraft && !recoveryDraftMatches(pendingDraft, serverData)) {
        recoveryBaseVersion.current = pendingDraft.expectedVersion;
        setRecoveryDraft(pendingDraft);
        if (pendingDraft.expectedVersion === serverVersion) {
          recoveryConflictRef.current = false;
          setRecoveryConflict(false);
          dispatch({ type: "HYDRATE", data: pendingDraft.data });
          return;
        }
        writeBlocked.current = true;
        recoveryConflictRef.current = true;
        setRecoveryConflict(true);
        setSaveError("This device has unsynced training changes, but your cloud data has since changed. Download the recovery copy before continuing; it has not been merged or overwritten.");
        setSyncStatus("Recovery copy needs attention");
        dispatch({ type: "HYDRATE", data: pendingDraft.data });
        return;
      }

      let cleanupWarning = "";
      if (pendingDraft) {
        try {
          clearRecoveryDraft(session.user.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not clear the on-device recovery copy.";
          cleanupWarning = `Your cloud data is current, but ${message}`;
        }
      }
      setRecoveryDraft(undefined);
      recoveryBaseVersion.current = null;
      recoveryConflictRef.current = false;
      setRecoveryConflict(false);
      setSaveError(cleanupWarning);
      setSaveCanRetry(false);
      dispatch({ type: "HYDRATE", data: serverData });
    }).catch((error: unknown) => {
      if (!active) return;
      const message = error instanceof Error ? error.message : "Could not load your account data.";
      let pendingDraft: RecoveryDraft | null;
      try {
        pendingDraft = readRecoveryDraft(session.user.id);
      } catch (recoveryError) {
        const recoveryMessage = recoveryError instanceof Error ? recoveryError.message : "Could not read the on-device recovery copy.";
        setLoadError(`${message} ${recoveryMessage}`);
        return;
      }
      if (pendingDraft) {
        version.current = pendingDraft.expectedVersion;
        recoveryBaseVersion.current = pendingDraft.expectedVersion;
        writeBlocked.current = true;
        recoveryConflictRef.current = false;
        setRecoveryConflict(false);
        setRecoveryDraft(pendingDraft);
        setSaveCanRetry(true);
        setSaveError(`${message} Your unsynced recovery copy has been opened on this device. Reconnect and retry to save it to your account.`);
        setSyncStatus("Unsynced recovery copy loaded");
        dispatch({ type: "HYDRATE", data: pendingDraft.data });
        return;
      }
      setLoadError(message);
    });
    return () => { active = false; };
  }, [loadAttempt, session.user.id]);

  useEffect(() => {
    const onHashChange = () => navigateDispatch({ type: "NAVIGATE", route: routeFromHash() });
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [state.route, journalDirty]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!journalDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [journalDirty]);

  function enqueueSave(data: typeof state.data): Promise<void> {
    const snapshot = structuredClone(data);
    saveQueue.current = saveQueue.current.then(async () => {
      if (writeBlocked.current) {
        const pendingDraft: RecoveryDraft = {
          data: snapshot,
          expectedVersion: recoveryBaseVersion.current ?? version.current,
          savedAt: Date.now(),
        };
        try {
          writeRecoveryDraft(session.user.id, pendingDraft);
          recoveryBaseVersion.current = pendingDraft.expectedVersion;
          setRecoveryDraft(pendingDraft);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not update the on-device recovery copy.";
          setSaveError((current) => `${current} ${message} Keep this tab open.`);
        }
        return;
      }
      setSyncStatus("Saving…");
      const pendingDraft: RecoveryDraft = { data: snapshot, expectedVersion: version.current, savedAt: Date.now() };
      let recoveryCopySaved = false;
      let recoveryCopyError = "";
      try {
        writeRecoveryDraft(session.user.id, pendingDraft);
        recoveryBaseVersion.current = pendingDraft.expectedVersion;
        recoveryCopySaved = true;
        setRecoveryDraft(pendingDraft);
      } catch (error) {
        recoveryCopyError = error instanceof Error ? error.message : "Could not create an on-device recovery copy.";
      }

      try {
        version.current = await supabaseRepository.save(session.user.id, snapshot, version.current);
        if (recoveryCopySaved) {
          try {
            clearRecoveryDraft(session.user.id);
            recoveryBaseVersion.current = null;
            setRecoveryDraft(undefined);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Could not clear the on-device recovery copy.";
            setSaveError(`Your data was saved to your account. ${message}`);
            setSaveCanRetry(false);
            setSyncStatus("Saved to account; local copy remains");
            return;
          }
        }
        setSaveError(recoveryCopyError ? `Your data was saved to your account, but ${recoveryCopyError}` : "");
        setSaveCanRetry(false);
        setSyncStatus(recoveryCopyError ? "Saved to account; local backup unavailable" : "Saved to your account");
      } catch (error) {
        writeBlocked.current = true;
        const message = error instanceof Error ? error.message : "Could not save your training data.";
        const conflict = message.includes("changed in another session");
        recoveryConflictRef.current = conflict;
        setRecoveryConflict(conflict);
        setSaveCanRetry(!conflict);
        setSaveError(`${message}${recoveryCopySaved ? " Your unsynced changes are saved in this browser." : ` ${recoveryCopyError} Keep this tab open and retry.`}`);
        setSyncStatus(conflict ? "Recovery copy needs attention" : "Not saved — retry");
      }
    });
    return saveQueue.current;
  }

  function retrySave() {
    if (recoveryConflictRef.current) return;
    writeBlocked.current = false;
    setSaveError("");
    setSaveCanRetry(false);
    void enqueueSave(latestState.current.data);
  }

  function downloadRecoveryCopy() {
    if (!recoveryDraft) return;
    const blob = new Blob([JSON.stringify(recoveryDraft.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `training-log-recovery-${new Date(recoveryDraft.savedAt).toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  useEffect(() => {
    const onOnline = () => {
      if (writeBlocked.current && !recoveryConflictRef.current) retrySave();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [session.user.id]);

  useEffect(() => {
    if (state.hydrated) void enqueueSave(state.data);
  }, [state.data, state.hydrated, session.user.id]);

  useEffect(() => {
    const hash = `#${state.route}`;
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
  }, [state.route]);

  async function signOut() {
    await enqueueSave(latestState.current.data);
    if (writeBlocked.current && !window.confirm("Your latest training changes could not be saved to your account. Sign out anyway? The latest copy is saved in this browser when available.")) return false;
    const { error } = await client.auth.signOut();
    if (error) throw new Error(`Could not sign out: ${error.message}`);
    return true;
  }

  if (loadError) return <main className="auth-page"><section className="auth-card"><h1>Could not load your account</h1><p className="error-banner" role="alert">{loadError}</p><button className="button primary" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button></section></main>;
  if (!state.hydrated) return <main className="auth-page"><p role="status">Loading your training data…</p></main>;

  const screen = state.route === "plans" ? <PlansScreen state={state} dispatch={navigateDispatch} /> : state.route === "plan-editor" ? <PlanEditorScreen state={state} dispatch={navigateDispatch} /> : state.route === "today" ? <TodayScreen state={state} dispatch={navigateDispatch} /> : state.route === "settings" ? <SettingsScreen state={state} dispatch={navigateDispatch} /> : state.route === "review" ? <WeeklyReviewScreen state={state} dispatch={navigateDispatch} /> : state.route === "history" ? <HistoryScreen state={state} dispatch={navigateDispatch} /> : state.route === "journal" ? <JournalScreen state={state} dispatch={navigateDispatch} onDraftStatusChange={setJournalDirty} /> : <SessionSummaryScreen state={state} dispatch={navigateDispatch} />;
  return <AppShell
    state={state}
    dispatch={navigateDispatch}
    userEmail={session.user.email ?? ""}
    syncStatus={syncStatus}
    onSignOut={signOut}
    onSetPassword={async (password) => {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    }}
  ><PrototypeNotice />
    {state.error && <div className="error-banner" role="alert">{state.error}</div>}
    {saveError && <div className="error-banner save-error" role="alert">
      <p>{saveError}</p>
      <div className="recovery-actions">
        {saveCanRetry && !recoveryConflict && <button className="button secondary" onClick={retrySave}>Retry saving</button>}
        {recoveryDraft && <button className="button secondary" onClick={downloadRecoveryCopy}>Download recovery copy</button>}
      </div>
    </div>}
    {screen}
  </AppShell>;
}

export default function App() {
  const client = supabase;
  if (!client) return <main className="auth-page"><section className="auth-card"><div className="eyebrow">SUPABASE SETUP</div><h1>Connect your project</h1><p>Add your Supabase project URL and publishable key to a local <code>.env.local</code> file. See <code>.env.example</code> and the README setup instructions.</p></section></main>;
  return <AuthGate client={client}>{(session) => <AuthenticatedApp client={client} key={session.user.id} session={session} />}</AuthGate>;
}
