/*
 * Prototyp „Farbschlacht 2“: Monster stehen auf dem Blatt, Farbe ist Gelände, Spritzer treffen,
 * Deckkraft ist Lebenskraft. Gewinnen durch Auswaschen aller Gegner oder mehr Papier beim Trocknen.
 * Nur zum Ausprobieren der Idee (Artifact), nicht Teil des Spiels.
 */
import { deformN, ellipsePts, grainTex, renderMonster } from '../../src/client/renderer/watercolor';
import { BP, PIG, type BlueprintId, type PigmentId, type RGB } from '../../src/shared/data';
import { relation } from '../../src/shared/glaze';
import { humidityFor, makeMonster, statRows, type Monster } from '../../src/shared/monster';
import { RNG, hashStr, type Rand } from '../../src/shared/rng';

/* ---------- Regeln (alle Zahlen hier) ---------- */
const COLS = 7,
  ROWS = 9,
  ROUNDS = 8,
  WET_TURNS = 2,
  WATER_START = 2,
  WATER_MAX = 4,
  ERASER_ROUNDS = [3, 6],
  PAINT_RANGE = 2,
  ALIVE_BONUS = 3;

type Side = 1 | 2;
type Action = 'dry' | 'wet' | 'splash' | 'soak';
type Cell = { owner: 0 | 1 | 2 | 3; rgb: RGB; hue: PigmentId | null; wet: number; atk: number; def: number; lf: number; stamp: number };
type Quirk = { key: string; text: string };
type Unit = {
  id: number;
  side: Side;
  m: Monster;
  name: string;
  sat: number;
  opa: number;
  grn: number;
  flo: number;
  glw: number;
  lf: number;
  hp: number;
  max: number;
  x: number;
  y: number;
  alive: boolean;
  stain: number;
  pattern: [number, number][];
  quirk: Quirk;
};
type Team = { side: Side; units: Unit[]; water: number; rest: number };

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
const QUIRKS: Record<BlueprintId, Quirk> = {
  kriecher: { key: 'trail-dry', text: 'leaves a dry trail where it crawls' },
  flatterer: { key: 'fly', text: 'flies over any paint and mud' },
  schwebeblase: { key: 'float', text: 'floats over mud, never gets stuck' },
  vierbeiner: { key: 'fast', text: 'runs one step further' },
  schlange: { key: 'slide', text: 'slides through its own paint for free' },
  turm: { key: 'tower', text: 'never moves, paints and splashes from afar' },
  krabbe: { key: 'pinch', text: 'pinches: +3 splash damage up close' },
  qualle: { key: 'trail-wet', text: 'drips a wet trail where it drifts' },
  huepfer: { key: 'hop', text: 'hops two cells, over anything' },
  knolle: { key: 'root', text: 'soaks twice as well' },
  strahler: { key: 'reach', text: 'splashes two cells away' },
  doppelkopf: { key: 'twin', text: 'splashes twice with two heads' },
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
let uid = 0;
function unitOf(m: Monster, side: Side, x: number, y: number): Unit {
  const s = Object.fromEntries(statRows(m).map((r) => [r.k, r.total]));
  const max = 12 + Math.round(s.deckkraft! / 2);
  return {
    id: ++uid,
    side,
    m,
    name: `${PIG[m.main].n.split(' ')[0]} ${BP[m.bp].n}`,
    sat: s.saettigung!,
    opa: s.deckkraft!,
    grn: s.koernung!,
    flo: s.fluss!,
    glw: s.leuchten!,
    lf: s.lichtecht!,
    hp: max,
    max,
    x,
    y,
    alive: true,
    stain: 0,
    pattern: PATTERNS[m.bp],
    quirk: QUIRKS[m.bp],
  };
}

/* Wahrscheinlichkeit, dass a + W20 > b + W20 (Gleichstand gewinnt der Verteidiger) */
const pTable = new Map<number, number>();
function pWin(a: number, b: number): number {
  const k = a - b;
  const hit = pTable.get(k);
  if (hit !== undefined) return hit;
  let w = 0;
  for (let x = 1; x <= 20; x++) for (let y = 1; y <= 20; y++) if (k + x > y) w++;
  pTable.set(k, w / 400);
  return w / 400;
}
const bonus = (v: number) => Math.round(v / 5);
const typeMult = (a: PigmentId, b: PigmentId) => {
  const r = relation(a, b);
  return r === 'komplementaer' ? 1.5 : r === 'harmonisch' ? 0.75 : 1;
};
const relWord = (a: PigmentId, b: PigmentId) => {
  const r = relation(a, b);
  return r === 'komplementaer' ? 'complementary ×1.5' : r === 'harmonisch' ? 'harmonious ×0.75' : 'neutral';
};

/* ---------- Zustand ---------- */
let cells: Cell[] = [];
let teams: [Team, Team];
let round = 1,
  turn: Side = 1,
  stamp = 0,
  gameSeed = 0,
  over = false,
  winner: 0 | Side = 0,
  winReason = '';
let dice: Rand = RNG(1);
let log: { t: string; c: string }[] = [];
let sepiaLine = '';
let lastRival: number[] = [];
let eraserRow = -1;

/* Auswahl des Spielers */
let sel: Unit | null = null,
  moved = false,
  action: Action = 'dry',
  target: number | null = null,
  flash: { i: number; t: number }[] = [];

const idx = (x: number, y: number) => y * COLS + x;
const inside = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < ROWS;
const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const allUnits = () => [...teams[0].units, ...teams[1].units].filter((u) => u.alive);
const unitAt = (x: number, y: number) => allUnits().find((u) => u.x === x && u.y === y) ?? null;
const d20 = () => 1 + Math.floor(dice() * 20);
/** Ein Klecks ruht nach seinem Zug, außer er ist der letzte */
function resting(t: Team, i: number): boolean {
  return i === t.rest && t.units.filter((u) => u.alive).length > 1;
}
const emptyCell = (): Cell => ({ owner: 0, rgb: PAPER, hue: null, wet: 0, atk: 0, def: 0, lf: 0, stamp: 0 });

function newGame(seed: number): void {
  gameSeed = seed;
  const r = RNG(seed);
  dice = RNG(seed ^ 0xabcdef);
  cells = Array.from({ length: COLS * ROWS }, emptyCell);
  round = 1;
  turn = 1;
  over = false;
  winner = 0;
  stamp = 0;
  log = [];
  lastRival = [];
  eraserRow = -1;
  sel = null;
  moved = false;
  target = null;
  action = 'dry';
  let mine: Monster[], theirs: Monster[];
  if (seed === 1) {
    mine = [find('schlange', 'ultra', 'A'), find('flatterer', 'kadmium', 'B'), find('huepfer', 'phthalo', 'C')];
    theirs = [find('krabbe', 'siena', 'D'), find('qualle', 'karmin', 'E'), find('strahler', 'opera', 'F')];
  } else {
    const pick = (salt: string) => [0, 1, 2].map(() => mk(salt + Math.floor(r() * 1e6), Math.floor(r() * 12)));
    mine = pick('Y');
    theirs = pick('R');
  }
  teams = [
    { side: 1, units: mine.map((m, i) => unitOf(m, 1, 1 + i * 2, ROWS - 1)), water: WATER_START, rest: -1 },
    { side: 2, units: theirs.map((m, i) => unitOf(m, 2, 1 + i * 2, 0)), water: WATER_START, rest: -1 },
  ];
  // jeder startet auf einem Fleck eigener, trockener Farbe
  for (const t of teams) for (const u of t.units) paintCell(cells[idx(u.x, u.y)]!, u, false);
  sepiaLine = 'Paint is ground here. Walk on your own, splash on theirs. Mind the complementary colours.';
  imgCache.clear();
  renderAll();
}

function paintCell(c: Cell, u: Unit, wet: boolean): void {
  c.owner = u.side;
  c.rgb = PIG[u.m.main].rgb;
  c.hue = u.m.main;
  c.wet = wet ? WET_TURNS : 0;
  c.atk = bonus(u.sat);
  c.def = bonus(u.grn);
  c.lf = u.lf;
  c.stamp = ++stamp;
}
function mudCell(c: Cell): void {
  c.owner = 3;
  c.rgb = MUD;
  c.hue = null;
  c.wet = 0;
  c.stamp = ++stamp;
}

/* ---------- Bewegen: Farbe ist Gelände ---------- */
function moveRange(u: Unit): number {
  if (u.quirk.key === 'tower') return 0;
  return Math.min(5, 2 + Math.floor(u.flo / 15) + (u.quirk.key === 'fast' ? 1 : 0));
}
/** Erreichbare Felder mit Weg (Index → Vorgänger) */
function reach(u: Unit): Map<number, number> {
  const out = new Map<number, number>();
  const range = moveRange(u);
  const start = idx(u.x, u.y);
  out.set(start, -1);
  if (range === 0) return out;
  if (u.quirk.key === 'hop') {
    let frontier = [start];
    for (let h = 0; h < Math.max(1, Math.floor(range / 2)); h++) {
      const next: number[] = [];
      for (const f of frontier) {
        const fx = f % COLS,
          fy = Math.floor(f / COLS);
        for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
          const nx = fx + dx!,
            ny = fy + dy!;
          if (!inside(nx, ny) || unitAt(nx, ny)) continue;
          const ni = idx(nx, ny);
          if (out.has(ni)) continue;
          out.set(ni, f);
          next.push(ni);
        }
      }
      frontier = next;
    }
    return out;
  }
  const cost = new Map<number, number>([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    queue.sort((a, b) => cost.get(a)! - cost.get(b)!);
    const cur = queue.shift()!;
    const c0 = cost.get(cur)!;
    const cx = cur % COLS,
      cy = Math.floor(cur / COLS);
    // Schlamm hält fest (außer Flieger und Schweber)
    if (cur !== start && cells[cur]!.owner === 3 && u.quirk.key !== 'fly' && u.quirk.key !== 'float') continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx!,
        ny = cy + dy!;
      if (!inside(nx, ny) || unitAt(nx, ny)) continue;
      const ni = idx(nx, ny);
      const c = cells[ni]!;
      let step = 1;
      if (u.quirk.key !== 'fly') {
        if (c.owner === u.side && u.quirk.key === 'slide') step = 0.5;
        else if (c.owner !== 0 && c.owner !== u.side && c.owner !== 3) step = 2;
      }
      const nc = c0 + step;
      if (nc > range) continue;
      if (cost.has(ni) && cost.get(ni)! <= nc) continue;
      cost.set(ni, nc);
      out.set(ni, cur);
      queue.push(ni);
    }
  }
  return out;
}
function pathTo(prev: Map<number, number>, to: number): number[] {
  const p: number[] = [];
  let c = to;
  while (c !== -1 && c !== undefined) {
    p.unshift(c);
    c = prev.get(c)!;
  }
  return p;
}
function doMove(u: Unit, to: number, prev: Map<number, number>): string {
  const path = pathTo(prev, to);
  u.x = to % COLS;
  u.y = Math.floor(to / COLS);
  if (u.quirk.key === 'trail-dry' || u.quirk.key === 'trail-wet') {
    let n = 0;
    for (const i of path.slice(0, -1)) {
      const c = cells[i]!;
      if (c.owner === 0 || c.owner === u.side) {
        paintCell(c, u, u.quirk.key === 'trail-wet');
        n++;
      }
    }
    return n ? `left a ${u.quirk.key === 'trail-wet' ? 'wet' : 'dry'} trail of ${n}` : '';
  }
  return '';
}

