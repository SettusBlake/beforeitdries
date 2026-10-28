/*
 * Prototyp „Farbschlacht“: zwei Teams aus drei Klecksen malen um ein Blatt, bevor es trocknet.
 * Nur zum Ausprobieren der Idee (Artifact), nicht Teil des Spiels.
 */
import { deformN, ellipsePts, grainTex, renderMonster } from '../../src/client/renderer/watercolor';
import { BP, PIG, type BlueprintId, type PigmentId, type RGB } from '../../src/shared/data';
import { relation } from '../../src/shared/glaze';
import { humidityFor, makeMonster, statRows, type Monster } from '../../src/shared/monster';
import { RNG, hashStr, type Rand } from '../../src/shared/rng';

/* ---------- Regeln ---------- */
const COLS = 7,
  ROWS = 9,
  ROUNDS = 8,
  WET_TURNS = 2,
  WATER_START = 2,
  WATER_MAX = 4,
  ERASER_ROUNDS = [3, 6];

type Side = 1 | 2;
type Tech = 'dry' | 'wet';
type Cell = { owner: 0 | 1 | 2 | 3; rgb: RGB; hue: PigmentId | null; wet: number; atk: number; def: number; lf: number; stamp: number };
type Brush = { m: Monster; name: string; sat: number; opa: number; grn: number; flo: number; lf: number; pattern: [number, number][] };
type Team = { side: Side; brushes: Brush[]; water: number; rest: number };

const PATTERNS: Record<BlueprintId, [number, number][]> = {
  kriecher: [[-1, 0], [0, 0], [1, 0], [2, 0]],
  flatterer: [[0, 0], [-1, 0], [1, 0], [-2, -1], [2, -1]],
  schwebeblase: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]],
  vierbeiner: [[0, 0], [1, 0], [0, 1], [1, 1]],
  schlange: [[-1, -1], [0, -1], [0, 0], [0, 1], [1, 1]],
  turm: [[0, -1], [0, 0], [0, 1], [0, 2]],
  krabbe: [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]],
  qualle: [[0, 0], [-1, 0], [1, 0], [0, 1], [0, 2]],
  huepfer: [[0, 0], [2, 0], [-2, 0], [0, -2]],
  knolle: [[0, 0], [1, 0], [0, 1], [-1, 1], [1, 1]],
  strahler: [[0, 0], [0, -2], [0, 2], [-2, 0], [2, 0]],
  doppelkopf: [[-1, 0], [1, 0], [-1, 1], [1, 1]],
};
const MUD: RGB = [116, 100, 82];
const PAPER: RGB = [247, 245, 239];

const mk = (sheet: string, idx: number) => makeMonster(sheet, idx, humidityFor(sheet));
function find(bp: BlueprintId, main: PigmentId, salt: string): Monster {
  for (let i = 0; i < 40000; i++) {
    const m = mk(salt + i, i % 12);
    if (m.bp === bp && m.main === main) return m;
  }
  return mk(salt, 0);
}
function brushOf(m: Monster): Brush {
  const s = Object.fromEntries(statRows(m).map((r) => [r.k, r.total]));
  return { m, name: `${PIG[m.main].n} ${BP[m.bp].n}`, sat: s.saettigung!, opa: s.deckkraft!, grn: s.koernung!, flo: s.fluss!, lf: s.lichtecht!, pattern: PATTERNS[m.bp] };
}

/* Wahrscheinlichkeit, dass a + W20 > b + W20 (Gleichstand gewinnt der Verteidiger) */
function pWin(a: number, b: number): number {
  let w = 0;
  for (let x = 1; x <= 20; x++) for (let y = 1; y <= 20; y++) if (a + x > b + y) w++;
  return w / 400;
}
const bonus = (v: number) => Math.round(v / 5);

/* ---------- Zustand ---------- */
let cells: Cell[] = [];
let teams: [Team, Team];
let round = 1,
  turn: Side = 1,
  stamp = 0,
  gameSeed = 0,
  over = false;
