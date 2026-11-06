/*
 * Einstieg E1 als Artifact (freigegeben am 06.11.2026, docs/entwuerfe/einstieg-vorschlag.md): erste Schritte auf einem
 * wachsenden Blatt. Fünf Schritte, je ein Satz von Sepia, die Kamera zeigt erst 2 × 2 Felder und zoomt mit jedem Schritt
 * heraus. Gescriptet (feste Würfe), Kleckse aus dem echten Renderer, 3D-Würfel und Klänge aus dem Spiel.
 * Baut zu einer Seite: node tools/mockup/einstieg/build.mjs <ziel.html>
 */
import { renderMonster } from '../../../src/client/renderer/watercolor';
import { makeCube, tumble } from '../../../src/client/duel/dice3d';
import { initAudio, sfx } from '../../../src/client/duel/sound';
import { PIG, type PigmentId } from '../../../src/shared/data';
import type { Face } from '../../../src/shared/duel/rules';
import { humidityFor, makeMonster, type Monster } from '../../../src/shared/monster';
import { RNG } from '../../../src/shared/rng';

/* ---------- Blatt und Farben ---------- */
const COLS = 6,
  ROWS = 8;
type RGB = [number, number, number];
const YOU: RGB = [43, 63, 163];
const RIVAL: RGB = [163, 58, 58];
const GOLD = '#c9961e';
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = (ms: number) => (reduced ? Math.min(ms, 120) : ms);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, T(ms)));

const mon = (sheet: string, idx: number): Monster => ({ ...makeMonster(sheet, idx, humidityFor(sheet)), gen: 2 });

/* ---------- Zustand ---------- */
type Unit = { id: string; m: Monster; side: 1 | 2; x: number; y: number; img: HTMLCanvasElement | null; s: number; a: number; dx: number; dy: number };
type Paint = { side: 1 | 2; tile: HTMLCanvasElement; t0: number };
type Fx = { x: number; y: number; vx: number; vy: number; life: number; max: number; col: RGB; r: number };
type Num = { x: number; y: number; text: string; t0: number; big: boolean };
type Shot = { x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; col: RGB };

let run = 0;
let units: Unit[] = [];
let paint = new Map<number, Paint>();
let fx: Fx[] = [];
let nums: Num[] = [];
let shots: Shot[] = [];
let hearts = { 1: 3, 2: 3 } as Record<1 | 2, number>;
let crack = { 1: 0, 2: 0 } as Record<1 | 2, number>;
/** Ziel des Schritts: ein Feld mit goldenem Ring, ein Klecks, der hin soll, oder ein Netz zum Antippen */
let ring: number | null = null;
let from: Unit | null = null;
let net: number[] | null = null;
let netFill: { cells: number[]; side: 1 | 2; t0: number } | null = null;
/** Sichtbarer Ausschnitt in Feldern: links, oben, Breite, Höhe (die Kamera gleitet dorthin) */
let cam = { x: 2, y: 5, w: 2, h: 2 };
let camFrom = { ...cam };
let camTo = { ...cam };
let camT0 = 0;
let camDur = 1;
let freeze = 0;

const idx = (c: number, r: number) => r * COLS + c;
const cx = (i: number) => i % COLS;
const cy = (i: number) => Math.floor(i / COLS);
const HOME: Record<1 | 2, number> = { 1: idx(2, 7), 2: idx(2, 0) };

/* ---------- Kleckse aus dem Renderer, freigestellt wie im Duell ---------- */
function sticker(m: Monster, size: number): HTMLCanvasElement {
  const raw = document.createElement('canvas');
  renderMonster(raw, m, size, { dpr: 2, paper: false, look: true });
  const S = raw.width;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return [c, c.getContext('2d')!] as const;
  };
  const [sil, sx] = mk();
  for (let k = 0; k < 2; k++) sx.drawImage(raw, 0, 0);
  sx.globalCompositeOperation = 'source-in';
  sx.fillStyle = '#fffdf8';
  sx.fillRect(0, 0, S, S);
  const [img, ix] = mk();
  const e = Math.max(2, S * 0.03);
  ix.globalAlpha = 0.22;
  ix.filter = 'brightness(0)';
  ix.drawImage(sil, 0, e * 1.6);
  ix.filter = 'none';
  ix.globalAlpha = 1;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ix.drawImage(sil, Math.cos(a) * e, Math.sin(a) * e);
  }
  ix.drawImage(raw, 0, 0);
  return img;
}

