# Kuya J redesign

## Compact sidebar — 22 September 2026

The sidebar now prioritizes session conversations. Removed the promotional “Public data. Clear answers.” card, decorative taglines, workspace heading and duplicate chat navigation item. The compact header and new-conversation/source controls sit above an independently scrolling conversation list; a smaller About/BetterGov/policy footer stays below it. The navbar's mobile toggle has a 44 × 44px target and 24px icon. Header and footer padding respect device safe areas.

On a 390 × 640 viewport, the branding header changed from 137px to 60px and the footer from 306px to 104px, leaving 368px dedicated to conversation history. A layout check created 14 mocked conversations and verified scrolling, selecting the oldest conversation, footer separation and no horizontal overflow at 390 × 640, 320 × 480, 390 × 500, 768 × 500 and 1440 × 900. Screenshots and geometry are in ignored `outputs/sidebar-compact/`.

TypeScript, ESLint, the Cloudflare production build and its credential scan passed. All 17 existing chat, keyboard, policy and PWA browser checks passed locally. Mobile navigation and policy/draft preservation checks also passed on the public site. Changes are isolated on `fix/compact-sidebar`, based on SEO release `23b737d`; the prior SEO Worker version is `48b3fd46-9ea1-443e-82c3-deb2b6f09304`.

Published Worker version: `f7fc1e3e-22fd-4ee1-a7f8-f305f25d4eac` at `https://chat.bettergov.ph`. A final live check confirmed the 44px toggle, compact section dimensions and visible policy links.

## Original redesign

Sources: existing Kuya J implementation, and user-provided Photo 1.jpg / Photo 2.jpg (2026-09-21). Screenshots are visual references, not evidence of feature availability or government endorsement. BetterGov skill guidance informs accessibility and source clarity; the user’s explicit knowledge-base-first citation preference remains in force.

Screen outcomes: the home screen helps residents choose a research topic or ask a question. The chat screen keeps the answer, numbered knowledge-base citations, and optional research trace together. The sources sheet explains the ten providers. The install sheet explains platform-specific installation. The offline screen explains the need to reconnect without suggesting offline AI capability.

The six cards are research entry points, not official agency transactions. `service-records.json` records their provenance and unknowns. Its six missing official-handoff warnings are expected: destinations are selected from actual research results, not invented on generic topic cards. Original government documents remain available through knowledge-base pages and trace provenance per the user's preference. No agency seals, endorsements, transactions, uploads or identity checks were copied from the references.

Mascot editing used built-in image generation, with the original `public/brand/kuya-j-logo.jpg` as the edit target. Final asset: `public/brand/kuya-j-mascot.png`, 1254×1254, with verified alpha ranging from 0 to 255. WebP and icon derivatives were resized from that result, preserving the original supplied JPG.

Final image prompt:

> Use case: background-extraction. Edit target: the supplied Kuya J logo. Create a clean production PNG of ONLY the existing mascot emblem: smiling black-haired Filipino male giving a thumbs-up in a navy polo in front of the circular Philippine-flag badge. Remove ALL the 'Kuya J' lettering to the right and remove all off-white background outside the mascot and circular badge. Outside the cutout must be genuinely transparent alpha, not a checkerboard drawing. Preserve the original mascot's face, hair, pose, hands, clothing, navy circular border, Philippine sun/flag colors, and illustrated style as closely as possible. Keep the WHITE parts INSIDE the flag badge opaque. No added text, no new features, no shadow on the background, no white rectangle. Center the intact mascot emblem on a square canvas, complete hair and bottom circle visible, with a small even transparent margin. Output a high quality 1024x1024 transparent PNG suited to app branding and icons.

## Verification — 2026-09-21

Deployed to https://chat.bettergov.ph on BetterGov's Cloudflare account, Worker `kuya-j`. Final deployed version: `c4522a29-0aa7-45a0-bccc-d0f7d40caf38`.

- Production Workers build, TypeScript and targeted ESLint passed. All 38 unit tests and 10 browser tests passed.
- Browser checks cover 320, 375, 768, 1024 and 1440px reflow, keyboard focus, chat/history/copy/retry/cancel, registered citations, debug events, offline/reconnect, manifest/icon dimensions and transparency, cache exclusions, and install controls.
- Chromium's actual manifest and installability checks reported no errors on the public HTTPS domain. Automated WCAG-tagged axe checks found no violations on home, the source dialog, and a real mobile answer. No browser JavaScript errors were reported.
- A real Data Privacy Act question completed on the deployed site: Jev `jev-1.13.0` selected Juris, `search_republic_acts` and `get_republic_act` ran through `https://juris.ph/mcp`, Jev screened their context, and the answer cited the Juris knowledge-base record. Live operational events arrived before the answer. The model explicitly noted the existing long-document excerpt limit; this smoke test does not establish completeness of legal answers.
- The Workers HTTP adapter now rejects redirects using `manual` mode, since Workers does not implement `redirect: error`. A regression test confirms redirected requests never forward authorization. The asset configuration keeps `/offline.html` from redirecting, so it can be served from the offline cache.
- At 390×844, the compact mobile chat header is 69px including the community notice, down from 143px. The composer is 103px, down from 130px. The scrollable conversation area grew from 571px to 672px (about 18%). Answer text is 14px/1.6; the input stays at 16px to avoid iOS focus zoom.
- Static and server build output was scanned for known credentials; no embedded API keys remained. Deployed provider bindings were verified as `secret_text`. A local Workers check verified the shared capacity limiter returns HTTP 429 after its 35-request budget.

