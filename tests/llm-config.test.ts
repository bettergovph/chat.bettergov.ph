import { test } from "node:test";
import assert from "node:assert/strict";
import { getLlmConfig } from "../lib/server/llm-config.ts";

const profiles = { ZAI_API_KEY: "zai-fixture", NYOLAB_API_KEY: "nyolab-fixture", LLM_API_KEY: "legacy-fixture", LLM_BASE_URL: "https://legacy.example/v1", LLM_MODEL: "legacy-model" };

test("provider selection isolates keys, model names and endpoints from stale legacy variables", () => {
  const nyolab = getLlmConfig({ ...profiles, LLM_PROVIDER: "nyolab", NYOLAB_MODEL: " glm-5.3-flash  ", NYOLAB_BASE_URL: " https://llm.nyolab.ai/api/public/v1/ " });
  assert.equal(nyolab.apiKey, profiles.NYOLAB_API_KEY);
  assert.equal(nyolab.baseUrl, "https://llm.nyolab.ai/api/public/v1");
  assert.equal(nyolab.model, "glm-5.3-flash");
  const zai = getLlmConfig({ ...profiles, LLM_PROVIDER: "zai" });
  assert.equal(zai.apiKey, profiles.ZAI_API_KEY);
  assert.equal(zai.baseUrl, "https://api.z.ai/api/paas/v4");
  assert.equal(zai.model, "glm-5.3-flash");
  assert.deepEqual(profiles, { ZAI_API_KEY: "zai-fixture", NYOLAB_API_KEY: "nyolab-fixture", LLM_API_KEY: "legacy-fixture", LLM_BASE_URL: "https://legacy.example/v1", LLM_MODEL: "legacy-model" });
});

test("missing or invalid selected profile fails without falling back to another key", () => {
  assert.throws(() => getLlmConfig({ ...profiles, LLM_PROVIDER: "nyolab", NYOLAB_API_KEY: undefined }), /not configured/);
  assert.throws(() => getLlmConfig({ ...profiles, LLM_PROVIDER: "zai", ZAI_API_KEY: "  " }), /not configured/);
  assert.throws(() => getLlmConfig({ ...profiles, LLM_PROVIDER: "typo" }), /Invalid LLM_PROVIDER/);
  for (const url of ["file:///tmp/key", "https://secret@api.example/v1", "https://api.example/v1?key=secret", "https://api.example/v1#secret"]) {
    assert.throws(() => getLlmConfig({ ...profiles, LLM_PROVIDER: "nyolab", NYOLAB_BASE_URL: url }), /endpoint configuration/);
  }
});

test("legacy deployments and explicit custom endpoints remain supported", () => {
  for (const provider of [undefined, "custom"]) {
    const config = getLlmConfig({ ...profiles, LLM_PROVIDER: provider, LLM_STREAMING: "off" });
    assert.equal(config.provider, "custom");
    assert.equal(config.apiKey, profiles.LLM_API_KEY);
    assert.equal(config.baseUrl, profiles.LLM_BASE_URL);
    assert.equal(config.model, profiles.LLM_MODEL);
    assert.equal(config.streaming, false);
  }
  assert.equal(getLlmConfig({ LLM_API_KEY: "old-zai" }).provider, "zai");
});
test("production rejects cleartext provider credentials", () => {
  assert.throws(() => getLlmConfig({ ...profiles, NODE_ENV: "production", LLM_PROVIDER: "custom", LLM_BASE_URL: "http://api.example/v1" }), /endpoint configuration/);
});
