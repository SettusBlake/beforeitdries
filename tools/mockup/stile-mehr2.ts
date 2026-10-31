/*
 * Entwurfsbogen Graffiti und Jugendstil-Karte (nur für docs/entwuerfe, 31.10.2026): zwei weitere Shiny-Stile aus
 * src/client/renderer/styles-more.ts, groß mit Rahmen, klein ohne, wie im Deck, mit Malzeit. Noch nicht im Spiel.
 */
import { renderMore, type MoreStyle } from '../../src/client/renderer/styles-more';
import { renderMonster } from '../../src/client/renderer/watercolor';
import { humidityFor, makeMonster, type Monster } from '../../src/shared/monster';

const gen2 = (sheet: string, idx: number): Monster => ({ ...makeMonster(sheet, idx, humidityFor(sheet)), gen: 2 });
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
function tile(m: Monster, k: MoreStyle | null, size: number, cap: string, deco = false): HTMLElement {
  const f = el('figure');
  const c = el('canvas');
  if (k) renderMore(c, m, k, size, { dpr: 2, deco });
  else renderMonster(c, m, size, { dpr: 2 });
  c.style.width = c.style.height = size + 'px';
  f.append(c);
  if (cap) f.append(el('figcaption', '', cap));
  return f;
}
const STYLES: [MoreStyle, string, string][] = [
  ['graffiti', 'I · Graffiti', 'Spray paint on a concrete wall: old tags half buffed, overspray, 3D shadow, double outline, fade and drips, cool heavy-lidded eyes. Card: name as a bubble tag with a crown, serial scribbled in the corner'],
  ['nouveau', 'J · Art Nouveau card', 'Poster around 1900: big halo with rings, rays and stones, lilies with whiplash stems, muted colours, brown line, calm half-closed eyes. Card: arch, spirals, title panel and number plate'],
];

async function main(): Promise<void> {
  await Promise.all(['40px Caveat', '400 20px "Young Serif"', '900 20px Figtree', '700 20px "JetBrains Mono"'].map((f) => document.fonts.load(f)));
  const head = el('header');
  head.append(el('p', 'eyebrow', 'Before It Dries · draft'), el('h1', '', 'Two more hands: Graffiti and Art Nouveau'));
  document.body.append(head);
  const heroes = [gen2('dip-shiny7', 3), gen2(`dip-${(65537 * 6).toString(36)}`, 7), gen2(`dip-${(65537 * 9).toString(36)}`, 1)];
  const pulls = Array.from({ length: 6 }, (_, i) => gen2(`dip-${(65537 * (i + 5)).toString(36)}`, (i * 5 + 2) % 12));
  for (const [k, title, note] of STYLES) {
    const s = el('section');
    s.append(el('h2', '', title), el('p', 'note', note));
    const g = el('div', 'grid three');
    for (const m of heroes) g.append(tile(m, k, 300, '', true));
    s.append(g);
    const g2 = el('div', 'grid');
    for (const m of pulls) g2.append(tile(m, k, 150, ''));
    const box = el('div', 'pair');
    box.append(tile(pulls[1]!, k, 64, ''), tile(pulls[1]!, k, 46, ''), el('small', '', 'collection · deck'));
    g2.append(box);
    s.append(g2);
    document.body.append(s);
  }
  // Malzeit (ein Bildpunkt lesen, damit wirklich fertig gemalt ist)
  const many = Array.from({ length: 10 }, (_, i) => gen2(`t-${(2654435761 * (i + 1)).toString(36)}`, i % 12));
  const c = el('canvas');
  const flush = () => c.getContext('2d')!.getImageData(0, 0, 1, 1);
  const time = (fn: (m: Monster) => void) => {
    many.forEach((m) => (fn(m), flush()));
    const t0 = performance.now();
    many.forEach((m) => (fn(m), flush()));
    return (performance.now() - t0) / many.length;
  };
  const base = time((m) => renderMonster(c, m, 150, { dpr: 2 }));
  const s3 = el('section');
  s3.append(el('h2', '', 'Paint time'), el('p', 'note', '10 pulls at 150 px (dpr 2), then the big card at 300 px with frame.'));
  const tb = el('table');
  const tr0 = el('tr');
  tr0.append(el('td', '', 'Watercolour'), el('td', '', base.toFixed(1) + ' ms'), el('td', '', '1.0×'), el('td', '', ''));
  tb.append(tr0);
  for (const [k, title] of STYLES) {
    const t = time((m) => renderMore(c, m, k, 150, { dpr: 2 }));
    const big = time((m) => renderMore(c, m, k, 300, { dpr: 2, deco: true }));
    const tr = el('tr');
    tr.append(el('td', '', title), el('td', '', t.toFixed(1) + ' ms'), el('td', '', (t / base).toFixed(1) + '×'), el('td', '', `big ${big.toFixed(0)} ms`));
    tb.append(tr);
  }
  s3.append(tb);
  document.body.append(s3);
  (window as unknown as { done: boolean }).done = true;
}
void main();
