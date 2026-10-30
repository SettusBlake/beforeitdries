/*
 * Tiere als Vorlagen: Vierbeiner mit Posen, Zweibeiner, Vögel, Krabbeltiere und Meerestiere.
 * Jede Vorlage würfelt Körperbau, Pose und Teile frei, damit zwei Katzen nie gleich aussehen.
 */
import type { Pt } from '../data';
import { curve, edge, type B, type Kit } from './kit';
import { head, hat, HATS, leg, pickHead, tail, wings, type Head, type HeadKind, type LegKind, type TailKind, type WingKind } from './parts';

type R2 = [number, number];
export type Pose = 'stand' | 'walk' | 'sit' | 'lie' | 'stretch' | 'rear';
export type QuadOpt = {
  head: HeadKind[];
  hs: R2;
  bl: R2;
  bh: R2;
  leg: LegKind[];
  ll: R2;
  lw: R2;
  neck: R2;
  tail: TailKind[];
  poses: Pose[];
  legs?: number;
};
export type Quad = { body: B; hd: Head; kind: HeadKind; ground: number; L: number; H: number; pose: Pose; back: Pt };

const G = 0.82;

/** Vierbeiner (oder Sechsbeiner) in einer Pose. Kopf links */
export function quad(k: Kit, o: QuadOpt): Quad {
  const pose = k.pick(o.poses),
    L = k.rr(...o.bl),
    H = k.rr(...o.bh),
    ll = k.rr(...o.ll),
    lw = k.rr(...o.lw),
    hr = k.rr(...o.hs),
    kind = k.pick(o.leg),
    neck = k.rr(...o.neck),
    hk = pickHead(k, o.head),
    pairs = (o.legs ?? 4) / 2;
  let body: B, hx: number, hy: number, back: Pt;
  const legPair = (x: number, y: number, len: number, lean: number) => {
    leg(k, kind, x + 0.018, y - 0.005, len, lw, lean * 0.7, -1);
    leg(k, kind, x - 0.008, y, len, lw, -lean * 0.7 + lean, 1);
  };
  if (pose === 'sit') {
    body = k.e(0.56, G - H * 1.25, L * 0.72, H * 1.15, -0.95 + k.rr(-0.2, 0.2), 0);
    k.e(0.6 + L * 0.1, G - H * 0.55, L * 0.42, H * 0.6, 0, 1);
    k.e(0.6 - L * 0.2, G - 0.01, lw * 1.7, lw * 0.7, 0, 1);
    const fx = 0.56 - L * 0.42,
      fy = G - H * 1.6;
    legPair(fx, fy, G - fy, 0);
    hx = 0.56 - L * 0.35;
    hy = G - H * 2.15 - neck * 0.6;
    back = [0.56 + L * 0.55, G - H * 0.25];
  } else if (pose === 'lie') {
    body = k.e(0.55, G - H * 0.85, L * 1.05, H * 0.85, 0, 0);
    for (const dx of [0, 0.025]) k.e(0.55 - L * 1.0 + dx, G - lw * 0.6, lw * 2, lw * 0.75, 0, dx ? -1 : 1);
    k.e(0.55 + L * 0.5, G - H * 0.55, L * 0.38, H * 0.55, 0, 1);
    hx = 0.55 - L * 0.85;
    hy = G - H * 1.55 - neck * 0.4;
    back = [0.55 + L * 0.95, G - H * 0.4];
  } else if (pose === 'rear') {
    body = k.e(0.6, G - ll * 0.5 - H * 1.5, L * 0.72, H * 1.05, -1.15, 0);
    legPair(0.62, G - ll * 0.5 - H * 0.6, ll * 0.5 + H * 0.6, 0.1);
    const sx = 0.6 - H * 0.6,
      sy = G - ll * 0.5 - H * 2.1;
    for (const dz of [-1, 1]) k.line([[sx, sy], [sx - L * 0.45, sy - L * 0.15 + dz * 0.02], [sx - L * 0.7, sy + L * 0.1 + dz * 0.02]], Math.max(0.01, lw * 0.6));
    hx = 0.6 - L * 0.35;
    hy = sy - H * 0.9 - neck * 0.5;
    back = [0.6 + H * 0.5, G - ll * 0.4];
  } else {
    const st = pose === 'stretch',
      cy = G - ll - H * 0.55;
    body = k.e(0.55, cy, L, H, (st ? 0.3 : 0) + k.rr(-0.06, 0.06), 0);
    for (let p = 0; p < pairs; p++) {
      const t = pairs === 1 ? 0.5 : p / (pairs - 1),
        x = 0.55 - L * 0.62 + L * 1.24 * t,
        ly = cy + H * 0.5 + (st ? (0.5 - t) * L * 0.55 : 0);
      const lean = pose === 'walk' ? (p % 2 ? 0.28 : -0.28) : st && t < 0.5 ? -0.7 : k.rr(-0.08, 0.08);
      legPair(x, ly, Math.max(0.02, G - ly), lean);
    }
    const na = k.rr(0.35, 1.25);
    const nb: Pt = [0.55 - L * 0.78, cy - H * 0.35 + (st ? L * 0.25 : 0)];
    hx = nb[0] - Math.cos(na) * neck;
    hy = nb[1] - Math.sin(na) * neck;
    if (neck > 0.05) k.tube([nb, [hx, hy]], Math.max(lw * 1.4, H * 0.45), Math.max(lw, hr * 0.55), 1, 5);
    back = [0.55 + L * 0.92, cy - H * 0.25 - (st ? L * 0.3 : 0)];
  }
  const hd = head(k, hk, hx, hy, hr, -1, 3);
  if (o.tail.length) tail(k, k.pick(o.tail), back[0], back[1], 1, Math.max(L, H), -2);
  return { body, hd, kind: hk, ground: G, L, H, pose, back };
}

