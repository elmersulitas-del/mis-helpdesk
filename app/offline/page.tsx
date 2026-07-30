export default function OfflinePage() {
  return (
    <main className="pwa-offline-page">
      <section className="pwa-offline-card" aria-labelledby="offline-title">
        <img src="/icclogo.png" alt="Immaculada Concepcion College" />
        <p className="pwa-offline-eyebrow">MIS HELPDESK</p>
        <h1 id="offline-title">You&apos;re currently offline</h1>
        <p>
          An internet connection is required to securely load your tickets and
          send updates.
        </p>
        <a className="pwa-offline-retry" href="/">
          Try again
        </a>
      </section>
    </main>
  );
}
