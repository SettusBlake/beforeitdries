/*
 * Würfel als Sammelobjekt. Die Seltenheit kommt vom Papier, das jedes Monster ohnehin würfelt.
 * Legendary sind seltene Papiere, die nur hier vergeben werden. Chancen, Schutz vor Pech und Preise stehen hier.
 */
import type { GiftState } from './daily';
import type { Streak } from './streak';
import type { PaperId, PigmentId } from './data';
import type { ColorId } from './colors';
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

/**
 * Änderung an einer Würfelseite, der Reihe nach angewendet: Lasur (x2) oder Patina (p: x2, x3 oder mix).
 * to 'c' färbt die Seite um (Tropfen, Kampf A Schritt 4): c ist das neue Pigment, gilt nach den Farben aus dem Seed
 */
export type FaceMod = { i: number; to: 'x2' | 'x3' | 'mix' | 'c'; p?: 1; c?: PigmentId };
/** Tropfen (Kampf A Schritt 4): so viele färben eine Seite um. 5 statt 3 seit 01.11.2026 (erste Umfärbung nach ein paar Tagen, ohne Tageslimit) */
export const DROP_COST = 5;
/** Höchstens so viele umgefärbte Seiten je Würfel (festgelegt am 01.11.2026, „umfärben etwas begrenzen“) */
export const TINT_MAX = 2;
/** Patina (festgelegt am 30.10.2026): nach so vielen Würfen im Duell wird jeweils eine zufällige Seite besser */
export const PATINA = [10, 30, 60];
/**
 * Ein Würfel in der Sammlung: Bogen-Seed und Nummer des Monsters, seltenes Papier, Lasuren auf Seiten.
 * no ist die Seriennummer über alle Spieler, der Seed des Monsters gehört nur diesem Würfel (Register am Server).
 */
export type DieRec = {
  id: string;
  sheet: string;
  idx: number;
  paper?: PaperId;
  mods: FaceMod[];
  at: number;
  no?: number;
  gen?: 2;
  draw?: string;
  style?: StyleId;
  holo?: 1;
  rolls?: number;
  patina?: number;
  /** Startwürfel: bleibt beim Spieler, nicht tausch- oder verkaufbar (festgelegt am 31.10.2026) */
  bound?: 1;
  /** Herkunft: durch wessen Hände der Würfel ging (höchstens TRADE.histMax Einträge) */
  hist?: Hist[];
};
/** Ein Eintrag der Herkunft: gezogen, getauscht oder gekauft, von wem, wann, für wie viel */
export type Hist = { u: string; at: number; how: 'pull' | 'trade' | 'market'; p?: number };
/**
 * Tausch und Markt (festgelegt am 31.10.2026, docs/entwuerfe/tausch-und-markt-plan.md). Nur gegen Pigment, nie gegen Geld
 * oder Reddit Gold. Handeln ab einem Reddit-Konto von minDays Tagen und minDuels fertigen Duellen
 */
export const TRADE = {
  minDuels: 5,
  minDays: 7,
  /** Tausche am Tag (Angebot schicken oder annehmen) und Käufe am Tag */
  perDay: 3,
  buysPerDay: 5,
  /** offene Angebote, Würfel im Markt, Würfel je Seite, Pigment je Angebot */
  openOffers: 5,
  listings: 5,
  maxDice: 3,
  maxPig: 500,
  /** Laufzeit von Angeboten und Markt-Einträgen */
  days: 3,
  /** Gebühr im Markt: ein Zehntel verschwindet */
  fee: 0.1,
  minPrice: 10,
  maxPrice: 50_000,
  histMax: 10,
};
/** Gebühr und Erlös eines Verkaufs */
export const marketFee = (price: number): number => Math.max(1, Math.floor(price * TRADE.fee));
/** Richtwert, solange es keine Verkäufe gibt: aus dem Ziehen (ein Zug 100 Pigment), Holo dreifach, Stil doppelt */
export const PRICE_BAND: Record<Rarity, [number, number]> = { common: [40, 90], uncommon: [80, 180], rare: [300, 520], epic: [1800, 2600], legendary: [8000, 12000] };
export const priceKey = (r: Rarity, holo: boolean, style: boolean): string => `${r}${holo ? ':h' : ''}${style ? ':s' : ''}`;
export function defaultBand(r: Rarity, holo: boolean, style: boolean): [number, number] {
  const k = (holo ? 3 : 1) * (style ? 2 : 1);
  const [a, b] = PRICE_BAND[r];
  return [a * k, b * k];
}
/** Nachricht für Sepia: verkauft, getauscht, abgelehnt, zurück. Sie sagt es einmal beim Öffnen von „Your dice“ */
export type News = { k: 'sold' | 'traded' | 'declined' | 'back' | 'offer' | 'named'; text: string; at: number; pig?: number };

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
export const HOLO_ODDS = '1 in 500';
/**
 * Ab welcher Zahl die Hand trifft. Holo 1 zu 500 seit 07.11.2026 (goldener W100 auf 99 oder 100).
 * Gilded weekend (Samstag und Sonntag UTC, festgelegt am 07.11.2026): Stil und Holo eine Zahl früher,
 * weißer W100 auf 99 oder 100 (Stil doppelt), goldener W100 auf 98 bis 100 (Holo 1,5-fach). docs/entwuerfe/holo-chance-vorschlag.md
 */
