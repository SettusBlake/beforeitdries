/*
 * Teile, aus denen die Vorlagen gebaut werden: Köpfe, Hüte, Schwänze, Beine, Flügel.
 * dir -1: Seitenansicht nach links, dir 0: von vorn. Jede Funktion würfelt ihre Feinheiten selbst.
 */
import type { Pt } from '../data';
import { curve, type B, type Kit } from './kit';

export type Head = { h: B; x: number; y: number; r: number; dir: number; top: number };
export const HEAD_KINDS = [
  'round',
  'cat',
  'dog',
  'fox',
  'mouse',
  'bear',
  'horse',
  'elephant',
  'pig',
  'cow',
  'deer',
  'lion',
  'owl',
  'bird',
  'frog',
  'robot',
  'dragon',
  'moai',
  'pumpkin',
  'chibi',
  'tv',
  'skull',
  'bunny',
  'croc',
] as const;
export type HeadKind = (typeof HEAD_KINDS)[number];

/** Kopf nach Vorlage, manchmal ein ganz anderer (Mischwesen) */
export function pickHead(k: Kit, list: readonly HeadKind[]): HeadKind {
  return k.chance(k.mix) ? k.pick(HEAD_KINDS) : k.pick(list);
}

/** Gesicht: bei Seitenansicht nach vorn gerückt */
function faceOn(k: Kit, x: number, y: number, r: number, dir: number, k2 = 0.85, dy = 0.05): void {
  k.face(x + dir * r * 0.25, y + r * dy, r * k2);
}

