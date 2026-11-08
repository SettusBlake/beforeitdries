/*
 * Bleach am Server (freigegeben am 02.11.2026, docs/entwuerfe/bleach-plan.md): das Tagesblatt.
 * Ein Aufbau je Tag (UTC) für alle: Seed, Sepias Tagesdeck, die Pales (aus dem Archiv, sonst aus dem Seed), die Tagesfarbe.
 * Ein Wertungslauf je Spieler und Tag, Punkte nur vom Server, Rangliste je Tag. Wie im Duell: Laden, Aktion und
 * Speichern laufen ohne await dazwischen.
 */
import type { BleachInfo, BleachResult, DuelResponse, SheetResponse, SheetRow, ShareSheetResponse } from '../shared/api';
import { BLEACH, bleachScore, newBleach, sheetCode, type BleachScore } from '../shared/duel/bleach';
import { DuelError, loadState, openBleach, perform, publicState, saveState, type DuelAction, type DuelSave } from '../shared/duel/play';
import { drain, HEARTS, S } from '../shared/duel/rules';
import { dayLabel, shareText } from '../shared/sheet';
import type { ColorId } from '../shared/colors';
import { dieMonster, isGilded, rarityDef, type DieRec, type FaceMod, type Rarity } from '../shared/dice';
import { PIGMENTS, type PigmentId } from '../shared/data';
import { dayKey } from '../shared/day';
import { duelColors } from '../shared/colors';
import { RNG } from '../shared/rng';
import { GameError, withLock, type Deps } from './core';
import { isTester, loadDice, playerLock, saveDice, touch, weekCount, type Recycled } from './dice';
import { visibleDice } from './gallery';
import { flairPost } from './flair';
import { askJoin, streakFlairPaint } from './daily';
import { streakNow, streakPaint, streakReward } from '../shared/streak';
import { sheetRule } from '../shared/daily';
import { K } from './keys';

/** Ein Würfel im Tagesaufbau (genug, um Monster und Seiten daraus zu machen) */
type DieLite = Pick<DieRec, 'sheet' | 'idx' | 'paper' | 'gen' | 'draw' | 'style' | 'holo' | 'no'> & { mods: FaceMod[] };
/**
 * Aufbau eines Tages: für alle gleich, einmal angelegt. seed folgt aus dem Datum (Farbe, Pales, öffentlicher Seed),
 * secret ist ein Zufall nur am Server: daraus kommen die Würfe, damit sie niemand vorausrechnen kann (Testlauf 02.11.2026)
 */
export type BleachDay = { day: string; seed: number; secret?: number; colour: PigmentId; deck: DieLite[]; pales: { die: DieLite; name?: string }[] };
/** Ein laufender oder fertiger Lauf. res: Ergebnis eines fertigen Testlaufs (zum Teilen) */
type Run = { day: string; test?: true; save: string; res?: StoredRes };
/** Ergebnis in bleach:res:{Tag} (und beim Testlauf im Lauf selbst) */
type StoredRes = BleachResult & { name?: string; at?: number };

