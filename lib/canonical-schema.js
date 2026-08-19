/**
 * Canonical Data Model for JTF Field Opportunity Intelligence Graph
 * Spec: JTF_FIELD_EVENTS_NATIONAL_DATA_EXPANSION_AGY_HANDOFF_2026-08-18
 */

export const EVENT_TYPES = [
  "Home Show",
  "Outdoor/Lifestyle Expo",
  "County Fair/Festival",
  "Trade/Builder Event",
  "Sports/Family Event",
  "Community Event",
  "Farmers Market",
  "Estate/Yard Sale",
  "Antique/Flea Market"
];

export const VENDOR_STATUSES = [
  "open",
  "closed",
  "waitlist",
  "sold_out",
  "not_allowed",
  "invite_only",
  "unknown"
];

export function createCanonicalEvent(raw) {
  const id = raw.id || "ev_" + Math.random().toString(36).slice(2, 11);
  return {
    id,
    series_id: raw.series_id || null,
    title: String(raw.title || raw.name || "Untitled Event").trim(),
    description: String(raw.description || raw.note || "").trim(),
    event_type: EVENT_TYPES.includes(raw.event_type || raw.type) ? (raw.event_type || raw.type) : "Community Event",
    start_at: raw.start_at || raw.sd || "",
    end_at: raw.end_at || raw.ed || raw.start_at || raw.sd || "",
    venue: {
      name: raw.venue?.name || raw.venue || "Venue TBD",
      address: raw.venue?.address || raw.address || "",
      city: raw.city || "",
      state: (raw.state || raw.s || "").toUpperCase(),
      postal_code: raw.postal_code || raw.zip || "",
      lat: Number(raw.lat || (raw.venue && raw.venue.lat)) || null,
      lng: Number(raw.lng || (raw.venue && raw.venue.lng)) || null,
    },
    attendance: {
      claimed: Number(raw.attendance_claimed || raw.att) || 5000,
      estimated: Number(raw.attendance_estimated || raw.att) || 5000,
      low: Number(raw.lo) || Math.round((Number(raw.att) || 5000) * 0.8),
      high: Number(raw.hi) || Math.round((Number(raw.att) || 5000) * 1.2),
      homeowner_pct: Math.max(0, Math.min(1, Number(raw.ho != null ? raw.ho : 0.60))),
    },
    vendor_opportunity: {
      status: VENDOR_STATUSES.includes(raw.v_status || raw.vendor_status) ? (raw.v_status || raw.vendor_status) : "open",
      application_url: raw.app_url || raw.vendor_application_url || raw.src || "",
      application_deadline: raw.app_deadline || raw.application_deadline || "",
      booth_price_min: Number(raw.bc || raw.booth_price_min || raw.booth) || 800,
      booth_price_max: Number(raw.booth_price_max || raw.booth) || 800,
      deposit: Number(raw.deposit) || 0,
      electricity_fee: Number(raw.electricity_fee) || 0,
      corner_fee: Number(raw.corner_fee) || 0,
      insurance_required: Boolean(raw.insurance_required ?? true),
      commercial_allowed: Boolean(raw.commercial_allowed ?? true),
      home_services_allowed: Boolean(raw.home_services_allowed ?? true),
      roofing_allowed: Boolean(raw.roofing_allowed ?? true),
      exclusivity_available: Boolean(raw.exclusivity_available ?? false),
      rules_summary: String(raw.rules || raw.rules_summary || "").trim(),
    },
    organizer: {
      name: raw.org || raw.organizer?.name || "Organizer TBD",
      contact_email: raw.org_email || raw.organizer?.email || "",
      contact_phone: raw.org_phone || raw.organizer?.phone || "",
      website: raw.org_url || raw.organizer?.website || raw.src || "",
    },
    housing_context: {
      median_home_value: raw.home_val || raw.median_home_value || "$350K",
      owner_occupied_pct: Number(raw.owner_occupied_pct) || 0.65,
      median_home_age_years: Number(raw.median_home_age_years) || 22,
      storm_event_proximity_miles: Number(raw.storm_proximity_mi) || null,
      hail_history_6mo: Boolean(raw.hail_history_6mo ?? false),
    },
    source: {
      name: raw.source_name || raw.data || "live_scout",
      url: raw.src || raw.u || "",
      confidence: Number(raw.confidence) || 0.90,
      discovered_at: raw.discovered_at || new Date().toISOString(),
      is_predicted: Boolean(raw.is_predicted ?? false),
    },
    game_plan: raw.plan || null,
  };
}
