/*
 * Selbst malen (Blank canvas): Striche mit dem Finger auf ein Blatt. Geschlossene Striche werden Farbflächen,
 * offene bleiben Linien, Mirror spiegelt an der Mitte (Rorschach). Gewürfelt wird erst am Server nach „Paint it“.
 */
import type { Pt } from '../../shared/data';
import { decodeDrawing, DRAW, encodeDrawing, parts, simplify, type Drawing } from '../../shared/drawn';
import { sfx } from './sound';

const $ = (id: string) => document.getElementById(id)!;
/** paint: true, wenn gemalt, sonst der Grund */
type Hooks = { paint: (code: string) => Promise<true | string>; back: () => void };
let hooks: Hooks = { paint: async () => 'Not ready yet.', back: () => undefined };

/* Die Zeichnung bleibt, bis sie gemalt ist: zurück und wieder hinein zeichnet weiter */
const d: Drawing = { strokes: [], mirror: true, face: null };
let cur: Pt[] | null = null;
let eyes = false;
let busy = false;
let px = 300;
/** Blatt mit allen fertigen Strichen und Augen, nur neu gemalt, wenn sich etwas ändert. Pro Bild kommt nur der laufende Strich dazu */
let base: HTMLCanvasElement | null = null;
/** Lage des Blatts, gemessen beim Aufsetzen des Fingers (Messen bei jedem Schritt bremst das Handy aus) */
let rect: DOMRect | null = null;
/** Neu zeichnen höchstens einmal pro Bild */
let frame = 0;
/** So viele Punkte nimmt ein Strich höchstens auf, vereinfacht wird er ohnehin */
const MAX_PTS = 600;
const changed = () => {
  base = null;
  why(null);
};
/** Grund direkt über dem Knopf, warum nichts gemalt wurde (Sepias Satz oben übersieht man leicht) */
function why(t: string | null): void {
  const w = $('draw-why');
  w.hidden = !t;
  w.textContent = t ?? '';
}

const SAY = ['Draw whatever you like. The dice decide what it is good for.', 'A blank canvas. The paint has opinions, but it listens.', 'Draw me something. I have seen worse. Probably.'];
let greet = SAY[0]!;
function say(t: string): void {
  $('draw-say').textContent = t;
}

