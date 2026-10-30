/* Regeln müssen exakt dem Prototyp entsprechen */
import { describe, expect, it } from 'vitest';
import { BAUPLAENE, PIGMENTS } from '../src/shared/data';
import { ARCHES, form, formOf } from '../src/shared/forms';
import { applyGlaze, odds, SEPIA } from '../src/shared/glaze';
import { humidityFor, makeMonster, statRows, type Monster } from '../src/shared/monster';
import { RNG, gauss, hashStr } from '../src/shared/rng';
import { loadPrototype, plain, type Proto } from './prototype';

const SHEETS = ['2026-10-28', '2026-01-01', 'ABC-123', 'K7Q-0ZP', 'test', ...Array.from({ length: 300 }, (_, i) => `S${i * 7919}`)];

/** Prototyp-Monster in das Format der Portierung bringen (Texte → Index, Spielfelder ohne Bedeutung entfernen) */
function fromProto(P: Proto, pm: Proto): Monster {
  const { log, ...rest } = plain(pm);
  void log;
  return { ...rest, bloomTrait: P.BLOOM_TRAITS.indexOf(pm.bloomTrait), lore: P.LORE.indexOf(pm.lore) } as Monster;
}

/** Nur Zahlen vergleichen, Texte sind übersetzt */
const numbers = (row: object) => {
  const { k, base, pig, roll, paper, gl, total, cap, capped } = row as Record<string, unknown>;
  return { k, base, pig, roll, paper, gl, total, cap, capped };
};

function seq(seed: number): () => number {
  const r = RNG(seed);
  return () => r();
}

describe('Zufall', () => {
  const P = loadPrototype();
  it('hashStr und RNG', () => {
    for (const s of SHEETS) {
      expect(hashStr(s)).toBe(P.hashStr(s));
      const a = RNG(hashStr(s)),
        b = P.RNG(hashStr(s));
      for (let i = 0; i < 50; i++) expect(a()).toBe(b());
      const ga = RNG(hashStr(s)),
        gb = P.RNG(hashStr(s));
      for (let i = 0; i < 20; i++) expect(gauss(ga)).toBe(P.gauss(gb));
    }
  });
});

describe('Monster würfeln', () => {
  const P = loadPrototype();
  it('makeMonster, Luftfeuchte und Werte', () => {
    for (const s of SHEETS) {
      const hum = humidityFor(s);
      expect(hum).toBe(P.ri(P.RNG(P.hashStr('hum:' + s)), 30, 95));
      for (let i = 0; i < 12; i++) {
        const mine = makeMonster(s, i, hum);
        const theirs = fromProto(P, P.makeMonster(s, i, hum));
        expect(mine).toEqual(theirs);
        expect(statRows(mine).map(numbers)).toEqual(plain(P.statRows(P.makeMonster(s, i, hum))).map(numbers));
      }
    }
  });
  it('Baupläne bauen dieselbe Geometrie', () => {
    for (let k = 0; k < 400; k++) {
      const seed = hashStr('geo' + k);
      BAUPLAENE.forEach((bp, j) => {
        expect(bp.build(RNG(seed + j))).toEqual(plain(P.BAUPLAENE[j].build(P.RNG(seed + j))));
      });
    }
  });
});

describe('Lasieren', () => {
  it('odds für alle Pigmente', () => {
    const P = loadPrototype();
    for (const s of SHEETS.slice(0, 60)) {
      for (let i = 0; i < 12; i++) {
        const m = makeMonster(s, i, humidityFor(s));
        const pm = P.makeMonster(s, i, humidityFor(s));
        for (const p of PIGMENTS) expect({ ...odds(m, p.id), label: '' }).toEqual({ ...plain(P.odds(pm, p.id)), label: '' });
      }
    }
  });

  it('applyGlaze: gleiche Würfe ergeben gleiche Ergebnisse', () => {
    let checked = 0;
    for (const s of SHEETS.slice(0, 120)) {
      for (let i = 0; i < 12; i++) {
        const seed = hashStr(s + '#' + i);
        // Beide Seiten bekommen dieselbe Math.random-Folge
        const P = loadPrototype(seq(seed));
        const rand = seq(seed);
        const rnd = () => (rand() * 4294967296) >>> 0;
        const hum = humidityFor(s);
        const m = makeMonster(s, i, hum);
        const pm = P.makeMonster(s, i, hum);
        const pick = RNG(seed ^ 0x5bd1e995);
        for (let g = 0; g < 6; g++) {
          const pid = PIGMENTS[Math.floor(pick() * PIGMENTS.length)]!.id;
          const res = applyGlaze(m, pid, RNG(rnd()), rnd());
          const pres = P.applyGlaze(pm, pid);
          if (g >= 5) {
            expect(res).toBeNull();
            expect(pres).toBeNull();
            continue;
          }
          expect(res!.msgs.map((x) => x.c)).toEqual(plain(pres).map((x: { c: string }) => x.c));
          const sepiaIdx = P.SEPIA[res!.mood].indexOf(pm.sepia);
          expect(sepiaIdx).toBeGreaterThanOrEqual(0);
          expect(res!.sepiaIdx).toBe(sepiaIdx);
          expect(SEPIA[res!.mood].length).toBe(P.SEPIA[res!.mood].length);
          const { log, sepia, ...rest } = plain(pm);
          void log;
          void sepia;
          expect({ ...m }).toEqual({ ...rest, bloomTrait: m.bloomTrait, lore: m.lore });
          checked++;
        }
      }
    }
    expect(checked).toBe(120 * 12 * 5);
  });
});

/* Neue Formen (Generation 2): jede Vorlage baut gültige Geometrie, gleicher Zufall ergibt dieselbe Form */

describe('neue Formen', () => {
  it('jeder Bauplan hat mindestens zehn Vorlagen', () => {
    for (const b of BAUPLAENE) expect(ARCHES.filter((a) => a.bp === b.id).length).toBeGreaterThanOrEqual(10);
  });
  it('jede Vorlage liefert endliche Geometrie mit Gesicht, im Blatt und unter den Grenzen', () => {
    for (const a of ARCHES)
      for (let i = 0; i < 25; i++) {
        const g = formOf(a, RNG(i * 977 + 5));
        expect(g.blobs.length).toBeGreaterThan(0);
        expect(g.blobs.length).toBeLessThanOrEqual(28);
        expect(g.limbs.length).toBeLessThanOrEqual(60);
        expect(g.faces.length).toBeGreaterThan(0);
        for (const b of g.blobs) {
          expect([b.x, b.y, b.rx, b.ry, b.rot].every(Number.isFinite)).toBe(true);
          expect(b.x).toBeGreaterThan(-0.1);
          expect(b.x).toBeLessThan(1.1);
        }
      }
  });
  it('gleicher Zufall, gleiche Form', () => {
    expect(JSON.stringify(form('vierbeiner', RNG(42)))).toBe(JSON.stringify(form('vierbeiner', RNG(42))));
  });
});
