// Renderiza video-stand/index.html cuadro por cuadro (determinista) con Playwright.
const { chromium } = require('playwright');
const [dir, out, mode] = process.argv.slice(2);
const FPS = 30, DUR = 47;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await p.goto('file://' + dir + '/index.html');
  await p.evaluate(async () => { await document.fonts.ready; for (const s of ['img/08-bloqueo.png','img/13-bloqueo-enviado.png']) { const i = new Image(); i.src = s; await i.decode(); } });
  const times = mode === 'stills' ? [1.0, 2.2, 3.2, 4.4, 5.0, 6.8, 9.1, 13.1, 17.5, 21.0, 25.3, 29.5, 33.0, 38.5, 39.9, 41.2, 44.0] : null;
  if (times) {
    for (const t of times) { await p.evaluate((t) => render(t), t); await p.waitForTimeout(30); await p.screenshot({ path: `${out}/t${t.toFixed(1)}.png` }); }
  } else {
    for (let i = 0; i < FPS * DUR; i++) {
      await p.evaluate((t) => render(t), i / FPS);
      await p.screenshot({ path: `${out}/f${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
    }
  }
  await b.close(); console.log('ok');
})();