/** Ein Kopf mit allem, was zu seiner Art gehört. z ist die Lage des Kopfes, Ohren liegen dahinter */
export function head(k: Kit, kind: HeadKind, x: number, y: number, r: number, dir: number, z = 2): Head {
  const side = dir !== 0,
    d = dir || 0;
  let h: B;
  let top = y - r;
  const ears = (fn: (s: number) => void) => {
    for (const s of [-1, 1]) fn(s);
  };
  switch (kind) {
    case 'cat': {
      h = k.e(x, y, r * k.rr(1, 1.12), r * k.rr(0.88, 1), 0, z);
      const tall = k.rr(0.9, 1.5),
        spread = k.rr(0.55, 0.85);
      ears((s) => k.tri([x + s * r * 0.2 - d * r * 0.1, y - r * 0.7], [x + s * r * spread * 1.15 - d * r * 0.1, y - r * 0.35], [x + s * r * spread - d * r * 0.05, y - r * (0.7 + 0.6 * tall)], z - 1));
      top = y - r * (0.7 + 0.6 * tall);
      if (k.chance(0.6)) ears((s) => k.line([[x + d * r * 0.6 + s * r * 0.3, y + r * 0.25], [x + d * r * 0.6 + s * r * 1.1, y + r * (0.15 + s * 0.05)]], 0.005));
      faceOn(k, x, y, r, d);
      break;
    }
    case 'dog': {
      h = k.e(x, y, r * 1.05, r * 0.95, 0, z);
      const sn = k.rr(0.4, 0.75);
      if (side) k.e(x + d * r * (0.7 + sn * 0.3), y + r * 0.25, r * sn, r * 0.38, 0, z + 1);
      else k.e(x, y + r * 0.4, r * 0.5, r * 0.33, 0, z + 1);
      const flop = k.chance(0.6);
      ears((s) => (flop ? k.e(x + s * r * 0.85 - d * r * 0.3, y + r * 0.15, r * 0.26, r * k.rr(0.5, 0.75), -s * 0.3, z - 1) : k.tri([x + s * r * 0.3 - d * r * 0.2, y - r * 0.7], [x + s * r * 0.85 - d * r * 0.2, y - r * 0.4], [x + s * r * 0.7 - d * r * 0.2, y - r * 1.3], z - 1)));
      faceOn(k, x, y - r * 0.1, r, d, 0.8);
      break;
    }
    case 'fox': {
      h = k.e(x, y, r, r * 0.88, 0, z);
      if (side) k.tri([x + d * r * 0.4, y - r * 0.15], [x + d * r * 0.4, y + r * 0.55], [x + d * r * k.rr(1.4, 1.9), y + r * 0.3], z + 1);
      else k.tri([x - r * 0.45, y + r * 0.1], [x + r * 0.45, y + r * 0.1], [x, y + r * 1.1], z + 1);
      ears((s) => k.tri([x + s * r * 0.15 - d * r * 0.2, y - r * 0.65], [x + s * r * 0.85 - d * r * 0.2, y - r * 0.3], [x + s * r * 0.65 - d * r * 0.25, y - r * 1.6], z - 1));
      top = y - r * 1.6;
      faceOn(k, x, y - r * 0.1, r, d, 0.75);
      break;
    }
    case 'mouse': {
      h = k.c(x, y, r * 0.9, z);
      const er = k.rr(0.45, 0.7);
      ears((s) => k.c(x + s * r * 0.75 - d * r * 0.2, y - r * 0.75, r * er, z - 1));
      if (side) k.tri([x + d * r * 0.5, y - r * 0.2], [x + d * r * 0.5, y + r * 0.4], [x + d * r * 1.3, y + r * 0.2], z + 1);
      top = y - r * (0.75 + er);
      faceOn(k, x, y, r * 0.9, d);
      break;
    }
    case 'bear': {
      h = k.c(x, y, r, z);
      ears((s) => k.c(x + s * r * 0.72 - d * r * 0.15, y - r * 0.72, r * 0.3, z - 1));
      k.e(x + d * r * 0.55, y + r * 0.35, r * 0.42, r * 0.3, 0, z + 1);
      faceOn(k, x, y - r * 0.1, r, d, 0.8);
      break;
    }
    case 'bunny': {
      h = k.c(x, y, r, z);
      const len = k.rr(1.1, 1.9),
        lop = k.chance(0.3);
      ears((s) =>
        lop
          ? k.e(x + s * r * 0.9 - d * r * 0.2, y + r * 0.1, r * 0.25, r * len * 0.55, -s * 0.15, z - 1)
          : k.e(x + s * r * 0.35 - d * r * 0.25, y - r * (0.6 + len * 0.55), r * 0.24, r * len * 0.6, s * k.rr(0.05, 0.4), z - 1),
      );
      top = lop ? y - r : y - r * (0.6 + len * 1.1);
      faceOn(k, x, y, r, d);
      break;
    }
    case 'horse': {
      h = side ? k.e(x + d * r * 0.4, y + r * 0.35, r * 1.15, r * 0.55, -d * 0.7, z) : k.e(x, y + r * 0.3, r * 0.62, r * 1.15, 0, z);
      ears((s) => k.tri([x + s * r * 0.15 - d * r * 0.2, y - r * 0.45], [x + s * r * 0.45 - d * r * 0.2, y - r * 0.35], [x + s * r * 0.35 - d * r * 0.25, y - r * 1.05], z - 1));
      faceOn(k, x + d * r * 0.1, y, r, d, 0.75, -0.05);
      break;
    }
    case 'elephant': {
      h = k.c(x, y, r, z);
      if (side) k.e(x - d * r * 0.35, y + r * 0.05, r * 0.75, r * 0.95, 0, z + 1, { ink: true });
      else ears((s) => k.e(x + s * r * 1.05, y + r * 0.05, r * 0.7, r * 0.9, 0, z - 1));
      const tr = curve(k.r, x + d * r * 0.75, y + r * 0.3, r * k.rr(1.3, 2), Math.PI / 2 + d * 0.5, (side ? -d : k.sign()) * k.rr(0.8, 2.6), 8);
      k.tube(tr, r * 0.28, r * 0.13, z + 2, 6);
      if (k.chance(0.5)) k.line([[x + d * r * 0.5, y + r * 0.55], [x + d * r * 1.0, y + r * 0.8], [x + d * r * 1.15, y + r * 0.6]], 0.012);
      faceOn(k, x - d * r * 0.05, y - r * 0.15, r, d, 0.75);
      break;
    }
    case 'pig': {
      h = k.c(x, y, r, z);
      k.e(x + d * r * 0.95, y + r * 0.2, side ? r * 0.2 : r * 0.34, r * 0.28, 0, z + 1, { ink: true });
      ears((s) => k.tri([x + s * r * 0.25 - d * r * 0.2, y - r * 0.75], [x + s * r * 0.8 - d * r * 0.2, y - r * 0.5], [x + s * r * 0.75 - d * r * 0.2, y - r * 1.15], z - 1));
      faceOn(k, x, y - r * 0.15, r, d, 0.8);
      break;
    }
    case 'cow': {
      h = k.e(x, y, r * 1.05, r * 0.92, 0, z);
      k.e(x + d * r * 0.6, y + r * 0.5, r * 0.55, r * 0.35, 0, z + 1, { ink: true });
      const hr = k.rr(0.6, 1.4);
      ears((s) => {
        k.line(curve(k.r, x + s * r * 0.5, y - r * 0.7, r * hr, -Math.PI / 2 + s * 0.9, -s * k.rr(0.8, 1.8), 6), 0.016);
        k.e(x + s * r * 1.05, y - r * 0.2, r * 0.32, r * 0.16, s * 0.3, z - 1);
      });
      top = y - r * (0.7 + hr * 0.6);
      faceOn(k, x, y - r * 0.15, r, d, 0.8);
      break;
    }
    case 'deer': {
      h = k.e(x, y, r, r * 0.85, side ? -d * 0.3 : 0, z);
      ears((s) => {
        const a = curve(k.r, x + s * r * 0.35, y - r * 0.6, r * k.rr(1.4, 2.4), -Math.PI / 2 + s * 0.45, s * 0.5, 6);
        k.line(a, 0.011);
        for (const j of [2, 4]) if (a[j]) k.line([a[j]!, [a[j]![0] + s * r * 0.5, a[j]![1] - r * 0.35]], 0.009);
        k.e(x + s * r * 0.95, y - r * 0.25, r * 0.38, r * 0.18, s * 0.4, z - 1);
      });
      top = y - r * 2.4;
      faceOn(k, x, y, r, d, 0.75);
      break;
    }
    case 'lion': {
      const n = k.ri(7, 10),
        mr = r * k.rr(1.05, 1.35);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        k.c(x + Math.cos(a) * mr * 0.9, y + Math.sin(a) * mr * 0.9, r * k.rr(0.35, 0.5), z - 1);
      }
      h = k.c(x, y, r * 0.85, z);
      top = y - mr * 1.3;
      faceOn(k, x, y, r * 0.85, d);
      break;
    }
    case 'owl': {
      h = k.e(x, y, r * 1.2, r * 0.95, 0, z);
      ears((s) => k.tri([x + s * r * 0.55, y - r * 0.7], [x + s * r * 1.15, y - r * 0.55], [x + s * r * 1.05, y - r * 1.25], z - 1));
      faceOn(k, x, y, r * 1.1, 0);
      break;
    }
    case 'bird': {
      h = k.c(x, y, r, z);
      const bl = k.rr(0.45, 1.3);
      if (side) k.tri([x + d * r * 0.7, y - r * 0.15], [x + d * r * 0.7, y + r * 0.3], [x + d * r * (0.7 + bl), y + r * 0.12], z + 1, { ink: true });
      else k.tri([x - r * 0.22, y + r * 0.2], [x + r * 0.22, y + r * 0.2], [x, y + r * (0.2 + bl * 0.6)], z + 1, { ink: true });
      if (k.chance(0.4)) for (let i = 0; i < 3; i++) k.e(x - d * r * 0.2 + (i - 1) * r * 0.2, y - r * 1.05, r * 0.08, r * k.rr(0.25, 0.45), (i - 1) * 0.35 - d * 0.3, z - 1);
      faceOn(k, x - d * r * 0.1, y - r * 0.1, r, d, 0.8);
      break;
    }
    case 'frog': {
      h = k.e(x, y, r * 1.25, r * 0.8, 0, z);
      ears((s) => k.c(x + s * r * 0.6, y - r * 0.6, r * 0.38, z + 1, { ink: true }));
      top = y - r;
      k.face(x, y - r * 0.15, r * 1.05);
      break;
    }
    case 'robot': {
      h = k.rect(x, y, r * 2.1, r * k.rr(1.6, 2.1), 0, k.rr(0.05, 0.3), z, { ink: true });
      const ah = k.rr(0.6, 1.2);
      k.line([[x, y - r * 0.9], [x + k.rr(-0.2, 0.2) * r, y - r * (0.9 + ah)]], 0.007);
      k.c(x, y - r * (0.95 + ah), r * 0.14, z + 1, { ink: true });
      ears((s) => k.rect(x + s * r * 1.12, y, r * 0.25, r * 0.6, 0, 0.2, z - 1));
      top = y - r * (1.1 + ah);
      faceOn(k, x, y, r, d, 0.85);
      break;
    }
    case 'tv': {
      h = k.rect(x, y, r * 2.4, r * 1.8, 0, 0.12, z, { ink: true });
      k.line([[x - r * 0.95, y - r * 0.6], [x + r * 0.95, y - r * 0.6], [x + r * 0.95, y + r * 0.6], [x - r * 0.95, y + r * 0.6], [x - r * 0.95, y - r * 0.6]], 0.006);
      ears((s) => k.line([[x, y - r * 0.9], [x + s * r * 0.9, y - r * 1.9]], 0.006));
      top = y - r * 1.9;
      k.face(x, y, r * 0.8);
      break;
    }
    case 'dragon': {
      h = k.e(x, y, r, r * 0.85, 0, z);
      if (side) k.e(x + d * r * 0.95, y + r * 0.2, r * 0.7, r * 0.38, 0, z + 1);
      else k.e(x, y + r * 0.45, r * 0.55, r * 0.35, 0, z + 1);
      ears((s) => k.line(curve(k.r, x + s * r * 0.4 - d * r * 0.3, y - r * 0.6, r * k.rr(1, 1.6), -Math.PI / 2 - d * 0.8 + s * 0.3, -d * 0.8, 6), 0.013));
      if (k.chance(0.7)) ears((s) => k.line(curve(k.r, x + d * r * 1.4, y + r * 0.25 + s * r * 0.08, r * k.rr(1.2, 2.2), side ? (d < 0 ? Math.PI : 0) + s * 0.4 : Math.PI / 2 + s * 0.8, s * k.rr(0.5, 2), 9, 0.2), 0.006));
      top = y - r * 1.6;
      faceOn(k, x, y - r * 0.1, r, d, 0.75);
      break;
    }
    case 'croc': {
      h = k.e(x, y, r * 0.9, r * 0.6, 0, z);
      const jl = k.rr(1.4, 2.2);
      if (side) {
        k.rect(x + d * r * (0.6 + jl * 0.5), y + r * 0.1, r * jl, r * 0.45, 0, 0.35, z + 1);
        k.line([[x + d * r * 0.5, y + r * 0.3], [x + d * r * (0.6 + jl), y + r * 0.3]], 0.005);
      } else k.e(x, y + r * 0.6, r * 0.7, r * 0.5, 0, z + 1);
      ears((s) => k.c(x + s * r * 0.4 - d * r * 0.2, y - r * 0.5, r * 0.28, z + 1, { ink: true }));
      faceOn(k, x - d * r * 0.1, y - r * 0.3, r * 0.8, d, 0.75);
      break;
    }
    case 'moai': {
      h = k.rect(x, y + r * 0.3, r * 1.4, r * 2.6, 0, 0.12, z, { ink: true });
      k.rect(x, y - r * 0.35, r * 1.6, r * 0.4, 0, 0.2, z + 1);
      k.rect(x + (side ? d * r * 0.3 : 0), y + r * 0.35, r * 0.4, r * 0.9, 0, 0.3, z + 1);
      top = y - r * 1.05;
      k.face(x, y - r * 0.05, r * 0.7, {});
      break;
    }
    case 'pumpkin': {
      const w = k.rr(1.1, 1.4);
      k.e(x - r * 0.55, y, r * w * 0.55, r * 0.85, 0.1, z - 1);
      k.e(x + r * 0.55, y, r * w * 0.55, r * 0.85, -0.1, z - 1);
      h = k.e(x, y, r * w * 0.6, r * 0.9, 0, z);
      k.line([[x, y - r * 0.85], [x + r * 0.15, y - r * 1.3]], 0.012);
      if (k.chance(0.6)) k.e(x + r * 0.45, y - r * 1.15, r * 0.3, r * 0.14, -0.4, z + 1, { leaf: true });
      top = y - r * 1.3;
      k.face(x, y + r * 0.05, r * 0.85);
      break;
    }
    case 'chibi': {
      h = k.c(x, y, r * 1.25, z);
      k.line(curve(k.r, x + k.rr(-0.3, 0.3) * r, y - r * 1.2, r * k.rr(0.5, 0.9), -Math.PI / 2 + k.rr(-0.4, 0.4), k.sign() * k.rr(1.5, 3), 6), 0.009);
      top = y - r * 1.9;
      k.face(x + d * r * 0.2, y + r * 0.15, r * 1.1);
      break;
    }
    case 'skull': {
      h = k.c(x, y, r, z);
      k.rect(x + d * r * 0.2, y + r * 0.85, r * 1.1, r * 0.5, 0, 0.3, z + 1);
      k.face(x + d * r * 0.2, y - r * 0.05, r * 0.85);
      break;
    }
    default: {
      h = k.c(x, y, r, z);
      faceOn(k, x, y, r, d);
    }
  }
  return { h, x, y, r, dir: d, top };
}

