/* Echte 3D-Würfel aus CSS: sechs Seiten, rollen, springen und bleiben mit der geworfenen Seite oben liegen */
import { iconSvg } from './icons';
import type { Face } from '../../shared/duel/rules';

/** Lage der Seiten am Würfel und die Drehung, die eine Seite nach vorne bringt */
const FACE_T = ['rotateY(0deg)', 'rotateY(90deg)', 'rotateY(180deg)', 'rotateY(-90deg)', 'rotateX(90deg)', 'rotateX(-90deg)'];
const SHOW: [number, number][] = [
  [0, 0],
  [0, -90],
  [0, -180],
  [0, 90],
  [-90, 0],
  [90, 0],
];

export function makeCube(faces: Face[], size: number, tint: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'die3';
  wrap.style.width = wrap.style.height = size + 'px';
  const shadow = document.createElement('div');
  shadow.className = 'd3shadow';
  const bounce = document.createElement('div');
  bounce.className = 'd3bounce';
  const cube = document.createElement('div');
  cube.className = 'd3cube';
  faces.forEach((f, k) => {
    const d = document.createElement('div');
    d.className = 'd3face' + (f.k === 'star' ? ' star' : '');
    d.style.transform = `${FACE_T[k]} translateZ(${size / 2}px)`;
    d.style.borderColor = tint;
    d.innerHTML = iconSvg(f, Math.round(size * 0.6));
    cube.append(d);
  });
  bounce.append(cube);
  wrap.append(shadow, bounce);
  return wrap;
}

/** Einen Würfel rollen lassen, er bleibt auf Seite fi liegen */
export function tumble(wrap: HTMLElement, fi: number, delay: number, dur: number, fromX: number): Promise<void> {
  const cube = wrap.querySelector('.d3cube') as HTMLElement;
  const bounce = wrap.querySelector('.d3bounce') as HTMLElement;
  const shadow = wrap.querySelector('.d3shadow') as HTMLElement;
  const [rx, ry] = SHOW[fi]!;
  const r = () => Math.floor(Math.random() * 360);
  const spinX = 360 * (2 + Math.floor(Math.random() * 2)),
    spinY = 360 * (1 + Math.floor(Math.random() * 2));
  const opts = { duration: dur, delay, fill: 'both' as FillMode };
  cube.animate([{ transform: `rotateX(${r()}deg) rotateY(${r()}deg) rotateZ(${r()}deg)` }, { transform: `rotateX(${rx + spinX}deg) rotateY(${ry + spinY}deg) rotateZ(0deg)` }], {
    ...opts,
    easing: 'cubic-bezier(.12,.62,.22,1)',
  });
  bounce.animate(
    [
      { transform: `translate3d(${fromX}px,-140px,0)`, offset: 0 },
      { transform: 'translate3d(0,0,0)', offset: 0.45 },
      { transform: 'translate3d(0,-22px,0)', offset: 0.6 },
      { transform: 'translate3d(0,0,0)', offset: 0.74 },
      { transform: 'translate3d(0,-6px,0)', offset: 0.85 },
      { transform: 'translate3d(0,0,0)', offset: 1 },
    ],
    { ...opts, easing: 'ease-in' },
  );
  shadow.animate(
    [
      { transform: 'scale(.3)', opacity: 0.1, offset: 0 },
      { transform: 'scale(1)', opacity: 0.35, offset: 0.45 },
      { transform: 'scale(.8)', opacity: 0.25, offset: 0.6 },
      { transform: 'scale(1)', opacity: 0.35, offset: 1 },
    ],
    opts,
  );
  return new Promise((res) => window.setTimeout(res, delay + dur));
}
