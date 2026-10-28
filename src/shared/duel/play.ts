/*
 * Ein Duell als Folge von Aktionen. Der Server lädt den Zustand, führt eine Aktion aus (würfelt dabei)
 * und speichert. Jede Aktion wird vorher geprüft, der Client kann nichts erzwingen.
 */
import type { PigmentId } from '../data';
import {
  ABILITY,
  aiOpening,
  aiTurnSteps,
  abilityTargets,
  act,
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
  reach,
  rollDice,
  ROLL_N,
  S,
  splashCells,
  startTurn,
  summonable,
  sync,
  TUNE,
  unitById,
  validNet,
  COLS,
  ROWS,
  type Action,
  type Cell,
  type Ev,
  type Level,
  type Phase,
  type Rolled,
  type Side,
  type Team,
} from './rules';

export type DuelAction =
  | { k: 'open'; id: number; o: number; at: number }
  | { k: 'roll'; ids: number[] }
  | { k: 'summon'; id: number; o: number; at: number }
  | { k: 'skip' }
  | { k: 'move'; id: number; to: number }
  | { k: 'act'; id: number; a: Action; pig: PigmentId; at: number | null }
  | { k: 'end' };

/** Was der Client sieht: alles außer Würfelzufall und Seed */
export type DuelState = {
  v: 1;
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
  paintSeed: number;
  stamp: number;
  log: { t: string; c: string }[];
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
    v: 1,
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
    paintSeed: S.paintSeed,
    stamp: S.stamp,
    log: S.log.slice(0, 40),
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
  S.paintSeed = s.paintSeed;
  S.stamp = s.stamp;
  S.log = s.log;
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
      sync();
      S.phase = 'act';
      break;
    }
    case 'skip': {
      if (S.phase !== 'summon') bad('Nothing to skip.');
      S.phase = 'act';
      break;
    }
    case 'move': {
      if (S.phase !== 'act') bad('Not your move.');
      const u = own(a.id);
      if (u.state !== 'sheet' || u.acted || !canMove(u)) bad('That blot cannot move.');
      const prev = reach(u);
      if (!isInt(a.to, 0, COLS * ROWS - 1) || !prev.has(a.to) || a.to === idx(u.x, u.y)) bad('It cannot get there.');
      const note = doMove(u, a.to, prev);
      logAdd(`Your ${u.name} moved${note ? ` and ${note}` : ''}.`, 'you');
      break;
    }
    case 'act': {
      if (S.phase !== 'act') bad('Not your move.');
      const u = own(a.id);
      const acts: Action[] = ['dry', 'wet', 'splash', 'soak', 'ability'];
      if (!acts.includes(a.a)) bad('Unknown action.');
      if (!canAct(u, a.a)) bad('That blot cannot do that now.');
      if (a.pig !== u.m.main && a.pig !== u.sec) bad('Unknown colour.');
      let at: number | null = null;
      if (a.a === 'dry' || a.a === 'wet') {
        if (!isInt(a.at, 0, COLS * ROWS - 1) || !canPaintAt(u, a.at)) bad('Out of reach.');
        at = a.at;
      } else if (a.a === 'splash') {
        if (!isInt(a.at, 0, COLS * ROWS - 1) || !splashCells(u).includes(a.at)) bad('Nothing to splash there.');
        at = a.at;
      } else if (a.a === 'ability') {
        const targets = abilityTargets(u);
        if (!targets.length) bad('No target for that ability.');
        at = ABILITY[u.m.bp].target === 'self' ? idx(u.x, u.y) : a.at;
        if (at === null || !targets.includes(at)) bad('No target there.');
      }
      const s = act(u, a.a, a.a === 'soak' || a.a === 'ability' ? u.m.main : a.pig, at);
      logAdd(`Your ${u.name} ${s}.`, 'you');
      if (S.over) S.phase = 'over';
      break;
    }
    case 'end': {
      if (S.phase !== 'act' && S.phase !== 'summon') bad('Not your turn.');
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
      }
      break;
    }
    default:
      bad('Unknown action.');
  }
  if (S.over) S.phase = 'over';
  return drain();
}
