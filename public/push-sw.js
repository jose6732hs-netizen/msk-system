/* Service Worker exclusivo de notificações Push (não faz cache de app shell). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "Notificação", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Nova notificação";
  const options = {
    body: data.body || "",
    icon: data.icon || "/favicon.png",
    badge: "/favicon.png",
    image: data.image || undefined,
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { link: data.link || "/painel", notificationId: data.notificationId || null },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/painel";
  const target = new URL(link, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      for (const client of clientList) {
        if ("navigate" in client) return client.navigate(target).then((c) => c && c.focus());
      }
      return self.clients.openWindow(target);
    }),
  );
});
