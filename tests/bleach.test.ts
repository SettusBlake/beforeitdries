/* Bleach: Wellen, Zug der Bleiche, Flick, Punkte, Tagesaufbau, Wertungslauf, Rangliste, Belohnung */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { bleachAct, bleachDay, bleachGet, bleachShare, bleachStart, ensureSheetPost, sheetGet } from '../src/server/bleach';
import { commentGone, postGone } from '../src/server/deletion';
import { K } from '../src/server/keys';
import { loadDice, saveDice } from '../src/server/dice';
import { BLEACH, bleachMove, bleachScore, doFlick, forecast, newBleach, sheetCode } from '../src/shared/duel/bleach';
import { emojiRows, isSheet, readCell, shareText, SHEET_COLS, SHEET_ROWS, squareOf } from '../src/shared/sheet';
import { loadState, perform } from '../src/shared/duel/play';
import { COLS, drain, emptyCell, idx, NO_HOME, onSheet, placements, randomBag, ROWS, S, type Unit } from '../src/shared/duel/rules';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const USER = 't2_painter';
const NOW = Date.parse('2026-11-02T10:00:00Z');
function setup(seed = 3, now = NOW): Deps {
  const r = RNG(seed);
  return { redis: new FakeRedis(), reddit: new FakeReddit(), now, rand: () => (r() * 4294967296) >>> 0, subredditName: 'beforeitdries', appSlug: 'beforeitdries', dryMs: 0, appVersion: '0.0.1.99' };
}
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof GameError ? e.code : 'other';
  }
}
const PALES = BLEACH.waves.reduce((a, b) => a + b, 0);
function fresh(seed = 11): void {
  const r = RNG(seed);
  const pales = [...randomBag(r, 'P'), ...randomBag(r, 'Q')].slice(0, PALES);
  newBleach({ seed, day: '2026-11-02', colour: 'ultra', deck: randomBag(r, 'Y'), pales, ranked: true });
}
/** Alle Pales vom Blatt nehmen und das Blatt leeren, dann gezielt einen setzen */
function clear(): void {
  for (const u of S.teams[1].units) u.state = 'bag';
  S.cells = S.cells.map((c) => (c.home ? c : emptyCell()));
}
function put(u: Unit, x: number, y: number): void {
  u.state = 'sheet';
  u.x = x;
  u.y = y;
}
async function unlock(d: Deps, uid = USER): Promise<void> {
  const s = await loadDice(d, uid);
  s.tutorialPaid = true;
  await saveDice(d, uid, s);
}
/** Sepia spielt jeden Zug, bis das Blatt trocken ist */
async function playOut(d: Deps, uid = USER, name = 'painter', test = false) {
  let res = await bleachStart(d, uid, name, test);
  loadState(res.state!);
  const u = S.teams[0].units[0]!;
  const p = placements(u)[0]!;
  res = await bleachAct(d, uid, { k: 'open', id: u.id, o: p.o, at: p.at });
  for (let g = 0; g < 40 && !res.state!.over; g++) {
    loadState(res.state!);
    const a = S.phase === 'roll' ? { k: 'roll' as const, ids: S.teams[0].units.filter((x) => x.state === 'bag' && !x.used).slice(0, 3).map((x) => x.id) } : { k: 'auto' as const };
    res = await bleachAct(d, uid, a);
  }
  return res;
}