/* ---------- Malen ---------- */
type Out = { kind: 'take' | 'refresh' | 'contest' | 'mud' | 'none' | 'over'; p: number };
function outcome(u: Unit, wet: boolean, c: Cell): Out {
  const foe = u.side === 1 ? 2 : 1;
  if (c.owner === 0) return { kind: 'take', p: 1 };
  if (c.owner === u.side) return { kind: 'refresh', p: 1 };
  if (c.owner === 3) return wet ? { kind: 'none', p: 0 } : { kind: 'over', p: pWin(bonus(u.opa), 6) };
  if (c.owner === foe && c.wet > 0) {
    if (c.hue && relation(u.m.main, c.hue) === 'komplementaer') return { kind: 'mud', p: 1 };
    return { kind: 'contest', p: pWin(bonus(u.sat), c.atk) };
  }
  if (wet) return { kind: 'none', p: 0 };
  return { kind: 'over', p: pWin(bonus(u.opa), c.def) };
}
const paintRange = (u: Unit) => (u.quirk.key === 'tower' ? 3 : PAINT_RANGE);
function stampCells(u: Unit, at: number): number[] {
  const x0 = at % COLS,
    y0 = Math.floor(at / COLS);
  return u.pattern.map(([dx, dy]) => [x0 + dx, y0 + dy] as const).filter(([x, y]) => inside(x, y)).map(([x, y]) => idx(x, y));
}
function canPaintAt(u: Unit, at: number): boolean {
  return cheb(u.x, u.y, at % COLS, Math.floor(at / COLS)) <= paintRange(u);
}
function doPaint(u: Unit, wet: boolean, at: number): string {
  const team = teams[u.side - 1]!;
  if (wet) team.water--;
  let took = 0,
    mud = 0,
    held = 0;
  const rolls: string[] = [];
  for (const i of stampCells(u, at)) {
    const c = cells[i]!;
    const o = outcome(u, wet, c);
    if (o.kind === 'take' || o.kind === 'refresh') {
      paintCell(c, u, wet);
      if (o.kind === 'take') took++;
    } else if (o.kind === 'mud') {
      mudCell(c);
      mud++;
    } else if (o.kind === 'contest' || o.kind === 'over') {
      const a = d20(),
        d = d20();
      const atk = o.kind === 'contest' ? bonus(u.sat) : bonus(u.opa);
      const def = c.owner === 3 ? 6 : o.kind === 'contest' ? c.atk : c.def;
      rolls.push(`d${a}+${atk} vs d${d}+${def}`);
      if (a + atk > d + def) {
        paintCell(c, u, wet);
        took++;
      } else held++;
    }
    flash.push({ i, t: performance.now() });
  }
  const parts = [`${took} taken`];
  if (mud) parts.push(`${mud} to mud`);
  if (held) parts.push(`${held} held`);
  return `painted ${wet ? 'wet' : 'dry'}: ${parts.join(', ')}${rolls.length ? ` (${rolls.join('; ')})` : ''}`;
}

