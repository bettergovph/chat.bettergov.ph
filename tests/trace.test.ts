import { test } from "node:test";
import assert from "node:assert/strict";
import { createTrace, redactTrace } from "../lib/server/trace.ts";
import type { TraceEvent } from "../lib/trace.ts";

test("debug output redacts credentials while preserving usable timing and usage fields", () => {
  const safe = redactTrace({ arguments: { query: "look up secret-123", apiKey: "arbitrary-value" }, endpoint: "https://example.test/?key=secret-123", authorization: "Bearer another-secret", message: "Bearer third-secret", usage: { input_tokens: 500 }, nested: [{ password: "fourth-secret" }] }, ["secret-123"]);
  const text = JSON.stringify(safe);
  for (const secret of ["secret-123", "arbitrary-value", "another-secret", "third-secret", "fourth-secret"]) assert.ok(!text.includes(secret));
  assert.match(text, /"input_tokens":500/);
  assert.match(text, /\[redacted\]/);
});

test("traces are opt-in, bounded and ordered per request", () => {
  const events: TraceEvent[] = [];
  const entry = { stage: "tool" as const, status: "started" as const, title: "MCP lookup", detail: {} };
  createTrace(false, e => events.push(e))(entry);
  assert.equal(events.length, 0);
  const trace = createTrace(true, e => events.push(e));
  for (let i = 0; i < 210; i++) trace(entry);
  assert.equal(events.length, 200);
  assert.equal(events[0].sequence, 1);
  assert.equal(events.at(-1)?.sequence, 200);
  assert.equal(new Set(events.map(e => e.requestId)).size, 1);
  assert.ok(events.every(e => e.elapsedMs >= 0));
});

test("traces redact both selected and inactive provider credentials", t => {
  const before = { zai: process.env.ZAI_API_KEY, nyolab: process.env.NYOLAB_API_KEY };
  process.env.ZAI_API_KEY = "private-zai-fixture";
  process.env.NYOLAB_API_KEY = "private-nyolab-fixture";
  t.after(() => {
    if (before.zai === undefined) delete process.env.ZAI_API_KEY; else process.env.ZAI_API_KEY = before.zai;
    if (before.nyolab === undefined) delete process.env.NYOLAB_API_KEY; else process.env.NYOLAB_API_KEY = before.nyolab;
  });
  const events: TraceEvent[] = [];
  createTrace(true, event => events.push(event))({ stage: "model", status: "started", title: "Provider test", detail: { provider: "nyolab", arbitrary: "private-zai-fixture private-nyolab-fixture" } });
  assert.equal(events[0].detail.provider, "nyolab");
  assert.doesNotMatch(JSON.stringify(events), /private-(zai|nyolab)-fixture/);
});
