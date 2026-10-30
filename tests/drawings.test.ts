/* Gemalte Monster prüfen: Prüfliste, Freigeben, Übermalen (zufällige Form, Werte bleiben), Sperre, Aufheben */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { diceDraw, diceGet, dicePull, diceSeen, diceWash, loadDice, saveDice, type Recycled } from '../src/server/dice';
import { nextLock, reviewList, reviewOk, reviewOver, reviewUnlock } from '../src/server/drawings';
import { K } from '../src/server/keys';
import { dieMonster, PAINT_OVER } from '../src/shared/dice';
import { dieUnit } from '../src/shared/duel/rules';
import { encodeDrawing } from '../src/shared/drawn';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const USER = 't2_painter';
const DAY = 86_400_000;
const PIC = encodeDrawing({ mirror: true, face: null, strokes: [[[0.5, 0.2], [0.3, 0.3], [0.2, 0.5], [0.3, 0.7], [0.5, 0.8]]] });

function setup(): Deps {
  const r = RNG(77);
  const reddit = new FakeReddit();
  reddit.mods.push('Vegavild');
  // Veröffentlichte Version: die Prüfliste gibt es auch ohne Playtest
  return { redis: new FakeRedis(), reddit, now: Date.parse('2026-10-30T12:00:00Z'), rand: () => (r() * 4294967296) >>> 0, subredditName: 'beforeitdries', appSlug: 'beforeitdries', dryMs: 0, appVersion: '0.0.2' };
}
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof GameError ? e.code : 'other';
  }
}
async function ready(d: Deps, blanks: number): Promise<void> {
  await dicePull(d, USER, 'starter');
  const s = await loadDice(d, USER);
  s.blank = blanks;
  await saveDice(d, USER, s);
}

