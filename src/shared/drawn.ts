/*
 * Selbst gemalte Monster (Entwurf, noch nicht im Spiel): Striche vom Finger werden Formen für den Aquarell-Renderer.
 * Geschlossene Striche werden Farbflächen, offene Striche Linien (Beine, Schwanz, Schnurrhaare, Fühler).
 * Gespeichert werden nur die vereinfachten Striche, nie ein Bild. Alles hier ist reine Rechnung ohne Zufall,
 * damit Server und Client aus denselben Strichen dieselbe Form bekommen.
 */
import type { BlobShape, FaceSpot, Geometry, Limb, Pt } from './data';

export type Drawing = {
  strokes: Pt[][];
  /** Rorschach: alles wird an der senkrechten Mitte gespiegelt */
  mirror: boolean;
  /** Wohin das Gesicht soll (angetippt), sonst sucht das Spiel selbst */
  face: Pt | null;
};

export const DRAW = {
  maxStrokes: 24,
  /** Punkte je Strich nach dem Vereinfachen */
  maxPts: 48,
  /** Ende so nah am Anfang (oder closeK der Strichlänge): der Strich gilt als geschlossen */
  close: 0.1,
  closeK: 0.15,
  /** So nah an der Mitte: der Strich schließt sich beim Spiegeln mit seinem Spiegelbild (großzügig, mit dem Finger trifft man die Linie selten) */
  axis: 0.1,
  /** Pinselbreite der offenen Striche */
  line: 0.016,
  /** So groß wird die Zeichnung auf der Karte */
  size: 0.78,
};

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const strokeLen = (s: Pt[]) => s.reduce((t, p, i) => (i ? t + dist(s[i - 1]!, p) : 0), 0);

/** Ramer-Douglas-Peucker: wirft Punkte weg, die kaum etwas am Strich ändern */
export function simplify(s: Pt[], eps = 0.004): Pt[] {
  if (s.length < 3) return s.slice();
  const a = s[0]!,
    b = s[s.length - 1]!;
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = Math.hypot(dx, dy) || 1e-9;
  let k = 0,
    best = -1;
  for (let i = 1; i < s.length - 1; i++) {
    const p = s[i]!;
    const d = L < 1e-6 ? dist(p, a) : Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / L;
    if (d > best) {
      best = d;
      k = i;
    }
  }
  if (best <= eps) return [a, b];
  const left = simplify(s.slice(0, k + 1), eps),
    right = simplify(s.slice(k), eps);
  return [...left.slice(0, -1), ...right];
}

/** Höchstens n Punkte, gleichmäßig entlang des Strichs */
export function resample(s: Pt[], n: number): Pt[] {
  if (s.length <= n) return s.slice();
  const L = strokeLen(s),
    out: Pt[] = [s[0]!];
  let seg = 0,
    acc = 0;
  for (let k = 1; k < n - 1; k++) {
    const want = (L * k) / (n - 1);
    while (seg < s.length - 2 && acc + dist(s[seg]!, s[seg + 1]!) < want) acc += dist(s[seg]!, s[++seg]!);
    const a = s[seg]!,
      b = s[seg + 1]!,
      d = dist(a, b) || 1e-9,
      t = clamp((want - acc) / d, 0, 1);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  out.push(s[s.length - 1]!);
  return out;
}

const mirrorPt = (p: Pt): Pt => [1 - p[0], p[1]];
function area(p: Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i]!,
      r = p[(i + 1) % p.length]!;
    a += q[0] * r[1] - r[0] * q[1];
  }
  return Math.abs(a) / 2;
}
function box(p: Pt[]): [number, number, number, number] {
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const [x, y] of p) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}
function inside(p: Pt, poly: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!,
      b = poly[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

export type Part = { pts: Pt[]; closed: boolean };

/** Alle Teile nach dem Spiegeln, in Zeichenreihenfolge */
export function parts(d: Drawing): Part[] {
  const out: Part[] = [];
  for (const raw of d.strokes.slice(0, DRAW.maxStrokes)) {
    const s = resample(simplify(raw), DRAW.maxPts);
    if (s.length < 2) continue;
    const a = s[0]!,
      b = s[s.length - 1]!,
      L = strokeLen(s);
    if (d.mirror && L > 0.1 && Math.abs(a[0] - 0.5) < DRAW.axis && Math.abs(b[0] - 0.5) < DRAW.axis) {
      // Halbe Form, die an der Mitte beginnt und endet: mit dem Spiegelbild eine Fläche
      out.push({ pts: [...s, ...s.slice(1, -1).reverse().map(mirrorPt)], closed: true });
      continue;
    }
    const closed = L > 0.12 && dist(a, b) < Math.max(DRAW.close, L * DRAW.closeK);
    out.push({ pts: closed ? s.slice(0, -1) : s, closed });
    // Teile, die über der Mitte liegen, haben ihr Spiegelbild schon in sich
    const [x0, , x1] = box(s);
    if (d.mirror && !(x0 < 0.5 && x1 > 0.5 && Math.abs((x0 + x1) / 2 - 0.5) < DRAW.axis)) out.push({ pts: (closed ? s.slice(0, -1) : s).map(mirrorPt), closed });
  }
  return out;
}

/** Geometrie für den Renderer: Flächen als Vielecke mit Tuschekontur, offene Striche als Pinsellinien */
export function drawnGeometry(d: Drawing): Geometry {
  const ps = parts(d);
  const blobs: BlobShape[] = [],
    limbs: Limb[] = [];
  for (const p of ps) {
    if (p.closed && p.pts.length >= 3) {
      const [x0, y0, x1, y1] = box(p.pts);
      blobs.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, rx: Math.max((x1 - x0) / 2, 0.01), ry: Math.max((y1 - y0) / 2, 0.01), rot: 0, pts: p.pts, crisp: 0.55, ink: true });
    } else limbs.push({ pts: p.pts, w: DRAW.line });
  }
  // Ohne Fläche kein Aquarell: der längste Strich wird zur Fläche
  if (!blobs.length && limbs.length) {
    const i = limbs.reduce((k, l, j) => (strokeLen(l.pts) > strokeLen(limbs[k]!.pts) ? j : k), 0);
    const [l] = limbs.splice(i, 1);
    const [x0, y0, x1, y1] = box(l!.pts);
    blobs.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, rx: Math.max((x1 - x0) / 2, 0.03), ry: Math.max((y1 - y0) / 2, 0.03), rot: 0, pts: l!.pts, crisp: 0.55, ink: true });
  }
  if (!blobs.length) blobs.push({ x: 0.5, y: 0.53, rx: 0.2, ry: 0.2, rot: 0 });
  const faces: FaceSpot[] = [faceFor(blobs, d.face)];

  // Auf die Karte bringen: mittig und immer gleich groß, egal wie klein oder schief gezeichnet
  const all = [...blobs.flatMap((b) => b.pts ?? [[b.x - b.rx, b.y - b.ry] as Pt, [b.x + b.rx, b.y + b.ry] as Pt]), ...limbs.flatMap((l) => l.pts)];
  const [x0, y0, x1, y1] = box(all);
  const k = DRAW.size / Math.max(x1 - x0, y1 - y0, 0.05),
    mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2;
  const f = (p: Pt): Pt => [0.5 + (p[0] - mx) * k, 0.53 + (p[1] - my) * k];
  for (const b of blobs) {
    [b.x, b.y] = f([b.x, b.y]);
    b.rx *= k;
    b.ry *= k;
    if (b.pts) b.pts = b.pts.map(f);
  }
  for (const l of limbs) l.pts = l.pts.map(f);
  for (const fc of faces) {
    [fc.x, fc.y] = f([fc.x, fc.y]);
    fc.r *= k;
  }
  // Kleine Teile mit weniger Schichten, wie bei den neuen Formen
  const big = Math.max(...blobs.map((b) => b.rx * b.ry));
  for (const b of blobs) if (b.rx * b.ry < big * 0.12) b.few = true;
  return { blobs, limbs, faces, top: [] };
}

