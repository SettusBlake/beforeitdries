/* Server-Logik mit Redis im Speicher und Reddit-Attrappe */
import { describe, expect, it } from 'vitest';
import { parseNameSuggestion } from '../src/shared/day';
import { adoptTopName, catchBlot, dayInfo, ensureDailyPost, GameError, glazeMonster, loadCollection, resolveDay, type Deps } from '../src/server/core';
import { K } from '../src/server/keys';
import { makeMonster, humidityFor, speciesKey } from '../src/shared/monster';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const DAY = '2026-10-28';
const NOON = Date.parse(DAY + 'T12:00:00Z');
const HOUR = 3600000;

function setup(seed = 1) {
  const r = RNG(seed);
  const d: Deps = {
    redis: new FakeRedis(),
    reddit: new FakeReddit(),
    now: NOON,
    rand: () => (r() * 4294967296) >>> 0,
    subredditName: 'beforeitdries',
    appSlug: 'beforeitdries',
    dryMs: 8 * HOUR,
  };
  return { d, redis: d.redis as FakeRedis, reddit: d.reddit as FakeReddit };
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(GameError);
  await p.catch((e: GameError) => expect(e.code).toBe(code));
}

describe('Tagespost', () => {
  it('wird genau einmal angelegt', async () => {
    const { d, redis, reddit } = setup();
    const a = await ensureDailyPost(d);
    const b = await ensureDailyPost(d);
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.postId).toBe(a.postId);
    expect(reddit.posts).toHaveLength(1);
    expect(reddit.posts[0]!.postData).toEqual({ day: DAY, humidity: humidityFor(DAY) });
    expect(await redis.get(K.post(a.postId))).toBe(DAY);
    expect((await redis.hGetAll(K.day(DAY))).creating).toBeUndefined();
  });
  it('findet den Tag über postData oder Redis', async () => {
    const { d } = setup();
    const { postId } = await ensureDailyPost(d);
    expect((await resolveDay(d, postId, { day: DAY, humidity: 1 }))!.humidity).toBe(humidityFor(DAY));
    expect((await resolveDay(d, postId, undefined))!.day).toBe(DAY);
    expect(await resolveDay(d, 't3_unknown', undefined)).toBeNull();
    expect(await resolveDay(d, undefined, { day: 'nonsense' })).toBeNull();
  });
});

describe('Fangen', () => {
  it('gleiche Form für alle, eigene Würfe', async () => {
    const { d } = setup(7);
    const { postId } = await ensureDailyPost(d);
    const ref = (await resolveDay(d, postId, undefined))!;
    const a = await catchBlot(d, 't2_alice', 'alice', ref);
    const b = await catchBlot(d, 't2_bob', 'bob', ref);
    const tmpl = makeMonster(DAY, 0, humidityFor(DAY));
    for (const m of [a.monster, b.monster]) {
      expect({ bp: m.bp, paper: m.paper, main: m.main, sec: m.sec, events: m.events, face: m.face, seed: m.seed, name: m.name }).toEqual({
        bp: tmpl.bp, paper: tmpl.paper, main: tmpl.main, sec: tmpl.sec, events: tmpl.events, face: tmpl.face, seed: tmpl.seed, name: tmpl.name,
      });
      for (const v of Object.values(m.rolls)) expect(v >= 1 && v <= 20).toBe(true);
    }
    expect(a.monster.rolls).not.toEqual(b.monster.rolls);
    expect((await dayInfo(d, ref)).catches).toBe(2);
  });
  it('zweiter Fang liefert dasselbe Exemplar', async () => {
    const { d } = setup();
    const { postId } = await ensureDailyPost(d);
    const ref = (await resolveDay(d, postId, undefined))!;
    const a = await catchBlot(d, 't2_alice', 'alice', ref);
    const b = await catchBlot(d, 't2_alice', 'alice', ref);
    expect(a.fresh).toBe(true);
    expect(b.fresh).toBe(false);
    expect(b.monster).toEqual(a.monster);
    expect((await loadCollection(d, 't2_alice')).monsters).toHaveLength(1);
  });
  it('braucht Login und einen nassen Klecks', async () => {
    const { d } = setup();
    const { postId } = await ensureDailyPost(d);
    const ref = (await resolveDay(d, postId, undefined))!;
    await expectCode(catchBlot(d, undefined, undefined, ref), 'login');
    await expectCode(catchBlot(d, 't2_x', 'x', null), 'no_day');
    await expectCode(catchBlot({ ...d, now: NOON + 24 * HOUR }, 't2_x', 'x', ref), 'dried');
  });
});

