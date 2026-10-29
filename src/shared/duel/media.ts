/*
 * Malmittel (festgelegt am 29.10.2026): jedes biegt eine Regel für den, der es hat. Gewählt wird im Duell,
 * 1 von 3 vor dem Duell, nach Runde 2 und nach Runde 4. Höchstens 3. Neue schaltet man durchs Spielen frei.
 */
export type MediumId = 'gum' | 'oxgall' | 'salt' | 'retarder' | 'sponge' | 'irid' | 'mask' | 'gran' | 'tape' | 'waterbrush';
export type Medium = { id: MediumId; name: string; text: string; col: string };

export const MEDIA: Medium[] = [
  { id: 'gum', name: 'Gum Arabic', text: 'Glazed cells count 3 instead of 2.', col: '#c9a35a' },
  { id: 'oxgall', name: 'Ox Gall', text: 'Bleeding paint runs two cells far.', col: '#7d8c3a' },
  { id: 'salt', name: 'Salt', text: 'More crits. A crit also paints a free cell next to the target.', col: '#8e9aab' },
  { id: 'retarder', name: 'Retarder', text: 'Your paint stays wet one round longer.', col: '#3a7ca5' },
  { id: 'sponge', name: 'Sponge', text: 'A second reroll each turn.', col: '#d1a53a' },
  { id: 'irid', name: 'Iridescent Medium', text: 'Combos give one more.', col: '#a35fc4' },
  { id: 'mask', name: 'Masking Fluid', text: 'Your paint next to your palette cannot be painted over.', col: '#d9c25a' },
  { id: 'gran', name: 'Granulation Medium', text: 'Mud counts for you when the paper dries.', col: '#8a6a4a' },
  { id: 'tape', name: 'Masking Tape', text: 'The Eraser does not graze your blots.', col: '#c8b98a' },
  { id: 'waterbrush', name: 'Water Brush', text: 'A burst paints two cells far.', col: '#4a8fc2' },
];
export const mediumDef = (id: MediumId): Medium => MEDIA.find((m) => m.id === id)!;
export const isMedium = (v: unknown): v is MediumId => MEDIA.some((m) => m.id === v);
/** Von Anfang an verfügbar */
export const START_MEDIA: MediumId[] = ['gum', 'oxgall', 'salt', 'retarder', 'sponge', 'irid'];
/** Danach eins pro fertigem Duell, in dieser Reihenfolge */
export const UNLOCK_ORDER: MediumId[] = ['mask', 'gran', 'tape', 'waterbrush'];
/** Zu Beginn dieser Runden gibt es eine neue Wahl (nach Runde 2 und 4) */
export const MEDIA_ROUNDS = [3, 5];
export const MEDIA_MAX = 3;
/** So wählt der Rivale (und Sepia schlägt vor): das Erste aus dieser Liste, das im Angebot ist */
export const MEDIA_PREF: MediumId[] = ['sponge', 'irid', 'salt', 'gum', 'retarder', 'oxgall', 'waterbrush', 'mask', 'gran', 'tape'];