/* ---------- Hüte und Schmuck auf dem Kopf ---------- */
export const HATS = ['top', 'witch', 'cap', 'crown', 'flower', 'bow', 'party', 'leaf', 'halo'] as const;
export type HatKind = (typeof HATS)[number];
export function hat(k: Kit, hd: Head, kind: HatKind, z = 4): void {
  const { x, r } = hd,
    y = hd.top + r * 0.15,
    tilt = k.rr(-0.25, 0.25);
  switch (kind) {
    case 'top':
      k.rect(x, y, r * 1.9, r * 0.22, tilt, 0.3, z);
      k.rect(x + Math.sin(tilt) * r * 0.5, y - r * 0.55, r * 1.1, r * 1.0, tilt, 0.1, z + 1, { ink: true });
      break;
    case 'witch':
      k.e(x, y, r * 1.15, r * 0.16, tilt, z);
      k.tri([x - r * 0.55, y - r * 0.05], [x + r * 0.55, y - r * 0.05], [x + k.rr(-0.6, 0.6) * r, y - r * k.rr(1.4, 2.2)], z + 1, { ink: true });
      break;
    case 'cap':
      k.lathe(x, y - r * 0.55, r * 0.6, r * 0.75, (t) => Math.sqrt(t), 6, z + 1, { ink: true });
      k.e(x - r * 0.6, y + r * 0.02, r * 0.55, r * 0.1, 0.1, z);
      break;
    case 'crown':
      k.poly([[x - r * 0.7, y + r * 0.1], [x - r * 0.75, y - r * 0.6], [x - r * 0.35, y - r * 0.25], [x, y - r * 0.75], [x + r * 0.35, y - r * 0.25], [x + r * 0.75, y - r * 0.6], [x + r * 0.7, y + r * 0.1]], z + 1, { ink: true });
      break;
    case 'flower':
      k.star(x + r * 0.4, y - r * 0.1, r * 0.18, r * 0.42, 5, k.rr(0, 1), z + 1, { ink: true });
      break;
    case 'bow':
      k.tri([x, y - r * 0.05], [x - r * 0.6, y - r * 0.4], [x - r * 0.6, y + r * 0.3], z + 1);
      k.tri([x, y - r * 0.05], [x + r * 0.6, y - r * 0.4], [x + r * 0.6, y + r * 0.3], z + 1);
      k.c(x, y - r * 0.05, r * 0.15, z + 2, { ink: true });
      break;
    case 'party':
      k.tri([x - r * 0.4, y + r * 0.05], [x + r * 0.4, y + r * 0.05], [x + tilt * r, y - r * 1.3], z + 1, { ink: true });
      k.c(x + tilt * r, y - r * 1.35, r * 0.16, z + 2);
      break;
    case 'leaf':
      k.line([[x, y], [x + r * 0.1, y - r * 0.6]], 0.008);
      k.e(x + r * 0.35, y - r * 0.6, r * 0.35, r * 0.15, -0.5, z + 1, { leaf: true });
      break;
    case 'halo':
      k.ring(x, y - r * 0.5, r * 0.75, r * 0.2, 0.008);
      break;
  }
}

