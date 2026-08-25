/**
 * The ANSWER KEY for the synthetic fashion-retailer warehouse.
 *
 * Every number here is deliberately planted so the demo is provably correct:
 * the Verifier's rejections and the uplift engine's lift estimates are checked
 * against these values (see ground-truth.ts and the generated GROUND_TRUTH.md).
 *
 * The agents never read this file - they must *discover* these signals from the
 * data through the read-only MCP. This is the teacher's copy.
 */

export const CALENDAR = {
  dataStart: "2024-01-01",
  today: "2026-06-15", // fixed demo date for deterministic fixtures
  churnWindowDays: 90, // no order in the last 90 days => churn risk
} as const;

export const DIMENSIONS = {
  regions: ["West", "East", "South", "Midwest"] as const,
  categories: ["Workwear", "Outerwear", "Footwear", "Accessories", "Activewear"] as const,
  acquisitionChannels: ["paid_search", "paid_social", "organic", "referral"] as const,
  valueTiers: ["vip", "high", "mid", "low"] as const,
};

export const COUNTS = {
  customers: 5000,
  products: 60,
};

/**
 * Seasonality: a strong yearly curve (holiday peak in Nov–Dec, summer trough) plus a
 * mild weekend effect. This is the planted FALSE POSITIVE for time-series naivety -
 * "orders up in Q4!" is seasonality, not a campaign effect. STL must absorb it.
 */
export const SEASONALITY = {
  // multiplier = 1 + yearlyAmplitude*cos(2π(doy - peakDay)/365) + weekend bump
  yearlyAmplitude: 0.8,
  peakDayOfYear: 330, // ~Nov 26 (Black Friday / holiday)
  weekendBump: 0.12,
  expectedQ4LiftPct: 0.32, // a naive analyst would "find" ~+32% in Q4 vs the yearly mean
} as const;

/**
 * Upcoming product drops (launch "next week" relative to TODAY) - makes the
 * new-product-launch recommendation actionable.
 */
export const UPCOMING_DROPS = [
  { collection: "Fall Flagship", launchDate: "2026-06-22", category: "Outerwear" },
  { collection: "Workwear Edit", launchDate: "2026-06-25", category: "Workwear" },
] as const;

/**
 * Planted experiments (campaigns with a treatment/holdout split). Each has a TRUE
 * incremental effect = treatmentRate - holdoutRate. The Verifier must recover these
 * and reject the ones whose lift CI includes 0.
 */
export interface PlantedCampaign {
  id: string;
  name: string;
  channel: "sms" | "email" | "push";
  type: "awareness" | "conversion";
  creativeStyle: "product_drop" | "evergreen" | "ugc";
  startDate: string;
  targetDescription: string;
  /** eligibility predicate name (implemented in seed.ts) */
  audience:
    | "one_time_buyers"
    | "vip_high_value"
    | "first_time_single_category"
    | "lapsing_browsers"
    | "drop_lookalike_a"
    | "drop_lookalike_b";
  treatmentRate: number; // P(convert | treatment)
  holdoutRate: number; // P(convert | holdout)
  holdoutFraction: number; // share assigned to control
  /** expected Verifier verdict, for the answer key */
  expectedVerdict: "real_lift" | "no_lift_trap" | "near_miss_insignificant";
}

