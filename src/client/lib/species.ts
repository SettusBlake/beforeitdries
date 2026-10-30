/* Namen der Arten (aus den „What do you see?“-Posts) und welche gerade benannt werden. Einmal geladen, überall genutzt */
import type { SpeciesResponse } from '../../shared/api';
import { speciesKey, type Monster } from '../../shared/monster';
import { api } from './api';

let data: SpeciesResponse = { names: {}, open: {} };
type Sp = Pick<Monster, 'bp' | 'main'>;

/** Neu holen. Fehler sind egal: dann bleiben die Namen vom letzten Mal */
export async function loadSpecies(): Promise<void> {
  try {
    data = await api.species();
  } catch {
    /* ohne Netz: alte Namen */
  }
}
/** Name der Art, null solange sie keinen hat */
export const speciesName = (m: Sp): string | null => data.names[speciesKey(m)]?.name ?? null;
export const speciesNamedBy = (m: Sp): string | null => data.names[speciesKey(m)]?.namedBy ?? null;
/** Post, der die Art gerade benennt, sonst null */
export const namingPost = (m: Sp): string | null => data.open[speciesKey(m)] ?? null;
