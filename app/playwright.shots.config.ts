import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

/**
 * 共有用スクリーンショットの撮影専用。通常のE2E(`npm run test:e2e`)には含めない。
 *   npm run shots        → shots/*.png を撮る
 *   python3 build-share-page.py → shots_web/*.webp に圧縮して共有HTMLを生成
 */
export default defineConfig({
  ...base,
  testDir: "./screenshots",
});
