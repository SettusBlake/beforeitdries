/* Farbschlacht am Server: Start, Prüfung der Aktionen, ein ganzes Duell bis zum Ende */
import { describe, expect, it } from 'vitest';
import { diceGet } from '../src/server/dice';
import { duelAct, duelGet, duelStart } from '../src/server/duel';
import { GameError, type Deps } from '../src/server/core';
import type { DuelResponse } from '../src/shared/api';
import { loadState, type DuelAction } from '../src/shared/duel/play';
import { tutorialAction, tutorialActive } from '../src/shared/duel/tutorial';
import { canMove, idx, placements, reach, rollable, ROLL_N, S, summonable, unitById, type Rolled } from '../src/shared/duel/rules';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const USER = 't2_tester';
function setup(seed = 7) {
  const r = RNG(seed);
  const d: Deps = { redis: new FakeRedis(), reddit: new FakeReddit(), now: Date.parse('2026-10-28T12:00:00Z'), rand: () => (r() * 4294967296) >>> 0, subredditName: 'beforeitdries', appSlug: 'beforeitdries', dryMs: 0 };
  return d;
}
/** Den Stand so laden, wie der Client ihn sieht, und daraus Züge wählen */
function view(res: DuelResponse): void {
  loadState(res.state!);
}
function rolled(): Rolled[] {
  return S.lastRoll.map((r) => ({ u: unitById(r.id)!, fi: r.fi, face: unitById(r.id)!.faces[r.fi]! }));
}
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof GameError ? e.code : 'other';
  }
}

