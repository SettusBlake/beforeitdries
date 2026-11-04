/*
 * Tagespost (Bleach Schritt 3, inline im Feed): solange der Tag läuft, die Wellen des Tages, der Knopf zum Blatt und die
 * Rangliste mit kleinen Blättern. Danach die fertige Rangliste mit dem besten Blatt, gemalt aus dem gespeicherten Endstand.
 */
import './lib/fonts';
import './sheet.css';
import { requestExpandedMode } from '@devvit/web/client';
import type { SheetResponse, SheetRow } from '../shared/api';
import { PIG, css } from '../shared/data';
import { dayLabel } from '../shared/sheet';
import { api } from './lib/api';
import { drawSheet } from './lib/minisheet';

const $ = (id: string) => document.getElementById(id)!;
const el = (tag: string, cls = '', text = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const who = (name: string): string => (name && name !== 'a painter' ? `u/${name}` : 'a painter');
let info: SheetResponse | null = null;

function mini(r: SheetRow, cell: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  drawSheet(c, r.sheet ?? '', r.col, cell);
  return c;
}

/** Heute: fünf Wellen Pales, der große in seiner Welle */
function waves(i: SheetResponse): HTMLElement {
  const box = el('div', 's-hero');
  i.waves.forEach((n, w) => {
    const g = el('div', 'wv');
    const p = el('div', 'wv-p');
    for (let k = 0; k < n; k++) p.append(el('span', 'pale' + (w + 1 === i.bossWave && k === Math.floor(n / 2) ? ' big' : '')));
    g.append(p, el('small', '', `wave ${w + 1}`));
    box.append(g);
  });
  return box;
}
/** Danach: das beste Blatt groß */
function best(r: SheetRow): HTMLElement {
  const box = el('div', 's-hero');
  const b = el('div', 'best');
  b.append(mini(r, 15));
  const t = el('div');
  t.append(el('span', '', 'Best sheet'), el('b', '', who(r.name)), el('span', '', `${r.points} points${r.hearts !== undefined ? ` · ${'♥'.repeat(r.hearts)}` : ''}`));
  b.append(t);
  box.append(b);
  return box;
}
function row(r: SheetRow, wide = false): HTMLElement {
  const e = el('div', 'row' + (r.me ? ' me' : '') + (wide ? ' wide' : ''));
  e.append(mini(r, 5), el('span', 'rk', `#${r.rank}`), el('span', 'nm', r.me ? 'you' : who(r.name)), el('b', 'pt', String(r.points)));
  return e;
}

function show(): void {
  const i = info;
  if (!i) return;
  const pig = PIG[i.colour];
  $('s-eyebrow').textContent = i.today ? `Today’s sheet · ${dayLabel(i.day)}` : `${dayLabel(i.day)} · the sheet dried`;
  const col = $('s-col');
  col.replaceChildren();
  const drop = el('i');
  drop.style.background = css(pig.rgb);
  col.append(drop, document.createTextNode(`${pig.n} day`));
  $('s-title').textContent = i.today ? 'Hold the edge' : 'Final board';
  const hero = i.today || !i.top[0] ? waves(i) : best(i.top[0]);
  hero.id = 's-hero';
  $('s-hero').replaceWith(hero);
  $('s-sub').textContent = i.today
    ? `Pales bleach down from the top edge. Everyone gets the same sheet, the same nine dice and the same rolls. One ranked run a day.`
    : i.players
      ? `${i.players} ${i.players === 1 ? 'painter' : 'painters'} took on that sheet. A new one is up.`
      : 'Nobody painted this one. A new sheet is up.';
  // Knopf: zum Tagesblatt (auch vom Post eines früheren Tages)
  const play = $('s-play');
  const done = i.today && !!i.me;
  play.textContent = !i.today ? 'Play today’s sheet' : i.running ? 'Continue your sheet' : done ? 'Open the game' : i.user && !i.unlocked ? 'Learn with Sepia first' : 'Play today’s sheet';
  play.className = done ? 'primary soft' : 'primary';
  const me = $('s-me');
  me.innerHTML = i.me ? `You: <b>#${i.me.rank}</b> of ${i.players} · <b>${i.me.points}</b> points${i.me.streak ? ` · 🖌 ${i.me.streak} days` : ''}` : i.today && i.running ? 'Your sheet is still wet.' : '';
  // Rangliste: die Besten (6), dein Platz dazu, wenn du nicht dabei bist. Die volle Liste gibt es im Spiel
  const board = $('s-board');
  board.replaceChildren();
  if (!i.top.length) board.append(el('p', 's-empty', i.today ? '“Nobody has painted it yet. Go first, I will watch.” Master Sepia' : '“An empty sheet. It happens.” Master Sepia'));
  for (const r of i.top) board.append(row(r));
  if (i.me && !i.top.some((r) => r.me)) board.append(row(i.me, true));
  $('s-count').textContent = i.players > i.top.length ? `${i.players} painters · the full board is in the game` : i.today && i.players ? `${i.players} ${i.players === 1 ? 'painter' : 'painters'} today · the board closes at midnight UTC` : '';
  fit();
}
/** Inline-Posts dürfen nicht scrollen: passt die Liste nicht, fallen die hinteren Plätze weg (deiner bleibt) */
function fit(): void {
  const board = $('s-board');
  for (let k = 0; k < 20 && board.scrollHeight > board.clientHeight + 1; k++) {
    const rows = [...board.querySelectorAll('.row:not(.me)')];
    const last = rows[rows.length - 1];
    if (!last) break;
    last.remove();
  }
}

async function load(): Promise<void> {
  try {
    info = await api.sheet();
  } catch {
    /* ohne Netz: Stand vom letzten Mal */
  }
  show();
}
$('s-play').addEventListener('click', (e) => requestExpandedMode(e, 'duel'));
void load();
window.addEventListener('resize', show);
// Rangliste ab und zu neu holen, solange der Tag läuft
window.setInterval(() => {
  if (info?.today) void load();
}, 60000);
(window as unknown as { done: boolean }).done = true;
