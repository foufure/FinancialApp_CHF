# FinancialApp_CHF

Helvetia Markets is a dependency-light MVP for browsing global stocks and ETFs with a CHF-first lens.

## Run locally

Install Node.js 18+ and serve the repository with Vercel's local runtime or any static file server:

```bash
npm install
npm test
npm run build
```

The alert rule engine is covered by Node's built-in test runner:

```bash
npm test
```

## MVP scope

- CHF-denominated and CHF-hedged ETF prioritisation across Swiss, European and worldwide markets.
- Worldwide stocks with trading-currency prices and CHF-adjusted performance side by side.
- Dashboard alert evaluation for split-adjusted historical-high discounts (default 10%), configurable rolling declines (default 5%, provider supplies a 1-day-to-1-month window), and CHF ETF dividend events.
- `buildEmailAlertPayload` provides a provider-neutral email payload; delivery is intentionally not attempted without market-data and email credentials.
- The dashboard's research candidates are a transparent, rule-based ranking for further research—not personalized financial advice or unconditional buy recommendations. Scores consider CHF denomination/hedging, all-time drawdown, recent rolling decline, dividend status, diversification/type, and quote data quality. Unhedged non-CHF instruments are explicitly flagged.

## Production boundaries

- `api/lib/eodhd.js` is the server-only EODHD adapter. It reads `EODHD_API_TOKEN`, keeps the token out of browser code, normalizes the curated universe, and exposes a search extension point through `/api/search?q=...`.
- `api/alerts/run.js` evaluates the all-time split-adjusted closing high rule and the highest close in a selected 1–30 day window, then sends matching alerts through Resend. It requires `RESEND_API_KEY`, `ALERT_FROM_EMAIL` and `ALERT_TO_EMAIL` and returns explicit missing-config errors.
- `api/admin/diagnostics.js` is an admin-only, token-gated smoke test for `NESN.SW` (SIX) and `EURCHF.FOREX`. Set `ADMIN_DIAGNOSTIC_TOKEN` in Vercel, then call it with `x-admin-diagnostic-token`; the response contains only status, row count, date, close and adjusted-close presence. It never returns the EODHD token or upstream response body.
- `vercel.json` schedules the alert run once each weekday trading day at 18:00 UTC. Change the Vercel cron expression for a different schedule; `ALERT_SCHEDULE` labels the configured schedule.
- `vercel.json` explicitly sets `outputDirectory` to `.` and `buildCommand` to `npm run build`. This is intentional: the app's `index.html`, `styles.css`, and `src/` are at repository root, while `api/` remains deployed as serverless functions. Do not set the Vercel Output Directory to `public`, `dist`, or `build`.
- `.env.local` is intentionally gitignored. Copy `.env.example` and supply local values. In production, put the same secrets in Vercel Environment Variables. Supabase variables are reserved for persistence/auth and alert deduplication in the next slice.

No real market-data or email credentials are included in this repository.

## Deployment verification

1. In Vercel, confirm the project is connected to this repository and that the **Root Directory** is the repository root (the folder containing `index.html`, `api/`, and `vercel.json`).
2. In **Build and Deployment Settings**, set **Framework Preset** to `Other`, **Build Command** to `npm run build`, **Output Directory** to `.`, and **Install Command** to `npm install` (or leave the install command default). Clear any `public` value; the repository does not contain a `public` directory.
3. Redeploy the current `main` commit after adding all variables to the **Production** environment. A 404 at `/` and `/api/instruments` means the URL is not serving this repository or the deployment has not been created; it is not an EODHD response.
4. Verify the public routes: `/`, `/api/instruments`, and `/api/search?q=NESN`.
5. Verify the protected diagnostic locally or in a secure shell. Never put the token in a URL, browser history, screenshot, commit, or chat:

```bash
curl -H "x-admin-diagnostic-token: $ADMIN_DIAGNOSTIC_TOKEN" \
  https://financial-app-chf.vercel.app/api/admin/diagnostics
```
