# Handoff Notes

## 2026-07-07

### Payment and subscription totals feature

Goal for next session:
- Add spend/payment summaries for subscriptions and purchases.
- Show individual total spent for each subscription on the entry detail page.
- Improve or keep purchase total spent on the entry detail page.
- Show dashboard totals for the currently visible/filtered entries:
  - subscriptions total
  - purchases total
  - combined total
- Show individual total spent on subscription/purchase rows in the dashboard.

Open product decision:
- Missing log prices need a rule:
  - Option A: use current entry price as fallback for missing subscription/purchase log prices.
  - Option B: count only explicitly recorded log prices and show a missing-price count.

Current implementation context:
- `entry_logs.price` and `entry_logs.currency` exist and are used for subscription history rows.
- `getHistoryForEntries(entryIds)` was added in `src/lib/db.ts` for batched dashboard history reads.
- Dashboard already loads subscription history to calculate latest payment dates.
- Entry detail already loads history for the selected entry.
- Subscription latest-payment timing is now aligned between dashboard and entry detail.
- History rows now display actual date, duration, and `Entry price:` or `Log price:`.
- History edit path now verifies Supabase updated a row and shows specific errors.

Current data note:
- `ChatGpt Plus` June 18, 2026 log was directly updated to `2050 INR` in Supabase.
- `gas received` start date was directly updated to October 18, 2025 in Supabase.

Known unrelated verification issue:
- `npm.cmd run build` passes.
- `npm.cmd run lint` still fails on existing `src/components/plans/PlanCalendar.tsx:49` because of `react-hooks/set-state-in-effect`.
