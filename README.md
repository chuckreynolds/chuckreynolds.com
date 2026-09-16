# chuckreynolds.com

Personal site. One page, hand-written, no tracking.

## Tech stack

- **Astro** (static output) — the whole site is `src/pages/index.astro`, plus a 404
- **Vanilla TypeScript** for the theme toggle. No framework, no client-side routing
- **CSS** in `src/styles/global.css`, inlined into the page at build time
- **System fonts only.** No web fonts, no analytics, no third-party requests
- Images run through Astro's asset pipeline (AVIF/WebP, hashed, responsive)
- A build hook generates `/index.md`, a markdown twin of the page, from the
  rendered HTML

## Deploy stack

- **Cloudflare Workers.** The Worker is `chuckreynolds-com`; `dist/` is served as
  static assets
- **Workers Builds** deploys on every push to `main`, in about 45 seconds
  - Build command: `npm run build`
  - Deploy command: `npx wrangler deploy`
- The Worker only runs on `/`, `/index.html`, and `/index.md`, where it handles
  `Accept: text/markdown` content negotiation. Everything else serves straight
  from the edge

## Commands

```sh
npm run dev      # local dev server
npm run build    # static build to dist/
npm run preview  # serve the built dist/
```

No tests, linters, or formatters.
