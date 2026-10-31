/* Mehr Wumms im Duell (docs/entwuerfe/wumms-vorschlag.md): Vorschau „WASH OUT“ beim Zielen */
import { describe, expect, it } from 'vitest';
import { aiMedium, aiOpening, aiTurnSteps, baseDamage, checkWipe, cheb, drain, endRound, makeOffer, newGame, offerRound, randomBag, S, splashLethal, takeMedium, teamOf, TUNE, type Ev, type Side } from '../src/shared/duel/rules';
import { MEDIA, MEDIA_MAX, START_MEDIA } from '../src/shared/duel/media';
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

  it('S1 kein Verpuffen und S2 Nachsetzen: kein Fehlwurf mehr, Streifschüsse machen Schaden, wer auswäscht, handelt noch einmal', () => {
    expect(TUNE.graze && TUNE.again).toBe(true);
    const seen: Record<string, number> = {};
    let againOk = 0;
    for (let g = 0; g < 8; g++) {
      S.headless = false;
      const seed = 9000 + g * 131;
      const r = RNG(seed);
      newGame(seed, 'master', randomBag(r, 'Y'), randomBag(r, 'R'), seed);
      aiOpening(2, 'master');
      aiOpening(1, 'master');
      for (const side of [1, 2] as Side[]) {
        const o = (S.teams[side - 1]!.media?.length ?? 0) < MEDIA_MAX ? makeOffer(side, side === 1 ? START_MEDIA : MEDIA.map((m) => m.id)) : [];
        if (o.length) takeMedium(side, aiMedium(o));
      }
      drain();
      for (let guard = 0; guard < 40 && !S.over; guard++) {
        for (const side of [1, 2] as Side[]) {
          const step = aiTurnSteps(side, 0);
          while (step()) {
            for (const e of drain() as Ev[]) {
              if (e.k === 'shot' && e.text !== 'palette') {
                seen[e.res] = (seen[e.res] ?? 0) + 1;
                if (e.res === 'graze') expect(e.dmg).toBeGreaterThan(0);
              }
              if (e.k === 'again') {
                seen.again = (seen.again ?? 0) + 1;
                const u = [...S.teams[0].units, ...S.teams[1].units].find((x) => x.id === e.id)!;
                // Darf noch einmal, aber nur einmal pro Zug
                if (u.again && (!u.acted || S.over)) againOk++;
              }
            }
          }
          if (S.over || checkWipe()) break;
        }
        if (S.over) break;
        offerRound(S.round);
        endRound();
        drain();
      }
    }
    S.headless = false;
    expect(seen.miss ?? 0).toBe(0);
    expect(seen.graze ?? 0).toBeGreaterThan(0);
    expect(seen.again ?? 0).toBeGreaterThan(0);
    expect(againOk).toBeGreaterThan(0);
  });
});
