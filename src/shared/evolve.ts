/*
 * Entwurf Entwicklung (Fassung 2, docs/entwuerfe/entwicklung-vorschlag.md, noch nicht im Spiel): ein Klecks entwickelt sich
 * wie bei Pokémon oder Digimon. Die Form wächst und verändert sich, neue Teile sprießen, die Farbe verläuft.
 * Alles aus einem eigenen Zufall je Stufe (Seed des Monsters und Stufe): jedes Monster entwickelt sich anders, gleiches
 * Monster, gleiche Stufe, gleiche Richtung, gleiches Bild. Stufe 0 bleibt genau wie heute (die Form aus dem Seed).
 * Gilt für alle Formen: Generation 1, Generation 2 und selbst gemalte, weil nur die fertige Geometrie verändert wird.
 */
import type { BlobShape, BlueprintId, Geometry, PigmentId, Pt } from './data';
import { PIG, PIGMENTS } from './data';
import { hat, tail, wings, type Head } from './forms/parts';
import { Kit } from './forms/kit';
import { RNG, type Rand } from './rng';

export type EvoStage = 0 | 1 | 2 | 3;
/** Richtung ab Stufe 2 (wie bei Digimon: hängt davon ab, was der Klecks im Duell meistens getan hat) */
export type EvoPath = 'spatter' | 'impasto' | 'bloom' | 'lift';
export const EVO_PATHS: { k: EvoPath; name: string; from: string }[] = [
  { k: 'spatter', name: 'Spatter', from: 'splashes a lot' },
  { k: 'impasto', name: 'Impasto', from: 'takes hits and stands' },
  { k: 'bloom', name: 'Bloom', from: 'paints the paper' },
  { k: 'lift', name: 'Lift', from: 'moves and dodges' },
];

const clone = (g: Geometry): Geometry => JSON.parse(JSON.stringify(g)) as Geometry;
const area = (b: BlobShape): number => b.rx * b.ry;
const inEll = (b: BlobShape, x: number, y: number): boolean => ((x - b.x) / b.rx) ** 2 + ((y - b.y) / b.ry) ** 2 <= 1.15;

/** Alles in der Form durch f abbilden, Größen mit k */
function mapGeom(g: Geometry, f: (p: Pt) => Pt, k: number): void {
  for (const b of [...g.blobs, ...g.top]) {
    const [x, y] = f([b.x, b.y]);
    b.x = x;
    b.y = y;
    b.rx *= k;
    b.ry *= k;
    if (b.pts) b.pts = b.pts.map(f);
  }
  for (const l of g.limbs) {
    l.pts = l.pts.map(f);
    l.w *= Math.sqrt(k);
  }
  for (const fc of g.faces) {
    const [x, y] = f([fc.x, fc.y]);
    fc.x = x;
    fc.y = y;
    fc.r *= k;
  }
}
function bounds(g: Geometry): [number, number, number, number] {
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  const put = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  };
  for (const b of [...g.blobs, ...g.top]) {
    if (b.pts) for (const p of b.pts) put(p[0], p[1]);
    else {
      const R = Math.max(b.rx, b.ry);
      put(b.x - R, b.y - R);
      put(b.x + R, b.y + R);
    }
  }
  for (const l of g.limbs) for (const p of l.pts) put(p[0], p[1]);
  return [x0, y0, x1, y1];
}
/** In das Blatt einpassen: größte Seite = size (Stufe 0 etwa 0,72, entwickelt größer) */
function fit(g: Geometry, size: number): void {
  const [x0, y0, x1, y1] = bounds(g);
  const k = size / Math.max(x1 - x0, y1 - y0, 1e-6);
  const mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2;
  mapGeom(g, ([x, y]) => [0.5 + (x - mx) * k, 0.53 + (y - my) * k], k);
  for (const l of g.limbs) l.w = Math.min(0.045, Math.max(0.005, l.w));
}

