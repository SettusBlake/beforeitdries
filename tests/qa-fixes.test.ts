/* Befunde aus dem Testlauf vom 02.11.2026 (Server und Spielwirtschaft): jeder Fall, wie er gefunden wurde, und dass er behoben ist */
import { describe, expect, it } from 'vitest';
import { accountCheck, GONE, GONE_NAME, scrub } from '../src/server/accounts';
import { bleachAct, bleachStart } from '../src/server/bleach';
import { GameError, withLock, type Deps } from '../src/server/core';
import { diceDraw, dicePull, loadDice, saveDice } from '../src/server/dice';
import { reviewOk, reviewOver } from '../src/server/drawings';
import { K } from '../src/server/keys';
import { marketBuy, marketList, marketSell, marketTestList, rememberName, tradeCollection, tradeOffer } from '../src/server/market';
import { commentGone } from '../src/server/deletion';
import { adoptNaming, diceShare, NAMING_MS, namingGet, withdrawName } from '../src/server/naming';
import { REWARD, TRADE } from '../src/shared/dice';
import { encodeDrawing } from '../src/shared/drawn';
import { BLEACH, bleachScore, forecast, newBleach } from '../src/shared/duel/bleach';
import { loadState, perform } from '../src/shared/duel/play';
import {
  act,
  aiOpening,
  aiTurnSteps,
  BRIM,
  canMove,
  checkWipe,
  drain,
  emptyCell,
  endRound,
  fillBrim,
  idx,
  newGame,
  placements,
  randomBag,
  rollable,
  ROLL_N,
  S,
  setBonus,
  spendStars,
  startTurn,
  washOut,
  type Ev,
  type Face,
  type Rolled,
  type Side,
  type Unit,
} from '../src/shared/duel/rules';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const DAY = 86_400_000;
const A = 't2_painter',
  B = 't2_buyer';
const PIC = encodeDrawing({ mirror: true, face: null, strokes: [[[0.5, 0.2], [0.3, 0.3], [0.2, 0.5], [0.3, 0.7], [0.5, 0.8]]] });
function setup(seed = 9, now = Date.parse('2026-11-02T12:00:00Z')): Deps & { reddit: FakeReddit; redis: FakeRedis } {
  const r = RNG(seed);
  const reddit = new FakeReddit();
  reddit.mods.push('Vegavild');
  return { redis: new FakeRedis(), reddit, now, rand: () => (r() * 4294967296) >>> 0, subredditName: 'beforeitdries', appSlug: 'beforeitdries', appVersion: '0.0.2', schedule: async () => undefined };
}
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof GameError ? e.code : 'other';
  }
}
/** Spieler mit Startwürfeln, genug Duellen und Pigment zum Handeln */
async function trader(d: Deps, uid: string, name: string, blanks = 0): Promise<void> {
  await dicePull(d, uid, 'starter');
  await rememberName(d, uid, name);
  const s = await loadDice(d, uid);
  s.duels = TRADE.minDuels;
  s.pigment = 5000;
  s.blank = blanks;
  await saveDice(d, uid, s);
}

describe('Konto-Bereinigung', () => {
  it('ein Konto namens „sepia“ verändert keine Pigmente, Farben oder Tropfen anderer Spieler', async () => {
    const d = setup();
    await trader(d, A, 'sepia');
    await trader(d, B, 'Stayer');
    const b = await loadDice(d, B);
    b.drops = { sepia: 7, ultra: 2 };
    b.color = 'rose';
    await saveDice(d, B, b);
    const before = await d.redis.get(K.dice(B));
    d.reddit.gone.add(A);
    await accountCheck(d);
    const r = await accountCheck({ ...d, now: d.now + GONE.confirmDays * DAY });
    expect(r.purged).toEqual([A]);
    expect(await d.redis.get(K.dice(B))).toBe(before);
  });

  it('u/Bob wird ersetzt, u/Bobby nicht', () => {
    const raw = JSON.stringify({ text: 'u/Bob bought from u/Bobby.', u: 'Bob', name: 'Bobby', pig: 'sepia' });
    expect(JSON.parse(scrub(raw, 't2_bob', 'Bob'))).toEqual({ text: `${GONE_NAME} bought from u/Bobby.`, u: GONE_NAME, name: 'Bobby', pig: 'sepia' });
  });
});

