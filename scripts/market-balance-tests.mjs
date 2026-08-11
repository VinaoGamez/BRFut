import { ensurePlayerId } from '../js/engine/player-identity.js';
import { ensureMarketFields, estimatePlayerValue } from '../js/engine/player-value.js';
import { credit, estimatePlayerWage, spend } from '../js/engine/economy.js';
import {
  createTransfersEngine,
  estimateTransferAncillaryCosts,
  estimateTransferWageDemand,
} from '../js/engine/transfers.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const player = (id, overall, club, age = 28) =>
  ensureMarketFields(
    ensurePlayerId(
      { playerId: id, name: id, pos: 'MC', overall, potential: overall, age, reputation: 50 },
      { club, index: Number(id.replace(/\D/g, '')) || 1 },
    ),
    { division: 'D', season: 2026 },
  );

const club = (name, roster, budget = 2_700_000) => ({
  name,
  division: 'D',
  roster,
  budget,
  finances: 78,
  environment: 70,
  board: 70,
  support: 70,
  power: 18,
  stadiumCapacity: 8_000,
  sponsors: { total: 3_300_000, installments: 22 },
  tvRights: { total: 1_100_000, installments: 12 },
  budgetLedger: [],
});

const makeEngine = (clubs, userClub) => createTransfersEngine({
  getClubs: () => clubs,
  getUserClub: () => userClub,
  getCareerSeason: () => 2026,
  getCurrentRound: () => 1,
  getCareerDate: () => new Date(2026, 0, 20, 12),
  isMarketOpen: () => true,
  canAfford: (targetClub, amount) => Number(targetClub.budget) >= Number(amount),
  spend,
  credit,
});

const lowValue = estimatePlayerValue({ overall: 19, potential: 19, age: 28 }, 'D');
const highValue = estimatePlayerValue({ overall: 35, potential: 35, age: 28 }, 'D');
assert(highValue >= lowValue * 5, `OVR 35 deve valer muito mais: ${highValue}/${lowValue}`);

const lowWage = estimatePlayerWage({ overall: 19, age: 28, reputation: 50 }, 'D');
const highWage = estimateTransferWageDemand({ overall: 35, age: 28, reputation: 50 }, 'D', 'C');
assert(highWage >= lowWage * 3, `prêmio salarial insuficiente: ${highWage}/${lowWage}`);

const extras = estimateTransferAncillaryCosts({ fee: highValue, wage: highWage });
assert(extras.commission === Math.round(highValue * 0.05), 'comissão deve ser 5% do passe');
assert(extras.signingBonus === highWage * 2, 'luvas devem equivaler a duas rodadas de salário');

const userRoster = Array.from({ length: 18 }, (_, i) => player(`user-${i}`, 18 + (i % 2), 'Meu Clube'));
const sellers = {};
for (let i = 0; i < 11; i += 1) {
  const target = player(`target-${i}`, 35, `Vendedor ${i}`);
  sellers[`Vendedor ${i}`] = club(
    `Vendedor ${i}`,
    [target, ...Array.from({ length: 18 }, (_, j) => player(`seller-${i}-${j}`, 18, `Vendedor ${i}`))],
    1_000_000,
  );
}
const clubs = { 'Meu Clube': club('Meu Clube', userRoster), ...sellers };
const engine = makeEngine(clubs, 'Meu Clube');
const initialFinances = clubs['Meu Clube'].finances;
let bought = 0;
for (let i = 0; i < 11; i += 1) {
  const result = engine.buyPlayer(`target-${i}`);
  if (result.ok) bought += 1;
  else assert(
    result.reason === 'cannot_afford' || result.reason === 'payroll_pressure',
    `bloqueio inesperado: ${result.reason}`,
  );
}
assert(bought >= 5, `reformulação moderada deve permitir ao menos cinco reforços; comprou ${bought}`);
assert(bought < 11, 'sem vendas, o caixa não deve suportar onze reforços OVR 35');
assert(clubs['Meu Clube'].finances < initialFinances, 'compras devem reduzir saúde financeira');
assert(clubs['Meu Clube'].transferInstallments?.length === bought, 'cada compra deve gerar parcelamento');

const firstDebt = clubs['Meu Clube'].transferInstallments[0].balance;
const cashBeforeService = clubs['Meu Clube'].budget;
const service = engine.serviceTransferInstallments({ round: 1, season: 2026 });
assert(service.paid > 0, 'parcelas devem ser cobradas por rodada');
assert(clubs['Meu Clube'].budget < cashBeforeService, 'parcela deve reduzir o caixa');
assert(clubs['Meu Clube'].transferInstallments[0].balance < firstDebt, 'saldo parcelado deve cair');
const cashAfterService = clubs['Meu Clube'].budget;
const duplicateService = engine.serviceTransferInstallments({ round: 1, season: 2026 });
assert(duplicateService.paid === 0, 'a mesma rodada não pode cobrar a parcela duas vezes');
assert(clubs['Meu Clube'].budget === cashAfterService, 'cobrança deve ser idempotente por rodada');

// Reforma total: vender onze atletas antigos financia as entradas. A estratégia
// continua livre, mas deixa onze parcelas e uma folha muito mais cara.
const reformRoster = Array.from({ length: 18 }, (_, i) => player(`reform-user-${i}`, 18 + (i % 2), 'Reforma FC'));
const reformSellers = {};
for (let i = 0; i < 11; i += 1) {
  const target = player(`reform-target-${i}`, 35, `Reform Seller ${i}`);
  reformSellers[`Reform Seller ${i}`] = club(
    `Reform Seller ${i}`,
    [target, ...Array.from({ length: 18 }, (_, j) => player(`reform-seller-${i}-${j}`, 18, `Reform Seller ${i}`))],
    1_000_000,
  );
}
const reformClubs = { 'Reforma FC': club('Reforma FC', reformRoster), ...reformSellers };
const reformEngine = makeEngine(reformClubs, 'Reforma FC');
const sold = reformClubs['Reforma FC'].roster.splice(0, 11);
sold.forEach(oldPlayer => credit(
  reformClubs['Reforma FC'],
  Number(oldPlayer.marketValue) || lowValue,
  { reason: 'transfer' },
));
let reformBought = 0;
for (let i = 0; i < 11; i += 1) {
  const result = reformEngine.buyPlayer(`reform-target-${i}`);
  if (result.ok) reformBought += 1;
}
assert(reformBought === 11, `reforma total com vendas deve ser possível; comprou ${reformBought}/11`);
assert(reformClubs['Reforma FC'].transferInstallments.length === 11, 'reforma deve acumular onze obrigações futuras');

console.log('market balance ok', {
  lowValue,
  highValue,
  lowWage,
  highWage,
  ancillary: extras.total,
  bought,
  reformBought,
  cash: clubs['Meu Clube'].budget,
  finances: clubs['Meu Clube'].finances,
  installmentPaid: service.paid,
});
