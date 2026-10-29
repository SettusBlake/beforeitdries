/*
 * Ein Duell als Folge von Aktionen. Der Server lädt den Zustand, führt eine Aktion aus (würfelt dabei)
 * und speichert. Jede Aktion wird vorher geprüft, der Client kann nichts erzwingen.
 * Fassung 6: Ein Klecks zieht mit einer Aktion „go“ (hinlaufen und handeln). Haben alle gehandelt, endet der Zug von selbst.
 */
import { sameAction, tutorialAction, tutorialActive } from './tutorial';
import {
  ABILITY,
  aiJokerCrest,
  aiOpening,
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
  living,
  logAdd,
  netAt,
  onSheet,
  reach,
  rollDice,
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
  validNet,
  COLS,
  ROWS,
  type Action,
  type Cell,
  type Crest,
  type Ev,
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
  v: 2;
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
  heartsTurn: number;
  paintSeed: number;
  stamp: number;
  log: { t: string; c: string }[];
  /** Lern-Duell bis zu dieser Runde (0 = aus) */
  tutorial: number;
};
/** Was der Server speichert */
export type DuelSave = DuelState & { rng: number; gameSeed: number };

export class DuelError extends Error {}
const bad = (msg: string): never => {
  throw new DuelError(msg);
};
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

export function publicState(): DuelState {
  return {
    v: 2,
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
    heartsTurn: S.heartsTurn,
    paintSeed: S.paintSeed,
    stamp: S.stamp,
    log: S.log.slice(0, 40),
    tutorial: S.tutorial,
  };
}
export function saveState(): string {
  const s: DuelSave = { ...publicState(), rng: S.rng, gameSeed: S.gameSeed };
  return JSON.stringify(s);
}
/** Zustand übernehmen (Server: gespeicherter Stand, Client: Stand vom Server) */
export function loadState(s: DuelState & Partial<Pick<DuelSave, 'rng' | 'gameSeed'>>): void {
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
  S.heartsTurn = s.heartsTurn ?? 0;
  S.paintSeed = s.paintSeed;
  S.stamp = s.stamp;
  S.log = s.log;
  S.tutorial = s.tutorial ?? 0;
  S.rng = s.rng ?? 0;
  S.gameSeed = s.gameSeed ?? 0;
  S.events = [];
}
/** Der letzte Wurf mit Würfeln und Seiten */
export function lastRolled(): Rolled[] {
  return S.lastRoll.map((r) => {
    const u = unitById(r.id)!;
    return { u, fi: r.fi, face: u.faces[r.fi]! };
  });
}

/** Der Rivale eröffnet, danach ist der Spieler dran */
export function openDuel(): Ev[] {
  aiOpening(2, S.level);
  S.phase = 'opening';
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
    const list = netAt(u, o as number, at as number);
    if (!list || !validNet(1, list)) bad('The net does not fit there.');
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
      S.phase = 'roll';
      break;
    }
    case 'roll': {
      if (S.phase !== 'roll') bad('Not the time to roll.');
      const need = Math.min(ROLL_N, living(me).length);
      const ids = Array.isArray(a.ids) ? [...new Set(a.ids)] : [];
      if (ids.length !== need) bad(`Pick ${need} dice.`);
      const us = ids.map((id) => own(id));
      if (us.some((u) => u.state === 'gone')) bad('That die is lost.');
      const rolled = rollDice(me, us);
      sync();
      S.phase = summonable(me, rolled).length ? 'summon' : 'act';
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
      if (S.phase !== 'summon' && S.phase !== 'act') bad('Not your turn.');
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
  const acts: Action[] = ['stamp', 'splash', 'soak', 'ability'];
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
  } else if (kind === 'ability') {
    const targets = abilityTargets(u);
    at = ABILITY[u.m.bp].target === 'self' ? idx(u.x, u.y) : isInt(a.at, 0, COLS * ROWS - 1) ? (a.at as number) : null;
    if (!targets.length || at === null || !targets.includes(at)) err = 'No target there.';
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
  if (S.phase === 'summon') {
    const u = summonable(me, lastRolled())[0];
    const p = u ? bestPlacement(u) : null;
    if (u && p) {
      logAdd(`You ${doSummon(u, p.o, p.at)}.`, 'you');
      S.joker = 0;
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
    S.phase = 'roll';
    S.lastRoll = [];
    S.joker = 0;
  }
}
