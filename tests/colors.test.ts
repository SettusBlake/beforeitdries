/* Spielfarben (docs/entwuerfe/uebersicht-vorschlag.md): Wahl, Ausweichfarbe, Farben im Duell und in der Galerie */
import { describe, expect, it } from 'vitest';
import { GameError, type Deps } from '../src/server/core';
import { diceColor, loadDice } from '../src/server/dice';
import { duelStart } from '../src/server/duel';
import { galleryFind, hangDeck } from '../src/server/gallery';
import { COLOR_RIVAL, duelColors, TEAM_COLORS, tooSimilar } from '../src/shared/colors';
import { RNG } from '../src/shared/rng';
import { FakeRedis } from '../tools/fake-redis';
import { FakeReddit } from '../tools/fake-reddit';
import { bagForDuel } from '../src/server/dice';

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

describe('Spielfarben', () => {
  it('16 Farben, Ausweichfarbe bei ähnlicher Gegnerfarbe, sonst die nächste freie', () => {
    expect(TEAM_COLORS).toHaveLength(16);
    expect(duelColors(undefined, undefined, COLOR_RIVAL)).toEqual(['ultramarine', 'carmine']);
    expect(duelColors('carmine', 'viridian', 'carmine')).toEqual(['viridian', 'carmine']);
    // Beide eigenen Farben zu nah am Gegner: die erste freie aus der Liste
    expect(tooSimilar('sienna', 'carmine')).toBe(true);
    expect(tooSimilar('magenta', 'carmine')).toBe(true);
    expect(duelColors('sienna', 'magenta', 'carmine')).toEqual(['ultramarine', 'carmine']);
    for (const c of TEAM_COLORS) {
      const [mine, foe] = duelColors(c.k, 'viridian', 'carmine');
      expect(tooSimilar(mine, foe)).toBe(false);
    }
  });

  it('Wahl wird gespeichert, ungültige oder gleiche Farben werden abgelehnt, das Duell nimmt sie', async () => {
    const d = setup();
    expect(await code(diceColor(d, A, 'gold', 'viridian'))).toBe('bad_request');
    expect(await code(diceColor(d, A, 'rose', 'rose'))).toBe('bad_request');
    expect((await diceColor(d, A, 'rose', 'cerulean')).dice.color).toBe('rose');
    expect((await loadDice(d, A)).color2).toBe('cerulean');
    expect((await duelStart(d, A, 'apprentice')).state?.colors).toEqual(['rose', 'carmine']);
    await diceColor(d, A, 'carmine', 'cerulean');
    expect((await duelStart(d, A, 'apprentice')).state?.colors).toEqual(['cerulean', 'carmine']);
    // Lern-Duell: Standardfarben gegen Carmine bleiben möglich
    expect((await duelStart(d, B, 'apprentice', true)).state?.colors).toEqual(['ultramarine', 'carmine']);
  });

  it('Galerie: der Besitzer malt in seiner Farbe, du weichst aus, wenn sie zu ähnlich ist', async () => {
    const d = setup(5);
    await bagForDuel(d, A);
    await diceColor(d, A, 'violet', 'sap');
    await hangDeck(d, A, 'inkwell', await loadDice(d, A));
    const f = await galleryFind(d, B, 'b');
    expect(f.foe?.color).toBe('violet');
    // Ultramarine (Standard) ist Violett zu ähnlich: Ausweichfarbe Viridian
    expect((await duelStart(d, B, 'apprentice', false, true)).state?.colors).toEqual(['viridian', 'violet']);
  });
});
