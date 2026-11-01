/*
 * Entwurfsbogen „Elemente“ (nur für docs/entwuerfe, docs/entwuerfe/elemente-vorschlag.md): sechs Elemente in Malersprache,
 * Ring wie Schere-Stein-Papier, Abzeichen auf der Karte, Vorschau beim Zielen. Echte Kleckse aus dem Spiel.
 * Bauen: npx esbuild tools/mockup/elemente-entwurf.ts --bundle --format=iife --outfile=tools/mockup/elemente-entwurf.js
 */
import { renderMonster } from '../../src/client/renderer/watercolor';
import { dieUnit, find } from '../../src/shared/duel/rules';
import { PIG, type BlueprintId, type PigmentId } from '../../src/shared/data';
import { RNG } from '../../src/shared/rng';

type El = { k: string; name: string; de: string; col: string; icon: string; beats: string; little: string };
const E: El[] = [
  { k: 'wash', name: 'Wash', de: 'Wasser', col: '#2f74b5', icon: '<path d="M12 3c3.5 4.6 5.5 7.4 5.5 10a5.5 5.5 0 0 1-11 0c0-2.6 2-5.4 5.5-10z" fill="#fff"/><path d="M8.6 14.2c.6 1.6 1.8 2.4 3.4 2.6" stroke="#2f74b5" stroke-width="1.4" fill="none" stroke-linecap="round"/>', beats: 'puts out Vermilion', little: 'rusts Gilt' },
  { k: 'vermilion', name: 'Vermilion', de: 'Feuer', col: '#c8502a', icon: '<path d="M12 2.8c1 3.4 4.8 5.2 4.8 9.8a4.8 4.8 0 0 1-9.6 0c0-2.4 1.2-3.8 2.2-4.8.2 1.8 1 2.6 2 2.8-.6-2.6.2-5.4.6-7.8z" fill="#fff"/>', beats: 'melts Gilt', little: 'burns Sap' },
  { k: 'gilt', name: 'Gilt', de: 'Metall', col: '#a8842c', icon: '<path d="M4 15l4-7h8l4 7z" fill="#fff"/><path d="M8 8l2 7M16 8l-2 7" stroke="#a8842c" stroke-width="1.1"/>', beats: 'cuts Sap', little: 'digs Ochre' },
  { k: 'sap', name: 'Sap', de: 'Holz', col: '#3f8a3a', icon: '<path d="M12 20V10M12 13c-4-1-6-4-6-8 4 0 6 3 6 8zm0 2c3-1 5-3.5 5-7-3.4 0-5 2.6-5 7z" fill="#fff" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>', beats: 'splits Ochre', little: 'soaks up Fluoro' },
  { k: 'ochre', name: 'Ochre', de: 'Erde', col: '#a8701f', icon: '<path d="M3 18l6-9 3 4 3-6 6 11z" fill="#fff"/>', beats: 'grounds Fluoro', little: 'dams Wash' },
  { k: 'fluoro', name: 'Fluoro', de: 'Blitz', col: '#d6337e', icon: '<path d="M13.5 2.5L6 13.2h5l-1.6 8.3L18 10.5h-5.2z" fill="#fff"/>', beats: 'strikes Wash', little: 'outshines Vermilion' },
];
const badge = (e: El) => `<span class="badge" style="background:${e.col}"><svg viewBox="0 0 24 24">${e.icon}</svg>${e.name}</span>`;
const grid = document.getElementById('grid')!;
function card(title: string, body: string, wide = false): HTMLElement {
  const c = document.createElement('div');
  c.className = 'card' + (wide ? ' wide' : '');
  c.innerHTML = `<h2>${title}</h2>${body}`;
  grid.append(c);
  return c;
}

/* 1 Ring */
const R = 150,
  cx = 230,
  cy = 190;
