/*
 * Löschpflichten (Devvit-Regeln, docs/entwuerfe/release-plan.md): wird ein Post oder Kommentar gelöscht oder entfernt,
 * verschwinden seine Inhalte auch hier. Nur IDs als Zuordnung dürfen bleiben. Beide Wege sind wiederholbar (ein Mod-Entfernen
 * kann zusätzlich als Mod-Aktion kommen).
 */
import type { Deps } from './core';
import { sheetPostGone, sheetThreadGone } from './bleach';
import { K } from './keys';
import { nameCommentGone, namingPostGone } from './naming';

export async function postGone(d: Pick<Deps, 'redis'>, postId: unknown): Promise<string[]> {
  if (typeof postId !== 'string' || !postId.startsWith('t3_')) return [];
  const done: string[] = [];
  if (await namingPostGone(d, postId)) done.push('naming');
  if (await sheetPostGone(d, postId)) done.push('sheet');
  // Spiel-Post: beim nächsten Update kommt ein neuer (oder über das Mod-Menü)
  if ((await d.redis.get(K.playPost)) === postId) {
    await d.redis.del(K.playPost);
    done.push('play');
  }
  return done;
}

export async function commentGone(d: Pick<Deps, 'redis' | 'reddit'>, commentId: unknown, postId: unknown): Promise<string[]> {
  if (typeof commentId !== 'string' || typeof postId !== 'string') return [];
  const done: string[] = [];
  const key = await nameCommentGone(d, commentId, postId);
  if (key) done.push(`species ${key} open again`);
  if (await sheetThreadGone(d, commentId, postId)) done.push('share thread');
  return done;
}
