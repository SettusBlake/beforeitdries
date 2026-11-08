/* Tägliche Aktivität Schritt 2 (08.11.2026): Wochenziele (T11) und Willkommen zurück (T10) */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { bleachAct, bleachStart } from '../src/server/bleach';
import { diceGet, dicePull, loadDice, payDuel, saveDice } from '../src/server/dice';
import { duelAct, duelStart } from '../src/server/duel';
import { giftOpen, weekTest, welcomeTake, welcomeTest } from '../src/server/gift';
import { K } from '../src/server/keys';
import { playInfo } from '../src/server/play';
import type { DuelResponse } from '../src/shared/api';
import { weekKey } from '../src/shared/day';
import { BLANK, emptyDice } from '../src/shared/dice';
import { loadState, type DuelAction } from '../src/shared/duel/play';
import { placements, rollable, ROLL_N, S, type Ev } from '../src/shared/duel/rules';
import { goalDef, GOALS, weekGoals, WEEKLY, welcomeAway, welcomeText } from '../src/shared/weekly';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const USER = 't2_weekly';
const DAY = 86400000;
/** Montag, 9.11.2026 */
const MON = Date.parse('2026-11-09T12:00:00Z');

function world(seed = 17) {
  const redis = new FakeRedis();
  const reddit = new FakeReddit();
  const r = RNG(seed);
  const at = (now: number, appVersion = '0.2.0.9'): Deps => ({ redis, reddit, now, rand: () => (r() * 4294967296) >>> 0, subredditName: 'beforeitdries', appSlug: 'beforeitdries', appVersion });
  return { redis, reddit, at };
}
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof GameError ? e.code : 'other';
  }
}
/** Nach den ersten Schritten, Startzüge schon gezogen */
async function learned(d: Deps, uid = USER): Promise<void> {
  const s = await loadDice(d, uid);
  s.tutorialPaid = true;
  await saveDice(d, uid, s);
  await dicePull(d, uid, 'starter');
}
/** Ein Duell bis zum Ende: du würfelst, Sepia malt deinen Zug. Alle Ereignisse kommen mit zurück */
async function playDuel(d: Deps): Promise<{ res: DuelResponse; events: Ev[] }> {
  let res = await duelStart(d, USER, 'apprentice');
  const events: Ev[] = [...res.events];
  for (let g = 0; g < 200 && !res.state!.over; g++) {
    loadState(res.state!);
    let a: DuelAction;
    if (S.phase === 'opening') {
      const u = S.teams[0].units[0]!;
      const p = placements(u)[0]!;
      a = { k: 'open', id: u.id, o: p.o, at: p.at };
    } else if (S.phase === 'medium') a = { k: 'medium', id: S.offer[0]! };
    else if (S.phase === 'roll') {
      const l = rollable(S.teams[0]);
      a = { k: 'roll', ids: l.slice(0, Math.min(ROLL_N, l.length)).map((u) => u.id) };
    } else a = { k: 'auto' };
    res = await duelAct(d, USER, a);
    events.push(...res.events);
  }
  return { res, events };
}

