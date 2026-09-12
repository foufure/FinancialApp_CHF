function isChfProtected(instrument) {
  return instrument.currency === 'CHF' || /CHF\s*(Hdg|Hedged|hedged)/i.test(instrument.name ?? '');
}

function drawdown(instrument) {
  return instrument.high > 0 ? Math.max(0, 1 - instrument.price / instrument.high) : 0;
}

export function rankResearchCandidates(instruments, limit = 6) {
  return instruments
    .map((instrument) => {
      const protectedCurrency = isChfProtected(instrument);
      const allTimeDrawdown = drawdown(instrument);
      const recentDecline = (instrument.rollingDecline ?? 0) / 100;
      const dataQuality = [instrument.price, instrument.high, instrument.chfReturn, instrument.change1d].every(Number.isFinite);
      const reasons = [];
      let score = 0;
      if (protectedCurrency) { score += 3; reasons.push(instrument.currency === 'CHF' ? 'CHF-denominated' : 'CHF-hedged'); }
      if (allTimeDrawdown >= 0.10) { score += 2; reasons.push(`${Math.round(allTimeDrawdown * 100)}% below all-time high`); }
      if (recentDecline >= 0.05) { score += 2; reasons.push(`${instrument.rollingDecline.toFixed(1)}% recent decline`); }
      if (instrument.dividend) { score += 1; reasons.push(`Dividend ${instrument.dividend.status.toLowerCase()}`); }
      if (instrument.type === 'etf') { score += 1; reasons.push('Diversified ETF'); }
      if (dataQuality) { score += 1; reasons.push('Complete quote data'); }
      const flagged = instrument.currency !== 'CHF' && !protectedCurrency;
      if (flagged) reasons.push(`Unhedged ${instrument.currency} exposure`);
      return { instrument, score, reasons, allTimeDrawdown, flagged };
    })
    .filter((candidate) => candidate.instrument.type === 'etf' || candidate.instrument.type === 'stock')
    .sort((a, b) => b.score - a.score || Number(a.flagged) - Number(b.flagged))
    .slice(0, limit);
}
