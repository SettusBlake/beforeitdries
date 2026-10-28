/*
 * Farbschlacht, Regeln und Gegner ohne Darstellung (Fassung 4 als Grundlage).
 * Jede Änderung, die man sehen soll, wird als Ereignis gemeldet. Die Darstellung spielt sie der Reihe nach ab.
 * Ein „sync“ am Ende jeder Aktion enthält den ganzen Zustand, damit die Darstellung nie auseinanderläuft.
 */
import { BLOOM_TRAITS, BP, PIG, type BlueprintId, type PigmentId, type RGB } from '../../../src/shared/data';
import { relation } from '../../../src/shared/glaze';
import { humidityFor, makeMonster, statRows, type Monster } from '../../../src/shared/monster';
import { RNG, type Rand } from '../../../src/shared/rng';

/* ---------- Regeln (alle Zahlen hier) ---------- */
export const COLS = 7,
  ROWS = 9,
  ROUNDS = 8,
  WET_TURNS = 2,
  WATER_MAX = 4,
  ERASER_ROUNDS = [3, 6],
  PAINT_RANGE = 2,
  HEARTS = 3,
  HEART_BONUS = 3,
  BAG = 6,
  ON_SHEET = 3,
  CREST_MAX = 9,
  ROLL_N = 3;
/** Sternseiten je Stufe (Index = Stufe) */
const STAR_FACES = [0, 3, 3, 2];
const START_CRESTS: Record<Crest, number> = { step: 2, brush: 1, splash: 0, guard: 0, glow: 0 };

export type Side = 1 | 2;
export type Level = 'apprentice' | 'journeyman' | 'master';
export type Action = 'dry' | 'wet' | 'splash' | 'soak' | 'ability' | 'none';
export type Crest = 'step' | 'brush' | 'splash' | 'guard' | 'glow';
type StatK = 'flo' | 'opa' | 'sat' | 'grn' | 'glw';
/** Eine Würfelseite: Stern mit Stufe oder Symbol mit Anzahl */
export type Face = { k: 'star' | Crest; n: number };
export type P = [number, number];
export type Cell = { owner: 0 | 1 | 2 | 3; rgb: RGB; hue: PigmentId | null; wet: number; atk: number; def: number; lf: number; stamp: number; home: 0 | Side };
export type Trait = { key: string; label: string; text: string };
/** Ein Klecks ist zugleich sein Würfel */
export type Unit = {
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
  state: 'bag' | 'sheet' | 'gone';
  stain: number;
  rooted: number;
  shield: number;
  moved: boolean;
  acted: boolean;
  pattern: P[];
  net: P[];
  lv: number;
  faces: Face[];
  sec: PigmentId | null;
  traits: Trait[];
};
export type Team = { side: Side; units: Unit[]; water: number; crests: Record<Crest, number>; hearts: number; home: number };
export type Rolled = { u: Unit; fi: number; face: Face };

/* ---------- Ereignisse für die Darstellung ---------- */
export type CellSnap = { i: number; c: Cell };
export type StampRes = 'take' | 'refresh' | 'mud' | 'held' | 'none';
export type UnitSnap = { id: number; x: number; y: number; hp: number; max: number; state: Unit['state']; stain: number; rooted: number; shield: number; acted: boolean };
export type TeamSnap = { crests: Record<Crest, number>; water: number; hearts: number };
export type Ev =
  | { k: 'roll'; side: Side; dice: { id: number; fi: number }[]; crests: Record<Crest, number> }
  | { k: 'summon'; side: Side; id: number; x: number; y: number; cells: CellSnap[]; faces: Face[] }
  | { k: 'move'; id: number; path: number[]; trail: CellSnap[] }
  | { k: 'stamp'; id: number; wet: boolean; cells: (CellSnap & { r: StampRes })[] }
  | { k: 'shot'; id: number; at: number; res: 'miss' | 'dodge' | 'hit' | 'crit'; dmg: number; guard: boolean; rgb: RGB; text: string }
  | { k: 'hp'; id: number; hp: number; delta: number; why: string }
  | { k: 'wash'; id: number; cell: CellSnap }
  | { k: 'pos'; id: number; x: number; y: number; how: 'push' | 'dash' | 'leap' | 'drift' }
  | { k: 'ability'; id: number; name: string; bp: BlueprintId; at: number; area: number[] }
  | { k: 'cells'; how: 'bleed' | 'seep' | 'rain' | 'wet' | 'splat'; cells: CellSnap[] }
  | { k: 'heart'; side: Side; hearts: number; from: number }
  | { k: 'eraser'; row: number; cells: CellSnap[] }
  | { k: 'round'; round: number }
  | { k: 'turn'; side: Side }
  | { k: 'log'; t: string; c: string }
  | { k: 'sync'; cells: Cell[]; units: UnitSnap[]; teams: TeamSnap[]; round: number };

export const CRESTS: { k: Crest; label: string; stat: StatK; col: string; use: string }[] = [
  { k: 'step', label: 'Step', stat: 'flo', col: '#2e7a57', use: 'one move' },
  { k: 'brush', label: 'Brush', stat: 'opa', col: '#5b4a8a', use: 'one stamp' },
  { k: 'splash', label: 'Splash', stat: 'sat', col: '#c0482a', use: 'one splash' },
  { k: 'guard', label: 'Guard', stat: 'grn', col: '#5f6474', use: 'halves a hit by itself' },
  { k: 'glow', label: 'Glow', stat: 'glw', col: '#b8860b', use: 'two for an ability' },
];
export const crestDef = (k: Crest) => CRESTS.find((c) => c.k === k)!;

/* Rivale: bedenkt nur eine Handvoll Züge (0 = alle), schwächere Kleckse, weniger Wasser */
export const TUNE = {
  look: { apprentice: 3, journeyman: 15, master: 0 } as Record<Level, number>,
  hp: { apprentice: 0.7, journeyman: 0.85, master: 1 } as Record<Level, number>,
  stat: { apprentice: 0.65, journeyman: 0.85, master: 1 } as Record<Level, number>,
  water: { apprentice: 1, journeyman: 2, master: 3 } as Record<Level, number>,
};
const PLAYER_WATER = 3;

