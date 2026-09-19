import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('product') || url.includes('price') || url.includes('api/') || url.includes('stock') || url.includes('inventory')) {
    console.log('RESPONSE', response.status(), url);
  }
});

await page.goto('https://demo.inelabteamdev.com/product/22', { waitUntil: 'domcontentloaded', timeout: 30000 });
const priceBlock = page.locator('.price-block');
const button = page.getByRole('button', { name: 'Reveal price' });
const box = await priceBlock.boundingBox();
console.log('initial class', await priceBlock.evaluate((el) => el.className));
console.log('initial output count', await page.locator('output').count());
console.log('button disabled before', await button.isDisabled());

await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
for (let i = 0; i < 60; i++) {
  const x = box.x + 5 + (i % 10) * Math.max(1, (box.width - 10) / 10);
  const y = box.y + 5 + ((i * 3) % 4) * Math.max(1, (box.height - 10) / 4);
  await page.mouse.move(x, y);
  await page.waitForTimeout(100);
  if (i % 10 === 0) {
    console.log('STEP', i, 'disabled', await button.isDisabled(), 'class', await priceBlock.evaluate((el) => el.className), 'output', await page.locator('output').count());
  }
}
console.log('after hover disabled', await button.isDisabled());
console.log('after hover class', await priceBlock.evaluate((el) => el.className));
console.log('after hover output count', await page.locator('output').count());
console.log('clicking reveal');
await button.click({ timeout: 30000 });
await page.waitForTimeout(5000);
console.log('after click class', await priceBlock.evaluate((el) => el.className));
console.log('after click output count', await page.locator('output').count());
console.log('after click html', await priceBlock.evaluate((el) => el.outerHTML.slice(0, 2500)));
await browser.close();
