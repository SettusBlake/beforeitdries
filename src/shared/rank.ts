/*
 * Malerrang (H2, freigegeben am 09.11.2026, docs/entwuerfe/fesseln-vorschlag.md Fassung 2, Abschnitt 7).
 * Erfahrung aus Duellen, Tagesblatt, Zügen und Wochenzielen. Rang 1 bis 50, jeder Rang etwas Pigment,
 * alle 5 Ränge ein neuer Titel und ein Geschenk. Bisherige Spieler bekommen einen Startrang ohne den Lohn der übersprungenen Ränge.
 */
import type { BrushId, DiceSave } from './dice';
import { dayColour } from './daily';
import { dayKey } from './day';

/** Erfahrung je Handlung */
export const XP = { duel: 20, win: 30, sheet: 30, dip: 5, goal: 50 };
export const RANK_MAX = 50;
/** Erfahrung von Rang n zu Rang n + 1 */
export const rankNeed = (n: number): number => 40 + 20 * n;
/** Erfahrung, ab der Rang n erreicht ist (Rang 1 ab 0) */
export const rankFrom = (n: number): number => 40 * (n - 1) + 10 * n * (n - 1);
/** Rang zu einer Erfahrung: Rang, XP im Rang, Bedarf bis zum nächsten (beim höchsten Rang 0) */
export function rankOf(xp: number): { n: number; have: number; need: number } {
  let n = 1;
  while (n < RANK_MAX && xp >= rankFrom(n + 1)) n++;
  return { n, have: xp - rankFrom(n), need: n < RANK_MAX ? rankNeed(n) : 0 };
}
/** Pigment beim Erreichen von Rang n */
export const rankPigment = (n: number): number => 20 + 2 * n;

/** Geschenke zu einem neuen Titel */
export type RankGift = { k: 'blank'; n: number } | { k: 'dip'; brush: BrushId } | { k: 'drops'; n: number } | { k: 'badge' };
export type RankTitle = { at: number; title: string; gifts: RankGift[]; say: string };
export const TITLES: RankTitle[] = [
  { at: 1, title: 'Brush washer', gifts: [], say: '' },
  { at: 5, title: 'Water carrier', gifts: [{ k: 'blank', n: 1 }], say: 'Water first. Paint later. You learn.' },
  { at: 10, title: 'Paper stretcher', gifts: [{ k: 'dip', brush: 'loaded' }], say: 'You stretch the paper before you paint. Most never do.' },
  { at: 15, title: 'Colour grinder', gifts: [{ k: 'drops', n: 5 }], say: 'Grind the colour fine. Coarse colour lies.' },
  { at: 20, title: 'Wash layer', gifts: [{ k: 'dip', brush: 'loaded' }], say: 'A wash forgives nothing. Good.' },
  { at: 25, title: 'Glazer', gifts: [{ k: 'dip', brush: 'dripping' }], say: 'Glaze over glaze. Patience is a pigment.' },
  { at: 30, title: 'Edge keeper', gifts: [{ k: 'blank', n: 2 }], say: 'Someone has to watch the edges. Now it is you.' },
  { at: 35, title: 'Sheet mender', gifts: [{ k: 'dip', brush: 'dripping' }], say: 'Torn sheets mend. Not all of them.' },
  { at: 40, title: 'Master of washes', gifts: [{ k: 'drops', n: 5 }, { k: 'dip', brush: 'loaded' }], say: 'The washes listen to you now. Do not abuse it.' },
  { at: 45, title: 'Sepia’s second', gifts: [{ k: 'dip', brush: 'dripping' }], say: 'If I put the brush down, you pick it up.' },
  { at: 50, title: 'Keeper of the Sheet', gifts: [{ k: 'dip', brush: 'dripping' }, { k: 'badge' }], say: 'Keeper of the Sheet. Do not let it dry.' },
];
/** Titel zu einem Rang (der letzte erreichte) */
export const titleOf = (n: number): RankTitle => [...TITLES].reverse().find((t) => t.at <= n)!;
/** Nächster Titel nach Rang n (keiner nach 50) */
export const nextTitle = (n: number): RankTitle | undefined => TITLES.find((t) => t.at > n);
/** Kurz zum Zeigen: „Loaded dip“, „5 drops“, „blank canvas“ */
export function giftText(g: RankGift): string {
  if (g.k === 'blank') return g.n > 1 ? `${g.n} blank canvases` : 'blank canvas';
  if (g.k === 'drops') return `${g.n} drops`;
  if (g.k === 'badge') return 'gold badge';
  return g.brush === 'dripping' ? 'Dripping dip' : 'Loaded dip';
}

/** Ein erreichter Rang: Pigment, bei neuem Titel Titel, Geschenke (Tropfen mit Farbe) und Sepias Satz */
export type RankUp = { n: number; pigment: number; title?: string; gifts?: RankGift[]; pig?: string; say?: string };

const learned = (s: DiceSave): boolean => s.tutorialPaid || (s.duels ?? 0) > 0;
/** Startrang für Spielstände von vor dem Malerrang: aus Duellen, Tagesblättern und Zügen nach den Startzügen */
export function pastXp(s: DiceSave): number {
  return (s.duels ?? 0) * 25 + (s.sheets ?? 0) * XP.sheet + Math.max(0, (s.pulls ?? 0) - 9) * XP.dip;
}
/** Beim Laden: ein Stand ohne Erfahrung bekommt seinen Startrang (gezahlt bis dort, ohne Lohn). Gespeichert mit der nächsten Änderung */
export function rankFresh(s: DiceSave): void {
  if (s.xp !== undefined) return;
  s.xp = pastXp(s);
  s.rk = rankOf(s.xp).n;
}
/**
 * Erfahrung gutschreiben. Jeder neue Rang zahlt Pigment, ein neuer Titel dazu seine Geschenke:
 * leere Würfel (auch über die Obergrenze), Tropfen der Tagesfarbe, Züge warten in rankDips. Nur nach den ersten Schritten
 */
export function rankAdd(s: DiceSave, now: number, xp: number): RankUp[] {
  if (xp <= 0 || !learned(s)) return [];
  rankFresh(s);
  s.xp = (s.xp ?? 0) + xp;
  const to = rankOf(s.xp).n;
  const out: RankUp[] = [];
  for (let n = (s.rk ?? 1) + 1; n <= to; n++) {
    const up: RankUp = { n, pigment: rankPigment(n) };
    s.pigment += up.pigment;
    const t = TITLES.find((x) => x.at === n);
    if (t) {
      up.title = t.title;
      up.gifts = t.gifts;
      up.say = t.say;
      for (const g of t.gifts) {
        if (g.k === 'blank') s.blank = (s.blank ?? 0) + g.n;
        else if (g.k === 'dip') s.rankDips = [...(s.rankDips ?? []), g.brush];
        else if (g.k === 'drops') {
          const pig = dayColour(dayKey(now));
          s.drops = { ...s.drops, [pig]: (s.drops?.[pig] ?? 0) + g.n };
          up.pig = pig;
        }
      }
    }
    out.push(up);
  }
  s.rk = Math.max(s.rk ?? 1, to);
  return out;
}
