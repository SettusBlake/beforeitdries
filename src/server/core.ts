/*
 * Gemeinsames am Server: Schnittstellen zu Redis und Reddit (hereingereicht, damit sich alles ohne Reddit testen lässt),
 * Fehler, Sperren, Mod-Prüfung. Alle Zufallswürfe passieren am Server, der Client malt nur.
 * Tagesklecks, Fangen und das alte Malblatt sind seit dem 02.11.2026 ganz entfernt (Release Schritt 2).
 */
import type { ErrorCode, NamePostData, PlayPostData, SheetPostData } from '../shared/api';
import { K } from './keys';

/** Teilmenge des Devvit-Redis-Clients, die das Spiel braucht */
export interface RedisLike {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<string>;
  mGet(keys: string[]): Promise<(string | null)[]>;
  hGet(key: string, field: string): Promise<string | undefined>;
  hSet(key: string, fieldValues: Record<string, string>): Promise<number>;
  hSetNX(key: string, field: string, value: string): Promise<number>;
  incrBy(key: string, value: number): Promise<number>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hDel(key: string, fields: string[]): Promise<number>;
  hLen(key: string): Promise<number>;
  zAdd(key: string, ...members: { member: string; score: number }[]): Promise<number>;
  zCard(key: string): Promise<number>;
  zRange(key: string, start: number | string, stop: number | string, options?: { reverse?: boolean; by: 'score' | 'lex' | 'rank' }): Promise<{ member: string; score: number }[]>;
  zRem(key: string, members: string[]): Promise<number>;
  zScore(key: string, member: string): Promise<number | undefined>;
  hIncrBy(key: string, field: string, value: number): Promise<number>;
  /** Schlüssel ganz löschen (Löschpflichten) */
  del(...keys: string[]): Promise<void>;
}

/** Ein eben geschriebener Kommentar: ID, anheften (nur App-Konto mit Mod-Rechten) */
export type CommentRef = { id: string; distinguish?(makeSticky?: boolean): Promise<void> };

export interface CommentLike {
  id: string;
  parentId: string;
  body: string;
  score: number;
  authorName: string;
  authorId?: string;
  removed: boolean;
  createdAt: Date;
}

