// sw.js — Service Worker SportsDecrypté
// Gère les notifications push Web Push

self.addEventListener('push', function(event) {
  if (!event.data) return;

  var data = {};
  try { data = event.data.json(); } catch(e) { data = { title: 'SportsDecrypté', body: event.data.text() }; }

  var title = data.title || 'SportsDecrypté 📡';
  var options = {
    body: data.body || 'Value bet détecté !',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-72.png',
    tag: data.tag || 'radar-alert',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/Radar.html' },
    actions: [
      { action: 'view', title: '👁️ Voir le pari' },
      { action: 'close', title: 'Ignorer' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'close') return;

  var url = (event.notification.data && event.notification.data.url) || '/Radar.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Si l'app est déjà ouverte, la mettre au premier plan
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Sinon ouvrir une nouvelle fenêtre
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
