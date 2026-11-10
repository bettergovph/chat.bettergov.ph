# Jev input guardrails

Kuya J is a Philippine civic-information assistant. Jev screens each submitted conversation before the answering provider or any knowledge source is called. This is a server-side decision; it also applies to direct `POST /api/chat` clients and does not depend on enabling Debug.

## Scope

Broad questions about the Philippines are supported civic requests. Users can ask about people and communities, geography, administrative divisions, history and national identity, how government works, rights and responsibilities, public participation, the economy, social conditions and public services. They do not need a year, document number or exact location before starting. English, Filipino, Taglish and contextual follow-ups share the same scope. The classifier and answering model use the shared policy in [`civic-scope.ts`](../lib/server/civic-scope.ts).

This is permission to research a topic, not a claim that every topic is covered by the source catalog. Unrelated general-purpose tasks remain outside the civic scope, and the exclusions below still apply to mixed requests.

| Judgment | Redirect these requests | Keep these civic questions in scope |
| --- | --- | --- |
| `programming` | Code generation, debugging, SQL, pseudocode, programming explanations, API integration and implementation tutorials. | Government IT jobs, course enrollment, technology policy, software procurement and public records. |
| `recipes` | Recipes, ingredient quantities, culinary substitutions, cooking/baking steps and drink preparation. | Food-business permits, food-safety laws, food-price statistics, culinary training enrollment and feeding-program records. |
| `jailbreak` | Attempts to bypass an AI's rules; actionable jailbreak methods, prompts and examples, including requests framed as education or testing. | Cybersecurity policy, applicable laws, reporting an attack, and public architecture questions that do not request bypass methods. |

Jev judges the requested assistance, not the presence of a word. Mixed requests remain blocked if they also request excluded help. Government work, fiction, translation or role-play is not an exemption. The jailbreak criteria cover unrestricted personas, fake system/developer/tool roles, fake administrator authority, prompt/credential extraction, fabricated citations and encoded or split bypass instructions.

Programming and recipe checks use history to interpret the latest query. A user can switch from a refused recipe or coding request to a civic question. The existing injection check also inspects earlier user messages for active attempts to override the assistant. A quoted attack being reported is distinguished from an instruction to obey it.

## Enforcement and Debug

All 17 input judgments run in the existing single TypeSafe request. Civic overview routing adds an option to the existing lookup-kind question, not another judgment or network round trip. Exact questions and true/false criteria live in [`inputQuestions()`](../lib/server/typesafe.ts); thresholds and precedence live in [`decideInput()`](../lib/server/policy.ts).

1. Validate every requested judgment. Missing, non-finite, out-of-range or incorrectly typed answers stop screening.
2. Check injection (`>= 0.92`), jailbreak (`>= 0.70`), spam (`>= 0.97`), programming (`>= 0.70`), then recipes (`>= 0.70`). The first block supplies the reason. A Noul is the probability that its criterion is true, not generic confidence.
3. If blocked, set selected sources to `[]` and lookup kind to `none`. Return an application-written English or Filipino redirect. No draft, citation, source call or answer-model request is produced.
4. If allowed, continue the existing retrieval, evidence screening and streamed-answer flow. The trusted answer instructions repeat the scope restrictions as an additional layer.

The generic English response is:

> Sorry, I can’t help with that request. I can help you explore the Philippines—its communities, history, government, rights, public services and data. What would you like to explore?

Debug emits `Jev screening: blocked (<reason>)`, the validated probabilities, thresholds and final request counts. Operational details remain opt-in; the ordinary answer does not describe classifiers or scores. A civic source relevance score cannot override an input block. TypeSafe errors still return the existing temporary screening-unavailable message instead of continuing unscreened.

## Civic overview routing

`lookup_kind=overview` covers broad introductions and civic explanations. `primary=none` explicitly excludes broad civic questions; Jev selects a useful starting source even when no source can answer the entire question. Each source-relevance question asks whether the source can help with **part** of the question or useful discovery metadata. Coverage guidance distinguishes directory resources, population/economic datasets, geographic classifications and legal records without claiming they contain facts they do not.

