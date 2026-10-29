/*
 * Darstellung des Blatts mit Animationen. Hält einen eigenen Anzeigezustand (V), der den Regeln
 * hinterherläuft: jedes Ereignis wird erst sichtbar, wenn seine Animation dran ist.
 */
import { deformN, ellipsePts, grainTex, renderMonster } from '../renderer/watercolor';
import { PIG } from '../../shared/data';
import { RNG, hashStr } from '../../shared/rng';
import { iconImage } from './icons';
import { COLS, HEARTS, PAPER, ROWS, S, unitById, type Cell, type Ev, type Face, type Side, type TeamSnap, type UnitSnap } from '../../shared/duel/rules';
import { sfx } from './sound';

/** sqx, sqy: Stauchen und Strecken. ox, oy: Ausholen, Ausfallschritt, Rückstoß (in Feldern). rot: Kippen */
export type VUnit = UnitSnap & { side: Side; dx: number; dy: number; lift: number; scale: number; alpha: number; flash: number; hpShown: number; busy: boolean; sqx: number; sqy: number; ox: number; oy: number; rot: number };
type CellAnim = { t0: number; dur: number; kind: 'grow' | 'fade' | 'flip' | 'erase' | 'shine'; from?: Cell; face?: Face };
type Particle = { x: number; y: number; vx: number; vy: number; g: number; r: number; t0: number; life: number; col: string };
type FText = { x: number; y: number; text: string; col: string; size: number; t0: number; life: number };
type Ring = { x: number; y: number; r0: number; r1: number; col: string; t0: number; life: number; w: number };
type Shot = { x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; col: string; h: number };

export type Hooks = {
  overlay: (ctx: CanvasRenderingContext2D, cell: number) => void;
  acted: (id: number) => boolean;
  selected: () => number | null;
  hud: () => void;
  banner: (text: string, kind: 'turn' | 'round' | 'ability' | 'big') => void;
  ticker: (text: string, cls: string) => void;
  roll: (e: Extract<Ev, { k: 'roll' }>) => Promise<void>;
};

export const V = {
  cells: [] as Cell[],
  units: new Map<number, VUnit>(),
  teams: [] as TeamSnap[],
  round: 1,
  anims: new Map<number, CellAnim>(),
  parts: [] as Particle[],
  texts: [] as FText[],
  rings: [] as Ring[],
  shots: [] as Shot[],
  shake: { t0: 0, amp: 0 },
  flashRed: 0,
  crack: [0, 0],
  eraser: null as null | { row: number; t0: number; dur: number },
  /** Der Rivale zeigt, was er gleich tut */
  focus: null as null | { id: number; to: number; at: number | null; t0: number },
  speed: 1,
};
let hooks: Hooks;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let cell = 48;
const dpr = Math.min(2, window.devicePixelRatio || 1);
let bg: HTMLCanvasElement | null = null;
const blobCache = new Map<string, HTMLCanvasElement>();
const portraitCache = new Map<string, HTMLCanvasElement>();

const now = () => performance.now();
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOutBack = (x: number) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const wait = (ms: number) => new Promise<void>((res) => window.setTimeout(res, ms / V.speed));
function tween(ms: number, fn: (p: number) => void, ease: (x: number) => number = (x) => x): Promise<void> {
  return new Promise((res) => {
    const t0 = now();
    const tick = () => {
      const p = clamp01((now() - t0) / (ms / V.speed));
      fn(ease(p));
      if (p < 1) requestAnimationFrame(tick);
      else res();
    };
    requestAnimationFrame(tick);
  });
}
const cx = (i: number) => ((i % COLS) + 0.5) * cell;
const cy = (i: number) => (Math.floor(i / COLS) + 0.5) * cell;

