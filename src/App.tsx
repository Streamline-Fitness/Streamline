import { useEffect, useReducer } from "react";
import { localStorageRepository } from "./storage/localStorage";
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
import "./styles/prototype.css";

function routeFromHash(): "plans" | "plan-editor" | "today" | "summary" | "settings" | "review" {
  const route = window.location.hash.replace("#", "");
  return route === "plan-editor" || route === "today" || route === "summary" || route === "settings" || route === "review" ? route : "today";
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...createInitialState(), route: routeFromHash() }));
  useEffect(() => {
    const onHashChange = () => dispatch({ type: "NAVIGATE", route: routeFromHash() });
    window.addEventListener("hashchange", onHashChange);
    const stored = localStorageRepository.load();
    dispatch({ type: "HYDRATE", data: stored ?? state.data });
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  useEffect(() => {
    if (state.hydrated) localStorageRepository.save(state.data);
  }, [state.data, state.hydrated]);
  useEffect(() => {
    const hash = `#${state.route}`;
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
  }, [state.route]);
  const navigateDispatch = (action: Action) => {
    dispatch(action);
    if (action.type === "NAVIGATE") window.history.replaceState(null, "", `#${action.route}`);
  };
  const screen = state.route === "plans" ? <PlansScreen state={state} dispatch={navigateDispatch} /> : state.route === "plan-editor" ? <PlanEditorScreen state={state} dispatch={navigateDispatch} /> : state.route === "today" ? <TodayScreen state={state} dispatch={navigateDispatch} /> : state.route === "settings" ? <SettingsScreen state={state} dispatch={navigateDispatch} /> : state.route === "review" ? <WeeklyReviewScreen state={state} dispatch={navigateDispatch} /> : <SessionSummaryScreen state={state} dispatch={navigateDispatch} />;
  return <AppShell state={state} dispatch={navigateDispatch}><PrototypeNotice />{state.error && <div className="error-banner">{state.error}</div>}{screen}</AppShell>;
}
