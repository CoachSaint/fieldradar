/**
 * National Coverage Dashboard & Data-Ops Gap Detector
 * Evaluates dataset completeness across categories, states, and vendor actionable rates
 */

export function calculateCoverageMetrics(events) {
  const total = events.length;
  if (total === 0) {
    return {
      total_events: 0,
      vendor_actionable_rate: 0,
      homeowner_dense_count: 0,
      category_breakdown: {},
      state_breakdown: {},
      coverage_holes: ["No events loaded"]
    };
  }

  let withAppUrl = 0;
  let withDeadline = 0;
  let withContact = 0;
  let primeCount = 0;

  const categoryBreakdown = {};
  const stateBreakdown = {};

  for (const ev of events) {
    const type = ev.event_type || ev.type || "Community Event";
    categoryBreakdown[type] = (categoryBreakdown[type] || 0) + 1;

    const city = ev.venue?.city || ev.city || "";
    const stateMatch = city.match(/\b([A-Z]{2})\b/);
    const st = stateMatch ? stateMatch[1] : "US";
    stateBreakdown[st] = (stateBreakdown[st] || 0) + 1;

    if (ev.vendor_opportunity?.application_url || ev.appUrl) withAppUrl++;
    if (ev.vendor_opportunity?.application_deadline || ev.appDeadline) withDeadline++;
    if (ev.organizer?.contact_email || ev.orgContact) withContact++;
  }

  const coverageHoles = [];
  if (!categoryBreakdown["Home Show"]) coverageHoles.push("Missing Home & Garden Shows");
  if (!categoryBreakdown["County Fair/Festival"]) coverageHoles.push("Missing County Fairs");
  if (!categoryBreakdown["Farmers Market"]) coverageHoles.push("Missing Farmers Markets");

  return {
    total_events: total,
    vendor_actionable_rate: Math.round((withAppUrl / total) * 100),
    deadline_tracked_rate: Math.round((withDeadline / total) * 100),
    contact_verified_rate: Math.round((withContact / total) * 100),
    category_breakdown: categoryBreakdown,
    state_breakdown: stateBreakdown,
    coverage_holes: coverageHoles
  };
}
