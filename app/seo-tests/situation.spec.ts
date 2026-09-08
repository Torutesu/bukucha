import { createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { test, expect } from "@playwright/test";

const prefix = "seotest-detail-";
const databaseUrl = process.env.SEO_DATABASE_URL ?? "postgresql://bukucha@127.0.0.1:55438/bukucha_seo";
const secret = process.env.SEO_AUTH_SECRET ?? "seo-local-test-only";
const publicTitle = "SEO公開作品 </script><script>window.__seoInjected=1</script>";
const hiddenMarkers = ["SECRET_AI_DRAFT_INPUT", "SECRET_STYLE", "SECRET_LORE", "SECRET_EXAMPLE_DIALOG", "SECRET_UNSEEN_MESSAGE", "seo-owner-private-email@example.invalid"];
let db: PrismaClient;

function token(user: "owner" | "adult" | "minor") {
  const payload = Buffer.from(JSON.stringify({ uid: `${prefix}${user}`, exp: Date.now() + 3_600_000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

function cookie(user: "owner" | "adult" | "minor") {
  return { Cookie: `bukucha_session=${token(user)}` };
}

function jsonLd(html: string) {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap((match) => {
      const value = JSON.parse(match[1]);
      return value["@graph"] ?? [value];
    });
}

async function cleanup() {
  // Only this suite's explicit fixture IDs are eligible for deletion.
  await db.like.deleteMany({ where: { situationId: { startsWith: prefix } } });
  await db.story.deleteMany({ where: { situationId: { startsWith: prefix } } });
  await db.situation.deleteMany({ where: { id: { startsWith: prefix } } });
  await db.user.deleteMany({ where: { id: { in: ["owner", "adult", "minor"].map((role) => `${prefix}${role}`) } } });
}

test.beforeAll(async ({}, testInfo) => {
  const base = new URL(String(testInfo.project.use.baseURL));
  const database = new URL(databaseUrl);
  if (!(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) && base.protocol === "http:")) {
    throw new Error("SEO detail tests require an HTTP loopback application; production requests are forbidden");
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) || database.pathname !== "/bukucha_seo") {
    throw new Error("SEO fixtures may only modify the local bukucha_seo database");
  }
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await cleanup();
  await db.user.createMany({
    data: [
      { id: `${prefix}owner`, nickname: "SEO確認作者", email: hiddenMarkers[5], preferenceTags: [] },
      { id: `${prefix}adult`, nickname: "SEO確認読者", birthDate: new Date("1990-01-01"), safeFilterOff: true, preferenceTags: [] },
      { id: `${prefix}minor`, nickname: "SEO確認未成年", birthDate: new Date("2015-01-01"), safeFilterOff: true, preferenceTags: [] },
    ],
  });
  for (const fixture of [
    { suffix: "public", title: publicTitle, status: "PUBLISHED", contentLevel: "ALL_AGES" },
    { suffix: "private", title: "非公開タイトルSEO確認", status: "PRIVATE", contentLevel: "ALL_AGES" },
    { suffix: "draft", title: "下書きタイトルSEO確認", status: "DRAFT", contentLevel: "ALL_AGES" },
    { suffix: "suspended", title: "停止作品タイトルSEO確認", status: "SUSPENDED", contentLevel: "ALL_AGES" },
    { suffix: "r15", title: "年齢制限タイトルSEO確認", status: "PUBLISHED", contentLevel: "R15" },
    { suffix: "r18", title: "表示対象外タイトルSEO確認", status: "PUBLISHED", contentLevel: "R18" },
  ] as const) {
    await db.situation.create({
      data: {
        id: `${prefix}${fixture.suffix}`,
        authorId: `${prefix}owner`,
        title: fixture.title,
        status: fixture.status,
        contentLevel: fixture.contentLevel,
        catchphrase: "SSR確認用キャッチフレーズ",
        worldSetting: "SSR確認用の世界観。雨の図書館で物語がはじまります。",
        publishedAt: new Date("2026-09-08T20:00:00.000Z"),
        aiDraftInput: hiddenMarkers[0],
        style: { hidden: hiddenMarkers[1] },
        lore: [{ text: hiddenMarkers[2] }],
        characters: { create: { name: "SEO確認キャラクター", personality: "穏やかな性格", speechStyle: "静かな口調", relationship: "図書館の案内人", exampleDialogs: [{ user: hiddenMarkers[3] }] } },
        intros: { create: [
          { label: "図書館から", introText: "SSR確認用の冒頭。図書館の扉を開く。", firstMessage: `${"公開してよい冒頭。".repeat(24)}${hiddenMarkers[4]}`, sortOrder: 0 },
          { label: "雨の街から", introText: "雨の街で案内人に出会う。", firstMessage: "ようこそ、雨の街へ。", sortOrder: 1 },
        ] },
      },
    });
  }
});

test.afterAll(async () => {
  if (!db) return;
  await cleanup();
  await db.$disconnect();
});

test("公開作品はJavaScript無しで本文・canonical・安全な構造化データを返す", async ({ browser, request, baseURL }) => {
  const path = `/s/${prefix}public`;
  const response = await request.get(path);
  expect(response.status()).toBe(200);
  const html = await response.text();
  for (const marker of hiddenMarkers) expect(html).not.toContain(marker);
  expect(html).not.toContain("<script>window.__seoInjected=1</script>");
  const nodes = jsonLd(html);
  expect(nodes.find((node) => node["@type"] === "CreativeWork")).toMatchObject({
    name: publicTitle,
    author: { "@type": "Person", name: "SEO確認作者" },
  });
  expect(nodes.some((node) => node["@type"] === "BreadcrumbList")).toBe(true);
  expect(nodes.some((node) => node.aggregateRating || node.review)).toBe(false);
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page.getByTestId("situation-title")).toHaveText(publicTitle);
    await expect(page.getByText("SSR確認用の世界観。雨の図書館で物語がはじまります。")).toBeVisible();
    await expect(page.getByTestId("intro-preview")).toContainText("SSR確認用の冒頭");
    await expect(page.getByRole("navigation", { name: "パンくず" })).toBeVisible();
    await expect(page.getByText("公開: 2026年9月9日")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /(?<!no)index/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://bukucha.vercel.app${path}`);
    expect(await page.title()).toBe(`${publicTitle} | Bukucha`);
  } finally {
    await context.close();
  }
});

test("匿名・未成年には非公開・年齢制限・不存在を真の404で返す", async ({ request }) => {
  for (const suffix of ["private", "draft", "suspended", "r15", "r18", "missing"]) {
    for (const userAgent of ["Mozilla/5.0", "Googlebot", "GPTBot"]) {
      const response = await request.get(`/s/${prefix}${suffix}`, { headers: { "User-Agent": userAgent } });
      expect(response.status(), `${suffix}: ${userAgent}`).toBe(404);
      const html = await response.text();
      expect(html).toContain("noindex");
      expect(html).not.toContain("タイトルSEO確認");
      expect(jsonLd(html).some((node) => node["@type"] === "CreativeWork")).toBe(false);
    }
  }
  const minorResponse = await request.get(`/s/${prefix}r15`, { headers: cookie("minor") });
  expect(minorResponse.status()).toBe(404);
  expect(await minorResponse.text()).not.toContain("年齢制限タイトルSEO確認");
});

test("所有者プレビューと許可済みR15はnoindexで作品名をOG・schemaに漏らさない", async ({ request }) => {
  for (const [suffix, user] of [
    ["private", "owner"], ["draft", "owner"], ["suspended", "owner"], ["r18", "owner"], ["r15", "adult"],
  ] as const) {
    const response = await request.get(`/s/${prefix}${suffix}`, { headers: cookie(user) });
    expect(response.status(), `${suffix}: ${user}`).toBe(200);
    const html = await response.text();
    const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";
    expect(head).toContain("noindex");
    expect(head).toContain("作品プレビュー");
    expect(head).not.toContain("タイトルSEO確認");
    expect(jsonLd(html).some((node) => node["@type"] === "CreativeWork")).toBe(false);
    expect(html).toContain("タイトルSEO確認");
    for (const marker of hiddenMarkers) expect(html).not.toContain(marker);
  }
});

test("SSR後もいいね・登場人物・冒頭選択が動作する", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "bukucha_session", value: token("adult"), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto(`/s/${prefix}public`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const like = page.getByTestId("like-button");
  await expect(like).toHaveAttribute("data-liked", "false");
  await like.click();
  await expect(like).toHaveAttribute("data-liked", "true");
  await expect(like).toHaveAttribute("data-count", "1");
  await like.click();
  await expect(like).toHaveAttribute("data-liked", "false");
  await page.getByRole("button", { name: /SEO確認キャラクター/ }).click();
  await expect(page.getByText("穏やかな性格")).toBeVisible();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.getByRole("radio", { name: "雨の街から" }).check();
  await expect(page.getByTestId("intro-preview")).toContainText("雨の街で案内人に出会う。");
  expect(await page.evaluate(() => (window as Window & { __seoInjected?: unknown }).__seoInjected)).toBeUndefined();
  expect(consoleErrors).toEqual([]);
});

test("匿名の物語開始は選択した冒頭をゲスト体験へ渡す", async ({ page }) => {
  await page.goto(`/s/${prefix}public`);
  await page.getByRole("radio", { name: "雨の街から" }).check();
  await page.getByRole("button", { name: "この物語をはじめる ▶" }).click();
  await expect(page).toHaveURL(/\/story\/guest$/);
  const guest = await page.evaluate(() => JSON.parse(localStorage.getItem("bukucha_guest_story") ?? "null"));
  expect(guest).toMatchObject({ situationId: `${prefix}public`, introText: "雨の街で案内人に出会う。" });
});
