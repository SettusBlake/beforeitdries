/*
 * Entwurfsbogen „Tägliche Aktivität Fassung 3“ (nur für docs/entwuerfe, docs/entwuerfe/taegliche-aktivitaet-vorschlag.md).
 * Nimmt die echte Vorschau (dist/preview-server.mjs auf Port 5181) und setzt die geplanten Teile als Attrappe ein:
 * Tagesgeschenk mit 7 Töpfen und Morgen-Zeile im Startbild, Geschenk öffnen, Tagespost am Sonntag mit Tagesregel,
 * Willkommen zurück und Wochenziele in „Your dice“. Nichts davon ist im Spiel.
 * Aufruf: node tools/mockup/geschenk-entwurf.cjs <Ausgabeordner>
 */
const { chromium } = require('playwright');
const path = require('path');

const OUT = process.argv[2] || '.';
const B = 'http://localhost:5181';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const drop = (c, s = 18) => `<svg viewBox="0 0 20 24" width="${s}" height="${s * 1.2}" aria-hidden="true"><path d="M10 1.5C10 1.5 2.5 10.2 2.5 15a7.5 7.5 0 0 0 15 0C17.5 10.2 10 1.5 10 1.5z" fill="${c}" stroke="#1d2130" stroke-opacity=".35"/><path d="M6.5 15.5a3.6 3.6 0 0 0 2.6 3.3" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".8"/></svg>`;
const pig = (s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="M5 9c0-3 3-5.5 7-5.5S19 6 19 9v6.5c0 2.6-3.1 4.5-7 4.5s-7-1.9-7-4.5z" fill="#fffdf8" stroke="#3a3330" stroke-width="1.2"/><path d="M5.4 12.2c2.2 1.6 10.9 1.6 13.2 0v3.3c0 2.2-2.9 3.7-6.6 3.7s-6.6-1.5-6.6-3.7z" fill="#b01e3e"/><ellipse cx="12" cy="8.6" rx="5.6" ry="2.2" fill="none" stroke="#3a3330" stroke-width="1"/></svg>`;
const brush = (s = 26) => `<svg viewBox="0 0 32 32" width="${s}" height="${s}" aria-hidden="true"><path d="M21 3.5l7.5 7.5-11 11-7.5-7.5z" fill="#8a6410"/><path d="M10 14.5l7.5 7.5-3 3c-2 2-6.5 3.5-10.5 3.5 0-4 1.5-8.5 3.5-10.5z" fill="#3a7ca5"/><path d="M21 3.5l2-2 7.5 7.5-2 2z" fill="#c9961e"/></svg>`;
const check = `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="#2c7a4b" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ULTRA = '#2b3fa3';

const CSS = `
  .gift { width: 100%; max-width: 330px; border: 1px solid var(--line); background: var(--sheet); border-radius: 14px; padding: 8px 10px 9px; display: grid; gap: 7px; text-align: left; margin-top: -4px; }
  .gift-h { display: flex; justify-content: space-between; align-items: baseline; }
  .gift-h b { font: 700 11px var(--f-mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ink); }
  .gift-h small { font: 10.5px var(--f-mono); color: var(--muted); }
  .gift-row { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)) minmax(0, 1.45fr); gap: 4px; align-items: end; }
  .gj { display: grid; justify-items: center; gap: 3px; font: 600 9.5px var(--f-mono); color: var(--muted); }
  .gj .pot { position: relative; width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--line); background: #fff; display: grid; place-items: center; }
  .gj.done .pot { background: #efeadf; }
  .gj.done .pot > svg:first-child { opacity: .35; }
  .gj.done .pot .ck { position: absolute; right: -4px; bottom: -4px; width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 1px solid #b9d8c4; display: grid; place-items: center; }
  .gj.today .pot { border: 2px solid #c9961e; box-shadow: 0 0 0 4px rgba(201,150,30,.22), 0 6px 14px -6px rgba(150,100,10,.6); background: #fff8e6; }
  .gj.today { color: #8a6410; }
  .gj.big .pot { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(140deg, #fff3c4, #f3d77a 55%, #e6b84a); border-color: #b88a1c; }
  .gift-tap { justify-self: center; border: 0; background: var(--ink); color: var(--sheet); font: 800 14px var(--f-body); border-radius: 10px; padding: 8px 14px; width: 100%; }
  .gift-tap small { display: block; font: 500 10.5px var(--f-mono); opacity: .8; }
  .tmrw { margin: -4px 0 0; font: 11px/1.35 var(--f-mono); color: var(--muted); max-width: 330px; text-align: center; }
  .tmrw b { color: var(--ink); }
  .giftov { position: fixed; inset: 0; z-index: 90; background: rgba(20,16,24,.55); display: grid; place-items: center; padding: 16px; }
  .giftcard { width: min(330px, 100%); background: var(--sheet); border-radius: 18px; padding: 18px 18px 16px; display: grid; justify-items: center; gap: 8px; text-align: center; box-shadow: 0 24px 60px -18px rgba(0,0,0,.7); border: 2px solid #c9961e; }
  .giftcard .eyebrow { margin: 0; }
  .giftcard .big { width: 92px; height: 92px; border-radius: 22px; background: radial-gradient(circle at 50% 40%, #fff, #f1ede2); display: grid; place-items: center; box-shadow: inset 0 0 0 1px var(--line); }
  .giftcard h2 { margin: 2px 0 0; font: 400 1.5rem/1.1 var(--f-display); }
  .giftcard .hand { margin: 0; font: 1.35rem/1.15 var(--f-hand); color: var(--sepia, #6e4b33); }
  .giftcard .who { font: 600 10px var(--f-mono); letter-spacing: .14em; color: var(--muted); margin-top: -4px; }
  .giftcard .next { font: 11px var(--f-mono); color: var(--muted); }
  .giftcard button { border: 0; background: var(--ink); color: var(--sheet); font: 800 16px var(--f-body); border-radius: 12px; padding: 11px 18px; width: 100%; }
  .mk-note { display: grid; gap: 6px; } .mk-note .tool { position: static !important; justify-self: start; margin: 0 !important; transform: none !important; } .mk-note .hand { padding-right: 0 !important; }
  .goals .gl { display: grid; grid-template-columns: 1fr auto; gap: 3px 10px; align-items: center; padding: 6px 0; border-top: 1px dashed var(--line); }
  .goals .gl:first-of-type { border-top: 0; }
  .goals .gl b { font: 600 13.5px var(--f-body); }
  .goals .gl span { font: 700 12px var(--f-mono); color: var(--muted); }
  .goals .gl.ok span { color: #2c7a4b; }
  .goals .bar { grid-column: 1 / -1; height: 6px; border-radius: 3px; background: var(--track); overflow: hidden; }
  .goals .bar i { display: block; height: 100%; background: #c9961e; border-radius: 3px; }
  .goals .gl.ok .bar i { background: #2c7a4b; }
  .goals .all { margin: 6px 0 0; font: 12px var(--f-mono); color: #8a6410; }
`;

const giftRow = (todayDone) => {
  const items = [
    ['20', pig(18)], ['drop', drop('#b01e3e', 15)], ['30', pig(18)], ['drop', drop(ULTRA, 15)], ['40', pig(18)], ['drop', drop('#f0ac0c', 15)], ['Loaded dip', brush(28)],
  ];
  const today = 3;
  return `<div class="gift" id="mk-gift"><div class="gift-h"><b>Today’s gift</b><small>day ${today + 1} of 7 · no reset</small></div><div class="gift-row">${items
    .map(([l, ic], i) => {
      const cls = 'gj' + (i < today || (todayDone && i === today) ? ' done' : '') + (i === today && !todayDone ? ' today' : '') + (i === 6 ? ' big' : '');
      return `<div class="${cls}"><span class="pot">${ic}${i < today || (todayDone && i === today) ? `<span class="ck">${check}</span>` : ''}</span>${l}</div>`;
    })
    .join('')}</div>${todayDone ? '' : '<button class="gift-tap" type="button">Open today’s gift<small>a drop of Ultramarine</small></button>'}</div>`;
};
const tomorrow = (done) =>
  `<p class="tmrw" id="mk-tmrw">${done ? '<b>Tomorrow:</b> gift 40 pigment · free dip · Monday sheet, light wash' : '<b>Today:</b> gift · free dip · Sunday sheet, points ×1.5'}</p>`;

async function title(page, done) {
  await page.evaluate(
    ({ css, row, tm }) => {
      if (!document.getElementById('mk-css')) {
        const st = document.createElement('style');
        st.id = 'mk-css';
        st.textContent = css;
        document.head.append(st);
      }
      document.getElementById('mk-gift')?.remove();
      document.getElementById('mk-tmrw')?.remove();
      const drow = document.querySelector('#title .drow');
      drow.insertAdjacentHTML('beforebegin', row + tm);
      document.getElementById('gal-note').hidden = true;
      document.getElementById('title').scrollTop = 9999;
    },
    { css: CSS, row: giftRow(done), tm: tomorrow(done) },
  );
  await wait(400);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await fetch(`${B}/dev/stage`);
  await page.goto(`${B}/duel.html`);
  await wait(2500);
  // 1 Startbild mit Tagesgeschenk und Morgen-Zeile
  await title(page, false);
  await page.screenshot({ path: path.join(OUT, 'g3-1-start.png') });
  // 2 Geschenk öffnen
  await page.evaluate(
    ({ dropBig }) => {
      document.body.insertAdjacentHTML(
        'beforeend',
        `<div class="giftov" id="mk-ov"><div class="giftcard"><p class="eyebrow">Today’s gift · day 4 of 7</p><div class="big">${dropBig}</div><h2>A drop of Ultramarine</h2><p class="hand">You came back. The paint noticed.</p><span class="who">MASTER SEPIA</span><span class="next">Day 7: a free dip with the Loaded brush</span><button type="button">Take it</button></div></div>`,
      );
    },
    { dropBig: drop(ULTRA, 46) },
  );
  await wait(300);
  await page.screenshot({ path: path.join(OUT, 'g3-2-open.png') });
  await page.evaluate(() => document.getElementById('mk-ov').remove());
  // 3 Danach: Tag 4 abgehakt, Morgen-Zeile
  await title(page, true);
  await page.screenshot({ path: path.join(OUT, 'g3-3-after.png') });
  // 4 Your dice: Willkommen zurück und Wochenziele
  await page.click('#dice-t');
  await wait(1200);
  await page.click('#dip-btns [data-kind="starter"]').catch(() => {});
  for (let k = 0; k < 40 && !(await page.$('#dip-next')); k++) {
    await wait(800);
    if (await page.$('#dip-skip:not([hidden])')) await page.click('#dip-skip').catch(() => {});
  }
  await page.click('#dip-next').catch(() => {});
  await wait(1000);
  await page.evaluate(({ css }) => {
    if (!document.getElementById('mk-css')) {
      const st = document.createElement('style');
      st.id = 'mk-css';
      st.textContent = css;
      document.head.append(st);
    }
    const sc = document.querySelector('#dice .dscroll');
    sc.insertAdjacentHTML(
      'afterbegin',
      `<div class="sepia-say note mk-note"><p class="eyebrow">Master Sepia</p><p class="hand">Four days away. The sheet kept your place. Have a dip on me.</p><button type="button" class="tool">Take the dip</button></div>
       <section class="dbox goals"><p class="eyebrow">This week · new goals on Monday</p>
       <div class="gl"><b>Finish 4 daily sheets</b><span>2/4 · 80</span><div class="bar"><i style="width:50%"></i></div></div>
       <div class="gl"><b>Win 6 duels</b><span>5/6 · 80</span><div class="bar"><i style="width:83%"></i></div></div>
       <div class="gl ok"><b>Wash out 12 rival blots</b><span>12/12 ✓</span><div class="bar"><i style="width:100%"></i></div></div>
       <p class="all">All three: +1 blank canvas</p></section>`,
    );
    sc.scrollTop = 0;
  }, { css: CSS });
  await wait(400);
  await page.screenshot({ path: path.join(OUT, 'g3-4-dice.png') });
  // 5 Tagespost am Sonntag: Wochentag als Stufe, Malmittel des Tages, zwei große Pales
  const post = await browser.newPage({ viewport: { width: 390, height: 512 }, deviceScaleFactor: 2 });
  await post.goto(`${B}/sheet.html`);
  await wait(2500);
  await post.evaluate(() => {
    const st = document.createElement('style');
    st.textContent = `.mk-day { margin: 7px 0 0; display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
      .mk-day span { font: 700 11px var(--f-mono); border-radius: 999px; padding: 3px 9px; }
      .mk-day .d { background: #1d2130; color: #fbfaf6; }
      .mk-day .m { background: #fff; border: 1px solid #8e9aab; color: #3b4558; display: inline-flex; gap: 5px; align-items: center; }
      .mk-day .m i { width: 9px; height: 12px; border-radius: 3px 3px 5px 5px; background: #8e9aab; display: inline-block; }`;
    document.head.append(st);
    // In die Überschrift, damit das Raster des Posts gleich bleibt
    document.getElementById('s-title').insertAdjacentHTML('beforeend', '<span class="mk-day"><span class="d">Sunday · the Eraser’s day · ×1.5</span><span class="m"><i></i>Today: Salt</span></span>');
    // Sonntag: ein zweiter großer Pale in Welle 5
    const waves = document.querySelectorAll('.wv-p');
    const last = waves[waves.length - 1];
    if (last) last.lastElementChild?.classList.add('big');
    document.getElementById('s-sub').textContent = 'The hardest sheet of the week. Everyone gets the same sheet, dice and rolls. Salt for all today.';
  });
  await wait(300);
  await post.screenshot({ path: path.join(OUT, 'g3-5-post.png') });
  await browser.close();
})();
