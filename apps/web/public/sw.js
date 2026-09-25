// Shows reminders sent by the server while the site is closed (§7 Pillar 2).
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Overclock", {
      body: payload.body || "",
      tag: "overclock-reminder", // one reminder replaces the last, rather than stacking up
      badge: "/favicon.ico",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((open) => {
      const existing = open.find((c) => "focus" in c);
      return existing ? existing.focus() : clients.openWindow("/");
    }),
  );
});
