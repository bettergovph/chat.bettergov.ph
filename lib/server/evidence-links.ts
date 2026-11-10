import { knowledgePageUrl, publicCitationUrl, sourceSiteUrl } from "../citations.ts";
import { SOURCES } from "../sources.ts";
import { isRecord } from "./http.ts";
import { isSafeCitationUrl } from "./policy.ts";
import type { ToolResult } from "./tools.ts";

export type EvidenceLink = { title: string; url: string; originalUrls?: string[] };
const sourceFields = ["source_url", "officialRecordUrl", "officialProfileUrl", "official_url", "officialUrl", "sourceUrl", "source", "pdf_url", "pdfUrl", "website", "url"];

// Empty search containers and transport metadata must not manufacture a citation.
function hasContent(value: unknown, depth = 0): boolean {
  if (depth > 8 || value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.slice(0, 30).some(child => hasContent(child, depth + 1));
  if (isRecord(value)) return Object.entries(value).some(([key, child]) => !["meta", "pagination", "links", "coverage"].includes(key) && hasContent(child, depth + 1));
  return typeof value === "string" ? Boolean(value.trim()) : true;
}

export function evidenceLinks(result: ToolResult): EvidenceLink[] {
  if (!hasContent(result.data)) return [];
  const found = new Map<string, EvidenceLink>();
  const unassignedOriginals: string[] = [];
  const add = (title: string, url: string) => {
    let link = found.get(url);
    if (!link && found.size < 8) { link = { title, url }; found.set(url, link); }
    return link;
  };
  const originals = (link: EvidenceLink, urls: string[]) => {
    const additional = urls.filter(url => url !== link.url);
    if (additional.length) link.originalUrls = [...new Set([...(link.originalUrls ?? []), ...additional])].slice(0, 16);
  };
  const site = sourceSiteUrl(result.provider);
  const page = (value: unknown) => {
    const url = knowledgePageUrl(value, result.provider);
    return url && url !== site ? url : undefined;
  };
  let visited = 0;
  const visit = (value: unknown, depth = 0, parentTitle = result.title, parent?: EvidenceLink) => {
    if (depth > 8 || ++visited > 1500) return;
    if (Array.isArray(value)) { value.slice(0, 30).forEach(item => visit(item, depth + 1, parentTitle, parent)); return; }
    if (!isRecord(value)) return;
    // get_bill wraps its canonical URL around discovery/measure records and versions.
    const record = isRecord(value.measure) ? value.measure : isRecord(value.discovery) ? value.discovery : value;
    const title = String(record.title ?? record.shortTitle ?? record.longTitle ?? record.case_title ?? record.service ?? record.displayName ?? record.display_name ?? record.canonicalName ?? record.name ?? record.office_name ?? record.office ?? record.description ?? parentTitle).slice(0, 180);
    const urls = [...sourceFields.map(key => value[key]), isRecord(value.links) ? value.links.api : undefined]
      .flatMap(value => {
        if (typeof value !== "string" || value.startsWith("//") || value.includes("\\")) return [];
        try { const url = value.startsWith("/") ? new URL(value, site).href : value; return isSafeCitationUrl(url) ? [url] : []; } catch { return []; }
      });
    const directory = result.provider === "services" && value.type === "directory_item" && typeof value.slug === "string" && /^[a-z0-9_-]+$/i.test(value.slug)
      ? `https://bettergov.ph/directory/${value.slug}` : undefined;
    // PSA query responses include dataset {id,title} without links; search/metadata
    // responses provide links.page. IDs come from retrieved records, never a title guess.
    const dataset = result.provider === "statistics" && typeof value.id === "string" && /^[A-Za-z0-9_-]+$/.test(value.id) && typeof value.title === "string"
      ? `${site}datasets/${value.id}` : undefined;
    const official = result.provider === "officials" && typeof value.display_name === "string" && typeof value.id === "string" && /^[A-Za-z0-9_-]+$/.test(value.id) && typeof value.province_slug === "string" && /^[a-z0-9_-]+$/.test(value.province_slug)
      ? `${site}person/${value.province_slug}/${value.id}` : undefined;
    const project = result.provider === "dpwh" && typeof value.contractId === "string" && /^[A-Za-z0-9_-]+$/.test(value.contractId)
      ? `${site}dpwh/projects/${value.contractId}` : undefined;
    const canonical = [isRecord(value.links) ? value.links.page : undefined, value.page_url, value.pageUrl, directory, dataset, official, project, value.url, ...urls]
      .map(page).find(Boolean);
    const link = canonical ? add(title, canonical) : parent;
    if (link) originals(link, urls);
    else unassignedOriginals.push(...urls);
    Object.values(value).forEach(child => {
      if (child && typeof child === "object") visit(child, depth + 1, title, link);
    });
  };
  visit(result.data);
  // Prefer returned record pages. Only when none exist, use a verified public
  // equivalent of the lookup, or the main website. Keep API URLs as provenance.
  if (!found.size && hasContent(result.data)) {
    const link = add(result.title, publicCitationUrl(result) ?? site);
    if (link) originals(link, unassignedOriginals);
  }
  if (found.size === 1) {
    const link = [...found.values()][0];
    const origin = new URL(SOURCES.find(source => source.id === result.provider)!.url).origin;
    const lookupUrl = isSafeCitationUrl(result.url) && new URL(result.url).origin === origin && !["", "/api", "/docs", "/mcp"].includes(new URL(result.url).pathname.replace(/\/$/, "")) ? [result.url] : [];
    originals(link, [...unassignedOriginals, ...lookupUrl]);
  }
  return [...found.values()];
}
