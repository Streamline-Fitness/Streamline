import type { ReactNode } from "react";
import type { AppState, Route } from "../state/appState";
import type { Action } from "../state/reducer";

type Props = { state: AppState; dispatch: (action: Action) => void; children: ReactNode };

export function AppShell({ state, dispatch, children }: Props) {
  const nav = (route: Route) => dispatch({ type: "NAVIGATE", route });
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">TRAINING LOG</div>
          <h1>Make the work visible.</h1>
        </div>
        <span className="prototype-badge">PROTOTYPE</span>
      </header>
      <nav className="primary-nav" aria-label="Primary navigation">
        <button className={state.route === "plans" || state.route === "plan-editor" ? "nav-button active" : "nav-button"} onClick={() => nav("plans")}>Plans</button>
        <button className={state.route === "today" || state.route === "review" ? "nav-button active" : "nav-button"} onClick={() => nav("today")}>Today</button>
        <button className={state.route === "settings" ? "nav-button active" : "nav-button"} onClick={() => nav("settings")}>Settings</button>
        <button className="nav-button muted" title="Restore the seeded example plan and demo history" aria-label="Reset demo data" onClick={() => dispatch({ type: "RESET_DEMO_DATA" })}>Reset demo</button>
      </nav>
      <main className="page-content">{children}</main>
    </div>
  );
}