/* ---------- Nasse Farbe auf einem Feld: mehrere Lavierungen mit dunklem Rand ---------- */
function washTile(col: RGB, seed: number): HTMLCanvasElement {
  const P = 160;
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(P * 1.24);
  const x = c.getContext('2d')!;
  const r = RNG(seed);
  const m = c.width / 2;
  const shape = (k: number) => {
    x.beginPath();
    const n = 26;
    const ph = r() * 6;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sq = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      const rad = (P / 2) * (0.62 * sq + 0.3) * (0.95 + k * 0.02) * (1 + 0.05 * Math.sin(a * 5 + ph) + (r() - 0.5) * 0.06);
      const px = m + Math.cos(a) * rad,
        py = m + Math.sin(a) * rad;
      if (i) x.lineTo(px, py);
      else x.moveTo(px, py);
    }
    x.closePath();
  };
  for (let k = 0; k < 5; k++) {
    shape(k);
    x.fillStyle = rgba(col, 0.17);
    x.fill();
  }
  shape(5);
  x.strokeStyle = rgba([col[0] * 0.75, col[1] * 0.75, col[2] * 0.75] as RGB, 0.38);
  x.lineWidth = 2.2;
  x.filter = 'blur(0.8px)';
  x.stroke();
  x.filter = 'none';
  // Körnung
  for (let k = 0; k < 160; k++) {
    x.fillStyle = rgba(col, 0.1 + r() * 0.12);
    x.fillRect(m + (r() - 0.5) * P * 0.9, m + (r() - 0.5) * P * 0.9, 1.6, 1.6);
  }
  return c;
}
let paintSeed = 1;
function paintCell(i: number, side: 1 | 2, delay = 0): void {
  paint.set(i, { side, tile: washTile(side === 1 ? YOU : RIVAL, paintSeed++ * 7919), t0: performance.now() + T(delay) });
}

/* ---------- Zeichnen ---------- */
const board = document.getElementById('board') as HTMLCanvasElement;
const bx = board.getContext('2d')!;
let W = 0,
  H = 0,
  DPR = 1;
