# Deploy guide

Two parts:
1. **Cloudflare**: the Workers (collector, consumer), KV, Queues, R2.
2. **Vercel**: one project serving the dashboard and the Express API (`/api/*`), plus 3 daily crons.

ClickHouse Cloud and MongoDB Atlas are already running; you only need their URLs and passwords.

> Never commit `.env`, `.dev.vars` or any password. `.gitignore` already excludes them.

---

## 1. ClickHouse (one time)

Already done if your live service has the `tailwatch` database. Otherwise, in the ClickHouse Cloud SQL console run, in order:

1. `clickhouse/001_contract.sql`: database and tables.
2. `clickhouse/002_insert_user.sql`: `tw_insert` (the consumer writes with it).
3. `clickhouse/003_read_user.sql`: `tw_read` (the dashboard reads with it).
4. `clickhouse/004_prune_user.sql`: `tw_prune` (retention and erasure).

Replace each `REPLACE_WITH_A_LONG_RANDOM_PASSWORD` with your own password before running it.

## 2. Cloudflare Workers

```bash
cd workers
npm install
npx wrangler login                     # opens the browser once
```

Create the resources once (skip any that already exist: your live KV id is already in `collector/wrangler.toml`):

```bash
npx wrangler kv namespace create SITE_CONFIG          # put the id in collector/wrangler.toml
npx wrangler queues create tailwatch-events
npx wrangler queues create tailwatch-events-dlq
npx wrangler r2 bucket create tailwatch-raw
```

Set the consumer's ClickHouse settings:
- `consumer/wrangler.toml` → `CLICKHOUSE_URL` (your `https://…clickhouse.cloud:8443`) and `CLICKHOUSE_USER = "tw_insert"`.
- The password is a secret:

```bash
npx wrangler secret put CLICKHOUSE_PASSWORD -c consumer/wrangler.toml
```

Deploy (consumer first, so the queue has a reader):

```bash
npm run typecheck && npm test
npm run deploy                 # = deploy:consumer, then deploy:collector (builds tw.js into the collector)
```

Wrangler prints the collector URL, e.g. `https://tailwatch-collector.<account>.workers.dev`. That is `COLLECTOR_URL` for the backend.

Check it:

```bash
curl -I https://tailwatch-collector.<account>.workers.dev/tw.js     # 200, javascript
```

## 3. Cloudflare API token (backend → KV)

The backend writes `site:<key>` entries when a site is verified, a key is added/revoked, or a site is paused/deleted.
Cloudflare dashboard → My Profile → API Tokens → Create token → **Workers KV Storage: Edit** for your account.
Put it in `CF_API_TOKEN`, plus `CF_ACCOUNT_ID` and `CF_KV_NAMESPACE_ID`.

## 4. Vercel

1. Push this folder to GitHub (the `.gitignore` keeps secrets out).
2. Vercel → Add New Project → import the repo. **Root directory: the repo root** (not `backend/` or `Frontend/`).
   `vercel.json` already sets:
   - install: `npm ci --prefix backend && npm ci --prefix Frontend`
   - build: Frontend build with `VITE_API_URL=/api/v1`, then `backend/scripts/build-vercel.mjs`, which writes `.vercel/output` (static dashboard + one Node 22 function for `/api/*` + crons)
3. Settings → Environment Variables: add **every variable from `backend/.env`**, with these changes:
   - `CLIENT_URL` = your Vercel address, e.g. `https://your-project.vercel.app` (comma-separate several, e.g. a custom domain too)
   - `NODE_ENV` = `production`
   - `KV_MODE` = `cloudflare`
   - remove `TAILWATCH_SKIP_DOMAIN_CHECK`, `VERIFIER_ALLOW_PRIVATE`, `KV_LOCAL_WORKERS_DIR` if present
   - `CRON_SECRET`: keep it; Vercel sends it to the crons automatically
4. MongoDB Atlas → Network Access: allow `0.0.0.0/0` (Vercel has no fixed IP), or use Atlas' Vercel integration.
5. Deploy. Then open `https://your-project.vercel.app/api/v1/meta`: it should show your collector URL.

### Crons (in `.vercel/output/config.json`)

| Path | When (UTC) | Does |
|---|---|---|
| `/api/v1/internal/health` | 01:23 | site health (broken / quiet / recovered e-mails), spike and pipeline checks |
| `/api/v1/internal/maintenance` | 02:41 | erasures, retention pruning, old reports |
| `/api/v1/internal/reconcile` | 03:17 | retries KV entries that did not sync |

Vercel Hobby allows one run per day per cron; on Pro you can make them more frequent.

## 5. After deploy: smoke test

1. Sign up, verify the e-mail, log in.
2. Add your site → copy the script into `<head>` → publish → Verify. All 7 checks must be green.
3. Open your site in a normal browser. Within a minute: Overview → Active now / Latest hits.
4. Suspicious activity: open the site with `curl` → a `Bot` drop appears.
5. Reports → Create & download: the CSV downloads.

## Troubleshooting

| Problem | Fix |
|---|---|
| Banner "changes have not reached the collector" | `CF_API_TOKEN` missing or lacks KV Edit. Fix it, press Retry now. |
| Dashboard "analytics database did not answer" | `CLICKHOUSE_URL` / `CLICKHOUSE_READ_PASSWORD` wrong, or the ClickHouse service is idle (it wakes on the next query). |
| Verify fails at "Script loads" | `COLLECTOR_URL` in the backend differs from the URL in the snippet, or the collector is not deployed. |
| No events, drops show `not_found` | The site key is not in KV: Settings → retry sync, or re-verify the site. |
| Consumer logs `clickhouse 516` | Wrong `CLICKHOUSE_PASSWORD` secret on the consumer. |