const PATTERNS: Record<BlueprintId, P[]> = {
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

/* Die elf Würfelnetze (per Faltprobe ermittelt), je Bauplan eines */
const NETS: P[][] = [
  [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2]],
  [[2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2]],
  [[3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]],
  [[2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [1, 2]],
  [[2, 0], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2]],
  [[2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [0, 2]],
  [[2, 0], [3, 0], [4, 0], [0, 1], [1, 1], [2, 1]],
  [[2, 0], [1, 1], [2, 1], [0, 2], [1, 2], [0, 3]],
];
const NET_OF: Record<BlueprintId, number> = {
  kriecher: 9,
  flatterer: 4,
  schwebeblase: 5,
  vierbeiner: 0,
  schlange: 10,
  turm: 3,
  krabbe: 6,
  qualle: 1,
  huepfer: 2,
  knolle: 7,
  strahler: 8,
  doppelkopf: 4,
};

/* Gangart je Bauplan. Kleckse bewegen sich nur durch Farbe, blankes Papier ist eine Wand */
export const GAIT: Record<BlueprintId, { key: string; text: string }> = {
  kriecher: { key: 'trail-dry', text: 'leaves a dry trail' },
  flatterer: { key: 'fly', text: 'flies, even over bare paper' },
  schwebeblase: { key: 'float', text: 'floats over mud' },
  vierbeiner: { key: 'fast', text: 'runs one step further' },
  schlange: { key: 'slide', text: 'slides through own paint' },
  turm: { key: 'tower', text: 'never moves, reaches far' },
  krabbe: { key: 'pinch', text: '+3 damage up close' },
  qualle: { key: 'trail-wet', text: 'drips a wet trail' },
  huepfer: { key: 'hop', text: 'hops two cells, even onto paper' },
  knolle: { key: 'root', text: 'soaks twice as well' },
  strahler: { key: 'reach', text: 'splashes two cells away' },
  doppelkopf: { key: 'twin', text: 'splashes twice' },
};

/* Fähigkeit je Bauplan, kostet Leuchten. Ziel „self“, „cell“ oder „unit“ */
type AbilityTarget = 'self' | 'cell' | 'unit';
export const ABILITY: Record<BlueprintId, { name: string; text: string; target: AbilityTarget }> = {
  kriecher: { name: 'Seep', text: 'Your paint nearby turns wet and bleeds into all free paper around it.', target: 'self' },
  flatterer: { name: 'Gust', text: 'Rivals within 2 are blown back a cell and lose 3 opacity.', target: 'self' },
  schwebeblase: { name: 'Rain', text: 'Rain on a 3×3 patch within 3: your paint turns wet, rival dry paint turns wet and soft.', target: 'cell' },
  vierbeiner: { name: 'Charge', text: 'Dash along a row or column at a rival within 4 and splash it for 1.5×, +4 to hit.', target: 'unit' },
  schlange: { name: 'Coil', text: 'Wrap an adjacent rival: -4, stained, and it cannot move next turn.', target: 'unit' },
  turm: { name: 'Bastion', text: 'All your blots get +5 on defence rolls for two rounds.', target: 'self' },
  krabbe: { name: 'Crush', text: 'Crush an adjacent rival: ignores Grain, double damage.', target: 'unit' },
  qualle: { name: 'Drift', text: 'Drift to any of your wet cells and stain every rival next to it.', target: 'cell' },
  huepfer: { name: 'Bound', text: 'Leap to a free cell within 4 and stamp dry where you land.', target: 'cell' },
  knolle: { name: 'Sprout', text: 'All your blots heal 6 and the paint under them turns wet.', target: 'self' },
  strahler: { name: 'Flare', text: 'Burst wet paint into all 8 cells around and splash every adjacent rival for 0.6×.', target: 'self' },
  doppelkopf: { name: 'Howl', text: 'The rival loses 2 water and 1 Glow. Rivals within 2 lose 3 opacity.', target: 'self' },
};
const MUD: RGB = [116, 100, 82];
export const PAPER: RGB = [247, 245, 239];

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
  if (m.events.print) t.push({ key: 'print', label: 'Fingerprint', text: 'abilities cost 1 Glow' });
  if (pigs.includes('phthalo')) t.push({ key: 'staining', label: 'Staining', text: 'splashes always stain' });
  if (pigs.includes('opera')) t.push({ key: 'fugitive', label: 'Fugitive', text: 'fades 1 each round, +2 damage' });
  if (PIG[m.main].gran >= 0.5) t.push({ key: 'granulating', label: 'Granulating', text: 'its dry paint is +2 harder to cover' });
  return t;
}
export const has = (u: Unit, k: string) => u.traits.some((t) => t.key === k);

const mk = (sheet: string, idx: number) => makeMonster(sheet, idx, humidityFor(sheet));
function find(bp: BlueprintId, main: PigmentId, salt: string, wantSec = false): Monster {
  for (let i = 0; i < 60000; i++) {
    const m = mk(salt + i, i % 12);
    if (m.bp === bp && m.main === main && (!wantSec || m.sec.length > 0)) return m;
  }
  return mk(salt, 0);
}
/** Zwei Kleckse für das Titelbild */
export const titleBlots = (): Monster[] => [find('schlange', 'ultra', 'A', true), find('krabbe', 'siena', 'D')];
let uid = 0;
function unitOf(m: Monster, side: Side): Unit {
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
    x: -1,
    y: -1,
    state: 'bag',
    stain: 0,
    rooted: 0,
    shield: 0,
    moved: false,
    acted: false,
    pattern: PATTERNS[m.bp],
    net: NETS[NET_OF[m.bp]]!,
    lv: 1,
    faces: [],
    sec: m.sec[0] ?? null,
    traits: traitsOf(m),
  };
}
export const power = (u: Unit) => u.sat + u.opa + u.grn + u.flo + u.glw;
/** Seiten des Würfels: Sterne nach Stufe, der Rest nach den Werten des Kleckses, der stärkste Wert ab 30 einmal doppelt */
function makeFaces(u: Unit): Face[] {
  const r = RNG(u.m.seed ^ 0x51ce);
  const f: Face[] = [];
  for (let i = 0; i < STAR_FACES[u.lv]!; i++) f.push({ k: 'star', n: u.lv });
  const w = CRESTS.map((c) => Math.pow(Math.max(1, u[c.stat]), 1.5));
  const total = w.reduce((a, b) => a + b, 0);
  const top = CRESTS[w.indexOf(Math.max(...w))]!;
  let doubled = false;
  while (f.length < 6) {
    let x = r() * total,
      i = 0;
    while (i < w.length - 1 && x > w[i]!) {
      x -= w[i]!;
      i++;
    }
    const c = CRESTS[i]!;
    const dbl = !doubled && c === top && u[c.stat] >= 30;
    if (dbl) doubled = true;
    f.push({ k: c.k, n: dbl ? 2 : 1 });
  }
  return f;
}

