/*
 * Entwurfsbogen „Malerrang“ (H2, nur für docs/entwuerfe, docs/entwuerfe/fesseln-vorschlag.md Fassung 2).
 * Nimmt die echte Vorschau (dist/preview-server.mjs auf Port 5181) und setzt die geplanten Teile als Attrappe ein:
 * Rang im Startbild, Erfahrung im Ergebnis eines Duells, neuer Titel mit Sepia, Übersicht der Ränge. Nichts davon ist im Spiel.
 * Aufruf: node tools/mockup/rang-entwurf.cjs <Ausgabeordner>
 */
const { chromium } = require('playwright');
const path = require('path');

const OUT = process.argv[2] || '.';
const B = 'http://localhost:5181';
const H = { 'content-type': 'application/json', 'x-bid-proto': '22' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CSS = `
  .rank { width: 100%; max-width: 330px; display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; align-items: center; text-align: left; border: 1px solid var(--line); background: var(--sheet); border-radius: 14px; padding: 8px 12px 9px 8px; margin: -2px 0 2px; font: inherit; color: var(--ink); }
  .rk-n { grid-row: span 2; width: 40px; height: 40px; display: grid; place-items: center; font: 400 1.25rem/1 var(--f-display); color: #fffaf0; background: radial-gradient(circle at 38% 32%, #4a5bc4, #2b3fa3 60%, #1d2a78); border-radius: 46% 54% 50% 50% / 52% 46% 54% 48%; box-shadow: 0 0 0 2px #fbfaf6, 0 0 0 3.5px #c9961e; }
  .rk-t { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; min-width: 0; }
  .rk-t b { font: 700 14px var(--f-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rk-t small { font: 10.5px var(--f-mono); color: var(--muted); white-space: nowrap; }
  .rk-bar { position: relative; height: 7px; border-radius: 4px; background: var(--track); overflow: hidden; }
  .rk-bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: #c9961e; }
  .rk-bar i.gain { background: repeating-linear-gradient(135deg, #e7be4f 0 5px, #f4d77e 5px 10px); box-shadow: 0 0 8px rgba(201,150,30,.7); }
  .xp-r { margin: 10px auto 0; max-width: 300px; display: grid; gap: 4px; text-align: left; }
  .xp-h { display: flex; justify-content: space-between; align-items: baseline; font: 12px var(--f-mono); color: var(--muted); }
  .xp-h b { font: 800 14px var(--f-body); color: #8a6410; }
  .xp-r small { font: 11px var(--f-mono); color: var(--muted); }
  .xp-r small b { color: var(--ink); }
  .rkcard .big { background: radial-gradient(circle at 50% 40%, #fff8e6, #f3e3b3) !important; }
  .rkcard .big span { width: 64px; height: 64px; display: grid; place-items: center; font: 400 2rem/1 var(--f-display); color: #fffaf0; background: radial-gradient(circle at 38% 32%, #4a5bc4, #2b3fa3 60%, #1d2a78); border-radius: 46% 54% 50% 50% / 52% 46% 54% 48%; box-shadow: 0 0 0 3px #fbfaf6, 0 0 0 5px #c9961e; }
  .rkcard .gets { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .rkcard .gets span { font: 700 12px var(--f-mono); border: 1px solid #d9c38a; background: #fff8e6; color: #6b4e0c; border-radius: 999px; padding: 4px 10px; }
  .rklist { position: fixed; inset: 0; z-index: 150; background: rgba(20,16,24,.6); display: grid; place-items: center; padding: 16px; }
  .rklist .sheet { width: min(360px, 100%); max-height: 92vh; overflow: auto; background: var(--sheet); border-radius: 18px; padding: 14px 14px 10px; }
  .rklist h2 { margin: 0; font: 400 1.4rem var(--f-display); }
  .rklist .sub { margin: 2px 0 8px; font: 11px var(--f-mono); color: var(--muted); }
  .rkrow { display: grid; grid-template-columns: 34px 1fr auto; gap: 8px; align-items: center; padding: 6px 4px; border-top: 1px dashed var(--line); font: 13px var(--f-body); }
  .rkrow .no { font: 700 12px var(--f-mono); color: var(--muted); text-align: right; }
  .rkrow b { font-weight: 700; }
  .rkrow small { font: 11px var(--f-mono); color: #6b4e0c; text-align: right; }
  .rkrow.done { opacity: .55; }
  .rkrow.now { background: #fff6dc; border-radius: 8px; border-top-color: transparent; box-shadow: inset 0 0 0 1.5px #c9961e; }
  .rkrow.now .no { color: #8a6410; }
`;

const strip = (n, title, have, need) =>
  `<button type="button" class="rank" id="mk-rank"><span class="rk-n">${n}</span><span class="rk-t"><b>${title}</b><small>${have} / ${need} XP</small></span><span class="rk-bar"><i style="width:${Math.round((have / need) * 100)}%"></i></span></button>`;

const RANKS = [
  [1, 'Brush washer', 'start'],
  [5, 'Water carrier', 'blank canvas'],
  [10, 'Paper stretcher', 'Loaded dip'],
  [15, 'Colour grinder', '5 drops'],
  [20, 'Wash layer', 'Loaded dip'],
  [25, 'Glazer', 'Dripping dip'],
  [30, 'Edge keeper', '2 blank canvases'],
  [35, 'Sheet mender', 'Dripping dip'],
  [40, 'Master of washes', '5 drops · Loaded dip'],
  [45, 'Sepia’s second', 'Dripping dip'],
  [50, 'Keeper of the Sheet', 'Dripping dip · gold badge'],
];

async function inject(page, html, where, mode = 'beforebegin') {
  await page.evaluate(
    ({ css, html, where, mode }) => {
      if (!document.getElementById('mk-css')) {
        const st = document.createElement('style');
        st.id = 'mk-css';
        st.textContent = css;
        document.head.append(st);
      }
      document.querySelector(where).insertAdjacentHTML(mode, html);
    },
    { css: CSS, html, where, mode },
  );
  await wait(300);
}

(async () => {
  // Spielstand: Lektion fertig, Startzüge gezogen, dann ein Duell bis zum Ende
  await fetch(`${B}/dev/stage`);
  await fetch(`${B}/api/dice/pull`, { method: 'POST', headers: H, body: JSON.stringify({ kind: 'starter' }) });
  await fetch(`${B}/api/duel/start`, { method: 'POST', headers: H, body: JSON.stringify({ level: 'apprentice' }) });
  await (await fetch(`${B}/dev/finish`)).json();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(`${B}/duel.html`);
  await wait(2500);
  // 1 Startbild: Rang unter Sepias Satz
  await inject(page, strip(7, 'Brush washer · next title at 5', 120, 180), '#title .seg');
  await page.evaluate(() => document.querySelector('#mk-rank .rk-t b').replaceChildren('Rank 7 · Water carrier'));
  await page.evaluate(() => (document.getElementById('title').scrollTop = 0));
  await page.screenshot({ path: path.join(OUT, 'rk-1-start.png') });
  // 2 Ergebnis eines Duells: Erfahrung füllt den Balken
  await page.evaluate(() => (document.getElementById('continue').hidden = false));
  await page.click('#continue');
  await wait(3500);
  await inject(
    page,
    `<div class="xp-r"><div class="xp-h"><b>+30 XP</b><span>Rank 7 · Water carrier</span></div><div class="rk-bar"><i style="width:83%"></i><i class="gain" style="left:66%;width:17%"></i></div><small>Rank 8 in <b>30 XP</b>, about one more duel</small></div>`,
    '#result-reward',
    'beforeend',
  );
  await page.screenshot({ path: path.join(OUT, 'rk-2-result.png') });
  // 3 Neuer Titel: Rang 10 mit Sepia und Lohn
  await inject(
    page,
    `<div class="giftov" id="mk-ov"><div class="giftcard rkcard"><p class="eyebrow">Rank up · a new title</p><div class="big"><span>10</span></div><h2>Paper stretcher</h2><div class="gets"><span>+40 pigment</span><span>Loaded dip</span></div><p class="hand">You stretch the paper before you paint. Most never do.</p><span class="who">MASTER SEPIA</span><span class="next">Next title at rank 15: Colour grinder</span><button type="button">Take it</button></div></div>`,
    'body',
    'beforeend',
  );
  await page.screenshot({ path: path.join(OUT, 'rk-3-up.png') });
  await page.evaluate(() => document.getElementById('mk-ov').remove());
  // 4 Übersicht nach Tipp auf den Rang
  const rows = RANKS.map(
    ([n, t, g]) => `<div class="rkrow${n < 10 ? ' done' : n === 10 ? ' now' : ''}"><span class="no">${n}</span><b>${t}</b><small>${g}</small></div>`,
  ).join('');
  await inject(
    page,
    `<div class="rklist" id="mk-list"><div class="sheet"><div class="modhead"><h2>Painter’s rank</h2><button type="button" class="ghost">✕</button></div><p class="sub">Every rank: pigment. Every fifth: a new title and a gift.<br>Duel 20 XP, win 30 · daily sheet 30 · dip 5 · weekly goal 50</p>${rows}</div></div>`,
    'body',
    'beforeend',
  );
  await page.screenshot({ path: path.join(OUT, 'rk-4-list.png') });
  await browser.close();
})();
