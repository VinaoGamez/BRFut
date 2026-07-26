import { clamp } from '../ui/dom.js';

const DIVISION_COST_MULT = { D: 0.45, C: 0.65, B: 0.85, A: 1, REG: 0.45 };

const COST_BOUNDS = {
  D: { conservative: [25_000, 120_000], surgery: [80_000, 450_000] },
  C: { conservative: [35_000, 180_000], surgery: [120_000, 650_000] },
  B: { conservative: [50_000, 280_000], surgery: [200_000, 900_000] },
  A: { conservative: [80_000, 450_000], surgery: [350_000, 1_200_000] },
  REG: { conservative: [25_000, 120_000], surgery: [80_000, 450_000] },
};

/** Valores base em Série A antes de divisão e DM. */
const TREATMENT_BASE_COSTS = {
  hamstring_rupture: { 3: { conservative: 180_000, surgery: 950_000 } },
  ankle_ligament_rupture: { 3: { conservative: 120_000, surgery: 520_000 } },
  meniscus_injury: {
    2: { conservative: 95_000, surgery: 380_000 },
    3: { conservative: 140_000, surgery: 620_000 },
  },
};

const TIME_MULTIPLIERS = {
  grave: { surgery: 0.72, conservative: 1.32 },
  mediana: { surgery: 0.78, conservative: 1.22 },
};

const RECURRENCE_CHOICE_DELTA = {
  grave: { conservative: 0.08, surgery: -0.05 },
  mediana: { conservative: 0.05, surgery: -0.05 },
};

export function normalizeMedicalDivision(division = 'A') {
  const key = String(division || 'A').toUpperCase();
  return DIVISION_COST_MULT[key] != null ? key : 'A';
}

export function getMedicalLevel(club) {
  return clamp(Math.round(Number(club?.medicalInvestment) || 0), 0, 5);
}

export function medicalCostMultipliers(medLevel = 0) {
  const level = clamp(Math.round(Number(medLevel) || 0), 0, 5);
  const costMult = 1 - level * 0.05;
  const surgeryMult = costMult * (1 - level * 0.02);
  return { costMult, surgeryMult, discountPct: level * 5, surgeryExtraPct: level * 2 };
}

export function medicalDiscountPreview(medLevel = 0) {
  const { discountPct, surgeryExtraPct } = medicalCostMultipliers(medLevel);
  if (discountPct <= 0) return 'Sem desconto em tratamentos ainda.';
  const totalSurgery = discountPct + surgeryExtraPct;
  return `Desconto atual: ${discountPct}% no conservador · ${totalSurgery}% na cirurgia.`;
}

export function medicalClinicalBenefits(medLevel = 0) {
  const level = clamp(Math.round(Number(medLevel) || 0), 0, 5);
  let dayReduction = 0;
  let surgeryDayReduction = 0;
  let recurrenceReduction = 0;
  let removeExamPending = false;
  if (level >= 2) dayReduction += 0.03;
  if (level >= 3) recurrenceReduction += 0.05;
  if (level >= 4) {
    dayReduction += 0.05;
    removeExamPending = true;
  }
  if (level >= 5) {
    surgeryDayReduction += 0.08;
    recurrenceReduction += 0.08;
  }
  return { dayReduction, surgeryDayReduction, recurrenceReduction, removeExamPending };
}

export function injuryTreatmentBand(injury) {
  if (!injury) return null;
  const grade = Number(injury.grade) || 0;
  if (injury.type === 'meniscus_injury' && grade === 2) return 'mediana';
  if (
    grade >= 3 &&
    (injury.type === 'hamstring_rupture' ||
      injury.type === 'ankle_ligament_rupture' ||
      injury.type === 'meniscus_injury')
  ) {
    return 'grave';
  }
  return null;
}

function treatmentBaseCost(injury, choice) {
  const grade = Number(injury?.grade) || 0;
  const row = TREATMENT_BASE_COSTS[injury?.type]?.[grade];
  if (!row) return 0;
  return Math.max(0, Math.round(Number(row[choice === 'surgery' ? 'surgery' : 'conservative']) || 0));
}

