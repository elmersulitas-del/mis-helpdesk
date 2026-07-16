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

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setLoading(false);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn() {
    setError('');

    const supabase = getSupabaseBrowser();

    const { error: authError } =
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            hd: allowedDomain,
            prompt: 'select_account',
          },
        },
      });

    if (authError) {
      setError(authError.message);
    }
  }

  async function signOut() {
    await getSupabaseBrowser().auth.signOut();
    setSession(null);
  }

  if (loading) {
    return (
      <section className="split-login-page">
        <div className="split-login-card split-login-loading">
          <img
            src="/icclogo.png"
            alt="Immaculada Concepcion College logo"
          />

          <div className="split-login-spinner" />

          <p>Checking institutional account...</p>
        </div>
      </section>
    );
  }

  const email = session?.user.email?.toLowerCase() ?? '';
  const validDomain = email.endsWith(`@${allowedDomain}`);

  if (!session) {
    return (
      <section className="split-login-page">
        <div
          className="split-login-background-logo"
          aria-hidden="true"
        />

        <div className="split-login-card">
          <div className="split-login-google-panel">
            <div className="split-login-google-content">
              <span className="split-login-eyebrow">
                Employee Portal
              </span>

              <h1>Welcome!</h1>

              <p>
                Sign in using your institutional Google Workspace
                account to submit and monitor MIS support requests.
              </p>

              <div className="split-login-domain">
                <span>@</span>

                <div>
                  <b>Institutional accounts only</b>
                  <small>@{allowedDomain}</small>
                </div>
              </div>

              {error && (
                <div className="split-login-error">
                  {error}
                </div>
              )}

              <button
                type="button"
                className="split-google-button"
                onClick={signIn}
              >
                <span className="split-google-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
                    />

                    <path
                      fill="#34A853"
                      d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
                    />

                    <path
                      fill="#FBBC05"
                      d="M6.39 13.93A6 6 0 0 1 6.07 12c0-.67.12-1.32.32-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z"
                    />

                    <path
                      fill="#EA4335"
                      d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
                    />
                  </svg>
                </span>

                <span>Log in with Google</span>
              </button>

              <small className="split-login-note">
                Use your official Immaculada Concepcion College
                Google Workspace account.
              </small>
            </div>
          </div>

          <div className="split-login-brand-panel">
            <div className="split-login-brand-glow" />

            <div className="split-login-brand-content">
              <div className="split-login-logo-wrap">
                <img
                  src="/icclogo.png"
                  alt="Immaculada Concepcion College logo"
                />
              </div>

              <span>Immaculada Concepcion College</span>

              <h2>MIS Helpdesk</h2>

              <p>School IT Support Request System</p>

              <div className="split-login-brand-line" />

              <small>
                Submit concerns, track requests, and receive updates
                from the Management Information Systems Office.
              </small>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!validDomain) {
    return (
      <section className="split-login-page">
        <div className="split-login-card split-login-message-card">
          <img
            className="split-login-message-logo"
            src="/icclogo.png"
            alt="Immaculada Concepcion College logo"
          />

          <div className="split-login-warning-icon">!</div>

          <h2>Account not allowed</h2>

          <p>
            The account <b>{email || 'has no email address'}</b> is
            not an @{allowedDomain} institutional account.
          </p>

          <button
            type="button"
            className="split-login-signout"
            onClick={signOut}
          >
            Sign out and choose another account
          </button>
        </div>
      </section>
    );
  }

  const fullName =
    session.user.user_metadata?.full_name ||
    session.user.user_metadata?.name ||
    email.split('@')[0];

  return (
    <section className="employee-portal-content">
      <header className="employee-portal-header">
        <div className="employee-portal-brand">
          <img
            src="/icclogo.png"
            alt="Immaculada Concepcion College logo"
          />

          <div>
            <b>MIS Helpdesk</b>
            <span>School IT Support Request System</span>
          </div>
        </div>
      </header>

      <div className="card account-card employee-account-card">
        <div className="employee-account-info">
          <div className="employee-account-avatar">
            {fullName.charAt(0).toUpperCase()}
          </div>

          <div>
            <b>{fullName}</b>
            <div className="muted">{email}</div>
          </div>
        </div>

        <button
          className="btn secondary"
          type="button"
          onClick={signOut}
        >
          Sign out
        </button>
      </div>

      <TicketForm
        session={session}
        fullName={fullName}
        email={email}
      />
    </section>
  );
}