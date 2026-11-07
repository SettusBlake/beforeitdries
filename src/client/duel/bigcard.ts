/*
 * Große Karte (gewünscht am 07.11.2026): Antippen des Monsterbilds auf einer Karte zeigt die ganze Karte groß,
 * wie eine Sammelkarte. Bild groß gemalt (Stil mit Rahmen und Schild), Rahmen in der Seltenheit, Name, Stufe,
 * Element, die sechs Seiten, Seriennummer. Die Karte kippt mit dem Finger, Holo mit Folie. Antippen schließt.
 */
import { PAPER } from '../../shared/data';
import { rarityDef, type Rarity } from '../../shared/dice';
import type { Face } from '../../shared/duel/rules';
import type { ElementId } from '../../shared/elements';
import type { Monster } from '../../shared/monster';
import { addHolo } from '../lib/holo';
import { painted, paintedNow } from '../lib/painter';
import { elementBadge } from './elements';
import { faceTile, lookOf } from './faceskin';
import { iconSvg } from './icons';
import { sfx } from './sound';
import './bigcard.css';

export type BigCard = {
  /** Das Monster mit Papier, Generation, Zeichnung, Stil und Holo */
  m: Monster;
  name: string;
  lv: number;
  rarity: Rarity;
  /** Element, null blendet es aus (Regeln nach und nach im Duell) */
  el: ElementId | null;
  faces: Face[];
  /** Art (Bauplan oder Name der Community) */
  species: string;
  /** Unterste Zeile links, z. B. „#00427 · one of a kind“ */
  serial?: string;
  /** Holo und Stil, z. B. „✦ Holo · star foil · 1 in 500“ */
  marks?: string[];
  /** Kleines Bild der Karte als Platzhalter, bis das große fertig ist */
  from?: HTMLCanvasElement | null;
};

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
/** Schlüssel für das große Bild: alles, was das Aussehen ändert */
const keyOf = (m: Monster, px: number): string => `big:${m.seed}:${m.gen ?? 1}:${m.paper}:${m.style ?? ''}:${m.draw ? 'draw' + m.draw.length : ''}:${px}`;

let open: { root: HTMLElement; close: () => void } | null = null;

/** Breite der Karte: passt ins Fenster (Höhe etwa 1,42 × Breite), höchstens 400 */
function cardWidth(): number {
  return Math.max(220, Math.floor(Math.min(window.innerWidth - 32, (window.innerHeight - 76) / 1.42, 400)));
}

export function closeBigCard(): void {
  open?.close();
}

export function openBigCard(c: BigCard): void {
  closeBigCard();
  sfx.lift();
  const r = rarityDef(c.rarity);
  const W = cardWidth();
  const root = el('div', 'bigcard');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', `${c.name}, card`);
  const card = el('div', 'bc-card' + (c.rarity === 'legendary' ? ' leg' : '') + (c.m.holo ? ' foil' : ''));
  card.style.setProperty('--w', `${W}px`);
  card.style.setProperty('--c', r.col);
  const inner = el('div', 'bc-inner');
  // Kopf: Name und Stufe
  const head = el('div', 'bc-head');
  head.append(el('b', 'bc-name', c.name), html('span', 'bc-lv', `${iconSvg({ k: 'star', n: c.lv }, Math.round(W * 0.042))}<small>Lv ${c.lv}</small>`));
  // Bild: erst das kleine vergrößert, dann groß gemalt (Stil mit Rahmen, Text und Schild)
  const win = el('div', 'bc-art');
  const px = W - 44;
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = cv.height = Math.round(px * dpr);
  const put = (src: HTMLCanvasElement) => cv.getContext('2d')!.drawImage(src, 0, 0, cv.width, cv.height);
  const key = keyOf(c.m, px);
  const now = paintedNow(key);
  if (now) put(now);
  else {
    if (c.from && c.from.width > 1) put(c.from);
    win.classList.add('wet');
    void painted(key, c.m, px, { dpr, deco: !!c.m.style }, 9).then((src) => {
      put(src);
      win.classList.remove('wet');
    });
  }
  win.append(cv);
  // Zeile unter dem Bild: Seltenheit, Papier, Art, Element
  const type = el('div', 'bc-type');
  const tl = el('span', 'bc-tl');
  tl.append(el('b', '', r.label), document.createTextNode(` · ${PAPER[c.m.paper].n} · ${c.species}`));
  type.append(tl);
  if (c.el) type.append(html('span', 'bc-el', elementBadge(c.el)));
  // Die sechs Seiten des Würfels
  const lk = lookOf(c.m);
  const faces = el('div', 'bc-faces');
  const fs = Math.round((W - 44 - 5 * 6) / 6);
  for (const f of c.faces) faces.append(html('span', 'bc-face', faceTile(f, lk, fs)));
  // Fuß: Seriennummer, Holo und Stil
  const foot = el('div', 'bc-foot');
  foot.append(el('span', '', c.serial ?? 'one of a kind'));
  if (c.marks?.length) foot.append(el('span', 'bc-marks', c.marks.join(' · ')));
  inner.append(head, win, type, faces, foot);
  // Glanz über der ganzen Karte, folgt dem Finger
  card.append(inner, el('div', 'bc-glare'));
  const shut = el('button', 'bc-x', '×') as HTMLButtonElement;
  shut.type = 'button';
  shut.setAttribute('aria-label', 'Close');
  root.append(card, el('p', 'bc-hint', 'tap to close'), shut);

  // Kippen: Holo mit Folie über dem Bild (kippt selbst), sonst kippt die Karte mit dem Finger auf der ganzen Fläche
  if (c.m.holo) addHolo(win, c.m.seed, card, true);
  else tilt(card);

  // Schließen: Antippen ohne Ziehen, ×, Escape
  let sx = 0,
    sy = 0;
  root.addEventListener('pointerdown', (e) => {
    sx = e.clientX;
    sy = e.clientY;
  }, true);
  root.addEventListener('click', (e) => {
    e.stopPropagation();
    if (Math.hypot(e.clientX - sx, e.clientY - sy) < 10) close();
  });
  const key2 = (e: KeyboardEvent) => e.key === 'Escape' && close();
  document.addEventListener('keydown', key2);
  const close = () => {
    if (!open || open.root !== root) return;
    open = null;
    document.removeEventListener('keydown', key2);
    sfx.tap();
    root.classList.add('out');
    window.setTimeout(() => root.remove(), 180);
  };
  open = { root, close };
  document.body.append(root);
  requestAnimationFrame(() => root.classList.add('in'));
}

/** Karte ohne Holo: kippt mit dem Finger, Glanz folgt, beim Loslassen zurück */
function tilt(card: HTMLElement): void {
  card.classList.add('bc-tilt');
  const at = (e: PointerEvent) => {
    const b = card.getBoundingClientRect();
    const mx = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)),
      my = Math.max(0, Math.min(1, (e.clientY - b.top) / b.height));
    card.style.setProperty('--rx', `${((mx - 0.5) * 14).toFixed(2)}deg`);
    card.style.setProperty('--ry', `${((0.5 - my) * 10).toFixed(2)}deg`);
    card.style.setProperty('--mx', `${(mx * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(my * 100).toFixed(1)}%`);
  };
  let held = false;
  card.addEventListener('pointerdown', (e) => {
    held = true;
    card.classList.add('held');
    card.setPointerCapture(e.pointerId);
    at(e);
  });
  card.addEventListener('pointermove', (e) => held && at(e));
  const up = () => {
    held = false;
    card.classList.remove('held');
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  };
  card.addEventListener('pointerup', up);
  card.addEventListener('pointercancel', up);
}
