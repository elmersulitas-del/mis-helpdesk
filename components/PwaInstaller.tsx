'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export default function PwaInstaller() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => registration.update())
        .catch(() => {
          // The portal remains fully usable in the browser if registration fails.
        });
    }

    if (isStandalone()) return;

    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setShowIosHelp(ios);
    setVisible(true);

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const handleInstalled = () => {
      setVisible(false);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) {
      setShowInstructions(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setVisible(false);
    setInstallPrompt(null);
  };

  if (!visible) return null;

  return (
    <>
      <button
        className="pwa-install-trigger"
        type="button"
        onClick={install}
        aria-haspopup={!installPrompt ? 'dialog' : undefined}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v11" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 20h14" />
        </svg>
        Install app
      </button>

      {showInstructions && (
        <div
          className="pwa-install-overlay"
          role="presentation"
          onClick={() => setShowInstructions(false)}
        >
          <section
            className="pwa-install-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pwa-install-dialog-logo">
              <img src="/icclogo.png" alt="" />
            </div>

            <span>MIS HELPDESK</span>
            <h2 id="pwa-install-title">Install the employee app</h2>

            {showIosHelp ? (
              <p>
                In Safari, tap the <b>Share</b> button, then choose{' '}
                <b>Add to Home Screen</b>.
              </p>
            ) : (
              <p>
                Open your browser menu <b>⋮</b>, then choose <b>Install app</b>{' '}
                or <b>Add to Home screen</b>.
              </p>
            )}

            <button
              className="pwa-install-dialog-close"
              type="button"
              onClick={() => setShowInstructions(false)}
            >
              Got it
            </button>
          </section>
        </div>
      )}
    </>
  );
}
