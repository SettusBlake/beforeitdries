/*
 * Galerie im Client (docs/entwuerfe/galerie-duell-plan.md): Vorschau des gefundenen Decks und der Stand des eigenen.
 * Gesucht, gewürfelt und bezahlt wird am Server, hier wird nur gezeigt.
 */
import type { GalleryStatus, GalleryView } from '../../shared/api';
import { dieMonster, rarityDef, serialText, styleDef, type DieRec } from '../../shared/dice';
import { dieUnit } from '../../shared/duel/rules';
import { monsterSeed } from '../../shared/monster';
import { addHolo } from '../lib/holo';
import { painted } from '../lib/painter';
import { api, ApiError } from '../lib/api';
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

/* ---------- Stand des eigenen Decks (kommt mit dem Laden der Sammlung) ---------- */
let status: GalleryStatus | null = null;
export const setGalleryStatus = (s: GalleryStatus | undefined): void => {
  if (s) status = s;
};
export const galleryStatus = (): GalleryStatus | null => status;

/** u/name für Reddit-Namen, sonst so, wie der Server ihn schickt („a nameless painter“) */
export const foeTag = (name: string): string => (/^[\w-]{2,}$/.test(name) ? `u/${name}` : name);

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const word = (n: number): string => WORDS[n] ?? String(n);

/** Zeile auf dem Startbild */
export function galleryLine(): string {
  const st = status;
  if (!st) return '';
  if (st.off) return 'Your deck is not in the gallery. Hang it in the menu.';
  if (!st.hung) return 'Finish a duel and your deck hangs in the gallery.';
  const r = st.rec;
  return `Your deck hangs in the gallery · <b>${r.w} won · ${r.l} lost</b>` + (st.inbox ? ' · <span class="news">news in Your dice</span>' : '');
}

/** Sepias Bericht, wenn das Deck in der Galerie etwas erlebt hat */
export function inboxText(st: GalleryStatus): string {
  const b = st.inbox!;
  const n = b.w + b.l + b.d;
  const tried = n === 1 ? 'One painter tried it.' : `${word(n).replace(/^./, (c) => c.toUpperCase())} painters tried it.`;
  const parts: string[] = [];
  if (b.w) parts.push(b.w === n ? (n === 1 ? 'They went home with your colours on their sleeves' : 'All of them went home with your colours on their sleeves') : `${word(b.w).replace(/^./, (c) => c.toUpperCase())} went home with your colours on their sleeves`);
  if (b.l) parts.push(`${parts.length ? word(b.l) : word(b.l).replace(/^./, (c) => c.toUpperCase())} got the better of it`);
  if (b.d) parts.push(`${parts.length ? word(b.d) : word(b.d).replace(/^./, (c) => c.toUpperCase())} ended in a draw`);
  return `Your deck hung in the gallery while you were away. ${tried} ${parts.join(', ')}.`;
}

/* ---------- Vorschau ---------- */
type Hooks = { start: () => void; error: (e: unknown) => void };
let hooks: Hooks = { start: () => undefined, error: () => undefined };
let view: GalleryView | null = null;
let busy = false;