/** Kopf und Körper finden: Gesicht, der Klecks darunter (Kopf), der Rest als Körper (Rahmen und Oberkante), Blickrichtung */
function anatomy(g: Geometry) {
  const face = g.faces[0] ?? { x: 0.5, y: 0.45, r: 0.06 };
  const biggest = g.blobs.reduce((p, c) => (area(c) > area(p) ? c : p), g.blobs[0]!);
  const heads = g.blobs.filter((b) => b !== biggest && inEll(b, face.x, face.y));
  const headB = heads.length ? heads.reduce((p, c) => (area(c) < area(p) ? c : p)) : biggest;
  const rest = g.blobs.filter((b) => b !== headB && area(b) > area(biggest) * 0.04);
  const parts = rest.length ? rest : [biggest];
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  for (const b of parts) {
    x0 = Math.min(x0, b.x - b.rx);
    x1 = Math.max(x1, b.x + b.rx);
    y0 = Math.min(y0, b.y - b.ry);
    y1 = Math.max(y1, b.y + b.ry);
  }
  const body: BlobShape = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2, rot: 0 };
  /** Oberkante des Körpers an der Stelle x (Ellipsen genähert) */
  const topY = (x: number): number => {
    let t = body.y;
    for (const b of parts) {
      const u = (x - b.x) / b.rx;
      if (Math.abs(u) < 1) t = Math.min(t, b.y - b.ry * Math.sqrt(1 - u * u));
    }
    return t;
  };
  const dir = Math.abs(face.x - body.x) > body.rx * 0.25 ? Math.sign(face.x - body.x) : 0;
  const hr = Math.max(headB === biggest ? face.r * 1.6 : Math.max(headB.rx, headB.ry), face.r * 1.2);
  const head: Head = { h: headB, x: face.x, y: face.y, r: hr, dir: dir || -1, top: face.y - hr };
  return { face, body, biggest, headB, head, dir, topY, s: Math.max(body.rx, body.ry) };
}
type Ana = ReturnType<typeof anatomy>;

/** Teile aus einem Bausatz anhängen: hinten (Flügel, Schwänze, Mähnen) oder vorn (Hörner, Panzer, Hüte) */
function merge(g: Geometry, back: Kit, front: Kit): void {
  const b = back.build(),
    f = front.build();
  g.blobs = [...b.blobs, ...g.blobs, ...f.blobs];
  g.limbs = [...b.limbs, ...g.limbs, ...f.limbs];
}

/* ---------- Teile, die sprießen ---------- */
function horns(k: Kit, hd: Head, big: number): void {
  const { x, r } = hd,
    y = hd.top + r * 0.25;
  for (const sg of [-1, 1]) {
    const bx = x + sg * r * 0.45,
      len = r * (0.7 + big * 0.6);
    const tipx = bx + sg * len * 0.45 + hd.dir * r * 0.15,
      tipy = y - len;
    k.poly([[bx - r * 0.13, y + r * 0.05], [bx + sg * len * 0.15, y - len * 0.55], [tipx, tipy], [bx + sg * len * 0.32, y - len * 0.45], [bx + r * 0.15, y + r * 0.05]], 5, { ink: true, crisp: 0.5 });
  }
}
/** Stacheln entlang der Oberkante des Körpers, leicht nach hinten geneigt */
function spikes(k: Kit, a: Ana, n: number, len: number): void {
  const back = -a.head.dir;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = a.body.x + (t - 0.5) * a.body.rx * 1.5;
    // Nicht in den Kopf stechen
    if (Math.abs(x - a.head.x) < a.head.r * 0.8 && a.head.h !== a.biggest) continue;
    const y = a.topY(x) + len * 0.12;
    const L = len * (0.7 + 0.6 * Math.sin(t * Math.PI));
    const w = len * 0.3;
    k.tri([x - w, y], [x + w, y], [x + back * L * 0.35, y - L], -1, { ink: true, crisp: 0.6 });
  }
}
/** Panzerplatten auf dem Rücken, wie Schuppen übereinander */
function plates(k: Kit, a: Ana, n: number): void {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = a.body.x + (t - 0.5) * a.body.rx * 1.3;
    const y = a.topY(x) + a.s * 0.1;
    k.rect(x, y, a.s * 0.42, a.s * 0.24, (t - 0.5) * 0.7, 0.4, 6 + i, { ink: true, crisp: 0.4 });
  }
}
function mane(k: Kit, hd: Head, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    k.e(hd.x + Math.cos(a) * hd.r * 1.05, hd.y + Math.sin(a) * hd.r * 1.0, hd.r * 0.5, hd.r * 0.3, a, 0);
  }
}
function orbs(k: Kit, body: BlobShape, n: number, r: Rand): void {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.9 + (r() - 0.5) * 0.3;
    k.c(body.x + Math.cos(a) * body.rx * 1.6, body.y + Math.sin(a) * body.ry * 1.7, body.rx * 0.14, 8);
  }
}
/** Körper wächst stärker als der Kopf (wie Baby zu Erwachsenem), Linien (Beine, Fühler) werden länger */
function grow(g: Geometry, headB: BlobShape, body: BlobShape, gb: number, gl: number): void {
  for (const b of g.blobs) {
    if (b === headB) continue;
    const k = b === body ? gb : 1 + (gb - 1) * 0.6;
    if (b.pts) b.pts = b.pts.map(([x, y]) => [b.x + (x - b.x) * k, b.y + (y - b.y) * k]);
    b.rx *= k;
    b.ry *= k;
  }
  for (const l of g.limbs) {
    const [x0, y0] = l.pts[0]!;
    l.pts = l.pts.map(([x, y]) => [x0 + (x - x0) * gl, y0 + (y - y0) * gl]);
    l.w *= 1 + (gl - 1) * 0.8;
  }
}

