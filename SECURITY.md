# Security

Report vulnerabilities privately using [GitHub's private vulnerability reporting](https://github.com/bettergovph/chat.bettergov.ph/security/advisories/new), when enabled, or email volunteers@bettergov.ph with a minimal reproduction. Do not include credentials or real conversations in public issues. Maintainers should enable private reporting, secret scanning and push protection in repository settings.

## Deployment responsibilities

Use the latest reviewed release and supported Node.js/Workers runtime. Serve the public app over HTTPS. Keep development servers on loopback or behind an authenticated proxy. Set `APP_ORIGIN` to the exact public HTTPS origin; forwarded headers are never trusted to expand it. Supply your own paid-provider credentials and a search-only Meilisearch key, restricted to the required index. No supplied API keys are included in this repository.

Cloudflare applies a 35-starts/minute budget per edge location; the route also limits concurrency and starts per process/isolate. These are availability controls, **not a global cost ceiling or bot authentication**. Configure hard spending limits with each answering/classification provider and appropriate Cloudflare WAF/bot controls before opening anonymous access. Set `CHAT_ENABLED=false` as an emergency application kill switch. Origin and Fetch Metadata checks reduce browser cross-site abuse; command-line clients can still call an anonymous public endpoint.

Request and source bodies are byte bounded, body reads and provider requests have deadlines, and research rounds/tool calls are capped. Source tools use configured read-only adapters and reject redirects. In production, answering-provider credentials require HTTPS. Never let untrusted users configure provider or search endpoints. Cloudflare's `global_fetch_strictly_public` flag additionally restricts private network fetches.

Jev input and source screening fail closed on invalid or unavailable judgments. Screening is probabilistic and cannot prove factual accuracy or eliminate injection risk. The model gets no arbitrary fetch or write tool. User and model Markdown is rendered without raw HTML; assistant links resolve through the citation registry. Debug is opt-in, transient, bounded and redacts configured provider/search credentials. It can include your own lookup terms; do not publish private debug exports.

Browser headers block framing, MIME sniffing, external resource origins, object embedding and unnecessary device permissions. The static Next.js app's CSP allows inline scripts/styles for hydration and UI styles; it is a containment policy, not a strict nonce-based XSS defense. Raw HTML rendering remains disabled. Deployments requiring a strict script policy should add nonce-based dynamic rendering and verify caching/hydration compatibility.

There is no conversation database. Chats and debug traces remain in tab memory; providers and hosting services process requests under their own retention terms. The service worker caches only the explicit offline/branding allowlist and bypasses chat traffic. Read and adapt the privacy and terms pages for your own deployment.

## Release hygiene

Run `npm run check:public` and `npm audit` before releasing. The source scanner flags common provider tokens, private keys, configured local credentials, private network references and machine-specific paths without printing matching values. It complements dedicated secret scanners; it cannot detect every secret or encrypted/compressed metadata.

Cleaning the current tree does not remove older commits. Run `node scripts/check-public-source.mjs --ref=YOUR_RELEASE_BRANCH` to scan the history reachable from the branch you intend to publish. Only publish a clean release branch; do not push private development branches or tags. If a secret ever reached a remote, revoke/rotate it before removing it from history. Local environment files, Worker configuration, traces and build outputs stay ignored.
