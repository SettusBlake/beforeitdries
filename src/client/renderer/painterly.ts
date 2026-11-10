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
/** Grobes Zufallsgitter für weiches Rauschen: nur dort ausgelesen, wo Farbe liegt (at) */
type Grid = { v: Float32Array; g: number; cell: number };
function grid(N: number, cell: number, r: Rand): Grid {
  const g = Math.ceil(N / cell) + 2,
    v = new Float32Array(g * g);
  for (let i = 0; i < v.length; i++) v[i] = r();
  return { v, g, cell };
}
function at(f: Grid, x: number, y: number): number {
  const fx = x / f.cell,
    fy = y / f.cell,
    x0 = fx | 0,
    y0 = fy | 0,
    tx = fx - x0,
    ty = fy - y0,
    sx = tx * tx * (3 - 2 * tx),
    sy = ty * ty * (3 - 2 * ty),
    i = y0 * f.g + x0;
  const a = f.v[i]!,
    b = f.v[i + 1]!,
    c = f.v[i + f.g]!,
    d = f.v[i + f.g + 1]!;
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
/** Zahn des Papiers: feines Korn über gröberen Wellen. Für alle Bilder gleich (dasselbe Papier), je Bildgröße einmal gerechnet */
const TOOTH = new Map<number, Float32Array>();
function tooth(N: number): Float32Array {
  let t = TOOTH.get(N);
  if (t) return t;
  const r = RNG(90210),
    a = grid(N, Math.max(1.6, N / 150), r),
    b = grid(N, Math.max(3, N / 60), r);
  t = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) t[y * N + x] = at(a, x, y) * 0.65 + at(b, x, y) * 0.35;
  if (TOOTH.size > 6) TOOTH.clear();
  TOOTH.set(N, t);
  return t;
}
/** Kastenfilter über ein Feld w × h, zweimal waagrecht und senkrecht (weich genug für Ränder). Überschreibt a, b ist Arbeitsfläche */
function blur(a: Float32Array, b: Float32Array, w: number, h: number, rad: number): void {
  const R = Math.max(1, Math.round(rad)),
    k = 1 / (2 * R + 1);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let s = 0;
      for (let x = -R; x <= R; x++) s += a[row + (x < 0 ? 0 : x >= w ? w - 1 : x)]!;
      for (let x = 0; x < w; x++) {
        b[row + x] = s * k;
        const xi = x + R + 1,
          xo = x - R;
        s += a[row + (xi >= w ? w - 1 : xi)]! - a[row + (xo < 0 ? 0 : xo)]!;
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = -R; y <= R; y++) s += b[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + x]!;
      for (let y = 0; y < h; y++) {
        a[y * w + x] = s * k;
        const yi = y + R + 1,
          yo = y - R;
        s += b[(yi >= h ? h - 1 : yi) * w + x]! - b[(yo < 0 ? 0 : yo) * w + x]!;
      }
    }
  }
}

export type Settle = {
  /** Körnung 0 bis 1: wie stark das Pigment in den Tälern des Papiers liegen bleibt (Pigment und Papier) */
  gran: number;
  /** Nässe 0 bis 1: mehr Pfützen und mehr weich auslaufende Kanten */
  wet: number;
  seed: number;
};

/* Tabellen statt Math.log und Math.exp je Bildpunkt: für Farbwerte von 0 bis 255 genau genug und um ein Vielfaches schneller */
const LMIN = Math.log(0.02);
/** ln(v) für Farbwerte 0 bis 255 */
const LN256 = new Float32Array(256);
for (let v = 0; v < 256; v++) LN256[v] = Math.log(Math.max(0.5, v));
/** exp(−x) für x von 0 bis 8 in Schritten von 1/256 */
const EXPN = new Float32Array(2050);
for (let i = 0; i < EXPN.length; i++) EXPN[i] = Math.exp(-i / 256);
const expn = (x: number): number => EXPN[x >= 8 ? 2048 : (x * 256 + 0.5) | 0]!;
/** ln(t) für Durchlässigkeit 0 bis 1, nach unten bei 0,02 begrenzt */
const LNT = new Float32Array(4097);
for (let i = 0; i < LNT.length; i++) LNT[i] = Math.log(Math.max(0.02, i / 4096));
const lnt = (t: number): number => LNT[t >= 1 ? 4096 : t <= 0 ? 0 : (t * 4096 + 0.5) | 0]!;

