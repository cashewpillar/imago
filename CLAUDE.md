# imago

## Workflow

Because there's no test suite or CI gate here, human review is the only correctness check — so:

- Break feature work into small, independently reviewable chunks. Land one chunk at a time, ordered low-risk-first.
- After implementing a chunk, stop. Do **not** `git add` / commit / push.
- Wait for explicit go-ahead before starting the next chunk.
