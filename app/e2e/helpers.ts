import { Page, expect } from "@playwright/test";

/** API sign-in (AUTH_DEV_MODE). E2E-002 covers the UI path. */
export async function loginAs(page: Page, email: string, displayName?: string) {
  const res = await page.request.post("/api/auth/login", {
    data: { email, displayName: displayName ?? email.split("@")[0] },
  });
  expect(res.ok()).toBeTruthy();
}

/** Set a date of birth and opt in to mature stories, over the API. */
export async function setAdultAndMatureOn(page: Page, birthYear = 2000) {
  const res = await page.request.patch("/api/me", {
    data: { birthDate: `${birthYear}-01-01` },
  });
  expect(res.ok()).toBeTruthy();
  const res2 = await page.request.patch("/api/me", { data: { matureOptIn: true } });
  expect(res2.ok()).toBeTruthy();
}

/** One full turn on SCR-006, waiting for generation to settle. */
export async function sendMessage(page: Page, text: string) {
  const input = page.getByPlaceholder(/Say something/);
  await input.fill(text);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
}

/** Start a route on the flagship fixture and land in the reader. */
export async function startRoute(page: Page, introId = "intro_e2e_1") {
  const res = await page.request.post("/api/routes", {
    data: { storyId: E2E_STORY, introId },
  });
  expect(res.ok()).toBeTruthy();
  const route = await res.json();
  await page.goto(`/play/${route.id}`);
  await expect(page.getByTestId("novel-stream")).toBeVisible();
  return route.id as string;
}

export const E2E_STORY = "story_e2e_main";
export const E2E_TEEN_STORY = "story_e2e_teen";
