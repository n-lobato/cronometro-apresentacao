// Gera os ícones a partir de SVG. Uso (precisa do Playwright instalado):
//   node scripts/make-icons.js
const { chromium } = require('playwright');
const path = require('path');
const root = path.join(__dirname, '..');

const stopwatch = (fg, bg, stroke) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  ${bg ? `<rect x="2" y="2" width="96" height="96" rx="22" fill="${bg}"/>` : ''}
  <rect x="43" y="10" width="14" height="8" rx="2" fill="${fg}"/>
  <rect x="71" y="21" width="8" height="10" rx="2" fill="${fg}" transform="rotate(45 75 26)"/>
  <circle cx="50" cy="57" r="31" fill="none" stroke="${fg}" stroke-width="${stroke}"/>
  <path d="M50 57 L50 34 A23 23 0 0 1 72.4 61.9 Z" fill="${fg}"/>
  <circle cx="50" cy="57" r="4" fill="${fg}"/>
</svg>`;

const jobs = [
  { file: 'build/icon.png', size: 1024, svg: stopwatch('#3ddc84', '#11141a', 7) },
  { file: 'assets/icon.png', size: 256, svg: stopwatch('#3ddc84', '#11141a', 7) },
  { file: 'assets/tray.png', size: 16, svg: stopwatch('#3ddc84', null, 9) },
  { file: 'assets/tray@2x.png', size: 32, svg: stopwatch('#3ddc84', null, 9) },
  { file: 'assets/trayTemplate.png', size: 16, svg: stopwatch('#000000', null, 9) },
  { file: 'assets/trayTemplate@2x.png', size: 32, svg: stopwatch('#000000', null, 9) }
];

(async () => {
  const browser = await chromium.launch();
  for (const j of jobs) {
    const page = await browser.newPage({ viewport: { width: j.size, height: j.size } });
    await page.setContent(`<html><body style="margin:0;background:transparent">${j.svg.replace('<svg ', `<svg width="${j.size}" height="${j.size}" `)}</body></html>`);
    await page.screenshot({ path: path.join(root, j.file), omitBackground: true });
    await page.close();
  }
  await browser.close();
  console.log('Ícones gerados.');
})();
