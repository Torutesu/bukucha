import { test, expect } from "@playwright/test";
import { loginAs, sendMessage } from "./helpers";

/** プロットエディタのタブ移動 */
async function toTab(page: import("@playwright/test").Page, key: string) {
  await page.getByTestId(`plot-tab-${key}`).click();
}

/** 初回に出る注意事項シートを閉じる(表示を待ってから) */
async function dismissNotice(page: import("@playwright/test").Page) {
  const btn = page.getByRole("button", { name: "確認しました" });
  await btn.click();
  await expect(btn).toBeHidden();
}

test.describe("創作フロー", () => {
  test("E2E-013: 妄想一文→AI下書き→プロット編集→テスト→公開", async ({ page }) => {
    await loginAs(page, "creator-e2e013@test.com", "ゆめの");
    await page.goto("/");
    await page.getByTestId("bottom-tab").getByText("作成").click();
    await expect(page).toHaveURL(/\/studio/);
    // 作成タブ(プロット一覧)の+FABから新規作成へ
    await page.getByRole("link", { name: "新しく作る" }).click();
    await expect(page).toHaveURL(/\/create/);

    // 妄想入力→AI下書き
    await page
      .getByLabel(/妄想を、一文で/)
      .fill("没落令嬢の私を買ったのは、冷酷と噂の若き公爵だった");
    await page.getByRole("button", { name: "AIに下書きしてもらう" }).click();

    // プロンプトタブ: フォームが埋まっている
    await expect(page.getByLabel("*題名")).toHaveValue(/没落令嬢/, { timeout: 40_000 });
    await dismissNotice(page);
    await expect(page.getByLabel("*説明")).not.toHaveValue("");

    // キャラクターをその場で編集(自動保存)
    const charName = page.getByTestId("character-item").first().getByLabel("*名前");
    await expect(charName).toHaveValue("アルベルト");
    await page
      .getByTestId("character-item")
      .first()
      .getByLabel("口調・話し方")
      .fill("俺様口調。一人称は俺。命令形が多い。");
    await page.getByLabel("*題名").click(); // blurで保存

    // スタイルタブ: 設定が保存される
    await toTab(page, "style");
    await page.getByRole("button", { name: "長い", exact: true }).click();
    await page.getByRole("button", { name: "ヤンデレ" }).click();

    // イントロタブ
    await toTab(page, "intro");
    await page.getByLabel("ラベル").first().fill("初夜の交渉");
    await page.getByLabel("導入の地の文").first().click();

    // テスト会話
    await page.getByRole("button", { name: /この口調をテストする/ }).click();
    await sendMessage(page, "よろしくお願いします");
    await expect(page.getByTestId("ai-line").last()).toContainText("「");
    await page.getByRole("button", { name: "テストを閉じる" }).click();

    // 紹介タブ: ハッシュタグ
    await toTab(page, "about");
    await page.getByTestId("tag-select").getByRole("button", { name: "身分差" }).click();
    await page.getByTestId("tag-select").getByRole("button", { name: "策略婚" }).click();

    // 完成(公開)
    await page.getByRole("button", { name: "完成" }).click();
    await expect(page.getByText("公開しました")).toBeVisible({ timeout: 20_000 });

    // 保存内容の反映を確認(スタイル/口調)
    const saved = await page.request.get("/api/studio/situations?status=PUBLISHED");
    const sid = (await saved.json()).items[0].id;
    const detail = await (await page.request.get(`/api/situations/${sid}`)).json();
    expect(detail.style.length).toBe("long");
    expect(detail.style.moods).toContain("ヤンデレ");
    expect(detail.characters[0].speechStyle).toContain("俺様口調");

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
    await page.getByRole("button", { name: "白紙から作る" }).click();
    await dismissNotice(page);

    await page.getByLabel("*題名").fill("最強の術師と結婚しました");
    await page.getByLabel("*説明").fill("五条悟が出てくる学園で、彼と結婚する物語。");
    await page.getByTestId("character-item").first().getByLabel("*名前").click(); // blurで保存

    // イントロは公開に必須
    await toTab(page, "intro");
    await page.getByLabel("導入の地の文").first().fill("薄暗い術式の教室で、彼は振り返った。");
    await page.getByLabel("最初の返答").first().fill("「よく来たね。待ってたよ」");
    await page.getByLabel("ラベル").first().click();

    await page.getByRole("button", { name: "完成" }).click();
    const err = page.getByTestId("moderation-error");
    await expect(err).toContainText("既存作品のキャラクター・作品名が含まれています");
    await expect(err).toContainText("五条悟");

    // 該当箇所を修正して再公開
    await page.getByRole("button", { name: "プロンプトを直す" }).click();
    await page.getByLabel("*説明").fill("最強の術師の彼と結婚する、オリジナルの物語。");
    await page.getByLabel("*題名").click();
    await page.getByRole("button", { name: "完成" }).click();
    await expect(page.getByText("公開しました")).toBeVisible({ timeout: 20_000 });
  });

  test("E2E-043: 設定集のキーワードが生成に伝わる", async ({ page }) => {
    await loginAs(page, "creator-e2e043@test.com");
    await page.goto("/create?blank=1");
    await page.getByRole("button", { name: "白紙から作る" }).click();
    await dismissNotice(page);

    await toTab(page, "lore");
    await page.getByRole("button", { name: /設定集を追加/ }).click();
    await page.getByTestId("lore-item").getByLabel("キーワード").fill("銀の懐中時計");
    await page.getByTestId("lore-item").getByLabel("内容").fill("亡き母の形見。触れると時が止まる。");
    await page.getByTestId("lore-item").getByLabel("キーワード").click();

    // キーワードを含む発言をすると設定集がプロンプトに載る(mockのdebugで検証)
    await toTab(page, "intro");
    await page.getByLabel("導入の地の文").first().fill("古い時計店の奥で、彼は顔を上げた。");
    await page.getByLabel("ラベル").first().click();
    await page.getByRole("button", { name: /この口調をテストする/ }).click();

    // キーワードに触れないうちは載らない
    const miss = page.waitForResponse((r) => r.url().includes("/test-turn"));
    await sendMessage(page, "こんばんは");
    expect(await (await miss).text()).not.toContain("亡き母の形見");

    // キーワードを言及すると設定集が載る
    const hit = page.waitForResponse((r) => r.url().includes("/test-turn"));
    await sendMessage(page, "銀の懐中時計を見せる");
    expect(await (await hit).text()).toContain("亡き母の形見");
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
