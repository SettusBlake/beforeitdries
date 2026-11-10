/*
 * Entwurf „Gemälde“ (docs/entwuerfe/gemaelde-vorschlag.md, im Spiel aus): die Lasuren verhalten sich wie echte Aquarellfarbe.
 * - glazePath: eine Lasur als geschwungene Fläche mit klarer Kante (statt vieler dünner, gezackter Schichten)
 * - settle: Pigment setzt sich. Dunkler Rand, wo die Farbe trocknet, Körnung in den Tälern des Papiers, Pfützen,
 *   und stellenweise läuft die nasse Kante weich aus
 * - groundShadow, backWash: Schlagschatten und loser Grund hinter der Figur
 * Eigener Zufall, nur Aussehen. Diese Datei lädt nichts aus den anderen Renderer-Dateien (die laden sich gegenseitig).
 */
import { RNG, type Rand } from '../../shared/rng';

type Ctx = CanvasRenderingContext2D;
type Pt = readonly number[];
export type Box4 = readonly [number, number, number, number];

/** Geschlossene, geschwungene Lasurkante: jeder step-te Punkt, dazwischen Bögen */
export function glazePath(ctx: Ctx, pts: readonly Pt[], step = 2, dx = 0, dy = 0, begin = true): void {
  const q: Pt[] = [];
  for (let i = 0; i < pts.length; i += step) q.push(pts[i]!);
  const n = q.length;
  const mx = (a: Pt, b: Pt): number => (a[0]! + b[0]!) / 2 + dx,
    my = (a: Pt, b: Pt): number => (a[1]! + b[1]!) / 2 + dy;
  if (begin) ctx.beginPath();
  ctx.moveTo(mx(q[n - 1]!, q[0]!), my(q[n - 1]!, q[0]!));
  for (let i = 0; i < n; i++) {
    const a = q[i]!,
      b = q[(i + 1) % n]!;
    ctx.quadraticCurveTo(a[0]! + dx, a[1]! + dy, mx(a, b), my(a, b));
  }
  ctx.closePath();
}
/**
 * Schattenlasur: die Form noch einmal dunkler, aber nur als Sichel unten rechts (Licht von oben links).
 * Die Kante der Sichel folgt der Form, wie eine zweite Lasur über der getrockneten ersten
 */
export function formShadow(ctx: Ctx, pts: readonly Pt[], S: number, rgb: readonly number[], alpha: number): void {
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const p of pts) {
    x0 = Math.min(x0, p[0]!);
    y0 = Math.min(y0, p[1]!);
    x1 = Math.max(x1, p[0]!);
    y1 = Math.max(y1, p[1]!);
  }
  const off = Math.max(S * 0.012, Math.min(x1 - x0, y1 - y0) * 0.16);
  ctx.save();
  glazePath(ctx, pts);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(0, 0, S, S);
  glazePath(ctx, pts, 2, -off * 0.8, -off, false);
  ctx.fillStyle = `rgba(${rgb.join(',')},${alpha})`;
  ctx.fill('evenodd');
  ctx.restore();
}

/** Deckkraft einer Lasur, die cnt dünne Schichten ersetzt */
export const glazeAlpha = (alpha: number, cnt: number): number => 1 - Math.pow(1 - alpha, cnt);

