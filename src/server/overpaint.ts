/*
 * Übermalte Zeichnungen (QA 02.11.2026): Ein Mod übermalt eine Zeichnung, der Würfel kann da aber schon woanders sein
 * (verkauft, getauscht, im Markt, in einem Angebot, in einer Lieferung, im Benennen-Post, im Archiv). Darum merkt sich der
 * Server den Seed des Monsters. Wo ein Würfel mit diesem Seed auftaucht, fällt die Zeichnung weg, er zeigt die zufällige
 * Form aus seinem Seed. Eigene Datei ohne weitere Abhängigkeiten, damit market, gallery und drawings sie ohne Kreis laden.
 */
import type { DieRec } from '../shared/dice';
import { monsterSeed } from '../shared/monster';
import type { Deps } from './core';
import { K } from './keys';

/** Seed eines Würfels als Text, wie im Register `seeds` und im Archiv */
export const dieSeed = (x: Pick<DieRec, 'sheet' | 'idx'>): string => String(monsterSeed(x.sheet, x.idx));

/** Wurde die Zeichnung dieses Würfels übermalt? */
export async function paintedOver(d: Pick<Deps, 'redis'>, x: DieRec): Promise<boolean> {
  return !!x.draw && !!(await d.redis.hGet(K.drawnOver, dieSeed(x)));
}
