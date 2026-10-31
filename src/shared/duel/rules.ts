/*
 * Farbschlacht: Regeln und Gegner ohne Darstellung. Läuft am Server (würfelt) und im Client
 * (nur Abfragen wie Reichweite oder Chancen auf dem geladenen Zustand).
 * Jede Änderung, die man sehen soll, wird als Ereignis gemeldet. Die Darstellung spielt sie der Reihe nach ab.
 * Ein „sync“ am Ende jeder Aktion enthält den sichtbaren Zustand, damit die Darstellung nie auseinanderläuft.
 */
import { BLOOM_TRAITS, BP, PIG, type BlueprintId, type PigmentId, type RGB } from '../data';
import { relation } from '../glaze';
import { humidityFor, makeMonster, statRows, type Monster } from '../monster';
import { RNG, type Rand } from '../rng';
import { rarityIndex, rarityOf, type FaceMod, type Rarity } from '../dice';
import { MEDIA, MEDIA_MAX, MEDIA_PREF, MEDIA_ROUNDS, START_MEDIA, mediumDef, type MediumId } from './media';

/* ---------- Regeln (alle Zahlen hier) ---------- */
/** Blatt 6 breit, 8 hoch: auf dem Handy größere Felder als 7 × 7 bei fast gleicher Fläche (festgelegt am 29.10.2026) */
export const COLS = 6,
  ROWS = 8,
  ROUNDS = 6,
  WET_TURNS = 1,
  ERASER_ROUNDS = [2, 4],
  PAINT_RANGE = 2,
  HEARTS = 3,
  HEART_BONUS = 3,
  BAG = 9,
  ON_SHEET = 3,
  CREST_MAX = 9,
  ROLL_N = 3;
/** Sternseiten je Stufe (Index = Stufe) */
const STAR_FACES = [0, 3, 3, 2];
export const START_CRESTS: Record<Crest, number> = { step: 1, splash: 1, guard: 0, glow: 0 };
/** Symbole, die jede Seite zu Beginn jedes eigenen Zuges bekommt */
export const TURN_GIFT: Partial<Record<Crest, number>> = {};
/** Palette: bewacht, solange ein eigener Klecks höchstens guardR Felder entfernt steht. Höchstens perTurn Herzen pro Zug */
export const PALETTE = { guardR: 2, perTurn: 1 };
/**
 * Treffer: Schaden = base + Sättigung / satDiv, Deckkraft = hpBase + Deckkraft / hpDiv, toHit kommt auf jeden Spritzwurf,
 * range ist die Grundreichweite. freeSplash: Spritzer auf Kleckse kosten nichts, ein Splash-Symbol braucht nur der Treffer auf die Palette
 */
export const HIT = { base: 4, satDiv: 4, hpBase: 10, hpDiv: 3, toHit: 3, range: 2, freeSplash: true };
/**
 * Farbreaktionen (festgelegt am 29.10.2026): gleiches Pigment auf eigener, getrockneter Farbe lasiert (eine zweite Schicht, zählt am Ende doppelt,
 * def mehr in der Abwehr), eine Nachbarfarbe verläuft auf freies Papier daneben (höchstens bleedMax Felder pro Aktion)
 */
export const REACT = { def: 2, bleedMax: 2 };

/* ---------- Malmittel und Set-Boni ---------- */
export const hasMedium = (side: Side, id: MediumId): boolean => S.teams[side - 1]?.media?.includes(id) ?? false;
/** Farbfamilien für Set-Boni (festgelegt am 29.10.2026) */
export type Family = 'warm' | 'cool' | 'earth';
export const FAMILY: Record<PigmentId, Family> = { karmin: 'warm', opera: 'warm', kadmium: 'warm', ultra: 'cool', indigo: 'cool', phthalo: 'cool', siena: 'earth', sepia: 'earth' };
export const FAMILY_TEXT: Record<Family, [string, string]> = {
  warm: ['Splash +1 damage', 'Splash +2 damage, more crits'],
  cool: ['+1 walking reach', '+1 reach, a Guard every turn'],
  earth: ['+1 opacity each round', '+2 opacity each round, mud does not stop them'],
};
/** Set-Bonus einer Seite: zwei oder drei Kleckse derselben Farbfamilie auf dem Blatt */
export function setBonus(side: Side): { fam: Family; n: number } | null {
  const t = S.teams[side - 1];
  if (!t) return null;
  const n: Record<Family, number> = { warm: 0, cool: 0, earth: 0 };
  for (const u of t.units) if (u.state === 'sheet') n[FAMILY[u.m.main]]++;
  for (const fam of ['warm', 'cool', 'earth'] as Family[]) if (n[fam] >= 2) return { fam, n: n[fam] };
  return null;
}
const setN = (side: Side, fam: Family): number => {
  const b = setBonus(side);
  return b && b.fam === fam ? b.n : 0;
};
/** Drei Malmittel zur Wahl: aus dem Vorrat, ohne die schon gewählten */
export function makeOffer(side: Side, pool: MediumId[]): MediumId[] {
  const own = S.teams[side - 1]!.media ?? [];
  const left = pool.filter((m) => !own.includes(m));
  const out: MediumId[] = [];
  while (out.length < 3 && left.length) out.push(left.splice(Math.floor(rand01() * left.length), 1)[0]!);
  return out;
}
export const aiMedium = (offer: MediumId[]): MediumId => MEDIA_PREF.find((m) => offer.includes(m)) ?? offer[0]!;
export function takeMedium(side: Side, id: MediumId): void {
  const t = S.teams[side - 1]!;
  t.media = [...(t.media ?? []), id];
  count(`${side}medium-${id}`);
  emit({ k: 'medium', side, id });
  logAdd(`${side === 2 ? 'The rival takes' : 'You take'} ${mediumDef(id).name}: ${mediumDef(id).text}`, side === 2 ? 'rival' : 'you');
}
/**
 * Malmittel-Wahl: der Rivale wählt gleich, der Spieler bekommt drei zur Wahl (Phase medium), danach geht es mit resume weiter.
 * Nicht im Lern-Duell. Gibt false zurück, wenn es nichts zu wählen gibt
 */
export function startOffer(resume: Phase): boolean {
  if (S.tutorial > 0 || S.over) return false;
  const ro = (S.teams[1].media?.length ?? 0) < MEDIA_MAX ? makeOffer(2, S.rivalMedia.length ? S.rivalMedia : MEDIA.map((m) => m.id)) : [];
  if (ro.length) takeMedium(2, aiMedium(ro));
  const offer = (S.teams[0].media?.length ?? 0) < MEDIA_MAX ? makeOffer(1, S.unlocked) : [];
  if (!offer.length) return false;
  S.offer = offer;
  S.resume = resume;
  S.phase = 'medium';
  return true;
}
export const offerRound = (round: number): boolean => MEDIA_ROUNDS.includes(round);

export type Side = 1 | 2;
export type Phase = 'opening' | 'medium' | 'roll' | 'keep' | 'summon' | 'act' | 'over';
/** gallery: Deck eines anderen Spielers, mit echten Werten (docs/entwuerfe/galerie-duell-plan.md) */
export type Level = 'apprentice' | 'journeyman' | 'master' | 'gallery';
/**
 * Was die Karte eines Würfels des Rivalen zusätzlich zeigt (gleiche Reihenfolge wie die Kleckse): im Galerie-Duell
 * Seriennummer, Lasur, Patina, gemalt. drift: aus dem Archiv zurückgetrieben, ausgewaschen von diesem Spieler ('' unbekannt)
 */
export type FoeDie = { no?: number; glaze?: number; patina?: number; drawn?: 1; drift?: string };
export type Action = 'stamp' | 'splash' | 'soak' | 'ability' | 'none';
export type Crest = 'step' | 'splash' | 'guard' | 'glow';
type StatK = 'flo' | 'opa' | 'sat' | 'grn' | 'glw';
/** Eine Würfelseite: Stern mit Stufe oder Symbol mit Anzahl */
/** Joker: Stern, der für andere als Stufe 3 zählt. Gold: je ein Symbol jeder Sorte. */
/** Eine Würfelseite. n: wie oft das Symbol zählt (1 bis 3). k2: Mischseite, ein zweites Symbol dazu (zählt einmal) */
export type Face = { k: 'star' | 'joker' | 'gold' | Crest; n: number; k2?: Crest };
/** Schlüssel für Bilder und Zwischenspeicher einer Seite */
export const faceKey = (f: Face): string => `${f.k}${f.n}${f.k2 ?? ''}`;
export const isStar = (f: Face): boolean => f.k === 'star' || f.k === 'joker';
export const starValue = (f: Face): number => (f.k === 'joker' ? 3 : f.k === 'star' ? f.n : 0);
const isCrest = (f: Face): f is { k: Crest; n: number; k2?: Crest } => f.k !== 'star' && f.k !== 'joker' && f.k !== 'gold';
export const isCrestFace = isCrest;
export type P = [number, number];
/** layer: zweite Schicht aus einer Lasur (zählt am Ende doppelt) */
export type Cell = { owner: 0 | 1 | 2 | 3; rgb: RGB; hue: PigmentId | null; wet: number; atk: number; def: number; lf: number; stamp: number; home: 0 | Side; layer?: number };
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
  /** Deck: in diesem Durchgang schon geworfen (liegt auf der Ablage, bis neu gemischt wird) */
  used: boolean;
  /** Sättigung (Brim): füllt sich durch Tun, voll wird der nächste Wisch ein Meisterzug (festgelegt am 30.10.2026) */
  brim: number;
  /** Würfe in diesem Duell (Neuwürfe zählen mit), daraus wächst nach dem Duell die Patina des Würfels */
  rolls?: number;
  pattern: P[];
  net: P[];
  lv: number;
  faces: Face[];
  rarity: Rarity;
  sec: PigmentId | null;
  traits: Trait[];
};
/** media: gewählte Malmittel */
export type Team = { side: Side; units: Unit[]; crests: Record<Crest, number>; hearts: number; home: number; media?: MediumId[] };
export type Rolled = { u: Unit; fi: number; face: Face };

/* ---------- Ereignisse für die Darstellung ---------- */
export type CellSnap = { i: number; c: Cell };
export type StampRes = 'take' | 'refresh' | 'glaze' | 'mud' | 'held' | 'none';
export type UnitSnap = { id: number; x: number; y: number; hp: number; max: number; state: Unit['state']; stain: number; rooted: number; shield: number; acted: boolean; used: boolean; brim: number };
export type TeamSnap = { crests: Record<Crest, number>; hearts: number };
export type Ev =
  /** Würfe liegen offen, Symbole zählen erst bei apply */
  | { k: 'roll'; side: Side; dice: { id: number; fi: number }[] }
  /** Neuwurf: nur die nicht gehaltenen Würfel */
  | { k: 'reroll'; side: Side; dice: { id: number; fi: number }[] }
  /** Der Wurf gilt: Symbole und Kombi kommen in den Vorrat */
  | { k: 'apply'; side: Side; crests: Record<Crest, number>; combo: Combo | null; joker: number; task?: Task | null }
  /** Eine Seite hat ein Malmittel gewählt */
  | { k: 'medium'; side: Side; id: MediumId }
  | { k: 'summon'; side: Side; id: number; x: number; y: number; cells: CellSnap[]; faces: Face[] }
  | { k: 'move'; id: number; path: number[]; trail: CellSnap[] }
  | { k: 'stamp'; id: number; wet: boolean; cells: (CellSnap & { r: StampRes })[] }
  | { k: 'shot'; id: number; at: number; res: 'miss' | 'dodge' | 'hit' | 'crit'; dmg: number; guard: boolean; rgb: RGB; text: string; mult?: number }
  | { k: 'hp'; id: number; hp: number; delta: number; why: string }
  | { k: 'wash'; id: number; cell: CellSnap; by: number | null }
  /** Der Rivale zeigt, was er gleich tut: wer, wohin, welches Ziel */
  | { k: 'focus'; id: number; to: number; at: number | null; a: Action }
  | { k: 'pos'; id: number; x: number; y: number; how: 'push' | 'dash' | 'leap' | 'drift' }
  /** Meisterzug (master) oder Abgang beim Platzen (spill) */
  | { k: 'ability'; id: number; name: string; bp: BlueprintId; at: number; area: number[]; how?: 'master' | 'spill' }
  /** flow: Farbreaktion, eine Nachbarfarbe ist auf freies Papier verlaufen */
  | { k: 'cells'; how: 'bleed' | 'seep' | 'rain' | 'wet' | 'splat' | 'burst' | 'flow'; cells: CellSnap[] }
  | { k: 'heart'; side: Side; hearts: number; from: number }
  | { k: 'eraser'; row: number; cells: CellSnap[] }
  | { k: 'round'; round: number }
  /** Das Deck einer Seite wird neu gemischt */
  | { k: 'shuffle'; side: Side }
  | { k: 'turn'; side: Side }
  | { k: 'log'; t: string; c: string }
  | { k: 'sync'; cells: Cell[]; units: UnitSnap[]; teams: TeamSnap[]; round: number };

