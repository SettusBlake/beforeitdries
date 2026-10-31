/*
 * Ein Duell als Folge von Aktionen. Der Server lädt den Zustand, führt eine Aktion aus (würfelt dabei)
 * und speichert. Jede Aktion wird vorher geprüft, der Client kann nichts erzwingen.
 * Fassung 6: Ein Klecks zieht mit einer Aktion „go“ (hinlaufen und handeln). Haben alle gehandelt, endet der Zug von selbst.
 */
import { sameAction, tutorialAction, tutorialActive } from './tutorial';
import { isMedium, START_MEDIA, type MediumId } from './media';
import { COLOR_DEFAULT, COLOR_RIVAL, type ColorId } from '../colors';
import {
  ABILITY,
  aiHold,
  aiJokerCrest,
  aiOpening,
  applyRoll,
  comboOf,
  currentRoll,
  rerollDice,
  aiTurnSteps,
  abilityTargets,
  act,
  bestPig,
  bestPlacement,
  canAct,
  canMove,
  canPaintAt,
  checkWipe,
  doMove,
  doSummon,
  drain,
  endRound,
  idx,
  logAdd,
  netPlace,
  onSheet,
  reach,
  rollDice,
  rollable,
  ROLL_N,
  S,
  splashCells,
  startTurn,
  suggest,
  summonable,
  sync,
  takeJoker,
  TUNE,
  CRESTS,
  unitById,
  COLS,
  ROWS,
  type Action,
  offerRound,
  startOffer,
  takeMedium,
  type Cell,
  type Combo,
  type Crest,
  type Ev,
  type FoeDie,
  type Level,
  type Phase,
  type Rolled,
  type Side,
  type Team,
  type Unit,
} from './rules';

export type DuelAction =
  | { k: 'open'; id: number; o: number; at: number }
  | { k: 'roll'; ids: number[] }
  /** Diese Würfel halten, den Rest neu werfen */
  | { k: 'reroll'; hold: number[] }
  /** Den Wurf nehmen, wie er liegt */
  | { k: 'keep' }
  /** Ein Malmittel aus dem Angebot nehmen */
  | { k: 'medium'; id: MediumId }
  | { k: 'summon'; id: number; o: number; at: number }
  | { k: 'skip' }
  | { k: 'joker'; crest: Crest }
  /** Hinlaufen (to = eigenes Feld: stehen bleiben) und handeln. Die Farbe wählt der Server */
  | { k: 'go'; id: number; to: number; a: Action; at: number | null }
  /** Sepia spielt den Rest des Zuges */
  | { k: 'auto' }
  | { k: 'end' };

/** Was der Client sieht: alles außer Würfelzufall und Seed */
export type DuelState = {
  /** Stand der Regeln im Speicher: 4 = Brim und Meisterzug, zufällige Seiten. Ältere Duelle werden verworfen */
  v: 4;
  cells: Cell[];
  teams: Team[];
  round: number;
  turn: Side;
  over: boolean;
  winner: 0 | Side;
  winReason: string;
  level: Level;
  phase: Phase;
  lastRoll: { id: number; fi: number }[];
  /** Joker aus dem letzten Wurf, noch nicht verbraucht */
  joker: number;
  freeJoker: number;
  starBonus: number;
  rerolls: number;
  combo: Combo | null;
  /** Malmittel zur Wahl (Phase medium), danach weiter mit resume */
  offer: MediumId[];
  resume: Phase;
  /** Freigeschaltete Malmittel des Spielers */
  unlocked: MediumId[];
  heartsTurn: number;
  paintSeed: number;
  stamp: number;
  log: { t: string; c: string }[];
  /** Lern-Duell bis zu dieser Runde (0 = aus) */
  tutorial: number;
  /** Galerie-Duell: Besitzer des Decks (leer: kein Galerie-Duell) und je Würfel des Rivalen, was seine Karte zeigt */
  foeName?: string;
  foeDice?: (FoeDie | null)[];
  /** Spielfarben: du, Rivale */
  colors?: [ColorId, ColorId];
};
/** Was der Server speichert: dazu Würfelzufall, Würfel-IDs, Besitzer des Galerie-Decks samt Zeichnungen, Malmittel des Rivalen */
export type DuelSave = DuelState & { rng: number; gameSeed: number; dieIds?: string[]; foeId?: string; foeKeys?: (string | null)[]; rivalMedia?: MediumId[] };
type Hidden = 'rng' | 'gameSeed' | 'dieIds' | 'foeId' | 'foeKeys' | 'rivalMedia';

