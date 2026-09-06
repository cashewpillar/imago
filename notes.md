# Notes markdown

The textarea markdown/preview pair used by the `textarea` field type in Notes (`notes.js`, `notes.html`). Covers what's supported and why it's built the way it is — not a general howto.

## Supported syntax

| Type | Syntax | Renders as |
|---|---|---|
| Heading | `### `, `#### `, `##### ` | h3 / h4 / h5 |
| Checklist | `- [ ] text`, `- [x] text` | draggable checkbox row |
| Bullet | `- text` or `* text` | bulleted line |
| Bold | `**text**` or `__text__` | **text** |
| Italic | `*text*` or `_text_` | *text* |
| Underline | `++text++` | <u>text</u> |
| Link | `[label](url)` | anchor, opens in new tab |
| Tag | `#word` | pill, colored with the table's accent |
| Date | `@[YYYY-MM-DD]` | pill, e.g. 📅 Sep 6, 2026 |
| `/today` | typed literally | auto-expands to a date pill for today |
| blank line | (empty) | line break |

Headings, checklists, and bullets are line-level — they must start the line. Everything else (bold, italic, links, tags, dates) is inline and can appear anywhere in a line, including inside a heading or checklist item.

## `/today` and date pills

Typing `/today` at the end of a word boundary (start of line, after whitespace, or after `(`) immediately replaces it with `@[2026-09-06]` — today's date in the browser's local calendar, not UTC. The preview then renders that as a rounded pill showing the human-readable date.

`@[YYYY-MM-DD]` is the pill's storage format, and it's plain markdown syntax like the others — type it by hand for a date other than today (e.g. a deadline) and it renders as a pill too. `/today` is just a shortcut that writes that syntax for you.

Backspace right after a pill deletes the whole `@[...]` token in one keystroke, not one character at a time — it's meant to feel like an atomic unit even though it's stored as plain text.

## Design decisions

**Storage is always plain text.** Every note is one string in the `textarea` field of a record. There's no separate rich-data model — checkboxes, tags, and date pills are all just substrings the renderer recognizes (`- [ ] `, `#word`, `@[...]`). This is why the checklist/date-pill "atomic" interactions (paint-drag, backspace-delete) exist as extra JS: the underlying representation doesn't know these are structured, so the UI has to fake structure on top of a plain string.

**Line-level vs. inline tokens.** Block-level things (headings, checklists, bullets) are recognized by `line.startsWith(...)` before a line is tokenized at all — they only fire at the very start of a line. Inline things (bold, italic, links, tags, dates) go through one shared regex (`MD_TOKEN_RE`) applied to line content. That split keeps the block logic (which changes the wrapping element) separate from inline logic (which only changes spans within it).

**Why `@[YYYY-MM-DD]` and not a plain date string.** The pill needs a raw form the tokenizer can find deterministically and an unambiguous way to tell "this text is a date pill" apart from any date-shaped text a user might type in prose. A dedicated delimiter (`@[...]`) avoids both false positives (matching "9/6/2026" typed as regular text) and false negatives (a date pill that looks identical to plain text and can't be found again to re-render or delete atomically).

**Why the pill formats in local time via `new Date(y, m-1, d)` instead of `new Date(iso)`.** `new Date("2026-09-06")` parses as UTC midnight; formatting that back with `toLocaleDateString` in a timezone behind UTC (most of the Americas) shows the *previous* calendar day — a classic date-only-string bug. The three-argument `Date` constructor builds the date in local time instead, so the pill always matches the day it says it is, regardless of viewer timezone. `todayIso()` mirrors this — it reads `getFullYear`/`getMonth`/`getDate` (local) rather than `toISOString()` (UTC), so `/today` typed at 11pm in a UTC-behind timezone doesn't silently insert tomorrow's date.

**Why the pill doesn't use the table's accent color.** Tags (`#word`) are colored with the table's accent because they're user-defined categories — the color reinforces "this is a facet of my data." A date is a fixed, universal fact, not a category, so it gets a neutral chip (`--bg4` / `--text` / `--border2`) that reads consistently regardless of which table or accent color it's viewed in.

**Cursor-position mapping is best-effort for pills, not exact.** Every rendered token carries `data-raw`/`data-rawlen` pointing back at its offset in the raw textarea string, so clicking anywhere in the preview places the real caret at roughly the right spot (see the comment atop the markdown section in `notes.js`). For text tokens the rendered length always equals the raw length, so this mapping is exact. For a date pill the rendered text ("📅 Sep 6, 2026") is a different length than the raw text (`@[2026-09-06]`), so a click can land a few characters off within the token. That's an accepted tradeoff — the atomic backspace-delete means people rarely need to click *inside* a pill to edit it character-by-character.

**No autocomplete popup for `/today`.** Editors like Notion show a floating command menu after `/` and expand on Enter/click. This one expands eagerly, the instant the typed text exactly matches `/today` — no menu, no confirmation. That trades away "keep typing past `/today` to type something else" (e.g. `/todayish`) for zero added UI surface, consistent with this being a single hardcoded shortcut rather than the start of a slash-command framework.
