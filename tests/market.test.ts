/* Tausch und Markt (docs/entwuerfe/tausch-und-markt-plan.md): Bindung, Schutzregeln, Markt, Tausch, Lieferungen, Herkunft */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { dicePull, diceSeen, loadDice, saveDice } from '../src/server/dice';
import { K } from '../src/server/keys';
import { marketBuy, marketList, marketSell, marketTestBuy, marketTestList, marketUnlist, rememberName, tradeAccept, tradeCancel, tradeCollection, tradeDecline, tradeList, tradeOffer, tradeStatus, tradeTestOffer } from '../src/server/market';
import { marketFee, TRADE, type DiceSave } from '../src/shared/dice';
import { monsterSeed } from '../src/shared/monster';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const A = 't2_seller',
  B = 't2_buyer';
const DAY = 86_400_000;
function setup(seed = 5): Deps & { reddit: FakeReddit } {
  const r = RNG(seed);
  return { redis: new FakeRedis(), reddit: new FakeReddit(), now: Date.parse('2026-10-31T12:00:00Z'), rand: () => (r() * 4294967296) >>> 0, subredditName: 'beforeitdries', appSlug: 'beforeitdries', dryMs: 0 };
}
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof GameError ? e.code : 'other';
  }
}
async function msg(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof Error ? e.message : 'other';
  }
}
/** Spieler mit 9 Startwürfeln, n weiteren Würfeln, Pigment und genug Duellen */
async function player(d: Deps, uid: string, name: string, n = 3, duels = TRADE.minDuels): Promise<DiceSave> {
  await rememberName(d, uid, name);
  await dicePull(d, uid, 'starter');
  const s = await loadDice(d, uid);
  s.pigment = 2000 + n * 100;
  await saveDice(d, uid, s);
  for (let i = 0; i < n; i++) await dicePull(d, uid, 'one');
  const t = await loadDice(d, uid);
  t.duels = duels;
  t.pigment = 2000;
  await saveDice(d, uid, t);
  return t;
}
const free = (s: DiceSave) => s.dice.filter((x) => !x.bound && !s.bag.includes(x.id));

