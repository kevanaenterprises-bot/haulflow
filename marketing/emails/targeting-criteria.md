# HaulFlow Founding Free Tier — Targeting Criteria

## Objective
Identify 12 Android-using owner-operators / small fleet owners (1–5 trucks) to sign up for HaulFlow's founding free tier: $0/month for 12 months (normally $150/mo).

## Lead Source
**FMCSA Census Lead Engine** — located at `~/haulflow-leads/`

---

## FMCSA Filter Criteria

### Hard Filters (MUST match all)

| Filter | Value | Rationale |
|---|---|---|
| **Number of Power Units** | 1–5 | Small carrier / owner-operator sweet spot |
| **Authority Status** | Active (not inactive, revoked, or pending) | Must be actively hauling to benefit from a TMS |
| **Carrier Operation** | For-Hire (not private) | For-hire carriers need dispatch, invoicing, and broker management |
| **Entity Type** | Individual, LLC, Partnership, Sole Prop | Small operator structures; exclude corporations (10+ trucks typically) |
| **US DOT Status** | Active | Verify the carrier is currently operating under active DOT registration |
| **MCS-150 Date** | Updated within last 24 months | Carriers who filed recently are active; stale filings suggest out-of-business |

### Soft Filters (PREFER but not required)

| Filter | Value | Rationale |
|---|---|---|
| **Cargo Carried** | General Freight (FT), or any combination | General freight operators benefit most from flexible dispatch |
| **Hazmat** | No preference (exclude HM-only if they don't need TMS) | HM carriers may have specialized needs beyond v1 |
| **Years in Operation** | 1–10 years | New enough to want better tools; established enough to have volume |
| **MCS-150 Form Type** | New Entrant or Biennial Update | Either works; new entrants often need systems most |

### Exclusion Filters (DO NOT email)

| Filter | Value | Rationale |
|---|---|---|
| **Power Units** | 6+ | Too large for founding tier positioning |
| **Authority Status** | Inactive, Revoked, Pending | No value from a TMS if not hauling |
| **Out of Service Date** | Any | Do not contact carriers under OOS orders |

---

## Android-Optimized Geographic Targeting

### Tier 1 States (Highest Android Adoption — Primary Target)

These states have the highest Android market share in the US (55–65%+):

- **Midwest / Great Plains:** Oklahoma, Iowa, Nebraska, Kansas, Indiana, Ohio, Missouri, Wisconsin, Michigan, Illinois, Minnesota, South Dakota, North Dakota
- **South / Southeast:** Arkansas, Mississippi, Alabama, Louisiana, Tennessee, Kentucky, West Virginia, Georgia, South Carolina
- **Mountain West:** Wyoming, Montana, Idaho, Utah, Colorado
- **Southwest:** Texas, New Mexico, Arizona

### Tier 2 States (Moderate Android — Secondary Target)

Android market share 50–55%:

- **Mid-Atlantic:** Pennsylvania, Virginia, North Carolina
- **Northeast (limited):** Maine, New Hampshire, Vermont
- **West:** Nevada, Oregon, Washington

### Tier 3 States (Low Android / iOS-Dominant — Avoid or Deprioritize)

Android market share below 50%:

- **Northeast Corridor:** New York, New Jersey, Massachusetts, Connecticut, Rhode Island, Maryland, Delaware, Washington DC
- **West Coast:** California, Hawaii, Alaska

**Recommendation:** Build initial lead list from Tier 1 states first. If volume is insufficient, expand to Tier 2.

---

## Contact Enrichment Checklist

Before sending, verify each lead has:

- [ ] **Valid email address** (preferably a business/domain email, not free Gmail/Yahoo)
- [ ] **Phone number** (for future SMS follow-up if email doesn't convert)
- [ ] **Company name** (personalize email body)
- [ ] **City, State** (personalize email body)
- [ ] **Power unit count** (confirm 1–5 range; personalize with specific number)
- [ ] **MC/DOT number** (include in tracking/campaign records)

---

## List Building Process

1. **Export from FMCSA Census Engine** (`~/haulflow-leads/`)
   - Apply all hard filters above
   - Filter by Tier 1 states first (pull 500–1,000 leads minimum for 12 conversions)
2. **De-duplicate** against any existing contacts in CRM
3. **Enrich** — fill missing email/phone data using:
   - FMCSA Safer website (safetydata.fmcsa.dot.gov)
   - Company website contact pages
   - Google Maps business listings
4. **Segment** for testing:
   - Segment A: 1 truck (owner-operator)
   - Segment B: 2–3 trucks (small fleet)
   - Segment C: 4–5 trucks (growing fleet)
5. **Rotate subject lines** across segments to identify what resonates

---

## Campaign Metrics & Targets

| Metric | Target |
|---|---|
| **Lead pool size** | 500–1,000 verified emails |
| **Open rate (Day 0)** | 30–45% (industry avg for cold email) |
| **Click rate (Day 0)** | 3–8% |
| **Reply rate (all emails)** | 2–5% |
| **Signup conversion** | 1–2% of emailed leads |
| **Needed signups** | 12 |
| **Estimated sends needed** | 600–1,200 leads to hit 12 signups |

---

## Compliance Notes

- **CAN-SPAM:** Include physical mailing address of Turtle Logistics LLC in email footer
- **Unsubscribe:** Honor all unsubscribe requests within 10 days (use a reply-to "STOP" mechanism or manual suppression list)
- **FMCSA data usage:** FMCSA census data is public record and permissible for B2B outreach
- **Do Not Call:** This is email-only; if adding SMS later, scrub against DNC list
- **Sender reputation:** Warm up sales@turtlelogisticsllc.com with 20–30 personalized emails/day before blasting; use Outlook SMTP responsibly (max 30 emails/hour, 300/day recommended for Outlook)

---

## Files in This Campaign

| File | Purpose |
|---|---|
| `01-first-outreach.txt` | Day 0 — Intro, founding offer, urgency |
| `02-followup-day3.txt` | Day 3 — Feature deep-dive, social proof |
| `03-final-followup-day7.txt` | Day 7 — Scarcity close, last chance |
| `targeting-criteria.md` | This document — who to email and how to build the list |
