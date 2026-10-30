/*
 * Dinge als Vorlagen: Gefäße und Drehkörper, Fahrzeuge, Geräte, Möbel, Essen und Pflanzen.
 * Alle bekommen ein Gesicht und oft Beinchen, damit sie Monster bleiben.
 */
import type { Pt } from '../data';
import type { Arche } from './animals';
import { biped, trimmings } from './animals';
import { curve, edge, type B, type Kit } from './kit';
import { head, leg, wheel, wings, type LegKind } from './parts';

const G = 0.82;
const sin = Math.sin,
  PI = Math.PI;

/** Kleine Beine unter einem Ding, manchmal keine */
function feet(k: Kit, b: B, p = 0.55): void {
  if (!k.chance(p)) return;
  const kind = k.pick(['thin', 'stub', 'claw', 'paw', 'jointed'] as LegKind[]),
    n = k.pick([2, 2, 3, 4]),
    len = k.rr(0.04, 0.12);
  for (let i = 0; i < n; i++) leg(k, kind, b.x - b.rx * 0.6 + (b.rx * 1.2 * i) / Math.max(1, n - 1), b.y + b.ry * 0.85, len, k.rr(0.012, 0.02), k.rr(-0.2, 0.2), i % 2 ? -1 : 1);
}
/** Ärmchen an den Seiten */
function arms(k: Kit, b: B, p = 0.45): void {
  if (!k.chance(p)) return;
  for (const s of [-1, 1]) k.line(curve(k.r, b.x + s * b.rx * 0.95, b.y - b.ry * k.rr(-0.1, 0.3), b.rx * k.rr(0.5, 0.9), s > 0 ? k.rr(-1, 0.7) : PI - k.rr(-1, 0.7), s * k.rr(-1, 1), 5), 0.01);
}
const bodyFace = (k: Kit, b: B, dy = 0, kf = 0.7) => k.face(b.x, b.y + b.ry * dy, Math.min(b.rx, b.ry) * kf);

/* ---------- Profile für Drehkörper (Breite 0 bis 1 von oben nach unten) ---------- */
const PROF: Record<string, (t: number) => number> = {
  vase: (t) => 0.3 + 0.7 * Math.pow(sin(Math.min(1, t * 1.05) * PI), 0.8) * (t < 0.12 ? 0.5 : 1),
  amphora: (t) => (t < 0.12 ? 0.45 : t < 0.25 ? 0.3 : 0.3 + 0.7 * Math.pow(sin(((t - 0.25) / 0.75) * PI), 0.7)),
  bottle: (t) => (t < 0.35 ? 0.28 : t < 0.5 ? 0.28 + ((t - 0.35) / 0.15) * 0.72 : 1),
  jar: (t) => 0.75 + 0.25 * sin(t * PI),
  bell: (t) => 0.2 + 0.8 * Math.pow(t, 1.6),
  hourglass: (t) => 0.15 + 0.85 * Math.abs(1 - 2 * t),
  gourd: (t) => (t < 0.4 ? 0.55 * sin((t / 0.4) * PI) + 0.1 : 0.15 + 0.85 * sin(((t - 0.4) / 0.6) * PI)),
  urn: (t) => (t < 0.15 ? 0.8 : t < 0.25 ? 0.45 : t > 0.9 ? 0.5 : 0.45 + 0.55 * sin(((t - 0.25) / 0.65) * PI)),
  egg: (t) => Math.sqrt(Math.max(0, sin(t * PI))) * (0.75 + 0.25 * t),
};

