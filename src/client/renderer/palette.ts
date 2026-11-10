/*
 * Malen nach dem Farbplan (freigegeben am 10.11.2026, src/shared/palette.ts): Lasuren in einer Farbe oder als nasser Verlauf aus zwei oder drei,
 * Glieder mit eigener Spitze, Schatten, ausgehobener Bauch, Hof auf dem Papier, Goldstaub.
 * Die Form verbraucht denselben Zufall wie ohne Plan (r), alles Neue hat einen eigenen (jr).
 */
import type { BlobShape, Limb } from '../../shared/data';
import type { Plan, RGBn } from '../../shared/palette';
import { gauss, ri, rr, type Rand } from '../../shared/rng';
import { deformN, ellipsePts, poly, smooth, type P2, type P3 } from './watercolor';

type Ctx = CanvasRenderingContext2D;
export type Box = [number, number, number, number];
/** Eine Füllung: eine Farbe oder ein Verlauf a nach b (nach c) */
export type Paint = { a: RGBn; b?: RGBn; c?: RGBn };
type Base = { b: BlobShape; base: P3[] };

const twice = (a: number): number => 1 - (1 - a) * (1 - a);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const darker = (c: readonly number[], f: number): RGBn => [Math.round(c[0]! * f), Math.round(c[1]! * f), Math.round(c[2]! * f)];
const area = (b: BlobShape): number => b.rx * b.ry;

export function boxOf(polys: P2[][]): Box {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of polys)
    for (const q of p) {
      x0 = Math.min(x0, q[0]);
      y0 = Math.min(y0, q[1]);
      x1 = Math.max(x1, q[0]);
      y1 = Math.max(y1, q[1]);
    }
  return [x0, y0, x1, y1];
}

/** Füllung für eine Schicht: Farbe oder Verlauf entlang ang über box. j verschiebt die Mitte, so verläuft es weich wie nass in nass */
function fillOf(ctx: Ctx, p: Paint, box: Box, ang: number, alpha: number, j: number): string | CanvasGradient {
  if (!p.b) return `rgba(${p.a},${alpha})`;
  const cx = (box[0] + box[2]) / 2,
    cy = (box[1] + box[3]) / 2,
    dx = Math.cos(ang),
    dy = Math.sin(ang),
    h = (Math.abs(dx) * (box[2] - box[0]) + Math.abs(dy) * (box[3] - box[1])) / 2;
  const g = ctx.createLinearGradient(cx - dx * h, cy - dy * h, cx + dx * h, cy + dy * h);
  const col = (c: RGBn) => `rgba(${c},${alpha})`;
  g.addColorStop(0, col(p.a));
  if (p.c) {
    // Die Hauptfarbe behält den größten Teil
    g.addColorStop(clamp01(0.34 + j), col(p.a));
    g.addColorStop(clamp01(0.62 + j), col(p.b));
    g.addColorStop(clamp01(0.88 + j), col(p.c));
    g.addColorStop(1, col(p.c));
  } else {
    g.addColorStop(clamp01(0.38 + j), col(p.a));
    g.addColorStop(clamp01(0.78 + j), col(p.b));
    g.addColorStop(1, col(p.b));
  }
  return g;
}

/** Lasur wie wash im Renderer, aber mit Füllung nach Plan. lite: jede zweite Schicht mit ausgeglichener Deckkraft, gleicher Zufall */
export function washP(ctx: Ctx, base: P3[], p: Paint, box: Box, ang: number, r: Rand, jr: Rand, layers: number, alpha: number, amt: number, lite: boolean): void {
  for (let i = 0; i < layers; i++) {
    const q = deformN(base, r, amt, 2);
    const j = (jr() - 0.5) * 0.34;
    if (lite && i % 2 === 1) continue;
    ctx.fillStyle = fillOf(ctx, p, box, ang, lite ? twice(alpha) : alpha, j);
    poly(ctx, q);
    ctx.fill();
  }
}

