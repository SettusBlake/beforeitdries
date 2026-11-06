/* Regeln nach und nach (Einstieg E2): Stufe je Spieler, jedes fertige Duell eine mehr, für beide Seiten, Galerie erst am Ende */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { lessonDone, loadDice, saveDice } from '../src/server/dice';
import { duelStart } from '../src/server/duel';
import { bleachStart } from '../src/server/bleach';
import { galleryFind } from '../src/server/gallery';
import { K } from '../src/server/keys';
import { emptyDice } from '../src/shared/dice';
import { loadState } from '../src/shared/duel/play';
import { elemMult, fillBrim, newGame, randomBag, ruleOn, S, setBonus, taskOf, wetChance } from '../src/shared/duel/rules';
import { galleryLockText, RULE_NEWS, RULE_STAGES, STAGE_ALL, UNLOCK } from '../src/shared/duel/stages';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const NEW = 't2_newbie';
const OLD = 't2_veteran';
function setup(seed = 4): Deps {
  const r = RNG(seed);
  const redis = new FakeRedis();
  redis.strings.set(K.dice(OLD), JSON.stringify(emptyDice()));
  return { redis, reddit: new FakeReddit(), now: Date.parse('2026-11-06T12:00:00Z'), rand: () => (r() * 4294967296) >>> 0, subredditName: 'beforeitdries', appSlug: 'beforeitdries', appVersion: '0.1.0.5' };
}
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof GameError ? e.code : 'other';
  }
}
function game(stage: number): void {
  const r = RNG(9);
  newGame(91, 'apprentice', randomBag(r, 'Y'), randomBag(r, 'R'), 91);
  S.stage = stage;
}

describe('Regeln nach und nach', () => {
  it('neue Spieler beginnen bei Stufe 1, Spieler von vorher behalten alles', async () => {
    const d = setup();
    expect((await loadDice(d, NEW)).stage).toBe(1);
    expect((await loadDice(d, OLD)).stage).toBeUndefined();
    const a = await duelStart(d, NEW, 'apprentice');
    expect(a.state?.stage).toBe(1);
    const b = await duelStart(d, OLD, 'apprentice');
    expect(b.state?.stage).toBeUndefined();
  });

  it('jede Stufe schaltet ihre Regel für beide Seiten frei', () => {
    game(1);
    expect(wetChance(1, 4)).toBe(0);
    const [u, t] = [S.teams[0].units[0]!, S.teams[1].units[0]!];
    expect(elemMult(u, t)).toBe(1);
    u.state = 'sheet';
    fillBrim(u, 3);
    expect(u.brim).toBe(0);
    expect(taskOf(1)).toBeNull();
    expect(taskOf(2)).toBeNull();
    for (const x of S.teams[0].units.slice(0, 3)) x.state = 'sheet';
    for (const x of S.teams[0].units) x.m = { ...x.m, main: 'karmin' };
    expect(setBonus(1)).toBeNull();
    for (const [k, st] of Object.entries(UNLOCK)) {
      game(st - 1);
      expect(ruleOn(k as keyof typeof UNLOCK)).toBe(false);
      game(st);
      expect(ruleOn(k as keyof typeof UNLOCK)).toBe(true);
    }
    game(STAGE_ALL);
    expect(wetChance(1, 4)).toBeGreaterThan(0);
    const v = S.teams[0].units[0]!;
    v.state = 'sheet';
    fillBrim(v, 3);
    expect(v.brim).toBe(3);
    expect(taskOf(1)).not.toBeNull();
  });

  it('jedes fertige Duell eine Stufe mehr, Malmittel werden erst ab Stufe 5 freigeschaltet', async () => {
    const d = setup();
    await lessonDone(d, NEW);
    const s = await loadDice(d, NEW);
    const media0 = s.media;
    // payDuel direkt: so viele Duelle, bis alles frei ist
    const { payDuel } = await import('../src/server/dice');
    for (let k = 1; k < RULE_STAGES; k++) {
      await payDuel(d, NEW, 1, false);
      const t = await loadDice(d, NEW);
      expect(t.stage).toBe(k + 1);
      if (k + 1 <= UNLOCK.media) expect(t.media).toEqual(media0);
    }
    await payDuel(d, NEW, 1, false);
    const t = await loadDice(d, NEW);
    expect(t.stage).toBe(RULE_STAGES);
    expect(t.media?.length ?? 0).toBeGreaterThan(media0?.length ?? 0);
  });

  it('Galerie erst ab Stufe 6, Tagesblatt und Lern-Duell mit allen Regeln', async () => {
    const d = setup();
    await lessonDone(d, NEW);
    expect(await code(galleryFind(d, NEW, 'newbie'))).toBe('bad_request');
    expect(await code(duelStart(d, NEW, 'apprentice', false, true))).toBe('bad_request');
    expect(galleryLockText(1)).toBe('Gallery duels open after 5 more duels.');
    expect(galleryLockText(5)).toBe('Gallery duels open after 1 more duel.');
    const sheet = await bleachStart(d, NEW, 'newbie');
    expect(sheet.state?.stage).toBeUndefined();
    const s = await loadDice(d, NEW);
    s.stage = RULE_STAGES;
    await saveDice(d, NEW, s);
    expect(await code(galleryFind(d, NEW, 'newbie'))).toBe('ok');
    const tut = await duelStart(setup(), NEW, 'apprentice', true);
    loadState(tut.state!);
    expect(S.stage).toBe(STAGE_ALL);
  });

  it('jede neue Stufe hat eine Ankündigung mit einem Satz', () => {
    for (let st = 2; st <= RULE_STAGES; st++) {
      const n = RULE_NEWS[st]!;
      expect(n.text.split(/\s+/).length).toBeLessThanOrEqual(16);
      expect(n.help).toMatch(/^rule-/);
    }
  });
});

describe('Test-Schalter Regelstufe', () => {
  it('nur Mods im Playtest, setzt die Stufe oder alles', async () => {
    const { diceTestStage } = await import('../src/server/dice');
    const reddit = new FakeReddit();
    const d = { ...setup(), reddit, appVersion: '0.1.0.99' };
    expect(await code(diceTestStage(d, NEW, 'Vegavild', 3))).toBe('forbidden');
    reddit.mods.push('Vegavild');
    expect(await code(diceTestStage({ ...d, appVersion: '0.1.0' }, NEW, 'Vegavild', 3))).toBe('forbidden');
    await diceTestStage(d, NEW, 'Vegavild', 3);
    expect((await loadDice(d, NEW)).stage).toBe(3);
    expect((await loadDice(d, NEW)).tutorialPaid).toBe(true);
    await diceTestStage(d, NEW, 'Vegavild', null);
    expect((await loadDice(d, NEW)).stage).toBeUndefined();
    expect(await code(diceTestStage(d, NEW, 'Vegavild', 9))).toBe('bad_request');
  });
});
