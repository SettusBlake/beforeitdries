/* Würfelsammlung: Startzüge, offener W100, Schutz vor Pech, einzigartige Monster, Auswaschen, Beutel, Lasur auf Seiten */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { diceBag, diceDraw, diceGet, diceGlaze, dicePull, diceTestBlank, diceTestPigment, diceTestShiny, diceWash, isPlaytest, loadDice, saveDice, TEST_PIGMENT } from '../src/server/dice';
import { encodeDrawing } from '../src/shared/drawn';
import { K } from '../src/server/keys';
import { duelStart } from '../src/server/duel';
import { dieMonster, dieSpecies, GLAZE_COST, KEEP_MIN, PITY, PULL_COST, RARITIES, rarityDef, rarityFromRoll, rarityIndex, rollHand, foilOf, FOILS, STARTER_PULLS, STYLE_DIE, STYLES, styleFromRoll, type DiceSave } from '../src/shared/dice';
import { PAPER } from '../src/shared/data';
import { monsterSeed, statRows } from '../src/shared/monster';
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

  it('neue Würfel haben die neuen Formen (Generation 2), ältere bleiben, wie sie waren', async () => {
    const d = setup(14);
    const res = await dicePull(d, USER, 'starter');
    expect(res.dice.dice.every((x) => x.gen === 2)).toBe(true);
    for (const x of res.dice.dice) expect(dieMonster(x).gen).toBe(2);
    const old = { ...res.dice.dice[0]! };
    delete old.gen;
    expect(dieMonster(old).gen).toBeUndefined();
    // Die Form ändert nichts an Werten und Würfelseiten
    expect(dieUnit(dieMonster(old)).faces).toEqual(dieUnit(dieMonster(res.dice.dice[0]!)).faces);
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
    // Gelöscht wird nichts: der Würfel liegt samt Herkunft im Archiv, das Register zeigt recycled, als Zug kommt er nie wieder
    const seed = String(monsterSeed(out.sheet, out.idx));
    expect(await d.redis.hGet(K.seeds, seed)).toBe(`recycled:${USER}:${out.id}`);
    const rec = JSON.parse((await d.redis.hGet(K.recycled, seed))!) as { die: typeof out; from: string; at: number; rarity: string };
    expect(rec.die).toEqual(out);
    expect(rec.from).toBe(USER);
    expect(rec.at).toBe(d.now);
    expect(rec.rarity).toBe(dieUnit(dieMonster(out)).rarity);
    expect((await d.redis.zRange(K.recycledAt, 0, -1, { by: 'rank' })).map((x) => x.member)).toEqual([seed]);
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

  it('Blank canvas: einer pro Woche, höchstens 2 auf Vorrat, Malen würfelt wie ein Zug, die Zeichnung ist die Form', async () => {
    const d = setup(55);
    expect(await code(diceDraw(d, undefined, 'n.AAAA'))).toBe('login');
    const early = encodeDrawing({ mirror: false, face: null, strokes: [[[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7], [0.31, 0.31]]] });
    expect(await code(diceDraw(d, USER, early))).toBe('bad_request');
    await dicePull(d, USER, 'starter');
    const s0 = (await diceGet(d, USER)).dice;
    expect(s0.blank).toBe(1);
    // Halbe Form an der Mitte, gespiegelt eine Fläche
    const pic = encodeDrawing({ mirror: true, face: [0.5, 0.4], strokes: [[[0.5, 0.2], [0.3, 0.3], [0.2, 0.5], [0.3, 0.7], [0.5, 0.8]]] });
    expect(await code(diceDraw(d, USER, 'kaputt'))).toBe('bad_request');
    const res = await diceDraw(d, USER, pic);
    const p = res.pulls[0]!;
    expect(res.pulls).toHaveLength(1);
    expect(p.die.draw).toBeTruthy();
    expect(p.die.gen).toBe(2);
    expect(p.die.no).toBeGreaterThan(0);
    expect(dieMonster(p.die).draw).toBe(p.die.draw);
    expect(dieUnit(dieMonster(p.die)).rarity).toBe(p.rarity);
    expect(res.dice.pulls).toBe(s0.pulls + 1);
    expect(res.dice.blank).toBe(p.blank ? 1 : 0);
    if (!p.blank) expect(await code(diceDraw(d, USER, pic))).toBe('bad_request');
    // Die Zeichnung bleibt beim Würfel und kommt mit ins Duell
    await diceBag(d, USER, [p.die.id]);
    loadState((await duelStart(d, USER, 'apprentice')).state!);
    expect(S.teams[0].units.find((u) => u.m.seed === dieMonster(p.die).seed)?.m.draw).toBe(p.die.draw);
    // Nächste Woche einer, nach langer Pause höchstens 2
    const week = 7 * 86400000;
    const base = (await loadDice(d, USER)).blank ?? 0;
    expect((await diceGet({ ...d, now: d.now + week }, USER)).dice.blank).toBe(Math.max(base, Math.min(2, base + 1)));
    expect((await diceGet({ ...d, now: d.now + 5 * week }, USER)).dice.blank).toBe(Math.max(base, 2));
  });

  it('ein W100 mit 1 bringt zusätzlich einen leeren Würfel', async () => {
    let k = 1;
    const d = setup(1, () => k++ * 100);
    const res = await dicePull(d, USER, 'starter');
    expect(res.pulls.every((p) => p.d100 === 1 && p.blank)).toBe(true);
    expect(res.dice.blank).toBe(1 + STARTER_PULLS);
  });

  it('Test-Knopf für leere Würfel: nur im Playtest und nur für Mods', async () => {
    expect(['0.0.1.47', '1.2.3.4', '0.0.2', '0.0.1.0', '', undefined].map(isPlaytest)).toEqual([true, true, false, false, false, false]);
    const reddit = new FakeReddit();
    reddit.mods.push('Vegavild');
    const d = { ...setup(66), reddit };
    // Veröffentlichte Version: kein Knopf, auch nicht für Mods
    expect((await diceGet({ ...d, appVersion: '0.0.2' }, USER, 'Vegavild')).tester).toBe(false);
    expect(await code(diceTestBlank({ ...d, appVersion: '0.0.2' }, USER, 'Vegavild'))).toBe('forbidden');
    const play = { ...d, appVersion: '0.0.1.47' };
    // Playtest, aber kein Mod
    expect((await diceGet(play, USER, 'someone')).tester).toBe(false);
    expect(await code(diceTestBlank(play, USER, 'someone'))).toBe('forbidden');
    // Playtest und Mod: sichtbar, jeder Tipp ein leerer Würfel mehr
    expect((await diceGet(play, USER, 'vegavild')).tester).toBe(true);
    const before = (await loadDice(play, USER)).blank ?? 0;
    await diceTestBlank(play, USER, 'Vegavild');
    const res = await diceTestBlank(play, USER, 'Vegavild');
    expect(res.dice.blank).toBe(before + 2);
    expect(res.tester).toBe(true);
  });

  it('Test-Knopf für Pigment: nur im Playtest und nur für Mods, je Tipp 1000', async () => {
    const reddit = new FakeReddit();
    reddit.mods.push('Vegavild');
    const d = { ...setup(67), reddit };
    expect(await code(diceTestPigment({ ...d, appVersion: '0.0.2' }, USER, 'Vegavild'))).toBe('forbidden');
    const play = { ...d, appVersion: '0.0.1.85' };
    expect(await code(diceTestPigment(play, USER, 'someone'))).toBe('forbidden');
    const before = (await loadDice(play, USER)).pigment;
    await diceTestPigment(play, USER, 'Vegavild');
    const res = await diceTestPigment(play, USER, 'vegavild');
    expect(res.dice.pigment).toBe(before + 2 * TEST_PIGMENT);
    expect(res.tester).toBe(true);
  });

  it('Hand: weißer W100 zeigt 100, dann wählt ein W20 den Stil (1 zu 100), goldener W10 und W100 bringen Holo (1 zu 1000)', () => {
    const seq = (xs: number[]) => {
      let i = 0;
      return () => xs[i++]!;
    };
    expect(rollHand(seq([42, 3]))).toEqual({ hand: 43, gold: 4 });
    expect(rollHand(seq([99, 3, 0]))).toEqual({ hand: 100, gold: 4, styleRoll: 1, style: 'pencil' });
    expect(rollHand(seq([5, 9, 41]))).toEqual({ hand: 6, gold: 10, goldD100: 42 });
    expect(rollHand(seq([5, 9, 99]))).toEqual({ hand: 6, gold: 10, goldD100: 100, holo: true });
    expect(rollHand(seq([99, 9, 19, 99]))).toEqual({ hand: 100, gold: 10, styleRoll: 20, style: 'nouveau', goldD100: 100, holo: true });
    // Jede Seite des W20 gehört genau einem Stil, fünf Stile mit 2 Seiten, zehn mit 1
    const faces = Array.from({ length: STYLE_DIE }, (_, i) => styleFromRoll(i + 1));
    for (const st of STYLES) expect(faces.filter((k) => k === st.k)).toHaveLength(st.to - st.from + 1);
    expect(STYLES).toHaveLength(15);
    expect(STYLES.reduce((a, st) => a + st.to - st.from + 1, 0)).toBe(STYLE_DIE);
    expect(STYLES.filter((st) => st.to > st.from).map((st) => st.k)).toEqual(['pencil', 'comic', 'anime', 'pixel', 'neon']);
    for (const st of STYLES) expect(st.odds).toBe(st.to > st.from ? '1 in 1000' : '1 in 2000');
    const r = RNG(77);
    const rand = () => (r() * 4294967296) >>> 0;
    let style = 0,
      holo = 0;
    for (let i = 0; i < 200000; i++) {
      const h = rollHand(rand);
      if (h.style) style++;
      if (h.holo) holo++;
    }
    // Erwartet 2000 und 200, deutlich daneben wäre ein Fehler
    expect(style).toBeGreaterThan(1800);
    expect(style).toBeLessThan(2200);
    expect(holo).toBeGreaterThan(130);
    expect(holo).toBeLessThan(280);
    // Das Folienmuster kommt aus dem Seed
    expect(new Set(Array.from({ length: 64 }, (_, i) => foilOf(i * 7919)))).toEqual(new Set(FOILS.map((f) => f.k)));
  });

  it('jeder Zug zeigt die Hand, Stil und Holo stehen im Würfel, Auswaschen nur bei Holo mit Bestätigung', async () => {
    const d = setup(88);
    const res = await dicePull(d, USER, 'starter');
    for (const p of res.pulls) {
      expect(p.hand).toBeGreaterThanOrEqual(1);
      expect(p.hand).toBeLessThanOrEqual(100);
      expect(p.gold).toBeGreaterThanOrEqual(1);
      expect(p.gold).toBeLessThanOrEqual(10);
      expect(!!p.die.style).toBe(p.hand === 100);
      expect(!!p.die.holo).toBe(p.gold === 10 && p.goldD100 === 100);
    }
    await addPigment(d, 2000);
    await dicePull(d, USER, 'ten');
    const s = await loadDice(d, USER);
    const [die, plain] = s.dice.filter((x) => !s.bag.includes(x.id));
    die!.style = 'oil';
    die!.holo = 1;
    plain!.style = 'neon';
    delete plain!.holo;
    await saveDice(d, USER, s);
    expect(dieMonster(die!).style).toBe('oil');
    expect(dieMonster(die!).holo).toBe(1);
    // Ein Stil allein ist kein Shiny mehr: ohne Rückfrage
    expect((await diceWash(d, USER, plain!.id)).dice.dice.some((x) => x.id === plain!.id)).toBe(false);
    expect(await code(diceWash(d, USER, die!.id))).toBe('bad_request');
    const w = await diceWash(d, USER, die!.id, true);
    expect(w.dice.dice.some((x) => x.id === die!.id)).toBe(false);
    const rec = JSON.parse((await d.redis.hGet(K.recycled, String(monsterSeed(die!.sheet, die!.idx))))!) as { die: { style?: string; holo?: number } };
    expect(rec.die.style).toBe('oil');
    expect(rec.die.holo).toBe(1);
  });

  it('bisherige Shinys (Stand 1) behalten den Stil und bekommen Holo, neue Stile nicht', async () => {
    const d = setup(31);
    await dicePull(d, USER, 'starter');
    const s = await loadDice(d, USER);
    s.dice[0]!.style = 'comic';
    s.v = 1;
    Object.assign(s, { forceShiny: 'oil' });
    await d.redis.set(K.dice(USER), JSON.stringify(s));
    const t = await loadDice(d, USER);
    expect(t.v).toBe(2);
    expect(t.dice[0]!.holo).toBe(1);
    // Jeder Würfel mit Stil war ein Shiny, die anderen bleiben ohne Holo
    expect(t.dice.every((x) => !!x.holo === !!x.style)).toBe(true);
    expect('forceShiny' in t).toBe(false);
    // Ein Stil, der nach dem Umzug kommt, bleibt ohne Holo
    const later = t.dice.find((x) => !x.style)!;
    later.style = 'pixel';
    await saveDice(d, USER, t);
    expect((await loadDice(d, USER)).dice.find((x) => x.id === later.id)!.holo).toBeUndefined();
  });

  it('Test-Knopf: Stil und Holo getrennt wählbar, nur einmal, nur für Mods im Playtest', async () => {
    const reddit = new FakeReddit();
    reddit.mods.push('Vegavild');
    const d = { ...setup(99), reddit, appVersion: '0.0.1.57' };
    await dicePull(d, USER, 'starter');
    expect(await code(diceTestShiny(d, USER, 'someone', 'oil'))).toBe('forbidden');
    expect(await code(diceTestShiny({ ...d, appVersion: '0.0.2' }, USER, 'Vegavild', 'oil'))).toBe('forbidden');
    expect(await code(diceTestShiny(d, USER, 'Vegavild', 'watercolour'))).toBe('bad_request');
    expect((await diceTestShiny(d, USER, 'Vegavild', 'oil')).dice.forceStyle).toBe('oil');
    const one = (await dicePull(d, USER, 'free')).pulls[0]!;
    expect(one.hand).toBe(100);
    expect(one.styleRoll).toBe(13);
    expect(one.die.style).toBe('oil');
    expect(one.die.holo).toBeUndefined();
    expect(one.lifted).toBeUndefined();
    expect((await loadDice(d, USER)).forceStyle).toBeUndefined();
    // Nur Holo, ohne Stil
    await addPigment(d, 1000);
    await diceTestShiny(d, USER, 'Vegavild', null, true);
    const two = (await dicePull(d, USER, 'one')).pulls[0]!;
    expect(two.gold).toBe(10);
    expect(two.goldD100).toBe(100);
    expect(two.die.holo).toBe(1);
    expect(two.die.style).toBeUndefined();
    // Zurücknehmen geht auch
    await diceTestShiny(d, USER, 'Vegavild', 'comic', true);
    const off = (await diceTestShiny(d, USER, 'Vegavild', null)).dice;
    expect(off.forceStyle).toBeUndefined();
    expect(off.forceHolo).toBeUndefined();
  });

  it('Holo hebt Papier und Seltenheit eine Stufe, Werte und Seiten wie bei dieser Seltenheit, Legendary bleibt', async () => {
    const d = setup(123);
    await dicePull(d, USER, 'starter');
    await addPigment(d, 100 * PULL_COST);
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const s = await loadDice(d, USER);
      s.forceHolo = true;
      const before = { ...s.pity };
      await saveDice(d, USER, s);
      const p = (await dicePull(d, USER, 'one')).pulls[0]!;
      const ri = rarityIndex(p.rarity);
      const unit = dieUnit(dieMonster(p.die));
      seen.add(p.rarity);
      if (p.rarity === 'legendary') {
        expect(p.lifted).toBeUndefined();
        expect(unit.rarity).toBe('legendary');
      } else {
        expect(p.lifted).toBe(RARITIES[ri + 1]!.k);
        expect(unit.rarity).toBe(p.lifted);
        // Ohne die Hebung: das Papier, das der W100 gebracht hat
        const plain = dieMonster({ ...p.die, paper: undefined });
        expect(plain.paper).toBe(rarityDef(p.rarity).paper);
        const up = statRows(dieMonster(p.die)),
          was = statRows(plain);
        const gain = PAPER[dieMonster(p.die).paper].bonus - PAPER[plain.paper].bonus;
        up.forEach((r, k) => expect(r.total - was[k]!.total).toBe(Math.min(gain, Math.max(0, r.cap - was[k]!.total))));
      }
      // Der Schutz vor Pech zählt nach dem W100
      const after = (await loadDice(d, USER)).pity;
      expect(after.rare).toBe(ri >= 2 ? 0 : before.rare + 1);
      expect(after.legendary).toBe(ri >= 4 ? 0 : before.legendary + 1);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});
