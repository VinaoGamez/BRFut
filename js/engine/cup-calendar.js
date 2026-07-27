import {
  DEFAULT_MIN_REST_DAYS,
  DEFAULT_TWO_LEG_GAP_DAYS,
  LEAGUE_CALENDAR_WINDOWS,
  clubFixturesViolateHardBlackout,
  countRestConflicts,
  ensureLeagueScheduleMaterialized,
  isDateAvailable,
  leagueFixturesNeedScheduling,
  rebuildOccupancyFromLeagueFixtures,
  rescheduleCupFixtures,
  reserveClubDate,
  scheduleGameOnOccupancy,
  unreserveClubDate,
  unreserveScheduledGame,
} from './season-scheduler.js';
import { buildCupPhaseNominalDates, seasonEndDate as planSeasonEndDate } from './season-calendar-plan.js';

function cupPairsForStage(definition, entrants, { clubs, shuffleCup }) {
  const pool = Array.isArray(entrants) ? entrants.filter(Boolean) : [];
  if (!definition || pool.length < 2) return [];
  if (definition.index === 1) {
    const ranked = [...pool];
    return Array.from({ length: Math.min(14, Math.floor(ranked.length / 2)) }, (_, index) => {
      const pair = [ranked[index], ranked[ranked.length - 1 - index]];
      return Math.random() < 0.5 ? pair : pair.reverse();
    });
  }
  if (definition.index === 5) {
    const ranked = [...pool].sort((a, b) => (clubs[b]?.power || 0) - (clubs[a]?.power || 0));
    const potA = shuffleCup(ranked.slice(0, 16));
    const potB = shuffleCup(ranked.slice(16));
    return potA
      .filter((_, index) => potB[index])
      .map((club, index) => (Math.random() < 0.5 ? [club, potB[index]] : [potB[index], club]));
  }
  const draw = shuffleCup(pool);
  return Array.from({ length: Math.floor(draw.length / 2) }, (_, index) =>
    (Math.random() < 0.5 ? [draw[index * 2], draw[index * 2 + 1]] : [draw[index * 2 + 1], draw[index * 2]]),
  );
}

/**
 * Ocupação nacional (liga + copa + recopa): datas, remarcação e criação de fases da Copa.
 */
