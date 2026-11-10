import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { jsonFetch, UpstreamError, readLimited } from "../lib/server/http.ts";

test("body limits apply without Content-Length and aborted reads cancel stalled streams", async () => {
  let cancelled = false;
  const stalled = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20);
  try { await assert.rejects(readLimited(stalled, 100, controller.signal), error => error instanceof Error && error.name === "AbortError"); }
  finally { clearTimeout(timer); }
  assert.equal(cancelled, true);
  await assert.rejects(readLimited(new Response("oversized"), 3), /size limit/);
});

test("provider redirects are rejected without forwarding authorization", async () => {
  let destinationRequests = 0;
  const server = createServer((request, response) => {
    if (request.url === "/redirect") {
      response.writeHead(302, { Location: "/destination" }); response.end();
    } else {
      destinationRequests++; response.end('{"ok":true}');
    }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await assert.rejects(jsonFetch(`http://127.0.0.1:${address.port}/redirect`, {
      headers: { Authorization: "Bearer test-only" },
    }), error => error instanceof UpstreamError && error.status === 302);
    assert.equal(destinationRequests, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
