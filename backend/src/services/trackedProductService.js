import { getSupabaseClient } from '../config/supabase.js';

import { scrapeProduct } from './scraper/productScraper.js';

import { getStoreProductById } from './storeCatalogService.js';

import {
  enqueueAllTrackedProducts,
} from './scrapeQueueService.js';

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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidUuid(id) {
  if (
    typeof id !== 'string' ||
    !UUID_REGEX.test(id.trim())
  ) {
    throw createHttpError(
      'Tracked product ID must be a valid UUID.',
      400,
    );
  }
}

function throwDatabaseError(error) {
  if (error.code === '23505') {
    throw createHttpError(
      'This product is already being tracked.',
      409,
    );
  }

  throw error;
}

/**
 * Track a store product.
 */
export async function trackStoreProduct(
  storeProductId,
) {
  const storeProduct =
    await getStoreProductById(
      storeProductId,
    );

  const supabase =
    getSupabaseClient();

  const {
    data,
    error,
  } = await supabase
    .from('tracked_products')
    .insert({
      product_name:
        storeProduct.name,

      product_url:
        storeProduct.productUrl,

      store_product_id:
        String(storeProduct.id),
    })
    .select(trackedProductFields)
    .single();

  if (error) {
    throwDatabaseError(error);
  }

  return data;
}

/**
 * Get all tracked products.
 */
export async function listTrackedProducts() {
  const {
    data,
    error,
  } = await getSupabaseClient()
    .from('tracked_products')
    .select(trackedProductFields)
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Get one tracked product.
 */
export async function getTrackedProductById(
  id,
) {
  assertValidUuid(id);

  const {
    data,
    error,
  } = await getSupabaseClient()
    .from('tracked_products')
    .select(trackedProductFields)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createHttpError(
      'Tracked product not found.',
      404,
    );
  }

  return data;
}

/**
 * Delete a tracked product.
 */
export async function deleteTrackedProduct(
  id,
) {
  assertValidUuid(id);

  const {
    data,
    error,
  } = await getSupabaseClient()
    .from('tracked_products')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createHttpError(
      'Tracked product not found.',
      404,
    );
  }
}

/**
 * Save scraper attempt logs.
 *
 * This is still used by the individual
 * product refresh flow.
 */
async function saveScrapeAttempts(
  trackedProductId,
  attempts,
) {
  const supabase =
    getSupabaseClient();

  if (
    !Array.isArray(attempts) ||
    attempts.length === 0
  ) {
    return;
  }

  const rows = attempts.map(
    (attempt) => ({
      tracked_product_id:
        trackedProductId,

      started_at:
        attempt.startedAt,

      completed_at:
        attempt.completedAt,

      attempt_number:
        attempt.attemptNumber,

      status:
        attempt.status,

      error_message:
        attempt.errorMessage ??
        null,

      duration_ms:
        attempt.durationMs ??
        null,
    }),
  );

  const {
    error,
  } = await supabase
    .from('scrape_logs')
    .insert(rows);

  if (error) {
    throw error;
  }
}

/**
 * Enqueue ALL active tracked products.
 *
 * IMPORTANT:
 *
 * This function NO LONGER performs scraping.
 *
 * Old architecture:
 *
 *   refreshAllTrackedProducts()
 *          ↓
 *   Playwright
 *          ↓
 *   scrape all products
 *          ↓
 *   wait 75+ seconds
 *          ↓
 *   response
 *
 * New architecture:
 *
 *   refreshAllTrackedProducts()
 *          ↓
 *   create batch
 *          ↓
 *   create scrape jobs
 *          ↓
 *   return immediately
 *
 * Actual scraping is performed later by
 * the queue processor endpoint.
 */
export async function refreshAllTrackedProducts() {
  try {
    const result =
      await enqueueAllTrackedProducts();

    return {
      queued: true,

      batch_run_id:
        result.batchRun?.id ??
        null,

      batch_status:
        result.batchRun?.status ??
        'completed',

      total_products:
        result.totalProducts,

      jobs_created:
        result.jobsCreated,

      jobs_skipped:
        result.jobsSkipped,
    };
  } catch (error) {
    console.error(
      'Failed to enqueue tracked products:',
      error,
    );

    throw error;
  }
}

/**
 * Refresh ONE tracked product.
 *
 * IMPORTANT:
 *
 * This is intentionally kept separate
 * from the scheduled queue system.
 *
 * The frontend Refresh button uses this
 * function.
 */
export async function refreshTrackedProduct(
  id,
) {
  const trackedProduct =
    await getTrackedProductById(id);

  const scrapeResult =
    await scrapeProduct(
      {
        product_name:
          trackedProduct.product_name,

        product_url:
          trackedProduct.product_url,
      },
      {
        onAttempt:
          async () => { },
      },
    );

  const supabase =
    getSupabaseClient();

  /*
   * If scraping failed:
   *
   * - Don't update current price.
   * - Don't update current stock.
   * - Don't insert price history.
   * - Save attempt logs.
   */
  if (!scrapeResult.success) {
    try {
      await saveScrapeAttempts(
        id,
        scrapeResult.attempts,
      );
    } catch (err) {
      console.error(
        'Failed to save scrape attempts for failed scrape:',
        err,
      );
    }

    throw createHttpError(
      `Scrape failed for tracked product: ${scrapeResult.error}`,
      502,
    );
  }

  const {
    price,
    stockStatus,
    scrapedAt,
  } = scrapeResult;

  /*
   * Update current product state.
   */
  const {
    data,
    error,
  } = await supabase
    .from('tracked_products')
    .update({
      current_price:
        price,

      current_stock:
        stockStatus,

      last_scraped_at:
        scrapedAt,
    })
    .eq('id', id)
    .select(trackedProductFields)
    .single();

  if (error) {
    throw error;
  }

  /*
   * Insert price history.
   *
   * Only after a successful and validated
   * scrape.
   */
  const {
    error: historyError,
  } = await supabase
    .from('price_history')
    .insert({
      tracked_product_id:
        id,

      price,

      stock_status:
        stockStatus,

      scraped_at:
        scrapedAt,
    });

  if (historyError) {
    throw historyError;
  }

  /*
   * Save scraper attempts.
   */
  await saveScrapeAttempts(
    id,
    scrapeResult.attempts,
  );

  return data;
}

/**
 * Get price history for a tracked product.
 */
export async function getTrackedProductHistory(
  id,
) {
  /*
   * Verify that the product exists.
   */
  await getTrackedProductById(id);

  const {
    data,
    error,
  } = await getSupabaseClient()
    .from('price_history')
    .select(
      'id, tracked_product_id, price, stock_status, scraped_at',
    )
    .eq(
      'tracked_product_id',
      id,
    )
    .order('scraped_at', {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Get scrape logs for a tracked product.
 */
export async function getTrackedProductLogs(
  id,
) {
  /*
   * Verify that the product exists.
   */
  await getTrackedProductById(id);

  const {
    data,
    error,
  } = await getSupabaseClient()
    .from('scrape_logs')
    .select(
      'id, tracked_product_id, started_at, completed_at, attempt_number, status, error_message, duration_ms, created_at',
    )
    .eq(
      'tracked_product_id',
      id,
    )
    .order('started_at', {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data;
}