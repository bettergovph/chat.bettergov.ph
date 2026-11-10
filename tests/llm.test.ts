import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { complete, type LlmMessage } from "../lib/server/llm.ts";
import { getTools } from "../lib/server/tools.ts";

const event = (delta: unknown, finish_reason: string | null = null) => `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason }] })}\r\n\r\n`;
function sse(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    // Exercise UTF-8 and frame boundaries independently of network packet size.
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } }), { headers: { "Content-Type": "text/event-stream" } });
}

function configure(t: TestContext, values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

test("Z.ai uses compatible tool selection and keeps hidden reasoning off the response", async t => {
  configure(t, { LLM_API_KEY: "fixture", LLM_BASE_URL: " https://api.z.ai/api/paas/v4/ ", LLM_MODEL: "glm-5.3-flash  ", LLM_REASONING_EFFORT: undefined });
  let sent: Record<string, unknown> = {};
  let endpoint = "";
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    endpoint = url; sent = JSON.parse(String(init.body));
    return Response.json({ choices: [{ finish_reason: "tool_calls", message: { content: null, reasoning_content: "Private scratchpad", tool_calls: [{ id: "c1", type: "function", function: { name: "services_search", arguments: '{"query":"passport"}' } }] } }] });
  });
  const messages: LlmMessage[] = [{ role: "user", content: "Where can I book a passport appointment?" }];
  const answer = await complete(messages, getTools(["services"]), AbortSignal.timeout(1000), true);
  assert.equal(endpoint, "https://api.z.ai/api/paas/v4/chat/completions");
  assert.equal(sent.model, "glm-5.3-flash");
  assert.equal(sent.tool_choice, "auto");
  assert.equal(sent.reasoning_effort, "low");
  assert.deepEqual(sent.thinking, { type: "enabled", clear_thinking: true });
  assert.match(JSON.stringify(sent.messages), /requires a source lookup/);
  assert.equal(messages.length, 1, "the original conversation must not be mutated");
  assert.equal(answer.tool_calls?.[0].function.name, "services_search");
  assert.equal("reasoning_content" in answer, false);
  assert.doesNotMatch(JSON.stringify(answer), /Private scratchpad/);
});

test("other compatible providers retain required tools without Z.ai-only parameters", async t => {
  configure(t, { LLM_API_KEY: "fixture", LLM_BASE_URL: "https://llm.test/v1", LLM_MODEL: "another-model", LLM_REASONING_EFFORT: undefined });
  let sent: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: "Hello" } }] });
  });
  const messages: LlmMessage[] = [{ role: "user", content: "Find passport appointments" }];
  await complete(messages, getTools(["services"]), AbortSignal.timeout(1000), true);
  assert.equal(sent.tool_choice, "required");
  assert.equal("thinking" in sent, false);
  assert.equal("reasoning_effort" in sent, false);
  assert.deepEqual(sent.messages, messages);
});

test("Nyolab uses only its own key and preserves GLM tool calls and streaming", async t => {
  configure(t, { LLM_PROVIDER: "nyolab", NYOLAB_API_KEY: "nyolab-fixture", ZAI_API_KEY: "zai-must-not-be-sent", LLM_API_KEY: "legacy-must-not-be-sent", LLM_BASE_URL: "https://api.z.ai/api/paas/v4", NYOLAB_MODEL: "glm-5.3-flash  ", LLM_STREAMING: "auto" });
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://llm.nyolab.ai/api/public/v1/chat/completions");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer nyolab-fixture");
    assert.equal(init.redirect, "manual");
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, "glm-5.3-flash");
    assert.equal(body.tool_choice, "auto");
    assert.equal(body.stream, true);
    assert.equal(body.reasoning_effort, "low");
    assert.doesNotMatch(String(init.body), /must-not-be-sent/);
    return sse(event({ tool_calls: [{ index: 0, id: "router-call", type: "function", function: { name: "services_search", arguments: '{"query":"passport"}' } }] }) + event({}, "tool_calls") + "data: [DONE]\n\n");
  });
  const result = await complete([{ role: "user", content: "Find passport services" }], getTools(["services"]), AbortSignal.timeout(1000), true, { onContent() {} });
  assert.equal(result.tool_calls?.[0].id, "router-call");
  assert.equal(result.tool_calls?.[0].function.name, "services_search");
});

test("content arrives before generation finishes, while reasoning stays private", async t => {
  configure(t, { LLM_API_KEY: "fixture", LLM_STREAMING: undefined });
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let firstText!: () => void;
  const ready = new Promise<void>(resolve => { firstText = resolve; });
  const texts: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.equal(JSON.parse(String(init.body)).stream, true);
    return new Response(new ReadableStream({ start(value) {
      controller = value;
      value.enqueue(new TextEncoder().encode(event({ reasoning_content: "private reasoning" }) + event({ content: "Hello " })));
    } }), { headers: { "Content-Type": "text/event-stream" } });
  });
  let finished = false;
  const pending = complete([], [], AbortSignal.timeout(2000), false, { onContent: text => { texts.push(text); firstText(); } }).then(value => { finished = true; return value; });
  await ready;
  assert.deepEqual(texts, ["Hello "]);
  assert.equal(finished, false);
  controller.enqueue(new TextEncoder().encode(event({ content: "Pilipinas 🇵🇭" }) + event({}, "stop") + "data: [DONE]\r\n\r\n"));
  controller.close();
  assert.equal((await pending).content, "Hello Pilipinas 🇵🇭");
  assert.doesNotMatch(JSON.stringify(texts), /private reasoning/);
});

