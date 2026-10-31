/* Farbschlacht am Server: Start, Prüfung der Aktionen, ein ganzes Duell bis zum Ende */
import { describe, expect, it } from 'vitest';
import { diceGet } from '../src/server/dice';
import { duelAct, duelGet, duelStart } from '../src/server/duel';
import { GameError, type Deps } from '../src/server/core';
import type { DuelResponse } from '../src/shared/api';
import { loadState, type DuelAction } from '../src/shared/duel/play';
import { tutorialAction, tutorialActive } from '../src/shared/duel/tutorial';
import { canMove, COLS, comboOf, counts, CRESTS, idx, reactionOf, type Cell, placements, reach, rollable, ROLL_N, ROWS, S, summonable, unitById, type Face, type Rolled } from '../src/shared/duel/rules';
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
/** Duell starten und das erste angebotene Malmittel nehmen */
async function start(d: Deps, level = 'apprentice'): Promise<DuelResponse> {
  let res = await duelStart(d, USER, level);
  view(res);
  if (S.phase === 'medium') {
    res = await duelAct(d, USER, { k: 'medium', id: S.offer[0]! });
    view(res);
  }
  return res;
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
    // Vor dem Duell: drei Malmittel zur Wahl, der Rivale hat schon gewählt
    expect(res.state?.phase).toBe('medium');
    expect(res.state?.offer).toHaveLength(3);
    expect(res.state?.teams[1]?.media).toHaveLength(1);
    expect(res.events.some((e) => e.k === 'summon' && e.side === 2)).toBe(true);
    view(res);
    expect(await code(duelAct(d, USER, { k: 'medium', id: 'nope' }))).toBe('bad_request');
    const id = S.offer[1]!;
    const picked = await duelAct(d, USER, { k: 'medium', id });
    expect(picked.state?.phase).toBe('opening');
    expect(picked.state?.teams[0]?.media).toEqual([id]);
    expect(JSON.stringify(res)).not.toContain('"rng"');
    expect(JSON.stringify(res)).not.toContain('gameSeed');
    const again = await duelGet(d, USER);
    expect(again.state?.teams[1]?.units.filter((u) => u.state === 'sheet')).toHaveLength(1);
  });

  it('lehnt falsche Aktionen ab', async () => {
    const d = setup();
    await start(d);
    expect(await code(duelAct(d, USER, { k: 'roll', ids: [1, 2, 3] }))).toBe('bad_request');
    expect(await code(duelAct(d, USER, { k: 'open', id: 1, o: 0, at: 0 }))).toBe('bad_request');
    expect(await code(duelAct(d, USER, { k: 'open', id: 99, o: 0, at: 0 }))).toBe('bad_request');
    expect(await code(duelAct(d, USER, { nope: true }))).toBe('bad_request');
  });

  it('spielt ein ganzes Duell bis zum Ende', async () => {
    const d = setup(11);
    let res = await start(d);
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
      } else if (S.phase === 'medium') {
        a = { k: 'medium', id: S.offer[0]! };
      } else if (S.phase === 'keep') {
        // Abwechselnd behalten und den ersten Würfel neu werfen
        a = guard % 2 ? { k: 'keep' } : { k: 'reroll', hold: S.lastRoll.slice(1).map((r) => r.id) };
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
    // Jedes fertige Duell schaltet ein Malmittel frei
    expect(reward?.unlocked).toBe('mask');
    expect((await diceGet(d, USER)).dice.media).toContain('mask');
    expect((await diceGet(d, USER)).dice.pigment).toBe(reward?.pigment);
    // Patina: jeder Wurf zählt beim Würfel in der Sammlung (Neuwürfe mit), die Zahl bleibt am Server
    const thrown = S.teams[0].units.reduce((a, u) => a + (u.rolls ?? 0), 0);
    expect(thrown).toBeGreaterThan(0);
    expect((await diceGet(d, USER)).dice.dice.reduce((a, x) => a + (x.rolls ?? 0), 0)).toBe(thrown);
    expect(JSON.stringify(res)).not.toContain('dieIds');
    // Antworten bleiben klein genug für das Handy
    expect(biggest).toBeLessThan(400_000);
  });

  it('Deck: geworfene Würfel sind verbraucht, bis neu gemischt wird', async () => {
    const d = setup(31);
    await start(d);
    const u0 = S.teams[0].units[0]!;
    const p0 = placements(u0)[0]!;
    view(await duelAct(d, USER, { k: 'open', id: u0.id, o: p0.o, at: p0.at }));
    const first = rollable(S.teams[0]).slice(0, ROLL_N).map((u) => u.id);
    view(await duelAct(d, USER, { k: 'roll', ids: first }));
    expect(first.every((id) => unitById(id)!.used)).toBe(true);
    if (S.phase === 'keep') view(await duelAct(d, USER, { k: 'keep' }));
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
    await start(d);
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
    await start(d);
    const u0 = S.teams[0].units[0]!;
    const p0 = placements(u0)[0]!;
    view(await duelAct(d, USER, { k: 'open', id: u0.id, o: p0.o, at: p0.at }));
    const l = rollable(S.teams[0]);
    view(await duelAct(d, USER, { k: 'roll', ids: l.slice(0, ROLL_N).map((u) => u.id) }));
    if (S.phase === 'keep') view(await duelAct(d, USER, { k: 'keep' }));
    if (S.phase === 'summon') view(await duelAct(d, USER, { k: 'skip' }));
    // Alle Joker nehmen (Kombi und Sepias Auftrag können zusammen zwei geben), sonst endet der Zug nicht von selbst
    while (S.joker > 0) view(await duelAct(d, USER, { k: 'joker', crest: 'step' }));
    const u = S.teams[0].units.find((x) => x.state === 'sheet')!;
    const here = idx(u.x, u.y);
    const far = [...Array(COLS * ROWS).keys()].find((i) => !reach(u).has(i) && Math.max(Math.abs((i % COLS) - u.x), Math.abs(Math.floor(i / COLS) - u.y)) > 4)!;
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
    await start(d);
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

  it('Neuwurf: halten, den Rest einmal neu werfen, erst dann zählen Symbole und Kombi', async () => {
    // Einen Wurf suchen, der in der Haltephase landet (ein Drilling gilt sofort)
    let d = setup(41),
      l: number[] = [],
      res: DuelResponse | null = null;
    for (let seed = 41; seed < 60; seed++) {
      d = setup(seed);
      await start(d);
      const u0 = S.teams[0].units[0]!;
      const p0 = placements(u0)[0]!;
      view(await duelAct(d, USER, { k: 'open', id: u0.id, o: p0.o, at: p0.at }));
      l = rollable(S.teams[0]).slice(0, ROLL_N).map((u) => u.id);
      res = await duelAct(d, USER, { k: 'roll', ids: l });
      view(res);
      if (S.phase === 'keep') break;
    }
    const u0 = S.teams[0].units.find((u) => u.state === 'sheet')!;
    expect(res!.events.some((e) => e.k === 'roll')).toBe(true);
    expect(S.phase).toBe('keep');
    const before = { ...S.teams[0].crests };
    expect(res!.events.some((e) => e.k === 'apply')).toBe(false);
    // Nur Würfel aus diesem Wurf, mindestens einer muss neu
    expect(await code(duelAct(d, USER, { k: 'reroll', hold: [999] }))).toBe('bad_request');
    expect(await code(duelAct(d, USER, { k: 'reroll', hold: l }))).toBe('bad_request');
    expect(await code(duelAct(d, USER, { k: 'go', id: u0.id, to: idx(u0.x, u0.y), a: 'soak', at: null }))).toBe('bad_request');
    const kept = S.lastRoll[0]!;
    const r2 = await duelAct(d, USER, { k: 'reroll', hold: [kept.id] });
    view(r2);
    const again = r2.events.find((e) => e.k === 'reroll');
    expect(again && again.k === 'reroll' && again.dice.map((x) => x.id).sort()).toEqual(l.filter((id) => id !== kept.id).sort());
    expect(S.lastRoll.find((r) => r.id === kept.id)!.fi).toBe(kept.fi);
    // Nur ein Neuwurf: danach gilt der Wurf von selbst
    const ap = r2.events.find((e) => e.k === 'apply');
    expect(ap).toBeTruthy();
    expect(['summon', 'act', 'roll', 'over']).toContain(String(S.phase));
    const gained = CRESTS.reduce((a, c) => a + S.teams[0].crests[c.k] - before[c.k], 0);
    expect(gained).toBeGreaterThanOrEqual(0);
    expect(await code(duelAct(d, USER, { k: 'reroll', hold: [] }))).toBe('bad_request');
  });

  it('Kombis: Paar, Drilling, Regenbogen, Joker zählt als beliebiges Symbol', () => {
    const f = (k: Face['k'], n = 1): Face => ({ k, n });
    expect(comboOf([f('glow'), f('glow'), f('step')])).toMatchObject({ kind: 'pair', sym: 'glow', gain: { glow: 1 } });
    expect(comboOf([f('splash'), f('splash'), f('splash')])).toMatchObject({ kind: 'triple', gain: { splash: 2 }, joker: 1 });
    expect(comboOf([f('step'), f('guard'), f('glow')])).toMatchObject({ kind: 'rainbow', joker: 1 });
    // Zwei Sterne sind keine Kombi, sie beschwören
    expect(comboOf([f('star', 2), f('star', 1), f('glow')])).toBeNull();
    expect(comboOf([f('star', 2), f('glow'), f('gold')])).toBeNull();
    expect(comboOf([f('star', 2), f('star', 2), f('joker', 3)])).toMatchObject({ kind: 'triple', sym: 'star' });
    // Drei Sterne nur mit gleicher Stufe
    expect(comboOf([f('star', 2), f('star', 1), f('star', 2)])).toBeNull();
    expect(comboOf([f('star', 1), f('star', 1), f('star', 1)])).toMatchObject({ kind: 'triple', sym: 'star', joker: 1 });
    expect(comboOf([f('joker', 3), f('guard'), f('guard')])).toMatchObject({ kind: 'triple', sym: 'guard' });
    expect(comboOf([f('joker', 3), f('guard'), f('step')])).toMatchObject({ kind: 'pair', sym: 'guard' });
    expect(comboOf([f('glow', 2), f('step'), f('step')])).toMatchObject({ kind: 'pair', sym: 'step' });
    expect(comboOf([f('joker', 3), f('step'), f('star', 1)])).toMatchObject({ kind: 'pair', sym: 'step' });
    expect(comboOf([f('step'), f('glow'), f('star', 1)])).toBeNull();
    expect(comboOf([f('glow')])).toBeNull();
  });

  it('Farbreaktionen: Lasur nur über getrockneter eigener Farbe, Nachbarfarbe verläuft, Lasur zählt doppelt', () => {
    const cell = (o: Partial<Cell>): Cell => ({ owner: 0, rgb: [0, 0, 0], hue: null, wet: 0, atk: 0, def: 0, lf: 0, stamp: 0, home: 0, ...o });
    expect(reactionOf(1, 'ultra', cell({ owner: 1, hue: 'ultra' }))).toBe('glaze');
    expect(reactionOf(1, 'ultra', cell({ owner: 1, hue: 'ultra', wet: 1 }))).toBeNull();
    expect(reactionOf(1, 'ultra', cell({ owner: 1, hue: 'ultra', layer: 1 }))).toBeNull();
    expect(reactionOf(1, 'ultra', cell({ owner: 2, hue: 'ultra' }))).toBeNull();
    // Ultramarin und Indigo liegen nah beieinander, Ultramarin und Kadmiumgelb nicht
    expect(reactionOf(1, 'ultra', cell({ owner: 2, hue: 'indigo' }))).toBe('bleed');
    expect(reactionOf(1, 'ultra', cell({ owner: 1, hue: 'indigo', wet: 1 }))).toBe('bleed');
    expect(reactionOf(1, 'ultra', cell({ owner: 2, hue: 'kadmium' }))).toBeNull();
    expect(reactionOf(1, 'ultra', cell({}))).toBeNull();
    const before = counts([cell({ owner: 1, hue: 'ultra' }), cell({ owner: 2, hue: 'opera' })]);
    const after = counts([cell({ owner: 1, hue: 'ultra', layer: 1 }), cell({ owner: 2, hue: 'opera' })]);
    expect(after[0]).toBe(before[0] + 1);
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
        for (const e of res.events) {
          if (e.k === 'apply' && e.side === 1 && e.combo) seen.add('combo');
          if (e.k === 'ability' && e.how === 'master' && S.teams[0].units.some((u) => u.id === e.id)) seen.add('master');
        }
        view(res);
      }
      // Sepia zeigt auch Neuwurf und eine Kombi
      for (const k of ['open', 'roll', 'reroll', 'combo', 'summon', 'stamp', 'splash', 'master', 'palette']) expect([k, seen.has(k)]).toEqual([k, true]);
      expect(S.teams[1].hearts).toBeLessThan(3);
      runs.push(JSON.stringify(S.cells.map((c) => c.owner)));
    }
    // Feste Würfe: zwei Spieler erleben dasselbe Lern-Duell
    expect(runs[0]).toBe(runs[1]);
  });
});
