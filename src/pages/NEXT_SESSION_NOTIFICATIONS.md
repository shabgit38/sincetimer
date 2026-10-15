# Push Notifications: Implementation and Verification

## Current implementation

- Users enable or disable browser push notifications from **Settings**.
- The browser subscription is stored in Supabase `push_subscriptions`; the service worker is `public/push-sw.js`.
- Vercel schedules `/api/notifications/send-due` daily using the cron entry in `vercel.json`.
- The API sends due reminders for reminder-enabled entries using `entries.next_due_date`, `reminder_time`, and reminder metadata.
- Reading entries also have a daily digest path in the notification API.
- Delivery records are stored in `reminder_deliveries` to prevent duplicate sends.

## Goal-session reminder limitation

Goal reminders currently use the goal entry's `next_due_date`. The notification job does not query `plan_sessions` directly. The goal's next due date is refreshed from scheduled sessions when plan-session operations update the goal. If reminders need to track session-specific dates or statuses more directly, that should be designed as a separate change.

## Verification checklist

1. Deploy with the required Supabase service credentials and Web Push VAPID configuration set as server environment variables.
2. Sign in and enable notifications in Settings on the browser/device to be tested; confirm that the subscription is registered.
3. Confirm the deployed Vercel cron invokes `/api/notifications/send-due`.
4. Test a due reminder and a Reading digest, then verify successful delivery and corresponding `reminder_deliveries` records.
5. Test disabling notifications and confirm that the browser subscription is removed.

Do not record user-specific subscription counts or individual entry changes here; those are temporary operational observations and quickly become stale.
