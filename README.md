# TailWatch: Authentication + Traffic Monitoring

Privacy-first website analytics on top of the Authentication project.
Same structure as before: **Express MVC backend**, **React + Redux Toolkit frontend**, plus **Cloudflare Workers** and **ClickHouse** for the traffic pipeline.

```
Visitor's browser ──tw.js──▶ Collector Worker ──Queue──▶ Consumer Worker ──▶ ClickHouse
                              (checks, drops)            (bots, sessions,      (events, sessions,
                                   ▲                      dedupe, R2 archive)   dropped_hits, rollups)
                                   │ KV: site:<key>                                   │
Dashboard (React) ◀── Express API (Vercel) ── writes KV, reads ClickHouse ◀───────────┘
```

## Folders

| Folder | What it is |
|---|---|
| `backend/` | Express + TypeScript, MVC: `routes → controllers → services → repositories/models`. Auth, sites, setup/verify, stats, reports, account, crons. |
| `Frontend/` | React 19 + Redux Toolkit (RTK Query). API calls in `src/features/*Api.ts`, page logic in `src/hooks/**`, UI in `src/components/**`, pages in `src/pages/**`. |
| `workers/` | Cloudflare Workers (npm workspaces): `contract` (shared rules), `tracker-core` + `tracker` (tw.js), `collector`, `consumer`, `demo`. Each check lives in its own file. |
| `clickhouse/` | SQL: tables (`001`), and the three users: insert (`002`, consumer), read (`003`, dashboard), prune (`004`, retention/erasure). |
| `docs/` | `DEPLOY.md` (step by step), `reference/` (PLAN, BUILD-ORDER, queries, erasure notes). |

## How a hit is checked

**Collector** (`workers/collector/src`): method/size/body shape → site key in KV (60 s cache) → hostname allowed → rate limits (per site, per IP) → user-agent denylist, verifier agent, GPC → daily visitor hash (no IP stored) → queue.
Accepted or dropped, the answer is the same `204`, so nobody can probe which keys exist. Every drop is counted in `dropped_hits` with its reason.

**Consumer** (`workers/consumer/src`): raw batch archived to R2 first → precision checks (known bot list, headless-browser signals, referrer spam, datacentre ASN) → Durable Object state (sessions, 7-day dedupe) → ClickHouse insert with a dedup token → state committed last. Failures go to the DLQ, kept in R2 and replayed by the 15-minute cron.

## Run locally

```bash
# 1. Workers (collector + consumer on http://localhost:8787)
cd workers && npm install && npm run dev

# 2. Backend (http://localhost:5000)
cd backend && npm install && npm run dev        # uses backend/.env

# 3. Frontend (http://localhost:5173)
cd Frontend && npm install && npm run dev       # VITE_API_URL in Frontend/.env
```

For a fully local pipeline set `KV_MODE=local`, `KV_LOCAL_WORKERS_DIR=../workers`, `COLLECTOR_URL=http://localhost:8787` and a local ClickHouse in `backend/.env` (see `backend/.env.example`).

## Checks

```bash
cd workers  && npm run typecheck && npm test      # contract, tracker, collector, consumer tests
cd backend  && npx tsc --noEmit
cd Frontend && npx tsc -b && npm run lint && npm run build
```

## Deploy

See **[docs/DEPLOY.md](docs/DEPLOY.md)**: Workers to Cloudflare (`npm run deploy` in `workers/`), app to Vercel (one project at the repo root, `vercel.json`).
