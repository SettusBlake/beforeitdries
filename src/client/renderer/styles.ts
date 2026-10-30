/*
 * Seltene Stile (Shiny): Pencil, Comic, Bestiary Plate, Anime, Oil. Aus dem Entwurf (docs/entwuerfe/stile-selten-entwurf.png),
 * jetzt mit den Formen des Aquarell-Renderers (auch Vielecke, Linien und gemalte Monster) und den Gesichtern aus 2b.
 * Alles prozedural aus Code, keine Bilder. Licht kommt immer von oben links.
 */
import { PIG, type BlobShape, type Limb, type PigmentId } from '../../shared/data';
import type { StyleId } from '../../shared/dice';
import { lookOf, tinted, type EyeShape, type Mouth } from '../../shared/look';
import type { Monster } from '../../shared/monster';
import { RNG, clamp, gauss, ri, rr, type Rand } from '../../shared/rng';
import { MANY, drawFace2 } from './gen2b';
import { blobPts, deformN, drawFace, geometryOf, grainTex, type P2, type P3 } from './watercolor';

type Ctx = CanvasRenderingContext2D;
type C3 = number[];

/* ---------- Grundlagen: Farbe als Text, Geometrie wie beim Aquarell ---------- */
const mixRGB = (a: readonly number[], b: readonly number[], t: number): number[] => a.map((v, i) => Math.round(v + ((b[i] ?? 0) - v) * t));
const rgb = (c: readonly number[], a = 1): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
/** Formen wie im Aquarell (Bauplan, neue Formen oder Zeichnung), Ränder nur leicht verformt */
function prep(m: Monster, S: number, amt = 0.3, iters = 3) {
  const geo = geometryOf(m);
  const gr = RNG(m.seed + 31 * m.mutations + 5);
  const bases = geo.blobs.map((b) => ({ b, base: deformN(blobPts(b, S, gr, 12), gr, amt * (b.crisp ?? 1), iters) }));
  let core = bases[0]!;
  bases.forEach((o) => {
    if (o.b.rx * o.b.ry > core.b.rx * core.b.ry) core = o;
  });
  return { geo, gr, bases, core };
}
type Prep = ReturnType<typeof prep>;
type Base = Prep['bases'][number];
function smoothClosed(ctx: Ctx, pts: P2[]): void {
  const n = pts.length;
  ctx.beginPath();
  const mid = (i: number): [number, number] => [(pts[i % n]![0] + pts[(i + 1) % n]![0]) / 2, (pts[i % n]![1] + pts[(i + 1) % n]![1]) / 2];
  const m0 = mid(0);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n]!,
      q = mid(i);
    ctx.quadraticCurveTo(p[0], p[1], q[0], q[1]);
  }
  ctx.closePath();
}
function bbox(polys: P2[][]): [number, number, number, number] {
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const p of polys)
    for (const q of p) {
      x0 = Math.min(x0, q[0]);
      y0 = Math.min(y0, q[1]);
      x1 = Math.max(x1, q[0]);
      y1 = Math.max(y1, q[1]);
    }
  return [x0, y0, x1, y1];
}
/** Rahmen, Texte und Schild nur im großen Bild (Würfelkarte, Ziehen), klein nur das Monster im Stil */
let DECO = true;

/** Gesicht: Generation 2 mit den Gesichtern aus 2b (gemalte Monster immer mit Gesicht), sonst wie im Prototyp */
function faceOf(ctx: Ctx, m: Monster, geo: Prep['geo'], S: number, paper: string, core: BlobShape, col?: readonly number[]): void {
  if (m.gen !== 2) return drawFace(ctx, m, geo, S, RNG(m.seed + 31337), paper, core);
  const look = lookOf(m);
  if (look.faceless && !m.draw) return;
  drawFace2(ctx, { ...look, faceless: false }, geo, S, RNG(look.seed + 31337), paper, col ?? tinted(PIG[m.main].rgb, look.main));
}

/* ---------- Farbe ---------- */
function toHsl(c: readonly number[]): [number, number, number] {
  const r = c[0]! / 255,
    g = c[1]! / 255,
    b = c[2]! / 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn,
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function fromHsl(h: number, s: number, l: number): C3 {
  const f = (n: number) => {
    const k = (n + h * 12) % 12,
      a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}
const shade = (c: readonly number[], f: number): C3 => c.map((v) => Math.round(clamp(v * f, 0, 255)));

/* ---------- Leinwand-Helfer ---------- */
function layer(S: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  return [c, c.getContext('2d')!];
}
const limbPx = (l: Limb, S: number): P2[] => l.pts.map((p) => [p[0] * S, p[1] * S]);
function limbPath(ctx: Ctx, pts: P2[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i]![0], pts[i]![1], (pts[i]![0] + pts[i + 1]![0]) / 2, (pts[i]![1] + pts[i + 1]![1]) / 2);
  const l = pts[pts.length - 1]!;
  ctx.lineTo(l[0], l[1]);
}
function strokeLimb(ctx: Ctx, l: Limb, S: number, w: number, dx = 0, dy = 0): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = w;
  limbPath(
    ctx,
    limbPx(l, S).map((p) => [p[0] + dx, p[1] + dy]),
  );
  ctx.stroke();
}
/** Wie smoothClosed, aber hängt an den laufenden Pfad an (für Löcher mit evenodd) */
function addSmooth(ctx: Ctx, pts: P2[], dx = 0, dy = 0): void {
  const n = pts.length;
  const mid = (i: number): [number, number] => [(pts[i % n]![0] + pts[(i + 1) % n]![0]) / 2 + dx, (pts[i % n]![1] + pts[(i + 1) % n]![1]) / 2 + dy];
  const m0 = mid(0);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n]!,
      m = mid(i);
    ctx.quadraticCurveTo(p[0] + dx, p[1] + dy, m[0], m[1]);
  }
  ctx.closePath();
}
function blobPath2D(pts: P2[]): Path2D {
  const p = new Path2D(),
    n = pts.length;
  const mid = (i: number): [number, number] => [(pts[i % n]![0] + pts[(i + 1) % n]![0]) / 2, (pts[i % n]![1] + pts[(i + 1) % n]![1]) / 2];
  const m0 = mid(0);
  p.moveTo(m0[0], m0[1]);
  for (let i = 1; i <= n; i++) {
    const q = pts[i % n]!,
      m = mid(i);
    p.quadraticCurveTo(q[0], q[1], m[0], m[1]);
  }
  p.closePath();
  return p;
}
/** Schattenseite eines Kleckses: der Klecks ohne seine nach oben links verschobene Kopie. k = Breite des Schattens */
function clipShadow(ctx: Ctx, o: Base, S: number, k: number): void {
  smoothClosed(ctx, o.base);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(-S, -S, S * 3, S * 3);
  addSmooth(ctx, o.base, -o.b.rx * S * k, -o.b.ry * S * k * 1.15);
  ctx.clip('evenodd');
}
/** Silhouette (Kleckse, Glieder, Zusatzformen) in einer Farbe */
function silhouette(S: number, p: Prep, col: string, extra: Extras | null, limbScale = 1): HTMLCanvasElement {
  const [c, x] = layer(S);
  x.fillStyle = x.strokeStyle = col;
  for (const l of p.geo.limbs) strokeLimb(x, l, S, l.w * S * limbScale);
  for (const o of p.bases) {
    smoothClosed(x, o.base);
    x.fill();
  }
  if (extra) {
    for (const t of extra.tris) {
      x.beginPath();
      t.forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])));
      x.closePath();
      x.fill();
    }
    for (const a of extra.antennae) {
      x.lineWidth = a.w;
      x.lineCap = 'round';
      limbPath(x, a.path);
      x.stroke();
      x.beginPath();
      x.arc(a.tip[0], a.tip[1], a.r, 0, 7);
      x.fill();
    }
  }
  return c;
}
/** Umriss um die ganze Silhouette: die Maske ringsum versetzt stempeln */
function ring(ctx: Ctx, mask: HTMLCanvasElement, w: number): void {
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    ctx.drawImage(mask, Math.cos(a) * w, Math.sin(a) * w);
  }
}
function paperFill(ctx: Ctx, S: number, tone: readonly number[], grain: number): void {
  ctx.fillStyle = rgb(tone);
  ctx.fillRect(0, 0, S, S);
  const pat = ctx.createPattern(grainTex(), 'repeat')!;
  try {
    pat.setTransform(new DOMMatrix().scale(S / 520));
  } catch {
    /* egal */
  }
  ctx.globalAlpha = grain;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, S, S);
  ctx.globalAlpha = 1;
}
/** Blattmitte der Figur, damit Hintergründe um sie herum gebaut werden */
function centerOf(p: Prep): { cx: number; cy: number; x0: number; y0: number; x1: number; y1: number } {
  const [x0, y0, x1, y1] = bbox(p.bases.map((o) => o.base));
  let ly1 = y1;
  for (const l of p.geo.limbs) for (const q of l.pts) ly1 = Math.max(ly1, q[1]);
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, x0, y0, x1, y1: ly1 };
}
function feetY(p: Prep, S: number): number {
  let y = 0;
  for (const o of p.bases) for (const q of o.base) y = Math.max(y, q[1]);
  for (const l of p.geo.limbs) for (const q of l.pts) y = Math.max(y, q[1] * S);
  return y;
}

