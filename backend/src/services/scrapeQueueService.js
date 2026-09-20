import { getSupabaseClient } from '../config/supabase.js';

const DEFAULT_BATCH_SIZE = 3;
const STALE_JOB_MINUTES = 10;

/**
 * Create one scheduled batch.
 *
 * A batch represents one 2-hour refresh cycle.
 */
export async function createBatchRun(
    totalProducts,
) {
    const supabase = getSupabaseClient();

    const {
        data,
        error,
    } = await supabase
        .from('batch_runs')
        .insert({
            total_products: totalProducts,
            completed_count: 0,
            failed_count: 0,
            status: 'pending',
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

/**
 * Add one product to the scrape queue.
 *
 * The database partial unique index prevents
 * duplicate pending/processing jobs for the
 * same tracked product.
 */
export async function enqueueScrapeJob(
    trackedProductId,
    batchRunId,
) {
    const supabase = getSupabaseClient();

    const {
        data,
        error,
    } = await supabase
        .from('scrape_jobs')
        .insert({
            tracked_product_id:
                trackedProductId,

            batch_run_id:
                batchRunId,

            status: 'pending',

            attempts: 0,
        })
        .select()
        .single();

    if (error) {
        /*
         * 23505 = PostgreSQL unique violation.
         *
         * This means the product already has
         * a pending/processing job.
         */
        if (error.code === '23505') {
            return {
                created: false,
                reason: 'already_queued',
            };
        }

        throw error;
    }

    return {
        created: true,
        job: data,
    };
}

/**
 * Enqueue all active tracked products.
 *
 * IMPORTANT:
 * This function ONLY creates database jobs.
 *
 * It does NOT start Playwright.
 * It does NOT scrape products.
 *
 * Therefore the cron request can return quickly.
 */
export async function enqueueAllTrackedProducts() {
    const supabase = getSupabaseClient();

    const {
        data: products,
        error: productsError,
    } = await supabase
        .from('tracked_products')
        .select(`
      id,
      product_name,
      product_url,
      is_active
    `)
        .eq('is_active', true)
        .order('created_at', {
            ascending: false,
        });

    if (productsError) {
        throw productsError;
    }

    if (
        !products ||
        products.length === 0
    ) {
        return {
            batchRun: null,
            totalProducts: 0,
            jobsCreated: 0,
            jobsSkipped: 0,
        };
    }

    const batchRun =
        await createBatchRun(
            products.length,
        );

    let jobsCreated = 0;
    let jobsSkipped = 0;

    for (const product of products) {
        const result =
            await enqueueScrapeJob(
                product.id,
                batchRun.id,
            );

        if (result.created) {
            jobsCreated += 1;
        } else {
            jobsSkipped += 1;
        }
    }

    /*
     * If jobs were created, the batch is ready
     * for the queue processor.
     */
    const batchStatus =
        jobsCreated > 0
            ? 'processing'
            : 'completed';

    const {
        error: updateError,
    } = await supabase
        .from('batch_runs')
        .update({
            status: batchStatus,
            updated_at:
                new Date().toISOString(),
        })
        .eq('id', batchRun.id);

    if (updateError) {
        throw updateError;
    }

    return {
        batchRun: {
            id: batchRun.id,
            status: batchStatus,
        },

        totalProducts:
            products.length,

        jobsCreated,

        jobsSkipped,
    };
}

/**
 * Requeue processing jobs that became stale.
 *
 * This protects against:
 * - Render restart
 * - Node crash
 * - Playwright crash
 * - deployment during scraping
 */
export async function requeueStaleJobs() {
    const supabase = getSupabaseClient();

    const {
        data,
        error,
    } = await supabase.rpc(
        'requeue_stale_scrape_jobs',
        {
            p_stale_minutes:
                STALE_JOB_MINUTES,
        },
    );

    if (error) {
        throw error;
    }

    return Number(data ?? 0);
}

/**
 * Atomically claim a small number of jobs.
 *
 * PostgreSQL handles:
 * FOR UPDATE SKIP LOCKED
 *
 * so two queue processors cannot claim
 * the same pending job.
 */
export async function claimScrapeJobs(
    limit = DEFAULT_BATCH_SIZE,
) {
    const supabase = getSupabaseClient();

    const requestedLimit =
        Number(limit);

    const safeLimit =
        Number.isFinite(
            requestedLimit,
        )
            ? Math.max(
                1,
                Math.min(
                    Math.floor(
                        requestedLimit,
                    ),
                    DEFAULT_BATCH_SIZE,
                ),
            )
            : DEFAULT_BATCH_SIZE;

    const {
        data,
        error,
    } = await supabase.rpc(
        'claim_scrape_jobs',
        {
            p_limit: safeLimit,
        },
    );

    if (error) {
        throw error;
    }

    return data ?? [];
}

/**
 * Mark a job as successfully completed.
 */
export async function markJobSuccess(
    jobId,
) {
    const supabase = getSupabaseClient();

    const {
        error,
    } = await supabase
        .from('scrape_jobs')
        .update({
            status: 'success',

            completed_at:
                new Date().toISOString(),

            updated_at:
                new Date().toISOString(),
        })
        .eq('id', jobId);

    if (error) {
        throw error;
    }
}

/**
 * Mark a job as failed.
 */
export async function markJobFailed(
    jobId,
    errorMessage,
) {
    const supabase = getSupabaseClient();

    const {
        error,
    } = await supabase
        .from('scrape_jobs')
        .update({
            status: 'failed',

            last_error:
                errorMessage ??
                'Scrape job failed.',

            completed_at:
                new Date().toISOString(),

            updated_at:
                new Date().toISOString(),
        })
        .eq('id', jobId);

    if (error) {
        throw error;
    }
}

/**
 * Put a failed job back into pending state.
 *
 * This can be used when we want another
 * queue-processing tick to retry the job.
 */
export async function retryJob(
    jobId,
    errorMessage,
) {
    const supabase = getSupabaseClient();

    const {
        error,
    } = await supabase
        .from('scrape_jobs')
        .update({
            status: 'pending',

            started_at: null,

            last_error:
                errorMessage ??
                null,

            updated_at:
                new Date().toISOString(),
        })
        .eq('id', jobId);

    if (error) {
        throw error;
    }
}

/**
 * Increment queue-level attempt count.
 */
export async function incrementJobAttempts(
    jobId,
) {
    const supabase = getSupabaseClient();

    const {
        data: job,
        error: readError,
    } = await supabase
        .from('scrape_jobs')
        .select('attempts')
        .eq('id', jobId)
        .single();

    if (readError) {
        throw readError;
    }

    const nextAttempts =
        Number(job.attempts ?? 0) + 1;

    const {
        error: updateError,
    } = await supabase
        .from('scrape_jobs')
        .update({
            attempts: nextAttempts,

            updated_at:
                new Date().toISOString(),
        })
        .eq('id', jobId);

    if (updateError) {
        throw updateError;
    }

    return nextAttempts;
}

/**
 * Update progress of the batch containing
 * the completed job.
 */
export async function updateBatchProgress(
    batchRunId,
    resultStatus,
) {
    const supabase = getSupabaseClient();

    const {
        data: batchRun,
        error: batchError,
    } = await supabase
        .from('batch_runs')
        .select(`
      total_products,
      completed_count,
      failed_count
    `)
        .eq('id', batchRunId)
        .single();

    if (batchError) {
        throw batchError;
    }

    let completedCount =
        Number(
            batchRun.completed_count ?? 0,
        );

    let failedCount =
        Number(
            batchRun.failed_count ?? 0,
        );

    if (resultStatus === 'success') {
        completedCount += 1;
    }

    if (resultStatus === 'failed') {
        failedCount += 1;
    }

    const totalProducts =
        Number(
            batchRun.total_products ?? 0,
        );

    const finishedCount =
        completedCount +
        failedCount;

    let batchStatus =
        'processing';

    if (
        finishedCount >= totalProducts
    ) {
        batchStatus =
            failedCount > 0
                ? 'completed_with_errors'
                : 'completed';
    }

    const {
        error: updateError,
    } = await supabase
        .from('batch_runs')
        .update({
            completed_count:
                completedCount,

            failed_count:
                failedCount,

            status: batchStatus,

            updated_at:
                new Date().toISOString(),
        })
        .eq('id', batchRunId);

    if (updateError) {
        throw updateError;
    }

    return {
        completedCount,
        failedCount,
        status: batchStatus,
    };
}