/* ---------- Schwänze ---------- */
export const TAILS = ['curl', 'straight', 'bushy', 'fat', 'tuft', 'fish', 'multi', 'stub', 'peacock', 'sting', 'propeller', 'spiral'] as const;
export type TailKind = (typeof TAILS)[number];
/** Schwanz ab (x, y), back zeigt nach hinten (+1 rechts, -1 links), s ist die Körpergröße */
export function tail(k: Kit, kind: TailKind, x: number, y: number, back: number, s: number, z = -2): void {
  const up = -Math.PI / 2,
    base = back > 0 ? 0 : Math.PI;
  const ang = (a: number) => (back > 0 ? a : Math.PI - a);
  switch (kind) {
    case 'curl':
      k.line(curve(k.r, x, y, s * k.rr(0.9, 1.6), ang(k.rr(-1.2, -0.2)), -back * k.rr(1.5, 3.5), 9), 0.013);
      break;
    case 'straight':
      k.line(curve(k.r, x, y, s * k.rr(0.7, 1.3), ang(k.rr(-0.2, 0.6)), back * k.rr(-0.4, 0.4), 6), 0.013);
      break;
    case 'bushy': {
      const pts = curve(k.r, x, y, s * k.rr(0.9, 1.4), ang(k.rr(-1.3, -0.4)), -back * k.rr(0.3, 1.5), 8);
      k.tube(pts, s * 0.12, s * 0.3, z, 6);
      break;
    }
    case 'fat':
      k.tube(curve(k.r, x, y, s * k.rr(1, 1.8), ang(k.rr(-0.1, 0.4)), back * k.rr(-1.5, 1), 10), s * 0.28, s * 0.04, z, 8);
      break;
    case 'tuft': {
      const pts = curve(k.r, x, y, s * k.rr(0.8, 1.3), ang(k.rr(-0.4, 0.5)), back * k.rr(-1, 1), 7);
      k.line(pts, 0.011);
      const e = pts[pts.length - 1]!;
      k.e(e[0], e[1], s * 0.12, s * 0.18, k.rr(0, 3), z);
      break;
    }
    case 'fish': {
      const e: Pt = [x + back * s * 0.35, y];
      k.e(e[0], e[1] - s * 0.18, s * 0.32, s * 0.12, ang(-0.6), z);
      k.e(e[0], e[1] + s * 0.18, s * 0.32, s * 0.12, ang(0.6), z);
      break;
    }
    case 'multi': {
      const n = k.ri(3, 7);
      for (let i = 0; i < n; i++) {
        const a = ang(-1.5 + (1.6 * i) / Math.max(1, n - 1));
        k.tube(curve(k.r, x, y, s * k.rr(0.9, 1.2), a, -back * 0.6, 6), s * 0.09, s * 0.2, z, 3);
      }
      break;
    }
    case 'stub':
      k.c(x + back * s * 0.08, y - s * 0.05, s * 0.16, z);
      break;
    case 'peacock': {
      const n = k.ri(5, 9);
      for (let i = 0; i < n; i++) {
        const a = up + ((i - (n - 1) / 2) / n) * 2.6,
          L = s * k.rr(0.9, 1.3);
        k.e(x + Math.cos(a) * L * 0.6, y + Math.sin(a) * L * 0.6, L * 0.55, s * 0.18, a, z - 1, { wing: true });
      }
      break;
    }
    case 'sting': {
      const pts = curve(k.r, x, y, s * k.rr(1.2, 1.8), ang(-0.9), -back * k.rr(2.8, 3.6), 10);
      k.tube(pts, s * 0.13, s * 0.08, z, 7);
      const e = pts[pts.length - 1]!;
      k.tri([e[0] - s * 0.06, e[1]], [e[0] + s * 0.06, e[1]], [e[0] - back * s * 0.1, e[1] + s * 0.22], z + 5, { ink: true });
      break;
    }
    case 'propeller': {
      k.c(x + back * s * 0.05, y, s * 0.08, z + 1, { ink: true });
      const a0 = k.rr(0, 3);
      for (const a of [a0, a0 + Math.PI]) k.e(x + back * s * 0.05, y + Math.sin(a) * s * 0.22, s * 0.05, s * 0.22, 0, z);
      break;
    }
    case 'spiral': {
      const pts: Pt[] = [];
      const turns = k.rr(1.2, 2.2),
        R = s * k.rr(0.35, 0.55);
      for (let i = 0; i <= 24; i++) {
        const t = i / 24,
          a = base + up * 0 - back * t * turns * Math.PI * 2,
          rad = R * (1 - t * 0.85);
        pts.push([x + back * R + Math.cos(a + Math.PI) * rad * back, y - R * 0.2 + Math.sin(a) * rad]);
      }
      k.line(pts, 0.011);
      break;
    }
  }
}

