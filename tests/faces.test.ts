/* Würfelseiten (festgelegt am 30.10.2026): Seltenheit erhöht die Chance auf doppelte, dreifache und Mischseiten, Mischseite zählt für beide */
import { describe, expect, it } from 'vitest';
import { RARITIES } from '../src/shared/dice';
import { comboOf, dieUnit, faceKey, faceText, FACE_ODDS, isCrestFace, type Face } from '../src/shared/duel/rules';
import { humidityFor, makeMonster } from '../src/shared/monster';

function dice(paper: string, n: number) {
  const out = [];
  for (let k = 0; out.length < n; k++) {
    const sheet = 'F' + k;
    const m = makeMonster(sheet, k % 12, humidityFor(sheet));
    if (m.paper !== paper) continue;
    m.gen = 2;
    out.push(dieUnit(m));
  }
  return out;
}

describe('Würfelseiten', () => {
  it('Chancen steigen mit der Seltenheit, Joker ab Rare und Gold bei Legendary stehen fest', () => {
    const ups = RARITIES.slice(0, 4).map((r) => {
      const us = dice(r.paper!, 400);
      for (const u of us) {
        expect(u.faces.filter((f) => f.k === 'joker').length).toBe(r.k === 'rare' || r.k === 'epic' ? 1 : 0);
        expect(u.faces).toHaveLength(6);
      }
      const faces = us.flatMap((u) => u.faces).filter(isCrestFace);
      return { mix: faces.filter((f) => f.k2).length / us.length, x3: faces.filter((f) => f.n === 3).length / us.length };
    });
    expect(FACE_ODDS.common.mix).toBe(0);
    expect(ups[0]).toEqual({ mix: 0, x3: 0 });
    expect(ups[2]!.x3).toBeGreaterThan(0.05);
    expect(ups[3]!.x3).toBeGreaterThan(ups[2]!.x3);
    expect(ups[3]!.mix).toBeGreaterThan(ups[1]!.mix);
  });

  it('gleicher Klecks, gleiche Seiten', () => {
    const m = makeMonster('SAME', 3, humidityFor('SAME'));
    expect(dieUnit(m).faces).toEqual(dieUnit(m).faces);
  });

  it('Mischseite zählt für ein Paar als jedes ihrer Symbole, Regenbogen nur ohne Sterne', () => {
    const mix: Face = { k: 'splash', n: 1, k2: 'guard' };
    expect(comboOf([mix, { k: 'guard', n: 1 }])?.sym).toBe('guard');
    expect(comboOf([mix, { k: 'splash', n: 1 }])?.sym).toBe('splash');
    expect(comboOf([mix, { k: 'step', n: 1 }, { k: 'glow', n: 1 }])?.kind).toBe('rainbow');
    expect(comboOf([mix, { k: 'step', n: 1 }, { k: 'star', n: 1 }])).toBeNull();
    expect(faceText(mix)).toBe('Splash + Guard');
    expect(faceText({ k: 'step', n: 3 })).toBe('Step ×3');
    expect(faceKey(mix)).not.toBe(faceKey({ k: 'splash', n: 1 }));
  });
});