export function setup(c: HTMLCanvasElement, h: Hooks): void {
  canvas = c;
  ctx = c.getContext('2d')!;
  hooks = h;
  const loop = () => {
    draw();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
/** Größe des Blatts an den Platz anpassen */
export function resize(w: number, h: number): void {
  const c = Math.max(24, Math.floor(Math.min(w / COLS, h / ROWS)));
  if (c === cell && bg) return;
  cell = c;
  canvas.width = Math.round(c * COLS * dpr);
  canvas.height = Math.round(c * ROWS * dpr);
  canvas.style.width = c * COLS + 'px';
  canvas.style.height = c * ROWS + 'px';
  bg = null;
  blobCache.clear();
  portraitCache.clear();
}
export const cellSize = () => cell;
export function reset(): void {
  V.cells = [];
  V.units.clear();
  V.teams = [];
  V.anims.clear();
  V.parts = [];
  V.texts = [];
  V.rings = [];
  V.shots = [];
  V.eraser = null;
  V.focus = null;
  V.crack = [0, 0];
  blobCache.clear();
}

/* ---------- Zwischenspeicher fürs Zeichnen ---------- */
function paperBg(): HTMLCanvasElement {
  if (bg) return bg;
  bg = document.createElement('canvas');
  bg.width = canvas.width;
  bg.height = canvas.height;
  const b = bg.getContext('2d')!;
  b.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cell * COLS,
    H = cell * ROWS;
  b.fillStyle = `rgb(${PAPER})`;
  b.fillRect(0, 0, W, H);
  b.globalAlpha = 0.55;
  b.fillStyle = b.createPattern(grainTex(), 'repeat')!;
  b.fillRect(0, 0, W, H);
  b.globalAlpha = 1;
  b.strokeStyle = 'rgba(80,90,110,.11)';
  b.lineWidth = 1;
  for (let x = 1; x < COLS; x++) {
    b.beginPath();
    b.moveTo(x * cell, 0);
    b.lineTo(x * cell, H);
    b.stroke();
  }
  for (let y = 1; y < ROWS; y++) {
    b.beginPath();
    b.moveTo(0, y * cell);
    b.lineTo(W, y * cell);
    b.stroke();
  }
  // Rand des Blatts bleicht aus
  const g = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,.35)');
  b.fillStyle = g;
  b.fillRect(0, 0, W, H);
  return bg;
}
function blob(i: number, c: Cell): HTMLCanvasElement {
  const key = `${i}:${c.stamp}:${c.owner}:${c.rgb}`;
  let b = blobCache.get(key);
  if (b) return b;
  const size = cell * 1.7;
  b = document.createElement('canvas');
  b.width = b.height = Math.ceil(size * dpr);
  const x = b.getContext('2d')!;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const r = RNG(hashStr(`${S.paintSeed}:${i}:${c.stamp}`));
  const base = deformN(ellipsePts({ x: size / 2, y: size / 2, rx: cell * 0.6, ry: cell * 0.6, rot: 0 }, 1, r, 10), r, 0.28, 3);
  x.fillStyle = `rgba(${c.rgb},${c.owner === 3 ? 0.13 : 0.1})`;
  for (let k = 0; k < (c.owner === 3 ? 7 : 8); k++) {
    const p = deformN(base, r, 0.22, 1);
    x.beginPath();
    x.moveTo(p[0]![0], p[0]![1]);
    for (const q of p) x.lineTo(q[0], q[1]);
    x.closePath();
    x.fill();
  }
  if (blobCache.size > 600) blobCache.clear();
  blobCache.set(key, b);
  return b;
}
export function portrait(id: number, size: number): HTMLCanvasElement {
  const key = `${id}:${size}`;
  let c = portraitCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 1;
  const u = unitById(id);
  if (u) renderMonster(c, u.m, size, { dpr });
  portraitCache.set(key, c);
  return c;
}
function drawBlob(i: number, c: Cell, scale: number, alpha: number): void {
  const b = blob(i, c);
  const s = cell * 1.7 * scale;
  ctx.globalAlpha = alpha;
  ctx.drawImage(b, cx(i) - s / 2, cy(i) - s / 2, s, s);
  ctx.globalAlpha = 1;
}

/* ---------- Zeichnen ---------- */
let last = now();
function draw(): void {
  if (!canvas || !V.cells.length) return;
  const t = now();
  const dt = Math.min(50, t - last) / 1000;
  last = t;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Wackeln bei kräftigen Treffern
  const sp = clamp01((t - V.shake.t0) / 350);
  if (sp < 1) {
    const a = V.shake.amp * (1 - sp);
    ctx.translate((Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a);
  }
  ctx.drawImage(paperBg(), 0, 0, cell * COLS, cell * ROWS);
  // Farbe
  ctx.globalCompositeOperation = 'multiply';
  V.cells.forEach((c, i) => {
    const a = V.anims.get(i);
    const p = a ? clamp01((t - a.t0) / a.dur) : 1;
    if (a?.from && a.from.owner !== 0 && !a.from.home && p < 1) drawBlob(i, a.from, 1, a.kind === 'erase' ? 1 - p : 1 - p * 0.6);
    if (a?.kind === 'erase') return;
    if (c.owner === 0 || c.home) return;
    if (!a || a.kind === 'shine') return drawBlob(i, c, 1, 1);
    if (t < a.t0) return;
    if (a.kind === 'grow') drawBlob(i, c, 0.3 + 0.7 * easeOutBack(p), Math.min(1, p * 1.6));
    else if (a.kind === 'fade') drawBlob(i, c, 0.85 + 0.15 * p, p);
    else if (a.kind === 'flip' && p > 0.45) {
      const q = (p - 0.45) / 0.55;
      drawBlob(i, c, 0.4 + 0.6 * easeOutBack(q), Math.min(1, q * 1.5));
    }
  });
  ctx.globalCompositeOperation = 'source-over';
  // Grenzen der Gebiete in der Farbe des Teams, damit gleiche Pigmente unterscheidbar bleiben
  ctx.lineWidth = 1.6;
  ctx.setLineDash([3, 3]);
  V.cells.forEach((c, i) => {
    if (c.owner !== 1 && c.owner !== 2) return;
    const a = V.anims.get(i);
    if (a && t < a.t0 + a.dur * 0.5) return;
    const x = (i % COLS) * cell,
      y = Math.floor(i / COLS) * cell;
    ctx.strokeStyle = c.owner === 1 ? 'rgba(43,63,163,.5)' : 'rgba(163,58,58,.5)';
    ctx.beginPath();
    const side = (dx: number, dy: number) => {
      const nx = (i % COLS) + dx,
        ny = Math.floor(i / COLS) + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return false;
      return V.cells[ny * COLS + nx]!.owner !== c.owner;
    };
    const k = 2.5;
    if (side(0, -1)) {
      ctx.moveTo(x + k, y + k);
      ctx.lineTo(x + cell - k, y + k);
    }
    if (side(0, 1)) {
      ctx.moveTo(x + k, y + cell - k);
      ctx.lineTo(x + cell - k, y + cell - k);
    }
    if (side(-1, 0)) {
      ctx.moveTo(x + k, y + k);
      ctx.lineTo(x + k, y + cell - k);
    }
    if (side(1, 0)) {
      ctx.moveTo(x + cell - k, y + k);
      ctx.lineTo(x + cell - k, y + cell - k);
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);
  // Nasse Farbe glänzt
  V.cells.forEach((c, i) => {
    if (c.wet <= 0 || c.owner === 0 || c.home) return;
    const a = V.anims.get(i);
    if (a && t < a.t0) return;
    const x = cx(i),
      y = cy(i);
    const pulse = 0.22 + 0.08 * c.wet + 0.06 * Math.sin(t / 600 + i * 1.7);
    const g = ctx.createRadialGradient(x - cell * 0.18, y - cell * 0.2, 1, x, y, cell * 0.5);
    g.addColorStop(0, `rgba(255,255,255,${pulse})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - cell / 2, y - cell / 2, cell, cell);
  });
  // Würfelseiten klappen um (Beschwören) und Glanz bei Regen und Sickern
  for (const [i, a] of V.anims) {
    const p = clamp01((t - a.t0) / a.dur);
    if (t < a.t0) continue;
    if (a.kind === 'flip' && p < 0.62) {
      const sy = p < 0.25 ? p / 0.25 : 1;
      const al = p < 0.42 ? 1 : 1 - (p - 0.42) / 0.2;
      ctx.save();
      ctx.globalAlpha = Math.max(0, al);
      ctx.translate(cx(i), cy(i));
      ctx.scale(1, easeOut(sy));
      ctx.fillStyle = '#fffdf8';
      ctx.strokeStyle = 'rgba(60,60,80,.35)';
      ctx.lineWidth = 1.5;
      roundRect(-cell * 0.42, -cell * 0.42, cell * 0.84, cell * 0.84, cell * 0.12);
      ctx.fill();
      ctx.stroke();
      if (a.face) {
        const img = iconImage(a.face, () => undefined);
        if (img.complete) ctx.drawImage(img, -cell * 0.24, -cell * 0.24, cell * 0.48, cell * 0.48);
      }
      ctx.restore();
    } else if (a.kind === 'shine' && p < 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - p)})`;
      ctx.beginPath();
      ctx.arc(cx(i), cy(i), cell * (0.3 + 0.25 * p), 0, 7);
      ctx.fill();
    }
    if (p >= 1) V.anims.delete(i);
  }
  // Radierer
  if (V.eraser) {
    const p = clamp01((t - V.eraser.t0) / V.eraser.dur);
    const y = V.eraser.row * cell;
    ctx.fillStyle = `rgba(255,255,255,${0.45 * (1 - Math.abs(p - 0.5) * 2) + 0.15})`;
    ctx.fillRect(0, y + 2, cell * COLS * p, cell - 4);
    const ex = p * (cell * COLS + cell) - cell * 0.5;
    ctx.save();
    ctx.translate(ex, y + cell / 2);
    ctx.rotate(-0.25 + Math.sin(t / 60) * 0.06);
    ctx.fillStyle = '#e9a7b0';
    roundRect(-cell * 0.42, -cell * 0.26, cell * 0.6, cell * 0.52, 5);
    ctx.fill();
    ctx.fillStyle = '#3d5aa8';
    roundRect(cell * 0.1, -cell * 0.26, cell * 0.38, cell * 0.52, 3);
    ctx.fill();
    ctx.restore();
    if (Math.random() < 0.6) V.parts.push({ x: ex - cell * 0.3, y: y + cell * (0.3 + Math.random() * 0.4), vx: -30 - Math.random() * 40, vy: -40 - Math.random() * 40, g: 260, r: 1.6 + Math.random() * 1.4, t0: t, life: 500, col: 'rgba(200,150,160,.9)' });
    if (p >= 1) V.eraser = null;
  }
  for (const side of [1, 2] as Side[]) drawPalette(side, t);
  hooks.overlay(ctx, cell);
  drawFocus(t);
  // Kleckse
  const list = [...V.units.values()].filter((u) => u.state === 'sheet' || u.busy).sort((a, b) => a.dy - b.dy);
  for (const u of list) drawUnit(u, t);
  // Spritzer im Flug
  V.shots = V.shots.filter((s) => {
    const p = clamp01((t - s.t0) / s.dur);
    const at = (q: number) => {
      const x = s.x0 + (s.x1 - s.x0) * q,
        y = s.y0 + (s.y1 - s.y0) * q - Math.sin(Math.PI * q) * s.h;
      return [x, y] as const;
    };
    for (let k = 3; k >= 0; k--) {
      const q = Math.max(0, p - k * 0.06);
      const [x, y] = at(q);
      ctx.fillStyle = s.col;
      ctx.globalAlpha = k === 0 ? 1 : 0.5 - k * 0.1;
      ctx.beginPath();
      ctx.arc(x, y, cell * (k === 0 ? 0.15 : 0.08), 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return p < 1;
  });
  // Ringe
  V.rings = V.rings.filter((r) => {
    const p = clamp01((t - r.t0) / r.life);
    ctx.strokeStyle = r.col;
    ctx.globalAlpha = 1 - p;
    ctx.lineWidth = r.w * (1 - p * 0.5);
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * easeOut(p), 0, 7);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return p < 1;
  });
  // Tropfen und Funken
  V.parts = V.parts.filter((q) => {
    const p = (t - q.t0) / q.life;
    if (p >= 1) return false;
    q.vy += q.g * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = q.col;
    ctx.beginPath();
    ctx.arc(q.x, q.y, q.r * (1 - p * 0.4), 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
    return true;
  });
  // Zahlen und Worte
  V.texts = V.texts.filter((f) => {
    const p = (t - f.t0) / f.life;
    if (p >= 1) return false;
    const y = f.y - cell * 0.7 * easeOut(Math.min(1, p * 1.4));
    ctx.globalAlpha = p > 0.65 ? 1 - (p - 0.65) / 0.35 : 1;
    ctx.font = `800 ${f.size}px Figtree, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,253,248,.95)';
    const pop = p < 0.12 ? 0.6 + (p / 0.12) * 0.5 : p < 0.2 ? 1.1 - ((p - 0.12) / 0.08) * 0.1 : 1;
    ctx.save();
    ctx.translate(f.x, y);
    ctx.scale(pop, pop);
    ctx.strokeText(f.text, 0, 0);
    ctx.fillStyle = f.col;
    ctx.fillText(f.text, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
    return true;
  });
  // Roter Blitz, wenn die eigene Palette getroffen wird
  const fp = clamp01((t - V.flashRed) / 600);
  if (fp < 1) {
    ctx.fillStyle = `rgba(163,58,58,${0.22 * (1 - fp)})`;
    ctx.fillRect(-20, -20, cell * COLS + 40, cell * ROWS + 40);
  }
}
function roundRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function heart(x: number, y: number, s: number, col: string): void {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 1.2);
  ctx.bezierCurveTo(x - s * 2, y - s * 0.2, x - s * 0.9, y - s * 1.6, x, y - s * 0.5);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 1.6, x + s * 2, y - s * 0.2, x, y + s * 1.2);
  ctx.fill();
}
function drawPalette(side: Side, t: number): void {
  const team = S.teams[side - 1];
  if (!team) return;
  const hearts = V.teams[side - 1]?.hearts ?? HEARTS;
  const crack = clamp01((t - V.crack[side - 1]!) / 700);
  const wob = crack < 1 ? Math.sin(t / 25) * 3 * (1 - crack) : 0;
  const x = cx(team.home) + wob,
    y = cy(team.home);
  const col = side === 1 ? '43,63,163' : '163,58,58';
  // Bewacht: ein eigener Klecks steht direkt daneben
  const hx = team.home % COLS,
    hy = Math.floor(team.home / COLS);
  const guarded = [...V.units.values()].some((u) => u.side === side && u.state === 'sheet' && Math.max(Math.abs(Math.round(u.dx) - hx), Math.abs(Math.round(u.dy) - hy)) <= 1);
  if (guarded) {
    ctx.save();
    ctx.strokeStyle = `rgba(${col},.55)`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.lineDashOffset = -t / 60;
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.56, 0, 7);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.fillStyle = 'rgba(255,253,248,1)';
  ctx.strokeStyle = `rgba(${col},.95)`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(x, y, cell * 0.45, cell * 0.37, -0.25, 0, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(228,225,216,1)';
  ctx.beginPath();
  ctx.arc(x + cell * 0.21, y + cell * 0.11, cell * 0.07, 0, 7);
  ctx.fill();
  for (let k = 0; k < HEARTS; k++) {
    const hx = x - cell * 0.22 + k * cell * 0.17,
      hy = y - cell * 0.07 + (k === 1 ? -cell * 0.07 : 0);
    const alive = k < hearts;
    heart(hx, hy, cell * 0.078, alive ? `rgba(${col},1)` : 'rgba(180,175,165,.55)');
    if (!alive) {
      ctx.strokeStyle = 'rgba(255,253,248,1)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(hx - cell * 0.02, hy - cell * 0.06);
      ctx.lineTo(hx + cell * 0.015, hy);
      ctx.lineTo(hx - cell * 0.01, hy + cell * 0.07);
      ctx.stroke();
    }
  }
  ctx.restore();
}
function drawUnit(u: VUnit, t: number): void {
  const x = (u.dx + u.ox + 0.5) * cell,
    groundY = (u.dy + u.oy + 0.5) * cell;
  // Ruhig wippen und atmen, solange nichts passiert
  const idle = u.busy ? 0 : 0.035 * (0.5 + 0.5 * Math.sin(t / 520 + u.id * 1.7));
  const y = groundY - (u.lift + idle) * cell - 2;
  const breathe = 1 + 0.025 * Math.sin(t / 450 + u.id * 1.3);
  const s = u.scale * breathe;
  const size = Math.round(cell * 1.02);
  // Schatten
  ctx.fillStyle = `rgba(40,35,30,${0.12 * u.alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, groundY + cell * 0.36, cell * 0.32 * u.scale * u.sqx * (1 - (u.lift + idle) * 0.3), cell * 0.08, 0, 0, 7);
  ctx.fill();
  const rad = cell * 0.46 * s;
  ctx.save();
  // Stauchen von unten aus, damit der Klecks auf dem Boden bleibt
  ctx.translate(x, y + rad);
  ctx.rotate(u.rot);
  ctx.scale(u.sqx, u.sqy);
  ctx.translate(-x, -y - rad);
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, 7);
  ctx.clip();
  ctx.globalAlpha = u.alpha * (0.3 + 0.7 * clamp01(u.hpShown / u.max));
  ctx.drawImage(portrait(u.id, size), x - (size * s) / 2, y - (size * s) / 2, size * s, size * s);
  if (u.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${u.flash})`;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    u.flash = Math.max(0, u.flash - 0.06);
  }
  ctx.restore();
  ctx.save();
  ctx.translate(x, y + rad);
  ctx.rotate(u.rot);
  ctx.scale(u.sqx, u.sqy);
  ctx.translate(-x, -y - rad);
  ctx.globalAlpha = u.alpha;
  const sel = hooks.selected() === u.id;
  ctx.strokeStyle = u.side === 1 ? 'rgba(43,63,163,.95)' : 'rgba(163,58,58,.95)';
  ctx.lineWidth = sel ? 3.5 : 2;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, 7);
  ctx.stroke();
  if (sel) {
    ctx.strokeStyle = 'rgba(43,63,163,.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, rad + 4 + Math.sin(t / 200) * 1.5, 0, 7);
    ctx.stroke();
  }
  if (u.shield > 0) {
    ctx.strokeStyle = 'rgba(90,100,120,.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(x, y, rad - 4, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Deckkraft
  u.hpShown += (u.hp - u.hpShown) * 0.12;
  if (Math.abs(u.hp - u.hpShown) < 0.05) u.hpShown = u.hp;
  const bw = cell * 0.7,
    bx = x - bw / 2,
    by = groundY + cell * 0.5 - 7;
  ctx.fillStyle = 'rgba(255,255,255,.88)';
  ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
  ctx.fillStyle = 'rgba(230,120,110,.9)';
  ctx.fillRect(bx, by, bw * clamp01(u.hpShown / u.max), 4);
  ctx.fillStyle = u.side === 1 ? '#2b3fa3' : '#a33a3a';
  ctx.fillRect(bx, by, bw * clamp01(Math.min(u.hp, u.hpShown) / u.max), 4);
  if (u.stain > 0 || u.rooted > 0) {
    ctx.fillStyle = u.rooted > 0 ? 'rgba(46,122,87,.9)' : 'rgba(110,75,51,.9)';
    ctx.beginPath();
    ctx.arc(x + cell * 0.34, groundY - cell * 0.34, 4, 0, 7);
    ctx.fill();
  }
  if (u.side === 1 && hooks.acted(u.id)) {
    const dx = x - cell * 0.34,
      dy = groundY - cell * 0.34;
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.beginPath();
    ctx.arc(dx, dy, 7, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(46,122,87,1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dx - 3.5, dy);
    ctx.lineTo(dx - 1, dy + 3);
    ctx.lineTo(dx + 4, dy - 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
/** Der Rivale zeigt vor jedem Zug, wer was vorhat: Ring um den Klecks, gestrichelte Linie zum Ziel */
function drawFocus(t: number): void {
  const f = V.focus;
  if (!f) return;
  const age = t - f.t0;
  if (age > 2200 / V.speed) {
    V.focus = null;
    return;
  }
  const u = V.units.get(f.id);
  if (!u || u.state !== 'sheet') return;
  const x = (u.dx + 0.5) * cell,
    y = (u.dy + 0.5) * cell;
  const a = Math.min(1, age / 180) * (age > 1600 / V.speed ? 1 - (age - 1600 / V.speed) / (600 / V.speed) : 1);
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.strokeStyle = 'rgba(163,58,58,.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, cell * (0.55 + 0.05 * Math.sin(t / 120)), 0, 7);
  ctx.stroke();
  const tgt = f.at ?? (f.to !== Math.round(u.dy) * COLS + Math.round(u.dx) ? f.to : null);
  if (tgt !== null) {
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -t / 30;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(cx(tgt), cy(tgt));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx(tgt), cy(tgt), cell * 0.18, 0, 7);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- Effekte ---------- */
function splatter(x: number, y: number, col: string, n: number, speed = 1): void {
  const t = now();
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2,
      v = (40 + Math.random() * 120) * speed;
    V.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 320, r: 1.5 + Math.random() * 3, t0: t, life: 450 + Math.random() * 300, col });
  }
}
function text(x: number, y: number, s: string, col: string, size = 18, life = 1000): void {
  V.texts.push({ x, y, text: s, col, size, t0: now(), life: life / V.speed });
}
function ring(x: number, y: number, r0: number, r1: number, col: string, life: number, w = 3): void {
  V.rings.push({ x, y, r0, r1, col, t0: now(), life: life / V.speed, w });
}
function shake(amp: number): void {
  V.shake = { t0: now(), amp };
}
const unitPos = (id: number): [number, number] => {
  const u = V.units.get(id);
  return u ? [(u.dx + 0.5) * cell, (u.dy + 0.5) * cell - u.lift * cell] : [0, 0];
};
const rgbCss = (rgb: readonly number[], a = 1) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
function setCell(i: number, c: Cell, kind: CellAnim['kind'], delay: number, dur: number, face?: Face): void {
  const from = V.cells[i] ? { ...V.cells[i]! } : undefined;
  V.cells[i] = { ...c };
  V.anims.set(i, { t0: now() + delay / V.speed, dur: dur / V.speed, kind, from, face });
}
function vunitFrom(s: UnitSnap): VUnit {
  const u = unitById(s.id)!;
  return { ...s, side: u.side, dx: s.x, dy: s.y, lift: 0, scale: 1, alpha: 1, flash: 0, hpShown: s.hp, busy: false, sqx: 1, sqy: 1, ox: 0, oy: 0, rot: 0 };
}

/* ---------- Ereignisse abspielen ---------- */
export async function playEvent(e: Ev): Promise<void> {
  switch (e.k) {
    case 'sync': {
      if (!V.cells.length) V.cells = e.cells.map((c) => ({ ...c }));
      else
        e.cells.forEach((c, i) => {
          const a = V.anims.get(i);
          if (!a || now() >= a.t0 + a.dur) V.cells[i] = { ...c };
        });
      for (const s of e.units) {
        const v = V.units.get(s.id);
        if (!v) V.units.set(s.id, vunitFrom(s));
        else if (!v.busy) {
          const wasSheet = v.state === 'sheet';
          Object.assign(v, s);
          if (s.state === 'sheet') {
            v.dx = s.x;
            v.dy = s.y;
            if (!wasSheet) {
              v.scale = 1;
              v.alpha = 1;
              v.hpShown = s.hp;
            }
          }
        }
      }
      V.teams = e.teams.map((t) => ({ crests: { ...t.crests }, hearts: t.hearts }));
      V.round = e.round;
      hooks.hud();
      return;
    }
    case 'log':
      hooks.ticker(e.t, e.c);
      return;
    case 'turn':
      V.focus = null;
      hooks.banner(e.side === 1 ? 'Your turn' : 'Rival turn', 'turn');
      sfx.turn();
      await wait(800);
      return;
    case 'focus': {
      // Kurz zeigen, was der Rivale vorhat, damit man folgen kann
      V.focus = { id: e.id, to: e.to, at: e.at, t0: now() };
      const v = V.units.get(e.id);
      if (v) await tween(260, (p) => (v.sqy = 1 + 0.12 * Math.sin(Math.PI * p)));
      await wait(520);
      return;
    }
    case 'round':
      hooks.banner(`Round ${e.round}`, 'round');
      sfx.turn();
      await wait(800);
      return;
    case 'roll':
      await hooks.roll(e);
      return;
    case 'summon': {
      e.cells.forEach((s, k) => {
        setCell(s.i, s.c, 'flip', k * 120, 560, e.faces[k]);
        window.setTimeout(() => sfx.flip(k), (k * 120) / V.speed);
      });
      await wait(e.cells.length * 120 + 380);
      let v = V.units.get(e.id);
      const u = unitById(e.id)!;
      if (!v) {
        v = vunitFrom({ id: e.id, x: e.x, y: e.y, hp: u.max, max: u.max, state: 'sheet', stain: 0, rooted: 0, shield: 0, acted: false });
        V.units.set(e.id, v);
      }
      Object.assign(v, { state: 'sheet', dx: e.x, dy: e.y, hp: u.max, max: u.max, hpShown: u.max, busy: true });
      sfx.rise();
      ring(cx(e.y * COLS + e.x), cy(e.y * COLS + e.x), cell * 0.2, cell * 0.9, rgbCss(e.cells[0]!.c.rgb, 0.8), 600);
      await tween(
        460,
        (p) => {
          v.scale = easeOutBack(p);
          v.lift = 0.6 * (1 - p);
          v.alpha = Math.min(1, p * 2);
        },
        (x) => x,
      );
      v.busy = false;
      return;
    }
    case 'move': {
      const v = V.units.get(e.id);
      if (!v) return;
      v.busy = true;
      const trail = new Map(e.trail.map((s) => [s.i, s.c]));
      const col = rgbCss(unitColor(e.id), 0.6);
      for (let k = 1; k < e.path.length; k++) {
        const a = e.path[k - 1]!,
          b = e.path[k]!;
        const ax = a % COLS,
          ay = Math.floor(a / COLS),
          bx = b % COLS,
          by = Math.floor(b / COLS);
        // Hüpfen: abstoßen (gestreckt), fliegen, landen (gestaucht)
        await tween(230, (p) => {
          v.dx = ax + (bx - ax) * p;
          v.dy = ay + (by - ay) * p;
          v.lift = Math.sin(Math.PI * p) * 0.3;
          v.sqy = 1 + 0.14 * Math.sin(Math.PI * p);
          v.sqx = 1 - 0.08 * Math.sin(Math.PI * p);
          v.rot = (bx - ax) * 0.12 * Math.sin(Math.PI * p);
        });
        sfx.step();
        splatter(cx(b), cy(b) + cell * 0.3, col, 3, 0.35);
        await tween(90, (p) => {
          v.sqy = 1 - 0.16 * Math.sin(Math.PI * p);
          v.sqx = 1 + 0.12 * Math.sin(Math.PI * p);
        });
        const c = trail.get(a);
        if (c) setCell(a, c, 'grow', 0, 260);
      }
      Object.assign(v, { lift: 0, sqx: 1, sqy: 1, rot: 0, busy: false });
      return;
    }
    case 'stamp': {
      // Der Klecks drückt sich aufs Papier, dann blüht die Farbe auf
      const v = V.units.get(e.id);
      if (v) {
        v.busy = true;
        await tween(160, (p) => {
          v.sqy = 1 - 0.22 * p;
          v.sqx = 1 + 0.16 * p;
        });
        sfx.brush();
        const [ux, uy] = unitPos(e.id);
        ring(ux, uy + cell * 0.2, cell * 0.2, cell * 1.1, rgbCss(unitColor(e.id), 0.55), 520, 4);
        void tween(260, (p) => {
          v.sqy = 0.78 + 0.22 * easeOutBack(p);
          v.sqx = 1.16 - 0.16 * easeOutBack(p);
        }).then(() => Object.assign(v, { sqx: 1, sqy: 1, busy: false }));
      } else sfx.brush();
      const t = unitById(e.id);
      e.cells.forEach((s, k) => {
        const d = k * 110;
        if (s.r === 'take' || s.r === 'refresh' || s.r === 'mud') setCell(s.i, s.c, 'grow', d, 320);
        else if (s.r === 'held')
          window.setTimeout(() => {
            splatter(cx(s.i), cy(s.i), 'rgba(150,145,140,.8)', 6, 0.5);
            text(cx(s.i), cy(s.i), 'held', '#6b6f7c', 12, 700);
          }, d / V.speed);
        if (s.r === 'take' && t) window.setTimeout(() => splatter(cx(s.i), cy(s.i), rgbCss(s.c.rgb, 0.7), 3, 0.4), d / V.speed);
      });
      await wait(e.cells.length * 110 + 380);
      return;
    }
    case 'shot': {
      const shooter = V.units.get(e.id);
      const target = [...V.units.values()].find((u) => u.state === 'sheet' && Math.round(u.dx) === e.at % COLS && Math.round(u.dy) === Math.floor(e.at / COLS));
      // Ausholen und Ausfallschritt Richtung Ziel
      if (shooter) {
        shooter.busy = true;
        const ddx = e.at % COLS - shooter.dx,
          ddy = Math.floor(e.at / COLS) - shooter.dy;
        const len = Math.max(0.001, Math.hypot(ddx, ddy));
        const nx = ddx / len,
          ny = ddy / len;
        await tween(200, (p) => {
          shooter.ox = -nx * 0.14 * p;
          shooter.oy = -ny * 0.14 * p;
          shooter.sqy = 1 - 0.1 * p;
        });
        void tween(260, (p) => {
          const q = Math.sin(Math.PI * p);
          shooter.ox = nx * 0.22 * q;
          shooter.oy = ny * 0.22 * q;
          shooter.sqy = 0.9 + 0.1 * p + 0.12 * q;
        }).then(() => Object.assign(shooter, { ox: 0, oy: 0, sqy: 1, busy: false }));
        await wait(90);
      }
      const [x0, y0] = unitPos(e.id);
      const x1 = cx(e.at),
        y1 = cy(e.at);
      const col = rgbCss(e.rgb);
      V.shots.push({ x0, y0, x1, y1, t0: now(), dur: 420 / V.speed, col, h: cell * (0.6 + Math.hypot(x1 - x0, y1 - y0) / cell / 6) });
      sfx.launch();
      await wait(420);
      // Der Wurf steht am Ziel: Angriff gegen Abwehr
      const m = /d(\d+)\+(-?\d+) vs d(\d+)\+(-?\d+)/.exec(e.text);
      if (m) text(x1, y1 + cell * 0.42, `${+m[1]! + +m[2]!} vs ${+m[3]! + +m[4]!}`, '#5f6474', 12, 900);
      if (e.res === 'miss' || e.res === 'dodge') {
        splatter(x1 + (Math.random() - 0.5) * cell * 0.6, y1 + cell * 0.3, col, 6, 0.6);
        text(x1, y1 - cell * 0.2, e.res === 'miss' ? 'miss' : 'dodged', '#6b6f7c', 15);
        sfx.miss();
        if (e.res === 'dodge' && target) await tween(240, (p) => (target.dx = Math.round(target.dx) + Math.sin(p * Math.PI * 2) * 0.12));
        await wait(220);
        return;
      }
      splatter(x1, y1, col, e.res === 'crit' ? 26 : 16, e.res === 'crit' ? 1.5 : 1.1);
      ring(x1, y1, cell * 0.15, cell * 0.8, col, 500, 4);
      if (target) {
        // Rückstoß weg vom Schützen, gestaucht
        target.flash = 0.9;
        target.busy = true;
        const sx = shooter ? Math.sign(target.dx - shooter.dx) : 0,
          sy = shooter ? Math.sign(target.dy - shooter.dy) : 0;
        void tween(420, (p) => {
          const q = Math.sin(Math.PI * p) * (1 - p * 0.3);
          target.ox = sx * 0.2 * q;
          target.oy = sy * 0.2 * q;
          target.sqx = 1 + 0.18 * q;
          target.sqy = 1 - 0.2 * q;
          target.rot = sx * 0.18 * q;
        }).then(() => Object.assign(target, { ox: 0, oy: 0, sqx: 1, sqy: 1, rot: 0, busy: false }));
      }
      if (e.mult && e.mult > 1 && e.text !== 'palette') {
        text(x1 + cell * 0.55, y1 - cell * 0.55, '×1.5', '#b8860b', 15, 1100);
        ring(x1, y1, cell * 0.4, cell * 1.2, 'rgba(201,150,30,.8)', 600, 3);
      }
      if (e.text !== 'palette') {
        if (e.guard) {
          ring(x1, y1, cell * 0.5, cell * 0.5, 'rgba(95,100,116,.9)', 600, 4);
          text(x1, y1 - cell * 0.75, 'guard', '#5f6474', 13, 800);
          sfx.guard();
        }
        text(x1, y1 - cell * 0.15, `-${e.dmg}`, e.res === 'crit' ? '#b8860b' : '#a33a3a', e.res === 'crit' ? 28 : 21);
        if (e.res === 'crit') {
          text(x1, y1 - cell * 0.75, 'CRIT', '#b8860b', 15, 900);
          shake(11);
        }
      }
      sfx.hit(e.res === 'crit');
      await wait(e.res === 'crit' ? 720 : 520);
      return;
    }
    case 'hp': {
      const v = V.units.get(e.id);
      if (!v) return;
      v.hp = e.hp;
      if (e.why === 'hit' || e.why === 'crit') return;
      const [x, y] = unitPos(e.id);
      if (e.delta > 0) {
        text(x, y - cell * 0.1, `+${e.delta}`, '#2e7a57', 17);
        for (let k = 0; k < 7; k++) V.parts.push({ x: x + (Math.random() - 0.5) * cell * 0.6, y: y + cell * 0.2, vx: 0, vy: -50 - Math.random() * 40, g: 0, r: 2, t0: now() + k * 50, life: 700, col: 'rgba(70,160,90,.85)' });
        sfx.heal();
      } else {
        text(x, y - cell * 0.1, `${e.delta}`, e.why === 'round' ? '#6e4b33' : '#a33a3a', e.why === 'round' ? 15 : 19);
        v.flash = 0.6;
        if (e.why !== 'round') sfx.hit(false);
      }
      await wait(e.why === 'round' ? 180 : 260);
      return;
    }
    case 'wash': {
      const v = V.units.get(e.id);
      if (!v) return;
      v.busy = true;
      const [x, y] = unitPos(e.id);
      // Aufblähen und zittern, dann platzen: Tropfen in der Farbe dessen, der getroffen hat
      const col = rgbCss(e.by !== null ? unitColor(e.by) : unitColor(e.id), 0.85);
      const own = rgbCss(unitColor(e.id), 0.7);
      await tween(380, (p) => {
        v.scale = 1 + 0.32 * p;
        v.rot = Math.sin(p * 40) * 0.08 * p;
        v.flash = 0.5 * p;
      });
      sfx.wash();
      shake(9);
      text(x, y - cell * 0.4, 'burst!', '#6e4b33', 18, 1300);
      ring(x, y, cell * 0.3, cell * 1.6, col, 600, 6);
      for (let k = 0; k < 26; k++) {
        const a = (k / 26) * Math.PI * 2 + Math.random() * 0.2,
          sp = 120 + Math.random() * 160;
        V.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 260, r: 2.5 + Math.random() * 3, t0: now(), life: 700 + Math.random() * 300, col: k % 3 ? col : own });
      }
      await tween(260, (p) => {
        v.alpha = 1 - p;
        v.scale = 1.32 + 0.4 * p;
      });
      Object.assign(v, { state: 'gone', busy: false, rot: 0, flash: 0 });
      setCell(e.cell.i, e.cell.c, 'grow', 0, 400);
      return;
    }
    case 'pos': {
      const v = V.units.get(e.id);
      if (!v) return;
      v.busy = true;
      const ax = v.dx,
        ay = v.dy;
      const dur = e.how === 'push' ? 240 : e.how === 'dash' ? 200 : e.how === 'leap' ? 520 : 560;
      if (e.how === 'dash') sfx.launch();
      if (e.how === 'leap') sfx.rise();
      await tween(
        dur,
        (p) => {
          v.dx = ax + (e.x - ax) * p;
          v.dy = ay + (e.y - ay) * p;
          v.lift = e.how === 'leap' ? Math.sin(Math.PI * p) * 1.1 : 0;
          v.alpha = e.how === 'drift' ? 1 - Math.sin(Math.PI * p) * 0.45 : 1;
          if (e.how === 'dash' && Math.random() < 0.7) {
            const [x, y] = unitPos(e.id);
            V.parts.push({ x, y: y + (Math.random() - 0.5) * cell * 0.5, vx: (ax - e.x) * 120, vy: (ay - e.y) * 120, g: 0, r: 1.5, t0: now(), life: 300, col: 'rgba(120,120,130,.7)' });
          }
        },
        e.how === 'push' ? easeOut : easeInOut,
      );
      v.lift = 0;
      v.alpha = 1;
      v.busy = false;
      if (e.how === 'leap') {
        const [x, y] = unitPos(e.id);
        splatter(x, y + cell * 0.3, rgbCss(unitColor(e.id), 0.7), 10, 0.8);
        shake(4);
      }
      return;
    }
    case 'ability': {
      const [x, y] = unitPos(e.id);
      hooks.banner(e.name, 'ability');
      sfx.ability();
      ring(x, y, cell * 0.3, cell * 0.8, 'rgba(201,150,30,.95)', 600, 4);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        V.parts.push({ x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, g: 0, r: 2, t0: now(), life: 500, col: 'rgba(222,178,60,.95)' });
      }
      const col = rgbCss(unitColor(e.id), 0.8);
      const ax = cx(e.at),
        ay = cy(e.at);
      switch (e.bp) {
        case 'flatterer':
          for (let k = 0; k < 3; k++) window.setTimeout(() => ring(x, y, cell * 0.4, cell * 2.6, 'rgba(255,255,255,.95)', 600, 6), k * 120);
          break;
        case 'doppelkopf':
          for (let k = 0; k < 3; k++) window.setTimeout(() => ring(x, y, cell * 0.4, cell * 2.6, 'rgba(110,80,160,.8)', 650, 5), k * 140);
          shake(5);
          break;
        case 'strahler':
          for (let k = 0; k < 20; k++) {
            const a = (k / 20) * Math.PI * 2;
            V.parts.push({ x, y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, g: 60, r: 3, t0: now(), life: 450, col });
          }
          break;
        case 'schwebeblase':
          for (let k = 0; k < 46; k++) {
            const px = ax + (Math.random() - 0.5) * cell * 3,
              t0 = now() + Math.random() * 500;
            V.parts.push({ x: px, y: ay - cell * 2 - Math.random() * cell, vx: -10, vy: 260, g: 300, r: 1.6, t0, life: 600, col: 'rgba(80,130,190,.75)' });
          }
          break;
        case 'turm':
          for (const u of V.units.values()) if (u.side === unitById(e.id)!.side && u.state === 'sheet') ring((u.dx + 0.5) * cell, (u.dy + 0.5) * cell, cell * 0.55, cell * 0.5, 'rgba(95,100,116,.95)', 900, 5);
          break;
        case 'knolle':
          for (const u of V.units.values())
            if (u.side === unitById(e.id)!.side && u.state === 'sheet')
              for (let k = 0; k < 8; k++) V.parts.push({ x: (u.dx + 0.5) * cell + (Math.random() - 0.5) * cell * 0.6, y: (u.dy + 0.7) * cell, vx: 0, vy: -60 - Math.random() * 50, g: 0, r: 2.2, t0: now() + k * 40, life: 700, col: 'rgba(70,160,90,.85)' });
          break;
        case 'schlange':
          ring(ax, ay, cell * 0.9, cell * 0.35, col, 500, 5);
          window.setTimeout(() => ring(ax, ay, cell * 0.8, cell * 0.3, col, 500, 4), 150);
          break;
        case 'krabbe':
          window.setTimeout(() => {
            ring(ax, ay, cell * 0.1, cell * 0.9, 'rgba(60,50,40,.8)', 400, 6);
            shake(8);
          }, 250);
          break;
        case 'kriecher':
          for (const i of e.area) window.setTimeout(() => ring(cx(i), cy(i), cell * 0.1, cell * 0.45, 'rgba(255,255,255,.9)', 400, 3), Math.random() * 300);
          break;
      }
      await wait(650);
      return;
    }
    case 'cells': {
      if (e.how === 'bleed') {
        sfx.bleed();
        for (const s of e.cells) setCell(s.i, s.c, 'fade', Math.random() * 250, 650);
        await wait(700);
      } else if (e.how === 'splat') {
        for (const s of e.cells) setCell(s.i, s.c, 'grow', 0, 260);
      } else if (e.how === 'burst') {
        // Der ausgewaschene Klecks platzt: seine Farbe spritzt ringsum
        for (const s of e.cells) {
          setCell(s.i, s.c, 'grow', Math.random() * 120, 380);
          splatter(cx(s.i), cy(s.i), rgbCss(s.c.rgb, 0.8), 6, 0.7);
        }
        shake(7);
        await wait(420);
      } else {
        for (const s of e.cells) setCell(s.i, s.c, 'shine', Math.random() * 200, 500);
        await wait(450);
      }
      return;
    }
    case 'heart': {
      const team = S.teams[e.side - 1]!;
      V.crack[e.side - 1] = now();
      if (V.teams[e.side - 1]) V.teams[e.side - 1]!.hearts = e.hearts;
      hooks.hud();
      shake(12);
      if (e.side === 1) V.flashRed = now();
      text(cx(team.home), cy(team.home) - cell * 0.3, '-♥', e.side === 1 ? '#2b3fa3' : '#a33a3a', 34, 1400);
      splatter(cx(team.home), cy(team.home), e.side === 1 ? 'rgba(43,63,163,.8)' : 'rgba(163,58,58,.8)', 24, 1.3);
      // Scherben der Palette
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        V.parts.push({ x: cx(team.home), y: cy(team.home), vx: Math.cos(a) * (90 + Math.random() * 90), vy: Math.sin(a) * (120 + Math.random() * 80), g: 420, r: 3 + Math.random() * 2, t0: now(), life: 900, col: 'rgba(255,253,248,.95)' });
      }
      ring(cx(team.home), cy(team.home), cell * 0.3, cell * 1.4, e.side === 1 ? 'rgba(43,63,163,.7)' : 'rgba(163,58,58,.7)', 700, 5);
      sfx.heart();
      await wait(1200);
      return;
    }
    case 'eraser': {
      V.eraser = { row: e.row, t0: now(), dur: 1100 / V.speed };
      sfx.eraser();
      hooks.banner('The Eraser', 'big');
      for (const s of e.cells) {
        const x = s.i % COLS;
        const from = V.cells[s.i] ? { ...V.cells[s.i]! } : undefined;
        V.cells[s.i] = { ...s.c };
        V.anims.set(s.i, { t0: now() + ((x + 0.5) / COLS) * 1000 / V.speed, dur: 260 / V.speed, kind: 'erase', from });
      }
      await wait(1250);
      return;
    }
  }
}
function unitColor(id: number): readonly number[] {
  const u = unitById(id);
  return u ? PIG[u.m.main].rgb : [120, 110, 100];
}
