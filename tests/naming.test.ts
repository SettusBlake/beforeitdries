/* Benennen: teilen, ein Post je Art, einer pro Tag, gemalte erst nach Freigabe, Name aus den Kommentaren, Pigment für beide */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { diceDraw, dicePull, loadDice, saveDice } from '../src/server/dice';
import { reviewOk } from '../src/server/drawings';
import { K } from '../src/server/keys';
import { adoptNaming, diceShare, NAMING_JOB, NAMING_MS, namingGet, speciesNames } from '../src/server/naming';
import { dieSpecies, REWARD } from '../src/shared/dice';
import { encodeDrawing } from '../src/shared/drawn';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const USER = 't2_finder';
const DAY = 86_400_000;
type Job = { name: string; runAt: Date; data: Record<string, string> };

function setup(): Deps & { reddit: FakeReddit; jobs: Job[] } {
  const r = RNG(31);
  const reddit = new FakeReddit();
  reddit.mods.push('Vegavild');
  const jobs: Job[] = [];
  return {
    redis: new FakeRedis(),
    reddit,
    jobs,
    now: Date.parse('2026-10-30T12:00:00Z'),
    rand: () => (r() * 4294967296) >>> 0,
    subredditName: 'beforeitdries',
    appSlug: 'beforeitdries',
    dryMs: 0,
    appVersion: '0.0.2',
    schedule: async (name, runAt, data) => {
      jobs.push({ name, runAt, data });
    },
  };
}
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof GameError ? e.code : 'other';
  }
}