/* ---------- Felder ---------- */
/** Weiches Rauschen 0 bis 1 in Zellen der Größe cell */
function field(N: number, cell: number, r: Rand): Float32Array {
  const g = Math.ceil(N / cell) + 2,
    v = new Float32Array(g * g),
    out = new Float32Array(N * N);
  for (let i = 0; i < v.length; i++) v[i] = r();
  for (let y = 0; y < N; y++) {
    const fy = y / cell,
      y0 = Math.floor(fy),
      ty = fy - y0,
      sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < N; x++) {
      const fx = x / cell,
        x0 = Math.floor(fx),
        tx = fx - x0,
        sx = tx * tx * (3 - 2 * tx);
      const a = v[y0 * g + x0]!,
        b = v[y0 * g + x0 + 1]!,
        c = v[(y0 + 1) * g + x0]!,
        d = v[(y0 + 1) * g + x0 + 1]!;
      out[y * N + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
  }
  return out;
}
/** Zahn des Papiers: feines Korn über gröberen Wellen. Für alle Bilder gleich (dasselbe Papier), je Bildgröße einmal gerechnet */
const TOOTH = new Map<number, Float32Array>();
function tooth(N: number): Float32Array {
  let t = TOOTH.get(N);
  if (t) return t;
  const r = RNG(90210),
    a = field(N, Math.max(1.6, N / 150), r),
    b = field(N, Math.max(3, N / 60), r);
  t = new Float32Array(N * N);
  for (let i = 0; i < t.length; i++) t[i] = a[i]! * 0.65 + b[i]! * 0.35;
  if (TOOTH.size > 6) TOOTH.clear();
  TOOTH.set(N, t);
  return t;
}
/** Kastenfilter, zweimal waagrecht und senkrecht (weich genug für Ränder). step: Abstand der Werte in src (Kanäle) */
function blur(src: Float32Array, N: number, rad: number, step = 1, off = 0): Float32Array {
  const R = Math.max(1, Math.round(rad)),
    w = 2 * R + 1;
  const a = new Float32Array(N * N),
    b = new Float32Array(N * N);
  for (let i = 0; i < a.length; i++) a[i] = src[i * step + off]!;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < N; y++) {
      const row = y * N;
      let s = 0;
      for (let x = -R; x <= R; x++) s += a[row + Math.min(N - 1, Math.max(0, x))]!;
      for (let x = 0; x < N; x++) {
        b[row + x] = s / w;
        s += a[row + Math.min(N - 1, x + R + 1)]! - a[row + Math.max(0, x - R)]!;
      }
    }
    for (let x = 0; x < N; x++) {
      let s = 0;
      for (let y = -R; y <= R; y++) s += b[Math.min(N - 1, Math.max(0, y)) * N + x]!;
      for (let y = 0; y < N; y++) {
        a[y * N + x] = s / w;
        s += b[Math.min(N - 1, y + R + 1) * N + x]! - b[Math.max(0, y - R) * N + x]!;
      }
    }
  }
  return a;
}

export type Settle = {
  /** Körnung 0 bis 1: wie stark das Pigment in den Tälern des Papiers liegen bleibt (Pigment und Papier) */
  gran: number;
  /** Nässe 0 bis 1: mehr Pfützen und mehr weich auslaufende Kanten */
  wet: number;
  seed: number;
};

/**
 * Das Pigment setzt sich: rechnet aus dem gemalten Bild, wie viel Farbe wo liegt (gegen das leere Papier paper0, frei stehend
 * gegen den Papierton tone), und verteilt sie wie trocknende Aquarellfarbe. Frei stehend (ohne Papier) bleibt der Umriss, wie er ist.
 */
