// Renders public/hero-island.webp: the landing page's first island (terrain, scenery, castles and
// camps, no troops) as a picture the page shows at once while the live 3D island loads. Run it
// against the dev server after changing the island, the terrain or the scenery:
//
//   npm run dev                               (in one terminal)
//   node scripts/render-hero-poster.mjs        (in another)
//
// Needs Playwright and its Chromium: `npm i --no-save playwright && npx playwright install chromium`.
// Set CARD_ART_URL to use another server than http://localhost:3000, and PLAYWRIGHT_CHROMIUM to a
// Chromium executable to use instead of Playwright's own.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.CARD_ART_URL ?? 'http://localhost:3000';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is needed: npm i --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1800, height: 900 }, deviceScaleFactor: 1 });
await page.goto(`${base}/dev/hero-poster`, { waitUntil: 'load' });
await page.waitForSelector('body[data-ready="1"]', { timeout: 120000 });
// The 3D canvas itself, transparent where the island isn't
const data = await page.evaluate(() => document.querySelector('#hero-poster canvas').toDataURL('image/webp', 0.8));
await browser.close();
if (!data.startsWith('data:image/webp')) {
  console.error('The browser could not encode WebP');
  process.exit(1);
}
const out = join(process.cwd(), 'public', 'hero-island.webp');
writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
console.log(`Wrote ${out}`);
