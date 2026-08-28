import { test, expect } from "@playwright/test";
import { loginAs, E2E_R15_SITUATION } from "./helpers";

test.describe("安全・ソーシャル", () => {
  test("E2E-015: 安心フィルターと年齢確認", async ({ page }) => {
    // birthDate未設定 → TEENは一切見えない
    await loginAs(page, "safety-e2e015@test.com");
    await page.goto("/");
    await expect(page.getByTestId("safe-filter-banner")).toBeVisible();
    await expect(page.getByText("TEENテスト作品")).toHaveCount(0);

    await page.goto("/search?q=TEENテスト作品");
    await expect(page.getByTestId("search-empty")).toBeVisible();

    await page.goto(`/story/${E2E_R15_SITUATION}`);
    await expect(page.getByText("この物語は表示できません")).toBeVisible();

    // 年齢確認(20歳)→フィルターOFF
    await page.goto("/settings");
    await page.getByLabel("生年月日").fill("2000-01-01");
    await page.getByRole("button", { name: "生年月日を確定" }).click();
    await page.getByRole("button", { name: "確定する" }).click(); // 確認ダイアログ

    await page.getByTestId("safe-filter-toggle").click();
    const modal = page.getByTestId("filter-confirm-modal");
    await modal.getByRole("checkbox", { name: /18歳以上です/ }).check();
    await modal.getByRole("button", { name: "OFFにする" }).click();

    // TEENが🔞バッジ付きで出現
    await page.goto("/search?q=TEENテスト作品");
    const result = page.getByTestId("search-result").filter({ hasText: "TEENテスト作品" });
    await expect(result).toBeVisible();
    await expect(result.getByTestId("r15-badge")).toBeVisible();
    await page.goto(`/story/${E2E_R15_SITUATION}`);
    await expect(page.getByTestId("story-title")).toContainText("TEENテスト作品");

    // 16歳ユーザーはトグル無効
    await loginAs(page, "minor-e2e015@test.com");
    await page.goto("/settings");
    const year = new Date().getFullYear() - 16;
    await page.getByLabel("生年月日").fill(`${year}-01-01`);
    await page.getByRole("button", { name: "生年月日を確定" }).click();
    await page.getByRole("button", { name: "確定する" }).click();
    await expect(page.getByTestId("safe-filter-toggle")).toBeDisabled();
    await expect(page.getByText("18歳になったら解除できます")).toBeVisible();
  });

  test("E2E-019: いいね", async ({ page }) => {
    await loginAs(page, "like-e2e019@test.com");
    await page.goto("/");
    await page.getByTestId("story-card").first().click();
    const like = page.getByTestId("like-button");
    const before = Number(await like.getAttribute("data-count"));

    await like.click();
    await expect(like).toHaveAttribute("data-count", String(before + 1));
    await expect(like).toHaveAttribute("data-liked", "true");

    await page.goto("/me");
    await expect(page.getByTestId("liked-row").getByTestId("story-card")).toHaveCount(1);

    await page.goBack();
    await page.getByTestId("like-button").click();
    await expect(page.getByTestId("like-button")).toHaveAttribute(
      "data-count",
      String(before)
    );
  });
});