describe('Zeichnungen prüfen', () => {
  it('jede neue Zeichnung kommt in die Prüfliste, nur Mods sehen sie', async () => {
    const d = setup();
    await ready(d, 3);
    const a = (await diceDraw(d, USER, PIC, 'painter')).pulls[0]!.die;
    await diceDraw(d, USER, PIC, 'painter');
    expect((await diceGet(d, USER, 'painter')).mod).toBeUndefined();
    const asMod = await diceGet(d, USER, 'Vegavild');
    expect(asMod.mod).toBe(true);
    expect(asMod.review).toBe(2);
    expect(asMod.tester).toBe(false);
    expect(await code(reviewList(d, 'painter'))).toBe('forbidden');
    expect(await code(reviewList(d, undefined))).toBe('forbidden');
    const list = await reviewList(d, 'vegavild');
    expect(list.items).toHaveLength(2);
    expect(list.items[0]).toMatchObject({ key: `${USER}:${a.id}`, uid: USER, user: 'painter', id: a.id, no: a.no, draw: a.draw });
    // Freigeben: raus aus der Liste, gemerkt für später
    const after = await reviewOk(d, 'Vegavild', list.items[0]!.key);
    expect(after.items).toHaveLength(1);
    expect(JSON.parse((await d.redis.hGet(K.drawnOk, list.items[0]!.key))!)).toMatchObject({ by: 'Vegavild', id: a.id });
    expect(await code(reviewOk(d, 'painter', after.items[0]!.key))).toBe('forbidden');
  });

  it('Übermalen nimmt nur die Zeichnung, Seriennummer und Werte bleiben, Sepia sagt es einmal', async () => {
    const d = setup();
    await ready(d, 2);
    const die = (await diceDraw(d, USER, PIC, 'painter')).pulls[0]!.die;
    const unit = dieUnit(dieMonster(die));
    const key = `${USER}:${die.id}`;
    expect(await code(reviewOver(d, 'painter', key))).toBe('forbidden');
    const res = await reviewOver(d, 'Vegavild', key);
    expect(res.items).toHaveLength(0);
    expect(res.locked).toHaveLength(0);
    const s = await loadDice(d, USER);
    const now = s.dice.find((x) => x.id === die.id)!;
    expect(now.draw).toBeUndefined();
    expect(now.no).toBe(die.no);
    expect(now.paper).toBe(die.paper);
    expect(dieMonster(now).draw).toBeUndefined();
    expect(dieUnit(dieMonster(now)).faces).toEqual(unit.faces);
    expect(s.paintedOver).toEqual([die.no]);
    expect(s.drawLock).toBeUndefined();
    // Protokoll behält die Striche
    expect(JSON.parse((await d.redis.hGet(K.drawnWashed, key))!)).toMatchObject({ draw: die.draw, by: 'Vegavild' });
    expect(await code(reviewOver(d, 'Vegavild', key))).toBe('not_found');
    expect((await diceSeen(d, USER)).dice.paintedOver).toBeUndefined();
  });

  it('zweimal in 30 Tagen sperrt 14 Tage, dreimal bis ein Mod aufhebt', async () => {
    const d = setup();
    await ready(d, 5);
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await diceDraw(d, USER, PIC, 'painter')).pulls[0]!.die.id);
    await reviewOver(d, 'Vegavild', `${USER}:${ids[0]}`);
    // Auch eine schon freigegebene Zeichnung lässt sich übermalen
    await reviewOk(d, 'Vegavild', `${USER}:${ids[1]}`);
    const two = await reviewOver(d, 'Vegavild', `${USER}:${ids[1]}`);
    expect(two.locked).toEqual([{ uid: USER, user: 'painter', strikes: 2, lock: d.now + PAINT_OVER.lockDays * DAY }]);
    expect((await loadDice(d, USER)).drawLock).toBe(d.now + PAINT_OVER.lockDays * DAY);
    expect(await code(diceDraw(d, USER, PIC, 'painter'))).toBe('forbidden');
    // Nach 15 Tagen wieder frei
    const later = { ...d, now: d.now + 15 * DAY };
    expect((await reviewList(later, 'Vegavild')).locked).toHaveLength(0);
    expect(await code(diceDraw(later, USER, PIC, 'painter'))).toBe('ok');
    // Das dritte Mal: bis ein Mod es aufhebt
    const three = await reviewOver(later, 'Vegavild', `${USER}:${ids[2]}`);
    expect(three.locked[0]).toMatchObject({ uid: USER, strikes: 3, lock: 'mod' });
    expect(await code(diceDraw({ ...d, now: d.now + 400 * DAY }, USER, PIC, 'painter'))).toBe('forbidden');
    expect(await code(reviewUnlock(later, 'painter', USER))).toBe('forbidden');
    const free = await reviewUnlock(later, 'Vegavild', USER);
    expect(free.locked).toHaveLength(0);
    expect((await loadDice(later, USER)).drawLock).toBeUndefined();
    expect(await code(diceDraw(later, USER, PIC, 'painter'))).toBe('ok');
  });

  it('schon ausgewaschen: übermalt im Archiv', async () => {
    const d = setup();
    await ready(d, 1);
    const die = (await diceDraw(d, USER, PIC, 'painter')).pulls[0]!.die;
    await diceWash(d, USER, die.id);
    const list = await reviewList(d, 'Vegavild');
    await reviewOver(d, 'Vegavild', list.items[0]!.key);
    const arch = JSON.parse((await d.redis.hGet(K.recycled, String(list.items[0]!.seed)))!) as Recycled;
    expect(arch.die.id).toBe(die.id);
    expect(arch.die.draw).toBeUndefined();
    expect((await loadDice(d, USER)).paintedOver).toBeUndefined();
  });

  it('Sperre zählt nur übermalte Zeichnungen der letzten 30 Tage, eine laufende bleibt', () => {
    const now = 1_000 * DAY;
    expect(nextLock([now], now)).toBeUndefined();
    expect(nextLock([now - 31 * DAY, now], now)).toBeUndefined();
    expect(nextLock([now - 29 * DAY, now], now)).toBe(now + 14 * DAY);
    expect(nextLock([now - 400 * DAY, now - 300 * DAY, now], now)).toBe('mod');
    expect(nextLock([now], now, now + 3 * DAY)).toBe(now + 3 * DAY);
    expect(nextLock([now], now, 'mod')).toBe('mod');
  });
});
