/**
 * Categoria de Base U-20 — infra, olheiros, elenco separado do profissional.
 */

import { getStructureLevel, estimatePlayerWage, estimateStaffBill, getBalance, spend } from './economy.js';
import { generatePlayer, GENERIC_SQUAD_ROLES } from './player-generation.js';
import { rollPotential, POT_CAPS } from './player-development.js';
import { ensurePlayerId } from './player-identity.js';
import { ensurePlayerContract, buildPlayerContract, syncPlayerWageFromContract, addCalendarMonths } from './player-contracts.js';
import { getRealClub } from './brazilian-clubs-by-uf.js';
import { bumpLegacyMeta, maybeRollLegacyYouthPlayer } from './youth-legacy-regen.js';
import { estimatePlayerValue } from './player-value.js';

export const YOUTH_STRUCTURE_UNLOCK = 3;
export const YOUTH_ROSTER_MAX = 15;
export const YOUTH_AGE_MIN = 15;
export const YOUTH_AGE_MAX = 20;
export const YOUTH_PROMOTION_MIN_AGE = 17;
export const YOUTH_WAGE_FACTOR = 0.45;
export const ACADEMY_MAX_LEVEL = 5;
export const SCOUTING_MAX_LEVEL = 3;

export const SCOUT_SLOTS_BY_DEPT = Object.freeze({ 0: 0, 1: 1, 2: 2, 3: 3 });
/** % da comissão técnica/rodada por classe do olheiro (A mais caro). */
export const SCOUT_STAFF_SHARE_BY_GRADE = Object.freeze({ A: 0.16, B: 0.12, C: 0.1, D: 0.08 });
export const SCOUT_SHARE_A = 0.16;
/** Piso: classe A = 35% da comissão; demais classes proporcionais. */
export const SCOUT_FLOOR_COMMISSION_RATIO = 0.35;
export const SCOUT_DEPT_MULT = Object.freeze({ 1: 1, 2: 1.1, 3: 1.2 });
/** +20% de manutenção enquanto o olheiro está em missão. */
export const SCOUT_MISSION_MAINTENANCE_MULT = 1.2;
/** Entressafra / sem calendário ativo: 20% da manutenção normal. */
export const SCOUT_OFFSEASON_MAINTENANCE_MULT = 0.2;
export const SCOUT_TRAVEL_BASE_BY_DIVISION = Object.freeze({
  A: 38_000,
  B: 24_000,
  C: 16_000,
  D: 11_000,
});
export const SCOUT_TRAVEL_BAND_MULT = Object.freeze({
  same: 0.4,
  neighbor: 0.7,
  distant: 1,
  extreme: 1.25,
});
export const INTAKE_BY_ACADEMY = Object.freeze([1, 2, 3, 4, 5, 6]);

export const ACADEMY_UPGRADE = Object.freeze({
  baseCost: 2_000_000,
  costPerLevel: 500_000,
});

export const SCOUTING_UPGRADE = Object.freeze({
  baseCost: 800_000,
  costPerLevel: [1_400_000, 2_200_000],
});

export const YOUTH_SIGNING_SHARE = 0.06;
export const YOUTH_SIGNING_MIN_BY_DIVISION = Object.freeze({
  A: 60_000,
  B: 40_000,
  C: 25_000,
  D: 15_000,
});

export const SCOUT_LOCK_MONTHS = 6;
/** Relatório de consulta do olheiro expira após 3 semanas (tempo de jogo). */
export const SCOUT_REPORT_RETENTION_DAYS = 21;
export const SCOUT_GRADES = Object.freeze(['A', 'B', 'C', 'D']);

/** Chance de cada classe ao contratar/liberar olheiro (por nível do dept.). */
export const SCOUT_GRADE_ODDS_BY_DEPT = Object.freeze({
  1: Object.freeze([
    { grade: 'A', weight: 5 },
    { grade: 'B', weight: 15 },
    { grade: 'C', weight: 45 },
    { grade: 'D', weight: 35 },
  ]),
  2: Object.freeze([
    { grade: 'A', weight: 12 },
    { grade: 'B', weight: 28 },
    { grade: 'C', weight: 40 },
    { grade: 'D', weight: 20 },
  ]),
  3: Object.freeze([
    { grade: 'A', weight: 22 },
    { grade: 'B', weight: 38 },
    { grade: 'C', weight: 30 },
    { grade: 'D', weight: 10 },
  ]),
});

/** Quantidade de talentos por missão — pesos relativos (somam 100 por classe). */
export const SCOUT_TALENT_COUNT_ODDS = Object.freeze({
  A: Object.freeze([
    { count: 0, weight: 5 },
    { count: 1, weight: 25 },
    { count: 2, weight: 45 },
    { count: 3, weight: 25 },
  ]),
  B: Object.freeze([
    { count: 0, weight: 12 },
    { count: 1, weight: 38 },
    { count: 2, weight: 35 },
    { count: 3, weight: 15 },
  ]),
  C: Object.freeze([
    { count: 0, weight: 28 },
    { count: 1, weight: 42 },
    { count: 2, weight: 22 },
    { count: 3, weight: 8 },
  ]),
  D: Object.freeze([
    { count: 0, weight: 45 },
    { count: 1, weight: 35 },
    { count: 2, weight: 15 },
    { count: 3, weight: 5 },
  ]),
});

/** Estrelas do talento encontrado (somam 100 por classe). */
export const SCOUT_TALENT_STAR_ODDS = Object.freeze({
  A: Object.freeze([
    { stars: 1, weight: 5 },
    { stars: 2, weight: 15 },
    { stars: 3, weight: 35 },
    { stars: 4, weight: 30 },
    { stars: 5, weight: 15 },
  ]),
  B: Object.freeze([
    { stars: 1, weight: 10 },
    { stars: 2, weight: 25 },
    { stars: 3, weight: 35 },
    { stars: 4, weight: 22 },
    { stars: 5, weight: 8 },
  ]),
  C: Object.freeze([
    { stars: 1, weight: 20 },
    { stars: 2, weight: 30 },
    { stars: 3, weight: 30 },
    { stars: 4, weight: 15 },
    { stars: 5, weight: 5 },
  ]),
  D: Object.freeze([
    { stars: 1, weight: 35 },
    { stars: 2, weight: 35 },
    { stars: 3, weight: 20 },
    { stars: 4, weight: 8 },
    { stars: 5, weight: 2 },
  ]),
});

