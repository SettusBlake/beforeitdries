/*
 * Einstieg E1 als Artifact (freigegeben am 06.11.2026, docs/entwuerfe/einstieg-vorschlag.md). Die Lektion selbst steht in
 * src/client/duel/firststeps.ts (dieselbe Quelle wie im Spiel), hier nur die Seite drumherum.
 * Baut zu einer Seite: node tools/mockup/einstieg/build.mjs <ziel.html>
 */
import { mountFirstSteps } from '../../../src/client/duel/firststeps';

const root = document.getElementById('app')!;
const note = document.getElementById('startnote')!;
const fs = mountFirstSteps(root, {
  finish: async () => ({ line: 'Six dice, three rounds, the Apprentice. New rules arrive one duel at a time.', button: 'Start duel' }),
  go: () => (note.hidden = false),
});
/* Für den Testlauf */
Object.assign(window, { __e1: fs.probe });
