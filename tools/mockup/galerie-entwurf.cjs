/*
 * Entwurfsbogen „Galerie-Duell“ (nur für docs/entwuerfe, docs/entwuerfe/galerie-duell-plan.md).
 * Nimmt die echte Vorschau (npm run preview, Port 5174) und setzt die geplanten Teile als Attrappe ein:
 * Knopf auf dem Startbild, Vorschau des fremden Decks, Name im Duell, Karte mit Besitzer und Report,
 * Archiv-Würfel, Ergebnis, Sepias Nachricht in „Your dice“. Danach ein Bogen mit allen Bildern.
 * Aufruf: node tools/mockup/galerie-entwurf.cjs <Ausgabeordner>
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = process.argv[2] || '.';
const URL = 'http://localhost:5174/duel.html';
const W = 390,
  H = 800;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const EXTRA_CSS = `
  .gal-btn { background: #2c3550 !important; }
  .gal-note { margin: 2px 0 0; text-align: center; font-size: 13px; color: var(--muted); }
  .gal-note b { color: var(--ink); }
  .gal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 10px 0; }
  .gal-grid div { background: #fffdf8; border: 1px solid var(--line); border-bottom: 4px solid var(--c); border-radius: 10px; aspect-ratio: 1; display: grid; place-items: center; position: relative; overflow: hidden; }
  .gal-grid img { width: 92%; height: 92%; object-fit: contain; }
  .gal-grid small { position: absolute; left: 4px; bottom: 2px; font: 9px 'JetBrains Mono', monospace; color: var(--muted); }
  .gal-grid .holo-rim { border-color: transparent; background: linear-gradient(#fffdf8,#fffdf8) padding-box, conic-gradient(#f66,#fd5,#6e8,#6cf,#a7f,#f6c,#f66) border-box; border-width: 2px 2px 4px; }
  .gal-pow { font-size: 13px; color: var(--muted); margin: 0 0 4px; }
  .gal-bar { position: relative; height: 8px; border-radius: 4px; background: linear-gradient(90deg,#d8e3d0,#efe6c8,#ecd2c8); margin: 4px 0 2px; }
  .gal-bar i { position: absolute; top: -4px; width: 4px; height: 16px; border-radius: 2px; }
  .gal-legend { display: flex; justify-content: space-between; font: 10px 'JetBrains Mono', monospace; color: var(--muted); }
  .gal-btns { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin-top: 12px; }
  .gal-owner { margin: 8px 0 2px; padding: 6px 10px; border-radius: 10px; background: #eef1f7; font-size: 13px; }
  .gal-owner.drift { background: #f1ede4; }
  .gal-owner b { color: #2c3550; }
  .gal-report { margin-top: 10px; width: 100%; min-height: 40px; border: 1px solid #c9a39a; color: #8a3b2c; background: #fff; border-radius: 10px; font-weight: 700; }
  .gal-report + small { display: block; margin-top: 4px; font-size: 12px; color: var(--muted); text-align: center; }
  .faded { filter: saturate(.5) brightness(1.1) contrast(.9); -webkit-mask: radial-gradient(circle at 50% 45%, #000 52%, rgba(0,0,0,.35) 78%); mask: radial-gradient(circle at 50% 45%, #000 52%, rgba(0,0,0,.35) 78%); }
`;

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(URL);
  await p.addStyleTag({ content: EXTRA_CSS });
  await wait(2500);
  const shots = [];
  const shot = async (name, cap) => {
    const f = path.join(OUT, `gal-${shots.length + 1}.png`);
    await p.screenshot({ path: f });
    shots.push({ f, name, cap });
  };

  // 1. Startbild mit Knopf „Gallery duel“
  await p.evaluate(() => {
    const start = document.getElementById('start');
    const g = document.createElement('button');
    g.type = 'button';
    g.className = 'primary gal-btn';
    g.textContent = 'Gallery duel';
    const n = document.createElement('p');
    n.className = 'gal-note';
    n.innerHTML = 'Your deck hangs in the gallery · <b>4 won · 2 lost</b>';
    start.after(g, n);
  });
  await wait(300);
  await shot('Startbild', '„Gallery duel“ unter „Start duel“, darunter, wie dein eigenes Deck in der Galerie läuft.');

  // Duell starten (läuft die Startzüge, danach liegen 9 Würfel im Deck)
  await p.evaluate(() => {
    document.querySelector('.gal-btn')?.remove();
    document.querySelector('.gal-note')?.remove();
  });
  await p.click('#start');
  await wait(9000);
  // Malmittel nehmen, damit das Brett frei ist
  if (await p.locator('#ctx .mcard').count()) {
    await p.click('#ctx .mcard >> nth=0');
    await wait(3500);
  }
  // Bilder des Rivalen als Deck des anderen Spielers
  const imgs = await p.evaluate(async () => {
    const out = [];
    for (const c of document.querySelectorAll('#rival-dice canvas')) out.push(c.toDataURL());
    return out;
  });
  const rar = await p.evaluate(() => [...document.querySelectorAll('#rival-dice .rd')].map((e) => getComputedStyle(e).getPropertyValue('--c')));

  // 3. Duell mit Namen statt „Rival“
  await p.evaluate(() => {
    const r = document.querySelector('.nums .r');
    if (r && r.firstChild) r.firstChild.textContent = 'u/inkwell ';
    const bn = document.getElementById('banner');
    bn.textContent = "u/inkwell's deck plays";
    bn.className = '';
    bn.style.opacity = '1';
  });
  await wait(300);
  await shot('Im Duell', 'Oben steht der Besitzer statt „Rival“, das Banner sagt, wessen Deck gerade spielt. Der Computer führt es.');
  await p.evaluate(() => {
    const bn = document.getElementById('banner');
    bn.style.opacity = '';
    bn.textContent = '';
  });

  // 4. Karte eines gegnerischen Würfels mit Besitzer und Report
  await p.click('#rival-dice .rd >> nth=0');
  await wait(1200);
  await p.evaluate(() => {
    const top = document.querySelector('#inspect-body .card-top');
    const o = document.createElement('p');
    o.className = 'gal-owner';
    o.innerHTML = "From <b>u/inkwell</b>'s deck · #00427 · glaze 2 · patina 1/3";
    top.after(o);
    const body = document.getElementById('inspect-body');
    const r = document.createElement('button');
    r.className = 'gal-report';
    r.textContent = 'Report drawing';
    const s = document.createElement('small');
    s.textContent = 'Only on drawn monsters. Hides the drawing for everyone until a moderator looks.';
    body.append(r, s);
    document.querySelector('#inspect .sheet').scrollTop = 0;
  });
  await wait(300);
  await shot('Karte', 'Antippen zeigt die Karte mit Besitzer, Seriennummer, Lasur und Patina. Bei gemalten Monstern „Report drawing“.');

  // 5. Archiv-Würfel im normalen Duell
  await p.evaluate(() => (document.getElementById('inspect').hidden = true));
  await p.click('#rival-dice .rd >> nth=1');
  await wait(1200);
  await p.evaluate(() => {
    const top = document.querySelector('#inspect-body .card-top');
    top.querySelector('canvas')?.classList.add('faded');
    const o = document.createElement('p');
    o.className = 'gal-owner drift';
    o.innerHTML = 'Drifted back from the margins · washed out by <b>u/oldbrush</b> · #00031';
    top.after(o);
  });
  await wait(300);
  await shot('Aus dem Archiv', 'Im normalen Duell bringt der Rivale bis zu 2 ausgewaschene Monster anderer Spieler mit, am Rand ausgeblichen.');
  await p.evaluate(() => (document.getElementById('inspect').hidden = true));

  // 6. Ergebnis
  await p.evaluate(() => {
    document.getElementById('result-title').textContent = "You beat u/inkwell's deck";
    document.getElementById('result-sub').innerHTML = 'Palette broken in round 5.<br><small style="color:var(--muted)">u/inkwell still gets 3 pigment for hanging it.</small>';
    const rw = document.getElementById('result-reward');
    rw.hidden = false;
    rw.textContent = '+60 pigment';
    document.getElementById('result-sepia').textContent = 'Their deck goes back on the wall. Slightly lighter.';
    document.getElementById('result').hidden = false;
  });
  await wait(400);
  await shot('Ergebnis', 'Pigment für dich wie bisher. Der Besitzer bekommt eine kleine Gebühr, für einen Sieg seines Decks mehr.');
  await p.evaluate(() => (document.getElementById('result').hidden = true));

  // 2. Vorschau des fremden Decks (auf dem Startbild)
  await p.evaluate(
    ({ imgs, rar }) => {
      document.querySelectorAll('.screen').forEach((s) => (s.hidden = s.id !== 'title'));
      const ov = document.createElement('div');
      ov.className = 'overlay';
      ov.id = 'galprev';
      const cells = imgs
        .slice(0, 9)
        .map((u, i) => `<div class="${i === 4 ? 'holo-rim' : ''}" style="--c:${rar[i] || '#999'}"><img src="${u}"><small>#00${410 + i * 7}</small></div>`)
        .join('');
      ov.innerHTML = `<div class="sheet">
        <p class="eyebrow">Gallery</p>
        <h2>u/inkwell's deck</h2>
        <p style="margin:0;color:var(--muted);font-size:13px">Hung yesterday · 12 won · 7 lost</p>
        <div class="gal-grid">${cells}</div>
        <p class="gal-pow">Strength <b>1 086</b> · yours 1 052 · <b>about as strong as yours</b></p>
        <div class="gal-bar"><i style="left:47%;background:#2f5fb3"></i><i style="left:52%;background:#b5432f"></i></div>
        <div class="gal-legend"><span>weaker</span><span>stronger</span></div>
        <div class="sepia-say" style="margin-top:10px"><p class="eyebrow">Master Sepia</p><p class="hand">Someone else's brushwork. Study it before you ruin it.</p></div>
        <div class="gal-btns"><button type="button" class="primary">Duel u/inkwell</button><button type="button" class="ghost">Another deck</button></div>
      </div>`;
      document.body.append(ov);
    },
    { imgs, rar },
  );
  await wait(600);
  await shot('Vorschau', 'Ein Deck mit ähnlicher Stärke: 9 Würfel mit Seriennummer, Holo und Stil, die Bilanz des Decks. Einmal „Another deck“.');
  await p.evaluate(() => document.getElementById('galprev')?.remove());

  // 7. Your dice: Sepias Nachricht nach Abwesenheit
  await p.evaluate(() => document.querySelectorAll('.screen').forEach((s) => (s.hidden = s.id !== 'title')));
  await p.click('#dice-t');
  await wait(3500);
  await p.evaluate(() => {
    const n = document.getElementById('painted-note');
    n.hidden = false;
    document.getElementById('painted-say').textContent =
      'Your deck hung in the gallery while you were away. Six painters tried it. Four went home with your colours on their sleeves.';
    const ok = document.getElementById('painted-ok');
    ok.textContent = 'Collect +66 pigment';
    ok.style.cssText = 'position:static;transform:none;display:block;margin:8px 0 2px;';
    document.getElementById('pigment').textContent = '248';
    document.querySelector('#dice .dscroll').scrollTop = 0;
  });
  await wait(400);
  await shot('Your dice', 'Wer weg war, bekommt beim nächsten Öffnen Sepias Bericht und das Pigment aus der Galerie.');

  // Bogen: Reihenfolge wie im Ablauf
  const order = ['Startbild', 'Vorschau', 'Im Duell', 'Karte', 'Ergebnis', 'Your dice', 'Aus dem Archiv'];
  const list = order.map((n) => shots.find((s) => s.name === n));
  const sheet = await ctx.newPage();
  await sheet.setViewportSize({ width: 1180, height: 800 });
  const fig = list
    .map(
      (s, i) =>
        `<figure><img src="data:image/png;base64,${fs.readFileSync(s.f).toString('base64')}"><figcaption><b>${i + 1} ${s.name}</b> ${s.cap}</figcaption></figure>`,
    )
    .join('');
  await sheet.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 22px; background: #e4e1d8; font-family: Figtree, system-ui, sans-serif; color: #1d2130; width: 1136px; }
    .eyebrow { margin: 0; font: 11px monospace; letter-spacing: .16em; text-transform: uppercase; color: #5f6474; }
    h1 { margin: 6px 0 4px; font: 400 1.8rem Georgia, serif; }
    .sub { margin: 0 0 14px; color: #5f6474; font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    figure { margin: 0; background: #fbfaf6; border: 1px solid #cfcabd; border-radius: 12px; padding: 8px; }
    figure img { width: 100%; border-radius: 8px; display: block; border: 1px solid #ddd8cc; }
    figcaption { font-size: 12.5px; line-height: 1.35; margin-top: 6px; color: #3b3f4c; }
    figcaption b { display: block; color: #1d2130; font-size: 13.5px; }
    .note { background: #fbfaf6; border: 1px dashed #b9b2a2; border-radius: 12px; padding: 12px 14px; font-size: 13px; line-height: 1.45; }
    .note b { display: block; margin-bottom: 4px; }
  </style></head><body>
    <p class="eyebrow">Entwurf · Galerie-Duell · 31.10.2026</p>
    <h1>Gegen die Decks anderer Spieler</h1>
    <p class="sub">Attrappe auf der echten Vorschau. Namen, Zahlen und Texte sind Beispiele, die Bilder sind echte Monster.</p>
    <div class="grid">${fig}<div class="note"><b>Was neu ist</b>Dein Deck hängt nach jedem fertigen Duell als Abzug in der Galerie. Andere spielen dagegen, der Computer führt es mit deinen echten Würfeln. Fremde Zeichnungen erscheinen nur nach Freigabe durch Mods, mit „Report“. Ausgewaschene Monster treiben im normalen Duell beim Rivalen mit.</div></div>
  </body></html>`);
  await wait(500);
  const h = await sheet.evaluate(() => document.body.scrollHeight);
  await sheet.setViewportSize({ width: 1180, height: h + 10 });
  await sheet.screenshot({ path: path.join(OUT, 'galerie-duell-entwurf.png'), fullPage: true });
  await b.close();
  console.log('ok', shots.length);
})();