/** Potencial alvo por faixa de estrelas (ratio do teto da divisão). */
const STAR_TARGET_RATIO = Object.freeze([0.12, 0.3, 0.475, 0.635, 0.82]);

export const SCOUT_REGIONS = Object.freeze([
  { id: 'sul', label: 'Sul' },
  { id: 'sudeste', label: 'Sudeste' },
  { id: 'centro-oeste', label: 'Centro-Oeste' },
  { id: 'norte', label: 'Norte' },
  { id: 'nordeste', label: 'Nordeste' },
]);

export const REGION_UFS = Object.freeze({
  sul: ['PR', 'RS', 'SC'],
  sudeste: ['ES', 'MG', 'RJ', 'SP'],
  'centro-oeste': ['DF', 'GO', 'MS', 'MT'],
  norte: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
  nordeste: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
});

const SCOUT_TRAVEL_NEIGHBOR_KEYS = new Set([
  'centro-oeste|nordeste',
  'centro-oeste|norte',
  'centro-oeste|sudeste',
  'centro-oeste|sul',
  'nordeste|norte',
  'nordeste|sudeste',
  'sudeste|sul',
]);

const SCOUT_NAME_POOL = Object.freeze([
  'Marcos Oliveira',
  'Paulo Henrique',
  'Rafael Costa',
  'Diego Almeida',
  'Lucas Ferreira',
  'Bruno Santos',
  'Felipe Rocha',
  'Gustavo Lima',
  'André Mendes',
  'Thiago Barbosa',
]);
const YOUTH_ROLES = ['GOL', 'ZAG', 'ZAG', 'LAT', 'LAT', 'VOL', 'MC', 'MC', 'MEI', 'PE', 'PD', 'ATA', 'ATA', 'ATA'];
const STAR_THRESHOLDS = [0.2, 0.4, 0.55, 0.72, 0.88];

export function isYouthAcademyUnlocked(club) {
  return getStructureLevel(club) >= YOUTH_STRUCTURE_UNLOCK;
}

/** Elenco U-20 contratado + talentos em relatórios de olheiro (ainda não contratados). */
export function clubHasYouthTrainingTargets(club) {
  if (!club || typeof club !== 'object') return false;
  ensureYouthState(club);
  if (!isYouthAcademyUnlocked(club)) return false;
  const signed = (club.youthRoster || []).length;
  const scouting = (club.scoutReports || []).filter(r => r?.player).length;
  return signed + scouting > 0;
}

/** Jogadores da base que recebem treino foco Juvenis (mutável in-place). */
export function collectYouthTrainingPlayers(club) {
  if (!club || typeof club !== 'object') return [];
  ensureYouthState(club);
  const players = [];
  (club.youthRoster || []).forEach((player, index) => {
    if (!player || typeof player !== 'object') return;
    ensurePlayerId(player, { club: 'youth', index });
    if (!Number.isFinite(Number(player.fatigue))) player.fatigue = 100;
    players.push(player);
  });
  (club.scoutReports || []).forEach((report, index) => {
    if (!report?.player || typeof report.player !== 'object') return;
    const hydrated = hydrateYouthPlayer(report.player, { index: `scout-${index}` });
    if (!hydrated) return;
    report.player = hydrated;
    if (!Number.isFinite(Number(hydrated.fatigue))) hydrated.fatigue = 100;
    players.push(hydrated);
  });
  return players;
}

export function ensureYouthState(club) {
  if (!club || typeof club !== 'object') return club;
  if (!Array.isArray(club.youthRoster)) club.youthRoster = [];
  if (!Array.isArray(club.scouts)) club.scouts = [];
  if (!Array.isArray(club.scoutReports)) club.scoutReports = [];
  if (!Number.isFinite(Number(club.youthAcademyLevel))) club.youthAcademyLevel = 0;
  if (!Number.isFinite(Number(club.scoutingDeptLevel))) club.scoutingDeptLevel = 0;
  club.youthAcademyLevel = Math.max(0, Math.min(ACADEMY_MAX_LEVEL, Math.round(Number(club.youthAcademyLevel))));
  club.scoutingDeptLevel = Math.max(0, Math.min(SCOUTING_MAX_LEVEL, Math.round(Number(club.scoutingDeptLevel))));
  return club;
}

export function getAcademyLevel(club) {
  ensureYouthState(club);
  return club.youthAcademyLevel;
}

export function getScoutingDeptLevel(club) {
  ensureYouthState(club);
  return club.scoutingDeptLevel;
}

/** Nível operacional: dept. pago ou olheiro básico incluso ao desbloquear a base. */
export function getEffectiveScoutingLevel(club) {
  ensureYouthState(club);
  const dept = club.scoutingDeptLevel;
  if (dept > 0) return dept;
  if (isYouthAcademyUnlocked(club) || club.youthAcademyLevel >= 1) return 1;
  return 0;
}

export function getScoutSlotCount(club) {
  return SCOUT_SLOTS_BY_DEPT[getEffectiveScoutingLevel(club)] || 0;
}

export function academyUpgradeCost(level) {
  const lv = Math.max(0, Math.min(ACADEMY_MAX_LEVEL - 1, Number(level) || 0));
  return ACADEMY_UPGRADE.baseCost + lv * ACADEMY_UPGRADE.costPerLevel;
}

