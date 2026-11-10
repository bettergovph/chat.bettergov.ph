import { test } from "node:test";
import assert from "node:assert/strict";
import { createCompletionSession, type ProviderEvent, type LlmMessage } from "../lib/server/llm.ts";
import { getFallbackLlmConfig, type LlmConfig } from "../lib/server/llm-config.ts";
import { ProviderHealth } from "../lib/server/provider-health.ts";
import { getTools } from "../lib/server/tools.ts";

const primary: LlmConfig = { provider: "nyolab", baseUrl: "https://primary.test/v1", model: "glm-5.3-flash", apiKey: "primary-fixture-secret", reasoningEffort: "low", streaming: true };
const fallback: LlmConfig = { ...primary, provider: "zai", baseUrl: "https://backup.test/v1", apiKey: "backup-fixture-secret" };
const answer = (content = "A grounded answer [1].") => Response.json({ choices: [{ finish_reason: "stop", message: { content } }] });
const chunk = (delta: unknown, finish_reason: string | null = null) => `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason }] })}\n\n`;
const stream = (body: string) => new Response(body, { headers: { "Content-Type": "text/event-stream" } });
const session = (extra: Parameters<typeof createCompletionSession>[0] = {}) => createCompletionSession({ primary, fallback, health: new ProviderHealth(), ...extra });

test("a missing primary backend falls back once, preserves evidence/tools, isolates keys and stays on the backup", async t => {
  const events: ProviderEvent[] = [];
  const requests: {url: string; key: string | null; body: Record<string, unknown>}[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    requests.push({ url, key: new Headers(init.headers).get("Authorization"), body: JSON.parse(String(init.body)) });
    if (url.startsWith(primary.baseUrl)) return Response.json({ error: { message: "No enabled backend; private upstream body" } }, { status: 404 });
    return answer();
  });
  const client = session({ onProviderEvent: event => events.push(event) });
  const history: LlmMessage[] = [{ role: "system", content: "Use accepted evidence only" }, { role: "user", content: "Tell me about the Philippines" }, { role: "tool", tool_call_id: "already-executed", content: "Accepted source evidence and citation [1]" }];
  const tools = getTools(["statistics"]);
  assert.match((await client.complete(history, tools, AbortSignal.timeout(1000), true)).content!, /grounded/);
  await client.complete(history, [], AbortSignal.timeout(1000));
  assert.deepEqual(requests.map(r=>r.url), [primary.baseUrl, fallback.baseUrl, fallback.baseUrl].map(base=>`${base}/chat/completions`));
  assert.deepEqual(requests.slice(0,2).map(r=>r.key), [`Bearer ${primary.apiKey}`, `Bearer ${fallback.apiKey}`]);
  assert.deepEqual(requests[0].body, requests[1].body, "same instructions, evidence and allowed tools go to the backup");
  assert.equal(history.length, 3);
  assert.equal(events.filter(e=>e.action === "fallback").length, 1);
  assert.equal(events.find(e=>e.action === "fallback")?.reason, "model_unavailable");
  assert.doesNotMatch(JSON.stringify(events), /fixture-secret|private upstream body|Accepted source evidence/);
});

test("availability errors qualify, while auth, invalid requests and provider safety refusals do not", async t => {
  for (const status of [404, 408, 429, 500, 502, 503, 504, 400, 401, 403, 422]) {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => ++calls === 1 ? new Response("private body", { status }) : answer());
    const pending = session().complete([], [], AbortSignal.timeout(1000));
    if ([400,401,403,422].includes(status)) { await assert.rejects(pending, new RegExp(`HTTP ${status}`)); assert.equal(calls, 1); }
    else { await pending; assert.equal(calls, 2); }
  }
  for (const finish_reason of ["content_filter", "length"]) {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({ choices: [{ finish_reason, message: { content: "" } }] }); });
    await assert.rejects(session().complete([], [], AbortSignal.timeout(1000)));
    assert.equal(calls, 1);
  }
  for (const response of [Response.json({ error: { code: "content_filter" } }), Response.json({ choices: [{ finish_reason: "stop", message: { content: null, refusal: "Declined" } }] }), stream(chunk({ refusal: "Declined" }, "stop"))]) {
    let calls=0;
    t.mock.method(globalThis,"fetch",async()=>{calls++;return response;});
    await assert.rejects(session().complete([],[],AbortSignal.timeout(1000),false,{onContent(){}}),/could not complete/);
    assert.equal(calls,1);
  }
});

