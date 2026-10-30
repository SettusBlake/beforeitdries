/*
 * Spiellogik am Server. Alle Zufallswürfe passieren hier, der Client malt nur.
 * Abhängigkeiten werden hereingereicht, damit sich die Logik ohne Reddit testen lässt.
 */
import type { CatchResponse, DayInfo, DayPostData, ErrorCode, GlazeResponse, MonsterRecord, PlayPostData, SpeciesInfo } from '../shared/api';
import { PIG, STAT_KEYS, type PigmentId } from '../shared/data';
import { dayKey, isDayKey, parseNameSuggestion, prettyDay } from '../shared/day';
import { applyGlaze, MAX_GLAZES, SEPIA, sepiaStart } from '../shared/glaze';
import { humidityFor, makeMonster, speciesKey, speciesLabel } from '../shared/monster';
import { RNG, ri } from '../shared/rng';
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
}

export interface CommentLike {
  id: string;
  parentId: string;
  body: string;
  score: number;
  authorName: string;
  removed: boolean;
  createdAt: Date;
}

/** Teilmenge des Reddit-Clients */
export interface RedditLike {
  submitCustomPost(opts: {
    subredditName: string;
    title: string;
    entry?: string;
    postData?: DayPostData | PlayPostData;
    textFallback?: { text: string };
  }): Promise<{ id: string; url: string; permalink: string }>;
  getPostById(id: `t3_${string}`): Promise<{ sticky(position?: 1 | 2): Promise<void> }>;
  getComments(opts: { postId: `t3_${string}`; sort?: 'top'; limit?: number; pageSize?: number; depth?: number }): { all(): Promise<CommentLike[]> };
  submitComment(opts: { id: `t3_${string}`; text: string }): Promise<unknown>;
  /** Mit username: ist dieser Spieler Mod? (leere Liste, wenn nicht) */
  getModerators(opts: { subredditName: string; username?: string }): { all(): Promise<{ username: string }[]> };
}

export interface Deps {
  redis: RedisLike;
  reddit: RedditLike;
  now: number;
  /** Sicherer Zufall, 32 Bit */
  rand: () => number;
  subredditName: string;
  appSlug: string;
  dryMs: number;
  /** Version der App: Playtest-Versionen haben eine vierte Stelle (0.0.1.47), veröffentlichte nicht */
  appVersion?: string;
}

export class GameError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status = 400,
    public dryUntil?: number,
  ) {
    super(message);
  }
}

export const DEFAULT_DRY_HOURS = 8;

export function dryMsFromHours(v: unknown): number {
  const h = typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_DRY_HOURS;
  return Math.round(Math.min(72, Math.max(0, h)) * 3600000);
}

/* ---------- Tage ---------- */

export interface DayRef {
  day: string;
  humidity: number;
  postId: string | null;
}

/** Welcher Tagesklecks gehört zu diesem Post? Erst postData (vom Post selbst), sonst Redis. */
export async function resolveDay(d: Pick<Deps, 'redis'>, postId: string | undefined, postData: unknown): Promise<DayRef | null> {
  const pd = postData as Partial<DayPostData> | undefined;
  let day: string | undefined = isDayKey(pd?.day) ? pd!.day : undefined;
  if (!day && postId) day = await d.redis.get(K.post(postId));
  if (!isDayKey(day)) return null;
  return { day, humidity: humidityFor(day), postId: postId ?? null };
}

export function dayTemplate(day: string) {
  return makeMonster(day, 0, humidityFor(day));
}

export async function getSpecies(d: Pick<Deps, 'redis'>, key: string): Promise<SpeciesInfo | null> {
  const h = await d.redis.hGetAll(K.species(key));
  if (!h || !h.name) return null;
  return { key, name: h.name, namedBy: h.namedBy ?? '', firstSeen: h.firstSeen ?? h.day ?? '' };
}

export async function dayInfo(d: Pick<Deps, 'redis' | 'now'>, ref: DayRef): Promise<DayInfo> {
  const tmpl = dayTemplate(ref.day);
  const key = speciesKey(tmpl);
  const [species, catches, postId] = await Promise.all([getSpecies(d, key), d.redis.hLen(K.dayCatchers(ref.day)), ref.postId ? Promise.resolve(ref.postId) : d.redis.hGet(K.day(ref.day), 'postId')]);
  return {
    day: ref.day,
    humidity: ref.humidity,
    postId: postId ?? null,
    catchable: ref.day === dayKey(d.now),
    catches,
    speciesKey: key,
    species,
  };
}