/** Sepias Tagesdeck: neun Würfel mit fester Mischung der Seltenheiten, damit jeder Tag ähnlich stark ist */
const DECK_RARITIES: Rarity[] = ['common', 'common', 'common', 'uncommon', 'uncommon', 'uncommon', 'rare', 'rare', 'epic'];
const parse = <T>(raw: string | undefined | null): T | null => (raw ? (JSON.parse(raw) as T) : null);
const freeze = (r: DuelResponse): DuelResponse => JSON.parse(JSON.stringify(r)) as DuelResponse;
const paleTotal = (): number => BLEACH.waves.reduce((a, b) => a + b, 0);
function needUser(userId: string | undefined): string {
  if (!userId) throw new GameError('login', 'Log in to paint today’s sheet.', 401);
  return userId;
}
/** Seed eines Tages aus dem Datum (FNV-1a) */
export function daySeed(day: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 0x01000193);
  return (h ^ 0xb1ea) >>> 0;
}
/** Tagesaufbau bauen: Deck und Farbe aus dem Seed, Pales aus dem Archiv (Zeichnungen nur mit Freigabe), Rest aus dem Seed */
async function buildDay(d: Deps, day: string, seed: number): Promise<BleachDay> {
  const r = RNG(seed);
  const deck: DieLite[] = DECK_RARITIES.map((k, i) => ({ sheet: `sepia:${day}`, idx: i + 1, paper: rarityDef(k).paper ?? 'hadern', gen: 2, mods: [] }));
  const colour = PIGMENTS[Math.floor(r() * PIGMENTS.length)]!.id;
  const pales: BleachDay['pales'] = [];
  const total = await d.redis.zCard(K.recycledAt);
  const seen = new Set<number>();
  for (let t = 0; t < paleTotal() * 3 && pales.length < paleTotal() && seen.size < total; t++) {
    const k = Math.floor(r() * total);
    if (seen.has(k)) continue;
    seen.add(k);
    const m = (await d.redis.zRange(K.recycledAt, k, k, { by: 'rank' }))[0];
    const rec = m ? parse<Recycled>(await d.redis.hGet(K.recycled, m.member)) : null;
    if (!rec) continue;
    const [die] = await visibleDice(d, rec.from, [rec.die]);
    const x = die!;
    pales.push({ die: { sheet: x.sheet, idx: x.idx, paper: x.paper, gen: x.gen, draw: x.draw, style: x.style, holo: x.holo, no: x.no, mods: x.mods ?? [] }, ...(rec.name ? { name: rec.name } : {}) });
  }
  for (let i = pales.length; i < paleTotal(); i++) pales.push({ die: { sheet: `pale:${day}`, idx: i + 1, gen: 2, mods: [] } });
  return { day, seed, secret: d.rand() >>> 0, colour, deck, pales };
}
/** Der Aufbau des Tages, beim ersten Lauf angelegt (unter einer Sperre, damit alle denselben bekommen) */
export async function bleachDay(d: Deps, day: string): Promise<BleachDay> {
  const have = parse<BleachDay>(await d.redis.get(K.bleachDay(day)));
  if (have && have.secret !== undefined) return have;
  return withLock(d, `lock:bleach:${day}`, async () => {
    const again = parse<BleachDay>(await d.redis.get(K.bleachDay(day)));
    // Ein Aufbau von vor dem 02.11.2026 bekommt sein Geheimnis nachträglich
    if (again && again.secret === undefined) {
      again.secret = d.rand() >>> 0;
      await d.redis.set(K.bleachDay(day), JSON.stringify(again));
    }
    if (again) return again;
    const built = await buildDay(d, day, daySeed(day));
    await d.redis.set(K.bleachDay(day), JSON.stringify(built));
    await d.redis.zAdd(K.bleachDays, { member: day, score: d.now });
    return built;
  });
}
/** Monster eines Würfels aus dem Aufbau */
const strip = (x: DieLite) => dieMonster(x);

/** Gespeicherter Lauf, nur nach den jetzigen Regeln (Stand 7) */
function runSave(run: Run | null): DuelSave | null {
  if (!run) return null;
  const s = JSON.parse(run.save) as DuelSave;
  return s.v === 7 && s.mode === 'bleach' ? s : null;
}
const unlockedFor = (s: { tutorialPaid: boolean; duels?: number }): boolean => s.tutorialPaid || (s.duels ?? 0) > 0;

