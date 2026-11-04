/*
 * Gelöschte Konten (Devvit-Regeln, docs/entwuerfe/release-plan.md Schritt 1b): Wird ein Reddit-Konto gelöscht, müssen seine
 * ID und sein Name aus allen Daten verschwinden. Devvit Web meldet das nicht, also fragt ein täglicher Auftrag reihum bei
 * Reddit nach. Reddit meldet gesperrte Konten genauso wie gelöschte („nicht gefunden“), deshalb wird erst bereinigt, wenn ein
 * Konto GONE.confirmDays Tage am Stück fehlt. Taucht es wieder auf, beginnt die Frist neu.
 *
 * Bereinigt wird in Schritten, weil es viele Daten sind:
 *  own      eigene Schlüssel und Einträge (Spielstand, Duelle, Galerie, Markt, Angebote, Ranglisten, Zeichnungen, alte Fänge)
 *  globals  gemeinsame Sammlungen (Register, Archiv, Markt, Angebote, Meldungen, Benennen, Bestiary, Tagesblätter)
 *  players  die Daten aller anderen Spieler, in Stücken (Herkunft auf Würfeln, Nachrichten, Lieferungen, Duelle, Galerie)
 * Die ID wird zu „gone“, der Name zu „a painter“. Ausgewaschene Würfel des Kontos bleiben als namenlose Gegner im Archiv,
 * ohne seine Zeichnung (Inhalt des Spielers).
 */
import { withLock, type Deps } from './core';
import { playerLock } from './dice';
import { K } from './keys';
import { marketForget } from './market';

const DAY = 86_400_000;
export const GONE = {
  /** so viele Spieler fragt ein Lauf bei Reddit nach */
  batch: 100,
  /** so lange muss ein Konto am Stück fehlen (gesperrte Konten sehen für Devvit aus wie gelöschte) */
  confirmDays: 21,
  /** so viele andere Spieler sieht ein Lauf beim Bereinigen durch */
  chunk: 150,
  /** so viele Stücke je Lauf, danach geht es eine Minute später weiter */
  budget: 4,
};
export const GONE_NAME = 'a painter';
/** Name des Scheduler-Auftrags, der eine angefangene Bereinigung fortsetzt (devvit.json) */
export const PURGE_JOB = 'account-purge';

type Step = 'own' | 'globals' | 'players';
export type PurgeState = { name: string; step: Step; cursor: number; retry: string[] };

const parse = <T>(raw: string | undefined | null): T | null => (raw ? (JSON.parse(raw) as T) : null);

/* ---------- Text bereinigen ---------- */

/*
 * Namen nur dort ersetzen, wo wirklich ein Name steht (QA 02.11.2026): in Feldern, die Namen tragen, und als u/Name in
 * Sätzen (ganzes Wort). Sonst würde das Konto „sepia“ oder „ultra“ Pigmente, Farben und Stile anderer Spieler umschreiben.
 * Erfundene Test-Maler („Test Inkwell“) sind keine Reddit-Namen und kommen auch ohne u/ in Sätzen vor: die werden überall ersetzt.
 */
const NAME_KEYS = ['u', 'name', 'user', 'by', 'seller', 'fromName', 'toName', 'namedBy', 'foundBy', 'who'];
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const redditName = (n: string): boolean => /^[\w-]+$/.test(n);
function namePatterns(name: string): RegExp[] {
  const e = esc(JSON.stringify(name).slice(1, -1));
  const out = [new RegExp(`"(${NAME_KEYS.join('|')})":"${e}"`, 'g'), new RegExp(`u/${e}(?![\\w-])`, 'g')];
  if (!redditName(name)) out.push(new RegExp(e, 'g'));
  return out;
}
/** Kommt das Konto in diesem Text vor (ID oder Name)? */
export function mentions(raw: string, uid: string, name: string): boolean {
  return raw.includes(uid) || (!!name && namePatterns(name).some((r) => r.test(raw)));
}
/** ID und Name in einem JSON-Text ersetzen (Namensfelder und u/Name in Sätzen, damit die Struktur bleibt) */
export function scrub(raw: string, uid: string, name: string): string {
  let s = raw;
  if (name) {
    const [keyed, tagged, plain] = namePatterns(name);
    s = s.replace(keyed!, `"$1":"${GONE_NAME}"`).replace(tagged!, GONE_NAME);
    if (plain) s = s.replace(plain, GONE_NAME);
  }
  return s.split(`"${uid}"`).join('"gone"').split(`"${uid}:`).join('"gone:').split(`:${uid}:`).join(':gone:');
}

