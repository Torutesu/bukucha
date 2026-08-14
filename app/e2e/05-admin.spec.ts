import { test, expect, Page } from "@playwright/test";
import { loginAs, E2E_SITUATION } from "./helpers";

/**
 * 管理画面(/admin)。認可・通報キュー・審査フラグレビュー・作品/ユーザー操作・監査ログ。
 * 運営アカウントはシードの seed-author@bukucha.local (role=ADMIN)。
 */

const ADMIN_EMAIL = "seed-author@bukucha.local";

/** window.prompt / window.confirm を自動応答 */
function autoDialog(page: Page, text = "") {
  page.on("dialog", (d) => d.accept(text));
}

test.describe("管理画面", () => {
  test("ADM-001: アクセス制御", async ({ page }) => {
    // 一般ユーザーは403
    await loginAs(page, "normal-adm001@test.com");
    await page.goto("/admin");
    await expect(page.getByText("このページを表示する権限がありません")).toBeVisible();
    const api = await page.request.get("/api/admin/overview");
    expect(api.status()).toBe(403);

    // 運営は概要が見える
    await loginAs(page, ADMIN_EMAIL);
    await page.goto("/admin");
    await expect(page.getByTestId("admin-overview")).toBeVisible();
    await expect(page.getByText("未対応の通報")).toBeVisible();
  });

  test("ADM-002: 通報の対応フロー", async ({ page }) => {
    // 一般ユーザーが通報
    await loginAs(page, "reporter-adm002@test.com");
    const r = await page.request.post("/api/reports", {
      data: {
        targetType: "situation",
        targetId: E2E_SITUATION,
        reason: "不適切な内容",
        detail: "ADM-002テスト通報",
      },
    });
    expect(r.ok()).toBeTruthy();

    // 運営が対応済みにする
    await loginAs(page, ADMIN_EMAIL);
    autoDialog(page, "確認のうえ問題なしと判断");
    await page.goto("/admin/reports");
    const row = page.getByTestId("report-row").filter({ hasText: "ADM-002テスト通報" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "対応済みにする" }).click();
    await expect(row).toHaveCount(0);

    // 対応済みタブへ移動している
    await page.getByRole("button", { name: "対応済み", exact: true }).click();
    await expect(
      page.getByTestId("report-row").filter({ hasText: "ADM-002テスト通報" })
    ).toBeVisible();

    // 監査ログに残る
    await page.goto("/admin/audit");
    await expect(
      page.getByTestId("audit-row").filter({ hasText: "report.resolved" }).first()
    ).toBeVisible();
  });

  test("ADM-003: 審査フラグの誤検出承認→強制公開", async ({ page }) => {
    // 作者がIP名を含む作品を公開しようとしてブロックされる
    await loginAs(page, "author-adm003@test.com", "フラグ作者");
    const created = await page.request.post("/api/situations/draft", {
      data: { fantasy: "ADM-003用の物語。孤高の彼と図書室で出会い惹かれ合う。" },
    });
    expect(created.ok()).toBeTruthy();
    const situation = await created.json();
    const patched = await page.request.patch(`/api/situations/${situation.id}`, {
      data: { title: "ADM003フラグ検証作品", worldSetting: "五条悟のような雰囲気の彼と過ごす学園。" },
    });
    expect(patched.ok()).toBeTruthy();
    const pub = await page.request.post(`/api/situations/${situation.id}/publish`, {
      data: { visibility: "PUBLISHED" },
    });
    const pubBody = await pub.json();
    expect(pubBody.blocked?.length).toBeGreaterThan(0);

    // 運営がフラグを誤検出として承認
    await loginAs(page, ADMIN_EMAIL);
    autoDialog(page, "固有名詞ではなく比喩表現のため");
    await page.goto("/admin/flags");
    const flag = page.getByTestId("flag-row").filter({ hasText: "ADM003フラグ検証作品" });
    await expect(flag.first()).toBeVisible();
    await flag.first().getByRole("button", { name: "誤検出として承認" }).click();
    await expect(
      page.getByTestId("flag-row").filter({ hasText: "ADM003フラグ検証作品" })
    ).toHaveCount(0);

    // 作品管理から強制公開
    await page.goto("/admin/situations");
    await page.getByPlaceholder("タイトル・作者名・IDで検索").fill("ADM003フラグ検証作品");
    await page.getByRole("button", { name: "検索" }).click();
    const row = page.getByTestId("situation-row").filter({ hasText: "ADM003フラグ検証作品" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "強制公開" }).click();
    await expect(row.getByText("PUBLISHED")).toBeVisible();

    // 読者から見えるようになっている
    await loginAs(page, "reader-adm003@test.com");
    await page.goto(`/s/${situation.id}`);
    await expect(page.getByTestId("situation-title")).toContainText("ADM003フラグ検証作品");
  });

  test("ADM-004: 作品の停止と復帰", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    autoDialog(page, "ADM-004テスト停止");
    await page.goto("/admin/situations");
    await page.getByPlaceholder("タイトル・作者名・IDで検索").fill(E2E_SITUATION);
    await page.getByRole("button", { name: "検索" }).click();
    const row = page.getByTestId("situation-row");
    await expect(row).toHaveCount(1);

    await row.getByRole("button", { name: "停止する" }).click();
    await expect(row.getByText("SUSPENDED")).toBeVisible();

    // 読者からは404相当
    await loginAs(page, "reader-adm004@test.com");
    await page.goto(`/s/${E2E_SITUATION}`);
    await expect(page.getByText("この物語は現在公開されていません")).toBeVisible();

    // 復帰
    await loginAs(page, ADMIN_EMAIL);
    await page.goto(`/admin/situations?`);
    await page.getByPlaceholder("タイトル・作者名・IDで検索").fill(E2E_SITUATION);
    await page.getByRole("button", { name: "検索" }).click();
    await row.getByRole("button", { name: "停止を解除" }).click();
    await expect(row.getByText("PUBLISHED")).toBeVisible();
  });

  test("ADM-005: ユーザーBANで作品も停止・ログイン拒否", async ({ page }) => {
    // BAN対象ユーザーが作品を公開
    await loginAs(page, "banned-adm005@test.com", "BAN対象");
    const created = await page.request.post("/api/situations/draft", {
      data: { fantasy: "ADM-005用の物語。彼は雨の日にだけ現れる不思議な隣人。" },
    });
    const situation = await created.json();
    await page.request.patch(`/api/situations/${situation.id}`, {
      data: { title: "ADM005BAN検証作品" },
    });
    const pub = await page.request.post(`/api/situations/${situation.id}/publish`, {
      data: { visibility: "PUBLISHED" },
    });
    expect(pub.ok()).toBeTruthy();

    // 運営がBAN
    await loginAs(page, ADMIN_EMAIL);
    autoDialog(page, "ADM-005テストBAN");
    await page.goto("/admin/users");
    await page.getByPlaceholder("ニックネーム・メール・IDで検索").fill("banned-adm005@test.com");
    await page.getByRole("button", { name: "検索" }).click();
    const row = page.getByTestId("user-row").filter({ hasText: "banned-adm005@test.com" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "BANする" }).click();
    await expect(row.getByText("BAN", { exact: true })).toBeVisible();

    // 作品は停止され、本人はログイン不可
    await page.goto(`/s/${situation.id}`);
    // 運営には停止中として見える(オーナー/管理経路以外は404)
    const login = await page.request.post("/api/auth/login", {
      data: { email: "banned-adm005@test.com" },
    });
    expect(login.status()).toBe(403);

    // BAN解除で復帰できる
    await page.goto("/admin/users");
    await page.getByPlaceholder("ニックネーム・メール・IDで検索").fill("banned-adm005@test.com");
    await page.getByRole("button", { name: "検索" }).click();
    await row.getByRole("button", { name: "BAN解除" }).click();
    await expect(row.getByText("BAN", { exact: true })).toHaveCount(0);
    const relogin = await page.request.post("/api/auth/login", {
      data: { email: "banned-adm005@test.com" },
    });
    expect(relogin.ok()).toBeTruthy();
  });
});