/* ---------- Beine ---------- */
export type LegKind = 'pillar' | 'thin' | 'jointed' | 'stub' | 'paw' | 'wheel' | 'claw' | 'hoof';
export function leg(k: Kit, kind: LegKind, x: number, y: number, len: number, w: number, lean: number, z: number): void {
  const fx = x + lean * len,
    fy = y + len;
  switch (kind) {
    case 'pillar':
      k.e((x + fx) / 2, y + len * 0.5, w, len * 0.55, -lean * 0.6, z);
      break;
    case 'hoof':
      k.e((x + fx) / 2, y + len * 0.45, w * 0.8, len * 0.5, -lean * 0.6, z);
      k.rect(fx, fy - w * 0.3, w * 1.8, w * 0.8, 0, 0.2, z + 1, { ink: true });
      break;
    case 'thin':
      k.line([[x, y], [fx, fy]], Math.max(0.008, w * 0.6));
      k.e(fx - 0.006, fy, w * 0.9, w * 0.5, 0, z);
      break;
    case 'jointed':
      k.line([[x, y], [x + lean * len * 0.5 + w, y + len * 0.45], [fx, fy]], Math.max(0.008, w * 0.55));
      break;
    case 'stub':
      k.e(fx, fy - len * 0.25, w * 1.3, len * 0.35, 0, z);
      break;
    case 'paw':
      k.e((x + fx) / 2, y + len * 0.5, w * 0.85, len * 0.55, -lean * 0.6, z);
      k.e(fx - w * 0.3, fy - w * 0.2, w * 1.25, w * 0.65, 0, z + 1);
      break;
    case 'claw':
      k.line([[x, y], [fx, fy]], Math.max(0.008, w * 0.6));
      for (const a of [-0.6, 0, 0.6]) k.line([[fx, fy], [fx + Math.sin(a) * w * 2, fy + Math.cos(a) * w * 1.2]], 0.006);
      break;
    case 'wheel':
      wheel(k, fx, fy - w * 1.6, w * 1.6, z);
      break;
  }
}
export function wheel(k: Kit, x: number, y: number, r: number, z = 1, spokes = true): void {
  k.c(x, y, r, z, { ink: true });
  k.c(x, y, r * 0.3, z + 1, { ink: true });
  if (spokes) {
    const a0 = k.rr(0, 1);
    for (let i = 0; i < 3; i++) {
      const a = a0 + (i * Math.PI) / 3;
      k.line([[x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85], [x - Math.cos(a) * r * 0.85, y - Math.sin(a) * r * 0.85]], 0.005);
    }
  }
}