/* ---------- Prüfen ---------- */

/**
 * Täglicher Auftrag: die nächsten GONE.batch Spieler bei Reddit nachfragen, Fehlende merken, nach der Frist bereinigen.
 * Danach wird eine angefangene Bereinigung fortgesetzt
 */
export async function accountCheck(d: Deps): Promise<{ checked: number; missing: number; queued: string[]; purged: string[] }> {
  const out = { checked: 0, missing: 0, queued: [] as string[], purged: [] as string[] };
  const lookup = d.reddit.getUserById;
  if (lookup) {
    const total = await d.redis.zCard(K.dicePlayers);
    let cursor = Number(await d.redis.get(K.accountCursor)) || 0;
    if (cursor >= total) cursor = 0;
    const batch = await d.redis.zRange(K.dicePlayers, cursor, cursor + GONE.batch - 1, { by: 'rank' });
    for (const { member: uid } of batch) {
      if (!uid.startsWith('t2_')) continue;
      let user: unknown;
      try {
        user = await lookup.call(d.reddit, uid as `t2_${string}`);
      } catch (e) {
        // Fehler bei Reddit zählen nicht als fehlend
        console.error('account check', uid, e);
        continue;
      }
      out.checked++;
      if (user) {
        await d.redis.hDel(K.accountMiss, [uid]);
        continue;
      }
      out.missing++;
      const since = Number(await d.redis.hGet(K.accountMiss, uid));
      if (!since) await d.redis.hSet(K.accountMiss, { [uid]: String(d.now) });
      else if (d.now - since >= GONE.confirmDays * DAY) {
        await queuePurge(d, uid);
        out.queued.push(uid);
      }
    }
    await d.redis.set(K.accountCursor, String(cursor + GONE.batch >= total ? 0 : cursor + GONE.batch));
  }
  out.purged = await purgeRun(d);
  return out;
}

/** Ein Konto zum Bereinigen vormerken (auch für Tests und Mods) */
export async function queuePurge(d: Pick<Deps, 'redis'>, uid: string): Promise<void> {
  const name = (await d.redis.hGet(K.nameOf, uid)) ?? '';
  const state: PurgeState = { name, step: 'own', cursor: 0, retry: [] };
  await d.redis.hSet(K.purgeQueue, { [uid]: JSON.stringify(state) });
  await d.redis.hDel(K.accountMiss, [uid]);
}

/** Angefangene Bereinigungen fortsetzen, höchstens GONE.budget Stücke. Fertige Konten zurück, Rest läuft eine Minute später weiter */
export async function purgeRun(d: Deps): Promise<string[]> {
  const done: string[] = [];
  let budget = GONE.budget;
  for (const [uid, raw] of Object.entries(await d.redis.hGetAll(K.purgeQueue))) {
    const st = parse<PurgeState>(raw)!;
    while (budget > 0) {
      budget--;
      const finished = await purgeStep(d, uid, st);
      if (finished) break;
    }
    if (st.step === 'players' && st.cursor < 0) {
      await d.redis.hDel(K.purgeQueue, [uid]);
      console.log('account purged', uid);
      done.push(uid);
    } else await d.redis.hSet(K.purgeQueue, { [uid]: JSON.stringify(st) });
    if (budget <= 0) break;
  }
  if ((await d.redis.hLen(K.purgeQueue)) > 0) await d.schedule?.(PURGE_JOB, new Date(d.now + 60_000), {});
  return done;
}

/** Ein Stück Arbeit. true, wenn das Konto ganz fertig ist (dann steht cursor auf -1) */
async function purgeStep(d: Deps, uid: string, st: PurgeState): Promise<boolean> {
  if (st.step === 'own') {
    await purgeOwn(d, uid, st.name);
    st.step = 'globals';
    return false;
  }
  if (st.step === 'globals') {
    await purgeGlobals(d, uid, st.name);
    // Feste Liste der Spieler, die noch dran sind (die Rangfolge in dice:players verschiebt sich bei jedem Speichern)
    await d.redis.del(K.purgeTodo(uid));
    const all = (await d.redis.zRange(K.dicePlayers, 0, -1, { by: 'rank' })).map((x) => x.member).filter((x) => x !== uid);
    for (let i = 0; i < all.length; i += 500) await d.redis.zAdd(K.purgeTodo(uid), ...all.slice(i, i + 500).map((member, k) => ({ member, score: i + k })));
    st.step = 'players';
    st.cursor = 0;
    return false;
  }
  if (st.cursor < 0) return true;
  st.cursor = await purgePlayers(d, uid, st);
  return st.cursor < 0;
}

