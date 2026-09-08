import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./seo-tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.SEO_BASE_URL ?? "http://localhost:3128",
    ...devices["Pixel 7"],
    locale: "ja-JP",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
});
