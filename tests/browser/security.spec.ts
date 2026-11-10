import { test, expect } from "@playwright/test";

test("browser and API responses have security headers and chat errors cannot be cached", async ({ page, request }) => {
  for (const path of ["/", "/about", "/privacy", "/offline.html"]) {
    const response = await request.get(path);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.headers()["content-security-policy"]).toContain("object-src 'none'");
    expect(response.headers()["x-powered-by"]).toBeUndefined();
  }
  const response = await request.post("/api/chat", { headers: { "Content-Type": "text/plain" }, data: "invalid" });
  expect(response.status()).toBe(415);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await page.goto("/");
  await expect(page.getByRole("textbox")).toBeVisible();
});