describe('Benennen', () => {
  it('teilen legt einen Post an, je Art nur einer, je Spieler einer am Tag, Auftrag nach 24 Stunden', async () => {
    const d = setup();
    await dicePull(d, USER, 'starter');
    const s = await loadDice(d, USER);
    const [a, b] = s.dice;
    expect(await code(diceShare(d, undefined, 'finder', a!.id))).toBe('login');
    expect(await code(diceShare(d, USER, 'finder', 'nope'))).toBe('not_found');
    const res = await diceShare(d, USER, 'finder', a!.id);
    expect(res.postId).toMatch(/^t3_/);
    expect(d.reddit.posts.at(-1)).toMatchObject({ id: res.postId, title: 'What do you see? A new blot found by u/finder', entry: 'name' });
    expect(d.jobs).toEqual([{ name: NAMING_JOB, runAt: new Date(d.now + NAMING_MS), data: { postId: res.postId } }]);
    const info = (await namingGet(d, res.postId)).naming!;
    expect(info).toMatchObject({ key: dieSpecies(a!), uid: USER, user: 'finder', status: 'open', ends: d.now + NAMING_MS });
    expect(info.die.id).toBe(a!.id);
    expect((await speciesNames(d)).open).toEqual({ [dieSpecies(a!)]: res.postId });
    // Heute kein zweiter Post, morgen schon
    expect(await code(diceShare(d, USER, 'finder', b!.id))).toBe('bad_request');
    const tomorrow = { ...d, now: d.now + DAY };
    // Dieselbe Art läuft schon: auch morgen nicht
    const same = s.dice.find((x) => x !== a && dieSpecies(x) === dieSpecies(a!));
    if (same) expect(await code(diceShare(tomorrow, USER, 'finder', same.id))).toBe('bad_request');
    expect(await code(diceShare(tomorrow, USER, 'finder', b!.id))).toBe('ok');
  });

  it('nach 24 Stunden: oberster gültiger Name, schon vergebene und ungültige zählen nicht, Pigment für Finder und Namensgeber', async () => {
    const d = setup();
    await dicePull(d, USER, 'starter');
    const s = await loadDice(d, USER);
    const [a, b] = s.dice;
    // Eine andere Art heißt schon „Puddle Duke“
    await d.redis.hSetNX(K.speciesNames, 'puddle duke', dieSpecies(b!));
    const { postId } = await diceShare(d, USER, 'finder', a!.id);
    d.reddit.addComment(postId, 'loud', 'this is way too long to be any kind of name at all, sorry', 50);
    d.reddit.addComment(postId, 'taken', 'Puddle Duke', 40);
    d.reddit.addComment(postId, 'removed', 'Bad Word', 30, { removed: true });
    d.reddit.addComment(postId, 'namer', 'name: soggy bishop!', 20);
    d.reddit.addComment(postId, 'late', 'Ink Goblin', 20);
    const before = (await loadDice(d, USER)).pigment;
    const r = await adoptNaming({ ...d, now: d.now + NAMING_MS }, postId);
    expect(r).toEqual({ status: 'named', name: 'Soggy Bishop', namedBy: 'namer' });
    const names = await speciesNames(d);
    expect(names.names[dieSpecies(a!)]).toEqual({ name: 'Soggy Bishop', namedBy: 'namer' });
    expect(names.open).toEqual({});
    expect((await loadDice(d, USER)).pigment).toBe(before + REWARD.name);
    // Der Namensgeber hat nie gespielt: das Pigment wartet in seiner Sammlung
    expect((await loadDice(d, 't2_namer')).pigment).toBe(REWARD.name);
    expect(d.reddit.appComments.at(-1)!.text).toContain('The Bestiary records **Soggy Bishop**');
    expect((await namingGet(d, postId)).naming).toMatchObject({ status: 'named', name: 'Soggy Bishop', namedBy: 'namer' });
    // Noch einmal: nichts passiert, keine zweite Belohnung
    expect((await adoptNaming(d, postId)).status).toBe('closed');
    expect((await loadDice(d, USER)).pigment).toBe(before + REWARD.name);
    // Benannte Arten lassen sich nicht mehr teilen
    const s2 = await loadDice(d, USER);
    s2.nameDay = '';
    await saveDice(d, USER, s2);
    expect(await code(diceShare(d, USER, 'finder', a!.id))).toBe('bad_request');
  });

  it('kein gültiger Name: Art bleibt offen, der nächste darf neu teilen. Mods können abbrechen', async () => {
    const d = setup();
    await dicePull(d, USER, 'starter');
    const [a, b] = (await loadDice(d, USER)).dice;
    const { postId } = await diceShare(d, USER, 'finder', a!.id);
    d.reddit.addComment(postId, 'x', '!!!', 9);
    expect((await adoptNaming(d, postId)).status).toBe('empty');
    expect((await speciesNames(d)).names[dieSpecies(a!)]).toBeUndefined();
    const next = { ...d, now: d.now + DAY };
    const again = await diceShare(next, USER, 'finder', a!.id);
    expect(again.postId).not.toBe(postId);
    expect((await adoptNaming(next, again.postId, true)).status).toBe('cancelled');
    expect((await speciesNames(d)).open).toEqual({});
    expect((await adoptNaming(d, 't3_unknown')).status).toBe('none');
    void b;
  });

  it('gemalte Monster erst nach Freigabe durch einen Mod', async () => {
    const d = setup();
    await dicePull(d, USER, 'starter');
    const s = await loadDice(d, USER);
    s.blank = 1;
    await saveDice(d, USER, s);
    const pic = encodeDrawing({ mirror: true, face: null, strokes: [[[0.5, 0.2], [0.3, 0.3], [0.2, 0.5], [0.3, 0.7], [0.5, 0.8]]] });
    const die = (await diceDraw(d, USER, pic, 'finder')).pulls[0]!.die;
    // Art schon benannt? Dann ist der Test sinnlos
    expect(await d.redis.hGet(K.species(dieSpecies(die)), 'name')).toBeUndefined();
    expect(await code(diceShare(d, USER, 'finder', die.id))).toBe('bad_request');
    await reviewOk(d, 'Vegavild', `${USER}:${die.id}`);
    const res = await diceShare(d, USER, 'finder', die.id);
    expect((await namingGet(d, res.postId)).naming!.die.draw).toBe(die.draw);
  });
});