export function scoutingUpgradeCost(level) {
  const lv = Math.max(0, Math.min(SCOUTING_MAX_LEVEL - 1, Number(level) || 0));
  if (lv <= 0) return SCOUTING_UPGRADE.baseCost;
  const step = SCOUTING_UPGRADE.costPerLevel[Math.min(lv - 1, SCOUTING_UPGRADE.costPerLevel.length - 1)];
  return step;
}

export function youthSlotsUsed(club) {
  ensureYouthState(club);
  return club.youthRoster.length;
}

export function youthSlotsFree(club) {
  return Math.max(0, YOUTH_ROSTER_MAX - youthSlotsUsed(club));
}

export function resolveClubUf(club, clubName, fallbackUf = 'SP') {
  return getRealClub(clubName)?.uf || club?.uf || fallbackUf || 'SP';
}

export function youthStarRating(player, division = 'A') {
  const ovr = Number(player?.overall) || 50;
  const pot = Number(player?.potential) || ovr;
  const cap = POT_CAPS[division] ?? POT_CAPS.D;
  const room = Math.max(1, cap - ovr);
  const ratio = clamp((pot - ovr) / room, 0, 1.15);
  let stars = 1;
  for (let i = STAR_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (ratio >= STAR_THRESHOLDS[i]) {
      stars = i + 1;
      break;
    }
  }
  if (player?.craque) stars = 5;
  else if (player?.destaque && stars < 4) stars = 4;
  return Math.max(1, Math.min(5, stars));
}