/** Was das Startbild zeigt, dazu der laufende Stand zum Weiterspielen */
export async function bleachGet(d: Deps, userId: string | undefined, username?: string): Promise<BleachInfo & { state: DuelResponse['state'] }> {
  const uid = needUser(userId);
  const day = dayKey(d.now);
  const [dice, runRaw, res, players, topRaw, tester] = await Promise.all([
    loadDice(d, uid),
    d.redis.get(K.bleachRun(uid)),
    d.redis.hGet(K.bleachRes(day), uid),
    d.redis.zCard(K.bleachBoard(day)),
    d.redis.zRange(K.bleachBoard(day), 0, 4, { by: 'rank', reverse: true }),
    isTester(d, username),
  ]);
  const run = parse<Run>(runRaw);
  const save = runSave(run);
  const running = !!save && !save.over && (run!.day === day || !!run!.test);
  let state: DuelResponse['state'] = null;
  if (running) {
    loadState(save!);
    state = JSON.parse(JSON.stringify(publicState())) as DuelResponse['state'];
  }
  const played = parse<StoredRes>(res);
  const names = await Promise.all(topRaw.map((m) => d.redis.hGet(K.bleachRes(day), m.member)));
  const top = topRaw.map((m, i) => ({ name: parse<{ name?: string }>(names[i])?.name ?? 'a painter', points: Math.floor(m.score / 100000) }));
  const colour = parse<BleachDay>(await d.redis.get(K.bleachDay(day)))?.colour ?? PIGMENTS[daySeed(day) % PIGMENTS.length]!.id;
  return {
    day,
    colour,
    unlocked: unlockedFor(dice),
    running,
    played: played ? { ...played, rank: await rankOf(d, day, uid), players } : null,
    players,
    top,
    waves: BLEACH.waves.length,
    pales: paleTotal(),
    ...(tester ? { tester } : {}),
    streak: streakNow(dice.streak, day),
    ...(dice.streakFlair ? { flair: true } : {}),
    rule: sheetRule(day),
    state,
  };
}
async function rankOf(d: Deps, day: string, uid: string): Promise<number | undefined> {
  const mine = await d.redis.zScore(K.bleachBoard(day), uid);
  if (mine === undefined || mine === null) return undefined;
  const higher = await d.redis.zRange(K.bleachBoard(day), mine + 1, 1e12, { by: 'score' });
  return higher.length + 1;
}

/**
 * Tagesblatt starten oder weiterspielen. test: Playtest und Mod, ein anderes Blatt ohne Wertung (ersetzt einen laufenden Testlauf)
 */
export async function bleachStart(d: Deps, userId: string | undefined, username?: string, test = false): Promise<DuelResponse> {
  const uid = needUser(userId);
  if (test && !(await isTester(d, username))) throw new GameError('forbidden', 'Only for moderators in a playtest.', 403);
  return withLock(d, playerLock(uid), async () => {
    const dice = await loadDice(d, uid);
    if (!test && !unlockedFor(dice)) throw new GameError('bad_request', 'Finish the lesson duel with Master Sepia first.');
    const day = dayKey(d.now);
    const run = parse<Run>(await d.redis.get(K.bleachRun(uid)));
    const old = runSave(run);
    // Läuft schon: weiterspielen (ein Wertungslauf am Tag)
    if (!test && old && !old.over && run!.day === day && !run!.test) {
      loadState(old);
      return freeze({ state: publicState(), events: [] });
    }
    if (!test && (await d.redis.hGet(K.bleachRes(day), uid))) throw new GameError('bad_request', 'You painted today’s sheet. A new one comes at midnight UTC.');
    // Aufbau: der des Tages, im Test ein eigener aus einem anderen Seed (vor newBleach, danach kein await mehr)
    const setup = test ? await buildDay(d, `test-${d.rand()}`, d.rand()) : await bleachDay(d, day);
    newBleach({
      seed: (setup.seed ^ (setup.secret ?? 0)) >>> 0,
      paintSeed: (setup.seed ^ 0x5eed) >>> 0,
      day,
      colour: setup.colour,
      deck: setup.deck.map(strip),
      deckMods: setup.deck.map((x) => x.mods),
      pales: setup.pales.map((p) => strip(p.die)),
      paleMods: setup.pales.map((p) => p.die.mods),
      ranked: !test,
      // Tagesregel (T3): Wochentag, sonntags zweiter großer Pale und Punkte × 1,5, Malmittel des Tages. Testläufe mit der Regel von heute
      rule: sheetRule(day),
    });
    // Karten der Pales: wer sie ausgewaschen hat. Farben: deine, die Bleiche in Payne's Grey
    S.foeDice = setup.pales.map((p) => (p.name ? { drift: p.name, ...(p.die.no ? { no: p.die.no } : {}) } : null));
    S.colors = duelColors(dice.color, dice.color2, 'paynes');
    const events = [...drain(), ...openBleach()];
    const out = freeze({ state: publicState(), events });
    const next: Run = { day, save: saveState(), ...(test ? { test: true as const } : {}) };
    await d.redis.set(K.bleachRun(uid), JSON.stringify(next));
    await d.redis.zAdd(K.bleachPlayers, { member: uid, score: d.now });
    return out;
  });
}