/* ---------- Blatt ---------- */
function size(): void {
  const wrap = $('padwrap');
  px = Math.max(160, Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight)));
  const c = $('pad') as HTMLCanvasElement;
  const k = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(px * k);
  c.style.width = c.style.height = px + 'px';
  rect = null;
  changed();
  redraw();
}
/** Beim nächsten Bild neu zeichnen, mehrere Fingerschritte dazwischen zählen einmal */
function later(): void {
  if (!frame) frame = requestAnimationFrame(() => {
    frame = 0;
    redraw(false);
  });
}
function line(x: CanvasRenderingContext2D, pts: Pt[], close = false): void {
  x.beginPath();
  pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
  if (close) x.closePath();
}
/** Blatt mit den Strichen einer Zeichnung (size: Breite in CSS-Pixeln, für die Strichstärke) */
function paintBase(w: number, h: number, dr: Drawing, size: number): HTMLCanvasElement {
  const b = document.createElement('canvas');
  b.width = w;
  b.height = h;
  const x = b.getContext('2d')!;
  x.setTransform(w, 0, 0, h, 0, 0);
  x.fillStyle = '#fbfaf6';
  x.fillRect(0, 0, 1, 1);
  const u = 1 / size;
  if (dr.mirror) {
    x.strokeStyle = 'rgba(43,63,163,.35)';
    x.lineWidth = 1.2 * u;
    x.setLineDash([5 * u, 5 * u]);
    line(x, [
      [0.5, 0.02],
      [0.5, 0.98],
    ]);
    x.stroke();
    x.setLineDash([]);
  }
  x.lineCap = x.lineJoin = 'round';
  x.lineWidth = 3 * u;
  const ps = parts(dr);
  for (const p of ps) {
    line(x, p.pts, p.closed);
    // Geschlossen heißt: wird Farbfläche. Gut sichtbar gefüllt, damit man sieht, was zählt
    if (p.closed) {
      x.fillStyle = 'rgba(43,63,163,.16)';
      x.fill();
    }
    x.strokeStyle = 'rgba(40,40,46,.85)';
    x.stroke();
  }
  if (dr.face) {
    const [fx, fy] = dr.face;
    x.strokeStyle = '#c9961e';
    x.lineWidth = 2.5 * u;
    x.beginPath();
    x.arc(fx, fy, 0.05, 0, 7);
    x.stroke();
    x.fillStyle = '#1d2130';
    for (const s of [-1, 1]) {
      x.beginPath();
      x.arc(fx + s * 0.018, fy, 0.009, 0, 7);
      x.fill();
    }
  }
  return b;
}
function redraw(withUi = true): void {
  if (frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  const c = $('pad') as HTMLCanvasElement;
  const x = c.getContext('2d')!;
  base ??= paintBase(c.width, c.height, d, px);
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.drawImage(base, 0, 0);
  // Der Strich, der gerade entsteht (gespiegelt heller)
  if (cur && cur.length > 1) {
    x.setTransform(c.width, 0, 0, c.height, 0, 0);
    x.lineCap = x.lineJoin = 'round';
    x.lineWidth = 3 / px;
    x.strokeStyle = 'rgba(40,40,46,.85)';
    line(x, cur);
    x.stroke();
    if (d.mirror) {
      x.strokeStyle = 'rgba(40,40,46,.4)';
      line(
        x,
        cur.map((p): Pt => [1 - p[0], p[1]]),
      );
      x.stroke();
    }
  }
  if (withUi) ui();
}
/** Eine gespeicherte Zeichnung als schlichte Striche, so wie sie gemalt wurde (Prüfliste der Mods) */
export function sketch(code: string, size: number): HTMLCanvasElement | null {
  const dr = decodeDrawing(code);
  if (!dr) return null;
  const k = Math.min(2, window.devicePixelRatio || 1);
  const c = paintBase(Math.round(size * k), Math.round(size * k), dr, size);
  c.style.width = c.style.height = size + 'px';
  return c;
}
function ui(): void {
  $('t-mirror').setAttribute('aria-pressed', String(d.mirror));
  $('t-eyes').setAttribute('aria-pressed', String(eyes));
  ($('t-undo') as HTMLButtonElement).disabled = busy || (!d.strokes.length && !d.face);
  ($('t-clear') as HTMLButtonElement).disabled = busy || (!d.strokes.length && !d.face);
  const go = $('draw-go') as HTMLButtonElement;
  go.disabled = busy || !d.strokes.length;
  go.textContent = busy ? 'Painting…' : 'Paint it';
}

/* ---------- Finger ---------- */
function at(e: PointerEvent): Pt {
  rect ??= $('pad').getBoundingClientRect();
  const r = rect;
  return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
}
function down(e: PointerEvent): void {
  if (busy || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();
  // Kam das Ende des letzten Strichs nie an: jetzt ablegen statt verlieren
  if (cur) up();
  rect = $('pad').getBoundingClientRect();
  if (eyes) {
    d.face = at(e);
    eyes = false;
    changed();
    say('The eyes go there. It will look back at you.');
    sfx.tap();
    return redraw();
  }
  if (d.strokes.length >= DRAW.maxStrokes) {
    say('That is plenty. Paint it, or undo something.');
    return;
  }
  ($('pad') as HTMLCanvasElement).setPointerCapture(e.pointerId);
  cur = [at(e)];
}
function move(e: PointerEvent): void {
  if (!cur) return;
  e.preventDefault();
  // Manche Browser liefern eine leere Liste: dann zählt das Ereignis selbst
  const evs = e.getCoalescedEvents?.() ?? [];
  for (const ev of evs.length ? evs : [e]) {
    if (cur.length >= MAX_PTS) break;
    const p = at(ev),
      q = cur[cur.length - 1]!;
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.004) cur.push(p);
  }
  later();
}
function up(): void {
  if (!cur) return;
  const s = cur;
  cur = null;
  // Ein Tupfer ohne Strich zählt nicht
  if (s.length >= 2) {
    // Gleich vereinfacht ablegen (dieselbe Vereinfachung wie beim Speichern), dann rechnet jeder weitere Schritt mit wenigen Punkten
    d.strokes.push(simplify(s));
    changed();
  }
  redraw();
}

/* ---------- Knöpfe ---------- */
async function paint(): Promise<void> {
  if (busy) return;
  if (!d.strokes.length) return nope('Draw something first.');
  busy = true;
  why(null);
  ui();
  const res = await hooks.paint(encodeDrawing(d));
  busy = false;
  if (res === true) {
    d.strokes = [];
    d.face = null;
    d.mirror = true;
    eyes = false;
    changed();
  } else nope(res);
  redraw();
}
/** Nicht gemalt: Grund über dem Knopf, der Knopf schüttelt sich */
function nope(t: string): void {
  why(t);
  sfx.tap();
  const go = $('draw-go');
  go.classList.remove('nope');
  void go.offsetWidth;
  go.classList.add('nope');
}

export function initDraw(h: Hooks): void {
  hooks = h;
  const pad = $('pad');
  pad.addEventListener('pointerdown', down);
  pad.addEventListener('pointermove', move);
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointercancel', up);
  pad.addEventListener('lostpointercapture', up);
  $('draw-back').addEventListener('click', () => {
    sfx.tap();
    hooks.back();
  });
  $('t-mirror').addEventListener('click', () => {
    d.mirror = !d.mirror;
    changed();
    sfx.tap();
    redraw();
  });
  $('t-eyes').addEventListener('click', () => {
    eyes = !eyes;
    say(eyes ? 'Tap where the face should go.' : greet);
    sfx.tap();
    ui();
  });
  $('t-undo').addEventListener('click', () => {
    if (d.strokes.length) d.strokes.pop();
    else d.face = null;
    changed();
    sfx.tap();
    redraw();
  });
  $('t-clear').addEventListener('click', () => {
    d.strokes = [];
    d.face = null;
    changed();
    sfx.tap();
    redraw();
  });
  $('draw-go').addEventListener('click', () => void paint());
  window.addEventListener('resize', () => {
    if (!$('draw').hidden) size();
  });
}
/** Blatt zeigen. left: so viele leere Würfel liegen bereit */
export function openDraw(left: number): void {
  $('draw-left').textContent = `${left} left`;
  eyes = false;
  greet = SAY[Math.floor(Math.random() * SAY.length)]!;
  say(greet);
  $('draw').hidden = false;
  size();
}