/** Die Form einer Stufe. path gilt ab Stufe 2 (Stufe 1 ist für alle gleich: wachsen und ein erstes Teil) */
export function evolveGeometry(g0: Geometry, bp: BlueprintId, seed: number, stage: EvoStage, path: EvoPath): Geometry {
  const g = clone(g0);
  if (stage === 0) return g;
  const a = anatomy(g);
  const r = RNG((seed ^ 0xe501) + stage * 7919);
  const back = new Kit(RNG((seed ^ 0xe5b0) + stage * 131)),
    front = new Kit(RNG((seed ^ 0xe5f0) + stage * 137));
  const flyer = bp === 'flatterer' || bp === 'schwebeblase' || bp === 'qualle';
  // Rücken (für Schwanz) und Schulter (für Flügel)
  const tailX = a.body.x - a.head.dir * a.body.rx * 0.92,
    tailY = a.body.y + a.body.ry * 0.1;
  const shX = a.body.x + a.head.dir * a.body.rx * 0.1,
    shY = a.topY(a.body.x) + a.body.ry * 0.2;
  // 1: wachsen und ein erstes Teil (für alle)
  grow(g, a.headB, a.biggest, [1, 1.12, 1.24, 1.34][stage]!, [1, 1.12, 1.22, 1.3][stage]!);
  const first = r();
  if (first < 0.34) horns(front, a.head, 0);
  else if (first < 0.67) spikes(back, a, 4, a.s * 0.3);
  else tail(back, r() < 0.5 ? 'tuft' : 'curl', tailX, tailY, -a.head.dir, a.s * 0.9);
  // 2 und 3: die Richtung
  if (stage >= 2) {
    const big = stage === 3 ? 1 : 0;
    if (path === 'spatter') {
      spikes(back, a, 6 + big * 3, a.s * (0.42 + big * 0.18));
      horns(front, a.head, 0.6 + big * 0.6);
      if (big) tail(back, 'sting', tailX, tailY, -a.head.dir, a.s * 1.3);
    } else if (path === 'impasto') {
      plates(front, a, 3 + big * 2);
      if (big) {
        hat(front, a.head, 'crown');
        spikes(back, a, 5, a.s * 0.25);
      }
    } else if (path === 'bloom') {
      wings(back, flyer || big ? 'butterfly' : 'feather', shX, shY, a.s * (0.8 + big * 0.2), a.dir !== 0, -3, 0.7);
      if (big) mane(back, a.head, 11);
      else hat(front, a.head, 'flower');
    } else {
      tail(back, big ? 'peacock' : 'spiral', tailX, tailY, -a.head.dir, a.s * (1.1 + big * 0.3));
      wings(back, 'insect', shX, shY, a.s * (0.75 + big * 0.25), a.dir !== 0, -3, 0.9);
      if (big) {
        orbs(front, a.body, 3, r);
        hat(front, a.head, 'halo');
      }
    }
  }
  merge(g, back, front);
  // Entwickelte Kleckse stehen größer im Bild
  fit(g, [0.72, 0.78, 0.84, 0.88][stage]!);
  return g;
}

/** Farbe der Richtung, die hineinläuft: Spatter Carmine, Impasto Cadmium (deckend), Bloom Opera Rose, Lift Ultramarine (die zweite, wenn es schon die eigene ist) */
const PATH_PIG: Record<EvoPath, [PigmentId, PigmentId]> = { spatter: ['karmin', 'opera'], impasto: ['kadmium', 'siena'], bloom: ['opera', 'karmin'], lift: ['ultra', 'phthalo'] };
export function evoPigment(main: PigmentId, path: EvoPath): PigmentId {
  const [a, b] = PATH_PIG[path];
  return a === main ? b : a;
}
/** Farbe verläuft: Stufe 1 läuft die neue Farbe in die Zweitfarbe, Stufe 2 eine Lasur darüber, Stufe 3 eine zweite (tiefer, außer Lift: der hebt Farbe aus) */
export function evolveColours<M extends { seed: number; humidity: number; main: PigmentId; sec: PigmentId[]; glazes: { p: PigmentId; seed: number }[] }>(m: M, stage: EvoStage, path: EvoPath, first: EvoPath = path): M {
  if (stage === 0) return m;
  // Stufe 1 kennt die Richtung noch nicht: die Farbe kommt aus dem Seed (first)
  const add = evoPigment(m.main, stage === 1 ? first : path);
  const glazes = [...m.glazes];
  if (stage >= 2) glazes.push({ p: add, seed: (m.seed ^ 0xe2) >>> 0 });
  if (stage >= 3 && path !== 'lift') glazes.push({ p: add, seed: (m.seed ^ 0xe3) >>> 0 });
  const sec = [add, ...m.sec.filter((x) => x !== add)];
  return { ...m, humidity: Math.min(95, m.humidity + [0, 4, 8, 12][stage]!), sec, glazes };
}
