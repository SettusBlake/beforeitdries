/*
 * Strähne (T2, freigegeben am 04.11.2026, docs/entwuerfe/taegliche-aktivitaet-vorschlag.md).
 * Ein Tag zählt, wenn der Wertungslauf des Tagesblatts fertig ist (der Server zählt, Tag = UTC-Tag des Blatts).
 * Retarder: ein verpasster Tag je Woche (Montag UTC, die Woche des verpassten Tags) bricht sie nicht.
 * Lohn: ab 2 Tagen +5 Pigment je Tag, höchstens +50, alle 7 Tage ein Tropfen der Tagesfarbe.
 */
import { weekKey } from './day';

export const STREAK = { perDay: 5, max: 50, dropEvery: 7, milestones: [3, 7, 30, 100] };

/** n: Tage in Folge, last: zuletzt gemalter Tag, best: längste, held: Woche des zuletzt verziehenen Tags */
export type Streak = { n: number; last: string; best: number; held?: string };
/** Was der Lauf mit der Strähne gemacht hat (Ergebnis) */
export type StreakStep = { n: number; best: number; pigment: number; drop: boolean; held: boolean; broke: number };
/** none: nie gemalt, done: heute gemalt, open: gestern gemalt, held: gestern verpasst, der Retarder hält sie noch, dry: vorbei */
export type StreakState = 'none' | 'done' | 'open' | 'held' | 'dry';

const dayNum = (day: string): number => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);
const weekOfDay = (n: number): string => weekKey(n * 86400000);

/** Den Tag day malen. broke: so lang war die Strähne, die gerade getrocknet ist (sonst 0) */
export function streakPaint(s: Streak | undefined, day: string): { s: Streak; held: boolean; broke: number } {
  const t = dayNum(day);
  if (!s) return { s: { n: 1, last: day, best: 1 }, held: false, broke: 0 };
  const gap = t - dayNum(s.last);
  if (gap <= 0) return { s, held: false, broke: 0 };
  let held = false;
  let n = 1;
  if (gap === 1) n = s.n + 1;
  else if (gap === 2 && s.held !== weekOfDay(t - 1)) {
    n = s.n + 1;
    held = true;
  }
  const keep = held ? weekOfDay(t - 1) : s.held;
  return { s: { n, last: day, best: Math.max(s.best, n), ...(keep ? { held: keep } : {}) }, held, broke: n === 1 ? s.n : 0 };
}

/** Stand der Strähne am Tag today, ohne etwas zu ändern (Startbild, Tagespost) */
export function streakNow(s: Streak | undefined, today: string): { n: number; state: StreakState; best: number } {
  if (!s) return { n: 0, state: 'none', best: 0 };
  const t = dayNum(today);
  const gap = t - dayNum(s.last);
  if (gap <= 0) return { n: s.n, state: 'done', best: s.best };
  if (gap === 1) return { n: s.n, state: 'open', best: s.best };
  if (gap === 2 && s.held !== weekOfDay(t - 1)) return { n: s.n, state: 'held', best: s.best };
  return { n: 0, state: 'dry', best: s.best };
}

/** Lohn für den n-ten Tag in Folge */
export function streakReward(n: number): { pigment: number; drop: boolean } {
  return { pigment: n >= 2 ? Math.min(STREAK.max, STREAK.perDay * n) : 0, drop: n >= STREAK.dropEvery && n % STREAK.dropEvery === 0 };
}

/** Text der User-Flair (nur mit Schalter im Menü) */
export const streakFlairText = (n: number): string => `🖌 ${n} ${n === 1 ? 'day' : 'days'}`;
/** Unsere Flair erkennen (die vorige des Spielers kommt beim Ausschalten zurück) */
export const isStreakFlair = (text: string | undefined): boolean => !!text && /^🖌 \d+ days?$/.test(text);

/** Was Sepia im Ergebnis sagt (nur bei besonderen Tagen) */
export function streakSepia(st: StreakStep): string | null {
  if (st.held) return 'You missed a day. I kept your paint wet. Once a week, no more.';
  if (st.broke >= 3) return `Your ${st.broke} days dried. Paper forgives slowly. Start again.`;
  if (st.n === 3) return 'Three days in a row. The paper is starting to remember you.';
  if (st.n === 7) return 'A week without letting it dry. Here, a drop for the jar.';
  if (st.n === 30) return 'Thirty days. Most apprentices stop when the novelty dries.';
  if (st.n === 100) return 'A hundred days. I stopped counting mine. Do not stop counting yours.';
  if (st.drop) return 'Another week on the sheet. Another drop.';
  return null;
}
