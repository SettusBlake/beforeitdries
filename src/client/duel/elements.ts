/* Element-Zeichen (01.11.2026, docs/entwuerfe/elemente-vorschlag.md): Abzeichen für Karten, Kacheln, Chips und das Blatt */
import { elementDef, elementFoes, elementPrey, ELEMENT_MULT, type ElementId } from '../../shared/elements';

/** Zeichen im Raster 24 × 24, weiß auf der Farbe des Elements */
const ICON: Record<ElementId, string> = {
  wash: '<path d="M12 3c3.5 4.6 5.5 7.4 5.5 10a5.5 5.5 0 0 1-11 0c0-2.6 2-5.4 5.5-10z" fill="#fff"/><path d="M8.6 14.2c.6 1.6 1.8 2.4 3.4 2.6" stroke="#2f74b5" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  vermilion: '<path d="M12 2.8c1 3.4 4.8 5.2 4.8 9.8a4.8 4.8 0 0 1-9.6 0c0-2.4 1.2-3.8 2.2-4.8.2 1.8 1 2.6 2 2.8-.6-2.6.2-5.4.6-7.8z" fill="#fff"/>',
  gilt: '<path d="M4 16l4-7h8l4 7z" fill="#fff"/><path d="M8 9l2 7M16 9l-2 7" stroke="#a8842c" stroke-width="1.1"/>',
  sap: '<path d="M12 20V10M12 13c-4-1-6-4-6-8 4 0 6 3 6 8zm0 2c3-1 5-3.5 5-7-3.4 0-5 2.6-5 7z" fill="#fff" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>',
  ochre: '<path d="M3 18l6-9 3 4 3-6 6 11z" fill="#fff"/>',
  fluoro: '<path d="M13.5 2.5L6 13.2h5l-1.6 8.3L18 10.5h-5.2z" fill="#fff"/>',
};
/** Rundes Zeichen mit Farbe */
export function elementIcon(k: ElementId, px: number): string {
  const e = elementDef(k);
  return `<svg width="${px}" height="${px}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="${e.col}"/><g transform="translate(2.4 2.4) scale(.8)">${ICON[k]}</g></svg>`;
}
/** Abzeichen mit Namen */
export const elementBadge = (k: ElementId): string => `<span class="elb" style="--ec:${elementDef(k).col}">${elementIcon(k, 16)}${elementDef(k).name}</span>`;
/** Eine Zeile für die Karte: wen es schlägt und wer es schlägt */
export function elementText(k: ElementId): string {
  const p = elementPrey(k),
    f = elementFoes(k);
  const n = (x: ElementId) => elementDef(x).name;
  const e = elementDef(k);
  return `${e.beats} ${n(p.hard)} ×${ELEMENT_MULT.next}, ${e.little} ${n(p.little)} ×${ELEMENT_MULT.after}. Feared: ${n(f.hard)} ×${ELEMENT_MULT.next}, ${n(f.little)} ×${ELEMENT_MULT.after}.`;
}
/** Als Bild fürs Blatt, zwischengespeichert */
const imgs = new Map<ElementId, HTMLImageElement>();
export function elementImage(k: ElementId): HTMLImageElement {
  let i = imgs.get(k);
  if (!i) {
    i = new Image();
    i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(elementIcon(k, 48).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    imgs.set(k, i);
  }
  return i;
}
/** Der Ring als kleines Bild (für die Erklärkarte und die Hilfe) */
export function ringSvg(px: number, mark?: ElementId): string {
  const ks: ElementId[] = ['wash', 'vermilion', 'gilt', 'sap', 'ochre', 'fluoro'];
  const c = px / 2,
    r = px * 0.36,
    s = px * 0.2;
  const pos = ks.map((_, i) => {
    const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r] as const;
  });
  let out = `<svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" aria-hidden="true">`;
  ks.forEach((_, i) => {
    const [x0, y0] = pos[i]!,
      [x1, y1] = pos[(i + 1) % 6]!;
    out += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#1d2130" stroke-width="1.6" stroke-opacity=".55"/>`;
  });
  ks.forEach((k, i) => {
    const [x, y] = pos[i]!;
    out += `<g transform="translate(${x - s / 2} ${y - s / 2})">${elementIcon(k, s)}</g>`;
    if (k === mark) out += `<circle cx="${x}" cy="${y}" r="${s * 0.62}" fill="none" stroke="#c9961e" stroke-width="2"/>`;
  });
  return out + '</svg>';
}
