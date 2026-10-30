/* Tageskalender (UTC) und Namensvorschläge */

/** YYYY-MM-DD in UTC */
export function dayKey(ms: number = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Woche (UTC), beginnt Montag 0 Uhr. 1.1.1970 war ein Donnerstag */
export function weekKey(ms: number = Date.now()): string {
  return 'w' + Math.floor((Math.floor(ms / 86400000) + 3) / 7);
}

export function shiftDay(day: string, delta: number): string {
  return dayKey(Date.parse(day + 'T00:00:00Z') + delta * 86400000);
}

export function isDayKey(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "October 28" */
export function prettyDay(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

/** Restzeit bis Mitternacht UTC */
export function msUntilDayEnds(now: number = Date.now()): number {
  const end = Date.parse(dayKey(now) + 'T00:00:00Z') + 86400000;
  return end - now;
}

export const NAME_MAX = 28;

/**
 * Liest einen Namensvorschlag aus einem Kommentar: erste Zeile, ohne Markdown,
 * 3 bis 28 Zeichen, nur Buchstaben, Leerzeichen, Bindestrich und Apostroph, höchstens 3 Wörter.
 * Ein vorangestelltes "Name:" ist erlaubt.
 */
export function parseNameSuggestion(body: string): string | null {
  let line = (body.split('\n').find((l) => l.trim() !== '') ?? '').trim();
  line = line.replace(/^name\s*[:=-]\s*/i, '');
  line = line.replace(/[*_~`>#"“”]/g, '').trim();
  line = line.replace(/[.!?]+$/, '').trim();
  line = line.replace(/\s+/g, ' ');
  if (line.length < 3 || line.length > NAME_MAX) return null;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' -]*[A-Za-zÀ-ÖØ-öø-ÿ]$/.test(line)) return null;
  if (line.split(' ').length > 3) return null;
  return line
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