/** Eine Aktion im Tagesblatt. Am Ende: Punkte, Rangliste und Belohnung (nur im Wertungslauf) */
export async function bleachAct(d: Deps, userId: string | undefined, action: unknown, username?: string): Promise<DuelResponse> {
  const uid = needUser(userId);
  if (!action || typeof action !== 'object' || typeof (action as { k?: unknown }).k !== 'string') throw new GameError('bad_request', 'Unknown action.');
  return withLock(d, playerLock(uid), async () => {
    const run = parse<Run>(await d.redis.get(K.bleachRun(uid)));
    const save = runSave(run);
    if (!run || !save) throw new GameError('not_found', 'No sheet running.', 404);
    loadState(save);
    const wasOver = S.over;
    let out: DuelResponse;
    try {
      const events = perform(action as DuelAction);
      out = freeze({ state: publicState(), events });
    } catch (e) {
      if (e instanceof DuelError) throw new GameError('bad_request', e.message);
      throw e;
    }
    const blob = saveState();
    // Endstand vor dem ersten await festhalten: danach kann ein anderer Lauf S belegen
    const fin: Final | null = !wasOver && S.over ? { score: bleachScore(), sheet: sheetCode(), col: S.colors[0], colour: S.bleach?.colour ?? 'ultra' } : null;
    // Über Mitternacht (UTC) fertig: zählt nicht mehr, die Rangliste des Tages ist zu (QA 02.11.2026)
    const late = !run.test && !!S.bleach?.ranked && run.day !== dayKey(d.now);
    const ranked = !run.test && !!S.bleach?.ranked && !late;
    const next: Run = { ...run, save: blob };
    if (fin && !ranked) next.res = { day: run.day, points: fin.score.total, parts: fin.score, ranked: false, sheet: fin.sheet, col: fin.col, ...(late ? { late: true as const } : {}) };
    await d.redis.set(K.bleachRun(uid), JSON.stringify(next));
    if (fin) out.bleach = ranked ? await finishRun(d, uid, username, run.day, fin, out) : next.res!;
    return out;
  });
}
/** Endstand eines Laufs, festgehalten vor dem ersten await */
type Final = { score: BleachScore; sheet: string; col: ColorId; colour: PigmentId };
/** Fertig: Ergebnis samt Blatt speichern, in die Rangliste, Belohnung. Nur innerhalb der Spielersperre, nur Wertungsläufe */
async function finishRun(d: Deps, uid: string, username: string | undefined, day: string, fin: Final, out: DuelResponse): Promise<BleachResult> {
  const score = fin.score;
  const res: BleachResult = { day, points: score.total, parts: score, ranked: true, sheet: fin.sheet, col: fin.col };
  // Gleichstand: wer früher fertig war, steht vorn (Sekunden seit Tagesbeginn)
  const sec = Math.floor((d.now - Date.parse(`${day}T00:00:00Z`)) / 1000);
  await d.redis.zAdd(K.bleachBoard(day), { member: uid, score: score.total * 100000 + Math.max(0, 99999 - Math.min(99999, sec)) });
  await d.redis.hSet(K.bleachRes(day), { [uid]: JSON.stringify({ ...res, name: username ?? '', at: d.now }) });
  res.rank = await rankOf(d, day, uid);
  res.players = await d.redis.zCard(K.bleachBoard(day));
  // Belohnung: Pigment und ein Tropfen der Tagesfarbe, dazu die Strähne (T2): ab 2 Tagen Pigment, alle 7 Tage ein Tropfen mehr
  const s = await loadDice(d, uid);
  const colour = fin.colour;
  const step = streakPaint(s.streak, day);
  s.streak = step.s;
  s.sheets = (s.sheets ?? 0) + 1;
  const bonus = streakReward(step.s.n);
  const drops = BLEACH.reward.drops + (bonus.drop ? 1 : 0);
  s.pigment += BLEACH.reward.pigment + bonus.pigment;
  s.drops = { ...s.drops, [colour]: (s.drops?.[colour] ?? 0) + drops };
  res.streak = { n: step.s.n, best: step.s.best, pigment: bonus.pigment, drop: bonus.drop, held: step.held, broke: step.broke };
  await streakFlairPaint(d, uid, s);
  const join = askJoin(d, s);
  touch(d, s);
  // Wochenziele (T11): fertiges Tagesblatt, ausgewaschene Pales (auch die großen), alle Herzen behalten, Tropfen
  const week = weekCount(d, s, { sheets: 1, pales: score.washed + score.boss, clean: score.hearts >= HEARTS ? 1 : 0, drops });
  await saveDice(d, uid, s);
  await d.redis.hSet(K.bleachRes(day), { [uid]: JSON.stringify({ ...res, name: username ?? '', at: d.now }) });
  out.reward = {
    pigment: BLEACH.reward.pigment,
    why: 'bleach',
    total: s.pigment,
    drops: Array.from({ length: drops }, () => ({ pig: colour, why: 'win' as const })),
    ...(join ? { join } : {}),
    ...(week.length ? { week } : {}),
  };
  return res;
}