/* ---------- Spritzer: echter Kampf ---------- */
function splashRange(u: Unit): number {
  let r = u.quirk.key === 'reach' || u.quirk.key === 'tower' ? 2 : 1;
  const c = cells[idx(u.x, u.y)]!;
  if (c.owner === u.side && c.wet > 0) r++;
  return r;
}
function splashTargets(u: Unit): Unit[] {
  return teams[u.side === 1 ? 1 : 0].units.filter((t) => t.alive && cheb(u.x, u.y, t.x, t.y) <= splashRange(u));
}
function splashDamage(u: Unit, t: Unit, near: boolean): number {
  let dmg = (3 + u.sat / 6) * typeMult(u.m.main, t.m.main);
  if (u.quirk.key === 'pinch' && near) dmg += 3;
  if (u.quirk.key === 'twin') dmg *= 0.6;
  return Math.max(1, Math.round(dmg));
}
function splashOdds(u: Unit, t: Unit): number {
  return pWin(bonus(u.sat), bonus(t.grn));
}
function doSplash(u: Unit, t: Unit): string {
  const near = cheb(u.x, u.y, t.x, t.y) <= 1;
  const hits = u.quirk.key === 'twin' ? 2 : 1;
  const parts: string[] = [];
  let total = 0;
  for (let h = 0; h < hits; h++) {
    const a = d20(),
      d = d20();
    const ok = a + bonus(u.sat) > d + bonus(t.grn);
    if (ok) {
      const dmg = splashDamage(u, t, near);
      t.hp -= dmg;
      total += dmg;
      if (relation(u.m.main, t.m.main) === 'komplementaer') t.stain = 2;
      parts.push(`d${a}+${bonus(u.sat)} vs d${d}+${bonus(t.grn)}: hit, -${dmg}`);
    } else parts.push(`d${a}+${bonus(u.sat)} vs d${d}+${bonus(t.grn)}: miss`);
  }
  const c = cells[idx(t.x, t.y)]!;
  if (total > 0 && (c.owner === 0 || c.owner === t.side)) paintCell(c, u, true);
  flash.push({ i: idx(t.x, t.y), t: performance.now() });
  let s = `splashed ${t.side === 1 ? 'your' : 'the rival'} ${t.name}, ${relWord(u.m.main, t.m.main)} (${parts.join('; ')})`;
  if (t.hp <= 0) s += washOut(t);
  return s;
}
function washOut(t: Unit): string {
  t.alive = false;
  t.hp = 0;
  mudCell(cells[idx(t.x, t.y)]!);
  return `. ${t.name} washed out`;
}