const pos = E.map((_, i) => {
  const a = -Math.PI / 2 + (i / E.length) * Math.PI * 2;
  return [cx + Math.cos(a) * R, cy + Math.sin(a) * R] as const;
});
let svg = `<svg width="460" height="380" viewBox="0 0 460 380"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#1d2130"/></marker><marker id="al" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#9a958a"/></marker></defs>`;
const edge = (a: number, b: number, strong: boolean) => {
  const [x0, y0] = pos[a]!,
    [x1, y1] = pos[b]!;
  const dx = x1 - x0,
    dy = y1 - y0,
    l = Math.hypot(dx, dy);
  const s = 36 / l;
  const bend = strong ? 0 : 0;
  return `<line x1="${x0 + dx * s}" y1="${y0 + dy * s}" x2="${x1 - dx * s}" y2="${y1 - dy * s + bend}" stroke="${strong ? '#1d2130' : '#9a958a'}" stroke-width="${strong ? 3 : 1.6}" ${strong ? '' : 'stroke-dasharray="5 4"'} marker-end="url(#${strong ? 'ah' : 'al'})"/>`;
};
for (let i = 0; i < 6; i++) svg += edge(i, (i + 2) % 6, false);
for (let i = 0; i < 6; i++) svg += edge(i, (i + 1) % 6, true);
E.forEach((e, i) => {
  const [x, y] = pos[i]!;
  svg += `<circle cx="${x}" cy="${y}" r="32" fill="${e.col}"/><g transform="translate(${x - 14} ${y - 20}) scale(1.15)">${e.icon}</g><text x="${x}" y="${y + 19}" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="${e.name.length > 6 ? 8.6 : 11}" fill="#fff">${e.name}</text>`;
});
svg += `<text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="Young Serif" font-size="16" fill="#1d2130">beats the next</text><text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="13" fill="#1d2130">×2</text><text x="${cx}" y="${cy + 34}" text-anchor="middle" font-family="JetBrains Mono" font-size="12" fill="#7a756b">the one after ×1.25</text></svg>`;
card('1 · The ring', svg + `<p class="note">Bold arrow: <b>×2</b>. Dashed arrow: <b>×1.25</b>. Everything else hits normally. Like rock, paper, scissors, but with six.</p>`);

/* 2 Tabelle */
card(
  '2 · In painter’s words',
  `<table>${E.map((e) => `<tr><td class="ic">${badge(e)}</td><td><b>${e.de}</b></td><td>${e.beats} <b>×2</b></td><td style="color:#5f6474">${e.little} ×1.25</td></tr>`).join('')}</table>
  <p class="note">Wash is a wet layer, Vermilion the fiery red of cinnabar, Gilt gold leaf, Sap sap green, Ochre the earth colours, Fluoro the glowing fluorescent pinks. The element is its own roll: any pigment, any shape can carry any element.</p>`,
);

/* 3 Karten */
const elOf = (seed: number) => E[Math.floor(RNG(seed ^ 0xe1e3)() * 6)]!;
const blots: [BlueprintId, PigmentId, string][] = [
  ['qualle', 'ultra', 'E1'],
  ['krabbe', 'karmin', 'E2'],
  ['vierbeiner', 'siena', 'E3'],
];
const c3 = card('3 · On the card and on the sheet', '<div id="mc"></div>');
for (const [bp, pig, salt] of blots) {
  const m = find(bp, pig, salt, true);
  m.gen = 2;
  const u = dieUnit(m);
  const e = elOf(m.seed);
  const row = document.createElement('div');
  row.className = 'mcard';
  const cv = document.createElement('canvas');
  renderMonster(cv, m, 76, { dpr: 2 });
  cv.style.width = cv.style.height = '76px';
  row.append(cv);
  row.insertAdjacentHTML('beforeend', `<div><b>${u.name}</b>${badge(e)}<small>${PIG[m.main].n} · ${e.beats} ×2 · ${e.little} ×1.25</small></div>`);
  c3.querySelector('#mc')!.append(row);
}
c3.insertAdjacentHTML('beforeend', `<p class="note">A small badge on the card, in the collection and next to the blot on the sheet. Tap it for the ring.</p>`);

/* 4 Im Kampf */
const wash = E[0]!,
  fire = E[1]!;
card(
  '4 · When you aim and when it lands',
  `<div class="pv">Splash <b>Ultramarine Jelly</b> (${fire.name}): 64% full hit (else a graze), -18 (9 ×2, ${wash.name} puts out ${fire.name}). A hit washes it out!</div>
   <div class="hit"><span class="tag" style="background:${wash.col}">WASH ▸ VERMILION ×2</span><span class="calc">9 ×2 = 18</span><span class="num">-18</span></div>
   <div class="hit"><span class="tag" style="background:${wash.col}">WASH ▸ VERMILION ×2</span><span class="calc">9 ×2 ×1.5 = 27</span><span class="num">-27</span><span style="font-size:12px;color:#5f6474">with a Glaze this turn</span></div>
   <p class="note">The element replaces the hidden colour wheel on splashes (complementary ×1.5, harmonious ×0.75). The colour wheel stays only for paint on the sheet: glaze, bleed, mud.</p>`,
);
(window as unknown as { done: boolean }).done = true;
