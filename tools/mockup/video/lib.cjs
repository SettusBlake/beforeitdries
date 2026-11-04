// Gemeinsame Helfer für die QA-Läufe (Port 5180)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PORT = process.env.QPORT || '5180';
const BASE = 'http://localhost:' + PORT;
const DIR = __dirname;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = {
  s360: { width: 360, height: 640, mobile: true },
  s390: { width: 390, height: 760, mobile: true },
  s412: { width: 412, height: 915, mobile: true },
  desk: { width: 1280, height: 800, mobile: false },
};
const LESSONS_SEEN = 'welcome,bag,net,rival,roll,deck,keep,wet,crests,glaze,summon,drag,palette,stamp,splash,elem,mult,brim,react,eraser,mud';

async function open(browser, size, opts = {}) {
  const sz = typeof size === 'string' ? SIZES[size] : size;
  const ctx = await browser.newContext({
    viewport: { width: sz.width, height: sz.height },
    deviceScaleFactor: opts.dpr ?? (sz.mobile ? 2 : 1),
    isMobile: !!sz.mobile,
    hasTouch: !!sz.mobile,
  });
  const p = await ctx.newPage();
  const log = { errors: [], warnings: [], api: [], failed: [] };
  p.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message + (e.stack ? ' @ ' + e.stack.split('\n').slice(1, 3).join(' | ') : '')));
  p.on('console', (m) => {
    if (m.type() === 'error') log.errors.push('console.error: ' + m.text());
    else if (m.type() === 'warning') log.warnings.push('console.warn: ' + m.text());
  });
  p.on('requestfailed', (r) => log.failed.push(r.method() + ' ' + r.url() + ' ' + (r.failure()?.errorText ?? '')));
  p.on('response', async (r) => {
    if (r.status() >= 400) {
      let body = '';
      try {
        body = (await r.text()).slice(0, 300);
      } catch {}
      let req = '';
      try {
        req = (r.request().postData() ?? '').slice(0, 200);
      } catch {}
      log.api.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')} req=${req} body=${body}`);
    }
  });
  if (opts.seen) {
    await p.addInitScript((v) => {
      try {
        localStorage.setItem('bid-duel-lessons', v);
        localStorage.setItem('bid-duel-learned', '1');
        localStorage.setItem('bid-bleach-intro', '1');
      } catch {}
    }, LESSONS_SEEN);
  }
  return { ctx, p, log };
}
async function load(p, page = 'duel.html') {
  await p.goto(BASE + '/' + page);
  if (page === 'duel.html') await p.waitForFunction(() => window.done === true, null, { timeout: 30000 });
  await wait(1200);
}
const st = (p) => p.evaluate(() => window.__duel.state());
async function overflow(p) {
  return p.evaluate(() => {
    const se = document.scrollingElement || document.documentElement;
    return { sw: se.scrollWidth, iw: innerWidth, sh: se.scrollHeight, ih: innerHeight, h: se.scrollWidth > innerWidth, v: se.scrollHeight > innerHeight };
  });
}
/** Sichtbare Elemente, die rechts oder links über den Bildschirm hinausragen */
async function clipped(p, root = 'body') {
  return p.evaluate((root) => {
    const out = [];
    const W = innerWidth;
    for (const e of document.querySelectorAll(root + ' *')) {
      if (!(e instanceof HTMLElement)) continue;
      if (e.closest('[hidden]')) continue;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > W + 1 || r.left < -1) {
        // nur wenn kein Vorfahr mit overflow hidden/auto das abschneidet
        let a = e.parentElement, cut = false;
        while (a && a !== document.body) {
          const s = getComputedStyle(a);
          if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) { const ar = a.getBoundingClientRect(); if (ar.right <= W + 1 && ar.left >= -1) { cut = true; break; } }
          a = a.parentElement;
        }
        if (!cut) out.push(`${e.tagName.toLowerCase()}#${e.id}.${[...e.classList].join('.')} [${Math.round(r.left)}..${Math.round(r.right)}] "${(e.textContent || '').trim().slice(0, 30)}"`);
      }
    }
    return out.slice(0, 15);
  }, root);
}
/** Wartet, bis das Duell nicht mehr beschäftigt ist; meldet, wenn busy länger als ms anhält */
async function idle(p, ms = 10000, note) {
  const t0 = Date.now();
  for (;;) {
    const s = await st(p).catch(() => null);
    if (s && !s.busy) return true;
    if (Date.now() - t0 > ms) {
      note && note(`busy longer than ${ms} ms (phase ${s?.phase}, turn ${s?.turn}, round ${s?.round})`);
      return false;
    }
    await wait(150);
  }
}
async function cellCenter(p, i) {
  const bb = await p.locator('#board').boundingBox();
  const g = await p.evaluate(() => window.__duel.geo());
  return [bb.x + ((i % 6) + 0.5) * g.cell, bb.y + g.padTop + (Math.floor(i / 6) + 0.5) * g.cell];
}
async function drag(p, from, to, touch) {
  const [x0, y0] = await cellCenter(p, from), [x1, y1] = await cellCenter(p, to);
  await p.mouse.move(x0, y0);
  await p.mouse.down();
  await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 });
  await p.mouse.move(x1, y1, { steps: 6 });
  await p.mouse.up();
}
async function tapCell(p, i) {
  const [x, y] = await cellCenter(p, i);
  await p.mouse.click(x, y);
}
/** Duell per „Sepia paints“ zu Ende; stuck-Erkennung */
async function playGo(p, note, maxMs = 400000) {
  const t0 = Date.now();
  let lastSig = '', sameSince = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await p.isVisible('#result')) return 'result';
    if (await p.isVisible('#tip')) { await p.click('#tip-ok').catch(() => {}); continue; }
    const s = await st(p);
    if (s.over) { await p.waitForSelector('#result:not([hidden])', { timeout: 15000 }).catch(() => note('over but no result after 15 s')); return 'over'; }
    const sig = JSON.stringify([s.phase, s.turn, s.round, s.busy, s.units.map((u) => [u.x, u.y, u.hp, u.acted])]);
    if (sig !== lastSig) { lastSig = sig; sameSince = Date.now(); }
    else if (Date.now() - sameSince > 20000) { note('no progress 20 s: ' + sig.slice(0, 200)); return 'stuck'; }
    if (s.phase === 'medium' && s.turn === 1 && !s.busy) {
      await p.locator('#ctx .mcard').first().click().catch(() => {});
      await wait(300);
      continue;
    }
    if (!s.busy && (await p.locator('#go').isEnabled().catch(() => false))) await p.click('#go').catch(() => {});
    await wait(250);
  }
  note('playGo timeout');
  return 'timeout';
}
async function shot(p, name) {
  const f = path.join(DIR, 'shots', name + '.png');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  await p.screenshot({ path: f }).catch(() => {});
  return f;
}
async function reset() {
  // Eigenen Vorschau-Server neu starten (frischer Spieler)
  const { execSync } = require('child_process');
  execSync(`bash ${DIR}/restart.sh ${PORT}`, { stdio: "inherit" });
}
async function jget(u) {
  const r = await fetch(BASE + u);
  return r.json().catch(() => ({}));
}
module.exports = { chromium, BASE, DIR, wait, SIZES, open, load, st, overflow, clipped, idle, cellCenter, drag, tapCell, playGo, shot, reset, jget, LESSONS_SEEN };
