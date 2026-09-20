import { refreshTrackedProduct } from './trackedProductService.js';

import {
    requeueStaleJobs,
    claimScrapeJobs,
    incrementJobAttempts,
    markJobSuccess,
    markJobFailed,
    retryJob,
    updateBatchProgress,
} from './scrapeQueueService.js';

const WORKER_BATCH_SIZE = 1;
const MAX_JOB_ATTEMPTS = 3;

export async function processScrapeQueue() {
    const startedAt = Date.now();

    console.log('🚀 SCRAPE QUEUE WORKER STARTED');

    // Recover jobs that were stuck in processing
    const requeuedCount = await requeueStaleJobs();

    console.log(
        `♻️ Requeued stale jobs: ${requeuedCount}`,
    );

    // Claim a small batch so the worker stays within cron timeout
    const jobs = await claimScrapeJobs(
        WORKER_BATCH_SIZE,
    );

    console.log(
        `📦 Jobs claimed: ${jobs.length}`,
    );

    if (jobs.length === 0) {
        return {
            processed: 0,
            successful: 0,
            failed: 0,
            retried: 0,
            requeued: requeuedCount,
            duration_ms: Date.now() - startedAt,
            message: 'No pending scrape jobs.',
        };
    }

    let successful = 0;
    let failed = 0;
    let retried = 0;

    for (const job of jobs) {
        console.log(
            `🔎 Processing job ${job.id}`,
        );

        let attemptNumber = 0;

        try {
            // Increment queue-level attempt count
            attemptNumber = await incrementJobAttempts(
                job.id,
            );

            console.log(
                `🔁 Job attempt: ${attemptNumber}/${MAX_JOB_ATTEMPTS}`,
            );

            // Existing scraper already has its own retry mechanism
            await refreshTrackedProduct(
                job.tracked_product_id,
            );

            // Scrape succeeded
            await markJobSuccess(job.id);

            if (job.batch_run_id) {
                await updateBatchProgress(
                    job.batch_run_id,
                    'success',
                );
            }

            successful += 1;

            console.log(
                `✅ Job completed successfully: ${job.id}`,
            );
        } catch (error) {
            const errorMessage =
                error?.message ??
                'Scrape job failed.';

            console.error(
                `❌ Job failed: ${job.id}`,
                errorMessage,
            );

            // Retry if maximum attempts have not been reached
            if (attemptNumber < MAX_JOB_ATTEMPTS) {
                try {
                    await retryJob(
                        job.id,
                        errorMessage,
                    );

                    retried += 1;

                    console.log(
                        `🔄 Job returned to pending for retry: ${job.id}`,
                    );
                } catch (retryError) {
                    console.error(
                        `❌ Failed to requeue job: ${job.id}`,
                        retryError,
                    );

                    try {
                        await markJobFailed(
                            job.id,
                            retryError?.message ??
                            errorMessage,
                        );
                    } catch (markError) {
                        console.error(
                            `❌ Failed to mark job as failed: ${job.id}`,
                            markError,
                        );
                    }

                    if (job.batch_run_id) {
                        try {
                            await updateBatchProgress(
                                job.batch_run_id,
                                'failed',
                            );
                        } catch (batchError) {
                            console.error(
                                `❌ Failed to update batch progress: ${job.batch_run_id}`,
                                batchError,
                            );
                        }
                    }

                    failed += 1;
                }

                continue;
            }

            // Maximum attempts reached
            try {
                await markJobFailed(
                    job.id,
                    `Maximum attempts (${MAX_JOB_ATTEMPTS}) reached. ${errorMessage}`,
                );

                if (job.batch_run_id) {
                    await updateBatchProgress(
                        job.batch_run_id,
                        'failed',
                    );
                }

                failed += 1;

                console.log(
                    `⛔ Job permanently failed after ${MAX_JOB_ATTEMPTS} attempts: ${job.id}`,
                );
            } catch (finalError) {
                console.error(
                    `❌ Failed to finalize job: ${job.id}`,
                    finalError,
                );
            }
        }
    }

    const summary = {
        processed: jobs.length,
        successful,
        failed,
        retried,
        requeued: requeuedCount,
        duration_ms: Date.now() - startedAt,
    };

    console.log(
        '🏁 SCRAPE QUEUE WORKER FINISHED:',
        summary,
    );

    return summary;
}