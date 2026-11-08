/*
 * Tägliche Aktivität Schritt 1 (freigegeben am 08.11.2026, docs/entwuerfe/taegliche-aktivitaet-vorschlag.md Fassung 3):
 * T8 Tagesgeschenk (sieben Töpfe, einmal am Tag, ohne Zurücksetzen) und T3 Tagesregel für das Tagesblatt
 * (Wochentag als Stufe, sonntags ein zweiter großer Pale und Punkte × 1,5, Malmittel des Tages).
 */
import type { MediumId } from './duel/media';

/* ---------- T8 Tagesgeschenk ---------- */

/** Ein Geschenk der Leiste: Pigment, ein Tropfen der Tagesfarbe oder ein Zug mit einem vollen Pinsel */
export type Gift = { k: 'pigment'; n: number } | { k: 'drop' } | { k: 'dip'; brush: 'loaded' };
/** Die Leiste: Tag 1 bis 7, danach von vorn. Wer einen Tag auslässt, macht beim nächsten Kommen einfach weiter */
export const GIFTS: Gift[] = [
  { k: 'pigment', n: 20 },
  { k: 'drop' },
  { k: 'pigment', n: 30 },
  { k: 'drop' },
  { k: 'pigment', n: 40 },
  { k: 'drop' },
  { k: 'dip', brush: 'loaded' },
];
/** Geschenk-Stand im Spielstand: so viele Geschenke insgesamt geöffnet, zuletzt an diesem UTC-Tag */
export type GiftState = { n: number; day: string };
/** Welcher Tag der Leiste als nächster dran ist (0 bis 6) */
export const giftIndex = (g: GiftState | undefined): number => (g?.n ?? 0) % GIFTS.length;
/** Heute schon geöffnet? */
export const giftOpened = (g: GiftState | undefined, today: string): boolean => g?.day === today;
/** Kurz zum Zeigen: „20 pigment“, „a drop“, „a Loaded dip“ */
export function giftShort(x: Gift): string {
  if (x.k === 'pigment') return `${x.n} pigment`;
  if (x.k === 'drop') return 'a drop';
  return 'a Loaded dip';
}

/* ---------- T3 Tagesregel ---------- */

/** Tag (UTC, „2026-11-08“) als fortlaufende Zahl */
export const dayNo = (day: string): number => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);
/** Der Tag danach */
export const nextDay = (day: string): string => new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
/** Wochentag 0 = Montag bis 6 = Sonntag */
export const weekdayOf = (day: string): number => (((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 7) % 7;

/** Die Woche wird schwerer: Name im Tagespost und Faktor auf die Lebenskraft der Pales (Montag × 0,9 bis Sonntag × 1,2) */
export const WEEK: { day: string; label: string; hp: number }[] = [
  { day: 'Monday', label: 'light wash', hp: 0.9 },
  { day: 'Tuesday', label: 'first layer', hp: 0.95 },
  { day: 'Wednesday', label: 'second layer', hp: 1 },
  { day: 'Thursday', label: 'half dry', hp: 1.05 },
  { day: 'Friday', label: 'heavy wash', hp: 1.1 },
  { day: 'Saturday', label: 'the margins creep', hp: 1.15 },
  { day: 'Sunday', label: 'the Eraser’s day', hp: 1.2 },
];
/** Sonntag: ein zweiter großer Pale in der letzten Welle und Punkte × 1,5 */
export const SUNDAY = { bigs: 2, mult: 1.5 };
/** Malmittel des Tages: nur die, die im Tagesblatt wirken */
export const DAY_MEDIA: MediumId[] = ['gum', 'oxgall', 'salt', 'retarder', 'sponge', 'irid', 'waterbrush'];
/**
 * Malmittel eines Tages aus dem Datum: jede Woche (Montag bis Sonntag) kommt jedes der sieben genau einmal,
 * die Reihenfolge rückt von Woche zu Woche um drei weiter. So gibt es nie zweimal dasselbe hintereinander, auch nicht über den Sonntag
 */
export const dayMedium = (day: string): MediumId => {
  const n = dayNo(day);
  // Tag 0 (1.1.1970) war ein Donnerstag: n + 3 zählt Wochen ab Montag
  const week = Math.floor((n + 3) / 7);
  return DAY_MEDIA[(((weekdayOf(day) + week * 3) % 7) + 7) % 7]!;
};
/** Die Regel des Tagesblatts für einen Tag */
export type SheetRule = { wd: number; day: string; label: string; hp: number; bigs: number; mult: number; medium: MediumId };
export function sheetRule(day: string): SheetRule {
  const wd = weekdayOf(day);
  const w = WEEK[wd]!;
  const sunday = wd === 6;
  return { wd, day: w.day, label: w.label, hp: w.hp, bigs: sunday ? SUNDAY.bigs : 1, mult: sunday ? SUNDAY.mult : 1, medium: dayMedium(day) };
}
