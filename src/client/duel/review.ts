/*
 * Prüfliste der Mods: jede neue Zeichnung als schlichte Striche. OK gibt sie frei, Paint over (zweimal tippen) nimmt dem
 * Monster die Zeichnung, es bekommt eine zufällige Form. Darunter die Spieler, die gerade nicht malen dürfen.
 */
import type { ReviewItem, ReviewResponse } from '../../shared/api';
import { serialText } from '../../shared/dice';
import { api } from '../lib/api';
import { sketch } from './draw';
import { sfx } from './sound';

const $ = (id: string) => document.getElementById(id)!;
function el(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
type Hooks = { back: () => void; error: (e: unknown) => void };
let hooks: Hooks = { back: () => undefined, error: () => undefined };
let data: ReviewResponse | null = null;
let busy = false;
/** Paint over wurde einmal angetippt, der zweite Tipp übermalt */
let armed: string | null = null;

const ago = (t: number): string => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};
const lockText = (lock: number | 'mod'): string => (lock === 'mod' ? 'until a mod unlocks' : `${Math.max(1, Math.ceil((lock - Date.now()) / 86_400_000))} more days`);

function render(): void {
  const list = $('review-list');
  list.replaceChildren();
  $('review-n').textContent = data ? String(data.items.length) : '…';
  if (!data) return;
  if (!data.items.length) list.append(el('p', 'dhint', 'Nothing to review. Every drawing has been looked at.'));
  for (const it of data.items) list.append(card(it));
  const locked = $('review-locked');
  locked.replaceChildren();
  $('review-locked-box').hidden = !data.locked.length;
  for (const p of data.locked) {
    const row = el('div', 'lockrow');
    row.append(el('span', '', `u/${p.user || '?'} · ${p.strikes} painted over · locked ${lockText(p.lock)}`));
    const b = el('button', 'tool', 'Unlock') as HTMLButtonElement;
    b.type = 'button';
    b.disabled = busy;
    b.addEventListener('click', () => void act(() => api.reviewUnlock(p.uid)));
    row.append(b);
    locked.append(row);
  }
}
function card(it: ReviewItem): HTMLElement {
  const c = el('div', 'rcard');
  const pic = sketch(it.draw, 132);
  if (pic) c.append(pic);
  const side = el('div', 'rside');
  side.append(el('b', '', `u/${it.user || '?'}`), el('small', '', `${serialText(it.no)} · ${ago(it.at)}`));
  const ok = el('button', 'tool', 'OK') as HTMLButtonElement;
  ok.type = 'button';
  ok.disabled = busy;
  ok.addEventListener('click', () => void act(() => api.reviewOk(it.key)));
  const over = el('button', 'tool danger' + (armed === it.key ? ' armed' : ''), armed === it.key ? 'Tap again: paint over' : 'Paint over') as HTMLButtonElement;
  over.type = 'button';
  over.disabled = busy;
  over.addEventListener('click', () => {
    if (armed !== it.key) {
      armed = it.key;
      sfx.tap();
      return render();
    }
    void act(() => api.reviewOver(it.key));
  });
  side.append(ok, over);
  c.append(side);
  return c;
}
async function act(fn: () => Promise<ReviewResponse>): Promise<void> {
  if (busy) return;
  busy = true;
  armed = null;
  sfx.tap();
  render();
  try {
    data = await fn();
  } catch (e) {
    hooks.error(e);
  }
  busy = false;
  render();
}

export function initReview(h: Hooks): void {
  hooks = h;
  $('review-back').addEventListener('click', () => {
    sfx.tap();
    hooks.back();
  });
}
export function openReview(): void {
  armed = null;
  data = null;
  $('review').hidden = false;
  render();
  void act(() => api.review());
}
