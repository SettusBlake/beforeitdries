/*
 * Entwurfsbogen Generation 2b (nur für docs/entwuerfe): dieselben Züge vorher und nachher,
 * dazu einzelne Reihen für Farbton, Muster, Gesichter und Malereignisse. Misst die Malzeit.
 */
import { geometryOf, renderMonster } from '../../src/client/renderer/watercolor';
import { PIG } from '../../src/shared/data';
import { encodeDrawing } from '../../src/shared/drawn';
import { lookOf, type Look, type PatternKind } from '../../src/shared/look';
import { humidityFor, makeMonster, type Monster } from '../../src/shared/monster';
import type { Pt } from '../../src/shared/data';

const gen2 = (sheet: string, idx: number): Monster => ({ ...makeMonster(sheet, idx, humidityFor(sheet)), gen: 2 });
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
function tile(m: Monster, cap: string, look?: Look | false, size = 150, zoom = 1): HTMLElement {
  const f = el('figure');
  const big = el('canvas');
  // Ohne Angabe mit 2b (im Spiel ist es noch aus)
  renderMonster(big, m, size * zoom, { dpr: 2, look: look ?? true });
  // Vergrößert: nur die Mitte zeigen (für die Gesichter)
  const c = el('canvas');
  c.width = c.height = size * 2;
  const o = (big.width - c.width) / 2;
  c.getContext('2d')!.drawImage(big, o, o * 0.9, c.width, c.height, 0, 0, c.width, c.height);
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
const grid = (s: HTMLElement) => {
  const g = el('div', 'grid');
  s.append(g);
  return g;
};
/** Grundaussehen ohne Muster und Ereignisse, damit eine Reihe nur eine Sache zeigt */
const calm = (m: Monster): Look => ({ ...lookOf(m), pattern: null, fx: { runs: false, splatter: false, tide: false, lifted: false }, faceless: false });

const head = el('header');
head.append(el('p', 'eyebrow', 'Before It Dries · draft'), el('h1', '', 'Generation 2b: colour, patterns, faces, paint events'));
document.body.append(head);

/* ---------- Vorher und nachher ---------- */
const pulls = Array.from({ length: 16 }, (_, i) => gen2(`dip-${(48271 * (i + 3)).toString(36)}`, (i * 5) % 12));
const s1 = section('Same pulls, before and after', 'Top row of each pair: today. Bottom row: with 2b. Shapes, species and stats stay the same.');
for (let half = 0; half < 2; half++) {
  const before = grid(s1),
    after = grid(s1);
  before.classList.add('before');
  for (const m of pulls.slice(half * 8, half * 8 + 8)) {
    before.append(tile(m, 'before', false));
    const l = lookOf(m);
    const tags = [l.pattern?.k, l.eyes.n !== 2 ? `${l.eyes.n} eyes` : '', l.eyes.shape, l.mouth, ...Object.entries(l.fx).filter(([, v]) => v).map(([k]) => k)].filter(Boolean);
    after.append(tile(m, tags.join(' · ')));
  }
}

/* ---------- Farbton ---------- */
const toneM = pulls[2]!;
const s2 = section('Own tone', 'One monster, eight tones it could have had: hue ±12°, lightness and saturation ±15 %. The pigment stays recognisable.');
const g2 = grid(s2);
const tones: [number, number, number][] = [
  [-12, 1, 1],
  [-6, 0.88, 1.1],
  [0, 0.86, 0.9],
  [0, 1, 1],
  [0, 1.14, 1.12],
  [6, 1.08, 0.86],
  [12, 1, 1],
  [12, 0.9, 1.15],
];
for (const [hue, light, sat] of tones) g2.append(tile(toneM, `${hue > 0 ? '+' : ''}${hue}° · L ${light} · S ${sat}`, { ...calm(toneM), main: { hue, light, sat } }));

/* ---------- Muster ---------- */
const s3 = section('Patterns (about 40 %)', 'Only inside the shapes, in the second colour or a darker main colour. Things and machines also get bands and checks. Sometimes only on one part.');
const g3 = grid(s3);
const kinds: PatternKind[] = ['spots', 'stripes', 'rings', 'speckle', 'fade', 'marble', 'bands', 'check'];
kinds.forEach((k, i) => {
  const m = gen2(`pat-${(7919 * (i + 11)).toString(36)}`, (i * 7) % 12);
  const base = calm(m);
  g3.append(tile(m, k, { ...base, pattern: { k, amt: 0.9, dark: i % 2 === 0 || !m.sec.length, part: i === 6 ? 0.2 : null, scale: 1, angle: i === 1 ? 0.3 : -0.2 } }));
});

/* ---------- Gesichter ---------- */
// Großes rundes Gesicht: ein gezeichneter Kreis, damit man die Gesichter gut sieht
const circle: Pt[] = Array.from({ length: 40 }, (_, i) => {
  const a = (i / 39) * Math.PI * 2 * 0.97;
  return [0.5 + Math.cos(a) * 0.22, 0.52 + Math.sin(a) * 0.2];
});
const quiet = (x: Monster) => !x.events.bloom && !x.events.salt && !x.events.alcohol && !x.events.print;
function faceM(i: number): Monster {
  // Ohne Malereignisse, damit nur das Gesicht auffällt
  let m = gen2(`face-${(104729 * (i + 1)).toString(36)}`, i % 12);
  for (let j = 0; !quiet(m); j++) m = gen2(`face-${j}-${i}`, i % 12);
  return { ...m, draw: encodeDrawing({ mirror: false, face: null, strokes: [circle] }) };
}
const s4 = section('Faces (shown 1.8× larger)', 'Eyes 1 to 7 (two in about 75 %), many eye shapes and pupils, plain slits, mouths, brows for the mood, cheeks. About 8 % have no face at all. Drawn monsters keep their eyes where you tapped.');
const g4 = grid(s4);
type F = Partial<Pick<Look, 'mouth' | 'brows' | 'cheeks' | 'whiskers'>> & Partial<Look['eyes']>;
const faces: [string, F][] = [
  ['round · smile', { shape: 'round', mouth: 'smile' }],
  ['button · grin', { shape: 'button', mouth: 'grin' }],
  ['almond · fangs · angry', { shape: 'almond', mouth: 'fangs', brows: 'angry' }],
  ['slit · teeth', { shape: 'slit', mouth: 'teeth' }],
  ['sleepy · o · bored', { shape: 'sleepy', mouth: 'o', brows: 'bored' }],
  ['shiny · tongue · blush', { shape: 'shiny', mouth: 'tongue', cheeks: 'blush' }],
  ['closed · smile · freckles', { shape: 'closed', mouth: 'smile', cheeks: 'freckles' }],
  ['star pupils · tusks', { shape: 'round', pupil: 'star', mouth: 'tusks' }],
  ['spiral · zigzag · worried', { shape: 'round', pupil: 'spiral', mouth: 'zigzag', brows: 'worried' }],
  ['ring pupils · beak · raised', { shape: 'round', pupil: 'ring', mouth: 'beak', brows: 'raised' }],
  ['cross-eyed · whiskers', { shape: 'round', cross: true, mouth: 'smile', whiskers: true }],
  ['1 eye · grin', { n: 1, shape: 'shiny', mouth: 'grin' }],
  ['3 eyes · teeth', { n: 3, shape: 'round', mouth: 'teeth' }],
  ['slits · smile', { shape: 'dash', mouth: 'smile' }],
  ['slits · none · angry', { shape: 'dash', mouth: 'none', brows: 'angry' }],
  ['7 eyes · fangs', { n: 7, shape: 'round', mouth: 'fangs' }],
];
faces.forEach(([cap, f], i) => {
  const m = faceM(i);
  const base = calm(m);
  const look: Look = {
    ...base,
    eyes: { ...base.eyes, n: 2, pupil: 'dot', cross: false, size: 1.1, gaze: [0.3, 0.1], ...f },
    mouth: f.mouth ?? 'smile',
    brows: f.brows ?? null,
    cheeks: f.cheeks ?? null,
    whiskers: f.whiskers ?? false,
  };
  g4.append(tile(m, cap, look, 150, 1.8));
});

/* ---------- Malereignisse ---------- */
const s5 = section('Paint events (looks only, each about 10 to 15 %)', 'Old bloom (generation 1, stays as it is) next to the new soft bloom for generation 2, then runs, splatter, tide line and lifted lights.');
const g5 = grid(s5);
let bloomM: Monster | null = null;
for (let i = 0; !bloomM && i < 5000; i++) {
  const m = gen2(`bl-${i}`, i % 12);
  // Ein Monster mit großer Fläche, damit man die Blüte sieht
  if (m.events.bloom && Math.max(...geometryOf(m).blobs.map((b) => b.rx * b.ry)) > 0.03) bloomM = m;
}
// Alte Blüte: dasselbe Monster ohne 2b gemalt. Neue Blüte: mit 2b, sonst ruhig
g5.append(tile(bloomM!, 'old bloom (gen 1 style)', false), tile(bloomM!, 'new soft bloom', calm(bloomM!)));
// Die anderen Ereignisse einzeln, auf Monstern ohne Blüte und Salz
(['runs', 'splatter', 'tide', 'lifted'] as const).forEach((k, i) => {
  let m = gen2(`fx-${(15485863 * (i + 2)).toString(36)}`, (i * 3 + 1) % 12);
  // Ohne Blüte und Salz, in einer hellen Farbe, damit man das Ereignis sieht
  const light = (x: Monster) => PIG[x.main].rgb.reduce((a, v) => a + v, 0) > 330;
  const roomy = (x: Monster) => Math.max(...geometryOf(x).blobs.map((b) => b.rx * b.ry)) > 0.025;
  for (let j = 0; !quiet(m) || !light(m) || !roomy(m); j++) m = gen2(`fx-${j}-${i}`, (i * 3 + 1) % 12);
  const base = calm(m);
  g5.append(tile(m, k === 'tide' ? 'tide line' : k === 'lifted' ? 'lifted lights' : k, { ...base, fx: { ...base.fx, [k]: true } }));
});

/* ---------- Messen ---------- */
const N = 48;
const many = Array.from({ length: N }, (_, i) => gen2(`m-${(2654435761 * (i + 1)).toString(36)}`, i % 12));
const c = el('canvas');
let tB = 0,
  tA = 0;
for (let rep = 0; rep < 2; rep++)
  for (const m of many) {
    const t0 = performance.now();
    renderMonster(c, m, 150, { dpr: 2, look: false });
    const t1 = performance.now();
    renderMonster(c, m, 150, { dpr: 2, look: true });
    const t2 = performance.now();
    if (rep) {
      tB += t1 - t0;
      tA += t2 - t1;
    }
  }
const looks = Array.from({ length: 2000 }, (_, i) => lookOf(gen2(`s-${i}`, i % 12)));
const share = (f: (l: Look) => boolean) => Math.round((looks.filter(f).length / looks.length) * 100) + ' %';
const s6 = section('Measured', `${N} pulls painted at 150 px (dpr 2), shares from 2000 pulls.`);
const tb = el('table');
for (const [k, v] of [
  ['paint time before', (tB / N).toFixed(1) + ' ms'],
  ['paint time with 2b', (tA / N).toFixed(1) + ' ms (' + Math.round((tA / tB - 1) * 100) + ' % more)'],
  ['with a pattern', share((l) => !!l.pattern)],
  ['not 2 eyes', share((l) => l.eyes.n !== 2)],
  ['with brows', share((l) => !!l.brows)],
  ['no face at all', share((l) => l.faceless)],
  ['slit eyes', share((l) => !l.faceless && l.eyes.shape === 'dash')],
  ['with at least one new paint event', share((l) => Object.values(l.fx).some(Boolean))],
] as [string, string][]) {
  const tr = el('tr');
  tr.append(el('td', '', k), el('td', '', v));
  tb.append(tr);
}
s6.append(tb);
(window as unknown as { done: boolean; stats: unknown }).done = true;
(window as unknown as { stats: unknown }).stats = { before: tB / N, after: tA / N };
