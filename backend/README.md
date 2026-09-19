# Backend — INE Product Price Tracker

## Scheduled Scraping

This backend exposes an endpoint intended for invocation by an external cron service (e.g. cron-job.org) to run scheduled scrapes.

- Endpoint: `POST /api/tracked-products/refresh-all`
- Authentication: send the secret in an HTTP header `x-cron-secret: <CRON_SECRET>` or as a Bearer token in `Authorization: Bearer <CRON_SECRET>`.
- Schedule: call every 2 hours.
- Behavior: the endpoint processes tracked products where `is_active = true`, scrapes each via the existing Playwright-based scraper, updates `tracked_products`, inserts `price_history`, and records per-attempt rows in `scrape_logs`.
- Failure handling: per-product failures are logged and do not stop the remaining products from being processed. Failed scrapes do NOT create price history or overwrite previous valid product state.

## Environment

- Set `CRON_SECRET` in the deployment environment. Do NOT commit real secrets to source control or expose them to the frontend.
- Example environment file: `../.env.example`.

## Cron-job.org configuration (after deployment)

- Method: `POST`
- URL: `https://<YOUR_PRODUCTION_BACKEND_URL>/api/tracked-products/refresh-all`
- Header: `x-cron-secret: <CRON_SECRET>`
- Schedule: Every 2 hours
- Body: empty

Do NOT include the actual secret in repository files or in public documentation.
