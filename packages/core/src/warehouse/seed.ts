/**
 * Deterministic synthetic fashion-retailer warehouse generator.
 *
 * Plants (and then documents in GROUND_TRUTH.md):
 *  - a strong seasonal curve (the time-series false positive),
 *  - real experiments with known incremental lifts + a zero-lift TRAP + a near-miss,
 *  - the three Hightouch archetypes (new-product-launch, churn cross-sell, underserved),
 *  - premium "never on sale" SKUs (guardrail bait).
 *
 * Run: `pnpm seed`
 */
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../shared/env.js";
import { Db, num } from "../shared/db.js";
import { Rng } from "../shared/rng.js";
import { addDays, daysBetween, dayOfYear, parseYmd, ymd } from "../shared/dates.js";
import {
  CALENDAR,
  CAMPAIGNS,
  COUNTS,
  DIMENSIONS,
  GUARDRAIL,
  SEASONALITY,
  UNDERSERVED,
  UPCOMING_DROPS,
  type PlantedCampaign,
} from "./config.js";
import { writeGroundTruth } from "./ground-truth-doc.js";

const TODAY = parseYmd(CALENDAR.today);
const DATA_START = parseYmd(CALENDAR.dataStart);
const CHURN_CUTOFF = addDays(TODAY, -CALENDAR.churnWindowDays);

const PRICE_RANGE: Record<string, [number, number]> = {
  Workwear: [70, 160],
  Outerwear: [120, 400],
  Footwear: [80, 250],
  Accessories: [25, 120],
  Activewear: [40, 130],
};

const TIER_WEIGHTS = [
  { item: "vip", weight: 14 },
  { item: "high", weight: 20 },
  { item: "mid", weight: 38 },
  { item: "low", weight: 28 },
] as const;
const TIER_BASE_ORDERS: Record<string, number> = { vip: 9, high: 5, mid: 2.2, low: 1.1 };

function seasonalMultiplier(d: Date): number {
  const doy = dayOfYear(d);
  const yearly = SEASONALITY.yearlyAmplitude * Math.cos((2 * Math.PI * (doy - SEASONALITY.peakDayOfYear)) / 365);
  const weekend = [0, 6].includes(d.getUTCDay()) ? SEASONALITY.weekendBump : 0;
  return Math.max(0.1, 1 + yearly + weekend);
}
const SEASONAL_MAX = 1 + SEASONALITY.yearlyAmplitude + SEASONALITY.weekendBump;

interface ProductRow {
  product_id: number;
  name: string;
  category: string;
  price: number;
  is_premium: boolean;
  never_discount: boolean;
  collection: string;
  is_product_drop: boolean;
  launch_date: string;
}

interface CustomerStats {
  customer_id: number;
  region: string;
  value_tier: string;
  sms_responder: boolean;
  email_responder: boolean;
  signup_date: string;
  signupYear: number;
  base_propensity: number;
  orders: { id: number; date: Date; category: string; revenue: number }[];
  categories: Set<string>;
  firstDate?: Date;
  lastDate?: Date;
  usedInExperiment: boolean;
}

function buildProducts(rng: Rng): ProductRow[] {
  const products: ProductRow[] = [];
  let pid = 1;
  // Core catalog
  const coreCount = COUNTS.products - UPCOMING_DROPS.length * 6;
  for (let i = 0; i < coreCount; i++) {
    const category = rng.pick(DIMENSIONS.categories);
    const [lo, hi] = PRICE_RANGE[category]!;
    const price = Math.round(rng.float(lo, hi));
    const is_premium = price >= 180 || (category === "Outerwear" && price >= 250);
    products.push({
      product_id: pid++,
      name: `${category} Item ${i + 1}`,
      category,
      price,
      is_premium,
      never_discount: is_premium && rng.bool(GUARDRAIL.neverDiscountFractionOfPremium),
      collection: "Core",
      is_product_drop: false,
      launch_date: ymd(addDays(DATA_START, -rng.int(0, 400))),
    });
  }
  // Upcoming drops (launch next week)
  for (const drop of UPCOMING_DROPS) {
    const [lo, hi] = PRICE_RANGE[drop.category]!;
    for (let i = 0; i < 6; i++) {
      const price = Math.round(rng.float((lo + hi) / 2, hi));
      products.push({
        product_id: pid++,
        name: `${drop.collection} ${drop.category} ${i + 1}`,
        category: drop.category,
        price,
        is_premium: true,
        never_discount: rng.bool(0.5),
        collection: drop.collection,
        is_product_drop: true,
        launch_date: drop.launchDate,
      });
    }
  }
  return products;
}

