import { test } from "node:test";
import assert from "node:assert/strict";
import { decideInput, decidePassage, isSafeCitationUrl, linkCitations, selectSources, POLICY, type Answers } from "../lib/server/policy.ts";
import { SOURCES } from "../lib/sources.ts";
import { executeTool, getTools, validateToolArguments } from "../lib/server/tools.ts";
import { resolveCitationUrl } from "../lib/citations.ts";
const n = (noul: number) => ({ type: "noul" as const, noul });
const safeInput = () => ({ injection: n(.01), jailbreak: n(.01), spam: n(.01), programming: n(.01), recipes: n(.01) });
test("high-confidence injection takes precedence over spam", () => {
  assert.equal(decideInput({ ...safeInput(), injection: n(.99), spam: n(.99) }), "injection");
  assert.equal(decideInput({ ...safeInput(), injection: n(.1), spam: n(.99) }), "spam");
  assert.equal(decideInput({ ...safeInput(), injection: n(.5), spam: n(.4) }), "allow");
});
test("each excluded topic blocks at its threshold even when a civic source is relevant", () => {
  for (const key of ["jailbreak", "programming", "recipes"] as const) {
    const boundary = POLICY[`${key}Block`];
    assert.equal(decideInput({ ...safeInput(), [key]: n(boundary), source_juris: n(.99) }), key);
    assert.equal(decideInput({ ...safeInput(), [key]: n(boundary - .001) }), "allow");
    for (const invalid of [NaN, Infinity, -.01, 1.01]) assert.throws(() => decideInput({ ...safeInput(), [key]: n(invalid) }));
    const missing: Answers = safeInput(); delete missing[key];
    assert.throws(() => decideInput(missing), /Invalid TypeSafe probability/);
  }
});
test("uncertainty does not silently exclude sources needed for multi-topic research", () => {
  const answers: Answers = Object.fromEntries(SOURCES.map(s => [`source_${s.id}`, n(.1)]));
  answers.primary = { type: "choice", choice: "budget", confidence: .2, probabilities: { budget: .3 } };
  assert.equal(selectSources(answers).length, SOURCES.length);
  answers.primary.confidence = .95; answers.source_budget = n(.9); answers.source_flood = n(.8);
  assert.deepEqual(selectSources(answers), ["budget", "flood"]);
});
test("broad civic overviews retain discovery and primary sources even with uncertain or sparse relevance", () => {
  const answers: Answers = Object.fromEntries(SOURCES.map(s => [`source_${s.id}`, n(.1)]));
  answers.lookup_kind = { type: "choice", choice: "overview", confidence: .95, probabilities: { overview: .95 } };
  answers.primary = { type: "choice", choice: "none", confidence: .8, probabilities: { none: .8 } };
  answers.source_statistics = n(.8);
  assert.deepEqual(selectSources(answers), ["services", "statistics"]);
  answers.primary = { type: "choice", choice: "juris", confidence: .4, probabilities: { juris: .5 } };
  assert.deepEqual(selectSources(answers), ["services", "juris", "statistics"]);
  for (const source of SOURCES) answers[`source_${source.id}`] = n(.9);
  const selected = selectSources(answers);
  assert.equal(selected.length, 4);
  assert.equal(new Set(selected).size, 4);
  assert.ok(selected.includes("services") && selected.includes("juris"));
  assert.equal(decideInput({ ...safeInput(), ...answers, programming: n(.99) }), "programming");
});
test("injected evidence is dropped even when highly relevant; contradictory evidence is retained", () => {
  assert.equal(decidePassage({ p_injection: n(.95), p_relevant: n(.99), p_conflict: n(.8) }, "p"), "drop");
  assert.equal(decidePassage({ p_injection: n(.01), p_relevant: n(.1), p_conflict: n(.9) }, "p"), "conflict");
  assert.equal(decidePassage({ p_injection: n(.01), p_relevant: n(.1), p_conflict: n(.1) }, "p"), "drop");
});
test("malformed classifier output cannot become an allow judgment", () => {
  assert.throws(() => decideInput({ injection: n(NaN), spam: n(0) }));
  assert.throws(() => decidePassage({ p_injection: n(2) }, "p"));
});
test("citations only link retrieved reference IDs", () => {
  assert.equal(linkCitations("A [1]. Made up [99]. Hijacked [1](https://evil.test).", [{ id: 1, url: "https://budget.bettergov.ph/api/v1/gaa" }]), "A [1](https://budget.bettergov.ph/gaa). Made up . Hijacked [1](https://budget.bettergov.ph/gaa).");
  for (const url of ["javascript:alert(1)", "http://example.com", "https://localhost/a", "https://127.0.0.1/a", "https://user:pass@site.test", "https://169.254.169.254/latest/meta-data"]) assert.equal(isSafeCitationUrl(url), false, url);
});
test("tool arguments reject unrecognized keys and out-of-range sizes", () => {
  const tool = getTools(["flood"])[0];
  assert.throws(() => validateToolArguments(tool, { query: "Bulacan", url: "https://evil.test" }));
  assert.throws(() => validateToolArguments(tool, { query: "Bulacan", limit: 1200 }));
  assert.doesNotThrow(() => validateToolArguments(tool, { query: "Bulacan", limit: 5 }));
});
test("named and numbered references use knowledge-base pages without guessing shared source matches", () => {
  const original = "https://senate.gov.ph/bill.pdf";
  const url = "https://bills.juris.ph/bills/senate/sbn-2451";
  const citations = [{ id: 1, url, originalUrls: [original] }];
  assert.equal(linkCitations(`Bill [1] and [details](${original}) and [unknown](https://example.com).`, citations), `Bill [1](${url}) and [details](${url}) and unknown.`);
  assert.equal(resolveCitationUrl(original, citations), url);
  const ambiguous = [...citations, { id: 2, url: "https://bills.juris.ph/bills/senate/sbn-2445", originalUrls: [original] }];
  assert.equal(resolveCitationUrl(original, ambiguous), undefined);
  assert.equal(linkCitations(`[Shared listing](${original})`, ambiguous), "Shared listing");
});
test("classification cannot be used as an arbitrary HTTP proxy", async () => {
  const tool = getTools(["classification"])[0];
  for (const path of ["../v1", "https://evil.test", "psgc/%2e%2e/secret", "psgc//evil"])
    await assert.rejects(executeTool(tool, { path }, AbortSignal.timeout(1000)), /Invalid classification/);
});
