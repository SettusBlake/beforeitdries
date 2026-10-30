/*
 * Entwürfe für weitere Stile und Papiere (nur für docs/entwuerfe, noch nicht im Spiel).
 * Gleiche Geometrie wie der Aquarell-Renderer, andere Technik. Alles prozedural.
 */
import { circlePts, deformN, drawFace, ellipsePts, grainTex, inkPath, poly, renderMonster, smooth, type P2, type P3 } from '../../src/client/renderer/watercolor';
import { BP, PIG, type BlobShape, type RGB } from '../../src/shared/data';
import type { Monster } from '../../src/shared/monster';
import { RNG, clamp, gauss, ri, rr, type Rand } from '../../src/shared/rng';

type Ctx = CanvasRenderingContext2D;
type Base = { b: BlobShape; base: P3[] };

export const mixRGB = (a: readonly number[], b: readonly number[], t: number): number[] => a.map((v, i) => Math.round(v + ((b[i] ?? 0) - v) * t));
export const rgb = (c: readonly number[], a = 1): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function prep(m: Monster, S: number, amt = 0.3, iters = 3) {
  const geo = BP[m.bp].build(RNG(m.seed + 7919 * m.mutations + 13));
  const gr = RNG(m.seed + 31 * m.mutations + 5);
  const bases: Base[] = geo.blobs.map((b) => ({ b, base: deformN(ellipsePts(b, S, gr, 12), gr, amt, iters) }));
  let core = bases[0]!;
  bases.forEach((o) => {
    if (o.b.rx * o.b.ry > core.b.rx * core.b.ry) core = o;
  });
  return { geo, gr, bases, core };
}

export function unionPath(ctx: Ctx, polys: P2[][]): void {
  ctx.beginPath();
  for (const p of polys) {
    ctx.moveTo(p[0]![0], p[0]![1]);
    for (const q of p) ctx.lineTo(q[0], q[1]);
    ctx.closePath();
  }
}

export function smoothClosed(ctx: Ctx, pts: P2[]): void {
  const n = pts.length;
  ctx.beginPath();
  const mid = (i: number): [number, number] => [(pts[i % n]![0] + pts[(i + 1) % n]![0]) / 2, (pts[i % n]![1] + pts[(i + 1) % n]![1]) / 2];
  const m0 = mid(0);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n]!,
      m = mid(i);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
}

export function bbox(polys: P2[][]): [number, number, number, number] {
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const p of polys)
    for (const q of p) {
      x0 = Math.min(x0, q[0]);
      y0 = Math.min(y0, q[1]);
      x1 = Math.max(x1, q[0]);
      y1 = Math.max(y1, q[1]);
    }
  return [x0, y0, x1, y1];
}

/* ---------- Papiere ---------- */
export type PaperStyle = 'washi' | 'kraft' | 'graph' | 'black' | 'parchment' | 'newsprint' | 'music' | 'student';
export const PAPER_NAMES: Record<PaperStyle, string> = {
  washi: 'Washi',
  kraft: 'Kraft Paper',
  graph: 'Graph Paper',
  black: 'Black Paper',
  parchment: 'Parchment',
  newsprint: 'Newsprint',
  music: 'Music Sheet',
  student: 'Student Paper',
};
export const PAPER_TONE: Record<PaperStyle, RGB> = {
  washi: [244, 239, 226],
  kraft: [190, 152, 110],
  graph: [247, 249, 251],
  black: [30, 30, 34],
  parchment: [236, 221, 188],
  newsprint: [226, 223, 214],
  music: [245, 241, 231],
  student: [247, 246, 241],
};

