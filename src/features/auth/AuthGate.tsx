import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthScreen } from "../../screens/AuthScreen";
import type { AppSupabaseClient } from "../../storage/supabaseClient";

type Props = {
  client: AppSupabaseClient;
  children: (session: Session) => ReactNode;
};

export function AuthGate({ client, children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const authRedirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();

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
        const { error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: authRedirectTo } });
        if (error) throw new Error(error.message);
      }}
      onSendPasswordReset={async (email) => {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: authRedirectTo });
        if (error) throw new Error(error.message);
      }}
    />;
  }
  return children(session);
}
