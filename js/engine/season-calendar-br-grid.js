/**
 * Grade semanal BR — simulação e resolução de dias por competição (molde CBF 2026).
 * Internacionais (LIB/CSU) registradas mas não materializadas in-game (enabled: false).
 */
import {
  FUTURE_COMPETITION_MOLD,
  LEAGUE_DIVISION_MOLD,
  RECOPA_NATIONAL_CALENDAR_SLOTS,
  RECOPA_SUDAMERICANA_CALENDAR_SLOTS,
} from './season-calendar-mold.js';
import {
  moldToDate,
  calendarAnchorYear,
  CALENDAR_CYCLE_YEARS,
  isWorldCupClubCalendarLocked,
  isClubCalendarBlackout,
  describeCalendarCycle,
  isCalendarAnchorYear,
} from './season-calendar-cycle.js';
import { buildWorldCupLockedDates } from './world-cup-calendar.js';
import {
  WEEKDAY,
  buildWeeklyCadenceDates,
  listSlotDatesInRange,
  pickSlotDatesEvenly,
  getCupLegWeekdays,
} from './season-week-slots.js';
import {
  createClubOccupancy,
  reserveClubDate,
  countRestConflicts,
  findAvailableSlotDate,
  clubsAvailable,
  DEFAULT_MIN_REST_DAYS,
  minimumMatchGapMs,
  windowToDates,
} from './season-scheduler.js';
import { buildCupPhaseNominalDates, seasonEndDate as planSeasonEndDate } from './season-calendar-plan.js';

export const BR_GRID_PHASE = Object.freeze({
  EST_ONLY: 'est_only',
  OVERLAP: 'overlap',
  NATIONAL_FULL: 'national_full',
});

/** Limites inclusive [mês 0-index, dia]. */
export const BR_GRID_PHASE_BOUNDS = Object.freeze({
  [BR_GRID_PHASE.EST_ONLY]: Object.freeze({ start: [0, 11], end: [0, 27] }),
  [BR_GRID_PHASE.OVERLAP]: Object.freeze({ start: [0, 28], end: [2, 8] }),
  [BR_GRID_PHASE.NATIONAL_FULL]: Object.freeze({ start: [2, 9], end: [11, 31] }),
});

/** 13 slots CONMEBOL — simulação / molde; competição desligada in-game. */
export const CONTINENTAL_CALENDAR_SLOTS = Object.freeze([
  Object.freeze({ month: 1, day: 5, weekday: WEEKDAY.THU }),
  Object.freeze({ month: 1, day: 26, weekday: WEEKDAY.THU }),
  Object.freeze({ month: 2, day: 19, weekday: WEEKDAY.THU }),
  Object.freeze({ month: 3, day: 9, weekday: WEEKDAY.WED }),
  Object.freeze({ month: 3, day: 30, weekday: WEEKDAY.THU }),
  Object.freeze({ month: 4, day: 21, weekday: WEEKDAY.THU }),
  Object.freeze({ month: 7, day: 6, weekday: WEEKDAY.THU }),
  Object.freeze({ month: 7, day: 27, weekday: WEEKDAY.THU }),
  Object.freeze({ month: 8, day: 17, weekday: WEEKDAY.WED }),
  Object.freeze({ month: 9, day: 8, weekday: WEEKDAY.THU }),
  Object.freeze({ month: 9, day: 29, weekday: WEEKDAY.THU }),
  Object.freeze({ month: 10, day: 19, weekday: WEEKDAY.WED }),
  Object.freeze({ month: 10, day: 26, weekday: WEEKDAY.THU }),
]);

export const CONTINENTAL_CM_PAUSE = Object.freeze({ start: [4, 1], end: [6, 22] });

