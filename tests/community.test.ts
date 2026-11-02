/* Auftritt des Subreddits und Testdaten vor dem Start (docs/entwuerfe/publish-plan.md) */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { cleanTestData, FLAIRS, REASONS, RULES, setupCommunity, SIDEBAR_TITLE, LINKS_TITLE, WIKI_PAGE } from '../src/server/community';
import { ensureSheetPost } from '../src/server/bleach';
import { dicePull, diceTestShiny, loadDice, saveDice } from '../src/server/dice';
import { galleryTestDecks } from '../src/server/gallery';
import { K } from '../src/server/keys';
import { marketBuy, marketList, marketTestList, rememberName, tradeTestOffer } from '../src/server/market';
import { diceShare } from '../src/server/naming';
import { ensurePlayPost } from '../src/server/play';
import { dayKey } from '../src/shared/day';
import { TRADE } from '../src/shared/dice';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const U = 't2_vegavild',
  NAME = 'Vegavild';
function setup(seed = 5): Deps & { reddit: FakeReddit; redis: FakeRedis } {
  const r = RNG(seed);
  const reddit = new FakeReddit();
  reddit.mods = [NAME];
  return {
    redis: new FakeRedis(),
    reddit,
    now: Date.parse('2026-11-02T12:00:00Z'),
    rand: () => (r() * 4294967296) >>> 0,
    subredditName: 'beforeitdries',
    appSlug: 'beforeitdries',
    appVersion: '0.0.1.141',
  };
}
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof GameError ? e.code : 'other';
  }
}
/** Alles in Redis, das einen der Texte enthält */
function leftovers(r: FakeRedis, needles: string[]): string[] {
  const hit = (s: string) => needles.some((n) => s.includes(n));
  const out: string[] = [];
  for (const [k, v] of r.strings) if (hit(k) || hit(v)) out.push(`string ${k}`);
  for (const [k, h] of r.hashes) for (const [f, v] of h) if (hit(k) || hit(f) || hit(v)) out.push(`hash ${k} ${f}`);
  for (const [k, z] of r.zsets) for (const [m] of z) if (hit(k) || hit(m)) out.push(`zset ${k} ${m}`);
  return out;
}

describe('Auftritt des Subreddits', () => {
  it('legt Regeln, Gründe, Flairs, Seitenleiste und Wiki an, ein zweiter Lauf ersetzt statt doppelt', async () => {
    const d = setup();
    await ensurePlayPost(d);
    const first = await setupCommunity(d);
    expect(first.errors).toEqual([]);
    expect(d.reddit.rules.map((r) => r.shortName)).toEqual(RULES.map((r) => r.shortName));
    expect(d.reddit.reasons.map((r) => r.title)).toEqual(REASONS.map((r) => r.title));
    expect(d.reddit.flairs.map((f) => f.text)).toEqual(FLAIRS.map((f) => f.text));
    expect(d.reddit.flairs.filter((f) => f.modOnly).map((f) => f.text)).toEqual(['Play', "Today's sheet", 'What do you see?']);
    expect(d.reddit.widgets.map((w) => w.shortName)).toEqual([SIDEBAR_TITLE, LINKS_TITLE]);
    const links = d.reddit.widgets[1]!;
    expect(links.type === 'button' && links.buttons.map((b) => b.text)).toEqual(['Play', 'Full guide']);
    expect(d.reddit.wiki.get(WIKI_PAGE)).toContain('# How to play Before It Dries');
    // Der Spiel-Post bekommt sein Flair gleich mit
    const play = (await d.redis.get(K.playPost))!;
    expect(d.reddit.postFlair.get(play)).toBe(await d.redis.hGet(K.communityFlair, 'play'));
    // Zweiter Lauf: nichts doppelt
    d.reddit.rules[0]!.description = 'old';
    const again = await setupCommunity(d);
    expect(again.errors).toEqual([]);
    expect(d.reddit.rules).toHaveLength(RULES.length);
    expect(d.reddit.rules[0]!.description).toBe(RULES[0]!.description);
    expect(d.reddit.reasons).toHaveLength(REASONS.length);
    expect(d.reddit.flairs).toHaveLength(FLAIRS.length);
    expect(d.reddit.widgets).toHaveLength(2);
  });

  it('neue Posts der App bekommen ihr Flair, sobald die Einrichtung lief', async () => {
    const d = setup(6);
    await setupCommunity(d);
    const play = await ensurePlayPost(d, true);
    const sheet = await ensureSheetPost(d);
    expect(d.reddit.postFlair.get(play.postId)).toBe(await d.redis.hGet(K.communityFlair, 'play'));
    expect(d.reddit.postFlair.get(sheet.id)).toBe(await d.redis.hGet(K.communityFlair, 'sheet'));
    await dicePull(d, U, 'starter');
    const s = await loadDice(d, U);
    const share = await diceShare(d, U, NAME, s.dice[0]!.id);
    expect(d.reddit.postFlair.get(share.postId)).toBe(await d.redis.hGet(K.communityFlair, 'name'));
    // Ohne Einrichtung: kein Flair, aber der Post kommt trotzdem
    const e = setup(7);
    const p = await ensurePlayPost(e);
    expect(e.reddit.postFlair.size).toBe(0);
    expect(p.created).toBe(true);
  });
});