describe('Bleach: Regeln', () => {
  it('Aufbau: 14 Pales in 5 Wellen, die erste steht oben, die Bleiche hat keine Palette und keine Farbe', () => {
    fresh();
    expect(S.mode).toBe('bleach');
    expect(S.teams[1].units).toHaveLength(PALES);
    expect(S.bleach!.waves.map((w) => w.length)).toEqual(BLEACH.waves);
    expect(S.teams[1].home).toBe(NO_HOME);
    expect(S.cells.some((c) => c.owner === 2 || c.home === 2)).toBe(false);
    const on = onSheet(S.teams[1]);
    expect(on).toHaveLength(BLEACH.waves[0]!);
    for (const u of on) expect(u.y).toBe(BLEACH.spawnRow);
    // Der große kommt in Welle 3 und hat mehr Lebenskraft
    expect(S.bleach!.waves[BLEACH.bossWave - 1]!.some((p) => p.id === S.bleach!.boss)).toBe(true);
  });

  it('die Bleiche zieht: freies Papier drei Schritte, Farbe kostet einen Schritt, Lasur zwei, ein Klecks im Weg wird getroffen', () => {
    fresh();
    clear();
    const [a, b, c] = S.teams[1].units;
    put(a!, 0, 0);
    // b: Farbe direkt darunter, dann frei
    put(b!, 2, 0);
    S.cells[idx(2, 1)] = { ...emptyCell(), owner: 1 };
    // c: lasierte Farbe darunter (zwei Schichten)
    put(c!, 4, 0);
    S.cells[idx(4, 1)] = { ...emptyCell(), owner: 1, layer: 1 };
    bleachMove();
    expect(a!.y).toBe(3);
    expect(b!.y).toBe(2);
    expect(S.cells[idx(2, 1)]!.owner).toBe(0);
    expect(c!.y).toBe(1);
    // Ein eigener Klecks im Weg wird getroffen, der Pale bleibt stehen
    const mine = S.teams[0].units[0]!;
    put(mine, 0, 4);
    const hp = mine.hp;
    bleachMove();
    expect(a!.y).toBe(3);
    expect(mine.hp).toBeLessThan(hp);
  });

  it('je Schritt ein Ereignis mit allen Pales (sie ziehen zugleich), die Vorschau sagt genau, was danach passiert', () => {
    fresh();
    clear();
    const [a, b, c] = S.teams[1].units;
    put(a!, 0, 1);
    put(b!, 2, 1);
    S.cells[idx(2, 2)] = { ...emptyCell(), owner: 1 };
    put(c!, 4, ROWS - 2);
    const mine = S.teams[0].units[0]!;
    put(mine, 0, 3);
    const cast = forecast();
    // Die Vorschau ändert nichts
    expect([a!.y, b!.y, c!.y]).toEqual([1, 1, ROWS - 2]);
    expect(S.cells[idx(2, 2)]!.owner).toBe(1);
    drain();
    bleachMove();
    const evs = drain();
    const steps = evs.filter((e) => e.k === 'pales');
    expect(steps).toHaveLength(BLEACH.steps);
    // Im ersten Schritt handeln alle drei zugleich
    if (steps[0]!.k === 'pales') expect(new Set(steps[0]!.acts.map((x) => x.id))).toEqual(new Set([a!.id, b!.id, c!.id]));
    const end = (id: number) => cast.find((x) => x.id === id)!;
    expect(end(a!.id).path.at(-1)).toBe(idx(a!.x, a!.y));
    expect(end(a!.id).hits).toBeGreaterThan(0);
    expect(end(b!.id).bleached).toContain(idx(2, 2));
    expect(end(b!.id).path.at(-1)).toBe(idx(b!.x, b!.y));
    expect(end(c!.id).through).toBe(true);
    expect(c!.state).toBe('gone');
  });

  it('wer unten hinausrutscht, bleicht ein Herz. Ein Guard fängt das ab. Null Herzen beenden den Lauf', () => {
    fresh();
    clear();
    const me = S.teams[0];
    const ps = S.teams[1].units;
    me.crests.guard = 1;
    put(ps[0]!, 0, ROWS - 1);
    bleachMove();
    expect(me.crests.guard).toBe(0);
    expect(me.hearts).toBe(3);
    expect(S.bleach!.through).toContain(ps[0]!.id);
    for (const k of [1, 2, 3]) put(ps[k]!, k, ROWS - 1);
    bleachMove();
    expect(me.hearts).toBe(0);
    expect(S.over).toBe(true);
    expect(S.winner).toBe(2);
  });

  it('Flick trifft jeden Pale einer Reihe, Punkte zählen Farbe, Lasur, ausgewaschene Pales und Herzen', () => {
    fresh();
    clear();
    const ps = S.teams[1].units;
    put(ps[0]!, 0, 3);
    put(ps[1]!, 3, 3);
    put(ps[2]!, 5, 4);
    ps[1]!.hp = 2;
    const hp0 = ps[0]!.hp,
      hp2 = ps[2]!.hp;
    S.teams[0].crests.splash = 1;
    doFlick(3);
    expect(ps[0]!.hp).toBe(hp0 - BLEACH.flick);
    expect(ps[1]!.state).toBe('gone');
    expect(ps[2]!.hp).toBe(hp2);
    expect(S.teams[0].crests.splash).toBe(0);
    S.cells[idx(1, 6)] = { ...emptyCell(), owner: 1 };
    S.cells[idx(2, 6)] = { ...emptyCell(), owner: 1, layer: 1 };
    const sc = bleachScore();
    const own = S.cells.filter((c) => c.owner === 1 && !c.home).length;
    expect(sc.cells).toBe(own);
    expect(sc.layers).toBe(1);
    expect(sc.washed).toBe(1);
    expect(sc.total).toBe((own + 1) * BLEACH.points.cell + BLEACH.points.pale + 3 * BLEACH.points.heart);
  });

  it('Aufgeben beendet den Lauf, Flick und Aufgeben gibt es nur in Bleach', () => {
    fresh();
    const u = S.teams[0].units[0]!;
    const p = placements(u)[0]!;
    perform({ k: 'open', id: u.id, o: p.o, at: p.at });
    expect(() => perform({ k: 'flick', row: 2 })).toThrow();
    perform({ k: 'giveup' });
    expect(S.over).toBe(true);
    expect(S.winReason).toBe('given up');
  });

  it('gleicher Seed, gleiche Entscheidungen: gleiche Würfe (gleiches Glück für alle)', () => {
    const runOnce = () => {
      fresh(21);
      const u = S.teams[0].units[0]!;
      const p = placements(u)[0]!;
      perform({ k: 'open', id: u.id, o: p.o, at: p.at });
      perform({ k: 'roll', ids: S.teams[0].units.filter((x) => x.state === 'bag' && !x.used).slice(0, 3).map((x) => x.id) });
      return JSON.stringify(S.lastRoll);
    };
    expect(runOnce()).toBe(runOnce());
  });
});

