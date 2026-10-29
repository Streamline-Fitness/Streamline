import { useState, type FormEvent } from "react";

type Props = {
  authError?: string;
  onSignInWithPassword: (email: string, password: string) => Promise<void>;
  onSignUpWithPassword: (email: string, password: string) => Promise<void>;
  onSendPasswordReset: (email: string) => Promise<void>;
};

export function AuthScreen({ authError, onSignInWithPassword, onSignUpWithPassword, onSendPasswordReset }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await action();
      setMessage(successMessage);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (isSignUp && password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    void run(
      () => isSignUp
        ? onSignUpWithPassword(normalizedEmail, password)
        : onSignInWithPassword(normalizedEmail, password),
      isSignUp ? "Account created. Check your email to confirm it, then sign in." : "Signing in…",
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="eyebrow">TRAINING LOG · WEB</div>
        <h1>Make the work visible.</h1>
        <p>Sign in to access your private training history.</p>
        <form onSubmit={submitPassword}>
          <label htmlFor="auth-password-email">Email address</label>
          <input autoComplete="email" id="auth-password-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          <label htmlFor="auth-password">Password</label>
          <input autoComplete={isSignUp ? "new-password" : "current-password"} id="auth-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          {isSignUp && <>
            <label htmlFor="auth-password-confirmation">Confirm password</label>
            <input autoComplete="new-password" id="auth-password-confirmation" minLength={8} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />
          </>}
          <button className="button primary" disabled={busy} type="submit">
            {busy ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
          </button>
          <div className="auth-actions">
            <button className="text-button" disabled={busy} onClick={() => { setIsSignUp(!isSignUp); setMessage(""); setError(""); setPassword(""); setConfirmation(""); }} type="button">
              {isSignUp ? "Already have an account? Sign in" : "Create an account"}
            </button>
            {!isSignUp && <button className="text-button" disabled={busy || !email.trim()} onClick={() => void run(
              () => onSendPasswordReset(email.trim()),
              "If an account exists for that email, a recovery link is on its way. Open it in this browser, then set your new password from the account menu.",
            )} type="button">Forgot password?</button>}
          </div>
        </form>
        {message && <p className="auth-message" role="status">{message}</p>}
        {(authError || error) && <p className="error-banner" role="alert">{error || authError}</p>}
      </section>
    </main>
  );
}
