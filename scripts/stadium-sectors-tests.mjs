/**
 * Estádio por setores v2.
 * node scripts/stadium-sectors-tests.mjs
 */
import {
  ensureStadiumSectors,
  computeSectorBreakdown,
  sectorSeats,
  effectiveSectorMax,
  canOfferStadiumNaming,
  migrateLegacyStadium,
  maxAchievableStadiumCapacity,
  DIVISION_CAPACITY_CAP,
  INITIAL_STADIUM_CAPACITY_RANGE,
  STADIUM_SECTOR_MODEL,
  normalizeTicketPrices,
  clampSectorTicketPrice,
  getSectorTicketPrice,
  weightedAverageTicketPrice,
  estimateGateReceiptSectors,
} from '../js/engine/stadium-sectors.js';
import {
  creditHomeGate,
  estimateGateReceipt,
  estimateMatchdayOperationCost,
  GATE_REVENUE_MODEL,
} from '../js/engine/economy.js';

let passed = 0;
let failed = 0;
const check = (label, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`✗ ${label}`);
    console.error(`  ${e.message}`);
  }
};
const assert = (c, m) => {
  if (!c) throw new Error(m || 'fail');
};

check('normalizeTicketPrices migra número legado para setores', () => {
  const prices = normalizeTicketPrices({ national: 22, cups: 36 });
  assert(typeof prices.national === 'object', 'national object');
  assert(typeof prices.national.popular === 'number', 'popular price');
  assert(prices.national.vip > prices.national.popular, 'vip > popular');
  assert(prices.cups.popular >= 18, 'cups popular min');
});

check('estimateGateReceiptSectors usa preço por setor', () => {
  const club = {
    division: 'A',
    environment: 70,
    support: 70,
    stadiumStructure: 3,
    stadiumSectors: { popular: 2, stands: 1, seats: 0, boxes: 0, vip: 0 },
    stadiumSectorModel: STADIUM_SECTOR_MODEL,
    ticketPrices: normalizeTicketPrices({ national: 22, cups: 36 }),
  };
  ensureStadiumSectors(club, 'A');
  const est = estimateGateReceiptSectors(club, { channel: 'national', gateScale: 1 });
  assert(est.revenue > 0, 'revenue');
  assert(est.sectors.length >= 2, 'sectors');
  assert(est.sectors.some(s => s.id === 'stands' && s.price > est.sectors.find(x => x.id === 'popular').price), 'stands price');
});

check('bilheteria = público × preço (sem escala oculta)', () => {
  const club = {
    division: 'D',
    environment: 70,
    support: 70,
    stadiumStructure: 0,
    stadiumSectors: { popular: 1, stands: 0, seats: 0, boxes: 0, vip: 0 },
    stadiumSectorModel: STADIUM_SECTOR_MODEL,
    ticketPrices: normalizeTicketPrices({ national: 24, cups: 32 }),
  };
  ensureStadiumSectors(club, 'D');
  const attendance = 4354;
  const price = 24;
  const est = estimateGateReceiptSectors(club, { channel: 'national', division: 'D', gateScale: 1 });
  const scaled = Math.round(est.revenue * (attendance / Math.max(1, est.attendance)));
  assert(Math.abs(scaled - attendance * price) <= est.sectors.length + 1, `expected ~${attendance * price}, got ${scaled}`);
});

check('economia credita bruto e debita operação em lançamentos separados', () => {
  const club = {
    name: 'Teste FC',
    division: 'D',
    budget: 300_000,
    environment: 70,
    support: 70,
    stadiumStructure: 0,
    stadiumSectors: { popular: 1, stands: 0, seats: 0, boxes: 0, vip: 0 },
    stadiumSectorModel: STADIUM_SECTOR_MODEL,
    ticketPrices: normalizeTicketPrices({ national: 24, cups: 32 }),
  };
  ensureStadiumSectors(club, 'D');
  const game = {
    home: club.name,
    away: 'Visitante',
    competition: 'LEAGUE',
    round: 1,
  };
  const before = club.budget;
  const estimate = estimateGateReceipt(club, { division: 'D', game });
  const result = creditHomeGate(club, game, { division: 'D' });
  assert(result.ok, result.error);
  assert(result.grossRevenue === estimate.revenue, 'crédito bruto divergente');
  assert(result.operationCost === estimate.operationCost, 'operação divergente');
  assert(club.budget === before + result.netRevenue, 'caixa não recebeu valor líquido');
  assert(game.gateRevenueModel === GATE_REVENUE_MODEL, 'modelo não persistido');
  assert(club.budgetLedger[0].reason === 'matchday_operations', 'despesa sem lançamento próprio');
  assert(club.budgetLedger[1].reason === 'gate_receipt', 'receita sem lançamento próprio');
});

check('custo operacional tem teto de 70% para preservar jogos pequenos', () => {
  const cost = estimateMatchdayOperationCost({ attendance: 500, revenue: 20_000 });
  assert(cost === 14_000, String(cost));
});

