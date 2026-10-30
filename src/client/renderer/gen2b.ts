/*
 * Generation 2b im Renderer: Muster, Gesichter und neue Malereignisse. Nur für Generation 2,
 * Generation 1 malt weiter genau wie der Prototyp (watercolor.ts ruft das hier nur mit einem Look auf).
 */
import type { BlobShape, FaceSpot, Geometry } from '../../shared/data';
import type { Look, Pattern } from '../../shared/look';
import { clamp, gauss, ri, rr, type Rand } from '../../shared/rng';
import { circlePts, deformN, inkPath, poly, smooth, type P2, type P3 } from './watercolor';

type Ctx = CanvasRenderingContext2D;
type RGBn = readonly number[];
const INK = '28,25,36';
const darker = (c: RGBn, f = 0.6) => c.map((v) => Math.round(v * f)).join(',');

function bbox(polys: P3[][]): [number, number, number, number] {
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const p of polys)
    for (const [x, y] of p) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  return [x0, y0, x1, y1];
}
const area = (b: BlobShape) => b.rx * b.ry;

/** Welche Teile das Muster bekommt: alle oder eines der großen */
export function patternParts(bases: { b: BlobShape; base: P3[] }[], p: Pattern): P3[][] {
  const real = bases.filter((o) => !o.b.leaf);
  if (p.part === null) return real.map((o) => o.base);
  const big = Math.max(...real.map((o) => area(o.b)));
  const cand = real.filter((o) => area(o.b) >= big * 0.15);
  return [cand[Math.floor(p.part * cand.length) % cand.length]!.base];
}

