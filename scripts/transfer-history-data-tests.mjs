import {
  compactTransferDeals,
  mergeTransferDeals,
  recoverTransferDealsFromLedger,
} from '../js/engine/transfer-history-data.js';

let failed = 0;
const check = (condition, label) => {
  if (condition) console.log(`✓ ${label}`);
  else {
    failed += 1;
    console.error(`✗ ${label}`);
  }
};

const recovered = recoverTransferDealsFromLedger([
  { type: 'spend', reason: 'transfer', label: 'Contratação · Fábio Neves', amount: 800000, at: '2028-01-20T12:00:00.000Z', meta: { playerId: 'p1', from: 'Santa Cruz', to: 'Vinaz', fee: 800000 } },
  { type: 'credit', reason: 'transfer', label: 'Venda · Victor Reis', amount: 1200000, at: '2028-07-10T12:00:00.000Z', meta: { playerId: 'p2', from: 'Vinaz', to: 'Coritiba', fee: 1200000 } },
  { type: 'spend', reason: 'payroll', label: 'Folha', amount: 100000 },
], { userClub: 'Vinaz' });

check(recovered.length === 2, 'recupera compras e vendas do livro-caixa');
check(recovered[0].playerName === 'Fábio Neves', 'recupera nome pelo lançamento');
check(recovered[1].type === 'sell', 'identifica saída pelo crédito');

const merged = mergeTransferDeals(recovered, [{ ...recovered[0] }]);
check(merged.length === 2, 'remove negociações duplicadas');

const aiDeals = Array.from({ length: 10 }, (_, index) => ({
  playerName: `IA ${index}`,
  playerId: `ai-${index}`,
  from: 'Clube A',
  to: 'Clube B',
  fee: 100000 + index,
  type: 'ai_buy',
  round: index + 1,
}));
const compacted = compactTransferDeals([...recovered, ...aiDeals], { userClub: 'Vinaz', limit: 5 });
check(compacted.length === 7, 'aplica o limite somente às negociações da IA');
check(compacted.some(deal => deal.playerId === 'p1') && compacted.some(deal => deal.playerId === 'p2'), 'preserva negociações do usuário antes das negociações da IA');

const manyUserDeals = Array.from({ length: 180 }, (_, index) => ({
  playerName: `Jogador ${index}`,
  playerId: `user-${index}`,
  from: index % 2 ? 'Vinaz' : `Clube ${index}`,
  to: index % 2 ? `Clube ${index}` : 'Vinaz',
  fee: index + 1,
}));
const completeHistory = compactTransferDeals(manyUserDeals, { userClub: 'Vinaz', limit: 10 });
check(completeHistory.length === 180, 'mantém todas as transferências do clube acima do limite da IA');

if (failed) process.exit(1);
console.log('\nTransfer history data tests passed.');
