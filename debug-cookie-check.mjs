import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('https://demo.inelabteamdev.com/product/22', { waitUntil: 'domcontentloaded', timeout: 30000 });

const revealButton = page.getByRole('button', { name: 'Reveal price' });
const priceBlock = page.locator('.price-block');
const cookieCandidates = page.locator('button, [role="button"], [class*="cookie"], [id*="cookie"]');
console.log('cookie candidates count:', await cookieCandidates.count());
for (let i = 0; i < await cookieCandidates.count(); i += 1) {
  const element = cookieCandidates.nth(i);
  const text = await element.textContent().catch(() => '');
  const aria = await element.getAttribute('aria-label').catch(() => '');
  const className = await element.getAttribute('class').catch(() => '');
  const id = await element.getAttribute('id').catch(() => '');
  console.log('cookie candidate', i, JSON.stringify({ text: (text || '').trim(), aria, className, id }));
}

console.log('initial button disabled', await revealButton.isDisabled());
const box = await priceBlock.boundingBox();
console.log('box', box);
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 25; i++) {
    const x = box.x + 5 + (i % 10) * Math.max(1, (box.width - 10) / 10);
    const y = box.y + 5 + ((i * 3) % 4) * Math.max(1, (box.height - 10) / 4);
    await page.mouse.move(x, y);
    await page.waitForTimeout(80);
    if (i % 5 === 0) {
      console.log('step', i, 'disabled=', await revealButton.isDisabled(), 'class=', await priceBlock.evaluate((el) => el.className));
    }
  }
}
console.log('after hover disabled', await revealButton.isDisabled());
console.log('revealed output count before click', await page.locator('output').count());

const cookieButton = page.getByRole('button', { name: /accept|agree|allow|continue|ok/i });
console.log('cookie button count', await cookieButton.count());
if (await cookieButton.count()) {
  console.log('cookie button text', await cookieButton.first().textContent());
  await cookieButton.first().click({ timeout: 10000 });
  await page.waitForTimeout(1000);
}

await revealButton.click({ timeout: 30000 });
await page.waitForTimeout(2500);
console.log('price block html', await priceBlock.evaluate((el) => el.outerHTML.slice(0, 2000)));
console.log('output count', await page.locator('output').count());
console.log('output text', await page.locator('output').first().textContent().catch(() => 'NONE'));
console.log('price status', await page.locator('.price-status').textContent().catch(() => 'NONE'));
console.log('stock text sample', await page.locator('.price-status').evaluate((el) => el.textContent).catch(() => 'NONE'));
await browser.close();
