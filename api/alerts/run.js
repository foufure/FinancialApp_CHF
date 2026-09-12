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

export default async function handler(request, response) {
  try {
    const windowDays = Number(new URL(request.url, 'http://localhost').searchParams.get('windowDays') ?? 30);
    const findings = [];
    for (const meta of curatedUniverse) {
      const history = await getInstrumentHistory(meta);
      const alerts = evaluateHistoricalAlerts(history, { windowDays });
      findings.push(...alerts.map((alert) => ({ ...alert, ticker:meta.ticker, name:meta.name })));
    }
    for (const alert of findings) await sendEmail({ ...alert, kind:alert.kind, ticker:alert.ticker, message:`${alert.name} (${alert.ticker}) triggered the ${alert.kind} alert.` });
    response.status(200).json({ schedule:process.env.ALERT_SCHEDULE ?? 'daily', sent:findings.length, findings });
  } catch (error) {
    response.status(error.message.startsWith('Missing') ? 503 : 502).json({ error:error.message });
  }
}
