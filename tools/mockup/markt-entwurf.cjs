/*
 * Entwurfsbogen „Tausch und Markt“ (nur für docs/entwuerfe, docs/entwuerfe/tausch-und-markt-plan.md).
 * Nimmt die echte Vorschau (npm run preview, Port 5174) mit einer gemalten Sammlung und setzt die geplanten Teile als Attrappe ein:
 * Knöpfe in „Your dice“, Markt, Verkaufen auf der Karte, neuer Tausch, eingehendes Angebot, Herkunft auf der Karte.
 * Danach ein Bogen mit allen Bildern.
 * Aufruf: node tools/mockup/markt-entwurf.cjs <Ausgabeordner> <Bogen.png>
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = process.argv[2] || '.';
const SHEET = process.argv[3] || path.join(OUT, 'sheet.png');
const URL = 'http://localhost:5174/duel.html';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CSS = `
  .mkrow { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0 0 10px; }
  .mkbtn { position: relative; display: grid; justify-items: start; gap: 2px; text-align: left; border: 1px solid var(--line); background: var(--sheet); border-radius: 12px; padding: 10px 12px; }
  .mkbtn b { font: 800 16px var(--f-body); } .mkbtn small { font-size: 12px; color: var(--muted); }
  .badge { position: absolute; right: 8px; top: 8px; min-width: 20px; height: 20px; border-radius: 10px; background: #b01e3e; color: #fff; font: 700 12px var(--f-mono); display: grid; place-items: center; }
  .mkfilt { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0 8px; }
  .mkfilt button { border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 5px 10px; font: 600 12px var(--f-body); }
  .mkfilt button.on { background: var(--ink); color: var(--sheet); border-color: var(--ink); }
  .mk .gal-grid { grid-template-columns: repeat(3, 1fr); }
  .mkov .gd { position: relative; aspect-ratio: 1; background: #fffdf8; border: 1px solid var(--line); border-bottom: 4px solid var(--c); border-radius: 10px; display: grid; place-items: center; overflow: hidden; }
  .mkov .gd small { position: absolute; left: 4px; bottom: 1px; font: 9px var(--f-mono); color: var(--muted); }
  .gd img { width: 88%; height: 88%; object-fit: contain; }
  .gd .price { position: absolute; left: 4px; bottom: 14px; font: 700 12px var(--f-mono); font-style: normal; background: rgba(255,253,248,.92); border-radius: 999px; padding: 1px 6px 1px 4px; display: inline-flex; gap: 4px; align-items: center; }
  .gd .price .pigi { width: 9px; height: 12px; }
  .gd .rar { position: absolute; right: 4px; top: 3px; font: 700 9px var(--f-mono); color: var(--c); }
  .gd.holo-rim { border-color: transparent; background: linear-gradient(#fffdf8,#fffdf8) padding-box, conic-gradient(#f66,#fd5,#6e8,#6cf,#a7f,#f6c,#f66) border-box; border-width: 2px 2px 4px; }
  .mknote { margin: 8px 0 0; font-size: 12.5px; color: var(--muted); }
  .sellbox { margin: 12px 0 4px; padding: 12px; border-radius: 14px; background: #f6f4ee; border: 1px solid var(--line); display: grid; gap: 6px; justify-items: center; text-align: center; }
  .sellbox p { margin: 0; font-size: 13px; color: var(--muted); } .sellbox p b { color: var(--ink); }
  .stepper { display: grid; grid-template-columns: 44px auto 44px; gap: 12px; align-items: center; }
  .stepper button { height: 40px; border-radius: 10px; border: 1px solid var(--ink); background: #fff; font: 700 20px var(--f-body); }
  .stepper b { font: 800 26px var(--f-mono); display: inline-flex; gap: 6px; align-items: center; }
  .tgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 4px 0 6px; }
  .slot { aspect-ratio: 1; border: 2px dashed var(--line); border-radius: 10px; display: grid; place-items: center; color: var(--muted); font: 700 22px var(--f-body); }
  .tpig { display: inline-flex; gap: 6px; align-items: center; font: 700 15px var(--f-mono); background: #fff; border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; }
  .tpig small { font: 11px var(--f-mono); color: var(--muted); }
  .tsides { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; margin: 10px 0; }
  .tsides .gd { width: 100%; } .tsides .arrow { font: 700 24px var(--f-body); color: var(--muted); }
  .tsides .col { display: grid; gap: 6px; justify-items: center; }
  .prov { margin: 10px 0 2px; padding: 8px 10px; border-radius: 10px; background: #eef1f7; font-size: 13px; line-height: 1.4; }
  .prov b { color: #2c3550; }
  .tradebtns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
  .tradebtns button { min-height: 46px; }
  .lockline { margin: 6px 0 0; font: 12px var(--f-mono); color: var(--muted); text-align: center; }
`;

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await p.goto(URL);
  await p.waitForFunction(() => window.done === true, null, { timeout: 30000 });
  await p.evaluate(() => { localStorage.setItem('bid-duel-hints', '1'); localStorage.setItem('bid-duel-learned', '1'); });
  await p.addStyleTag({ content: CSS });
  await p.click('#dice-t');
  await wait(800);
  // Frische Vorschau: erst die freien Startzüge ziehen
  if (await p.locator('#dip-btns [data-kind="starter"]').isVisible().catch(() => false)) {
    await p.click('#dip-btns [data-kind="starter"]');
    for (let i = 0; i < 300; i++) {
      if (await p.locator('#dip-next').isVisible().catch(() => false)) break;
      if (i > 4) await p.mouse.click(195, 300).catch(() => {});
      await wait(150);
    }
    await p.click('#dip-next');
  }
  await wait(9000);
  // Bilder aus der echten Sammlung
  const tiles = await p.evaluate(() =>
    [...document.querySelectorAll('#coll .dcard')].slice(0, 14).map((c) => {
      const cv = c.querySelector('canvas');
      return { src: cv ? cv.toDataURL() : '', col: c.style.getPropertyValue('--c'), name: c.querySelector('b')?.textContent ?? '', rar: c.querySelector('small')?.textContent?.split(' ·')[0] ?? '', holo: c.classList.contains('shiny') };
    }),
  );
  await p.evaluate((t) => (window.__tiles = t), tiles);
  const shots = [];
  const shot = async (cap) => {
    const f = path.join(OUT, `mk-${shots.length + 1}.png`);
    await p.screenshot({ path: f });
    shots.push({ f, cap });
  };
  const tileHtml = `(t, extra = '') => '<div class="gd' + (t.holo ? ' holo-rim' : '') + '" style="--c:' + t.col + '"><img src="' + t.src + '"><span class="rar">' + t.rar + '</span>' + extra + '</div>'`;
  const overlay = async (inner) => {
    await p.evaluate(
      ({ inner, tileHtml }) => {
        const tile = eval(tileHtml);
        document.querySelectorAll('.mkov').forEach((e) => e.remove());
        document.getElementById('inspect').hidden = true;
        const o = document.createElement('div');
        o.className = 'overlay mkov mk';
        o.innerHTML = '<div class="sheet">' + new Function('tile', 'T', 'return `' + inner + '`')(tile, window.__tiles) + '</div>';
        document.body.append(o);
      },
      { inner, tileHtml },
    );
    await wait(400);
  };

  // 1. Your dice: Knöpfe Markt und Tausch, Sepias Bericht
  await p.evaluate(() => {
    const s = document.querySelector('#dice .dscroll');
    const note = document.createElement('div');
    note.className = 'sepia-say note';
    note.innerHTML = '<p class="eyebrow">Master Sepia</p><p class="hand">Someone bought your Carmine Jelly for 420. The market kept its tenth, 378 are yours. And u/Inkwell wants to trade.</p><button type="button" class="tool">Collect</button>';
    const row = document.createElement('div');
    row.className = 'mkrow';
    row.innerHTML = '<button type="button" class="mkbtn"><b>Market</b><small>214 dice for sale</small></button><button type="button" class="mkbtn"><b>Trades</b><small>1 offer waiting</small><span class="badge">1</span></button>';
    s.prepend(note, row);
    s.scrollTop = 0;
  });
  await wait(300);
  await shot('Your dice: Knöpfe „Market“ und „Trades“ mit Zähler, Sepia meldet Verkäufe und Angebote, Pigment zum Abholen.');
  await p.evaluate(() => document.querySelectorAll('#dice .mkrow, #dice .dscroll > .sepia-say.note:not([id])').forEach((e) => e.remove()));

  // 2. Markt
  // Preise passend zur Seltenheit (Zug 100 Pigment: Rare etwa jeder 7., Epic jeder 25., Legendary jeder 100.), Holo dreifach
  const sellers = ['Oldbrush', 'Inkwell', 'Palette_Knife', 'Gesso', 'Inkwell', 'Wetonwet', 'Oldbrush', 'Sable', 'Gesso', 'Wetonwet', 'Sable', 'Oldbrush'];
  await p.evaluate((sellers) => {
    const base = { Common: [40, 90], Uncommon: [80, 180], Rare: [300, 520], Epic: [1800, 2600], Legendary: [8000, 12000] };
    window.__market = window.__tiles.slice(0, 12).map((t, i) => {
      const [lo, hi] = base[t.rar] ?? [60, 120];
      const price = Math.round((lo + ((i * 37) % 10) * (hi - lo) / 10) * (t.holo ? 3 : 1) / 5) * 5;
      return { ...t, price, seller: sellers[i] };
    }).sort((a, b) => a.price - b.price);
  }, sellers);
  await overlay(
    `<button type="button" class="close">✕</button><p class="eyebrow">Market</p><h2>Wet paint for sale</h2>` +
      `<div class="mkfilt"><button class="on">All</button><button>Rare+</button><button>Holo</button><button>Styles</` +
      `button><button>Drawn</button><button>Cheapest ▾</button></div>` +
      '<div class="gal-grid">${window.__market.slice(0, 9).map((t) => tile(t, `<em class="price"><i class="pigi"></i>${t.price}</em><small>u/${t.seller}</small>`)).join("")}</div>' +
      `<p class="mknote">Your listings 1/5 · a tenth of each sale goes down the drain · listings last 3 days</p>`,
  );
  await shot('Markt: Würfel anderer Spieler mit Preis in Pigment, Filter nach Seltenheit, Holo, Stil, gemalt, Sortieren nach Preis. Antippen öffnet die Karte mit „Buy for 340“ (zweimal tippen).');

  // 3. Verkaufen auf der Karte
  await p.evaluate(() => document.querySelectorAll('.mkov').forEach((e) => e.remove()));
  await p.locator('#coll .dcard').nth(3).click();
  await wait(1500);
  await p.evaluate(() => {
    // Attrappe: dieser Würfel liegt nicht im Deck (sonst wäre er gesperrt)
    document.querySelectorAll('#inspect .trow:not(.wash)').forEach((e) => e.remove());
    const rar = document.querySelector('#inspect .card-id .lv b')?.textContent ?? 'Uncommon';
    const band = { Common: [40, 90, 60], Uncommon: [80, 180, 120], Rare: [300, 520, 420], Epic: [1800, 2600, 2200], Legendary: [8000, 12000, 9500] }[rar] ?? [80, 180, 120];
    const top = document.querySelector('#inspect .card-top');
    const box = document.createElement('div');
    box.className = 'sellbox';
    box.innerHTML = `<p class="eyebrow">Sell on the market</p><div class="stepper"><button>−</button><b><i class="pigi"></i>${band[2]}</b><button>+</button></div><p>${rar}s sold for <b>${band[0]} to ${band[1]}</b> this week.</p><p>A tenth goes down the drain: you get <b>${Math.floor(band[2] * 0.9)}</b>. Listed for 3 days, then it comes back.</p><button type="button" class="primary">List for ${band[2]}</button>`;
    top.after(box);
  });
  await wait(300);
  await shot('Verkaufen: auf der Karte Preis wählen, Sepia nennt, was diese Seltenheit zuletzt gebracht hat, die Gebühr (ein Zehntel) steht dabei. Eingestellte Würfel sind gesperrt.');

  // 4. Neuer Tausch
  await overlay(
    `<button type="button" class="close">✕</button><p class="eyebrow">New trade</p><h2>With u/Oldbrush</h2>` +
      '<p class="eyebrow">You give</p><div class="tgrid">${tile(T[4])}${tile(T[6])}<div class="slot">+</div></div>' +
      `<span class="tpig">+ <i class="pigi"></i> 100 <small>at most 500</small></span>` +
      '<p class="eyebrow" style="margin-top:12px">You get</p><div class="tgrid">${tile(T[8])}<div class="slot">+</div><div class="slot">+</div></div>' +
      `<p class="mknote">Pick up to 3 of theirs and 3 of yours. They have 3 days to answer, your dice stay locked until then.</p>` +
      `<div class="gal-btns"><button type="button" class="primary">Send offer</button><button type="button" class="ghost">Cancel</button></div>`,
  );
  await shot('Neuer Tausch: Spieler wählen (u/Name oder aus Galerie und Markt), bis zu 3 Würfel je Seite und etwas Pigment. Die Sammlung des anderen ist dabei sichtbar.');

  // 5. Eingehendes Angebot
  await overlay(
    `<p class="eyebrow">Trade offer</p><h2>From u/Inkwell</h2>` +
      `<div class="sepia-say"><p class="eyebrow">Master Sepia</p><p class="hand">They want your Tower. Look at what they offer before you look at the frame.</p></div>` +
      '<div class="tsides"><div class="col"><p class="eyebrow">You give</p>${tile(T[2])}</div><div class="arrow">⇄</div><div class="col"><p class="eyebrow">You get</p>${tile(T[7])}<span class="tpig">+ <i class="pigi"></i> 150</span></div></div>' +
      `<div class="gal-btns"><button type="button" class="primary">Accept</button><button type="button" class="ghost">Decline</button></div>` +
      `<p class="lockline">Expires in 2 days · trades today 1/3</p>`,
  );
  await shot('Angebot: beide Seiten nebeneinander, Annehmen oder Ablehnen. Der Server tauscht alles auf einmal oder gar nichts. Holo und Legendary fragen noch einmal nach.');

  // 6. Herkunft auf der Karte
  await p.evaluate(() => document.querySelectorAll('.mkov').forEach((e) => e.remove()));
  await p.locator('#coll .dcard').nth(5).click();
  await wait(1500);
  await p.evaluate(() => {
    document.querySelectorAll('#inspect .trow:not(.wash)').forEach((e) => e.remove());
    const top = document.querySelector('#inspect .card-top');
    const prov = document.createElement('p');
    prov.className = 'prov';
    prov.innerHTML = 'Pulled by <b>u/Inkwell</b> on 29 Oct · bought by <b>u/Oldbrush</b> for 340 · traded to <b>you</b> today';
    const btns = document.createElement('div');
    btns.className = 'tradebtns';
    btns.innerHTML = '<button type="button" class="ghost">Sell</button><button type="button" class="ghost">Offer in a trade</button>';
    const lock = document.createElement('p');
    lock.className = 'lockline';
    lock.textContent = 'Starter dice stay with you · dice in your deck cannot be sold';
    top.after(prov, btns, lock);
  });
  await wait(300);
  await shot('Herkunft: jede Karte zeigt, durch wessen Hände der Würfel ging. Dazu „Sell“ und „Offer in a trade“. Startwürfel und Würfel im Deck sind gesperrt.');

  // Bogen
  const figs = shots.map((s, i) => `<figure><img src="data:image/png;base64,${fs.readFileSync(s.f).toString('base64')}"><figcaption><b>${i + 1}</b> ${s.cap}</figcaption></figure>`).join('');
  const q = await b.newPage({ viewport: { width: 1180, height: 800 }, deviceScaleFactor: 1.5 });
  await q.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 22px; background: #e4e1d8; font-family: system-ui, sans-serif; color: #1d2130; width: 1136px; }
    .eyebrow { margin: 0; font: 11px monospace; letter-spacing: .16em; text-transform: uppercase; color: #5f6474; }
    h1 { margin: 6px 0 4px; font: 400 1.8rem Georgia, serif; } .sub { margin: 0 0 14px; color: #5f6474; font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    figure { margin: 0; background: #fbfaf6; border: 1px solid #cfcabd; border-radius: 12px; padding: 8px; }
    figure img { width: 100%; border-radius: 8px; display: block; border: 1px solid #ddd8cc; }
    figcaption { font-size: 12.5px; line-height: 1.35; margin-top: 6px; color: #3b3f4c; } figcaption b { color: #1d2130; font-size: 14px; margin-right: 4px; }
  </style></head><body><p class="eyebrow">Entwurf · Tausch und Markt</p><h1>Würfel tauschen und verkaufen</h1>
  <p class="sub">Nur gegen Pigment, nie gegen Geld oder Reddit Gold. Attrappen in der echten Vorschau, Monster aus der Sammlung.</p><div class="grid">${figs}</div></body></html>`);
  await wait(400);
  await q.screenshot({ path: SHEET, fullPage: true });
  await b.close();
})();