describe('Lasieren', () => {
  async function caught() {
    const s = setup(3);
    const { postId } = await ensureDailyPost(s.d);
    const ref = (await resolveDay(s.d, postId, undefined))!;
    const { monster } = await catchBlot(s.d, 't2_alice', 'alice', ref);
    return { ...s, id: monster.id };
  }
  it('prüft Besitz, Pigment und Trockenzeit', async () => {
    const { d, id } = await caught();
    await expectCode(glazeMonster(d, 't2_bob', id, 'ultra'), 'forbidden');
    await expectCode(glazeMonster(d, 't2_alice', id, 'gold'), 'bad_request');
    await expectCode(glazeMonster(d, 't2_alice', 'nope', 'ultra'), 'not_found');
    await expectCode(glazeMonster(d, undefined, id, 'ultra'), 'login');
    const r1 = await glazeMonster(d, 't2_alice', id, 'ultra');
    expect(r1.monster.glazes).toHaveLength(1);
    expect(r1.monster.lastGlazeAt).toBe(NOON);
    const p = glazeMonster({ ...d, now: NOON + 7 * HOUR }, 't2_alice', id, 'ultra');
    await expectCode(p, 'drying');
    await p.catch((e: GameError) => expect(e.dryUntil).toBe(NOON + 8 * HOUR));
    const r2 = await glazeMonster({ ...d, now: NOON + 8 * HOUR }, 't2_alice', id, 'karmin');
    expect(r2.monster.glazes.map((g) => g.p)).toEqual(['ultra', 'karmin']);
    expect(r2.monster.log.length).toBeGreaterThanOrEqual(2);
  });
  it('höchstens fünf Lasuren', async () => {
    const { d, id } = await caught();
    for (let i = 0; i < 5; i++) await glazeMonster({ ...d, now: NOON + i * 9 * HOUR }, 't2_alice', id, 'sepia');
    await expectCode(glazeMonster({ ...d, now: NOON + 99 * HOUR }, 't2_alice', id, 'sepia'), 'full');
  });
  it('sperrt parallele Lasuren', async () => {
    const { d, id } = await caught();
    const results = await Promise.allSettled([glazeMonster({ ...d, dryMs: 0 }, 't2_alice', id, 'ultra'), glazeMonster({ ...d, dryMs: 0 }, 't2_alice', id, 'ultra')]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const busy = results.filter((r) => r.status === 'rejected' && (r.reason as GameError).code === 'busy').length;
    expect(ok + busy).toBe(2);
    expect(ok).toBeGreaterThanOrEqual(1);
  });
});

describe('Bestiarium', () => {
  it('übernimmt den bestbewerteten gültigen Vorschlag', async () => {
    const { d, reddit, redis } = setup();
    const { postId } = await ensureDailyPost(d);
    reddit.addComment(postId, 'beforeitdries', 'Official name thread', 999);
    reddit.addComment(postId, 'troll', 'name: this is way too many words here', 500);
    reddit.addComment(postId, 'gone', 'Removedling', 400, { removed: true });
    reddit.addComment(postId, 'carol', '**Puddlemoth**\nlooks like a moth in a puddle', 50);
    reddit.addComment(postId, 'dave', 'Inkwhale', 50);
    reddit.addComment(postId, 'erin', 'Reply', 80, { parentId: 't1_other' });
    const r = await adoptTopName(d, DAY);
    expect(r).toMatchObject({ status: 'named', name: 'Puddlemoth', namedBy: 'carol' });
    const key = speciesKey(makeMonster(DAY, 0, humidityFor(DAY)));
    expect(await redis.hGet(K.species(key), 'name')).toBe('Puddlemoth');
    expect(await redis.hGet(K.species(key), 'firstSeen')).toBe(DAY);
    expect(reddit.appComments).toHaveLength(1);
    expect(await adoptTopName(d, DAY)).toEqual({ status: 'already_named', name: 'Puddlemoth' });
  });
  it('ohne gültige Vorschläge bleibt die Art offen', async () => {
    const { d, reddit } = setup();
    const { postId } = await ensureDailyPost(d);
    reddit.addComment(postId, 'x', '😀😀😀', 10);
    expect(await adoptTopName(d, DAY)).toEqual({ status: 'no_suggestions' });
    expect(await adoptTopName(d, '2026-01-01')).toEqual({ status: 'no_post' });
  });
  it('Namensvorschläge lesen', () => {
    expect(parseNameSuggestion('Blotling')).toBe('Blotling');
    expect(parseNameSuggestion('name: inky wisp!')).toBe('Inky Wisp');
    expect(parseNameSuggestion('  \n*Gloom-moth*\nbecause reasons')).toBe('Gloom-moth');
    expect(parseNameSuggestion("O'Drip")).toBe("O'Drip");
    expect(parseNameSuggestion('ab')).toBeNull();
    expect(parseNameSuggestion('one two three four')).toBeNull();
    expect(parseNameSuggestion('http://spam.example')).toBeNull();
    expect(parseNameSuggestion('x'.repeat(29))).toBeNull();
  });
});