export class DuelError extends Error {}
const bad = (msg: string): never => {
  throw new DuelError(msg);
};
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

export function publicState(): DuelState {
  return {
    v: 4,
    cells: S.cells,
    teams: S.teams,
    round: S.round,
    turn: S.turn,
    over: S.over,
    winner: S.winner,
    winReason: S.winReason,
    level: S.level,
    phase: S.phase,
    lastRoll: S.lastRoll,
    joker: S.joker,
    freeJoker: S.freeJoker,
    starBonus: S.starBonus,
    rerolls: S.rerolls,
    combo: S.combo,
    offer: S.offer,
    resume: S.resume,
    unlocked: S.unlocked,
    heartsTurn: S.heartsTurn,
    paintSeed: S.paintSeed,
    stamp: S.stamp,
    log: S.log.slice(0, 40),
    tutorial: S.tutorial,
    ...(S.foeName ? { foeName: S.foeName } : {}),
    ...(S.foeDice.some(Boolean) ? { foeDice: S.foeDice } : {}),
    colors: S.colors,
  };
}
export function saveState(): string {
  const s: DuelSave = { ...publicState(), rng: S.rng, gameSeed: S.gameSeed, dieIds: S.dieIds };
  if (S.foeId) s.foeId = S.foeId;
  if (S.foeKeys.some(Boolean)) s.foeKeys = S.foeKeys;
  if (S.rivalMedia.length) s.rivalMedia = S.rivalMedia;
  return JSON.stringify(s);
}
/** Zustand übernehmen (Server: gespeicherter Stand, Client: Stand vom Server) */
export function loadState(s: DuelState & Partial<Pick<DuelSave, Hidden>>): void {
  S.cells = s.cells;
  S.teams = [s.teams[0]!, s.teams[1]!];
  S.round = s.round;
  S.turn = s.turn;
  S.over = s.over;
  S.winner = s.winner;
  S.winReason = s.winReason;
  S.level = s.level;
  S.phase = s.phase;
  S.lastRoll = s.lastRoll;
  S.joker = s.joker ?? 0;
  S.freeJoker = s.freeJoker ?? 0;
  S.starBonus = s.starBonus ?? 0;
  S.rerolls = s.rerolls ?? 0;
  S.combo = s.combo ?? null;
  S.offer = s.offer ?? [];
  S.resume = s.resume ?? 'roll';
  S.unlocked = s.unlocked ?? [...START_MEDIA];
  S.heartsTurn = s.heartsTurn ?? 0;
  S.paintSeed = s.paintSeed;
  S.stamp = s.stamp;
  S.log = s.log;
  S.tutorial = s.tutorial ?? 0;
  S.rng = s.rng ?? 0;
  S.gameSeed = s.gameSeed ?? 0;
  S.dieIds = s.dieIds ?? [];
  S.foeName = s.foeName ?? '';
  S.foeDice = s.foeDice ?? [];
  S.foeId = s.foeId ?? '';
  S.foeKeys = s.foeKeys ?? [];
  S.rivalMedia = s.rivalMedia ?? [];
  S.colors = s.colors ?? [COLOR_DEFAULT, COLOR_RIVAL];
  S.events = [];
}
/** Wie oft jeder deiner Würfel in diesem Duell geworfen wurde (für die Patina, nur am Server bekannt) */
export function wornDice(): { id: string; n: number }[] {
  return S.teams[0].units.flatMap((u, k) => {
    const id = S.dieIds[k];
    return id && u.rolls ? [{ id, n: u.rolls }] : [];
  });
}
/** Der letzte Wurf mit Würfeln und Seiten */
export const lastRolled = (): Rolled[] => currentRoll();
/** Der Wurf gilt: Symbole und Kombi, dann beschwören oder handeln */
function settle(me: Team): void {
  const rolled = applyRoll(me);
  sync();
  S.phase = summonable(me, rolled).length ? 'summon' : 'act';
}

/** Der Rivale eröffnet, danach ist der Spieler dran */
export function openDuel(): Ev[] {
  aiOpening(2, S.level);
  S.phase = 'opening';
  // Vor dem Duell: ein Malmittel wählen (der Rivale wählt gleich mit)
  startOffer('opening');
  return drain();
}

