import { SOURCES, type SourceId } from "./sources.ts";

type CitationLink = { url: string; provider?: SourceId; originalUrls?: string[] };

/** Compact source labels and the source directory display the website root. */
export function sourceRootUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) return;
    return parsed.origin + "/";
  } catch { return; }
}

export function sourceSiteUrl(provider: SourceId): string {
  // The DPWH API has no public homepage; its browser is on the transparency portal.
  return provider === "dpwh" ? "https://transparency.bettergov.ph/" : sourceRootUrl(SOURCES.find(source => source.id === provider)!.url)!;
}

/** Verified public route equivalents. Never turn an arbitrary API path into a guessed page. */
export function knowledgePageUrl(value: unknown, provider: SourceId): string | undefined {
  if (typeof value !== "string" || value.includes("\\")) return;
  const site = sourceSiteUrl(provider);
  try {
    if (value.startsWith("//")) return;
    const url = new URL(value, value.startsWith("/") ? site : undefined);
    const origin = new URL(SOURCES.find(source => source.id === provider)!.url).origin;
    if (url.protocol !== "https:" || url.username || url.password || ![origin, new URL(site).origin].includes(url.origin)) return;
    const path = url.pathname.replace(/\/$/, "");
    if (provider === "statistics" || provider === "classification") {
      const dataset = path.match(/^\/api\/v1\/datasets\/([A-Za-z0-9_-]+)(?:\/(?:values|query))?$/);
      if (dataset) return `${url.origin}/datasets/${dataset[1]}`;
      if (/^\/api\/classification(?:\/|$)/.test(path)) return `${url.origin}/classification`;
      if (path === "/api/v1/topics") return `${url.origin}/topics`;
      if (path === "/api/v1/coverage") return `${url.origin}/about`;
      if (path === "/api/v1/datasets") {
        const search = new URL("/search", site);
        for (const key of ["q", "topic", "domain"]) if (url.searchParams.has(key)) search.searchParams.set(key, url.searchParams.get(key)!);
        return search.href;
      }
    }
    if (provider === "budget") {
      const year = path.match(/^\/api\/v1\/gaa\/years\/(\d{4})(?:\/|$)/);
      if (year) return `${url.origin}/gaa/${year[1]}`;
      const department = path.match(/^\/api\/v1\/gaa\/departments\/([A-Za-z0-9_-]+)(?:\/(programs|objects))?$/);
      if (department) return `${url.origin}/d/${department[1]}${department[2] ? "/" + department[2] : ""}`;
      if (path === "/api/v1/gaa" || path === "/api/v1/gaa/departments") return `${url.origin}/gaa`;
      const nep = path.match(/^\/api\/v1\/nep\/2027(?:\/departments\/([A-Za-z0-9_-]+))?(?:\/|$)/);
      if (nep) return `${url.origin}/2027/${nep[1] ? "d/" + nep[1] : "overview"}`;
      const hearing = path.match(/^\/api\/v1\/hearings\/([A-Za-z0-9_-]+)(?:\/|$)/);
      if (hearing && hearing[1] !== "search") return `${url.origin}/hearings/${hearing[1]}`;
      if (path === "/api/v1/hearings" || path === "/api/v1/hearings/search") return `${url.origin}/hearings`;
    }
    if (provider === "dpwh" && url.origin === origin) {
      const project = path.match(/^\/projects\/([A-Za-z0-9_-]+)$/);
      if (project) return `${site}dpwh/projects/${project[1]}`;
      if (path === "/projects") return `${site}dpwh`;
      return;
    }
    if (provider === "asean") {
      if (path === "/api/v1/countries") return `${url.origin}/countries`;
      if (/^\/api\/v1\/datasets(?:\/|$)/.test(path)) return `${url.origin}/data`;
    }
    // Provider-returned public pages can retain their actual path and query. Machine
    // endpoints, documentation and downloads are provenance, never navigation targets.
    if (/^\/(?:api|mcp|docs|\.well-known)(?:\/|$)/i.test(path) || /\.(?:json|csv|xml|pdf|txt|parquet|zip|gz)$/i.test(path)) return;
    return url.href;
  } catch { return; }
}

/** Handles current citations and older API URLs still present in an open conversation. */
export function publicCitationUrl(citation: CitationLink): string | undefined {
  if (!sourceRootUrl(citation.url)) return;
  const provider = citation.provider ?? SOURCES.find(source => new URL(source.url).origin === new URL(citation.url).origin)?.id;
  if (provider) return knowledgePageUrl(citation.url, provider) ?? sourceSiteUrl(provider);
  return /^\/(?:api|mcp)(?:\/|$)/i.test(new URL(citation.url).pathname) ? sourceRootUrl(citation.url) : citation.url;
}

/** Only registered evidence links are clickable; originals resolve to their record page. */
export function resolveCitationUrl(href: string | undefined, citations: CitationLink[]): string | undefined {
  if (!href) return;
  const direct = citations.find(citation => citation.url === href || publicCitationUrl(citation) === href);
  if (direct) return publicCitationUrl(direct);
  const matches = citations.filter(citation => citation.originalUrls?.includes(href));
  // Shared source PDFs/homepages must not redirect to an arbitrary record.
  if (matches.length === 1) return publicCitationUrl(matches[0]);
}
