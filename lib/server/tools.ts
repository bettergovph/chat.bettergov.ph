import catalog from "./mcp-catalog.json";
import { SOURCES, type SourceId, type RetrievalReference } from "../sources.ts";
import { isRecord, jsonFetch } from "./http.ts";
import { citationEndpoint, classificationUrl, floodUrl, params } from "./provider-contracts.ts";
export { evidenceLinks } from "./evidence-links.ts";

type Schema = Record<string, unknown>;
export type Tool = { name: string; provider: SourceId; description: string; parameters: Schema; remoteName?: string; endpoint?: string };
export type ToolRequest = RetrievalReference & { method: "POST" | "GET"; operation: string; arguments: Record<string, unknown> };
export type ToolResult = { provider: SourceId; tool: string; data: unknown; url: string; title: string; retrieval?: RetrievalReference };
const objectSchema = (properties: Schema, required: string[] = []): Schema => ({ type: "object", properties, required, additionalProperties: false });
const query = { type: "string", maxLength: 500, description: "Short search terms in English, a place name or contract identifier. Do not send an entire question when keywords suffice." };
const limit = { type: "integer", minimum: 1, maximum: 20, default: 6 };
const CUSTOM_TOOLS: Tool[] = [
  { name: "services_search", provider: "services", description: "Search BetterGov's published services, agency directory and government websites. Optionally filter by record type. Returns source links; do not invent requirements or fees absent from these records.", parameters: objectSchema({ query, limit, type: { type: "string", enum: ["service", "directory_item", "website"] }, offset: { type: "integer", minimum: 0, maximum: 10000 } }, ["query"]) },
  { name: "dpwh_search", provider: "dpwh", description: "Search DPWH infrastructure projects by location, contractor, project name or contract ID. Returns recorded status, PHP budget, dates and pagination. A sample is not a national total.", parameters: objectSchema({ query, limit, page: { type: "integer", minimum: 1, maximum: 100 } }, ["query"]) },
  { name: "flood_search", provider: "flood", description: "Search geocoded flood control projects by a single place, contractor, phrase or contract ID. q is a substring, not a multi-keyword AND search. Only projects with coordinates are covered. Optional bbox narrows geography. Returns a bounded sample, PHP amounts and recorded progress; there is NO offset/pagination. Narrow the query or bbox instead. Do not infer national totals from hits or treat estimatedTotalHits as an audited count.", parameters: objectSchema({ query, limit, bbox: { type: "array", items: { type: "number" }, minItems: 4, maxItems: 4, description: "West longitude, south latitude, east longitude, north latitude in degrees. West < east, south < north. Use known bounds only." } }, ["query"]) },
  { name: "classification_lookup", provider: "classification", description: "Read PSA classification catalog or records. Start with empty path, then a system such as psgc, or manifest.json for snapshot coverage. Follow catalog-returned versions and levels (e.g. psgc/Q2_2024/regions). Tourism is unversioned: ptscs/products or ptscs/industry. PSGC has no all endpoint. Preserve leading zeros and state the snapshot vintage. No free-text search; discover hierarchy filter codes first.", parameters: objectSchema({ path: { type: "string", maxLength: 120, description: "Relative path below /api/classification, catalog-returned /api/classification/... path, or empty string." }, filters: { type: "object", additionalProperties: { type: "string", maxLength: 100 }, description: "page/page_size on record paths. PSGC: reg,prv,mun,bgy; PSOC: majorcode,submajorcode,minorcode,unitcode; PSCC: section,chapter,heading,commodity; PSCED: level,broadgroup,field,program,course; industry/product/crime: section,division,group,class_code,subclasscode (PCPC also itemcode); consumption: division,group,class_code,subclass,item,subitem. Use only this system's documented filters and aliases. Tourism has only pagination." } }) },
];
export function getTools(sourceIds: SourceId[]): Tool[] {
  const remote: Tool[] = Object.entries(catalog).filter(([id]) => sourceIds.includes(id as SourceId)).flatMap(([provider, config]) => config.tools.map(t => ({ name: `${provider}__${t.name}`, provider: provider as SourceId, remoteName: t.name, endpoint: config.endpoint, description: t.description, parameters: t.inputSchema as Schema })));
  return [...remote, ...CUSTOM_TOOLS.filter(t => sourceIds.includes(t.provider))];
}
function checkSchema(value: unknown, schema: Schema, depth = 0): boolean {
  if (depth > 12) return false;
  if (schema.enum && !(schema.enum as unknown[]).includes(value)) return false;
  if (schema.type === "object") {
    if (!isRecord(value)) return false;
    const properties = (schema.properties ?? {}) as Record<string, Schema>;
    if (Array.isArray(schema.required) && schema.required.some(key => !(String(key) in value))) return false;
    for (const [key, item] of Object.entries(value)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") return false;
      if (properties[key]) { if (!checkSchema(item, properties[key], depth + 1)) return false; }
      else if (schema.additionalProperties === false) return false;
      else if (isRecord(schema.additionalProperties) && !checkSchema(item, schema.additionalProperties, depth + 1)) return false;
    }
  }
  if (schema.type === "string" && (typeof value !== "string" || value.length > Number(schema.maxLength ?? 4000) || value.length < Number(schema.minLength ?? 0) || (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)))) return false;
  if (schema.type === "boolean" && typeof value !== "boolean") return false;
  if (schema.type === "number" || schema.type === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value) || (schema.type === "integer" && !Number.isInteger(value)) || value < Number(schema.minimum ?? -Infinity) || value > Number(schema.maximum ?? Infinity)) return false;
  }
  if (schema.type === "array") { if (!Array.isArray(value) || value.length > Number(schema.maxItems ?? 5000) || value.length < Number(schema.minItems ?? 0)) return false; if (isRecord(schema.items) && !value.every(item => checkSchema(item, schema.items as Schema, depth + 1))) return false; }
  return true;
}
export function validateToolArguments(tool: Tool, value: unknown): asserts value is Record<string, unknown> {
  if (!isRecord(value) || !checkSchema(value, tool.parameters)) throw new Error("Invalid tool arguments. Follow the supplied schema.");
}
export async function executeTool(tool: Tool, args: Record<string, unknown>, signal: AbortSignal, onRequest?: (request: ToolRequest) => void): Promise<ToolResult> {
  validateToolArguments(tool, args);
  const title = `${SOURCES.find(s => s.id === tool.provider)!.name} — ${tool.remoteName?.replaceAll("_", " ") ?? String(args.query ?? args.path ?? "lookup")}`;
  if (tool.remoteName && tool.endpoint) {
    const bounded = { ...args };
    const properties = tool.parameters.properties as Record<string, Schema> | undefined;
    for (const key of ["limit", "per_page", "bills_limit"]) {
      if (typeof bounded[key] === "number") bounded[key] = Math.min(bounded[key] as number, 30);
      else if (properties?.[key]) bounded[key] = Math.min(Number(properties[key].default ?? 30), 30);
    }
    const retrieval: RetrievalReference = { provider: tool.provider, tool: tool.name, transport: "MCP", endpoint: tool.endpoint };
    onRequest?.({ ...retrieval, method: "POST", operation: tool.remoteName, arguments: bounded });
    const result = await jsonFetch(tool.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool.remoteName, arguments: bounded } }), signal });
    if (!isRecord(result) || result.error || !isRecord(result.result) || result.result.isError) throw new Error("The source could not complete this lookup. Try narrower filters or another source.");
    const blocks = result.result.content;
    let data: unknown = result.result.structuredContent;
    if (!data && Array.isArray(blocks)) data = blocks.filter(b => b.type === "text").map(b => { try { return JSON.parse(b.text); } catch { return b.text; } });
    if (Array.isArray(data) && data.length === 1) data = data[0];
    if (!data) throw new Error("The source returned no readable content.");
    return { provider: tool.provider, tool: tool.name, data, title, url: citationEndpoint(tool, bounded), retrieval };
  }
  if (tool.name === "services_search") {
    const key = process.env.MEILI_API_KEY;
    if (!key) throw new Error("BetterGov search is not configured.");
    const base = process.env.MEILI_URL || "https://search2.bettergov.ph";
    const publicRecords = '(type IN [directory_item, website] OR (type = service AND published = true))';
    const filter = args.type ? `${publicRecords} AND type = ${args.type}` : publicRecords;
    const retrieval: RetrievalReference = { provider: tool.provider, tool: tool.name, transport: "Meilisearch", endpoint: `${base.replace(/\/$/, "")}/multi-search` };
    const search = { indexUid: process.env.MEILI_INDEX || "bettergov", q: args.query, filter, offset: args.offset ?? 0, limit: args.limit ?? 6 };
    onRequest?.({ ...retrieval, method: "POST", operation: "multi-search", arguments: { queries: [search] } });
    const data = await jsonFetch(retrieval.endpoint, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` }, body: JSON.stringify({ queries: [search] }), signal });
    return { provider: tool.provider, tool: tool.name, title, data, url: "https://bettergov.ph", retrieval };
  }
  let url: string;
  if (tool.name === "dpwh_search") url = `https://api.dpwh.bettergov.ph/projects?${params({ search: args.query, limit: args.limit ?? 6, page: args.page ?? 1 })}`;
  else if (tool.name === "flood_search") url = floodUrl(args);
  else if (tool.name === "classification_lookup") {
    url = classificationUrl(String(args.path ?? ""), isRecord(args.filters) ? args.filters : {});
  } else throw new Error("Unknown tool.");
  const retrieval: RetrievalReference = { provider: tool.provider, tool: tool.name, transport: "REST", endpoint: url };
  onRequest?.({ ...retrieval, method: "GET", operation: tool.name, arguments: Object.fromEntries(new URL(url).searchParams) });
  const data = await jsonFetch(url, { signal });
  return { provider: tool.provider, tool: tool.name, title, data: tool.provider === "flood" ? { coverage: "Geocoded flood control projects only. Bounded sample with no offset/pagination; narrow the place/phrase or bounding box. Excludes projects without coordinates. Not national totals.", data } : data, url, retrieval };
}
export function compactEvidence(data: unknown): string {
  let truncated = false;
  // Providers often append provenance and full text AFTER very long row/summary arrays.
  // Keep those fields ahead of samples so size limits cannot silently erase their caveats.
  const priority = (key: string) => /^(meta|coverage|.*note|scope|unit|source|source_url|sourceUpdated|retrieved|release|selection|checked|updatedAt|fetchedAt|snapshot|.*count|.*total.*|next.*|.*cursor|truncated|has_more|title|id)$/i.test(key) ? 0 : key === "full_text" ? 1 : 2;
  const walk = (value: unknown, depth = 0): unknown => {
    if (depth > 14) { truncated = true; return "[Nested data omitted]"; }
    if (typeof value === "string" && value.length > 16000) { truncated = true; return value.slice(0, 16000) + " [Excerpt ends; retrieve narrower evidence before making a specific claim.]"; }
    if (Array.isArray(value)) { if (value.length > 60) truncated = true; return value.slice(0, 60).map(v => walk(v, depth + 1)); }
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).filter(([key]) => !/embedding|vector|_formatted|_matchesPosition/i.test(key)).sort(([a], [b]) => priority(a) - priority(b)).map(([key, v]) => [key, walk(v, depth + 1)]));
    return value;
  };
  const text = JSON.stringify(walk(data));
  return (text.length > 22000 ? text.slice(0, 22000) + "\n[Excerpt truncated. This is NOT a complete result set.]" : text) + (truncated ? "\n[Some long fields or arrays were abbreviated. Do not infer completeness or totals.]" : "");
}