/** Zweibeiner von vorn: Körper, Kopf, Arme, Beine */
export type BipedOpt = { head: HeadKind[]; hs: R2; body: ('egg' | 'pear' | 'rect' | 'round' | 'tall' | 'bell')[]; bw: R2; bh: R2; arms: ('line' | 'blob' | 'wing' | 'none' | 'claw')[]; legs: (LegKind | 'none')[]; ll: R2 };
export function biped(k: Kit, o: BipedOpt): { body: B; hd: Head } {
  const bw = k.rr(...o.bw),
    bh = k.rr(...o.bh),
    ll = k.rr(...o.ll),
    lk = k.pick(o.legs),
    cy = G - (lk === 'none' ? 0 : ll) - bh,
    bk = k.pick(o.body);
  let body: B;
  if (bk === 'rect') body = k.rect(0.5, cy, bw * 2, bh * 2, 0, k.rr(0.1, 0.35), 0, { ink: true });
  else if (bk === 'pear') body = k.lathe(0.5, cy - bh, bh * 2, bw, (t) => 0.55 + 0.45 * Math.sin(t * Math.PI * 0.85), 8, 0);
  else if (bk === 'bell') body = k.lathe(0.5, cy - bh, bh * 2, bw, (t) => 0.35 + 0.65 * t * t, 8, 0);
  else if (bk === 'tall') body = k.e(0.5, cy, bw * 0.75, bh * 1.15, 0, 0);
  else if (bk === 'round') body = k.c(0.5, cy, Math.max(bw, bh), 0);
  else body = k.e(0.5, cy, bw, bh, 0, 0);
  if (lk !== 'none')
    for (const s of [-1, 1]) leg(k, lk, 0.5 + s * bw * 0.45, cy + bh * 0.75, ll + bh * 0.2, Math.max(0.018, bw * 0.22), s * k.rr(0, 0.15), 1);
  const ak = k.pick(o.arms);
  for (const s of [-1, 1]) {
    const sx = 0.5 + s * bw * 0.85,
      sy = cy - bh * 0.35,
      a = s > 0 ? k.rr(-1.3, 0.9) : Math.PI - k.rr(-1.3, 0.9),
      len = bw * k.rr(0.8, 1.3);
    if (ak === 'line') k.line(curve(k.r, sx, sy, len, a, s * k.rr(-0.8, 0.8), 5), 0.012);
    else if (ak === 'claw') {
      const pts = curve(k.r, sx, sy, len, a, s * 0.3, 5),
        e = pts[pts.length - 1]!;
      k.line(pts, 0.012);
      k.e(e[0], e[1], bw * 0.25, bw * 0.12, a, 2);
    } else if (ak === 'blob') k.e(sx + Math.cos(a) * len * 0.4, sy + Math.sin(a) * len * 0.4, len * 0.45, bw * 0.2, a, 1);
    else if (ak === 'wing') k.e(sx + Math.cos(a) * len * 0.3, sy + Math.sin(a) * len * 0.3 + bh * 0.2, len * 0.4, bw * 0.28, a + 0.5 * s, -1, { wing: true });
  }
  const hr = k.rr(...o.hs);
  const hd = head(k, pickHead(k, o.head), 0.5 + k.rr(-0.02, 0.02), cy - bh - hr * 0.6, hr, 0, 3);
  return { body, hd };
}

/** Kleiner Zufallsschmuck, der auf fast alles passt */
export function trimmings(k: Kit, hd: Head | null, body: B | null): void {
  if (hd && k.chance(0.14)) hat(k, hd, k.pick(HATS));
  if (body && k.chance(0.07)) wings(k, k.pick(['feather', 'bat', 'tiny', 'insect'] as const), body.x, body.y - body.ry * 0.6, Math.max(body.rx, body.ry), false, -3);
}

/* =================== Vorlagen =================== */
/** kinds: Varianten, die als eigene Vorlagen zählen (k.kind() wählt sie), w teilt sich auf */
export type Arche = { id: string; n: string; bp: import('../data').BlueprintId; w?: number; make: (k: Kit) => void; kinds?: { k: string; n: string; bp?: import('../data').BlueprintId }[] };

const cat = (k: Kit) => {
  const q = quad(k, { head: ['cat'], hs: [0.06, 0.1], bl: [0.13, 0.2], bh: [0.06, 0.1], leg: ['thin', 'paw', 'pillar'], ll: [0.06, 0.12], lw: [0.014, 0.024], neck: [0, 0.03], tail: ['curl', 'straight', 'bushy', 'curl', 'multi'], poses: ['stand', 'walk', 'sit', 'sit', 'lie', 'stretch', 'rear'] });
  if (k.chance(0.25)) for (let i = 0; i < k.ri(3, 6); i++) k.line([edge(q.body, -1.3 - i * 0.3, 0.98), edge(q.body, -1.3 - i * 0.3, 0.55)], 0.008);
  trimmings(k, q.hd, q.body);
};