function fit(): void {
  const r = board.getBoundingClientRect();
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = r.width;
  H = r.height;
  board.width = Math.round(W * DPR);
  board.height = Math.round(H * DPR);
}
new ResizeObserver(fit).observe(board);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const view = () => {
  const t = Math.min(1, (performance.now() - camT0) / camDur);
  const k = ease(t);
  const c = { x: camFrom.x + (camTo.x - camFrom.x) * k, y: camFrom.y + (camTo.y - camFrom.y) * k, w: camFrom.w + (camTo.w - camFrom.w) * k, h: camFrom.h + (camTo.h - camFrom.h) * k };
  const pad = 0.28;
  const s = Math.min(W / (c.w + pad * 2), H / (c.h + pad * 2 + 0.35));
  return { s, ox: W / 2 - (c.x + c.w / 2) * s, oy: H / 2 - (c.y + c.h / 2) * s + s * 0.12 };
};
function zoom(to: { x: number; y: number; w: number; h: number }, ms = 1000): Promise<void> {
  camFrom = { ...cam };
  cam = { ...to };
  camTo = { ...to };
  camT0 = performance.now();
  camDur = T(ms);
  return sleep(ms);
}
let noise: CanvasPattern | null = null;
function paperPattern(): CanvasPattern | null {
  if (noise) return noise;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const r = RNG(42);
  for (let k = 0; k < 2200; k++) {
    x.fillStyle = `rgba(90,80,60,${0.025 + r() * 0.04})`;
    x.fillRect(r() * 128, r() * 128, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  noise = bx.createPattern(c, 'repeat');
  return noise;
}
function heartPath(x: CanvasRenderingContext2D, px: number, py: number, s: number): void {
  x.beginPath();
  x.moveTo(px, py + s * 0.35);
  x.bezierCurveTo(px - s * 0.9, py - s * 0.2, px - s * 0.4, py - s * 0.85, px, py - s * 0.35);
  x.bezierCurveTo(px + s * 0.4, py - s * 0.85, px + s * 0.9, py - s * 0.2, px, py + s * 0.35);
  x.closePath();
}
function drawPalette(side: 1 | 2, s: number, ox: number, oy: number): void {
  const i = HOME[side];
  const px = ox + (cx(i) + 0.5) * s,
    py = oy + (cy(i) + 0.5) * s;
  const col = side === 1 ? YOU : RIVAL;
  const sh = crack[side] ? Math.sin(performance.now() / 22) * s * 0.03 * Math.max(0, 1 - (performance.now() - crack[side]) / 500) : 0;
  bx.save();
  bx.translate(px + sh, py);
  bx.fillStyle = '#fffdf8';
  bx.strokeStyle = rgba(col, 0.95);
  bx.lineWidth = Math.max(2, s * 0.04);
  bx.beginPath();
  bx.ellipse(0, 0, s * 0.44, s * 0.36, 0, 0, Math.PI * 2);
  bx.fill();
  bx.stroke();
  for (let k = 0; k < 3; k++) {
    const hx = (k - 1) * s * 0.22,
      hy = k === 1 ? -s * 0.06 : 0;
    heartPath(bx, hx, hy, s * 0.13);
    if (k < hearts[side]) {
      bx.fillStyle = rgba(col, 1);
      bx.fill();
    } else {
      bx.strokeStyle = 'rgba(95,100,116,.6)';
      bx.lineWidth = Math.max(1, s * 0.015);
      bx.stroke();
      bx.beginPath();
      bx.moveTo(hx - s * 0.05, hy - s * 0.08);
      bx.lineTo(hx + s * 0.01, hy - s * 0.01);
      bx.lineTo(hx - s * 0.02, hy + s * 0.05);
      bx.stroke();
    }
  }
  bx.restore();
  bx.fillStyle = rgba(col, 0.9);
  bx.font = `700 ${Math.max(9, s * 0.13)}px "JetBrains Mono", ui-monospace, monospace`;
  bx.textAlign = 'left';
  bx.fillText(side === 1 ? 'YOU' : 'RIVAL', px + s * 0.5, py + s * 0.05);
}
function drawUnit(u: Unit, s: number, ox: number, oy: number, ghost?: { x: number; y: number }): void {
  const px = ghost ? ghost.x : ox + (u.x + 0.5) * s + u.dx * s,
    py = ghost ? ghost.y : oy + (u.y + 0.5) * s + u.dy * s;
  const col = u.side === 1 ? YOU : RIVAL;
  bx.save();
  bx.globalAlpha = u.a;
  // Sockel in der Farbe der Seite
  bx.fillStyle = rgba(col, 0.85);
  bx.beginPath();
  bx.ellipse(px, py + s * 0.3, s * 0.36 * u.s, s * 0.11 * u.s, 0, 0, Math.PI * 2);
  bx.fill();
  if (u.img) {
    const z = s * 1.55 * u.s;
    bx.drawImage(u.img, px - z / 2, py + s * 0.36 - z * 0.92, z, z);
  }
  bx.restore();
}
function drawRing(i: number, s: number, ox: number, oy: number, now: number): void {
  const px = ox + (cx(i) + 0.5) * s,
    py = oy + (cy(i) + 0.5) * s;
  const p = 0.5 + 0.5 * Math.sin(now / 260);
  bx.fillStyle = `rgba(255,248,220,${0.45 + p * 0.2})`;
  bx.fillRect(ox + cx(i) * s + 2, oy + cy(i) * s + 2, s - 4, s - 4);
  bx.lineWidth = Math.max(3, s * 0.05);
  bx.strokeStyle = 'rgba(60,40,10,.55)';
  bx.beginPath();
  bx.arc(px, py, s * (0.38 + p * 0.03), 0, Math.PI * 2);
  bx.stroke();
  bx.strokeStyle = GOLD;
  bx.lineWidth = Math.max(2, s * 0.035);
  bx.stroke();
}
function drawArrow(a: Unit, i: number, s: number, ox: number, oy: number, now: number): void {
  const x0 = ox + (a.x + 0.5) * s,
    y0 = oy + (a.y + 0.5) * s,
    x1 = ox + (cx(i) + 0.5) * s,
    y1 = oy + (cy(i) + 0.5) * s;
  const mx = (x0 + x1) / 2 - (y1 - y0) * 0.18,
    my = (y0 + y1) / 2 + (x1 - x0) * 0.18;
  bx.save();
  bx.setLineDash([s * 0.08, s * 0.07]);
  bx.lineDashOffset = -now / 30;
  bx.lineWidth = Math.max(3, s * 0.045);
  bx.strokeStyle = 'rgba(60,40,10,.45)';
  bx.beginPath();
  bx.moveTo(x0, y0);
  bx.quadraticCurveTo(mx, my, x1, y1);
  bx.stroke();
  bx.strokeStyle = GOLD;
  bx.lineWidth = Math.max(2, s * 0.03);
  bx.stroke();
  bx.restore();
  // wandernder Punkt
  const t = (now / 1100) % 1;
  const qx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1,
    qy = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1;
  bx.fillStyle = GOLD;
  bx.strokeStyle = 'rgba(60,40,10,.6)';
  bx.lineWidth = 2;
  bx.beginPath();
  bx.arc(qx, qy, Math.max(4, s * 0.06), 0, Math.PI * 2);
  bx.fill();
  bx.stroke();
}
let drag: { u: Unit; x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;
let armed: Unit | null = null;
function frame(now: number): void {
  requestAnimationFrame(frame);
  if (!W) fit();
  const { s, ox, oy } = view();
  bx.setTransform(DPR, 0, 0, DPR, 0, 0);
  bx.fillStyle = '#e4e1d8';
  bx.fillRect(0, 0, W, H);
  // Papier
  bx.fillStyle = '#fbfaf6';
  bx.fillRect(ox, oy, COLS * s, ROWS * s);
  const pat = paperPattern();
  if (pat) {
    bx.fillStyle = pat;
    bx.fillRect(ox, oy, COLS * s, ROWS * s);
  }
  bx.strokeStyle = 'rgba(80,70,50,.09)';
  bx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) {
    bx.beginPath();
    bx.moveTo(ox + c * s, oy);
    bx.lineTo(ox + c * s, oy + ROWS * s);
    bx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    bx.beginPath();
    bx.moveTo(ox, oy + r * s);
    bx.lineTo(ox + COLS * s, oy + r * s);
    bx.stroke();
  }
  // Farbe auf den Feldern (blüht beim Auftragen auf)
  for (const [i, p] of paint) {
    const t = Math.max(0, Math.min(1, (now - p.t0) / 420));
    if (t <= 0) continue;
    const z = s * 1.18 * (0.7 + 0.3 * ease(t));
    bx.globalAlpha = t;
    bx.drawImage(p.tile, ox + (cx(i) + 0.5) * s - z / 2, oy + (cy(i) + 0.5) * s - z / 2, z, z);
    bx.globalAlpha = 1;
  }
  // Netz zum Antippen: gestrichelt mit hellem Feld
  if (net) {
    const p = 0.5 + 0.5 * Math.sin(now / 260);
    for (const i of net) {
      bx.fillStyle = `rgba(255,244,205,${0.55 + p * 0.25})`;
      bx.fillRect(ox + cx(i) * s + 3, oy + cy(i) * s + 3, s - 6, s - 6);
      bx.save();
      bx.setLineDash([6, 5]);
      bx.strokeStyle = GOLD;
      bx.lineWidth = Math.max(2, s * 0.03);
      bx.strokeRect(ox + cx(i) * s + 3, oy + cy(i) * s + 3, s - 6, s - 6);
      bx.restore();
    }
  }
  // Paletten
  drawPalette(2, s, ox, oy);
  drawPalette(1, s, ox, oy);
  // Ziel und Pfeil
  if (ring !== null) {
    drawRing(ring, s, ox, oy, now);
    if (from && !drag) drawArrow(from, ring, s, ox, oy, now);
  }
  // Kleckse, hintere zuerst
  for (const u of [...units].sort((a, b) => a.y - b.y)) {
    if (drag && drag.u === u && drag.moved) continue;
    if (armed === u) {
      bx.strokeStyle = GOLD;
      bx.lineWidth = 3;
      bx.beginPath();
      bx.ellipse(ox + (u.x + 0.5) * s, oy + (u.y + 0.5) * s + s * 0.3, s * 0.44, s * 0.15, 0, 0, Math.PI * 2);
      bx.stroke();
    }
    drawUnit(u, s, ox, oy);
  }
  if (drag && drag.moved) drawUnit(drag.u, s, ox, oy, { x: drag.x, y: drag.y - s * 0.25 });
  // Spritzer im Flug
  for (const sh of shots) {
    const t = Math.min(1, (now - sh.t0) / sh.dur);
    const x = sh.x0 + (sh.x1 - sh.x0) * t,
      y = sh.y0 + (sh.y1 - sh.y0) * t - Math.sin(t * Math.PI) * 0.9;
    bx.fillStyle = rgba(sh.col, 0.9);
    bx.beginPath();
    bx.arc(ox + (x + 0.5) * s, oy + (y + 0.5) * s, s * 0.12, 0, Math.PI * 2);
    bx.fill();
  }
  shots = shots.filter((sh) => now - sh.t0 < sh.dur);
  // Tropfen
  for (const p of fx) {
    if (now >= freeze) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.004;
      p.life -= 1;
    }
    bx.fillStyle = rgba(p.col, Math.max(0, p.life / p.max) * 0.9);
    bx.beginPath();
    bx.arc(ox + p.x * s, oy + p.y * s, Math.max(1.5, p.r * s), 0, Math.PI * 2);
    bx.fill();
  }
  fx = fx.filter((p) => p.life > 0);
  // Zahlen
  for (const n of nums) {
    const t = (now - n.t0) / 1300;
    if (t > 1) continue;
    const y = oy + n.y * s - t * s * 0.6;
    const a = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
    bx.globalAlpha = a;
    bx.font = `400 ${Math.round(s * (n.big ? 0.42 : 0.3))}px "Young Serif", Georgia, serif`;
    bx.textAlign = 'center';
    bx.lineWidth = Math.max(3, s * 0.05);
    bx.strokeStyle = '#fffdf8';
    bx.strokeText(n.text, ox + n.x * s, y);
    bx.fillStyle = '#1d2130';
    bx.fillText(n.text, ox + n.x * s, y);
    bx.globalAlpha = 1;
  }
  nums = nums.filter((n) => now - n.t0 < 1300);
  // Außerhalb des Ausschnitts leicht abgedeckt, damit der Blick auf den Feldern bleibt
  bx.fillStyle = 'rgba(228,225,216,.62)';
  const c = cam;
  bx.fillRect(0, 0, W, oy + c.y * s);
  bx.fillRect(0, oy + (c.y + c.h) * s, W, H);
  bx.fillRect(0, oy + c.y * s, ox + c.x * s, c.h * s);
  bx.fillRect(ox + (c.x + c.w) * s, oy + c.y * s, W, c.h * s);
}
requestAnimationFrame(frame);

/* ---------- Effekte ---------- */
function tween(ms: number, f: (k: number) => void): Promise<void> {
  const t0 = performance.now(),
    d = T(ms);
  return new Promise((res) => {
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / d);
      f(k);
      if (k < 1) requestAnimationFrame(step);
      else res();
    };
    requestAnimationFrame(step);
  });
}
function splatter(x: number, y: number, col: RGB, n: number, power: number): void {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2,
      v = (0.01 + Math.random() * 0.04) * power;
    const life = 30 + Math.random() * 30;
    fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.01, life, max: life, col, r: 0.02 + Math.random() * 0.04 });
  }
}
async function hop(u: Unit, to: number): Promise<void> {
  const x0 = u.x,
    y0 = u.y,
    x1 = cx(to),
    y1 = cy(to);
  sfx.step();
  await tween(320, (k) => {
    u.x = x0 + (x1 - x0) * k;
    u.y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 0.35;
  });
  u.x = x1;
  u.y = y1;
  sfx.brush();
  await tween(160, (k) => (u.s = 1 + 0.12 * Math.sin(k * Math.PI)));
}
async function unfold(cells: number[], side: 1 | 2, u: Unit): Promise<void> {
  for (let k = 0; k < cells.length; k++) {
    paintCell(cells[k]!, side);
    sfx.flip(k);
    await sleep(110);
  }
  await sleep(220);
  u.s = 0;
  u.a = 1;
  units.push(u);
  sfx.rise();
  await tween(380, (k) => (u.s = k < 0.7 ? (k / 0.7) * 1.12 : 1.12 - ((k - 0.7) / 0.3) * 0.12));
}
async function splash(a: Unit, t: Unit | null, at: number, dmg: string, col: RGB): Promise<void> {
  sfx.launch();
  await tween(90, (k) => (a.dy = -0.08 * k));
  a.dy = 0;
  shots.push({ x0: a.x, y0: a.y, x1: cx(at), y1: cy(at), t0: performance.now(), dur: T(380), col });
  await sleep(380);
  freeze = performance.now() + T(110);
  sfx.impact(1, true);
  splatter(cx(at) + 0.5, cy(at) + 0.5, col, 26, 1.2);
  nums.push({ x: cx(at) + 0.5, y: cy(at) + 0.1, text: dmg, t0: performance.now(), big: true });
  if (t) await tween(260, (k) => (t.dx = Math.sin(k * Math.PI * 6) * 0.06 * (1 - k)));
}
async function burst(t: Unit, col: RGB): Promise<void> {
  sfx.boom();
  const i = idx(t.x, t.y);
  splatter(t.x + 0.5, t.y + 0.5, col, 40, 1.6);
  await tween(420, (k) => {
    t.s = 1 + k * 0.35;
    t.a = 1 - k;
  });
  units = units.filter((u) => u !== t);
  // Platzen färbt ringsum in der Farbe des Treffers
  paintCell(i, 1);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
    const c = cx(i) + dx,
      r = cy(i) + dy;
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
    const j = idx(c, r);
    if (j === HOME[1] || j === HOME[2] || units.some((u) => idx(u.x, u.y) === j)) continue;
    paintCell(j, 1, 120);
  }
}