let selBrush = 0,
  tech: Tech = 'dry',
  target: number | null = null;
let dice: Rand = RNG(1);
let log: { t: string; c: string }[] = [];
let sepiaLine = 'Cover more paper than your rival before it dries. Mind the complementary colours.';
let lastRival: number[] = [];

const idx = (x: number, y: number) => y * COLS + x;
const inside = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < ROWS;

function emptyCell(): Cell {
  return { owner: 0, rgb: PAPER, hue: null, wet: 0, atk: 0, def: 0, lf: 0, stamp: 0 };
}

function newGame(seed: number): void {
  gameSeed = seed;
  const r = RNG(seed);
  dice = RNG(seed ^ 0xabcdef);
  cells = Array.from({ length: COLS * ROWS }, emptyCell);
  round = 1;
  turn = 1;
  over = false;
  stamp = 0;
  log = [];
  lastRival = [];
  target = null;
  selBrush = 0;
  tech = 'dry';
  if (seed === 1) {
    teams = [
      { side: 1, brushes: [find('schlange', 'ultra', 'A'), find('kriecher', 'kadmium', 'B'), find('huepfer', 'phthalo', 'C')].map(brushOf), water: WATER_START, rest: -1 },
      { side: 2, brushes: [find('krabbe', 'siena', 'D'), find('qualle', 'karmin', 'E'), find('schwebeblase', 'opera', 'F')].map(brushOf), water: WATER_START, rest: -1 },
    ];
  } else {
    const pick = (salt: string) => [0, 1, 2].map((i) => brushOf(mk(salt + Math.floor(r() * 1e6), Math.floor(r() * 12))));
    teams = [
      { side: 1, brushes: pick('Y'), water: WATER_START, rest: -1 },
      { side: 2, brushes: pick('R'), water: WATER_START, rest: -1 },
    ];
  }
  sepiaLine = 'Cover more paper than your rival before it dries. Mind the complementary colours.';
  renderAll(true);
}

/* Was passiert, wenn ein Pinsel eine Zelle trifft */
type Outcome = { kind: 'take' | 'refresh' | 'contest' | 'mud' | 'none' | 'over'; p: number; label: string };
function outcome(b: Brush, side: Side, t: Tech, c: Cell): Outcome {
  const foe = side === 1 ? 2 : 1;
  if (c.owner === 0) return { kind: 'take', p: 1, label: 'free paper' };
  if (c.owner === side) return { kind: 'refresh', p: 1, label: 'your paint' };
  if (c.owner === 3) return t === 'dry' ? { kind: 'over', p: pWin(bonus(b.opa), 6), label: 'scrape the mud' } : { kind: 'none', p: 0, label: 'mud soaks it up' };
  if (c.owner === foe && c.wet > 0) {
    if (c.hue && relation(b.m.main, c.hue) === 'komplementaer') return { kind: 'mud', p: 1, label: 'complementary: both turn to mud' };
    return { kind: 'contest', p: pWin(bonus(b.sat), c.atk), label: 'into wet paint' };
  }
  if (t === 'wet') return { kind: 'none', p: 0, label: 'water beads on dry paint' };
  return { kind: 'over', p: pWin(bonus(b.opa), c.def), label: 'paint over dry paint' };
}

function patternCells(b: Brush, at: number): number[] {
  const x0 = at % COLS,
    y0 = Math.floor(at / COLS);
  return b.pattern.map(([dx, dy]) => [x0 + dx, y0 + dy] as const).filter(([x, y]) => inside(x, y)).map(([x, y]) => idx(x, y));
}

function paintCell(c: Cell, b: Brush, side: Side, t: Tech): void {
  c.owner = side;
  c.rgb = PIG[b.m.main].rgb;
  c.hue = b.m.main;
  c.wet = t === 'wet' ? WET_TURNS : 0;
  c.atk = bonus(b.sat);
  c.def = bonus(b.grn);
  c.lf = b.lf;
  c.stamp = ++stamp;
}

const d20 = () => 1 + Math.floor(dice() * 20);

