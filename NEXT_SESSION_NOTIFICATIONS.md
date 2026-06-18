# Next Session: Notifications

Current status as of 2026-06-19:
- Push notification code exists: Settings UI, service worker, Supabase tables, Vercel cron, and `/api/notifications/send-due`.
- Supabase check showed:
  - `push_subscriptions`: 0
  - reminder-enabled entries: 8
  - `reminder_deliveries`: 0
- Nothing can deliver until a browser/device is registered from Settings.
- Plan reminders currently depend on `entries.next_due_date`, not direct `plan_sessions`.

Next steps:
1. Enable notifications in Settings on the target browser/device.
2. Verify `push_subscriptions` gets a row.
3. Test `/api/notifications/send-due`.
4. Decide whether plan reminders should use `plan_sessions` directly instead of `entries.next_due_date`.