/* ---------- Gesicht und Zusatzformen als Lage (gleiche Stellen wie drawFace) ---------- */
type Eye = { x: number; y: number; r: number; kind: string };
type FaceL = { X: number; Y: number; R: number; eyes: Eye[]; stalks: P2[][]; mouth: { x: number; y: number; w: number; kind: string }; first: boolean };
/** 2b-Augen und -Münder in die Arten, die die Stile kennen */
const EYE_KIND: Record<EyeShape, string> = { round: 'rund', button: 'punkt', almond: 'rund', slit: 'schlitz', sleepy: 'muede', shiny: 'rund', closed: 'muede', dash: 'schlitz' };
const MOUTH_KIND: Record<Mouth, string> = { smile: 'laecheln', grin: 'grinsen', teeth: 'zaehne', tongue: 'laecheln', tusks: 'zaehne', fangs: 'zaehne', o: 'rohr', zigzag: 'zaehne', beak: 'schnabel', none: 'keiner' };
function faceLayout(m: Monster, p: Prep, S: number): FaceL[] {
  return m.gen === 2 ? faceLayout2(m, p, S) : faceLayout1(m, p, S);
}
/** Generation 2: Augenzahl, Form und Mund aus 2b, Stellen wie bei drawFace2 */
function faceLayout2(m: Monster, p: Prep, S: number): FaceL[] {
  const look = lookOf(m);
  if (look.faceless && !m.draw) return [];
  const e = look.eyes,
    kind = EYE_KIND[e.shape];
  return p.geo.faces.map((f, fi) => {
    const X = f.x * S,
      Y = f.y * S,
      R = f.r * S,
      ey = Y - R * 0.12;
    const eyes: Eye[] = [],
      stalks: P2[][] = [];
    const n = f.cyclops ? 1 : f.stalks ? 2 : e.n;
    if (f.stalks) {
      const sy = Y - R * 1.7;
      for (const s of [-1, 1]) {
        stalks.push([
          [X + s * R * 0.3, Y - R * 0.3],
          [X + s * R * 0.42, sy + R * 0.5],
          [X + s * R * 0.5, sy + R * 0.25],
        ]);
        eyes.push({ x: X + s * R * 0.5, y: sy, r: R * 0.3, kind: kind === 'punkt' ? 'rund' : kind });
      }
    } else if (n === 1) eyes.push({ x: X, y: ey, r: R * 0.42, kind: 'zyklop' });
    else if (n === 2) for (const s of [-1, 1]) eyes.push({ x: X + s * R * (kind === 'punkt' ? 0.32 : 0.36), y: ey, r: R * (kind === 'punkt' ? 0.085 : kind === 'schlitz' ? 0.26 : 0.21) * Math.min(e.size, 1.15), kind });
    else for (const [ox, oy] of MANY[n]!) eyes.push({ x: X + ox * R, y: ey + oy * R, r: R * (n <= 4 ? 0.13 : 0.1), kind: kind === 'punkt' ? 'punkt' : 'rund' });
    return { X, Y, R, eyes, stalks, mouth: { x: X, y: Y + R * 0.42, w: R * 0.3, kind: MOUTH_KIND[look.mouth] }, first: fi === 0 };
  });
}
function faceLayout1(m: Monster, p: Prep, S: number): FaceL[] {
  const r = RNG(m.seed + 2718);
  return p.geo.faces.map((f, fi) => {
    const X = f.x * S,
      Y = f.y * S,
      R = f.r * S,
      type = f.cyclops ? 'zyklop' : m.face.eye,
      ey = Y - R * 0.12;
    const eyes: Eye[] = [],
      stalks: P2[][] = [];
    if (f.stalks) {
      const sy = Y - R * 1.7,
        k = ['punkt', 'viele', 'zyklop'].includes(type) ? 'rund' : type;
      for (const s of [-1, 1]) {
        stalks.push([
          [X + s * R * 0.3, Y - R * 0.3],
          [X + s * R * 0.42, sy + R * 0.5],
          [X + s * R * 0.5, sy + R * 0.25],
        ]);
        eyes.push({ x: X + s * R * 0.5, y: sy, r: R * 0.3, kind: k });
      }
    } else if (type === 'viele') {
      const n = ri(r, 3, 6);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (0.12 + (0.76 * i) / (n - 1)),
          d = R * rr(r, 0.32, 0.52);
        eyes.push({ x: X + Math.cos(a) * d * 1.1, y: ey + Math.sin(a) * d * 0.55 + R * 0.12, r: R * rr(r, 0.1, 0.15), kind: 'rund' });
      }
    } else if (type === 'zyklop') eyes.push({ x: X, y: ey, r: R * 0.42, kind: 'zyklop' });
    else for (const s of [-1, 1]) eyes.push({ x: X + s * R * (type === 'punkt' ? 0.32 : 0.36), y: ey, r: R * (type === 'punkt' ? 0.085 : type === 'schlitz' ? 0.26 : 0.21), kind: type });
    return { X, Y, R, eyes, stalks, mouth: { x: X, y: Y + R * 0.42, w: R * 0.3, kind: m.face.mouth }, first: fi === 0 };
  });
}
type Extras = { tris: P2[][]; antennae: { path: P2[]; tip: P2; r: number; w: number }[]; freckles: P2[]; horns: boolean };
function extrasOf(m: Monster, p: Prep, S: number, faces: FaceL[]): Extras {
  const out: Extras = { tris: [], antennae: [], freckles: [], horns: false };
  // Generation 2 hat keine Extras aus dem Prototyp (Hörner, Fühler und Stacheln bringen die Formen selbst mit)
  if (m.gen === 2) return out;
  const f = faces[0];
  const ex = m.face.extra;
  const r = RNG(m.seed + 1618);
  if (f && ex === 'hoerner') {
    out.horns = true;
    for (const s of [-1, 1])
      out.tris.push([
        [f.X + s * f.R * 0.3, f.Y - f.R * 0.72],
        [f.X + s * f.R * 0.66, f.Y - f.R * 0.55],
        [f.X + s * f.R * 0.74, f.Y - f.R * 1.42],
      ]);
  }
  if (f && ex === 'fuehler')
    for (const s of [-1, 1])
      out.antennae.push({
        path: [
          [f.X + s * f.R * 0.2, f.Y - f.R * 0.8],
          [f.X + s * f.R * 0.45, f.Y - f.R * 1.3],
          [f.X + s * f.R * 0.65, f.Y - f.R * 1.6],
        ],
        tip: [f.X + s * f.R * 0.65, f.Y - f.R * 1.6],
        r: f.R * 0.09,
        w: f.R * 0.06,
      });
  if (f && ex === 'sommersprossen') for (const s of [-1, 1]) for (let i = 0; i < 4; i++) out.freckles.push([f.X + s * f.R * (0.5 + rr(r, -0.1, 0.1)), f.Y + f.R * (0.15 + rr(r, -0.08, 0.08))]);
  if (ex === 'stacheln') {
    const b: BlobShape = p.core.b,
      n = ri(r, 4, 7),
      c = Math.cos(b.rot || 0),
      s = Math.sin(b.rot || 0),
      R = Math.min(b.rx, b.ry) * S;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI * (0.2 + (0.6 * k) / (n - 1)),
        ex2 = Math.cos(a) * b.rx * 0.96,
        ey2 = Math.sin(a) * b.ry * 0.96;
      const px = (b.x + ex2 * c - ey2 * s) * S,
        py = (b.y + ex2 * s + ey2 * c) * S;
      let nx = Math.cos(a) / b.rx,
        ny = Math.sin(a) / b.ry;
      const nl = Math.hypot(nx, ny);
      nx /= nl;
      ny /= nl;
      const L = R * rr(r, 0.24, 0.38),
        W = R * 0.13;
      out.tris.push([
        [px - ny * W, py + nx * W],
        [px + nx * L, py + ny * L],
        [px + ny * W, py - nx * W],
      ]);
    }
  }
  return out;
}
function triPath(ctx: Ctx, t: P2[]): void {
  ctx.beginPath();
  t.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
  ctx.closePath();
}

