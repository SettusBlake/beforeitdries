/* Aufrufe an den Server. Der Server würfelt, der Client malt nur. */
import { DUEL_PROTOCOL, PROTO_HEADER, type BleachInfo, type CleanTestResponse, type DiceResponse, type DuelResponse, type ErrorCode, type ErrorResponse, type GalleryResponse, type GalleryStatus, type MarketFilter, type MarketResponse, type MarketSort, type NamingResponse, type PlayInfo, type ReviewResponse, type ShareResponse, type ShareSheetResponse, type SheetResponse, type SpeciesResponse, type TradeCollection, type TradeResponse } from '../../shared/api';
import type { BrushId, PullKind, StyleId } from '../../shared/dice';
import type { ColorId } from '../../shared/colors';
import type { DuelAction } from '../../shared/duel/play';
import type { Level } from '../../shared/duel/rules';
import type { PigmentId } from '../../shared/data';

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number,
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
  if (!res.ok || !json) throw new ApiError(json?.code ?? 'server', json?.error ?? `Error ${res.status}`, res.status);
  return json;
}

export const api = {
  duel: () => call<DuelResponse>('/api/duel'),
  duelStart: (level: Level, tutorial = false, gallery = false) => call<DuelResponse>('/api/duel/start', { level, tutorial, gallery }),
  duelAct: (action: DuelAction) => call<DuelResponse>('/api/duel/act', { action }),
  /** Bleach: das Tagesblatt */
  bleach: () => call<BleachInfo & { state: DuelResponse['state'] }>('/api/bleach'),
  bleachStart: (test = false) => call<DuelResponse>('/api/bleach/start', { test }),
  bleachAct: (action: DuelAction) => call<DuelResponse>('/api/bleach/act', { action }),
  bleachShare: (test = false) => call<ShareSheetResponse>('/api/bleach/share', { test }),
  sheet: (n?: number) => call<SheetResponse>(n ? `/api/sheet?n=${n}` : '/api/sheet'),
  play: () => call<PlayInfo>('/api/play'),
  dice: () => call<DiceResponse>('/api/dice'),
  dicePull: (kind: PullKind, brush: BrushId = 'plain') => call<DiceResponse>('/api/dice/pull', { kind, brush }),
  diceBag: (ids: string[]) => call<DiceResponse>('/api/dice/bag', { ids }),
  diceGlaze: (id: string, face: number) => call<DiceResponse>('/api/dice/glaze', { id, face }),
  diceTint: (id: string, face: number, pig: PigmentId) => call<DiceResponse>('/api/dice/tint', { id, face, pig }),
  diceWash: (id: string, confirm = false) => call<DiceResponse>('/api/dice/wash', { id, confirm }),
  diceDraw: (drawing: string) => call<DiceResponse>('/api/dice/draw', { drawing }),
  diceTestBlank: () => call<DiceResponse>('/api/dice/test-blank', {}),
  diceTestPigment: () => call<DiceResponse>('/api/dice/test-pigment', {}),
  diceTestStage: (stage: number | null) => call<DiceResponse>('/api/dice/test-stage', { stage }),
  modCleanTest: () => call<CleanTestResponse>('/api/mod/clean-test', {}),
  diceTestShiny: (style: StyleId | null, holo = false) => call<DiceResponse>('/api/dice/test-shiny', { style, holo }),
  diceSeen: () => call<DiceResponse>('/api/dice/seen', {}),
  lessonDone: () => call<DiceResponse>('/api/dice/lesson', {}),
  diceShare: (id: string) => call<ShareResponse>('/api/dice/share', { id }),
  species: () => call<SpeciesResponse>('/api/species'),
  naming: () => call<NamingResponse>('/api/naming'),
  review: () => call<ReviewResponse>('/api/review'),
  reviewOk: (key: string) => call<ReviewResponse>('/api/review/ok', { key }),
  reviewOver: (key: string) => call<ReviewResponse>('/api/review/over', { key }),
  reviewUnlock: (uid: string) => call<ReviewResponse>('/api/review/unlock', { uid }),
  galleryFind: (another = false) => call<GalleryResponse>('/api/gallery/find', { another }),
  galleryCollect: () => call<DiceResponse & { gallery: GalleryStatus; collected: number }>('/api/gallery/collect', {}),
  galleryHang: (on: boolean) => call<DiceResponse & { gallery: GalleryStatus }>('/api/gallery/hang', { on }),
  galleryTestDecks: () => call<{ made: string[] }>('/api/gallery/test-decks', {}),
  galleryTestSelf: (on: boolean) => call<DiceResponse & { gallery: GalleryStatus }>('/api/gallery/test-self', { on }),
  diceColor: (color: ColorId, color2: ColorId) => call<DiceResponse>('/api/dice/color', { color, color2 }),
  drawReport: (slot: number) => call<{ reported: number; left: number }>('/api/drawn/report', { slot }),
  /* Markt und Tausch (docs/entwuerfe/tausch-und-markt-plan.md) */
  marketList: (filter: MarketFilter = 'all', sort: MarketSort = 'new') => call<MarketResponse>('/api/market/list', { filter, sort }),
  marketSell: (id: string, price: number, confirm = false) => call<MarketResponse>('/api/market/sell', { id, price, confirm }),
  marketUnlist: (id: string) => call<MarketResponse>('/api/market/unlist', { id }),
  marketBuy: (id: string) => call<MarketResponse>('/api/market/buy', { id }),
  marketTestList: () => call<MarketResponse>('/api/market/test-list', {}),
  marketTestBuy: () => call<MarketResponse>('/api/market/test-buy', {}),
  tradeList: () => call<TradeResponse>('/api/trade/list', {}),
  tradeCollection: (name: string) => call<TradeCollection>('/api/trade/collection', { name }),
  tradeOffer: (to: string, give: string[], pig: number, want: string[], confirm = false) => call<TradeResponse>('/api/trade/offer', { to, give, pig, want, confirm }),
  tradeAccept: (id: string, confirm = false) => call<TradeResponse>('/api/trade/accept', { id, confirm }),
  tradeDecline: (id: string) => call<TradeResponse>('/api/trade/decline', { id }),
  tradeCancel: (id: string) => call<TradeResponse>('/api/trade/cancel', { id }),
  tradeMsg: (on: boolean) => call<DiceResponse>('/api/trade/msg', { on }),
  tradeTestOffer: () => call<TradeResponse>('/api/trade/test-offer', {}),
  /* Tägliche Aktivität: Beitreten (nur auf Tipp) und Strähne als Flair */
  join: () => call<{ ok: true; sub: string }>('/api/join', {}),
  streakFlair: (on: boolean) => call<DiceResponse>('/api/streak/flair', { on }),
};