/** Eine Aktion des Spielers prüfen und ausführen */
export function perform(a: DuelAction): Ev[] {
  if (S.over) bad('The duel is over.');
  // Im Lern-Duell gilt nur der Schritt, den Sepia vorgibt
  if (tutorialActive()) {
    const exp = tutorialAction();
    if (!exp || !sameAction(exp, a)) bad('Follow Master Sepia: tap the gold ring.');
  }
  const me = S.teams[0];
  const own = (id: unknown) => {
    const u = typeof id === 'number' ? unitById(id) : null;
    if (!u || u.side !== 1) bad('Unknown blot.');
    return u!;
  };
  const place = (id: unknown, o: unknown, at: unknown) => {
    const u = own(id);
    if (u.state !== 'bag') bad('That die is not in the bag.');
    if (!isInt(o, 0, 7) || !isInt(at, 0, COLS * ROWS - 1)) bad('Bad placement.');
    if (!netPlace(u, o as number, at as number)) bad('The net does not fit there.');
    return u;
  };
  switch (a.k) {
    case 'open': {
      if (S.phase !== 'opening') bad('Not the opening.');
      const u = place(a.id, a.o, a.at);
      const s = doSummon(u, a.o, a.at);
      u.moved = false;
      logAdd(`You ${s}.`, 'you');
      sync();
      startTurn(1);
      S.phase = rollable(me).length ? 'roll' : 'act';
      break;
    }
    case 'roll': {
      if (S.phase !== 'roll') bad('Not the time to roll.');
      const need = Math.min(ROLL_N, rollable(me).length);
      const ids = Array.isArray(a.ids) ? [...new Set(a.ids)] : [];
      if (ids.length !== need) bad(`Pick ${need} dice.`);
      const us = ids.map((id) => own(id));
      if (us.some((u) => u.state !== 'bag' || u.used)) bad('That die is not ready in your deck.');
      const rolled = rollDice(me, us);
      sync();
      // Ein Drilling lässt sich nicht verbessern: gilt sofort
      if (!rolled.length || S.rerolls < 1 || comboOf(rolled.map((r) => r.face))?.kind === 'triple') settle(me);
      else S.phase = 'keep';
      break;
    }
    case 'medium': {
      if (S.phase !== 'medium') bad('Nothing to pick.');
      if (!isMedium(a.id) || !S.offer.includes(a.id)) bad('That medium is not on offer.');
      takeMedium(1, a.id);
      S.offer = [];
      S.phase = S.resume;
      sync();
      break;
    }
    case 'reroll': {
      if (S.phase !== 'keep') bad('Nothing to reroll.');
      if (S.rerolls < 1) bad('No reroll left this turn.');
      const ids = new Set(S.lastRoll.map((r) => r.id));
      const hold = Array.isArray(a.hold) ? [...new Set(a.hold)] : [];
      if (hold.some((id) => !ids.has(id as number))) bad('Hold only dice from this roll.');
      if (hold.length >= ids.size) bad('Pick at least one die to reroll.');
      rerollDice(me, hold);
      sync();
      if (S.rerolls < 1) settle(me);
      break;
    }
    case 'keep': {
      if (S.phase !== 'keep') bad('Nothing to keep.');
      settle(me);
      break;
    }
    case 'summon': {
      if (S.phase !== 'summon') bad('Nothing to summon.');
      const u = place(a.id, a.o, a.at);
      if (!summonable(me, lastRolled()).includes(u)) bad('The stars do not add up for that die.');
      const s = doSummon(u, a.o, a.at);
      logAdd(`You ${s}.`, 'you');
      // Die Joker haben als Sterne gezählt
      S.joker = 0;
      S.freeJoker = 0;
      S.starBonus = 0;
      sync();
      S.phase = 'act';
      break;
    }
    case 'joker': {
      if (S.phase !== 'summon' && S.phase !== 'act') bad('Not your turn.');
      if (S.joker < 1) bad('No Joker to use.');
      if (!CRESTS.some((c) => c.k === a.crest)) bad('Unknown crest.');
      // Wer den Joker als Symbol nimmt, beschwört in diesem Zug nicht mehr
      takeJoker(me, a.crest);
      sync();
      S.phase = 'act';
      break;
    }
    case 'skip': {
      if (S.phase !== 'summon') bad('Nothing to skip.');
      S.phase = 'act';
      break;
    }
    case 'go': {
      if (S.phase !== 'act') bad('Not your move.');
      const u = own(a.id);
      goBlot(u, a);
      break;
    }
    case 'auto': {
      if (S.phase !== 'keep' && S.phase !== 'summon' && S.phase !== 'act') bad('Not your turn.');
      autoTurn();
      endTurn();
      break;
    }
    case 'end': {
      if (S.phase !== 'act' && S.phase !== 'summon') bad('Not your turn.');
      endTurn();
      break;
    }
    default:
      bad('Unknown action.');
  }
  // Haben alle Kleckse gehandelt, endet der Zug von selbst
  if (!S.over && S.phase === 'act' && S.joker === 0 && onSheet(me).every((u) => u.acted)) endTurn();
  if (S.over) S.phase = 'over';
  return drain();
}