describe('Wochenziele (T11): Auswahl', () => {
  it('je Woche eins aus Tagesblatt, Duell und Sammeln, für alle mit denselben Regeln gleich', () => {
    for (let w = 2915; w < 2940; w++) {
      const ids = weekGoals(`w${w}`, 7);
      expect(ids.map((id) => goalDef(id).group)).toEqual([0, 1, 2]);
      expect(weekGoals(`w${w}`, 7)).toEqual(ids);
    }
  });

  it('nur Ziele mit Regeln, die schon gelten (Einstieg E2)', () => {
    const late = GOALS.filter((g) => g.stage > 1).map((g) => g.id);
    expect(late).toEqual(['elem', 'master', 'task', 'gallery']);
    for (let w = 2915; w < 2940; w++) {
      for (const stage of [1, 2, 3, 4, 5, 6, 7]) for (const id of weekGoals(`w${w}`, stage)) expect(goalDef(id).stage).toBeLessThanOrEqual(stage);
    }
    // Wer alle Regeln hat, bekommt mit der Zeit jedes Duell-Ziel
    const seen = new Set<string>();
    for (let w = 2915; w < 2935; w++) seen.add(weekGoals(`w${w}`, 7)[1]!);
    expect(seen.size).toBe(GOALS.filter((g) => g.group === 1).length);
    // Von Woche zu Woche wechseln die Ziele
    for (let w = 2915; w < 2935; w++) expect(weekGoals(`w${w}`, 7)).not.toEqual(weekGoals(`w${w + 1}`, 7));
  });

  it('die Ziele werden zu Beginn der Woche festgehalten, auch wenn danach neue Regeln dazukommen', async () => {
    const { at } = world();
    const d = at(MON);
    const s = await loadDice(d, USER);
    s.tutorialPaid = true;
    s.stage = 1;
    await saveDice(d, USER, s);
    const first = (await loadDice(d, USER)).week!.ids;
    const t = await loadDice(d, USER);
    t.stage = 6;
    await saveDice(d, USER, t);
    expect((await loadDice(at(MON + 3 * DAY), USER)).week!.ids).toEqual(first);
    // Nächster Montag: neu nach der Stufe von dann
    const next = await loadDice(at(MON + 7 * DAY), USER);
    expect(next.week!.w).toBe(weekKey(MON + 7 * DAY));
    expect(next.week!.ids).toEqual(weekGoals(weekKey(MON + 7 * DAY), 6));
    expect(next.week!.n).toEqual([0, 0, 0]);
  });
});

