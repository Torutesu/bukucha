import { test, expect } from "@playwright/test";
import { loginAs, sendMessage, E2E_SITUATION } from "./helpers";

test.describe("リーダー(コア体験)", () => {
  test("E2E-002: ゲスト3往復体験→登録壁→引き継ぎ", async ({ page }) => {
    await page.goto(`/story/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await expect(page).toHaveURL(/\/route\/guest/);
    await expect(page.getByTestId("novel-stream")).toContainText("湊先輩");

    for (let i = 1; i <= 3; i++) {
      await sendMessage(page, `こんにちは${i}`);
      await expect(page.getByTestId("novel-stream")).toContainText(`こんにちは${i}`);
    }

    // 4往復目で登録壁
    const input = page.getByPlaceholder(/セリフか/);
    await input.fill("4回目のメッセージ");
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByTestId("guest-gate")).toBeVisible();

    await page.getByTestId("guest-gate").getByRole("link", { name: /登録して続きを読む/ }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByRole("button", { name: "メールでつづける" }).click();
    await page.getByPlaceholder("メールアドレス").fill("guest-migrate@test.com");
    await page.getByRole("button", { name: "ログイン" }).click();

    // 引き継ぎ後: ゲストの3往復が残り、4回目の入力が復元
    await expect(page).toHaveURL(/\/route\/(?!guest)/, { timeout: 15_000 });
    await expect(page.getByTestId("novel-stream")).toContainText("こんにちは1");
    await expect(page.getByTestId("novel-stream")).toContainText("こんにちは3");
    await expect(page.getByPlaceholder(/セリフか/)).toHaveValue("4回目のメッセージ");
  });

  test("E2E-006: 読む(streaming/ノベル組版/開始シチュ選択)", async ({ page }) => {
    await loginAs(page, "reader-e2e006@test.com");
    await page.goto(`/story/${E2E_SITUATION}`);
    await page.getByRole("radio", { name: /雨の帰り道で/ }).check();
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await expect(page).toHaveURL(/\/route\//);
    // 選択したイントロの内容
    await expect(page.getByTestId("novel-stream")).toContainText("昇降口");
    await expect(page.getByTestId("novel-stream")).toContainText("半分濡れるのは、俺でいい");

    await sendMessage(page, "*傘を差し出す* どうぞ");
    const stream = page.getByTestId("novel-stream");
    await expect(stream.getByTestId("user-line").last()).toContainText("どうぞ");
    // 地の文(斜体)扱い
    await expect(stream.getByTestId("user-line").last().locator("em")).toContainText(
      "傘を差し出す"
    );
    // ノベル形式応答(地の文+「」)
    await expect(stream.getByTestId("ai-line").last()).toContainText("「");
  });

  test("E2E-007: 空欄送信=つづきを読む", async ({ page }) => {
    await loginAs(page, "reader-e2e007@test.com");
    await page.goto(`/story/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await sendMessage(page, "ねえ、先輩");
    const userLines = page.getByTestId("user-line");
    const before = await userLines.count();

    await page.getByRole("button", { name: "つづきを読む" }).click();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    expect(await userLines.count()).toBe(before); // ユーザー発言は増えない
    await expect(page.getByTestId("ai-line").last()).toContainText("続き");
  });

  test("E2E-008: 選択肢タップで分岐", async ({ page }) => {
    await loginAs(page, "reader-e2e008@test.com");
    await page.goto(`/story/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await sendMessage(page, "一言目");
    await sendMessage(page, "二言目"); // 2回目のAI応答に選択肢(決定的)
    const choices = page.getByTestId("choice-card");
    await expect(choices.getByRole("button", { name: "手を取る" })).toBeVisible();

    await choices.getByRole("button", { name: "手を取る" }).click();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    await expect(page.getByTestId("user-line").last()).toContainText("手を取る");

    // 次の選択肢で「自分で書く」
    await sendMessage(page, "三言目");
    await expect(page.getByTestId("choice-card")).toBeVisible();
    await page.getByRole("button", { name: "自分で書く" }).click();
    await expect(page.getByPlaceholder(/セリフか/)).toBeFocused();
    await sendMessage(page, "自由入力です");
    await expect(page.getByTestId("user-line").last()).toContainText("自由入力です");
  });

  test("E2E-009: リロールと指示付き書き直し", async ({ page }) => {
    await loginAs(page, "reader-e2e009@test.com");
    await page.goto(`/story/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await sendMessage(page, "書き直しテスト");
    const aiCount = await page.getByTestId("ai-line").count();

    await page.getByRole("button", { name: "書き直す" }).click();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    expect(await page.getByTestId("ai-line").count()).toBe(aiCount); // 差し替え(増えない)

    // 指示付き
    await page.getByRole("button", { name: "書き直す" }).click({ delay: 700 }); // 長押し
    await page.getByPlaceholder(/方向を指定/).fill("もっと切なく");
    await page.getByRole("button", { name: "この方向で書き直す" }).click();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    await expect(page.getByTestId("ai-line").last()).toContainText("指示反映:もっと切なく");
  });

  test("E2E-010: 巻き戻し", async ({ page }) => {
    await loginAs(page, "reader-e2e010@test.com");
    await page.goto(`/story/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    for (let i = 1; i <= 5; i++) await sendMessage(page, `発言${i}`);

    await page.getByRole("button", { name: "少し戻る" }).click();
    // 3往復目のユーザー発言を巻き戻し先に選択
    await page.getByTestId("user-line").filter({ hasText: "発言3" }).click();
    await page.getByRole("button", { name: "ここまで戻す" }).click();

    await expect(page.getByTestId("novel-stream")).not.toContainText("発言4");
    await expect(page.getByTestId("novel-stream")).not.toContainText("発言5");
    await expect(page.getByPlaceholder(/セリフか/)).toBeFocused();

    await page.reload();
    await expect(page.getByTestId("novel-stream")).toContainText("発言3");
    await expect(page.getByTestId("novel-stream")).not.toContainText("発言4");
  });

  test("E2E-011: 本棚→あらすじ→再開", async ({ page }) => {
    await loginAs(page, "reader-e2e011@test.com");
    // 2作品を進める
    await page.goto(`/story/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await sendMessage(page, "1冊目のセリフ");
    await page.goto("/");
    await page.getByTestId("section-new").getByTestId("story-card").first().click();
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await sendMessage(page, "2冊目のセリフ");

    // SCR-006は没入のため下部タブ非表示。←で本棚に戻る
    await page.getByRole("button", { name: "戻る", exact: true }).click();
    await expect(page).toHaveURL(/\/bookshelf/);
    const cards = page.getByTestId("route-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.first().getByTestId("route-recap")).toContainText(/前回まで/);
    await expect(cards.first().getByTestId("route-progress")).toBeVisible();

    await cards.first().getByRole("link", { name: "つづきを読む" }).click();
    await expect(page).toHaveURL(/\/route\//);
    await expect(page.getByTestId("novel-stream")).toContainText("2冊目のセリフ");
  });

  test("E2E-012: 記憶(ユーザーノート)の編集と反映", async ({ page }) => {
    await loginAs(page, "reader-e2e012@test.com");
    await page.goto(`/story/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();

    await page.getByRole("button", { name: "メニュー" }).click();
    await page.getByRole("button", { name: "記憶" }).click();
    await page.getByPlaceholder(/いつも覚えていてほしいこと/).fill("私は猫アレルギー");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();
    await page.getByRole("button", { name: "閉じる" }).click();

    // 次の送信でプロンプトにuserNoteが入る(mockのdebugで検証)
    const resPromise = page.waitForResponse(
      (r) => r.url().includes("/messages") && r.request().method() === "POST"
    );
    await sendMessage(page, "覚えてる?");
    const res = await resPromise;
    const body = await res.text();
    expect(body).toContain('"hasUserNote":true');
  });

  test("E2E-016: 生成中の出力ブロック(寸止めライン)", async ({ page }) => {
    await loginAs(page, "reader-e2e016@test.com");
    await page.goto(`/story/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    const input = page.getByPlaceholder(/セリフか/);
    await input.fill("NGトリガー");
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByTestId("blocked-card")).toContainText(
      "表現ガイドラインに触れるため書けませんでした"
    );
    await expect(input).toHaveValue("NGトリガー"); // 入力復元
    // 物語は壊れず次の送信ができる
    await sendMessage(page, "別の話をしよう");
    await expect(page.getByTestId("ai-line").last()).toBeVisible();
  });

  test("E2E-017: 無料枠の上限(レート制限)体験", async ({ page }) => {
    await loginAs(page, "ratelimit@test.com"); // E2E_MODEでは上限3
    await page.goto(`/story/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    for (let i = 1; i <= 3; i++) await sendMessage(page, `メッセージ${i}`);

    const input = page.getByPlaceholder(/セリフか/);
    await input.fill("4通目");
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByTestId("quota-card")).toContainText(
      "今日はここまで。また明日つづきを読めます"
    );
  });
});
