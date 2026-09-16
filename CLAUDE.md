# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal site for Chuck Reynolds, built as a minimal single-page Astro app. Lives at chuckreynolds.com; chuckreynolds.us 301s to it.

The build output is static, but it is served by a Cloudflare Worker rather than as plain files, so that `/` can answer `Accept: text/markdown` with a markdown twin of the page. See "Deploys" and "Markdown twin" below.

No framework components, no client-side routing, no tracking, no external fonts.

## Deploys

Cloudflare **Workers Builds** deploys on every push to `main`, in roughly 45 seconds. Build command `npm run build`, deploy command `npx wrangler deploy`. There is no GitHub Actions workflow.

The Worker is named `chuckreynolds-com` (hyphen: Worker names cannot contain dots). `wrangler.jsonc` points `main` at `worker/index.ts` and serves `dist/` through the `ASSETS` binding.

This used to be a Cloudflare Pages project called `crus`. That project's Git connection broke silently and blocked every deploy for a month before anyone noticed. If a push seems to do nothing, check that the Git connection is still live before debugging the code.

## Commands

- `npm run dev` — local dev server (Astro)
- `npm run build` — static build to `dist/`
- `npm run preview` — serve the built `dist/` locally

There are no tests, linters, or formatters configured. Don't invent any.

## Architecture

The entire site is one file: `src/pages/index.astro`. Treat it as the source of truth for content, metadata, and page-level scripts.

- **Frontmatter** defines `title` / `description` / `canonical` / `image` and a `schema.org` Person JSON-LD blob. Keep these in sync — they feed `<meta>`, OpenGraph, Twitter cards, and the structured-data block.
- **Inline `is:inline` head script** applies the stored theme (`localStorage.theme`) before paint to avoid flash. This must stay inline and synchronous, before the body renders.
- **Body** is hand-written HTML: a fixed theme-toggle button, a `<main>` opening with the `<header class="hero">` (headshot + `<h1>` + tagline), the bio content, and a `<script>` block at the bottom that wires the toggle and reacts to `prefers-color-scheme` changes.
- **Styles** live in `src/styles/global.css`, imported from the page frontmatter. `astro.config.mjs` has `inlineStylesheets: 'always'`, so the CSS ships inlined — keep it small.

### Markdown twin

`/` answers `Accept: text/markdown` with a markdown version of the page, also available directly at `/index.md`.

`src/integrations/markdown-twin.mjs` generates it in an `astro:build:done` hook by converting the *already rendered* `dist/index.html`, taking its metadata from the page's own JSON-LD. Nothing about the content is written twice, so the twin cannot drift — edit `index.astro` and it follows. Don't hand-maintain a second markdown copy. Elements marked `data-html-only` are stripped from the twin.

`worker/index.ts` does the negotiation. It parses `Accept` q-values, because browsers send `*/*;q=0.8` which matches `text/markdown` on a naive check — markdown must outrank HTML to win, and ties go to HTML. Both representations send `Vary: Accept` and a `Link` header pointing at the other. `run_worker_first` in `wrangler.jsonc` limits the Worker to `/`, `/index.html`, and `/index.md`; every other asset serves straight from the edge without a Worker invocation.

### Theme system

Three states, in this order of precedence:
1. Explicit `data-theme="dark"|"light"` on `<html>` (set by the toggle, persisted in `localStorage`).
2. OS `prefers-color-scheme` (default when nothing is stored).
3. Light fallback.

Both the pre-paint inline script and the bottom-of-body script must agree on this precedence. The CSS mirrors it via `:root[data-theme="dark"]` and `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` — if you change theme logic, update all three.

### Images

Local images live in `src/assets/` so they go through Astro's asset pipeline (hashing, optimization, format conversion). Use `<Picture />` from `astro:assets` with `formats={['avif', 'webp']}`, explicit `widths` covering 1×/2× density, and a `sizes` value that matches the CSS breakpoint — see the headshot in `index.astro` for the pattern. Above-the-fold images use `loading="eager"` + `fetchpriority="high"` since they're the LCP. `astro.config.mjs` sets `image.responsiveStyles: true` so generated `<img>` tags get sensible responsive sizing out of the box.

The social card image (`public/chuck-reynolds-BW-square.jpg`) is an exception — it must stay in `public/` because the OG/Twitter meta needs a stable absolute URL, not a content-hashed asset.

### Hero layout

`.hero` is a CSS Grid: single column <640px (photo above name), `auto 1fr` at ≥640px with the photo left-aligned and name/tagline baseline-aligned to the photo bottom. The photo has rounded corners and a `::before` pseudo-element that renders an accent-colored card offset down-and-right behind it — `background: var(--accent)` at ~22% opacity, so it flips with the theme. If you change the photo dimensions, update the `sizes` attribute on `<Picture />` to match.

### Social icons

SVG icons are inlined directly in the markup (not sprited, not external). They inherit `currentColor` so they follow the theme. Adding a social link = add an `<li>` with an inline SVG and a matching `sameAs` entry in the Person schema.

## Conventions

- System fonts only (see `body` font stack). No web fonts.
- No JS frameworks. If something needs interactivity, write vanilla TS in a `<script>` tag.
- `astro.config.mjs` sets `site: 'https://chuckreynolds.com'` — the production canonical.
- `description` in `index.astro` feeds the meta description, two JSON-LD nodes, and the markdown twin's frontmatter. Keep it under ~155 characters or search snippets truncate. `socialDescription` is separate and can run longer, since OpenGraph has no such limit.
