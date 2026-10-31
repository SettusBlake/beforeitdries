/* Galerie-Duell: Abzug nach dem Duell, Suche nach ähnlicher Stärke, Duell gegen echte Würfel, Gebühr, Abholen, Schalter */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { diceGet, loadDice, saveDice } from '../src/server/dice';
import { duelAct, duelStart } from '../src/server/duel';
import { reportDrawing, reviewList, reviewOk } from '../src/server/drawings';
import { deckPower, galleryCollect, galleryFind, galleryHang, galleryStatus, galleryTestSelf, hangDeck, payOwner } from '../src/server/gallery';
import { K } from '../src/server/keys';
import type { DuelResponse } from '../src/shared/api';
import { dieMonster, GALLERY_FEE } from '../src/shared/dice';
import { encodeDrawing } from '../src/shared/drawn';
import { loadState, type DuelAction } from '../src/shared/duel/play';
import { tutorialAction, tutorialActive } from '../src/shared/duel/tutorial';
import { canMove, dieUnit, idx, placements, reach, rollable, ROLL_N, S, summonable, unitById, type Rolled } from '../src/shared/duel/rules';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const A = 't2_owner',
  B = 't2_challenger';
function setup(seed = 3): Deps {
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
const rolled = (): Rolled[] => S.lastRoll.map((r) => ({ u: unitById(r.id)!, fi: r.fi, face: unitById(r.id)!.faces[r.fi]! }));

/** Ein Duell bis zum Ende spielen (einfache Züge wie im Duell-Test) */
async function playOut(d: Deps, uid: string, name: string, res: DuelResponse): Promise<DuelResponse> {
  loadState(res.state!);
  let reward: DuelResponse['reward'];
  for (let guard = 0; guard < 300 && !S.over; guard++) {
    let a: DuelAction;
    if (tutorialActive()) a = tutorialAction()!;
    else if (S.phase === 'medium') a = { k: 'medium', id: S.offer[0]! };
    else if (S.phase === 'opening') {
      const u0 = S.teams[0].units[0]!;
      const p0 = placements(u0)[0]!;
      a = { k: 'open', id: u0.id, o: p0.o, at: p0.at };
    } else if (S.phase === 'roll') {
      const l = rollable(S.teams[0]);
      a = { k: 'roll', ids: l.slice(0, Math.min(ROLL_N, l.length)).map((u) => u.id) };
    } else if (S.phase === 'keep') a = { k: 'keep' };
    else if (S.phase === 'summon') {
      const u = summonable(S.teams[0], rolled())[0];
      const p = u ? placements(u)[0] : undefined;
      a = u && p ? { k: 'summon', id: u.id, o: p.o, at: p.at } : { k: 'skip' };
    } else {
      const u = S.teams[0].units.find((x) => x.state === 'sheet' && !x.acted);
      if (u && canMove(u)) {
        const to = [...reach(u).keys()].find((i) => i !== idx(u.x, u.y));
        a = to !== undefined ? { k: 'go', id: u.id, to, a: 'stamp', at: to } : { k: 'go', id: u.id, to: idx(u.x, u.y), a: 'soak', at: null };
      } else a = u ? { k: 'go', id: u.id, to: idx(u.x, u.y), a: 'soak', at: null } : { k: 'end' };
    }
    if (!tutorialActive() && S.joker > 0 && (S.phase === 'act' || S.phase === 'summon') && a.k !== 'summon') a = { k: 'joker', crest: 'splash' };
    res = await duelAct(d, uid, a, name);
    reward ??= res.reward;
    loadState(res.state!);
  }
  expect(S.over).toBe(true);
  return { ...res, reward };
}

describe('Galerie-Duell', () => {
  it('hängt das Deck nach einem fertigen Duell auf, nicht nach dem Lern-Duell', async () => {
    const d = setup();
    await playOut(d, A, 'tutor', await duelStart(d, A, 'apprentice', true));
    expect(await d.redis.get(K.gallery(A))).toBeUndefined();
    await playOut(d, A, 'inkwell', await duelStart(d, A, 'apprentice'));
    const snap = JSON.parse((await d.redis.get(K.gallery(A)))!);
    expect(snap.name).toBe('inkwell');
    expect(snap.dice).toHaveLength(9);
    expect(await d.redis.zScore(K.galleryPower, A)).toBe(snap.power);
    const s = await loadDice(d, A);
    expect(snap.power).toBe(deckPower(s.bag.map((id) => s.dice.find((x) => x.id === id)!)));
    expect((await galleryStatus(d, A, s)).hung).toBe(true);
  });

  it('findet ein Deck, Herausforderer spielt gegen die echten Würfel, Besitzer bekommt die Gebühr', async () => {
    const d = setup(5);
    // Der Besitzer hat Patina auf einer Seite und eine Zeichnung, die noch kein Mod gesehen hat
    await playOut(d, A, 'inkwell', await duelStart(d, A, 'apprentice'));
    const sa = await loadDice(d, A);
    const worn = sa.dice.find((x) => x.id === sa.bag[0])!;
    worn.mods.push({ i: 0, to: 'x2', p: 1 });
    const drawn = sa.dice.find((x) => x.id === sa.bag[1])!;
    drawn.draw = encodeDrawing({ mirror: false, face: null, strokes: [[[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7], [0.31, 0.31]]] });
    await saveDice(d, A, sa);
    await hangDeck(d, A, 'inkwell', sa);

    // Ohne gefundenes Deck kein Galerie-Duell
    expect(await code(duelStart(d, B, 'apprentice', false, true))).toBe('bad_request');
    const found = await galleryFind(d, B, 'brushy');
    expect(found.foe?.name).toBe('inkwell');
    expect(found.foe?.dice).toHaveLength(9);
    expect(found.foe?.swaps).toBe(1);
    // Die Zeichnung sehen andere erst nach Freigabe
    expect(found.foe?.dice.some((x) => x.draw)).toBe(false);
    expect(JSON.stringify(found)).not.toContain(A);
    // Neu öffnen bringt dasselbe, ein anderes gibt es nicht
    expect((await galleryFind(d, B, 'brushy')).foe?.name).toBe('inkwell');
    expect(await code(galleryFind(d, B, 'brushy', true))).toBe('not_found');

    await d.redis.hSet(K.drawnOk, { [`${A}:${drawn.id}`]: '{}' });
    const res = await duelStart(d, B, 'apprentice', false, true);
    const st = res.state!;
    expect(st.level).toBe('gallery');
    expect(st.foeName).toBe('inkwell');
    expect(st.foeDice).toHaveLength(9);
    expect(JSON.stringify(res)).not.toContain(A);
    loadState(st);
    // Echte Werte ohne Abschlag, Patina und freigegebene Zeichnung auf der Seite des Rivalen
    const rival = S.teams[1].units;
    expect(rival[0]!.faces).toEqual(dieUnit(dieMonster(worn), worn.mods).faces);
    expect(rival[0]!.max).toBe(dieUnit(dieMonster(worn), worn.mods).max);
    expect(rival[1]!.m.draw).toBe(drawn.draw);
    expect(st.foeDice![1]!.drawn).toBe(1);
    expect(st.foeDice![0]!.patina).toBe(worn.patina ?? 0);

    const out = await playOut(d, B, 'brushy', res);
    expect(out.reward?.pigment).toBeGreaterThan(0);
    // Gebühr und Bilanz für den Besitzer, aus seiner Sicht
    const st2 = await galleryStatus(d, A, await loadDice(d, A));
    const k = S.winner === 2 ? 'w' : S.winner === 1 ? 'l' : 'd';
    expect(st2.inbox?.[k]).toBe(1);
    expect(st2.inbox?.pig).toBe(S.winner === 2 ? GALLERY_FEE.win : S.winner === 1 ? GALLERY_FEE.loss : GALLERY_FEE.draw);
    expect(st2.inbox?.who).toEqual(['brushy']);
    expect(st2.rec[k]).toBe(1);
    // Das Deck des Herausforderers hängt jetzt auch
    expect(await d.redis.zScore(K.galleryPower, B)).toBeGreaterThan(0);
    // Dasselbe Deck nicht zweimal am Tag, am nächsten Tag wieder
    expect((await galleryFind(d, B, 'brushy')).foe).toBeNull();
    expect((await galleryFind({ ...d, now: d.now + 86_400_000 }, B, 'brushy')).foe?.name).toBe('inkwell');

    // Abholen: Pigment dazu, danach ist der Bericht leer, die Bilanz bleibt
    const before = (await loadDice(d, A)).pigment;
    const got = await galleryCollect(d, A);
    expect(got.collected).toBe(st2.inbox!.pig);
    expect(got.dice.pigment).toBe(before + st2.inbox!.pig);
    expect(got.gallery.inbox).toBeNull();
    expect(got.gallery.rec[k]).toBe(1);
    expect((await galleryCollect(d, A)).collected).toBe(0);
  });

  it('Gebühr höchstens 60 am Tag', async () => {
    const d = setup();
    for (let i = 0; i < 10; i++) await payOwner({ ...d, now: d.now + i }, A, 2, `p${i}`);
    const st = await galleryStatus(d, A, await loadDice(d, A));
    expect(st.inbox?.w).toBe(10);
    expect(st.inbox?.pig).toBe(GALLERY_FEE.perDay);
    expect(st.inbox?.who).toHaveLength(5);
    await payOwner({ ...d, now: d.now + 86_400_000 }, A, 1, 'late');
    expect((await galleryStatus(d, A, await loadDice(d, A))).inbox?.pig).toBe(GALLERY_FEE.perDay + GALLERY_FEE.loss);
  });

  it('Schalter nimmt das Deck ab und hängt es wieder auf', async () => {
    const d = setup(9);
    await playOut(d, A, 'inkwell', await duelStart(d, A, 'apprentice'));
    expect((await galleryFind(d, B, 'b')).foe?.name).toBe('inkwell');
    const off = await galleryHang(d, A, false);
    expect(off.gallery.hung).toBe(false);
    expect(off.dice.galleryOff).toBe(true);
    // Schon gefunden, inzwischen abgenommen: kein Duell dagegen
    expect(await code(duelStart(d, B, 'apprentice', false, true))).toBe('not_found');
    expect((await galleryFind(d, B, 'b')).foe).toBeNull();
    // Nach einem weiteren Duell bleibt es abgenommen
    await playOut(d, A, 'inkwell', await duelStart(d, A, 'apprentice'));
    expect(await d.redis.zScore(K.galleryPower, A)).toBeUndefined();
    expect((await galleryHang(d, A, true)).gallery.hung).toBe(true);
    expect((await galleryFind(d, B, 'b')).foe?.name).toBe('inkwell');
    expect(await code(galleryHang(d, A, 'yes'))).toBe('bad_request');
  });

  it('sucht ähnliche Stärke und nie das eigene Deck', async () => {
    const d = setup(4);
    const snap = (power: number, name: string) => JSON.stringify({ name, dice: [], media: [], power, at: d.now });
    await playOut(d, B, 'me', await duelStart(d, B, 'apprentice'));
    const mine = (await d.redis.zScore(K.galleryPower, B))!;
    for (const [u, p] of [
      ['t2_weak', mine * 0.5],
      ['t2_near', mine * 1.05],
      ['t2_far', mine * 1.6],
    ] as const) {
      await d.redis.set(K.gallery(u), snap(p, u));
      await d.redis.zAdd(K.galleryPower, { member: u, score: p });
    }
    for (let i = 0; i < 5; i++) expect((await galleryFind({ ...d, now: d.now + i * 86_400_000 }, B, 'me')).foe?.name).toBe('t2_near');
  });

  it('Melden blendet eine Zeichnung aus, bis ein Mod entscheidet', async () => {
    const reddit = new FakeReddit();
    reddit.mods.push('Vegavild');
    const d = { ...setup(8), reddit };
    await playOut(d, A, 'inkwell', await duelStart(d, A, 'apprentice'));
    const sa = await loadDice(d, A);
    const die = sa.dice.find((x) => x.id === sa.bag[2])!;
    die.draw = encodeDrawing({ mirror: true, face: null, strokes: [[[0.5, 0.2], [0.3, 0.3], [0.2, 0.5], [0.3, 0.7], [0.5, 0.8]]] });
    await saveDice(d, A, sa);
    await hangDeck(d, A, 'inkwell', sa);
    const key = `${A}:${die.id}`;
    await d.redis.hSet(K.drawnOk, { [key]: JSON.stringify({ key, uid: A, user: 'inkwell', id: die.id, no: die.no, seed: 1, draw: die.draw, at: d.now, by: 'Vegavild', when: d.now }) });
    await galleryFind(d, B, 'b');
    const st = (await duelStart(d, B, 'apprentice', false, true)).state!;
    expect(st.foeDice![2]!.drawn).toBe(1);
    // Nur Würfel mit Zeichnung lassen sich melden
    expect(await code(reportDrawing(d, B, 0))).toBe('bad_request');
    expect(await reportDrawing(d, B, 2)).toEqual({ reported: 1, left: 4 });
    // Dieselbe Zeichnung zählt je Spieler einmal
    expect((await reportDrawing(d, B, 2)).reported).toBe(1);
    expect(await d.redis.hGet(K.drawnOk, key)).toBeUndefined();
    const list = await reviewList(d, 'Vegavild');
    expect(list.items[0]?.key).toBe(key);
    expect(list.items[0]?.reported).toBe(1);
    // Andere sehen sie jetzt nicht mehr
    expect((await galleryFind({ ...d, now: d.now + 86_400_000 }, 't2_third', 'c')).foe?.dice[2]?.draw).toBeUndefined();
    // Mod gibt frei: sichtbar, eine weitere Meldung blendet sie nicht mehr aus, sie kommt nur wieder in die Liste
    await reviewOk(d, 'Vegavild', key);
    expect(await d.redis.hGet(K.drawnOk, key)).toBeDefined();
    await galleryFind(d, 't2_third', 'c');
    await duelStart(d, 't2_third', 'apprentice', false, true);
    expect((await reportDrawing(d, 't2_third', 2)).reported).toBe(2);
    expect(await d.redis.hGet(K.drawnOk, key)).toBeDefined();
    expect((await reviewList(d, 'Vegavild')).items[0]?.reported).toBe(2);
  });

  it('Test-Schalter: nur Mods im Playtest, dann das eigene Deck', async () => {
    const reddit = new FakeReddit();
    const d = { ...setup(6), reddit, appVersion: '0.0.1.87' };
    expect(await code(galleryTestSelf(d, A, 'Vegavild', true))).toBe('forbidden');
    reddit.mods.push('Vegavild');
    expect(await code(galleryTestSelf({ ...d, appVersion: '0.0.2' }, A, 'Vegavild', true))).toBe('forbidden');
    expect((await galleryTestSelf(d, A, 'Vegavild', true)).dice.testSelf).toBe(true);
    // Ohne Abzug: das Deck, wie es gerade ist
    const f = await galleryFind(d, A, 'Vegavild');
    expect(f.foe?.self).toBe(true);
    expect(f.foe?.name).toBe('Vegavild');
    const res = await duelStart(d, A, 'apprentice', false, true);
    expect(res.state?.foeName).toBe('Vegavild');
    await playOut(d, A, 'Vegavild', res);
    // Die Gebühr geht an dich
    expect((await galleryStatus(d, A, await loadDice(d, A))).inbox).not.toBeNull();
    expect((await galleryTestSelf(d, A, 'Vegavild', false)).dice.testSelf).toBeUndefined();
    expect((await diceGet(d, A, 'Vegavild')).tester).toBe(true);
  });
});
