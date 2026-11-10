/*
 * „Leben“ (Entwurf, docs/entwuerfe/leben-vorschlag.md): größere Figur, größere und lebhaftere Gesichter mit mehr Augenformen,
 * Tuschedetails je nach Wesen (Fell, Schuppen, Federn, Schraffur, Nieten, Maserung) und Füße an den Beinen.
 * Nur Aussehen, eigener Zufallsstrom aus dem Seed: Form, Werte, Farbplan und Generation 1 bleiben, wie sie sind.
 */
import { RNG, rr, weighted } from './rng';

type RGBn = [number, number, number];
/** Neue Augenformen. keep: die Form aus dem bisherigen Wurf (round, button, almond, slit, sleepy, shiny, closed, dash) */
export type EyeStyle = 'keep' | 'big' | 'oval' | 'happy' | 'angry' | 'cat' | 'goat' | 'dots' | 'cross' | 'heart';
export type Surface = 'none' | 'fur' | 'scales' | 'feathers' | 'hatch' | 'rivets' | 'grain';
export type Life = {
  eye: EyeStyle;
  /** Ein Auge zu (nur bei zwei Augen) */
  wink: boolean;
  /** Größe des zweiten Auges gegen das erste (1: gleich) */
  uneven: number;
  lashes: boolean;
  /** Farbe der Iris, bei iris2 hat das zweite Auge eine andere */
  iris: RGBn;
  iris2: RGBn | null;
  /** Faktor auf die Größe des Gesichts */
  face: number;
  surface: Surface;
  feet: boolean;
  seed: number;
};

/** Wie groß die Figur auf dem Blatt wird (längere Seite) */
export const LIFE_FIT = 0.88;

const W = <T>(k: T, w: number) => ({ k, w });
const EYES = [W<EyeStyle>('keep', 26), W<EyeStyle>('big', 18), W<EyeStyle>('oval', 12), W<EyeStyle>('cat', 9), W<EyeStyle>('angry', 8), W<EyeStyle>('happy', 7), W<EyeStyle>('dots', 7), W<EyeStyle>('goat', 5), W<EyeStyle>('cross', 3), W<EyeStyle>('heart', 3)];
const ANIMAL = [W<Surface>('fur', 4), W<Surface>('scales', 2), W<Surface>('feathers', 2), W<Surface>('hatch', 2), W<Surface>('none', 2)];
const THING = [W<Surface>('rivets', 3), W<Surface>('grain', 2), W<Surface>('hatch', 2), W<Surface>('none', 2)];
/** Augenfarben: Bernstein, Grün, Eisblau, Violett, Rot, Türkis, Rosa, Gold */
const IRIS: RGBn[] = [
  [214, 142, 28],
  [76, 150, 62],
  [70, 150, 214],
  [132, 84, 190],
  [196, 52, 44],
  [22, 150, 140],
  [222, 92, 150],
  [226, 186, 60],
];

/** thing: Ding oder Maschine (Nieten und Maserung statt Fell und Schuppen) */
export function lifeOf(m: { seed: number; mutations: number }, thing = false): Life {
  const r = RNG((m.seed ^ 0x6d2b79f5) + 7919 * m.mutations);
  const eye = weighted(r, EYES).k;
  const wink = r() < 0.06;
  const uneven = r() < 0.1 ? rr(r, 0.62, 0.8) : (r(), 1);
  const lashes = r() < 0.16;
  const iris = IRIS[Math.floor(r() * IRIS.length)]!;
  const other = IRIS[Math.floor(r() * IRIS.length)]!;
  const iris2 = r() < 0.07 ? other : null;
  const face = rr(r, 1.22, 1.42);
  const surface = weighted(r, thing ? THING : ANIMAL).k;
  const feet = r() < 0.7;
  return { eye, wink, uneven, lashes, iris, iris2, face, surface, feet, seed: Math.floor(r() * 4294967296) };
}
