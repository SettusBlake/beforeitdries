/* Symbole der Würfelseiten als kleines SVG, aus Code gezeichnet */
import { crestDef, faceKey, type Crest, type Face } from '../../shared/duel/rules';

const ICON_PATH: Record<Face['k'], string> = {
  step: '<path d="M4 4.5l5.5 5.5-5.5 5.5M10.5 4.5l5.5 5.5-5.5 5.5" fill="none" stroke="C" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  splash: '<path d="M10 2.5c3.1 4.2 4.7 6.6 4.7 8.8a4.7 4.7 0 0 1-9.4 0c0-2.2 1.6-4.6 4.7-8.8z" fill="C"/><circle cx="3.4" cy="6.2" r="1.4" fill="C"/><circle cx="16.8" cy="4.8" r="1.2" fill="C"/>',
  guard: '<path d="M10 2.2l6.3 2.4v4.8c0 4.1-2.7 7-6.3 8.5-3.6-1.5-6.3-4.4-6.3-8.5V4.6z" fill="C"/>',
  glow: '<path d="M10 1.2l2.1 6.7 6.7 2.1-6.7 2.1-2.1 6.7-2.1-6.7-6.7-2.1 6.7-2.1z" fill="C"/>',
  star: '<path d="M10 1.4l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="C"/>',
  joker: '<path d="M10 1.4l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="C"/>',
  gold: '<circle cx="10" cy="10" r="8" fill="C"/><circle cx="10" cy="10" r="5.6" fill="none" stroke="#f3d77a" stroke-width="1.2"/>',
};
export const STAR_COL = '#2b3fa3';
export const JOKER_COL = '#7a3fa3';
export const GOLD_COL = '#b8860b';
export const faceCol = (f: Face) => (f.k === 'star' ? STAR_COL : f.k === 'joker' ? JOKER_COL : f.k === 'gold' ? GOLD_COL : crestDef(f.k).col);

/** Ein Symbol verkleinert an eine Stelle der Seite */
const small = (c: Crest, x: number, y: number, s: number) => `<g transform="translate(${x},${y}) scale(${s})">${ICON_PATH[c].replace(/"C"/g, `"${crestDef(c).col}"`)}</g>`;
export function iconInner(f: Face): string {
  const col = faceCol(f);
  // Doppel-, Dreifach- und Mischseiten zeigen jedes Symbol einzeln (festgelegt am 30.10.2026: Doppelseiten sichtbar)
  if (f.k !== 'star' && f.k !== 'joker' && f.k !== 'gold') {
    if (f.k2) return `<path d="M19 1L1 19" stroke="#cfcabd" stroke-width=".8"/>${small(f.k, -0.5, -0.5, 0.6)}${small(f.k2, 8.5, 8.5, 0.6)}`;
    if (f.n === 2) return `${small(f.k, -0.5, -0.5, 0.62)}${small(f.k, 8, 8, 0.62)}`;
    if (f.n >= 3) return `${small(f.k, 4.6, -0.6, 0.54)}${small(f.k, -0.4, 9, 0.54)}${small(f.k, 9.6, 9, 0.54)}`;
  }
  let inner = ICON_PATH[f.k].replace(/"C"/g, `"${col}"`);
  if (f.k === 'star' || f.k === 'joker') inner += `<text x="10" y="13.3" font-size="7.4" text-anchor="middle" fill="#fff" font-family="JetBrains Mono, monospace" font-weight="700">${f.k === 'joker' ? '?' : f.n}</text>`;
  else if (f.k === 'gold') inner += `<path d="M10 6.2l1.1 2.4 2.6.3-1.9 1.8.5 2.6-2.3-1.3-2.3 1.3.5-2.6-1.9-1.8 2.6-.3z" fill="#fff4c9"/>`;
  return inner;
}
export function iconSvg(f: Face, px: number): string {
  return `<svg width="${px}" height="${px}" viewBox="0 0 20 20" aria-hidden="true">${iconInner(f)}</svg>`;
}
/** Als Bild für das Canvas */
const imgs = new Map<string, HTMLImageElement>();
export function iconImage(f: Face, onload: () => void): HTMLImageElement {
  const key = faceKey(f);
  let img = imgs.get(key);
  if (!img) {
    img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 20 20">${iconInner(f)}</svg>`);
    img.onload = onload;
    imgs.set(key, img);
  }
  return img;
}
/** Würfelnetz einer Karte mit den Seiten */
export function netSvg(net: [number, number][], faces: Face[], cell: number): string {
  const w = (Math.max(...net.map((p) => p[0])) + 1) * cell,
    h = (Math.max(...net.map((p) => p[1])) + 1) * cell;
  const parts = net.map(([x, y], k) => {
    const f = faces[k]!;
    return `<rect x="${x * cell + 0.5}" y="${y * cell + 0.5}" width="${cell - 1}" height="${cell - 1}" rx="2" fill="#fffdf8" stroke="#cfcabd"/><g transform="translate(${x * cell + 2},${y * cell + 2}) scale(${(cell - 4) / 20})">${iconInner(f)}</g>`;
  });
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${parts.join('')}</svg>`;
}
