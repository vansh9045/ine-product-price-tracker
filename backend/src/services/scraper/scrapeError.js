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

  const isTimeout = error.name === 'TimeoutError';

  return new ScrapeError(
    isTimeout ? 'SCRAPE_TIMEOUT' : 'SCRAPE_UNEXPECTED_ERROR',
    isTimeout ? 'The storefront did not respond before the scraper timeout.' : 'Unexpected scraper failure.',
    { retryable: true, cause: error },
  );
}
