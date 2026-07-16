'use client';

import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import TicketForm from '@/components/TicketForm';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

const allowedDomain = 'immaculada.edu.ph';

export default function EmployeePortal() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn() {
    setError('');
    const supabase = getSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          hd: allowedDomain,
          prompt: 'select_account',
        },
      },
    });

    if (authError) setError(authError.message);
  }

  async function signOut() {
    await getSupabaseBrowser().auth.signOut();
    setSession(null);
  }

  if (loading) {
    return <div className="card"><p>Checking institutional account…</p></div>;
  }

  const email = session?.user.email?.toLowerCase() ?? '';
  const validDomain = email.endsWith(`@${allowedDomain}`);

  if (!session) {
    return (
      <div className="card">
        <h2>Employee Login</h2>
        <p className="muted">
          Sign in using your <b>@{allowedDomain}</b> Google Workspace account before submitting a ticket.
        </p>
        {error && <div className="notice error">{error}</div>}
        <button className="btn" type="button" onClick={signIn}>Continue with Google</button>
      </div>
    );
  }

  if (!validDomain) {
    return (
      <div className="card">
        <h2>Account not allowed</h2>
        <div className="notice error">
          The signed-in account <b>{email || 'has no email address'}</b> is not an @{allowedDomain} institutional account.
        </div>
        <button className="btn secondary" type="button" onClick={signOut}>Sign out</button>
      </div>
    );
  }

  const fullName =
    session.user.user_metadata?.full_name ||
    session.user.user_metadata?.name ||
    email.split('@')[0];

  return (
    <>
      <div className="card account-card">
        <div>
          <b>{fullName}</b>
          <div className="muted">{email}</div>
        </div>
        <button className="btn secondary" type="button" onClick={signOut}>Sign out</button>
      </div>
      <TicketForm session={session} fullName={fullName} email={email} />
    </>
  );
}
