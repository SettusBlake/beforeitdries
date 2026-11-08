/*
 * Tagesgeschenk und Morgen-Zeile im Startbild (T8 und T9, freigegeben am 08.11.2026,
 * docs/entwuerfe/taegliche-aktivitaet-vorschlag.md Fassung 3). Der Server zahlt, hier wird nur gezeigt:
 * sieben Töpfe, der heutige leuchtet, ein Tipp öffnet ihn mit einem Satz von Sepia. Darunter steht, was heute
 * noch wartet, und wenn alles erledigt ist, was morgen kommt.
 */
import { GIFTS, giftIndex, giftShort, nextDay, sheetRule, type Gift, type SheetRule } from '../../shared/daily';
import { PIG, type PigmentId } from '../../shared/data';
import type { DiceSave } from '../../shared/dice';
import type { GiftResult } from '../../shared/api';
import { mediumDef } from '../../shared/duel/media';
import { dropIcon } from './faceskin';
import { sfx } from './sound';
import './gift.css';

const el = (tag: string, cls = '', text = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const html = (tag: string, cls: string, inner: string): HTMLElement => {
  const e = el(tag, cls);
  e.innerHTML = inner;
  return e;
};

/** Pigment-Topf, Pinsel und Haken (eigene kleine Zeichen, lizenzfrei) */
const potSvg = (s = 18) =>
  `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="M5 9c0-3 3-5.5 7-5.5S19 6 19 9v6.5c0 2.6-3.1 4.5-7 4.5s-7-1.9-7-4.5z" fill="#fffdf8" stroke="#3a3330" stroke-width="1.2"/><path d="M5.4 12.2c2.2 1.6 10.9 1.6 13.2 0v3.3c0 2.2-2.9 3.7-6.6 3.7s-6.6-1.5-6.6-3.7z" fill="#b01e3e"/><ellipse cx="12" cy="8.6" rx="5.6" ry="2.2" fill="none" stroke="#3a3330" stroke-width="1"/></svg>`;
const brushSvg = (s = 28) =>
  `<svg viewBox="0 0 32 32" width="${s}" height="${s}" aria-hidden="true"><path d="M21 3.5l7.5 7.5-11 11-7.5-7.5z" fill="#8a6410"/><path d="M10 14.5l7.5 7.5-3 3c-2 2-6.5 3.5-10.5 3.5 0-4 1.5-8.5 3.5-10.5z" fill="#3a7ca5"/><path d="M21 3.5l2-2 7.5 7.5-2 2z" fill="#c9961e"/></svg>`;
const CHECK = `<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="#2c7a4b" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const giftIcon = (g: Gift, pig: PigmentId, s: number): string => (g.k === 'pigment' ? potSvg(s) : g.k === 'drop' ? dropIcon(pig, s * 0.85) : brushSvg(s * 1.5));
const label = (g: Gift): string => (g.k === 'pigment' ? String(g.n) : g.k === 'drop' ? 'drop' : 'Loaded dip');

/** Sepia beim Öffnen, je Tag der Leiste ein Satz */
const SEPIA = [
  'You came back. The paint noticed.',
  'A drop for the brush. Do not waste it.',
  'Paint does not wait. Neither do I.',
  'Another day on the sheet. Good.',
  'Steady hands. Keep them.',
  'One more day and I open the good jar.',
  'The good jar. Use it before it dries.',
];

/** Was das Startbild weiß: Spielstand, ob Geschenk und freier Zug bereit sind, und das heutige Tagesblatt */
export type GiftView = {
  save: DiceSave | null;
  giftReady: boolean;
  freeReady: boolean;
  /** Heute (UTC) laut Server, sonst nach der Uhr des Geräts */
  day: string;
  colour: PigmentId;
  sheet: { unlocked: boolean; played: boolean; running: boolean; rule?: SheetRule } | null;
};
const learned = (s: DiceSave | null): boolean => !!s && (s.tutorialPaid || (s.duels ?? 0) > 0);

/** Wie das heutige Tagesblatt heißt: „Sunday sheet, points ×1.5“ oder „Monday sheet, light wash“ */
export const ruleLine = (r: SheetRule): string => `${r.day} sheet, ${r.mult > 1 ? `points ×${r.mult}` : r.label}`;

/** Leiste und Morgen-Zeile zeichnen. onOpen: Tipp auf „Open today’s gift“ */
export function renderGift(box: HTMLElement, line: HTMLElement, v: GiftView, onOpen: () => void): void {
  const s = v.save;
  const show = learned(s);
  box.hidden = !show;
  line.hidden = !show;
  if (!s || !show) return;
  const i = giftIndex(s.gift);
  // Heute schon offen: der zuletzt geöffnete Topf ist i − 1 (nach Tag 7 sind alle sieben abgehakt)
  const done = v.giftReady ? i : i === 0 ? GIFTS.length : i;
  const shown = v.giftReady ? i + 1 : i === 0 ? GIFTS.length : i;
  box.replaceChildren();
  box.append(html('div', 'gift-h', `<b>Today’s gift</b><small>day ${shown} of ${GIFTS.length} · no reset</small>`));
  const row = el('div', 'gift-row');
  GIFTS.forEach((g, k) => {
    const cls = 'gj' + (k < done ? ' done' : '') + (v.giftReady && k === i ? ' today' : '') + (g.k === 'dip' ? ' big' : '');
    const pot = html('span', 'pot', giftIcon(g, v.colour, 18) + (k < done ? `<span class="ck">${CHECK}</span>` : ''));
    const cell = el('div', cls);
    cell.append(pot, document.createTextNode(label(g)));
    row.append(cell);
  });
  box.append(row);
  if (v.giftReady) {
    const g = GIFTS[i]!;
    const b = el('button', 'gift-tap') as HTMLButtonElement;
    b.type = 'button';
    b.id = 'gift-open';
    b.append(document.createTextNode('Open today’s gift'), el('small', '', g.k === 'drop' ? `a drop of ${PIG[v.colour].n}` : g.k === 'dip' ? 'a free dip with the Loaded brush' : `${g.n} pigment`));
    b.addEventListener('click', onOpen);
    box.append(b);
  }
  // Morgen-Zeile (T9): nur, was wirklich wartet
  const dl = dayLine(v);
  line.replaceChildren(el('b', '', `${dl.label}: `), document.createTextNode(dl.text));
}

/** Morgen-Zeile (T9): was heute noch wartet, sonst was morgen kommt */
export function dayLine(v: GiftView): { label: 'Today' | 'Tomorrow'; text: string } {
  const today: string[] = [];
  if (v.giftReady) today.push('gift');
  if (v.freeReady) today.push('free dip');
  const sh = v.sheet;
  if (sh?.unlocked && !sh.played) today.push(sh.running ? 'your sheet is still wet' : sh.rule ? ruleLine(sh.rule) : 'today’s sheet');
  if (today.length) return { label: 'Today', text: today.join(' · ') };
  const next = GIFTS[giftIndex(v.save?.gift)]!;
  return { label: 'Tomorrow', text: `gift ${giftShort(next)} · free dip · ${ruleLine(sheetRule(nextDay(v.day)))}` };
}

/** Nach dem Öffnen: Karte mit dem Geschenk, Sepias Satz und was als Nächstes kommt. onTake: Tipp auf den Knopf */
export function showGiftCard(r: GiftResult, colour: PigmentId, onTake: () => void): void {
  document.getElementById('giftov')?.remove();
  const g = r.gift;
  const pig = r.pig ?? colour;
  const ov = el('div', 'giftov');
  ov.id = 'giftov';
  const card = el('div', 'giftcard');
  const title = g.k === 'pigment' ? `${g.n} pigment` : g.k === 'drop' ? `A drop of ${PIG[pig].n}` : 'A free dip with the Loaded brush';
  const next = r.day < GIFTS.length ? `Day ${GIFTS.length}: a free dip with the Loaded brush` : 'Tomorrow the jars start again';
  card.append(
    el('p', 'eyebrow', `Today’s gift · day ${r.day} of ${GIFTS.length}`),
    html('div', 'big', giftIcon(g, pig, 46)),
    el('h2', '', title),
    el('p', 'hand', SEPIA[r.day - 1] ?? SEPIA[0]!),
    el('span', 'who', 'MASTER SEPIA'),
    el('span', 'next', next),
  );
  const b = el('button', '', g.k === 'dip' ? 'Dip it' : 'Take it') as HTMLButtonElement;
  b.type = 'button';
  b.id = 'gift-take';
  b.addEventListener('click', () => {
    sfx.tap();
    ov.remove();
    onTake();
  });
  card.append(b);
  ov.append(card);
  document.body.append(ov);
  sfx.shimmer();
  b.focus({ preventScroll: true });
}

/** Unter dem Knopf „Today’s sheet“: Wochentag und Malmittel des Tages */
export const ruleSub = (r: SheetRule): string => `${r.day}${r.mult > 1 ? ` · points ×${r.mult}` : ` · ${r.label}`} · ${mediumDef(r.medium).name}`;
