# Kuya J

A Philippine civic research chatbot built with Next.js, React and TypeScript. Answers use GLM-5.3-Flash through selectable Nyolab or direct Z.ai profiles and are grounded in BetterGov and Juris records. TypeSafe Jev screens requests, chooses source families and lookup types, and filters retrieved evidence.

Public app: [chat.bettergov.ph](https://chat.bettergov.ph). Code is available under the [MIT License](LICENSE); see [third-party and branding notices](THIRD_PARTY_NOTICES.md), [contribution guide](CONTRIBUTING.md) and [security guidance](SECURITY.md).

Read [How to build a national chatbot](ARCHITECTURE.md) for the beginner-friendly architecture, source responsibilities, request flow and integration guide. The [architecture infographic](docs/architecture/how-to-build-a-national-chatbot-v2.png) presents the same pattern as a shareable poster, with [PDF](docs/architecture/how-to-build-a-national-chatbot-v2.pdf) and [editable HTML](docs/architecture/how-to-build-a-national-chatbot-v2.html) exports.

## Search and social sharing

The home, About, Privacy and Terms pages have canonical URLs, individual descriptions, Open Graph metadata and large Twitter/X cards. `/robots.txt` advertises `/sitemap.xml`, which lists only public pages. Organization, website and application structured data describe Kuya J without inventing ratings or a search URL. The offline fallback is marked `noindex`; conversations have no public archive.

The blue social poster is [`public/social/kuya-j-og-v1.png`](public/social/kuya-j-og-v1.png), 1200 × 630 pixels. Its [source and generation notes](docs/seo/README.md) explain how to rebuild it. BetterGov branding uses unchanged PNGs from [bettergovph/logo](https://github.com/bettergovph/logo), served locally; the app and the latest architecture poster no longer depend on SVG wordmark rendering. The dedicated [`/about`](https://chat.bettergov.ph/about) page provides crawlable source descriptions and links without requiring JavaScript.

## Cloudflare deployment

The Next.js app runs as one Worker through `@opennextjs/cloudflare`, including its uncached streaming endpoint. No response-cache database is required. The checked-in `wrangler.jsonc` is a portable template and contains no account or zone identifiers.

```bash
npm ci
cp .env.example .env.local
cp wrangler.jsonc wrangler.local.jsonc
# Configure your own provider/search keys in .env.local.
# Customize Worker name, self-reference binding, APP_ORIGIN and rate-limit namespace
# in wrangler.local.jsonc; use a unique namespace in your Cloudflare account.
# Supply CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in your environment.
npm run cf:deploy
```

The ignored `wrangler.local.jsonc` takes precedence when present. Set `CLOUDFLARE_CONFIG` to select a different file. A new custom domain also requires `CLOUDFLARE_ZONE_ID`; the deploy script verifies existing hostname ownership before preserving or attaching a domain. With no `APP_ORIGIN`, keep `workers_dev=true` to deploy on your own workers.dev subdomain, then configure your exact public origin. Disable `workers_dev` and preview URLs when using only a custom domain. Set `NEXT_PUBLIC_SITE_URL` before building so canonical/social URLs identify your deployment.

The build removes OpenNext's copied local environment module and scans the bundle for configured credentials. The deploy script uploads available provider/search keys as Worker secrets through a temporary mode-0600 file that is deleted afterward. Each provider retains its own credentials. Use a least-privilege Cloudflare token for your account; no deployment runs automatically from pull requests.

To inspect the Workers runtime locally after building:

```bash
npm run cf:build
npm run cf:preview -- --port 8797 --inspector-port 9237
```

Local Workers preview needs the selected provider key, TypeSafe key and search key in an ignored `.dev.vars` file to make live research calls. The usual `next dev` flow reads `.env.local` directly. Public deployment uses Cloudflare secrets instead. The static asset configuration preserves `/offline.html` without redirecting it; `/sw.js` is served with `no-store`.

The deployment uses [OpenNext's Workers adapter](https://opennext.js.org/cloudflare/get-started) and Cloudflare's [Workers Domains API](https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/update/). HTTP lookups use manual redirects and reject non-success responses, keeping provider credentials from being forwarded elsewhere; this works in both Node and Workers.

## Local development

Use Node.js 22 or later and npm. Provide your own provider and search credentials:

```bash
npm ci
cp .env.example .env.local
# Fill in the server-only keys, then:
npm run dev
```

The development server binds to loopback on port 3000. For access from another machine, configure your own authenticated HTTPS proxy and `APP_ORIGIN`; never expose the development server publicly. API keys must never use the `NEXT_PUBLIC_` prefix.

Chat history stays in the current browser tab and disappears on reload. No database is required.

## Configuration

See [SECURITY.md](SECURITY.md) before exposing an anonymous public endpoint. Provider spending limits and Cloudflare abuse controls are operator responsibilities.

| Variable | Purpose |
| --- | --- |
| `CHAT_ENABLED` | Set `false` to stop new chats before screening or generation |
| `NEXT_PUBLIC_SITE_URL` | Canonical public origin for SEO; set at build time on forks |
| `APP_ORIGIN` | Exact trusted HTTPS origin when running behind a reverse proxy; no forwarded-header trust |
| `LLM_PROVIDER` | `nyolab`, `zai`, or `custom`; chooses the primary profile |
| `LLM_FALLBACK_PROVIDER` | `zai` or `nyolab`; independently configured backup. Unset/`off` disables it. Current deployment uses Nyolab → Z.ai. |
| `NYOLAB_API_KEY` | Nyolab router token (server only) |
| `NYOLAB_BASE_URL` | Defaults to `https://llm.nyolab.ai/api/public/v1` |
| `NYOLAB_MODEL` | Defaults to `glm-5.3-flash`; whitespace is trimmed |
| `ZAI_API_KEY` | Direct Z.ai token (server only) |
| `ZAI_BASE_URL` | Defaults to `https://api.z.ai/api/paas/v4` |
| `ZAI_MODEL` | Defaults to `glm-5.3-flash`; whitespace is trimmed |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | Legacy/custom profile only; ignored when `LLM_PROVIDER` explicitly selects `nyolab` or `zai` |
| `LLM_REASONING_EFFORT` | GLM-5.3 reasoning level: `low` (default), `high`, or `max`; optional `ZAI_REASONING_EFFORT` / `NYOLAB_REASONING_EFFORT` override per profile |
| `LLM_STREAMING` | `auto` (default) streams eligible answer text; `off` forces complete responses |
| `TYPESAFE_API_KEY` | Required for screening and routing |
| `TYPESAFE_MODEL` | Defaults to `jev-latest` |
| `MEILI_API_KEY` | BetterGov search token |
| `MEILI_URL` | Defaults to `https://search2.bettergov.ph` |
| `MEILI_INDEX` | Defaults to `bettergov`; the supplied token supports search but not index enumeration |

Grounded turns require several thousand tokens and multiple model calls. Provider quota failures are surfaced explicitly in chat; the app does not fabricate a fallback answer.

### Switch providers and roll back

Each provider has a separate key and endpoint configuration. Switch the primary profile with:

```bash
npm run provider:use -- nyolab   # or: zai
```

The selector updates `LLM_PROVIDER` in `.env.local` and the selected Worker configuration. It preserves keys and does not deploy. Restart your local app, or rebuild and deploy after reviewing the selected configuration. Set `LLM_FALLBACK_PROVIDER=off` to disable automatic failover. Keep the previous deployed Worker version available for rollback.

### Automatic provider failover

Nyolab remains the preferred answering provider; Z.ai is the configured backup. Availability routing is deterministic application code and does not add a Jev request. Jev still controls input screening, source routing and result screening.

- **Eligible failures:** HTTP 404 (including Nyolab's missing-model backend), 408, 429 and 5xx; initial connection failures; empty or malformed provider responses; and an interrupted stream before answer text has been exposed.
- **Latency bound:** while a backup can accept an attempt and the turn has no exposed answer text, the primary gets 25 seconds to deliver answer text or a complete buffered/tool response. After visible text starts, streaming may continue within the existing 65-second provider bound. The backup, and a primary with no available backup, have a 65-second bound. The whole chat turn still has its 225-second deadline.
- **One switch per turn:** the same instructions, selected tool schemas, conversation and accepted evidence go to the backup. Completed lookups are retained, not re-executed by the failover mechanism. Remaining rounds and citation repair stay on that provider.
- **Two-minute cooldown:** eligible failures open an in-memory circuit for that provider/endpoint/model. New turns skip it during cooldown; one real request probes recovery afterward. A successful probe restores primary preference. This state is local to each process/Cloudflare isolate, not globally shared or a guarantee that every edge skips the same provider. There are no background health-check completions or stored conversations.
- **No switch for:** user cancellation, overall request timeout, Jev rejections/outages, source lookup failures, HTTP 400/401/403/422, provider safety refusals, token-limit failures or invalid tool calls. Once any answer text has been exposed in the turn, providers are not switched. An incomplete answer stays marked incomplete.
- **Debug:** actual provider requests, HTTP status/failure reason, cooldown skips, fallback destination and timing are streamed. `modelRequests` counts logical rounds; `providerRequests` counts actual completion HTTP attempts (including same-provider transport retries); `providerFallbacks` counts switches. Credentials, raw upstream errors and evidence text are excluded.

Both providers can still fail, so failover is bounded and never replaces a failed research turn with an answer from unverified memory. See `tests/provider-failover.test.ts` and the route integration test. The privacy page discloses that failover can send the same request context to the backup.

For a live comparison with the same public question, run these separately (each makes paid AI calls):

```bash
node --env-file=.env.local --import tsx scripts/benchmark-provider.ts zai
node --env-file=.env.local --import tsx scripts/benchmark-provider.ts nyolab
```

The benchmark reports first visible answer time, total time, streamed update count, tool calls, Jev phases and citations in ignored `outputs/provider-*-grounded.json` files. A provider comparison is a point-in-time sample, not a latency guarantee. The debug trace in the app also includes the selected provider, model and completion endpoint, without credentials.

Initial VM comparison on 21 September 2026, using the full Data Privacy Act research flow:

| Provider | First answer text | Complete answer | Streamed updates | Juris MCP lookups |
| --- | --- | --- | --- | --- |
| Direct Z.ai | 20.2 s | 27.8 s | 7 | 2 |
| Nyolab | 19.6 s | 24.7 s | 39 | 3 |

Both retrieved the full Republic Act through Juris and passed Jev screening. The models chose different lookup sequences and answer lengths. A separate simple greeting was slower on Nyolab (6.9 s total versus 2.0 s), so the trial does not establish a consistent speed advantage.

The Z.ai adapter uses `tool_choice: auto`, as required by its [function-calling API](https://docs.z.ai/guides/capabilities/function-calling). The Nyolab GLM-5.3 profile preserves that contract, including low reasoning effort and thinking configuration. Retrieval is requested in the prompt and enforced by the route's evidence checks. Historical reasoning is cleared; hidden reasoning never goes to the browser. Other custom model profiles retain generic OpenAI-compatible parameters. See [Z.ai's model documentation](https://docs.z.ai/guides/vlm/glm-5.3-flash).

## Request flow

1. Validate the request, origin, message roles, body size and process/isolate capacity limits.
2. Ask Jev independent questions in one batch: spam, injection, programming assistance, recipes, jailbreaks, relevant source families, primary source, and lookup kind. Interpret follow-ups using conversation context. Block excluded requests before any generation or source lookup, with a friendly redirect to civic topics.
3. Let the answering model fill arguments for the allowed, read-only source tools. There is no arbitrary URL fetch, write tool or credential access available to it.
4. Validate arguments, bound tool calls and response sizes, and execute at most two lookups concurrently.
5. Batch Jev judgments over retrieved context: relevance, instructions embedded in evidence, and contradictions. Drop suspicious or irrelevant results; retain and label conflicting evidence.
6. Answer from accepted evidence and attach numbered source links from the server-owned evidence registry. After Jev accepts source evidence, stream generated answer text over SSE, followed by the final answer and citation list. Greetings can stream after input screening without retrieval.

The model adapter follows [Z.ai's streaming protocol](https://docs.z.ai/guides/capabilities/streaming). It ignores hidden reasoning, assembles tool-call fragments before execution, and withholds unsupported factual drafts when no source evidence has been accepted. If the model requests more tools, any answer preamble is cleared while research continues. Citation repair can replace a draft before the final answer. Display updates are actual provider output, coalesced to at most one snapshot per 75ms; there is no simulated typing delay.

The browser accepts `answer` SSE events containing the current text and registered sources, alongside `status`, opt-in `trace`, and terminal `done`/`error` events. Snapshots allow incomplete Markdown references to resolve to knowledge-base links as generation progresses. `done` remains authoritative and contains the final normalized text. Clients that only consume `done` remain supported. Interrupted or stopped responses retain their partial text with a clear incomplete notice and are excluded from subsequent model context. Scrolling up suspends automatic following of incoming text.

When a provider returns JSON instead of SSE, the app displays its complete response. An explicit HTTP 400/422 rejection of streaming gets one non-streaming retry before any answer text is sent. Nyolab has also returned a clean terminal stream with no text or tool call during a live continuation; that exact empty case gets one JSON retry on Nyolab, with the transport retry identified in Debug. Remaining eligible failures can switch to the configured backup under the failover policy above. `LLM_STREAMING=off` handles providers that cannot negotiate streaming reliably.

Screening fails closed if TypeSafe is unavailable or returns missing/malformed judgments. Programming help, recipes/cooking instructions and AI jailbreak attempts or methods are outside the supported scope. Government IT jobs, course enrollment, food permits and food-safety laws remain supported. See the [input guardrail policy and live evaluation](docs/input-guardrails.md), or run `npm run test:guardrails:live` with a configured TypeSafe key to repeat the synthetic evaluation.

Broad civic questions are welcome: country introductions, geography and communities, history and identity, government, rights, participation and public issues. The shared scope in `lib/server/civic-scope.ts` informs both Jev and the answering model. The existing lookup-kind Choice includes `overview`, so this adds no classifier call. Overview routes include BetterGov discovery, Jev's primary and other relevant sources, capped at four. If the model skips retrieval, the app discards its unsupported draft and asks once more for a lookup within the existing research budget. Debug identifies that retry. The expanded live guardrail evaluation checks both acceptance and routing; greetings and exact numeric queries retain their own lookup kinds.

When a lookup is required but no results are accepted, Kuya J returns a friendly, application-written fallback in English or Filipino. It does not publish an unsupported answer. The technical reason (`no_accepted_evidence`) and lookup warnings are available in Debug; partial-answer coverage warnings remain visible with supported answers. This fallback is distinct from Jev's input-screening decisions. Classifier judgments are probabilistic; the thresholds in `lib/server/policy.ts` are product settings, not a security guarantee. Source data is always untrusted, tool access is bounded in code, and upstream keys never enter the model prompt.

For an overview without usable results, that fallback welcomes the question and invites a choice of civic topics. Source coverage limits do not make the question prohibited, and do not authorize factual answers from memory.

## Debugging a response

Turn on **Debug** in the header before submitting a question. Each new answer gets a live **Research trace** with expandable JSON details and **Copy JSON**. It shows Jev's actual model/version, routing choices, source relevance and spam/injection/programming/recipes/jailbreak probabilities, thresholds, context keep/drop/conflict decisions, model-request rounds, API/MCP tool names, effective arguments, endpoints, durations, failures, truncation notices and citation provenance. Blocked requests show their screening reason, no selected sources and zero model/tool requests. Trace events are delivered before the final answer and remain with that answer in the current tab, including after cancellation or errors. Earlier answers cannot be retroactively traced.

Streaming traces additionally show whether the provider opened a stream or returned a complete response, plus the time to first answer text for that generation round. This excludes the earlier retrieval/screening time; event elapsed time is still measured from the beginning of the whole request.

For API clients, send `"debug": true` to `POST /api/chat`. The existing SSE stream includes additional `{"type":"trace", ...}` events; clients that omit the flag keep the ordinary stream. Traces are built from observed operations, not model-written descriptions. They exclude hidden reasoning, system prompts, raw document bodies, authentication headers and credentials. Tool arguments contain the relevant search terms; copying a trace copies those terms too.

The evidence registry prefers matching public knowledge-base pages: BatasWatch bill/author pages, Juris law/case pages, PSA `/datasets/:id` pages, and other returned public pages. Known API routes are mapped to verified public equivalents, including budget pages, the PSA classification browser, and the BetterGov DPWH transparency portal. When no public page can be identified, a nonempty result cites the source's main website. Original documents and precise lookup URLs remain provenance in `originalUrls` and Debug. No bill or case page is guessed from a title or number. Empty searches do not produce homepage citations.

Inline citation links and source cards open the public page, while card URL labels stay compact by displaying the root URL. Raw URL labels are shortened too. The source directory opens main websites; DPWH uses `https://transparency.bettergov.ph/`, not the API host. Public URLs are registered server-side, so streamed answers, final answers and copied Markdown use the same targets. The browser also maps legacy API citations already in an open conversation. Unknown API endpoints fall back to the source website; unregistered answer links remain non-clickable. General web search is not configured among this app's tools. See [public citation mappings](docs/public-citations.md) for route references and limitations.

## Privacy, terms and attribution

The sidebar and About panel attribute Kuya J to BetterGov.ph using its existing emblem from the BetterGov v2 brand assets. `/privacy` and `/terms` are standalone, responsive policy pages. Chat links open policies in a new tab to preserve the in-memory conversation. The composer includes a mistakes notice, linked terms acceptance and a privacy link, including on short mobile screens.

The privacy statement is specifically **no server-stored chat history**, not a blanket promise of no processing or third-party retention. It describes Nyolab routing/upstream processing when selected, direct Z.ai and TypeSafe processing, search terms sent to knowledge bases, Cloudflare operational logs, the optional seven-day sidebar preference cookie, offline asset caching, debug copies, contact correspondence and privacy requests. Z.ai's API retention terms are not represented as Nyolab's own policy. No chat database, analytics tracker or chat-response cache was added. The contact address is BetterGov's existing `volunteers@bettergov.ph`.

The terms include AI accuracy and professional-advice limitations, responsible use, an as-is disclaimer, and a limitation of liability and release **to the fullest extent permitted by law**. Mandatory rights and liability that cannot be waived remain intact. These provisions do not guarantee immunity or enforceability; a Philippine lawyer should review them for the operator's circumstances. Review basis: the [NPC transparency guidance](https://privacy.gov.ph/the-right-to-be-informed/), [Civil Code Articles 1171 and 1306](https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html), [Z.ai API processing terms](https://docs.z.ai/legal-agreement/privacy-policy#data-processing-addendum-for-api-services), [TypeSafe privacy policy](https://typesafe.ai/legal/privacy-policy), and [Cloudflare log retention documentation](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).

## Sources

| Provider | Interface |
| --- | --- |
| BetterGov services | Meilisearch `POST /multi-search`, index `bettergov` |
| National budget | `https://budget.bettergov.ph/mcp` |
| Republic Acts and jurisprudence | `https://juris.ph/mcp` |
| Senate and House bills | `https://bills.juris.ph/mcp` |
| Officials and elections | `https://officials.bettergov.ph/mcp` |
| DPWH transparency | `https://api.dpwh.bettergov.ph/projects?search=…` |
| Flood control projects | `https://flood-control.bettergov.ph/api/flood-control-projects?q=…` |
| PSA statistics | `https://statistics.bettergov.ph/mcp` |
| PSA classifications | `https://statistics.bettergov.ph/api/classification` |
| ASEAN economic indicators | `https://asean.bettergov.ph/mcp` |

The MCP tool catalog is a checked-in snapshot of the providers' `tools/list` responses, inspected on 2026-09-21. The live calls use those public tools. Review provider changes before updating `lib/server/mcp-catalog.json`.

Adapters were also checked against the seven existing provider projects on this VM. See [provider integration notes](docs/provider-integration-notes.md) for the implementation references, supported filters and coverage limits. Flood search is a bounded geocoded sample without pagination; classification records retain their snapshot versions; general search includes only published service records alongside agency and website records.

Sources are community mirrors of public records. Their vintages, coverage and data quality vary. Prompts distinguish bills from laws, proposals from appropriations and spending, historical election winners from current officials, and sample records from totals. PSA numeric answers require exact observation queries; dataset titles alone are insufficient. Legal summaries may be incomplete, so exact provisions require full text.

## Verification

```bash
npm run typecheck
npm test
npm run build
node --env-file=.env.local --import tsx scripts/check-sources.ts
```

The source check makes one small live lookup per adapter, with bounded concurrency. It does not spend LLM tokens.

Browser tests use mocked answer streams and real UI interactions, including source panels, mobile navigation, new conversations, errors and cancellation:

```bash
npx playwright install chromium
TEST_BASE_URL=http://127.0.0.1:3000 npm run test:browser
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` only if using a separately installed Chromium. Browser tests default to loopback; set `TEST_BASE_URL` for another test instance. Test fixtures are not served as live answers.

The app allows four concurrent requests and 35 starts per minute per process/isolate. Cloudflare additionally shares a 35-chat-requests-per-minute capacity budget across isolates within each edge location, before starting inference. These [Cloudflare rate limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) are eventually consistent and local to an edge location, not a global billing cap. The public app currently has no accounts or durable conversation storage.

## Mobile design and PWA

The interface takes visual inspiration from the supplied eGovAI screenshots: pale blue surfaces, centered mascot identity, a rounded topic sheet, and a bottom composer. It retains the existing providers, English/Filipino response selection, citations, chat history, cancellation/retry, answer copying, and Jev/tool debug traces. It is an independent community app. Screenshot features such as uploads, identity checks and voice input are not implemented or advertised.

The transparent, text-free mascot is in `public/brand/kuya-j-mascot.png`; the UI uses its smaller WebP derivative. Home-screen, Apple and maskable icons are in `public/icons/`. The original uploaded JPEG is preserved. The mascot was edited using the built-in image generation tool; the prompt and design verification notes are in `redesign-evidence/README.md`.

`app/manifest.ts` provides the standalone manifest. `public/sw.js` precaches only the offline screen and branding. It bypasses POST requests, source/API traffic, and cross-origin requests; no chat, trace, prompt or answer is stored in Cache Storage. Navigation is network-first with a clear offline fallback. Worker updates do not force-reload an active chat. Bump the worker's cache version when changing precached assets. Answers require connectivity, and session history remains in memory only.

The install control uses the browser install prompt when available and provides iOS/browser-menu guidance otherwise. Safe-area padding, dynamic viewport height, resizable keyboard behavior and reduced-motion settings are supported. No notifications or background synchronization are requested.

On mobile, answers use 14px text with a 1.6 line height, compact cards, and a smaller header. During a conversation the mascot moves into the top bar. The editable input stays at 16px to avoid iOS focus zoom. Zoom and text scaling remain available.

The sidebar keeps a compact logo, new-conversation/source controls and attribution footer around an independently scrolling conversation list. Decorative taglines, the duplicate chat navigation item and the promotional card are removed. The mobile navbar toggle has a 44px touch target and 24px icon. Privacy, terms, About and BetterGov attribution remain available even on short screens.

The chat shell tracks `visualViewport` height and offset, since embedded browsers can shrink or pan the visible area for the keyboard without resizing `100dvh`. Where supplied, VirtualKeyboard geometry also handles an overlapping keyboard; older browsers fall back to window resizing. While typing with a keyboard open, the header compacts and multiline input height is bounded by the available space. Answer auto-scrolling affects only the message container. Pinch zoom retains native behavior, and policy pages retain document scrolling. Browser regression tests simulate these viewport changes; physical Messenger/Facebook verification is still needed, especially for hosts that expose no keyboard geometry or resize events.


## Publishing the source

Use a reviewed release branch with clean history. Run `npm run check:public`, then `node scripts/check-public-source.mjs --ref=YOUR_RELEASE_BRANCH`. Earlier development history may contain private configuration even after the latest files are cleaned. Publish only the reviewed branch, not all local branches/tags. A source export created with `git archive YOUR_RELEASE_BRANCH` excludes ignored local secrets and Git history.
