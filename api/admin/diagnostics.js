import { eodhd } from '../lib/eodhd.js';

function isAuthorized(request) {
  const configured = process.env.ADMIN_DIAGNOSTIC_TOKEN;
  const supplied = request.headers['x-admin-diagnostic-token']
    || request.headers.authorization?.replace(/^Bearer\s+/i, '');
  return Boolean(configured && supplied && supplied === configured);
}

function summarize(label, payload) {
  const rows = Array.isArray(payload) ? payload : [payload];
  const latest = rows.at(-1) ?? {};
  return {
    label,
    ok: rows.length > 0,
    rowCount: rows.length,
    latestDate: latest.date ?? null,
    latestClose: latest.close ?? latest.adjusted_close ?? null,
    hasAdjustedClose: rows.some((row) => row.adjusted_close != null)
  };
}

export default async function handler(request, response) {
  if (!isAuthorized(request)) {
    return response.status(401).json({ error:'Unauthorized. Supply the configured admin diagnostic token.' });
  }
  try {
    const [six, eurChf] = await Promise.all([
      eodhd('/eod/NESN.SW', { from:'2024-01-01', period:'d', order:'a' }),
      eodhd('/eod/EURCHF.FOREX', { from:'2024-01-01', period:'d', order:'a' })
    ]);
    return response.status(200).json({
      ok:true,
      provider:'eodhd',
      checks:[
        summarize('SIX / NESN.SW', six),
        summarize('FX / EURCHF.FOREX', eurChf)
      ],
      note:'Token and upstream response bodies are intentionally omitted.'
    });
  } catch (error) {
    return response.status(error.message.startsWith('Missing') ? 503 : 502).json({
      ok:false,
      error:error.message,
      note:'Token and upstream response bodies are intentionally omitted.'
    });
  }
}
