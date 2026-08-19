/**
 * WordPress "The Events Calendar" REST Adapter
 * Hits /wp-json/tribe/events/v1/events on chambers, festivals, and tourism sites
 */

import { createCanonicalEvent } from "../canonical-schema.js";

export async function fetchWordPressTribeEvents(baseUrl, cityDefault = "") {
  try {
    const url = `${baseUrl.replace(/\/+$/, "")}/wp-json/tribe/events/v1/events?per_page=10`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (!res || !res.ok) return [];

    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.events)) return [];

    return data.events.map(ev => {
      return createCanonicalEvent({
        id: "tribe_" + ev.id,
        name: ev.title || "Community Festival",
        type: ev.categories?.some(c => /fair|festival/i.test(c.name)) ? "County Fair/Festival" : "Community Event",
        city: ev.venue?.city ? `${ev.venue.city}, ${ev.venue.state || ""}` : cityDefault,
        venue: ev.venue?.venue || "Local Festival Grounds",
        sd: (ev.start_date || "").slice(0, 10),
        ed: (ev.end_date || ev.start_date || "").slice(0, 10),
        att: 6000,
        ho: 0.68,
        bc: 250,
        src: ev.url || baseUrl,
        app_url: ev.url || baseUrl,
        app_deadline: "Open",
        v_status: "open",
        org: ev.organizer?.[0]?.organizer || "Festival Committee",
        org_contact: ev.organizer?.[0]?.email || ev.organizer?.[0]?.phone || "",
        home_val: "$350K",
        rules: "Standard local vendor regulations.",
        note: (ev.excerpt || "").replace(/<[^>]+>/g, "").slice(0, 100),
        data: "tribe_events_rest"
      });
    });
  } catch (err) {
    console.warn("WordPress Tribe Events adapter error:", err);
    return [];
  }
}
