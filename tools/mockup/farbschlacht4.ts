/*
 * Prototyp „Farbschlacht 4“: Fassung 3 plus Würfel nach dem Vorbild von Dungeon Dice Monsters.
 * Jeder Klecks ist ein Würfel mit eigenen Seiten (Sterne und Symbole aus seinen Werten).
 * Pro Zug drei Würfel werfen, Symbole sammeln und ausgeben, mit Sternen beschwören:
 * das Würfelnetz klappt als nasse Farbe auf das Blatt. Ziel: die Palette des Rivalen dreimal treffen,
 * sonst zählt beim Trocknen das Papier.
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
  HEARTS = 3,
  HEART_BONUS = 3,
  BAG = 6,
  ON_SHEET = 3,
  CREST_MAX = 9,
  ROLL_N = 3;
/** Sternseiten je Stufe (Index = Stufe) */
const STAR_FACES = [0, 3, 3, 2];
const START_CRESTS: Record<Crest, number> = { step: 2, brush: 1, splash: 0, guard: 0, glow: 0 };

type Side = 1 | 2;
type Level = 'apprentice' | 'journeyman' | 'master';
type Action = 'dry' | 'wet' | 'splash' | 'soak' | 'ability' | 'none';
type Crest = 'step' | 'brush' | 'splash' | 'guard' | 'glow';
type StatK = 'flo' | 'opa' | 'sat' | 'grn' | 'glw';
/** Eine Würfelseite: Stern mit Stufe oder Symbol mit Anzahl */
type Face = { k: 'star' | Crest; n: number };
type P = [number, number];
type Cell = { owner: 0 | 1 | 2 | 3; rgb: RGB; hue: PigmentId | null; wet: number; atk: number; def: number; lf: number; stamp: number; home: 0 | Side };
/** Ein Klecks ist zugleich sein Würfel */
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
type Trait = { key: string; label: string; text: string };
type Team = { side: Side; units: Unit[]; water: number; crests: Record<Crest, number>; hearts: number; home: number };
type Rolled = { u: Unit; face: Face };

const CRESTS: { k: Crest; label: string; stat: StatK; col: string; use: string }[] = [
  { k: 'step', label: 'Step', stat: 'flo', col: '#2e7a57', use: 'one move' },
  { k: 'brush', label: 'Brush', stat: 'opa', col: '#5b4a8a', use: 'one stamp' },
  { k: 'splash', label: 'Splash', stat: 'sat', col: '#c0482a', use: 'one splash' },
  { k: 'guard', label: 'Guard', stat: 'grn', col: '#5f6474', use: 'halves a hit by itself' },
  { k: 'glow', label: 'Glow', stat: 'glw', col: '#b8860b', use: 'two for an ability' },
];
const crestDef = (k: Crest) => CRESTS.find((c) => c.k === k)!;

