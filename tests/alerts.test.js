import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRollingDecline, isBelowHistoricalHigh, evaluateAlerts, buildEmailAlertPayload, allTimeAdjustedClosingHigh, highestCloseInWindow, evaluateHistoricalAlerts } from '../src/alerts.js';
import { scanUniverse } from '../api/alerts/run.js';
import { curatedUniverse, dedupeUniverse, filterDiscoveredUniverse, normalizeDiscoveryMeta, paginateUniverse } from '../api/lib/eodhd.js';
import { rankResearchCandidates } from '../src/recommendations.js';

const instrument = {ticker:'TEST',name:'Test ETF',type:'etf',market:'Worldwide',currency:'CHF',price:90,high:100,rollingDecline:5,dividend:{status:'Declared',exDate:'1 Sep',payDate:'5 Sep',amount:.2,yield:2}};

test('detects split-adjusted historical high discount at threshold', () => {
  assert.equal(isBelowHistoricalHigh(instrument), true);
  assert.equal(isBelowHistoricalHigh({...instrument, price:90.01}), false);
});

test('detects configurable rolling decline', () => {
  assert.equal(hasRollingDecline(instrument), true);
  assert.equal(hasRollingDecline(instrument, .06), false);
});

test('evaluates all alert families and marks them email-ready', () => {
  const alerts = evaluateAlerts([instrument]);
  assert.deepEqual(alerts.map((alert) => alert.kind), ['high-discount','rolling-decline','dividend']);
  assert.equal(alerts.every((alert) => alert.emailReady), true);
  assert.equal(buildEmailAlertPayload(alerts[0], 'investor@example.com', 'alerts@example.com').from, 'alerts@example.com');
});

test('uses all-time and selected-window adjusted closing highs', () => {
  const history = [{adjusted_close:100},{adjusted_close:130},{adjusted_close:120},{adjusted_close:110}];
  assert.equal(allTimeAdjustedClosingHigh(history), 130);
  assert.equal(highestCloseInWindow(history, 2), 120);
  assert.deepEqual(evaluateHistoricalAlerts(history, {windowDays:2}).map((alert) => alert.kind), ['high-discount','rolling-decline']);
});

test('scans supported symbols when one curated symbol is unavailable', async () => {
  const history = [{adjusted_close:100},{adjusted_close:130},{adjusted_close:110}];
  const universe = [{ticker:'GOOD',name:'Supported'},{ticker:'MISSING',name:'Unavailable'}];
  const result = await scanUniverse(universe, async (meta) => {
    if (meta.ticker === 'MISSING') throw new Error('EODHD request failed (404).');
    return history;
  }, 30);
  assert.equal(result.findings[0].ticker, 'GOOD');
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /404/);
});

test('curates iShares Swiss Dividend ETF with ISIN and CHF dividend tracking', () => {
  const instrument = curatedUniverse.find((item) => item.ticker === 'CHDVD');
  assert.deepEqual(instrument, {
    symbol:'CHDVD.SW',
    ticker:'CHDVD',
    isin:'CH0237935637',
    name:'iShares Swiss Dividend ETF (CH)',
    type:'etf',
    market:'Switzerland',
    currency:'CHF',
    icon:'CH',
    iconClass:'swiss-icon',
    dividend:{status:'Tracked',exDate:null,payDate:null,amount:null,yield:null}
  });
});

test('ranks CHF-protected research candidates transparently and flags unhedged exposure', () => {
    const candidates = rankResearchCandidates([
      {ticker:'CHDVD',name:'iShares Swiss Dividend ETF (CH)',type:'etf',currency:'CHF',price:90,high:100,rollingDecline:6,chfReturn:1,change1d:1,dividend:{status:'Tracked'}},
      {ticker:'VWRL',name:'Vanguard FTSE All-World',type:'etf',currency:'USD',price:90,high:100,rollingDecline:6,chfReturn:1,change1d:1}
    ]);
    assert.equal(candidates[0].instrument.ticker, 'CHDVD');
    assert.equal(candidates[0].reasons.includes('CHF-denominated'), true);
    assert.equal(candidates[1].flagged, true);
    assert.match(candidates[1].reasons.at(-1), /Unhedged USD exposure/);
});

test('normalizes, deduplicates, and filters imported exchange records', () => {
  const rows = [
    normalizeDiscoveryMeta({Code:'CHDVD',Name:'iShares Swiss Dividend ETF',Type:'ETF',Currency:'CHF',ISIN:'CH0237935637'}, 'SW'),
    normalizeDiscoveryMeta({Code:'CHDVD',Name:'Duplicate listing',Type:'ETF',Currency:'CHF',ISIN:'CH0237935637'}, 'SW'),
    normalizeDiscoveryMeta({Code:'VWRL',Name:'Vanguard FTSE All-World',Type:'ETF',Currency:'USD'}, 'LSE'),
    normalizeDiscoveryMeta({Code:'NESN',Name:'Nestle SA',Type:'Common Stock',Currency:'CHF'}, 'SW')
  ];
  const deduped = dedupeUniverse(rows);
  assert.equal(deduped.length, 3);
  assert.equal(filterDiscoveredUniverse(deduped, { type:'etf', chfOnly:true }).length, 1);
  assert.equal(filterDiscoveredUniverse(deduped, { type:'stock', market:'Switzerland' })[0].ticker, 'NESN');
  assert.deepEqual(paginateUniverse(deduped, 1, 2).map((item) => item.ticker), ['NESN']);
});