function buildCustomers(rng: Rng): CustomerStats[] {
  const customers: CustomerStats[] = [];
  for (let id = 1; id <= COUNTS.customers; id++) {
    const signup = addDays(parseYmd("2023-06-01"), rng.int(0, daysBetween(parseYmd("2023-06-01"), TODAY) - 5));
    const value_tier = rng.weighted(TIER_WEIGHTS as readonly { item: string; weight: number }[]);
    customers.push({
      customer_id: id,
      region: rng.pick(DIMENSIONS.regions),
      value_tier,
      sms_responder: rng.bool(0.4),
      email_responder: rng.bool(0.6),
      signup_date: ymd(signup),
      signupYear: signup.getUTCFullYear(),
      base_propensity: Rng.clamp(rng.normal(0.5, 0.18), 0.02, 0.95),
      orders: [],
      categories: new Set<string>(),
      usedInExperiment: false,
    });
  }
  return customers;
}

function sampleSeasonalDate(rng: Rng, start: Date, end: Date): Date {
  const span = Math.max(1, daysBetween(start, end));
  for (let attempt = 0; attempt < 40; attempt++) {
    const d = addDays(start, rng.int(0, span));
    if (rng.next() < seasonalMultiplier(d) / SEASONAL_MAX) return d;
  }
  return addDays(start, rng.int(0, span));
}

