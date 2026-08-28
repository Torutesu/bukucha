import { test, expect } from "@playwright/test";
import { loginAs, startRoute, E2E_TEEN_STORY } from "./helpers";

test.describe("Safety and social", () => {
  test("E2E-015: mature stories are gated on a confirmed age, server-side", async ({ page }) => {
    await loginAs(page, "safety-e2e015@test.com");
    await page.goto("/");
    await expect(page.getByTestId("safe-filter-banner")).toBeVisible();
    await expect(page.getByText("Everything You Did Not Say In The Elevator")).toHaveCount(0);

    await page.goto("/search?q=Elevator");
    await expect(page.getByTestId("search-empty")).toBeVisible();

    await page.goto(`/story/${E2E_TEEN_STORY}`);
    await expect(page.getByTestId("story-title")).toHaveCount(0);

    await page.goto("/settings");
    await page.getByLabel("Date of birth").fill("2000-01-01");
    await page.getByRole("main").getByRole("button", { name: "Confirm" }).click();
    await page.getByTestId("birth-confirm-modal").getByRole("button", { name: "Confirm" }).click();

    await page.getByTestId("mature-toggle").click();
    const modal = page.getByTestId("mature-confirm-modal");
    await modal.getByRole("checkbox", { name: /18 or older/ }).check();
    await modal.getByRole("button", { name: "Turn on" }).click();

    await page.goto("/search?q=Elevator");
    const result = page.getByTestId("search-result").filter({ hasText: "Elevator" });
    await expect(result).toBeVisible();
    await expect(result.getByTestId("teen-badge")).toBeVisible();
    await page.goto(`/story/${E2E_TEEN_STORY}`);
    await expect(page.getByTestId("story-title")).toContainText("Elevator");

    // A 16-year-old cannot turn it on at all.
    await loginAs(page, "minor-e2e015@test.com");
    await page.goto("/settings");
    const year = new Date().getFullYear() - 16;
    await page.getByLabel("Date of birth").fill(`${year}-01-01`);
    await page.getByRole("main").getByRole("button", { name: "Confirm" }).click();
    await page.getByTestId("birth-confirm-modal").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByTestId("mature-toggle")).toBeDisabled();
    await expect(page.getByText("Unlocks at 18.")).toBeVisible();
  });

  test("E2E-019: liking a story, and finding it again", async ({ page }) => {
    await loginAs(page, "like-e2e019@test.com");
    await page.goto("/");
    await page.getByTestId("story-card").first().click();
    await expect(page).toHaveURL(/\/story\//);
    const like = page.getByTestId("like-button");
    const before = Number(await like.getAttribute("data-count"));

    await like.click();
    await expect(like).toHaveAttribute("data-count", String(before + 1));
    await expect(like).toHaveAttribute("data-liked", "true");

    await page.goto("/me");
    await expect(page.getByTestId("liked-row").getByTestId("story-card")).toHaveCount(1);

    // Getting back to it from the liked row is the point of the row, and it
    // proves the like survives a fresh server render rather than client state.
    await page.getByTestId("liked-row").getByTestId("story-card").first().click();
    await expect(page).toHaveURL(/\/story\//);
    const again = page.getByTestId("like-button");
    await expect(again).toHaveAttribute("data-liked", "true");
    await again.click();
    await expect(again).toHaveAttribute("data-count", String(before));
    await expect(again).toHaveAttribute("data-liked", "false");
  });

  /**
   * The plan page has one job: say that the core loop is not metered. If this
   * ever starts reading like the benchmark's credit wall, we have lost the
   * thing that differentiates us.
   */
  test("E2E-028: the plan page leads with unlimited, and Canon is free on every tier", async ({
    page,
  }) => {
    await loginAs(page, "plans-e2e028@test.com");
    await page.goto("/settings");
    await expect(page.getByText("Standard turns are unlimited.")).toBeVisible();
    await expect(page.getByTestId("plan-FREE")).toContainText("Unlimited turns on the Standard");
    await expect(page.getByTestId("plan-READER")).toContainText("$9.99");
    await expect(page.getByTestId("plan-READER")).toContainText("$7.99 on the web");
    await expect(page.getByText(/Editing your Canon is free on every plan/)).toBeVisible();
  });

  /** NY GBL Art. 47 and CA SB 243 require the disclosure to be visible, not buried. */
  test("E2E-029: the AI-safeguards policy states the disclosure and crisis behaviour", async ({
    page,
  }) => {
    await page.goto("/legal/safety");
    await expect(page.getByText("You are talking to an AI", { exact: false })).toBeVisible();
    await expect(page.getByText(/every three hours/)).toBeVisible();
    await expect(page.getByText(/988/)).toBeVisible();
    await page.goto("/legal/content");
    await expect(page.getByText(/Original work only/i)).toBeVisible();
    await expect(page.getByText(/not published here at any rating/i)).toBeVisible();
  });

  test("E2E-030: reporting a story is one tap from the story page", async ({ page }) => {
    await loginAs(page, "report-e2e030@test.com");
    await startRoute(page);
    await page.goto("/");
    await page.getByTestId("story-card").first().click();
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("button", { name: /Uses an existing IP/ }).click();
    await expect(page.getByText("Thanks — we will take a look.")).toBeVisible();
  });
});