/* Einen Zug ausführen, gibt eine Logzeile zurück */
function play(side: Side, bi: number, t: Tech, at: number): string {
  const team = teams[side - 1]!;
  const b = team.brushes[bi]!;
  if (t === 'wet') team.water--;
  team.rest = bi;
  let took = 0,
    mud = 0,
    lost = 0;
  const rolls: string[] = [];
  for (const i of patternCells(b, at)) {
    const c = cells[i]!;
    const o = outcome(b, side, t, c);
    if (o.kind === 'take' || o.kind === 'refresh') {
      paintCell(c, b, side, t);
      if (o.kind === 'take') took++;
    } else if (o.kind === 'mud') {
      c.owner = 3;
      c.rgb = MUD;
      c.hue = null;
      c.wet = 0;
      c.stamp = ++stamp;
      mud++;
    } else if (o.kind === 'contest' || o.kind === 'over') {
      const a = d20(),
        d = d20();
      const atk = o.kind === 'contest' ? bonus(b.sat) : bonus(b.opa);
      const def = c.owner === 3 ? 6 : o.kind === 'contest' ? c.atk : c.def;
      rolls.push(`d${a}+${atk} vs d${d}+${def}`);
      if (a + atk > d + def) {
        paintCell(c, b, side, t);
        took++;
      } else lost++;
    }
  }
  const who = side === 1 ? 'Your' : 'Rival';
  const techName = t === 'wet' ? 'wet-in-wet' : 'dry brush';
  const parts = [`${took} taken`];
  if (mud) parts.push(`${mud} to mud`);
  if (lost) parts.push(`${lost} held`);
  return `${who} ${b.name}, ${techName}: ${parts.join(', ')}${rolls.length ? ` (${rolls.join('; ')})` : ''}.`;
}

/* Ende einer Runde: nasse Farbe verläuft, trocknet, der Radierer kommt */
function endRound(): void {
  const r = RNG(gameSeed + round * 977);
  const spreads: [number, Cell][] = [];
  cells.forEach((c, i) => {
    if (c.owner !== 1 && c.owner !== 2) return;
    if (c.wet <= 0) return;
    const b = teams[c.owner - 1]!.brushes.find((x) => x.m.main === c.hue);
    const flow = b ? b.flo : 20;
    if (r() < Math.min(0.85, flow / 40)) {
      const x = i % COLS,
        y = Math.floor(i / COLS);
      const n = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].filter(([a, bb]) => inside(a!, bb!) && cells[idx(a!, bb!)]!.owner === 0);
      if (n.length) {
        const [a, bb] = n[Math.floor(r() * n.length)]!;
        spreads.push([idx(a!, bb!), { ...c, wet: Math.max(0, c.wet - 1), stamp: ++stamp }]);
      }
    }
  });
  for (const [i, c] of spreads) if (cells[i]!.owner === 0) cells[i] = c;
  const spreadN = spreads.length;
  cells.forEach((c) => {
    if (c.wet > 0) c.wet--;
  });
  if (spreadN) log.unshift({ t: `The wet paint bled into ${spreadN} more cell${spreadN > 1 ? 's' : ''}.`, c: 'muted' });
  if (ERASER_ROUNDS.includes(round)) {
    const row = Math.floor(r() * ROWS);
    let gone = 0,
      held = 0;
    for (let x = 0; x < COLS; x++) {
      const c = cells[idx(x, row)]!;
      if (c.owner === 0) continue;
      if (c.owner !== 3 && d20() + bonus(c.lf) >= 18) {
        held++;
        continue;
      }
      cells[idx(x, row)] = emptyCell();
      gone++;
    }
    eraserRow = row;
    log.unshift({ t: `The Eraser passed through row ${row + 1}: ${gone} erased, ${held} held (Lightfastness).`, c: 'eraser' });
    sepiaLine = 'Someone has been at the sheet again. Paint faster.';
  }
  teams.forEach((t) => (t.water = Math.min(WATER_MAX, t.water + 1)));
  round++;
  if (round > ROUNDS) finish();
}
let eraserRow = -1;

