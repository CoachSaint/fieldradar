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
    // 1440 Desktop
    const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const deskPage = await deskCtx.newPage();
    await deskPage.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await deskPage.waitForTimeout(500);
    await deskPage.screenshot({ path: path.join(outDir, '1440-dashboard.png'), fullPage: false });

    // Expand first event
    const detailToggle = deskPage.locator('article.card button[aria-expanded]').first();
    await detailToggle.click();
    await deskPage.waitForTimeout(300);
    await deskPage.screenshot({ path: path.join(outDir, '1440-event-expanded.png'), fullPage: false });
    await detailToggle.click();

    // Modals
    const modals = [
      { name: 'scoring', sel: 'button[aria-controls="modal-scoring"]' },
      { name: 'coverage', sel: 'button[aria-controls="modal-coverage"]' },
      { name: 'model', sel: 'button[aria-controls="modal-model"]' }
    ];

    for (const m of modals) {
      const btn = deskPage.locator(m.sel).first();
      await btn.click();
      await deskPage.waitForTimeout(300);
      await deskPage.screenshot({ path: path.join(outDir, `1440-modal-${m.name}.png`), fullPage: false });
      await deskPage.keyboard.press('Escape');
      await deskPage.waitForTimeout(200);
    }

    // Empty state
    const searchInput = deskPage.locator('input[aria-label="Market"]').first();
    await searchInput.fill('ANCHORAGE, AK');
    const scoutBtn = deskPage.locator('button:has-text("SCOUT")').first();
    await scoutBtn.click();
    await deskPage.waitForTimeout(600);
    const dialog = deskPage.locator('div[role="dialog"]');
    if (await dialog.isVisible()) {
      await deskPage.keyboard.press('Escape');
      await deskPage.waitForTimeout(200);
    }
    await deskPage.screenshot({ path: path.join(outDir, '1440-empty-state.png'), fullPage: false });
    await deskCtx.close();

    // 390 Mobile
    const mobCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const mobPage = await mobCtx.newPage();
    await mobPage.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await mobPage.waitForTimeout(500);
    await mobPage.screenshot({ path: path.join(outDir, '390-dashboard.png'), fullPage: false });

    // Expand first event mobile
    const mobDetailToggle = mobPage.locator('article.card button[aria-expanded]').first();
    await mobDetailToggle.click();
    await mobPage.waitForTimeout(300);
    await mobPage.screenshot({ path: path.join(outDir, '390-event-expanded.png'), fullPage: false });
    await mobDetailToggle.click();

    // Mobile Modal
    const mobModelBtn = mobPage.locator('button[aria-controls="modal-model"]').first();
    await mobModelBtn.click();
    await mobPage.waitForTimeout(300);
    await mobPage.screenshot({ path: path.join(outDir, '390-modal-model.png'), fullPage: false });
    await mobPage.keyboard.press('Escape');
    await mobPage.waitForTimeout(200);

    await mobCtx.close();
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
