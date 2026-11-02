/*
 * Flairs auf den eigenen Posts der App (Spiel-Post, Tagespost, Benennen-Post). Die IDs legt „set up the community“
 * an (community.ts). Eigene Datei ohne weitere Abhängigkeiten, damit play, bleach und naming sie ohne Kreis laden.
 */
import type { Deps } from './core';
import { K } from './keys';

export type FlairKey = 'play' | 'sheet' | 'name' | 'discussion' | 'feedback' | 'bug';

/** Flair setzen, sobald die Einrichtung gelaufen ist. false, wenn es noch kein Flair gibt oder Reddit ablehnt */
export async function flairPost(d: Pick<Deps, 'redis' | 'reddit' | 'subredditName'>, postId: string, key: FlairKey): Promise<boolean> {
  const id = await d.redis.hGet(K.communityFlair, key);
  if (!id || !d.reddit.setPostFlair) return false;
  try {
    await d.reddit.setPostFlair({ subredditName: d.subredditName, postId: postId as `t3_${string}`, flairTemplateId: id });
    return true;
  } catch (e) {
    console.error('flair', key, postId, e);
    return false;
  }
}
