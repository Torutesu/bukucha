import { test, expect } from "@playwright/test";
import { loginAs, sendMessage, startRoute, E2E_STORY } from "./helpers";

test.describe("Reader — the core experience", () => {
  test("E2E-002: play signed out, hit the gate, carry the route across sign-in", async ({
    page,
  }) => {
    await page.goto(`/story/${E2E_STORY}`);
    await page.getByRole("button", { name: /no account needed/ }).click();
    await expect(page).toHaveURL(/\/play\/guest/);
    await expect(page.getByTestId("novel-stream")).toContainText("Minato");

    for (let i = 1; i <= 3; i++) {
      await sendMessage(page, `hello ${i}`);
      await expect(page.getByTestId("novel-stream")).toContainText(`hello ${i}`);
    }

    const input = page.getByPlaceholder(/Say something/);
    await input.fill("the fourth thing");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("guest-gate")).toBeVisible();

    await page.getByTestId("guest-gate").getByRole("link", { name: /Save it and continue/ }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByRole("button", { name: "Continue with email" }).click();
    await page.getByPlaceholder("you@example.com").fill("guest-migrate@test.com");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // Nothing played is lost, and the unsent line is still in the box.
    await expect(page).toHaveURL(/\/play\/(?!guest)/, { timeout: 15_000 });
    await expect(page.getByTestId("novel-stream")).toContainText("hello 1");
    await expect(page.getByTestId("novel-stream")).toContainText("hello 3");
    await expect(page.getByPlaceholder(/Say something/)).toHaveValue("the fourth thing");
  });

  test("E2E-006: streaming prose, chosen opening, action formatting", async ({ page }) => {
    await loginAs(page, "reader-e2e006@test.com");
    await page.goto(`/story/${E2E_STORY}`);
    await page.getByRole("radio", { name: /The walk home/ }).check();
    await page.getByRole("button", { name: "Start this story" }).click();
    await expect(page).toHaveURL(/\/play\//);
    await expect(page.getByTestId("novel-stream")).toContainText("Get under");

    await sendMessage(page, "*holds out the umbrella* Take it.");
    const stream = page.getByTestId("novel-stream");
    await expect(stream.getByTestId("user-line").last()).toContainText("Take it.");
    await expect(stream.getByTestId("user-line").last().locator("em")).toContainText(
      "holds out the umbrella"
    );
    await expect(stream.getByTestId("ai-line").last()).toContainText('"');
  });

  test("E2E-007: an empty send continues the scene without speaking", async ({ page }) => {
    await loginAs(page, "reader-e2e007@test.com");
    await startRoute(page);
    await sendMessage(page, "Senpai.");
    const userLines = page.getByTestId("user-line");
    const before = await userLines.count();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    expect(await userLines.count()).toBe(before);
    await expect(page.getByTestId("ai-line").last()).toContainText("I am listening");
  });

  test("E2E-008: choices branch, and you can always write your own", async ({ page }) => {
    await loginAs(page, "reader-e2e008@test.com");
    await startRoute(page);
    await sendMessage(page, "first");
    await sendMessage(page, "second");
    const choices = page.getByTestId("choice-card");
    await expect(choices.getByRole("button", { name: "Take his hand" })).toBeVisible();

    await choices.getByRole("button", { name: "Take his hand" }).click();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    await expect(page.getByTestId("user-line").last()).toContainText("Take his hand");

    await sendMessage(page, "third");
    await expect(page.getByTestId("choice-card")).toBeVisible();
    await page.getByRole("button", { name: "Say something else" }).click();
    await expect(page.getByPlaceholder(/Say something/)).toBeFocused();
    await sendMessage(page, "my own words");
    await expect(page.getByTestId("user-line").last()).toContainText("my own words");
  });

  test("E2E-009: rewrite in place, and rewrite with steering", async ({ page }) => {
    await loginAs(page, "reader-e2e009@test.com");
    await startRoute(page);
    await sendMessage(page, "rewrite me");
    const aiCount = await page.getByTestId("ai-line").count();

    await page.getByRole("button", { name: "Rewrite" }).click();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    expect(await page.getByTestId("ai-line").count()).toBe(aiCount);

    await page.getByRole("button", { name: "Rewrite" }).click({ delay: 700 });
    await page.getByPlaceholder(/slower/).fill("slower, and let him hesitate");
    await page.getByRole("button", { name: "Rewrite", exact: true }).last().click();
    await expect(page.getByTestId("generating")).toBeHidden({ timeout: 30_000 });
    await expect(page.getByTestId("ai-line").last()).toContainText(
      "Steering: slower, and let him hesitate"
    );
  });

  test("E2E-010: rewind drops the turns after the chosen point, and survives reload", async ({
    page,
  }) => {
    await loginAs(page, "reader-e2e010@test.com");
    await startRoute(page);
    for (let i = 1; i <= 5; i++) await sendMessage(page, `line ${i}`);

    await page.getByRole("button", { name: "Go back" }).click();
    await page.getByTestId("user-line").filter({ hasText: "line 3" }).click();
    await page.getByRole("button", { name: "Rewind to here" }).click();

    await expect(page.getByTestId("novel-stream")).not.toContainText("line 4");
    await expect(page.getByTestId("novel-stream")).not.toContainText("line 5");
    await expect(page.getByPlaceholder(/Say something/)).toBeFocused();

    await page.reload();
    await expect(page.getByTestId("novel-stream")).toContainText("line 3");
    await expect(page.getByTestId("novel-stream")).not.toContainText("line 4");
  });

  test("E2E-011: library recaps and resumes", async ({ page }) => {
    await loginAs(page, "reader-e2e011@test.com");
    await startRoute(page);
    await sendMessage(page, "first route line");
    await page.goto("/");
    await page.getByTestId("section-new").getByTestId("story-card").first().click();
    await page.getByRole("button", { name: "Start this story" }).click();
    await sendMessage(page, "second route line");

    // The reader hides the tab bar for immersion, so back exits to the library.
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/\/library/);
    const cards = page.getByTestId("route-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.first().getByTestId("route-recap")).toContainText(/Previously/);
    await expect(cards.first().getByTestId("route-progress")).toBeVisible();

    await cards.first().getByRole("link", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/play\//);
    await expect(page.getByTestId("novel-stream")).toContainText("second route line");
  });

  test("E2E-012: the standing note reaches the model", async ({ page }) => {
    await loginAs(page, "reader-e2e012@test.com");
    await startRoute(page);

    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByTestId("open-canon").click();
    await page.getByPlaceholder(/always be true of you/).fill("I am allergic to cats.");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    // Reload first: the note has to come back from the server, not from state.
    await page.reload();
    await expect(page.getByTestId("novel-stream")).toBeVisible();

    const resPromise = page.waitForResponse(
      (r) => r.url().includes("/messages") && r.request().method() === "POST"
    );
    await sendMessage(page, "do you remember?");
    expect(await (await resPromise).text()).toContain('"hasUserNote":true');
  });

  /**
   * The differentiator, tested rather than asserted.
   *
   * 23% of the benchmark's negative reviews are the model forgetting what it
   * was explicitly told — and re-teaching it costs the reader credits. This
   * proves a fact settled at turn 1 is still in the prompt many turns later,
   * that the reader can correct it for free, and that the correction lands.
   */
  test("E2E-024: canon is extracted, still injected many turns later, and editable", async ({
    page,
  }) => {
    await loginAs(page, "reader-e2e024@test.com");
    await startRoute(page);

    await sendMessage(page, "My name is Wren.");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByTestId("open-canon").click();
    // Facts are rendered as editable inputs — correcting one has to be a single
    // tap, so assert on their values rather than on text nodes.
    const facts = page.getByTestId("canon-panel").getByTestId("canon-fact").locator("input");
    await expect(facts.first()).toBeVisible();
    expect((await facts.allTextContents()).length).toBeGreaterThan(0);
    const values = await facts.evaluateAll((els) =>
      els.map((e) => (e as HTMLInputElement).value)
    );
    expect(values.join(" ")).toContain("Wren");
    await page.getByRole("button", { name: "Close" }).click();

    // Play well past the point where a rolling summary would have compressed it.
    for (let i = 1; i <= 8; i++) await sendMessage(page, `filler turn ${i}`);

    const resPromise = page.waitForResponse(
      (r) => r.url().includes("/messages") && r.request().method() === "POST"
    );
    await sendMessage(page, "still here?");
    expect(await (await resPromise).text()).toContain("Wren");

    // Correcting the record costs nothing and takes effect on the next turn.
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByTestId("open-canon").click();
    await page.getByTestId("canon-new").fill("His umbrella is green, not navy.");
    await page.getByRole("button", { name: "Add" }).click();
    await expect
      .poll(async () =>
        (
          await page
            .getByTestId("canon-fact")
            .locator("input")
            .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))
        ).join(" ")
      )
      .toContain("green, not navy");
    await page.getByRole("button", { name: "Close" }).click();

    const res2 = page.waitForResponse(
      (r) => r.url().includes("/messages") && r.request().method() === "POST"
    );
    await sendMessage(page, "about that umbrella");
    expect(await (await res2).text()).toContain("green, not navy");
  });

  test("E2E-025: stats move for a stated reason and show in the HUD", async ({ page }) => {
    await loginAs(page, "reader-e2e025@test.com");
    await startRoute(page);
    const hud = page.getByTestId("stat-hud");
    await expect(hud).toBeVisible();
    await expect(page.getByTestId("stat-trust")).toContainText("Trust");
    const before = await page.getByTestId("stat-trust").innerText();

    await sendMessage(page, "I stayed.");
    await expect(page.getByTestId("stat-delta").last()).toContainText("Trust +5");
    await expect(page.getByTestId("stat-delta").last()).toContainText("you stayed");
    await expect(page.getByTestId("stat-trust")).not.toHaveText(before);

    await page.reload();
    await expect(page.getByTestId("stat-trust")).not.toHaveText(before);
  });

  test("E2E-016: a blocked turn does not break the story, and the input comes back", async ({
    page,
  }) => {
    await loginAs(page, "reader-e2e016@test.com");
    await startRoute(page);
    const input = page.getByPlaceholder(/Say something/);
    await input.fill("BLOCK_TRIGGER");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("blocked-card")).toContainText("crosses a line we hold");
    await expect(input).toHaveValue("BLOCK_TRIGGER");
    await sendMessage(page, "let us talk about something else");
    await expect(page.getByTestId("ai-line").last()).toBeVisible();
  });

  /** AIF-010: generation is replaced, not decorated. */
  test("E2E-026: a crisis message stops generation and shows real resources", async ({ page }) => {
    await loginAs(page, "reader-e2e026@test.com");
    await startRoute(page);
    await expect(page.getByTestId("ai-line").first()).toBeVisible();
    const before = await page.getByTestId("ai-line").count();

    const input = page.getByPlaceholder(/Say something/);
    await input.fill("I want to kill myself");
    await page.getByRole("button", { name: "Send" }).click();

    const card = page.getByTestId("crisis-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText("988");
    // Nothing was generated and nothing was written into the story.
    await expect(page.getByTestId("ai-line")).toHaveCount(before);
    await page.reload();
    await expect(page.getByTestId("novel-stream")).toBeVisible();
    await expect(page.getByTestId("ai-line")).toHaveCount(before);
  });

  test("E2E-017: the fair-use ceiling reads as a pause, not a bill", async ({ page }) => {
    await loginAs(page, "ratelimit@test.com"); // ceiling pinned to 3 in E2E_MODE
    await startRoute(page);
    for (let i = 1; i <= 3; i++) await sendMessage(page, `message ${i}`);

    const input = page.getByPlaceholder(/Say something/);
    await input.fill("the fourth");
    await page.getByRole("button", { name: "Send" }).click();
    const card = page.getByTestId("quota-card");
    await expect(card).toContainText("Give it a moment and continue");
    // Never a price, never a plan pitch, at the fair-use ceiling.
    await expect(card).not.toContainText("$");
  });
});
