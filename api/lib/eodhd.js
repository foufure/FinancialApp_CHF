const EODHD_BASE_URL = 'https://eodhd.com/api';

export const curatedUniverse = [
  { symbol:'CHSPI.SW', ticker:'CHSPI', name:'Swiss Performance ETF', type:'etf', market:'Switzerland', currency:'CHF', icon:'CH', iconClass:'swiss-icon' },
  { symbol:'CSSMI.SW', ticker:'CSSMI', name:'Swiss SMI ETF', type:'etf', market:'Switzerland', currency:'CHF', icon:'CH', iconClass:'swiss-icon' },
  { symbol:'CHDVD.SW', ticker:'CHDVD', isin:'CH0237935637', name:'iShares Swiss Dividend ETF (CH)', type:'etf', market:'Switzerland', currency:'CHF', icon:'CH', iconClass:'swiss-icon', dividend:{status:'Tracked',exDate:null,payDate:null,amount:null,yield:null} },
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

export async function searchEodhd(query) {
  return eodhd(`/search/${encodeURIComponent(query)}`);
}

const defaultExchanges = ['SW', 'XETRA', 'LSE', 'NASDAQ'];

function marketForExchange(exchange) {
  if (exchange === 'SW') return 'Switzerland';
  if (['XETRA', 'LSE', 'EURONEXT'].includes(exchange)) return 'Europe';
  return 'Worldwide';
}

export function normalizeDiscoveryMeta(raw, exchange = raw.Exchange ?? '') {
  const symbol = raw.symbol ?? raw.Code ?? raw.code;
  const name = raw.name ?? raw.Name ?? symbol;
  const rawType = String(raw.type ?? raw.Type ?? '').toLowerCase();
  const type = rawType.includes('etf') || /etf|fund|ucits/i.test(name) ? 'etf' : 'stock';
  const currency = String(raw.currency ?? raw.Currency ?? (exchange === 'SW' ? 'CHF' : '')).toUpperCase();
  if (!symbol || !name || !['stock', 'etf'].includes(type)) return null;
  return {
    symbol: symbol.includes('.') ? symbol : `${symbol}.${exchange}`,
    ticker: String(raw.ticker ?? raw.Code ?? symbol).split('.')[0],
    isin: raw.isin ?? raw.ISIN ?? null,
    name,
    type,
    market: marketForExchange(exchange),
    currency: currency || 'USD',
    chfHedged: /CHF\s*(Hdg|Hedged|Hedge)/i.test(name),
    icon: currency === 'CHF' ? 'CH' : marketForExchange(exchange) === 'Europe' ? 'E' : 'W',
    iconClass: currency === 'CHF' ? 'swiss-icon' : marketForExchange(exchange) === 'Europe' ? 'blue-icon' : 'world-icon'
  };
}

export function dedupeUniverse(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.isin ? `isin:${item.isin}` : `symbol:${item.symbol}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function filterDiscoveredUniverse(items, { type = 'all', market = 'all', chfOnly = false, hedgedOnly = false } = {}) {
  return items.filter((item) => (
    (type === 'all' || item.type === type) &&
    (market === 'all' || item.market === market) &&
    (!chfOnly || item.currency === 'CHF') &&
    (!hedgedOnly || item.chfHedged === true)
  ));
}

export function paginateUniverse(items, page = 0, limit = 24) {
  const size = Math.max(1, Math.min(Number(limit) || 24, 100));
  const offset = Math.max(0, Number(page) || 0) * size;
  return items.slice(offset, offset + size);
}

export async function discoverUniverse({ exchanges = defaultExchanges, query, limit = 24 } = {}) {
  const requests = exchanges.map(async (exchange) => {
    const rows = await eodhd(`/exchange-symbol-list/${encodeURIComponent(exchange)}`);
    if (!Array.isArray(rows)) throw new Error(`EODHD returned no symbol list for ${exchange}.`);
    return rows.slice(0, 500).map((row) => normalizeDiscoveryMeta(row, exchange)).filter(Boolean);
  });
  if (query) requests.push(searchEodhd(query).then((rows) => (Array.isArray(rows) ? rows.map((row) => normalizeDiscoveryMeta(row, row.Exchange ?? '')).filter(Boolean) : [])));
  const settled = await Promise.allSettled(requests);
  const warnings = settled.filter((result) => result.status === 'rejected').map((result) => result.reason.message);
  const items = dedupeUniverse(settled.filter((result) => result.status === 'fulfilled').flatMap((result) => result.value.slice(0, 125)));
  return { items: items.slice(0, Math.max(1, Math.min(Number(limit) || 24, 500))), warnings };
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
  const history = await eodhd(`/eod/${meta.symbol}`, { from, period:'d', order:'a' });
  if (!Array.isArray(history) || history.length === 0) throw new Error(`EODHD returned no daily history for ${meta.symbol}.`);
  return history;
}
