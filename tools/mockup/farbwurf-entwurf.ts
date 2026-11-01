/*
 * Entwurfsbogen „Kampf A“ (nur für docs/entwuerfe, docs/entwuerfe/kampf-a-vorschlag.md): Seiten in Farbe, Kombis aus der
 * Farblehre, Nässe beim Neuwurf, sichtbare Rechnung, Pigment-Tropfen als Beute. Echte Würfel aus dem Spiel.
 * Bauen: npx esbuild tools/mockup/farbwurf-entwurf.ts --bundle --format=iife --outfile=tools/mockup/farbwurf-entwurf.js
 */
import { renderMonster } from '../../src/client/renderer/watercolor';
import { iconInner } from '../../src/client/duel/icons';
import { PIG, type PigmentId } from '../../src/shared/data';
import { dieUnit, find, type Face, type Unit } from '../../src/shared/duel/rules';
import type { BlueprintId } from '../../src/shared/data';
import { RNG } from '../../src/shared/rng';

/** Farbe einer Seite: Haupt- oder Zweitpigment (35 %), fest aus dem Seed. Sterne und Joker ohne Farbe */
function faceColour(u: Unit, i: number): PigmentId | null {
  const f = u.faces[i]!;
  if (f.k === 'star' || f.k === 'joker') return null;
  const r = RNG((u.m.seed ^ 0xc0105) + i * 7919);
  return u.sec && r() < 0.35 ? u.sec : u.m.main;
}
const rgba = (p: PigmentId, a: number) => `rgba(${PIG[p].rgb.join(',')},${a})`;
function face(f: Face | null, col: PigmentId | null, opts: { mud?: boolean; held?: boolean; cap?: string } = {}): string {
  if (opts.mud) return `<div class="face mud"><span>MUD</span></div>`;
  const wash = col ? `<div class="wash" style="background: radial-gradient(circle at 40% 35%, ${rgba(col, 0.42)}, ${rgba(col, 0.2)} 60%, ${rgba(col, 0.08)})"></div>` : '';
  const icon = f ? `<svg viewBox="0 0 20 20">${iconInner(f)}</svg>` : '';
  return `<div class="face${opts.held ? ' held' : ''}">${wash}${icon}${opts.cap ? `<small>${opts.cap}</small>` : ''}</div>`;
}
const crest = (k: 'step' | 'splash' | 'guard' | 'glow', n = 1): Face => ({ k, n });
const star = (n: number): Face => ({ k: 'star', n });
const grid = document.getElementById('grid')!;
function card(title: string, body: string, wide = false): HTMLElement {
  const c = document.createElement('div');
  c.className = 'card' + (wide ? ' wide' : '');
  c.innerHTML = `<h2>${title}</h2>${body}`;
  grid.append(c);
  return c;
}

/* 1 Seiten in Farbe: zwei echte Würfel, heute und mit Farbe */
const blots: [BlueprintId, PigmentId, string][] = [
  ['qualle', 'ultra', 'K1'],
  ['krabbe', 'karmin', 'K2'],
];
const c1 = card(
  '1 · Every face gets a colour',
  `<div id="blots"></div><p class="note">Each symbol face is painted in the blot's <b>main pigment</b> or, about one face in three, its <b>second pigment</b>. Stars and Jokers stay without colour. The symbols keep their job: <b>Step</b> moves, <b>Splash</b> hits a palette, <b>Guard</b> halves a hit, <b>Glow</b> fills the brim.</p>`,
);
for (const [bp, pig, salt] of blots) {
  const m = find(bp, pig, salt, true);
  m.gen = 2;
  const u = dieUnit(m);
  const row = document.createElement('div');
  row.className = 'blot';
  const cv = document.createElement('canvas');
  renderMonster(cv, m, 64, { dpr: 2 });
  cv.style.width = cv.style.height = '64px';
  row.append(cv);
  row.insertAdjacentHTML('beforeend', `<div class="nm">${u.name}<small>${PIG[u.m.main].n}${u.sec ? ` + ${PIG[u.sec].n}` : ''}</small></div>`);
  row.insertAdjacentHTML('beforeend', `<div class="faces">${u.faces.map((f, i) => face(f, faceColour(u, i))).join('')}</div>`);
  c1.querySelector('#blots')!.append(row);
}

