# SinceTimer

Track recurring events and get alerted when they're due.

## Project Structure

```
sincetimer/
├── backend/
│   ├── main.py              # FastAPI app + CORS + static mount
│   ├── database.py          # SQLAlchemy engine & session
│   ├── models.py            # Event ORM model
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── scheduler.py         # Background loop — alerts for due events
│   ├── routes/
│   │   ├── events.py        # CRUD: GET/POST/PUT/DELETE /events
│   │   └── calendar.py      # Google Calendar sync: POST/DELETE /calendar/{id}/sync
│   ├── requirements.txt
│   └── .env                 # DATABASE_URL
└── frontend/
    └── index.html           # React (CDN, no build step)
```

## Setup

### 1. Backend

```bash
cd sincetimer/backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

- API docs: http://localhost:8000/docs
- Frontend: http://localhost:8000/app

### 2. Google Calendar (optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Google Calendar API**
3. Create an **OAuth 2.0 Client ID** (Desktop app)
4. Download the JSON → save as `backend/credentials.json`
5. First call to `POST /calendar/{id}/sync` will open a browser auth flow and cache `token.pickle`

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/events/` | List all events |
| POST | `/events/` | Create event |
| GET | `/events/{id}` | Get single event |
| PUT | `/events/{id}` | Update event |
| DELETE | `/events/{id}` | Delete event |
| POST | `/calendar/{id}/sync` | Create/update Google Calendar event |
| DELETE | `/calendar/{id}/sync` | Remove Google Calendar event |

### Event body (POST /events/)

```json
{
  "name": "Oil Change",
  "last_event": "2024-12-01T00:00:00",
  "interval_days": 90
}
```

## Features

- **Time since last event** — computed live on every response
- **Due alerts** — `is_due: true` when `now >= last_event + interval_days`
- **Progress bar** — visual fill from 0% → 100% → red when overdue
- **Background scheduler** — logs due events to console every 60 seconds
- **Google Calendar sync** — creates/updates a calendar event on the due date, with "time since last event" in the description
- **Mark Done** — one-click sets `last_event` to now and resets the timer