/** Glied wie limbWash, mit eigener Farbe an der Spitze (das Ende, das weiter von der Mitte der Figur liegt) */
export function limbP(ctx: Ctx, l: Limb, p: Paint, mid: [number, number], r: Rand, S: number, alpha: number, lite: boolean): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const a = l.pts[0]!,
    z = l.pts[l.pts.length - 1]!;
  const far = Math.hypot(a[0] * S - mid[0], a[1] * S - mid[1]) > Math.hypot(z[0] * S - mid[0], z[1] * S - mid[1]);
  const [from, to] = far ? [z, a] : [a, z];
  for (let k = 0; k < 7; k++) {
    const al = lite ? twice(alpha) : alpha;
    if (p.b) {
      const g = ctx.createLinearGradient(from[0] * S, from[1] * S, to[0] * S, to[1] * S);
      g.addColorStop(0, `rgba(${p.a},${al})`);
      g.addColorStop(0.45, `rgba(${p.a},${al})`);
      g.addColorStop(0.85, `rgba(${p.b},${al})`);
      g.addColorStop(1, `rgba(${p.b},${al})`);
      ctx.strokeStyle = g;
    } else ctx.strokeStyle = `rgba(${p.a},${al})`;
    ctx.lineWidth = l.w * S * rr(r, 0.8, 1.35);
    const pts: P2[] = l.pts.map((q) => [q[0] * S + gauss(r) * S * 0.003, q[1] * S + gauss(r) * S * 0.003]);
    if (lite && k % 2 === 1) continue;
    smooth(ctx, pts);
    ctx.stroke();
  }
}

/** Welche Füllung jedes Teil nach dem Plan bekommt: Körper, große Teile, kleine Teile, Glieder */
export function paintsOf(plan: Plan, bases: Base[], core: Base): { blob: Map<Base, Paint>; limb: Paint; head: Base | null } {
  const c = plan.cols,
    c0 = c[0]!,
    c1 = c[1] ?? c0,
    c2 = c[2] ?? c1,
    c3 = c[3] ?? c2;
  const bigA = area(core.b) * 0.3;
  // Große Flügel gehören zum Körper (sonst wäre bei einem Falter die Hauptfarbe kaum zu sehen), Blätter sind immer Schmuck
  const isBig = (o: Base) => o === core || (area(o.b) >= bigA && !o.b.leaf);
  // „Kopf“: das oberste große Teil neben dem Körper
  const others = bases.filter((o) => o !== core && isBig(o)).sort((a, b) => a.b.y - b.b.y);
  const head = others[0] ?? null;
  const blob = new Map<Base, Paint>();
  let limb: Paint = { a: c0 };
  const second = plan.second === 'head' && !head ? 'fade' : plan.second;
  for (const o of bases) {
    const big = isBig(o);
    let p: Paint;
    if (plan.tier === 0) p = { a: !big && plan.smallDark ? darker(c0, 0.72) : c0 };
    else if (plan.tier >= 4) p = big ? { a: c0, b: c1, c: c2 } : { a: c3 };
    else if (plan.tier === 3) p = big ? { a: c0, b: c1 } : { a: c3 };
    else if (second === 'ends') p = big ? { a: c0 } : { a: plan.tier === 2 ? c2 : c1 };
    else if (second === 'head') p = o === head ? { a: c1 } : big ? { a: c0 } : { a: plan.tier === 2 ? c2 : c0 };
    else if (second === 'fade') p = big ? { a: c0, b: c1 } : { a: plan.tier === 2 ? c2 : c1 };
    else p = big ? { a: c0 } : { a: plan.tier === 2 ? c2 : c0 };
    blob.set(o, p);
  }
  if (plan.tier >= 4) limb = { a: c1, b: c3 };
  else if (plan.tier === 3) limb = { a: c2, b: c3 };
  else if (plan.tier >= 1) limb = second === 'ends' ? { a: c1 } : { a: c0, b: c1 };
  return { blob, limb, head };
}

