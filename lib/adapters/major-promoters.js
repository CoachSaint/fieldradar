/**
 * Major Home Show Promoters Registry & Adapter
 * Covers: Nationwide Expos, American Consumer Shows (ACS), Marketplace Events, Show Technology, L&L
 */

import { createCanonicalEvent } from "../canonical-schema.js";

export const PROMOTER_NETWORKS = {
  nationwide_expos: {
    name: "Nationwide Expos",
    domain: "nationwideexpos.com",
    vendorUrl: "https://nationwideexpos.com/exhibitors/",
    contactEmail: "info@nationwideexpos.com",
    contactPhone: "(800) 201-4663"
  },
  american_consumer_shows: {
    name: "American Consumer Shows (ACS)",
    domain: "acsshows.com",
    vendorUrl: "https://acsshows.com/exhibit/",
    contactEmail: "info@acsshows.com",
    contactPhone: "(516) 422-8100"
  },
  marketplace_events: {
    name: "Marketplace Events",
    domain: "marketplaceevents.com",
    vendorUrl: "https://marketplaceevents.com/exhibit/",
    contactEmail: "info@marketplaceevents.com",
    contactPhone: "(888) 248-9751"
  },
  show_technology: {
    name: "Show Technology Productions",
    domain: "showtechnology.com",
    vendorUrl: "https://showtechnology.com/exhibit",
    contactEmail: "exhibits@showtechnology.com",
    contactPhone: "(877) 663-6186"
  }
};
