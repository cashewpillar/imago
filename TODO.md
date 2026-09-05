food-v2
1. add expiry watcher for ingredients and find the best way to surface them (date bought/ ticked in checklist would be useful here)


---
could we separate the dishes, pantry, and grocery as 3 html files?

i guess we have everything we need, shared dexie.js database, shared css, shared javascript (only for overlapping stuff)

so food-v2.html just becomes the index.html (or maybe the base dishes.html and it reads on separate folder the other 2 html and shared css and shared js)
---

invest.html
1. show the FX rate actually used for each ₱ conversion (portfolio value chart, ticker table's ₱ column) as a small subline right next to the number, e.g. "₱58,200 @ ₱58.3/$", instead of a separate disclaimer — so the number is self-explaining instead of sending the user hunting for a footnote.
2. add a cost-basis (cumulative invested-to-date) line to the portfolio value chart alongside the current value line — the gap between the two shows gain/loss at a glance, and scales better than showing a single ticker's raw price once multiple tickers exist.
