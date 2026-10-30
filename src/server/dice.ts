/*
 * Würfelsammlung und Ziehen („Dip the brush“). Jeder Wurf passiert hier: der offene W100 für die Seltenheit,
 * das Monster dazu, der Schutz vor Pech. Pigment gibt es nur durchs Spielen.
 * Jedes Monster gibt es nur einmal (festgelegt am 30.10.2026): sein Seed steht im Register, jeder Würfel hat eine Seriennummer.
 */
import { START_MEDIA, UNLOCK_ORDER } from '../shared/duel/media';
import type { DiceResponse, DuelReward } from '../shared/api';
import { dayKey, weekKey } from '../shared/day';
import { decodeDrawing, encodeDrawing, hasShape } from '../shared/drawn';
import {
  BLANK,
  dieMonster,
  dieSpecies,
  emptyDice,
  GLAZE_COST,
  KEEP_MIN,
  LEGENDARY_PAPERS,
  PULL_COST,
  PITY,
  rarityDef,
  rarityFromRoll,
  rarityIndex,
  REWARD,
  TEN_COST,
  washGlaze,
  type DiceSave,
  type DieRec,
  type PullKind,
  type PullResult,
  type Rarity,
} from '../shared/dice';
import { BAG, dieUnit, isCrestFace } from '../shared/duel/rules';
import { humidityFor, makeMonster, monsterSeed, speciesKey } from '../shared/monster';
import { GameError, withLock, type Deps } from './core';
import { K } from './keys';

export function needUser(userId: string | undefined): string {
  if (!userId) throw new GameError('login', 'Log in to collect dice.', 401);
  return userId;
}
/** Gleiche Sperre wie das Duell, weil Duell-Belohnungen die Sammlung ändern */
export const playerLock = (uid: string): string => `duel:${uid}`;

export async function loadDice(d: Pick<Deps, 'redis' | 'now'>, uid: string): Promise<DiceSave> {
  const raw = await d.redis.get(K.dice(uid));
  const s = raw ? { ...emptyDice(), ...(JSON.parse(raw) as DiceSave) } : emptyDice();
  weeklyBlank(s, d.now);
  return s;
}
/**
 * Jede Woche ein leerer Würfel, die freien füllen nur bis BLANK.max auf (auch nach Wochen ohne Besuch).
 * Rechnet beim Laden, gespeichert wird mit der nächsten Änderung, bis dahin kommt dasselbe heraus.
 */
function weeklyBlank(s: DiceSave, now: number): void {
  const w = weekKey(now);
  if (s.blankWeek === w) return;
  const weeks = s.blankWeek ? Number(w.slice(1)) - Number(s.blankWeek.slice(1)) : 1;
  s.blankWeek = w;
  if (weeks > 0) s.blank = Math.max(s.blank ?? 0, Math.min(BLANK.max, (s.blank ?? 0) + weeks));
}
export async function saveDice(d: Pick<Deps, 'redis' | 'now'>, uid: string, s: DiceSave): Promise<void> {
  // Ältere Würfel bekommen beim nächsten Speichern ihre Seriennummer und, wenn frei, ihren Platz im Register
  for (const die of s.dice) if (!die.no && !(await claim(d, uid, die))) die.no = await d.redis.incrBy(K.serial, 1);
  await d.redis.set(K.dice(uid), JSON.stringify(s));
  await d.redis.zAdd(K.dicePlayers, { member: uid, score: d.now });
}
const respond = (d: Pick<Deps, 'now'>, s: DiceSave, pulls: PullResult[] = []): DiceResponse => ({ dice: s, freeReady: s.freeDay !== dayKey(d.now), pulls });