/* ---------- Kontur mit Druck: dicker auf der Schattenseite ---------- */
function pressureContour(ctx: Ctx, pts: P3[] | P2[], cx: number, cy: number, lw: number, col: (a: number) => string, r: Rand | null, jitter: number, alpha: number, overshoot = 0): void {
  const n = pts.length,
    start = r ? Math.floor(r() * n) : 0,
    len = n + overshoot;
  const q = pts.map((p) => [p[0] + (r ? gauss(r) * jitter : 0), p[1] + (r ? gauss(r) * jitter : 0)] as [number, number]);
  ctx.lineCap = 'round';
  for (let i = 0; i < len; i++) {
    const a = q[(start + i) % n]!,
      b = q[(start + i + 1) % n]!;
    let nx = b[1] - a[1],
      ny = -(b[0] - a[0]);
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const sh = Math.max(0, nx * 0.6 + ny * 0.8);
    // Enden ausdünnen, damit der Strich ansetzt und abhebt
    const fade = overshoot ? Math.min(1, i / 4, (len - i) / 4) : 1;
    ctx.strokeStyle = col(alpha * (0.55 + 0.45 * sh) * fade);
    ctx.lineWidth = lw * (0.6 + 1.2 * sh) * (0.5 + 0.5 * fade);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
}
/** Schraffur: parallele Linien über das ganze Blatt, der Clip begrenzt sie */
function hatch(ctx: Ctx, S: number, ang: number, sp: number, lw: number, col: (a: number) => string, r: Rand, a0: number, a1: number, box?: [number, number, number, number]): void {
  const c = Math.cos(ang),
    s = Math.sin(ang);
  const [x0, y0, x1, y1] = box ?? [0, 0, S, S];
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2,
    rad = Math.hypot(x1 - x0, y1 - y0) / 2 + sp;
  ctx.lineCap = 'round';
  for (let t = -rad; t <= rad; t += sp * rr(r, 0.8, 1.2)) {
    const ox = cx - s * t,
      oy = cy + c * t;
    ctx.strokeStyle = col(rr(r, a0, a1));
    ctx.lineWidth = lw * rr(r, 0.7, 1.3);
    ctx.beginPath();
    ctx.moveTo(ox - c * rad + gauss(r) * sp * 0.15, oy - s * rad + gauss(r) * sp * 0.15);
    ctx.lineTo(ox + c * rad + gauss(r) * sp * 0.15, oy + s * rad + gauss(r) * sp * 0.15);
    ctx.stroke();
  }
}
function blobBox(o: Base, S: number): [number, number, number, number] {
  const R = Math.max(o.b.rx, o.b.ry) * S * 1.4;
  return [o.b.x * S - R, o.b.y * S - R, o.b.x * S + R, o.b.y * S + R];
}

/* =====================================================================
 * Pencil: Graphit auf Skizzenpapier, nur Schwarz und Weiß
 * ===================================================================== */
export function pencil(ctx: Ctx, m: Monster, S: number, note: string): void {
  const tone = [243, 240, 233];
  paperFill(ctx, S, tone, 0.6);
  const p = prep(m, S, 0.2, 3);
  const r = RNG(m.seed + 2024);
  const [lc, l] = layer(S);
  const G = (a: number) => `rgba(44,44,50,${a})`;
  const { cx, x0, x1 } = centerOf(p);
  const fy = feetY(p, S);

  // Bodenschatten, schraffiert
  l.save();
  l.beginPath();
  l.ellipse(cx, fy + S * 0.012, (x1 - x0) * 0.46, S * 0.032, 0, 0, 7);
  l.clip();
  hatch(l, S, -0.25, S * 0.006, S / 900, G, r, 0.18, 0.4, [cx - S * 0.4, fy - S * 0.05, cx + S * 0.4, fy + S * 0.07]);
  l.restore();
  l.strokeStyle = G(0.3);
  l.lineWidth = S / 1000;
  l.beginPath();
  l.moveTo(x0 - S * 0.06, fy + S * 0.02);
  l.lineTo(x1 + S * 0.08, fy + S * 0.018);
  l.stroke();

  // Konstruktion: Ellipsen, Achse, Kreuz im Gesicht
  l.strokeStyle = G(0.14);
  l.lineWidth = S / 1100;
  for (const o of p.bases) {
    l.beginPath();
    l.ellipse(o.b.x * S + gauss(r) * 2, o.b.y * S + gauss(r) * 2, o.b.rx * S * rr(r, 1.02, 1.1), o.b.ry * S * rr(r, 1.02, 1.1), (o.b.rot || 0) + gauss(r) * 0.04, 0, 7);
    l.stroke();
  }
  const faces = faceLayout(m, p, S);
  for (const f of faces) {
    l.beginPath();
    l.moveTo(f.X - f.R * 1.1, f.Y - f.R * 0.12);
    l.quadraticCurveTo(f.X, f.Y - f.R * 0.02, f.X + f.R * 1.1, f.Y - f.R * 0.12);
    l.moveTo(f.X, f.Y - f.R * 1.1);
    l.quadraticCurveTo(f.X + f.R * 0.08, f.Y, f.X, f.Y + f.R * 1.05);
    l.stroke();
  }

  // Glieder: heller Ton, zwei Kanten
  for (const lm of p.geo.limbs) {
    l.strokeStyle = G(0.1);
    strokeLimb(l, lm, S, lm.w * S);
    const pts = limbPx(lm, S);
    for (const side of [-1, 1]) {
      const edge: P2[] = pts.map((q, i) => {
        const a = pts[Math.max(0, i - 1)]!,
          b = pts[Math.min(pts.length - 1, i + 1)]!;
        let nx = -(b[1] - a[1]),
          ny = b[0] - a[0];
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl;
        ny /= nl;
        return [q[0] + nx * side * lm.w * S * 0.45 + gauss(r), q[1] + ny * side * lm.w * S * 0.45 + gauss(r)];
      });
      l.strokeStyle = G(side > 0 ? 0.7 : 0.45);
      l.lineWidth = S / (side > 0 ? 480 : 700);
      limbPath(l, edge);
      l.stroke();
    }
  }

  // Ton und Schraffur auf der Schattenseite
  for (const o of p.bases) {
    l.save();
    clipShadow(l, o, S, 0.3);
    const g = l.createRadialGradient((o.b.x + o.b.rx * 0.5) * S, (o.b.y + o.b.ry * 0.6) * S, 0, o.b.x * S, o.b.y * S, Math.max(o.b.rx, o.b.ry) * S * 1.3);
    g.addColorStop(0, G(0.3));
    g.addColorStop(1, G(0.08));
    l.fillStyle = g;
    l.fillRect(0, 0, S, S);
    hatch(l, S, -0.95, S * 0.0068, S / 700, G, r, 0.32, 0.62, blobBox(o, S));
    l.restore();
    l.save();
    clipShadow(l, o, S, 0.12);
    hatch(l, S, 0.62, S * 0.0072, S / 760, G, r, 0.3, 0.55, blobBox(o, S));
    l.restore();
  }
  // Muster des Nebenpigments als zarte Kringel
  if (m.sec.length) {
    const o = p.core;
    l.save();
    smoothClosed(l, o.base);
    l.clip();
    for (let i = 0; i < 9; i++) {
      const x = (o.b.x + gauss(r) * o.b.rx * 0.45) * S,
        y = (o.b.y + gauss(r) * o.b.ry * 0.45) * S,
        rad = rr(r, 0.012, 0.028) * S;
      l.strokeStyle = G(0.4);
      l.lineWidth = S / 900;
      l.beginPath();
      l.ellipse(x, y, rad, rad * rr(r, 0.6, 1), r() * 3, rr(r, 0, 1), rr(r, 5, 6.6));
      l.stroke();
    }
    l.restore();
  }

  // Kontur: zwei Durchgänge, einer setzt über
  const big = p.core.b.rx * p.core.b.ry;
  for (const o of p.bases) {
    const lw = S / (o.b.rx * o.b.ry > big * 0.3 ? 420 : 520);
    pressureContour(l, o.base, o.b.x * S, o.b.y * S, lw, G, r, lw * 0.4, 0.95, 0);
    pressureContour(l, o.base, o.b.x * S, o.b.y * S, lw * 0.7, G, r, lw * 1.6, 0.35, ri(r, 3, 9));
  }

  // Gesicht mit dem normalen Strich, wird unten grau
  faceOf(l, m, p.geo, S, tone.join(','), p.core.b, [70, 70, 76]);

  // Radiert: Lichter auf der hellen Seite
  l.globalCompositeOperation = 'destination-out';
  l.lineCap = 'round';
  for (const o of p.bases) {
    if (o.b.rx * o.b.ry < big * 0.3) continue;
    for (let k = 0; k < 2; k++) {
      l.strokeStyle = `rgba(0,0,0,${rr(r, 0.45, 0.7)})`;
      l.lineWidth = S * rr(r, 0.006, 0.011);
      const bx = (o.b.x - o.b.rx * rr(r, 0.25, 0.45)) * S,
        by = (o.b.y - o.b.ry * rr(r, 0.3, 0.5)) * S;
      l.beginPath();
      l.moveTo(bx - o.b.rx * S * 0.18, by + o.b.ry * S * 0.08);
      l.quadraticCurveTo(bx, by - o.b.ry * S * 0.06, bx + o.b.rx * S * 0.2, by + o.b.ry * S * 0.02);
      l.stroke();
    }
  }
  l.globalCompositeOperation = 'source-over';

  // Alles grau: nur Graphit
  const img = l.getImageData(0, 0, S, S),
    d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 0.3 * d[i]! + 0.59 * d[i + 1]! + 0.11 * d[i + 2]!;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = Math.min(255, v * 1.04);
  }
  l.putImageData(img, 0, 0);
  ctx.drawImage(lc, 0, 0);

  // Notiz am Rand
  if (!DECO) return;
  ctx.fillStyle = G(0.62);
  ctx.font = `${Math.round(S * 0.05)}px Caveat`;
  ctx.textAlign = 'left';
  ctx.fillText(note, S * 0.07, S * 0.93);
  ctx.font = `${Math.round(S * 0.036)}px Caveat`;
  ctx.textAlign = 'right';
  ctx.fillText('study, wet day', S * 0.94, S * 0.09);
}

/* =====================================================================
 * Comic: dicke Kontur, flache Farbe, Rasterpunkte im Schatten, Strahlen
 * ===================================================================== */