describe('Wochenziele (T11): Zählen und Lohn', () => {
  it('je Ziel 80 Pigment beim Erfüllen, nur einmal, alle drei ein leerer Würfel über die Obergrenze', async () => {
    const { at } = world();
    const d = at(MON);
    await learned(d);
    const s = await loadDice(d, USER);
    s.week = { w: weekKey(MON), ids: ['sheets', 'wins', 'dips'], n: [3, 5, 6], got: 0 };
    s.blank = BLANK.max;
    s.pigment = 500;
    await saveDice(d, USER, s);
    const pig0 = s.pigment;
    // Freier Zug: das 7. Mal gezogen
    const a = await dicePull(d, USER, 'free');
    expect(a.week).toEqual([{ id: 'dips', text: goalDef('dips').text, pigment: WEEKLY.pigment }]);
    expect(a.dice.pigment).toBe(pig0 + WEEKLY.pigment);
    // Noch ein Zug zahlt nichts mehr
    const b = await dicePull(d, USER, 'one');
    expect(b.week).toBeUndefined();
    // Ein gewonnenes Duell
    const before = (await loadDice(d, USER)).pigment;
    const r = await payDuel(d, USER, 1, false, [], { washed: [], deck: [] });
    expect(r.week?.map((x) => x.id)).toEqual(['wins']);
    expect(r.total).toBe(before + r.pigment + WEEKLY.pigment);
    // Ein fertiges Tagesblatt: das dritte Ziel, dazu der leere Würfel
    await bleachStart(d, USER, 'weekly');
    const sh = await bleachAct(d, USER, { k: 'giveup' }, 'weekly');
    expect(sh.reward?.week).toEqual([{ id: 'sheets', text: goalDef('sheets').text, pigment: WEEKLY.pigment, blank: true }]);
    const end = await loadDice(d, USER);
    expect(end.week!.got).toBe(7);
    expect(end.week!.all).toBe(1);
    expect(end.blank).toBe(BLANK.max + 1);
  });

  it('Startzüge zählen nicht, vor den ersten Schritten gibt es nichts', async () => {
    const { at } = world();
    const d = at(MON);
    const s0 = await loadDice(d, USER);
    s0.week = { w: weekKey(MON), ids: ['sheets', 'wins', 'dips'], n: [0, 0, 6], got: 0 };
    await saveDice(d, USER, s0);
    // Noch keine Lektion: der Startzug zählt nicht, und es gäbe auch sonst nichts
    const r = await dicePull(d, USER, 'starter');
    expect(r.week).toBeUndefined();
    expect((await loadDice(d, USER)).week!.n[2]).toBe(6);
  });

  it('Geschenk, Tropfen und Zug aus dem Geschenk zählen', async () => {
    const { at } = world();
    const d = at(MON);
    await learned(d);
    const s = await loadDice(d, USER);
    s.week = { w: weekKey(MON), ids: ['pales', 'hearts', 'gifts'], n: [0, 0, 4], got: 0 };
    await saveDice(d, USER, s);
    const g = await giftOpen(d, USER);
    expect(g.week?.map((x) => x.id)).toEqual(['gifts']);
    const t = await loadDice(d, USER);
    t.week = { w: weekKey(MON), ids: ['pales', 'hearts', 'drops'], n: [0, 0, 0], got: 0 };
    t.gift = { n: 1, day: '2026-11-08' };
    await saveDice(d, USER, t);
    // Tag 2 der Leiste ist ein Tropfen
    await giftOpen(d, USER);
    expect((await loadDice(d, USER)).week!.n[2]).toBe(1);
  });

  it('im Duell zählen Herzen der Rivalen-Palette und ausgewaschene Rivalen aus den echten Ereignissen', async () => {
    const { at, redis } = world(23);
    const d = at(MON);
    // Spieler von vorher (alle Regeln)
    redis.strings.set(K.dice(USER), JSON.stringify({ ...emptyDice(), tutorialPaid: true }));
    await dicePull(d, USER, 'starter');
    const s = await loadDice(d, USER);
    s.week = { w: weekKey(MON), ids: ['pales', 'hearts', 'drops'], n: [0, 0, 0], got: 0 };
    await saveDice(d, USER, s);
    const t = await loadDice(d, USER);
    t.week = { w: weekKey(MON), ids: ['pales', 'washed', 'drops'], n: [0, 0, 0], got: 0 };
    let hearts = 0,
      washed = 0,
      found = false;
    for (let k = 0; k < 6 && !found; k++) {
      await saveDice(d, USER, s);
      const { res, events } = await playDuel(d);
      hearts = events.filter((e) => e.k === 'heart' && e.side === 2).length;
      const after = await loadDice(d, USER);
      expect(after.week!.n[1]).toBe(Math.min(goalDef('hearts').n, hearts));
      // Tropfen: so viele, wie das Ergebnis zeigt
      expect(after.week!.n[2]).toBe(Math.min(goalDef('drops').n, res.reward?.drops?.length ?? 0));
      found = hearts > 0;
    }
    expect(found).toBe(true);
    // Ausgewaschene Rivalen, dazu prüfen, was das Duell sonst gezählt hat (Glaze oder Pure, Aufträge, Element ×2, Meisterzüge)
    await saveDice(d, USER, t);
    const { res, events } = await playDuel(d);
    const wk = (JSON.parse(redis.strings.get(K.duel(USER))!) as { wk?: Record<string, number> }).wk ?? {};
    const mine = new Set(res.state!.teams[0]!.units.map((u) => u.id));
    const want = {
      glaze: events.filter((e) => e.k === 'apply' && e.side === 1 && (e.combo?.kind === 'glaze' || e.combo?.kind === 'pure')).length,
      task: events.filter((e) => e.k === 'apply' && e.side === 1 && e.task).length,
      elem: events.filter((e) => e.k === 'shot' && (e.mult ?? 1) >= 2 && e.res !== 'miss' && e.res !== 'dodge' && mine.has(e.id)).length,
      master: events.filter((e) => e.k === 'ability' && e.how === 'master' && mine.has(e.id)).length,
    };
    for (const [k, n] of Object.entries(want)) expect(wk[k] ?? 0).toBe(n);
    expect(want.glaze + want.elem).toBeGreaterThan(0);
    loadState(res.state!);
    washed = S.teams[1].units.filter((u) => u.state === 'gone').length;
    expect((await loadDice(d, USER)).week!.n[1]).toBe(Math.min(goalDef('washed').n, washed));
  });

  it('Test-Knopf: das nächste Ziel gilt als erfüllt, nur für Mods im Playtest', async () => {
    const { at, reddit } = world();
    const d = at(MON);
    await learned(d);
    expect(await code(weekTest(d, USER, 'someone'))).toBe('forbidden');
    reddit.mods.push('Vegavild');
    const r = await weekTest(d, USER, 'Vegavild');
    expect(r.week).toHaveLength(1);
    expect(r.dice.week!.got).toBe(1);
    expect(await code(weekTest(at(MON, '0.2.0'), USER, 'Vegavild'))).toBe('forbidden');
  });
});

