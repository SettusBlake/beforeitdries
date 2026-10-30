/*
 * „What do you see?“-Post (inline im Feed): das geteilte Monster groß, gemalt aus seinem Seed (kein Bild gespeichert),
 * darunter, wie die Benennung steht: läuft noch (Restzeit, Regeln), benannt, ohne Namen oder abgebrochen.
 */
import './lib/fonts';
import './name.css';
import type { NamingInfo } from '../shared/api';
import { PAPER } from '../shared/data';
import { NAME_MAX } from '../shared/day';
import { dieMonster, rarityDef, rarityOf, serialText, styleDef } from '../shared/dice';
import { speciesLabel } from '../shared/monster';
import { api } from './lib/api';
import { renderStyled } from './renderer/shiny';
import { renderMonster } from './renderer/watercolor';

const $ = (id: string) => document.getElementById(id)!;
let info: NamingInfo | null = null;
/** Abstand zwischen Server- und Geräteuhr */
let skew = 0;

function art(n: NamingInfo): void {
  const box = $('n-art');
  const m = dieMonster(n.die);
  const px = Math.round(Math.max(110, Math.min(box.clientWidth - 24, box.clientHeight - 16, 300)));
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  c.style.width = c.style.height = `${px}px`;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (m.style) {
    c.className = 'shiny';
    renderStyled(c, m, m.style, px, { dpr, deco: true, cutout: false });
  } else renderMonster(c, m, px, { dpr });
  box.replaceChildren(c);
}

function left(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(min / 60);
  return h ? `${h} h ${min % 60} min` : `${min} min`;
}

function show(): void {
  const n = info;
  if (!n) {
    $('n-title').textContent = 'A new blot';
    $('n-sub').textContent = 'This blot is still drying. Try again in a moment.';
    return;
  }
  const m = dieMonster(n.die);
  const r = rarityDef(rarityOf(m.paper));
  document.documentElement.style.setProperty('--c', r.col);
  const shiny = m.style ? ` · ✦ ${styleDef(m.style).label}` : '';
  $('n-meta').innerHTML = `Found by u/${n.user} · ${serialText(n.die.no)} · <b>${r.label}</b> · ${PAPER[m.paper].n}${shiny}`;
  const kind = speciesLabel(m);
  const title = $('n-title');
  title.classList.toggle('named', n.status === 'named');
  if (n.status === 'open') {
    $('n-eyebrow').textContent = 'What do you see?';
    title.textContent = 'Unnamed species';
    $('n-sub').textContent = `Comment a name below. After 24 hours the top comment with a valid name names this species for everyone: up to ${NAME_MAX} letters, three words at most, not taken yet.`;
    const ms = n.ends - (Date.now() + skew);
    $('n-time').textContent = ms > 0 ? `Naming closes in ${left(ms)}` : 'Counting the votes…';
    $('n-say').innerHTML = '“Tell me what you see. I will write it down.”<small>Master Sepia</small>';
  } else if (n.status === 'named') {
    $('n-eyebrow').textContent = 'The Bestiary records';
    title.textContent = n.name ?? 'Named';
    $('n-sub').textContent = `Named by u/${n.namedBy}, found by u/${n.user}. Every ${kind} is a ${n.name} now.`;
    $('n-time').textContent = '';
    $('n-say').innerHTML = '“Written down. It will not change.”<small>Master Sepia</small>';
  } else {
    $('n-eyebrow').textContent = 'What do you see?';
    title.textContent = 'Still nameless';
    $('n-sub').textContent = n.status === 'cancelled' ? 'The moderators closed this one. The species stays open for the next finder.' : `No name stuck this time. The next one to find a ${kind} may try again.`;
    $('n-time').textContent = '';
    $('n-say').innerHTML = '“Some blots keep their secrets a little longer.”<small>Master Sepia</small>';
  }
}

async function load(): Promise<void> {
  try {
    const r = await api.naming();
    skew = r.now - Date.now();
    const first = !info;
    info = r.naming;
    // Erst die Texte, dann das Bild: es nimmt den Platz, der übrig bleibt
    show();
    if (info && first) art(info);
    return;
  } catch {
    /* ohne Netz: Stand vom letzten Mal */
  }
  show();
}
void load();
// Restzeit mitzählen, Stand ab und zu neu holen (der Name kann inzwischen stehen)
let ticks = 0;
window.setInterval(() => {
  if (++ticks % 10 === 0) void load();
  else show();
}, 30000);
window.addEventListener('resize', () => {
  if (info) art(info);
});
(window as unknown as { done: boolean }).done = true;