function counts(): [number, number, number] {
  let a = 0,
    b = 0,
    m = 0;
  for (const c of cells) {
    if (c.owner === 1) a++;
    else if (c.owner === 2) b++;
    else if (c.owner === 3) m++;
  }
  return [a, b, m];
}

function finish(): void {
  over = true;
  const [a, b] = counts();
  sepiaLine = a > b ? 'It dried in your favour. Do not get used to it.' : a < b ? 'Your rival had the wetter brush. Again?' : 'A draw. The paper wins.';
  log.unshift({ t: `The paper is dry. You ${a}, rival ${b}.`, c: a > b ? 'ok' : a < b ? 'bad' : 'muted' });
}

/* ---------- Gegner: wählt den Zug mit dem besten Erwartungswert ---------- */
function rivalMove(): void {
  const team = teams[1];
  let best = { v: -1e9, bi: 0, t: 'dry' as Tech, at: 0 };
  const r = RNG(gameSeed + round * 31 + 7);
  team.brushes.forEach((b, bi) => {
    if (bi === team.rest) return;
    for (const t of ['dry', 'wet'] as Tech[]) {
      if (t === 'wet' && team.water <= 0) continue;
      for (let at = 0; at < COLS * ROWS; at++) {
        let v = 0;
        const cs = patternCells(b, at);
        for (const i of cs) {
          const c = cells[i]!;
          const o = outcome(b, 2, t, c);
          if (o.kind === 'take') v += 1;
          else if (o.kind === 'mud') v += 1;
          else if (o.kind === 'contest' || o.kind === 'over') v += o.p * (c.owner === 1 ? 2 : 1);
          else if (o.kind === 'refresh') v += t === 'wet' && c.wet === 0 ? 0.1 : 0;
        }
        if (t === 'wet') v += 0.35 * cs.filter((i) => cells[i]!.owner === 0).length * (b.flo / 40) - 0.6;
        v += r() * 0.3;
        if (v > best.v) best = { v, bi, t, at };
      }
    }
  });
  lastRival = patternCells(team.brushes[best.bi]!, best.at);
  log.unshift({ t: play(2, best.bi, best.t, best.at), c: 'rival' });
}

/* ---------- Zeichnen ---------- */
const board = document.getElementById('board') as HTMLCanvasElement;
let cellPx = 60,
  dpr = Math.min(2, window.devicePixelRatio || 1);

