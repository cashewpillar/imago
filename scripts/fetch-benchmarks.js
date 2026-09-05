#!/usr/bin/env node
// Refreshes scripts/benchmarks-data.js with any new monthly data points since
// the last fetch, for each bundled benchmark source. Only requests the date
// range after the latest date already stored per source, so re-running this
// regularly stays cheap (a handful of new points, not a full re-fetch) --
// if a source has no new completed month yet, it's left untouched.
//
// Sources:
// - usdphp: Frankfurter API (https://frankfurter.dev), ECB reference rates,
//   USD->PHP daily rates, resampled here to one point per completed
//   calendar month (last available trading day).
// - phCpi: IMF SDMX API (https://api.imf.org), dataflow IMF.STA:CPI(5.0.0),
//   key PHL.CPI._T.IX.M (Philippines, all-items CPI, index level, monthly)
//   -- already one point per month, no resampling needed.
// - vwra: Yahoo Finance chart endpoint for VWRA.L, daily closes, resampled
//   here to one point per completed calendar month (last trading day).
//
// Usage: node scripts/fetch-benchmarks.js
//
// When new data lands, this also bumps `?v=N` in every consuming
// `<script src="scripts/benchmarks-data.js?v=N">` tag, so browsers that
// already cached the old file actually pick up the update (see this file's
// own header comment for why that matters).

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'scripts', 'benchmarks-data.js');
const CATALOG_PATH = path.join(ROOT, 'scripts', 'etf-catalog.js');
const CONSUMER_FILES = ['savings.html', 'expenses.html', 'performance.html', 'invest.html'];
const BACKFILL_START = '2000-01-01'; // Yahoo clamps to a fund's real inception automatically

const HEADER = fetchedDate => `// Historical benchmark series for performance.html / invest.html, fetched
// periodically (see scripts/fetch-benchmarks.js) and bundled as static data
// (no network calls at runtime) -- seeded into each consumer's own
// \`benchmarks\` IndexedDB table by a one-time per-source migration, same
// pattern as savings-demo.js.
//
// Sources (last refreshed ${fetchedDate}):
// - usdphp: Frankfurter API (https://frankfurter.dev), ECB reference rates,
//   USD->PHP, resampled to one point per month (last available trading day).
//   Free, no API key, no usage restrictions stated for this derived use.
// - phCpi: IMF Consumer Price Index dataset (https://data.imf.org/en/datasets/IMF.STA:CPI),
//   Philippines, all-items index (COICOP_1999=_T), monthly. Only available
//   from 2010-01 onward in this dataset -- earlier PH CPI history isn't
//   published here. (c) International Monetary Fund -- see imf.org/external/terms.htm.
// - one source per ticker in scripts/etf-catalog.js that has a \`yahooSymbol\`
//   (source key = that ticker's \`symbol\` lowercased, e.g. VWRA -> 'vwra'),
//   priced in USD, fetched from Yahoo Finance's chart endpoint and resampled
//   to one point per month. A ticker with no \`yahooSymbol\` in the catalog
//   (e.g. a liquidated fund) simply has no source here and no fetch is
//   attempted for it. Each is a raw price LEVEL (not a %), meant for a
//   rebased/indexed cumulative-growth comparison, or for invest.html's
//   per-ticker compounding -- not a yield/rate series.
//
// To refresh: run \`node scripts/fetch-benchmarks.js\` -- it fetches only new
// data since each source's last stored MONTH (re-checking that last month
// too, since e.g. CPI figures are commonly revised after first publication),
// merges it in, and bumps \`?v=N\` in the consuming <script> tags automatically
// when anything actually changed. A ticker newly added to
// scripts/etf-catalog.js with a \`yahooSymbol\` gets a full historical backfill
// the first time this runs. Values here are still a point-in-time snapshot,
// not a live feed.
//
// IMPORTANT: this file is loaded via a plain \`<script src="scripts/benchmarks-data.js?v=N">\`
// tag (savings.html, expenses.html, performance.html, invest.html) -- not the
// Date.now() cache-buster finance-charts.js uses, because seedBenchmarksIfNeeded()
// needs window.BENCHMARKS_DATA synchronously available, which a dynamically-
// injected (async-by-default) script tag can't guarantee.
`;

