'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSED_KEY = 'mis-pwa-install-dismissed';

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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // The portal remains fully usable in the browser if registration fails.
      });
    }

    if (isStandalone()) return;

    const dismissed = window.localStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (ios) {
      setShowIosHelp(true);
      setVisible(true);
    }

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

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, 'true');
    setVisible(false);
  };

  const install = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setVisible(false);
    setInstallPrompt(null);
  };

  if (!visible) return null;

  return (
    <aside className="pwa-install-card" aria-label="Install MIS Helpdesk app">
      <div className="pwa-install-icon" aria-hidden="true">
        <img src="/icclogo.png" alt="" />
      </div>
      <div className="pwa-install-copy">
        <strong>Install MIS Helpdesk</strong>
        {showIosHelp ? (
          <p>
            For faster access, tap <b>Share</b>, then choose{' '}
            <b>Add to Home Screen</b>.
          </p>
        ) : (
          <p>Open the employee portal directly from your phone&apos;s home screen.</p>
        )}
      </div>
      {installPrompt && (
        <button className="pwa-install-button" type="button" onClick={install}>
          Install app
        </button>
      )}
      <button
        className="pwa-install-close"
        type="button"
        aria-label="Dismiss install suggestion"
        onClick={dismiss}
      >
        ×
      </button>
    </aside>
  );
}