/** Flecken der zweiten Farbe im Körper (Plan „patch“): kräftiger als die alten Zweitfarben-Schleier */
export function patches(ctx: Ctx, bases: Base[], core: Base, rgb: RGBn, S: number, vf: number, r: Rand, lite: boolean): void {
  const big = area(core.b) * 0.3;
  for (const o of bases) {
    if (area(o.b) < big || o.b.leaf) continue;
    for (let k = 0, n = o === core ? 2 : 1; k < n; k++) {
      const b = o.b,
        sub = { x: b.x + gauss(r) * b.rx * 0.3, y: b.y + gauss(r) * b.ry * 0.3, rx: Math.min(b.rx, 0.2) * rr(r, 0.4, 0.7), ry: Math.min(b.ry, 0.2) * rr(r, 0.4, 0.7), rot: r() * 3 };
      const base = deformN(ellipsePts(sub, S, r, 10), r, 0.45 * vf, 3);
      ctx.save();
      poly(ctx, o.base);
      ctx.clip();
      washP(ctx, base, { a: rgb }, [0, 0, S, S], 0, r, r, 14, 0.07, 0.4 * vf, lite);
      ctx.restore();
    }
  }
}

/** Schatten: unten dunkler, gibt den großen Teilen Volumen */
export function shade(ctx: Ctx, o: Base, rgb: RGBn, alpha = 0.2): void {
  const [x0, y0, x1, y1] = boxOf([o.base]);
  ctx.save();
  poly(ctx, o.base);
  ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  const g = ctx.createLinearGradient(x0, y0 + (y1 - y0) * 0.45, x0, y1);
  const d = darker(rgb, 0.45);
  g.addColorStop(0, `rgba(${d},0)`);
  g.addColorStop(1, `rgba(${d},${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}

/** Ausgehobener Bauch: ein heller, weicher Fleck im Körper, als wäre Farbe mit dem Schwamm abgenommen */
export function belly(ctx: Ctx, o: Base, S: number, paper: string, r: Rand): void {
  const b = o.b,
    rx = Math.min(b.rx, 0.2) * S * rr(r, 0.45, 0.6),
    ry = Math.min(b.ry, 0.2) * S * rr(r, 0.4, 0.55),
    x = (b.x + gauss(r) * b.rx * 0.08) * S,
    y = (b.y + Math.min(b.ry, 0.2) * rr(r, 0.15, 0.4)) * S;
  ctx.save();
  poly(ctx, o.base);
  ctx.clip();
  ctx.globalCompositeOperation = 'source-over';
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${paper},.42)`);
  g.addColorStop(0.6, `rgba(${paper},.24)`);
  g.addColorStop(1, `rgba(${paper},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, 7);
  ctx.fill();
  ctx.restore();
}

/** Hof: ein dünner, nasser Schleier in der zweiten Farbe rund um die Figur (Legendary) */
export function aura(ctx: Ctx, box: Box, rgb: RGBn, S: number, r: Rand, lite: boolean): void {
  const b = { x: (box[0] + box[2]) / 2 / S, y: (box[1] + box[3]) / 2 / S, rx: ((box[2] - box[0]) / 2 / S) * 1.08 + 0.02, ry: ((box[3] - box[1]) / 2 / S) * 1.08 + 0.02, rot: 0 };
  const base = deformN(ellipsePts(b, S, r, 12), r, 0.3, 3);
  ctx.globalCompositeOperation = 'multiply';
  washP(ctx, base, { a: rgb }, box, 0, r, r, 8, 0.009, 0.45, lite);
}

/** Goldstaub: kleine Blattgold-Flocken auf und um die Figur (Legendary) */
export function goldDust(ctx: Ctx, polys: P3[][], S: number, r: Rand): void {
  const [x0, y0, x1, y1] = boxOf(polys);
  const u = S / 300;
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0, n = ri(r, 34, 56); i < n; i++) {
    const x = rr(r, x0 - (x1 - x0) * 0.08, x1 + (x1 - x0) * 0.08),
      y = rr(r, y0 - (y1 - y0) * 0.08, y1 + (y1 - y0) * 0.08),
      s = r() < 0.15 ? u * rr(r, 1.8, 3) : u * rr(r, 0.6, 1.5);
    ctx.fillStyle = r() < 0.35 ? `rgba(246,222,140,${rr(r, 0.7, 0.95)})` : `rgba(201,150,30,${rr(r, 0.6, 0.9)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * rr(r, 0.5, 1), r() * 3, 0, 7);
    ctx.fill();
  }
}
