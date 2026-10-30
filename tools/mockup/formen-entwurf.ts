/*
 * Entwurfsbogen: Formen Generation 1 gegen Generation 2 (nur für docs/entwuerfe).
 * Misst dazu, wie oft ein Zug einem der letzten Züge ähnlich sieht (Silhouetten-Überdeckung, auch gespiegelt).
 */
import { renderMonster } from '../../src/client/renderer/watercolor';
import { BAUPLAENE, BP, PIG, type Geometry } from '../../src/shared/data';
import { humidityFor, makeMonster, type Monster } from '../../src/shared/monster';
import { RNG } from '../../src/shared/rng';
import { shape2 } from '../../src/shared/shape2';

const geo2 = (m: Monster) => shape2(m.bp, RNG(m.seed ^ 0x2f6b9d3));
const geo1 = (m: Monster): Geometry => BP[m.bp].build(RNG(m.seed + 13));

/** Malt mit fremder Geometrie: nur im Entwurf wird build kurz ersetzt */
function paint(c: HTMLCanvasElement, m: Monster, size: number, gen: 1 | 2): void {
  if (gen === 1) {
    renderMonster(c, m, size, { dpr: 2 });
    return;
  }
  const g = geo2(m),
    bp = BP[m.bp],
    orig = bp.build;
  bp.build = () => g;
  try {
    renderMonster(c, g.headParts ? { ...m, face: { ...m.face, extra: 'keins' } } : m, size, { dpr: 2 });
  } finally {
    bp.build = orig;
  }
}

/* ---------- Ähnlichkeit ---------- */
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
    x.ellipse(b.x, b.y, b.rx, b.ry, b.rot || 0, 0, 7);
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
function stats(ms: Monster[], g: (m: Monster) => Geometry, T: number): { last2: number; last10: number } {
  const sil = ms.map((m) => {
    const x = g(m);
    return { m: mask(x, false), f: mask(x, true) };
  });
  let l2 = 0,
    l10 = 0,
    n2 = 0,
    n10 = 0;
  for (let i = 2; i < ms.length; i++) {
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

/* ---------- Bogen ---------- */
const mon = (k: number): Monster => {
  const sheet = 'dip-' + (k * 7919 + 17).toString(36);
  return makeMonster(sheet, k % 12, humidityFor(sheet));
};
function tile(m: Monster, gen: 1 | 2, size: number, label: string): HTMLElement {
  const f = document.createElement('figure');
  const c = document.createElement('canvas');
  paint(c, m, size, gen);
  c.style.width = c.style.height = size + 'px';
  const cap = document.createElement('figcaption');
  cap.textContent = label;
  f.append(c, cap);
  return f;
}
function section(title: string, sub: string, kids: HTMLElement[], cls: string): void {
  const h = document.createElement('header');
  h.innerHTML = `<p>${sub}</p><h1>${title}</h1>`;
  const g = document.createElement('div');
  g.className = 'grid ' + cls;
  g.append(...kids);
  document.body.append(h, g);
}

function timing(): { g1: number; g2: number } {
  const ms = Array.from({ length: 80 }, (_, k) => mon(k + 9000));
  const c = document.createElement('canvas');
  const run = (gen: 1 | 2) => {
    const t0 = performance.now();
    for (const m of ms) paint(c, m, 140, gen);
    return (performance.now() - t0) / ms.length;
  };
  run(1);
  return { g1: run(1), g2: run(2) };
}

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  if (params.get('time')) {
    (window as unknown as { stats: unknown }).stats = timing();
    (window as unknown as { done: boolean }).done = true;
    return;
  }
  const T = Number(params.get('t') ?? 0.6);
  const sample = Array.from({ length: 400 }, (_, k) => mon(k + 1000));
  const s1 = stats(sample, geo1, T),
    s2 = stats(sample, geo2, T);
  const pct = (v: number) => Math.round(v * 100) + ' %';
  (window as unknown as { stats: unknown }).stats = { s1, s2 };
  const head = document.createElement('div');
  head.className = 'stats';
  head.innerHTML = `<p>400 Züge, Silhouetten verglichen (auch gespiegelt)</p>
    <table><tr><th></th><th>Generation 1</th><th>Generation 2</th></tr>
    <tr><td>sieht einem der 2 Züge davor ähnlich</td><td>${pct(s1.last2)}</td><td>${pct(s2.last2)}</td></tr>
    <tr><td>sieht einem der 10 Züge davor ähnlich</td><td>${pct(s1.last10)}</td><td>${pct(s2.last10)}</td></tr></table>`;
  const first = Array.from({ length: 16 }, (_, k) => mon(k + 1));
  section('Heute: 16 Züge', 'Entwurf · Formen Generation 1', first.map((m) => tile(m, 1, 150, `${BP[m.bp].n}`)), 'g8');
  section('Neu: dieselben 16 Züge', 'Entwurf · Formen Generation 2', first.map((m) => tile(m, 2, 150, `${BP[m.bp].n} · ${geo2(m).variant}`)), 'g8');
  document.body.append(head);
  for (const bp of BAUPLAENE) {
    const ms: Monster[] = [];
    for (let k = 0; ms.length < 8; k++) {
      const m = mon(5000 + k);
      if (m.bp === bp.id) ms.push(m);
    }
    section(bp.n, 'Ein Bauplan, acht Züge · Generation 2', ms.map((m) => tile(m, 2, 150, `${geo2(m).variant} · ${PIG[m.main].n.split(' ')[0]}`)), 'g8');
  }
  (window as unknown as { done: boolean }).done = true;
}
void main();
