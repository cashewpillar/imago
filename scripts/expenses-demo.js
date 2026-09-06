// Sample data shown when the expense tracker has no expenses/income yet.
// Account ids here match the real accounts seeded by scripts/savings-demo.js
// (from savings-demo.json) — both pages share the same IndexedDB database.
(function () {
  function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  }

  const expenseTypes = [
    { id: 'demo-type-1', name: 'Food' },
    { id: 'demo-type-2', name: 'Transport' },
    { id: 'demo-type-3', name: 'Utilities' },
    { id: 'demo-type-4', name: 'Subscriptions' },
    { id: 'demo-type-5', name: 'Shopping' },
  ];

  const expenses = [
    { id: 'demo-exp-1', name: 'Grocery run',        amount: 2450, typeId: 'demo-type-1', accountId: 'acc-cash', date: daysFromNow(-2),  note: null },
    { id: 'demo-exp-2', name: 'Grab rides',          amount: 380,  typeId: 'demo-type-2', accountId: 'acc-cash', date: daysFromNow(-4),  note: null },
    { id: 'demo-exp-3', name: 'Meralco bill',        amount: 3120, typeId: 'demo-type-3', accountId: 'acc-gt',   date: daysFromNow(-6),  note: null },
    { id: 'demo-exp-4', name: 'Netflix',             amount: 549,  typeId: 'demo-type-4', accountId: 'acc-gt',   date: daysFromNow(-8),  note: null },
    { id: 'demo-exp-5', name: 'Weekend groceries',   amount: 1890, typeId: 'demo-type-1', accountId: 'acc-cash', date: daysFromNow(-11), note: null },
    { id: 'demo-exp-6', name: 'New shoes',           amount: 2999, typeId: 'demo-type-5', accountId: 'acc-gt',   date: daysFromNow(-15), note: null },
    { id: 'demo-exp-7', name: 'Water bill',          amount: 620,  typeId: 'demo-type-3', accountId: 'acc-gt',   date: daysFromNow(-19), note: null },
    { id: 'demo-exp-8', name: 'Spotify',             amount: 149,  typeId: 'demo-type-4', accountId: 'acc-gt',   date: daysFromNow(-24), note: null },
    { id: 'demo-exp-9', name: 'Dinner out',          amount: 1450, typeId: 'demo-type-1', accountId: 'acc-cash', date: daysFromNow(-30), note: null },
    { id: 'demo-exp-10', name: 'Gas & tolls',        amount: 900,  typeId: 'demo-type-2', accountId: 'acc-cash', date: daysFromNow(-36), note: null },
  ].map(e => ({ ...e, logId: null, updated_at: new Date().toISOString() }));

  const incomes = [
    { id: 'demo-inc-1', name: 'Salary', amount: 30000, frequency: 'monthly', payoutDays: '15,30', startDate: null, endDate: null },
    { id: 'demo-inc-2', name: 'Freelance project', amount: 20000, frequency: 'quarterly', payoutDays: '3', startDate: null, endDate: null },
  ].map(i => ({ ...i, updated_at: new Date().toISOString() }));

  window.EXPENSES_DEMO_DATA = { expenseTypes, expenses, incomes };
})();
