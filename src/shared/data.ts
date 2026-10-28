/* Spieldaten aus dem Prototyp. Reihenfolge der Listen nicht ändern: der Zufall wählt per Index. */
import { lerp, ri, rr, type Rand } from './rng';

export type StatKey = 'deckkraft' | 'saettigung' | 'koernung' | 'fluss' | 'leuchten' | 'lichtecht';
export type StatMap = Record<StatKey, number>;

export interface StatDef {
  k: StatKey;
  n: string;
  short: string;
  s: string;
}

export const STATS: readonly StatDef[] = [
  { k: 'deckkraft', n: 'Opacity', short: 'OPA', s: 'Health' },
  { k: 'saettigung', n: 'Saturation', short: 'SAT', s: 'Attack' },
  { k: 'koernung', n: 'Grain', short: 'GRN', s: 'Defense' },
  { k: 'fluss', n: 'Flow', short: 'FLO', s: 'Speed' },
  { k: 'leuchten', n: 'Glow', short: 'GLW', s: 'Special' },
  { k: 'lichtecht', n: 'Lightfastness', short: 'LFT', s: 'Durability' },
];
export const STAT_KEYS: readonly StatKey[] = STATS.map((s) => s.k);
export const BAR_MAX = 70;

/* ---------- Pigmente: echte Eigenschaften als Regeln ---------- */
export type PigmentId = 'ultra' | 'phthalo' | 'karmin' | 'kadmium' | 'siena' | 'indigo' | 'sepia' | 'opera';
export type RGB = readonly [number, number, number];

export interface Pigment {
  id: PigmentId;
  n: string;
  rgb: RGB;
  hue: number;
  gran: number;
  stat: Partial<StatMap>;
  staining?: boolean;
  fugitive?: boolean;
  note: string;
}

export const PIGMENTS: readonly Pigment[] = [
  { id: 'ultra', n: 'Ultramarine', rgb: [43, 63, 163], hue: 240, gran: 0.9, stat: { koernung: 7 }, note: 'granulates' },
  { id: 'phthalo', n: 'Phthalo Green', rgb: [12, 108, 92], hue: 180, gran: 0.05, stat: { saettigung: 3, leuchten: 3 }, staining: true, note: 'stains for good' },
  { id: 'karmin', n: 'Carmine', rgb: [176, 30, 62], hue: 0, gran: 0.1, stat: { saettigung: 7 }, note: 'strong, transparent' },
  { id: 'kadmium', n: 'Cadmium Yellow', rgb: [240, 172, 12], hue: 120, gran: 0.05, stat: { deckkraft: 7 }, note: 'fairly opaque' },
  { id: 'siena', n: 'Burnt Sienna', rgb: [166, 84, 40], hue: 55, gran: 0.6, stat: { deckkraft: 3, saettigung: 2, koernung: 2 }, note: 'mixes with anything' },
  { id: 'indigo', n: 'Indigo', rgb: [44, 52, 92], hue: 250, gran: 0.25, stat: { leuchten: 7 }, note: 'deep, cool' },
  { id: 'sepia', n: 'Sepia', rgb: [92, 66, 48], hue: 40, gran: 0.35, stat: { lichtecht: 5, deckkraft: 2 }, note: 'cuttlefish ink' },
  { id: 'opera', n: 'Opera Rose', rgb: [232, 62, 128], hue: 320, gran: 0, stat: { saettigung: 5, leuchten: 6, lichtecht: -5 }, fugitive: true, note: 'fades' },
];
export const PIG = Object.fromEntries(PIGMENTS.map((p) => [p.id, p])) as Record<PigmentId, Pigment>;
export const css = (c: RGB): string => `rgb(${c[0]},${c[1]},${c[2]})`;

/* ---------- Papier = Seltenheit ---------- */
export type PaperId = 'schul' | 'zeichen' | 'buetten' | 'hadern';

export interface Paper {
  id: PaperId;
  n: string;
  w: number;
  pips: number;
  cap: number;
  bonus: number;
  tone: RGB;
  grain: number;
  deckle: boolean;
  fibers: boolean;
}

