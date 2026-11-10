/*
 * Entwurfsbogen „Leben“ (nur für docs/entwuerfe, docs/entwuerfe/leben-vorschlag.md): dieselben Züge vorher und nachher,
 * dazu je eine Reihe für die neuen Augenformen und die Tuschedetails. Misst die Malzeit.
 */
import { geometryOf, renderMonster } from '../../src/client/renderer/watercolor';
import type { PaperId } from '../../src/shared/data';
import { lifeOf, type EyeStyle, type Life, type Surface } from '../../src/shared/life';
import { lookOf } from '../../src/shared/look';
import { fitGeo } from '../../src/client/renderer/life';
import { humidityFor, makeMonster, type Monster } from '../../src/shared/monster';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') ?? 150);
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
function tile(m: Monster, cap: string, lively: boolean | Life, size = SIZE, zoom = 1): HTMLElement {
  const f = el('figure');
  const big = el('canvas');
  const t = renderMonster(big, m, size * zoom, { dpr: 2, lively });
  (times[lively ? 'new' : 'old'] ??= []).push(t);
  const c = el('canvas');
  c.width = c.height = size * 2;
  // Vergrößert: der Ausschnitt um das erste Gesicht
  let ox = (big.width - c.width) / 2,
    oy = (big.height - c.height) / 2;
  if (zoom > 1) {
    const g = fitGeo(geometryOf(m));
    const fc = g.faces[0];
    if (fc) {
      // Lage des Gesichts nach dem Einpassen: aus dem Bild selbst lässt sie sich nicht lesen, deshalb grob die Mitte der Figur
      ox = Math.min(Math.max(0, fc.x * big.width - c.width / 2), big.width - c.width);
      oy = Math.min(Math.max(0, fc.y * big.height - c.height / 2), big.height - c.height);
    }
  }
  c.getContext('2d')!.drawImage(big, ox, oy, c.width, c.height, 0, 0, c.width, c.height);
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
/** Spalten und Kachelgröße gelten je Reihe (die Abschnitte haben verschieden viele und verschieden große Kacheln) */
let COLS = 8,
  TILE = SIZE;
const row = (s: HTMLElement, side: string): HTMLElement => {
  const g = el('div', 'grid');
  g.style.setProperty('--n', String(COLS));
  g.style.setProperty('--tile', TILE + 6 + 'px');
  g.append(el('div', 'side', side));
  s.append(g);
  return g;
};
document.body.append(el('p', 'eyebrow', 'Before It Dries · Entwurf'), el('h1', '', 'Leben: größer, lebhaftere Gesichter, Tuschedetails'));

if (!only || only === 'pairs') {
  const N = Number(q.get('n') ?? 8);
  COLS = N;
  TILE = SIZE;
  for (const [title, sheet] of [
    ['Vorher und nachher', 'leben-a'],
    ['Noch einmal acht', 'leben-b'],
    ['Und noch acht', 'leben-c'],
    ['Und acht höhere Seltenheiten', 'leben-d'],
  ] as const) {
    const s = section(title, 'Oben wie jetzt im Spiel (mit Farbplan), unten mit „Leben“. Gleiche Züge, gleiche Form, gleiche Farben.');
    for (const lively of [false, true]) {
      const g = row(s, lively ? 'neu' : 'jetzt');
      for (let k = 0; k < N; k++) {
        const m = gen2(sheet, k + 1, sheet === 'leben-d' ? PAPERS[2 + (k % 3)]! : PAPERS[k % 4 === 3 ? 2 : k % 4]!);
        const lf = lifeOf(m);
        g.append(tile(m, lively ? `${lf.eye === 'keep' ? 'eyes as before' : lf.eye} · ${lf.surface}` : m.paper, lively));
      }
    }
  }
}
if (!only || only === 'eyes') {
  const EYES: EyeStyle[] = ['big', 'oval', 'cat', 'angry', 'happy', 'dots', 'goat', 'cross', 'heart'];
  COLS = EYES.length;
  TILE = SIZE - 16;
  const s = section('Neue Augenformen', 'Dasselbe Monster mit jeder neuen Augenform, vergrößert. Die acht bisherigen Formen bleiben dazu. Unten: Zwinkern, Wimpern, ungleiche Augen, zwei Augenfarben.');
  // Ein Monster mit zwei Augen und einem Gesicht ohne Stiele
  let m = gen2('leben-augen', 1, 'buetten');
  for (let i = 1; i < 60; i++) {
    m = gen2('leben-augen', i, 'buetten');
    const lk = lookOf(m),
      fc = geometryOf(m).faces[0];
    if (lk.eyes.n === 2 && !lk.faceless && !lk.eyes.cross && fc && !fc.stalks && !fc.cyclops && fc.r > 0.09) break;
  }
  const base = lifeOf(m);
  const Z = 1.9;
  const g = row(s, 'augen');
  for (const eye of EYES) g.append(tile(m, eye, { ...base, eye, wink: false, uneven: 1, lashes: false, iris2: null }, SIZE - 16, Z));
  const g2 = row(s, 'dazu');
  const extra: [string, Partial<Life>][] = [
    ['wink', { eye: 'big', wink: true }],
    ['lashes', { eye: 'big', lashes: true }],
    ['lashes', { eye: 'cat', lashes: true }],
    ['uneven', { eye: 'oval', uneven: 0.65 }],
    ['two colours', { eye: 'big', iris2: [214, 142, 28], iris: [70, 150, 214] }],
    ['two colours', { eye: 'goat', iris2: [196, 52, 44], iris: [76, 150, 62] }],
    ['as before', { eye: 'keep' }],
    ['as before', { eye: 'keep', lashes: true }],
    ['as before', { eye: 'keep', uneven: 0.7 }],
  ];
  for (const [cap, x] of extra) g2.append(tile(m, cap, { ...base, wink: false, uneven: 1, lashes: false, iris2: null, ...x }, SIZE - 16, Z));
}
if (!only || only === 'ink') {
  const KINDS: Surface[] = ['none', 'fur', 'scales', 'feathers', 'hatch', 'rivets', 'grain'];
  COLS = KINDS.length;
  TILE = Math.round(SIZE * 1.14);
  const s = section('Tuschedetails', 'Dasselbe Monster mit jeder Oberfläche. Tiere bekommen Fell, Schuppen, Federn oder Schraffur, Dinge Nieten, Maserung oder Schraffur. Dazu Füße an Beinen.');
  // Zwei Monster mit großem, hellem Körper (darauf sieht man die Tusche am besten) und eines mit dunklem
  const picks: Monster[] = [];
  for (let i = 1; i < 200 && picks.length < 3; i++) {
    const m = gen2('leben-tusche', i, 'zeichen');
    const g = geometryOf(m);
    const core = g.blobs.reduce((p, c) => (c.rx * c.ry > p.rx * p.ry ? c : p), g.blobs[0]!);
    const light = ['kadmium', 'opera', 'siena'].includes(m.main);
    if (core.rx * core.ry > 0.02 && (picks.length < 2 ? light : m.main === 'indigo')) picks.push(m);
  }
  for (const m of picks) {
    const base = lifeOf(m);
    const g = row(s, 'tusche');
    for (const surface of KINDS) g.append(tile(m, surface, { ...base, surface, feet: true }, Math.round(SIZE * 1.14)));
  }
}
const avg = (a: number[] = []) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
document.body.append(el('p', 'note', `Malzeit je Bild: jetzt ${avg(times.old).toFixed(0)} ms, neu ${avg(times.new).toFixed(0)} ms`));
document.title = 'ready';
