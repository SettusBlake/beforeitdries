/* Gelöschte Konten (Release Schritt 1b): Prüfung bei Reddit, Frist, Bereinigung aller Daten, nichts bleibt zurück */
import { describe, expect, it } from 'vitest';
import type { Deps } from '../src/server/core';
import { accountCheck, GONE, GONE_NAME, mentions, purgeRun, scrub } from '../src/server/accounts';
import { dicePull, diceWash, loadDice, saveDice } from '../src/server/dice';
import { K } from '../src/server/keys';
import { marketBuy, marketSell, rememberName, tradeOffer, tradeStatus } from '../src/server/market';
import { TRADE, type DiceSave } from '../src/shared/dice';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const A = 't2_leaver',
  B = 't2_stayer';
const DAY = 86_400_000;
type Job = { name: string; runAt: Date };
function setup(seed = 7): Deps & { reddit: FakeReddit; redis: FakeRedis; jobs: Job[] } {
  const r = RNG(seed);
  const jobs: Job[] = [];
  return {
    redis: new FakeRedis(),
    reddit: new FakeReddit(),
    jobs,
    now: Date.parse('2026-11-02T12:00:00Z'),
    rand: () => (r() * 4294967296) >>> 0,
    subredditName: 'beforeitdries',
    appSlug: 'beforeitdries',
    dryMs: 0,
    schedule: async (name, runAt) => {
      jobs.push({ name, runAt });
    },
  };
}
async function player(d: Deps, uid: string, name: string, n = 4): Promise<DiceSave> {
  await rememberName(d, uid, name);
  await dicePull(d, uid, 'starter');
  const s = await loadDice(d, uid);
  s.pigment = 2000 + n * 100;
  await saveDice(d, uid, s);
  for (let i = 0; i < n; i++) await dicePull(d, uid, 'one');
  const t = await loadDice(d, uid);
  t.duels = TRADE.minDuels;
  t.pigment = 2000;
  await saveDice(d, uid, t);
  return t;
}
/** Alles in Redis, das ID oder Name noch enthält */
function leftovers(r: FakeRedis, uid: string, name: string): string[] {
  const hit = (s: string) => s.includes(uid) || s.includes(name);
  const out: string[] = [];
  for (const [k, v] of r.strings) if (hit(k) || hit(v)) out.push(`string ${k}`);
  for (const [k, h] of r.hashes) for (const [f, v] of h) if (hit(k) || hit(f) || hit(v)) out.push(`hash ${k} ${f}`);
  for (const [k, z] of r.zsets) for (const [m] of z) if (hit(k) || hit(m)) out.push(`zset ${k} ${m}`);
  return out;
}

