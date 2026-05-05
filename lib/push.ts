import webpush from "web-push";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  webpush.setVapidDetails("mailto:healthos@local.dev", publicKey, privateKey);
}

export async function sendPush(subscription: any, payload: unknown) {
  if (!publicKey || !privateKey || !subscription) return;
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