export function computeTreatmentCost(injury, club, division = club?.division || 'A', choice = 'conservative') {
  const base = treatmentBaseCost(injury, choice);
  if (!base) return 0;
  const divKey = normalizeMedicalDivision(division);
  const divMult = DIVISION_COST_MULT[divKey] ?? 1;
  const medLevel = getMedicalLevel(club);
  const { costMult, surgeryMult } = medicalCostMultipliers(medLevel);
  const mult = choice === 'surgery' ? surgeryMult : costMult;
  const bounds = COST_BOUNDS[divKey] || COST_BOUNDS.A;
  const [floor, ceiling] = bounds[choice === 'surgery' ? 'surgery' : 'conservative'];
  return clamp(Math.round(base * divMult * mult), floor, ceiling);
}

function baselineDays(injury) {
  return Math.max(1, Math.round(Number(injury?.daysRemaining ?? injury?.totalDays) || 14));
}

export function computeTreatmentDays(injury, club, choice = 'conservative') {
  const band = injuryTreatmentBand(injury);
  if (!band) return baselineDays(injury);
  const mult = TIME_MULTIPLIERS[band][choice === 'surgery' ? 'surgery' : 'conservative'] ?? 1;
  let days = Math.max(1, Math.round(baselineDays(injury) * mult));
  const clinical = medicalClinicalBenefits(getMedicalLevel(club));
  const dayCut =
    choice === 'surgery'
      ? clinical.dayReduction + clinical.surgeryDayReduction
      : clinical.dayReduction;
  if (dayCut > 0) days = Math.max(1, Math.round(days * (1 - dayCut)));
  return days;
}

export function computeTreatmentRecurrence(injury, club, choice = 'conservative') {
  const base = Number(injury?.recurrenceRisk) || 0;
  const band = injuryTreatmentBand(injury);
  const delta = band ? RECURRENCE_CHOICE_DELTA[band][choice === 'surgery' ? 'surgery' : 'conservative'] ?? 0 : 0;
  const clinical = medicalClinicalBenefits(getMedicalLevel(club));
  const adjusted = base + delta - clinical.recurrenceReduction;
  return clamp(Number(adjusted.toFixed(3)), 0, 0.95);
}

export function computeTreatmentQuote(injury, club, division = club?.division || 'A', choice = 'conservative') {
  const band = injuryTreatmentBand(injury);
  const cost = computeTreatmentCost(injury, club, division, choice);
  const days = computeTreatmentDays(injury, club, choice);
  const recurrenceRisk = computeTreatmentRecurrence(injury, club, choice);
  const clinical = medicalClinicalBenefits(getMedicalLevel(club));
  return {
    choice,
    band,
    cost,
    days,
    recurrenceRisk,
    recurrenceDelta: band ? RECURRENCE_CHOICE_DELTA[band][choice === 'surgery' ? 'surgery' : 'conservative'] ?? 0 : 0,
    removeExamPending: clinical.removeExamPending,
    medLevel: getMedicalLevel(club),
  };
}

export function buildTreatmentOptions(injury, club, division = club?.division || 'A') {
  return {
    conservative: computeTreatmentQuote(injury, club, division, 'conservative'),
    surgery: computeTreatmentQuote(injury, club, division, 'surgery'),
  };
}

export function applyMedicalLevelClinicalEffects(injury, club, choice) {
  const quote = computeTreatmentQuote(injury, club, club?.division || 'A', choice);
  const adjusted = { ...injury };
  adjusted.treatment = choice === 'surgery' ? 'surgery' : 'conservative';
  adjusted.surgery = choice === 'surgery';
  adjusted.daysRemaining = quote.days;
  adjusted.totalDays = quote.days;
  adjusted.recurrenceRisk = quote.recurrenceRisk;
  adjusted.estimatedReturn = {
    minimumDays: Math.max(1, Math.round(quote.days * (choice === 'surgery' ? 0.82 : 0.85))),
    maximumDays: Math.max(
      quote.days,
      Math.round(quote.days * (choice === 'surgery' ? 1.15 : 1.2)),
    ),
  };
  if (quote.removeExamPending) adjusted.examPending = false;
  return adjusted;
}

export function treatmentLedgerReason(choice) {
  return choice === 'surgery' ? 'medical_surgery' : 'medical_conservative';
}

export function treatmentLedgerLabel(choice, playerName = '') {
  const who = playerName ? `${playerName}: ` : '';
  return choice === 'surgery' ? `${who}Cirurgia` : `${who}Tratamento conservador`;
}
