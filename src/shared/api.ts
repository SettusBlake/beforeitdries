import type { StreakState, StreakStep } from './streak';
import type { ElementId } from './elements';
import type { BleachScore } from './duel/bleach';
/* Datenformate zwischen Server und Client */
import type { MediumId } from './duel/media';
import type { PigmentId } from './data';
import type { DuelState } from './duel/play';
import type { Ev, Face } from './duel/rules';
import type { DiceSave, DieRec, PullResult, Rarity } from './dice';
import type { ColorId } from './colors';

/** postData des Spiel-Posts (Duell und Würfel) */
export interface PlayPostData {
  [key: string]: string | number;
  kind: 'play';
}
/** postData eines „What do you see?“-Posts (der Zustand liegt in Redis unter naming:{postId}) */
export interface NamePostData {
  [key: string]: string | number;
  kind: 'name';
}
/** postData des Tagesposts (Bleach): der Tag, Rangliste in Redis */
export interface SheetPostData {
  [key: string]: string | number;
  kind: 'sheet';
  day: string;
}
/** Eine Zeile der Rangliste im Tagespost */
export interface SheetRow {
  rank: number;
  name: string;
  points: number;
  sheet?: string;
  col?: ColorId;
  hearts?: number;
  me?: boolean;
  /** Strähne (nur in deiner eigenen Zeile) */
  streak?: number;
}
/** Was der Tagespost zeigt: heute mit Knopf und laufender Rangliste, danach die fertige mit dem besten Blatt */
export interface SheetResponse {
  day: string;
  /** Der Tag läuft noch (UTC) */
  today: boolean;
  colour: PigmentId;
  players: number;
  top: SheetRow[];
  /** Dein Platz (auch außerhalb der Top 10) */
  me: SheetRow | null;
  user: boolean;
  unlocked: boolean;
  running: boolean;
  /** Pales je Welle und die Welle mit dem großen */
  waves: number[];
  bossWave: number;
  now: number;
}
/** Antwort auf „Share as a comment“ */
export interface ShareSheetResponse {
  postId: string;
  url: string;
  text: string;
}

/** Kurzer Stand für das Startbild des Spiel-Posts */
export interface PlayInfo {
  user: boolean;
  /** Ein Duell läuft und lässt sich fortsetzen */
  running: boolean;
  starter: number;
  freeReady: boolean;
  pigment: number;
}

export type ErrorCode = 'login' | 'not_found' | 'forbidden' | 'busy' | 'bad_request' | 'server' | 'outdated';
/**
 * Stand des Duell-Ablaufs (Aktionen, Phasen, Ereignisse). Bei jeder Änderung erhöhen: Der Client schickt ihn mit,
 * der Server lehnt alte Oberflächen ab und bittet, den Post neu zu öffnen (sonst passen Anzeige und Regeln nicht zusammen)
 */
/** Testdaten vor dem Start entfernt (Playtest, nur Mods): erfundene Maler, noch laufende Bereinigungen, entfernte Posts, abgesagte Benennen */
export type CleanTestResponse = { painters: number; pending: number; posts: number; namings: number; errors: string[] };
export const DUEL_PROTOCOL = 20;
export const PROTO_HEADER = 'x-bid-proto';

export interface ErrorResponse {
  error: string;
  code: ErrorCode;
}

