# Reading Feature

## Goal

Add a first-class reading tracker for pending articles, reading lists, and topic-based study links.

The feature should support:

- A dedicated `Reading` link in the header.
- A dedicated `/reading` page for tracking reading across topics.
- A separate dashboard section for pending reading items, apart from upcoming events.
- Link storage, notes, topic grouping, and reading status.

## Current Direction

Use the existing `entries` table rather than adding a new table in the first version.

Reading items should be saved as regular entries with:

- `category`: `reading`
- `title`: article/resource title
- `notes`: user notes
- `metadata.reading_url`: link to open
- `metadata.reading_topic`: topic/category for grouping
- `metadata.reading_status`: `to_read`, `reading`, or `done`
- `metadata.reading_priority`: optional priority

This keeps reading items searchable from the existing dashboard and allows the feature to reuse existing auth, CRUD, metadata, and history behavior.

Confirmed starter assumptions:

- Reading items will be stored in the existing `entries` table.
- Reading items will use category `reading`.
- A reading item is pending unless `metadata.reading_status` is `done`.
- Dashboard will show pending/in-progress reading items in a dedicated `Reading list` section.
- The Reading page will include quick add for link, topic, title, and notes.

Starter links:

- https://www.thenewatlantis.com/publications/we-live-like-royalty-and-dont-know-it
- https://www.capitalmind.in/insights/page/1
- https://collabfund.com/blog/lucky-vs-repeatable/
- https://zerodha.com/varsity/chapter/flexible-and-open-to-possibilities/

## Dashboard Behavior

Add a `Reading list` section separate from:

- Upcoming
- Due soon
- Today
- Overdue

Rules:

- Show entries where normalized category is `reading`.
- Include only items where `metadata.reading_status` is not `done`.
- Do not require `next_due_date`.
- Cards should prioritize title, topic, status, link, and short notes.

## Reading Page Behavior

Add `/reading` as a dedicated page from the header.

Initial page layout:

- Quick add form for title, URL, topic, status, priority, and notes.
- Pending and in-progress reading items grouped by topic.
- Done/completed items available in a separate section.
- Actions per item:
  - Open link
  - Mark as reading
  - Mark done
  - Edit notes/details

## Add/Edit Entry Behavior

When category is `reading`, show reading-specific fields:

- URL
- Topic
- Status
- Priority
- Notes

The existing universal fields can remain available where useful.

## Completion Behavior

For reading items:

- Marking done should set `metadata.reading_status` to `done`.
- It should update the entry's last logged date using the existing done/log behavior if we want it to appear in recently completed.
- It should not require a due date.

## Open Questions

- Should reading notes be a single notes field or multiple dated notes?
- Should topics be free text or managed options like areas/categories?
- Should quick add auto-fill the title from URL metadata later?
- Should reading items support estimated reading time?
- Should there be a `saved for later` status separate from `to_read`?

## Implementation Checklist

- [x] Add default category `reading`.
- [x] Add header nav link to `/reading`.
- [x] Create `Reading` page.
- [x] Add reading-specific fields in `AddEntry`.
- [x] Add dashboard `Reading list` section.
- [x] Add quick add form on Reading page.
- [x] Add mark reading / mark done actions.
- [ ] Decide and implement notes behavior.
- [x] Seed user's initial reading links after receiving them.

## Implemented First Version

- Added `reading` to default categories.
- Added reading-specific metadata fields in Add/Edit Entry.
- Added Dashboard `Reading list` section for non-done reading items.
- Added `/reading` page with quick add, grouped reading cards, open-link actions, and status actions.
- Seeded the four starter links as `to_read` reading entries.

Current notes behavior:

- Quick add stores notes in the existing entry `notes` field.
- Add/Edit Entry can also edit notes through the existing Notes panel.
- There is not yet dated/multi-note history for reading notes.
