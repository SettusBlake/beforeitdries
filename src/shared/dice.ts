/*
 * Würfel als Sammelobjekt. Die Seltenheit kommt vom Papier, das jedes Monster ohnehin würfelt.
 * Legendary sind seltene Papiere, die nur hier vergeben werden. Chancen, Schutz vor Pech und Preise stehen hier.
 */
import type { PaperId } from './data';
import type { MediumId } from './duel/media';
import { humidityFor, makeMonster, speciesKey, type Monster } from './monster';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
/** Grenzen des offenen W100-Wurfs je Seltenheit */
export const RARITIES: { k: Rarity; label: string; paper: PaperId | null; from: number; to: number; col: string; glaze: number }[] = [
  { k: 'common', label: 'Common', paper: 'schul', from: 1, to: 50, col: '#7d8291', glaze: 1 },
  { k: 'uncommon', label: 'Uncommon', paper: 'zeichen', from: 51, to: 80, col: '#2e7a57', glaze: 2 },
  { k: 'rare', label: 'Rare', paper: 'buetten', from: 81, to: 95, col: '#2b6fa3', glaze: 3 },
  { k: 'epic', label: 'Epic', paper: 'hadern', from: 96, to: 99, col: '#7a3fa3', glaze: 5 },
  { k: 'legendary', label: 'Legendary', paper: null, from: 100, to: 100, col: '#b8860b', glaze: 10 },
];
export const LEGENDARY_PAPERS: PaperId[] = ['washi', 'vellum'];
export const rarityIndex = (r: Rarity): number => RARITIES.findIndex((x) => x.k === r);
export const rarityDef = (r: Rarity) => RARITIES[rarityIndex(r)]!;
export function rarityOf(paper: PaperId): Rarity {
  return RARITIES.find((r) => r.paper === paper)?.k ?? 'legendary';
}
export const rarityFromRoll = (d100: number): Rarity => (RARITIES.find((r) => d100 >= r.from && d100 <= r.to) ?? RARITIES[0]!).k;

/** Lasur auf einer Würfelseite: ein einfaches Symbol wird doppelt */
export type FaceMod = { i: number; to: 'x2' };
/**
 * Ein Würfel in der Sammlung: Bogen-Seed und Nummer des Monsters, seltenes Papier, Lasuren auf Seiten.
 * no ist die Seriennummer über alle Spieler, der Seed des Monsters gehört nur diesem Würfel (Register am Server).
 */
export type DieRec = { id: string; sheet: string; idx: number; paper?: PaperId; mods: FaceMod[]; at: number; no?: number; gen?: 2; draw?: string };
/** Seriennummer zum Zeigen: #00427 */
export const serialText = (no: number | undefined): string => (no ? '#' + String(no).padStart(5, '0') : '');

export function dieMonster(d: { sheet: string; idx: number; paper?: PaperId; gen?: 2; draw?: string }): Monster {
  const m = makeMonster(d.sheet, d.idx, humidityFor(d.sheet));
  if (d.paper) m.paper = d.paper;
  // Neue Würfel haben die neuen Formen, ältere bleiben, wie sie waren
  if (d.gen) m.gen = d.gen;
  // Selbst gemalt: die Zeichnung ist die Form
  if (d.draw) m.draw = d.draw;
  return m;
}

export const PULL_COST = 100;
export const TEN_COST = 1000;
export const STARTER_PULLS = 9;
export const GLAZE_COST = 3;
/** Spätestens nach so vielen Zügen kommt diese Seltenheit oder besser */
export const PITY: Record<'rare' | 'epic' | 'legendary', number> = { rare: 10, epic: 40, legendary: 90 };
/** Pigment fürs Duell (höchstens perDay belohnte Duelle am Tag), fürs Lern-Duell einmal und später fürs Benennen einer Art */
export const REWARD = { win: 60, draw: 40, loss: 25, perDay: 5, tutorial: 200, name: 50 };

/** Sammlung eines Spielers. Liegt als JSON in Redis, hat keine Geheimnisse und geht so an den Client */
export type DiceSave = {
  v: 1;
  dice: DieRec[];
  /** IDs der Würfel im Beutel, höchstens 6 */
  bag: string[];
  pigment: number;
  /** Züge seit dem letzten Rare (oder besser), Epic (oder besser) und Legendary */
  pity: Record<'rare' | 'epic' | 'legendary', number>;
  /** Lasur je Art (Bauplan:Pigment), kommt aus ausgewaschenen Würfeln */
  glaze: Record<string, number>;
  /** Freie Startzüge, die noch offen sind */
  starter: number;
  /** Tag (UTC) des letzten freien Tageszugs */
  freeDay: string;
  /** Belohnte Duelle am Tag rewardDay */
  rewardDay: string;
  rewardN: number;
  tutorialPaid: boolean;
  pulls: number;
  next: number;
  /** Freigeschaltete Malmittel (fehlt: die Startauswahl) */
  media?: MediumId[];
  /** Leere Würfel zum Selbstmalen (Blank canvas) und die Woche, deren freier schon gutgeschrieben ist */
  blank?: number;
  blankWeek?: string;
};
export function emptyDice(): DiceSave {
  return { v: 1, dice: [], bag: [], pigment: 0, pity: { rare: 0, epic: 0, legendary: 0 }, glaze: {}, starter: STARTER_PULLS, freeDay: '', rewardDay: '', rewardN: 0, tutorialPaid: false, pulls: 0, next: 1 };
}
export type PullKind = 'starter' | 'free' | 'one' | 'ten';
/** Ein Zug: der offene W100, die Seltenheit und das neue Monster. Jeder Zug bleibt als eigener Würfel */
export type PullResult = {
  d100: number;
  rarity: Rarity;
  /** Schutz vor Pech hat gegriffen: diese Seltenheit war garantiert */
  pity: 'rare' | 'epic' | 'legendary' | 'ten' | null;
  die: DieRec;
  /** Diese Art hatte man schon (Artschlüssel), sonst null. Der Würfel bleibt trotzdem */
  dup: string | null;
  /** Der W100 zeigte 1: dazu ein leerer Würfel zum Selbstmalen */
  blank?: true;
};
/**
 * Leere Würfel (festgelegt am 30.10.2026): jede Woche einer, der freie füllt höchstens bis BLANK.max auf.
 * Dazu ein Fund, wenn der W100 beim Ziehen BLANK.find zeigt (zählt immer, auch über max).
 */
export const BLANK = { max: 2, find: 1 };
/** Ausgewaschen gibt ein Würfel so viel Lasur für seine Art */
export const washGlaze = (r: Rarity): number => rarityDef(r).glaze;
/** So viele Würfel bleiben mindestens, damit das Deck voll wird */
export const KEEP_MIN = 9;
export const dieSpecies = (d: DieRec): string => speciesKey(dieMonster(d));
