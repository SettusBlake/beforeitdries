/*
 * Formen der Generation 2 (Plan vom 30.10.2026, docs/entwuerfe/einzigartig-und-stile-plan.md).
 * Jeder Bauplan hat fünf Grundformen. Dazu kommen 0 bis 3 Anbauteile, Spiegeln, Strecken und Neigen.
 * Eigener Zufallsstrom: Generation 1 (BP[...].build) bleibt unberührt.
 * Ausgabe ist dieselbe Geometrie wie bei Generation 1, der Renderer malt sie unverändert.
 */
import type { BlobShape, BlueprintId, FaceSpot, Geometry, Limb, Pt } from './data';
import { lerp, pick, ri, rr, weighted, type Rand } from './rng';

type B = BlobShape;
type View = 'side' | 'front';
export type PartKind = 'horns' | 'ears' | 'antennae' | 'tuft' | 'mane' | 'crest' | 'tail' | 'fins' | 'wings' | 'bumps' | 'arms';
/** Grundform: Kopf links bei Seitenansicht, Mitte bei Vorderansicht */
type Core = { blobs: B[]; limbs: Limb[]; faces: FaceSpot[]; head: B; body: B; view: View; parts: PartKind[] };
type Variant = { id: string; build: (r: Rand) => Core };
export type Shape2 = Geometry & { variant: string; parts: PartKind[]; headParts: boolean };

const E = (x: number, y: number, rx: number, ry: number, rot = 0, f: Partial<B> = {}): B => ({ x, y, rx, ry, rot, ...f });
const C = (x: number, y: number, rad: number, f: Partial<B> = {}): B => E(x, y, rad, rad, 0, f);
const L = (pts: Pt[], w: number): Limb => ({ pts, w });
const S2 = [-1, 1] as const;
const face = (b: B, k = 1, dy = 0, f: Partial<FaceSpot> = {}): FaceSpot => ({ x: b.x, y: b.y + dy, r: Math.min(b.rx, b.ry) * k, ...f });

