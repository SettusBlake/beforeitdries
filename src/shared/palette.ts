/*
 * Farbplan nach Seltenheit (freigegeben am 10.11.2026, docs/entwuerfe/farben-vorschlag.md): wie viele Farben ein Monster hat und wo sie sitzen.
 * Common ist immer einfarbig, jede Seltenheit darüber bekommt eine Farbe und mehr Aufwand dazu. Nur Aussehen, keine Werte.
 * Eigener Zufallsstrom aus dem Seed: Form, Werte, Gesicht und Generation 1 bleiben, wie sie sind.
 */
import { PIG, type PaperId, type PigmentId } from './data';
import { tinted, type Look, type Pattern, type PatternKind } from './look';
import { RNG, rr, weighted, type Rand } from './rng';

export type RGBn = [number, number, number];
/** Stufe aus dem Papier: 0 Common bis 4 Legendary */
export type Tier = 0 | 1 | 2 | 3 | 4;
const TIER: Partial<Record<PaperId, Tier>> = { schul: 0, zeichen: 1, buetten: 2, hadern: 3 };
export const tierOf = (paper: PaperId): Tier => TIER[paper] ?? 4;

/** Wo die zweite Farbe sitzt: Glieder und kleine Teile, ein großes Teil (oft der Kopf), nasser Verlauf im Körper, Flecken */
export type Second = 'ends' | 'head' | 'fade' | 'patch';
export type Plan = {
  tier: Tier;
  /** 1 bis 5 Farben, die erste ist das Hauptpigment mit eigenem Ton */
  cols: RGBn[];
  second: Second | null;
  /** Richtung des Verlaufs (Bogenmaß) */
  ang: number;
  /** Common: kleine Teile in einem dunkleren Ton derselben Farbe */
  smallDark: boolean;
  /** Akzentfarbe (Index in cols) für Iris und Spritzer, -1: keine */
  accent: number;
  /** Muster (Common nur Ton in Ton), col: Index in cols oder -1 für dunkle Hauptfarbe */
  pattern: Pattern | null;
  patternCol: number;
  /** Schatten unten und ausgehobener Bauch (ab Rare), Hof auf dem Papier und Goldstaub (Legendary) */
  shade: boolean;
  belly: boolean;
  aura: boolean;
  gold: boolean;
  /** Kräftigkeit der Lasur, damit zwei Monster derselben Farbe nicht gleich aussehen */
  depth: number;
  seed: number;
};

/* ---------- Farbe ---------- */
function toHsl(c: readonly number[]): [number, number, number] {
  const [r, g, b] = c.map((v) => v / 255) as [number, number, number];
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2,
    d = mx - mn;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) % 360 + 360) % 360, s, l];
}
function hsl(h: number, s: number, l: number): RGBn {
  const H = ((h % 360) + 360) % 360,
    c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((H / 60) % 2) - 1)),
    o = l - c / 2;
  const [p, q, w] = H < 60 ? [c, x, 0] : H < 120 ? [x, c, 0] : H < 180 ? [0, c, x] : H < 240 ? [0, x, c] : H < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((p + o) * 255), Math.round((q + o) * 255), Math.round((w + o) * 255)];
}
const hueGap = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
/** Blattgold für Legendary */
export const GOLD: RGBn = [201, 150, 30];

const W = <T>(k: T, w: number) => ({ k, w });
const ANIMAL: { k: PatternKind; w: number }[] = [W('spots', 3), W('stripes', 3), W('rings', 1), W('speckle', 2), W('fade', 1), W('marble', 1)];
const THING: { k: PatternKind; w: number }[] = [W('bands', 3), W('check', 2), W('speckle', 1), W('stripes', 1), W('marble', 1)];
function patternOf(r: Rand, thing: boolean): Pattern {
  return {
    k: weighted(r, thing ? THING : ANIMAL).k,
    amt: rr(r, 0.6, 1),
    dark: false,
    part: r() < 0.3 ? r() : (r(), null),
    scale: rr(r, 0.7, 1.4),
    angle: rr(r, -0.5, 0.5) + (r() < 0.3 ? Math.PI / 2 : 0),
  };
}
/** Chance auf ein Muster je Stufe */
const PATTERN_P = [0.3, 0.45, 0.7, 1, 1];