export const ANIMALS: Arche[] = [
  /* ----- Vierbeiner ----- */
  { id: 'cat', n: 'cat', bp: 'vierbeiner', w: 1.4, make: cat },
  {
    id: 'dog',
    n: 'dog',
    bp: 'vierbeiner',
    w: 1.2,
    make: (k) => {
      const q = quad(k, { head: ['dog'], hs: [0.065, 0.11], bl: [0.12, 0.24], bh: [0.06, 0.12], leg: ['paw', 'thin', 'pillar'], ll: [0.05, 0.16], lw: [0.016, 0.03], neck: [0.02, 0.07], tail: ['straight', 'curl', 'stub', 'bushy'], poses: ['stand', 'walk', 'sit', 'lie', 'stretch'] });
      trimmings(k, q.hd, q.body);
    },
  },
  {
    id: 'fox',
    n: 'fox',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['fox'], hs: [0.06, 0.09], bl: [0.13, 0.2], bh: [0.055, 0.09], leg: ['thin', 'paw'], ll: [0.07, 0.13], lw: [0.012, 0.02], neck: [0.01, 0.05], tail: ['bushy', 'multi', 'multi'], poses: ['stand', 'walk', 'sit', 'lie'] });
      trimmings(k, q.hd, q.body);
    },
  },
  {
    id: 'horse',
    n: 'horse',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['horse'], hs: [0.07, 0.1], bl: [0.17, 0.24], bh: [0.08, 0.11], leg: ['hoof', 'thin'], ll: [0.14, 0.22], lw: [0.016, 0.024], neck: [0.1, 0.17], tail: ['tuft', 'bushy', 'straight'], poses: ['stand', 'walk', 'walk', 'rear'] });
      if (k.chance(0.5)) k.line(curve(k.r, q.hd.x + 0.02, q.hd.y - q.hd.r * 0.6, 0.15, 0.9, 0.3, 6, 0.3), 0.022);
      const v = k.r();
      if (v < 0.3) k.tri([q.hd.x - q.hd.r * 0.2, q.hd.y - q.hd.r * 0.8], [q.hd.x + q.hd.r * 0.2, q.hd.y - q.hd.r * 0.8], [q.hd.x - q.hd.r * 0.4, q.hd.y - q.hd.r * 2.4], 5, { ink: true });
      else if (v < 0.55) wings(k, 'feather', q.body.x, q.body.y - q.body.ry * 0.6, q.L * 1.1, true, 4);
      trimmings(k, null, q.body);
    },
  },
  {
    id: 'giraffe',
    n: 'longneck',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['horse', 'deer', 'cow'], hs: [0.045, 0.07], bl: [0.12, 0.18], bh: [0.07, 0.1], leg: ['thin', 'hoof'], ll: [0.18, 0.26], lw: [0.012, 0.018], neck: [0.2, 0.32], tail: ['tuft', 'fat'], poses: ['stand', 'walk'] });
      for (let i = 0; i < k.ri(4, 9); i++) {
        const p = edge(q.body, k.rr(0, 6.28), k.rr(0.2, 0.7));
        k.c(p[0], p[1], k.rr(0.012, 0.025), 1, { ink: true });
      }
    },
  },
  {
    id: 'elephant',
    n: 'elephant',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['elephant'], hs: [0.08, 0.12], bl: [0.17, 0.24], bh: [0.11, 0.15], leg: ['pillar'], ll: [0.07, 0.12], lw: [0.03, 0.045], neck: [0, 0.01], tail: ['tuft', 'straight'], poses: ['stand', 'walk', 'sit', 'rear'] });
      trimmings(k, q.hd, q.body);
    },
  },
  {
    id: 'pig',
    n: 'pig',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['pig'], hs: [0.07, 0.1], bl: [0.14, 0.2], bh: [0.09, 0.13], leg: ['stub', 'hoof'], ll: [0.03, 0.07], lw: [0.018, 0.026], neck: [0, 0.01], tail: ['spiral', 'curl'], poses: ['stand', 'walk', 'lie', 'sit'] });
      trimmings(k, q.hd, q.body);
    },
  },
  {
    id: 'cow',
    n: 'horned grazer',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['cow'], hs: [0.065, 0.09], bl: [0.17, 0.23], bh: [0.08, 0.12], leg: ['hoof', 'pillar'], ll: [0.09, 0.14], lw: [0.018, 0.028], neck: [0.01, 0.04], tail: ['tuft'], poses: ['stand', 'walk', 'lie'] });
      for (let i = 0; i < k.ri(0, 4); i++) {
        const p = edge(q.body, k.rr(0, 6.28), k.rr(0.1, 0.6));
        k.e(p[0], p[1], k.rr(0.02, 0.045), k.rr(0.015, 0.035), k.rr(0, 3), 1, { ink: true });
      }
    },
  },
  {
    id: 'sheep',
    n: 'woolly',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['round', 'cow', 'pig', 'bear'], hs: [0.05, 0.07], bl: [0.13, 0.18], bh: [0.09, 0.12], leg: ['thin', 'hoof'], ll: [0.06, 0.1], lw: [0.012, 0.018], neck: [0, 0.02], tail: ['stub'], poses: ['stand', 'walk', 'lie'] });
      const n = k.ri(7, 12);
      for (let i = 0; i < n; i++) {
        const p = edge(q.body, (i / n) * Math.PI * 2, 0.92);
        k.c(p[0], p[1], Math.min(q.L, q.H) * k.rr(0.32, 0.5), -1);
      }
    },
  },
  {
    id: 'deer',
    n: 'antlered',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['deer'], hs: [0.055, 0.075], bl: [0.13, 0.19], bh: [0.07, 0.09], leg: ['thin', 'hoof'], ll: [0.14, 0.2], lw: [0.011, 0.016], neck: [0.06, 0.12], tail: ['stub', 'tuft'], poses: ['stand', 'walk', 'lie'] });
      trimmings(k, null, q.body);
    },
  },
  {
    id: 'lion',
    n: 'maned cat',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['lion'], hs: [0.07, 0.1], bl: [0.15, 0.22], bh: [0.07, 0.11], leg: ['paw', 'pillar'], ll: [0.08, 0.13], lw: [0.02, 0.03], neck: [0, 0.02], tail: ['tuft'], poses: ['stand', 'walk', 'sit', 'lie'] });
      if (k.chance(0.25)) wings(k, 'feather', q.body.x, q.body.y - q.body.ry * 0.7, q.L, true, 4);
      if (k.chance(0.15)) head(k, k.pick(['cow', 'deer', 'dragon'] as const), q.body.x + 0.02, q.body.y - q.H * 1.4, q.hd.r * 0.7, -1, 1);
    },
  },
  {
    id: 'bear',
    n: 'bear',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['bear'], hs: [0.07, 0.1], bl: [0.16, 0.22], bh: [0.1, 0.14], leg: ['pillar', 'paw'], ll: [0.05, 0.1], lw: [0.03, 0.04], neck: [0, 0.02], tail: ['stub'], poses: ['stand', 'walk', 'sit', 'lie', 'rear'] });
      trimmings(k, q.hd, q.body);
    },
  },
  {
    id: 'mouse',
    n: 'mouse',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['mouse'], hs: [0.06, 0.09], bl: [0.11, 0.16], bh: [0.07, 0.1], leg: ['stub', 'thin'], ll: [0.02, 0.05], lw: [0.012, 0.018], neck: [0, 0.01], tail: ['curl', 'straight', 'spiral'], poses: ['stand', 'sit', 'lie', 'rear'] });
      trimmings(k, q.hd, q.body);
    },
  },
  {
    id: 'capybara',
    n: 'loaf',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['bear', 'round', 'pig'], hs: [0.06, 0.08], bl: [0.17, 0.22], bh: [0.09, 0.12], leg: ['stub'], ll: [0.02, 0.04], lw: [0.02, 0.028], neck: [0, 0.01], tail: [], poses: ['stand', 'lie', 'lie'] });
      if (k.chance(0.4)) k.lathe(q.hd.x, q.hd.top - 0.05, 0.06, 0.04, (t) => 0.4 + t * 0.6, 4, 5);
      trimmings(k, q.hd, q.body);
    },
  },
  {
    id: 'rhino',
    n: 'horn-nose',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['pig', 'cow', 'round'], hs: [0.07, 0.09], bl: [0.17, 0.23], bh: [0.1, 0.13], leg: ['pillar'], ll: [0.05, 0.09], lw: [0.028, 0.038], neck: [0, 0.01], tail: ['tuft', 'stub'], poses: ['stand', 'walk'] });
      const n = k.ri(1, 3);
      for (let i = 0; i < n; i++) k.tri([q.hd.x - q.hd.r * (0.5 + i * 0.35), q.hd.y - q.hd.r * 0.5], [q.hd.x - q.hd.r * (0.1 + i * 0.35), q.hd.y - q.hd.r * 0.7], [q.hd.x - q.hd.r * (0.9 + i * 0.25), q.hd.y - q.hd.r * (1.6 - i * 0.4)], 5, { ink: true });
    },
  },
  {
    id: 'camel',
    n: 'humped',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['horse', 'round'], hs: [0.05, 0.07], bl: [0.15, 0.2], bh: [0.07, 0.09], leg: ['thin'], ll: [0.15, 0.22], lw: [0.012, 0.018], neck: [0.1, 0.16], tail: ['tuft'], poses: ['stand', 'walk', 'lie'] });
      const n = k.ri(1, 3);
      for (let i = 0; i < n; i++) k.e(q.body.x - q.L * 0.4 + (q.L * 0.8 * (i + 0.5)) / n, q.body.y - q.H * 0.95, q.L * 0.32 / Math.sqrt(n), q.H * k.rr(0.6, 0.9), 0, -1);
    },
  },
  {
    id: 'stego',
    n: 'plated lizard',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['croc', 'round', 'dragon'], hs: [0.04, 0.06], bl: [0.2, 0.26], bh: [0.1, 0.13], leg: ['pillar'], ll: [0.06, 0.1], lw: [0.025, 0.035], neck: [0.02, 0.06], tail: ['fat'], poses: ['stand', 'walk'] });
      const n = k.ri(4, 7),
        tall = k.rr(0.5, 0.9);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (0.15 + (0.7 * (i + 0.5)) / n),
          p = edge(q.body, a, 0.85),
          h = q.H * tall * (1 - Math.abs(i - (n - 1) / 2) / n);
        k.tri([p[0] - h * 0.4, p[1] + h * 0.2], [p[0] + h * 0.4, p[1] + h * 0.2], [p[0], p[1] - h], -1, { ink: true });
      }
    },
  },
  {
    id: 'sauropod',
    n: 'longtail giant',
    bp: 'vierbeiner',
    make: (k) => {
      const q = quad(k, { head: ['round', 'horse', 'croc'], hs: [0.035, 0.05], bl: [0.17, 0.22], bh: [0.1, 0.13], leg: ['pillar'], ll: [0.08, 0.13], lw: [0.03, 0.04], neck: [0.2, 0.3], tail: ['fat'], poses: ['stand', 'walk'] });
      trimmings(k, q.hd, null);
    },
  },
  {
    id: 'tortoise',
    n: 'shellback',
    bp: 'kriecher',
    make: (k) => {
      const q = quad(k, { head: ['round', 'croc', 'frog'], hs: [0.04, 0.06], bl: [0.14, 0.2], bh: [0.05, 0.07], leg: ['stub', 'pillar'], ll: [0.02, 0.05], lw: [0.022, 0.03], neck: [0.03, 0.09], tail: ['stub'], poses: ['stand', 'walk'] });
      const w = q.L * k.rr(1.0, 1.25),
        h = q.H * k.rr(1.6, 2.6);
      k.lathe(q.body.x, q.body.y - h * 0.7, h, w, (t) => Math.sqrt(Math.max(0.05, t)), 8, 2, { ink: true });
      for (let i = 0; i < 3; i++) k.ring(q.body.x - w * 0.4 + i * w * 0.4, q.body.y - h * 0.15, w * 0.18, h * 0.18, 0.005);
    },
  },
  {
    id: 'hedgehog',
    n: 'spineball',
    bp: 'kriecher',
    make: (k) => {
      const q = quad(k, { head: ['mouse', 'round', 'fox'], hs: [0.05, 0.07], bl: [0.13, 0.17], bh: [0.08, 0.11], leg: ['stub'], ll: [0.02, 0.03], lw: [0.014, 0.02], neck: [0, 0.01], tail: [], poses: ['stand', 'walk', 'lie'] });
      const n = k.ri(12, 20);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (0.02 + (0.85 * i) / (n - 1)) - 0.1,
          p = edge(q.body, a, 0.8),
          len = q.H * k.rr(0.5, 0.9);
        k.line([p, [p[0] + Math.cos(a + q.body.rot) * len, p[1] + Math.sin(a + q.body.rot) * len]], 0.007);
      }
    },
  },
  {
    id: 'sixlegs',
    n: 'many-legged beast',
    bp: 'krabbe',
    make: (k) => {
      const q = quad(k, { head: ['dog', 'cat', 'round', 'croc', 'robot'], hs: [0.05, 0.08], bl: [0.2, 0.28], bh: [0.07, 0.1], leg: ['thin', 'jointed', 'paw', 'claw'], ll: [0.07, 0.14], lw: [0.012, 0.02], neck: [0, 0.05], tail: ['fat', 'sting', 'curl', 'straight'], poses: ['stand', 'walk'], legs: k.pick([6, 8]) });
      trimmings(k, q.hd, q.body);
    },
  },

  /* ----- Zweibeiner und Vögel ----- */
  {
    id: 'penguin',
    n: 'waddler',
    bp: 'turm',
    make: (k) => {
      const b = biped(k, { head: ['bird', 'round'], hs: [0.06, 0.08], body: ['egg', 'bell', 'tall'], bw: [0.1, 0.14], bh: [0.14, 0.2], arms: ['wing'], legs: ['stub'], ll: [0.01, 0.03] });
      k.e(0.5, b.body.y + b.body.ry * 0.15, b.body.rx * 0.6, b.body.ry * 0.7, 0, 1, { wing: true });
      trimmings(k, b.hd, null);
    },
  },
  {
    id: 'owl',
    n: 'owl',
    bp: 'flatterer',
    make: (k) => {
      const b = biped(k, { head: ['owl'], hs: [0.08, 0.11], body: ['egg', 'pear', 'round'], bw: [0.1, 0.14], bh: [0.12, 0.17], arms: ['wing', 'wing', 'none'], legs: ['claw', 'stub'], ll: [0.02, 0.04] });
      if (k.chance(0.35)) k.line([[0.25, G + 0.01], [0.75, G + 0.01]], 0.014);
      trimmings(k, b.hd, null);
    },
  },
  {
    id: 'chick',
    n: 'chick',
    bp: 'huepfer',
    make: (k) => {
      const b = biped(k, { head: ['bird'], hs: [0.06, 0.09], body: ['round', 'egg'], bw: [0.09, 0.13], bh: [0.08, 0.12], arms: ['wing', 'none'], legs: ['thin', 'claw'], ll: [0.04, 0.08] });
      if (k.chance(0.35)) k.poly([[0.38, b.body.y + 0.02], [0.43, b.body.y - 0.03], [0.47, b.body.y + 0.02], [0.53, b.body.y - 0.03], [0.58, b.body.y + 0.02], [0.62, b.body.y - 0.02], [0.63, b.body.y + 0.14], [0.37, b.body.y + 0.14]], 2, { ink: true });
      trimmings(k, b.hd, null);
    },
  },
  {
    id: 'trex',
    n: 'tyrant',
    bp: 'huepfer',
    make: (k) => {
      const ang = k.rr(-0.8, -0.2),
        bx = 0.55,
        by = 0.52;
      const body = k.e(bx, by, k.rr(0.13, 0.17), k.rr(0.08, 0.1), ang, 0);
      const hp: Pt = [bx - Math.cos(ang) * 0.17, by + Math.sin(ang) * 0.17 - 0.06];
      head(k, pickHead(k, ['croc', 'dragon', 'dog']), hp[0], hp[1], k.rr(0.06, 0.08), -1, 2);
      for (const dz of [-1, 1]) {
        k.e(bx + 0.03 + dz * 0.015, by + 0.09, 0.05, 0.075, 0.3, dz);
        k.line([[bx + 0.04 + dz * 0.015, by + 0.14], [bx + 0.01 + dz * 0.015, G], [bx - 0.03 + dz * 0.015, G]], 0.016);
        k.line([[bx - 0.09, by + 0.02], [bx - 0.13, by + 0.05 + dz * 0.01]], 0.009);
      }
      tail(k, 'fat', bx + 0.13, by + 0.05, 1, 0.16, -2);
    },
  },
  {
    id: 'kangaroo',
    n: 'pouch hopper',
    bp: 'huepfer',
    make: (k) => {
      const body = k.e(0.55, 0.55, k.rr(0.09, 0.13), k.rr(0.15, 0.2), -0.3, 0);
      head(k, pickHead(k, ['bunny', 'mouse', 'fox', 'dog']), 0.47, 0.32, k.rr(0.055, 0.075), -1, 2);
      k.e(0.57, G - 0.05, 0.06, 0.08, 0.2, 1);
      k.e(0.52, G - 0.008, 0.08, 0.02, 0, 2);
      tail(k, 'fat', 0.62, 0.68, 1, 0.18, -2);
      k.line([[0.48, 0.47], [0.42, 0.52], [0.41, 0.56]], 0.01);
      if (k.chance(0.5)) k.c(0.53, 0.6, 0.035, 1, { ink: true });
      trimmings(k, null, body);
    },
  },
  {
    id: 'bird',
    n: 'bird',
    bp: 'flatterer',
    w: 1.3,
    make: (k) => {
      const bw = k.rr(0.1, 0.15),
        bh = k.rr(0.08, 0.12),
        rot = k.rr(-0.4, 0.2);
      const body = k.e(0.52, 0.5, bw, bh, rot, 0);
      const hd = head(k, pickHead(k, ['bird', 'bird', 'owl', 'round']), 0.52 - bw * 0.85, 0.5 - bh * 0.9, k.rr(0.05, 0.075), -1, 2);
      wings(k, k.pick(['feather', 'feather', 'angel'] as WingKind[]), 0.53, 0.5 - bh * 0.4, bw * 1.2, true, 3, k.rr(-0.4, 1.3));
      tail(k, k.pick(['peacock', 'fish', 'straight', 'bushy'] as TailKind[]), 0.52 + bw * 0.9, 0.5 + bh * 0.1, 1, bw, -2);
      if (k.chance(0.6)) for (const dz of [-1, 1]) leg(k, 'claw', 0.52 + dz * 0.02, 0.5 + bh * 0.8, k.rr(0.05, 0.12), 0.012, 0.1, dz);
      trimmings(k, hd, null);
    },
  },
  {
    id: 'duck',
    n: 'paddler',
    bp: 'huepfer',
    make: (k) => {
      const body = k.e(0.53, 0.6, k.rr(0.14, 0.18), k.rr(0.08, 0.1), 0, 0);
      k.e(body.x + body.rx * 0.85, body.y - body.ry * 0.5, 0.05, 0.03, -0.6, -1);
      const hd = head(k, 'round', body.x - body.rx * 0.65, body.y - body.ry * 1.6, k.rr(0.055, 0.07), -1, 2);
      k.e(hd.x - hd.r * 1.15, hd.y + hd.r * 0.2, hd.r * 0.6, hd.r * 0.22, 0.1, 3, { ink: true });
      wings(k, 'tiny', body.x + 0.02, body.y - 0.02, body.rx, true, 2, -0.3);
      if (k.chance(0.5)) k.line([[0.25, body.y + body.ry * 0.7], [0.8, body.y + body.ry * 0.7]], 0.008);
      trimmings(k, hd, null);
    },
  },

  /* ----- Krabbeltiere ----- */
  {
    id: 'beetle',
    n: 'beetle',
    bp: 'kriecher',
    make: (k) => {
      const body = k.e(0.56, 0.58, k.rr(0.15, 0.22), k.rr(0.1, 0.15), k.rr(-0.06, 0.04), 0, { ink: true });
      k.line([[body.x - body.rx * 0.4, body.y - body.ry * 0.95], [body.x + body.rx * 0.9, body.y + body.ry * 0.1]], 0.006);
      const hd = head(k, pickHead(k, ['round', 'frog', 'robot', 'deer']), body.x - body.rx * 0.95, body.y + body.ry * 0.05, k.rr(0.05, 0.08), -1, 1);
      if (k.chance(0.5)) k.line(curve(k.r, hd.x - hd.r * 0.6, hd.y - hd.r * 0.4, k.rr(0.08, 0.16), -2.4, k.rr(0.5, 1.5), 6), 0.016);
      for (let i = 0; i < 3; i++) for (const dz of [-1, 1]) leg(k, 'jointed', body.x - body.rx * 0.5 + i * body.rx * 0.5 + dz * 0.01, body.y + body.ry * 0.6, k.rr(0.07, 0.12), 0.012, k.rr(-0.5, 0.5), dz);
      for (let i = 0; i < k.ri(0, 5); i++) {
        const p = edge(body, k.rr(-2.8, -0.4), k.rr(0.3, 0.7));
        k.c(p[0], p[1], k.rr(0.012, 0.025), 1, { ink: true });
      }
    },
  },
  {
    id: 'ant',
    n: 'three-part bug',
    bp: 'krabbe',
    make: (k) => {
      const s = k.rr(0.8, 1.2);
      const parts = [k.e(0.68, 0.6, 0.09 * s, 0.07 * s, 0.2, 0), k.e(0.53, 0.58, 0.05 * s, 0.04 * s, 0, 0)];
      const hd = head(k, pickHead(k, ['round', 'robot', 'frog', 'bird']), 0.42, 0.53, 0.05 * s, -1, 1);
      for (let i = 0; i < 3; i++) for (const dz of [-1, 1]) leg(k, 'jointed', 0.5 + i * 0.03 + dz * 0.006, 0.6, k.rr(0.1, 0.15), 0.01, -0.6 + i * 0.6, dz);
      for (const sg of [-1, 1]) k.line(curve(k.r, hd.x, hd.y - hd.r * 0.7, 0.12, -2.2 + sg * 0.3, 1.2, 6), 0.006);
      if (k.chance(0.35)) wings(k, 'insect', 0.55, 0.55, 0.12, true, 3, 0.8);
      void parts;
    },
  },
  {
    id: 'bee',
    n: 'buzzer',
    bp: 'flatterer',
    make: (k) => {
      const body = k.e(0.55, 0.55, k.rr(0.12, 0.16), k.rr(0.08, 0.11), k.rr(-0.3, 0.2), 0, { ink: true });
      for (let i = 0; i < 3; i++) k.line([edge(body, -1.9 + i * 0.5, 1), edge(body, 1.9 - i * 0.5, 1)], 0.014);
      const hd = head(k, pickHead(k, ['round', 'chibi', 'frog']), body.x - body.rx - 0.03, body.y - 0.02, k.rr(0.05, 0.07), -1, 1);
      wings(k, 'insect', body.x, body.y - body.ry * 0.8, body.rx * 0.9, true, 3, 1);
      k.tri([body.x + body.rx * 0.95, body.y - 0.01], [body.x + body.rx * 0.95, body.y + 0.02], [body.x + body.rx * 1.25, body.y + 0.01], -1, { ink: true });
      for (const sg of [-1, 1]) k.line(curve(k.r, hd.x, hd.y - hd.r * 0.7, 0.07, -2 + sg * 0.3, 1, 5), 0.006);
    },
  },
  {
    id: 'ladybug',
    n: 'dotted dome',
    bp: 'kriecher',
    make: (k) => {
      const R = k.rr(0.15, 0.2);
      const dome = k.lathe(0.55, 0.62 - R * 0.9, R * 0.95, R, (t) => Math.sqrt(t), 8, 0, { ink: true });
      k.line([[0.55, 0.62 - R * 0.9], [0.55, 0.62 + R * 0.05]], 0.007);
      for (let i = 0; i < k.ri(3, 9); i++) k.c(0.55 + k.rr(-0.75, 0.75) * R, 0.62 - k.rr(0.15, 0.7) * R, R * k.rr(0.08, 0.16), 1, { ink: true });
      head(k, pickHead(k, ['round', 'frog', 'chibi']), 0.55 - R * 1.05, 0.6, R * 0.38, -1, 1);
      for (let i = 0; i < 3; i++) leg(k, 'jointed', 0.45 + i * R * 0.5, 0.62, 0.06, 0.01, 0.2, -1);
      void dome;
    },
  },
  {
    id: 'mantis',
    n: 'praying hunter',
    bp: 'krabbe',
    make: (k) => {
      const ab = k.e(0.6, 0.62, k.rr(0.12, 0.16), 0.045, 0.15, 0);
      const th = k.e(0.44, 0.48, 0.03, k.rr(0.09, 0.12), -0.4, 0);
      const hd = head(k, pickHead(k, ['frog', 'round', 'robot']), 0.4, 0.33, 0.045, -1, 2);
      for (const dz of [-1, 1]) {
        k.line([[0.42, 0.45], [0.33 + dz * 0.01, 0.5], [0.32, 0.38]], 0.012);
        k.line([[0.58 + dz * 0.03, 0.64], [0.55 + dz * 0.04, 0.72], [0.6 + dz * 0.05, G]], 0.008);
      }
      wings(k, 'insect', 0.5, 0.56, 0.15, true, 3, -0.3);
      void ab;
      void th;
      void hd;
    },
  },
  {
    id: 'spider',
    n: 'eight-legs',
    bp: 'krabbe',
    w: 1.2,
    make: (k) => {
      const ab = k.c(0.5, 0.58, k.rr(0.09, 0.15), 0);
      const hd = head(k, pickHead(k, ['round', 'round', 'chibi', 'skull', 'robot']), 0.5, ab.y - ab.ry - 0.04, k.rr(0.05, 0.075), 0, 1);
      for (const s of [-1, 1])
        for (let i = 0; i < 4; i++) {
          const hx = 0.5 + s * hd.r * 0.7,
            hy = hd.y + hd.r * 0.3 + i * 0.022,
            kx = hx + s * k.rr(0.1, 0.17),
            ky = hy - k.rr(0.03, 0.12) + i * 0.03;
          k.line([[hx, hy], [kx, ky], [kx + s * k.rr(0.04, 0.09), hy + k.rr(0.08, 0.16) + i * 0.02]], 0.008);
        }
      if (k.chance(0.35)) k.line([[0.5, ab.y - ab.ry - 0.1], [0.5, 0.05]], 0.004);
      if (k.chance(0.4)) for (let i = 0; i < 3; i++) k.c(0.5 + k.rr(-0.5, 0.5) * ab.rx, ab.y + k.rr(-0.3, 0.5) * ab.ry, ab.rx * 0.15, 1, { ink: true });
    },
  },
  {
    id: 'crab',
    n: 'pincer',
    bp: 'krabbe',
    w: 1.2,
    make: (k) => {
      const body = k.e(0.5, 0.6, k.rr(0.16, 0.26), k.rr(0.08, 0.13), 0, 0, { ink: true });
      const fid = k.chance(0.4),
        big = k.sign();
      for (const s of [-1, 1]) {
        const size = k.rr(0.05, 0.07) * (fid ? (s === big ? 1.7 : 0.7) : 1),
          x = 0.5 + s * k.rr(0.27, 0.36),
          y = k.rr(0.3, 0.42);
        k.line([[0.5 + s * body.rx * 0.8, body.y - body.ry * 0.3], [0.5 + s * (body.rx * 0.9), (y + body.y) / 2 + 0.03], [x, y + size * 0.5]], 0.014);
        const a = -Math.PI / 2 + s * 0.4;
        k.e(x + Math.cos(a - 0.35) * size * 0.6, y + Math.sin(a - 0.35) * size * 0.6, size, size * 0.45, a - 0.35, 2, { ink: true });
        k.e(x + Math.cos(a + 0.45) * size * 0.5, y + Math.sin(a + 0.45) * size * 0.5, size * 0.8, size * 0.35, a + 0.45, 2, { ink: true });
        for (let i = 0; i < k.ri(2, 4); i++) leg(k, 'jointed', 0.5 + s * (body.rx * 0.45 + i * 0.045), body.y + body.ry * 0.5, k.rr(0.08, 0.13), 0.01, s * k.rr(0.4, 0.8), -1);
      }
      k.face(0.5, body.y - body.ry * 0.25, body.ry * 0.95, { stalks: k.chance(0.6) });
    },
  },
  {
    id: 'scorpion',
    n: 'stinger',
    bp: 'krabbe',
    make: (k) => {
      const body = k.e(0.48, 0.64, k.rr(0.13, 0.17), k.rr(0.05, 0.07), 0, 0);
      tail(k, 'sting', body.x + body.rx * 0.9, body.y - 0.01, 1, 0.16, 1);
      for (const s of [-1, 1]) {
        const x = body.x - body.rx - k.rr(0.07, 0.12),
          y = body.y - 0.03 + s * 0.04;
        k.line([[body.x - body.rx * 0.6, body.y], [x + 0.04, y + 0.03], [x, y]], 0.012);
        k.e(x - 0.02, y - 0.01, 0.04, 0.018, -0.3, 2, { ink: true });
        k.e(x - 0.02, y + 0.012, 0.035, 0.014, 0.3, 2, { ink: true });
      }
      for (let i = 0; i < 4; i++) leg(k, 'jointed', body.x - body.rx * 0.5 + i * 0.05, body.y + 0.03, 0.08, 0.009, k.rr(-0.5, 0.5), -1);
      k.face(body.x - body.rx * 0.6, body.y - 0.01, 0.05);
    },
  },
  {
    id: 'snail',
    n: 'shell crawler',
    bp: 'kriecher',
    make: (k) => {
      const body = k.e(0.53, 0.66, k.rr(0.2, 0.28), k.rr(0.05, 0.075), 0, 0);
      const sr = k.rr(0.1, 0.17),
        sx = body.x + body.rx * k.rr(0, 0.3),
        sy = body.y - body.ry - sr * 0.7;
      const kind = k.pick(['spiral', 'cone', 'house', 'teapot']);
      if (kind === 'cone') k.tri([sx - sr, sy + sr * 0.8], [sx + sr, sy + sr * 0.8], [sx + k.rr(-0.5, 0.5) * sr, sy - sr * 1.5], 1, { ink: true });
      else if (kind === 'house') {
        k.rect(sx, sy + sr * 0.2, sr * 1.8, sr * 1.3, 0, 0.08, 1, { ink: true });
        k.tri([sx - sr * 1.1, sy - sr * 0.4], [sx + sr * 1.1, sy - sr * 0.4], [sx, sy - sr * 1.3], 1, { ink: true });
        k.line([[sx - sr * 0.25, sy + sr * 0.85], [sx - sr * 0.25, sy + sr * 0.3], [sx + sr * 0.25, sy + sr * 0.3], [sx + sr * 0.25, sy + sr * 0.85]], 0.006);
      } else {
        k.c(sx, sy, sr, 1, { ink: true });
        k.c(sx + sr * 0.18, sy - sr * 0.12, sr * 0.62, 1);
        k.c(sx + sr * 0.26, sy - sr * 0.18, sr * 0.3, 1);
      }
      const hd = head(k, pickHead(k, ['round', 'round', 'chibi', 'frog']), body.x - body.rx * 0.82, body.y - body.ry * k.rr(0.6, 1.6), k.rr(0.05, 0.08), -1, 2);
      if (k.chance(0.6)) for (const s of [-1, 1]) k.line([[hd.x + s * hd.r * 0.3, hd.y - hd.r * 0.8], [hd.x + s * hd.r * 0.6 - hd.r * 0.3, hd.y - hd.r * 1.8]], 0.007);
    },
  },
  {
    id: 'caterpillar',
    n: 'segmented crawler',
    bp: 'kriecher',
    make: (k) => {
      const len = k.rr(0.42, 0.62),
        rad = k.rr(0.045, 0.07),
        n = Math.round(len / (rad * k.rr(1.4, 2))) + 1,
        amp = k.rr(0, 0.06),
        arch = k.chance(0.3) ? k.rr(0.1, 0.22) : 0,
        ph = k.rr(0, 6.28);
      let last: B | null = null;
      for (let i = n - 1; i >= 0; i--) {
        const t = i / (n - 1);
        last = k.c(0.5 - len / 2 + len * t, 0.62 + Math.sin(ph + t * 6) * amp - Math.sin(t * Math.PI) * arch, rad * k.rr(0.88, 1.12) * (i === 0 ? 1.3 : 1), 0);
        if (i > 0 && !arch) leg(k, 'thin', last.x, last.y + rad * 0.7, rad * 0.6, 0.008, 0, -1);
        if (i > 0 && k.chance(0.25)) k.line([[last.x, last.y - rad], [last.x, last.y - rad * 1.8]], 0.006);
      }
      head(k, pickHead(k, ['round', 'round', 'chibi', 'bear', 'cat']), last!.x, last!.y - rad * 0.4, rad * 1.3, -1, 2);
    },
  },
  {
    id: 'centipede',
    n: 'hundred-feet',
    bp: 'schlange',
    make: (k) => {
      const pts = curve(k.r, 0.18, 0.5, k.rr(0.6, 0.8), k.rr(-0.4, 0.4), k.rr(-2.5, 2.5), 16, 0.15);
      const segs = k.tube(pts, 0.035, 0.03, 0, 12);
      for (const s of segs) {
        k.line([[s.x, s.y], [s.x - 0.02, s.y + 0.07], [s.x - 0.03, s.y + 0.09]], 0.006);
        k.line([[s.x, s.y], [s.x + 0.02, s.y - 0.06], [s.x + 0.035, s.y - 0.07]], 0.006);
      }
      head(k, pickHead(k, ['round', 'robot', 'skull', 'dragon']), pts[0]![0] - 0.02, pts[0]![1], 0.05, -1, 2);
    },
  },

  /* ----- Meer ----- */
  {
    id: 'fish',
    n: 'fish',
    bp: 'schwebeblase',
    w: 1.3,
    make: (k) => {
      const L = k.rr(0.14, 0.22),
        H = L * k.rr(0.35, 0.9);
      const shape = k.pick(['oval', 'lathe', 'diamond']);
      let body: B;
      if (shape === 'lathe') body = k.poly(Array.from({ length: 16 }, (_, i): Pt => {
        const a = (i / 16) * Math.PI * 2;
        return [0.5 + Math.cos(a) * L, 0.55 + Math.sin(a) * H * (Math.cos(a) < 0 ? 1 : 0.7 + 0.3 * Math.abs(Math.cos(a)))];
      }), 0, { crisp: 0.6 });
      else if (shape === 'diamond') body = k.poly([[0.5 - L, 0.55], [0.5, 0.55 - H], [0.5 + L, 0.55], [0.5, 0.55 + H]], 0, { crisp: 0.6 });
      else body = k.e(0.5, 0.55, L, H, 0, 0);
      tail(k, 'fish', 0.5 + L * 0.85, 0.55, 1, H * 1.2, -1);
      k.tri([0.5 - L * 0.2, 0.55 - H * 0.8], [0.5 + L * 0.3, 0.55 - H * 0.7], [0.5 + L * k.rr(0.1, 0.5), 0.55 - H * k.rr(1.3, 1.9)], -1);
      if (k.chance(0.5)) k.e(0.5, 0.55 + H * 0.25, L * 0.25, H * 0.15, 0.6, 1, { wing: true });
      for (let i = 0; i < k.ri(0, 3); i++) k.line([edge(body, -1.2 + i * 0.4, 1), edge(body, 1.2 - i * 0.4, 1)], 0.005);
      if (k.chance(0.25)) {
        const a = curve(k.r, 0.5 - L * 0.6, 0.55 - H * 0.8, 0.12, -2, 1.5, 6);
        k.line(a, 0.006);
        k.c(a[a.length - 1]![0], a[a.length - 1]![1], 0.02, 2, { ink: true });
      }
      k.face(0.5 - L * 0.55, 0.55 - H * 0.1, Math.min(H, L * 0.5) * 0.8);
    },
  },
  {
    id: 'puffer',
    n: 'puffball',
    bp: 'schwebeblase',
    make: (k) => {
      const R = k.rr(0.15, 0.2),
        body = k.c(0.5, 0.52, R, 0, { ink: true });
      const n = k.ri(14, 22);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + k.rr(-0.1, 0.1);
        k.line([edge(body, a, 0.95), edge(body, a, k.rr(1.2, 1.4))], 0.007);
      }
      tail(k, 'fish', 0.5 + R * 0.95, 0.52, 1, R * 0.5, -1);
      for (const s of [-1, 1]) k.e(0.5 + s * R * 0.1, 0.52 + R * 0.4, R * 0.25, R * 0.12, 0.8 * s, 1, { wing: true });
      k.face(0.5 - R * 0.2, 0.5, R * 0.8);
    },
  },
  {
    id: 'whale',
    n: 'whale',
    bp: 'schwebeblase',
    make: (k) => {
      const L = k.rr(0.22, 0.3),
        H = L * k.rr(0.4, 0.55);
      const body = k.e(0.48, 0.58, L, H, k.rr(-0.1, 0.1), 0);
      const t = curve(k.r, 0.48 + L * 0.8, 0.58, L * 0.6, -0.3, -0.8, 6);
      k.tube(t, H * 0.45, H * 0.15, -1, 5);
      const e = t[t.length - 1]!;
      k.e(e[0] + 0.03, e[1] - 0.03, 0.06, 0.02, -0.8, -1);
      k.e(e[0] + 0.03, e[1] + 0.02, 0.06, 0.02, 0.5, -1);
      k.e(0.48 - L * 0.1, 0.58 + H * 0.6, L * 0.3, H * 0.2, 0.4, 1);
      for (let i = 0; i < 5; i++) k.line([[0.48 - L * 0.4 + i * 0.03, 0.58 + H * 0.3], [0.48 - L * 0.3 + i * 0.03, 0.58 + H * 0.9]], 0.004);
      if (k.chance(0.6)) for (let i = 0; i < 3; i++) k.line(curve(k.r, 0.48 - L * 0.4, 0.58 - H, 0.12, -Math.PI / 2 + (i - 1) * 0.6, (i - 1) * 1.5, 5), 0.007);
      k.face(0.48 - L * 0.6, 0.58 - H * 0.15, H * 0.7);
      void body;
    },
  },
  {
    id: 'seahorse',
    n: 'curl-tail',
    bp: 'schlange',
    make: (k) => {
      const pts = curve(k.r, 0.5, 0.25, k.rr(0.5, 0.65), Math.PI / 2 + 0.2, k.rr(3.5, 5.5), 18);
      k.tube(pts, 0.08, 0.018, 0, 12);
      const hd = head(k, pickHead(k, ['horse', 'dragon', 'bird']), 0.46, 0.22, 0.06, -1, 3);
      k.rect(hd.x - 0.08, hd.y + 0.03, 0.08, 0.025, 0.2, 0.4, 4);
      k.e(0.58, 0.4, 0.05, 0.03, 0.5, -1, { wing: true });
      for (let i = 0; i < 5; i++) k.line([[0.55, 0.3 + i * 0.05], [0.6, 0.3 + i * 0.05 - 0.02]], 0.006);
    },
  },
  {
    id: 'manta',
    n: 'glider',
    bp: 'flatterer',
    make: (k) => {
      const W = k.rr(0.3, 0.4),
        H = k.rr(0.1, 0.16);
      k.poly([[0.5 - W, 0.5 + k.rr(-0.06, 0.04)], [0.5 - H * 0.6, 0.5 - H], [0.5 + H * 0.6, 0.5 - H], [0.5 + W, 0.5 + k.rr(-0.06, 0.04)], [0.5, 0.5 + H]], 0, { crisp: 0.5 });
      k.line(curve(k.r, 0.5, 0.5 + H * 0.8, k.rr(0.2, 0.35), Math.PI / 2, k.rr(-1.5, 1.5), 8, 0.2), 0.006);
      for (const s of [-1, 1]) k.e(0.5 + s * H * 0.6, 0.5 - H * 1.05, 0.02, 0.05, s * 0.3, 1);
      k.face(0.5, 0.5 - H * 0.2, H * 0.7);
    },
  },
  {
    id: 'turtle',
    n: 'sea turtle',
    bp: 'schwebeblase',
    make: (k) => {
      const R = k.rr(0.14, 0.18);
      const shell = k.e(0.5, 0.55, R, R * 0.8, 0, 1, { ink: true });
      for (let i = 0; i < 5; i++) {
        const p = edge(shell, (i / 5) * Math.PI * 2, 0.5);
        k.ring(p[0], p[1], R * 0.25, R * 0.2, 0.005);
      }
      for (const s of [-1, 1]) {
        k.e(0.5 + s * R * 1.0, 0.45, R * 0.55, R * 0.18, s * -0.6, 0);
        k.e(0.5 + s * R * 0.7, 0.68, R * 0.35, R * 0.14, s * 0.5, 0);
      }
      head(k, pickHead(k, ['round', 'croc', 'frog']), 0.5, 0.55 - R * 1.0, R * 0.38, 0, 2);
    },
  },
];