/** Linienzug mit Richtung ang (0 rechts, π/2 unten), der sich um bend dreht, wob wackelt */
function curve(r: Rand, x: number, y: number, len: number, ang: number, bend: number, n = 8, wob = 0): Pt[] {
  const pts: Pt[] = [[x, y]],
    step = len / n,
    ph = rr(r, 0, 6.28);
  let a = ang;
  for (let i = 1; i <= n; i++) {
    a += (bend / n) * (0.5 + i / n) + Math.sin(ph + i * 1.7) * wob;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    pts.push([x, y]);
  }
  return pts;
}
/** Kleckse entlang eines Linienzugs, Radius von r0 nach r1, gedreht in Laufrichtung */
function chain(pts: Pt[], r0: number, r1: number, sq = 1): B[] {
  return pts.map((p, i) => {
    const t = pts.length > 1 ? i / (pts.length - 1) : 0,
      q = pts[Math.min(pts.length - 1, i + 1)]!,
      o = pts[Math.max(0, i - 1)]!,
      rad = lerp(r0, r1, t);
    return E(p[0], p[1], rad, rad * sq, Math.atan2(q[1] - o[1], q[0] - o[0]));
  });
}
/** Geschlossener Schlauch entlang eines Linienzugs: Kleckse so dicht, dass keine Lücken bleiben (höchstens max) */
function tube(pts: Pt[], r0: number, r1: number, sq = 1, max = 14): B[] {
  const seg: number[] = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const total = seg[seg.length - 1]!;
  const at = (d: number): Pt => {
    let i = 1;
    while (i < seg.length - 1 && seg[i]! < d) i++;
    const t = (d - seg[i - 1]!) / Math.max(1e-9, seg[i]! - seg[i - 1]!),
      a = pts[i - 1]!,
      b = pts[i]!;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  // Abstand je Klecks etwa 1,3 Radien, bei zu vielen Klecksen weiter
  let gap = 1.3,
    n = 0;
  for (;;) {
    n = 0;
    for (let d = 0; d <= total; d += Math.max(0.004, lerp(r0, r1, d / Math.max(total, 1e-9)) * gap)) n++;
    if (n <= max) break;
    gap *= 1.15;
  }
  const out: Pt[] = [];
  for (let d = 0; d <= total; d += Math.max(0.004, lerp(r0, r1, d / Math.max(total, 1e-9)) * gap)) out.push(at(d));
  if (out.length > 1) out[out.length - 1] = pts[pts.length - 1]!;
  return chain(out, r0, r1, sq);
}
/** Punkt auf dem Rand einer Ellipse, Winkel a in der Ellipse */
function edge(b: B, a: number, k = 1): Pt {
  const c = Math.cos(b.rot),
    s = Math.sin(b.rot),
    ex = Math.cos(a) * b.rx * k,
    ey = Math.sin(a) * b.ry * k;
  return [b.x + ex * c - ey * s, b.y + ex * s + ey * c];
}
/** Bein mit Knie: Hüfte, Knie (angehoben um knee), Fuß */
const leg = (hx: number, hy: number, len: number, dx: number, knee: number, w: number): Limb =>
  L(
    [
      [hx, hy],
      [hx + dx * len * 0.55, hy + len * 0.45 - knee],
      [hx + dx * len * 0.8, hy + len],
    ],
    w,
  );
/** Schere: zwei Backen als V */
function claw(x: number, y: number, size: number, ang: number): B[] {
  return [E(x + Math.cos(ang - 0.35) * size * 0.6, y + Math.sin(ang - 0.35) * size * 0.6, size, size * 0.45, ang - 0.35), E(x + Math.cos(ang + 0.45) * size * 0.5, y + Math.sin(ang + 0.45) * size * 0.5, size * 0.8, size * 0.35, ang + 0.45)];
}

/* ===================== Grundformen je Bauplan ===================== */
const V: Record<BlueprintId, Variant[]> = {
  kriecher: [
    {
      id: 'caterpillar',
      build(r) {
        const len = rr(r, 0.42, 0.62),
          amp = rr(r, 0, 0.045),
          ph = rr(r, 0, 6.28),
          rad = rr(r, 0.05, 0.075),
          n = Math.max(4, Math.min(10, Math.round(len / (rad * rr(r, 1.5, 2.1)) + 1))),
          hb = rr(r, 1.05, 1.5),
          tail = rr(r, 0.55, 1);
        const segs: B[] = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1),
            rs = rad * rr(r, 0.88, 1.12) * (i === 0 ? hb : lerp(1, tail, t));
          segs.push(E(0.5 - len / 2 + len * t, 0.6 + Math.sin(ph + t * 6) * amp, rs * rr(r, 1, 1.15), rs));
        }
        const head = segs[0]!;
        head.y -= head.ry * rr(r, 0.2, 0.7);
        const limbs: Limb[] = [];
        for (const s of segs.slice(1)) if (r() < 0.8) limbs.push(L([[s.x, s.y + s.ry * 0.7], [s.x + rr(r, -0.015, 0.01), s.y + s.ry + rr(r, 0.025, 0.05)]], 0.011));
        return { blobs: segs.slice().reverse(), limbs, faces: [face(head)], head, body: segs[n >> 1]!, view: 'side', parts: ['horns', 'antennae', 'ears', 'tuft'] };
      },
    },
    {
      id: 'snail',
      build(r) {
        const body = E(0.53, 0.64, rr(r, 0.2, 0.3), rr(r, 0.055, 0.085), rr(r, -0.04, 0.04));
        const hr = rr(r, 0.055, 0.085);
        const head = C(body.x - body.rx * 0.8, body.y - body.ry * rr(r, 0.5, 1.4), hr);
        const blobs = [E(body.x + body.rx * 0.05, body.y + body.ry * 0.55, body.rx * 1.05, body.ry * 0.4), body];
        if (r() < 0.65) {
          const sr = rr(r, 0.09, 0.15),
            sx = body.x + body.rx * rr(r, 0, 0.35),
            sy = body.y - body.ry - sr * rr(r, 0.4, 0.8);
          blobs.push(C(sx, sy, sr), C(sx + sr * 0.18, sy - sr * 0.12, sr * 0.62), C(sx + sr * 0.26, sy - sr * 0.18, sr * 0.3));
        }
        blobs.push(head);
        return { blobs, limbs: [], faces: [face(head, 1, 0, { stalks: r() < 0.55 })], head, body, view: 'side', parts: ['horns', 'crest', 'bumps', 'tail'] };
      },
    },
    {
      id: 'centipede',
      build(r) {
        const n = ri(r, 6, 10),
          len = rr(r, 0.55, 0.72),
          amp = rr(r, 0.02, 0.07),
          ph = rr(r, 0, 6.28),
          rad = rr(r, 0.032, 0.048);
        const segs: B[] = [],
          limbs: Limb[] = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1),
            x = 0.5 - len / 2 + len * t,
            y = 0.58 + Math.sin(ph + t * 7) * amp,
            rs = rad * (i === 0 ? 1.4 : lerp(1.05, 0.7, t));
          segs.push(E(x, y, rs * 1.25, rs));
          if (i > 0) for (const s of S2) limbs.push(leg(x, y, rr(r, 0.07, 0.12), s * 0.35, rr(r, 0.02, 0.05), 0.0075));
        }
        const head = segs[0]!;
        for (const s of S2) limbs.push(L(curve(r, head.x - head.rx * 0.4, head.y - head.ry * 0.6, rr(r, 0.1, 0.17), -2.2 + s * 0.35, rr(r, -0.9, 0.9)), 0.007));
        return { blobs: segs.slice().reverse(), limbs, faces: [face(head, 1.1)], head, body: segs[n >> 1]!, view: 'side', parts: ['horns', 'tail', 'tuft'] };
      },
    },
    {
      id: 'beetle',
      build(r) {
        const body = E(0.56, 0.57, rr(r, 0.17, 0.26), rr(r, 0.1, 0.16), rr(r, -0.08, 0.04));
        const hr = rr(r, 0.06, 0.1);
        const head = E(body.x - body.rx * 0.95, body.y + body.ry * rr(r, -0.3, 0.25), hr * 1.1, hr);
        const limbs: Limb[] = [],
          nl = ri(r, 2, 4);
        for (let k = 0; k < nl; k++) {
          const x = body.x - body.rx * 0.5 + (body.rx * 1.1 * k) / (nl - 1);
          limbs.push(leg(x, body.y + body.ry * 0.5, rr(r, 0.09, 0.16), rr(r, -0.45, 0.45), rr(r, 0.01, 0.05), 0.011));
        }
        const blobs = [body];
        if (r() < 0.5) blobs.push(E(body.x - body.rx * 0.6, body.y - body.ry * 0.05, body.rx * 0.42, body.ry * 0.85));
        blobs.push(head);
        return { blobs, limbs, faces: [face(head)], head, body, view: 'side', parts: ['horns', 'antennae', 'crest', 'bumps', 'tail', 'wings'] };
      },
    },
    {
      id: 'inchworm',
      build(r) {
        const w = rr(r, 0.3, 0.46),
          h = rr(r, 0.12, 0.26),
          rad = rr(r, 0.04, 0.058),
          n = Math.min(12, Math.round((w + h * 1.4) / (rad * 1.5)) + 1);
        const segs: B[] = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          segs.push(C(0.5 - w / 2 + w * t, 0.72 - Math.sin(t * Math.PI) * h, rad * (i === 0 ? rr(r, 1.3, 1.7) : rr(r, 0.9, 1.1))));
        }
        const head = segs[0]!;
        head.y -= rad * rr(r, 0.3, 1.2);
        const limbs: Limb[] = [];
        for (const s of [segs[1]!, segs[n - 1]!, segs[n - 2]!]) limbs.push(L([[s.x, s.y + s.ry * 0.6], [s.x, s.y + s.ry + 0.035]], 0.01));
        return { blobs: segs.slice().reverse(), limbs, faces: [face(head)], head, body: segs[n >> 1]!, view: 'side', parts: ['horns', 'antennae', 'ears', 'tuft'] };
      },
    },
  ],
  flatterer: [
    {
      id: 'butterfly',
      build(r) {
        const body = E(0.5, 0.56, rr(r, 0.035, 0.055), rr(r, 0.12, 0.18));
        const hr = rr(r, 0.045, 0.07),
          head = C(0.5, body.y - body.ry - hr * 0.5, hr);
        const wrx = rr(r, 0.14, 0.22),
          wry = rr(r, 0.1, 0.16),
          wr = rr(r, 0.2, 0.7),
          lo = rr(r, 0.5, 0.85);
        const blobs: B[] = [];
        for (const s of S2) blobs.push(E(0.5 + s * (body.rx + wrx * 0.75), body.y - body.ry * 0.35, wrx, wry, -s * wr, { wing: true }));
        for (const s of S2) blobs.push(E(0.5 + s * (body.rx + wrx * lo * 0.7), body.y + body.ry * 0.4, wrx * lo, wry * lo * 1.1, s * rr(r, 0.2, 0.7), { wing: true }));
        if (r() < 0.4) for (const s of S2) blobs.push(E(0.5 + s * wrx * 0.7, body.y + body.ry + 0.05, 0.02, rr(r, 0.06, 0.1), s * 0.35, { wing: true }));
        blobs.push(body, head);
        const limbs = S2.map((s) => L(curve(r, 0.5 + s * hr * 0.3, head.y - hr * 0.7, rr(r, 0.08, 0.14), -Math.PI / 2 + s * 0.4, s * rr(r, -0.5, 1.4)), 0.007));
        return { blobs, limbs, faces: [face(head)], head, body, view: 'front', parts: ['tuft', 'horns'] };
      },
    },
    {
      id: 'bat',
      build(r) {
        const R = rr(r, 0.09, 0.14),
          body = C(0.5, 0.55, R);
        const blobs: B[] = [],
          limbs: Limb[] = [],
          lobes = ri(r, 2, 4),
          lift = rr(r, -0.06, 0.04);
        for (const s of S2)
          for (let k = 0; k < lobes; k++) {
            const x = 0.5 + s * (R * 0.8 + 0.06 + k * 0.07),
              y = 0.5 - k * lift - 0.02 * k;
            blobs.push(E(x, y, rr(r, 0.065, 0.09), rr(r, 0.045, 0.075), s * (0.15 + 0.22 * k), { wing: true }));
            limbs.push(L([[0.5 + s * R * 0.7, 0.5], [x + s * 0.05, y - 0.03]], 0.007));
          }
        for (const s of S2) limbs.push(L([[0.5 + s * R * 0.35, body.y + R * 0.9], [0.5 + s * R * 0.4, body.y + R + 0.05]], 0.01));
        blobs.push(body);
        return { blobs, limbs, faces: [face(body, 0.85)], head: body, body, view: 'front', parts: ['ears', 'horns', 'tuft', 'tail', 'bumps'] };
      },
    },
    {
      id: 'bird',
      build(r) {
        const body = E(0.5, 0.58, rr(r, 0.11, 0.16), rr(r, 0.13, 0.19));
        const merged = r() < 0.35,
          hr = rr(r, 0.07, 0.105);
        const head = merged ? body : C(0.5 + rr(r, -0.03, 0.03), body.y - body.ry * 0.85 - hr * 0.45, hr);
        const up = r() < 0.5;
        const W = S2.map((s) =>
          up
            ? E(0.5 + s * (body.rx + 0.045), body.y - body.ry * 0.45, rr(r, 0.045, 0.07), rr(r, 0.13, 0.2), s * rr(r, 0.4, 0.85), { wing: true })
            : E(0.5 + s * (body.rx + rr(r, 0.08, 0.13)), body.y - body.ry * 0.15, rr(r, 0.11, 0.17), rr(r, 0.045, 0.07), -s * rr(r, 0.1, 0.45), { wing: true }),
        );
        const tail = [-1, 0, 1].map((k) => E(0.5 + k * 0.035, body.y + body.ry + 0.04, 0.025, rr(r, 0.05, 0.09), k * 0.35));
        const limbs = S2.map((s) => L([[0.5 + s * body.rx * 0.35, body.y + body.ry * 0.9], [0.5 + s * body.rx * 0.45, body.y + body.ry + 0.06]], 0.009));
        return {
          blobs: [...tail, ...W, body, ...(merged ? [] : [head])],
          limbs,
          faces: [merged ? face(body, 0.75, -body.ry * 0.35) : face(head)],
          head,
          body,
          view: 'front',
          parts: ['tuft', 'horns', 'ears', 'crest'],
        };
      },
    },
    {
      id: 'moth',
      build(r) {
        const rad = rr(r, 0.05, 0.075);
        const segs = [C(0.5, 0.42, rad * 1.05), C(0.5, 0.42 + rad * 1.5, rad * 1.15), C(0.5, 0.42 + rad * 2.9, rad * 0.9)];
        const wrx = rr(r, 0.15, 0.22),
          wry = rr(r, 0.08, 0.13),
          droop = rr(r, -0.15, 0.4);
        const blobs: B[] = [];
        for (const s of S2) blobs.push(E(0.5 + s * (wrx * 0.85 + rad * 0.5), 0.47, wrx, wry, s * droop, { wing: true }));
        if (r() < 0.6) for (const s of S2) blobs.push(E(0.5 + s * wrx * 0.55, 0.47 + wry * 1.2, wrx * 0.6, wry * 0.8, s * rr(r, 0.3, 0.8), { wing: true }));
        blobs.push(...segs.slice().reverse());
        const head = segs[0]!,
          limbs: Limb[] = [];
        for (const s of S2) {
          const a = curve(r, 0.5 + s * rad * 0.3, head.y - rad * 0.8, rr(r, 0.08, 0.13), -Math.PI / 2 + s * 0.55, s * 0.6, 6);
          limbs.push(L(a, 0.006));
          for (let k = 2; k < a.length; k += 2) limbs.push(L([a[k]!, [a[k]![0] + s * 0.02, a[k]![1] - 0.01]], 0.004));
        }
        return { blobs, limbs, faces: [face(head)], head, body: segs[1]!, view: 'front', parts: ['tuft', 'bumps'] };
      },
    },
    {
      id: 'dragonfly',
      build(r) {
        const hr = rr(r, 0.055, 0.075),
          head = C(0.5, 0.3, hr),
          thorax = E(0.5, 0.3 + hr + 0.045, 0.045, 0.06);
        const n = 12,
          bend = rr(r, -0.12, 0.12),
          ab: Pt[] = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          ab.push([0.5 + Math.sin(t * 1.6) * bend, thorax.y + 0.07 + t * rr(r, 0.32, 0.4)]);
        }
        const blobs: B[] = [];
        const wrx = rr(r, 0.14, 0.2);
        for (let k = 0; k < 2; k++) for (const s of S2) blobs.push(E(0.5 + s * (0.04 + wrx), thorax.y - 0.02 + k * 0.055, wrx, rr(r, 0.028, 0.045), s * (k ? 0.12 : -0.12) + rr(r, -0.08, 0.08), { wing: true }));
        blobs.push(...tube(ab, 0.032, 0.02, 1, 7).reverse(), thorax, head);
        const limbs = S2.map((s) => L([[0.5 + s * 0.03, thorax.y + 0.04], [0.5 + s * 0.06, thorax.y + 0.08]], 0.006));
        return { blobs, limbs, faces: [face(head)], head, body: thorax, view: 'front', parts: ['antennae', 'horns'] };
      },
    },
  ],
  schwebeblase: [
    {
      id: 'bubble',
      build(r) {
        const R = rr(r, 0.15, 0.24),
          body = E(0.5, 0.42, R, R * rr(r, 0.82, 1.08));
        const limbs: Limb[] = [],
          n = ri(r, 0, 6);
        for (let i = 0; i < n; i++) {
          const x = 0.5 - R * 0.65 + (R * 1.3 * i) / Math.max(1, n - 1);
          limbs.push(L(curve(r, x, body.y + body.ry * 0.85, rr(r, 0.12, 0.32), Math.PI / 2, rr(r, -0.8, 0.8), 8, 0.25), rr(r, 0.008, 0.014)));
        }
        return { blobs: [body], limbs, faces: [face(body, 0.8)], head: body, body, view: 'front', parts: ['horns', 'ears', 'antennae', 'tuft', 'bumps', 'fins', 'wings', 'arms'] };
      },
    },
    {
      id: 'cluster',
      build(r) {
        const R = rr(r, 0.12, 0.16),
          main = C(0.5, 0.5, R);
        const n = ri(r, 2, 5),
          blobs: B[] = [],
          a0 = rr(r, 0, 6.28);
        for (let i = 0; i < n; i++) {
          const a = a0 + (i / n) * Math.PI * 2 + rr(r, -0.3, 0.3),
            rad = rr(r, 0.045, 0.11);
          blobs.push(C(0.5 + Math.cos(a) * (R + rad * 0.6), 0.5 + Math.sin(a) * (R + rad * 0.6), rad));
        }
        blobs.push(main);
        const limbs = r() < 0.5 ? [L(curve(r, 0.5, 0.5 + R, rr(r, 0.15, 0.25), Math.PI / 2, rr(r, -1, 1), 8, 0.2), 0.008)] : [];
        return { blobs, limbs, faces: [face(main, 0.85)], head: main, body: main, view: 'front', parts: ['horns', 'antennae', 'tuft', 'arms'] };
      },
    },
    {
      id: 'cloud',
      build(r) {
        const n = ri(r, 4, 7),
          w = rr(r, 0.3, 0.44),
          blobs: B[] = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1),
            rad = rr(r, 0.06, 0.09) + Math.sin(t * Math.PI) * rr(r, 0.02, 0.05);
          blobs.push(C(0.5 - w / 2 + w * t, 0.5 - Math.sin(t * Math.PI) * rr(r, 0.03, 0.08), rad));
        }
        const main = E(0.5, 0.52, w * 0.5, rr(r, 0.06, 0.09));
        blobs.push(main);
        const drops = ri(r, 0, 4),
          under: B[] = [];
        for (let i = 0; i < drops; i++) under.push(E(0.5 + rr(r, -w * 0.4, w * 0.4), main.y + main.ry + rr(r, 0.05, 0.14), 0.016, rr(r, 0.025, 0.035)));
        return { blobs: [...blobs, ...under], limbs: [], faces: [face(main, 1.2, -0.02)], head: main, body: main, view: 'front', parts: ['horns', 'ears', 'arms', 'tuft'] };
      },
    },
    {
      id: 'drip',
      build(r) {
        const R = rr(r, 0.14, 0.2),
          body = E(0.5, 0.42, R * rr(r, 0.95, 1.15), R);
        const n = ri(r, 2, 6),
          drips: B[] = [];
        for (let i = 0; i < n; i++) {
          const a = Math.PI * (0.15 + (0.7 * (i + rr(r, 0.1, 0.9))) / n),
            p = edge(body, a, 0.9),
            len = rr(r, 0.04, 0.12);
          drips.push(E(p[0], p[1] + len * 0.6, rr(r, 0.018, 0.032), len));
          if (r() < 0.5) drips.push(C(p[0], p[1] + len * 1.7 + 0.02, rr(r, 0.012, 0.02)));
        }
        return { blobs: [...drips, body], limbs: [], faces: [face(body, 0.8)], head: body, body, view: 'front', parts: ['horns', 'antennae', 'tuft', 'ears', 'mane'] };
      },
    },
    {
      id: 'lantern',
      build(r) {
        const body = E(0.5, 0.48, rr(r, 0.1, 0.14), rr(r, 0.17, 0.23));
        const knob = C(0.5, body.y - body.ry - 0.02, rr(r, 0.025, 0.04));
        const limbs = [L([[0.5, knob.y], [0.5 + rr(r, -0.03, 0.03), knob.y - rr(r, 0.04, 0.08)]], 0.009), L(curve(r, 0.5, body.y + body.ry * 0.95, rr(r, 0.12, 0.25), Math.PI / 2, rr(r, -2, 2), 10, 0.2), 0.011)];
        const fins = r() < 0.5 ? S2.map((s) => E(0.5 + s * body.rx * 1.05, body.y + body.ry * 0.3, 0.05, 0.022, s * 0.6, { wing: true })) : [];
        return { blobs: [...fins, knob, body], limbs, faces: [face(body, 0.95)], head: body, body, view: 'front', parts: ['ears', 'arms', 'bumps', 'wings'] };
      },
    },
  ],
  vierbeiner: [
    {
      id: 'hound',
      build(r) {
        const body = E(0.56, 0.55, rr(r, 0.15, 0.25), rr(r, 0.08, 0.13), rr(r, -0.08, 0.08));
        const hr = rr(r, 0.065, 0.12),
          nl = rr(r, 0.01, 0.1);
        const head = E(body.x - body.rx - hr * 0.15, body.y - body.ry - nl - hr * 0.2, hr * rr(r, 1, 1.25), hr);
        const neck = E((body.x - body.rx * 0.75 + head.x) / 2, (body.y - body.ry * 0.3 + head.y) / 2, hr * 0.5, (nl + hr) * 0.6, 0.5);
        const blobs: B[] = [body, neck, head];
        if (r() < 0.5) blobs.push(E(head.x - head.rx * 0.9, head.y + head.ry * 0.3, head.rx * 0.45, head.ry * 0.35));
        const limbs: Limb[] = [],
          ll = rr(r, 0.06, 0.15),
          blobLegs = r() < 0.5;
        for (const f of [-0.7, -0.3, 0.35, 0.72]) {
          const x = body.x + f * body.rx,
            y = body.y + body.ry * 0.6;
          if (blobLegs) blobs.unshift(E(x, y + ll * 0.6, rr(r, 0.022, 0.036), ll * 0.7, rr(r, -0.12, 0.12)));
          else limbs.push(leg(x, y, ll + body.ry * 0.4, rr(r, -0.25, 0.25), rr(r, -0.01, 0.02), 0.013));
        }
        return { blobs, limbs, faces: [face(head)], head, body, view: 'side', parts: ['horns', 'ears', 'antennae', 'tail', 'crest', 'mane', 'bumps', 'wings'] };
      },
    },
    {
      id: 'longneck',
      build(r) {
        const body = E(0.58, 0.55, rr(r, 0.13, 0.18), rr(r, 0.075, 0.1), rr(r, -0.1, 0.05));
        const h = rr(r, 0.18, 0.32),
          lean = rr(r, -0.12, 0.02),
          n = ri(r, 3, 5),
          neck: Pt[] = [];
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          neck.push([body.x - body.rx * 0.7 + lean * t - 0.03 * t, body.y - body.ry * 0.5 - h * t]);
        }
        const hr = rr(r, 0.045, 0.07),
          top = neck[n - 1]!;
        const head = E(top[0] - hr * 0.6, top[1] - hr * 0.3, hr * 1.35, hr, rr(r, -0.2, 0.2));
        const limbs: Limb[] = [],
          ll = rr(r, 0.14, 0.22);
        for (const f of [-0.65, -0.35, 0.4, 0.7]) limbs.push(leg(body.x + f * body.rx, body.y + body.ry * 0.5, ll, rr(r, -0.15, 0.15), rr(r, -0.01, 0.02), 0.012));
        return { blobs: [body, ...tube([[body.x - body.rx * 0.6, body.y - body.ry * 0.3], ...neck], 0.038, 0.028, 1, 7), head], limbs, faces: [face(head)], head, body, view: 'side', parts: ['horns', 'ears', 'tail', 'mane', 'crest', 'bumps'] };
      },
    },
    {
      id: 'lizard',
      build(r) {
        const body = E(0.52, 0.64, rr(r, 0.15, 0.22), rr(r, 0.045, 0.07), rr(r, -0.04, 0.04));
        const head = E(body.x - body.rx - 0.03, body.y - rr(r, 0, 0.03), rr(r, 0.06, 0.085), rr(r, 0.04, 0.055));
        const tail = curve(r, body.x + body.rx * 0.9, body.y, rr(r, 0.18, 0.3), rr(r, -0.4, 0.3), rr(r, -2.5, 1), 12);
        const limbs: Limb[] = [];
        for (const f of [-0.6, 0.55])
          for (const s of S2) {
            const x = body.x + f * body.rx + s * 0.02,
              y = body.y + body.ry * 0.3;
            limbs.push(
              L(
                [
                  [x, y],
                  [x + s * 0.045, y - 0.015],
                  [x + s * 0.06, y + rr(r, 0.05, 0.07)],
                ],
                0.011,
              ),
            );
          }
        return { blobs: [...tube(tail, body.ry * 0.8, 0.014, 1, 8).slice(1).reverse(), body, head], limbs, faces: [face(head, 1.2)], head, body, view: 'side', parts: ['crest', 'horns', 'bumps', 'fins', 'tuft', 'wings'] };
      },
    },
    {
      id: 'bear',
      build(r) {
        const body = E(0.55, 0.58, rr(r, 0.18, 0.24), rr(r, 0.13, 0.18), rr(r, -0.06, 0.06));
        const hr = rr(r, 0.075, 0.11),
          head = C(body.x - body.rx * rr(r, 0.65, 0.95), body.y - body.ry * rr(r, 0.4, 0.95), hr);
        const legs = [-0.6, -0.2, 0.25, 0.65].map((f) => E(body.x + f * body.rx, body.y + body.ry * 0.85, rr(r, 0.035, 0.05), rr(r, 0.04, 0.06)));
        return { blobs: [...legs, body, head], limbs: [], faces: [face(head)], head, body, view: 'side', parts: ['ears', 'horns', 'tail', 'bumps', 'mane', 'crest', 'wings'] };
      },
    },
    {
      id: 'hexapod',
      build(r) {
        const body = E(0.55, 0.56, rr(r, 0.22, 0.3), rr(r, 0.07, 0.1), rr(r, -0.05, 0.05));
        const hump = r() < 0.55 ? [E(body.x + body.rx * rr(r, -0.2, 0.4), body.y - body.ry * 0.9, body.rx * rr(r, 0.3, 0.45), body.ry * rr(r, 0.6, 0.9))] : [];
        const hr = rr(r, 0.055, 0.09),
          head = E(body.x - body.rx - hr * 0.3, body.y - rr(r, -0.02, 0.06), hr * 1.15, hr);
        const limbs: Limb[] = [],
          ll = rr(r, 0.08, 0.15);
        for (let k = 0; k < 6; k++) limbs.push(leg(body.x - body.rx * 0.75 + (body.rx * 1.5 * k) / 5, body.y + body.ry * 0.5, ll, rr(r, -0.35, 0.35), rr(r, 0, 0.04), 0.01));
        return { blobs: [...hump, body, head], limbs, faces: [face(head)], head, body, view: 'side', parts: ['horns', 'antennae', 'crest', 'tail', 'bumps', 'ears'] };
      },
    },
  ],
  schlange: [
    {
      id: 'wave',
      build(r) {
        const len = rr(r, 0.5, 0.7),
          amp = rr(r, 0.03, 0.12),
          fr = rr(r, 3, 7),
          ph = rr(r, 0, 6.28),
          r0 = rr(r, 0.06, 0.1),
          r1 = rr(r, 0.025, 0.045);
        const pts: Pt[] = [];
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          pts.push([0.5 - len / 2 + len * t, 0.55 + Math.sin(ph + t * fr) * amp]);
        }
        const segs = tube(pts, r0, r1);
        const n = segs.length;
        const head = segs[0]!;
        head.rx *= rr(r, 1, 1.4);
        return { blobs: segs.slice().reverse(), limbs: [], faces: [face(head)], head, body: segs[Math.min(2, n - 1)]!, view: 'side', parts: ['horns', 'crest', 'fins', 'antennae', 'tail', 'ears', 'tuft'] };
      },
    },
    {
      id: 'coil',
      build(r) {
        const n = 30,
          Rc = rr(r, 0.13, 0.19),
          a0 = rr(r, 0, 6.28),
          turns = rr(r, 1, 1.5),
          pts: Pt[] = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1),
            R = lerp(0.02, Rc, t),
            a = a0 + t * turns * Math.PI * 2;
          pts.push([0.5 + Math.cos(a) * R, 0.66 + Math.sin(a) * R * 0.55]);
        }
        const last = pts[n - 1]!,
          hx = 0.5 + rr(r, -0.1, 0.1),
          hy = 0.66 - rr(r, 0.24, 0.36),
          neck: Pt[] = [last];
        for (let i = 1; i <= 8; i++) {
          const t = i / 9;
          neck.push([lerp(last[0], hx, t) + Math.sin(t * 3) * 0.03, lerp(last[1], hy, t)]);
        }
        const head = E(hx, hy, rr(r, 0.06, 0.085), rr(r, 0.05, 0.07));
        return { blobs: [...tube(pts, 0.03, 0.058, 1, 10), ...tube(neck, 0.054, 0.048, 1, 5).slice(1), head], limbs: [], faces: [face(head, 1.1)], head, body: C(0.5, 0.66, Rc * 0.6), view: 'front', parts: ['horns', 'ears', 'tuft', 'mane', 'antennae'] };
      },
    },
    {
      id: 'cobra',
      build(r) {
        const h = rr(r, 0.38, 0.52),
          amp = rr(r, 0.04, 0.09),
          ph = rr(r, 0, 6.28),
          n = 20,
          pts: Pt[] = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          pts.push([0.5 + Math.sin(ph + t * Math.PI * 1.5) * amp * (1 - t * 0.5), 0.82 - t * h]);
        }
        const base = [E(0.42, 0.84, 0.07, 0.035), E(0.58, 0.85, 0.08, 0.035)];
        const top = pts[n - 1]!,
          head = E(top[0], top[1] - 0.02, rr(r, 0.05, 0.07), rr(r, 0.045, 0.06));
        const hood = r() < 0.75 ? [E(head.x, head.y + 0.04, rr(r, 0.09, 0.14), rr(r, 0.09, 0.13))] : [];
        return { blobs: [...base, ...tube(pts.slice(0, n - 2), 0.06, 0.045, 1, 10), ...hood, head], limbs: [], faces: [face(head, 1.1)], head, body: hood[0] ?? head, view: 'front', parts: ['horns', 'tuft', 'crest', 'ears', 'arms'] };
      },
    },
    {
      id: 'eel',
      build(r) {
        const len = rr(r, 0.55, 0.7),
          amp = rr(r, 0.01, 0.05),
          ph = rr(r, 0, 6.28),
          pts: Pt[] = [];
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          pts.push([0.5 - len / 2 + len * t, 0.55 + Math.sin(ph + t * 4) * amp]);
        }
        const segs = tube(pts, rr(r, 0.055, 0.075), rr(r, 0.032, 0.045), rr(r, 0.9, 1.2), 10);
        const n = segs.length;
        const fins: B[] = [];
        for (let i = 1; i < n - 1; i += 2) {
          const s = segs[i]!;
          fins.push(E(s.x, s.y - s.ry * 1.05, s.rx * 0.9, s.ry * 0.45, s.rot, { wing: true }));
        }
        const t = segs[n - 1]!;
        fins.push(E(t.x + t.rx * 1.2, t.y - 0.025, 0.045, 0.02, -0.6, { wing: true }), E(t.x + t.rx * 1.2, t.y + 0.025, 0.045, 0.02, 0.6, { wing: true }));
        const head = segs[0]!;
        head.rx *= 1.25;
        return { blobs: [...fins, ...segs.slice().reverse()], limbs: [], faces: [face(head)], head, body: segs[2]!, view: 'side', parts: ['horns', 'antennae', 'tuft', 'bumps'] };
      },
    },
    {
      id: 'humps',
      build(r) {
        const humps = ri(r, 2, 3),
          w = rr(r, 0.14, 0.2),
          h = rr(r, 0.09, 0.16),
          rad = rr(r, 0.035, 0.05),
          y0 = 0.62,
          x0 = 0.5 - (humps * w) / 2 + w * 0.15;
        const blobs: B[] = [];
        for (let k = 0; k < humps; k++) {
          const arc: Pt[] = [];
          for (let i = 0; i <= 12; i++) {
            const t = i / 12;
            arc.push([x0 + k * w + t * w * 0.8, y0 - Math.sin(t * Math.PI) * h * (1 - k * 0.15)]);
          }
          blobs.push(...tube(arc, rad * (1 - k * 0.12), rad * (1 - k * 0.12), 1, 4));
        }
        const neck: Pt[] = [];
        for (let i = 0; i <= 8; i++) {
          const t = i / 8;
          neck.push([x0 - t * 0.06, y0 - t * rr(r, 0.2, 0.28)]);
        }
        const nk = tube(neck, rad * 1.1, rad * 0.9, 1, 3);
        const top = neck[neck.length - 1]!,
          head = E(top[0] - 0.03, top[1] - 0.01, rr(r, 0.06, 0.08), rr(r, 0.045, 0.06), rr(r, -0.2, 0.2));
        const water = r() < 0.5 ? [E(0.5, y0 + 0.02, humps * w * 0.62, 0.012, 0, { wing: true })] : [];
        return { blobs: [...water, ...blobs, ...nk, head], limbs: [], faces: [face(head, 1.1)], head, body: nk[0]!, view: 'side', parts: ['horns', 'ears', 'tuft', 'antennae', 'crest'] };
      },
    },
  ],
  turm: [
    {
      id: 'stack',
      build(r) {
        const n = ri(r, 2, 5),
          blobs: B[] = [];
        let yb = 0.87;
        for (let i = 0; i < n; i++) {
          const rad = rr(r, 0.07, 0.15),
            cy = yb - rad;
          blobs.push(E(0.5 + rr(r, -0.04, 0.04), cy, rad * rr(r, 0.95, 1.2), rad * rr(r, 0.8, 0.95), rr(r, -0.12, 0.12)));
          yb = cy - rad * 0.55;
        }
        const fi = r() < 0.6 ? n - 1 : ri(r, 0, n - 1),
          f = blobs[fi]!,
          m = blobs[Math.max(0, Math.min(n - 1, fi === n - 1 ? n - 2 : fi + 1))]!;
        const limbs: Limb[] =
          r() < 0.7
            ? S2.map((s) => L(curve(r, m.x + s * m.rx * 0.85, m.y, rr(r, 0.08, 0.15), s > 0 ? rr(r, -0.8, 0.3) : Math.PI - rr(r, -0.8, 0.3), s * rr(r, -1, 1), 5), 0.013))
            : [];
        return { blobs, limbs, faces: [face(f)], head: f, body: blobs[0]!, view: 'front', parts: ['horns', 'ears', 'antennae', 'tuft', 'bumps', 'arms'] };
      },
    },
    {
      id: 'totem',
      build(r) {
        const n = ri(r, 3, 4),
          blobs: B[] = [],
          wings: B[] = [];
        let yb = 0.88;
        for (let i = 0; i < n; i++) {
          const rx = rr(r, 0.1, 0.17),
            ry = rr(r, 0.055, 0.08),
            cy = yb - ry;
          const b = E(0.5, cy, rx, ry);
          blobs.push(b);
          if (r() < 0.45) for (const s of S2) wings.push(E(0.5 + s * (rx + 0.035), cy - ry * 0.4, rr(r, 0.04, 0.07), rr(r, 0.02, 0.035), -s * rr(r, 0.2, 0.9)));
          yb = cy - ry * 0.85;
        }
        const f = blobs[ri(r, 1, n - 1)]!;
        return { blobs: [...wings, ...blobs], limbs: [], faces: [face(f, 1.05)], head: blobs[n - 1]!, body: blobs[0]!, view: 'front', parts: ['horns', 'ears', 'tuft', 'antennae'] };
      },
    },
    {
      id: 'cactus',
      build(r) {
        const col = E(0.5, 0.55, rr(r, 0.065, 0.1), rr(r, 0.2, 0.28));
        const blobs: B[] = [],
          n = ri(r, 1, 3);
        for (let i = 0; i < n; i++) {
          const s = i === 1 ? -1 : i === 0 ? (r() < 0.5 ? -1 : 1) : r() < 0.5 ? -1 : 1,
            y = col.y + rr(r, -0.12, 0.08),
            w = rr(r, 0.06, 0.1),
            h = rr(r, 0.06, 0.14);
          const x = 0.5 + s * (col.rx + w * 0.5);
          blobs.push(E(x, y, w * 0.6, 0.032), E(0.5 + s * (col.rx + w), y - h * 0.6, 0.035, h * 0.7));
        }
        const pot = r() < 0.4 ? [E(0.5, col.y + col.ry * 0.95, col.rx * 1.4, 0.05)] : [];
        return { blobs: [...blobs, col, ...pot], limbs: [], faces: [face(col, 0.95, -col.ry * 0.3)], head: col, body: col, view: 'front', parts: ['tuft', 'bumps', 'horns', 'ears'] };
      },
    },
    {
      id: 'leaning',
      build(r) {
        const dir = r() < 0.5 ? -1 : 1,
          bend = rr(r, 0.1, 0.25),
          pts: Pt[] = [];
        for (let i = 0; i <= 16; i++) {
          const t = i / 16;
          pts.push([0.5 + dir * Math.sin(t * 1.4) * bend, 0.82 - t * rr(r, 0.45, 0.55)]);
        }
        const big = r() < 0.5;
        const segs = tube(pts, rr(r, 0.09, 0.13), big ? rr(r, 0.1, 0.13) : rr(r, 0.05, 0.07), rr(r, 0.85, 1), 6);
        for (const s of segs) s.rot = 0;
        const n = segs.length,
          head = segs[n - 1]!;
        const limbs = S2.map((s) => L([[segs[0]!.x + s * segs[0]!.rx * 0.5, segs[0]!.y + segs[0]!.ry * 0.8], [segs[0]!.x + s * segs[0]!.rx * 0.6, segs[0]!.y + segs[0]!.ry + 0.045]], 0.013));
        return { blobs: segs, limbs, faces: [face(head)], head, body: segs[0]!, view: 'front', parts: ['horns', 'ears', 'antennae', 'tuft', 'arms', 'mane'] };
      },
    },
    {
      id: 'snowman',
      build(r) {
        const r0 = rr(r, 0.12, 0.16),
          r1 = r0 * rr(r, 0.65, 0.85),
          r2 = r1 * rr(r, 0.6, 0.85);
        const b0 = C(0.5, 0.86 - r0, r0),
          b1 = C(0.5 + rr(r, -0.02, 0.02), b0.y - r0 - r1 * 0.75, r1),
          b2 = C(0.5 + rr(r, -0.02, 0.02), b1.y - r1 - r2 * 0.75, r2);
        const limbs: Limb[] = [];
        for (const s of S2) {
          const a = curve(r, b1.x + s * r1 * 0.8, b1.y - r1 * 0.1, rr(r, 0.12, 0.18), s > 0 ? rr(r, -0.7, 0.1) : Math.PI + rr(r, -0.1, 0.7), s * rr(r, -0.4, 0.4), 4);
          limbs.push(L(a, 0.009));
          const e = a[a.length - 1]!;
          limbs.push(L([e, [e[0] + s * 0.025, e[1] - 0.03]], 0.006), L([e, [e[0] + s * 0.03, e[1] + 0.01]], 0.006));
        }
        const hat = r() < 0.45 ? [E(b2.x, b2.y - r2 * 0.85, r2 * 1.1, 0.014), E(b2.x, b2.y - r2 * 0.85 - 0.04, r2 * 0.65, 0.045)] : [];
        return { blobs: [b0, b1, b2, ...hat], limbs, faces: [face(b2)], head: b2, body: b0, view: 'front', parts: hat.length ? ['bumps'] : ['horns', 'ears', 'antennae', 'tuft', 'bumps'] };
      },
    },
  ],
  krabbe: [
    {
      id: 'crab',
      build(r) {
        const body = E(0.5, 0.6, rr(r, 0.17, 0.26), rr(r, 0.08, 0.12));
        const fiddler = r() < 0.4,
          big = r() < 0.5 ? -1 : 1,
          cx = rr(r, 0.28, 0.36),
          cy = rr(r, 0.32, 0.42);
        const blobs: B[] = [],
          limbs: Limb[] = [];
        for (const s of S2) {
          const size = rr(r, 0.05, 0.07) * (fiddler ? (s === big ? 1.6 : 0.7) : 1);
          const x = 0.5 + s * cx,
            y = cy;
          limbs.push(L([[0.5 + s * body.rx * 0.8, body.y - body.ry * 0.3], [0.5 + s * (cx - 0.04), (y + body.y) / 2 + 0.02], [x, y + size * 0.5]], 0.014));
          blobs.push(...claw(x, y, size, -Math.PI / 2 + s * 0.4));
        }
        const nl = ri(r, 2, 4);
        for (const s of S2) for (let k = 0; k < nl; k++) limbs.push(leg(0.5 + s * (body.rx * 0.45 + k * 0.045), body.y + body.ry * 0.5, rr(r, 0.08, 0.13), s * rr(r, 0.4, 0.8), rr(r, 0.02, 0.06), 0.01));
        blobs.push(body);
        return { blobs, limbs, faces: [face(body, 0.9, -body.ry * 0.15, { stalks: r() < 0.65 })], head: body, body, view: 'front', parts: ['bumps', 'crest', 'horns'] };
      },
    },
    {
      id: 'spider',
      build(r) {
        const ab = C(0.5, 0.6, rr(r, 0.1, 0.15)),
          hr = rr(r, 0.055, 0.08),
          head = C(0.5, ab.y - ab.ry - hr * 0.6, hr);
        const limbs: Limb[] = [];
        for (const s of S2)
          for (let k = 0; k < 4; k++) {
            const hx = 0.5 + s * hr * 0.7,
              hy = head.y + hr * 0.3 + k * 0.025,
              kx = hx + s * rr(r, 0.1, 0.16),
              ky = hy - rr(r, 0.03, 0.1) + k * 0.03;
            limbs.push(
              L(
                [
                  [hx, hy],
                  [kx, ky],
                  [kx + s * rr(r, 0.04, 0.09), hy + rr(r, 0.08, 0.16) + k * 0.02],
                ],
                0.008,
              ),
            );
          }
        return { blobs: [ab, head], limbs, faces: [face(head)], head, body: ab, view: 'front', parts: ['bumps', 'crest', 'horns', 'tuft'] };
      },
    },
    {
      id: 'lobster',
      build(r) {
        const cara = E(0.38, 0.52, rr(r, 0.1, 0.13), rr(r, 0.06, 0.08), rr(r, -0.1, 0.1));
        const tail = curve(r, cara.x + cara.rx * 0.9, cara.y + 0.01, rr(r, 0.24, 0.32), rr(r, -0.1, 0.15), rr(r, 0.6, 2.2), 12);
        const segs = tube(tail, cara.ry * 0.85, 0.03, 0.85, 6).slice(1);
        const end = tail[tail.length - 1]!;
        const fan = [-1, 0, 1].map((k) => E(end[0] + 0.02, end[1] + 0.02, 0.035, 0.016, Math.PI / 2 + k * 0.5));
        const head = E(cara.x - cara.rx * 0.95, cara.y - 0.01, rr(r, 0.05, 0.07), rr(r, 0.04, 0.055));
        const limbs: Limb[] = [],
          blobs: B[] = [];
        for (const s of S2) limbs.push(L(curve(r, head.x - head.rx * 0.5, head.y - head.ry * 0.5, rr(r, 0.2, 0.32), -2.3 + s * 0.25, rr(r, 1, 2.2), 8), 0.006));
        const csz = rr(r, 0.04, 0.065);
        for (const s of S2) {
          const x = head.x - rr(r, 0.06, 0.12),
            y = head.y + 0.05 + s * 0.03;
          limbs.push(L([[cara.x - cara.rx * 0.6, cara.y + cara.ry * 0.5], [x + 0.03, y + 0.02], [x, y]], 0.012));
          blobs.push(...claw(x, y, csz, Math.PI + s * 0.3));
        }
        for (let k = 0; k < 3; k++) limbs.push(leg(cara.x - cara.rx * 0.3 + k * 0.05, cara.y + cara.ry * 0.6, rr(r, 0.07, 0.1), rr(r, -0.3, 0.3), 0.02, 0.008));
        return { blobs: [...fan, ...segs.slice().reverse(), cara, ...blobs, head], limbs, faces: [face(head, 1.1)], head, body: cara, view: 'side', parts: ['crest', 'bumps', 'horns'] };
      },
    },
    {
      id: 'hermit',
      build(r) {
        const sr = rr(r, 0.13, 0.18),
          shell = [C(0.56, 0.5, sr), C(0.6, 0.45, sr * 0.68), C(0.63, 0.41, sr * 0.4), C(0.645, 0.385, sr * 0.2)];
        const body = E(0.4, 0.6, rr(r, 0.07, 0.1), rr(r, 0.06, 0.08));
        const blobs: B[] = [...shell, body],
          limbs: Limb[] = [];
        const csz = rr(r, 0.04, 0.06);
        for (const s of S2) {
          const x = body.x - rr(r, 0.07, 0.11),
            y = body.y + 0.03 + s * 0.035;
          limbs.push(L([[body.x - body.rx * 0.6, body.y + 0.02], [x, y]], 0.012));
          blobs.push(...claw(x, y, csz * (s > 0 ? 1.25 : 0.85), Math.PI + s * 0.35));
        }
        for (let k = 0; k < 3; k++) limbs.push(leg(body.x - 0.03 + k * 0.035, body.y + body.ry * 0.6, rr(r, 0.07, 0.1), rr(r, -0.4, 0.2), 0.02, 0.009));
        return { blobs, limbs, faces: [face(body, 1, -body.ry * 0.2, { stalks: true })], head: body, body: shell[0]!, view: 'side', parts: ['bumps', 'crest'] };
      },
    },
    {
      id: 'scorpion',
      build(r) {
        const body = chain(
          [
            [0.36, 0.64],
            [0.47, 0.645],
            [0.57, 0.65],
          ],
          rr(r, 0.06, 0.075),
          rr(r, 0.05, 0.06),
          0.75,
        );
        const tail = curve(r, 0.62, 0.64, rr(r, 0.32, 0.42), -0.6, rr(r, -3.6, -2.6), 14);
        const segs = tube(tail, 0.036, 0.028, 1, 8).slice(1);
        const end = tail[tail.length - 1]!;
        const sting = E(end[0] - 0.02, end[1] + 0.025, 0.012, 0.03, rr(r, -0.6, 0.2));
        const head = body[0]!,
          limbs: Limb[] = [],
          blobs: B[] = [];
        const csz = rr(r, 0.045, 0.065);
        for (const s of S2) {
          const x = head.x - rr(r, 0.1, 0.15),
            y = head.y - 0.02 + s * 0.04;
          limbs.push(L([[head.x - 0.03, head.y + 0.01], [x + 0.04, y + 0.03], [x, y]], 0.012));
          blobs.push(...claw(x, y, csz, Math.PI + s * 0.3));
        }
        for (let k = 0; k < 4; k++) limbs.push(leg(0.4 + k * 0.05, 0.66, rr(r, 0.06, 0.09), rr(r, -0.5, 0.5), 0.025, 0.008));
        return { blobs: [...segs, sting, ...body.slice().reverse(), ...blobs], limbs, faces: [face(head, 1.15)], head, body: body[1]!, view: 'side', parts: ['crest', 'bumps', 'horns'] };
      },
    },
  ],
  qualle: [
    {
      id: 'jelly',
      build(r) {
        const D = E(0.5, 0.37, rr(r, 0.16, 0.25), rr(r, 0.09, 0.18)),
          S = E(0.5, D.y + D.ry * 0.7, D.rx * rr(r, 0.8, 0.98), rr(r, 0.03, 0.05));
        const limbs: Limb[] = [],
          n = ri(r, 3, 12);
        for (let i = 0; i < n; i++) {
          const x = 0.5 - D.rx * 0.75 + (D.rx * 1.5 * i) / (n - 1);
          limbs.push(L(curve(r, x, S.y, rr(r, 0.16, 0.42), Math.PI / 2 + rr(r, -0.2, 0.2), rr(r, -0.6, 0.6), 10, 0.25), rr(r, 0.006, 0.013)));
        }
        const arms: B[] = [];
        if (r() < 0.45) {
          const pts = curve(r, 0.5, S.y + 0.02, rr(r, 0.15, 0.25), Math.PI / 2, rr(r, -1, 1), 10, 0.15);
          arms.push(...tube(pts, 0.035, 0.018, 1, 5).slice(1));
        }
        return { blobs: [...arms, D, S], limbs, faces: [face(D, 0.9, 0.01)], head: D, body: D, view: 'front', parts: ['horns', 'ears', 'antennae', 'tuft', 'bumps', 'crest'] };
      },
    },
    {
      id: 'squid',
      build(r) {
        const mantle = E(0.5, 0.36, rr(r, 0.08, 0.12), rr(r, 0.16, 0.22));
        const fins = S2.map((s) => E(0.5 + s * mantle.rx * 0.9, mantle.y - mantle.ry * 0.7, rr(r, 0.05, 0.08), 0.03, -s * rr(r, 0.3, 0.8), { wing: true }));
        const head = E(0.5, mantle.y + mantle.ry + 0.02, mantle.rx * 0.9, rr(r, 0.05, 0.07));
        const limbs: Limb[] = [],
          blobs: B[] = [],
          n = ri(r, 6, 8);
        for (let i = 0; i < n; i++) {
          const x = 0.5 - head.rx * 0.8 + (head.rx * 1.6 * i) / (n - 1);
          limbs.push(L(curve(r, x, head.y + head.ry * 0.6, rr(r, 0.1, 0.18), Math.PI / 2 + (x - 0.5) * 3, rr(r, -0.8, 0.8), 7, 0.15), 0.011));
        }
        for (const s of S2) {
          const a = curve(r, 0.5 + s * 0.02, head.y + head.ry, rr(r, 0.22, 0.32), Math.PI / 2 + s * 0.25, s * rr(r, -1.5, 1.5), 9, 0.15);
          limbs.push(L(a, 0.007));
          const e = a[a.length - 1]!;
          blobs.push(E(e[0], e[1], 0.018, 0.03));
        }
        return { blobs: [...fins, mantle, ...blobs, head], limbs, faces: [face(head, 1.3, -0.01)], head, body: mantle, view: 'front', parts: ['bumps', 'antennae', 'horns'] };
      },
    },
    {
      id: 'octopus',
      build(r) {
        const R = rr(r, 0.12, 0.17),
          head = E(0.5, 0.4, R, R * rr(r, 1, 1.3));
        const limbs: Limb[] = [],
          n = ri(r, 5, 8);
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1),
            a = Math.PI * (0.95 - 0.9 * t);
          const x = 0.5 + Math.cos(a) * R * 0.75,
            y = head.y + head.ry * 0.6;
          limbs.push(L(curve(r, x, y, rr(r, 0.16, 0.28), a, (t < 0.5 ? 1 : -1) * rr(r, 1.2, 3.2), 9), rr(r, 0.018, 0.028)));
        }
        return { blobs: [head], limbs, faces: [face(head, 0.85, head.ry * 0.25)], head, body: head, view: 'front', parts: ['horns', 'tuft', 'bumps', 'crest', 'ears'] };
      },
    },
    {
      id: 'anemone',
      build(r) {
        const base = E(0.5, 0.8, rr(r, 0.11, 0.15), rr(r, 0.04, 0.06)),
          col = E(0.5, 0.66, rr(r, 0.09, 0.12), rr(r, 0.11, 0.15));
        const limbs: Limb[] = [],
          n = ri(r, 8, 14);
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1),
            x = 0.5 - col.rx * 0.9 + col.rx * 1.8 * t;
          limbs.push(L(curve(r, x, col.y - col.ry * 0.8, rr(r, 0.12, 0.26), -Math.PI / 2 + (t - 0.5) * rr(r, 1.2, 2.2), rr(r, -1, 1), 8, 0.25), rr(r, 0.007, 0.012)));
        }
        return { blobs: [base, col], limbs, faces: [face(col, 0.85, col.ry * 0.15)], head: col, body: col, view: 'front', parts: ['bumps', 'arms', 'fins'] };
      },
    },
    {
      id: 'bells',
      build(r) {
        const n = ri(r, 2, 4),
          blobs: B[] = [];
        let y = 0.28;
        for (let i = 0; i < n; i++) {
          const rx = rr(r, 0.07, 0.12) * (1 - i * 0.15),
            ry = rx * rr(r, 0.6, 0.85);
          blobs.push(E(0.5 + rr(r, -0.03, 0.03), y + ry, rx, ry));
          y += ry * 1.7;
        }
        const limbs: Limb[] = [],
          k = ri(r, 3, 7),
          last = blobs[n - 1]!;
        for (let i = 0; i < k; i++) limbs.push(L(curve(r, last.x + rr(r, -last.rx, last.rx) * 0.6, last.y + last.ry * 0.7, rr(r, 0.15, 0.3), Math.PI / 2, rr(r, -0.6, 0.6), 8, 0.3), 0.006));
        const head = blobs[0]!;
        return { blobs: blobs.slice().reverse(), limbs, faces: [face(head, 0.95)], head, body: blobs[n - 1]!, view: 'front', parts: ['horns', 'antennae', 'tuft', 'ears'] };
      },
    },
  ],
  huepfer: [
    {
      id: 'bunny',
      build(r) {
        const body = E(0.5, 0.55, rr(r, 0.12, 0.17), rr(r, 0.15, 0.21));
        const F = S2.map((s) => E(0.5 + s * body.rx * 0.65, body.y + body.ry * 0.92, rr(r, 0.07, 0.1), rr(r, 0.035, 0.05), s * 0.15));
        const er = rr(r, 0.06, 0.13),
          spread = rr(r, 0.05, 0.5);
        const ears = S2.map((s) => E(0.5 + s * body.rx * 0.4, body.y - body.ry - er * 0.8, rr(r, 0.025, 0.038), er, s * spread, { wing: true }));
        return { blobs: [...ears, body, ...F], limbs: [], faces: [face(body, 0.85, -body.ry * 0.3)], head: body, body, view: 'front', parts: ['tail', 'arms', 'horns', 'bumps', 'tuft'] };
      },
    },
    {
      id: 'frog',
      build(r) {
        const body = E(0.5, 0.6, rr(r, 0.17, 0.24), rr(r, 0.1, 0.14));
        const eyes = S2.map((s) => C(0.5 + s * body.rx * rr(r, 0.4, 0.6), body.y - body.ry * 0.85, rr(r, 0.04, 0.06)));
        const thighs = S2.map((s) => E(0.5 + s * body.rx * 0.85, body.y + body.ry * 0.4, rr(r, 0.06, 0.09), rr(r, 0.04, 0.06), s * 0.5));
        const feet = S2.map((s) => E(0.5 + s * body.rx * 1.15, body.y + body.ry * 0.95, rr(r, 0.05, 0.07), 0.022, s * 0.1));
        const limbs = S2.map((s) => L([[0.5 + s * body.rx * 0.3, body.y + body.ry * 0.7], [0.5 + s * body.rx * 0.4, body.y + body.ry + 0.05]], 0.012));
        return { blobs: [...feet, ...thighs, body, ...eyes], limbs, faces: [face(body, 0.8, -body.ry * 0.05)], head: body, body, view: 'front', parts: ['crest', 'bumps', 'horns', 'tuft'] };
      },
    },
    {
      id: 'roo',
      build(r) {
        const body = E(0.55, 0.55, rr(r, 0.1, 0.14), rr(r, 0.15, 0.2), rr(r, -0.45, -0.15));
        const hr = rr(r, 0.06, 0.085),
          head = E(body.x - body.rx * 0.6, body.y - body.ry - hr * 0.4, hr * 1.2, hr);
        const foot = E(body.x - 0.02, body.y + body.ry + 0.05, rr(r, 0.07, 0.1), 0.03);
        const tail = tube(curve(r, body.x + body.rx * 0.6, body.y + body.ry * 0.5, rr(r, 0.14, 0.2), 0.6, rr(r, -0.5, 0.5), 10), 0.035, 0.018, 1, 5).slice(1);
        const limbs = [L([[body.x - body.rx * 0.6, body.y - body.ry * 0.3], [body.x - body.rx - 0.04, body.y - 0.01], [body.x - body.rx - 0.05, body.y + 0.03]], 0.009)];
        return { blobs: [...tail, foot, body, head], limbs, faces: [face(head)], head, body, view: 'side', parts: ['ears', 'horns', 'antennae', 'tuft', 'crest'] };
      },
    },
    {
      id: 'grasshopper',
      build(r) {
        const body = E(0.55, 0.56, rr(r, 0.16, 0.22), rr(r, 0.05, 0.07), rr(r, -0.15, 0.05));
        const hr = rr(r, 0.045, 0.065),
          head = E(body.x - body.rx - hr * 0.2, body.y - 0.02, hr * 1.1, hr * 1.2);
        const thigh = E(body.x + body.rx * 0.15, body.y - body.ry * 0.6, rr(r, 0.1, 0.14), 0.03, -0.35);
        const kx = thigh.x + Math.cos(-0.35) * thigh.rx,
          ky = thigh.y + Math.sin(-0.35) * thigh.rx;
        const limbs: Limb[] = [L([[kx, ky], [kx - 0.03, body.y + 0.14]], 0.009)];
        for (let k = 0; k < 2; k++) limbs.push(leg(body.x - body.rx * 0.6 + k * 0.06, body.y + body.ry * 0.5, rr(r, 0.07, 0.1), rr(r, -0.4, 0.1), 0.02, 0.008));
        for (const s of S2) limbs.push(L(curve(r, head.x - hr * 0.3, head.y - hr, rr(r, 0.15, 0.3), -2 + s * 0.2, rr(r, 0.4, 1.6), 8), 0.005));
        return { blobs: [body, thigh, head], limbs, faces: [face(head)], head, body, view: 'side', parts: ['wings', 'crest', 'horns', 'tuft'] };
      },
    },
    {
      id: 'spring',
      build(r) {
        const R = rr(r, 0.12, 0.17),
          body = E(0.5, 0.42, R, R * rr(r, 0.85, 1.1));
        const pts: Pt[] = [],
          n = ri(r, 4, 7),
          top = body.y + body.ry * 0.9,
          h = rr(r, 0.18, 0.28);
        for (let i = 0; i <= n * 2; i++) pts.push([0.5 + (i % 2 ? 1 : -1) * (i === 0 || i === n * 2 ? 0 : 0.035), top + (h * i) / (n * 2)]);
        const foot = E(0.5, top + h + 0.015, rr(r, 0.05, 0.07), 0.02);
        return { blobs: [foot, body], limbs: [L(pts, 0.008)], faces: [face(body, 0.85)], head: body, body, view: 'front', parts: ['horns', 'ears', 'antennae', 'tuft', 'arms', 'bumps', 'wings'] };
      },
    },
  ],
  knolle: [
    {
      id: 'potato',
      build(r) {
        const body = E(0.5, 0.62, rr(r, 0.15, 0.22), rr(r, 0.12, 0.18), rr(r, -0.15, 0.15));
        const lumps: B[] = [],
          nb = ri(r, 1, 3);
        for (let i = 0; i < nb; i++) lumps.push(C(...edge(body, rr(r, 0, 6.28), 0.75), rr(r, 0.05, 0.08)));
        const limbs: Limb[] = [],
          leaves: B[] = [],
          n = ri(r, 1, 4);
        for (let i = 0; i < n; i++) {
          const x = 0.5 + (i - (n - 1) / 2) * 0.06,
            y0 = body.y - body.ry * 0.9,
            y1 = y0 - rr(r, 0.06, 0.15),
            x1 = x + rr(r, -0.06, 0.06);
          limbs.push(L([[x, y0], [x1, y1]], 0.008));
          leaves.push(E(x1, y1 - 0.02, rr(r, 0.022, 0.04), rr(r, 0.045, 0.07), rr(r, -0.7, 0.7), { leaf: true }));
        }
        return { blobs: [...lumps, body, ...leaves], limbs, faces: [face(body, 0.85, -body.ry * 0.1)], head: body, body, view: 'front', parts: ['arms', 'bumps', 'ears'] };
      },
    },
    {
      id: 'mushroom',
      build(r) {
        const stem = E(0.5, 0.66, rr(r, 0.06, 0.1), rr(r, 0.12, 0.18));
        const cap = E(0.5 + rr(r, -0.02, 0.02), stem.y - stem.ry - rr(r, 0.0, 0.03), rr(r, 0.17, 0.27), rr(r, 0.07, 0.13), rr(r, -0.15, 0.15));
        const extra: B[] = [];
        if (r() < 0.4) {
          const s = r() < 0.5 ? -1 : 1;
          extra.push(E(0.5 + s * (cap.rx * 0.9), stem.y + stem.ry * 0.4, 0.03, 0.06), E(0.5 + s * (cap.rx * 0.9), stem.y + stem.ry * 0.4 - 0.06, 0.07, 0.035));
        }
        const onCap = r() < 0.35;
        return { blobs: [...extra, stem, cap], limbs: [], faces: [onCap ? face(cap, 0.95) : face(stem, 1.1, -stem.ry * 0.15)], head: cap, body: stem, view: 'front', parts: ['arms', 'bumps', 'tuft'] };
      },
    },
    {
      id: 'bulb',
      build(r) {
        const body = E(0.5, 0.6, rr(r, 0.12, 0.17), rr(r, 0.12, 0.16));
        const tip = E(0.5, body.y - body.ry - 0.03, body.rx * 0.45, rr(r, 0.06, 0.09));
        const limbs: Limb[] = [],
          leaves: B[] = [];
        const n = ri(r, 1, 3);
        for (let i = 0; i < n; i++) {
          const a = curve(r, 0.5, tip.y - tip.ry * 0.8, rr(r, 0.1, 0.2), -Math.PI / 2 + rr(r, -0.6, 0.6), rr(r, -1, 1), 5);
          limbs.push(L(a, 0.008));
          const e = a[a.length - 1]!;
          leaves.push(E(e[0], e[1], 0.025, 0.05, rr(r, -0.6, 0.6), { leaf: true }));
        }
        const roots = ri(r, 3, 7);
        for (let i = 0; i < roots; i++) limbs.push(L(curve(r, 0.5 + (i - (roots - 1) / 2) * 0.03, body.y + body.ry * 0.9, rr(r, 0.05, 0.11), Math.PI / 2 + (i - (roots - 1) / 2) * 0.25, rr(r, -0.8, 0.8), 5, 0.3), 0.005));
        return { blobs: [tip, body, ...leaves], limbs, faces: [face(body, 0.85)], head: body, body, view: 'front', parts: ['arms', 'bumps', 'ears'] };
      },
    },
    {
      id: 'carrot',
      build(r) {
        const w = rr(r, 0.1, 0.15),
          h = rr(r, 0.3, 0.4),
          n = 4,
          blobs: B[] = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          blobs.push(E(0.5 + Math.sin(t * 2) * rr(r, -0.02, 0.02), 0.32 + t * h * 0.8, w * lerp(1, 0.25, t), h * 0.18));
        }
        const leaves: B[] = [],
          k = ri(r, 3, 5);
        for (let i = 0; i < k; i++) leaves.push(E(0.5 + (i - (k - 1) / 2) * 0.03, 0.32 - w * 0.6 - 0.04, 0.02, rr(r, 0.05, 0.09), (i - (k - 1) / 2) * 0.35, { leaf: true }));
        const tip = blobs[n - 1]!;
        const limbs = S2.map((s) => L(curve(r, tip.x + s * 0.02, tip.y, rr(r, 0.06, 0.12), Math.PI / 2 + s * 0.4, s * 0.5, 5), 0.009));
        return { blobs: [...leaves, ...blobs.slice().reverse()], limbs, faces: [face(blobs[0]!, 0.9, 0.01)], head: blobs[0]!, body: blobs[1]!, view: 'front', parts: ['arms', 'bumps'] };
      },
    },
    {
      id: 'twins',
      build(r) {
        const n = ri(r, 2, 3),
          blobs: B[] = [];
        for (let i = 0; i < n; i++) blobs.push(E(0.5 + (i - (n - 1) / 2) * rr(r, 0.14, 0.2), 0.62 + rr(r, -0.05, 0.05), rr(r, 0.08, 0.15), rr(r, 0.08, 0.14), rr(r, -0.3, 0.3)));
        let main = blobs[0]!;
        for (const b of blobs) if (b.rx * b.ry > main.rx * main.ry) main = b;
        const leaves = [E(main.x, main.y - main.ry - 0.05, 0.03, 0.06, rr(r, -0.5, 0.5), { leaf: true })];
        const limbs = [L([[main.x, main.y - main.ry * 0.9], [main.x, main.y - main.ry - 0.03]], 0.008)];
        return { blobs: [...blobs, ...leaves], limbs, faces: [face(main, 0.85)], head: main, body: main, view: 'front', parts: ['arms', 'bumps', 'horns'] };
      },
    },
  ],
  strahler: [
    {
      id: 'star',
      build(r) {
        const R = rr(r, 0.08, 0.13),
          core = C(0.5, 0.5, R),
          swirl = r() < 0.4 ? rr(r, -0.6, 0.6) : 0,
          n = ri(r, 3, swirl ? 6 : 8),
          off = rr(r, 0, 6.28),
          arms: B[] = [];
        for (let i = 0; i < n; i++) {
          const a = off + (i * Math.PI * 2) / n,
            len = rr(r, 0.07, 0.14),
            d = R + len * 0.7;
          arms.push(E(0.5 + Math.cos(a) * d, 0.5 + Math.sin(a) * d, len, rr(r, 0.028, 0.05), a + swirl));
          if (swirl) arms.push(E(0.5 + Math.cos(a + swirl * 0.6) * (d + len * 0.9), 0.5 + Math.sin(a + swirl * 0.6) * (d + len * 0.9), len * 0.55, 0.025, a + swirl * 2));
        }
        return { blobs: [...arms, core], limbs: [], faces: [face(core, 1, 0, { cyclops: r() < 0.6 })], head: core, body: core, view: 'front', parts: ['bumps'] };
      },
    },
    {
      id: 'sun',
      build(r) {
        const R = rr(r, 0.12, 0.17),
          core = C(0.5, 0.5, R),
          n = ri(r, 9, 16),
          off = rr(r, 0, 6.28),
          wavy = r() < 0.5,
          limbs: Limb[] = [];
        for (let i = 0; i < n; i++) {
          const a = off + (i * Math.PI * 2) / n,
            len = rr(r, 0.06, 0.13) * (i % 2 ? 0.7 : 1);
          limbs.push(L(curve(r, 0.5 + Math.cos(a) * R * 0.9, 0.5 + Math.sin(a) * R * 0.9, len, a, wavy ? rr(r, -1.2, 1.2) : 0, 5, wavy ? 0.3 : 0), rr(r, 0.01, 0.018)));
        }
        return { blobs: [core], limbs, faces: [face(core, 0.85)], head: core, body: core, view: 'front', parts: ['bumps', 'mane'] };
      },
    },
    {
      id: 'urchin',
      build(r) {
        const R = rr(r, 0.11, 0.15),
          core = E(0.5, 0.55, R * rr(r, 1, 1.2), R),
          n = ri(r, 14, 24),
          limbs: Limb[] = [];
        for (let i = 0; i < n; i++) {
          const a = -Math.PI * (0.02 + 0.96 * (i / (n - 1))) + rr(r, -0.06, 0.06),
            p = edge(core, a, 0.85),
            len = rr(r, 0.06, 0.16);
          limbs.push(L([p, [p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len]], rr(r, 0.005, 0.009)));
        }
        const feet = S2.map((s) => E(0.5 + s * core.rx * 0.5, core.y + core.ry * 0.9, 0.04, 0.022));
        return { blobs: [...feet, core], limbs, faces: [face(core, 0.8, core.ry * 0.1)], head: core, body: core, view: 'front', parts: ['arms', 'bumps'] };
      },
    },
    {
      id: 'flower',
      build(r) {
        const R = rr(r, 0.06, 0.09),
          cy = rr(r, 0.36, 0.44),
          core = C(0.5, cy, R),
          n = ri(r, 5, 9),
          off = rr(r, 0, 6.28),
          pl = rr(r, 0.06, 0.1),
          petals: B[] = [];
        for (let i = 0; i < n; i++) {
          const a = off + (i * Math.PI * 2) / n;
          petals.push(E(0.5 + Math.cos(a) * (R + pl * 0.7), cy + Math.sin(a) * (R + pl * 0.7), pl, pl * rr(r, 0.45, 0.65), a, { wing: true }));
        }
        const stem = curve(r, 0.5, cy + R, 0.86 - cy - R, Math.PI / 2, rr(r, -0.5, 0.5), 6);
        const mid = stem[3]!;
        const leaves = [E(mid[0] + 0.04, mid[1], 0.045, 0.02, rr(r, -0.6, -0.2), { leaf: true }), ...(r() < 0.6 ? [E(stem[4]![0] - 0.04, stem[4]![1], 0.04, 0.018, rr(r, 0.2, 0.6), { leaf: true })] : [])];
        return { blobs: [...petals, core, ...leaves], limbs: [L(stem, 0.011)], faces: [face(core, 1)], head: core, body: core, view: 'front', parts: ['arms', 'bumps'] };
      },
    },
    {
      id: 'asterisk',
      build(r) {
        const R = rr(r, 0.07, 0.1),
          core = C(0.5, 0.5, R),
          n = ri(r, 5, 8),
          off = rr(r, 0, 6.28),
          limbs: Limb[] = [],
          tips: B[] = [];
        for (let i = 0; i < n; i++) {
          const a = off + (i * Math.PI * 2) / n,
            len = rr(r, 0.14, 0.22);
          const e: Pt = [0.5 + Math.cos(a) * (R + len), 0.5 + Math.sin(a) * (R + len)];
          limbs.push(L([[0.5 + Math.cos(a) * R, 0.5 + Math.sin(a) * R], e], 0.011));
          const m: Pt = [0.5 + Math.cos(a) * (R + len * 0.6), 0.5 + Math.sin(a) * (R + len * 0.6)];
          for (const s of S2) limbs.push(L([m, [m[0] + Math.cos(a + s * 0.7) * len * 0.3, m[1] + Math.sin(a + s * 0.7) * len * 0.3]], 0.007));
          if (r() < 0.7) tips.push(C(e[0], e[1], rr(r, 0.018, 0.03)));
        }
        return { blobs: [...tips, core], limbs, faces: [face(core, 1, 0, { cyclops: r() < 0.5 })], head: core, body: core, view: 'front', parts: ['bumps'] };
      },
    },
  ],
  doppelkopf: [
    {
      id: 'twins',
      build(r) {
        const body = E(0.5, 0.64, rr(r, 0.15, 0.21), rr(r, 0.12, 0.16));
        const hx = rr(r, 0.1, 0.17),
          H: B[] = [],
          N: B[] = [];
        for (const s of S2) {
          const hr = rr(r, 0.06, 0.11),
            h = C(0.5 + s * hx, rr(r, 0.28, 0.4), hr);
          H.push(h);
          N.push(E((h.x + 0.5) / 2, (h.y + body.y - body.ry * 0.5) / 2, 0.035, Math.abs(body.y - h.y) * 0.4, -s * 0.5));
        }
        const limbs = S2.map((s) => L([[0.5 + s * body.rx * 0.5, body.y + body.ry * 0.85], [0.5 + s * body.rx * 0.6, body.y + body.ry + 0.07]], 0.016));
        return { blobs: [body, ...N, ...H], limbs, faces: H.map((h) => face(h)), head: H[0]!, body, view: 'front', parts: ['arms', 'tail', 'bumps', 'wings', 'crest'] };
      },
    },
    {
      id: 'hydra',
      build(r) {
        const body = E(0.5, 0.68, rr(r, 0.15, 0.2), rr(r, 0.1, 0.13));
        const n = ri(r, 3, 5),
          H: B[] = [],
          necks: B[] = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1),
            a = -Math.PI * (0.85 - 0.7 * t);
          const len = rr(r, 0.18, 0.3),
            pts = curve(r, 0.5 + (t - 0.5) * body.rx, body.y - body.ry * 0.6, len, a, rr(r, -0.8, 0.8), 10);
          necks.push(...tube(pts, 0.032, 0.026, 1, 3).slice(1));
          const e = pts[pts.length - 1]!;
          H.push(C(e[0], e[1] - 0.02, rr(r, 0.045, 0.07)));
        }
        const limbs = S2.map((s) => L([[0.5 + s * body.rx * 0.5, body.y + body.ry * 0.8], [0.5 + s * body.rx * 0.6, body.y + body.ry + 0.06]], 0.015));
        return { blobs: [body, ...necks, ...H], limbs, faces: H.map((h) => face(h)), head: H[n >> 1]!, body, view: 'front', parts: ['tail', 'bumps', 'wings', 'crest'] };
      },
    },
    {
      id: 'stacked',
      build(r) {
        const body = E(0.5, 0.7, rr(r, 0.13, 0.18), rr(r, 0.1, 0.14));
        const r1 = rr(r, 0.08, 0.11),
          h1 = C(0.5 + rr(r, -0.04, 0.04), body.y - body.ry - r1 * 0.8, r1);
        const r2 = rr(r, 0.06, 0.1),
          h2 = C(h1.x + rr(r, -0.06, 0.06), h1.y - r1 - r2 * 0.75, r2);
        const limbs = S2.map((s) => L([[0.5 + s * body.rx * 0.5, body.y + body.ry * 0.8], [0.5 + s * body.rx * 0.6, body.y + body.ry + 0.06]], 0.015));
        return { blobs: [body, h1, h2], limbs, faces: [face(h1), face(h2)], head: h2, body, view: 'front', parts: ['arms', 'tail', 'horns', 'ears', 'antennae', 'tuft', 'bumps'] };
      },
    },
    {
      id: 'siamese',
      build(r) {
        const off = rr(r, 0.08, 0.13),
          B2 = S2.map((s) => E(0.5 + s * off, 0.62, rr(r, 0.1, 0.14), rr(r, 0.12, 0.16), s * rr(r, 0.05, 0.25)));
        const H = B2.map((b, i) => C(b.x + (i ? 1 : -1) * 0.03, b.y - b.ry - rr(r, 0.04, 0.07), rr(r, 0.06, 0.09)));
        const limbs: Limb[] = [];
        for (const b of B2) for (const s of S2) limbs.push(L([[b.x + s * b.rx * 0.4, b.y + b.ry * 0.85], [b.x + s * b.rx * 0.5, b.y + b.ry + 0.06]], 0.013));
        return { blobs: [...B2, ...H], limbs, faces: H.map((h) => face(h)), head: H[0]!, body: B2[0]!, view: 'front', parts: ['arms', 'tail', 'bumps', 'crest'] };
      },
    },
    {
      id: 'janus',
      build(r) {
        const head = E(0.5, 0.5, rr(r, 0.2, 0.26), rr(r, 0.14, 0.19));
        const limbs = S2.map((s) => L([[0.5 + s * head.rx * 0.4, head.y + head.ry * 0.9], [0.5 + s * head.rx * 0.5, head.y + head.ry + 0.08]], 0.016));
        const fr = Math.min(head.ry, head.rx * 0.5) * 0.85;
        return { blobs: [head], limbs, faces: S2.map((s) => ({ x: 0.5 + s * head.rx * 0.48, y: head.y + rr(r, -0.02, 0.02), r: fr })), head, body: head, view: 'front', parts: ['horns', 'ears', 'tuft', 'bumps', 'arms', 'wings'] };
      },
    },
  ],
};

