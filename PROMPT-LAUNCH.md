# Launching an app out of imago

`imago` is a catch-all prototype playground — many unrelated `.html` pages sharing one PWA shell (`manifest.webmanifest`, `sw.js`, `pwa-register.js`, `icons/`, `scripts/`). When a prototype here is ready to become its own thing, extract it into a standalone repo at `~/Dev/apps/<name>/` and deploy it independently via a private-repo-friendly platform (Netlify, Cloudflare Pages, Vercel, Render — GitHub Pages needs a paid plan for private repos).

## What "launch" means

1. Create `~/Dev/apps/<name>/` (own git repo, own deploy).
2. Copy over the target `.html` page(s) plus every local file they read: `scripts/*.js` they `<script src>` or dynamically load, and any data files. Trace references, don't guess.
3. Build a fresh, minimal PWA shell for the new repo: `manifest.webmanifest`, `sw.js` (app-shell list scoped to just the copied pages/assets), `pwa-register.js` (copy as-is, it's generic), an `index.html` launcher if there's more than one page.
4. De-imago-ify: rename the `imago-` prefixed custom element (`<imago-chart>`) and `localStorage` key prefixes to the new app's name; update `apple-mobile-web-app-title`, manifest `name`/`short_name`, and page `<title>`s.
5. Give it its own hand-drawn-style SVG icon (simple, on-brand, not a copy of imago's) — rasterize to the PNG sizes both manifest and `apple-touch-icon` need (`sips -s format png -z <h> <w> in.svg --out out.png` works fine on macOS, no extra tooling required).
6. `git init`, but stop there — stage/commit/push only when told to.

## How a page signals it's part of a cluster

There's no enforced coupling in a static-HTML playground — pages don't declare dependencies. Two things stand in for that:

- **Mutual cross-links.** Pages meant to travel together link to their siblings — either a header `.nav-links` bar (savings/expenses/performance) or a "Pages" group inside each page's burger/settings dropdown (invest/asset-comparison/etf-comparison). If page A links to B and C, that's the signal they're a unit — extract A, extract B and C with it.
- **This doc's cluster list below.** Cross-links show *that* pages are coupled but not *what files* that pulls in (shared `scripts/*.js`, data files). Always re-trace those per the numbered steps above rather than trusting memory of what a page needs.

## Known clusters

| Cluster | Status |
|---|---|
| `savings.html`, `expenses.html`, `performance.html` | Extracted to `~/Dev/apps/fin/` |
| `invest.html`, `invest-asset-comparison.html`, `invest-etf-comparison.html`, `invest-risk-matrix.html`, `invest-conviction-statement.html` | Still in imago, cross-linked via each page's burger dropdown ("Pages" group). Conviction statement shares invest.html's `InvestTrackerV1` Dexie db (`convictionStatement` store) — extracting one without the other breaks that. |

## Reference: the fin extraction

First run of this: `savings.html`, `expenses.html`, `performance.html` (+ the data `performance.html` reads — `scripts/benchmarks-data.js`, its refresh script `scripts/fetch-benchmarks.js`, and the `scripts/etf-catalog.js` it depends on, trimmed to just the ticker actually used) extracted from imago into `~/Dev/apps/fin/`, meant for deploy via a private repo on one of the free-tier platforms above.

Original prompt:

> on ~/Dev/apps/fin/ (if folder not exist create it) duplicate the savings.html expenses.html and preformance.html in this repo to there (and the data being read by performance.html) -- i want to deploy it via private repo in one of the above free platforms -- should be PWA as well as this -- its a standalone repo unlike current repo which is a catch-all proto playground
>
> also write the above context and the prompt ive written as a PROMPT-LAUNCH.md to launch apps by navigating away from this proto playground into a private one

Follow-up mid-task: use a hand-drawn simple SVG (finance icon) for the app logo instead of reusing imago's icon.