/** Legt den Tagesklecks-Post an, falls es ihn noch nicht gibt */
export async function ensureDailyPost(d: Deps, day: string = dayKey(d.now)): Promise<{ postId: string; url: string | null; created: boolean }> {
  const dk = K.day(day);
  const existing = await d.redis.hGet(dk, 'postId');
  if (existing) return { postId: existing, url: null, created: false };
  if (!(await d.redis.hSetNX(dk, 'creating', String(d.now)))) {
    const since = Number(await d.redis.hGet(dk, 'creating'));
    if (d.now - since < 60000) throw new GameError('busy', 'The daily blot is being posted right now.', 409);
    await d.redis.hSet(dk, { creating: String(d.now) });
  }
  try {
    const humidity = humidityFor(day);
    const tmpl = makeMonster(day, 0, humidity);
    const post = await d.reddit.submitCustomPost({
      subredditName: d.subredditName,
      title: `What do you see? Daily blot for ${prettyDay(day)}`,
      entry: 'default',
      postData: { day, humidity },
      textFallback: { text: 'A new watercolor blot appeared. Open this post in the Reddit app or on reddit.com to catch it before it dries.' },
    });
    await d.redis.hSet(dk, { seed: day, humidity: String(humidity), postId: post.id, bp: tmpl.bp, main: tmpl.main, createdAt: String(d.now) });
    await d.redis.set(K.post(post.id), day);
    await d.redis.zAdd(K.days, { member: day, score: Date.parse(day + 'T00:00:00Z') });
    await d.redis.hSetNX(K.species(speciesKey(tmpl)), 'firstSeen', day);
    return { postId: post.id, url: post.url, created: true };
  } finally {
    await d.redis.hDel(dk, ['creating']);
  }
}

/* ---------- Monster ---------- */

export async function loadMonster(d: Pick<Deps, 'redis'>, id: string): Promise<MonsterRecord | null> {
  const raw = await d.redis.get(K.monster(id));
  return raw ? (JSON.parse(raw) as MonsterRecord) : null;
}

async function saveMonster(d: Pick<Deps, 'redis'>, m: MonsterRecord): Promise<void> {
  await d.redis.set(K.monster(m.id), JSON.stringify(m));
}

export async function loadCollection(d: Pick<Deps, 'redis'>, userId: string): Promise<{ monsters: MonsterRecord[]; species: Record<string, SpeciesInfo> }> {
  const ids = (await d.redis.zRange(K.userMonsters(userId), 0, -1, { by: 'rank', reverse: true })).map((x) => x.member);
  const monsters: MonsterRecord[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const raws = await d.redis.mGet(ids.slice(i, i + 100).map(K.monster));
    raws.forEach((r) => r && monsters.push(JSON.parse(r) as MonsterRecord));
  }
  const keys = [...new Set(monsters.map(speciesKey))];
  const found = await Promise.all(keys.map((k) => getSpecies(d, k)));
  const species: Record<string, SpeciesInfo> = {};
  found.forEach((s) => s && (species[s.key] = s));
  return { monsters, species };
}

