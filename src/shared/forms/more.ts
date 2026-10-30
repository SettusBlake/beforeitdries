/*
 * Weitere Vorlagen für Baupläne mit wenig Auswahl: Hängendes (Qualle), Strahlendes, Langes (Schlange),
 * Mehrköpfiges, Scherentiere und Greifmaschinen, Kriechendes, Fliegendes und Hüpfendes.
 */
import type { Pt } from '../data';
import type { Arche } from './animals';
import { biped, quad, trimmings } from './animals';
import { curve, edge, type Kit } from './kit';
import { head, leg, pickHead, tail, wheel, wings } from './parts';

const G = 0.82,
  PI = Math.PI,
  sin = Math.sin,
  cos = Math.cos;

/** Gesicht auf einen Kreis */
const faceAt = (k: Kit, x: number, y: number, r: number, cyclops = false) => k.face(x, y, r, cyclops ? { cyclops } : {});

export const MORE: Arche[] = [
  /* ----- Hängendes ----- */
  {
    id: 'parachute',
    n: 'parachute',
    bp: 'qualle',
    make: (k) => {
      const w = k.rr(0.2, 0.28),
        h = k.rr(0.1, 0.15),
        top = 0.18;
      k.lathe(0.5, top, h, w, (t) => Math.sqrt(t), 8, 0, { ink: true });
      for (let i = -2; i <= 2; i++) k.line([[0.5 + i * w * 0.45, top + h], [0.5, 0.62]], 0.004);
      const kind = k.pick(['box', 'creature', 'basket']);
      if (kind === 'creature') head(k, pickHead(k, ['cat', 'bear', 'round', 'mouse', 'frog']), 0.5, 0.68, 0.06, 0, 2);
      else {
        const b = k.rect(0.5, 0.67, 0.1, kind === 'box' ? 0.08 : 0.06, 0, 0.1, 1, { ink: true });
        faceAt(k, b.x, b.y, 0.04);
      }
      faceAt(k, 0.5, top + h * 0.6, h * 0.45);
    },
  },
  {
    id: 'windchime',
    n: 'wind chime',
    bp: 'qualle',
    make: (k) => {
      const w = k.rr(0.12, 0.18),
        top = 0.25;
      const b = k.lathe(0.5, top - 0.06, 0.08, w * 0.6, (t) => 0.3 + 0.7 * t, 4, 1, { ink: true });
      k.line([[0.5, 0.08], [0.5, top - 0.06]], 0.005);
      const n = k.ri(4, 7);
      for (let i = 0; i < n; i++) {
        const x = 0.5 - w + (i * w * 2) / (n - 1),
          L = k.rr(0.15, 0.32);
        k.line([[x, top + 0.02], [x, top + 0.06]], 0.003);
        k.rect(x, top + 0.06 + L / 2, 0.018, L, k.rr(-0.1, 0.1), 0.4, 0, { ink: true });
      }
      k.e(0.5, top + 0.42, 0.04, 0.06, 0, 2, { wing: true });
      faceAt(k, b.x, b.y, 0.035);
    },
  },
  {
    id: 'hangplant',
    n: 'hanging plant',
    bp: 'qualle',
    make: (k) => {
      const pw = k.rr(0.1, 0.14),
        top = 0.25;
      for (const s of [-1, 0, 1]) k.line([[0.5, 0.08], [0.5 + s * pw, top]], 0.003);
      const pot = k.lathe(0.5, top, pw * 0.9, pw, (t) => 1 - 0.3 * t * t, 5, 1, { ink: true });
      const n = k.ri(4, 8);
      for (let i = 0; i < n; i++) {
        const v = curve(k.r, 0.5 + k.rr(-0.9, 0.9) * pw, top + pw * 0.3, k.rr(0.2, 0.45), PI / 2 + k.rr(-0.4, 0.4), k.rr(-1, 1), 10, 0.2);
        k.line(v, 0.005);
        for (let j = 3; j < v.length; j += 3) k.e(v[j]![0] + 0.015, v[j]![1], 0.02, 0.01, k.rr(-0.8, 0.8), 0, { leaf: true });
      }
      faceAt(k, pot.x, pot.y, pw * 0.55);
    },
  },
  {
    id: 'tassellamp',
    n: 'fringed lamp',
    bp: 'qualle',
    make: (k) => {
      const w = k.rr(0.15, 0.22),
        h = k.rr(0.12, 0.18),
        top = 0.22;
      k.line([[0.5, 0.06], [0.5, top]], 0.005);
      const sh = k.poly([[0.5 - w * 0.55, top], [0.5 + w * 0.55, top], [0.5 + w, top + h], [0.5 - w, top + h]], 0, { ink: true });
      const n = k.ri(6, 11);
      for (let i = 0; i < n; i++) {
        const x = 0.5 - w + (i * w * 2) / (n - 1),
          L = k.rr(0.05, 0.12);
        k.line([[x, top + h], [x, top + h + L]], 0.004);
        k.c(x, top + h + L + 0.008, 0.009, 1);
      }
      faceAt(k, sh.x, sh.y, h * 0.5);
    },
  },

  /* ----- Strahlendes ----- */
  {
    id: 'ferris',
    n: 'big wheel',
    bp: 'strahler',
    make: (k) => {
      const R = k.rr(0.18, 0.24),
        cy = 0.42,
        n = k.ri(6, 10),
        a0 = k.rr(0, 1);
      k.ring(0.5, cy, R, R, 0.008, 0, PI * 2, 20);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i * 2 * PI) / n,
          x = 0.5 + cos(a) * R,
          y = cy + sin(a) * R;
        k.line([[0.5, cy], [x, y]], 0.004);
        k.rect(x, y + 0.025, 0.035, 0.035, 0, 0.3, 1, { ink: true });
      }
      for (const s of [-1, 1]) k.line([[0.5, cy], [0.5 + s * R * 0.7, G]], 0.012);
      const hub = k.c(0.5, cy, 0.04, 2, { ink: true });
      faceAt(k, hub.x, hub.y, 0.035);
    },
  },
  {
    id: 'fan',
    n: 'desk fan',
    bp: 'strahler',
    make: (k) => {
      const R = k.rr(0.15, 0.2),
        cy = 0.38,
        n = k.ri(3, 5),
        a0 = k.rr(0, 2);
      k.ring(0.5, cy, R * 1.12, R * 1.12, 0.006, 0, PI * 2, 20);
      for (let i = 0; i < 6; i++) k.line([[0.5, cy], [0.5 + cos((i * PI) / 3) * R * 1.12, cy + sin((i * PI) / 3) * R * 1.12]], 0.003);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i * 2 * PI) / n;
        k.e(0.5 + cos(a) * R * 0.55, cy + sin(a) * R * 0.55, R * 0.5, R * 0.22, a + 0.3, 0, { wing: true });
      }
      k.line([[0.5, cy + R * 1.1], [0.5, G - 0.04]], 0.016);
      k.e(0.5, G - 0.02, R * 0.7, 0.03, 0, 1, { ink: true });
      const hub = k.c(0.5, cy, R * 0.18, 2, { ink: true });
      faceAt(k, hub.x, hub.y, R * 0.16);
    },
  },
  {
    id: 'dandelion',
    n: 'seed puff',
    bp: 'strahler',
    make: (k) => {
      const R = k.rr(0.13, 0.18),
        cy = 0.38,
        n = k.ri(14, 20);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * PI + k.rr(-0.05, 0.05),
          e: Pt = [0.5 + cos(a) * R, cy + sin(a) * R];
        k.line([[0.5, cy], e], 0.003);
        for (const s of [-1, 1]) k.line([e, [e[0] + cos(a + s * 0.5) * 0.02, e[1] + sin(a + s * 0.5) * 0.02]], 0.003);
      }
      for (let i = 0; i < k.ri(0, 3); i++) {
        const x = 0.5 + R + k.rr(0.05, 0.2),
          y = cy - k.rr(0, 0.2);
        k.line([[x, y], [x, y + 0.04]], 0.003);
        for (const s of [-1, 0, 1]) k.line([[x, y], [x + s * 0.015, y - 0.015]], 0.003);
      }
      k.line(curve(k.r, 0.5, cy, G - cy, PI / 2, k.rr(-0.5, 0.5), 6), 0.009);
      const c = k.c(0.5, cy, R * 0.25, 1, { ink: true });
      faceAt(k, c.x, c.y, R * 0.22);
    },
  },
  {
    id: 'firework',
    n: 'firework',
    bp: 'strahler',
    make: (k) => {
      const n = k.ri(8, 14),
        R = k.rr(0.18, 0.26),
        cy = 0.42;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * PI,
          pts = curve(k.r, 0.5 + cos(a) * 0.04, cy + sin(a) * 0.04, R, a, k.rr(-0.4, 0.4) + 0.3, 5);
        k.line(pts, 0.006);
        const e = pts[pts.length - 1]!;
        if (k.chance(0.7)) k.star(e[0], e[1], 0.008, 0.02, 4, a, 1);
      }
      k.line(curve(k.r, 0.5, cy + 0.05, G - cy - 0.05, PI / 2, k.rr(-0.6, 0.6), 8, 0.2), 0.004);
      const c = k.c(0.5, cy, 0.05, 2, { ink: true });
      faceAt(k, c.x, c.y, 0.045);
    },
  },
  {
    id: 'compass',
    n: 'compass rose',
    bp: 'strahler',
    make: (k) => {
      const R = k.rr(0.2, 0.26);
      k.star(0.5, 0.5, R * 0.18, R, 4, -PI / 2, 0, { ink: true, crisp: 0.15 });
      k.star(0.5, 0.5, R * 0.12, R * 0.6, 4, -PI / 4, 1, { ink: true, crisp: 0.15 });
      k.ring(0.5, 0.5, R * 0.75, R * 0.75, 0.004, 0, PI * 2, 20);
      faceAt(k, 0.5, 0.5, R * 0.17);
    },
  },
  {
    id: 'web',
    n: 'web weaver',
    bp: 'strahler',
    make: (k) => {
      const R = k.rr(0.25, 0.32),
        n = k.ri(7, 10);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * PI;
        k.line([[0.5, 0.48], [0.5 + cos(a) * R, 0.48 + sin(a) * R]], 0.003);
      }
      for (let ring = 1; ring <= 4; ring++) {
        const pts: Pt[] = [];
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * 2 * PI,
            rr = (R * ring) / 4.3;
          pts.push([0.5 + cos(a) * rr, 0.48 + sin(a) * rr]);
        }
        k.line(pts, 0.003);
      }
      const sx = 0.5 + k.rr(-0.1, 0.1),
        sy = 0.48 + k.rr(-0.1, 0.1),
        body = k.c(sx, sy, 0.045, 1, { ink: true });
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) k.line([[sx, sy], [sx + s * 0.06, sy - 0.03 + i * 0.025], [sx + s * 0.08, sy + 0.01 + i * 0.03]], 0.004);
      faceAt(k, body.x, body.y, 0.04);
    },
  },
  {
    id: 'cartwheel',
    n: 'cartwheel',
    bp: 'strahler',
    make: (k) => {
      const R = k.rr(0.2, 0.26),
        n = k.ri(6, 12);
      k.ring(0.5, 0.5, R, R, 0.02, 0, PI * 2, 24);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * PI;
        k.line([[0.5 + cos(a) * R * 0.2, 0.5 + sin(a) * R * 0.2], [0.5 + cos(a) * R, 0.5 + sin(a) * R]], 0.01);
      }
      const hub = k.c(0.5, 0.5, R * 0.22, 1, { ink: true });
      faceAt(k, hub.x, hub.y, R * 0.2);
    },
  },

  /* ----- Langes ----- */
  {
    id: 'eel',
    n: 'eel',
    bp: 'schlange',
    make: (k) => {
      const pts = curve(k.r, 0.2, 0.55, k.rr(0.6, 0.8), k.rr(-0.3, 0.3), k.rr(-1.5, 1.5), 20, 0.25);
      const segs = k.tube(pts, k.rr(0.05, 0.065), 0.03, 0, 12, k.rr(0.9, 1.2));
      for (let i = 1; i < segs.length - 1; i += 2) k.e(segs[i]!.x, segs[i]!.y - segs[i]!.ry * 1.05, segs[i]!.rx * 0.9, segs[i]!.ry * 0.4, segs[i]!.rot, -1, { wing: true });
      const hd = head(k, pickHead(k, ['croc', 'round', 'dragon', 'fox']), pts[0]![0] - 0.02, pts[0]![1], 0.06, -1, 2);
      void hd;
    },
  },
  {
    id: 'worm',
    n: 'ringed worm',
    bp: 'schlange',
    make: (k) => {
      const pts = curve(k.r, 0.25, 0.65, k.rr(0.5, 0.7), k.rr(-0.6, 0.2), k.rr(-2.5, 2.5), 18, 0.2);
      const segs = k.tube(pts, 0.05, 0.04, 0, 12);
      for (const s of segs) k.line([edge(s, -PI / 2, 1), edge(s, PI / 2, 1)], 0.004);
      if (k.chance(0.4)) k.lathe(pts[0]![0], 0.25, 0.4, 0.06, () => 1, 2, -2, { wing: true });
      faceAt(k, pts[0]![0], pts[0]![1], 0.04);
    },
  },
  {
    id: 'rope',
    n: 'rope',
    bp: 'schlange',
    make: (k) => {
      const pts = curve(k.r, 0.2, 0.6, k.rr(0.55, 0.75), k.rr(-0.3, 0.3), k.rr(-2, 2), 24, 0.3),
        segs = k.tube(pts, 0.035, 0.035, 0, 14);
      for (const s of segs) k.line([edge(s, -2.2, 1), edge(s, 0.9, 1)], 0.004);
      if (k.chance(0.6)) k.ring(segs[segs.length >> 1]!.x, segs[segs.length >> 1]!.y, 0.06, 0.05, 0.012);
      const e = pts[pts.length - 1]!;
      for (let i = 0; i < 4; i++) k.line([e, [e[0] + k.rr(-0.04, 0.04) + 0.03, e[1] + k.rr(-0.04, 0.04)]], 0.004);
      faceAt(k, pts[0]![0], pts[0]![1], 0.035);
    },
  },
  {
    id: 'hose',
    n: 'garden hose',
    bp: 'schlange',
    make: (k) => {
      const pts = curve(k.r, 0.75, 0.75, k.rr(0.7, 0.9), PI + k.rr(-0.4, 0.4), k.rr(-3, 3), 24, 0.2);
      k.tube(pts, 0.03, 0.03, 0, 14);
      const e = pts[pts.length - 1]!,
        a = Math.atan2(e[1] - pts[pts.length - 3]![1], e[0] - pts[pts.length - 3]![0]);
      const nz = k.rect(e[0] + cos(a) * 0.04, e[1] + sin(a) * 0.04, 0.08, 0.04, a, 0.3, 1, { ink: true });
      for (let i = 0; i < 5; i++) k.line(curve(k.r, nz.x + cos(a) * 0.04, nz.y + sin(a) * 0.04, k.rr(0.08, 0.15), a + k.rr(-0.4, 0.4), 0.4, 5), 0.003);
      faceAt(k, nz.x, nz.y, 0.03);
    },
  },
  {
    id: 'slinky',
    n: 'coil spring',
    bp: 'schlange',
    make: (k) => {
      const n = k.ri(10, 16),
        h = k.rr(0.1, 0.18),
        arch = k.rr(0.1, 0.3),
        w = k.rr(0.5, 0.65);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1),
          x = 0.5 - w / 2 + w * t,
          y = 0.65 - sin(t * PI) * arch;
        k.ring(x, y, 0.025, h / 2, 0.008, 0, PI * 2, 10);
      }
      const hd = k.c(0.5 - w / 2 - 0.03, 0.65, h * 0.45, 1, { ink: true });
      faceAt(k, hd.x, hd.y, h * 0.4);
    },
  },
  {
    id: 'chainlink',
    n: 'chain',
    bp: 'schlange',
    make: (k) => {
      const pts = curve(k.r, 0.2, 0.5, k.rr(0.6, 0.75), k.rr(-0.2, 0.3), k.rr(-1.5, 1.5), 10);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!,
          b = pts[i + 1]!,
          ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        if (i % 2) k.line([[a[0], a[1]], [b[0], b[1]]], 0.01);
        else k.ring((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.045, 0.025, 0.01, ang, ang + PI * 2, 12);
      }
      const lock = k.rect(pts[0]![0] - 0.04, pts[0]![1], 0.09, 0.08, 0, 0.2, 1, { ink: true });
      k.ring(lock.x, lock.y - 0.05, 0.03, 0.03, 0.01, PI, PI * 2, 8);
      faceAt(k, lock.x, lock.y + 0.005, 0.035);
    },
  },

  /* ----- Mehrköpfiges ----- */
  {
    id: 'eagle2',
    n: 'two-headed eagle',
    bp: 'doppelkopf',
    make: (k) => {
      const body = k.e(0.5, 0.52, k.rr(0.08, 0.11), k.rr(0.13, 0.17), 0, 0);
      wings(k, 'feather', 0.5, 0.45, 0.2, false, -2, k.rr(0.3, 1.2));
      for (const s of [-1, 1]) {
        k.tube([[0.5 + s * 0.03, 0.4], [0.5 + s * 0.09, 0.3]], 0.03, 0.025, 1, 3);
        head(k, 'bird', 0.5 + s * 0.11, 0.27, 0.05, s, 2);
      }
      tail(k, 'peacock', 0.5, 0.62, 1, 0.14, -3);
      for (const s of [-1, 1]) leg(k, 'claw', 0.5 + s * 0.04, 0.66, 0.08, 0.012, s * 0.2, 1);
      void body;
    },
  },
  {
    id: 'rider',
    n: 'rider and mount',
    bp: 'doppelkopf',
    w: 1.5,
    make: (k) => {
      const q = quad(k, { head: ['horse', 'dog', 'cat', 'pig', 'bear', 'elephant', 'frog', 'mouse'], hs: [0.06, 0.09], bl: [0.15, 0.22], bh: [0.08, 0.12], leg: ['pillar', 'thin', 'paw', 'hoof'], ll: [0.06, 0.14], lw: [0.016, 0.026], neck: [0.02, 0.1], tail: ['tuft', 'curl', 'bushy', 'stub'], poses: ['stand', 'walk', 'walk'] });
      const rx = q.body.x + k.rr(-0.05, 0.03),
        ry = q.body.y - q.H * 0.9;
      const kind = k.pick(['creature', 'bird', 'snail', 'frog']);
      if (kind === 'creature') {
        const b = k.e(rx, ry - 0.05, 0.045, 0.06, 0, 4);
        head(k, pickHead(k, ['round', 'cat', 'mouse', 'chibi', 'robot']), rx, ry - 0.14, 0.05, -1, 5);
        k.line([[rx - 0.03, ry - 0.06], [q.hd.x + 0.04, q.hd.y + 0.02]], 0.006);
        void b;
      } else head(k, kind === 'bird' ? 'bird' : kind === 'frog' ? 'frog' : 'round', rx, ry - 0.04, 0.045, -1, 4);
      trimmings(k, null, null);
    },
  },
  {
    id: 'twinvessel',
    n: 'joined vessels',
    bp: 'doppelkopf',
    make: (k) => {
      const w = k.rr(0.08, 0.11);
      for (const s of [-1, 1]) {
        const h = k.rr(0.22, 0.34),
          x = 0.5 + s * w * 1.05;
        const b = k.lathe(x, G - h, h, w, (t) => 0.4 + 0.6 * sin(t * PI * 0.9 + 0.1), 8, 0, { ink: true });
        k.face(x, G - h * 0.5, w * 0.6);
        void b;
      }
      k.rect(0.5, G - 0.12, w * 1.2, 0.03, 0, 0.3, 1);
    },
  },
  {
    id: 'egg2',
    n: 'double yolk',
    bp: 'doppelkopf',
    make: (k) => {
      const w = k.rr(0.15, 0.2),
        h = w * 1.35;
      const b = k.lathe(0.5, G - h * 2, h * 2, w, (t) => Math.sqrt(sin(t * PI)) * (0.75 + 0.25 * t), 10, 0, { ink: true });
      const crack: Pt[] = [];
      for (let i = 0; i <= 8; i++) crack.push([0.5 - w + (i * w * 2) / 8, G - h * 1.1 + (i % 2 ? -0.03 : 0.02)]);
      k.line(crack, 0.006);
      for (const s of [-1, 1]) k.face(0.5 + s * w * 0.45, G - h * 0.7, w * 0.35);
      if (k.chance(0.5)) head(k, 'bird', 0.5, G - h * 1.95, w * 0.4, 0, 2);
      void b;
    },
  },

  /* ----- Scherentiere und Greifmaschinen ----- */
  {
    id: 'lobster',
    n: 'lobster',
    bp: 'krabbe',
    make: (k) => {
      const cara = k.e(0.4, 0.52, k.rr(0.1, 0.13), k.rr(0.06, 0.08), k.rr(-0.1, 0.1), 0, { ink: true });
      const t = curve(k.r, cara.x + cara.rx * 0.9, cara.y + 0.01, k.rr(0.24, 0.32), k.rr(-0.1, 0.15), k.rr(0.6, 2.2), 12);
      const segs = k.tube(t, cara.ry * 0.85, 0.03, -1, 6);
      for (const s of segs) k.line([edge(s, -PI / 2, 1), edge(s, PI / 2, 1)], 0.004);
      const e = t[t.length - 1]!;
      for (const a of [-0.5, 0, 0.5]) k.e(e[0] + 0.02, e[1] + 0.02, 0.035, 0.016, PI / 2 + a, -2);
      const hd = head(k, pickHead(k, ['round', 'croc', 'robot']), cara.x - cara.rx * 0.95, cara.y - 0.01, k.rr(0.045, 0.06), -1, 2);
      for (const s of [-1, 1]) k.line(curve(k.r, hd.x - hd.r * 0.5, hd.y - hd.r * 0.5, k.rr(0.2, 0.32), -2.3 + s * 0.25, k.rr(1, 2.2), 8), 0.005);
      for (const s of [-1, 1]) {
        const x = hd.x - k.rr(0.06, 0.12),
          y = hd.y + 0.05 + s * 0.03,
          sz = k.rr(0.04, 0.065);
        k.line([[cara.x - cara.rx * 0.6, cara.y + cara.ry * 0.5], [x + 0.03, y + 0.02], [x, y]], 0.012);
        k.e(x - sz * 0.5, y - sz * 0.25, sz, sz * 0.45, PI - 0.35, 3, { ink: true });
        k.e(x - sz * 0.4, y + sz * 0.25, sz * 0.8, sz * 0.35, PI + 0.45, 3, { ink: true });
      }
      for (let i = 0; i < 3; i++) leg(k, 'jointed', cara.x - cara.rx * 0.3 + i * 0.05, cara.y + cara.ry * 0.6, k.rr(0.07, 0.1), 0.008, k.rr(-0.3, 0.3), -1);
    },
  },
  {
    id: 'hermit',
    n: 'shell borrower',
    bp: 'krabbe',
    make: (k) => {
      const kind = k.pick(['spiral', 'teapot', 'can', 'skull']),
        sr = k.rr(0.13, 0.18);
      if (kind === 'spiral') {
        k.c(0.58, 0.5, sr, 0, { ink: true });
        k.c(0.62, 0.45, sr * 0.65, 1);
        k.c(0.65, 0.41, sr * 0.35, 1);
      } else if (kind === 'teapot') {
        k.e(0.58, 0.5, sr * 1.1, sr * 0.9, 0, 0, { ink: true });
        k.tube(curve(k.r, 0.58 + sr, 0.5, sr * 0.8, -0.6, -0.4, 5), sr * 0.18, sr * 0.08, -1, 4);
        k.lathe(0.58, 0.5 - sr - 0.03, 0.05, sr * 0.5, (t) => 0.4 + 0.6 * t, 3, 1);
      } else if (kind === 'can') k.rect(0.6, 0.5, sr * 1.6, sr * 2, 0.2, 0.15, 0, { ink: true });
      else head(k, 'skull', 0.6, 0.48, sr, 1, 0);
      const body = k.e(0.42, 0.6, k.rr(0.07, 0.1), k.rr(0.06, 0.08), 0, 2);
      for (const s of [-1, 1]) {
        const x = body.x - k.rr(0.07, 0.11),
          y = body.y + 0.03 + s * 0.035,
          sz = k.rr(0.04, 0.06) * (s > 0 ? 1.3 : 0.8);
        k.line([[body.x - body.rx * 0.6, body.y + 0.02], [x, y]], 0.012);
        k.e(x - sz * 0.5, y - sz * 0.2, sz, sz * 0.45, PI - 0.35, 3, { ink: true });
        k.e(x - sz * 0.4, y + sz * 0.25, sz * 0.8, sz * 0.35, PI + 0.45, 3, { ink: true });
      }
      for (let i = 0; i < 3; i++) leg(k, 'jointed', body.x - 0.03 + i * 0.035, body.y + body.ry * 0.6, k.rr(0.07, 0.1), 0.009, k.rr(-0.4, 0.2), -1);
      k.face(body.x, body.y - body.ry * 0.2, body.ry * 0.9, { stalks: true });
    },
  },
  {
    id: 'stagbeetle',
    n: 'antler beetle',
    bp: 'krabbe',
    make: (k) => {
      const body = k.e(0.5, 0.62, k.rr(0.1, 0.13), k.rr(0.15, 0.19), 0, 0, { ink: true });
      k.line([[0.5, body.y - body.ry], [0.5, body.y + body.ry]], 0.005);
      const hd = k.e(0.5, body.y - body.ry - 0.04, 0.07, 0.045, 0, 1, { ink: true });
      for (const s of [-1, 1]) {
        const m = curve(k.r, 0.5 + s * 0.04, hd.y - 0.03, k.rr(0.12, 0.2), -PI / 2 + s * 0.5, -s * k.rr(0.8, 1.6), 6);
        k.line(m, 0.016);
        k.line([m[3]!, [m[3]![0] - s * 0.03, m[3]![1] - 0.01]], 0.008);
        for (let i = 0; i < 3; i++) leg(k, 'jointed', 0.5 + s * body.rx * 0.8, body.y - body.ry * 0.5 + i * body.ry * 0.45, 0.1, 0.009, s * 0.7, -1);
      }
      k.face(0.5, hd.y, 0.04);
    },
  },
  {
    id: 'horseshoe',
    n: 'helmet crab',
    bp: 'krabbe',
    make: (k) => {
      const w = k.rr(0.17, 0.22);
      const b = k.lathe(0.5, 0.35, w * 1.4, w, (t) => Math.sqrt(sin(Math.min(1, t * 1.3) * PI * 0.5)), 8, 0, { ink: true });
      k.poly([[0.5 - w * 0.6, 0.35 + w * 1.4], [0.5 + w * 0.6, 0.35 + w * 1.4], [0.5 + w * 0.3, 0.35 + w * 2.1], [0.5 - w * 0.3, 0.35 + w * 2.1]], -1, { ink: true });
      k.line([[0.5, 0.35 + w * 2.1], [0.5 + k.rr(-0.05, 0.05), 0.35 + w * 3]], 0.008);
      k.line([[0.5 - w * 0.6, 0.35 + w * 0.8], [0.5, 0.35 + w * 0.5], [0.5 + w * 0.6, 0.35 + w * 0.8]], 0.005);
      k.face(0.5, 0.35 + w * 0.45, w * 0.45);
      void b;
    },
  },
  {
    id: 'crane',
    n: 'tower crane',
    bp: 'krabbe',
    make: (k) => {
      const h = k.rr(0.4, 0.55),
        tx = 0.4;
      k.rect(tx, G - h / 2, 0.04, h, 0, 0, 0, { ink: true });
      for (let i = 0; i < 6; i++) k.line([[tx - 0.02, G - (i * h) / 6], [tx + 0.02, G - ((i + 1) * h) / 6]], 0.004);
      const jl = k.rr(0.35, 0.45),
        jy = G - h;
      k.rect(tx + jl * 0.35, jy, jl * 1.3, 0.03, 0, 0, 1, { ink: true });
      const cab = k.rect(tx, jy + 0.045, 0.07, 0.05, 0, 0.2, 2, { ink: true });
      const hx = tx + jl * k.rr(0.5, 0.9),
        hl = k.rr(0.15, 0.3);
      k.line([[hx, jy], [hx, jy + hl]], 0.004);
      k.ring(hx + 0.01, jy + hl + 0.02, 0.02, 0.025, 0.008, -PI / 2, PI * 0.9, 8);
      if (k.chance(0.5)) k.rect(hx, jy + hl + 0.07, 0.07, 0.06, 0, 0.1, 2, { ink: true });
      k.rect(tx - jl * 0.3, jy + 0.02, 0.06, 0.05, 0, 0.1, 1);
      k.face(cab.x, cab.y, 0.03);
    },
  },
  {
    id: 'excavator',
    n: 'digger',
    bp: 'krabbe',
    make: (k) => {
      const tw = k.rr(0.2, 0.26);
      const track = k.rect(0.45, G - 0.04, tw, 0.07, 0, 0.5, 0, { ink: true });
      for (let i = 0; i < 4; i++) k.ring(0.45 - tw * 0.38 + (i * tw * 0.76) / 3, G - 0.04, 0.02, 0.02, 0.005);
      const cab = k.rect(0.45, G - 0.13, tw * 0.75, 0.11, 0, 0.15, 1, { ink: true });
      const a1 = -k.rr(0.6, 1.1),
        l1 = k.rr(0.18, 0.24),
        bx = 0.45 - tw * 0.3,
        by = G - 0.16;
      const ex = bx - cos(a1) * l1,
        ey = by + sin(a1) * l1;
      k.line([[bx, by], [ex, ey]], 0.018);
      const fx = ex - k.rr(0.02, 0.06),
        fy = ey + k.rr(0.1, 0.18);
      k.line([[ex, ey], [fx, fy]], 0.015);
      k.poly([[fx, fy], [fx - 0.06, fy - 0.01], [fx - 0.07, fy + 0.04], [fx - 0.01, fy + 0.05]], 2, { ink: true });
      k.face(cab.x, cab.y, 0.04);
      void track;
    },
  },

  /* ----- Kriechendes ----- */
  {
    id: 'croc',
    n: 'snapjaw',
    bp: 'kriecher',
    make: (k) => {
      const q = quad(k, { head: ['croc'], hs: [0.06, 0.08], bl: [0.18, 0.24], bh: [0.05, 0.07], leg: ['claw', 'stub'], ll: [0.03, 0.05], lw: [0.016, 0.022], neck: [0, 0.01], tail: ['fat'], poses: ['stand', 'walk', 'lie'] });
      for (let i = 0; i < k.ri(5, 9); i++) {
        const p = edge(q.body, -PI * (0.2 + 0.6 * (i / 8)), 0.95);
        k.tri([p[0] - 0.012, p[1] + 0.005], [p[0] + 0.012, p[1] + 0.005], [p[0], p[1] - 0.025], -1);
      }
      trimmings(k, q.hd, null);
    },
  },
  {
    id: 'armadillo',
    n: 'banded roller',
    bp: 'kriecher',
    make: (k) => {
      const q = quad(k, { head: ['mouse', 'pig', 'fox', 'round'], hs: [0.04, 0.06], bl: [0.15, 0.2], bh: [0.08, 0.11], leg: ['stub', 'claw'], ll: [0.02, 0.05], lw: [0.016, 0.022], neck: [0, 0.01], tail: ['fat', 'straight'], poses: ['stand', 'walk'] });
      const dome = k.lathe(q.body.x, q.body.y - q.H * 1.1, q.H * 1.6, q.L * 1.02, (t) => Math.sqrt(t), 8, 2, { ink: true });
      for (let i = 1; i < 6; i++) k.line([[dome.x - q.L + (i * q.L * 2) / 6, dome.y - dome.ry * 0.9], [dome.x - q.L + (i * q.L * 2) / 6, dome.y + dome.ry]], 0.005);
    },
  },
  {
    id: 'mole',
    n: 'digger mole',
    bp: 'kriecher',
    make: (k) => {
      const body = k.e(0.52, 0.62, k.rr(0.15, 0.2), k.rr(0.1, 0.13), k.rr(-0.1, 0.1), 0);
      head(k, pickHead(k, ['mouse', 'round', 'pig']), body.x - body.rx * 0.85, body.y - 0.01, k.rr(0.06, 0.08), -1, 2);
      for (const s of [-1, 1]) {
        const x = body.x - body.rx * 0.4 + s * 0.02,
          y = body.y + body.ry * 0.6;
        k.e(x - 0.04, y + 0.02, 0.045, 0.025, -0.3, s);
        for (let i = 0; i < 4; i++) k.line([[x - 0.07, y + 0.015 + i * 0.008], [x - 0.1, y + 0.01 + i * 0.012]], 0.004);
      }
      for (let i = 0; i < k.ri(3, 7); i++) k.c(0.5 + k.rr(-0.25, 0.25), G + 0.02 + k.rr(-0.02, 0.02), k.rr(0.015, 0.03), -2, { ink: true });
      if (k.chance(0.4)) k.ring(body.x - body.rx * 0.95, body.y - 0.04, 0.03, 0.03, 0.006);
    },
  },
  {
    id: 'bus',
    n: 'bus',
    bp: 'kriecher',
    make: (k) => {
      const L = k.rr(0.25, 0.32),
        H = k.rr(0.09, 0.12),
        wr = 0.045,
        cy = G - wr - H;
      const b = k.rect(0.5, cy, L * 2, H * 2, 0, 0.2, 0, { ink: true });
      const n = k.ri(3, 5);
      for (let i = 0; i < n; i++) {
        const x = 0.5 - L * 0.55 + (i * L * 1.4) / (n - 1);
        k.line([[x - 0.025, cy - H * 0.6], [x + 0.025, cy - H * 0.6], [x + 0.025, cy - H * 0.05], [x - 0.025, cy - H * 0.05], [x - 0.025, cy - H * 0.6]], 0.004);
      }
      for (const s of [-1, 1]) wheel(k, 0.5 + s * L * 0.62, G - wr, wr, 1);
      if (k.chance(0.5)) k.rect(0.5, cy - H - 0.02, L * 1.2, 0.03, 0, 0.3, -1);
      k.face(0.5 - L * 0.85, cy, H * 0.55);
      void b;
    },
  },
  {
    id: 'shoe',
    n: 'boot',
    bp: 'kriecher',
    make: (k) => {
      const kind = k.pick(['boot', 'sneaker', 'slipper']),
        L = k.rr(0.18, 0.24);
      if (kind === 'boot') {
        k.rect(0.56, G - 0.16, 0.12, 0.26, 0, 0.15, 0, { ink: true });
        k.e(0.46, G - 0.05, L * 0.75, 0.055, 0, 1, { ink: true });
      } else k.lathe(0.5, G - 0.11, 0.11, L, (t) => 0.6 + 0.4 * t, 4, 0, { ink: true });
      k.rect(0.5, G - 0.012, L * 2.05, 0.022, 0, 0.4, 2);
      if (kind === 'sneaker') for (let i = 0; i < 3; i++) k.line([[0.48 + i * 0.04, G - 0.1], [0.5 + i * 0.04, G - 0.07]], 0.005);
      if (kind === 'slipper') k.c(0.36, G - 0.08, 0.03, 2, { ink: true });
      k.face(kind === 'boot' ? 0.42 : 0.4, G - 0.06, 0.035);
    },
  },
  {
    id: 'seal',
    n: 'flipper',
    bp: 'kriecher',
    make: (k) => {
      const pts = curve(k.r, 0.35, 0.5, k.rr(0.4, 0.5), k.rr(0.3, 0.7), -k.rr(0.6, 1.2), 10);
      k.tube(pts, k.rr(0.08, 0.1), 0.03, 0, 8);
      const e = pts[pts.length - 1]!;
      k.e(e[0] + 0.03, e[1] - 0.01, 0.045, 0.015, -0.5, -1);
      k.e(e[0] + 0.03, e[1] + 0.015, 0.045, 0.015, 0.5, -1);
      k.e(0.42, 0.62, 0.05, 0.02, 0.6, 1);
      const hd = head(k, pickHead(k, ['round', 'dog', 'round', 'bear']), 0.32, 0.43, 0.07, -1, 2);
      for (const s of [-1, 1]) k.line([[hd.x - hd.r * 0.6, hd.y + hd.r * 0.3], [hd.x - hd.r * 1.4, hd.y + hd.r * 0.3 + s * 0.02]], 0.004);
      if (k.chance(0.4)) k.c(0.3, 0.3, 0.04, 3, { ink: true });
    },
  },

  /* ----- Fliegendes ----- */
  {
    id: 'butterfly',
    n: 'butterfly',
    bp: 'flatterer',
    w: 1.2,
    make: (k) => {
      const kind = k.pick(['butterfly', 'moth', 'dragonfly']) as 'butterfly' | 'moth' | 'dragonfly';
      const body = kind === 'dragonfly' ? k.e(0.5, 0.55, 0.025, 0.22, 0, 0) : k.e(0.5, 0.52, 0.035, k.rr(0.1, 0.15), 0, 0);
      const hd = head(k, pickHead(k, ['round', 'frog', 'chibi', 'cat']), 0.5, body.y - body.ry - 0.035, kind === 'moth' ? 0.05 : 0.04, 0, 2);
      wings(k, kind === 'butterfly' ? 'butterfly' : kind === 'moth' ? 'butterfly' : 'insect', 0.5, body.y - body.ry * 0.3, kind === 'moth' ? 0.24 : 0.22, false, -2, k.rr(-0.4, 0.8));
      for (const s of [-1, 1]) {
        const a = curve(k.r, hd.x + s * 0.01, hd.top, k.rr(0.06, 0.12), -PI / 2 + s * 0.5, s * 0.8, 5);
        k.line(a, 0.004);
        if (kind === 'moth') for (let j = 1; j < a.length; j++) k.line([a[j]!, [a[j]![0] + s * 0.012, a[j]![1] - 0.008]], 0.003);
        else k.c(a[a.length - 1]![0], a[a.length - 1]![1], 0.01, 3);
      }
    },
  },
  {
    id: 'bat',
    n: 'bat',
    bp: 'flatterer',
    make: (k) => {
      const R = k.rr(0.08, 0.12);
      const body = k.c(0.5, 0.5, R, 0);
      wings(k, 'bat', 0.5, 0.47, R * 1.6, false, -2, k.rr(-0.2, 0.9));
      head(k, pickHead(k, ['cat', 'fox', 'mouse', 'round']), 0.5, 0.5 - R * 0.9, R * 0.75, 0, 2);
      for (const s of [-1, 1]) k.line([[0.5 + s * R * 0.3, 0.5 + R * 0.9], [0.5 + s * R * 0.4, 0.5 + R * 1.4]], 0.006);
      if (k.chance(0.3)) k.line([[0.5, 0.5 + R * 1.4], [0.5, 0.06]], 0.003);
      void body;
    },
  },
  {
    id: 'ufo',
    n: 'saucer',
    bp: 'flatterer',
    make: (k) => {
      const w = k.rr(0.22, 0.3);
      const disc = k.e(0.5, 0.48, w, w * 0.22, 0, 0, { ink: true });
      const dome = k.lathe(0.5, 0.48 - w * 0.55, w * 0.45, w * 0.45, (t) => Math.sqrt(t), 6, 1, { ink: true, wing: true });
      for (let i = 0; i < 5; i++) k.c(0.5 - w * 0.7 + (i * w * 1.4) / 4, 0.48 + w * 0.08, 0.012, 2, { ink: true });
      if (k.chance(0.6)) k.poly([[0.5 - w * 0.25, 0.48 + w * 0.2], [0.5 + w * 0.25, 0.48 + w * 0.2], [0.5 + w * 0.6, G], [0.5 - w * 0.6, G]], -2, { wing: true, crisp: 0.2 });
      if (k.chance(0.5)) head(k, pickHead(k, ['chibi', 'round', 'frog', 'cat']), 0.5, dome.y + 0.01, w * 0.22, 0, 2);
      else k.face(0.5, disc.y - w * 0.02, w * 0.18);
    },
  },
  {
    id: 'fairy',
    n: 'winged sprite',
    bp: 'flatterer',
    make: (k) => {
      const b = biped(k, { head: ['chibi', 'round', 'cat', 'bunny'], hs: [0.06, 0.09], body: ['bell', 'pear', 'egg'], bw: [0.06, 0.09], bh: [0.08, 0.12], arms: ['line'], legs: ['thin', 'none'], ll: [0.04, 0.08] });
      wings(k, k.pick(['butterfly', 'insect', 'angel'] as const), 0.5, b.body.y - b.body.ry * 0.5, 0.2, false, -2, k.rr(0, 1));
      if (k.chance(0.5)) {
        k.line([[0.6, b.body.y], [0.7, b.body.y - 0.12]], 0.005);
        k.star(0.7, b.body.y - 0.14, 0.012, 0.03, 5, 0, 3);
      }
    },
  },
  {
    id: 'pterosaur',
    n: 'sky lizard',
    bp: 'flatterer',
    make: (k) => {
      const body = k.e(0.5, 0.5, 0.07, 0.05, 0, 0);
      wings(k, 'bat', 0.5, 0.48, 0.24, false, -2, k.rr(-0.3, 0.5));
      const hd = head(k, pickHead(k, ['bird', 'croc', 'dragon']), 0.42, 0.42, 0.045, -1, 2);
      k.tri([hd.x + 0.01, hd.y - 0.03], [hd.x + 0.04, hd.y - 0.01], [hd.x + 0.12, hd.y - 0.08], 1);
      k.tri([hd.x - 0.03, hd.y], [hd.x - 0.03, hd.y + 0.025], [hd.x - 0.15, hd.y + 0.02], 3, { ink: true });
      void body;
    },
  },
  {
    id: 'flyfish',
    n: 'flying fish',
    bp: 'flatterer',
    make: (k) => {
      const L = k.rr(0.14, 0.2);
      const body = k.e(0.5, 0.5, L, L * 0.35, k.rr(-0.3, 0), 0);
      tail(k, 'fish', 0.5 + L * 0.85, 0.5, 1, L * 0.4, -1);
      wings(k, k.pick(['insect', 'feather'] as const), 0.48, 0.48, L * 1.2, true, 2, k.rr(0.2, 1.2));
      for (let i = 0; i < 3; i++) k.line(curve(k.r, 0.25 + i * 0.25, G, 0.15, 0, k.rr(-0.5, 0.5), 5, 0.4), 0.005);
      k.face(0.5 - L * 0.6, 0.5 - L * 0.05, L * 0.28);
      void body;
    },
  },

  /* ----- Hüpfendes ----- */
  {
    id: 'bunny',
    n: 'rabbit',
    bp: 'huepfer',
    w: 1.3,
    make: (k) => {
      const q = quad(k, { head: ['bunny'], hs: [0.06, 0.08], bl: [0.11, 0.15], bh: [0.08, 0.11], leg: ['stub', 'paw'], ll: [0.02, 0.05], lw: [0.018, 0.024], neck: [0, 0.02], tail: ['stub'], poses: ['sit', 'sit', 'stand', 'lie', 'rear'] });
      trimmings(k, q.hd, q.body);
    },
  },
  {
    id: 'frog',
    n: 'frog',
    bp: 'huepfer',
    w: 1.2,
    make: (k) => {
      const w = k.rr(0.15, 0.22),
        h = w * k.rr(0.55, 0.8);
      const body = k.e(0.5, G - h * 1.1, w, h, 0, 0);
      for (const s of [-1, 1]) {
        k.e(0.5 + s * w * 0.85, G - h * 0.5, w * 0.45, h * 0.45, s * 0.5, 1);
        k.e(0.5 + s * w * 1.15, G - 0.015, w * 0.35, 0.02, 0, 2);
        k.line([[0.5 + s * w * 0.35, G - h * 0.6], [0.5 + s * w * 0.4, G - 0.01]], 0.012);
      }
      head(k, pickHead(k, ['frog', 'frog', 'round', 'croc']), 0.5, body.y - h * 0.7, w * 0.6, 0, 3);
      if (k.chance(0.35)) k.tube(curve(k.r, 0.5, body.y - h * 0.5, k.rr(0.1, 0.25), -k.rr(0.2, 1.2), k.rr(-1, 1), 6), 0.012, 0.012, 4, 5);
      trimmings(k, null, body);
    },
  },
  {
    id: 'grasshopper',
    n: 'leaper',
    bp: 'huepfer',
    make: (k) => {
      const body = k.e(0.55, 0.56, k.rr(0.16, 0.22), k.rr(0.05, 0.07), k.rr(-0.15, 0.05), 0);
      const hd = head(k, pickHead(k, ['round', 'frog', 'horse', 'robot']), body.x - body.rx - 0.02, body.y - 0.02, 0.055, -1, 2);
      const th = k.e(body.x + body.rx * 0.15, body.y - body.ry * 0.6, k.rr(0.1, 0.14), 0.03, -0.35, 1);
      const kx = th.x + cos(-0.35) * th.rx,
        ky = th.y + sin(-0.35) * th.rx;
      k.line([[kx, ky], [kx - 0.03, body.y + 0.14]], 0.009);
      for (let i = 0; i < 2; i++) leg(k, 'jointed', body.x - body.rx * 0.6 + i * 0.06, body.y + body.ry * 0.5, k.rr(0.07, 0.1), 0.008, k.rr(-0.4, 0.1), -1);
      for (const s of [-1, 1]) k.line(curve(k.r, hd.x - hd.r * 0.3, hd.y - hd.r, k.rr(0.15, 0.3), -2 + s * 0.2, k.rr(0.4, 1.6), 8), 0.004);
      if (k.chance(0.5)) wings(k, 'insect', body.x, body.y - body.ry * 0.5, body.rx * 0.8, true, 3, -0.2);
    },
  },
  {
    id: 'spring',
    n: 'spring hopper',
    bp: 'huepfer',
    make: (k) => {
      const R = k.rr(0.12, 0.17),
        top = 0.42 + R * 0.9,
        h = k.rr(0.18, 0.28),
        n = k.ri(4, 7),
        pts: Pt[] = [];
      for (let i = 0; i <= n * 2; i++) pts.push([0.5 + (i % 2 ? 1 : -1) * (i === 0 || i === n * 2 ? 0 : 0.035), top + (h * i) / (n * 2)]);
      k.line(pts, 0.008);
      k.e(0.5, top + h + 0.015, k.rr(0.05, 0.07), 0.02, 0, 1);
      const hd = head(k, pickHead(k, ['round', 'cat', 'robot', 'chibi', 'bear', 'frog', 'tv']), 0.5, 0.42, R, 0, 2);
      trimmings(k, hd, null);
    },
  },
  {
    id: 'jackbox',
    n: 'jack-in-the-box',
    bp: 'huepfer',
    make: (k) => {
      const w = k.rr(0.12, 0.16);
      const box = k.rect(0.5, G - w, w * 2, w * 2, 0, 0.06, 0, { ink: true });
      k.poly([[0.5 - w, G - w * 2], [0.5 - w * 1.6, G - w * 2.7], [0.5 - w * 1.5, G - w * 2.85], [0.5 - w * 0.9, G - w * 2.1]], -1, { ink: true });
      k.c(0.5 + w * 0.8, G - w, w * 0.12, 1, { ink: true });
      k.line([[0.5 + w * 0.8, G - w], [0.5 + w * 1.3, G - w * 1.2]], 0.008);
      const pts: Pt[] = [];
      for (let i = 0; i <= 8; i++) pts.push([0.5 + (i % 2 ? 0.03 : -0.03), G - w * 2 - (i * 0.12) / 8]);
      k.line(pts, 0.007);
      head(k, pickHead(k, ['chibi', 'round', 'cat', 'skull', 'pumpkin']), 0.5, G - w * 2 - 0.18, k.rr(0.06, 0.08), 0, 2);
      void box;
    },
  },
  {
    id: 'pogo',
    n: 'pogo rider',
    bp: 'huepfer',
    make: (k) => {
      k.line([[0.5, 0.35], [0.5, G]], 0.012);
      k.line([[0.42, 0.4], [0.58, 0.4]], 0.01);
      const pts: Pt[] = [];
      for (let i = 0; i <= 8; i++) pts.push([0.5 + (i % 2 ? 0.02 : -0.02), G - 0.15 + (i * 0.12) / 8]);
      k.line(pts, 0.006);
      k.rect(0.5, G - 0.2, 0.12, 0.02, 0, 0.3, 1);
      const b = k.e(0.5, 0.52, k.rr(0.06, 0.09), k.rr(0.08, 0.11), 0, 2);
      head(k, pickHead(k, ['round', 'cat', 'bunny', 'chibi', 'robot', 'mouse']), 0.5, b.y - b.ry - 0.05, k.rr(0.05, 0.07), 0, 3);
      for (const s of [-1, 1]) k.line([[0.5 + s * b.rx * 0.8, b.y - b.ry * 0.3], [0.5 + s * 0.08, 0.4]], 0.007);
      for (const s of [-1, 1]) k.line([[0.5 + s * b.rx * 0.5, b.y + b.ry * 0.8], [0.5 + s * 0.06, G - 0.2]], 0.007);
    },
  },
  {
    id: 'ball',
    n: 'bouncer',
    bp: 'huepfer',
    make: (k) => {
      const R = k.rr(0.13, 0.19),
        bounce = k.rr(0.05, 0.25);
      const b = k.c(0.5, G - R - bounce, R, 0, { ink: true });
      const kind = k.pick(['stripes', 'star', 'plain', 'patches']);
      if (kind === 'stripes') for (const a of [-0.6, 0.6]) k.ring(0.5, b.y, R * 0.98, R * 0.35, 0.005, 0 + a, PI + a, 10);
      else if (kind === 'star') k.star(0.5, b.y + R * 0.4, R * 0.12, R * 0.28, 5, 0, 1);
      else if (kind === 'patches') for (let i = 0; i < 4; i++) k.c(...edge(b, k.rr(0, 6.28), 0.55), R * 0.18, 1, { ink: true });
      if (bounce > 0.1) for (let i = 0; i < 3; i++) k.line([[0.5 - R * 0.6 + i * R * 0.6, b.y + R + 0.02], [0.5 - R * 0.6 + i * R * 0.6, b.y + R + 0.06]], 0.005);
      k.e(0.5, G, R * 0.6, 0.012, 0, -2, { wing: true });
      k.face(0.5, b.y - R * 0.1, R * 0.65);
    },
  },
];
