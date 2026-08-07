import { test, expect } from "@playwright/test";
import { loginAs, sendMessage, setReaderToggle, E2E_SITUATION } from "./helpers";

/** Zeta詳細インタラクション(返信候補/AI編集/分岐/選択肢OFF/高品質モデル) */
test.describe("Zeta詳細インタラクション", () => {
  test("E2E-030: 返信候補→タップで入力欄に反映→送信", async ({ page }) => {
    await loginAs(page, "suggest-e2e030@test.com");
    await page.goto(`/s/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await expect(page).toHaveURL(/\/story\//);

    await page.getByRole("button", { name: "返信候補" }).click();
    const chips = page.getByTestId("suggest-chip");
    await expect(chips).toHaveCount(2);
    await expect(page.getByTestId("suggest-remaining")).toContainText(/残り \d+ 回/);

    // タップで入力欄へ(編集可能な状態で入る=そのまま送信もできる)
    const first = (await chips.first().textContent())!.replace(/^✦\s*/, "").trim();
    await chips.first().click();
    await expect(page.getByPlaceholder(/セリフか/)).toHaveValue(first);
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    await expect(page.getByTestId("user-line").last()).toContainText("見つめられたら");
  });

  test("E2E-031: 返信候補の日次クォータ", async ({ page }) => {
    await loginAs(page, "suggestlimit@test.com"); // E2E_MODEでは上限2
    await page.goto(`/s/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await expect(page).toHaveURL(/\/story\//);

    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "返信候補" }).click();
      await expect(page.getByTestId("suggest-chip").first()).toBeVisible();
      await page.getByRole("button", { name: "返信候補" }).click(); // チップを閉じる
      await expect(page.getByTestId("suggest-chip")).toHaveCount(0);
    }
    await page.getByRole("button", { name: "返信候補" }).click();
    await expect(page.getByTestId("suggest-notice")).toContainText("今日の返信候補はここまで");
  });

  test("E2E-032: AI応答のペン編集(直接直す)が永続化される", async ({ page }) => {
    await loginAs(page, "edit-e2e032@test.com");
    await page.goto(`/s/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await sendMessage(page, "編集テスト");

    await page.getByTestId("ai-line").last().click();
    await page.getByRole("button", { name: "直接直す" }).click();
    const area = page.getByTestId("edit-area").locator("textarea");
    await area.fill("彼は静かに笑って、雨の音だけが残った。「ここは私が書き換えた物語」");
    await page.getByTestId("edit-save").click();
    await expect(page.getByTestId("ai-line").last()).toContainText("私が書き換えた物語");

    await page.reload();
    await expect(page.getByTestId("ai-line").last()).toContainText("私が書き換えた物語");
  });

  test("E2E-033: 選択肢のON/OFF切替", async ({ page }) => {
    await loginAs(page, "choices-e2e033@test.com");
    await page.goto(`/s/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await expect(page).toHaveURL(/\/story\//);

    // OFFにする → 偶数ターンでも選択肢が出ない
    await page.getByRole("button", { name: "メニュー" }).click();
    await setReaderToggle(page, "toggle-choices", false);
    await page.mouse.click(10, 400); // メニューを閉じる
    await sendMessage(page, "一言目");
    await sendMessage(page, "二言目");
    await expect(page.getByTestId("choice-card")).toHaveCount(0);

    // ONに戻す → 次の偶数ターンで選択肢が出る
    await page.getByRole("button", { name: "メニュー" }).click();
    await setReaderToggle(page, "toggle-choices", true);
    await page.mouse.click(10, 400);
    await sendMessage(page, "三言目");
    await sendMessage(page, "四言目");
    await expect(page.getByTestId("choice-card")).toBeVisible();
  });

  test("E2E-034: ここから分岐→並行ルートの一覧と切替", async ({ page }) => {
    await loginAs(page, "branch-e2e034@test.com");
    await page.goto(`/s/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await expect(page).toHaveURL(/\/story\//);
    const originalUrl = page.url();
    await sendMessage(page, "分岐前の発言");

    // 最新AI応答から分岐
    await page.getByTestId("ai-line").last().click();
    await page.getByTestId("branch-button").click();
    await expect(page).toHaveURL(/\/story\//);
    await expect(page).not.toHaveURL(originalUrl);
    // 分岐先にはここまでの本文が複製されている
    await expect(page.getByTestId("novel-stream")).toContainText("分岐前の発言");

    // ルート一覧: 2ルート、現在ルートに印、切替できる
    await page.getByRole("button", { name: "メニュー" }).click();
    await page.getByRole("button", { name: /ルート/ }).click();
    const items = page.getByTestId("route-item");
    await expect(items).toHaveCount(2);
    await expect(page.getByTestId("route-sheet")).toContainText("いま読んでいる");
    await expect(page.getByTestId("route-sheet")).toContainText("(分岐)");
    await items.filter({ hasNotText: "いま読んでいる" }).first().click();
    await expect(page).toHaveURL(originalUrl);
  });

  test("E2E-035: 高品質モデル切替が生成に反映され永続化される", async ({ page }) => {
    await loginAs(page, "midmodel-e2e035@test.com");
    await page.goto(`/s/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await expect(page).toHaveURL(/\/story\//);

    await page.getByRole("button", { name: "メニュー" }).click();
    await setReaderToggle(page, "toggle-midmodel", true);
    await page.mouse.click(10, 400);
    await expect(page.getByTestId("model-chip")).toBeVisible();

    // 生成がmidティアで行われる(mockのdebugで検証)
    const resPromise = page.waitForResponse(
      (r) => r.url().includes("/messages") && r.request().method() === "POST"
    );
    await sendMessage(page, "モデル確認");
    expect(await (await resPromise).text()).toContain('"modelTier":"mid"');

    // リロードしても設定が残る
    await page.reload();
    await expect(page.getByTestId("model-chip")).toBeVisible();
  });

  test("E2E-036: 入力の *〜* ライブプレビューとAI本文のセリフ強調", async ({ page }) => {
    await loginAs(page, "typo-e2e036@test.com");
    await page.goto(`/s/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await expect(page).toHaveURL(/\/story\//);

    // 入力中の *〜* が地の文プレビューされる
    await page.getByPlaceholder(/セリフか/).fill("*そっと近づく* こんばんは");
    await expect(page.getByTestId("input-preview").locator("em")).toContainText("そっと近づく");

    // AI応答の「」セリフが強調スパンになる
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    await expect(page.getByTestId("ai-line").last().locator(".dialogue").first()).toContainText("「");
  });
});
