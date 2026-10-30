/* Sepias Auftrag pro Runde (freigegeben am 30.10.2026): ein Wurfziel je Seite, erfüllt gibt einen Joker */
import { afterEach, describe, expect, it } from 'vitest';
import { S, taskMet, taskOf, type Face, type Task } from '../src/shared/duel/rules';

const two = (c: Task['c']): Task => ({ k: 'two', c, text: '' });
const f = (k: Face['k'], n = 1, k2?: Face['k2']): Face => (k2 ? { k, n, k2 } : { k, n });

describe('Sepias Auftrag', () => {
  afterEach(() => {
    S.tutorial = 0;
  });
  it('ist je Runde und Seite fest, ohne den Würfelzufall zu berühren, und fehlt im Lern-Duell', () => {
    S.paintSeed = 12345;
    S.tutorial = 0;
    const rng = S.rng;
    expect(taskOf(1, 2)).toEqual(taskOf(1, 2));
    expect(S.rng).toBe(rng);
    const kinds = new Set<string>();
    for (let r = 1; r <= 60; r++) kinds.add(taskOf(1, r)!.k);
    expect(kinds.size).toBe(5);
    S.tutorial = 3;
    expect(taskOf(1, 2)).toBeNull();
  });
  it('zählt Doppel-, Misch- und Goldseiten, Joker zählen als alles', () => {
    expect(taskMet(two('guard'), [f('guard'), f('step')])).toBe(false);
    expect(taskMet(two('guard'), [f('guard', 2)])).toBe(true);
    expect(taskMet(two('guard'), [f('step', 1, 'guard'), f('guard')])).toBe(true);
    expect(taskMet(two('guard'), [f('guard'), f('joker')])).toBe(true);
    expect(taskMet({ k: 'double', text: '' }, [f('splash'), f('star')])).toBe(false);
    expect(taskMet({ k: 'double', text: '' }, [f('splash', 1, 'glow')])).toBe(true);
    expect(taskMet({ k: 'colours', text: '' }, [f('splash'), f('glow'), f('star')])).toBe(false);
    expect(taskMet({ k: 'colours', text: '' }, [f('gold')])).toBe(true);
    expect(taskMet({ k: 'stars', text: '' }, [f('star'), f('joker')])).toBe(true);
    expect(taskMet({ k: 'four', text: '' }, [f('step', 2), f('glow', 1, 'guard')])).toBe(true);
    expect(taskMet({ k: 'four', text: '' }, [f('step', 2), f('star', 3)])).toBe(false);
  });
});