/* ---------- own: alles, was nur diesem Spieler gehört ---------- */

async function purgeOwn(d: Deps, uid: string, name: string): Promise<void> {
  await marketForget(d, uid);
  // Ranglisten und Ergebnisse der Tagesblätter
  for (const { member: day } of await d.redis.zRange(K.bleachDays, 0, -1, { by: 'rank' })) {
    await d.redis.zRem(K.bleachBoard(day), [uid]);
    await d.redis.hDel(K.bleachRes(day), [uid]);
  }
  // Zeichnungen: Prüfliste, Freigaben, Protokoll, Meldungen, Sperre
  for (const h of [K.drawnQueue, K.drawnOk, K.drawnWashed, K.drawnReports]) {
    const mine = Object.keys(await d.redis.hGetAll(h)).filter((k) => k.startsWith(`${uid}:`));
    if (mine.length) await d.redis.hDel(h, mine);
  }
  await d.redis.hDel(K.drawnStrikes, [uid]);
  const paid = Object.keys(await d.redis.hGetAll(K.namingPaid)).filter((k) => k.endsWith(`:${uid}`));
  if (paid.length) await d.redis.hDel(K.namingPaid, paid);
  await d.redis.hDel(K.galleryRecord, [`${uid}:w`, `${uid}:l`, `${uid}:d`]);
  if (name && (await d.redis.hGet(K.names, name.toLowerCase())) === uid) await d.redis.hDel(K.names, [name.toLowerCase()]);
  await d.redis.hDel(K.nameOf, [uid]);
  // Alte Fänge aus der Zeit des Tagesklecks
  for (const { member: id } of await d.redis.zRange(K.userMonsters(uid), 0, -1, { by: 'rank' })) await d.redis.del(K.monster(id));
  for (const { member: day } of await d.redis.zRange(K.days, 0, -1, { by: 'rank' })) await d.redis.hDel(K.dayCatchers(day), [uid]);
  for (const z of [K.dicePlayers, K.duelPlayers, K.bleachPlayers, K.galleryPower, K.streakFlair]) await d.redis.zRem(z, [uid]);
  await d.redis.del(K.dice(uid), K.duel(uid), K.gallery(uid), K.galleryMe(uid), K.galleryInbox(uid), K.deliver(uid), K.bleachRun(uid), K.userMonsters(uid));
}

/* ---------- globals: gemeinsame Sammlungen ---------- */

/** Alle Felder eines Hashs, in denen das Konto vorkommt, bereinigt zurückschreiben */
async function scrubHash(d: Pick<Deps, 'redis'>, key: string, uid: string, name: string, fix?: (raw: string, field: string) => string): Promise<number> {
  const changed: Record<string, string> = {};
  for (const [f, raw] of Object.entries(await d.redis.hGetAll(key))) {
    if (!mentions(raw, uid, name) && !(name && raw === name)) continue;
    const next = fix ? fix(raw, f) : scrub(raw, uid, name);
    if (next !== raw) changed[f] = next;
  }
  if (Object.keys(changed).length) await d.redis.hSet(key, changed);
  return Object.keys(changed).length;
}
/** Einzelne JSON-Schlüssel bereinigen */
async function scrubKeys(d: Pick<Deps, 'redis'>, keys: string[], uid: string, name: string): Promise<void> {
  for (let i = 0; i < keys.length; i += 100) {
    const part = keys.slice(i, i + 100);
    const vals = await d.redis.mGet(part);
    for (let k = 0; k < part.length; k++) {
      const raw = vals[k];
      if (raw && mentions(raw, uid, name)) await d.redis.set(part[k]!, scrub(raw, uid, name));
    }
  }
}

