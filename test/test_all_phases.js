/**
 * Comprehensive Acceptance Test Suite for National Field Opportunity Intelligence Graph
 */

import { createCanonicalEvent, EVENT_TYPES } from "../lib/canonical-schema.js";
import { scoreEvent, VERTICAL_WEIGHTS } from "../lib/scoring/opportunity-scoring.js";
import { deduplicateEvents, normalizeEventTitle } from "../lib/scoring/dedupe-resolver.js";
import { enrichWithCensusHousing } from "../lib/enrichment/census-acs.js";
import { calculateCoverageMetrics } from "../lib/coverage/coverage-dashboard.js";
import { parseCivicPlusXml } from "../lib/adapters/civicplus-rss.js";

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}`);
    failed++;
  }
}

console.log("=== FIELDRADAR NATIONAL EXPANSION ACCEPTANCE SUITE ===");

// 1. Canonical Schema Test
const rawSample = {
  name: "2026 Greater Gulf State Fair",
  type: "County Fair/Festival",
  city: "Mobile, AL",
  venue: "The Grounds",
  sd: "2026-10-30",
  ed: "2026-11-08",
  att: 140000,
  ho: 0.65,
  bc: 800,
  app_url: "https://thegrounds.com/vendors",
  app_deadline: "2026-09-01",
  org: "The Grounds Inc",
  rules: "Commercial exhibit booths"
};

const canonical = createCanonicalEvent(rawSample);
check("Canonical event title preserved", canonical.title === "2026 Greater Gulf State Fair");
check("Event type in canonical taxonomy", EVENT_TYPES.includes(canonical.event_type));
check("Attendance estimates parsed", canonical.attendance.estimated === 140000);
check("Vendor opportunity status open", canonical.vendor_opportunity.status === "open");
check("Application URL mapped", canonical.vendor_opportunity.application_url === "https://thegrounds.com/vendors");
check("Deadline mapped", canonical.vendor_opportunity.application_deadline === "2026-09-01");

// 2. Multi-Vertical Opportunity Scoring Test
const roofScore = scoreEvent(canonical, "roofing");
check("Roofing score calculated between 0-100", roofScore.total_score >= 0 && roofScore.total_score <= 100);
check("Verdict matches threshold", roofScore.verdict === "Strongly Recommended" || roofScore.verdict === "Conditional");
check("Projected leads positive", roofScore.projected_leads.expected > 0);
check("Economics CPL calculated", roofScore.economics.cpl > 0);
check("Projected revenue positive", roofScore.economics.projected_revenue > 0);

const gutterScore = scoreEvent(canonical, "gutters");
check("Gutter vertical scoring adjusts economics", gutterScore.economics.projected_revenue !== roofScore.economics.projected_revenue);

const solarScore = scoreEvent(canonical, "solar");
check("Solar vertical target leads adjusted", solarScore.projected_leads.expected > 0);

// 3. Deduplication & Entity Resolution Test
const eventA = createCanonicalEvent({
  title: "Dallas Home and Garden Show 2026",
  city: "Dallas, TX",
  start_at: "2026-09-18",
  app_url: "https://dallashomeshow.com/apply"
});

const eventB = createCanonicalEvent({
  title: "The Annual Dallas Home & Garden Show",
  city: "Dallas, TX",
  start_at: "2026-09-18",
  src: "https://eventbrite.com/e/dallas-home-show"
});

const eventC = createCanonicalEvent({
  title: "Austin Home and Garden Show",
  city: "Austin, TX",
  start_at: "2026-10-15"
});

const deduped = deduplicateEvents([eventA, eventB, eventC]);
check("Duplicates merged correctly (3 -> 2 events)", deduped.length === 2);
check("Application URL preserved during merge", deduped[0].vendor_opportunity.application_url === "https://dallashomeshow.com/apply");

// 4. Census ACS Housing Enrichment Test
const txHousing = enrichWithCensusHousing("DALLAS, TX");
check("Dallas median home value enriched", txHousing.medianHomeVal === "$390K");
check("Dallas owner occupancy rate > 60%", txHousing.ownerPct >= 0.60);

const alHousing = enrichWithCensusHousing("FAIRHOPE, AL");
check("Fairhope median home value enriched", alHousing.medianHomeVal === "$450K");
check("Fairhope owner occupancy rate >= 80%", alHousing.ownerPct >= 0.80);

// 5. CivicPlus RSS Parser Test
const mockRssXml = `
<rss version="2.0">
  <channel>
    <title>City of Foley Events</title>
    <item>
      <title><![CDATA[Downtown Heritage Festival]]></title>
      <link>https://cityoffoley.org/events/1</link>
      <description><![CDATA[Annual community festival with local vendors and live music.]]></description>
      <pubDate>Mon, 05 Nov 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
`;

const parsedCivic = parseCivicPlusXml(mockRssXml, "Foley, AL");
check("CivicPlus RSS parsed item", parsedCivic.length === 1);
check("CivicPlus title cleaned", parsedCivic[0].title === "Downtown Heritage Festival");
check("CivicPlus date extracted", parsedCivic[0].start_at === "2026-11-05");

// 6. Coverage Dashboard Metrics Test
const testEventSet = [canonical, eventA, eventC];
const coverage = calculateCoverageMetrics(testEventSet);
check("Coverage total count accurate", coverage.total_events === 3);
check("Vendor actionable rate calculated", coverage.vendor_actionable_rate > 0);
check("State breakdown tracked", coverage.state_breakdown["AL"] === 1 && coverage.state_breakdown["TX"] === 2);

console.log(`\n=== RESULTS: ${passed}/${passed + failed} checks passed ===`);
if (failed > 0) process.exit(1);