function doSoak(u: Unit): string {
  const c = cells[idx(u.x, u.y)]!;
  let heal = c.owner === u.side ? (c.wet > 0 ? 6 : 3) : 1;
  if (u.quirk.key === 'root') heal *= 2;
  const before = u.hp;
  u.hp = Math.min(u.max, u.hp + heal);
  u.stain = 0;
  const team = teams[u.side - 1]!;
  team.water = Math.min(WATER_MAX, team.water + 1);
  return `soaked: +${u.hp - before} opacity, +1 water, stains rinsed`;
}

/* ---------- Ein Zug ---------- */
function act(u: Unit, a: Action, at: number | null): string {
  let s = '';
  if (a === 'dry' || a === 'wet') s = doPaint(u, a === 'wet', at!);
  else if (a === 'splash') s = doSplash(u, unitAt(at! % COLS, Math.floor(at! / COLS))!);
  else s = doSoak(u);
  teams[u.side - 1]!.rest = teams[u.side - 1]!.units.indexOf(u);
  return s;
}
function checkWipe(): boolean {
  for (const t of teams) {
    if (t.units.every((u) => !u.alive)) {
      over = true;
      winner = t.side === 1 ? 2 : 1;
      winReason = 'washed out';
      return true;
    }
  }
  return false;
}

/* Ende einer Runde: nasse Farbe verläuft, Flecken brennen, Boden wirkt, der Radierer kommt */
function endRound(): void {
  const r = RNG(gameSeed + round * 977);
  const spreads: [number, Cell][] = [];
  cells.forEach((c, i) => {
    if ((c.owner !== 1 && c.owner !== 2) || c.wet <= 0) return;
    const u = teams[c.owner - 1]!.units.find((x) => x.m.main === c.hue);
    const flow = u ? u.flo : 20;
    if (r() < Math.min(0.85, flow / 40)) {
      const x = i % COLS,
        y = Math.floor(i / COLS);
      const n = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].filter(([a, b]) => inside(a!, b!) && cells[idx(a!, b!)]!.owner === 0);
      if (n.length) {
        const [a, b] = n[Math.floor(r() * n.length)]!;
        spreads.push([idx(a!, b!), { ...c, wet: Math.max(0, c.wet - 1), stamp: ++stamp }]);
      }
    }
  });
  for (const [i, c] of spreads) if (cells[i]!.owner === 0) cells[i] = c;
  if (spreads.length) log.unshift({ t: `Wet paint bled into ${spreads.length} more cell${spreads.length > 1 ? 's' : ''}.`, c: 'muted' });
  const notes: string[] = [];
  for (const u of allUnits()) {
    const c = cells[idx(u.x, u.y)]!;
    if (u.stain > 0) {
      u.hp -= 2;
      u.stain--;
      notes.push(`${u.name} is stained (-2)`);
    }
    if (c.owner === u.side && c.wet > 0 && u.hp < u.max) u.hp = Math.min(u.max, u.hp + 1);
    if (c.owner !== 0 && c.owner !== u.side && c.owner !== 3 && c.wet > 0 && c.hue && relation(u.m.main, c.hue) === 'komplementaer') {
      u.hp -= 2;
      notes.push(`${u.name} stands in its complementary colour (-2)`);
    }
    if (u.hp <= 0) notes.push(washOut(u).slice(2));
  }
  cells.forEach((c) => {
    if (c.wet > 0) c.wet--;
  });
  if (ERASER_ROUNDS.includes(round)) {
    const row = Math.floor(r() * ROWS);
    let gone = 0;
    for (let x = 0; x < COLS; x++) {
      const c = cells[idx(x, row)]!;
      if (c.owner === 0) continue;
      if (c.owner !== 3 && d20() + bonus(c.lf) >= 18) continue;
      cells[idx(x, row)] = emptyCell();
      gone++;
    }
    for (const u of allUnits())
      if (u.y === row) {
        const save = d20() + bonus(u.lf) >= 18;
        if (!save) {
          u.hp -= 4;
          notes.push(`the Eraser grazed ${u.name} (-4)`);
          if (u.hp <= 0) notes.push(washOut(u).slice(2));
        }
      }
    eraserRow = row;
    log.unshift({ t: `The Eraser passed through row ${row + 1}: ${gone} cells erased.`, c: 'eraser' });
    sepiaLine = 'Someone has been at the sheet again. Paint faster.';
  }
  if (notes.length) log.unshift({ t: notes.join('. ') + '.', c: 'muted' });
  teams.forEach((t) => (t.water = Math.min(WATER_MAX, t.water + 1)));
  round++;
  if (!checkWipe() && round > ROUNDS) finish();
}

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
function scores(): [number, number] {
  const [a, b] = counts();
  return [a + ALIVE_BONUS * teams[0].units.filter((u) => u.alive).length, b + ALIVE_BONUS * teams[1].units.filter((u) => u.alive).length];
}
function finish(): void {
  over = true;
  const [a, b] = scores();
  winner = a > b ? 1 : a < b ? 2 : 0;
  winReason = 'the paper dried';
}

