/*
 * Films one take of Hex Hordes for a reel (adapted from the make-reels capture driver): the battle
 * in headless Chromium on a virtual clock, stepped one frame at a time by director.js, each frame
 * screenshot (the HTML HUD over the 3D board) and streamed into ffmpeg; then the take's logged
 * sounds rendered offline, in sync. Writes <out>/<name>.mp4 (silent video), <name>.wav (game
 * sound) and <name>.json (shot, sound log, moments, end of battle).
 *
 *   NODE_PATH=$(npm root -g) GAME_URL=http://localhost:3000 node capture.cjs '<shot json>' [outDir]
 *
 * A shot: { name, level, start: { round | castleBelow | bossBelow | side }, seconds, tail, speed }.
 * The game must be served from a production build (next build && next start).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const shot = JSON.parse(process.argv[2]);
const outDir = path.resolve(process.argv[3] ?? 'reels/out');
const director = path.resolve(process.env.DIRECTOR ?? path.join(__dirname, 'director.js'));
const profile = JSON.parse(fs.readFileSync(path.join(__dirname, 'profile.json'), 'utf8'));
if (shot.deck) profile.deck = shot.deck;
const base = (process.env.GAME_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const url = `${base}/play?level=${shot.level}`;
// A phone-sized page drawn at 2x: the game's phone layout, filmed at 1080x1920
const W = 540;
const H = 960;
const SCALE = 2;
const FPS = 30;
const port = 5200 + (process.pid % 700);
fs.mkdirSync(outDir, { recursive: true });
const file = (ext) => path.join(outDir, `${shot.name}.${ext}`);

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', String(FPS), '-i', '-',
  '-vf', `scale=${W * SCALE}:${H * SCALE}`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', file('mp4')],
  { stdio: ['pipe', 'inherit', 'inherit'] });
const writeFrame = (buf) => new Promise((r) => (ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r)));

let wav = null;
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    if (req.url === '/wav') wav = Buffer.concat(chunks);
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    res.end('ok');
  });
});

(async () => {
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log(`[${shot.name}] pageerror: ${e.message}`));
  page.on('console', (m) => (m.type() === 'warning' || m.type() === 'error' || m.text().startsWith('reel:')) && !/GL Driver|WebGL|GPU stall/.test(m.text()) && console.log(`[${shot.name}] ${m.text()}`));
  await page.addInitScript(({ profile, speed }) => {
    window.__reelProfile = profile;
    window.__reelSpeed = speed;
  }, { profile, speed: shot.speed ?? 1 });
  await page.addInitScript({ path: director });
  await page.goto(url);
  await page.waitForFunction(() => window.__reel && window.__reel.ready(), null, { timeout: 240000, polling: 500 });
  await page.evaluate((o) => window.__reel.setup(o), shot);
  const cdp = await context.newCDPSession(page);

  const t0 = Date.now();
  let st;
  for (;;) {
    st = await page.evaluate(async () => {
      await window.__reel.step();
      return window.__reel.state();
    });
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, fromSurface: true });
    await writeFrame(Buffer.from(data, 'base64'));
    if (st.frame % 30 === 0) console.log(`[${shot.name}] ${st.t.toFixed(1)}s end=${st.koAt} (${((Date.now() - t0) / st.frame).toFixed(0)} ms/frame)`);
    const over = st.over || (st.koAt >= 0 && st.t >= st.koAt + (shot.tail ?? 4));
    if (over || st.t >= (shot.seconds ?? 30)) break;
  }
  const seconds = st.frame / FPS;
  await page.evaluate(async ({ port, seconds }) => {
    const bytes = await window.__reel.renderAudio(seconds);
    if (bytes) await fetch(`http://127.0.0.1:${port}/wav`, { method: 'POST', body: bytes });
  }, { port, seconds });
  const log = await page.evaluate(() => ({ events: window.__reel.events, marks: window.__reel.marks, koAt: window.__reel.koAt, winner: window.__reel.winner, gameStart: window.__reel.gameStart }));
  fs.writeFileSync(file('json'), JSON.stringify({ shot, seconds, fps: FPS, ...log }, null, 1));
  if (wav) fs.writeFileSync(file('wav'), wav);
  await browser.close();
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  server.close();
  console.log(`[${shot.name}] done: ${seconds.toFixed(1)}s, ${log.marks.length} moments, ${log.events.length} sounds, end at ${log.koAt} winner ${log.winner}`);
})().catch((e) => {
  console.error(`[${shot.name}] ${e.stack ?? e}`);
  process.exit(1);
});
