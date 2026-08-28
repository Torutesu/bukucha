import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Supply lanes.
 *
 * At launch there are no organic creators — every platform starts that way, and
 * our originals-only policy cuts us off from most of the 18M cards that already
 * exist elsewhere. So the catalogue is seeded three ways, and each one has a
 * rule that has to hold: Originals are marked, adaptations record who owns the
 * work, and imported cards never become public.
 */

/** A minimal PNG carrying a chara_card_v2 payload in a tEXt chunk. */
function characterCardPng(card: Record<string, unknown>): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    // CRC is not verified by the importer, and a real card's would be valid.
    return Buffer.concat([len, Buffer.from(type, "ascii"), data, Buffer.alloc(4)]);
  };
  const payload = Buffer.from(
    JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", data: card })
  ).toString("base64");
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", Buffer.alloc(13)),
    chunk("tEXt", Buffer.concat([Buffer.from("chara\0", "latin1"), Buffer.from(payload, "latin1")])),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CARD = {
  name: "Sable",
  description: "{{char}} keeps the ledger of a city that writes nothing down.",
  personality: "Unhurried. Never raises their voice, never repeats a question.",
  scenario: "{{user}} owes something that was never written down.",
  first_mes: '"You found the office," Sable says. "Most people give up on the stairs."',
  mes_example:
    "<START>\n{{user}}: How much do I owe?\n{{char}}: That is the wrong question.\n" +
    "<START>\n{{user}}: What is the right one?\n{{char}}: Ask me what it is for.",
  creator: "someone-on-chub",
  character_book: {
    entries: [
      { keys: ["ledger", "debt"], content: "The ledger is kept in Sable's head.", enabled: true },
      { keys: ["stairs"], content: "The office is on the ninth floor. There is no lift.", enabled: true },
    ],
  },
};

test.describe("Supply lanes", () => {
  test("E2E-031: an imported card is playable, private, and cannot be published", async ({
    page,
  }) => {
    await loginAs(page, "import-e2e031@test.com");

    const res = await page.request.post("/api/stories/import-card", {
      multipart: {
        file: {
          name: "sable.png",
          mimeType: "image/png",
          buffer: characterCardPng(CARD),
        },
      },
    });
    expect(res.ok()).toBeTruthy();
    const story = await res.json();

    expect(story.title).toBe("Sable");
    expect(story.source).toBe("IMPORTED");
    expect(story.status).toBe("PRIVATE");
    // {{user}} / {{char}} are card templating, not prose.
    expect(story.worldSetting).toContain("Sable keeps the ledger");
    expect(story.worldSetting).not.toContain("{{");
    expect(story.intros[0].firstMessage).toContain("You found the office");
    // The card's lorebook becomes our keyword book, uncapped.
    expect(story.keywords.length).toBe(2);
    expect(story.keywords[0].keywords).toContain("ledger");
    expect(story.characters[0].exampleDialogs.length).toBe(2);

    // The rule that makes originals-only real, enforced on the server.
    for (const visibility of ["PUBLISHED", "UNLISTED"]) {
      const pub = await page.request.post(`/api/stories/${story.id}/publish`, {
        data: { visibility },
      });
      expect(pub.status()).toBe(403);
      expect((await pub.json()).error.code).toBe("import_is_private");
    }

    // It is still a real, playable story for the person who brought it.
    const route = await page.request.post("/api/routes", {
      data: { storyId: story.id, introId: story.intros[0].id },
    });
    expect(route.ok()).toBeTruthy();
  });

  test("E2E-032: a rubbish PNG is refused with something you can act on", async ({ page }) => {
    await loginAs(page, "import-e2e032@test.com");
    const notACard = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(24),
    ]);
    const res = await page.request.post("/api/stories/import-card", {
      multipart: {
        file: { name: "plain.png", mimeType: "image/png", buffer: notACard },
      },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).error.message).toMatch(/SillyTavern|Chub/);
  });

  /**
   * The adaptation lane is what makes a seeded catalogue affordable: the prose
   * already exists, and the converter supplies the structure.
   */
  test("E2E-033: prose becomes a playable story, and records who owns it", async ({ page }) => {
    await loginAs(page, "adapt-e2e033@test.com");
    const prose =
      "The city ran on debts nobody wrote down. ".repeat(12) +
      "Sable met me on the ninth floor, and did not offer a chair. ".repeat(12);

    const res = await page.request.post("/api/stories/adapt", {
      data: {
        prose,
        sourceTitle: "Nothing Written Down",
        rightsHolder: "A. Novelist",
        licensed: true,
      },
    });
    expect(res.ok()).toBeTruthy();
    const story = await res.json();

    expect(story.source).toBe("ADAPTED");
    // Same structural bar as an original — prose alone is not a playable story.
    expect(story.intros.length).toBeGreaterThanOrEqual(2);
    expect(story.intros[0].stats.length).toBeGreaterThanOrEqual(2);
    expect(story.intros[0].endings.length).toBeGreaterThanOrEqual(4);

    expect(story.license.kind).toBe("ADAPTATION_OPTION");
    expect(story.license.rightsHolder).toBe("A. Novelist");
    // We never take exclusivity. This is the assertion that keeps it honest.
    expect(story.license.exclusive).toBe(false);
    expect(story.license.revenueShareBps).toBeGreaterThan(0);
  });

  test("E2E-034: an adaptation without a named rights holder is refused", async ({ page }) => {
    await loginAs(page, "adapt-e2e034@test.com");
    const res = await page.request.post("/api/stories/adapt", {
      data: { prose: "Words. ".repeat(120), licensed: true },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).error.code).toBe("rights_holder_required");
  });

  test("E2E-035: the Originals shelf leads, and its stories are badged", async ({ page }) => {
    await loginAs(page, "originals-e2e035@test.com");
    await page.goto("/");

    const shelf = page.getByTestId("section-originals");
    await expect(shelf).toBeVisible();
    await expect(shelf.getByText("HEADCANON Originals")).toBeVisible();
    await expect(shelf.getByTestId("originals-badge").first()).toBeVisible();

    await shelf.getByTestId("story-card").first().click();
    await expect(page).toHaveURL(/\/story\//);
    await expect(page.getByTestId("originals-line")).toContainText("HEADCANON Original");
  });
});