/* ---------- Gegner ---------- */
function evalPaint(u: Unit, wet: boolean, at: number): number {
  let v = 0;
  for (const i of stampCells(u, at)) {
    const c = cells[i]!;
    const o = outcome(u, wet, c);
    if (o.kind === 'take') v += 1;
    else if (o.kind === 'mud') v += 1.2;
    else if (o.kind === 'contest' || o.kind === 'over') v += o.p * (c.owner === 3 ? 1 : 2);
  }
  if (wet) v += 0.3 * stampCells(u, at).filter((i) => cells[i]!.owner === 0).length * (u.flo / 40) - 0.7;
  return v;
}
function danger(u: Unit, x: number, y: number): number {
  let d = 0;
  for (const e of teams[u.side === 1 ? 1 : 0].units) if (e.alive && cheb(e.x, e.y, x, y) <= 2) d += 0.12 * bonus(e.sat) * typeMult(e.m.main, u.m.main);
  return d;
}
function rivalMove(): void {
  const team = teams[1];
  const r = RNG(gameSeed + round * 31 + 7);
  let best: { v: number; u: Unit; to: number; a: Action; at: number | null } | null = null;
  team.units.forEach((u, ui) => {
    if (!u.alive || resting(team, ui)) return;
    const prev = reach(u);
    const ox = u.x,
      oy = u.y;
    for (const to of prev.keys()) {
      u.x = to % COLS;
      u.y = Math.floor(to / COLS);
      const cHere = cells[to]!;
      let pos = -danger(u, u.x, u.y);
      if (cHere.owner === 2 && cHere.wet > 0) pos += 0.4;
      if (u.quirk.key === 'trail-dry' || u.quirk.key === 'trail-wet') pos += 0.3 * pathTo(prev, to).filter((i) => cells[i]!.owner === 0).length;
      const consider = (v: number, a: Action, at: number | null) => {
        const total = v + pos + r() * 0.25;
        if (!best || total > best.v) best = { v: total, u, to, a, at };
      };
      for (let at = 0; at < COLS * ROWS; at++) {
        if (!canPaintAt(u, at)) continue;
        consider(evalPaint(u, false, at), 'dry', at);
        if (team.water > 0) consider(evalPaint(u, true, at), 'wet', at);
      }
      for (const t of splashTargets(u)) {
        const p = splashOdds(u, t) * (u.quirk.key === 'twin' ? 1.6 : 1);
        const dmg = splashDamage(u, t, cheb(u.x, u.y, t.x, t.y) <= 1);
        const kill = t.hp <= dmg * (u.quirk.key === 'twin' ? 2 : 1) ? 10 : 0;
        consider(p * (dmg * 0.9 + kill) + (t.stain ? 0 : relation(u.m.main, t.m.main) === 'komplementaer' ? 1 : 0), 'splash', idx(t.x, t.y));
      }
      if (u.hp < u.max) consider(Math.min(u.max - u.hp, cHere.owner === 2 ? (cHere.wet > 0 ? 6 : 3) : 1) * 0.35 + (u.hp < u.max * 0.35 ? 2 : 0), 'soak', null);
    }
    u.x = ox;
    u.y = oy;
  });
  if (!best) return;
  const b = best as { v: number; u: Unit; to: number; a: Action; at: number | null };
  const prev = reach(b.u);
  const didMove = b.to !== idx(b.u.x, b.u.y);
  const moveNote = didMove ? doMove(b.u, b.to, prev) : '';
  const s = act(b.u, b.a, b.at);
  lastRival = b.a === 'dry' || b.a === 'wet' ? stampCells(b.u, b.at!) : b.at !== null ? [b.at] : [idx(b.u.x, b.u.y)];
  const lead = `Rival ${b.u.name}${didMove ? ' moved' : ''}${moveNote ? `, ${moveNote}` : ''}`;
  log.unshift({ t: `${lead}${didMove ? ', then' : ''} ${s}.`, c: 'rival' });
}

