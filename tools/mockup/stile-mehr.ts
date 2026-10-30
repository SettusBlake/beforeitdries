/*
 * Entwurfsbogen „Mehr Stile“ (nur für docs/entwuerfe): Anime neu in zwei Szenen neben dem bisherigen Anime,
 * dazu acht Kandidaten für weitere Shiny-Stile aus src/client/renderer/styles-more.ts, groß, klein und wie im Deck, mit Malzeit.
 */
import { renderMore, type MoreStyle } from '../../src/client/renderer/styles-more';
import { renderStyled } from '../../src/client/renderer/shiny';
import { renderMonster } from '../../src/client/renderer/watercolor';
import { humidityFor, makeMonster, type Monster } from '../../src/shared/monster';

const gen2 = (sheet: string, idx: number): Monster => ({ ...makeMonster(sheet, idx, humidityFor(sheet)), gen: 2 });
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
type Kind = MoreStyle | 'anime_now' | 'water';
function tile(m: Monster, k: Kind, size: number, cap: string, deco = false): HTMLElement {
  const f = el('figure');
  const c = el('canvas');
  if (k === 'anime_now') renderStyled(c, m, 'anime', size, { dpr: 2, deco });
  else if (k === 'water') renderMonster(c, m, size, { dpr: 2 });
  else renderMore(c, m, k, size, { dpr: 2, deco });
  c.style.width = c.style.height = size + 'px';
  f.append(c);
  if (cap) f.append(el('figcaption', '', cap));
  return f;
}
function section(title: string, note: string): HTMLElement {
  const s = el('section');
  s.append(el('h2', '', title), el('p', 'note', note));
  document.body.append(s);
  return s;
}
const row = (s: HTMLElement, cls = 'grid') => {
  const g = el('div', cls);
  s.append(g);
  return g;
};
const NEW: [MoreStyle, string, string][] = [
  ['pixel', 'A · Pixel', '16-bit sprite, 48 × 48 dots, own small palette, dithered sky, RPG box on the card'],
  ['ukiyoe', 'B · Ukiyo-e', 'Japanese woodblock print: washi, bokashi sky, mist bands, wave scales, cartouche and seal'],
  ['stained', 'C · Stained glass', 'Lead lines, glass panes lit from above, gothic arch on the card'],
  ['neon', 'D · Neon', 'Glass tubes on a dark brick wall, glow, gaps, cable, name as a neon sign'],
  ['blueprint', 'E · Blueprint', 'White lines on blue paper, centre lines, dimensions, title block “drawn: M. Sepia”'],
  ['crayon', 'F · Crayon', 'Wax crayon by a child: scribbles over the lines, stick legs, sun with a face'],
  ['papercut', 'G · Papercut', 'Layered cut paper with soft shadows, moon, hills, paper label'],
  ['mosaic', 'H · Mosaic', 'Roman mosaic: tesserae on a grid, light grout, border on the card'],
];

async function main(): Promise<void> {
  await Promise.all(['40px Caveat', '400 20px "Young Serif"', '900 20px Figtree', '700 20px "JetBrains Mono"'].map((f) => document.fonts.load(f)));
  const head = el('header');
  head.append(el('p', 'eyebrow', 'Before It Dries · draft'), el('h1', '', 'More hands: anime redone, eight new styles'));
  document.body.append(head);
  const heroes = [gen2('dip-shiny7', 3), gen2(`dip-${(65537 * 6).toString(36)}`, 7), gen2(`dip-${(65537 * 9).toString(36)}`, 1)];
  const pulls = Array.from({ length: 6 }, (_, i) => gen2(`dip-${(65537 * (i + 5)).toString(36)}`, (i * 5 + 2) % 12));

  const s1 = section('Anime: now and redone', 'Left the anime we have (soft plastic gloss, thin lines, small eyes). Then two new versions: cel shading with a hard edge, rim light, coloured line with weight, big eyes with lash and two glints, blush hatching. Scene 1 sky and clouds, scene 2 speed lines.');
  for (const m of heroes) {
    const g = row(s1, 'grid three');
    g.append(tile(m, 'anime_now', 300, 'Anime now', true), tile(m, 'anime_sky', 300, 'New 1 · sky', true), tile(m, 'anime_focus', 300, 'New 2 · speed lines', true));
  }
  for (const k of ['anime_now', 'anime_sky', 'anime_focus'] as const) {
    const g = row(s1);
    for (const m of pulls) g.append(tile(m, k, 150, ''));
    const box = el('div', 'pair');
    box.append(tile(pulls[1]!, k, 64, ''), tile(pulls[1]!, k, 46, ''), el('small', '', k === 'anime_now' ? 'now' : k === 'anime_sky' ? 'new 1' : 'new 2'));
    g.append(box);
  }

  const s2 = section('Eight candidates for new styles', 'Same pulls in every row: two big cards with frame and text, six small without (collection, duel), and deck size. Pick the ones you like, the rest goes.');
  for (const [k, title, note] of NEW) {
    s2.append(el('h3', '', title), el('p', 'note', note));
    const g = row(s2, 'grid big');
    g.append(tile(heroes[0]!, k, 230, '', true), tile(heroes[1]!, k, 230, '', true));
    const g2 = el('div', 'smalls');
    for (const m of pulls) g2.append(tile(m, k, 112, ''));
    const box = el('div', 'pair');
    box.append(tile(pulls[1]!, k, 64, ''), tile(pulls[1]!, k, 46, ''));
    g2.append(box);
    g.append(g2);
  }

  // Malzeit
  const many = Array.from({ length: 10 }, (_, i) => gen2(`t-${(2654435761 * (i + 1)).toString(36)}`, i % 12));
  const c = el('canvas');
  // Ein Bildpunkt lesen, damit die Leinwand wirklich fertig gemalt ist
  const flush = () => c.getContext('2d')!.getImageData(0, 0, 1, 1);
  const time = (fn: (m: Monster) => void) => {
    many.forEach((m) => {
      fn(m);
      flush();
    });
    const t0 = performance.now();
    many.forEach((m) => {
      fn(m);
      flush();
    });
    return (performance.now() - t0) / many.length;
  };
  const base = time((m) => renderMonster(c, m, 150, { dpr: 2 }));
  const s3 = section('Paint time', '10 pulls at 150 px (dpr 2), then the big card at 300 px with frame. Goal: at most 3 times watercolour.');
  const tb = el('table');
  const tr0 = el('tr');
  tr0.append(el('td', '', 'Watercolour'), el('td', '', base.toFixed(1) + ' ms'), el('td', '', '1.0×'), el('td', '', ''));
  tb.append(tr0);
  for (const [k, title] of [['anime_sky', 'Anime new 1'], ['anime_focus', 'Anime new 2'], ...NEW] as [MoreStyle, string][]) {
    const t = time((m) => renderMore(c, m, k, 150, { dpr: 2 }));
    const big = time((m) => renderMore(c, m, k, 300, { dpr: 2, deco: true }));
    const tr = el('tr');
    tr.append(el('td', '', title), el('td', '', t.toFixed(1) + ' ms'), el('td', '', (t / base).toFixed(1) + '×'), el('td', '', `big ${big.toFixed(0)} ms`));
    tb.append(tr);
  }
  s3.append(tb);
  (window as unknown as { done: boolean }).done = true;
}
void main();
