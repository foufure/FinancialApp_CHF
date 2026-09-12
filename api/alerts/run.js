import { buildEmailAlertPayload, evaluateHistoricalAlerts } from '../../src/alerts.js';
import { curatedUniverse, getInstrumentHistory } from '../lib/eodhd.js';

function requireEmailConfig() {
  const missing = ['RESEND_API_KEY','ALERT_FROM_EMAIL','ALERT_TO_EMAIL'].filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing email configuration: ${missing.join(', ')}. Add these to Vercel Environment Variables or .env.local.`);
}

async function sendEmail(alert) {
  requireEmailConfig();
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type':'application/json'},
    body:JSON.stringify(buildEmailAlertPayload(alert, process.env.ALERT_TO_EMAIL, process.env.ALERT_FROM_EMAIL))
  });
  if (!response.ok) throw new Error(`Resend request failed (${response.status}).`);
}

export async function scanUniverse(universe, getHistory, windowDays) {
  const results = await Promise.allSettled(universe.map(async (meta) => ({
    meta,
    alerts: evaluateHistoricalAlerts(await getHistory(meta), { windowDays })
  })));
  const warnings = [];
  const findings = [];
  let successfulSymbols = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      successfulSymbols += 1;
      findings.push(...result.value.alerts.map((alert) => ({ ...alert, ticker:result.value.meta.ticker, name:result.value.meta.name })));
    } else {
      const message = result.reason?.message ?? 'Unknown market-data error.';
      if (message.startsWith('Missing')) throw result.reason;
      warnings.push(message);
    }
  }
  if (successfulSymbols === 0 && warnings.length > 0) throw new Error(`No curated instruments could be scanned. ${warnings.join(' ')}`);
  const uniqueFindings = [...new Map(findings.map((finding) => [`${finding.ticker}:${finding.kind}`, finding])).values()];
  return { findings:uniqueFindings, warnings };
}

export default async function handler(request, response) {
  try {
    requireEmailConfig();
    const windowDays = Number(new URL(request.url, 'http://localhost').searchParams.get('windowDays') ?? 30);
    const { findings, warnings } = await scanUniverse(curatedUniverse, getInstrumentHistory, windowDays);
    let sent = 0;
    for (const alert of findings) {
      await sendEmail({ ...alert, kind:alert.kind, ticker:alert.ticker, message:`${alert.name} (${alert.ticker}) triggered the ${alert.kind} alert.` });
      sent += 1;
    }
    response.status(200).json({ schedule:process.env.ALERT_SCHEDULE ?? 'daily', sent, findings, warnings });
  } catch (error) {
    response.status(error.message.startsWith('Missing') ? 503 : 502).json({ error:error.message });
  }
}
