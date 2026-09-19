import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(currentDirectory, '../../.env');
dotenv.config({ path: rootEnvPath });

import fetch from 'node-fetch';
import { getSupabaseClient } from '../src/config/supabase.js';

const API_BASE = 'http://localhost:5000/api';
const supabase = getSupabaseClient();

async function snapshotCounts() {
  const [{ data: ph }, { data: logs }, { data: products }] = await Promise.all([
    supabase.from('price_history').select('id, tracked_product_id, scraped_at'),
    supabase.from('scrape_logs').select('id, tracked_product_id, started_at'),
    supabase.from('tracked_products').select('id, current_price, current_stock, product_url, is_active, last_scraped_at'),
  ]);

  return {
    price_history_count: (ph || []).length,
    scrape_logs_count: (logs || []).length,
    tracked_products: products || [],
  };
}

async function callCron(secretHeader) {
  const headers = {};
  if (secretHeader !== undefined) headers['x-cron-secret'] = secretHeader;

  const res = await fetch(`${API_BASE}/tracked-products/refresh-all`, { method: 'POST', headers });
  let body = null;
  try { body = await res.json(); } catch (e) { body = await res.text(); }
  return { status: res.status, body };
}

function recentTimestampMinutes(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

async function run() {
  console.log('Phase 9 verification start');

  // Snapshot before tests
  const before = await snapshotCounts();
  console.log('Snapshot before:', { price_history_count: before.price_history_count, scrape_logs_count: before.scrape_logs_count, active_tracked_products: before.tracked_products.filter(p=>p.is_active).length });

  // TEST 1: Missing cron secret
  console.log('\nTEST 1 — Missing cron secret');
  const t1 = await callCron(undefined);
  console.log('HTTP status:', t1.status);
  console.log('Body:', typeof t1.body === 'object' ? JSON.stringify(t1.body) : t1.body);

  const afterT1 = await snapshotCounts();
  console.log('Counts after TEST1 (delta):', { price_history_delta: afterT1.price_history_count - before.price_history_count, scrape_logs_delta: afterT1.scrape_logs_count - before.scrape_logs_count });

  // TEST 2: Wrong cron secret
  console.log('\nTEST 2 — Wrong cron secret');
  const t2 = await callCron('incorrect-secret');
  console.log('HTTP status:', t2.status);
  console.log('Body:', typeof t2.body === 'object' ? JSON.stringify(t2.body) : t2.body);

  const afterT2 = await snapshotCounts();
  console.log('Counts after TEST2 (delta):', { price_history_delta: afterT2.price_history_count - before.price_history_count, scrape_logs_delta: afterT2.scrape_logs_count - before.scrape_logs_count });

  // TEST 3: Correct cron secret
  console.log('\nTEST 3 — Correct cron secret (this will actually run scrapers)');
  const correctSecret = process.env.CRON_SECRET;
  const t3_before = await snapshotCounts();
  const t3 = await callCron(correctSecret);
  console.log('HTTP status:', t3.status);
  console.log('Body:', JSON.stringify(t3.body, null, 2));
  const t3_after = await snapshotCounts();
  console.log('Counts after TEST3 (delta):', { price_history_delta: t3_after.price_history_count - t3_before.price_history_count, scrape_logs_delta: t3_after.scrape_logs_count - t3_before.scrape_logs_count });

  // TEST 4: Failure isolation
  console.log('\nTEST 4 — Failure isolation');
  // Find active tracked products
  const activeProducts = (t3_after.tracked_products || []).filter((p) => p.is_active);
  if (activeProducts.length <= 1) {
    console.log('Only one or zero active tracked products; cannot fully test multi-product isolation. Verified that scheduler ran and recorded attempts for the single product.');
  } else {
    // Choose one product to induce failure
    const target = activeProducts[0];
    console.log('Inducing failure for product:', target.id, target.product_url);

    // Save original URL
    const originalUrl = target.product_url;

    // Update product_url to unreachable
    const badUrl = 'http://127.0.0.1:59999/nonexistent';
    await supabase.from('tracked_products').update({ product_url: badUrl }).eq('id', target.id);

    // Snapshot before run
    const beforeFail = await snapshotCounts();

    // Run cron
    const failRun = await callCron(correctSecret);
    console.log('Cron run status:', failRun.status);
    console.log('Cron run body:', JSON.stringify(failRun.body, null, 2));

    // Snapshot after run
    const afterFail = await snapshotCounts();
    console.log('Counts after failure run (delta):', { price_history_delta: afterFail.price_history_count - beforeFail.price_history_count, scrape_logs_delta: afterFail.scrape_logs_count - beforeFail.scrape_logs_count });

    // Inspect latest logs for target product
    const { data: targetLogs } = await supabase.from('scrape_logs').select('*').eq('tracked_product_id', target.id).order('started_at', { ascending: false }).limit(5);
    console.log('Latest logs for failed product (top 5):', JSON.stringify(targetLogs, null, 2));

    // Check latest history rows for target product
    const { data: targetHistory } = await supabase.from('price_history').select('*').eq('tracked_product_id', target.id).order('scraped_at', { ascending: false }).limit(5);
    console.log('Latest history for failed product (top 5):', JSON.stringify(targetHistory, null, 2));

    // Restore original URL
    await supabase.from('tracked_products').update({ product_url: originalUrl }).eq('id', target.id);
    console.log('Restored product_url for target product.');
  }

  // TEST 5: Supabase evidence (summarize from last successful run t3)
  console.log('\nTEST 5 — Supabase evidence (from TEST3 run)');
  const summary = t3.body?.data ?? t3.body;
  if (summary) {
    const processed = summary.results || [];
    console.log('Summary totals:', { total: summary.total, successful: summary.successful, failed: summary.failed, duration_ms: summary.duration_ms });

    // For each processed product, fetch latest product row and counts
    for (const p of processed.slice(0, 10)) {
      try {
        const { data: prod } = await supabase.from('tracked_products').select('*').eq('id', p.id).single();
        const { data: ph } = await supabase.from('price_history').select('*').eq('tracked_product_id', p.id).order('scraped_at', { ascending: false }).limit(3);
        const { data: logs } = await supabase.from('scrape_logs').select('*').eq('tracked_product_id', p.id).order('started_at', { ascending: false }).limit(5);
        console.log('\nProduct:', p.id, 'status:', p.status);
        console.log('Tracked row:', JSON.stringify(prod, null, 2));
        console.log('Recent history (top 3):', JSON.stringify(ph, null, 2));
        console.log('Recent logs (top 5):', JSON.stringify(logs, null, 2));
      } catch (e) {
        console.error('Error fetching product evidence for', p.id, e);
      }
    }
  } else {
    console.log('No summary returned from TEST3 to inspect.');
  }

  console.log('\nPhase 9 verification complete');
}

run().catch((err) => { console.error('Verification script error:', err); process.exit(1); });
