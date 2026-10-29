import { useEffect, useReducer, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSeedData } from "./domain/seed";
import { supabase } from "./storage/supabaseClient";
import { supabaseRepository } from "./storage/supabaseRepository";
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
import { AuthScreen } from "./screens/AuthScreen";
import "./styles/prototype.css";

function routeFromHash(): "plans" | "plan-editor" | "today" | "summary" | "settings" | "review" | "history" {
  const route = window.location.hash.replace("#", "");
  return route === "plan-editor" || route === "today" || route === "summary" || route === "settings" || route === "review" || route === "history" ? route : "today";
}

function AuthGate({ client }: { client: NonNullable<typeof supabase> }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      setAuthError("");
    });

    client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(`Could not check your sign-in: ${error.message}`);
      else setSession(data.session);
      setAuthReady(true);
    }).catch((error: unknown) => {
      if (!active) return;
      setAuthError(error instanceof Error ? error.message : "Could not check your sign-in.");
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  if (!authReady) return <main className="auth-page"><p role="status">Checking your account…</p></main>;
  if (!session) {
    return <AuthScreen
      authError={authError}
      onSignInWithPassword={async (email, password) => {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      }}
      onSignUpWithPassword={async (email, password) => {
        const { error } = await client.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
      }}
      onSendPasswordReset={async (email) => {
        const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw new Error(error.message);
      }}
    />;
  }
  return <AuthenticatedApp client={client} key={session.user.id} session={session} />;
}

function AuthenticatedApp({ client, session }: { client: NonNullable<typeof supabase>; session: Session }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...createInitialState(), route: routeFromHash() }));
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [syncStatus, setSyncStatus] = useState("Loading account data…");
  const version = useRef(0);
  const writeBlocked = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const latestState = useRef(state);
  latestState.current = state;

  useEffect(() => {
    let active = true;
    setLoadError("");
    setSyncStatus("Loading account data…");
    void supabaseRepository.load(session.user.id).then((stored) => {
      if (!active) return;
      version.current = stored?.version ?? 0;
      dispatch({ type: "HYDRATE", data: stored?.data ?? createSeedData() });
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadError(error instanceof Error ? error.message : "Could not load your account data.");
    });
    return () => { active = false; };
  }, [loadAttempt, session.user.id]);

  useEffect(() => {
    const onHashChange = () => dispatch({ type: "NAVIGATE", route: routeFromHash() });
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function enqueueSave(data: typeof state.data): Promise<void> {
    const snapshot = structuredClone(data);
    saveQueue.current = saveQueue.current.then(async () => {
      if (writeBlocked.current) return;
      setSyncStatus("Saving…");
      try {
        version.current = await supabaseRepository.save(session.user.id, snapshot, version.current);
        setSaveError("");
        setSyncStatus("Saved to your account");
      } catch (error) {
        writeBlocked.current = true;
        const message = error instanceof Error ? error.message : "Could not save your training data.";
        setSaveError(message);
        setSyncStatus("Not saved");
      }
    });
    return saveQueue.current;
  }

  useEffect(() => {
    if (state.hydrated) void enqueueSave(state.data);
  }, [state.data, state.hydrated, session.user.id]);

  useEffect(() => {
    const hash = `#${state.route}`;
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
  }, [state.route]);

  async function signOut() {
    await enqueueSave(latestState.current.data);
    if (writeBlocked.current && !window.confirm("Your latest training changes could not be saved. Sign out anyway and lose those unsaved changes?")) return false;
    const { error } = await client.auth.signOut();
    if (error) throw new Error(`Could not sign out: ${error.message}`);
    return true;
  }

  const navigateDispatch = (action: Action) => {
    dispatch(action);
    if (action.type === "NAVIGATE") window.history.replaceState(null, "", `#${action.route}`);
  };

  if (loadError) return <main className="auth-page"><section className="auth-card"><h1>Could not load your account</h1><p className="error-banner" role="alert">{loadError}</p><button className="button primary" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button></section></main>;
  if (!state.hydrated) return <main className="auth-page"><p role="status">Loading your training data…</p></main>;

  const screen = state.route === "plans" ? <PlansScreen state={state} dispatch={navigateDispatch} /> : state.route === "plan-editor" ? <PlanEditorScreen state={state} dispatch={navigateDispatch} /> : state.route === "today" ? <TodayScreen state={state} dispatch={navigateDispatch} /> : state.route === "settings" ? <SettingsScreen state={state} dispatch={navigateDispatch} /> : state.route === "review" ? <WeeklyReviewScreen state={state} dispatch={navigateDispatch} /> : state.route === "history" ? <HistoryScreen state={state} dispatch={navigateDispatch} /> : <SessionSummaryScreen state={state} dispatch={navigateDispatch} />;
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
  ><PrototypeNotice />{(state.error || saveError) && <div className="error-banner" role="alert">{state.error ?? saveError}</div>}{screen}</AppShell>;
}

export default function App() {
  if (!supabase) return <main className="auth-page"><section className="auth-card"><div className="eyebrow">SUPABASE SETUP</div><h1>Connect your project</h1><p>Add your Supabase project URL and publishable key to a local <code>.env.local</code> file. See <code>.env.example</code> and the README setup instructions.</p></section></main>;
  return <AuthGate client={supabase} />;
}
