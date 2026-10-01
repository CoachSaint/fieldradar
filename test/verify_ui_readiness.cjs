const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = 3456;

// Basic static server
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

function luminance(r, g, b) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function contrastRatio(hex1, hex2) {
  const parse = hex => {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  const l1 = luminance(r1, g1, b1);
  const l2 = luminance(r2, g2, b2);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Math.round(ratio * 10) / 10;
}

async function runVerification() {
  const server = createServer();
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`[TEST SERVER] Running on http://localhost:${PORT}`);

  const evidenceDir = path.resolve(__dirname, 'evidence');
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  const executablePath = '/Users/michaelsaint/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  const browser = await chromium.launch({ headless: true, executablePath });
  const results = [];

  function record(desc, passed, detail = '') {
    results.push({ desc, passed, detail });
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${desc}${detail ? ' (' + detail + ')' : ''}`);
  }

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });

    console.log('\n=== VIEWPORT & ACCESSIBILITY TOKENS ===');
    // 1. Viewport Meta
    const viewportMeta = await page.getAttribute('meta[name="viewport"]', 'content');
    const hasUserScalableNo = viewportMeta.includes('user-scalable=no') || viewportMeta.includes('user-scalable=0');
    record('Viewport zoom enabled (no user-scalable=no)', !hasUserScalableNo, viewportMeta);

    // 2. Contrast checks. These read the REAL design tokens from the rendered
    // page. (The previous version computed ratios from hex literals typed into
    // this file, so it could never fail when the stylesheet changed.)
    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const names = ['bg', 'surface', 'surface-2', 'surface-3', 'ink', 'ink-2', 'ink-3', 'accent', 'on-accent',
        'tier-pass', 'tier-watch', 'tier-prime', 'good', 'good-tint', 'caution', 'caution-tint',
        'error', 'error-tint'];
      const out = {};
      for (const n of names) out[n] = cs.getPropertyValue('--' + n).trim();
      return out;
    });
    const missing = Object.entries(tokens).filter(([, v]) => !/^#[0-9a-fA-F]{6}$/.test(v)).map(([k]) => k);
    record('All design tokens resolve to 6-digit hex values on the live page', missing.length === 0, missing.join(', '));
    const textPairs = [
      ['--ink on --bg', tokens.ink, tokens.bg],
      ['--ink-2 (muted text) on --bg', tokens['ink-2'], tokens.bg],
      ['--ink-3 (tertiary text) on --bg', tokens['ink-3'], tokens.bg],
      ['--ink-3 (tertiary text) on --surface', tokens['ink-3'], tokens.surface],
      ['--ink-2 on --surface-3', tokens['ink-2'], tokens['surface-3']],
      ['--accent (links) on --surface', tokens.accent, tokens.surface],
      ['--on-accent on --accent (primary button)', tokens['on-accent'], tokens.accent],
      ['--good (meets-target text) on --surface-2', tokens.good, tokens['surface-2']],
      ['--caution on --caution-tint (sample tags)', tokens.caution, tokens['caution-tint']],
      ['--error on --error-tint (error banner)', tokens.error, tokens['error-tint']],
    ];
    for (const [name, fg, bg] of textPairs) {
      const ratio = contrastRatio(fg, bg);
      record(`${name} satisfies WCAG AA >= 4.5:1`, ratio >= 4.5, `measured ${ratio}:1`);
    }
    for (const [name, key] of [['pass', 'tier-pass'], ['watchlist', 'tier-watch'], ['prime', 'tier-prime']]) {
      const ratio = contrastRatio(tokens[key], tokens.surface);
      record(`Score tier "${name}" marker satisfies non-text contrast >= 3:1 on --surface`, ratio >= 3, `measured ${ratio}:1`);
    }

    console.log('\n=== ATTRIBUTION ENFORCEMENT ===');
    // 3. Desktop attribution
    const desktopHeaderAttribution = await page.locator('header').getByText('Powered by JTF Software Solutions', { exact: false }).first();
    const isDesktopVisible = await desktopHeaderAttribution.isVisible();
    record('Desktop header displays "Powered by JTF Software Solutions"', isDesktopVisible);

    const desktopFooterAttribution = await page.locator('footer').getByText('Powered by JTF Software Solutions', { exact: false }).first();
    const isFooterVisible = await desktopFooterAttribution.isVisible();
    record('Desktop footer displays "Powered by JTF Software Solutions"', isFooterVisible);

    await page.screenshot({ path: path.join(evidenceDir, 'evidence_desktop.png') });

    // 4. Mobile viewport attribution
    console.log('\n=== MOBILE VIEWPORT (375x667) ATTRIBUTION ===');
    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });

    const mobileHeaderAttribution = await mobilePage.locator('header').getByText('Powered by JTF Software Solutions', { exact: false }).first();
    const isMobileVisible = await mobileHeaderAttribution.isVisible();
    record('Mobile (375px) header displays "Powered by JTF Software Solutions" without suppression', isMobileVisible);

    await mobilePage.screenshot({ path: path.join(evidenceDir, 'evidence_mobile.png') });
    await mobileContext.close();

    console.log('\n=== RESPONSIVE REFLOW: NO HORIZONTAL OVERFLOW ===');
    for (const width of [320, 375, 390, 414, 768, 1024, 1440]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 700 });
      const rp = await ctx.newPage();
      await rp.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
      const measure = () => rp.evaluate(() => {
        const W = document.documentElement.clientWidth;
        const offenders = [];
        document.querySelectorAll('body *').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > W + 1 && getComputedStyle(el).position !== 'fixed') {
            offenders.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]);
          }
        });
        return { W, scrollWidth: document.documentElement.scrollWidth, offenders: offenders.slice(0, 5) };
      });
      const closed = await measure();
      await rp.locator('article.card button[aria-expanded]').first().click();
      const expanded = await measure();
      const clean = m => m.scrollWidth <= m.W && m.offenders.length === 0;
      record(`${width}px: no horizontal scroll and nothing clipped past the edge (cards closed and expanded)`,
        clean(closed) && clean(expanded), JSON.stringify(clean(closed) ? expanded : closed));
      await ctx.close();
    }

    console.log('\n=== ATTRIBUTION IN CSV AND PRINT OUTPUT ===');
    const csvText = await page.evaluate(() => toCSV(P0_SEED_EVENTS.slice(0, 2), DEFAULT_A, 'TEST MARKET'));
    const csvLines = csvText.split('\r\n');
    record('CSV export ends with the "Powered by JTF Software Solutions" footer row', /Powered by JTF Software Solutions/.test(csvLines[csvLines.length - 1]));
    await page.emulateMedia({ media: 'print' });
    record('Print output keeps the attribution in the header', await page.locator('header').getByText('Powered by JTF Software Solutions', { exact: false }).first().isVisible());
    record('Print output keeps the attribution in the footer', await page.locator('footer').getByText('Powered by JTF Software Solutions', { exact: false }).first().isVisible());
    record('Print output hides interactive chrome (finder, export bar, panel buttons)',
      !(await page.locator('aside.finder').isVisible()) && !(await page.locator('.export-bar').isVisible()) && !(await page.locator('.hdr-actions').isVisible()));
    record('Print output still shows the opportunity cards', await page.locator('article.card').first().isVisible());
    await page.emulateMedia({ media: 'screen' });

    console.log('\n=== EVENT DETAIL AND CALENDAR RECOVERY ===');
    const detailToggle = page.locator('article.card button[aria-expanded]').first();
    await detailToggle.click();
    record('Event details expand without tearing down the application', await detailToggle.getAttribute('aria-expanded') === 'true');
    const calendarLink = page.locator('article.card a[href^="https://calendar.google.com/calendar/render?"]').first();
    const calendarUrl = new URL(await calendarLink.getAttribute('href'));
    record('Expanded details provide a Google Calendar draft link', calendarUrl.searchParams.get('action') === 'TEMPLATE');
    const calendarDates = await page.evaluate(() => {
      const url = new URL(buildGoogleCalUrl({ name: 'Calendar boundary check', sd: '2026-12-31', ed: '2027-01-02' }, DEFAULT_A));
      return { dates: url.searchParams.get('dates'), details: url.searchParams.get('details') };
    });
    record('Calendar all-day end date is exclusive across year boundary', calendarDates.dates === '20261231/20270103');
    record('Calendar draft distinguishes projections and organizer confirmation', calendarDates.details.includes('Model projections') && calendarDates.details.includes('Confirm dates'));
    await detailToggle.click();
    await detailToggle.focus();
    await page.keyboard.press('Enter');
    record('Card details open from the keyboard (Enter on the focused toggle)', await detailToggle.getAttribute('aria-expanded') === 'true');
    await page.keyboard.press('Space');
    record('Card details close from the keyboard (Space on the focused toggle)', await detailToggle.getAttribute('aria-expanded') === 'false');

    console.log('\n=== ACCESSIBLE MODAL DIALOGS & FOCUS TRAPPING ===');
    // 5. Modal Dialogs: SCORING, COVERAGE, MODEL
    const dialogTests = [
      { name: 'SCORING', selector: 'button[aria-controls="modal-scoring"]', titleId: 'scoring-dialog-title' },
      { name: 'COVERAGE', selector: 'button[aria-controls="modal-coverage"]', titleId: 'coverage-dialog-title' },
      { name: 'MODEL', selector: 'button[aria-controls="modal-model"]', titleId: 'model-dialog-title' }
    ];

    for (const d of dialogTests) {
      const trigger = page.locator(d.selector).first();
      await trigger.click();
      await page.waitForTimeout(200);

      // Verify role="dialog" and aria-modal="true"
      const dialog = page.locator('div[role="dialog"]');
      const hasRoleDialog = await dialog.isVisible();
      const ariaModal = await dialog.getAttribute('aria-modal');
      const ariaLabelledby = await dialog.getAttribute('aria-labelledby');
      record(`${d.name} drawer has role="dialog" and aria-modal="true"`, hasRoleDialog && ariaModal === 'true');
      record(`${d.name} drawer is labeled by title id`, ariaLabelledby === d.titleId);

      // Verify close button exists
      const closeBtn = dialog.locator('button[aria-label*="Close"]').first();
      const hasCloseBtn = await closeBtn.isVisible();
      record(`${d.name} drawer has accessible close button`, hasCloseBtn);

      // Check focus is inside modal
      const activeInside = await page.evaluate(() => {
        const dialogEl = document.querySelector('div[role="dialog"]');
        return dialogEl && dialogEl.contains(document.activeElement);
      });
      record(`${d.name} drawer contains initial focus`, activeInside);

      if (d.name === 'MODEL') {
        // A synthetic noncredential exercises the controlled input rerender;
        // do not click Test Link or submit a request.
        const keyInput = dialog.locator('input[type="password"]').first();
        await keyInput.fill('SYNTHETIC-NONCREDENTIAL-FOCUS-CHECK');
        await page.waitForTimeout(50);
        const inputFocusRetained = await page.evaluate(() => {
          const input = document.querySelector('#modal-model input[type="password"]');
          return document.activeElement === input && input?.closest('[role="dialog"]') != null;
        });
        record('Model Link keeps key input focused while typing after rerender', inputFocusRetained);
        await keyInput.fill('');

        // Selecting a provider updates App state. The modal must retain focus
        // through that rerender; this does not call the provider or use a key.
        const providerSwitch = dialog.getByRole('button', { name: 'OpenRouter', exact: true });
        await providerSwitch.click();
        await page.waitForTimeout(50);
        const focusRetained = await page.evaluate(() =>
          document.activeElement?.textContent?.trim() === 'OpenRouter'
          && document.activeElement?.closest('[role="dialog"]') != null
        );
        record('Model Link keeps focus on provider control after rerender', focusRetained);
      }

      if (d.name === 'SCORING') {
        await page.screenshot({ path: path.join(evidenceDir, 'evidence_modal_scoring.png') });
      }

      // Test Escape key dismissal and focus restoration
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      const isClosed = !(await dialog.isVisible());
      record(`${d.name} drawer dismisses on Escape key`, isClosed);

      // Verify focus restored to trigger
      const focusRestored = await page.evaluate((sel) => {
        const targetBtn = document.querySelector(sel);
        return document.activeElement === targetBtn;
      }, d.selector);
      record(`${d.name} trigger button restores focus upon close`, focusRestored);
    }

    console.log('\n=== HONEST LOADING & EMPTY STATES ===');
    // 6. Context-aware empty state / search bar
    const searchInput = page.locator('input[aria-label="Market"]').first();
    const hasSearchInput = await searchInput.isVisible();
    record('Search input is present and ready for interaction', hasSearchInput);

    // Initial load renders seed cards
    const initialCardCount = await page.locator('article.card').count();
    record('Initial load renders verified seed event cards', initialCardCount > 0, `${initialCardCount} cards displayed`);

    console.log('\n=== EVENT TYPES MULTI-SELECT, SCORE BADGE, DEMO SWITCH ===');
    const typesSummary = page.locator('details.types > summary');
    record('Event types start collapsed and summarise the selection as "All 12"',
      !(await page.locator('details.types').evaluate(el => el.open)) && (await typesSummary.innerText()).includes('All 12'));
    await typesSummary.click();
    const typeBoxes = page.locator('details.types input[type="checkbox"]');
    record('Event types expose twelve real checkboxes', await typeBoxes.count() === 12, `${await typeBoxes.count()} found`);
    await typeBoxes.first().uncheck();
    record('Unchecking one type updates the count to "11 of 12"', (await typesSummary.innerText()).includes('11 of 12'));
    await page.locator('details.types').getByRole('button', { name: 'Clear', exact: true }).click();
    record('Clear empties the selection and says it searches all types', (await typesSummary.innerText()).includes('None (searches all)'));
    await page.locator('details.types').getByRole('button', { name: 'Select all', exact: true }).click();
    record('Select all restores "All 12"', (await typesSummary.innerText()).includes('All 12'));
    await typesSummary.click();

    const badgeLabel = await page.locator('article.card .score').first().getAttribute('aria-label');
    record('Score badge exposes number and tier to assistive tech', /^Score \d{1,3} out of 100, (Prime|Watchlist|Pass)$/.test(badgeLabel || ''), badgeLabel);
    const demoSwitch = page.locator('aside.finder button[role="switch"]');
    const demoBefore = await demoSwitch.getAttribute('aria-checked');
    await demoSwitch.click();
    const demoAfter = await demoSwitch.getAttribute('aria-checked');
    await demoSwitch.click();
    record('Demo data is a real switch that toggles aria-checked', demoBefore === 'false' && demoAfter === 'true' && await demoSwitch.getAttribute('aria-checked') === 'false');
    record('Truthfulness note is visible beside the projections',
      await page.locator('p.note').getByText('Leads and revenue are model projections.', { exact: false }).isVisible());

    // Now test searching for a remote market with no seed signals (e.g. ANCHORAGE, AK)
    await searchInput.fill('ANCHORAGE, AK');
    const scoutBtn = page.locator('button:has-text("SCOUT")').first();
    await scoutBtn.click();
    await page.waitForTimeout(1000);

    // If Model Link drawer opened to prompt user for key, verify prompt and close it
    const modelDrawer = page.locator('div[role="dialog"]');
    const promptVisible = await modelDrawer.isVisible();
    record('Unconfigured scout honestly prompts Model Link dialog', promptVisible);
    if (promptVisible) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    // Context-aware empty state should now be displayed
    const emptyStateHeading = page.locator('text=NO QUALIFYING SIGNALS IN ANCHORAGE, AK');
    const hasEmptyState = await emptyStateHeading.isVisible();
    record('Context-aware empty state renders for zero-match query', hasEmptyState);

    // 1-click radius expander should be visible in empty state
    const expandRadiusBtn = page.locator('button:has-text("EXPAND RADIUS TO 100 MI")');
    const hasExpandBtn = await expandRadiusBtn.isVisible();
    record('Empty state contains 1-click radius expander button', hasExpandBtn);

    // Dismissible error banner should be visible
    const alertBanner = page.locator('div[role="alert"]');
    const hasAlert = await alertBanner.isVisible();
    record('Honest dismissible alert banner displays for unconfigured model guidance', hasAlert);

    let isDismissed = false;
    if (hasAlert) {
      const dismissBtn = alertBanner.locator('button[aria-label*="Dismiss error"]').first();
      await dismissBtn.click();
      await page.waitForTimeout(200);
      isDismissed = !(await alertBanner.isVisible());
    }
    record('Error banner dismisses on click', isDismissed);

    await page.screenshot({ path: path.join(evidenceDir, 'evidence_empty_state.png') });

    // Total results
    const totalPassed = results.filter(r => r.passed).length;
    const totalFailed = results.filter(r => !r.passed).length;
    console.log(`\n=== RESULTS: ${totalPassed}/${results.length} checks passed (${totalFailed} failed) ===`);

    if (totalFailed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

runVerification();
