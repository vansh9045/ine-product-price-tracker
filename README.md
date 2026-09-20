# INE Product Price Tracker

A full-stack product price tracking application built for the **INE Software Engineer Intern Assignment**.

The application allows users to search products from the INE mock store, track multiple products, scrape their current price and stock availability, view price history, and inspect detailed scraping logs.

The system uses **Playwright** for browser-based scraping and a **durable PostgreSQL-backed scrape queue** for scheduled background processing.

---

## Live Demo

### Frontend
https://ine-product-price-tracker-frontend.vercel.app

### Backend API
https://ine-product-price-tracker-uhbd.onrender.com

### INE Mock Store
https://demo.inelabteamdev.com/

---

## Features

### Product Tracking

- Search products by full or partial name
- Track multiple products
- View tracked products in a dashboard
- Manually refresh an individual tracked product
- View current price and stock availability
- View the last successful scrape time

### Price & Stock Monitoring

- Scrape the current visible product price
- Detect stock availability
- Store price history
- Display price history using charts and tables
- Preserve the last valid product state when a scrape fails
- Prevent invalid price or stock data from being stored

### Scraping Reliability

- Playwright-based browser scraping
- Headed and headless scraper modes
- Required mouse interaction before price reveal
- Configurable scraper timeout
- Retry handling for temporary scraping failures
- Fresh Playwright page for retry attempts
- Structured scraper errors
- Detailed scrape attempt logging
- Graceful handling of failed scraping attempts

### Durable Scrape Queue

Scheduled scraping uses a PostgreSQL-backed job queue instead of performing the entire batch inside a single HTTP request.

The queue provides:

- Batch run tracking
- Individual scrape jobs
- Job status tracking
- Concurrent job claiming
- Duplicate active-job prevention
- Stale job recovery
- Background worker processing
- Batch progress tracking
- Failure logging

### Page Structure Change Detection

The scraper detects important storefront structure changes.

If required elements such as the **Reveal Price** control or visible price element are missing, the scraper reports a structured:

`PAGE_STRUCTURE_CHANGED`

error instead of silently storing invalid data.

This helps identify changes in the mock store's page structure while protecting the database from incorrect scrape results.

### CI/CD

GitHub Actions is configured to automatically run checks on pushes and pull requests targeting the `main` branch.

The CI workflow:

- Installs backend dependencies
- Validates backend JavaScript syntax
- Installs frontend dependencies
- Runs the frontend production build
- Does not access production secrets
- Does not perform live store scraping during CI

---

## Tech Stack

### Frontend

- React
- Vite
- Tailwind CSS
- Recharts

### Backend

- Node.js
- Express.js
- Playwright

### Database

- Supabase PostgreSQL

### Deployment & Scheduling

- Vercel — Frontend
- Render — Backend
- cron-job.org — Scheduled scraping
- GitHub Actions — CI/CD

---

# System Architecture

```text
                         ┌────────────────────────┐
                         │     React Frontend     │
                         │        Vercel          │
                         └────────────┬───────────┘
                                      │
                                      │ REST API
                                      ▼
                         ┌────────────────────────┐
                         │    Express Backend     │
                         │        Render          │
                         └────────────┬───────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
          ┌──────────────────┐              ┌──────────────────┐
          │   Product APIs   │              │   Scrape Queue   │
          └──────────────────┘              └────────┬─────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────┐
                                            │ Supabase         │
                                            │ PostgreSQL       │
                                            └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │  Scrape Worker   │
                                            └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │    Playwright    │
                                            │     Scraper      │
                                            └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │  INE Mock Store  │
                                            └──────────────────┘
```

---

# Scraping Flow

The scraper follows the following process:

```text
Tracked Product
      │
      ▼
Open Product URL
      │
      ▼
Launch Playwright
      │
      ▼
Dismiss Optional Overlays
      │
      ▼
Locate Reveal Price Control
      │
      ▼
Perform Required Mouse Interaction
      │
      ▼
Reveal Product Price
      │
      ▼
Validate Visible Price
      │
      ▼
Detect Stock Status
      │
      ▼
Save Valid Result
      │
      ├──────────────► Price History
      │
      └──────────────► Scrape Log
```

If the scrape fails, the existing valid product state is preserved and the failure is recorded in the scrape log.

---

# Scheduled Scraping Architecture

The production system separates **job creation** from **job execution**.

```text
cron-job.org
     │
     │ Every 2 hours
     ▼
POST /api/tracked-products/refresh-all
     │
     ▼
Create Batch Run
     │
     ▼
Create Scrape Jobs
     │
     ▼
Supabase PostgreSQL
     │
     │ Every minute
     ▼
POST /api/scrape-queue/process
     │
     ▼
Scrape Worker
     │
     ▼
Claim Pending Jobs
     │
     ▼
Playwright Scraping
     │
     ▼
Update Product + History + Logs
```

This design prevents a scheduled HTTP request from waiting for the entire product batch to finish.

---

# Queue Design

The queue uses two main database tables.

## `batch_runs`

Stores information about each scheduled refresh batch.

Examples of tracked information:

- Batch ID
- Trigger time
- Total products
- Completed count
- Failed count
- Batch status

Possible batch states include:

```text
pending
processing
completed
completed_with_errors
failed
```

## `scrape_jobs`

Stores individual scraping jobs.

Each job tracks:

