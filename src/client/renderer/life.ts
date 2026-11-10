/*
 * Malen für „Leben“ (freigegeben am 10.11.2026, src/shared/life.ts): Figur aufs Blatt einpassen, neue Augenformen, Tuschedetails je nach Wesen
 * (Fell, Schuppen, Federn, Schraffur, Nieten, Maserung) und Füße an den Beinen. Alles mit eigenem Zufall, nur Aussehen.
 */
import type { BlobShape, Geometry, Limb } from '../../shared/data';
import { bounds, mapShape } from '../../shared/forms/kit';
import { LIFE_FIT, type Life, type Surface } from '../../shared/life';
import { gauss, ri, rr, type Rand } from '../../shared/rng';
import { drop, glint, INK, reserve, stroke } from './gen2b';
import { circlePts, poly, type P2, type P3 } from './watercolor';

type Ctx = CanvasRenderingContext2D;
type Base = { b: BlobShape; base: P3[] };
type RGBn = readonly number[];
const area = (b: BlobShape): number => b.rx * b.ry;

/**
 * Figur vergrößern, bis die längere Seite LIFE_FIT des Blatts füllt (nie verkleinern). Die Form selbst bleibt gleich.
 * Mit foot (Duell): immer auf diese Größe bringen, auch kleiner, und die Unterkante auf die Linie foot stellen
 */
export function fitGeo(g: Geometry, size = LIFE_FIT, foot?: number): Geometry {
  const s = { blobs: g.blobs, limbs: g.limbs, faces: g.faces };
  const [x0, y0, x1, y1] = bounds(s);
  const k = size / Math.max(x1 - x0, y1 - y0);
  if (!Number.isFinite(k) || k <= 0) return g;
  if (foot === undefined && !(k > 1.02)) return g;
  const mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2;
  // Mitte des Blatts, oder unten auf der Linie
  const cy = foot === undefined ? 0.52 : foot - ((y1 - y0) / 2) * k;
  mapShape(s, ([x, y]) => [0.5 + (x - mx) * k, cy + (y - my) * k], k, k, k);
  return { ...g, blobs: s.blobs, limbs: s.limbs.map((l) => ({ ...l, w: Math.min(l.w, 0.055) })), faces: s.faces };
}

/* ---------- Augen ---------- */
const arc = (x: number, y: number, rx: number, ry: number, a0: number, a1: number, n = 10): P2[] => {
  const p: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    p.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
  }
  return p;
};
function heart(x: number, y: number, s: number): P2[] {
  const p: P2[] = [];
  for (let i = 0; i < 18; i++) {
    const t = (i / 18) * Math.PI * 2;
    p.push([x + (16 * Math.sin(t) ** 3 * s) / 17, y - ((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s) / 17]);
  }
  return p;
}
/** Wimpern: drei kurze Striche am äußeren oberen Rand */
function lashes(ctx: Ctx, x: number, y: number, rx: number, ry: number, side: number, lw: number, r: Rand): void {
  const out = side < 0 ? -1 : 1;
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI / 2 + out * (0.45 + k * 0.36);
    const px = x + Math.cos(a) * rx,
      py = y + Math.sin(a) * ry;
    stroke(
      ctx,
      [
        [px, py],
        [px + Math.cos(a) * rx * 0.42 + out * rx * 0.1, py + Math.sin(a) * ry * 0.42],
      ],
      lw * 1.2,
      r,
      0.85,
    );
  }
}

/**
 * Ein Auge in einer der neuen Formen. Gibt false zurück, wenn die bisherige Form gemalt werden soll.
 * side: -1 links, 1 rechts, 0 Mitte. gx, gy: Blickrichtung
 */