/* ---------- Tagespost und Teilen (Schritt 3) ---------- */

/** Name des Scheduler-Auftrags (devvit.json): kurz nach Mitternacht UTC */
export const SHEET_JOB = 'daily-sheet';
export const sheetTitle = (day: string): string => `Today’s sheet · ${dayLabel(day)} · Hold the edge against the Bleach`;
/** Tagespost: ID, Link und der angeheftete Kommentar, unter den geteilte Blätter als Antwort kommen */
type PostRef = { id: string; url: string; thread?: string };
const THREAD_TEXT = '**Share your sheet here.** After your run, “Share as a comment” posts your sheet as a reply to this comment, from your own account. Only when you tap it. *Master Sepia*';

/** Angehefteter Kommentar der App im Tagespost (Regeln: geteilte Ergebnisse antworten darauf). Anheften braucht Mod-Rechte, sonst bleibt er lose */
async function openThread(d: Deps, postId: string): Promise<string | undefined> {
  try {
    const c = await d.reddit.submitComment({ id: postId as `t3_${string}`, text: THREAD_TEXT });
    try {
      await c.distinguish?.(true);
    } catch (e) {
      console.error('sticky share thread', e);
    }
    return c.id;
  } catch (e) {
    console.error('share thread', e);
    return undefined;
  }
}
/** Den angehefteten Kommentar nachholen (Posts von vor Schritt 1a, oder er wurde gelöscht) */
async function ensureThread(d: Deps, day: string): Promise<PostRef> {
  return withLock(d, `lock:bleach:post:${day}`, async () => {
    const ref = parse<PostRef>(await d.redis.get(K.bleachPost(day)))!;
    if (ref.thread) return ref;
    const thread = await openThread(d, ref.id);
    if (!thread) throw new GameError('server', 'Reddit did not take the comment. Try again in a moment.', 502);
    const next = { ...ref, thread };
    await d.redis.set(K.bleachPost(day), JSON.stringify(next));
    return next;
  });
}

/**
 * Tagespost anlegen, falls es für den Tag noch keinen gibt (Scheduler, Teilen). force: Mod-Menü, legt einen neuen an,
 * der dann der Post des Tages ist (ältere zeigen weiter dieselbe Rangliste)
 */