test("Nyolab retries a clean empty stream once as JSON, including a tool continuation", async t => {
  configure(t, { LLM_PROVIDER: "nyolab", NYOLAB_API_KEY: "nyolab-fixture", LLM_STREAMING: "auto" });
  const attempts: boolean[] = [];
  const modes: string[] = [];
  const texts: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://llm.nyolab.ai/api/public/v1/chat/completions");
    const stream = JSON.parse(String(init.body)).stream;
    attempts.push(stream);
    if (stream) return sse(event({}, "tool_calls") + "data: [DONE]\n\n");
    return Response.json({ choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id: "retry-call", type: "function", function: { name: "services_search", arguments: '{"query":"passport"}' } }] } }] });
  });
  const result = await complete([], getTools(["services"]), AbortSignal.timeout(1000), false, { onContent: text => texts.push(text), onTransport: (mode, reason) => modes.push(mode + ":" + (reason ?? "")) });
  assert.deepEqual(attempts, [true, false]);
  assert.equal(result.tool_calls?.[0].id, "retry-call");
  assert.equal(texts.filter(Boolean).length, 0);
  assert.ok(modes.some(mode => mode.includes("empty stream")));
});

test("Nyolab never loops on empty responses or retries a broken/partial stream", async t => {
  configure(t, { LLM_PROVIDER: "nyolab", NYOLAB_API_KEY: "nyolab-fixture", LLM_STREAMING: "auto" });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    calls++;
    return JSON.parse(String(init.body)).stream ? sse(event({}, "stop") + "data: [DONE]\n\n") : Response.json({ choices: [{ finish_reason: "stop", message: { content: "" } }] });
  });
  await assert.rejects(complete([], [], AbortSignal.timeout(1000), false, { onContent() {} }), /empty response/);
  assert.equal(calls, 2);
  calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return sse(event({ content: "Partial text" })); });
  await assert.rejects(complete([], [], AbortSignal.timeout(1000), false, { onContent() {} }), /interrupted/);
  assert.equal(calls, 1);
});

test("split UTF-8 and fragmented tool arguments are assembled without exposing tool text", async t => {
  configure(t, { LLM_API_KEY: "fixture", LLM_STREAMING: undefined });
  const fragments = event({ content: "I will check." }) + event({ tool_calls: [{ index: 0, id: "c1", type: "function", function: { name: "services_search", arguments: '{"query":"' } }] }) + event({ content: "private tool preamble", tool_calls: [{ index: 0, function: { arguments: 'Pilipinas 🇵🇭"}' } }] }) + event({}, "tool_calls") + "data: [DONE]\r\n\r\n";
  t.mock.method(globalThis, "fetch", async () => sse(fragments));
  const texts: string[] = [];
  const result = await complete([], getTools(["services"]), AbortSignal.timeout(2000), false, { onContent: text => texts.push(text) });
  assert.deepEqual(texts, ["I will check.", ""]);
  assert.deepEqual(JSON.parse(result.tool_calls![0].function.arguments), { query: "Pilipinas 🇵🇭" });
  assert.equal(result.tool_calls![0].function.name, "services_search");
});

test("streaming capability rejection retries once as JSON, while auth and quota errors do not", async t => {
  configure(t, { LLM_API_KEY: "fixture", LLM_STREAMING: undefined });
  const attempts: boolean[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const stream = JSON.parse(String(init.body)).stream;
    attempts.push(stream);
    return stream ? Response.json({ error: { message: "Streaming is not supported by this model" } }, { status: 400 }) : Response.json({ choices: [{ finish_reason: "stop", message: { content: "Buffered answer" } }] });
  });
  const texts: string[] = [];
  const modes: string[] = [];
  const result = await complete([], [], AbortSignal.timeout(1000), false, { onContent: text => texts.push(text), onTransport: mode => modes.push(mode) });
  assert.deepEqual(attempts, [true, false]);
  assert.deepEqual(texts, ["Buffered answer"]);
  assert.deepEqual(modes, ["buffered"]);
  assert.equal(result.content, "Buffered answer");
  for (const status of [401, 429]) {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => { calls++; return new Response("private upstream body", { status }); });
    await assert.rejects(complete([], [], AbortSignal.timeout(1000), false, { onContent() {} }), new RegExp(`HTTP ${status}`));
    assert.equal(calls, 1);
  }
});

test("interrupted, oversized and failed provider streams never report successful completion", async t => {
  configure(t, { LLM_API_KEY: "fixture", LLM_STREAMING: undefined });
  for (const text of [event({ content: "Incomplete" }), event({ content: "Too long" }, "length"), 'data: {"error":{"message":"private body"}}\n\n', event({ tool_calls: [{ index: 0, id: "c1", function: { name: "search", arguments: "x".repeat(18001) } }] })]) {
    t.mock.method(globalThis, "fetch", async () => sse(text));
    await assert.rejects(complete([], [], AbortSignal.timeout(2000), false, { onContent() {} }), error => error instanceof Error && !error.message.includes("private body"));
  }
});

test("cancelling a live model response closes its stream without retrying", async t => {
  configure(t, { LLM_API_KEY: "fixture", LLM_STREAMING: undefined });
  const abort = new AbortController(); let cancelled = false; let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(event({ content: "Partial" }))); }, cancel() { cancelled = true; } }), { headers: { "Content-Type": "text/event-stream" } });
  });
  await assert.rejects(complete([], [], abort.signal, false, { onContent: () => abort.abort() }), { name: "AbortError" });
  assert.equal(cancelled, true);
  assert.equal(calls, 1);
});