describe('Sperren', () => {
  it('eine liegengebliebene Sperre übernimmt nur eine von zwei gleichzeitigen Anfragen', async () => {
    const d = setup();
    await d.redis.hSet(K.locks, { job: String(d.now - 60_000) });
    let runs = 0;
    const one = () =>
      withLock(d, 'job', async () => {
        runs++;
        await new Promise((r) => setTimeout(r, 20));
      });
    const res = await Promise.all([code(one()), code(one())]);
    expect(runs).toBe(1);
    expect(res.sort()).toEqual(['busy', 'ok']);
    // Danach ist die Sperre wieder frei
    expect(await code(one())).toBe('ok');
    expect(await d.redis.hGet(K.locks, 'job')).toBeUndefined();
  });
});

describe('Benennen', () => {
  it('„name it now“ und der Auftrag gleichzeitig: ein Name, Pigment einmal, ein Bestiary-Kommentar', async () => {
    const d = setup();
    await dicePull(d, A, 'starter');
    const [x] = (await loadDice(d, A)).dice;
    const { postId } = await diceShare(d, A, 'finder', x!.id);
    d.reddit.addComment(postId, 'namer', 'Moonmoth', 20);
    d.reddit.addComment(postId, 'other', 'Inkdrop', 10);
    const late = { ...d, now: d.now + NAMING_MS };
    const pig = (await loadDice(d, A)).pigment;
    const [a, b] = await Promise.all([adoptNaming(late, postId), adoptNaming(late, postId)]);
    expect([a.status, b.status].sort()).toEqual(['closed', 'named']);
    expect((await loadDice(d, A)).pigment).toBe(pig + REWARD.name);
    expect((await loadDice(d, 't2_namer')).pigment).toBe(REWARD.name);
    expect(d.reddit.appComments.filter((c) => c.text.includes('Bestiary records'))).toHaveLength(1);
  });

  it('dieselbe Art noch einmal benannt (Kommentar gelöscht): kein zweites Pigment für dieselben Spieler', async () => {
    const d = setup(10);
    await dicePull(d, A, 'starter');
    const [x] = (await loadDice(d, A)).dice;
    let { postId } = await diceShare(d, A, 'finder', x!.id);
    d.reddit.addComment(postId, 'namer', 'Moonmoth', 20);
    await adoptNaming({ ...d, now: d.now + NAMING_MS }, postId);
    const finder = (await loadDice(d, A)).pigment;
    const namer = (await loadDice(d, 't2_namer')).pigment;
    const info = (await namingGet(d, postId)).naming!;
    await commentGone(d, info.commentId!, postId);
    // Am nächsten Tag noch einmal teilen und wieder benennen lassen
    const next = { ...d, now: d.now + 2 * DAY };
    ({ postId } = await diceShare(next, A, 'finder', x!.id));
    d.reddit.addComment(postId, 'namer', 'Moonmoth Again', 20);
    expect((await adoptNaming({ ...next, now: next.now + NAMING_MS }, postId)).status).toBe('named');
    expect((await loadDice(d, A)).pigment).toBe(finder);
    expect((await loadDice(d, 't2_namer')).pigment).toBe(namer);
  });
});

