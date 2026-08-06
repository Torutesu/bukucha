import { test } from "@playwright/test";
import { loginAs, sendMessage, E2E_SITUATION } from "../e2e/helpers";
import * as fs from "fs";

const OUT = "shots";  // 生PNG(gitignore)。共有用webpは build-share-page.py が shots_web/ に生成

test("capture screens", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const shot = async (name: string) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  };

  // 1. オンボーディング
  await page.goto("/welcome");
  await page.getByRole("button", { name: "溺愛" }).click();
  await page.getByRole("button", { name: "身分差" }).click();
  await page.getByRole("button", { name: "執着" }).click();
  await shot("01-onboarding");

  await page.getByRole("button", { name: "つぎへ" }).click();
  await page.waitForTimeout(800);
  await shot("02-onboarding-recommend");

  // 2. ホーム
  await loginAs(page, "demo@bukucha.local", "ゆめの");
  await page.goto("/");
  await page.waitForTimeout(1200);
  await shot("03-home");

  // 3. 検索
  await page.goto("/search");
  await page.waitForTimeout(900);
  await shot("04-search-tags");

  await page.goto("/search?tags=" + encodeURIComponent("溺愛"));
  await page.waitForTimeout(1200);
  await shot("05-search-results");

  // 4. 作品詳細
  await page.goto(`/s/${E2E_SITUATION}`);
  await page.waitForTimeout(1200);
  await shot("06-situation-detail");

  // 5. ノベルリーダー
  await page.getByRole("button", { name: "この物語をはじめる" }).click();
  await page.waitForTimeout(1200);
  await shot("07-reader-start");

  await sendMessage(page, "*そっと隣に並ぶ* 先輩、傘、持ってないんです");
  await page.waitForTimeout(500);
  await shot("08-reader-turn");

  await sendMessage(page, "……どうして、そんなこと言うんですか");
  await page.waitForTimeout(600);
  await shot("09-reader-choices");

  // 6. 本棚
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.waitForTimeout(1800);
  await shot("10-bookshelf");

  // 7. 作成ウィザード
  await page.goto("/create");
  await page.getByLabel(/妄想を、一文で/).fill("没落令嬢の私を買ったのは、冷酷と噂の若き公爵だった");
  await shot("11-create-fantasy");

  await page.getByRole("button", { name: "AIに下書きしてもらう" }).click();
  await page.waitForTimeout(2500);
  await shot("12-create-draft");

  await page.getByRole("button", { name: "次へ" }).click();
  await page.waitForTimeout(700);
  await shot("13-create-characters");

  await page.goto("/create?situationId=" + (await page.url().split("situationId=")[1] ?? ""), {
    waitUntil: "domcontentloaded",
  }).catch(() => {});

  // 8. スタジオ
  await page.goto("/studio");
  await page.waitForTimeout(1200);
  await shot("14-studio");

  // 9. 設定(年齢確認/安心フィルター)
  await page.goto("/settings");
  await page.waitForTimeout(900);
  await shot("15-settings");

  // 10. マイページ
  await page.goto("/me");
  await page.waitForTimeout(900);
  await shot("16-mypage");

  // 11. ダークテーマのリーダー
  await page.goto("/settings");
  await page.getByRole("button", { name: "ダーク" }).click();
  await page.waitForTimeout(400);
  await page.goto("/bookshelf");
  await page.waitForTimeout(1500);
  await page.getByTestId("story-card").first().getByRole("link", { name: "つづきを読む" }).click();
  await page.waitForTimeout(1500);
  await shot("17-reader-dark");

  // 12. PC中央SPビュー
  await page.goto("/settings");
  await page.getByRole("button", { name: "システム" }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/18-desktop.png` });
});
