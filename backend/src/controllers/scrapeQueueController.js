import { env } from '../config/env.js';

import {
    processScrapeQueue,
} from '../services/scrapeQueueWorkerService.js';

export async function processScrapeQueueForCron(
    request,
    response,
    next,
) {
    try {
        console.log(
            '🚀 SCRAPE QUEUE CONTROLLER ENTERED',
        );

        const providedSecret =
            request.headers['x-cron-secret'] ??
            request.headers.authorization?.replace(
                /^Bearer\s+/i,
                '',
            );

        if (providedSecret !== env.cronSecret) {
            console.log(
                '❌ SCRAPE QUEUE CRON SECRET FAILED',
            );

            const error = new Error(
                'Unauthorized cron request.',
            );

            error.statusCode = 401;

            throw error;
        }

        console.log(
            '✅ SCRAPE QUEUE CRON SECRET PASSED',
        );

        const summary =
            await processScrapeQueue();

        response.status(200).json({
            success: true,
            data: summary,
        });
    } catch (error) {
        console.error(
            '❌ SCRAPE QUEUE CONTROLLER ERROR:',
            error,
        );

        next(error);
    }
}