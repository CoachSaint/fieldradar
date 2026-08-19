# 📡 FieldRadar — National Field Event Targeting & Vendor Intelligence Terminal

**Production Terminal:** [https://fieldradar-terminal.vercel.app](https://fieldradar-terminal.vercel.app)

FieldRadar is an intelligent field event sourcing, geographic geofencing, and ROI scoring terminal built for residential contractors, exterior remodelers (roofing, windows, gutters, solar), and home-services sales teams.

---

## 🚀 Key Features

* **⚡ Instant National Market & ZIP Autocomplete:** 0ms fuzzy search across 200+ top US metros, counties, and 5-digit ZIP codes with standardized state anchoring.
* **📐 Strict Haversine Geo-Separator Engine:** Mathematical distance filtering down to 0.1 miles using real GPS coordinates. Eliminates cross-state city name bleed (e.g. Greenville SC vs TX).
* **🌾 Comprehensive Event Discovery Spectrum:**
  * Major Home & Remodeling Expos (Nationwide Expos, ACS, Marketplace Events)
  * Weekly & Weekend Farmers Markets (USDA & Municipal)
  * County & State Agricultural Fairs & Festivals
  * Community & HOA Subdivision Yard Sale Trails ($0 booth cost, 100% homeowners)
  * Car Shows, Rod Runs & Cruise-Ins (High disposable income & garage investment)
  * Craft Shows, Makers Markets & Holiday Bazaars
  * Mega Flea Markets & Swap Meets (Canton First Monday, Traders Village)
  * B2B & Chamber Real Estate / Contractor Expos
* **💼 "Can I Work This Event?" Vendor Intelligence:** Direct organizer application links, registration deadlines, status badges, booth costs, organizer contacts, and housing demographics (median home value & owner occupancy rate).
* **📊 Multi-Vertical ROI Opportunity Scoring:** Algorithmic ranking engine adapted from home-services production workbook math for Roofing, Windows/Doors, Gutters, and Solar.
* **📅 Multi-Format Export:** 1-click CSV export with complete vendor schema and calendar (.ics) generation.

---

## 🛠️ Architecture & Tech Stack

```
fieldradar/
├── api/
│   └── ai.js               # Vercel Serverless OpenRouter LLM scout with live web search
├── lib/
│   ├── canonical-schema.js # Canonical data model & validator
│   ├── adapters/
│   │   ├── major-promoters.js     # Nationwide Expos, ACS, Marketplace Events
│   │   ├── eventbrite-discovery.js # Eventbrite public vendor markets
│   │   ├── usda-local-food.js     # USDA Farmers Market Portal API
│   │   ├── socrata-soda.js        # City Open Data permit feeds
│   │   ├── civicplus-rss.js       # Municipal civic calendar RSS parser
│   │   └── wordpress-tribe.js     # WP The Events Calendar REST API
│   ├── scoring/
│   │   ├── opportunity-scoring.js # Multi-vertical CPL / ROI math
│   │   └── dedupe-resolver.js    # Geo-spatial & Levenshtein entity resolution
│   ├── enrichment/
│   │   └── census-acs.js          # US Census ACS median home value & owner occupancy
│   └── coverage/
│       └── coverage-dashboard.js  # National coverage gap tracker
├── public/
│   └── index.html          # High-speed reactive terminal UI + interactive radar
├── data_seed.json          # Curated master P0 database (86+ verified booth opportunities)
└── test/
    └── test_all_phases.js  # Automated test suite (25/25 checks passing)
```

---

## 🧪 Testing & Verification

Run the full automated test suite:
```bash
node test/test_all_phases.js
```

---

## 🌐 Deployment

Deployed serverless on Vercel:
```bash
npx vercel deploy --prod
```