/* ---------- Zeichnen ---------- */
const board = document.getElementById('board') as HTMLCanvasElement;
let cellPx = 50;
const dpr = Math.min(2, window.devicePixelRatio || 1);
const imgCache = new Map<number, HTMLCanvasElement>();
function unitImg(u: Unit, size: number): HTMLCanvasElement {
  let c = imgCache.get(u.id);
  if (!c || Math.abs(c.width - size * dpr) > 2) {
    c = document.createElement('canvas');
    renderMonster(c, u.m, size, { dpr });
    imgCache.set(u.id, c);
  }
  return c;
}

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
  ctx.globalAlpha = 1;
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
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillRect(0, eraserRow * cellPx + 2, COLS * cellPx, cellPx - 4);
  }
  ctx.globalCompositeOperation = 'multiply';
  cells.forEach((c, i) => {
    if (c.owner === 0) return;
    const x = (i % COLS) * cellPx + cellPx / 2,
      y = Math.floor(i / COLS) * cellPx + cellPx / 2;
    const r = RNG(hashStr(`${gameSeed}:${i}:${c.stamp}`));
    const base = deformN(ellipsePts({ x, y, rx: cellPx * 0.6, ry: cellPx * 0.6, rot: 0 }, 1, r, 10), r, 0.28, 3);
    ctx.fillStyle = `rgba(${c.rgb},${c.owner === 3 ? 0.13 : 0.1})`;
    for (let k = 0; k < (c.owner === 3 ? 7 : 8); k++) {
      const p = deformN(base, r, 0.22, 1);
      ctx.beginPath();
      ctx.moveTo(p[0]![0], p[0]![1]);
      for (const q of p) ctx.lineTo(q[0], q[1]);
      ctx.closePath();
      ctx.fill();
    }
  });
  ctx.globalCompositeOperation = 'source-over';
  cells.forEach((c, i) => {
    if (c.wet <= 0 || c.owner === 0) return;
    const x = (i % COLS) * cellPx + cellPx / 2,
      y = Math.floor(i / COLS) * cellPx + cellPx / 2;
    const g = ctx.createRadialGradient(x - cellPx * 0.18, y - cellPx * 0.2, 1, x, y, cellPx * 0.5);
    g.addColorStop(0, `rgba(255,255,255,${0.3 + 0.1 * c.wet})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - cellPx / 2, y - cellPx / 2, cellPx, cellPx);
  });
  // Reichweite und Ziele
  if (sel && !over && turn === 1) {
    if (!moved) {
      const prev = reach(sel);
      ctx.fillStyle = 'rgba(46,122,87,.55)';
      for (const i of prev.keys()) {
        if (i === idx(sel.x, sel.y)) continue;
        ctx.beginPath();
        ctx.arc((i % COLS) * cellPx + cellPx / 2, Math.floor(i / COLS) * cellPx + cellPx / 2, cellPx * 0.12, 0, 7);
        ctx.fill();
      }
    }
    if (moved && (action === 'dry' || action === 'wet')) {
      ctx.strokeStyle = 'rgba(43,63,163,.25)';
      ctx.lineWidth = 1.5;
      const rr = paintRange(sel);
      ctx.strokeRect((sel.x - rr) * cellPx + 1, (sel.y - rr) * cellPx + 1, (rr * 2 + 1) * cellPx - 2, (rr * 2 + 1) * cellPx - 2);
    }
    if (moved && action === 'splash') {
      for (const t of splashTargets(sel)) {
        ctx.strokeStyle = 'rgba(163,58,58,.9)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(t.x * cellPx + cellPx / 2, t.y * cellPx + cellPx / 2, cellPx * 0.48, 0, 7);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
  // Letzter Zug des Gegners
  ctx.strokeStyle = 'rgba(163,58,58,.5)';
  ctx.lineWidth = 2;
  for (const i of lastRival) ctx.strokeRect((i % COLS) * cellPx + 3, Math.floor(i / COLS) * cellPx + 3, cellPx - 6, cellPx - 6);
  // Vorschau
  if (sel && target !== null && !over && (action === 'dry' || action === 'wet')) {
    for (const i of stampCells(sel, target)) {
      const o = outcome(sel, action === 'wet', cells[i]!);
      const col = o.kind === 'take' ? '46,122,87' : o.kind === 'mud' ? '110,75,51' : o.kind === 'none' ? '120,120,130' : o.kind === 'refresh' ? '90,100,120' : '168,108,18';
      ctx.strokeStyle = `rgba(${col},.95)`;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect((i % COLS) * cellPx + 4, Math.floor(i / COLS) * cellPx + 4, cellPx - 8, cellPx - 8);
      ctx.setLineDash([]);
      if (o.kind === 'contest' || o.kind === 'over') {
        ctx.fillStyle = `rgba(${col},1)`;
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(o.p * 100) + '%', (i % COLS) * cellPx + cellPx / 2, Math.floor(i / COLS) * cellPx + cellPx - 7);
      }
    }
  }
  // Monster: Deckkraft ist Lebenskraft, sie verblassen sichtbar
  for (const u of allUnits()) {
    const size = cellPx * 1.02;
    const img = unitImg(u, Math.round(size));
    const x = u.x * cellPx + (cellPx - size) / 2,
      y = u.y * cellPx + (cellPx - size) / 2 - 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(u.x * cellPx + cellPx / 2, u.y * cellPx + cellPx / 2 - 2, cellPx * 0.46, 0, 7);
    ctx.clip();
    ctx.globalAlpha = 0.25 + 0.75 * Math.max(0, u.hp / u.max);
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = u.side === 1 ? 'rgba(43,63,163,.95)' : 'rgba(163,58,58,.95)';
    ctx.lineWidth = sel === u ? 3.5 : 2;
    ctx.beginPath();
    ctx.arc(u.x * cellPx + cellPx / 2, u.y * cellPx + cellPx / 2 - 2, cellPx * 0.46, 0, 7);
    ctx.stroke();
    const bw = cellPx * 0.7,
      bx = u.x * cellPx + (cellPx - bw) / 2,
      by = u.y * cellPx + cellPx - 7;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = u.side === 1 ? '#2b3fa3' : '#a33a3a';
    ctx.fillRect(bx, by, bw * Math.max(0, u.hp / u.max), 4);
    if (u.stain > 0) {
      ctx.fillStyle = 'rgba(110,75,51,.9)';
      ctx.beginPath();
      ctx.arc(u.x * cellPx + cellPx * 0.82, u.y * cellPx + cellPx * 0.18, 4, 0, 7);
      ctx.fill();
    }
    const team = teams[u.side - 1]!;
    if (resting(team, team.units.indexOf(u))) {
      const dx = u.x * cellPx + cellPx * 0.16,
        dy = u.y * cellPx + cellPx * 0.16;
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath();
      ctx.arc(dx, dy + 1, 7, 0, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(43,111,163,.95)';
      ctx.beginPath();
      ctx.moveTo(dx, dy - 5);
      ctx.quadraticCurveTo(dx + 5, dy + 1, dx, dy + 5);
      ctx.quadraticCurveTo(dx - 5, dy + 1, dx, dy - 5);
      ctx.fill();
    }
  }
  // Treffer kurz aufblitzen
  const now = performance.now();
  flash = flash.filter((f) => now - f.t < 500);
  for (const f of flash) {
    ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - (now - f.t) / 500)})`;
    ctx.fillRect((f.i % COLS) * cellPx, Math.floor(f.i / COLS) * cellPx, cellPx, cellPx);
  }
  if (flash.length) requestAnimationFrame(drawBoard);
}

/* ---------- Oberfläche ---------- */
const $ = (id: string) => document.getElementById(id)!;

function patternIcon(p: [number, number][]): HTMLElement {
  const g = document.createElement('span');
  g.className = 'pat';
  const x0 = Math.min(...p.map((q) => q[0])),
    y0 = Math.min(...p.map((q) => q[1]));
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) {
      const i = document.createElement('i');
      if (p.some((q) => q[0] - x0 === x && q[1] - y0 === y)) i.className = 'on';
      g.append(i);
    }
  return g;
}
function hpBar(u: Unit): HTMLElement {
  const b = document.createElement('span');
  b.className = 'hp ' + (u.side === 1 ? 'you' : 'rival');
  const i = document.createElement('i');
  i.style.width = Math.max(0, (u.hp / u.max) * 100) + '%';
  b.append(i);
  return b;
}
function drops(el: HTMLElement, n: number): void {
  el.replaceChildren();
  for (let k = 0; k < WATER_MAX; k++) {
    const i = document.createElement('i');
    if (k < n) i.className = 'on';
    el.append(i);
  }
}