/** Antwort auf jede Duell-Anfrage: Ereignisse zum Abspielen und der Stand danach */
export interface DuelResponse {
  state: DuelState | null;
  events: Ev[];
  reward?: DuelReward;
  /** Bleach: Punkte und Rang, sobald das Tagesblatt fertig ist */
  bleach?: BleachResult;
}
/** Ergebnis eines Bleach-Laufs. ranked false: Testlauf (Playtest, nur Mods), zählt nicht */
export interface BleachResult {
  day: string;
  points: number;
  parts: BleachScore;
  ranked: boolean;
  rank?: number;
  players?: number;
  /** Endstand als Blatt-Code (src/shared/sheet.ts), daraus malt der Tagespost die kleinen Blätter */
  sheet?: string;
  /** Spielfarbe des Malers */
  col?: ColorId;
  /** Schon als Kommentar geteilt (höchstens einmal am Tag) */
  shared?: boolean;
  /** Erst nach Mitternacht (UTC) fertig: zählt nicht mehr für die Rangliste des Tages */
  late?: true;
  /** Strähne nach diesem Lauf (nur Wertungsläufe) */
  streak?: StreakStep;
}
/** Was das Startbild zu Bleach zeigt (Tagesblatt): läuft gerade, schon gespielt, Rangliste oben */
export interface BleachInfo {
  day: string;
  colour: PigmentId;
  /** Erst nach dem Lern-Duell */
  unlocked: boolean;
  running: boolean;
  played: BleachResult | null;
  players: number;
  top: { name: string; points: number }[];
  waves: number;
  pales: number;
  /** Playtest und Mod: Test-Knopf für ein neues Blatt */
  tester?: boolean;
  /** Strähne am heutigen Tag, flair: als User-Flair eingeschaltet */
  streak: { n: number; state: StreakState; best: number };
  flair?: boolean;
}