function drawBoard(): void {
  const w = board.getBoundingClientRect().width || 360;
  cellPx = w / COLS;
  const W = Math.round(w * dpr),
    H = Math.round(cellPx * ROWS * dpr);
  if (board.width !== W) board.width = W;
  if (board.height !== H) board.height = H;
  board.style.height = cellPx * ROWS + 'px';
  const ctx = board.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgb(${PAPER})`;
  ctx.fillRect(0, 0, w, cellPx * ROWS);
  const pat = ctx.createPattern(grainTex(), 'repeat')!;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, cellPx * ROWS);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(80,90,110,.12)';
  ctx.lineWidth = 1;
  for (let x = 1; x < COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cellPx, 0);
    ctx.lineTo(x * cellPx, ROWS * cellPx);
    ctx.stroke();
  }
  for (let y = 1; y < ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellPx);
    ctx.lineTo(COLS * cellPx, y * cellPx);
    ctx.stroke();
  }
  if (eraserRow >= 0) {
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(0, eraserRow * cellPx + 2, COLS * cellPx, cellPx - 4);
    ctx.strokeStyle = 'rgba(160,150,140,.35)';
    ctx.setLineDash([3, 5]);
    ctx.strokeRect(1, eraserRow * cellPx + 2, COLS * cellPx - 2, cellPx - 4);
    ctx.setLineDash([]);
  }
  ctx.globalCompositeOperation = 'multiply';
  cells.forEach((c, i) => {
    if (c.owner === 0) return;
    const x = (i % COLS) * cellPx + cellPx / 2,
      y = Math.floor(i / COLS) * cellPx + cellPx / 2;
    const r = RNG(hashStr(`${gameSeed}:${i}:${c.stamp}`));
    const b = { x, y, rx: cellPx * 0.6, ry: cellPx * 0.6, rot: 0 };
    const base = deformN(ellipsePts(b, 1, r, 10), r, 0.28, 3);
    const layers = c.owner === 3 ? 7 : 9;
    ctx.fillStyle = `rgba(${c.rgb},${c.owner === 3 ? 0.13 : 0.11})`;
    for (let k = 0; k < layers; k++) {
      ctx.beginPath();
      const p = deformN(base, r, 0.22, 1);
      ctx.moveTo(p[0]![0], p[0]![1]);
      for (const q of p) ctx.lineTo(q[0], q[1]);
      ctx.closePath();
      ctx.fill();
    }
    if (c.wet <= 0) {
      ctx.strokeStyle = `rgba(${c.rgb.map((v) => Math.round(v * 0.55))},.22)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      base.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.stroke();
    }
  });
  ctx.globalCompositeOperation = 'source-over';
  // Nasse Farbe glänzt
  cells.forEach((c, i) => {
    if (c.wet <= 0 || c.owner === 0) return;
    const x = (i % COLS) * cellPx + cellPx / 2,
      y = Math.floor(i / COLS) * cellPx + cellPx / 2;
    const g = ctx.createRadialGradient(x - cellPx * 0.18, y - cellPx * 0.2, 1, x, y, cellPx * 0.5);
    g.addColorStop(0, `rgba(255,255,255,${0.32 + 0.1 * c.wet})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - cellPx / 2, y - cellPx / 2, cellPx, cellPx);
    ctx.fillStyle = 'rgba(30,60,110,.55)';
    for (let k = 0; k < c.wet; k++) {
      ctx.beginPath();
      ctx.arc(x + cellPx * 0.32 - k * 7, y + cellPx * 0.34, 2.2, 0, 7);
      ctx.fill();
    }
  });
  // Letzter Zug des Gegners
  ctx.strokeStyle = 'rgba(163,58,58,.55)';
  ctx.lineWidth = 2;
  for (const i of lastRival) ctx.strokeRect((i % COLS) * cellPx + 3, Math.floor(i / COLS) * cellPx + 3, cellPx - 6, cellPx - 6);
  // Vorschau
  if (target !== null && !over) {
    const b = teams[0].brushes[selBrush]!;
    for (const i of patternCells(b, target)) {
      const o = outcome(b, 1, tech, cells[i]!);
      const col = o.kind === 'take' ? '46,122,87' : o.kind === 'mud' ? '110,75,51' : o.kind === 'none' ? '120,120,130' : o.kind === 'refresh' ? '90,100,120' : '168,108,18';
      ctx.strokeStyle = `rgba(${col},.95)`;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect((i % COLS) * cellPx + 4, Math.floor(i / COLS) * cellPx + 4, cellPx - 8, cellPx - 8);
      ctx.setLineDash([]);
      if (o.kind === 'contest' || o.kind === 'over') {
        ctx.fillStyle = `rgba(${col},1)`;
        ctx.font = '600 12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(o.p * 100) + '%', (i % COLS) * cellPx + cellPx / 2, Math.floor(i / COLS) * cellPx + cellPx / 2 + 4);
      }
    }
  }
}

/* ---------- Oberfläche ---------- */
const $ = (id: string) => document.getElementById(id)!;
const portraits = new Map<string, HTMLCanvasElement>();
function portrait(m: Monster, size: number): HTMLCanvasElement {
  const key = `${m.seed}:${size}`;
  let c = portraits.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.style.width = c.style.height = size + 'px';
    renderMonster(c, m, size, { dpr: Math.min(2, window.devicePixelRatio || 1) });
    c.style.width = c.style.height = size + 'px';
    portraits.set(key, c);
  }
  return c;
}
function patternIcon(p: [number, number][]): HTMLElement {
  const g = document.createElement('span');
  g.className = 'pat';
  const xs = p.map((q) => q[0]),
    ys = p.map((q) => q[1]);
  const x0 = Math.min(...xs),
    y0 = Math.min(...ys);
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) {
      const i = document.createElement('i');
      if (p.some((q) => q[0] - x0 === x && q[1] - y0 === y)) i.className = 'on';
      g.append(i);
    }
  return g;
}

function renderRival(): void {
  const box = $('rival');
  box.replaceChildren();
  teams[1].brushes.forEach((b, i) => {
    const d = document.createElement('div');
    d.className = 'rb' + (i === teams[1].rest ? ' resting' : '');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = `rgb(${PIG[b.m.main].rgb})`;
    const n = document.createElement('small');
    n.textContent = b.name;
    d.append(portrait(b.m, 40), n);
    box.append(d);
  });
  $('rival-water').textContent = '';
  for (let k = 0; k < WATER_MAX; k++) {
    const i = document.createElement('i');
    if (k < teams[1].water) i.className = 'on';
    $('rival-water').append(i);
  }
}

function renderBrushes(): void {
  const box = $('brushes');
  box.replaceChildren();
  teams[0].brushes.forEach((b, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'brush' + (i === selBrush ? ' sel' : '') + (i === teams[0].rest ? ' resting' : '');
    btn.disabled = i === teams[0].rest || over;
    btn.setAttribute('aria-pressed', String(i === selBrush));
    const top = document.createElement('div');
    top.className = 'bt';
    top.append(portrait(b.m, 48), patternIcon(b.pattern));
    const name = document.createElement('b');
    name.textContent = b.name;
    const stats = document.createElement('div');
    stats.className = 'bs';
    for (const [k, v] of [
      ['SAT', b.sat],
      ['OPA', b.opa],
      ['GRN', b.grn],
      ['FLO', b.flo],
      ['LFT', b.lf],
    ] as [string, number][]) {
      const s = document.createElement('span');
      s.textContent = `${k} ${v}`;
      stats.append(s);
    }
    const st = document.createElement('small');
    st.className = 'rest';
    const muddies = teams[1].brushes.filter((x) => relation(b.m.main, x.m.main) === 'komplementaer').map((x) => PIG[x.m.main].n.split(' ')[0]);
    st.textContent = i === teams[0].rest ? 'drying, next turn' : muddies.length ? `muddies wet ${muddies.join(', ')}` : 'no colour to muddy';
    btn.append(top, name, stats, st);
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      selBrush = i;
      renderAll(false);
    });
    box.append(btn);
  });
}

function renderHud(): void {
  const [a, b, m] = counts();
  $('score-you').textContent = String(a);
  $('score-rival').textContent = String(b);
  $('score-mud').textContent = String(m);
  const tot = COLS * ROWS;
  ($('bar-you') as HTMLElement).style.width = (a / tot) * 100 + '%';
  ($('bar-mud') as HTMLElement).style.width = (m / tot) * 100 + '%';
  ($('bar-rival') as HTMLElement).style.width = (b / tot) * 100 + '%';
  $('round').textContent = over ? 'Dry' : `Round ${round} / ${ROUNDS}`;
  const left = ROUNDS - round + 1;
  $('dries').textContent = over ? 'the paper is dry' : ERASER_ROUNDS.includes(round) ? 'Eraser comes next' : left === 1 ? 'last round' : `dries in ${left}`;
  const w = $('water');
  w.replaceChildren();
  for (let k = 0; k < WATER_MAX; k++) {
    const i = document.createElement('i');
    if (k < teams[0].water) i.className = 'on';
    w.append(i);
  }
  ($('tech-dry') as HTMLButtonElement).setAttribute('aria-pressed', String(tech === 'dry'));
  ($('tech-wet') as HTMLButtonElement).setAttribute('aria-pressed', String(tech === 'wet'));
  ($('tech-wet') as HTMLButtonElement).disabled = teams[0].water <= 0 || over;
  const info = $('preview');
  const paintBtn = $('paint') as HTMLButtonElement;
  if (over) {
    info.textContent = '';
    paintBtn.textContent = 'New duel';
    paintBtn.disabled = false;
  } else if (target === null) {
    info.textContent = 'Pick a brush, tap the paper to aim, tap again to paint.';
    paintBtn.textContent = 'Paint';
    paintBtn.disabled = true;
  } else {
    const b = teams[0].brushes[selBrush]!;
    let free = 0,
      mud = 0,
      none = 0;
    const odds: number[] = [];
    for (const i of patternCells(b, target)) {
      const o = outcome(b, 1, tech, cells[i]!);
      if (o.kind === 'take') free++;
      else if (o.kind === 'mud') mud++;
      else if (o.kind === 'none') none++;
      else if (o.kind === 'contest' || o.kind === 'over') odds.push(Math.round(o.p * 100));
    }
    const parts = [];
    if (free) parts.push(`${free} free`);
    if (odds.length) parts.push(`${odds.length} contested (${odds.join('%, ')}%)`);
    if (mud) parts.push(`${mud} to mud`);
    if (none) parts.push(`${none} no effect`);
    info.textContent = parts.join(' · ') || 'Nothing to gain here.';
    paintBtn.textContent = tech === 'wet' ? 'Paint wet' : 'Paint dry';
    paintBtn.disabled = false;
  }
  const l = $('log');
  l.replaceChildren();
  for (const e of log.slice(0, 4)) {
    const li = document.createElement('li');
    li.className = e.c;
    li.textContent = e.t;
    l.append(li);
  }
  $('sepia').textContent = sepiaLine;
  $('result').hidden = !over;
  if (over) {
    const [x, y] = counts();
    $('result-title').textContent = x > y ? 'You win the sheet' : x < y ? 'The rival wins the sheet' : 'A draw';
    $('result-sub').textContent = `${x} cells to ${y}, ${counts()[2]} lost to mud.`;
  }
}

function renderAll(withRival: boolean): void {
  if (withRival) renderRival();
  else renderRival();
  renderBrushes();
  renderHud();
  drawBoard();
}

board.addEventListener('click', (e) => {
  if (over || turn !== 1) return;
  const rect = board.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / cellPx),
    y = Math.floor((e.clientY - rect.top) / cellPx);
  if (!inside(x, y)) return;
  const i = idx(x, y);
  if (target === i) {
    commit();
    return;
  }
  target = i;
  renderHud();
  drawBoard();
});

function commit(): void {
  if (over || target === null || turn !== 1) return;
  if (tech === 'wet' && teams[0].water <= 0) return;
  eraserRow = -1;
  log.unshift({ t: play(1, selBrush, tech, target), c: 'you' });
  target = null;
  turn = 2;
  // nächster Pinsel, der nicht ruht
  if (selBrush === teams[0].rest) selBrush = (selBrush + 1) % 3;
  if (tech === 'wet' && teams[0].water <= 0) tech = 'dry';
  renderAll(false);
  window.setTimeout(() => {
    rivalMove();
    turn = 1;
    endRound();
    if (!over && selBrush === teams[0].rest) selBrush = (selBrush + 1) % 3;
    renderAll(false);
  }, 650);
}

$('paint').addEventListener('click', () => {
  if (over) {
    newGame((Math.random() * 1e9) >>> 0);
    return;
  }
  commit();
});
$('tech-dry').addEventListener('click', () => {
  tech = 'dry';
  renderAll(false);
});
$('tech-wet').addEventListener('click', () => {
  if (teams[0].water <= 0) return;
  tech = 'wet';
  renderAll(false);
});
$('again').addEventListener('click', () => newGame((Math.random() * 1e9) >>> 0));
$('new').addEventListener('click', () => newGame((Math.random() * 1e9) >>> 0));

let rt = 0;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = window.setTimeout(() => drawBoard(), 150);
});

newGame(1);
(window as unknown as { done: boolean }).done = true;
