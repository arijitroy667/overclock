import { api } from "./api";

/** Browser push: supported everywhere but iOS Safari, where the site must be added to the Home Screen first. */
export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

const toBytes = (base64url: string) => {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

async function registration() {
  return navigator.serviceWorker.register("/sw.js");
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  return (await registration()).pushManager.getSubscription();
}

export async function subscribe(): Promise<void> {
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications are blocked in your browser settings.");
  const { vapid_public_key } = await api.pushKey();
  if (!vapid_public_key) throw new Error("This server has no push keys set up yet.");

  const subscription =
    (await currentSubscription()) ??
    (await (await registration()).pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toBytes(vapid_public_key),
    }));
  const { endpoint, keys } = subscription.toJSON() as { endpoint: string; keys: Record<string, string> };
  await api.addPush({ platform: "web", endpoint, keys });
}

export async function unsubscribe(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await api.removePush(subscription.endpoint).catch(() => {});
  await subscription.unsubscribe();
}
