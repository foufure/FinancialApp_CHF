/** @typedef {{kind:'high-discount'|'rolling-decline'|'dividend',ticker:string,message:string,createdAt:string,emailReady:boolean}} Alert */

/** Split-adjusted high discount rule. */
export function isBelowHistoricalHigh(instrument, threshold = 0.10) {
  return instrument.high > 0 && (instrument.high - instrument.price) / instrument.high >= threshold;
}

/** Supports a 1-day through 1-month provider-computed rolling decline. */
export function hasRollingDecline(instrument, threshold = 0.05) {
  return instrument.rollingDecline >= threshold * 100;
}

export function allTimeAdjustedClosingHigh(history) {
  return Math.max(0, ...history.map((point) => Number(point.adjusted_close ?? point.close ?? 0)));
}

export function highestCloseInWindow(history, windowDays) {
  const window = history.slice(-windowDays);
  return Math.max(0, ...window.map((point) => Number(point.adjusted_close ?? point.close ?? 0)));
}

export function evaluateHistoricalAlerts(history, settings = {}) {
  const current = history.at(-1);
  if (!current) return [];
  const highThreshold = settings.highDiscount ?? 0.10;
  const declineThreshold = settings.rollingDecline ?? 0.05;
  const windowDays = Math.min(30, Math.max(1, settings.windowDays ?? 30));
  const allTimeHigh = allTimeAdjustedClosingHigh(history);
  const recentHigh = highestCloseInWindow(history, windowDays);
  const alerts = [];
  if (allTimeHigh > 0 && (allTimeHigh - current.adjusted_close) / allTimeHigh >= highThreshold) alerts.push({kind:'high-discount', allTimeHigh, current:current.adjusted_close});
  if (recentHigh > 0 && (recentHigh - current.adjusted_close) / recentHigh >= declineThreshold) alerts.push({kind:'rolling-decline', windowDays, recentHigh, current:current.adjusted_close});
  return alerts;
}

export function hasDividendEvent(instrument) {
  return instrument.type === 'etf' && instrument.currency === 'CHF' && Boolean(instrument.dividend);
}

/** @returns {Alert[]} */
export function evaluateAlerts(instruments, settings = {}) {
  const highThreshold = settings.highDiscount ?? 0.10;
  const declineThreshold = settings.rollingDecline ?? 0.05;
  const alerts = [];
  for (const instrument of instruments) {
    if (isBelowHistoricalHigh(instrument, highThreshold)) alerts.push({kind:'high-discount',ticker:instrument.ticker,message:`${instrument.ticker} is ${Math.round((1 - instrument.price / instrument.high) * 100)}% below its historical high`,createdAt:'Now',emailReady:true});
    if (hasRollingDecline(instrument, declineThreshold)) alerts.push({kind:'rolling-decline',ticker:instrument.ticker,message:`${instrument.ticker} declined ${instrument.rollingDecline.toFixed(1)}% over the selected rolling period`,createdAt:'Now',emailReady:true});
    if (hasDividendEvent(instrument)) alerts.push({kind:'dividend',ticker:instrument.ticker,message:`${instrument.ticker} dividend ${instrument.dividend.status.toLowerCase()} · CHF ${instrument.dividend.amount.toFixed(2)}`,createdAt:instrument.dividend.payDate,emailReady:true});
  }
  return alerts;
}

export function buildEmailAlertPayload(alert, recipient, sender = 'alerts@example.com') {
  return {from:sender, to:recipient, subject:`Helvetia Markets alert · ${alert.ticker}`, text:alert.message, alertType:alert.kind, ready:true};
}