describe('Bleach: Server', () => {
  it('erst nach dem Lern-Duell, ein Wertungslauf am Tag, Punkte und Rang, Belohnung', async () => {
    const d = setup();
    expect(await code(bleachStart(d, USER, 'painter'))).toBe('bad_request');
    await unlock(d);
    const before = await loadDice(d, USER);
    const res = await playOut(d);
    expect(res.state!.over).toBe(true);
    expect(res.bleach!.ranked).toBe(true);
    expect(res.bleach!.points).toBeGreaterThan(0);
    expect(res.bleach!.rank).toBe(1);
    expect(res.reward!.pigment).toBe(BLEACH.reward.pigment);
    const after = await loadDice(d, USER);
    expect(after.pigment).toBe(before.pigment + BLEACH.reward.pigment);
    const colour = (await bleachDay(d, '2026-11-02')).colour;
    expect(after.drops?.[colour]).toBe(BLEACH.reward.drops);
    // Noch einmal am selben Tag: nein
    expect(await code(bleachStart(d, USER, 'painter'))).toBe('bad_request');
    const info = await bleachGet(d, USER, 'painter');
    expect(info.played!.points).toBe(res.bleach!.points);
    expect(info.played!.rank).toBe(1);
    expect(info.top[0]!.points).toBe(res.bleach!.points);
    expect(info.running).toBe(false);
  });

  it('alle bekommen am selben Tag dasselbe Blatt, ein laufender Lauf geht weiter', async () => {
    const d = setup(5);
    await unlock(d, 'a');
    await unlock(d, 'b');
    const a = await bleachStart(d, 'a', 'A');
    const b = await bleachStart(d, 'b', 'B');
    const ids = (r: typeof a) => r.state!.teams.map((t) => t.units.map((u) => u.m.seed));
    expect(ids(a)).toEqual(ids(b));
    expect(a.state!.bleach!.waves).toEqual(b.state!.bleach!.waves);
    // Weiterspielen statt neu
    const again = await bleachStart(d, 'a', 'A');
    expect(again.events).toHaveLength(0);
    expect(ids(again)).toEqual(ids(a));
    expect((await bleachGet(d, 'a', 'A')).running).toBe(true);
  });

  it('Rangliste: mehr Punkte vorn, bei Gleichstand wer früher fertig war', async () => {
    const d = setup(9);
    for (const u of ['x', 'y']) await unlock(d, u);
    await playOut(d, 'x');
    d.now += 60_000;
    const y = await playOut(d, 'y');
    const info = await bleachGet(d, 'x', 'X');
    expect(info.players).toBe(2);
    expect(info.top).toHaveLength(2);
    expect(info.top[0]!.points).toBeGreaterThanOrEqual(info.top[1]!.points);
    expect(y.bleach!.rank).toBeGreaterThanOrEqual(1);
  });

  it('Pales aus dem Archiv, sonst aus dem Seed. Ein Test-Blatt gibt es nur für Mods im Playtest und es zählt nicht', async () => {
    const d = setup(13);
    const day = await bleachDay(d, '2026-11-02');
    expect(day.pales).toHaveLength(PALES);
    expect(day.deck).toHaveLength(9);
    expect(await code(bleachStart(d, USER, 'someone', true))).toBe('forbidden');
  });

  it('nach Mitternacht gibt es ein neues Blatt', async () => {
    const d = setup(17);
    await unlock(d);
    await playOut(d);
    const next = { ...d, now: NOW + 86_400_000 };
    expect(await code(bleachStart(next, USER, 'painter'))).toBe('ok');
  });
});

