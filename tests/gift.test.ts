/* Tägliche Aktivität Schritt 1 (08.11.2026): Tagesgeschenk (T8) und Tagesregel des Tagesblatts (T3) */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { loadDice, saveDice } from '../src/server/dice';
import { giftOpen, giftTestAgain } from '../src/server/gift';
import { playInfo } from '../src/server/play';
import { DAY_MEDIA, dayMedium, GIFTS, nextDay, sheetRule } from '../src/shared/daily';
import { bleachScore, newBleach } from '../src/shared/duel/bleach';
import { randomBag, S } from '../src/shared/duel/rules';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const USER = 't2_gift';
const at = (day: string) => Date.parse(`${day}T12:00:00Z`);
function setup(day = '2026-11-09'): Deps {
  const r = RNG(31);
  return { redis: new FakeRedis(), reddit: new FakeReddit(), now: at(day), rand: () => (r() * 4294967296) >>> 0, subredditName: 'beforeitdries', appSlug: 'beforeitdries' };
}
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof GameError ? e.code : 'other';
  }
}
/** Nach den ersten Schritten */
async function learned(d: Deps): Promise<void> {
  const s = await loadDice(d, USER);
  s.tutorialPaid = true;
  await saveDice(d, USER, s);
}

describe('Tagesgeschenk (T8)', () => {
  it('erst nach den ersten Schritten, einmal am Tag', async () => {
    const d = setup();
    expect(await code(giftOpen(d, USER))).toBe('bad_request');
    expect((await playInfo(d, USER)).giftReady).toBeUndefined();
    await learned(d);
    expect((await playInfo(d, USER)).giftReady).toBe(true);
    const a = await giftOpen(d, USER);
    expect(a.gift).toEqual({ day: 1, gift: { k: 'pigment', n: 20 } });
    expect(a.dice.pigment).toBe(20);
    expect(a.giftReady).toBeUndefined();
    expect(await code(giftOpen(d, USER))).toBe('bad_request');
    expect(await code(giftOpen({ ...d, now: at('2026-11-09') + 3600_000 }, USER))).toBe('bad_request');
  });

  it('sieben Töpfe, Tropfen in der Tagesfarbe, Tag 7 ein Zug mit dem Loaded brush, danach von vorn', async () => {
    let day = '2026-11-09';
    const d = setup(day);
    await learned(d);
    const seen: string[] = [];
    for (let k = 0; k < 8; k++) {
      const res = await giftOpen({ ...d, now: at(day) }, USER);
      seen.push(res.gift.gift.k);
      expect(res.gift.day).toBe((k % 7) + 1);
      if (res.gift.gift.k === 'drop') expect(res.dice.drops?.[res.gift.pig!]).toBeGreaterThan(0);
      if (res.gift.gift.k === 'dip') {
        expect(res.pulls).toHaveLength(1);
        expect(res.pulls[0]!.brush).toBe('loaded');
        expect(res.pulls[0]!.hands).toHaveLength(2);
      } else expect(res.pulls).toHaveLength(0);
      day = nextDay(day);
    }
    expect(seen).toEqual([...GIFTS.map((g) => g.k), 'pigment']);
    const s = await loadDice(d, USER);
    // 20 + 30 + 40 + 20 (Tag 8 = Tag 1), drei Tropfen, ein Würfel mehr
    expect(s.pigment).toBe(110);
    expect(Object.values(s.drops ?? {}).reduce((a, b) => a + (b ?? 0), 0)).toBe(3);
    expect(s.dice).toHaveLength(1);
  });

  it('ein verpasster Tag setzt die Leiste nicht zurück', async () => {
    const d = setup('2026-11-09');
    await learned(d);
    await giftOpen(d, USER);
    // Zwei Tage Pause
    const res = await giftOpen({ ...d, now: at('2026-11-12') }, USER);
    expect(res.gift.day).toBe(2);
  });

  it('Test-Knopf nur für Mods im Playtest', async () => {
    const d = setup();
    await learned(d);
    await giftOpen(d, USER);
    expect(await code(giftTestAgain(d, USER, 'someone'))).toBe('forbidden');
    (d.reddit as FakeReddit).mods.push('Vegavild');
    const play = { ...d, appVersion: '0.2.0.9' };
    const r = await giftTestAgain(play, USER, 'Vegavild');
    expect(r.giftReady).toBe(true);
    expect((await giftOpen(play, USER)).gift.day).toBe(2);
  });
});

describe('Tagesregel des Tagesblatts (T3)', () => {
  it('Montag leicht, Sonntag schwer mit zwei großen und Punkten × 1,5', () => {
    expect(sheetRule('2026-11-09')).toMatchObject({ day: 'Monday', hp: 0.9, bigs: 1, mult: 1 });
    expect(sheetRule('2026-11-14')).toMatchObject({ day: 'Saturday', hp: 1.15, bigs: 1, mult: 1 });
    expect(sheetRule('2026-11-15')).toMatchObject({ day: 'Sunday', hp: 1.2, bigs: 2, mult: 1.5 });
  });

  it('Malmittel des Tages: jede Woche jedes einmal, nie zweimal hintereinander', () => {
    let day = '2026-11-09';
    let prev = '';
    for (let w = 0; w < 10; w++) {
      const week = new Set<string>();
      for (let k = 0; k < 7; k++) {
        const m = dayMedium(day);
        expect(m).not.toBe(prev);
        week.add(m);
        prev = m;
        day = nextDay(day);
      }
      expect(week.size).toBe(DAY_MEDIA.length);
    }
  });

  it('Sonntag: zweiter großer Pale, Malmittel zu Beginn, Punkte × 1,5', () => {
    const r = RNG(7);
    const pales = [...randomBag(r, 'P'), ...randomBag(r, 'Q')].slice(0, 14);
    const rule = sheetRule('2026-11-15');
    newBleach({ seed: 99, day: '2026-11-15', colour: 'ultra', deck: randomBag(r, 'Y'), pales, ranked: false, rule });
    expect(S.bleach!.boss2).toBeDefined();
    expect(S.bleach!.boss2).not.toBe(S.bleach!.boss);
    expect(S.teams[0].media).toEqual([rule.medium]);
    const sc = bleachScore();
    expect(sc.mult).toBe(1.5);
    // Montag: kein zweiter großer, kein Faktor
    const r2 = RNG(7);
    const pales2 = [...randomBag(r2, 'P'), ...randomBag(r2, 'Q')].slice(0, 14);
    newBleach({ seed: 99, day: '2026-11-09', colour: 'ultra', deck: randomBag(r2, 'Y'), pales: pales2, ranked: false, rule: sheetRule('2026-11-09') });
    expect(S.bleach!.boss2).toBeUndefined();
    expect(bleachScore().mult).toBeUndefined();
  });
});