export function comic(ctx: Ctx, m: Monster, S: number, caption: string): void {
  const p = prep(m, S, 0.12, 2);
  const r = RNG(m.seed + 4321);
  const { cx, cy } = centerOf(p);
  const INKC = '#16141c';
  // Hintergrund: Gelb, Strahlen, Rasterpunkte zum Rand hin
  ctx.fillStyle = '#ffd95e';
  ctx.fillRect(0, 0, S, S);
  const rays = 22;
  ctx.fillStyle = '#ffeca6';
  for (let i = 0; i < rays; i++) {
    const a0 = (i / rays) * Math.PI * 2 + 0.1,
      a1 = a0 + (Math.PI * 2) / rays / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * S * 1.5, cy + Math.sin(a0) * S * 1.5);
    ctx.lineTo(cx + Math.cos(a1) * S * 1.5, cy + Math.sin(a1) * S * 1.5);
    ctx.closePath();
    ctx.fill();
  }
  const sp = S / 46;
  ctx.fillStyle = 'rgba(236,84,60,.55)';
  for (let y = sp / 2; y < S; y += sp)
    for (let x = ((y / sp) % 2) * (sp / 2); x < S; x += sp) {
      const t = clamp((Math.hypot(x - cx, y - cy) - S * 0.36) / (S * 0.38), 0, 1);
      if (t <= 0) continue;
      ctx.beginPath();
      ctx.arc(x, y, sp * 0.42 * t, 0, 7);
      ctx.fill();
    }

  const [h, s0, l0] = toHsl(PIG[m.main].rgb);
  const B = fromHsl(h, clamp(s0 * 1.2 + 0.18, 0, 0.95), clamp(l0 * 1.15 + 0.06, 0.44, 0.6));
  const D = fromHsl((h + 0.97) % 1, clamp(s0 * 1.1 + 0.15, 0, 0.95), clamp(l0 * 0.8, 0.2, 0.42));

  // Bodenschatten
  const fy = feetY(p, S);
  ctx.fillStyle = 'rgba(22,20,28,.85)';
  ctx.beginPath();
  ctx.ellipse(cx, fy + S * 0.006, S * 0.2, S * 0.024, 0, 0, 7);
  ctx.fill();

  const faces = faceLayout(m, p, S);
  const ex = extrasOf(m, p, S, faces);
  // dicke Außenkontur aus der Silhouette
  ring(ctx, silhouette(S, p, INKC, ex), S * 0.011);
  // Zusatzformen
  for (const t of ex.tris) {
    ctx.fillStyle = ex.horns ? '#f4ead2' : rgb(D);
    triPath(ctx, t);
    ctx.fill();
    ctx.strokeStyle = INKC;
    ctx.lineWidth = S * 0.004;
    ctx.stroke();
  }
  for (const a of ex.antennae) {
    ctx.strokeStyle = INKC;
    ctx.lineWidth = a.w;
    limbPath(ctx, a.path);
    ctx.stroke();
    ctx.fillStyle = rgb(B);
    ctx.beginPath();
    ctx.arc(a.tip[0], a.tip[1], a.r, 0, 7);
    ctx.fill();
  }
  // Glieder
  for (const lm of p.geo.limbs) {
    ctx.strokeStyle = rgb(B);
    strokeLimb(ctx, lm, S, lm.w * S);
    ctx.strokeStyle = rgb(D);
    strokeLimb(ctx, lm, S, lm.w * S * 0.4, lm.w * S * 0.25, lm.w * S * 0.25);
  }
  // Kleckse von hinten nach vorn
  const big = p.core.b.rx * p.core.b.ry;
  for (const o of p.bases) {
    ctx.fillStyle = o.b.leaf ? '#53b45a' : rgb(B);
    smoothClosed(ctx, o.base);
    ctx.fill();
    if (o === p.core && m.sec.length) {
      ctx.save();
      smoothClosed(ctx, o.base);
      ctx.clip();
      const sc = fromHsl(toHsl(PIG[m.sec[0]!].rgb)[0], 0.75, 0.55);
      for (let i = 0; i < 7; i++) {
        const x = (o.b.x + gauss(r) * o.b.rx * 0.45) * S,
          y = (o.b.y + gauss(r) * o.b.ry * 0.4) * S;
        ctx.fillStyle = rgb(sc);
        ctx.beginPath();
        ctx.ellipse(x, y, rr(r, 0.016, 0.03) * S, rr(r, 0.012, 0.024) * S, r() * 3, 0, 7);
        ctx.fill();
        ctx.strokeStyle = INKC;
        ctx.lineWidth = S * 0.0028;
        ctx.stroke();
      }
      ctx.restore();
    }
    // Schatten: dunklere Fläche mit schwarzen Rasterpunkten
    ctx.save();
    clipShadow(ctx, o, S, 0.24);
    ctx.fillStyle = rgb(D, 0.75);
    ctx.fillRect(0, 0, S, S);
    const ds = S / 72;
    ctx.fillStyle = 'rgba(16,14,22,.55)';
    const [bx0, by0, bx1, by1] = blobBox(o, S);
    for (let y = by0; y < by1; y += ds)
      for (let x = bx0 + (((y - by0) / ds) % 2) * (ds / 2); x < bx1; x += ds) {
        ctx.beginPath();
        ctx.arc(x, y, ds * 0.26, 0, 7);
        ctx.fill();
      }
    ctx.restore();
    // Glanz
    if (o.b.rx * o.b.ry > big * 0.2 && !o.b.leaf) {
      const gx = (o.b.x - o.b.rx * 0.38) * S,
        gy = (o.b.y - o.b.ry * 0.45) * S;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(gx, gy, o.b.rx * S * 0.24, o.b.ry * S * 0.1, (o.b.rot || 0) - 0.5, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(gx + o.b.rx * S * 0.3, gy - o.b.ry * S * 0.06, o.b.rx * S * 0.045, 0, 7);
      ctx.fill();
    }
    ctx.strokeStyle = INKC;
    ctx.lineWidth = S * 0.0045;
    smoothClosed(ctx, o.base);
    ctx.stroke();
  }
  for (const q of ex.freckles) {
    ctx.fillStyle = INKC;
    ctx.beginPath();
    ctx.arc(q[0], q[1], S * 0.004, 0, 7);
    ctx.fill();
  }
  const face = { ...m, face: { ...m.face, extra: 'keins' as const } };
  faceOf(ctx, face, p.geo, S, '255,255,255', p.core.b);
  // Schreck-Striche am Kopf
  const f = faces[0];
  if (f) {
    ctx.strokeStyle = INKC;
    ctx.lineCap = 'round';
    ctx.lineWidth = S * 0.006;
    for (let i = 0; i < 3; i++) {
      const a = -1.25 + i * 0.4;
      const ox = f.X + f.R * 1.15,
        oy = f.Y - f.R * 1.0;
      ctx.beginPath();
      ctx.moveTo(ox + Math.cos(a) * f.R * 0.25, oy + Math.sin(a) * f.R * 0.25);
      ctx.lineTo(ox + Math.cos(a) * f.R * 0.6, oy + Math.sin(a) * f.R * 0.6);
      ctx.stroke();
    }
  }
  // Textkasten
  if (DECO) drawCaption(ctx, S, caption, INKC);
  // Panelrahmen
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = S * 0.05;
  ctx.strokeRect(0, 0, S, S);
  ctx.strokeStyle = INKC;
  ctx.lineWidth = S * 0.011;
  ctx.strokeRect(S * 0.025, S * 0.025, S * 0.95, S * 0.95);
  void r;
}
function drawCaption(ctx: Ctx, S: number, caption: string, INKC: string): void {
  ctx.font = `900 ${Math.round(S * 0.042)}px Figtree`;
  const tw = ctx.measureText(caption).width;
  const bx = S * 0.06,
    by = S * 0.06,
    bw = tw + S * 0.05,
    bh = S * 0.075;
  ctx.fillStyle = '#fff7d9';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = INKC;
  ctx.lineWidth = S * 0.005;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = INKC;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(caption, bx + S * 0.025, by + bh / 2 + S * 0.002);
  ctx.textBaseline = 'alphabetic';
}

/* =====================================================================
 * Bestiary Plate: alte Tafel aus einem Bestiarium, Kupferstich, von Hand koloriert
 * ===================================================================== */
const LATIN: Record<PigmentId, string> = {
  ultra: 'ultramarina',
  phthalo: 'viridis',
  karmin: 'carminea',
  kadmium: 'flava',
  siena: 'usta',
  indigo: 'indica',
  sepia: 'sepiacea',
  opera: 'rosea',
};
export const latinName = (m: Monster): string => `${m.name}${/[aeiou]$/.test(m.name) ? 'na' : 'ia'} ${LATIN[m.main]}`;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX'];