/* ---------- Oberfläche ---------- */
const $ = (id: string) => document.getElementById(id)!;
let typing = 0;
function say(text: string): void {
  const p = $('say');
  const bubble = $('bubble');
  bubble.classList.remove('in');
  void bubble.offsetWidth;
  bubble.classList.add('in');
  p.textContent = text;
  typing++;
}
/** Hinweis unten erst, wenn man nach 5 Sekunden noch nicht weiterweiß oder etwas Falsches tut (Sepias Satz reicht meistens) */
let hintText = '';
let hintTimer = 0;
function hint(text: string): void {
  hintText = text;
  clearTimeout(hintTimer);
  $('hint').textContent = '';
  if (text) hintTimer = window.setTimeout(() => ($('hint').textContent = hintText), reduced ? 0 : 5000);
}
function dots(step: number): void {
  document.querySelectorAll<HTMLElement>('#dots i').forEach((d, k) => {
    d.classList.toggle('on', k < step);
    d.classList.toggle('now', k === step - 1);
  });
}
async function banner(text: string, cls = ''): Promise<void> {
  const b = $('banner');
  b.textContent = text;
  b.className = 'banner show ' + cls;
  await sleep(1150);
  b.className = 'banner';
}

/* ---------- Eingaben: Ziehen oder antippen und Ziel antippen ---------- */
type Want = { kind: 'drag'; u: Unit; to: number; done: () => void } | { kind: 'net'; done: () => void } | null;
let want: Want = null;
function cellAt(px: number, py: number): number | null {
  const { s, ox, oy } = view();
  const c = Math.floor((px - ox) / s),
    r = Math.floor((py - oy) / s);
  return c < 0 || r < 0 || c >= COLS || r >= ROWS ? null : idx(c, r);
}
function unitAt(px: number, py: number): Unit | null {
  const { s, ox, oy } = view();
  let best: Unit | null = null,
    bd = 1e9;
  for (const u of units) {
    const ux = ox + (u.x + 0.5) * s,
      uy = oy + (u.y + 0.2) * s;
    const d = Math.hypot(px - ux, py - uy);
    if (d < s * 0.75 && d < bd) {
      best = u;
      bd = d;
    }
  }
  return best;
}
function nudge(): void {
  const h = $('hint');
  h.textContent = hintText;
  h.classList.remove('nudge');
  void h.offsetWidth;
  h.classList.add('nudge');
  sfx.miss();
}
const local = (e: PointerEvent) => {
  const r = board.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top] as const;
};
board.addEventListener('pointerdown', (e) => {
  initAudio();
  const [px, py] = local(e);
  if (want?.kind === 'net') {
    const c = cellAt(px, py);
    if (c !== null && net?.includes(c)) {
      const w = want;
      want = null;
      w.done();
    } else nudge();
    return;
  }
  if (want?.kind !== 'drag') return;
  const u = unitAt(px, py);
  if (u && u === want.u) {
    drag = { u, x: px, y: py, sx: px, sy: py, moved: false };
    board.setPointerCapture(e.pointerId);
    return;
  }
  // Antippen und dann Ziel antippen
  const c = cellAt(px, py);
  if (armed && c === want.to) {
    const w = want;
    want = null;
    armed = null;
    w.done();
    return;
  }
  nudge();
});
board.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const [px, py] = local(e);
  if (!drag.moved && Math.hypot(px - drag.sx, py - drag.sy) > 8) drag.moved = true;
  drag.x = px;
  drag.y = py;
});
board.addEventListener('pointerup', (e) => {
  if (!drag || want?.kind !== 'drag') {
    drag = null;
    return;
  }
  const [px, py] = local(e);
  const d = drag;
  drag = null;
  if (!d.moved) {
    armed = d.u;
    sfx.tap();
    return;
  }
  const c = cellAt(px, py - view().s * 0.25);
  const c2 = cellAt(px, py);
  if (c === want.to || c2 === want.to) {
    const w = want;
    want = null;
    armed = null;
    w.done();
  } else nudge();
});
const waitDrag = (u: Unit, to: number) =>
  new Promise<void>((done) => {
    want = { kind: 'drag', u, to, done };
    ring = to;
    from = u;
  }).then(() => {
    ring = null;
    from = null;
  });