export async function ensureSheetPost(d: Deps, day: string = dayKey(d.now), force = false): Promise<PostRef & { created: boolean }> {
  const have = parse<PostRef>(await d.redis.get(K.bleachPost(day)));
  if (have && !force) return { ...have, created: false };
  return withLock(d, `lock:bleach:post:${day}`, async () => {
    const again = parse<PostRef>(await d.redis.get(K.bleachPost(day)));
    if (again && !force) return { ...again, created: false };
    // Aufbau vorher anlegen: Farbe und Pales stehen damit fest
    await bleachDay(d, day);
    const post = await d.reddit.submitCustomPost({
      subredditName: d.subredditName,
      title: sheetTitle(day),
      entry: 'sheet',
      postData: { kind: 'sheet', day },
      textFallback: { text: 'Today’s watercolour sheet: hold the edge against the Bleach. Open this post in the Reddit app or on reddit.com to play.' },
    });
    const thread = await openThread(d, post.id);
    await flairPost(d, post.id, 'sheet');
    const ref: PostRef = { id: post.id, url: post.url, ...(thread ? { thread } : {}) };
    await d.redis.set(K.bleachPost(day), JSON.stringify(ref));
    await d.redis.hSet(K.bleachPostDay, { [post.id]: day });
    console.log('Sheet post', day, post.id, post.url);
    return { ...ref, created: true };
  });
}

const rowOf = (rank: number, raw: string | undefined, score: number, me: boolean): SheetRow => {
  const r = parse<StoredRes>(raw);
  return {
    rank,
    name: r?.name || 'a painter',
    points: Math.floor(score / 100000),
    ...(r?.sheet ? { sheet: r.sheet } : {}),
    ...(r?.col ? { col: r.col } : {}),
    ...(r ? { hearts: r.parts.hearts } : {}),
    ...(me ? { me: true } : {}),
  };
};

/** Wie viele der Tagespost zeigt (ohne Scrollen, Regeln für Inline-Posts) und wie viele die volle Liste im Spiel */
export const SHEET_TOP = 6;
export const BOARD_MAX = 50;
/** Was der Tagespost zeigt: der Tag des Posts, die Besten mit Blättern, dein Platz, dein Stand. n: wie viele (höchstens 50) */
export async function sheetGet(d: Deps, userId: string | undefined, postId: string | undefined, n: number = SHEET_TOP): Promise<SheetResponse> {
  const top = Math.max(1, Math.min(BOARD_MAX, Math.floor(n) || SHEET_TOP));
  const today = dayKey(d.now);
  const day = (postId ? await d.redis.hGet(K.bleachPostDay, postId) : undefined) || today;
  const [players, topRaw, setup] = await Promise.all([
    d.redis.zCard(K.bleachBoard(day)),
    d.redis.zRange(K.bleachBoard(day), 0, top - 1, { by: 'rank', reverse: true }),
    d.redis.get(K.bleachDay(day)),
  ]);
  const raws = await Promise.all(topRaw.map((m) => d.redis.hGet(K.bleachRes(day), m.member)));
  const rows = topRaw.map((m, i) => rowOf(i + 1, raws[i], m.score, m.member === userId));
  let me: SheetRow | null = rows.find((r) => r.me) ?? null;
  let unlocked = false,
    running = false;
  if (userId) {
    const [dice, runRaw, mine, score] = await Promise.all([loadDice(d, userId), d.redis.get(K.bleachRun(userId)), d.redis.hGet(K.bleachRes(day), userId), d.redis.zScore(K.bleachBoard(day), userId)]);
    unlocked = unlockedFor(dice);
    const run = parse<Run>(runRaw);
    const save = runSave(run);
    running = !!save && !save.over && run!.day === today && !run!.test;
    if (!me && mine && score !== undefined && score !== null) me = rowOf((await rankOf(d, day, userId)) ?? players, mine, score, true);
    const st = streakNow(dice.streak, today);
    if (me && day === today && st.n >= 2) me.streak = st.n;
  }
  return {
    day,
    today: day === today,
    colour: parse<BleachDay>(setup)?.colour ?? PIGMENTS[daySeed(day) % PIGMENTS.length]!.id,
    players,
    top: rows,
    me,
    user: !!userId,
    unlocked,
    running,
    waves: [...BLEACH.waves],
    bossWave: BLEACH.bossWave,
    now: d.now,
    rule: sheetRule(day),
    ...(day === today && isGilded(d.now) ? { gilded: true } : {}),
  };
}