test("network and malformed responses can fail over before output", async t => {
  for (const kind of ["network", "invalid-json", "empty"]) {
    let calls=0;
    t.mock.method(globalThis, "fetch", async () => {
      if (++calls > 1) return answer();
      if (kind === "network") throw new TypeError("fetch failed");
      return kind === "invalid-json" ? new Response("<html>gateway failure</html>") : answer("");
    });
    await session().complete([], [], AbortSignal.timeout(1000));
    assert.equal(calls,2);
  }
});

test("both providers failing is bounded and subsequent sessions skip their cooldowns", async t => {
  let calls = 0;
  const health = new ProviderHealth();
  t.mock.method(globalThis, "fetch", async () => { calls++; return new Response(null, { status: 503 }); });
  await assert.rejects(session({health}).complete([], [], AbortSignal.timeout(1000)), /HTTP 503/);
  assert.equal(calls,2);
  const events: ProviderEvent[]=[];
  await assert.rejects(session({health,onProviderEvent:e=>events.push(e)}).complete([], [], AbortSignal.timeout(1000)), /temporarily unavailable/);
  assert.equal(calls,2);
  assert.deepEqual(events.filter(e=>e.action==="skipped").map(e=>e.provider),["nyolab","zai"]);
});

test("circuit recovery admits one probe and an older successful request cannot erase a newer failure", () => {
  let now=0;
  const health=new ProviderHealth(()=>now,100);
  const first=health.acquire(primary),concurrent=health.acquire(primary);
  assert.ok("lease" in first && "lease" in concurrent);
  health.failure(first.lease,"model_unavailable");
  health.success(concurrent.lease);
  assert.ok(!("lease" in health.acquire(primary)));
  now=101;
  const probe=health.acquire(primary);
  assert.ok("lease" in probe);
  assert.ok(!("lease" in health.acquire(primary)),"only one in-flight recovery probe");
  health.success(probe.lease);
  assert.ok("lease" in health.acquire(primary));
});

test("a cooling primary is skipped and a later successful probe restores primary preference", async t => {
  let now=0,calls=0;
  const health=new ProviderHealth(()=>now,100);
  const urls:string[]=[];
  t.mock.method(globalThis,"fetch",async (url:string)=>{urls.push(url);return ++calls===1 ? new Response(null,{status:404}) : answer();});
  await session({health}).complete([],[],AbortSignal.timeout(1000));
  await session({health}).complete([],[],AbortSignal.timeout(1000));
  now=101;
  await session({health}).complete([],[],AbortSignal.timeout(1000));
  assert.deepEqual(urls.map(url=>new URL(url).hostname),["primary.test","backup.test","backup.test","primary.test"]);
});

test("an interrupted partial answer never switches providers, including later rounds in that turn", async t => {
  let calls=0;
  t.mock.method(globalThis,"fetch",async()=>{calls++;return stream(chunk({content:"Partial answer"}));});
  const texts:string[]=[];
  await assert.rejects(session().complete([],[],AbortSignal.timeout(1000),false,{onContent:text=>texts.push(text)}),/interrupted/);
  assert.deepEqual(texts,["Partial answer"]);
  assert.equal(calls,1);
  calls=0;
  t.mock.method(globalThis,"fetch",async()=>++calls===1 ? stream(chunk({content:"An answer"},"stop")+"data: [DONE]\n\n") : new Response(null,{status:503}));
  const client=session();
  await client.complete([],[],AbortSignal.timeout(1000),false,{onContent(){}});
  await assert.rejects(client.complete([],[],AbortSignal.timeout(1000)),/HTTP 503/);
  assert.equal(calls,2);
});

