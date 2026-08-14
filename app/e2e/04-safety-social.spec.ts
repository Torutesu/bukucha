import { test, expect } from "@playwright/test";
import { loginAs, E2E_R15_SITUATION } from "./helpers";

test.describe("安全・ソーシャル", () => {
  test("E2E-015: 安心フィルターと年齢確認", async ({ page }) => {
    // birthDate未設定 → R15は一切見えない
    await loginAs(page, "safety-e2e015@test.com");
    await page.goto("/");
    await expect(page.getByText("R15テスト作品")).toHaveCount(0);

    await page.goto("/search?q=R15テスト作品");
    await expect(page.getByTestId("search-empty")).toBeVisible();

    await page.goto(`/s/${E2E_R15_SITUATION}`);
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

    // R15が🔞バッジ付きで出現
    await page.goto("/search?q=R15テスト作品");
    const result = page.getByTestId("search-result").filter({ hasText: "R15テスト作品" });
    await expect(result).toBeVisible();
    await expect(result.getByTestId("r15-badge")).toBeVisible();
    await page.goto(`/s/${E2E_R15_SITUATION}`);
    await expect(page.getByTestId("situation-title")).toContainText("R15テスト作品");

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

  test("E2E-044: Googleではじめる→登録→マイページ", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Googleではじめる" }).click();

    // 新規なので登録ステップ(名前→規約同意)
    await expect(page.getByRole("heading", { name: "アカウント登録" })).toBeVisible();
    await page.getByPlaceholder("キャラクターに呼んで欲しい名前").fill("ひなた");
    await page.getByRole("button", { name: "次へ" }).click();
    await page.getByRole("button", { name: "すべて同意する" }).click();
    await page.getByRole("button", { name: "同意する", exact: true }).click();
    await expect(page).toHaveURL(/\/$|\/\?/);

    // 名前がプロフィールとトークプロフィールの双方に入る
    await page.goto("/me");
    await expect(page.getByText("ひなた").first()).toBeVisible();
    await page.goto("/me/edit");
    await page.getByRole("button", { name: "トーク用" }).click();
    await expect(page.getByText("呼ばれ方: ひなた")).toBeVisible();

    // 同じ端末で再ログインすると同じアカウントに戻る(登録ステップは出ない)
    await page.request.post("/api/auth/logout");
    await page.goto("/login");
    await page.getByRole("button", { name: "Googleではじめる" }).click();
    await expect(page).toHaveURL(/\/$|\/\?/);
    await page.goto("/me");
    await expect(page.getByText("ひなた").first()).toBeVisible();
  });

  test("E2E-045: 表示テーマの切替と永続化", async ({ page }) => {
    await loginAs(page, "theme-e2e045@test.com");
    await page.goto("/settings");
    const html = page.locator("html");
    await expect(page.getByTestId("theme-picker")).toBeVisible();

    // ダークにするとdata-themeが付き、リロード後も維持される
    await page.getByTestId("theme-dark").click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(page.getByTestId("theme-dark")).toHaveAttribute("data-on", "true");

    // 他画面に移動しても維持される
    await page.goto("/");
    await expect(html).toHaveAttribute("data-theme", "dark");

    // ライトに戻す→システムに戻すと属性が外れる
    await page.goto("/settings");
    await page.getByTestId("theme-light").click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await page.getByTestId("theme-system").click();
    await expect(html).not.toHaveAttribute("data-theme", /.*/);
  });

  test("E2E-019: いいね", async ({ page }) => {
    await loginAs(page, "like-e2e019@test.com");
    await page.goto("/");
    await page.getByTestId("situation-card").first().click();
    const like = page.getByTestId("like-button");
    const before = Number(await like.getAttribute("data-count"));

    // クリックはハイドレーション前に空振りしうるため冪等リトライで収束させる
    await expect(async () => {
      if ((await like.getAttribute("data-liked")) === "false") await like.click();
      await expect(like).toHaveAttribute("data-liked", "true", { timeout: 1_500 });
    }).toPass({ timeout: 15_000 });
    await expect(like).toHaveAttribute("data-count", String(before + 1));

    await page.goto("/me");
    await expect(page.getByTestId("liked-row").getByTestId("situation-card")).toHaveCount(1);

    await page.goBack();
    const like2 = page.getByTestId("like-button");
    await expect(async () => {
      if ((await like2.getAttribute("data-liked")) === "true") await like2.click();
      await expect(like2).toHaveAttribute("data-liked", "false", { timeout: 1_500 });
    }).toPass({ timeout: 15_000 });
    await expect(like2).toHaveAttribute("data-count", String(before));
  });
});
