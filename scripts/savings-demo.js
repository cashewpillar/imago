// Sample data shown when the savings tracker has no accounts yet.
// Sourced verbatim from savings-demo.json (a real exported usage snapshot),
// seeded once by savings.html; cleared entirely via the demo banner's reset action.
(function () {
  const accounts = [
    { id: 'acc-006b9592-1a4b-4f36-abf8-aec8ab31555f', key: 'BANKO',  label: 'BanKo',       balance: 25000, rate: 5,    tags: ['savings'], maturity: null,       note: null, updated_at: '2026-05-23T00:56:13.830Z' },
    { id: 'acc-bdo',     key: 'BDO',      label: 'BDO',          balance: 0,      rate: 0,    tags: ['buffer'],   maturity: null,       note: 'Target 100 - emergency' },
    { id: 'acc-beacon',  key: 'BEACON',   label: 'Rent',   balance: 8500,   rate: null, tags: ['illiquid'], maturity: null,       note: 'Held, illiquid', updated_at: '2026-05-17T03:02:06.414Z' },
    { id: 'acc-bp',      key: 'BP',       label: 'BPI',          balance: 26250,  rate: 0,    tags: ['buffer'],   maturity: null,       note: 'For emergencry', updated_at: '2026-05-22T23:54:52.370Z' },
    { id: 'acc-bpcc',    key: 'BP_CC',    label: 'BPI Gold',     balance: -14500, rate: 0,    tags: ['credit'],   maturity: null,       note: null, updated_at: '2026-05-17T03:32:03.449Z' },
    { id: 'acc-caff27de-6c8a-4ed7-ad8c-b40c5cb151b1', key: 'BOND', label: 'Friend owes', balance: 5000, rate: null, tags: ['illiquid'], maturity: null, note: null, updated_at: '2026-05-17T03:32:38.601Z' },
    { id: 'acc-cash',    key: 'CASH',     label: 'Cash',         balance: 7500,   rate: 0,    tags: ['cash'],     maturity: null,       note: null, updated_at: '2026-05-17T03:13:21.146Z' },
    { id: 'acc-cb1',     key: 'CB_TD1',   label: 'CIMB TD 1',    balance: 38250,  rate: 4.75, tags: ['td'],       maturity: '2026-05-28', note: null, updated_at: '2026-05-23T00:08:40.576Z' },
    { id: 'acc-cb2',     key: 'CB_TD2',   label: 'CIMB TD 2',    balance: 12500,  rate: 4.25, tags: ['td'],       maturity: '2026-06-09', note: null, updated_at: '2026-05-23T00:08:56.067Z' },
    { id: 'acc-f5eda89d-b61c-4ba4-9809-64f1fe5aed44', key: 'MAYA_TD2', label: 'Maya TD 2', balance: 25000, rate: 6, tags: ['td'], maturity: '2026-09-30', note: null, updated_at: '2026-05-17T03:43:55.091Z' },
    { id: 'acc-gt',      key: 'GT',       label: 'GoTyme',       balance: 25000,  rate: 3,    tags: ['savings'],  maturity: null,       note: null, updated_at: '2026-05-23T00:56:33.789Z' },
    { id: 'acc-maya',    key: 'MAYA_TD1', label: 'Maya TD 1',    balance: 40500,  rate: 6,    tags: ['td'],       maturity: '2026-05-31', note: null, updated_at: '2026-05-17T03:28:56.597Z' },
    { id: 'acc-sb',      key: 'SB',       label: 'MariBank',     balance: 30500,  rate: 3.25, tags: ['savings'],  maturity: null,       note: null, updated_at: '2026-05-22T23:26:30.783Z' },
    { id: 'acc-tk1',     key: 'TK_TD',    label: 'Tonik TD',     balance: 25000,  rate: 6,    tags: ['td'],       maturity: '2026-10-31', note: null, updated_at: '2026-05-17T03:51:06.755Z' },
    { id: 'acc-tk2',     key: 'TK_STSH',  label: 'Tonik Stash',  balance: 20000,  rate: 4,    tags: ['savings'],  maturity: null,       note: null, updated_at: '2026-05-17T03:02:39.824Z' },
  ];

  const history = [
    { id: 'h-20251221', date: '2025-12-21', total: 161000 },
    { id: 'h-20251228', date: '2025-12-28', total: 172500 },
    { id: 'h-20260104', date: '2026-01-04', total: 177000 },
    { id: 'h-20260111', date: '2026-01-11', total: 183750 },
    { id: 'h-20260118', date: '2026-01-18', total: 189250 },
    { id: 'h-20260125', date: '2026-01-25', total: 193000 },
    { id: 'h-20260201', date: '2026-02-01', total: 193000 },
    { id: 'h-20260208', date: '2026-02-08', total: 202500 },
    { id: 'h-20260215', date: '2026-02-15', total: 205000 },
    { id: 'h-20260222', date: '2026-02-22', total: 218500 },
    { id: 'h-20260301', date: '2026-03-01', total: 218500 },
    { id: 'h-20260308', date: '2026-03-08', total: 235250 },
    { id: 'h-20260315', date: '2026-03-15', total: 240750 },
    { id: 'h-20260322', date: '2026-03-22', total: 240750 },
    { id: 'h-20260329', date: '2026-03-29', total: 266500 },
    { id: 'h-20260405', date: '2026-04-05', total: 268750 },
    { id: 'h-20260412', date: '2026-04-12', total: 274750 },
    { id: 'h-20260419', date: '2026-04-19', total: 280000 },
    { id: 'h-20260426', date: '2026-04-26', total: 280750 },
    { id: 'h-20260503', date: '2026-05-03', total: 274500 },
    { id: 'h-20260510', date: '2026-05-10', total: 274500 },
    { id: 'h-20260517', date: '2026-05-17', total: 274250, auto: true },
    { id: 'h-20260522', date: '2026-05-22', total: 274250, auto: true },
    { id: 'h-20260523', date: '2026-05-23', total: 274500, auto: true },
  ];

  const logs = [
    { id: 'log-2348541e-625c-44d0-80ab-45c5e47f7c25', accountId: 'acc-006b9592-1a4b-4f36-abf8-aec8ab31555f', date: '2026-05-23T00:56:13.832Z', balance: 25000, change: 12500, note: 'Balance update' },
    { id: 'log-2541ea08-6142-46a9-a7ce-971b83e66981', accountId: 'acc-bp', date: '2026-05-22T23:54:52.372Z', balance: 26250, change: -25000, note: 'Balance update' },
    { id: 'log-2fa3f7f8-af82-48ff-bfe2-f5a877484caf', accountId: 'acc-006b9592-1a4b-4f36-abf8-aec8ab31555f', date: '2026-05-22T23:59:55.976Z', balance: 12500, change: -12500, note: 'Balance update' },
    { id: 'log-35859b6d-4dfe-46d6-b938-e9ef9c1a8a9f', accountId: 'acc-cash', date: '2026-05-17T03:13:21.147Z', balance: 7500, change: -3500, note: 'untracked but this is latest' },
    { id: 'log-36852e80-393d-4acf-98b0-fdd2fa5915a0', accountId: 'acc-gt', date: '2026-05-17T03:30:20.888Z', balance: 24750, change: -4500, note: 'Balance update' },
    { id: 'log-387c38fe-1cc9-41a1-acd1-2c29680830ed', accountId: 'acc-tk1', date: '2026-05-17T03:31:35.088Z', balance: 25000, change: -250, note: 'Balance update' },
    { id: 'log-5e010173-1eb8-423d-91e4-90e06feed738', accountId: 'acc-maya', date: '2026-05-17T03:28:56.599Z', balance: 40500, change: 2500, note: 'Balance update' },
    { id: 'log-6fc76ed9-8b1f-41c9-b516-eafa5cb4aa6c', accountId: 'acc-gt', date: '2026-05-22T23:59:47.150Z', balance: 37250, change: 12500, note: 'Balance update' },
    { id: 'log-7e842da9-b855-4495-917d-cbe4904e9d90', accountId: 'acc-bp', date: '2026-05-17T03:29:41.322Z', balance: 51250, change: 6500, note: 'Balance update' },
    { id: 'log-904d87c2-0df3-46f1-8a30-bda47720933a', accountId: 'acc-bpcc', date: '2026-05-17T03:32:03.451Z', balance: -14500, change: -2250, note: 'Balance update' },
    { id: 'log-bcc6e50c-ed2c-412d-b55e-531194787494', accountId: 'acc-caff27de-6c8a-4ed7-ad8c-b40c5cb151b1', date: '2026-05-17T03:32:38.611Z', balance: 5000, change: 5000, note: 'Account created' },
    { id: 'log-bda42856-b90a-488d-a2e0-401da34fa6de', accountId: 'acc-006b9592-1a4b-4f36-abf8-aec8ab31555f', date: '2026-05-22T23:54:16.315Z', balance: 25000, change: -24975000, note: 'Balance update' },
    { id: 'log-c9bd9111-2bbb-4436-9644-3bee92f8b715', accountId: 'acc-gt', date: '2026-05-23T00:56:33.791Z', balance: 25000, change: -12250, note: 'Balance update' },
    { id: 'log-e19fe0f7-3a71-4281-8a83-29dd43b45521', accountId: 'acc-sb', date: '2026-05-17T03:30:47.126Z', balance: 30500, change: -250, note: 'Balance update' },
    { id: 'log-e78ad5c3-6d95-4ebd-9ae7-c08151b3fd3d', accountId: 'acc-maya', date: '2026-05-17T03:20:32.523Z', balance: 38000, change: -25750, note: 'Balance update' },
    { id: 'log-f0d498e2-006a-421f-80ee-c4307601f7e1', accountId: 'acc-f5eda89d-b61c-4ba4-9809-64f1fe5aed44', date: '2026-05-17T03:21:16.846Z', balance: 25000, change: -24975000, note: 'correction' },
    { id: 'log-fe1977e9-e96f-4b81-b1bc-f1b224c12b4c', accountId: 'acc-f5eda89d-b61c-4ba4-9809-64f1fe5aed44', date: '2026-05-17T03:21:01.994Z', balance: 25000000, change: 25000000, note: 'Account created' },
  ];

  window.SAVINGS_DEMO_DATA = { accounts, history, logs };
})();
