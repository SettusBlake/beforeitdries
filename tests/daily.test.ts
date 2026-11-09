/* Tägliche Aktivität (T1 Beitreten, T2 Strähne mit Retarder, Lohn und Flair) */
import { describe, expect, it } from 'vitest';
import type { Deps } from '../src/server/core';
import { bleachAct, bleachGet, bleachStart, sheetGet } from '../src/server/bleach';
import { askJoin, joinSub, streakFlairSweep, streakFlairToggle } from '../src/server/daily';
import { loadDice, saveDice } from '../src/server/dice';
import { BLEACH } from '../src/shared/duel/bleach';
import { emptyDice } from '../src/shared/dice';
import { shareText } from '../src/shared/sheet';
import { streakNow, streakPaint, streakReward, streakSepia } from '../src/shared/streak';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';

const USER = 't2_painter';
const NAME = 'painter';
const DAY = 86400000;
/** Mittwoch, 4.11.2026 (die Woche beginnt am Montag, 2.11.) */
const WED = Date.parse('2026-11-04T10:00:00Z');

function world(seed = 5) {
  const redis = new FakeRedis();
  const reddit = new FakeReddit();
  const r = RNG(seed);
  const at = (now: number): Deps => ({ redis, reddit, now, rand: () => (r() * 4294967296) >>> 0, subredditName: 'beforeitdries', appSlug: 'beforeitdries', appVersion: '0.0.1.99' });
  return { redis, reddit, at };
}
async function unlock(d: Deps): Promise<void> {
  const s = await loadDice(d, USER);
  s.tutorialPaid = true;
  await saveDice(d, USER, s);
}
/** Ein Wertungslauf am Tag von d: starten und gleich trocknen lassen */
async function paint(d: Deps) {
  await bleachStart(d, USER, NAME);
  return bleachAct(d, USER, { k: 'giveup' }, NAME);
}

describe('Strähne (Regeln)', () => {
  it('zählt Tage in Folge, der Retarder verzeiht einen Tag je Woche', () => {
    let s = streakPaint(undefined, '2026-11-02').s;
    expect(s.n).toBe(1);
    s = streakPaint(s, '2026-11-03').s;
    expect(s.n).toBe(2);
    // 4.11. verpasst: der Retarder hält
    const a = streakPaint(s, '2026-11-05');
    expect(a.held).toBe(true);
    expect(a.s.n).toBe(3);
    // 6.11. verpasst, gleiche Woche: getrocknet
    const b = streakPaint(a.s, '2026-11-07');
    expect(b.held).toBe(false);
    expect(b.s.n).toBe(1);
    expect(b.broke).toBe(3);
    expect(b.s.best).toBe(3);
    // In der nächsten Woche gibt es wieder einen
    let c = streakPaint(b.s, '2026-11-09').s;
    c = streakPaint(c, '2026-11-11').s;
    expect(c.n).toBe(2);
    // Zwei Tage verpasst: getrocknet
    expect(streakPaint(c, '2026-11-14').s.n).toBe(1);
  });
  it('zeigt den Stand, ohne etwas zu ändern', () => {
    const s = { n: 4, last: '2026-11-03', best: 4 };
    expect(streakNow(s, '2026-11-03').state).toBe('done');
    expect(streakNow(s, '2026-11-04').state).toBe('open');
    expect(streakNow(s, '2026-11-05')).toEqual({ n: 4, state: 'held', best: 4 });
    expect(streakNow({ ...s, held: 'w' + Math.floor((Math.floor(Date.parse('2026-11-04') / DAY) + 3) / 7) }, '2026-11-05').state).toBe('dry');
    expect(streakNow(s, '2026-11-06')).toEqual({ n: 0, state: 'dry', best: 4 });
    expect(streakNow(undefined, '2026-11-06').state).toBe('none');
  });
  it('Lohn: ab 2 Tagen +5 je Tag bis +50, alle 7 Tage ein Tropfen', () => {
    expect(streakReward(1)).toEqual({ pigment: 0, drop: false });
    expect(streakReward(2)).toEqual({ pigment: 10, drop: false });
    expect(streakReward(7)).toEqual({ pigment: 35, drop: true });
    expect(streakReward(10).pigment).toBe(50);
    expect(streakReward(14)).toEqual({ pigment: 50, drop: true });
    expect(streakSepia({ n: 3, best: 3, pigment: 15, drop: false, held: false, broke: 0 })).toContain('Three days');
    expect(streakSepia({ n: 2, best: 2, pigment: 10, drop: false, held: false, broke: 0 })).toBeNull();
  });
  it('steht im geteilten Kommentar ab 2 Tagen', () => {
    const base = { day: '2026-11-04', points: 120, ranked: true, hearts: 3, heartsMax: 3, washed: 5, boss: 0, pales: 14, sheet: '' };
    expect(shareText({ ...base, streak: 5 })).toContain('🖌 5 days in a row');
    expect(shareText({ ...base, streak: 1 })).not.toContain('in a row');
  });
});

