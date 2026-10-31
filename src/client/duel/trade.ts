/*
 * Tausch im Client (docs/entwuerfe/tausch-und-markt-plan.md, Schritt 3): Angebote ansehen, annehmen, ablehnen, zurückziehen,
 * einem Spieler per u/Name ein Angebot machen. Geprüft und getauscht wird am Server, alles auf einmal oder gar nichts
 */
import type { DiceResponse, TradeCollection, TradeOffer, TradeResponse } from '../../shared/api';
import { dieMonster, TRADE, type DiceSave, type DieRec } from '../../shared/dice';
import { dieUnit } from '../../shared/duel/rules';
import { api } from '../lib/api';
import { foeTag } from './gallery';
import { marketSellers, pig, tile } from './market';
import { sfx } from './sound';

const $ = (id: string) => document.getElementById(id)!;
function el(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
const unitOf = (d: DieRec) => dieUnit(dieMonster(d), d.mods);
const precious = (d: DieRec) => !!d.holo || unitOf(d).rarity === 'legendary';
const DAY = 86_400_000;
const names = (xs: DieRec[]) => xs.map((x) => unitOf(x).name).join(', ');

type Hooks = { view: (d: DieRec) => void; dice: (r: DiceResponse) => void; save: () => DiceSave | null; error: (e: unknown) => void };
let hooks: Hooks = { view: () => undefined, dice: () => undefined, save: () => null, error: () => undefined };
let last: TradeResponse | null = null;
let busy = false;
/** Angebot, dessen Annehmen oder Ablehnen schon einmal angetippt wurde */
let armed: string | null = null;

/* ---------- Angebote ---------- */
function diceRow(xs: DieRec[], extra = ''): HTMLElement {
  const row = el('div', 'tgrid');
  xs.forEach((d, i) => {
    const t = tile(d, i);
    t.addEventListener('click', () => hooks.view(d));
    row.append(t);
  });
  if (extra) {
    const p = el('span', 'tpig');
    p.innerHTML = `+ ${extra}`;
    row.append(p);
  }
  return row;
}
function offerCard(o: TradeOffer): HTMLElement {
  const c = el('div', 'offer ' + o.dir);
  const left = Math.max(0, Math.ceil((o.until - Date.now()) / DAY));
  const head = el('p', 'ohead');
  head.innerHTML = o.dir === 'in' ? `From <b>${foeTag(o.from)}</b> · ${left} day${left === 1 ? '' : 's'} left` : `To <b>${foeTag(o.to)}</b> · ${left} day${left === 1 ? '' : 's'} left`;
  const give = el('div', 'oside');
  give.append(el('p', 'eyebrow', o.dir === 'in' ? 'You get' : 'You give'), diceRow(o.give, o.pig ? pig(o.pig) : ''));
  const want = el('div', 'oside');
  want.append(el('p', 'eyebrow', o.dir === 'in' ? 'You give' : 'You get'), diceRow(o.want));
  const btns = el('div', 'gal-btns');
  if (o.dir === 'in') {
    const ok = el('button', 'primary') as HTMLButtonElement;
    ok.type = 'button';
    const risky = o.want.some(precious);
    ok.textContent = armed === `a:${o.id}` ? (risky ? 'Something precious leaves. Tap again' : 'Tap again to trade') : 'Accept';
    ok.disabled = busy || !last?.gate.ok;
    ok.addEventListener('click', () => {
      if (armed !== `a:${o.id}`) {
        armed = `a:${o.id}`;
        sfx.tap();
        return render();
      }
      void act(() => api.tradeAccept(o.id, true), 'triple');
    });
    const no = el('button', 'ghost', armed === `d:${o.id}` ? 'Tap again' : 'Decline') as HTMLButtonElement;
    no.type = 'button';
    no.disabled = busy;
    no.addEventListener('click', () => {
      if (armed !== `d:${o.id}`) {
        armed = `d:${o.id}`;
        sfx.tap();
        return render();
      }
      void act(() => api.tradeDecline(o.id), null);
    });
    btns.append(ok, no);
  } else {
    const back = el('button', 'ghost', armed === `c:${o.id}` ? 'Tap again to take it back' : 'Take it back') as HTMLButtonElement;
    back.type = 'button';
    back.disabled = busy;
    back.addEventListener('click', () => {
      if (armed !== `c:${o.id}`) {
        armed = `c:${o.id}`;
        sfx.tap();
        return render();
      }
      void act(() => api.tradeCancel(o.id), null);
    });
    btns.append(back);
  }
  c.append(head, give, el('div', 'oarrow', '⇄'), want, btns);
  return c;
}

async function act(fn: () => Promise<TradeResponse>, sound: 'triple' | null): Promise<void> {
  if (busy) return;
  busy = true;
  armed = null;
  render();
  try {
    last = await fn();
    if (last.dice) hooks.dice(last.dice);
    if (sound) sfx.combo(sound);
  } catch (e) {
    hooks.error(e);
    void refresh();
  }
  busy = false;
  render();
}

function render(): void {
  const v = last;
  $('tr-gate').hidden = !v || v.gate.ok;
  $('tr-gate').textContent = v?.gate.why ?? '';
  const list = $('tr-list');
  list.replaceChildren();
  const ins = v?.offers.filter((o) => o.dir === 'in') ?? [];
  const outs = v?.offers.filter((o) => o.dir === 'out') ?? [];
  if (!v) list.append(el('p', 'empty', busy ? 'Looking for letters…' : ''));
  else if (!v.offers.length) list.append(el('p', 'empty', 'No offers right now. Make one: pick a painter, pick their dice, pick yours.'));
  if (ins.length) list.append(el('p', 'eyebrow', 'Offers to you'), ...ins.map(offerCard));
  if (outs.length) list.append(el('p', 'eyebrow', 'Your offers'), ...outs.map(offerCard));
  ($('tr-new') as HTMLButtonElement).disabled = busy || !v?.gate.ok;
  $('tr-note').textContent = `Trades today ${v?.trades ?? 0}/${TRADE.perDay} · up to ${TRADE.maxDice} dice on each side and ${TRADE.maxPig} pigment · offers last ${TRADE.days} days`;
  const s = hooks.save();
  const msg = $('tr-msg') as HTMLInputElement;
  msg.checked = !!s?.tradeMsg;
  msg.disabled = busy;
}
async function refresh(): Promise<void> {
  busy = true;
  render();
  try {
    last = await api.tradeList();
  } catch (e) {
    hooks.error(e);
  }
  busy = false;
  render();
}
export function openTrades(): void {
  sfx.tap();
  armed = null;
  $('trades').hidden = false;
  void refresh();
}

/* ---------- Neues Angebot ---------- */
let other: TradeCollection | null = null;
let want = new Set<string>();
let give = new Set<string>();
let gift = 0;
let sendArmed = false;

/** Deine handelbaren Würfel: keine Startwürfel, nicht im Deck */
const mineFree = (s: DiceSave) => s.dice.filter((x) => !x.bound && !s.bag.includes(x.id));

function pickGrid(xs: DieRec[], sel: Set<string>, onTap: () => void): HTMLElement {
  const g = el('div', 'gal-grid mk-grid pick');
  xs.forEach((d, i) => {
    const t = tile(d, i);
    if (sel.has(d.id)) t.classList.add('on');
    t.append(el('small', '', unitOf(d).name));
    t.addEventListener('click', () => {
      if (sel.has(d.id)) sel.delete(d.id);
      else if (sel.size < TRADE.maxDice) sel.add(d.id);
      else return;
      sfx.tap();
      sendArmed = false;
      onTap();
    });
    g.append(t);
  });
  return g;
}

function renderNew(): void {
  const s = hooks.save();
  const body = $('tn-body');
  body.replaceChildren();
  // Vorschläge: Verkäufer im Markt und Partner der letzten Angebote
  const known = [...new Set([...(last?.offers ?? []).map((o) => (o.dir === 'in' ? o.from : o.to)), ...marketSellers()])].filter(Boolean).slice(0, 6);
  const sug = $('tn-sug');
  sug.replaceChildren();
  for (const n of known) {
    const b = el('button', other && other.name === n ? 'on' : '', foeTag(n)) as HTMLButtonElement;
    b.type = 'button';
    b.addEventListener('click', () => {
      ($('tn-name') as HTMLInputElement).value = n;
      void look(n);
    });
    sug.append(b);
  }
  if (!other) {
    body.append(el('p', 'empty', busy ? 'Knocking on their door…' : 'Type a Reddit name of someone who has played, or pick one above.'));
    ($('tn-send') as HTMLButtonElement).disabled = true;
    $('tn-send').textContent = 'Send offer';
    return;
  }
  if (!other.can) body.append(el('p', 'mk-gate', other.why ?? 'They cannot trade yet.'));
  body.append(el('p', 'eyebrow', `You get · from ${foeTag(other.name)} (${want.size}/${TRADE.maxDice})`));
  if (!other.dice.length) body.append(el('p', 'empty', 'They have nothing to trade: only starter dice or dice in their deck.'));
  else body.append(pickGrid(other.dice, want, renderNew));
  const mine = s ? mineFree(s) : [];
  body.append(el('p', 'eyebrow', `You give (${give.size}/${TRADE.maxDice})`));
  if (!mine.length) body.append(el('p', 'empty', 'All your dice are starters or in your deck. Take one out of the deck, or dip the brush.'));
  else body.append(pickGrid(mine, give, renderNew));
  // Pigment dazu
  const pg = el('div', 'stepper');
  const minus = el('button', '', '−') as HTMLButtonElement;
  const plus = el('button', '', '+') as HTMLButtonElement;
  minus.type = plus.type = 'button';
  const val = el('b');
  val.innerHTML = pig(gift);
  minus.addEventListener('click', () => {
    gift = Math.max(0, gift - 25);
    sendArmed = false;
    sfx.tap();
    renderNew();
  });
  plus.addEventListener('click', () => {
    gift = Math.min(TRADE.maxPig, s ? Math.min(s.pigment, gift + 25) : gift);
    sendArmed = false;
    sfx.tap();
    renderNew();
  });
  pg.append(minus, val, plus);
  const pr = el('div', 'tn-pig');
  pr.append(el('span', '', 'plus pigment'), pg);
  body.append(pr);
  const gives = s ? s.dice.filter((x) => give.has(x.id)) : [];
  const ok = other.can && want.size > 0 && (give.size > 0 || gift > 0);
  const risky = gives.some(precious);
  const send = $('tn-send') as HTMLButtonElement;
  send.disabled = busy || !ok;
  send.textContent = sendArmed ? (risky ? 'Something precious leaves. Tap again' : 'Tap again to send') : 'Send offer';
  $('tn-sum').textContent = ok ? `${names(gives) || 'nothing'}${gift ? ` and ${gift} pigment` : ''} for ${names(other.dice.filter((x) => want.has(x.id)))}.` : '';
}

async function look(name: string): Promise<void> {
  const n = name.trim();
  if (!n || busy) return;
  busy = true;
  other = null;
  want = new Set();
  give = new Set();
  gift = 0;
  sendArmed = false;
  renderNew();
  try {
    other = await api.tradeCollection(n);
  } catch (e) {
    hooks.error(e);
  }
  busy = false;
  renderNew();
}
async function send(): Promise<void> {
  if (!other || busy) return;
  if (!sendArmed) {
    sendArmed = true;
    sfx.tap();
    return renderNew();
  }
  busy = true;
  renderNew();
  try {
    last = await api.tradeOffer(other.name, [...give], gift, [...want], true);
    if (last.dice) hooks.dice(last.dice);
    sfx.combo('pair');
    $('tradenew').hidden = true;
    other = null;
    render();
  } catch (e) {
    hooks.error(e);
  }
  busy = false;
  sendArmed = false;
  renderNew();
}
function openNew(): void {
  sfx.tap();
  other = null;
  want = new Set();
  give = new Set();
  gift = 0;
  sendArmed = false;
  ($('tn-name') as HTMLInputElement).value = '';
  $('tradenew').hidden = false;
  renderNew();
}
/** Nach dem Test-Knopf: Liste übernehmen und öffnen */
export function showTrades(r: TradeResponse): void {
  last = r;
  armed = null;
  $('trades').hidden = false;
  render();
}

export function initTrades(h: Hooks): void {
  hooks = h;
  $('tr-close').addEventListener('click', () => ($('trades').hidden = true));
  $('trades').addEventListener('click', (e) => {
    if (e.target === $('trades')) $('trades').hidden = true;
  });
  $('tr-new').addEventListener('click', openNew);
  $('tn-close').addEventListener('click', () => ($('tradenew').hidden = true));
  $('tn-look').addEventListener('click', () => void look(($('tn-name') as HTMLInputElement).value));
  $('tn-name').addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') void look(($('tn-name') as HTMLInputElement).value);
  });
  $('tn-send').addEventListener('click', () => void send());
  $('tr-msg').addEventListener('change', () => {
    const on = ($('tr-msg') as HTMLInputElement).checked;
    void (async () => {
      busy = true;
      render();
      try {
        hooks.dice(await api.tradeMsg(on));
      } catch (e) {
        hooks.error(e);
      }
      busy = false;
      render();
    })();
  });
}
