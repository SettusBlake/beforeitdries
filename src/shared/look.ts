/*
 * Generation 2b: Aussehen jenseits der Form (eigener Farbton, Muster, Gesicht, Malereignisse). Nur Aussehen, keine Werte.
 * Eigener Zufallsstrom aus dem Seed: Formen, Werte und Generation 1 bleiben, wie sie sind (festgelegt am 30.10.2026).
 */
import { RNG, rr, weighted, type Rand } from './rng';

/** Abweichung vom Pigment: Farbton in Grad, Helligkeit und Sättigung als Faktor */
export type Tint = { hue: number; light: number; sat: number };
export type PatternKind = 'spots' | 'stripes' | 'rings' | 'speckle' | 'fade' | 'marble' | 'bands' | 'check';
export type Pattern = {
  k: PatternKind;
  /** Stärke 0.5 bis 1 */
  amt: number;
  /** true: dunklere Hauptfarbe, sonst Zweitfarbe */
  dark: boolean;
  /** Nur auf einem Teil (0 bis 1 wählt unter den großen Teilen), null: überall */
  part: number | null;
  scale: number;
  angle: number;
};
export type EyeShape = 'round' | 'button' | 'almond' | 'slit' | 'sleepy' | 'shiny' | 'closed' | 'dash';
export type Pupil = 'dot' | 'star' | 'spiral' | 'ring';
export type Mouth = 'smile' | 'grin' | 'teeth' | 'tongue' | 'tusks' | 'fangs' | 'o' | 'zigzag' | 'beak' | 'none';
export type Brow = 'angry' | 'worried' | 'raised' | 'bored';
export type Look = {
  main: Tint;
  sec: Tint;
  pattern: Pattern | null;
  eyes: { n: number; shape: EyeShape; pupil: Pupil; cross: boolean; size: number; gaze: [number, number] };
  mouth: Mouth;
  whiskers: boolean;
  brows: Brow | null;
  cheeks: 'blush' | 'freckles' | null;
  /** Neue Malereignisse, nur Aussehen */
  fx: { runs: boolean; splatter: boolean; tide: boolean; lifted: boolean };
  /** Ganz ohne Gesicht (gemalte Monster behalten ihres) */
  faceless: boolean;
  /** Zufall für das Malen selbst (Lage der Flecken, Spritzer) */
  seed: number;
};

const tint = (r: Rand): Tint => ({ hue: rr(r, -12, 12), light: rr(r, 0.85, 1.15), sat: rr(r, 0.85, 1.15) });
const W = <T>(k: T, w: number) => ({ k, w });
const ANIMAL_PATTERNS = [W<PatternKind>('spots', 3), W<PatternKind>('stripes', 3), W<PatternKind>('rings', 1), W<PatternKind>('speckle', 2), W<PatternKind>('fade', 2), W<PatternKind>('marble', 1)];
const THING_PATTERNS = [W<PatternKind>('bands', 3), W<PatternKind>('check', 2), W<PatternKind>('speckle', 1), W<PatternKind>('fade', 2), W<PatternKind>('stripes', 1), W<PatternKind>('marble', 1)];
// Etwa 25 % nicht zwei Augen (festgelegt am 30.10.2026)
const EYE_N = [W(2, 75), W(1, 9), W(3, 7), W(4, 4), W(5, 2), W(6, 2), W(7, 1)];
const SHAPES = [W<EyeShape>('round', 4), W<EyeShape>('button', 2), W<EyeShape>('almond', 2), W<EyeShape>('slit', 1), W<EyeShape>('sleepy', 2), W<EyeShape>('shiny', 2), W<EyeShape>('closed', 1), W<EyeShape>('dash', 2)];
const PUPILS = [W<Pupil>('dot', 16), W<Pupil>('star', 2), W<Pupil>('spiral', 1), W<Pupil>('ring', 1)];
const MOUTHS = [
  W<Mouth>('smile', 4),
  W<Mouth>('grin', 2),
  W<Mouth>('teeth', 2),
  W<Mouth>('tongue', 2),
  W<Mouth>('tusks', 1),
  W<Mouth>('fangs', 2),
  W<Mouth>('o', 2),
  W<Mouth>('zigzag', 1),
  W<Mouth>('beak', 1),
  W<Mouth>('none', 2),
];
const BROWS: Brow[] = ['angry', 'worried', 'raised', 'bored'];

/**
 * Das Aussehen eines Monsters der Generation 2. thing: die Form ist ein Ding oder eine Maschine (andere Muster).
 * Immer gleich viele Zufallszahlen in fester Reihenfolge, damit später Neues hinten angehängt werden kann.
 */
export function lookOf(m: { seed: number; mutations: number; sec: readonly unknown[] }, thing = false): Look {
  const r = RNG((m.seed ^ 0x51ed270b) + 7919 * m.mutations);
  const main = tint(r),
    sec = tint(r);
  const hasPattern = r() < 0.4;
  const k = weighted(r, thing ? THING_PATTERNS : ANIMAL_PATTERNS).k;
  const pattern: Pattern = {
    k,
    amt: rr(r, 0.5, 1),
    dark: r() < 0.5 || !m.sec.length,
    part: r() < 0.35 ? r() : (r(), null),
    scale: rr(r, 0.7, 1.4),
    // Streifen meist quer, manchmal längs
    angle: rr(r, -0.5, 0.5) + (r() < 0.3 ? Math.PI / 2 : 0),
  };
  const eyes = {
    n: weighted(r, EYE_N).k,
    shape: weighted(r, SHAPES).k,
    pupil: weighted(r, PUPILS).k,
    cross: r() < 0.04,
    size: rr(r, 0.85, 1.25),
    gaze: [rr(r, -1, 1), rr(r, -0.7, 0.7)] as [number, number],
  };
  const mouth = weighted(r, MOUTHS).k;
  const whiskers = r() < 0.15;
  const brows = r() < 0.3 ? BROWS[Math.floor(r() * BROWS.length)]! : (r(), null);
  const cheeks = r() < 0.15 ? (r() < 0.67 ? 'blush' : 'freckles') : (r(), null);
  const fx = { runs: r() < 0.12, splatter: r() < 0.12, tide: r() < 0.15, lifted: r() < 0.12 };
  // Kein Gesicht reicht auch (festgelegt am 30.10.2026)
  const faceless = r() < 0.08;
  return { main, sec, pattern: hasPattern ? pattern : null, eyes, mouth, whiskers, brows, cheeks, fx, faceless, seed: Math.floor(r() * 4294967296) };
}

/** Pigmentfarbe mit eigenem Ton (über HSL), bleibt im Bereich des Pigments */
export function tinted(rgb: readonly number[], t: Tint): [number, number, number] {
  const [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2,
    d = mx - mn;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const H = (((h * 60 + t.hue) % 360) + 360) % 360,
    S = Math.min(1, s * t.sat),
    L = Math.min(0.92, Math.max(0.06, l * t.light));
  const c = (1 - Math.abs(2 * L - 1)) * S,
    x = c * (1 - Math.abs(((H / 60) % 2) - 1)),
    o = L - c / 2;
  const [p, q, w] = H < 60 ? [c, x, 0] : H < 120 ? [x, c, 0] : H < 180 ? [0, c, x] : H < 240 ? [0, x, c] : H < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((p + o) * 255), Math.round((q + o) * 255), Math.round((w + o) * 255)];
}
