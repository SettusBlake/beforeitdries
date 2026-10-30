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
export type DieRec = { id: string; sheet: string; idx: number; paper?: PaperId; mods: FaceMod[]; at: number; no?: number; gen?: 2; draw?: string; style?: StyleId };

/** Shiny: ein anderer Malstil statt Aquarell, nur Aussehen */
export type StyleId = 'pencil' | 'comic' | 'plate' | 'anime' | 'oil';
/** Stil aus dem zweiten W10 (festgelegt am 30.10.2026: Pencil 3, Comic 2, Bestiary Plate 2, Anime 2, Oil 1) */
export const STYLES: { k: StyleId; label: string; from: number; to: number; odds: string }[] = [
  { k: 'pencil', label: 'Pencil', from: 1, to: 3, odds: '1 in 3333' },
  { k: 'comic', label: 'Comic', from: 4, to: 5, odds: '1 in 5000' },
  { k: 'plate', label: 'Bestiary Plate', from: 6, to: 7, odds: '1 in 5000' },
  { k: 'anime', label: 'Anime', from: 8, to: 9, odds: '1 in 5000' },
  { k: 'oil', label: 'Oil', from: 10, to: 10, odds: '1 in 10 000' },
];
export const styleFromRoll = (d10: number): StyleId => (STYLES.find((s) => d10 >= s.from && d10 <= s.to) ?? STYLES[0]!).k;
export const styleDef = (k: StyleId) => STYLES.find((s) => s.k === k)!;
export type ShinyRoll = { hand: number; d10?: number; styleD10?: number; style?: StyleId };
/** Die Hand: W100, bei 100 ein W10, bei 10 Shiny (1 zu 1000), dann ein W10 für den Stil. Würfe offen */
export function rollShiny(rand: () => number): ShinyRoll {
  const hand = 1 + (rand() % 100);
  if (hand !== 100) return { hand };
  const d10 = 1 + (rand() % 10);
  if (d10 !== 10) return { hand, d10 };
  const styleD10 = 1 + (rand() % 10);
  return { hand, d10, styleD10, style: styleFromRoll(styleD10) };
}
/** Test-Knopf: der nächste Zug ist Shiny in diesem Stil (Würfe so, wie sie dafür fallen müssten) */
export const forcedShiny = (k: StyleId): ShinyRoll => ({ hand: 100, d10: 10, styleD10: styleDef(k).from, style: k });
/** Seriennummer zum Zeigen: #00427 */
export const serialText = (no: number | undefined): string => (no ? '#' + String(no).padStart(5, '0') : '');

export function dieMonster(d: { sheet: string; idx: number; paper?: PaperId; gen?: 2; draw?: string; style?: StyleId }): Monster {
  const m = makeMonster(d.sheet, d.idx, humidityFor(d.sheet));
  if (d.paper) m.paper = d.paper;
  // Neue Würfel haben die neuen Formen, ältere bleiben, wie sie waren
  if (d.gen) m.gen = d.gen;
  // Selbst gemalt: die Zeichnung ist die Form
  if (d.draw) m.draw = d.draw;
  // Shiny: anderer Malstil
  if (d.style) m.style = d.style;
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
  /** Test-Knopf (Playtest, nur Mods): der nächste Zug ist Shiny in diesem Stil */
  forceShiny?: StyleId;
  /** Von Mods übermalte Zeichnungen (Seriennummern): Sepia sagt es beim nächsten Öffnen, danach weg */
  paintedOver?: number[];
  /** Malen gesperrt (nach übermalten Zeichnungen): bis zu dieser Zeit, 'mod' bis ein Mod es aufhebt */
  drawLock?: number | 'mod';
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
  /** Die Hand (W100), bei 100 der W10 für Shiny, bei Shiny der W10 für den Stil (steht dann im Würfel) */
  hand: number;
  shinyD10?: number;
  styleD10?: number;
  /** Shiny hebt Papier und Seltenheit eine Stufe (festgelegt am 30.10.2026): die Seltenheit danach. rarity bleibt der W100 */
  lifted?: Rarity;
};
/**
 * Leere Würfel (festgelegt am 30.10.2026): jede Woche einer, der freie füllt höchstens bis BLANK.max auf.
 * Dazu ein Fund, wenn der W100 beim Ziehen BLANK.find zeigt (zählt immer, auch über max).
 */
export const BLANK = { max: 2, find: 1 };
/**
 * Übermalen (festgelegt am 30.10.2026): lockAt-mal innerhalb von strikeDays Tagen sperrt das Malen lockDays Tage,
 * modAt-mal (seit der letzten Aufhebung) sperrt es, bis ein Mod es aufhebt
 */
export const PAINT_OVER = { strikeDays: 30, lockAt: 2, lockDays: 14, modAt: 3 };
/** Darf gerade nicht malen */
export const drawLocked = (s: Pick<DiceSave, 'drawLock'>, now: number): boolean => s.drawLock === 'mod' || (typeof s.drawLock === 'number' && s.drawLock > now);
/** Ausgewaschen gibt ein Würfel so viel Lasur für seine Art */
export const washGlaze = (r: Rarity): number => rarityDef(r).glaze;
/** So viele Würfel bleiben mindestens, damit das Deck voll wird */
export const KEEP_MIN = 9;
export const dieSpecies = (d: DieRec): string => speciesKey(dieMonster(d));
