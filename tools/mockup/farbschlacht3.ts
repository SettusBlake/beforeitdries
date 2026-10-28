/*
 * Prototyp „Farbschlacht 3“: Monster auf dem Blatt, Farbe als Gelände, Spritzer, Deckkraft als Lebenskraft,
 * dazu Fähigkeiten je Bauplan (aufgeladen über Leuchten), Eigenschaften aus den Monsterdaten,
 * Malen in der Zweitfarbe und ein Rivale mit drei Stufen.
 * Nur zum Ausprobieren der Idee (Artifact), nicht Teil des Spiels.
 */
import { deformN, ellipsePts, grainTex, renderMonster } from '../../src/client/renderer/watercolor';
import { BLOOM_TRAITS, BP, PIG, type BlueprintId, type PigmentId, type RGB } from '../../src/shared/data';
import { relation } from '../../src/shared/glaze';
import { humidityFor, makeMonster, statRows, type Monster } from '../../src/shared/monster';
import { RNG, hashStr, type Rand } from '../../src/shared/rng';

/* ---------- Regeln (alle Zahlen hier) ---------- */
const COLS = 7,
  ROWS = 9,
  ROUNDS = 8,
  WET_TURNS = 2,
  WATER_MAX = 4,
  ERASER_ROUNDS = [3, 6],
  PAINT_RANGE = 2,
  ALIVE_BONUS = 3,
  CHARGE_FULL = 100;

type Side = 1 | 2;
type Level = 'apprentice' | 'journeyman' | 'master';
type Action = 'dry' | 'wet' | 'splash' | 'soak' | 'ability';
type Cell = { owner: 0 | 1 | 2 | 3; rgb: RGB; hue: PigmentId | null; wet: number; atk: number; def: number; lf: number; stamp: number };
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
  charge: number;
  rooted: number;
  shield: number;
  pattern: [number, number][];
  sec: PigmentId | null;
  traits: Trait[];
};
type Trait = { key: string; label: string; text: string };
type Team = { side: Side; units: Unit[]; water: number; rest: number };

const LEVEL_WATER: Record<Level, number> = { apprentice: 1, journeyman: 2, master: 3 };
/* Stufen des Rivalen: wie viele zufällige Züge er bedenkt (0 = alle), Deckkraft und Werte. Ladung je Handlung: chargeBase + Leuchten */
const TUNE = {
  look: { apprentice: 3, journeyman: 15, master: 0 } as Record<Level, number>,
  hp: { apprentice: 0.7, journeyman: 0.85, master: 1 } as Record<Level, number>,
  stat: { apprentice: 0.65, journeyman: 0.85, master: 1 } as Record<Level, number>,
  chargeBase: 30,
  chargeStart: 40,
  dice: { n: 1, f: 20 },
};
const PLAYER_WATER = 3;

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

/* Gangart je Bauplan */
const GAIT: Record<BlueprintId, { key: string; text: string }> = {
  kriecher: { key: 'trail-dry', text: 'leaves a dry trail' },
  flatterer: { key: 'fly', text: 'flies over anything' },
  schwebeblase: { key: 'float', text: 'floats over mud' },
  vierbeiner: { key: 'fast', text: 'runs one step further' },
  schlange: { key: 'slide', text: 'slides through own paint' },
  turm: { key: 'tower', text: 'never moves, reaches far' },
  krabbe: { key: 'pinch', text: '+3 damage up close' },
  qualle: { key: 'trail-wet', text: 'drips a wet trail' },
  huepfer: { key: 'hop', text: 'hops two cells' },
  knolle: { key: 'root', text: 'soaks twice as well' },
  strahler: { key: 'reach', text: 'splashes two cells away' },
  doppelkopf: { key: 'twin', text: 'splashes twice' },
};

/* Fähigkeit je Bauplan: Ziel „self“, „cell“ oder „unit“ */
type AbilityTarget = 'self' | 'cell' | 'unit';
type Ability = { name: string; text: string; target: AbilityTarget };
const ABILITY: Record<BlueprintId, Ability> = {
  kriecher: { name: 'Seep', text: 'Your paint nearby turns wet and bleeds into all free paper around it.', target: 'self' },
  flatterer: { name: 'Gust', text: 'Rivals within 2 are blown back a cell and lose 3 opacity.', target: 'self' },
  schwebeblase: { name: 'Rain', text: 'Rain on a 3×3 patch within 3: your paint turns wet, rival dry paint turns wet and soft.', target: 'cell' },
  vierbeiner: { name: 'Charge', text: 'Dash along a row or column at a rival within 4 and splash it for 1.5×, +4 to hit.', target: 'unit' },
  schlange: { name: 'Coil', text: 'Wrap an adjacent rival: -4, stained, and it cannot move next turn.', target: 'unit' },
  turm: { name: 'Bastion', text: 'All your blots get +5 Grain for two rounds.', target: 'self' },
  krabbe: { name: 'Crush', text: 'Crush an adjacent rival: ignores Grain, double damage.', target: 'unit' },
  qualle: { name: 'Drift', text: 'Drift to any of your wet cells and stain every rival next to it.', target: 'cell' },
  huepfer: { name: 'Bound', text: 'Leap to a free cell within 4 and stamp dry where you land.', target: 'cell' },
  knolle: { name: 'Sprout', text: 'All your blots heal 6 and the paint under them turns wet.', target: 'self' },
  strahler: { name: 'Flare', text: 'Burst wet paint into all 8 cells around and splash every adjacent rival for 0.6×.', target: 'self' },
  doppelkopf: { name: 'Howl', text: 'The rival team loses 2 water. Rivals within 2 lose 3 opacity and 30 charge.', target: 'self' },
};
const MUD: RGB = [116, 100, 82];
const PAPER: RGB = [247, 245, 239];

/* Eigenschaften aus den Monsterdaten wirken im Duell */
function traitsOf(m: Monster): Trait[] {
  const t: Trait[] = [];
  const pigs = [m.main, ...m.sec];
  if (m.events.salt) t.push({ key: 'salt', label: 'Salt', text: 'crit +8%' });
  if (m.events.alcohol) t.push({ key: 'alcohol', label: 'Alcohol', text: 'dodge +6%' });
  if (m.events.bloom) {
    const n = BLOOM_TRAITS[m.bloomTrait]!.split(':')[0]!;
    const fx = ['heals 1 each round', 'wet stamps +2', 'dry stamps +2', 'takes 15% less', 'dodge +5%'][m.bloomTrait]!;
    t.push({ key: 'bloom' + m.bloomTrait, label: n, text: fx });
  }
  if (m.events.print) t.push({ key: 'print', label: 'Fingerprint', text: 'charges twice as fast' });
  if (pigs.includes('phthalo')) t.push({ key: 'staining', label: 'Staining', text: 'splashes always stain' });
  if (pigs.includes('opera')) t.push({ key: 'fugitive', label: 'Fugitive', text: 'fades 1 each round, +2 damage' });
  if (PIG[m.main].gran >= 0.5) t.push({ key: 'granulating', label: 'Granulating', text: 'its dry paint is +2 harder to cover' });
  return t;
}
const has = (u: Unit, k: string) => u.traits.some((t) => t.key === k);

const mk = (sheet: string, idx: number) => makeMonster(sheet, idx, humidityFor(sheet));
function find(bp: BlueprintId, main: PigmentId, salt: string, wantSec = false): Monster {
  for (let i = 0; i < 60000; i++) {
    const m = mk(salt + i, i % 12);
    if (m.bp === bp && m.main === main && (!wantSec || m.sec.length > 0)) return m;
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
    charge: TUNE.chargeStart,
    rooted: 0,
    shield: 0,
    pattern: PATTERNS[m.bp],
    sec: m.sec[0] ?? null,
    traits: traitsOf(m),
  };
}