/** Teilmenge des Reddit-Clients */
export interface RedditLike {
  submitCustomPost(opts: {
    subredditName: string;
    title: string;
    entry?: string;
    postData?: PlayPostData | NamePostData | SheetPostData;
    textFallback?: { text: string };
    /** USER: im Namen des Spielers (Benennen), dann ist userGeneratedContent Pflicht */
    runAs?: 'USER' | 'APP';
    userGeneratedContent?: { text: string };
  }): Promise<{ id: string; url: string; permalink: string }>;
  getPostById(id: `t3_${string}`): Promise<{ sticky(position?: 1 | 2): Promise<void> }>;
  getComments(opts: { postId: `t3_${string}`; sort?: 'top'; limit?: number; pageSize?: number; depth?: number }): { all(): Promise<CommentLike[]> };
  /** runAs USER: im Namen des Spielers (Teilen), sonst vom App-Konto. id: Post oder Kommentar (Antwort) */
  submitComment(opts: { id: `t3_${string}` | `t1_${string}`; text: string; runAs?: 'USER' | 'APP' }): Promise<CommentRef>;
  /** Kommentar der App wiederfinden (zum Löschen). Fehlt in alten Attrappen */
  getCommentById?(id: `t1_${string}`): Promise<{ delete(): Promise<void> }>;
  /** Mit username: ist dieser Spieler Mod? (leere Liste, wenn nicht) */
  getModerators(opts: { subredditName: string; username?: string }): { all(): Promise<{ username: string }[]> };
  /** Konto eines Spielers (Alter fürs Handeln). Fehlt in alten Attrappen */
  getUserById?(id: `t2_${string}`): Promise<{ createdAt: Date } | undefined>;
  /** Private Nachricht der App (nur an Spieler, die das eingeschaltet haben) */
  sendPrivateMessage?(opts: { to: string; subject: string; text: string }): Promise<void>;
  /* Auftritt des Subreddits (community.ts): Regeln, Gründe, Flairs, Seitenleiste, Wiki. Fehlen in alten Attrappen */
  getRules?(subredditName: string): Promise<{ shortName: string; update(o: RuleInput): Promise<void> }[]>;
  createRule?(subredditName: string, o: RuleInput): Promise<void>;
  getSubredditRemovalReasons?(subredditName: string): Promise<{ id: string; title: string }[]>;
  addSubredditRemovalReason?(subredditName: string, o: { title: string; message: string }): Promise<string>;
  updateSubredditRemovalReason?(subredditName: string, id: string, o: { title: string; message: string }): Promise<void>;
  getPostFlairTemplates?(subredditName: string): Promise<{ id: string; text: string }[]>;
  createPostFlairTemplate?(o: FlairInput): Promise<{ id: string }>;
  editFlairTemplate?(o: FlairInput & { id: string }): Promise<{ id: string }>;
  setPostFlair?(o: { subredditName: string; postId: `t3_${string}`; flairTemplateId: string }): Promise<void>;
  getWidgets?(subredditName: string): Promise<{ id: string; name: string }[]>;
  addWidget?(o: WidgetInput): Promise<{ id: string }>;
  updateWidget?(o: WidgetInput & { id: string }): Promise<unknown>;
  getWikiPage?(subredditName: string, page: string): Promise<{ content: string }>;
  createWikiPage?(o: WikiInput): Promise<unknown>;
  updateWikiPage?(o: WikiInput): Promise<unknown>;
  /* Testdaten vor dem Start: alte Posts der App finden und entfernen */
  getAppUser?(): Promise<{ username: string } | undefined>;
  getNewPosts?(o: { subredditName: string; limit?: number; pageSize?: number }): { all(): Promise<PostLike[]> };
}
export type RuleInput = { shortName: string; description: string; kind: 'all' | 'link' | 'comment'; violationReason?: string };
export type FlairInput = { subredditName: string; text: string; backgroundColor?: string; textColor?: 'light' | 'dark'; modOnly?: boolean };
export type WidgetInput =
  | { type: 'textarea'; subreddit: string; shortName: string; text: string }
  | { type: 'button'; subreddit: string; shortName: string; description: string; buttons: { kind: string; text: string; url: string; color?: string }[] };
export type WikiInput = { subredditName: string; page: string; content: string; reason?: string };
/** Ein Post aus der Liste des Subreddits */
export type PostLike = { id: string; authorName: string; removed: boolean; remove(isSpam?: boolean): Promise<void> };

export interface Deps {
  redis: RedisLike;
  reddit: RedditLike;
  now: number;
  /** Sicherer Zufall, 32 Bit */
  rand: () => number;
  subredditName: string;
  appSlug: string;
  /** Version der App: Playtest-Versionen haben eine vierte Stelle (0.0.1.47), veröffentlichte nicht */
  appVersion?: string;
  /** Auftrag für später (Scheduler): Benennen nach 24 Stunden */
  schedule?: (name: string, runAt: Date, data: Record<string, string>) => Promise<void>;
}

export class GameError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function withLock<T>(d: Pick<Deps, 'redis' | 'now'>, id: string, fn: () => Promise<T>): Promise<T> {
  if (!(await d.redis.hSetNX(K.locks, id, String(d.now)))) {
    const since = Number(await d.redis.hGet(K.locks, id));
    if (d.now - since < 15000) throw new GameError('busy', 'Still painting. Try again in a moment.', 409);
    await d.redis.hSet(K.locks, { [id]: String(d.now) });
  }
  try {
    return await fn();
  } finally {
    await d.redis.hDel(K.locks, [id]);
  }
}

/** Mod des Subreddits? (Prüfliste der Zeichnungen, im Playtest auch die Test-Knöpfe) */
export async function isMod(d: Pick<Deps, 'reddit' | 'subredditName'>, username: string | undefined): Promise<boolean> {
  if (!username) return false;
  try {
    const mods = await d.reddit.getModerators({ subredditName: d.subredditName, username }).all();
    return mods.some((m) => m.username.toLowerCase() === username.toLowerCase());
  } catch {
    return false;
  }
}
