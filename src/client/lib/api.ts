/* Aufrufe an den Server. Der Server würfelt, der Client malt nur. */
import type { CatchResponse, CollectionResponse, DiceResponse, DuelResponse, ErrorCode, ErrorResponse, GlazeResponse, InitResponse, PlayInfo } from '../../shared/api';
import type { PullKind } from '../../shared/dice';
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
    res = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
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
};

/** Abstand zwischen Server- und Geräteuhr, für Trockenzeit und Tagesende */
let skew = 0;
export const syncClock = (serverNow: number): void => {
  skew = serverNow - Date.now();
};
export const serverNow = (): number => Date.now() + skew;
