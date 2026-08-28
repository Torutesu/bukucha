import { test } from "@playwright/test";
import { loginAs, sendMessage, E2E_STORY } from "../e2e/helpers";
import * as fs from "fs";

// Raw PNGs (gitignored). build-share-page.py converts these into shots_web/.
const OUT = "shots";

test("capture screens", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const shot = async (name: string) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  };

  // 1. Onboarding
  await page.goto("/welcome");
  await page.getByRole("button", { name: "slow burn", exact: true }).click();
  await page.getByRole("button", { name: "enemies to lovers", exact: true }).click();
  await page.getByRole("button", { name: "found family", exact: true }).click();
  await shot("01-onboarding");

  await page.getByRole("button", { name: "Show me something" }).click();
  await page.waitForTimeout(800);
  await shot("02-onboarding-recommend");

  // 2. Discover
  await loginAs(page, "demo@headcanon.local", "Wren");
  await page.goto("/");
  await page.waitForTimeout(1200);
  await shot("03-home");

  // 3. Search
  await page.goto("/search");
  await page.waitForTimeout(900);
  await shot("04-search-tags");

  await page.goto("/search?tags=" + encodeURIComponent("slow burn"));
  await page.waitForTimeout(1200);
  await shot("05-search-results");

  // 4. Story page
  await page.goto(`/story/${E2E_STORY}`);
  await page.waitForTimeout(1200);
  await shot("06-story-detail");

  // 5. The reader
  await page.getByRole("button", { name: "Start this story" }).click();
  await page.waitForTimeout(1200);
  await shot("07-reader-start");

  await sendMessage(page, "*steps under the awning beside him* I forgot mine again.");
  await page.waitForTimeout(500);
  await shot("08-reader-turn");

  await sendMessage(page, "Why do you always say things like that?");
  await page.waitForTimeout(600);
  await shot("09-reader-choices");

  // 6. Canon — the differentiator, so it gets its own frame.
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByTestId("open-canon").click();
  await page.waitForTimeout(600);
  await shot("10-canon");
  await page.getByRole("button", { name: "Close" }).click();

  // 7. Library
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.waitForTimeout(1800);
  await shot("11-library");

  // 8. The builder
  await page.goto("/create");
  await page
    .getByLabel(/One line/)
    .fill("The duke who bought my family's debt has never once mentioned money.");
  await shot("12-create-premise");

  await page.getByRole("button", { name: "Draft it for me" }).click();
  await page.waitForTimeout(2500);
  await shot("13-create-draft");

  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForTimeout(700);
  await shot("14-create-cast");

  // 9. Studio
  await page.goto("/studio");
  await page.waitForTimeout(1200);
  await shot("15-studio");

  // 10. Plans and age gate
  await page.goto("/settings");
  await page.waitForTimeout(900);
  await shot("16-settings-plans");

  // 11. Account
  await page.goto("/me");
  await page.waitForTimeout(900);
  await shot("17-account");

  // 12. The reader in dark
  await page.goto("/settings");
  await page.getByRole("button", { name: "Dark" }).click();
  await page.waitForTimeout(400);
  await page.goto("/library");
  await page.waitForTimeout(1500);
  await page.getByTestId("route-card").first().getByRole("link", { name: "Continue" }).click();
  await page.waitForTimeout(1500);
  await shot("18-reader-dark");

  // 13. The reader on desktop, two panes
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/19-reader-desktop.png` });

  await page.goto("/settings");
  await page.getByRole("button", { name: "System" }).click();
  await page.goto("/");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/20-desktop-home.png` });
});
