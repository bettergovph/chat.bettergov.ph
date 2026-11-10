import { getTools, executeTool } from "../lib/server/tools.ts";
const checks: [string, Record<string, unknown>][] = [
  ["services_search", { query: "passport", limit: 2 }],
  ["budget__get_gaa_year_snapshot", { year: 2026 }],
  ["juris__get_republic_act", { ra_number: "10173" }],
  ["bills__search_bills", { query: "education", limit: 2 }],
  ["officials__search_officials", { query: "Sotto", limit: 2 }],
  ["dpwh_search", { query: "Bulacan", limit: 2 }],
  ["flood_search", { query: "Bulacan", limit: 2 }],
  ["statistics__search_datasets", { q: "employment", limit: 2 }],
  ["classification_lookup", { path: "" }],
  ["asean__list_countries", {}],
];
const tools = getTools(["services", "budget", "juris", "bills", "officials", "dpwh", "flood", "statistics", "classification", "asean"]);
for (let i = 0; i < checks.length; i += 2) {
  await Promise.all(checks.slice(i, i + 2).map(async ([name, args]) => {
    const start = Date.now();
    try { const result = await executeTool(tools.find(t => t.name === name)!, args, AbortSignal.timeout(25000)); console.log(JSON.stringify({ source: result.provider, ok: true, bytes: JSON.stringify(result.data).length, ms: Date.now() - start })); }
    catch (e) { console.log(JSON.stringify({ tool: name, ok: false, error: e instanceof Error ? e.message : "Unknown error" })); process.exitCode = 1; }
  }));
}
