const scriptSrc = document.currentScript ? document.currentScript.src : window.location.href;
const swUrl = new URL('sw.js', scriptSrc).pathname;

// ── Install prompt ────────────────────────────────────────────────────────────
// Saving the event (without preventDefault()) lets the settings dropdown's
// "Install app" item also trigger this same prompt later -- a discoverable,
// explained path for people unfamiliar with PWAs -- while leaving Chrome's
// own install icon/mini-infobar showing as usual, since we're not
// suppressing its default behavior.
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  deferredInstallPrompt = e;
});
window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; });

function isStandaloneDisplay() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Pages that want an install entry point define #installModalBody and
// #installModalActionBtn (see savings.html/expenses.html) and call this from
// their settings dropdown; no-ops on a page without that modal.
function openInstallModal() {
  const body = document.getElementById('installModalBody');
  const btn = document.getElementById('installModalActionBtn');
  if (!body || !btn) return;

  const dropdown = document.getElementById('settingsDropdown');
  if (dropdown) dropdown.classList.remove('open');

  if (isStandaloneDisplay()) {
    body.innerHTML = `<p style="font-size:13px">imago is already installed on this device.</p>`;
    btn.style.display = 'none';
  } else if (deferredInstallPrompt) {
    body.innerHTML = `<p style="font-size:13px">Install imago for a full-screen, offline-capable app icon on your home screen or dock.</p>`;
    btn.style.display = 'inline-block';
  } else if (isIOSDevice()) {
    body.innerHTML = `<p style="font-size:13px">On iPhone/iPad: tap the <strong>Share</strong> button in Safari, then choose <strong>"Add to Home Screen"</strong>.</p>`;
    btn.style.display = 'none';
  } else {
    body.innerHTML = `<p style="font-size:13px">Look for an install icon in your browser's address bar, or check your browser's menu for "Install app" / "Add to Home Screen".</p>`;
    btn.style.display = 'none';
  }
  if (typeof openModal === 'function') openModal('installModal');
}

async function triggerInstallPrompt() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  if (typeof closeModal === 'function') closeModal('installModal');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register(swUrl).then(registration => {
      registration.update();

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch(error => {
      console.error('Service worker registration failed:', error);
    });
  });
}