function generateOrders(rng: Rng, customers: CustomerStats[], products: ProductRow[]) {
  const corePurchasable = products.filter((p) => !p.is_product_drop);
  const byCategory = new Map<string, ProductRow[]>();
  for (const p of corePurchasable) {
    const arr = byCategory.get(p.category) ?? [];
    arr.push(p);
    byCategory.set(p.category, arr);
  }

  const orders: unknown[][] = [];
  const items: unknown[][] = [];
  let orderId = 1;

  for (const c of customers) {
    const expected = TIER_BASE_ORDERS[c.value_tier]! * (0.4 + c.base_propensity);
    const nOrders = Math.max(1, Math.round(rng.normal(expected, expected * 0.45)));
    const preferred = rng.weighted([
      { item: "Workwear", weight: c.signupYear === 2026 ? 3 : 1 },
      { item: "Outerwear", weight: 2 },
      { item: "Footwear", weight: 2 },
      { item: "Accessories", weight: 1.5 },
      { item: "Activewear", weight: 1.5 },
    ]);
    // "Engaged" = multi-category + low churn. Non-engaged stick to one category and
    // may lapse. We sample all dates seasonally across the full window (keeps the Q4
    // signal intact), then force engaged customers' LAST order to be recent so the
    // churn signal doesn't fight seasonality.
    const engaged = nOrders >= 2 && rng.bool(0.5);
    const windowStart = parseYmd(c.signup_date) > DATA_START ? parseYmd(c.signup_date) : DATA_START;

    for (let i = 0; i < nOrders; i++) {
      const id = orderId++;
      const date = sampleSeasonalDate(rng, windowStart, TODAY);
      const category = engaged
        ? i === 0
          ? preferred
          : rng.pick(DIMENSIONS.categories) // engaged buy across categories
        : rng.bool(0.9)
          ? preferred // non-engaged stay single-category
          : rng.pick(DIMENSIONS.categories);
      const pool = byCategory.get(category) ?? corePurchasable;
      const nItems = rng.int(1, 3);
      let revenue = 0;
      for (let k = 0; k < nItems; k++) {
        const p = rng.pick(pool);
        const qty = rng.int(1, 2);
        const unit = Math.round(p.price * rng.float(0.95, 1.05));
        revenue += unit * qty;
        items.push([id, p.product_id, qty, unit]);
      }
      c.orders.push({ id, date, category, revenue });
      c.categories.add(category);
    }
    c.orders.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Force engaged customers to have a recent last order (low churn) — keeps the
    // churn signal from fighting the seasonal placement of the other orders.
    if (engaged && c.orders.length > 0) {
      const last = c.orders[c.orders.length - 1]!;
      if (last.date < CHURN_CUTOFF) last.date = sampleSeasonalDate(rng, CHURN_CUTOFF, TODAY);
      c.orders.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    // Emit order rows with stable ids (so order_items keep referential integrity).
    for (const o of c.orders) {
      orders.push([o.id, c.customer_id, ymd(o.date), o.revenue, rng.pick(DIMENSIONS.acquisitionChannels)]);
    }
    c.firstDate = c.orders[0]?.date;
    c.lastDate = c.orders[c.orders.length - 1]?.date;
  }
  return { orders, items };
}

function eligibleFor(audience: PlantedCampaign["audience"], c: CustomerStats): boolean {
  if (c.usedInExperiment || !c.firstDate || !c.lastDate) return false;
  // Reserve the underserved new-workwear-2026 cohort (archetype 3): never targeted.
  if (c.signupYear === 2026 && c.orders[0]?.category === "Workwear") return false;
  const daysSinceOrder = daysBetween(c.lastDate, TODAY);
  switch (audience) {
    case "one_time_buyers":
      return c.orders.length === 1 && daysBetween(c.firstDate, parseYmd("2026-04-05")) >= 30 && daysBetween(c.firstDate, parseYmd("2026-04-05")) <= 180;
    case "first_time_single_category":
      // >= 2024 (not 2025): the cross-category experiment needs ~1,600+ eligible customers
      // so its planted +4pp lift is powered (see config.ts holdoutFraction note).
      return c.orders.length === 1 && c.categories.size === 1 && c.firstDate.getUTCFullYear() >= 2024;
    case "vip_high_value":
      return c.value_tier === "vip";
    case "lapsing_browsers":
      return c.orders.length >= 1 && daysSinceOrder >= 90 && daysSinceOrder <= 220;
    case "drop_lookalike_a":
    case "drop_lookalike_b":
      return c.orders.length >= 1 && (c.categories.has("Outerwear") || c.categories.has("Workwear"));
    default:
      return false;
  }
}

function generateCampaignSends(rng: Rng, customers: CustomerStats[]) {
  const campaignRows: unknown[][] = [];
  const sendRows: unknown[][] = [];
  let sendId = 1;
  const caps: Record<string, number> = {
    one_time_buyers: 2500,
    first_time_single_category: 2600, // powered for the +4pp cross-category lift (~800+/arm at 50/50)
    vip_high_value: 1200,
    lapsing_browsers: 1500,
    drop_lookalike_a: 900,
    drop_lookalike_b: 900,
  };

  for (const camp of CAMPAIGNS) {
    campaignRows.push([
      camp.id,
      camp.name,
      camp.channel,
      camp.type,
      camp.creativeStyle,
      camp.startDate,
      camp.targetDescription,
    ]);
    const pool = rng.shuffle(customers.filter((c) => eligibleFor(camp.audience, c)));
    const cap = caps[camp.audience] ?? pool.length;
    const chosen = pool.slice(0, cap);

    // Split into arms, then assign conversions by QUOTA per arm so the empirical
    // rate matches the planted rate (±rounding). This makes the answer key exact
    // and reproducible — the demo's claims are provable, not subject to draw luck.
    const treated: CustomerStats[] = [];
    const control: CustomerStats[] = [];
    for (const c of chosen) {
      c.usedInExperiment = true;
      (rng.bool(1 - camp.holdoutFraction) ? treated : control).push(c);
    }

    const emitArm = (arm: CustomerStats[], treatment: number, rate: number) => {
      const nConv = Math.round(rate * arm.length);
      const shuffled = rng.shuffle(arm);
      // Channel-preference signal (planted, discoverable): TREATED conversions land
      // preferentially on channel responders (weight 3× for sms_responder on SMS sends,
      // email analog). Arm-level totals stay EXACT via the quota, so planted rates and
      // every verdict are untouched — only who-converts within the arm shifts. Control
      // arms stay uniform: organic conversion is channel-independent (the honest causal
      // story — the channel only matters when you actually message someone through it).
      const weightOf = (c: CustomerStats): number =>
        treatment !== 1 ? 1
        : camp.channel === "sms" ? (c.sms_responder ? 3 : 1)
        : camp.channel === "email" ? (c.email_responder ? 3 : 1)
        : 1;
      // Efraimidis–Spirakis weighted sampling without replacement, deterministic via rng.
      const keyed = shuffled.map((c) => ({ c, key: Math.pow(rng.next(), 1 / weightOf(c)) }));
      const converters = new Set(
        keyed
          .slice()
          .sort((a, b) => b.key - a.key)
          .slice(0, nConv)
          .map((x) => x.c.customer_id),
      );
      shuffled.forEach((c) => {
        const converted = converters.has(c.customer_id) ? 1 : 0;
        const sentAt = parseYmd(camp.startDate);
        const convertedAt = converted ? ymd(addDays(sentAt, rng.int(1, 14))) : null;
        const revenue = converted ? Math.round(rng.float(60, 280)) : 0;
        const variant = treatment === 1 ? rng.pick(["A", "B"]) : "control";
        sendRows.push([sendId++, camp.id, c.customer_id, camp.startDate, treatment, variant, converted, convertedAt, revenue]);
      });
    };
    emitArm(treated, 1, camp.treatmentRate);
    emitArm(control, 0, camp.holdoutRate);
  }
  return { campaignRows, sendRows };
}

async function createSchema(db: Db): Promise<void> {
  await db.run(`
    CREATE TABLE customers (
      customer_id INTEGER PRIMARY KEY,
      signup_date DATE,
      region VARCHAR,
      acquisition_channel VARCHAR,
      value_tier VARCHAR,
      sms_responder BOOLEAN,
      email_responder BOOLEAN
    );
    CREATE TABLE products (
      product_id INTEGER PRIMARY KEY,
      name VARCHAR,
      category VARCHAR,
      price DOUBLE,
      is_premium BOOLEAN,
      never_discount BOOLEAN,
      collection VARCHAR,
      is_product_drop BOOLEAN,
      launch_date DATE
    );
    CREATE TABLE orders (
      order_id INTEGER PRIMARY KEY,
      customer_id INTEGER,
      order_date DATE,
      revenue DOUBLE,
      channel VARCHAR
    );
    CREATE TABLE order_items (
      order_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      unit_price DOUBLE
    );
    CREATE TABLE campaigns (
      campaign_id VARCHAR PRIMARY KEY,
      name VARCHAR,
      channel VARCHAR,
      type VARCHAR,
      creative_style VARCHAR,
      start_date DATE,
      target_description VARCHAR
    );
    CREATE TABLE campaign_sends (
      send_id INTEGER PRIMARY KEY,
      campaign_id VARCHAR,
      customer_id INTEGER,
      sent_at DATE,
      treatment INTEGER,
      variant VARCHAR,
      converted INTEGER,
      converted_at DATE,
      revenue DOUBLE
    );
  `);
}

async function createViews(db: Db): Promise<void> {
  // customer_360 deliberately omits latent fields (base_propensity, cohort labels):
  // the agents must DISCOVER segments from behavior, not read an answer column.
  await db.run(`
    CREATE VIEW customer_360 AS
    WITH ord AS (
      SELECT customer_id,
             COUNT(*) AS n_orders,
             SUM(revenue) AS total_revenue,
             AVG(revenue) AS avg_order_value,
             CAST(MIN(order_date) AS VARCHAR) AS first_order_date,
             CAST(MAX(order_date) AS VARCHAR) AS last_order_date,
             MAX(order_date) AS last_order_raw
      FROM orders GROUP BY customer_id
    ),
    cat AS (
      SELECT o.customer_id, COUNT(DISTINCT p.category) AS categories_purchased,
             CAST(MIN_BY(p.category, o.order_date) AS VARCHAR) AS first_category
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      JOIN products p ON p.product_id = oi.product_id
      GROUP BY o.customer_id
    )
    SELECT
      c.customer_id,
      CAST(c.signup_date AS VARCHAR) AS signup_date,
      c.region, c.acquisition_channel, c.value_tier, c.sms_responder, c.email_responder,
      COALESCE(ord.n_orders, 0) AS n_orders,
      COALESCE(ord.total_revenue, 0) AS total_revenue,
      COALESCE(ord.avg_order_value, 0) AS avg_order_value,
      ord.first_order_date, ord.last_order_date,
      COALESCE(cat.categories_purchased, 0) AS categories_purchased,
      cat.first_category,
      (COALESCE(ord.n_orders, 0) = 1) AS is_one_time_buyer,
      (ord.last_order_raw IS NOT NULL AND ord.last_order_raw < DATE '${ymd(CHURN_CUTOFF)}') AS is_churn_risk
    FROM customers c
    LEFT JOIN ord ON ord.customer_id = c.customer_id
    LEFT JOIN cat ON cat.customer_id = c.customer_id;
  `);
}

async function main(): Promise<void> {
  const rng = new Rng(config.seed);
  console.log(`[seed] seed=${config.seed} today=${CALENDAR.today} -> ${config.duckdbPath}`);

  // Fresh database
  mkdirSync(dirname(config.duckdbPath), { recursive: true });
  for (const ext of ["", ".wal"]) rmSync(`${config.duckdbPath}${ext}`, { force: true });

  const db = await Db.open(config.duckdbPath);
  await createSchema(db);

  const products = buildProducts(rng);
  const customers = buildCustomers(rng);
  const { orders, items } = generateOrders(rng, customers, products);
  const { campaignRows, sendRows } = generateCampaignSends(rng, customers);

  await db.insertRows(
    "customers",
    ["customer_id", "signup_date", "region", "acquisition_channel", "value_tier", "sms_responder", "email_responder"],
    customers.map((c) => [c.customer_id, c.signup_date, c.region, rng.pick(DIMENSIONS.acquisitionChannels), c.value_tier, c.sms_responder, c.email_responder]),
  );
  await db.insertRows(
    "products",
    ["product_id", "name", "category", "price", "is_premium", "never_discount", "collection", "is_product_drop", "launch_date"],
    products.map((p) => [p.product_id, p.name, p.category, p.price, p.is_premium, p.never_discount, p.collection, p.is_product_drop, p.launch_date]),
  );
  await db.insertRows("orders", ["order_id", "customer_id", "order_date", "revenue", "channel"], orders);
  await db.insertRows("order_items", ["order_id", "product_id", "quantity", "unit_price"], items);
  await db.insertRows("campaigns", ["campaign_id", "name", "channel", "type", "creative_style", "start_date", "target_description"], campaignRows);
  await db.insertRows(
    "campaign_sends",
    ["send_id", "campaign_id", "customer_id", "sent_at", "treatment", "variant", "converted", "converted_at", "revenue"],
    sendRows,
  );

  await createViews(db);

  const counts = {
    customers: num(await db.scalar("SELECT count(*) FROM customers")),
    products: num(await db.scalar("SELECT count(*) FROM products")),
    orders: num(await db.scalar("SELECT count(*) FROM orders")),
    order_items: num(await db.scalar("SELECT count(*) FROM order_items")),
    campaign_sends: num(await db.scalar("SELECT count(*) FROM campaign_sends")),
  };
  console.log("[seed] row counts:", counts);

  await writeGroundTruth(db, config.repoRoot);
  db.close();
  console.log("[seed] done. Run `pnpm ground-truth` to verify the planted signals.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