describe('Tausch und Markt', () => {
  it('Startwürfel sind gebunden, alte Stände bekommen d1 bis d9 gebunden', async () => {
    const d = setup();
    const s = await player(d, A, 'Seller', 2);
    expect(s.dice.filter((x) => x.bound).length).toBe(9);
    expect(free(s).length).toBe(2);
    expect(await msg(marketSell(d, A, 'Seller', s.dice.find((x) => x.bound)!.id, 100))).toMatch(/Starter dice/);
    // Alter Stand ohne Bindung
    const old = { ...s, v: 2, dice: s.dice.map(({ bound: _b, ...x }) => x) };
    await d.redis.set(K.dice('t2_old'), JSON.stringify(old));
    const back = await loadDice(d, 't2_old');
    expect(back.dice.filter((x) => x.bound).map((x) => x.id)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9']);
  });

  it('handeln erst nach 5 Duellen und mit einem Konto von 7 Tagen', async () => {
    const d = setup();
    const s = await player(d, A, 'Seller', 1, 2);
    const die = free(s)[0]!;
    expect(await msg(marketSell(d, A, 'Seller', die.id, 100))).toMatch(/3 more duels/);
    s.duels = 5;
    await saveDice(d, A, s);
    d.reddit.born.set(A, d.now - 2 * DAY);
    expect(await msg(marketSell(d, A, 'Seller', die.id, 100))).toMatch(/7 days/);
    expect((await tradeStatus(d, A, 'Seller')).gate.ok).toBe(false);
  });

  it('Markt: einstellen, ansehen, kaufen mit Gebühr, Erlös kommt beim nächsten Laden, Herkunft und Register', async () => {
    const d = setup();
    const a = await player(d, A, 'Seller');
    await player(d, B, 'Buyer');
    const die = free(a)[0]!;
    const seed = String(monsterSeed(die.sheet, die.idx));
    const r = await marketSell(d, A, 'Seller', die.id, 300, true);
    expect(r.mine.length).toBe(1);
    expect(r.dice!.dice.dice.some((x) => x.id === die.id)).toBe(false);
    const seen = await marketList(d, B, 'Buyer');
    const item = seen.items.find((x) => x.die.sheet === die.sheet)!;
    expect(item.price).toBe(300);
    expect(item.seller).toBe('Seller');
    // Eigenen Eintrag nicht kaufen, zu wenig Pigment nicht
    expect(await code(marketBuy(d, A, 'Seller', item.id))).toBe('bad_request');
    const b0 = await loadDice(d, B);
    b0.pigment = 100;
    await saveDice(d, B, b0);
    expect(await msg(marketBuy(d, B, 'Buyer', item.id))).toMatch(/Not enough pigment/);
    b0.pigment = 1000;
    await saveDice(d, B, b0);
    const bought = await marketBuy(d, B, 'Buyer', item.id);
    const got = bought.dice!.dice.dice.find((x) => x.sheet === die.sheet)!;
    expect(bought.dice!.dice.pigment).toBe(700);
    expect(got.hist!.map((h) => [h.u, h.how, h.p])).toEqual([
      ['Seller', 'pull', undefined],
      ['Buyer', 'market', 300],
    ]);
    expect(await d.redis.hGet(K.seeds, seed)).toBe(`${B}:${got.id}`);
    // Zweiter Kauf: weg
    expect(await code(marketBuy(d, B, 'Buyer', item.id))).toBe('not_found');
    // Verkäufer: Erlös beim Laden, Sepia sagt es
    const before = (await loadDice(d, A)).pigment;
    await tradeStatus(d, A, 'Seller');
    const a2 = await loadDice(d, A);
    expect(a2.pigment).toBe(before + 300 - marketFee(300));
    expect(a2.news![0]!.k).toBe('sold');
    // Kein doppeltes Abholen
    await tradeStatus(d, A, 'Seller');
    expect((await loadDice(d, A)).pigment).toBe(a2.pigment);
    await diceSeen(d, A);
    expect((await loadDice(d, A)).news).toBeUndefined();
  });

  it('Markt: zurückziehen, Ablauf nach 3 Tagen, höchstens 5 Einträge, Deck gesperrt', async () => {
    const d = setup();
    const a = await player(d, A, 'Seller', 7);
    const xs = free(a);
    for (const x of xs.slice(0, TRADE.listings)) await marketSell(d, A, 'Seller', x.id, 50, true);
    expect(await msg(marketSell(d, A, 'Seller', xs[5]!.id, 50, true))).toMatch(/At most 5/);
    const r = await marketList(d, A, 'Seller');
    const back = await marketUnlist(d, A, 'Seller', r.mine[0]!.id);
    expect(back.mine.length).toBe(4);
    expect(back.dice!.dice.dice.some((x) => x.id === xs[0]!.id)).toBe(true);
    // Deck gesperrt
    const s = await loadDice(d, A);
    expect(await msg(marketSell(d, A, 'Seller', s.bag[0]!, 50))).toMatch(/Starter dice|deck/);
    // Nach 3 Tagen kommen die übrigen zurück
    d.now += TRADE.days * DAY + 1000;
    await player(d, B, 'Buyer');
    expect((await marketList(d, B, 'Buyer')).items.filter((x) => x.seller === 'Seller').length).toBe(0);
    await tradeStatus(d, A, 'Seller');
    const after = await loadDice(d, A);
    expect(after.dice.length).toBe(a.dice.length);
    expect(after.news!.filter((n) => n.k === 'back').length).toBe(4);
    expect((await marketList(d, A, 'Seller')).mine.length).toBe(0);
  });

  it('Tausch: Angebot, annehmen, der Absender bekommt seine Würfel beim Laden', async () => {
    const d = setup();
    const a = await player(d, A, 'Alice');
    const b = await player(d, B, 'Bob');
    const give = free(a)[0]!,
      want = free(b)[0]!;
    const col = await tradeCollection(d, A, 'u/bob');
    expect(col.name).toBe('Bob');
    expect(col.dice.map((x) => x.id).sort()).toEqual(free(b).map((x) => x.id).sort());
    const r = await tradeOffer(d, A, 'Alice', 'u/Bob', [give.id], 150, [want.id], true);
    expect(r.offers.length).toBe(1);
    expect(r.dice!.dice.pigment).toBe(2000 - 150);
    expect(r.dice!.dice.dice.some((x) => x.id === give.id)).toBe(false);
    const inbox = await tradeList(d, B, 'Bob');
    expect(inbox.offers[0]!.dir).toBe('in');
    expect((await tradeStatus(d, B, 'Bob')).offers).toBe(1);
    const acc = await tradeAccept(d, B, 'Bob', inbox.offers[0]!.id, true);
    const bd = acc.dice!.dice;
    expect(bd.pigment).toBe(2000 + 150);
    expect(bd.dice.some((x) => x.sheet === give.sheet)).toBe(true);
    expect(bd.dice.some((x) => x.id === want.id)).toBe(false);
    await tradeStatus(d, A, 'Alice');
    const ad = await loadDice(d, A);
    const came = ad.dice.find((x) => x.sheet === want.sheet)!;
    expect(came.hist!.map((h) => [h.u, h.how])).toEqual([
      ['Bob', 'pull'],
      ['Alice', 'trade'],
    ]);
    expect(await d.redis.hGet(K.seeds, String(monsterSeed(want.sheet, want.idx)))).toBe(`${A}:${came.id}`);
    expect((await tradeList(d, A, 'Alice')).offers.length).toBe(0);
  });

  it('Tausch: ablehnen, zurückziehen, Ablauf geben alles zurück, Grenzen gelten', async () => {
    const d = setup();
    const a = await player(d, A, 'Alice', 5);
    const b = await player(d, B, 'Bob');
    const [g1, g2, g3] = free(a);
    const w = free(b)[0]!;
    expect(await msg(tradeOffer(d, A, 'Alice', 'Bob', [g1!.id], TRADE.maxPig + 1, [w.id]))).toMatch(/Up to 500/);
    expect(await msg(tradeOffer(d, A, 'Alice', 'Bob', [], 0, [w.id]))).toMatch(/Offer a die/);
    expect(await msg(tradeOffer(d, A, 'Alice', 'Nobody', [g1!.id], 0, [w.id]))).toMatch(/Nobody/);
    // Ablehnen
    const o1 = (await tradeOffer(d, A, 'Alice', 'Bob', [g1!.id], 50, [w.id], true)).offers[0]!;
    await tradeDecline(d, B, 'Bob', o1.id);
    await tradeStatus(d, A, 'Alice');
    let s = await loadDice(d, A);
    expect(s.pigment).toBe(2000);
    expect(s.dice.some((x) => x.id === g1!.id)).toBe(true);
    // Zurückziehen
    const o2 = (await tradeOffer(d, A, 'Alice', 'Bob', [g2!.id], 0, [w.id], true)).offers[0]!;
    const c = await tradeCancel(d, A, 'Alice', o2.id);
    expect(c.dice!.dice.dice.some((x) => x.id === g2!.id)).toBe(true);
    // Drei am Tag
    expect(await msg(tradeOffer(d, A, 'Alice', 'Bob', [g3!.id], 0, [w.id], true))).toBe('ok');
    expect(await msg(tradeOffer(d, A, 'Alice', 'Bob', [g1!.id], 0, [w.id], true))).toMatch(/3 trades a day/);
    // Ablauf nach 3 Tagen
    d.now += TRADE.days * DAY + 1000;
    expect((await tradeList(d, B, 'Bob')).offers.length).toBe(0);
    expect(await code(tradeAccept(d, B, 'Bob', 't3', true))).toBe('not_found');
    await tradeStatus(d, A, 'Alice');
    s = await loadDice(d, A);
    expect(s.dice.some((x) => x.id === g3!.id)).toBe(true);
  });

  it('Zeichnungen nur mit Freigabe, die Freigabe wandert mit', async () => {
    const d = setup();
    const a = await player(d, A, 'Alice');
    await player(d, B, 'Bob');
    const x = free(a)[0]!;
    a.dice.find((y) => y.id === x.id)!.draw = 'abc';
    await saveDice(d, A, a);
    expect(await msg(marketSell(d, A, 'Alice', x.id, 100))).toMatch(/moderator/);
    await d.redis.hSet(K.drawnOk, { [`${A}:${x.id}`]: JSON.stringify({ by: 'mod' }) });
    const r = await marketSell(d, A, 'Alice', x.id, 100);
    const bought = await marketBuy(d, B, 'Bob', r.mine[0]!.id);
    const got = bought.dice!.dice.dice.find((y) => y.sheet === x.sheet)!;
    expect(await d.redis.hGet(K.drawnOk, `${B}:${got.id}`)).toBeTruthy();
  });

  it('Holo fragt nach, Test-Händler handeln im Playtest mit', async () => {
    const d = setup();
    d.appVersion = '0.0.1.103';
    d.reddit.mods = ['Mod'];
    const a = await player(d, A, 'Mod', 2, 0);
    const x = free(a)[0]!;
    a.dice.find((y) => y.id === x.id)!.holo = 1;
    await saveDice(d, A, a);
    // Mods im Playtest dürfen ohne Duelle, Holo nur mit Bestätigung
    expect(await msg(marketSell(d, A, 'Mod', x.id, 500))).toMatch(/precious/);
    await marketSell(d, A, 'Mod', x.id, 500, true);
    const listed = await marketTestList(d, A, 'Mod');
    expect(listed.items.length).toBe(3);
    await marketTestBuy(d, A, 'Mod');
    await tradeStatus(d, A, 'Mod');
    expect((await loadDice(d, A)).news!.some((n) => n.k === 'sold')).toBe(true);
    // Test-Händler bietet an, du nimmst an
    const off = await tradeTestOffer(d, A, 'Mod');
    expect(off.offers[0]!.dir).toBe('in');
    expect(off.offers[0]!.pig).toBe(100);
    const acc = await tradeAccept(d, A, 'Mod', off.offers[0]!.id, true);
    expect(acc.dice!.dice.dice.some((y) => y.sheet === off.offers[0]!.give[0]!.sheet)).toBe(true);
    // Angebot an einen Test-Händler nimmt er sofort an
    const t = off.offers[0]!.from;
    const mine = free(await loadDice(d, A))[0]!;
    const col = await tradeCollection(d, A, t);
    const r = await tradeOffer(d, A, 'Mod', t, [mine.id], 0, [col.dice[0]!.id], true);
    expect(r.offers.length).toBe(0);
    expect(r.dice!.dice.dice.some((y) => y.sheet === col.dice[0]!.sheet)).toBe(true);
    // Ohne Playtest gibt es die Test-Händler nicht
    d.appVersion = '0.0.2';
    expect(await code(marketTestList(d, A, 'Mod'))).toBe('forbidden');
  });
});