/* Wahrscheinlichkeit, dass a + Wurf > b + Wurf (Würfel aus TUNE.dice, Standard W20) */
const pTable = new Map<string, number>();
function rollDist(): number[] {
  let dist = [1];
  for (let k = 0; k < TUNE.dice.n; k++) {
    const next = new Array<number>(dist.length + TUNE.dice.f).fill(0);
    dist.forEach((p, s) => {
      for (let f = 1; f <= TUNE.dice.f; f++) next[s + f]! += p / TUNE.dice.f;
    });
    dist = next;
  }
  return dist;
}
function pWin(a: number, b: number): number {
  const key = `${TUNE.dice.n}x${TUNE.dice.f}:${a - b}`;
  const hit = pTable.get(key);
  if (hit !== undefined) return hit;
  const dist = rollDist();
  let w = 0;
  dist.forEach((px, x) => dist.forEach((py, y) => {
    if (a - b + x > y) w += px * py;
  }));
  pTable.set(key, w);
  return w;
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
let level: Level = 'apprentice';
let headless = false;
let dice: Rand = RNG(1);
let log: { t: string; c: string }[] = [];
let sepiaLine = '';
let lastRival: number[] = [];
let eraserRow = -1;
let abilityUses = 0;
let tally: Record<string, number> = {};
const count = (k: string) => {
  tally[k] = (tally[k] ?? 0) + 1;
};

/* Auswahl des Spielers */
let sel: Unit | null = null,
  moved = false,
  action: Action = 'dry',
  useSec = false,
  target: number | null = null,
  inspect: Unit | null = null,
  flash: { i: number; t: number }[] = [];

const idx = (x: number, y: number) => y * COLS + x;
const inside = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < ROWS;
const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const allUnits = () => [...teams[0].units, ...teams[1].units].filter((u) => u.alive);
const unitAt = (x: number, y: number) => allUnits().find((u) => u.x === x && u.y === y) ?? null;
const foeTeam = (u: Unit) => teams[u.side === 1 ? 1 : 0];
const d20 = () => 1 + Math.floor(dice() * 20);
const roll = () => {
  let s = 0;
  for (let k = 0; k < TUNE.dice.n; k++) s += 1 + Math.floor(dice() * TUNE.dice.f);
  return s;
};
const emptyCell = (): Cell => ({ owner: 0, rgb: PAPER, hue: null, wet: 0, atk: 0, def: 0, lf: 0, stamp: 0 });
const logAdd = (t: string, c: string) => {
  if (!headless) log.unshift({ t, c });
};
function resting(t: Team, i: number): boolean {
  return i === t.rest && t.units.filter((u) => u.alive).length > 1;
}

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
  inspect = null;
  action = 'dry';
  useSec = false;
  let mine: Monster[], theirs: Monster[];
  if (seed === 1) {
    mine = [find('schlange', 'ultra', 'A', true), find('flatterer', 'kadmium', 'B'), find('huepfer', 'phthalo', 'C')];
    theirs = [find('krabbe', 'siena', 'D'), find('qualle', 'karmin', 'E'), find('strahler', 'opera', 'F')];
  } else {
    const pick = (salt: string) => [0, 1, 2].map(() => mk(salt + Math.floor(r() * 1e6), Math.floor(r() * 12)));
    mine = pick('Y');
    theirs = pick('R');
  }
  teams = [
    { side: 1, units: mine.map((m, i) => unitOf(m, 1, 1 + i * 2, ROWS - 1)), water: PLAYER_WATER, rest: -1 },
    { side: 2, units: theirs.map((m, i) => unitOf(m, 2, 1 + i * 2, 0)), water: LEVEL_WATER[level], rest: -1 },
  ];
  for (const u of teams[1].units) {
    const k = TUNE.stat[level];
    u.hp = u.max = Math.round(u.max * TUNE.hp[level]);
    u.sat = Math.round(u.sat * k);
    u.opa = Math.round(u.opa * k);
    u.grn = Math.round(u.grn * k);
  }
  for (const t of teams) for (const u of t.units) paintCell(cells[idx(u.x, u.y)]!, u, u.m.main, false);
  sepiaLine = 'Paint is ground here. Walk on your own, splash on theirs. Charge your Glow for something special.';
  if (!headless) {
    imgCache.clear();
    renderAll();
  }
}

