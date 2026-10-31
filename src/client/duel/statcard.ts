/*
 * Werte auf der Karte in Spielworten (Entwurf, docs/entwuerfe/karte-werte-vorschlag.md): je Wert eine Zeile mit Name, Zahl,
 * Balken (Anteil aller Kleckse, die weniger haben) und Wirkung, Antippen erklärt die Rechnung. Dazu Stufe und Farbe.
 * Im Spiel aus, bis der Vorschlag freigegeben ist (Schalter STATS2)
 */
import { CRESTS } from '../../shared/duel/rules';
import type { Unit } from '../../shared/duel/rules';
import { colourInfo, levelInfo, statRows, type StatKey } from '../../shared/duel/statinfo';

export const STATS2 = false;

const COL: Record<StatKey, string> = {
  sat: CRESTS.find((c) => c.k === 'splash')!.col,
  opa: '#3d5a80',
  grn: CRESTS.find((c) => c.k === 'guard')!.col,
  flo: CRESTS.find((c) => c.k === 'step')!.col,
  glw: CRESTS.find((c) => c.k === 'glow')!.col,
  lf: '#7a5c8a',
};

function el(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
const list = (a: string[]) => (a.length <= 1 ? (a[0] ?? '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

/** Block mit Stufe, sechs Werten und Farbe. live: im Duell mit dem, was gerade gilt */
export function statBlock(u: Unit, live: boolean): HTMLElement {
  const box = el('div', 'sinfo');
  const toggle = (b: HTMLElement) => () => {
    const open = !b.classList.contains('open');
    b.classList.toggle('open', open);
    b.setAttribute('aria-expanded', String(open));
  };
  const lv = levelInfo(u);
  const lb = el('button', 'slv');
  lb.setAttribute('type', 'button');
  lb.setAttribute('aria-expanded', 'false');
  lb.innerHTML = `<span><b>Level ${lv.lv}</b> · stat total <b>${lv.total}</b>${lv.next ? ` · Level ${lv.lv + 1} at ${lv.next}` : ' · top level'}</span><span class="shelp">${lv.help}</span>`;
  lb.addEventListener('click', toggle(lb));
  box.append(lb);
  for (const r of statRows(u, live)) {
    const b = el('button', 'srow');
    b.setAttribute('type', 'button');
    b.setAttribute('aria-expanded', 'false');
    b.style.setProperty('--c', COL[r.k]);
    const top = r.share >= 0.9 ? '<em>top 10%</em>' : '';
    const fx = r.parts.map(([w, n]) => (n ? `${w} <b>${n}</b>` : w)).join(' · ');
    b.innerHTML =
      `<span class="sk"><span>${r.label} <b>${r.v}</b>${top}</span><span class="sbar"><i style="width:${Math.round(r.share * 100)}%"></i></span></span>` +
      `<span class="st">${fx}</span><span class="shelp">${r.help}</span>`;
    b.addEventListener('click', toggle(b));
    box.append(b);
  }
  const c = colourInfo(u);
  const fam = c.fam[0]!.toUpperCase() + c.fam.slice(1);
  const col = el('p', 'scol');
  col.innerHTML =
    `<b>Colour</b> ${c.name}, ${c.fam}. ` +
    (c.strong.length ? `Against ${list(c.strong)} hits count ×1.5 both ways and stain. ` : '') +
    `Against ${list([...c.weak, 'its own colour'])} ×0.75.`;
  const set = el('p', 'scol');
  set.innerHTML = `<b>${fam} set</b> 2 on the sheet: ${c.set[0].toLowerCase()} · 3: ${c.set[1].toLowerCase()}`;
  box.append(col, set);
  return box;
}
