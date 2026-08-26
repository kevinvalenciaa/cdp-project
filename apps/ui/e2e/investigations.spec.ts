import { expect, test, type Page } from "@playwright/test";

interface InvestigationPayload {
  investigation: {
    id: string;
    runs: Array<{ status: string }>;
    messages: Array<{ role: string; status: string; content: string }>;
  };
}

async function createInvestigation(page: Page, objective: string): Promise<string> {
  await page.goto("/investigations");
  await page.getByPlaceholder("What should the agents investigate?").fill(objective);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page).toHaveURL(/\/investigations\/[0-9a-f-]+$/);
  return page.url().split("/").at(-1)!;
}

async function investigation(page: Page, id: string): Promise<InvestigationPayload["investigation"]> {
  const response = await page.request.get(`/api/investigations/${id}`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as InvestigationPayload).investigation;
}

async function waitForCompletedRun(page: Page, id: string): Promise<void> {
  await expect
    .poll(async () => (await investigation(page, id)).runs.at(-1)?.status, {
      timeout: 30_000,
    })
    .toBe("completed");
}

test("multiple chats keep running, answer from evidence, share snapshots, and aggregate globally", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.removeItem("ui.opportunities-sidebar-open");
    localStorage.removeItem("ui.results-rail-open");
  });

  await page.goto("/investigations");
  await expect(page.getByRole("heading", { name: "Start an investigation" })).toBeVisible();
  await expect(page.getByText("Demo mode")).toHaveCount(0);

  const investigationA = await createInvestigation(
    page,
    "Find durable repeat-purchase opportunities for investigation A",
  );
  await expect(page.getByRole("button", { name: "Stop generation" })).toBeVisible();

  const investigationB = await createInvestigation(
    page,
    "Find cross-category opportunities for investigation B",
  );
  await waitForCompletedRun(page, investigationB);
  await page.reload();
  const runsBeforeAnswer = (await investigation(page, investigationB)).runs.length;
  await page
    .getByPlaceholder("Ask about these results or start fresh analysis…")
    .fill("Explain which result has the highest impact");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect
    .poll(async () => (await investigation(page, investigationB)).messages.at(-1)?.status)
    .toBe("complete");
  await page.reload();
  await expect(page.getByText("Here is what this investigation has proven", { exact: false })).toBeVisible();
  expect((await investigation(page, investigationB)).runs).toHaveLength(runsBeforeAnswer);

  await waitForCompletedRun(page, investigationA);
  await page.goto(`/investigations/${investigationA}`);
  const results = page.locator('aside[aria-label="Investigation results"]');
  await expect(results).toBeHidden();
  await page.getByRole("button", { name: "Open results" }).click();
  await expect(results).toBeVisible();
  await expect(results.getByText("Proven - ranked by impact")).toBeVisible();

  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Create snapshot" }).click();
  const sharedUrl = await page.locator('input[readonly][value*="/share/investigations/"]').inputValue();
  const sharedResponse = await page.request.get(sharedUrl);
  expect(sharedResponse.status()).toBe(200);
  expect(sharedResponse.headers()["cache-control"]).toContain("no-store");
  expect(sharedResponse.headers()["referrer-policy"]).toBe("no-referrer");
  expect(await sharedResponse.text()).not.toContain("persuadableSql");
  await page.getByRole("button", { name: "Revoke snapshot" }).click();
  await expect.poll(async () => (await page.request.get(sharedUrl)).status()).toBe(404);

  await page.goto("/opportunities");
  await expect(page.getByText("Currently proven")).toBeVisible();
  await expect(page.getByLabel("Filter by investigation")).toHaveValue("all");
  expect(consoleErrors).toEqual([]);
});

test("mobile results use a closed sheet and the composer has a borderless focus state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.removeItem("ui.results-rail-open"));
  await page.goto("/opportunities");
  await page.getByRole("link", { name: "Open chat" }).first().click();

  const results = page.locator('aside[aria-label="Investigation results"]');
  await expect(results).toBeHidden();
  await page.getByRole("button", { name: "Open results" }).click();
  await expect(results).toBeVisible();
  const box = await results.boundingBox();
  expect(box?.width).toBeCloseTo(390, -1);
  expect(box?.y).toBeGreaterThan(100);
  await results.getByRole("button", { name: "Hide results panel" }).click();
  await expect(results).toBeHidden();

  const composer = page.getByPlaceholder("Ask about these results or start fresh analysis…");
  await composer.focus();
  const focusStyle = await composer.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outlineStyle, boxShadow: style.boxShadow };
  });
  expect(focusStyle.outline).toBe("none");
  expect(focusStyle.boxShadow).toBe("none");
  await expect(page.getByText("Canvas", { exact: true })).toHaveCount(0);
});