export const THINGS: Arche[] = [
  /* ----- Gefäße und Drehkörper ----- */
  {
    id: 'vessel',
    n: 'vessel',
    bp: 'knolle',
    w: 1.5,
    make: (k) => {
      const kind = k.pick(Object.keys(PROF)),
        h = k.rr(0.32, 0.5),
        w = h * k.rr(0.35, 0.65);
      const b = k.lathe(0.5, G - h, h, w, PROF[kind]!, 10, 0, { ink: true });
      if (k.chance(0.5)) for (const s of [-1, 1]) k.ring(0.5 + s * w * 0.95, G - h * 0.65, w * 0.3, h * 0.15, 0.012, s > 0 ? -PI / 2 : PI / 2, s > 0 ? PI / 2 : PI * 1.5, 8);
      for (let i = 0; i < k.ri(0, 3); i++) k.line([[0.5 - w * 0.8, G - h * (0.3 + i * 0.12)], [0.5 + w * 0.8, G - h * (0.3 + i * 0.12)]], 0.005);
      if (k.chance(0.3)) for (let i = 0; i < k.ri(2, 4); i++) {
        const a = curve(k.r, 0.5 + k.rr(-0.04, 0.04), G - h, k.rr(0.12, 0.22), -PI / 2 + k.rr(-0.7, 0.7), k.rr(-1, 1), 5);
        k.line(a, 0.007);
        k.star(a[a.length - 1]![0], a[a.length - 1]![1], 0.015, 0.035, 5, k.rr(0, 1), 2);
      }
      k.face(0.5, G - h * 0.45, w * 0.55);
      feet(k, b, 0.35);
      arms(k, b, 0.3);
    },
  },
  {
    id: 'teapot',
    n: 'teapot',
    bp: 'knolle',
    w: 1.2,
    make: (k) => {
      const w = k.rr(0.13, 0.18),
        h = w * k.rr(0.75, 1.15),
        cy = G - h - 0.02;
      const body = k.e(0.5, cy, w, h, 0, 0, { ink: true });
      const sp = curve(k.r, 0.5 - w * 0.8, cy + h * 0.2, w * k.rr(0.8, 1.2), PI + 0.5, k.rr(0.6, 1.2), 6);
      k.tube(sp, w * 0.18, w * 0.08, -1, 5);
      k.ring(0.5 + w * 1.0, cy, w * 0.35, h * 0.45, 0.014, -PI / 2, PI / 2, 8);
      k.lathe(0.5, cy - h - w * 0.15, w * 0.3, w * 0.5, (t) => 0.4 + 0.6 * t, 4, 1);
      k.c(0.5, cy - h - w * 0.2, w * 0.1, 2, { ink: true });
      if (k.chance(0.4)) for (let i = 0; i < 3; i++) k.line(curve(k.r, sp[sp.length - 1]![0] + i * 0.02, sp[sp.length - 1]![1] - 0.02, 0.12, -PI / 2, k.rr(-1, 1), 6, 0.3), 0.005);
      bodyFace(k, body, 0.05, 0.7);
      feet(k, body, 0.4);
      trimmings(k, null, body);
    },
  },
  {
    id: 'mug',
    n: 'mug',
    bp: 'knolle',
    make: (k) => {
      const w = k.rr(0.1, 0.15),
        h = w * k.rr(1.1, 1.7),
        b = k.rect(0.48, G - h / 2, w * 2, h, 0, 0.15, 0, { ink: true });
      k.ring(0.48 + w * 1.05, G - h * 0.5, w * 0.45, h * 0.3, 0.016, -PI / 2, PI / 2, 8);
      for (let i = 0; i < 3; i++) k.line(curve(k.r, 0.48 - w * 0.5 + i * w * 0.5, G - h - 0.02, k.rr(0.08, 0.14), -PI / 2, k.rr(-1.5, 1.5), 6, 0.4), 0.006);
      bodyFace(k, b, 0, 0.75);
      arms(k, b, 0.3);
    },
  },
  {
    id: 'chess',
    n: 'chess piece',
    bp: 'turm',
    w: 2,
    kinds: [
      { k: 'pawn', n: 'pawn' },
      { k: 'rook', n: 'rook' },
      { k: 'king', n: 'king' },
      { k: 'bishop', n: 'bishop' },
      { k: 'knight', n: 'knight', bp: 'vierbeiner' },
    ],
    make: (k) => {
      const kind = k.kind(['pawn', 'rook', 'king', 'bishop', 'knight']),
        w = k.rr(0.1, 0.14);
      k.lathe(0.5, G - 0.06, 0.06, w, (t) => 0.8 + 0.2 * t, 4, 0, { ink: true });
      const body = k.lathe(0.5, G - 0.32, 0.27, w * 0.75, (t) => 0.45 + 0.55 * t * t, 8, 1, { ink: true });
      if (kind === 'pawn') head(k, 'round', 0.5, G - 0.38, w * 0.6, 0, 2);
      else if (kind === 'rook') {
        k.poly([[0.5 - w * 0.75, G - 0.3], [0.5 - w * 0.75, G - 0.42], [0.5 - w * 0.45, G - 0.42], [0.5 - w * 0.45, G - 0.38], [0.5 - w * 0.15, G - 0.38], [0.5 - w * 0.15, G - 0.42], [0.5 + w * 0.15, G - 0.42], [0.5 + w * 0.15, G - 0.38], [0.5 + w * 0.45, G - 0.38], [0.5 + w * 0.45, G - 0.42], [0.5 + w * 0.75, G - 0.42], [0.5 + w * 0.75, G - 0.3]], 2, { ink: true, crisp: 0.15 });
        k.face(0.5, G - 0.22, w * 0.5);
      } else if (kind === 'knight') head(k, 'horse', 0.5, G - 0.42, w * 0.75, -1, 2);
      else {
        const hd = head(k, 'round', 0.5, G - 0.4, w * 0.55, 0, 2);
        if (kind === 'king') {
          k.line([[0.5, hd.top], [0.5, hd.top - 0.06]], 0.01);
          k.line([[0.48, hd.top - 0.04], [0.52, hd.top - 0.04]], 0.01);
        } else k.tri([0.5 - w * 0.35, hd.top + 0.02], [0.5 + w * 0.35, hd.top + 0.02], [0.5, hd.top - 0.08], 3, { ink: true });
      }
      arms(k, body, 0.35);
    },
  },
  {
    id: 'lighthouse',
    n: 'beacon',
    bp: 'turm',
    make: (k) => {
      const w = k.rr(0.07, 0.1),
        h = k.rr(0.38, 0.52);
      const t = k.lathe(0.5, G - h, h, w, (x) => 0.65 + 0.35 * x, 6, 0, { ink: true });
      for (let i = 1; i < 4; i++) k.line([[0.5 - w * 0.8, G - h * (i / 4)], [0.5 + w * 0.8, G - h * (i / 4)]], 0.012);
      k.rect(0.5, G - h - 0.04, w * 1.6, 0.07, 0, 0.1, 1, { ink: true });
      k.tri([0.5 - w * 0.9, G - h - 0.075], [0.5 + w * 0.9, G - h - 0.075], [0.5, G - h - 0.16], 1, { ink: true });
      for (const s of [-1, 1]) k.poly([[0.5 + s * w * 0.8, G - h - 0.05], [0.5 + s * k.rr(0.25, 0.35), G - h - 0.1], [0.5 + s * k.rr(0.25, 0.35), G - h + 0.01]], -1, { wing: true });
      k.face(0.5, G - h * 0.55, w * 0.8);
      void t;
    },
  },
  {
    id: 'rocket',
    n: 'rocket',
    bp: 'turm',
    make: (k) => {
      const w = k.rr(0.07, 0.11),
        h = k.rr(0.38, 0.5),
        top = G - h - 0.06;
      const b = k.lathe(0.5, top, h, w, (t) => (t < 0.3 ? Math.sqrt(t / 0.3) : 1), 8, 0, { ink: true });
      for (const s of [-1, 1]) k.tri([0.5 + s * w, G - 0.06 - h * 0.3], [0.5 + s * w, G - 0.06], [0.5 + s * w * 2, G - 0.02], -1, { ink: true });
      k.ring(0.5, top + h * 0.45, w * 0.45, w * 0.45, 0.008);
      k.e(0.5, G, w * 0.5, 0.06, 0, -2, { wing: true });
      bodyFace(k, b, 0.15, 0.6);
    },
  },
  {
    id: 'candle',
    n: 'candle',
    bp: 'turm',
    make: (k) => {
      const w = k.rr(0.06, 0.1),
        h = k.rr(0.25, 0.42);
      const b = k.rect(0.5, G - h / 2, w * 2, h, k.rr(-0.06, 0.06), 0.1, 0, { ink: true });
      for (let i = 0; i < k.ri(1, 3); i++) k.e(0.5 + k.rr(-0.8, 0.8) * w, G - h + k.rr(0.02, 0.08), 0.012, k.rr(0.02, 0.05), 0, 1);
      k.line([[0.5, G - h], [0.5, G - h - 0.03]], 0.006);
      k.e(0.5, G - h - 0.07, 0.03, 0.05, 0, 1, { wing: true });
      if (k.chance(0.5)) k.lathe(0.5, G - 0.04, 0.04, w * 2.2, () => 1, 2, 1);
      bodyFace(k, b, 0, 0.8);
      arms(k, b, 0.4);
    },
  },
  {
    id: 'lamp',
    n: 'lamp',
    bp: 'turm',
    make: (k) => {
      const w = k.rr(0.12, 0.18),
        sh = k.rr(0.12, 0.18),
        stem = k.rr(0.18, 0.3),
        top = G - stem - sh;
      const shade = k.poly([[0.5 - w * 0.5, top], [0.5 + w * 0.5, top], [0.5 + w, top + sh], [0.5 - w, top + sh]], 1, { ink: true });
      k.line([[0.5, top + sh], [0.5 + k.rr(-0.04, 0.04), G - 0.02]], 0.014);
      k.e(0.5, G - 0.015, w * 0.7, 0.02, 0, 0);
      if (k.chance(0.5)) k.line([[0.5 + w * 0.6, top + sh], [0.5 + w * 0.6, top + sh + 0.07]], 0.005);
      k.face(0.5, top + sh * 0.55, sh * 0.5);
      void shade;
    },
  },
  {
    id: 'hourglass',
    n: 'hourglass',
    bp: 'turm',
    make: (k) => {
      const h = k.rr(0.3, 0.42),
        w = k.rr(0.1, 0.14);
      k.rect(0.5, G - h - 0.03, w * 2.4, 0.04, 0, 0.3, 1, { ink: true });
      k.rect(0.5, G - 0.02, w * 2.4, 0.04, 0, 0.3, 1, { ink: true });
      const b = k.lathe(0.5, G - h - 0.01, h - 0.02, w, PROF.hourglass!, 10, 0, { ink: true });
      for (const s of [-1, 1]) k.line([[0.5 + s * w * 1.05, G - h - 0.01], [0.5 + s * w * 1.05, G - 0.04]], 0.008);
      k.face(0.5, G - h * 0.75, w * 0.6);
      void b;
    },
  },

  /* ----- Fahrzeuge ----- */
  {
    id: 'car',
    n: 'car',
    bp: 'kriecher',
    w: 1.2,
    make: (k) => {
      const L = k.rr(0.2, 0.3),
        H = k.rr(0.06, 0.1),
        wr = k.rr(0.04, 0.07),
        cy = G - wr - H * 0.5;
      const body = k.rect(0.5, cy, L * 2, H * 2, 0, k.rr(0.2, 0.5), 0, { ink: true });
      const cab = k.rr(0.5, 0.8);
      k.poly([[0.5 - L * cab * 0.8, cy - H], [0.5 - L * cab * 0.5, cy - H - H * k.rr(1, 1.6)], [0.5 + L * cab * 0.5, cy - H - H * k.rr(1, 1.6)], [0.5 + L * cab * 0.7, cy - H]], -1, { ink: true });
      for (const s of [-1, 1]) wheel(k, 0.5 + s * L * 0.65, G - wr, wr, 1);
      if (k.chance(0.5)) k.c(0.5 - L * 1.0, cy, H * 0.35, 1, { ink: true });
      k.face(0.5 - L * 0.65, cy - H * 0.1, H * 0.95);
      trimmings(k, null, null);
      void body;
    },
  },
  {
    id: 'train',
    n: 'engine',
    bp: 'kriecher',
    make: (k) => {
      const L = k.rr(0.22, 0.3),
        R = k.rr(0.07, 0.1),
        wr = k.rr(0.035, 0.05),
        cy = G - wr * 2 - R;
      k.rect(0.5 - L * 0.15, cy, L * 1.7, R * 2, 0, 0.45, 0, { ink: true });
      k.rect(0.5 + L * 0.7, cy - R * 0.6, L * 0.6, R * 3.2, 0, 0.08, 1, { ink: true });
      k.rect(0.5 + L * 0.7, cy - R * 2.3, L * 0.8, R * 0.3, 0, 0.3, 2);
      k.lathe(0.5 - L * 0.6, cy - R - 0.1, 0.1, R * 0.4, (t) => 1 - 0.5 * t, 4, 1, { ink: true });
      for (let i = 0; i < k.ri(1, 4); i++) k.c(0.5 - L * 0.6 + i * 0.05 + 0.02, cy - R - 0.13 - i * 0.05, 0.03 + i * 0.01, -2, { wing: true });
      k.tri([0.5 - L, cy + R * 0.2], [0.5 - L, G - 0.005], [0.5 - L - R * 0.8, G - 0.005], 1, { ink: true });
      for (let i = 0; i < 3; i++) wheel(k, 0.5 - L * 0.6 + i * L * 0.6, G - wr, wr, 2);
      k.face(0.5 - L * 0.95, cy, R * 0.8);
    },
  },
  {
    id: 'tractor',
    n: 'big-wheel',
    bp: 'kriecher',
    make: (k) => {
      const big = k.rr(0.09, 0.13),
        small = big * k.rr(0.45, 0.65);
      const body = k.rect(0.47, G - big - 0.02, k.rr(0.25, 0.32), k.rr(0.08, 0.11), 0, 0.2, 0, { ink: true });
      k.rect(0.55, G - big * 2 - 0.05, 0.12, 0.14, 0, 0.1, -1, { ink: true });
      wheel(k, 0.6, G - big, big, 2);
      wheel(k, 0.35, G - small, small, 2);
      k.line([[0.4, body.y - body.ry], [0.4, body.y - body.ry - 0.08]], 0.014);
      k.face(0.38, body.y, body.ry * 0.8);
    },
  },
  {
    id: 'boat',
    n: 'sailboat',
    bp: 'schwebeblase',
    make: (k) => {
      const L = k.rr(0.2, 0.28),
        H = k.rr(0.06, 0.09);
      const hull = k.poly([[0.5 - L, G - H * 2], [0.5 + L, G - H * 2], [0.5 + L * 0.75, G - 0.02], [0.5 - L * 0.65, G - 0.02]], 0, { ink: true, crisp: 0.3 });
      const mh = k.rr(0.3, 0.45);
      k.line([[0.5, G - H * 2], [0.5, G - H * 2 - mh]], 0.01);
      k.tri([0.51, G - H * 2 - mh], [0.51, G - H * 2 - 0.02], [0.5 + L * k.rr(0.7, 1), G - H * 2 - 0.02], -1, { wing: true, ink: true });
      if (k.chance(0.6)) k.tri([0.49, G - H * 2 - mh * 0.85], [0.49, G - H * 2 - 0.02], [0.5 - L * k.rr(0.5, 0.8), G - H * 2 - 0.02], -1, { wing: true, ink: true });
      k.tri([0.5, G - H * 2 - mh], [0.5, G - H * 2 - mh + 0.04], [0.5 - 0.07, G - H * 2 - mh + 0.02], 1);
      for (let i = 0; i < 3; i++) k.line(curve(k.r, 0.2 + i * 0.22, G + 0.02, 0.2, 0, k.rr(-0.6, 0.6), 6, 0.4), 0.006);
      k.face(0.5 - L * 0.3, G - H * 1.1, H * 0.8);
      void hull;
    },
  },
  {
    id: 'submarine',
    n: 'diver',
    bp: 'schwebeblase',
    make: (k) => {
      const L = k.rr(0.22, 0.3),
        H = k.rr(0.08, 0.11);
      const b = k.rect(0.5, 0.56, L * 2, H * 2, 0, 0.5, 0, { ink: true });
      k.rect(0.5 + L * 0.1, 0.56 - H * 1.3, L * 0.6, H * 0.8, 0, 0.3, -1, { ink: true });
      k.line([[0.5 + L * 0.2, 0.56 - H * 1.7], [0.5 + L * 0.2, 0.56 - H * 2.5], [0.5 + L * 0.05, 0.56 - H * 2.5]], 0.009);
      for (let i = 0; i < 3; i++) k.ring(0.5 - L * 0.3 + i * L * 0.35, 0.56, H * 0.3, H * 0.3, 0.006);
      k.c(0.5 + L * 1.02, 0.56, H * 0.15, 1, { ink: true });
      for (const s of [-1, 1]) k.e(0.5 + L * 1.05, 0.56 + s * H * 0.45, H * 0.12, H * 0.4, 0, 0);
      for (let i = 0; i < k.ri(1, 4); i++) k.c(0.5 - L * 0.8 + k.rr(-0.05, 0.05), 0.56 - H * 1.5 - i * 0.06, 0.012 + i * 0.006, 1, { ink: true });
      k.face(0.5 - L * 0.7, 0.56, H * 0.75);
      void b;
    },
  },
  {
    id: 'airship',
    n: 'airship',
    bp: 'schwebeblase',
    make: (k) => {
      const L = k.rr(0.25, 0.32),
        H = L * k.rr(0.32, 0.45);
      const env = k.e(0.5, 0.45, L, H, 0, 0, { ink: true });
      for (const s of [-1, 1]) k.tri([0.5 + L * 0.6, 0.45 + s * H * 0.3], [0.5 + L * 1.0, 0.45 + s * H * 0.2], [0.5 + L * 1.05, 0.45 + s * H * 1.1], -1, { ink: true });
      const gy = 0.45 + H + 0.05;
      k.rect(0.5, gy, L * 0.6, 0.045, 0, 0.3, 1, { ink: true });
      for (const s of [-1, 1]) k.line([[0.5 + s * L * 0.25, gy - 0.02], [0.5 + s * L * 0.4, 0.45 + H * 0.8]], 0.005);
      for (let i = 0; i < 4; i++) k.line([edge(env, -PI / 2 - 0.5 + i * 0.33, 1), edge(env, PI / 2 + 0.5 - i * 0.33, 1)], 0.004);
      bodyFace(k, env, -0.1, 0.6);
    },
  },
  {
    id: 'balloon',
    n: 'balloon',
    bp: 'schwebeblase',
    w: 1.2,
    make: (k) => {
      const hot = k.chance(0.5),
        R = k.rr(0.14, 0.2);
      const b = hot ? k.lathe(0.5, 0.18, R * 2.4, R, (t) => (t < 0.75 ? Math.sqrt(sin((t / 0.75) * PI * 0.85 + 0.15)) : 0.55 - (t - 0.75) * 1.4), 10, 0, { ink: true }) : k.e(0.5, 0.36, R * 0.9, R * 1.1, 0, 0, { ink: true });
      if (hot) {
        for (let i = -2; i <= 2; i++) k.line(curve(k.r, 0.5 + i * R * 0.35, 0.2, R * 2, PI / 2 + i * 0.05, -i * 0.25, 6), 0.004);
        k.rect(0.5, 0.18 + R * 2.6, R * 0.6, R * 0.35, 0, 0.15, 1, { ink: true });
        for (const s of [-1, 1]) k.line([[0.5 + s * R * 0.4, 0.18 + R * 2.3], [0.5 + s * R * 0.28, 0.18 + R * 2.45]], 0.005);
      } else {
        k.tri([0.48, 0.36 + R * 1.1], [0.52, 0.36 + R * 1.1], [0.5, 0.36 + R * 1.2], 1);
        k.line(curve(k.r, 0.5, 0.36 + R * 1.2, k.rr(0.2, 0.35), PI / 2, k.rr(-2, 2), 10, 0.3), 0.004);
        if (k.chance(0.4)) for (const s of [-1, 1]) k.e(0.5 + s * R * 0.9, 0.3 + k.rr(-0.05, 0.1), R * 0.55, R * 0.65, 0, -1, { ink: true });
      }
      bodyFace(k, b, hot ? -0.25 : 0, 0.6);
    },
  },
  {
    id: 'plane',
    n: 'propeller plane',
    bp: 'flatterer',
    make: (k) => {
      const L = k.rr(0.22, 0.3),
        R = k.rr(0.05, 0.075);
      const f = k.rect(0.5, 0.5, L * 2, R * 2, k.rr(-0.15, 0.1), 0.5, 0, { ink: true });
      wings(k, 'plane', 0.5, 0.52, L * 0.8, true, 1, k.rr(-0.4, 0.3));
      k.tri([0.5 + L * 0.7, 0.5 - R * 0.5], [0.5 + L * 1.0, 0.5 - R * 0.5], [0.5 + L * 1.0, 0.5 - R * 3], -1, { ink: true });
      k.c(0.5 - L * 1.02, 0.5, R * 0.3, 1, { ink: true });
      k.e(0.5 - L * 1.05, 0.5, R * 0.15, R * 1.8, 0, 2);
      k.face(0.5 - L * 0.55, 0.5, R * 0.85);
      void f;
    },
  },
  {
    id: 'helicopter',
    n: 'rotor',
    bp: 'flatterer',
    make: (k) => {
      const R = k.rr(0.1, 0.14);
      const b = k.e(0.45, 0.55, R * 1.3, R, 0, 0, { ink: true });
      k.tube([[0.45 + R, 0.53], [0.45 + R * 3.2, 0.48]], R * 0.25, R * 0.12, -1, 6);
      k.e(0.45 + R * 3.2, 0.46, R * 0.12, R * 0.45, 0, 0);
      k.line([[0.45, 0.55 - R], [0.45, 0.55 - R * 1.4]], 0.01);
      k.line([[0.45 - R * 2.6, 0.55 - R * 1.4], [0.45 + R * 2.6, 0.55 - R * 1.45]], 0.01);
      for (const s of [-1, 1]) k.line([[0.45 + s * R * 0.6, 0.55 + R], [0.45 + s * R * 0.7, 0.55 + R * 1.4]], 0.007);
      k.line([[0.45 - R * 1.2, 0.55 + R * 1.4], [0.45 + R * 1.2, 0.55 + R * 1.4]], 0.008);
      bodyFace(k, b, 0, 0.75);
    },
  },

  /* ----- Geräte ----- */
  {
    id: 'robot',
    n: 'automaton',
    bp: 'turm',
    w: 1.4,
    make: (k) => {
      const b = biped(k, { head: ['robot', 'robot', 'tv', 'round', 'skull'], hs: [0.06, 0.1], body: ['rect', 'rect', 'bell', 'round'], bw: [0.09, 0.15], bh: [0.1, 0.16], arms: ['line', 'claw', 'blob'], legs: ['pillar', 'wheel', 'stub', 'jointed', 'none'], ll: [0.04, 0.12] });
      for (let i = 0; i < k.ri(0, 4); i++) k.c(0.5 + k.rr(-0.5, 0.5) * b.body.rx, b.body.y + k.rr(-0.4, 0.5) * b.body.ry, 0.012, 2, { ink: true });
      if (k.chance(0.4)) k.ring(0.5, b.body.y, b.body.rx * 0.4, b.body.ry * 0.3, 0.006);
      trimmings(k, b.hd, null);
    },
  },
  {
    id: 'mech',
    n: 'walker',
    bp: 'krabbe',
    make: (k) => {
      const w = k.rr(0.13, 0.2),
        h = k.rr(0.08, 0.12),
        ll = k.rr(0.15, 0.25),
        cy = G - ll - h * 0.5;
      const b = k.rect(0.5, cy, w * 2, h * 2, 0, k.rr(0.1, 0.4), 0, { ink: true });
      const n = k.pick([2, 4, 6]);
      for (let i = 0; i < n; i++) {
        const s = i % 2 ? 1 : -1,
          x = 0.5 + s * w * (0.4 + 0.5 * Math.floor(i / 2) / Math.max(1, n / 2 - 1));
        k.line([[x, cy + h * 0.5], [x + s * ll * 0.4, cy - h * 0.3], [x + s * ll * 0.55, G]], 0.012);
        k.e(x + s * ll * 0.55, G - 0.01, 0.025, 0.012, 0, 1);
      }
      if (k.chance(0.5)) {
        k.line([[0.5, cy - h], [0.5, cy - h - 0.07]], 0.008);
        k.lathe(0.5, cy - h - 0.1, 0.04, 0.05, (t) => 1 - t * 0.6, 3, 1, { ink: true });
      }
      k.face(0.5, cy, h * 0.85);
      void b;
    },
  },
  {
    id: 'clock',
    n: 'alarm clock',
    bp: 'huepfer',
    make: (k) => {
      const R = k.rr(0.13, 0.18),
        cy = G - R - 0.05;
      const b = k.c(0.5, cy, R, 0, { ink: true });
      k.ring(0.5, cy, R * 0.82, R * 0.82, 0.006);
      for (const s of [-1, 1]) k.lathe(0.5 + s * R * 0.7, cy - R * 1.2, R * 0.35, R * 0.4, (t) => Math.sqrt(t), 4, -1, { ink: true });
      k.line([[0.5, cy], [0.5 + k.rr(-0.6, 0.6) * R, cy - R * 0.6]], 0.008);
      k.line([[0.5, cy], [0.5 + R * 0.4, cy + k.rr(-0.4, 0.4) * R]], 0.006);
      for (const s of [-1, 1]) k.line([[0.5 + s * R * 0.5, cy + R * 0.85], [0.5 + s * R * 0.8, G]], 0.01);
      k.face(0.5, cy + R * 0.2, R * 0.55);
      arms(k, b, 0.35);
    },
  },
  {
    id: 'gramophone',
    n: 'horn box',
    bp: 'knolle',
    make: (k) => {
      const w = k.rr(0.13, 0.18),
        h = w * k.rr(0.6, 0.9);
      const b = k.rect(0.48, G - h / 2, w * 2, h, 0, 0.12, 0, { ink: true });
      const a = -k.rr(0.7, 1.3),
        L = k.rr(0.15, 0.22),
        bx = 0.48 + w * 0.3,
        by = G - h;
      const ex = bx + Math.cos(a) * L,
        ey = by + Math.sin(a) * L,
        nx = -Math.sin(a),
        ny = Math.cos(a),
        R = L * 0.32;
      k.poly([[bx - nx * 0.01, by - ny * 0.01], [bx + nx * 0.01, by + ny * 0.01], [ex + nx * R, ey + ny * R], [ex - nx * R, ey - ny * R]], 1, { ink: true });
      k.ring(ex, ey, R * 0.4, R, 0.006);
      bodyFace(k, b, 0, 0.7);
      feet(k, b, 0.5);
    },
  },
  {
    id: 'camera',
    n: 'shutterbox',
    bp: 'knolle',
    make: (k) => {
      const w = k.rr(0.15, 0.2),
        h = w * k.rr(0.6, 0.8),
        cy = G - h / 2 - 0.04;
      const b = k.rect(0.5, cy, w * 2, h, 0, 0.15, 0, { ink: true });
      k.rect(0.5 - w * 0.5, cy - h * 0.6, w * 0.6, h * 0.25, 0, 0.2, -1, { ink: true });
      const R = h * 0.35;
      k.c(0.5 + w * 0.1, cy, R, 1, { ink: true });
      k.c(0.5 + w * 0.1, cy, R * 0.6, 2, { ink: true });
      k.face(0.5 + w * 0.1, cy, R * 0.6, { cyclops: true });
      feet(k, b, 0.6);
    },
  },
  {
    id: 'windmill',
    n: 'windmill',
    bp: 'strahler',
    make: (k) => {
      const h = k.rr(0.3, 0.4),
        w = k.rr(0.07, 0.1);
      const tw = k.lathe(0.5, G - h, h, w, (t) => 0.6 + 0.4 * t, 6, 0, { ink: true });
      k.tri([0.5 - w * 0.8, G - h + 0.01], [0.5 + w * 0.8, G - h + 0.01], [0.5, G - h - 0.07], 1, { ink: true });
      const cx = 0.5,
        cy = G - h - 0.02,
        n = k.pick([4, 4, 5, 6]),
        a0 = k.rr(0, 1.5),
        L = k.rr(0.2, 0.28);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i * 2 * PI) / n;
        k.rect(cx + Math.cos(a) * L * 0.55, cy + Math.sin(a) * L * 0.55, L, L * 0.2, a, 0.05, 2, { ink: true, wing: true });
      }
      k.c(cx, cy, 0.02, 3, { ink: true });
      k.face(0.5, G - h * 0.4, w * 0.7);
      void tw;
    },
  },
  {
    id: 'gear',
    n: 'cogwheel',
    bp: 'strahler',
    make: (k) => {
      const R = k.rr(0.17, 0.24),
        n = k.ri(6, 11);
      const g = k.star(0.5, 0.5, R * 0.8, R, n, k.rr(0, 1), 0, { ink: true, crisp: 0.2 }, true);
      k.ring(0.5, 0.5, R * 0.3, R * 0.3, 0.008);
      if (k.chance(0.5)) {
        const r2 = R * k.rr(0.4, 0.6),
          a = k.rr(0, 6.28);
        k.star(0.5 + Math.cos(a) * (R + r2) * 0.92, 0.5 + Math.sin(a) * (R + r2) * 0.92, r2 * 0.8, r2, Math.max(5, Math.round(n * 0.6)), k.rr(0, 1), -1, { ink: true, crisp: 0.2 }, true);
      }
      k.face(0.5, 0.5, R * 0.55);
      void g;
    },
  },

  /* ----- Möbel ----- */
  {
    id: 'chair',
    n: 'chair',
    bp: 'vierbeiner',
    make: (k) => {
      const w = k.rr(0.15, 0.22),
        sh = k.rr(0.15, 0.25),
        bh = k.rr(0.18, 0.32),
        sy = G - sh;
      k.rect(0.5, sy, w * 2, 0.04, 0, 0.3, 1, { ink: true });
      const back = k.rect(0.5 + w * 0.9, sy - bh / 2, 0.05, bh, 0.08, 0.4, 0, { ink: true });
      for (const x of [0.5 - w * 0.85, 0.5 + w * 0.85]) for (const dz of [-1, 1]) k.line([[x + dz * 0.015, sy], [x + dz * 0.03, G]], 0.012);
      k.face(0.5 + w * 0.9, sy - bh * 0.6, 0.045);
      if (k.chance(0.3)) k.e(0.5, sy - 0.03, w * 0.8, 0.03, 0, 2);
      void back;
    },
  },
  {
    id: 'table',
    n: 'table',
    bp: 'vierbeiner',
    make: (k) => {
      const w = k.rr(0.2, 0.3),
        h = k.rr(0.15, 0.25),
        ty = G - h;
      const top = k.rect(0.5, ty, w * 2, 0.045, 0, 0.3, 1, { ink: true });
      const claw = k.chance(0.5);
      for (const x of [0.5 - w * 0.8, 0.5 + w * 0.8]) for (const dz of [-1, 1]) leg(k, claw ? 'paw' : 'pillar', x + dz * 0.02, ty, h, 0.018, 0, dz);
      const r2 = k.r();
      if (r2 < 0.35) k.lathe(0.5 + k.rr(-0.1, 0.1), ty - 0.12, 0.1, 0.035, PROF.vase!, 6, 2, { ink: true });
      else if (r2 < 0.6) k.e(0.45, ty - 0.03, 0.05, 0.02, 0, 2);
      k.face(0.5, ty, 0.04);
      void top;
    },
  },
  {
    id: 'bathtub',
    n: 'clawfoot tub',
    bp: 'vierbeiner',
    make: (k) => {
      const w = k.rr(0.22, 0.3),
        h = k.rr(0.1, 0.14),
        cy = G - 0.04 - h;
      const tub = k.poly([[0.5 - w, cy - h], [0.5 + w, cy - h], [0.5 + w * 0.85, cy + h], [0.5 - w * 0.85, cy + h]], 0, { ink: true, crisp: 0.5 });
      for (const s of [-1, 1]) leg(k, 'paw', 0.5 + s * w * 0.7, cy + h, 0.04, 0.016, 0, 1);
      for (let i = 0; i < k.ri(3, 8); i++) k.c(0.5 + k.rr(-0.9, 0.9) * w, cy - h - k.rr(0, 0.06), k.rr(0.015, 0.035), 1, { ink: true });
      k.line([[0.5 + w * 0.9, cy - h], [0.5 + w * 0.9, cy - h - 0.07], [0.5 + w * 0.75, cy - h - 0.07]], 0.008);
      bodyFace(k, tub, 0.1, 0.65);
    },
  },
  {
    id: 'piano',
    n: 'piano',
    bp: 'vierbeiner',
    make: (k) => {
      const w = k.rr(0.2, 0.26),
        h = k.rr(0.16, 0.22),
        cy = G - 0.08 - h / 2;
      const b = k.rect(0.5, cy, w * 2, h, 0, 0.08, 0, { ink: true });
      k.rect(0.5, cy + h * 0.25, w * 2.1, 0.03, 0, 0.2, 1);
      for (let i = 0; i < 9; i++) k.line([[0.5 - w + (i + 0.5) * (w * 2) / 9, cy + h * 0.25 - 0.012], [0.5 - w + (i + 0.5) * (w * 2) / 9, cy + h * 0.25 + 0.012]], 0.005);
      for (const s of [-1, 1]) leg(k, 'pillar', 0.5 + s * w * 0.85, cy + h / 2, 0.08, 0.016, 0, 1);
      k.face(0.5, cy - h * 0.15, h * 0.35);
      void b;
    },
  },

  /* ----- Essen ----- */
  {
    id: 'cake',
    n: 'layer cake',
    bp: 'turm',
    make: (k) => {
      const n = k.ri(1, 4);
      let y = G,
        w = k.rr(0.18, 0.24),
        top: B | null = null;
      for (let i = 0; i < n; i++) {
        const h = k.rr(0.07, 0.11);
        top = k.rect(0.5, y - h / 2, w * 2, h, 0, 0.15, i, { ink: true });
        k.line(Array.from({ length: 9 }, (_, j): Pt => [0.5 - w + (j * w * 2) / 8, y - h + 0.01 + (j % 2) * 0.02]), 0.008);
        y -= h;
        w *= k.rr(0.65, 0.85);
      }
      for (let i = 0; i < k.ri(0, 4); i++) {
        const x = 0.5 + k.rr(-0.8, 0.8) * w;
        k.rect(x, y - 0.035, 0.012, 0.06, 0, 0.3, 9);
        k.e(x, y - 0.08, 0.01, 0.018, 0, 9, { wing: true });
      }
      if (k.chance(0.5)) k.c(0.5, y - 0.02, 0.025, 9, { ink: true });
      if (top) k.face(0.5, top.y, top.ry * 1.6);
    },
  },
  {
    id: 'cupcake',
    n: 'cupcake',
    bp: 'knolle',
    make: (k) => {
      const w = k.rr(0.11, 0.15),
        h = w * k.rr(0.7, 1);
      const cup = k.poly([[0.5 - w, G - h], [0.5 + w, G - h], [0.5 + w * 0.75, G], [0.5 - w * 0.75, G]], 1, { ink: true, crisp: 0.3 });
      for (let i = 0; i < 5; i++) k.line([[0.5 - w + (i * w * 2) / 4, G - h], [0.5 - w * 0.75 + (i * w * 1.5) / 4, G]], 0.005);
      const n = k.ri(3, 5);
      for (let i = 0; i < n; i++) k.e(0.5, G - h - w * 0.25 - i * w * 0.32, w * (1.1 - i * 0.22), w * 0.32, 0, 2 + i);
      if (k.chance(0.6)) k.c(0.5, G - h - w * 0.3 - n * w * 0.32, w * 0.2, 9, { ink: true });
      k.face(0.5, G - h * 0.45, h * 0.45);
      void cup;
    },
  },
  {
    id: 'dumpling',
    n: 'dumpling',
    bp: 'knolle',
    make: (k) => {
      const w = k.rr(0.15, 0.22),
        h = w * k.rr(0.6, 0.9),
        tri = k.chance(0.35);
      const b = tri ? k.poly([[0.5 - w, G], [0.5, G - h * 1.6], [0.5 + w, G]], 0, { crisp: 0.9 }) : k.lathe(0.5, G - h * 1.3, h * 1.3, w, (t) => Math.sqrt(sin(t * PI * 0.5 + 0.05)), 8, 0, { ink: true });
      if (tri) k.rect(0.5, G - h * 0.3, w * 0.8, h * 0.6, 0, 0.1, 1);
      else for (let i = -2; i <= 2; i++) k.line([[0.5, G - h * 1.3], [0.5 + i * w * 0.18, G - h * 1.0]], 0.005);
      k.face(0.5, G - h * 0.5, h * 0.5);
      void b;
    },
  },
  {
    id: 'fruit',
    n: 'fruit',
    bp: 'knolle',
    w: 3,
    kinds: [
      { k: 'apple', n: 'apple' },
      { k: 'pear', n: 'pear' },
      { k: 'lemon', n: 'lemon' },
      { k: 'strawberry', n: 'strawberry' },
      { k: 'pineapple', n: 'pineapple' },
      { k: 'eggplant', n: 'eggplant' },
      { k: 'banana', n: 'banana', bp: 'schlange' },
      { k: 'pumpkin', n: 'pumpkin' },
    ],
    make: (k) => {
      const kind = k.kind(['apple', 'pear', 'lemon', 'strawberry', 'pineapple', 'eggplant', 'banana', 'pumpkin']);
      const R = k.rr(0.13, 0.19);
      let b: B;
      if (kind === 'pear') b = k.lathe(0.5, G - R * 2.6, R * 2.6, R, PROF.gourd!, 10, 0, { ink: true });
      else if (kind === 'lemon') b = k.e(0.5, G - R, R * 1.3, R * 0.9, k.rr(-0.3, 0.3), 0, { ink: true });
      else if (kind === 'strawberry') b = k.lathe(0.5, G - R * 2, R * 2, R, (t) => Math.sqrt(1 - t) * (0.6 + 0.4 * sin(Math.min(1, t * 3) * PI * 0.5)), 8, 0, { ink: true });
      else if (kind === 'pineapple') {
        b = k.e(0.5, G - R * 1.2, R * 0.85, R * 1.2, 0, 0, { ink: true });
        for (let i = -2; i <= 2; i++) k.line([edge(b, -PI / 2 - 0.5 + i * 0.25, 1), edge(b, PI / 2 - 0.5 + i * 0.25, 1)], 0.004);
        for (let i = 0; i < 5; i++) k.e(0.5 + (i - 2) * R * 0.15, G - R * 2.5, R * 0.1, R * 0.45, (i - 2) * 0.3, -1, { leaf: true });
      } else if (kind === 'eggplant' || kind === 'banana') {
        const pts = curve(k.r, 0.3, G - R * 1.5, R * 3.2, k.rr(0.3, 0.7), -k.rr(0.8, 1.6), 10);
        k.tube(pts, kind === 'banana' ? R * 0.35 : R * 0.45, kind === 'banana' ? R * 0.3 : R * 0.75, 0, 9);
        b = k.c(pts[6]![0], pts[6]![1], R * 0.6, 0);
        k.e(pts[0]![0] - 0.02, pts[0]![1], R * 0.25, R * 0.15, 0, 1, { leaf: kind === 'eggplant' });
      } else if (kind === 'pumpkin') {
        for (const s of [-1, 1]) k.e(0.5 + s * R * 0.55, G - R * 0.9, R * 0.7, R * 0.9, s * 0.1, -1, { ink: true });
        b = k.e(0.5, G - R * 0.9, R * 0.75, R * 0.95, 0, 0, { ink: true });
      } else b = k.c(0.5, G - R, R, 0, { ink: true });
      if (kind !== 'pineapple' && kind !== 'banana' && kind !== 'eggplant') {
        k.line([[b.x, b.y - b.ry], [b.x + 0.02, b.y - b.ry - 0.06]], 0.01);
        if (k.chance(0.7)) k.e(b.x + 0.05, b.y - b.ry - 0.04, 0.04, 0.018, -0.5, 2, { leaf: true });
      }
      if (kind === 'strawberry') for (let i = 0; i < 8; i++) k.c(0.5 + k.rr(-0.7, 0.7) * R, G - k.rr(0.3, 1.6) * R, 0.006, 2, { ink: true });
      bodyFace(k, b, 0.05, 0.65);
      feet(k, b, 0.4);
      arms(k, b, 0.35);
    },
  },
  {
    id: 'mushroom',
    n: 'mushroom',
    bp: 'knolle',
    w: 1.2,
    make: (k) => {
      const sw = k.rr(0.05, 0.09),
        sh = k.rr(0.1, 0.22),
        cw = k.rr(0.15, 0.27),
        ch = k.rr(0.06, 0.15),
        tilt = k.rr(-0.2, 0.2);
      const stem = k.lathe(0.5, G - sh, sh, sw, (t) => 0.75 + 0.25 * t, 6, 0, { ink: true });
      const kind = k.pick(['dome', 'flat', 'cone', 'morel']);
      const cy = G - sh - ch * 0.3;
      if (kind === 'cone') k.tri([0.5 - cw, cy + ch * 0.4], [0.5 + cw, cy + ch * 0.4], [0.5 + tilt * cw, cy - ch * 2], 1, { ink: true });
      else if (kind === 'morel') k.e(0.5, cy - ch * 0.8, cw * 0.55, ch * 1.6, tilt, 1, { ink: true });
      else k.lathe(0.5, cy - ch, ch * (kind === 'flat' ? 1.1 : 1.6), cw, (t) => Math.sqrt(t) * (kind === 'flat' ? 1 : 0.95), 8, 1, { ink: true });
      for (let i = 0; i < k.ri(0, 6); i++) k.c(0.5 + k.rr(-0.7, 0.7) * cw, cy - k.rr(0, 1) * ch, cw * k.rr(0.06, 0.12), 2, { ink: true });
      if (k.chance(0.35)) {
        const s = k.sign();
        k.lathe(0.5 + s * cw * 1.1, G - sh * 0.5, sh * 0.5, sw * 0.5, () => 0.8, 3, -1);
        k.lathe(0.5 + s * cw * 1.1, G - sh * 0.5 - ch * 0.6, ch * 0.7, cw * 0.4, (t) => Math.sqrt(t), 5, -1, { ink: true });
      }
      k.face(0.5, G - sh * 0.45, sw * 0.95);
      void stem;
    },
  },
  {
    id: 'root',
    n: 'root veg',
    bp: 'knolle',
    w: 2,
    kinds: [
      { k: 'carrot', n: 'carrot' },
      { k: 'radish', n: 'radish' },
      { k: 'onion', n: 'onion' },
      { k: 'potato', n: 'potato' },
      { k: 'turnip', n: 'turnip' },
    ],
    make: (k) => {
      const kind = k.kind(['carrot', 'radish', 'onion', 'potato', 'turnip']),
        R = k.rr(0.1, 0.15);
      let b: B;
      if (kind === 'carrot') b = k.lathe(0.5, G - R * 3.2, R * 3, R, (t) => 1 - t * 0.9, 8, 0, { ink: true });
      else if (kind === 'onion') b = k.lathe(0.5, G - R * 2.6, R * 2.4, R * 1.1, (t) => (t < 0.3 ? t * 1.2 : sin(((t - 0.3) / 0.7) * PI * 0.5 + PI * 0.5 * 0.2) * 1.0) * (t > 0.85 ? 1 - (t - 0.85) * 4 : 1), 10, 0, { ink: true });
      else if (kind === 'potato') {
        b = k.e(0.5, G - R * 1.1, R * 1.4, R * 1.05, k.rr(-0.3, 0.3), 0, { ink: true });
        for (let i = 0; i < 3; i++) k.c(...edge(b, k.rr(0, 6.28), 0.85), R * 0.35, -1);
      } else b = k.c(0.5, G - R * 1.4, R * (kind === 'turnip' ? 1.2 : 1), 0, { ink: true });
      if (kind !== 'potato') for (let i = 0; i < k.ri(2, 5); i++) k.e(b.x + (i - 1.5) * R * 0.2, b.y - b.ry - R * 0.6, R * 0.13, R * 0.7, (i - 1.5) * 0.35, -1, { leaf: true });
      if (kind === 'radish' || kind === 'turnip') k.line([[b.x, b.y + b.ry], [b.x + 0.01, b.y + b.ry + 0.08]], 0.006);
      bodyFace(k, b, kind === 'carrot' ? -0.5 : 0, 0.65);
      feet(k, b, 0.5);
      arms(k, b, 0.4);
    },
  },

  /* ----- Pflanzen ----- */
  {
    id: 'tree',
    n: 'tree',
    bp: 'turm',
    w: 3,
    kinds: [
      { k: 'round', n: 'tree' },
      { k: 'pine', n: 'pine' },
      { k: 'palm', n: 'palm', bp: 'strahler' },
      { k: 'willow', n: 'willow', bp: 'qualle' },
      { k: 'bonsai', n: 'bonsai' },
    ],
    make: (k) => {
      const kind = k.kind(['round', 'pine', 'palm', 'willow', 'bonsai']),
        th = k.rr(0.15, 0.3),
        tw = k.rr(0.025, 0.05);
      const trunk = k.tube(curve(k.r, 0.5, G, th, -PI / 2 + k.rr(-0.3, 0.3), k.rr(-0.6, 0.6), 6), tw * 1.4, tw * 0.8, 0, 5);
      const t = trunk[trunk.length - 1]!;
      if (kind === 'pine') for (let i = 0; i < 3; i++) k.tri([t.x - 0.16 + i * 0.03, t.y + 0.02 - i * 0.09], [t.x + 0.16 - i * 0.03, t.y + 0.02 - i * 0.09], [t.x, t.y - 0.12 - i * 0.09], 1 + i, { ink: true });
      else if (kind === 'palm') for (let i = 0; i < k.ri(4, 7); i++) k.tube(curve(k.r, t.x, t.y, k.rr(0.12, 0.2), -PI / 2 + (i - 3) * 0.5, (i - 3) * 0.6, 6), 0.03, 0.012, 2, 3, 1, { leaf: true });
      else if (kind === 'willow') {
        const c = k.e(t.x, t.y - 0.06, 0.18, 0.1, 0, 1);
        for (let i = 0; i < 9; i++) k.line(curve(k.r, c.x - c.rx * 0.9 + (i * c.rx * 1.8) / 8, c.y, k.rr(0.12, 0.25), PI / 2, k.rr(-0.4, 0.4), 6, 0.2), 0.006);
      } else {
        const n = kind === 'bonsai' ? 3 : k.ri(4, 7);
        for (let i = 0; i < n; i++) k.c(t.x + k.rr(-0.14, 0.14), t.y - k.rr(0, 0.15), k.rr(0.06, 0.1), 1);
      }
      if (kind === 'bonsai') k.lathe(0.5, G - 0.01, 0.06, 0.15, (x) => 1 - x * 0.25, 3, 2, { ink: true });
      k.face(0.5, G - th * 0.45, 0.05);
    },
  },
  {
    id: 'cactus',
    n: 'cactus',
    bp: 'turm',
    make: (k) => {
      const w = k.rr(0.06, 0.1),
        h = k.rr(0.28, 0.42);
      const col = k.rect(0.5, G - h / 2, w * 2, h, 0, 0.5, 0, { ink: true });
      for (let i = 0; i < k.ri(0, 3); i++) {
        const s = i % 2 ? 1 : -1,
          y = G - h * k.rr(0.35, 0.7),
          ah = k.rr(0.06, 0.14);
        k.rect(0.5 + s * (w + 0.03), y, 0.08, w * 1.2, 0, 0.5, -1);
        k.rect(0.5 + s * (w + 0.06), y - ah / 2, w * 1.2, ah, 0, 0.5, -1, { ink: true });
      }
      for (let i = 0; i < 10; i++) {
        const x = 0.5 + k.rr(-0.8, 0.8) * w,
          y = G - k.rr(0.05, 0.95) * h;
        k.line([[x, y], [x + k.rr(-0.015, 0.015), y - 0.015]], 0.004);
      }
      if (k.chance(0.5)) k.star(0.5, G - h, 0.015, 0.035, 6, 0, 2);
      if (k.chance(0.5)) k.lathe(0.5, G - 0.05, 0.08, w * 1.6, (t) => 1 - t * 0.3, 3, 1, { ink: true });
      k.face(0.5, G - h * 0.6, w * 0.85);
      void col;
    },
  },
  {
    id: 'potplant',
    n: 'potted plant',
    bp: 'knolle',
    make: (k) => {
      const pw = k.rr(0.09, 0.14),
        ph = pw * k.rr(0.8, 1.3);
      const pot = k.poly([[0.5 - pw, G - ph], [0.5 + pw, G - ph], [0.5 + pw * 0.75, G], [0.5 - pw * 0.75, G]], 1, { ink: true, crisp: 0.3 });
      k.rect(0.5, G - ph, pw * 2.2, 0.03, 0, 0.3, 2);
      const kind = k.pick(['flytrap', 'flower', 'leaves', 'sprout']);
      const n = kind === 'flower' ? k.ri(1, 3) : k.ri(2, 5);
      for (let i = 0; i < n; i++) {
        const a = curve(k.r, 0.5 + (i - (n - 1) / 2) * 0.03, G - ph, k.rr(0.12, 0.25), -PI / 2 + (i - (n - 1) / 2) * 0.4, k.rr(-0.8, 0.8), 6);
        k.line(a, 0.008);
        const e = a[a.length - 1]!;
        if (kind === 'flower') {
          k.star(e[0], e[1], 0.025, 0.06, k.ri(5, 8), k.rr(0, 1), 0, { ink: true });
          k.c(e[0], e[1], 0.022, 1);
        } else if (kind === 'flytrap') {
          k.e(e[0] - 0.03, e[1] - 0.03, 0.05, 0.025, -0.6, 0, { ink: true });
          k.e(e[0] + 0.03, e[1] - 0.03, 0.05, 0.025, 0.6, 0, { ink: true });
        } else k.e(e[0], e[1], 0.03, 0.06, k.rr(-0.6, 0.6), 0, { leaf: true });
      }
      bodyFace(k, pot, 0, 0.75);
      feet(k, pot, 0.35);
    },
  },
];