export function lifeEye(ctx: Ctx, life: Life, x: number, y: number, rad: number, side: number, gx: number, gy: number, paper: string, rgb: RGBn, lw: number, r: Rand): boolean {
  if (life.wink && side > 0) {
    // Zwinkern: ein Bogen statt des Auges
    stroke(ctx, arc(x, y + rad * 0.3, rad, rad * 0.7, Math.PI, Math.PI * 2), lw * 2.1, r, 0.9);
    return true;
  }
  const st = life.eye;
  if (st === 'keep') return false;
  const iris = side > 0 && life.iris2 ? life.iris2 : life.iris;
  const col = rgb.join(',');
  if (st === 'big') {
    const R = rad * 1.18,
      ix = x + gx * R * 0.18,
      iy = y + gy * R * 0.16;
    reserve(ctx, circlePts(x, y, R, R * 1.04, 16), paper, r);
    drop(ctx, circlePts(ix, iy, R * 0.72, R * 0.76, 14), iris as number[], r, 0.9);
    drop(ctx, circlePts(ix + gx * R * 0.05, iy + gy * R * 0.05, R * 0.36, R * 0.38, 12), INK, r, 0.95);
    glint(ctx, ix - R * 0.26, iy - R * 0.28, R * 0.22, paper);
    glint(ctx, ix + R * 0.22, iy + R * 0.24, R * 0.1, paper, 0.8);
    stroke(ctx, arc(x, y, R, R * 1.04, Math.PI * 1.02, Math.PI * 1.98), lw * 2, r, 0.9);
    stroke(ctx, arc(x, y, R, R * 1.04, Math.PI * 0.2, Math.PI * 0.8, 6), lw * 0.9, r, 0.35);
    if (life.lashes) lashes(ctx, x, y, R, R * 1.04, side, lw, r);
  } else if (st === 'oval') {
    const rx = rad * 0.78,
      ry = rad * 1.32;
    reserve(ctx, circlePts(x, y, rx, ry, 16), paper, r);
    const px = x + gx * rx * 0.28,
      py = y + ry * 0.12 + gy * ry * 0.22;
    drop(ctx, circlePts(px, py, rx * 0.5, ry * 0.5, 12), INK, r, 0.95);
    glint(ctx, px - rx * 0.16, py - ry * 0.2, rx * 0.2, paper);
    stroke(ctx, [...arc(x, y, rx, ry, 0, Math.PI * 2, 18)], lw * 1.3, r, 0.8);
    if (life.lashes) lashes(ctx, x, y, rx, ry, side, lw, r);
  } else if (st === 'happy') {
    // Zusammengekniffen vor Freude: > und <
    const s = side > 0 ? -1 : 1;
    stroke(
      ctx,
      [
        [x - s * rad * 0.8, y - rad * 0.62],
        [x + s * rad * 0.55, y],
        [x - s * rad * 0.8, y + rad * 0.62],
      ],
      lw * 2.2,
      r,
      0.92,
    );
  } else if (st === 'angry') {
    reserve(ctx, circlePts(x, y, rad, rad * 0.95, 14), paper, r);
    drop(ctx, circlePts(x + gx * rad * 0.25, y + rad * 0.12 + gy * rad * 0.15, rad * 0.4, rad * 0.42, 12), INK, r, 0.95);
    glint(ctx, x + gx * rad * 0.25 - rad * 0.12, y, rad * 0.12, paper);
    // Schräges Lid: außen hoch, innen tief. In der Mitte (ein Auge) waagrecht
    const o: P2 = [x + side * rad * 1.1, y - rad * (side ? 0.78 : 0.3)],
      inn: P2 = [x - (side || 1) * rad * 1.1, y - rad * (side ? 0.02 : 0.3)];
    // Das Lid deckt nur das Auge selbst, in der Farbe des Körpers
    ctx.save();
    poly(ctx, circlePts(x, y, rad * 1.1, rad * 1.05, 16));
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(${col},.85)`;
    poly(ctx, [o, inn, [inn[0], y - rad * 1.3], [o[0], y - rad * 1.3]]);
    ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    stroke(ctx, [o, [(o[0] + inn[0]) / 2, (o[1] + inn[1]) / 2], inn], lw * 2.4, r, 0.92);
    stroke(ctx, arc(x, y, rad, rad * 0.95, Math.PI * 0.15, Math.PI * 0.85, 6), lw * 0.9, r, 0.4);
  } else if (st === 'cat') {
    const top: P2[] = [],
      bottom: P2[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = -1 + i / 5;
      top.push([x + t * rad * 1.2, y - rad * 0.86 * (1 - t * t) - side * t * rad * 0.12]);
      bottom.push([x + t * rad * 1.2, y + rad * 0.62 * (1 - t * t) - side * t * rad * 0.12]);
    }
    const shape = [...top, ...bottom.slice(1, -1).reverse()];
    reserve(ctx, shape, paper, r);
    drop(ctx, circlePts(x + gx * rad * 0.15, y - rad * 0.08, rad * 0.62, rad * 0.66, 14), iris as number[], r, 0.9);
    drop(ctx, circlePts(x + gx * rad * 0.2, y - rad * 0.08, rad * 0.13, rad * 0.56, 12), INK, r, 0.95);
    glint(ctx, x - rad * 0.3, y - rad * 0.32, rad * 0.16, paper);
    stroke(ctx, top, lw * 1.9, r, 0.9);
    stroke(ctx, bottom.slice(2, -2), lw * 0.9, r, 0.4);
    if (life.lashes) lashes(ctx, x, y, rad * 1.1, rad * 0.8, side, lw, r);
  } else if (st === 'goat') {
    reserve(ctx, circlePts(x, y, rad, rad * 0.98, 14), paper, r);
    drop(ctx, circlePts(x, y, rad * 0.78, rad * 0.78, 14), iris as number[], r, 0.9);
    drop(ctx, circlePts(x + gx * rad * 0.1, y, rad * 0.52, rad * 0.17, 12), INK, r, 0.95);
    glint(ctx, x - rad * 0.3, y - rad * 0.34, rad * 0.16, paper);
    stroke(ctx, arc(x, y, rad, rad * 0.98, Math.PI * 1.02, Math.PI * 1.98), lw * 1.8, r, 0.9);
    if (life.lashes) lashes(ctx, x, y, rad, rad, side, lw, r);
  } else if (st === 'dots') {
    drop(ctx, circlePts(x, y, rad * 0.46, rad * 0.5, 12), INK, r, 0.95);
    glint(ctx, x - rad * 0.14, y - rad * 0.16, rad * 0.14, paper);
  } else if (st === 'cross') {
    for (const s of [-1, 1])
      stroke(
        ctx,
        [
          [x - rad * 0.7, y - s * rad * 0.7],
          [x, y],
          [x + rad * 0.7, y + s * rad * 0.7],
        ],
        lw * 2,
        r,
        0.9,
      );
  } else {
    // Herzaugen
    reserve(ctx, circlePts(x, y, rad * 1.1, rad * 1.08, 16), paper, r);
    drop(ctx, heart(x + gx * rad * 0.1, y + rad * 0.02, rad * 0.78), '208,52,86', r, 0.92);
    glint(ctx, x - rad * 0.3, y - rad * 0.26, rad * 0.16, paper);
    stroke(ctx, arc(x, y, rad * 1.1, rad * 1.08, Math.PI * 1.02, Math.PI * 1.98), lw * 1.8, r, 0.9);
    if (life.lashes) lashes(ctx, x, y, rad * 1.1, rad * 1.08, side, lw, r);
  }
  return true;
}

/* ---------- Tuschedetails ---------- */
const boxOf = (p: P3[]): [number, number, number, number] => {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const q of p) {
    x0 = Math.min(x0, q[0]);
    y0 = Math.min(y0, q[1]);
    x1 = Math.max(x1, q[0]);
    y1 = Math.max(y1, q[1]);
  }
  return [x0, y0, x1, y1];
};
const mid = (p: P3[]): [number, number] => [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];
/**
 * Farbe der Striche: Tusche, auf dunklen Flächen ausgehobene helle Linien (LIFT wird je Teil gesetzt, null: Tusche).
 * INK erst beim Malen lesen: gen2b.ts und diese Datei laden sich gegenseitig, beim Laden ist INK noch nicht da
 */
let LIFT: string | null = null;
/** Grundfarbe der Striche, wenn nicht Tusche (Entwurf „Gemälde“: Bleistift). null: Tusche */
let BASE: string | null = null;
export function penBase(rgb: string | null): void {
  BASE = rgb;
}
const pen = (): string => LIFT ?? BASE ?? INK;
function line(ctx: Ctx, pts: P2[], w: number, a: number): void {
  ctx.strokeStyle = `rgba(${pen()},${a})`;
  ctx.lineWidth = w;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.stroke();
}

/** Oberfläche: feine Tuschestriche, die sagen, woraus das Wesen ist. Nur auf den großen Teilen */
export function surface(ctx: Ctx, bases: Base[], core: Base, kind: Surface, S: number, r: Rand, paper = '250,247,240', dark: (o: Base) => boolean = () => false): void {
  if (kind === 'none') return;
  const lw = S / 300,
    big = area(core.b) * 0.22;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const o of bases) {
    if (area(o.b) < big || o.b.leaf || o.b.bare) continue;
    // Auf dunkler Farbe wäre Tusche nicht zu sehen: dort helle, ausgehobene Linien
    const lift = dark(o);
    LIFT = lift ? paper : null;
    ctx.globalCompositeOperation = lift ? 'source-over' : 'multiply';
    const [x0, y0, x1, y1] = boxOf(o.base),
      [cx, cy] = mid(o.base),
      w = x1 - x0,
      h = y1 - y0;
    if (kind === 'fur') {
      // Kurze Striche über den Rand hinaus, alle in eine Richtung gekämmt, dazu ein paar Büschel innen
      const comb = rr(r, -0.6, 0.6);
      for (let i = 0; i < o.base.length; i += 2) {
        if (r() < 0.3) continue;
        const p = o.base[i]!,
          d = Math.atan2(p[1] - cy, p[0] - cx) + comb,
          len = S * rr(r, 0.012, 0.024);
        line(
          ctx,
          [
            [p[0] - Math.cos(d) * len * 0.3, p[1] - Math.sin(d) * len * 0.3],
            [p[0] + Math.cos(d) * len * 0.7, p[1] + Math.sin(d) * len * 0.7],
          ],
          lw * rr(r, 0.6, 0.95),
          0.62,
        );
      }
      for (let k = 0, n = ri(r, 4, 8); k < n; k++) {
        const px = cx + gauss(r) * w * 0.2,
          py = cy + gauss(r) * h * 0.2,
          d = Math.PI / 2 + comb + rr(r, -0.3, 0.3);
        for (let j = -1; j <= 1; j++) {
          const len = S * rr(r, 0.012, 0.02);
          line(
            ctx,
            [
              [px + j * S * 0.008, py],
              [px + j * S * 0.008 + Math.cos(d + j * 0.25) * len, py + Math.sin(d + j * 0.25) * len],
            ],
            lw * 0.7,
            0.52,
          );
        }
      }
      continue;
    }
    if (kind === 'rivets') {
      // Nieten am Rand entlang, dazu eine Naht quer
      for (let i = 0; i < o.base.length; i += 5) {
        const p = o.base[i]!,
          d = Math.atan2(cy - p[1], cx - p[0]),
          px = p[0] + Math.cos(d) * S * 0.018,
          py = p[1] + Math.sin(d) * S * 0.018;
        ctx.strokeStyle = `rgba(${pen()},.6)`;
        ctx.lineWidth = lw * 0.6;
        ctx.beginPath();
        ctx.arc(px, py, S * 0.0055, 0, 7);
        ctx.stroke();
      }
      ctx.save();
      poly(ctx, o.base);
      ctx.clip();
      const a = rr(r, -0.3, 0.3) + (r() < 0.5 ? Math.PI / 2 : 0),
        dx = Math.cos(a),
        dy = Math.sin(a),
        L = Math.hypot(w, h);
      for (const off of [-0.18, 0.18]) {
        const ox = cx - dy * L * off,
          oy = cy + dx * L * off;
        line(
          ctx,
          [
            [ox - dx * L, oy - dy * L],
            [ox + dx * L, oy + dy * L],
          ],
          lw * 0.8,
          0.46,
        );
      }
      ctx.restore();
      continue;
    }
    // Alles Übrige liegt innerhalb der Fläche
    ctx.save();
    poly(ctx, o.base);
    ctx.clip();
    if (kind === 'scales' || kind === 'feathers') {
      const u = S * (kind === 'scales' ? 0.03 : 0.036),
        tall = kind === 'scales' ? 0.55 : 1.05;
      // Ein unregelmäßiger Bereich, nicht die ganze Fläche
      const px = cx + gauss(r) * w * 0.1,
        py = cy + gauss(r) * h * 0.1,
        rx = w * rr(r, 0.3, 0.46),
        ry = h * rr(r, 0.3, 0.46);
      for (let row = 0, y = y0; y < y1; y += u * 0.72, row++)
        for (let x = x0 + (row % 2 ? u / 2 : 0); x < x1; x += u) {
          const q = ((x - px) / rx) ** 2 + ((y - py) / ry) ** 2;
          if (q > 1 || r() < 0.12) continue;
          ctx.strokeStyle = `rgba(${pen()},${0.46 * (1 - q * 0.6)})`;
          ctx.lineWidth = lw * 0.75;
          ctx.beginPath();
          ctx.ellipse(x, y, u * 0.5, u * 0.5 * tall, 0, 0.1, Math.PI - 0.1);
          ctx.stroke();
          if (kind === 'feathers') line(ctx, [[x, y], [x, y + u * 0.5]], lw * 0.55, 0.36);
        }
    } else if (kind === 'hatch') {
      // Schraffur auf der Schattenseite
      const a = rr(r, 0.7, 1.1),
        dx = Math.cos(a),
        dy = Math.sin(a),
        step = S * 0.013;
      for (let t = -w; t < w; t += step) {
        const bx = cx + w * 0.12 + t * dy * -1,
          by = cy + h * 0.2 + t * dx;
        const len = Math.min(w, h) * rr(r, 0.16, 0.3);
        line(
          ctx,
          [
            [bx - dx * len, by - dy * len],
            [bx + dx * len, by + dy * len],
          ],
          lw * 0.6,
          0.36,
        );
      }
    } else {
      // Maserung: wellige Linien entlang der langen Seite
      const long = w >= h;
      for (let k = 0, n = ri(r, 4, 7); k < n; k++) {
        const t = (k + 0.5) / n,
          ph = r() * 6,
          amp = S * rr(r, 0.004, 0.01),
          p: P2[] = [];
        for (let i = 0; i <= 16; i++) {
          const s = i / 16,
            wob = Math.sin(s * rr(r, 7.5, 8.5) + ph) * amp;
          p.push(long ? [x0 + s * w, y0 + t * h + wob] : [x0 + t * w + wob, y0 + s * h]);
        }
        line(ctx, p, lw * 0.7, 0.4);
      }
    }
    ctx.restore();
  }
  LIFT = null;
  ctx.restore();
}

/** Füße: an Gliedern, die nach unten enden, drei kurze Zehen */
export function feet(ctx: Ctx, limbs: Limb[], figure: [number, number, number, number], S: number, r: Rand): void {
  const cx = (figure[0] + figure[2]) / 2,
    cy = (figure[1] + figure[3]) / 2,
    lw = S / 300;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';
  for (const l of limbs) {
    const a = l.pts[0]!,
      z = l.pts[l.pts.length - 1]!;
    const far = Math.hypot(a[0] * S - cx, a[1] * S - cy) > Math.hypot(z[0] * S - cx, z[1] * S - cy);
    const [from, tip] = far ? [z, a] : [a, z];
    // Nur Beine: das Ende liegt tiefer als der Ansatz und in der unteren Hälfte der Figur
    if (tip[1] < from[1] + 0.03 || tip[1] * S < cy) continue;
    const x = tip[0] * S,
      y = tip[1] * S,
      len = Math.max(l.w * S * 0.9, S * 0.012),
      dir = tip[0] >= from[0] ? 1 : -1;
    for (let k = -1; k <= 1; k++) {
      const ang = Math.PI / 2 - dir * 0.5 + k * 0.5;
      line(
        ctx,
        [
          [x, y],
          [x + Math.cos(ang) * len * rr(r, 0.9, 1.2), y + Math.sin(ang) * len * 0.75],
        ],
        lw * 1.1,
        0.72,
      );
    }
  }
  ctx.restore();
}