describe('Übermalen', () => {
  async function drawn(d: Deps, uid: string): Promise<string> {
    const die = (await diceDraw(d, uid, PIC, 'painter')).pulls[0]!.die;
    await reviewOk(d, 'Vegavild', `${uid}:${die.id}`);
    return die.id;
  }
  it('nach dem Verkauf übermalt: der Käufer verliert die Zeichnung', async () => {
    const d = setup();
    await trader(d, A, 'painter', 2);
    await trader(d, B, 'buyer');
    const id = await drawn(d, A);
    await marketSell(d, A, 'painter', id, 100, true);
    const item = (await marketList(d, B, 'buyer')).items.find((x) => !x.mine)!;
    expect(item.die.draw).toBeTruthy();
    await marketBuy(d, B, 'buyer', item.id);
    expect((await loadDice(d, B)).dice.some((x) => x.draw)).toBe(true);
    await reviewOver(d, 'Vegavild', `${A}:${id}`);
    expect((await loadDice(d, B)).dice.some((x) => x.draw)).toBe(false);
  });

  it('im Markt übermalt: der Eintrag verliert die Zeichnung, der Käufer bekommt keine', async () => {
    const d = setup(11);
    await trader(d, A, 'painter', 2);
    await trader(d, B, 'buyer');
    const id = await drawn(d, A);
    await marketSell(d, A, 'painter', id, 100, true);
    await reviewOver(d, 'Vegavild', `${A}:${id}`);
    const item = (await marketList(d, B, 'buyer')).items.find((x) => !x.mine)!;
    expect(item.die.draw).toBeUndefined();
    await marketBuy(d, B, 'buyer', item.id);
    expect((await loadDice(d, B)).dice.some((x) => x.draw)).toBe(false);
  });

  it('im Benennen-Post übermalt: der Post zeigt die zufällige Form', async () => {
    const d = setup(12);
    await trader(d, A, 'painter', 2);
    const id = await drawn(d, A);
    const { postId } = await diceShare(d, A, 'painter', id);
    expect((await namingGet(d, postId)).naming!.die.draw).toBeTruthy();
    await reviewOver(d, 'Vegavild', `${A}:${id}`);
    expect((await namingGet(d, postId)).naming!.die.draw).toBeUndefined();
    expect(await d.redis.hLen(K.drawnOk)).toBe(0);
  });
});

describe('Handel', () => {
  it('Test-Händler nehmen Angebote nur von Mods sofort an', async () => {
    const d = setup();
    d.appVersion = '0.0.1.143';
    await trader(d, A, 'Vegavild');
    await trader(d, B, 'someone');
    await dicePull(d, B, 'one');
    await marketTestList(d, A, 'Vegavild');
    const t = (await d.redis.hGet(K.nameOf, 'test:trader1'))!;
    const col = await tradeCollection(d, B, t);
    const mine = (await loadDice(d, B)).dice.find((x) => !x.bound)!;
    const r = await tradeOffer(d, B, 'someone', t, [mine.id], 0, [col.dice[0]!.id], true);
    // Kein Mod: das Angebot steht, nichts wurde getauscht
    expect(r.offers.length).toBe(1);
    expect(r.dice!.dice.dice.some((x) => x.sheet === col.dice[0]!.sheet)).toBe(false);
  });
});

describe('Tagesblatt', () => {
  it('vor Mitternacht begonnen, danach fertig: zählt nicht und zahlt nicht', async () => {
    const d = setup(13, Date.parse('2026-11-02T23:58:00Z'));
    const s = await loadDice(d, A);
    s.tutorialPaid = true;
    await saveDice(d, A, s);
    let res = await bleachStart(d, A, 'painter');
    const late = { ...d, now: Date.parse('2026-11-03T10:00:00Z') };
    loadState(res.state!);
    const u = S.teams[0].units[0]!;
    const p = placements(u)[0]!;
    res = await bleachAct(late, A, { k: 'open', id: u.id, o: p.o, at: p.at });
    for (let g = 0; g < 40 && !res.state!.over; g++) {
      loadState(res.state!);
      const a = S.phase === 'roll' ? { k: 'roll' as const, ids: S.teams[0].units.filter((x) => x.state === 'bag' && !x.used).slice(0, 3).map((x) => x.id) } : { k: 'auto' as const };
      res = await bleachAct(late, A, a);
    }
    expect(res.state!.over).toBe(true);
    expect(res.bleach).toMatchObject({ ranked: false, late: true });
    expect(await d.redis.zCard(K.bleachBoard('2026-11-02'))).toBe(0);
    expect((await loadDice(d, A)).pigment).toBe(s.pigment);
  });
});

