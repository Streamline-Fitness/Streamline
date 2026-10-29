import { useState, type FormEvent } from "react";

export function AccountSecurity({
  userEmail,
  isSettings,
  onSettings,
  onSetPassword,
  onSignOut,
}: {
  userEmail: string;
  isSettings: boolean;
  onSettings: () => void;
  onSetPassword: (password: string) => Promise<void>;
  onSignOut: () => Promise<boolean>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const initials = (email: string): string => {
    const name = email.split("@")[0] ?? "";
    const parts = name.split(/[._-]+/).filter(Boolean);
    if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase() || "?";
  };

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      if (await onSignOut()) setIsOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign out.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await onSetPassword(password);
      setMessage("Password saved. You can now sign in with your email and password.");
      setPassword("");
      setConfirmation("");
      setIsSettingPassword(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-menu">
      <button
        aria-expanded={isOpen}
        aria-label="Account settings"
        className="account-avatar"
        onClick={() => { setIsOpen(!isOpen); setMessage(""); setError(""); setIsSettingPassword(false); }}
        type="button"
      >
        {initials(userEmail)}
      </button>
      {isOpen && <section aria-label="Account menu" className="account-menu-panel">
        <div className="account-menu-email">{userEmail}</div>
        <button className={isSettings ? "account-menu-item active" : "account-menu-item"} onClick={() => { onSettings(); setIsOpen(false); }} type="button">Settings</button>
        <button className="account-menu-item" disabled={busy} onClick={() => { setIsSettingPassword(!isSettingPassword); setPassword(""); setConfirmation(""); setError(""); }} type="button">
          {isSettingPassword ? "Cancel password change" : "Set / change password"}
        </button>
        {isSettingPassword && <form className="password-settings" onSubmit={submit}>
          <label htmlFor="new-account-password">New password</label>
          <input autoComplete="new-password" id="new-account-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          <label htmlFor="confirm-account-password">Confirm new password</label>
          <input autoComplete="new-password" id="confirm-account-password" minLength={8} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />
          <button className="button primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save password"}</button>
        </form>}
        <button className="account-menu-item" disabled={busy} onClick={() => void signOut()} type="button">Sign out</button>
        {message && <span className="account-security-message" role="status">{message}</span>}
        {error && <span className="account-security-error" role="alert">{error}</span>}
      </section>}
    </div>
  );
}