/**
 * Das Pigment setzt sich: rechnet aus dem gemalten Bild, wie viel Farbe wo liegt (gegen das leere Papier paper0, frei stehend
 * gegen den Papierton tone), und verteilt sie wie trocknende Aquarellfarbe. Frei stehend (ohne Papier) bleibt der Umriss, wie er ist.
 * Rechnet nur im Rechteck um die Farbe, weiche Hilfsfelder auf einem groben Raster, und gibt zwischen den Stufen ab (yield),
 * damit andere Bilder dazwischen malen können.
 */
export function* settleSteps(ctx: Ctx, N: number, paper0: ImageData | null, tone: readonly number[], o: Settle): Generator<void, void> {
  const img = ctx.getImageData(0, 0, N, N),
    d = img.data,
    p0 = paper0 ? paper0.data : null;
  // Wo liegt Farbe? Auf Papier: wo das Bild vom leeren Papier abweicht. Frei stehend: wo etwas gemalt ist
  let x0 = N,
    y0 = N,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < N; y++) {
    let k = y * N * 4,
      lo = -1,
      hi = -1;
    for (let x = 0; x < N; x++, k += 4) {
      const paint = p0 ? p0[k + 3]! >= 250 && (d[k] !== p0[k] || d[k + 1] !== p0[k + 1] || d[k + 2] !== p0[k + 2]) : d[k + 3]! > 1;
      if (!paint) continue;
      if (lo < 0) lo = x;
      hi = x;
    }
    if (lo < 0) continue;
    if (lo < x0) x0 = lo;
    if (hi > x1) x1 = hi;
    if (y < y0) y0 = y;
    y1 = y;
  }
  if (x1 < 0) return;
  const pad = Math.ceil(N * 0.05);
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(N - 1, x1 + pad);
  y1 = Math.min(N - 1, y1 + pad);
  const w = x1 - x0 + 1,
    h = y1 - y0 + 1,
    n = w * h;
  // Je Kanal der Logarithmus der Durchlässigkeit (0: Papier, negativ: Farbe) und die Pigmentdichte als ihr Mittel
  const L = new Float32Array(n * 3),
    D = new Float32Array(n);
  const t0 = tone[0]!,
    t1 = tone[1]!,
    t2 = tone[2]!;
  for (let y = 0; y < h; y++) {
    let k = ((y + y0) * N + x0) * 4,
      i = y * w;
    for (let x = 0; x < w; x++, k += 4, i++) {
      let a: number, b: number, c: number;
      if (p0) {
        if (p0[k + 3]! < 250 || (d[k] === p0[k] && d[k + 1] === p0[k + 1] && d[k + 2] === p0[k + 2])) continue;
        a = LN256[d[k]!]! - LN256[p0[k]!]!;
        b = LN256[d[k + 1]!]! - LN256[p0[k + 1]!]!;
        c = LN256[d[k + 2]!]! - LN256[p0[k + 2]!]!;
      } else {
        const al = d[k + 3]! / 255;
        if (al <= 0.004) continue;
        a = lnt((d[k]! * al + t0 * (1 - al)) / t0);
        b = lnt((d[k + 1]! * al + t1 * (1 - al)) / t1);
        c = lnt((d[k + 2]! * al + t2 * (1 - al)) / t2);
      }
      a = a > 0 ? 0 : a < LMIN ? LMIN : a;
      b = b > 0 ? 0 : b < LMIN ? LMIN : b;
      c = c > 0 ? 0 : c < LMIN ? LMIN : c;
      L[i * 3] = a;
      L[i * 3 + 1] = b;
      L[i * 3 + 2] = c;
      D[i] = -(a + b + c) / 3;
    }
  }
  yield;
  // Grobes Raster: alles Weiche (Hof der Dichte, verlaufene Farbe, Pfützen) braucht keine volle Auflösung
  const ds = Math.max(2, Math.round((N * 0.017) / 2.5)),
    rw = Math.ceil(w / ds),
    rh = Math.ceil(h / ds),
    rn = rw * rh;
  const cnt = new Float32Array(rn),
    wide = new Float32Array(rn),
    tmp = new Float32Array(rn);
  const soft = p0 ? [new Float32Array(rn), new Float32Array(rn), new Float32Array(rn)] : null;
  for (let y = 0; y < h; y++) {
    const ry = ((y / ds) | 0) * rw;
    for (let x = 0; x < w; x++) {
      const j = ry + ((x / ds) | 0),
        i = y * w + x;
      cnt[j]!++;
      const dens = D[i]!;
      if (dens <= 0) continue;
      wide[j]! += dens;
      if (soft) {
        // Abweichung vom Papier (Durchlässigkeit minus 1), das Papier selbst zählt als 0
        soft[0]![j]! += expn(-L[i * 3]!) - 1;
        soft[1]![j]! += expn(-L[i * 3 + 1]!) - 1;
        soft[2]![j]! += expn(-L[i * 3 + 2]!) - 1;
      }
    }
  }
  for (let j = 0; j < rn; j++) {
    const c = 1 / cnt[j]!;
    wide[j]! *= c;
    if (soft) {
      soft[0]![j] = 1 + soft[0]![j]! * c;
      soft[1]![j] = 1 + soft[1]![j]! * c;
      soft[2]![j] = 1 + soft[2]![j]! * c;
    }
  }
  // Breiter Hof der Dichte: für den breiten Rand, und dünne Glieder erkennt man daran (viel dichter als ihr Umkreis)
  blur(wide, tmp, rw, rh, (N * 0.04) / ds);
  if (soft) for (const f of soft) blur(f, tmp, rw, rh, (N * 0.017) / ds);
  const r = RNG(o.seed),
    poolG = grid(N, N / 5, r),
    lostG = grid(N, N / 3.2, r),
    th = tooth(N);
  // Pfützen und nasse Stellen auf dem groben Raster
  const cut = 0.66 - 0.22 * o.wet,
    pool = new Float32Array(rn),
    lost = new Float32Array(rn);
  for (let y = 0; y < rh; y++)
    for (let x = 0; x < rw; x++) {
      const j = y * rw + x,
        px = x0 + x * ds + ds / 2,
        py = y0 + y * ds + ds / 2;
      pool[j] = at(poolG, px, py);
      if (!soft || wide[j]! < 0.004) continue;
      const v = (at(lostG, px, py) - cut) / 0.16;
      lost[j] = v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v);
    }
  yield;
  // Nasse Kante: stellenweise läuft die Farbe weich aus (nur auf Papier, frei stehend bleibt der Umriss)
  const W = new Float32Array(n);
  if (soft) {
    const s0 = soft[0]!,
      s1 = soft[1]!,
      s2 = soft[2]!;
    for (let y = 0; y < h; y++) {
      const ry = ((y / ds) | 0) * rw;
      for (let x = 0; x < w; x++) {
        const j = ry + ((x / ds) | 0),
          v = lost[j]!;
        if (v <= 0) continue;
        const i = y * w + x,
          dens = D[i]!;
        // Dünne Glieder bleiben stehen: sie sind viel dichter als ihr Umkreis und würden sonst ganz verlaufen
        const thin = ((dens - wide[j]!) / (dens + 0.05) - 0.6) / 0.25;
        const wv = thin <= 0 ? v : thin >= 1 ? 0 : v * (1 - thin);
        if (wv <= 0) continue;
        W[i] = wv;
        const m = wv * 0.58,
          a = lnt(expn(-L[i * 3]!) * (1 - m) + s0[j]! * m),
          b = lnt(expn(-L[i * 3 + 1]!) * (1 - m) + s1[j]! * m),
          c = lnt(expn(-L[i * 3 + 2]!) * (1 - m) + s2[j]! * m);
        L[i * 3] = a;
        L[i * 3 + 1] = b;
        L[i * 3 + 2] = c;
        D[i] = -(a + b + c) / 3;
      }
    }
    yield;
  }
  // Feiner Saum: gegen die weichgezeichnete Dichte gemessen. Innen an einer Kante liegt mehr Pigment als im Umkreis.
  // Bei großen Bildern reicht dafür die halbe Auflösung
  const ns = N >= 364 ? 2 : 1,
    nw = Math.ceil(w / ns),
    nh = Math.ceil(h / ns);
  let near: Float32Array;
  if (ns === 1) near = D.slice();
  else {
    near = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) {
      const ya = Math.min(h - 1, y * 2) * w,
        yb = Math.min(h - 1, y * 2 + 1) * w;
      for (let x = 0; x < nw; x++) {
        const xa = Math.min(w - 1, x * 2),
          xb = Math.min(w - 1, x * 2 + 1);
        near[y * nw + x] = (D[ya + xa]! + D[ya + xb]! + D[yb + xa]! + D[yb + xb]!) * 0.25;
      }
    }
  }
  blur(near, new Float32Array(nw * nh), nw, nh, (N * 0.011) / ns);
  yield;
  const G = 0.1 + 0.42 * o.gran,
    P = 0.16 + 0.14 * o.wet;
  let done = 0;
  for (let y = 0; y < h; y++) {
    const ry = ((y / ds) | 0) * rw,
      ny = ((y / ns) | 0) * nw,
      ty = (y + y0) * N + x0;
    let k4 = ty * 4,
      i = y * w;
    for (let x = 0; x < w; x++, k4 += 4, i++) {
      const dens = D[i]!;
      if (dens < 0.006) continue;
      const al = p0 ? 1 : d[k4 + 3]! / 255;
      if (al <= 0.004) continue;
      const j = ry + ((x / ds) | 0);
      // Feiner dunkler Saum direkt an der Kante, dazu ein breiterer Hof: die Fläche innen wird etwas heller
      const e1 = (dens - near[ny + ((x / ns) | 0)]!) / (dens + 0.05),
        e2 = (dens - wide[j]!) / (dens + 0.05);
      let k = 0.84 + (1.5 * (e1 > 0 ? e1 : 0) + 0.55 * (e2 > 0 ? e2 : 0)) * (1 - W[i]! * 0.9);
      // Körnung: am stärksten in mittleren Tönen, in ganz dunkler Farbe geht sie unter
      const mid = (dens > 0.4545 ? 1 : dens * 2.2) * (1 - (dens > 2 ? 0.7 : dens * 0.35));
      k *= 1 + G * (th[ty + x]! - 0.5) * 2 * mid;
      k *= 1 + P * (pool[j]! - 0.5) * 2;
      if (k < 0.3) k = 0.3;
      const a = expn(-k * L[i * 3]!),
        b = expn(-k * L[i * 3 + 1]!),
        c = expn(-k * L[i * 3 + 2]!);
      if (p0) {
        d[k4] = p0[k4]! * a;
        d[k4 + 1] = p0[k4 + 1]! * b;
        d[k4 + 2] = p0[k4 + 2]! * c;
      } else {
        // Zurück in die frei stehende Farbe: derselbe Ton, wie er auf dem Papierton aussähe
        const q = 1 - al;
        d[k4] = (t0 * a - t0 * q) / al;
        d[k4 + 1] = (t1 * b - t1 * q) / al;
        d[k4 + 2] = (t2 * c - t2 * q) / al;
      }
    }
    done += w;
    if (done > 90000) {
      done = 0;
      yield;
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
