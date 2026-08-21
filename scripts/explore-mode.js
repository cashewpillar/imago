// Shared "explore mode" (demo data) logic for savings.html / expenses.html.
// Both pages share one IndexedDB (FinanceTrackerV2). While exploring, the
// page-global `db` points at a throwaway preview database instead of the
// real one — every existing render/save/delete call is unaffected since it
// just uses whatever `db` currently points to. Real data (`realDb`) is only
// ever written to explicitly (adoptDemoData, import, export, clear).
//
// Each page must declare `realDb = new Dexie('FinanceTrackerV2')` and
// `db = realDb` (assignment, not `let`/`const` — these globals are declared
// here) before calling refreshMode().
let db, realDb, demoDb;

const EXPLORE_FLAG = 'imago-explore-mode';
const EXPLORE_DISMISSED_FLAG = 'imago-explore-dismissed';

function getDemoDb() {
  if (!demoDb) {
    demoDb = new Dexie('FinanceTrackerDemoPreview');
    demoDb.version(1).stores({
      accounts: 'id,key,label',
      history: 'id,date',
      logs: 'id,accountId,date,expenseId',
      expenses: 'id,date,typeId,accountId',
      expenseTypes: 'id,name',
      incomes: 'id,name,frequency'
    });
  }
  return demoDb;
}

function isExploreMode() { return sessionStorage.getItem(EXPLORE_FLAG) === '1'; }

async function clearAllData(targetDb = db) {
  await targetDb.accounts.clear();
  await targetDb.history.clear();
  await targetDb.logs.clear();
  await targetDb.expenses.clear();
  await targetDb.expenseTypes.clear();
  await targetDb.incomes.clear();
}

async function enterExploreMode() {
  const dDb = getDemoDb();
  await clearAllData(dDb);

  if (window.SAVINGS_DEMO_DATA) {
    const { accounts, history, logs } = window.SAVINGS_DEMO_DATA;
    await dDb.accounts.bulkPut(accounts);
    await dDb.history.bulkPut(history);
    if (logs) await dDb.logs.bulkPut(logs);
  }
  if (window.EXPENSES_DEMO_DATA) {
    const { expenseTypes, expenses, incomes } = window.EXPENSES_DEMO_DATA;
    await dDb.expenseTypes.bulkPut(expenseTypes);
    await dDb.expenses.bulkPut(expenses);
    await dDb.incomes.bulkPut(incomes);
  }

  db = dDb;
  sessionStorage.setItem(EXPLORE_FLAG, '1');
  updateDemoUI();
}

async function exitExploreMode() {
  db = realDb;
  sessionStorage.removeItem(EXPLORE_FLAG);
  localStorage.setItem(EXPLORE_DISMISSED_FLAG, '1');
  updateDemoUI();
  render();
}

async function toggleExploreMode() {
  document.getElementById('settingsDropdown').classList.remove('open');
  if (isExploreMode()) {
    await exitExploreMode();
  } else {
    localStorage.removeItem(EXPLORE_DISMISSED_FLAG);
    await enterExploreMode();
    render();
  }
}

async function adoptDemoData() {
  if (!confirm('This adds the sample accounts, history and expense data to your real data. Continue?')) return;
  const dDb = getDemoDb();
  const [accounts, history, logs, expenses, expenseTypes, incomes] = await Promise.all([
    dDb.accounts.toArray(), dDb.history.toArray(), dDb.logs.toArray(),
    dDb.expenses.toArray(), dDb.expenseTypes.toArray(), dDb.incomes.toArray()
  ]);
  await realDb.accounts.bulkPut(accounts);
  await realDb.history.bulkPut(history);
  await realDb.logs.bulkPut(logs);
  await realDb.expenses.bulkPut(expenses);
  await realDb.expenseTypes.bulkPut(expenseTypes);
  await realDb.incomes.bulkPut(incomes);

  db = realDb;
  sessionStorage.removeItem(EXPLORE_FLAG);
  updateDemoUI();
  toast('Sample data added to your account.');
  render();
}

function updateDemoUI() {
  const exploring = isExploreMode();
  document.getElementById('demoBanner').classList.toggle('show', exploring);
  const label = document.getElementById('exploreToggleLabel');
  if (label) label.textContent = exploring ? 'Exit demo mode' : 'Try demo data';
}

async function refreshMode() {
  if (isExploreMode()) {
    db = getDemoDb();
  } else {
    db = realDb;
    if (await realDb.accounts.count() === 0 && !localStorage.getItem(EXPLORE_DISMISSED_FLAG)) {
      await enterExploreMode();
    }
  }
  updateDemoUI();
  render();
}
