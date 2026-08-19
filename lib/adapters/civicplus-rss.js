/**
 * CivicPlus Municipal Calendar RSS Adapter
 * Extracts events from city and county CivicPlus RSS feeds (Calendar.aspx / rss.aspx)
 */

import { createCanonicalEvent } from "../canonical-schema.js";

export function parseCivicPlusXml(xmlText, cityDefault = "") {
  const events = [];
  const items = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const item of items.slice(0, 10)) {
    const titleMatch = item.match(/<title>(.*?)<\/title>/i);
    const linkMatch = item.match(/<link>(.*?)<\/link>/i);
    const descMatch = item.match(/<description>([\s\S]*?)<\/description>/i);
    const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/i);

    const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "City Community Event";
    const link = linkMatch ? linkMatch[1].trim() : "";
    const desc = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim() : "";
    
    let dateStr = new Date().toISOString().slice(0, 10);
    if (pubDateMatch) {
      const d = new Date(pubDateMatch[1]);
      if (!isNaN(d.getTime())) dateStr = d.toISOString().slice(0, 10);
    }

    events.push(createCanonicalEvent({
      id: "civic_" + Math.random().toString(36).slice(2, 9),
      name: title,
      type: "Community Event",
      city: cityDefault,
      venue: "City Park / Municipal Facility",
      sd: dateStr,
      att: 3500,
      ho: 0.70,
      bc: 150,
      src: link,
      app_url: link,
      app_deadline: "Rolling",
      v_status: "open",
      org: "City Parks & Recreation",
      org_contact: "",
      home_val: "$330K",
      rules: "City sponsored public gathering.",
      note: desc.slice(0, 120),
      data: "civicplus_rss"
    }));
  }

  return events;
}
