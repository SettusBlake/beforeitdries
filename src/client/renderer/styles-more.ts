/*
 * Anime neu in zwei Szenen und acht weitere Stilrichtungen für Shinys (freigegeben am 30.10.2026, docs/entwuerfe/stile-mehr-plan.md).
 * Gleiche Formen und Gesichter wie die Stile in styles.ts, alles prozedural, Licht von oben links.
 * Im Spiel über shiny.ts, renderMore unten nur für den Entwurfsbogen tools/mockup/stile-mehr.ts
 */
import { PIG } from '../../shared/data';
import { lookOf, tinted } from '../../shared/look';
import type { Monster } from '../../shared/monster';
import { RNG, clamp, gauss, ri, rr, type Rand } from '../../shared/rng';
import { grainTex, type P2 } from './watercolor';
import {
  animeMouth,
  blobPath2D,
  centerOf,
  clipShadow,
  extrasOf,
  faceLayout,
  feetY,
  fromHsl,
  layer,
  limbPath,
  limbPx,
  mixRGB,
  prep,
  rgb,
  ring,
  shade,
  silhouette,
  smoothClosed,
  star,
  strokeLimb,
  toHsl,
  type C3,
  type Ctx,
  type FaceL,
  type Prep,
} from './styles';

/* ---------- Gemeinsam ---------- */
const mainRgb = (m: Monster): C3 => (m.gen === 2 ? tinted(PIG[m.main].rgb, lookOf(m).main) : [...PIG[m.main].rgb]);
const secRgb = (m: Monster): C3 | null => (m.sec[0] ? (m.gen === 2 ? tinted(PIG[m.sec[0]].rgb, lookOf(m).sec) : [...PIG[m.sec[0]].rgb]) : null);
/** Farbton h ein Stück t Richtung Ziel drehen (auf dem kürzeren Weg) */
function towards(h: number, target: number, t: number): number {
  let d = target - h;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return (h + d * t + 1) % 1;
}
const serialOf = (m: Monster) => '#' + String(m.seed % 100000).padStart(5, '0');
function grainOver(ctx: Ctx, S: number, alpha: number, op: GlobalCompositeOperation = 'source-over', scale = 520): void {
  const pat = ctx.createPattern(grainTex(), 'repeat')!;
  try {
    pat.setTransform(new DOMMatrix().scale(S / scale));
  } catch {
    /* egal */
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = op;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
}
/** Schlichter Mund für alle Stile außer Anime */
function plainMouth(ctx: Ctx, f: FaceL, col: string, lw: number): void {
  const { x, y, kind } = f.mouth,
    R = f.R,
    my = y - R * 0.05;
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'keiner') return;
  if (kind === 'rohr') {
    ctx.arc(x, my + R * 0.04, R * 0.07, 0, 7);
    ctx.stroke();
  } else if (kind === 'schnabel') {
    ctx.moveTo(x - R * 0.12, my - R * 0.03);
    ctx.lineTo(x + R * 0.12, my - R * 0.03);
    ctx.lineTo(x, my + R * 0.12);
    ctx.closePath();
    ctx.stroke();
  } else if (kind === 'zaehne') {
    for (let i = 0; i <= 6; i++) {
      const px = x - R * 0.2 + (i / 6) * R * 0.4,
        py = my + (i % 2 ? R * 0.08 : 0);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
  } else {
    const w = kind === 'grinsen' ? R * 0.24 : R * 0.15;
    ctx.moveTo(x - w, my);
    ctx.quadraticCurveTo(x, my + w * 0.8, x + w, my);
    ctx.stroke();
  }
}
/** Schlichte Augen: Weiß, Pupille, Glanz. scale vergrößert, line ist die Kontur */
function plainEyes(ctx: Ctx, f: FaceL, o: { line: string; lw: number; white: string; pupil: string; scale: number; glint?: string }): void {
  for (const st of f.stalks) {
    ctx.strokeStyle = o.line;
    ctx.lineWidth = f.R * 0.08;
    ctx.lineCap = 'round';
    limbPath(ctx, st);
    ctx.stroke();
  }
  for (const e of f.eyes) {
    const r = e.r * o.scale * (e.kind === 'punkt' ? 1.8 : 1);
    ctx.strokeStyle = o.line;
    ctx.lineWidth = o.lw;
    ctx.lineCap = 'round';
    if (e.kind === 'schlitz' || e.kind === 'muede') {
      ctx.beginPath();
      ctx.moveTo(e.x - r, e.y);
      ctx.quadraticCurveTo(e.x, e.y + (e.kind === 'muede' ? r * 0.55 : -r * 0.25), e.x + r, e.y);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = o.white;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, r, r * 1.1, 0, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = o.pupil;
    ctx.beginPath();
    ctx.ellipse(e.x + r * 0.12, e.y + r * 0.15, r * 0.48, r * 0.55, 0, 0, 7);
    ctx.fill();
    if (o.glint) {
      ctx.fillStyle = o.glint;
      ctx.beginPath();
      ctx.arc(e.x - r * 0.08, e.y - r * 0.12, r * 0.18, 0, 7);
      ctx.fill();
    }
  }
}
/** Pfad einer Grundfläche (für Clip und Füllung) */
const partPath = (o: Prep['bases'][number]): Path2D => blobPath2D(o.base);
/** Alle Flächen als ein Pfad */
function bodyPath(p: Prep): Path2D {
  const path = new Path2D();
  for (const o of p.bases) path.addPath(partPath(o));
  return path;
}

/* =====================================================================
 * Anime neu: Zellschatten mit harter Kante, Randlicht, farbige Linien mit Druck,
 * große Augen mit Wimpernbogen. Szene „sky“ (Himmel, Wolken, Gegenlicht) oder „focus“ (Speedlines)
 * ===================================================================== */
export function anime2(ctx: Ctx, m: Monster, S: number, scene: 'sky' | 'focus', deco: boolean): void {
  const p = prep(m, S, 0.08, 2);
  const r = RNG(m.seed + 8081);
  const { cx, cy, x0, x1 } = centerOf(p);
  const [h, s0, l0] = toHsl(mainRgb(m));
  const sat = clamp(s0 * 0.8 + 0.25, 0.45, 0.85);
  const L = clamp(l0 * 0.35 + 0.45, 0.55, 0.7);
  const B = fromHsl(h, sat, L);
  const SH = fromHsl(towards(h, 0.7, 0.12), clamp(sat + 0.05, 0, 0.9), L - 0.17);
  const HL = fromHsl(towards(h, 0.14, 0.1), clamp(sat - 0.1, 0.3, 0.8), clamp(L + 0.16, 0.7, 0.92));
  const LINE = rgb(fromHsl(towards(h, 0.72, 0.2), clamp(sat * 0.6, 0.25, 0.6), 0.17));
  const RIM = scene === 'sky' ? [214, 240, 255] : mixRGB(B, [255, 255, 255], 0.6);

  if (scene === 'sky') skyScene(ctx, S, r);
  else focusScene(ctx, S, r, cx, cy, h);

  // Harter Bodenschatten
  const fy = feetY(p, S);
  ctx.fillStyle = scene === 'sky' ? 'rgba(40,70,140,.28)' : 'rgba(30,20,50,.3)';
  ctx.beginPath();
  ctx.ellipse(cx, fy, Math.max(S * 0.12, (x1 - x0) * 0.45), S * 0.022, 0, 0, 7);
  ctx.fill();

  const faces = faceLayout(m, p, S);
  const ex = extrasOf(m, p, S, faces);
  // Außenlinie kräftig, innen fein
  ring(ctx, silhouette(S, p, LINE, ex), S * 0.0075);
  for (const t of ex.tris) {
    ctx.fillStyle = ex.horns ? '#fff6e6' : rgb(B);
    ctx.beginPath();
    t.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    ctx.fill();
  }
  for (const a of ex.antennae) {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = a.w;
    limbPath(ctx, a.path);
    ctx.stroke();
  }
  for (const lm of p.geo.limbs) {
    ctx.strokeStyle = rgb(B);
    strokeLimb(ctx, lm, S, lm.w * S);
    ctx.strokeStyle = rgb(SH);
    strokeLimb(ctx, lm, S, lm.w * S * 0.42, lm.w * S * 0.28, lm.w * S * 0.28);
  }
  const big = p.core.b.rx * p.core.b.ry;
  const sec = secRgb(m);
  for (const o of p.bases) {
    const col = o.b.leaf ? fromHsl(0.33, 0.5, 0.62) : B;
    const sh = o.b.leaf ? fromHsl(0.38, 0.45, 0.42) : SH;
    ctx.fillStyle = rgb(col);
    smoothClosed(ctx, o.base);
    ctx.fill();
    // Zweitfarbe als glatter Bauch
    if (o === p.core && sec) {
      ctx.save();
      smoothClosed(ctx, o.base);
      ctx.clip();
      const [sh2, ss] = toHsl(sec);
      ctx.fillStyle = rgb(fromHsl(sh2, clamp(ss * 0.7 + 0.15, 0.3, 0.7), 0.84));
      ctx.beginPath();
      ctx.ellipse(o.b.x * S, (o.b.y + o.b.ry * 0.4) * S, o.b.rx * S * 0.55, o.b.ry * S * 0.48, o.b.rot || 0, 0, 7);
      ctx.fill();
      ctx.restore();
    }
    // Zellschatten: harte Kante, kein Verlauf
    ctx.save();
    clipShadow(ctx, o, S, 0.2);
    ctx.fillStyle = rgb(sh, 0.92);
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
    // Randlicht auf der Schattenseite (Gegenlicht)
    ctx.save();
    clipShadow(ctx, o, S, 0.035);
    ctx.fillStyle = rgb(RIM, 0.85);
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
    // Lichtkante oben links und ein harter Glanz
    ctx.save();
    clipShadow(ctx, o, S, -0.07);
    ctx.fillStyle = rgb(o.b.leaf ? fromHsl(0.3, 0.6, 0.78) : HL);
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
    if (o.b.rx * o.b.ry > big * 0.25 && !o.b.leaf) {
      const gx = (o.b.x - o.b.rx * 0.42) * S,
        gy = (o.b.y - o.b.ry * 0.45) * S;
      ctx.save();
      smoothClosed(ctx, o.base);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.translate(gx, gy);
      ctx.rotate(-0.7);
      ctx.beginPath();
      ctx.ellipse(0, 0, o.b.rx * S * 0.2, o.b.ry * S * 0.055, 0, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(o.b.rx * S * 0.3, 0, o.b.ry * S * 0.04, 0, 7);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = LINE;
    ctx.lineWidth = S * 0.0032;
    smoothClosed(ctx, o.base);
    ctx.stroke();
  }
  // Gesicht: große Augen, Wangen mit Strichen
  const iris = sec ? toHsl(sec)[0] : (h + 0.5) % 1;
  for (const f of faces) {
    for (const st of f.stalks) {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = f.R * 0.1;
      limbPath(ctx, st);
      ctx.stroke();
      ctx.strokeStyle = rgb(B);
      ctx.lineWidth = f.R * 0.055;
      ctx.stroke();
    }
    const two = f.eyes.length === 2 && !f.stalks.length;
    if (!f.stalks.length && f.eyes.length) {
      for (const s of [-1, 1]) {
        const bx = f.X + s * f.R * 0.6,
          by = f.Y + f.R * 0.28;
        ctx.fillStyle = 'rgba(255,105,140,.38)';
        ctx.beginPath();
        ctx.ellipse(bx, by, f.R * 0.2, f.R * 0.09, 0, 0, 7);
        ctx.fill();
        ctx.strokeStyle = 'rgba(214,60,100,.75)';
        ctx.lineWidth = f.R * 0.022;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(bx + k * f.R * 0.075 + f.R * 0.03, by - f.R * 0.045);
          ctx.lineTo(bx + k * f.R * 0.075 - f.R * 0.03, by + f.R * 0.045);
          ctx.stroke();
        }
      }
    }
    for (const e of f.eyes) {
      const side = Math.sign(e.x - f.X);
      let w: number,
        x = e.x;
      if (two) {
        // Zwei Augen: groß und etwas auseinander, wie im Anime
        w = f.R * (e.kind === 'schlitz' ? 0.3 : 0.27);
        x = f.X + side * f.R * 0.4;
      } else if (e.kind === 'zyklop') w = e.r * 1.05;
      else w = e.r * (e.kind === 'punkt' ? 2.2 : 1.25);
      animeEye2(ctx, x, e.y, w, e.kind, iris, LINE, side);
    }
    if (f.eyes.length) animeMouth(ctx, f, LINE);
  }
  // Funkeln
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2,
      d = rr(r, 0.32, 0.45) * S;
    const x = cx + Math.cos(a) * d,
      y = cy + Math.sin(a) * d * 0.9;
    if (x < S * 0.06 || x > S * 0.94 || y < S * 0.06 || y > S * 0.9) continue;
    const s = rr(r, 0.014, 0.032) * S;
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,.9)';
    ctx.shadowBlur = s * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    star(ctx, x, y, s, s * 0.16, 4);
    ctx.fill();
    ctx.restore();
  }
  if (scene === 'focus') impactMarks(ctx, p, S, r, LINE);
  if (deco) animeTitle(ctx, m, S, LINE, B);
}
function skyScene(ctx: Ctx, S: number, r: Rand): void {
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#1d58c4');
  g.addColorStop(0.5, '#4f9ae8');
  g.addColorStop(0.8, '#b7defa');
  g.addColorStop(1, '#eaf6ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // Gegenlicht oben links
  const sx = S * 0.1,
    sy = S * 0.07;
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, S * 0.55);
  sun.addColorStop(0, 'rgba(255,255,255,.95)');
  sun.addColorStop(0.12, 'rgba(255,255,255,.55)');
  sun.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, S, S);
  // Lichtstrahlen
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) {
    const a = 0.35 + i * 0.22 + rr(r, -0.05, 0.05),
      w = rr(r, 0.03, 0.07);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a - w) * S * 1.6, sy + Math.sin(a - w) * S * 1.6);
    ctx.lineTo(sx + Math.cos(a + w) * S * 1.6, sy + Math.sin(a + w) * S * 1.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Wolkenbank am Horizont und zwei kleine hohe Wolken
  cloud(ctx, S * 0.18, S * 0.86, S * 0.5, r);
  cloud(ctx, S * 0.78, S * 0.88, S * 0.62, r);
  cloud(ctx, S * 0.82, S * 0.2, S * 0.22, r);
  cloud(ctx, S * 0.35, S * 0.3, S * 0.14, r);
  // Linsenreflexe auf der Linie von der Sonne zur Mitte
  for (let i = 0; i < 4; i++) {
    const t = 0.35 + i * 0.22,
      x = sx + (S * 0.75 - sx) * t,
      y = sy + (S * 0.8 - sy) * t,
      rad = S * rr(r, 0.015, 0.05);
    ctx.fillStyle = i % 2 ? 'rgba(150,230,255,.16)' : 'rgba(255,190,230,.14)';
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      k ? ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad) : ctx.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  }
}
/** Haufenwolke im Anime-Hintergrund: Kuppeln, flacher Boden, harter Schatten unten rechts */
function cloud(ctx: Ctx, x: number, y: number, w: number, r: Rand): void {
  const n = ri(r, 4, 6);
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const pr = w * (0.13 + 0.13 * Math.sin(Math.PI * t)) * rr(r, 0.85, 1.15);
    puffs.push([x + (t - 0.5) * w, y - pr * 0.45, pr]);
  }
  const path = new Path2D();
  for (const [px, py, pr] of puffs) {
    path.moveTo(px + pr, py);
    path.arc(px, py, pr, 0, Math.PI * 2);
  }
  path.rect(x - w * 0.5, y - w * 0.04, w, w * 0.08);
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = '#b9cdea';
  ctx.fillRect(x - w, y - w, w * 2, w * 2);
  ctx.fillStyle = '#ffffff';
  for (const [px, py, pr] of puffs) {
    ctx.beginPath();
    ctx.arc(px - pr * 0.12, py - pr * 0.16, pr * 0.94, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}
function focusScene(ctx: Ctx, S: number, r: Rand, cx: number, cy: number, h: number): void {
  // Grund in der Gegenfarbe, Mitte hell
  ctx.fillStyle = rgb(fromHsl((h + 0.5) % 1, 0.55, 0.82));
  ctx.fillRect(0, 0, S, S);
  const g = ctx.createRadialGradient(cx, cy, S * 0.1, cx, cy, S * 0.6);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // Konzentrationslinien: schmale Keile vom Rand zur Mitte
  ctx.fillStyle = 'rgba(28,24,44,.85)';
  for (let i = 0; i < 140; i++) {
    const a = r() * Math.PI * 2,
      inner = S * rr(r, 0.36, 0.5),
      w = rr(r, 0.002, 0.011);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a - w) * S, cy + Math.sin(a - w) * S);
    ctx.lineTo(cx + Math.cos(a + w) * S, cy + Math.sin(a + w) * S);
    ctx.closePath();
    ctx.fill();
  }
}
function impactMarks(ctx: Ctx, p: Prep, S: number, r: Rand, LINE: string): void {
  const b = p.core.b;
  const x = (b.x + b.rx * 0.9) * S,
    y = (b.y - b.ry * 0.95) * S;
  ctx.strokeStyle = LINE;
  ctx.lineCap = 'round';
  ctx.lineWidth = S * 0.006;
  for (let k = 0; k < 3; k++) {
    const a = -1.2 + k * 0.45 + rr(r, -0.05, 0.05);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * S * 0.03, y + Math.sin(a) * S * 0.03);
    ctx.lineTo(x + Math.cos(a) * S * 0.075, y + Math.sin(a) * S * 0.075);
    ctx.stroke();
  }
}
function animeTitle(ctx: Ctx, m: Monster, S: number, LINE: string, B: C3): void {
  ctx.save();
  ctx.translate(S * 0.06, S * 0.9);
  ctx.transform(1, 0, -0.18, 1, 0, 0);
  ctx.fillStyle = rgb(B);
  ctx.fillRect(0, S * 0.012, S * 0.5, S * 0.018);
  ctx.font = `900 ${S * 0.072}px Figtree, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = LINE;
  ctx.lineWidth = S * 0.016;
  ctx.strokeText(m.name.toUpperCase(), 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(m.name.toUpperCase(), 0, 0);
  ctx.font = `700 ${S * 0.03}px "JetBrains Mono", monospace`;
  ctx.lineWidth = S * 0.008;
  ctx.strokeText(`EPISODE ${serialOf(m)}`, 0, -S * 0.075);
  ctx.fillText(`EPISODE ${serialOf(m)}`, 0, -S * 0.075);
  ctx.restore();
}
/** Anime-Auge: hohes Oval, Iris mit harten Farbstufen, zwei Glanzlichter, kräftiger Wimpernbogen mit Schwung */
function animeEye2(ctx: Ctx, x: number, y: number, w: number, kind: string, irisHue: number, LINE: string, side: number): void {
  const h = w * (kind === 'schlitz' ? 0.75 : 1.45);
  const IR = fromHsl(irisHue, 0.8, 0.5);
  const LASH = rgb(shade(toRgbArr(LINE), 0.55));
  if (kind === 'muede') {
    // Glücklich geschlossen: Bogen nach oben
    ctx.strokeStyle = LASH;
    ctx.lineWidth = w * 0.24;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.9, y + h * 0.1);
    ctx.quadraticCurveTo(x, y - h * 0.55, x + w * 0.9, y + h * 0.1);
    ctx.stroke();
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, 7);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();
  // Schatten unter dem Lid
  ctx.fillStyle = '#d3defa';
  ctx.fillRect(x - w * 1.2, y - h * 1.2, w * 2.4, h * 0.75);
  const ix = x + side * w * 0.05,
    iy = y + h * 0.1;
  const g = ctx.createLinearGradient(0, iy - h * 0.85, 0, iy + h * 0.85);
  const dark = rgb(shade(IR, 0.32)),
    mid = rgb(IR),
    light = rgb(mixRGB(IR, [255, 255, 255], 0.5));
  g.addColorStop(0, dark);
  g.addColorStop(0.42, dark);
  g.addColorStop(0.42, mid);
  g.addColorStop(0.78, mid);
  g.addColorStop(0.78, light);
  g.addColorStop(1, light);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(ix, iy, w * 0.8, h * 0.86, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = rgb(shade(IR, 0.25));
  ctx.lineWidth = w * 0.07;
  ctx.stroke();
  ctx.fillStyle = rgb(shade(IR, 0.15));
  ctx.beginPath();
  ctx.ellipse(ix, iy + h * 0.02, w * 0.3, h * 0.38, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(ix - w * 0.28, iy - h * 0.3, w * 0.28, h * 0.22, -0.5, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ix + w * 0.3, iy + h * 0.34, w * 0.11, 0, 7);
  ctx.fill();
  ctx.restore();
  // Wimpernbogen: dick in der Mitte, außen mit Schwung nach oben
  const top = y - h * 0.98;
  ctx.fillStyle = LASH;
  ctx.beginPath();
  ctx.moveTo(x - side * w * 1.05, y - h * 0.25);
  ctx.quadraticCurveTo(x - side * w * 0.2, top - h * 0.2, x + side * w * 1.05, y - h * 0.48);
  ctx.lineTo(x + side * w * 1.45, y - h * 0.78);
  ctx.lineTo(x + side * w * 1.12, y - h * 0.22);
  ctx.quadraticCurveTo(x - side * w * 0.1, top + h * 0.12, x - side * w * 1.05, y - h * 0.18);
  ctx.closePath();
  ctx.fill();
  if (side === 0) {
    ctx.strokeStyle = LASH;
    ctx.lineWidth = w * 0.18;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 1.02, h * 1.02, 0, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  }
  // Unterlid angedeutet
  ctx.strokeStyle = LASH;
  ctx.lineWidth = w * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (side) ctx.ellipse(x, y, w * 1.0, h * 1.0, 0, side > 0 ? Math.PI * 0.12 : Math.PI * 0.62, side > 0 ? Math.PI * 0.38 : Math.PI * 0.88);
  else ctx.ellipse(x, y, w * 1.0, h * 1.0, 0, Math.PI * 0.35, Math.PI * 0.65);
  ctx.stroke();
}
function toRgbArr(css: string): C3 {
  const m = css.match(/[\d.]+/g) ?? ['0', '0', '0'];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

/* =====================================================================
 * Pixel: 16-Bit-Sprite, 48 × 48 Bildpunkte, eigene kleine Palette, dunkle Kontur, Himmel in Stufen
 * ===================================================================== */
const PX = 48;
export function pixel(ctx: Ctx, m: Monster, S: number, deco: boolean): void {
  const p = prep(m, S, 0.06, 2);
  const r = RNG(m.seed + 4848);
  const [h, s0, l0] = toHsl(mainRgb(m));
  const sat = clamp(s0 * 0.8 + 0.3, 0.5, 0.9);
  const L = clamp(l0 * 0.3 + 0.45, 0.5, 0.66);
  const B = fromHsl(h, sat, L),
    SH = fromHsl(towards(h, 0.72, 0.15), sat, L - 0.16),
    HL = fromHsl(towards(h, 0.14, 0.1), sat - 0.1, L + 0.17),
    OUT = fromHsl(towards(h, 0.72, 0.2), 0.45, 0.13);
  const sec = secRgb(m);
  const SC = sec ? fromHsl(toHsl(sec)[0], 0.55, 0.75) : HL;
  // 1. Flach gemalt in voller Größe
  const [big, bx] = layer(S);
  for (const lm of p.geo.limbs) {
    bx.strokeStyle = rgb(B);
    strokeLimb(bx, lm, S, Math.max(lm.w * S, S / PX * 1.6));
  }
  for (const o of p.bases) {
    bx.fillStyle = rgb(o.b.leaf ? fromHsl(0.33, 0.6, 0.5) : B);
    smoothClosed(bx, o.base);
    bx.fill();
    if (o === p.core && sec) {
      bx.save();
      smoothClosed(bx, o.base);
      bx.clip();
      bx.fillStyle = rgb(SC);
      bx.beginPath();
      bx.ellipse(o.b.x * S, (o.b.y + o.b.ry * 0.42) * S, o.b.rx * S * 0.55, o.b.ry * S * 0.45, o.b.rot || 0, 0, 7);
      bx.fill();
      bx.restore();
    }
    bx.save();
    clipShadow(bx, o, S, 0.24);
    bx.fillStyle = rgb(SH);
    bx.fillRect(0, 0, S, S);
    bx.restore();
    bx.save();
    clipShadow(bx, o, S, -0.12);
    bx.fillStyle = rgb(HL);
    bx.fillRect(0, 0, S, S);
    bx.restore();
  }
  // 2. Klein rechnen und auf die Palette setzen
  const [small, sx] = layer(PX);
  sx.imageSmoothingQuality = 'high';
  sx.drawImage(big, 0, 0, PX, PX);
  const img = sx.getImageData(0, 0, PX, PX),
    d = img.data;
  const pal = [B, SH, HL, SC, fromHsl(0.33, 0.6, 0.5)];
  const solid = new Uint8Array(PX * PX);
  for (let i = 0; i < PX * PX; i++) {
    if (d[i * 4 + 3]! < 100) {
      d[i * 4 + 3] = 0;
      continue;
    }
    solid[i] = 1;
    let best = pal[0]!,
      bd = 1e9;
    for (const c of pal) {
      const dd = (c[0]! - d[i * 4]!) ** 2 + (c[1]! - d[i * 4 + 1]!) ** 2 + (c[2]! - d[i * 4 + 2]!) ** 2;
      if (dd < bd) {
        bd = dd;
        best = c;
      }
    }
    d.set([best[0]!, best[1]!, best[2]!, 255], i * 4);
  }
  // Kontur: freie Punkte neben dem Sprite
  for (let y = 0; y < PX; y++)
    for (let x = 0; x < PX; x++) {
      const i = y * PX + x;
      if (solid[i]) continue;
      const nb = (x > 0 && solid[i - 1]) || (x < PX - 1 && solid[i + 1]) || (y > 0 && solid[i - PX]) || (y < PX - 1 && solid[i + PX]);
      if (nb) d.set([OUT[0]!, OUT[1]!, OUT[2]!, 255], i * 4);
    }
  sx.putImageData(img, 0, 0);
  // Gesicht direkt in Bildpunkten
  const k = PX / S;
  const faces = faceLayout(m, p, S);
  const dot = (x: number, y: number, c: string, w = 1, hh = 1) => {
    sx.fillStyle = c;
    sx.fillRect(Math.round(x), Math.round(y), w, hh);
  };
  const ink = rgb(OUT);
  for (const f of faces) {
    for (const e of f.eyes) {
      const ex = e.x * k,
        ey = e.y * k;
      if (e.kind === 'schlitz' || e.kind === 'muede') {
        dot(ex - 1, ey, ink, 2, 1);
        continue;
      }
      const big2 = e.kind === 'zyklop' ? 2 : 1;
      dot(ex - big2, ey - big2 - 1, '#ffffff', 2 * big2, 2 * big2 + 1);
      dot(ex - big2 + (big2 > 1 ? 1 : 1), ey - big2 + (big2 > 1 ? 1 : 0), ink, big2, big2 + 1);
    }
    if (f.eyes.length && f.mouth.kind !== 'keiner') {
      const mx = f.mouth.x * k,
        my = (f.mouth.y - f.R * 0.02) * k;
      dot(mx - 1, my, ink, f.mouth.kind === 'grinsen' || f.mouth.kind === 'zaehne' ? 3 : 2, 1);
      if (f.mouth.kind === 'zaehne') dot(mx, my + 1, '#ffffff', 1, 1);
    }
  }
  // 3. Hintergrund in Bildpunkten: Himmel in Stufen mit Raster, Boden aus Kacheln
  const [bg, gx] = layer(PX);
  const sky = ['#3d6fd6', '#5b8ff0', '#86b4fa', '#b8d8ff'];
  const bayer = [0, 2, 3, 1];
  for (let y = 0; y < PX; y++) {
    const t = (y / (PX * 0.78)) * (sky.length - 1),
      b0 = Math.min(sky.length - 1, Math.floor(t)),
      f = t - b0;
    for (let x = 0; x < PX; x++) {
      const th = (bayer[(y % 2) * 2 + (x % 2)]! + 0.5) / 4;
      gx.fillStyle = sky[Math.min(sky.length - 1, f > th ? b0 + 1 : b0)]!;
      gx.fillRect(x, y, 1, 1);
    }
  }
  // Wolken aus Blöcken
  for (let c = 0; c < 3; c++) {
    const wx = ri(r, 2, PX - 14),
      wy = ri(r, 3, 14);
    gx.fillStyle = '#ffffff';
    gx.fillRect(wx + 2, wy, 8, 2);
    gx.fillRect(wx, wy + 2, 12, 2);
    gx.fillStyle = '#d6e6ff';
    gx.fillRect(wx + 1, wy + 4, 11, 1);
  }
  const ground = Math.round(feetY(p, S) * k) - 1;
  for (let y = ground; y < PX; y++)
    for (let x = 0; x < PX; x++) {
      const top = y === ground;
      gx.fillStyle = top ? '#7bd36a' : (x + y) % 4 === 0 ? '#3c8f4a' : (Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? '#56a854' : '#4c9b4d';
      gx.fillRect(x, y, 1, 1);
    }
  gx.drawImage(small, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bg, 0, 0, S, S);
  ctx.imageSmoothingEnabled = true;
  if (deco) {
    // Spielfenster unten wie in einem alten Rollenspiel
    const u = S / PX;
    const y0 = S - u * 9,
      x0 = u * 2,
      w = S - u * 4;
    ctx.fillStyle = '#1b1c3a';
    ctx.fillRect(x0, y0, w, u * 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0 + u * 0.5, y0 + u * 0.5, w - u, u * 0.5);
    ctx.fillRect(x0 + u * 0.5, y0 + u * 6, w - u, u * 0.5);
    ctx.fillRect(x0 + u * 0.5, y0 + u * 0.5, u * 0.5, u * 6);
    ctx.fillRect(x0 + w - u, y0 + u * 0.5, u * 0.5, u * 6);
    ctx.font = `700 ${u * 2.2}px "JetBrains Mono", monospace`;
    ctx.fillText(m.name.toUpperCase(), x0 + u * 2, y0 + u * 3.2);
    ctx.font = `700 ${u * 1.6}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#ffd34d';
    ctx.fillText(`No. ${serialOf(m).slice(1)}`, x0 + u * 2, y0 + u * 5.4);
  }
}

