/* Elemente (freigegeben am 01.11.2026): Ring wie Schere-Stein-Papier, eigener Wurf aus dem Seed */
import { describe, expect, it } from 'vitest';
import { ELEMENTS, elementLine, elementMult, elementOf } from '../src/shared/elements';
import { dieUnit, find } from '../src/shared/duel/rules';

describe('Elemente', () => {
  it('jedes schlägt das nächste ×2 und das übernächste ×1,25, sonst ×1', () => {
    expect(elementMult('wash', 'vermilion')).toBe(2);
    expect(elementMult('wash', 'gilt')).toBe(1.25);
    expect(elementMult('wash', 'sap')).toBe(1);
    expect(elementMult('vermilion', 'wash')).toBe(1);
    expect(elementMult('fluoro', 'wash')).toBe(2);
    expect(elementMult('ochre', 'wash')).toBe(1.25);
    expect(elementMult('sap', 'sap')).toBe(1);
    expect(elementLine('wash', 'vermilion')).toBe('Wash puts out Vermilion');
    expect(elementLine('sap', 'wash')).toBeNull();
  });
  it('kommt fest aus dem Seed und verteilt sich gleichmäßig', () => {
    const n: Record<string, number> = {};
    for (let i = 0; i < 1200; i++) {
      const m = find('qualle', 'ultra', 'E' + i);
      expect(elementOf(m)).toBe(elementOf({ seed: m.seed }));
      expect(dieUnit(m).el).toBe(elementOf(m));
      n[elementOf(m)] = (n[elementOf(m)] ?? 0) + 1;
    }
    for (const e of ELEMENTS) expect(n[e.k]! / 1200).toBeGreaterThan(0.12);
  });
});
