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
/** Lasur (x2) oder Patina (p: x2, x3 oder mix) auf einer Seite, der Reihe nach angewendet */
export type FaceMod = { i: number; to: 'x2' | 'x3' | 'mix'; p?: 1 };
/** Patina (festgelegt am 30.10.2026): nach so vielen Würfen im Duell wird jeweils eine zufällige Seite besser */
export const PATINA = [10, 30, 60];
/**
 * Ein Würfel in der Sammlung: Bogen-Seed und Nummer des Monsters, seltenes Papier, Lasuren auf Seiten.
 * no ist die Seriennummer über alle Spieler, der Seed des Monsters gehört nur diesem Würfel (Register am Server).
 */
export type DieRec = { id: string; sheet: string; idx: number; paper?: PaperId; mods: FaceMod[]; at: number; no?: number; gen?: 2; draw?: string; style?: StyleId; holo?: 1; rolls?: number; patina?: number };

/** Stil: eine andere Malweise statt Aquarell, nur Aussehen (seit 31.10.2026 getrennt von Holo) */
export type StyleId = 'pencil' | 'comic' | 'plate' | 'anime' | 'oil' | 'pixel' | 'ukiyoe' | 'stained' | 'neon' | 'blueprint' | 'crayon' | 'papercut' | 'mosaic' | 'graffiti' | 'nouveau';
/** Seiten des Stilwurfs */
export const STYLE_DIE = 20;
/**
 * Stil aus dem W20 (festgelegt am 31.10.2026, docs/entwuerfe/stil-und-holo-plan.md): der weiße W100 zeigt 100 (1 zu 100),
 * dann fünf Stile mit je 2 Seiten (1 zu 1000 je Zug) und zehn mit je 1 Seite (1 zu 2000)
 */
export const STYLES: { k: StyleId; label: string; from: number; to: number; odds: string }[] = [
  { k: 'pencil', label: 'Pencil', from: 1, to: 2, odds: '1 in 1000' },
  { k: 'comic', label: 'Comic', from: 3, to: 4, odds: '1 in 1000' },
  { k: 'anime', label: 'Anime', from: 5, to: 6, odds: '1 in 1000' },
  { k: 'pixel', label: 'Pixel', from: 7, to: 8, odds: '1 in 1000' },
  { k: 'neon', label: 'Neon', from: 9, to: 10, odds: '1 in 1000' },
  { k: 'plate', label: 'Bestiary Plate', from: 11, to: 11, odds: '1 in 2000' },
  { k: 'crayon', label: 'Crayon', from: 12, to: 12, odds: '1 in 2000' },
  { k: 'oil', label: 'Oil', from: 13, to: 13, odds: '1 in 2000' },
  { k: 'ukiyoe', label: 'Ukiyo-e', from: 14, to: 14, odds: '1 in 2000' },
  { k: 'stained', label: 'Stained Glass', from: 15, to: 15, odds: '1 in 2000' },
  { k: 'blueprint', label: 'Blueprint', from: 16, to: 16, odds: '1 in 2000' },
  { k: 'papercut', label: 'Papercut', from: 17, to: 17, odds: '1 in 2000' },
  { k: 'mosaic', label: 'Mosaic', from: 18, to: 18, odds: '1 in 2000' },
  { k: 'graffiti', label: 'Graffiti', from: 19, to: 19, odds: '1 in 2000' },
  { k: 'nouveau', label: 'Art Nouveau', from: 20, to: 20, odds: '1 in 2000' },
];
export const styleFromRoll = (roll: number): StyleId => (STYLES.find((s) => roll >= s.from && roll <= s.to) ?? STYLES[0]!).k;
export const styleDef = (k: StyleId) => STYLES.find((s) => s.k === k)!;
/** Holo (das Shiny seit 31.10.2026): Folie über dem Bild, auf jedem Monster. Das Muster kommt aus dem Seed */
export type FoilId = 'rainbow' | 'stars' | 'diamond' | 'glitter';
export const FOILS: { k: FoilId; label: string }[] = [
  { k: 'rainbow', label: 'rainbow foil' },
  { k: 'stars', label: 'star foil' },
  { k: 'diamond', label: 'diamond foil' },
  { k: 'glitter', label: 'glitter foil' },
];
export const foilOf = (seed: number): FoilId => FOILS[(seed >>> 5) % FOILS.length]!.k;
export const HOLO_ODDS = '1 in 1000';
/** Die Hand: weißer W100 (100: Stil-W20) und goldener W10 (10: goldener W100, 100: Holo). Alle Würfe offen */
export type HandRoll = { hand: number; styleRoll?: number; style?: StyleId; gold: number; goldD100?: number; holo?: true };
export function rollHand(rand: () => number): HandRoll {
  const out: HandRoll = { hand: 1 + (rand() % 100), gold: 1 + (rand() % 10) };
  if (out.hand === 100) {
    out.styleRoll = 1 + (rand() % STYLE_DIE);
    out.style = styleFromRoll(out.styleRoll);
  }
  if (out.gold === 10) {
    out.goldD100 = 1 + (rand() % 100);
    if (out.goldD100 === 100) out.holo = true;
  }
  return out;
}
/** Test-Knopf: der nächste Zug mit diesem Stil und, wenn gewählt, mit Holo (Würfe so, wie sie dafür fallen müssten) */
export function forcedHand(style: StyleId | undefined, holo: boolean, rand: () => number): HandRoll {
  const out = rollHand(rand);
  if (style) Object.assign(out, { hand: 100, styleRoll: styleDef(style).from, style });
  else if (out.hand === 100) Object.assign(out, { hand: 99, styleRoll: undefined, style: undefined });
  if (holo) Object.assign(out, { gold: 10, goldD100: 100, holo: true });
  return out;
}
/** Seriennummer zum Zeigen: #00427 */
export const serialText = (no: number | undefined): string => (no ? '#' + String(no).padStart(5, '0') : '');

