# Using JEV as a chatbot router

## Engineering post draft

We built Kuya J as one conversational front door to Philippine public information. The knowledge systems behind it were built over months: collecting documents, cleaning datasets, indexing records, and exposing APIs and MCP tools.

Jev helps us decide which work should reach the answer model, and which retrieved information should become its context.

**Before tool selection:** one Jev request returns 17 typed judgments covering spam, prompt injection, supported scope, source relevance, the primary source, and the lookup type. Application code applies the thresholds. Blocked requests get a friendly redirect before any answer-model call or source lookup.

For accepted questions, the code selects the relevant source families. The answer AI then sees their permitted tools and chooses the concrete operation and arguments. Our adapters validate those arguments and execute read-only requests.

**After retrieval:** Jev screens the bounded source results for relevance and injected instructions, including citation titles and URLs. Useful dataset IDs, schemas and dimension codes can pass even before the final facts are retrieved. Code excludes rejected text from the answer model's context. The answer AI consolidates accepted information across sources, asks for more detail when necessary, and writes a referenced answer that the app streams to the user.

Here is a concrete example from a live PSA question:

- Full configured catalog: **52 tools, 32,950 serialized JSON characters**.
- Catalog selected for that question: **7 tools, 4,193 characters**.
- That is **87% less tool-definition text** in a model request carrying this selected catalog, compared with exposing the full catalog.

This is a measurement of one input component, **not an 87% reduction in total tokens or cost**. The real request used two Jev calls, two answer-model calls, and one source lookup. We did not run a billed, end-to-end A/B comparison with an all-tools baseline.

The engineering benefits come from three places: avoiding answer-model work on blocked requests, passing a smaller tool catalog on routed requests, and preventing rejected source text from expanding subsequent answer-model context. Code adds bounded results, duplicate-call suppression, and limits on the research loop.

Jev also has a cost. The useful comparison is the answer-model work avoided versus the screening overhead added, measured across completed answers, including retries and failures. Routing is probabilistic; uncertain routes can expose all ten source families to avoid excluding necessary sources.

The underlying projects retain their own retrieval systems: RAG, semantic search, structured tables, or exact-record APIs. Kuya J coordinates them without adding a new central vector database. Documentation and `llms.txt` guide integration; live answers come from API and MCP results.

Public knowledge, brought into one conversation.

Try it: https://chat.bettergov.ph

## What the Jev boxes make explicit

- **Lookup intent:** Jev recommends search, exact record, observations, comparison, catalog discovery, or no lookup. The answer AI receives this suggestion and still chooses the concrete tool and arguments.
- **Input screening:** the batched input request checks spam, prompt injection, jailbreak attempts, programming help and recipes. These are typed judgments; application code applies the blocking thresholds before answer-model and source calls.
- **Conversation-aware routing:** input screening uses the submitted conversation to resolve follow-ups. Independent relevance judgments allow more than one source family; code normally selects up to four, and exposes all ten when the primary-source confidence is low or no relevance score clears the threshold.
- **Batched judgments:** the input request asks 17 questions together. Each retrieval-screening batch asks three judgments per candidate result: relevance, injection and contradiction of the question's premise.
- **Discovery-aware filtering:** useful IDs, schemas and dimension codes can pass screening even when they do not yet answer the question. Citation titles and URLs are included in the screened content. Results that challenge the question's premise are retained and flagged unless rejected for injection.
- **Debug visibility:** streamed Debug events expose typed judgments, thresholds, routing decisions, screening results, durations and available Jev token usage. These events support inspection of both checkpoints.

Jev currently does not choose exact tool arguments, rewrite or compress passages, or perform a separate final-answer citation-entailment check. Tool execution, text bounds, citation registration and retry limits are owned by application code. The conflict judgment checks a result against the question's premise; it is not an exhaustive comparison among all sources.

## Export and measurement notes

The revised sharing format is a landscape flowchart with expanded Jev input and context boxes, short labels, solid process boxes, dotted system boundaries, and dotted block/retry paths. The input box explicitly names conversation awareness, batched screening, source routing and lookup intent. The context box names relevance/injection checks, citation metadata screening and useful discovery metadata. A Debug line makes the observable judgments and timings explicit.

This focused diagram omits the limited question-premise contradiction check and the separate no-accepted-results fallback branch. Both remain implemented in the app; this artwork change does not modify runtime behavior. The premise check is described in the implementation notes above without implying comprehensive fact-checking or cross-source contradiction detection.

- [Landscape flowchart PNG](jev-chat-flow-landscape.png)
- [Landscape PDF](jev-chat-flow-landscape.pdf)
- [Editable landscape SVG](jev-chat-flow-landscape.svg)
- [Landscape HTML](jev-chat-flow-landscape.html)
- [Landscape Mermaid source](jev-chat-flow-landscape.mmd)

Re-render it with `node docs/architecture/render-jev-landscape.mjs`. It uses the same implementation facts as the detailed poster below, keeping the cost mechanisms to three short labels. The SVG is self-contained with the original logos and embedded Inter Tight font; the PNG export is 4800 × 2980 pixels.

The earlier detailed portrait version and its measurements remain available:

- [Full-resolution infographic](jev-efficient-chat-pipeline.png)
- [PDF with selectable text](jev-efficient-chat-pipeline.pdf)
- [Self-contained, editable HTML](jev-efficient-chat-pipeline.html)
- [Mermaid source](jev-efficient-chat-pipeline.mmd)
- [Recorded sizes and export verification](jev-efficient-chat-pipeline-verification.json)

Re-render with `node --import tsx docs/architecture/render-jev-engineering.mjs` from the repository root. This loads the actual tool catalog and formats it exactly as the answer adapter does. It counts serialized JSON characters and UTF-8 bytes; it does not substitute an approximate tokenizer or claim those counts equal billable tokens. The full-catalog baseline is counterfactual: all configured tool definitions, not an additional billed completion.

The example source selection (`statistics`, `services`) and request counts come from the production PSA citation check on 2026-09-22, retained locally in the ignored `outputs/public-citations-production.json` artifact. Question: “Find the PSA dataset ‘Palay and Corn: Volume of Production’ and share its dataset page.” This example had one accepted result and no filtered results; it does not demonstrate measured context-filter savings. Filtering is shown as an implemented mechanism whose production impact should be measured separately.

Input blocking was separately checked using 36 synthetic conversations, with 22 expected blocks and 14 expected allows; all matched in that sample. Production smoke checks confirmed zero answer-model and source calls for blocked programming, recipe and jailbreak requests. These are bounded regression checks, not a comprehensive estimate of error rates.

Implementation references: `lib/server/typesafe.ts`, `lib/server/policy.ts`, `lib/server/tools.ts`, `lib/server/llm.ts`, and `app/api/chat/route.ts`. Jev filters whole candidate tool results after code has bounded/abbreviated their text; it is not a token compressor. Accepted context accumulates through the bounded loop. The current adapter does not retain answer-provider usage in Debug, so end-to-end token savings cannot be established from the existing trace alone.

The diagram includes the input-block branch missing from the supplied draft, preserves the follow-up lookup loop, and distinguishes Jev's judgments from code-owned actions. It does not claim that adding Jev removes all hallucinations, makes routing infallible, or always reduces latency. Screened greetings/clarifications can bypass retrieval; the main diagram focuses on substantive civic questions.

The exports use the existing original BetterGov PNG logo, Kuya J mascot, and the real vendored Inter Tight font. They are typeset directly with vector connectors, then exported by Chromium, keeping text and measurements exact. The earlier architecture infographics remain unchanged.
