// Feature flags for pages still in progress. Hidden by default.
// Toggle from the console:
//   localStorage.setItem('imago-feature-performance', '1')  // show
//   localStorage.removeItem('imago-feature-performance')    // hide
const FEATURE_FLAGS = {
  performancePage: 'imago-feature-performance'
};

function isFeatureEnabled(flag) {
  return localStorage.getItem(flag) === '1';
}
