import { supabase } from './supabase';

type BrowserPushSupport = {
  supported: boolean;
  reason?: string;
};

const serviceWorkerPath = '/push-sw.js';
const serviceWorkerScope = '/';

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

export function getPushSupport(): BrowserPushSupport {
  if (!('serviceWorker' in navigator)) {
    return { supported: false, reason: 'Service workers are not supported in this browser.' };
  }
  if (!('PushManager' in window)) {
    return { supported: false, reason: 'Push notifications are not supported in this browser.' };
  }
  if (!('Notification' in window)) {
    return { supported: false, reason: 'Notifications are not supported in this browser.' };
  }
  if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) {
    return { supported: false, reason: 'Missing VITE_VAPID_PUBLIC_KEY.' };
  }
  return { supported: true };
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function getServiceWorkerRegistration() {
  const existing = await navigator.serviceWorker.getRegistration(serviceWorkerScope);
  if (existing) return existing;
  return navigator.serviceWorker.register(serviceWorkerPath, { scope: serviceWorkerScope });
}

export async function enablePushNotifications() {
  const support = getPushSupport();
  if (!support.supported) {
    throw new Error(support.reason ?? 'Push notifications are not available.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = await getServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    }));

  await savePushSubscription(subscription);
  return subscription;
}

export async function savePushSubscription(subscription: PushSubscription) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Please sign in before enabling notifications.');

  const subscriptionJson = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      subscription: subscriptionJson,
      user_agent: navigator.userAgent,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,endpoint' }
  );

  if (error) throw error;
}

export async function disablePushNotifications() {
  const registration = await navigator.serviceWorker.getRegistration(serviceWorkerScope);
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    await subscription.unsubscribe();
  }
}

export async function getCurrentPushSubscription() {
  if (!getPushSupport().supported) return null;
  const registration = await navigator.serviceWorker.getRegistration(serviceWorkerScope);
  return registration?.pushManager.getSubscription() ?? null;
}
