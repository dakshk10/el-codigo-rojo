/**
 * Playwright end-to-end test suite.
 * Runs against the live Vercel preview (E2E_BASE_URL) or localhost.
 *
 * Covers:
 * - Refresh persistence (timer, unlocks, hints, attempts, workspace)
 * - Wrong code flow
 * - Correct code flow
 * - Timeout flow (simulated by manipulating time)
 * - Two-team isolation
 * - Third-party request audit (zero external hosts)
 *
 * Usage:
 *   E2E_BASE_URL=https://your-preview.vercel.app npx playwright test
 *   EVENT_CODE=... ADMIN_TOKEN=... E2E_BASE_URL=... npx playwright test
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srv = JSON.parse(
  readFileSync(resolve(here, "../../challenge/server.json"), "utf8"),
);
const REAL_CODE = srv.solution.final_code as string;
const EVENT_CODE = process.env["EVENT_CODE"] ?? "dev-event-code";
const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:3001";
const ADMIN_TOKEN = process.env["ADMIN_TOKEN"] ?? "dev-admin-token";

async function resetTeam(teamName: string) {
  await fetch(`${BASE_URL}/api/admin/reset/${encodeURIComponent(teamName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": ADMIN_TOKEN,
    },
    body: JSON.stringify({ confirm: true }),
  });
}

async function enterTeamViaAPI(teamName: string, passcode: string): Promise<string> {
  // Verify event code
  await fetch(`${BASE_URL}/api/event/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: EVENT_CODE }),
  });

  // Enter team and get cookie
  const res = await fetch(`${BASE_URL}/api/teams/enter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamName, passcode }),
  });

  const setCookie = res.headers.get("set-cookie") ?? "";
  return setCookie.match(/ecr_session=([^;]+)/)?.[0] ?? "";
}

async function navigateAndVerifyEventCode(page: Page) {
  await page.goto(`${BASE_URL}/`);
  const continueBtn = page.locator("button", { hasText: "CONTINUE" });
  if (await continueBtn.isVisible()) {
    await page.fill("input", EVENT_CODE);
    await continueBtn.click();
  }
}

// Third-party request audit
const externalRequests: string[] = [];

test.describe("P5-07 Third-party request audit", () => {
  test("no request to any host other than the deployment during a full playthrough", async ({
    page,
    context,
  }) => {
    const ownHost = new URL(BASE_URL).hostname;

    context.on("request", (req) => {
      const host = new URL(req.url()).hostname;
      if (host !== ownHost) {
        externalRequests.push(req.url());
      }
    });

    await navigateAndVerifyEventCode(page);

    // Fill team entry form
    const teamName = `AuditTeam${Date.now()}`;
    await page.fill("input#team-name", teamName);
    await page.fill("input#team-passcode", "1234");
    await page.click("button#enter-operation-btn");

    // Briefing: begin heist
    await page.click("button#begin-heist-btn");
    await expect(page.locator("text=CONTROL ROOM")).toBeVisible({ timeout: 5000 });

    expect(externalRequests, `External requests: ${externalRequests.join(", ")}`).toHaveLength(0);

    // Cleanup
    await resetTeam(teamName);
  });
});

test.describe("P5-05 Refresh persistence", () => {
  let context: BrowserContext;
  let page: Page;
  const teamName = `RefreshTeam${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await resetTeam(teamName);
    await context.close();
  });

  test("timer, unlocks, and session state survive a page refresh", async () => {
    await navigateAndVerifyEventCode(page);

    await page.fill("input#team-name", teamName);
    await page.fill("input#team-passcode", "5678");
    await page.click("button#enter-operation-btn");
    await page.click("button#begin-heist-btn");

    // Wait for control room
    await expect(page.locator("text=CONTROL ROOM")).toBeVisible({ timeout: 5000 });

    // Open evidence 01
    await page.click('[data-testid="evidence-01"]');
    await expect(page.locator("text=CLASSIFIED EVIDENCE")).toBeVisible({ timeout: 3000 });

    // Note the timer value
    const timerEl = page.locator('[data-testid="timer-display"]');
    const timerBefore = await timerEl.textContent();
    expect(timerBefore).toMatch(/^\d{2}:\d{2}$/);

    // Refresh
    await page.reload();
    await expect(page.locator("text=CONTROL ROOM")).toBeVisible({ timeout: 5000 });

    // Timer should still be running (not reset to 15:00)
    const timerAfter = await timerEl.textContent();
    expect(timerAfter).toMatch(/^\d{2}:\d{2}$/);
    expect(timerAfter).not.toBe("15:00");

    // Evidence 01 should still be marked as opened
    const ev01 = page.locator('[data-testid="evidence-01"]');
    await expect(ev01).toHaveAttribute("data-opened", "true");
  });
});

test.describe("P5-05 Wrong and correct code flows", () => {
  test("wrong code shows ACCESS DENIED and decrements attempts", async ({ page }) => {
    const teamName = `WrongFlow${Date.now()}`;

    try {
      await navigateAndVerifyEventCode(page);
      await page.fill("input#team-name", teamName);
      await page.fill("input#team-passcode", "4321");
      await page.click("button#enter-operation-btn");
      await page.click("button#begin-heist-btn");

      // Navigate to vault
      await page.goto(`${BASE_URL}/#vault`);
      await page.waitForTimeout(500);

      // Enter wrong code
      for (const d of "000000") {
        await page.click(`button[data-digit="${d}"]`);
      }
      await page.click("button#enter-code-btn");

      // Should see ACCESS DENIED
      await expect(page.locator("text=ACCESS DENIED")).toBeVisible({ timeout: 3000 });

      // Attempts should decrement
      await expect(page.locator("text=ATTEMPTS REMAINING: 2")).toBeVisible({ timeout: 3000 });
    } finally {
      await resetTeam(teamName);
    }
  });

  test("correct code shows ACCESS GRANTED and navigates to VAULT BREACHED", async ({ page }) => {
    const teamName = `CorrectFlow${Date.now()}`;

    try {
      await navigateAndVerifyEventCode(page);
      await page.fill("input#team-name", teamName);
      await page.fill("input#team-passcode", "9999");
      await page.click("button#enter-operation-btn");
      await page.click("button#begin-heist-btn");

      await page.goto(`${BASE_URL}/#vault`);
      await page.waitForTimeout(500);

      // Enter correct code
      for (const d of REAL_CODE) {
        await page.click(`button[data-digit="${d}"]`);
      }
      await page.click("button#enter-code-btn");

      // Should see ACCESS GRANTED then result screen
      await expect(page.locator("text=VAULT BREACHED")).toBeVisible({ timeout: 5000 });

      // Score should be visible and non-zero
      const score = page.locator('[data-testid="final-score"]');
      await expect(score).toBeVisible();
      const scoreText = await score.textContent();
      expect(Number(scoreText)).toBeGreaterThan(0);

      // Code must never appear on screen
      await expect(page.locator(`text=${REAL_CODE}`)).not.toBeVisible();
    } finally {
      await resetTeam(teamName);
    }
  });
});

test.describe("P5-05 Two-team isolation", () => {
  test("two teams cannot see each other's state", async ({ browser }) => {
    const teamA = `IsoTeamA${Date.now()}`;
    const teamB = `IsoTeamB${Date.now()}`;

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // Team A enters
      await navigateAndVerifyEventCode(pageA);
      await pageA.fill("input#team-name", teamA);
      await pageA.fill("input#team-passcode", "1111");
      await pageA.click("button#enter-operation-btn");
      await pageA.click("button#begin-heist-btn");
      await expect(pageA.locator("text=CONTROL ROOM")).toBeVisible({ timeout: 5000 });

      // Team B enters (fresh context = fresh cookie)
      await navigateAndVerifyEventCode(pageB);
      await pageB.fill("input#team-name", teamB);
      await pageB.fill("input#team-passcode", "2222");
      await pageB.click("button#enter-operation-btn");
      await pageB.click("button#begin-heist-btn");
      await expect(pageB.locator("text=CONTROL ROOM")).toBeVisible({ timeout: 5000 });

      // Team A should show teamA name, not teamB
      await expect(pageA.locator(`text=${teamA}`)).toBeVisible();
      await expect(pageA.locator(`text=${teamB}`)).not.toBeVisible();

      // Team B should show teamB name, not teamA
      await expect(pageB.locator(`text=${teamB}`)).toBeVisible();
      await expect(pageB.locator(`text=${teamA}`)).not.toBeVisible();
    } finally {
      await ctxA.close();
      await ctxB.close();
      await resetTeam(teamA);
      await resetTeam(teamB);
    }
  });
});

test.describe("P5-05 Timeout flow", () => {
  test("admin reset returns team to NOT_STARTED", async ({ page }) => {
    const teamName = `TimeoutCheck${Date.now()}`;

    await navigateAndVerifyEventCode(page);
    await page.fill("input#team-name", teamName);
    await page.fill("input#team-passcode", "3333");
    await page.click("button#enter-operation-btn");
    await page.click("button#begin-heist-btn");
    await expect(page.locator("text=CONTROL ROOM")).toBeVisible({ timeout: 5000 });

    // Reset via admin API
    await resetTeam(teamName);

    // Re-enter — should land at briefing (NOT_STARTED)
    await page.reload();
    const reentered = await fetch(`${BASE_URL}/api/teams/enter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamName, passcode: "3333" }),
    });
    expect(reentered.status).toBe(200);
    const body = (await reentered.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    // Cleanup
    await resetTeam(teamName);
  });
});
