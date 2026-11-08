/*
 * Tägliche Aktivität Schritt 2 (freigegeben am 08.11.2026, docs/entwuerfe/taegliche-aktivitaet-vorschlag.md Fassung 3):
 * T11 Wochenziele: drei Ziele je Woche, neu am Montag (UTC), für alle mit denselben Regeln gleich. Je Ziel 80 Pigment beim Erfüllen,
 * alle drei geben einen leeren Würfel extra (auch über die Obergrenze). Nur Ziele mit Regeln, die für den Spieler schon gelten (E2).
 * T10 Willkommen zurück: wer 3 UTC-Tage oder länger nicht da war (Geschenk, Zug, Duell, Tagesblatt), bekommt einen Zug mit dem
 * Plain brush gratis, höchstens einmal in 14 Tagen.
 */
import { weekKey } from './day';
import { dayNo } from './daily';
import type { DiceSave } from './dice';
import { ruleStage } from './duel/stages';

/* ---------- T11 Wochenziele ---------- */

export type GoalId = 'sheets' | 'pales' | 'clean' | 'wins' | 'washed' | 'hearts' | 'glaze' | 'elem' | 'master' | 'task' | 'gallery' | 'dips' | 'gifts' | 'drops';
/** Ein Ziel: so oft (n), Text fürs Spiel, Gruppe (0 Tagesblatt, 1 Duell, 2 Sammeln), ab welcher Regelstufe */
export type Goal = { id: GoalId; n: number; text: string; group: 0 | 1 | 2; stage: number };
export const GOALS: Goal[] = [
  { id: 'sheets', n: 4, text: 'Finish 4 daily sheets', group: 0, stage: 1 },
  { id: 'pales', n: 30, text: 'Wash out 30 Pales', group: 0, stage: 1 },
  { id: 'clean', n: 2, text: 'Keep every heart on 2 daily sheets', group: 0, stage: 1 },
  { id: 'wins', n: 6, text: 'Win 6 duels', group: 1, stage: 1 },
  { id: 'washed', n: 12, text: 'Wash out 12 rival blots', group: 1, stage: 1 },
  { id: 'hearts', n: 6, text: 'Hit 6 palette hearts', group: 1, stage: 1 },
  { id: 'glaze', n: 5, text: 'Roll Glaze or Pure 5 times', group: 1, stage: 1 },
  // Element-Treffer ×2 erst ab Stufe 3, Meisterzug ab 4, Auftrag und Galerie ab 6 (Einstieg E2)
  { id: 'elem', n: 5, text: 'Land 5 element hits at ×2', group: 1, stage: 3 },
  { id: 'master', n: 3, text: 'Land 3 master strokes', group: 1, stage: 4 },
  { id: 'task', n: 4, text: 'Meet 4 of Sepia’s tasks', group: 1, stage: 6 },
  { id: 'gallery', n: 2, text: 'Win 2 gallery duels', group: 1, stage: 6 },
  { id: 'dips', n: 7, text: 'Dip the brush 7 times', group: 2, stage: 1 },
  { id: 'gifts', n: 5, text: 'Open 5 daily gifts', group: 2, stage: 1 },
  { id: 'drops', n: 6, text: 'Collect 6 drops', group: 2, stage: 1 },
];
export const WEEKLY = { pigment: 80, blank: 1 };
export const goalDef = (id: GoalId): Goal => GOALS.find((g) => g.id === id)!;

/** Stand der Woche im Spielstand: Woche, die drei Ziele (beim ersten Laden der Woche festgehalten), Fortschritt, erfüllt (Bits), alle drei bezahlt */
export type WeekState = { w: string; ids: GoalId[]; n: number[]; got: number; all?: 1 };
/** Ein gerade erfülltes Ziel (Ergebnis, Zug, Geschenk): Text, Pigment, bei allen dreien der leere Würfel */
export type WeekDone = { id: GoalId; text: string; pigment: number; blank?: true };

/**
 * Die drei Ziele einer Woche für eine Regelstufe: je Gruppe eins, die Reihenfolge rückt jede Woche um eins weiter.
 * Ein Ziel, dessen Regel noch nicht gilt, überspringt die Stufe zum nächsten. So haben alle mit denselben Regeln dieselben Ziele
 */