describe('Bleach: Tagespost und Teilen', () => {
  it('Blatt-Code: 48 Zeichen, Palette, Farbe, Lasur und Schlamm, Quadrate in der Spielfarbe', () => {
    expect([SHEET_COLS, SHEET_ROWS]).toEqual([COLS, ROWS]);
    fresh();
    const home = S.teams[0].home;
    S.cells[idx(0, 7)] = { ...emptyCell(), owner: 1, hue: 'karmin', layer: 1 };
    S.cells[idx(1, 7)] = { ...emptyCell(), owner: 3 };
    const code = sheetCode();
    expect(isSheet(code)).toBe(true);
    expect(code[home]).toBe('@');
    expect(readCell(code[idx(0, 7)]!)).toEqual({ kind: 'paint', pig: 2, glazed: true });
    expect(readCell(code[idx(1, 7)]!).kind).toBe('mud');
    const rows = emojiRows(code, 'carmine');
    expect(rows).toHaveLength(ROWS);
    expect(rows[7]!.startsWith('🟥🟫')).toBe(true);
    expect(rows[7]).toContain('🎨');
    expect(['ultramarine', 'carmine', 'cadmium', 'lemon', 'sap', 'violet', 'sepia', 'paynes'].map((c) => squareOf(c as Parameters<typeof squareOf>[0]))).toEqual(['🟦', '🟥', '🟧', '🟨', '🟩', '🟪', '🟫', '⬛']);
    // Sepia als Spielfarbe: Schlamm wird dann schwarz, damit man ihn unterscheiden kann
    expect(emojiRows(code, 'sepia')[7]!.startsWith('🟫⬛')).toBe(true);
    const t = shareText({ day: '2026-11-02', points: 212, ranked: true, rank: 3, players: 17, hearts: 2, heartsMax: 3, washed: 8, boss: 1, pales: 14, sheet: code, col: 'carmine' });
    expect(t).toContain('Today’s sheet · Nov 2');
    expect(t).toContain('**212 points** · #3 of 17 · ❤️❤️🤍');
    expect(t).toContain('9 of 14 Pales washed out, the great one too');
    expect(t.split('\n').filter((l) => l.endsWith('  ')).length).toBeGreaterThanOrEqual(ROWS - 1);
  });

  it('Tagespost einmal am Tag (Scheduler), das Mod-Menü legt einen neuen an, der Post kennt seinen Tag', async () => {
    const d = setup(21);
    const reddit = d.reddit as FakeReddit;
    const a = await ensureSheetPost(d);
    const b = await ensureSheetPost(d);
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.id).toBe(a.id);
    expect(reddit.posts).toHaveLength(1);
    expect(reddit.posts[0]!.entry).toBe('sheet');
    expect(reddit.posts[0]!.postData).toEqual({ kind: 'sheet', day: '2026-11-02' });
    expect(reddit.posts[0]!.title).toContain('Nov 2');
    const c = await ensureSheetPost(d, undefined, true);
    expect(c.id).not.toBe(a.id);
    // Am nächsten Tag zeigt der alte Post die fertige Rangliste seines Tages
    const later = { ...d, now: NOW + 86_400_000 };
    const old = await sheetGet(later, undefined, a.id);
    expect(old.day).toBe('2026-11-02');
    expect(old.today).toBe(false);
    expect((await sheetGet(later, undefined, 't3_unknown')).day).toBe('2026-11-03');
  });

  it('Rangliste im Post mit Blättern, dein Platz, Teilen als Kommentar im Namen des Spielers, einmal am Tag', async () => {
    const d = setup(23);
    const reddit = d.reddit as FakeReddit;
    await unlock(d);
    expect(await code(bleachShare(d, USER, 'painter'))).toBe('bad_request');
    const end = await playOut(d);
    expect(isSheet(end.bleach!.sheet)).toBe(true);
    expect(end.bleach!.col).toBeTruthy();
    const post = await ensureSheetPost(d);
    const view = await sheetGet(d, USER, post.id);
    expect(view.today).toBe(true);
    expect(view.players).toBe(1);
    expect(view.top[0]!.me).toBe(true);
    expect(isSheet(view.top[0]!.sheet)).toBe(true);
    expect(view.me!.rank).toBe(1);
    expect(view.waves).toEqual(BLEACH.waves);
    const out = await bleachShare(d, USER, 'painter');
    expect(out.postId).toBe(post.id);
    // Die App hat einen angehefteten Kommentar im Tagespost, das Blatt kommt als Antwort darauf im Namen des Spielers
    const thread = reddit.appComments.find((c) => c.id === post.id)!;
    expect(thread.sticky).toBe(true);
    expect(thread.runAs).toBeUndefined();
    expect(reddit.appComments).toHaveLength(2);
    const reply = reddit.appComments[1]!;
    expect(reply.runAs).toBe('USER');
    expect(reply.id).toBe(thread.cid);
    expect(reply.text).toContain(`**${end.bleach!.points} points** · #1 of 1`);
    expect(await code(bleachShare(d, USER, 'painter'))).toBe('bad_request');
    expect((await bleachGet(d, USER, 'painter')).played!.shared).toBe(true);
  });

  it('Teilen legt den Tagespost an, falls der Scheduler noch nicht lief. Testblatt teilen nur Mods im Playtest', async () => {
    const d = setup(25);
    const reddit = d.reddit as FakeReddit;
    reddit.mods.push('modder');
    await unlock(d);
    await playOut(d);
    await bleachShare(d, USER, 'painter');
    expect(reddit.posts.filter((p) => p.entry === 'sheet')).toHaveLength(1);
    // Testblatt: anderer Lauf ohne Wertung
    await unlock(d, 't2_mod');
    const res = await playOut(d, 't2_mod', 'modder', true);
    expect(res.bleach!.ranked).toBe(false);
    expect(await code(bleachShare(d, 't2_mod', 'someone', true))).toBe('forbidden');
    const t = await bleachShare(d, 't2_mod', 'modder', true);
    expect(t.text).toContain('Test sheet');
    expect(await code(bleachShare(d, 't2_mod', 'modder', true))).toBe('bad_request');
  });
});