function renderUnits(): void {
  const mine = $('mine');
  mine.replaceChildren();
  teams[0].units.forEach((u, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const rest = resting(teams[0], i);
    btn.className = 'unit' + (sel === u ? ' sel' : '') + (!u.alive ? ' gone' : '') + (rest ? ' resting' : '');
    btn.disabled = !u.alive || rest || over || turn !== 1 || (sel !== null && sel !== u && moved);
    const top = document.createElement('div');
    top.className = 'ut';
    const pc = document.createElement('canvas');
    pc.width = pc.height = 88;
    pc.getContext('2d')!.drawImage(unitImg(u, 44), 0, 0, 88, 88);
    pc.style.opacity = String(0.3 + 0.7 * Math.max(0, u.hp / u.max));
    top.append(pc, patternIcon(u.pattern));
    const n = document.createElement('b');
    n.textContent = u.name;
    const hp = document.createElement('div');
    hp.className = 'hpline';
    hp.append(hpBar(u), document.createTextNode(` ${Math.max(0, u.hp)}/${u.max}`));
    const st = document.createElement('div');
    st.className = 'us';
    st.textContent = `SAT ${u.sat} GRN ${u.grn} FLO ${u.flo}`;
    const q = document.createElement('small');
    q.textContent = !u.alive ? 'washed out' : rest ? 'drying, next turn' : u.quirk.text;
    btn.append(top, n, hp, st, q);
    btn.addEventListener('click', () => selectUnit(u));
    mine.append(btn);
  });
  const rv = $('rival');
  rv.replaceChildren();
  teams[1].units.forEach((u) => {
    const d = document.createElement('div');
    d.className = 'ru' + (!u.alive ? ' gone' : '');
    const pc = document.createElement('canvas');
    pc.width = pc.height = 72;
    pc.getContext('2d')!.drawImage(unitImg(u, 36), 0, 0, 72, 72);
    pc.style.opacity = String(0.3 + 0.7 * Math.max(0, u.hp / u.max));
    const n = document.createElement('small');
    n.textContent = u.name;
    d.append(pc, n, hpBar(u));
    rv.append(d);
  });
}

