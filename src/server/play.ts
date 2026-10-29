/*
 * Der Spiel-Post: ein fester Post fürs Duell und die Würfelsammlung, unabhängig vom Tagesklecks.
 * Wird einmal angelegt (bei Installation oder Update) und angepinnt. Das Mod-Menü legt bei Bedarf einen neuen an.
 */
import type { PlayInfo } from '../shared/api';
import { dayKey } from '../shared/day';
import type { Deps } from './core';
import { loadDice } from './dice';
import { K } from './keys';

export const PLAY_TITLE = 'Paint duel: every blot is a die';

export async function ensurePlayPost(d: Deps, force = false): Promise<{ postId: string; url: string | null; created: boolean }> {
  const existing = await d.redis.get(K.playPost);
  if (existing && !force) return { postId: existing, url: null, created: false };
  const post = await d.reddit.submitCustomPost({
    subredditName: d.subredditName,
    title: PLAY_TITLE,
    entry: 'play',
    postData: { kind: 'play' },
    textFallback: { text: 'A watercolor dice duel. Open this post in the Reddit app or on reddit.com to play.' },
  });
  await d.redis.set(K.playPost, post.id);
  // Anpinnen, damit man den Post findet. Scheitert das (keine Rechte), bleibt der Post trotzdem.
  try {
    await (await d.reddit.getPostById(post.id as `t3_${string}`)).sticky();
  } catch (e) {
    console.error('sticky play post', e);
  }
  console.log('Play post', post.id, post.url);
  return { postId: post.id, url: post.url, created: true };
}

/** Stand für das Startbild: läuft ein Duell, gibt es freie Züge */
export async function playInfo(d: Deps, userId: string | undefined): Promise<PlayInfo> {
  if (!userId) return { user: false, running: false, starter: 0, freeReady: false, pigment: 0 };
  const [s, raw] = await Promise.all([loadDice(d, userId), d.redis.get(K.duel(userId))]);
  const saved = raw ? (JSON.parse(raw) as { over?: boolean; v?: number }) : null;
  const running = !!saved && saved.v === 3 && !saved.over;
  return { user: true, running, starter: s.starter, freeReady: s.freeDay !== dayKey(d.now), pigment: s.pigment };
}
