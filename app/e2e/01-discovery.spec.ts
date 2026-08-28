import { test, expect } from "@playwright/test";
import { loginAs, E2E_STORY } from "./helpers";

test.describe("Discovery", () => {
  test("E2E-001: first visit, pick tropes, start reading from a recommendation", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome/);
    const chips = page.getByTestId("onboarding-tag");
    await expect(chips.first()).toBeVisible();
    expect(await chips.count()).toBeGreaterThanOrEqual(10);

    await page.getByRole("button", { name: "slow burn", exact: true }).click();
    await page.getByRole("button", { name: "enemies to lovers", exact: true }).click();
    await page.getByRole("button", { name: "Show me something" }).click();

    const cards = page.getByTestId("recommend-card");
    await expect(cards).toHaveCount(3);
    await cards.first().click();

    await expect(page).toHaveURL(/\/story\//);
    await expect(page.getByTestId("story-title")).toBeVisible();
    await expect(page.getByText("The world")).toBeVisible();
    await expect(page.getByText("Who you will meet")).toBeVisible();
    await expect(page.getByTestId("intro-preview")).toBeVisible();
  });

  test("E2E-003: home sections and card anatomy", async ({ page }) => {
    await loginAs(page, "reader-e2e003@test.com");
    await page.goto("/");
    await expect(page.getByTestId("section-forYou")).toBeVisible();
    await expect(page.getByTestId("section-popular")).toBeVisible();
    await expect(page.getByTestId("section-new")).toBeVisible();

    const card = page.getByTestId("story-card").first();
    await expect(card).toBeVisible();
    await expect(card.getByTestId("card-cover")).toBeVisible();
    await expect(card.getByTestId("card-title")).toBeVisible();
    await expect(card.getByTestId("card-logline")).toBeVisible();
    await expect(card.getByTestId("card-players")).toBeVisible();
    await expect(card.getByTestId("card-likes")).toBeVisible();

    const tab = page.getByTestId("bottom-tab");
    for (const name of ["Discover", "Library", "Create", "You"]) {
      await expect(tab.getByText(name)).toBeVisible();
    }
  });

  test("E2E-004: tag search narrows with AND and leads to a story", async ({ page }) => {
    await loginAs(page, "reader-e2e004@test.com");
    await page.goto("/");
    await page.getByTestId("home-tags").getByRole("button", { name: "slow burn" }).click();
    await expect(page).toHaveURL(/\/search/);
    await expect(page.getByTestId("selected-tag").getByText("slow burn")).toBeVisible();
    await expect(page.getByTestId("search-result").first()).toBeVisible();

    await page.getByTestId("tag-option").getByText("historical", { exact: true }).click();
    await expect(page.getByTestId("selected-tag").getByText("historical")).toBeVisible();

    // The visible set must equal the AND of both tags, not the OR.
    const expected = await page.request
      .get("/api/search?tags=" + encodeURIComponent("slow burn,historical"))
      .then((r) => r.json())
      .then((j: { items: { title: string }[] }) => j.items.map((i) => i.title).sort());
    expect(expected.length).toBeGreaterThan(0);
    await expect(page.getByTestId("search-result")).toHaveCount(expected.length);
    const shown = (await page.getByTestId("search-result").allInnerTexts())
      .map((t) => t.split("\n")[0])
      .sort();
    expect(shown).toEqual(expected);

    await page.getByRole("button", { name: "Newest" }).click();
    await expect(page).toHaveURL(/sort=new/);

    await page.getByTestId("search-result").first().click();
    await expect(page).toHaveURL(/\/story\//);
  });

  test("E2E-023: the story page is server-rendered and readable signed out", async ({
    page,
    request,
  }) => {
    // Discovery in this market runs on name search, so the page has to exist
    // for a crawler with no session and no JavaScript.
    const slug = await request
      .get(`/api/stories/${E2E_STORY}`)
      .then((r) => r.json())
      .then((j: { slug: string }) => j.slug);

    const res = await request.get(`/story/${slug}`);
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    expect(html).toContain("He Is Only Honest When It Rains");
    expect(html).toContain('property="og:title"');
    expect(html).toContain("application/ld+json");

    await page.goto(`/story/${slug}`);
    await expect(page.getByTestId("story-title")).toBeVisible();
    await expect(page.getByRole("button", { name: /no account needed/ })).toBeVisible();
  });

  test("E2E-022: phone shell on discovery, wide shell in the reader", async ({ page }) => {
    await loginAs(page, "reader-e2e022@test.com");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const box = await page.getByTestId("app-shell").boundingBox();
    expect(box!.width).toBeLessThanOrEqual(522);
    expect(Math.abs(box!.x + box!.width / 2 - 720)).toBeLessThan(10);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      )
    ).toBeFalsy();

    // The reader gets the extra width, and the state rail with it.
    const res = await page.request.post("/api/routes", {
      data: { storyId: E2E_STORY, introId: "intro_e2e_1" },
    });
    const route = await res.json();
    await page.goto(`/play/${route.id}`);
    await expect(page.getByTestId("reader-rail")).toBeVisible();
    const wide = await page.getByTestId("app-shell").boundingBox();
    expect(wide!.width).toBeGreaterThan(600);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      )
    ).toBeFalsy();
  });
});
