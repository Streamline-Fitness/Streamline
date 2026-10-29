import type { ReactNode } from "react";
import type { AppState, Route } from "../state/appState";
import type { Action } from "../state/reducer";
import { AccountSecurity } from "./AccountSecurity";

type Props = {
  state: AppState;
  dispatch: (action: Action) => void;
  children: ReactNode;
  userEmail: string;
  syncStatus: string;
  onSignOut: () => Promise<boolean>;
  onSetPassword: (password: string) => Promise<void>;
};

export function AppShell({ state, dispatch, children, userEmail, syncStatus, onSignOut, onSetPassword }: Props) {
  const nav = (route: Route) => dispatch({ type: "NAVIGATE", route });
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">TRAINING LOG</div>
          <h1>Make the work visible.</h1>
        </div>
        <div className="account-toolbar">
          <span className="prototype-badge">PROTOTYPE</span>
          <span className="sync-status" role="status">{syncStatus}</span>
          <AccountSecurity userEmail={userEmail} isSettings={state.route === "settings"} onSettings={() => nav("settings")} onSetPassword={onSetPassword} onSignOut={onSignOut} />
        </div>
      </header>
      <nav className="primary-nav" aria-label="Primary navigation">
        <button className={state.route === "plans" || state.route === "plan-editor" ? "nav-button active" : "nav-button"} onClick={() => nav("plans")}>Plans</button>
        <button className={state.route === "today" || state.route === "review" ? "nav-button active" : "nav-button"} onClick={() => nav("today")}>Today</button>
        <button className={state.route === "history" ? "nav-button active" : "nav-button"} onClick={() => nav("history")}>History</button>
      </nav>
      <main className="page-content">{children}</main>
    </div>
  );
}
