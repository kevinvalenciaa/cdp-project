import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const STATE_PATH = resolve(__dirname, "../../../.context/e2e-investigations-state.json");
const DEMO_INVESTIGATION = "00000000-0000-4000-8000-000000000003";

test.beforeEach(async ({ page }) => {
  rmSync(STATE_PATH, { force: true });
  await page.addInitScript(() => {
    localStorage.removeItem("ui.sidebar-open");
    localStorage.removeItem("ui.opportunities-sidebar-open");
    localStorage.removeItem("ui.results-rail-open");
  });
});

test("preserves the product copy, controls, and route content", async ({ page }) => {
  test.setTimeout(120_000);

  const routes: Array<{
    path: string;
    heading: string;
    content: string[];
  }> = [
    {
      path: "/",
      heading: "Dashboard",
      content: [
        "Your Agentic CDP at a glance - what the agents found while you were away.",
        "Ready for review",
        "Est. incremental revenue",
        "Rejected by the Verifier",
        "Launched",
        "Proven opportunities",
        "Ruled out overnight",
        "Review opportunities",
      ],
    },
    {
      path: "/opportunities",
      heading: "Opportunities",
      content: [
        "The latest proven results across every workspace investigation.",
        "Currently proven",
        "Est. monthly impact",
        "Needs re-verification",
        "New investigation",
        "Open chat",
      ],
    },
    {
      path: "/activity",
      heading: "Activity",
      content: [
        "Workspace-wide agent work across every investigation.",
        "No activity yet",
        "Every plan, query, rejection and confirmation the agents make shows up here.",
        "Run an investigation",
      ],
    },
    {
      path: "/launched",
      heading: "Launched & Measuring",
      content: [
        "Approved campaigns, their measured incremental lift, and per-segment optimization.",
        "Nothing launched yet",
        "Review opportunities",
      ],
    },
    {
      path: "/memory",
      heading: "Insights",
      content: [
        "Verified insights that compound across runs - only Verifier-passed claims are stored.",
        "Subject",
        "Insight",
        "Verdict",
        "Confidence",
      ],
    },
    {
      path: "/settings",
      heading: "Settings & Guardrails",
      content: [
        "Business goals and the brand rules the agents must respect - your composable context.",
        "Business goals",
        "Guardrails",
        "Guardrails are injected as context before any recommendation is surfaced.",
      ],
    },
    {
      path: "/opportunities/investigations",
      heading: "Investigations",
      content: [
        "Persistent conversations, their run state, and the proven opportunities they produced.",
        "New investigation",
        "Grow second purchases from one-time buyers",
      ],
    },
    {
      path: "/opportunities/new",
      heading: "Start an investigation",
      content: [
        "Describe the business outcome. The agent team will scan the warehouse, verify every claim, and keep this investigation available for contextual follow-ups.",
        "Every promoted opportunity must survive holdout verification.",
      ],
    },
    {
      path: "/investigations",
      heading: "Start an investigation",
      content: [
        "Describe the business outcome. The agent team will scan the warehouse, verify every claim, and keep this investigation available for contextual follow-ups.",
        "Every promoted opportunity must survive holdout verification.",
        "Recent investigations",
      ],
    },
    {
      path: "/how-it-works",
      heading: "How Proofloop works",
      content: [
        "An Agentic CDP that finds proven opportunities, drafts the work, and learns every run.",
        "Back to the app",
        "Inside the engine",
        "The flywheel",
      ],
    },
    {
      path: "/login",
      heading: "Sign in to Proofloop",
      content: ["Use your workspace email to continue.", "Email", "Continue in local demo"],
    },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible();
    for (const value of route.content) {
      await expect(page.getByText(value, { exact: false }).first()).toBeVisible();
    }
  }

  await page.goto("/investigations");
  const recentInvestigations = page.locator('aside[aria-label="Recent investigations"]');
  await expect(recentInvestigations).toBeVisible();
  await expect(recentInvestigations.getByText("Recent investigations", { exact: true })).toBeVisible();
  await expect(recentInvestigations.getByText("View all investigations", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary" }).getByText("Recent investigations")).toHaveCount(0);
  await expect(recentInvestigations).toHaveCSS("width", "232px");
  await recentInvestigations.getByRole("button", { name: "Collapse recent investigations" }).click();
  await expect(recentInvestigations).toHaveCSS("width", "64px");
  await recentInvestigations.getByRole("button", { name: "Expand recent investigations" }).click();
  await expect(recentInvestigations).toHaveCSS("width", "232px");

  await page.goto("/opportunities");
  await expect(page.getByPlaceholder("Search opportunities or segments…")).toBeVisible();
  await expect(page.getByLabel("Filter by status")).toHaveValue("proven");
  await expect(page.getByLabel("Filter by segment")).toHaveValue("all");
  await expect(page.getByLabel("Filter by verification date")).toHaveValue("all");
  await expect(page.getByLabel("Filter by investigation")).toHaveValue("all");

  await page.goto(`/investigations/${DEMO_INVESTIGATION}`);
  await expect(page.getByLabel("Investigation title")).toHaveValue(
    "Grow second purchases from one-time buyers",
  );
  await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open results" })).toBeVisible();
  await expect(
    page.getByPlaceholder("Ask about these results or start fresh analysis…"),
  ).toBeVisible();
});

test("captures the full responsive visual matrix without overflow", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  const scenarios = [
    { name: "dashboard-desktop", path: "/", width: 1440, height: 1000 },
    { name: "opportunities-desktop", path: "/opportunities", width: 1440, height: 1000 },
    { name: "opportunities-tablet", path: "/opportunities", width: 1024, height: 768 },
    { name: "investigations-desktop", path: "/investigations", width: 1440, height: 1000 },
    { name: "launched-desktop", path: "/launched", width: 1440, height: 1000 },
    { name: "insights-desktop", path: "/memory", width: 1440, height: 1000 },
    { name: "settings-desktop", path: "/settings", width: 1440, height: 1000 },
    { name: "login-desktop", path: "/login", width: 1440, height: 1000 },
    { name: "opportunities-mobile", path: "/opportunities", width: 390, height: 844 },
    { name: "investigations-mobile", path: "/investigations", width: 390, height: 844 },
  ];

  for (const scenario of scenarios) {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.goto(scenario.path);
    await page.waitForTimeout(150);
    await assertNoHorizontalPageOverflow(page);

    if (scenario.width >= 1024 && scenario.path !== "/login") {
      const sidebar = page.locator("aside").first();
      await expect(sidebar).toBeVisible();
      expect((await sidebar.boundingBox())?.width).toBeCloseTo(272, 0);
    }

    if (scenario.path === "/" || scenario.path === "/opportunities") {
      const card = page.locator(".metric-card").first();
      await expect(card).toBeVisible();
      const radius = await card.evaluate((element) => parseFloat(getComputedStyle(element).borderRadius));
      expect(radius).toBeGreaterThanOrEqual(16);
    }

    await attachScreenshot(page, testInfo, scenario.name);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/investigations/${DEMO_INVESTIGATION}`);
  await page.getByRole("button", { name: "Open results" }).click();
  await expect(page.locator('aside[aria-label="Investigation results"]')).toBeVisible();
  await assertNoHorizontalPageOverflow(page);
  await attachScreenshot(page, testInfo, "investigation-results-desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/investigations/${DEMO_INVESTIGATION}`);
  await page.getByRole("button", { name: "Open results" }).click();
  const mobileResults = page.locator('aside[aria-label="Investigation results"]');
  await expect(mobileResults).toBeVisible();
  expect((await mobileResults.boundingBox())?.width).toBeCloseTo(390, 0);
  await attachScreenshot(page, testInfo, "investigation-results-mobile");

  const createShare = await page.request.post(
    `/api/investigations/${DEMO_INVESTIGATION}/shares`,
    { data: { scope: "proven", expiresInDays: 30 } },
  );
  expect(createShare.ok()).toBe(true);
  const payload = (await createShare.json()) as { share: { url: string } };
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(payload.share.url);
  await expect(page.getByText("Proofloop investigation")).toBeVisible();
  await assertNoHorizontalPageOverflow(page);
  await attachScreenshot(page, testInfo, "public-share-tablet");

  expect(consoleErrors).toEqual([]);
});

async function assertNoHorizontalPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(overflow.content).toBeLessThanOrEqual(overflow.viewport + 1);
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const body = await page.screenshot({ animations: "disabled", fullPage: false });
  await testInfo.attach(name, { body, contentType: "image/png" });
}
