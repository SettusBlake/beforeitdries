/* Mehr Wumms im Duell (docs/entwuerfe/wumms-vorschlag.md): Vorschau „WASH OUT“ beim Zielen */
import { describe, expect, it } from 'vitest';
import { baseDamage, cheb, newGame, randomBag, S, splashLethal, teamOf } from '../src/shared/duel/rules';
import { RNG } from '../src/shared/rng';

describe('Wumms', () => {
  it('splashLethal: reicht ein normaler Treffer, mit Guard halbiert', () => {
    const r = RNG(42);
    newGame(42, 'master', randomBag(r, 'Y'), randomBag(r, 'R'), 42);
    const u = S.teams[0].units.find((x) => x.m.bp !== 'doppelkopf' && x.m.bp !== 'vierbeiner' && x.m.bp !== 'krabbe')!;
    const t = S.teams[1].units[0]!;
    const dmg = baseDamage(u, t, u.m.main, cheb(u.x, u.y, t.x, t.y) <= 1);
    teamOf(t).crests.guard = 0;
    t.hp = dmg;
    expect(splashLethal(u, t, u.m.main)).toBe(true);
    t.hp = dmg + 1;
    expect(splashLethal(u, t, u.m.main)).toBe(false);
    // Ein Guard halbiert den Treffer
    teamOf(t).crests.guard = 1;
    t.hp = dmg;
    expect(splashLethal(u, t, u.m.main)).toBe(dmg <= Math.ceil(dmg / 2));
  });
});