export function drawPaperStyle(ctx: Ctx, S: number, kind: PaperStyle, r: Rand): void {
  const tone = PAPER_TONE[kind];
  ctx.fillStyle = rgb(tone);
  ctx.fillRect(0, 0, S, S);
  const pat = ctx.createPattern(grainTex(), 'repeat')!;
  try {
    pat.setTransform(new DOMMatrix().scale(S / 520));
  } catch {
    /* egal */
  }
  ctx.globalAlpha = kind === 'black' ? 0.25 : 0.55;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, S, S);
  ctx.globalAlpha = 1;
  ctx.lineCap = 'round';
  if (kind === 'washi') {
    for (let i = 0; i < 70; i++) {
      const x = r() * S,
        y = r() * S,
        a = r() * 6.28,
        l = rr(r, 0.05, 0.14) * S;
      ctx.strokeStyle = `rgba(150,130,100,${rr(r, 0.08, 0.18)})`;
      ctx.lineWidth = S / 900;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + Math.cos(a + 0.8) * l * 0.5, y + Math.sin(a + 0.8) * l * 0.5, x + Math.cos(a - 0.5) * l * 0.8, y + Math.sin(a - 0.5) * l * 0.8, x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  }
  if (kind === 'kraft') {
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = r() < 0.6 ? `rgba(90,60,30,${rr(r, 0.1, 0.3)})` : `rgba(250,235,210,${rr(r, 0.15, 0.4)})`;
      ctx.fillRect(r() * S, r() * S, rr(r, 0.6, 2.2) * (S / 600), rr(r, 0.6, 5) * (S / 600));
    }
  }
  if (kind === 'graph') {
    const g = S / 24;
    for (let i = 0; i <= 24; i++) {
      ctx.strokeStyle = i % 4 === 0 ? 'rgba(80,140,200,.35)' : 'rgba(80,140,200,.16)';
      ctx.lineWidth = S / 1000;
      ctx.beginPath();
      ctx.moveTo(i * g, 0);
      ctx.lineTo(i * g, S);
      ctx.moveTo(0, i * g);
      ctx.lineTo(S, i * g);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(210,70,70,.4)';
    ctx.beginPath();
    ctx.moveTo(S * 0.12, 0);
    ctx.lineTo(S * 0.12, S);
    ctx.stroke();
  }
  if (kind === 'parchment') {
    for (let i = 0; i < 18; i++) {
      const x = r() * S,
        y = r() * S,
        rad = rr(r, 0.08, 0.25) * S;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(160,120,60,${rr(r, 0.05, 0.12)})`);
      g.addColorStop(1, 'rgba(160,120,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }
    const v = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.75);
    v.addColorStop(0, 'rgba(120,80,30,0)');
    v.addColorStop(1, 'rgba(120,80,30,.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, S, S);
  }
  if (kind === 'newsprint') {
    const lh = S / 34;
    for (let y = lh; y < S; y += lh) {
      let x = S * 0.05;
      while (x < S * 0.95) {
        const w = rr(r, 0.02, 0.08) * S;
        ctx.fillStyle = `rgba(60,60,60,${rr(r, 0.06, 0.12)})`;
        ctx.fillRect(x, y, Math.min(w, S * 0.95 - x), lh * 0.35);
        x += w + S * 0.012;
      }
    }
  }
  if (kind === 'music') {
    for (let s = 0; s < 6; s++) {
      const y0 = S * (0.1 + s * 0.15);
      for (let l = 0; l < 5; l++) {
        ctx.strokeStyle = 'rgba(70,60,50,.28)';
        ctx.lineWidth = S / 900;
        ctx.beginPath();
        ctx.moveTo(S * 0.05, y0 + l * S * 0.013);
        ctx.lineTo(S * 0.95, y0 + l * S * 0.013);
        ctx.stroke();
      }
      for (let n = 0; n < 7; n++) {
        if (r() < 0.4) continue;
        const x = S * (0.12 + n * 0.12),
          y = y0 + ri(r, 0, 8) * S * 0.0065;
        ctx.fillStyle = 'rgba(70,60,50,.3)';
        ctx.beginPath();
        ctx.ellipse(x, y, S * 0.008, S * 0.006, -0.4, 0, 7);
        ctx.fill();
        ctx.fillRect(x + S * 0.007, y - S * 0.035, S / 700, S * 0.035);
      }
    }
  }
}

/* ---------- Stile ---------- */

/** Tusche (Sumi-e): Tuschelavur, Trockenpinsel, kräftige Kontur, rotes Siegel */
export function inkWash(ctx: Ctx, m: Monster, S: number): void {
  const { geo, gr, bases, core } = prep(m, S, 0.34);
  ctx.globalCompositeOperation = 'multiply';
  for (const o of bases)
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = `rgba(18,18,24,${o.b.wing ? 0.045 : 0.07})`;
      poly(ctx, deformN(o.base, gr, 0.3, 2));
      ctx.fill();
    }
  // Trockenpinsel: gebrochene Borsten entlang der Hauptachse jedes Kleckses
  const br = RNG(m.seed + 61);
  ctx.lineCap = 'round';
  for (const o of bases) {
    if (o.b.rx * o.b.ry < core.b.rx * core.b.ry * 0.25) continue;
    const ax = Math.cos(o.b.rot || 0),
      ay = Math.sin(o.b.rot || 0);
    const strokes = o === core ? 2 : 1;
    for (let s = 0; s < strokes; s++) {
      const off = rr(br, -0.35, 0.35) * o.b.ry,
        len = o.b.rx * rr(br, 0.9, 1.5),
        bend = rr(br, -0.25, 0.25) * o.b.ry;
      const cx = o.b.x - ay * off,
        cy = o.b.y + ax * off;
      for (let k = 0; k < 9; k++) {
        const w = (k - 4) * S * 0.0032;
        ctx.strokeStyle = `rgba(10,10,14,${rr(br, 0.12, 0.38)})`;
        ctx.lineWidth = S * rr(br, 0.002, 0.004);
        ctx.setLineDash([rr(br, 10, 40) * (S / 300), rr(br, 2, 10) * (S / 300)]);
        ctx.lineDashOffset = rr(br, 0, 30);
        ctx.beginPath();
        ctx.moveTo((cx - ax * len * 0.5) * S - ay * w, (cy - ay * len * 0.5) * S + ax * w);
        ctx.quadraticCurveTo((cx - ay * bend) * S - ay * w, (cy + ax * bend) * S + ax * w, (cx + ax * len * 0.5) * S - ay * w, (cy + ay * len * 0.5) * S + ax * w);
        ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]);
  ctx.globalCompositeOperation = 'source-over';
  const ir = RNG(m.seed + 777);
  for (const o of bases) if (!o.b.leaf) inkPath(ctx, o.base, S / 170, ir, 0.8, true);
  ctx.lineCap = 'round';
  for (const l of geo.limbs) {
    ctx.strokeStyle = 'rgba(14,14,18,.85)';
    ctx.lineWidth = l.w * S * 0.8;
    smooth(
      ctx,
      l.pts.map((p) => [p[0] * S, p[1] * S]),
    );
    ctx.stroke();
  }
  drawFace(ctx, m, geo, S, RNG(m.seed + 31337), PAPER_TONE.washi.join(','), core.b);
  // Siegel (Hanko), je Seed anders
  const sr = RNG(m.seed + 9001),
    sx = S * 0.8,
    sy = S * 0.8,
    sw = S * 0.1;
  ctx.fillStyle = 'rgba(178,34,40,.88)';
  ctx.fillRect(sx, sy, sw, sw);
  ctx.strokeStyle = PAPER_TONE.washi.join(',') === '' ? '#fff' : 'rgba(244,239,226,.95)';
  ctx.lineWidth = S / 260;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const x = sx + sw * rr(sr, 0.18, 0.82),
      y = sy + sw * rr(sr, 0.18, 0.82);
    ctx.moveTo(x, y);
    ctx.lineTo(x + (sr() < 0.5 ? sw * rr(sr, 0.15, 0.4) : 0), y + (sr() < 0.5 ? sw * rr(sr, 0.15, 0.4) : 0));
    ctx.stroke();
  }
}

/** Gouache: deckende, glatte Flächen mit Schatten und Lichtkante */
export function gouache(ctx: Ctx, m: Monster, S: number, paper: PaperStyle): void {
  const { geo, gr, bases, core } = prep(m, S, 0.12, 2);
  const main = PIG[m.main].rgb,
    sec = m.sec[0] ? PIG[m.sec[0]].rgb : mixRGB(main, [255, 255, 255], 0.45);
  ctx.lineCap = 'round';
  for (const l of geo.limbs) {
    ctx.strokeStyle = rgb(mixRGB(main, [0, 0, 0], 0.45));
    ctx.lineWidth = l.w * S * 1.3;
    smooth(
      ctx,
      l.pts.map((p) => [p[0] * S, p[1] * S]),
    );
    ctx.stroke();
  }
  for (const o of bases) {
    ctx.fillStyle = rgb(mixRGB(main, [0, 0, 0], 0.5), 0.9);
    ctx.save();
    ctx.translate(S * 0.012, S * 0.016);
    smoothClosed(ctx, o.base);
    ctx.fill();
    ctx.restore();
  }
  for (const o of bases) {
    ctx.fillStyle = rgb(o.b.leaf ? mixRGB([60, 140, 70], main, 0.2) : main);
    smoothClosed(ctx, o.base);
    ctx.fill();
  }
  // Muster aus dem Nebenpigment
  const pr = RNG(m.seed + 4243);
  ctx.save();
  smoothClosed(ctx, core.base);
  ctx.clip();
  for (let i = 0; i < 14; i++) {
    const [x, y] = [(core.b.x + gauss(pr) * core.b.rx * 0.5) * S, (core.b.y + gauss(pr) * core.b.ry * 0.5) * S];
    ctx.fillStyle = rgb(sec, 0.9);
    ctx.beginPath();
    ctx.ellipse(x, y, rr(pr, 0.008, 0.025) * S, rr(pr, 0.006, 0.02) * S, pr() * 3, 0, 7);
    ctx.fill();
  }
  ctx.restore();
  for (const o of bases) {
    const b = o.b;
    ctx.fillStyle = rgb(mixRGB(main, [255, 255, 255], 0.4), 0.75);
    ctx.beginPath();
    ctx.ellipse((b.x - b.rx * 0.25) * S, (b.y - b.ry * 0.35) * S, b.rx * 0.45 * S, b.ry * 0.22 * S, (b.rot || 0) - 0.2, 0, 7);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(40,28,22,.75)';
  ctx.lineWidth = S / 280;
  for (const o of bases) {
    smoothClosed(ctx, o.base);
    ctx.stroke();
  }
  void gr;
  drawFace(ctx, m, geo, S, RNG(m.seed + 31337), '250,247,238', core.b);
  void paper;
}

/** Kohle und Bleistift: Konstruktionslinien, Schraffur, Wischer, ein Hauch Farbstift */
export function charcoal(ctx: Ctx, m: Monster, S: number): void {
  const { geo, bases, core } = prep(m, S, 0.22, 3);
  const r = RNG(m.seed + 5150);
  ctx.strokeStyle = 'rgba(40,40,48,.14)';
  ctx.lineWidth = S / 900;
  for (const o of bases) {
    ctx.beginPath();
    ctx.ellipse(o.b.x * S, o.b.y * S, o.b.rx * S * 1.05, o.b.ry * S * 1.05, o.b.rot || 0, 0, 7);
    ctx.stroke();
  }
  const polys = bases.map((o) => o.base);
  const [x0, y0, x1, y1] = bbox(polys);
  ctx.save();
  unionPath(ctx, polys);
  ctx.clip();
  // Wischer
  ctx.fillStyle = 'rgba(30,30,36,.10)';
  ctx.fillRect(x0, y0 + (y1 - y0) * 0.45, x1 - x0, (y1 - y0) * 0.6);
  const ang = rr(r, -1.1, -0.6),
    sp = S / 85;
  const dx = Math.cos(ang),
    dy = Math.sin(ang);
  for (let pass = 0; pass < 2; pass++) {
    const a = pass ? ang + 1.2 : ang,
      cx = Math.cos(a),
      cy = Math.sin(a);
    for (let t = -S; t < S * 2; t += sp * (pass ? 1.3 : 1)) {
      ctx.strokeStyle = `rgba(28,28,34,${rr(r, 0.2, 0.42)})`;
      ctx.lineWidth = S / rr(r, 450, 700);
      ctx.beginPath();
      const ox = t * -cy,
        oy = t * cx;
      const ys = pass ? y0 + (y1 - y0) * 0.5 : y0;
      ctx.moveTo(ox + cx * -S + rr(r, -2, 2), oy + cy * -S + Math.max(0, ys - y0));
      ctx.lineTo(ox + cx * S * 2, oy + cy * S * 2);
      ctx.stroke();
    }
  }
  void dx;
  void dy;
  // Farbstift-Hauch
  ctx.strokeStyle = rgb(PIG[m.main].rgb, 0.45);
  ctx.lineWidth = S / 300;
  ctx.beginPath();
  for (let i = 0; i < 60; i++) {
    const x = (core.b.x + gauss(r) * core.b.rx * 0.35) * S,
      y = (core.b.y + gauss(r) * core.b.ry * 0.35) * S;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  const ir = RNG(m.seed + 777);
  for (const o of bases) for (let k = 0; k < 2; k++) inkPath(ctx, o.base, S / 380, ir, 0.55, true);
  for (const l of geo.limbs)
    inkPath(
      ctx,
      l.pts.map((p) => [p[0] * S, p[1] * S]),
      S / 330,
      ir,
      0.7,
    );
  drawFace(ctx, m, geo, S, RNG(m.seed + 31337), '247,249,251', core.b);
}

/** Pastell auf schwarzem Papier: kurze Kreidestriche, Papier scheint durch */
export function pastel(ctx: Ctx, m: Monster, S: number): void {
  const { geo, bases, core } = prep(m, S, 0.28, 3);
  const r = RNG(m.seed + 7331),
    main = PIG[m.main].rgb;
  const polys = bases.map((o) => o.base);
  const [x0, y0, x1, y1] = bbox(polys);
  ctx.save();
  unionPath(ctx, polys);
  ctx.clip();
  ctx.lineCap = 'round';
  const n = Math.round(((x1 - x0) * (y1 - y0)) / (S * S) * 5200);
  for (let i = 0; i < n; i++) {
    const x = rr(r, x0, x1),
      y = rr(r, y0, y1),
      a = -0.7 + gauss(r) * 0.35,
      l = rr(r, 0.012, 0.035) * S;
    const light = clamp(0.3 + ((y1 - y) / (y1 - y0)) * 0.5 + gauss(r) * 0.12, 0.1, 0.9);
    ctx.strokeStyle = rgb(mixRGB(main, [255, 250, 240], light), rr(r, 0.55, 0.9));
    ctx.lineWidth = rr(r, 2.2, 4) * (S / 300);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(30,30,34,.3)';
  for (let i = 0; i < n / 4; i++) ctx.fillRect(rr(r, x0, x1), rr(r, y0, y1), S / 400, S / 400);
  ctx.restore();
  const sec = m.sec[0] ? PIG[m.sec[0]].rgb : [255, 250, 240];
  ctx.strokeStyle = rgb(mixRGB(sec, [255, 255, 255], 0.3), 0.75);
  ctx.lineWidth = S / 200;
  for (const l of geo.limbs) {
    smooth(
      ctx,
      l.pts.map((p) => [p[0] * S, p[1] * S]),
    );
    ctx.stroke();
  }
  for (const o of bases) {
    ctx.setLineDash([S / 40, S / 90]);
    poly(ctx, o.base);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  drawFace(ctx, m, geo, S, RNG(m.seed + 31337), '242,236,222', core.b);
}

/** Linolschnitt: Farbplatte versetzt, Schwarzplatte mit Schnittlinien */
export function linocut(ctx: Ctx, m: Monster, S: number, paperTone: RGB): void {
  const { geo, bases, core } = prep(m, S, 0.2, 2);
  const r = RNG(m.seed + 1234),
    main = PIG[m.main].rgb;
  ctx.save();
  ctx.translate(S * 0.012, S * 0.008);
  ctx.fillStyle = rgb(main, 0.92);
  for (const o of bases) {
    poly(ctx, o.base);
    ctx.fill();
  }
  ctx.restore();
  const key = document.createElement('canvas');
  key.width = key.height = S;
  const k = key.getContext('2d')!;
  k.fillStyle = 'rgba(24,22,28,.96)';
  k.lineCap = 'round';
  for (const o of bases) {
    poly(k, o.base);
    k.fill();
  }
  for (const l of geo.limbs) {
    k.strokeStyle = 'rgba(24,22,28,.96)';
    k.lineWidth = l.w * S * 1.4;
    smooth(
      k,
      l.pts.map((p) => [p[0] * S, p[1] * S]),
    );
    k.stroke();
  }
  k.globalCompositeOperation = 'destination-out';
  for (const o of bases) {
    if (o.b.rx * o.b.ry < core.b.rx * core.b.ry * 0.15) continue;
    for (const t of [0.78, 0.6, 0.42, 0.26]) {
      const sub = { ...o.b, rx: o.b.rx * t, ry: o.b.ry * t };
      const pts = deformN(ellipsePts(sub, S, r, 10), r, 0.12, 2);
      k.lineWidth = S / rr(r, 150, 240);
      k.setLineDash([rr(r, 6, 30) * (S / 300), rr(r, 3, 9) * (S / 300)]);
      poly(k, pts);
      k.stroke();
    }
    for (let g = 0; g < 10; g++) {
      const a = r() * 6.28,
        rad = rr(r, 0.2, 0.85);
      const x = (o.b.x + Math.cos(a) * o.b.rx * rad) * S,
        y = (o.b.y + Math.sin(a) * o.b.ry * rad) * S;
      k.lineWidth = S / 300;
      k.setLineDash([]);
      k.beginPath();
      k.moveTo(x, y);
      k.lineTo(x + Math.cos(a) * S * 0.015, y + Math.sin(a) * S * 0.015);
      k.stroke();
    }
  }
  k.setLineDash([]);
  for (let i = 0; i < 500; i++) {
    k.fillRect(r() * S, r() * S, S / 500, S / 500);
  }
  ctx.drawImage(key, 0, 0);
  drawFace(ctx, m, geo, S, RNG(m.seed + 31337), paperTone.join(','), core.b);
}

/** Risografie: zwei Rasterfarben, leicht verrutscht */
export function risograph(ctx: Ctx, m: Monster, S: number): void {
  const { geo, bases, core } = prep(m, S, 0.24, 3);
  const polys = bases.map((o) => o.base);
  const [x0, y0, x1, y1] = bbox(polys);
  const inks: [number[], number, number, number][] = [
    [[0, 120, 191], 0.26, 0, 0],
    [[255, 72, 176], 1.31, S * 0.009, S * 0.006],
  ];
  ctx.globalCompositeOperation = 'multiply';
  inks.forEach(([col, ang, ox, oy], li) => {
    ctx.save();
    ctx.translate(ox, oy);
    unionPath(ctx, polys);
    ctx.clip();
    const sp = S / 64,
      c = Math.cos(ang),
      s = Math.sin(ang);
    ctx.fillStyle = rgb(col, 0.9);
    for (let u = -S; u < S * 2; u += sp)
      for (let v = -S; v < S * 2; v += sp) {
        const x = u * c - v * s,
          y = u * s + v * c;
        if (x < x0 - sp || x > x1 + sp || y < y0 - sp || y > y1 + sp) continue;
        const t = (y - y0) / (y1 - y0);
        const tone = li === 0 ? 0.25 + 0.7 * t : 0.15 + 0.6 * (1 - t);
        ctx.beginPath();
        ctx.arc(x, y, sp * 0.5 * Math.sqrt(clamp(tone, 0, 1)), 0, 7);
        ctx.fill();
      }
    ctx.restore();
  });
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(0,90,160,.85)';
  ctx.lineWidth = S / 260;
  for (const o of bases) {
    poly(ctx, o.base);
    ctx.stroke();
  }
  for (const l of geo.limbs) {
    smooth(
      ctx,
      l.pts.map((p) => [p[0] * S, p[1] * S]),
    );
    ctx.stroke();
  }
  drawFace(ctx, m, geo, S, RNG(m.seed + 31337), PAPER_TONE.newsprint.join(','), core.b);
}

/** Rorschach: Aquarell, gefaltet, spiegelsymmetrisch */
export function rorschach(target: HTMLCanvasElement, m: Monster, size: number): void {
  const tmp = document.createElement('canvas');
  renderMonster(tmp, { ...m, paper: 'schul' }, size, { dpr: 2 });
  const S = tmp.width;
  target.width = target.height = S;
  const ctx = target.getContext('2d')!;
  ctx.drawImage(tmp, 0, 0, S / 2, S, 0, 0, S / 2, S);
  ctx.save();
  ctx.translate(S, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(tmp, 0, 0, S / 2, S, 0, 0, S / 2, S);
  ctx.restore();
  ctx.strokeStyle = 'rgba(120,110,90,.18)';
  ctx.lineWidth = S / 500;
  ctx.beginPath();
  ctx.moveTo(S / 2, S * 0.03);
  ctx.lineTo(S / 2, S * 0.97);
  ctx.stroke();
}

export const helpers = { circlePts };
