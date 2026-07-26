/**
 * Custos médicos v1 — tratamento conservador vs cirurgia.
 * node scripts/medical-costs-tests.mjs
 */
import {
  buildTreatmentOptions,
  computeTreatmentCost,
  computeTreatmentDays,
  computeTreatmentRecurrence,
  medicalClinicalBenefits,
  medicalCostMultipliers,
} from '../js/engine/medical-costs.js';

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
const assertEq = (a, b, m) => {
  if (a !== b) throw new Error(m || `expected ${b}, got ${a}`);
};

const club = (med = 0, division = 'A') => ({
  name: 'Lab FC',
  division,
  medicalInvestment: med,
  budget: 5_000_000,
});

const injury = (type, grade, days = 90, recurrenceRisk = 0.2) => ({
  type,
  grade,
  name: type,
  daysRemaining: days,
  totalDays: days,
  recurrenceRisk,
});

check('DM nível 3 aplica 15% + 6% extra cirurgia', () => {
  const m = medicalCostMultipliers(3);
  assertEq(m.discountPct, 15);
  assertEq(m.surgeryExtraPct, 6);
  assert(Math.abs(m.surgeryMult - 0.85 * 0.94) < 0.0001);
});

check('Série A ruptura isquio — custos base com DM 0', () => {
  const inj = injury('hamstring_rupture', 3);
  assertEq(computeTreatmentCost(inj, club(0, 'A'), 'A', 'conservative'), 180_000);
  assertEq(computeTreatmentCost(inj, club(0, 'A'), 'A', 'surgery'), 950_000);
});

check('Série D aplica piso e mult divisão', () => {
  const inj = injury('ankle_ligament_rupture', 3);
  const cons = computeTreatmentCost(inj, club(0, 'D'), 'D', 'conservative');
  const surg = computeTreatmentCost(inj, club(0, 'D'), 'D', 'surgery');
  assert(cons >= 25_000 && cons <= 120_000, 'conservador dentro do teto D');
  assert(surg >= 80_000 && surg <= 450_000, 'cirurgia dentro do teto D');
  assert(cons < 120_000, 'piso/teto D limitam valor');
});

check('DM reduz custo conservador', () => {
  const inj = injury('meniscus_injury', 2);
  const base = computeTreatmentCost(inj, club(0, 'A'), 'A', 'conservative');
  const discounted = computeTreatmentCost(inj, club(5, 'A'), 'A', 'conservative');
  assert(discounted < base, 'nível 5 deve baratear');
});

check('Tempo grave — cirurgia encurta e conservador alonga', () => {
  const inj = injury('hamstring_rupture', 3, 100);
  const surgDays = computeTreatmentDays(inj, club(0), 'surgery');
  const consDays = computeTreatmentDays(inj, club(0), 'conservative');
  assertEq(surgDays, 72);
  assertEq(consDays, 132);
});

check('Tempo mediano — menisco G2', () => {
  const inj = injury('meniscus_injury', 2, 50);
  assertEq(computeTreatmentDays(inj, club(0), 'surgery'), 39);
  assertEq(computeTreatmentDays(inj, club(0), 'conservative'), 61);
});

check('Recaída conservador +8% grave / +5% mediana', () => {
  const grave = injury('ankle_ligament_rupture', 3, 60, 0.2);
  const med = injury('meniscus_injury', 2, 40, 0.18);
  assertEq(computeTreatmentRecurrence(grave, club(0), 'conservative'), 0.28);
  assertEq(computeTreatmentRecurrence(med, club(0), 'conservative'), 0.23);
});

check('Cirurgia −5% recaída', () => {
  const inj = injury('hamstring_rupture', 3, 100, 0.28);
  assertEq(computeTreatmentRecurrence(inj, club(0), 'surgery'), 0.23);
});

check('Benefícios clínicos DM acumulam em L5', () => {
  const b = medicalClinicalBenefits(5);
  assertEq(b.dayReduction, 0.08);
  assertEq(b.surgeryDayReduction, 0.08);
  assertEq(b.recurrenceReduction, 0.13);
  assert(b.removeExamPending, 'L4+ remove examPending');
});

check('Opções completas expõem custo e dias', () => {
  const options = buildTreatmentOptions(injury('meniscus_injury', 3, 80), club(2, 'B'), 'B');
  assert(options.conservative.cost > 0);
  assert(options.surgery.cost > options.conservative.cost);
  assert(options.surgery.days < options.conservative.days);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
