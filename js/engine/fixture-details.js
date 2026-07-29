import {
  formatFixtureDateLabel,
  gameScheduledDate,
  parseCalendarDate,
} from './season-scheduler.js';
import { isStateLeagueGame, scheduleStateLeagueDates, STATE_LEAGUE_CALENDAR_SLOTS } from './state-league-format.js';
import { WORLD_CUP_COMPETITION } from './world-cup-calendar.js';
import { gameMatchesRecorded } from './competition-calendar.js';
import { isClubCalendarBlackout, snapOutsideClubBlackout } from './season-calendar-cycle.js';

/**
 * Resolve data/hora de exibição para qualquer fixture (liga, copa, estadual, CM).
 */
export function createFixtureDetailsResolver({
  getCareerSeason,
  getChampionshipFixtures,
  getFixtureTimes,
  fixtureDate,
  seasonStartDate,
}) {
  return function fixtureDetails(game) {
    const careerSeason = getCareerSeason();
    const championshipFixtures = getChampionshipFixtures();
    const fixtureTimes = getFixtureTimes();

    const stateLeagueFallbackDate = () => {
      const slots = scheduleStateLeagueDates(careerSeason, STATE_LEAGUE_CALENDAR_SLOTS);
      const slot = slots[Math.max(0, (game.round || 1) - 1)];
      return slot?.date || null;
    };
    const resolveFormattedDate = (rawDate, fallbackDate = null) =>
      formatFixtureDateLabel(rawDate) || formatFixtureDateLabel(fallbackDate);

    if (game.competition === 'COPA DO BRASIL' || game.competition === WORLD_CUP_COMPETITION || isStateLeagueGame(game)) {
      const formatted = resolveFormattedDate(game.date, isStateLeagueGame(game) ? stateLeagueFallbackDate() : null);
      const date = formatted?.date || parseCalendarDate(game.date) || seasonStartDate();
      const display = formatted?.display || formatFixtureDateLabel(date)?.display || '—';
      return { date, display, time: game.time || '16:00' };
    }

    const gameIndex = (championshipFixtures[game.round - 1] || []).findIndex(candidate =>
      gameMatchesRecorded(game, candidate),
    );
    const roundFallback = fixtureDate(game.round);
    let date = gameScheduledDate(game, roundFallback) || roundFallback;
    // Mata-mata Série D sem data caía no nominal Apr–Sep (dentro da CMU).
    // Empurra para fora do blackout e grava a data no fixture.
    if (date && isClubCalendarBlackout(date, careerSeason)) {
      date = snapOutsideClubBlackout(date, careerSeason);
      if (game && !game.completed && game.homeGoals == null) {
        try {
          game.date = date.toISOString().slice(0, 10);
        } catch {
          /* ignore */
        }
      }
    }
    const formatted = formatFixtureDateLabel(date);
    return {
      date: formatted?.date || date,
      display: formatted?.display || '—',
      time: game.time || fixtureTimes[Math.max(0, gameIndex) % fixtureTimes.length],
    };
  };
}