/* Wahrscheinlichkeit, dass a + W20 > b + W20 */
const pTable = new Map<number, number>();
export function pWin(a: number, b: number): number {
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
export const relWord = (a: PigmentId, b: PigmentId) => {
  const r = relation(a, b);
  return r === 'komplementaer' ? 'complementary ×1.5' : r === 'harmonisch' ? 'harmonious ×0.75' : 'neutral';
};

/* ---------- Zustand ---------- */
export const S = {
  cells: [] as Cell[],
  teams: [] as unknown as [Team, Team],
  round: 1,
  turn: 1 as Side,
  stamp: 0,
  gameSeed: 0,
  over: false,
  winner: 0 as 0 | Side,
  winReason: '',
  level: 'apprentice' as Level,
  headless: false,
  dice: RNG(1) as Rand,
  log: [] as { t: string; c: string }[],
  tally: {} as Record<string, number>,
  events: [] as Ev[],
};
const count = (k: string, n = 1) => {
  S.tally[k] = (S.tally[k] ?? 0) + n;
};
function emit(e: Ev): void {
  if (!S.headless) S.events.push(e);
}
/** Alle bisher gesammelten Ereignisse abholen */
export function drain(): Ev[] {
  const e = S.events;
  S.events = [];
  return e;
}
export function snapUnit(u: Unit): UnitSnap {
  return { id: u.id, x: u.x, y: u.y, hp: u.hp, max: u.max, state: u.state, stain: u.stain, rooted: u.rooted, shield: u.shield, acted: u.acted };
}
/** Der ganze Zustand für die Darstellung */
export function sync(): void {
  if (S.headless) return;
  emit({
    k: 'sync',
    cells: S.cells.map((c) => ({ ...c })),
    units: [...S.teams[0].units, ...S.teams[1].units].map(snapUnit),
    teams: S.teams.map((t) => ({ crests: { ...t.crests }, water: t.water, hearts: t.hearts })),
    round: S.round,
  });
}
const snap = (i: number): CellSnap => ({ i, c: { ...S.cells[i]! } });

export const idx = (x: number, y: number) => y * COLS + x;
export const inside = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < ROWS;
export const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
export const allUnits = () => [...S.teams[0].units, ...S.teams[1].units].filter((u) => u.state === 'sheet');
export const onSheet = (t: Team) => t.units.filter((u) => u.state === 'sheet');
export const unitAt = (x: number, y: number) => allUnits().find((u) => u.x === x && u.y === y) ?? null;
export const unitById = (id: number) => [...S.teams[0].units, ...S.teams[1].units].find((u) => u.id === id) ?? null;
export const teamOf = (u: Unit) => S.teams[u.side - 1]!;
export const foeTeam = (u: Unit) => S.teams[u.side === 1 ? 1 : 0];
const d20 = () => 1 + Math.floor(S.dice() * 20);
const emptyCell = (): Cell => ({ owner: 0, rgb: PAPER, hue: null, wet: 0, atk: 0, def: 0, lf: 0, stamp: 0, home: 0 });
export const living = (t: Team) => t.units.filter((u) => u.state !== 'gone');
export function logAdd(t: string, c: string): void {
  if (S.headless) return;
  S.log.unshift({ t, c });
  emit({ k: 'log', t, c });
}
export const faceText = (f: Face) => (f.k === 'star' ? `★${f.n}` : `${crestDef(f.k).label}${f.n > 1 ? ' ×2' : ''}`);

export function newGame(seed: number, level: Level): void {
  S.gameSeed = seed;
  S.level = level;
  const r = RNG(seed);
  S.dice = RNG(seed ^ 0xabcdef);
  S.cells = Array.from({ length: COLS * ROWS }, emptyCell);
  S.round = 1;
  S.turn = 1;
  S.over = false;
  S.winner = 0;
  S.winReason = '';
  S.stamp = 0;
  S.log = [];
  S.events = [];
  let mine: Monster[], theirs: Monster[];
  if (seed === 1) {
    mine = [find('schlange', 'ultra', 'A', true), find('flatterer', 'kadmium', 'B'), find('huepfer', 'phthalo', 'C'), find('vierbeiner', 'karmin', 'G'), find('knolle', 'sepia', 'H'), find('strahler', 'indigo', 'I')];
    theirs = [find('krabbe', 'siena', 'D'), find('qualle', 'karmin', 'E'), find('strahler', 'opera', 'F'), find('kriecher', 'indigo', 'J'), find('turm', 'phthalo', 'K'), find('doppelkopf', 'kadmium', 'L')];
  } else {
    const pick = (salt: string) => Array.from({ length: BAG }, () => mk(salt + Math.floor(r() * 1e6), Math.floor(r() * 12)));
    mine = pick('Y');
    theirs = pick('R');
  }
  const homeOf = (side: Side) => idx(Math.floor(COLS / 2), side === 1 ? ROWS - 1 : 0);
  S.teams = [
    { side: 1, units: mine.map((m) => unitOf(m, 1)), water: PLAYER_WATER, crests: { ...START_CRESTS }, hearts: HEARTS, home: homeOf(1) },
    { side: 2, units: theirs.map((m) => unitOf(m, 2)), water: TUNE.water[level], crests: { ...START_CRESTS }, hearts: HEARTS, home: homeOf(2) },
  ];
  for (const t of S.teams) {
    // Stufe nach Stärke im eigenen Beutel: je zwei Würfel Stufe 1, 2 und 3
    const sorted = [...t.units].sort((a, b) => power(a) - power(b));
    sorted.forEach((u, i) => (u.lv = 1 + Math.floor(i / 2)));
    for (const u of t.units) u.faces = makeFaces(u);
    const h = S.cells[t.home]!;
    h.home = t.side;
    h.owner = t.side;
    h.rgb = PIG[t.units[0]!.m.main].rgb;
    const hx = t.home % COLS,
      hy = Math.floor(t.home / COLS);
    for (const [x, y] of [[hx - 1, hy], [hx + 1, hy], [hx, hy + (t.side === 1 ? -1 : 1)]] as P[]) paintCell(S.cells[idx(x, y)]!, t.units[0]!, t.units[0]!.m.main, false);
  }
  for (const u of S.teams[1].units) {
    const k = TUNE.stat[level];
    u.hp = u.max = Math.round(u.max * TUNE.hp[level]);
    u.sat = Math.round(u.sat * k);
    u.opa = Math.round(u.opa * k);
    u.grn = Math.round(u.grn * k);
  }
  sync();
}

function paintCell(c: Cell, u: Unit, pig: PigmentId, wet: boolean): void {
  if (c.home) return;
  c.owner = u.side;
  c.rgb = PIG[pig].rgb;
  c.hue = pig;
  c.wet = wet ? WET_TURNS : 0;
  c.atk = bonus(u.sat) - (pig !== u.m.main ? 1 : 0);
  c.def = bonus(u.grn) + (has(u, 'granulating') ? 2 : 0);
  c.lf = u.lf;
  c.stamp = ++S.stamp;
}
function mudCell(c: Cell): void {
  if (c.home) return;
  c.owner = 3;
  c.rgb = MUD;
  c.hue = null;
  c.wet = 0;
  c.stamp = ++S.stamp;
}

/* ---------- Würfel ---------- */
export function rollDice(t: Team, us: Unit[]): Rolled[] {
  const out = us.map((u) => {
    const fi = Math.floor(S.dice() * 6);
    return { u, fi, face: u.faces[fi]! };
  });
  for (const r of out) if (r.face.k !== 'star') t.crests[r.face.k] = Math.min(CREST_MAX, t.crests[r.face.k] + r.face.n);
  count(`${t.side}roll`);
  emit({ k: 'roll', side: t.side, dice: out.map((r) => ({ id: r.u.id, fi: r.fi })), crests: { ...t.crests } });
  logAdd(`${t.side === 2 ? 'Rival' : 'You'} rolled ${out.map((x) => faceText(x.face)).join(', ')}.`, t.side === 2 ? 'rival' : 'you');
  return out;
}
/** Sterne der anderen Würfel müssen zusammen mindestens die Stufe des Kleckses ergeben */
export function summonable(t: Team, rolled: Rolled[]): Unit[] {
  if (onSheet(t).length >= ON_SHEET) return [];
  return rolled
    .filter((r) => r.face.k === 'star' && r.u.state === 'bag')
    .filter((r) => rolled.filter((o) => o !== r && o.face.k === 'star').reduce((a, o) => a + o.face.n, 0) >= r.u.lv)
    .filter((r) => placements(r.u).length > 0)
    .map((r) => r.u);
}

/* Würfelnetz: 8 Lagen (4 Drehungen, gespiegelt), Anker ist die Zelle mit den meisten Nachbarn */
export function netCore(net: P[]): number {
  let best = 0,
    bn = -1;
  net.forEach(([x, y], i) => {
    const n = net.filter(([a, b]) => Math.abs(a - x) + Math.abs(b - y) === 1).length;
    if (n > bn) {
      bn = n;
      best = i;
    }
  });
  return best;
}
function orientNet(net: P[], o: number): P[] {
  let p = net.map(([x, y]) => (o >= 4 ? [-x, y] : [x, y]) as P);
  for (let k = 0; k < o % 4; k++) p = p.map(([x, y]) => [-y, x] as P);
  return p;
}
export function netAt(u: Unit, o: number, at: number): number[] | null {
  const p = orientNet(u.net, o);
  const core = p[netCore(u.net)]!;
  const ax = at % COLS,
    ay = Math.floor(at / COLS);
  const out: number[] = [];
  for (const [x, y] of p) {
    const nx = ax + x - core[0],
      ny = ay + y - core[1];
    if (!inside(nx, ny)) return null;
    out.push(idx(nx, ny));
  }
  return out;
}
export function validNet(side: Side, list: number[]): boolean {
  let touch = false;
  for (const i of list) {
    const c = S.cells[i]!;
    if (c.home || (c.owner !== 0 && c.owner !== side) || unitAt(i % COLS, Math.floor(i / COLS))) return false;
    if (c.owner === side) touch = true;
    const x = i % COLS,
      y = Math.floor(i / COLS);
    for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as P[]) if (inside(a, b) && S.cells[idx(a, b)]!.owner === side) touch = true;
  }
  return touch;
}
export function placements(u: Unit): { o: number; at: number; list: number[] }[] {
  const out: { o: number; at: number; list: number[] }[] = [];
  for (let o = 0; o < 8; o++)
    for (let at = 0; at < COLS * ROWS; at++) {
      const list = netAt(u, o, at);
      if (list && validNet(u.side, list)) out.push({ o, at, list });
    }
  return out;
}
/** Aufklappen: Reihenfolge der Felder vom Anker aus, wie ein Würfel, der Seite für Seite umklappt */
function unfoldOrder(list: number[], at: number): number[] {
  const out = [at];
  const left = list.filter((i) => i !== at);
  while (left.length) {
    const k = left.findIndex((i) => out.some((j) => Math.abs((i % COLS) - (j % COLS)) + Math.abs(Math.floor(i / COLS) - Math.floor(j / COLS)) === 1));
    out.push(left.splice(Math.max(0, k), 1)[0]!);
  }
  return out;
}
export function doSummon(u: Unit, o: number, at: number): string {
  const list = netAt(u, o, at)!;
  for (const i of list) paintCell(S.cells[i]!, u, u.m.main, true);
  u.state = 'sheet';
  u.x = at % COLS;
  u.y = Math.floor(at / COLS);
  u.hp = u.max;
  u.moved = true;
  u.acted = false;
  count(`${u.side}summon`);
  const order = unfoldOrder(list, at);
  // Die Seite des Würfels zu jedem Feld (gleiche Reihenfolge wie das Netz)
  emit({ k: 'summon', side: u.side, id: u.id, x: u.x, y: u.y, cells: order.map(snap), faces: order.map((i) => u.faces[list.indexOf(i)]!) });
  const s = `unfolded ${u.name} (★${u.lv}): six cells of wet ${PIG[u.m.main].n}`;
  return s;
}