export const CRESTS: { k: Crest; label: string; stat: StatK; col: string; use: string }[] = [
  { k: 'step', label: 'Step', stat: 'flo', col: '#2e7a57', use: '+2 reach for one move' },
  { k: 'splash', label: 'Splash', stat: 'sat', col: '#c0482a', use: 'one splash' },
  { k: 'guard', label: 'Guard', stat: 'grn', col: '#5f6474', use: 'halves a hit by itself' },
  { k: 'glow', label: 'Glow', stat: 'glw', col: '#b8860b', use: 'pours into your blots and fills their brim' },
];
/** Wert hinter einem Symbol. Guard kommt aus Körnung oder Deckkraft, je nachdem, was größer ist */
const crestStat = (u: Unit, c: Crest): number => (c === 'guard' ? Math.max(u.grn, u.opa) : u[crestDef(c).stat]);
export const crestDef = (k: Crest) => CRESTS.find((c) => c.k === k)!;

/*
 * Rivale: bedenkt nur eine Handvoll Züge (0 = alle), Lehrling und Geselle mit schwächeren Klecksen, der Meister mit stärkeren.
 * Galerie: das Deck eines anderen Spielers mit echten Werten, der Rivale denkt wie der Meister (festgelegt am 31.10.2026)
 */
export const TUNE = {
  look: { apprentice: 3, journeyman: 15, master: 0, gallery: 0 } as Record<Level, number>,
  hp: { apprentice: 0.7, journeyman: 0.85, master: 1.25, gallery: 1 } as Record<Level, number>,
  stat: { apprentice: 0.65, journeyman: 0.85, master: 1.15, gallery: 1 } as Record<Level, number>,
  /** Zusätzliche Symbole zum Start (der Meister ist stärker als du, festgelegt am 29.10.2026) */
  extra: { apprentice: {}, journeyman: {}, master: { guard: 2, glow: 2 }, gallery: {} } as Record<Level, Partial<Record<Crest, number>>>,
  /** Neuwürfe pro Zug und ob Kombis zählen (zum Vergleichen in der Simulation) */
  rerolls: 1,
  combos: true,
  /** Malmittel in der Simulation */
  media: true,
  /** Sepias Auftrag pro Runde (Wurfziel, erfüllt gibt einen Joker) */
  tasks: true,
};

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

/* Gangart je Bauplan. Eigene Farbe ist der schnelle Weg, blankes Papier kostet doppelt */
export const GAIT: Record<BlueprintId, { key: string; text: string }> = {
  kriecher: { key: 'trail-dry', text: 'leaves a dry trail' },
  flatterer: { key: 'fly', text: 'flies: every cell costs 1' },
  schwebeblase: { key: 'float', text: 'floats over mud' },
  vierbeiner: { key: 'fast', text: 'runs one step further' },
  schlange: { key: 'slide', text: 'slides through own paint' },
  turm: { key: 'tower', text: 'never moves, reaches far' },
  krabbe: { key: 'pinch', text: '+3 damage up close' },
  qualle: { key: 'trail-wet', text: 'drips a wet trail' },
  huepfer: { key: 'hop', text: 'hops two cells, over anything' },
  knolle: { key: 'root', text: 'soaks twice as well' },
  strahler: { key: 'reach', text: 'splashes one cell further' },
  doppelkopf: { key: 'twin', text: 'splashes twice' },
};

/* Fähigkeit je Bauplan, kostet Leuchten. Ziel „self“, „cell“ oder „unit“ */
type AbilityTarget = 'self' | 'cell' | 'unit';
export const ABILITY: Record<BlueprintId, { name: string; text: string; target: AbilityTarget }> = {
  kriecher: { name: 'Seep', text: 'Your paint nearby turns wet and bleeds into all free paper around it.', target: 'self' },
  flatterer: { name: 'Gust', text: 'Rivals within 2 are blown back a cell and lose 3 opacity.', target: 'self' },
  schwebeblase: { name: 'Rain', text: 'Rain on a 3×3 patch around its target: your paint turns wet, rival dry paint turns wet and soft.', target: 'cell' },
  vierbeiner: { name: 'Charge', text: 'Its splash hits harder: 1.5× and +4 to hit.', target: 'unit' },
  schlange: { name: 'Coil', text: 'The rival it splashes is wrapped: -4, stained, and it cannot move next turn.', target: 'unit' },
  turm: { name: 'Bastion', text: 'All your blots get +5 on defence rolls for two rounds.', target: 'self' },
  krabbe: { name: 'Crush', text: 'Its splash ignores Grain and does double damage.', target: 'unit' },
  qualle: { name: 'Drift', text: 'Every rival next to it is stained and loses 2 opacity.', target: 'cell' },
  huepfer: { name: 'Bound', text: 'It leaps once more to the best free cell within 4 and stamps where it lands.', target: 'cell' },
  knolle: { name: 'Sprout', text: 'All your blots heal 6 and the paint under them turns wet.', target: 'self' },
  strahler: { name: 'Flare', text: 'Burst wet paint into all 8 cells around and splash every adjacent rival for 0.6×.', target: 'self' },
  doppelkopf: { name: 'Howl', text: 'The rival loses 1 Splash. Rivals within 2 lose 3 opacity and 2 brim.', target: 'self' },
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
    const fx = ['heals 1 each round', 'stamps +2 against wet paint', 'stamps +2 against dry paint', 'takes 15% less', 'dodge +5%'][m.bloomTrait]!;
    t.push({ key: 'bloom' + m.bloomTrait, label: n, text: fx });
  }
  if (m.events.print) t.push({ key: 'print', label: 'Fingerprint', text: 'brims 1 faster' });
  if (pigs.includes('phthalo')) t.push({ key: 'staining', label: 'Staining', text: 'splashes always stain' });
  if (pigs.includes('opera')) t.push({ key: 'fugitive', label: 'Fugitive', text: 'fades 1 each round, +2 damage' });
  if (PIG[m.main].gran >= 0.5) t.push({ key: 'granulating', label: 'Granulating', text: 'its dry paint is +2 harder to cover' });
  return t;
}
export const has = (u: Unit, k: string) => u.traits.some((t) => t.key === k);

export const mk = (sheet: string, idx: number) => makeMonster(sheet, idx, humidityFor(sheet));
export function find(bp: BlueprintId, main: PigmentId, salt: string, wantSec = false): Monster {
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
  const max = HIT.hpBase + Math.round(s.deckkraft! / HIT.hpDiv);
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
    used: false,
    brim: 0,
    pattern: PATTERNS[m.bp],
    net: NETS[NET_OF[m.bp]]!,
    lv: 1,
    faces: [],
    sec: m.sec[0] ?? null,
    traits: traitsOf(m),
    rarity: rarityOf(m.paper),
  };
}
export const power = (u: Unit) => u.sat + u.opa + u.grn + u.flo + u.glw;
/** Seiten des Würfels: Sterne nach Stufe, der Rest nach den Werten des Kleckses, der stärkste Wert ab 30 einmal doppelt */
function makeFaces(u: Unit): Face[] {
  const r = RNG(u.m.seed ^ 0x51ce);
  const f: Face[] = [];
  for (let i = 0; i < STAR_FACES[u.lv]!; i++) f.push({ k: 'star', n: u.lv });
  const w = CRESTS.map((c) => Math.pow(Math.max(1, crestStat(u, c.k)), 1.5));
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
    const dbl = !doubled && c === top && crestStat(u, c.k) >= 30;
    if (dbl) doubled = true;
    f.push({ k: c.k, n: dbl ? 2 : 1 });
  }
  return f;
}

/** Stufe aus der Stärke: schwache Würfel beschwören leicht, starke schwer */
export const LEVEL_POWER = [110, 123];
export const levelOf = (u: Unit): number => (power(u) < LEVEL_POWER[0]! ? 1 : power(u) < LEVEL_POWER[1]! ? 2 : 3);
/**
 * Chancen je Symbolseite (festgelegt am 30.10.2026, docs/entwuerfe/wuerfel-vorschlag.md): jede Seite würfelt beim Entstehen
 * des Würfels, ob sie dreifach, eine Mischseite oder doppelt wird. Seltenheit erhöht nur die Chance
 */
export const FACE_ODDS: Record<Rarity, { x2: number; x3: number; mix: number }> = {
  common: { x2: 0.12, x3: 0, mix: 0 },
  uncommon: { x2: 0.25, x3: 0, mix: 0.05 },
  rare: { x2: 0.3, x3: 0.05, mix: 0.1 },
  epic: { x2: 0.35, x3: 0.12, mix: 0.15 },
  legendary: { x2: 0.35, x3: 0.2, mix: 0.2 },
};
/**
 * Seltenheit verändert Seiten: Joker ab Rare und Gold bei Legendary stehen fest (zeigen die Seltenheit), danach würfelt jede
 * Symbolseite nach FACE_ODDS (eigener Zufall aus dem Seed, die Grundseiten bleiben, wie sie waren)
 */
function rarityFaces(f: Face[], r: Rarity, u: Unit): Face[] {
  const out = f.map((x) => ({ ...x }));
  const ri = rarityIndex(r);
  const last = () => {
    for (let i = out.length - 1; i >= 0; i--) if (isCrest(out[i]!)) return i;
    return -1;
  };
  if (ri >= 2 && last() >= 0) out[last()] = { k: 'joker', n: 3 };
  if (ri >= 4 && last() >= 0) out[last()] = { k: 'gold', n: 1 };
  const odds = FACE_ODDS[r];
  const rr = RNG(u.m.seed ^ 0x7a1e5);
  // Mischseite: das Symbol der Seite und das stärkste andere des Kleckses
  const order = [...CRESTS].sort((a, b) => crestStat(u, b.k) - crestStat(u, a.k)).map((c) => c.k);
  for (const x of out) {
    if (!isCrest(x)) continue;
    const v = rr();
    if (v < odds.x3) x.n = 3;
    else if (v < odds.x3 + odds.mix) {
      if (x.n === 1) x.k2 = order.find((c) => c !== x.k)!;
    } else if (v < odds.x3 + odds.mix + odds.x2) x.n = Math.max(x.n, 2);
  }
  return out;
}
/**
 * Lasuren und Patina der Reihe nach: x2 macht ein einfaches Symbol doppelt (Lasur oder Patina),
 * x3 ein doppeltes dreifach, mix gibt einem einfachen oder doppelten Symbol das stärkste andere dazu (nur Patina)
 */