/** Ein Monster mit dem Papier dieser Seltenheit. Legendary: ein Monster auf Cotton Rag bekommt ein seltenes Papier. */
function rollMonster(d: Deps, rarity: Rarity, avoid: Set<string> | null): Pick<DieRec, 'sheet' | 'idx' | 'paper'> {
  const want = rarityDef(rarity).paper ?? 'hadern';
  let sheet = '',
    idx = 0;
  for (let k = 0; k < 2000; k++) {
    sheet = `dip-${d.rand().toString(36)}`;
    idx = d.rand() % 12;
    const m = makeMonster(sheet, idx, humidityFor(sheet));
    if (m.paper === want && !avoid?.has(speciesKey(m))) break;
  }
  return rarity === 'legendary' ? { sheet, idx, paper: LEGENDARY_PAPERS[d.rand() % LEGENDARY_PAPERS.length]! } : { sheet, idx };
}
function dieFor(d: Deps, s: DiceSave, rarity: Rarity, avoid: Set<string> | null): DieRec {
  // Neue Würfel bekommen die Formen der Generation 2 (festgelegt am 30.10.2026)
  return { id: `d${s.next++}`, ...rollMonster(d, rarity, avoid), mods: [], at: d.now, gen: 2 };
}
/** Seed ins Register eintragen und Seriennummer vergeben. false: den Seed hat schon ein anderes Monster */
async function claim(d: Pick<Deps, 'redis'>, uid: string, die: DieRec): Promise<boolean> {
  const ok = (await d.redis.hSetNX(K.seeds, String(monsterSeed(die.sheet, die.idx)), `${uid}:${die.id}`)) === 1;
  if (ok) die.no = await d.redis.incrBy(K.serial, 1);
  return ok;
}
/** Neue Würfel eines Zugs eintragen. Ist ein Seed schon vergeben, wird das Monster mit derselben Seltenheit neu gewürfelt */
async function claimPulls(d: Deps, uid: string, pulls: PullResult[]): Promise<void> {
  for (const p of pulls) {
    for (let k = 0; k < 20 && !(await claim(d, uid, p.die)); k++) Object.assign(p.die, rollMonster(d, p.rarity, null));
    if (!p.die.no) throw new GameError('server', 'The brush slipped. Try again.', 500);
  }
}
const rarityOfDie = (r: DieRec): Rarity => dieUnit(dieMonster(r)).rarity;

/** Ein Zug: W100 offen würfeln, Schutz vor Pech prüfen, Monster erzeugen, Doppelte zu Lasur machen */
function pullOne(d: Deps, s: DiceSave, starter: boolean, forceRare: boolean): PullResult {
  s.pulls++;
  s.pity.rare++;
  s.pity.epic++;
  s.pity.legendary++;
  const d100 = 1 + (d.rand() % 100);
  let rarity = rarityFromRoll(d100);
  let pity: PullResult['pity'] = null;
  const ri = rarityIndex(rarity);
  if (s.pity.legendary >= PITY.legendary && ri < 4) {
    rarity = 'legendary';
    pity = 'legendary';
  } else if (s.pity.epic >= PITY.epic && ri < 3) {
    rarity = 'epic';
    pity = 'epic';
  } else if (s.pity.rare >= PITY.rare && ri < 2) {
    rarity = 'rare';
    pity = 'rare';
  } else if (forceRare && ri < 2) {
    rarity = 'rare';
    pity = 'ten';
  }
  const fi = rarityIndex(rarity);
  if (fi >= 2) s.pity.rare = 0;
  if (fi >= 3) s.pity.epic = 0;
  if (fi >= 4) s.pity.legendary = 0;
  // Startzüge bringen immer neue Arten, damit der Beutel voll wird
  const owned = new Set(s.dice.map(dieSpecies));
  const die = dieFor(d, s, rarity, starter ? owned : null);
  const key = dieSpecies(die);
  // Jeder Zug bleibt als eigenes Monster, auch bei einer Art, die man schon hat
  s.dice.push(die);
  // Startzüge füllen den Beutel, spätere Würfel packt man selbst ein
  if (starter && s.bag.length < BAG) s.bag.push(die.id);
  const out: PullResult = { d100, rarity, pity, die, dup: owned.has(key) ? key : null };
  // Der schlechteste Wurf tröstet: dazu ein leerer Würfel zum Selbstmalen
  if (d100 === BLANK.find) {
    s.blank = (s.blank ?? 0) + 1;
    out.blank = true;
  }
  return out;
}

/** Die offenen Startzüge auf einmal (auch beim ersten Duell ohne Beutel) */
function runStarter(d: Deps, s: DiceSave): PullResult[] {
  const out: PullResult[] = [];
  while (s.starter > 0) {
    s.starter--;
    out.push(pullOne(d, s, true, false));
  }
  return out;
}

