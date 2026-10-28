/* Würfelsammlung: Startzüge, offener W100, Schutz vor Pech, Doppelte als Lasur, Beutel, Lasur auf Seiten */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { diceBag, diceGet, diceGlaze, dicePull, loadDice, saveDice } from '../src/server/dice';
import { duelStart } from '../src/server/duel';
import { dieMonster, dieSpecies, GLAZE_COST, PITY, rarityFromRoll, rarityIndex, STARTER_PULLS } from '../src/shared/dice';
import { dieUnit, isCrestFace, S } from '../src/shared/duel/rules';
import { loadState } from '../src/shared/duel/play';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const USER = 't2_collector';
function setup(seed = 5, rand?: () => number): Deps {
  const r = RNG(seed);
  return { redis: new FakeRedis(), reddit: new FakeReddit(), now: Date.parse('2026-10-28T12:00:00Z'), rand: rand ?? (() => (r() * 4294967296) >>> 0), subredditName: 'beforeitdries', appSlug: 'beforeitdries', dryMs: 0 };
}
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof GameError ? e.code : 'other';
  }
}
async function addPigment(d: Deps, n: number): Promise<void> {
  const s = await loadDice(d, USER);
  s.pigment += n;
  await saveDice(d, USER, s);
}

describe('Würfelsammlung', () => {
  it('Seltenheit aus dem W100 nach Tabelle', () => {
    expect([1, 50, 51, 80, 81, 95, 96, 99, 100].map(rarityFromRoll)).toEqual(['common', 'common', 'uncommon', 'uncommon', 'rare', 'rare', 'epic', 'epic', 'legendary']);
  });

  it('verlangt einen Login und kennt nur bekannte Züge', async () => {
    expect(await code(diceGet(setup(), undefined))).toBe('login');
    expect(await code(dicePull(setup(), USER, 'gratis'))).toBe('bad_request');
  });

  it('Startzüge füllen den Beutel mit sechs verschiedenen Arten, Papier passt zur Seltenheit', async () => {
    const d = setup();
    const res = await dicePull(d, USER, 'starter');
    expect(res.pulls).toHaveLength(STARTER_PULLS);
    expect(res.dice.dice).toHaveLength(6);
    expect(res.dice.bag).toHaveLength(6);
    expect(new Set(res.dice.dice.map(dieSpecies)).size).toBe(6);
    for (const p of res.pulls) {
      expect(p.d100).toBeGreaterThanOrEqual(1);
      expect(p.d100).toBeLessThanOrEqual(100);
      expect(dieUnit(dieMonster(p.die)).rarity).toBe(p.rarity);
    }
    expect(await code(dicePull(d, USER, 'starter'))).toBe('bad_request');
  });

  it('freier Zug einmal am Tag, danach kostet es Pigment', async () => {
    const d = setup();
    const a = await dicePull(d, USER, 'free');
    expect(a.pulls).toHaveLength(1);
    expect(a.freeReady).toBe(false);
    expect(await code(dicePull(d, USER, 'free'))).toBe('bad_request');
    expect(await code(dicePull(d, USER, 'one'))).toBe('bad_request');
    await addPigment(d, 150);
    const b = await dicePull(d, USER, 'one');
    expect(b.dice.pigment).toBe(50);
    expect((await diceGet({ ...d, now: d.now + 86400000 }, USER)).freeReady).toBe(true);
  });

  it('Schutz vor Pech: spätestens jeder 10. Zug Rare, im Zehnerzug mindestens ein Rare', async () => {
    // Zufall, der immer eine 1 würfelt (W100 = 1 + rand % 100)
    const r = RNG(9);
    const d = setup(9, () => 100 * Math.floor(r() * 4e7));
    await addPigment(d, 3000);
    const res = await dicePull(d, USER, 'ten');
    expect(res.pulls).toHaveLength(10);
    expect(res.pulls.every((p) => p.d100 === 1)).toBe(true);
    expect(res.pulls.filter((p) => rarityIndex(p.rarity) >= 2)).toHaveLength(1);
    expect(res.pulls[9]!.pity).toBe('rare');
    expect(res.dice.pigment).toBe(2000);
    // Epic nach 40 Zügen
    const s = await loadDice(d, USER);
    s.pity.epic = PITY.epic - 1;
    await saveDice(d, USER, s);
    const e = await dicePull(d, USER, 'one');
    expect(e.pulls[0]!.rarity).toBe('epic');
    expect(e.pulls[0]!.pity).toBe('epic');
    expect(e.dice.pity.epic).toBe(0);
    // Legendary nach 90 Zügen, mit seltenem Papier
    const s2 = await loadDice(d, USER);
    s2.pity.legendary = PITY.legendary - 1;
    await saveDice(d, USER, s2);
    const l = await dicePull(d, USER, 'one');
    expect(l.pulls[0]!.rarity).toBe('legendary');
    expect(['washi', 'vellum']).toContain(l.pulls[0]!.die.paper);
  });

  it('doppelte Art wird Lasur, Lasur macht ein Symbol doppelt', async () => {
    const d = setup(21);
    await dicePull(d, USER, 'starter');
    await addPigment(d, 100000);
    let s = await loadDice(d, USER);
    let dups = 0;
    for (let i = 0; i < 40 && !Object.values(s.glaze).some((g) => g >= GLAZE_COST); i++) {
      const res = await dicePull(d, USER, 'ten');
      dups += res.pulls.filter((p) => p.dup).length;
      for (const p of res.pulls) if (p.dup) expect(res.dice.dice.some((x) => dieSpecies(x) === p.dup)).toBe(true);
      s = res.dice;
    }
    expect(dups).toBeGreaterThan(0);
    const key = Object.keys(s.glaze).find((k) => s.glaze[k]! >= GLAZE_COST)!;
    const die = s.dice.find((x) => dieSpecies(x) === key)!;
    const faces = dieUnit(dieMonster(die), die.mods).faces;
    const fi = faces.findIndex((f) => isCrestFace(f) && f.n === 1);
    const star = faces.findIndex((f) => f.k === 'star');
    expect(await code(diceGlaze(d, USER, die.id, star))).toBe('bad_request');
    if (fi >= 0) {
      const before = s.glaze[key]!;
      const res = await diceGlaze(d, USER, die.id, fi);
      const after = res.dice.dice.find((x) => x.id === die.id)!;
      expect(dieUnit(dieMonster(after), after.mods).faces[fi]!.n).toBe(2);
      expect(res.dice.glaze[key]).toBe(before - GLAZE_COST);
      expect(await code(diceGlaze(d, USER, die.id, fi))).toBe('bad_request');
    }
  });

  it('Beutel nur aus eigenen, verschiedenen Würfeln, das Duell nimmt ihn samt Lasuren', async () => {
    const d = setup(33);
    await addPigment(d, 2000);
    await dicePull(d, USER, 'starter');
    const s = await dicePull(d, USER, 'ten');
    const ids = s.dice.dice.map((x) => x.id);
    expect(ids.length).toBeGreaterThan(6);
    expect(await code(diceBag(d, USER, ids.slice(0, 5)))).toBe('bad_request');
    expect(await code(diceBag(d, USER, [...ids.slice(0, 5), ids[0]]))).toBe('bad_request');
    expect(await code(diceBag(d, USER, [...ids.slice(0, 5), 'd999']))).toBe('bad_request');
    const pick = ids.slice(-6);
    const res = await diceBag(d, USER, pick);
    expect(res.dice.bag).toEqual(pick);
    const duel = await duelStart(d, USER, 'apprentice');
    loadState(duel.state!);
    const want = pick.map((id) => dieUnit(dieMonster(res.dice.dice.find((x) => x.id === id)!)).m.seed);
    expect(S.teams[0].units.map((u) => u.m.seed)).toEqual(want);
  });

  it('das erste Duell ohne Würfel macht die Startzüge selbst', async () => {
    const d = setup(44);
    const duel = await duelStart(d, USER, 'apprentice');
    expect(duel.state!.teams[0]!.units).toHaveLength(6);
    const s = await loadDice(d, USER);
    expect(s.starter).toBe(0);
    expect(s.bag).toHaveLength(6);
  });
});
