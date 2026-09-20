import { chromium } from 'playwright';

import { env } from '../../config/env.js';
import { runWithRetries } from './retry.js';
import { ScrapeError } from './scrapeError.js';

const PRICE_BLOCK_SELECTOR = '.price-block';
const REQUIRED_MOUSE_MOVES = 45;
const MOUSE_MOVE_DELAY_MS = 50;

function parsePrice(priceText) {
  const normalizedText = priceText.replace(/[\u200B\u00A0]/g, '').trim();
  const match = normalizedText.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/);

  if (!match) {
    throw new ScrapeError('INVALID_PRICE', 'The visible store price is missing or cannot be parsed.');
  }

  const price = Number(match[1].replaceAll(',', ''));

  if (!Number.isFinite(price) || price <= 0) {
    throw new ScrapeError('INVALID_PRICE', 'The visible store price is not a positive number.');
  }

  return price;
}

function parseStock(priceBlockText) {
  const normalizedText = priceBlockText.toLocaleLowerCase();

  if (/out\s+of\s+stock/.test(normalizedText)) {
    return 'out_of_stock';
  }

  if (/(?:in\s+stock|only\s+\d+\s+left|\d+\s+in\s+stock|selling\s+fast|hurry,?\s+just\s+\d+\s+left)/.test(normalizedText)) {
    return 'in_stock';
  }

  throw new ScrapeError('INVALID_STOCK', 'The visible store stock status could not be determined.');
}

async function dismissCookieBanner(page) {
  const cookieButton = page.getByRole('button', { name: /accept|agree|allow|ok|continue/i });
  const overlaySelectors = [
    '.cookie-overlay',
    '.cookie-banner',
    '.cookie-law-info-bar',
    '.modal-overlay',
    '.overlay',
    '[class*="cookie"]',
    '[id*="cookie"]',
  ];

  for (const selector of overlaySelectors) {
    try {
      const overlay = page.locator(selector);
      if (!(await overlay.count())) {
        continue;
      }

      await overlay.evaluateAll((elements) => {
        elements.forEach((element) => {
          element.style.setProperty('display', 'none', 'important');
          element.style.setProperty('opacity', '0', 'important');
          element.style.setProperty('visibility', 'hidden', 'important');
          element.style.setProperty('pointer-events', 'none', 'important');
          element.remove();
        });
      });
    } catch (_error) {
      // Some overlay variants may change while the page is mutating; this is optional and should not fail the scrape.
    }
  }

  try {
    if (await cookieButton.count()) {
      const button = cookieButton.first();
      await button.waitFor({ state: 'visible', timeout: 5000 });
      await button.click();
      await page.waitForTimeout(500);
    }
  } catch (_error) {
    // The mock store may not always show a cookie banner; this is optional and should not fail the scrape.
  }
}

async function performRevealInteraction(page) {
  const revealButton = page.getByRole('button', { name: 'Reveal price' });
  const priceBlock = page.locator(PRICE_BLOCK_SELECTOR);

  await dismissCookieBanner(page);

  try {
    await revealButton.waitFor({ state: 'visible', timeout: env.scraperTimeoutMs });
  } catch (error) {
    throw new ScrapeError('REVEAL_BUTTON_NOT_FOUND', 'The store reveal-price control was not found.', {
      retryable: false,
      cause: error,
    });
  }

  const box = await priceBlock.boundingBox();

  if (!box) {
    throw new ScrapeError('PRICE_BLOCK_NOT_INTERACTABLE', 'The store price panel is not interactable.', {
      retryable: true,
    });
  }

  const deadline = Date.now() + env.scraperTimeoutMs;

  while (Date.now() < deadline) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    for (let index = 0; index < REQUIRED_MOUSE_MOVES; index += 1) {
      const x = box.x + 5 + (index % 10) * Math.max(1, (box.width - 10) / 10);
      const y = box.y + 5 + ((index * 3) % 4) * Math.max(1, (box.height - 10) / 4);
      await page.mouse.move(x, y);
      await page.waitForTimeout(MOUSE_MOVE_DELAY_MS);
    }

    await page.waitForTimeout(250);

    if (await priceBlock.evaluate((element) => element.classList.contains('price-success') || element.classList.contains('price-error'))) {
      return;
    }

    if (!(await revealButton.isDisabled())) {
      await dismissCookieBanner(page);
      await page.waitForTimeout(150);
      await revealButton.click();
      return;
    }
  }

  throw new ScrapeError('REVEAL_BUTTON_NOT_READY', 'The store reveal-price control did not become ready before the timeout.', {
    retryable: true,
  });
}

