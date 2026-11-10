import { SOURCES, type SourceId } from "../sources.ts";

export function params(values: Record<string, unknown>) {
  return new URLSearchParams(Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])).toString();
}
function withQuery(base: string, values: Record<string, unknown> = {}) {
  const query = params(values);
  return base + (query ? `?${query}` : "");
}

// Matched to psa/lib/classification-spec.mjs and scripts/classification/catalog.mjs.
const classificationFilters: Record<string, string[]> = {
  psgc: ["reg", "prv", "mun", "bgy"],
  psic: ["section", "division", "group", "class_code", "subclasscode"],
  psoc: ["majorcode", "submajorcode", "minorcode", "unitcode"],
  pcoicop: ["division", "group", "class_code", "subclass", "item", "subitem"],
  pcpc: ["section", "division", "group", "class_code", "subclasscode", "itemcode"],
  pscc: ["section", "chapter", "heading", "commodity"],
  psced: ["level", "broadgroup", "field", "program", "course"],
  psccs: ["section", "division", "group", "class_code", "subclasscode"],
  ptscs: [],
};
const filterAliases: Record<string, string[]> = {
  section: ["sectioncode"], division: ["divisioncode"], group: ["groupcode"], class_code: ["classcode"],
  subclass: ["subclasscode"], item: ["itemcode"], subitem: ["subitemcode"],
};
export function classificationUrl(input: string, filters: Record<string, unknown> = {}) {
  // Accept catalog-returned local paths, never arbitrary origins, queries or encoded traversal.
  const path = input.replace(/^\/api\/classification(?:\/|$)/, "").replace(/^\/+|\/+$/g, "");
  if (path && path !== "manifest.json" && !/^(psgc|psic|psoc|pcoicop|pcpc|pscc|psced|psccs|ptscs)(\/[A-Za-z0-9_-]+){0,2}$/.test(path)) throw new Error("Invalid classification path. Discover paths from the classification catalog.");
  const parts = path.split("/");
  if (parts[0] === "psgc" && parts.includes("all")) throw new Error("Invalid classification path. PSGC exposes individual levels, not all.");
  const records = parts[0] === "ptscs" ? parts.length === 2 : parts.length === 3;
  if (parts[0] === "ptscs" && (parts.length > 2 || (records && !["products", "industry"].includes(parts[1])))) throw new Error("Invalid classification path. Tourism uses ptscs/products or ptscs/industry without a version.");
  const allowed = new Set(records ? ["page", "page_size", ...(classificationFilters[parts[0]] ?? []).flatMap(key => [key, ...(filterAliases[key] ?? [])])] : []);
  if (Object.keys(filters).some(key => !allowed.has(key))) throw new Error("Unsupported classification filter for this system or catalog path.");
  for (const key of ["page", "page_size"]) {
    if (filters[key] !== undefined && (!/^[1-9]\d*$/.test(String(filters[key])) || !Number.isSafeInteger(Number(filters[key])))) throw new Error("Invalid classification pagination.");
  }
  return withQuery(`https://statistics.bettergov.ph/api/classification${path ? "/" + path : ""}`, { ...filters, ...(records ? { page_size: Math.min(Number(filters.page_size ?? 30), 100) } : {}) });
}

export function floodUrl(args: Record<string, unknown>) {
  const bbox = args.bbox as number[] | undefined;
  if (bbox && (bbox.length !== 4 || bbox.some(n => !Number.isFinite(n)) || Math.abs(bbox[0]) > 180 || Math.abs(bbox[2]) > 180 || Math.abs(bbox[1]) > 90 || Math.abs(bbox[3]) > 90 || bbox[0] >= bbox[2] || bbox[1] >= bbox[3])) throw new Error("Invalid bounding box. Use west, south, east, north in longitude/latitude degrees.");
  return withQuery("https://flood-control.bettergov.ph/api/flood-control-projects", { q: args.query, limit: args.limit ?? 6, bbox: bbox?.join(",") });
}

