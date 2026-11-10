import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/chat/route.ts";
process.env.LLM_API_KEY = "test-only";
process.env.TYPESAFE_API_KEY = "test-only";
process.env.LLM_BASE_URL = "https://llm.test/v1";

test("HTTPS proxy accepts only its explicitly configured origin", async () => {
  const previous = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://kuya-j.example:3443";
  try {
    const request = (origin: string) => POST(new Request("http://localhost:3000/api/chat", { method: "POST", headers: { "Content-Type": "application/json", origin, "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" }, body: JSON.stringify({ messages: [] }) }));
    assert.equal((await request("https://kuya-j.example:3443")).status, 400);
    assert.equal((await request("http://localhost:3000")).status, 400);
    assert.equal((await request("https://evil.example")).status, 403);
    assert.equal((await request("https://kuya-j.example:3443.evil.example")).status, 403);
  } finally { if (previous === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = previous; }
});

function fixture(options: { injection?: boolean; blockedTopic?: "programming" | "recipes" | "jailbreak"; missingJudgment?: string; failedSource?: boolean; failedScreen?: boolean; rateLimited?: boolean; badEvidence?: boolean; skippedLookup?: boolean; overview?: boolean; skipFirstLookup?: boolean; legal?: boolean; sourceGate?: Promise<void>; answerStream?: () => Response } = {}) {
  let llmCalls = 0;
  let toolCalls = 0;
  const provider = options.legal ? "juris" : "budget";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const target = String(url); const body = JSON.parse(String(init?.body ?? "{}"));
    if (target.includes("typesafe.ai")) {
      if (options.failedScreen) return new Response("Unavailable", { status: 503 });
      const answers = Object.fromEntries(Object.entries(body.questions as Record<string, {type: string}>).map(([key, q]) => [key, q.type === "choice" ? { type: "choice", choice: key === "primary" ? provider : "search", confidence: .99, probabilities: { [key === "primary" ? provider : "search"]: .99 } } : { type: "noul", noul: key === "injection" ? options.injection ? .99 : .01 : key === `source_${provider}` ? .99 : key.endsWith("_injection") ? options.badEvidence ? .99 : .01 : key.endsWith("_relevant") ? .99 : .01 }]));
      if (options.blockedTopic) answers[options.blockedTopic] = { type: "noul", noul: .99 };
      if (options.overview && body.questions.lookup_kind) answers.lookup_kind = { type: "choice", choice: "overview", confidence: .99, probabilities: { overview: .99 } };
      if (options.missingJudgment) delete answers[options.missingJudgment];
      return Response.json({ answers });
    }
    if (target.includes("llm.test")) {
      llmCalls++;
      if (options.rateLimited) return Response.json({ error: { message: "quota" } }, { status: 429 });
      if (llmCalls > 1 && options.answerStream) { assert.equal(body.stream, true); return options.answerStream(); }
      return Response.json({ choices: [{ finish_reason: "stop", message: llmCalls === (options.skipFirstLookup ? 2 : 1) && !options.skippedLookup ? { content: null, tool_calls: [{ id: "c1", type: "function", function: { name: options.legal ? "juris__get_republic_act" : "budget__get_gaa_year_snapshot", arguments: options.legal ? '{"ra_number":"10173","include_full_text":true}' : '{"year":2026}' } }] } : { content: "The test budget is ₱123. [1]" } }] });
    }
    if (target === `https://${options.legal ? "juris.ph" : "budget.bettergov.ph"}/mcp`) {
      toolCalls++;
      if (options.sourceGate) await options.sourceGate;
      if (options.failedSource) return new Response("Unavailable", { status: 503 });
      return Response.json({ result: { content: [{ type: "text", text: JSON.stringify(options.legal ? { title: "Data Privacy Act", url: "https://juris.ph/republic-act/770533ba-9d83-5332-9aeb-fc6d67d0003d", full_text: "Fixture authoritative legal text", source_url: "https://lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html" } : { data: { year: 2026, amount: 123 }, meta: { currency: "PHP", scale: "pesos" } }) }] } });
    }
    throw new Error("Unexpected outbound URL: " + target);
  };
  return { restore: () => { globalThis.fetch = originalFetch; }, getLlmCalls: () => llmCalls, getToolCalls: () => toolCalls };
}
async function requestEvents(debug = false, language = "auto", query = "What is the 2026 budget?") {
  const response = await POST(new Request("http://localhost:3000/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: query }], debug, language }) }));
  const events = (await response.text()).split("\n").filter(s => s.startsWith("data: ")).map(s => JSON.parse(s.slice(6)));
  return events;
}
async function request() { return (await requestEvents()).at(-1); }
test("a named Nyolab profile works without a legacy LLM key and identifies itself in debug", async t => {
  const keys = ["LLM_PROVIDER", "LLM_API_KEY", "NYOLAB_API_KEY", "NYOLAB_BASE_URL"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.LLM_PROVIDER = "nyolab";
  process.env.NYOLAB_API_KEY = "nyolab-test-only";
  process.env.NYOLAB_BASE_URL = "https://llm.test/v1";
  delete process.env.LLM_API_KEY;
  t.after(() => { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  const mock = fixture();
  try {
    const events = await requestEvents(true);
    assert.equal(events.at(-1).type, "done");
    assert.equal(events.at(-1).sources.length, 1);
    const start = events.find(event => event.stage === "request" && event.status === "started");
    assert.equal(start.detail.provider, "nyolab");
    assert.equal(start.detail.endpoint, "https://llm.test/v1/chat/completions");
    assert.doesNotMatch(JSON.stringify(events), /nyolab-test-only/);
  } finally { mock.restore(); }
});
test("provider failover keeps Jev, retrieval and citations intact and reports actual attempts", async t => {
  const config = { LLM_PROVIDER: "nyolab", LLM_FALLBACK_PROVIDER: "zai", NYOLAB_API_KEY: "nyolab-failover-secret", NYOLAB_BASE_URL: "https://unavailable-primary.test/v1", ZAI_API_KEY: "zai-failover-secret", ZAI_BASE_URL: "https://llm.test/v1" };
  const before = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  Object.assign(process.env, config);
  t.after(() => { for (const [key,value] of Object.entries(before)) { if(value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const mock = fixture();
  const mockFetch = globalThis.fetch;
  let primaryCalls = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("unavailable-primary.test")) { primaryCalls++; return Response.json({ error: { message: "No enabled backend for model; do not expose this body" } }, { status: 404 }); }
    return mockFetch(url, init);
  };
  try {
    const events = await requestEvents(true);
    assert.equal(events.at(-1).type, "done");
    assert.equal(events.at(-1).sources.length, 1);
    assert.match(events.at(-1).content, /\[1\]\(https:\/\/budget.bettergov.ph/);
    assert.equal(primaryCalls,1);
    assert.equal(mock.getLlmCalls(),2);
    assert.equal(mock.getToolCalls(),1);
    const fallback = events.find(e => e.type === "trace" && e.detail?.action === "fallback");
    assert.equal(fallback.detail.fromProvider,"nyolab");
    assert.equal(fallback.detail.provider,"zai");
    assert.equal(fallback.detail.reason,"model_unavailable");
    const summary = events.find(e => e.title === "Research completed").detail;
    assert.equal(summary.classifierRequests,2);
    assert.equal(summary.providerRequests,3);
    assert.equal(summary.providerFallbacks,1);
    assert.equal(summary.acceptedResults,1);
    assert.doesNotMatch(JSON.stringify(events),/failover-secret|do not expose this body/);
  } finally { mock.restore(); }
});
test("orchestration attaches citations from retrieved tool responses", async () => {
  const mock = fixture(); try { const event = await request(); assert.equal(event.type, "done"); assert.equal(event.sources.length, 1); assert.match(event.content, /\[1\]\(https:\/\/budget\.bettergov\.ph/); assert.equal(mock.getLlmCalls(), 2); } finally { mock.restore(); }
});
test("ordinary responses omit operational traces", async () => {
  const mock = fixture(); try { const events = await requestEvents(); assert.ok(events.every(event => event.type !== "trace")); } finally { mock.restore(); }
});
test("grounded answer text and registered links arrive before the provider finishes", async () => {
  let upstream!: ReadableStreamDefaultController<Uint8Array>;
  const encode = (content: string, finish_reason: string | null = null) => new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason }] })}\n\n`);
  const mock = fixture({ answerStream: () => new Response(new ReadableStream({ start(controller) {
    upstream = controller;
    controller.enqueue(encode("The budget is ₱123. [1]"));
  } }), { headers: { "Content-Type": "text/event-stream" } }) });
  try {
    const response = await POST(new Request("http://localhost:3000/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ debug: true, messages: [{ role: "user", content: "What is the 2026 budget?" }] }) }));
    const reader = response.body!.getReader(); const decoder = new TextDecoder(); let received = "";
    while (!received.includes('"type":"answer"')) {
      const chunk = await reader.read(); assert.equal(chunk.done, false); received += decoder.decode(chunk.value);
    }
    assert.ok(received.includes('"title":"Jev context decisions"'));
    assert.ok(!received.includes('"type":"done"'));
    const snapshot = received.split("\n").filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6))).find(event => event.type === "answer");
    assert.match(snapshot.content, /\[1\]\(https:\/\/budget.bettergov.ph/);
    assert.equal(snapshot.sources.length, 1);
    upstream.enqueue(encode(" This is a fixture.", "stop")); upstream.close();
    while (true) { const chunk = await reader.read(); if (chunk.done) break; received += decoder.decode(chunk.value); }
    const final = received.split("\n").filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6))).at(-1);
    assert.equal(final.type, "done");
    assert.match(final.content, /This is a fixture/);
  } finally { mock.restore(); }
});
test("Juris citations link to the knowledge base and retain Lawphil provenance in the trace", async () => {
  const mock = fixture({ legal: true });
  try {
    const events = await requestEvents(true);
    const traces = events.filter(event => event.type === "trace");
    const routing = traces.find(event => event.stage === "classifier" && event.status === "completed");
    assert.deepEqual(routing.detail.selectedSources, ["juris"]);
    assert.equal(routing.detail.judgments.source_juris.noul, .99);
    assert.equal(routing.detail.judgments.spam.noul, .01);
    const tool = traces.find(event => event.stage === "tool" && event.status === "started");
    assert.equal(tool.detail.endpoint, "https://juris.ph/mcp");
    assert.equal(tool.detail.transport, "MCP");
    assert.equal(tool.detail.operation, "get_republic_act");
    assert.deepEqual(tool.detail.arguments, { ra_number: "10173", include_full_text: true });
    const screening = traces.find(event => event.stage === "screening" && event.status === "completed");
    assert.equal(screening.detail.results[0].decision, "keep");
    assert.equal(screening.detail.results[0].injection, .01);
    const final = events.at(-1);
    assert.equal(final.sources[0].url, "https://juris.ph/republic-act/770533ba-9d83-5332-9aeb-fc6d67d0003d");
    assert.match(final.content, /\[1\]\(https:\/\/juris\.ph\/republic-act\//);
    assert.match(final.sources[0].originalUrls[0], /lawphil\.net/);
    const refs = traces.find(event => event.stage === "citations").detail.citations;
    assert.equal(refs[0].originalUrls[0], final.sources[0].originalUrls[0]);
    assert.equal(final.sources[0].retrievals[0].endpoint, "https://juris.ph/mcp");
    assert.equal(final.sources[0].retrievals[0].tool, "juris__get_republic_act");
    const summary = traces.at(-1).detail;
    assert.equal(summary.classifierRequests, 2);
    assert.equal(summary.toolRequests, 1);
    assert.equal(summary.generalWebSearch, "not configured");
    const serialized = JSON.stringify(traces);
    for (const forbidden of ["test-only", "Bearer ", "UNTRUSTED_SOURCE_EVIDENCE", "Fixture authoritative legal text", "reasoning_content"])
      assert.ok(!serialized.includes(forbidden), forbidden);
  } finally { mock.restore(); }
});
test("a tool-start event arrives while its source request is still pending", async () => {
  let release!: () => void;
  const mock = fixture({ sourceGate: new Promise<void>(resolve => { release = resolve; }) });
  try {
    const response = await POST(new Request("http://localhost:3000/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ debug: true, messages: [{ role: "user", content: "What is the 2026 budget?" }] }) }));
    const reader = response.body!.getReader(); const decoder = new TextDecoder(); let received = "";
    while (!received.includes('"stage":"tool","status":"started"')) {
      const chunk = await reader.read(); assert.equal(chunk.done, false); received += decoder.decode(chunk.value);
    }
    assert.ok(!received.includes('"type":"done"'));
    release();
    while (true) { const chunk = await reader.read(); if (chunk.done) break; received += decoder.decode(chunk.value); }
    assert.match(received, /"type":"done"/);
  } finally { release(); mock.restore(); }
});
test("debug traces distinguish upstream failures and filtered evidence", async () => {
  for (const options of [{ failedSource: true }, { badEvidence: true }, { failedScreen: true }]) {
    const mock = fixture(options);
    try {
      const events = await requestEvents(true);
      if (options.failedSource) assert.ok(events.some(e => e.type === "trace" && e.stage === "tool" && e.status === "failed" && e.detail.httpStatus === 503));
      if (options.failedScreen) assert.ok(events.some(e => e.type === "trace" && e.stage === "classifier" && e.status === "failed"));
      if (options.badEvidence) {
        const screened = events.find(e => e.type === "trace" && e.stage === "screening" && e.status === "completed");
        assert.equal(screened.detail.results[0].decision, "drop");
        assert.equal(events.at(-1).sources.length, 0);
      }
      if (options.failedSource || options.badEvidence) {
        const fallback = events.find(e => e.type === "trace" && e.detail?.reason === "no_accepted_evidence");
        assert.equal(fallback.detail.acceptedResults, 0);
        assert.equal(fallback.detail.lookupWarnings.length, options.failedSource ? 1 : 0);
        assert.deepEqual(events.at(-1).warnings, []);
      }
      assert.ok(!events.some(event => event.type === "answer"), "unverified drafts must not stream");
    } finally { mock.restore(); }
  }
});
test("screening blocks injection before any generation request", async () => {
  const mock = fixture({ injection: true }); try { const event = await request(); assert.match(event.content, /I can help you explore the Philippines/); assert.equal(mock.getLlmCalls(), 0); assert.equal(mock.getToolCalls(), 0); } finally { mock.restore(); }
});
test("topic and jailbreak decisions stop before generation or retrieval and explain the action in Debug", async () => {
  for (const blockedTopic of ["programming", "recipes", "jailbreak"] as const) {
    const mock = fixture({ blockedTopic });
    try {
      const events = await requestEvents(true, blockedTopic === "recipes" ? "fil" : "en");
      const screening = events.find(e => e.stage === "classifier" && e.status === "completed");
      assert.equal(screening.detail.action, blockedTopic);
      assert.equal(screening.detail.judgments[blockedTopic].noul, .99);
      assert.equal(screening.detail.lookupKind, "none");
      assert.deepEqual(screening.detail.selectedSources, []);
      const final = events.at(-1);
      assert.equal(final.type, "done");
      assert.deepEqual(final.sources, []);
      assert.match(final.content, blockedTopic === "recipes" ? /serbisyo publiko/ : /explore the Philippines/);
      assert.doesNotMatch(final.content, /evidence|verified|threshold|programming|jailbreak/i);
      assert.ok(!events.some(e => e.type === "answer" || e.stage === "tool" || e.stage === "model"));
      const summary = events.find(e => e.title === "Request blocked by input screening").detail;
      assert.equal(summary.classifierRequests, 1);
      assert.equal(summary.modelRequests, 0);
      assert.equal(summary.toolRequests, 0);
      assert.equal(mock.getLlmCalls(), 0);
      assert.equal(mock.getToolCalls(), 0);
    } finally { mock.restore(); }
  }
});
test("a missing new screening judgment fails closed instead of granting access", async () => {
  const mock = fixture({ missingJudgment: "programming" });
  try {
    const events = await requestEvents(true);
    assert.equal(events.at(-1).type, "error");
    assert.match(events.at(-1).message, /screening service/);
    assert.equal(mock.getLlmCalls(), 0);
    assert.equal(mock.getToolCalls(), 0);
  } finally { mock.restore(); }
});
test("screening outages fail closed", async () => {
  const mock = fixture({ failedScreen: true }); try { const event = await request(); assert.equal(event.type, "error"); assert.match(event.message, /screening service/); assert.equal(mock.getLlmCalls(), 0); } finally { mock.restore(); }
});
test("failed retrieval cannot yield an unsupported factual answer", async () => {
  const mock = fixture({ failedSource: true }); try { const event = await request(); assert.equal(event.type, "done"); assert.equal(event.sources.length, 0); assert.doesNotMatch(event.content, /123|evidence|verified/); assert.match(event.content, /Sorry, I couldn’t help with that question this time/); } finally { mock.restore(); }
});
test("automatic tool selection cannot bypass evidence requirements by skipping retrieval", async () => {
  const mock = fixture({ skippedLookup: true }); try { const event = await request(); assert.equal(event.type, "done"); assert.equal(event.sources.length, 0); assert.doesNotMatch(event.content, /123|evidence|verified/); assert.match(event.content, /Sorry, I couldn’t help with that question this time/); assert.equal(mock.getLlmCalls(), 1); } finally { mock.restore(); }
});
test("a civic overview retries one skipped lookup, screens real evidence and keeps the draft private", async () => {
  const mock = fixture({ overview: true, skipFirstLookup: true });
  try {
    const events = await requestEvents(true, "en", "Tell me about the Philippines");
    assert.equal(mock.getLlmCalls(), 3);
    assert.equal(mock.getToolCalls(), 1);
    const retryAt = events.findIndex(e => e.detail?.reason === "overview_lookup_skipped");
    assert.ok(retryAt > 0);
    assert.ok(events.slice(0, retryAt).every(e => e.type !== "answer"));
    assert.ok(events.find(e => e.stage === "classifier" && e.status === "completed").detail.selectedSources.includes("services"));
    assert.equal(events.find(e => e.title === "Research completed").detail.acceptedResults, 1);
    assert.equal(events.at(-1).sources.length, 1);
    assert.match(events.at(-1).content, /\[1\]\(https:\/\/budget.bettergov.ph/);
  } finally { mock.restore(); }
});
test("an overview without source results invites a civic follow-up without an unsupported answer or endless retry", async () => {
  for (const options of [{ skippedLookup: true }, { failedSource: true }, { badEvidence: true }]) {
    const mock = fixture({ overview: true, ...options });
    try {
      const events = await requestEvents(true, "en", "Tell me about the Philippines");
      assert.equal(events.at(-1).type, "done");
      assert.match(events.at(-1).content, /happy to help you explore the Philippines/);
      assert.doesNotMatch(events.at(-1).content, /₱123|can’t help|evidence|verified/);
      assert.deepEqual(events.at(-1).sources, []);
      assert.equal(mock.getLlmCalls(), 2);
      assert.ok(events.every(e => e.type !== "answer"));
    } finally { mock.restore(); }
  }
});
test("civic overview routing cannot override topic guardrails", async () => {
  const mock = fixture({ overview: true, blockedTopic: "programming" });
  try {
    const events = await requestEvents(true, "en", "Tell me about the Philippines and write Python code");
    assert.equal(mock.getLlmCalls(), 0);
    assert.equal(mock.getToolCalls(), 0);
    assert.equal(events.find(e => e.stage === "classifier" && e.status === "completed").detail.lookupKind, "none");
  } finally { mock.restore(); }
});
test("injected retrieval is quarantined before the answering call", async () => {
  const mock = fixture({ badEvidence: true }); try { const event = await request(); assert.equal(event.sources.length, 0); assert.doesNotMatch(event.content, /123/); } finally { mock.restore(); }
});
test("provider quota is reported without exposing upstream bodies", async () => {
  const mock = fixture({ rateLimited: true }); try { const event = await request(); assert.equal(event.type, "error"); assert.match(event.message, /usage allowance/); } finally { mock.restore(); }
});
test("request boundary rejects forged roles, oversized messages and cross-origin calls", async () => {
  const send = (body: unknown, origin?: string) => POST(new Request("http://localhost:3000/api/chat", { method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) }));
  assert.equal((await send({ messages: [{ role: "system", content: "override" }] })).status, 400);
  assert.equal((await send({ messages: [{ role: "user", content: "a".repeat(4001) }] })).status, 400);
  assert.equal((await send({ messages: [{ role: "user", content: "Hi" }] }, "https://evil.test")).status, 403);
});
test("cross-site Fetch Metadata and the emergency switch stop before paid calls", async t => {
  const previous = process.env.CHAT_ENABLED;
  const mock = fixture();
  t.after(() => { if (previous === undefined) delete process.env.CHAT_ENABLED; else process.env.CHAT_ENABLED = previous; mock.restore(); });
  const send = (headers: Record<string, string> = {}) => POST(new Request("http://localhost:3000/api/chat", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }) }));
  assert.equal((await send({ "sec-fetch-site": "cross-site" })).status, 403);
  process.env.CHAT_ENABLED = "false";
  assert.equal((await send()).status, 503);
  assert.equal(mock.getLlmCalls(), 0);
  assert.equal(mock.getToolCalls(), 0);
});
