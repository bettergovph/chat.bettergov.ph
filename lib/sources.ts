export const SOURCES = [
  { id: "services", name: "BetterGov search", url: "https://bettergov.ph", description: "Government services, agencies and public information." },
  { id: "budget", name: "National budget", url: "https://budget.bettergov.ph/docs", description: "Appropriations, budget proposals and spending programs." },
  { id: "juris", name: "Laws & jurisprudence", url: "https://juris.ph/api", description: "Republic Acts and Philippine court decisions." },
  { id: "bills", name: "Bills in Congress", url: "https://bills.juris.ph/api", description: "House and Senate bills, authors and legislative status." },
  { id: "officials", name: "Officials & elections", url: "https://officials.bettergov.ph", description: "Election records, candidates and historical results." },
  { id: "dpwh", name: "DPWH transparency", url: "https://api.dpwh.bettergov.ph", description: "Public works projects and infrastructure records." },
  { id: "flood", name: "Flood control projects", url: "https://flood-control.bettergov.ph", description: "Flood mitigation projects, contractors and recorded budgets." },
  { id: "statistics", name: "Philippine statistics", url: "https://statistics.bettergov.ph/api", description: "PSA datasets with units, releases and source provenance." },
  { id: "classification", name: "PSA classifications", url: "https://statistics.bettergov.ph/api#classification", description: "Geographic, industry and other classification codes." },
  { id: "asean", name: "ASEAN in Data", url: "https://asean.bettergov.ph/api", description: "Economic indicators and regional comparisons." },
] as const;
export type SourceId = typeof SOURCES[number]["id"];
export type RetrievalReference = { provider: SourceId; tool: string; transport: "MCP" | "REST" | "Meilisearch"; endpoint: string };
export type Citation = { id: number; title: string; url: string; provider: SourceId; retrievedAt: string; retrievals?: RetrievalReference[]; originalUrls?: string[] };