describe('Testdaten vor dem Start', () => {
  it('nur für Mods im Playtest', async () => {
    const d = setup();
    expect(await code(cleanTestData(d, U, 'someone'))).toBe('forbidden');
    expect(await code(cleanTestData({ ...d, appVersion: '0.1.0' }, U, NAME))).toBe('forbidden');
  });

  it('entfernt Test-Maler, Test-Händler und alte App-Posts, dein Stand und die Posts anderer bleiben', async () => {
    const d = setup(8);
    // Dein Stand mit Würfeln, genug für den Markt
    await rememberName(d, U, NAME);
    await dicePull(d, U, 'starter');
    const s0 = await loadDice(d, U);
    s0.duels = TRADE.minDuels;
    s0.pigment = 5000;
    await saveDice(d, U, s0);
    for (let i = 0; i < 3; i++) await dicePull(d, U, 'one');
    await diceTestShiny(d, U, NAME, 'oil', true);
    // Test-Maler: zwei Decks in der Galerie, drei Händler im Markt, ein Tauschangebot an dich, du kaufst einen Test-Würfel
    const decks = (await galleryTestDecks(d, U, NAME)).made;
    await marketTestList(d, U, NAME);
    await tradeTestOffer(d, U, NAME);
    const listing = (await marketList(d, U, NAME)).items.find((l) => !l.mine)!;
    await marketBuy(d, U, NAME, listing.id);
    const traders = Object.entries(await d.redis.hGetAll(K.nameOf))
      .filter(([k]) => k.startsWith('test:'))
      .map(([, v]) => v);
    expect(decks.length + traders.length).toBeGreaterThan(4);
    const needles = ['test:deck', 'test:trader', ...decks.map((n) => `"${n}"`), ...traders.map((n) => `"${n}"`)];
    expect(leftovers(d.redis, needles).length).toBeGreaterThan(5);
    // Posts: alter Spiel-Post, aktueller Spiel-Post, Tagespost von gestern und heute, ein Benennen-Post, ein fremder Post
    const oldPlay = await ensurePlayPost(d);
    const play = await ensurePlayPost(d, true);
    const yesterday = await ensureSheetPost(d, dayKey(d.now - 86_400_000));
    const today = await ensureSheetPost(d);
    const mine = await loadDice(d, U);
    const named = await diceShare(d, U, NAME, mine.dice.find((x) => x.bound)!.id);
    d.reddit.posts.push({ id: 't3_other', title: 'My fan art', postData: null, author: 'someone' });

    const r = await cleanTestData(d, U, NAME);
    expect(r.errors).toEqual([]);
    expect(r.pending).toBe(0);
    expect(r.painters).toBe(decks.length + traders.length);
    expect(leftovers(d.redis, needles)).toEqual([]);
    // Posts: nur Spiel-Post, heutiger Tagespost und der fremde Post bleiben
    const left = d.reddit.posts.filter((p) => !p.removed).map((p) => p.id);
    expect(left.sort()).toEqual([play.postId, today.id, 't3_other'].sort());
    expect(r.posts).toBe(3);
    expect([oldPlay.postId, yesterday.id, named.postId].every((id) => d.reddit.posts.find((p) => p.id === id)!.removed)).toBe(true);
    // Das offene Benennen ist abgesagt (sonst vergäbe es nach 24 Stunden einen Namen aus einem entfernten Post)
    expect(r.namings).toBe(1);
    expect(JSON.parse((await d.redis.get(K.naming(named.postId)))!)).toMatchObject({ status: 'cancelled' });
    // Dein Stand bleibt, der gekaufte Würfel auch, die Test-Schalter sind aus
    const after = await loadDice(d, U);
    expect(after.dice.length).toBe(mine.dice.length);
    expect(after.forceStyle).toBeUndefined();
    expect(after.forceHolo).toBeUndefined();
    // Ein zweiter Lauf tut nichts mehr
    const again = await cleanTestData(d, U, NAME);
    expect(again).toMatchObject({ painters: 0, posts: 0, namings: 0, errors: [] });
  });
});
