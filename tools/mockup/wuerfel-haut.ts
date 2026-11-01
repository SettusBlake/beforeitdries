/*
 * Entwurfsbogen „Würfel-Häute“ (nur für docs/entwuerfe, docs/entwuerfe/wuerfel-haut-vorschlag.md): Farben auf den Würfeln
 * sichtbarer, Holo-Würfel und Stil-Würfel. Echte Würfel aus dem Spiel, Häute aus src/client/duel/faceskin.ts.
 * Bauen: npx esbuild tools/mockup/wuerfel-haut.ts --bundle --format=iife --outfile=tools/mockup/wuerfel-haut.js
 */
import { renderMonster } from '../../src/client/renderer/watercolor';
import { renderStyled } from '../../src/client/renderer/shiny';
import { makeCube } from '../../src/client/duel/dice3d';
import { faceSvg, tintOf, type Skin } from '../../src/client/duel/faceskin';
import { PIG, PIGMENTS, type BlueprintId, type PigmentId } from '../../src/shared/data';
import { STYLES } from '../../src/shared/dice';
import { dieUnit, find, type Face, type Unit } from '../../src/shared/duel/rules';
import type { Monster } from '../../src/shared/monster';

const grid = document.getElementById('grid')!;
function card(title: string, body: string, wide = false): HTMLElement {
  const c = document.createElement('div');
  c.className = 'card' + (wide ? ' wide' : '');
  c.innerHTML = `<h2>${title}</h2>${body}`;
  grid.append(c);
  return c;
}
/** Ein Würfel mit Joker, Doppelseite und Zweitfarbe (gesucht über den Zusatz im Namen) */
function pickDie(bp: BlueprintId, pig: PigmentId): { m: Monster; u: Unit } {
  for (let k = 0; k < 400; k++) {
    const m = find(bp, pig, 'S' + k, true);
    m.gen = 2;
    const u = dieUnit(m);
    const hasSec = u.faces.some((f) => f.c && f.c !== u.m.main);
    const fancy = u.faces.some((f) => f.k !== 'star' && f.k !== 'joker' && f.k !== 'gold' && (f.n > 1 || f.k2));
    if (hasSec && fancy && u.faces.some((f) => f.k === 'star')) return { m, u };
  }
  const m = find(bp, pig, 'S0', true);
  return { m, u: dieUnit(m) };
}
/** Reihenfolge für den Würfel: vorne eine Farbseite, rechts ein Stern, oben eine Doppel- oder Mischseite */
function showOrder(faces: Face[]): Face[] {
  const rest = [...faces];
  const take = (ok: (f: Face) => boolean) => {
    const i = rest.findIndex(ok);
    return i >= 0 ? rest.splice(i, 1)[0]! : rest.shift()!;
  };
  const front = take((f) => !!f.c && f.n === 1 && !f.k2);
  const right = take((f) => f.k === 'star' || f.k === 'joker');
  const top = take((f) => !!f.c && (f.n > 1 || !!f.k2));
  const out: Face[] = [front, right, rest.shift()!, rest.shift()!, top, rest.shift()!];
  return out;
}
const cubeEl = (u: Unit, skin: Skin | null, holo = false, size = 54) => {
  const st = document.createElement('div');
  st.className = 'stage';
  const faces = showOrder(u.faces);
  const cube = makeCube(faces, size, `rgb(${PIG[u.m.main].rgb})`, skin ? { skin, holo, tint: tintOf(u.m.main) } : { holo });
  st.append(cube);
  return st;
};
const flat = (u: Unit, skin: Skin, holo = false) => u.faces.map((f) => `<div class="fface${holo ? ' holo' : ''}">${faceSvg(f, skin, 46, tintOf(u.m.main))}</div>`).join('');

const dice = [pickDie('qualle', 'ultra'), pickDie('krabbe', 'karmin')];

