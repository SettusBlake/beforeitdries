/* Startbild des Spiel-Posts (inline im Feed): zwei Kleckse, Play öffnet das Duell */
import './lib/fonts';
import './play.css';
import { requestExpandedMode } from '@devvit/web/client';
import { humidityFor, makeMonster } from '../shared/monster';
import { api } from './lib/api';
import { paintSteps } from './renderer/watercolor';

/* Dieselben zwei Kleckse wie auf dem Titel des Duells (rules.titleBlots), hier ohne die Regeln zu laden */
const BLOTS: [string, number, string][] = [
  ['A468', 0, 'you'],
  ['D100', 4, 'rival'],
];
/**
 * Im Feed zählt jede Millisekunde: die Kleckse malen sich in kleinen Schritten auf (höchstens 8 ms je Bild),
 * statt den ersten Bildaufbau zu blockieren (gemessen am vierfach gedrosselten Handy: 0,5 s Blockade vorher)
 */
let paintRun = 0;
function paintSlowly(jobs: (() => Generator<void, void>)[]): void {
  const run = ++paintRun;
  let it: Generator<void, void> | null = null;
  const step = () => {
    if (run !== paintRun) return;
    const t = performance.now();
    while (performance.now() - t < 8) {
      if (!it) {
        const next = jobs.shift();
        if (!next) return;
        it = next();
      }
      if (it.next().done) it = null;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function art(): void {
  const box = document.getElementById('p-art')!;
  const px = Math.round(Math.min(130, Math.max(80, box.clientHeight - 24)));
  box.replaceChildren();
  const jobs: (() => Generator<void, void>)[] = [];
  for (const [sheet, idx, cls] of BLOTS) {
    const c = document.createElement('canvas');
    c.className = 'pblot ' + cls;
    c.width = c.height = 1;
    c.style.width = c.style.height = `${px}px`;
    const m = { ...makeMonster(sheet, idx, humidityFor(sheet)), gen: 2 as const };
    jobs.push(() => paintSteps(c, m, px, { dpr: Math.min(2, window.devicePixelRatio || 1) }));
    box.append(c);
  }
  const vs = document.createElement('span');
  vs.className = 'vs';
  vs.textContent = 'vs';
  box.append(vs);
  paintSlowly(jobs);
}
art();

const play = document.getElementById('p-play')!;
const status = document.getElementById('p-status')!;
play.addEventListener('click', (e) => requestExpandedMode(e, 'duel'));

api
  .play()
  .then((r) => {
    // Gilded weekend (Samstag und Sonntag UTC): die Zeile über dem Titel wird golden
    if (r.gilded) {
      const eb = document.querySelector('.p-text .eyebrow');
      if (eb) {
        eb.textContent = 'Gilded weekend · higher chances';
        eb.classList.add('gilded');
      }
    }
    if (!r.user) return;
    if (r.running) {
      play.textContent = 'Continue';
      status.textContent = 'Your duel is still wet. Pick up where you left off.';
    } else if (r.starter > 0) status.textContent = `${r.starter} free dice are waiting for you.`;
    // Tagesgeschenk (T8): solange es zu ist, steht es zuerst
    else if (r.giftReady) status.textContent = `Today’s gift is waiting.${r.freeReady ? ' A free dip too.' : ''}`;
    else if (r.freeReady) status.textContent = `A free dip is ready. ${r.pigment} pigment.`;
    else status.textContent = `${r.pigment} pigment. Win duels to dip again.`;
  })
  .catch(() => undefined);