async function purgeGlobals(d: Deps, uid: string, name: string): Promise<void> {
  // Register: der Seed bleibt belegt (jedes Monster nur einmal), aber ohne Spieler
  await scrubHash(d, K.seeds, uid, name, (raw) => (raw.startsWith(`${uid}:`) || raw.startsWith(`recycled:${uid}:`) ? 'gone' : raw));
  // Archiv: ausgewaschene Würfel bleiben als namenlose Gegner, ohne Zeichnung
  await scrubHash(d, K.recycled, uid, name, (raw) => {
    const rec = JSON.parse(raw) as { from: string; name?: string; die: { draw?: unknown } };
    if (rec.from === uid) {
      rec.from = 'gone';
      delete rec.name;
      delete rec.die.draw;
    }
    return scrub(JSON.stringify(rec), uid, name);
  });
  // Fremde Markt-Einträge und Angebote (Herkunft auf den Würfeln, Namen im Angebot)
  await scrubHash(d, K.market, uid, name);
  await scrubHash(d, K.trades, uid, name);
  // Meldungen anderer Zeichnungen, die dieser Spieler gemacht hat, und gemeldete Zeichnungen in der Prüfliste
  await scrubHash(d, K.drawnReports, uid, name);
  await scrubHash(d, K.drawnQueue, uid, name);
  await scrubHash(d, K.drawnOk, uid, name);
  await scrubHash(d, K.drawnWashed, uid, name);
  await scrubHash(d, K.drawnOver, uid, name);
  // Benennen und Bestiary
  const posts = (await d.redis.zRange(K.namingPosts, 0, -1, { by: 'rank' })).map((x) => K.naming(x.member));
  await scrubKeys(d, posts, uid, name);
  if (name)
    for (const { member } of await d.redis.zRange(K.speciesIndex, 0, -1, { by: 'rank' })) {
      const h = await d.redis.hGetAll(K.species(member));
      const fix: Record<string, string> = {};
      if (h.foundBy === name) fix.foundBy = GONE_NAME;
      if (h.namedBy === name) fix.namedBy = GONE_NAME;
      if (Object.keys(fix).length) await d.redis.hSet(K.species(member), fix);
    }
  // Tagesblätter: Pales aus dem Archiv tragen den Namen dessen, der sie ausgewaschen hat
  const days = (await d.redis.zRange(K.bleachDays, 0, -1, { by: 'rank' })).map((x) => K.bleachDay(x.member));
  await scrubKeys(d, days, uid, name);
}

/* ---------- players: Daten aller anderen Spieler, in Stücken ---------- */

/** Ein Stück der festen Spielerliste. Gibt den nächsten Stand zurück, -1 wenn fertig */
async function purgePlayers(d: Deps, uid: string, st: PurgeState): Promise<number> {
  const part = (await d.redis.zRange(K.purgeTodo(uid), 0, GONE.chunk - 1, { by: 'rank' })).map((x) => x.member);
  // Am Ende: die, deren Sperre beim ersten Mal belegt war, noch einmal
  const list = part.length ? part : st.retry.splice(0);
  for (const x of list) {
    if (x === uid) continue;
    if (!(await scrubPlayer(d, x, uid, st.name))) st.retry.push(x);
  }
  if (part.length) {
    await d.redis.zRem(K.purgeTodo(uid), part);
    return st.cursor + part.length;
  }
  if (st.retry.length) return st.cursor;
  await d.redis.del(K.purgeTodo(uid));
  return -1;
}

/** Die Daten eines anderen Spielers bereinigen. false, wenn er gerade beschäftigt ist (dann später) */
async function scrubPlayer(d: Deps, x: string, uid: string, name: string): Promise<boolean> {
  // Ohne Sperre: Galerie-Abzug und Galerie-Stand (gegen wen er heute schon gespielt hat)
  await scrubKeys(d, [K.gallery(x), K.galleryMe(x)], uid, name);
  await scrubHash(d, K.galleryInbox(x), uid, name, (raw) => (raw === name ? GONE_NAME : scrub(raw, uid, name)));
  await scrubHash(d, K.deliver(x), uid, name);
  // Unter seiner Sperre: Sammlung (Herkunft, Nachrichten), laufendes Duell und Tagesblatt
  const keys = [K.dice(x), K.duel(x), K.bleachRun(x)];
  const vals = await d.redis.mGet(keys);
  if (!vals.some((v) => v && mentions(v, uid, name))) return true;
  try {
    await withLock(d, playerLock(x), async () => {
      const again = await d.redis.mGet(keys);
      for (let k = 0; k < keys.length; k++) {
        const raw = again[k];
        if (raw && mentions(raw, uid, name)) await d.redis.set(keys[k]!, scrub(raw, uid, name));
      }
    });
    return true;
  } catch {
    return false;
  }
}
