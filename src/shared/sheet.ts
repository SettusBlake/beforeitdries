/*
 * Tagesblatt im Post und als Kommentar (Bleach Schritt 3, docs/entwuerfe/bleach-plan.md): der Endstand eines Laufs als
 * kurzer Text (kein Bild gespeichert). Daraus malt der Tagespost die kleinen Blätter, und „Share as a comment“ macht
 * daraus Quadrate wie bei Wordle. Leicht gehalten, damit die Post-Ansicht die Duell-Regeln nicht laden muss.
 */
import { TEAM_COLORS, type ColorId } from './colors';
import { PIGMENTS } from './data';

/** Blattgröße wie im Duell (rules.ts COLS × ROWS) */
export const SHEET_COLS = 6;
export const SHEET_ROWS = 8;

/**
 * Ein Feld als Zeichen: '.' Papier (auch ausgebleicht), '#' Schlamm, '@' deine Palette,
 * 'a' bis 'h' deine Farbe im Pigment PIGMENTS[i], 'A' bis 'H' dasselbe lasiert, 'z' deine Farbe ohne Pigment
 */
export type SheetCell = { kind: 'paper' } | { kind: 'mud' } | { kind: 'home' } | { kind: 'paint'; pig: number; glazed: boolean };

export function cellCode(c: { owner: number; home: number; hue: string | null; layer?: number }): string {
  if (c.home === 1) return '@';
  if (c.owner === 3) return '#';
  if (c.owner !== 1) return '.';
  const i = PIGMENTS.findIndex((p) => p.id === c.hue);
  if (i < 0) return 'z';
  const ch = String.fromCharCode(97 + i);
  return (c.layer ?? 0) > 0 ? ch.toUpperCase() : ch;
}

export function readCell(ch: string): SheetCell {
  if (ch === '@') return { kind: 'home' };
  if (ch === '#') return { kind: 'mud' };
  if (ch === 'z') return { kind: 'paint', pig: -1, glazed: false };
  const lo = ch.toLowerCase();
  const i = lo.charCodeAt(0) - 97;
  if (lo.length !== 1 || i < 0 || i >= PIGMENTS.length) return { kind: 'paper' };
  return { kind: 'paint', pig: i, glazed: ch !== lo };
}

/** Gültiger Blatt-Code (48 Zeichen aus dem Alphabet oben) */
export const isSheet = (v: unknown): v is string => typeof v === 'string' && v.length === SHEET_COLS * SHEET_ROWS && /^[.#@a-hA-Hz]+$/.test(v);

/* ---------- Quadrate wie bei Wordle ---------- */

/** Das Quadrat, das der Spielfarbe am nächsten kommt (nach Farbton: Rot, Orange, Gelb, Grün, Blau, Lila, dunkles Orange wird Braun, Grau wird Schwarz) */
export function squareOf(col: ColorId | undefined): string {
  const [r, g, b] = (TEAM_COLORS.find((t) => t.k === col) ?? TEAM_COLORS[0]!).rgb.map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2,
    d = max - min;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (sat < 0.25) return '⬛';
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h >= 12 && h < 45 && l < 0.4) return '🟫';
  if (h < 12 || h >= 345) return '🟥';
  if (h < 42) return '🟧';
  if (h < 70) return '🟨';
  if (h < 172) return '🟩';
  if (h < 250) return '🟦';
  return '🟪';
}

/** Das Blatt als Zeilen aus Quadraten: deine Farbe, Papier, Schlamm, Palette */
export function emojiRows(sheet: string, col: ColorId | undefined): string[] {
  const mine = squareOf(col);
  const mud = mine === '🟫' ? '⬛' : '🟫';
  const rows: string[] = [];
  for (let y = 0; y < SHEET_ROWS; y++) {
    let line = '';
    for (let x = 0; x < SHEET_COLS; x++) {
      const c = readCell(sheet[y * SHEET_COLS + x] ?? '.');
      line += c.kind === 'paint' ? mine : c.kind === 'mud' ? mud : c.kind === 'home' ? '🎨' : '⬜';
    }
    rows.push(line);
  }
  return rows;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** „2026-11-02“ → „Nov 2“ */
export function dayLabel(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return m && d ? `${MONTHS[m - 1]} ${d}` : day;
}

export type ShareInput = {
  day: string;
  points: number;
  ranked: boolean;
  rank?: number;
  players?: number;
  hearts: number;
  heartsMax: number;
  washed: number;
  boss: number;
  pales: number;
  sheet: string;
  col?: ColorId;
};

/** Der Kommentar unter dem Tagespost (Markdown, Zeilenumbruch mit zwei Leerzeichen) */
export function shareText(r: ShareInput): string {
  const head = r.ranked ? `**Today’s sheet · ${dayLabel(r.day)}**` : `**Test sheet · ${dayLabel(r.day)}** (not ranked)`;
  const hearts = '❤️'.repeat(Math.max(0, r.hearts)) + '🤍'.repeat(Math.max(0, r.heartsMax - r.hearts));
  const place = r.ranked && r.rank ? ` · #${r.rank} of ${r.players ?? r.rank}` : '';
  const pales = `${r.washed + r.boss} of ${r.pales} Pales washed out${r.boss ? ', the great one too' : ''}`;
  return [head, '', emojiRows(r.sheet, r.col).join('  \n'), '', `**${r.points} points**${place} · ${hearts}  \n${pales}`].join('\n');
}