export const PAPERS: readonly Paper[] = [
  { id: 'schul', n: 'Student Paper', w: 50, pips: 1, cap: 45, bonus: 0, tone: [247, 246, 241], grain: 0.45, deckle: false, fibers: false },
  { id: 'zeichen', n: 'Drawing Paper', w: 30, pips: 2, cap: 52, bonus: 1, tone: [245, 243, 236], grain: 0.65, deckle: false, fibers: false },
  { id: 'buetten', n: 'Handmade Paper', w: 15, pips: 3, cap: 60, bonus: 2, tone: [242, 238, 227], grain: 0.85, deckle: true, fibers: false },
  { id: 'hadern', n: 'Cotton Rag', w: 5, pips: 4, cap: 70, bonus: 4, tone: [239, 233, 217], grain: 1, deckle: true, fibers: true },
];
export const PAPER = Object.fromEntries(PAPERS.map((p) => [p.id, p])) as Record<PaperId, Paper>;

/* ---------- Baupläne: feste Silhouette, zufälliges Innenleben ---------- */
export interface BlobShape {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rot: number;
  wing?: boolean;
  leaf?: boolean;
}
export type Pt = [number, number];
export interface Limb {
  pts: Pt[];
  w: number;
}
export interface FaceSpot {
  x: number;
  y: number;
  r: number;
  stalks?: boolean;
  cyclops?: boolean;
}
export interface Geometry {
  blobs: BlobShape[];
  limbs: Limb[];
  faces: FaceSpot[];
  top: BlobShape[];
}

export type BlueprintId =
  | 'kriecher'
  | 'flatterer'
  | 'schwebeblase'
  | 'vierbeiner'
  | 'schlange'
  | 'turm'
  | 'krabbe'
  | 'qualle'
  | 'huepfer'
  | 'knolle'
  | 'strahler'
  | 'doppelkopf';

export interface Blueprint {
  id: BlueprintId;
  n: string;
  base: StatMap;
  build(r: Rand): Geometry;
}

function wavy(r: Rand, x0: number, y0: number, len: number, amp: number, n: number, dir?: number): Pt[] {
  const pts: Pt[] = [],
    ph = rr(r, 0, 6.28),
    fr = rr(r, 2, 4);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x0 + Math.sin(ph + t * fr) * amp * t + (dir || 0) * t * len * 0.3, y0 + t * len]);
  }
  return pts;
}