/* ---------- Flügel ---------- */
export type WingKind = 'feather' | 'bat' | 'insect' | 'butterfly' | 'tiny' | 'plane' | 'angel';
/** Flügel an der Schulter (x, y), s ist die Körpergröße. side: nur ein Flügel sichtbar (Seitenansicht) */
export function wings(k: Kit, kind: WingKind, x: number, y: number, s: number, side: boolean, z = -3, raise = k.rr(-0.3, 1)): void {
  const sides = side ? [1] : [-1, 1];
  for (const sg of sides) {
    const out = (a: number) => (sg > 0 ? a : Math.PI - a);
    const sx = side ? x : x + sg * s * 0.15;
    switch (kind) {
      case 'feather':
      case 'angel': {
        const n = kind === 'angel' ? 4 : k.ri(3, 4);
        for (let i = 0; i < n; i++) {
          const a = out(-0.25 - raise * 0.9 + i * 0.32),
            L = s * (1.2 - i * 0.18) * (kind === 'angel' ? 0.8 : 1);
          k.e(sx + Math.cos(a) * L * 0.55, y + Math.sin(a) * L * 0.55, L * 0.55, s * 0.13, a, z, { wing: true });
        }
        break;
      }
      case 'bat': {
        const n = k.ri(2, 3);
        for (let i = 0; i < n; i++) {
          const a = out(-0.4 - raise * 0.6 + i * 0.4),
            L = s * (0.6 + i * 0.25);
          k.e(sx + Math.cos(a) * L, y + Math.sin(a) * L, s * 0.32, s * 0.22, a, z, { wing: true });
          k.line([[sx, y], [sx + Math.cos(a) * L * 1.5, y + Math.sin(a) * L * 1.5]], 0.006);
        }
        break;
      }
      case 'insect':
        for (const off of [-0.35, 0.25]) {
          const a = out(off - raise * 0.4);
          k.e(sx + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7, s * 0.75, s * 0.14, a, z, { wing: true });
        }
        break;
      case 'butterfly': {
        const a1 = out(-0.6 - raise * 0.4),
          a2 = out(0.5);
        k.e(sx + Math.cos(a1) * s * 0.65, y + Math.sin(a1) * s * 0.65, s * 0.7, s * 0.52, a1, z, { wing: true });
        k.e(sx + Math.cos(a2) * s * 0.5, y + Math.sin(a2) * s * 0.5, s * 0.48, s * 0.38, a2, z, { wing: true });
        break;
      }
      case 'tiny': {
        const a = out(-0.8 - raise * 0.3);
        k.e(sx + Math.cos(a) * s * 0.35, y + Math.sin(a) * s * 0.35, s * 0.32, s * 0.18, a, z, { wing: true });
        break;
      }
      case 'plane': {
        const L = s * k.rr(1, 1.5);
        k.poly([[sx, y - s * 0.12], [sx + sg * L, y - s * 0.02 - raise * s * 0.2], [sx + sg * L, y + s * 0.1 - raise * s * 0.2], [sx - sg * s * 0.1, y + s * 0.14]], z, { ink: true, crisp: 0.2 });
        break;
      }
    }
  }
}
