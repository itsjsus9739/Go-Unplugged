// Renderiza video-stand/index.html cuadro por cuadro (determinista) con Playwright.
const { chromium } = require('playwright');
const [dir, out, mode] = process.argv.slice(2);
const FPS = 25, DUR = 50;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await p.goto('file://' + dir + '/index.html');
  await p.evaluate(async () => { await document.fonts.ready; for (const s of ['img/08-bloqueo.png','img/13-bloqueo-enviado.png']) { const i = new Image(); i.src = s; await i.decode(); } });
  const times = mode === 'stills' ? [1.2, 3.0, 4.6, 7.5, 12.0, 14.0, 19.5, 26.0, 33.0, 41.0, 47.5] : null;
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
