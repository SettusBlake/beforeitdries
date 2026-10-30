/*
 * Aquarell-Renderer, wörtlich aus dem Prototyp übernommen (Canvas 2D, keine Libraries).
 * Gleicher Seed = gleiches Bild. Parameter und Reihenfolge der Zufallsaufrufe nicht ändern.
 * Einzige Erweiterung: quality "lite" für schwache Geräte. Sie verbraucht den Zufall genauso,
 * malt aber nur jede zweite Lasurschicht mit ausgeglichener Deckkraft.
 */
import { BP, PAPER, PIG, type BlobShape, type Geometry, type Limb, type Paper, type RGB } from '../../shared/data';
import type { Monster } from '../../shared/monster';
import { RNG, clamp, gauss, ri, rr, type Rand } from '../../shared/rng';

export type Quality = 'full' | 'lite';
export interface RenderOptions {
  /** Pixel pro CSS-Pixel, Standard: devicePixelRatio, begrenzt auf 1 bis 2 */
  dpr?: number;
  quality?: Quality;
  /** false: ohne Papier, der Klecks steht frei (Duell). Der Papierwurf hat einen eigenen Zufall, der Klecks bleibt gleich */
  paper?: boolean;
}

/** Was der Renderer vom Monster braucht */
export type Paintable = Pick<Monster, 'seed' | 'humidity' | 'bp' | 'paper' | 'main' | 'sec' | 'events' | 'face' | 'glazes' | 'mud' | 'mutations'>;

export type P3 = [number, number, number];
export type P2 = [number, number] | P3;
type Ctx = CanvasRenderingContext2D;

const INK = '28,25,36';
let LITE = false;

let GRAIN: HTMLCanvasElement | null = null;
export function grainTex(): HTMLCanvasElement {
  if (GRAIN) return GRAIN;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!,
    r = RNG(424242);
  for (let i = 0; i < 520; i++) {
    x.fillStyle = `rgba(70,58,44,${rr(r, 0.012, 0.03)})`;
    x.beginPath();
    x.arc(r() * 256, r() * 256, rr(r, 2, 7), 0, 7);
    x.fill();
  }
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = r() < 0.7 ? `rgba(48,40,32,${rr(r, 0.03, 0.09)})` : `rgba(255,255,255,${rr(r, 0.1, 0.3)})`;
    const s = rr(r, 0.6, 1.8);
    x.fillRect(r() * 256, r() * 256, s, s);
  }
  return (GRAIN = c);
}

export function ellipsePts(b: BlobShape, S: number, r: Rand, n: number): P3[] {
  const pts: P3[] = [],
    c = Math.cos(b.rot || 0),
    s = Math.sin(b.rot || 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      x = Math.cos(a) * b.rx,
      y = Math.sin(a) * b.ry;
    pts.push([(b.x + x * c - y * s) * S, (b.y + x * s + y * c) * S, rr(r, 0.55, 1.45)]);
  }
  return pts;
}

/** Umriss eines Kleckses: Ellipse wie im Prototyp, oder ein Vieleck der neuen Formen (Ecken bleiben, lange Kanten werden geteilt) */
export function blobPts(b: BlobShape, S: number, r: Rand, n: number): P3[] {
  if (!b.pts) return ellipsePts(b, S, r, n);
  const q: [number, number][] = b.pts.map((p) => [p[0], p[1]]);
  while (q.length < n) {
    let k = 0,
      best = -1;
    for (let i = 0; i < q.length; i++) {
      const a = q[i]!,
        c = q[(i + 1) % q.length]!,
        d = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (d > best) {
        best = d;
        k = i;
      }
    }
    const a = q[k]!,
      c = q[(k + 1) % q.length]!;
    q.splice(k + 1, 0, [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]);
  }
  return q.map((p) => [p[0] * S, p[1] * S, rr(r, 0.55, 1.45)]);
}

export function deform(pts: P3[], r: Rand, amt: number): P3[] {
  const out: P3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!,
      b = pts[(i + 1) % pts.length]!,
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      v = (a[2] + b[2]) / 2;
    out.push(a);
    out.push([(a[0] + b[0]) / 2 + gauss(r) * len * amt * v, (a[1] + b[1]) / 2 + gauss(r) * len * amt * v, v * rr(r, 0.75, 1.15)]);
  }
  return out;
}

