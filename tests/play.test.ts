/* Spiel-Post: wird einmal angelegt und angepinnt, das Mod-Menü legt einen neuen an; Startbild-Stand */
import { describe, expect, it } from 'vitest';
import type { Deps } from '../src/server/core';
import { dicePull } from '../src/server/dice';
import { duelStart } from '../src/server/duel';
import { ensurePlayPost, playInfo } from '../src/server/play';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

function setup(): Deps & { reddit: FakeReddit } {
  const r = RNG(3);
  return { redis: new FakeRedis(), reddit: new FakeReddit(), now: Date.parse('2026-10-28T12:00:00Z'), rand: () => (r() * 4294967296) >>> 0, subredditName: 'beforeitdries', appSlug: 'beforeitdries', dryMs: 0 };
}

describe('Spiel-Post', () => {
  it('wird einmal angelegt, mit eigenem Einstieg, und angepinnt', async () => {
    const d = setup();
    const a = await ensurePlayPost(d);
    expect(a.created).toBe(true);
    const b = await ensurePlayPost(d);
    expect(b.created).toBe(false);
    expect(b.postId).toBe(a.postId);
    expect(d.reddit.posts).toHaveLength(1);
    expect(d.reddit.posts[0]).toMatchObject({ entry: 'play', postData: { kind: 'play' }, sticky: true });
    const c = await ensurePlayPost(d, true);
    expect(c.created).toBe(true);
    expect(c.postId).not.toBe(a.postId);
  });

  it('Startbild kennt laufendes Duell, Startzüge und freien Zug', async () => {
    const d = setup();
    expect((await playInfo(d, undefined)).user).toBe(false);
    expect(await playInfo(d, 't2_x')).toMatchObject({ user: true, running: false, starter: 6, freeReady: true });
    await dicePull(d, 't2_x', 'starter');
    await duelStart(d, 't2_x', 'apprentice');
    expect(await playInfo(d, 't2_x')).toMatchObject({ running: true, starter: 0 });
  });
});
