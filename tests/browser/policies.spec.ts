import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("source directory uses main sites and unknown API citations fall back to the main site", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Our sources" }).click();
  const links = await page.locator(".source-directory > a").evaluateAll(nodes => nodes.map(node => ({ href: (node as HTMLAnchorElement).href, domain: node.querySelector(".source-domain")?.textContent })));
  expect(links).toHaveLength(10);
  for (const link of links) {
    expect(link.href).toBe(new URL(link.href).origin + "/");
    expect(link.domain).toBe(link.href);
  }
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const url = "https://statistics.bettergov.ph/api/observations?year=2026#results";
  await page.route("**/api/chat", route => route.fulfill({ contentType: "text/event-stream", body: `data: ${JSON.stringify({ type: "done", content: `A registered source: <${url}>. [1](${url})`, sources: [{ id: 1, title: "PSA observations", url, provider: "statistics", retrievedAt: "2026-09-21" }], warnings: [] })}\n\n` }));
  await page.getByRole("textbox").fill("Show statistics");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  const answer = page.locator(".message.assistant");
  await expect(answer.getByRole("link", { name: "https://statistics.bettergov.ph/", exact: true })).toHaveAttribute("href", "https://statistics.bettergov.ph/");
  await expect(answer).not.toContainText("/api/observations");
  await expect(answer.locator(".citation-card")).toContainText("https://statistics.bettergov.ph/");
});

test("PSA inline references and source cards open datasets while labels stay compact", async ({ page }) => {
  const api = "https://statistics.bettergov.ph/api/v1/datasets/9b78cb1fa95ae59f78d4/values?dimension=Year";
  const dataset = "https://statistics.bettergov.ph/datasets/9b78cb1fa95ae59f78d4";
  await page.route("**/api/chat", route => route.fulfill({ contentType: "text/event-stream", body: `data: ${JSON.stringify({ type: "done", content: `PSA dataset [1](${api}). <${api}>`, sources: [{ id: 1, title: "Palay and corn production", url: api, provider: "statistics", retrievedAt: "2026-09-22" }], warnings: [] })}\n\n` }));
  await page.goto("/");
  await page.getByRole("textbox").fill("Show palay production data");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  const answer = page.locator(".message.assistant");
  await expect(answer.getByRole("link", { name: "1", exact: true })).toHaveAttribute("href", dataset);
  await expect(answer.getByRole("link", { name: "https://statistics.bettergov.ph/", exact: true })).toHaveAttribute("href", dataset);
  await expect(answer.locator(".citation-card")).toHaveAttribute("href", dataset);
  await expect(answer.locator(".citation-card")).toContainText("https://statistics.bettergov.ph/");
  await expect(answer).not.toContainText("/api/v1");
});

test("attribution, privacy and terms stay reachable without losing a chat draft", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.locator(".nav-footer");
  await expect(sidebar.getByRole("link", { name: /An initiative by BetterGov.ph/ })).toHaveAttribute("href", "https://bettergov.ph/");
  expect(await sidebar.locator(".bettergov-attribution img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.getByRole("button", { name: "About Kuya J" }).click();
  const about = page.locator(".about-content");
  await expect(about).toContainText("We do not store your chat history on our servers.");
  await expect(about.getByRole("link", { name: /An initiative by BetterGov.ph/ })).toBeVisible();
  await expect(about.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("textbox").fill("Keep this draft");
  const popupPromise = page.waitForEvent("popup");
  await page.locator(".composer-disclaimer").getByRole("link", { name: "Terms of Service" }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/terms$/);
  await expect(popup.getByRole("heading", { name: "Terms of Service", exact: true })).toBeVisible();
  await popup.close();
  await expect(page.getByRole("textbox")).toHaveValue("Keep this draft");
  for (const viewport of [{ width: 320, height: 600 }, { width: 390, height: 500 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(".composer-disclaimer").getByRole("link", { name: "Privacy Policy" })).toBeInViewport();
    await expect(page.getByRole("textbox")).toBeInViewport();
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    const mobile = page.locator('[data-mobile="true"]');
    await expect(mobile.locator(".bettergov-attribution")).toBeInViewport();
    await expect(mobile.getByRole("link", { name: "Terms of Service" })).toBeInViewport();
    await page.keyboard.press("Escape");
  }
});

test("policy pages render, cross-link and remain accessible on mobile", async ({ page }) => {
  for (const path of ["/privacy", "/terms"]) {
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(path === "/privacy" ? "Privacy Policy · Kuya J" : "Terms of Service · Kuya J");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("link", { name: "Back to Kuya J" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("link", { name: /An initiative by BetterGov.ph/ })).toBeVisible();
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(audit.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
  }
  await expect(page.getByText(/Nothing in these terms excludes/)).toBeVisible();
  await page.locator(".policy-footer").getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy Policy", exact: true })).toBeVisible();
  await expect(page.locator(".policy-document")).toContainText("Z.ai");
  await expect(page.locator(".policy-document")).toContainText("TypeSafe AI");
  await expect(page.locator(".policy-document")).toContainText("Cloudflare");
});