/* ---------- Regeln (Testlauf 02.11.2026, Spielregeln) ---------- */
function duel(seed = 42): void {
  const r = RNG(seed);
  newGame(seed, 'master', randomBag(r, 'Y'), randomBag(r, 'R'), seed);
  S.headless = false;
  drain();
}
/** Zwei Kleckse nebeneinander aufs Blatt stellen (a unten, b darüber), auf blankes Papier außerhalb der Paletten */
function pair(a: Unit, b: Unit): void {
  for (const u of [...S.teams[0].units, ...S.teams[1].units]) if (u.state === 'sheet') u.state = 'bag';
  S.cells = S.cells.map((c) => (c.home ? c : emptyCell()));
  for (let y = 3; y < 7; y++)
    for (let x = 0; x < 6; x++) {
      if (S.cells[idx(x, y)]!.home || S.cells[idx(x, y - 1)]!.home) continue;
      Object.assign(a, { state: 'sheet', x, y, moved: false, acted: false, brim: 0 });
      Object.assign(b, { state: 'sheet', x, y: y - 1, moved: false, acted: false, brim: 0 });
      return;
    }
}
/** Ein Ziel, das nicht ausweicht und mit einem Treffer platzt */
function frail(t: Unit): void {
  t.hp = 1;
  t.flo = 0;
  t.traits = [];
  t.brim = 0;
}

