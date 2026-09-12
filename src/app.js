import { provider } from './data.js';
import { evaluateAlerts } from './alerts.js';
import { rankResearchCandidates } from './recommendations.js';

const money = (value, currency) => `${value.toLocaleString('en-CH',{minimumFractionDigits:2,maximumFractionDigits:2})} <span class="currency">${currency}</span>`;
const el = (id) => document.getElementById(id);
let allInstruments = [];

function instrumentRow(item) {
  const distance = Math.round((1 - item.price / item.high) * 100);
  const icon = `<span class="instrument-icon ${item.iconClass}">${item.icon}</span>`;
  return `<tr><td><div class="instrument">${icon}<div><strong>${item.ticker}</strong><small>${item.name}</small></div></div></td><td>${item.market}</td><td>${money(item.price,item.currency)}</td><td class="${item.change1d >= 0 ? 'positive':'negative'}">${item.change1d >= 0 ? '+':''}${item.change1d.toFixed(2)}%</td><td class="${item.chfReturn >= 0 ? 'positive':'negative'}">${item.chfReturn >= 0 ? '+':''}${item.chfReturn.toFixed(2)}% <span class="currency">CHF</span></td><td><div class="distance"><span class="distance-bar"><i style="width:${Math.min(distance*2.2,100)}%"></i></span><strong>${distance}%</strong></div></td><td class="row-menu">•••</td></tr>`;
}

function renderRows(target, items) { el(target).innerHTML = items.map(instrumentRow).join(''); }

function renderSupportingPanels() {
  const alerts = evaluateAlerts(allInstruments).slice(0,4);
  el('alert-list').innerHTML = alerts.map((alert) => {
    const icon = alert.kind === 'dividend' ? '₣' : alert.kind === 'rolling-decline' ? '%' : '↘';
    const klass = alert.kind === 'dividend' ? 'teal' : alert.kind === 'rolling-decline' ? 'orange' : 'purple';
    return `<div class="alert-row"><span class="rule-dot ${klass}">${icon}</span><div><strong>${alert.message}</strong><small>${alert.kind === 'dividend' ? 'Dividend status' : 'Price movement'} · ${alert.emailReady ? 'Email ready' : 'Dashboard only'}</small></div><span class="alert-time">${alert.createdAt}</span></div>`;
  }).join('');
  const dividends = allInstruments.filter((item) => item.dividend && item.currency === 'CHF').slice(0,3);
  el('dividend-list').innerHTML = dividends.map((item) => {
    const payDate = item.dividend.payDate ?? 'Date pending';
    const yieldText = item.dividend.yield == null ? 'Yield pending' : `${item.dividend.yield.toFixed(1)}% yield`;
    const amountText = item.dividend.amount == null ? 'Amount pending' : `CHF ${item.dividend.amount.toFixed(2)}`;
    return `<div class="dividend-row"><span class="rule-dot teal">₣</span><div><strong>${item.ticker} · ${item.dividend.status}</strong><small>Pay date ${payDate} · ${yieldText}</small></div><span class="dividend-amount">${amountText}</span></div>`;
  }).join('');
  document.querySelector('.alert-count').textContent = String(alerts.length);
}

function renderResearchCandidates() {
  const candidates = rankResearchCandidates(allInstruments);
  el('research-candidates').innerHTML = candidates.map(({ instrument, score, reasons, flagged }) => `<article class="candidate-card ${flagged ? 'candidate-flagged' : ''}"><div class="candidate-top"><div class="instrument"><span class="instrument-icon ${instrument.iconClass}">${instrument.icon}</span><div><strong>${instrument.ticker}</strong><small>${instrument.name}</small></div></div><span class="candidate-score">${score}/10</span></div><div class="candidate-chips">${reasons.map((reason) => `<span class="candidate-chip">${reason}</span>`).join('')}</div>${flagged ? '<p class="candidate-note">Research flag: unhedged non-CHF exposure; included for comparison, not CHF protection.</p>' : ''}</article>`).join('');
}

function showToast(message) {
  const toast = el('toast'); toast.textContent = message; toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function navigate(view) {
  document.querySelectorAll('.view').forEach((section) => section.classList.toggle('active-view', section.id === `${view}-view`));
  document.querySelectorAll('.nav-item[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  el('page-title').textContent = view === 'overview' ? 'Overview' : view[0].toUpperCase() + view.slice(1);
}

function setupInteractions() {
  document.querySelectorAll('.nav-item[data-view]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
  document.querySelectorAll('[data-view-target]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.viewTarget)));
  ['add-alert','add-alert-secondary','manage-alerts'].forEach((id) => el(id)?.addEventListener('click', () => { navigate('alerts'); showToast('Alert rules are active and email-ready.'); }));
  document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach((item) => item.classList.remove('active-filter')); button.classList.add('active-filter');
    const filter = button.dataset.filter; const items = filter === 'all' ? allInstruments : filter === 'chf' ? allInstruments.filter((item) => item.currency === 'CHF') : allInstruments.filter((item) => item.type === filter);
    renderRows('explore-rows', items);
  }));
  el('search-input').addEventListener('input', (event) => { const term = event.target.value.toLowerCase(); renderRows('explore-rows', allInstruments.filter((item) => `${item.ticker} ${item.name} ${item.market}`.toLowerCase().includes(term))); });
}

const start = async () => {
  try {
    allInstruments = await provider.getInstruments();
  } catch (error) {
    allInstruments = [];
    showToast(error.message);
  }
  renderRows('instrument-rows', allInstruments.slice(0,8));
  renderRows('explore-rows', allInstruments);
  renderRows('watchlist-rows', allInstruments.slice(0,8));
  renderSupportingPanels();
  renderResearchCandidates();
  setupInteractions();
};
start();
