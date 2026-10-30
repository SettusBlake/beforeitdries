/*
 * Bausatz der neuen Formen: Ellipsen, Vielecke, Drehkörper und Linien in Blattkoordinaten (0 bis 1).
 * Seitenansicht schaut nach links, die Mitte liegt etwa bei (0,5 | 0,55). Am Ende wird eingepasst.
 * z ordnet die Kleckse: kleiner liegt hinten. Linien liegen immer unter den Klecksen, ihre Tusche oben.
 */
import type { BlobShape, FaceSpot, Geometry, Limb, Pt } from '../data';
import { clamp, lerp, pick, ri, rr, type Rand } from '../rng';

export type B = BlobShape;
type Opt = Partial<B>;
/** Mehr Kleckse kosten Malzeit am Handy (Generation 1 hat höchstens 8) */
export const BLOB_MAX = 28;
/** Linien sind billiger, aber nicht umsonst */
export const LIMB_MAX = 60;

export class Kit {
  private items: { b: B; z: number; i: number }[] = [];
  limbs: Limb[] = [];
  faces: FaceSpot[] = [];
  private n = 0;
  /** Chance, dass eine Vorlage einen ganz anderen Kopf bekommt (Mischwesen) */
  mix = 0.12;
  /** Vorgegebene Variante einer Vorlage (siehe Arche.kinds), gilt für den ersten Aufruf von kind() */
  force: string | null = null;
  constructor(public r: Rand) {}

  /** Variante wählen: vorgegeben oder zufällig */
  kind<T extends string>(list: readonly T[]): T {
    const f = this.force;
    this.force = null;
    const hit = list.find((x) => x === f);
    return hit ?? this.pick(list);
  }

  /* ---------- Zufall ---------- */
  rr(a: number, b: number): number {
    return rr(this.r, a, b);
  }
  ri(a: number, b: number): number {
    return ri(this.r, a, b);
  }
  pick<T>(a: readonly T[]): T {
    return pick(this.r, a);
  }
  chance(p: number): boolean {
    return this.r() < p;
  }
  /** ±1 */
  sign(): number {
    return this.r() < 0.5 ? -1 : 1;
  }

