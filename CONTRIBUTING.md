# Contributing

Open an issue describing the problem or proposed change, then submit a focused pull request. For security issues, follow `SECURITY.md` instead of posting exploit details or secrets publicly.

Use Node.js 22 or later, `npm ci`, and your own credentials in ignored `.env.local` files. Default unit tests and browser fixtures do not call paid AI services. Live evaluation commands are opt-in and may incur charges.

Before submitting, run:

```bash
npm run check:public
npm run typecheck
npm test
npm run lint
npm run cf:build
```

For UI changes, install Chromium with `npx playwright install chromium`, start a local instance, and run `npm run test:browser`. Never submit credentials, private network addresses, machine-specific paths, production chat traces, local deployment files or build outputs.

Keep retrieval read-only, preserve provider key separation, bound requests, screen source content, and keep citations tied to retrieved records. Add meaningful regression coverage for changes to security, screening or source adapters. Update `ARCHITECTURE.md` when changing the pipeline.