export const CAMPAIGNS: PlantedCampaign[] = [
  {
    id: "SECOND_PURCHASE_SMS",
    name: "Second-purchase SMS to one-time buyers",
    channel: "sms",
    type: "conversion",
    creativeStyle: "evergreen",
    startDate: "2026-04-05",
    targetDescription: "Customers with exactly one order, 30–180 days ago",
    audience: "one_time_buyers",
    treatmentRate: 0.14,
    holdoutRate: 0.08, // +6pp TRUE incremental lift - the genuine headline opportunity
    holdoutFraction: 0.2,
    expectedVerdict: "real_lift",
  },
  {
    id: "VIP_LOYALTY_BLAST",
    name: "VIP loyalty blast",
    channel: "email",
    type: "conversion",
    creativeStyle: "evergreen",
    startDate: "2026-04-12",
    targetDescription: "Top-tier VIP big spenders",
    audience: "vip_high_value",
    treatmentRate: 0.42,
    holdoutRate: 0.42, // ZERO incremental lift - the TRAP (huge raw conversion, would convert anyway)
    holdoutFraction: 0.45, // large, balanced control so the empirical lift stays near 0
    expectedVerdict: "no_lift_trap",
  },
  {
    id: "CROSS_CATEGORY_SMS",
    name: "Cross-category SMS to first-time buyers",
    channel: "sms",
    type: "conversion",
    creativeStyle: "evergreen",
    startDate: "2026-04-20",
    targetDescription: "First-time buyers who bought a single category",
    audience: "first_time_single_category",
    treatmentRate: 0.11,
    holdoutRate: 0.07, // +4pp TRUE lift - supports the churn-prevention cross-sell archetype
    // Balanced 50/50 holdout is deliberate: +4pp at pooled p̄=0.09 needs ~800/arm for 80%
    // power at α=.05 - a small unbalanced control leaves the TRUE lift undetectable, which
    // is a seed bug, not a finding. (Detecting it is the Verifier's job; giving the planted
    // truth enough power to be recoverable is the seed's job.)
    holdoutFraction: 0.5,
    expectedVerdict: "real_lift",
  },
  {
    id: "RETARGET_NEAR_MISS",
    name: "Browse retargeting (broad)",
    channel: "push",
    type: "conversion",
    creativeStyle: "evergreen",
    startDate: "2026-04-25",
    targetDescription: "Recently lapsing browsers",
    audience: "lapsing_browsers",
    treatmentRate: 0.105,
    holdoutRate: 0.095, // +1pp, underpowered => NOT significant => Verifier must reject
    holdoutFraction: 0.4,
    expectedVerdict: "near_miss_insignificant",
  },
  {
    id: "SPRING_DROP_CREATIVE",
    name: "Spring launch - product-drop creative",
    channel: "email",
    type: "awareness",
    creativeStyle: "product_drop",
    startDate: "2026-03-01",
    targetDescription: "Drop-lookalike audience (creative A/B vs evergreen)",
    audience: "drop_lookalike_a",
    treatmentRate: 0.13, // product-drop creative converts higher...
    holdoutRate: 0.06,
    holdoutFraction: 0.2,
    expectedVerdict: "real_lift",
  },
  {
    id: "SPRING_EVERGREEN_CREATIVE",
    name: "Spring launch - evergreen creative",
    channel: "email",
    type: "awareness",
    creativeStyle: "evergreen",
    startDate: "2026-03-01",
    targetDescription: "Drop-lookalike audience (creative A/B vs product-drop)",
    audience: "drop_lookalike_b",
    treatmentRate: 0.085, // ...than evergreen creative on a similar audience (archetype 1 signal)
    holdoutRate: 0.06,
    holdoutFraction: 0.2,
    // The +2.5pp is planted-real but deliberately underpowered (z≈1 even at full pool):
    // the archetype-1 story is that DROP creative wins the A/B, not that evergreen's small
    // lift is independently provable. The Verifier should reject it as insignificant.
    expectedVerdict: "near_miss_insignificant",
  },
];

/** Premium SKUs that never go on sale - the guardrail bait (Phase 4). */
export const GUARDRAIL = {
  premiumFraction: 0.2, // ~20% of products are premium
  neverDiscountFractionOfPremium: 0.5, // half of premium never goes on sale
} as const;

/** Underserved cohort (archetype 3): new workwear buyers, barely targeted. */
export const UNDERSERVED = {
  cohortName: "new_workwear_2026",
  description: "Customers whose first purchase was Workwear and who signed up in 2026",
  approxSize: 350,
  sendCoverage: 0.03, // almost never receive campaign sends => underserved
} as const;