/* ===================== Anbauteile ===================== */
const HEAD_TOP: PartKind[] = ['horns', 'ears', 'antennae', 'tuft', 'mane'];
/** Mehr Kleckse kosten Malzeit am Handy (Generation 1 hat höchstens 8) */
const BLOB_MAX = 16;

function addPart(r: Rand, k: PartKind, c: Core, under: B[], over: B[], limbs: Limb[]): void {
  const h = c.head,
    b = c.body,
    side = c.view === 'side';
  const hs = Math.min(h.rx, h.ry);
  switch (k) {
    case 'horns': {
      const kind = pick(r, ['spike', 'curl', 'unicorn', 'antler', 'stub'] as const);
      if (kind === 'unicorn') under.push(E(h.x + (side ? -h.rx * 0.3 : 0), h.y - h.ry * 1.1, hs * 0.13, hs * rr(r, 0.5, 0.85), side ? -0.45 : rr(r, -0.15, 0.15)));
      else
        for (const s of S2) {
          if (kind === 'spike') under.push(E(h.x + s * h.rx * 0.5, h.y - h.ry * 0.95, hs * 0.14, hs * rr(r, 0.35, 0.6), s * rr(r, 0.2, 0.55)));
          else if (kind === 'stub') under.push(C(h.x + s * h.rx * 0.5, h.y - h.ry * 0.85, hs * rr(r, 0.16, 0.24)));
          else if (kind === 'curl') limbs.push(L(curve(r, h.x + s * h.rx * 0.45, h.y - h.ry * 0.7, hs * rr(r, 0.9, 1.4), -Math.PI / 2 + s * 0.5, s * rr(r, 2, 3.4), 8), hs * 0.16));
          else {
            const a = curve(r, h.x + s * h.rx * 0.4, h.y - h.ry * 0.8, hs * rr(r, 0.9, 1.3), -Math.PI / 2 + s * 0.35, s * 0.4, 6);
            limbs.push(L(a, hs * 0.09));
            for (const j of [2, 4]) limbs.push(L([a[j]!, [a[j]![0] + s * hs * 0.35, a[j]![1] - hs * 0.2]], hs * 0.07));
          }
        }
      break;
    }
    case 'ears': {
      const kind = pick(r, ['long', 'round', 'pointy', 'droopy'] as const);
      for (const s of S2) {
        if (kind === 'long') under.push(E(h.x + s * h.rx * 0.4, h.y - h.ry * 1.3, hs * 0.22, hs * rr(r, 0.6, 0.95), s * rr(r, 0.05, 0.4)));
        else if (kind === 'round') under.push(C(h.x + s * h.rx * 0.68, h.y - h.ry * 0.72, hs * rr(r, 0.28, 0.38)));
        else if (kind === 'pointy') under.push(E(h.x + s * h.rx * 0.6, h.y - h.ry * 0.85, hs * 0.17, hs * 0.42, s * 0.5));
        else under.push(E(h.x + s * h.rx * 0.95, h.y + h.ry * 0.05, hs * 0.18, hs * 0.55, -s * 0.25));
      }
      break;
    }
    case 'antennae':
      for (const s of S2) {
        const a = curve(r, h.x + s * h.rx * 0.3, h.y - h.ry * 0.8, hs * rr(r, 1, 1.8), -Math.PI / 2 + s * rr(r, 0.2, 0.6), s * rr(r, -1, 1.2), 7);
        limbs.push(L(a, 0.007));
        if (r() < 0.6) over.push(C(a[a.length - 1]![0], a[a.length - 1]![1], hs * 0.13));
      }
      break;
    case 'tuft': {
      const n = ri(r, 2, 4);
      for (let i = 0; i < n; i++) {
        const t = i - (n - 1) / 2;
        under.push(E(h.x + t * h.rx * 0.22, h.y - h.ry * 1.02, hs * 0.08, hs * rr(r, 0.3, 0.5), t * 0.35));
      }
      break;
    }
    case 'mane': {
      const n = ri(r, 6, 8);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        under.push(C(h.x + Math.cos(a) * h.rx * 0.95, h.y + Math.sin(a) * h.ry * 0.95, hs * rr(r, 0.24, 0.34)));
      }
      break;
    }
    case 'crest': {
      const n = ri(r, 3, 6),
        plates = r() < 0.4;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (0.25 + (0.5 * (i + 0.5)) / n) + (side ? 0.15 : 0),
          p = edge(b, a, 0.95),
          len = Math.min(b.rx, b.ry) * rr(r, 0.35, 0.6),
          ang = a + b.rot;
        under.push(E(p[0] + Math.cos(ang) * len * 0.5, p[1] + Math.sin(ang) * len * 0.5, len * 0.6, len * (plates ? 0.4 : 0.18), ang));
      }
      break;
    }
    case 'tail': {
      const kind = pick(r, ['thin', 'tuft', 'fat', 'fish'] as const);
      const s = side ? 1 : r() < 0.5 ? -1 : 1;
      const p: Pt = side ? edge(b, rr(r, -0.4, 0.2), 0.9) : [b.x + s * b.rx * 0.75, b.y + b.ry * 0.45];
      const ang = side ? rr(r, -0.9, 0.3) : s > 0 ? rr(r, -0.6, 0.2) : Math.PI - rr(r, -0.6, 0.2);
      const len = Math.max(b.rx, b.ry) * rr(r, 0.7, 1.3);
      const a = curve(r, p[0], p[1], len, ang, s * rr(r, -2.4, 1.2), 7);
      const e = a[a.length - 1]!;
      if (kind === 'fat') under.push(...tube(a, Math.min(b.rx, b.ry) * 0.4, 0.016, 1, 5));
      else limbs.push(L(a, 0.012));
      if (kind === 'tuft') over.push(C(e[0], e[1], rr(r, 0.022, 0.035)));
      if (kind === 'fish') under.push(E(e[0], e[1] - 0.02, 0.04, 0.018, ang - 0.7), E(e[0], e[1] + 0.02, 0.04, 0.018, ang + 0.7));
      break;
    }
    case 'fins':
      if (side) under.push(E(b.x, b.y - b.ry * 1.05, b.rx * 0.45, b.ry * 0.35, 0.25, { wing: true }), E(b.x - b.rx * 0.3, b.y + b.ry * 0.75, b.rx * 0.25, b.ry * 0.3, -0.5, { wing: true }));
      else for (const s of S2) under.push(E(b.x + s * b.rx * 1.05, b.y + rr(r, -0.2, 0.3) * b.ry, b.rx * 0.35, b.ry * 0.2, s * rr(r, 0.3, 0.8), { wing: true }));
      break;
    case 'wings':
      if (side) under.push(E(b.x + b.rx * 0.1, b.y - b.ry * 1.15, b.rx * rr(r, 0.45, 0.7), b.ry * rr(r, 0.35, 0.5), rr(r, 0.2, 0.6), { wing: true }));
      else for (const s of S2) under.push(E(b.x + s * b.rx * 0.85, b.y - b.ry * 0.85, b.rx * rr(r, 0.4, 0.6), b.ry * rr(r, 0.25, 0.35), -s * rr(r, 0.4, 0.9), { wing: true }));
      break;
    case 'bumps': {
      const n = ri(r, 2, 4);
      for (let i = 0; i < n; i++) under.push(C(...edge(b, rr(r, 0, 6.28), 0.9), Math.min(b.rx, b.ry) * rr(r, 0.18, 0.32)));
      break;
    }
    case 'arms':
      for (const s of S2) {
        const a = curve(r, b.x + s * b.rx * 0.85, b.y - b.ry * rr(r, -0.2, 0.3), Math.max(b.rx, b.ry) * rr(r, 0.5, 0.9), s > 0 ? rr(r, -1, 0.6) : Math.PI - rr(r, -1, 0.6), s * rr(r, -1, 1), 5);
        limbs.push(L(a, 0.012));
        if (r() < 0.5) over.push(C(a[a.length - 1]![0], a[a.length - 1]![1], rr(r, 0.015, 0.025)));
      }
      break;
  }
}