/** Antwort der Würfel-Anfragen: die ganze Sammlung, dazu Züge und ob der freie Tageszug bereit ist */
export interface DiceResponse {
  dice: DiceSave;
  freeReady: boolean;
  pulls: PullResult[];
  /** Nur im Playtest und nur für Mods: Test-Knopf für leere Würfel (kommt mit dem Laden der Sammlung) */
  tester?: boolean;
  /** Mod des Subreddits: sieht die Prüfliste der Zeichnungen, review = so viele warten (kommt mit dem Laden der Sammlung) */
  mod?: boolean;
  review?: number;
  /** Dein Deck in der Galerie (kommt mit dem Laden der Sammlung, nach Abholen und Schalter) */
  gallery?: GalleryStatus;
  /** Markt und Tausch: offene Angebote an dich, deine Einträge im Markt, Einträge insgesamt (kommt mit dem Laden der Sammlung) */
  trade?: TradeStatus;
}
/** Darf dieser Spieler handeln? why: der Grund, wenn nicht */
export type TradeGate = { ok: boolean; why?: string };
export type TradeStatus = { offers: number; listed: number; market: number; gate: TradeGate };
/** Ein Würfel im Markt. mine: dein eigener Eintrag */
export type MarketItem = { id: string; seller: string; die: DieRec; price: number; at: number; until: number; rarity: Rarity; mine?: true };
/** Filter im Markt, dazu je Element (01.11.2026) */
export type MarketFilter = 'all' | 'rare' | 'holo' | 'style' | 'drawn' | ElementId;
export type MarketSort = 'new' | 'cheap' | 'dear';
export interface MarketResponse {
  items: MarketItem[];
  /** Deine Einträge, auch abgelaufene, bis sie zurück sind */
  mine: MarketItem[];
  /** Richtwert je Seltenheit (priceKey): mittlere Hälfte der Verkäufe der letzten 7 Tage, sonst aus dem Ziehen */
  hint: Record<string, [number, number]>;
  /** Wie viele Verkäufe dahinterstehen (0: Richtwert aus dem Ziehen) */
  hintN: Record<string, number>;
  gate: TradeGate;
  buys: number;
  /** Deine Sammlung nach Verkaufen, Kaufen oder Zurückziehen */
  dice?: DiceResponse;
}
/** Ein Tauschangebot. dir: an dich (in) oder von dir (out) */
export type TradeOffer = { id: string; from: string; to: string; give: DieRec[]; pig: number; want: DieRec[]; at: number; until: number; dir: 'in' | 'out' };
export interface TradeResponse {
  offers: TradeOffer[];
  gate: TradeGate;
  trades: number;
  dice?: DiceResponse;
}
/** Die handelbaren Würfel eines anderen Spielers */
export type TradeCollection = { name: string; dice: DieRec[]; can: boolean; why?: string };
/** Bilanz eines Galerie-Decks: gewonnen, verloren, unentschieden */
export type GalleryRecord = { w: number; l: number; d: number };
/** Dein Deck in der Galerie: hängt es, Bilanz, und was seit dem letzten Abholen passiert ist */
export interface GalleryStatus {
  hung: boolean;
  off: boolean;
  rec: GalleryRecord;
  /** Seit dem letzten Abholen: Duelle aus Sicht deines Decks, Pigment und die Namen der letzten Herausforderer */
  inbox: (GalleryRecord & { pig: number; who: string[] }) | null;
}
/** Ein Deck aus der Galerie zur Vorschau. Zeichnungen nur, wenn ein Mod sie freigegeben hat */
export interface GalleryView {
  name: string;
  dice: DieRec[];
  power: number;
  /** Stärke deines Decks zum Vergleich */
  mine: number;
  rec: GalleryRecord;
  /** Aufgehängt (Ende des letzten Duells des Besitzers) */
  at: number;
  /** Noch erlaubte Tausche („Another deck“) */
  swaps: number;
  /** Test-Schalter: das eigene Deck */
  self?: boolean;
  /** Spielfarbe des Besitzers */
  color?: ColorId;
}
export interface GalleryResponse {
  /** null: kein passendes Deck in der Galerie */
  foe: GalleryView | null;
}
/** Benennen: Zustand eines „What do you see?“-Posts */
/** withdrawn: der Kommentar mit dem Namen wurde gelöscht, die Art ist wieder offen */
export type NamingStatus = 'open' | 'named' | 'empty' | 'cancelled' | 'withdrawn';
export interface NamingInfo {
  postId: string;
  /** Art (Bauplan:Pigment) */
  key: string;
  /** Finder */
  uid: string;
  user: string;
  /** Der Würfel, wie er beim Teilen war (zum Malen im Post) */
  die: DieRec;
  at: number;
  ends: number;
  status: NamingStatus;
  name?: string;
  namedBy?: string;
  /** Kommentar mit dem Namen (wird er gelöscht, ist die Art wieder offen) */
  commentId?: string;
  /** Sepias Bestiary-Kommentar (wird mit dem Namen gelöscht) */
  sayId?: string;
}
export interface NamingResponse {
  naming: NamingInfo | null;
  now: number;
}
/** Namen aller benannten Arten und die gerade offenen Posts (Art → Post) */
export interface SpeciesResponse {
  names: Record<string, { name: string; namedBy: string }>;
  open: Record<string, string>;
}
/** Nach dem Teilen: der neue Post */
export interface ShareResponse extends DiceResponse {
  postId: string;
  url: string;
}
/** Eine gemalte Zeichnung in der Prüfliste der Mods. key = {userId}:{Würfel-ID} */
export interface ReviewItem {
  key: string;
  uid: string;
  user: string;
  id: string;
  no: number;
  seed: number;
  draw: string;
  at: number;
  /** Von Spielern gemeldet (so oft), steht oben in der Liste */
  reported?: number;
}
/** Ein Spieler, der gerade nicht malen darf */
export interface LockedPlayer {
  uid: string;
  user: string;
  /** Übermalte Zeichnungen seit der letzten Aufhebung */
  strikes: number;
  lock: number | 'mod';
}
/** Prüfliste: neue Zeichnungen (älteste zuerst) und gesperrte Spieler */
export interface ReviewResponse {
  items: ReviewItem[];
  locked: LockedPlayer[];
}
/** Pigment nach einem Duell */
export interface DuelReward {
  pigment: number;
  why: 'win' | 'draw' | 'loss' | 'tutorial' | 'capped' | 'bleach';
  total: number;
  /** Neu freigeschaltetes Malmittel */
  unlocked?: MediumId;
  /** Patina: diese Würfel haben eine Seite verbessert (level 1 bis 3, Seite i wurde x2, x3 oder Mischseite) */
  patina?: { id: string; level: number; i: number; to: 'x2' | 'x3' | 'mix'; name: string; face: Face }[];
  /** Tropfen (Kampf A Schritt 4): je ausgewaschenem Rivalen-Klecks einer seines Hauptpigments, beim Sieg einer aus dem eigenen Deck */
  drops?: { pig: PigmentId; why: 'wash' | 'win' }[];
  /** Beitreten anbieten (T1): Name des Subreddits, beim ersten und fünften Ergebnis, nie nach einem Tipp darauf */
  join?: string;
}
