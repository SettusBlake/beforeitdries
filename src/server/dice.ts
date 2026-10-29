/*
 * Würfelsammlung und Ziehen („Dip the brush“). Jeder Wurf passiert hier: der offene W100 für die Seltenheit,
 * das Monster dazu, der Schutz vor Pech. Pigment gibt es nur durchs Spielen.
 */
import { START_MEDIA, UNLOCK_ORDER } from '../shared/duel/media';
import type { DiceResponse, DuelReward } from '../shared/api';
import { dayKey } from '../shared/day';
import {
  dieMonster,
  dieSpecies,
  emptyDice,
  GLAZE_COST,
  LEGENDARY_PAPERS,
  PULL_COST,
  PITY,
  rarityDef,
  rarityFromRoll,
  rarityIndex,
  REWARD,
  TEN_COST,
  type DiceSave,
  type DieRec,
  type PullKind,
  type PullResult,
  type Rarity,
} from '../shared/dice';
import { BAG, dieUnit, isCrestFace } from '../shared/duel/rules';
import { humidityFor, makeMonster, speciesKey } from '../shared/monster';
import { GameError, withLock, type Deps } from './core';
import { K } from './keys';

export function needUser(userId: string | undefined): string {
  if (!userId) throw new GameError('login', 'Log in to collect dice.', 401);
  return userId;
}
/** Gleiche Sperre wie das Duell, weil Duell-Belohnungen die Sammlung ändern */
export const playerLock = (uid: string): string => `duel:${uid}`;

export async function loadDice(d: Pick<Deps, 'redis'>, uid: string): Promise<DiceSave> {
  const raw = await d.redis.get(K.dice(uid));
  return raw ? { ...emptyDice(), ...(JSON.parse(raw) as DiceSave) } : emptyDice();
}
export async function saveDice(d: Pick<Deps, 'redis' | 'now'>, uid: string, s: DiceSave): Promise<void> {
  await d.redis.set(K.dice(uid), JSON.stringify(s));
  await d.redis.zAdd(K.dicePlayers, { member: uid, score: d.now });
}
const respond = (d: Pick<Deps, 'now'>, s: DiceSave, pulls: PullResult[] = []): DiceResponse => ({ dice: s, freeReady: s.freeDay !== dayKey(d.now), pulls });

/** Ein Monster mit dem Papier dieser Seltenheit. Legendary: ein Monster auf Cotton Rag bekommt ein seltenes Papier. */
function dieFor(d: Deps, s: DiceSave, rarity: Rarity, avoid: Set<string> | null): DieRec {
  const want = rarityDef(rarity).paper ?? 'hadern';
  let sheet = '',
    idx = 0;
  for (let k = 0; k < 2000; k++) {
    sheet = `dip-${d.rand().toString(36)}`;
    idx = d.rand() % 12;
    const m = makeMonster(sheet, idx, humidityFor(sheet));
    if (m.paper === want && !avoid?.has(speciesKey(m))) break;
  }
  const rec: DieRec = { id: `d${s.next++}`, sheet, idx, mods: [], at: d.now };
  if (rarity === 'legendary') rec.paper = LEGENDARY_PAPERS[d.rand() % LEGENDARY_PAPERS.length]!;
  return rec;
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
  const best = s.dice.filter((x) => dieSpecies(x) === key).reduce((a, x) => Math.max(a, rarityIndex(rarityOfDie(x))), -1);
  if (best >= fi) {
    // Doppelte Art, nicht seltener als die eigene: wird Lasur für diese Art
    const g = rarityDef(rarity).glaze;
    s.glaze[key] = (s.glaze[key] ?? 0) + g;
    return { d100, rarity, pity, die, dup: key, glaze: g };
  }
  s.dice.push(die);
  // Startzüge füllen den Beutel, spätere Würfel packt man selbst ein
  if (starter && s.bag.length < BAG) s.bag.push(die.id);
  return { d100, rarity, pity, die, dup: null, glaze: 0 };
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
  return respond(d, await loadDice(d, uid));
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
    await saveDice(d, uid, s);
    return respond(d, s, pulls);
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

/** Beutel fürs Duell. Ohne Würfel laufen zuerst die freien Startzüge. Nur innerhalb der Spielersperre aufrufen. */
export async function bagForDuel(d: Deps, uid: string): Promise<DieRec[]> {
  const s = await loadDice(d, uid);
  let changed = false;
  if (s.dice.length < BAG && s.starter > 0) {
    runStarter(d, s);
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

/** Pigment für den gefangenen Tagesklecks */
export async function payCatch(d: Deps, uid: string): Promise<void> {
  await withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    s.pigment += REWARD.catch;
    await saveDice(d, uid, s);
  });
}
