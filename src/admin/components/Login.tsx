import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

interface LoginProps {
  /** Diagnostic banner, e.g. when a session was dropped right after sign-in. */
  notice?: string;
}

/**
 * Supabase email + password login.
 *
 * Accounts are created manually in the Supabase dashboard and must also be
 * present in the allowed_admins table (role 'admin' or 'client'). A user who
 * authenticates but is not allowlisted is rejected after sign-in by App.tsx
 * (RLS denies them all data regardless).
 *
 * If the Supabase env vars are missing at build time this renders a setup
 * notice instead — the admin never silently falls back to localStorage.
 */
export function Login({ notice = '' }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<'checking' | 'ok' | 'unreachable'>('checking');

  // Connectivity self-test: makes a blocked network visible on screen.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    fetch(`${url}/auth/v1/health`, { 
      method: 'GET',
      headers: { 'apikey': key }
    })
      .then((r) => setHealth(r.ok ? 'ok' : 'unreachable'))
      .catch(() => setHealth('unreachable'));
  }, []);

  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="login-wrapper">
        <div className="login-form setup-notice">
          <h2>Admin Not Configured</h2>
          <p>
            This admin panel requires a Supabase backend, and this build was
            produced without one. Set the following environment variables in
            <code> .env</code> and rebuild:
          </p>
          <pre>{'VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...'}</pre>
          <p>
            Then run the schema in <code>supabase/schema.sql</code> and add the
            two allowed accounts. See DEPLOYMENT.md for the full setup steps.
          </p>
          <p className="setup-note-muted">
            Existing local backup data is untouched and will be offered for
            migration once Supabase is connected.
          </p>
        </div>
      </div>
    );
  }

  const client = supabase;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');

    const { error: authError } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Incorrect email or password.'
          : `Sign-in failed: ${authError.message}`,
      );
      setBusy(false);
    }
    // On success the auth state listener in App.tsx takes over.
  };

  return (
    <div className="login-wrapper">
      <div className="login-form">
        <h2>Suruchi Editorial Control</h2>
        {notice && <p className="login-notice">{notice}</p>}
        <form onSubmit={(e) => void handleSubmit(e)}>
          {error && <span className="login-error">{error}</span>}
          <label htmlFor="admin-email" className="sr-only">Email</label>
          <input
            id="admin-email"
            type="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            autoFocus
          />
          <label htmlFor="admin-password" className="sr-only">Password</label>
          <input
            id="admin-password"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
          />
          <button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Access System'}
          </button>
        </form>
        <p className={`login-health login-health-${health}`}>
          {health === 'checking' && 'checking backend connectivity…'}
          {health === 'ok' && 'backend reachable ✓'}
          {health === 'unreachable' &&
            'backend unreachable ✗ — this network or a privacy extension is blocking supabase.co'}
        </p>
      </div>
    </div>
  );
}