/**
 * „Share as a comment“: dein Blatt als Quadrate unter den Tagespost, im Namen des Spielers (runAs USER).
 * Nur auf ausdrücklichen Tipp, höchstens einmal am Tag. test: Testlauf (Playtest, nur Mods), einmal je Testlauf
 */
export async function bleachShare(d: Deps, userId: string | undefined, username?: string, test = false): Promise<ShareSheetResponse> {
  const uid = needUser(userId);
  if (test && !(await isTester(d, username))) throw new GameError('forbidden', 'Only for moderators in a playtest.', 403);
  return withLock(d, playerLock(uid), async () => {
    const day = dayKey(d.now);
    const run = parse<Run>(await d.redis.get(K.bleachRun(uid)));
    const res: StoredRes | null = test ? (run?.test ? (run.res ?? null) : null) : parse<StoredRes>(await d.redis.hGet(K.bleachRes(day), uid));
    if (!res) throw new GameError('bad_request', test ? 'Finish a test sheet first.' : 'Paint today’s sheet first.');
    if (res.shared) throw new GameError('bad_request', test ? 'You shared this test sheet already.' : 'You shared today’s sheet already. A new one comes at midnight UTC.');
    if (!res.sheet) throw new GameError('bad_request', 'This sheet dried before sharing was possible.');
    const players = test ? undefined : await d.redis.zCard(K.bleachBoard(day));
    const rank = test ? undefined : await rankOf(d, day, uid);
    const text = shareText({
      day,
      points: res.points,
      ranked: !test,
      ...(rank ? { rank } : {}),
      ...(players ? { players } : {}),
      hearts: res.parts.hearts,
      heartsMax: HEARTS,
      washed: res.parts.washed,
      boss: res.parts.boss,
      pales: paleTotal(),
      sheet: res.sheet,
      ...(res.col ? { col: res.col } : {}),
      ...(!test && res.streak && res.streak.n >= 2 ? { streak: res.streak.n } : {}),
    });
    let post: PostRef = await ensureSheetPost(d, day);
    if (!post.thread) post = await ensureThread(d, day);
    try {
      // Als Antwort auf den angehefteten Kommentar, im Namen des Spielers (Regeln für geteilte Ergebnisse)
      await d.reddit.submitComment({ id: post.thread as `t1_${string}`, text, runAs: 'USER' });
    } catch (e) {
      console.error('share sheet', e);
      throw new GameError('server', 'Reddit did not take the comment. Try again in a moment.', 502);
    }
    res.shared = true;
    if (test) await d.redis.set(K.bleachRun(uid), JSON.stringify({ ...run!, res }));
    else await d.redis.hSet(K.bleachRes(day), { [uid]: JSON.stringify(res) });
    return { postId: post.id, url: post.url, text };
  });
}

/** Tagespost gelöscht: ist es der Post des Tages, legt der nächste Scheduler-Lauf oder das nächste Teilen einen neuen an */
export async function sheetPostGone(d: Pick<Deps, 'redis'>, postId: string): Promise<boolean> {
  const day = await d.redis.hGet(K.bleachPostDay, postId);
  if (!day) return false;
  const ref = parse<PostRef>(await d.redis.get(K.bleachPost(day)));
  if (ref?.id === postId) await d.redis.del(K.bleachPost(day));
  return true;
}
/** Angehefteter Kommentar gelöscht (z. B. von einem Mod): beim nächsten Teilen kommt ein neuer */
export async function sheetThreadGone(d: Pick<Deps, 'redis'>, commentId: string, postId: string): Promise<boolean> {
  const day = await d.redis.hGet(K.bleachPostDay, postId);
  if (!day) return false;
  const ref = parse<PostRef>(await d.redis.get(K.bleachPost(day)));
  if (ref?.thread !== commentId) return false;
  const { thread: _t, ...rest } = ref;
  void _t;
  await d.redis.set(K.bleachPost(day), JSON.stringify(rest));
  return true;
}
