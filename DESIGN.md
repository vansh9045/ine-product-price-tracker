# Design Note — INE Product Price Tracker

## 1. Overview

The application is a full-stack product price tracking system.

The main workflow is:

1. Search for a product from the INE mock store.
2. Select a product to track.
3. Scrape its current price and stock availability.
4. Store the current state and historical observations.
5. Record every scraping attempt.
6. Run scheduled scraping through a durable PostgreSQL-backed queue.

---

## 2. High-Level Architecture

```text
React Frontend
      |
      | REST API
      v
Node.js / Express Backend
      |
      +----------------------+
      |                      |
      v                      v
Product APIs          Scrape Queue
                             |
                             v
                       Supabase PostgreSQL
                             |
                             v
                       Scrape Worker
                             |
                             v
                          Playwright
                             |
                             v
                       INE Mock Store
```

The frontend is deployed on Vercel and the backend is deployed on Render.

Supabase PostgreSQL is used for persistent application and queue data.

cron-job.org is used as the external scheduler.

---

## 3. Product Search

The frontend sends a search request to the backend.

The backend searches the INE mock store catalog and returns matching products.

The user can then select a product and add it to the tracked products list.

The application intentionally focuses on search rather than requiring the entire catalog to be displayed at once.

---

## 4. Scraping Approach

Playwright is used for scraping because the mock store may require browser interaction to reveal the product price.

The scraper:

1. Opens the product page.
2. Handles the relevant page interaction.
3. Waits for the price to become available.
4. Extracts the price and stock state.
5. Validates the extracted values.
6. Returns the result to the tracking service.

The scraper supports headed mode for demonstration and debugging.

---

## 5. Data Validation

Scraped values are validated before being stored.

The system avoids overwriting an existing valid product state with an invalid scrape result.

For example, if the price cannot be extracted successfully, the scrape is treated as a failure rather than saving an invalid price.

---

## 6. Retry Strategy

There are two levels of failure handling.

### Scraper-level retries

The scraper retries retryable failures such as temporary timeouts or page interaction failures.

Each attempt is recorded in `scrape_logs`.

### Queue-level retries

The durable queue also tracks job attempts.

A failed queue job can return to the `pending` state when the maximum queue attempt count has not been reached.

After the configured maximum number of attempts, the job is marked as `failed`.

```text
pending
   |
   v
processing
   |
   +------ success ------> success
   |
   +------ failure
              |
              v
         attempts < max?
           /        \
         yes         no
          |           |
          v           v
       pending      failed
```

---

## 7. Durable Queue Design

The initial synchronous approach could require the cron request to wait for multiple product scrapes.

This creates a problem because scraping can take significant time and external cron services have request timeouts.

To avoid this, the application uses a durable PostgreSQL-backed queue.

The queue consists of:

### `batch_runs`

Represents one scheduled scraping batch.

It tracks:

- Total products
- Completed products
- Failed products
- Batch status
- Trigger time

### `scrape_jobs`

Represents an individual product scraping task.

It tracks:

- Tracked product
- Batch
- Status
- Attempt count
- Error information
- Start time
- Completion time

---

## 8. Job Claiming

Workers claim pending jobs using a PostgreSQL function.

The claim operation uses row locking with `FOR UPDATE SKIP LOCKED`.

This prevents two worker executions from claiming the same pending job at the same time.

The worker processes only a small number of jobs per execution.

---

## 9. Worker Design

The worker performs the following steps:

1. Requeue stale processing jobs.
2. Claim pending jobs.
3. Increment the job attempt count.
4. Run the existing product scraper.
5. Save the current product state.
6. Insert price history.
7. Save scrape logs.
8. Mark the job as successful.
9. Retry or permanently fail unsuccessful jobs.

The production worker currently processes one job per execution to keep the request duration below the scheduler timeout.

---

## 10. Scheduled Execution

Two cron jobs are used.

### Queue Creation

Runs every two hours:

```text
POST /api/tracked-products/refresh-all
```

This endpoint creates jobs for active tracked products and returns quickly.

### Worker

Runs every minute:

```text
POST /api/scrape-queue/process
```

The worker processes pending jobs incrementally.

```text
Every 2 hours
      |
      v
Create scrape jobs
      |
      v
Pending queue
      |
      +------------------+
                         |
                   Every minute
                         |
                         v
                    Worker
                         |
                         v
                    Scrape
```

---

## 11. Database Flow

When a scrape succeeds:

```text
scrape_jobs
     |
     v
tracked_products
     |
     +------> price_history
     |
     +------> scrape_logs
```

The tracked product stores the latest known state.

`price_history` stores historical observations.

`scrape_logs` stores individual scraping attempts.

---

## 12. Failure Handling

The system is designed so that one failed product does not prevent other products from being processed.

A failed scrape:

- Is logged.
- Does not overwrite the previous valid product state.
- Can be retried.
- Eventually becomes a failed queue job if the maximum attempts are exhausted.

Stale jobs can also be returned to the pending state if a worker stops while processing them.

---

## 13. Deployment

### Frontend

The React application is deployed on Vercel.

### Backend

The Express API is deployed on Render.

The Render build installs Chromium for Playwright.

### Database

Supabase PostgreSQL provides persistent storage.

### Scheduler

cron-job.org provides external scheduled execution.

---

## 14. Security

The scheduled queue and worker endpoints require the configured cron secret.

The secret is provided through an HTTP header and is stored as an environment variable.

Application secrets and Supabase service credentials are not committed to the repository.

---

## 15. Trade-offs

### PostgreSQL Queue instead of an in-memory queue

A database-backed queue was selected because it provides persistence and survives backend restarts.

It also avoids introducing an additional Redis service for this project.

### Small worker batch size

The worker processes a small number of jobs per request.

This increases the number of worker executions but reduces the chance of exceeding the external scheduler's request timeout.

### Playwright instead of simple HTTP requests

Playwright adds browser overhead, but it provides reliable support for pages that require interaction before revealing the price.

---

## 16. Future Improvements

Potential improvements include:

- More sophisticated job prioritization
- More granular worker concurrency
- Atomic batch progress updates
- Monitoring and alerting
- Additional scraper adapters for different store layouts
- More detailed worker metrics
- Dedicated background worker infrastructure for larger workloads

---

## 17. Summary

The final architecture separates product search, individual scraping, scheduled job creation, and background job processing.

The durable PostgreSQL queue allows scheduled scraping to continue without keeping a long-running cron request open.

The combination of Playwright, retries, validation, scrape logs, price history, and durable jobs provides the reliability required for the product tracking workflow.