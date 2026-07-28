'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const credentials = Object.fromEntries(
        new FormData(event.currentTarget)
      );

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          result?.error ||
            'Unable to sign in. Please check your credentials and try again.'
        );
        return;
      }

      router.push('/mis');
      router.refresh();
    } catch {
      setError(
        'The helpdesk could not be reached. Check your connection and try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="staff-login-shell">
      <div
        className="staff-login-watermark"
        aria-hidden="true"
      />

      <div className="staff-login-card">
        <div className="staff-login-form-panel">
          <div className="staff-login-form-wrap">
            <Link className="staff-login-back" href="/">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Employee portal
            </Link>

            <div className="staff-login-mobile-brand">
              <img
                src="/icclogo.png"
                alt="Immaculada Concepcion College logo"
              />
              <span>MIS Helpdesk</span>
            </div>

            <span className="staff-login-eyebrow">
              Authorized personnel
            </span>

            <h1>Welcome back</h1>
            <p className="staff-login-intro">
              Sign in to manage support requests, assignments, and
              accomplishment reports.
            </p>

            {error && (
              <div
                className="staff-login-error"
                role="alert"
                aria-live="polite"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v6" />
                  <path d="M12 17h.01" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submit}>
              <div className="staff-login-field">
                <label htmlFor="mis-username">Username</label>
                <div className="staff-login-input">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                  </svg>
                  <input
                    id="mis-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Enter your username"
                    required
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="staff-login-field">
                <label htmlFor="mis-password">Password</label>
                <div className="staff-login-input">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    id="mis-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                    disabled={busy}
                  />
                  <button
                    className="staff-login-password-toggle"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    aria-pressed={showPassword}
                    disabled={busy}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m3 3 18 18" />
                        <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                        <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 5a16 16 0 0 1-2.1 2.5" />
                        <path d="M6.6 6.6C4.4 8 3 10 3 10s3.5 5 9 5c1 0 2-.2 2.8-.5" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5Z" />
                        <circle cx="12" cy="12" r="2.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                className="staff-login-submit"
                type="submit"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="staff-login-spinner" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in to dashboard
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 12h14" />
                      <path d="m14 7 5 5-5 5" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <div className="staff-login-security">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3 5 6v5c0 4.6 2.9 8.8 7 10 4.1-1.2 7-5.4 7-10V6l-7-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>
                Restricted to authorized MIS personnel. Your session is
                securely protected.
              </span>
            </div>
          </div>
        </div>

        <aside className="staff-login-brand-panel">
          <div className="staff-login-brand-grid" aria-hidden="true" />
          <div className="staff-login-brand-orb" aria-hidden="true" />

          <div className="staff-login-brand-content">
            <div className="staff-login-logo">
              <img
                src="/icclogo.png"
                alt="Immaculada Concepcion College logo"
              />
            </div>

            <span>Immaculada Concepcion College</span>
            <h2>MIS Helpdesk</h2>
            <p>Management Information Systems Office</p>

            <div className="staff-login-brand-divider" />

            <blockquote>
              One workspace for receiving, assigning, tracking, and
              resolving institutional IT concerns.
            </blockquote>
          </div>

          <div className="staff-login-brand-footer">
            <span className="staff-login-status-dot" />
            Support operations portal
          </div>
        </aside>
      </div>
    </section>
  );
}
