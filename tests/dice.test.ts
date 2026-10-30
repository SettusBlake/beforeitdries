/* Würfelsammlung: Startzüge, offener W100, Schutz vor Pech, einzigartige Monster, Auswaschen, Beutel, Lasur auf Seiten */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { diceBag, diceGet, diceGlaze, dicePull, diceWash, loadDice, saveDice } from '../src/server/dice';
import { K } from '../src/server/keys';
import { duelStart } from '../src/server/duel';
import { dieMonster, dieSpecies, GLAZE_COST, KEEP_MIN, PITY, rarityDef, rarityFromRoll, rarityIndex, STARTER_PULLS, type DiceSave } from '../src/shared/dice';
import { monsterSeed } from '../src/shared/monster';
import { BAG, dieUnit, isCrestFace, S } from '../src/shared/duel/rules';
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
    expect(res.dice.dice).toHaveLength(STARTER_PULLS);
    expect(res.dice.bag).toHaveLength(BAG);
    expect(new Set(res.dice.dice.map(dieSpecies)).size).toBe(STARTER_PULLS);
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

  it('jeder Zug bleibt als eigener Würfel, mit eigener Seriennummer und eigenem Seed im Register', async () => {
    const d = setup(21);
    await dicePull(d, USER, 'starter');
    await addPigment(d, 100000);
    let s: DiceSave = await loadDice(d, USER);
    let pulls = 0,
      dups = 0;
    for (let i = 0; i < 6; i++) {
      const res = await dicePull(d, USER, 'ten');
      pulls += res.pulls.length;
      dups += res.pulls.filter((p) => p.dup).length;
      for (const p of res.pulls) expect(res.dice.dice.some((x) => x.id === p.die.id)).toBe(true);
      s = res.dice;
    }
    expect(s.dice).toHaveLength(STARTER_PULLS + pulls);
    expect(dups).toBeGreaterThan(0);
    expect(Object.keys(s.glaze)).toHaveLength(0);
    const nos = s.dice.map((x) => x.no);
    expect(nos.every((n) => typeof n === 'number' && n > 0)).toBe(true);
    expect(new Set(nos).size).toBe(nos.length);
    const seeds = s.dice.map((x) => String(monsterSeed(x.sheet, x.idx)));
    expect(new Set(seeds).size).toBe(seeds.length);
    for (const [k, x] of s.dice.entries()) expect(await d.redis.hGet(K.seeds, seeds[k]!)).toBe(`${USER}:${x.id}`);
  });

  it('ein schon vergebener Seed wird neu gewürfelt, ein anderer Spieler bekommt nie dasselbe Monster', async () => {
    // Zwei Spieler mit demselben Zufall würden dieselben Monster ziehen
    const d1 = setup(7),
      d2 = { ...setup(7), redis: d1.redis };
    const a = await dicePull(d1, USER, 'starter');
    const b = await dicePull(d2, 't2_other', 'starter');
    const sa = new Set(a.dice.dice.map((x) => monsterSeed(x.sheet, x.idx)));
    expect(b.dice.dice.some((x) => sa.has(monsterSeed(x.sheet, x.idx)))).toBe(false);
    // Seltenheit bleibt beim Neuwürfeln gleich
    for (const p of b.pulls) expect(dieUnit(dieMonster(p.die)).rarity).toBe(p.rarity);
    expect(new Set([...a.dice.dice, ...b.dice.dice].map((x) => x.no)).size).toBe(2 * STARTER_PULLS);
  });

  it('ältere Würfel ohne Nummer bekommen beim Laden eine', async () => {
    const d = setup(12);
    await dicePull(d, USER, 'starter');
    const s = await loadDice(d, USER);
    for (const x of s.dice) delete x.no;
    await d.redis.set(K.dice(USER), JSON.stringify(s));
    const res = await diceGet(d, USER);
    expect(res.dice.dice.every((x) => (x.no ?? 0) > 0)).toBe(true);
  });

  it('Auswaschen gibt Lasur, nicht aus dem Deck, ein volles Deck bleibt, Lasur macht ein Symbol doppelt', async () => {
    const d = setup(21);
    await dicePull(d, USER, 'starter');
    expect(await code(diceWash(d, USER, (await loadDice(d, USER)).dice[0]!.id))).toBe('bad_request');
    await addPigment(d, 100000);
    let s = (await dicePull(d, USER, 'ten')).dice;
    for (let i = 0; i < 20 && !s.dice.some((x) => !s.bag.includes(x.id) && s.dice.some((y) => y !== x && dieSpecies(y) === dieSpecies(x))); i++) s = (await dicePull(d, USER, 'ten')).dice;
    // Ein Würfel außerhalb des Decks, von dessen Art es noch einen gibt
    const out = s.dice.find((x) => !s.bag.includes(x.id) && s.dice.some((y) => y !== x && dieSpecies(y) === dieSpecies(x)))!;
    const key = dieSpecies(out);
    const gain = rarityDef(dieUnit(dieMonster(out)).rarity).glaze;
    expect(await code(diceWash(d, USER, s.bag[0]))).toBe('bad_request');
    expect(await code(diceWash(d, USER, 'd999'))).toBe('not_found');
    const w = await diceWash(d, USER, out.id);
    expect(w.dice.dice.some((x) => x.id === out.id)).toBe(false);
    expect(w.dice.glaze[key]).toBe(gain);
    // Das Monster kommt nie wieder: der Seed bleibt im Register
    expect(await d.redis.hGet(K.seeds, String(monsterSeed(out.sheet, out.idx)))).toBe(`${USER}:${out.id}`);
    // Genug Lasur für eine Seite: weitere Würfel dieser Art auswaschen, solange es geht
    let t = w.dice;
    while ((t.glaze[key] ?? 0) < GLAZE_COST) {
      const more = t.dice.find((x) => !t.bag.includes(x.id) && dieSpecies(x) !== key);
      if (!more || t.dice.length <= KEEP_MIN) break;
      const x = t.dice.find((y) => !t.bag.includes(y.id) && dieSpecies(y) === key && t.dice.filter((z) => dieSpecies(z) === key).length > 1);
      if (!x) {
        t.glaze[key] = GLAZE_COST;
        await saveDice(d, USER, t);
        break;
      }
      t = (await diceWash(d, USER, x.id)).dice;
    }
    t = await loadDice(d, USER);
    const die = t.dice.find((x) => dieSpecies(x) === key)!;
    const faces = dieUnit(dieMonster(die), die.mods).faces;
    const fi = faces.findIndex((f) => isCrestFace(f) && f.n === 1);
    const star = faces.findIndex((f) => f.k === 'star');
    expect(await code(diceGlaze(d, USER, die.id, star))).toBe('bad_request');
    if (fi >= 0) {
      const before = t.glaze[key]!;
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
    expect(ids.length).toBeGreaterThan(BAG);
    expect(await code(diceBag(d, USER, ids.slice(0, BAG + 1)))).toBe("bad_request");
    expect(await code(diceBag(d, USER, [...ids.slice(0, 5), 'd999']))).toBe('bad_request');
    // Herausnehmen geht: ein halber Beutel ist erlaubt, das Duell füllt auf
    const half = await diceBag(d, USER, ids.slice(0, 3));
    expect(half.dice.bag).toEqual(ids.slice(0, 3));
    const filled = await duelStart(d, USER, 'apprentice');
    expect(filled.state!.teams[0]!.units).toHaveLength(BAG);
    const pick = ids.slice(-BAG);
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
    expect(duel.state!.teams[0]!.units).toHaveLength(BAG);
    const s = await loadDice(d, USER);
    expect(s.starter).toBe(0);
    expect(s.bag).toHaveLength(BAG);
  });
});
