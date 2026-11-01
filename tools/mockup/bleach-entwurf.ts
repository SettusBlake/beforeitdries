/*
 * Entwurfsbogen „Bleach“ (nur für docs/entwuerfe, docs/entwuerfe/bleach-plan.md): Tagesblatt gegen die Bleiche vom Rand,
 * eine Runde in drei Schritten, Ergebnis mit Punkten und Rang, Tagespost mit Rangliste, Kommentar mit Emoji-Blatt.
 * Echte Kleckse, Würfelseiten und Element-Zeichen aus dem Spiel.
 * Bauen: npx esbuild tools/mockup/bleach-entwurf.ts --bundle --format=iife --outfile=tools/mockup/bleach-entwurf.js
 */
import { renderMonster } from '../../src/client/renderer/watercolor';
import { dieUnit, find } from '../../src/shared/duel/rules';
import { elementDef, elementLine, elementMult, elementOf, type ElementId } from '../../src/shared/elements';
import { elementIcon } from '../../src/client/duel/elements';
import { faceTile, lookOf } from '../../src/client/duel/faceskin';
import type { BlueprintId, PigmentId } from '../../src/shared/data';
import type { Monster } from '../../src/shared/monster';

const grid = document.getElementById('grid')!;
function card(title: string, body: string, cls = ''): HTMLElement {
  const c = document.createElement('div');
  c.className = 'card ' + cls;
  c.innerHTML = `<h2>${title}</h2>${body}`;
  grid.append(c);
  return c;
}
const mon = (bp: BlueprintId, pig: PigmentId, salt: string): Monster => {
  const m = find(bp, pig, salt, true);
  m.gen = 2;
  return m;
};
function paint(m: Monster, px: number, cls = '', paper = true): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  renderMonster(cv, m, px, { dpr: 2, paper });
  cv.className = cls;
  cv.style.width = cv.style.height = px + 'px';
  return cv;
}

/* ---------- 1 Spielbildschirm ---------- */
const COLS = 6,
  ROWS = 8,
  CELL = 50;
const YOU = '43,63,163';
// Felder: '.' frei, 'y' deine Farbe, 'g' lasiert (zwei Schichten), 'b' ausgebleicht
const MAP = ['..b...', '..b.b.', 'b...b.', '...yyy', 'yy.yy.', 'yyyggy', 'yyggyy', 'yyyyyy'];
const phone = card('1 · Today’s sheet, wave 3 of 5', '<div class="phone" id="ph"></div>', 'tall');
const ph = phone.querySelector('#ph')!;
ph.innerHTML = `
  <div class="ptop"><div><p class="eyebrow">Today’s sheet · Nov 2</p><b class="wave">Wave 3 / 5</b></div><div class="score"><b>86</b><small>points</small></div></div>
  <div class="edge"><span style="left:${1 * CELL + 6}px">▼</span><span style="left:${3 * CELL + 6}px">▼</span><em>next wave: 2</em></div>
  <div class="sheet" id="sh"></div>
  <div class="pal"><span class="hearts">♥ ♥ <i>♥</i></span><b>Your palette</b><small>a Pale that gets through bleaches a heart</small></div>
  <div class="tray" id="tray"></div>
  <div class="btns"><span class="combo">GLAZE ×1.5</span><button>Reroll · ○ dry</button><button class="pri">Keep</button></div>`;
const sh = ph.querySelector('#sh') as HTMLElement;
sh.style.width = COLS * CELL + 'px';
sh.style.height = ROWS * CELL + 'px';
MAP.forEach((row, y) =>
  [...row].forEach((c, x) => {
    const d = document.createElement('div');
    d.className = 'cell ' + ({ y: 'you', g: 'you glz', b: 'bl' } as Record<string, string>)[c] ?? '';
    if (c === '.') d.className = 'cell';
    d.style.left = x * CELL + 'px';
    d.style.top = y * CELL + 'px';
    sh.append(d);
  }),
);
type Pale = { m: Monster; x: number; y: number; hp: number; max: number };
const pales: Pale[] = [
  { m: mon('kriecher', 'indigo', 'P1'), x: 2, y: 3, hp: 14, max: 20 },
  { m: mon('huepfer', 'kadmium', 'P2'), x: 4, y: 2, hp: 22, max: 22 },
  { m: mon('qualle', 'phthalo', 'P3'), x: 0, y: 3, hp: 9, max: 12 },
];
const mine: { m: Monster; x: number; y: number }[] = [
  { m: mon('krabbe', 'ultra', 'Y1'), x: 3, y: 5 },
  { m: mon('schlange', 'ultra', 'Y2'), x: 1, y: 6 },
];
const badge = (k: ElementId, px = 16) => `<span class="elb">${elementIcon(k, px)}</span>`;
for (const p of pales) {
  const w = document.createElement('div');
  w.className = 'unit pale';
  w.style.left = p.x * CELL - CELL * 0.35 + 'px';
  w.style.top = p.y * CELL - CELL * 0.75 + 'px';
  w.append(paint(p.m, CELL * 1.7, '', false));
  w.insertAdjacentHTML('beforeend', `<span class="hp"><i style="width:${(p.hp / p.max) * 100}%"></i></span>${badge(elementOf(p.m))}`);
  sh.append(w);
}
for (const u of mine) {
  const w = document.createElement('div');
  w.className = 'unit mine';
  w.style.left = u.x * CELL - CELL * 0.35 + 'px';
  w.style.top = u.y * CELL - CELL * 0.75 + 'px';
  w.append(paint(u.m, CELL * 1.7, '', false));
  w.insertAdjacentHTML('beforeend', `<span class="sock"></span>${badge(elementOf(u.m))}`);
  sh.append(w);
}
// Zielen: vom Krebs auf den Pale in Spalte 4
const a = mine[0]!,
  t = pales[1]!;
