/*
 * Entwurfsbogen „Entwicklung“ Fassung 2 (docs/entwuerfe/entwicklung-vorschlag.md): wie bei Pokémon und Digimon.
 * Die Form wächst und verändert sich (src/shared/evolve.ts), die Farbe verläuft. Alles mit dem echten Renderer.
 * Bauen: npx esbuild tools/mockup/entwicklung2-entwurf.ts --bundle --format=iife --outfile=tools/mockup/entwicklung2-entwurf.js
 */
import { geometryOf, renderMonster } from '../../src/client/renderer/watercolor';
import { evolveColours, evolveGeometry, type EvoPath, type EvoStage } from '../../src/shared/evolve';
import { humidityFor, makeMonster, type Monster } from '../../src/shared/monster';

const mon = (sheet: string, idx: number): Monster => ({ ...makeMonster(sheet, idx, humidityFor(sheet)), gen: 2 });
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
function paint(m: Monster, stage: EvoStage, path: EvoPath, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const mm = evolveColours(m, stage, path);
  const geometry = evolveGeometry(geometryOf(m), m.bp, m.seed, stage, path);
  renderMonster(c, mm, size, { dpr: 2, look: true, geometry });
  c.style.width = c.style.height = size + 'px';
  return c;
}
const STAGE = ['Stage 0 · as drawn', 'Stage 1 · grows', 'Stage 2 · its direction', 'Stage 3 · final'];
const grid = document.getElementById('grid')!;
function card(title: string, sub: string, wide = true): HTMLElement {
  const c = el('div', 'card' + (wide ? ' wide' : ''), `<h2>${title}</h2>${sub ? `<p class="note top">${sub}</p>` : ''}`);
  grid.append(c);
  return c;
}
const pick = new URLSearchParams(location.search);

// 1 Ketten wie bei Pokémon
{
  const c = card('Wie bei Pokémon: jede Stufe eine neue Form', 'Der Körper wächst stärker als der Kopf, Beine und Fühler werden länger, neue Teile sprießen, die Farbe verläuft mit jeder Stufe weiter. Jede Stufe ist eine eigene Art mit eigenem Namen aus der Community.');
  const rows: [Monster, EvoPath, string][] = [
    [mon('evo7', 7), 'bloom', 'Bloom: Flügel, dann Mähne'],
    [mon('evo4', 36), 'impasto', 'Impasto: Panzerplatten, dann Krone'],
    [mon('evo7', 23), 'spatter', 'Spatter: Stacheln und Hörner, dann Stachelschwanz'],
    [mon('evo5', 29), 'lift', 'Lift: langer Schwanz und Flügelchen, dann Schweben'],
  ];
  const sz = Number(pick.get('s') ?? 150);
  for (const [m, path, label] of rows) {
    const row = el('div', 'chain');
    row.append(el('div', 'lab', `<b>${label.split(':')[0]}</b><small>${label.split(':')[1]}</small>`));
    for (let s = 0 as EvoStage; s <= 3; s = (s + 1) as EvoStage) {
      const f = el('figure', 'st');
      const p = el('div', 'paper');
      p.append(paint(m, s, path, sz));
      f.append(p, el('figcaption', '', STAGE[s]!));
      row.append(f);
      if (s < 3) row.append(el('span', 'arr', '→'));
    }
    c.append(row);
  }
}
// 2 Verzweigung wie bei Digimon
{
  const c = card('Wie bei Digimon: dieselbe Stufe 1, vier Wege', 'Was der Klecks im Duell meistens tut, entscheidet, welche zwei Wege Sepia anbietet. Du wählst. Zwei Würfel derselben Art enden so ganz verschieden.');
  const m = mon('evo0', 32);
  const wrap = el('div', 'branch');
  const mid = el('figure', 'st');
  const pm = el('div', 'paper');
  pm.append(paint(m, 1, 'bloom', 150));
  mid.append(pm, el('figcaption', '', 'Stage 1'));
  const outs = el('div', 'outs');
  for (const [path, name, from] of [
    ['spatter', 'Spatter', 'splashes a lot · Splash +2'],
    ['impasto', 'Impasto', 'takes hits · Opacity +4'],
    ['bloom', 'Bloom', 'paints paper · bleeds further'],
    ['lift', 'Lift', 'moves, dodges · Dodge +5 %'],
  ] as [EvoPath, string, string][]) {
    const f = el('figure', 'st sm');
    const p2 = el('div', 'paper');
    p2.append(paint(m, 2, path, 118));
    const p3 = el('div', 'paper');
    p3.append(paint(m, 3, path, 118));
    const pair = el('div', 'pair');
    pair.append(p2, el('span', 'arr', '→'), p3);
    f.append(pair, el('figcaption', '', `<b>${name}</b> · ${from}`));
    outs.append(f);
  }
  wrap.append(mid, el('span', 'arr big', '⇉'), outs);
  c.append(wrap);
}