/** Den Tagesklecks fangen: gleiche Form und Farbe für alle, eigene Würfe pro Exemplar */
export async function catchBlot(d: Deps, userId: string | undefined, username: string | undefined, ref: DayRef | null): Promise<CatchResponse> {
  if (!userId) throw new GameError('login', 'Log in to catch this blot.', 401);
  if (!ref) throw new GameError('no_day', 'There is no blot on this post.', 404);
  if (ref.day !== dayKey(d.now)) throw new GameError('dried', 'This blot has dried. Catch today’s blot instead.', 409);
  const id = `${ref.day}:${userId}`;
  if (!(await d.redis.hSetNX(K.dayCatchers(ref.day), userId, id))) {
    const existing = await loadMonster(d, id);
    if (existing) return { monster: existing, fresh: false, species: await getSpecies(d, speciesKey(existing)), serverNow: d.now };
  }
  const m = makeMonster(ref.day, 0, ref.humidity);
  const dice = RNG(d.rand());
  for (const k of STAT_KEYS) m.rolls[k] = ri(dice, 1, 20);
  const rec: MonsterRecord = { ...m, v: 1, id, day: ref.day, owner: userId, ownerName: username ?? '', caughtAt: d.now, lastGlazeAt: null, sepia: sepiaStart(m), log: [] };
  await saveMonster(d, rec);
  await d.redis.zAdd(K.userMonsters(userId), { member: id, score: d.now });
  return { monster: rec, fresh: true, species: await getSpecies(d, speciesKey(rec)), serverNow: d.now };
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

/** Eine Lasur auftragen. Würfelt am Server, prüft Besitz, Trockenzeit und Obergrenze. */
export async function glazeMonster(d: Deps, userId: string | undefined, id: unknown, pigment: unknown): Promise<GlazeResponse> {
  if (!userId) throw new GameError('login', 'Log in to paint.', 401);
  if (typeof id !== 'string' || id.length > 80) throw new GameError('bad_request', 'Unknown monster.');
  if (typeof pigment !== 'string' || !(pigment in PIG)) throw new GameError('bad_request', 'Unknown pigment.');
  return withLock(d, id, async () => {
    const m = await loadMonster(d, id);
    if (!m) throw new GameError('not_found', 'Monster not found.', 404);
    if (m.owner !== userId) throw new GameError('forbidden', 'This is not your monster.', 403);
    if (m.glazes.length >= MAX_GLAZES) throw new GameError('full', 'Five glazes. The paper won’t take more.', 409);
    if (m.lastGlazeAt !== null && d.now < m.lastGlazeAt + d.dryMs) {
      throw new GameError('drying', 'The last layer is still wet.', 409, m.lastGlazeAt + d.dryMs);
    }
    const res = applyGlaze(m, pigment as PigmentId, RNG(d.rand()), d.rand())!;
    m.lastGlazeAt = d.now;
    m.log.unshift(...res.msgs);
    m.sepia = SEPIA[res.mood][res.sepiaIdx] ?? m.sepia;
    await saveMonster(d, m);
    return { monster: m, messages: res.msgs, species: await getSpecies(d, speciesKey(m)), serverNow: d.now, dryMs: d.dryMs };
  });
}

/* ---------- Bestiarium ---------- */

export type NamingResult =
  | { status: 'no_post' }
  | { status: 'already_named'; name: string }
  | { status: 'no_suggestions' }
  | { status: 'named'; name: string; namedBy: string; species: string };

/** Übernimmt den bestbewerteten gültigen Namensvorschlag aus den Kommentaren eines Tages-Posts */
export async function adoptTopName(d: Deps, day: string): Promise<NamingResult> {
  const info = await d.redis.hGetAll(K.day(day));
  if (!info.postId) return { status: 'no_post' };
  const tmpl = dayTemplate(day);
  const key = speciesKey(tmpl);
  const existing = await d.redis.hGet(K.species(key), 'name');
  if (existing) {
    await d.redis.hSet(K.day(day), { named: '1' });
    return { status: 'already_named', name: existing };
  }
  const comments = await d.reddit.getComments({ postId: info.postId as `t3_${string}`, sort: 'top', limit: 500, pageSize: 100, depth: 1 }).all();
  const app = d.appSlug.toLowerCase();
  const candidates = comments
    .filter((c) => c.parentId === info.postId && !c.removed && c.authorName && c.authorName !== '[deleted]' && c.authorName.toLowerCase() !== app)
    .map((c) => ({ name: parseNameSuggestion(c.body), score: c.score, at: c.createdAt.getTime(), by: c.authorName, id: c.id }))
    .filter((c): c is typeof c & { name: string } => c.name !== null)
    .sort((a, b) => b.score - a.score || a.at - b.at);
  for (const c of candidates) {
    // Ein Name gehört nur einer Art
    if (!(await d.redis.hSetNX(K.speciesNames, c.name.toLowerCase(), key))) continue;
    await d.redis.hSet(K.species(key), { name: c.name, namedBy: c.by, day, commentId: c.id, namedAt: String(d.now) });
    await d.redis.hSetNX(K.species(key), 'firstSeen', day);
    await d.redis.zAdd(K.speciesIndex, { member: key, score: d.now });
    await d.redis.hSet(K.day(day), { named: '1' });
    try {
      await d.reddit.submitComment({
        id: info.postId as `t3_${string}`,
        text: `The Bestiary records **${c.name}** (${speciesLabel(tmpl)}), named by u/${c.by}.`,
      });
    } catch (e) {
      console.error('Bestiary comment failed', e);
    }
    return { status: 'named', name: c.name, namedBy: c.by, species: key };
  }
  return { status: 'no_suggestions' };
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
