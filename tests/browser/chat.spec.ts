import { test, expect } from "@playwright/test";

test("Sotto bill references and cards open their record pages; ambiguous original URLs cannot bypass the registry", async ({ page }) => {
  const urls = ["https://bills.juris.ph/bills/senate/sbn-2451", "https://bills.juris.ph/bills/senate/sbn-2445"];
  const original = "https://senate.gov.ph/lis/documents_v2?congress=20";
  await page.route("**/api/chat", route => route.fulfill({ contentType: "text/event-stream", body: `data: ${JSON.stringify({ type: "done", content: `Bills listed for Vicente C. Sotto III: hospital bill [1](${urls[0]}) and election bill [2](${urls[1]}).\n\nOriginal provenance: <${original}> and [unregistered](https://example.com).`, sources: urls.map((url, index) => ({ id: index + 1, title: `Sotto bill ${index + 1}`, url, provider: "bills", retrievedAt: "2026-09-21", originalUrls: [original] })), warnings: [] })}\n\n` }));
  await page.goto("/");
  await page.getByRole("textbox").fill("What bills were filed by Vicente Sotto III?");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(page.locator(".citation-card")).toHaveCount(2);
  for (const [index, url] of urls.entries()) {
    await expect(page.locator(".citation-card").nth(index)).toHaveAttribute("href", url);
    await expect(page.locator(".message.assistant .answer-content").getByRole("link", { name: String(index + 1), exact: true })).toHaveAttribute("href", url);
  }
  await expect(page.locator('.message.assistant a[href*="senate.gov.ph"], .message.assistant a[href*="example.com"]')).toHaveCount(0);
});

test("desktop chat, suggestions, source links, conversation switching and error recovery", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page).toHaveTitle(/Kuya J/);
  await page.screenshot({ path: "outputs/kuya-j-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Our sources" }).click();
  await expect(page.getByRole("heading", { name: "Knowledge you can trace" })).toBeVisible();
  await expect(page.locator(".source-directory > a")).toHaveCount(10);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: /National budget How much/ }).click();
  await expect(page.getByRole("textbox", { name: "Your question for Kuya J" })).toHaveValue(/2026/);
  let requestBody: unknown;
  await page.route("**/api/chat", async route => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ contentType: "text/event-stream", body: 'data: {"type":"status","message":"Checking National budget…"}\n\ndata: {"type":"done","content":"Test answer with a citation. [1](https://budget.bettergov.ph/api/v1/gaa)","sources":[{"id":1,"title":"National budget records","url":"https://budget.bettergov.ph/api/v1/gaa","provider":"budget","retrievedAt":"2026-09-21"}],"warnings":[]}\n\n' });
  });
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(page.getByText("Test answer with a citation.")).toBeVisible();
  expect(JSON.stringify(requestBody)).toContain("2026");
  await expect(page.locator(".citation-card")).toHaveAttribute("href", "https://budget.bettergov.ph/gaa");
  await page.getByRole("button", { name: "Copy answer" }).click();
  await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /New conversation/ }).click();
  await expect(page.getByRole("heading", { name: /Kumusta/ })).toBeVisible();
  await page.locator(".history-item").first().click();
  await expect(page.getByText("Test answer with a citation.")).toBeVisible();
  await page.unroute("**/api/chat");
  await page.route("**/api/chat", route => route.fulfill({ status: 429, json: { error: "The AI provider usage allowance is reached." } }));
  await page.getByRole("textbox").fill("What about 2025?");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(page.getByText("The AI provider usage allowance is reached.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("mobile navigation and composer fit without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({ path: "outputs/kuya-j-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("textbox")).toBeInViewport();
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page.getByRole("button", { name: /Knowledge sources/ }).click();
  await expect(page.getByRole("heading", { name: "Knowledge you can trace" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("textbox")).toBeVisible();
});

test("stopping a request restores the composer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Debug trace", exact: true }).click();
  await page.route("**/api/chat", async route => { await new Promise(resolve => setTimeout(resolve, 1000)); await route.abort().catch(() => {}); });
  await page.getByRole("textbox").fill("Show the 2026 national budget.");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await page.getByRole("button", { name: "Stop response" }).click();
  await expect(page.getByText("Response stopped.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Research debug trace" })).toContainText("Stopped.");
  await expect(page.getByRole("button", { name: /New conversation/ })).toBeEnabled();
});

test("debug events render before the answer and show Juris knowledge-base citations", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (String(input) !== "/api/chat") return originalFetch(input, init);
      const body = JSON.parse(String(init?.body));
      if (body.debug !== true) throw new Error("Debug must be requested explicitly");
      const encoder = new TextEncoder();
      return new Response(new ReadableStream({ start(controller) {
        const emit = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        emit({ type: "trace", requestId: "fixture", sequence: 1, elapsedMs: 600, stage: "classifier", status: "completed", title: "Jev routing: juris", detail: { model: "jev-latest", selectedSources: ["juris"], judgments: { source_juris: { type: "noul", noul: .99 } } } });
        emit({ type: "trace", requestId: "fixture", sequence: 2, elapsedMs: 800, stage: "tool", status: "started", title: "MCP: get_republic_act", detail: { endpoint: "https://juris.ph/mcp", operation: "get_republic_act", arguments: { ra_number: "10173", include_full_text: true } } });
        (window as unknown as { finishDebug: () => void }).finishDebug = () => {
          emit({ type: "done", content: "Legal fixture answer. [1](https://juris.ph/republic-act/770533ba-9d83-5332-9aeb-fc6d67d0003d)", sources: [{ id: 1, title: "Data Privacy Act", url: "https://juris.ph/republic-act/770533ba-9d83-5332-9aeb-fc6d67d0003d", originalUrls: ["https://lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html"], provider: "juris", retrievedAt: "2026-09-21", retrievals: [{ provider: "juris", tool: "juris__get_republic_act", transport: "MCP", endpoint: "https://juris.ph/mcp" }] }], warnings: [] });
          controller.close();
        };
      } }), { headers: { "Content-Type": "text/event-stream" } });
    };
  });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Debug trace", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await page.getByRole("textbox").fill("What does the Data Privacy Act say about my personal information?");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  const trace = page.getByRole("region", { name: "Research debug trace" });
  await expect(trace).toContainText("Jev routing: juris");
  await expect(trace).toContainText("Receiving live events");
  await expect(page.getByText("Legal fixture answer.")).not.toBeVisible();
  await trace.locator("summary").filter({ hasText: "MCP: get_republic_act" }).click();
  await expect(trace.locator("pre:visible")).toContainText("https://juris.ph/mcp");
  await page.evaluate(() => (window as unknown as { finishDebug: () => void }).finishDebug());
  await expect(page.getByText("Legal fixture answer.")).toBeVisible();
  await expect(page.locator(".citation-card")).toContainText("https://juris.ph/");
  await expect(page.locator(".citation-card")).toHaveAttribute("href", "https://juris.ph/republic-act/770533ba-9d83-5332-9aeb-fc6d67d0003d");
  await page.getByRole("button", { name: "Copy debug trace", exact: true }).click();
  await expect(trace).toContainText("Copied");
  await page.getByRole("button", { name: /New conversation/ }).click();
  await expect(trace).not.toBeVisible();
  await page.locator(".history-item").first().click();
  await expect(trace).toContainText("Jev routing: juris");
  await page.setViewportSize({ width: 320, height: 760 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(toggle).toBeInViewport();
  await page.screenshot({ path: "outputs/kuya-j-debug-mobile.png", fullPage: true });
});
