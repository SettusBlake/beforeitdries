/* Malerrang (H2, 09.11.2026): Erfahrung, Ränge, Titel und Geschenke, Startrang, Abzeichen, „Fast geschafft“ (H7) */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { bleachAct, bleachDay, bleachStart, sheetGet } from '../src/server/bleach';
import { dicePull, loadDice, nearNext, payDuel, saveDice } from '../src/server/dice';
import { hangDeck } from '../src/server/gallery';
import { rankDipTake, rankTest } from '../src/server/gift';
import { K } from '../src/server/keys';
import { dayColour } from '../src/shared/daily';
import { weekKey } from '../src/shared/day';
import { BLANK, emptyDice } from '../src/shared/dice';
import { rankFrom, rankOf, rankPigment, RANK_MAX, TITLES, titleOf, XP } from '../src/shared/rank';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const USER = 't2_rank';
const MON = Date.parse('2026-11-09T12:00:00Z');

function world(seed = 29) {
  const redis = new FakeRedis();
  const reddit = new FakeReddit();
  const r = RNG(seed);
  const at = (now = MON, appVersion = '0.2.0.13'): Deps => ({ redis, reddit, now, rand: () => (r() * 4294967296) >>> 0, subredditName: 'beforeitdries', appSlug: 'beforeitdries', appVersion });
  return { redis, reddit, at };
}
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof GameError ? e.code : 'other';
  }
}
/** Nach den ersten Schritten, Startzüge gezogen, Erfahrung und Wochenziele gesetzt (damit kein Ziel dazwischenfunkt) */
async function painter(d: Deps, xp = 0): Promise<void> {
  const s = await loadDice(d, USER);
  s.tutorialPaid = true;
  await saveDice(d, USER, s);
  await dicePull(d, USER, 'starter');
  const t = await loadDice(d, USER);
  t.xp = xp;
  t.rk = rankOf(xp).n;
  t.week = { w: weekKey(d.now), ids: ['pales', 'master', 'gifts'], n: [0, 0, 0], got: 0 };
  await saveDice(d, USER, t);
}

