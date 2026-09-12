const EODHD_BASE_URL = 'https://eodhd.com/api';

export const curatedUniverse = [
  { symbol:'CHSPI.SW', ticker:'CHSPI', name:'Swiss Performance ETF', type:'etf', market:'Switzerland', currency:'CHF', icon:'CH', iconClass:'swiss-icon' },
  { symbol:'CSSMI.SW', ticker:'CSSMI', name:'Swiss SMI ETF', type:'etf', market:'Switzerland', currency:'CHF', icon:'CH', iconClass:'swiss-icon' },
  { symbol:'IWCH.SW', ticker:'IWCH', name:'iShares MSCI World CHF Hdg', type:'etf', market:'Worldwide', currency:'CHF', icon:'W', iconClass:'world-icon' },
  { symbol:'VWRL.SW', ticker:'VWRL', name:'Vanguard FTSE All-World', type:'etf', market:'Worldwide', currency:'USD', icon:'W', iconClass:'world-icon' },
  { symbol:'NOVN.SW', ticker:'NOVN', name:'Novartis AG', type:'stock', market:'Switzerland', currency:'CHF', icon:'N', iconClass:'blue-icon' },
  { symbol:'NESN.SW', ticker:'NESN', name:'Nestlé SA', type:'stock', market:'Switzerland', currency:'CHF', icon:'N', iconClass:'red-icon' },
  { symbol:'SAP.XETRA', ticker:'SAP', name:'SAP SE', type:'stock', market:'Europe', currency:'EUR', icon:'S', iconClass:'blue-icon' },
  { symbol:'ASML.AMS', ticker:'ASML', name:'ASML Holding', type:'stock', market:'Europe', currency:'EUR', icon:'A', iconClass:'orange-icon' },
  { symbol:'AAPL.US', ticker:'AAPL', name:'Apple Inc.', type:'stock', market:'Worldwide', currency:'USD', icon:'A', iconClass:'dark-icon' },
  { symbol:'MSFT.US', ticker:'MSFT', name:'Microsoft Corp.', type:'stock', market:'Worldwide', currency:'USD', icon:'M', iconClass:'blue-icon' }
];

export function requireEodhdToken() {
  if (!process.env.EODHD_API_TOKEN) throw new Error('Missing EODHD_API_TOKEN. Add it to Vercel Environment Variables or .env.local.');
  return process.env.EODHD_API_TOKEN;
}

export async function eodhd(path, params = {}) {
  const token = requireEodhdToken();
  const url = new URL(`${EODHD_BASE_URL}${path}`);
  url.search = new URLSearchParams({ ...params, api_token:token, fmt:'json' });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`EODHD request failed (${response.status}).`);
  const payload = await response.json();
  if (payload?.error) throw new Error(`EODHD: ${payload.error}`);
  return payload;
}

function changePercent(today, previous) {
  return previous ? ((today - previous) / previous) * 100 : 0;
}

export function normalizeInstrument(meta, history) {
  const latest = history.at(-1) ?? {};
  const previous = history.at(-2) ?? latest;
  const high = Math.max(0, ...history.map((point) => Number(point.adjusted_close ?? point.close ?? 0)));
  return {
    ...meta,
    price:Number(latest.close ?? 0),
    change1d:changePercent(Number(latest.close ?? 0), Number(previous.close ?? 0)),
    chfReturn:changePercent(Number(latest.adjusted_close ?? latest.close ?? 0), Number(history[0]?.adjusted_close ?? history[0]?.close ?? 0)),
    high,
    rollingDecline:high ? ((Math.max(...history.slice(-30).map((point) => Number(point.adjusted_close ?? point.close ?? 0))) - Number(latest.adjusted_close ?? latest.close ?? 0)) / Math.max(...history.slice(-30).map((point) => Number(point.adjusted_close ?? point.close ?? 0)))) * 100 : 0
  };
}

export async function getInstrumentHistory(meta, from = '2020-01-01') {
  return eodhd(`/eod/${meta.symbol}`, { from, period:'d', order:'a' });
}