export const BAUPLAENE: readonly Blueprint[] = [
  {
    id: 'kriecher',
    n: 'Crawler',
    base: { deckkraft: 14, saettigung: 8, koernung: 12, fluss: 6, leuchten: 8, lichtecht: 10 },
    build(r) {
      const B = { x: 0.56, y: 0.62, rx: rr(r, 0.24, 0.31), ry: rr(r, 0.09, 0.13), rot: rr(r, -0.07, 0.07) };
      const hr = rr(r, 0.09, 0.13),
        H = { x: B.x - B.rx * 0.82, y: B.y - B.ry * 0.55, rx: hr, ry: hr * rr(r, 0.85, 1.05), rot: 0 };
      const limbs: Limb[] = [],
        n = ri(r, 5, 8);
      for (let i = 0; i < n; i++) {
        const x = B.x - B.rx * 0.55 + (B.rx * 1.35 * i) / (n - 1),
          y = B.y + B.ry * 0.75;
        limbs.push({ pts: [[x, y], [x + rr(r, -0.02, 0.015), y + rr(r, 0.05, 0.08)]], w: 0.013 });
      }
      limbs.push({ pts: [[B.x + B.rx * 0.95, B.y], [B.x + B.rx * 1.15, B.y - 0.04], [B.x + B.rx * 1.25, B.y - 0.02]], w: 0.016 });
      return { blobs: [B, H], limbs, faces: [{ x: H.x, y: H.y, r: hr }], top: [B, H] };
    },
  },
  {
    id: 'flatterer',
    n: 'Flutterer',
    base: { deckkraft: 8, saettigung: 10, koernung: 6, fluss: 16, leuchten: 10, lichtecht: 8 },
    build(r) {
      const B = { x: 0.5, y: 0.56, rx: rr(r, 0.1, 0.14), ry: rr(r, 0.14, 0.19), rot: 0 };
      const wy = rr(r, 0.4, 0.47),
        wrx = rr(r, 0.15, 0.2),
        wry = rr(r, 0.08, 0.12),
        wr = rr(r, 0.3, 0.7);
      const W1 = { x: 0.5 - B.rx - wrx * 0.7, y: wy, rx: wrx, ry: wry, rot: wr, wing: true },
        W2 = { x: 0.5 + B.rx + wrx * 0.7, y: wy, rx: wrx, ry: wry, rot: -wr, wing: true };
      const limbs: Limb[] = [-1, 1].map((s) => ({ pts: [[0.5 + s * B.rx * 0.4, B.y + B.ry * 0.9], [0.5 + s * B.rx * 0.5, B.y + B.ry + 0.06]], w: 0.012 }));
      return { blobs: [W1, W2, B], limbs, faces: [{ x: 0.5, y: B.y - B.ry * 0.35, r: B.rx * 0.95 }], top: [B] };
    },
  },
  {
    id: 'schwebeblase',
    n: 'Floater',
    base: { deckkraft: 10, saettigung: 6, koernung: 8, fluss: 10, leuchten: 16, lichtecht: 8 },
    build(r) {
      const R = rr(r, 0.18, 0.24),
        B = { x: 0.5, y: 0.42, rx: R, ry: R * rr(r, 0.88, 1.04), rot: 0 };
      const limbs: Limb[] = [],
        n = ri(r, 3, 6);
      for (let i = 0; i < n; i++) {
        const x = 0.5 - R * 0.65 + (R * 1.3 * i) / Math.max(1, n - 1);
        limbs.push({ pts: wavy(r, x, B.y + B.ry * 0.85, rr(r, 0.18, 0.3), 0.04, 8), w: 0.013 });
      }
      return { blobs: [B], limbs, faces: [{ x: 0.5, y: B.y - 0.01, r: R * 0.8 }], top: [B] };
    },
  },
  {
    id: 'vierbeiner',
    n: 'Quadruped',
    base: { deckkraft: 12, saettigung: 12, koernung: 10, fluss: 12, leuchten: 6, lichtecht: 8 },
    build(r) {
      const B = { x: 0.56, y: 0.55, rx: rr(r, 0.19, 0.24), ry: rr(r, 0.1, 0.13), rot: rr(r, -0.06, 0.06) };
      const hr = rr(r, 0.09, 0.12),
        H = { x: B.x - B.rx - hr * 0.3, y: B.y - B.ry - hr * 0.35, rx: hr, ry: hr * 0.95, rot: 0 };
      const N = { x: (B.x - B.rx * 0.8 + H.x) / 2, y: (B.y + H.y) / 2, rx: hr * 0.55, ry: hr * 0.7, rot: 0.6 };
      const legs = [-0.7, -0.3, 0.35, 0.72].map((f) => ({ x: B.x + f * B.rx, y: B.y + B.ry + 0.055, rx: rr(r, 0.026, 0.034), ry: rr(r, 0.07, 0.09), rot: rr(r, -0.12, 0.12) }));
      const limbs: Limb[] = [{ pts: [[B.x + B.rx * 0.95, B.y - 0.01], [B.x + B.rx * 1.2, B.y - 0.09], [B.x + B.rx * 1.32, B.y - 0.12]], w: 0.014 }];
      return { blobs: [B, N, H, ...legs], limbs, faces: [{ x: H.x, y: H.y, r: hr }], top: [H] };
    },
  },
  {
    id: 'schlange',
    n: 'Serpent',
    base: { deckkraft: 8, saettigung: 14, koernung: 8, fluss: 14, leuchten: 8, lichtecht: 8 },
    build(r) {
      const n = ri(r, 6, 8),
        ph = rr(r, 0, 6.28),
        amp = rr(r, 0.05, 0.1),
        blobs: BlobShape[] = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1),
          rad = lerp(0.105, 0.04, t);
        blobs.push({ x: 0.2 + 0.62 * t, y: 0.55 + Math.sin(ph + t * 5) * amp, rx: rad, ry: rad * 0.92, rot: 0 });
      }
      const h = blobs[0] as BlobShape;
      return { blobs: blobs.slice().reverse(), limbs: [], faces: [{ x: h.x, y: h.y, r: h.rx }], top: [h] };
    },
  },
  {
    id: 'turm',
    n: 'Tower',
    base: { deckkraft: 16, saettigung: 8, koernung: 14, fluss: 4, leuchten: 8, lichtecht: 10 },
    build(r) {
      const n = ri(r, 3, 4),
        blobs: BlobShape[] = [];
      let yb = 0.87;
      for (let i = 0; i < n; i++) {
        const rad = lerp(0.16, 0.085, i / (n - 1)) * rr(r, 0.92, 1.08),
          cy = yb - rad;
        blobs.push({ x: 0.5 + rr(r, -0.03, 0.03), y: cy, rx: rad, ry: rad * 0.88, rot: rr(r, -0.1, 0.1) });
        yb = cy - rad * 0.5;
      }
      const m = blobs[1] as BlobShape,
        t = blobs[n - 1] as BlobShape;
      const limbs: Limb[] = [-1, 1].map((s) => ({ pts: [[m.x + s * m.rx * 0.9, m.y], [m.x + s * (m.rx + 0.07), m.y - 0.04], [m.x + s * (m.rx + 0.11), m.y + 0.02]], w: 0.013 }));
      return { blobs, limbs, faces: [{ x: t.x, y: t.y, r: t.rx }], top: [t] };
    },
  },
  {
    id: 'krabbe',
    n: 'Crab',
    base: { deckkraft: 10, saettigung: 12, koernung: 16, fluss: 6, leuchten: 6, lichtecht: 10 },
    build(r) {
      const B = { x: 0.5, y: 0.6, rx: rr(r, 0.2, 0.25), ry: rr(r, 0.09, 0.12), rot: 0 };
      const cx = rr(r, 0.3, 0.35),
        cr = rr(r, 0.06, 0.08);
      const C = [-1, 1].map((s) => ({ x: 0.5 + s * cx, y: 0.37, rx: cr, ry: cr * 0.8, rot: s * 0.5 }));
      const limbs: Limb[] = [];
      C.forEach((c, i) => {
        const s = i ? 1 : -1;
        limbs.push({ pts: [[0.5 + s * B.rx * 0.8, B.y - B.ry * 0.3], [0.5 + s * (cx - 0.04), 0.47], [c.x, c.y + cr * 0.6]], w: 0.015 });
      });
      for (const s of [-1, 1])
        for (let k = 0; k < 3; k++) {
          const x = 0.5 + s * (B.rx * 0.45 + k * 0.05);
          limbs.push({ pts: [[x, B.y + B.ry * 0.6], [x + s * 0.06, B.y + B.ry + 0.03], [x + s * 0.08, B.y + B.ry + 0.09]], w: 0.01 });
        }
      return { blobs: [B, ...C], limbs, faces: [{ x: 0.5, y: B.y - 0.015, r: 0.085, stalks: true }], top: [B] };
    },
  },
  {
    id: 'qualle',
    n: 'Jelly',
    base: { deckkraft: 8, saettigung: 8, koernung: 6, fluss: 10, leuchten: 14, lichtecht: 12 },
    build(r) {
      const D = { x: 0.5, y: 0.37, rx: rr(r, 0.2, 0.25), ry: rr(r, 0.12, 0.16), rot: 0 },
        S = { x: 0.5, y: D.y + D.ry * 0.7, rx: D.rx * 0.92, ry: 0.045, rot: 0 };
      const limbs: Limb[] = [],
        n = ri(r, 5, 9);
      for (let i = 0; i < n; i++) {
        const x = 0.5 - D.rx * 0.75 + (D.rx * 1.5 * i) / (n - 1);
        limbs.push({ pts: wavy(r, x, S.y, rr(r, 0.26, 0.42), 0.035, 10), w: rr(r, 0.007, 0.012) });
      }
      return { blobs: [D, S], limbs, faces: [{ x: 0.5, y: D.y + 0.01, r: D.ry * 0.9 }], top: [D] };
    },
  },
  {
    id: 'huepfer',
    n: 'Hopper',
    base: { deckkraft: 10, saettigung: 10, koernung: 8, fluss: 16, leuchten: 8, lichtecht: 6 },
    build(r) {
      const B = { x: 0.5, y: 0.52, rx: rr(r, 0.13, 0.17), ry: rr(r, 0.17, 0.21), rot: 0 };
      const F = [-1, 1].map((s) => ({ x: 0.5 + s * B.rx * 0.65, y: B.y + B.ry * 0.92, rx: rr(r, 0.08, 0.1), ry: 0.05, rot: s * 0.15 }));
      const E = [-1, 1].map((s) => ({ x: 0.5 + s * B.rx * 0.4, y: B.y - B.ry - rr(r, 0.06, 0.1), rx: rr(r, 0.028, 0.036), ry: rr(r, 0.08, 0.12), rot: s * rr(r, 0.1, 0.35), wing: true }));
      return { blobs: [...E, B, ...F], limbs: [], faces: [{ x: 0.5, y: B.y - B.ry * 0.3, r: B.rx * 0.85 }], top: [] };
    },
  },
  {
    id: 'knolle',
    n: 'Tuber',
    base: { deckkraft: 16, saettigung: 6, koernung: 12, fluss: 6, leuchten: 8, lichtecht: 12 },
    build(r) {
      const B = { x: 0.5, y: 0.63, rx: rr(r, 0.18, 0.22), ry: rr(r, 0.15, 0.18), rot: rr(r, -0.1, 0.1) };
      const L = [-1, 1].map((s) => ({ x: 0.5 + s * B.rx * 0.75, y: B.y + B.ry * 0.35, rx: B.rx * 0.45, ry: B.ry * 0.5, rot: 0 }));
      const limbs: Limb[] = [],
        leaves: BlobShape[] = [],
        n = ri(r, 2, 4);
      for (let i = 0; i < n; i++) {
        const x = 0.5 + (i - (n - 1) / 2) * 0.07,
          y0 = B.y - B.ry * 0.9,
          y1 = y0 - rr(r, 0.08, 0.15),
          x1 = x + rr(r, -0.05, 0.05);
        limbs.push({ pts: [[x, y0], [x1, y1]], w: 0.008 });
        leaves.push({ x: x1, y: y1 - 0.02, rx: rr(r, 0.025, 0.04), ry: rr(r, 0.05, 0.07), rot: rr(r, -0.6, 0.6), leaf: true });
      }
      return { blobs: [...L, B, ...leaves], limbs, faces: [{ x: 0.5, y: B.y - B.ry * 0.1, r: B.rx * 0.85 }], top: [] };
    },
  },
  {
    id: 'strahler',
    n: 'Radiant',
    base: { deckkraft: 8, saettigung: 10, koernung: 8, fluss: 8, leuchten: 16, lichtecht: 8 },
    build(r) {
      const R = rr(r, 0.1, 0.13),
        C = { x: 0.5, y: 0.5, rx: R, ry: R, rot: 0 },
        n = ri(r, 5, 7),
        off = rr(r, 0, 6.28),
        arms: BlobShape[] = [];
      for (let i = 0; i < n; i++) {
        const a = off + (i * Math.PI * 2) / n,
          d = R + rr(r, 0.07, 0.1);
        arms.push({ x: 0.5 + Math.cos(a) * d, y: 0.5 + Math.sin(a) * d, rx: rr(r, 0.09, 0.12), ry: rr(r, 0.032, 0.048), rot: a });
      }
      return { blobs: [...arms, C], limbs: [], faces: [{ x: 0.5, y: 0.5, r: R, cyclops: true }], top: [] };
    },
  },
  {
    id: 'doppelkopf',
    n: 'Twinhead',
    base: { deckkraft: 12, saettigung: 14, koernung: 10, fluss: 8, leuchten: 10, lichtecht: 6 },
    build(r) {
      const B = { x: 0.5, y: 0.64, rx: rr(r, 0.17, 0.21), ry: rr(r, 0.13, 0.16), rot: 0 };
      const hx = rr(r, 0.12, 0.16),
        hy = rr(r, 0.33, 0.39);
      const H = [-1, 1].map((s) => {
        const hr = rr(r, 0.08, 0.105);
        return { x: 0.5 + s * hx, y: hy + rr(r, -0.02, 0.02), rx: hr, ry: hr * 0.95, rot: 0 };
      });
      const N = H.map((h) => ({ x: (h.x + 0.5) / 2, y: (h.y + B.y - B.ry * 0.5) / 2, rx: 0.04, ry: 0.07, rot: h.x < 0.5 ? 0.5 : -0.5 }));
      const limbs: Limb[] = [-1, 1].map((s) => ({ pts: [[0.5 + s * B.rx * 0.5, B.y + B.ry * 0.85], [0.5 + s * B.rx * 0.6, B.y + B.ry + 0.07]], w: 0.016 }));
      return { blobs: [B, ...N, ...H], limbs, faces: H.map((h) => ({ x: h.x, y: h.y, r: h.rx })), top: H };
    },
  },
];
export const BP = Object.fromEntries(BAUPLAENE.map((b) => [b.id, b])) as Record<BlueprintId, Blueprint>;