export function deformN(pts: P3[], r: Rand, amt: number, n: number): P3[] {
  for (let i = 0; i < n; i++) pts = deform(pts, r, amt);
  return pts;
}

export function poly(ctx: Ctx, pts: P2[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.closePath();
}

export function circlePts(x: number, y: number, rx: number, ry: number, n: number): [number, number][] {
  const p: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    p.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
  }
  return p;
}

export function smooth(ctx: Ctx, pts: P2[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  if (pts.length < 3) {
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
    return;
  }
  for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i]![0], pts[i]![1], (pts[i]![0] + pts[i + 1]![0]) / 2, (pts[i]![1] + pts[i + 1]![1]) / 2);
  const l = pts[pts.length - 1]!;
  ctx.lineTo(l[0], l[1]);
}

export function inkPath(ctx: Ctx, pts: P2[], lw: number, r: Rand, alpha = 0.85, closed = false, straight = false): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    const j = pass ? lw * 0.7 : lw * 0.18;
    let q: P2[] = pts.map((p) => [p[0] + gauss(r) * j, p[1] + gauss(r) * j]);
    if (closed) q = [...q, q[0]!, q[1]!];
    ctx.strokeStyle = `rgba(${INK},${pass ? alpha * 0.3 : alpha})`;
    ctx.lineWidth = pass ? lw * 0.6 : lw;
    if (straight) {
      ctx.beginPath();
      q.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    } else smooth(ctx, q);
    ctx.stroke();
  }
}

const dark = (c: RGB, f = 0.55): number[] => c.map((v) => Math.round(v * f));

/** Deckkraft einer Schicht, die zwei Schichten ersetzt */
const twice = (a: number): number => 1 - (1 - a) * (1 - a);

function wash(ctx: Ctx, base: P3[], rgb: RGB | number[], r: Rand, layers: number, alpha: number, amt: number): void {
  if (LITE) {
    ctx.fillStyle = `rgba(${rgb},${twice(alpha)})`;
    for (let i = 0; i < layers; i++) {
      const p = deformN(base, r, amt, 2);
      if (i % 2 === 0) {
        poly(ctx, p);
        ctx.fill();
      }
    }
    return;
  }
  ctx.fillStyle = `rgba(${rgb},${alpha})`;
  for (let i = 0; i < layers; i++) {
    poly(ctx, deformN(base, r, amt, 2));
    ctx.fill();
  }
}

function edges(ctx: Ctx, base: P3[], rgb: RGB, r: Rand, S: number): void {
  ctx.lineWidth = Math.max(1, S / 420);
  ctx.strokeStyle = `rgba(${dark(rgb)},.11)`;
  for (let k = 0; k < 3; k++) {
    poly(ctx, deformN(base, r, 0.25, 1));
    ctx.stroke();
  }
}

function limbWash(ctx: Ctx, l: Limb, rgb: RGB, r: Rand, S: number, alpha = 0.085): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let k = 0; k < 7; k++) {
    ctx.strokeStyle = `rgba(${rgb},${LITE ? twice(alpha) : alpha})`;
    ctx.lineWidth = l.w * S * rr(r, 0.8, 1.35);
    const pts: P2[] = l.pts.map((p) => [p[0] * S + gauss(r) * S * 0.003, p[1] * S + gauss(r) * S * 0.003]);
    if (LITE && k % 2 === 1) continue;
    smooth(ctx, pts);
    ctx.stroke();
  }
}