export function dieMonster(d: { sheet: string; idx: number; paper?: PaperId; gen?: 2; draw?: string; style?: StyleId; holo?: 1 }): Monster {
  const m = makeMonster(d.sheet, d.idx, humidityFor(d.sheet));
  if (d.paper) m.paper = d.paper;
  // Neue Würfel haben die neuen Formen, ältere bleiben, wie sie waren
  if (d.gen) m.gen = d.gen;
  // Selbst gemalt: die Zeichnung ist die Form
  if (d.draw) m.draw = d.draw;
  // Stil: andere Malweise. Holo: Folie darüber
  if (d.style) m.style = d.style;
  if (d.holo) m.holo = 1;
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
/** Gebühr für den Besitzer eines Galerie-Decks je Duell aus seiner Sicht, höchstens perDay am Tag (festgelegt am 31.10.2026) */
export const GALLERY_FEE = { win: 15, draw: 8, loss: 3, perDay: 60 };
/** Galerie: Gegner mit ähnlicher Stärke (erst 10 %, dann 25 % Abstand), aktiv heißt in den letzten 14 Tagen gespielt */
export const GALLERY = { near: [0.1, 0.25], activeDays: 14, swaps: 1 };

/** Sammlung eines Spielers. Liegt als JSON in Redis, hat keine Geheimnisse und geht so an den Client */
export type DiceSave = {
  /** 2: Stil und Holo getrennt (31.10.2026). Stände mit 1 werden beim Laden umgezogen */
  v: 1 | 2;
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
  /** Test-Knopf (Playtest, nur Mods): der nächste Zug hat diesen Stil und, wenn gesetzt, Holo */
  forceStyle?: StyleId;
  forceHolo?: true;
  /** Von Mods übermalte Zeichnungen (Seriennummern): Sepia sagt es beim nächsten Öffnen, danach weg */
  paintedOver?: number[];
  /** Malen gesperrt (nach übermalten Zeichnungen): bis zu dieser Zeit, 'mod' bis ein Mod es aufhebt */
  drawLock?: number | 'mod';
  /** Tag (UTC) des letzten „What do you see?“-Posts: höchstens einer pro Tag */
  nameDay?: string;
  /** Deck nicht in der Galerie aufhängen (Schalter im Menü) */
  galleryOff?: true;
  /** Test-Schalter (Playtest, nur Mods): Galerie-Duelle gegen das eigene Deck und Archiv, die Gebühr geht an dich */
  testSelf?: true;
};
export function emptyDice(): DiceSave {
  return { v: 2, dice: [], bag: [], pigment: 0, pity: { rare: 0, epic: 0, legendary: 0 }, glaze: {}, starter: STARTER_PULLS, freeDay: '', rewardDay: '', rewardN: 0, tutorialPaid: false, pulls: 0, next: 1 };
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
  /** Die Hand: weißer W100 (bei 100 der W20 für den Stil), goldener W10 (bei 10 der goldene W100, bei 100 Holo). Stil und Holo stehen im Würfel */
  hand: number;
  styleRoll?: number;
  gold: number;
  goldD100?: number;
  /** Holo hebt Papier und Seltenheit eine Stufe (festgelegt am 30.10.2026 für Shiny, seit 31.10.2026 nur Holo): die Seltenheit danach. rarity bleibt der W100 */
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