/**
 * Der Farbplan eines Monsters. Die zweite und dritte Farbe sind die Zweitpigmente des Monsters, wenn es welche hat,
 * sonst Nachbarn und Gegenfarbe des Hauptpigments (wie nass in nass gemischt). thing: Ding oder Maschine (andere Muster)
 */
export function planOf(m: { seed: number; mutations: number; main: PigmentId; sec: readonly PigmentId[]; paper: PaperId }, look: Look, thing = false): Plan {
  const r = RNG((m.seed ^ 0x3c6ef372) + 7919 * m.mutations);
  const tier = tierOf(m.paper);
  const c0 = tinted(PIG[m.main].rgb, look.main);
  const [h0, s0] = toHsl(c0);
  const side = r() < 0.5 ? 1 : -1;
  // Immer gleich viele Würfe, egal welche Stufe: so bleibt der Plan gleich, wenn Holo das Papier hebt, und nur die Stufe kommt dazu
  const near = hsl(h0 + side * rr(r, 38, 70), Math.min(0.8, Math.max(0.5, s0) * rr(r, 0.9, 1.1)), rr(r, 0.36, 0.48));
  const accent = hsl(h0 + 180 + rr(r, -35, 35), rr(r, 0.65, 0.85), rr(r, 0.42, 0.52));
  const far = hsl(h0 - side * rr(r, 45, 80), Math.min(0.8, Math.max(0.5, s0) * rr(r, 0.9, 1.1)), rr(r, 0.38, 0.5));
  const sec = m.sec.map((id) => tinted(PIG[id].rgb, look.sec));
  // Bis Rare sitzen die Zweitpigmente des Monsters auf den Plätzen 2 und 3. Ab Epic verläuft der Körper in die Nachbarfarbe
  // (das bleibt klar, zwei beliebige Pigmente ineinander geben schnell Schlamm), die Zweitpigmente werden Akzente
  const cols: RGBn[] = tier <= 2 ? [c0, sec[0] ?? near, sec[1] ?? accent].slice(0, tier + 1) : tier === 3 ? [c0, near, sec[0] ?? accent, sec[1] ?? far] : [c0, near, far, sec[0] ?? accent, GOLD];
  const rolled = weighted(r, [W<Second>('ends', 3), W<Second>('head', 2), W<Second>('fade', 3), W<Second>('patch', 2)]).k;
  // Ein Verlauf zwischen Gegenfarben wird grau: dann sitzt die zweite Farbe lieber auf Gliedern und kleinen Teilen
  const clash = cols[1] ? hueGap(h0, toHsl(cols[1])[0]) > 100 : false;
  const second: Second = rolled === 'fade' && clash ? 'ends' : rolled;
  const ang = rr(r, 0, Math.PI * 2);
  const smallDark = r() < 0.5;
  const hasPattern = r() < PATTERN_P[tier]!;
  const fresh = patternOf(r, thing);
  const pcol = r();
  const depth = rr(r, 0.82, 1.18);
  const seed = Math.floor(r() * 4294967296);
  // Muster: das schon gewürfelte bleibt, sonst ein neues. Common nur Ton in Ton
  const pattern = hasPattern || (look.pattern && tier > 0 && tier < 3) ? (look.pattern ?? fresh) : null;
  const patternCol = tier === 0 ? -1 : tier === 1 ? (pcol < 0.6 ? 1 : -1) : tier === 2 ? (pcol < 0.6 ? 2 : 1) : tier === 3 ? (pcol < 0.7 ? 2 : -1) : pcol < 0.7 ? 3 : -1;
  return {
    tier,
    cols,
    second: tier === 0 ? null : tier >= 3 ? 'fade' : second,
    accent: tier < 2 ? -1 : tier === 4 ? 3 : 2,
    ang,
    smallDark,
    pattern,
    patternCol,
    shade: tier >= 2,
    belly: tier >= 2,
    aura: tier >= 4,
    gold: tier >= 4,
    depth,
    seed,
  };
}