describe('Bleach: Löschen und Rangliste im Post', () => {
  it('der Tagespost zeigt 6, die volle Liste bis 50. Gelöschter Tagespost oder angehefteter Kommentar wird neu angelegt', async () => {
    const d = setup(27);
    const reddit = d.reddit as FakeReddit;
    for (let k = 0; k < 8; k++) await unlock(d, `t2_p${k}`);
    for (let k = 0; k < 8; k++) await playOut({ ...d, now: d.now + k * 1000 }, `t2_p${k}`, `p${k}`);
    const post = await ensureSheetPost(d);
    expect((await sheetGet(d, 't2_p7', post.id)).top).toHaveLength(6);
    expect((await sheetGet(d, 't2_p7', post.id)).me).toBeTruthy();
    expect((await sheetGet(d, 't2_p7', post.id, 50)).top).toHaveLength(8);
    // Ein Mod löscht den angehefteten Kommentar: beim nächsten Teilen kommt ein neuer
    const thread = reddit.appComments.find((c) => c.id === post.id)!;
    expect(await commentGone(d, thread.cid, post.id)).toEqual(['share thread']);
    await bleachShare(d, 't2_p0', 'p0');
    const threads = reddit.appComments.filter((c) => c.id === post.id);
    expect(threads).toHaveLength(2);
    expect(reddit.appComments.at(-1)!.id).toBe(threads[1]!.cid);
    // Der Tagespost wird gelöscht: die Zuordnung Post → Tag bleibt, der nächste Post wird angelegt
    expect(await postGone(d, post.id)).toEqual(['sheet']);
    expect(await d.redis.get(K.bleachPost('2026-11-02'))).toBeUndefined();
    expect((await sheetGet(d, undefined, post.id)).day).toBe('2026-11-02');
    const again = await ensureSheetPost(d);
    expect(again.created).toBe(true);
    expect(again.id).not.toBe(post.id);
  });
});
