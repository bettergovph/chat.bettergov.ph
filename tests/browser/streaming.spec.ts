import { test, expect } from "@playwright/test";

test("answer grows before completion, keeps citations, and retains interrupted text", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (String(input) !== "/api/chat") return original(input, init);
      const source = { id: 1, title: "Data Privacy Act", provider: "juris", url: "https://juris.ph/republic-act/example", retrievedAt: "2026-09-21" };
      const text = "A partial answer from retrieved evidence. [1](https://juris.ph/republic-act/example)";
      return new Response(new ReadableStream({ start(controller) {
        const emit = (value: unknown) => controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\r\n\r\n`));
        emit({ type: "answer", content: text, sources: [source] });
        Object.assign(window, { advanceStream: (mode: string) => {
          if (mode === "grow") emit({ type: "answer", content: text + "\n\nMore generated text.", sources: [source] });
          else if (mode === "error") { emit({ type: "error", message: "The response was interrupted. Please try again." }); controller.close(); }
          else { emit({ type: "done", content: text + "\n\nThe complete answer.", sources: [source], warnings: [] }); controller.close(); }
        } });
      } }), { headers: { "Content-Type": "text/event-stream" } });
    };
  });
  const advance = (mode: string) => page.evaluate(value => (window as unknown as { advanceStream(mode: string): void }).advanceStream(value), mode);
  await page.goto("/");
  await page.getByRole("textbox").fill("Explain the privacy act");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(page.locator(".message.assistant .answer-content")).toContainText("A partial answer");
  await expect(page.getByRole("button", { name: "Stop response" })).toBeVisible();
  await expect(page.locator(".citation-card")).toHaveAttribute("href", "https://juris.ph/republic-act/example");
  await advance("grow");
  await expect(page.locator(".message.assistant .answer-content")).toContainText("More generated text.");
  await advance("error");
  await expect(page.locator(".message.assistant").getByRole("alert")).toContainText("Response incomplete.");
  await expect(page.locator(".message.assistant .answer-content")).toContainText("More generated text.");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop response" })).toBeVisible();
  await advance("done");
  await expect(page.locator(".message.assistant .answer-content").last()).toContainText("The complete answer.");
  await expect(page.getByRole("button", { name: "Send question", exact: true })).toBeVisible();
  await page.getByRole("textbox").fill("A follow-up question");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(page.locator(".message.assistant .answer-content").last()).toContainText("A partial answer");
  await page.getByRole("button", { name: "Stop response" }).click();
  await expect(page.getByText("Response stopped. This answer is incomplete.")).toBeVisible();
  await expect(page.locator(".message.assistant .answer-content").last()).toContainText("A partial answer");
});
