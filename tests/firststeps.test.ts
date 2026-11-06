/* Erste Schritte (Einstieg E1): der Server zahlt die Belohnung der Lektion genau einmal und schaltet damit Duell und Tagesblatt frei */
import { describe, expect, it } from 'vitest';
import type { Deps } from '../src/server/core';
import { bleachStart } from '../src/server/bleach';
import { duelStart } from '../src/server/duel';
import { lessonDone, loadDice } from '../src/server/dice';
import { REWARD, STARTER_PULLS } from '../src/shared/dice';
import { FIRST_STEPS_LINES } from '../src/client/duel/firststeps';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const USER = 't2_newbie';
const NOW = Date.parse('2026-11-06T10:00:00Z');

function deps(): Deps {
  const r = RNG(3);
  return { redis: new FakeRedis(), reddit: new FakeReddit(), now: NOW, rand: () => (r() * 4294967296) >>> 0, subredditName: 'beforeitdries', appSlug: 'beforeitdries', appVersion: '0.1.0.4' };
}

describe('Erste Schritte', () => {
  it('zahlt 200 Pigment einmal, die freien Startwürfel bleiben', async () => {
    const d = deps();
    const a = await lessonDone(d, USER);
    expect(a.lesson?.pigment).toBe(REWARD.tutorial);
    expect(a.dice.pigment).toBe(REWARD.tutorial);
    expect(a.dice.tutorialPaid).toBe(true);
    expect(a.dice.starter).toBe(STARTER_PULLS);
    const b = await lessonDone(d, USER);
    expect(b.lesson?.pigment).toBe(0);
    expect((await loadDice(d, USER)).pigment).toBe(REWARD.tutorial);
  });

  it('ohne Konto geht es nicht', async () => {
    await expect(lessonDone(deps(), undefined)).rejects.toThrow();
  });

  it('schaltet das Tagesblatt frei', async () => {
    const d = deps();
    await expect(bleachStart(d, USER, 'newbie')).rejects.toThrow();
    await lessonDone(d, USER);
    const r = await bleachStart(d, USER, 'newbie');
    expect(r.state?.mode).toBe('bleach');
  });

  it('danach ein normales Duell, das erste ohne Malmittel', async () => {
    const d = deps();
    await lessonDone(d, USER);
    const r = await duelStart(d, USER, 'apprentice');
    expect(r.state?.tutorial).toBe(0);
    expect(r.state?.noMedia).toBe(true);
  });

  it('Sepia sagt 6 Sätze mit höchstens 8 Wörtern', () => {
    const words = FIRST_STEPS_LINES.map((l) => l.split(/\s+/).length);
    expect(FIRST_STEPS_LINES).toHaveLength(6);
    expect(Math.max(...words)).toBeLessThanOrEqual(8);
    expect(words.reduce((a, b) => a + b, 0)).toBe(33);
  });
});
