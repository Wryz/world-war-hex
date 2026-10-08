// Paints the card pictures in public/cards/ with an AI image model (Google's Gemini), one per troop,
// using the troop's 3D render (art/card-renders/, from scripts/render-card-art.mjs) as the reference
// for how it looks, so each painting resembles the troop on the board.
//
//   GEMINI_API_KEY=... npx tsx scripts/generate-card-art.ts [troop ...] [--force]
//
// Every troop is painted when none are named. Each painting is kept as it came (as a WebP) in art/card-ai/ (so a
// re-run only pays for the troops not painted yet; --force paints them again), then its flat magenta
// background is keyed out and the troop is fitted into the card's picture as a transparent WebP,
// like the renders it replaces: the card draws its own background (the faction's colour and the
// frame's pattern) behind it.
// GEMINI_IMAGE_MODEL picks another model than gemini-2.5-flash-image.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { FACTIONS, TROOPS, TROOP_CLASSES, TROOP_IDS, TroopId } from '../src/lib/game/troops';
import { CARD_ART_HEIGHT, CARD_ART_SCALE, CARD_ART_WIDTH } from '../src/components/game/cards/cardArt';

const root = process.cwd();
const RENDERS = join(root, 'art', 'card-renders');
const PAINTINGS = join(root, 'art', 'card-ai');
const OUT = join(root, 'public', 'cards');

const MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.5-flash-image';
const API_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

// The card picture, in pixels, and how much of it the troop fills (as the renders do)
const WIDTH = Math.round(CARD_ART_WIDTH * CARD_ART_SCALE);
const HEIGHT = Math.round(CARD_ART_HEIGHT * CARD_ART_SCALE);
const FILL_HEIGHT = 0.8;
const FILL_WIDTH = 0.86;

// The background the model paints on, keyed out afterwards. Pixels this close to it (RGB distance)
// are fully clear, and from here to SOLID they fade in.
const KEY = [255, 0, 255];
const CLEAR = 70;
const SOLID = 150;

const describe = (id: TroopId) => {
  const troop = TROOPS[id];
  const faction = FACTIONS[troop.faction];
  return `${troop.name}: ${TROOP_CLASSES[troop.troopClass].name.toLowerCase()} of ${faction.title} (${faction.description}) ` +
    `- ${troop.role.toLowerCase()}. ${troop.lore}`;
};

const prompt = (id: TroopId) => [
  `Paint the character card art for a fantasy strategy card game. The character: ${describe(id)}`,
  'The attached image is the character\'s 3D game model: keep its look - silhouette, outfit, armour, weapons, colours, ' +
    'creature type and proportions - so players recognise it, but paint it as a polished, detailed, hand-painted fantasy ' +
    'illustration (stylised and colourful, like a premium mobile card game), with more detail and character than the model.',
  'Show the whole character (full body, or the whole creature) in a dynamic three-quarter view, centred, filling most of the ' +
    'image with a small margin all round. If it is a group (a unit of soldiers), show one representative member.',
  'Background: one flat, solid, pure magenta colour (#FF00FF) everywhere, with no scenery, no ground, no shadow, no glow, no ' +
    'text, no border and no frame. Do not use magenta or pink anywhere on the character itself.'
].join('\n\n');

// The reference render on a neutral grey, as a PNG
const reference = async (id: TroopId) => {
  const file = join(RENDERS, `${id}.webp`);
  if (!existsSync(file)) throw new Error(`no reference render at ${file} (run scripts/render-card-art.mjs)`);
  return (await sharp(file).flatten({ background: '#8a8f98' }).png().toBuffer()).toString('base64');
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// One painting from the model, as image bytes (retrying when rate-limited or briefly unavailable)
const paint = async (id: TroopId): Promise<Buffer> => {
  const body = {
    contents: [{ parts: [{ text: prompt(id) }, { inlineData: { mimeType: 'image/png', data: await reference(id) } }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } }
  };
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY! },
      body: JSON.stringify(body)
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 5) {
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    const json = await response.json() as {
      error?: { message?: string };
      candidates?: { finishReason?: string; content?: { parts?: { inlineData?: { data?: string } }[] } }[];
    };
    if (!response.ok) throw new Error(`${response.status}: ${json.error?.message ?? 'request failed'}`);
    const data = json.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data)?.inlineData?.data;
    if (!data) throw new Error(`no image in the reply (${json.candidates?.[0]?.finishReason ?? 'no candidates'})`);
    return Buffer.from(data, 'base64');
  }
};

// Key out the magenta background, crop to the troop and fit it into the card picture
const toCardArt = async (painting: Buffer): Promise<Buffer> => {
  const { data, info } = await sharp(painting).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let left = width, top = height, right = -1, bottom = -1;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const [r, g, b] = [data[o], data[o + 1], data[o + 2]];
    const distance = Math.hypot(r - KEY[0], g - KEY[1], b - KEY[2]);
    const alpha = Math.max(0, Math.min(1, (distance - CLEAR) / (SOLID - CLEAR)));
    if (alpha < 1) {
      // Take the magenta glow off the edges: no more red and blue than green allows
      const spill = Math.min(r, b) - g;
      if (spill > 0) {
        data[o] = r - spill * (1 - alpha);
        data[o + 2] = b - spill * (1 - alpha);
      }
    }
    data[o + 3] = Math.round(data[o + 3] * alpha);
    if (alpha > 0.1) {
      const x = i % width, y = Math.floor(i / width);
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new Error('nothing left after removing the background');

  const cutout = await sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png()
    .toBuffer();
  const scale = Math.min((HEIGHT * FILL_HEIGHT) / (bottom - top + 1), (WIDTH * FILL_WIDTH) / (right - left + 1));
  const fitted = await sharp(cutout)
    .resize(Math.round((right - left + 1) * scale), Math.round((bottom - top + 1) * scale), { kernel: 'lanczos3' })
    .toBuffer({ resolveWithObject: true });
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{
      input: fitted.data,
      left: Math.round((WIDTH - fitted.info.width) / 2),
      top: Math.round((HEIGHT - fitted.info.height) / 2)
    }])
    .webp({ quality: 86, alphaQuality: 90 })
    .toBuffer();
};

const main = async () => {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const named = args.filter(arg => !arg.startsWith('--'));
  const unknown = named.filter(id => !(TROOP_IDS as readonly string[]).includes(id));
  if (unknown.length > 0) throw new Error(`unknown troops: ${unknown.join(', ')}`);
  const ids = (named.length > 0 ? named : [...TROOP_IDS]) as TroopId[];

  mkdirSync(PAINTINGS, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  let failed = 0;
  for (const id of ids) {
    const kept = join(PAINTINGS, `${id}.webp`);
    try {
      let painting: Buffer;
      if (existsSync(kept) && !force) {
        painting = readFileSync(kept);
      } else {
        if (!API_KEY) throw new Error('GEMINI_API_KEY is not set');
        painting = await sharp(await paint(id)).webp({ quality: 92 }).toBuffer();
        writeFileSync(kept, painting);
      }
      writeFileSync(join(OUT, `${id}.webp`), await toCardArt(painting));
      console.log(`  ${id}`);
    } catch (error) {
      failed++;
      console.error(`  ${id} failed: ${(error as Error).message}`);
    }
  }
  console.log(`Painted ${ids.length - failed} of ${ids.length} card pictures into public/cards/`);
  process.exit(failed > 0 ? 1 : 0);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
