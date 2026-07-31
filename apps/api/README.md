# Meeting Operations API

Sample FastAPI service for meeting-room discovery and reservations. It seeds four
deterministic rooms, persists data in SQLite, treats reservation ranges as
half-open intervals `[start, end)`, and stores timestamps in UTC.

```bash
cd apps/api
python -m pip install -e '.[test]'
uvicorn meeting_api.main:app --reload --port 8000
pytest
```

Set `MEETING_API_DATABASE` to select the SQLite file. Endpoints:

- `GET /health`
- `GET /rooms?min_capacity=8&required_equipment=video&equipment=whiteboard&q=bor`
- `POST /reservations`, `GET /reservations`, `DELETE /reservations/{id}`
- `POST /reservations/{id}/cancel` (action-style cancel alias)
- `GET /metrics/quality` (aggregate operational metrics only)

Reservation timestamps must include a UTC offset or `Z`. Localhost and
127.0.0.1 web origins (on any port) are enabled through CORS.
