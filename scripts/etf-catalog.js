// Shared ticker catalog (symbol + full name + liquidation status), sourced
// from the research done for etf-comparison.html. Single source of truth so
// other pages (e.g. invest.html) don't re-enter this data by hand.
window.ETF_CATALOG = [
  { symbol: 'VWRA', label: 'Vanguard FTSE All-World UCITS ETF' },
  { symbol: 'IWVL', label: 'iShares Edge MSCI World Value Factor UCITS ETF' },
  { symbol: 'XDEW', label: 'Xtrackers S&amp;P 500 Equal Weight UCITS ETF' },
  { symbol: 'VDVA', label: 'Vanguard Global Value Factor UCITS ETF', archived: true },
  { symbol: 'XUSE', label: 'iShares MSCI World ex-USA UCITS ETF' },
];