export function settle(ctx: Ctx, N: number, paper0: ImageData | null, tone: readonly number[], o: Settle): void {
  const img = ctx.getImageData(0, 0, N, N),
    d = img.data,
    p0 = paper0 ? paper0.data : null,
    n = N * N;
  const T = new Float32Array(n * 3),
    D = new Float32Array(n);
  let any = false;
  for (let i = 0; i < n; i++) {
    const k = i * 4;
    for (let c = 0; c < 3; c++) {
      let t: number;
      if (p0) t = p0[k + 3]! < 250 ? 1 : d[k + c]! / Math.max(1, p0[k + c]!);
      else {
        const a = d[k + 3]! / 255;
        t = (d[k + c]! * a + tone[c]! * (1 - a)) / tone[c]!;
      }
      T[i * 3 + c] = t < 0.02 ? 0.02 : t > 1 ? 1 : t;
    }
    const dens = -Math.log((T[i * 3]! + T[i * 3 + 1]! + T[i * 3 + 2]!) / 3);
    D[i] = dens;
    if (dens > 0.02) any = true;
  }
  if (!any) return;
  const r = RNG(o.seed),
    th = tooth(N),
    pool = field(N, N / 5, r),
    lost = field(N, N / 3.2, r);
  // Nasse Kante: stellenweise läuft die Farbe weich aus (nur auf Papier, frei stehend bleibt der Umriss)
  const soft = p0 ? [0, 1, 2].map((c) => blur(T, N, N * 0.017, 3, c)) : null;
  const cut = 0.66 - 0.22 * o.wet;
  const W = new Float32Array(n);
  if (soft)
    for (let i = 0; i < n; i++) {
      const w = (lost[i]! - cut) / 0.16;
      W[i] = w <= 0 ? 0 : w >= 1 ? 1 : w * w * (3 - 2 * w);
      if (W[i]! > 0) {
        const w1 = W[i]! * 0.58;
        for (let c = 0; c < 3; c++) T[i * 3 + c] = T[i * 3 + c]! * (1 - w1) + soft[c]![i]! * w1;
        D[i] = -Math.log((T[i * 3]! + T[i * 3 + 1]! + T[i * 3 + 2]!) / 3);
      }
    }
  // Rand: gegen die weichgezeichnete Dichte gemessen. Innen an einer Kante liegt mehr Pigment als im Umkreis
  const near = blur(D, N, N * 0.011),
    wide = blur(D, N, N * 0.04);
  const G = 0.1 + 0.42 * o.gran,
    P = 0.16 + 0.14 * o.wet;
  for (let i = 0; i < n; i++) {
    const dens = D[i]!;
    if (dens < 0.012) {
      // Sauberes Papier (oder frei): nur wo weich ausgelaufen ist, kommt Farbe dazu
      if (!(W[i]! > 0) || !p0) continue;
    }
    const k4 = i * 4;
    const a = p0 ? 1 : d[k4 + 3]! / 255;
    if (!p0 && a <= 0.004) continue;
    // Feiner dunkler Saum direkt an der Kante, dazu ein breiterer Hof: die Fläche innen wird etwas heller
    const e1 = Math.max(0, (dens - near[i]!) / (dens + 0.05)),
      e2 = Math.max(0, (dens - wide[i]!) / (dens + 0.05));
    const hard = 1 - W[i]! * 0.9;
    let k = 0.84 + (1.5 * e1 + 0.55 * e2) * hard;
    // Körnung: am stärksten in mittleren Tönen, in ganz dunkler Farbe geht sie unter
    const mid = Math.min(1, dens * 2.2) * (1 - Math.min(0.7, dens * 0.35));
    k *= 1 + G * (th[i]! - 0.5) * 2 * mid;
    k *= 1 + P * (pool[i]! - 0.5) * 2;
    if (k < 0.3) k = 0.3;
    for (let c = 0; c < 3; c++) {
      const t = Math.pow(T[i * 3 + c]!, k);
      if (p0) d[k4 + c] = Math.round(p0[k4 + c]! * t);
      else {
        const v = (tone[c]! * t - tone[c]! * (1 - a)) / a;
        d[k4 + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------- Schatten und Grund ---------- */
/** Unregelmäßiger Fleck um (x, y): Punkte für glazePath */
function blot(x: number, y: number, rx: number, ry: number, r: Rand, rough: number, n = 26): [number, number][] {
  const out: [number, number][] = [];
  let w = 1;
  for (let i = 0; i < n; i++) {
    w = w * 0.55 + (1 + (r() - 0.5) * 2 * rough) * 0.45;
    const a = (i / n) * Math.PI * 2;
    out.push([x + Math.cos(a) * rx * w, y + Math.sin(a) * ry * w]);
  }
  return out;
}
/** Schlagschatten unter der Figur: kühle, nasse Lasur auf dem Papier, zwei Schichten */
export function groundShadow(ctx: Ctx, box: Box4, S: number, r: Rand, rgb: readonly number[] = [92, 100, 138]): void {
  const w = box[2] - box[0],
    x = (box[0] + box[2]) / 2 + w * 0.04,
    y = Math.min(S * 0.965, box[3] + S * 0.004);
  for (let k = 0; k < 2; k++) {
    ctx.fillStyle = `rgba(${rgb.join(',')},${k ? 0.2 : 0.16})`;
    glazePath(ctx, blot(x + (r() - 0.5) * w * 0.05, y, w * (k ? 0.36 : 0.5), Math.max(S * 0.016, w * (k ? 0.035 : 0.055)), r, 0.22), 1);
    ctx.fill();
  }
}
/** Loser Grund hinter der Figur: zwei große, helle Lasuren mit sichtbarer Kante, wie mit breitem Pinsel angelegt */
export function backWash(ctx: Ctx, box: Box4, S: number, r: Rand, rgb: readonly number[]): void {
  const w = box[2] - box[0],
    h = box[3] - box[1],
    x = (box[0] + box[2]) / 2,
    y = (box[1] + box[3]) / 2;
  for (let k = 0; k < 2; k++) {
    ctx.fillStyle = `rgba(${rgb.join(',')},${k ? 0.085 : 0.075})`;
    const rx = Math.min(S * 0.47, w * (k ? 0.5 : 0.66) + S * 0.05),
      ry = Math.min(S * 0.45, h * (k ? 0.46 : 0.6) + S * 0.05);
    glazePath(ctx, blot(Math.min(S - rx - 2, Math.max(rx + 2, x + (r() - 0.5) * w * 0.3)), Math.min(S - ry - 2, Math.max(ry + 2, y + (r() - 0.5) * h * 0.25)), rx, ry, r, 0.42), 1);
    ctx.fill();
  }
}
