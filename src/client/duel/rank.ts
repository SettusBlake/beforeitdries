/*
 * Malerrang (H2, freigegeben am 09.11.2026, docs/entwuerfe/fesseln-vorschlag.md Fassung 2, Abschnitt 7).
 * Der Server zählt und zahlt, hier wird nur gezeigt: Rang im Startbild, Übersicht der Titel, Erfahrung im Ergebnis,
 * Karte mit Sepia bei einem neuen Titel, kleines Abzeichen neben Namen.
 */
import { PIG, type PigmentId } from '../../shared/data';
import type { DiceSave } from '../../shared/dice';
import { giftText, nextTitle, RANK_MAX, rankOf, TITLES, titleOf, XP, type RankUp } from '../../shared/rank';
import { sfx } from './sound';
import './gift.css';
import './rank.css';

const el = (tag: string, cls = '', text = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const learned = (s: DiceSave | null): boolean => !!s && (s.tutorialPaid || (s.duels ?? 0) > 0);

/** Kleines Abzeichen mit der Zahl des Rangs (Rangliste, Galerie). Rang 50 in Gold */
export function rankBadge(n: number): HTMLElement {
  const b = el('span', 'rkb' + (n >= RANK_MAX ? ' gold' : ''), String(n));
  b.title = `Rank ${n} · ${titleOf(n).title}`;
  return b;
}

/** Rang im Startbild: Zahl im Farbklecks, Rang und Titel, Erfahrung, Balken. Erst nach den ersten Schritten */
export function renderRank(btn: HTMLElement, s: DiceSave | null): void {
  btn.hidden = !learned(s);
  if (!s || btn.hidden) return;
  const r = rankOf(s.xp ?? 0);
  const n = el('span', 'rk-n' + (r.n >= RANK_MAX ? ' gold' : ''), String(r.n));
  const t = el('span', 'rk-t');
  t.append(el('b', '', `Rank ${r.n} · ${titleOf(r.n).title}`), el('small', '', r.need ? `${r.have} / ${r.need} XP` : 'highest rank'));
  const bar = el('span', 'rk-bar');
  const fill = el('i');
  fill.style.width = r.need ? `${Math.round((r.have / r.need) * 100)}%` : '100%';
  bar.append(fill);
  btn.replaceChildren(n, t, bar);
}

/** Übersicht nach Tipp auf den Rang: alle Titel mit Geschenk, der jetzige hervorgehoben */
export function openRankList(s: DiceSave | null): void {
  document.getElementById('rklist')?.remove();
  const now = rankOf(s?.xp ?? 0).n;
  const cur = titleOf(now).at;
  const ov = el('div', 'rklist');
  ov.id = 'rklist';
  const sheet = el('div', 'sheet');
  const head = el('div', 'modhead');
  const x = el('button', 'ghost', '✕') as HTMLButtonElement;
  x.type = 'button';
  x.setAttribute('aria-label', 'Close');
  head.append(el('h2', '', 'Painter’s rank'), x);
  const sub = el('p', 'sub');
  sub.append(
    document.createTextNode(`Rank ${now} of ${RANK_MAX}. Every rank: pigment. Every fifth: a new title and a gift.`),
    el('br'),
    document.createTextNode(`Duel ${XP.duel} XP, win ${XP.win} · daily sheet ${XP.sheet} · dip ${XP.dip} · weekly goal ${XP.goal}`),
  );
  sheet.append(head, sub);
  for (const t of TITLES) {
    const row = el('div', 'rkrow' + (t.at < cur ? ' done' : t.at === cur ? ' now' : ''));
    row.append(el('span', 'no', String(t.at)), el('b', '', t.title), el('small', '', t.gifts.length ? t.gifts.map(giftText).join(' · ') : 'start'));
    sheet.append(row);
  }
  ov.append(sheet);
  const close = () => ov.remove();
  x.addEventListener('click', close);
  ov.addEventListener('click', (e) => {
    if (e.target === ov) close();
  });
  document.body.append(ov);
  sfx.tap();
}

/** Wie viele Duelle es ungefähr noch sind */
const duelsFor = (left: number): string => (left <= XP.win ? 'about one more duel' : `about ${Math.ceil(left / 25)} duels`);

/**
 * Erfahrung im Ergebnis: „+30 XP“, Balken mit dem neuen Stück, was bis zum nächsten Rang fehlt, und jeder neue Rang mit Pigment.
 * before: Erfahrung vor dieser Runde
 */
export function xpHtml(before: number, gained: number, ups: RankUp[] = []): string {
  if (!gained) return '';
  const after = before + gained;
  const r = rankOf(after);
  const was = rankOf(before);
  // Gleicher Rang: das neue Stück hinter dem alten. Neuer Rang: der Balken beginnt im neuen Rang
  const from = was.n === r.n && r.need ? (was.have / r.need) * 100 : 0;
  const to = r.need ? (r.have / r.need) * 100 : 100;
  const bar = `<span class="rk-bar"><i style="width:${from.toFixed(1)}%"></i><i class="gain" style="left:${from.toFixed(1)}%;width:${Math.max(0, to - from).toFixed(1)}%"></i></span>`;
  const left = r.need - r.have;
  const next = r.need ? `Rank ${r.n + 1} in <b>${left} XP</b>, ${duelsFor(left)}` : 'Highest rank. Keeper of the Sheet.';
  const lines = ups.map((u) => `<span class="rk-up">Rank ${u.n}${u.title ? ` · <b>${u.title}</b>` : ''} · +${u.pigment} pigment</span>`).join('');
  return `<span class="xp-r"><span class="xp-h"><b>+${gained} XP</b><span>Rank ${r.n} · ${titleOf(r.n).title}</span></span>${bar}<small>${next}</small>${lines}</span>`;
}

/** Kurz für eine Meldung nach einem Zug: „Rank 8 · +36 pigment“ */
export const rankLine = (ups: RankUp[]): string => ups.map((u) => `Rank ${u.n}${u.title ? ` · ${u.title}` : ''} · +${u.pigment} pigment`).join(' · ');

/**
 * Neue Titel nacheinander als Karte mit Sepia, Lohn und dem nächsten Titel. Wartet ein Zug als Geschenk, heißt der Knopf „Dip it“
 * und onDip startet ihn (nach der letzten Karte). Gibt zurück, wenn alle Karten zu sind
 */
export async function showRankUps(ups: RankUp[], onDip?: () => void): Promise<void> {
  const titled = ups.filter((u) => u.title);
  let dip = false;
  for (const u of titled) {
    const hasDip = !!u.gifts?.some((g) => g.k === 'dip');
    dip ||= hasDip;
    await new Promise<void>((done) => {
      document.getElementById('rankov')?.remove();
      const ov = el('div', 'giftov');
      ov.id = 'rankov';
      const card = el('div', 'giftcard rkcard');
      const big = el('div', 'big');
      big.append(el('span', u.n >= RANK_MAX ? 'gold' : '', String(u.n)));
      const gets = el('div', 'gets');
      gets.append(el('span', '', `+${u.pigment} pigment`));
      for (const g of u.gifts ?? []) gets.append(el('span', '', g.k === 'drops' && u.pig ? `${g.n} drops of ${PIG[u.pig as PigmentId].n}` : giftText(g)));
      const nt = nextTitle(u.n);
      card.append(
        el('p', 'eyebrow', 'Rank up · a new title'),
        big,
        el('h2', '', u.title!),
        gets,
        el('p', 'hand', u.say ?? ''),
        el('span', 'who', 'MASTER SEPIA'),
        el('span', 'next', nt ? `Next title at rank ${nt.at}: ${nt.title}` : 'There is no higher rank.'),
      );
      const b = el('button', '', hasDip ? 'Dip it' : 'Take it') as HTMLButtonElement;
      b.type = 'button';
      b.id = 'rank-take';
      b.addEventListener('click', () => {
        sfx.tap();
        ov.remove();
        done();
      });
      card.append(b);
      ov.append(card);
      document.body.append(ov);
      sfx.shimmer();
      b.focus({ preventScroll: true });
    });
  }
  if (dip) onDip?.();
}
