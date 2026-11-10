# Kuya J search and social preview

The public share image is [kuya-j-og-v1.png](../../public/social/kuya-j-og-v1.png): **1200 × 630**, PNG, with real Inter Tight typography, the original Kuya J mascot and authentic white BetterGov logo.

The production metadata uses a versioned image URL so this poster has its own cache identity. If the artwork changes again, publish a new filename and update `SOCIAL_IMAGE` in [lib/site-metadata.ts](../../lib/site-metadata.ts). Social platforms may still cache a previously scraped page; their next scrape needs to pick up the new metadata.

## Assets and reproduction

- [Blue background artwork](og-background.png), generated with the **built-in image generation tool**, generation mode; no CLI fallback.
- [Editable poster HTML](kuya-j-og.html), self-contained for review.
- [Renderer](render-social-poster.mjs), which uses Playwright and the existing font and mascot assets. Run `node docs/seo/render-social-poster.mjs`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` only when using a custom Chromium location.
- [Inter Tight font and license](../architecture/assets/InterTight-OFL.txt), shared with the architecture poster.
- BetterGov [primary PNG](../../public/brand/bettergov-horizontal-primary.png) and [white PNG](../../public/brand/bettergov-horizontal-white.png), copied unchanged from [bettergovph/logo](https://github.com/bettergovph/logo/tree/cd223d72a7339719b8d376b57bbb60c69bba6505/png) at commit `cd223d72a7339719b8d376b57bbb60c69bba6505`.
- [Original Kuya J mascot](../../public/brand/kuya-j-mascot.png).

The primary logo is used in the sidebar, About dialog, standalone About page, policy headers and current architecture poster. The white PNG is used against the blue social background. No logo stretching, recoloring or SVG-font substitution is involved.

## Search implementation

- Each of the four public pages has its own canonical URL, title, description and Open Graph URL.
- All share cards use the same poster with explicit dimensions, image type and descriptive alt text.
- `metadataBase` points to the public site, even when building on the VM.
- JSON-LD includes BetterGov.ph as an Organization, Kuya J as a WebSite, and the home-page WebApplication. It does not claim official government status, reviews, ratings, or unsupported rich-result eligibility.
- The About page renders source descriptions and domain links in server HTML. The chat UI retains its existing client interactions behind a server page that supplies metadata.
- The sitemap includes only `/`, `/about`, `/privacy` and `/terms`. It does not fabricate modification dates or expose conversation URLs.
- Robots allow public pages and assets, disallow API crawling, and link the sitemap. The offline HTML carries a `noindex, follow` directive.
- The offline branding cache version is bumped for the PNG attribution and updated fallback.
- No analytics, tracking, search-console verification token or indexing guarantee was added.

## Verification and deployment

Verified on 22 September 2026:

- TypeScript, ESLint and the production Cloudflare build passed; the build's credential scan passed.
- All 52 unit tests passed. All 21 browser scenarios passed against the production build, including chat, streaming, keyboard geometry, accessibility, policies, PWA behavior and the three new SEO scenarios. The crawler test was corrected to compare normalized root URLs because Next.js omits the root canonical's trailing slash.
- Six focused checks passed again on the live HTTPS site: crawler metadata and actual PNG dimensions; sitemap/robots; About with JavaScript disabled; mobile attribution and policy links; manifest/assets; offline fallback without chat caching.
- The poster render verified the actual Inter Tight font, decoded PNG logos and image boundaries. The logo PNG files are unchanged copies of the upstream assets.
- The architecture poster was re-exported with the same primary PNG; its PDF embeds Inter Tight and no longer depends on a font for the BetterGov wordmark.

Cloudflare Worker: `kuya-j` on `chat.bettergov.ph`. Published version: `48b3fd46-9ea1-443e-82c3-deb2b6f09304`. Previous version retained for rollback: `4d000589-7bd7-4e37-a378-3259c5dc96a3`. Work is isolated on branch `feat/seo-social-preview`.

## Exact background prompt

```text
Use case: ads-marketing.
Create a premium, exciting BLUE background artwork for the social-sharing poster of Kuya J, a friendly Philippine civic AI assistant from BetterGov.ph. This is a background plate for a finished 1200 × 630 Open Graph poster; typography, the authentic brand logos and the existing illustrated mascot will be placed on top separately.
Landscape composition, approximately 1.905:1. Full bleed. Deep royal blue #0032a0 and midnight cobalt on the LEFT half, smoothly opening into vivid electric blue and azure light on the RIGHT. Sculptural, sweeping translucent blue ribbons and elegant luminous arcs suggest many knowledge sources coming together in one conversation. On the right, subtle glassy conversation-bubble shapes and a few tiny warm yellow glints add energy and friendliness. Sophisticated polished digital campaign art, optimistic, Philippine civic technology, dramatic depth, clean silhouettes and rich saturated blues. The movement should curve around an EMPTY focal space at x=78%, y=48% where a mascot will be added later.
Keep the LEFT 58% smooth, dark and visually quiet for highly readable white text. Keep the bottom 15% similarly quiet for a URL. The right-hand shapes should be atmospheric, not a diagram or recognizable app interface. Plenty of breathing room; not a busy sci-fi dashboard. No people, no mascot, no animals, no letters, no words, no logo, no watermarks, no government seal, no map, no illegible fake UI. Entire image must be a finished intentional blue artwork, not a blank flat gradient.
```

The generated background is one layer of the finished poster. Native typography and the provided PNG logos were placed using the reproducible HTML renderer, preserving spelling and branding.
