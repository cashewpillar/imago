## Setup

Run PWA:

```shell
npx serve .
```

## Development

When you add a new `.html` file, register it with the PWA and index launcher by running:

```shell
node scripts/register-html.js
```

## Guide
1. Dexie.js for storage
1. Vanilla HTML and JS
1. Mobile-first
1. Light mode only
1. Core features
    - Import/export (UUID, idempotent records)
    - Reset and import

## PWA caching

The service worker precaches only the launcher shell (`index.html`, `archive.html`, `seldom.html` + shared css/js/icons). Every prototype page is cached the first time it's opened online — so an install stays small as pages pile up here, and a tester never pulls the whole playground at once.

A page you've never opened isn't available offline. Opening it offline serves `offline.html` (a "visit once online" message), not the page. Once opened online, it works offline like the rest.

Bump `CACHE_NAME` in `sw.js` to force every client to drop its cache.

## Next: public testing

Goal: open a few apps here to outside testers with a shared feedback module, keep the rest private and unreachable.

Steps, low-risk first:

1. Separate the public build. Client-side flags (`owner-mode.js`, `feature-flags.js`) only affect UI — the static files still serve to anyone with the URL. Add a step that copies allowlisted apps + their assets into `dist/` and deploy that; private pages never reach the host.
2. Feedback module. Shared drop-in (see `TODO.md`): offline queue in Dexie, tagged by app/screen, syncs on reconnect.