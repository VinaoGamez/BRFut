/**
 * Ciclo quadrienal do calendário CBF — âncora 2026, repete a cada 4 anos.
 * Garante o mesmo padrão de weekdays para [mês, dia] (2026 ≡ 2030 ≡ 2034 …).
 */
import {
  WORLD_CUP_ANCHOR_YEAR,
  WORLD_CUP_WINDOW,
  isWorldCupYear,
  getSeasonBlackouts,
} from './season-calendar-mold.js';

/** Ano-âncora do molde CBF (calendário masculino profissional). */
export const CALENDAR_ANCHOR_YEAR = WORLD_CUP_ANCHOR_YEAR;

/** Repetição do molde — alinhado ao ciclo FIFA / CMU. */
export const CALENDAR_CYCLE_YEARS = 4;

function normalizeNoon(date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

/** Deslocamento 0…3 dentro do ciclo quadrienal. */
export function calendarCycleOffset(seasonYear) {
  const y = Number(seasonYear) || CALENDAR_ANCHOR_YEAR;
  return ((y - CALENDAR_ANCHOR_YEAR) % CALENDAR_CYCLE_YEARS + CALENDAR_CYCLE_YEARS) % CALENDAR_CYCLE_YEARS;
}

/** Temporada está no ano “redondo” do ciclo (2026, 2030, …). */
export function isCalendarAnchorYear(seasonYear) {
  return calendarCycleOffset(seasonYear) === 0;
}

/**
 * Ano de referência do molde para padrão de weekdays.
 * 2027–2029 → 2026 · 2031–2033 → 2030.
 */
export function calendarAnchorYear(seasonYear) {
  const y = Number(seasonYear) || CALENDAR_ANCHOR_YEAR;
  return y - calendarCycleOffset(y);
}

/** Converte [mês 0-index, dia] do molde para Date no ano da temporada. */
export function moldToDate(seasonYear, monthIndex, day) {
  return normalizeNoon(new Date(Number(seasonYear) || CALENDAR_ANCHOR_YEAR, monthIndex, day));
}

/** Data dentro de uma janela [start, end] do molde. */
export function isDateInMoldWindow(date, window, seasonYear) {
  if (!window?.start || !window?.end) return false;
  const d = normalizeNoon(date);
  const start = moldToDate(seasonYear, window.start[0], window.start[1]);
  const end = moldToDate(seasonYear, window.end[0], window.end[1]);
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

/**
 * CMU trava calendário de clubes em anos de copa — independente de FEATURES.worldCup.
 * O módulo de seleções liga/desliga separadamente.
 */
export function isWorldCupClubCalendarLocked(seasonYear) {
  return isWorldCupYear(seasonYear);
}

/** Blackout rígido de clubes na janela CMU. */
export function worldCupClubBlackoutSpec(seasonYear) {
  if (!isWorldCupClubCalendarLocked(seasonYear)) return null;
  return Object.freeze({
    id: 'world_cup',
    code: 'CMU',
    label: 'Copa do Mundo de Seleções (clubes parados)',
    start: [...WORLD_CUP_WINDOW.start],
    end: [...WORLD_CUP_WINDOW.end],
    blocksClubs: true,
    locked: true,
    hard: true,
    cadence: 'quadrennial',
    anchorYear: CALENDAR_ANCHOR_YEAR,
  });
}

/** Blackouts rígidos (CMU, etc.) que impedem agendamento de clubes. */
export function getHardClubBlackouts(seasonYear) {
  return getSeasonBlackouts(seasonYear).filter(b => b.blocksClubs && b.hard === true);
}

/** Data bloqueada para jogos de clubes (blackouts hard). */
export function isClubCalendarBlackout(date, seasonYear) {
  const y = Number(seasonYear);
  if (!y || !date) return false;
  return getHardClubBlackouts(y).some(b => isDateInMoldWindow(date, b, y));
}

/** Próximo ano do ciclo com o mesmo weekday que o âncora para [mês, dia]. */
export function nextCalendarAnchorYear(fromYear = CALENDAR_ANCHOR_YEAR) {
  const y = Number(fromYear) || CALENDAR_ANCHOR_YEAR;
  return y + CALENDAR_CYCLE_YEARS;
}

/**
 * Weekday do molde-âncora para a mesma data civil em outro ano do ciclo.
 * Útil para validar que 2030 replica o padrão de 2026.
 */
export function anchorWeekdayForMoldDate(seasonYear, monthIndex, day) {
  const anchor = calendarAnchorYear(seasonYear);
  return moldToDate(anchor, monthIndex, day).getDay();
}

export function describeCalendarCycle(seasonYear) {
  const y = Number(seasonYear) || CALENDAR_ANCHOR_YEAR;
  const anchor = calendarAnchorYear(y);
  return {
    seasonYear: y,
    anchorYear: anchor,
    cycleOffset: calendarCycleOffset(y),
    isAnchorYear: isCalendarAnchorYear(y),
    worldCupClubLocked: isWorldCupClubCalendarLocked(y),
    nextAnchorYear: nextCalendarAnchorYear(anchor),
  };
}
