# Atlas Operations frontend

React, TypeScript, and Vite sample UI for meeting-room reservations, Cloud Agent
operations, and guided work intake.

## Run locally

Requires Node.js 20.19+.

```bash
npm install
npm run dev
```

Optional endpoint overrides can be copied from `.env.example` into `.env.local`:

- `VITE_API_URL` defaults to `http://localhost:8000`
- `VITE_WORK_INTAKE_URL` defaults to `http://localhost:8001`

When the room API is unavailable, the room finder uses clearly labeled demo
inventory. Reservation and work-item writes never fabricate success: failures are
shown in the interface. No secrets or credentials belong in Vite environment
variables because `VITE_*` values are included in the browser bundle.

## Commands

```bash
npm run test
npm run lint
npm run build
```

## Expected API routes

The meeting service supports `GET /rooms`, `GET/POST /reservations`, and
`DELETE /reservations/:id`. Reservation writes use timezone-aware ISO `start` and
`end` values. The work intake service supports `POST /work-items` and returns a
`work_item` with delivery status, GitHub Issue preview, and optional URL.
