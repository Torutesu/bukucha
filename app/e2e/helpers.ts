import { Page, expect } from "@playwright/test";

/** APIログイン(AUTH_DEV_MODE)。UIログインの検証はE2E-002が担う */
export async function loginAs(page: Page, email: string, nickname?: string) {
  const res = await page.request.post("/api/auth/login", {
    data: { email, nickname: nickname ?? email.split("@")[0] },
  });
  expect(res.ok()).toBeTruthy();
}

/** 生年月日設定+安心フィルターOFF(API経由) */
export async function setAdultAndFilterOff(page: Page, birthYear = 2000) {
  const res = await page.request.patch("/api/me", {
    data: { birthDate: `${birthYear}-01-01` },
  });
  expect(res.ok()).toBeTruthy();
  const res2 = await page.request.patch("/api/me", { data: { safeFilterOff: true } });
  expect(res2.ok()).toBeTruthy();
}

/** SCR-006で1往復送る(AI応答完了まで待つ) */
export async function sendMessage(page: Page, text: string) {
  const input = page.getByPlaceholder(/セリフか/);
  await input.fill(text);
  await page.getByRole("button", { name: "送信" }).click();
  await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
}

/**
 * SCR-006メニュー内トグルをON/OFFする(冪等リトライ)。
 * クリック直後の再レンダーでイベントが落ちるレースがあっても目標状態に収束させる
 */
export async function setReaderToggle(page: Page, testId: string, on: boolean) {
  const t = page.getByTestId(testId);
  await expect(async () => {
    const txt = (await t.textContent()) ?? "";
    if (txt.includes(on ? "OFF" : "ON")) await t.click();
    await expect(t).toContainText(on ? "ON" : "OFF", { timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
}

export const E2E_SITUATION = "sit_e2e_main";
export const E2E_R15_SITUATION = "sit_e2e_r15";
