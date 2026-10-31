/* Aufrufe an den Server. Der Server würfelt, der Client malt nur. */
import { DUEL_PROTOCOL, PROTO_HEADER, type CatchResponse, type CollectionResponse, type DiceResponse, type DuelResponse, type ErrorCode, type ErrorResponse, type GlazeResponse, type InitResponse, type NamingResponse, type PlayInfo, type ReviewResponse, type ShareResponse, type SpeciesResponse } from '../../shared/api';
import type { PullKind, StyleId } from '../../shared/dice';
import type { DuelAction } from '../../shared/duel/play';
import type { Level } from '../../shared/duel/rules';
import type { PigmentId } from '../../shared/data';

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number,
    public dryUntil?: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    const headers = { [PROTO_HEADER]: String(DUEL_PROTOCOL) };
    res = await fetch(path, body === undefined ? { headers } : { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError('server', 'No connection. The paint will wait.', 0);
  }
  const json = (await res.json().catch(() => null)) as (T & Partial<ErrorResponse>) | null;
  if (!res.ok || !json) throw new ApiError(json?.code ?? 'server', json?.error ?? `Error ${res.status}`, res.status, json?.dryUntil);
  return json;
}

export const api = {
  init: () => call<InitResponse>('/api/init'),
  collection: () => call<CollectionResponse>('/api/collection'),
  catchBlot: () => call<CatchResponse>('/api/catch', {}),
  glaze: (id: string, pigment: PigmentId) => call<GlazeResponse>('/api/glaze', { id, pigment }),
  duel: () => call<DuelResponse>('/api/duel'),
  duelStart: (level: Level, tutorial = false) => call<DuelResponse>('/api/duel/start', { level, tutorial }),
  duelAct: (action: DuelAction) => call<DuelResponse>('/api/duel/act', { action }),
  play: () => call<PlayInfo>('/api/play'),
  dice: () => call<DiceResponse>('/api/dice'),
  dicePull: (kind: PullKind) => call<DiceResponse>('/api/dice/pull', { kind }),
  diceBag: (ids: string[]) => call<DiceResponse>('/api/dice/bag', { ids }),
  diceGlaze: (id: string, face: number) => call<DiceResponse>('/api/dice/glaze', { id, face }),
  diceWash: (id: string, confirm = false) => call<DiceResponse>('/api/dice/wash', { id, confirm }),
  diceDraw: (drawing: string) => call<DiceResponse>('/api/dice/draw', { drawing }),
  diceTestBlank: () => call<DiceResponse>('/api/dice/test-blank', {}),
  diceTestShiny: (style: StyleId | null, holo = false) => call<DiceResponse>('/api/dice/test-shiny', { style, holo }),
  diceSeen: () => call<DiceResponse>('/api/dice/seen', {}),
  diceShare: (id: string) => call<ShareResponse>('/api/dice/share', { id }),
  species: () => call<SpeciesResponse>('/api/species'),
  naming: () => call<NamingResponse>('/api/naming'),
  review: () => call<ReviewResponse>('/api/review'),
  reviewOk: (key: string) => call<ReviewResponse>('/api/review/ok', { key }),
  reviewOver: (key: string) => call<ReviewResponse>('/api/review/over', { key }),
  reviewUnlock: (uid: string) => call<ReviewResponse>('/api/review/unlock', { uid }),
};

/** Abstand zwischen Server- und Geräteuhr, für Trockenzeit und Tagesende */
let skew = 0;
export const syncClock = (serverNow: number): void => {
  skew = serverNow - Date.now();
};
export const serverNow = (): number => Date.now() + skew;
