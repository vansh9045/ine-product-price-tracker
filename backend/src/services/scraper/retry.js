import { normalizeScrapeError } from './scrapeError.js';

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runWithRetries(task, { maxRetries, retryDelayMs, onAttempt }) {
  const attempts = [];

  for (let attemptNumber = 1; attemptNumber <= maxRetries; attemptNumber += 1) {
    const startedAt = new Date();

    try {
      const value = await task(attemptNumber);
      const attempt = {
        attemptNumber,
        status: 'success',
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
      };
      attempts.push(attempt);
      onAttempt?.(attempt);
      return { success: true, value, attempts };
    } catch (error) {
      const scrapeError = normalizeScrapeError(error);
      const willRetry = scrapeError.retryable && attemptNumber < maxRetries;
      const attempt = {
        attemptNumber,
        status: willRetry ? 'retried' : 'failed',
        errorCode: scrapeError.code,
        errorMessage: scrapeError.message,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
      };
      attempts.push(attempt);
      onAttempt?.(attempt);

      if (!willRetry) {
        return { success: false, error: scrapeError, attempts };
      }

      await delay(retryDelayMs * attemptNumber);
    }
  }

  throw new Error('Retry loop ended unexpectedly.');
}
