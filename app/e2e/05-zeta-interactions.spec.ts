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

test.describe("送信モードと物語進行", () => {
  test("E2E-037: 動作モード→地の文として送信・描画される", async ({ page }) => {
    await loginAs(page, "action-e2e037@test.com");
    await page.goto(`/s/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await expect(page).toHaveURL(/\/story\//);

    await page.getByTestId("mode-action").click();
    const input = page.getByPlaceholder(/主人公の動作/);
    await input.fill("窓辺に近づいて外を見る");
    // ライブプレビューが地の文(斜体)で出る
    await expect(page.getByTestId("input-preview").locator("em")).toContainText("窓辺に近づいて");
    const resPromise = page.waitForResponse(
      (r) => r.url().includes("/messages") && r.request().method() === "POST"
    );
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    // プロンプトには *〜* として渡る(mock debug)
    expect(await (await resPromise).text()).toContain('"promptedInput":"*窓辺に近づいて外を見る*"');
    // バブル内は全体が斜体
    await expect(page.getByTestId("user-line").last().locator("em")).toContainText("窓辺に近づいて外を見る");
    // リロードしても斜体のまま(kind永続化)
    await page.reload();
    await expect(page.getByTestId("user-line").last().locator("em")).toContainText("窓辺に近づいて外を見る");
  });

  test("E2E-038: 展開モード→プリセット指示で物語が進む", async ({ page }) => {
    await loginAs(page, "direction-e2e038@test.com");
    await page.goto(`/s/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await expect(page).toHaveURL(/\/story\//);

    await page.getByTestId("mode-direction").click();
    const presets = page.getByTestId("direction-preset");
    await expect(presets.first()).toContainText("時間を少し進めて");
    const resPromise = page.waitForResponse(
      (r) => r.url().includes("/messages") && r.request().method() === "POST"
    );
    await presets.first().click();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    // 中央の演出行として描画され、プロンプトには (展開指示: …) で渡る
    await expect(page.getByTestId("direction-line")).toContainText("時間を少し進めて");
    expect(await (await resPromise).text()).toContain('"promptedInput":"(展開指示: 時間を少し進めて、次の場面へ)"');
    // 送信後はセリフモードに戻る
    await expect(page.getByTestId("mode-say")).toHaveAttribute("data-on", "true");
    // リロードしても演出行のまま
    await page.reload();
    await expect(page.getByTestId("direction-line")).toContainText("時間を少し進めて");
  });

  test("E2E-039: 自分の発言をタップ→打ち直す", async ({ page }) => {
    await loginAs(page, "retype-e2e039@test.com");
    await page.goto(`/s/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await sendMessage(page, "まちがえた発言です");

    await page.getByTestId("user-line").last().click();
    await page.getByRole("button", { name: "打ち直す" }).click();
    // 発言と直後のAI応答が消え、本文が入力欄に復元される
    await expect(page.getByTestId("novel-stream")).not.toContainText("まちがえた発言です");
    await expect(page.getByPlaceholder(/セリフか/)).toHaveValue("まちがえた発言です");
    // 打ち直して送信できる
    await sendMessage(page, "正しい発言です");
    await expect(page.getByTestId("user-line").last()).toContainText("正しい発言です");
    await page.reload();
    await expect(page.getByTestId("novel-stream")).not.toContainText("まちがえた発言です");
    await expect(page.getByTestId("novel-stream")).toContainText("正しい発言です");
  });
});

test.describe("メッセージ周りのUI", () => {
  test("E2E-040: 下書き自動保存(リロードしても入力が残る)", async ({ page }) => {
    await loginAs(page, "draft-e2e040@test.com");
    await page.goto(`/s/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await expect(page).toHaveURL(/\/story\//);

    await page.getByTestId("mode-action").click();
    await page.getByPlaceholder(/主人公の動作/).fill("書きかけの下書きです");
    await page.waitForTimeout(300); // 保存effect反映待ち
    await page.reload();
    // 入力とモードの両方が復元される
    await expect(page.getByPlaceholder(/主人公の動作/)).toHaveValue("書きかけの下書きです");
    await expect(page.getByTestId("mode-action")).toHaveAttribute("data-on", "true");

    // 送信すると下書きは消える(リロード後はSAYモードに戻り、入力も空)
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByPlaceholder(/セリフか/)).toHaveValue("");
    await expect(page.getByTestId("mode-say")).toHaveAttribute("data-on", "true");
  });

  test("E2E-041: ⏩つづきボタンで物語が進む(ユーザー発言なし)", async ({ page }) => {
    await loginAs(page, "cont-e2e041@test.com");
    await page.goto(`/s/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await sendMessage(page, "一言だけ");
    const users = await page.getByTestId("user-line").count();
    const ais = await page.getByTestId("ai-line").count();

    await page.getByRole("button", { name: "つづきを生成" }).click();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    expect(await page.getByTestId("user-line").count()).toBe(users);
    expect(await page.getByTestId("ai-line").count()).toBe(ais + 1);
  });

  test("E2E-042: 送信ステータスと操作列のタイムスタンプ", async ({ page }) => {
    await loginAs(page, "status-e2e042@test.com");
    await page.goto(`/s/${E2E_SITUATION}`);
    await page.getByRole("button", { name: "この物語をはじめる" }).click();
    await expect(page).toHaveURL(/\/story\//);

    // 送信直後、生成中は「✓ 送信済み」が自分の発言の下に出る
    await page.getByPlaceholder(/セリフか/).fill("ステータス確認");
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByTestId("send-status")).toBeVisible();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    await expect(page.getByTestId("send-status")).toHaveCount(0);

    // 発言タップで操作列に時刻(H:MM)が出る
    await page.getByTestId("user-line").last().click();
    await expect(page.getByTestId("user-action-row")).toContainText(/\d{1,2}:\d{2}/);
  });
});