/* ---------- Muster: nur innerhalb der Flächen, wie mit dem Pinsel hineingesetzt ---------- */
export function drawPattern(ctx: Ctx, polys: P3[][], p: Pattern, rgb: RGBn, S: number, r: Rand): void {
  if (!polys.length) return;
  const [x0, y0, x1, y1] = bbox(polys);
  const w = x1 - x0,
    h = y1 - y0,
    cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2,
    diag = Math.hypot(w, h),
    lw = S / 300;
  ctx.save();
  ctx.beginPath();
  for (const q of polys) {
    ctx.moveTo(q[0]![0], q[0]![1]);
    for (let i = 1; i < q.length; i++) ctx.lineTo(q[i]![0], q[i]![1]);
    ctx.closePath();
  }
  ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  const col = (a: number) => `rgba(${rgb.join(',')},${a * p.amt})`;
  const blob = (x: number, y: number, rad: number, a: number) => {
    ctx.fillStyle = col(a);
    poly(ctx, deformN(circlePts(x, y, rad, rad * rr(r, 0.75, 1.15), 8).map((q): P3 => [q[0], q[1], rr(r, 0.7, 1.3)]), r, 0.3, 2));
    ctx.fill();
  };
  // Achsen entlang des Musterwinkels
  const ux = Math.cos(p.angle),
    uy = Math.sin(p.angle),
    vx = -uy,
    vy = ux;
  switch (p.k) {
    case 'spots': {
      const rad = rr(r, 0.022, 0.045) * S * p.scale;
      const n = clamp(Math.round(((w * h) / (rad * rad)) * 0.18), 4, 60);
      for (let i = 0; i < n; i++) {
        const x = x0 + r() * w,
          y = y0 + r() * h,
          s = rad * rr(r, 0.55, 1.3);
        blob(x, y, s, 0.46);
        if (r() < 0.4) blob(x + gauss(r) * s * 0.2, y + gauss(r) * s * 0.2, s * 0.6, 0.32);
      }
      break;
    }
    case 'stripes':
    case 'bands': {
      const gap = (p.k === 'bands' ? rr(r, 0.09, 0.14) : rr(r, 0.045, 0.075)) * S * p.scale;
      const width = gap * (p.k === 'bands' ? rr(r, 0.25, 0.4) : rr(r, 0.35, 0.55));
      const bands = p.k === 'bands' ? ri(r, 2, 4) : Math.ceil(diag / gap) + 2;
      const start = p.k === 'bands' ? -gap * (bands - 1) * 0.5 : -diag / 2 - gap * rr(r, 0, 1);
      for (let i = 0; i < bands; i++) {
        const off = start + i * gap;
        // Ein Band: zwei wellige Kanten quer über die Fläche
        const n = 10,
          a: P2[] = [],
          b: P2[] = [];
        for (let k = 0; k <= n; k++) {
          const t = -diag / 2 + (diag * k) / n,
            wob = Math.sin(k * 1.3 + i) * width * 0.25 + gauss(r) * width * 0.08;
          a.push([cx + ux * t + vx * (off + wob), cy + uy * t + vy * (off + wob)]);
          b.push([cx + ux * t + vx * (off + wob + width * rr(r, 0.8, 1.2)), cy + uy * t + vy * (off + wob + width * rr(r, 0.8, 1.2))]);
        }
        ctx.fillStyle = col(p.k === 'bands' ? 0.48 : 0.4);
        poly(ctx, [...a, ...b.reverse()]);
        ctx.fill();
      }
      break;
    }
    case 'rings': {
      const gap = rr(r, 0.035, 0.06) * S * p.scale;
      const ox = cx + gauss(r) * w * 0.15,
        oy = cy + gauss(r) * h * 0.15;
      ctx.lineWidth = gap * 0.38;
      for (let rad = gap; rad < diag; rad += gap) {
        ctx.strokeStyle = col(0.42);
        poly(ctx, deformN(circlePts(ox, oy, rad, rad * 0.85, 14).map((q): P3 => [q[0], q[1], 1]), r, 0.06, 2));
        ctx.stroke();
      }
      break;
    }
    case 'speckle': {
      const n = Math.round(ri(r, 120, 320) * p.scale);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = col(rr(r, 0.5, 0.9));
        ctx.beginPath();
        ctx.arc(x0 + r() * w, y0 + r() * h, lw * rr(r, 0.4, 1.7), 0, 7);
        ctx.fill();
      }
      break;
    }
    case 'fade': {
      const g = ctx.createLinearGradient(cx - vx * diag * 0.5, cy - vy * diag * 0.5, cx + vx * diag * 0.5, cy + vy * diag * 0.5);
      g.addColorStop(0, col(0));
      g.addColorStop(rr(r, 0.35, 0.6), col(0.18));
      g.addColorStop(1, col(0.65));
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, w, h);
      break;
    }
    case 'marble': {
      const veins = ri(r, 3, 6);
      for (let v = 0; v < veins; v++) {
        let x = x0 + r() * w,
          y = y0 + r() * h,
          a = r() * 6.28;
        const pts: P2[] = [[x, y]];
        for (let k = 0; k < 14; k++) {
          a += gauss(r) * 0.6;
          x += Math.cos(a) * diag * 0.06;
          y += Math.sin(a) * diag * 0.06;
          pts.push([x, y]);
        }
        ctx.lineCap = ctx.lineJoin = 'round';
        ctx.strokeStyle = col(0.18);
        ctx.lineWidth = lw * rr(r, 3, 5);
        smooth(ctx, pts);
        ctx.stroke();
        ctx.strokeStyle = col(0.65);
        ctx.lineWidth = lw * rr(r, 0.8, 1.8);
        smooth(ctx, pts);
        ctx.stroke();
      }
      break;
    }
    case 'check': {
      const s = rr(r, 0.045, 0.075) * S * p.scale;
      const n = Math.ceil(diag / s) + 1;
      ctx.translate(cx, cy);
      ctx.rotate(p.angle * 0.3);
      for (let i = -n; i <= n; i++)
        for (let j = -n; j <= n; j++)
          if ((i + j) % 2 === 0) {
            ctx.fillStyle = col(rr(r, 0.26, 0.36));
            ctx.fillRect(i * s + gauss(r) * s * 0.03, j * s + gauss(r) * s * 0.03, s * rr(r, 0.92, 1.02), s * rr(r, 0.92, 1.02));
          }
      break;
    }
  }
  ctx.restore();
}