/* 1 Farbe sichtbar */
const c1 = card(
  '1 · Colour you can read',
  `<div id="v"></div><p class="note"><b>Today</b> the colour is a pale wash behind the symbol. <b>A</b> paints the whole face in its pigment and lifts a spot of paper for the symbol, like lifting wet paint with a tissue. <b>B</b> is A plus a two-letter tag, so Ultramarine and Indigo or Sienna and Sepia never get mixed up.</p>`,
  true,
);
const vbox = c1.querySelector('#v')!;
for (const [skin, name, sub] of [
  ['wash', 'Today', 'pale wash'],
  ['paint', 'A', 'whole face'],
  ['tag', 'B', 'A + tag'],
] as [Skin, string, string][]) {
  for (const d of dice) {
    const row = document.createElement('div');
    row.className = 'vrow';
    row.innerHTML = `<div class="lbl"><b>${name}</b><small>${sub} · ${PIG[d.u.m.main].n}${d.u.sec ? ` + ${PIG[d.u.sec].n}` : ''}</small></div>`;
    row.append(cubeEl(d.u, skin));
    row.insertAdjacentHTML('beforeend', `<div class="faces">${flat(d.u, skin)}</div>`);
    vbox.append(row);
  }
}

/* 2 Alle acht Pigmente */
const glow = (p: PigmentId): Face => ({ k: 'splash', n: 1, c: p });
const SHORT: Record<PigmentId, string> = { ultra: 'Ultra', phthalo: 'Phthalo', karmin: 'Carmine', kadmium: 'Cadmium', siena: 'Sienna', indigo: 'Indigo', sepia: 'Sepia', opera: 'Opera' };
const pigRow = (skin: Skin, name: string) => `<b style="font-size:13px">${name}</b>` + PIGMENTS.map((p) => `<div class="fface">${faceSvg(glow(p.id), skin, 46)}</div>`).join('');
card(
  '2 · All eight pigments side by side',
  `<div class="pigs"><span></span>${PIGMENTS.map((p) => `<small>${SHORT[p.id]}</small>`).join('')}${pigRow('wash', 'Today')}${pigRow('paint', 'A')}${pigRow('tag', 'B')}</div><p class="note">The two blues and the two browns are the close calls. A makes them darker and richer, B also names them.</p>`,
);

/* 3 Holo */
const c3 = card(
  '3 · Holo die',
  `<div class="holo-row" id="h"></div><p class="note">A die whose blot is <b>holo</b> wears the foil too: a rainbow rim on every face and a sheen that runs across while it rolls (still here, it moves in the game). Works on top of any skin.</p>`,
);
const hbox = c3.querySelector('#h')!;
hbox.append(cubeEl(dice[0]!.u, 'paint', true, 60), cubeEl(dice[1]!.u, 'paint', true, 60));
hbox.insertAdjacentHTML('beforeend', `<div class="faces" style="max-width:170px">${dice[1]!.u.faces.slice(0, 3).map((f) => `<div class="fface holo">${faceSvg(f, 'paint', 46, tintOf(dice[1]!.u.m.main))}</div>`).join('')}</div>`);

/* 4 Stil-Würfel */
const c4 = card(
  '4 · Style dice: the die takes the style of its blot',
  `<div class="styles" id="s"></div><p class="note">Every one of the fifteen styles gets its own dice skin. The face colour stays readable in each: as the main tint, a glow, a pane of glass or a swatch. Stars and Jokers stay without colour. A style die can be holo as well.</p>`,
  true,
);
const sbox = c4.querySelector('#s')!;
const base = dice[1]!;
for (const st of STYLES) {
  const el = document.createElement('div');
  el.className = 'sty';
  const pair = document.createElement('div');
  pair.className = 'pair';
  const cv = document.createElement('canvas');
  const m = { ...base.m, style: st.k };
  renderStyled(cv, m, st.k, 58, { dpr: 2 });
  cv.style.width = cv.style.height = '58px';
  pair.append(cv, cubeEl(base.u, st.k, false, 50));
  el.append(pair);
  el.insertAdjacentHTML('beforeend', `<b>${st.label}</b><div class="faces" style="justify-content:center">${showOrder(base.u.faces).filter((_, i) => i === 0 || i === 1 || i === 4).map((f) => `<div class="fface" style="width:34px;height:34px">${faceSvg(f, st.k, 34, tintOf(base.u.m.main))}</div>`).join('')}</div>`);
  sbox.append(el);
}
// Wasserfarben-Klecks zum Vergleich unten links
const ref = document.createElement('canvas');
renderMonster(ref, base.m, 58, { dpr: 2 });
(window as unknown as { done: boolean }).done = true;
