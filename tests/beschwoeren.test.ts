/* Öfter beschwören (docs/entwuerfe/beschwoeren-vorschlag.md): überstehende Netze und der Grund am Würfel */
import { afterEach, describe, expect, it } from 'vitest';
import { aiOpening, COLS, doSummon, drain, NET_MIN, netAt, netPlace, newGame, ON_SHEET, placements, randomBag, S, summonable, summonWhy, TUNE, type Ev, type Rolled, type Unit } from '../src/shared/duel/rules';
import { RNG } from '../src/shared/rng';

/** Spiel mit beiden Eröffnungen, danach liegt fremde Farbe überall außer am eigenen Gebiet */
function crowded(seed: number): Unit {
  S.headless = false;
  const r = RNG(seed);
  newGame(seed, 'master', randomBag(r, 'Y'), randomBag(r, 'R'), seed);
  aiOpening(1, 'master');
  aiOpening(2, 'master');
  drain();
  const rival = S.cells.find((c) => c.owner === 2 && !c.home)!;
  const near = (i: number) => {
    const x = i % COLS,
      y = Math.floor(i / COLS);
    return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([a, b]) => a! >= 0 && a! < COLS && b! >= 0 && S.cells[b! * COLS + a!]?.owner === 1);
  };
  S.cells.forEach((c, i) => {
    if (c.owner === 0 && !c.home && !near(i)) S.cells[i] = { ...rival };
  });
  return S.teams[0].units.find((u) => u.state === 'bag')!;
}

describe('Beschwören', () => {
  afterEach(() => {
    TUNE.overhang = true;
  });

  it('überstehendes Netz malt nur freie und eigene Felder, mindestens drei, die anderen Seiten tropfen ab', () => {
    const u = crowded(4242);
    const part = placements(u).filter((p) => p.over.length > 0);
    expect(part.length).toBeGreaterThan(0);
    const p = part[0]!;
    const full = netAt(u, p.o, p.at)!;
    expect(p.list.length).toBeGreaterThanOrEqual(NET_MIN);
    expect(p.list.length + p.over.length).toBe(6);
    expect(p.list).toContain(p.at);
    expect([...p.list, ...p.over].sort()).toEqual([...full].sort());
    for (const i of p.list) expect(S.cells[i]!.owner === 0 || S.cells[i]!.owner === 1).toBe(true);
    const before = p.over.map((i) => ({ ...S.cells[i]! }));
    doSummon(u, p.o, p.at);
    expect(u.state).toBe('sheet');
    expect(u.y * COLS + u.x).toBe(p.at);
    for (const i of p.list) expect(S.cells[i]!.owner).toBe(1);
    // Die überstehenden Felder bleiben, wie sie waren
    p.over.forEach((i, k) => expect(S.cells[i]).toEqual(before[k]));
    const ev = drain().find((e: Ev) => e.k === 'summon') as Extract<Ev, { k: 'summon' }>;
    expect(ev.cells.length).toBe(p.list.length);
    expect(ev.drop?.map((d) => d.i).sort()).toEqual([...p.over].sort());
  });

  it('ganze Netze kommen zuerst, ohne Schalter gibt es keine überstehenden', () => {
    const u = crowded(777);
    const all = placements(u);
    const first = all.findIndex((p) => p.over.length > 0);
    if (first >= 0) expect(all.slice(first).every((p) => p.over.length > 0)).toBe(true);
    TUNE.overhang = false;
    expect(placements(u).every((p) => p.over.length === 0)).toBe(true);
    for (const p of all.filter((q) => q.over.length)) expect(netPlace(u, p.o, p.at)).toBeNull();
  });

  it('Grund am Würfel: fehlende Sterne, Blatt voll, sonst kann er', () => {
    const u = crowded(91);
    const fi = u.faces.findIndex((f) => f.k === 'star');
    expect(fi).toBeGreaterThanOrEqual(0);
    const me: Rolled = { u, fi, face: u.faces[fi]! };
    S.starBonus = 0;
    S.freeJoker = 0;
    // Allein reicht der eigene Stern nicht: es fehlen Sterne in Höhe der Stufe
    expect(summonWhy(S.teams[0], [me], me)).toEqual({ k: 'short', n: u.lv });
    expect(summonable(S.teams[0], [me])).toEqual([]);
    // Mit genug Sternen der anderen kann er (es gibt Platz)
    S.starBonus = 3;
    expect(summonWhy(S.teams[0], [me], me)).toBeNull();
    expect(summonable(S.teams[0], [me])).toEqual([u]);
    // Drei Kleckse auf dem Blatt: voll
    const others = S.teams[0].units.filter((x) => x !== u).slice(0, ON_SHEET);
    for (const x of others) x.state = 'sheet';
    expect(summonWhy(S.teams[0], [me], me)).toEqual({ k: 'full' });
  });
});