/* ---------- Malereignisse der Generation 2 (nur Aussehen) ---------- */

/** Weiche Blüte: helles Inneres mit Blumenkohlrand, statt der Splitter der Generation 1 */
export function bloom2(ctx: Ctx, core: BlobShape, S: number, rgb: RGBn, paper: string, r: Rand): void {
  const x = (core.x + gauss(r) * Math.min(core.rx, 0.16) * 0.25) * S,
    y = (core.y + gauss(r) * Math.min(core.ry, 0.16) * 0.25) * S,
    rad = clamp(Math.min(core.rx, core.ry), 0.05, 0.16) * S * rr(r, 0.45, 0.7);
  const lobes = ri(r, 9, 15),
    ph = r() * 6.28,
    pts: P2[] = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    // Blumenkohl: viele runde Ausbuchtungen, leicht unregelmäßig
    const bump = Math.abs(Math.sin(a * lobes * 0.5 + ph)) * 0.14 + gauss(r) * 0.015;
    pts.push([x + Math.cos(a) * rad * (0.9 + bump), y + Math.sin(a) * rad * (0.9 + bump) * rr(r, 0.97, 1.03)]);
  }
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, `rgba(${paper},.5)`);
  g.addColorStop(0.75, `rgba(${paper},.32)`);
  g.addColorStop(1, `rgba(${paper},.12)`);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = g;
  poly(ctx, pts);
  ctx.fill();
  ctx.globalCompositeOperation = 'multiply';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(${darker(rgb, 0.6)},.38)`;
  ctx.lineWidth = (S / 300) * 1.3;
  smooth(ctx, [...pts, pts[0]!, pts[1]!]);
  ctx.stroke();
}

/** Läufer: Farbe läuft an den unteren Rändern in Tropfspuren nach unten */
export function runs(ctx: Ctx, bases: { b: BlobShape; base: P3[] }[], rgb: RGBn, S: number, r: Rand): void {
  const big = [...bases].filter((o) => !o.b.leaf).sort((a, b) => area(b.b) - area(a.b));
  const lw = S / 300;
  ctx.globalCompositeOperation = 'multiply';
  ctx.lineCap = 'round';
  for (const o of big.slice(0, ri(r, 2, 4))) {
    const pts = [...o.base].sort((a, b) => b[1] - a[1]).slice(0, 12);
    for (let k = 0, n = ri(r, 1, 3); k < n; k++) {
      const [x, y] = pts[Math.floor(r() * pts.length)]!;
      const len = rr(r, 0.04, 0.12) * S,
        wd = lw * rr(r, 1.6, 3.4);
      ctx.strokeStyle = `rgba(${rgb.join(',')},.34)`;
      ctx.lineWidth = wd;
      ctx.beginPath();
      ctx.moveTo(x, y - wd);
      ctx.quadraticCurveTo(x + gauss(r) * wd, y + len * 0.5, x + gauss(r) * wd * 0.5, y + len);
      ctx.stroke();
      ctx.fillStyle = `rgba(${rgb.join(',')},.42)`;
      ctx.beginPath();
      ctx.ellipse(x, y + len + wd * 0.3, wd * 0.85, wd * 1.05, 0, 0, 7);
      ctx.fill();
    }
  }
}

/** Spritzerkranz: feine Spritzer rund um das Monster */
export function splatter(ctx: Ctx, polys: P3[][], rgb: RGBn, S: number, r: Rand): void {
  const [x0, y0, x1, y1] = bbox(polys);
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2,
    rad = Math.max(x1 - x0, y1 - y0) * 0.5,
    lw = S / 300;
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0, n = ri(r, 25, 60); i < n; i++) {
    const a = r() * 6.28,
      d = rad * rr(r, 0.85, 1.35),
      s = r() < 0.12 ? lw * rr(r, 2.5, 5) : lw * rr(r, 0.5, 1.8);
    ctx.fillStyle = `rgba(${rgb.join(',')},${rr(r, 0.35, 0.8)})`;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, s * rr(r, 0.7, 1), a, 0, 7);
    ctx.fill();
  }
}

/** Wasserrand: dunkler, harter Rand, wo die Farbe getrocknet ist */
export function tide(ctx: Ctx, bases: { b: BlobShape; base: P3[] }[], rgb: RGBn, S: number, r: Rand): void {
  const big = Math.max(...bases.map((o) => area(o.b)));
  ctx.globalCompositeOperation = 'multiply';
  ctx.lineJoin = 'round';
  for (const o of bases) {
    if (o.b.leaf || area(o.b) < big * 0.2) continue;
    ctx.strokeStyle = `rgba(${darker(rgb, 0.65)},.3)`;
    ctx.lineWidth = (S / 300) * rr(r, 1.3, 2.2);
    poly(ctx, deformN(o.base, r, 0.04, 1));
    ctx.stroke();
  }
}

/** Ausgehobene Lichter: helle Tupfer, als hätte jemand mit Papier Farbe abgenommen */
export function lifted(ctx: Ctx, core: BlobShape, S: number, paper: string, r: Rand): void {
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0, n = ri(r, 3, 7); i < n; i++) {
    const x = (core.x + gauss(r) * core.rx * 0.45) * S,
      y = (core.y + gauss(r) * core.ry * 0.45) * S,
      rad = rr(r, 0.018, 0.045) * S;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${paper},.55)`);
    g.addColorStop(0.6, `rgba(${paper},.3)`);
    g.addColorStop(1, `rgba(${paper},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * rr(r, 0.6, 1), r() * 3, 0, 7);
    ctx.fill();
  }
}

/* ---------- Gesichter der Generation 2 ---------- */
/** Lage vieler Augen (in Gesichtsradien vom Augenpunkt): eine oder zwei Reihen */
const MANY: Record<number, [number, number][]> = {
  3: [
    [-0.38, 0.02],
    [0, -0.2],
    [0.38, 0.02],
  ],
  4: [
    [-0.45, 0.04],
    [-0.16, -0.16],
    [0.16, -0.16],
    [0.45, 0.04],
  ],
  5: [
    [-0.2, -0.26],
    [0.2, -0.26],
    [-0.4, 0.04],
    [0, 0.02],
    [0.4, 0.04],
  ],
  6: [
    [-0.34, -0.24],
    [0, -0.28],
    [0.34, -0.24],
    [-0.36, 0.04],
    [0, 0.04],
    [0.36, 0.04],
  ],
  7: [
    [-0.3, -0.27],
    [0, -0.3],
    [0.3, -0.27],
    [-0.45, 0.03],
    [-0.15, 0.04],
    [0.15, 0.04],
    [0.45, 0.03],
  ],
};
export function drawFace2(ctx: Ctx, look: Look, geo: Geometry, S: number, r: Rand, paper: string, rgb: RGBn): void {
  const lw = S / 300,
    e = look.eyes,
    col = rgb.join(',');
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = ctx.lineJoin = 'round';

  const pupil = (x: number, y: number, rad: number) => {
    ctx.fillStyle = `rgba(${INK},.92)`;
    if (e.pupil === 'star') {
      const p: P2[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5,
          q = i % 2 ? rad * 0.45 : rad;
        p.push([x + Math.cos(a) * q, y + Math.sin(a) * q]);
      }
      poly(ctx, p);
      ctx.fill();
    } else if (e.pupil === 'spiral') {
      const p: P2[] = [];
      for (let i = 0; i <= 24; i++) {
        const a = i * 0.55,
          q = (rad * i) / 24;
        p.push([x + Math.cos(a) * q, y + Math.sin(a) * q]);
      }
      inkPath(ctx, p, lw * 0.8, r, 0.9);
    } else if (e.pupil === 'ring') {
      ctx.strokeStyle = `rgba(${INK},.9)`;
      ctx.lineWidth = rad * 0.4;
      ctx.beginPath();
      ctx.arc(x, y, rad * 0.75, 0, 7);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, 7);
      ctx.fill();
    }
  };

  /** Ein Auge. side: -1 links, 1 rechts, 0 Mitte (für Schielen und Brauen) */
  const eye = (x: number, y: number, rad: number, side: number) => {
    const gx = e.cross ? -side * 0.8 : e.gaze[0],
      gy = e.cross ? 0.2 : e.gaze[1];
    if (e.shape === 'closed') {
      const p: P2[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        p.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.7 + rad * 0.3]);
      }
      inkPath(ctx, p, lw * 1.1, r);
      return;
    }
    if (e.shape === 'button') {
      ctx.fillStyle = `rgba(${INK},.92)`;
      ctx.beginPath();
      ctx.arc(x, y, rad * 0.55, 0, 7);
      ctx.fill();
      ctx.fillStyle = `rgb(${paper})`;
      ctx.beginPath();
      ctx.arc(x - rad * 0.18, y - rad * 0.2, rad * 0.16, 0, 7);
      ctx.fill();
      return;
    }
    const sq = e.shape === 'almond' ? 0.6 : e.shape === 'slit' ? 0.7 : 1;
    // Weißes Auge mit Tuschekontur
    ctx.fillStyle = `rgb(${paper})`;
    let outline: P2[];
    if (e.shape === 'almond') {
      // Linse mit spitzen Enden: oben und unten je ein Bogen
      outline = [];
      for (let i = 0; i <= 10; i++) {
        const t = -1 + i / 5;
        outline.push([x + t * rad * 1.15, y - rad * sq * 1.3 * (1 - t * t)]);
      }
      for (let i = 9; i >= 1; i--) {
        const t = -1 + i / 5;
        outline.push([x + t * rad * 1.15, y + rad * sq * 1.1 * (1 - t * t)]);
      }
    } else outline = circlePts(x, y, rad, rad * sq, 22);
    poly(ctx, outline);
    ctx.fill();
    if (e.shape === 'shiny') {
      // Große Iris in der eigenen Farbe, zwei Glanzpunkte (Anime-Art)
      ctx.fillStyle = `rgba(${darker(rgb, 0.7)},.85)`;
      ctx.beginPath();
      ctx.ellipse(x + gx * rad * 0.15, y + gy * rad * 0.15, rad * 0.68, rad * 0.78, 0, 0, 7);
      ctx.fill();
      pupil(x + gx * rad * 0.18, y + gy * rad * 0.18, rad * 0.36);
      ctx.fillStyle = `rgb(${paper})`;
      ctx.beginPath();
      ctx.arc(x - rad * 0.28, y - rad * 0.3, rad * 0.2, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + rad * 0.22, y + rad * 0.25, rad * 0.09, 0, 7);
      ctx.fill();
    } else if (e.shape === 'slit') {
      ctx.fillStyle = `rgba(${INK},.92)`;
      ctx.beginPath();
      ctx.ellipse(x + gx * rad * 0.25, y, rad * 0.13, rad * 0.55, 0, 0, 7);
      ctx.fill();
    } else {
      pupil(x + gx * rad * 0.3, y + gy * rad * 0.28 * sq, rad * (e.shape === 'almond' ? 0.36 : 0.44));
      if (e.pupil === 'dot') {
        ctx.fillStyle = `rgb(${paper})`;
        ctx.beginPath();
        ctx.arc(x + gx * rad * 0.3 - rad * 0.12, y + gy * rad * 0.28 * sq - rad * 0.14, rad * 0.1, 0, 7);
        ctx.fill();
      }
    }
    inkPath(ctx, outline, lw, r, 0.9, true);
    if (e.shape === 'sleepy') {
      // Halb geschlossenes Lid in der eigenen Farbe
      ctx.fillStyle = `rgba(${col},.85)`;
      ctx.beginPath();
      ctx.ellipse(x, y, rad * 1.05, rad * 1.05, 0, Math.PI, 2 * Math.PI);
      ctx.fill();
      inkPath(
        ctx,
        [
          [x - rad * 1.05, y],
          [x, y + rad * 0.1],
          [x + rad * 1.05, y],
        ],
        lw,
        r,
        0.9,
      );
    }
  };

  const brow = (x: number, y: number, rad: number, side: number) => {
    if (!look.brows) return;
    const top = y - rad * 1.45,
      inner = side === 0 ? 0 : -side;
    let p: P2[];
    if (look.brows === 'angry')
      p = [
        [x - rad, top - (inner < 0 ? -rad * 0.35 : rad * 0.2)],
        [x + rad, top - (inner > 0 ? -rad * 0.35 : rad * 0.2)],
      ];
    else if (look.brows === 'worried')
      p = [
        [x - rad, top + (inner < 0 ? -rad * 0.35 : rad * 0.15)],
        [x + rad, top + (inner > 0 ? -rad * 0.35 : rad * 0.15)],
      ];
    else if (look.brows === 'raised')
      p = [
        [x - rad, top + rad * 0.05],
        [x, top - rad * 0.4],
        [x + rad, top + rad * 0.05],
      ];
    else
      p = [
        [x - rad, top + rad * 0.45],
        [x + rad, top + rad * 0.45],
      ];
    inkPath(ctx, p, lw * 1.4, r, 0.9, false, look.brows !== 'raised');
  };

  const mouth = (X: number, my: number, R: number) => {
    const m = look.mouth;
    const smile = (w: number, d: number): P2[] => [
      [X - R * w, my - R * 0.04],
      [X, my + R * d],
      [X + R * w, my - R * 0.04],
    ];
    if (m === 'smile') inkPath(ctx, smile(0.28, 0.12), lw, r);
    else if (m === 'grin') {
      const a: P2[] = [];
      for (let i = 0; i <= 10; i++) a.push([X - R * 0.4 + (R * 0.8 * i) / 10, my - R * 0.05 + Math.sin((i / 10) * Math.PI) * R * 0.24]);
      ctx.fillStyle = `rgba(${INK},.8)`;
      poly(ctx, a);
      ctx.fill();
      ctx.fillStyle = 'rgba(214,92,112,.85)';
      ctx.beginPath();
      ctx.ellipse(X, my + R * 0.11, R * 0.13, R * 0.06, 0, 0, 7);
      ctx.fill();
    } else if (m === 'teeth') {
      const p: P2[] = [];
      for (let i = 0; i <= 7; i++) p.push([X - R * 0.32 + (R * 0.64 * i) / 7, my + (i % 2 ? R * 0.09 : 0)]);
      inkPath(ctx, p, lw, r, 0.85, false, true);
    } else if (m === 'tongue') {
      ctx.fillStyle = 'rgba(214,92,112,.85)';
      ctx.beginPath();
      ctx.ellipse(X + R * 0.05, my + R * 0.15, R * 0.09, R * 0.12, 0.2, 0, 7);
      ctx.fill();
      inkPath(ctx, smile(0.28, 0.1), lw, r);
    } else if (m === 'tusks' || m === 'fangs') {
      inkPath(ctx, m === 'tusks' ? smile(0.32, 0.08) : smile(0.26, 0.02), lw, r);
      [-1, 1].forEach((s) => {
        const bx = X + s * R * (m === 'tusks' ? 0.24 : 0.1),
          by = my + R * (m === 'tusks' ? 0.02 : 0.0);
        const p: P2[] =
          m === 'tusks'
            ? [
                [bx - R * 0.05, by],
                [bx + s * R * 0.02, by - R * 0.22],
                [bx + R * 0.05, by],
              ]
            : [
                [bx - R * 0.045, by],
                [bx, by + R * 0.14],
                [bx + R * 0.045, by],
              ];
        ctx.fillStyle = `rgb(${paper})`;
        poly(ctx, p);
        ctx.fill();
        inkPath(ctx, p, lw * 0.8, r, 0.85, false, true);
      });
    } else if (m === 'o') {
      ctx.fillStyle = `rgba(${INK},.55)`;
      ctx.beginPath();
      ctx.ellipse(X, my + R * 0.05, R * 0.08, R * 0.1, 0, 0, 7);
      ctx.fill();
      inkPath(ctx, circlePts(X, my + R * 0.05, R * 0.08, R * 0.1, 14), lw, r, 0.9, true);
    } else if (m === 'zigzag') {
      const p: P2[] = [];
      for (let i = 0; i <= 6; i++) p.push([X - R * 0.28 + (R * 0.56 * i) / 6, my + (i % 2 ? -R * 0.05 : R * 0.05)]);
      inkPath(ctx, p, lw, r, 0.85, false, true);
    } else if (m === 'beak') {
      const p: P2[] = [
        [X - R * 0.2, my - R * 0.08],
        [X + R * 0.2, my - R * 0.08],
        [X, my + R * 0.22],
      ];
      ctx.fillStyle = 'rgba(214,150,40,.75)';
      poly(ctx, p);
      ctx.fill();
      inkPath(ctx, [...p, p[0]!], lw, r, 0.9, false, true);
    }
  };

  geo.faces.forEach((f: FaceSpot) => {
    const X = f.x * S,
      Y = f.y * S,
      R = f.r * S,
      ey = Y - R * 0.12;
    // Wangen zuerst, damit Augen und Mund darüber liegen
    if (look.cheeks === 'blush') {
      ctx.globalCompositeOperation = 'multiply';
      [-1, 1].forEach((s) => {
        ctx.fillStyle = 'rgba(226,118,128,.32)';
        ctx.beginPath();
        ctx.ellipse(X + s * R * 0.55, Y + R * 0.18, R * 0.16, R * 0.09, 0, 0, 7);
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
    } else if (look.cheeks === 'freckles')
      [-1, 1].forEach((s) => {
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = `rgba(${INK},.5)`;
          ctx.beginPath();
          ctx.arc(X + s * R * (0.52 + rr(r, -0.1, 0.1)), Y + R * (0.15 + rr(r, -0.08, 0.08)), R * 0.025, 0, 7);
          ctx.fill();
        }
      });
    // Augen: Anzahl aus dem Wurf, Zyklopen-Stellen der Form bleiben einäugig, Stielaugen bleiben auf Stielen
    const n = f.cyclops ? 1 : f.stalks ? 2 : e.n;
    if (f.stalks) {
      const sy = Y - R * 1.7;
      [-1, 1].forEach((s) => {
        inkPath(
          ctx,
          [
            [X + s * R * 0.3, Y - R * 0.3],
            [X + s * R * 0.42, sy + R * 0.5],
            [X + s * R * 0.5, sy + R * 0.25],
          ],
          lw,
          r,
        );
        eye(X + s * R * 0.5, sy, R * 0.3 * e.size, s);
      });
    } else if (n === 1) {
      const rad = R * 0.38 * e.size;
      eye(X, ey, rad, 0);
      brow(X, ey, rad, 0);
    } else if (n === 2) {
      const rad = R * 0.21 * e.size;
      [-1, 1].forEach((s) => {
        eye(X + s * R * 0.36, ey, rad, s);
        brow(X + s * R * 0.36, ey, rad, s);
      });
    } else {
      // Viele Augen in Reihen über dem Mund, ohne sich zu überdecken
      const rows = MANY[n]!,
        rad = R * (n <= 4 ? 0.15 : n <= 6 ? 0.12 : 0.1) * Math.min(e.size, 1.1);
      for (const [ox, oy] of rows) eye(X + ox * R, ey + oy * R, rad * rr(r, 0.85, 1.1), Math.sign(ox));
    }
    mouth(X, Y + R * 0.42, R);
    if (look.whiskers)
      [-1, 1].forEach((s) => {
        for (let i = -1; i <= 1; i++)
          inkPath(
            ctx,
            [
              [X + s * R * 0.3, Y + R * 0.3 + i * R * 0.06],
              [X + s * R * 0.9, Y + R * 0.22 + i * R * 0.16],
            ],
            lw * 0.7,
            r,
            0.75,
          );
      });
  });
}
