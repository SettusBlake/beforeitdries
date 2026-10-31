/*
 * Spielfarben (festgelegt am 31.10.2026, docs/entwuerfe/uebersicht-vorschlag.md): jede Seite malt ihr Gebiet im Duell in ihrer Farbe.
 * Der Spieler wählt eine Farbe und eine Ausweichfarbe. Ist die Farbe des Gegners zu ähnlich, gilt die Ausweichfarbe,
 * ist auch die zu ähnlich, die nächste freie aus der Liste. Der Computer-Rivale malt in Carmine.
 */
export type ColorId =
  | 'ultramarine'
  | 'carmine'
  | 'viridian'
  | 'cadmium'
  | 'violet'
  | 'cerulean'
  | 'sepia'
  | 'rose'
  | 'lemon'
  | 'sap'
  | 'indigo'
  | 'turquoise'
  | 'sienna'
  | 'magenta'
  | 'paynes'
  | 'coral';
export type TeamColor = { k: ColorId; label: string; rgb: [number, number, number] };

export const TEAM_COLORS: TeamColor[] = [
  { k: 'ultramarine', label: 'Ultramarine', rgb: [43, 63, 163] },
  { k: 'carmine', label: 'Carmine', rgb: [163, 58, 58] },
  { k: 'viridian', label: 'Viridian', rgb: [31, 122, 90] },
  { k: 'cadmium', label: 'Cadmium', rgb: [214, 120, 30] },
  { k: 'violet', label: 'Violet', rgb: [110, 60, 150] },
  { k: 'cerulean', label: 'Cerulean', rgb: [30, 130, 175] },
  { k: 'sepia', label: 'Sepia', rgb: [112, 80, 52] },
  { k: 'rose', label: 'Opera Rose', rgb: [205, 70, 135] },
  { k: 'lemon', label: 'Lemon', rgb: [212, 178, 24] },
  { k: 'sap', label: 'Sap Green', rgb: [98, 140, 38] },
  { k: 'indigo', label: 'Indigo', rgb: [40, 42, 92] },
  { k: 'turquoise', label: 'Turquoise', rgb: [22, 160, 150] },
  { k: 'sienna', label: 'Burnt Sienna', rgb: [170, 88, 46] },
  { k: 'magenta', label: 'Magenta', rgb: [150, 36, 110] },
  { k: 'paynes', label: "Payne's Grey", rgb: [72, 82, 98] },
  { k: 'coral', label: 'Coral', rgb: [232, 112, 96] },
];
export const COLOR_DEFAULT: ColorId = 'ultramarine';
export const COLOR_BACKUP: ColorId = 'viridian';
/** Farbe des Computer-Rivalen */
export const COLOR_RIVAL: ColorId = 'carmine';

export const colorDef = (k: ColorId | undefined): TeamColor => TEAM_COLORS.find((c) => c.k === k) ?? TEAM_COLORS[0]!;
export const isColor = (v: unknown): v is ColorId => typeof v === 'string' && TEAM_COLORS.some((c) => c.k === v);

/** Abstand zweier Farben, wie das Auge ihn ungefähr sieht (gewichtetes RGB, „redmean“) */
export function colorDistance(a: readonly number[], b: readonly number[]): number {
  const rm = (a[0]! + b[0]!) / 2;
  const dr = a[0]! - b[0]!,
    dg = a[1]! - b[1]!,
    db = a[2]! - b[2]!;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
/** Zu ähnlich, um auf dem Blatt zwei Seiten auseinanderzuhalten */
export const SIMILAR = 110;
export const tooSimilar = (a: ColorId, b: ColorId): boolean => a === b || colorDistance(colorDef(a).rgb, colorDef(b).rgb) < SIMILAR;

/** Farben im Duell: der Gegner behält seine, du nimmst deine, sonst die Ausweichfarbe, sonst die nächste freie */
export function duelColors(mine: ColorId | undefined, backup: ColorId | undefined, foe: ColorId | undefined): [ColorId, ColorId] {
  const f = foe ?? COLOR_RIVAL;
  const own = [mine ?? COLOR_DEFAULT, backup ?? COLOR_BACKUP];
  const pick = own.find((c) => !tooSimilar(c, f)) ?? TEAM_COLORS.map((c) => c.k).find((c) => !tooSimilar(c, f))!;
  return [pick, f];
}
