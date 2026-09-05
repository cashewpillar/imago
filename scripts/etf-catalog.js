// Shared ticker catalog (symbol + full name + liquidation status + Yahoo
// Finance symbol for price history), sourced from the research done for
// etf-comparison.html. Single source of truth so other pages (e.g.
// invest.html) and scripts/fetch-benchmarks.js don't re-enter this data by
// hand -- `yahooSymbol` is what fetch-benchmarks.js uses to pull real price
// history for a ticker; omit it (as VDVA does) for a liquidated fund with no
// price feed to fetch.
window.ETF_CATALOG = [
  { symbol: 'VWRA', label: 'Vanguard FTSE All-World UCITS ETF', yahooSymbol: 'VWRA.L' },
  { symbol: 'IWVL', label: 'iShares Edge MSCI World Value Factor UCITS ETF', yahooSymbol: 'IWVL.L' },
  { symbol: 'XDEW', label: 'Xtrackers S&amp;P 500 Equal Weight UCITS ETF', yahooSymbol: 'XDEW.L' },
  { symbol: 'VDVA', label: 'Vanguard Global Value Factor UCITS ETF', archived: true },
  { symbol: 'XUSE', label: 'iShares MSCI World ex-USA UCITS ETF', yahooSymbol: 'XUSE.L' },
];
