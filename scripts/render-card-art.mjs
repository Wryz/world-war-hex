// Renders the card portraits in public/cards/: each troop's 3D model on its home ground, photographed
// from the dev page /dev/card-art. Run it against the dev server after changing a troop's model:
//
//   npm run dev                                   (in one terminal)
//   node scripts/render-card-art.mjs [troop ...]   (in another; all troops when none are named)
//
// Needs Playwright and its Chromium: `npm i --no-save playwright && npx playwright install chromium`.
// Set CARD_ART_URL to use another server than http://localhost:3000, and PLAYWRIGHT_CHROMIUM to a
// Chromium executable to use instead of Playwright's own.
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const base = process.env.CARD_ART_URL ?? 'http://localhost:3000';

// Every troop id, read from the troop list
const source = readFileSync(join(root, 'src', 'lib', 'game', 'troops.ts'), 'utf8');
const list = source.slice(source.indexOf('TROOP_IDS = ['), source.indexOf('] as const'));
const allIds = [...list.matchAll(/'([a-z_]+)'/g)].map(match => match[1]);
const requested = process.argv.slice(2);
const ids = requested.length > 0 ? requested.filter(id => allIds.includes(id)) : allIds;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is needed: npm i --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

const outDir = join(root, 'public', 'cards');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 600, height: 500 }, deviceScaleFactor: 1 });
let failed = 0;
for (const id of ids) {
  try {
    await page.goto(`${base}/dev/card-art?type=${id}`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-ready="1"]', { timeout: 90000 });
    await page.locator('#card-art').screenshot({ path: join(outDir, `${id}.jpg`), type: 'jpeg', quality: 84 });
    console.log(`  ${id}`);
  } catch (error) {
    failed++;
    console.error(`  ${id} failed: ${error.message.split('\n')[0]}`);
  }
}
await browser.close();
console.log(`Rendered ${ids.length - failed} of ${ids.length} portraits into public/cards/`);
process.exit(failed > 0 ? 1 : 0);
