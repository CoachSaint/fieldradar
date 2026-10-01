/**
 * Accessibility sweep: injects axe-core (from cdnjs, same CDN the app already
 * uses for React) into the rendered page and reports violations at 1440 and 390
 * for the dashboard, an expanded card, each drawer, and the empty state.
 *
 * Exit code 1 if any serious or critical violation is found.
 *   NODE_PATH=<dir with playwright> node scripts/axe-check.cjs
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = 3459;
const AXE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

function createServer() {
  return http.createServer((req, res) => {
    let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(PUBLIC_DIR, 'index.html');
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
    fs.readFile(filePath, (err, content) => {
      if (err) { res.writeHead(500); res.end('Server Error'); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
      res.end(content);
    });
  });
}

async function main() {
  const server = createServer();
  await new Promise(r => server.listen(PORT, r));
  const executablePath = '/Users/michaelsaint/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  const browser = await chromium.launch({ headless: true, executablePath });
  const rows = [];
  let blocking = 0;

  async function scan(page, label) {
    const result = await page.evaluate(async () => {
      const r = await axe.run(document, { resultTypes: ['violations'] });
      return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0] && v.nodes[0].target.join(' ') }));
    });
    const bad = result.filter(v => v.impact === 'serious' || v.impact === 'critical');
    blocking += bad.length;
    rows.push({ label, total: result.length, serious_or_critical: bad.length, violations: result });
    console.log(`${bad.length === 0 ? 'PASS' : 'FAIL'}  ${label}: ${result.length} violation(s), ${bad.length} serious/critical`);
    for (const v of result) console.log(`      - [${v.impact}] ${v.id} (${v.nodes}×) ${v.help}  e.g. ${v.sample}`);
  }

  try {
    for (const [w, h, opts] of [[1440, 900, {}], [390, 844, { isMobile: true }]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...opts });
      const page = await ctx.newPage();
      await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
      await page.addScriptTag({ url: AXE_URL });
      await page.waitForFunction(() => typeof axe !== 'undefined');

      await scan(page, `${w}px dashboard`);
      const toggle = page.locator('article.card button[aria-expanded]').first();
      await toggle.click();
      await page.waitForTimeout(200);
      await scan(page, `${w}px expanded event card`);
      await toggle.click();
      await page.locator('details.types > summary').click();
      await scan(page, `${w}px event types open`);
      await page.locator('details.types > summary').click();
      for (const name of ['scoring', 'coverage', 'model']) {
        await page.locator(`button[aria-controls="modal-${name}"]`).first().click();
        await page.waitForTimeout(250);
        await scan(page, `${w}px ${name} drawer`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
      }
      await page.locator('input[aria-label="Market"]').fill('ANCHORAGE, AK');
      await page.locator('button:has-text("SCOUT")').first().click();
      await page.waitForTimeout(600);
      if (await page.locator('div[role="dialog"]').isVisible()) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
      await scan(page, `${w}px empty state with error banner`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\nAXE RESULT: ${blocking === 0 ? 'zero serious/critical violations' : blocking + ' serious/critical violation(s)'} across ${rows.length} scans`);
  if (blocking > 0) process.exitCode = 1;
}
main().catch(e => { console.error(e); process.exit(1); });
