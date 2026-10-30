/* Datenformate zwischen Server und Client */
import type { MediumId } from './duel/media';
import type { PigmentId } from './data';
import type { LogEntry } from './glaze';
import type { Monster } from './monster';
import type { DuelState } from './duel/play';
import type { Ev } from './duel/rules';
import type { DiceSave, DieRec, PullResult } from './dice';

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
export const DUEL_PROTOCOL = 6;
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
}
