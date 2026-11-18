// Renderiza el candado vectorial de marca (brand/assets/vector/icon-lock.svg) a los PNG del ícono.
// Uso (desde apps/mobile): node scripts/generar-iconos.js ../../brand/assets/vector/icon-lock.svg assets
// Requiere Playwright con Chromium.
const { chromium } = require('playwright');
const fs = require('fs');
const [svgPath, out] = process.argv.slice(2);
const svg = fs.readFileSync(svgPath, 'utf8');
const tint = (c) => svg.replace(/#3B34D0/gi, c);
// [archivo, tamaño, % de alto que ocupa el candado, color del candado, fondo]
const jobs = [
  ['android-icon-foreground.png', 1024, 0.48, '#FFFFFF', 'transparent'],
  ['android-icon-monochrome.png', 1024, 0.48, '#FFFFFF', 'transparent'],
  ['icon.png', 1024, 0.52, '#FFFFFF', '#08090B'],
  ['splash-icon.png', 1024, 0.55, '#3B34D0', 'transparent'],
  ['notification-icon.png', 96, 0.78, '#FFFFFF', 'transparent'],
  ['favicon.png', 64, 0.82, '#3B34D0', 'transparent'],
];
(async () => {
  const b = await chromium.launch();
  for (const [name, size, frac, color, bg] of jobs) {
    const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const h = Math.round(size * frac), w = Math.round((h * 100) / 120);
    await p.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${bg}">
      <div style="width:${w}px;height:${h}px">${tint(color).replace('<svg ', `<svg width="${w}" height="${h}" `)}</div></body></html>`);
    await p.screenshot({ path: `${out}/${name}`, omitBackground: bg === 'transparent' });
    await p.close();
  }
  await b.close();
  console.log('ok');
})();
