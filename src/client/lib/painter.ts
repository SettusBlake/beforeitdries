/*
 * Malt Monster nebenbei: das Bild entsteht in kleinen Schritten, ein paar Millisekunden pro Bildwechsel,
 * damit Animationen (Ziehen, Duell) flüssig bleiben. Fertige Bilder kommen in einen Zwischenspeicher.
 */
import type { Monster } from '../../shared/monster';
import { renderStyled } from '../renderer/shiny';
import type { RenderOptions } from '../renderer/watercolor';
import { paintSteps } from '../renderer/watercolor';

/** deco: bei Stilen Rahmen, Texte und Schild (nur große Bilder) */
export type PaintOptions = RenderOptions & { deco?: boolean };

/** Stil: in einem Stück in der eigenen Malweise. Ohne Papier freigestellt (Duell) */
function* styledSteps(canvas: HTMLCanvasElement, m: Monster, cssSize: number, opts: PaintOptions): Generator<void, void> {
  yield;
  renderStyled(canvas, m, m.style!, cssSize, { dpr: opts.dpr, deco: opts.deco ?? false, cutout: opts.paper === false });
}

type Job = { it: Generator<void, void>; prio: number; done: () => void; fail: (e: unknown) => void };
const jobs: Job[] = [];
let running = false;
/** Millisekunden Malzeit pro Bildwechsel */
const BUDGET = 6;

function tick(): void {
  const t0 = performance.now();
  while (jobs.length && performance.now() - t0 < BUDGET) {
    const j = jobs[0]!;
    try {
      if (j.it.next().done) {
        jobs.shift();
        j.done();
      }
    } catch (e) {
      jobs.shift();
      j.fail(e);
    }
  }
  if (jobs.length) requestAnimationFrame(tick);
  else running = false;
}

/** In die Warteschlange: höhere prio zuerst. Das Canvas ist erst nach dem Versprechen fertig */
export function paintLater(canvas: HTMLCanvasElement, m: Monster, cssSize: number, opts: PaintOptions = {}, prio = 0): Promise<HTMLCanvasElement> {
  return new Promise((res, rej) => {
    const it = m.style ? styledSteps(canvas, m, cssSize, opts) : paintSteps(canvas, m, cssSize, opts);
    const job: Job = { it, prio, done: () => res(canvas), fail: rej };
    const at = jobs.findIndex((x) => x.prio < prio);
    // Der laufende Auftrag bleibt vorn, sonst müsste er neu anfangen
    if (at < 0) jobs.push(job);
    else jobs.splice(Math.max(1, at), 0, job);
    if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
  });
}

/** Zwischenspeicher fertiger Bilder (auf eigenem Canvas, nie im Bild sichtbar, solange es entsteht) */
const cache = new Map<string, Promise<HTMLCanvasElement>>();
const ready = new Map<string, HTMLCanvasElement>();
export function painted(key: string, m: Monster, cssSize: number, opts: PaintOptions = {}, prio = 0): Promise<HTMLCanvasElement> {
  let p = cache.get(key);
  if (!p) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    p = paintLater(c, m, cssSize, opts, prio).then((x) => {
      ready.set(key, x);
      return x;
    });
    cache.set(key, p);
  }
  return p;
}
/** Schon fertig gemalt? Dann sofort, sonst null */
export const paintedNow = (key: string): HTMLCanvasElement | null => ready.get(key) ?? null;

/** Fertige Bilder je Würfel in beliebiger Größe (z. B. vom Ziehen): Sammlung und Übersicht nehmen sie, statt neu zu malen */
const loose = new Map<string, HTMLCanvasElement>();
/** Schlüssel dafür: gemalte Monster eigens, damit ein übermaltes nicht mit dem alten Bild erscheint */
export const looseKey = (id: string, m: { draw?: string }): string => (m.draw ? id + ':draw' : id);
export function keepLoose(id: string, c: HTMLCanvasElement): void {
  const old = loose.get(id);
  if (!old || old.width <= c.width) loose.set(id, c);
}
/** Ein fertiges Bild des Würfels, mindestens so groß wie verlangt, sonst null */
export function looseNow(id: string, min: number): HTMLCanvasElement | null {
  const c = loose.get(id);
  return c && c.width >= min ? c : null;
}
