import { test } from "node:test";
import assert from "node:assert/strict";
import { citationEndpoint, classificationUrl } from "../lib/server/provider-contracts.ts";
import { compactEvidence, evidenceLinks, executeTool, getTools, type ToolResult } from "../lib/server/tools.ts";

test("classification paths and system-specific filters follow the mirrored catalog", () => {
  for (const [path, filter, code] of [
    ["psgc/Q2_2024/provinces", "reg", "01"],
    ["psic/2019/classes", "classcode", "0111"],
    ["psoc/2012/unit", "majorcode", "1"],
    ["pcoicop/2020/item", "subclasscode", "01111"],
    ["pcpc/2002/item", "itemcode", "01111"],
    ["pscc/2022/commodity", "chapter", "01"],
    ["psced/2008/course", "field", "14"],
    ["psccs/2018/groups", "sectioncode", "01"],
  ]) {
    const url = new URL(classificationUrl(`/api/classification/${path}`, { [filter]: code }));
    assert.equal(url.pathname, `/api/classification/${path}`);
    assert.equal(url.searchParams.get(filter), code);
    assert.equal(url.searchParams.get("page_size"), "30");
  }
  assert.equal(new URL(classificationUrl("manifest.json")).pathname, "/api/classification/manifest.json");
  assert.equal(new URL(classificationUrl("ptscs/products", { page_size: "1000" })).searchParams.get("page_size"), "100");
  assert.equal(new URL(classificationUrl("ptscs/industry")).searchParams.get("page_size"), "30");
  assert.throws(() => classificationUrl("psgc/Q2_2024/all"), /Invalid classification/);
  assert.throws(() => classificationUrl("ptscs/2024/products"), /Invalid classification/);
  assert.throws(() => classificationUrl("psgc/Q2_2024/regions", { majorcode: "1" }), /Unsupported/);
  for (const page of ["0", "-1", "01", "1.5", "Infinity", "9007199254740992"])
    assert.throws(() => classificationUrl("ptscs/industry", { page }), /pagination/);
});

test("flood lookup bounds geography, rejects fake pagination and includes coverage", async t => {
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => { requests.push(url); return Response.json({ results: [{ hits: [], offset: 0, estimatedTotalHits: 0 }] }); });
  const tool = getTools(["flood"])[0];
  const signal = AbortSignal.timeout(1000);
  const result = await executeTool(tool, { query: "Bulacan", bbox: [120, 14, 122, 16], limit: 2 }, signal);
  const url = new URL(requests[0]);
  assert.equal(url.searchParams.get("bbox"), "120,14,122,16");
  assert.equal(url.searchParams.has("offset"), false);
  assert.match(compactEvidence(result.data), /Excludes projects without coordinates/);
  await assert.rejects(executeTool(tool, { query: "Bulacan", offset: 1 }, signal), /Invalid tool/);
  for (const bbox of [[122, 14, 120, 16], [120, 16, 122, 14], [120, -95, 122, 16], [120, 14, 182, 16], [1, 2]])
    await assert.rejects(executeTool(tool, { query: "", bbox }, signal));
  assert.equal(requests.length, 1, "invalid arguments must not reach the provider");
});

test("Meilisearch uses the shared index, publication filter and typed pagination", async t => {
  const previousKey = process.env.MEILI_API_KEY;
  const previousIndex = process.env.MEILI_INDEX;
  process.env.MEILI_API_KEY = "fixture-key"; delete process.env.MEILI_INDEX;
  t.after(() => { if (previousKey === undefined) delete process.env.MEILI_API_KEY; else process.env.MEILI_API_KEY = previousKey; if (previousIndex === undefined) delete process.env.MEILI_INDEX; else process.env.MEILI_INDEX = previousIndex; });
  let body: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => { body = JSON.parse(String(init.body)).queries[0]; return Response.json({ results: [] }); });
  const tool = getTools(["services"])[0];
  await executeTool(tool, { query: "passport", type: "service", offset: 6, limit: 3 }, AbortSignal.timeout(1000));
  assert.equal(body.indexUid, "bettergov");
  assert.equal(body.filter, '(type IN [directory_item, website] OR (type = service AND published = true)) AND type = service');
  assert.equal(body.offset, 6);
  await assert.rejects(executeTool(tool, { query: "passport", type: "service OR published = false" }, AbortSignal.timeout(1000)), /Invalid tool/);
});