/* ---------- Bewegen: nur durch Farbe ---------- */
export function moveRange(u: Unit): number {
  if (u.rooted > 0 || GAIT[u.m.bp].key === 'tower') return 0;
  return Math.min(5, 2 + Math.floor(u.flo / 15) + (GAIT[u.m.bp].key === 'fast' ? 1 : 0));
}
export function reach(u: Unit): Map<number, number> {
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
        for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as P[]) {
          const nx = fx + dx,
            ny = fy + dy;
          if (!inside(nx, ny) || unitAt(nx, ny) || S.cells[idx(nx, ny)]!.home) continue;
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
    if (cur !== start && S.cells[cur]!.owner === 3 && gait !== 'fly' && gait !== 'float') continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as P[]) {
      const nx = cx + dx,
        ny = cy + dy;
      if (!inside(nx, ny) || unitAt(nx, ny)) continue;
      const ni = idx(nx, ny);
      const c = S.cells[ni]!;
      if (c.home) continue;
      if (c.owner === 0 && gait !== 'fly') continue;
      let step = 1;
      if (gait !== 'fly') {
        if (c.owner === u.side && gait === 'slide') step = 0.5;
        else if (c.owner !== u.side && c.owner !== 3) step = 2;
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
export function doMove(u: Unit, to: number, prev: Map<number, number>): string {
  const path = pathTo(prev, to);
  u.x = to % COLS;
  u.y = Math.floor(to / COLS);
  u.moved = true;
  teamOf(u).crests.step--;
  const gait = GAIT[u.m.bp].key;
  const trail: number[] = [];
  if (gait === 'trail-dry' || gait === 'trail-wet') {
    for (const i of path.slice(0, -1)) {
      const c = S.cells[i]!;
      if (c.owner === 0 || c.owner === u.side) {
        paintCell(c, u, u.m.main, gait === 'trail-wet');
        trail.push(i);
      }
    }
  }
  emit({ k: 'move', id: u.id, path, trail: trail.map(snap) });
  sync();
  return trail.length ? `left a ${gait === 'trail-wet' ? 'wet' : 'dry'} trail of ${trail.length}` : '';
}
export const canMove = (u: Unit) => !u.moved && teamOf(u).crests.step > 0 && moveRange(u) > 0;

/* ---------- Malen ---------- */
type Out = { kind: 'take' | 'refresh' | 'contest' | 'mud' | 'none' | 'over'; p: number };
function stampBonus(u: Unit, wet: boolean): number {
  return (wet && has(u, 'bloom1')) || (!wet && has(u, 'bloom2')) ? 2 : 0;
}
export function outcome(u: Unit, pig: PigmentId, wet: boolean, c: Cell): Out {
  const foe = u.side === 1 ? 2 : 1;
  const sec = pig !== u.m.main ? 1 : 0;
  if (c.home) return { kind: 'none', p: 0 };
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
export const paintRange = (u: Unit) => (GAIT[u.m.bp].key === 'tower' ? 3 : PAINT_RANGE);
export function stampCells(u: Unit, at: number): number[] {
  const x0 = at % COLS,
    y0 = Math.floor(at / COLS);
  return u.pattern.map(([dx, dy]) => [x0 + dx, y0 + dy] as const).filter(([x, y]) => inside(x, y)).map(([x, y]) => idx(x, y));
}
export function canPaintAt(u: Unit, at: number): boolean {
  return cheb(u.x, u.y, at % COLS, Math.floor(at / COLS)) <= paintRange(u);
}
function applyPaint(u: Unit, pig: PigmentId, wet: boolean, list: number[]): { took: number; mud: number; held: number; rolls: string[] } {
  let took = 0,
    mud = 0,
    held = 0;
  const rolls: string[] = [];
  const res: (CellSnap & { r: StampRes })[] = [];
  const sec = pig !== u.m.main ? 1 : 0;
  for (const i of list) {
    const c = S.cells[i]!;
    const o = outcome(u, pig, wet, c);
    let r: StampRes = 'none';
    if (o.kind === 'take' || o.kind === 'refresh') {
      paintCell(c, u, pig, wet);
      if (o.kind === 'take') took++;
      r = o.kind;
    } else if (o.kind === 'mud') {
      mudCell(c);
      mud++;
      r = 'mud';
    } else if (o.kind === 'contest' || o.kind === 'over') {
      const a = d20(),
        d = d20();
      const atk = (o.kind === 'contest' ? bonus(u.sat) : bonus(u.opa)) - sec + stampBonus(u, wet);
      const def = c.owner === 3 ? 6 : o.kind === 'contest' ? c.atk : c.def;
      rolls.push(`d${a}+${atk} vs d${d}+${def}`);
      if (a + atk > d + def) {
        paintCell(c, u, pig, wet);
        took++;
        r = 'take';
      } else {
        held++;
        r = 'held';
      }
    }
    res.push({ ...snap(i), r });
  }
  emit({ k: 'stamp', id: u.id, wet, cells: res });
  return { took, mud, held, rolls };
}
function doPaint(u: Unit, pig: PigmentId, wet: boolean, at: number): string {
  if (wet) teamOf(u).water--;
  const r = applyPaint(u, pig, wet, stampCells(u, at));
  const parts = [`${r.took} taken`];
  if (r.mud) parts.push(`${r.mud} to mud`);
  if (r.held) parts.push(`${r.held} held`);
  return `painted ${wet ? 'wet' : 'dry'}${pig !== u.m.main ? ` in ${PIG[pig].n}` : ''}: ${parts.join(', ')}${r.rolls.length ? ` (${r.rolls.join('; ')})` : ''}`;
}

/* ---------- Spritzer ---------- */
export function splashRange(u: Unit): number {
  let r = GAIT[u.m.bp].key === 'reach' || GAIT[u.m.bp].key === 'tower' ? 2 : 1;
  const c = S.cells[idx(u.x, u.y)]!;
  if (c.owner === u.side && c.wet > 0) r++;
  return r;
}
export function splashTargets(u: Unit): Unit[] {
  return onSheet(foeTeam(u)).filter((t) => cheb(u.x, u.y, t.x, t.y) <= splashRange(u));
}
/** Die gegnerische Palette trifft nur, wer direkt daneben steht */
export const touchesHome = (u: Unit, x = u.x, y = u.y) => {
  const h = foeTeam(u).home;
  return cheb(x, y, h % COLS, Math.floor(h / COLS)) <= 1;
};
export function splashCells(u: Unit): number[] {
  const out = splashTargets(u).map((t) => idx(t.x, t.y));
  if (touchesHome(u)) out.push(foeTeam(u).home);
  return out;
}
const grainOf = (t: Unit) => t.grn + (t.shield > 0 ? 25 : 0);
const dodgeOf = (t: Unit) => Math.min(0.4, t.flo / 400 + (has(t, 'alcohol') ? 0.06 : 0) + (has(t, 'bloom4') ? 0.05 : 0));
const critOf = (u: Unit) => 0.05 + (has(u, 'salt') ? 0.08 : 0);
export function baseDamage(u: Unit, t: Unit, pig: PigmentId, near: boolean): number {
  let dmg = (3 + u.sat / 6 - (pig !== u.m.main ? 1 : 0)) * typeMult(pig, t.m.main);
  if (GAIT[u.m.bp].key === 'pinch' && near) dmg += 3;
  if (has(u, 'fugitive')) dmg += 2;
  if (GAIT[u.m.bp].key === 'twin') dmg *= 0.6;
  if (has(t, 'bloom3')) dmg *= 0.85;
  return Math.max(1, Math.round(dmg));
}
export function splashOdds(u: Unit, t: Unit, pig: PigmentId, plus = 0, ignoreGrain = false): number {
  return pWin(bonus(u.sat) - (pig !== u.m.main ? 1 : 0) + plus, ignoreGrain ? 0 : bonus(grainOf(t))) * (1 - dodgeOf(t));
}
/** Deckkraft ändern und melden */
function setHp(t: Unit, hp: number, why: string): void {
  const delta = hp - t.hp;
  t.hp = hp;
  if (delta) emit({ k: 'hp', id: t.id, hp, delta, why });
}
/** Ein Treffer mit Würfeln. Ein Guard des Gegners halbiert den Schaden von selbst. */
function strike(u: Unit, t: Unit, pig: PigmentId, mult: number, plus = 0, ignoreGrain = false): [string, number] {
  const at = idx(t.x, t.y);
  const shot = (res: 'miss' | 'dodge' | 'hit' | 'crit', dmg: number, guard: boolean, text: string) => emit({ k: 'shot', id: u.id, at, res, dmg, guard, rgb: PIG[pig].rgb, text });
  if (S.dice() < dodgeOf(t)) {
    shot('dodge', 0, false, 'dodged');
    return ['dodged', 0];
  }
  const a = d20(),
    d = d20();
  const atk = bonus(u.sat) - (pig !== u.m.main ? 1 : 0) + plus,
    def = ignoreGrain ? 0 : bonus(grainOf(t));
  const roll = `d${a}+${atk} vs d${d}+${def}`;
  if (a + atk <= d + def) {
    shot('miss', 0, false, roll);
    return [`${roll}: miss`, 0];
  }
  const crit = a === 20 || S.dice() < critOf(u);
  let dmg = Math.max(1, Math.round(baseDamage(u, t, pig, cheb(u.x, u.y, t.x, t.y) <= 1) * mult * (crit ? 1.5 : 1)));
  let guard = false;
  const ft = teamOf(t);
  if (ft.crests.guard > 0) {
    ft.crests.guard--;
    dmg = Math.ceil(dmg / 2);
    guard = true;
    count(`${t.side}guard`);
  }
  shot(crit ? 'crit' : 'hit', dmg, guard, roll);
  setHp(t, t.hp - dmg, crit ? 'crit' : 'hit');
  if (relation(pig, t.m.main) === 'komplementaer' || has(u, 'staining')) t.stain = 2;
  return [`${roll}: ${crit ? 'crit' : 'hit'}${guard ? ', guarded' : ''}, -${dmg}`, dmg];
}
function doSplash(u: Unit, pig: PigmentId, at: number): string {
  const ft = foeTeam(u);
  if (at === ft.home) {
    ft.hearts--;
    count(`${u.side}heart`);
    emit({ k: 'shot', id: u.id, at, res: 'hit', dmg: 0, guard: false, rgb: PIG[pig].rgb, text: 'palette' });
    emit({ k: 'heart', side: ft.side, hearts: ft.hearts, from: u.id });
    if (ft.hearts <= 0) {
      S.over = true;
      S.winner = u.side;
      S.winReason = 'palette broken';
    }
    return `splashed the ${ft.side === 1 ? 'your' : 'rival'} palette: one heart gone, ${Math.max(0, ft.hearts)} left`;
  }
  const t = unitAt(at % COLS, Math.floor(at / COLS))!;
  const hits = GAIT[u.m.bp].key === 'twin' ? 2 : 1;
  const parts: string[] = [];
  let total = 0;
  for (let h = 0; h < hits && t.state === 'sheet'; h++) {
    const [s, dmg] = strike(u, t, pig, 1);
    parts.push(s);
    total += dmg;
  }
  const c = S.cells[idx(t.x, t.y)]!;
  if (total > 0 && (c.owner === 0 || c.owner === t.side)) {
    paintCell(c, u, pig, true);
    emit({ k: 'cells', how: 'splat', cells: [snap(idx(t.x, t.y))] });
  }
  let s = `splashed ${t.side === 1 ? 'your' : 'the rival'} ${t.name}, ${relWord(pig, t.m.main)} (${parts.join('; ')})`;
  if (t.hp <= 0) s += washOut(t);
  return s;
}
function washOut(t: Unit): string {
  if (t.state !== 'sheet') return '';
  count(`kill${t.side}`);
  t.state = 'gone';
  t.hp = 0;
  const i = idx(t.x, t.y);
  mudCell(S.cells[i]!);
  emit({ k: 'wash', id: t.id, cell: snap(i) });
  return `. ${t.name} washed out, its die is lost`;
}
export function soakAmount(u: Unit): number {
  const c = S.cells[idx(u.x, u.y)]!;
  let heal = c.owner === u.side ? (c.wet > 0 ? 6 : 3) : 1;
  if (GAIT[u.m.bp].key === 'root') heal *= 2;
  return Math.min(heal, u.max - u.hp);
}
function doSoak(u: Unit): string {
  const heal = soakAmount(u);
  setHp(u, u.hp + heal, 'soak');
  u.stain = 0;
  const team = teamOf(u);
  team.water = Math.min(WATER_MAX, team.water + 1);
  return `soaked: +${heal} opacity, +1 water, stains rinsed`;
}

/* ---------- Fähigkeiten ---------- */
export const abilityCost = (u: Unit) => (has(u, 'print') ? 1 : 2);
export function abilityTargets(u: Unit): number[] {
  const ab = ABILITY[u.m.bp];
  const out: number[] = [];
  if (ab.target === 'self') return [idx(u.x, u.y)];
  if (u.m.bp === 'schwebeblase') {
    for (let i = 0; i < COLS * ROWS; i++) if (cheb(u.x, u.y, i % COLS, Math.floor(i / COLS)) <= 3) out.push(i);
  } else if (u.m.bp === 'qualle') {
    S.cells.forEach((c, i) => {
      if (c.owner === u.side && !c.home && c.wet > 0 && !unitAt(i % COLS, Math.floor(i / COLS))) out.push(i);
    });
  } else if (u.m.bp === 'huepfer') {
    for (let i = 0; i < COLS * ROWS; i++) {
      const x = i % COLS,
        y = Math.floor(i / COLS);
      if (cheb(u.x, u.y, x, y) <= 4 && !unitAt(x, y) && S.cells[i]!.owner !== 3 && !S.cells[i]!.home) out.push(i);
    }
  } else if (u.m.bp === 'vierbeiner') {
    for (const t of onSheet(foeTeam(u))) if (chargeLanding(u, t) !== null) out.push(idx(t.x, t.y));
  } else if (u.m.bp === 'schlange' || u.m.bp === 'krabbe') {
    for (const t of onSheet(foeTeam(u))) if (cheb(u.x, u.y, t.x, t.y) <= 1) out.push(idx(t.x, t.y));
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
    if (unitAt(x, y) || S.cells[idx(x, y)]!.home) return null;
  }
  return idx(t.x - sx, t.y - sy);
}
export const abilityReady = (u: Unit) => teamOf(u).crests.glow >= abilityCost(u) && abilityTargets(u).length > 0;
/** Felder, die eine Fähigkeit betrifft (für den Effekt) */
function abilityArea(u: Unit, at: number): number[] {
  const out: number[] = [];
  const r = u.m.bp === 'flatterer' || u.m.bp === 'doppelkopf' ? 2 : u.m.bp === 'kriecher' ? 2 : u.m.bp === 'strahler' ? 1 : u.m.bp === 'schwebeblase' ? 1 : 0;
  const cx = u.m.bp === 'schwebeblase' ? at % COLS : u.x,
    cy = u.m.bp === 'schwebeblase' ? Math.floor(at / COLS) : u.y;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (inside(x, y)) out.push(idx(x, y));
  return out;
}

function doAbility(u: Unit, at: number): string {
  const ab = ABILITY[u.m.bp];
  teamOf(u).crests.glow -= abilityCost(u);
  emit({ k: 'ability', id: u.id, name: ab.name, bp: u.m.bp, at, area: abilityArea(u, at) });
  const foes = onSheet(foeTeam(u));
  const tAt = unitAt(at % COLS, Math.floor(at / COLS));
  const near = (r: number) => foes.filter((t) => cheb(u.x, u.y, t.x, t.y) <= r);
  let s = `used ${ab.name}`;
  const changed = (how: 'seep' | 'rain' | 'wet', list: number[]) => {
    if (list.length) emit({ k: 'cells', how, cells: list.map(snap) });
  };
  switch (u.m.bp) {
    case 'kriecher': {
      const list: number[] = [];
      const own = S.cells.map((c, i) => [c, i] as const).filter(([c, i]) => c.owner === u.side && !c.home && cheb(u.x, u.y, i % COLS, Math.floor(i / COLS)) <= 2);
      for (const [c, i] of own) {
        c.wet = WET_TURNS;
        list.push(i);
      }
      let n = 0;
      for (const [, i] of own) {
        const x = i % COLS,
          y = Math.floor(i / COLS);
        for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as P[]) {
          if (!inside(a, b)) continue;
          const c2 = S.cells[idx(a, b)]!;
          if (c2.owner === 0 && !c2.home) {
            paintCell(c2, u, u.m.main, true);
            c2.wet = 1;
            list.push(idx(a, b));
            n++;
          }
        }
      }
      changed('seep', list);
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
        if (inside(nx, ny) && !unitAt(nx, ny) && !S.cells[idx(nx, ny)]!.home) {
          t.x = nx;
          t.y = ny;
          emit({ k: 'pos', id: t.id, x: nx, y: ny, how: 'push' });
        }
        setHp(t, t.hp - 3, 'gust');
        parts.push(`${t.name} -3`);
        if (t.hp <= 0) parts.push(washOut(t).slice(2));
      }
      s += parts.length ? `: ${parts.join(', ')}` : ': nobody close';
      break;
    }
    case 'schwebeblase': {
      let soft = 0,
        mine = 0;
      const list: number[] = [];
      const tx = at % COLS,
        ty = Math.floor(at / COLS);
      for (let y = ty - 1; y <= ty + 1; y++)
        for (let x = tx - 1; x <= tx + 1; x++) {
          if (!inside(x, y)) continue;
          const c = S.cells[idx(x, y)]!;
          if (c.home) continue;
          if (c.owner === u.side) {
            c.wet = WET_TURNS;
            mine++;
            list.push(idx(x, y));
          } else if ((c.owner === 1 || c.owner === 2) && c.wet === 0) {
            c.wet = 1;
            soft++;
            list.push(idx(x, y));
          }
        }
      changed('rain', list);
      s += `: ${mine} of yours wet, ${soft} rival cells softened`;
      break;
    }
    case 'vierbeiner': {
      const land = chargeLanding(u, tAt!)!;
      u.x = land % COLS;
      u.y = Math.floor(land / COLS);
      emit({ k: 'pos', id: u.id, x: u.x, y: u.y, how: 'dash' });
      const [r, dmg] = strike(u, tAt!, u.m.main, 1.5, 4);
      s += ` into ${tAt!.name} (${r})`;
      if (dmg && tAt!.hp <= 0) s += washOut(tAt!);
      break;
    }
    case 'schlange': {
      setHp(tAt!, tAt!.hp - 4, 'coil');
      tAt!.stain = 2;
      tAt!.rooted = 1;
      s += ` on ${tAt!.name}: -4, stained, rooted`;
      if (tAt!.hp <= 0) s += washOut(tAt!);
      break;
    }
    case 'turm': {
      for (const a of onSheet(teamOf(u))) a.shield = 2;
      s += ': +5 on defence for the team, two rounds';
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
      emit({ k: 'pos', id: u.id, x: u.x, y: u.y, how: 'drift' });
      const hit = near(1);
      for (const t of hit) {
        t.stain = 2;
        setHp(t, t.hp - 2, 'drift');
        if (t.hp <= 0) washOut(t);
      }
      s += `: drifted, stained ${hit.length}`;
      break;
    }
    case 'huepfer': {
      u.x = at % COLS;
      u.y = Math.floor(at / COLS);
      emit({ k: 'pos', id: u.id, x: u.x, y: u.y, how: 'leap' });
      const r = applyPaint(u, u.m.main, false, stampCells(u, at));
      s += `: landed and took ${r.took}`;
      break;
    }
    case 'knolle': {
      let healed = 0;
      const list: number[] = [];
      for (const a of onSheet(teamOf(u))) {
        const h = Math.min(6, a.max - a.hp);
        setHp(a, a.hp + h, 'sprout');
        healed += h;
        paintCell(S.cells[idx(a.x, a.y)]!, a, a.m.main, true);
        list.push(idx(a.x, a.y));
      }
      changed('wet', list);
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
      ft.crests.glow = Math.max(0, ft.crests.glow - 1);
      const parts: string[] = [];
      for (const t of near(2)) {
        setHp(t, t.hp - 3, 'howl');
        parts.push(`${t.name} -3`);
        if (t.hp <= 0) parts.push(washOut(t).slice(2));
      }
      s += `: rival water -2, Glow -1${parts.length ? `, ${parts.join(', ')}` : ''}`;
      break;
    }
  }
  return s;
}

/* ---------- Ein Zug ---------- */
export function canAct(u: Unit, a: Action): boolean {
  const t = teamOf(u);
  if (u.acted || u.state !== 'sheet') return false;
  if (a === 'dry') return t.crests.brush > 0;
  if (a === 'wet') return t.crests.brush > 0 && t.water > 0;
  if (a === 'splash') return t.crests.splash > 0;
  if (a === 'ability') return t.crests.glow >= abilityCost(u);
  return true;
}
export function act(u: Unit, a: Action, pig: PigmentId, at: number | null): string {
  const t = teamOf(u);
  let s = '';
  if (a === 'dry' || a === 'wet') {
    t.crests.brush--;
    s = doPaint(u, pig, a === 'wet', at!);
  } else if (a === 'splash') {
    t.crests.splash--;
    s = doSplash(u, pig, at!);
  } else if (a === 'soak') s = doSoak(u);
  else if (a === 'ability') s = doAbility(u, at ?? idx(u.x, u.y));
  count(`${u.side}${a}`);
  u.acted = true;
  checkWipe();
  sync();
  return s;
}
export function startTurn(side: Side): void {
  S.turn = side;
  for (const u of S.teams[side - 1]!.units) {
    u.moved = u.rooted > 0;
    u.rooted = 0;
    u.acted = false;
  }
  emit({ k: 'turn', side });
  sync();
}
export function checkWipe(): boolean {
  if (S.over) return true;
  for (const t of S.teams) {
    if (living(t).length === 0) {
      S.over = true;
      S.winner = t.side === 1 ? 2 : 1;
      S.winReason = 'washed out';
      return true;
    }
  }
  return false;
}

/* Ende einer Runde */
export function endRound(): void {
  const r = RNG(S.gameSeed + S.round * 977);
  const spreads: [number, Cell][] = [];
  S.cells.forEach((c, i) => {
    if ((c.owner !== 1 && c.owner !== 2) || c.wet <= 0 || c.home) return;
    const u = S.teams[c.owner - 1]!.units.find((x) => x.m.main === c.hue || x.sec === c.hue);
    const flow = u ? u.flo : 20;
    if (r() < Math.min(0.85, flow / 40)) {
      const x = i % COLS,
        y = Math.floor(i / COLS);
      const n = ([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as P[]).filter(([a, b]) => inside(a, b) && S.cells[idx(a, b)]!.owner === 0 && !S.cells[idx(a, b)]!.home);
      if (n.length) {
        const [a, b] = n[Math.floor(r() * n.length)]!;
        spreads.push([idx(a, b), { ...c, wet: Math.max(0, c.wet - 1), stamp: ++S.stamp }]);
      }
    }
  });
  const bled: number[] = [];
  for (const [i, c] of spreads)
    if (S.cells[i]!.owner === 0) {
      S.cells[i] = c;
      bled.push(i);
    }
  if (bled.length) {
    emit({ k: 'cells', how: 'bleed', cells: bled.map(snap) });
    logAdd(`Wet paint bled into ${bled.length} more cell${bled.length > 1 ? 's' : ''}.`, 'muted');
  }
  const notes: string[] = [];
  for (const u of allUnits()) {
    const c = S.cells[idx(u.x, u.y)]!;
    let hp = u.hp;
    if (u.stain > 0) {
      hp -= 2;
      u.stain--;
      notes.push(`${u.name} is stained (-2)`);
    }
    if (has(u, 'fugitive')) hp -= 1;
    if (has(u, 'bloom0')) hp = Math.min(u.max, hp + 1);
    if (c.owner === u.side && c.wet > 0) hp = Math.min(u.max, hp + 1);
    if (c.owner !== 0 && c.owner !== u.side && c.owner !== 3 && c.wet > 0 && c.hue && relation(u.m.main, c.hue) === 'komplementaer') {
      hp -= 2;
      notes.push(`${u.name} stands in its complementary colour (-2)`);
    }
    setHp(u, hp, 'round');
    if (u.shield > 0) u.shield--;
    if (u.hp <= 0) notes.push(washOut(u).slice(2));
  }
  S.cells.forEach((c) => {
    if (c.wet > 0) c.wet--;
  });
  if (ERASER_ROUNDS.includes(S.round)) {
    const row = 2 + Math.floor(r() * (ROWS - 4));
    const gone: number[] = [];
    for (let x = 0; x < COLS; x++) {
      const c = S.cells[idx(x, row)]!;
      if (c.owner === 0 || c.home) continue;
      if (c.owner !== 3 && d20() + bonus(c.lf) >= 18) continue;
      S.cells[idx(x, row)] = emptyCell();
      gone.push(idx(x, row));
    }
    emit({ k: 'eraser', row, cells: gone.map(snap) });
    for (const u of allUnits())
      if (u.y === row && d20() + bonus(u.lf) < 18) {
        setHp(u, u.hp - 4, 'eraser');
        notes.push(`the Eraser grazed ${u.name} (-4)`);
        if (u.hp <= 0) notes.push(washOut(u).slice(2));
      }
    logAdd(`The Eraser passed through row ${row + 1}: ${gone.length} cells erased.`, 'eraser');
  }
  if (notes.length) logAdd(notes.join('. ') + '.', 'muted');
  S.teams.forEach((t) => (t.water = Math.min(WATER_MAX, t.water + 1)));
  S.round++;
  if (!checkWipe() && S.round > ROUNDS) finish();
  if (!S.over) emit({ k: 'round', round: S.round });
  sync();
}

export function counts(cells: Cell[] = S.cells): [number, number, number] {
  let a = 0,
    b = 0,
    m = 0;
  for (const c of cells) {
    if (c.home) continue;
    if (c.owner === 1) a++;
    else if (c.owner === 2) b++;
    else if (c.owner === 3) m++;
  }
  return [a, b, m];
}
export function scores(): [number, number] {
  const [a, b] = counts();
  return [a + HEART_BONUS * S.teams[0].hearts, b + HEART_BONUS * S.teams[1].hearts];
}
function finish(): void {
  S.over = true;
  const [a, b] = scores();
  S.winner = a > b ? 1 : a < b ? 2 : 0;
  S.winReason = 'the paper dried';
}

/* ---------- Gegner ---------- */
const CREST_COST: Record<Crest, number> = { step: 0.25, brush: 0.4, splash: 0.4, guard: 0, glow: 0.35 };
type Cand = { v: number; u: Unit; to: number; a: Action; pig: PigmentId; at: number | null };
function evalPaint(u: Unit, pig: PigmentId, wet: boolean, at: number): number {
  let v = 0;
  const list = stampCells(u, at);
  for (const i of list) {
    const c = S.cells[i]!;
    const o = outcome(u, pig, wet, c);
    if (o.kind === 'take') v += 1;
    else if (o.kind === 'mud') v += 1.2;
    else if (o.kind === 'contest' || o.kind === 'over') v += o.p * (c.owner === 3 ? 1 : 2);
  }
  if (wet) v += 0.3 * list.filter((i) => S.cells[i]!.owner === 0).length * (u.flo / 40) - 0.7;
  return v;
}
function danger(u: Unit, x: number, y: number): number {
  let d = 0;
  for (const e of onSheet(foeTeam(u))) if (cheb(e.x, e.y, x, y) <= 2) d += 0.12 * bonus(e.sat) * typeMult(e.m.main, u.m.main);
  return d;
}
const homeDist = (u: Unit, x: number, y: number) => {
  const h = foeTeam(u).home;
  return cheb(x, y, h % COLS, Math.floor(h / COLS));
};
function killBonus(t: Unit, dmg: number): number {
  return t.hp <= dmg ? 6 : 0;
}
function evalAbility(u: Unit, at: number): number {
  const foes = onSheet(foeTeam(u));
  const tAt = unitAt(at % COLS, Math.floor(at / COLS));
  const near = (r: number) => foes.filter((t) => cheb(u.x, u.y, t.x, t.y) <= r);
  switch (u.m.bp) {
    case 'kriecher':
      return S.cells.filter((c, i) => c.owner === u.side && !c.home && cheb(u.x, u.y, i % COLS, Math.floor(i / COLS)) <= 2).length * 0.6;
    case 'flatterer':
      return near(2).reduce((s, t) => s + 2.7 + killBonus(t, 3), 0);
    case 'schwebeblase': {
      let v = 0;
      const tx = at % COLS,
        ty = Math.floor(at / COLS);
      for (let y = ty - 1; y <= ty + 1; y++)
        for (let x = tx - 1; x <= tx + 1; x++) {
          if (!inside(x, y)) continue;
          const c = S.cells[idx(x, y)]!;
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
      return onSheet(teamOf(u)).filter((a) => danger(a, a.x, a.y) > 0.5).length * 2;
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
      return onSheet(teamOf(u)).reduce((s, a) => s + Math.min(6, a.max - a.hp) * 0.35, 0) + 0.5;
    case 'strahler':
      return near(1).reduce((s, t) => s + baseDamage(u, t, u.m.main, true) * 0.6 * 0.8, 0) + 3;
    case 'doppelkopf':
      return Math.min(2, foeTeam(u).water) * 0.8 + Math.min(1, foeTeam(u).crests.glow) * 0.8 + near(2).reduce((s, t) => s + 2.7 + killBonus(t, 3), 0);
  }
  return 0;
}
function pickBest<T extends { v: number }>(cands: T[], look: number, r: Rand, keep: (c: T) => boolean): T {
  let pool = cands;
  if (look > 0 && look < cands.length) {
    pool = cands.filter(keep);
    for (let k = 0; k < look; k++) pool.push(cands[Math.floor(r() * cands.length)]!);
  }
  let b = pool[0]!;
  for (const c of pool) if (c.v > b.v) b = c;
  return b;
}

/** Würfelwahl: Chance auf eine Beschwörung und erwartete Symbole */
const FACE_VALUE: Record<Crest, number> = { step: 0.7, brush: 1, splash: 0.8, guard: 0.4, glow: 0.6 };
export function aiChooseDice(t: Team, look: number, r: Rand): Unit[] {
  const pool = living(t);
  if (pool.length <= ROLL_N) return pool;
  const room = onSheet(t).length < ON_SHEET;
  const combos: { v: number; us: Unit[] }[] = [];
  for (let a = 0; a < pool.length; a++)
    for (let b = a + 1; b < pool.length; b++)
      for (let c = b + 1; c < pool.length; c++) {
        const us = [pool[a]!, pool[b]!, pool[c]!];
        let v = 0;
        for (const u of us) for (const f of u.faces) if (f.k !== 'star') v += (FACE_VALUE[f.k] * f.n) / 6;
        if (room && us.some((u) => u.state === 'bag')) {
          let p = 0,
            lvSum = 0;
          for (let i = 0; i < 216; i++) {
            const fs = [us[0]!.faces[i % 6]!, us[1]!.faces[Math.floor(i / 6) % 6]!, us[2]!.faces[Math.floor(i / 36)]!];
            let best = 0;
            us.forEach((u, k) => {
              const f = fs[k]!;
              if (f.k !== 'star' || u.state !== 'bag') return;
              const others = fs.reduce((s, g, j) => s + (j !== k && g.k === 'star' ? g.n : 0), 0);
              if (others >= u.lv) best = Math.max(best, u.lv);
            });
            if (best) {
              p++;
              lvSum += best;
            }
          }
          v += (p / 216) * 6 + (lvSum / 216) * 1.5;
        }
        combos.push({ v, us });
      }
  return pickBest(combos, look ? Math.max(1, Math.round(look / 5)) : 0, r, () => false).us;
}
function evalPlacement(u: Unit, list: number[], at: number): number {
  let v = u.lv * 1.5;
  for (const i of list) if (S.cells[i]!.owner === 0) v += 1;
  const x = at % COLS,
    y = Math.floor(at / COLS);
  v += 0.5 * (ROWS - homeDist(u, x, y)) - danger(u, x, y);
  return v;
}
function aiSummon(side: Side, rolled: Rolled[], look: number, r: Rand): string | null {
  const t = S.teams[side - 1]!;
  const cands: { v: number; u: Unit; o: number; at: number }[] = [];
  for (const u of summonable(t, rolled)) for (const p of placements(u)) cands.push({ v: evalPlacement(u, p.list, p.at), u, o: p.o, at: p.at });
  if (!cands.length) return null;
  const b = pickBest(cands, look, r, () => false);
  return doSummon(b.u, b.o, b.at);
}
export function aiOpening(side: Side, lvl: Level | number): void {
  const t = S.teams[side - 1]!;
  const r = RNG(S.gameSeed + side * 13);
  const cands: { v: number; u: Unit; o: number; at: number }[] = [];
  for (const u of t.units) for (const p of placements(u)) cands.push({ v: evalPlacement(u, p.list, p.at) + power(u) / 20, u, o: p.o, at: p.at });
  const b = pickBest(cands, typeof lvl === 'number' ? lvl : TUNE.look[lvl], r, () => false);
  const s = doSummon(b.u, b.o, b.at);
  b.u.moved = false;
  logAdd(`${side === 2 ? 'The rival' : 'You'} opened: ${s}.`, side === 2 ? 'rival' : 'you');
  sync();
}
/** Einen Klecks-Zug wählen (Bewegen und Handeln) und ausführen. Gibt false zurück, wenn nichts mehr lohnt. */
function aiAction(side: Side, look: number, r: Rand): boolean {
  const team = S.teams[side - 1]!;
  const cands: Cand[] = [];
  for (const u of onSheet(team)) {
    if (u.acted) continue;
    const prev = canMove(u) ? reach(u) : new Map([[idx(u.x, u.y), -1]]);
    const ox = u.x,
      oy = u.y;
    const pigs: PigmentId[] = u.sec ? [u.m.main, u.sec] : [u.m.main];
    const d0 = homeDist(u, ox, oy);
    for (const to of prev.keys()) {
      const moving = to !== idx(ox, oy);
      u.x = to % COLS;
      u.y = Math.floor(to / COLS);
      const cHere = S.cells[to]!;
      let pos = -danger(u, u.x, u.y) + 0.25 * (d0 - homeDist(u, u.x, u.y)) - (moving ? CREST_COST.step : 0);
      if (cHere.owner === side && cHere.wet > 0) pos += 0.4;
      const gait = GAIT[u.m.bp].key;
      if (moving && (gait === 'trail-dry' || gait === 'trail-wet')) pos += 0.3 * pathTo(prev, to).filter((i) => S.cells[i]!.owner === 0).length;
      const add = (v: number, a: Action, pig: PigmentId, at: number | null) => cands.push({ v: v + pos, u, to, a, pig, at });
      if (team.crests.brush > 0)
        for (let at = 0; at < COLS * ROWS; at++) {
          if (!canPaintAt(u, at)) continue;
          for (const pig of pigs) {
            add(evalPaint(u, pig, false, at) - CREST_COST.brush, 'dry', pig, at);
            if (team.water > 0) add(evalPaint(u, pig, true, at) - CREST_COST.brush, 'wet', pig, at);
          }
        }
      if (team.crests.splash > 0) {
        for (const t of splashTargets(u))
          for (const pig of pigs) {
            const hits = GAIT[u.m.bp].key === 'twin' ? 1.6 : 1;
            const dmg = baseDamage(u, t, pig, cheb(u.x, u.y, t.x, t.y) <= 1);
            add(splashOdds(u, t, pig) * hits * (dmg * 0.9 + killBonus(t, dmg * hits)) + (t.stain ? 0 : relation(pig, t.m.main) === 'komplementaer' ? 1 : 0) - CREST_COST.splash, 'splash', pig, idx(t.x, t.y));
          }
        if (touchesHome(u)) add(foeTeam(u).hearts <= 1 ? 100 : 8, 'splash', u.m.main, foeTeam(u).home);
      }
      if (u.hp < u.max || team.water < WATER_MAX) add(soakAmount(u) * 0.35 + (u.hp < u.max * 0.35 ? 2 : 0) + (team.water < WATER_MAX ? 0.3 : 0), 'soak', u.m.main, null);
      if (team.crests.glow >= abilityCost(u)) for (const at of abilityTargets(u)) add(evalAbility(u, at) - CREST_COST.glow * abilityCost(u), 'ability', u.m.main, at);
      if (moving) add(0, 'none', u.m.main, null);
    }
    u.x = ox;
    u.y = oy;
  }
  if (!cands.length) return false;
  const b = pickBest(cands, look, r, (c) => c.a === 'ability' || (c.a === 'splash' && c.at === foeTeam(c.u).home));
  if (b.v <= 0.05) return false;
  const prev = reach(b.u);
  const didMove = b.to !== idx(b.u.x, b.u.y);
  const moveNote = didMove ? doMove(b.u, b.to, prev) : '';
  let s = '';
  if (b.a === 'none') {
    b.u.acted = true;
    sync();
  } else s = act(b.u, b.a, b.pig, b.at);
  const lead = `${side === 2 ? 'Rival' : 'Your'} ${b.u.name}${didMove ? ' moved' : ''}${moveNote ? `, ${moveNote}` : ''}`;
  logAdd(`${lead}${s ? `${didMove ? ', then' : ''} ${s}` : ''}.`, side === 2 ? 'rival' : 'you');
  return true;
}
/** Ein ganzer Zug des Computers in Schritten: Würfeln, Beschwören, dann Aktionen. */
export function aiTurnSteps(side: Side, look: number): () => boolean {
  const team = S.teams[side - 1]!;
  const r = RNG(S.gameSeed + S.round * 31 + side * 7);
  let stage = 0,
    guard = 0;
  startTurn(side);
  return () => {
    if (S.over) return false;
    if (stage === 0) {
      const rolled = rollDice(team, aiChooseDice(team, look, r));
      stage = 1;
      const s = aiSummon(side, rolled, look, r);
      if (s) logAdd(`${side === 2 ? 'Rival' : 'You'} ${s}.`, side === 2 ? 'rival' : 'you');
      sync();
      return true;
    }
    if (guard++ > 8) return false;
    const ok = aiAction(side, look, r);
    if (!ok) return false;
    return !checkWipe();
  };
}

/** Viele Duelle ohne Darstellung, zum Abstimmen der Stufen */
export function simulate(p1: number, p2: Level, n: number): Record<string, unknown> {
  S.headless = true;
  const res = { p1: 0, p2: 0, draw: 0, palette: 0, wipes: 0 };
  S.tally = {};
  for (let g = 0; g < n; g++) {
    newGame(1000 + g * 7919, p2);
    aiOpening(2, p2);
    aiOpening(1, 'master');
    let guard = 0;
    while (!S.over && guard++ < 40) {
      for (const side of [1, 2] as Side[]) {
        const step = aiTurnSteps(side, side === 1 ? p1 : TUNE.look[p2]);
        while (step()) {
          /* weiter */
        }
        if (S.over || checkWipe()) break;
      }
      if (S.over) break;
      endRound();
    }
    if (S.winner === 1) res.p1++;
    else if (S.winner === 2) res.p2++;
    else res.draw++;
    if (S.winReason === 'palette broken') res.palette++;
    if (S.winReason === 'washed out') res.wipes++;
  }
  const per = Object.fromEntries(Object.entries(S.tally).map(([k, v]) => [k, +(v / n).toFixed(2)]));
  S.headless = false;
  return { ...res, per };
}
