/* Datenformate zwischen Server und Client */
import type { PigmentId } from './data';
import type { LogEntry } from './glaze';
import type { Monster } from './monster';
import type { DuelState } from './duel/play';
import type { Ev } from './duel/rules';
import type { DiceSave, PullResult } from './dice';

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

export type ErrorCode = 'login' | 'no_day' | 'dried' | 'not_found' | 'forbidden' | 'drying' | 'full' | 'busy' | 'bad_request' | 'server';

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
}
/** Pigment nach einem Duell */
export interface DuelReward {
  pigment: number;
  why: 'win' | 'draw' | 'loss' | 'tutorial' | 'capped';
  total: number;
}
