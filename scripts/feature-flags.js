// Feature flags for pages still in progress. Hidden by default.
// Toggle from the console:
//   localStorage.setItem('imago-feature-performance', '1')  // show
//   localStorage.removeItem('imago-feature-performance')    // hide
const FEATURE_FLAGS = {
  performancePage: 'imago-feature-performance',
  // time.html's 4 top summary tiles (Today logged / Time left today /
  // This week logged / Time left this week) -- gone back and forth on
  // whether these earn their space, so it's a flag instead of just deleting
  // the code:
  //   localStorage.setItem('imago-feature-time-summary', '1')  // show
  //   localStorage.removeItem('imago-feature-time-summary')    // hide
  timeSummaryTiles: 'imago-feature-time-summary'
};

function isFeatureEnabled(flag) {
  return localStorage.getItem(flag) === '1';
}