function loadSandboxed(filePath, globalName) {
  const src = fs.readFileSync(filePath, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: filePath });
  return sandbox.window[globalName];
}

function loadExisting() { return loadSandboxed(DATA_PATH, 'BENCHMARKS_DATA'); }

function loadTickerSources() {
  const catalog = loadSandboxed(CATALOG_PATH, 'ETF_CATALOG') || [];
  return new Map(
    catalog.filter(c => c.yahooSymbol).map(c => [c.symbol.toLowerCase(), c.yahooSymbol])
  );
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthKeyOf(dateStr) { return dateStr.slice(0, 7); }
function lastDate(points) { return points.length ? points[points.length - 1].date : null; }

function firstOfMonth(dateStr) { return monthKeyOf(dateStr) + '-01'; }

function monthEndDate(year, monthIndex0) {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).toISOString().slice(0, 10);
}

// Groups daily {date,value} points by completed calendar month (excludes the
// current, still-in-progress month) and keeps each month's LAST point -- the
// last available trading day, matching the bundle's existing convention.
function resampleMonthly(dailyPoints) {
  const curYm = monthKeyOf(todayStr());
  const byMonth = new Map();
  for (const p of dailyPoints) {
    const ym = monthKeyOf(p.date);
    if (ym >= curYm) continue;
    const existing = byMonth.get(ym);
    if (!existing || p.date > existing.date) byMonth.set(ym, p);
  }
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Merges by MONTH, not exact date. `newPoints` always covers the last
// stored month through today (see `from` in main()), so a fresh value for
// that last month OVERWRITES the stored one instead of being skipped as a
// duplicate -- sources like phCpi commonly publish a preliminary figure for
// the most recent month and revise it later, and a naive "only append
// strictly-after" merge would never pick that revision up. Anything older
// than the last stored month is never touched (we never fetch that far back).
function mergeNewMonthly(existingPoints, newPoints) {
  const newByMonth = new Map(newPoints.map(p => [monthKeyOf(p.date), p]));
  const kept = existingPoints.filter(p => !newByMonth.has(monthKeyOf(p.date)));
  const merged = [...kept, ...newPoints].sort((a, b) => a.date.localeCompare(b.date));

  const existingByMonth = new Map(existingPoints.map(p => [monthKeyOf(p.date), p]));
  const added = newPoints.filter(p => !existingByMonth.has(monthKeyOf(p.date)));
  const revised = newPoints.filter(p => {
    const old = existingByMonth.get(monthKeyOf(p.date));
    return old && (old.date !== p.date || old.value !== p.value);
  });
  return { merged, added, revised };
}

async function fetchYahooDaily(yahooSymbol, fromDate, toDate) {
  const period1 = Math.floor(new Date(fromDate + 'T00:00:00Z').getTime() / 1000);
  const period2 = Math.floor(new Date(toDate + 'T00:00:00Z').getTime() / 1000) + 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?period1=${period1}&period2=${period2}&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Yahoo Finance request failed for ${yahooSymbol}: ${res.status}`);
  const json = await res.json();
  const result = json.chart && json.chart.result && json.chart.result[0];
  if (!result) return [];
  const ts = result.timestamp || [];
  const closes = ((result.indicators || {}).quote || [])[0]?.close || [];
  const out = [];
  ts.forEach((t, i) => {
    const v = closes[i];
    if (v == null) return;
    // Round off Yahoo's raw float noise (e.g. 195.52000427246094) to match
    // the bundle's existing 2-decimal price convention.
    out.push({ date: new Date(t * 1000).toISOString().slice(0, 10), value: Math.round(v * 100) / 100 });
  });
  return out;
}

async function fetchUsdPhpDaily(fromDate, toDate) {
  const url = `https://api.frankfurter.dev/v1/${fromDate}..${toDate}?base=USD&symbols=PHP`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Frankfurter request failed: ${res.status}`);
  const json = await res.json();
  const rates = json.rates || {};
  return Object.entries(rates)
    .map(([date, r]) => ({ date, value: r.PHP }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchPhCpiMonthly(fromYm, toYm) {
  const url = `https://api.imf.org/external/sdmx/2.1/data/IMF.STA,CPI,5.0.0/PHL.CPI._T.IX.M?startPeriod=${fromYm}&endPeriod=${toYm}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IMF request failed: ${res.status}`);
  const xml = await res.text();
  const out = [];
  const re = /<Obs TIME_PERIOD="(\d{4})-M(\d{2})" OBS_VALUE="([\d.]+)"/g;
  let m;
  while ((m = re.exec(xml))) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    out.push({ date: monthEndDate(year, month), value: parseFloat(m[3]) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function formatSourceArray(points) {
  return points.map(p => `    { date: '${p.date}', value: ${p.value} },`).join('\n');
}

function rewriteDataFile(data, fetchedDate) {
  const body = `(function () {
  window.BENCHMARKS_DATA = {
${Object.entries(data).map(([source, points]) => `    ${source}: [\n${formatSourceArray(points)}\n    ],`).join('\n')}
  };
})();
`;
  fs.writeFileSync(DATA_PATH, HEADER(fetchedDate) + body);
}

function bumpConsumerVersions() {
  for (const file of CONSUMER_FILES) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    const next = content.replace(/benchmarks-data\.js\?v=(\d+)/g, (m, v) => `benchmarks-data.js?v=${parseInt(v, 10) + 1}`);
    if (next !== content) {
      fs.writeFileSync(filePath, next);
      console.log(`Bumped benchmarks-data.js?v= in ${file}`);
    }
  }
}

async function main() {
  const existing = loadExisting();
  const tickerSources = loadTickerSources();
  const today = todayStr();
  let anyAdded = false;
  const nextData = {};

  // Union of sources already in the data file and every catalog ticker that
  // has a yahooSymbol -- so a brand-new ticker (no existing entry yet) gets
  // picked up and fully backfilled, not just already-tracked sources refreshed.
  const allSources = [...new Set([...Object.keys(existing), ...tickerSources.keys()])];

  for (const source of allSources) {
    const existingPoints = existing[source] || [];
    const isNewSource = existingPoints.length === 0;
    // Re-fetches from the START of the last stored month (not the day after
    // it) so a since-revised figure for that month gets picked up -- see
    // mergeNewMonthly's comment. Cheap either way: this is at most a couple
    // of months of data, never the full history -- except a brand-new
    // source, which needs a one-time full backfill.
    const from = isNewSource ? BACKFILL_START : firstOfMonth(lastDate(existingPoints));

    let monthly = [];
    try {
      if (tickerSources.has(source)) {
        monthly = resampleMonthly(await fetchYahooDaily(tickerSources.get(source), from, today));
      } else if (source === 'usdphp') {
        monthly = resampleMonthly(await fetchUsdPhpDaily(from, today));
      } else if (source === 'phCpi') {
        monthly = await fetchPhCpiMonthly(monthKeyOf(from), monthKeyOf(today));
      } else {
        nextData[source] = existingPoints;
        console.log(`${source}: no fetcher configured for this source, left as-is`);
        continue;
      }
    } catch (err) {
      console.error(`${source}: fetch failed — ${err.message}`);
      nextData[source] = existingPoints;
      continue;
    }

    const { merged, added, revised } = mergeNewMonthly(existingPoints, monthly);
    nextData[source] = merged;

    if (added.length || revised.length) {
      anyAdded = true;
      if (added.length) console.log(`${source}: added ${added.length} new point(s) — ${added.map(p => p.date).join(', ')}`);
      if (revised.length) console.log(`${source}: revised ${revised.length} point(s) — ${revised.map(p => p.date).join(', ')}`);
    } else {
      console.log(`${source}: no new or revised data (checked ${from}..${today})`);
    }
  }

  if (!anyAdded) {
    console.log('\nNo new data — benchmarks-data.js left unchanged.');
    return;
  }

  rewriteDataFile(nextData, today);
  bumpConsumerVersions();
  console.log('\nUpdated scripts/benchmarks-data.js.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