/** Gesicht dorthin, wo getippt wurde, sonst auf die oberste große Fläche */
function faceFor(blobs: BlobShape[], tap: Pt | null): FaceSpot {
  const size = (b: BlobShape) => (b.pts ? area(b.pts) : Math.PI * b.rx * b.ry);
  const rOf = (b: BlobShape) => clamp(Math.min(b.rx, b.ry) * 0.55, 0.025, 0.09);
  if (tap) {
    const hit = blobs.filter((b) => b.pts && inside(tap, b.pts)).sort((a, b) => size(a) - size(b))[0];
    return { x: tap[0], y: tap[1], r: hit ? rOf(hit) : 0.045 };
  }
  const big = Math.max(...blobs.map(size));
  const b = blobs.filter((x) => size(x) >= big * 0.25).sort((p, q) => p.y - p.ry - (q.y - q.ry))[0] ?? blobs[0]!;
  return { x: b.x, y: b.y - b.ry * 0.15, r: rOf(b) };
}

/* ---------- Speichern: 12 Bit je Koordinate, zwei Zeichen ---------- */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const enc = (v: number) => {
  const n = clamp(Math.round(v * 4095), 0, 4095);
  return B64[n >> 6]! + B64[n & 63]!;
};
const dec = (s: string, i: number) => {
  const a = B64.indexOf(s[i]!),
    b = B64.indexOf(s[i + 1]!);
  return a < 0 || b < 0 ? NaN : ((a << 6) | b) / 4095;
};

/** Kurzer Text: Spiegeln, Gesicht, dann die Striche durch Punkte getrennt */
export function encodeDrawing(d: Drawing): string {
  const pt = (p: Pt) => enc(p[0]) + enc(p[1]);
  const strokes = d.strokes.slice(0, DRAW.maxStrokes).map((s) => resample(simplify(s), DRAW.maxPts).map(pt).join(''));
  return (d.mirror ? 'm' : 'n') + (d.face ? pt(d.face) : '') + '.' + strokes.join('.');
}

/** Zurück aus dem Text. Prüft Grenzen und gibt bei allem Kaputten null */
export function decodeDrawing(code: string): Drawing | null {
  if (typeof code !== 'string' || code.length > 24 * 48 * 4 + 64) return null;
  const [head, ...rest] = code.split('.');
  if (!head || (head[0] !== 'm' && head[0] !== 'n') || (head.length !== 1 && head.length !== 5)) return null;
  const pts = (s: string): Pt[] | null => {
    if (s.length % 4) return null;
    const out: Pt[] = [];
    for (let i = 0; i < s.length; i += 4) {
      const p: Pt = [dec(s, i), dec(s, i + 2)];
      if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
      out.push(p);
    }
    return out;
  };
  const face = head.length === 5 ? pts(head.slice(1)) : [];
  if (!face) return null;
  const strokes: Pt[][] = [];
  for (const s of rest) {
    const p = pts(s);
    if (!p || p.length < 2 || p.length > DRAW.maxPts) return null;
    strokes.push(p);
  }
  if (!strokes.length || strokes.length > DRAW.maxStrokes) return null;
  return { mirror: head[0] === 'm', face: face[0] ?? null, strokes };
}

/** Mindestens eine Fläche? Sonst sagt Sepia, dass die Farbe nirgends stehen kann */
export const hasShape = (d: Drawing): boolean => parts(d).some((p) => p.closed);
