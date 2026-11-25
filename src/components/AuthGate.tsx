import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/tracker";
import { supabase, supabaseConfigError } from "@/lib/supabase";

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (supabaseConfigError) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (supabaseConfigError) return <SetupScreen />;
  if (!ready) return <Centered><h1>Loading your ledger…</h1></Centered>;
  if (!session) return <LoginScreen />;
  if (session.user.app_metadata?.caterledger_staff !== "true") return <StaffRequiredScreen email={session.user.email} />;
  return children;
}

function SetupScreen() {
  return <Centered>
    <div className="eyebrow">SUPABASE</div>
    <h1>Connect your ledger</h1>
    <p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in Vercel → Project → Settings → Environment Variables, then redeploy. Locally, put the same values in <code>.env</code> and restart the dev server.</p>
  </Centered>;
}

function LoginScreen() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function signInWithGoogle() {
    setError("");
    setPending(true);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (signInError) {
      setPending(false);
      setError(errorMessage(signInError));
    }
  }

  return <Centered>
    <div className="eyebrow">SIGN IN</div>
    <h1>Open your ledger</h1>
    <p>Use your Google account. An admin must approve staff access the first time.</p>
    {error && <p className="field-error" role="alert">{error}</p>}
    <Button type="button" className="save-button" disabled={pending} onClick={() => { void signInWithGoogle(); }}>
      {pending ? "Redirecting…" : "Continue with Google"}
    </Button>
  </Centered>;
}

function StaffRequiredScreen({ email }: { email?: string | null }) {
  return <Centered>
    <div className="eyebrow">STAFF ACCESS</div>
    <h1>This account isn’t approved yet</h1>
    <p>
      {email ? <><strong>{email}</strong> signed in successfully. </> : null}
      Ask an admin to set <code>app_metadata.caterledger_staff</code> to <code>true</code> for this user in Supabase Auth, then sign in again.
    </p>
    <Button type="button" variant="outline" onClick={() => { void supabase.auth.signOut(); }}>Sign out</Button>
  </Centered>;
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="auth-screen"><section className="editor-card auth-card"><div className="auth-brand"><img className="auth-logo" src="/lai-logo.webp" alt="" /><img className="auth-wordmark" src="/lai-name.webp" alt="LAi Catering" /></div>{children}</section></div>;
}