function granulate(ctx: Ctx, polys: P3[][], rgb: RGB, r: Rand, amt: number, S: number): void {
  let x0 = S,
    y0 = S,
    x1 = 0,
    y1 = 0;
  ctx.save();
  ctx.beginPath();
  polys.forEach((p) => {
    ctx.moveTo(p[0]![0], p[0]![1]);
    p.forEach((q) => {
      ctx.lineTo(q[0], q[1]);
      x0 = Math.min(x0, q[0]);
      y0 = Math.min(y0, q[1]);
      x1 = Math.max(x1, q[0]);
      y1 = Math.max(y1, q[1]);
    });
    ctx.closePath();
  });
  ctx.clip();
  const n = Math.round(((amt * (x1 - x0) * (y1 - y0)) / (S * S)) * 5200),
    u = S / 600;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(${dark(rgb, 0.5)},${rr(r, 0.12, 0.32)})`;
    ctx.beginPath();
    ctx.arc(rr(r, x0, x1), rr(r, y0, y1), rr(r, 0.5, 1.5) * u, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

function drawPaper(ctx: Ctx, S: number, pa: Paper, r: Rand): void {
  const m = S * 0.025;
  let pts: P2[] = [
    [m, m, 1],
    [S - m, m, 1],
    [S - m, S - m, 1],
    [m, S - m, 1],
  ];
  pts = pa.deckle ? deformN(pts as P3[], r, 0.0065, 7) : pts.map((p) => [p[0], p[1]]);
  ctx.save();
  ctx.shadowColor = 'rgba(30,25,20,.2)';
  ctx.shadowBlur = S * 0.02;
  ctx.shadowOffsetY = S * 0.006;
  ctx.fillStyle = `rgb(${pa.tone})`;
  poly(ctx, pts);
  ctx.fill();
  ctx.restore();
  poly(ctx, pts);
  ctx.clip();
  const pat = ctx.createPattern(grainTex(), 'repeat')!;
  try {
    pat.setTransform(new DOMMatrix().scale(S / 520));
  } catch {
    /* ältere Browser ohne setTransform */
  }
  ctx.globalAlpha = pa.grain * 0.9;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, S, S);
  ctx.globalAlpha = 1;
  if (pa.fibers) {
    ctx.lineWidth = S / 700;
    for (let i = 0; i < 40; i++) {
      const x = r() * S,
        y = r() * S,
        a = r() * 6.28,
        l = rr(r, 0.015, 0.04) * S;
      ctx.strokeStyle = `rgba(90,70,50,${rr(r, 0.05, 0.12)})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.6, y + Math.sin(a + 1) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  }
  // Seltene Papiere (Legendary): eigener Zufall, damit die Reihenfolge der übrigen Würfe gleich bleibt
  if (pa.id === 'washi' || pa.id === 'vellum') rarePaper(ctx, S, pa.id, RNG(Math.floor(r() * 1e9)));
}
/** Washi: lange, helle Maulbeerfasern. Vellum: glatte Haut mit Blattgold-Flocken. */
function rarePaper(ctx: Ctx, S: number, id: 'washi' | 'vellum', r: Rand): void {
  ctx.save();
  if (id === 'washi') {
    for (let i = 0; i < 70; i++) {
      const x = r() * S,
        y = r() * S,
        a = r() * 6.28,
        l = rr(r, 0.06, 0.18) * S;
      ctx.lineWidth = rr(r, 0.6, 1.6) * (S / 700);
      ctx.strokeStyle = `rgba(${r() < 0.5 ? '255,255,255' : '150,120,90'},${rr(r, 0.12, 0.3)})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + Math.cos(a + 0.6) * l * 0.4, y + Math.sin(a + 0.6) * l * 0.4, x + Math.cos(a - 0.5) * l * 0.7, y + Math.sin(a - 0.5) * l * 0.7, x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 16; i++) {
      const x = r() * S,
        y = r() * S,
        s = rr(r, 0.008, 0.026) * S;
      const g = ctx.createLinearGradient(x - s, y - s, x + s, y + s);
      g.addColorStop(0, 'rgba(240,205,110,.85)');
      g.addColorStop(0.5, 'rgba(201,150,30,.8)');
      g.addColorStop(1, 'rgba(250,228,160,.85)');
      ctx.fillStyle = g;
      ctx.beginPath();
      const n = 5 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 6.28,
          d = s * rr(r, 0.45, 1);
        if (k) ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
        else ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function insidePt(b: BlobShape, S: number, r: Rand, spread = 0.35): [number, number] {
  return [(b.x + gauss(r) * b.rx * spread) * S, (b.y + gauss(r) * b.ry * spread) * S];
}

function bloomFx(ctx: Ctx, b: BlobShape, S: number, rgb: RGB, paper: string, r: Rand): void {
  const [x, y] = insidePt(b, S, r, 0.25),
    rad = Math.min(b.rx, b.ry) * S * rr(r, 0.45, 0.7);
  const ring = deformN(
    circlePts(x, y, rad, rad * rr(r, 0.8, 1.1), 10).map((p): P3 => [...p, rr(r, 0.7, 1.4)]),
    r,
    0.55,
    4,
  );
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(${paper},.5)`;
  poly(ctx, ring);
  ctx.fill();
  ctx.globalCompositeOperation = 'multiply';
  ctx.lineWidth = S / 280;
  ctx.strokeStyle = `rgba(${dark(rgb, 0.6)},.3)`;
  for (let k = 0; k < 2; k++) {
    poly(ctx, deform(ring, r, 0.2));
    ctx.stroke();
  }
}

function saltFx(ctx: Ctx, b: BlobShape, S: number, paper: string, r: Rand): void {
  const [cx, cy] = insidePt(b, S, r, 0.3),
    n = ri(r, 35, 65),
    u = S / 600;
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < n; i++) {
    const x = cx + gauss(r) * b.rx * S * 0.28,
      y = cy + gauss(r) * b.ry * S * 0.28,
      s = rr(r, 1.4, 3.6) * u,
      k = ri(r, 4, 6);
    ctx.fillStyle = `rgba(${paper},${rr(r, 0.45, 0.8)})`;
    ctx.beginPath();
    for (let j = 0; j < k * 2; j++) {
      const a = (j * Math.PI) / k + r() * 0.3,
        d = j % 2 ? s * 0.35 : s * rr(r, 0.8, 1.3);
      if (j) ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      else ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function alcoholFx(ctx: Ctx, b: BlobShape, S: number, rgb: RGB, paper: string, r: Rand): void {
  const n = ri(r, 3, 6);
  for (let i = 0; i < n; i++) {
    const [x, y] = insidePt(b, S, r, 0.45),
      rad = rr(r, 0.012, 0.028) * S;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(${paper},.62)`;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 7);
    ctx.fill();
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = `rgba(${dark(rgb, 0.6)},.25)`;
    ctx.lineWidth = S / 420;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 7);
    ctx.stroke();
  }
}

function printFx(ctx: Ctx, b: BlobShape, S: number, r: Rand): void {
  const cx = (b.x + b.rx * 0.45) * S,
    cy = (b.y + b.ry * 0.35) * S,
    rot = rr(r, 0, 3);
  ctx.globalCompositeOperation = 'multiply';
  ctx.lineWidth = S / 520;
  ctx.strokeStyle = `rgba(${INK},.17)`;
  for (let i = 1; i <= 11; i++) {
    let a0 = rr(r, 0, 6.28),
      tot = 0;
    const rx = S * 0.0062 * i * 1.15,
      ry = S * 0.0062 * i * 1.5;
    while (tot < 5.5) {
      const seg = rr(r, 0.6, 2.2);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rot, a0, a0 + seg);
      ctx.stroke();
      a0 += seg + rr(r, 0.1, 0.35);
      tot += seg;
    }
  }
}

function contour(ctx: Ctx, base: P3[], lw: number, r: Rand): void {
  const n = base.length;
  let i = ri(r, 0, n - 1),
    done = 0;
  while (done < n) {
    const len = ri(r, 8, 24),
      gap = ri(r, 4, 14),
      seg: P3[] = [];
    for (let k = 0; k <= len; k++) seg.push(base[(i + k) % n]!);
    inkPath(ctx, seg, lw, r, 0.62);
    i += len + gap;
    done += len + gap;
  }
}

function spikes(ctx: Ctx, b: BlobShape, S: number, lw: number, r: Rand): void {
  const n = ri(r, 4, 7),
    c = Math.cos(b.rot || 0),
    s = Math.sin(b.rot || 0),
    R = Math.min(b.rx, b.ry) * S;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI * (0.2 + (0.6 * k) / (n - 1)),
      ex = Math.cos(a) * b.rx,
      ey = Math.sin(a) * b.ry;
    const px = (b.x + ex * c - ey * s) * S,
      py = (b.y + ex * s + ey * c) * S;
    let nx = Math.cos(a) / b.rx,
      ny = Math.sin(a) / b.ry;
    const nl = Math.hypot(nx, ny);
    nx /= nl;
    ny /= nl;
    const L = R * rr(r, 0.22, 0.36),
      W = R * 0.12;
    const tri: P2[] = [
      [px - ny * W, py + nx * W],
      [px + nx * L, py + ny * L],
      [px + ny * W, py - nx * W],
    ];
    ctx.fillStyle = `rgba(${INK},.12)`;
    poly(ctx, tri);
    ctx.fill();
    inkPath(ctx, tri, lw * 0.9, r, 0.85, false, true);
  }
}

export function drawFace(ctx: Ctx, m: Paintable, geo: Geometry, S: number, r: Rand, paper: string, core: BlobShape): void {
  const lw = S / 300,
    look = [rr(r, -1, 1), rr(r, -0.7, 0.7)] as const,
    mrgb = PIG[m.main].rgb;
  const eye = (x: number, y: number, rad: number, kind: string): void => {
    const sq = kind === 'schlitz' ? 0.62 : 1;
    ctx.fillStyle = `rgb(${paper})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * sq, 0, 0, 7);
    ctx.fill();
    if (kind === 'zyklop') {
      ctx.fillStyle = `rgba(${mrgb},.55)`;
      ctx.beginPath();
      ctx.arc(x + look[0] * rad * 0.2, y + look[1] * rad * 0.2, rad * 0.62, 0, 7);
      ctx.fill();
    }
    inkPath(ctx, circlePts(x, y, rad, rad * sq, 22), lw, r, 0.9, true);
    const px = x + look[0] * rad * 0.32,
      py = y + look[1] * rad * 0.3 * sq;
    ctx.fillStyle = `rgba(${INK},.92)`;
    ctx.beginPath();
    if (kind === 'schlitz') ctx.ellipse(px, py, rad * 0.12, rad * 0.5, 0, 0, 7);
    else ctx.arc(px, py, rad * (kind === 'zyklop' ? 0.3 : 0.44), 0, 7);
    ctx.fill();
    ctx.fillStyle = `rgb(${paper})`;
    ctx.beginPath();
    ctx.arc(px - rad * 0.12, py - rad * 0.14, rad * 0.1, 0, 7);
    ctx.fill();
    if (kind === 'muede') {
      ctx.fillStyle = `rgba(${mrgb},.8)`;
      ctx.beginPath();
      ctx.ellipse(x, y, rad * 1.04, rad * 1.04, 0, Math.PI, 2 * Math.PI);
      ctx.fill();
      inkPath(
        ctx,
        [
          [x - rad * 1.05, y],
          [x, y + rad * 0.1],
          [x + rad * 1.05, y],
        ],
        lw,
        r,
        0.9,
      );
    }
  };
  ctx.globalCompositeOperation = 'source-over';
  geo.faces.forEach((f, fi) => {
    const X = f.x * S,
      Y = f.y * S,
      R = f.r * S,
      type = f.cyclops ? 'zyklop' : m.face.eye,
      ey = Y - R * 0.12;
    if (f.stalks) {
      const sy = Y - R * 1.7,
        k = ['punkt', 'viele', 'zyklop'].includes(type) ? 'rund' : type;
      [-1, 1].forEach((s) => {
        inkPath(
          ctx,
          [
            [X + s * R * 0.3, Y - R * 0.3],
            [X + s * R * 0.42, sy + R * 0.5],
            [X + s * R * 0.5, sy + R * 0.25],
          ],
          lw,
          r,
        );
        eye(X + s * R * 0.5, sy, R * 0.3, k);
      });
    } else if (type === 'punkt') {
      [-1, 1].forEach((s) => {
        ctx.fillStyle = `rgba(${INK},.92)`;
        ctx.beginPath();
        ctx.arc(X + s * R * 0.32, ey, R * 0.085, 0, 7);
        ctx.fill();
      });
    } else if (type === 'viele') {
      const n = ri(r, 3, 6);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (0.12 + (0.76 * i) / (n - 1)),
          d = R * rr(r, 0.32, 0.52);
        eye(X + Math.cos(a) * d * 1.1, ey + Math.sin(a) * d * 0.55 + R * 0.12, R * rr(r, 0.1, 0.15), 'rund');
      }
    } else if (type === 'zyklop') eye(X, ey, R * 0.42, 'zyklop');
    else [-1, 1].forEach((s) => eye(X + s * R * 0.36, ey, R * (type === 'schlitz' ? 0.26 : 0.21), type));

    const my = Y + R * 0.42,
      mt = m.face.mouth;
    if (mt === 'laecheln')
      inkPath(
        ctx,
        [
          [X - R * 0.28, my - R * 0.04],
          [X, my + R * 0.12],
          [X + R * 0.28, my - R * 0.04],
        ],
        lw,
        r,
      );
    else if (mt === 'zaehne') {
      const p: P2[] = [];
      for (let i = 0; i <= 7; i++) p.push([X - R * 0.32 + (R * 0.64 * i) / 7, my + (i % 2 ? R * 0.09 : 0)]);
      inkPath(ctx, p, lw, r, 0.85, false, true);
    } else if (mt === 'schnabel') {
      const p: P2[] = [
        [X - R * 0.2, my - R * 0.08],
        [X + R * 0.2, my - R * 0.08],
        [X, my + R * 0.22],
      ];
      ctx.fillStyle = 'rgba(214,150,40,.75)';
      poly(ctx, p);
      ctx.fill();
      inkPath(ctx, [...p, p[0]!], lw, r, 0.9, false, true);
    } else if (mt === 'rohr') inkPath(ctx, circlePts(X, my + R * 0.02, R * 0.09, R * 0.07, 14), lw, r, 0.9, true);
    else if (mt === 'grinsen') {
      const a: P2[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        a.push([X - R * 0.42 + R * 0.84 * t, my - R * 0.06 + Math.sin(t * Math.PI) * R * 0.2]);
      }
      inkPath(ctx, a, lw, r);
      inkPath(
        ctx,
        [
          [X - R * 0.4, my - R * 0.06],
          [X + R * 0.4, my - R * 0.06],
        ],
        lw * 0.8,
        r,
        0.8,
        false,
        true,
      );
      for (let i = 1; i < 4; i++) {
        const x = X - R * 0.42 + (R * 0.84 * i) / 4;
        inkPath(
          ctx,
          [
            [x, my - R * 0.06],
            [x, my - R * 0.06 + Math.sin((i / 4) * Math.PI) * R * 0.2],
          ],
          lw * 0.7,
          r,
          0.8,
          false,
          true,
        );
      }
    }
    if (fi === 0) {
      const ex = m.face.extra;
      if (ex === 'hoerner')
        [-1, 1].forEach((s) => {
          const p: P2[] = [
            [X + s * R * 0.32, Y - R * 0.78],
            [X + s * R * 0.62, Y - R * 0.62],
            [X + s * R * 0.74, Y - R * 1.42],
          ];
          ctx.fillStyle = `rgba(${INK},.14)`;
          poly(ctx, p);
          ctx.fill();
          inkPath(ctx, [p[0]!, [X + s * R * 0.55, Y - R * 1.1], p[2]!, p[1]!], lw, r);
        });
      if (ex === 'fuehler')
        [-1, 1].forEach((s) => {
          const t: [number, number] = [X + s * R * 0.65, Y - R * 1.6];
          inkPath(
            ctx,
            [
              [X + s * R * 0.2, Y - R * 0.85],
              [X + s * R * 0.45, Y - R * 1.3],
              t,
            ],
            lw,
            r,
          );
          ctx.fillStyle = `rgba(${INK},.9)`;
          ctx.beginPath();
          ctx.arc(t[0], t[1], R * 0.07, 0, 7);
          ctx.fill();
        });
      if (ex === 'sommersprossen')
        [-1, 1].forEach((s) => {
          for (let i = 0; i < 4; i++) {
            ctx.fillStyle = `rgba(${INK},.55)`;
            ctx.beginPath();
            ctx.arc(X + s * R * (0.5 + rr(r, -0.1, 0.1)), Y + R * (0.15 + rr(r, -0.08, 0.08)), R * 0.025, 0, 7);
            ctx.fill();
          }
        });
    }
  });
  if (m.face.extra === 'stacheln') spikes(ctx, core, S, lw, r);
}

export function defaultDpr(): number {
  return clamp(window.devicePixelRatio || 1, 1, 2);
}

/** Malt das Monster neu. Gibt die Malzeit in Millisekunden zurück. */
export function renderMonster(canvas: HTMLCanvasElement, m: Paintable, cssSize: number, opts: RenderOptions = {}): number {
  const t0 = performance.now();
  LITE = opts.quality === 'lite';
  const dpr = opts.dpr ?? defaultDpr(),
    S = Math.max(200, Math.round(cssSize * dpr));
  if (canvas.width !== S || canvas.height !== S) {
    canvas.width = S;
    canvas.height = S;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, S, S);
  const pa = PAPER[m.paper],
    paper = pa.tone.join(','),
    main = PIG[m.main];
  const r = RNG(m.seed ^ 0x9e3779b9);
  ctx.save();
  if (opts.paper !== false) drawPaper(ctx, S, pa, r);
  const geo = BP[m.bp].build(RNG(m.seed + 7919 * m.mutations + 13));
  const vf = 0.65 + clamp((m.humidity - 30) / 65, 0, 1) * 0.75;
  const gr = RNG(m.seed + 31 * m.mutations + 5);
  // crisp gibt es nur bei den neuen Formen, ohne bleibt jede Zahl wie im Prototyp
  const bases = geo.blobs.map((b) => ({ b, base: deformN(blobPts(b, S, gr, 12), gr, 0.3 * vf * (b.crisp ?? 1), 3) }));
  let core = bases[0]!;
  bases.forEach((o) => {
    if (o.b.rx * o.b.ry > core.b.rx * core.b.ry) core = o;
  });

  ctx.globalCompositeOperation = 'multiply';
  geo.limbs.forEach((l) => limbWash(ctx, l, main.rgb, gr, S));
  // few: kleine Teile der neuen Formen, 12 Schichten mit gleicher Gesamtdeckung wie 22
  bases.forEach((o) => wash(ctx, o.base, main.rgb, gr, o.b.leaf ? 14 : o.b.few ? 12 : 22, o.b.few ? (o.b.wing ? 0.072 : 0.09) : o.b.wing ? 0.04 : 0.05, 0.3 * vf * (o.b.crisp ?? 1)));
  m.sec.forEach((id, i) => {
    const p = PIG[id];
    let list = bases.filter((o) => (i === 0 ? o !== core : o === core));
    if (!list.length) list = [core];
    list.forEach((o) => {
      const b = o.b,
        sub = { x: b.x + gauss(gr) * b.rx * 0.2, y: b.y + gauss(gr) * b.ry * 0.2 + (i ? b.ry * 0.3 : 0), rx: b.rx * rr(gr, 0.45, 0.8), ry: b.ry * rr(gr, 0.45, 0.8), rot: b.rot };
      wash(ctx, deformN(ellipsePts(sub, S, gr, 10), gr, 0.45 * vf, 3), p.rgb, gr, 16, 0.045, 0.45 * vf);
    });
  });
  m.glazes.forEach((g) => {
    const p = PIG[g.p],
      r2 = RNG(g.seed);
    bases.forEach((o) => wash(ctx, o.base, p.rgb, r2, 10, 0.032, 0.18 * (o.b.crisp ?? 1)));
    geo.limbs.forEach((l) => limbWash(ctx, l, p.rgb, r2, S, 0.045));
  });
  if (m.mud) {
    const r3 = RNG(m.seed + 99);
    bases.forEach((o) => wash(ctx, o.base, [116, 100, 82], r3, 16, 0.055, 0.25 * (o.b.crisp ?? 1)));
  }
  bases.forEach((o) => edges(ctx, o.base, main.rgb, gr, S));
  const granAmt = Math.max(main.gran, ...m.sec.map((id) => PIG[id].gran * 0.6), ...m.glazes.map((g) => PIG[g.p].gran * 0.5), m.mud ? 0.8 : 0);
  if (granAmt > 0.15) granulate(ctx, bases.map((o) => o.base), m.mud ? [116, 100, 82] : main.rgb, gr, granAmt, S);

  const er = RNG(m.seed + 4242);
  if (m.events.bloom) bloomFx(ctx, core.b, S, main.rgb, paper, er);
  if (m.events.salt) saltFx(ctx, core.b, S, paper, er);
  if (m.events.alcohol) alcoholFx(ctx, core.b, S, main.rgb, paper, er);

  ctx.globalCompositeOperation = 'source-over';
  const lw = S / 300,
    ir = RNG(m.seed + 777);
  const big = core.b.rx * core.b.ry;
  bases.forEach((o) => {
    if ((o.b.rx * o.b.ry >= big * 0.3 || o.b.ink) && !o.b.leaf) contour(ctx, o.base, lw * 0.9, ir);
  });
  geo.limbs.forEach((l) => inkPath(ctx, l.pts.map((p) => [p[0] * S, p[1] * S]), lw * 0.85, ir, 0.7));
  drawFace(ctx, m, geo, S, RNG(m.seed + 31337), paper, core.b);
  if (m.events.print) printFx(ctx, core.b, S, RNG(m.seed + 5));
  ctx.restore();
  LITE = false;
  return performance.now() - t0;
}