describe('Willkommen zurück (T10)', () => {
  it('nach 3 Tagen Pause ein Plain-Zug gratis, höchstens alle 14 Tage', async () => {
    const { at } = world();
    await learned(at(MON));
    await giftOpen(at(MON), USER);
    expect((await diceGet(at(MON + 2 * DAY), USER)).welcome).toBeUndefined();
    const g = await diceGet(at(MON + 3 * DAY), USER);
    expect(g.welcome).toBe(3);
    expect((await playInfo(at(MON + 3 * DAY), USER)).welcome).toBe(true);
    const n0 = g.dice.dice.length;
    const r = await welcomeTake(at(MON + 3 * DAY), USER);
    expect(r.pulls).toHaveLength(1);
    expect(r.pulls[0]!.brush).toBeUndefined();
    expect(r.dice.dice).toHaveLength(n0 + 1);
    expect(r.welcome).toBeUndefined();
    expect(await code(welcomeTake(at(MON + 3 * DAY), USER))).toBe('bad_request');
    // Wieder 4 Tage weg, aber noch keine 14 Tage seit dem letzten: nichts
    expect((await diceGet(at(MON + 7 * DAY), USER)).welcome).toBeUndefined();
    // 14 Tage nach dem letzten und 3 Tage weg: wieder einer
    expect((await diceGet(at(MON + 17 * DAY), USER)).welcome).toBe(14);
  });

  it('ein fälliger Zug bleibt liegen, auch wenn zuerst etwas anderes passiert', async () => {
    const { at } = world();
    await learned(at(MON));
    await giftOpen(at(MON), USER);
    const g = await giftOpen(at(MON + 5 * DAY), USER);
    expect(g.welcome).toBe(5);
    await dicePull(at(MON + 6 * DAY), USER, 'free');
    expect((await diceGet(at(MON + 6 * DAY), USER)).welcome).toBe(5);
    await welcomeTake(at(MON + 6 * DAY), USER);
    expect((await diceGet(at(MON + 6 * DAY), USER)).welcome).toBeUndefined();
  });

  it('ältere Spielstände: zuletzt aktiv aus freiem Zug, Geschenk, Tagesblatt oder Duell', () => {
    const s = { ...emptyDice(), tutorialPaid: true, freeDay: '2026-11-01', rewardDay: '2026-11-03' };
    expect(welcomeAway(s, '2026-11-05')).toBe(0);
    expect(welcomeAway(s, '2026-11-06')).toBe(3);
    // Vor den ersten Schritten oder ganz ohne Spur: nichts
    expect(welcomeAway({ ...s, tutorialPaid: false }, '2026-11-20')).toBe(0);
    expect(welcomeAway({ ...emptyDice(), tutorialPaid: true }, '2026-11-20')).toBe(0);
  });

  it('Sepias Satz nach Tagen', () => {
    expect(welcomeText(4)).toBe('Four days away. The sheet kept your place. Have a dip on me.');
    expect(welcomeText(15)).toMatch(/^Two weeks away\./);
    expect(welcomeText(40)).toMatch(/^Weeks away\./);
    expect(welcomeText(90)).toMatch(/^Months away\./);
  });

  it('Test-Knopf nur für Mods im Playtest', async () => {
    const { at, reddit } = world();
    await learned(at(MON));
    expect(await code(welcomeTest(at(MON), USER, 'someone'))).toBe('forbidden');
    reddit.mods.push('Vegavild');
    const r = await welcomeTest(at(MON), USER, 'Vegavild');
    expect(r.welcome).toBe(4);
    expect((await welcomeTake(at(MON), USER)).pulls).toHaveLength(1);
  });
});
