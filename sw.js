// Period — minimal service worker
// Its only job is letting the page show real notifications on mobile browsers
// (Android Chrome and others require this — they block `new Notification()`
// called directly from a page and require registration.showNotification()
// instead, which needs a service worker to exist).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Tapping a notification focuses the open tab instead of doing nothing.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
