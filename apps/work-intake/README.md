# Local Work Intake API

FastAPI fallback for converting operational requests into durable work items.
Without credentials it stores a GitHub issue preview locally in SQLite. With
both credentials configured, it creates a real issue through GitHub's HTTPS API.
`external_key` is unique, so retries return the original work item and never
create a second issue.

```bash
cd apps/work-intake
python -m pip install -e '.[test]'
uvicorn work_intake.main:app --reload --port 8001
pytest
```

Configuration:

- `WORK_INTAKE_DATABASE`: SQLite path (defaults inside this app)
- `GITHUB_TOKEN`: token with permission to create issues
- `GITHUB_REPOSITORY`: `owner/repository`

Leave both GitHub variables unset for local preview mode. Setting only one is an
explicit service-configuration error.

Endpoints:

- `GET /health`
- `POST /work-items` or `POST /github/issues`
- `GET /work-items`, `GET /work-items/{id}`
- `POST /webhooks/jira/normalize` (also available as `POST /webhooks/jira`)

Localhost and 127.0.0.1 web origins on any port are enabled through CORS.
