const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = 3458;
const targetDir = process.argv[2] || 'docs/redesign-2026-10/before';
const outDir = path.resolve(__dirname, '..', targetDir);

function createServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  return http.createServer((req, res) => {
    let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });
}

async function capture() {
  fs.mkdirSync(outDir, { recursive: true });
  const server = createServer();
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Server running on http://localhost:${PORT}`);

  const executablePath = '/Users/michaelsaint/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  const browser = await chromium.launch({ headless: true, executablePath });

  try {
    // Every view at both widths: 1440 (desktop) and 390 (phone).
    const widths = [
      { w: 1440, h: 900, opts: {} },
      { w: 390, h: 844, opts: { isMobile: true } },
    ];
    for (const { w, h, opts } of widths) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...opts });
      const page = await ctx.newPage();
      await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outDir, `${w}-dashboard.png`), fullPage: false });

      // Expand first event
      const detailToggle = page.locator('article.card button[aria-expanded]').first();
      await detailToggle.click();
      await page.waitForTimeout(300);
      // The expanded card is taller than the viewport, so capture the whole card, not a crop of it.
      // The sticky header and export bar are hidden for this one shot only: they would paint over the card.
      await page.addStyleTag({ content: 'header.app-header,.export-bar{visibility:hidden!important}' });
      await page.locator('article.card').first().screenshot({ path: path.join(outDir, `${w}-event-expanded.png`) });
      await page.addStyleTag({ content: 'header.app-header,.export-bar{visibility:visible!important}' });
      await detailToggle.click();

      // Modals
      const modals = [
        { name: 'scoring', sel: 'button[aria-controls="modal-scoring"]' },
        { name: 'coverage', sel: 'button[aria-controls="modal-coverage"]' },
        { name: 'model', sel: 'button[aria-controls="modal-model"]' }
      ];
      for (const m of modals) {
        await page.locator(m.sel).first().click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(outDir, `${w}-modal-${m.name}.png`), fullPage: false });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }

      // Game plan (demo data, so no model or key is involved): the template plan renders inside the card.
      const demo = page.locator('aside.finder button[role="switch"]');
      await demo.click();
      await page.locator('article.card button:has-text("Game plan")').first().click();
      await page.waitForTimeout(400);
      await page.addStyleTag({ content: 'header.app-header,.export-bar{visibility:hidden!important}' });
      await page.locator('article.card').first().screenshot({ path: path.join(outDir, `${w}-game-plan.png`) });
      await page.addStyleTag({ content: 'header.app-header,.export-bar{visibility:visible!important}' });
      await demo.click();

      // Empty state (last: it replaces the event list)
      await page.locator('input[aria-label="Market"]').fill('ANCHORAGE, AK');
      await page.locator('button:has-text("SCOUT")').first().click();
      await page.waitForTimeout(600);
      const dialog = page.locator('div[role="dialog"]');
      if (await dialog.isVisible()) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
      await page.screenshot({ path: path.join(outDir, `${w}-empty-state.png`), fullPage: false });
      await ctx.close();
    }
    console.log(`Captured all screenshots to ${outDir}`);
  } finally {
    await browser.close();
    server.close();
  }
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
