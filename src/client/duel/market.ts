/*
 * Markt im Client (docs/entwuerfe/tausch-und-markt-plan.md, Schritt 2): Würfel anderer Spieler ansehen und kaufen,
 * eigene einstellen und zurücknehmen. Geprüft, bezahlt und geliefert wird am Server, hier wird nur gezeigt und angetippt
 */
import type { DiceResponse, MarketFilter, MarketItem, MarketResponse, MarketSort, TradeGate, TradeStatus } from '../../shared/api';
import { defaultBand, dieMonster, marketFee, priceKey, rarityDef, serialText, styleDef, TRADE, type DieRec, type Rarity } from '../../shared/dice';
import { dieUnit } from '../../shared/duel/rules';
import { monsterSeed } from '../../shared/monster';
import { addHolo } from '../lib/holo';
import { painted } from '../lib/painter';
import { api } from '../lib/api';
import { foeTag } from './gallery';
import { iconSvg } from './icons';
import { sfx } from './sound';

const $ = (id: string) => document.getElementById(id)!;
function el(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
const dpr = () => Math.min(2, window.devicePixelRatio || 1);
const pig = (n: number) => `<i class="pigi"></i>${n.toLocaleString('en')}`;
const unitOf = (d: DieRec) => dieUnit(dieMonster(d), d.mods);
const DAY = 86_400_000;

type Hooks = { open: (item: MarketItem) => void; dice: (r: DiceResponse) => void; error: (e: unknown) => void };
let hooks: Hooks = { open: () => undefined, dice: () => undefined, error: () => undefined };
let last: MarketResponse | null = null;
let status: TradeStatus | null = null;
let filter: MarketFilter = 'all';
let sort: MarketSort = 'new';
let busy = false;

/** Stand für die Knöpfe in „Your dice“ (kommt mit dem Laden der Sammlung) */
export const setTradeStatus = (s: TradeStatus | undefined): void => {
  if (s) status = s;
};
export const tradeStatusNow = (): TradeStatus | null => status;
export const marketGate = (): TradeGate | null => last?.gate ?? status?.gate ?? null;

/* ---------- Herkunft ---------- */
const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
/** „Pulled by u/a on 29 Oct · bought by u/b for 340 · traded to u/c“ */
export function provText(d: DieRec): string {
  return (d.hist ?? [])
    .map((h, i) =>
      h.how === 'pull'
        ? `Pulled by <b>${foeTag(h.u)}</b> on ${day(h.at)}`
        : h.how === 'market'
          ? `${i ? 'bought' : 'Bought'} by <b>${foeTag(h.u)}</b> for ${h.p ?? '?'}`
          : `${i ? 'traded' : 'Traded'} to <b>${foeTag(h.u)}</b> on ${day(h.at)}`,
    )
    .join(' · ');
}

/* ---------- Preise ---------- */
/** Richtwert für diesen Würfel: Verkäufe der letzten Woche, sonst aus dem Ziehen */
export function priceHint(d: DieRec): { band: [number, number]; n: number } {
  const r = unitOf(d).rarity;
  const k = priceKey(r, !!d.holo, !!d.style);
  const band = last?.hint[k];
  return band ? { band, n: last?.hintN[k] ?? 0 } : { band: defaultBand(r, !!d.holo, !!d.style), n: 0 };
}
const stepOf = (p: number) => (p < 100 ? 5 : p < 1000 ? 10 : p < 10_000 ? 50 : 500);
const clampPrice = (p: number) => Math.max(TRADE.minPrice, Math.min(TRADE.maxPrice, Math.round(p)));
const label = (r: Rarity) => rarityDef(r).label;

/**
 * Verkaufen auf der Karte: Preis wählen, Richtwert und Gebühr sehen, einstellen. Holo und Legendary fragen nach.
 * done: nach dem Einstellen (Karte schließen)
 */
export function sellBox(d: DieRec, done: () => void): HTMLElement {
  const box = el('div', 'sellbox');
  const r = unitOf(d).rarity;
  const precious = !!d.holo || r === 'legendary';
  let price = Math.round((priceHint(d).band[0] + priceHint(d).band[1]) / 2 / 5) * 5;
  let armed = false;
  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'numeric';
  input.min = String(TRADE.minPrice);
  input.max = String(TRADE.maxPrice);
  const hint = el('p', 'hint');
  const fee = el('p', 'fee');
  const go = el('button', 'primary') as HTMLButtonElement;
  go.type = 'button';
  const paint = () => {
    input.value = String(price);
    const h = priceHint(d);
    const kind = `${label(r)}${d.holo ? ' holo' : ''}${d.style ? ` ${styleDef(d.style).label}` : ''}`;
    hint.innerHTML = h.n ? `${kind} dice sold for <b>${h.band[0]} to ${h.band[1]}</b> this week.` : `A ${kind} usually goes for <b>${h.band[0]} to ${h.band[1]}</b>.`;
    const f = marketFee(price);
    fee.innerHTML = `A tenth goes down the drain: you get <b>${price - f}</b>. Listed for ${TRADE.days} days, then it comes back.`;
    go.textContent = armed ? `It is ${d.holo ? 'holo' : 'legendary'}. Tap again to list for ${price}` : `List for ${price}`;
  };
  const step = (dir: number) => () => {
    sfx.tap();
    price = clampPrice(price + dir * stepOf(dir > 0 ? price : price - 1));
    armed = false;
    paint();
  };
  const minus = el('button', '', '−') as HTMLButtonElement;
  const plus = el('button', '', '+') as HTMLButtonElement;
  minus.type = plus.type = 'button';
  minus.addEventListener('click', step(-1));
  plus.addEventListener('click', step(1));
  input.addEventListener('change', () => {
    price = clampPrice(Number(input.value) || price);
    armed = false;
    paint();
  });
  const stepper = el('div', 'stepper');
  const val = el('b');
  val.append(Object.assign(document.createElement('i'), { className: 'pigi' }), input);
  stepper.append(minus, val, plus);
  go.addEventListener('click', () => {
    if (busy) return;
    if (precious && !armed) {
      armed = true;
      sfx.tap();
      return paint();
    }
    void (async () => {
      busy = true;
      go.disabled = true;
      try {
        const res = await api.marketSell(d.id, price, precious);
        last = res;
        if (res.dice) hooks.dice(res.dice);
        sfx.combo('pair');
        done();
      } catch (e) {
        hooks.error(e);
      }
      busy = false;
      go.disabled = false;
    })();
  });
  box.append(el('p', 'eyebrow', 'Sell on the market'), stepper, hint, fee, go);
  paint();
  // Richtwerte aus den letzten Verkäufen nachladen
  if (!last)
    void api
      .marketList()
      .then((res) => {
        last = res;
        price = Math.round((priceHint(d).band[0] + priceHint(d).band[1]) / 2 / 5) * 5;
        paint();
      })
      .catch(() => undefined);
  return box;
}

/* ---------- Kaufen auf der Karte ---------- */
/** Kaufen oder (eigener Eintrag) zurücknehmen. Zwei Tipps zum Kaufen */
export function buyBox(item: MarketItem, mine: number, done: () => void): HTMLElement {
  const box = el('div', 'buybox');
  const left = Math.max(0, Math.ceil((item.until - Date.now()) / DAY));
  box.append(el('p', '', item.mine ? `Your listing · ${left > 0 ? `${left} day${left > 1 ? 's' : ''} left` : 'coming back to you'}` : `Sold by ${foeTag(item.seller)} · ${left > 0 ? `${left} day${left > 1 ? 's' : ''} left` : 'about to go back'}`));
  const go = el('button', 'primary') as HTMLButtonElement;
  go.type = 'button';
  const small = el('small');
  const g = marketGate();
  let armed = false;
  const paint = () => {
    if (item.mine) go.textContent = 'Take it back';
    else go.innerHTML = armed ? `Tap again to buy for ${pig(item.price)}` : `Buy for ${pig(item.price)}`;
    const buys = last?.buys ?? 0;
    small.textContent = item.mine ? '' : !g?.ok ? (g?.why ?? 'You cannot trade yet.') : mine < item.price ? `You have ${mine} pigment. Duels bring more.` : `You have ${mine.toLocaleString('en')} pigment · purchases today ${buys}/${TRADE.buysPerDay}`;
    go.disabled = busy || (!item.mine && (!g?.ok || mine < item.price || buys >= TRADE.buysPerDay));
  };
  go.addEventListener('click', () => {
    if (busy) return;
    if (!item.mine && !armed) {
      armed = true;
      sfx.tap();
      return paint();
    }
    void (async () => {
      busy = true;
      paint();
      try {
        const res = item.mine ? await api.marketUnlist(item.id) : await api.marketBuy(item.id);
        last = res;
        if (res.dice) hooks.dice(res.dice);
        sfx.combo(item.mine ? 'pair' : 'triple');
        done();
        render();
      } catch (e) {
        hooks.error(e);
        // Weg oder zu teuer: Liste neu laden
        void refresh();
      }
      busy = false;
      paint();
    })();
  });
  paint();
  box.append(go, small);
  return box;
}

/* ---------- Markt-Fenster ---------- */
/** Bild eines fremden Würfels (Schlüssel mit dem Seed: IDs gibt es bei jedem Spieler) */
function tile(d: DieRec, i: number): HTMLElement {
  const u = unitOf(d);
  const box = el('button', 'gd' + (d.holo ? ' holo-rim' : '')) as HTMLButtonElement;
  box.type = 'button';
  box.style.setProperty('--c', rarityDef(u.rarity).col);
  box.title = u.name;
  const px = 72;
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(px * dpr());
  c.classList.add('wet');
  const key = `mk:${d.sheet}:${d.idx}:${d.paper ?? ''}:${d.gen ?? 1}:${d.style ?? ''}:${d.draw ? d.draw.length + d.draw.slice(-12) : ''}:${px}`;
  void painted(key, dieMonster(d), px, { dpr: dpr(), quality: 'lite' }, 2 + (30 - i) / 30).then((src) => {
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
    c.classList.remove('wet');
  });
  if (d.holo) {
    const f = el('div', 'hwrap');
    f.append(c);
    addHolo(f, monsterSeed(d.sheet, d.idx), box);
    box.append(f);
  } else box.append(c);
  const lv = el('span', 'lvb');
  lv.innerHTML = iconSvg({ k: 'star', n: u.lv }, 12);
  box.append(lv, el('span', 'rar', rarityDef(u.rarity).label));
  if (d.style) box.append(el('span', 'mark', styleDef(d.style).label));
  return box;
}

const FILTERS: [MarketFilter, string][] = [
  ['all', 'All'],
  ['rare', 'Rare+'],
  ['holo', 'Holo'],
  ['style', 'Styles'],
  ['drawn', 'Drawn'],
];
const SORTS: [MarketSort, string][] = [
  ['new', 'Newest'],
  ['cheap', 'Cheapest'],
  ['dear', 'Dearest'],
];

function render(): void {
  const v = last;
  const fl = $('mk-filt');
  fl.replaceChildren();
  for (const [k, t] of FILTERS) {
    const b = el('button', filter === k ? 'on' : '', t) as HTMLButtonElement;
    b.type = 'button';
    b.addEventListener('click', () => {
      if (filter === k) return;
      sfx.tap();
      filter = k;
      void refresh();
    });
    fl.append(b);
  }
  const so = el('button', 'sort', `${SORTS.find((x) => x[0] === sort)![1]} ▾`) as HTMLButtonElement;
  so.type = 'button';
  so.addEventListener('click', () => {
    sfx.tap();
    sort = SORTS[(SORTS.findIndex((x) => x[0] === sort) + 1) % SORTS.length]![0];
    void refresh();
  });
  fl.append(so);
  const gate = v?.gate;
  $('mk-gate').hidden = !gate || gate.ok;
  $('mk-gate').textContent = gate?.why ?? '';
  const grid = $('mk-grid');
  grid.replaceChildren();
  if (!v) grid.append(el('p', 'empty', busy ? 'Looking at the stalls…' : ''));
  else if (!v.items.length) grid.append(el('p', 'empty', filter === 'all' ? 'Nothing for sale right now. Put one of yours up, or come back later.' : 'Nothing like that for sale right now.'));
  v?.items.forEach((it, i) => {
    const t = tile(it.die, i);
    const price = el('em', 'price');
    price.innerHTML = pig(it.price);
    t.append(price, el('small', '', foeTag(it.seller)));
    t.addEventListener('click', () => hooks.open(it));
    grid.append(t);
  });
  // Deine Einträge
  const mine = v?.mine ?? [];
  $('mk-mine-box').hidden = !mine.length;
  const mb = $('mk-mine');
  mb.replaceChildren();
  mine.forEach((it, i) => {
    const t = tile(it.die, i);
    const price = el('em', 'price');
    price.innerHTML = pig(it.price);
    const left = Math.max(0, Math.ceil((it.until - Date.now()) / DAY));
    t.append(price, el('small', '', left > 0 ? `${left}d left` : 'coming back'));
    t.addEventListener('click', () => hooks.open(it));
    mb.append(t);
  });
  $('mk-note').textContent = `Your listings ${mine.length}/${TRADE.listings} · purchases today ${v?.buys ?? 0}/${TRADE.buysPerDay} · a tenth of each sale goes down the drain`;
}

async function refresh(): Promise<void> {
  busy = true;
  render();
  try {
    last = await api.marketList(filter, sort);
  } catch (e) {
    hooks.error(e);
  }
  busy = false;
  render();
}
export function openMarket(): void {
  sfx.tap();
  $('market').hidden = false;
  void refresh();
}
export const marketOpen = (): boolean => !$('market').hidden;
/** Nach einem Test-Knopf: Liste übernehmen */
export function setMarket(r: MarketResponse): void {
  last = r;
  if (marketOpen()) render();
}

export function initMarket(h: Hooks): void {
  hooks = h;
  $('mk-close').addEventListener('click', () => ($('market').hidden = true));
  $('market').addEventListener('click', (e) => {
    if (e.target === $('market')) $('market').hidden = true;
  });
}