test("MCP default limits are bounded and citation URL reflects the effective lookup", async t => {
  let args: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    args = JSON.parse(String(init.body)).params.arguments;
    return Response.json({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: '{"data":[]}' }] } });
  });
  const tool = getTools(["budget"]).find(t => t.remoteName === "search_gaa_line_items")!;
  const result = await executeTool(tool, { department_id: "07" }, AbortSignal.timeout(1000));
  assert.equal(args.limit, 30);
  assert.equal(new URL(result.url).searchParams.get("limit"), "30");
});

test("budget and election citations encode the actual REST filters", () => {
  const cite = (provider: "budget" | "officials", remoteName: string, args: Record<string, unknown>) => new URL(citationEndpoint({ provider, remoteName }, args));
  const hierarchy = cite("budget", "browse_gaa_hierarchy", { department_id: "07", year: 2026, level: "agencies", include_zero: true });
  assert.equal(hierarchy.pathname, "/api/v1/gaa/years/2026/departments/07/children");
  assert.equal(hierarchy.searchParams.get("include_zero"), "1");
  const rollup = cite("budget", "get_nep_2027_rollup", { dimension: "region", code: "03", by_department: true });
  assert.equal(rollup.pathname, "/api/v1/nep/2027/rollups/region");
  assert.equal(rollup.searchParams.get("by"), "department");
  assert.equal(rollup.searchParams.get("code"), "03");
  const transcript = cite("budget", "get_hearing_transcript", { video_id: "abc", from_seconds: 100, to_seconds: 200, limit: 5 });
  assert.equal(transcript.pathname, "/api/v1/hearings/abc/transcript");
  assert.equal(transcript.searchParams.get("from"), "100");
  assert.equal(transcript.searchParams.get("to"), "200");
  const contest = cite("officials", "get_contest", { year: 2025, province: "bulacan", position: "GOVERNOR" });
  assert.equal(contest.pathname, "/api/v1/contests");
  assert.equal(contest.searchParams.get("candidates"), "1");
  const bloc = cite("officials", "get_blocs", { min_members: 3, members: true });
  assert.equal(bloc.searchParams.get("min"), "3");
  assert.equal(bloc.searchParams.get("year"), "2025");
  assert.equal(bloc.searchParams.get("members"), "1");
});

test("statistical citations distinguish country catalogs, dimension values and observations", () => {
  assert.equal(citationEndpoint({ provider: "asean", remoteName: "list_countries" }, {}), "https://asean.bettergov.ph/api/v1/countries");
  const values = new URL(citationEndpoint({ provider: "statistics", remoteName: "list_dimension_values" }, { id: "abc", dimension: "Geo", release: "v1", q: "Manila" }));
  assert.equal(values.pathname, "/api/v1/datasets/abc/values");
  assert.equal(values.searchParams.get("release"), "v1");
  assert.equal(values.searchParams.get("dimension"), "Geo");
  assert.equal(citationEndpoint({ provider: "statistics", remoteName: "query_dataset" }, { id: "abc" }), "https://statistics.bettergov.ph/datasets/abc");
});

test("citations prefer knowledge-base pages while retaining original provenance", () => {
  const base: ToolResult = { provider: "statistics", title: "PSA query", tool: "get_dataset", url: "https://statistics.bettergov.ph/api/v1/datasets/abc", data: { data: { title: "Employment", source: "https://openstat.psa.gov.ph/table", links: { page: "/datasets/abc" } } } };
  assert.deepEqual(evidenceLinks(base).map(l => l.url), ["https://statistics.bettergov.ph/datasets/abc"]);
  assert.deepEqual(evidenceLinks(base)[0].originalUrls, ["https://openstat.psa.gov.ph/table", base.url]);
  const bills = evidenceLinks({ ...base, provider: "bills", data: { discovery: { shortTitle: "Education Bill", officialRecordUrl: "https://legacy.senate.gov.ph/bill" }, measure: { shortTitle: "Education Bill", versions: [{ sourceUrl: "https://legacy.senate.gov.ph/bill.pdf" }] } } });
  assert.equal(bills.length, 1);
  assert.equal(bills[0].url, "https://bills.juris.ph/");
  assert.ok(bills[0].originalUrls?.includes("https://legacy.senate.gov.ph/bill.pdf"));
  const directory = evidenceLinks({ ...base, provider: "services", data: { results: [{ hits: [{ type: "directory_item", office_name: "Agency office", slug: "agency-office", website: "https://agency.gov.ph" }] }] } });
  assert.deepEqual(directory, [{ title: "Agency office", url: "https://bettergov.ph/directory/agency-office", originalUrls: ["https://agency.gov.ph"] }]);
  const badLink = evidenceLinks({ ...base, data: { source: "javascript:alert(1)", links: { page: "//evil.test/page" } } });
  assert.deepEqual(badLink.map(link => link.url), ["https://statistics.bettergov.ph/datasets/abc"]);
});