// Read-only REST equivalents of MCP operations. Keep path and query arguments separate.
export function citationEndpoint(tool: { provider: SourceId; remoteName?: string }, args: Record<string, unknown>): string {
  const name = tool.remoteName;
  const enc = (value: unknown) => encodeURIComponent(String(value ?? ""));
  const pick = (...keys: string[]) => Object.fromEntries(keys.map(key => [key, args[key]]));
  if (tool.provider === "budget") {
    const root = "https://budget.bettergov.ph/api/v1";
    const dept = `/gaa/departments/${enc(args.department_id)}`;
    const nep = `/nep/2027${args.department_id ? `/departments/${enc(args.department_id)}` : ""}`;
    const hearing = `/hearings/${enc(args.video_id)}`;
    const paths: Record<string, string> = {
      list_gaa_departments: "/gaa/departments", get_gaa_national_trends: "/gaa", get_gaa_department: dept,
      get_gaa_year_snapshot: `/gaa/years/${enc(args.year)}`, get_nep_2027_overview: "/nep/2027",
      list_nep_2027_departments: "/nep/2027/departments", get_nep_2027_department: nep,
      get_budget_cycle: `/budget-cycle${args.department_id ? `/departments/${enc(args.department_id)}` : ""}`,
      get_hearing: hearing, get_hearing_timeline: `${hearing}/timeline`,
    };
    if (name && paths[name]) return root + paths[name];
    if (name === "search_gaa_programs") return withQuery(root + "/gaa/search", { ...pick("department_id", "year", "limit"), q: args.query });
    if (name === "get_gaa_department_programs" || name === "search_gaa_line_items") return withQuery(root + dept + (name === "search_gaa_line_items" ? "/objects" : "/programs"), { ...pick("year", "agency_id", "expense_class", "limit", "cursor"), q: args.query });
    if (name === "browse_gaa_hierarchy") return withQuery(`${root}/gaa/years/${enc(args.year)}/departments/${enc(args.department_id)}/children`, { ...pick("level", "parent", "limit", "cursor"), include_zero: args.include_zero === true ? 1 : undefined });
    if (name === "get_nep_2027_rollup") return withQuery(`${root}${nep}/rollups/${enc(args.dimension)}`, args.department_id ? pick("limit", "cursor") : { ...pick("code", "limit"), by: args.by_department === true ? "department" : undefined });
    if (name === "list_hearings" || name === "search_hearings") return withQuery(root + "/hearings" + (name === "search_hearings" ? "/search" : ""), { ...pick("fiscal_year", "agency", "status", "limit"), q: args.query });
    if (name === "get_hearing_topics") return withQuery(root + hearing + "/topics" + (args.topic_index !== undefined ? `/${enc(args.topic_index)}` : ""), { thread: args.include_thread === false ? 0 : undefined });
    if (name === "get_hearing_transcript") return withQuery(root + hearing + "/transcript", { from: args.from_seconds, to: args.to_seconds, limit: args.limit });
  }
  if (tool.provider === "officials") {
    const root = "https://officials.bettergov.ph/api/v1";
    if (name === "search_officials") return withQuery(root + "/persons", { q: args.query, ...pick("province", "limit") });
    if (name === "get_official") return `${root}/persons/${enc(args.id)}`;
    if (name === "get_contest" && args.id) return `${root}/contests/${enc(args.id)}`;
    if (name === "list_contests" || name === "get_contest") return withQuery(root + "/contests", { ...pick("year", "province", "town", "position", "district", "page", "limit"), ...(name === "get_contest" ? { page: 1, limit: 5 } : {}), candidates: name === "get_contest" || args.candidates === true ? 1 : undefined });
    if (name === "get_blocs") return withQuery(root + "/blocs", { ...pick("province", "region", "surname", "limit"), year: args.year ?? "2025", min: args.min_members, members: args.members === true ? 1 : undefined });
    if (name === "compare_elections") return withQuery(root + "/compare", pick("province", "town", "position", "district"));
    if (name === "get_national_results") return `${root}/national/${enc(args.year)}${args.province ? `/provinces/${enc(args.province)}` : ""}`;
    if (name === "get_coverage") return root + "/coverage";
  }
  if (tool.provider === "statistics") {
    const root = "https://statistics.bettergov.ph/api/v1";
    if (name === "search_datasets") return withQuery(root + "/datasets", args);
    if (name === "get_coverage") return root + "/coverage";
    if (name === "list_topics") return root + "/topics";
    if (name === "list_dimension_values") return withQuery(`${root}/datasets/${enc(args.id)}/values`, pick("dimension", "release", "q", "limit", "offset"));
    // Observation queries require POST. Link to the dataset page; selection/release stay in evidence.
    if (name === "query_dataset") return `https://statistics.bettergov.ph/datasets/${enc(args.id)}`;
    if (args.id) return `${root}/datasets/${enc(args.id)}`;
  }
  if (tool.provider === "asean") {
    const root = "https://asean.bettergov.ph/api/v1";
    if (name === "list_countries") return root + "/countries";
    const path = `${root}/datasets${args.dataset ? `/${enc(args.dataset)}` : ""}`;
    if (name === "query_dataset") return withQuery(path + "/rows", { ...Object.fromEntries(Object.entries((args.filters as Record<string, unknown>) ?? {}).map(([key, value]) => [`filter.${key}`, value])), ...pick("limit", "offset") });
    return path;
  }
  return SOURCES.find(source => source.id === tool.provider)!.url;
}
