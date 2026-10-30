/*
 * Sagenwesen, Volkskunst und gemeinfreie Kunstmotive, dazu Schlangen, Quallen, Strahler und Schwebendes.
 * Keine geschützten Figuren: nur allgemeine Archetypen und Motive aus Volkskunst und Sagen.
 */
import type { Pt } from '../data';
import type { Arche } from './animals';
import { biped, quad, trimmings } from './animals';
import { curve, edge, type B, type Kit } from './kit';
import { head, HEAD_KINDS, leg, pickHead, tail, wings, type HeadKind } from './parts';

const G = 0.82,
  PI = Math.PI,
  sin = Math.sin;

/** Hals von (x0, y0) zu einem Kopf, als dichter Schlauch */
function neckTo(k: Kit, x0: number, y0: number, x1: number, y1: number, w: number, bend: number): void {
  const pts: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push([x0 + (x1 - x0) * t + sin(t * PI) * bend, y0 + (y1 - y0) * t]);
  }
  k.tube(pts, w, w * 0.8, 0, 4);
}

export const MYTH: Arche[] = [
  /* ----- Volkskunst und Kunst ----- */
  {
    id: 'daruma',
    n: 'wish doll',
    bp: 'knolle',
    make: (k) => {
      const R = k.rr(0.17, 0.22);
      const b = k.lathe(0.5, G - R * 2.1, R * 2.1, R, (t) => Math.sqrt(sin(t * PI * 0.9 + 0.1)), 10, 0, { ink: true });
      k.e(0.5, G - R * 1.3, R * 0.6, R * 0.5, 0, 1, { wing: true });
      k.line([[0.5 - R * 0.35, G - R * 1.0], [0.5, G - R * 0.95], [0.5 + R * 0.35, G - R * 1.0]], 0.012);
      k.face(0.5, G - R * 1.35, R * 0.5);
      void b;
    },
  },
  {
    id: 'matryoshka',
    n: 'nesting doll',
    bp: 'turm',
    make: (k) => {
      const n = k.ri(1, 3);
      for (let i = 0; i < n; i++) {
        const s = 1 - i * 0.28,
          x = 0.5 + i * 0.17 * s,
          h = 0.4 * s,
          w = 0.12 * s;
        k.lathe(x, G - h, h, w, (t) => (t < 0.35 ? 0.75 * sin((t / 0.35) * PI * 0.5 + 0.3) : 0.75 + 0.25 * sin(((t - 0.35) / 0.65) * PI * 0.8)), 10, -i, { ink: true });
        k.c(x, G - h * 0.78, w * 0.48, 1 - i, { wing: true });
        k.star(x, G - h * 0.32, w * 0.15, w * 0.35, 6, k.rr(0, 1), 1 - i);
        k.face(x, G - h * 0.78, w * 0.4);
      }
    },
  },
  {
    id: 'kokeshi',
    n: 'peg doll',
    bp: 'turm',
    make: (k) => {
      const w = k.rr(0.05, 0.08),
        h = k.rr(0.22, 0.32);
      k.lathe(0.5, G - h, h, w, (t) => 0.7 + 0.3 * t, 4, 0, { ink: true });
      for (let i = 0; i < k.ri(1, 3); i++) k.line([[0.5 - w * 0.8, G - h * (0.3 + i * 0.2)], [0.5 + w * 0.8, G - h * (0.3 + i * 0.2)]], 0.012);
      const R = w * k.rr(1.3, 1.9);
      const hd = head(k, pickHead(k, ['round', 'round', 'chibi']), 0.5, G - h - R * 0.8, R, 0, 2);
      k.lathe(0.5, hd.y - R * 1.02, R * 0.8, R * 1.02, (t) => Math.sqrt(t), 6, 3);
    },
  },
  {
    id: 'moai',
    n: 'stone head',
    bp: 'turm',
    make: (k) => {
      const r = k.rr(0.08, 0.11);
      const hd = head(k, 'moai', 0.5, 0.4, r, k.chance(0.5) ? -1 : 0, 2);
      k.rect(0.5, 0.4 + r * 1.6 + 0.06, r * 2.2, 0.12, 0, 0.1, 1, { ink: true });
      if (k.chance(0.35)) k.lathe(0.5, hd.top - 0.08, 0.07, r * 0.7, () => 1, 3, 3, { ink: true });
    },
  },
  {
    id: 'totem',
    n: 'totem',
    bp: 'turm',
    make: (k) => {
      const n = k.ri(2, 4),
        r = k.rr(0.06, 0.08);
      for (let i = 0; i < n; i++) {
        const y = G - r - i * r * 2.05;
        const kind: HeadKind = k.pick(['owl', 'bear', 'frog', 'bird', 'round', 'cat', 'robot']);
        head(k, kind, 0.5, y, r, 0, i * 2);
        if (i === n - 1 || k.chance(0.25)) for (const s of [-1, 1]) k.e(0.5 + s * r * 1.9, y - r * 0.3, r * 1.0, r * 0.35, -s * 0.4, i * 2 - 1, { wing: true });
      }
    },
  },
  {
    id: 'maneki',
    n: 'beckoning cat',
    bp: 'huepfer',
    make: (k) => {
      const b = biped(k, { head: ['cat'], hs: [0.08, 0.1], body: ['pear', 'egg', 'round'], bw: [0.1, 0.13], bh: [0.11, 0.15], arms: ['none'], legs: ['none'], ll: [0, 0] });
      const s = k.sign(),
        bx = 0.5 + s * b.body.rx * 0.6;
      k.e(bx, b.body.y - b.body.ry * 1.0, 0.03, 0.06, s * 0.2, 4);
      k.c(bx, b.body.y - b.body.ry * 1.25, 0.032, 4, { ink: true });
      k.c(0.5, b.body.y - b.body.ry * 0.6, 0.022, 4, { ink: true });
      k.rect(0.5 - s * b.body.rx * 0.35, b.body.y + b.body.ry * 0.1, 0.07, 0.05, 0.2, 0.1, 4, { ink: true });
    },
  },
  {
    id: 'karakasa',
    n: 'umbrella spirit',
    bp: 'huepfer',
    make: (k) => {
      const w = k.rr(0.2, 0.28),
        h = k.rr(0.2, 0.28),
        top = 0.2;
      const b = k.lathe(0.5, top, h, w, (t) => Math.pow(t, 0.8), 8, 0, { ink: true });
      for (let i = -2; i <= 2; i++) k.line([[0.5, top], [0.5 + i * w * 0.42, top + h]], 0.005);
      k.line([[0.5, top], [0.5, top - 0.05]], 0.01);
      k.line([[0.5, top + h], [0.5 + k.rr(-0.03, 0.03), G - 0.05]], 0.016);
      k.e(0.5, G - 0.025, 0.04, 0.025, 0, 1);
      k.face(0.5, top + h * 0.6, h * 0.35, { cyclops: k.chance(0.7) });
      if (k.chance(0.6)) k.tube(curve(k.r, 0.5, top + h * 0.82, 0.12, PI / 2, k.rr(-1, 1), 6), 0.02, 0.015, 2, 4);
      void b;
    },
  },
  {
    id: 'lantern',
    n: 'lantern spirit',
    bp: 'schwebeblase',
    make: (k) => {
      const w = k.rr(0.13, 0.18),
        h = w * k.rr(1.3, 1.8),
        top = 0.25;
      const b = k.lathe(0.5, top, h, w, (t) => 0.55 + 0.45 * sin(t * PI), 10, 0, { ink: true });
      for (let i = 1; i < 6; i++) k.line([[0.5 - w * sin((i / 6) * PI) * 1.0, top + (h * i) / 6], [0.5 + w * sin((i / 6) * PI) * 1.0, top + (h * i) / 6]], 0.005);
      k.rect(0.5, top - 0.01, w * 1.2, 0.03, 0, 0.2, 1, { ink: true });
      k.rect(0.5, top + h + 0.01, w * 1.2, 0.03, 0, 0.2, 1, { ink: true });
      k.line([[0.5, top - 0.02], [0.5, top - 0.1]], 0.008);
      k.face(0.5, top + h * 0.5, w * 0.6, { cyclops: k.chance(0.4) });
      if (k.chance(0.6)) k.tube(curve(k.r, 0.5, top + h * 0.72, 0.15, PI / 2, k.rr(-1, 1), 6), 0.025, 0.018, 2, 4);
      void b;
    },
  },
  {
    id: 'ghost',
    n: 'sheet ghost',
    bp: 'schwebeblase',
    w: 1.2,
    make: (k) => {
      const w = k.rr(0.12, 0.18),
        h = k.rr(0.3, 0.42),
        top = 0.22,
        n = k.ri(3, 6),
        pts: Pt[] = [];
      for (let i = 0; i <= 10; i++) {
        const a = PI + (i / 10) * PI;
        pts.push([0.5 + Math.cos(a) * w, top + w + Math.sin(a) * w]);
      }
      const sway = k.rr(-0.06, 0.06);
      for (let i = 0; i <= n * 2; i++) pts.push([0.5 + w + sway - ((w * 2) / (n * 2)) * i, top + h + (i % 2 ? -0.03 : 0.02)]);
      const b = k.poly(pts, 0, { crisp: 0.6 });
      if (k.chance(0.6)) for (const s of [-1, 1]) k.e(0.5 + s * w * 1.05, top + h * 0.5, w * 0.35, w * 0.15, s * k.rr(-0.6, 0.6), -1);
      k.face(0.5, top + w * 1.0, w * 0.75);
      trimmings(k, null, null);
      void b;
    },
  },
  {
    id: 'origami',
    n: 'paper fold',
    bp: 'flatterer',
    kinds: [
      { k: 'crane', n: 'paper crane' },
      { k: 'boat', n: 'paper boat', bp: 'schwebeblase' },
      { k: 'plane', n: 'paper plane' },
      { k: 'kite', n: 'kite' },
    ],
    make: (k) => {
      const kind = k.kind(['crane', 'boat', 'plane', 'kite']);
      if (kind === 'crane') {
        k.poly([[0.3, 0.55], [0.5, 0.45], [0.7, 0.55], [0.5, 0.62]], 0, { crisp: 0.15 });
        k.poly([[0.42, 0.5], [0.5, 0.48], [0.62, 0.2], [0.52, 0.45]], -1, { crisp: 0.15 });
        k.poly([[0.36, 0.53], [0.26, 0.38], [0.24, 0.36], [0.33, 0.5]], 1, { crisp: 0.15 });
        k.poly([[0.62, 0.54], [0.78, 0.4], [0.68, 0.53]], 1, { crisp: 0.15 });
        k.face(0.5, 0.53, 0.05);
      } else if (kind === 'boat') {
        k.poly([[0.25, 0.55], [0.75, 0.55], [0.65, 0.68], [0.35, 0.68]], 0, { crisp: 0.15 });
        k.poly([[0.38, 0.55], [0.5, 0.32], [0.62, 0.55]], 1, { crisp: 0.15 });
        k.face(0.5, 0.6, 0.06);
      } else if (kind === 'plane') {
        k.poly([[0.2, 0.5], [0.8, 0.42], [0.55, 0.52]], 0, { crisp: 0.15 });
        k.poly([[0.2, 0.5], [0.8, 0.42], [0.5, 0.6]], 1, { crisp: 0.15 });
        k.face(0.45, 0.52, 0.05);
      } else {
        k.poly([[0.5, 0.2], [0.68, 0.42], [0.5, 0.7], [0.32, 0.42]], 0, { crisp: 0.15, ink: true });
        k.line([[0.5, 0.2], [0.5, 0.7]], 0.004);
        k.line([[0.32, 0.42], [0.68, 0.42]], 0.004);
        const t = curve(k.r, 0.5, 0.7, 0.3, PI / 2, k.rr(-2, 2), 10, 0.3);
        k.line(t, 0.004);
        for (let i = 3; i < t.length; i += 3) k.tri([t[i]![0] - 0.02, t[i]![1] - 0.015], [t[i]![0] + 0.02, t[i]![1] - 0.015], [t[i]![0], t[i]![1] + 0.01], 2);
        k.face(0.5, 0.42, 0.07);
      }
    },
  },
  {
    id: 'mobile',
    n: 'hanging mobile',
    bp: 'schwebeblase',
    make: (k) => {
      const n = k.ri(2, 4);
      const bar = (x: number, y: number, w: number, depth: number) => {
        k.line([[x - w, y], [x + w, y]], 0.006);
        for (const s of [-1, 1]) {
          const ex = x + s * w,
            ey = y + k.rr(0.05, 0.1);
          k.line([[ex, y], [ex, ey]], 0.004);
          if (depth > 0 && k.chance(0.6)) bar(ex, ey, w * 0.55, depth - 1);
          else {
            const r = k.rr(0.03, 0.06),
              v = k.r();
            if (v < 0.4) k.c(ex, ey + r, r, 0, { ink: true });
            else if (v < 0.7) k.tri([ex - r, ey + r * 1.6], [ex + r, ey + r * 1.6], [ex, ey], 0, { ink: true });
            else k.e(ex, ey + r, r * 1.4, r * 0.6, k.rr(-0.5, 0.5), 0, { ink: true });
          }
        }
      };
      k.line([[0.5, 0.1], [0.5, 0.2]], 0.004);
      bar(0.5, 0.2, k.rr(0.15, 0.22), n - 1);
      const c = k.c(0.5, 0.2, 0.04, 1, { ink: true });
      k.face(c.x, c.y, 0.04);
    },
  },
  {
    id: 'scream',
    n: 'howling figure',
    bp: 'turm',
    make: (k) => {
      const w = k.rr(0.07, 0.1),
        h = k.rr(0.3, 0.4);
      const body = k.lathe(0.5, G - h, h, w, (t) => 0.5 + 0.5 * t, 6, 0);
      const hd = k.e(0.5, G - h - w * 1.2, w * 1.0, w * 1.5, 0, 2);
      for (const s of [-1, 1]) k.line([[0.5 + s * w * 0.6, G - h + 0.03], [0.5 + s * w * 1.5, G - h - w * 0.5], [0.5 + s * w * 1.05, hd.y]], 0.012);
      for (let i = 0; i < 4; i++) k.line(curve(k.r, 0.2, 0.2 + i * 0.08, 0.6, 0.2, k.rr(-0.6, 0.6), 10, 0.3), 0.005);
      k.face(0.5, hd.y, w * 0.95);
      void body;
    },
  },
  {
    id: 'cubist',
    n: 'cubist mask',
    bp: 'doppelkopf',
    make: (k) => {
      const n = k.ri(4, 7);
      k.e(0.5, 0.5, k.rr(0.14, 0.18), k.rr(0.19, 0.24), k.rr(-0.2, 0.2), -1);
      for (let i = 0; i < n; i++) {
        const x = 0.5 + k.rr(-0.1, 0.1),
          y = 0.5 + k.rr(-0.13, 0.13),
          s = k.rr(0.05, 0.1);
        if (k.chance(0.5)) k.rect(x, y, s * 1.5, s, k.rr(-0.8, 0.8), 0.05, i, { ink: true, crisp: 0.15 });
        else k.tri([x - s, y + s * 0.6], [x + s, y + s * 0.4], [x + k.rr(-0.6, 0.6) * s, y - s], i, { ink: true });
      }
      k.face(0.45, 0.45, 0.07);
      k.face(0.58, 0.55, 0.06);
    },
  },

  /* ----- Sagenwesen ----- */
  {
    id: 'griffin',
    n: 'griffin',
    bp: 'flatterer',
    make: (k) => {
      const q = quad(k, { head: ['bird', 'owl', 'cat'], hs: [0.06, 0.08], bl: [0.15, 0.2], bh: [0.08, 0.1], leg: ['paw', 'claw'], ll: [0.08, 0.12], lw: [0.018, 0.024], neck: [0.03, 0.08], tail: ['tuft', 'peacock'], poses: ['stand', 'sit', 'rear'] });
      wings(k, k.pick(['feather', 'angel', 'bat'] as const), q.body.x, q.body.y - q.body.ry * 0.7, q.L * 1.2, true, 4, k.rr(0, 1.3));
    },
  },
  {
    id: 'dragon',
    n: 'dragon',
    bp: 'schlange',
    w: 1.3,
    make: (k) => {
      if (k.chance(0.5)) {
        const pts = curve(k.r, 0.75, 0.6, k.rr(0.7, 0.95), PI + k.rr(-0.3, 0.3), k.rr(-3, 3), 22, 0.35);
        const segs = k.tube(pts, 0.04, 0.05, 0, 14);
        for (let i = 2; i < segs.length; i += 2) k.tri([segs[i]!.x - 0.015, segs[i]!.y - 0.03], [segs[i]!.x + 0.015, segs[i]!.y - 0.03], [segs[i]!.x, segs[i]!.y - 0.06], -1);
        for (const j of [3, 8]) if (segs[j]) for (const dz of [-1, 1]) leg(k, 'claw', segs[j]!.x + dz * 0.01, segs[j]!.y + 0.02, 0.05, 0.01, dz * 0.4, dz);
        const e = pts[pts.length - 1]!;
        head(k, 'dragon', e[0] - 0.02, e[1], 0.07, -1, 2);
      } else {
        const q = quad(k, { head: ['dragon', 'croc'], hs: [0.06, 0.08], bl: [0.15, 0.22], bh: [0.08, 0.11], leg: ['claw', 'pillar', 'paw'], ll: [0.07, 0.12], lw: [0.02, 0.03], neck: [0.06, 0.14], tail: ['fat', 'sting'], poses: ['stand', 'walk', 'sit', 'rear'] });
        wings(k, 'bat', q.body.x, q.body.y - q.body.ry * 0.7, q.L * 1.2, true, 4, k.rr(0, 1.3));
      }
    },
  },
  {
    id: 'cerberus',
    n: 'many-headed hound',
    bp: 'doppelkopf',
    make: (k) => {
      const q = quad(k, { head: ['dog', 'fox', 'lion', 'cat'], hs: [0.06, 0.08], bl: [0.16, 0.22], bh: [0.09, 0.12], leg: ['paw', 'pillar'], ll: [0.07, 0.12], lw: [0.02, 0.03], neck: [0.03, 0.08], tail: ['bushy', 'sting', 'fat'], poses: ['stand', 'sit', 'lie'] });
      const n = k.ri(1, 2),
        kinds: HeadKind[] = k.chance(0.6) ? [q.kind] : [...HEAD_KINDS];
      for (let i = 0; i < n; i++) head(k, k.pick(kinds), q.hd.x + 0.05 * (i + 1), q.hd.y - 0.05 * (i % 2 ? -0.6 : 1), q.hd.r * k.rr(0.85, 1), -1, 1 - i);
    },
  },
  {
    id: 'hydra',
    n: 'hydra',
    bp: 'doppelkopf',
    make: (k) => {
      const body = k.e(0.5, 0.68, k.rr(0.15, 0.2), k.rr(0.1, 0.13), 0, 0);
      const n = k.ri(3, 5),
        kind = pickHead(k, ['dragon', 'croc', 'round', 'bird', 'dog']);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1),
          a = -PI * (0.85 - 0.7 * t),
          len = k.rr(0.2, 0.32),
          x0 = 0.5 + (t - 0.5) * body.rx;
        const x1 = x0 + Math.cos(a) * len,
          y1 = body.y - body.ry * 0.6 + Math.sin(a) * len;
        neckTo(k, x0, body.y - body.ry * 0.6, x1, y1, 0.03, k.rr(-0.05, 0.05));
        head(k, k.chance(0.8) ? kind : k.pick(HEAD_KINDS), x1, y1 - 0.02, k.rr(0.045, 0.065), x1 < 0.5 ? -1 : 1, 2);
      }
      for (const s of [-1, 1]) leg(k, 'stub', 0.5 + s * body.rx * 0.5, body.y + body.ry * 0.6, 0.06, 0.03, 0, 1);
      tail(k, 'fat', body.x + body.rx * 0.9, body.y, 1, body.rx, -2);
    },
  },
  {
    id: 'twoheads',
    n: 'twin heads',
    bp: 'doppelkopf',
    w: 3,
    kinds: [
      { k: 'twin', n: 'twin necks' },
      { k: 'stack', n: 'head on head' },
      { k: 'siamese', n: 'joined twins' },
      { k: 'janus', n: 'two-faced' },
    ],
    make: (k) => {
      const kind = k.kind(['twin', 'stack', 'siamese', 'janus']);
      const body = k.e(0.5, 0.66, k.rr(0.14, 0.2), k.rr(0.11, 0.15), 0, 0);
      if (kind === 'twin')
        for (const s of [-1, 1]) {
          const hx = 0.5 + s * k.rr(0.1, 0.17),
            hy = k.rr(0.28, 0.4);
          neckTo(k, 0.5 + s * body.rx * 0.3, body.y - body.ry * 0.5, hx, hy, 0.03, 0);
          head(k, pickHead(k, ['round', 'cat', 'dog', 'bear', 'bird', 'frog', 'robot', 'mouse']), hx, hy, k.rr(0.06, 0.1), 0, 2);
        }
      else if (kind === 'stack') {
        const r1 = k.rr(0.07, 0.1),
          h1 = head(k, pickHead(k, ['round', 'bear', 'cat', 'owl']), 0.5, body.y - body.ry - r1 * 0.7, r1, 0, 2);
        head(k, pickHead(k, ['round', 'bird', 'chibi', 'frog']), 0.5 + k.rr(-0.04, 0.04), h1.top - 0.05, r1 * k.rr(0.6, 0.85), 0, 4);
      } else if (kind === 'siamese') {
        for (const s of [-1, 1]) {
          k.e(0.5 + s * 0.09, body.y - 0.02, 0.1, 0.13, s * 0.15, 0);
          head(k, pickHead(k, ['round', 'cat', 'dog', 'bear', 'pig']), 0.5 + s * 0.12, body.y - 0.2, k.rr(0.06, 0.08), 0, 2);
        }
      } else {
        k.face(0.5 - body.rx * 0.5, body.y - body.ry * 0.2, body.ry * 0.6);
        k.face(0.5 + body.rx * 0.5, body.y - body.ry * 0.2, body.ry * 0.6);
      }
      for (const s of [-1, 1]) leg(k, k.pick(['stub', 'thin', 'paw'] as const), 0.5 + s * body.rx * 0.5, body.y + body.ry * 0.8, 0.07, 0.02, 0, 1);
      if (k.chance(0.4)) tail(k, k.pick(['curl', 'fat', 'bushy'] as const), body.x + body.rx * 0.9, body.y, 1, body.rx, -2);
    },
  },
  {
    id: 'cherries',
    n: 'paired fruit',
    bp: 'doppelkopf',
    make: (k) => {
      const R = k.rr(0.09, 0.13),
        top: Pt = [0.5 + k.rr(-0.05, 0.05), 0.2];
      for (const s of [-1, 1]) {
        const x = 0.5 + s * R * k.rr(1.0, 1.4),
          y = G - R - k.rr(0, 0.06);
        k.line([[x, y - R], [top[0], top[1]]], 0.008);
        const c = k.c(x, y, R, 0, { ink: true });
        k.face(c.x, c.y, R * 0.7);
      }
      k.e(top[0] + 0.04, top[1] + 0.01, 0.05, 0.02, -0.4, 1, { leaf: true });
    },
  },
  {
    id: 'golem',
    n: 'stone golem',
    bp: 'turm',
    make: (k) => {
      const b = biped(k, { head: ['round', 'moai', 'skull', 'robot'], hs: [0.05, 0.07], body: ['rect', 'round', 'egg'], bw: [0.12, 0.17], bh: [0.12, 0.16], arms: ['blob'], legs: ['pillar', 'stub'], ll: [0.05, 0.1] });
      for (let i = 0; i < k.ri(3, 7); i++) k.c(...edge(b.body, k.rr(0, 6.28), 0.9), k.rr(0.025, 0.05), -1);
      if (k.chance(0.5)) for (let i = 0; i < 3; i++) k.e(0.5 + k.rr(-0.6, 0.6) * b.body.rx, b.body.y - b.body.ry * k.rr(0.7, 1), 0.012, 0.03, k.rr(-0.5, 0.5), 2, { leaf: true });
    },
  },
  {
    id: 'gargoyle',
    n: 'gargoyle',
    bp: 'flatterer',
    make: (k) => {
      const q = quad(k, { head: ['dragon', 'cat', 'dog', 'skull', 'owl'], hs: [0.06, 0.08], bl: [0.12, 0.16], bh: [0.08, 0.1], leg: ['claw'], ll: [0.05, 0.08], lw: [0.016, 0.02], neck: [0, 0.02], tail: ['sting', 'curl'], poses: ['sit', 'sit', 'lie'] });
      wings(k, 'bat', q.body.x, q.body.y - q.body.ry * 0.7, q.L * 1.1, true, 4, k.rr(0.3, 1.2));
      for (const s of [-1, 1]) k.line(curve(k.r, q.hd.x + s * q.hd.r * 0.3, q.hd.y - q.hd.r * 0.7, q.hd.r, -PI / 2 + s * 0.6, s * -1, 5), 0.012);
      k.rect(q.body.x, G + 0.03, 0.4, 0.06, 0, 0.05, 5, { ink: true });
    },
  },
  {
    id: 'jackalope',
    n: 'antlered hopper',
    bp: 'huepfer',
    make: (k) => {
      const q = quad(k, { head: ['bunny'], hs: [0.055, 0.075], bl: [0.11, 0.15], bh: [0.07, 0.1], leg: ['stub', 'paw'], ll: [0.03, 0.06], lw: [0.018, 0.024], neck: [0, 0.02], tail: ['stub'], poses: ['sit', 'stand', 'rear'] });
      for (const s of [-1, 1]) {
        const a = curve(k.r, q.hd.x + s * q.hd.r * 0.3, q.hd.y - q.hd.r * 0.8, q.hd.r * 1.8, -PI / 2 + s * 0.4, s * 0.5, 6);
        k.line(a, 0.01);
        for (const j of [2, 4]) k.line([a[j]!, [a[j]![0] + s * q.hd.r * 0.5, a[j]![1] - q.hd.r * 0.3]], 0.008);
      }
    },
  },

  /* ----- Schlangen ----- */
  {
    id: 'snake',
    n: 'snake',
    bp: 'schlange',
    w: 4,
    kinds: [
      { k: 'wave', n: 'snake' },
      { k: 'coil', n: 'coiled snake' },
      { k: 'cobra', n: 'hooded snake' },
      { k: 'humps', n: 'sea serpent' },
      { k: 'knot', n: 'knotted snake' },
    ],
    make: (k) => {
      const kind = k.kind(['wave', 'coil', 'cobra', 'humps', 'knot']);
      let hx = 0.3,
        hy = 0.5;
      if (kind === 'wave') {
        const len = k.rr(0.55, 0.75),
          amp = k.rr(0.03, 0.12),
          fr = k.rr(3, 8),
          ph = k.rr(0, 6.28),
          pts: Pt[] = [];
        for (let i = 0; i <= 24; i++) pts.push([0.5 - len / 2 + (len * i) / 24, 0.55 + sin(ph + (i / 24) * fr) * amp]);
        k.tube(pts.slice().reverse(), k.rr(0.02, 0.035), k.rr(0.045, 0.075), 0, 12);
        [hx, hy] = pts[0]!;
      } else if (kind === 'coil') {
        const pts: Pt[] = [],
          Rc = k.rr(0.13, 0.18),
          turns = k.rr(1, 1.6),
          a0 = k.rr(0, 6.28);
        for (let i = 0; i <= 30; i++) {
          const t = i / 30;
          pts.push([0.5 + Math.cos(a0 + t * turns * PI * 2) * (0.02 + Rc * t), 0.68 + sin(a0 + t * turns * PI * 2) * (0.02 + Rc * t) * 0.5]);
        }
        const last = pts[30]!;
        hx = 0.5 + k.rr(-0.1, 0.1);
        hy = k.rr(0.3, 0.4);
        for (let i = 1; i <= 8; i++) pts.push([last[0] + (hx - last[0]) * (i / 8) + sin((i / 8) * 3) * 0.03, last[1] + (hy - last[1]) * (i / 8)]);
        k.tube(pts, 0.03, 0.055, 0, 14);
      } else if (kind === 'cobra') {
        const pts: Pt[] = [],
          h = k.rr(0.35, 0.5),
          amp = k.rr(0.04, 0.09),
          ph = k.rr(0, 6.28);
        for (let i = 0; i <= 18; i++) pts.push([0.5 + sin(ph + (i / 18) * PI * 1.5) * amp * (1 - i / 36), G - (i / 18) * h]);
        k.e(0.45, G + 0.01, 0.08, 0.035, 0, -1);
        k.tube(pts, 0.06, 0.045, 0, 10);
        [hx, hy] = pts[18]!;
        k.e(hx, hy + 0.03, k.rr(0.08, 0.13), k.rr(0.08, 0.12), 0, 1);
      } else if (kind === 'humps') {
        const n = k.ri(2, 3),
          w = k.rr(0.14, 0.19),
          rad = k.rr(0.035, 0.05),
          x0 = 0.5 - (n * w) / 2 + w * 0.3;
        for (let j = 0; j < n; j++) {
          const arc: Pt[] = [];
          for (let i = 0; i <= 12; i++) arc.push([x0 + j * w + (i / 12) * w * 0.8, 0.62 - sin((i / 12) * PI) * k.rr(0.08, 0.14)]);
          k.tube(arc, rad, rad * 0.9, 0, 4);
        }
        const neck: Pt[] = [];
        for (let i = 0; i <= 8; i++) neck.push([x0 - (i / 8) * 0.06, 0.62 - (i / 8) * 0.24]);
        k.tube(neck, rad * 1.1, rad * 0.9, 0, 3);
        [hx, hy] = neck[8]!;
        if (k.chance(0.5)) k.e(0.5, 0.64, n * w * 0.62, 0.012, 0, -2, { wing: true });
      } else {
        const A = k.rr(0.2, 0.27),
          pts: Pt[] = [];
        for (let i = 0; i <= 30; i++) {
          const t = 0.4 + (i / 30) * (PI * 2 - 0.9),
            d = 1 + sin(t) ** 2;
          pts.push([0.5 + (A * Math.cos(t)) / d, 0.55 + ((A * sin(t) * Math.cos(t)) / d) * 1.4]);
        }
        k.tube(pts, 0.035, 0.045, 0, 14);
        [hx, hy] = pts[30]!;
        hy -= 0.04;
      }
      const hd = head(k, pickHead(k, ['round', 'croc', 'dragon', 'round', 'cat']), hx, hy, k.rr(0.05, 0.07), -1, 3);
      if (k.chance(0.4)) k.line([[hd.x - hd.r, hd.y + hd.r * 0.3], [hd.x - hd.r * 1.6, hd.y + hd.r * 0.4], [hd.x - hd.r * 1.8, hd.y + hd.r * 0.2]], 0.005);
      trimmings(k, hd, null);
    },
  },
  {
    id: 'scarf',
    n: 'ribbon spirit',
    bp: 'schlange',
    make: (k) => {
      const pts = curve(k.r, 0.25, 0.3, k.rr(0.6, 0.8), k.rr(0, 0.6), k.rr(-2, 2), 16, 0.3),
        w = k.rr(0.03, 0.05);
      const left: Pt[] = [],
        right: Pt[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)]!,
          b = pts[Math.min(pts.length - 1, i + 1)]!,
          ang = Math.atan2(b[1] - a[1], b[0] - a[0]),
          ww = w * (1 + 0.4 * sin(i * 0.9));
        left.push([pts[i]![0] - sin(ang) * ww, pts[i]![1] + Math.cos(ang) * ww]);
        right.push([pts[i]![0] + sin(ang) * ww, pts[i]![1] - Math.cos(ang) * ww]);
      }
      k.poly([...left, ...right.reverse()], 0, { crisp: 0.5 });
      for (let i = 0; i < 4; i++) k.line([pts[pts.length - 1]!, [pts[pts.length - 1]![0] + k.rr(-0.04, 0.04), pts[pts.length - 1]![1] + 0.05]], 0.004);
      k.face(pts[1]![0], pts[1]![1], w * 1.3);
    },
  },

  /* ----- Quallen und Hängendes ----- */
  {
    id: 'jelly',
    n: 'jellyfish',
    bp: 'qualle',
    w: 6,
    kinds: [
      { k: 'dome', n: 'jellyfish' },
      { k: 'bell', n: 'bell jelly' },
      { k: 'squid', n: 'squid' },
      { k: 'octopus', n: 'octopus' },
      { k: 'anemone', n: 'anemone' },
      { k: 'chain', n: 'bell chain' },
    ],
    make: (k) => {
      const kind = k.kind(['dome', 'bell', 'squid', 'octopus', 'anemone', 'chain']);
      if (kind === 'squid') {
        const m = k.e(0.5, 0.33, k.rr(0.07, 0.11), k.rr(0.15, 0.22), 0, 0);
        for (const s of [-1, 1]) k.e(0.5 + s * m.rx * 0.9, m.y - m.ry * 0.7, 0.07, 0.03, -s * 0.6, -1, { wing: true });
        for (let i = 0; i < 8; i++) k.line(curve(k.r, 0.5 - m.rx * 0.8 + (i * m.rx * 1.6) / 7, m.y + m.ry, k.rr(0.12, 0.3), PI / 2 + (i - 3.5) * 0.12, k.rr(-1, 1), 8, 0.15), i === 2 || i === 5 ? 0.006 : 0.01);
        k.face(0.5, m.y + m.ry * 0.55, m.rx * 0.9);
      } else if (kind === 'octopus') {
        const R = k.rr(0.12, 0.17),
          h = k.e(0.5, 0.4, R, R * k.rr(1, 1.3), 0, 0);
        const n = k.ri(5, 8);
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1),
            a = PI * (0.95 - 0.9 * t);
          k.line(curve(k.r, 0.5 + Math.cos(a) * R * 0.75, h.y + h.ry * 0.6, k.rr(0.16, 0.28), a, (t < 0.5 ? 1 : -1) * k.rr(1.2, 3.2), 9), k.rr(0.018, 0.028));
        }
        k.face(0.5, h.y + h.ry * 0.25, R * 0.8);
      } else if (kind === 'anemone') {
        const col = k.e(0.5, 0.66, k.rr(0.09, 0.12), k.rr(0.11, 0.15), 0, 0);
        k.e(0.5, 0.8, col.rx * 1.3, 0.05, 0, -1);
        const n = k.ri(8, 14);
        for (let i = 0; i < n; i++) k.line(curve(k.r, 0.5 - col.rx * 0.9 + (col.rx * 1.8 * i) / (n - 1), col.y - col.ry * 0.8, k.rr(0.12, 0.26), -PI / 2 + (i / (n - 1) - 0.5) * k.rr(1.2, 2.2), k.rr(-1, 1), 8, 0.25), k.rr(0.007, 0.012));
        k.face(0.5, col.y + col.ry * 0.1, col.rx * 0.85);
      } else if (kind === 'chain') {
        let y = 0.24;
        const n = k.ri(2, 4);
        let first: B | null = null;
        for (let i = 0; i < n; i++) {
          const rx = k.rr(0.07, 0.12) * (1 - i * 0.12),
            ry = rx * k.rr(0.6, 0.85);
          const b = k.lathe(0.5, y, ry * 2, rx, (t) => Math.sqrt(t), 6, -i, { ink: true });
          first ??= b;
          y += ry * 1.8;
        }
        for (let i = 0; i < k.ri(3, 7); i++) k.line(curve(k.r, 0.5 + k.rr(-0.05, 0.05), y, k.rr(0.15, 0.3), PI / 2, k.rr(-0.6, 0.6), 8, 0.3), 0.006);
        k.face(0.5, first!.y + first!.ry * 0.2, first!.rx * 0.8);
      } else {
        const bell = kind === 'bell',
          w = k.rr(0.16, 0.25),
          h = k.rr(0.12, 0.22);
        const d = bell ? k.lathe(0.5, 0.22, h * 1.4, w, (t) => Math.sqrt(t), 8, 0) : k.e(0.5, 0.37, w, h * 0.8, 0, 0);
        const sy = d.y + d.ry * 0.85,
          n = k.ri(3, 12);
        for (let i = 0; i < n; i++) k.line(curve(k.r, 0.5 - w * 0.75 + (w * 1.5 * i) / Math.max(1, n - 1), sy, k.rr(0.16, 0.42), PI / 2 + k.rr(-0.2, 0.2), k.rr(-0.6, 0.6), 10, 0.25), k.rr(0.006, 0.013));
        if (k.chance(0.45)) k.tube(curve(k.r, 0.5, sy, k.rr(0.15, 0.25), PI / 2, k.rr(-1, 1), 10, 0.15), 0.035, 0.018, 1, 5);
        k.face(0.5, d.y + (bell ? d.ry * 0.3 : 0.01), Math.min(w, h) * 0.8);
      }
    },
  },
  {
    id: 'chandelier',
    n: 'chandelier',
    bp: 'qualle',
    make: (k) => {
      const w = k.rr(0.18, 0.26),
        cy = 0.42;
      k.line([[0.5, 0.08], [0.5, cy - 0.06]], 0.006);
      const b = k.lathe(0.5, cy - 0.07, 0.12, 0.06, (t) => 0.5 + 0.5 * sin(t * PI), 6, 1, { ink: true });
      const n = k.ri(2, 4);
      for (let i = 0; i < n; i++)
        for (const s of [-1, 1]) {
          const x = 0.5 + s * w * ((i + 1) / n);
          k.line([[0.5, cy], [x, cy + 0.05], [x, cy - 0.02]], 0.007);
          k.rect(x, cy - 0.05, 0.016, 0.05, 0, 0.3, 2);
          k.e(x, cy - 0.095, 0.01, 0.018, 0, 3, { wing: true });
        }
      for (let i = 0; i < k.ri(3, 7); i++) k.e(0.5 + k.rr(-0.8, 0.8) * w, cy + k.rr(0.08, 0.16), 0.012, 0.025, 0, 2, { ink: true });
      k.face(0.5, cy - 0.01, 0.045);
      void b;
    },
  },
  {
    id: 'mop',
    n: 'shaggy',
    bp: 'qualle',
    make: (k) => {
      const w = k.rr(0.13, 0.2),
        top = k.rr(0.25, 0.35);
      const b = k.e(0.5, top, w, w * 0.6, 0, 0);
      const n = k.ri(10, 18);
      for (let i = 0; i < n; i++) k.line(curve(k.r, 0.5 - w + (i * w * 2) / (n - 1), top, k.rr(0.25, 0.45), PI / 2 + (i / (n - 1) - 0.5) * 0.5, k.rr(-0.5, 0.5), 8, 0.12), k.rr(0.008, 0.016));
      k.face(0.5, top + w * 0.35, w * 0.6);
      void b;
    },
  },

  /* ----- Strahler ----- */
  {
    id: 'radial',
    n: 'radiant',
    bp: 'strahler',
    w: 7,
    kinds: [
      { k: 'star', n: 'starfish' },
      { k: 'sun', n: 'little sun' },
      { k: 'urchin', n: 'urchin' },
      { k: 'flower', n: 'flower' },
      { k: 'snowflake', n: 'snowflake' },
      { k: 'pinwheel', n: 'pinwheel' },
      { k: 'sunflower', n: 'sunflower' },
    ],
    make: (k) => {
      const kind = k.kind(['star', 'sun', 'urchin', 'flower', 'snowflake', 'pinwheel', 'sunflower']);
      const R = k.rr(0.07, 0.14),
        n = kind === 'urchin' ? k.ri(16, 26) : kind === 'sun' ? k.ri(9, 16) : k.ri(3, 9),
        off = k.rr(0, 6.28);
      let core: B;
      if (kind === 'flower' || kind === 'sunflower') {
        const cy = 0.4,
          pl = kind === 'sunflower' ? R * 0.9 : k.rr(0.06, 0.1);
        for (let ring = 0; ring < (kind === 'sunflower' ? 2 : 1); ring++)
          for (let i = 0; i < (kind === 'sunflower' ? 14 : n); i++) {
            const a = off + (i * 2 * PI) / (kind === 'sunflower' ? 14 : n) + ring * 0.2;
            k.e(0.5 + Math.cos(a) * (R + pl * 0.6), cy + sin(a) * (R + pl * 0.6), pl, pl * 0.4, a, ring - 2, { wing: true });
          }
        core = k.c(0.5, cy, R, 0, { ink: true });
        const st = curve(k.r, 0.5, cy + R, G - cy - R, PI / 2, k.rr(-0.5, 0.5), 6);
        k.line(st, 0.011);
        k.e(st[3]![0] + 0.04, st[3]![1], 0.05, 0.02, -0.4, 1, { leaf: true });
      } else {
        core = kind === 'pinwheel' ? k.c(0.5, 0.45, R * 0.5, 2, { ink: true }) : k.c(0.5, 0.5, R, 0, { ink: true });
        for (let i = 0; i < n; i++) {
          const a = off + (i * 2 * PI) / n;
          if (kind === 'star') k.e(0.5 + Math.cos(a) * (R + 0.07), 0.5 + sin(a) * (R + 0.07), k.rr(0.07, 0.13), k.rr(0.03, 0.05), a + k.rr(-0.3, 0.3), -1);
          else if (kind === 'sun') k.line(curve(k.r, 0.5 + Math.cos(a) * R * 0.9, 0.5 + sin(a) * R * 0.9, k.rr(0.06, 0.13) * (i % 2 ? 0.7 : 1), a, k.chance(0.5) ? k.rr(-1, 1) : 0, 5, 0.2), 0.014);
          else if (kind === 'urchin') k.line([edge(core, a, 0.9), edge(core, a, k.rr(1.5, 2.3))], 0.007);
          else if (kind === 'snowflake') {
            const L = k.rr(0.16, 0.24),
              e: Pt = [0.5 + Math.cos(a) * L, 0.5 + sin(a) * L];
            k.line([[0.5, 0.5], e], 0.01);
            for (const f of [0.45, 0.7]) for (const s of [-1, 1]) k.line([[0.5 + Math.cos(a) * L * f, 0.5 + sin(a) * L * f], [0.5 + Math.cos(a) * L * f + Math.cos(a + s * 0.8) * L * 0.25, 0.5 + sin(a) * L * f + sin(a + s * 0.8) * L * 0.25]], 0.007);
          } else k.tri([0.5, 0.45], [0.5 + Math.cos(a) * 0.22, 0.45 + sin(a) * 0.22], [0.5 + Math.cos(a + 0.6) * 0.15, 0.45 + sin(a + 0.6) * 0.15], -1, { ink: true });
        }
        if (kind === 'pinwheel') k.line([[0.5, 0.45], [0.5, G]], 0.01);
      }
      k.face(core.x, core.y, core.rx * 0.85, { cyclops: kind === 'star' && k.chance(0.5) });
    },
  },

  /* ----- Schwebendes ----- */
  {
    id: 'cloud',
    n: 'cloud',
    bp: 'schwebeblase',
    make: (k) => {
      const n = k.ri(4, 8),
        w = k.rr(0.3, 0.45);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        k.c(0.5 - w / 2 + w * t, 0.48 - sin(t * PI) * k.rr(0.03, 0.09), k.rr(0.06, 0.09) + sin(t * PI) * k.rr(0.02, 0.05), 0);
      }
      const main = k.e(0.5, 0.5, w * 0.5, 0.07, 0, 0);
      const kind = k.pick(['rain', 'bolt', 'none', 'snow']);
      if (kind === 'rain') for (let i = 0; i < k.ri(3, 6); i++) k.e(0.5 + k.rr(-0.4, 0.4) * w, 0.62 + k.rr(0, 0.12), 0.012, 0.025, 0, 1);
      else if (kind === 'bolt') k.poly([[0.5, 0.56], [0.53, 0.56], [0.51, 0.64], [0.55, 0.64], [0.47, 0.78], [0.49, 0.67], [0.46, 0.67]], 1, { ink: true, crisp: 0.15 });
      else if (kind === 'snow') for (let i = 0; i < 4; i++) k.star(0.5 + k.rr(-0.4, 0.4) * w, 0.64 + k.rr(0, 0.12), 0.006, 0.016, 6, 0, 1);
      k.face(0.5, 0.48, 0.07);
      void main;
    },
  },
  {
    id: 'planet',
    n: 'little planet',
    bp: 'schwebeblase',
    make: (k) => {
      const R = k.rr(0.13, 0.19),
        tilt = k.rr(-0.5, 0.5);
      const p = k.c(0.5, 0.5, R, 0, { ink: true });
      if (k.chance(0.7)) {
        k.e(0.5, 0.5, R * 1.9, R * 0.35, tilt, -1, { wing: true });
        k.e(0.5 + Math.cos(tilt) * R * 0.4, 0.5 + sin(tilt) * R * 0.4, R * 1.5, R * 0.18, tilt, 1, { wing: true });
      }
      for (let i = 0; i < k.ri(0, 4); i++) k.ring(...edge(p, k.rr(0, 6.28), k.rr(0.3, 0.7)), R * 0.15, R * 0.12, 0.005);
      for (let i = 0; i < k.ri(0, 2); i++) k.c(0.5 + k.rr(-2, 2) * R, 0.5 + k.rr(-1.8, -1.2) * R, R * k.rr(0.15, 0.25), 2, { ink: true });
      k.face(0.5, 0.5, R * 0.7);
    },
  },
  {
    id: 'eyeball',
    n: 'floating eye',
    bp: 'schwebeblase',
    make: (k) => {
      const R = k.rr(0.13, 0.18),
        b = k.c(0.5, 0.45, R, 0, { ink: true });
      for (let i = 0; i < k.ri(3, 7); i++) k.line(curve(k.r, ...edge(b, k.rr(0.3, 2.8), 0.98), k.rr(0.06, 0.18), k.rr(0.6, 2.5), k.rr(-1, 1), 6, 0.2), 0.006);
      if (k.chance(0.5)) wings(k, k.pick(['bat', 'feather', 'tiny'] as const), 0.5, 0.42, R, false, -2, k.rr(0, 1));
      k.face(0.5, 0.45, R * 0.9, { cyclops: true });
    },
  },
];