export function plate(ctx: Ctx, m: Monster, S: number): void {
  const tone = [238, 226, 199];
  paperFill(ctx, S, tone, 0.5);
  const r = RNG(m.seed + 1777);
  const INKC = (a: number) => `rgba(46,32,22,${a})`;
  // Stockflecken und dunklere Ränder
  for (let i = 0; i < 26; i++) {
    const x = r() * S,
      y = r() * S,
      rad = rr(r, 0.004, 0.02) * S;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(150,100,50,${rr(r, 0.08, 0.2)})`);
    g.addColorStop(1, 'rgba(150,100,50,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const vg = ctx.createRadialGradient(S / 2, S / 2, S * 0.35, S / 2, S / 2, S * 0.75);
  vg.addColorStop(0, 'rgba(120,80,40,0)');
  vg.addColorStop(1, 'rgba(120,80,40,.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, S, S);
  // Rahmen
  ctx.strokeStyle = INKC(0.85);
  ctx.lineWidth = S * 0.0035;
  ctx.strokeRect(S * 0.045, S * 0.045, S * 0.91, S * 0.91);
  ctx.lineWidth = S * 0.0012;
  ctx.strokeRect(S * 0.058, S * 0.058, S * 0.884, S * 0.884);
  if (DECO) {
    ctx.fillStyle = INKC(0.85);
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(S * 0.028)}px "Young Serif"`;
    try {
      ctx.letterSpacing = `${S * 0.006}px`;
    } catch {
      /* ältere Browser */
    }
    ctx.fillText(`PLATE ${ROMAN[m.seed % ROMAN.length]}`, S / 2, S * 0.105);
    try {
      ctx.letterSpacing = '0px';
    } catch {
      /* egal */
    }
  }

  // Figur etwas kleiner, Platz für die Unterschrift
  ctx.save();
  ctx.translate(S * 0.12, S * 0.07);
  ctx.scale(0.76, 0.76);
  const p = prep(m, S, 0.16, 3);
  const { cx, x0, x1 } = centerOf(p);
  const fy = feetY(p, S);
  // Boden: Grasbüschel, Steinchen, schraffierter Schatten
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, fy + S * 0.02, (x1 - x0) * 0.62, S * 0.04, 0, 0, 7);
  ctx.clip();
  hatch(ctx, S, 0.05, S * 0.0055, S / 1300, INKC, r, 0.5, 0.8, [cx - S * 0.5, fy - S * 0.05, cx + S * 0.5, fy + S * 0.09]);
  ctx.restore();
  ctx.strokeStyle = INKC(0.8);
  ctx.lineWidth = S / 1100;
  for (let i = 0; i < 16; i++) {
    const gx = cx + rr(r, -0.7, 0.7) * (x1 - x0) * 0.62,
      gy = fy + S * 0.02 + rr(r, -0.02, 0.025) * S;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(gx + k * S * 0.004, gy);
      ctx.quadraticCurveTo(gx + k * S * 0.004 + rr(r, -0.01, 0.01) * S, gy - S * 0.02, gx + k * S * 0.006 + rr(r, -0.015, 0.015) * S, gy - rr(r, 0.02, 0.04) * S);
      ctx.stroke();
    }
  }
  // Handkolorierung: flach, leicht verrutscht, erreicht die Kante nicht ganz
  const main = PIG[m.main].rgb;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.translate(S * 0.006, S * 0.004);
  const wash = mixRGB(main, tone, 0.35);
  ctx.fillStyle = ctx.strokeStyle = rgb(wash, 0.7);
  for (const lm of p.geo.limbs) strokeLimb(ctx, lm, S, lm.w * S * 0.8);
  for (const o of p.bases) {
    ctx.fillStyle = o.b.leaf ? rgb(mixRGB([90, 140, 70], tone, 0.3), 0.7) : rgb(wash, 0.7);
    smoothClosed(ctx, o.base);
    ctx.fill();
  }
  m.sec.forEach((id, i) => {
    const o = i === 0 ? (p.bases.find((x) => x !== p.core) ?? p.core) : p.core;
    ctx.fillStyle = rgb(mixRGB(PIG[id].rgb, tone, 0.35), 0.55);
    ctx.beginPath();
    ctx.ellipse(o.b.x * S, (o.b.y + o.b.ry * 0.2) * S, o.b.rx * S * 0.55, o.b.ry * S * 0.5, o.b.rot || 0, 0, 7);
    ctx.fill();
  });
  ctx.restore();
  // Stich: Höhenlinien und Kreuzschraffur auf der Schattenseite, Punkte als Körnung
  for (const o of p.bases) {
    const ox = (o.b.x - o.b.rx * 0.3) * S,
      oy = (o.b.y - o.b.ry * 0.35) * S;
    ctx.save();
    clipShadow(ctx, o, S, 0.34);
    ctx.strokeStyle = INKC(0.7);
    ctx.lineWidth = S / 1250;
    for (let t = 0.95; t > 0.25; t -= 0.065) {
      ctx.beginPath();
      addSmooth(
        ctx,
        o.base.map((q) => [ox + (q[0] - ox) * t, oy + (q[1] - oy) * t] as P2),
      );
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    clipShadow(ctx, o, S, 0.13);
    hatch(ctx, S, 0.75, S * 0.0048, S / 1500, INKC, r, 0.5, 0.75, blobBox(o, S));
    ctx.restore();
    ctx.save();
    smoothClosed(ctx, o.base);
    ctx.clip();
    const n = Math.round(o.b.rx * o.b.ry * 2600);
    for (let i = 0; i < n; i++) {
      const x = (o.b.x + gauss(r) * o.b.rx * 0.5) * S,
        y = (o.b.y + gauss(r) * o.b.ry * 0.5) * S;
      ctx.fillStyle = INKC(rr(r, 0.35, 0.7));
      ctx.fillRect(x, y, S / 800, S / 800);
    }
    ctx.restore();
  }
  // Glieder: Kanten und Ringe
  for (const lm of p.geo.limbs) {
    const pts = limbPx(lm, S);
    for (const side of [-1, 1]) {
      const edge: P2[] = pts.map((q, i) => {
        const a = pts[Math.max(0, i - 1)]!,
          b = pts[Math.min(pts.length - 1, i + 1)]!;
        let nx = -(b[1] - a[1]),
          ny = b[0] - a[0];
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl;
        ny /= nl;
        return [q[0] + nx * side * lm.w * S * 0.42, q[1] + ny * side * lm.w * S * 0.42];
      });
      ctx.strokeStyle = INKC(0.9);
      ctx.lineWidth = S / (side > 0 ? 700 : 1000);
      limbPath(ctx, edge);
      ctx.stroke();
    }
  }
  // Konturen, fest und fein
  for (const o of p.bases) pressureContour(ctx, o.base, o.b.x * S, o.b.y * S, S / 700, INKC, null, 0, 0.95);
  faceOf(ctx, m, p.geo, S, tone.join(','), p.core.b);
  ctx.restore();

  // Unterschrift und Maßstab
  if (!DECO) return;
  ctx.textAlign = 'center';
  ctx.fillStyle = INKC(0.92);
  ctx.font = `${Math.round(S * 0.036)}px "Young Serif"`;
  ctx.fillText(`Fig. 1.  ${m.name}`, S / 2, S * 0.87);
  ctx.font = `italic ${Math.round(S * 0.028)}px "Young Serif"`;
  ctx.fillStyle = INKC(0.75);
  ctx.fillText(latinName(m), S / 2, S * 0.908);
  ctx.strokeStyle = INKC(0.8);
  ctx.lineWidth = S / 900;
  const sx = S * 0.74,
    sy = S * 0.8;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + S * 0.12, sy);
  for (let i = 0; i <= 4; i++) {
    ctx.moveTo(sx + (S * 0.12 * i) / 4, sy);
    ctx.lineTo(sx + (S * 0.12 * i) / 4, sy - S * (i % 2 ? 0.006 : 0.012));
  }
  ctx.stroke();
  ctx.font = `${Math.round(S * 0.018)}px "Young Serif"`;
  ctx.fillText('1 in.', sx + S * 0.06, sy + S * 0.025);
}

/* =====================================================================
 * Anime: weiche Pastellfarben, harte Schatten, große glänzende Augen
 * ===================================================================== */
