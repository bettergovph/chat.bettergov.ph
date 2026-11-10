# Infographic generation brief

Original edition: [how-to-build-a-national-chatbot.png](how-to-build-a-national-chatbot.png), 1024 × 1536 pixels. Superseded by the [branded Inter Tight edition](infographic-v2-notes.md); preserved here with its original prompt. Created on 22 September 2026 using the built-in image generation tool, followed by the correction pass below. No CLI fallback or image upscaling was used. Original generated files remain in Codex's generated-images directory; the selected final image is copied into this repository.

Generated with the built-in image generation tool. Brand reference: `../../public/brand/kuya-j-mascot.png`. The infographic is an educational overview; `../../ARCHITECTURE.md` documents the precise implementation and its limits.

```text
Use case: infographic-diagram.
Create a polished, highly detailed but beginner-friendly editorial architecture infographic for a Philippine civic technology project. This is a shareable educational poster, not a website screenshot. Portrait 2:3 composition, ideally 2048 by 3072 or higher resolution, crisp large typography, generous spacing, organized panels, restrained navy and royal blue on warm white, teal for source systems, amber for checks, small Philippine red/yellow accents. Clean line icons and clear directional arrows. No pseudo-code, no decorative illegible text.

The supplied image is a BRAND REFERENCE / SUPPORTING INSERT: the existing Kuya J mascot. Use this mascot once in the title area, small, preserving its appearance. Do not redesign it, do not turn the full poster into a mascot illustration. Use text attribution "Kuya J / BetterGov.ph". No government seal or official-government endorsement.

Title, exactly: "How to build a national chatbot"
Subtitle, exactly: "One conversation. Many carefully built knowledge systems."
Small introductory line: "The Kuya J approach, built on months of work across Philippine civic projects."

Make the hierarchy immediately understandable. The key architectural fact is that the chatbot reuses retrieval already provided by independent source systems: some have RAG or semantic search, others are plain structured APIs. Kuya J does not need its own central document-ingestion pipeline or vector database. Do not imply that RAG or data preparation disappeared, that all sources use RAG, or that a central vector database exists.

Use these sections, in an elegant layout with clear numbered flow:

SECTION A — a large foundation panel taking roughly the upper third:
Heading: "Start with useful source systems"
Subtitle: "Months of collection, cleaning, indexing and updates live in these projects."
A grid of TEN small domain cards, every card present once, organized 5 by 2 or 2 by 5 as readability permits:
"Laws & court decisions" / "Juris / legalhub"
"Bills & authors" / "BatasWatch"
"National budgets" / "ai-reports"
"Government services" / "BetterGov search"
"Officials & elections" / "dynasty"
"PSA statistics" / "PSA platform"
"Classification codes" / "PSA classifications"
"Flood control" / "floodlens-ph"
"Public works" / "DPWH transparency"
"Regional indicators" / "ASEAN in Data"
Under the grid, show two complementary mechanisms side by side:
"RAG / semantic search: find relevant document passages"
"Structured APIs: retrieve exact records, tables and totals"
Then a prominent shared interface strip: "Read-only APIs + MCP tools"
A smaller side note with a DASHED connector, distinct from solid live-request arrows:
"llms.txt + docs: explain how to use each source"
"Discovery guidance, not a live data endpoint."

SECTION B — the main runtime flow below the source foundation:
Heading: "Connect them through one chatbot"
Use five large numbered cards in a clearly ordered top-to-bottom or wrapping flow. All step numbers must appear exactly once. Solid arrows must show the actual order. Step 3 connects UP to the source interface strip and BACK DOWN with distinct labels "lookup" and "results". The arrows must not imply that Jev queries databases itself.
1. "Ask Kuya J"
   "A resident asks in English, Filipino or Taglish."
   Example speech bubble: "What does the Data Privacy Act say?"
2. "Jev routes and screens"
   "Checks spam and prompt injection."
   "Selects relevant source families and a lookup type."
   Tiny route example: "Legal question -> Juris"
3. "The app makes the lookup"
   "GLM chooses a permitted tool and its arguments."
   "Code validates and calls the source API or MCP."
4. "Jev checks the results"
   "Keep useful context. Drop suspicious instructions."
   "Flag conflicting information."
5. "GLM writes; Kuya J streams"
   "Explain the returned information in plain language."
   "Show knowledge-base references and optional Debug traces."
   Small off-ramp: "No usable results? Give a friendly retry message."

SECTION C — bottom learning/summary panel:
Prominent statement: "Retrieval lives with the sources. The chatbot connects the pieces."
Three small role labels:
"Source projects: own the knowledge"
"Jev: makes routing and filtering judgments"
"GLM: chooses tools and writes answers"
A short glossary at a readable size:
"API = a doorway to structured data"
"MCP = a shared format for AI tools"
"RAG = retrieve information before generating an answer"
"llms.txt = a guide to a site's useful content"
Footer: "Kuya J / BetterGov.ph • Community-built Philippine civic assistant"
Footer small: "Architecture snapshot • September 2026"

Exactness constraints: spell Kuya J, Jev, Juris, BatasWatch, GLM, MCP and llms.txt correctly. Every word should be legible and spelled correctly. Preserve the title exactly. Prioritize a coherent infographic with readable text over filling every pixel. Do not include API keys, invented facts, invented endpoints, performance promises, claim-level verification guarantees, user databases, web search as a runtime step, or chatbot training/fine-tuning. Keep the distinction between the existing upstream source layer and the new conversational layer visually obvious.
```

## Correction pass

```text
Edit this exact infographic as a careful typography and connector correction. Preserve the entire layout, all ten source cards, the existing mascot, title, colors, icons and all other text. Improve these specific items ONLY:
1. Replace the top-right handwritten slogan "Better Information A Brighter Philippines" with three readable lines: "No new central" / "vector database" / "required".
2. Under "Read-only APIs + MCP tools", replace "A unified, permissioned interface to the source systems" with "Configured access to independent source systems".
3. Correct the green "lookup" connector: it should point ONLY UPWARD from runtime step 3 into the blue API/MCP strip. Remove its extra downward arrowhead at the lower end. The separate blue "results" connector should point ONLY DOWNWARD from the API/MCP strip back to step 3. Preserve these two labels and keep connectors clear of text.
4. In the right side of the blue "Connect them through one chatbot" header, replace the three italic lines with "Questions in." / "Source lookups." / "Answers out."
5. In the lower Jev role card, preserve the heading "Jev: makes routing and filtering judgments", but replace its body with "Scores relevance, flags risks and helps filter context."
6. Replace the lower-right handwritten words "People Information Stronger Together" with "Reusable sources." / "Clear responsibilities."
Maintain the exact title "How to build a national chatbot". Keep all other text and content unchanged and correctly spelled. Make the corrected type sharp and readable. Output the whole corrected portrait infographic, at the highest available resolution, preferably 2048 by 3072 if supported. Do not crop the poster.
```

Validation: visually reviewed source count, title, provider roles, flow direction, documentation-vs-runtime distinction and readable labels. The companion Mermaid overview and worked example were parsed and rendered with Mermaid 12.0.0. Their editable `.mmd` sources and generated `.svg` exports are stored alongside this image. This is documentation work; it does not change the deployed application.
