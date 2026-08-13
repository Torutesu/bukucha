import { test, expect } from "@playwright/test";
import { loginAs, E2E_SITUATION } from "./helpers";

test.describe("発見フロー", () => {
  test("E2E-001: 初回訪問→タグ選択→おすすめから読み始める", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome/);
    const chips = page.getByTestId("onboarding-tag");
    await expect(chips.first()).toBeVisible();
    expect(await chips.count()).toBeGreaterThanOrEqual(12);

    await page.getByRole("button", { name: "溺愛" }).click();
    await page.getByRole("button", { name: "身分差" }).click();
    await page.getByRole("button", { name: "つぎへ" }).click();

    const cards = page.getByTestId("recommend-card");
    await expect(cards).toHaveCount(3);
    await cards.first().click();

    await expect(page).toHaveURL(/\/s\//);
    await expect(page.getByTestId("situation-title")).toBeVisible();
    await expect(page.getByText("世界観")).toBeVisible();
    await expect(page.getByText("登場人物")).toBeVisible();
    await expect(page.getByTestId("intro-preview")).toBeVisible();
  });

  test("E2E-003: ホームのセクションとカード表示", async ({ page }) => {
    await loginAs(page, "reader-e2e003@test.com");
    await page.goto("/");
    // Zeta型: トレンド/ベスト/新作のタブでグリッドを切り替える
    await expect(page.getByTestId("section-forYou")).toBeVisible();
    await page.getByTestId("tab-popular").click();
    await expect(page.getByTestId("section-popular")).toBeVisible();
    await page.getByTestId("tab-new").click();
    await expect(page.getByTestId("section-new")).toBeVisible();
    await page.getByTestId("tab-forYou").click();

    const card = page.getByTestId("situation-card").first();
    await expect(card).toBeVisible();
    await expect(card.getByTestId("card-cover")).toBeVisible();
    await expect(card.getByTestId("card-title")).toBeVisible();
    await expect(card.getByTestId("card-catch")).toBeVisible();
    await expect(card.getByTestId("card-stories")).toBeVisible();
    await expect(card.getByTestId("card-author")).toBeVisible();
    await expect(card.getByTestId("card-rank")).toHaveText("1");

    // タグチップはその場でグリッドを絞り込む
    await page.getByTestId("home-tags").getByRole("button", { name: "執着" }).click();
    await expect(page.getByTestId("section-forYou")).toBeVisible();
    await expect(page.getByTestId("situation-card").first()).toBeVisible();

    const tab = page.getByTestId("bottom-tab");
    for (const name of ["ホーム", "トーク", "作成", "マイ"]) {
      await expect(tab.getByText(name)).toBeVisible();
    }
  });

  test("E2E-004: タグ検索→絞り込み→結果から詳細へ", async ({ page }) => {
    await loginAs(page, "reader-e2e004@test.com");
    await page.goto("/");
    await page.getByRole("link", { name: "検索" }).click();
    await expect(page).toHaveURL(/\/search/);
    await page.getByTestId("tag-option").getByText("執着", { exact: true }).click();
    await expect(page.getByTestId("selected-tag").getByText("執着")).toBeVisible();
    await expect(page.getByTestId("search-result").first()).toBeVisible();

    await page.getByTestId("tag-option").getByText("秘密", { exact: true }).click();
    await expect(page.getByTestId("selected-tag").getByText("秘密")).toBeVisible();

    // AND検索: 表示結果が「執着かつ秘密」の集合と一致する
    const expected = await page
      .request.get("/api/search?tags=" + encodeURIComponent("執着,秘密"))
      .then((r) => r.json())
      .then((j: { items: { title: string }[] }) => j.items.map((i) => i.title).sort());
    expect(expected.length).toBeGreaterThan(0);
    await expect(page.getByTestId("search-result")).toHaveCount(expected.length);
    const shown = (await page.getByTestId("search-result").allInnerTexts())
      .map((t) => t.split("\n")[0])
      .sort();
    expect(shown).toEqual(expected);

    await page.getByRole("button", { name: "新着" }).click();
    await expect(page).toHaveURL(/sort=new/);

    await page.getByTestId("search-result").first().click();
    await expect(page).toHaveURL(/\/s\//);
  });

  test("E2E-022: PC中央SPビュー", async ({ page }) => {
    await loginAs(page, "reader-e2e022@test.com");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const shell = page.getByTestId("app-shell");
    const box = await shell.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(482);
    expect(Math.abs(box!.x + box!.width / 2 - 720)).toBeLessThan(10); // 中央
    const hasHScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHScroll).toBeFalsy();

    // Story画面も同様
    await page.goto(`/s/${E2E_SITUATION}`);
    const box2 = await page.getByTestId("app-shell").boundingBox();
    expect(box2!.width).toBeLessThanOrEqual(482);

    // SP幅で崩れなし
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const hasHScrollSp = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHScrollSp).toBeFalsy();
  });
});
