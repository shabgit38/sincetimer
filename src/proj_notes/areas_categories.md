# Areas and Categories

Areas and categories organize entries throughout SinceTimer. An area describes
where an entry belongs; a category describes what kind of entry it is and can
enable category-specific fields and behavior.

## Areas

The built-in areas are:

- Home
- Work
- Personal
- Health

The app also recognizes **Plan** as an area for plan/goal entries. An entry is
treated as a plan when its area is `Plan`, or when its category is `Learning`,
`Habit`, or `Practice`.

## Categories

The built-in categories are:

- Routine
- Task
- Purchase
- Subscription
- Appointment
- Health record
- Learning
- Habit
- Practice
- Reading
- List

Users can add and rename areas and categories. Built-in options are seeded into
the signed-in user's option list when options are loaded; options are stored per
user. Renaming an option also updates entries that currently use its exact
stored name.

## Subscription category behavior

Use the built-in category **Subscription** when an entry represents a recurring
service or a consumption-based refill. The category activates the subscription
form and its associated tracking:

- **Fixed renewal** keeps the renewal schedule anchored to the subscription's
  start date. Logging an early payment records that payment but does not move
  the vendor's renewal anniversary.
- **Refill** starts the next interval from the date the refill is logged. The
  next expected refill date can also be adjusted in the entry form.
- Billing cycles are weekly, monthly, quarterly, or yearly. Fixed renewals also
  support a manually selected custom date.
- The entry's next due date is used for subscription reminders and due-date
  displays.
- Payment/refill history records the log date and price/currency. Logging a
  subscription also updates its current price; historical prices remain in the
  log.
- Subscriptions created before the renewal-type field existed, or without a
  valid saved type, are treated as **Fixed renewal**.
- The **Auto Renew** setting is tracking metadata; SinceTimer does not make
  payments or renew the service.

For consistent behavior across all subscription screens, keep the category
named **Subscription**. Some screens normalize category capitalization,
spacing, and hyphens, while the dashboard's completion action checks the
category more narrowly. Renaming it to a different category name can therefore
prevent some subscription-specific behavior from being applied.

Changing an entry from **Subscription** to another category removes the
subscription-specific form and tracking behavior when it is next saved. Review
the entry before changing its category if you need to retain its subscription
renewal type and payment/refill workflow.