  /* ---------- Kleckse ---------- */
  add(b: B, z = 0): B {
    this.items.push({ b, z, i: this.n++ });
    return b;
  }
  e(x: number, y: number, rx: number, ry: number, rot = 0, z = 0, f: Opt = {}): B {
    return this.add({ x, y, rx, ry, rot, ...f }, z);
  }
  c(x: number, y: number, rad: number, z = 0, f: Opt = {}): B {
    return this.e(x, y, rad, rad, 0, z, f);
  }
  /** Vieleck aus Blattpunkten. Mitte und Halbachsen für Renderer und Einpassen aus dem Rahmen */
  poly(pts: Pt[], z = 0, f: Opt = {}): B {
    let x0 = 1e9,
      y0 = 1e9,
      x1 = -1e9,
      y1 = -1e9;
    for (const p of pts) {
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    return this.add({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, rx: Math.max(0.004, (x1 - x0) / 2), ry: Math.max(0.004, (y1 - y0) / 2), rot: 0, pts, crisp: 0.3, ...f }, z);
  }
  /** Rechteck mit runden Ecken (round: Anteil der kürzeren Seite) */
  rect(x: number, y: number, w: number, h: number, rot = 0, round = 0.2, z = 0, f: Opt = {}): B {
    return this.poly(rrectPts(x, y, w, h, rot, round), z, f);
  }
  tri(a: Pt, b: Pt, c: Pt, z = 0, f: Opt = {}): B {
    return this.poly([a, b, c], z, { crisp: 0.25, ...f });
  }
  /** Drehkörper: Breite w * prof(t) von oben (t = 0) nach unten (t = 1), Höhe h, oben bei top */
  lathe(x: number, top: number, h: number, w: number, prof: (t: number) => number, steps = 8, z = 0, f: Opt = {}): B {
    const right: Pt[] = [],
      left: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        hw = Math.max(0.002, w * prof(t));
      right.push([x + hw, top + h * t]);
      left.push([x - hw, top + h * t]);
    }
    return this.poly([...right, ...left.reverse()], z, { crisp: 0.25, ...f });
  }
  /** Stern oder Zahnrad: n Spitzen zwischen r0 und r1 */
  star(x: number, y: number, r0: number, r1: number, n: number, rot = 0, z = 0, f: Opt = {}, square = false): B {
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2,
        da = Math.PI / n;
      if (square) {
        for (const [aa, rad] of [
          [a - da * 0.5, r0],
          [a - da * 0.35, r1],
          [a + da * 0.35, r1],
          [a + da * 0.5, r0],
        ] as [number, number][])
          pts.push([x + Math.cos(aa) * rad, y + Math.sin(aa) * rad]);
      } else {
        pts.push([x + Math.cos(a) * r1, y + Math.sin(a) * r1], [x + Math.cos(a + da) * r0, y + Math.sin(a + da) * r0]);
      }
    }
    return this.poly(pts, z, f);
  }
  /** Kleckse entlang eines Linienzugs, ohne Lücken (höchstens max) */
  tube(pts: Pt[], r0: number, r1: number, z = 0, max = 10, sq = 1, f: Opt = {}): B[] {
    return tubePts(pts, r0, r1, max).map(([p, rad, rot]) => this.e(p[0], p[1], rad, rad * sq, rot, z, f));
  }

  /* ---------- Linien und Gesicht ---------- */
  line(pts: Pt[], w: number): Limb {
    const l = { pts, w };
    this.limbs.push(l);
    return l;
  }
  /** geschlossener Ring als Linie (Rad, Fenster, Henkel) */
  ring(x: number, y: number, rx: number, ry: number, w: number, a0 = 0, a1 = Math.PI * 2, n = 12): Limb {
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
    }
    return this.line(pts, w);
  }
  face(x: number, y: number, r: number, f: Partial<FaceSpot> = {}): FaceSpot {
    const s = { x, y, r, ...f };
    this.faces.push(s);
    return s;
  }

  build(): Geometry {
    const blobs = this.items
      .slice()
      .sort((a, b) => a.z - b.z || a.i - b.i)
      .map((x) => x.b);
    // Kleine Teile mit weniger Lasurschichten malen
    const big = Math.max(...blobs.map((b) => b.rx * b.ry), 1e-9);
    for (const b of blobs) if (b.rx * b.ry < big * 0.12 && !b.leaf) b.few = true;
    // Malzeit begrenzen: höchstens BLOB_MAX Kleckse, die kleinsten fallen weg
    while (blobs.length > BLOB_MAX) {
      let k = 0;
      for (let i = 1; i < blobs.length; i++) if (blobs[i]!.rx * blobs[i]!.ry < blobs[k]!.rx * blobs[k]!.ry) k = i;
      blobs.splice(k, 1);
    }
    const len = (l: Limb) => l.pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - l.pts[i - 1]![0], p[1] - l.pts[i - 1]![1]) : 0), 0);
    const limbs = this.limbs.slice();
    while (limbs.length > LIMB_MAX) {
      let k = 0;
      for (let i = 1; i < limbs.length; i++) if (len(limbs[i]!) < len(limbs[k]!)) k = i;
      limbs.splice(k, 1);
    }
    return { blobs, limbs, faces: this.faces, top: [] };
  }
}

/* ---------- Geometrie ---------- */
export function rrectPts(x: number, y: number, w: number, h: number, rot = 0, round = 0.2): Pt[] {
  const rad = Math.min(w, h) * clamp(round, 0, 0.5),
    hw = w / 2 - rad,
    hh = h / 2 - rad,
    c = Math.cos(rot),
    s = Math.sin(rot),
    pts: Pt[] = [];
  const put = (px: number, py: number) => pts.push([x + px * c - py * s, y + px * s + py * c]);
  for (const [cx, cy, a0] of [
    [hw, hh, 0],
    [-hw, hh, Math.PI / 2],
    [-hw, -hh, Math.PI],
    [hw, -hh, Math.PI * 1.5],
  ] as [number, number, number][]) {
    if (rad < 0.003) put(cx, cy);
    else for (let k = 0; k < 3; k++) put(cx + Math.cos(a0 + (Math.PI / 4) * k) * rad, cy + Math.sin(a0 + (Math.PI / 4) * k) * rad);
  }
  return pts;
}

/** Linienzug: Richtung ang (0 rechts, π/2 unten), dreht sich um bend, wob wackelt */
export function curve(r: Rand, x: number, y: number, len: number, ang: number, bend: number, n = 8, wob = 0): Pt[] {
  const pts: Pt[] = [[x, y]],
    step = len / n,
    ph = rr(r, 0, 6.28);
  let a = ang;
  for (let i = 1; i <= n; i++) {
    a += (bend / n) * (0.5 + i / n) + Math.sin(ph + i * 1.7) * wob;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    pts.push([x, y]);
  }
  return pts;
}

