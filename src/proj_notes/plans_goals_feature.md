# Plans and Goals

This guide describes the Goals feature as it works in the app today. A goal represents a repeated activity over a date range, such as learning economics, practicing Spanish, or doing yoga. Its schedule creates sessions; each session can be tracked separately.

## 1. Goals page

Open **Goals** to see your plans. Each goal card shows:

- The goal name, area, and type (Learning, Practice, or Habit).
- Its start and end dates.
- How soon the next scheduled session is due.
- Progress, completed-session count, scheduled-session count, and missed-session count.
- A favorite control, an edit shortcut, and an expand/collapse control.

Expand a goal to see its session cards. The session list is ordered by date and may show a limited window around the next upcoming session when a plan has many sessions.

## 2. Creating or editing a goal

Choose **Add Goal**, or use the edit icon on an existing goal. The form includes:

- **Goal name, area, and type:** Identify what the plan is for and whether it is Learning, Practice, or Habit.
- **Start and end dates:** Define the date range in which sessions are generated.
- **Frequency and schedule:** Choose one of the supported recurrence modes:
  - Every N days
  - Every N months
  - Selected days of the week
  - Every N weeks
  - A selected day of each month
  - A specific date
- **Session minutes:** Store the planned duration for a session.
- **Status:** Set the goal to Active, Paused, or Completed.
- **Topic backlog:** Collect ideas relevant to this goal. Separate topics with a blank line. A single line break or comma remains part of the same topic. The backlog is not connected to the app's separate todo list.
- **Notes:** Add optional details about the goal.

Use **Save** to submit the form. The top-of-form and bottom-of-form save buttons perform the same action. **Close** and the Back button return to the previous Goals or Dashboard destination without saving unsaved changes.

## 3. How the schedule works

When a goal is created, the app generates scheduled sessions for recurrence dates between the start and end dates. The schedule determines the dates only; backlog topics are not automatically assigned.

When an existing goal's start date, end date, type, or schedule changes, the app regenerates its scheduled sessions from today onward. Past sessions and sessions with non-scheduled statuses are retained. If a generated session has the same date as an existing upcoming scheduled session, its title and metadata (including a manually selected topic) are preserved.

Changing only the topic backlog does not regenerate the schedule.

## 4. Choosing a topic for a session

Each session card has a topic dropdown:

- **Select topic** means no topic is assigned.
- Choose an item to assign it to that session. The session title becomes the goal name followed by the topic.
- Choose **Select topic** again to clear the assignment; the title returns to the goal name.
- Selecting a topic saves it to that session. The calendar updates that card without reloading the entire Goals page.
- The dropdown is locked for sessions dated before today. Historical topic assignments are preserved.

Only current backlog items are listed. If an upcoming session has an old assignment that is no longer in the backlog, the app clears that orphaned assignment and restores the goal-name title when Goals is loaded.

## 5. Session actions

Each session card displays its date and status. For editable sessions, available actions include:

- **Done:** Mark the session completed and record an effort level:
  - **MVP:** Watch 20 minutes.
  - **Normal:** 40 minutes plus notes.
  - **Deep:** 60–90 minutes plus problems.
- **Missed:** Mark the session missed.
- **Edit:** Change its date, status, or notes.
- **Delete:** Permanently remove that session after confirmation.

Scheduled sessions earlier than today are automatically marked missed when plans are loaded. Updating a session's date or status refreshes the goal data and next due date.

## 6. Understanding the metrics

- **Done: X/Y** means completed sessions divided by all sessions recorded for the goal.
- **Scheduled** counts sessions whose current status is Scheduled.
- **Missed** counts sessions whose current status is Missed.
- **Progress** is completed sessions divided by all sessions, rounded to a whole percentage.

The denominator in **Done** includes every session status, not just scheduled sessions. For example, completed + scheduled + missed may add up to the denominator; deleted sessions do not count.

## 7. Data and current limitations

- Goal details, including the topic backlog and schedule settings, are stored in the goal entry's metadata.
- Individual sessions are stored separately and keep their own date, status, title, notes, and metadata.
- The backlog is a manual list; it does not import, synchronize, or create tasks in the todo list.
- The current feature does not automatically build spaced-repetition schedules, calculate streaks, recommend topics, or reschedule missed sessions.