describe('Gelöschte Konten', () => {
  it('Text bereinigen: ganze Werte, u/Name in Sätzen, IDs auch als Teil von Schlüsseln', () => {
    const raw = JSON.stringify({ u: 'Leaver', who: 't2_leaver', key: 't2_leaver:d3', reg: 'recycled:t2_leaver:d4', text: 'u/Leaver bought your blot.', other: 'Leaverish' });
    expect(mentions(raw, A, 'Leaver')).toBe(true);
    const s = scrub(raw, A, 'Leaver');
    expect(JSON.parse(s)).toEqual({ u: GONE_NAME, who: 'gone', key: 'gone:d3', reg: 'recycled:gone:d4', text: `${GONE_NAME} bought your blot.`, other: 'Leaverish' });
    expect(mentions(s, A, 'Leaver')).toBe(false);
  });

  it('erst nach 21 Tagen am Stück, ein Wiederfinden setzt die Frist zurück', async () => {
    const d = setup();
    await player(d, A, 'Leaver', 0);
    d.reddit.gone.add(A);
    expect((await accountCheck(d)).missing).toBe(1);
    expect(await d.redis.hGet(K.accountMiss, A)).toBe(String(d.now));
    // Wieder da (z. B. Sperre vorbei): Frist beginnt neu
    d.reddit.gone.delete(A);
    await accountCheck({ ...d, now: d.now + 5 * DAY });
    expect(await d.redis.hGet(K.accountMiss, A)).toBeUndefined();
    d.reddit.gone.add(A);
    await accountCheck({ ...d, now: d.now + 6 * DAY });
    expect((await accountCheck({ ...d, now: d.now + (6 + GONE.confirmDays - 1) * DAY })).queued).toEqual([]);
    expect(await d.redis.get(K.dice(A))).toBeTruthy();
    const r = await accountCheck({ ...d, now: d.now + (6 + GONE.confirmDays) * DAY });
    expect(r.queued).toEqual([A]);
    expect(r.purged).toEqual([A]);
    expect(await d.redis.get(K.dice(A))).toBeUndefined();
    // Fehler bei Reddit zählen nicht
    const e = setup();
    await player(e, B, 'Stayer', 0);
    e.reddit.getUserById = async () => {
      throw new Error('500');
    };
    expect((await accountCheck(e)).checked).toBe(0);
    expect(await e.redis.hLen(K.accountMiss)).toBe(0);
  });

  it('bereinigt alles: Spielstand, Markt, Angebote, Archiv, Register, Rangliste, Bestiary, fremde Herkunft. Angebote an ihn gehen zurück', async () => {
    const d = setup(11);
    const a = await player(d, A, 'Leaver', 4);
    const b = await player(d, B, 'Stayer', 3);
    const freeA = a.dice.filter((x) => !x.bound && !a.bag.includes(x.id));
    const freeB = b.dice.filter((x) => !x.bound && !b.bag.includes(x.id));
    // A stellt zwei Würfel in den Markt, B kauft einen (Herkunft mit A's Namen bei B)
    await marketSell(d, A, 'Leaver', freeA[0]!.id, 100, true);
    await marketSell(d, A, 'Leaver', freeA[1]!.id, 120, true);
    const market = [...(d.redis.hashes.get(K.market) ?? new Map<string, string>()).values()].map((v) => JSON.parse(v) as { id: string });
    await marketBuy(d, B, 'Stayer', market[0]!.id);
    // B bietet A einen Tausch an: Würfel und Pigment liegen im Angebot
    const pigBefore = (await loadDice(d, B)).pigment;
    await tradeOffer(d, B, 'Stayer', 'Leaver', [freeB[0]!.id], 50, [freeA[2]!.id], true);
    expect((await loadDice(d, B)).pigment).toBe(pigBefore - 50);
    // A wäscht einen Würfel aus (Archiv mit Namen)
    await diceWash(d, A, freeA[3]!.id, true, 'Leaver');
    // Tagesblatt: A in der Rangliste, ein Pale aus dem Archiv mit A's Namen
    await d.redis.zAdd(K.bleachDays, { member: '2026-11-02', score: d.now });
    await d.redis.zAdd(K.bleachBoard('2026-11-02'), { member: A, score: 100 * 100000 });
    await d.redis.hSet(K.bleachRes('2026-11-02'), { [A]: JSON.stringify({ points: 100, name: 'Leaver' }) });
    await d.redis.set(K.bleachDay('2026-11-02'), JSON.stringify({ pales: [{ die: {}, name: 'Leaver' }] }));
    // Bestiary: A hat eine Art benannt
    await d.redis.hSet(K.species('beast:ultra'), { name: 'Soggy Bishop', namedBy: 'Leaver', foundBy: 'Stayer' });
    await d.redis.zAdd(K.speciesIndex, { member: 'beast:ultra', score: d.now });
    expect(leftovers(d.redis, A, 'Leaver').length).toBeGreaterThan(10);

    // Konto gelöscht, Frist abgelaufen
    d.reddit.gone.add(A);
    await accountCheck(d);
    const r = await accountCheck({ ...d, now: d.now + GONE.confirmDays * DAY });
    expect(r.purged).toEqual([A]);
    expect(await d.redis.hLen(K.purgeQueue)).toBe(0);
    // Nichts mehr da
    expect(leftovers(d.redis, A, 'Leaver')).toEqual([]);
    expect(leftovers(d.redis, A, 'leaver')).toEqual([]);
    // Das Archiv behält den Würfel ohne Herkunft, das Bestiary den Namen der Art
    const rec = [...(d.redis.hashes.get(K.recycled) ?? new Map()).values()].map((v) => JSON.parse(v) as { from: string; name?: string });
    expect(rec).toHaveLength(1);
    expect(rec[0]).toMatchObject({ from: 'gone' });
    expect(rec[0]!.name).toBeUndefined();
    expect(await d.redis.hGetAll(K.species('beast:ultra'))).toMatchObject({ name: 'Soggy Bishop', namedBy: GONE_NAME, foundBy: 'Stayer' });
    // B: gekaufter Würfel mit namenloser Herkunft, Angebot zurück beim nächsten Öffnen
    const bs = await loadDice(d, B);
    expect(JSON.stringify(bs)).toContain(GONE_NAME);
    await tradeStatus(d, B, 'Stayer');
    const after = await loadDice(d, B);
    expect(after.pigment).toBe(pigBefore);
    expect(after.dice.some((x) => x.sheet === freeB[0]!.sheet && x.idx === freeB[0]!.idx)).toBe(true);
    expect(JSON.stringify(after.news)).toContain('has left Reddit');
    // B bleibt unberührt in der Spielerliste
    expect(await d.redis.zScore(K.dicePlayers, B)).toBeDefined();
  });

  it('viele Spieler: die Bereinigung geht in Stücken weiter (Scheduler eine Minute später)', async () => {
    const d = setup(13);
    await player(d, A, 'Leaver', 0);
    for (let i = 0; i < GONE.chunk * 3; i++) await d.redis.zAdd(K.dicePlayers, { member: `t2_x${i}`, score: i });
    await d.redis.set(K.dice('t2_x400'), JSON.stringify({ hist: [{ u: 'Leaver' }] }));
    d.reddit.gone.add(A);
    // Nur bei Reddit nachfragen, was im Lauf dran ist: A steht vorn
    await d.redis.zAdd(K.dicePlayers, { member: A, score: -1 });
    await accountCheck(d);
    await d.redis.hSet(K.accountMiss, { [A]: String(d.now - GONE.confirmDays * DAY) });
    await d.redis.set(K.accountCursor, '0');
    const first = await accountCheck(d);
    expect(first.queued).toEqual([A]);
    expect(first.purged).toEqual([]);
    expect(d.jobs.at(-1)!.name).toBe('account-purge');
    let rounds = 0;
    while ((await d.redis.hLen(K.purgeQueue)) > 0 && rounds < 10) {
      await purgeRun(d);
      rounds++;
    }
    expect(rounds).toBeGreaterThan(0);
    expect(await d.redis.get(K.dice('t2_x400'))).toBe(JSON.stringify({ hist: [{ u: GONE_NAME }] }));
  });
});
