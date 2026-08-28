import { defineConfig, devices } from "@playwright/test";

const E2E_DB = "postgresql://headcanon:headcanon@localhost:5432/headcanon_e2e";
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // One shared database, so the suite runs serially.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 }, // phone-first
    locale: "en-US",
  },
  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        // Use the image-bundled Chromium; it does not match the pinned build.
        launchOptions: { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL: E2E_DB,
      AUTH_SECRET: "e2e-secret",
      AUTH_DEV_MODE: "true",
      AUTH_TRUST_HOST: "true",
      LLM_PROVIDER: "mock",
      E2E_MODE: "1",
      GENERATION_TIMEOUT_MS: "15000",
      NODE_ENV: "development",
    },
  },
});