Evidence: `outputs/cloudflare-verification.json`, `outputs/cloudflare-data-privacy-debug.json`, `outputs/cloudflare-desktop.png`, `outputs/cloudflare-mobile.png`, `outputs/cloudflare-mobile-chat.png`, and `outputs/mobile-density-before.json`. Browser answer fixtures are distinguished from the separate live research checks. The six service-record validation warnings reflect the intentional generic topic entry points described above; there were no validation errors.

Physical iOS/Android installation and screen-reader behavior require device testing; passing automated checks is not a WCAG conformance claim. AI answers need internet access, and conversations remain in tab memory only.

## Streaming follow-up — 2026-09-21

Version `bd2533d1-9306-4a95-b1a6-40b5a38909d0` adds provider-backed answer streaming after accepted Jev-screened evidence. It preserves the compact mobile design and knowledge-base citations, assembles tool fragments before execution, excludes hidden reasoning, and falls back to complete responses for providers without streaming. Partial output survives interruption with an incomplete notice; scrolling up suspends automatic following.

All 44 unit tests, 11 browser tests against the public domain, production build/typecheck and targeted ESLint passed. Tests verify that text arrives before the provider finishes, source screening precedes publication, failed/filtered retrieval cannot stream an unsupported draft, fragmented UTF-8/tool arguments work, unsupported streaming gets only a bounded fallback, and cancellation/errors preserve the appropriate UI state.

A real mobile browser question about the Data Privacy Act produced seven incremental text updates while generation was active, starting around 20.3 seconds; completion followed around 29.4 seconds. The final citation linked to the Juris knowledge-base page. Jev routing, context screening, MCP requests, stream transport and first-text timing were visible in the debug trace. There were no browser JavaScript errors. These timings are observations from one request, not latency guarantees.

Evidence: `outputs/streaming-public-verification.json`, `outputs/streaming-public-partial.png`, `outputs/streaming-public-complete.png`, and a separate live VM check in `outputs/streaming-vm.json`.

## Sources, attribution and policies — 21 September 2026

Published Worker version `8322e029-2cc8-45f8-9876-b7e658be1113` at `https://chat.bettergov.ph`.

- Inline registered citations, cards and the source directory now navigate to domain roots; card titles still identify records. Exact retrieval/document URLs remain in the evidence registry and debug trace.
- BetterGov.ph attribution uses its existing primary emblem from `bettergov-v2/public/logos/svg/BetterGov_Emblem-Primary.svg`, copied unchanged to `public/brand/bettergov-emblem.svg`. It appears in the sidebar, About panel and policy pages.
- Added `/privacy` and `/terms`, with compact links in the sidebar and composer. Policy links from chat open a new tab to preserve session memory. The composer terms notice remains visible on short mobile screens.
- Privacy wording distinguishes no server-stored chat history from transient AI processing, provider retention, operational metadata, browser assets/preferences and contact correspondence. The liability release is qualified by applicable law and expressly preserves non-waivable rights. Legal review for the operator's circumstances remains advisable; these terms are not a guarantee of immunity.
- Validation: typecheck, targeted ESLint, all 44 unit tests and a Cloudflare production build passed. All 14 browser tests passed on both the secure VM preview and the public Cloudflare deployment. Tests include root-only URLs with paths/queries/fragments, debug provenance, attribution, policy access without losing a draft, mobile reflow, accessibility, progressive streaming and PWA behavior. Public policy pages return 200 with the correct titles and no horizontal overflow or browser errors.
- Screenshots and verification: `outputs/policies-public-{sidebar,about,privacy,terms}.png` and `outputs/policies-public-verification.json`. Browser test logs for this run are `/tmp/kuya-j-policies-public-browser.log`. No live paid model call was needed for these presentation and policy changes.

## Nyolab provider trial — 21 September 2026

Git was initialized with the existing deployed app on `main` at `3e15fd5`, tagged `zai-stable-2026-09-21`. Provider work is isolated on `feat/nyolab-provider`; no remote push or merge was performed. The original Z.ai environment is backed up locally in ignored `.env.zai.rollback` with mode 0600, and the legacy key remains intact.

