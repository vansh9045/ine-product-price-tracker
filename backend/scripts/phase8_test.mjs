import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load root .env like the app does
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(currentDirectory, '../../.env');
dotenv.config({ path: rootEnvPath });

import { getSupabaseClient } from '../src/config/supabase.js';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

function now() { return new Date().toISOString(); }

async function run() {
  console.log('Phase 8 automated test start', now());

  // 1) List tracked products
  const listRes = await fetch(`${API_BASE}/tracked-products`);
  const listJson = await listRes.json();
  if (!listJson.success) throw new Error('Failed to list tracked products');
  const products = listJson.data.products;
  if (!products || products.length === 0) {
    console.error('No tracked products found. Create one via the API or track a store product first.');
    process.exit(1);
  }

  const product = products[0];
  console.log('Using tracked product:', product.id, product.product_name);

  // Record pre-refresh state
  const prePrice = product.current_price;
  const preStock = product.current_stock;

  // Count history before
  const supabase = getSupabaseClient();
  const { data: historyBefore } = await supabase.from('price_history').select('id').eq('tracked_product_id', product.id);
  const historyCountBefore = (historyBefore || []).length;

  console.log('Pre-refresh price:', prePrice, 'stock:', preStock, 'historyCount:', historyCountBefore);

  // TEST 1: Successful refresh
  console.log('\nTEST 1: triggering successful refresh...');
  const refreshRes = await fetch(`${API_BASE}/tracked-products/${product.id}/refresh`, { method: 'POST' });
  const refreshJson = await refreshRes.json();
  console.log('Refresh response status:', refreshRes.status, 'body:', JSON.stringify(refreshJson));

  if (!refreshJson.success) {
    console.error('Refresh reported failure; aborting further tests.');
  } else {
    // Get product after refresh
    const getRes = await fetch(`${API_BASE}/tracked-products/${product.id}`);
    const getJson = await getRes.json();
    console.log('Post-refresh product:', JSON.stringify(getJson.data.product, null, 2));

    // Check history inserted
    const { data: historyAfter } = await supabase.from('price_history').select('*').eq('tracked_product_id', product.id).order('scraped_at', { ascending: false });
    console.log('History count after refresh:', (historyAfter || []).length);

    // Check logs
    const { data: logs } = await supabase.from('scrape_logs').select('*').eq('tracked_product_id', product.id).order('started_at', { ascending: false });
    console.log('Latest logs (top 3):', JSON.stringify((logs || []).slice(0,3), null, 2));
  }

  // TEST 4: Controlled failure — temporarily set product_url to unreachable and refresh
  console.log('\nTEST 4: Controlled failure test — updating product_url to unreachable and refreshing');
  const originalUrl = product.product_url;
  const badUrl = 'http://127.0.0.1:59999/nonexistent';

  // Update product_url to badUrl
  const { error: updateError } = await supabase.from('tracked_products').update({ product_url: badUrl }).eq('id', product.id);
  if (updateError) {
    console.error('Failed to update product_url for controlled failure test:', updateError);
  } else {
    console.log('product_url updated to invalid URL for test');

    const failRes = await fetch(`${API_BASE}/tracked-products/${product.id}/refresh`, { method: 'POST' });
    const failJson = await failRes.json().catch(() => null);
    console.log('Failure refresh HTTP status:', failRes.status, 'body:', JSON.stringify(failJson));

    // Ensure product state unchanged
    const { data: productAfterFail } = await supabase.from('tracked_products').select('*').eq('id', product.id).single();
    console.log('Product after failed refresh (current_price/current_stock):', productAfterFail.current_price, productAfterFail.current_stock);

    // Ensure history count unchanged
    const { data: historyAfterFail } = await supabase.from('price_history').select('id').eq('tracked_product_id', product.id);
    console.log('History count after failed refresh:', (historyAfterFail || []).length, '(before:', historyCountBefore, ')');

    // Logs should contain failed attempts
    const { data: logsAfterFail } = await supabase.from('scrape_logs').select('*').eq('tracked_product_id', product.id).order('started_at', { ascending: false });
    console.log('Latest logs after failure (top 5):', JSON.stringify((logsAfterFail || []).slice(0,5), null, 2));

    // Restore original URL
    const { error: restoreError } = await supabase.from('tracked_products').update({ product_url: originalUrl }).eq('id', product.id);
    if (restoreError) {
      console.error('Failed to restore product_url after test:', restoreError);
    } else {
      console.log('product_url restored to original.');
    }
  }

  console.log('\nPhase 8 automated test complete', now());
}

run().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
