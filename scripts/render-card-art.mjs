// Renders each troop's 3D model on its own, with a transparent background (WebP), from the dev page
// /dev/card-art, into art/card-renders/: the references scripts/generate-card-art.ts paints the card
// pictures from. A troop without a painting yet (in art/card-ai/) gets its render as its card
// picture in public/cards/ too. Run it against the dev server after changing a troop's model:
//
//   npm run dev                                   (in one terminal)
//   node scripts/render-card-art.mjs [troop ...]   (in another; all troops when none are named)
//
// Needs Playwright and its Chromium: `npm i --no-save playwright && npx playwright install chromium`.
// Set CARD_ART_URL to use another server than http://localhost:3000, and PLAYWRIGHT_CHROMIUM to a
// Chromium executable to use instead of Playwright's own.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const renderDir = join(root, 'art', 'card-renders');
const paintingDir = join(root, 'art', 'card-ai');
const outDir = join(root, 'public', 'cards');
mkdirSync(renderDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 600, height: 500 }, deviceScaleFactor: 1 });
let failed = 0;
for (const id of ids) {
  try {
    await page.goto(`${base}/dev/card-art?type=${id}`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-ready="1"]', { timeout: 90000 });
    // The 3D canvas itself, transparent where the troop isn't
    const data = await page.evaluate(() => document.querySelector('#card-art canvas').toDataURL('image/webp', 0.86));
    if (!data.startsWith('data:image/webp')) throw new Error('the browser could not encode WebP');
    const render = Buffer.from(data.split(',')[1], 'base64');
    writeFileSync(join(renderDir, `${id}.webp`), render);
    const painted = existsSync(join(paintingDir, `${id}.webp`));
    if (!painted) writeFileSync(join(outDir, `${id}.webp`), render);
    console.log(`  ${id}${painted ? ' (keeps its painting)' : ''}`);
  } catch (error) {
    failed++;
    console.error(`  ${id} failed: ${error.message.split('\n')[0]}`);
  }
}
await browser.close();
console.log(`Rendered ${ids.length - failed} of ${ids.length} troops into art/card-renders/`);
process.exit(failed > 0 ? 1 : 0);
