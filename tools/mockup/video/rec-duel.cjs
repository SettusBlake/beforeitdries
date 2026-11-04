// Ein Duell gegen den Lehrling aufnehmen (CDP-Screencast, JPEG-Bilder mit Zeitstempel) und den Spielstand mitschreiben
const L = require('./lib.cjs');
const fs = require('fs');
const OUT = process.argv[2];
const MAXS = Number(process.argv[3] || 75);
(async () => {
  await L.reset();
  await L.jget('/dev/pigment?n=3000&unlock=1');
  const b = await L.chromium.launch();
  const { p, ctx, log } = await L.open(b, { width: 540, height: 1050, mobile: true }, { seen: true, dpr: 1 });
  await L.load(p);
  await p.click('#t-lv-apprentice').catch(() => {});
  fs.mkdirSync(OUT + '/frames', { recursive: true });
  const cdp = await ctx.newCDPSession(p);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const n = frames.length;
    fs.writeFileSync(`${OUT}/frames/f${String(n).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64'));
    frames.push(f.metadata.timestamp);
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await p.click('#start');
  const t0 = Date.now() / 1000;
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 2100, everyNthFrame: 1 });
  const states = [];
  let stop = false;
  const poll = (async () => {
    while (!stop) {
      const s = await L.st(p).catch(() => null);
      if (s) states.push({ t: Date.now() / 1000, phase: s.phase, turn: s.turn, round: s.round, busy: s.busy, over: s.over, units: (s.units || []).map((u) => [u.id, u.side, u.hp]), score: s.score });
      await L.wait(120);
    }
  })();
  const t1 = Date.now();
  while ((Date.now() - t1) / 1000 < MAXS) {
    if (await p.isVisible('#result')) break;
    if (await p.isVisible('#tip')) { await p.click('#tip-ok').catch(() => {}); continue; }
    const s = await L.st(p);
    if (s.over) break;
    if (s.phase === 'medium' && s.turn === 1 && !s.busy) { await p.locator('#ctx .mcard').first().click().catch(() => {}); await L.wait(300); continue; }
    if (!s.busy && (await p.locator('#go').isEnabled().catch(() => false))) await p.click('#go').catch(() => {});
    await L.wait(250);
  }
  await L.wait(1500);
  await cdp.send('Page.stopScreencast');
  stop = true;
  await poll;
  fs.writeFileSync(OUT + '/frames.json', JSON.stringify({ t0, frames, states }));
  console.log('frames', frames.length, 'span', (frames.at(-1) - frames[0]).toFixed(1), 's', 'errors', log.errors.length);
  await b.close();
})();
