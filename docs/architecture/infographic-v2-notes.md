# Infographic revision: domains, branding and consolidation

The current shareable poster is **How to build a national chatbot**, branded for Kuya J and BetterGov.ph.

## Deliverables

- [PNG](how-to-build-a-national-chatbot-v2.png): 2880 × 4540 pixels.
- [PDF](how-to-build-a-national-chatbot-v2.pdf): one page, selectable text and embedded fonts.
- [Self-contained HTML](how-to-build-a-national-chatbot-v2.html): editable text and layout, with fonts and brand assets embedded; no network requests needed.
- [Renderer](render-infographic.mjs): source of truth for the poster and its exports.
- [Verification](infographic-v2-verification.json): font loading, source labels, text fit and model-name checks.

The original poster remains available in the [first-edition brief](infographic-prompt.md).

## Requested changes

1. All ten source cards show domains instead of repository or project names. Statistics and classification codes intentionally share `statistics.bettergov.ph`; government services use the public `bettergov.ph` knowledge-base domain.
2. The poster uses **AI** for the answering model. No model name or provider appears in its visible text.
3. The original **BetterGov.ph logo** sits in the header alongside the existing Kuya J mascot.
4. A dedicated consolidation section shows law passages, public records and statistical tables merging into **one clear answer with references**. It explains that this happens when a question spans sources, after context filtering; conflicts and limitations stay visible.
5. All editorial text uses the actual **Inter Tight** font. The BetterGov wordmark uses the original PNG artwork, so it has no font-rendering dependency.
6. The title area prominently states **“Built by 1 person. Zero funding.”** This is the project owner's supplied attribution, not a claim of zero operating costs or sole authorship of underlying public records.

The architecture still distinguishes source-owned retrieval from the conversational layer: some sources provide RAG or semantic search, others provide structured APIs. APIs and MCP carry live lookups; `llms.txt` and documentation guide integration. No new central vector database is introduced.

## Asset provenance

- BetterGov logo: unchanged [horizontal primary PNG](../../public/brand/bettergov-horizontal-primary.png) from the [official logo repository](https://github.com/bettergovph/logo/blob/cd223d72a7339719b8d376b57bbb60c69bba6505/png/horizontal-primary.png). Replaced the SVG after the owner reported broken SVG rendering. The original SVG remains archived under `assets/` but is no longer used by the renderer.
- Kuya J mascot: the existing [WebP brand asset](../../public/brand/kuya-j-mascot.webp).
- Inter Tight variable font: [Google Fonts source](https://github.com/google/fonts/tree/main/ofl/intertight); distributed with [its SIL Open Font License](assets/InterTight-OFL.txt).
- Inter variable font from the prior SVG-based edition remains archived with [its SIL Open Font License](assets/Inter-OFL.txt); the current PNG logo does not need it.
- Icons: the project's existing `lucide-react` dependency.

Inter Tight is vendored under `assets/` and embedded in the HTML and PDF. The logo is an embedded PNG, and there is no fallback font in the export.

## Reproduce the exports

With the project's existing dependencies and Playwright Chromium available:

```sh
node docs/architecture/render-infographic.mjs
```

If Chromium is installed outside Playwright's expected location, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable path. The script writes the HTML, PNG, PDF and verification JSON next to itself. It waits for fonts, checks all ten source cards and text overflow, and rejects visible model/provider names before exporting.

The HTML uses a fixed poster canvas designed for export, not a responsive application screen. This revision changes documentation artifacts; it does not change the website's typography or model configuration.

## Image-generation edit and typography finish

The existing raster infographic was edited with the **built-in image generation tool**, in edit mode, using the original infographic, a BetterGov logo reference and an Inter Tight specimen. No CLI image-generation fallback was used. The [illustrated edit](how-to-build-a-national-chatbot-v2-illustrated.png) is retained as a design iteration.

The primary PNG/PDF/HTML exports above were then typeset with native HTML and CSS so exact domain spellings, original logo geometry and real Inter Tight typography are reproducible. These are the preferred versions for sharing.

### Exact image-edit prompt

```text
Edit the attached architecture infographic to implement this exact revision.
Image 1 is the EDIT TARGET, the complete existing infographic. Image 2 is a SUPPORTING INSERT: the authentic BetterGov.PH horizontal logo; preserve its shapes and wordmark accurately. Image 3 is a TYPOGRAPHY REFERENCE rendered with real Inter Tight. Use its sans-serif letter shapes, weight and proportions for ALL infographic headings, paragraphs, domain labels and badges. Remove handwritten and condensed-font styles. Keep the authentic BetterGov logo's original lettering unchanged.

Preserve the title verbatim: "How to build a national chatbot". Keep the existing Kuya J mascot and the clean navy/blue/teal/white palette. Rebalance spacing for readability as necessary.

REQUIRED CHANGES:
1. In the ten source cards, replace project names with these exact DOMAINS, no paths and no "https://":
Laws & court decisions -> juris.ph
Bills & authors -> bills.juris.ph
National budgets -> budget.bettergov.ph
Government services -> bettergov.ph
Officials & elections -> officials.bettergov.ph
PSA statistics -> statistics.bettergov.ph
Classification codes -> statistics.bettergov.ph
Flood control -> flood-control.bettergov.ph
Public works -> api.dpwh.bettergov.ph
Regional indicators -> asean.bettergov.ph
The two PSA cards intentionally share a domain. Do not invent domains or omit characters. Widen cards or use more rows if necessary. Keep domain strings legible. Replace the example route with "Legal question -> juris.ph".
2. Replace EVERY occurrence of "GLM" with "AI". Do not show a model name, model version, Nyolab, Z.ai, or another model provider. Keep "Jev" because it identifies the requested router. Example step 3 body: "AI chooses a permitted tool and its arguments. Code validates and calls the source API or MCP." Step 5 heading: "AI consolidates; Kuya J streams".
3. Place the supplied authentic BetterGov.PH LOGO prominently alongside the Kuya J branding. It must be a visible logo, not merely typed attribution. Keep the original logo lettering; all other typography must follow the Inter Tight reference.
4. Explicitly emphasize CONSOLIDATION across multiple sources. Add a clearly visible mini diagram near the bottom showing three inputs ("Laws", "Records", "Statistics") merging into "One clear answer with references". Add the sentence "Consolidate useful information from multiple sources into one answer." Preserve the idea that Jev filters first and conflicting information is flagged, not erased. The chatbot combines returned information for an answer, not into a new central database.
5. Add a PROMINENT celebratory badge near the title with this exact text: "Built by 1 person. Zero funding." Use an amber or yellow highlight and confident Inter Tight bold type. This is an owner-supplied claim about the project. Do not turn it into "zero cost", "no API costs" or an invented claim about who created public records.
6. Keep these essentials: months of collection/cleaning/indexing/updates in independent source projects; upstream RAG/semantic search or plain structured APIs; read-only APIs + MCP tools; llms.txt as documentation guidance, not a live data endpoint; the five-step question/routing/lookup/filtering/answer flow; references and optional Debug; a friendly fallback when no usable results remain; "No new central vector database required."
7. Use Inter Tight throughout as in the reference, with clear weight hierarchy, generous space and sharp text. Keep all source domains correctly spelled. Do not retain ANY project repository labels like legalhub, ai-reports, dynasty, floodlens-ph, BatasWatch in the source cards.

The finished poster should be a professional, highly readable beginner-friendly architecture infographic. Portrait format, highest supported resolution. No crop, no added government seals, no invented performance claims.
```
