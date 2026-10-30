/*
 * Shiny im Stil malen: Einstieg für alle dreizehn Stile. Pencil, Comic, Bestiary Plate und Oil stehen in styles.ts,
 * Anime (neu seit 30.10.2026) und die acht Stile aus docs/entwuerfe/stile-mehr-plan.md in styles-more.ts.
 */
import type { StyleId } from '../../shared/dice';
import type { Monster } from '../../shared/monster';
import { RNG } from '../../shared/rng';
import { cutout, paintClassic } from './styles';
import { anime2, blueprint, crayon, mosaic, neon, papercut, pixel, stained, ukiyoe } from './styles-more';

/** Anime spielt je nach Monster im Himmel oder vor Speedlines (fest aus dem Seed) */
export const animeScene = (m: Monster): 'sky' | 'focus' => (RNG(m.seed + 909)() < 0.5 ? 'sky' : 'focus');
/** Stile, deren Figur über den Umriss hinaus leuchtet oder Bildpunkte hat: beim Freistellen etwas mehr Rand */
const RIM: Partial<Record<StyleId, number>> = { pixel: 0.028, neon: 0.03, stained: 0.02, mosaic: 0.025 };

/**
 * Malt ein Shiny im Stil. deco: Rahmen, Texte und Schild (nur groß). Das Monster ist für jede Größe dasselbe.
 * cutout: freigestellt für das Duell (ohne Rahmen und Text, alles außer dem Monster weg). Gibt die Malzeit in Millisekunden zurück.
 */
export function renderStyled(canvas: HTMLCanvasElement, m: Monster, style: StyleId, cssSize: number, opts: { dpr?: number; deco?: boolean; cutout?: boolean } = {}): number {
  const t0 = performance.now();
  const dpr = opts.dpr ?? Math.min(2, window.devicePixelRatio || 1);
  const S = Math.max(200, Math.round(cssSize * dpr));
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  // Generation 2: keine Extras aus dem Prototyp
  const mm: Monster = m.gen === 2 ? { ...m, face: { ...m.face, extra: 'keins' } } : m;
  const deco = (opts.deco ?? true) && !opts.cutout;
  switch (style) {
    case 'pencil':
    case 'comic':
    case 'plate':
    case 'oil':
      paintClassic(ctx, mm, style, S, deco);
      break;
    case 'anime':
      anime2(ctx, mm, S, animeScene(m), deco);
      break;
    case 'pixel':
      pixel(ctx, mm, S, deco);
      break;
    case 'ukiyoe':
      ukiyoe(ctx, mm, S, deco);
      break;
    case 'stained':
      stained(ctx, mm, S, deco);
      break;
    case 'neon':
      neon(ctx, mm, S, deco);
      break;
    case 'blueprint':
      blueprint(ctx, mm, S, deco);
      break;
    case 'crayon':
      crayon(ctx, mm, S, deco);
      break;
    case 'papercut':
      papercut(ctx, mm, S, deco);
      break;
    case 'mosaic':
      mosaic(ctx, mm, S, deco);
      break;
  }
  if (opts.cutout) cutout(ctx, mm, S, RIM[style]);
  return performance.now() - t0;
}