const ax = a.x * CELL + CELL / 2,
  ay = a.y * CELL + CELL / 2,
  tx = t.x * CELL + CELL / 2,
  ty = t.y * CELL + CELL / 2;
const ea = elementOf(a.m),
  et = elementOf(t.m);
const em = elementMult(ea, et);
const dmg = Math.round(12 * em * 1.5);
const why = elementLine(ea, et) ?? `${elementDef(ea).name} vs ${elementDef(et).name}`;
sh.insertAdjacentHTML(
  'beforeend',
  `<svg class="aim" width="${COLS * CELL}" height="${ROWS * CELL}"><path d="M${ax} ${ay} Q ${(ax + tx) / 2 + 30} ${(ay + ty) / 2} ${tx} ${ty}" stroke="#1d2130" stroke-width="3" stroke-dasharray="7 5" fill="none"/><circle cx="${tx}" cy="${ty}" r="20" fill="none" stroke="#c9961e" stroke-width="3"/></svg>
   <div class="calc" style="left:${(COLS * CELL - 284) / 2}px;top:${7 * CELL + 2}px"><b>−${dmg}</b> 12${em !== 1 ? ` ×${em}` : ''} ×1.5 · ${dmg >= t.hp ? 'washes it out, +10' : `${t.hp - dmg} left`}<br><small>${why}</small></div>`,
);
// Würfel: drei Würfel mit echten Seiten
const tray = ph.querySelector('#tray')!;
for (const [i, u] of mine.map((x) => dieUnit(x.m)).concat([dieUnit(mon('knolle', 'ultra', 'Y3'))]).entries()) {
  const f = u.faces.find((x, k) => (i === 2 ? x.k === 'star' : x.c === 'ultra' && k >= i)) ?? u.faces[0]!;
  tray.insertAdjacentHTML('beforeend', `<span class="die${i < 2 ? ' held' : ''}">${faceTile(f, lookOf(u.m), 46)}</span>`);
}
phone.insertAdjacentHTML(
  'beforeend',
  `<p class="note">Same 6 × 8 sheet, same dice, same blots as in a duel. There is no rival: <b>Pales</b> (bleached blots from the archive) slide in from the top edge, two steps each round. The marks above the sheet show where the next wave comes in.</p>`,
);

/* ---------- 2 Eine Runde ---------- */
const mini = (rows: string[], pale: number | null, note: string) => {
  let s = `<div class="mini"><div class="col">`;
  rows.forEach((c, i) => {
    s += `<span class="mc ${c}">${pale === i ? '<i class="pg"></i>' : ''}</span>`;
  });
  return s + `</div><small>${note}</small></div>`;
};
card(
  '2 · One round, three steps',
  `<ol class="steps">
    <li><b>Roll.</b> Three dice from today’s deck. Hold, reroll, mind the wet paper. Glaze, Pure and three stars work as in a duel.</li>
    <li><b>Paint.</b> Stars unfold a blot (its net paints cells). Blots walk, stamp paint and splash Pales: element and combo count. <b>Splash</b> on its own flicks every Pale in one row (−4). <b>Guard</b> shields one heart. <b>Glow</b> fills the brim for a master stroke.</li>
    <li><b>The Bleach moves.</b> Every Pale takes two steps down its column. A step into your paint bleaches that cell instead (glazed cells cost two steps). A blot in its way takes a hit. A Pale that slides off the bottom edge bleaches one heart.</li>
  </ol>
  <div class="minis">
    ${mini(['', '', 'you', 'you'], 1, 'Pale above your paint')}
    <span class="arr">→</span>
    ${mini(['', '', 'bl', 'you'], 1, 'step 1: it bleaches the cell')}
    <span class="arr">→</span>
    ${mini(['', '', '', 'you'], 2, 'step 2: it slides in')}
  </div>
  <p class="note"><b>5 waves</b>, then the sheet dries. Lose all three hearts and it dries early.</p>`,
);

