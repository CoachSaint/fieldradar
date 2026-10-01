# FieldRadar — Field Opportunity Desk

Powered by JTF Software Solutions

A single-page desk for deciding which local events a home-services sales team should work (roofing is the configured vertical): find events near a market, see whether a booth is open to you, and model the return before you commit.

Live site: [fieldradar-terminal.vercel.app](https://fieldradar-terminal.vercel.app) (the Vercel project keeps its old name).

## What it does

* **Find events near a market.** Type a city or ZIP; the page filters the bundled catalog by distance (Haversine, real coordinates) and event type.
* **Bundled catalog.** `data_seed.json` is 103 curated events across 13 event types (county fairs, farmers markets, home shows, car shows, swap meets, B2B expos and more), each with application link, deadline, organizer, booth cost, attendance and a home-value note. It is a static list, not a live feed, and all 103 events are in Alabama, Texas, Georgia and Tennessee.
* **Score and model.** Each event gets a 0–100 score and a tier (Prime, Watchlist, Pass), plus a projection of leads, spend and revenue from assumptions you can adjust. Projections are modeled, not measured.
* **Game plans.** Template game plans work with Demo data on. Live web scouting and AI game plans run from your own Anthropic or OpenRouter key, in your browser.
* **Export.** CSV and calendar (.ics / Google Calendar) export.

The **Sources & coverage** drawer lists exactly which sources this build uses and which are not connected. It is generated from the code and checked by `test/coverage-claims.test.js`.

## What it does not do

* **Hosted AI is unavailable.** `api/ai.js` refuses every request with HTTP 503 (`HOSTED_AI_UNAVAILABLE`): this build has no server-side identity or spend limits. The page never calls it; use Model link with your own key.
* **The `lib/` adapters are not wired in.** USDA, Socrata, CivicPlus, WordPress Tribe, Eventbrite, promoter networks and Census ACS enrichment exist as modules with tests, but nothing in the app or API calls them. The app does not import `lib/` at all, so its scoring is its own code (roofing only), not `lib/scoring`.
* **Live network calls are only** market and ZIP lookup (OpenStreetMap Nominatim, Zippopotam.us) and the AI call made with your own key. The built-in market list has 53 entries; anything else goes to the lookup.

## Layout

```
api/ai.js                 hosted-AI endpoint: always 503
lib/                      adapters, scoring, dedupe, enrichment, coverage (tested, not used by the app)
public/index.html         the whole app (React 18 UMD + inline JSX, no build step)
data_seed.json            bundled catalog, 103 events
test/                     test_all_phases.js, ai-boundary.test.js, coverage-claims.test.js, verify_ui_readiness.cjs
scripts/                  capture-screenshots.cjs, axe-check.cjs
docs/redesign-2026-10/    design direction, test changes, screenshots
```

## Checks

```bash
node test/test_all_phases.js        # lib/ modules (25 checks)
node test/ai-boundary.test.js       # hosted AI stays unavailable (503)
node test/coverage-claims.test.js   # the coverage drawer claims only what the code shows
node test/verify_ui_readiness.cjs   # rendered UI: function, keyboard, contrast, reflow (Playwright)
node scripts/axe-check.cjs          # accessibility scan (axe-core, needs Playwright)
```

The three Playwright scripts (including `scripts/capture-screenshots.cjs`) need Playwright (`NODE_PATH`) and use a Chrome path hard-coded in the script. `package.json` has no `test` script, so nothing runs these automatically.

## Deploy

Static site plus one function on Vercel (`vercel.json` has rewrites only).