/* ===================== Gesamtform ===================== */
function transformBlob(b: B, f: (p: Pt) => Pt, sx: number, sy: number, rot: number): B {
  const [x, y] = f([b.x, b.y]);
  const c = Math.cos(b.rot),
    s = Math.sin(b.rot);
  return { ...b, x, y, rx: b.rx * Math.hypot(sx * c, sy * s), ry: b.ry * Math.hypot(sx * s, sy * c), rot: Math.atan2(sy * s, sx * c) + rot };
}
function mapShape(g: { blobs: B[]; limbs: Limb[]; faces: FaceSpot[] }, f: (p: Pt) => Pt, sx: number, sy: number, rot: number, wk: number): void {
  g.blobs = g.blobs.map((b) => transformBlob(b, f, sx, sy, rot));
  g.limbs = g.limbs.map((l) => ({ pts: l.pts.map(f), w: l.w * wk }));
  g.faces = g.faces.map((fc) => {
    const [x, y] = f([fc.x, fc.y]);
    return { ...fc, x, y, r: fc.r * Math.sqrt(sx * sy) };
  });
}

/** Eine Form der Generation 2 für diesen Bauplan aus einem eigenen Zufall */
export function shape2(bp: BlueprintId, r: Rand): Shape2 {
  const vs = V[bp],
    v = vs[Math.floor(r() * vs.length)]!,
    c = v.build(r);
  const under: B[] = [],
    over: B[] = [],
    limbs = [...c.limbs],
    parts: PartKind[] = [];
  const n = weighted(r, [
    { v: 0, w: 2 },
    { v: 1, w: 4 },
    { v: 2, w: 3 },
    { v: 3, w: 1.5 },
  ]).v;
  const pool = c.parts.slice();
  for (let i = 0; i < n && pool.length; i++) {
    const k = pool.splice(Math.floor(r() * pool.length), 1)[0]!;
    if (HEAD_TOP.includes(k) && parts.some((p) => HEAD_TOP.includes(p))) continue;
    // Malzeit begrenzen: höchstens BLOB_MAX Kleckse, sonst fällt das Teil weg
    const u = under.length,
      o = over.length,
      l = limbs.length;
    addPart(r, k, c, under, over, limbs);
    if (c.blobs.length + under.length + over.length > BLOB_MAX) {
      under.length = u;
      over.length = o;
      limbs.length = l;
      continue;
    }
    parts.push(k);
  }
  const g = { blobs: [...under, ...c.blobs, ...over], limbs, faces: c.faces };
  // Spiegeln, Strecken, Neigen um die Mitte
  const flip = r() < 0.5 ? -1 : 1,
    sx = rr(r, 0.85, 1.2),
    sy = rr(r, 0.85, 1.2),
    tilt = rr(r, -1, 1) * (c.view === 'side' ? 0.12 : 0.07);
  const ct = Math.cos(tilt),
    st = Math.sin(tilt);
  mapShape(
    g,
    ([x, y]) => {
      const dx = (x - 0.5) * sx * flip,
        dy = (y - 0.55) * sy;
      return [0.5 + dx * ct - dy * st, 0.55 + dx * st + dy * ct];
    },
    sx,
    sy,
    0,
    1,
  );
  if (flip < 0) for (const b of g.blobs) b.rot = Math.PI - b.rot;
  for (const b of g.blobs) b.rot += tilt;
  // Einpassen: größte Ausdehnung 0,62 bis 0,8 des Blatts, Mitte leicht unter der Blattmitte
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  const grow = (x: number, y: number, hx: number, hy: number) => {
    x0 = Math.min(x0, x - hx);
    x1 = Math.max(x1, x + hx);
    y0 = Math.min(y0, y - hy);
    y1 = Math.max(y1, y + hy);
  };
  for (const b of g.blobs) {
    const c2 = Math.cos(b.rot),
      s2 = Math.sin(b.rot);
    grow(b.x, b.y, Math.hypot(b.rx * c2, b.ry * s2) * 1.15, Math.hypot(b.rx * s2, b.ry * c2) * 1.15);
  }
  for (const l of g.limbs) for (const p of l.pts) grow(p[0], p[1], l.w, l.w);
  for (const f of g.faces) grow(f.x, f.y - f.r * (f.stalks ? 0.9 : 0.4), f.r, f.r * (f.stalks ? 1.9 : 1.2));
  const size = rr(r, 0.62, 0.78),
    k = size / Math.max(x1 - x0, y1 - y0),
    mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2;
  mapShape(g, ([x, y]) => [0.5 + (x - mx) * k, 0.53 + (y - my) * k], k, k, 0, k);
  for (const l of g.limbs) l.w = Math.min(0.04, Math.max(0.005, l.w));
  // Stacheln und Hörner aus dem Gesicht (Generation 1) stören neben eigenen Kopfteilen
  const headParts = parts.some((p) => HEAD_TOP.includes(p) || p === 'crest');
  const top = g.blobs.filter((b) => g.faces.some((f) => Math.hypot(f.x - b.x, f.y - b.y) < f.r * 0.6));
  return { ...g, top, variant: v.id, parts, headParts };
}

export const SHAPE_VARIANTS: Record<BlueprintId, string[]> = Object.fromEntries(Object.entries(V).map(([k, vs]) => [k, vs.map((v) => v.id)])) as Record<BlueprintId, string[]>;