function ago(at: number): string {
  const h = Math.max(0, (Date.now() - at) / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${Math.floor(h)} hour${h < 2 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
function strength(p: number, mine: number): string {
  const r = mine > 0 ? p / mine : 1;
  if (Math.abs(r - 1) <= 0.03) return 'about as strong as yours';
  if (r > 1) return r <= 1.1 ? 'a little stronger than yours' : 'stronger than yours';
  return r >= 0.9 ? 'a little weaker than yours' : 'weaker than yours';
}
const SAY = ["Someone else's brushwork. Study it before you ruin it.", 'Hung to dry by someone who thought it was finished.', "Another painter's deck. Be polite. Then win."];

/** Bild eines fremden Würfels (Schlüssel mit dem Seed, die IDs der Würfel gibt es bei jedem Spieler) */
function tile(d: DieRec, i: number): HTMLElement {
  const u = dieUnit(dieMonster(d), d.mods);
  const box = el('div', 'gd' + (d.holo ? ' holo-rim' : ''));
  box.style.setProperty('--c', rarityDef(u.rarity).col);
  box.title = u.name;
  const px = 72;
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(px * dpr());
  c.classList.add('wet');
  const key = `gal:${d.sheet}:${d.idx}:${d.paper ?? ''}:${d.gen ?? 1}:${d.style ?? ''}:${d.draw ? d.draw.length + d.draw.slice(-12) : ''}:${px}`;
  void painted(key, dieMonster(d), px, { dpr: dpr(), quality: 'lite' }, 2 + (8 - i) / 10).then((src) => {
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
  box.append(lv);
  if (d.no) box.append(el('small', '', serialText(d.no)));
  if (d.style) box.append(el('span', 'mark', styleDef(d.style).label));
  return box;
}

function render(say?: string): void {
  const v = view;
  const grid = $('gal-grid');
  grid.replaceChildren();
  ($('gal-go') as HTMLButtonElement).disabled = busy || !v;
  ($('gal-another') as HTMLButtonElement).disabled = busy || !v || v.swaps <= 0 || !!v.self;
  $('gal-another').hidden = !v;
  $('gal-pow-box').hidden = !v;
  if (!v) {
    $('gal-name').textContent = busy ? 'Looking at the wall…' : 'An empty wall';
    $('gal-sub').textContent = busy ? '' : 'No deck of about your strength right now.';
    $('gal-say').textContent = say ?? (busy ? '' : 'The gallery is empty for now. Come back when more paint has dried.');
    $('gal-go').textContent = 'Duel';
    return;
  }
  const tag = foeTag(v.name);
  $('gal-name').textContent = v.self ? 'Your own deck (test)' : `${tag}'s deck`;
  $('gal-sub').textContent = `Hung ${ago(v.at)} · ${v.rec.w} won · ${v.rec.l} lost` + (v.rec.d ? ` · ${v.rec.d} drawn` : '');
  v.dice.forEach((d, i) => grid.append(tile(d, i)));
  $('gal-pow').innerHTML = `Strength <b>${v.power.toLocaleString('en')}</b> · yours ${v.mine.toLocaleString('en')} · <b>${strength(v.power, v.mine)}</b>`;
  const r = v.mine > 0 ? v.power / v.mine : 1;
  $('gal-me').style.left = '50%';
  $('gal-foe').style.left = `${Math.max(4, Math.min(96, 50 + (r - 1) * 250))}%`;
  $('gal-say').textContent = say ?? (v.self ? 'Your own deck, for testing. Try not to lose to yourself.' : SAY[(v.at >>> 4) % SAY.length]!);
  $('gal-go').textContent = v.self ? 'Duel yourself' : `Duel ${tag}`;
}

export async function openGallery(): Promise<void> {
  if (busy) return;
  busy = true;
  view = null;
  $('gallery').hidden = false;
  render();
  try {
    view = (await api.galleryFind()).foe;
    busy = false;
    render();
  } catch (e) {
    busy = false;
    $('gallery').hidden = true;
    hooks.error(e);
  }
}
async function another(): Promise<void> {
  if (busy || !view) return;
  sfx.tap();
  busy = true;
  render();
  try {
    view = (await api.galleryFind(true)).foe;
    busy = false;
    render();
  } catch (e) {
    busy = false;
    if (e instanceof ApiError && (e.code === 'not_found' || e.code === 'bad_request')) {
      if (view) view = { ...view, swaps: 0 };
      render(e.code === 'not_found' ? 'No other deck on the wall right now. This one will have to do.' : 'One other deck per duel. Choose, or stop looking.');
    } else {
      $('gallery').hidden = true;
      hooks.error(e);
    }
  }
}
export function initGallery(h: Hooks): void {
  hooks = h;
  $('gal-close').addEventListener('click', () => ($('gallery').hidden = true));
  $('gallery').addEventListener('click', (e) => {
    if (e.target === $('gallery')) $('gallery').hidden = true;
  });
  $('gal-another').addEventListener('click', () => void another());
  $('gal-go').addEventListener('click', () => {
    if (busy || !view) return;
    sfx.tap();
    $('gallery').hidden = true;
    hooks.start();
  });
}
