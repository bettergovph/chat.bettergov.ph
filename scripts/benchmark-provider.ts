// Live integration check; uses paid provider calls with a fixed public question.
// Run: node --env-file=.env.local --import tsx scripts/benchmark-provider.ts nyolab
import { mkdirSync, writeFileSync } from "node:fs";
import { POST } from "../app/api/chat/route.ts";
import { getLlmConfig } from "../lib/server/llm-config.ts";
import { readSseData } from "../lib/sse.ts";

const provider = process.argv[2];
if (provider !== "zai" && provider !== "nyolab") throw new Error("Choose zai or nyolab.");
process.env.LLM_PROVIDER = provider;
// A provider comparison must never silently measure the other provider.
process.env.LLM_FALLBACK_PROVIDER = "off";
const config = getLlmConfig();
const start = performance.now();
const question = "What does the Data Privacy Act say about my personal information?";
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 235000);
let firstAnswerMs: number | undefined;
let updates = 0;
let done: { content: string; sources: { url: string; provider: string }[]; warnings: string[] } | undefined;
let error: string | undefined;
const trace: Record<string, unknown>[] = [];
try {
  const response = await POST(new Request("http://localhost/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ messages: [{ role: "user", content: question }], debug: true }) }));
  if (!response.ok || !response.body) throw new Error(`Chat returned HTTP ${response.status}`);
  for await (const data of readSseData(response.body, controller.signal, 16_000_000)) {
    const event = JSON.parse(data);
    if (event.type === "answer" && event.content) { firstAnswerMs ??= Math.round(performance.now() - start); updates++; }
    if (event.type === "trace") trace.push(event);
    if (event.type === "error") error = event.message;
    if (event.type === "done") done = event;
  }
} catch (failure) { error = failure instanceof Error ? failure.message : "Benchmark failed"; }
finally { clearTimeout(timeout); }
const summary = {
  provider, model: config.model, question, firstAnswerMs, totalMs: Math.round(performance.now() - start), answerUpdates: updates,
  completed: Boolean(done), error,
  answerCharacters: done?.content.length ?? 0, sources: done?.sources, warnings: done?.warnings,
  phases: trace.filter(event => ["model", "tool", "classifier", "screening"].includes(String(event.stage))).map(({ stage, status, title, elapsedMs, durationMs }) => ({ stage, status, title, elapsedMs, durationMs })),
};
mkdirSync("outputs", { recursive: true });
writeFileSync(`outputs/provider-${provider}-grounded.json`, JSON.stringify({ ...summary, trace, answer: done?.content }, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (!done || !done.sources.length || !updates || error) process.exitCode = 1;
