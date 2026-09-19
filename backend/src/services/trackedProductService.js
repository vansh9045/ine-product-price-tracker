import { getSupabaseClient } from '../config/supabase.js';
import { scrapeProduct } from './scraper/productScraper.js';
import { getStoreProductById } from './storeCatalogService.js';

const trackedProductFields = `
  id,
  product_name,
  product_url,
  store_product_id,
  image_url,
  current_price,
  current_stock,
  last_scraped_at,
  is_active,
  created_at,
  updated_at
`;

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function throwDatabaseError(error) {
  if (error.code === '23505') {
    throw createHttpError('This product is already being tracked.', 409);
  }

  throw error;
}

export async function trackStoreProduct(storeProductId) {
  const storeProduct = await getStoreProductById(storeProductId);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('tracked_products')
    .insert({
      product_name: storeProduct.name,
      product_url: storeProduct.productUrl,
      store_product_id: String(storeProduct.id),
    })
    .select(trackedProductFields)
    .single();

  if (error) {
    throwDatabaseError(error);
  }

  return data;
}

export async function listTrackedProducts() {
  const { data, error } = await getSupabaseClient()
    .from('tracked_products')
    .select(trackedProductFields)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function getTrackedProductById(id) {
  const { data, error } = await getSupabaseClient()
    .from('tracked_products')
    .select(trackedProductFields)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createHttpError('Tracked product not found.', 404);
  }

  return data;
}

export async function deleteTrackedProduct(id) {
  const { data, error } = await getSupabaseClient()
    .from('tracked_products')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createHttpError('Tracked product not found.', 404);
  }
}

export async function refreshAllTrackedProducts() {
  // Only fetch active tracked products for scheduled runs to avoid processing paused/inactive items.
  const supabase = getSupabaseClient();
  const { data: products, error: listError } = await supabase
    .from('tracked_products')
    .select(trackedProductFields)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (listError) {
    throw listError;
  }
  const results = [];
  const startedAt = Date.now();

  for (const product of products) {
    const productStart = Date.now();
    try {
      const refreshed = await refreshTrackedProduct(product.id);
      results.push({
        id: product.id,
        status: 'success',
        product: refreshed,
        duration_ms: Date.now() - productStart,
      });
    } catch (error) {
      results.push({
        id: product.id,
        status: 'failed',
        error_message: error?.message ?? String(error),
        duration_ms: Date.now() - productStart,
      });
    }
  }

  const finishedAt = Date.now();
  const successful = results.filter((r) => r.status === 'success').length;
  const failed = results.length - successful;

  return {
    total: results.length,
    successful,
    failed,
    duration_ms: finishedAt - startedAt,
    results,
  };
}

async function saveScrapeAttempts(trackedProductId, attempts) {
  const supabase = getSupabaseClient();

  if (!Array.isArray(attempts) || attempts.length === 0) {
    return;
  }

  const rows = attempts.map((attempt) => ({
    tracked_product_id: trackedProductId,
    started_at: attempt.startedAt,
    completed_at: attempt.completedAt,
    attempt_number: attempt.attemptNumber,
    status: attempt.status,
    error_message: attempt.errorMessage ?? null,
    duration_ms: attempt.durationMs ?? null,
  }));

  const { error } = await supabase.from('scrape_logs').insert(rows);

  if (error) {
    throw error;
  }
}

export async function refreshTrackedProduct(id) {
  const trackedProduct = await getTrackedProductById(id);
  const scrapeResult = await scrapeProduct(
    {
      product_name: trackedProduct.product_name,
      product_url: trackedProduct.product_url,
    },
    {
      onAttempt: async () => {},
    },
  );

  const supabase = getSupabaseClient();

  // If the scrape failed, persist attempt logs and return an honest failure
  if (!scrapeResult.success) {
    try {
      await saveScrapeAttempts(id, scrapeResult.attempts);
    } catch (err) {
      // Log but prefer returning the scrape failure to the client
      console.error('Failed to save scrape attempts for failed scrape:', err);
    }

    throw createHttpError(`Scrape failed for tracked product: ${scrapeResult.error}`, 502);
  }

  const { price, stockStatus, scrapedAt } = scrapeResult;

  const { data, error } = await supabase
    .from('tracked_products')
    .update({
      current_price: price,
      current_stock: stockStatus,
      last_scraped_at: scrapedAt,
    })
    .eq('id', id)
    .select(trackedProductFields)
    .single();

  if (error) {
    throw error;
  }

  const { error: historyError } = await supabase.from('price_history').insert({
    tracked_product_id: id,
    price,
    stock_status: stockStatus,
    scraped_at: scrapedAt,
  });

  if (historyError) {
    throw historyError;
  }

  await saveScrapeAttempts(id, scrapeResult.attempts);

  return data;
}

export async function getTrackedProductHistory(id) {
  // verify product exists
  await getTrackedProductById(id);

  const { data, error } = await getSupabaseClient()
    .from('price_history')
    .select('id, tracked_product_id, price, stock_status, scraped_at')
    .eq('tracked_product_id', id)
    .order('scraped_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function getTrackedProductLogs(id) {
  // verify product exists
  await getTrackedProductById(id);

  const { data, error } = await getSupabaseClient()
    .from('scrape_logs')
    .select('id, tracked_product_id, started_at, completed_at, attempt_number, status, error_message, duration_ms, created_at')
    .eq('tracked_product_id', id)
    .order('started_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}
