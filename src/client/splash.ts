/* Launch-Screen (inline im Feed): Tagesklecks groß, Luftfeuchte, Play-Button */
import './lib/fonts';
import './styles/base.css';
import './splash.css';
import { context, requestExpandedMode } from '@devvit/web/client';
import type { DayPostData, InitResponse } from '../shared/api';
import { isDayKey, msUntilDayEnds, prettyDay } from '../shared/day';
import { humidityFor, makeMonster, type Monster } from '../shared/monster';
import { api, serverNow, syncClock } from './lib/api';
import { $, clear } from './lib/dom';
import { paint } from './lib/paint';
import { fmtDuration, humidityChip, speciesTitle, subLine } from './lib/view';

const canvas = $<HTMLCanvasElement>('s-canvas');
const play = $<HTMLButtonElement>('s-play');
const status = $('s-status');

let blot: Monster | null = null;

function show(m: Monster, day: string): void {
  blot = m;
  $('s-eyebrow').textContent = `Daily blot · ${prettyDay(day)}`;
  clear($('s-hum'), humidityChip(m.humidity));
  $('s-name').textContent = speciesTitle(m, null);
  clear($('s-sub'), subLine(m));
  paint(canvas, m, true);
}

function update(r: InitResponse): void {
  syncClock(r.serverNow);
  if (!r.day) {
    $('s-name').textContent = 'No blot on this post';
    status.textContent = 'Open the game to see your sheet.';
    return;
  }
  if (!blot) show(r.caught ?? makeMonster(r.day.day, 0, r.day.humidity), r.day.day);
  else if (r.caught) paint(canvas, r.caught, true);
  $('s-name').textContent = speciesTitle(blot!, r.day.species);
  const caught = r.day.catches === 1 ? '1 caught' : `${r.day.catches} caught`;
  clear($('s-sub'), subLine(blot!, caught));
  if (r.caught) {
    status.textContent = r.day.species ? `Named by u/${r.day.species.namedBy}.` : 'Unnamed. What do you see? Name it in the comments.';
  } else if (r.day.catchable) {
    status.textContent = `Still wet. Dries in ${fmtDuration(msUntilDayEnds(serverNow()))}.`;
  } else {
    status.textContent = 'This blot has dried. Today’s blot is waiting.';
  }
}

/* Sofort malen: Form und Farbe stehen im Post selbst, der Server liefert nur den Zustand nach */
const pd = context?.postData as Partial<DayPostData> | undefined;
if (pd && isDayKey(pd.day)) show(makeMonster(pd.day, 0, humidityFor(pd.day)), pd.day);

play.addEventListener('click', (e) => requestExpandedMode(e, 'game'));

api
  .init()
  .then(update)
  .catch(() => {
    status.textContent = 'Tap Play to open the game.';
  });