async function waitForPriceResult(page) {
  try {
    await page.waitForFunction(
      (selector) => {
        const priceBlock = document.querySelector(selector);
        if (!priceBlock) {
          return false;
        }

        if (priceBlock.classList.contains('price-error')) {
          return false;
        }

        if (priceBlock.classList.contains('price-success')) {
          const visibleText = [...priceBlock.querySelectorAll('*')]
            .map((element) => element.textContent || '')
            .join(' ')
            .replace(/[\u200B\u00A0]/g, '')
            .trim();
          return /₹\s*[\d,]+(?:\.\d{1,2})?/.test(visibleText);
        }

        return [...priceBlock.querySelectorAll('*')].some((element) => {
          const style = window.getComputedStyle(element);
          const text = (element.textContent || '').replace(/[\u200B\u00A0]/g, '').trim();
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && /₹\s*[\d,]+(?:\.\d{1,2})?/.test(text);
        });
      },
      PRICE_BLOCK_SELECTOR,
      { timeout: env.scraperTimeoutMs },
    );
  } catch (error) {
    throw new ScrapeError('PRICE_RESULT_TIMEOUT', 'The store did not reveal a price before the timeout.', {
      retryable: true,
      cause: error,
    });
  }

  const priceBlock = page.locator(PRICE_BLOCK_SELECTOR);

  if (await priceBlock.evaluate((element) => element.classList.contains('price-error'))) {
    throw new ScrapeError('STORE_PRICE_REQUEST_FAILED', 'The storefront reported that price loading failed.', {
      retryable: true,
    });
  }

  const priceText = await page.evaluate((selector) => {
    const priceBlockElement = document.querySelector(selector);
    if (!priceBlockElement) {
      return '';
    }

    const candidates = [...priceBlockElement.querySelectorAll('*')]
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const text = (element.textContent || '').replace(/[\u200B\u00A0]/g, '').trim();
        if (!text || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false;
        }
        return /₹\s*[\d,]+(?:\.\d{1,2})?/.test(text);
      })
      .sort((left, right) => {
        const leftStyle = window.getComputedStyle(left);
        const rightStyle = window.getComputedStyle(right);
        const leftScore = (left.tagName === 'B' || left.tagName === 'STRONG' ? 3 : 0)
          + (leftStyle.textDecoration.includes('line-through') ? 0 : 2)
          + Number.parseFloat(leftStyle.fontSize || '0');
        const rightScore = (right.tagName === 'B' || right.tagName === 'STRONG' ? 3 : 0)
          + (rightStyle.textDecoration.includes('line-through') ? 0 : 2)
          + Number.parseFloat(rightStyle.fontSize || '0');
        return rightScore - leftScore;
      });

    return candidates[0]?.textContent?.replace(/[\u200B\u00A0]/g, '').trim() ?? '';
  }, PRICE_BLOCK_SELECTOR);

  if (!priceText) {
    throw new ScrapeError('PRICE_SELECTOR_EMPTY', 'The visible store price element is empty.', {
      retryable: false,
    });
  }

  return { priceBlock, priceText };
}

async function scrapeOnce(productUrl, { headed }) {
  const browser = await chromium.launch({ headless: !headed });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(env.scraperTimeoutMs);
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: env.scraperTimeoutMs });
    await performRevealInteraction(page);

    const { priceBlock, priceText } = await waitForPriceResult(page);
    const priceBlockText = await priceBlock.innerText();

    return {
      price: parsePrice(priceText),
      stockStatus: parseStock(priceBlockText),
      scrapedAt: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}

export async function scrapeProduct(product, { headed = env.scraperHeaded, onAttempt } = {}) {
  if (!product?.product_url) {
    throw new ScrapeError('PRODUCT_URL_MISSING', 'Tracked product has no product URL.', { retryable: false });
  }

  console.info(`[SCRAPER] Starting ${product.product_name ?? product.product_url}`);

  const result = await runWithRetries(
    (attemptNumber) => scrapeOnce(product.product_url, { headed, attemptNumber }),
    {
      maxRetries: env.scraperMaxRetries,
      retryDelayMs: env.scraperRetryDelayMs,
      onAttempt,
    },
  );

  if (result.success) {
    console.info(`[SCRAPER] Success for ${product.product_name ?? product.product_url}`);
    return { success: true, ...result.value, attempts: result.attempts };
  }

  console.error(`[SCRAPER] Failed for ${product.product_name ?? product.product_url}: ${result.error.code}`);
  return {
    success: false,
    errorCode: result.error.code,
    error: result.error.message,
    attempts: result.attempts,
  };
}