/* =====================================================================
 * Ukiyo-e: Farbholzschnitt. Washi-Papier, Bokashi-Himmel, Nebelbänder, Wellenmuster,
 * flache Flächen mit Verlauf am Rand, schwarze Linie mit Druck, Siegel und Kartusche
 * ===================================================================== */
const UKI = {
  paper: '#efe2c4',
  sumi: '#1d1a17',
  indigo: '#28466f',
  red: '#c4432f',
  ochre: '#cf9a3c',
  green: '#6f8d58',
  blue: '#5f88b2',
  rose: '#b06a7e',
  grey: '#6b625a',
};
function ukiColor(c: C3): string {
  const [h, s, l] = toHsl(c);
  if (s < 0.18) return UKI.grey;
  if (h < 0.05 || h > 0.93) return UKI.red;
  if (h < 0.15) return UKI.ochre;
  if (h < 0.45) return UKI.green;
  if (h < 0.7) return l < 0.45 ? UKI.indigo : UKI.blue;
  return UKI.rose;
}
export function ukiyoe(ctx: Ctx, m: Monster, S: number, deco: boolean): void {
  const p = prep(m, S, 0.12, 2);
  const r = RNG(m.seed + 1830);
  const { cx } = centerOf(p);
  ctx.fillStyle = UKI.paper;
  ctx.fillRect(0, 0, S, S);
  // Fasern im Papier
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = `rgba(${r() < 0.5 ? '120,90,50' : '255,255,255'},${rr(r, 0.05, 0.12)})`;
    ctx.lineWidth = S * 0.0012;
    const x = r() * S,
      y = r() * S,
      a = r() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * S * 0.01, y + Math.sin(a + 1) * S * 0.01, x + Math.cos(a) * S * 0.025, y + Math.sin(a) * S * 0.025);
    ctx.stroke();
  }
  // Bokashi: Preußischblau läuft von oben aus
  const sky = ctx.createLinearGradient(0, 0, 0, S * 0.42);
  sky.addColorStop(0, 'rgba(40,70,111,.95)');
  sky.addColorStop(0.5, 'rgba(40,70,111,.35)');
  sky.addColorStop(1, 'rgba(40,70,111,0)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, S, S * 0.42);
  // Berg in der Ferne
  const mx = cx < S / 2 ? S * 0.78 : S * 0.24;
  ctx.fillStyle = '#5c7896';
  ctx.beginPath();
  ctx.moveTo(mx - S * 0.3, S * 0.72);
  ctx.quadraticCurveTo(mx - S * 0.08, S * 0.5, mx - S * 0.03, S * 0.38);
  ctx.lineTo(mx + S * 0.03, S * 0.38);
  ctx.quadraticCurveTo(mx + S * 0.08, S * 0.5, mx + S * 0.3, S * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f7f1e4';
  ctx.beginPath();
  ctx.moveTo(mx - S * 0.055, S * 0.43);
  ctx.lineTo(mx - S * 0.03, S * 0.38);
  ctx.lineTo(mx + S * 0.03, S * 0.38);
  ctx.lineTo(mx + S * 0.055, S * 0.43);
  for (let k = 0; k < 5; k++) ctx.lineTo(mx + S * 0.055 - (k + 0.5) * S * 0.022, S * (k % 2 ? 0.43 : 0.455));
  ctx.closePath();
  ctx.fill();
  // Nebelbänder
  for (const [y, x0, w] of [
    [0.56, 0.02, 0.5],
    [0.64, 0.45, 0.55],
    [0.3, 0.55, 0.4],
  ] as const) {
    const hh = S * 0.035;
    ctx.fillStyle = 'rgba(240,206,190,.92)';
    ctx.strokeStyle = 'rgba(176,120,96,.6)';
    ctx.lineWidth = S * 0.002;
    ctx.beginPath();
    ctx.roundRect(S * x0, S * y, S * w, hh, hh / 2);
    ctx.fill();
    ctx.stroke();
  }
  // Seigaiha: Wellenschuppen am Boden
  const R0 = S * 0.055;
  const fy = feetY(p, S);
  for (let row = 0, y = Math.max(S * 0.74, fy - R0 * 0.3); y < S + R0; row++, y += R0 * 0.5) {
    for (let x = row % 2 ? R0 : 0; x < S + R0; x += R0 * 2) {
      ctx.fillStyle = UKI.indigo;
      ctx.beginPath();
      ctx.arc(x, y, R0, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = UKI.paper;
      ctx.lineWidth = S * 0.004;
      for (const k of [0.75, 0.5, 0.25]) {
        ctx.beginPath();
        ctx.arc(x, y, R0 * k, Math.PI, 0);
        ctx.stroke();
      }
    }
  }
  // Figur: flache Farbe, Verlauf zum Rand, Muster, schwarze Linie
  const col = ukiColor(mainRgb(m));
  const sec = secRgb(m);
  const pat = sec ? ukiColor(sec) : UKI.paper;
  const faces = faceLayout(m, p, S);
  ring(ctx, silhouette(S, p, UKI.sumi, null), S * 0.0045);
  for (const lm of p.geo.limbs) {
    ctx.strokeStyle = col;
    strokeLimb(ctx, lm, S, lm.w * S);
  }
  const kind = ri(r, 0, 2);
  for (const o of p.bases) {
    ctx.fillStyle = o.b.leaf ? UKI.green : col;
    smoothClosed(ctx, o.base);
    ctx.fill();
    ctx.save();
    smoothClosed(ctx, o.base);
    ctx.clip();
    if (o === p.core && !o.b.leaf) {
      // Stoffmuster: Punkte, Streifen oder Gitter
      ctx.fillStyle = ctx.strokeStyle = pat === col ? UKI.paper : pat;
      ctx.globalAlpha = 0.7;
      const st = S * 0.035;
      ctx.lineWidth = S * 0.006;
      for (let y = 0; y < S; y += st)
        for (let x = (y / st) % 2 ? st / 2 : 0; x < S; x += st) {
          if (kind === 0) {
            ctx.beginPath();
            ctx.arc(x, y, st * 0.16, 0, 7);
            ctx.fill();
          } else if (kind === 1 && x < st && Math.round(y / st) % 3 === 0) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(S, y + S * 0.3);
            ctx.stroke();
          } else if (kind === 2) {
            ctx.beginPath();
            ctx.moveTo(x - st * 0.3, y);
            ctx.lineTo(x, y - st * 0.3);
            ctx.lineTo(x + st * 0.3, y);
            ctx.stroke();
          }
        }
      ctx.globalAlpha = 1;
    }
    const g = ctx.createLinearGradient(0, (o.b.y - o.b.ry) * S, 0, (o.b.y + o.b.ry) * S);
    g.addColorStop(0, 'rgba(255,248,230,.18)');
    g.addColorStop(0.6, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(20,10,0,.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
    ctx.strokeStyle = UKI.sumi;
    ctx.lineWidth = S * 0.0035;
    smoothClosed(ctx, o.base);
    ctx.stroke();
  }
  // Mandelaugen
  for (const f of faces) {
    for (const st of f.stalks) {
      ctx.strokeStyle = UKI.sumi;
      ctx.lineWidth = f.R * 0.07;
      limbPath(ctx, st);
      ctx.stroke();
    }
    for (const e of f.eyes) {
      const w = e.r * (e.kind === 'punkt' ? 2 : 1.25),
        h2 = w * (e.kind === 'schlitz' || e.kind === 'muede' ? 0.25 : 0.55);
      ctx.fillStyle = '#fbf6ea';
      ctx.strokeStyle = UKI.sumi;
      ctx.lineWidth = S * 0.003;
      ctx.beginPath();
      ctx.moveTo(e.x - w, e.y);
      ctx.quadraticCurveTo(e.x, e.y - h2 * 2, e.x + w, e.y);
      ctx.quadraticCurveTo(e.x, e.y + h2 * 1.4, e.x - w, e.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = UKI.sumi;
      ctx.beginPath();
      ctx.arc(e.x, e.y - h2 * 0.1, Math.min(h2 * 0.95, w * 0.42), 0, 7);
      ctx.fill();
      ctx.lineWidth = S * 0.005;
      ctx.beginPath();
      ctx.moveTo(e.x - w * 0.9, e.y - h2 * 2.1);
      ctx.quadraticCurveTo(e.x, e.y - h2 * 2.9, e.x + w * 0.9, e.y - h2 * 2.1);
      ctx.stroke();
    }
    if (f.eyes.length) plainMouth(ctx, f, UKI.sumi, S * 0.004);
  }
  if (deco) {
    // Kartusche mit Namen und rotes Siegel
    const cw = S * 0.08,
      ch = S * 0.36;
    ctx.fillStyle = '#f3dc8a';
    ctx.strokeStyle = UKI.sumi;
    ctx.lineWidth = S * 0.003;
    ctx.fillRect(S * 0.05, S * 0.05, cw, ch);
    ctx.strokeRect(S * 0.05, S * 0.05, cw, ch);
    ctx.fillStyle = UKI.sumi;
    ctx.font = `400 ${S * 0.034}px "Young Serif", serif`;
    ctx.textAlign = 'center';
    const letters = m.name.toUpperCase().slice(0, 9).split('');
    letters.forEach((c, i) => ctx.fillText(c, S * 0.05 + cw / 2, S * 0.05 + ch * ((i + 0.8) / (letters.length + 0.3))));
    ctx.textAlign = 'left';
    const sx = S * 0.83,
      sy = S * 0.06,
      sw = S * 0.11;
    ctx.fillStyle = UKI.red;
    ctx.beginPath();
    ctx.roundRect(sx, sy, sw, sw, sw * 0.12);
    ctx.fill();
    ctx.strokeStyle = '#f7e9d2';
    ctx.lineWidth = sw * 0.08;
    ctx.lineCap = 'square';
    const rs = RNG(m.seed + 77);
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      const a = [sx + sw * rr(rs, 0.2, 0.8), sy + sw * rr(rs, 0.2, 0.8)] as const;
      const vertical = rs() < 0.5;
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(vertical ? a[0] : sx + sw * 0.82, vertical ? sy + sw * 0.82 : a[1]);
      ctx.stroke();
    }
  }
  grainOver(ctx, S, 0.1, 'multiply');
}

/* =====================================================================
 * Stained glass: Bleiglasfenster. Scheiben aus Voronoi-Zellen, Licht scheint durch, Bleiruten dunkel
 * ===================================================================== */
function clipHalf(poly: P2[], p: P2, q: P2): P2[] {
  const mx = (p[0] + q[0]) / 2,
    my = (p[1] + q[1]) / 2,
    dx = q[0] - p[0],
    dy = q[1] - p[1];
  const f = (v: P2) => (v[0] - mx) * dx + (v[1] - my) * dy;
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!,
      b = poly[(i + 1) % poly.length]!,
      fa = f(a),
      fb = f(b);
    if (fa <= 0) out.push(a);
    if (fa <= 0 !== fb <= 0) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
function voronoi(pts: P2[], x0: number, y0: number, x1: number, y1: number): P2[][] {
  return pts.map((p, i) => {
    let poly: P2[] = [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ];
    for (let j = 0; j < pts.length && poly.length; j++) if (j !== i) poly = clipHalf(poly, p, pts[j]!);
    return poly;
  });
}
function polyPath(ctx: Ctx | Path2D, poly: P2[]): void {
  poly.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
  ctx.closePath();
}
function glassPane(ctx: Ctx, poly: P2[], col: C3, S: number): void {
  let gx = 0,
    gy = 0;
  for (const q of poly) {
    gx += q[0] / poly.length;
    gy += q[1] / poly.length;
  }
  const g = ctx.createRadialGradient(gx - S * 0.01, gy - S * 0.015, 0, gx, gy, S * 0.12);
  g.addColorStop(0, rgb(mixRGB(col, [255, 255, 255], 0.35)));
  g.addColorStop(1, rgb(shade(col, 0.78)));
  ctx.fillStyle = g;
  ctx.beginPath();
  polyPath(ctx, poly);
  ctx.fill();
}
export function stained(ctx: Ctx, m: Monster, S: number, deco: boolean): void {
  const p = prep(m, S, 0.1, 2);
  const r = RNG(m.seed + 1248);
  const LEAD = '#23201e';
  const [h, s0, l0] = toHsl(mainRgb(m));
  // Hintergrund: Scheiben in Blau mit wenigen warmen Tupfern
  const bgPts: P2[] = [];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) bgPts.push([(x + 0.5 + gauss(r) * 0.28) * (S / 6), (y + 0.5 + gauss(r) * 0.28) * (S / 6)]);
  const bgCells = voronoi(bgPts, 0, 0, S, S);
  const blues: C3[] = [
    [36, 72, 160],
    [28, 98, 170],
    [52, 60, 140],
    [30, 120, 150],
  ];
  for (const c of bgCells) {
    const warm = r() < 0.12;
    glassPane(ctx, c, warm ? (r() < 0.5 ? [214, 160, 40] : [170, 40, 50]) : blues[ri(r, 0, blues.length - 1)]!, S);
  }
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = S * 0.01;
  ctx.lineJoin = 'round';
  for (const c of bgCells) {
    ctx.beginPath();
    polyPath(ctx, c);
    ctx.stroke();
  }
  // Figur: eigene, feinere Scheiben, nur innerhalb der Silhouette
  const faces = faceLayout(m, p, S);
  const ex = extrasOf(m, p, S, faces);
  const mask = silhouette(S, p, '#000', ex, 1.4);
  ring(ctx, silhouette(S, p, LEAD, ex, 1.4), S * 0.011);
  const { x0, y0, x1, y1 } = centerOf(p);
  const body = bodyPath(p);
  const fpts: P2[] = [];
  for (let tries = 0; fpts.length < 26 && tries < 600; tries++) {
    const q: P2 = [rr(r, x0, x1), rr(r, y0, y1)];
    if (ctx.isPointInPath(body, q[0], q[1]) || tries > 400) fpts.push(q);
  }
  const cells = voronoi(fpts, x0 - S * 0.1, y0 - S * 0.1, x1 + S * 0.1, Math.max(y1, y0) + S * 0.1);
  const sec = secRgb(m);
  const [fig, fx] = layer(S);
  for (const c of cells) {
    const useSec = sec && r() < 0.25;
    const base = useSec ? sec! : fromHsl((h + rr(r, -0.03, 0.03) + 1) % 1, clamp(s0 * 0.8 + 0.35, 0.5, 0.95), clamp(l0 * 0.4 + 0.35 + rr(r, -0.08, 0.08), 0.3, 0.7));
    glassPane(fx, c, base, S);
  }
  fx.strokeStyle = LEAD;
  fx.lineWidth = S * 0.008;
  fx.lineJoin = 'round';
  for (const c of cells) {
    fx.beginPath();
    polyPath(fx, c);
    fx.stroke();
  }
  for (const o of p.bases) {
    fx.lineWidth = S * 0.007;
    smoothClosed(fx, o.base);
    fx.stroke();
  }
  fx.globalCompositeOperation = 'destination-in';
  fx.drawImage(mask, 0, 0);
  ctx.drawImage(fig, 0, 0);
  // Augen als runde Scheiben
  for (const f of faces) {
    for (const e of f.eyes) {
      const rad = e.r * (e.kind === 'punkt' ? 2 : 1.25);
      glassPane(ctx, [...Array(12)].map((_, i) => [e.x + Math.cos((i / 12) * 6.283) * rad, e.y + Math.sin((i / 12) * 6.283) * rad * 1.1] as P2), [244, 238, 220], S * 0.3);
      ctx.fillStyle = '#16142a';
      ctx.beginPath();
      ctx.arc(e.x + rad * 0.1, e.y + rad * 0.12, rad * 0.45, 0, 7);
      ctx.fill();
      ctx.strokeStyle = LEAD;
      ctx.lineWidth = S * 0.006;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, rad, rad * 1.1, 0, 0, 7);
      ctx.stroke();
    }
    if (f.eyes.length) plainMouth(ctx, f, LEAD, S * 0.007);
  }
  // Licht von oben, Glas ein wenig unruhig
  const lg = ctx.createRadialGradient(S * 0.35, S * 0.15, 0, S * 0.35, S * 0.15, S * 0.9);
  lg.addColorStop(0, 'rgba(255,250,220,.22)');
  lg.addColorStop(1, 'rgba(0,0,20,.22)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, S, S);
  grainOver(ctx, S, 0.12, 'overlay', 300);
  if (deco) {
    // Spitzbogen aus Stein
    ctx.save();
    ctx.fillStyle = '#3a342f';
    ctx.beginPath();
    ctx.rect(0, 0, S, S);
    ctx.moveTo(S * 0.06, S * 0.97);
    ctx.lineTo(S * 0.06, S * 0.42);
    ctx.quadraticCurveTo(S * 0.06, S * 0.06, S * 0.5, S * 0.03);
    ctx.quadraticCurveTo(S * 0.94, S * 0.06, S * 0.94, S * 0.42);
    ctx.lineTo(S * 0.94, S * 0.97);
    ctx.closePath();
    ctx.fill('evenodd');
    ctx.strokeStyle = LEAD;
    ctx.lineWidth = S * 0.014;
    ctx.stroke();
    ctx.restore();
    grainOver(ctx, S, 0.1, 'overlay', 260);
    ctx.fillStyle = '#e9dcc0';
    ctx.font = `400 ${S * 0.036}px "Young Serif", serif`;
    ctx.textAlign = 'center';
    ctx.fillText(m.name, S * 0.5, S * 0.995 - S * 0.008);
    ctx.textAlign = 'left';
  }
}

/* =====================================================================
 * Neon: Leuchtröhren vor einer dunklen Ziegelwand, Umrisse als Röhren mit Lücken, Kabel, Schild unten
 * ===================================================================== */
function tube(ctx: Ctx, draw: () => void, col: C3, w: number, S: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = rgb(col);
  ctx.shadowBlur = S * 0.035;
  ctx.strokeStyle = rgb(col, 0.9);
  ctx.lineWidth = w * 1.7;
  draw();
  ctx.stroke();
  ctx.shadowBlur = S * 0.012;
  ctx.strokeStyle = rgb(mixRGB(col, [255, 255, 255], 0.7));
  ctx.lineWidth = w * 0.6;
  ctx.stroke();
  ctx.restore();
}
export function neon(ctx: Ctx, m: Monster, S: number, deco: boolean): void {
  const p = prep(m, S, 0.08, 2);
  const r = RNG(m.seed + 777);
  const { cx, cy } = centerOf(p);
  // Ziegelwand
  ctx.fillStyle = '#140f1d';
  ctx.fillRect(0, 0, S, S);
  const bh = S / 15,
    bw = S / 6;
  for (let row = 0; row * bh < S; row++)
    for (let x = row % 2 ? -bw / 2 : 0; x < S; x += bw) {
      const l = rr(r, 0.11, 0.16);
      ctx.fillStyle = rgb(fromHsl(0.75, 0.25, l));
      ctx.fillRect(x + S * 0.003, row * bh + S * 0.003, bw - S * 0.006, bh - S * 0.006);
    }
  const [h] = toHsl(mainRgb(m));
  const sec = secRgb(m);
  const C1 = fromHsl(h, 1, 0.6),
    C2 = fromHsl(sec ? toHsl(sec)[0] : (h + 0.45) % 1, 1, 0.62);
  // Schein auf der Wand
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.55);
  glow.addColorStop(0, rgb(C1, 0.28));
  glow.addColorStop(1, rgb(C1, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);
  const vg = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, S, S);
  // Kabel zur Wand
  ctx.strokeStyle = '#06040a';
  ctx.lineWidth = S * 0.004;
  ctx.beginPath();
  ctx.moveTo(p.core.b.x * S, (p.core.b.y + p.core.b.ry) * S);
  ctx.quadraticCurveTo(S * 0.9, S * 0.95, S * 1.02, S * 0.8);
  ctx.stroke();
  const w = S * 0.009;
  // Röhren mit kleinen Lücken, wie gebogenes Glas
  for (const lm of p.geo.limbs) tube(ctx, () => limbPath(ctx, limbPx(lm, S)), C1, w * 0.9, S);
  for (const o of p.bases) {
    const gap = S * 0.012,
      len = S * rr(r, 0.18, 0.35);
    ctx.save();
    ctx.setLineDash([len, gap]);
    ctx.lineDashOffset = r() * len;
    tube(ctx, () => smoothClosed(ctx, o.base), o.b.leaf ? fromHsl(0.33, 1, 0.55) : C1, w, S);
    ctx.restore();
  }
  // Halter
  ctx.fillStyle = '#7d7a86';
  for (let i = 0; i < 4; i++) {
    const o = p.bases[i % p.bases.length]!;
    const q = o.base[Math.floor(r() * o.base.length)]!;
    ctx.beginPath();
    ctx.arc(q[0], q[1], S * 0.006, 0, 7);
    ctx.fill();
  }
  // Gesicht in der zweiten Farbe
  const faces = faceLayout(m, p, S);
  for (const f of faces) {
    for (const e of f.eyes) {
      const rad = e.r * (e.kind === 'punkt' ? 1.6 : 1.1);
      if (e.kind === 'schlitz' || e.kind === 'muede')
        tube(
          ctx,
          () => {
            ctx.beginPath();
            ctx.moveTo(e.x - rad, e.y);
            ctx.quadraticCurveTo(e.x, e.y + (e.kind === 'muede' ? rad * 0.6 : -rad * 0.3), e.x + rad, e.y);
          },
          C2,
          w * 0.7,
          S,
        );
      else {
        tube(
          ctx,
          () => {
            ctx.beginPath();
            ctx.ellipse(e.x, e.y, rad, rad * 1.1, 0, 0, 7);
          },
          C2,
          w * 0.7,
          S,
        );
        tube(
          ctx,
          () => {
            ctx.beginPath();
            ctx.arc(e.x + rad * 0.1, e.y + rad * 0.15, rad * 0.25, 0, 7);
          },
          C2,
          w * 0.6,
          S,
        );
      }
    }
    if (f.eyes.length && f.mouth.kind !== 'keiner') {
      const { x, y } = f.mouth,
        R = f.R;
      tube(
        ctx,
        () => {
          ctx.beginPath();
          ctx.moveTo(x - R * 0.18, y - R * 0.05);
          ctx.quadraticCurveTo(x, y + R * 0.12, x + R * 0.18, y - R * 0.05);
        },
        C2,
        w * 0.6,
        S,
      );
    }
  }
  if (deco) {
    ctx.save();
    ctx.font = `400 ${S * 0.11}px Caveat, cursive`;
    ctx.textAlign = 'center';
    ctx.lineWidth = S * 0.006;
    ctx.shadowColor = rgb(C2);
    ctx.shadowBlur = S * 0.03;
    ctx.strokeStyle = rgb(C2);
    ctx.strokeText(m.name, S * 0.5, S * 0.95);
    ctx.shadowBlur = 0;
    ctx.lineWidth = S * 0.002;
    ctx.strokeStyle = rgb(mixRGB(C2, [255, 255, 255], 0.7));
    ctx.strokeText(m.name, S * 0.5, S * 0.95);
    ctx.restore();
  }
}

/* =====================================================================
 * Blueprint: Bauplan auf Blaupapier. Weiße Linien, Raster, Mittellinien, Maße, Zirkelkreise, Schriftfeld
 * ===================================================================== */
export function blueprint(ctx: Ctx, m: Monster, S: number, deco: boolean): void {
  const p = prep(m, S, 0.05, 1);
  const { cx, cy, x0, y0, x1, y1 } = centerOf(p);
  const bg = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.75);
  bg.addColorStop(0, '#2b64ad');
  bg.addColorStop(1, '#173f7a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i <= 40; i++) {
    const v = (i / 40) * S;
    ctx.strokeStyle = i % 5 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.17)';
    ctx.lineWidth = S * (i % 5 ? 0.001 : 0.0018);
    ctx.beginPath();
    ctx.moveTo(v, 0);
    ctx.lineTo(v, S);
    ctx.moveTo(0, v);
    ctx.lineTo(S, v);
    ctx.stroke();
  }
  grainOver(ctx, S, 0.12, 'overlay');
  const W = 'rgba(240,248,255,.95)';
  const lw = S * 0.0032;
  // Mittellinien (Strich-Punkt)
  ctx.strokeStyle = 'rgba(240,248,255,.55)';
  ctx.lineWidth = S * 0.0016;
  ctx.setLineDash([S * 0.03, S * 0.008, S * 0.004, S * 0.008]);
  ctx.beginPath();
  ctx.moveTo(cx, y0 - S * 0.06);
  ctx.lineTo(cx, y1 + S * 0.04);
  ctx.moveTo(x0 - S * 0.06, cy);
  ctx.lineTo(x1 + S * 0.06, cy);
  ctx.stroke();
  ctx.setLineDash([]);
  // Glieder als hohle Röhren, Flächen mit feinem Schnitt-Raster
  const [fig, fx] = layer(S);
  fx.strokeStyle = W;
  for (const lm of p.geo.limbs) strokeLimb(fx, lm, S, lm.w * S + lw * 2);
  fx.globalCompositeOperation = 'destination-out';
  for (const lm of p.geo.limbs) strokeLimb(fx, lm, S, Math.max(0, lm.w * S - lw * 0.5));
  fx.globalCompositeOperation = 'source-over';
  ctx.drawImage(fig, 0, 0);
  for (const o of p.bases) {
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    smoothClosed(ctx, o.base);
    ctx.fill();
    if (o === p.core) {
      ctx.save();
      smoothClosed(ctx, o.base);
      ctx.clip();
      ctx.strokeStyle = 'rgba(240,248,255,.16)';
      ctx.lineWidth = S * 0.0014;
      for (let t = -S; t < S * 2; t += S * 0.018) {
        ctx.beginPath();
        ctx.moveTo(t, 0);
        ctx.lineTo(t - S, S);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.strokeStyle = W;
    ctx.lineWidth = lw;
    smoothClosed(ctx, o.base);
    ctx.stroke();
  }
  // Augen mit Fadenkreuz, Zirkelkreis um das Gesicht
  const faces = faceLayout(m, p, S);
  for (const f of faces) {
    ctx.strokeStyle = 'rgba(240,248,255,.5)';
    ctx.lineWidth = S * 0.0015;
    ctx.setLineDash([S * 0.008, S * 0.006]);
    ctx.beginPath();
    ctx.arc(f.X, f.Y, f.R * 1.05, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const e of f.eyes) {
      const rad = e.r * (e.kind === 'punkt' ? 2 : 1.15);
      ctx.strokeStyle = W;
      ctx.lineWidth = lw * 0.8;
      ctx.beginPath();
      ctx.arc(e.x, e.y, rad, 0, 7);
      ctx.moveTo(e.x - rad * 1.4, e.y);
      ctx.lineTo(e.x + rad * 1.4, e.y);
      ctx.moveTo(e.x, e.y - rad * 1.4);
      ctx.lineTo(e.x, e.y + rad * 1.4);
      ctx.stroke();
      ctx.fillStyle = W;
      ctx.beginPath();
      ctx.arc(e.x, e.y, rad * 0.32, 0, 7);
      ctx.fill();
    }
    if (f.eyes.length) plainMouth(ctx, f, W, lw * 0.8);
  }
  // Maße: Breite unten, Höhe rechts
  const arrow = (ax: number, ay: number, bx2: number, by2: number) => {
    const a = Math.atan2(by2 - ay, bx2 - ax),
      k = S * 0.014;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx2, by2);
    for (const [px, py, aa] of [
      [ax, ay, a],
      [bx2, by2, a + Math.PI],
    ] as const) {
      ctx.moveTo(px + Math.cos(aa + 0.4) * k, py + Math.sin(aa + 0.4) * k);
      ctx.lineTo(px, py);
      ctx.lineTo(px + Math.cos(aa - 0.4) * k, py + Math.sin(aa - 0.4) * k);
    }
    ctx.stroke();
  };
  ctx.strokeStyle = W;
  ctx.fillStyle = W;
  ctx.lineWidth = S * 0.0018;
  const dy = Math.min(S * 0.95, y1 + S * 0.05),
    dx = Math.min(S * 0.95, x1 + S * 0.05);
  arrow(x0, dy, x1, dy);
  arrow(dx, y0, dx, y1);
  ctx.beginPath();
  ctx.moveTo(x0, y1 + S * 0.01);
  ctx.lineTo(x0, dy + S * 0.012);
  ctx.moveTo(x1, y1 + S * 0.01);
  ctx.lineTo(x1, dy + S * 0.012);
  ctx.moveTo(x1 + S * 0.01, y0);
  ctx.lineTo(dx + S * 0.012, y0);
  ctx.moveTo(x1 + S * 0.01, y1);
  ctx.lineTo(dx + S * 0.012, y1);
  ctx.stroke();
  ctx.font = `700 ${S * 0.028}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(((x1 - x0) / S * 120).toFixed(1), (x0 + x1) / 2, dy - S * 0.012);
  ctx.save();
  ctx.translate(dx - S * 0.012, (y0 + y1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(((y1 - y0) / S * 120).toFixed(1), 0, 0);
  ctx.restore();
  ctx.textAlign = 'left';
  if (deco) {
    // Schriftfeld unten rechts
    const bw = S * 0.42,
      bh2 = S * 0.13,
      bx = S * 0.55,
      by = S * 0.84;
    ctx.fillStyle = 'rgba(23,63,122,.9)';
    ctx.fillRect(bx, by, bw, bh2);
    ctx.strokeStyle = W;
    ctx.lineWidth = S * 0.0025;
    ctx.strokeRect(bx, by, bw, bh2);
    ctx.beginPath();
    ctx.moveTo(bx, by + bh2 * 0.5);
    ctx.lineTo(bx + bw, by + bh2 * 0.5);
    ctx.moveTo(bx + bw * 0.55, by + bh2 * 0.5);
    ctx.lineTo(bx + bw * 0.55, by + bh2);
    ctx.stroke();
    ctx.fillStyle = W;
    ctx.font = `700 ${S * 0.028}px "JetBrains Mono", monospace`;
    ctx.fillText(m.name.toUpperCase(), bx + S * 0.012, by + bh2 * 0.36);
    ctx.font = `400 ${S * 0.02}px "JetBrains Mono", monospace`;
    ctx.fillText(`NO. ${serialOf(m)}`, bx + S * 0.012, by + bh2 * 0.82);
    ctx.fillText('DRAWN: M. SEPIA', bx + bw * 0.57, by + bh2 * 0.82);
  }
}

/* =====================================================================
 * Crayon: Wachsmalkreide wie von einem Kind. Kritzelflächen über den Rand, Strichbeine, Sonne mit Gesicht
 * ===================================================================== */
function scribble(ctx: Ctx, box: [number, number, number, number], ang: number, sp: number, r: Rand): void {
  const [x0, y0, x1, y1] = box;
  const c = Math.cos(ang),
    s = Math.sin(ang);
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2,
    rad = Math.hypot(x1 - x0, y1 - y0) / 2;
  ctx.beginPath();
  let first = true;
  for (let t = -rad, k = 0; t <= rad; t += sp * rr(r, 0.7, 1.2), k++) {
    const ox = cx - s * t,
      oy = cy + c * t;
    const end = k % 2 ? 1 : -1;
    const px = ox + c * rad * end + gauss(r) * sp,
      py = oy + s * rad * end + gauss(r) * sp;
    if (first) {
      ctx.moveTo(px, py);
      first = false;
    } else ctx.lineTo(px, py);
  }
  ctx.stroke();
}
export function crayon(ctx: Ctx, m: Monster, S: number, deco: boolean): void {
  const p = prep(m, S, 0.25, 3);
  const r = RNG(m.seed + 4321);
  ctx.fillStyle = '#fbf8f1';
  ctx.fillRect(0, 0, S, S);
  const [art, ax] = layer(S);
  ax.lineCap = 'round';
  ax.lineJoin = 'round';
  // Himmel als lose Striche, Sonne mit Gesicht, Gras
  ax.strokeStyle = 'rgba(90,150,230,.4)';
  ax.lineWidth = S * 0.008;
  scribble(ax, [S * 0.0, S * -0.04, S * 0.7, S * 0.1], 0.04, S * 0.035, r);
  const sx = S * 0.86,
    sy = S * 0.13,
    sr = S * 0.07;
  ax.strokeStyle = '#f2b81c';
  ax.lineWidth = S * 0.01;
  ax.save();
  ax.beginPath();
  ax.arc(sx, sy, sr, 0, 7);
  ax.clip();
  scribble(ax, [sx - sr, sy - sr, sx + sr, sy + sr], 0.8, S * 0.012, r);
  ax.restore();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + rr(r, -0.1, 0.1);
    ax.beginPath();
    ax.moveTo(sx + Math.cos(a) * sr * 1.2, sy + Math.sin(a) * sr * 1.2);
    ax.lineTo(sx + Math.cos(a) * sr * 1.75, sy + Math.sin(a) * sr * 1.75);
    ax.stroke();
  }
  ax.strokeStyle = '#3a2a1a';
  ax.lineWidth = S * 0.005;
  ax.beginPath();
  ax.arc(sx - sr * 0.3, sy - sr * 0.15, S * 0.004, 0, 7);
  ax.arc(sx + sr * 0.3, sy - sr * 0.15, S * 0.004, 0, 7);
  ax.stroke();
  ax.beginPath();
  ax.arc(sx, sy + sr * 0.05, sr * 0.4, 0.3, Math.PI - 0.3);
  ax.stroke();
  const fy = feetY(p, S);
  ax.strokeStyle = '#4caf3c';
  ax.lineWidth = S * 0.009;
  ax.beginPath();
  for (let x = 0; x < S; x += S * 0.012) {
    const top = fy - S * rr(r, 0.0, 0.04);
    ax.moveTo(x, S);
    ax.lineTo(x + rr(r, -1, 1) * S * 0.008, top);
  }
  ax.stroke();
  // Figur
  const [h, s0, l0] = toHsl(mainRgb(m));
  const C = fromHsl(h, clamp(s0 * 0.7 + 0.35, 0.5, 0.95), clamp(l0 * 0.4 + 0.35, 0.4, 0.6));
  const sec = secRgb(m);
  const dark = rgb(fromHsl(h, 0.5, 0.2));
  // Strichbeine wie bei Kindern
  for (const lm of p.geo.limbs) {
    ax.strokeStyle = dark;
    ax.lineWidth = Math.max(S * 0.008, Math.min(lm.w * S, S * 0.014));
    limbPath(ax, limbPx(lm, S).map((q) => [q[0] + gauss(r) * S * 0.003, q[1] + gauss(r) * S * 0.003]));
    ax.stroke();
  }
  for (const o of p.bases) {
    const bb = o.base.reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.max(a[2], q[0]), Math.max(a[3], q[1])] as [number, number, number, number], [1e9, 1e9, -1e9, -1e9] as [number, number, number, number]);
    ax.save();
    // Kinder malen etwas über den Rand
    ax.translate(gauss(r) * S * 0.006, gauss(r) * S * 0.006);
    smoothClosed(ax, o.base);
    ax.clip();
    ax.strokeStyle = rgb(o.b.leaf ? [70, 170, 60] : C);
    ax.lineWidth = S * 0.011;
    scribble(ax, bb, -0.7 + rr(r, -0.2, 0.2), S * 0.011, r);
    if (o === p.core && sec) {
      ax.strokeStyle = rgb(fromHsl(toHsl(sec)[0], 0.75, 0.6));
      ax.lineWidth = S * 0.009;
      const k = (bb[2] - bb[0]) * 0.25;
      scribble(ax, [bb[0] + k, (bb[1] + bb[3]) / 2, bb[2] - k, bb[3]], 0.6, S * 0.012, r);
    }
    ax.restore();
    for (let k = 0; k < 2; k++) {
      ax.strokeStyle = dark;
      ax.lineWidth = S * 0.006;
      smoothClosed(
        ax,
        o.base.map((q) => [q[0] + gauss(r) * S * 0.004, q[1] + gauss(r) * S * 0.004]),
      );
      ax.stroke();
    }
  }
  // Gesicht: große runde Augen, Wangen
  const faces = faceLayout(m, p, S);
  for (const f of faces) {
    if (f.eyes.length && !f.stalks.length)
      for (const s of [-1, 1]) {
        ax.strokeStyle = 'rgba(240,110,140,.8)';
        ax.lineWidth = S * 0.006;
        ax.save();
        ax.beginPath();
        ax.arc(f.X + s * f.R * 0.62, f.Y + f.R * 0.3, f.R * 0.13, 0, 7);
        ax.clip();
        scribble(ax, [f.X + s * f.R * 0.62 - f.R * 0.13, f.Y + f.R * 0.17, f.X + s * f.R * 0.62 + f.R * 0.13, f.Y + f.R * 0.43], 0.4, S * 0.006, r);
        ax.restore();
      }
    plainEyes(ax, f, { line: dark, lw: S * 0.006, white: '#fffdf8', pupil: dark, scale: 1.45 });
    if (f.eyes.length) plainMouth(ax, f, dark, S * 0.007);
  }
  // Wachs: das Papier scheint durch
  const pat = ax.createPattern(grainTex(), 'repeat')!;
  try {
    pat.setTransform(new DOMMatrix().scale(S / 380));
  } catch {
    /* egal */
  }
  ax.globalCompositeOperation = 'destination-out';
  ax.globalAlpha = 0.5;
  ax.fillStyle = pat;
  ax.fillRect(0, 0, S, S);
  ctx.drawImage(art, 0, 0);
  if (deco) {
    ctx.fillStyle = rgb(C);
    ctx.font = `400 ${S * 0.085}px Caveat, cursive`;
    ctx.fillText(m.name.toLowerCase(), S * 0.05, S * 0.2);
  }
}

/* =====================================================================
 * Papercut: geschnittenes Papier in Lagen. Hügel mit Schatten, Mond ausgeschnitten, Figur aus Papierteilen
 * ===================================================================== */
export function papercut(ctx: Ctx, m: Monster, S: number, deco: boolean): void {
  const p = prep(m, S, 0.14, 2);
  const r = RNG(m.seed + 2112);
  const [h, s0, l0] = toHsl(mainRgb(m));
  const hb = (h + 0.5) % 1;
  ctx.fillStyle = rgb(fromHsl(hb, 0.35, 0.86));
  ctx.fillRect(0, 0, S, S);
  const shadowed = (fn: () => void, blur = 0.018) => {
    ctx.save();
    ctx.shadowColor = 'rgba(20,20,30,.35)';
    ctx.shadowBlur = S * blur;
    ctx.shadowOffsetY = S * 0.006;
    ctx.shadowOffsetX = S * 0.003;
    fn();
    ctx.restore();
  };
  // Mond
  shadowed(() => {
    ctx.fillStyle = '#fbf6e8';
    ctx.beginPath();
    ctx.arc(S * 0.8, S * 0.18, S * 0.07, 0, 7);
    ctx.fill();
  });
  // Hügel in Lagen
  const fy = feetY(p, S);
  for (let k = 0; k < 4; k++) {
    const base = S * (0.52 + k * 0.12) + (k === 3 ? Math.max(0, fy - S * 0.92) : 0);
    const amp = S * rr(r, 0.03, 0.06),
      ph = r() * 6,
      fr = rr(r, 1.5, 3);
    shadowed(() => {
      ctx.fillStyle = rgb(fromHsl(hb, 0.3 + k * 0.06, 0.74 - k * 0.1));
      ctx.beginPath();
      ctx.moveTo(0, S);
      for (let x = 0; x <= S; x += S / 40) ctx.lineTo(x, base + Math.sin((x / S) * fr * Math.PI + ph) * amp);
      ctx.lineTo(S, S);
      ctx.closePath();
      ctx.fill();
    });
  }
  grainOver(ctx, S, 0.12, 'multiply');
  // Figur: jedes Teil ein Papierstück mit eigenem Schatten
  const B = fromHsl(h, clamp(s0 * 0.7 + 0.25, 0.4, 0.85), clamp(l0 * 0.35 + 0.42, 0.45, 0.66));
  const sec = secRgb(m);
  for (const lm of p.geo.limbs)
    shadowed(() => {
      ctx.strokeStyle = rgb(shade(B, 0.85));
      strokeLimb(ctx, lm, S, Math.max(lm.w * S, S * 0.01));
    }, 0.012);
  p.bases.forEach((o, i) => {
    const col = o.b.leaf ? fromHsl(0.33, 0.45, 0.5) : shade(B, 1 + ((i % 3) - 1) * 0.07);
    shadowed(() => {
      ctx.fillStyle = rgb(col);
      smoothClosed(ctx, o.base);
      ctx.fill();
    });
    ctx.save();
    smoothClosed(ctx, o.base);
    ctx.clip();
    const g = ctx.createLinearGradient(0, (o.b.y - o.b.ry) * S, 0, (o.b.y + o.b.ry) * S);
    g.addColorStop(0, 'rgba(255,255,255,.18)');
    g.addColorStop(1, 'rgba(0,0,0,.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
    if (o === p.core && sec)
      shadowed(() => {
        ctx.fillStyle = rgb(fromHsl(toHsl(sec)[0], 0.5, 0.78));
        ctx.beginPath();
        ctx.ellipse(o.b.x * S, (o.b.y + o.b.ry * 0.35) * S, o.b.rx * S * 0.5, o.b.ry * S * 0.42, o.b.rot || 0, 0, 7);
        ctx.fill();
      }, 0.01);
  });
  // Augen aus weißem und schwarzem Papier
  const faces = faceLayout(m, p, S);
  for (const f of faces) {
    for (const e of f.eyes) {
      const rad = e.r * (e.kind === 'punkt' ? 2 : 1.3);
      if (e.kind === 'schlitz' || e.kind === 'muede') {
        shadowed(() => {
          ctx.fillStyle = '#1d1b22';
          ctx.beginPath();
          ctx.ellipse(e.x, e.y, rad, rad * 0.25, 0, 0, 7);
          ctx.fill();
        }, 0.006);
        continue;
      }
      shadowed(() => {
        ctx.fillStyle = '#fffdf6';
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, rad, rad * 1.1, 0, 0, 7);
        ctx.fill();
      }, 0.008);
      shadowed(() => {
        ctx.fillStyle = '#1d1b22';
        ctx.beginPath();
        ctx.arc(e.x + rad * 0.12, e.y + rad * 0.15, rad * 0.48, 0, 7);
        ctx.fill();
      }, 0.005);
    }
    if (f.eyes.length && f.mouth.kind !== 'keiner') {
      const { x, y } = f.mouth,
        R = f.R;
      shadowed(() => {
        ctx.fillStyle = '#1d1b22';
        ctx.beginPath();
        ctx.moveTo(x - R * 0.2, y - R * 0.06);
        ctx.quadraticCurveTo(x, y + R * 0.22, x + R * 0.2, y - R * 0.06);
        ctx.quadraticCurveTo(x, y + R * 0.06, x - R * 0.2, y - R * 0.06);
        ctx.fill();
      }, 0.005);
    }
  }
  grainOver(ctx, S, 0.08, 'multiply', 400);
  if (deco)
    shadowed(() => {
      ctx.fillStyle = '#fbf6e8';
      const w = S * 0.5;
      ctx.beginPath();
      ctx.moveTo(S * 0.25, S * 0.88);
      for (let k = 0; k <= 12; k++) ctx.lineTo(S * 0.25 + (k / 12) * w, S * 0.88 + (k % 2 ? S * 0.004 : 0));
      ctx.lineTo(S * 0.75, S * 0.965);
      ctx.lineTo(S * 0.25, S * 0.965);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#3a3440';
      ctx.font = `400 ${S * 0.042}px "Young Serif", serif`;
      ctx.textAlign = 'center';
      ctx.fillText(m.name, S * 0.5, S * 0.938);
      ctx.textAlign = 'left';
    });
}

/* =====================================================================
 * Mosaic: römisches Mosaik. Steinchen im Raster, jedes leicht gedreht, Fugen hell, Rand mit Band
 * ===================================================================== */
const MO = 52;
export function mosaic(ctx: Ctx, m: Monster, S: number, deco: boolean): void {
  const p = prep(m, S, 0.1, 2);
  const r = RNG(m.seed + 3141);
  const [h, s0, l0] = toHsl(mainRgb(m));
  // Vorlage flach in voller Größe
  const [flat, fx] = layer(S);
  fx.fillStyle = '#e6d9b8';
  fx.fillRect(0, 0, S, S);
  if (deco) {
    fx.fillStyle = '#7a3b2a';
    fx.fillRect(0, 0, S, S);
    fx.fillStyle = '#e6d9b8';
    fx.fillRect(S * 0.08, S * 0.08, S * 0.84, S * 0.84);
    fx.fillStyle = '#2f4a3a';
    fx.fillRect(S * 0.04, S * 0.04, S * 0.92, S * 0.02);
    fx.fillRect(S * 0.04, S * 0.94, S * 0.92, S * 0.02);
    fx.fillRect(S * 0.04, S * 0.04, S * 0.02, S * 0.92);
    fx.fillRect(S * 0.94, S * 0.04, S * 0.02, S * 0.92);
  }
  const B = fromHsl(h, clamp(s0 * 0.6 + 0.2, 0.25, 0.7), clamp(l0 * 0.35 + 0.38, 0.38, 0.62));
  const SH = shade(B, 0.7);
  const sec = secRgb(m);
  const OUT = '#2d2420';
  fx.drawImage(silhouette(S, p, OUT, null, 1.2), 0, 0);
  ring(fx, silhouette(S, p, OUT, null, 1.2), S / MO);
  for (const lm of p.geo.limbs) {
    fx.strokeStyle = rgb(B);
    strokeLimb(fx, lm, S, Math.max(lm.w * S, (S / MO) * 1.2));
  }
  for (const o of p.bases) {
    fx.fillStyle = rgb(o.b.leaf ? [90, 130, 70] : B);
    smoothClosed(fx, o.base);
    fx.fill();
    if (o === p.core && sec) {
      fx.save();
      smoothClosed(fx, o.base);
      fx.clip();
      fx.fillStyle = rgb(fromHsl(toHsl(sec)[0], 0.45, 0.72));
      fx.beginPath();
      fx.ellipse(o.b.x * S, (o.b.y + o.b.ry * 0.4) * S, o.b.rx * S * 0.5, o.b.ry * S * 0.42, o.b.rot || 0, 0, 7);
      fx.fill();
      fx.restore();
    }
    fx.save();
    clipShadow(fx, o, S, 0.25);
    fx.fillStyle = rgb(SH);
    fx.fillRect(0, 0, S, S);
    fx.restore();
  }
  // Steinchen: Farbe aus der Vorlage in der Mitte jeder Zelle
  const [small, sx] = layer(MO);
  sx.drawImage(flat, 0, 0, MO, MO);
  const d = sx.getImageData(0, 0, MO, MO).data;
  const t = S / MO;
  // Augen und Mund als eigene Steinchen
  const over = new Map<number, string>();
  const faces = faceLayout(m, p, S);
  const cell = (x: number, y: number) => Math.floor(y / t) * MO + Math.floor(x / t);
  for (const f of faces) {
    for (const e of f.eyes) {
      const rad = Math.max(t * 1.1, e.r * 1.3);
      for (let y = e.y - rad; y <= e.y + rad; y += t * 0.5)
        for (let x = e.x - rad; x <= e.x + rad; x += t * 0.5) if (Math.hypot(x - e.x, y - e.y) <= rad) over.set(cell(x, y), '#f4efe2');
      over.set(cell(e.x, e.y + t * 0.3), '#1a1614');
    }
    if (f.eyes.length && f.mouth.kind !== 'keiner') for (let k = -1; k <= 1; k++) over.set(cell(f.mouth.x + k * t, f.mouth.y), '#1a1614');
  }
  ctx.fillStyle = '#cfc6b4';
  ctx.fillRect(0, 0, S, S);
  for (let y = 0; y < MO; y++)
    for (let x = 0; x < MO; x++) {
      const i = y * MO + x;
      const c: C3 = [d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!];
      const v = rr(r, 0.92, 1.07);
      const col = over.get(i) ?? rgb(shade(c, v));
      const cx2 = (x + 0.5) * t + gauss(r) * t * 0.06,
        cy2 = (y + 0.5) * t + gauss(r) * t * 0.06,
        a = gauss(r) * 0.12,
        hs = t * 0.43;
      ctx.save();
      ctx.translate(cx2, cy2);
      ctx.rotate(a);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-hs + gauss(r) * t * 0.04, -hs);
      ctx.lineTo(hs, -hs + gauss(r) * t * 0.04);
      ctx.lineTo(hs + gauss(r) * t * 0.04, hs);
      ctx.lineTo(-hs, hs + gauss(r) * t * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.lineWidth = t * 0.08;
      ctx.beginPath();
      ctx.moveTo(-hs, hs);
      ctx.lineTo(-hs, -hs);
      ctx.lineTo(hs, -hs);
      ctx.stroke();
      ctx.restore();
    }
  grainOver(ctx, S, 0.12, 'multiply', 300);
  if (deco) {
    ctx.fillStyle = '#efe6cf';
    ctx.font = `400 ${S * 0.03}px "Young Serif", serif`;
    ctx.textAlign = 'center';
    ctx.fillText(m.name.toUpperCase(), S * 0.5, S * 0.035);
    ctx.textAlign = 'left';
  }
}

/* =====================================================================
 * Graffiti (gezeichnet 31.10.2026, im Spiel seit 31.10.2026): Sprühfarbe auf Beton. Alte übermalte Tags, Sprühnebel, 3D-Schatten,
 * doppelte Kontur, Verlauf in der Füllung, Glanzstriche, Laufnasen, Name als Bubble-Schrift mit Krone
 * ===================================================================== */
/** Form in einer Farbe aus einer Maske (Maske bleibt unverändert) */
function tintedMask(mask: HTMLCanvasElement, col: string): HTMLCanvasElement {
  const [c, x] = layer(mask.width);
  x.drawImage(mask, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = col;
  x.fillRect(0, 0, mask.width, mask.width);
  return c;
}
export function graffiti(ctx: Ctx, m: Monster, S: number, deco: boolean): void {
  const p = prep(m, S, 0.1, 2);
  const r = RNG(m.seed + 5150);
  const { y0, y1 } = centerOf(p);
  // Beton mit Plattenfugen und Flecken
  ctx.fillStyle = '#9b968f';
  ctx.fillRect(0, 0, S, S);
  grainOver(ctx, S, 0.45, 'multiply', 240);
  grainOver(ctx, S, 0.25, 'overlay', 80);
  for (let i = 0; i < 7; i++) {
    const x = r() * S,
      y = r() * S,
      rad = S * rr(r, 0.08, 0.22);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(60,52,44,${rr(r, 0.08, 0.18)})`);
    g.addColorStop(1, 'rgba(60,52,44,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  ctx.strokeStyle = 'rgba(55,50,46,.4)';
  ctx.lineWidth = S * 0.004;
  ctx.beginPath();
  ctx.moveTo(S * 0.34, 0);
  ctx.lineTo(S * 0.34, S);
  ctx.moveTo(S * 0.72, 0);
  ctx.lineTo(S * 0.72, S);
  ctx.moveTo(0, S * 0.6);
  ctx.lineTo(S, S * 0.6);
  ctx.stroke();
  // Alte Tags, teils grau übermalt
  const OLD = ['#d24b8a', '#2d7fd0', '#e8b320', '#3aa36b', '#1e1c22'];
  for (let k = 0; k < 6; k++) {
    ctx.strokeStyle = OLD[k % OLD.length]!;
    ctx.globalAlpha = rr(r, 0.2, 0.38);
    ctx.lineWidth = S * rr(r, 0.005, 0.011);
    ctx.lineCap = ctx.lineJoin = 'round';
    let x = r() * S * 0.8,
      y = rr(r, 0.05, 0.95) * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < 6; i++) {
      const nx = x + rr(r, 0.02, 0.07) * S,
        ny = y + rr(r, -0.06, 0.06) * S;
      ctx.quadraticCurveTo(x + rr(r, -0.03, 0.05) * S, y + rr(r, -0.08, 0.08) * S, nx, ny);
      x = nx;
      y = ny;
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(140,135,128,.92)';
  const bx = rr(r, 0.05, 0.6) * S,
    by = rr(r, 0.05, 0.3) * S;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  for (let i = 0; i <= 8; i++) ctx.lineTo(bx + (i / 8) * S * 0.3, by + gauss(r) * S * 0.006);
  for (let i = 8; i >= 0; i--) ctx.lineTo(bx + (i / 8) * S * 0.3, by + S * 0.12 + gauss(r) * S * 0.006);
  ctx.closePath();
  ctx.fill();

  const [h, s0, l0] = toHsl(mainRgb(m));
  const sat = clamp(s0 * 0.8 + 0.4, 0.6, 1);
  const L = clamp(l0 * 0.35 + 0.42, 0.45, 0.62);
  const C = fromHsl(h, sat, L),
    LIGHT = fromHsl(towards(h, 0.14, 0.15), sat, clamp(L + 0.2, 0.6, 0.85)),
    DARK = fromHsl(towards(h, 0.72, 0.15), sat, L - 0.2);
  const sec = secRgb(m);
  const OUTER: C3 = sec ? fromHsl(toHsl(sec)[0], 0.9, 0.7) : [255, 255, 255];
  const BLACK = '#141216';
  const faces = faceLayout(m, p, S);
  const ex = extrasOf(m, p, S, faces);
  const mask = silhouette(S, p, '#000', ex, 1);
  // Äußere Kontur als eigene Lage, schwarze innen
  const [outer, ox] = layer(S);
  ring(ox, tintedMask(mask, rgb(OUTER)), S * 0.024);
  ox.drawImage(tintedMask(mask, rgb(OUTER)), 0, 0);
  // Sprühnebel
  ctx.save();
  ctx.shadowColor = rgb(OUTER, 0.85);
  ctx.shadowBlur = S * 0.05;
  ctx.globalAlpha = 0.7;
  ctx.drawImage(outer, 0, 0);
  ctx.restore();
  // 3D-Schatten nach unten rechts
  const deep = tintedMask(outer, '#241a33');
  for (let k = 10; k >= 1; k--) ctx.drawImage(deep, k * S * 0.0028, k * S * 0.0034);
  ctx.drawImage(outer, 0, 0);
  ring(ctx, tintedMask(mask, BLACK), S * 0.009);
  // Füllung: Verlauf von hell nach dunkel über die ganze Figur
  const fade = ctx.createLinearGradient(0, y0, 0, y1);
  fade.addColorStop(0, rgb(LIGHT));
  fade.addColorStop(0.55, rgb(C));
  fade.addColorStop(1, rgb(DARK));
  for (const lm of p.geo.limbs) {
    ctx.strokeStyle = fade;
    strokeLimb(ctx, lm, S, lm.w * S);
  }
  const big = p.core.b.rx * p.core.b.ry;
  for (const o of p.bases) {
    ctx.fillStyle = o.b.leaf ? rgb(fromHsl(0.33, 0.8, 0.5)) : fade;
    smoothClosed(ctx, o.base);
    ctx.fill();
    if (o === p.core) {
      // Band in der Zweitfarbe mit Zacken und ein paar Blasen
      ctx.save();
      smoothClosed(ctx, o.base);
      ctx.clip();
      const by2 = (o.b.y + o.b.ry * 0.25) * S;
      ctx.fillStyle = rgb(sec ? fromHsl(toHsl(sec)[0], 0.85, 0.55) : DARK, 0.85);
      ctx.beginPath();
      ctx.moveTo(0, S);
      ctx.lineTo(0, by2);
      for (let x = 0; x <= S; x += S * 0.03) ctx.lineTo(x, by2 + ((x / (S * 0.03)) % 2 ? S * 0.02 : 0));
      ctx.lineTo(S, S);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.lineWidth = S * 0.004;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc((o.b.x + rr(r, -0.6, 0.6) * o.b.rx) * S, (o.b.y + rr(r, -0.6, 0.1) * o.b.ry) * S, S * rr(r, 0.01, 0.025), 0, 7);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = S * 0.005;
    smoothClosed(ctx, o.base);
    ctx.stroke();
    // Glanzstriche oben links
    if (o.b.rx * o.b.ry > big * 0.2 && !o.b.leaf) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';
      ctx.lineWidth = S * 0.011;
      ctx.beginPath();
      ctx.ellipse(o.b.x * S, o.b.y * S, o.b.rx * S * 0.72, o.b.ry * S * 0.72, o.b.rot || 0, Math.PI * 1.08, Math.PI * 1.32);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc((o.b.x - o.b.rx * 0.36) * S, (o.b.y - o.b.ry * 0.68) * S, S * 0.0065, 0, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }
  // Laufnasen unten an den Flächen
  for (const o of p.bases) {
    if (o.b.leaf) continue;
    const low = [...o.base].sort((a, b) => b[1] - a[1]).slice(0, 8);
    for (let k = 0; k < 2; k++) {
      if (r() < 0.35) continue;
      const q = low[Math.floor(r() * low.length)]!;
      const len = S * rr(r, 0.03, 0.09),
        w = S * rr(r, 0.006, 0.009);
      ctx.lineCap = 'round';
      ctx.strokeStyle = BLACK;
      ctx.lineWidth = w + S * 0.006;
      ctx.beginPath();
      ctx.moveTo(q[0], q[1] - S * 0.004);
      ctx.lineTo(q[0], q[1] + len);
      ctx.stroke();
      ctx.strokeStyle = rgb(DARK);
      ctx.lineWidth = w;
      ctx.stroke();
      ctx.fillStyle = rgb(DARK);
      ctx.beginPath();
      ctx.arc(q[0], q[1] + len, w * 0.9, 0, 7);
      ctx.fill();
    }
  }
  // Gesicht: große Augen mit schwerem Lid und Brauen
  for (const f of faces) {
    for (const st of f.stalks) {
      ctx.strokeStyle = BLACK;
      ctx.lineWidth = f.R * 0.1;
      limbPath(ctx, st);
      ctx.stroke();
    }
    for (const e of f.eyes) {
      const rad = e.r * (e.kind === 'punkt' ? 2.1 : 1.45);
      if (e.kind === 'schlitz' || e.kind === 'muede') {
        ctx.strokeStyle = BLACK;
        ctx.lineWidth = S * 0.008;
        ctx.beginPath();
        ctx.moveTo(e.x - rad, e.y);
        ctx.quadraticCurveTo(e.x, e.y + (e.kind === 'muede' ? rad * 0.5 : -rad * 0.2), e.x + rad, e.y);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = BLACK;
      ctx.lineWidth = S * 0.006;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, rad, rad * 1.2, 0, 0, 7);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.arc(e.x + rad * 0.2, e.y + rad * 0.25, rad * 0.55, 0, 7);
      ctx.fill();
      // Schweres Lid: cooler Blick
      ctx.fillStyle = rgb(DARK);
      ctx.fillRect(e.x - rad * 1.2, e.y - rad * 1.3, rad * 2.4, rad * 0.85);
      ctx.restore();
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, rad, rad * 1.2, 0, 0, 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(e.x - rad * 1.05, e.y - rad * 0.45);
      ctx.lineTo(e.x + rad * 1.05, e.y - rad * 0.45);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(e.x + rad * 0.05, e.y + rad * 0.12, rad * 0.16, 0, 7);
      ctx.fill();
    }
    if (f.eyes.length) {
      if (f.mouth.kind === 'grinsen' || f.mouth.kind === 'zaehne') {
        const { x, y } = f.mouth,
          R = f.R;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = BLACK;
        ctx.lineWidth = S * 0.005;
        ctx.beginPath();
        ctx.moveTo(x - R * 0.26, y - R * 0.08);
        ctx.quadraticCurveTo(x, y + R * 0.05, x + R * 0.26, y - R * 0.12);
        ctx.quadraticCurveTo(x, y + R * 0.3, x - R * 0.26, y - R * 0.08);
        ctx.fill();
        ctx.stroke();
      } else plainMouth(ctx, f, BLACK, S * 0.007);
    }
  }
  // Glanzsterne
  for (let i = 0; i < 3; i++) {
    const o = p.bases[i % p.bases.length]!;
    const x = (o.b.x + rr(r, -0.8, 0.2) * o.b.rx) * S,
      y = (o.b.y - rr(r, 0.4, 0.9) * o.b.ry) * S,
      s = S * rr(r, 0.018, 0.03);
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = s;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    star(ctx, x, y, s, s * 0.15, 4);
    ctx.fill();
    ctx.restore();
  }
  if (deco) graffitiTag(ctx, m, S, C, LIGHT, DARK, OUTER, r);
}
/** Name als Bubble-Schrift: Tiefe, helle und schwarze Kontur, Verlauf, Krone und Laufnasen */
function graffitiTag(ctx: Ctx, m: Monster, S: number, C: C3, LIGHT: C3, DARK: C3, OUTER: C3, r: Rand): void {
  const text = m.name;
  ctx.save();
  ctx.translate(S * 0.07, S * 0.93);
  ctx.rotate(-0.07);
  ctx.font = `900 ${S * 0.1}px Figtree, sans-serif`;
  ctx.lineJoin = 'round';
  const w = ctx.measureText(text).width;
  for (let k = 7; k >= 1; k--) {
    ctx.fillStyle = '#241a33';
    ctx.strokeStyle = '#241a33';
    ctx.lineWidth = S * 0.03;
    ctx.strokeText(text, k * S * 0.0025, k * S * 0.003);
  }
  ctx.strokeStyle = rgb(OUTER);
  ctx.lineWidth = S * 0.03;
  ctx.strokeText(text, 0, 0);
  ctx.strokeStyle = '#141216';
  ctx.lineWidth = S * 0.014;
  ctx.strokeText(text, 0, 0);
  const g = ctx.createLinearGradient(0, -S * 0.08, 0, 0);
  g.addColorStop(0, rgb(LIGHT));
  g.addColorStop(0.6, rgb(C));
  g.addColorStop(1, rgb(DARK));
  ctx.fillStyle = g;
  ctx.fillText(text, 0, 0);
  // Krone über dem ersten Buchstaben
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#141216';
  ctx.lineWidth = S * 0.004;
  ctx.beginPath();
  const cx = S * 0.02,
    cy = -S * 0.1;
  ctx.moveTo(cx - S * 0.03, cy);
  ctx.lineTo(cx - S * 0.035, cy - S * 0.035);
  ctx.lineTo(cx - S * 0.015, cy - S * 0.015);
  ctx.lineTo(cx, cy - S * 0.045);
  ctx.lineTo(cx + S * 0.015, cy - S * 0.015);
  ctx.lineTo(cx + S * 0.035, cy - S * 0.035);
  ctx.lineTo(cx + S * 0.03, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Laufnasen aus der Schrift
  ctx.strokeStyle = rgb(DARK);
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = rr(r, 0.1, 0.9) * w,
      len = S * rr(r, 0.015, 0.045);
    ctx.lineWidth = S * 0.006;
    ctx.beginPath();
    ctx.moveTo(x, S * 0.005);
    ctx.lineTo(x, S * 0.005 + len);
    ctx.stroke();
  }
  ctx.restore();
  // Seriennummer als schnelles Kürzel in der Ecke
  ctx.fillStyle = '#141216';
  ctx.font = `400 ${S * 0.05}px Caveat, cursive`;
  ctx.fillText(serialOf(m), S * 0.78, S * 0.08);
}

/* =====================================================================
 * Art Nouveau (gezeichnet 31.10.2026, im Spiel seit 31.10.2026): Jugendstil-Karte wie ein Plakat um 1900. Großer Nimbus mit Ringen und
 * Strahlen, Lilien und Ranken mit Peitschenschwung, gedämpfte Farben, braune Linie mit Druck, Rahmen und Titelfeld
 * ===================================================================== */
const NV = { ink: '#4a3424', cream: '#efe4c9', gold: '#c9a24b', paleGold: '#ead7a2', sage: '#93a98a', teal: '#5f8f8a', rose: '#d4a29a' };
/** Spirale wie ein Peitschenschwung, von außen nach innen */
function spiral(ctx: Ctx, x: number, y: number, R: number, turns: number, dir: number, a0: number): void {
  ctx.beginPath();
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      a = a0 + dir * t * turns * Math.PI * 2,
      rad = R * (1 - t * 0.85);
    const px = x + Math.cos(a) * rad,
      py = y + Math.sin(a) * rad;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
}
/** Eine Lilie: Stängel mit Schwung, Blätter, Blüte aus fünf Blütenblättern */
function lily(ctx: Ctx, x: number, y: number, tx: number, ty: number, S: number, r: Rand, col: string): void {
  const cx1 = x + (tx - x) * 0.1 + (r() < 0.5 ? -1 : 1) * S * 0.12,
    cy1 = y + (ty - y) * 0.45;
  ctx.strokeStyle = NV.ink;
  ctx.lineWidth = S * 0.006;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(cx1, cy1, tx, ty);
  ctx.stroke();
  ctx.strokeStyle = NV.sage;
  ctx.lineWidth = S * 0.0035;
  ctx.stroke();
  // Blätter entlang des Stängels
  for (let k = 1; k <= 3; k++) {
    const t = k / 4.2,
      px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx1 + t * t * tx,
      py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy1 + t * t * ty;
    const a = (k % 2 ? -1 : 1) * 0.9 - Math.PI / 2;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = k % 2 ? NV.sage : NV.teal;
    ctx.strokeStyle = NV.ink;
    ctx.lineWidth = S * 0.003;
    ctx.beginPath();
    ctx.ellipse(S * 0.03, 0, S * 0.032, S * 0.011, 0, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // Blüte
  ctx.fillStyle = col;
  ctx.strokeStyle = NV.ink;
  ctx.lineWidth = S * 0.003;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k - 2) * 0.55;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(S * 0.025, 0, S * 0.026, S * 0.011, 0, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = NV.gold;
  ctx.beginPath();
  ctx.arc(tx, ty, S * 0.008, 0, 7);
  ctx.fill();
}
export function nouveau(ctx: Ctx, m: Monster, S: number, deco: boolean): void {
  const p = prep(m, S, 0.1, 2);
  const r = RNG(m.seed + 1900);
  const { cx, x0, y0, x1, y1 } = centerOf(p);
  const faces = faceLayout(m, p, S);
  // Grund: Creme, unten leicht salbeigrün
  const bg = ctx.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, NV.cream);
  bg.addColorStop(1, '#dfe2c8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  // Nimbus hinter Kopf und Körper
  const f0 = faces[0];
  const R = clamp(Math.max(x1 - x0, (y1 - y0) * 0.7) * 0.55, S * 0.22, S * 0.36);
  // Der Nimbus bleibt ganz im Bild, auch wenn der Kopf am Rand sitzt
  const hx = clamp(f0 ? f0.X : cx, R + S * 0.05, S - R - S * 0.05),
    hy = clamp(f0 ? f0.Y : y0 + (y1 - y0) * 0.35, R + S * 0.05, S - R - S * 0.05);
  ctx.fillStyle = NV.paleGold;
  ctx.beginPath();
  ctx.arc(hx, hy, R, 0, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(74,52,36,.28)';
  ctx.lineWidth = S * 0.002;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(a) * R * 0.3, hy + Math.sin(a) * R * 0.3);
    ctx.lineTo(hx + Math.cos(a) * R * 0.8, hy + Math.sin(a) * R * 0.8);
    ctx.stroke();
  }
  // Band mit Steinchen zwischen zwei Ringen
  ctx.fillStyle = NV.gold;
  ctx.beginPath();
  ctx.arc(hx, hy, R, 0, 7);
  ctx.arc(hx, hy, R * 0.82, 0, 7, true);
  ctx.fill();
  const nDots = 36;
  for (let k = 0; k < nDots; k++) {
    const a = (k / nDots) * Math.PI * 2;
    ctx.fillStyle = k % 3 === 0 ? NV.teal : k % 3 === 1 ? NV.rose : NV.cream;
    ctx.beginPath();
    ctx.arc(hx + Math.cos(a) * R * 0.91, hy + Math.sin(a) * R * 0.91, R * 0.045, 0, 7);
    ctx.fill();
  }
  ctx.strokeStyle = NV.ink;
  ctx.lineWidth = S * 0.004;
  for (const k of [1, 0.82, 0.3]) {
    ctx.beginPath();
    ctx.arc(hx, hy, R * k, 0, 7);
    ctx.stroke();
  }
  // Lilien aus den unteren Ecken
  const fy = Math.min(S * 0.97, Math.max(y1, S * 0.8));
  lily(ctx, S * 0.04, S * 1.0, S * 0.14, fy - S * 0.36, S, r, NV.rose);
  lily(ctx, S * 0.96, S * 1.0, S * 0.86, fy - S * 0.3, S, r, NV.cream);
  if (r() < 0.6) lily(ctx, S * 0.1, S * 1.0, S * 0.24, fy - S * 0.18, S, r, NV.cream);
  // Figur: gedämpfte Farbe, braune Linie, fließende Innenlinien
  const [h, s0, l0] = toHsl(mainRgb(m));
  const C = fromHsl(h, clamp(s0 * 0.45 + 0.12, 0.22, 0.5), clamp(l0 * 0.3 + 0.52, 0.55, 0.74));
  const sec = secRgb(m);
  const ex = extrasOf(m, p, S, faces);
  ring(ctx, silhouette(S, p, NV.ink, ex), S * 0.0065);
  for (const lm of p.geo.limbs) {
    ctx.strokeStyle = rgb(C);
    strokeLimb(ctx, lm, S, lm.w * S);
  }
  for (const o of p.bases) {
    ctx.fillStyle = o.b.leaf ? NV.sage : rgb(C);
    smoothClosed(ctx, o.base);
    ctx.fill();
    ctx.save();
    smoothClosed(ctx, o.base);
    ctx.clip();
    if (o === p.core && sec) {
      ctx.fillStyle = rgb(fromHsl(toHsl(sec)[0], 0.35, 0.78));
      ctx.beginPath();
      ctx.ellipse(o.b.x * S, (o.b.y + o.b.ry * 0.4) * S, o.b.rx * S * 0.55, o.b.ry * S * 0.45, o.b.rot || 0, 0, 7);
      ctx.fill();
    }
    const g = ctx.createLinearGradient((o.b.x - o.b.rx) * S, (o.b.y - o.b.ry) * S, (o.b.x + o.b.rx) * S, (o.b.y + o.b.ry) * S);
    g.addColorStop(0, 'rgba(255,248,230,.25)');
    g.addColorStop(1, 'rgba(74,52,36,.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    // Fließende Innenlinien wie Faltenwurf
    ctx.strokeStyle = 'rgba(74,52,36,.35)';
    ctx.lineWidth = S * 0.0025;
    for (const k of [0.72]) {
      ctx.beginPath();
      o.base.forEach((q, i) => {
        const px = o.b.x * S + (q[0] - o.b.x * S) * k,
          py = o.b.y * S + (q[1] - o.b.y * S) * k + o.b.ry * S * (1 - k) * 0.35;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = NV.ink;
    ctx.lineWidth = S * 0.0035;
    smoothClosed(ctx, o.base);
    ctx.stroke();
  }
  // Ruhiges Gesicht: Mandelaugen mit schwerem Lid, kleiner Mund in Rosé
  for (const f of faces) {
    for (const st of f.stalks) {
      ctx.strokeStyle = NV.ink;
      ctx.lineWidth = f.R * 0.07;
      limbPath(ctx, st);
      ctx.stroke();
    }
    for (const e of f.eyes) {
      const w = e.r * (e.kind === 'punkt' ? 2 : 1.3),
        hh = w * 0.5;
      ctx.fillStyle = '#fbf6ea';
      ctx.strokeStyle = NV.ink;
      ctx.lineWidth = S * 0.003;
      ctx.beginPath();
      ctx.moveTo(e.x - w, e.y);
      ctx.quadraticCurveTo(e.x, e.y - hh * 1.6, e.x + w, e.y);
      ctx.quadraticCurveTo(e.x, e.y + hh * 1.3, e.x - w, e.y);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = NV.teal;
      ctx.beginPath();
      ctx.arc(e.x, e.y + hh * 0.1, hh * 0.85, 0, 7);
      ctx.fill();
      ctx.fillStyle = NV.ink;
      ctx.beginPath();
      ctx.arc(e.x, e.y + hh * 0.1, hh * 0.38, 0, 7);
      ctx.fill();
      // Lid halb geschlossen
      ctx.fillStyle = rgb(shade(C, 0.92));
      ctx.fillRect(e.x - w * 1.2, e.y - hh * 2, w * 2.4, hh * (e.kind === 'muede' || e.kind === 'schlitz' ? 2.1 : 1.45));
      ctx.restore();
      ctx.lineWidth = S * 0.0045;
      ctx.beginPath();
      ctx.moveTo(e.x - w * 1.05, e.y - hh * 0.05);
      ctx.quadraticCurveTo(e.x, e.y - hh * (e.kind === 'muede' || e.kind === 'schlitz' ? 0.3 : 1.05), e.x + w * 1.05, e.y - hh * 0.05);
      ctx.stroke();
      // Feine Braue
      ctx.lineWidth = S * 0.002;
      ctx.beginPath();
      ctx.moveTo(e.x - w * 0.9, e.y - hh * 2.1);
      ctx.quadraticCurveTo(e.x, e.y - hh * 2.8, e.x + w * 1.1, e.y - hh * 2.0);
      ctx.stroke();
    }
    if (f.eyes.length && f.mouth.kind !== 'keiner') {
      const { x, y } = f.mouth,
        Rm = f.R;
      ctx.fillStyle = '#c97a72';
      ctx.beginPath();
      ctx.ellipse(x, y - Rm * 0.02, Rm * 0.1, Rm * 0.045, 0, 0, 7);
      ctx.fill();
    }
  }
  grainOver(ctx, S, 0.12, 'multiply', 420);
  // Rahmen: klein ein feiner Doppelrand, groß das ganze Plakat
  ctx.strokeStyle = NV.ink;
  if (!deco) {
    ctx.lineWidth = S * 0.006;
    ctx.strokeRect(S * 0.03, S * 0.03, S * 0.94, S * 0.94);
    return;
  }
  ctx.lineWidth = S * 0.008;
  ctx.strokeRect(S * 0.025, S * 0.025, S * 0.95, S * 0.95);
  ctx.lineWidth = S * 0.003;
  ctx.strokeRect(S * 0.045, S * 0.045, S * 0.91, S * 0.91);
  // Bogen oben mit Spiralen in den Ecken
  ctx.lineWidth = S * 0.005;
  ctx.beginPath();
  ctx.moveTo(S * 0.045, S * 0.2);
  ctx.bezierCurveTo(S * 0.2, S * 0.05, S * 0.8, S * 0.05, S * 0.955, S * 0.2);
  ctx.stroke();
  for (const [x, y, dir] of [
    [S * 0.11, S * 0.11, 1],
    [S * 0.89, S * 0.11, -1],
    [S * 0.11, S * 0.83, -1],
    [S * 0.89, S * 0.83, 1],
  ] as const) {
    ctx.lineWidth = S * 0.004;
    spiral(ctx, x, y, S * 0.045, 1.6, dir, dir > 0 ? Math.PI : 0);
  }
  // Titelfeld unten mit dem Namen, Seriennummer im kleinen Schild oben
  const ty = S * 0.875;
  ctx.fillStyle = NV.gold;
  ctx.beginPath();
  ctx.roundRect(S * 0.16, ty, S * 0.68, S * 0.085, S * 0.042);
  ctx.fill();
  ctx.lineWidth = S * 0.005;
  ctx.stroke();
  ctx.fillStyle = NV.ink;
  ctx.font = `400 ${S * 0.042}px "Young Serif", serif`;
  ctx.textAlign = 'center';
  const name = m.name.toUpperCase().split('').join(' ');
  ctx.fillText(name, S * 0.5, ty + S * 0.058);
  ctx.fillStyle = NV.cream;
  ctx.beginPath();
  ctx.roundRect(S * 0.4, S * 0.035, S * 0.2, S * 0.05, S * 0.02);
  ctx.fill();
  ctx.lineWidth = S * 0.003;
  ctx.stroke();
  ctx.fillStyle = NV.ink;
  ctx.font = `400 ${S * 0.026}px "Young Serif", serif`;
  ctx.fillText(`No. ${String(m.seed % 100000).padStart(5, '0')}`, S * 0.5, S * 0.068);
  ctx.textAlign = 'left';
}

/** Entwurf: alle neuen Stile unter einem Namen */
export const MORE_STYLES = {
  anime_sky: (ctx: Ctx, m: Monster, S: number, deco: boolean) => anime2(ctx, m, S, 'sky', deco),
  anime_focus: (ctx: Ctx, m: Monster, S: number, deco: boolean) => anime2(ctx, m, S, 'focus', deco),
  pixel,
  ukiyoe,
  stained,
  neon,
  blueprint,
  crayon,
  papercut,
  mosaic,
  graffiti,
  nouveau,
} as const;
export type MoreStyle = keyof typeof MORE_STYLES;
/** Wie renderStyled: Leinwand vorbereiten und im Entwurfsstil malen */
export function renderMore(canvas: HTMLCanvasElement, m: Monster, style: MoreStyle, cssSize: number, opts: { dpr?: number; deco?: boolean } = {}): number {
  const t0 = performance.now();
  const dpr = opts.dpr ?? Math.min(2, window.devicePixelRatio || 1);
  const S = Math.max(200, Math.round(cssSize * dpr));
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const mm: Monster = m.gen === 2 ? { ...m, face: { ...m.face, extra: 'keins' } } : m;
  MORE_STYLES[style](ctx, mm, S, opts.deco ?? false);
  return performance.now() - t0;
}
