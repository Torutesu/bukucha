import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const canonical = "https://bukucha.vercel.app";

test("初回訪問とJavaScriptなしでもトップの本文と作品リンクが読める", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const response = await page.goto(baseURL!);
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.locator("h1")).toHaveText("AIとつむぐ、あなただけの恋愛小説");
  expect(await page.locator('a[href^="/s/"]').count()).toBeGreaterThan(0);
  expect(new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!).href).toBe(`${canonical}/`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /(?<!no)index/);
  const schema = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(schema.map((text) => JSON.parse(text))[0]).toMatchObject({ "@type": "WebSite", name: "Bukucha", url: `${canonical}/` });
  await context.close();
});

test("初回ホームに留まり、任意の好み選択とタブが動作する", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("section-forYou")).toBeVisible();
  await page.getByTestId("tab-popular").click();
  await expect(page.getByTestId("section-popular")).toBeVisible();
  await page.getByTestId("tab-new").click();
  await expect(page.getByTestId("section-new")).toBeVisible();
  await page.getByRole("link", { name: "好みから物語を選ぶ" }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByTestId("onboarding-tag").first()).toBeVisible();
});

test("タグをすばやく変えても遅い旧応答に上書きされない", async ({ page, request }) => {
  const data = await (await request.get("/api/home")).json();
  const card = data.sections[0].situations[0];
  await page.route("**/api/search?*", async (route) => {
    const tag = new URL(route.request().url()).searchParams.get("tags");
    if (tag === "執着") await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ json: { items: [{ ...card, title: `${tag}の結果` }], nextCursor: null } }).catch(() => {});
  });
  await page.goto("/");
  await expect(page.getByTestId("section-forYou")).toBeVisible();
  const chips = page.getByTestId("home-tags");
  await chips.getByRole("button", { name: "執着", exact: true }).click();
  await chips.getByRole("button", { name: "溺愛", exact: true }).click();
  await expect(page.getByTestId("card-title")).toHaveText("溺愛の結果");
  await page.waitForTimeout(650);
  await expect(page.getByTestId("card-title")).toHaveText("溺愛の結果");
});

test("ガイド全件に固有canonical・可視本文・関連記事があり、JSON-LDが解析できる", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const titles = new Set<string>();
  for (const path of ["/about", "/guides", "/guides/ai-novel-chat", "/guides/create-original-story", "/guides/ai-roleplay-tips", "/legal/guideline"]) {
    const response = await page.goto(`${baseURL}${path}`);
    expect(response?.status(), path).toBe(200);
    expect(await page.locator("h1").count()).toBe(1);
    titles.add(await page.title());
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${canonical}${path}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /(?<!no)index/);
    for (const text of await page.locator('script[type="application/ld+json"]').allTextContents()) expect(JSON.parse(text)).toBeTruthy();
    expect(await page.locator("main").innerText()).not.toContain("[要確認]");
    expect(await page.locator('a[href="/"]').count()).toBeGreaterThan(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow, path).toBe(false);
  }
  expect(titles.size).toBe(6);
  await context.close();
});

test("個人画面・検索結果・未確定法務ページはnoindexで、トップcanonicalを継承しない", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const path of ["/login", "/me", "/me/edit", "/me/details", "/settings", "/bookshelf", "/create", "/studio", "/welcome", "/story/guest", "/search?q=private-input", "/legal/terms", "/legal/privacy", "/legal/tokushoho"]) {
    const response = await page.goto(`${baseURL}${path}`);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const canonicalLink = page.locator('link[rel="canonical"]');
    if (await canonicalLink.count()) expect(await canonicalLink.getAttribute("href")).not.toBe(`${canonical}/`);
  }
  await context.close();
});

test("robots・サイトマップは公開情報のみを返す", async ({ request, baseURL }) => {
  // Read-only DB assertions are still restricted to the dedicated local test database.
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL must point to the dedicated bukucha_seo test database");
  const parsed = new URL(dbUrl);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.pathname !== "/bukucha_seo" || !["localhost", "127.0.0.1"].includes(new URL(baseURL!).hostname)) throw new Error("Local SEO test environment required");
  const db = new PrismaClient();
  try {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    const rules = await robots.text();
    expect(rules).toContain("User-Agent: OAI-SearchBot");
    expect(rules).toContain(`Sitemap: ${canonical}/sitemap.xml`);
    expect(rules).toContain("Disallow: /api/");
    expect(rules).not.toContain("Disallow: /s/");
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const xml = await response.text();
    const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (m) => m[1]);
    expect(new Set(urls).size).toBe(urls.length);
    const works = await db.situation.findMany({ select: { id: true, status: true, contentLevel: true, title: true } });
    for (const work of works) {
      expect(urls.includes(`${canonical}/s/${work.id}`), `${work.status} ${work.contentLevel}`).toBe(work.status === "PUBLISHED" && work.contentLevel === "ALL_AGES" && work.title !== "");
    }
    expect(urls.filter((url) => !url.startsWith(`${canonical}/`))).toEqual([]);
    expect(urls.some((url) => /\/(story|api|search|login|me|create)(\/|\?|$)/.test(url))).toBe(false);
    for (const url of urls.filter((url) => !url.includes("/s/"))) expect((await request.get(new URL(url).pathname)).status()).toBe(200);
    const api = await request.get("/api/tags");
    expect(api.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  } finally { await db.$disconnect(); }
});

test("OG画像はSNSが取得できる1200x630のPNG", async ({ request }) => {
  const response = await request.get("/opengraph-image");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  const buffer = await response.body();
  expect(buffer.subarray(1, 4).toString()).toBe("PNG");
  expect(buffer.readUInt32BE(16)).toBe(1200);
  expect(buffer.readUInt32BE(20)).toBe(630);
});
