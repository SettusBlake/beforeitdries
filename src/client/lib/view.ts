/* Bausteine für Launch-Screen und Spiel */
import type { SpeciesInfo } from '../../shared/api';
import { BAR_MAX, BP, css, PAPER, PIG } from '../../shared/data';
import { speciesLabel, statRows, traitsOf, type Monster } from '../../shared/monster';
import { h } from './dom';

export const pips = (n: number): string => '●'.repeat(n) + '○'.repeat(4 - n);

export function speciesTitle(m: Pick<Monster, 'bp' | 'main'>, species: SpeciesInfo | null | undefined): string {
  return species?.name ?? `Unnamed ${speciesLabel(m)}`;
}

export function paperLine(m: Monster): HTMLElement {
  const pa = PAPER[m.paper];
  return h('span', null, `${pa.n} `, h('span', { class: 'pips', attrs: { 'aria-label': `Rarity ${pa.pips} of 4` }, text: pips(pa.pips) }));
}

export function subLine(m: Monster, ...extra: (string | HTMLElement)[]): HTMLElement {
  return h('div', { class: 'card-sub' }, h('span', { text: BP[m.bp].n + (m.mutations ? ' (mutated)' : '') }), paperLine(m), ...extra.map((e) => (typeof e === 'string' ? h('span', { text: e }) : e)));
}

export function pigChips(m: Monster): HTMLElement {
  const chip = (id: Monster['main'], main: boolean) => h('span', { class: main ? 'pig main' : 'pig' }, h('span', { class: 'dot', vars: { '--c': css(PIG[id].rgb) } }), PIG[id].n);
  return h('div', { class: 'pigs' }, chip(m.main, true), ...m.sec.map((id) => chip(id, false)));
}

/** Werte als Balken. withRolls: W20-Würfe anzeigen (nur bei gefangenen Exemplaren) */
export function statBars(m: Monster, withRolls: boolean, short = false): HTMLElement {
  const g = h('div', { class: 'stats' });
  for (const s of statRows(m)) {
    g.append(
      h('span', { class: 'lbl', text: short ? s.short : s.n, attrs: short ? { title: s.n } : {} }),
      h('span', { class: 'bar' }, h('i', { vars: { '--w': ((s.total / BAR_MAX) * 100).toFixed(1) + '%' } }), h('s', { vars: { '--cap': ((s.cap / BAR_MAX) * 100).toFixed(1) + '%' } })),
      h('span', { class: 'val' }, String(s.total), withRolls ? h('em', { text: 'd' + s.roll }) : null),
    );
  }
  return g;
}

export function traitChips(m: Monster, max = Infinity, short = false): HTMLElement | null {
  const tr = traitsOf(m);
  if (!tr.length) return null;
  const shown = tr.slice(0, max).map((t) => h('span', { class: 'trait' + (t.c ? ' ' + t.c : ''), text: short ? t.t.split(':')[0]! : t.t }));
  return h('div', { class: 'traits' }, ...shown, tr.length > max ? h('span', { class: 'trait', text: `+${tr.length - max}` }) : null);
}

export function humidityChip(hum: number): HTMLElement {
  return h('span', { class: 'chip', attrs: { title: 'Humidity of this sheet' } }, h('small', { text: 'Humidity' }), `${hum}%`, h('span', { class: 'hygro' }, h('i', { vars: { '--h': hum + '%' } })));
}

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} min`;
  const hh = Math.floor(m / 60),
    mm = m % 60;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}

export function sepiaBox(text: string): HTMLElement {
  return h('div', { class: 'sepia' }, h('small', { text: 'Master Sepia' }), h('p', { text }));
}
