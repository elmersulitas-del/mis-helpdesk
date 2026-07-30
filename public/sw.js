const CACHE_NAME = 'icc-mis-helpdesk-v3';
const OFFLINE_ASSETS = ['/offline', '/icclogo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache authenticated pages, ticket data, tracking links, or API calls.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/mis') ||
    url.pathname.startsWith('/track')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline')),
    );
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/icclogo.png'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

self.addEventListener('push', (event) => {
  const fallback = {
    title: 'New MIS support request',
    body: 'A new support ticket needs attention.',
    tag: 'mis-new-ticket',
    url: '/mis',
  };

  let data = fallback;
  try {
    data = event.data ? { ...fallback, ...event.data.json() } : fallback;
  } catch {
    data = fallback;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icclogo.png',
      badge: '/icclogo.png',
      tag: data.tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [250, 120, 250, 120, 400],
      data: { url: data.url || '/mis' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || '/mis',
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );

        if (existing) {
          existing.navigate(targetUrl);
          return existing.focus();
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});