export function weekGoals(w: string, stage: number): GoalId[] {
  const no = Number(w.slice(1));
  return ([0, 1, 2] as const).map((g) => {
    const list = GOALS.filter((x) => x.group === g);
    for (let k = 0; k < list.length; k++) {
      const x = list[(no + k) % list.length]!;
      if (x.stage <= stage) return x.id;
    }
    return list[0]!.id;
  });
}
/** Neue Woche: Ziele nach der Regelstufe von jetzt festhalten. Rechnet beim Laden, gespeichert wird mit der nächsten Änderung */
export function weekFresh(s: DiceSave, now: number): WeekState {
  const w = weekKey(now);
  if (s.week?.w !== w) s.week = { w, ids: weekGoals(w, ruleStage(s)), n: [0, 0, 0], got: 0 };
  return s.week;
}
/**
 * Fortschritt zählen. Ein erfülltes Ziel zahlt sofort 80 Pigment, alle drei dazu einen leeren Würfel.
 * Gibt zurück, was dabei erfüllt wurde. Nur nach den ersten Schritten
 */
export function weekAdd(s: DiceSave, now: number, adds: Partial<Record<GoalId, number>>): WeekDone[] {
  if (!(s.tutorialPaid || (s.duels ?? 0) > 0)) return [];
  const wk = weekFresh(s, now);
  const out: WeekDone[] = [];
  wk.ids.forEach((id, i) => {
    const k = adds[id] ?? 0;
    if (k <= 0 || wk.got & (1 << i)) return;
    const g = goalDef(id);
    wk.n[i] = Math.min(g.n, (wk.n[i] ?? 0) + k);
    if (wk.n[i]! < g.n) return;
    wk.got |= 1 << i;
    s.pigment += WEEKLY.pigment;
    out.push({ id, text: g.text, pigment: WEEKLY.pigment });
  });
  if (out.length && wk.got === 7 && !wk.all) {
    wk.all = 1;
    s.blank = (s.blank ?? 0) + WEEKLY.blank;
    out[out.length - 1]!.blank = true;
  }
  return out;
}
/** Tage bis zur nächsten Woche (Montag 0 Uhr UTC) */
export const daysToMonday = (now: number): number => {
  const n = Math.floor(now / 86400000);
  return 7 - ((((n + 3) % 7) + 7) % 7);
};

/* ---------- T10 Willkommen zurück ---------- */

export const WELCOME = { away: 3, every: 14 };
/** Zuletzt aktiv: gespeichert seit Schritt 2, sonst aus dem, was der Spielstand schon weiß (freier Zug, Geschenk, Tagesblatt, Duell) */
function lastActive(s: DiceSave): string {
  if (s.act) return s.act;
  return [s.freeDay, s.gift?.day, s.streak?.last, s.rewardDay].filter((x): x is string => !!x).sort().pop() ?? '';
}
/**
 * So viele Tage war der Spieler weg, wenn ein Willkommens-Zug wartet, sonst 0.
 * Wartet schon einer (beim ersten Tun nach der Pause festgehalten), bleibt er, bis er genommen ist
 */
export function welcomeAway(s: DiceSave, today: string): number {
  if (s.backAway) return s.backAway;
  if (!(s.tutorialPaid || (s.duels ?? 0) > 0)) return 0;
  const last = lastActive(s);
  if (!last) return 0;
  const gap = dayNo(today) - dayNo(last);
  if (gap < WELCOME.away) return 0;
  if (s.backDay && dayNo(today) - dayNo(s.backDay) < WELCOME.every) return 0;
  return gap;
}
/** Der Spieler tut etwas (Geschenk, Zug, Duell, Tagesblatt): ein fälliger Willkommens-Zug bleibt liegen, dann gilt heute als zuletzt aktiv */
export function touchDay(s: DiceSave, today: string): void {
  const away = welcomeAway(s, today);
  if (away) s.backAway = away;
  s.act = today;
}
const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
/** Sepia beim Willkommens-Zug */
export function welcomeText(away: number): string {
  const how = away <= 12 ? `${WORDS[away]} days away.` : away < 21 ? 'Two weeks away.' : away < 60 ? 'Weeks away.' : 'Months away.';
  return `${how} The sheet kept your place. Have a dip on me.`;
}