export const HAND_AT = { style: 100, holo: 99 };
export const GILDED_AT = { style: 99, holo: 98 };
export const handAt = (gilded?: boolean): { style: number; holo: number } => (gilded ? GILDED_AT : HAND_AT);
/** Gilded weekend nach der Uhr des Servers: Samstag und Sonntag UTC, wie das Tagesblatt */
export const isGilded = (now: number): boolean => {
  const wd = new Date(now).getUTCDay();
  return wd === 0 || wd === 6;
};
/**
 * Die Hand: weißer W100 (ab HAND_AT.style: Stil-W20) und goldener W10 (10: goldener W100, ab HAND_AT.holo: Holo). Alle Würfe offen.
 * Mit einem volleren Pinsel (Reicher Zug, 07.11.2026) wirft die Hand jeden Würfel mehrmals, der beste zählt: hands, golds, goldD100s.
 * Reihenfolge der Zufallsaufrufe wie bisher, nur die Schwellen hängen am Wochenende
 */
export type HandRoll = { hand: number; styleRoll?: number; style?: StyleId; gold: number; goldD100?: number; holo?: true; hands?: number[]; golds?: number[]; goldD100s?: number[] };
export function rollHand(rand: () => number, throws = 1, gilded = false): HandRoll {
  const at = handAt(gilded);
  if (throws <= 1) {
    const out: HandRoll = { hand: 1 + (rand() % 100), gold: 1 + (rand() % 10) };
    if (out.hand >= at.style) {
      out.styleRoll = 1 + (rand() % STYLE_DIE);
      out.style = styleFromRoll(out.styleRoll);
    }
    if (out.gold === 10) {
      out.goldD100 = 1 + (rand() % 100);
      if (out.goldD100 >= at.holo) out.holo = true;
    }
    return out;
  }
  const hands = Array.from({ length: throws }, () => 1 + (rand() % 100));
  const golds = Array.from({ length: throws }, () => 1 + (rand() % 10));
  const out: HandRoll = { hand: Math.max(...hands), gold: Math.max(...golds), hands, golds };
  if (out.hand >= at.style) {
    out.styleRoll = 1 + (rand() % STYLE_DIE);
    out.style = styleFromRoll(out.styleRoll);
  }
  if (out.gold === 10) {
    const ds = Array.from({ length: throws }, () => 1 + (rand() % 100));
    out.goldD100s = ds;
    out.goldD100 = Math.max(...ds);
    if (out.goldD100 >= at.holo) out.holo = true;
  }
  return out;
}
/** Den besten Wurf einer Reihe auf v setzen (Test-Knopf), damit Anzeige und Ergebnis zusammenpassen */
const setBest = (a: number[] | undefined, v: number): void => {
  if (a?.length) a[a.indexOf(Math.max(...a))] = v;
};
/** Test-Knopf: der nächste Zug mit diesem Stil und, wenn gewählt, mit Holo (Würfe so, wie sie dafür fallen müssten) */
export function forcedHand(style: StyleId | undefined, holo: boolean, rand: () => number, throws = 1, gilded = false): HandRoll {
  const at = handAt(gilded);
  const out = rollHand(rand, throws, gilded);
  if (style) {
    Object.assign(out, { hand: 100, styleRoll: styleDef(style).from, style });
    setBest(out.hands, 100);
  } else if (out.hand >= at.style) {
    Object.assign(out, { hand: at.style - 1, styleRoll: undefined, style: undefined });
    if (out.hands) out.hands = out.hands.map((v) => Math.min(v, at.style - 1));
  }
  if (holo) {
    Object.assign(out, { gold: 10, goldD100: 100, holo: true });
    setBest(out.golds, 10);
    if (throws > 1) {
      out.goldD100s ??= Array.from({ length: throws }, () => 1 + (rand() % 99));
      setBest(out.goldD100s, 100);
    }
  }
  return out;
}
/**
 * Pinsel beim Ziehen (Reicher Zug, festgelegt am 07.11.2026, docs/entwuerfe/reicher-zug-vorschlag.md): ein vollerer Pinsel kostet mehr,
 * die Hand wirft dafür jeden ihrer Würfel zwei- oder dreimal und der beste zählt. Seltenheit, Schutz vor Pech und Stil-W20 bleiben.
 * Freie Züge sind immer der einfache Pinsel. Chancen: 1 − (1 − p)^Würfe, für Holo beide goldenen Würfel.
 * style und holo unter der Woche, styleG und holoG am Gilded weekend
 */