/** Punkte, Radien und Richtung für einen geschlossenen Schlauch entlang eines Linienzugs */
export function tubePts(pts: Pt[], r0: number, r1: number, max = 10): [Pt, number, number][] {
  const seg: number[] = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const total = seg[seg.length - 1]!;
  const at = (d: number): [Pt, number] => {
    let i = 1;
    while (i < seg.length - 1 && seg[i]! < d) i++;
    const t = (d - seg[i - 1]!) / Math.max(1e-9, seg[i]! - seg[i - 1]!),
      a = pts[i - 1]!,
      b = pts[Math.min(i, pts.length - 1)]!;
    return [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], Math.atan2(b[1] - a[1], b[0] - a[0])];
  };
  let gap = 1.3,
    out: [Pt, number, number][] = [];
  for (let tries = 0; tries < 12; tries++) {
    out = [];
    for (let d = 0; d <= total + 1e-9; d += Math.max(0.004, lerp(r0, r1, total ? d / total : 0) * gap)) {
      const [p, rot] = at(d);
      out.push([p, lerp(r0, r1, total ? d / total : 0), rot]);
    }
    if (out.length <= max) break;
    gap *= 1.2;
  }
  if (out.length > 1 && pts.length > 1) out[out.length - 1]![0] = pts[pts.length - 1]!;
  return out;
}

/** Ellipsenrand, Winkel a in der Ellipse */
export function edge(b: B, a: number, k = 1): Pt {
  const c = Math.cos(b.rot),
    s = Math.sin(b.rot),
    ex = Math.cos(a) * b.rx * k,
    ey = Math.sin(a) * b.ry * k;
  return [b.x + ex * c - ey * s, b.y + ex * s + ey * c];
}

/* ---------- Ganzes Monster: spiegeln, strecken, neigen, einpassen ---------- */
type Shape = { blobs: B[]; limbs: Limb[]; faces: FaceSpot[] };
function mapBlob(b: B, f: (p: Pt) => Pt, sx: number, sy: number): B {
  const [x, y] = f([b.x, b.y]);
  const c = Math.cos(b.rot),
    s = Math.sin(b.rot);
  return { ...b, x, y, rx: b.rx * Math.hypot(sx * c, sy * s), ry: b.ry * Math.hypot(sx * s, sy * c), rot: Math.atan2(sy * s, sx * c), ...(b.pts ? { pts: b.pts.map(f) } : {}) };
}
export function mapShape(g: Shape, f: (p: Pt) => Pt, sx: number, sy: number, wk: number): void {
  g.blobs = g.blobs.map((b) => mapBlob(b, f, sx, sy));
  g.limbs = g.limbs.map((l) => ({ pts: l.pts.map(f), w: l.w * wk }));
  g.faces = g.faces.map((fc) => {
    const [x, y] = f([fc.x, fc.y]);
    return { ...fc, x, y, r: fc.r * Math.sqrt(sx * sy) };
  });
}
export function bounds(g: Shape): [number, number, number, number] {
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  const grow = (x: number, y: number, hx: number, hy: number) => {
    x0 = Math.min(x0, x - hx);
    x1 = Math.max(x1, x + hx);
    y0 = Math.min(y0, y - hy);
    y1 = Math.max(y1, y + hy);
  };
  for (const b of g.blobs) {
    if (b.pts) {
      for (const p of b.pts) grow(p[0], p[1], 0.006, 0.006);
      continue;
    }
    const c = Math.cos(b.rot),
      s = Math.sin(b.rot);
    grow(b.x, b.y, Math.hypot(b.rx * c, b.ry * s) * 1.12, Math.hypot(b.rx * s, b.ry * c) * 1.12);
  }
  for (const l of g.limbs) for (const p of l.pts) grow(p[0], p[1], l.w, l.w);
  for (const f of g.faces) grow(f.x, f.y - f.r * (f.stalks ? 0.9 : 0.3), f.r, f.r * (f.stalks ? 1.9 : 1.1));
  return [x0, y0, x1, y1];
}
/** Spiegeln (flip -1), strecken und neigen um die Mitte, dann auf size des Blatts einpassen */
export function finish(g: Shape, flip: number, sx: number, sy: number, tilt: number, size: number): void {
  const ct = Math.cos(tilt),
    st = Math.sin(tilt);
  mapShape(
    g,
    ([x, y]) => {
      const dx = (x - 0.5) * sx * flip,
        dy = (y - 0.55) * sy;
      return [0.5 + dx * ct - dy * st, 0.55 + dx * st + dy * ct];
    },
    sx,
    sy,
    1,
  );
  for (const b of g.blobs) b.rot = (flip < 0 ? Math.PI - b.rot : b.rot) + tilt;
  const [x0, y0, x1, y1] = bounds(g);
  const k = size / Math.max(x1 - x0, y1 - y0),
    mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2;
  mapShape(g, ([x, y]) => [0.5 + (x - mx) * k, 0.53 + (y - my) * k], k, k, k);
  for (const l of g.limbs) l.w = clamp(l.w, 0.005, 0.045);
}
