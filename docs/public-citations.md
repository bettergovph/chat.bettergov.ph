# Public citation pages

Public citations must open a page a person can use, rather than a REST response or an MCP/POST endpoint. Both numbered references and source cards follow the same server-registered URL. Cards display the source root as a compact label; the label does not replace the actual link target.

The order is:

1. Prefer a public page returned with the retrieved record, such as `links.page` or `url`, on the exact registered knowledge-base origin.
2. Use a verified route mapping when the result supplies an API URL or the record identifiers needed for a known public route.
3. For a nonempty result without a public page, cite the main source website. Empty results do not gain a homepage citation.

Original documents, API URLs and exact query scope remain in evidence/provenance and Debug. A public browser page may not reproduce the same filters, release or observation selection. Never reconstruct an unknown page by blindly removing `/api`, and never invent bill or case IDs from names or numbers.

## Confirmed routes

| Source | Public target | Contract checked |
| --- | --- | --- |
| PSA datasets | `/datasets/:id` for metadata, dimension values and observations; search hits keep individual dataset pages. | `../psa/app/datasets/[id]/page.tsx`, `../psa/lib/public-api.mjs` (`links.page` and observation `dataset.id`). [Live example](https://statistics.bettergov.ph/datasets/9b78cb1fa95ae59f78d4). |
| PSA catalogs | `/search`, `/topics`, `/about`, `/classification` for the corresponding API operations. | Public pages in `../psa/app/`; [classification browser](https://statistics.bettergov.ph/classification). |
| Juris | Returned `/republic-act/:id` and `/case/:id` pages. | Existing API page URLs; original Lawphil/PDF links remain provenance. |
| Bills | Returned bill and author pages, preserving their path/query. | Existing BatasWatch API page URLs; nested versions inherit the enclosing page. |
| Budget | `/gaa`, `/gaa/:year`, `/d/:department`, program/object views, `/2027/overview`, `/2027/d/:department`, `/hearings/:video`. | `../ai-reports/src/App.tsx`; no unverified hierarchy route is manufactured. |
| Officials | Returned pages, or `/person/:province_slug/:id` when all identifiers and a person name are in the retrieved record. | `../dynasty/src/main.ts`, `src/util.ts`, `worker/index.ts` person fields. An ID alone does not establish a province. |
| DPWH | `https://transparency.bettergov.ph/dpwh`, a returned project page, or `/dpwh/projects/:id` using a retrieved `contractId` or a specific project API URL. | BetterGov navigation, live API `contractId` fields, and [public portal](https://transparency.bettergov.ph/). Main-site fallback uses this portal, since the API host has no public homepage. |
| ASEAN | Returned pages, `/countries` for the country catalog and `/data` for the dataset catalog/query browser. | `../asean/app/countries/page.tsx`, `app/data/page.tsx`. No fictional `/datasets/:id` route. |
| BetterGov services | Returned BetterGov pages or a directory page based on its retrieved slug. | Existing directory route contract. |
| Flood control | Returned public page when available; otherwise `https://flood-control.bettergov.ph/`. | The current application has no verified per-project page route. |

`lib/citations.ts` centralizes public route resolution. `lib/server/evidence-links.ts` prefers record pages and avoids registering a competing API citation. The browser uses the same resolver for older API URLs retained in an open conversation. `lib/server/provider-contracts.ts` continues to retain exact lookup-equivalent URLs; it is not the final public navigation policy.

Tests cover multiple PSA search hits, metadata/values/POST queries, explicit-page precedence, main-site fallback, empty results, ambiguous shared provenance, existing bill/Juris records, and inline/card links during streaming. URL validation rejects credentials, cross-origin lookalikes, protocol-relative links and unsupported machine/download paths.
