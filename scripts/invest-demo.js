// Sample data shown when the invest tracker has no tickers yet. Shape mirrors
// a real exported usage snapshot (one ticker, a run of periodic buys), but
// every dollar amount is an obvious round placeholder (123, 456, ...) rather
// than a real figure -- deliberately not real data. Starts at VWRA's actual
// 2019-07-31 inception (scripts/benchmarks-data.js) so every buy compounds
// with real returns from day one, instead of sitting flat before the fund
// existed -- monthly contributions through the present for a full history.
(function () {
  const tickerId = 'demo-ticker-vwra';
  const tickers = [
    { id: tickerId, symbol: 'VWRA', label: 'Vanguard FTSE All-World UCITS ETF', note: '', created_at: '2019-08-15T00:00:00.000Z' },
  ];

  const AMOUNTS = [123, 456, 678, 999, 234, 567, 890, 111, 222, 333, 444, 555];
  const start = new Date(Date.UTC(2019, 7, 15)); // 2019-08-15, just after VWRA's 2019-07-31 inception
  const todayStr = new Date().toISOString().slice(0, 10);

  const buys = [];
  for (let i = 0; ; i++) {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + i);
    const iso = d.toISOString();
    const date = iso.slice(0, 10);
    if (date > todayStr) break;
    buys.push({
      id: `demo-buy-${i + 1}`,
      tickerId,
      date,
      amountUsd: AMOUNTS[i % AMOUNTS.length],
      note: '',
      created_at: iso,
    });
  }

  window.INVEST_DEMO_DATA = { tickers, buys };
})();