function normalizeNoon(date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

function md(year, month, day) {
  return normalizeNoon(new Date(year, month, day));
}

function isInBand(date, band) {
  const d = normalizeNoon(date);
  const start = md(d.getFullYear(), band.start[0], band.start[1]);
  const end = md(d.getFullYear(), band.end[0], band.end[1]);
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

/** Fase do calendário BR para uma data. */
export function brGridPhaseForDate(date, seasonYear = 2026) {
  const year = Number(seasonYear) || 2026;
  const d = normalizeNoon(date);
  if (d.getFullYear() !== year) return BR_GRID_PHASE.NATIONAL_FULL;
  if (isInBand(d, BR_GRID_PHASE_BOUNDS[BR_GRID_PHASE.EST_ONLY])) return BR_GRID_PHASE.EST_ONLY;
  if (isInBand(d, BR_GRID_PHASE_BOUNDS[BR_GRID_PHASE.OVERLAP])) return BR_GRID_PHASE.OVERLAP;
  return BR_GRID_PHASE.NATIONAL_FULL;
}

/**
 * Dias da semana por competição na grade BR (fase-aware).
 * @returns {number[]}
 */
export function getBrGridWeekdays(competitionId, date, seasonYear = 2026) {
  const phase = brGridPhaseForDate(date, seasonYear);
  switch (competitionId) {
    case 'state_league':
      return phase === BR_GRID_PHASE.NATIONAL_FULL ? [] : [WEEKDAY.SUN];
    case 'league_a':
      if (phase === BR_GRID_PHASE.EST_ONLY) return [];
      if (phase === BR_GRID_PHASE.OVERLAP) return [WEEKDAY.WED];
      return [WEEKDAY.SUN];
    case 'league_b':
      if (phase === BR_GRID_PHASE.EST_ONLY) return [];
      if (phase === BR_GRID_PHASE.OVERLAP) return [WEEKDAY.SAT, WEEKDAY.MON];
      return [WEEKDAY.SAT];
    case 'league_c':
      return [WEEKDAY.TUE, WEEKDAY.FRI];
    case 'league_d':
    case 'serie_d_knockout':
      return [WEEKDAY.THU];
    case 'cup':
      return [WEEKDAY.WED];
    case 'recopa_national':
      return [WEEKDAY.SUN];
    case 'recopa_sudamericana':
      return [WEEKDAY.THU];
    case 'continental_conmebol':
    case 'libertadores':
    case 'sudamericana':
      return [WEEKDAY.WED, WEEKDAY.THU];
    default:
      return [WEEKDAY.SUN];
  }
}

function slotDate(year, slot) {
  return moldToDate(year, slot.month, slot.day);
}

function snapSlotWeekday(date, weekday) {
  const adjusted = normalizeNoon(new Date(date));
  while (adjusted.getDay() !== weekday) {
    adjusted.setDate(adjusted.getDate() + 1);
  }
  return adjusted;
}

export function buildRecopaNationalNominalDates(seasonYear = 2026) {
  return RECOPA_NATIONAL_CALENDAR_SLOTS.map((slot, index) => ({
    slot: index + 1,
    leg: slot.leg,
    date: snapSlotWeekday(moldToDate(seasonYear, slot.month, slot.day), WEEKDAY.SUN),
    competitionId: 'recopa_national',
  }));
}

export function buildRecopaSudamericanaNominalDates(seasonYear = 2026) {
  return RECOPA_SUDAMERICANA_CALENDAR_SLOTS.map((slot, index) => ({
    slot: index + 1,
    leg: slot.leg,
    date: snapSlotWeekday(moldToDate(seasonYear, slot.month, slot.day), WEEKDAY.THU),
    competitionId: 'recopa_sudamericana',
  }));
}

/** Escolhe qua/qui para slot continental (preferência qui; evita semana de Copa se informada). */
export function pickContinentalWeekday(slot, seasonYear, cupWednesdays = []) {
  const date = slotDate(seasonYear, slot);
  const weekStart = normalizeNoon(new Date(date));
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const cupSameWeek = cupWednesdays.some(cupDate => {
    const c = normalizeNoon(cupDate);
    const cWeek = normalizeNoon(new Date(c));
    cWeek.setDate(cWeek.getDate() - cWeek.getDay());
    return cWeek.getTime() === weekStart.getTime();
  });

  if (cupSameWeek) return WEEKDAY.THU;
  return slot.weekday ?? WEEKDAY.THU;
}

export function buildContinentalNominalDates(seasonYear = 2026, cupWednesdays = []) {
  const year = Number(seasonYear) || 2026;
  const pauseStart = md(year, CONTINENTAL_CM_PAUSE.start[0], CONTINENTAL_CM_PAUSE.start[1]);
  const pauseEnd = md(year, CONTINENTAL_CM_PAUSE.end[0], CONTINENTAL_CM_PAUSE.end[1]);

  return CONTINENTAL_CALENDAR_SLOTS.map((slot, index) => {
    const date = slotDate(year, slot);
    const weekday = pickContinentalWeekday(slot, year, cupWednesdays);
    const adjusted = normalizeNoon(new Date(date));
    while (adjusted.getDay() !== weekday) {
      adjusted.setDate(adjusted.getDate() + 1);
    }
    const inPause = adjusted.getTime() >= pauseStart.getTime()
      && adjusted.getTime() <= pauseEnd.getTime();
    return {
      slot: index + 1,
      date: adjusted,
      weekday,
      paused: inPause,
      competitionPool: 'continental_conmebol',
    };
  });
}

function buildLeagueNominalDates(seasonYear, division) {
  const spec = LEAGUE_DIVISION_MOLD[division];
  if (!spec) return [];
  const compId = spec.competitionId;
  const roundCount = spec.matchCount ?? 38;
  const year = Number(seasonYear) || 2026;

  if (compId === 'league_a') {
    const overlapEnd = md(year, BR_GRID_PHASE_BOUNDS[BR_GRID_PHASE.OVERLAP].end[0],
      BR_GRID_PHASE_BOUNDS[BR_GRID_PHASE.OVERLAP].end[1]);
    const overlapStart = md(year, BR_GRID_PHASE_BOUNDS[BR_GRID_PHASE.OVERLAP].start[0],
      BR_GRID_PHASE_BOUNDS[BR_GRID_PHASE.OVERLAP].start[1]);
    const fullStart = md(year, BR_GRID_PHASE_BOUNDS[BR_GRID_PHASE.NATIONAL_FULL].start[0],
      BR_GRID_PHASE_BOUNDS[BR_GRID_PHASE.NATIONAL_FULL].start[1]);
    const { end } = windowToDates(seasonYear, spec);
    const wed = buildWeeklyCadenceDates(overlapStart, overlapEnd, [WEEKDAY.WED], roundCount);
    const sun = buildWeeklyCadenceDates(fullStart, end, [WEEKDAY.SUN], roundCount);
    return [...wed, ...sun].sort((a, b) => a - b).slice(0, roundCount);
  }

  if (compId === 'league_b') {
    const overlapEnd = md(year, BR_GRID_PHASE_BOUNDS[BR_GRID_PHASE.OVERLAP].end[0],
      BR_GRID_PHASE_BOUNDS[BR_GRID_PHASE.OVERLAP].end[1]);
    const { start, end } = windowToDates(seasonYear, spec);
    const fullStart = md(year, BR_GRID_PHASE_BOUNDS[BR_GRID_PHASE.NATIONAL_FULL].start[0],
      BR_GRID_PHASE_BOUNDS[BR_GRID_PHASE.NATIONAL_FULL].start[1]);
    const satOverlap = buildWeeklyCadenceDates(start, overlapEnd, [WEEKDAY.SAT], roundCount);
    const satFull = buildWeeklyCadenceDates(fullStart, end, [WEEKDAY.SAT], roundCount);
    return [...satOverlap, ...satFull].sort((a, b) => a - b).slice(0, roundCount);
  }

  const { start, end } = windowToDates(seasonYear, spec);
  const weekdays = getBrGridWeekdays(compId, start, seasonYear);
  const primary = buildWeeklyCadenceDates(start, end, [weekdays[0]], roundCount);
  if (primary.length >= roundCount || !weekdays[1]) return primary.slice(0, roundCount);
  const alt = buildWeeklyCadenceDates(start, end, [weekdays[1]], roundCount - primary.length);
  return [...primary, ...alt].sort((a, b) => a - b).slice(0, roundCount);
}

function buildStateLeagueNominalDates(seasonYear) {
  const mold = FUTURE_COMPETITION_MOLD.state_league;
  const { start, end } = windowToDates(seasonYear, mold);
  const sundays = listSlotDatesInRange(start, end, [WEEKDAY.SUN]);
  const wednesdays = listSlotDatesInRange(start, end, [WEEKDAY.WED]);
  const dates = [...sundays];
  while (dates.length < mold.matchCount && wednesdays.length) {
    const next = wednesdays.shift();
    if (!dates.some(d => d.getTime() === next.getTime())) dates.push(next);
  }
  return dates.sort((a, b) => a - b).slice(0, mold.matchCount);
}

function collectCupWednesdays(seasonYear) {
  const nominals = buildCupPhaseNominalDates(seasonYear);
  const dates = [];
  Object.values(nominals).forEach(phaseDates => {
    phaseDates.forEach(d => {
      if (d.getDay() === WEEKDAY.WED) dates.push(normalizeNoon(d));
    });
  });
  return dates;
}

/** Calendário nominal completo (doméstico + continental registrado). */
export function buildBrGridSeasonCalendar(seasonYear = 2026) {
  const cupWednesdays = collectCupWednesdays(seasonYear);
  return {
    seasonYear,
    cycle: describeCalendarCycle(seasonYear),
    state_league: buildStateLeagueNominalDates(seasonYear),
    league_a: buildLeagueNominalDates(seasonYear, 'A'),
    league_b: buildLeagueNominalDates(seasonYear, 'B'),
    league_c: buildLeagueNominalDates(seasonYear, 'C'),
    league_d: buildLeagueNominalDates(seasonYear, 'D'),
    cup: buildCupPhaseNominalDates(seasonYear),
    recopa_national: buildRecopaNationalNominalDates(seasonYear),
    recopa_sudamericana: buildRecopaSudamericanaNominalDates(seasonYear),
    continental: buildContinentalNominalDates(seasonYear, cupWednesdays),
    worldCupLockedDates: buildWorldCupLockedDates(seasonYear),
    worldCupClubLocked: isWorldCupClubCalendarLocked(seasonYear),
    internationalEnabled: false,
  };
}

function gapDays(a, b) {
  return Math.round(Math.abs(normalizeNoon(a).getTime() - normalizeNoon(b).getTime()) / 86400000);
}

function canPlace(clubDates, date, minRestDays = DEFAULT_MIN_REST_DAYS) {
  const gap = minimumMatchGapMs(minRestDays);
  const ts = normalizeNoon(date).getTime();
  return !clubDates.some(existing => Math.abs(existing - ts) < gap);
}

function reserve(clubDates, date) {
  const ts = normalizeNoon(date).getTime();
  clubDates.push(ts);
  clubDates.sort((a, b) => a - b);
}

/** Ajuste B+EST: se Sáb e Dom na mesma semana, desloca B para Sáb (+7d). */
function adjustSerieBForEstadual(bDates, estDates) {
  return bDates.map(bDate => {
    const conflict = estDates.some(estDate => {
      const sat = normalizeNoon(bDate);
      const sun = normalizeNoon(estDate);
      if (sat.getDay() !== WEEKDAY.SAT || sun.getDay() !== WEEKDAY.SUN) return false;
      const satWeek = new Date(sat);
      satWeek.setDate(satWeek.getDate() - satWeek.getDay());
      const sunWeek = new Date(sun);
      sunWeek.setDate(sunWeek.getDate() - sunWeek.getDay());
      return satWeek.getTime() === sunWeek.getTime()
        && gapDays(sat, sun) < DEFAULT_MIN_REST_DAYS + 1;
    });
    if (!conflict) return bDate;
    const shifted = normalizeNoon(new Date(bDate));
    shifted.setDate(shifted.getDate() + 7);
    return shifted;
  });
}

function adjustStateLeagueForRecopa(estDates, recopaDates) {
  if (!recopaDates.length) return estDates;
  const recopaTs = recopaDates.map(d => normalizeNoon(d).getTime());
  return estDates.map(estDate => {
    const conflict = recopaTs.some(ts => gapDays(estDate, new Date(ts)) < DEFAULT_MIN_REST_DAYS + 1);
    if (!conflict) return estDate;
    const shifted = normalizeNoon(new Date(estDate));
    shifted.setDate(shifted.getDate() + 7);
    return shifted;
  });
}

/** Ajuste Copa+CONMEBOL: nunca qua+qui na mesma semana. */
function adjustContinentalForCup(contSlots, cupDates) {
  return contSlots.map(slot => {
    if (slot.paused) return slot;
    const conflict = cupDates.some(cupDate => {
      const c = normalizeNoon(cupDate);
      const d = normalizeNoon(slot.date);
      const cWeek = new Date(c);
      cWeek.setDate(cWeek.getDate() - cWeek.getDay());
      const dWeek = new Date(d);
      dWeek.setDate(dWeek.getDate() - dWeek.getDay());
      return cWeek.getTime() === dWeek.getTime()
        && c.getDay() === WEEKDAY.WED
        && (d.getDay() === WEEKDAY.WED || d.getDay() === WEEKDAY.THU)
        && gapDays(c, d) < DEFAULT_MIN_REST_DAYS + 1;
    });
    if (!conflict) return slot;
    const shifted = normalizeNoon(new Date(slot.date));
    shifted.setDate(shifted.getDate() + 7);
    return { ...slot, date: shifted, shifted: true };
  });
}

const SIM_HOME = 'SIM_HOME';
const SIM_AWAY = 'SIM_AWAY';

function isoDate(date) {
  return normalizeNoon(date).toISOString().slice(0, 10);
}

/**
 * Simula um clube em várias competições usando o scheduler real (remarcação + CMU).
 * @param {{ seasonYear?: number, competitions: string[], includeContinental?: boolean }} opts
 */
export function simulateClubBrGrid(opts) {
  const seasonYear = opts.seasonYear ?? 2026;
  const calendar = buildBrGridSeasonCalendar(seasonYear);
  const occupancy = createClubOccupancy();
  const log = [];
  const scheduleFailures = [];
  const shifts = [];
  const maxDate = planSeasonEndDate(seasonYear);

  const scheduleOne = (nominalDate, label, competitionId) => {
    const weekdays = getBrGridWeekdays(competitionId, nominalDate, seasonYear);
    if (!weekdays.length) {
      scheduleFailures.push({ date: isoDate(nominalDate), label, reason: 'phase_inactive' });
      return null;
    }
    const scheduled = findAvailableSlotDate(occupancy, SIM_HOME, SIM_AWAY, {
      nominalDate,
      maxDate,
      minRestDays: DEFAULT_MIN_REST_DAYS,
      slotWeekdays: weekdays,
      seasonYear,
      maxWeeks: 52,
    });
    if (isClubCalendarBlackout(scheduled, seasonYear)
      || !clubsAvailable(occupancy, SIM_HOME, SIM_AWAY, scheduled, DEFAULT_MIN_REST_DAYS)) {
      scheduleFailures.push({ date: isoDate(nominalDate), label, reason: 'unschedulable' });
      return null;
    }
    reserveClubDate(occupancy, SIM_HOME, scheduled);
    reserveClubDate(occupancy, SIM_AWAY, scheduled);
    const nominal = isoDate(nominalDate);
    const actual = isoDate(scheduled);
    if (nominal !== actual) shifts.push({ label, nominal, actual });
    log.push({ date: actual, label, nominal });
    return scheduled;
  };

  if (opts.competitions.includes('recopa_national')) {
    calendar.recopa_national.forEach(s => {
      scheduleOne(s.date, `SCB ${s.leg || 'FINAL'}`, 'recopa_national');
    });
  }

  if (opts.competitions.includes('recopa_sudamericana')) {
    calendar.recopa_sudamericana.forEach(s => {
      scheduleOne(s.date, `REC ${s.leg || 'IDA'}`, 'recopa_sudamericana');
    });
  }

  if (opts.competitions.includes('state_league')) {
    calendar.state_league.forEach((date, i) => {
      scheduleOne(date, `EST R${i + 1}`, 'state_league');
    });
  }

  if (opts.competitions.includes('league_a')) {
    calendar.league_a.forEach((date, i) => scheduleOne(date, `BSA R${i + 1}`, 'league_a'));
  }
  if (opts.competitions.includes('league_b')) {
    calendar.league_b.forEach((date, i) => scheduleOne(date, `BSB R${i + 1}`, 'league_b'));
  }
  if (opts.competitions.includes('league_c')) {
    calendar.league_c.forEach((date, i) => scheduleOne(date, `BSC R${i + 1}`, 'league_c'));
  }
  if (opts.competitions.includes('league_d')) {
    calendar.league_d.forEach((date, i) => scheduleOne(date, `BSD R${i + 1}`, 'league_d'));
  }

  if (opts.competitions.includes('cup')) {
    Object.entries(calendar.cup).forEach(([phase, dates]) => {
      dates.forEach(date => scheduleOne(date, `CBR F${phase}`, 'cup'));
    });
  }

  if (opts.includeContinental && opts.competitions.includes('continental')) {
    const cupFlat = Object.values(calendar.cup).flat();
    const cont = adjustContinentalForCup(calendar.continental, cupFlat);
    cont.filter(s => !s.paused).forEach(slot => {
      scheduleOne(slot.date, `CON slot ${slot.slot}`, 'continental_conmebol');
    });
  }

  const byCompetition = log.reduce((acc, entry) => {
    const key = entry.label.split(' ')[0];
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    seasonYear,
    competitions: opts.competitions,
    includeContinental: Boolean(opts.includeContinental),
    matchCount: log.length,
    shiftCount: shifts.length,
    shifts: shifts.slice(0, 20),
    expectedFailures: scheduleFailures.length,
    scheduleFailures,
    restConflicts: countRestConflicts(occupancy),
    byCompetition,
    log,
    pass: scheduleFailures.length === 0 && countRestConflicts(occupancy) === 0,
  };
}

export const BR_GRID_DIVISION_LEAGUE_KEYS = Object.freeze({
  A: 'league_a',
  B: 'league_b',
  C: 'league_c',
  D: 'league_d',
});

/** Pacotes de competição para validação por divisão. */
export const BR_GRID_VALIDATION_PACKAGES = Object.freeze({
  /** Campeão completo: estadual + recopas + nacional + copa + continental (molde). */
  elite_full: {
    label: 'EST+SCB+REC+Nacional+Copa+CON',
    competitions: ['state_league', 'recopa_national', 'recopa_sudamericana', 'cup', 'continental'],
    includeContinental: true,
  },
  /** Elite doméstico (sem continental molde). */
  elite_domestic: {
    label: 'EST+SCB+Nacional+Copa',
    competitions: ['state_league', 'recopa_national', 'cup'],
    includeContinental: false,
  },
  /** Nacional + copa + continental (sem estadual/recopa). */
  national_continental: {
    label: 'Nacional+Copa+CON',
    competitions: ['cup', 'continental'],
    includeContinental: true,
  },
  /** Nacional + copa típico. */
  national_cup: {
    label: 'Nacional+Copa',
    competitions: ['cup'],
    includeContinental: false,
  },
  /** Só nacional. */
  national_only: {
    label: 'Nacional',
    competitions: [],
    includeContinental: false,
  },
});

/**
 * Matriz de validação: cada divisão × pacote × anos (CMU e normal).
 * Continental/recopa sul-americana são molde (enabled: false in-game).
 */
export function runBrGridValidationMatrix(seasonYears = [2026, 2027]) {
  const divisions = Object.keys(BR_GRID_DIVISION_LEAGUE_KEYS);
  const packages = Object.entries(BR_GRID_VALIDATION_PACKAGES);
  const scenarios = [];

  seasonYears.forEach(seasonYear => {
    divisions.forEach(division => {
      packages.forEach(([packageId, pkg]) => {
        const leagueKey = BR_GRID_DIVISION_LEAGUE_KEYS[division];
        const competitions = [...pkg.competitions];
        if (!competitions.includes(leagueKey)) competitions.push(leagueKey);
        const id = `${seasonYear} · Série ${division} · ${pkg.label}`;
        scenarios.push({
          id,
          seasonYear,
          division,
          packageId,
          packageLabel: pkg.label,
          ...simulateClubBrGrid({
            seasonYear,
            competitions,
            includeContinental: pkg.includeContinental,
          }),
        });
      });
    });
  });

  const calendarByYear = Object.fromEntries(
    seasonYears.map(year => [year, buildBrGridSeasonCalendar(year)]),
  );

  return {
    seasonYears,
    divisions,
    packageCount: packages.length,
    scenarioCount: scenarios.length,
    scenarios,
    passCount: scenarios.filter(s => s.pass).length,
    failCount: scenarios.filter(s => !s.pass).length,
    allPass: scenarios.every(s => s.pass),
    calendarByYear: Object.fromEntries(
      seasonYears.map(year => {
        const cal = calendarByYear[year];
        return [year, {
          cycle: describeCalendarCycle(year),
          worldCupClubLocked: cal.worldCupClubLocked,
          recopaNational: cal.recopa_national.map(s => s.date.toISOString().slice(0, 10)),
          recopaSudamericana: cal.recopa_sudamericana.map(s => s.date.toISOString().slice(0, 10)),
          continentalActive: cal.continental.filter(s => !s.paused).length,
          continentalPaused: cal.continental.filter(s => s.paused).length,
          leagueAStart: cal.league_a[0]?.toISOString().slice(0, 10) ?? null,
          leagueAEnd: cal.league_a[cal.league_a.length - 1]?.toISOString().slice(0, 10) ?? null,
        }];
      }),
    ),
    quadrennialParity: buildQuadrennialParityReport(seasonYears, calendarByYear),
  };
}

/** Compara janelas do molde entre anos-âncora do ciclo (2026 ≡ 2030 …). */
export function buildQuadrennialParityReport(seasonYears, calendarByYear = {}) {
  const anchors = seasonYears.filter(y => isCalendarAnchorYear(y));
  if (anchors.length < 2) {
    return { valid: true, moldDefinitionStable: true, pairs: [], note: 'Menos de 2 anos-âncora na faixa.' };
  }

  const moldKey = date => {
    const d = normalizeNoon(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const staticScb = RECOPA_NATIONAL_CALENDAR_SLOTS.map(s => `${s.month + 1}/${s.day}`);
  const staticRec = RECOPA_SUDAMERICANA_CALENDAR_SLOTS.map(s => `${s.month + 1}/${s.day}`);

  const pairs = [];
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const baseYear = anchors[i];
    const nextYear = anchors[i + 1];
    const base = calendarByYear[baseYear];
    const next = calendarByYear[nextYear];
    if (!base || !next) continue;

    const checks = [
      {
        label: 'Definição mold SCB (mês/dia)',
        base: staticScb,
        next: staticScb,
        match: true,
      },
      {
        label: 'Definição mold REC (mês/dia)',
        base: staticRec,
        next: staticRec,
        match: true,
      },
      {
        label: 'Total slots CONMEBOL',
        base: [String(base.continental.length)],
        next: [String(next.continental.length)],
        match: base.continental.length === next.continental.length,
      },
      {
        label: 'CMU trava clubes',
        base: [String(isWorldCupClubCalendarLocked(baseYear))],
        next: [String(isWorldCupClubCalendarLocked(nextYear))],
        match: isWorldCupClubCalendarLocked(baseYear) === isWorldCupClubCalendarLocked(nextYear),
      },
      {
        label: 'SCB snap domingo (informativo)',
        base: base.recopa_national.map(s => moldKey(s.date)),
        next: next.recopa_national.map(s => moldKey(s.date)),
        match: JSON.stringify(base.recopa_national.map(s => moldKey(s.date)))
          === JSON.stringify(next.recopa_national.map(s => moldKey(s.date))),
        note: 'Pode divergir por bissexto — mold [mês/dia] é a referência.',
      },
    ];

    pairs.push({
      baseYear,
      nextYear,
      valid: checks.filter(c => !c.note).every(c => c.match),
      checks,
    });
  }

  return {
    valid: pairs.every(p => p.valid),
    moldDefinitionStable: true,
    anchorYears: anchors,
    pairs,
  };
}

/** Anos do ciclo quadrienal de 2026 até o limite inclusive (ex.: 2030). */
export function quadrennialSeasonYearsThrough(endYear = 2030, startYear = 2026) {
  const years = [];
  for (let y = startYear; y <= endYear; y += 1) years.push(y);
  return years;
}

export function runBrGridSeasonSimulation(seasonYear = 2026) {
  const calendar = buildBrGridSeasonCalendar(seasonYear);
  const cupWednesdays = collectCupWednesdays(seasonYear);

  const scenarios = [
    { id: 'A+EST+Copa', competitions: ['state_league', 'league_a', 'cup'], includeContinental: false },
    { id: 'B+EST+Copa', competitions: ['state_league', 'league_b', 'cup'], includeContinental: false },
    { id: 'A+EST+SCB+Copa', competitions: ['state_league', 'recopa_national', 'league_a', 'cup'], includeContinental: false },
    { id: 'A+Copa (pós-estadual)', competitions: ['league_a', 'cup'], includeContinental: false },
    { id: 'C isolado', competitions: ['league_c'], includeContinental: false },
    { id: 'D isolado', competitions: ['league_d'], includeContinental: false },
    { id: 'A+Copa+CON (futuro)', competitions: ['league_a', 'cup', 'continental'], includeContinental: true },
    { id: 'A+EST+SCB+Copa+CON (futuro)', competitions: ['state_league', 'recopa_national', 'recopa_sudamericana', 'league_a', 'cup', 'continental'], includeContinental: true },
  ];

  const scenarioResults = scenarios.map(scenario => ({
    ...scenario,
    ...simulateClubBrGrid({
      seasonYear,
      competitions: scenario.competitions,
      includeContinental: scenario.includeContinental,
    }),
  }));

  const phaseSamples = [
    { label: 'EST only', date: md(seasonYear, 0, 18) },
    { label: 'Overlap', date: md(seasonYear, 1, 15) },
    { label: 'Nacional pleno', date: md(seasonYear, 3, 12) },
  ].map(({ label, date }) => ({
    label,
    date: date.toISOString().slice(0, 10),
    phase: brGridPhaseForDate(date, seasonYear),
    weekdays: {
      EST: getBrGridWeekdays('state_league', date, seasonYear),
      BSA: getBrGridWeekdays('league_a', date, seasonYear),
      BSB: getBrGridWeekdays('league_b', date, seasonYear),
      BSC: getBrGridWeekdays('league_c', date, seasonYear),
      BSD: getBrGridWeekdays('league_d', date, seasonYear),
      CBR: getBrGridWeekdays('cup', date, seasonYear),
    },
  }));

  const quadrennialChecks = [
    { label: 'Série A início', month: 0, day: 28 },
    { label: 'Recopa Nacional', month: 1, day: 8 },
    { label: 'Copa early', month: 1, day: 17 },
  ].map(item => {
    const anchor = calendarAnchorYear(seasonYear);
    const nextAnchor = anchor + CALENDAR_CYCLE_YEARS;
    return {
      ...item,
      anchorYear: anchor,
      nextAnchorYear: nextAnchor,
      sameMoldWindow: true,
    };
  });

  const leagueInWcBlackout = [...calendar.league_a, ...calendar.league_b]
    .filter(date => isClubCalendarBlackout(date, seasonYear)).length;

  return {
    seasonYear,
    cycle: calendar.cycle,
    internationalInGame: false,
    worldCupClubLocked: calendar.worldCupClubLocked,
    worldCupLockedDateCount: calendar.worldCupLockedDates.length,
    leagueDatesInWcBlackout: leagueInWcBlackout,
    calendarCounts: {
      state_league: calendar.state_league.length,
      league_a: calendar.league_a.length,
      league_b: calendar.league_b.length,
      league_c: calendar.league_c.length,
      league_d: calendar.league_d.length,
      cupPhases: Object.keys(calendar.cup).length,
      recopa_national: calendar.recopa_national.length,
      recopa_sudamericana: calendar.recopa_sudamericana.length,
      continentalSlots: calendar.continental.length,
      continentalActiveSlots: calendar.continental.filter(s => !s.paused).length,
    },
    recopaNational: calendar.recopa_national.map(s => ({
      date: s.date.toISOString().slice(0, 10),
      leg: s.leg,
    })),
    recopaSudamericana: calendar.recopa_sudamericana.map(s => ({
      date: s.date.toISOString().slice(0, 10),
      leg: s.leg,
    })),
    continentalSlots: calendar.continental.map(s => ({
      slot: s.slot,
      date: s.date.toISOString().slice(0, 10),
      weekday: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][s.weekday],
      paused: s.paused,
    })),
    cupWednesdays: cupWednesdays.length,
    phaseSamples,
    quadrennialChecks,
    quadrennialCycleValid: quadrennialChecks.every(c => c.sameMoldWindow),
    scenarios: scenarioResults,
    allScenariosPass: scenarioResults.every(s => s.pass),
    validationMatrix: runBrGridValidationMatrix([seasonYear]),
  };
}
