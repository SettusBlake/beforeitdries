/*
 * Regeln nach und nach (Einstieg E2, freigegeben am 06.11.2026, docs/entwuerfe/einstieg-vorschlag.md).
 * Neue Spieler beginnen bei Stufe 1 (Grundregeln), jedes fertige Duell schaltet eine Sache frei, ab Stufe 6 gilt alles.
 * Was noch nicht frei ist, gilt für beide Seiten nicht und ist nicht zu sehen.
 * Spieler von vorher (ohne Stufe im Spielstand), Lern-Duell, Galerie und Tagesblatt spielen mit allem (STAGE_ALL, ohne Ankündigung).
 */
export const RULE_STAGES = 6;
export const STAGE_ALL = 7;
/** Ab welcher Stufe etwas gilt */
export const UNLOCK = { wet: 2, elements: 3, brim: 4, media: 5, task: 6, sets: 6 } as const;
export type Unlock = keyof typeof UNLOCK;
/** Stufe aus dem Spielstand: fehlt sie, ist es ein Spieler von vorher */
export const ruleStage = (s: { stage?: number }): number => s.stage ?? STAGE_ALL;
export const stageHas = (stage: number, k: Unlock): boolean => stage >= UNLOCK[k];
/** Galerie-Duelle erst, wenn alles frei ist */
export const galleryOpen = (stage: number): boolean => stage >= RULE_STAGES;
/** Wie viele fertige Duelle noch bis zur Galerie */
export const duelsToGallery = (stage: number): number => Math.max(0, RULE_STAGES - stage);
export const galleryLockText = (stage: number): string => {
  const n = duelsToGallery(stage);
  return `Gallery duels open after ${n} more duel${n === 1 ? '' : 's'}.`;
};

/** Ankündigung zu Beginn des ersten Duells einer Stufe: Titel, ein Satz, und welcher Abschnitt der Hilfe dazu gehört */
export const RULE_NEWS: Record<number, { title: string; text: string; help: string }> = {
  2: { title: 'Wet rerolls', text: 'From the second reroll, a die may turn to mud.', help: 'rule-wet' },
  3: { title: 'Elements', text: 'The badge is its element. The right one hits twice as hard.', help: 'rule-elements' },
  4: { title: 'The gold ring', text: 'Acting fills a blot’s ring. Full, its next move is a master stroke.', help: 'rule-brim' },
  5: { title: 'Mediums', text: 'Pick one before the duel. It bends one rule until the end.', help: 'rule-media' },
  6: { title: 'Tasks and sets', text: 'Meet Sepia’s task for a joker. Two blots of one colour family get a bonus.', help: 'rule-task' },
};