export function starsMarkup(count) {
  const n = Math.max(0, Math.min(5, Number(count) || 0));
  const filled = '★'.repeat(n);
  const empty = '☆'.repeat(5 - n);
  if (!empty) return `<span class="youth-stars" aria-label="${n} de 5 estrelas">${filled}</span>`;
  if (!filled) return `<span class="youth-stars" aria-label="${n} de 5 estrelas"><span class="star-empty">${empty}</span></span>`;
  return `<span class="youth-stars" aria-label="${n} de 5 estrelas">${filled}<span class="star-empty">${empty}</span></span>`;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function rollYouthAge(random = Math.random) {
  const r = random();
  if (r < 0.45) return 16;
  if (r < 0.75) return 17;
  if (r < 0.92) return 15;
  return 18;
}

function pickYouthRole(random = Math.random) {
  return YOUTH_ROLES[Math.floor(random() * YOUTH_ROLES.length)] || 'MC';
}

export function computeYouthWage(player, division = 'A') {
  return Math.max(100, Math.round(estimatePlayerWage(player, division) * YOUTH_WAGE_FACTOR));
}

export function estimateYouthWageBill(club, division = club?.division || 'A') {
  ensureYouthState(club);
  return club.youthRoster.reduce((sum, p) => sum + computeYouthWage(p, division), 0);
}

export function regionForUf(uf) {
  return inferRegionFromUf(uf);
}

export function resolveClubHomeRegion(club, clubName, fallbackUf = 'SP') {
  return regionForUf(resolveClubUf(club, clubName, fallbackUf));
}

function scoutGradeShare(grade) {
  const key = scoutGradeLabel(grade);
  return SCOUT_STAFF_SHARE_BY_GRADE[key] ?? SCOUT_STAFF_SHARE_BY_GRADE.D;
}

function scoutFloorShare(gradeShare) {
  return SCOUT_FLOOR_COMMISSION_RATIO * (gradeShare / SCOUT_SHARE_A);
}

/** Manutenção de um olheiro por rodada (% comissão + piso 35% proporcional). */
export function computeScoutSlotRoundCost(
  staffBillPerRound,
  grade = 'D',
  deptLevel = 1,
  { onMission = false, offSeason = false } = {},
) {
  const staff = Math.max(0, Math.round(Number(staffBillPerRound) || 0));
  if (!(staff > 0)) return 0;
  const gradeShare = scoutGradeShare(grade);
  const deptMult = SCOUT_DEPT_MULT[deptLevel] ?? SCOUT_DEPT_MULT[1];
  const nominal = staff * gradeShare * deptMult;
  const floor = staff * scoutFloorShare(gradeShare);
  let cost = Math.max(nominal, floor);
  if (onMission) cost *= SCOUT_MISSION_MAINTENANCE_MULT;
  if (offSeason) cost *= SCOUT_OFFSEASON_MAINTENANCE_MULT;
  return Math.round(cost);
}

export function resolveScoutTravelBand(originRegion, targetRegion) {
  const origin = String(originRegion || '').toLowerCase();
  const target = String(targetRegion || '').toLowerCase();
  if (!origin || !target) return 'distant';
  if (origin === target) return 'same';
  const pair = [origin, target].sort().join('|');
  if (SCOUT_TRAVEL_NEIGHBOR_KEYS.has(pair)) return 'neighbor';
  if (
    (origin === 'sul' && (target === 'norte' || target === 'nordeste')) ||
    (target === 'sul' && (origin === 'norte' || origin === 'nordeste'))
  ) {
    return 'extreme';
  }
  return 'distant';
}

export function estimateScoutTravelCost(
  club,
  targetRegion,
  { division = club?.division || 'A', clubName = '', userUf = null } = {},
) {
  const origin = resolveClubHomeRegion(club, clubName, userUf || resolveClubUf(club, clubName));
  const band = resolveScoutTravelBand(origin, targetRegion);
  const base = SCOUT_TRAVEL_BASE_BY_DIVISION[division] ?? SCOUT_TRAVEL_BASE_BY_DIVISION.D;
  const mult = SCOUT_TRAVEL_BAND_MULT[band] ?? SCOUT_TRAVEL_BAND_MULT.distant;
  return Math.round(base * mult);
}

export function estimateScoutStaffBill(
  club,
  {
    division = club?.division || 'A',
    staffBill = null,
    careerDate = null,
    offSeason = false,
    staffOptions = {},
  } = {},
) {
  ensureYouthState(club);
  const dept = getEffectiveScoutingLevel(club);
  if (dept <= 0) return 0;
  const staff = staffBill ?? estimateStaffBill(club, division, staffOptions);
  if (!(staff > 0)) return 0;
  let total = 0;
  club.scouts.forEach(slot => {
    if (!slot?.scoutName && !slot?.region && !slot?.lockedUntil) return;
    const onMission = careerDate ? isScoutLocked(slot, careerDate) : !!slot?.lockedUntil;
    total += computeScoutSlotRoundCost(staff, scoutGradeLabel(slot.scoutGrade), dept, {
      onMission,
      offSeason,
    });
  });
  return total;
}

export function scoutReportStarError(deptLevel) {
  if (deptLevel >= 2) return 1;
  if (deptLevel >= 1) return 1;
  return 2;
}

export function scoutGradeStarError(grade) {
  if (grade === 'A') return 0;
  if (grade === 'B') return 1;
  if (grade === 'C') return 1;
  return 2;
}

function rollFromWeights(entries, random = Math.random) {
  if (!entries?.length) return null;
  const total = entries.reduce((sum, row) => sum + Math.max(0, Number(row.weight) || 0), 0);
  if (total <= 0) return entries[0];
  let roll = random() * total;
  for (const entry of entries) {
    roll -= Math.max(0, Number(entry.weight) || 0);
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1];
}

export function rollScoutGrade(deptLevel = 1, random = Math.random) {
  const table = SCOUT_GRADE_ODDS_BY_DEPT[deptLevel] || SCOUT_GRADE_ODDS_BY_DEPT[1];
  return rollFromWeights(table, random)?.grade || 'D';
}

export function rollScoutTalentCount(scoutGrade = 'D', random = Math.random) {
  const grade = SCOUT_TALENT_COUNT_ODDS[scoutGrade] ? scoutGrade : 'D';
  const row = rollFromWeights(SCOUT_TALENT_COUNT_ODDS[grade], random);
  return Math.max(0, Math.min(3, Number(row?.count) || 0));
}

export function rollScoutedTalentStars(scoutGrade = 'D', random = Math.random) {
  const grade = SCOUT_TALENT_STAR_ODDS[scoutGrade] ? scoutGrade : 'D';
  const row = rollFromWeights(SCOUT_TALENT_STAR_ODDS[grade], random);
  return Math.max(1, Math.min(5, Number(row?.stars) || 1));
}

/** Ajusta potencial/flags do jovem para bater a faixa de estrelas sorteada. */
export function applyTalentStarProfile(player, targetStars, division = 'A') {
  if (!player) return player;
  const stars = Math.max(1, Math.min(5, Number(targetStars) || 1));
  const ovr = Number(player.overall) || 50;
  const cap = POT_CAPS[division] ?? POT_CAPS.D;
  const room = Math.max(1, cap - ovr);

  delete player.craque;
  delete player.destaque;

  if (stars >= 5) {
    player.craque = true;
    player.destaque = true;
    player.potential = clamp(Math.round(ovr + room * 0.95), ovr + 1, cap);
    return player;
  }

  if (stars >= 4) player.destaque = true;

  const ratio = STAR_TARGET_RATIO[stars - 1] ?? 0.3;
  player.potential = clamp(Math.round(ovr + room * ratio), ovr + (stars > 1 ? 1 : 0), cap);
  return player;
}

export function scoutGradeLabel(grade) {
  return SCOUT_GRADES.includes(grade) ? grade : 'D';
}

function applyYouthContract(player, division, careerDate) {
  const wage = computeYouthWage(player, division);
  player.wage = wage;
  player.contract = buildPlayerContract({
    signedDate: careerDate || new Date(),
    wagePerRound: wage,
  });
  syncPlayerWageFromContract(player);
  player.isYouth = true;
  player.youthCategory = 'U20';
  return player;
}

export function generateYouthPlayer({
  club,
  clubName,
  division = 'A',
  uf = null,
  random = Math.random,
  firstNames,
  lastNames,
} = {}) {
  const role = pickYouthRole(random);
  const clubPower = Number(club?.power) || ({ A: 58, B: 45, C: 32, D: 15 }[division] ?? 30);
  const player = generatePlayer({
    role,
    index: Math.floor(random() * 1000),
    clubPower: clubPower - intRange(random, 8, 14),
    division,
    random,
    firstNames,
    lastNames,
    starterBoost: false,
  });
  player.age = rollYouthAge(random);
  const potCap = POT_CAPS[division] ?? POT_CAPS.D;
  const academy = getAcademyLevel(club);
  const scout = getScoutingDeptLevel(club);
  const boost = academy * 0.04 + scout * 0.03;
  let potential = rollPotential(player.overall, player.age, division, random);
  potential = clamp(Math.round(potential + boost * (potCap - player.overall)), player.overall, potCap);
  if (random() < 0.02 + academy * 0.004 + scout * 0.006) {
    player.destaque = true;
    potential = clamp(potential + intRange(random, 2, 5), player.overall, potCap);
  }
  if (random() < 0.004 + academy * 0.002) {
    player.craque = true;
    player.destaque = true;
    potential = clamp(Math.max(potential, player.overall + 8), player.overall, potCap);
  }
  player.potential = potential;
  player.originUf = uf || resolveClubUf(club, clubName);
  player.fatigue = 100;
  ensurePlayerId(player, { club: clubName, index: Math.floor(random() * 1e6) });
  return player;
}

function intRange(random, lo, hi) {
  return lo + Math.floor(random() * (hi - lo + 1));
}

export function serializeYouthPlayer(player) {
  if (!player) return null;
  const copy = { ...player };
  delete copy.workload;
  delete copy.injuryHistory;
  return copy;
}

export function hydrateYouthPlayer(raw, context = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const player = { injuryHistory: [], workload: {}, ...raw, isYouth: true, youthCategory: 'U20' };
  ensurePlayerId(player, context);
  return player;
}

export function purchaseAcademyUpgrade(club) {
  ensureYouthState(club);
  if (!isYouthAcademyUnlocked(club)) return { ok: false, error: 'locked_structure' };
  const level = getAcademyLevel(club);
  if (level >= ACADEMY_MAX_LEVEL) return { ok: false, error: 'max_level', balance: getBalance(club) };
  const cost = academyUpgradeCost(level);
  const payment = spend(club, cost, {
    reason: 'upgrade:youth_academy',
    label: 'Categoria de Base',
    meta: { fromLevel: level, toLevel: level + 1 },
  });
  if (!payment.ok) return payment;
  club.youthAcademyLevel = level + 1;
  syncScoutSlots(club);
  return { ok: true, balance: payment.balance, cost, level: club.youthAcademyLevel };
}

export function purchaseScoutingUpgrade(club) {
  ensureYouthState(club);
  if (!isYouthAcademyUnlocked(club)) return { ok: false, error: 'locked_structure' };
  const level = getScoutingDeptLevel(club);
  if (level >= SCOUTING_MAX_LEVEL) return { ok: false, error: 'max_level', balance: getBalance(club) };
  const cost = scoutingUpgradeCost(level);
  const payment = spend(club, cost, {
    reason: 'upgrade:scouting_dept',
    label: 'Departamento de Olheiros',
    meta: { fromLevel: level, toLevel: level + 1 },
  });
  if (!payment.ok) return payment;
  club.scoutingDeptLevel = level + 1;
  syncScoutSlots(club);
  return { ok: true, balance: payment.balance, cost, level: club.scoutingDeptLevel };
}

export function scoutRegionLabel(regionId) {
  return SCOUT_REGIONS.find(row => row.id === regionId)?.label || regionId || '—';
}

export function isValidScoutRegion(regionId) {
  return SCOUT_REGIONS.some(row => row.id === regionId);
}

export function pickUfFromRegion(regionId, random = Math.random) {
  const ufs = REGION_UFS[regionId] || [];
  if (!ufs.length) return 'SP';
  return ufs[Math.floor(random() * ufs.length)];
}

function normalizeCareerDate(careerDate) {
  if (typeof careerDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(careerDate)) {
    const d = new Date(`${careerDate}T12:00:00`);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  const d = careerDate instanceof Date ? new Date(careerDate) : new Date(careerDate);
  d.setHours(12, 0, 0, 0);
  return d;
}

function addCalendarDays(date, days) {
  const out = normalizeCareerDate(date);
  out.setDate(out.getDate() + (Number(days) || 0));
  return out;
}

function toDateKey(date) {
  const d = normalizeCareerDate(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function reportExpiresAt(careerDate) {
  return toDateKey(addCalendarDays(careerDate, SCOUT_REPORT_RETENTION_DAYS));
}

export function isScoutLocked(slot, careerDate = new Date()) {
  if (!slot?.lockedUntil) return false;
  const until = new Date(`${slot.lockedUntil}T12:00:00`);
  if (Number.isNaN(until.getTime())) return false;
  return normalizeCareerDate(careerDate).getTime() < until.getTime();
}

export function formatScoutLockDate(rawDate) {
  const d = rawDate instanceof Date ? rawDate : new Date(`${rawDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function ensureScoutIdentity(slot, club) {
  if (!slot.scoutId) slot.scoutId = `scout-${slot.slot}`;
  if (!slot.scoutName) {
    slot.scoutName = SCOUT_NAME_POOL[(slot.slot - 1) % SCOUT_NAME_POOL.length] || `Olheiro ${slot.slot}`;
  }
  if (!slot.scoutGrade) {
    const dept = getEffectiveScoutingLevel(club);
    slot.scoutGrade = rollScoutGrade(dept);
  } else {
    slot.scoutGrade = scoutGradeLabel(slot.scoutGrade);
  }
  if (slot.region == null && slot.regionUf) {
    slot.region = inferRegionFromUf(slot.regionUf);
  }
  return slot;
}

function inferRegionFromUf(uf) {
  const code = String(uf || '').toUpperCase();
  return Object.entries(REGION_UFS).find(([, ufs]) => ufs.includes(code))?.[0] || null;
}

export function listAvailableScouts(club, careerDate = new Date()) {
  ensureYouthState(club);
  syncScoutSlots(club);
  return club.scouts.filter(slot => !isScoutLocked(slot, careerDate));
}

export function syncScoutSlots(club) {
  ensureYouthState(club);
  const max = getScoutSlotCount(club);
  while (club.scouts.length < max) {
    const slot = { slot: club.scouts.length + 1, region: null, lockedUntil: null, scoutGrade: null };
    ensureScoutIdentity(slot, club);
    club.scouts.push(slot);
  }
  if (club.scouts.length > max) club.scouts = club.scouts.slice(0, max);
  club.scouts.forEach((s, i) => {
    s.slot = i + 1;
    ensureScoutIdentity(s, club);
  });
}

/** Compatibilidade — busca manual substitui geração automática. */
export function refreshScoutReportsIfDue() {
  return { generated: 0 };
}

function buildScoutMissionReportSummary({ slot, grade, region, talentCount, reports = [], lockedUntil, careerDate } = {}) {
  const name = slot?.scoutName || `Olheiro ${slot?.slot ?? '?'}`;
  const regionLabel = scoutRegionLabel(region) || region || '—';
  const lockLine = lockedUntil ? `\n\nOlheiro indisponível até ${formatScoutLockDate(lockedUntil)}.` : '';
  const createdAt = toDateKey(careerDate || new Date());
  const expiresAt = reportExpiresAt(careerDate || new Date());
  if (talentCount > 0) {
    const lines = reports.map(r => {
      const p = r.player || {};
      const stars = r.estimatedStars ?? '—';
      return `• ${p.name || '—'}, ${p.age ?? '—'} anos, ${p.pos || '—'} — ${stars} estrela(s) (estimativa)`;
    });
    return {
      region,
      regionLabel,
      talentCount,
      lockedUntil: lockedUntil || null,
      createdAt,
      expiresAt,
      summary: `${name} (Classe ${grade}) — busca na região ${regionLabel}.\n\nResultado: ${talentCount} talento${talentCount === 1 ? '' : 's'} encontrado${talentCount === 1 ? '' : 's'}:\n\n${lines.join('\n')}${lockLine}`,
    };
  }
  return {
    region,
    regionLabel,
    talentCount: 0,
    lockedUntil: lockedUntil || null,
    createdAt,
    expiresAt,
    summary: `${name} (Classe ${grade}) — busca na região ${regionLabel}.\n\nResultado: nenhum talento encontrado.${lockLine}`,
  };
}

/** Remove relatórios de consulta e captação expirados (3 semanas). */
export function purgeExpiredScoutReports(club, careerDate = new Date()) {
  ensureYouthState(club);
  const today = normalizeCareerDate(careerDate).getTime();
  let purgedLogs = 0;
  club.scouts.forEach(slot => {
    const exp = slot.lastMissionReport?.expiresAt;
    if (exp && normalizeCareerDate(exp).getTime() <= today) {
      slot.lastMissionReport = null;
      purgedLogs += 1;
    }
  });
  const before = club.scoutReports.length;
  club.scoutReports = club.scoutReports.filter(r => {
    if (!r.expiresAt) return true;
    return normalizeCareerDate(r.expiresAt).getTime() > today;
  });
  return { purgedLogs, purgedReports: before - club.scoutReports.length };
}

/** Texto do relatório de missão para modal (pendentes ou última missão). */
export function formatScoutReportBody(club, slot, careerDate = new Date()) {
  purgeExpiredScoutReports(club, careerDate);
  if (!slot) return 'Olheiro não encontrado.';
  const pending = (club.scoutReports || []).filter(r => Number(r.scoutSlot) === Number(slot.slot));
  if (pending.length) {
    const grade = scoutGradeLabel(pending[0].scoutGrade || slot.scoutGrade);
    const name = slot.scoutName || pending[0].scoutName || `Olheiro ${slot.slot}`;
    const region = scoutRegionLabel(pending[0].originRegion) || pending[0].originUf || '—';
    const lines = pending.map(r => {
      const p = r.player || {};
      const stars = r.estimatedStars ?? '—';
      const confidence = r.confidence ? `, confiança ${r.confidence}` : '';
      const legacyLine = p.legacyOf?.retiredName
        ? ` · LEGADO (${p.legacyOf.retiredName})`
        : '';
      return `• ${p.name || '—'}, ${p.age ?? '—'} anos, ${p.pos || '—'} — ${stars} estrela(s) (estimativa${confidence})${legacyLine}`;
    });
    const lockLine = isScoutLocked(slot) && slot.lockedUntil
      ? `\n\nOlheiro em missão até ${formatScoutLockDate(slot.lockedUntil)}.`
      : '';
    return `${name} (Classe ${grade}) — busca na região ${region}.\n\nResultado: ${pending.length} talento${pending.length === 1 ? '' : 's'} encontrado${pending.length === 1 ? '' : 's'}:\n\n${lines.join('\n')}${lockLine}`;
  }
  if (slot.lastMissionReport?.summary) return slot.lastMissionReport.summary;
  return 'Este olheiro ainda não realizou buscas de captação.';
}

function buildScoutReport({
  club,
  clubName,
  division = 'A',
  region,
  scoutSlot,
  season,
  careerDate,
  random = Math.random,
  firstNames,
  lastNames,
  userClub = null,
  retiredPool = null,
} = {}) {
  const dept = getEffectiveScoutingLevel(club);
  const grade = scoutGradeLabel(scoutSlot?.scoutGrade || 'D');
  const error = Math.min(scoutReportStarError(dept), scoutGradeStarError(grade));
  const uf = pickUfFromRegion(region, random);
  let player;
  const legacyResult = maybeRollLegacyYouthPlayer({
    club,
    clubName,
    division,
    uf,
    random,
    firstNames,
    lastNames,
    userClub,
    season,
    retiredPool,
    legacyMeta: club.youthLegacyMeta,
  });
  if (legacyResult?.player) {
    player = legacyResult.player;
    club.youthLegacyMeta = bumpLegacyMeta(club.youthLegacyMeta, season);
    if (Array.isArray(retiredPool) && legacyResult.legacyEntryId) {
      const row = retiredPool.find(entry => entry.id === legacyResult.legacyEntryId);
      if (row) row.regenUsed = true;
    }
  } else {
    player = generateYouthPlayer({ club, clubName, division, uf, random, firstNames, lastNames });
  }
  const trueStars = rollScoutedTalentStars(grade, random);
  applyTalentStarProfile(player, trueStars, division);
  const delta = error > 0 ? intRange(random, -error, error) : 0;
  const estimatedStars = clamp(trueStars + delta, 1, 5);
  const confidence =
    grade === 'A' ? 'Alta' : grade === 'B' ? 'Alta' : grade === 'C' ? 'Média' : 'Baixa';
  const createdAt = toDateKey(careerDate || new Date());
  return {
    id: `yr-${season ?? 'x'}-${Date.now()}-${Math.floor(random() * 1e6)}`,
    player: serializeYouthPlayer(player),
    trueStars,
    estimatedStars,
    confidence,
    originUf: uf,
    originRegion: region,
    scoutSlot: scoutSlot?.slot ?? null,
    scoutName: scoutSlot?.scoutName ?? null,
    scoutGrade: grade,
    season,
    createdAt,
    expiresAt: reportExpiresAt(careerDate || new Date()),
  };
}

/** Busca manual: região + olheiro → N relatórios (classe A–D); olheiro fica 6 meses em missão. */
export function runScoutSearch(club, { region, scoutSlot: slotIndex, clubName, careerDate, random = Math.random, ...context } = {}) {
  ensureYouthState(club);
  purgeExpiredScoutReports(club, careerDate || new Date());
  if (!isYouthAcademyUnlocked(club)) return { ok: false, error: 'locked_structure' };
  syncScoutSlots(club);
  if (!isValidScoutRegion(region)) return { ok: false, error: 'invalid_region' };
  const slot = club.scouts.find(row => row.slot === Number(slotIndex));
  if (!slot) return { ok: false, error: 'invalid_scout' };
  if (isScoutLocked(slot, careerDate)) {
    return { ok: false, error: 'scout_locked', lockedUntil: slot.lockedUntil };
  }

  const travelCost = estimateScoutTravelCost(club, region, {
    division: context.division || club.division || 'A',
    clubName,
    userUf: context.userUf,
  });
  if (travelCost > 0) {
    const originRegion = resolveClubHomeRegion(club, clubName, context.userUf);
    const payment = spend(club, travelCost, {
      reason: 'scout_travel',
      label: `Viagem olheiro · ${scoutRegionLabel(originRegion)} → ${scoutRegionLabel(region)}`,
      meta: { region, originRegion, scoutSlot: slot.slot, travelCost },
    });
    if (!payment.ok) {
      return { ok: false, error: 'insufficient_funds', travelCost, balance: getBalance(club) };
    }
  }

  const grade = scoutGradeLabel(slot.scoutGrade);
  const talentCount = rollScoutTalentCount(grade, random);
  if (!Array.isArray(club.scoutReports)) club.scoutReports = [];
  const reports = [];
  for (let i = 0; i < talentCount; i += 1) {
    reports.push(
      buildScoutReport({
        club,
        clubName,
        region,
        scoutSlot: slot,
        careerDate,
        random,
        ...context,
      }),
    );
  }
  club.scoutReports.push(...reports);

  const lockBase = normalizeCareerDate(careerDate || new Date());
  const lockedUntil = addCalendarMonths(lockBase, SCOUT_LOCK_MONTHS);
  slot.region = region;
  slot.lockedUntil = lockedUntil.toISOString().slice(0, 10);
  slot.lastMissionReport = buildScoutMissionReportSummary({
    slot,
    grade,
    region,
    talentCount,
    reports,
    lockedUntil: slot.lockedUntil,
    careerDate: lockBase,
  });

  return {
    ok: true,
    reports,
    talentCount,
    scoutGrade: grade,
    travelCost,
    player: reports[0]?.player || null,
    scoutName: slot.scoutName,
    lockedUntil: slot.lockedUntil,
  };
}

export function signScoutReport(club, reportId, context = {}) {
  ensureYouthState(club);
  if (youthSlotsFree(club) <= 0) return { ok: false, error: 'youth_full' };
  const idx = club.scoutReports.findIndex(r => r.id === reportId);
  if (idx < 0) return { ok: false, error: 'not_found' };
  const report = club.scoutReports[idx];
  const player = hydrateYouthPlayer(report.player, context);
  if (!player) return { ok: false, error: 'invalid_player' };
  const division = context.division || club.division || 'A';
  const formationCompensation = Math.max(
    YOUTH_SIGNING_MIN_BY_DIVISION[division] ?? YOUTH_SIGNING_MIN_BY_DIVISION.D,
    Math.round(estimatePlayerValue(player, division) * YOUTH_SIGNING_SHARE),
  );
  const payment = spend(club, formationCompensation, {
    reason: 'youth_signing',
    label: `Formação e assinatura · ${player.name || 'talento'}`,
    meta: { reportId, playerId: player.playerId, formationCompensation },
  });
  if (!payment.ok) {
    return {
      ok: false,
      error: 'insufficient_funds',
      cost: formationCompensation,
      balance: getBalance(club),
    };
  }
  applyYouthContract(player, division, context.careerDate);
  player.youthSignedDate = toDateKey(context.careerDate || new Date());
  club.youthRoster.push(player);
  club.scoutReports.splice(idx, 1);
  return { ok: true, player, cost: formationCompensation, balance: payment.balance };
}

export function dismissScoutReport(club, reportId) {
  ensureYouthState(club);
  const before = club.scoutReports.length;
  club.scoutReports = club.scoutReports.filter(r => r.id !== reportId);
  return { ok: club.scoutReports.length < before };
}

function runDirectIntake(club, clubName, count, context = {}) {
  let added = 0;
  for (let i = 0; i < count; i += 1) {
    if (youthSlotsFree(club) <= 0) break;
    const uf = resolveClubUf(club, clubName, context.userUf);
    const player = generateYouthPlayer({
      club,
      clubName,
      division: context.division || club.division || 'A',
      uf,
      random: context.random || Math.random,
      firstNames: context.firstNames,
      lastNames: context.lastNames,
    });
    applyYouthContract(player, context.division || club.division || 'A', context.careerDate);
    club.youthRoster.push(player);
    added += 1;
  }
  return added;
}

export function runSeasonYouthIntake(club, clubName, context = {}) {
  ensureYouthState(club);
  if (!isYouthAcademyUnlocked(club)) return { reports: 0, intake: 0 };
  const academy = getAcademyLevel(club);
  const totalQuota = INTAKE_BY_ACADEMY[academy] || 0;
  const isUser = !!context.isUserClub;
  const directCount = isUser ? 0 : totalQuota;
  const intake = runDirectIntake(club, clubName, directCount, context);
  return { reports: 0, intake, signedFromReports: 0 };
}

export function advanceYouthAges(club) {
  ensureYouthState(club);
  const released = [];
  club.youthRoster = club.youthRoster.filter(player => {
    player.age = Math.min(55, (Number(player.age) || 17) + 1);
    if (player.age > YOUTH_AGE_MAX) {
      released.push(player);
      return false;
    }
    return true;
  });
  return released;
}

export function releaseYouthPlayer(club, playerId) {
  ensureYouthState(club);
  const before = club.youthRoster.length;
  club.youthRoster = club.youthRoster.filter(p => p.playerId !== playerId);
  return { ok: club.youthRoster.length < before };
}

export function promoteYouthPlayer(club, playerId, context = {}) {
  ensureYouthState(club);
  const idx = club.youthRoster.findIndex(p => p.playerId === playerId);
  if (idx < 0) return { ok: false, error: 'not_found' };
  const player = club.youthRoster[idx];
  const age = Number(player.age) || 0;
  if (age < YOUTH_PROMOTION_MIN_AGE) return { ok: false, error: 'too_young' };

  const evaluate = context.evaluateRosterPayroll;
  if (typeof evaluate === 'function') {
    const wage = estimatePlayerWage(player, context.division || club.division || 'A');
    const gate = evaluate(club, {
      division: context.division,
      extraWage: wage,
      rosterDelta: 1,
      clubName: context.clubName,
      clubs: context.clubs,
    });
    if (!gate.ok) return { ok: false, error: gate.reason || 'roster_blocked', gate };
  }

  club.youthRoster.splice(idx, 1);
  delete player.isYouth;
  delete player.youthCategory;
  player.homegrown = true;
  player.promotedDate = toDateKey(context.careerDate || new Date());
  const fullWage = estimatePlayerWage(player, context.division || club.division || 'A');
  player.wage = fullWage;
  ensurePlayerContract(player, {
    division: context.division || club.division || 'A',
    careerDate: context.careerDate,
    season: context.season,
  });
  if (!Array.isArray(club.roster)) club.roster = [];
  club.roster.push(player);
  return { ok: true, player };
}

export function serializeYouthClubState(club) {
  ensureYouthState(club);
  return {
    youthAcademyLevel: club.youthAcademyLevel,
    scoutingDeptLevel: club.scoutingDeptLevel,
    youthReportsSeason: club.youthReportsSeason ?? null,
    scouts: club.scouts.map(s => ({
      slot: s.slot,
      scoutId: s.scoutId,
      scoutName: s.scoutName,
      scoutGrade: scoutGradeLabel(s.scoutGrade),
      region: s.region || null,
      lockedUntil: s.lockedUntil || null,
      lastMissionReport: s.lastMissionReport || null,
    })),
    youthLegacyMeta: club.youthLegacyMeta || null,
    youthRoster: club.youthRoster.map(serializeYouthPlayer).filter(Boolean),
    scoutReports: club.scoutReports.map(r => ({
      id: r.id,
      player: serializeYouthPlayer(r.player),
      trueStars: r.trueStars,
      estimatedStars: r.estimatedStars,
      confidence: r.confidence,
      originUf: r.originUf,
      originRegion: r.originRegion || null,
      scoutSlot: r.scoutSlot ?? null,
      scoutName: r.scoutName || null,
      scoutGrade: r.scoutGrade || null,
      season: r.season,
      createdAt: r.createdAt || null,
      expiresAt: r.expiresAt || null,
    })),
  };
}

export function applyYouthClubState(club, saved) {
  if (!club || !saved || typeof saved !== 'object') return false;
  ensureYouthState(club);
  if (Number.isFinite(Number(saved.youthAcademyLevel))) {
    club.youthAcademyLevel = Math.max(0, Math.min(ACADEMY_MAX_LEVEL, Math.round(Number(saved.youthAcademyLevel))));
  }
  if (Number.isFinite(Number(saved.scoutingDeptLevel))) {
    club.scoutingDeptLevel = Math.max(0, Math.min(SCOUTING_MAX_LEVEL, Math.round(Number(saved.scoutingDeptLevel))));
  }
  if (saved.youthReportsSeason != null) club.youthReportsSeason = saved.youthReportsSeason;
  if (Array.isArray(saved.scouts)) {
    club.scouts = saved.scouts.map(s => ({
      slot: s.slot,
      scoutId: s.scoutId || `scout-${s.slot}`,
      scoutName: s.scoutName || null,
      scoutGrade: s.scoutGrade ? scoutGradeLabel(s.scoutGrade) : null,
      region: s.region || inferRegionFromUf(s.regionUf) || null,
      lockedUntil: s.lockedUntil || null,
      lastMissionReport: s.lastMissionReport || null,
    }));
  }
  if (saved.youthLegacyMeta && typeof saved.youthLegacyMeta === 'object') {
    club.youthLegacyMeta = { ...saved.youthLegacyMeta };
  }
  if (Array.isArray(saved.youthRoster)) {
    club.youthRoster = saved.youthRoster.map((raw, index) => hydrateYouthPlayer(raw, { index })).filter(Boolean);
  }
  if (Array.isArray(saved.scoutReports)) {
    club.scoutReports = saved.scoutReports.map(r => ({
      ...r,
      player: hydrateYouthPlayer(r.player, {}),
    }));
  }
  syncScoutSlots(club);
  return true;
}

export function runYouthSeasonTransition(clubs, context = {}) {
  const summary = { aged: 0, released: 0, intakes: 0, reports: 0 };
  const season = Number(context.season) || null;
  Object.entries(clubs || {}).forEach(([clubName, club]) => {
    ensureYouthState(club);
    if (season) club.youthLegacyMeta = { season, count: 0 };
    if (!isYouthAcademyUnlocked(club)) return;
    const released = advanceYouthAges(club);
    summary.released += released.length;
    summary.aged += club.youthRoster.length;
    const isUserClub = clubName === context.userClub;
    const result = runSeasonYouthIntake(club, clubName, { ...context, isUserClub, clubName });
    summary.intakes += result.intake;
    summary.reports += result.reports;
  });
  return summary;
}

export const REGION_OPTIONS = SCOUT_REGIONS;
