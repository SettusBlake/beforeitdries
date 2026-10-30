/*
 * Entwurfsbogen: neue Formen aus Tieren, Dingen, Maschinen, Pflanzen, Sagen und Kunst (nur für docs/entwuerfe).
 * Misst, wie oft dieselbe Vorlage oder ein ähnlicher Umriss unter den letzten Zügen vorkommt.
 */
import { renderMonster } from '../../src/client/renderer/watercolor';
import { BAUPLAENE, BP, PIG, type Geometry } from '../../src/shared/data';
import { humidityFor, makeMonster, type Monster } from '../../src/shared/monster';
import { RNG } from '../../src/shared/rng';
import { ARCHES, archesOf, form, formOf, type Form } from '../../src/shared/forms';

const formFor = (m: Monster): Form => form(m.bp, RNG(m.seed ^ 0x2f6b9d3));
const geo1 = (m: Monster): Geometry => BP[m.bp].build(RNG(m.seed + 13));

/** Malt mit fremder Geometrie: nur im Entwurf wird build kurz ersetzt */
function paintGeo(c: HTMLCanvasElement, m: Monster, size: number, g: Geometry | null): void {
  if (!g) {
    renderMonster(c, m, size, { dpr: 2 });
    return;
  }
  const bp = BP[m.bp],
    orig = bp.build;
  bp.build = () => g;
  try {
    renderMonster(c, { ...m, face: { ...m.face, extra: 'keins' } }, size, { dpr: 2 });
  } finally {
    bp.build = orig;
  }
}

/* ---------- Ähnlichkeit der Umrisse ---------- */
const N = 40;
function mask(g: Geometry, mirror: boolean): Uint8Array {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d')!;
  x.setTransform(mirror ? -N : N, 0, 0, N, mirror ? N : 0, 0);
  x.fillStyle = x.strokeStyle = '#000';
  x.lineCap = 'round';
  for (const l of g.limbs) {
    x.lineWidth = Math.max(l.w, 0.02);
    x.beginPath();
    l.pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
    x.stroke();
  }
  for (const b of g.blobs) {
    x.beginPath();
    if (b.pts) b.pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
    else x.ellipse(b.x, b.y, b.rx, b.ry, b.rot || 0, 0, 7);
    x.fill();
  }
  const d = x.getImageData(0, 0, N, N).data,
    out = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) out[i] = d[i * 4 + 3]! > 100 ? 1 : 0;
  return out;
}
function iou(a: Uint8Array, b: Uint8Array): number {
  let i = 0,
    u = 0;
  for (let k = 0; k < a.length; k++) {
    i += a[k]! & b[k]!;
    u += a[k]! | b[k]!;
  }
  return u ? i / u : 0;
}
type Sil = { m: Uint8Array; f: Uint8Array };
const sim = (a: Sil, b: Sil) => Math.max(iou(a.m, b.m), iou(a.m, b.f));
function stats(geos: Geometry[], T: number): { last2: number; last10: number } {
  const sil = geos.map((x) => ({ m: mask(x, false), f: mask(x, true) }));
  let l2 = 0,
    l10 = 0,
    n2 = 0,
    n10 = 0;
  for (let i = 2; i < geos.length; i++) {
    n2++;
    if (sim(sil[i]!, sil[i - 1]!) > T || sim(sil[i]!, sil[i - 2]!) > T) l2++;
    if (i >= 10) {
      n10++;
      let any = false;
      for (let j = i - 10; j < i; j++) if (sim(sil[i]!, sil[j]!) > T) any = true;
      if (any) l10++;
    }
  }
  return { last2: l2 / n2, last10: l10 / n10 };
}
function sameArche(fs: Form[], back: number): number {
  let n = 0,
    hit = 0;
  for (let i = back; i < fs.length; i++) {
    n++;
    if (fs.slice(i - back, i).some((f) => f.arche === fs[i]!.arche)) hit++;
  }
  return hit / n;
}

