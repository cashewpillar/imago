// "Owner" flag for hiding tabs/pages meant only for the account owner.
// Hidden by default on every device. Mark this device as the owner's
// from the console:
//   localStorage.setItem('imago-owner-mode', '1')  // show owner-only content
//   localStorage.removeItem('imago-owner-mode')    // hide it again
const OWNER_MODE_FLAG = 'imago-owner-mode';

function isOwnerMode() {
  return localStorage.getItem(OWNER_MODE_FLAG) === '1';
}

// Tap the "imago" title 5 times within 2 seconds to flip the flag on
// this device. Mirrors fin's owner-flag.js gesture.
document.addEventListener('DOMContentLoaded', () => {
  const logo = document.querySelector('header h1');
  if (!logo) return;
  let taps = 0;
  let resetTimer;
  logo.addEventListener('click', () => {
    taps++;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { taps = 0; }, 2000);
    if (taps < 5) return;
    taps = 0;
    clearTimeout(resetTimer);
    const wasOwner = isOwnerMode();
    if (wasOwner) localStorage.removeItem(OWNER_MODE_FLAG);
    else localStorage.setItem(OWNER_MODE_FLAG, '1');
    if (typeof toast === 'function') {
      toast(wasOwner ? 'Owner mode off for this device' : 'Owner mode on for this device');
    }
  });
});
