import { test, expect } from "@playwright/test";
import { loginAs, sendMessage } from "./helpers";

/** Advance a step and wait for the indicator to catch up. */
async function nextStep(page: import("@playwright/test").Page, to: number) {
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByTestId("step-indicator")).toHaveAttribute("data-step", String(to));
}

test.describe("Creating", () => {
  test("E2E-013: one line becomes a whole story, then goes live", async ({ page }) => {
    await loginAs(page, "creator-e2e013@test.com", "Wren");
    await page.goto("/");
    await page.getByTestId("bottom-tab").getByText("Create").click();
    await expect(page).toHaveURL(/\/create/);

    await page
      .getByLabel(/One line/)
      .fill("The duke who bought my family's debt has never once mentioned money.");
    await page.getByRole("button", { name: "Draft it for me" }).click();

    await expect(page.getByLabel("Title")).toHaveValue(/duke/i, { timeout: 40_000 });
    await expect(page.getByLabel("The world")).not.toHaveValue("");
    await nextStep(page, 2);

    await page.getByTestId("character-item").getByText("Aldric Vaun").click();
    await expect(page).toHaveURL(/\/characters\//);
    await page.getByLabel("Voice").fill("Clipped, imperative, formal only when he is losing.");
    await page.getByRole("button", { name: "Save and go back" }).click();
    await expect(page.getByTestId("step-indicator")).toHaveAttribute("data-step", "2");
    await nextStep(page, 3);

    await page.getByLabel("Name").first().fill("The night of the contract");
    await nextStep(page, 4);

    await sendMessage(page, "Good evening.");
    await expect(page.getByTestId("ai-line").last()).toContainText('"');
    await nextStep(page, 5);

    await page.getByTestId("tag-select").getByRole("button", { name: "slow burn" }).click();
    await page.getByTestId("tag-select").getByRole("button", { name: "court intrigue" }).click();
    await page.getByRole("radio", { name: "All ages" }).check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();

    await expect(page.getByText("It is live.")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("link", { name: "See the story page" }).click();
    await expect(page).toHaveURL(/\/story\//);
    await expect(page.getByTestId("story-title")).toContainText(/duke/i);

    await page.goto("/");
    await expect(
      page.getByTestId("section-new").getByText(/duke/i).first()
    ).toBeVisible();
  });

  /**
   * The benchmark's builder generates stats and endings field by field, behind
   * an eight-step wizard. Generating them up front is what makes a first-time
   * creator finish, so it has to actually happen — not just be offered.
   */
  test("E2E-027: the AI draft ships playable structure, not just prose", async ({ page }) => {
    await loginAs(page, "creator-e2e027@test.com");
    const created = await page.request.post("/api/stories/draft", {
      data: { premise: "A city that runs on debts nobody writes down." },
    });
    expect(created.ok()).toBeTruthy();
    const story = await created.json();

    expect(story.intros.length).toBeGreaterThanOrEqual(2);
    const intro = story.intros[0];
    expect(intro.stats.length).toBeGreaterThanOrEqual(2);
    expect(intro.stats[0].levels.length).toBeGreaterThanOrEqual(2);
    expect(intro.endings.length).toBeGreaterThanOrEqual(4);
    expect(intro.endings.map((e: { rarity: string }) => e.rarity)).toContain("SSR");
    // Rarer endings must actually be harder, not just labelled.
    const ssr = intro.endings.find((e: { rarity: string }) => e.rarity === "SSR");
    expect(ssr.rules.length).toBeGreaterThan(0);
    expect(story.keywords.length).toBeGreaterThanOrEqual(3);
    expect(intro.playGuide).not.toEqual("");
  });

  test("E2E-014: publishing is blocked when the story uses someone else's IP", async ({ page }) => {
    await loginAs(page, "creator-e2e014@test.com");
    await page.goto("/create?blank=1");
    await page.getByRole("button", { name: "Start blank" }).click();
    await page.getByLabel("Title").fill("I married the strongest sorcerer");
    await page.getByLabel("Logline").fill("A test logline.");
    await page
      .getByLabel("The world")
      .fill("A school where Gojo Satoru teaches, and you end up married to him.");
    await nextStep(page, 2);
    await nextStep(page, 3);
    await page
      .getByLabel("Establishing prose")
      .first()
      .fill("A dim classroom full of chalk dust, and he turns around.");
    await page.getByLabel("Opening scene").first().fill('"You came," he says. "I wondered."');
    await nextStep(page, 4);
    await nextStep(page, 5);
    await page.getByRole("radio", { name: "All ages" }).check();
    await page.getByRole("button", { name: "Publish", exact: true }).click();

    const err = page.getByTestId("moderation-error");
    await expect(err).toContainText("existing work or character");
    await expect(err).toContainText("gojo satoru");

    // Fix the offending field and publish again.
    await page.getByRole("button", { name: /Back to step 1/ }).click();
    await expect(page.getByTestId("step-indicator")).toHaveAttribute("data-step", "1");
    await page
      .getByLabel("The world")
      .fill("A school of sorcery, and the strongest teacher in it is nobody you have heard of.");
    await nextStep(page, 2);
    await nextStep(page, 3);
    await nextStep(page, 4);
    await nextStep(page, 5);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("It is live.")).toBeVisible({ timeout: 20_000 });
  });

  test("E2E-018: the studio shows real numbers from the first story", async ({ page }) => {
    await loginAs(page, "author-e2e018@test.com", "Stats Author");
    const created = await page.request.post("/api/stories/draft", {
      data: { premise: "A statistician who only ever talks in numbers, and the one who listens." },
    });
    expect(created.ok()).toBeTruthy();
    const story = await created.json();
    const pub = await page.request.post(`/api/stories/${story.id}/publish`, {
      data: { visibility: "PUBLISHED" },
    });
    expect(pub.ok()).toBeTruthy();

    for (let i = 1; i <= 3; i++) {
      await loginAs(page, `stats-reader${i}@test.com`);
      const st = await page.request.post("/api/routes", {
        data: { storyId: story.id, introId: story.intros[0].id },
      });
      expect(st.ok()).toBeTruthy();
      if (i <= 2) {
        expect((await page.request.post(`/api/stories/${story.id}/like`)).ok()).toBeTruthy();
      }
    }

    await loginAs(page, "author-e2e018@test.com");
    await page.goto("/studio");
    const card = page.getByTestId("work-card").filter({ hasText: "statistician" });
    await expect(card.getByTestId("stat-readers")).toContainText("3");
    await expect(card.getByTestId("stat-likes")).toContainText("2");
    await card.getByRole("button", { name: "Stats" }).click();
    await expect(card.getByTestId("mini-chart")).toBeVisible();
    await expect(page.getByTestId("weekly-summary")).toContainText("Players");
  });
});