test("bills sharing a Senate listing retain separate BatasWatch citations", () => {
  const senate = "https://senate.gov.ph/lis/documents_v2?congress=20";
  const links = evidenceLinks({ provider: "bills", tool: "bills__get_author", title: "Author bills", url: "https://bills.juris.ph/api", data: {
    author: { displayName: "Vicente C. Sotto III", url: "https://bills.juris.ph/authors/senate?author=Vicente+C.+Sotto+III", officialProfileUrl: "https://senate.gov.ph/senator/Vicente-C.-Sotto-III" },
    bills: { items: [2451, 2445].map(number => ({ title: `Bill ${number}`, url: `https://bills.juris.ph/bills/senate/sbn-${number}`, officialRecordUrl: senate })) },
  } });
  assert.equal(links.length, 3);
  assert.equal(links[0].title, "Vicente C. Sotto III");
  assert.equal(links[1].url, "https://bills.juris.ph/bills/senate/sbn-2451");
  assert.equal(links[2].url, "https://bills.juris.ph/bills/senate/sbn-2445");
  assert.deepEqual(links[1].originalUrls, [senate]);
});

test("bill detail versions inherit the enclosing knowledge-base page", () => {
  const links = evidenceLinks({ provider: "bills", tool: "bills__get_bill", title: "Bill lookup", url: "https://bills.juris.ph/api", data: {
    url: "https://bills.juris.ph/bills/senate/sbn-2451",
    discovery: { title: "Hospital bill", officialRecordUrl: "https://senate.gov.ph/bill" },
    measure: { shortTitle: "Hospital bill", versions: [{ sourceUrl: "https://senate.gov.ph/bill.pdf" }] },
  } });
  assert.deepEqual(links, [{ title: "Hospital bill", url: "https://bills.juris.ph/bills/senate/sbn-2451", originalUrls: ["https://senate.gov.ph/bill", "https://senate.gov.ph/bill.pdf"] }]);
});

test("Juris law and case pages take precedence over Lawphil and PDFs", () => {
  for (const path of ["case", "republic-act"]) {
    const links = evidenceLinks({ provider: "juris", tool: "juris__lookup", title: "Lookup", url: "https://juris.ph/api", data: { results: [{ case_title: "Retrieved record", source_url: "https://lawphil.net/document.html", url: `https://juris.ph/${path}/record-id`, pdf_url: "https://juris-assets.bettergov.ph/doc.pdf" }] } });
    assert.equal(links.length, 1);
    assert.equal(links[0].url, `https://juris.ph/${path}/record-id`);
    assert.deepEqual(links[0].originalUrls, ["https://lawphil.net/document.html", "https://juris-assets.bettergov.ph/doc.pdf"]);
  }
});

test("knowledge-base preference does not invent pages or accept lookalike origins", () => {
  const base: ToolResult = { provider: "bills", tool: "bills__get_bill", title: "Bill", url: "https://bills.juris.ph/api", data: {} };
  assert.deepEqual(evidenceLinks(base), []);
  assert.deepEqual(evidenceLinks({ ...base, data: { items: [], meta: { total: 0 } } }), []);
  const original = "https://senate.gov.ph/document.pdf";
  const links = evidenceLinks({ ...base, data: { title: "Bill", number: "SBN-1", sourceUrl: original, url: "https://bills.juris.ph.evil.example/bills/senate/sbn-1" } });
  assert.equal(links[0].url, "https://bills.juris.ph/");
  assert.ok(links[0].originalUrls?.includes(original));
  assert.equal(evidenceLinks({ ...base, data: { sourceUrl: original, url: "/\\[" } })[0].url, "https://bills.juris.ph/");
});

test("evidence truncation preserves provenance, limits and legal text before summaries", () => {
  const evidence = compactEvidence({ sections: Array.from({ length: 50 }, () => ({ summary: "x".repeat(1000) })), full_text: "Authoritative text of Section 2.", source_url: "https://lawphil.net/example", sections_note: "Summaries are incomplete", release: "2026-01", next_cursor: "cursor-123", total_count: 123 });
  assert.ok(evidence.indexOf("Authoritative text") < evidence.indexOf("sections\""));
  assert.match(evidence, /Summaries are incomplete/);
  assert.match(evidence, /cursor-123/);
  assert.match(evidence, /2026-01/);
  assert.match(evidence, /NOT a complete result set/);
});
