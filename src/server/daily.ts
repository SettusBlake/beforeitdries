/*
 * Tägliche Aktivität (freigegeben am 04.11.2026, docs/entwuerfe/taegliche-aktivitaet-vorschlag.md, T1 und T2).
 * T1 Beitreten: nach dem ersten und fünften Ergebnis (Duell oder Tagesblatt) ein Knopf, nur auf Tipp (User Action).
 * Ob jemand schon Mitglied ist, verrät Reddit nicht: wir merken uns den Tipp und fragen höchstens zweimal.
 * T2 Strähne als User-Flair: nur mit Schalter (Standard aus). Die vorige Flair kommt beim Ausschalten zurück,
 * eine getrocknete Strähne nimmt die Flair beim nächsten Tagesblatt-Auftrag wieder ab.
 */
import type { DiceSave } from '../shared/dice';
import { dayKey } from '../shared/day';
import { isStreakFlair, streakFlairText, streakNow } from '../shared/streak';
import { GameError, withLock, type Deps } from './core';
import { loadDice, needUser, playerLock, respond, saveDice } from './dice';
import { K } from './keys';

/** Beim wievielten Ergebnis wir fragen (Duelle ohne Lern-Duell plus Wertungsläufe) */
export const JOIN_AT = [1, 5];
const dayNum = (day: string): number => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);

/** Ergebnis fertig (s schon mitgezählt): Beitreten anbieten? Zählt die Frage mit, speichern muss der Aufrufer */
export function askJoin(d: Pick<Deps, 'subredditName'>, s: DiceSave): string | undefined {
  if (s.joined) return undefined;
  const asked = s.joinAsked ?? 0;
  const at = JOIN_AT[asked];
  if (at === undefined || (s.duels ?? 0) + (s.sheets ?? 0) < at) return undefined;
  s.joinAsked = asked + 1;
  return d.subredditName;
}

/** „Join r/…“ getippt: tritt im Namen des Spielers bei (User Action SUBSCRIBE_TO_SUBREDDIT) */
export async function joinSub(d: Deps, userId: string | undefined): Promise<{ ok: true; sub: string }> {
  const uid = needUser(userId);
  if (!d.reddit.subscribeToCurrentSubreddit) throw new GameError('server', 'Joining is not available here.', 501);
  try {
    await d.reddit.subscribeToCurrentSubreddit();
  } catch (e) {
    console.error('join', e);
    throw new GameError('server', 'Reddit did not take it. Try again in a moment.', 502);
  }
  await withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    s.joined = true;
    await saveDice(d, uid, s);
  });
  return { ok: true, sub: d.subredditName };
}

/** Aktuelle Flair des Spielers im Subreddit (für das Zurücksetzen beim Ausschalten) */
async function currentFlair(d: Deps, username: string): Promise<string | undefined> {
  try {
    const sub = await d.reddit.getSubredditByName?.(d.subredditName);
    const r = await sub?.getUserFlair({ usernames: [username] });
    const text = r?.users.find((u) => (u.user ?? '').toLowerCase() === username.toLowerCase())?.flairText;
    return text || undefined;
  } catch (e) {
    console.error('get flair', e);
    return undefined;
  }
}
/** Flair setzen oder (n = 0) auf die vorige zurück. Fehler nur ins Log, das Spiel läuft weiter */
async function showFlair(d: Deps, user: string, n: number, was: string | undefined): Promise<boolean> {
  try {
    if (n > 0) await d.reddit.setUserFlair?.({ subredditName: d.subredditName, username: user, text: streakFlairText(n) });
    else if (was) await d.reddit.setUserFlair?.({ subredditName: d.subredditName, username: user, text: was });
    else await d.reddit.removeUserFlair?.(d.subredditName, user);
    return true;
  } catch (e) {
    console.error('set flair', user, e);
    return false;
  }
}

/** Nach einem Wertungslauf (in der Spielersperre, vor dem Speichern): Flair auf die neue Zahl */
export async function streakFlairPaint(d: Deps, uid: string, s: DiceSave): Promise<void> {
  const f = s.streakFlair;
  const n = s.streak?.n ?? 0;
  if (!f || !s.streak) return;
  await d.redis.zAdd(K.streakFlair, { member: uid, score: dayNum(s.streak.last) });
  if (f.shown === n) return;
  if (await showFlair(d, f.user, n, f.was)) f.shown = n;
}

/** Schalter im Menü: Strähne als Flair ein oder aus */
export async function streakFlairToggle(d: Deps, userId: string | undefined, username: string | undefined, on: unknown) {
  const uid = needUser(userId);
  if (!username) throw new GameError('login', 'Log in to show your streak.', 401);
  if (on === true && !d.reddit.setUserFlair) throw new GameError('server', 'Flairs are not available here.', 501);
  const s = await withLock(d, playerLock(uid), async () => {
    const t = await loadDice(d, uid);
    const now = streakNow(t.streak, dayKey(d.now));
    if (on === true && !t.streakFlair) {
      const cur = await currentFlair(d, username);
      t.streakFlair = { user: username, ...(cur && !isStreakFlair(cur) ? { was: cur } : {}) };
      if (now.n > 0 && (await showFlair(d, username, now.n, undefined))) t.streakFlair.shown = now.n;
      if (t.streak) await d.redis.zAdd(K.streakFlair, { member: uid, score: dayNum(t.streak.last) });
    } else if (on !== true && t.streakFlair) {
      const f = t.streakFlair;
      if (f.shown) await showFlair(d, f.user, 0, f.was);
      delete t.streakFlair;
      await d.redis.zRem(K.streakFlair, [uid]);
    }
    await saveDice(d, uid, t);
    return t;
  });
  return respond(d, s);
}

/** Täglich (Auftrag daily-sheet): getrocknete Strähnen nehmen die Flair wieder ab. Höchstens max Spieler je Lauf */
export async function streakFlairSweep(d: Deps, max = 200): Promise<number> {
  const today = dayKey(d.now);
  // Gestern verpasst kann der Retarder noch halten: erst ab zwei Tagen ohne Blatt nachsehen
  const old = await d.redis.zRange(K.streakFlair, 0, dayNum(today) - 2, { by: 'score' });
  let n = 0;
  for (const m of old.slice(0, max)) {
    await withLock(d, playerLock(m.member), async () => {
      const s = await loadDice(d, m.member);
      const f = s.streakFlair;
      const st = streakNow(s.streak, today);
      if (!f) {
        await d.redis.zRem(K.streakFlair, [m.member]);
        return;
      }
      if (st.state !== 'dry') return;
      if (f.shown && (await showFlair(d, f.user, 0, f.was))) {
        delete f.shown;
        n++;
      }
      await d.redis.zRem(K.streakFlair, [m.member]);
      await saveDice(d, m.member, s);
    });
  }
  return n;
}