export function createCupCalendarEngine({
  getCupCompetition,
  cupGameNumberHolder,
  getCopaDoBrasilFixtures,
  getRecopaCompetition,
  refreshRecopaFixtures,
  getNationalCompetitions,
  getCareerSeason,
  getCareerCalendarDate,
  getFixtureTimes,
  seasonStartDate,
  getCupPhaseDefinitions,
  refreshCupPhaseNominalDates,
  getClubs,
  shuffleCup,
  onCupScheduleChanged,
}) {
  const MIN_REST_DAYS = DEFAULT_MIN_REST_DAYS;
  const clubMatchDates = new Map();

  const leagueScheduleMaterializedFresh = () =>
    leagueFixturesNeedScheduling(getNationalCompetitions())
    || clubFixturesViolateHardBlackout(getNationalCompetitions(), getCareerSeason());

  const rebuildLeagueClubDates = () => {
    clubMatchDates.clear();
    rebuildOccupancyFromLeagueFixtures(getNationalCompetitions(), clubMatchDates);
  };

  const clubMatchOccupancy = ensureLeagueScheduleMaterialized(getCareerSeason(), getNationalCompetitions(), {
    windows: LEAGUE_CALENDAR_WINDOWS,
    fixtureTimes: getFixtureTimes(),
    minRestDays: MIN_REST_DAYS,
    seasonYear: getCareerSeason(),
  });
  clubMatchDates.clear();
  clubMatchOccupancy.forEach((timestamps, club) => {
    clubMatchDates.set(club, [...timestamps]);
  });

  const scheduleRecopaFixture = () => {
    const game = getRecopaCompetition()?.fixture;
    if (!game?.home || !game?.away || game.completed || !game.date) return;
    scheduleGameOnOccupancy(game, clubMatchDates, {
      nominalDate: game.date,
      minDate: getCareerCalendarDate(),
      maxDate: planSeasonEndDate(getCareerSeason()),
      minRestDays: MIN_REST_DAYS,
      competitionId: 'recopa_national',
      seasonYear: getCareerSeason(),
      time: game.time || '18:00',
    });
  };

  scheduleRecopaFixture();
  refreshRecopaFixtures();

  const reserveClubDateLocal = (club, date) => reserveClubDate(clubMatchDates, club, date);
  const unreserveClubDateLocal = (club, timestamp) => unreserveClubDate(clubMatchDates, club, timestamp);
  const dateAvailable = (club, date) => isDateAvailable(clubMatchDates, club, date, MIN_REST_DAYS);
  const cupDateAvailable = (club, date) => dateAvailable(club, date);
  const unreserveCupGame = game => unreserveScheduledGame(clubMatchDates, game);
  const scheduleCupFixture = (game, { minDate = null } = {}) =>
    scheduleGameOnOccupancy(game, clubMatchDates, {
      nominalDate: game.date || minDate || getCareerCalendarDate(),
      minDate,
      maxDate: planSeasonEndDate(getCareerSeason()),
      minRestDays: MIN_REST_DAYS,
      competitionId: 'cup',
      time: game.time,
      seasonYear: getCareerSeason(),
    });

  const allCupFixtures = () =>
    (getCupCompetition().stages || []).flatMap(stage =>
      (Array.isArray(stage?.fixtures) ? stage.fixtures : []),
    );

  const refreshCopaDoBrasilFixtures = () => {
    const copaDoBrasilFixtures = getCopaDoBrasilFixtures();
    copaDoBrasilFixtures.length = 0;
    copaDoBrasilFixtures.push(...allCupFixtures());
  };

  const rescheduleAllCupFixtures = () => {
    refreshCupPhaseNominalDates();
    rebuildLeagueClubDates();
    rescheduleCupFixtures(allCupFixtures(), clubMatchDates, {
      minRestDays: MIN_REST_DAYS,
      twoLegGapDays: DEFAULT_TWO_LEG_GAP_DAYS,
      careerFloor: getCareerCalendarDate(),
      seasonYear: getCareerSeason(),
    });
  };

  const calendarIntervalLabel = conflicts =>
    (conflicts === 0
      ? 'molde CBF · Qua/Dom · descanso validado'
      : `${conflicts} conflito(s) aguardando ajuste`);

  const createCupStage = (phaseIndex, entrants) => {
    const cupCompetition = getCupCompetition();
    const definition = getCupPhaseDefinitions()[phaseIndex - 1];
    if (!definition?.dates?.length) return null;

    const pairs = cupPairsForStage(definition, entrants, {
      clubs: getClubs(),
      shuffleCup,
    });
    const fixtures = [];
    const safeEntrants = Array.isArray(entrants) ? entrants.filter(Boolean) : [];
    const fixtureTimes = getFixtureTimes();
    const careerSeason = getCareerSeason();

    pairs.forEach(([home, away], tieIndex) => {
      if (!home || !away) return;
      const tieId = `F${phaseIndex}-G${tieIndex + 1}`;
      const idaDate = definition.dates[0]
        || buildCupPhaseNominalDates(careerSeason)[phaseIndex]?.[0]
        || seasonStartDate();
      fixtures.push({
        home,
        away,
        competition: 'COPA DO BRASIL',
        phase: definition.name,
        phaseIndex,
        leg: definition.twoLegged ? 'IDA' : 'JOGO ÚNICO',
        date: new Date(idaDate),
        time: fixtureTimes[tieIndex % fixtureTimes.length],
        gameNumber: cupGameNumberHolder.value++,
        tieId,
        completed: false,
      });
      if (definition.twoLegged) {
        const voltaDate = definition.dates[1] || definition.dates[0] || idaDate;
        fixtures.push({
          home: away,
          away: home,
          competition: 'COPA DO BRASIL',
          phase: definition.name,
          phaseIndex,
          leg: 'VOLTA',
          date: new Date(voltaDate),
          time: fixtureTimes[(tieIndex + 1) % fixtureTimes.length],
          gameNumber: cupGameNumberHolder.value++,
          tieId,
          completed: false,
        });
      }
    });

    const stage = {
      index: phaseIndex,
      name: definition.name,
      twoLegged: definition.twoLegged,
      entrants: safeEntrants,
      fixtures,
      completed: false,
      winners: [],
    };
    cupCompetition.stages.push(stage);
    refreshCopaDoBrasilFixtures();
    rescheduleAllCupFixtures();
    cupCompetition.currentPhase = phaseIndex;
    onCupScheduleChanged?.();
    return stage;
  };

  const bootstrapSavedCupStages = () => {
    getCupCompetition().stages.forEach(stage => {
      if (!Array.isArray(stage.fixtures)) stage.fixtures = [];
      stage.fixtures.sort((a, b) => a.date - b.date || a.gameNumber - b.gameNumber);
    });
    refreshCopaDoBrasilFixtures();
    rescheduleAllCupFixtures();
  };

  const calculateRestConflicts = () => countRestConflicts(clubMatchDates, MIN_REST_DAYS);

  return {
    clubMatchDates,
    leagueScheduleMaterializedFresh: leagueScheduleMaterializedFresh(),
    reserveClubDateLocal,
    unreserveClubDateLocal,
    rebuildLeagueClubDates,
    scheduleRecopaFixture,
    dateAvailable,
    cupDateAvailable,
    unreserveCupGame,
    scheduleCupFixture,
    allCupFixtures,
    refreshCopaDoBrasilFixtures,
    rescheduleAllCupFixtures,
    calendarIntervalLabel,
    createCupStage,
    bootstrapSavedCupStages,
    calculateRestConflicts,
  };
}