describe('Duell am Server', () => {
  it('verlangt einen Login', async () => {
    expect(await code(duelStart(setup(), undefined, 'apprentice'))).toBe('login');
  });

  it('startet mit Eröffnung des Rivalen und behält den Würfelzufall für sich', async () => {
    const d = setup();
    const res = await duelStart(d, USER, 'apprentice');
    expect(res.state?.phase).toBe('opening');
    expect(res.events.some((e) => e.k === 'summon' && e.side === 2)).toBe(true);
    expect(JSON.stringify(res)).not.toContain('"rng"');
    expect(JSON.stringify(res)).not.toContain('gameSeed');
    const again = await duelGet(d, USER);
    expect(again.state?.teams[1]?.units.filter((u) => u.state === 'sheet')).toHaveLength(1);
  });

  it('lehnt falsche Aktionen ab', async () => {
    const d = setup();
    const res = await duelStart(d, USER, 'apprentice');
    view(res);
    expect(await code(duelAct(d, USER, { k: 'roll', ids: [1, 2, 3] }))).toBe('bad_request');
    expect(await code(duelAct(d, USER, { k: 'open', id: 1, o: 0, at: 0 }))).toBe('bad_request');
    expect(await code(duelAct(d, USER, { k: 'open', id: 99, o: 0, at: 0 }))).toBe('bad_request');
    expect(await code(duelAct(d, USER, { nope: true }))).toBe('bad_request');
  });

  it('spielt ein ganzes Duell bis zum Ende', async () => {
    const d = setup(11);
    let res = await duelStart(d, USER, 'apprentice');
    view(res);
    const u0 = S.teams[0].units[0]!;
    const p0 = placements(u0)[0]!;
    res = await duelAct(d, USER, { k: 'open', id: u0.id, o: p0.o, at: p0.at });
    view(res);
    expect(S.phase).toBe('roll');
    let biggest = 0,
      reward: DuelResponse['reward'];
    for (let guard = 0; guard < 200 && !S.over; guard++) {
      let a: DuelAction;
      if (S.phase === 'roll') {
        const l = rollable(S.teams[0]);
        a = { k: 'roll', ids: l.slice(0, Math.min(ROLL_N, l.length)).map((u) => u.id) };
      } else if (S.phase === 'summon') {
        const u = summonable(S.teams[0], rolled())[0];
        const p = u ? placements(u)[0] : undefined;
        a = u && p ? { k: 'summon', id: u.id, o: p.o, at: p.at } : { k: 'skip' };
      } else {
        const u = S.teams[0].units.find((x) => x.state === 'sheet' && !x.acted);
        if (u && canMove(u)) {
          // Hinlaufen und am Ziel stempeln
          const to = [...reach(u).keys()].find((i) => i !== idx(u.x, u.y));
          a = to !== undefined ? { k: 'go', id: u.id, to, a: 'stamp', at: to } : { k: 'go', id: u.id, to: idx(u.x, u.y), a: 'soak', at: null };
        } else a = u ? { k: 'go', id: u.id, to: idx(u.x, u.y), a: 'soak', at: null } : { k: 'end' };
      }
      // Joker gleich als Symbol nehmen
      if (S.joker > 0 && (S.phase === 'act' || S.phase === 'summon') && a.k !== 'summon') a = { k: 'joker', crest: 'splash' };
      res = await duelAct(d, USER, a);
      reward ??= res.reward;
      biggest = Math.max(biggest, JSON.stringify(res).length);
      view(res);
    }
    expect(S.over).toBe(true);
    expect(S.phase).toBe('over');
    expect(await code(duelAct(d, USER, { k: 'end' }))).toBe('bad_request');
    // Pigment genau einmal, je nach Ausgang
    expect(reward?.pigment).toBe(S.winner === 1 ? 60 : S.winner === 2 ? 25 : 40);
    expect((await diceGet(d, USER)).dice.pigment).toBe(reward?.pigment);
    // Antworten bleiben klein genug für das Handy
    expect(biggest).toBeLessThan(400_000);
  });

  it('Deck: geworfene Würfel sind verbraucht, bis neu gemischt wird', async () => {
    const d = setup(31);
    view(await duelStart(d, USER, 'apprentice'));
    const u0 = S.teams[0].units[0]!;
    const p0 = placements(u0)[0]!;
    view(await duelAct(d, USER, { k: 'open', id: u0.id, o: p0.o, at: p0.at }));
    const first = rollable(S.teams[0]).slice(0, ROLL_N).map((u) => u.id);
    view(await duelAct(d, USER, { k: 'roll', ids: first }));
    expect(first.every((id) => unitById(id)!.used)).toBe(true);
    // Bis zur nächsten Runde: dieselben Würfel gehen nicht noch einmal
    if (S.phase === 'summon') view(await duelAct(d, USER, { k: 'skip' }));
    if (S.joker > 0) view(await duelAct(d, USER, { k: 'joker', crest: 'step' }));
    if (S.phase === 'act') view(await duelAct(d, USER, { k: 'end' }));
    expect(S.phase).toBe('roll');
    const stillUsed = first.filter((id) => unitById(id)!.state === 'bag');
    if (stillUsed.length) expect(await code(duelAct(d, USER, { k: 'roll', ids: [stillUsed[0]!, ...rollable(S.teams[0]).slice(0, ROLL_N - 1).map((u) => u.id)] }))).toBe('bad_request');
    // Beschworene Würfel werden nicht geworfen
    expect(rollable(S.teams[0]).every((u) => u.state === 'bag')).toBe(true);
  });

  it('Joker wird zum Symbol nach Wahl, danach kein Beschwören mehr', async () => {
    const d = setup(12);
    view(await duelStart(d, USER, 'apprentice'));
    const u0 = S.teams[0].units[0]!;
    const p0 = placements(u0)[0]!;
    view(await duelAct(d, USER, { k: 'open', id: u0.id, o: p0.o, at: p0.at }));
    // Stand mit einem offenen Joker in der Beschwörungsphase
    const raw = JSON.parse((await d.redis.get(`duel:${USER}`))!);
    raw.phase = 'summon';
    raw.joker = 1;
    const before = raw.teams[0].crests.splash;
    await d.redis.set(`duel:${USER}`, JSON.stringify(raw));
    expect(await code(duelAct(d, USER, { k: 'joker', crest: 'nope' }))).toBe('bad_request');
    const res = await duelAct(d, USER, { k: 'joker', crest: 'splash' });
    view(res);
    expect(S.teams[0].crests.splash).toBe(before + 1);
    expect(S.joker).toBe(0);
    expect(S.phase).toBe('act');
    expect(await code(duelAct(d, USER, { k: 'joker', crest: 'splash' }))).toBe('bad_request');
  });

  it('ein Wisch: hinlaufen und handeln in einer Aktion, prüft vom Ziel aus, Zug endet von selbst', async () => {
    const d = setup(21);
    view(await duelStart(d, USER, 'apprentice'));
    const u0 = S.teams[0].units[0]!;
    const p0 = placements(u0)[0]!;
    view(await duelAct(d, USER, { k: 'open', id: u0.id, o: p0.o, at: p0.at }));
    const l = rollable(S.teams[0]);
    view(await duelAct(d, USER, { k: 'roll', ids: l.slice(0, ROLL_N).map((u) => u.id) }));
    if (S.phase === 'summon') view(await duelAct(d, USER, { k: 'skip' }));
    if (S.joker > 0) view(await duelAct(d, USER, { k: 'joker', crest: 'step' }));
    const u = S.teams[0].units.find((x) => x.state === 'sheet')!;
    const here = idx(u.x, u.y);
    const far = [...Array(49).keys()].find((i) => !reach(u).has(i) && Math.max(Math.abs((i % 7) - u.x), Math.abs(Math.floor(i / 7) - u.y)) > 4)!;
    // Ziel außer Reichweite, Stempel außer Reichweite, unbekannte Aktion
    expect(await code(duelAct(d, USER, { k: 'go', id: u.id, to: far, a: 'stamp', at: far }))).toBe('bad_request');
    expect(await code(duelAct(d, USER, { k: 'go', id: u.id, to: here, a: 'stamp', at: far }))).toBe('bad_request');
    expect(await code(duelAct(d, USER, { k: 'go', id: u.id, to: here, a: 'dance', at: null }))).toBe('bad_request');
    const to = [...reach(u).keys()].find((i) => i !== here)!;
    const res = await duelAct(d, USER, { k: 'go', id: u.id, to, a: 'stamp', at: to });
    view(res);
    expect(res.events.some((e) => e.k === 'move')).toBe(true);
    expect(res.events.some((e) => e.k === 'stamp')).toBe(true);
    // Der einzige Klecks hat gehandelt: der Rivale war schon dran, neue Runde
    expect(res.events.some((e) => e.k === 'turn' && e.side === 2)).toBe(true);
    expect(S.phase).toBe('roll');
    expect(S.round).toBe(2);
  });

  it('Sepia paints: spielt den Rest des Zuges', async () => {
    const d = setup(22);
    view(await duelStart(d, USER, 'apprentice'));
    const u0 = S.teams[0].units[0]!;
    const p0 = placements(u0)[0]!;
    view(await duelAct(d, USER, { k: 'open', id: u0.id, o: p0.o, at: p0.at }));
    expect(await code(duelAct(d, USER, { k: 'auto' }))).toBe('bad_request');
    const l = rollable(S.teams[0]);
    view(await duelAct(d, USER, { k: 'roll', ids: l.slice(0, ROLL_N).map((u) => u.id) }));
    const res = await duelAct(d, USER, { k: 'auto' });
    view(res);
    expect(S.round).toBe(2);
    expect(S.phase === 'roll' || S.phase === 'over').toBe(true);
  });

  it('verwirft Duelle nach alten Regeln', async () => {
    const d = setup(23);
    await duelStart(d, USER, 'apprentice');
    const raw = JSON.parse((await d.redis.get(`duel:${USER}`))!);
    raw.v = 1;
    await d.redis.set(`duel:${USER}`, JSON.stringify(raw));
    expect((await duelGet(d, USER)).state).toBeNull();
    expect(await code(duelAct(d, USER, { k: 'end' }))).toBe('not_found');
  });

  it('führt durch das Lern-Duell, immer gleich, und lässt nur Sepias Schritt zu', async () => {
    const runs: string[] = [];
    for (const seed of [3, 4]) {
      const d = setup(seed);
      let res = await duelStart(d, USER, 'master', true);
      view(res);
      expect(S.tutorial).toBeGreaterThan(0);
      expect(S.level).toBe('apprentice');
      // Ein anderer Schritt als der vorgegebene wird abgelehnt
      const exp = tutorialAction()!;
      expect(exp.k).toBe('open');
      expect(await code(duelAct(d, USER, { ...exp, at: (exp as { at: number }).at === 0 ? 1 : 0 }))).toBe('bad_request');
      const seen = new Set<string>();
      let guard = 0;
      while (tutorialActive() && guard++ < 100) {
        const a = tutorialAction()!;
        seen.add(a.k === 'go' ? (a.a === 'splash' && a.at === S.teams[1].home ? 'palette' : a.a) : a.k);
        res = await duelAct(d, USER, a);
        view(res);
      }
      for (const k of ['open', 'roll', 'summon', 'stamp', 'splash', 'ability', 'palette']) expect(seen.has(k)).toBe(true);
      expect(S.teams[1].hearts).toBeLessThan(3);
      runs.push(JSON.stringify(S.cells.map((c) => c.owner)));
    }
    // Feste Würfe: zwei Spieler erleben dasselbe Lern-Duell
    expect(runs[0]).toBe(runs[1]);
  });
});
