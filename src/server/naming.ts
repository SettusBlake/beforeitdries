/*
 * Benennen (freigegeben am 30.10.2026, docs/entwuerfe/benennen-plan.md): Wer eine Art ohne Namen findet, teilt sein Monster
 * als „What do you see?“-Post. Nach 24 Stunden wird der oberste Kommentar mit gültigem Namen der Name der Art für alle,
 * Finder und Namensgeber bekommen je 50 Pigment. Je Art läuft höchstens ein Post, je Spieler höchstens einer am Tag.
 */
import type { NamingInfo, NamingResponse, ShareResponse, SpeciesResponse } from '../shared/api';
import { dayKey, parseNameSuggestion } from '../shared/day';
import { dieMonster, REWARD } from '../shared/dice';
import { speciesKey, speciesLabel } from '../shared/monster';
import { GameError, withLock, type Deps } from './core';
import { loadDice, needUser, playerLock, respond, saveDice } from './dice';
import { K } from './keys';

/** So lange kann die Community Namen vorschlagen */
export const NAMING_MS = 24 * 3600 * 1000;
/** Name des Scheduler-Auftrags (devvit.json) */
export const NAMING_JOB = 'name-species';

const parse = <T>(raw: string | undefined | null): T | null => (raw ? (JSON.parse(raw) as T) : null);

/** Namen aller benannten Arten und die gerade laufenden Posts */
export async function speciesNames(d: Pick<Deps, 'redis'>): Promise<SpeciesResponse> {
  const keys = await d.redis.zRange(K.speciesIndex, 0, -1, { by: 'rank' });
  const names: SpeciesResponse['names'] = {};
  await Promise.all(
    keys.map(async ({ member }) => {
      const h = await d.redis.hGetAll(K.species(member));
      if (h.name) names[member] = { name: h.name, namedBy: h.namedBy ?? '' };
    }),
  );
  const open: SpeciesResponse['open'] = {};
  for (const [key, post] of Object.entries(await d.redis.hGetAll(K.namingOpen))) if (post.startsWith('t3_')) open[key] = post;
  return { names, open };
}

/** Ein Monster als „What do you see?“-Post teilen */
export async function diceShare(d: Deps, userId: string | undefined, username: string | undefined, id: unknown): Promise<ShareResponse> {
  const uid = needUser(userId);
  if (typeof id !== 'string') throw new GameError('bad_request', 'Unknown die.');
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    const die = s.dice.find((x) => x.id === id);
    if (!die) throw new GameError('not_found', 'That die is not yours.', 404);
    const m = dieMonster(die);
    const key = speciesKey(m);
    if (await d.redis.hGet(K.species(key), 'name')) throw new GameError('bad_request', 'This species already has a name.');
    const today = dayKey(d.now);
    if (s.nameDay === today) throw new GameError('bad_request', 'One blot a day. Share another one tomorrow.');
    // Gemalte Monster erst, wenn ein Mod die Zeichnung freigegeben hat (andere sehen sie im Post)
    if (die.draw && !(await d.redis.hGet(K.drawnOk, `${uid}:${die.id}`))) throw new GameError('bad_request', 'A moderator has to look at your drawing first.');
    // Je Art ein Post: erst reservieren, dann anlegen
    if (!(await d.redis.hSetNX(K.namingOpen, key, `pending:${uid}`))) throw new GameError('bad_request', 'Someone is already naming this species.');
    const who = username || 'a painter';
    let post: { id: string; url: string };
    try {
      post = await d.reddit.submitCustomPost({
        subredditName: d.subredditName,
        title: `What do you see? A new blot found by u/${who}`,
        entry: 'name',
        postData: { kind: 'name' },
        textFallback: { text: 'A new watercolor blot without a name. Open this post on reddit.com or in the Reddit app to see it, then comment a name.' },
      });
    } catch (e) {
      await d.redis.hDel(K.namingOpen, [key]);
      throw e;
    }
    const info: NamingInfo = { postId: post.id, key, uid, user: who, die: { ...die }, at: d.now, ends: d.now + NAMING_MS, status: 'open' };
    await d.redis.set(K.naming(post.id), JSON.stringify(info));
    await d.redis.hSet(K.namingOpen, { [key]: post.id });
    await d.redis.zAdd(K.namingPosts, { member: post.id, score: d.now });
    s.nameDay = today;
    await saveDice(d, uid, s);
    await d.schedule?.(NAMING_JOB, new Date(info.ends), { postId: post.id });
    return { ...respond(d, s), postId: post.id, url: post.url };
  });
}

