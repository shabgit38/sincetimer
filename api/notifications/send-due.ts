import { createClient } from '@supabase/supabase-js';
import * as webpush from 'web-push';

type PushSubscriptionRecord = {
  id: string;
  user_id: string;
  endpoint: string;
  subscription: webpush.PushSubscription;
  timezone: string | null;
};

type ReminderEntry = {
  id: string;
  user_id: string;
  title: string;
  next_due_date: string;
  reminder_time: string | null;
  metadata: Record<string, unknown>;
};

type VercelRequest = {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com';
const cronSecret = process.env.CRON_SECRET;

function getHeader(request: VercelRequest, name: string) {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getQueryValue(request: VercelRequest, name: string) {
  const value = request.query[name];
  return Array.isArray(value) ? value[0] : value;
}

function isAuthorized(request: VercelRequest) {
  if (!cronSecret) return true;
  const authHeader = getHeader(request, 'authorization');
  const querySecret = getQueryValue(request, 'secret');
  return authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret;
}

function getLocalParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function getLocalDateKey(parts: ReturnType<typeof getLocalParts>) {
  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
}

function getReminderBeforeDays(metadata: Record<string, unknown>) {
  return typeof metadata.reminder_before_days === 'number' ? metadata.reminder_before_days : 0;
}

function getReminderDate(nextDueDate: string, reminderBeforeDays: number) {
  const date = new Date(`${nextDueDate.slice(0, 10)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - reminderBeforeDays);
  return date.toISOString().slice(0, 10);
}

function getReminderTime(value: string | null) {
  return /^\d{2}:\d{2}$/.test(value ?? '') ? value ?? '09:00' : '09:00';
}

function getReminderKeyTimestamp(reminderDate: string, reminderTime: string) {
  return new Date(`${reminderDate}T${reminderTime}:00.000Z`).toISOString();
}

function shouldSendReminder(entry: ReminderEntry, timezone: string, now = new Date()) {
  const reminderBeforeDays = getReminderBeforeDays(entry.metadata);
  const reminderDate = getReminderDate(entry.next_due_date, reminderBeforeDays);
  const reminderTime = getReminderTime(entry.reminder_time);
  const todayLocal = getLocalDateKey(getLocalParts(now, timezone));

  return {
    due: reminderDate === todayLocal,
    reminderAt: getReminderKeyTimestamp(reminderDate, reminderTime),
  };
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!isAuthorized(request)) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    response.status(500).json({ error: 'Missing notification server environment variables.' });
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: subscriptions, error: subscriptionError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, subscription, timezone');

  if (subscriptionError) {
    response.status(500).json({ error: subscriptionError.message });
    return;
  }

  const activeSubscriptions = (subscriptions ?? []) as PushSubscriptionRecord[];
  if (activeSubscriptions.length === 0) {
    response.status(200).json({ checked: 0, sent: 0 });
    return;
  }

  const userIds = [...new Set(activeSubscriptions.map((subscription) => subscription.user_id))];
  const { data: entries, error: entriesError } = await supabase
    .from('entries')
    .select('id, user_id, title, next_due_date, reminder_time, metadata')
    .eq('reminder_enabled', true)
    .not('next_due_date', 'is', null)
    .in('user_id', userIds);

  if (entriesError) {
    response.status(500).json({ error: entriesError.message });
    return;
  }

  let sent = 0;
  let skipped = 0;
  const reminderEntries = (entries ?? []) as ReminderEntry[];

  for (const subscription of activeSubscriptions) {
    const timezone = subscription.timezone || 'UTC';
    const userEntries = reminderEntries.filter((entry) => entry.user_id === subscription.user_id);

    for (const entry of userEntries) {
      const reminder = shouldSendReminder(entry, timezone);
      if (!reminder.due) {
        skipped += 1;
        continue;
      }

      const { data: existingDelivery, error: existingError } = await supabase
        .from('reminder_deliveries')
        .select('id')
        .eq('entry_id', entry.id)
        .eq('push_subscription_id', subscription.id)
        .eq('reminder_at', reminder.reminderAt)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existingDelivery) {
        skipped += 1;
        continue;
      }

      try {
        await webpush.sendNotification(
          subscription.subscription,
          JSON.stringify({
            title: 'GUIDR reminder',
            body: `Time to log: ${entry.title}`,
            url: `/entry/${entry.id}`,
          })
        );

        const { error: deliveryError } = await supabase.from('reminder_deliveries').insert({
          user_id: entry.user_id,
          entry_id: entry.id,
          push_subscription_id: subscription.id,
          reminder_at: reminder.reminderAt,
        });
        if (deliveryError) throw deliveryError;
        sent += 1;
      } catch (sendError) {
        const statusCode =
          typeof sendError === 'object' && sendError !== null && 'statusCode' in sendError
            ? Number((sendError as { statusCode?: number }).statusCode)
            : null;

        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', subscription.id);
        } else {
          console.error(sendError);
        }
      }
    }
  }

  response.status(200).json({ checked: activeSubscriptions.length, entries: reminderEntries.length, sent, skipped });
}