function paintCell(c: Cell, u: Unit, pig: PigmentId, wet: boolean): void {
  c.owner = u.side;
  c.rgb = PIG[pig].rgb;
  c.hue = pig;
  c.wet = wet ? WET_TURNS : 0;
  c.atk = bonus(u.sat) - (pig !== u.m.main ? 1 : 0);
  c.def = bonus(u.grn) + (has(u, 'granulating') ? 2 : 0);
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

/* ---------- Bewegen ---------- */
function moveRange(u: Unit): number {
  if (u.rooted > 0 || GAIT[u.m.bp].key === 'tower') return 0;
  return Math.min(5, 2 + Math.floor(u.flo / 15) + (GAIT[u.m.bp].key === 'fast' ? 1 : 0));
}
function reach(u: Unit): Map<number, number> {
  const out = new Map<number, number>();
  const range = moveRange(u);
  const gait = GAIT[u.m.bp].key;
  const start = idx(u.x, u.y);
  out.set(start, -1);
  if (range === 0) return out;
  if (gait === 'hop') {
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
    if (cur !== start && cells[cur]!.owner === 3 && gait !== 'fly' && gait !== 'float') continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx!,
        ny = cy + dy!;
      if (!inside(nx, ny) || unitAt(nx, ny)) continue;
      const ni = idx(nx, ny);
      const c = cells[ni]!;
      let step = 1;
      if (gait !== 'fly') {
        if (c.owner === u.side && gait === 'slide') step = 0.5;
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
  const gait = GAIT[u.m.bp].key;
  if (gait === 'trail-dry' || gait === 'trail-wet') {
    let n = 0;
    for (const i of path.slice(0, -1)) {
      const c = cells[i]!;
      if (c.owner === 0 || c.owner === u.side) {
        paintCell(c, u, u.m.main, gait === 'trail-wet');
        n++;
      }
    }
    return n ? `left a ${gait === 'trail-wet' ? 'wet' : 'dry'} trail of ${n}` : '';
  }
  return '';
}

/* ---------- Malen ---------- */
type Out = { kind: 'take' | 'refresh' | 'contest' | 'mud' | 'none' | 'over'; p: number };
function stampBonus(u: Unit, wet: boolean): number {
  return (wet && has(u, 'bloom1')) || (!wet && has(u, 'bloom2')) ? 2 : 0;
}
function outcome(u: Unit, pig: PigmentId, wet: boolean, c: Cell): Out {
  const foe = u.side === 1 ? 2 : 1;
  const sec = pig !== u.m.main ? 1 : 0;
  if (c.owner === 0) return { kind: 'take', p: 1 };
  if (c.owner === u.side) return { kind: 'refresh', p: 1 };
  if (c.owner === 3) return wet ? { kind: 'none', p: 0 } : { kind: 'over', p: pWin(bonus(u.opa) - sec + stampBonus(u, wet), 6) };
  if (c.owner === foe && c.wet > 0) {
    if (c.hue && relation(pig, c.hue) === 'komplementaer') return { kind: 'mud', p: 1 };
    return { kind: 'contest', p: pWin(bonus(u.sat) - sec + stampBonus(u, wet), c.atk) };
  }
  if (wet) return { kind: 'none', p: 0 };
  return { kind: 'over', p: pWin(bonus(u.opa) - sec + stampBonus(u, wet), c.def) };
}
const paintRange = (u: Unit) => (GAIT[u.m.bp].key === 'tower' ? 3 : PAINT_RANGE);
function stampCells(u: Unit, at: number): number[] {
  const x0 = at % COLS,
    y0 = Math.floor(at / COLS);
  return u.pattern.map(([dx, dy]) => [x0 + dx, y0 + dy] as const).filter(([x, y]) => inside(x, y)).map(([x, y]) => idx(x, y));
}
function canPaintAt(u: Unit, at: number): boolean {
  return cheb(u.x, u.y, at % COLS, Math.floor(at / COLS)) <= paintRange(u);
}
function applyPaint(u: Unit, pig: PigmentId, wet: boolean, list: number[]): { took: number; mud: number; held: number; rolls: string[] } {
  let took = 0,
    mud = 0,
    held = 0;
  const rolls: string[] = [];
  const sec = pig !== u.m.main ? 1 : 0;
  for (const i of list) {
    const c = cells[i]!;
    const o = outcome(u, pig, wet, c);
    if (o.kind === 'take' || o.kind === 'refresh') {
      paintCell(c, u, pig, wet);
      if (o.kind === 'take') took++;
    } else if (o.kind === 'mud') {
      mudCell(c);
      mud++;
    } else if (o.kind === 'contest' || o.kind === 'over') {
      const a = roll(),
        d = roll();
      const atk = (o.kind === 'contest' ? bonus(u.sat) : bonus(u.opa)) - sec + stampBonus(u, wet);
      const def = c.owner === 3 ? 6 : o.kind === 'contest' ? c.atk : c.def;
      rolls.push(`d${a}+${atk} vs d${d}+${def}`);
      if (a + atk > d + def) {
        paintCell(c, u, pig, wet);
        took++;
      } else held++;
    }
    if (!headless) flash.push({ i, t: performance.now() });
  }
  return { took, mud, held, rolls };
}
function doPaint(u: Unit, pig: PigmentId, wet: boolean, at: number): string {
  if (wet) teams[u.side - 1]!.water--;
  const r = applyPaint(u, pig, wet, stampCells(u, at));
  const parts = [`${r.took} taken`];
  if (r.mud) parts.push(`${r.mud} to mud`);
  if (r.held) parts.push(`${r.held} held`);
  return `painted ${wet ? 'wet' : 'dry'}${pig !== u.m.main ? ` in ${PIG[pig].n}` : ''}: ${parts.join(', ')}${r.rolls.length ? ` (${r.rolls.join('; ')})` : ''}`;
}

/* ---------- Spritzer ---------- */
function splashRange(u: Unit): number {
  let r = GAIT[u.m.bp].key === 'reach' || GAIT[u.m.bp].key === 'tower' ? 2 : 1;
  const c = cells[idx(u.x, u.y)]!;
  if (c.owner === u.side && c.wet > 0) r++;
  return r;
}
function splashTargets(u: Unit): Unit[] {
  return foeTeam(u).units.filter((t) => t.alive && cheb(u.x, u.y, t.x, t.y) <= splashRange(u));
}
const grainOf = (t: Unit) => t.grn + (t.shield > 0 ? 25 : 0);
const dodgeOf = (t: Unit) => Math.min(0.4, t.flo / 400 + (has(t, 'alcohol') ? 0.06 : 0) + (has(t, 'bloom4') ? 0.05 : 0));
const critOf = (u: Unit) => 0.05 + (has(u, 'salt') ? 0.08 : 0);
function baseDamage(u: Unit, t: Unit, pig: PigmentId, near: boolean): number {
  let dmg = (3 + u.sat / 6 - (pig !== u.m.main ? 1 : 0)) * typeMult(pig, t.m.main);
  if (GAIT[u.m.bp].key === 'pinch' && near) dmg += 3;
  if (has(u, 'fugitive')) dmg += 2;
  if (GAIT[u.m.bp].key === 'twin') dmg *= 0.6;
  if (has(t, 'bloom3')) dmg *= 0.85;
  return Math.max(1, Math.round(dmg));
}
function splashOdds(u: Unit, t: Unit, pig: PigmentId, plus = 0, ignoreGrain = false): number {
  return pWin(bonus(u.sat) - (pig !== u.m.main ? 1 : 0) + plus, ignoreGrain ? 0 : bonus(grainOf(t))) * (1 - dodgeOf(t));
}
/** Ein Treffer mit Würfeln. Gibt Logtext und Schaden zurück. */
function strike(u: Unit, t: Unit, pig: PigmentId, mult: number, plus = 0, ignoreGrain = false): [string, number] {
  if (dice() < dodgeOf(t)) return ['dodged', 0];
  const a = roll(),
    d = roll();
  const atk = bonus(u.sat) - (pig !== u.m.main ? 1 : 0) + plus,
    def = ignoreGrain ? 0 : bonus(grainOf(t));
  if (a + atk <= d + def) return [`d${a}+${atk} vs d${d}+${def}: miss`, 0];
  const crit = a === TUNE.dice.n * TUNE.dice.f || dice() < critOf(u);
  let dmg = Math.max(1, Math.round(baseDamage(u, t, pig, cheb(u.x, u.y, t.x, t.y) <= 1) * mult * (crit ? 1.5 : 1)));
  t.hp -= dmg;
  if (relation(pig, t.m.main) === 'komplementaer' || has(u, 'staining')) t.stain = 2;
  return [`d${a}+${atk} vs d${d}+${def}: ${crit ? 'crit' : 'hit'}, -${dmg}`, dmg];
}
function doSplash(u: Unit, pig: PigmentId, t: Unit): string {
  const hits = GAIT[u.m.bp].key === 'twin' ? 2 : 1;
  const parts: string[] = [];
  let total = 0;
  for (let h = 0; h < hits && t.alive; h++) {
    const [s, dmg] = strike(u, t, pig, 1);
    parts.push(s);
    total += dmg;
  }
  const c = cells[idx(t.x, t.y)]!;
  if (total > 0 && (c.owner === 0 || c.owner === t.side)) paintCell(c, u, pig, true);
  if (!headless) flash.push({ i: idx(t.x, t.y), t: performance.now() });
  let s = `splashed ${t.side === 1 ? 'your' : 'the rival'} ${t.name}, ${relWord(pig, t.m.main)} (${parts.join('; ')})`;
  if (t.hp <= 0) s += washOut(t);
  return s;
}
function washOut(t: Unit): string {
  if (!t.alive) return '';
  count(`kill${t.side}`);
  t.alive = false;
  t.hp = 0;
  mudCell(cells[idx(t.x, t.y)]!);
  return `. ${t.name} washed out`;
}
function soakAmount(u: Unit): number {
  const c = cells[idx(u.x, u.y)]!;
  let heal = c.owner === u.side ? (c.wet > 0 ? 6 : 3) : 1;
  if (GAIT[u.m.bp].key === 'root') heal *= 2;
  return Math.min(heal, u.max - u.hp);
}
function doSoak(u: Unit): string {
  const heal = soakAmount(u);
  u.hp += heal;
  u.stain = 0;
  const team = teams[u.side - 1]!;
  team.water = Math.min(WATER_MAX, team.water + 1);
  return `soaked: +${heal} opacity, +1 water, stains rinsed`;
}

/* ---------- Fähigkeiten ---------- */
function abilityTargets(u: Unit): number[] {
  const ab = ABILITY[u.m.bp];
  const out: number[] = [];
  if (ab.target === 'self') return [idx(u.x, u.y)];
  if (u.m.bp === 'schwebeblase') {
    for (let i = 0; i < COLS * ROWS; i++) if (cheb(u.x, u.y, i % COLS, Math.floor(i / COLS)) <= 3) out.push(i);
  } else if (u.m.bp === 'qualle') {
    cells.forEach((c, i) => {
      if (c.owner === u.side && c.wet > 0 && !unitAt(i % COLS, Math.floor(i / COLS))) out.push(i);
    });
  } else if (u.m.bp === 'huepfer') {
    for (let i = 0; i < COLS * ROWS; i++) {
      const x = i % COLS,
        y = Math.floor(i / COLS);
      if (cheb(u.x, u.y, x, y) <= 4 && !unitAt(x, y) && cells[i]!.owner !== 3) out.push(i);
    }
  } else if (u.m.bp === 'vierbeiner') {
    for (const t of foeTeam(u).units) if (t.alive && chargeLanding(u, t) !== null) out.push(idx(t.x, t.y));
  } else if (u.m.bp === 'schlange' || u.m.bp === 'krabbe') {
    for (const t of foeTeam(u).units) if (t.alive && cheb(u.x, u.y, t.x, t.y) <= 1) out.push(idx(t.x, t.y));
  }
  return out;
}
/** Charge: gerade Linie, höchstens 4, freier Weg bis vor das Ziel */
function chargeLanding(u: Unit, t: Unit): number | null {
  if (u.x !== t.x && u.y !== t.y) return null;
  const dist = Math.abs(u.x - t.x) + Math.abs(u.y - t.y);
  if (dist > 4 || dist < 1) return null;
  const sx = Math.sign(t.x - u.x),
    sy = Math.sign(t.y - u.y);
  let x = u.x,
    y = u.y;
  for (let k = 1; k < dist; k++) {
    x += sx;
    y += sy;
    if (unitAt(x, y)) return null;
  }
  return idx(t.x - sx, t.y - sy);
}
const abilityReady = (u: Unit) => u.charge >= CHARGE_FULL && abilityTargets(u).length > 0;

function doAbility(u: Unit, at: number): string {
  const ab = ABILITY[u.m.bp];
  u.charge = 0;
  const foes = foeTeam(u).units.filter((t) => t.alive);
  const tAt = unitAt(at % COLS, Math.floor(at / COLS));
  const near = (r: number) => foes.filter((t) => cheb(u.x, u.y, t.x, t.y) <= r);
  let s = `used ${ab.name}`;
  switch (u.m.bp) {
    case 'kriecher': {
      let n = 0;
      const own = cells.map((c, i) => [c, i] as const).filter(([c, i]) => c.owner === u.side && cheb(u.x, u.y, i % COLS, Math.floor(i / COLS)) <= 2);
      for (const [c] of own) c.wet = WET_TURNS;
      for (const [, i] of own) {
        const x = i % COLS,
          y = Math.floor(i / COLS);
        for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (!inside(a!, b!)) continue;
          const c2 = cells[idx(a!, b!)]!;
          if (c2.owner === 0) {
            paintCell(c2, u, u.m.main, true);
            c2.wet = 1;
            n++;
          }
        }
      }
      s += `: ${own.length} cells wet again, bled into ${n} more`;
      break;
    }
    case 'flatterer': {
      const parts: string[] = [];
      for (const t of near(2)) {
        const dx = Math.sign(t.x - u.x),
          dy = Math.sign(t.y - u.y);
        const nx = t.x + dx,
          ny = t.y + dy;
        if (inside(nx, ny) && !unitAt(nx, ny)) {
          t.x = nx;
          t.y = ny;
        }
        t.hp -= 3;
        parts.push(`${t.name} -3`);
        if (t.hp <= 0) parts.push(washOut(t).slice(2));
      }
      s += parts.length ? `: ${parts.join(', ')}` : ': nobody close';
      break;
    }
    case 'schwebeblase': {
      let soft = 0,
        mine = 0;
      const tx = at % COLS,
        ty = Math.floor(at / COLS);
      for (let y = ty - 1; y <= ty + 1; y++)
        for (let x = tx - 1; x <= tx + 1; x++) {
          if (!inside(x, y)) continue;
          const c = cells[idx(x, y)]!;
          if (c.owner === u.side) {
            c.wet = WET_TURNS;
            mine++;
          } else if ((c.owner === 1 || c.owner === 2) && c.wet === 0) {
            c.wet = 1;
            soft++;
          }
        }
      s += `: ${mine} of yours wet, ${soft} rival cells softened`;
      break;
    }
    case 'vierbeiner': {
      const land = chargeLanding(u, tAt!)!;
      u.x = land % COLS;
      u.y = Math.floor(land / COLS);
      const [r, dmg] = strike(u, tAt!, u.m.main, 1.5, 4);
      s += ` into ${tAt!.name} (${r})`;
      if (dmg && tAt!.hp <= 0) s += washOut(tAt!);
      break;
    }
    case 'schlange': {
      tAt!.hp -= 4;
      tAt!.stain = 2;
      tAt!.rooted = 1;
      s += ` on ${tAt!.name}: -4, stained, rooted`;
      if (tAt!.hp <= 0) s += washOut(tAt!);
      break;
    }
    case 'turm': {
      for (const a of teams[u.side - 1]!.units) if (a.alive) a.shield = 2;
      s += ': +5 Grain for the team, two rounds';
      break;
    }
    case 'krabbe': {
      const [r, dmg] = strike(u, tAt!, u.m.main, 2, 0, true);
      s += ` on ${tAt!.name} (${r})`;
      if (dmg && tAt!.hp <= 0) s += washOut(tAt!);
      break;
    }
    case 'qualle': {
      u.x = at % COLS;
      u.y = Math.floor(at / COLS);
      const hit = near(1);
      for (const t of hit) {
        t.stain = 2;
        t.hp -= 2;
        if (t.hp <= 0) washOut(t);
      }
      s += `: drifted, stained ${hit.length}`;
      break;
    }
    case 'huepfer': {
      u.x = at % COLS;
      u.y = Math.floor(at / COLS);
      const r = applyPaint(u, u.m.main, false, stampCells(u, at));
      s += `: landed and took ${r.took}`;
      break;
    }
    case 'knolle': {
      let healed = 0;
      for (const a of teams[u.side - 1]!.units)
        if (a.alive) {
          const h = Math.min(6, a.max - a.hp);
          a.hp += h;
          healed += h;
          const c = cells[idx(a.x, a.y)]!;
          paintCell(c, a, a.m.main, true);
        }
      s += `: +${healed} opacity for the team`;
      break;
    }
    case 'strahler': {
      const ring: number[] = [];
      for (let y = u.y - 1; y <= u.y + 1; y++) for (let x = u.x - 1; x <= u.x + 1; x++) if (inside(x, y) && (x !== u.x || y !== u.y) && !unitAt(x, y)) ring.push(idx(x, y));
      const r = applyPaint(u, u.m.main, true, ring);
      const parts: string[] = [];
      for (const t of near(1)) {
        const [rs] = strike(u, t, u.m.main, 0.6);
        parts.push(`${t.name}: ${rs}`);
        if (t.hp <= 0) parts.push(washOut(t).slice(2));
      }
      s += `: ${r.took} cells${parts.length ? `, ${parts.join('; ')}` : ''}`;
      break;
    }
    case 'doppelkopf': {
      const ft = foeTeam(u);
      ft.water = Math.max(0, ft.water - 2);
      const parts: string[] = [];
      for (const t of near(2)) {
        t.hp -= 3;
        t.charge = Math.max(0, t.charge - 30);
        parts.push(`${t.name} -3`);
        if (t.hp <= 0) parts.push(washOut(t).slice(2));
      }
      s += `: rival water -2${parts.length ? `, ${parts.join(', ')}` : ''}`;
      break;
    }
  }
  return s;
}

/* ---------- Ein Zug ---------- */
function act(u: Unit, a: Action, pig: PigmentId, at: number | null): string {
  let s = '';
  if (a === 'dry' || a === 'wet') s = doPaint(u, pig, a === 'wet', at!);
  else if (a === 'splash') s = doSplash(u, pig, unitAt(at! % COLS, Math.floor(at! / COLS))!);
  else if (a === 'soak') s = doSoak(u);
  else {
    s = doAbility(u, at ?? idx(u.x, u.y));
    abilityUses++;
  }
  count(`${u.side}${a}`);
  if (a !== 'ability') u.charge = Math.min(CHARGE_FULL, u.charge + (TUNE.chargeBase + u.glw) * (has(u, 'print') ? 2 : 1));
  u.rooted = 0;
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

/* Ende einer Runde */
function endRound(): void {
  const r = RNG(gameSeed + round * 977);
  const spreads: [number, Cell][] = [];
  cells.forEach((c, i) => {
    if ((c.owner !== 1 && c.owner !== 2) || c.wet <= 0) return;
    const u = teams[c.owner - 1]!.units.find((x) => x.m.main === c.hue || x.sec === c.hue);
    const flow = u ? u.flo : 20;
    if (r() < Math.min(0.85, flow / 40)) {
      const x = i % COLS,
        y = Math.floor(i / COLS);
      const n = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([a, b]) => inside(a!, b!) && cells[idx(a!, b!)]!.owner === 0);
      if (n.length) {
        const [a, b] = n[Math.floor(r() * n.length)]!;
        spreads.push([idx(a!, b!), { ...c, wet: Math.max(0, c.wet - 1), stamp: ++stamp }]);
      }
    }
  });
  for (const [i, c] of spreads) if (cells[i]!.owner === 0) cells[i] = c;
  if (spreads.length) logAdd(`Wet paint bled into ${spreads.length} more cell${spreads.length > 1 ? 's' : ''}.`, 'muted');
  const notes: string[] = [];
  for (const u of allUnits()) {
    const c = cells[idx(u.x, u.y)]!;
    if (u.stain > 0) {
      u.hp -= 2;
      u.stain--;
      notes.push(`${u.name} is stained (-2)`);
    }
    if (has(u, 'fugitive')) u.hp -= 1;
    if (has(u, 'bloom0')) u.hp = Math.min(u.max, u.hp + 1);
    if (c.owner === u.side && c.wet > 0) {
      u.hp = Math.min(u.max, u.hp + 1);
      u.charge = Math.min(CHARGE_FULL, u.charge + 10);
    }
    if (c.owner !== 0 && c.owner !== u.side && c.owner !== 3 && c.wet > 0 && c.hue && relation(u.m.main, c.hue) === 'komplementaer') {
      u.hp -= 2;
      notes.push(`${u.name} stands in its complementary colour (-2)`);
    }
    if (u.shield > 0) u.shield--;
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
      if (u.y === row && d20() + bonus(u.lf) < 18) {
        u.hp -= 4;
        notes.push(`the Eraser grazed ${u.name} (-4)`);
        if (u.hp <= 0) notes.push(washOut(u).slice(2));
      }
    eraserRow = row;
    logAdd(`The Eraser passed through row ${row + 1}: ${gone} cells erased.`, 'eraser');
    sepiaLine = 'Someone has been at the sheet again. Paint faster.';
  }
  if (notes.length) logAdd(notes.join('. ') + '.', 'muted');
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
type Cand = { v: number; u: Unit; to: number; a: Action; pig: PigmentId; at: number | null };
function evalPaint(u: Unit, pig: PigmentId, wet: boolean, at: number): number {
  let v = 0;
  const list = stampCells(u, at);
  for (const i of list) {
    const c = cells[i]!;
    const o = outcome(u, pig, wet, c);
    if (o.kind === 'take') v += 1;
    else if (o.kind === 'mud') v += 1.2;
    else if (o.kind === 'contest' || o.kind === 'over') v += o.p * (c.owner === 3 ? 1 : 2);
  }
  if (wet) v += 0.3 * list.filter((i) => cells[i]!.owner === 0).length * (u.flo / 40) - 0.7;
  return v;
}
function danger(u: Unit, x: number, y: number): number {
  let d = 0;
  for (const e of foeTeam(u).units) if (e.alive && cheb(e.x, e.y, x, y) <= 2) d += 0.12 * bonus(e.sat) * typeMult(e.m.main, u.m.main);
  return d;
}
function killBonus(t: Unit, dmg: number): number {
  return t.hp <= dmg ? 10 : 0;
}
function evalAbility(u: Unit, at: number): number {
  const foes = foeTeam(u).units.filter((t) => t.alive);
  const tAt = unitAt(at % COLS, Math.floor(at / COLS));
  const near = (r: number) => foes.filter((t) => cheb(u.x, u.y, t.x, t.y) <= r);
  switch (u.m.bp) {
    case 'kriecher':
      return cells.filter((c, i) => c.owner === u.side && cheb(u.x, u.y, i % COLS, Math.floor(i / COLS)) <= 2).length * 0.6;
    case 'flatterer':
      return near(2).reduce((s, t) => s + 2.7 + killBonus(t, 3), 0);
    case 'schwebeblase': {
      let v = 0;
      const tx = at % COLS,
        ty = Math.floor(at / COLS);
      for (let y = ty - 1; y <= ty + 1; y++)
        for (let x = tx - 1; x <= tx + 1; x++) {
          if (!inside(x, y)) continue;
          const c = cells[idx(x, y)]!;
          if (c.owner === u.side) v += 0.2;
          else if ((c.owner === 1 || c.owner === 2) && c.wet === 0) v += 0.7;
        }
      return v;
    }
    case 'vierbeiner': {
      const d = baseDamage(u, tAt!, u.m.main, true) * 1.5;
      return splashOdds(u, tAt!, u.m.main, 4) * (d + killBonus(tAt!, d));
    }
    case 'schlange':
      return 4 + 3 + killBonus(tAt!, 4);
    case 'turm':
      return teams[u.side - 1]!.units.filter((a) => a.alive && danger(a, a.x, a.y) > 0.5).length * 2;
    case 'krabbe': {
      const d = baseDamage(u, tAt!, u.m.main, true) * 2;
      return splashOdds(u, tAt!, u.m.main, 0, true) * (d + killBonus(tAt!, d));
    }
    case 'qualle': {
      const x = at % COLS,
        y = Math.floor(at / COLS);
      return foes.filter((t) => cheb(x, y, t.x, t.y) <= 1).length * 4;
    }
    case 'huepfer': {
      const ox = u.x,
        oy = u.y;
      u.x = at % COLS;
      u.y = Math.floor(at / COLS);
      const v = evalPaint(u, u.m.main, false, at) + 0.5;
      u.x = ox;
      u.y = oy;
      return v;
    }
    case 'knolle':
      return teams[u.side - 1]!.units.filter((a) => a.alive).reduce((s, a) => s + Math.min(6, a.max - a.hp) * 0.35, 0) + 0.5;
    case 'strahler':
      return near(1).reduce((s, t) => s + baseDamage(u, t, u.m.main, true) * 0.6 * 0.8, 0) + 3;
    case 'doppelkopf':
      return Math.min(2, foeTeam(u).water) * 0.8 + near(2).reduce((s, t) => s + 2.7 + killBonus(t, 3), 0);
  }
  return 0;
}

function aiMove(side: Side, lvl: Level, look = TUNE.look[lvl]): void {
  const team = teams[side - 1]!;
  const r = RNG(gameSeed + round * 31 + side * 7);
  const cands: Cand[] = [];
  team.units.forEach((u, ui) => {
    if (!u.alive || resting(team, ui)) return;
    const prev = reach(u);
    const ox = u.x,
      oy = u.y;
    const pigs: PigmentId[] = u.sec ? [u.m.main, u.sec] : [u.m.main];
    for (const to of prev.keys()) {
      u.x = to % COLS;
      u.y = Math.floor(to / COLS);
      const cHere = cells[to]!;
      let pos = lvl === 'apprentice' ? 0 : -danger(u, u.x, u.y);
      if (cHere.owner === side && cHere.wet > 0) pos += 0.4;
      const gait = GAIT[u.m.bp].key;
      if (gait === 'trail-dry' || gait === 'trail-wet') pos += 0.3 * pathTo(prev, to).filter((i) => cells[i]!.owner === 0).length;
      const add = (v: number, a: Action, pig: PigmentId, at: number | null) => cands.push({ v: v + pos, u, to, a, pig, at });
      for (let at = 0; at < COLS * ROWS; at++) {
        if (!canPaintAt(u, at)) continue;
        for (const pig of pigs) {
          add(evalPaint(u, pig, false, at), 'dry', pig, at);
          if (team.water > 0) add(evalPaint(u, pig, true, at), 'wet', pig, at);
        }
      }
      for (const t of splashTargets(u))
        for (const pig of pigs) {
          const hits = GAIT[u.m.bp].key === 'twin' ? 1.6 : 1;
          const dmg = baseDamage(u, t, pig, cheb(u.x, u.y, t.x, t.y) <= 1);
          add(splashOdds(u, t, pig) * hits * (dmg * 0.9 + killBonus(t, dmg * hits)) + (t.stain ? 0 : relation(pig, t.m.main) === 'komplementaer' ? 1 : 0), 'splash', pig, idx(t.x, t.y));
        }
      if (u.hp < u.max) add(soakAmount(u) * 0.35 + (u.hp < u.max * 0.35 ? 2 : 0), 'soak', u.m.main, null);
      if (u.charge >= CHARGE_FULL) for (const at of abilityTargets(u)) add(evalAbility(u, at), 'ability', u.m.main, at);
    }
    u.x = ox;
    u.y = oy;
  });
  if (!cands.length) return;
  // Stufen: der Meister bedenkt jeden Zug, die anderen nur eine zufällige Handvoll (die Fähigkeit vergessen sie nie)
  let pool = cands;
  if (look > 0 && look < cands.length) {
    pool = cands.filter((c) => c.a === 'ability');
    for (let k = 0; k < look; k++) pool.push(cands[Math.floor(r() * cands.length)]!);
  }
  let b = pool[0]!;
  for (const c of pool) if (c.v > b.v) b = c;
  const prev = reach(b.u);
  const didMove = b.to !== idx(b.u.x, b.u.y);
  const moveNote = didMove ? doMove(b.u, b.to, prev) : '';
  const s = act(b.u, b.a, b.pig, b.at);
  if (side === 2) lastRival = b.a === 'dry' || b.a === 'wet' ? stampCells(b.u, b.at!) : b.at !== null ? [b.at] : [idx(b.u.x, b.u.y)];
  const lead = `${side === 2 ? 'Rival' : 'Your'} ${b.u.name}${didMove ? ' moved' : ''}${moveNote ? `, ${moveNote}` : ''}`;
  logAdd(`${lead}${didMove ? ', then' : ''} ${s}.`, side === 2 ? 'rival' : 'you');
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
const curPig = (u: Unit): PigmentId => (useSec && u.sec ? u.sec : u.m.main);

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
  if (sel && !over && turn === 1) {
    if (!moved) {
      ctx.fillStyle = 'rgba(46,122,87,.55)';
      for (const i of reach(sel).keys()) {
        if (i === idx(sel.x, sel.y)) continue;
        ctx.beginPath();
        ctx.arc((i % COLS) * cellPx + cellPx / 2, Math.floor(i / COLS) * cellPx + cellPx / 2, cellPx * 0.12, 0, 7);
        ctx.fill();
      }
    } else if (action === 'dry' || action === 'wet') {
      ctx.strokeStyle = 'rgba(43,63,163,.25)';
      ctx.lineWidth = 1.5;
      const rr = paintRange(sel);
      ctx.strokeRect((sel.x - rr) * cellPx + 1, (sel.y - rr) * cellPx + 1, (rr * 2 + 1) * cellPx - 2, (rr * 2 + 1) * cellPx - 2);
    } else if (action === 'splash') {
      for (const t of splashTargets(sel)) ring(ctx, t.x, t.y, 'rgba(163,58,58,.9)');
    } else if (action === 'ability' && ABILITY[sel.m.bp].target !== 'self') {
      for (const i of abilityTargets(sel)) {
        const t = unitAt(i % COLS, Math.floor(i / COLS));
        if (t) ring(ctx, t.x, t.y, 'rgba(168,108,18,.95)');
        else {
          ctx.fillStyle = 'rgba(168,108,18,.45)';
          ctx.beginPath();
          ctx.arc((i % COLS) * cellPx + cellPx / 2, Math.floor(i / COLS) * cellPx + cellPx / 2, cellPx * 0.1, 0, 7);
          ctx.fill();
        }
      }
    }
  }
  ctx.strokeStyle = 'rgba(163,58,58,.5)';
  ctx.lineWidth = 2;
  for (const i of lastRival) ctx.strokeRect((i % COLS) * cellPx + 3, Math.floor(i / COLS) * cellPx + 3, cellPx - 6, cellPx - 6);
  if (sel && target !== null && !over && (action === 'dry' || action === 'wet')) {
    for (const i of stampCells(sel, target)) {
      const o = outcome(sel, curPig(sel), action === 'wet', cells[i]!);
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
  if (sel && target !== null && !over && action === 'ability' && sel.m.bp === 'schwebeblase') {
    ctx.strokeStyle = 'rgba(168,108,18,.95)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(((target % COLS) - 1) * cellPx + 3, (Math.floor(target / COLS) - 1) * cellPx + 3, cellPx * 3 - 6, cellPx * 3 - 6);
    ctx.setLineDash([]);
  }
  for (const u of allUnits()) {
    const size = cellPx * 1.02;
    const img = unitImg(u, Math.round(size));
    const cx = u.x * cellPx + cellPx / 2,
      cy = u.y * cellPx + cellPx / 2 - 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, cellPx * 0.46, 0, 7);
    ctx.clip();
    ctx.globalAlpha = 0.25 + 0.75 * Math.max(0, u.hp / u.max);
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = u.side === 1 ? 'rgba(43,63,163,.95)' : 'rgba(163,58,58,.95)';
    ctx.lineWidth = sel === u ? 3.5 : 2;
    ctx.beginPath();
    ctx.arc(cx, cy, cellPx * 0.46, 0, 7);
    ctx.stroke();
    // Ladung als Bogen
    if (u.charge > 0) {
      ctx.strokeStyle = u.charge >= CHARGE_FULL ? 'rgba(201,150,30,1)' : 'rgba(201,150,30,.6)';
      ctx.lineWidth = u.charge >= CHARGE_FULL ? 3 : 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cellPx * 0.46 + 3, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * u.charge) / CHARGE_FULL);
      ctx.stroke();
    }
    if (u.shield > 0) {
      ctx.strokeStyle = 'rgba(90,100,120,.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, cellPx * 0.4, 0, 7);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const bw = cellPx * 0.7,
      bx = u.x * cellPx + (cellPx - bw) / 2,
      by = u.y * cellPx + cellPx - 7;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = u.side === 1 ? '#2b3fa3' : '#a33a3a';
    ctx.fillRect(bx, by, bw * Math.max(0, u.hp / u.max), 4);
    if (u.stain > 0 || u.rooted > 0) {
      ctx.fillStyle = u.rooted > 0 ? 'rgba(46,122,87,.9)' : 'rgba(110,75,51,.9)';
      ctx.beginPath();
      ctx.arc(u.x * cellPx + cellPx * 0.84, u.y * cellPx + cellPx * 0.16, 4, 0, 7);
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
  const now = performance.now();
  flash = flash.filter((f) => now - f.t < 500);
  for (const f of flash) {
    ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - (now - f.t) / 500)})`;
    ctx.fillRect((f.i % COLS) * cellPx, Math.floor(f.i / COLS) * cellPx, cellPx, cellPx);
  }
  if (flash.length) requestAnimationFrame(drawBoard);
}
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, col: string): void {
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(x * cellPx + cellPx / 2, y * cellPx + cellPx / 2, cellPx * 0.5, 0, 7);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* ---------- Oberfläche ---------- */
const $ = (id: string) => document.getElementById(id)!;
function el(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
function patternIcon(p: [number, number][]): HTMLElement {
  const g = el('span', 'pat');
  const x0 = Math.min(...p.map((q) => q[0])),
    y0 = Math.min(...p.map((q) => q[1]));
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) {
      const i = el('i');
      if (p.some((q) => q[0] - x0 === x && q[1] - y0 === y)) i.className = 'on';
      g.append(i);
    }
  return g;
}
function bar(cls: string, frac: number): HTMLElement {
  const b = el('span', 'hp ' + cls);
  const i = el('i');
  i.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
  b.append(i);
  return b;
}
function drops(e: HTMLElement, n: number): void {
  e.replaceChildren();
  for (let k = 0; k < WATER_MAX; k++) e.append(el('i', k < n ? 'on' : ''));
}
function portrait(u: Unit, px: number): HTMLCanvasElement {
  const pc = document.createElement('canvas');
  pc.width = pc.height = px * 2;
  pc.getContext('2d')!.drawImage(unitImg(u, px), 0, 0, px * 2, px * 2);
  pc.style.opacity = String(0.3 + 0.7 * Math.max(0, u.hp / u.max));
  return pc;
}

function renderUnits(): void {
  const mine = $('mine');
  mine.replaceChildren();
  teams[0].units.forEach((u, i) => {
    const rest = resting(teams[0], i);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'unit' + (sel === u ? ' sel' : '') + (!u.alive ? ' gone' : '') + (rest ? ' resting' : '');
    btn.disabled = !u.alive || rest || over || turn !== 1 || (sel !== null && sel !== u && moved);
    const top = el('div', 'ut');
    top.append(portrait(u, 44), patternIcon(u.pattern));
    const hp = el('div', 'hpline');
    hp.append(bar('you', u.hp / u.max), document.createTextNode(` ${Math.max(0, u.hp)}/${u.max}`));
    const ab = ABILITY[u.m.bp];
    const abl = el('div', 'abl');
    abl.append(el('b', '', ab.name), bar('charge' + (u.charge >= CHARGE_FULL ? ' full' : ''), u.charge / CHARGE_FULL));
    const tr = el('div', 'trs');
    for (const t of u.traits) {
      const c = el('span', 'tr', t.label);
      c.title = t.text;
      tr.append(c);
    }
    btn.append(top, el('b', 'un', u.name), hp, el('div', 'us', `SAT ${u.sat} GRN ${u.grn} FLO ${u.flo} GLW ${u.glw}`), abl, tr, el('small', '', !u.alive ? 'washed out' : rest ? 'drying, next turn' : GAIT[u.m.bp].text));
    btn.addEventListener('click', () => selectUnit(u));
    mine.append(btn);
  });
  const rv = $('rival');
  rv.replaceChildren();
  teams[1].units.forEach((u) => {
    const d = el('div', 'ru' + (!u.alive ? ' gone' : ''));
    d.title = `${u.name}: ${ABILITY[u.m.bp].name}. ${ABILITY[u.m.bp].text}${u.traits.length ? ' Traits: ' + u.traits.map((t) => `${t.label} (${t.text})`).join(', ') : ''}`;
    d.append(portrait(u, 36), el('small', '', u.name), bar('rival', u.hp / u.max), bar('charge' + (u.charge >= CHARGE_FULL ? ' full' : ''), u.charge / CHARGE_FULL));
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
  for (const lv of ['apprentice', 'journeyman', 'master'] as Level[]) $('lv-' + lv).setAttribute('aria-pressed', String(level === lv));
  // Farbe wählen
  const pc = $('pigs');
  pc.replaceChildren();
  pc.hidden = !(sel && sel.sec && moved && (action !== 'soak' && action !== 'ability'));
  if (sel && sel.sec) {
    for (const [sec, pig] of [[false, sel.m.main], [true, sel.sec]] as [boolean, PigmentId][]) {
      const btn = el('button', 'pigbtn') as HTMLButtonElement;
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(useSec === sec));
      const dot = el('span', 'dot');
      dot.style.background = `rgb(${PIG[pig].rgb})`;
      btn.append(dot, document.createTextNode(PIG[pig].n + (sec ? ' (−1)' : '')));
      btn.addEventListener('click', () => {
        useSec = sec;
        renderHud();
        drawBoard();
      });
      pc.append(btn);
    }
  }
  const acts: Action[] = ['dry', 'wet', 'splash', 'soak', 'ability'];
  for (const a2 of acts) {
    const btn = $('act-' + a2) as HTMLButtonElement;
    btn.setAttribute('aria-pressed', String(action === a2));
    btn.disabled =
      !sel || over || turn !== 1 || (a2 === 'wet' && teams[0].water <= 0) || (a2 === 'splash' && sel !== null && moved && splashTargets(sel).length === 0) || (a2 === 'ability' && sel !== null && !(sel.charge >= CHARGE_FULL));
  }
  const abBtn = $('act-ability');
  if (sel) {
    const ab = ABILITY[sel.m.bp];
    abBtn.replaceChildren(el('b', '', ab.name), el('small', '', sel.charge >= CHARGE_FULL ? 'ready' : `${Math.round(sel.charge)}% Glow`));
  } else abBtn.replaceChildren(el('b', '', 'Ability'), el('small', '', 'charged by Glow'));
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
    info.textContent = inspect ? unitInfo(inspect) : 'Tap one of your blots. Tap a rival blot to read it.';
    go.textContent = 'Pick a blot';
  } else if (!moved) {
    const how = GAIT[sel.m.bp].key === 'tower' || sel.rooted ? `${sel.rooted ? 'Rooted. ' : ''}It cannot move. Tap it again to act.` : 'Move: tap a green dot. Or tap the blot again to stay put.';
    const tr = sel.traits.map((t) => `${t.label}: ${t.text}`).join(' · ');
    info.textContent = inspect ? unitInfo(inspect) : how + (tr ? ` ${tr}.` : '');
    go.textContent = 'Stay here';
    go.disabled = false;
  } else if (action === 'soak') {
    info.textContent = `Soak here: +${soakAmount(sel)} opacity, +1 water. Best on your own wet paint.`;
    go.textContent = 'Soak';
    go.disabled = false;
  } else if (action === 'ability') {
    const ab = ABILITY[sel.m.bp];
    if (sel.charge < CHARGE_FULL) info.textContent = `${ab.name}: ${ab.text} Charging: ${Math.round(sel.charge)}%.`;
    else if (ab.target === 'self') {
      info.textContent = `${ab.name}: ${ab.text}`;
      go.textContent = ab.name;
      go.disabled = abilityTargets(sel).length === 0;
    } else if (target !== null && abilityTargets(sel).includes(target)) {
      const t = unitAt(target % COLS, Math.floor(target / COLS));
      let extra = '';
      if (t && sel.m.bp === 'vierbeiner') extra = ` ${Math.round(splashOdds(sel, t, sel.m.main, 4) * 100)}% to hit, -${Math.round(baseDamage(sel, t, sel.m.main, true) * 1.5)}.`;
      if (t && sel.m.bp === 'krabbe') extra = ` ${Math.round(splashOdds(sel, t, sel.m.main, 0, true) * 100)}% to hit, -${baseDamage(sel, t, sel.m.main, true) * 2}.`;
      info.textContent = `${ab.name}: ${ab.text}${extra}`;
      go.textContent = ab.name;
      go.disabled = false;
    } else info.textContent = `${ab.name}: ${ab.text} Tap a gold target.`;
  } else if (action === 'splash') {
    const t = target !== null ? unitAt(target % COLS, Math.floor(target / COLS)) : null;
    const pig = curPig(sel);
    if (t && t.side === 2 && splashTargets(sel).includes(t)) {
      const p = Math.round(splashOdds(sel, t, pig) * 100);
      const dmg = baseDamage(sel, t, pig, cheb(sel.x, sel.y, t.x, t.y) <= 1);
      info.textContent = `Splash ${t.name}: ${p}% to hit, -${dmg}${GAIT[sel.m.bp].key === 'twin' ? ' twice' : ''}, ${relWord(pig, t.m.main)}${relation(pig, t.m.main) === 'komplementaer' || has(sel, 'staining') ? ', stains' : ''}.`;
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
        const o = outcome(sel, curPig(sel), action === 'wet', cells[i]!);
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
  for (const e of log.slice(0, 5)) l.append(el('li', e.c, e.t));
  $('sepia').textContent = sepiaLine;
  $('result').hidden = !over;
  if (over) {
    const [x, y] = scores();
    $('result-title').textContent = winner === 1 ? 'You win the sheet' : winner === 2 ? 'The rival wins the sheet' : 'A draw';
    $('result-sub').textContent = winReason === 'washed out' ? (winner === 1 ? 'Every rival blot washed out.' : 'Your blots washed out.') : `Paper dried: ${x} to ${y} (cells plus ${ALIVE_BONUS} per blot still standing).`;
  }
}
function unitInfo(u: Unit): string {
  const ab = ABILITY[u.m.bp];
  const tr = u.traits.map((t) => `${t.label} (${t.text})`).join(', ');
  return `${u.side === 2 ? 'Rival ' : ''}${u.name}, ${GAIT[u.m.bp].text}. ${ab.name} ${u.charge >= CHARGE_FULL ? 'ready' : Math.round(u.charge) + '%'}: ${ab.text}${tr ? ` Traits: ${tr}.` : ''}`;
}
function renderAll(): void {
  if (headless) return;
  renderUnits();
  renderHud();
  drawBoard();
}

function selectUnit(u: Unit): void {
  if (over || turn !== 1 || !u.alive || u.side !== 1) return;
  if (resting(teams[0], teams[0].units.indexOf(u))) return;
  if (moved && sel !== u) return;
  if (sel !== u) useSec = false;
  sel = u;
  target = null;
  inspect = null;
  if (action === 'ability' && u.charge < CHARGE_FULL) action = 'dry';
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
  if (u && u.side === 2 && (!sel || !moved)) {
    inspect = inspect === u ? null : u;
    renderHud();
    return;
  }
  if (!sel) {
    if (u && u.side === 1) selectUnit(u);
    return;
  }
  if (!moved) {
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
      if (note) logAdd(`Your ${sel.name} moved and ${note}.`, 'you');
      renderAll();
    }
    return;
  }
  if (action === 'splash') {
    if (u && u.side === 2 && splashTargets(sel).includes(u)) {
      if (target === i) return commit();
      target = i;
    }
  } else if (action === 'ability') {
    if (ABILITY[sel.m.bp].target === 'self' || !abilityTargets(sel).includes(i)) return;
    if (target === i) return commit();
    target = i;
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
  if (action === 'ability') {
    if (sel.charge < CHARGE_FULL) return;
    if (ABILITY[sel.m.bp].target !== 'self' && target === null) return;
  } else if ((action === 'dry' || action === 'wet' || action === 'splash') && target === null) return;
  if (action === 'wet' && teams[0].water <= 0) return;
  eraserRow = -1;
  const s = act(sel, action, curPig(sel), target);
  logAdd(`Your ${sel.name} ${s}.`, 'you');
  sel = null;
  moved = false;
  target = null;
  inspect = null;
  useSec = false;
  turn = 2;
  if (checkWipe()) return renderAll();
  renderAll();
  window.setTimeout(() => {
    aiMove(2, level);
    if (!checkWipe()) endRound();
    turn = 1;
    if ((action === 'wet' && teams[0].water <= 0) || action === 'splash' || action === 'ability') action = 'dry';
    renderAll();
  }, 700);
}

for (const a of ['dry', 'wet', 'splash', 'soak', 'ability'] as Action[]) {
  $('act-' + a).addEventListener('click', () => {
    action = a;
    target = null;
    renderHud();
    drawBoard();
  });
}
for (const lv of ['apprentice', 'journeyman', 'master'] as Level[]) {
  $('lv-' + lv).addEventListener('click', () => {
    level = lv;
    try {
      localStorage.setItem('bid-duel-level', lv);
    } catch {
      /* egal */
    }
    newGame((Math.random() * 1e9) >>> 0);
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

try {
  const saved = localStorage.getItem('bid-duel-level');
  if (saved === 'apprentice' || saved === 'journeyman' || saved === 'master') level = saved;
} catch {
  /* egal */
}
newGame(1);

/* Nur für automatische Probeläufe und das Abstimmen der Stufen */
(window as unknown as { __duel: unknown }).__duel = {
  state: () => ({ round, over, winner, turn, units: allUnits().map((u) => ({ side: u.side, x: u.x, y: u.y, hp: u.hp, name: u.name, charge: u.charge, rest: resting(teams[u.side - 1]!, teams[u.side - 1]!.units.indexOf(u)), reach: splashRange(u), ready: abilityReady(u), abT: abilityTargets(u), abSelf: ABILITY[u.m.bp].target === 'self', ab: ABILITY[u.m.bp].name })), score: scores(), water: teams[0].water }),
  sim: (p1: number, p2: Level, n: number) => {
    const keep = level;
    headless = true;
    const res = { p1: 0, p2: 0, draw: 0, wipes: 0, abilities: 0 };
    abilityUses = 0;
    tally = {};
    for (let g = 0; g < n; g++) {
      level = p2;
      newGame(1000 + g * 7919);
      teams[0].water = PLAYER_WATER;
      let guard = 0;
      while (!over && guard++ < 40) {
        aiMove(1, 'master', p1);
        if (checkWipe()) break;
        aiMove(2, p2);
        if (checkWipe()) break;
        endRound();
      }
      if (winner === 1) res.p1++;
      else if (winner === 2) res.p2++;
      else res.draw++;
      if (winReason === 'washed out') res.wipes++;
    }
    res.abilities = abilityUses / n;
    const per = Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, +(v / n).toFixed(2)]));
    headless = false;
    level = keep;
    newGame(1);
    return { ...res, per };
  },
  tune: (o: Partial<typeof TUNE>) => Object.assign(TUNE, o),
};
(window as unknown as { done: boolean }).done = true;
