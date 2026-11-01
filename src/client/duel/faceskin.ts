/*
 * Würfel-Häute (Entwurf 01.11.2026, docs/entwuerfe/wuerfel-haut-vorschlag.md): wie eine Würfelseite aussieht.
 * wash: bisher (Lavierung hinter dem Symbol), paint: ganze Seite in ihrer Farbe mit ausgehobenem Licht für das Symbol,
 * tag: wie paint, dazu das Kürzel des Pigments. Dazu je Stil eine eigene Haut, für Monster mit Stil.
 * Holo ist keine Haut, sondern eine Folie darüber (CSS-Klasse holo-die, duel.css).
 * Jede Seite ist ein SVG im Raster 40 × 40. Defs haben feste IDs mit gleichem Inhalt, damit mehrere Seiten im Dokument
 * sich nicht stören.
 */
import { PIG, type PigmentId, type RGB } from '../../shared/data';
import type { Face } from '../../shared/duel/rules';
import type { StyleId } from '../../shared/dice';
import { RNG } from '../../shared/rng';
import { faceCol, iconInner, symbolInner } from './icons';

export type Skin = 'wash' | 'paint' | 'tag' | StyleId;

const PAPER: RGB = [255, 253, 248];
const INK: RGB = [22, 20, 28];
const css = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
const mix = (a: RGB, b: RGB, t: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
/** Kürzel der Pigmente (Variante tag) */
export const PIG_TAG: Record<PigmentId, string> = { ultra: 'UL', indigo: 'IN', phthalo: 'PH', karmin: 'CA', opera: 'OP', kadmium: 'CD', siena: 'SI', sepia: 'SE' };

/** Das Symbol mittig auf der Seite */
const sym = (f: Face, ink?: string, paper?: string, filter = '') => `<g transform="translate(9 9) scale(1.1)"${filter ? ` filter="url(#${filter})"` : ''}>${symbolInner(f, ink, paper)}</g>`;
/** Ein unregelmäßiger Fleck um die Mitte (fest aus dem Schlüssel) */
function blob(key: string, r: number, wob: number, n = 12, cx = 20, cy = 20): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rr = RNG(h);
  const pts: string[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const q = r + (rr() - 0.5) * 2 * wob;
    pts.push(`${(cx + Math.cos(a) * q).toFixed(2)},${(cy + Math.sin(a) * q).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}
const DEFS = {
  olDark: '<filter id="fsk-ol-dark" x="-30%" y="-30%" width="160%" height="160%"><feMorphology in="SourceAlpha" operator="dilate" radius="1" result="d"/><feFlood flood-color="#15131c"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
  olThin: '<filter id="fsk-ol-thin" x="-30%" y="-30%" width="160%" height="160%"><feMorphology in="SourceAlpha" operator="dilate" radius=".55" result="d"/><feFlood flood-color="#15131c"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
  olWhite: '<filter id="fsk-ol-white" x="-30%" y="-30%" width="160%" height="160%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.1" result="d"/><feFlood flood-color="#ffffff"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
  olGold: '<filter id="fsk-ol-gold" x="-30%" y="-30%" width="160%" height="160%"><feMorphology in="SourceAlpha" operator="dilate" radius=".6" result="d"/><feFlood flood-color="#b08a3a"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
  glow: '<filter id="fsk-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
  wax: '<filter id="fsk-wax" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="1.7"/></filter>',
  shadow: '<filter id="fsk-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx=".5" dy="1" stdDeviation=".7" flood-color="#000" flood-opacity=".45"/></filter>',
  blur: '<filter id="fsk-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.3"/></filter>',
  c12: '<clipPath id="fsk-c12"><circle cx="20" cy="20" r="12"/></clipPath>',
};
const wrap = (px: number, defs: string, body: string) =>
  `<svg width="${px}" height="${px}" viewBox="0 0 40 40" aria-hidden="true" style="display:block"><defs>${defs}</defs><clipPath id="fsk-clip"><rect x="0" y="0" width="40" height="40" rx="6.5"/></clipPath><g clip-path="url(#fsk-clip)">${body}</g></svg>`;

/** Farbe der Seite, Sterne und Joker ohne (dann zählt der Ton des Würfels nur für den Rand) */
const colOf = (f: Face): RGB | null => (f.c ? PIG[f.c].rgb : null);

/** Bisher: Lavierung hinter dem Symbol, Rand in der Farbe der Seite */
function wash(f: Face, tint: RGB): string {
  const c = colOf(f) ?? tint;
  return `<rect width="40" height="40" fill="${css(PAPER)}"/><g transform="scale(2)">${iconInner(f)}</g><rect x="1.3" y="1.3" width="37.4" height="37.4" rx="6" fill="none" stroke="${css(c)}" stroke-width="2.6"/>`;
}
/** Neu: ganze Seite in ihrer Farbe, das Symbol auf ausgehobenem Papier, kräftiger Rand */
function paint(f: Face, tint: RGB, tag: boolean): string {
  const c = colOf(f);
  if (!c) return `<rect width="40" height="40" fill="${css(PAPER)}"/>${sym(f)}<rect x="1.4" y="1.4" width="37.2" height="37.2" rx="6" fill="none" stroke="${css(tint)}" stroke-width="2.4"/>`;
  const key = f.c!;
  const t = tag
    ? `<text x="4.2" y="10.4" font-size="7" font-weight="800" font-family="JetBrains Mono, monospace" fill="#fff" stroke="${css(mix(c, INK, 0.45))}" stroke-width="1.6" paint-order="stroke">${PIG_TAG[f.c!]}</text>`
    : '';
  return (
    `<rect width="40" height="40" fill="${css(mix(c, PAPER, 0.35))}"/>` +
    `<path d="${blob(key, 19.5, 1.6, 14)}" fill="${css(c, 0.78)}" stroke="${css(mix(c, INK, 0.25))}" stroke-opacity=".7" stroke-width="1.4"/>` +
    `<path d="${blob(key + 'b', 13.5, 2.2, 10, 15, 14)}" fill="${css(mix(c, PAPER, 0.25), 0.5)}"/>` +
    `<circle cx="20" cy="20" r="13.2" fill="${css(PAPER)}" fill-opacity=".55"/><circle cx="20" cy="20" r="11.6" fill="${css(PAPER)}" fill-opacity=".92"/>` +
    sym(f) +
    t +
    `<rect x="1.6" y="1.6" width="36.8" height="36.8" rx="6" fill="none" stroke="${css(mix(c, INK, 0.2))}" stroke-width="3.2"/>`
  );
}

/* ---------- Stil-Häute ---------- */
const HATCH = Array.from({ length: 12 }, (_, k) => `M${k * 4 - 6} 42L${k * 4 + 36} 0`).join('');
function pencil(f: Face): string {
  const c = colOf(f);
  const scrib = c
    ? `<path d="${blob(f.c! + 'p', 13.5, 1.4, 16)}" fill="none" stroke="${css(c)}" stroke-width="1.7" stroke-opacity=".9" stroke-linejoin="round"/><path d="${blob(f.c! + 'q', 12.6, 1.8, 13)}" fill="none" stroke="${css(c)}" stroke-width="1" stroke-opacity=".7"/><path d="${HATCH}" stroke="${css(c)}" stroke-opacity=".28" stroke-width=".9" clip-path="url(#fsk-c12)"/>`
    : '';
  return (
    `<rect width="40" height="40" fill="#f6f3ec"/><path d="${HATCH}" stroke="#3d3d3d" stroke-opacity=".12" stroke-width=".6"/>${scrib}` +
    sym(f, '#3a3a3a', '#f6f3ec') +
    `<rect x="1.8" y="2.1" width="36.4" height="36" rx="5" fill="none" stroke="#444" stroke-width=".9" stroke-opacity=".85"/><rect x="2.3" y="1.6" width="35.6" height="36.6" rx="6" fill="none" stroke="#444" stroke-width=".6" stroke-opacity=".5"/>`
  );
}
function comic(f: Face): string {
  const c = colOf(f) ?? [214, 214, 220];
  const id = `fsk-ht-${f.c ?? 'n'}`;
  const burst = Array.from({ length: 24 }, (_, k) => {
    const a = (k / 24) * Math.PI * 2;
    const r = k % 2 ? 11 : 16;
    return `${(20 + Math.cos(a) * r).toFixed(2)},${(20 + Math.sin(a) * r).toFixed(2)}`;
  }).join(' ');
  return (
    `<defs><pattern id="${id}" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="1.7" cy="1.7" r="1" fill="${css(mix(c, INK, 0.3))}" fill-opacity=".55"/></pattern></defs>` +
    `<rect width="40" height="40" fill="${css(mix(c, PAPER, 0.45))}"/><rect width="40" height="40" fill="url(#${id})"/>` +
    `<polygon points="${burst}" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/>` +
    sym(f, undefined, undefined, 'fsk-ol-dark') +
    `<rect x="1.6" y="1.6" width="36.8" height="36.8" rx="5.5" fill="none" stroke="#111" stroke-width="3.2"/>`
  );
}
function anime(f: Face): string {
  const c = colOf(f) ?? [198, 205, 238];
  const id = `fsk-an-${f.c ?? 'n'}`;
  const spark = (x: number, y: number, r: number) => `<path d="M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z" fill="#fff" stroke="${css(mix(c, INK, 0.2))}" stroke-width=".5"/>`;
  return (
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${css(mix(c, PAPER, 0.25))}"/><stop offset=".62" stop-color="${css(mix(c, PAPER, 0.7))}"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>` +
    `<rect width="40" height="40" fill="url(#${id})"/><path d="M0 27C10 23 22 31 40 25V40H0Z" fill="${css(c, 0.22)}"/>` +
    spark(7, 8, 3.4) +
    spark(33, 31, 2.6) +
    spark(32.5, 8.5, 1.8) +
    sym(f, undefined, undefined, 'fsk-ol-white') +
    `<rect x="1.5" y="1.5" width="37" height="37" rx="6" fill="none" stroke="${css(mix(c, INK, 0.35))}" stroke-width="2.6"/><rect x="3.4" y="3.4" width="33.2" height="33.2" rx="4.6" fill="none" stroke="#fff" stroke-width=".9" stroke-opacity=".9"/>`
  );
}
/* Pixel: Symbole als kleine Bitmaps (10 × 10) */
const BITS: Record<Face['k'], string[]> = {
  step: ['..........', 'XX...XX...', '.XX...XX..', '..XX...XX.', '...XX...XX', '..XX...XX.', '.XX...XX..', 'XX...XX...', '..........', '..........'],
  splash: ['....XX....', '....XX....', '...XXXX...', '..XXXXXX..', '.XXXXXXXX.', '.XXXXXXXX.', '.XXXXXXXX.', '..XXXXXX..', '...XXXX...', '..........'],
  guard: ['.XXXXXXXX.', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.', '.XXXXXXXX.', '..XXXXXX..', '...XXXX...', '....XX....'],
  glow: ['....XX....', '....XX....', '...XXXX...', '.XXXXXXXX.', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.', '...XXXX...', '....XX....', '....XX....'],
  star: ['....XX....', '....XX....', '...XXXX...', 'XXXXXXXXXX', '.XXXXXXXX.', '..XXXXXX..', '..XXXXXX..', '.XXX..XXX.', '.XX....XX.', 'X........X'],
  joker: ['....XX....', '....XX....', '...XXXX...', 'XXXXXXXXXX', '.XXXXXXXX.', '..XXXXXX..', '..XXXXXX..', '.XXX..XXX.', '.XX....XX.', 'X........X'],
  gold: ['..XXXXXX..', '.XXXXXXXX.', 'XXX....XXX', 'XX..XX..XX', 'XX.XXXX.XX', 'XX.XXXX.XX', 'XX..XX..XX', 'XXX....XXX', '.XXXXXXXX.', '..XXXXXX..'],
};
const DIGIT: Record<string, string[]> = {
  '1': ['.X.', 'XX.', '.X.', '.X.', 'XXX'],
  '2': ['XX.', '..X', '.X.', 'X..', 'XXX'],
  '3': ['XX.', '..X', '.X.', '..X', 'XX.'],
  '?': ['XX.', '..X', '.X.', '...', '.X.'],
  x: ['...', 'X.X', '.X.', 'X.X', '...'],
};
function bits(rows: string[], x: number, y: number, s: number, fill: string): string {
  let out = '';
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] === 'X') out += `<rect x="${(x + i * s).toFixed(2)}" y="${(y + j * s).toFixed(2)}" width="${(s + 0.02).toFixed(2)}" height="${(s + 0.02).toFixed(2)}" fill="${fill}"/>`;
  });
  return out;
}
function pixel(f: Face, tint: RGB): string {
  const c = colOf(f) ?? mix(tint, PAPER, 0.5);
  let bg = '';
  for (let j = 0; j < 10; j++) for (let i = 0; i < 10; i++) bg += `<rect x="${i * 4}" y="${j * 4}" width="4" height="4" fill="${css(mix(c, PAPER, (i + j) % 2 ? 0.55 : 0.68))}"/>`;
  const ink = faceCol(f);
  let s = bits(BITS[f.k], 9, 8, 2.2, ink);
  if (f.k === 'star' || f.k === 'joker') s += bits(DIGIT[f.k === 'joker' ? '?' : String(f.n)]!, 17, 16.6, 2, '#fff');
  else if (f.k !== 'gold' && f.k2) s += `<rect x="25" y="25" width="12" height="12" fill="${css(PAPER)}"/>` + bits(BITS[f.k2], 26, 26, 1, ink);
  else if (f.k !== 'gold' && f.n > 1) s += `<rect x="25.5" y="28" width="12" height="9" fill="${css(PAPER)}"/>` + bits(DIGIT.x!, 26.5, 29.5, 1.2, '#222') + bits(DIGIT[String(f.n)]!, 31.5, 29.5, 1.2, '#222');
  return `<g shape-rendering="crispEdges">${bg}<rect x="5" y="5" width="30" height="30" fill="${css(PAPER, 0.75)}"/>${s}<rect x="1.5" y="1.5" width="37" height="37" fill="none" stroke="${css(mix(c, INK, 0.35))}" stroke-width="3"/></g>`;
}
function neon(f: Face): string {
  const c = colOf(f) ?? [150, 160, 200];
  const lit = mix(c, [255, 255, 255], 0.4);
  return (
    `<rect width="40" height="40" fill="#15131f"/><rect x="4" y="4" width="32" height="32" rx="5" fill="${css(c, 0.12)}"/>` +
    `<rect x="3" y="3" width="34" height="34" rx="6" fill="none" stroke="${css(lit)}" stroke-width="1.5" filter="url(#fsk-glow)"/>` +
    sym(f, css(lit), '#15131f', 'fsk-glow')
  );
}
function plate(f: Face): string {
  const c = colOf(f);
  return (
    `<rect width="40" height="40" fill="#efe2c4"/><circle cx="8" cy="31" r="2.4" fill="#c9a46a" fill-opacity=".2"/><circle cx="33" cy="9" r="1.6" fill="#c9a46a" fill-opacity=".22"/>` +
    (c ? `<path d="${blob(f.c! + 'pl', 12.5, 1.6, 12)}" fill="${css(c, 0.55)}"/>` : '') +
    `<path d="${HATCH}" stroke="#4b3a2a" stroke-opacity=".1" stroke-width=".5" clip-path="url(#fsk-c12)"/>` +
    sym(f, '#4b3a2a', '#efe2c4') +
    `<rect x="2" y="2" width="36" height="36" rx="2" fill="none" stroke="#5a4632" stroke-width="1.3"/><rect x="4.2" y="4.2" width="31.6" height="31.6" rx="1" fill="none" stroke="#5a4632" stroke-width=".6"/>`
  );
}
function crayon(f: Face, tint: RGB): string {
  const c = colOf(f) ?? mix(tint, PAPER, 0.5);
  const zig = Array.from({ length: 7 }, (_, k) => {
    const y = 4 + k * 5.2;
    return `<path d="M-2 ${y}L8 ${y + 3}L18 ${y - 1}L28 ${y + 2.5}L42 ${y}" fill="none" stroke="${css(c)}" stroke-opacity="${k % 2 ? 0.45 : 0.62}" stroke-width="2.4" stroke-linecap="round"/>`;
  }).join('');
  return (
    `<rect width="40" height="40" fill="#fffefb"/><g filter="url(#fsk-wax)">${zig}<circle cx="20" cy="20" r="11.5" fill="#fffefb" fill-opacity=".9"/></g>` +
    `<g filter="url(#fsk-wax)">${sym(f)}</g>` +
    `<rect x="2" y="2" width="36" height="36" rx="6" fill="none" stroke="${css(mix(c, INK, 0.2))}" stroke-width="2.6" filter="url(#fsk-wax)"/>`
  );
}
function oil(f: Face, tint: RGB): string {
  const c = colOf(f) ?? mix(tint, [200, 190, 170], 0.6);
  const strokes = [
    ['M-2 8C10 2 26 12 42 5', 0.25],
    ['M-2 16C12 12 24 20 42 13', -0.2],
    ['M-2 25C10 21 30 30 42 22', 0.3],
    ['M-2 33C14 29 24 38 42 31', -0.25],
    ['M4 -2C8 14 2 26 7 42', 0.15],
    ['M34 -2C30 12 37 28 33 42', -0.15],
  ]
    .map(([d, t]) => `<path d="${d}" fill="none" stroke="${css(Number(t) > 0 ? mix(c, PAPER, Number(t)) : mix(c, INK, -Number(t)))}" stroke-width="4.2" stroke-linecap="round" stroke-opacity=".8"/>`)
    .join('');
  return (
    `<rect width="40" height="40" fill="${css(mix(c, INK, 0.12))}"/>${strokes}` +
    `<ellipse cx="20" cy="20" rx="12" ry="11.4" fill="#f3e9d2" fill-opacity=".93" stroke="${css(mix(c, PAPER, 0.3))}" stroke-width="1.6"/>` +
    sym(f, undefined, undefined, 'fsk-ol-thin') +
    `<rect x="1.6" y="1.6" width="36.8" height="36.8" rx="3" fill="none" stroke="#b8913a" stroke-width="3.2"/><rect x="3.4" y="3.4" width="33.2" height="33.2" rx="2" fill="none" stroke="#6d5420" stroke-width=".8"/>`
  );
}
function ukiyoe(f: Face): string {
  const c = colOf(f) ?? [120, 130, 150];
  const id = `fsk-uk-${f.c ?? 'n'}`;
  const waves = [30.5, 34.5]
    .map((y) => Array.from({ length: 6 }, (_, k) => `M${k * 7 - 1} ${y}a3.5 3.5 0 0 1 7 0`).join(''))
    .join('');
  return (
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${css(c)}" stop-opacity=".9"/><stop offset="1" stop-color="${css(c)}" stop-opacity="0"/></linearGradient></defs>` +
    `<rect width="40" height="40" fill="#f1e6cf"/><rect width="40" height="17" fill="url(#${id})"/>` +
    `<path d="${waves}" fill="none" stroke="#2d4a7a" stroke-width="1" stroke-opacity=".7"/>` +
    sym(f, undefined, undefined, 'fsk-ol-thin') +
    `<rect x="31" y="4" width="5" height="11" fill="${css(c)}" stroke="#1e2b4a" stroke-width=".6"/>` +
    `<rect x="1.5" y="1.5" width="37" height="37" rx="2" fill="none" stroke="#1e2b4a" stroke-width="2.4"/>`
  );
}
function stained(f: Face): string {
  const c = colOf(f) ?? [150, 165, 190];
  const rr = RNG(7 + (f.c ? f.c.length * 13 + f.c.charCodeAt(0) : 1));
  const ring: [number, number][] = [];
  const n = 8;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rr() * 0.3;
    ring.push([20 + Math.cos(a) * 30, 20 + Math.sin(a) * 30]);
  }
  const panes = ring
    .map((p, k) => {
      const q = ring[(k + 1) % n]!;
      const shade = k % 3 === 0 ? mix(c, PAPER, 0.45) : k % 3 === 1 ? c : mix(c, INK, 0.25);
      return `<polygon points="20,20 ${p[0].toFixed(1)},${p[1].toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}" fill="${css(shade, 0.92)}" stroke="#1b1a1f" stroke-width="1.5" stroke-linejoin="round"/>`;
    })
    .join('');
  return (
    `<rect width="40" height="40" fill="#1b1a1f"/>${panes}` +
    `<circle cx="20" cy="20" r="11.8" fill="#f6f0dc" fill-opacity=".95" stroke="#1b1a1f" stroke-width="1.8"/>` +
    sym(f) +
    `<path d="M3 3L17 3L3 17Z" fill="#fff" fill-opacity=".14"/>` +
    `<rect x="1.4" y="1.4" width="37.2" height="37.2" rx="5" fill="none" stroke="#1b1a1f" stroke-width="2.8"/>`
  );
}
function blueprint(f: Face): string {
  const c = colOf(f);
  let grid = '';
  for (let k = 5; k < 40; k += 5) grid += `M${k} 0V40M0 ${k}H40`;
  return (
    `<rect width="40" height="40" fill="#1f4e8c"/><path d="${grid}" stroke="#fff" stroke-opacity=".13" stroke-width=".5"/>` +
    (c ? `<path d="M0 0H15L0 15Z" fill="${css(c)}" stroke="#eaf2ff" stroke-width=".8"/><rect x="26" y="31" width="11" height="5" fill="${css(c)}" stroke="#eaf2ff" stroke-width=".7"/>` : '') +
    `<circle cx="20" cy="20" r="12.5" fill="none" stroke="#eaf2ff" stroke-opacity=".5" stroke-width=".6" stroke-dasharray="1.6 1.2"/>` +
    sym(f, '#eaf2ff', '#1f4e8c') +
    `<rect x="2" y="2" width="36" height="36" rx="3" fill="none" stroke="#eaf2ff" stroke-width="1" stroke-dasharray="2.4 1.4"/>`
  );
}
function papercut(f: Face): string {
  const c = colOf(f) ?? [170, 175, 190];
  const key = f.c ?? 'n';
  return (
    `<rect width="40" height="40" fill="${css(mix(c, INK, 0.35))}"/>` +
    `<path d="${blob(key + 'c1', 18.5, 2.4, 9)}" fill="${css(c)}" filter="url(#fsk-shadow)"/>` +
    `<path d="${blob(key + 'c2', 15, 1.6, 11)}" fill="${css(mix(c, PAPER, 0.45))}" filter="url(#fsk-shadow)"/>` +
    `<circle cx="20" cy="20" r="11.6" fill="#fbf6ea" filter="url(#fsk-shadow)"/>` +
    sym(f, undefined, undefined, 'fsk-shadow')
  );
}
function mosaic(f: Face): string {
  const c = colOf(f) ?? [180, 182, 190];
  let h = 0;
  for (const ch of (f.c ?? 'n') + f.k + f.n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rr = RNG(h);
  let tiles = '';
  const s = 40 / 8;
  for (let j = 0; j < 8; j++)
    for (let i = 0; i < 8; i++) {
      const cx = (i + 0.5) * s - 20,
        cy = (j + 0.5) * s - 20;
      const inner = cx * cx + cy * cy < 12.5 * 12.5;
      const col = inner ? mix([244, 239, 227], [226, 218, 200], rr()) : mix(c, PAPER, rr() * 0.42);
      tiles += `<rect x="${(i * s + 0.45).toFixed(2)}" y="${(j * s + 0.45).toFixed(2)}" width="${(s - 0.9).toFixed(2)}" height="${(s - 0.9).toFixed(2)}" rx=".6" fill="${css(col)}"/>`;
    }
  return `<rect width="40" height="40" fill="#cfc8b8"/>${tiles}` + sym(f, undefined, undefined, 'fsk-ol-white') + `<rect x="1" y="1" width="38" height="38" rx="6" fill="none" stroke="${css(mix(c, INK, 0.3))}" stroke-width="2"/>`;
}
function graffiti(f: Face): string {
  const c = colOf(f) ?? [150, 150, 160];
  let bricks = '';
  for (let j = 0; j < 6; j++) {
    const y = j * 7;
    bricks += `M0 ${y}H40`;
    for (let i = 0; i < 4; i++) bricks += `M${i * 12 + (j % 2 ? 6 : 0)} ${y}V${y + 7}`;
  }
  return (
    `<rect width="40" height="40" fill="#cdbfae"/><path d="${bricks}" stroke="#a8988a" stroke-width=".8"/>` +
    `<path d="${blob((f.c ?? 'n') + 'g', 14.5, 2.8, 12)}" fill="${css(c, 0.9)}" filter="url(#fsk-blur)"/>` +
    `<path d="M13 30V37M21 31V39.5M28 29V35" stroke="${css(c, 0.85)}" stroke-width="2" stroke-linecap="round"/>` +
    sym(f, undefined, undefined, 'fsk-ol-dark') +
    `<rect x="1" y="1" width="38" height="38" rx="6" fill="none" stroke="#2b2622" stroke-width="1.6"/>`
  );
}
function nouveau(f: Face): string {
  const c = colOf(f) ?? [175, 170, 160];
  const curl = (x: number, y: number, sx: number, sy: number) => `<path d="M${x} ${y + sy * 8}C${x} ${y + sy * 2} ${x + sx * 2} ${y} ${x + sx * 8} ${y}M${x + sx * 3} ${y + sy * 3}a1.6 1.6 0 1 1 ${sx * 0.1} ${sy * 0.1}" fill="none" stroke="#b08a3a" stroke-width="1"/>`;
  return (
    `<rect width="40" height="40" fill="#f4ead2"/>` +
    `<path d="M9 35V17C9 9 14 6 20 6S31 9 31 17V35Z" fill="${css(c, 0.78)}" stroke="#b08a3a" stroke-width="1.2"/>` +
    `<path d="M5 34C8 26 4 18 8 10M35 34C32 26 36 18 32 10" fill="none" stroke="${css(mix(c, INK, 0.2))}" stroke-opacity=".6" stroke-width=".9"/>` +
    `<circle cx="20" cy="21" r="10.8" fill="#f8f0dc" fill-opacity=".92"/>` +
    sym(f, undefined, undefined, 'fsk-ol-gold') +
    curl(3, 3, 1, 1) +
    curl(37, 3, -1, 1) +
    curl(3, 37, 1, -1) +
    curl(37, 37, -1, -1) +
    `<rect x="1.4" y="1.4" width="37.2" height="37.2" rx="4" fill="none" stroke="#b08a3a" stroke-width="1.6"/>`
  );
}

/** Eine Seite als SVG. tint: Ton des Würfels (Rand von Sternen und Jokern) */
export function faceSvg(f: Face, skin: Skin, px: number, tint: RGB = [43, 63, 163]): string {
  const defs = Object.values(DEFS).join('');
  let body: string;
  switch (skin) {
    case 'wash':
      body = wash(f, tint);
      break;
    case 'paint':
      body = paint(f, tint, false);
      break;
    case 'tag':
      body = paint(f, tint, true);
      break;
    case 'pencil':
      body = pencil(f);
      break;
    case 'comic':
      body = comic(f);
      break;
    case 'anime':
      body = anime(f);
      break;
    case 'pixel':
      body = pixel(f, tint);
      break;
    case 'neon':
      body = neon(f);
      break;
    case 'plate':
      body = plate(f);
      break;
    case 'crayon':
      body = crayon(f, tint);
      break;
    case 'oil':
      body = oil(f, tint);
      break;
    case 'ukiyoe':
      body = ukiyoe(f);
      break;
    case 'stained':
      body = stained(f);
      break;
    case 'blueprint':
      body = blueprint(f);
      break;
    case 'papercut':
      body = papercut(f);
      break;
    case 'mosaic':
      body = mosaic(f);
      break;
    case 'graffiti':
      body = graffiti(f);
      break;
    case 'nouveau':
      body = nouveau(f);
      break;
  }
  return wrap(px, defs, body);
}
/** Ton eines Würfels für Sterne und Joker */
export const tintOf = (p: PigmentId | null | undefined): RGB => (p ? PIG[p].rgb : [43, 63, 163]);
