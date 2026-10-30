/* Generation 2b: Aussehen aus dem Seed (eigener Zufall), nur Aussehen */
import { describe, expect, it } from 'vitest';
import { PIGMENTS } from '../src/shared/data';
import { lookOf, tinted } from '../src/shared/look';
import { humidityFor, makeMonster } from '../src/shared/monster';

const mons = Array.from({ length: 2000 }, (_, i) => makeMonster(`look-${i}`, i % 12, humidityFor(`look-${i}`)));

describe('Generation 2b', () => {
  it('gleicher Seed, gleiches Aussehen', () => {
    for (const m of mons.slice(0, 50)) expect(JSON.stringify(lookOf(m))).toBe(JSON.stringify(lookOf(m)));
  });
  it('Anteile wie im Plan: etwa 40 % Muster, meist 2 Augen, 30 % Brauen', () => {
    const ls = mons.map((m) => lookOf(m));
    const share = (f: (l: (typeof ls)[number]) => boolean) => ls.filter(f).length / ls.length;
    expect(share((l) => !!l.pattern)).toBeGreaterThan(0.35);
    expect(share((l) => !!l.pattern)).toBeLessThan(0.45);
    expect(share((l) => l.eyes.n === 2)).toBeGreaterThan(0.55);
    expect(share((l) => !!l.brows)).toBeGreaterThan(0.25);
    expect(share((l) => !!l.brows)).toBeLessThan(0.35);
    for (const l of ls) {
      expect(Math.abs(l.main.hue)).toBeLessThanOrEqual(12);
      expect(l.eyes.n).toBeGreaterThanOrEqual(1);
      expect(l.eyes.n).toBeLessThanOrEqual(7);
    }
  });
  it('Dinge bekommen auch Bänder und Karo, Tiere nicht', () => {
    const kinds = (thing: boolean) => new Set(mons.map((m) => lookOf(m, thing).pattern?.k).filter(Boolean));
    expect(kinds(true).has('check')).toBe(true);
    expect(kinds(false).has('check')).toBe(false);
    expect(kinds(false).has('bands')).toBe(false);
  });
  it('Farbton bleibt nah am Pigment, ohne Verschiebung genau das Pigment', () => {
    for (const p of PIGMENTS) {
      const same = tinted(p.rgb, { hue: 0, light: 1, sat: 1 });
      same.forEach((v, i) => expect(Math.abs(v - p.rgb[i]!)).toBeLessThanOrEqual(1));
      const far = tinted(p.rgb, { hue: 12, light: 1.15, sat: 1.15 });
      const d = Math.hypot(...far.map((v, i) => v - p.rgb[i]!));
      expect(d).toBeLessThan(90);
    }
  });
});
