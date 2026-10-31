/*
 * Spielfarbe wählen (festgelegt am 31.10.2026, docs/entwuerfe/uebersicht-vorschlag.md): deine Farbe und eine Ausweichfarbe aus 16,
 * gespeichert im Spielstand am Server. Geöffnet aus dem Menü des Duells und über den Farbpunkt neben „Your dice“.
 */
import type { DiceResponse } from '../../shared/api';
import { colorDef, COLOR_BACKUP, COLOR_DEFAULT, TEAM_COLORS, type ColorId } from '../../shared/colors';
import { api } from '../lib/api';
import { sfx } from './sound';

const $ = (id: string) => document.getElementById(id)!;
const css = (k: ColorId) => `rgb(${colorDef(k).rgb.join(',')})`;

type Hooks = { saved: (r: DiceResponse) => void; error: (e: unknown) => void };
let hooks: Hooks = { saved: () => undefined, error: () => undefined };
let cur: [ColorId, ColorId] = [COLOR_DEFAULT, COLOR_BACKUP];
let busy = false;

/** Stand aus der Sammlung übernehmen */
export function setColorChoice(a: ColorId | undefined, b: ColorId | undefined): void {
  cur = [a ?? COLOR_DEFAULT, b ?? COLOR_BACKUP];
  paintDots();
}
export const colorChoice = (): [ColorId, ColorId] => cur;

/** Farbpunkte neben „Your dice“ und im Menü */
function paintDots(): void {
  for (const id of ['colors-t', 'colors-m']) {
    const b = document.getElementById(id);
    if (!b) continue;
    b.style.setProperty('--c1', css(cur[0]));
    b.style.setProperty('--c2', css(cur[1]));
  }
  const m = document.getElementById('colors-m-name');
  if (m) m.textContent = `${colorDef(cur[0]).label}, backup ${colorDef(cur[1]).label}`;
}

function render(): void {
  for (const [slot, box] of [
    [0, $('colors-1')],
    [1, $('colors-2')],
  ] as const) {
    box.replaceChildren();
    for (const c of TEAM_COLORS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cpick' + (cur[slot] === c.k ? ' on' : '') + (cur[1 - slot] === c.k ? ' other' : '');
      b.style.setProperty('--c', css(c.k));
      b.title = c.label;
      b.setAttribute('aria-label', c.label);
      b.setAttribute('aria-pressed', String(cur[slot] === c.k));
      b.disabled = busy;
      b.addEventListener('click', () => void pick(slot, c.k));
      box.append(b);
    }
  }
  $('colors-1-name').textContent = colorDef(cur[0]).label;
  $('colors-2-name').textContent = colorDef(cur[1]).label;
}

async function pick(slot: 0 | 1, k: ColorId): Promise<void> {
  if (busy || cur[slot] === k) return;
  sfx.tap();
  // Dieselbe Farbe in beiden Reihen geht nicht: dann tauschen
  const next: [ColorId, ColorId] = [...cur];
  if (next[1 - slot] === k) next[1 - slot] = next[slot];
  next[slot] = k;
  busy = true;
  const before = cur;
  cur = next;
  render();
  try {
    const r = await api.diceColor(next[0], next[1]);
    hooks.saved(r);
  } catch (e) {
    cur = before;
    hooks.error(e);
  }
  busy = false;
  render();
  paintDots();
}

export function openColors(): void {
  render();
  $('colors').hidden = false;
}
export function initColors(h: Hooks): void {
  hooks = h;
  $('colors-close').addEventListener('click', () => ($('colors').hidden = true));
  $('colors').addEventListener('click', (e) => {
    if (e.target === $('colors')) $('colors').hidden = true;
  });
  paintDots();
}
