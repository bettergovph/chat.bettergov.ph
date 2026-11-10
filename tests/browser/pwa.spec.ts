import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("manifest, transparent branding and offline worker are ready on HTTPS", async ({ page, request }) => {
  await page.goto("/");
  test.skip(!await page.evaluate(() => isSecureContext), "Use TEST_BASE_URL with HTTPS to exercise PWA support.");
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ short_name: "Kuya J", start_url: "/", scope: "/", display: "standalone" });
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toContain("192x192");
  expect(manifest.icons.map((icon: { purpose: string }) => icon.purpose)).toContain("maskable");
  for (const icon of manifest.icons) {
    const size = await page.evaluate(async (src: string) => { const image = new Image(); image.src = src; await image.decode(); return `${image.naturalWidth}x${image.naturalHeight}`; }, icon.src);
    expect(size).toBe(icon.sizes);
  }
  const alpha = await page.evaluate(async () => { const image = new Image(); image.src = "/brand/kuya-j-mascot.webp"; await image.decode(); const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512; const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0); return context.getImageData(0, 0, 1, 1).data[3]; });
  expect(alpha).toBe(0);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");
});

test("offline fallback reconnects without caching chats or navigation responses", async ({ page, context }) => {
  await page.goto("/");
  test.skip(!await page.evaluate(() => isSecureContext), "Requires HTTPS.");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const rejected = await page.evaluate(async () => (await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [] }) })).status);
  expect(rejected).toBe(400); // HTTPS-origin validation passed; body validation rejected an empty chat.
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Try again" })).toBeVisible();
  const cached = await page.evaluate(async () => { const keys = await caches.keys(); const urls: string[] = []; for (const key of keys) for (const request of await (await caches.open(key)).keys()) urls.push(new URL(request.url).pathname); return urls; });
  expect(cached).toContain("/offline.html");
  expect(cached).not.toContain("/");
  expect(cached.some(path => path.startsWith("/api/"))).toBe(false);
  await context.setOffline(false);
  await page.getByRole("link", { name: "Try again" }).click();
  await expect(page.getByRole("textbox", { name: "Your question for Kuya J" })).toBeVisible();
});

test("connectivity changes keep a draft and prevent offline submissions", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("textbox").fill("Ano ang mga batas tungkol sa privacy?");
  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText("You’re offline");
  await expect(page.getByRole("button", { name: "Send question", exact: true })).toBeDisabled();
  await page.getByRole("textbox").press("Enter");
  await expect(page.locator(".message")).toHaveCount(0);
  await context.setOffline(false);
  await expect(page.getByRole("textbox")).toHaveValue("Ano ang mga batas tungkol sa privacy?");
  await expect(page.getByRole("button", { name: "Send question", exact: true })).toBeEnabled();
});

test("install control invokes a deferred browser prompt and supports menu guidance", async ({ page }) => {
  await page.goto("/");
  // A real UI interaction also ensures hydration before dispatching native-event fixtures.
  await page.getByRole("button", { name: "Install Kuya J" }).click();
  await expect(page.getByRole("heading", { name: "Keep Kuya J close" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(page.getByRole("button", { name: "Install Kuya J" })).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Our sources" }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt: async () => { document.documentElement.dataset.installPrompted = "true"; }, userChoice: Promise.resolve({ outcome: "accepted" }) });
    window.dispatchEvent(event);
  });
  await page.getByRole("button", { name: "Install Kuya J" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-install-prompted", "true");
  await expect(page.getByRole("button", { name: "Install Kuya J" })).toHaveCount(0);
});

test("mobile and desktop reflow, keyboard entry and accessible source dialog", async ({ page }) => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 768 ? 500 : 844 });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("textbox")).toBeInViewport();
    await expect(page.getByRole("button", { name: "Send question", exact: true })).toBeInViewport();
  }
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to your question" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox")).toBeFocused();
  const home = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(home.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
  const sources = page.getByRole("button", { name: "Our sources" });
  await sources.click();
  const dialog = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(dialog.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(sources).toBeFocused();
});
