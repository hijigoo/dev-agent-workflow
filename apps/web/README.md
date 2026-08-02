# Atlas Operations frontend

React, TypeScript, and Vite sample UI for meeting-room reservations and Mini Agent
operations.

## Run locally

Requires Node.js 20.19+.

```bash
npm install
npm run dev
```

Optional endpoint overrides can be copied from `.env.example` into `.env.local`:

- `VITE_API_URL` defaults to `http://localhost:8000`

When the room API is unavailable, the room finder uses clearly labeled demo
inventory. Reservation writes never fabricate success: failures are shown in the
interface. No secrets or credentials belong in Vite environment
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
`end` values.
