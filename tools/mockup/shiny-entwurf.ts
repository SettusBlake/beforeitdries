/*
 * Entwurfsbogen Shiny (nur für docs/entwuerfe): die fünf Stile aus src/client/renderer/styles.ts
 * auf den neuen Formen, auf einem gemalten Monster, klein wie im Deck, mit Malzeit.
 */
import { renderStyled } from '../../src/client/renderer/shiny';
import { renderMonster } from '../../src/client/renderer/watercolor';
import type { Pt } from '../../src/shared/data';
import { STYLES, type StyleId } from '../../src/shared/dice';
import { encodeDrawing } from '../../src/shared/drawn';
import { humidityFor, makeMonster, type Monster } from '../../src/shared/monster';

const gen2 = (sheet: string, idx: number): Monster => ({ ...makeMonster(sheet, idx, humidityFor(sheet)), gen: 2 });
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
function tile(m: Monster, style: StyleId | null, size: number, cap: string, deco = false): HTMLElement {
  const f = el('figure');
  const c = el('canvas');
  if (style) renderStyled(c, m, style, size, { dpr: 2, deco });
  else renderMonster(c, m, size, { dpr: 2 });
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

/** Ein gemaltes Monster: Falterhälfte mit Mirror, Flecken, Fühler */
function drawn(): Monster {
  const half: Pt[] = [
    [0.5, 0.32],
    [0.3, 0.2],
    [0.12, 0.22],
    [0.15, 0.48],
    [0.3, 0.58],
    [0.18, 0.74],
    [0.3, 0.86],
    [0.44, 0.76],
    [0.5, 0.66],
  ];
  const spot: Pt[] = Array.from({ length: 16 }, (_, i) => [0.27 + Math.cos((i / 15) * 6.1) * 0.06, 0.4 + Math.sin((i / 15) * 6.1) * 0.06]);
  const feeler: Pt[] = [
    [0.47, 0.3],
    [0.42, 0.18],
    [0.36, 0.1],
  ];
  return { ...gen2('drawn-moth', 4), draw: encodeDrawing({ mirror: true, face: [0.5, 0.42], strokes: [half, spot, feeler] }) };
}

async function main(): Promise<void> {
  await Promise.all(['40px Caveat', '400 20px "Young Serif"', 'italic 20px "Young Serif"', '900 20px Figtree'].map((f) => document.fonts.load(f)));
  const head = el('header');
  head.append(el('p', 'eyebrow', 'Before It Dries · draft'), el('h1', '', 'Shiny: five rare hands'));
  document.body.append(head);

  // Ein Monster, sechs Hände, groß mit Rahmen und Text
  const hero = gen2('dip-shiny7', 3);
  const s1 = section('One pull, six hands', 'Big card and dip: with frame, caption and plaque. Same species, same stats, only the look changes.');
  const g1 = row(s1, 'grid six');
  g1.append(tile(hero, null, 205, 'Watercolour · normal'));
  for (const st of STYLES) g1.append(tile(hero, st.k, 205, `${st.label} · ${st.odds}`, true));

  // Jeder Stil auf neuen Formen, dazu ein gemaltes Monster
  const pulls = Array.from({ length: 7 }, (_, i) => gen2(`dip-${(65537 * (i + 5)).toString(36)}`, (i * 5 + 2) % 12));
  const mine = drawn();
  const s2 = section('Every style on the new shapes', 'Seven pulls and one drawn monster (last tile) per style, small without frame (collection, deck, duel). Faces from 2b in each technique.');
  for (const st of STYLES) {
    const g = row(s2);
    for (const m of pulls) g.append(tile(m, st.k, 150, ''));
    g.append(tile(mine, st.k, 150, `${st.label} · drawn`));
  }
  const gw = row(s2);
  for (const m of pulls) gw.append(tile(m, null, 150, ''));
  gw.append(tile(mine, null, 150, 'Watercolour · drawn'));

  // Klein wie im Deck und in der Sammlung
  const s3 = section('Small, as in the deck (46 px) and the collection (64 px)', 'Readable at a glance? Watercolour first, then the five styles.');
  const g3 = row(s3, 'tiny');
  const small = pulls[1]!;
  for (const st of [null, ...STYLES.map((x) => x.k)]) {
    const box = el('div', 'pair');
    box.append(tile(small, st, 64, ''), tile(small, st, 46, ''));
    box.append(el('small', '', st ? STYLES.find((x) => x.k === st)!.label : 'Watercolour'));
    g3.append(box);
  }

  // Malzeit
  const many = Array.from({ length: 12 }, (_, i) => gen2(`t-${(2654435761 * (i + 1)).toString(36)}`, i % 12));
  const c = el('canvas');
  const time = (fn: (m: Monster) => void) => {
    many.forEach(fn);
    const t0 = performance.now();
    many.forEach(fn);
    return (performance.now() - t0) / many.length;
  };
  const base = time((m) => renderMonster(c, m, 150, { dpr: 2 }));
  const s4 = section('Paint time', '12 pulls at 150 px (dpr 2), then the big card at 300 px with frame. Goal: oil at most 3 times watercolour.');
  const tb = el('table');
  const tr0 = el('tr');
  tr0.append(el('td', '', 'Watercolour'), el('td', '', base.toFixed(1) + ' ms'), el('td', '', '1.0×'), el('td', '', ''));
  tb.append(tr0);
  for (const st of STYLES) {
    const t = time((m) => renderStyled(c, m, st.k, 150, { dpr: 2, deco: false }));
    const big = time((m) => renderStyled(c, m, st.k, 300, { dpr: 2, deco: true }));
    const tr = el('tr');
    tr.append(el('td', '', st.label), el('td', '', t.toFixed(1) + ' ms'), el('td', '', (t / base).toFixed(1) + '×'), el('td', '', `big ${big.toFixed(0)} ms`));
    tb.append(tr);
  }
  s4.append(tb);
  (window as unknown as { done: boolean }).done = true;
}
void main();
