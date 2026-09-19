import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('https://demo.inelabteamdev.com/product/22', { waitUntil: 'domcontentloaded', timeout: 30000 });

const priceBlock = page.locator('.price-block');
const revealButton = page.getByRole('button', { name: 'Reveal price' });

function logOverlay(label) {
  return page.evaluate(({ selector, label }) => {
    const overlay = document.querySelector(selector);
    if (!overlay) {
      return { exists: false, label };
    }

    const rect = overlay.getBoundingClientRect();
    const style = window.getComputedStyle(overlay);
    return {
      exists: true,
      label,
      className: overlay.className,
      innerHTML: overlay.innerHTML.slice(0, 400),
      visible: style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0,
      pointerEvents: style.pointerEvents,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      rect: { width: rect.width, height: rect.height, x: rect.x, y: rect.y },
    };
  }, { selector: '.cookie-overlay', label });
}

console.log('initial overlay', await logOverlay('initial'));

const box = await priceBlock.boundingBox();
console.log('box', box);
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
for (let i = 0; i < 30; i += 1) {
  const x = box.x + 5 + (i % 10) * Math.max(1, (box.width - 10) / 10);
  const y = box.y + 5 + ((i * 3) % 4) * Math.max(1, (box.height - 10) / 4);
  await page.mouse.move(x, y);
  await page.waitForTimeout(80);
  if (i % 5 === 0) {
    console.log('step', i, 'disabled=', await revealButton.isDisabled(), 'overlay=', JSON.stringify(await logOverlay(`step-${i}`)));
  }
}
console.log('after hover overlay', await logOverlay('after-hover'));
console.log('reveal enabled?', await revealButton.isDisabled());
console.log('overlay count', await page.locator('.cookie-overlay').count());
await page.evaluate(() => {
  const overlay = document.querySelector('.cookie-overlay');
  if (overlay) {
    overlay.style.pointerEvents = 'none';
    overlay.style.opacity = '0';
    overlay.style.visibility = 'hidden';
    overlay.style.display = 'none';
    overlay.remove();
  }
});
console.log('after remove overlay', await logOverlay('after-remove'));
await revealButton.click({ timeout: 20000 });
await page.waitForTimeout(3000);
console.log('class after click', await priceBlock.evaluate((el) => el.className));
console.log('output count after click', await page.locator('output').count());
console.log('output text', await page.locator('output').first().textContent().catch(() => 'NONE'));
await browser.close();
