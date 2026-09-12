import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRollingDecline, isBelowHistoricalHigh, evaluateAlerts, buildEmailAlertPayload, allTimeAdjustedClosingHigh, highestCloseInWindow, evaluateHistoricalAlerts } from '../src/alerts.js';

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
