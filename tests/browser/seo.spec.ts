import { test, expect } from "@playwright/test";

const origin = "https://chat.bettergov.ph";

test("social crawlers receive complete, page-specific metadata without running JavaScript", async ({ page, request }) => {
  for (const [path, title] of [["/", "Kuya J — Philippine AI Assistant | BetterGov.ph"], ["/about", "About Kuya J — Philippine AI Assistant | BetterGov.ph"], ["/privacy", "Privacy Policy · Kuya J"], ["/terms", "Terms of Service · Kuya J"]]) {
    const response = await request.get(path, { headers: { "User-Agent": "facebookexternalhit/1.1" } });
    expect(response.status()).toBe(200);
    const metadata = await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const meta = (name: string) => doc.head.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.getAttribute("content");
      return { title: doc.title, description: meta("description"), canonical: doc.head.querySelector('link[rel="canonical"]')?.getAttribute("href"), ogUrl: meta("og:url"), ogTitle: meta("og:title"), ogDescription: meta("og:description"), image: meta("og:image"), width: meta("og:image:width"), height: meta("og:image:height"), alt: meta("og:image:alt"), twitterCard: meta("twitter:card"), twitterImage: meta("twitter:image"), twitterTitle: meta("twitter:title"), robots: meta("robots"), structuredData: Array.from(doc.querySelectorAll('script[type="application/ld+json"]'), el => JSON.parse(el.textContent || "{}")) };
    }, await response.text());
    expect(metadata.title).toBe(title);
    // Next normalizes the root canonical without a trailing slash; both forms
    // identify the same URL. Nested pages must retain their own paths.
    expect(new URL(metadata.canonical!).href).toBe(`${origin}${path}`);
    expect(new URL(metadata.ogUrl!).href).toBe(new URL(metadata.canonical!).href);
    expect(metadata.ogTitle).toBe(title);
    expect(metadata.ogDescription).toBe(metadata.description);
    expect(metadata.twitterTitle).toBe(title);
    expect(metadata.twitterCard).toBe("summary_large_image");
    expect(metadata.twitterImage).toBe(metadata.image);
    expect(metadata.image).toBe(`${origin}/social/kuya-j-og-v1.png`);
    expect(metadata.width).toBe("1200");
    expect(metadata.height).toBe("630");
    expect(metadata.alt).toContain("Kuya J");
    expect(metadata.robots).not.toContain("noindex");
    expect(metadata.structuredData[0]["@graph"].map((node: { "@type": string }) => node["@type"])).toEqual(["Organization", "WebSite"]);
    if (path === "/") expect(metadata.structuredData[1]["@type"]).toBe("WebApplication");
  }
  const poster = await request.get("/social/kuya-j-og-v1.png");
  expect(poster.status()).toBe(200);
  expect(poster.headers()["content-type"]).toContain("image/png");
  const bytes = await poster.body();
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);
  expect(bytes.length).toBeLessThan(2_000_000);
});

test("crawl discovery covers public pages while the offline fallback is not indexable", async ({ page, request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(`Sitemap: ${origin}/sitemap.xml`);
  expect(await robots.text()).toContain("Disallow: /api/");
  expect(await robots.text()).toContain("Allow: /");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const urls = await page.evaluate(xml => Array.from(new DOMParser().parseFromString(xml, "application/xml").querySelectorAll("url > loc"), node => node.textContent), await sitemap.text());
  expect(urls).toEqual([`${origin}/`, `${origin}/about`, `${origin}/privacy`, `${origin}/terms`]);
  for (const url of urls) expect((await request.get(new URL(url!).pathname)).status()).toBe(200);
  const offline = await request.get("/offline.html");
  expect(await offline.text()).toContain('name="robots" content="noindex, follow"');
});

test("About content and PNG attribution remain readable with JavaScript disabled", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 320, height: 750 } });
  const page = await context.newPage();
  try {
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your Philippine AI companion");
    await expect(page.getByRole("heading", { name: "Explore our 10 knowledge sources" })).toBeVisible();
    await expect(page.locator('.policy-document a[target="_blank"]')).toHaveCount(10);
    const logo = page.locator(".bettergov-attribution img");
    await expect(logo).toHaveAttribute("src", "/brand/bettergov-horizontal-primary.png");
    expect(await logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 5000)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
