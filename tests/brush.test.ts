/* Reicher Zug (07.11.2026): drei Pinsel, die Hand wirft mit vollerem Pinsel mehrmals, der beste Wurf zählt */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { dicePull, loadDice, saveDice } from '../src/server/dice';
import { BRUSHES, brushDef, brushOdds, forcedHand, GILDED_AT, HAND_AT, isGilded, rollHand } from '../src/shared/dice';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const USER = 't2_brush';
function setup(seed = 8): Deps {
  const r = RNG(seed);
  return { redis: new FakeRedis(), reddit: new FakeReddit(), now: Date.parse('2026-11-07T12:00:00Z'), rand: () => (r() * 4294967296) >>> 0, subredditName: 'beforeitdries', appSlug: 'beforeitdries' };
}
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof GameError ? e.code : 'other';
  }
}
/** Nach den Startzügen mit so viel Pigment */
async function ready(d: Deps, pigment: number): Promise<void> {
  await dicePull(d, USER, 'starter');
  const s = await loadDice(d, USER);
  s.pigment = pigment;
  await saveDice(d, USER, s);
}

describe('Pinsel beim Ziehen', () => {
  it('Preise 100, 300 und 700, Zehnerzug das Zehnfache', () => {
    expect(BRUSHES.map((b) => [b.k, b.cost, b.throws])).toEqual([
      ['plain', 100, 1],
      ['loaded', 300, 2],
      ['dripping', 700, 3],
    ]);
    expect(brushDef(undefined).k).toBe('plain');
  });

  it('die Hand wirft je Wurf, der beste zählt', () => {
    const r = RNG(3);
    const rand = () => (r() * 4294967296) >>> 0;
    for (let i = 0; i < 500; i++) {
      const h = rollHand(rand, 3);
      expect(h.hands).toHaveLength(3);
      expect(h.golds).toHaveLength(3);
      expect(h.hand).toBe(Math.max(...h.hands!));
      expect(h.gold).toBe(Math.max(...h.golds!));
      expect(!!h.style).toBe(h.hand >= HAND_AT.style);
      if (h.gold === 10) expect(h.goldD100).toBe(Math.max(...h.goldD100s!));
      else expect(h.goldD100s).toBeUndefined();
      expect(!!h.holo).toBe((h.goldD100 ?? 0) >= HAND_AT.holo);
    }
    // Einfacher Pinsel wie bisher: keine Reihen
    expect(rollHand(rand).hands).toBeUndefined();
  });

  it('Chancen unter der Woche: Stil 1, 2, 3 %, Holo 0,2, 0,75, 1,59 % (Holo 1 zu 500 seit 07.11.2026)', () => {
    const r = RNG(11);
    const rand = () => (r() * 4294967296) >>> 0;
    const N = 200_000;
    const rate = (t: number, g = false) => {
      let st = 0,
        ho = 0;
      for (let i = 0; i < N; i++) {
        const h = rollHand(rand, t, g);
        if (h.style) st++;
        if (h.holo) ho++;
      }
      return [st / N, ho / N];
    };
    const [s1, h1] = rate(1),
      [s2, h2] = rate(2),
      [s3, h3] = rate(3);
    expect(s1).toBeCloseTo(0.01, 2);
    expect(s2).toBeCloseTo(0.0199, 2);
    expect(s3).toBeCloseTo(0.0297, 2);
    expect(h1).toBeGreaterThan(0.0015);
    expect(h1).toBeLessThan(0.0025);
    expect(h2).toBeGreaterThan(0.0065);
    expect(h2).toBeLessThan(0.0086);
    expect(h3).toBeGreaterThan(0.0145);
    expect(h3).toBeLessThan(0.0173);
    // Gilded weekend: Stil doppelt (2, 3,96, 5,88 %), Holo 1,5-fach (0,3, 1,12, 2,37 %)
    const [g1, k1] = rate(1, true),
      [g2, k2] = rate(2, true),
      [g3, k3] = rate(3, true);
    expect(g1).toBeCloseTo(0.02, 2);
    expect(g2).toBeCloseTo(0.0396, 2);
    expect(g3).toBeCloseTo(0.0588, 2);
    expect(k1).toBeGreaterThan(0.0024);
    expect(k1).toBeLessThan(0.0036);
    expect(k2).toBeGreaterThan(0.01);
    expect(k2).toBeLessThan(0.0125);
    expect(k3).toBeGreaterThan(0.0222);
    expect(k3).toBeLessThan(0.0252);
  });

  it('angezeigte Chancen passen zur Rechnung 1 − (1 − p)^Würfe', () => {
    const pct = (v: number) => v * 100;
    for (const b of BRUSHES) {
      for (const g of [false, true]) {
        const at = g ? GILDED_AT : HAND_AT;
        const ps = (101 - at.style) / 100,
          ph = (101 - at.holo) / 100;
        const st = pct(1 - (1 - ps) ** b.throws);
        const ho = pct((1 - 0.9 ** b.throws) * (1 - (1 - ph) ** b.throws));
        const od = brushOdds(b, g);
        // Gerundet gezeigt: höchstens 0,05 Prozentpunkte (Stil 0,1) daneben
        expect(Math.abs(parseFloat(od.style) - st)).toBeLessThan(0.1);
        expect(Math.abs(parseFloat(od.holo) - ho)).toBeLessThan(0.05);
      }
    }
  });

  it('Gilded weekend ist Samstag und Sonntag nach UTC', () => {
    expect(isGilded(Date.parse('2026-11-06T23:59:59Z'))).toBe(false);
    expect(isGilded(Date.parse('2026-11-07T00:00:00Z'))).toBe(true);
    expect(isGilded(Date.parse('2026-11-08T23:59:59Z'))).toBe(true);
    expect(isGilded(Date.parse('2026-11-09T00:00:00Z'))).toBe(false);
  });

  it('Test-Knopf setzt den besten Wurf, damit Anzeige und Ergebnis passen', () => {
    const r = RNG(5);
    const h = forcedHand('oil', true, () => (r() * 4294967296) >>> 0, 3);
    expect(h.style).toBe('oil');
    expect(h.hand).toBe(100);
    expect(Math.max(...h.hands!)).toBe(100);
    expect(Math.max(...h.golds!)).toBe(10);
    expect(Math.max(...h.goldD100s!)).toBe(100);
    expect(h.holo).toBe(true);
  });

  it('bezahlte Züge kosten je nach Pinsel und zeigen alle Würfe', async () => {
    const d = setup();
    await ready(d, 5000);
    const a = await dicePull(d, USER, 'one', 'loaded');
    expect(a.dice.pigment).toBe(4700);
    expect(a.pulls[0]!.brush).toBe('loaded');
    expect(a.pulls[0]!.hands).toHaveLength(2);
    const b = await dicePull(d, USER, 'one', 'dripping');
    expect(b.dice.pigment).toBe(4000);
    expect(b.pulls[0]!.hands).toHaveLength(3);
    const c = await dicePull(d, USER, 'ten', 'loaded');
    expect(c.dice.pigment).toBe(1000);
    expect(c.pulls).toHaveLength(10);
    expect(c.pulls.every((p) => p.hands?.length === 2)).toBe(true);
    const e = await dicePull(d, USER, 'one');
    expect(e.dice.pigment).toBe(900);
    expect(e.pulls[0]!.hands).toBeUndefined();
    // Samstag: Gilded weekend steht in der Antwort und in jedem Zug
    expect(e.gilded).toBe(true);
    expect(e.pulls[0]!.gilded).toBe(true);
  });

  it('unter der Woche kein Gilded weekend, Treffer passen zur Schwelle', async () => {
    const d = { ...setup(21), now: Date.parse('2026-11-10T12:00:00Z') };
    await ready(d, 0);
    const s = await loadDice(d, USER);
    expect(s.dice.length).toBeGreaterThan(0);
    const res = await dicePull(d, USER, 'free');
    expect(res.gilded).toBeUndefined();
    expect(res.pulls[0]!.gilded).toBeUndefined();
    const p = res.pulls[0]!;
    expect(!!p.die.style).toBe(p.hand >= HAND_AT.style);
    expect(!!p.die.holo).toBe((p.goldD100 ?? 0) >= HAND_AT.holo);
  });

  it('zu wenig Pigment, unbekannter Pinsel, freier Zug bleibt einfach', async () => {
    const d = setup();
    await ready(d, 650);
    expect(await code(dicePull(d, USER, 'one', 'dripping'))).toBe('bad_request');
    expect(await code(dicePull(d, USER, 'one', 'gold'))).toBe('bad_request');
    expect((await loadDice(d, USER)).pigment).toBe(650);
    const f = await dicePull(d, USER, 'free', 'dripping');
    expect(f.dice.pigment).toBe(650);
    expect(f.pulls[0]!.hands).toBeUndefined();
  });
});
