import { mkdir, writeFile } from "node:fs/promises";
import { assessInput, inputQuestions } from "../lib/server/typesafe.ts";
import { POLICY } from "../lib/server/policy.ts";
import { CIVIC_SCOPE } from "../lib/server/civic-scope.ts";
import { guardrailCases } from "../tests/fixtures/input-guardrails.ts";

// Opt-in live evaluation: synthetic cases only, no answer-model or source calls.
try { process.loadEnvFile(".env.local"); } catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
if (!process.env.TYPESAFE_API_KEY) throw new Error("Set TYPESAFE_API_KEY before running the live evaluation.");
const only = process.argv.find(arg => arg.startsWith("--only="))?.slice(7).split(",");
const cases = guardrailCases.filter(c => !only || only.includes(c.id));
if (!cases.length) throw new Error("No evaluation cases selected.");
const startedAt = new Date().toISOString();
const results: Record<string, unknown>[] = new Array(cases.length);
let cursor = 0;
// Keep provider load bounded, and do not silently retry failures.
await Promise.all(Array.from({ length: Math.min(2, cases.length) }, async () => {
  while (cursor < cases.length) {
    const index = cursor++;
    const sample = cases[index];
    const started = performance.now();
    try {
      const result = await assessInput(sample.messages, AbortSignal.timeout(25000));
      const actual = result.action === "allow" ? "allow" : "block";
      const decisionPassed = actual === sample.expected;
      const routingPassed = (!sample.lookupKind || result.lookupKind === sample.lookupKind) && (!sample.includesSources || sample.includesSources.every(source => result.sources.some(selected => selected === source)));
      const passed = decisionPassed && routingPassed;
      results[index] = { id: sample.id, passed, decisionPassed, routingPassed, actual, elapsedMs: Math.round(performance.now() - started), ...result };
      console.log(`${passed ? "PASS" : "FAIL"} ${sample.id}: ${result.action}, ${result.lookupKind}, ${result.sources.join(",")}`);
    } catch {
      results[index] = { id: sample.id, passed: false, actual: "error", elapsedMs: Math.round(performance.now() - started) };
      console.log(`ERROR ${sample.id}: screening did not complete`);
    }
  }
}));
const summary = {
  cases: cases.length,
  passed: results.filter(r => r.passed).length,
  errors: results.filter(r => r.actual === "error").length,
  falseAllows: results.filter((r, i) => r.actual === "allow" && cases[i].expected === "block").length,
  falseBlocks: results.filter((r, i) => r.actual === "block" && cases[i].expected === "allow").length,
  routingFailures: results.filter(r => r.routingPassed === false).length,
};
const report = { startedAt, finishedAt: new Date().toISOString(), configuredModel: process.env.TYPESAFE_MODEL || "jev-latest", concurrency: 2, policy: POLICY, civicScope: CIVIC_SCOPE, questions: inputQuestions(), cases, results, summary };
await mkdir("outputs", { recursive: true });
const path = `outputs/jev-input-guardrails-${startedAt.replace(/[:.]/g, "-")}.json`;
await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(summary));
console.log(`Report: ${path}`);
if (summary.passed !== cases.length) process.exitCode = 1;