export type BrushId = 'plain' | 'loaded' | 'dripping';
export const BRUSHES: { k: BrushId; label: string; cost: number; throws: number; style: string; holo: string; styleG: string; holoG: string }[] = [
  { k: 'plain', label: 'Plain brush', cost: 100, throws: 1, style: '1 %', holo: '0.2 %', styleG: '2 %', holoG: '0.3 %' },
  { k: 'loaded', label: 'Loaded brush', cost: 300, throws: 2, style: '2 %', holo: '0.75 %', styleG: '4 %', holoG: '1.12 %' },
  { k: 'dripping', label: 'Dripping brush', cost: 700, throws: 3, style: '3 %', holo: '1.59 %', styleG: '5.9 %', holoG: '2.37 %' },
];
export const brushDef = (k: BrushId | undefined): (typeof BRUSHES)[number] => BRUSHES.find((b) => b.k === k) ?? BRUSHES[0]!;
export const isBrush = (v: unknown): v is BrushId => typeof v === 'string' && BRUSHES.some((b) => b.k === v);
/** Chancen eines Pinsels zum Zeigen, je nachdem ob gerade Gilded weekend ist */
export const brushOdds = (b: (typeof BRUSHES)[number], gilded?: boolean): { style: string; holo: string } => (gilded ? { style: b.styleG, holo: b.holoG } : { style: b.style, holo: b.holo });
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
export const GALLERY = { near: [0.1, 0.25], activeDays: 14, swaps: 1, reportsPerDay: 5 };

/** Sammlung eines Spielers. Liegt als JSON in Redis, hat keine Geheimnisse und geht so an den Client */
export type DiceSave = {
  /** 2: Stil und Holo getrennt (31.10.2026). 3: Startwürfel gebunden (31.10.2026). Ältere Stände werden beim Laden umgezogen */
  v: 1 | 2 | 3;
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
  /** Spielfarbe und Ausweichfarbe im Duell (fehlt: Ultramarine und Viridian) */
  color?: ColorId;
  color2?: ColorId;
  /** Fertige Duelle ohne Lern-Duell (gezählt seit 31.10.2026), Handeln ab TRADE.minDuels */
  duels?: number;
  /** Regeln nach und nach (Einstieg E2, src/shared/duel/stages.ts): Stufe 1 bis 6, neue Spieler beginnen bei 1. Fehlt: alles */
  stage?: number;
  /** Anlage des Reddit-Kontos (Zeit), einmal nachgesehen */
  born?: number;
  /** Tausche und Käufe am Tag tradeDay */
  tradeDay?: string;
  tradeN?: number;
  buyN?: number;
  /** Private Nachricht der App bei einem Angebot (im Menü einschaltbar, Standard aus) */
  tradeMsg?: true;
  /** Was Sepia beim nächsten Öffnen sagt (Verkäufe, Tausche, Rückgaben) */
  news?: News[];
  /** Schon abgeholte Lieferungen (gegen doppeltes Abholen) */
  postSeen?: string[];
  /** Tropfen je Pigment: Beute aus Duellen, DROP_COST färben eine Seite um */
  drops?: Partial<Record<PigmentId, number>>;
  /** Strähne beim Tagesblatt (src/shared/streak.ts) und fertige Wertungsläufe */
  streak?: Streak;
  /** Tagesgeschenk (T8, src/shared/daily.ts): so viele geöffnet, zuletzt an diesem UTC-Tag */
  gift?: GiftState;
  sheets?: number;
  /** Strähne als User-Flair (Schalter im Menü, Standard aus): Name, vorige Flair zum Zurücksetzen, zuletzt gezeigte Zahl */
  streakFlair?: { user: string; was?: string; shown?: number };
  /** Beitreten (T1): auf den Knopf getippt, und wie oft wir gefragt haben (höchstens zweimal) */
  joined?: true;
  joinAsked?: number;
};
export function emptyDice(): DiceSave {
  return { v: 3, dice: [], bag: [], pigment: 0, pity: { rare: 0, epic: 0, legendary: 0 }, glaze: {}, starter: STARTER_PULLS, freeDay: '', rewardDay: '', rewardN: 0, tutorialPaid: false, pulls: 0, next: 1 };
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
  /** Vollerer Pinsel: alle Würfe der Hand (der beste steht in hand, gold, goldD100) und welcher Pinsel */
  hands?: number[];
  golds?: number[];
  goldD100s?: number[];
  brush?: BrushId;
  /** Gilded weekend: die Hand traf eine Zahl früher (Stil ab 99, Holo ab 98) */
  gilded?: true;
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