export async function diceGet(d: Deps, userId: string | undefined): Promise<DiceResponse> {
  const uid = needUser(userId);
  const s = await loadDice(d, uid);
  if (s.dice.every((x) => x.no)) return respond(d, s);
  // Ältere Würfel ohne Seriennummer: einmal unter der Sperre nachtragen
  return withLock(d, playerLock(uid), async () => {
    const t = await loadDice(d, uid);
    await saveDice(d, uid, t);
    return respond(d, t);
  });
}

export async function dicePull(d: Deps, userId: string | undefined, kind: unknown): Promise<DiceResponse> {
  const uid = needUser(userId);
  const k = (['starter', 'free', 'one', 'ten'] as PullKind[]).find((x) => x === kind);
  if (!k) throw new GameError('bad_request', 'Unknown dip.');
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    const today = dayKey(d.now);
    let pulls: PullResult[] = [];
    if (k === 'starter') {
      if (s.starter < 1) throw new GameError('bad_request', 'Your free starter dips are used up.');
      pulls = runStarter(d, s);
    } else if (k === 'free') {
      if (s.freeDay === today) throw new GameError('bad_request', 'The free dip is back tomorrow.');
      s.freeDay = today;
      pulls = [pullOne(d, s, false, false)];
    } else {
      const n = k === 'ten' ? 10 : 1;
      const cost = k === 'ten' ? TEN_COST : PULL_COST;
      if (s.pigment < cost) throw new GameError('bad_request', `Not enough pigment (${cost} needed).`);
      s.pigment -= cost;
      for (let i = 0; i < n; i++) {
        // Zehnerzug: der letzte wird Rare, falls bis dahin keiner Rare oder besser war
        const last = n === 10 && i === 9 && pulls.every((p) => rarityIndex(p.rarity) < 2);
        pulls.push(pullOne(d, s, false, last));
      }
    }
    await claimPulls(d, uid, pulls);
    await saveDice(d, uid, s);
    return respond(d, s, pulls);
  });
}

/**
 * Selbst malen (Blank canvas): die Striche bestimmen nur die Form. Alles andere würfelt der Server wie bei einem Zug
 * (W100, Seltenheit, Papier, Pigment, Werte, Schutz vor Pech), danach ist die Zeichnung fest.
 */
export async function diceDraw(d: Deps, userId: string | undefined, code: unknown): Promise<DiceResponse> {
  const uid = needUser(userId);
  const dr = typeof code === 'string' ? decodeDrawing(code) : null;
  if (!dr) throw new GameError('bad_request', 'That drawing did not survive the trip. Try again.');
  if (!hasShape(dr)) throw new GameError('bad_request', 'Close a shape. Paint needs somewhere to pool.');
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    if (s.starter > 0) throw new GameError('bad_request', 'Dip your free dice first, then paint.');
    if ((s.blank ?? 0) < 1) throw new GameError('bad_request', 'No blank canvas left. A new one comes every Monday.');
    s.blank! -= 1;
    const p = pullOne(d, s, false, false);
    // Gespeichert wird die geprüfte, vereinfachte Fassung, nie ein Bild
    p.die.draw = encodeDrawing(dr);
    await claimPulls(d, uid, [p]);
    await saveDice(d, uid, s);
    return respond(d, s, [p]);
  });
}

/** Beutel neu packen: eigene, verschiedene Würfel, höchstens 6. Leere Plätze füllt das Duell mit den übrigen Würfeln */
export async function diceBag(d: Deps, userId: string | undefined, ids: unknown): Promise<DiceResponse> {
  const uid = needUser(userId);
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string')) throw new GameError('bad_request', 'Unknown dice.');
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    const set = [...new Set(ids as string[])];
    if (set.length > BAG) throw new GameError('bad_request', `At most ${BAG} dice fit in the bag.`);
    if (!set.every((id) => s.dice.some((x) => x.id === id))) throw new GameError('bad_request', 'That die is not yours.');
    s.bag = set;
    await saveDice(d, uid, s);
    return respond(d, s);
  });
}