/** Ein Klecks: prüfen, hinlaufen, handeln. Geprüft wird vom Zielfeld aus, bevor sich etwas ändert */
function goBlot(u: Unit, a: { to: unknown; a: unknown; at: unknown }): void {
  if (u.state !== 'sheet' || u.acted) bad('That blot is done for this turn.');
  const here = idx(u.x, u.y);
  if (!isInt(a.to, 0, COLS * ROWS - 1)) bad('It cannot get there.');
  const to = a.to as number;
  const prev = to !== here ? (canMove(u) ? reach(u) : null) : null;
  if (to !== here && (!prev || !prev.has(to))) bad('It cannot get there.');
  // Fähigkeiten gibt es nur noch als Meisterzug (voller Brim), keine eigene Aktion mehr
  const acts: Action[] = ['stamp', 'splash', 'soak'];
  const kind = acts.find((x) => x === a.a);
  if (!kind) bad('Unknown action.');
  // Vom Zielfeld aus prüfen
  const ox = u.x,
    oy = u.y;
  u.x = to % COLS;
  u.y = Math.floor(to / COLS);
  let at: number | null = null;
  let err = '';
  if (!canAct(u, kind!)) err = 'That blot cannot do that now.';
  else if (kind === 'stamp') {
    if (!isInt(a.at, 0, COLS * ROWS - 1) || !canPaintAt(u, a.at as number)) err = 'Out of reach.';
    else at = a.at as number;
  } else if (kind === 'splash') {
    if (!isInt(a.at, 0, COLS * ROWS - 1) || !splashCells(u).includes(a.at as number)) err = 'Nothing to splash there.';
    else at = a.at as number;
  }
  const pig = bestPig(u, kind!, at);
  u.x = ox;
  u.y = oy;
  if (err) bad(err);
  const note = prev ? doMove(u, to, prev) : '';
  const s = act(u, kind!, pig, at);
  logAdd(`Your ${u.name}${prev ? ` moved${note ? ` and ${note}` : ''}, then` : ''} ${s}.`, 'you');
  if (S.over) S.phase = 'over';
}

/** Sepia spielt den Rest des Zuges: beschwören, Joker nehmen, dann jeden Klecks wie ihr goldener Ring */
function autoTurn(): void {
  const me = S.teams[0];
  if (S.phase === 'keep') {
    const hold = aiHold(me, currentRoll());
    if (S.rerolls > 0 && hold.length < S.lastRoll.length) rerollDice(me, hold);
    settle(me);
  }
  if (S.phase === 'summon') {
    const u = summonable(me, lastRolled())[0];
    const p = u ? bestPlacement(u) : null;
    if (u && p) {
      logAdd(`You ${doSummon(u, p.o, p.at)}.`, 'you');
      S.joker = 0;
      S.freeJoker = 0;
      S.starBonus = 0;
      sync();
    }
    S.phase = 'act';
  }
  while (S.joker > 0) takeJoker(me, aiJokerCrest(me));
  for (let k = 0; k < 6 && !S.over; k++) {
    const sg = suggest(1);
    if (!sg) break;
    goBlot(sg.u, { to: sg.to, a: sg.a, at: sg.at });
  }
}

/** Zug beenden: der Rivale zieht, dann endet die Runde */
function endTurn(): void {
  if (S.over) return;
  const step = aiTurnSteps(2, TUNE.look[S.level]);
  while (step()) {
    /* der Rivale zieht */
  }
  if (!S.over && !checkWipe()) endRound();
  if (S.over) S.phase = 'over';
  else {
    startTurn(1);
    S.lastRoll = [];
    S.joker = 0;
    S.freeJoker = 0;
    S.starBonus = 0;
    // Kein Würfel mehr im Deck (alle auf dem Blatt oder verloren): gleich handeln
    S.phase = rollable(S.teams[0]).length ? 'roll' : 'act';
    // Nach Runde 2 und 4: neues Malmittel
    if (offerRound(S.round)) startOffer(S.phase);
  }
}