/* ---------- 3 Ergebnis ---------- */
card(
  '3 · The sheet dried',
  `<div class="res"><p class="eyebrow">Today’s sheet · Nov 2</p><h3>The edge held</h3>
   <table>
     <tr><td>Cells in your colour</td><td>21 × 1</td><td>21</td></tr>
     <tr><td>Glazed cells</td><td>4 × 1</td><td>+4</td></tr>
     <tr><td>Pales washed out</td><td>6 × 10</td><td>60</td></tr>
     <tr><td>Hearts left</td><td>2 × 15</td><td>30</td></tr>
     <tr class="sum"><td>Points</td><td></td><td>115</td></tr>
   </table>
   <p class="rank"><b>#12</b> of 87 painters today</p>
   <p class="loot"><span class="pigi"></span> +40 pigment · <span class="drop" style="background:#1f7a5a"></span> 1 drop of Phthalo Green, today’s colour</p>
   <p class="hand">“Six of them, gone. The other two will be back tomorrow, I expect.”</p>
   <div class="rbtns"><button>Share as a comment</button><button class="pri">See the board</button></div></div>
   <p class="note">One ranked run a day. Points and rank come from the server. Sharing is a separate button, never required.</p>`,
);

/* ---------- 4 Tagespost ---------- */
const board: [string, number][] = [
  ['u/inkwell_otter', 162],
  ['u/Vegavild', 151],
  ['u/softbristle', 140],
  ['u/gouache_goblin', 133],
  ['u/paynesgrey', 128],
];
const sheetMini = (seed: number) => {
  let s = '<span class="smini">';
  for (let i = 0; i < 48; i++) {
    const v = Math.sin(seed * 31 + i * 7.13) * 0.5 + 0.5;
    const row = Math.floor(i / 6);
    s += `<i class="${v > 0.62 - row * 0.07 ? 'y' : v < 0.12 ? 'b' : ''}"></i>`;
  }
  return s + '</span>';
};
card(
  '4 · The daily post',
  `<div class="post"><div class="phead"><span class="sr">r/beforeitdries</span> · u/beforeitdries · 9h</div>
   <h3>Today’s sheet · Nov 2 · Something is bleaching the top edge</h3>
   <div class="pbody"><p class="eyebrow">5 waves · 11 Pales · Master Sepia lends everyone the same nine dice</p>
   <div class="pales">${pales
     .concat(pales)
     .slice(0, 5)
     .map((p) => `<span class="pthumb"></span>`)
     .join('')}</div>
   <button class="pri wide">Play today’s sheet</button>
   <ol class="lb">${board.map(([n, s], i) => `<li><b>${i + 1}</b>${sheetMini(i + 3)}<span>${n}</span><em>${s}</em></li>`).join('')}<li class="me"><b>12</b>${sheetMini(9)}<span>you</span><em>115</em></li></ol>
   <small class="pfoot">87 painters · ranking closes at midnight UTC · yesterday’s best sheet below</small></div></div>
   <p class="note">One post a day from the app (scheduler). It is the result post: board, top sheets painted from their final state, yesterday’s winner. The play post stays the main entry.</p>`,
);
// Kleine Pales im Tagespost
const thumbs = grid.querySelectorAll('.pthumb');
thumbs.forEach((tEl, i) => tEl.append(paint([pales[0]!, pales[1]!, pales[2]!, pales[1]!, pales[0]!][i]!.m, 40, 'palec', false)));

/* ---------- 5 Kommentar ---------- */
const EMO: Record<string, string> = { '.': '⬜', y: '🟦', g: '🟦', b: '🌫️' };
const emo = MAP.map((r) => [...r].map((c) => EMO[c]).join('')).join('\n');
card(
  '5 · Share as a comment',
  `<div class="cmt"><div class="chead"><span class="av"></span><b>u/Vegavild</b> · 2m</div>
   <pre>Before It Dries · Today’s sheet Nov 2
115 points · #12 of 87
${emo}
❤️❤️🤍 · 6 Pales washed out</pre>
   <div class="cfoot">⇧ 14 ⇩ · Reply</div></div>
   <p class="note">Posted as you, under the daily post, only when you tap the button (Reddit “user actions”, needs Reddit’s approval at release; in the playtest it posts from the app account). The squares are your final sheet, like Wordle.</p>`,
);
(window as unknown as { done: boolean }).done = true;
