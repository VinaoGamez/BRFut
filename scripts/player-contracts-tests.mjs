/**
 * Contratos semestrais — node scripts/player-contracts-tests.mjs
 */
import {
  addCalendarMonths,
  buildPlayerContract,
  calendarDaysBetween,
  computeReleaseFee,
  computeRenewalWageAsk,
  ensurePlayerContract,
  isContractExpired,
  isInRenewalWindow,
  RENEWAL_WINDOW_DAYS_AFTER,
  RENEWAL_WINDOW_DAYS_BEFORE,
  SEMESTER_MONTHS,
  signSemesterContract,
  wageMonthlyFromRound,
} from '../js/engine/player-contracts.js';

let passed = 0;
let failed = 0;

const check = (label, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${label}`);
    console.error(`  ${error.message}`);
  }
};

const assert = (cond, message) => {
  if (!cond) throw new Error(message || 'assertion failed');
};

const player = (overrides = {}) => ({
  name: 'Teste Silva',
  playerId: 'p-test',
  pos: 'MC',
  age: 26,
  overall: 72,
  wage: 12_000,
  ...overrides,
});

check('semestre = +6 meses civis', () => {
  const signed = new Date(2026, 0, 15, 12, 0, 0, 0);
  const contract = buildPlayerContract({ signedDate: signed, wagePerRound: 10_000 });
  const expires = new Date(`${contract.expiresDate}T12:00:00`);
  assert(expires.getFullYear() === 2026 && expires.getMonth() === 6, 'deveria vencer em julho');
  assert(contract.term === 'semester', 'termo semestral');
});

check('migra save legado para contrato semestral', () => {
  const p = player({ contractUntil: 2029 });
  delete p.contract;
  ensurePlayerContract(p, { division: 'B', season: 2026, careerDate: new Date(2026, 2, 1) });
  assert(p.contract?.expiresDate, 'deveria criar contract');
  assert(p.contractUntil, 'alias legado contractUntil');
  assert(p.wage > 0, 'wage sincronizado');
});

check('janela de renovação 15d antes / 7d depois', () => {
  const signed = new Date(2026, 0, 1, 12, 0, 0, 0);
  const p = player();
  signSemesterContract(p, { signedDate: signed, wagePerRound: 8_000, division: 'A' });
  const expires = new Date(`${p.contract.expiresDate}T12:00:00`);
  const beforeWindow = new Date(expires);
  beforeWindow.setDate(beforeWindow.getDate() - (RENEWAL_WINDOW_DAYS_BEFORE + 5));
  assert(!isInRenewalWindow(p, beforeWindow), 'fora da janela cedo');
  const inWindow = new Date(expires);
  inWindow.setDate(inWindow.getDate() - 5);
  assert(isInRenewalWindow(p, inWindow), 'dentro da janela');
  const afterExpiry = new Date(expires);
  afterExpiry.setDate(afterExpiry.getDate() + RENEWAL_WINDOW_DAYS_AFTER);
  assert(isInRenewalWindow(p, afterExpiry), 'grace pós-vencimento');
});

check('expirado → multa zero na venda', () => {
  const p = player();
  signSemesterContract(p, { signedDate: new Date(2025, 0, 1), wagePerRound: 10_000, division: 'A' });
  const today = addCalendarMonths(new Date(2025, 0, 1), SEMESTER_MONTHS + 1);
  assert(isContractExpired(p, today), 'deveria estar expirado');
  assert(computeReleaseFee(p, 'A', today) === 0, 'sem multa');
});

check('contrato vigente → multa proporcional', () => {
  const signed = new Date(2026, 0, 1, 12, 0, 0, 0);
  const p = player();
  signSemesterContract(p, { signedDate: signed, wagePerRound: 10_000, division: 'A' });
  const mid = addCalendarMonths(signed, 3);
  const fee = computeReleaseFee(p, 'A', mid);
  assert(fee > 0, 'multa positiva');
  assert(fee < 10_000 * 20, 'multa dentro de teto razoável');
});

check('renovação pede mais se vigente e menos se expirado', () => {
  const p = player({ overall: 75, wage: 10_000 });
  signSemesterContract(p, { signedDate: new Date(2026, 0, 1), wagePerRound: 10_000, division: 'A' });
  const activeAsk = computeRenewalWageAsk(p, 'A', {
    careerDate: new Date(2026, 5, 20),
    expired: false,
  });
  const expiredAsk = computeRenewalWageAsk(p, 'A', {
    careerDate: addCalendarMonths(new Date(2026, 0, 1), 7),
    expired: true,
  });
  assert(activeAsk >= 10_000, 'pede mais ou igual');
  assert(expiredAsk <= activeAsk, 'expirado aceita menos');
});

check('salário mensal ≈ rodada × rodadas/12', () => {
  const monthly = wageMonthlyFromRound(12_000, 'A');
  assert(monthly === Math.round((12_000 * 38) / 12), 'fórmula Série A');
});

check('calendarDaysBetween simétrico', () => {
  const a = new Date(2026, 0, 1);
  const b = new Date(2026, 0, 31);
  assert(calendarDaysBetween(a, b) === 30, '30 dias');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