/* ---------- Bogen ---------- */
const mon = (k: number): Monster => {
  const sheet = 'dip-' + (k * 7919 + 17).toString(36);
  return makeMonster(sheet, k % 12, humidityFor(sheet));
};
function tile(m: Monster, g: Geometry | null, size: number, label: string): HTMLElement {
  const f = document.createElement('figure');
  const c = document.createElement('canvas');
  paintGeo(c, m, size, g);
  c.style.width = c.style.height = size + 'px';
  const cap = document.createElement('figcaption');
  cap.textContent = label;
  f.append(c, cap);
  return f;
}
function section(title: string, sub: string, kids: HTMLElement[]): void {
  const h = document.createElement('header');
  h.innerHTML = `<p>${sub}</p><h1>${title}</h1>`;
  const g = document.createElement('div');
  g.className = 'grid g8';
  g.append(...kids);
  document.body.append(h, g);
}
const pct = (v: number) => Math.round(v * 100) + ' %';

function main(): void {
  const params = new URLSearchParams(location.search);
  if (params.get('time')) {
    const ms = Array.from({ length: 60 }, (_, k) => mon(k + 9000));
    const c = document.createElement('canvas');
    const run = (fn: (m: Monster) => Geometry | null) => {
      const t0 = performance.now();
      for (const m of ms) paintGeo(c, m, 140, fn(m));
      return (performance.now() - t0) / ms.length;
    };
    run(() => null);
    (window as unknown as { stats: unknown }).stats = { g1: run(() => null), neu: run(formFor), blobs: ms.map((m) => formFor(m).blobs.length) };
    (window as unknown as { done: boolean }).done = true;
    return;
  }
  const sample = Array.from({ length: 400 }, (_, k) => mon(k + 1000));
  const forms = sample.map(formFor);
  const s1 = stats(sample.map(geo1), 0.6),
    s3 = stats(forms, 0.6);
  const per = BAUPLAENE.map((b) => archesOf(b.id).length);
  const stat = { s1, s3, arche10: sameArche(forms, 10), arche3: sameArche(forms, 2), count: ARCHES.length, per };
  (window as unknown as { stats: unknown }).stats = stat;
  const head = document.createElement('div');
  head.className = 'stats';
  head.innerHTML = `<p>${ARCHES.length} Vorlagen, 400 Züge, Umrisse verglichen (auch gespiegelt)</p>
    <table><tr><th></th><th>heute</th><th>neu</th></tr>
    <tr><td>Umriss ähnlich zu einem der 2 Züge davor</td><td>${pct(s1.last2)}</td><td>${pct(s3.last2)}</td></tr>
    <tr><td>Umriss ähnlich zu einem der 10 Züge davor</td><td>${pct(s1.last10)}</td><td>${pct(s3.last10)}</td></tr>
    <tr><td>dieselbe Vorlage unter den 2 Zügen davor</td><td>&nbsp;</td><td>${pct(stat.arche3)}</td></tr>
    <tr><td>dieselbe Vorlage unter den 10 Zügen davor</td><td>&nbsp;</td><td>${pct(stat.arche10)}</td></tr></table>`;
  document.body.append(head);
  const run = sample.slice(0, 48);
  section('48 Züge hintereinander', 'Entwurf · neue Formen', run.map((m, i) => tile(m, forms[i]!, 150, `${forms[i]!.name} · ${BP[m.bp].n}`)));
  const cat = ARCHES.find((a) => a.id === 'cat')!;
  section('Acht Katzen', 'Entwurf · eine Vorlage, ganz verschiedene Tiere', Array.from({ length: 8 }, (_, i) => {
    const m = mon(7000 + i);
    return tile(m, formOf(cat, RNG(m.seed)), 150, `cat · ${PIG[m.main].n.split(' ')[0]}`);
  }));
  const robot = ARCHES.find((a) => a.id === 'robot')!;
  section('Acht Automaten', 'Entwurf · eine Vorlage, ganz verschiedene Maschinen', Array.from({ length: 8 }, (_, i) => {
    const m = mon(7100 + i);
    return tile(m, formOf(robot, RNG(m.seed)), 150, `automaton · ${PIG[m.main].n.split(' ')[0]}`);
  }));
  for (const bp of BAUPLAENE) {
    const ms: Monster[] = [];
    for (let k = 0; ms.length < 8; k++) {
      const m = mon(5000 + k);
      if (m.bp === bp.id) ms.push(m);
    }
    section(`${bp.n} · ${archesOf(bp.id).length} Vorlagen`, 'Ein Bauplan, acht Züge', ms.map((m) => {
      const f = formFor(m);
      return tile(m, f, 150, `${f.name} · ${PIG[m.main].n.split(' ')[0]}`);
    }));
  }
  (window as unknown as { done: boolean }).done = true;
}
main();
