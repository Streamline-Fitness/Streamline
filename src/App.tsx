import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AccountDataSync, initialAccountDataSyncState } from "./features/accountData/accountDataSync";
import { AuthGate } from "./features/auth/AuthGate";
import { supabase, type AppSupabaseClient } from "./storage/supabaseClient";
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
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { createOnboardingPlans, type TrainingExperience } from "./domain/onboarding";
import "./styles/prototype.css";

function routeFromHash(): "plans" | "plan-editor" | "today" | "summary" | "settings" | "review" | "history" | "journal" {
  const route = window.location.hash.replace("#", "");
  return route === "plan-editor" || route === "today" || route === "summary" || route === "settings" || route === "review" || route === "history" || route === "journal" ? route : "today";
}

function AuthenticatedApp({ client, session }: { client: AppSupabaseClient; session: Session }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...createInitialState(), route: routeFromHash() }));
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [accountSyncState, setAccountSyncState] = useState(initialAccountDataSyncState);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [journalDirty, setJournalDirty] = useState(false);
  const latestState = useRef(state);
  latestState.current = state;
  const accountSync = useMemo(() => new AccountDataSync(session.user.id, {
    onHydrate: (data, options) => {
      setOnboardingRequired(options?.needsOnboarding ?? false);
      dispatch({ type: "HYDRATE", data });
    },
    onStateChange: setAccountSyncState,
  }), [session.user.id]);
  const { loadError, saveError, saveCanRetry, syncStatus, recoveryDraft, recoveryConflict } = accountSyncState;

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
    const loading = accountSync.load();
    return loading.cancel;
  }, [accountSync, loadAttempt]);

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

  function retrySave() {
    accountSync.retrySave(latestState.current.data);
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
      if (accountSync.canAutoRetry) retrySave();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [accountSync]);

  useEffect(() => {
    if (state.hydrated && !onboardingRequired) void accountSync.enqueueSave(state.data);
  }, [accountSync, onboardingRequired, state.data, state.hydrated]);

  useEffect(() => {
    const hash = `#${state.route}`;
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
  }, [state.route]);

  async function signOut() {
    await accountSync.enqueueSave(latestState.current.data);
    if (accountSync.isWriteBlocked && !window.confirm("Your latest training changes could not be saved to your account. Sign out anyway? The latest copy is saved in this browser when available.")) return false;
    const { error } = await client.auth.signOut();
    if (error) throw new Error(`Could not sign out: ${error.message}`);
    return true;
  }

  if (loadError) return <main className="auth-page"><section className="auth-card"><h1>Could not load your account</h1><p className="error-banner" role="alert">{loadError}</p><button className="button primary" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button></section></main>;
  if (!state.hydrated) return <main className="auth-page"><p role="status">Loading your training data…</p></main>;
  if (onboardingRequired) return <OnboardingScreen onComplete={(experience: TrainingExperience) => {
    dispatch({ type: "HYDRATE", data: createOnboardingPlans(experience) });
    setOnboardingRequired(false);
    dispatch({ type: "NAVIGATE", route: "plans" });
  }} />;

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
