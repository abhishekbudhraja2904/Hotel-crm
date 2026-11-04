self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {} } catch (_) { d = { title: 'Hermora', body: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(d.title || 'Hermora', { body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: 'hermora-' + Date.now() }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => { for (const c of list) { if ('focus' in c) return c.focus() } return self.clients.openWindow('/') }))
})
