/*
 * Bleach am Server (freigegeben am 02.11.2026, docs/entwuerfe/bleach-plan.md): das Tagesblatt.
 * Ein Aufbau je Tag (UTC) für alle: Seed, Sepias Tagesdeck, die Pales (aus dem Archiv, sonst aus dem Seed), die Tagesfarbe.
 * Ein Wertungslauf je Spieler und Tag, Punkte nur vom Server, Rangliste je Tag. Wie im Duell: Laden, Aktion und
 * Speichern laufen ohne await dazwischen.
 */
import type { BleachInfo, BleachResult, DuelResponse } from '../shared/api';
import { BLEACH, bleachScore, newBleach, type BleachScore } from '../shared/duel/bleach';
import { DuelError, loadState, openBleach, perform, publicState, saveState, type DuelAction, type DuelSave } from '../shared/duel/play';
import { drain, S } from '../shared/duel/rules';
import { dieMonster, rarityDef, type DieRec, type FaceMod, type Rarity } from '../shared/dice';
import { PIGMENTS, type PigmentId } from '../shared/data';
import { dayKey } from '../shared/day';
import { duelColors } from '../shared/colors';
import { RNG } from '../shared/rng';
import { GameError, withLock, type Deps } from './core';
import { isTester, loadDice, playerLock, saveDice, type Recycled } from './dice';
import { visibleDice } from './gallery';
import { K } from './keys';

/** Ein Würfel im Tagesaufbau (genug, um Monster und Seiten daraus zu machen) */
type DieLite = Pick<DieRec, 'sheet' | 'idx' | 'paper' | 'gen' | 'draw' | 'style' | 'holo' | 'no'> & { mods: FaceMod[] };
/** Aufbau eines Tages: für alle gleich, einmal angelegt */
export type BleachDay = { day: string; seed: number; colour: PigmentId; deck: DieLite[]; pales: { die: DieLite; name?: string }[] };
/** Ein laufender oder fertiger Lauf */
type Run = { day: string; test?: true; save: string };

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
  return { day, seed, colour, deck, pales };
}
/** Der Aufbau des Tages, beim ersten Lauf angelegt (unter einer Sperre, damit alle denselben bekommen) */
export async function bleachDay(d: Deps, day: string): Promise<BleachDay> {
  const have = parse<BleachDay>(await d.redis.get(K.bleachDay(day)));
  if (have) return have;
  return withLock(d, `lock:bleach:${day}`, async () => {
    const again = parse<BleachDay>(await d.redis.get(K.bleachDay(day)));
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
  const played = parse<BleachResult & { name?: string }>(res);
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
      seed: setup.seed,
      day,
      colour: setup.colour,
      deck: setup.deck.map(strip),
      deckMods: setup.deck.map((x) => x.mods),
      pales: setup.pales.map((p) => strip(p.die)),
      paleMods: setup.pales.map((p) => p.die.mods),
      ranked: !test,
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
    const done = !wasOver && S.over;
    const score = done ? bleachScore() : null;
    const ranked = !run.test && !!S.bleach?.ranked;
    await d.redis.set(K.bleachRun(uid), JSON.stringify({ ...run, save: blob }));
    if (done && score) out.bleach = await finishRun(d, uid, username, run.day, score, ranked, out);
    return out;
  });
}
/** Fertig: Ergebnis speichern, in die Rangliste, Belohnung. Nur innerhalb der Spielersperre */
async function finishRun(d: Deps, uid: string, username: string | undefined, day: string, score: BleachScore, ranked: boolean, out: DuelResponse): Promise<BleachResult> {
  const res: BleachResult = { day, points: score.total, parts: score, ranked };
  if (!ranked) return res;
  // Gleichstand: wer früher fertig war, steht vorn (Sekunden seit Tagesbeginn)
  const sec = Math.floor((d.now - Date.parse(`${day}T00:00:00Z`)) / 1000);
  await d.redis.zAdd(K.bleachBoard(day), { member: uid, score: score.total * 100000 + Math.max(0, 99999 - Math.min(99999, sec)) });
  await d.redis.hSet(K.bleachRes(day), { [uid]: JSON.stringify({ ...res, name: username ?? '', at: d.now }) });
  res.rank = await rankOf(d, day, uid);
  res.players = await d.redis.zCard(K.bleachBoard(day));
  // Belohnung: Pigment und ein Tropfen der Tagesfarbe
  const s = await loadDice(d, uid);
  const colour = S.bleach?.colour ?? 'ultra';
  s.pigment += BLEACH.reward.pigment;
  s.drops = { ...s.drops, [colour]: (s.drops?.[colour] ?? 0) + BLEACH.reward.drops };
  await saveDice(d, uid, s);
  out.reward = { pigment: BLEACH.reward.pigment, why: 'bleach', total: s.pigment, drops: Array.from({ length: BLEACH.reward.drops }, () => ({ pig: colour, why: 'win' as const })) };
  return res;
}
