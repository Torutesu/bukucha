import { test, expect } from "@playwright/test";
import { loginAs, sendMessage } from "./helpers";

/** 次へを押して、ステップインジケータが目的のステップになるまで待つ */
async function nextStep(page: import("@playwright/test").Page, to: number) {
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByTestId("step-indicator")).toHaveAttribute("data-step", String(to));
}

test.describe("創作フロー", () => {
  test("E2E-013: 妄想一文→AI下書き→編集→テスト→公開", async ({ page }) => {
    await loginAs(page, "creator-e2e013@test.com", "ゆめの");
    await page.goto("/");
    await page.getByTestId("bottom-tab").getByText("作る").click();
    await expect(page).toHaveURL(/\/create/);

    // Step0: 妄想入力→AI下書き
    await page
      .getByLabel(/妄想を、一文で/)
      .fill("没落令嬢の私を買ったのは、冷酷と噂の若き公爵だった");
    await page.getByRole("button", { name: "AIに下書きしてもらう" }).click();

    // Step1: フォームが埋まっている
    await expect(page.getByLabel("タイトル")).toHaveValue(/没落令嬢/, { timeout: 40_000 });
    await expect(page.getByLabel("世界観")).not.toHaveValue("");
    await nextStep(page, 2);

    // Step2: キャラ編集(SCR-010)
    await page.getByTestId("character-item").getByText("アルベルト").click();
    await expect(page).toHaveURL(/\/characters\//);
    await page.getByLabel("口調・話し方").fill("俺様口調。一人称は俺。命令形が多い。");
    await page.getByRole("button", { name: "保存して戻る" }).click();
    await expect(page.getByTestId("step-indicator")).toHaveAttribute("data-step", "2");
    await nextStep(page, 3);

    // Step3: 開始シチュのラベル変更
    await page.getByLabel("ラベル").first().fill("初夜の交渉");
    await nextStep(page, 4);

    // Step4: テスト会話
    await sendMessage(page, "よろしくお願いします");
    await expect(page.getByTestId("ai-line").last()).toContainText("「");
    await nextStep(page, 5);

    // Step5: タグ・レベル・公開
    await page.getByTestId("tag-select").getByRole("button", { name: "身分差" }).click();
    await page.getByTestId("tag-select").getByRole("button", { name: "策略婚" }).click();
    await page.getByRole("radio", { name: "全年齢" }).check();
    await page.getByRole("button", { name: "公開する" }).click();

    // 完了→作品ページ
    await expect(page.getByText("公開しました")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("link", { name: "作品ページを見る" }).click();
    await expect(page).toHaveURL(/\/s\//);
    await expect(page.getByTestId("situation-title")).toContainText("没落令嬢");

    // ホーム新着に出る
    await page.goto("/");
    await page.getByTestId("tab-new").click();
    await expect(
      page.getByTestId("section-new").getByText(/没落令嬢の私を買ったのは/).first()
    ).toBeVisible();
  });

  test("E2E-014: 二次創作の公開ブロック", async ({ page }) => {
    await loginAs(page, "creator-e2e014@test.com");
    await page.goto("/create?blank=1");
    // 白紙から作る
    await page.getByRole("button", { name: "白紙から作る" }).click();
    await page.getByLabel("タイトル").fill("最強の術師と結婚しました");
    await page.getByLabel("ひとこと紹介").fill("テスト用のひとこと。");
    await page.getByLabel("世界観").fill("五条悟が出てくる学園で、彼と結婚する物語。");
    await nextStep(page, 2);
    await nextStep(page, 3); // Step2(デフォルトキャラのまま)
    // Step3: はじまりは公開に必須
    await page.getByLabel("導入の地の文").first().fill("薄暗い術式の教室で、彼は振り返った。");
    await page.getByLabel("最初の返答").first().fill("「よく来たね。待ってたよ」");
    await nextStep(page, 4);
    await nextStep(page, 5); // Step4スキップ
    await page.getByRole("radio", { name: "全年齢" }).check();
    await page.getByRole("button", { name: "公開する" }).click();

    const err = page.getByTestId("moderation-error");
    await expect(err).toContainText("既存作品のキャラクター・作品名が含まれています");
    await expect(err).toContainText("五条悟");

    // 該当箇所を修正して再公開
    await page.getByRole("button", { name: /Step1/ }).click();
    await expect(page.getByTestId("step-indicator")).toHaveAttribute("data-step", "1");
    await page.getByLabel("世界観").fill("最強の術師の彼と結婚する、オリジナルの物語。");
    await nextStep(page, 2);
    await nextStep(page, 3);
    await nextStep(page, 4);
    await nextStep(page, 5);
    await page.getByRole("button", { name: "公開する" }).click();
    await expect(page.getByText("公開しました")).toBeVisible({ timeout: 20_000 });
  });

  test("E2E-018: スタジオの統計表示", async ({ page }) => {
    // 作者が作品を公開
    await loginAs(page, "author-e2e018@test.com", "統計作者");
    const created = await page.request.post("/api/situations/draft", {
      data: { fantasy: "統計テスト用の物語。彼はいつも数字の話ばかりする。" },
    });
    expect(created.ok()).toBeTruthy();
    const situation = await created.json();
    const pub = await page.request.post(`/api/situations/${situation.id}/publish`, {
      data: { visibility: "PUBLISHED" },
    });
    expect(pub.ok()).toBeTruthy();

    // 読者3人がStory開始、うち2人がいいね
    for (let i = 1; i <= 3; i++) {
      await loginAs(page, `stats-reader${i}@test.com`);
      const intro = situation.intros[0];
      const st = await page.request.post("/api/stories", {
        data: { situationId: situation.id, introVariantId: intro.id },
      });
      expect(st.ok()).toBeTruthy();
      if (i <= 2) {
        const like = await page.request.post(`/api/situations/${situation.id}/like`);
        expect(like.ok()).toBeTruthy();
      }
    }

    // 作者でスタジオ確認
    await loginAs(page, "author-e2e018@test.com");
    await page.goto("/studio");
    const card = page.getByTestId("work-card").filter({ hasText: "統計テスト用" });
    await expect(card.getByTestId("stat-readers")).toContainText("3");
    await expect(card.getByTestId("stat-likes")).toContainText("2");
    await card.getByRole("button", { name: "統計" }).click();
    await expect(card.getByTestId("mini-chart")).toBeVisible();
    await expect(page.getByTestId("weekly-summary")).toContainText("読者");
  });
});