const waitNet = (cells: number[]) =>
  new Promise<void>((done) => {
    net = cells;
    want = { kind: 'net', done };
  }).then(() => {
    net = null;
  });

/* ---------- Würfel ---------- */
const tray = $('tray');
const rollBtn = $('roll') as HTMLButtonElement;
function faceCol(p: PigmentId): string {
  return `rgb(${PIG[p].rgb.join(',')})`;
}
async function roll(dice: { faces: Face[]; land: number; tint: PigmentId }[]): Promise<HTMLElement[]> {
  tray.replaceChildren();
  const walls = dice.map((d) => {
    const w = makeCube(d.faces, 58, faceCol(d.tint), { skin: 'tag', tint: PIG[d.tint].rgb });
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.append(w);
    tray.append(slot);
    return w;
  });
  rollBtn.hidden = false;
  rollBtn.classList.add('glow');
  await new Promise<void>((res) => {
    const go = () => {
      rollBtn.removeEventListener('click', go);
      tray.removeEventListener('click', go);
      res();
    };
    rollBtn.addEventListener('click', go);
    tray.addEventListener('click', go);
  });
  initAudio();
  rollBtn.classList.remove('glow');
  rollBtn.hidden = true;
  sfx.dice(dice.length);
  await Promise.all(walls.map((w, k) => tumble(w, dice[k]!.land, k * 90, T(900), -40 + k * 30)));
  return walls;
}