- Added independent `ZAI_*` and `NYOLAB_*` profiles, selected by `LLM_PROVIDER`. Missing credentials fail explicitly, without cross-provider key fallback. The CLI `npm run provider:use -- zai|nyolab` updates the local and Cloudflare selectors; publishing remains an explicit deployment step.
- Debug events identify the answering provider, model and endpoint. Both credentials are redacted. The Cloudflare bundle scan passed, and both named keys plus the legacy key were confirmed as `secret_text` bindings through the account API. No keys are tracked by Git.
- Nyolab supports GLM-5.3-Flash streaming and tool calling with the existing GLM parameters. Jev routing/filtering and knowledge-base-first retrieval remain active. The privacy policy now discloses Nyolab routing and upstream processing.
- Initial VM grounded comparison: Nyolab first answer 19.6 s / completion 24.7 s / 39 updates; Z.ai first answer 20.2 s / completion 27.8 s / 7 updates. Both fetched the full Data Privacy Act through Juris. Different lookup sequences and answer lengths, plus a slower Nyolab greeting, mean this is not evidence of a consistent latency advantage.
- Initial public trial version `b2145885-220e-4225-af2d-54311dd8584a` encountered an empty, cleanly terminated Nyolab stream after a successful tool lookup. Added one same-provider JSON retry for that specific case. Unit tests verify tool-call recovery, bounded retries, and no retry for partial or broken streams. Evidence of the observed failure remains in ignored `outputs/nyolab-public-empty-stream.json`.
- Final public version `00cfca0f-0f77-4002-ab84-5373d3d6acd4` is live on `https://chat.bettergov.ph` with Nyolab selected. A real public Data Privacy Act question completed with first answer at 14.7 s, total 18.8 s, 48 streamed answer updates, Juris MCP full-text retrieval, three Jev context screenings, no warnings and no errors. That final run did not need the empty-stream retry. Full verification is in ignored `outputs/nyolab-public-verification.json`.
- Validation: 52 unit tests, typecheck, targeted ESLint, build/credential scan, and all 14 browser tests against the final public deployment passed. The VM service was restarted with the same implementation and Nyolab profile. Full implementation rollback is available via `main` / `zai-stable-2026-09-21`; provider-only rollback uses the selector followed by redeployment.

## In-app browser keyboard — 21 September 2026

Published Worker version `2bb2f726-82ad-410f-9204-1a8f4615e067` at `https://chat.bettergov.ph`, with changes isolated on `fix/in-app-keyboard` from `feat/nyolab-provider`. The selected provider remains Nyolab.

- The chat shell now follows the visual viewport's height and vertical offset instead of relying on `100dvh`. The header compacts while the keyboard is detected, multiline input is limited to the available height, and answer scrolling stays inside the message container. Optional VirtualKeyboard geometry covers hosts exposing an overlapping keyboard; window resizing remains the fallback. Pinch zoom and policy-page document scrolling are preserved.
- Typecheck, targeted ESLint, all 52 unit tests, and the Cloudflare build/credential scan passed. All 18 browser checks passed on both the VM preview and the public deployment. Four keyboard regressions cover visual-only shrink/pan, typing and sending, closing while focus remains, multiline input, rotation, overlay geometry, zoom, and browsers without VisualViewport. The other checks cover chat, streaming, source links, accessibility, policies and PWA behavior.
- At a simulated 390×430 visible viewport, the composer spans y=343–393 and remains above the simulated keyboard. The header and notice occupy about 71px; the scrollable workspace retains about 243px. A separate mobile Chromium check with its unmodified viewport confirms the composer fits at 390×844. No JavaScript errors were observed in the visual verification.
- Evidence: ignored `outputs/keyboard-vm-verification.json`, `outputs/keyboard-public-verification.json`, and `outputs/keyboard-{vm,public}-mobile-{open,closed}.png`. The open-keyboard images show the available area only; no physical keyboard or Messenger/Facebook device was available. Physical in-app-browser verification remains necessary, particularly where hosts expose neither viewport changes nor keyboard geometry.

Implementation references: [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport), [Chrome keyboard viewport behavior](https://developer.chrome.com/blog/viewport-resize-behavior), and [MDN VirtualKeyboard bounds](https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard/boundingRect).

## Friendly fallback — 22 September 2026

Published Worker version `4d000589-7bd7-4e37-a378-3259c5dc96a3` on branch `fix/friendly-fallback`. The fallback for required lookups with zero accepted results now uses a short, friendly English/Filipino message. Its technical reason and lookup warnings remain in the opt-in Debug trace; supported answers still show partial-coverage warnings. The fallback is written by Kuya J, separate from Jev's spam/injection decisions. Jev questions, routing thresholds and model/provider settings are unchanged.

Validation: all 52 unit tests, typecheck, targeted ESLint, and Cloudflare build/credential scan passed. Six chat/streaming browser checks passed on the public deployment. Unit fixtures confirm failed, skipped and filtered retrieval cannot publish unsupported factual drafts, and fallback diagnostics remain available in Debug without repeated warnings in the ordinary reply. The public request boundary returned the expected 400 for an empty conversation. No live paid model request was needed. The VM service was restarted with the updated build.