check('novo jogo: estrutura 0, popular 1, capacidade inicial A na faixa', () => {
  const club = { name: 'Teste FC', budget: 5_000_000, environment: 70, support: 70, ticketPrices: { national: 22, cups: 36 } };
  ensureStadiumSectors(club, 'A', { newGame: true });
  assert(club.stadiumStructure === 0, String(club.stadiumStructure));
  assert(club.stadiumSectors.popular === 1, JSON.stringify(club.stadiumSectors));
  const range = INITIAL_STADIUM_CAPACITY_RANGE.A;
  assert(club.stadiumCapacity >= range.min && club.stadiumCapacity <= range.max, String(club.stadiumCapacity));
  assert(club.stadiumInvestments === 0, String(club.stadiumInvestments));
});

check('arquibancada bloqueada sem estrutura 2', () => {
  const club = { stadiumStructure: 1, stadiumSectors: { popular: 1, stands: 0 }, stadiumSectorModel: STADIUM_SECTOR_MODEL };
  assert(effectiveSectorMax(club, 'A', 'stands') === 0, 'stands cap');
});

check('estrutura 2 libera arquibancada', () => {
  const club = { stadiumStructure: 2, stadiumSectors: { popular: 1, stands: 0 }, stadiumSectorModel: STADIUM_SECTOR_MODEL };
  assert(effectiveSectorMax(club, 'A', 'stands') === 3, String(effectiveSectorMax(club, 'A', 'stands')));
});

check('Série D: sem cadeiras', () => {
  const club = { stadiumStructure: 5, stadiumSectors: { popular: 2, stands: 1 }, stadiumSectorModel: STADIUM_SECTOR_MODEL };
  assert(effectiveSectorMax(club, 'D', 'seats') === 0, 'seats D');
  assert(effectiveSectorMax(club, 'D', 'stands') === 4, 'stands D');
});

check('Série C: cadeiras numeradas permanecem bloqueadas', () => {
  const club = {
    stadiumStructure: 5,
    stadiumSectors: { popular: 2, stands: 1, seats: 3 },
    stadiumSectorModel: STADIUM_SECTOR_MODEL,
  };
  ensureStadiumSectors(club, 'C');
  assert(effectiveSectorMax(club, 'C', 'seats') === 0, 'seats C');
  assert(club.stadiumSectors.seats === 0, 'remove cadeiras inválidas do save');
  assert(!computeSectorBreakdown(club, 'C').rows.some(row => row.id === 'seats'), 'não contabiliza cadeiras');
});

check('migração legado capacityLevel → setores', () => {
  const club = {
    stadiumCapacityLevel: 4,
    stadiumStructure: 3,
    pitchLevel: 3,
    stadiumCapacity: 50000,
  };
  migrateLegacyStadium(club, 'A');
  assert(club.stadiumSectorModel === STADIUM_SECTOR_MODEL, 'model');
  assert(club.stadiumSectors.popular >= 1, JSON.stringify(club.stadiumSectors));
  assert(club.stadiumCapacity > 0, String(club.stadiumCapacity));
});

check('naming: exige A/B, estrutura 2+, 2 investimentos', () => {
  const club = { stadiumStructure: 2, stadiumInvestments: 2, stadiumSectorModel: STADIUM_SECTOR_MODEL };
  assert(canOfferStadiumNaming(club, 'A'), 'A ok');
  assert(!canOfferStadiumNaming(club, 'C'), 'C no');
  club.stadiumInvestments = 1;
  assert(!canOfferStadiumNaming(club, 'A'), 'invest low');
});

check('composição: soma setores = capacidade', () => {
  const club = {
    stadiumStructure: 3,
    stadiumSectors: { popular: 2, stands: 1, seats: 0, boxes: 0, vip: 0 },
    stadiumSectorModel: STADIUM_SECTOR_MODEL,
  };
  ensureStadiumSectors(club, 'A');
  const { total, rows } = computeSectorBreakdown(club, 'A');
  const sum = rows.reduce((s, r) => s + r.seats, 0);
  assert(total === club.stadiumCapacity, `${total} vs ${club.stadiumCapacity}`);
  assert(sum === total, `${sum} vs ${total}`);
  assert(sectorSeats('popular', 2, 'A') > sectorSeats('popular', 1, 'A'), 'popular grow');
});

check('teto por divisão = capacidade máxima alcançável (limitado)', () => {
  const expectedMax = { A: 128_000, B: 79_000, C: 60_000, D: 38_000 };
  for (const division of ['A', 'B', 'C', 'D']) {
    const achievable = maxAchievableStadiumCapacity(division);
    assert(achievable > 0, `${division} max`);
    assert(achievable <= expectedMax[division], `${division} cap ${achievable}`);
    assert(achievable === DIVISION_CAPACITY_CAP[division], `${division} sync ${achievable}`);
  }
  assert(maxAchievableStadiumCapacity('A') >= 120_000, 'A max ~2× fantasy');
  assert(maxAchievableStadiumCapacity('B') >= 75_000, 'B max ~2× fantasy');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
