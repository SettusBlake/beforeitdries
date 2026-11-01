/* Echte 3D-Würfel aus CSS: sechs Seiten, rollen, springen und bleiben mit der geworfenen Seite oben liegen */
import { iconSvg, MUD_SVG } from './icons';
import type { Face } from '../../shared/duel/rules';
import { PIG, type RGB } from '../../shared/data';
import { faceSvg, type Skin } from './faceskin';

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

/** Haut der Seiten (Entwurf Würfel-Häute) und Holo-Folie, sonst wie bisher */
export type CubeLook = { skin?: Skin; holo?: boolean; tint?: RGB };
export function makeCube(faces: Face[], size: number, tint: string, look: CubeLook = {}): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'die3' + (look.holo ? ' holo-die' : '');
  wrap.style.width = wrap.style.height = size + 'px';
  if (look.skin) wrap.dataset.skin = look.skin;
  if (look.tint) wrap.dataset.tint = look.tint.join(',');
  const shadow = document.createElement('div');
  shadow.className = 'd3shadow';
  const bounce = document.createElement('div');
  bounce.className = 'd3bounce';
  const cube = document.createElement('div');
  cube.className = 'd3cube';
  faces.forEach((f, k) => {
    const d = document.createElement('div');
    d.className = 'd3face' + (f.k === 'star' ? ' star' : '') + (look.skin ? ' skin' : '');
    d.style.transform = `${FACE_T[k]} translateZ(${size / 2}px)`;
    if (look.skin) d.innerHTML = faceSvg(f, look.skin, size, look.tint);
    else {
      // Rand in der Farbe der Seite (Kampf A), Sterne und Joker im Ton des Würfels
      d.style.borderColor = f.c ? `rgb(${PIG[f.c].rgb})` : tint;
      d.innerHTML = iconSvg(f, Math.round(size * 0.6));
    }
    cube.append(d);
  });
  bounce.append(cube);
  wrap.append(shadow, bounce);
  return wrap;
}

/** Eine Seite neu zeichnen: nach dem Ausbluten in neuer Farbe oder als Schlamm (Kampf A) */
export function setCubeFace(wrap: HTMLElement, fi: number, f: Face, mud: boolean): void {
  const d = wrap.querySelectorAll('.d3face')[fi] as HTMLElement | undefined;
  if (!d) return;
  const px = Math.round(wrap.offsetWidth * 0.6) || 30;
  const skin = wrap.dataset.skin as Skin | undefined;
  const tp = (wrap.dataset.tint ?? '').split(',').map(Number);
  const tint: RGB | undefined = tp.length === 3 && tp.every((v) => Number.isFinite(v)) ? [tp[0]!, tp[1]!, tp[2]!] : undefined;
  d.classList.toggle('mud', mud);
  d.innerHTML = mud ? `<svg width="${px}" height="${px}" viewBox="0 0 20 20" aria-hidden="true">${MUD_SVG}</svg>` : skin ? faceSvg(f, skin, wrap.offsetWidth || 40, tint) : iconSvg(f, px);
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
