// Shared "privacy mask" for sensitive summary-tile numbers, used by
// index.html and expenses.html. Each masked number has an eye icon that
// toggles it (and every other masked number) between shown and blurred.
// The choice persists in localStorage across reloads and pages. New users
// (no stored choice yet) start unmasked.
const MASK_REVEAL_KEY = 'imago-mask-revealed';

function isMaskRevealed() {
  try {
    const v = localStorage.getItem(MASK_REVEAL_KEY);
    return v === null ? true : v === '1';
  } catch { return true; }
}

function toggleMaskReveal() {
  const revealed = isMaskRevealed();
  try { localStorage.setItem(MASK_REVEAL_KEY, revealed ? '0' : '1'); } catch {}
  if (typeof render === 'function') render();
}

function maskEyeIcon(revealed) {
  return revealed
    ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>`
    : `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><line x1="1" y1="1" x2="15" y2="15"/></svg>`;
}

// valueHtml: the already-formatted display markup (e.g. '₱12.3k').
function maskedAmount(valueHtml) {
  const revealed = isMaskRevealed();
  return `
    <span class="mask-wrap">
      <span class="mask-val${revealed ? '' : ' is-masked'}" onclick="event.stopPropagation();toggleMaskReveal()">${valueHtml}</span>
      <button class="mask-eye" onclick="event.stopPropagation();toggleMaskReveal()" title="${revealed ? 'Hide' : 'Show'}" aria-label="Toggle visibility">${maskEyeIcon(revealed)}</button>
    </span>
  `;
}
