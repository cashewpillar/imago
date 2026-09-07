### FEEDBACK MODULE
Summary. It's a small floating feedback button, visually distinct from whatever your app's main action button is, placed in an open corner so it never competes with core functionality. Tapping it opens one simple text box, with a placeholder like "what's on your mind," plus maybe one optional tag for bug, confusing, or idea, nothing more, to keep friction near zero. Since your apps are offline first using indexed DB, it queues the feedback entry locally, tagged with which app and screen it came from, and then syncs it to your backend whenever the device reconnects. And because it's built as one shared, drop in component, you just plug the same button and logic into every playground app you deploy, so feedback collection becomes automatic across your entire ecosystem instead of something you rebuild each time.

### food-v2
1. add expiry watcher for ingredients and find the best way to surface them (date bought/ ticked in checklist would be useful here)


---
could we separate the dishes, pantry, and grocery as 3 html files?

i guess we have everything we need, shared dexie.js database, shared css, shared javascript (only for overlapping stuff)

so food-v2.html just becomes the index.html (or maybe the base dishes.html and it reads on separate folder the other 2 html and shared css and shared js)
---

