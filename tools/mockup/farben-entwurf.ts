/*
 * Entwurfsbogen „Farbe nach Seltenheit“ (nur für docs/entwuerfe, docs/entwuerfe/farben-vorschlag.md):
 * dieselben Züge je Seltenheit, oben wie bisher, unten mit Farbplan nach Seltenheit. Misst die Malzeit.
 */
import { renderMonster } from '../../src/client/renderer/watercolor';
import { RARITIES, LEGENDARY_PAPERS } from '../../src/shared/dice';
import type { PaperId } from '../../src/shared/data';
import { humidityFor, makeMonster, type Monster } from '../../src/shared/monster';

const NOTES = [
  'Immer eine Farbe. Muster nur Ton in Ton.',
  'Zwei Farben: die zweite sitzt auf Gliedern, einem Körperteil, als Verlauf oder im Muster.',
  'Drei Farben: dazu ein Akzent auf kleinen Teilen, öfter Muster und ein nasser Verlauf.',
  'Vier Farben: Verlauf im Körper, eigene Farbe für Glieder und Details, immer ein Muster, Schatten und Lichter.',
  'Fünf Farben: Verlauf über das ganze Monster, Goldstaub und ein Hof auf dem Papier.',
];
const N = Number(new URLSearchParams(location.search).get('n') ?? 9);
const mode = new URLSearchParams(location.search).get('mode') ?? 'both';
const SIZE = Number(new URLSearchParams(location.search).get('size') ?? 132);
document.documentElement.style.setProperty('--tile', SIZE + 6 + 'px');
document.documentElement.style.setProperty('--n', String(N));
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const gen2 = (sheet: string, idx: number, paper: PaperId): Monster => ({ ...makeMonster(sheet, idx, humidityFor(sheet)), gen: 2, paper });
const times: Record<string, number[]> = {};
function tile(m: Monster, cap: string, palette: boolean, size = SIZE): HTMLElement {
  const f = el('figure');
  const c = el('canvas');
  const t = renderMonster(c, m, size, { dpr: 2, palette });
  (times[palette ? 'new' : 'old'] ??= []).push(t);
  c.style.width = c.style.height = size + 'px';
  f.append(c, el('figcaption', '', cap));
  return f;
}
document.body.append(el('p', 'eyebrow', 'Before It Dries · Entwurf'), el('h1', '', 'Farbe und Aufwand nach Seltenheit'));
RARITIES.forEach((r, ri) => {
  const s = el('section');
  s.append(el('h2', '', r.label), el('p', 'note', NOTES[ri]!));
  for (const pal of mode === 'old' ? [false] : mode === 'new' ? [true] : [false, true]) {
    const g = el('div', 'grid' + (pal ? '' : ' before'));
    g.append(el('div', 'side', pal ? 'neu' : 'bisher'));
    for (let k = 0; k < N; k++) {
      const paper = r.paper ?? LEGENDARY_PAPERS[k % 2]!;
      const m = gen2(`farben-${ri}`, k + 1, paper);
      g.append(tile(m, `${m.main}${m.sec.length ? ' + ' + m.sec.join(' + ') : ''}`, pal));
    }
    s.append(g);
  }
  document.body.append(s);
});
const avg = (a: number[] = []) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
document.body.append(el('p', 'note', `Malzeit je Bild (264 px): bisher ${avg(times.old).toFixed(0)} ms, neu ${avg(times.new).toFixed(0)} ms`));
document.title = 'ready';
