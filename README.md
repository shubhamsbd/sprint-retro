# Sprint Retrospective

Real-time sprint retrospective for agile teams. Built with **React + Vite + TypeScript + Tailwind** and **Vercel Serverless Functions** (SSE + REST).

Standalone project at `Workspace/sprint-retrospective` (sibling to other repos like `tbd` and `planning-poker`).

## Features

- Create or join a room with a shareable code
- Three-column board: What went well, What to improve, Action items
- Real-time sticky notes with participant avatars
- Facilitator controls: phase stepper (Collect → Vote → Discuss → Done)
- Dot voting on cards during the vote phase
- Countdown timer (facilitator-controlled)
- Group similar cards and ungroup merged cards
- Export markdown summary to clipboard
- Password-protected rooms
- Session restore on page reload

## Quick start (local)

```bash
cd sprint-retrospective
npm install
npm install --prefix client
npm run dev
```

- App: http://localhost:5175
- API (local dev server): http://localhost:3000/api

Open the app in two browser tabs to simulate a team session. Local dev uses a lightweight Express server (`scripts/dev-server.ts`) — no Vercel CLI login required.

## Project structure

```
sprint-retrospective/
├── api/      # Vercel serverless routes
├── client/   # Vite React frontend
├── lib/      # Shared room logic
├── scripts/  # Local Express dev server
├── vercel.json
└── package.json
```

## Deploy to Vercel

1. Push this repo to GitHub (or connect your local project).
2. Import the project in [Vercel](https://vercel.com/new).
3. Use the defaults from `vercel.json` (no extra build settings required).
4. Add a **Redis store** so rooms survive across serverless invocations and page reloads:
   - In the Vercel project, open **Storage** → **Create Database** → **Redis** (Official Redis for Vercel) or **Upstash** → Redis.
   - Connect it to the project. Vercel injects connection env vars automatically (`REDIS_URL` for Official Redis, or `KV_REST_API_URL` / `KV_REST_API_TOKEN` for Upstash).
5. Redeploy.

Without Redis linked, each API route runs in an isolated function with its own memory — rooms created on one route are invisible to others, and reload will show "Room not found". The app integrates Redis in `lib/roomPersistence.ts`.

The frontend and API are served from the same Vercel project — no separate backend host is needed.

## Environment

| Variable | Default | Where |
| -------- | ------- | ----- |
| `VITE_API_URL` | `` (same origin) | client — set only if the API is on another origin |
| `KV_REST_API_URL` | — | Vercel Upstash — set automatically when linked |
| `KV_REST_API_TOKEN` | — | Vercel Upstash — set automatically when linked |
| `REDIS_URL` | — | Official Redis for Vercel — set automatically when linked |
| `UPSTASH_REDIS_REST_URL` | — | Alternative to `KV_*` (Upstash direct) |
| `UPSTASH_REDIS_REST_TOKEN` | — | Alternative to `KV_*` (Upstash direct) |

In local dev, leave `VITE_API_URL` empty; Vite proxies `/api` to the local dev server on port 3000. Redis is optional locally — without it, the dev server uses in-memory storage (fine for single-process development).

## Retrospective flow

1. **Collect** — everyone adds sticky notes to the three columns
2. **Vote** — team dot-votes on the most important items
3. **Discuss** — facilitator groups related cards; team discusses top items
4. **Done** — read-only; export the markdown summary

## API overview

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/health` | Health check |
| POST | `/api/rooms/create` | Create room |
| POST | `/api/rooms/join` | Join room |
| GET | `/api/rooms/:id/info` | Public room metadata |
| GET | `/api/rooms/:id/stream` | SSE real-time state |
| POST | `/api/rooms/:id/:action` | Room mutations (add-card, vote-card, set-phase, etc.) |
