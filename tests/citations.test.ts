import { test } from "node:test";
import assert from "node:assert/strict";
import { knowledgePageUrl, publicCitationUrl, resolveCitationUrl } from "../lib/citations.ts";
import { evidenceLinks } from "../lib/server/evidence-links.ts";
import { linkCitations } from "../lib/server/policy.ts";
import type { ToolResult } from "../lib/server/tools.ts";

const psa = (data: unknown, url = "https://statistics.bettergov.ph/api/v1/datasets"): ToolResult => ({ provider: "statistics", tool: "statistics__search_datasets", title: "PSA datasets", url, data });

test("PSA search cites each returned dataset page without a competing aggregate API citation", () => {
  const result = psa({ data: ["employment", "population"].map(id => ({ id, title: id, url: `/api/v1/datasets/${id}`, links: { page: `/datasets/${id}`, api: `/api/v1/datasets/${id}` }, source: "https://openstat.psa.gov.ph/" })) });
  const links = evidenceLinks(result);
  assert.deepEqual(links.map(link => link.url), ["https://statistics.bettergov.ph/datasets/employment", "https://statistics.bettergov.ph/datasets/population"]);
  assert.ok(links[0].originalUrls?.includes("https://statistics.bettergov.ph/api/v1/datasets/employment"));
  assert.equal(resolveCitationUrl("https://openstat.psa.gov.ph/", links), undefined, "shared provenance must not select an arbitrary dataset");
});

test("PSA metadata, dimension values and POST observations all navigate to the dataset", () => {
  const url = "https://statistics.bettergov.ph/datasets/example-id";
  for (const suffix of ["", "/values?dimension=Geo&release=v1", "/query"]) {
    const links = evidenceLinks(psa({ data: [{ code: "PH", label: "Philippines" }] }, `https://statistics.bettergov.ph/api/v1/datasets/example-id${suffix}`));
    assert.equal(links.length, 1);
    assert.equal(links[0].url, url);
  }
  const links = evidenceLinks(psa({ data: { dataset: { id: "example-id", title: "Employment" }, rows: [{ Year: "2026", value: 12 }] } }, url));
  assert.deepEqual(links, [{ title: "Employment", url }]);
});

test("explicit public pages take precedence over a record's API URL", () => {
  const links = evidenceLinks(psa({ data: { title: "Dataset", url: "/api/v1/datasets/id", links: { page: "/datasets/id?view=table" } } }));
  assert.equal(links.length, 1);
  assert.equal(links[0].url, "https://statistics.bettergov.ph/datasets/id?view=table");
});

test("records without a public page use the source website while empty results stay uncited", () => {
  const result: ToolResult = { provider: "flood", tool: "flood_search", title: "Flood projects", url: "https://flood-control.bettergov.ph/api/flood-control-projects?q=Bulacan", data: { data: [{ name: "Flood barrier", amount: 100 }] } };
  assert.equal(evidenceLinks(result)[0].url, "https://flood-control.bettergov.ph/");
  assert.ok(evidenceLinks(result)[0].originalUrls?.includes(result.url));
  assert.deepEqual(evidenceLinks(psa({ data: [], pagination: { total: 0 }, links: { page: "/search" } })), []);
  assert.equal(publicCitationUrl({ provider: "statistics", url: "https://statistics.bettergov.ph/api/unknown" }), "https://statistics.bettergov.ph/");
});

test("confirmed provider routes replace machine endpoints without guessing individual records", () => {
  for (const [provider, url, expected] of [
    ["budget", "https://budget.bettergov.ph/api/v1/gaa/years/2026", "https://budget.bettergov.ph/gaa/2026"],
    ["budget", "https://budget.bettergov.ph/api/v1/gaa/departments/07/programs?year=2026", "https://budget.bettergov.ph/d/07/programs"],
    ["budget", "https://budget.bettergov.ph/api/v1/nep/2027/departments/07", "https://budget.bettergov.ph/2027/d/07"],
    ["budget", "https://budget.bettergov.ph/api/v1/hearings/video-id/transcript", "https://budget.bettergov.ph/hearings/video-id"],
    ["classification", "https://statistics.bettergov.ph/api/classification/psgc/Q2_2024/regions", "https://statistics.bettergov.ph/classification"],
    ["dpwh", "https://api.dpwh.bettergov.ph/projects/18HB0201", "https://transparency.bettergov.ph/dpwh/projects/18HB0201"],
    ["dpwh", "https://api.dpwh.bettergov.ph/unknown", "https://transparency.bettergov.ph/"],
    ["asean", "https://asean.bettergov.ph/api/v1/datasets/fiscal/rows", "https://asean.bettergov.ph/data"],
    ["officials", "https://officials.bettergov.ph/api/v1/persons/id", "https://officials.bettergov.ph/"],
  ] as const) assert.equal(publicCitationUrl({ provider, url }), expected);
  const result: ToolResult = { provider: "officials", tool: "officials__search_officials", title: "Officials", url: "https://officials.bettergov.ph/api/v1/persons", data: { persons: [{ id: "person-id", display_name: "A retrieved name", province_slug: "abra" }] } };
  assert.equal(evidenceLinks(result)[0].url, "https://officials.bettergov.ph/person/abra/person-id");
  const projects: ToolResult = { provider: "dpwh", tool: "dpwh_search", title: "DPWH projects", url: "https://api.dpwh.bettergov.ph/projects?limit=2", data: { data: { data: [{ contractId: "19G00068", description: "Flood mitigation structures" }, { contractId: "18HB0201", description: "A road project" }] } } };
  assert.deepEqual(evidenceLinks(projects).map(link => link.url), ["https://transparency.bettergov.ph/dpwh/projects/19G00068", "https://transparency.bettergov.ph/dpwh/projects/18HB0201"]);
});

test("unsafe origins, credentials and machine/download paths cannot masquerade as public pages", () => {
  for (const value of ["https://juris.ph.evil.example/case/id", "https://user:secret@juris.ph/case/id", "//evil.example/id", "/\\evil.example", "javascript:alert(1)", "/api/unknown", "/mcp", "/data.json", "/document.pdf"])
    assert.equal(knowledgePageUrl(value, "juris"), undefined, value);
  assert.equal(knowledgePageUrl("/case/returned-id", "juris"), "https://juris.ph/case/returned-id");
});

test("inline and copied Markdown references map legacy API URLs to public dataset pages", () => {
  const api = "https://statistics.bettergov.ph/api/v1/datasets/id/values?dimension=Year";
  const page = "https://statistics.bettergov.ph/datasets/id";
  const citations = [{ id: 1, provider: "statistics" as const, url: api }];
  assert.equal(linkCitations(`Dataset [1] and [details](${api}).`, citations), `Dataset [1](${page}) and [details](${page}).`);
  assert.equal(resolveCitationUrl(api, citations), page);
  assert.equal(resolveCitationUrl("https://statistics.bettergov.ph/datasets/unregistered", citations), undefined);
});