describe('Malerrang: Kurve', () => {
  it('Bedarf 40 + 20 · n, Rang 2 bei 60, Rang 10 bei 1 260, Rang 50 bei 26 460', () => {
    expect([2, 5, 10, 20, 50].map(rankFrom)).toEqual([60, 360, 1260, 4560, 26460]);
    expect(rankOf(59).n).toBe(1);
    expect(rankOf(60)).toEqual({ n: 2, have: 0, need: 80 });
    expect(rankOf(10 ** 6)).toMatchObject({ n: RANK_MAX, need: 0 });
    expect(rankPigment(10)).toBe(40);
    expect(TITLES.map((t) => t.at)).toEqual([1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
    expect(titleOf(14).title).toBe('Paper stretcher');
  });

  it('Farbe des Tages wie im Tagesaufbau am Server', async () => {
    const { at } = world();
    for (const day of ['2026-11-08', '2026-11-09', '2026-11-10', '2026-12-24']) expect(dayColour(day)).toBe((await bleachDay(at(), day)).colour);
  });
});

describe('Malerrang: Erfahrung und Lohn', () => {
  it('Duell 20, Sieg 30, jeder neue Rang zahlt sein Pigment einmal', async () => {
    const { at } = world();
    const d = at();
    await painter(d, 40);
    const p0 = (await loadDice(d, USER)).pigment;
    const r = await payDuel(d, USER, 1, false, [], { washed: [], deck: [] });
    expect(r.xp).toBe(XP.win);
    expect(r.rank).toEqual([{ n: 2, pigment: rankPigment(2) }]);
    expect(r.total).toBe(p0 + r.pigment + rankPigment(2));
    const l = await payDuel(d, USER, 2, false, [], { washed: [], deck: [] });
    expect(l.xp).toBe(XP.duel);
    expect(l.rank).toBeUndefined();
    expect((await loadDice(d, USER)).xp).toBe(40 + XP.win + XP.duel);
  });

  it('Züge 5 je Monster, Startzüge und Lern-Duell nichts', async () => {
    const { at } = world();
    const d = at();
    const s = await loadDice(d, USER);
    s.tutorialPaid = true;
    await saveDice(d, USER, s);
    const st = await dicePull(d, USER, 'starter');
    expect(st.xp).toBeUndefined();
    expect(st.dice.xp).toBe(0);
    const f = await dicePull(d, USER, 'free');
    expect(f.xp).toBe(XP.dip);
    const tut = await payDuel(d, USER, 1, true);
    expect(tut.xp).toBeUndefined();
  });

  it('vor den ersten Schritten gibt es keine Erfahrung', async () => {
    const { at } = world();
    const d = at();
    const r = await payDuel(d, USER, 1, true);
    expect(r.xp).toBeUndefined();
    expect((await loadDice(d, USER)).xp).toBe(0);
  });

  it('neue Titel: Rang 5 leerer Würfel über die Obergrenze, Rang 10 ein Loaded-Zug, Rang 15 Tropfen der Tagesfarbe', async () => {
    const { at } = world();
    const d = at();
    await painter(d, rankFrom(5) - 10);
    const s0 = await loadDice(d, USER);
    s0.blank = BLANK.max;
    await saveDice(d, USER, s0);
    const r = await payDuel(d, USER, 2, false, [], { washed: [], deck: [] });
    expect(r.rank).toEqual([{ n: 5, pigment: rankPigment(5), title: 'Water carrier', gifts: [{ k: 'blank', n: 1 }], say: TITLES[1]!.say }]);
    expect((await loadDice(d, USER)).blank).toBe(BLANK.max + 1);
    // Auf einen Schlag über Rang 10 und 15: beide zahlen
    const s1 = await loadDice(d, USER);
    s1.xp = rankFrom(10) - 5;
    await saveDice(d, USER, s1);
    const drops0 = (await loadDice(d, USER)).drops?.[dayColour('2026-11-09')] ?? 0;
    const big = await payDuel(d, USER, 1, false, [], { washed: [], deck: [] });
    expect(big.rank?.map((u) => u.n)).toEqual([6, 7, 8, 9, 10]);
    const s2 = await loadDice(d, USER);
    expect(s2.rankDips).toEqual(['loaded']);
    s2.xp = rankFrom(15) - 1;
    await saveDice(d, USER, s2);
    const r15 = await payDuel(d, USER, 2, false, [], { washed: [], deck: [] });
    expect(r15.rank?.at(-1)).toMatchObject({ n: 15, title: 'Colour grinder', pig: dayColour('2026-11-09') });
    expect((await loadDice(d, USER)).drops?.[dayColour('2026-11-09')]).toBe(drops0 + 5);
    // Der Loaded-Zug wartet, bis er genommen wird
    const dip = await rankDipTake(d, USER);
    expect(dip.pulls).toHaveLength(1);
    expect(dip.pulls[0]!.brush).toBe('loaded');
    expect(dip.dice.rankDips).toBeUndefined();
    expect(await code(rankDipTake(d, USER))).toBe('bad_request');
  });

  it('Wochenziel gibt 50 dazu', async () => {
    const { at } = world();
    const d = at();
    await painter(d, 0);
    const s = await loadDice(d, USER);
    s.week = { w: weekKey(MON), ids: ['pales', 'wins', 'gifts'], n: [0, 5, 0], got: 0 };
    await saveDice(d, USER, s);
    const r = await payDuel(d, USER, 1, false, [], { washed: [], deck: [] });
    expect(r.week).toHaveLength(1);
    expect(r.xp).toBe(XP.win + XP.goal);
  });

  it('bisherige Spieler: Startrang aus Duellen, Tagesblättern und Zügen, ohne Lohn', async () => {
    const { at, redis } = world();
    const d = at();
    redis.strings.set(K.dice(USER), JSON.stringify({ ...emptyDice(), tutorialPaid: true, duels: 10, sheets: 3, pulls: 19, pigment: 77 }));
    const s = await loadDice(d, USER);
    // 10 × 25 + 3 × 30 + 10 × 5 = 390: Rang 5
    expect(s.xp).toBe(390);
    expect(s.rk).toBe(5);
    expect(s.pigment).toBe(77);
    expect(s.blank ?? 0).toBeLessThanOrEqual(BLANK.max);
  });
});

describe('Malerrang: Abzeichen und Anzeige', () => {
  it('Rangliste des Tagesblatts und Galerie zeigen den Rang', async () => {
    const { at } = world();
    const d = at();
    await painter(d, rankFrom(7) + 5);
    await bleachStart(d, USER, 'ranker');
    const sh = await bleachAct(d, USER, { k: 'giveup' }, 'ranker');
    expect(sh.reward?.xp).toBe(XP.sheet);
    const board = await sheetGet(d, USER, undefined, 10);
    expect(board.top[0]!.rk).toBe(7);
    await hangDeck(d, USER, 'ranker', await loadDice(d, USER));
    expect(JSON.parse((await d.redis.get(K.gallery(USER)))!).rk).toBe(7);
  });

  it('„Fast geschafft“: weitestes offenes Wochenziel und nächste Patina', async () => {
    const { at } = world();
    const d = at();
    await painter(d, 0);
    const s = await loadDice(d, USER);
    s.week = { w: weekKey(MON), ids: ['sheets', 'wins', 'dips'], n: [1, 4, 7], got: 4 };
    s.dice[0]!.rolls = 7;
    s.dice[1]!.rolls = 2;
    const near = nearNext(s, [
      { id: s.dice[0]!.id, n: 3 },
      { id: s.dice[1]!.id, n: 2 },
    ]);
    expect(near?.week).toEqual({ text: 'Win 6 duels', n: 4, of: 6 });
    expect(near?.patina?.left).toBe(3);
  });

  it('Test-Knopf +500 XP nur für Mods im Playtest', async () => {
    const { at, reddit } = world();
    const d = at();
    await painter(d, 0);
    expect(await code(rankTest(d, USER, 'someone'))).toBe('forbidden');
    reddit.mods.push('Vegavild');
    const r = await rankTest(d, USER, 'Vegavild');
    expect(r.xp).toBe(500);
    expect(r.rank?.at(-1)?.n).toBe(rankOf(500).n);
    expect(await code(rankTest(at(MON, '0.2.0'), USER, 'Vegavild'))).toBe('forbidden');
  });
});