/* Rivale: bedenkt nur eine Handvoll Züge (0 = alle), schwächere Kleckse, weniger Wasser */
const TUNE = {
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
const GAIT: Record<BlueprintId, { key: string; text: string }> = {
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
type Ability = { name: string; text: string; target: AbilityTarget };
const ABILITY: Record<BlueprintId, Ability> = {
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
  if (m.events.print) t.push({ key: 'print', label: 'Fingerprint', text: 'abilities cost 1 Glow' });
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
const power = (u: Unit) => u.sat + u.opa + u.grn + u.flo + u.glw;
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
let level: Level = 'apprentice';
let headless = false;
let dice: Rand = RNG(1);
let log: { t: string; c: string }[] = [];
let sepiaLine = '';
let lastRival: number[] = [];
let eraserRow = -1;
let tally: Record<string, number> = {};
const count = (k: string, n = 1) => {
  tally[k] = (tally[k] ?? 0) + n;
};

/* Auswahl des Spielers */
type Phase = 'opening' | 'roll' | 'summon' | 'act' | 'wait';
let phase: Phase = 'opening';
let chosen = new Set<number>();
let lastRoll: Rolled[] = [];
let rivalRoll: Rolled[] = [];
let rolling = 0;
let summonU: Unit | null = null,
  orient = 0,
  anchor: number | null = null;
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
const allUnits = () => [...teams[0].units, ...teams[1].units].filter((u) => u.state === 'sheet');
const onSheet = (t: Team) => t.units.filter((u) => u.state === 'sheet');
const unitAt = (x: number, y: number) => allUnits().find((u) => u.x === x && u.y === y) ?? null;
const teamOf = (u: Unit) => teams[u.side - 1]!;
const foeTeam = (u: Unit) => teams[u.side === 1 ? 1 : 0];
const d20 = () => 1 + Math.floor(dice() * 20);
const emptyCell = (): Cell => ({ owner: 0, rgb: PAPER, hue: null, wet: 0, atk: 0, def: 0, lf: 0, stamp: 0, home: 0 });
const logAdd = (t: string, c: string) => {
  if (!headless) log.unshift({ t, c });
};
const faceText = (f: Face) => (f.k === 'star' ? `★${f.n}` : `${crestDef(f.k).label}${f.n > 1 ? ' ×2' : ''}`);

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
  chosen = new Set();
  lastRoll = [];
  rivalRoll = [];
  summonU = null;
  orient = 0;
  anchor = null;
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
  teams = [
    { side: 1, units: mine.map((m) => unitOf(m, 1)), water: PLAYER_WATER, crests: { ...START_CRESTS }, hearts: HEARTS, home: homeOf(1) },
    { side: 2, units: theirs.map((m) => unitOf(m, 2)), water: TUNE.water[level], crests: { ...START_CRESTS }, hearts: HEARTS, home: homeOf(2) },
  ];
  for (const t of teams) {
    // Stufe nach Stärke im eigenen Beutel: je zwei Würfel Stufe 1, 2 und 3
    const sorted = [...t.units].sort((a, b) => power(a) - power(b));
    sorted.forEach((u, i) => (u.lv = 1 + Math.floor(i / 2)));
    for (const u of t.units) u.faces = makeFaces(u);
    // Palette und ein kleiner trockener Fleck darum
    const h = cells[t.home]!;
    h.home = t.side;
    h.owner = t.side;
    h.rgb = PIG[t.units[0]!.m.main].rgb;
    const hx = t.home % COLS,
      hy = Math.floor(t.home / COLS);
    for (const [x, y] of [[hx - 1, hy], [hx + 1, hy], [hx, hy + (t.side === 1 ? -1 : 1)]] as P[]) paintCell(cells[idx(x, y)]!, t.units[0]!, t.units[0]!.m.main, false);
  }
  for (const u of teams[1].units) {
    const k = TUNE.stat[level];
    u.hp = u.max = Math.round(u.max * TUNE.hp[level]);
    u.sat = Math.round(u.sat * k);
    u.opa = Math.round(u.opa * k);
    u.grn = Math.round(u.grn * k);
  }
  // Der Rivale klappt seinen ersten Klecks sofort auf, du wählst deinen selbst
  aiOpening(2, level);
  phase = 'opening';
  sepiaLine = 'Every blot is a die now. Roll, gather, unfold. And mind your palette.';
  if (!headless) {
    imgCache.clear();
    renderAll();
  }
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
  c.stamp = ++stamp;
}
function mudCell(c: Cell): void {
  if (c.home) return;
  c.owner = 3;
  c.rgb = MUD;
  c.hue = null;
  c.wet = 0;
  c.stamp = ++stamp;
}

/* ---------- Würfel ---------- */
function rollDice(t: Team, us: Unit[]): Rolled[] {
  const out = us.map((u) => ({ u, face: u.faces[Math.floor(dice() * 6)]! }));
  for (const r of out) if (r.face.k !== 'star') t.crests[r.face.k] = Math.min(CREST_MAX, t.crests[r.face.k] + r.face.n);
  count(`${t.side}roll`);
  return out;
}
/** Sterne der anderen Würfel müssen zusammen mindestens die Stufe des Kleckses ergeben */
function summonable(t: Team, rolled: Rolled[]): Unit[] {
  if (onSheet(t).length >= ON_SHEET) return [];
  return rolled
    .filter((r) => r.face.k === 'star' && r.u.state === 'bag')
    .filter((r) => rolled.filter((o) => o !== r && o.face.k === 'star').reduce((a, o) => a + o.face.n, 0) >= r.u.lv)
    .filter((r) => placements(r.u).length > 0)
    .map((r) => r.u);
}
const living = (t: Team) => t.units.filter((u) => u.state !== 'gone');

/* Würfelnetz: 8 Lagen (4 Drehungen, gespiegelt), Anker ist die Zelle mit den meisten Nachbarn */
function netCore(net: P[]): number {
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
function netAt(u: Unit, o: number, at: number): number[] | null {
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
function validNet(side: Side, list: number[]): boolean {
  let touch = false;
  for (const i of list) {
    const c = cells[i]!;
    if (c.home || (c.owner !== 0 && c.owner !== side) || unitAt(i % COLS, Math.floor(i / COLS))) return false;
    if (c.owner === side) touch = true;
    const x = i % COLS,
      y = Math.floor(i / COLS);
    for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as P[]) if (inside(a, b) && cells[idx(a, b)]!.owner === side) touch = true;
  }
  return touch;
}
function placements(u: Unit): { o: number; at: number; list: number[] }[] {
  const out: { o: number; at: number; list: number[] }[] = [];
  for (let o = 0; o < 8; o++)
    for (let at = 0; at < COLS * ROWS; at++) {
      const list = netAt(u, o, at);
      if (list && validNet(u.side, list)) out.push({ o, at, list });
    }
  return out;
}
function doSummon(u: Unit, o: number, at: number): string {
  const list = netAt(u, o, at)!;
  for (const i of list) paintCell(cells[i]!, u, u.m.main, true);
  u.state = 'sheet';
  u.x = at % COLS;
  u.y = Math.floor(at / COLS);
  u.hp = u.max;
  u.moved = true;
  u.acted = false;
  count(`${u.side}summon`);
  if (!headless) for (const i of list) flash.push({ i, t: performance.now() });
  return `unfolded ${u.name} (★${u.lv}): six cells of wet ${PIG[u.m.main].n}`;
}

/* ---------- Bewegen: nur durch Farbe ---------- */
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
        for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as P[]) {
          const nx = fx + dx,
            ny = fy + dy;
          if (!inside(nx, ny) || unitAt(nx, ny) || cells[idx(nx, ny)]!.home) continue;
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
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as P[]) {
      const nx = cx + dx,
        ny = cy + dy;
      if (!inside(nx, ny) || unitAt(nx, ny)) continue;
      const ni = idx(nx, ny);
      const c = cells[ni]!;
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
function doMove(u: Unit, to: number, prev: Map<number, number>): string {
  const path = pathTo(prev, to);
  u.x = to % COLS;
  u.y = Math.floor(to / COLS);
  u.moved = true;
  teamOf(u).crests.step--;
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
const canMove = (u: Unit) => !u.moved && teamOf(u).crests.step > 0 && moveRange(u) > 0;

/* ---------- Malen ---------- */
type Out = { kind: 'take' | 'refresh' | 'contest' | 'mud' | 'none' | 'over'; p: number };
function stampBonus(u: Unit, wet: boolean): number {
  return (wet && has(u, 'bloom1')) || (!wet && has(u, 'bloom2')) ? 2 : 0;
}
function outcome(u: Unit, pig: PigmentId, wet: boolean, c: Cell): Out {
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
      const a = d20(),
        d = d20();
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
  if (wet) teamOf(u).water--;
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
  return onSheet(foeTeam(u)).filter((t) => cheb(u.x, u.y, t.x, t.y) <= splashRange(u));
}
/** Zellen, die ein Spritzer treffen kann: gegnerische Kleckse in Reichweite und die gegnerische Palette, wenn man direkt daneben steht */
const touchesHome = (u: Unit, x = u.x, y = u.y) => {
  const h = foeTeam(u).home;
  return cheb(x, y, h % COLS, Math.floor(h / COLS)) <= 1;
};
function splashCells(u: Unit): number[] {
  const out = splashTargets(u).map((t) => idx(t.x, t.y));
  if (touchesHome(u)) out.push(foeTeam(u).home);
  return out;
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
/** Ein Treffer mit Würfeln. Ein Guard des Gegners halbiert den Schaden von selbst. */
function strike(u: Unit, t: Unit, pig: PigmentId, mult: number, plus = 0, ignoreGrain = false): [string, number] {
  if (dice() < dodgeOf(t)) return ['dodged', 0];
  const a = d20(),
    d = d20();
  const atk = bonus(u.sat) - (pig !== u.m.main ? 1 : 0) + plus,
    def = ignoreGrain ? 0 : bonus(grainOf(t));
  if (a + atk <= d + def) return [`d${a}+${atk} vs d${d}+${def}: miss`, 0];
  const crit = a === 20 || dice() < critOf(u);
  let dmg = Math.max(1, Math.round(baseDamage(u, t, pig, cheb(u.x, u.y, t.x, t.y) <= 1) * mult * (crit ? 1.5 : 1)));
  let guard = '';
  const ft = teamOf(t);
  if (ft.crests.guard > 0) {
    ft.crests.guard--;
    dmg = Math.ceil(dmg / 2);
    guard = ', guarded';
    count(`${t.side}guard`);
  }
  t.hp -= dmg;
  if (relation(pig, t.m.main) === 'komplementaer' || has(u, 'staining')) t.stain = 2;
  return [`d${a}+${atk} vs d${d}+${def}: ${crit ? 'crit' : 'hit'}${guard}, -${dmg}`, dmg];
}
function doSplash(u: Unit, pig: PigmentId, at: number): string {
  const ft = foeTeam(u);
  if (at === ft.home) {
    ft.hearts--;
    count(`${u.side}heart`);
    if (!headless) flash.push({ i: at, t: performance.now() });
    if (ft.hearts <= 0) {
      over = true;
      winner = u.side;
      winReason = 'palette broken';
    }
    sepiaLine = u.side === 1 ? 'A clean hit on their palette. They felt that.' : 'That was your palette. Three hearts, and I am counting.';
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
  const c = cells[idx(t.x, t.y)]!;
  if (total > 0 && (c.owner === 0 || c.owner === t.side)) paintCell(c, u, pig, true);
  if (!headless) flash.push({ i: idx(t.x, t.y), t: performance.now() });
  let s = `splashed ${t.side === 1 ? 'your' : 'the rival'} ${t.name}, ${relWord(pig, t.m.main)} (${parts.join('; ')})`;
  if (t.hp <= 0) s += washOut(t);
  return s;
}
function washOut(t: Unit): string {
  if (t.state !== 'sheet') return '';
  count(`kill${t.side}`);
  t.state = 'gone';
  t.hp = 0;
  mudCell(cells[idx(t.x, t.y)]!);
  return `. ${t.name} washed out, its die is lost`;
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
  const team = teamOf(u);
  team.water = Math.min(WATER_MAX, team.water + 1);
  return `soaked: +${heal} opacity, +1 water, stains rinsed`;
}

/* ---------- Fähigkeiten ---------- */
const abilityCost = (u: Unit) => (has(u, 'print') ? 1 : 2);
function abilityTargets(u: Unit): number[] {
  const ab = ABILITY[u.m.bp];
  const out: number[] = [];
  if (ab.target === 'self') return [idx(u.x, u.y)];
  if (u.m.bp === 'schwebeblase') {
    for (let i = 0; i < COLS * ROWS; i++) if (cheb(u.x, u.y, i % COLS, Math.floor(i / COLS)) <= 3) out.push(i);
  } else if (u.m.bp === 'qualle') {
    cells.forEach((c, i) => {
      if (c.owner === u.side && !c.home && c.wet > 0 && !unitAt(i % COLS, Math.floor(i / COLS))) out.push(i);
    });
  } else if (u.m.bp === 'huepfer') {
    for (let i = 0; i < COLS * ROWS; i++) {
      const x = i % COLS,
        y = Math.floor(i / COLS);
      if (cheb(u.x, u.y, x, y) <= 4 && !unitAt(x, y) && cells[i]!.owner !== 3 && !cells[i]!.home) out.push(i);
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
    if (unitAt(x, y) || cells[idx(x, y)]!.home) return null;
  }
  return idx(t.x - sx, t.y - sy);
}
const abilityReady = (u: Unit) => teamOf(u).crests.glow >= abilityCost(u) && abilityTargets(u).length > 0;

function doAbility(u: Unit, at: number): string {
  const ab = ABILITY[u.m.bp];
  teamOf(u).crests.glow -= abilityCost(u);
  const foes = onSheet(foeTeam(u));
  const tAt = unitAt(at % COLS, Math.floor(at / COLS));
  const near = (r: number) => foes.filter((t) => cheb(u.x, u.y, t.x, t.y) <= r);
  let s = `used ${ab.name}`;
  switch (u.m.bp) {
    case 'kriecher': {
      let n = 0;
      const own = cells.map((c, i) => [c, i] as const).filter(([c, i]) => c.owner === u.side && !c.home && cheb(u.x, u.y, i % COLS, Math.floor(i / COLS)) <= 2);
      for (const [c] of own) c.wet = WET_TURNS;
      for (const [, i] of own) {
        const x = i % COLS,
          y = Math.floor(i / COLS);
        for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as P[]) {
          if (!inside(a, b)) continue;
          const c2 = cells[idx(a, b)]!;
          if (c2.owner === 0 && !c2.home) {
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
        if (inside(nx, ny) && !unitAt(nx, ny) && !cells[idx(nx, ny)]!.home) {
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
          if (c.home) continue;
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
      for (const a of onSheet(teamOf(u))) {
        const h = Math.min(6, a.max - a.hp);
        a.hp += h;
        healed += h;
        paintCell(cells[idx(a.x, a.y)]!, a, a.m.main, true);
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
      ft.crests.glow = Math.max(0, ft.crests.glow - 1);
      const parts: string[] = [];
      for (const t of near(2)) {
        t.hp -= 3;
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
function canAct(u: Unit, a: Action): boolean {
  const t = teamOf(u);
  if (u.acted || u.state !== 'sheet') return false;
  if (a === 'dry') return t.crests.brush > 0;
  if (a === 'wet') return t.crests.brush > 0 && t.water > 0;
  if (a === 'splash') return t.crests.splash > 0;
  if (a === 'ability') return t.crests.glow >= abilityCost(u);
  return true;
}
function act(u: Unit, a: Action, pig: PigmentId, at: number | null): string {
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
  return s;
}
function startTurn(side: Side): void {
  for (const u of teams[side - 1]!.units) {
    u.moved = u.rooted > 0;
    u.rooted = 0;
    u.acted = false;
  }
}
function checkWipe(): boolean {
  if (over) return true;
  for (const t of teams) {
    if (living(t).length === 0) {
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
    if ((c.owner !== 1 && c.owner !== 2) || c.wet <= 0 || c.home) return;
    const u = teams[c.owner - 1]!.units.find((x) => x.m.main === c.hue || x.sec === c.hue);
    const flow = u ? u.flo : 20;
    if (r() < Math.min(0.85, flow / 40)) {
      const x = i % COLS,
        y = Math.floor(i / COLS);
      const n = ([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as P[]).filter(([a, b]) => inside(a, b) && cells[idx(a, b)]!.owner === 0 && !cells[idx(a, b)]!.home);
      if (n.length) {
        const [a, b] = n[Math.floor(r() * n.length)]!;
        spreads.push([idx(a, b), { ...c, wet: Math.max(0, c.wet - 1), stamp: ++stamp }]);
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
    if (c.owner === u.side && c.wet > 0) u.hp = Math.min(u.max, u.hp + 1);
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
    const row = 2 + Math.floor(r() * (ROWS - 4));
    let gone = 0;
    for (let x = 0; x < COLS; x++) {
      const c = cells[idx(x, row)]!;
      if (c.owner === 0 || c.home) continue;
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
    if (c.home) continue;
    if (c.owner === 1) a++;
    else if (c.owner === 2) b++;
    else if (c.owner === 3) m++;
  }
  return [a, b, m];
}
function scores(): [number, number] {
  const [a, b] = counts();
  return [a + HEART_BONUS * teams[0].hearts, b + HEART_BONUS * teams[1].hearts];
}
function finish(): void {
  over = true;
  const [a, b] = scores();
  winner = a > b ? 1 : a < b ? 2 : 0;
  winReason = 'the paper dried';
}

/* ---------- Gegner ---------- */
const CREST_COST: Record<Crest, number> = { step: 0.25, brush: 0.4, splash: 0.4, guard: 0, glow: 0.35 };
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
      return cells.filter((c, i) => c.owner === u.side && !c.home && cheb(u.x, u.y, i % COLS, Math.floor(i / COLS)) <= 2).length * 0.6;
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
function aiChooseDice(t: Team, look: number, r: Rand): Unit[] {
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
  for (const i of list) if (cells[i]!.owner === 0) v += 1;
  const x = at % COLS,
    y = Math.floor(at / COLS);
  v += 0.5 * (ROWS - homeDist(u, x, y)) - danger(u, x, y);
  return v;
}
function aiSummon(side: Side, rolled: Rolled[], look: number, r: Rand): string | null {
  const t = teams[side - 1]!;
  const cands: { v: number; u: Unit; o: number; at: number }[] = [];
  for (const u of summonable(t, rolled)) for (const p of placements(u)) cands.push({ v: evalPlacement(u, p.list, p.at), u, o: p.o, at: p.at });
  if (!cands.length) return null;
  const b = pickBest(cands, look, r, () => false);
  const s = doSummon(b.u, b.o, b.at);
  if (side === 2) lastRival = netAt(b.u, b.o, b.at)!;
  return s;
}
function aiOpening(side: Side, lvl: Level): void {
  const t = teams[side - 1]!;
  const r = RNG(gameSeed + side * 13);
  const cands: { v: number; u: Unit; o: number; at: number }[] = [];
  for (const u of t.units) for (const p of placements(u)) cands.push({ v: evalPlacement(u, p.list, p.at) + power(u) / 20, u, o: p.o, at: p.at });
  const b = pickBest(cands, TUNE.look[lvl], r, () => false);
  const s = doSummon(b.u, b.o, b.at);
  b.u.moved = false;
  logAdd(`${side === 2 ? 'The rival' : 'You'} opened: ${s}.`, side === 2 ? 'rival' : 'you');
}
/** Einen Klecks-Zug wählen (Bewegen und Handeln) und ausführen. Gibt false zurück, wenn nichts mehr lohnt. */
function aiAction(side: Side, look: number, r: Rand): boolean {
  const team = teams[side - 1]!;
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
      const cHere = cells[to]!;
      let pos = -danger(u, u.x, u.y) + 0.25 * (d0 - homeDist(u, u.x, u.y)) - (moving ? CREST_COST.step : 0);
      if (cHere.owner === side && cHere.wet > 0) pos += 0.4;
      const gait = GAIT[u.m.bp].key;
      if (moving && (gait === 'trail-dry' || gait === 'trail-wet')) pos += 0.3 * pathTo(prev, to).filter((i) => cells[i]!.owner === 0).length;
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
  if (b.a === 'none') b.u.acted = true;
  else s = act(b.u, b.a, b.pig, b.at);
  if (side === 2) lastRival = b.a === 'dry' || b.a === 'wet' ? stampCells(b.u, b.at!) : b.at !== null ? [b.at] : [idx(b.u.x, b.u.y)];
  const lead = `${side === 2 ? 'Rival' : 'Your'} ${b.u.name}${didMove ? ' moved' : ''}${moveNote ? `, ${moveNote}` : ''}`;
  logAdd(`${lead}${s ? `${didMove ? ', then' : ''} ${s}` : ''}.`, side === 2 ? 'rival' : 'you');
  return true;
}
/** Ein ganzer Zug des Computers in Schritten: Würfeln, Beschwören, dann Aktionen. */
function aiTurnSteps(side: Side, look: number): () => boolean {
  const team = teams[side - 1]!;
  const r = RNG(gameSeed + round * 31 + side * 7);
  let stage = 0,
    guard = 0;
  startTurn(side);
  return () => {
    if (over) return false;
    if (stage === 0) {
      const rolled = rollDice(team, aiChooseDice(team, look, r));
      if (side === 2) rivalRoll = rolled;
      stage = 1;
      const s = aiSummon(side, rolled, look, r);
      logAdd(`${side === 2 ? 'Rival' : 'You'} rolled ${rolled.map((x) => faceText(x.face)).join(', ')}${s ? `, then ${s}` : ''}.`, side === 2 ? 'rival' : 'you');
      return true;
    }
    if (guard++ > 8) return false;
    const ok = aiAction(side, look, r);
    if (!ok) return false;
    return !checkWipe();
  };
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
const placing = () => (phase === 'opening' || phase === 'summon') && summonU !== null;

function drawPalette(ctx: CanvasRenderingContext2D, t: Team): void {
  const x = (t.home % COLS) * cellPx + cellPx / 2,
    y = Math.floor(t.home / COLS) * cellPx + cellPx / 2;
  const col = t.side === 1 ? '43,63,163' : '163,58,58';
  ctx.save();
  ctx.fillStyle = 'rgba(255,253,248,1)';
  ctx.strokeStyle = `rgba(${col},.95)`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(x, y, cellPx * 0.44, cellPx * 0.36, -0.25, 0, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(228,225,216,1)';
  ctx.beginPath();
  ctx.arc(x + cellPx * 0.2, y + cellPx * 0.1, cellPx * 0.07, 0, 7);
  ctx.fill();
  for (let k = 0; k < HEARTS; k++) {
    const hx = x - cellPx * 0.22 + k * cellPx * 0.17,
      hy = y - cellPx * 0.08 + (k === 1 ? -cellPx * 0.06 : 0);
    heart(ctx, hx, hy, cellPx * 0.075, k < t.hearts ? `rgba(${col},1)` : 'rgba(180,175,165,.6)');
  }
  ctx.restore();
}
function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, col: string): void {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 1.2);
  ctx.bezierCurveTo(x - s * 2, y - s * 0.2, x - s * 0.9, y - s * 1.6, x, y - s * 0.5);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 1.6, x + s * 2, y - s * 0.2, x, y + s * 1.2);
  ctx.fill();
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
    if (c.owner === 0 || c.home) return;
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
    if (c.wet <= 0 || c.owner === 0 || c.home) return;
    const x = (i % COLS) * cellPx + cellPx / 2,
      y = Math.floor(i / COLS) * cellPx + cellPx / 2;
    const g = ctx.createRadialGradient(x - cellPx * 0.18, y - cellPx * 0.2, 1, x, y, cellPx * 0.5);
    g.addColorStop(0, `rgba(255,255,255,${0.3 + 0.1 * c.wet})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - cellPx / 2, y - cellPx / 2, cellPx, cellPx);
  });
  for (const t of teams) drawPalette(ctx, t);
  // Würfelnetz aufklappen: gültige Anker und Vorschau
  if (placing() && turn === 1 && !over) {
    const u = summonU!;
    ctx.fillStyle = 'rgba(43,63,163,.5)';
    for (let at = 0; at < COLS * ROWS; at++) {
      const list = netAt(u, orient, at);
      if (!list || !validNet(1, list) || at === anchor) continue;
      ctx.beginPath();
      ctx.arc((at % COLS) * cellPx + cellPx / 2, Math.floor(at / COLS) * cellPx + cellPx / 2, cellPx * 0.1, 0, 7);
      ctx.fill();
    }
    if (anchor !== null) {
      const list = netAt(u, orient, anchor);
      const ok = !!list && validNet(1, list);
      if (list) {
        ctx.fillStyle = ok ? `rgba(${PIG[u.m.main].rgb},.35)` : 'rgba(163,58,58,.18)';
        ctx.strokeStyle = ok ? 'rgba(43,63,163,.95)' : 'rgba(163,58,58,.9)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        list.forEach((i, k) => {
          const x = (i % COLS) * cellPx,
            y = Math.floor(i / COLS) * cellPx;
          ctx.fillRect(x + 3, y + 3, cellPx - 6, cellPx - 6);
          ctx.strokeRect(x + 3, y + 3, cellPx - 6, cellPx - 6);
          drawFaceIcon(ctx, u.faces[k]!, x + cellPx / 2, y + cellPx / 2, cellPx * 0.36);
        });
        ctx.setLineDash([]);
      }
    }
  }
  if (sel && !over && turn === 1 && phase === 'act') {
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
      for (const i of splashCells(sel)) ring(ctx, i % COLS, Math.floor(i / COLS), 'rgba(163,58,58,.9)');
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
  if (sel && target !== null && !over && phase === 'act' && (action === 'dry' || action === 'wet')) {
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
    // Schon gehandelt in diesem Zug: kleiner Haken
    if (u.side === 1 && turn === 1 && phase === 'act' && u.acted) {
      const dx = u.x * cellPx + cellPx * 0.16,
        dy = u.y * cellPx + cellPx * 0.16;
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

/* ---------- Symbole ---------- */
const ICON_PATH: Record<'star' | Crest, string> = {
  step: '<path d="M4 4.5l5.5 5.5-5.5 5.5M10.5 4.5l5.5 5.5-5.5 5.5" fill="none" stroke="C" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  brush: '<path d="M14.2 2.6l3.2 3.2-7.4 7.4-3.2-3.2z" fill="C"/><path d="M6 11.2c-2.4.4-3 2.2-3 3.6 0 1.1-.6 1.6-1.2 1.7 2.4 1.3 6 .6 6.6-2.1z" fill="C"/>',
  splash: '<path d="M10 2.5c3.1 4.2 4.7 6.6 4.7 8.8a4.7 4.7 0 0 1-9.4 0c0-2.2 1.6-4.6 4.7-8.8z" fill="C"/><circle cx="3.4" cy="6.2" r="1.4" fill="C"/><circle cx="16.8" cy="4.8" r="1.2" fill="C"/>',
  guard: '<path d="M10 2.2l6.3 2.4v4.8c0 4.1-2.7 7-6.3 8.5-3.6-1.5-6.3-4.4-6.3-8.5V4.6z" fill="C"/>',
  glow: '<path d="M10 1.2l2.1 6.7 6.7 2.1-6.7 2.1-2.1 6.7-2.1-6.7-6.7-2.1 6.7-2.1z" fill="C"/>',
  star: '<path d="M10 1.4l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="C"/>',
};
const STAR_COL = '#2b3fa3';
function iconSvg(f: Face, px: number): string {
  const col = f.k === 'star' ? STAR_COL : crestDef(f.k).col;
  let inner = ICON_PATH[f.k].replace(/"C"/g, `"${col}"`);
  if (f.k === 'star') inner += `<text x="10" y="13.3" font-size="7.4" text-anchor="middle" fill="#fff" font-family="JetBrains Mono, monospace" font-weight="700">${f.n}</text>`;
  else if (f.n > 1) inner += `<circle cx="16" cy="16" r="4" fill="#fff" stroke="${col}" stroke-width="1"/><text x="16" y="18.4" font-size="6.4" text-anchor="middle" fill="${col}" font-family="JetBrains Mono, monospace" font-weight="700">2</text>`;
  return `<svg width="${px}" height="${px}" viewBox="0 0 20 20" aria-hidden="true">${inner}</svg>`;
}
const iconImg = new Map<string, HTMLImageElement>();
function drawFaceIcon(ctx: CanvasRenderingContext2D, f: Face, x: number, y: number, s: number): void {
  const key = f.k + f.n;
  let img = iconImg.get(key);
  if (!img) {
    img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg(f, 40).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    img.onload = () => drawBoard();
    iconImg.set(key, img);
  }
  if (img.complete) ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
}
function netSvg(u: Unit, cell: number): string {
  const xs = u.net.map((p) => p[0]),
    ys = u.net.map((p) => p[1]);
  const w = (Math.max(...xs) + 1) * cell,
    h = (Math.max(...ys) + 1) * cell;
  const parts = u.net.map(([x, y], k) => {
    const f = u.faces[k]!;
    return `<rect x="${x * cell + 0.5}" y="${y * cell + 0.5}" width="${cell - 1}" height="${cell - 1}" rx="2" fill="#fffdf8" stroke="#cfcabd"/><g transform="translate(${x * cell + 2},${y * cell + 2}) scale(${(cell - 4) / 20})">${iconSvg(f, 20).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`;
  });
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${parts.join('')}</svg>`;
}

/* ---------- Oberfläche ---------- */
const $ = (id: string) => document.getElementById(id)!;
function el(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
function html(tag: string, cls: string, inner: string): HTMLElement {
  const e = el(tag, cls);
  e.innerHTML = inner;
  return e;
}
function patternIcon(p: P[]): HTMLElement {
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
  pc.style.opacity = u.state === 'gone' ? '0.25' : u.state === 'bag' ? '0.9' : String(0.3 + 0.7 * Math.max(0, u.hp / u.max));
  return pc;
}
function crestRow(e: HTMLElement, t: Team, small: boolean): void {
  e.replaceChildren();
  for (const c of CRESTS) {
    const n = t.crests[c.k];
    const s = html('span', 'crest' + (n ? '' : ' zero'), iconSvg({ k: c.k, n: 1 }, small ? 14 : 20) + `<b>${n}</b>`);
    s.title = `${c.label}: ${c.use}`;
    e.append(s);
  }
}
function hearts(e: HTMLElement, n: number): void {
  e.replaceChildren();
  for (let k = 0; k < HEARTS; k++) e.append(el('i', k < n ? 'on' : '', '♥'));
}

function renderDice(): void {
  const box = $('dice');
  box.replaceChildren();
  const t = teams[0];
  for (const u of t.units) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const pickable =
      (phase === 'roll' && u.state !== 'gone' && turn === 1) || (phase === 'opening' && u.state === 'bag') || (phase === 'act' && u.state === 'sheet' && !u.acted && turn === 1);
    btn.className = `die ${u.state}` + (chosen.has(u.id) && phase === 'roll' ? ' chosen' : '') + (sel === u || summonU === u ? ' sel' : '') + (u.acted && phase === 'act' ? ' done' : '');
    btn.disabled = over || !pickable;
    const top = el('div', 'dt');
    top.append(portrait(u, 34), patternIcon(u.pattern));
    const lvl = html('span', 'lv', `${iconSvg({ k: 'star', n: u.lv }, 14)}<b>Lv ${u.lv}</b> · ${u.state === 'bag' ? 'bag' : u.state === 'sheet' ? 'sheet' : 'lost'}`);
    const net = html('div', 'net', netSvg(u, 15));
    btn.append(top, el('b', 'un', u.name), lvl, net);
    if (u.state === 'sheet') {
      const hp = el('div', 'hpline');
      hp.append(bar('you', u.hp / u.max), document.createTextNode(` ${Math.max(0, u.hp)}/${u.max}`));
      btn.append(hp);
    }
    const ab = ABILITY[u.m.bp];
    const abl = el('div', 'abl');
    abl.append(el('b', '', ab.name), html('span', 'cost', iconSvg({ k: 'glow', n: 1 }, 12).repeat(abilityCost(u))));
    const tr = el('div', 'trs');
    for (const x of u.traits) {
      const c = el('span', 'tr', x.label);
      c.title = x.text;
      tr.append(c);
    }
    btn.append(abl, el('div', 'us', `SAT ${u.sat} GRN ${u.grn} FLO ${u.flo}`), tr, el('small', '', u.state === 'gone' ? 'its die is lost' : u.acted && phase === 'act' ? 'done this turn' : GAIT[u.m.bp].text));
    btn.addEventListener('click', () => tapDie(u));
    box.append(btn);
  }
  const rv = $('rival');
  rv.replaceChildren();
  teams[1].units.forEach((u) => {
    const d = el('div', `ru ${u.state}`);
    d.title = unitInfo(u);
    d.append(portrait(u, 30), html('small', '', `${iconSvg({ k: 'star', n: u.lv }, 11)}`));
    if (u.state === 'sheet') d.append(bar('rival', u.hp / u.max));
    d.addEventListener('click', () => {
      inspect = u;
      renderHud();
    });
    rv.append(d);
  });
}

function renderRolled(): void {
  const box = $('rolled');
  box.replaceChildren();
  const roll = turn === 1 ? lastRoll : rivalRoll;
  if (!roll.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.append(el('span', 'rl', turn === 1 ? 'Your roll' : 'Rival roll'));
  const can = phase === 'summon' && turn === 1 ? summonable(teams[0], lastRoll) : [];
  for (const r of roll) {
    const b = document.createElement('button');
    b.type = 'button';
    const f = rolling > 0 ? r.u.faces[Math.floor(Math.random() * 6)]! : r.face;
    b.className = 'rd' + (can.includes(r.u) ? ' can' : '') + (summonU === r.u ? ' sel' : '');
    b.disabled = !can.includes(r.u);
    const pc = portrait(r.u, 22);
    b.append(html('span', 'rf', iconSvg(f, 30)), pc, el('small', '', rolling > 0 ? '…' : faceText(f)));
    b.addEventListener('click', () => {
      summonU = r.u;
      orient = 0;
      anchor = null;
      renderAll();
    });
    box.append(b);
  }
}

function renderHud(): void {
  const [a, b, m] = counts();
  const [sa, sb] = scores();
  $('score-you').textContent = String(sa);
  $('score-rival').textContent = String(sb);
  $('score-mud').textContent = String(m);
  const tot = COLS * ROWS - 2;
  ($('bar-you') as HTMLElement).style.width = (a / tot) * 100 + '%';
  ($('bar-mud') as HTMLElement).style.width = (m / tot) * 100 + '%';
  ($('bar-rival') as HTMLElement).style.width = (b / tot) * 100 + '%';
  $('round').textContent = over ? 'Done' : `Round ${round} / ${ROUNDS}`;
  const left = ROUNDS - round + 1;
  $('dries').textContent = over ? winReason : ERASER_ROUNDS.includes(round) ? 'Eraser comes next' : left === 1 ? 'last round' : `dries in ${left}`;
  drops($('water'), teams[0].water);
  drops($('rival-water'), teams[1].water);
  hearts($('hearts'), teams[0].hearts);
  hearts($('rival-hearts'), teams[1].hearts);
  crestRow($('crests'), teams[0], false);
  crestRow($('rival-crests'), teams[1], true);
  for (const lv of ['apprentice', 'journeyman', 'master'] as Level[]) $('lv-' + lv).setAttribute('aria-pressed', String(level === lv));
  renderRolled();
  // Farbe wählen
  const pc = $('pigs');
  pc.replaceChildren();
  pc.hidden = !(phase === 'act' && sel && sel.sec && moved && action !== 'soak' && action !== 'ability');
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
  const t = teams[0];
  $('acts').hidden = phase !== 'act';
  const acts: Action[] = ['dry', 'wet', 'splash', 'soak', 'ability'];
  for (const a2 of acts) {
    const btn = $('act-' + a2) as HTMLButtonElement;
    btn.setAttribute('aria-pressed', String(action === a2));
    btn.disabled = !sel || over || turn !== 1 || !canAct(sel, a2) || (a2 === 'splash' && moved && splashCells(sel).length === 0) || (a2 === 'ability' && abilityTargets(sel).length === 0);
  }
  const abBtn = $('act-ability');
  if (sel) abBtn.replaceChildren(el('b', '', ABILITY[sel.m.bp].name), el('small', '', `${abilityCost(sel)} Glow`));
  else abBtn.replaceChildren(el('b', '', 'Ability'), el('small', '', '2 Glow'));
  const info = $('preview');
  const go = $('go') as HTMLButtonElement;
  const aux = $('aux') as HTMLButtonElement;
  const end = $('end') as HTMLButtonElement;
  go.disabled = true;
  aux.hidden = true;
  end.hidden = true;
  const title = $('phase');
  if (over) {
    title.textContent = 'Duel over';
    info.textContent = '';
    go.textContent = 'New duel';
    go.disabled = false;
  } else if (phase === 'wait' && turn === 1) {
    title.textContent = 'Rolling';
    info.textContent = 'The dice are tumbling…';
    go.textContent = 'Wait';
  } else if (turn !== 1) {
    title.textContent = 'Rival turn';
    info.textContent = 'The rival is rolling and painting…';
    go.textContent = 'Wait';
  } else if (phase === 'opening' || phase === 'summon') {
    title.textContent = phase === 'opening' ? 'Opening: unfold your first blot' : 'Summon';
    if (!summonU) {
      info.textContent =
        phase === 'opening'
          ? 'Pick one of your dice below. Its net unfolds as wet paint next to your palette.'
          : `The stars add up. Tap a glowing die to unfold that blot, or skip. A blot needs other stars worth at least its own level.`;
      go.textContent = 'Pick a die';
    } else {
      aux.hidden = false;
      aux.textContent = 'Turn net';
      const list = anchor !== null ? netAt(summonU, orient, anchor) : null;
      const ok = !!list && validNet(1, list);
      info.textContent = anchor === null ? `${summonU.name}: tap a blue dot where the blot should stand. The net must touch your paint.` : ok ? `Unfold ${summonU.name} here? Six cells of wet paint.` : 'It does not fit there: only on bare paper or your own paint, touching your paint.';
      go.textContent = 'Unfold';
      go.disabled = !ok;
    }
    if (phase === 'summon') {
      end.hidden = false;
      end.textContent = 'Skip';
    }
  } else if (phase === 'roll') {
    title.textContent = 'Roll';
    const need = Math.min(ROLL_N, living(t).length);
    info.textContent = inspect ? unitInfo(inspect) : `Pick ${need} dice below (${chosen.size} picked). Stars summon, symbols go to your pool. Dice of blots already on the sheet roll too.`;
    go.textContent = `Roll ${need} dice`;
    go.disabled = chosen.size !== need;
  } else {
    title.textContent = 'Your turn';
    end.hidden = false;
    end.textContent = 'End turn';
    if (!sel) {
      info.textContent = inspect ? unitInfo(inspect) : onSheet(t).some((u) => !u.acted) ? 'Tap a blot. Each blot moves once (1 Step) and acts once. Soak is free.' : 'All blots are done. End your turn.';
      go.textContent = 'Pick a blot';
    } else if (!moved) {
      const how = !canMove(sel) ? `${sel.rooted ? 'Rooted. ' : ''}${sel.moved ? 'It already moved' : GAIT[sel.m.bp].key === 'tower' ? 'Towers never move' : 'No Step left'}. Tap it again to act.` : 'Move: tap a green dot (1 Step). Blots only travel through paint. Or tap the blot again to stay.';
      const tr = sel.traits.map((x) => `${x.label}: ${x.text}`).join(' · ');
      info.textContent = inspect ? unitInfo(inspect) : how + (tr ? ` ${tr}.` : '');
      go.textContent = 'Stay here';
      go.disabled = false;
    } else if (action === 'soak') {
      info.textContent = `Soak here: +${soakAmount(sel)} opacity, +1 water. Free, best on your own wet paint.`;
      go.textContent = 'Soak';
      go.disabled = false;
    } else if (action === 'ability') {
      const ab = ABILITY[sel.m.bp];
      if (!canAct(sel, 'ability')) info.textContent = `${ab.name}: ${ab.text} Needs ${abilityCost(sel)} Glow.`;
      else if (ab.target === 'self') {
        info.textContent = `${ab.name}: ${ab.text}`;
        go.textContent = ab.name;
        go.disabled = abilityTargets(sel).length === 0;
      } else if (target !== null && abilityTargets(sel).includes(target)) {
        const tg = unitAt(target % COLS, Math.floor(target / COLS));
        let extra = '';
        if (tg && sel.m.bp === 'vierbeiner') extra = ` ${Math.round(splashOdds(sel, tg, sel.m.main, 4) * 100)}% to hit, -${Math.round(baseDamage(sel, tg, sel.m.main, true) * 1.5)}.`;
        if (tg && sel.m.bp === 'krabbe') extra = ` ${Math.round(splashOdds(sel, tg, sel.m.main, 0, true) * 100)}% to hit, -${baseDamage(sel, tg, sel.m.main, true) * 2}.`;
        info.textContent = `${ab.name}: ${ab.text}${extra}`;
        go.textContent = ab.name;
        go.disabled = false;
      } else info.textContent = `${ab.name}: ${ab.text} Tap a gold target.`;
    } else if (action === 'splash') {
      const pig = curPig(sel);
      const h = teams[1].home;
      if (target === h && splashCells(sel).includes(h)) {
        info.textContent = `Splash the rival palette: always hits, one heart. ${teams[1].hearts} left.`;
        go.textContent = 'Splash';
        go.disabled = false;
      } else {
        const tg = target !== null ? unitAt(target % COLS, Math.floor(target / COLS)) : null;
        if (tg && tg.side === 2 && splashTargets(sel).includes(tg)) {
          const p = Math.round(splashOdds(sel, tg, pig) * 100);
          const dmg = baseDamage(sel, tg, pig, cheb(sel.x, sel.y, tg.x, tg.y) <= 1);
          info.textContent = `Splash ${tg.name}: ${p}% to hit, -${dmg}${GAIT[sel.m.bp].key === 'twin' ? ' twice' : ''}, ${relWord(pig, tg.m.main)}${relation(pig, tg.m.main) === 'komplementaer' || has(sel, 'staining') ? ', stains' : ''}${teams[1].crests.guard ? '. The rival has Guard: half damage' : ''}.`;
          go.textContent = 'Splash';
          go.disabled = false;
        } else info.textContent = `Tap a circled rival or their palette in reach (${splashRange(sel)}). Standing on your wet paint adds 1.`;
      }
    } else {
      if (target === null) info.textContent = `Tap the paper within ${paintRange(sel)} cells to aim the stamp (1 Brush${action === 'wet' ? ', 1 water' : ''}).`;
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
  }
  const l = $('log');
  l.replaceChildren();
  for (const e of log.slice(0, 6)) l.append(el('li', e.c, e.t));
  $('sepia').textContent = sepiaLine;
  $('result').hidden = !over;
  if (over) {
    const [x, y] = scores();
    $('result-title').textContent = winner === 1 ? 'You win the sheet' : winner === 2 ? 'The rival wins the sheet' : 'A draw';
    $('result-sub').textContent =
      winReason === 'palette broken'
        ? winner === 1
          ? 'Their palette is broken.'
          : 'Your palette is broken.'
        : winReason === 'washed out'
          ? winner === 1
            ? 'Every rival die is lost.'
            : 'All your dice are lost.'
          : `Paper dried: ${x} to ${y} (cells plus ${HEART_BONUS} per heart left).`;
  }
}
function unitInfo(u: Unit): string {
  const ab = ABILITY[u.m.bp];
  const tr = u.traits.map((t) => `${t.label} (${t.text})`).join(', ');
  return `${u.side === 2 ? 'Rival ' : ''}${u.name}, ★${u.lv}, ${u.state === 'bag' ? 'in the bag' : u.state === 'gone' ? 'washed out' : `${Math.max(0, u.hp)}/${u.max}`}. Die: ${u.faces.map(faceText).join(', ')}. ${GAIT[u.m.bp].text}. ${ab.name} (${abilityCost(u)} Glow): ${ab.text}${tr ? ` Traits: ${tr}.` : ''}`;
}
function renderAll(): void {
  if (headless) return;
  renderDice();
  renderHud();
  drawBoard();
}

/** Vorauswahl zum Würfeln: erst Würfel aus dem Beutel, dann die vom Blatt */
function defaultPick(): Set<number> {
  const l = living(teams[0]);
  return new Set([...l.filter((u) => u.state === 'bag'), ...l.filter((u) => u.state === 'sheet')].slice(0, ROLL_N).map((u) => u.id));
}
function tapDie(u: Unit): void {
  if (over || turn !== 1) return;
  if (phase === 'roll') {
    if (u.state === 'gone') return;
    if (chosen.has(u.id)) chosen.delete(u.id);
    else if (chosen.size < Math.min(ROLL_N, living(teams[0]).length)) chosen.add(u.id);
    inspect = null;
    renderAll();
  } else if (phase === 'opening') {
    if (u.state !== 'bag') return;
    summonU = u;
    orient = 0;
    anchor = null;
    renderAll();
  } else if (phase === 'act') selectUnit(u);
}
function selectUnit(u: Unit): void {
  if (over || turn !== 1 || u.state !== 'sheet' || u.side !== 1 || u.acted) return;
  if (moved && sel !== u) return;
  if (sel !== u) useSec = false;
  sel = u;
  target = null;
  inspect = null;
  if (!canAct(u, action)) action = canAct(u, 'dry') ? 'dry' : 'soak';
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
  if (placing()) {
    const list = netAt(summonU!, orient, i);
    if (list && validNet(1, list)) {
      if (anchor === i) return unfold();
      anchor = i;
    }
    renderHud();
    drawBoard();
    return;
  }
  if (phase !== 'act') {
    if (u) {
      inspect = inspect === u ? null : u;
      renderHud();
    }
    return;
  }
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
    if (!canMove(sel)) return;
    const prev = reach(sel);
    if (!u && prev.has(i)) {
      const note = doMove(sel, i, prev);
      moved = true;
      logAdd(`Your ${sel.name} moved${note ? ` and ${note}` : ''}.`, 'you');
      renderAll();
    }
    return;
  }
  if (action === 'splash') {
    if (splashCells(sel).includes(i)) {
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

function unfold(): void {
  if (!summonU || anchor === null) return;
  const list = netAt(summonU, orient, anchor);
  if (!list || !validNet(1, list)) return;
  const s = doSummon(summonU, orient, anchor);
  logAdd(`You ${s}.`, 'you');
  if (phase === 'opening') {
    summonU.moved = false;
    summonU = null;
    anchor = null;
    phase = 'roll';
    startTurn(1);
    chosen = defaultPick();
  } else {
    summonU = null;
    anchor = null;
    phase = 'act';
  }
  renderAll();
}
function doRoll(): void {
  const t = teams[0];
  const us = t.units.filter((u) => chosen.has(u.id));
  lastRoll = rollDice(t, us);
  chosen = new Set();
  logAdd(`You rolled ${lastRoll.map((r) => faceText(r.face)).join(', ')}.`, 'you');
  rolling = 1;
  phase = 'wait';
  renderAll();
  const t0 = performance.now();
  const spin = () => {
    if (performance.now() - t0 < 550) {
      renderRolled();
      window.setTimeout(spin, 70);
      return;
    }
    rolling = 0;
    phase = summonable(t, lastRoll).length ? 'summon' : 'act';
    summonU = null;
    anchor = null;
    if (phase === 'summon') sepiaLine = 'The stars line up. Unfold something worth the paper.';
    renderAll();
  };
  spin();
}

function commit(): void {
  if (!sel || over || turn !== 1 || phase !== 'act') return;
  if (action === 'ability') {
    if (!canAct(sel, 'ability')) return;
    if (ABILITY[sel.m.bp].target !== 'self' && target === null) return;
  } else if ((action === 'dry' || action === 'wet' || action === 'splash') && target === null) return;
  if (!canAct(sel, action)) return;
  eraserRow = -1;
  const s = act(sel, action, curPig(sel), target);
  logAdd(`Your ${sel.name} ${s}.`, 'you');
  sel = null;
  moved = false;
  target = null;
  inspect = null;
  useSec = false;
  if (checkWipe()) return renderAll();
  renderAll();
}
function endTurn(): void {
  if (over || turn !== 1 || phase !== 'act' && phase !== 'summon') return;
  sel = null;
  moved = false;
  target = null;
  summonU = null;
  anchor = null;
  turn = 2;
  phase = 'wait';
  lastRival = [];
  renderAll();
  const step = aiTurnSteps(2, TUNE.look[level]);
  const next = () => {
    const more = step();
    renderAll();
    if (more && !over) {
      window.setTimeout(next, 650);
      return;
    }
    if (!over) endRound();
    turn = 1;
    if (!over) {
      startTurn(1);
      phase = 'roll';
      lastRoll = [];
      chosen = defaultPick();
    }
    renderAll();
  };
  window.setTimeout(next, 500);
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
  if (turn !== 1) return;
  if (placing()) return unfold();
  if (phase === 'roll') return doRoll();
  if (phase !== 'act') return;
  if (sel && !moved) {
    moved = true;
    renderAll();
    return;
  }
  commit();
});
$('aux').addEventListener('click', () => {
  if (!placing()) return;
  orient = (orient + 1) % 8;
  if (anchor !== null && !netAt(summonU!, orient, anchor)) anchor = null;
  renderHud();
  drawBoard();
});
$('end').addEventListener('click', () => {
  if (phase === 'summon') {
    summonU = null;
    anchor = null;
    phase = 'act';
    renderAll();
    return;
  }
  endTurn();
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
  state: () => ({
    round,
    over,
    winner,
    turn,
    phase,
    crests: { ...teams[0].crests },
    water: teams[0].water,
    hearts: [teams[0].hearts, teams[1].hearts],
    summonable: phase === 'summon' ? summonable(teams[0], lastRoll).map((u) => u.id) : [],
    dice: teams[0].units.map((u) => ({ id: u.id, name: u.name, state: u.state, lv: u.lv })),
    units: allUnits().map((u) => ({ id: u.id, side: u.side, x: u.x, y: u.y, hp: u.hp, name: u.name, acted: u.acted, moved: u.moved, reach: splashRange(u), canAbility: abilityReady(u), abT: abilityTargets(u), abSelf: ABILITY[u.m.bp].target === 'self', splash: splashCells(u), canMove: canMove(u) })),
    place: summonU ? placements(summonU).slice(0, 1) : [],
    score: scores(),
  }),
  sim: (p1: number, p2: Level, n: number) => {
    const keep = level;
    headless = true;
    const res = { p1: 0, p2: 0, draw: 0, palette: 0, wipes: 0 };
    tally = {};
    for (let g = 0; g < n; g++) {
      level = p2;
      newGame(1000 + g * 7919);
      aiOpening(1, 'master');
      let guard = 0;
      while (!over && guard++ < 40) {
        for (const side of [1, 2] as Side[]) {
          const step = aiTurnSteps(side, side === 1 ? p1 : TUNE.look[p2]);
          while (step()) {
            /* weiter */
          }
          if (over || checkWipe()) break;
        }
        if (over) break;
        endRound();
      }
      if (winner === 1) res.p1++;
      else if (winner === 2) res.p2++;
      else res.draw++;
      if (winReason === 'palette broken') res.palette++;
      if (winReason === 'washed out') res.wipes++;
    }
    const per = Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, +(v / n).toFixed(2)]));
    headless = false;
    level = keep;
    newGame(1);
    return { ...res, per };
  },
  tune: (o: Partial<typeof TUNE>) => Object.assign(TUNE, o),
};
(window as unknown as { done: boolean }).done = true;
