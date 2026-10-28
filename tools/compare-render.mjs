/*
 * Pixelvergleich Prototyp gegen Portierung.
 * Rendert dieselben Monster in Chromium mit beiden Renderern und vergleicht die Pixel exakt.
 * Aufruf: npm run compare  (optional: --out <ordner> speichert Vergleichsbilder)
 */
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

// Playwright wird nicht als Abhängigkeit installiert: die Cloud-Umgebung bringt es mit (über NODE_PATH)
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outIdx = process.argv.indexOf('--out');
const outDir = outIdx > 0 ? path.resolve(process.argv[outIdx + 1]) : null;

const bundle = (
  await build({ entryPoints: [path.join(root, 'tools/render-entry.ts')], bundle: true, format: 'iife', globalName: 'WB', write: false, target: 'es2022' })
).outputFiles[0].text;

const PIGS = ['ultra', 'phthalo', 'karmin', 'kadmium', 'siena', 'indigo', 'sepia', 'opera'];
const BPS = ['kriecher', 'flatterer', 'schwebeblase', 'vierbeiner', 'schlange', 'turm', 'krabbe', 'qualle', 'huepfer', 'knolle', 'strahler', 'doppelkopf'];

/* Fälle: Tagesbögen, Zufallsbögen, plus Lasuren, Schlamm und Mutation */
const cases = [];
for (const sheet of ['2026-10-28', '2026-10-29', 'ABC-123', 'K7Q-0ZP']) for (let i = 0; i < 12; i++) cases.push({ sheet, idx: i });
for (let k = 0; k < 24; k++) {
  const glazes = Array.from({ length: 1 + (k % 5) }, (_, j) => ({ p: PIGS[(k * 3 + j) % 8], seed: (k * 2654435761 + j * 40503) >>> 0 }));
  cases.push({ sheet: `G${k}`, idx: k % 12, glazes, mud: k % 3 === 0, mutations: k % 4 === 0 ? 1 + (k % 2) : 0, bp: k % 4 === 0 ? BPS[k % 12] : null });
}

const renderCase = ({ c, size }) => {
  /* läuft im Browser; nutzt globale Funktionen des Prototyps oder das Bündel WB */
  const api = window.WB ?? { makeMonster, renderMonster, humidityFor: (s) => ri(RNG(hashStr('hum:' + s)), 30, 95) };
  const m = api.makeMonster(c.sheet, c.idx, api.humidityFor(c.sheet));
  if (c.glazes) m.glazes = c.glazes;
  if (c.mud) m.mud = true;
  if (c.mutations) m.mutations = c.mutations;
  if (c.bp) m.bp = c.bp;
  const cv = document.createElement('canvas');
  document.body.append(cv);
  const t0 = performance.now();
  api.renderMonster(cv, m, size, c.quality ? { quality: c.quality } : undefined);
  const ms = performance.now() - t0;
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619);
  const png = c.keep ? cv.toDataURL('image/png') : null;
  cv.remove();
  return { hash: h >>> 0, w: cv.width, ms, png, data: c.keepData ? Array.from(d) : null };
};

const browser = await chromium.launch();
let fails = 0,
  total = 0;
const timing = { proto: 0, port: 0, lite: 0 };
for (const dpr of [1, 2]) {
  const ctx = await browser.newContext({ deviceScaleFactor: dpr, viewport: { width: 900, height: 900 } });
  await ctx.route(/^https?:/, (r) => r.abort());
  const proto = await ctx.newPage();
  await proto.goto(pathToFileURL(path.join(root, 'prototype/wetbloom-prototyp.html')).href);
  const port = await ctx.newPage();
  await port.setContent('<!doctype html><html><body></body></html>');
  await port.addScriptTag({ content: bundle });
  for (const [n, c] of cases.entries()) {
    const size = 300;
    const keep = !!outDir && dpr === 2 && n % 6 === 0;
    const a = await proto.evaluate(renderCase, { c: { ...c, keep }, size });
    const b = await port.evaluate(renderCase, { c: { ...c, keep }, size });
    const l = await port.evaluate(renderCase, { c: { ...c, keep, quality: 'lite' }, size });
    timing.proto += a.ms;
    timing.port += b.ms;
    timing.lite += l.ms;
    total++;
    const ok = a.hash === b.hash && a.w === b.w;
    if (!ok) {
      fails++;
      const da = await proto.evaluate(renderCase, { c: { ...c, keepData: true }, size });
      const db = await port.evaluate(renderCase, { c: { ...c, keepData: true }, size });
      let diff = 0;
      for (let i = 0; i < da.data.length; i += 4) if (da.data[i] !== db.data[i] || da.data[i + 1] !== db.data[i + 1] || da.data[i + 2] !== db.data[i + 2] || da.data[i + 3] !== db.data[i + 3]) diff++;
      console.log(`ABWEICHUNG dpr ${dpr} ${JSON.stringify(c)}: ${diff} Pixel`);
    }
    if (keep) {
      mkdirSync(outDir, { recursive: true });
      const name = `${c.sheet}-${c.idx}${c.glazes ? '-g' + c.glazes.length : ''}`;
      for (const [tag, r] of [['prototyp', a], ['port', b], ['lite', l]]) writeFileSync(path.join(outDir, `${name}-${tag}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
    }
  }
  await ctx.close();
}
await browser.close();
const avg = (v) => (v / total).toFixed(1) + ' ms';
console.log(`${total - fails}/${total} Bilder pixelgleich (dpr 1 und 2, ${cases.length} Monster)`);
console.log(`Malzeit im Schnitt: Prototyp ${avg(timing.proto)}, Portierung ${avg(timing.port)}, lite ${avg(timing.lite)}`);
process.exit(fails ? 1 : 0);
