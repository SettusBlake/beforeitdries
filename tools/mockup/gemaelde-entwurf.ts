/*
 * Entwurfsbogen „Gemälde“ (nur für docs/entwuerfe, docs/entwuerfe/gemaelde-vorschlag.md): dieselben Monster wie jetzt im Spiel
 * und als Aquarellbild (Lasuren mit klarer Kante, Pigmentrand, Körnung, Bleistift, Schatten), groß zum Vergleichen
 * und in Stufen. Misst die Malzeit.
 */
import { renderMonster, type Painterly } from '../../src/client/renderer/watercolor';
import type { PaperId } from '../../src/shared/data';
import { humidityFor, makeMonster, type Monster } from '../../src/shared/monster';

const q = new URLSearchParams(location.search);
const only = q.get('only');
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const PAPERS: PaperId[] = ['schul', 'zeichen', 'buetten', 'hadern', 'washi'];
const gen2 = (sheet: string, idx: number, paper: PaperId): Monster => ({ ...makeMonster(sheet, idx, humidityFor(sheet)), gen: 2, paper });
const times: Record<string, number[]> = {};
function tile(m: Monster, cap: string, painterly: boolean | Painterly, size: number): HTMLElement {
  const f = el('figure');
  const c = el('canvas');
  const t = renderMonster(c, m, size, { dpr: 2, painterly });
  (times[painterly ? 'new' : 'old'] ??= []).push(t);
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
const row = (s: HTMLElement, side: string, cols: number, size: number): HTMLElement => {
  const g = el('div', 'grid');
  g.style.setProperty('--n', String(cols));
  g.style.setProperty('--tile', size + 6 + 'px');
  g.append(el('div', 'side', side));
  s.append(g);
  return g;
};
const head = el('header');
head.append(el('p', 'eyebrow', 'Before It Dries · Entwurf'), el('h1', '', 'Gemälde: mehr wie ein echtes Aquarell'));
document.body.append(head);

const pick = (seed: string, n: number, from = 1): Monster[] => Array.from({ length: n }, (_, i) => gen2(seed, from + i, PAPERS[i % 5]!));

if (!only || only === 'all') {
  const s = section('1 · Dieselben Monster, jetzt und als Gemälde', 'Oben wie jetzt im Spiel. Unten: eine Lasur mit klarer Kante statt vieler gezackter Schichten, dunkler Pigmentrand, Körnung, Bleistift statt Tusche, Schlagschatten.');
  for (const seed of ['gm1', 'gm2']) {
    const ms = pick(seed, 8);
    for (const on of [false, true]) {
      const g = row(s, on ? 'Gemälde' : 'jetzt', 8, 150);
      for (const m of ms) g.append(tile(m, m.paper, on, 150));
    }
  }
}
if (!only || only === 'big') {
  const s = section('2 · Groß', 'Links jetzt, rechts Gemälde. Am Rand jeder Lasur sammelt sich Pigment, in der Fläche sieht man das Korn des Papiers, stellenweise läuft die Kante weich aus.');
  const ms = [gen2('gm1', 2, 'zeichen'), gen2('gm3', 4, 'buetten'), gen2('gm2', 5, 'hadern'), gen2('gm4', 1, 'schul')];
  for (let i = 0; i < ms.length; i += 2) {
    const g = row(s, '', 4, 330);
    for (const m of ms.slice(i, i + 2)) for (const on of [false, true]) g.append(tile(m, `${m.paper} · ${on ? 'Gemälde' : 'jetzt'}`, on, 330));
  }
}
if (!only || only === 'steps') {
  const s = section('3 · In Stufen', 'Was jeder Teil bringt: A Lasuren und Pigment, B Bleistift statt Tusche, C Schlagschatten, D loser Grund hinter der Figur.');
  const STEPS: [string, boolean | Painterly][] = [
    ['jetzt', false],
    ['A Lasuren und Pigment', {}],
    ['A + B Bleistift', { pencil: true }],
    ['A + B + C Schatten', { pencil: true, shadow: true }],
    ['A bis D mit Grund', { pencil: true, shadow: true, back: true }],
  ];
  for (const m of [gen2('gm3', 4, 'buetten'), gen2('gm5', 3, 'hadern'), gen2('gm6', 2, 'washi')]) {
    const g = row(s, '', 5, 230);
    for (const [cap, on] of STEPS) g.append(tile(m, cap, on, 230));
  }
}
const avg = (a: number[] = []): string => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-');
document.body.append(el('p', 'note', `Malzeit im Schnitt: jetzt ${avg(times.old)} ms, Gemälde ${avg(times.new)} ms (alle Größen gemischt)`));
(window as unknown as { TIMES: unknown }).TIMES = times;
document.title = 'ready';
