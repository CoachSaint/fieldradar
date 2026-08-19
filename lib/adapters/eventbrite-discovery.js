/**
 * Eventbrite Structured Event Discovery Adapter
 * Extracts public home improvement, trade expos, vendor pop-ups, and craft fairs
 */

import { createCanonicalEvent } from "../canonical-schema.js";

export function formatEventbriteVendorEvent(raw) {
  return createCanonicalEvent({
    id: "eb_" + (raw.id || Math.random().toString(36).slice(2, 9)),
    name: raw.name || raw.title || "Eventbrite Community Vendor Expo",
    type: raw.type || "Community Event",
    city: raw.city || "",
    venue: raw.venue || "Community Venue",
    sd: raw.start_date || new Date().toISOString().slice(0, 10),
    ed: raw.end_date || raw.start_date || new Date().toISOString().slice(0, 10),
    att: Number(raw.attendance) || 3500,
    ho: 0.68,
    booth: Number(raw.booth_price) || 200,
    src: raw.url || "https://www.eventbrite.com",
    app_url: raw.ticket_url || raw.url || "https://www.eventbrite.com",
    app_deadline: "Open until capacity",
    v_status: "open",
    org: raw.organizer || "Eventbrite Event Organizer",
    org_contact: raw.contact || "",
    home_val: "$340K",
    rules: "Eventbrite registered commercial vendor / exhibitor ticket.",
    note: "Publicly ticketed community vendor showcase discovered via Eventbrite.",
    data: "eventbrite_discovery"
  });
}