function renderHud(): void {
  const [a, b, m] = counts();
  const [sa, sb] = scores();
  $('score-you').textContent = String(sa);
  $('score-rival').textContent = String(sb);
  $('score-mud').textContent = String(m);
  const tot = COLS * ROWS;
  ($('bar-you') as HTMLElement).style.width = (a / tot) * 100 + '%';
  ($('bar-mud') as HTMLElement).style.width = (m / tot) * 100 + '%';
  ($('bar-rival') as HTMLElement).style.width = (b / tot) * 100 + '%';
  $('round').textContent = over ? 'Done' : `Round ${round} / ${ROUNDS}`;
  const left = ROUNDS - round + 1;
  $('dries').textContent = over ? winReason : ERASER_ROUNDS.includes(round) ? 'Eraser comes next' : left === 1 ? 'last round' : `dries in ${left}`;
  drops($('water'), teams[0].water);
  drops($('rival-water'), teams[1].water);
  const acts: Action[] = ['dry', 'wet', 'splash', 'soak'];
  for (const a2 of acts) {
    const btn = $('act-' + a2) as HTMLButtonElement;
    btn.setAttribute('aria-pressed', String(action === a2));
    btn.disabled = !sel || over || turn !== 1 || (a2 === 'wet' && teams[0].water <= 0) || (a2 === 'splash' && sel !== null && splashTargets(sel).length === 0);
  }
  const info = $('preview');
  const go = $('go') as HTMLButtonElement;
  go.disabled = true;
  if (over) {
    info.textContent = '';
    go.textContent = 'New duel';
    go.disabled = false;
  } else if (turn !== 1) {
    info.textContent = 'The rival is painting…';
    go.textContent = 'Wait';
  } else if (!sel) {
    info.textContent = 'Tap one of your blots on the sheet or below.';
    go.textContent = 'Pick a blot';
  } else if (!moved) {
    info.textContent = sel.quirk.key === 'tower' ? 'Towers do not move. Tap it again to act.' : 'Move: tap a green dot. Or tap the blot again to stay put.';
    go.textContent = 'Stay here';
    go.disabled = false;
  } else if (action === 'soak') {
    const c = cells[idx(sel.x, sel.y)]!;
    let heal = c.owner === sel.side ? (c.wet > 0 ? 6 : 3) : 1;
    if (sel.quirk.key === 'root') heal *= 2;
    info.textContent = `Soak here: +${Math.min(heal, sel.max - sel.hp)} opacity, +1 water. Best on your own wet paint.`;
    go.textContent = 'Soak';
    go.disabled = false;
  } else if (action === 'splash') {
    const t = target !== null ? unitAt(target % COLS, Math.floor(target / COLS)) : null;
    if (t && t.side === 2 && splashTargets(sel).includes(t)) {
      const p = Math.round(splashOdds(sel, t) * 100);
      const dmg = splashDamage(sel, t, cheb(sel.x, sel.y, t.x, t.y) <= 1);
      info.textContent = `Splash ${t.name}: ${p}% to hit, -${dmg}${sel.quirk.key === 'twin' ? ' twice' : ''} opacity, ${relWord(sel.m.main, t.m.main)}${relation(sel.m.main, t.m.main) === 'komplementaer' ? ', stains' : ''}.`;
      go.textContent = 'Splash';
      go.disabled = false;
    } else info.textContent = `Tap a circled rival in reach (${splashRange(sel)}). Standing on your wet paint adds 1.`;
  } else {
    if (target === null) info.textContent = `Tap the paper within ${paintRange(sel)} cells to aim the stamp.`;
    else {
      let free = 0,
        mud = 0,
        none = 0;
      const odds: number[] = [];
      for (const i of stampCells(sel, target)) {
        const o = outcome(sel, action === 'wet', cells[i]!);
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
      go.textContent = action === 'wet' ? 'Paint wet' : 'Paint dry';
      go.disabled = false;
    }
  }
  const l = $('log');
  l.replaceChildren();
  for (const e of log.slice(0, 5)) {
    const li = document.createElement('li');
    li.className = e.c;
    li.textContent = e.t;
    l.append(li);
  }
  $('sepia').textContent = sepiaLine;
  $('result').hidden = !over;
  if (over) {
    const [x, y] = scores();
    $('result-title').textContent = winner === 1 ? 'You win the sheet' : winner === 2 ? 'The rival wins the sheet' : 'A draw';
    $('result-sub').textContent = winReason === 'washed out' ? (winner === 1 ? 'Every rival blot washed out.' : 'Your blots washed out.') : `Paper dried: ${x} to ${y} (cells plus ${ALIVE_BONUS} per blot still standing).`;
  }
}

function renderAll(): void {
  renderUnits();
  renderHud();
  drawBoard();
}

function selectUnit(u: Unit): void {
  if (over || turn !== 1 || !u.alive || u.side !== 1) return;
  if (resting(teams[0], teams[0].units.indexOf(u))) return;
  if (moved && sel !== u) return;
  sel = u;
  target = null;
  if (action === 'splash' && splashTargets(u).length === 0) action = 'dry';
  renderAll();
}

board.addEventListener('click', (e) => {
  if (over || turn !== 1) return;
  const rect = board.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / cellPx),
    y = Math.floor((e.clientY - rect.top) / cellPx);
  if (!inside(x, y)) return;
  const i = idx(x, y);
  const u = unitAt(x, y);
  if (!sel) {
    if (u && u.side === 1) selectUnit(u);
    return;
  }
  if (!moved) {
    // Schritt 1: bewegen oder bleiben
    if (u === sel) {
      moved = true;
      renderAll();
      return;
    }
    if (u && u.side === 1) {
      selectUnit(u);
      return;
    }
    const prev = reach(sel);
    if (!u && prev.has(i)) {
      const note = doMove(sel, i, prev);
      moved = true;
      if (note) log.unshift({ t: `Your ${sel.name} moved and ${note}.`, c: 'you' });
      if (action === 'splash' && splashTargets(sel).length === 0) action = 'dry';
      renderAll();
    }
    return;
  }
  // Schritt 2: zielen, zweites Tippen führt aus
  if (action === 'splash') {
    if (u && u.side === 2 && splashTargets(sel).includes(u)) {
      if (target === i) return commit();
      target = i;
    }
  } else if (action === 'dry' || action === 'wet') {
    if (!canPaintAt(sel, i)) return;
    if (target === i) return commit();
    target = i;
  }
  renderHud();
  drawBoard();
});

function commit(): void {
  if (!sel || over || turn !== 1) return;
  if ((action === 'dry' || action === 'wet' || action === 'splash') && target === null) return;
  if (action === 'wet' && teams[0].water <= 0) return;
  eraserRow = -1;
  const s = act(sel, action, target);
  log.unshift({ t: `Your ${sel.name} ${s}.`, c: 'you' });
  sel = null;
  moved = false;
  target = null;
  turn = 2;
  if (checkWipe()) {
    renderAll();
    return;
  }
  renderAll();
  window.setTimeout(() => {
    rivalMove();
    if (!checkWipe()) endRound();
    turn = 1;
    if (action === 'wet' && teams[0].water <= 0) action = 'dry';
    if (action === 'splash') action = 'dry';
    renderAll();
  }, 700);
}

for (const a of ['dry', 'wet', 'splash', 'soak'] as Action[]) {
  $('act-' + a).addEventListener('click', () => {
    action = a;
    target = null;
    renderHud();
    drawBoard();
  });
}
$('go').addEventListener('click', () => {
  if (over) return newGame((Math.random() * 1e9) >>> 0);
  if (sel && !moved) {
    moved = true;
    renderAll();
    return;
  }
  commit();
});
$('again').addEventListener('click', () => newGame((Math.random() * 1e9) >>> 0));
$('new').addEventListener('click', () => newGame((Math.random() * 1e9) >>> 0));
let rt = 0;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = window.setTimeout(() => {
    imgCache.clear();
    renderAll();
  }, 150);
});

newGame(1);
// Nur für automatische Probeläufe
(window as unknown as { __duel: unknown }).__duel = {
  state: () => ({ round, over, winner, winReason, turn, units: allUnits().map((u) => ({ side: u.side, x: u.x, y: u.y, hp: u.hp, name: u.name, rest: resting(teams[u.side - 1]!, teams[u.side - 1]!.units.indexOf(u)), reach: splashRange(u) })), score: scores() }),
};
(window as unknown as { done: boolean }).done = true;
