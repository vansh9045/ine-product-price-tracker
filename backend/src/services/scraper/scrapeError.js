export class ScrapeError extends Error {
  constructor(code, message, { retryable = false, cause } = {}) {
    super(message, { cause });
    this.name = 'ScrapeError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function normalizeScrapeError(error) {
  if (error instanceof ScrapeError) {
    return error;
  }

  // Emit safe diagnostic logs for production troubleshooting.
  // Only log non-sensitive string fields: name, message, stack and nested causes.
  try {
    function safeErrorInfo(err, depth = 0) {
      if (!err || depth > 2) return undefined;
      const info = {
        name: typeof err.name === 'string' ? err.name : undefined,
        message: typeof err.message === 'string' ? err.message : undefined,
        stack: typeof err.stack === 'string' ? err.stack : undefined,
      };

      // If there is a nested cause, include its basic info (avoid deep recursion).
      if (err.cause && typeof err.cause === 'object') {
        info.cause = safeErrorInfo(err.cause, depth + 1);
      }

      // Some Playwright errors include an innerError or originalError property.
      if (err.innerError && typeof err.innerError === 'object') {
        info.innerError = safeErrorInfo(err.innerError, depth + 1);
      }
      if (err.originalError && typeof err.originalError === 'object') {
        info.originalError = safeErrorInfo(err.originalError, depth + 1);
      }

      return info;
    }

    const diag = safeErrorInfo(error);
    // Structured, labeled log entry so Render logs show the underlying cause.
    // Do NOT include any environment variables, cookies, headers, or page content.
    // This is intentionally limited to string fields only.
    // eslint-disable-next-line no-console
    console.error('[SCRAPER][DIAGNOSTIC] Scrape error details:', JSON.stringify(diag));
  } catch (logErr) {
    // Ignore logging failures to avoid interfering with scraper flow.
  }

  const isTimeout = error && error.name === 'TimeoutError';

  return new ScrapeError(
    isTimeout ? 'SCRAPE_TIMEOUT' : 'SCRAPE_UNEXPECTED_ERROR',
    isTimeout ? 'The storefront did not respond before the scraper timeout.' : 'Unexpected scraper failure.',
    { retryable: true, cause: error },
  );
}
