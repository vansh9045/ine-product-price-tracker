import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(currentDirectory, '../../../.env');

dotenv.config({ path: rootEnvPath });

const port = Number.parseInt(process.env.PORT ?? '5000', 10);

function getPositiveInteger(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

const validatedPort = getPositiveInteger('PORT', port);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: validatedPort,
  cronSecret: process.env.CRON_SECRET ?? 'change-me',
  scraperMaxRetries: getPositiveInteger('SCRAPER_MAX_RETRIES', 3),
  scraperRetryDelayMs: getPositiveInteger('SCRAPER_RETRY_DELAY_MS', 1000),
  scraperTimeoutMs: getPositiveInteger('SCRAPER_TIMEOUT_MS', 15000),
};
