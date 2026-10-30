/* Startbild des Spiel-Posts (inline im Feed): zwei Kleckse, Play öffnet das Duell */
import './lib/fonts';
import './play.css';
import { requestExpandedMode } from '@devvit/web/client';
import { humidityFor, makeMonster } from '../shared/monster';
import { api } from './lib/api';
import { renderMonster } from './renderer/watercolor';

/* Dieselben zwei Kleckse wie auf dem Titel des Duells (rules.titleBlots), hier ohne die Regeln zu laden */
const BLOTS: [string, number, string][] = [
  ['A468', 0, 'you'],
  ['D100', 4, 'rival'],
];
function art(): void {
  const box = document.getElementById('p-art')!;
  const px = Math.round(Math.min(130, Math.max(80, box.clientHeight - 24)));
  box.replaceChildren();
  for (const [sheet, idx, cls] of BLOTS) {
    const c = document.createElement('canvas');
    c.className = 'pblot ' + cls;
    c.width = c.height = 1;
    c.style.width = c.style.height = `${px}px`;
    renderMonster(c, { ...makeMonster(sheet, idx, humidityFor(sheet)), gen: 2 }, px, { dpr: Math.min(2, window.devicePixelRatio || 1) });
    box.append(c);
  }
  const vs = document.createElement('span');
  vs.className = 'vs';
  vs.textContent = 'vs';
  box.append(vs);
}
art();

const play = document.getElementById('p-play')!;
const status = document.getElementById('p-status')!;
play.addEventListener('click', (e) => requestExpandedMode(e, 'duel'));

api
  .play()
  .then((r) => {
    if (!r.user) return;
    if (r.running) {
      play.textContent = 'Continue';
      status.textContent = 'Your duel is still wet. Pick up where you left off.';
    } else if (r.starter > 0) status.textContent = `${r.starter} free dice are waiting for you.`;
    else if (r.freeReady) status.textContent = `A free dip is ready. ${r.pigment} pigment.`;
    else status.textContent = `${r.pigment} pigment. Win duels to dip again.`;
  })
  .catch(() => undefined);