/* ---------- Gesicht ---------- */
export type EyeKind = 'punkt' | 'rund' | 'viele' | 'schlitz' | 'muede' | 'zyklop';
export type MouthKind = 'laecheln' | 'zaehne' | 'schnabel' | 'rohr' | 'keiner' | 'grinsen';
export type ExtraKind = 'keins' | 'hoerner' | 'fuehler' | 'stacheln' | 'sommersprossen';

export const EYES: readonly EyeKind[] = ['punkt', 'rund', 'rund', 'viele', 'schlitz', 'muede', 'zyklop'];
export const MOUTHS: readonly MouthKind[] = ['laecheln', 'zaehne', 'schnabel', 'rohr', 'keiner', 'grinsen', 'zaehne'];
export const EXTRAS: readonly ExtraKind[] = ['keins', 'hoerner', 'fuehler', 'stacheln', 'sommersprossen', 'keins'];

/* Index-gleich mit dem Prototyp, Texte auf Englisch */
export const BLOOM_TRAITS: readonly string[] = [
  'Rebloomer: heals 3% per round',
  'Edge Runner: wet-on-wet +10%',
  'Dry Edge: dry-brush crit +10%',
  'Absorbent: takes 15% less color',
  'Tide Mark: dodge +5%',
];
export const LORE: readonly string[] = [
  'The print matches no glazer Sepia knows.',
  'Under the paint there is a year. It has been erased.',
  'The print is smaller than a grown hand.',
  'At the edge of the sheet: the same line, mirrored.',
  'The thumb touched the pigment while it was still wet. A very long time ago.',
];

export const SYL_A: readonly string[] = ['Blot', 'Smud', 'Drip', 'Wisp', 'Gloam', 'Pud', 'Murk', 'Tint', 'Bleed', 'Wash', 'Splot', 'Dab', 'Sop', 'Fleck', 'Wick', 'Glaze'];
export const SYL_B: readonly string[] = ['ling', 'wick', 'moth', 'kin', 'grub', 'fen', 'let', 'row', 'nib', 'mire', 'tuft', 'bell'];
