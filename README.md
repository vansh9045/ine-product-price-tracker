# INE Product Price Tracker

A full-stack product price tracking application built for the INE Software Engineer Intern assignment.

The application allows users to search products from the INE mock store, track products, scrape their current price and stock availability, and view price history and detailed scraping logs.

## Live Demo

### Frontend
https://ine-product-price-tracker-frontend.vercel.app

### Backend API
https://ine-product-price-tracker-uhbd.onrender.com

### Mock Store
https://demo.inelabteamdev.com/

---

## Features

- Search products by full or partial name
- Track products for price and stock monitoring
- Manually refresh an individual tracked product
- Scrape current price and stock availability
- View current product information
- View price history using a chart and table
- View detailed scrape attempt logs
- Retry handling for temporary scraping failures
- Durable PostgreSQL-backed scrape queue
- Background worker for scheduled scraping
- Stale job recovery
- Failure logging
- Production deployment
- Automated scheduled scraping using cron-job.org

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

### Deployment

- Vercel - Frontend
- Render - Backend
- cron-job.org - Scheduled jobs

---

# System Architecture

```text
                    ┌─────────────────────┐
                    │    React Frontend   │
                    │       Vercel        │
                    └──────────┬──────────┘
                               │
                               │ REST API
                               ▼
                    ┌─────────────────────┐
                    │   Express Backend   │
                    │       Render        │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
        ┌─────────────────┐         ┌─────────────────┐
        │ Product APIs    │         │ Scrape Queue    │
        └─────────────────┘         └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ Supabase        │
                                    │ PostgreSQL      │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ Scrape Worker   │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ Playwright      │
                                    │ Scraper         │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ INE Mock Store  │
                                    └─────────────────┘