describe('Regeln', () => {
  it('Twin trifft einen schon ausgewaschenen Klecks kein zweites Mal (kein zweiter Guard weg)', () => {
    duel();
    const u = S.teams[0].units[0]!,
      t = S.teams[1].units[0]!;
    u.m = { ...u.m, bp: 'doppelkopf' };
    pair(u, t);
    frail(t);
    S.teams[1].crests.guard = 2;
    act(u, 'splash', u.m.main, idx(t.x, t.y));
    expect(t.state).toBe('gone');
    expect(S.teams[1].crests.guard).toBe(1);
    expect(drain().filter((e) => e.k === 'shot' && e.at === idx(t.x, t.y))).toHaveLength(1);
  });

  it('übrige Joker und der letzte Wurf gehen nicht an die andere Seite', () => {
    duel();
    S.joker = 2;
    S.lastRoll = [{ id: S.teams[0].units[0]!.id, fi: 0 }];
    startTurn(2);
    expect(S.joker).toBe(0);
    expect(S.lastRoll).toEqual([]);
  });

  it('Beschwören verbraucht nur die Joker, die als Sterne fehlen', () => {
    duel();
    const [a, b] = S.teams[0].units as [Unit, Unit];
    const roll = (fa: Face): Rolled[] => [
      { u: a, fi: 0, face: fa },
      { u: b, fi: 0, face: { k: 'star', n: 2 } },
    ];
    const spend = (lv: number, fa: Face, joker: number): number => {
      a.lv = lv;
      S.joker = joker;
      S.freeJoker = joker;
      S.starBonus = 0;
      spendStars(roll(fa), a);
      return S.joker;
    };
    // Zwei Sterne reichen für Stufe 2: beide Joker bleiben
    expect(spend(2, { k: 'star', n: 1 }, 2)).toBe(2);
    // Stufe 4: zwei Sterne fehlen, ein Joker (3 Sterne) deckt sie
    expect(spend(4, { k: 'star', n: 1 }, 2)).toBe(1);
    // Der beschworene Würfel zeigt selbst einen Joker: der ist mit ihm verbraucht
    expect(spend(2, { k: 'joker', n: 0 }, 3)).toBe(2);
    expect(S.freeJoker).toBe(0);
  });

  it('Nachsetzen befreit einen eingewickelten Klecks nicht', () => {
    duel();
    const t = S.teams[1].units[0]!,
      v = S.teams[0].units[0]!;
    pair(v, t);
    t.rooted = 1;
    startTurn(2);
    expect(canMove(t)).toBe(false);
    frail(v);
    S.teams[0].crests.guard = 0;
    act(t, 'splash', t.m.main, idx(v.x, v.y));
    expect(v.state).toBe('gone');
    expect(t.again).toBe(true);
    expect(canMove(t)).toBe(false);
  });

  it('Rundenende: Abgänge spritzen ohne die Kombi des letzten Zugs', () => {
    duel();
    S.combo = { kind: 'pure', pig: 'karmin', at: [0, 1, 2], mult: 2, gain: {}, joker: 1, star: 0, text: 'Pure' };
    endRound();
    expect(S.combo).toBeNull();
  });

  it('Sprout macht eigene Farbe nass, nimmt aber keine fremde', () => {
    duel();
    const u = S.teams[0].units[0]!,
      o = S.teams[0].units[1]!;
    u.m = { ...u.m, bp: 'knolle' };
    pair(u, o);
    const under = S.cells[idx(o.x, o.y)]!;
    Object.assign(under, { owner: 2, hue: 'ultra', rgb: [43, 63, 163], wet: 0, layer: 1 });
    const mine = S.cells[idx(u.x, u.y)]!;
    Object.assign(mine, { owner: 1, hue: u.m.main, rgb: [0, 0, 0], wet: 0, layer: 1 });
    u.brim = BRIM.max;
    act(u, 'soak', u.m.main, null);
    expect(S.cells[idx(o.x, o.y)]).toMatchObject({ owner: 2, layer: 1 });
    expect(S.cells[idx(u.x, u.y)]).toMatchObject({ owner: 1, layer: 1 });
    expect(S.cells[idx(u.x, u.y)]!.wet).toBeGreaterThan(0);
  });

  it('die sichtbare Rechnung stimmt: Grundzahl × Element × Kombi ergibt den Treffer', () => {
    let checked = 0;
    for (let g = 0; g < 6; g++) {
      duel(7000 + g * 97);
      aiOpening(2, 'master');
      aiOpening(1, 'master');
      drain();
      for (let guard = 0; guard < 20 && !S.over; guard++) {
        for (const side of [1, 2] as Side[]) {
          const step = aiTurnSteps(side, 0);
          while (step())
            for (const e of drain() as Ev[])
              if (e.k === 'shot' && e.base !== undefined && e.pre !== undefined) {
                expect(e.pre).toBe(Math.max(1, Math.round(e.base * (e.mult ?? 1) * (e.x ?? 1))));
                checked++;
              }
          if (S.over || checkWipe()) break;
        }
        if (!S.over) endRound();
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe('Regeln im Tagesblatt', () => {
  const PALES = BLEACH.waves.reduce((a, b) => a + b, 0);
  function sheet(seed = 11): void {
    const r = RNG(seed);
    const pales = [...randomBag(r, 'P'), ...randomBag(r, 'Q')].slice(0, PALES);
    newBleach({ seed, day: '2026-11-02', colour: 'ultra', deck: randomBag(r, 'Y'), pales, ranked: true });
    S.headless = false;
  }
  it('Pales füllen keine Sättigung, laufen nicht über und haben keinen Set-Bonus', () => {
    sheet();
    const p = S.teams[1].units.find((u) => u.state === 'sheet')!;
    fillBrim(p, BRIM.max);
    expect(p.brim).toBe(0);
    p.brim = BRIM.max;
    const sp = S.teams[1].units.filter((u) => u.state === 'sheet');
    for (const u of sp) u.m = { ...u.m, main: 'sepia' };
    expect(setBonus(2)).toBeNull();
    washOut(p, S.teams[0].units[0]);
    expect(drain().some((e) => e.k === 'ability')).toBe(false);
  });

  it('Aufgeben bringt nie mehr Punkte als Weiterspielen', () => {
    for (let g = 0; g < 12; g++) {
      const seed = 300 + g * 37;
      const play = (giveUp: boolean): number => {
        sheet(seed);
        const u = S.teams[0].units[0]!;
        const p = placements(u)[0]!;
        perform({ k: 'open', id: u.id, o: p.o, at: p.at });
        // Weiterspielen: Sepia spielt jeden Zug bis zum Ende. Aufgeben: nach der ersten Runde vor dem Zug der Bleiche
        for (let k = 0; k < 40 && !S.over; k++) {
          if (giveUp && S.round === BLEACH.waves.length) {
            perform({ k: 'giveup' });
            break;
          }
          if (S.phase === 'roll') perform({ k: 'roll', ids: rollable(S.teams[0]).slice(0, ROLL_N).map((x) => x.id) });
          else perform({ k: 'auto' });
        }
        expect(S.over).toBe(true);
        return bleachScore().total;
      };
      expect(play(true)).toBeLessThanOrEqual(play(false));
    }
  });

  it('die Vorschau lässt Zähler und Zufall unverändert', () => {
    sheet();
    const u = S.teams[0].units[0]!;
    const p = placements(u)[0]!;
    perform({ k: 'open', id: u.id, o: p.o, at: p.at });
    const before = { stamp: S.stamp, rng: S.rng };
    forecast();
    expect({ stamp: S.stamp, rng: S.rng }).toEqual(before);
  });

  it('die Würfe des Tages folgen nicht aus dem öffentlichen Seed, sind aber für alle gleich', async () => {
    const d = setup(14);
    for (const uid of [A, B]) {
      const s = await loadDice(d, uid);
      s.tutorialPaid = true;
      await saveDice(d, uid, s);
      await bleachStart(d, uid, uid);
    }
    const save = async (uid: string) => JSON.parse(JSON.parse((await d.redis.get(K.bleachRun(uid)))!).save) as { gameSeed: number; rng: number; paintSeed: number };
    const [a, b] = [await save(A), await save(B)];
    expect(a.gameSeed).toBe(b.gameSeed);
    expect(a.rng).toBe(b.rng);
    expect(a.paintSeed).toBe(b.paintSeed);
    expect((a.paintSeed ^ 0x5eed) >>> 0).not.toBe(a.gameSeed);
  });
});

describe('Mod-Menü „withdraw this name“', () => {
  for (const on of ['name', 'bestiary'] as const) {
    it(`am ${on === 'name' ? 'Namens-Kommentar' : 'Bestiary-Kommentar'}: Name frei, Art offen, Kommentar entfernt, kein zweites Pigment`, async () => {
      const d = setup(on === 'name' ? 20 : 21);
      await dicePull(d, A, 'starter');
      const [x] = (await loadDice(d, A)).dice;
      const { postId } = await diceShare(d, A, 'finder', x!.id);
      d.reddit.addComment(postId, 'namer', 'Rudeword', 20);
      await adoptNaming({ ...d, now: d.now + NAMING_MS }, postId);
      const info = (await namingGet(d, postId)).naming!;
      expect(info.status).toBe('named');
      const pig = (await loadDice(d, 't2_namer')).pigment;
      const r = await withdrawName(d, on === 'name' ? info.commentId! : info.sayId!);
      expect(r.ok).toBe(true);
      const after = (await namingGet(d, postId)).naming!;
      expect(after.status).toBe('withdrawn');
      expect(await d.redis.hGet(K.speciesNames, 'rudeword')).toBeUndefined();
      expect(d.reddit.comments.get(postId)!.find((c) => c.body === 'Rudeword')!.removed).toBe(true);
      expect(d.reddit.appComments.find((c) => c.cid === info.sayId)!.deleted).toBe(true);
      // Noch einmal: nichts mehr zu tun
      expect((await withdrawName(d, info.commentId!)).ok).toBe(false);
      // Neu benennen zahlt dem alten Namensgeber kein zweites Mal
      const next = { ...d, now: d.now + 2 * DAY };
      const again = (await diceShare(next, A, 'finder', x!.id)).postId;
      d.reddit.addComment(again, 'namer', 'Inkmoth', 20);
      expect((await adoptNaming({ ...next, now: next.now + NAMING_MS }, again)).status).toBe('named');
      expect((await loadDice(d, 't2_namer')).pigment).toBe(pig);
    });
  }
});
