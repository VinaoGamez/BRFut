/**
 * Recopa Nacional — campeão Brasileiro × campeão Copa do Brasil (jogo único).
 */
import { buildRecopaNationalNominalDates } from './season-calendar-br-grid.js';
import { FUTURE_COMPETITION_MOLD } from './season-calendar-mold.js';

export const RECOPA_NATIONAL_COMPETITION = 'RECOPA NACIONAL';
export const RECOPA_NATIONAL_CODE = 'SCB';

export function isRecopaNationalGame(game) {
  return String(game?.competition || '') === RECOPA_NATIONAL_COMPETITION;
}

export function isRecopaNationalEnabled() {
  return FUTURE_COMPETITION_MOLD.recopa_national.enabled === true;
}

export function createEmptyRecopaNational(seasonYear = 2026) {
  return {
    seasonYear: Number(seasonYear) || 2026,
    sourceSeason: null,
    brasileiroChampion: null,
    copaChampion: null,
    skippedSameClub: false,
    fixture: null,
    champion: null,
    complete: false,
    ready: false,
  };
}

export function recopaNationalEmptyMessage(comp = {}) {
  if (comp.skippedSameClub && comp.brasileiroChampion) {
    return `${comp.brasileiroChampion} conquistou o Brasileirão e a Copa do Brasil — Recopa não disputada.`;
  }
  if (!comp.sourceSeason) {
    return 'Disputada entre os campeões do Brasileirão e da Copa do Brasil da temporada anterior. Disponível a partir da 2ª temporada da carreira.';
  }
  return 'Aguardando confirmação dos campeões da temporada anterior.';
}

export function buildRecopaNationalFixture({
  seasonYear,
  sourceSeason,
  brasileiroChampion,
  copaChampion,
  date,
  time = '18:00',
}) {
  const home = String(brasileiroChampion || '').trim();
  const away = String(copaChampion || '').trim();
  if (!home || !away) return null;
  if (home === away) return null;
  return {
    home,
    away,
    competition: RECOPA_NATIONAL_COMPETITION,
    phase: 'FINAL',
    phaseIndex: 1,
    leg: 'JOGO ÚNICO',
    tieId: 'RECOPA-NAC',
    date: date ? new Date(date) : null,
    time,
    gameNumber: 1,
    round: 1,
    completed: false,
    homeGoals: null,
    awayGoals: null,
    sourceSeason: Number(sourceSeason) || null,
    seasonYear: Number(seasonYear) || 2026,
  };
}

export function materializeRecopaNational(comp, {
  seasonYear,
  priorChampions,
} = {}) {
  const year = Number(seasonYear) || 2026;
  const source = priorChampions || {};
  const sourceSeason = Number(source.season) || null;
  const brasileiroChampion = source.A || source.brasileiro || null;
  const copaChampion = source.CUP || source.copa || null;

  comp.seasonYear = year;
  comp.sourceSeason = sourceSeason;
  comp.brasileiroChampion = brasileiroChampion;
  comp.copaChampion = copaChampion;
  comp.champion = comp.complete ? comp.champion : null;

  if (!sourceSeason || !brasileiroChampion || !copaChampion) {
    comp.ready = false;
    comp.skippedSameClub = false;
    comp.fixture = null;
    return comp;
  }

  if (brasileiroChampion === copaChampion) {
    comp.ready = true;
    comp.skippedSameClub = true;
    comp.fixture = null;
    comp.champion = brasileiroChampion;
    comp.complete = true;
    return comp;
  }

  const slot = buildRecopaNationalNominalDates(year)[0];
  comp.ready = true;
  comp.skippedSameClub = false;
  comp.fixture = buildRecopaNationalFixture({
    seasonYear: year,
    sourceSeason,
    brasileiroChampion,
    copaChampion,
    date: slot?.date,
    time: '18:00',
  });
  if (comp.complete && comp.fixture) {
    comp.fixture.completed = true;
    comp.fixture.homeGoals = comp.fixture.homeGoals ?? 0;
    comp.fixture.awayGoals = comp.fixture.awayGoals ?? 0;
  }
  return comp;
}

export function restoreRecopaNational(raw, seasonYear = 2026) {
  const comp = createEmptyRecopaNational(seasonYear);
  if (!raw || typeof raw !== 'object') return comp;
  comp.seasonYear = Number(raw.seasonYear) || seasonYear;
  comp.sourceSeason = raw.sourceSeason ?? null;
  comp.brasileiroChampion = raw.brasileiroChampion || null;
  comp.copaChampion = raw.copaChampion || null;
  comp.skippedSameClub = !!raw.skippedSameClub;
  comp.champion = raw.champion || null;
  comp.complete = !!raw.complete;
  comp.ready = !!raw.ready;
  if (raw.fixture) {
    comp.fixture = {
      ...raw.fixture,
      date: raw.fixture.date ? new Date(raw.fixture.date) : null,
    };
  }
  return comp;
}

export function serializeRecopaNational(comp) {
  if (!comp) return null;
  return {
    seasonYear: comp.seasonYear,
    sourceSeason: comp.sourceSeason,
    brasileiroChampion: comp.brasileiroChampion,
    copaChampion: comp.copaChampion,
    skippedSameClub: !!comp.skippedSameClub,
    champion: comp.champion || null,
    complete: !!comp.complete,
    ready: !!comp.ready,
    fixture: comp.fixture
      ? {
          ...comp.fixture,
          date: comp.fixture.date ? new Date(comp.fixture.date).toISOString() : null,
        }
      : null,
  };
}

export function recopaNationalFixtures(comp) {
  return comp?.fixture ? [comp.fixture] : [];
}

export function recopaBracketTie(comp) {
  const game = comp?.fixture;
  if (!game?.home || !game?.away) return null;
  const homeGoals = game.completed || game.homeGoals != null ? Number(game.homeGoals ?? 0) : null;
  const awayGoals = game.completed || game.awayGoals != null ? Number(game.awayGoals ?? 0) : null;
  return {
    tieId: game.tieId || 'RECOPA-NAC',
    completed: !!game.completed,
    sideA: {
      name: game.home,
      aggregate: homeGoals,
      winner: game.completed && homeGoals != null && awayGoals != null ? homeGoals > awayGoals : false,
    },
    sideB: {
      name: game.away,
      aggregate: awayGoals,
      winner: game.completed && homeGoals != null && awayGoals != null ? awayGoals > homeGoals : false,
    },
  };
}

export function completeRecopaNationalFixture(comp, game) {
  if (!comp?.fixture || !game) return comp;
  if (game.home !== comp.fixture.home || game.away !== comp.fixture.away) return comp;
  comp.fixture = { ...comp.fixture, ...game, completed: true };
  const hg = Number(comp.fixture.homeGoals ?? 0);
  const ag = Number(comp.fixture.awayGoals ?? 0);
  if (hg === ag && comp.fixture.shootoutWinner) {
    comp.champion = comp.fixture.shootoutWinner;
  } else {
    comp.champion = hg > ag ? comp.fixture.home : comp.fixture.away;
  }
  comp.complete = true;
  return comp;
}
