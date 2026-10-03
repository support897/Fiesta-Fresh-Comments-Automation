/* Fiesta Fresh PWA Service Worker
 * Handles push notifications + offline caching
 */

const CACHE_NAME = 'fiesta-queue-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static, network-first for API/pages
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Skip non-GET and cross-origin API calls
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  // API routes: network only
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        // Cache successful static responses
        if (resp.ok && (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/icons/'))) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return resp;
      }).catch(() => caches.match('/'));
    })
  );
});

// Push: show notification
self.addEventListener('push', (event) => {
  let data = { title: 'Fiesta Fresh', body: 'New update', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) { /* use defaults */ }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
    tag: data.tag || 'fiesta-default',
    renotify: !!data.renotify,
    requireInteraction: !!data.requireInteraction,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click: open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});