/** Lasur auf eine Würfelseite: ein einfaches Symbol wird doppelt. Kostet Lasur der eigenen Art. */
export async function diceGlaze(d: Deps, userId: string | undefined, id: unknown, face: unknown): Promise<DiceResponse> {
  const uid = needUser(userId);
  if (typeof id !== 'string' || !Number.isInteger(face) || (face as number) < 0 || (face as number) > 5) throw new GameError('bad_request', 'Unknown face.');
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    const die = s.dice.find((x) => x.id === id);
    if (!die) throw new GameError('not_found', 'That die is not yours.', 404);
    const f = dieUnit(dieMonster(die), die.mods).faces[face as number]!;
    if (!isCrestFace(f) || f.n !== 1) throw new GameError('bad_request', 'Only a single crest takes a glaze.');
    const key = dieSpecies(die);
    if ((s.glaze[key] ?? 0) < GLAZE_COST) throw new GameError('bad_request', `Needs ${GLAZE_COST} glaze of this species.`);
    s.glaze[key]! -= GLAZE_COST;
    die.mods.push({ i: face as number, to: 'x2' });
    await saveDice(d, uid, s);
    return respond(d, s);
  });
}

/**
 * Würfel auswaschen: er verschwindet und gibt seiner Art Lasur (so viel wie ein Doppelter früher).
 * Nicht im Deck, und es bleiben immer genug Würfel für ein volles Deck. Der Seed bleibt im Register, das Monster kommt nie wieder.
 */
export async function diceWash(d: Deps, userId: string | undefined, id: unknown): Promise<DiceResponse> {
  const uid = needUser(userId);
  if (typeof id !== 'string') throw new GameError('bad_request', 'Unknown die.');
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    const die = s.dice.find((x) => x.id === id);
    if (!die) throw new GameError('not_found', 'That die is not yours.', 404);
    if (s.bag.includes(id)) throw new GameError('bad_request', 'This die is in your deck. Take it out first.');
    if (s.dice.length <= KEEP_MIN) throw new GameError('bad_request', `Keep at least ${KEEP_MIN} dice for your deck.`);
    const key = dieSpecies(die);
    s.dice = s.dice.filter((x) => x !== die);
    s.glaze[key] = (s.glaze[key] ?? 0) + washGlaze(rarityOfDie(die));
    await saveDice(d, uid, s);
    return respond(d, s);
  });
}

/** Beutel fürs Duell. Ohne Würfel laufen zuerst die freien Startzüge. Nur innerhalb der Spielersperre aufrufen. */
export async function bagForDuel(d: Deps, uid: string): Promise<DieRec[]> {
  const s = await loadDice(d, uid);
  let changed = false;
  if (s.dice.length < BAG && s.starter > 0) {
    await claimPulls(d, uid, runStarter(d, s));
    changed = true;
  }
  const bag = s.bag.map((id) => s.dice.find((x) => x.id === id)).filter((x): x is DieRec => !!x);
  for (const x of s.dice) if (bag.length < BAG && !bag.includes(x)) bag.push(x);
  if (bag.length !== s.bag.length) {
    s.bag = bag.map((x) => x.id);
    changed = true;
  }
  if (changed) await saveDice(d, uid, s);
  return bag;
}

/** Pigment nach einem Duell. Nur innerhalb der Spielersperre aufrufen. */
export async function payDuel(d: Deps, uid: string, winner: 0 | 1 | 2, tutorial: boolean): Promise<DuelReward> {
  const s = await loadDice(d, uid);
  let reward: DuelReward;
  if (tutorial) {
    const p = s.tutorialPaid ? 0 : REWARD.tutorial;
    s.tutorialPaid = true;
    reward = { pigment: p, why: p ? 'tutorial' : 'capped', total: 0 };
  } else {
    const today = dayKey(d.now);
    if (s.rewardDay !== today) {
      s.rewardDay = today;
      s.rewardN = 0;
    }
    const why = winner === 1 ? 'win' : winner === 0 ? 'draw' : 'loss';
    if (s.rewardN < REWARD.perDay) {
      s.rewardN++;
      reward = { pigment: REWARD[why], why, total: 0 };
    } else reward = { pigment: 0, why: 'capped', total: 0 };
  }
  s.pigment += reward.pigment;
  reward.total = s.pigment;
  // Jedes fertige Duell schaltet das nächste Malmittel frei
  if (!tutorial) {
    const have = s.media ?? [...START_MEDIA];
    const next = UNLOCK_ORDER.find((m) => !have.includes(m));
    if (next) {
      s.media = [...have, next];
      reward.unlocked = next;
    }
  }
  await saveDice(d, uid, s);
  return reward;
}

