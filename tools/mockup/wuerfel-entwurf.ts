/*
 * Entwurfsbogen „Würfel“ (nur für docs/entwuerfe): je Seltenheit ein Würfel, links seine Seiten heute,
 * rechts nach dem Vorschlag (Doppel- und Dreifachseiten sichtbar, neue Seltenheitsleiter, Mischseite, Fähigkeitsseite).
 */
import { renderMonster } from '../../src/client/renderer/watercolor';
import { iconInner } from '../../src/client/duel/icons';
import { RARITIES, type Rarity } from '../../src/shared/dice';
import { ABILITY, crestDef, CRESTS, dieUnit, type Crest, type Face, type Unit } from '../../src/shared/duel/rules';
import { humidityFor, makeMonster } from '../../src/shared/monster';

type NF = { k: 'crest'; c: Crest; n: number } | { k: 'mix'; a: Crest; b: Crest } | { k: 'abil'; name: string } | { k: 'face'; f: Face };
const isCrest = (f: Face): f is { k: Crest; n: number } => f.k !== 'star' && f.k !== 'joker' && f.k !== 'gold';
const icon = (c: Crest, x: number, y: number, s: number) => `<g transform="translate(${x},${y}) scale(${s})">${iconInner({ k: c, n: 1 })}</g>`;

/** Heute: die Seite, wie sie gezeigt wird (×2 nur als kleine Zahl) */
const today = (f: Face) => `<svg viewBox="0 0 20 20">${iconInner(f)}</svg>`;
/** Vorschlag: doppelt heißt zwei Symbole, dreifach drei, Mischseite zwei verschiedene, Fähigkeit in Gold */
function proposed(f: NF): string {
  if (f.k === 'face') return `<svg viewBox="0 0 20 20">${iconInner(f.f)}</svg>`;
  if (f.k === 'crest') {
    if (f.n === 1) return `<svg viewBox="0 0 20 20">${icon(f.c, 0, 0, 1)}</svg>`;
    if (f.n === 2) return `<svg viewBox="0 0 20 20">${icon(f.c, -0.5, -0.5, 0.62)}${icon(f.c, 8, 8, 0.62)}</svg>`;
    return `<svg viewBox="0 0 20 20">${icon(f.c, 4.6, -0.6, 0.54)}${icon(f.c, -0.4, 9, 0.54)}${icon(f.c, 9.6, 9, 0.54)}</svg>`;
  }
  if (f.k === 'mix')
    return `<svg viewBox="0 0 20 20"><path d="M19 1L1 19" stroke="#cfcabd" stroke-width=".8"/>${icon(f.a, -0.5, -0.5, 0.6)}${icon(f.b, 8.5, 8.5, 0.6)}</svg>`;
  return `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.6" fill="#c9961e"/><circle cx="10" cy="10" r="6.6" fill="none" stroke="#f3d77a" stroke-width="1"/><path d="M10 4.2l1.4 4.4 4.4 1.4-4.4 1.4-1.4 4.4-1.4-4.4-4.4-1.4 4.4-1.4z" fill="#fff8dc"/></svg>`;
}

/** Vorschlag als Regel: Seltenheitsleiter, Mischseite ab Rare, eine Fähigkeitsseite je Würfel */
function newFaces(u: Unit): NF[] {
  const ri = RARITIES.findIndex((r) => r.k === u.rarity);
  const out: NF[] = u.faces.map((f) => (isCrest(f) ? { k: 'crest', c: f.k, n: f.n } : { k: 'face', f }));
  const crests = () => out.map((f, i) => [f, i] as const).filter(([f]) => f.k === 'crest') as [Extract<NF, { k: 'crest' }>, number][];
  const want = [0, 1, 2, 2, 2][ri]!;
  // Doppelseiten auffüllen, bei Epic und Legendary wird eine davon dreifach
  for (const [f] of crests()) if (crests().filter(([g]) => g.n >= 2).length < want && f.n === 1) f.n = 2;
  if (ri >= 3) {
    const d = crests().find(([f]) => f.n === 2);
    if (d) d[0].n = 3;
  }
  // Mischseite ab Rare: die zwei stärksten Symbole des Kleckses auf einer Seite
  if (ri >= 2) {
    const single = crests().find(([f]) => f.n === 1) ?? crests().find(([f]) => f.n === 2);
    const order = [...CRESTS].sort((a, b) => (u as unknown as Record<string, number>)[b.stat]! - (u as unknown as Record<string, number>)[a.stat]!);
    if (single) out[single[1]] = { k: 'mix', a: order[0]!.k, b: order[1]!.k };
  }
  // Fähigkeitsseite: ersetzt das schwächste einfache Symbol (oder einen Stern, wenn keins da ist)
  const weak = crests().find(([f]) => f.n === 1)?.[1] ?? out.findIndex((f) => f.k === 'face' && f.f.k === 'star');
  if (weak >= 0) out[weak] = { k: 'abil', name: ABILITY[u.m.bp].name };
  return out;
}

function pick(r: Rarity, salt: number) {
  const want = RARITIES.find((x) => x.k === r)!.paper ?? 'hadern';
  for (let k = salt; ; k++) {
    const sheet = 'W' + k;
    const m = makeMonster(sheet, k % 12, humidityFor(sheet));
    if (m.paper !== want) continue;
    if (r === 'legendary') m.paper = 'washi';
    m.gen = 2;
    return m;
  }
}

const tile = (svg: string, cap = '') => `<div class="tile">${svg}${cap ? `<small>${cap}</small>` : ''}</div>`;
const rows = document.getElementById('rows')!;
for (const [i, r] of RARITIES.entries()) {
  const m = pick(r.k, 40 + i * 997);
  const u = dieUnit(m);
  const row = document.createElement('div');
  row.className = 'row';
  row.style.setProperty('--c', r.col);
  const c = document.createElement('canvas');
  renderMonster(c, m, 64, { dpr: 2 });
  c.style.width = c.style.height = '64px';
  const id = document.createElement('div');
  id.className = 'id';
  id.append(c);
  id.insertAdjacentHTML('beforeend', `<b>${r.label}</b><small>${u.name}</small>`);
  const nf = newFaces(u);
  row.append(id);
  row.insertAdjacentHTML(
    'beforeend',
    `<div class="faces old">${u.faces.map((f) => tile(today(f))).join('')}</div><div class="faces new">${nf.map((f) => tile(proposed(f), f.k === 'abil' ? f.name : f.k === 'mix' ? `${crestDef(f.a).label}+${crestDef(f.b).label}` : f.k === 'crest' && f.n === 3 ? '×3' : '')).join('')}</div>`,
  );
  rows.append(row);
}
(window as unknown as { done: boolean }).done = true;
