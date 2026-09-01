// Shared "privacy mask" for sensitive summary-tile numbers, used by
// savings.html and expenses.html. All masked numbers blur by default and
// share one reveal toggle — clicking any masked/unmasked number (or its eye
// icon) reveals/hides all of them at once. State persists in localStorage
// across reloads and pages.
const MASK_REVEAL_KEY = 'imago-mask-revealed';

function isMaskRevealed() {
  try { return localStorage.getItem(MASK_REVEAL_KEY) === '1'; } catch { return false; }
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

// Re-mask the moment the app leaves focus (tab switch, app switch, screen
// lock) so revealed numbers aren't left on-screen in the app switcher/thumbnail.
function reMaskOnLeave() {
  if (!isMaskRevealed()) return;
  try { localStorage.setItem(MASK_REVEAL_KEY, '0'); } catch {}
  if (typeof render === 'function') render();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) reMaskOnLeave(); });
window.addEventListener('blur', reMaskOnLeave);