For an allowed overview, code includes BetterGov search, Jev's valid primary source and its other relevant families, capped at four distinct sources. It does not request all sources just because the question is broad. Other lookup kinds retain their existing uncertainty fallback. A precise census count still uses `observations`; greetings use `none`.

The answering model is told to start with a manageable civic angle and one or two lookups. If it returns a draft without calling a tool, the route discards the draft and requests a lookup once more within the existing research budget. That retry appears in Debug as `overview_lookup_skipped`; it does not add a Jev request. Real results still pass evidence screening and citation registration. If no usable information remains, the app welcomes the civic question and offers topic choices instead of treating it as an excluded request. It never streams the unsupported draft or fills missing facts from memory.

## Reproducible evaluation

Run `npm run test:guardrails:live` with a server `TYPESAFE_API_KEY` in the environment or ignored `.env.local`. This is an opt-in, billed TypeSafe evaluation; normal `npm test` uses mocked providers and makes no live calls. The live runner sends only synthetic conversations from [`tests/fixtures/input-guardrails.ts`](../tests/fixtures/input-guardrails.ts), with no expected labels included in the inference state. It exercises the production `assessInput()` implementation with concurrency two and no retries, answer-model requests or knowledge-source lookups.

The runner writes an ignored `outputs/jev-input-guardrails-<timestamp>.json` artifact containing the exact cases, shared civic scope, questions, thresholds, configured/resolved model, typed answers, usage, timings and expected-versus-actual decisions. Overview cases also assert the expected lookup kind and required source families, not just whether a request is allowed. These artifacts are synthetic evaluation records, not stored production chat histories. A provider error fails the case. Use `-- --only=case-id,other-id` to rerun selected cases.

Live result on **2026-09-22**, configured alias `jev-latest`, resolved model **`jev-1.13.0`**:

| Cases | Expected | Result |
| --- | --- | --- |
| 7 programming requests | Block | 7 blocked |
| 5 recipe/cooking requests | Block | 5 blocked |
| 10 jailbreak requests | Block | 10 blocked |
| 14 civic questions, including adjacent topics and recovery after a refused topic | Allow | 14 allowed |

All **36/36** decisions matched: zero false allows, false blocks or provider errors in this sample. Programming scores ranged from `0.97–0.99`, recipe scores from `0.97–0.99`, and jailbreak scores from `0.95–0.99` on their respective positive cases. Among allowed civic cases, the largest of these three scores was at most `0.06`. The selected `0.70` boundary separates this sample with margin. Median end-to-end classifier latency was about **292 ms**; this is a point-in-time measurement, not a latency guarantee.

Automated tests additionally verify threshold boundaries, malformed/missing judgments, decision precedence, friendly redirects, Debug events and **zero model/tool calls on blocked requests**. Existing tests still exercise successful grounded answers, streaming, citations, context filtering and upstream failures.

This small, hand-labeled set is a regression baseline, not comprehensive adversarial coverage or a calibrated estimate of production error rates. Classifiers can make mistakes, and the `jev-latest` alias can change. Repeat the evaluation when changing questions, thresholds or models, and add synthetic cases for observed misses. The implementation follows TypeSafe's [typed guardrail pattern](https://docs.typesafe.ai/cookbooks/llm_guardrails); the application owns the final action.

Expanded live evaluation on **23 September 2026**: **49/49** cases passed, with zero false allows, false blocks, routing failures or provider errors. This includes the original 36 cases, eight broad civic questions/follow-ups, a greeting, an exact census question and three mixed excluded requests. The same small-sample limitations apply. Regression tests also cover mismatched primary/relevance judgments, one bounded lookup retry, no streaming of unsupported drafts, missing/filtered source results and guardrail precedence over overview routing.