/* 2 Kombis aus der Farblehre */
const rows: [string, string, string, string][] = [
  ['Pure', face(crest('splash'), 'karmin') + face(crest('step'), 'karmin') + face(crest('glow'), 'karmin'), '<b>×2</b> on every splash this turn and a <b>Joker</b>. Three faces of one pigment.', '1 %'],
  ['Burst', face(crest('splash'), 'karmin') + face(crest('guard'), 'phthalo') + face(star(2), null), 'Opposite colours: <b>×2</b>, but <b>35 %</b> it boils to mud and both faces count nothing.', '13–19 %'],
  ['Glaze', face(crest('step'), 'ultra') + face(crest('splash'), 'ultra') + face(crest('guard'), 'kadmium'), 'Two faces of one pigment: <b>×1.5</b> on every splash this turn.', '11–14 %'],
  ['Chain', face(crest('splash'), 'ultra') + face(crest('glow'), 'indigo') + face(star(1), null), 'Neighbours on the colour wheel: <b>×1.25</b>, and every hit this turn adds <b>+0.25</b>.', '9–12 %'],
  ['Three stars', face(star(2), null) + face(star(2), null) + face(star(2), null), 'Same level: a <b>Joker</b>, as today.', '12–18 %'],
];
card(
  '2 · Combos from the colour wheel',
  rows.map(([n, f, fx, pc]) => `<div class="row"><b>${n}</b><div><div class="faces">${f}</div><div class="fx">${fx}</div></div><div class="pc">${pc}<br>of rolls</div></div>`).join('') +
    `<p class="note">Replaces pair, triple and rainbow. Same rules as on the sheet: <b>same pigment layers, neighbours bleed, opposites make mud</b>. Percentages: simulation, 200 duels per opponent.</p>`,
);

/* 3 Nässe */
card(
  '3 · Wetness: reroll as often as you dare',
  `<div class="ladder">
    <div class="rung"><div class="drops">○</div><b>1st reroll</b><small>dry · free</small></div>
    <div class="rung"><div class="drops">●</div><b>2nd reroll</b><small>25 % per pair</small></div>
    <div class="rung"><div class="drops">●●</div><b>3rd reroll</b><small>50 % per pair</small></div>
    <div class="rung"><div class="drops">●●●</div><b>4th reroll</b><small>75 % per pair</small></div>
  </div>
  <div class="ex"><div class="faces">${face(crest('splash'), 'ultra', { held: true })}${face(crest('glow'), 'indigo')}</div><div class="arrow">→</div><div class="faces">${face(crest('splash'), 'ultra', { held: true })}${face(crest('glow'), 'ultra')}</div><p><b>Bloom.</b> Neighbouring colours run together: the right drop takes the left colour. Here a Chain becomes a Glaze.</p></div>
  <div class="ex"><div class="faces">${face(crest('splash'), 'karmin', { held: true })}${face(crest('step'), 'phthalo')}</div><div class="arrow">→</div><div class="faces">${face(null, null, { mud: true })}${face(null, null, { mud: true })}</div><p><b>Mud.</b> Opposite colours run together: both faces count nothing this roll, even the one you held.</p></div>
  <p class="note">Replaces the one free reroll. The first reroll stays dry, every further one makes the sheet wetter, and neighbouring dice may run together. Neutral colours just touch. Wet paint never hurts stars.</p>`,
);

/* 4 Rechnung */
card(
  '4 · The numbers count up',
  `<span class="banner">GLAZE · ULTRAMARINE ×1.5</span>
  <div class="math">10 <span class="m">× 1.5</span> = 15</div>
  <p class="note">Every splash shows its base, the multiplier of this turn and the result, counting up. A Chain grows with each hit:</p>
  <div class="chainrow"><span>1st hit 11 <b>×1.25</b></span><span>2nd 11 <b>×1.5</b></span><span>3rd 11 <b>×1.75</b></span></div>
  <p class="note">The multiplier lasts for the turn. Palette hits stay one heart each.</p>`,
);

/* 5 Beute */
card(
  '5 · Spoils: drops of pigment',
  `<div><span class="drop"><i style="background:${rgba('karmin', 1)}"></i>+1 Carmine</span><span class="drop"><i style="background:${rgba('indigo', 1)}"></i>+1 Indigo</span><span class="drop"><i style="background:${rgba('ultra', 1)}"></i>+1 Ultramarine · win</span></div>
  <p class="note">Every rival blot you wash out leaves a <b>drop of its main pigment</b>, a win adds one of your own colour. Drops recolour a face on a die card:</p>
  <div class="ex"><div class="faces">${face(crest('step'), 'kadmium')}</div><div class="arrow">→</div><div class="faces">${face(crest('step'), 'ultra', { cap: '3●' })}</div><p><b>Recolour for 3 drops.</b> Build a deck that rolls Pure more often. Doubling a face stays with glaze from washing out.</p></div>`,
  true,
);
(window as unknown as { done: boolean }).done = true;
