/*
 * Entwurfsbogen „Hokusai“ (nur für docs/entwuerfe, docs/entwuerfe/hokusai-vorschlag.md): der Stil, den es nur am Gilded weekend gibt.
 * Dieselben Monster in beiden Ansichten (große Welle, roter Fuji), klein wie in der Sammlung, und zum Vergleich der bestehende Ukiyo-e-Stil.
 */
import { hokusai, ukiyoe, type HokusaiScene } from '../../src/client/renderer/styles-more';
import type { PaperId } from '../../src/shared/data';
import { humidityFor, makeMonster, type Monster } from '../../src/shared/monster';

const only = new URLSearchParams(location.search).get('only');
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const PAPERS: PaperId[] = ['schul', 'zeichen', 'buetten', 'hadern', 'washi'];
const gen2 = (sheet: string, idx: number, paper: PaperId): Monster => {
  const m = makeMonster(sheet, idx, humidityFor(sheet));
  return { ...m, gen: 2, paper, face: { ...m.face, extra: 'keins' } };
};
function tile(m: Monster, cap: string, size: number, paint: (ctx: CanvasRenderingContext2D, S: number) => void): HTMLElement {
  const f = el('figure');
  const c = el('canvas');
  const S = size * 2;
  c.width = c.height = S;
  paint(c.getContext('2d')!, S);
  c.style.width = c.style.height = size + 'px';
  f.append(c, el('figcaption', '', cap));
  return f;
}
function section(title: string, note: string): HTMLElement {
  const s = el('section');
  s.append(el('h2', '', title), el('p', 'note', note));
  document.body.append(s);
  return s;
}
const row = (s: HTMLElement, cols: number, size: number): HTMLElement => {
  const g = el('div', 'grid');
  g.style.setProperty('--n', String(cols));
  g.style.setProperty('--tile', size + 6 + 'px');
  g.append(el('div', 'side', ''));
  s.append(g);
  return g;
};
const head = el('header');
head.append(el('p', 'eyebrow', 'Before It Dries · Entwurf'), el('h1', '', 'Hokusai: der Stil nur fürs Wochenende'));
document.body.append(head);

const MS = [gen2('hk1', 2, 'zeichen'), gen2('hk2', 3, 'buetten'), gen2('hk3', 1, 'hadern'), gen2('hk4', 5, 'schul'), gen2('hk5', 4, 'washi')];
const scene = (sc: HokusaiScene, title: string, note: string): void => {
  const s = section(title, note);
  const g = row(s, 5, 250);
  for (const m of MS) g.append(tile(m, m.name, 250, (ctx, S) => hokusai(ctx, m, S, true, sc)));
};
if (!only || only === 'wave') scene('wave', '1 · Die große Welle', 'Die Welle mit ihren Schaumkrallen rollt über die Figur, der Fuji steht klein in der Ferne. Linien in Preußischblau statt Schwarz.');
if (!only || only === 'fuji') scene('fuji', '2 · Der rote Fuji', 'Klarer Morgen: der Berg in Rot, Schäfchenwolken im tiefen Blau, Wald am Fuß.');
if (!only || only === 'small') {
  const s = section('3 · Klein, wie in der Sammlung', 'Ohne Titelkasten. Oben die Welle, unten der Fuji.');
  for (const sc of ['wave', 'fuji'] as const) {
    const g = row(s, 10, 112);
    for (const m of [...MS, ...MS.map((x, i) => gen2('hk' + (6 + i), 1 + i, x.paper))]) g.append(tile(m, sc, 112, (ctx, S) => hokusai(ctx, m, S, false, sc)));
  }
}
if (!only || only === 'cmp') {
  const s = section('4 · Zum Vergleich: der Ukiyo-e-Stil, den es schon gibt', 'Dieselben Monster. Ukiyo-e bleibt, wie er ist: Nebelbänder, Wellenmuster am Boden, schwarze Linie, rotes Siegel.');
  const g = row(s, 5, 250);
  for (const m of MS) g.append(tile(m, m.name, 250, (ctx, S) => ukiyoe(ctx, m, S, true)));
}
document.title = 'ready';