/** Zustand eines „What do you see?“-Posts für die Post-Ansicht */
export async function namingGet(d: Pick<Deps, 'redis' | 'now'>, postId: string | undefined): Promise<NamingResponse> {
  const naming = postId ? parse<NamingInfo>(await d.redis.get(K.naming(postId))) : null;
  return { naming, now: d.now };
}

/** Pigment gutschreiben. Ist der Spieler gerade beschäftigt, kurz warten. Wer noch nie gespielt hat, findet es beim ersten Öffnen */
async function pay(d: Deps, uid: string): Promise<void> {
  for (let k = 0; ; k++) {
    try {
      await withLock(d, playerLock(uid), async () => {
        const s = await loadDice(d, uid);
        s.pigment += REWARD.name;
        await saveDice(d, uid, s);
      });
      return;
    } catch (e) {
      if (!(e instanceof GameError && e.code === 'busy') || k >= 5) throw e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}

export type NamingResult = { status: 'named' | 'empty' | 'cancelled' | 'closed' | 'none'; name?: string; namedBy?: string };

/**
 * Den Post abschließen: oberster Kommentar mit gültigem Namen, der noch keiner Art gehört (Regeln wie beim Tagespost).
 * Läuft nach 24 Stunden über den Scheduler oder sofort über das Mod-Menü. cancel schließt ohne Namen
 */
export async function adoptNaming(d: Deps, postId: string, cancel = false): Promise<NamingResult> {
  const info = parse<NamingInfo>(await d.redis.get(K.naming(postId)));
  if (!info) return { status: 'none' };
  if (info.status !== 'open') return { status: 'closed', ...(info.name ? { name: info.name } : {}) };
  const close = async (status: NamingInfo['status'], extra: Partial<NamingInfo> = {}) => {
    Object.assign(info, extra, { status });
    await d.redis.set(K.naming(postId), JSON.stringify(info));
    if ((await d.redis.hGet(K.namingOpen, info.key)) === postId) await d.redis.hDel(K.namingOpen, [info.key]);
  };
  const say = async (text: string) => {
    try {
      await d.reddit.submitComment({ id: postId as `t3_${string}`, text });
    } catch (e) {
      console.error('naming comment', e);
    }
  };
  if (cancel) {
    await close('cancelled');
    await say('This naming is closed. The blot stays nameless for now.');
    return { status: 'cancelled' };
  }
  // Inzwischen anders benannt: nur schließen
  const existing = await d.redis.hGetAll(K.species(info.key));
  if (existing.name) {
    await close('named', { name: existing.name, namedBy: existing.namedBy ?? '' });
    return { status: 'closed', name: existing.name };
  }
  const comments = await d.reddit.getComments({ postId: postId as `t3_${string}`, sort: 'top', limit: 500, pageSize: 100, depth: 1 }).all();
  const app = d.appSlug.toLowerCase();
  const candidates = comments
    .filter((c) => c.parentId === postId && !c.removed && c.authorName && c.authorName !== '[deleted]' && c.authorName.toLowerCase() !== app)
    .map((c) => ({ name: parseNameSuggestion(c.body), score: c.score, at: c.createdAt.getTime(), by: c.authorName, byId: c.authorId, id: c.id }))
    .filter((c): c is typeof c & { name: string } => c.name !== null)
    .sort((a, b) => b.score - a.score || a.at - b.at);
  const label = speciesLabel(dieMonster(info.die));
  for (const c of candidates) {
    // Ein Name gehört nur einer Art
    if (!(await d.redis.hSetNX(K.speciesNames, c.name.toLowerCase(), info.key))) continue;
    await d.redis.hSet(K.species(info.key), { name: c.name, namedBy: c.by, foundBy: info.user, postId, commentId: c.id, namedAt: String(d.now) });
    await d.redis.hSetNX(K.species(info.key), 'firstSeen', dayKey(info.at));
    await d.redis.zAdd(K.speciesIndex, { member: info.key, score: d.now });
    await close('named', { name: c.name, namedBy: c.by });
    await pay(d, info.uid);
    if (c.byId) await pay(d, c.byId);
    await say(`The Bestiary records **${c.name}** (${label}), found by u/${info.user}, named by u/${c.by}. Both get ${REWARD.name} pigment.`);
    return { status: 'named', name: c.name, namedBy: c.by };
  }
  await close('empty');
  await say('No name stuck. The blot stays nameless for now, and the next one to find it may try again. *Master Sepia*');
  return { status: 'empty' };
}
