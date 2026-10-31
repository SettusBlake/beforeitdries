/* Datenformate zwischen Server und Client */
import type { MediumId } from './duel/media';
import type { PigmentId } from './data';
import type { LogEntry } from './glaze';
import type { Monster } from './monster';
import type { DuelState } from './duel/play';
import type { Ev, Face } from './duel/rules';
import type { DiceSave, DieRec, PullResult, Rarity } from './dice';
import type { ColorId } from './colors';

/** Gespeichert unter monster:{id}. Nur Seed, Würfe und Zustand, nie das Bild. */
export interface MonsterRecord extends Monster {
  v: 1;
  id: string;
  /** Bogen-Seed = Datum des Tagesklecks (UTC, YYYY-MM-DD) */
  day: string;
  owner: string;
  ownerName: string;
  caughtAt: number;
  lastGlazeAt: number | null;
  sepia: string;
  log: LogEntry[];
}

export interface SpeciesInfo {
  key: string;
  name: string;
  namedBy: string;
  firstSeen: string;
}

/** postData des Tagesklecks-Posts, max. 2 KB */
export interface DayPostData {
  [key: string]: string | number;
  day: string;
  humidity: number;
}

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

/** Kurzer Stand für das Startbild des Spiel-Posts */
export interface PlayInfo {
  user: boolean;
  /** Ein Duell läuft und lässt sich fortsetzen */
  running: boolean;
  starter: number;
  freeReady: boolean;
  pigment: number;
}

export interface DayInfo {
  day: string;
  humidity: number;
  postId: string | null;
  /** Fangen geht nur, solange der Tag läuft (UTC) */
  catchable: boolean;
  catches: number;
  speciesKey: string;
  species: SpeciesInfo | null;
}

export interface InitResponse {
  user: { id: string; name: string } | null;
  /** Der Tagesklecks dieses Posts, null außerhalb eines Tages-Posts */
  day: DayInfo | null;
  /** Eigener Fang aus diesem Post */
  caught: MonsterRecord | null;
  todayPostId: string | null;
  collectionCount: number;
  serverNow: number;
  dryMs: number;
}

export interface CollectionResponse {
  monsters: MonsterRecord[];
  species: Record<string, SpeciesInfo>;
  serverNow: number;
  dryMs: number;
}

export interface CatchResponse {
  monster: MonsterRecord;
  fresh: boolean;
  species: SpeciesInfo | null;
  serverNow: number;
}

export interface GlazeRequest {
  id: string;
  pigment: PigmentId;
}

export interface GlazeResponse {
  monster: MonsterRecord;
  messages: LogEntry[];
  species: SpeciesInfo | null;
  serverNow: number;
  dryMs: number;
}

export type ErrorCode = 'login' | 'no_day' | 'dried' | 'not_found' | 'forbidden' | 'drying' | 'full' | 'busy' | 'bad_request' | 'server' | 'outdated';
/**
 * Stand des Duell-Ablaufs (Aktionen, Phasen, Ereignisse). Bei jeder Änderung erhöhen: Der Client schickt ihn mit,
 * der Server lehnt alte Oberflächen ab und bittet, den Post neu zu öffnen (sonst passen Anzeige und Regeln nicht zusammen)
 */
export const DUEL_PROTOCOL = 14;
export const PROTO_HEADER = 'x-bid-proto';

export interface ErrorResponse {
  error: string;
  code: ErrorCode;
  dryUntil?: number;
}

/** Antwort auf jede Duell-Anfrage: Ereignisse zum Abspielen und der Stand danach */
export interface DuelResponse {
  state: DuelState | null;
  events: Ev[];
  reward?: DuelReward;
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
export type MarketFilter = 'all' | 'rare' | 'holo' | 'style' | 'drawn';
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
export type NamingStatus = 'open' | 'named' | 'empty' | 'cancelled';
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
  why: 'win' | 'draw' | 'loss' | 'tutorial' | 'capped';
  total: number;
  /** Neu freigeschaltetes Malmittel */
  unlocked?: MediumId;
  /** Patina: diese Würfel haben eine Seite verbessert (level 1 bis 3, Seite i wurde x2, x3 oder Mischseite) */
  patina?: { id: string; level: number; i: number; to: 'x2' | 'x3' | 'mix'; name: string; face: Face }[];
}