describe('Strähne am Server', () => {
  it('zählt Wertungsläufe, zahlt den Lohn und zeigt den Stand', async () => {
    const w = world();
    await unlock(w.at(WED));
    const pig: number[] = [];
    for (let i = 0; i < 3; i++) {
      const d = w.at(WED + i * DAY);
      const before = (await loadDice(d, USER)).pigment;
      const out = await paint(d);
      expect(out.bleach?.streak?.n).toBe(i + 1);
      // Ohne das Pigment neuer Malerränge (H2, eigener Test)
      const ranks = (out.reward?.rank ?? []).reduce((a, u) => a + u.pigment, 0);
      pig.push((await loadDice(d, USER)).pigment - before - ranks);
    }
    expect(pig).toEqual([BLEACH.reward.pigment, BLEACH.reward.pigment + 10, BLEACH.reward.pigment + 15]);
    const info = await bleachGet(w.at(WED + 3 * DAY), USER, NAME);
    expect(info.streak).toEqual({ n: 3, state: 'open', best: 3 });
    // Im Tagespost steht sie neben deinem Platz
    const sheet = await sheetGet(w.at(WED + 2 * DAY), USER, undefined);
    expect(sheet.me?.streak).toBe(3);
    expect((await loadDice(w.at(WED), USER)).sheets).toBe(3);
  });
  it('Retarder hält einen verpassten Tag, ein Testlauf zählt nicht', async () => {
    const w = world();
    await unlock(w.at(WED));
    await paint(w.at(WED));
    await paint(w.at(WED + DAY));
    // Freitag verpasst, Samstag gemalt: der Retarder dieser Woche hält
    const out = await paint(w.at(WED + 3 * DAY));
    expect(out.bleach?.streak).toMatchObject({ n: 3, held: true });
    // Testlauf (Playtest, Mod): keine Strähne
    w.reddit.mods = ['painter'];
    const t = await bleachStart(w.at(WED + 3 * DAY), USER, NAME, true);
    expect(t.state).toBeTruthy();
    const td = await bleachAct(w.at(WED + 3 * DAY), USER, { k: 'giveup' }, NAME);
    expect(td.bleach?.streak).toBeUndefined();
    expect((await loadDice(w.at(WED), USER)).streak?.n).toBe(3);
  });
  it('alle 7 Tage ein Tropfen mehr', async () => {
    const w = world();
    await unlock(w.at(WED));
    let out = await paint(w.at(WED));
    for (let i = 1; i < 7; i++) out = await paint(w.at(WED + i * DAY));
    expect(out.bleach?.streak).toMatchObject({ n: 7, drop: true, pigment: 35 });
    expect(out.reward?.drops?.length).toBe(BLEACH.reward.drops + 1);
  });
});

describe('Beitreten (T1)', () => {
  it('fragt beim ersten und fünften Ergebnis, nie nach dem Tipp', () => {
    const d = { subredditName: 'beforeitdries' };
    const s = emptyDice();
    expect(askJoin(d, s)).toBeUndefined();
    s.duels = 1;
    expect(askJoin(d, s)).toBe('beforeitdries');
    s.duels = 2;
    expect(askJoin(d, s)).toBeUndefined();
    s.sheets = 3;
    expect(askJoin(d, s)).toBe('beforeitdries');
    s.duels = 40;
    expect(askJoin(d, s)).toBeUndefined();
    const t = { ...emptyDice(), duels: 1, joined: true as const };
    expect(askJoin(d, t)).toBeUndefined();
  });
  it('nach dem ersten Tagesblatt im Ergebnis, Tipp tritt bei und merkt es sich', async () => {
    const w = world();
    await unlock(w.at(WED));
    const out = await paint(w.at(WED));
    expect(out.reward?.join).toBe('beforeitdries');
    const r = await joinSub(w.at(WED), USER);
    expect(r.sub).toBe('beforeitdries');
    expect(w.reddit.subscribed).toBe(1);
    expect((await loadDice(w.at(WED), USER)).joined).toBe(true);
    for (let i = 1; i < 5; i++) expect((await paint(w.at(WED + i * DAY))).reward?.join).toBeUndefined();
  });
});

describe('Strähne als Flair (T2)', () => {
  it('nur mit Schalter, die vorige Flair kommt zurück', async () => {
    const w = world();
    await unlock(w.at(WED));
    w.reddit.userFlairs.set(NAME, 'Wet on wet');
    await paint(w.at(WED));
    expect(w.reddit.userFlairs.get(NAME)).toBe('Wet on wet');
    await streakFlairToggle(w.at(WED), USER, NAME, true);
    expect(w.reddit.userFlairs.get(NAME)).toBe('🖌 1 day');
    await paint(w.at(WED + DAY));
    expect(w.reddit.userFlairs.get(NAME)).toBe('🖌 2 days');
    await streakFlairToggle(w.at(WED + DAY), USER, NAME, false);
    expect(w.reddit.userFlairs.get(NAME)).toBe('Wet on wet');
    expect((await loadDice(w.at(WED), USER)).streakFlair).toBeUndefined();
  });
  it('eine getrocknete Strähne nimmt die Flair beim täglichen Auftrag ab', async () => {
    const w = world();
    await unlock(w.at(WED));
    await streakFlairToggle(w.at(WED), USER, NAME, true);
    await paint(w.at(WED));
    expect(w.reddit.userFlairs.get(NAME)).toBe('🖌 1 day');
    // Donnerstag verpasst: Freitag hält der Retarder noch
    expect(await streakFlairSweep(w.at(WED + 2 * DAY))).toBe(0);
    expect(w.reddit.userFlairs.get(NAME)).toBe('🖌 1 day');
    // Samstag: getrocknet
    expect(await streakFlairSweep(w.at(WED + 3 * DAY))).toBe(1);
    expect(w.reddit.userFlairs.has(NAME)).toBe(false);
    // Neu gemalt: die Flair kommt wieder
    await paint(w.at(WED + 3 * DAY));
    expect(w.reddit.userFlairs.get(NAME)).toBe('🖌 1 day');
  });
});