- Tracked product
- Batch run
- Job status
- Attempt count
- Error information
- Start time
- Completion time
- Update time

Possible job states include:

```text
pending
processing
success
failed
```

A partial unique index prevents multiple active jobs from being created for the same tracked product.

---

# Reliability & Failure Handling

The application is designed to avoid storing invalid scrape results.

### Temporary Scraping Failures

Temporary failures are handled using retry logic with configurable retry settings.

### Invalid Price

The scraper validates that the extracted visible price:

- Exists
- Can be parsed
- Is numeric
- Is greater than zero

### Invalid Stock Status

The scraper validates the visible stock information before storing it.

### Page Structure Changes

Important missing storefront elements are reported as:

```text
PAGE_STRUCTURE_CHANGED
```

### Failed Refresh

If a scrape fails:

- The existing product price is preserved
- The existing stock status is preserved
- No invalid price history entry is created
- The scrape attempt is logged
- The failure can be inspected from the application

### Stale Jobs

Jobs that remain in the `processing` state for too long can be requeued so that temporary worker failures do not permanently block the queue.

---

# Database Flow

A successful scrape follows this flow:

```text
Playwright
    │
    ▼
Validated Price + Stock
    │
    ├──────────────► tracked_products
    │
    ├──────────────► price_history
    │
    └──────────────► scrape_logs
```

A failed scrape follows:

```text
Playwright
    │
    ▼
Scrape Error
    │
    ▼
scrape_logs
    │
    ▼
Existing Product State Preserved
```

---

# Headed Scraper Mode

The scraper supports both headless and headed browser execution.

Headed mode is useful for:

- Demonstrating the scraping process
- Debugging the mock store
- Verifying browser interactions
- Showing the required mouse movement and price reveal interaction

Production scheduled scraping runs in headless mode.

---

# Project Structure

```text
INE scraper/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   │   └── scraper/
│   │   └── utils/
│   │
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   │
│   └── package.json
│
├── supabase/
│   └── migrations/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
└── README.md
```

---

# CI/CD

The project uses **GitHub Actions** for continuous integration.

The workflow runs on:

- Pushes to `main`
- Pull requests targeting `main`

The CI pipeline performs:

```text
GitHub Push / Pull Request
            │
            ▼
     GitHub Actions
            │
      ┌─────┴─────┐
      ▼           ▼
   Backend     Frontend
    Check        Build
      │           │
      ▼           ▼
   Syntax       Production
   Validation     Build
```

The workflow automatically validates backend JavaScript syntax and verifies that the frontend can successfully create a production build.

---

# Deployment

## Frontend

The React frontend is deployed using Vercel.

Production environment variable:

```text
VITE_API_BASE_URL
```

## Backend

The Node.js/Express backend is deployed using Render.

The backend uses environment variables for:

- Supabase configuration
- Cron authentication
- Scraper configuration
- Runtime configuration

Secrets are not committed to the repository.

## Scheduled Jobs

cron-job.org is used as an external scheduler because the Render free-tier service may sleep when inactive.

Two scheduled operations are used:

```text
Refresh All
    │
    ▼
Enqueue scrape jobs
    │
    ▼
Worker
    │
    ▼
Process queued scrape jobs
```

---

# Security

- Environment secrets are stored outside the repository.
- Cron endpoints require authentication.
- Supabase credentials are not committed to Git.
- Production secrets are not exposed through the frontend.
- CI does not require production credentials.
- Invalid scrape results are rejected before database updates.

---

# Design Decisions

### Why Playwright?

The INE mock store requires browser interaction before the price becomes available. Playwright provides reliable browser automation and supports both headed and headless execution.

### Why PostgreSQL Queue?

A durable database-backed queue provides persistent job state and avoids keeping long-running scrape operations inside a single HTTP request.

### Why an External Scheduler?

The backend is deployed on Render, where free-tier services may sleep. cron-job.org provides an external trigger for scheduled scraping.

### Why Separate Enqueue and Worker Operations?

Separating job creation from execution makes the scheduled endpoint fast and allows scraping to happen asynchronously through worker requests.

### Why Validate Before Writing?

A scraper should never overwrite valid product information with incomplete or invalid data. Validation ensures only trusted price and stock results reach the database.

---

# Future Improvements

Possible future improvements include:

- Price-drop notifications
- Back-in-stock email notifications
- Configurable scrape frequency per product
- More advanced storefront structure detection
- Additional analytics for price trends
- Authentication and user-specific product tracking
- More extensive automated integration tests

---

# Assignment Bonuses Implemented

The following assignment bonus features are implemented:

- ✅ Multi-product tracking dashboard
- ✅ Page structure change detection
- ✅ GitHub Actions CI/CD

The following bonus features were not implemented:

- Price-drop / back-in-stock alerts
- Configurable scrape frequency per product

---

# Summary

INE Product Price Tracker demonstrates a complete full-stack workflow for product monitoring:

```text
Search Product
      ↓
Track Product
      ↓
Schedule Scrape
      ↓
Queue Job
      ↓
Playwright Worker
      ↓
Validate Price + Stock
      ↓
Store Current State
      ↓
Record Price History
      ↓
Record Scrape Logs
      ↓
Visualize Results
```

The application combines a React frontend, Node.js/Express backend, Playwright browser automation, Supabase PostgreSQL, a durable scrape queue, scheduled background processing, structured failure handling, page structure change detection, and GitHub Actions CI/CD.