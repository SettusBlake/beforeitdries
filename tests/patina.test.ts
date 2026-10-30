/* Patina (festgelegt am 30.10.2026): nach 10, 30 und 60 Würfen im Duell wird eine zufällige Seite besser */
import { describe, expect, it } from 'vitest';
import { wearDice } from '../src/server/dice';
import type { Deps } from '../src/server/core';
import { dieMonster, emptyDice, PATINA, type DieRec } from '../src/shared/dice';
import { dieUnit, isCrestFace, patinaFaces } from '../src/shared/duel/rules';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

function setup(seed = 3): Deps {
  const r = RNG(seed);
  return { redis: new FakeRedis(), reddit: new FakeReddit(), now: Date.parse('2026-10-30T12:00:00Z'), rand: () => (r() * 4294967296) >>> 0, subredditName: 'beforeitdries', appSlug: 'beforeitdries', dryMs: 0 };
}
const die = (k: number): DieRec => ({ id: 'd' + k, sheet: 'P' + k, idx: k % 12, mods: [], at: 0, gen: 2 });
/** Wie viele Symbole die Seiten zusammen zeigen */
const weight = (d: DieRec) => dieUnit(dieMonster(d), d.mods).faces.reduce((a, f) => a + (isCrestFace(f) ? f.n + (f.k2 ? 1 : 0) : 0), 0);

describe('Patina', () => {
  it('wächst an den Schwellen, je Stufe wird eine Seite besser, Würfe zählen weiter', () => {
    const d = setup();
    for (let k = 0; k < 20; k++) {
      const s = emptyDice();
      const x = die(k);
      s.dice.push(x);
      const w0 = weight(x);
      expect(wearDice(d, s, [{ id: x.id, n: PATINA[0]! - 1 }])).toEqual([]);
      expect(x.patina ?? 0).toBe(0);
      const up = wearDice(d, s, [{ id: x.id, n: 1 }]);
      expect(x.patina).toBe(1);
      expect(x.rolls).toBe(PATINA[0]);
      if (up.length) {
        expect(up[0]!.level).toBe(1);
        expect(x.mods.filter((m) => m.p)).toHaveLength(1);
        expect(weight(x)).toBe(w0 + 1);
      }
      // Bis zur letzten Schwelle: höchstens drei Stufen, nie mehr
      wearDice(d, s, [{ id: x.id, n: 60 }]);
      wearDice(d, s, [{ id: x.id, n: 60 }]);
      expect(x.patina).toBe(PATINA.length);
      expect(x.mods.filter((m) => m.p).length).toBeLessThanOrEqual(3);
      expect(weight(x)).toBe(w0 + x.mods.filter((m) => m.p).length);
    }
  });
  it('verbessert nur einfache und doppelte Seiten ohne Mischung, fremde Würfel zählen nicht', () => {
    const d = setup(9);
    const s = emptyDice();
    s.dice.push(die(1));
    expect(wearDice(d, s, [{ id: 'nope', n: 50 }])).toEqual([]);
    for (const f of patinaFaces(dieUnit(dieMonster(die(1))).faces)) {
      const face = dieUnit(dieMonster(die(1))).faces[f]!;
      expect(isCrestFace(face) && !face.k2 && face.n <= 2).toBe(true);
    }
  });
});
