const clean = value => String(value || '').trim();

const dealKey = deal => [
  deal.playerId || clean(deal.playerName).toLocaleLowerCase('pt-BR'),
  clean(deal.from).toLocaleLowerCase('pt-BR'),
  clean(deal.to).toLocaleLowerCase('pt-BR'),
  Math.round(Number(deal.fee) || 0),
  deal.type || 'buy',
].join('|');

export function mergeTransferDeals(...groups) {
  const merged = new Map();
  groups.flat().filter(Boolean).forEach(deal => {
    const normalized = {
      playerName: clean(deal.playerName) || '—',
      playerId: deal.playerId || null,
      from: clean(deal.from) || null,
      to: clean(deal.to) || null,
      fee: Math.round(Number(deal.fee) || 0),
      type: deal.type || 'buy',
      at: deal.at || null,
      round: Number(deal.round) || 0,
    };
    if (!normalized.from || !normalized.to) return;
    const key = dealKey(normalized);
    const previous = merged.get(key);
    if (!previous || (!previous.at && normalized.at)) merged.set(key, normalized);
  });
  return [...merged.values()].sort((a, b) => {
    const time = String(a.at || '').localeCompare(String(b.at || ''));
    return time || (Number(a.round) || 0) - (Number(b.round) || 0);
  });
}

export function recoverTransferDealsFromLedger(
  ledger,
  { userClub, findPlayerName = () => null } = {},
) {
  const club = clean(userClub);
  if (!club) return [];
  return (Array.isArray(ledger) ? ledger : [])
    .filter(entry => entry?.reason === 'transfer' && entry.meta?.from && entry.meta?.to)
    .map(entry => {
      const meta = entry.meta || {};
      const labelName = clean(entry.label).split('·').slice(1).join('·').trim();
      return {
        playerName: clean(meta.playerName) || clean(findPlayerName(meta.playerId)) || labelName || '—',
        playerId: meta.playerId || null,
        from: meta.from,
        to: meta.to,
        fee: Number(meta.fee) || Number(entry.amount) || 0,
        type: meta.loanBuy ? 'loan_buy' : entry.type === 'credit' ? 'sell' : 'buy',
        at: entry.at || null,
        round: Number(meta.round) || 0,
      };
    })
    .filter(deal => deal.from === club || deal.to === club);
}

export function compactTransferDeals(deals, { userClub, limit = 160 } = {}) {
  const merged = mergeTransferDeals(deals);
  const cap = Math.max(1, Number(limit) || 160);
  const club = clean(userClub);
  const relevant = club
    ? merged.filter(deal => deal.from === club || deal.to === club)
    : [];
  const relevantKeys = new Set(relevant.map(dealKey));
  const market = merged.filter(deal => !relevantKeys.has(dealKey(deal)));
  // O histórico do clube do usuário é oficial e nunca deve ser truncado.
  // O limite controla apenas a memória usada pelas negociações entre clubes da IA.
  return mergeTransferDeals(market.slice(-cap), relevant);
}
