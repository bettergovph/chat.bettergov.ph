import { test, expect, type Page } from "@playwright/test";

type ViewportUpdate = { height?: number; offsetTop?: number; scale?: number; keyboardTop?: number };
declare global {
  interface Window { setKeyboardViewport: (update: ViewportUpdate) => void }
}

async function emulateWebView(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    // Keep innerHeight and 100dvh unchanged, as in an embedded browser where
    // only the visual viewport responds to the software keyboard.
    const viewport = Object.assign(new EventTarget(), { height: innerHeight, offsetTop: 0, scale: 1 });
    const keyboard = Object.assign(new EventTarget(), { boundingRect: new DOMRect() });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    Object.defineProperty(navigator, "virtualKeyboard", { configurable: true, value: keyboard });
    window.setKeyboardViewport = ({ keyboardTop, ...update }) => {
      Object.assign(viewport, update);
      if (keyboardTop !== undefined) keyboard.boundingRect = keyboardTop ? new DOMRect(0, keyboardTop, innerWidth, innerHeight - keyboardTop) : new DOMRect();
      viewport.dispatchEvent(new Event("resize"));
      viewport.dispatchEvent(new Event("scroll"));
      keyboard.dispatchEvent(new Event("geometrychange"));
    };
  });
  await page.goto("/");
  await expect(page.locator(".chat-viewport")).toHaveAttribute("data-keyboard-open", "false");
}

async function expectComposerInside(page: Page, top: number, bottom: number) {
  await expect.poll(() => page.locator(".composer").evaluate((element, bounds) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1;
  }, { top, bottom })).toBe(true);
  const input = await page.getByRole("textbox").boundingBox();
  expect(input!.y).toBeGreaterThanOrEqual(top);
  expect(input!.y + input!.height).toBeLessThanOrEqual(bottom + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("WebView keyboard shrink and pan keep the draft and send button above the keyboard", async ({ page }) => {
  await emulateWebView(page);
  await page.getByRole("textbox").fill("How can I renew my passport?");
  await page.evaluate(() => window.setKeyboardViewport({ height: 430 }));
  await expect(page.locator(".chat-viewport")).toHaveAttribute("data-keyboard-open", "true");
  expect(await page.evaluate(() => innerHeight)).toBe(844);
  await expectComposerInside(page, 0, 430);
  await expect(page.locator(".hero-brand")).toBeHidden();
  // Some hosts also pan the visual viewport to keep the focused control visible.
  await page.evaluate(() => window.setKeyboardViewport({ offsetTop: 58 }));
  await expect.poll(() => page.locator(".chat-viewport").evaluate(el => Math.round(el.getBoundingClientRect().top))).toBe(58);
  await expectComposerInside(page, 58, 488);
  await page.getByRole("textbox").press("End");
  await page.getByRole("textbox").pressSequentially(" Salamat!");
  await expect(page.getByRole("textbox")).toHaveValue("How can I renew my passport? Salamat!");
  await page.route("**/api/chat", route => route.fulfill({ contentType: "text/event-stream", body: 'data: {"type":"done","content":"A keyboard regression fixture answer.","sources":[],"warnings":[]}\n\n' }));
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(page.getByText("A keyboard regression fixture answer.")).toBeVisible();
  await expectComposerInside(page, 58, 488);
  // Android's back button can close the keyboard while the textarea stays focused.
  await page.getByRole("textbox").focus();
  await page.evaluate(() => window.setKeyboardViewport({ height: 844, offsetTop: 0 }));
  await expect(page.locator(".chat-viewport")).toHaveAttribute("data-keyboard-open", "false");
  await expect.poll(() => page.locator(".chat-viewport").evaluate(el => el.clientHeight)).toBe(844);
  await expectComposerInside(page, 0, 844);
});

test("multiline input fits a short keyboard viewport and responds to orientation changes", async ({ page }) => {
  await emulateWebView(page);
  await page.getByRole("textbox").fill(Array.from({ length: 12 }, (_, i) => `Line ${i + 1}`).join("\n"));
  await page.evaluate(() => window.setKeyboardViewport({ height: 280 }));
  await expectComposerInside(page, 0, 280);
  expect((await page.locator(".workspace-scroll").boundingBox())!.height).toBeGreaterThan(20);
  await page.setViewportSize({ width: 740, height: 390 });
  await page.evaluate(() => window.setKeyboardViewport({ height: 220, offsetTop: 0 }));
  await expectComposerInside(page, 0, 220);
  await expect(page.getByRole("textbox")).toHaveValue(/Line 12/);
  await page.evaluate(() => window.setKeyboardViewport({ height: 390 }));
  await expect(page.locator(".chat-viewport")).toHaveAttribute("data-keyboard-open", "false");
});

test("keyboard geometry handles overlay hosts and pinch zoom does not reflow the chat", async ({ page }) => {
  await emulateWebView(page);
  await page.getByRole("textbox").fill("A draft");
  await page.evaluate(() => window.setKeyboardViewport({ height: 844, keyboardTop: 450 }));
  await expectComposerInside(page, 0, 450);
  await page.evaluate(() => window.setKeyboardViewport({ keyboardTop: 0 }));
  await expect(page.locator(".chat-viewport")).toHaveAttribute("data-keyboard-open", "false");
  await page.evaluate(() => window.setKeyboardViewport({ height: 422, scale: 2, offsetTop: 40 }));
  // A focus event also schedules measurement while zoomed.
  await page.getByRole("textbox").focus();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(await page.locator(".chat-viewport").evaluate(el => el.clientHeight)).toBe(844);
  await expect(page.locator(".chat-viewport")).toHaveAttribute("data-keyboard-open", "false");
  await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute("content", /user-scalable=no|maximum-scale=1/);
  await page.evaluate(() => window.setKeyboardViewport({ height: 844, scale: 1, offsetTop: 0 }));
  await expectComposerInside(page, 0, 844);
});

test("normal layout resizing and older browsers without VisualViewport still fit", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("textbox").fill("Draft preserved after resizing");
  await page.setViewportSize({ width: 390, height: 410 });
  await expectComposerInside(page, 0, 410);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectComposerInside(page, 0, 844);
  await expect(page.getByRole("textbox")).toHaveValue("Draft preserved after resizing");
  await page.goto("/privacy");
  await expect(page.locator(".chat-viewport")).toHaveCount(0);
  await page.getByRole("heading", { name: "Security and changes" }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
});