/* ---------- Lektion ---------- */
const mA = mon('evo5', 29);
const mB = mon('evo7', 23);
const mR1 = mon('evo4', 20);
const mR2 = mon('evo0', 32);
const imgs = new Map<Monster, HTMLCanvasElement>();
const img = (m: Monster) => {
  let c = imgs.get(m);
  if (!c) {
    c = sticker(m, 150);
    imgs.set(m, c);
  }
  return c;
};
const unit = (id: string, m: Monster, side: 1 | 2, c: number, r: number): Unit => ({ id, m, side, x: c, y: r, img: img(m), s: 1, a: 1, dx: 0, dy: 0 });

async function lesson(): Promise<void> {
  const my = ++run;
  const alive = () => my === run;
  units = [];
  paint = new Map();
  fx = [];
  nums = [];
  shots = [];
  hearts = { 1: 3, 2: 3 };
  crack = { 1: 0, 2: 0 };
  ring = null;
  from = null;
  net = null;
  want = null;
  armed = null;
  tray.replaceChildren();
  rollBtn.hidden = true;
  $('end').hidden = true;
  cam = { x: 2, y: 5, w: 2, h: 2 };
  camFrom = { ...cam };
  camTo = { ...cam };
  paintCell(HOME[1], 1);
  paintCell(idx(3, 7), 1);
  paintCell(idx(2, 6), 1);
  paintCell(HOME[2], 2);
  paintCell(idx(1, 0), 2);
  paintCell(idx(3, 0), 2);
  const A = unit('A', mA, 1, 2, 6);
  units.push(A);

  // 1: ein Klecks, vier Felder
  dots(1);
  say('Drag your blot. Paint the paper.');
  hint('Drag the blot onto the gold ring.');
  await waitDrag(A, idx(3, 6));
  if (!alive()) return;
  hint('');
  paintCell(idx(3, 6), 1);
  await hop(A, idx(3, 6));
  await sleep(450);

  // 2: ein Würfel, ein Stern, ein neuer Klecks
  dots(2);
  void zoom({ x: 1, y: 3, w: 4, h: 4 });
  await sleep(500);
  say('Roll. A star brings a new blot.');
  hint('Tap the die.');
  const fB: Face[] = [{ k: 'star', n: 2 }, { k: 'step', n: 1, c: mB.main }, { k: 'splash', n: 1, c: mB.main }, { k: 'guard', n: 1, c: mB.main }, { k: 'glow', n: 1, c: mB.main }, { k: 'star', n: 1 }];
  await roll([{ faces: fB, land: 0, tint: mB.main }]);
  if (!alive()) return;
  tray.querySelector('.slot')?.classList.add('star');
  sfx.crest(0);
  const netB = [idx(2, 6), idx(2, 5), idx(2, 4), idx(2, 3), idx(1, 4), idx(3, 4)];
  hint('Tap the gold net.');
  await waitNet(netB);
  if (!alive()) return;
  hint('');
  tray.replaceChildren();
  const B = unit('B', mB, 1, 2, 4);
  await unfold(netB, 1, B);
  await sleep(400);

  // 3: der Rivale
  dots(3);
  const R1 = unit('R1', mR1, 2, 3, 2);
  paintCell(idx(3, 2), 2);
  paintCell(idx(3, 1), 2);
  const z3 = zoom({ x: 0, y: 0, w: 6, h: 6 });
  await sleep(300);
  R1.s = 0;
  units.push(R1);
  sfx.rise();
  await tween(360, (k) => (R1.s = k));
  await z3;
  say('Drag onto the rival. Burst it.');
  hint('Drag your blot onto the rival.');
  await waitDrag(B, idx(3, 2));
  if (!alive()) return;
  hint('');
  await splash(B, R1, idx(3, 2), '11', YOU);
  await burst(R1, YOU);
  await banner('WASHED OUT');
  if (!alive()) return;

  // 4: näher ran, dann die Palette
  dots(4);
  await zoom({ x: 0, y: 0, w: 6, h: 8 }, 900);
  say('Walk closer. Splash cracks their palette.');
  hint('Drag up to the gold ring.');
  await waitDrag(B, idx(2, 2));
  if (!alive()) return;
  await hop(B, idx(2, 2));
  hint('Tap the die.');
  const fA: Face[] = [{ k: 'splash', n: 1, c: mA.main }, { k: 'step', n: 1, c: mA.main }, { k: 'star', n: 1 }, { k: 'guard', n: 1, c: mA.main }, { k: 'glow', n: 1, c: mA.main }, { k: 'star', n: 2 }];
  await roll([{ faces: fA, land: 0, tint: mA.main }]);
  if (!alive()) return;
  tray.querySelector('.slot')?.classList.add('star');
  sfx.crest(1);
  hint('Drag onto their palette.');
  await waitDrag(B, HOME[2]);
  if (!alive()) return;
  hint('');
  tray.replaceChildren();
  await splash(B, null, HOME[2], '♥', YOU);
  hearts[2] = 2;
  crack[2] = performance.now();
  sfx.heart?.();
  await banner('PALETTE HIT', 'hit');
  if (!alive()) return;

  // 5: der Rivale zieht, dann gleiche Farben
  dots(5);
  await banner("Rival's turn", 'rival');
  const R2 = unit('R2', mR2, 2, 1, 1);
  await unfold([idx(1, 1), idx(0, 1), idx(1, 2)], 2, R2);
  if (!alive()) return;
  say('Same colours hit harder.');
  hint('Tap Roll.');
  const same = mB.main;
  const f1: Face[] = [{ k: 'step', n: 1, c: same }, { k: 'star', n: 1 }, { k: 'guard', n: 1, c: mA.main }, { k: 'glow', n: 1, c: mA.main }, { k: 'splash', n: 1, c: mA.main }, { k: 'star', n: 2 }];
  const f2: Face[] = [{ k: 'glow', n: 1, c: same }, { k: 'step', n: 1, c: same }, { k: 'star', n: 1 }, { k: 'guard', n: 1, c: same }, { k: 'splash', n: 1, c: same }, { k: 'star', n: 2 }];
  await roll([
    { faces: f1, land: 0, tint: mA.main },
    { faces: f2, land: 0, tint: mB.main },
  ]);
  if (!alive()) return;
  tray.querySelectorAll('.slot').forEach((s) => s.classList.add('glaze'));
  sfx.crest(2);
  await banner('GLAZE ×1.5', 'glaze');
  hint('Drag onto the rival.');
  await waitDrag(B, idx(1, 1));
  if (!alive()) return;
  hint('');
  tray.replaceChildren();
  await splash(B, R2, idx(1, 1), '8 ×1.5 = 12', YOU);
  await burst(R2, YOU);
  await banner('WASHED OUT');
  if (!alive()) return;

  // Ende
  say('Now a real duel.');
  hint('');
  await sleep(500);
  $('end').hidden = false;
}

$('again').addEventListener('click', () => {
  initAudio();
  sfx.tap();
  void lesson();
});
$('restart').addEventListener('click', () => {
  initAudio();
  sfx.tap();
  void lesson();
});
$('start').addEventListener('click', () => {
  sfx.tap();
  $('startnote').hidden = false;
});
void lesson();

/* Für den Testlauf: Mitte eines Felds und eines Kleckses in Seitenkoordinaten */
Object.assign(window, {
  __e1: {
    cell: (c: number, r: number) => {
      const b = board.getBoundingClientRect();
      const { s, ox, oy } = view();
      return [b.left + ox + (c + 0.5) * s, b.top + oy + (r + 0.5) * s];
    },
    unit: (id: string) => {
      const u = units.find((v) => v.id === id);
      if (!u) return null;
      const b = board.getBoundingClientRect();
      const { s, ox, oy } = view();
      return [b.left + ox + (u.x + 0.5) * s, b.top + oy + (u.y + 0.2) * s];
    },
    want: () => want?.kind ?? (rollBtn.hidden ? '' : 'roll'),
  },
});