export function anime(ctx: Ctx, m: Monster, S: number): void {
  const p = prep(m, S, 0.09, 2);
  const r = RNG(m.seed + 8080);
  const { cx, cy } = centerOf(p);
  // Himmel, Lichtflecken, Strahlen
  const bg = ctx.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, '#ffd6e7');
  bg.addColorStop(0.55, '#e7dcff');
  bg.addColorStop(1, '#cbe7ff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) {
    const x = S * (0.05 + i * 0.22);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + S * 0.08, 0);
    ctx.lineTo(x + S * 0.5, S);
    ctx.lineTo(x + S * 0.35, S);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  for (let i = 0; i < 16; i++) {
    const x = r() * S,
      y = r() * S,
      rad = rr(r, 0.015, 0.06) * S;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(255,255,255,${rr(r, 0.25, 0.55)})`);
    g.addColorStop(0.7, `rgba(255,255,255,${rr(r, 0.1, 0.2)})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  const [h, s0, l0] = toHsl(PIG[m.main].rgb);
  const B = fromHsl(h, clamp(s0 * 0.75 + 0.15, 0.35, 0.78), clamp(l0 * 0.45 + 0.5, 0.62, 0.8));
  const LC = rgb(fromHsl((h + 0.96) % 1, clamp(s0 * 0.6 + 0.2, 0.3, 0.7), clamp(l0 * 0.5, 0.16, 0.3)));
  const SH = [206, 186, 238],
    DEEP = [160, 136, 214];

  // weicher Bodenschatten
  const fy = feetY(p, S);
  const gsh = ctx.createRadialGradient(cx, fy, 0, cx, fy, S * 0.25);
  gsh.addColorStop(0, 'rgba(120,90,190,.35)');
  gsh.addColorStop(1, 'rgba(120,90,190,0)');
  ctx.fillStyle = gsh;
  ctx.save();
  ctx.translate(0, fy * (1 - 0.18));
  ctx.scale(1, 0.18);
  ctx.fillRect(cx - S * 0.3, fy - S * 0.3, S * 0.6, S * 0.6);
  ctx.restore();

  const faces = faceLayout(m, p, S);
  const ex = extrasOf(m, p, S, faces);
  ring(ctx, silhouette(S, p, LC, ex), S * 0.0055);
  for (const t of ex.tris) {
    ctx.fillStyle = ex.horns ? '#fff3dc' : rgb(B);
    triPath(ctx, t);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = rgb(SH);
    ctx.beginPath();
    ctx.moveTo(t[1]![0], t[1]![1]);
    ctx.lineTo(t[2]![0], t[2]![1]);
    ctx.lineTo((t[0]![0] + t[2]![0]) / 2, (t[0]![1] + t[2]![1]) / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = LC;
    ctx.lineWidth = S * 0.0035;
    triPath(ctx, t);
    ctx.stroke();
  }
  for (const a of ex.antennae) {
    ctx.strokeStyle = LC;
    ctx.lineWidth = a.w * 0.8;
    limbPath(ctx, a.path);
    ctx.stroke();
    ctx.fillStyle = '#ffd36b';
    ctx.beginPath();
    star(ctx, a.tip[0], a.tip[1], a.r * 1.7, a.r * 0.75, 5);
    ctx.fill();
    ctx.strokeStyle = LC;
    ctx.lineWidth = S * 0.003;
    ctx.stroke();
  }
  for (const lm of p.geo.limbs) {
    ctx.strokeStyle = rgb(B);
    strokeLimb(ctx, lm, S, lm.w * S);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = rgb(SH);
    strokeLimb(ctx, lm, S, lm.w * S * 0.45, lm.w * S * 0.24, lm.w * S * 0.24);
    ctx.restore();
  }
  const big = p.core.b.rx * p.core.b.ry;
  for (const o of p.bases) {
    ctx.fillStyle = o.b.leaf ? '#9fe0a8' : rgb(B);
    smoothClosed(ctx, o.base);
    ctx.fill();
    if (o === p.core && m.sec.length) {
      const sc = fromHsl(toHsl(PIG[m.sec[0]!].rgb)[0], 0.55, 0.86);
      ctx.save();
      smoothClosed(ctx, o.base);
      ctx.clip();
      ctx.fillStyle = rgb(sc);
      ctx.beginPath();
      ctx.ellipse(o.b.x * S, (o.b.y + o.b.ry * 0.38) * S, o.b.rx * S * 0.55, o.b.ry * S * 0.5, o.b.rot || 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = LC;
      ctx.lineWidth = S * 0.0025;
      ctx.stroke();
      ctx.restore();
    }
    // Zellschatten: eine harte Kante, dazu ein schmaler tiefer Rand
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    clipShadow(ctx, o, S, 0.22);
    ctx.fillStyle = rgb(SH);
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    clipShadow(ctx, o, S, 0.06);
    ctx.fillStyle = rgb(DEEP);
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
    if (o.b.rx * o.b.ry > big * 0.2 && !o.b.leaf) {
      const gx = (o.b.x - o.b.rx * 0.32) * S,
        gy = (o.b.y - o.b.ry * 0.4) * S;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, o.b.rx * S * 0.55);
      g.addColorStop(0, 'rgba(255,255,255,.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      smoothClosed(ctx, o.base);
      ctx.clip();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(gx - o.b.rx * S * 0.05, gy, o.b.rx * S * 0.13, o.b.ry * S * 0.06, (o.b.rot || 0) - 0.6, 0, 7);
      ctx.fill();
    }
    ctx.strokeStyle = LC;
    ctx.lineWidth = S * 0.0032;
    smoothClosed(ctx, o.base);
    ctx.stroke();
  }
  // Gesicht
  const iris = m.sec[0] ? toHsl(PIG[m.sec[0]].rgb)[0] : (h + 0.5) % 1;
  for (const f of faces) {
    for (const st of f.stalks) {
      ctx.strokeStyle = LC;
      ctx.lineWidth = f.R * 0.09;
      limbPath(ctx, st);
      ctx.stroke();
      ctx.strokeStyle = rgb(B);
      ctx.lineWidth = f.R * 0.05;
      ctx.stroke();
    }
    // Wangen
    if (!f.stalks.length) {
      for (const s of [-1, 1]) {
        const bx = f.X + s * f.R * 0.62,
          by = f.Y + f.R * 0.22;
        ctx.fillStyle = 'rgba(255,120,150,.42)';
        ctx.beginPath();
        ctx.ellipse(bx, by, f.R * 0.17, f.R * 0.08, 0, 0, 7);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.8)';
        ctx.lineWidth = f.R * 0.018;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(bx + k * f.R * 0.07 + f.R * 0.02, by - f.R * 0.04);
          ctx.lineTo(bx + k * f.R * 0.07 - f.R * 0.02, by + f.R * 0.04);
          ctx.stroke();
        }
      }
    }
    for (const e of f.eyes) {
      const side = Math.sign(e.x - f.X);
      const er = e.kind === 'punkt' ? e.r * 2.6 : e.kind === 'zyklop' ? e.r * 0.95 : e.kind === 'rund' && f.eyes.length > 2 ? e.r * 1.35 : e.r * 1.5;
      animeEye(ctx, e.x, e.y, er, e.kind, iris, LC, side, B);
    }
    animeMouth(ctx, f, LC);
  }
  for (const q of ex.freckles) {
    ctx.fillStyle = 'rgba(200,110,120,.6)';
    ctx.beginPath();
    ctx.arc(q[0], q[1], S * 0.0035, 0, 7);
    ctx.fill();
  }
  // Funkeln
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2,
      d = rr(r, 0.3, 0.44) * S;
    const x = cx + Math.cos(a) * d,
      y = cy + Math.sin(a) * d * 0.9;
    if (x < S * 0.05 || x > S * 0.95 || y < S * 0.05 || y > S * 0.95) continue;
    const s = rr(r, 0.012, 0.03) * S;
    ctx.fillStyle = i % 3 ? '#ffffff' : '#fff1a8';
    ctx.beginPath();
    star(ctx, x, y, s, s * 0.22, 4);
    ctx.fill();
  }
}
function star(ctx: Ctx, x: number, y: number, R: number, r: number, n: number): void {
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2,
      d = i % 2 ? r : R;
    i ? ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d) : ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}