test("unfinished tool fragments can be discarded before any tool executes", async t => {
  let calls=0;
  t.mock.method(globalThis,"fetch",async()=>++calls===1 ? stream(chunk({tool_calls:[{index:0,id:"partial",type:"function",function:{name:"services_search",arguments:'{"query":'}}]})) : answer());
  const texts:string[]=[];
  await session().complete([],getTools(["services"]),AbortSignal.timeout(1000),true,{onContent:text=>texts.push(text)});
  assert.equal(calls,2);
  assert.equal(texts.filter(Boolean).length,1);
});

test("a stalled primary fails over within its first-output deadline", async t => {
  let calls=0;
  t.mock.method(globalThis,"fetch",async (_url:string,init:RequestInit)=>{
    if(++calls>1)return answer();
    return new Promise<Response>((_resolve,reject)=>init.signal!.addEventListener("abort",()=>reject(init.signal!.reason),{once:true}));
  });
  const reasons:string[]=[];
  await session({firstOutputMs:10,onProviderEvent:e=>{if(e.action==="fallback")reasons.push(e.reason!);}}).complete([],[],AbortSignal.timeout(1000));
  assert.equal(calls,2);assert.deepEqual(reasons,["timeout"]);
});

test("a healthy answer may continue streaming beyond the first-output deadline", async t => {
  let calls=0;
  t.mock.method(globalThis,"fetch",async()=>{
    calls++;
    return new Response(new ReadableStream({start(controller){
      controller.enqueue(new TextEncoder().encode(chunk({content:"Hello"})));
      setTimeout(()=>{controller.enqueue(new TextEncoder().encode(chunk({},"stop")));controller.close();},35);
    }}),{headers:{"Content-Type":"text/event-stream"}});
  });
  const result=await session({firstOutputMs:10}).complete([],[],AbortSignal.timeout(1000),false,{onContent(){}});
  assert.equal(result.content,"Hello");assert.equal(calls,1);
});

test("a primary keeps its full deadline when the backup is cooling down", async t => {
  const health=new ProviderHealth();
  const lease=health.acquire(fallback);assert.ok("lease" in lease);
  health.failure(lease.lease,"provider_unavailable");
  let calls=0;
  t.mock.method(globalThis,"fetch",async (_url:string,init:RequestInit)=>{
    calls++;
    return new Promise<Response>((resolve,reject)=>{
      const timer=setTimeout(()=>resolve(answer()),35);
      init.signal!.addEventListener("abort",()=>{clearTimeout(timer);reject(init.signal!.reason);},{once:true});
    });
  });
  await session({health,firstOutputMs:10}).complete([],[],AbortSignal.timeout(1000));
  assert.equal(calls,1);
});

test("user cancellation does not call the backup or mark the primary unhealthy", async t => {
  const health=new ProviderHealth();const abort=new AbortController();let calls=0;
  t.mock.method(globalThis,"fetch",async()=>{calls++;abort.abort();throw abort.signal.reason;});
  await assert.rejects(session({health}).complete([],[],abort.signal),{name:"AbortError"});
  assert.equal(calls,1);assert.ok("lease" in health.acquire(primary));
});

test("fallback is explicit, independently configured and can be turned off", () => {
  assert.equal(getFallbackLlmConfig(primary,{}),undefined);
  assert.equal(getFallbackLlmConfig(primary,{LLM_FALLBACK_PROVIDER:"off"}),undefined);
  assert.equal(getFallbackLlmConfig(primary,{LLM_FALLBACK_PROVIDER:"nyolab"}),undefined);
  const profile=getFallbackLlmConfig(primary,{LLM_FALLBACK_PROVIDER:"zai",ZAI_API_KEY:"backup",NYOLAB_API_KEY:"never-borrow",LLM_API_KEY:"legacy"});
  assert.equal(profile?.provider,"zai");assert.equal(profile?.apiKey,"backup");
  assert.throws(()=>getFallbackLlmConfig(primary,{LLM_FALLBACK_PROVIDER:"zai",LLM_API_KEY:"legacy"}),/not configured/);
  assert.throws(()=>getFallbackLlmConfig(primary,{LLM_FALLBACK_PROVIDER:"typo"}),/Invalid/);
  assert.throws(()=>getFallbackLlmConfig(primary,{LLM_FALLBACK_PROVIDER:"zai",ZAI_API_KEY:"backup",ZAI_BASE_URL:primary.baseUrl}),/different AI endpoint/);
});
