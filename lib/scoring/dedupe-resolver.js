/**
 * Canonical Deduplication and Entity Resolution Engine
 */

export function normalizeEventTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/\b(202[4-9]|annual|\d+(st|nd|rd|th))\b/gi, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateSimilarity(s1, s2) {
  const words1 = new Set(s1.split(" ").filter(w => w.length > 2));
  const words2 = new Set(s2.split(" ").filter(w => w.length > 2));
  if (!words1.size || !words2.size) return 0;
  
  let match = 0;
  for (const w of words1) {
    if (words2.has(w)) match++;
  }
  return match / Math.max(words1.size, words2.size);
}

export function deduplicateEvents(events) {
  const merged = [];

  for (const event of events) {
    const normTitle = normalizeEventTitle(event.title || event.name);
    const date = (event.start_at || event.sd || "").slice(0, 10);
    const city = String(event.venue?.city || event.city || "").toLowerCase();

    let matchIdx = -1;

    for (let i = 0; i < merged.length; i++) {
      const existing = merged[i];
      const exNormTitle = normalizeEventTitle(existing.title || existing.name);
      const exDate = (existing.start_at || existing.sd || "").slice(0, 10);
      const exCity = String(existing.venue?.city || existing.city || "").toLowerCase();

      // Check date proximity (same or within 1 day)
      const isDateClose = date === exDate;
      const isCityMatch = city === exCity || city.includes(exCity) || exCity.includes(city);
      const titleSim = calculateSimilarity(normTitle, exNormTitle);

      if (titleSim >= 0.60 && (isDateClose || isCityMatch)) {
        matchIdx = i;
        break;
      }
    }

    if (matchIdx >= 0) {
      // Merge into existing canonical entity, preserving richest metadata
      const target = merged[matchIdx];
      // Keep application URL if existing lacks it
      if (!target.vendor_opportunity?.application_url && event.vendor_opportunity?.application_url) {
        target.vendor_opportunity.application_url = event.vendor_opportunity.application_url;
      }
      if (!target.vendor_opportunity?.application_deadline && event.vendor_opportunity?.application_deadline) {
        target.vendor_opportunity.application_deadline = event.vendor_opportunity.application_deadline;
      }
      if (!target.organizer?.contact_email && event.organizer?.contact_email) {
        target.organizer.contact_email = event.organizer.contact_email;
      }
      // Track multi-source provenance
      target.sources = target.sources || [target.source?.url || ""];
      if (event.source?.url && !target.sources.includes(event.source.url)) {
        target.sources.push(event.source.url);
      }
    } else {
      merged.push({ ...event });
    }
  }

  return merged;
}