function animeEye(ctx: Ctx, x: number, y: number, r: number, kind: string, irisHue: number, LC: string, side: number, skin: C3): void {
  const w = r * 0.92,
    h = r * 1.28;
  const IR = fromHsl(irisHue, 0.75, 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, 7);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();
  const ix = x + side * w * 0.06,
    iy = y + h * 0.1;
  const g = ctx.createLinearGradient(0, iy - h * 0.8, 0, iy + h * 0.8);
  g.addColorStop(0, rgb(shade(IR, 0.35)));
  g.addColorStop(0.55, rgb(IR));
  g.addColorStop(1, rgb(mixRGB(IR, [255, 255, 255], 0.45)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(ix, iy, w * 0.8, h * 0.8, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = rgb(shade(IR, 0.22));
  ctx.beginPath();
  ctx.ellipse(ix, iy + h * 0.02, w * 0.36, h * 0.42, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = rgb(shade(IR, 0.3), 0.8);
  ctx.lineWidth = w * 0.06;
  ctx.beginPath();
  ctx.ellipse(ix, iy, w * 0.8, h * 0.8, 0, 0, 7);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(ix - w * 0.3, iy - h * 0.34, w * 0.3, h * 0.26, -0.4, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ix + w * 0.3, iy + h * 0.32, w * 0.12, 0, 7);
  ctx.fill();
  // Lid bei müden und schmalen Augen
  if (kind === 'muede' || kind === 'schlitz') {
    ctx.fillStyle = rgb(skin);
    ctx.beginPath();
    const lid = kind === 'muede' ? 0.1 : -0.3;
    ctx.moveTo(x - w * 1.2, y - h * 1.2);
    ctx.lineTo(x + w * 1.2, y - h * 1.2);
    ctx.lineTo(x + w * 1.2, y + h * (lid - side * 0.25));
    ctx.lineTo(x - w * 1.2, y + h * (lid + side * 0.25));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Wimpernbogen oben, kleiner Schwung außen
  ctx.strokeStyle = LC;
  ctx.fillStyle = LC;
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.26;
  ctx.beginPath();
  if (kind === 'muede' || kind === 'schlitz') {
    const lid = kind === 'muede' ? 0.1 : -0.3;
    ctx.moveTo(x - w * 0.95, y + h * (lid + side * 0.25 * 0.8));
    ctx.lineTo(x + w * 0.95, y + h * (lid - side * 0.25 * 0.8));
  } else ctx.ellipse(x, y, w * 1.02, h * 1.02, 0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  if (side !== 0 && kind !== 'zyklop') {
    ctx.beginPath();
    ctx.moveTo(x + side * w * 0.85, y - h * 0.6);
    ctx.lineTo(x + side * w * 1.35, y - h * 0.82);
    ctx.lineTo(x + side * w * 1.0, y - h * 0.35);
    ctx.closePath();
    ctx.fill();
  }
  ctx.lineWidth = w * 0.08;
  ctx.beginPath();
  ctx.ellipse(x, y, w * 1.0, h * 1.0, 0, Math.PI * 0.32, Math.PI * 0.68);
  ctx.stroke();
}
function animeMouth(ctx: Ctx, f: FaceL, LC: string): void {
  const { x, y, kind } = f.mouth,
    R = f.R;
  ctx.strokeStyle = LC;
  ctx.lineWidth = R * 0.045;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const my = y - R * 0.05;
  if (kind === 'laecheln' || kind === 'keiner') {
    // kleines w
    ctx.beginPath();
    ctx.moveTo(x - R * 0.14, my);
    ctx.quadraticCurveTo(x - R * 0.07, my + R * 0.1, x, my + R * 0.01);
    ctx.quadraticCurveTo(x + R * 0.07, my + R * 0.1, x + R * 0.14, my);
    ctx.stroke();
  } else if (kind === 'rohr') {
    ctx.fillStyle = '#b8455c';
    ctx.beginPath();
    ctx.ellipse(x, my + R * 0.04, R * 0.06, R * 0.075, 0, 0, 7);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'schnabel') {
    ctx.fillStyle = '#ffb54d';
    ctx.beginPath();
    ctx.moveTo(x - R * 0.13, my - R * 0.03);
    ctx.lineTo(x + R * 0.13, my - R * 0.03);
    ctx.lineTo(x, my + R * 0.13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // offener Mund mit Zahn
    ctx.fillStyle = '#9c2f4a';
    ctx.beginPath();
    ctx.moveTo(x - R * 0.2, my - R * 0.02);
    ctx.quadraticCurveTo(x, my - R * 0.06, x + R * 0.2, my - R * 0.02);
    ctx.quadraticCurveTo(x, my + R * 0.3, x - R * 0.2, my - R * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ff8fa3';
    ctx.beginPath();
    ctx.ellipse(x, my + R * 0.2, R * 0.12, R * 0.08, 0, 0, 7);
    ctx.fill();
    ctx.restore();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + R * 0.06, my - R * 0.035);
    ctx.lineTo(x + R * 0.13, my - R * 0.03);
    ctx.lineTo(x + R * 0.095, my + R * 0.06);
    ctx.closePath();
    ctx.fill();
  }
}

/* =====================================================================
 * Oil: dunkler Grund, pastose Pinselstriche entlang der Form, Goldrahmen
 * ===================================================================== */
export function oil(ctx: Ctx, m: Monster, S: number, plaque: string): void {
  const p = prep(m, S, 0.2, 3);
  const r = RNG(m.seed + 3141);
  const { cx, cy } = centerOf(p);
  // Grund: warmes Halbdunkel, hinter der Figur heller
  const bg = ctx.createRadialGradient(cx - S * 0.06, cy - S * 0.08, S * 0.05, cx, cy, S * 0.75);
  bg.addColorStop(0, '#7a6440');
  bg.addColorStop(0.45, '#46371f');
  bg.addColorStop(1, '#17110b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  const BGC = [
    [70, 56, 34],
    [92, 74, 46],
    [44, 34, 22],
    [110, 92, 58],
    [58, 60, 40],
  ];
  ctx.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = r() * S,
      y = r() * S,
      a = -0.7 + gauss(r) * 0.5,
      len = rr(r, 0.06, 0.16) * S;
    const near = 1 - clamp(Math.hypot(x - cx, y - cy) / (S * 0.6), 0, 1);
    const c = shade(BGC[Math.floor(r() * BGC.length)]!, 0.6 + near * 0.7);
    ctx.strokeStyle = rgb(c, rr(r, 0.12, 0.3));
    ctx.lineWidth = rr(r, 0.025, 0.055) * S;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * len * 0.5, y - Math.sin(a) * len * 0.5);
    ctx.quadraticCurveTo(x + gauss(r) * len * 0.15, y + gauss(r) * len * 0.15, x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5);
    ctx.stroke();
  }
  // Bodenschatten
  const fy = feetY(p, S);
  ctx.save();
  ctx.translate(0, fy * (1 - 0.2));
  ctx.scale(1, 0.2);
  const gs = ctx.createRadialGradient(cx, fy, 0, cx, fy, S * 0.26);
  gs.addColorStop(0, 'rgba(10,6,2,.7)');
  gs.addColorStop(1, 'rgba(10,6,2,0)');
  ctx.fillStyle = gs;
  ctx.fillRect(cx - S * 0.3, fy - S * 0.3, S * 0.6, S * 0.6);
  ctx.restore();

  const base = PIG[m.main].rgb;
  const [hh, ss, ll] = toHsl(base);
  const B = fromHsl(hh, clamp(ss * 1.05, 0, 0.9), clamp(ll, 0.3, 0.55));
  const L = [-0.48, -0.62, 0.62];
  const Ln = Math.hypot(L[0]!, L[1]!, L[2]!);
  const lightAt = (u: number, v: number): number => {
    const z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
    const n = Math.hypot(u, v, z) || 1;
    return Math.max(0, (u * L[0]! + v * L[1]! + z * L[2]!) / (n * Ln));
  };
  const colorAt = (c: C3, lam: number): C3 => {
    let k = shade(c, 0.45 + lam * 0.8);
    k = mixRGB(k, [62, 40, 30], 0.32 * (1 - lam));
    if (lam > 0.82) k = mixRGB(k, [255, 236, 200], (lam - 0.82) * 2.2);
    return k.map((v) => clamp(Math.round(v + gauss(r) * 6), 0, 255));
  };
  const dab = (x: number, y: number, ang: number, len: number, bw: number, c: C3, a = 0.95): void => {
    const dx = Math.cos(ang) * len * 0.5,
      dy = Math.sin(ang) * len * 0.5,
      bend = gauss(r) * bw * 0.35;
    const path = (ox: number, oy: number) => {
      ctx.beginPath();
      ctx.moveTo(x - dx + ox, y - dy + oy);
      ctx.quadraticCurveTo(x - Math.sin(ang) * bend + ox, y + Math.cos(ang) * bend + oy, x + dx + ox, y + dy + oy);
    };
    ctx.strokeStyle = rgb(shade(c, 0.7), 0.35 * a);
    ctx.lineWidth = bw * 0.9;
    path(bw * 0.18, bw * 0.24);
    ctx.stroke();
    ctx.strokeStyle = rgb(c, a);
    ctx.lineWidth = bw;
    path(0, 0);
    ctx.stroke();
    ctx.strokeStyle = rgb(mixRGB(c, [255, 246, 226], 0.35), 0.3 * a);
    ctx.lineWidth = bw * 0.16;
    path(-bw * 0.22, -bw * 0.28);
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  // Glieder: Striche entlang des Glieds
  for (const lm of p.geo.limbs) {
    const pts = limbPx(lm, S),
      w = lm.w * S;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!,
        b = pts[i + 1]!,
        seg = Math.hypot(b[0] - a[0], b[1] - a[1]),
        ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const nx = -Math.sin(ang),
        ny = Math.cos(ang),
        lam = clamp(0.5 - (nx * L[0]! + ny * L[1]!) * 0.1, 0.2, 0.75);
      for (let t = 0; t < seg; t += w * 0.7) {
        const x = a[0] + ((b[0] - a[0]) * t) / seg,
          y = a[1] + ((b[1] - a[1]) * t) / seg;
        dab(x, y, ang + gauss(r) * 0.15, w * 1.8, w * 0.9, colorAt(B, lam));
      }
    }
  }
  // Körper: viele kurze Striche, die der Rundung folgen
  const bw = S * 0.024;
  const big = p.core.b.rx * p.core.b.ry;
  for (const o of p.bases) {
    const path = blobPath2D(o.base);
    const ocx = o.b.x * S,
      ocy = o.b.y * S,
      rx = o.b.rx * S,
      ry = o.b.ry * S,
      rot = o.b.rot || 0,
      c = Math.cos(-rot),
      s = Math.sin(-rot);
    const n = Math.round(((Math.PI * rx * ry) / (bw * bw)) * 2.2);
    // Untermalung: weicher Verlauf, damit zwischen den Strichen kein Grund durchscheint
    ctx.save();
    ctx.clip(path);
    const ug = ctx.createRadialGradient(ocx - rx * 0.35, ocy - ry * 0.4, 0, ocx, ocy, Math.max(rx, ry) * 1.5);
    ug.addColorStop(0, rgb(colorAt(o.b.leaf ? [70, 120, 60] : B, 0.9)));
    ug.addColorStop(1, rgb(colorAt(o.b.leaf ? [70, 120, 60] : B, 0.12)));
    ctx.fillStyle = ug;
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
    const subs = m.sec.map((id, i) => ({
      col: fromHsl(toHsl(PIG[id].rgb)[0], 0.6, 0.5),
      on: (i === 0 ? o !== p.core : o === p.core) || (p.bases.length === 1 && i === 0),
      u: gauss(r) * 0.25,
      v: gauss(r) * 0.25 + (i ? 0.3 : 0),
      rad: rr(r, 0.4, 0.65),
    }));
    for (let i = 0; i < n; i++) {
      const x = ocx + rr(r, -1, 1) * rx * 1.05,
        y = ocy + rr(r, -1, 1) * ry * 1.05;
      if (!ctx.isPointInPath(path, x, y)) continue;
      const lx = (x - ocx) * c - (y - ocy) * s,
        ly = (x - ocx) * s + (y - ocy) * c;
      const u = lx / rx,
        v = ly / ry;
      let col: C3 = o.b.leaf ? [70, 120, 60] : B;
      for (const sb of subs) if (sb.on && Math.hypot(u - sb.u, v - sb.v) < sb.rad) col = mixRGB(col, sb.col, 0.75);
      const tang = Math.atan2(u / ry, -v / rx) + rot + gauss(r) * 0.3;
      dab(x, y, tang, bw * rr(r, 1.2, 2.2), bw * rr(r, 0.7, 1.05), colorAt(col, lightAt(u * 0.95, v * 0.95)), 0.85);
    }
    // Kante: dunkle Striche auf der Schattenseite, Streiflicht oben links
    for (let i = 0; i < o.base.length; i += 3) {
      const q = o.base[i]!,
        q2 = o.base[(i + 1) % o.base.length]!;
      const ang = Math.atan2(q2[1] - q[1], q2[0] - q[0]);
      let nx = Math.sin(ang),
        ny = -Math.cos(ang);
      if (nx * (q[0] - ocx) + ny * (q[1] - ocy) < 0) {
        nx = -nx;
        ny = -ny;
      }
      const sh = nx * 0.6 + ny * 0.8;
      if (sh > 0.2) dab(q[0] - nx * bw * 0.35, q[1] - ny * bw * 0.35, ang, bw * 1.8, bw * 0.45, mixRGB(shade(B, 0.45), [40, 24, 14], 0.5), 0.2 + 0.35 * sh);
      else if (sh < -0.5) dab(q[0] - nx * bw * 0.5, q[1] - ny * bw * 0.5, ang, bw * 1.6, bw * 0.3, mixRGB(B, [255, 240, 210], 0.6), 0.45);
    }
    // pastose Lichter
    if (o.b.rx * o.b.ry > big * 0.25 && !o.b.leaf)
      for (let k = 0; k < 5; k++) {
        const x = ocx - rx * rr(r, 0.2, 0.45),
          y = ocy - ry * rr(r, 0.25, 0.5);
        if (!ctx.isPointInPath(path, x, y)) continue;
        dab(x, y, -0.5 + gauss(r) * 0.3, bw * rr(r, 1, 1.6), bw * rr(r, 0.45, 0.7), mixRGB(B, [255, 247, 228], 0.55), 0.8);
      }
  }
  // Zusatzformen und Gesicht, gemalt
  const faces = faceLayout(m, p, S);
  const ex = extrasOf(m, p, S, faces);
  for (const t of ex.tris) {
    const col: C3 = ex.horns ? [226, 210, 172] : shade(B, 0.8);
    ctx.fillStyle = rgb(shade(col, 0.7));
    triPath(ctx, t);
    ctx.fill();
    const steps = 5;
    for (let k = 0; k < steps; k++) {
      const f = k / steps;
      const ax = t[0]![0] + (t[2]![0] - t[0]![0]) * f,
        ay = t[0]![1] + (t[2]![1] - t[0]![1]) * f;
      const ang = Math.atan2(t[1]![1] - ay, t[1]![0] - ax),
        len = Math.hypot(t[1]![0] - ax, t[1]![1] - ay);
      dab(ax + Math.cos(ang) * len * 0.45, ay + Math.sin(ang) * len * 0.45, ang, len * 0.9, bw * 0.55, colorAt(col, 0.3 + f * 0.6));
    }
  }
  for (const a of ex.antennae) {
    ctx.strokeStyle = 'rgba(30,22,14,.9)';
    ctx.lineWidth = a.w;
    limbPath(ctx, a.path);
    ctx.stroke();
    dab(a.tip[0], a.tip[1], -0.6, a.r * 1.4, a.r * 1.6, colorAt(B, 0.7));
  }
  for (const f of faces) {
    for (const st of f.stalks) {
      ctx.strokeStyle = rgb(shade(B, 0.6));
      ctx.lineWidth = f.R * 0.08;
      limbPath(ctx, st);
      ctx.stroke();
    }
    for (const e of f.eyes) {
      if (e.kind === 'punkt') {
        dab(e.x, e.y, 0, e.r * 0.4, e.r * 2, [24, 16, 12]);
        ctx.fillStyle = 'rgba(255,248,230,.9)';
        ctx.beginPath();
        ctx.arc(e.x - e.r * 0.35, e.y - e.r * 0.4, e.r * 0.35, 0, 7);
        ctx.fill();
        continue;
      }
      const sq = e.kind === 'schlitz' ? 0.6 : 1;
      ctx.fillStyle = 'rgb(232,222,198)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.r, e.r * sq, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,26,16,.65)';
      ctx.lineWidth = e.r * 0.16;
      ctx.stroke();
      ctx.fillStyle = 'rgba(150,135,110,.5)';
      ctx.beginPath();
      ctx.ellipse(e.x + e.r * 0.15, e.y + e.r * 0.2 * sq, e.r * 0.8, e.r * 0.55 * sq, 0, 0, 7);
      ctx.fill();
      const ir = e.kind === 'zyklop' ? 0.55 : 0.48;
      ctx.fillStyle = e.kind === 'zyklop' ? rgb(shade(B, 0.7)) : 'rgb(28,18,12)';
      ctx.beginPath();
      if (e.kind === 'schlitz') ctx.ellipse(e.x + e.r * 0.1, e.y, e.r * 0.16, e.r * 0.5 * sq, 0, 0, 7);
      else ctx.arc(e.x + e.r * 0.12, e.y + e.r * 0.06, e.r * ir, 0, 7);
      ctx.fill();
      if (e.kind === 'zyklop') {
        ctx.fillStyle = 'rgb(20,14,10)';
        ctx.beginPath();
        ctx.arc(e.x + e.r * 0.12, e.y + e.r * 0.06, e.r * 0.25, 0, 7);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,250,236,.95)';
      ctx.beginPath();
      ctx.arc(e.x - e.r * 0.12, e.y - e.r * 0.2, e.r * 0.15, 0, 7);
      ctx.fill();
      if (e.kind === 'muede') {
        ctx.fillStyle = rgb(shade(B, 0.85));
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, e.r * 1.08, e.r * 1.08, 0, Math.PI, Math.PI * 2);
        ctx.fill();
      }
    }
    const { x, y, w, kind } = f.mouth;
    if (kind === 'schnabel') {
      ctx.fillStyle = 'rgb(196,130,40)';
      triPath(ctx, [
        [x - w * 0.6, y - w * 0.25],
        [x + w * 0.6, y - w * 0.25],
        [x, y + w * 0.7],
      ]);
      ctx.fill();
      dab(x - w * 0.1, y - w * 0.05, 0.3, w * 0.6, w * 0.15, [240, 200, 120]);
    } else if (kind === 'rohr') {
      ctx.fillStyle = 'rgb(30,16,12)';
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.28, w * 0.22, 0, 0, 7);
      ctx.fill();
    } else if (kind !== 'keiner') {
      ctx.strokeStyle = 'rgba(30,16,12,.9)';
      ctx.lineWidth = w * 0.16;
      ctx.beginPath();
      ctx.moveTo(x - w, y - w * 0.12);
      ctx.quadraticCurveTo(x, y + w * (kind === 'grinsen' ? 0.7 : 0.45), x + w, y - w * 0.12);
      ctx.stroke();
      if (kind === 'zaehne' || kind === 'grinsen')
        for (let k = -2; k <= 2; k++) {
          ctx.fillStyle = 'rgb(238,228,204)';
          ctx.fillRect(x + k * w * 0.32 - w * 0.08, y + w * 0.05 + (kind === 'grinsen' ? w * 0.18 : w * 0.1) * (1 - Math.abs(k) / 3), w * 0.16, w * 0.18);
        }
    }
  }
  for (const q of ex.freckles) dab(q[0], q[1], 0, S * 0.004, S * 0.007, shade(B, 0.45));

  // Leinwand und Firnis
  const [wc, w] = layer(16);
  w.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 16; i += 2) {
    w.fillRect(0, i, 16, 1);
    w.fillRect(i, 0, 1, 16);
  }
  w.fillStyle = 'rgba(0,0,0,.35)';
  for (let i = 1; i < 16; i += 4) w.fillRect(i, i, 2, 2);
  const pat = ctx.createPattern(wc, 'repeat')!;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
  const vg = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(8,4,0,.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, S, S);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = 'rgba(255,190,90,.25)';
  ctx.fillRect(0, 0, S, S);
  ctx.restore();

  if (!DECO) return;
  goldFrame(ctx, S, r);
  // Messingschild
  ctx.font = `${Math.round(S * 0.026)}px "Young Serif"`;
  const tw = ctx.measureText(plaque).width + S * 0.05;
  const px = S / 2 - tw / 2,
    py = S * 0.885,
    ph = S * 0.045;
  const pg = ctx.createLinearGradient(0, py, 0, py + ph);
  pg.addColorStop(0, '#f3dc94');
  pg.addColorStop(0.5, '#c79c3e');
  pg.addColorStop(1, '#8a6420');
  ctx.fillStyle = pg;
  ctx.fillRect(px, py, tw, ph);
  ctx.strokeStyle = 'rgba(60,40,10,.8)';
  ctx.lineWidth = S * 0.002;
  ctx.strokeRect(px, py, tw, ph);
  ctx.fillStyle = '#3c2808';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(plaque, S / 2, py + ph / 2 + S * 0.002);
  ctx.textBaseline = 'alphabetic';
}
function goldFrame(ctx: Ctx, S: number, r: Rand): void {
  const F = S * 0.06;
  const side = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, gx0: number, gy0: number, gx1: number, gy1: number) => {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, '#6e4e16');
    g.addColorStop(0.3, '#e8c76a');
    g.addColorStop(0.55, '#b8892e');
    g.addColorStop(0.8, '#f6dd8a');
    g.addColorStop(1, '#5c400f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
  };
  side(0, 0, S, 0, S - F, F, F, F, 0, 0, 0, F);
  side(0, S, S, S, S - F, S - F, F, S - F, 0, S, 0, S - F);
  side(0, 0, F, F, F, S - F, 0, S, 0, 0, F, 0);
  side(S, 0, S - F, F, S - F, S - F, S, S, S, 0, S - F, 0);
  ctx.strokeStyle = 'rgba(50,30,6,.85)';
  ctx.lineWidth = S * 0.003;
  ctx.strokeRect(F, F, S - 2 * F, S - 2 * F);
  ctx.strokeStyle = 'rgba(255,240,190,.6)';
  ctx.lineWidth = S * 0.0015;
  ctx.strokeRect(F * 0.45, F * 0.45, S - F * 0.9, S - F * 0.9);
  ctx.strokeStyle = 'rgba(60,40,8,.6)';
  ctx.strokeRect(F * 0.5, F * 0.5, S - F, S - F);
  // Perlstab
  ctx.fillStyle = 'rgba(255,236,170,.75)';
  const step = S * 0.022;
  for (let t = F; t < S - F; t += step) {
    for (const [x, y] of [
      [t, F * 0.75],
      [t, S - F * 0.75],
      [F * 0.75, t],
      [S - F * 0.75, t],
    ] as [number, number][]) {
      ctx.beginPath();
      ctx.arc(x, y, S * 0.0035, 0, 7);
      ctx.fill();
    }
  }
  void r;
}

/* ---------- Einstieg ---------- */
/**
 * Malt ein Shiny im Stil. deco: Rahmen, Texte und Schild (nur groß). Das Monster ist für jede Größe dasselbe.
 * Gibt die Malzeit in Millisekunden zurück.
 */
export function renderStyled(canvas: HTMLCanvasElement, m: Monster, style: StyleId, cssSize: number, opts: { dpr?: number; deco?: boolean } = {}): number {
  const t0 = performance.now();
  const dpr = opts.dpr ?? Math.min(2, window.devicePixelRatio || 1);
  const S = Math.max(200, Math.round(cssSize * dpr));
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  // Generation 2: keine Extras aus dem Prototyp
  const mm: Monster = m.gen === 2 ? { ...m, face: { ...m.face, extra: 'keins' } } : m;
  const serial = '#' + String(m.seed % 100000).padStart(5, '0');
  DECO = opts.deco ?? true;
  try {
    if (style === 'pencil') pencil(ctx, mm, S, `${m.name.toLowerCase()}, ${serial}`);
    else if (style === 'comic') comic(ctx, mm, S, `${m.name.toUpperCase()}!`);
    else if (style === 'plate') plate(ctx, mm, S);
    else if (style === 'anime') anime(ctx, mm, S);
    else oil(ctx, mm, S, `${m.name}  ${serial}`);
  } finally {
    DECO = true;
  }
  return performance.now() - t0;
}