function glazeFaces(f: Face[], mods: FaceMod[], u: Unit): Face[] {
  const out = f.map((x) => ({ ...x }));
  for (const m of mods) {
    const x = out[m.i];
    if (!x || !isCrest(x) || x.k2) continue;
    if (m.to === 'x2' && x.n === 1) x.n = 2;
    else if (m.to === 'x3' && x.n === 2) x.n = 3;
    else if (m.to === 'mix' && x.n <= 2) x.k2 = [...CRESTS].sort((a, b) => crestStat(u, b.k) - crestStat(u, a.k)).find((c) => c.k !== x.k)!.k;
  }
  return out;
}
/** Alle Seiten eines Würfels: Grundseiten aus den Werten, dann Seltenheit, dann Lasuren und Patina */
export function facesFor(u: Unit, mods: FaceMod[] = []): Face[] {
  return glazeFaces(rarityFaces(makeFaces(u), u.rarity, u), mods, u);
}
/** Seiten, die Patina noch verbessern kann: einfache und doppelte Symbole ohne Mischung */
export const patinaFaces = (faces: Face[]): number[] => faces.flatMap((f, i) => (isCrest(f) && !f.k2 && f.n <= 2 ? [i] : []));
/** Ein Würfel außerhalb eines Duells (Sammlung, Karte) */
export function dieUnit(m: Monster, mods: FaceMod[] = []): Unit {
  const u = unitOf(m, 1);
  u.lv = levelOf(u);
  u.faces = facesFor(u, mods);
  return u;
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
  /** Zustand des Würfelzufalls (mulberry32), bleibt am Server */
  rng: 1,
  /** Öffentlicher Seed nur für die Form der Farbflecken */
  paintSeed: 0,
  /** Würfel aus der Sammlung zu deinen Klecksen (gleiche Reihenfolge), bleibt am Server */
  dieIds: [] as string[],
  /** Galerie-Duell: Name des Besitzers (leer: kein Galerie-Duell) und je Würfel des Rivalen, was seine Karte zeigt (auch Archiv-Würfel) */
  foeName: '',
  foeDice: [] as (FoeDie | null)[],
  /** Galerie-Duell, nur am Server: Spieler, dem das Deck gehört, und je Würfel der Schlüssel seiner Zeichnung (zum Melden) */
  foeId: '',
  foeKeys: [] as (string | null)[],
  /** Malmittel, aus denen der Rivale wählt (leer: alle). Im Galerie-Duell die des Besitzers */
  rivalMedia: [] as MediumId[],
  phase: 'opening' as Phase,
  lastRoll: [] as { id: number; fi: number }[],
  /** Joker aus dem letzten Wurf, die noch nicht als Stern oder Symbol verbraucht sind (Würfelseiten und Kombi-Joker) */
  joker: 0,
  /** Davon Joker aus Kombis: sie zählen beim Beschwören als Stern 3, gehören aber zu keinem Würfel */
  freeJoker: 0,
  /** Zusätzlicher Sternwert aus einer Kombi (Paar Sterne) */
  starBonus: 0,
  /** Neuwürfe, die in diesem Zug noch übrig sind */
  rerolls: 0,
  /** Die Kombi des letzten Wurfs */
  combo: null as Combo | null,
  /** Malmittel zur Wahl für den Spieler (Phase medium), danach geht es mit resume weiter */
  offer: [] as MediumId[],
  resume: 'opening' as Phase,
  /** Malmittel, die der Spieler freigeschaltet hat (daraus kommt das Angebot) */
  unlocked: [...START_MEDIA] as MediumId[],
  /** Herzen, die die Seite am Zug in diesem Zug schon getroffen hat */
  heartsTurn: 0,
  /** Lern-Duell: bis zu dieser Runde gibt Sepia jeden Schritt vor (0 = aus) */
  tutorial: 0,
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
  return { id: u.id, x: u.x, y: u.y, hp: u.hp, max: u.max, state: u.state, stain: u.stain, rooted: u.rooted, shield: u.shield, acted: u.acted, used: u.used, brim: u.brim };
}
/** Der ganze Zustand für die Darstellung */
export function sync(): void {
  if (S.headless) return;
  emit({
    k: 'sync',
    cells: S.cells.map((c) => ({ ...c })),
    units: [...S.teams[0].units, ...S.teams[1].units].map(snapUnit),
    teams: S.teams.map((t) => ({ crests: { ...t.crests }, hearts: t.hearts })),
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
/** Würfelzufall mit speicherbarem Zustand (mulberry32 wie im Prototyp) */
function rand01(): number {
  let a = S.rng | 0;
  a = (a + 0x6d2b79f5) | 0;
  S.rng = a >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const d20 = () => 1 + Math.floor(rand01() * 20);
const emptyCell = (): Cell => ({ owner: 0, rgb: PAPER, hue: null, wet: 0, atk: 0, def: 0, lf: 0, stamp: 0, home: 0 });
export const living = (t: Team) => t.units.filter((u) => u.state !== 'gone');
/**
 * Deck: geworfen werden nur Würfel im Beutel, die in diesem Durchgang noch nicht dran waren.
 * Beschworene Würfel liegen auf dem Blatt und werden nicht geworfen, solange ihr Klecks lebt.
 */
export const rollable = (t: Team) => t.units.filter((u) => u.state === 'bag' && !u.used);
/** Liegen weniger als drei Würfel bereit, wird die Ablage zurück ins Deck gemischt */
export function refillDeck(t: Team): void {
  if (rollable(t).length >= ROLL_N || !t.units.some((u) => u.state === 'bag' && u.used)) return;
  for (const u of t.units) if (u.state === 'bag') u.used = false;
  emit({ k: 'shuffle', side: t.side });
  logAdd(`${t.side === 2 ? 'The rival shuffles' : 'You shuffle'} the used dice back into the deck.`, t.side === 2 ? 'rival' : 'you');
}
export function logAdd(t: string, c: string): void {
  if (S.headless) return;
  S.log.unshift({ t, c });
  emit({ k: 'log', t, c });
}
export const faceText = (f: Face) =>
  f.k === 'star' ? `★${f.n}` : f.k === 'joker' ? 'Joker' : f.k === 'gold' ? 'Gold' : `${crestDef(f.k).label}${f.k2 ? ` + ${crestDef(f.k2).label}` : ''}${f.n > 1 ? ` ×${f.n}` : ''}`;
/** Was eine besondere Seite kann */
export const FACE_HELP: Record<'joker' | 'gold', string> = {
  joker: 'Joker: counts as a star of any level, or turns into any one crest.',
  gold: 'Gold: one of every crest.',
};

/** Neues Duell. Beutel sind je 6 Monster, der Seed bleibt am Server. */
export function newGame(seed: number, level: Level, mine: Monster[], theirs: Monster[], paintSeed: number, mineMods: FaceMod[][] = [], theirsMods: FaceMod[][] = []): void {
  S.gameSeed = seed >>> 0;
  S.level = level;
  S.rng = (seed ^ 0xabcdef) >>> 0;
  S.paintSeed = paintSeed >>> 0;
  S.phase = 'opening';
  S.lastRoll = [];
  S.joker = 0;
  S.freeJoker = 0;
  S.starBonus = 0;
  S.rerolls = 0;
  S.combo = null;
  S.offer = [];
  S.resume = 'opening';
  S.unlocked = [...START_MEDIA];
  S.heartsTurn = 0;
  S.tutorial = 0;
  S.dieIds = [];
  S.foeName = '';
  S.foeDice = [];
  S.foeId = '';
  S.foeKeys = [];
  S.rivalMedia = [];
  uid = 0;
  S.cells = Array.from({ length: COLS * ROWS }, emptyCell);
  S.round = 1;
  S.turn = 1;
  S.over = false;
  S.winner = 0;
  S.winReason = '';
  S.stamp = 0;
  S.log = [];
  S.events = [];
  const homeOf = (side: Side) => idx(Math.floor(COLS / 2), side === 1 ? ROWS - 1 : 0);
  S.teams = [
    { side: 1, units: mine.map((m) => unitOf(m, 1)), crests: { ...START_CRESTS }, hearts: HEARTS, home: homeOf(1), media: [] },
    { side: 2, units: theirs.map((m) => unitOf(m, 2)), crests: { ...START_CRESTS }, hearts: HEARTS, home: homeOf(2), media: [] },
  ];
  for (const t of S.teams) {
    // Stufe aus der Stärke, Seiten aus Werten, Seltenheit und Lasuren
    t.units.forEach((u, k) => {
      u.lv = levelOf(u);
      // Lasuren und Patina: deine Würfel, im Galerie-Duell auch die des Rivalen
      u.faces = facesFor(u, (t.side === 1 ? mineMods[k] : theirsMods[k]) ?? []);
    });
    const h = S.cells[t.home]!;
    h.home = t.side;
    h.owner = t.side;
    h.rgb = PIG[t.units[0]!.m.main].rgb;
    const hx = t.home % COLS,
      hy = Math.floor(t.home / COLS);
    for (const [x, y] of [[hx - 1, hy], [hx + 1, hy], [hx, hy + (t.side === 1 ? -1 : 1)]] as P[]) paintCell(S.cells[idx(x, y)]!, t.units[0]!, t.units[0]!.m.main, false);
  }
  for (const [c, n] of Object.entries(TUNE.extra[level]) as [Crest, number][]) S.teams[1].crests[c] += n;
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
  c.wet = wet ? WET_TURNS + (hasMedium(u.side, 'retarder') ? 1 : 0) : 0;
  c.atk = bonus(u.sat) - (pig !== u.m.main ? 1 : 0);
  c.def = bonus(u.grn) + (has(u, 'granulating') ? 2 : 0);
  c.lf = u.lf;
  c.stamp = ++S.stamp;
  c.layer = 0;
}
export type Reaction = 'glaze' | 'bleed' | null;
/** Was passiert, wenn nasse Farbe dieses Pigments auf das Feld trifft: gleiches Pigment auf eigener, getrockneter Farbe lasiert, eine Nachbarfarbe verläuft */
export function reactionOf(side: Side, pig: PigmentId, c: Cell): Reaction {
  if (!c.hue || c.home || (c.owner !== 1 && c.owner !== 2)) return null;
  // Lasieren geht wie beim echten Aquarell nur über getrocknete Farbe
  if (c.owner === side && c.hue === pig) return (c.layer ?? 0) >= 1 || c.wet > 0 ? null : 'glaze';
  if (c.hue !== pig && relation(pig, c.hue) === 'harmonisch') return 'bleed';
  return null;
}
/** Masking Fluid: eigene Farbe direkt neben der eigenen Palette lässt sich nicht übermalen */
export function masked(i: number, painter: Side): boolean {
  const c = S.cells[i]!;
  if (c.owner !== 1 && c.owner !== 2) return false;
  if (c.owner === painter || !hasMedium(c.owner, 'mask')) return false;
  const h = S.teams[c.owner - 1]!.home;
  return cheb(i % COLS, Math.floor(i / COLS), h % COLS, Math.floor(h / COLS)) <= 1;
}
/** Freie Nachbarfelder, auf die Farbe verlaufen kann */
function freeAround(i: number, skip: number[]): number[] {
  const x = i % COLS,
    y = Math.floor(i / COLS);
  return ([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as P[])
    .filter(([a, b]) => inside(a, b))
    .map(([a, b]) => idx(a, b))
    .filter((j) => S.cells[j]!.owner === 0 && !S.cells[j]!.home && !skip.includes(j));
}
/** Nasse Farbe auf ein Feld, mit Farbreaktion. flows sammelt die Felder, auf die Farbe verlaufen ist */
function paintReact(i: number, u: Unit, pig: PigmentId, flows: number[], skip: number[]): Reaction {
  const c = S.cells[i]!;
  if (masked(i, u.side)) return null;
  const re = reactionOf(u.side, pig, c);
  const layer = c.layer ?? 0;
  paintCell(c, u, pig, true);
  if (re === 'glaze') {
    c.layer = layer + 1;
    c.atk += REACT.def;
    c.def += REACT.def;
    count(`${u.side}glaze`);
  } else if (re === 'bleed' && flows.length < REACT.bleedMax * (hasMedium(u.side, 'oxgall') ? 2 : 1)) {
    // Ox Gall: die Farbe läuft noch ein Feld weiter
    let from = i;
    for (let k = 0; k < (hasMedium(u.side, 'oxgall') ? 2 : 1); k++) {
      const free = freeAround(from, [...skip, ...flows]);
      if (!free.length) break;
      const j = free[Math.floor(rand01() * free.length)]!;
      paintCell(S.cells[j]!, u, pig, true);
      flows.push(j);
      count(`${u.side}bleed`);
      from = j;
    }
  }
  return re;
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
/** Würfe offen hinlegen. Die Symbole zählen erst, wenn der Wurf gilt (applyRoll), dazwischen darf man einmal neu werfen */
export function rollDice(t: Team, us: Unit[]): Rolled[] {
  const out = us.map((u) => {
    const fi = Math.floor(rand01() * 6);
    // Geworfen heißt verbraucht, bis neu gemischt wird
    u.used = true;
    u.rolls = (u.rolls ?? 0) + 1;
    return { u, fi, face: u.faces[fi]! };
  });
  S.lastRoll = out.map((r) => ({ id: r.u.id, fi: r.fi }));
  S.joker = 0;
  S.freeJoker = 0;
  S.starBonus = 0;
  S.combo = null;
  count(`${t.side}roll`);
  emit({ k: 'roll', side: t.side, dice: S.lastRoll.map((r) => ({ ...r })) });
  return out;
}
/** Der Wurf, wie er gerade liegt */
export function currentRoll(): Rolled[] {
  return S.lastRoll.map((r) => {
    const u = unitById(r.id)!;
    return { u, fi: r.fi, face: u.faces[r.fi]! };
  });
}
/** Alle Würfel außer den gehaltenen neu werfen (einmal pro Zug) */
export function rerollDice(t: Team, hold: number[]): Rolled[] {
  const again: { id: number; fi: number }[] = [];
  for (const r of S.lastRoll) {
    if (hold.includes(r.id)) continue;
    r.fi = Math.floor(rand01() * 6);
    const u = unitById(r.id);
    if (u) u.rolls = (u.rolls ?? 0) + 1;
    again.push({ ...r });
  }
  S.rerolls = Math.max(0, S.rerolls - 1);
  count(`${t.side}reroll`);
  emit({ k: 'reroll', side: t.side, dice: again });
  return currentRoll();
}

/* ---------- Kombis wie Pokerhände: Paar, Drilling, Regenbogen ---------- */
export type Sym = 'star' | 'gold' | Crest;
export type Combo = { kind: 'pair' | 'triple' | 'rainbow'; sym: Sym | null; gain: Partial<Record<Crest, number>>; joker: number; star: number; text: string };
/** Bei Gleichstand zählt das wertvollere Symbol */
const CREST_ORDER: Crest[] = ['glow', 'splash', 'guard', 'step'];
export const symLabel = (s: Sym): string => (s === 'star' ? 'stars' : s === 'gold' ? 'gold' : crestDef(s).label);
/**
 * Kombi eines Wurfs. Paar und Drilling aus gleichen Symbolen, Regenbogen aus drei verschiedenen Symbolen.
 * Sterne zählen nur als Drilling gleicher Stufe (sonst beschwören sie), Gold zählt nicht mit.
 * Ein Joker zählt als beliebiges Symbol oder als Stern und bleibt trotzdem ein Joker
 */
export function comboOf(faces: Face[]): Combo | null {
  if (!TUNE.combos || faces.length < 2) return null;
  const wild = faces.filter((f) => f.k === 'joker').length;
  // Drei Sterne zählen nur mit gleicher Stufe (die Zahl steht auf der Seite)
  const stars = Math.max(0, ...[1, 2, 3].map((lv) => faces.filter((f) => f.k === 'star' && f.n === lv).length));
  const n = new Map<Crest, number>();
  // Eine Mischseite zählt für jedes ihrer beiden Symbole (festgelegt am 30.10.2026)
  for (const f of faces)
    if (isCrest(f)) {
      n.set(f.k, (n.get(f.k) ?? 0) + 1);
      if (f.k2) n.set(f.k2, (n.get(f.k2) ?? 0) + 1);
    }
  let best: Crest | null = null,
    bc = 0;
  for (const c of CREST_ORDER) {
    const k = n.get(c) ?? 0;
    if (k > bc) {
      best = c;
      bc = k;
    }
  }
  const sym = best ?? 'glow';
  if (best && bc + wild >= 3)
    return { kind: 'triple', sym, gain: { [sym]: 2 }, joker: 1, star: 0, text: `Triple ${symLabel(sym)}: +2 and a Joker` };
  if (stars + wild >= 3 && faces.length >= 3) return { kind: 'triple', sym: 'star', gain: {}, joker: 1, star: 0, text: 'Three stars: a Joker' };
  if (best && bc + wild >= 2) return { kind: 'pair', sym, gain: { [sym]: 1 }, joker: 0, star: 0, text: `Pair of ${symLabel(sym)}: +1 ${symLabel(sym)}` };
  if (faces.length >= 3 && faces.every(isCrest) && n.size >= 3 && bc === 1) return { kind: 'rainbow', sym: null, gain: {}, joker: 1, star: 0, text: 'Rainbow: a Joker' };
  return null;
}
/* ---------- Sepias Auftrag: ein Wurfziel pro Runde und Seite, erfüllt gibt einen Joker ---------- */
export type TaskK = 'two' | 'double' | 'colours' | 'stars' | 'four';
export type Task = { k: TaskK; c?: Crest; text: string };
const TASK_KINDS: TaskK[] = ['two', 'two', 'double', 'colours', 'stars', 'four'];
/**
 * Der Auftrag dieser Runde. Eigener Zufall aus dem öffentlichen Seed (der Würfelzufall bleibt unberührt),
 * damit der Client ihn ohne Server zeigen kann. Nicht im Lern-Duell
 */
export function taskOf(side: Side, round = S.round): Task | null {
  if (!TUNE.tasks || S.tutorial > 0) return null;
  const r = RNG((S.paintSeed ^ 0x5e9a7) + round * 131 + side * 17);
  const k = TASK_KINDS[Math.floor(r() * TASK_KINDS.length)]!;
  if (k === 'two') {
    const c = CRESTS[Math.floor(r() * CRESTS.length)]!;
    return { k, c: c.k, text: `two ${c.label}` };
  }
  const text: Record<Exclude<TaskK, 'two'>, string> = { double: 'a double face', colours: 'three colours', stars: 'two stars', four: 'four symbols' };
  return { k, text: text[k] };
}
/** Symbole eines Wurfs: je Symbol gezählt (Doppelseiten doppelt, Mischseiten für beide, Gold für alle vier) */
function symbolCount(faces: Face[]): Map<Crest, number> {
  const n = new Map<Crest, number>();
  const add = (c: Crest, k: number) => n.set(c, (n.get(c) ?? 0) + k);
  for (const f of faces) {
    if (f.k === 'gold') for (const c of CRESTS) add(c.k, 1);
    else if (isCrest(f)) {
      add(f.k, f.n);
      if (f.k2) add(f.k2, 1);
    }
  }
  return n;
}
/** Erfüllt der Wurf den Auftrag? Joker zählen als beliebiges Symbol oder als Stern */
export function taskMet(task: Task, faces: Face[]): boolean {
  const wild = faces.filter((f) => f.k === 'joker').length;
  const n = symbolCount(faces);
  switch (task.k) {
    case 'two':
      return (n.get(task.c!) ?? 0) + wild >= 2;
    case 'double':
      return faces.some((f) => f.k === 'gold' || (isCrest(f) && (f.n > 1 || !!f.k2)));
    case 'colours':
      return n.size + wild >= 3;
    case 'stars':
      return faces.filter((f) => f.k === 'star').length + wild >= 2;
    case 'four':
      return [...n.values()].reduce((a, b) => a + b, 0) + wild >= 4;
  }
}
/** Hilft diese Seite beim Auftrag? (für den Rivalen beim Halten) */
function helpsTask(task: Task, f: Face): boolean {
  if (f.k === 'joker' || f.k === 'gold') return true;
  switch (task.k) {
    case 'two':
      return isCrest(f) && (f.k === task.c || f.k2 === task.c);
    case 'double':
    case 'four':
      return isCrest(f) && (f.n > 1 || !!f.k2);
    case 'colours':
      return isCrest(f);
    case 'stars':
      return f.k === 'star';
  }
}
/** Der Wurf gilt: Symbole der Seiten und die Kombi kommen in den Vorrat */
export function applyRoll(t: Team): Rolled[] {
  const out = currentRoll();
  for (const r of out) {
    const f = r.face;
    if (f.k === 'gold') for (const c of CRESTS) t.crests[c.k] = Math.min(CREST_MAX, t.crests[c.k] + 1);
    else if (isCrest(f)) {
      t.crests[f.k] = Math.min(CREST_MAX, t.crests[f.k] + f.n);
      if (f.k2) t.crests[f.k2] = Math.min(CREST_MAX, t.crests[f.k2] + 1);
    }
  }
  const combo = comboOf(out.map((r) => r.face));
  if (combo && hasMedium(t.side, 'irid')) {
    if (combo.sym && combo.sym !== 'star' && combo.sym !== 'gold') combo.gain[combo.sym] = (combo.gain[combo.sym] ?? 0) + 1;
    else combo.gain.glow = (combo.gain.glow ?? 0) + 1;
    combo.text += ' (+1)';
  }
  if (combo) {
    for (const c of CRESTS) t.crests[c.k] = Math.min(CREST_MAX, t.crests[c.k] + (combo.gain[c.k] ?? 0));
    count(`${t.side}combo-${combo.kind}`);
  }
  S.combo = combo;
  S.freeJoker = combo?.joker ?? 0;
  // Sepias Auftrag erfüllt: ein Joker mehr (zählt wie ein Kombi-Joker)
  const task = taskOf(t.side);
  const done = !!task && out.length > 0 && taskMet(task, out.map((r) => r.face));
  if (done) {
    S.freeJoker++;
    count(`${t.side}task`);
  }
  S.starBonus = combo?.star ?? 0;
  S.joker = out.filter((r) => r.face.k === 'joker').length + S.freeJoker;
  S.rerolls = 0;
  emit({ k: 'apply', side: t.side, crests: { ...t.crests }, combo, joker: S.joker, task: done ? task : null });
  pourGlow(t);
  logAdd(`${t.side === 2 ? 'Rival' : 'You'} rolled ${out.map((x) => faceText(x.face)).join(', ')}${combo ? `. ${combo.text}` : ''}${done ? `. Sepia's task (${task.text}): a Joker` : ''}.`, t.side === 2 ? 'rival' : 'you');
  return out;
}
/** Welche Würfel halten: Drilling und Regenbogen ganz, ein Paar, Sterne (wenn noch Platz ist), Joker und Gold */
export function aiHold(t: Team, rolled: Rolled[]): number[] {
  const all = rolled.map((r) => r.u.id);
  const combo = comboOf(rolled.map((r) => r.face));
  if (combo && (combo.kind === 'triple' || combo.kind === 'rainbow')) return all;
  // Auftrag schon erfüllt: alles behalten, sonst die Seiten halten, die dazu passen
  const task = taskOf(t.side);
  if (task && taskMet(task, rolled.map((r) => r.face))) return all;
  const room = onSheet(t).length < ON_SHEET && t.units.some((u) => u.state === 'bag');
  const hold = rolled.filter((r) => {
    const f = r.face;
    if (f.k === 'joker' || f.k === 'gold') return true;
    if (task && helpsTask(task, f) && (task.k !== 'colours' || rolled.findIndex((o) => isCrest(o.face) && o.face.k === (f as { k: Crest }).k) === rolled.indexOf(r))) return true;
    if (f.k === 'star') return room;
    return combo?.kind === 'pair' && (combo.sym === f.k || (isCrest(f) && combo.sym === f.k2));
  });
  return hold.map((r) => r.u.id);
}
/** Ein Joker, der nicht zum Beschwören dient, wird zu einem Symbol nach Wahl */
export function takeJoker(t: Team, c: Crest): void {
  S.joker = Math.max(0, S.joker - 1);
  S.freeJoker = Math.min(S.freeJoker, S.joker);
  t.crests[c] = Math.min(CREST_MAX, t.crests[c] + 1);
  pourGlow(t);
  logAdd(`${t.side === 2 ? 'Rival' : 'You'} turned a Joker into ${crestDef(c).label}.`, t.side === 2 ? 'rival' : 'you');
}
/** Sterne der anderen Würfel müssen zusammen mindestens die Stufe des Kleckses ergeben */
export function summonable(t: Team, rolled: Rolled[]): Unit[] {
  if (onSheet(t).length >= ON_SHEET) return [];
  return rolled
    .filter((r) => isStar(r.face) && r.u.state === 'bag')
    .filter((r) => rolled.filter((o) => o !== r && isStar(o.face)).reduce((a, o) => a + starValue(o.face), 0) + S.starBonus + 3 * S.freeJoker >= r.u.lv)
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
  pourGlow(teamOf(u));
  return s;
}

/* ---------- Bewegen: jeder Klecks einmal pro Zug, Farbe ist der schnelle Weg ---------- */
/** Ein Step im Vorrat lässt einen Klecks so viel weiter gehen */
export const STEP_BONUS = 2;
export function moveRange(u: Unit): number {
  if (u.rooted > 0 || GAIT[u.m.bp].key === 'tower') return 0;
  return Math.min(6, Math.min(5, 2 + Math.floor(u.flo / 15) + (GAIT[u.m.bp].key === 'fast' ? 1 : 0)) + (setN(u.side, 'cool') ? 1 : 0));
}
/**
 * Erreichbare Felder mit Vorgänger und Kosten. Eigene Farbe kostet 1, blankes Papier, fremde Farbe
 * und Schlamm kosten 2, aus Schlamm geht es nicht weiter. Mit einem Step im Vorrat reicht es STEP_BONUS weiter.
 */
export function reachCost(u: Unit): { prev: Map<number, number>; cost: Map<number, number> } {
  const prev = new Map<number, number>();
  const cost = new Map<number, number>();
  const base = moveRange(u);
  const gait = GAIT[u.m.bp].key;
  const start = idx(u.x, u.y);
  prev.set(start, -1);
  cost.set(start, 0);
  if (base === 0) return { prev, cost };
  const range = base + (teamOf(u).crests.step > 0 ? STEP_BONUS : 0);
  if (gait === 'hop') {
    let frontier = [start];
    for (let h = 1; h <= Math.max(1, Math.floor(range / 2)); h++) {
      const next: number[] = [];
      for (const f of frontier) {
        const fx = f % COLS,
          fy = Math.floor(f / COLS);
        for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as P[]) {
          const nx = fx + dx,
            ny = fy + dy;
          if (!inside(nx, ny) || unitAt(nx, ny) || S.cells[idx(nx, ny)]!.home) continue;
          const ni = idx(nx, ny);
          if (prev.has(ni)) continue;
          prev.set(ni, f);
          cost.set(ni, h * 2);
          next.push(ni);
        }
      }
      frontier = next;
    }
    return { prev, cost };
  }
  const queue = [start];
  while (queue.length) {
    queue.sort((a, b) => cost.get(a)! - cost.get(b)!);
    const cur = queue.shift()!;
    const c0 = cost.get(cur)!;
    const cx = cur % COLS,
      cy = Math.floor(cur / COLS);
    if (cur !== start && S.cells[cur]!.owner === 3 && gait !== 'fly' && gait !== 'float' && setN(u.side, 'earth') < 3) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as P[]) {
      const nx = cx + dx,
        ny = cy + dy;
      if (!inside(nx, ny) || unitAt(nx, ny)) continue;
      const ni = idx(nx, ny);
      const c = S.cells[ni]!;
      if (c.home) continue;
      let step = 2;
      if (gait === 'fly' || (gait === 'float' && c.owner === 3)) step = 1;
      else if (c.owner === u.side) step = gait === 'slide' ? 0.5 : 1;
      const nc = c0 + step;
      if (nc > range) continue;
      if (cost.has(ni) && cost.get(ni)! <= nc) continue;
      cost.set(ni, nc);
      prev.set(ni, cur);
      queue.push(ni);
    }
  }
  return { prev, cost };
}
export const reach = (u: Unit): Map<number, number> => reachCost(u).prev;
/** Braucht dieser Weg einen Step aus dem Vorrat? */
export const needsStep = (u: Unit, to: number): boolean => (reachCost(u).cost.get(to) ?? 0) > moveRange(u);
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
  if (needsStep(u, to)) teamOf(u).crests.step--;
  u.x = to % COLS;
  u.y = Math.floor(to / COLS);
  u.moved = true;
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
export const canMove = (u: Unit) => !u.moved && moveRange(u) > 0;

/* ---------- Malen: jeder Stempel ist nasse Farbe, über trockene Farbe kommt er mit einem Wurf ---------- */
type Out = { kind: 'take' | 'refresh' | 'contest' | 'mud' | 'none' | 'over'; p: number };
/** Blüten: Edge Runner gegen nasse Farbe, Dry Edge gegen trockene */
function stampBonus(u: Unit, againstWet: boolean): number {
  return (againstWet && has(u, 'bloom1')) || (!againstWet && has(u, 'bloom2')) ? 2 : 0;
}
export function outcome(u: Unit, pig: PigmentId, c: Cell): Out {
  const foe = u.side === 1 ? 2 : 1;
  const sec = pig !== u.m.main ? 1 : 0;
  if (c.home) return { kind: 'none', p: 0 };
  if (c.owner === foe && masked(S.cells.indexOf(c), u.side)) return { kind: 'none', p: 0 };
  if (c.owner === 0) return { kind: 'take', p: 1 };
  if (c.owner === u.side) return { kind: 'refresh', p: 1 };
  if (c.owner === 3) return { kind: 'over', p: pWin(bonus(u.opa) - sec + stampBonus(u, false), 6) };
  if (c.owner === foe && c.wet > 0) {
    if (c.hue && relation(pig, c.hue) === 'komplementaer') return { kind: 'mud', p: 1 };
    return { kind: 'contest', p: pWin(bonus(u.sat) - sec + stampBonus(u, true), c.atk) };
  }
  return { kind: 'over', p: pWin(bonus(u.opa) - sec + stampBonus(u, false), c.def) };
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
function applyPaint(u: Unit, pig: PigmentId, list: number[]): { took: number; mud: number; held: number; rolls: string[] } {
  let took = 0,
    mud = 0,
    held = 0;
  const rolls: string[] = [];
  const res: (CellSnap & { r: StampRes })[] = [];
  const sec = pig !== u.m.main ? 1 : 0;
  const flows: number[] = [];
  for (const i of list) {
    const c = S.cells[i]!;
    const o = outcome(u, pig, c);
    let r: StampRes = 'none';
    if (o.kind === 'take' || o.kind === 'refresh') {
      const re = paintReact(i, u, pig, flows, list);
      if (o.kind === 'take') took++;
      r = re === 'glaze' ? 'glaze' : o.kind;
    } else if (o.kind === 'mud') {
      mudCell(c);
      mud++;
      r = 'mud';
    } else if (o.kind === 'contest' || o.kind === 'over') {
      const a = d20(),
        d = d20();
      const atk = (o.kind === 'contest' ? bonus(u.sat) : bonus(u.opa)) - sec + stampBonus(u, o.kind === 'contest');
      const def = c.owner === 3 ? 6 : o.kind === 'contest' ? c.atk : c.def;
      rolls.push(`d${a}+${atk} vs d${d}+${def}`);
      if (a + atk > d + def) {
        paintReact(i, u, pig, flows, list);
        took++;
        r = 'take';
      } else {
        held++;
        r = 'held';
      }
    }
    res.push({ ...snap(i), r });
  }
  emit({ k: 'stamp', id: u.id, wet: true, cells: res });
  if (flows.length) emit({ k: 'cells', how: 'flow', cells: flows.map(snap) });
  return { took: took + flows.length, mud, held, rolls };
}
function doStamp(u: Unit, pig: PigmentId, at: number): string {
  const r = applyPaint(u, pig, stampCells(u, at));
  const parts = [`${r.took} taken`];
  if (r.mud) parts.push(`${r.mud} to mud`);
  if (r.held) parts.push(`${r.held} held`);
  return `stamped${pig !== u.m.main ? ` in ${PIG[pig].n}` : ''}: ${parts.join(', ')}${r.rolls.length ? ` (${r.rolls.join('; ')})` : ''}`;
}

/* ---------- Spritzer ---------- */
export function splashRange(u: Unit): number {
  let r = HIT.range + (GAIT[u.m.bp].key === 'reach' || GAIT[u.m.bp].key === 'tower' ? 1 : 0);
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
/** Kann dieser Klecks die gegnerische Palette treffen: daneben, ein Splash im Vorrat, nicht bewacht, Zuglimit nicht erreicht */
export const paletteOpen = (u: Unit): boolean => teamOf(u).crests.splash > 0 && touchesHome(u) && !homeGuarded(foeTeam(u)) && S.heartsTurn < PALETTE.perTurn;
/** Eine Palette ist geschützt, solange ein eigener Klecks direkt daneben steht */
export const homeGuarded = (t: Team): boolean => onSheet(t).some((u) => cheb(u.x, u.y, t.home % COLS, Math.floor(t.home / COLS)) <= PALETTE.guardR);
export function splashCells(u: Unit): number[] {
  const free = HIT.freeSplash || teamOf(u).crests.splash > 0;
  const out = free ? splashTargets(u).map((t) => idx(t.x, t.y)) : [];
  if (paletteOpen(u)) out.push(foeTeam(u).home);
  return out;
}
const grainOf = (t: Unit) => t.grn + (t.shield > 0 ? 25 : 0);
const dodgeOf = (t: Unit) => Math.min(0.4, t.flo / 400 + (has(t, 'alcohol') ? 0.06 : 0) + (has(t, 'bloom4') ? 0.05 : 0));
const critOf = (u: Unit) => 0.05 + (has(u, 'salt') ? 0.08 : 0) + (hasMedium(u.side, 'salt') ? 0.1 : 0) + (setN(u.side, 'warm') >= 3 ? 0.08 : 0);
export function baseDamage(u: Unit, t: Unit, pig: PigmentId, near: boolean): number {
  let dmg = (HIT.base + u.sat / HIT.satDiv - (pig !== u.m.main ? 1 : 0)) * typeMult(pig, t.m.main);
  if (GAIT[u.m.bp].key === 'pinch' && near) dmg += 3;
  if (has(u, 'fugitive')) dmg += 2;
  // Warme Familie: zwei Kleckse +1, drei +2
  const warm = setN(u.side, 'warm');
  if (warm) dmg += warm >= 3 ? 2 : 1;
  if (GAIT[u.m.bp].key === 'twin') dmg *= 0.6;
  if (has(t, 'bloom3')) dmg *= 0.85;
  return Math.max(1, Math.round(dmg));
}
/**
 * Wäscht ein normaler Treffer (ohne Krit) das Ziel aus? Für die Vorschau beim Zielen (G4): Meisterzug von Charge und Crush,
 * ein Guard des Gegners halbiert, Twin trifft zweimal
 */
export function splashLethal(u: Unit, t: Unit, pig: PigmentId): boolean {
  let dmg = baseDamage(u, t, pig, cheb(u.x, u.y, t.x, t.y) <= 1);
  if (brimFull(u) && masterApplies(u, 'splash', idx(t.x, t.y))) {
    if (u.m.bp === 'vierbeiner') dmg = dmg * 1.5 + 4;
    else if (u.m.bp === 'krabbe') dmg *= 2;
  }
  dmg = Math.max(1, Math.round(dmg));
  const first = teamOf(t).crests.guard > 0 ? Math.ceil(dmg / 2) : dmg;
  return first + (GAIT[u.m.bp].key === 'twin' ? dmg : 0) >= t.hp;
}
export function splashOdds(u: Unit, t: Unit, pig: PigmentId, plus = 0, ignoreGrain = false): number {
  return pWin(bonus(u.sat) - (pig !== u.m.main ? 1 : 0) + HIT.toHit + plus, ignoreGrain ? 0 : bonus(grainOf(t))) * (1 - dodgeOf(t));
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
  const shot = (res: 'miss' | 'dodge' | 'hit' | 'crit', dmg: number, guard: boolean, text: string) => emit({ k: 'shot', id: u.id, at, res, dmg, guard, rgb: PIG[pig].rgb, text, mult: typeMult(pig, t.m.main) });
  if (rand01() < dodgeOf(t)) {
    shot('dodge', 0, false, 'dodged');
    return ['dodged', 0];
  }
  const a = d20(),
    d = d20();
  const atk = bonus(u.sat) - (pig !== u.m.main ? 1 : 0) + HIT.toHit + plus,
    def = ignoreGrain ? 0 : bonus(grainOf(t));
  const roll = `d${a}+${atk} vs d${d}+${def}`;
  if (a + atk <= d + def) {
    shot('miss', 0, false, roll);
    return [`${roll}: miss`, 0];
  }
  const crit = a === 20 || rand01() < critOf(u);
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
  // Getroffen saugt sich voll
  if (t.hp > 0) fillBrim(t, BRIM.hit);
  // Salt: ein Krit färbt auch ein freies Feld neben dem Ziel
  if (crit && hasMedium(u.side, 'salt')) {
    const free = freeAround(at, []);
    if (free.length) {
      const j = free[Math.floor(rand01() * free.length)]!;
      paintCell(S.cells[j]!, u, pig, true);
      emit({ k: 'cells', how: 'splat', cells: [snap(j)] });
    }
  }
  if (relation(pig, t.m.main) === 'komplementaer' || has(u, 'staining')) t.stain = 2;
  return [`${roll}: ${crit ? 'crit' : 'hit'}${guard ? ', guarded' : ''}, -${dmg}`, dmg];
}
function doSplash(u: Unit, pig: PigmentId, at: number): string {
  const ft = foeTeam(u);
  if (at === ft.home) {
    ft.hearts--;
    S.heartsTurn++;
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
    const [s, dmg] = masterHit ? strike(u, t, pig, masterHit.mult, masterHit.plus, masterHit.ignoreGrain) : strike(u, t, pig, 1);
    parts.push(s);
    total += dmg;
  }
  // Wer trifft, färbt das Feld unter dem Ziel
  const c = S.cells[idx(t.x, t.y)]!;
  if (total > 0 && !c.home) {
    const flows: number[] = [];
    paintReact(idx(t.x, t.y), u, pig, flows, []);
    emit({ k: 'cells', how: 'splat', cells: [snap(idx(t.x, t.y))] });
    if (flows.length) emit({ k: 'cells', how: 'flow', cells: flows.map(snap) });
  }
  let s = `splashed ${t.side === 1 ? 'your' : 'the rival'} ${t.name}, ${relWord(pig, t.m.main)} (${parts.join('; ')})`;
  if (t.hp <= 0) s += washOut(t, u);
  return s;
}
/** Ausgewaschen: der Klecks platzt, sein Feld wird Schlamm. Hat ihn jemand getroffen, spritzt dessen Farbe auf freies Papier ringsum */
function washOut(t: Unit, by?: Unit): string {
  if (t.state !== 'sheet') return '';
  count(`kill${t.side}`);
  t.state = 'gone';
  t.hp = 0;
  const i = idx(t.x, t.y);
  mudCell(S.cells[i]!);
  emit({ k: 'wash', id: t.id, cell: snap(i), by: by?.id ?? null });
  const burst: number[] = [];
  const rr = by && hasMedium(by.side, 'waterbrush') ? 2 : 1;
  for (let y = t.y - rr; y <= t.y + rr; y++)
    for (let x = t.x - rr; x <= t.x + rr; x++) {
      if (!by || !inside(x, y) || unitAt(x, y)) continue;
      const c = S.cells[idx(x, y)]!;
      if (c.owner !== 0 || c.home) continue;
      paintCell(c, by, by.m.main, false);
      burst.push(idx(x, y));
    }
  if (burst.length) emit({ k: 'cells', how: 'burst', cells: burst.map(snap) });
  // Abgang: wer mindestens halb voll platzt, läuft über und tut noch einmal, was er kann
  const sp = t.brim >= BRIM.spill ? spill(t, by) : '';
  return `. ${t.name} burst and washed out, its die is lost${sp ? `. It spilled: ${sp}` : ''}`;
}
/** Abgang beim Platzen (festgelegt am 30.10.2026): Ziel-Fähigkeiten treffen den, der ihn zum Platzen brachte */
function spill(t: Unit, by?: Unit): string {
  t.brim = 0;
  count(`${t.side}spill`);
  const here = idx(t.x, t.y);
  switch (t.m.bp) {
    case 'vierbeiner':
    case 'krabbe': {
      if (!by || by.state !== 'sheet') return '';
      emit({ k: 'ability', id: t.id, name: ABILITY[t.m.bp].name, bp: t.m.bp, at: idx(by.x, by.y), area: [idx(by.x, by.y)], how: 'spill' });
      const [r, dmg] = t.m.bp === 'vierbeiner' ? strike(t, by, t.m.main, 1.5, 4) : strike(t, by, t.m.main, 2, 0, true);
      return `${ABILITY[t.m.bp].name} on ${by.name} (${r})${dmg && by.hp <= 0 ? washOut(by, t) : ''}`;
    }
    case 'schlange':
      if (!by || by.state !== 'sheet') return '';
      return doAbility(t, idx(by.x, by.y), 'spill');
    case 'huepfer': {
      // Ein letzter Sprung geht nicht mehr: die Farbe spritzt ringsum
      const ring: number[] = [];
      for (let y = t.y - 1; y <= t.y + 1; y++) for (let x = t.x - 1; x <= t.x + 1; x++) if (inside(x, y) && (x !== t.x || y !== t.y) && !unitAt(x, y)) ring.push(idx(x, y));
      emit({ k: 'ability', id: t.id, name: ABILITY[t.m.bp].name, bp: t.m.bp, at: here, area: ring, how: 'spill' });
      return `${applyPaint(t, t.m.main, ring).took} cells splashed`;
    }
    case 'qualle': {
      emit({ k: 'ability', id: t.id, name: ABILITY[t.m.bp].name, bp: t.m.bp, at: here, area: [here], how: 'spill' });
      const hit = onSheet(foeTeam(t)).filter((e) => cheb(t.x, t.y, e.x, e.y) <= 1);
      for (const e of hit) {
        e.stain = 2;
        setHp(e, e.hp - 2, 'drift');
        if (e.hp <= 0) washOut(e, t);
      }
      return `stained ${hit.length}`;
    }
    default:
      return doAbility(t, here, 'spill');
  }
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
  return `soaked: +${heal} opacity, stains rinsed`;
}

/* ---------- Fähigkeiten als Meisterzug (festgelegt am 30.10.2026, docs/entwuerfe/wuerfel-vorschlag.md) ---------- */
/**
 * Brim: Jeder Klecks füllt sich, wenn er stempelt, spritzt (act), einweicht (soak) oder getroffen wird (hit). Glow aus dem Wurf
 * gießt sich in alle eigenen Kleckse auf dem Blatt (glow je Symbol). Voll (max) wird sein nächster Wisch ein Meisterzug: die
 * Fähigkeit passiert dabei von selbst. Platzt ein Klecks, der mindestens halb voll ist (spill), läuft er über: Abgang
 */
export const BRIM = { max: 6, act: 2, soak: 1, hit: 1, glow: 1, spill: 3 };
export const brimFull = (u: Unit): boolean => u.brim >= BRIM.max;
export function fillBrim(u: Unit, n: number): void {
  if (u.state !== 'sheet' || n <= 0) return;
  u.brim = Math.min(BRIM.max, u.brim + n);
}
/** Glow im Vorrat gießt sich in alle eigenen Kleckse auf dem Blatt. Steht keiner, wartet es */
export function pourGlow(t: Team): void {
  const on = onSheet(t);
  if (!on.length || t.crests.glow <= 0) return;
  for (const u of on) fillBrim(u, t.crests.glow * BRIM.glow);
  t.crests.glow = 0;
}
/** Charge und Crush machen den Spritzer selbst stärker */
let masterHit: { mult: number; plus: number; ignoreGrain: boolean } | null = null;
/** Wirkt der Meisterzug bei dieser Aktion? Ziel-Fähigkeiten nur, wenn der Klecks einen Rivalen bespritzt */
export function masterApplies(u: Unit, a: Action, at: number | null): boolean {
  if (a === 'none') return false;
  if (ABILITY[u.m.bp].target !== 'unit') return true;
  return a === 'splash' && at !== null && at !== foeTeam(u).home && !!unitAt(at % COLS, Math.floor(at / COLS));
}
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
/** Wohin der Meisterzug zielt, nachdem der Klecks gehandelt hat (null: keiner möglich) */
function masterAt(u: Unit, a: Action, at: number | null): number | null {
  const here = idx(u.x, u.y);
  if (u.m.bp === 'schwebeblase') return a === 'soak' || at === null ? here : at;
  if (u.m.bp === 'huepfer') {
    let best: number | null = null,
      bv = -Infinity;
    for (const i of abilityTargets(u)) {
      const v = evalAbility(u, i);
      if (v > bv) {
        bv = v;
        best = i;
      }
    }
    return best;
  }
  if (ABILITY[u.m.bp].target === 'unit') return at;
  return here;
}
/** Felder, die eine Fähigkeit betrifft (für den Effekt) */
function abilityArea(u: Unit, at: number): number[] {
  const out: number[] = [];
  const r = u.m.bp === 'flatterer' || u.m.bp === 'doppelkopf' ? 2 : u.m.bp === 'kriecher' ? 2 : u.m.bp === 'strahler' ? 1 : u.m.bp === 'schwebeblase' ? 1 : 0;
  const cx = u.m.bp === 'schwebeblase' ? at % COLS : u.x,
    cy = u.m.bp === 'schwebeblase' ? Math.floor(at / COLS) : u.y;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (inside(x, y)) out.push(idx(x, y));
  return out;
}

function doAbility(u: Unit, at: number, how: 'master' | 'spill' = 'master'): string {
  const ab = ABILITY[u.m.bp];
  emit({ k: 'ability', id: u.id, name: ab.name, bp: u.m.bp, at, area: abilityArea(u, at), how });
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
        if (t.hp <= 0) parts.push(washOut(t, u).slice(2));
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
      if (dmg && tAt!.hp <= 0) s += washOut(tAt!, u);
      break;
    }
    case 'schlange': {
      setHp(tAt!, tAt!.hp - 4, 'coil');
      tAt!.stain = 2;
      tAt!.rooted = 1;
      s += ` on ${tAt!.name}: -4, stained, rooted`;
      if (tAt!.hp <= 0) s += washOut(tAt!, u);
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
      if (dmg && tAt!.hp <= 0) s += washOut(tAt!, u);
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
        if (t.hp <= 0) washOut(t, u);
      }
      s += `: drifted, stained ${hit.length}`;
      break;
    }
    case 'huepfer': {
      u.x = at % COLS;
      u.y = Math.floor(at / COLS);
      emit({ k: 'pos', id: u.id, x: u.x, y: u.y, how: 'leap' });
      const r = applyPaint(u, u.m.main, stampCells(u, at));
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
      const r = applyPaint(u, u.m.main, ring);
      const parts: string[] = [];
      for (const t of near(1)) {
        const [rs] = strike(u, t, u.m.main, 0.6);
        parts.push(`${t.name}: ${rs}`);
        if (t.hp <= 0) parts.push(washOut(t, u).slice(2));
      }
      s += `: ${r.took} cells${parts.length ? `, ${parts.join('; ')}` : ''}`;
      break;
    }
    case 'doppelkopf': {
      const ft = foeTeam(u);
      ft.crests.splash = Math.max(0, ft.crests.splash - 1);
      const parts: string[] = [];
      for (const t of near(2)) {
        t.brim = Math.max(0, t.brim - 2);
        setHp(t, t.hp - 3, 'howl');
        parts.push(`${t.name} -3`);
        if (t.hp <= 0) parts.push(washOut(t, u).slice(2));
      }
      s += `: rival Splash -1${parts.length ? `, ${parts.join(', ')}` : ''}`;
      break;
    }
  }
  return s;
}

/* ---------- Ein Zug ---------- */
export function canAct(u: Unit, a: Action): boolean {
  const t = teamOf(u);
  if (u.acted || u.state !== 'sheet') return false;
  if (a === 'splash') return HIT.freeSplash || t.crests.splash > 0;
  if (a === 'ability') return false;
  return true;
}
export function act(u: Unit, a: Action, pig: PigmentId, at: number | null): string {
  const t = teamOf(u);
  // Voll vor der Aktion: diesmal ein Meisterzug. Charge und Crush stärken den Spritzer selbst
  const master = brimFull(u) && masterApplies(u, a, at);
  if (master && a === 'splash' && (u.m.bp === 'vierbeiner' || u.m.bp === 'krabbe')) {
    emit({ k: 'ability', id: u.id, name: ABILITY[u.m.bp].name, bp: u.m.bp, at: at!, area: [at!], how: 'master' });
    masterHit = u.m.bp === 'vierbeiner' ? { mult: 1.5, plus: 4, ignoreGrain: false } : { mult: 2, plus: 0, ignoreGrain: true };
  }
  let s = '';
  if (a === 'stamp') s = doStamp(u, pig, at!);
  else if (a === 'splash') {
    if (!HIT.freeSplash || at === foeTeam(u).home) t.crests.splash--;
    s = doSplash(u, pig, at!);
  } else if (a === 'soak') s = doSoak(u);
  masterHit = null;
  count(`${u.side}${a}`);
  u.acted = true;
  if (master && u.state === 'sheet' && !S.over) {
    u.brim = 0;
    count(`${u.side}master`);
    if (u.m.bp === 'vierbeiner' || u.m.bp === 'krabbe') s += `, a master stroke (${ABILITY[u.m.bp].name})`;
    else {
      const mt = masterAt(u, a, at);
      const target = mt === null ? null : unitAt(mt % COLS, Math.floor(mt / COLS));
      // Coil braucht einen Rivalen, der noch steht
      if (mt !== null && (u.m.bp !== 'schlange' || (target && target.state === 'sheet' && target.side !== u.side))) s += `. Master stroke: ${doAbility(u, mt)}`;
    }
  } else if (a !== 'none') fillBrim(u, (a === 'soak' ? BRIM.soak : BRIM.act) + (has(u, 'print') ? 1 : 0));
  checkWipe();
  sync();
  return s;
}
export function startTurn(side: Side): void {
  S.turn = side;
  S.heartsTurn = 0;
  S.rerolls = TUNE.rerolls + (hasMedium(side, 'sponge') ? 1 : 0);
  S.combo = null;
  S.starBonus = 0;
  S.freeJoker = 0;
  const t = S.teams[side - 1]!;
  refillDeck(t);
  for (const c of CRESTS) t.crests[c.k] = Math.min(CREST_MAX, t.crests[c.k] + (TURN_GIFT[c.k] ?? 0));
  if (setN(side, 'cool') >= 3) t.crests.guard = Math.min(CREST_MAX, t.crests.guard + 1);
  pourGlow(t);
  // Lern-Duell: in der letzten geführten Runde gießt Sepia nach, damit man einen Meisterzug sieht
  if (S.tutorial > 0 && side === 1 && S.round === S.tutorial) {
    const u = [...onSheet(t)].sort((a, b) => b.brim - a.brim)[0];
    if (u) u.brim = BRIM.max;
  }
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
        spreads.push([idx(a, b), { ...c, wet: Math.max(0, c.wet - 1), stamp: ++S.stamp, layer: 0 }]);
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
    const earth = setN(u.side, 'earth');
    if (earth) hp = Math.min(u.max, hp + (earth >= 3 ? 2 : 1));
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
      if (u.y === row && !hasMedium(u.side, 'tape') && d20() + bonus(u.lf) < 18) {
        setHp(u, u.hp - 4, 'eraser');
        notes.push(`the Eraser grazed ${u.name} (-4)`);
        if (u.hp <= 0) notes.push(washOut(u).slice(2));
      }
    logAdd(`The Eraser passed through row ${row + 1}: ${gone.length} cells erased.`, 'eraser');
  }
  if (notes.length) logAdd(notes.join('. ') + '.', 'muted');
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
    if (c.owner === 1) a += 1 + (c.layer ?? 0) * (hasMedium(1, 'gum') ? 2 : 1);
    else if (c.owner === 2) b += 1 + (c.layer ?? 0) * (hasMedium(2, 'gum') ? 2 : 1);
    else if (c.owner === 3) {
      m++;
      // Granulation Medium: Schlamm zählt für die Seite, die es hat
      if (hasMedium(1, 'gran')) a++;
      if (hasMedium(2, 'gran')) b++;
    }
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
const CREST_COST: Record<Crest, number> = { step: 0.25, splash: 0.4, guard: 0, glow: 0.35 };
type Cand = { v: number; u: Unit; to: number; a: Action; pig: PigmentId; at: number | null };
function evalPaint(u: Unit, pig: PigmentId, at: number): number {
  let v = 0;
  const list = stampCells(u, at);
  let bleeds = 0;
  for (const i of list) {
    const c = S.cells[i]!;
    const o = outcome(u, pig, c);
    if (o.kind === 'take') v += 1;
    else if (o.kind === 'mud') v += 1.2;
    else if (o.kind === 'contest' || o.kind === 'over') v += o.p * (c.owner === 3 ? 1 : 2);
    // Farbreaktionen: Lasur ist ein Punkt mehr und hält besser, Verlaufen nimmt freies Papier dazu
    const p = o.kind === 'take' || o.kind === 'refresh' ? 1 : o.kind === 'contest' || o.kind === 'over' ? o.p : 0;
    const re = p > 0 ? reactionOf(u.side, pig, c) : null;
    if (re === 'glaze') v += (hasMedium(u.side, 'gum') ? 2 : 1.1) * p;
    else if (re === 'bleed' && bleeds < REACT.bleedMax && freeAround(i, list).length) {
      v += (hasMedium(u.side, 'oxgall') ? 1.6 : 0.9) * p;
      bleeds++;
    }
  }
  // Nasse Farbe verläuft am Rundenende in freies Papier
  v += 0.3 * list.filter((i) => S.cells[i]!.owner === 0).length * (u.flo / 40);
  return v;
}
/** Welche Farbe ein Klecks für eine Aktion nimmt: die bessere gegen das Ziel (Zweitfarbe ist automatisch) */
export function bestPig(u: Unit, a: Action, at: number | null): PigmentId {
  if (!u.sec || at === null || (a !== 'stamp' && a !== 'splash')) return u.m.main;
  const pigs: PigmentId[] = [u.m.main, u.sec];
  if (a === 'stamp') return evalPaint(u, u.sec, at) > evalPaint(u, u.m.main, at) + 0.01 ? u.sec : u.m.main;
  const t = unitAt(at % COLS, Math.floor(at / COLS));
  if (!t || t.side === u.side) return u.m.main;
  const near = cheb(u.x, u.y, t.x, t.y) <= 1;
  const val = (p: PigmentId) => splashOdds(u, t, p) * baseDamage(u, t, p, near);
  return val(pigs[1]!) > val(pigs[0]!) + 0.01 ? pigs[1]! : pigs[0]!;
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
      const v = evalPaint(u, u.m.main, at) + 0.5;
      u.x = ox;
      u.y = oy;
      return v;
    }
    case 'knolle':
      return onSheet(teamOf(u)).reduce((s, a) => s + Math.min(6, a.max - a.hp) * 0.35, 0) + 0.5;
    case 'strahler':
      return near(1).reduce((s, t) => s + baseDamage(u, t, u.m.main, true) * 0.6 * 0.8, 0) + 3;
    case 'doppelkopf':
      return Math.min(1, foeTeam(u).crests.splash) * 0.8 + Math.min(1, foeTeam(u).crests.glow) * 0.8 + near(2).reduce((s, t) => s + 2.7 + killBonus(t, 3), 0);
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
const FACE_VALUE: Record<Crest, number> = { step: 0.6, splash: 0.6, guard: 0.5, glow: 0.7 };
export function aiChooseDice(t: Team, look: number, r: Rand): Unit[] {
  const pool = rollable(t);
  if (pool.length <= ROLL_N) return pool;
  const room = onSheet(t).length < ON_SHEET;
  const combos: { v: number; us: Unit[] }[] = [];
  for (let a = 0; a < pool.length; a++)
    for (let b = a + 1; b < pool.length; b++)
      for (let c = b + 1; c < pool.length; c++) {
        const us = [pool[a]!, pool[b]!, pool[c]!];
        let v = 0;
        for (const u of us)
          for (const f of u.faces) {
            if (f.k === 'gold') v += CRESTS.reduce((a, c) => a + FACE_VALUE[c.k], 0) / 6;
            else if (isCrest(f)) v += (FACE_VALUE[f.k] * f.n + (f.k2 ? FACE_VALUE[f.k2] : 0)) / 6;
          }
        if (room && us.some((u) => u.state === 'bag')) {
          let p = 0,
            lvSum = 0;
          for (let i = 0; i < 216; i++) {
            const fs = [us[0]!.faces[i % 6]!, us[1]!.faces[Math.floor(i / 6) % 6]!, us[2]!.faces[Math.floor(i / 36)]!];
            let best = 0;
            us.forEach((u, k) => {
              const f = fs[k]!;
              if (!isStar(f) || u.state !== 'bag') return;
              const others = fs.reduce((s, g, j) => s + (j !== k ? starValue(g) : 0), 0);
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
/** Welches Symbol der Computer aus einem Joker macht: das wertvollste, von dem er wenig hat */
export function aiJokerCrest(t: Team): Crest {
  let best: Crest = 'splash',
    bv = -1;
  for (const c of CRESTS) {
    const v = FACE_VALUE[c.k] / (1 + t.crests[c.k]);
    if (v > bv) {
      bv = v;
      best = c.k;
    }
  }
  return best;
}
function aiSummon(side: Side, rolled: Rolled[], look: number, r: Rand): string | null {
  const t = S.teams[side - 1]!;
  const cands: { v: number; u: Unit; o: number; at: number }[] = [];
  for (const u of summonable(t, rolled)) for (const p of placements(u)) cands.push({ v: evalPlacement(u, p.list, p.at), u, o: p.o, at: p.at });
  if (!cands.length) return null;
  const b = pickBest(cands, look, r, () => false);
  return doSummon(b.u, b.o, b.at);
}
/** Beste Lage für ein Netz, wie der Meister sie wählen würde */
export function bestPlacement(u: Unit): { o: number; at: number } | null {
  let best: { o: number; at: number } | null = null,
    bv = -Infinity;
  for (const p of placements(u)) {
    const v = evalPlacement(u, p.list, p.at);
    if (v > bv) {
      bv = v;
      best = { o: p.o, at: p.at };
    }
  }
  return best;
}
/** Beste Eröffnung einer Seite: Würfel und Lage */
export function bestOpening(side: Side): { u: Unit; o: number; at: number } | null {
  let best: { u: Unit; o: number; at: number } | null = null,
    bv = -Infinity;
  for (const u of S.teams[side - 1]!.units)
    for (const p of placements(u)) {
      const v = evalPlacement(u, p.list, p.at) + power(u) / 20;
      if (v > bv) {
        bv = v;
        best = { u, o: p.o, at: p.at };
      }
    }
  return best;
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
/** Alle sinnvollen Züge (Bewegen und Handeln) einer Seite mit Bewertung. only: nur dieser Klecks, stay: ohne Bewegen */
function candidates(side: Side, only?: Unit, stay = false): Cand[] {
  const team = S.teams[side - 1]!;
  const cands: Cand[] = [];
  for (const u of onSheet(team)) {
    if (u.acted || (only && u !== only)) continue;
    const rc = canMove(u) && !stay ? reachCost(u) : { prev: new Map([[idx(u.x, u.y), -1]]), cost: new Map([[idx(u.x, u.y), 0]]) };
    const prev = rc.prev;
    const base = moveRange(u);
    const ox = u.x,
      oy = u.y;
    const d0 = homeDist(u, ox, oy);
    for (const to of prev.keys()) {
      const moving = to !== idx(ox, oy);
      u.x = to % COLS;
      u.y = Math.floor(to / COLS);
      const cHere = S.cells[to]!;
      let pos = -danger(u, u.x, u.y) + 0.25 * (d0 - homeDist(u, u.x, u.y)) - ((rc.cost.get(to) ?? 0) > base ? CREST_COST.step : 0);
      if (cHere.owner === side && cHere.wet > 0) pos += 0.4;
      // Die eigene Palette bewachen, wenn Gegner in der Nähe sind
      const h = team.home;
      if (cheb(u.x, u.y, h % COLS, Math.floor(h / COLS)) <= PALETTE.guardR) {
        const threat = onSheet(foeTeam(u)).filter((e) => cheb(e.x, e.y, h % COLS, Math.floor(h / COLS)) <= 3).length;
        if (threat) pos += (1 + threat) * (team.hearts <= 1 ? 2.5 : 1.2);
      }
      const gait = GAIT[u.m.bp].key;
      if (moving && (gait === 'trail-dry' || gait === 'trail-wet')) pos += 0.3 * pathTo(prev, to).filter((i) => S.cells[i]!.owner === 0).length;
      // Voller Klecks: der Meisterzug zählt bei jeder Aktion mit, bei der er auslöst
      const full = brimFull(u);
      const mSelf = full && ABILITY[u.m.bp].target !== 'unit' && u.m.bp !== 'schwebeblase' ? (masterAt(u, 'stamp', null) === null ? 0 : evalAbility(u, masterAt(u, 'stamp', null)!)) : 0;
      const mBonus = (a: Action, at: number | null): number => {
        if (!full || !masterApplies(u, a, at)) return 0;
        if (ABILITY[u.m.bp].target === 'unit') return u.m.bp === 'schlange' ? 4 : 3;
        if (u.m.bp === 'schwebeblase') return evalAbility(u, a === 'soak' || at === null ? idx(u.x, u.y) : at);
        return mSelf;
      };
      const add = (v: number, a: Action, pig: PigmentId, at: number | null) => cands.push({ v: v + pos + mBonus(a, at), u, to, a, pig, at });
      for (let at = 0; at < COLS * ROWS; at++) {
        if (!canPaintAt(u, at)) continue;
        const pig = bestPig(u, 'stamp', at);
        add(evalPaint(u, pig, at), 'stamp', pig, at);
      }
      if (HIT.freeSplash || team.crests.splash > 0)
        for (const t of splashTargets(u)) {
          const pig = bestPig(u, 'splash', idx(t.x, t.y));
          const hits = GAIT[u.m.bp].key === 'twin' ? 1.6 : 1;
          const dmg = baseDamage(u, t, pig, cheb(u.x, u.y, t.x, t.y) <= 1);
          add(splashOdds(u, t, pig) * hits * (dmg * 0.9 + killBonus(t, dmg * hits)) + (t.stain ? 0 : relation(pig, t.m.main) === 'komplementaer' ? 1 : 0) - (HIT.freeSplash ? 0 : CREST_COST.splash), 'splash', pig, idx(t.x, t.y));
        }
      if (paletteOpen(u)) add(foeTeam(u).hearts <= 1 ? 100 : 8, 'splash', u.m.main, foeTeam(u).home);
      if (u.hp < u.max) add(soakAmount(u) * 0.35 + (u.hp < u.max * 0.35 ? 2 : 0), 'soak', u.m.main, null);
      if (moving) add(0, 'none', u.m.main, null);
    }
    u.x = ox;
    u.y = oy;
  }
  return cands;
}
/** Vorschlag für den Spieler (wie der Meister spielen würde), ohne ihn auszuführen. ok: nur solche Züge */
export function suggest(side: Side, only?: Unit, stay = false, ok?: (c: Plan & { u: Unit }) => boolean): { u: Unit; to: number; a: Action; pig: PigmentId; at: number | null } | null {
  const cands = candidates(side, only, stay).filter((c) => c.a !== 'none' && (!ok || ok(c)));
  if (!cands.length) return null;
  let b = cands[0]!;
  for (const c of cands) if (c.v > b.v) b = c;
  return b.v > 0.05 ? { u: b.u, to: b.to, a: b.a, pig: b.pig, at: b.at } : null;
}
/* ---------- Ein Wisch: vom Klecks auf ein Feld ziehen, das Feld entscheidet ---------- */
export type Plan = { to: number; a: Action; at: number | null };
/** Etwas so prüfen, als stünde der Klecks auf Feld p */
export function atSpot<T>(u: Unit, p: number, fn: () => T): T {
  const ox = u.x,
    oy = u.y;
  u.x = p % COLS;
  u.y = Math.floor(p / COLS);
  try {
    return fn();
  } finally {
    u.x = ox;
    u.y = oy;
  }
}
/** Erreichbare Felder, das eigene zuerst, dann nach Weglänge */
export function spots(u: Unit): number[] {
  const here = idx(u.x, u.y);
  if (!canMove(u)) return [here];
  const cost = reachCost(u).cost;
  return [...cost.keys()].sort((a, b) => (a === here ? -1 : b === here ? 1 : cost.get(a)! - cost.get(b)!));
}
/**
 * Was ein Wisch auf Feld i bedeutet:
 * eigener Klecks: Soak. Rivale oder Rivalen-Palette: vom nächsten passenden Feld aus spritzen.
 * Papier oder Farbe: hinlaufen und dort stempeln, sonst vom nächsten Feld in Reichweite stempeln.
 */
export function planDrop(u: Unit, i: number): Plan | null {
  if (u.state !== 'sheet' || u.acted || !inside(i % COLS, Math.floor(i / COLS))) return null;
  const here = idx(u.x, u.y);
  if (i === here) return { to: here, a: 'soak', at: null };
  const t = unitAt(i % COLS, Math.floor(i / COLS));
  if (t && t.side === u.side) return null;
  const sp = spots(u);
  if (t || i === foeTeam(u).home) {
    const p = sp.find((q) => atSpot(u, q, () => splashCells(u).includes(i)));
    return p === undefined ? null : { to: p, a: 'splash', at: i };
  }
  if (S.cells[i]!.home) return null;
  if (sp.includes(i)) return { to: i, a: 'stamp', at: i };
  const p = sp.find((q) => atSpot(u, q, () => canPaintAt(u, i)));
  return p === undefined ? null : { to: p, a: 'stamp', at: i };
}
/** Lässt sich dieser Zug mit einem Wisch (oder dem Goldknopf auf dem Feld, wo der Klecks steht) ausführen? */
export function byGesture(c: Plan & { u: Unit }): boolean {
  const here = idx(c.u.x, c.u.y);
  if (c.a === 'soak' || c.a === 'ability') return c.to === here;
  if (c.at === null) return false;
  const p = planDrop(c.u, c.at);
  return !!p && p.to === c.to && p.a === c.a && p.at === c.at;
}

function aiAction(side: Side, look: number, r: Rand): boolean {
  const cands = candidates(side);
  if (!cands.length) return false;
  const b = pickBest(cands, look, r, (c) => c.a === 'ability' || (c.a === 'splash' && c.at === foeTeam(c.u).home));
  if (b.v <= 0.05) return false;
  emit({ k: 'focus', id: b.u.id, to: b.to, at: b.at, a: b.a });
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
      const pick = aiChooseDice(team, look, r);
      let rolled = pick.length ? rollDice(team, pick) : [];
      if (rolled.length) {
        // Halten und einmal neu werfen, dann gilt der Wurf
        for (let k = 0; k < 2 && S.rerolls > 0; k++) {
          const hold = aiHold(team, rolled);
          if (hold.length >= rolled.length) break;
          rolled = rerollDice(team, hold);
        }
        rolled = applyRoll(team);
      }
      stage = 1;
      const s = aiSummon(side, rolled, look, r);
      if (s) logAdd(`${side === 2 ? 'Rival' : 'You'} ${s}.`, side === 2 ? 'rival' : 'you');
      if (s) {
        S.joker = 0;
        S.freeJoker = 0;
        S.starBonus = 0;
      }
      while (S.joker > 0) takeJoker(team, aiJokerCrest(team));
      sync();
      return true;
    }
    if (guard++ > 8) return false;
    const ok = aiAction(side, look, r);
    if (!ok) return false;
    return !checkWipe();
  };
}

/** Zufälliger Beutel aus 6 Monstern (für Simulation und Tests) */
export function randomBag(r: Rand, salt: string): Monster[] {
  return Array.from({ length: BAG }, () => mk(salt + Math.floor(r() * 1e6), Math.floor(r() * 12)));
}
/** Viele Duelle ohne Darstellung, zum Abstimmen der Stufen */
export function simulate(p1: number, p2: Level, n: number): Record<string, unknown> {
  S.headless = true;
  const res = { p1: 0, p2: 0, draw: 0, palette: 0, wipes: 0 };
  S.tally = {};
  for (let g = 0; g < n; g++) {
    const seed = 1000 + g * 7919;
    const r = RNG(seed);
    newGame(seed, p2, randomBag(r, 'Y'), randomBag(r, 'R'), seed);
    aiOpening(2, p2);
    aiOpening(1, 'master');
    const pick = () => {
      if (!TUNE.media) return;
      for (const side of [1, 2] as Side[]) {
        const o = (S.teams[side - 1]!.media?.length ?? 0) < MEDIA_MAX ? makeOffer(side, side === 1 ? START_MEDIA : MEDIA.map((m) => m.id)) : [];
        if (o.length) takeMedium(side, aiMedium(o));
      }
    };
    pick();
    let guard = 0;
    while (!S.over && guard++ < 40) {
      if (offerRound(S.round) && S.teams[0].media!.length < S.round) pick();
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
