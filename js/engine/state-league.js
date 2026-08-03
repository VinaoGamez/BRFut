/**
 * Motor dos campeonatos estaduais — 27 UFs, simulação rodada a rodada, persistência.
 */

import { compactMatchResult } from '../core/save.js';
import {
  STATE_LEAGUE_COMPETITION,
  applyResultToStanding,
  buildAllStateCompetitions,
  buildFinalFixture,
  buildQuarterfinalFixtures,
  buildSemifinalFixtures,
  buildSemifinalFixturesFromWinners,
  groupQualifiers,
  isPaulistaFormat,
  isStateLeagueGame,
  leagueQualifiers,
  leagueRoundCountFor,
  parseStateCompetitionKey,
  sanitizeCompetitionsByUf,
  sortStandingsRows,
  stateCompetitionKey,
  stateLeagueLabel,
  stateRoundPhaseLabel,
  stateKnockoutPhaseTitle,
  repairStateLeagueCompetitionCalendar,
} from './state-league-format.js';
import {
  buildStateRnfQualifiersByUf,
  rankStateRnfCandidates,
  stateLeagueAffectsSerieD,
} from './state-league-rnf.js';
import { ensureStateCopaSlot } from './state-league-copa-slots.js';
import {
  applyShootoutToDecidingGame,
  clearStaleKnockoutShootout,
  isStateKnockoutPhase,
} from './knockout-shootout.js';
import { simulateProbabilisticShootout } from './shootout-sim.js';
import { getRealClub, normClubName, BRAZILIAN_UFS } from './brazilian-clubs-by-uf.js';

function normalizeNoon(date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

function findDivision(competitions, uf, tier = 1) {
  const list = competitions[uf] || [];
  return list.find(item => (item.tier || 1) === tier) || list[0] || null;
}

function findUserDivision(competitions, userClub, userUf) {
  const uf = String(userUf || getRealClub(userClub)?.uf || 'SP').toUpperCase();
  const list = competitions[uf] || [];
  return list.find(item => item.teams.some(name => normClubName(name) === normClubName(userClub))) || null;
}

function roundGames(competition, round) {
  return (competition.fixtures[round - 1] || []).filter(game => game?.home && game?.away);
}

function finalizeKnockoutGame(game, homeGoals, awayGoals) {
  Object.assign(game, { homeGoals, awayGoals, completed: true });
  if (game.shootoutWinner) return;
  if (homeGoals === awayGoals) {
    const shootout = simulateProbabilisticShootout([game.home, game.away]);
    if (shootout?.winner) {
      applyShootoutToDecidingGame(game, shootout.winner, shootout.scores);
      return;
    }
  }
  clearStaleKnockoutShootout(game);
}

function repairKnockoutShootouts(competition) {
  (competition.fixtures || []).flat().forEach(game => {
    if (!isStateKnockoutPhase(game) || !game.completed) return;
    if (game.homeGoals !== game.awayGoals) {
      clearStaleKnockoutShootout(game);
      return;
    }
    if (game.shootoutWinner) return;
    finalizeKnockoutGame(game, game.homeGoals, game.awayGoals);
  });
}

function recordGame(competition, game, homeGoals, awayGoals, completed = true) {
  if (isStateKnockoutPhase(game)) {
    finalizeKnockoutGame(game, homeGoals, awayGoals);
    return;
  }
  Object.assign(game, { homeGoals, awayGoals, completed });
  if (game.phase === 'league' || (game.phase === 'groups' && !Number.isFinite(game.groupIndex))) {
    const table = competition.standings?.[0];
    if (!table) return;
    const homeRow = table.find(row => row.club === game.home);
    const awayRow = table.find(row => row.club === game.away);
    if (homeRow && awayRow) {
      applyResultToStanding(homeRow, homeGoals, awayGoals);
      applyResultToStanding(awayRow, awayGoals, homeGoals);
    }
    return;
  }
  if (game.phase === 'groups' && Number.isFinite(game.groupIndex)) {
    const homeRow = competition.standings[game.groupIndex]?.find(row => row.club === game.home);
    const awayRow = competition.standings[game.groupIndex]?.find(row => row.club === game.away);
    if (homeRow && awayRow) {
      applyResultToStanding(homeRow, homeGoals, awayGoals);
      applyResultToStanding(awayRow, awayGoals, homeGoals);
    }
  }
}

function knockoutWinner(game) {
  if (game.shootoutWinner) return game.shootoutWinner;
  if (game.homeGoals > game.awayGoals) return game.home;
  if (game.awayGoals > game.homeGoals) return game.away;
  return game.home;
}

function maybeAdvanceKnockout(competition) {
  if (competition.complete) return false;
  const leagueRounds = leagueRoundCountFor(competition);
  const paulista = isPaulistaFormat(competition);
  if (competition.phase === 'league' || competition.phase === 'groups') {
    const allDone = competition.fixtures
      .slice(0, leagueRounds)
      .every(round => (round || []).every(game => game.completed));
    if (!allDone) return false;
    if (paulista) {
      const qualifiers = groupQualifiers(competition);
      const qfRound = leagueRounds + 1;
      const qfSlot = competition.calendarSlots?.[leagueRounds];
      const quarters = buildQuarterfinalFixtures(qualifiers, competition.uf, qfRound, qfSlot);
      if (!quarters.length) {
        competition.complete = true;
        return true;
      }
      competition.phase = 'quarters';
      competition.fixtures[qfRound - 1] = quarters;
      competition.knockout.quarters = quarters;
      return true;
    }
    const topFour = leagueQualifiers(competition);
    const semiRound = leagueRounds + 1;
    const semiSlot = competition.calendarSlots?.[leagueRounds];
    const semis = buildSemifinalFixtures(topFour, competition.uf, semiRound, semiSlot);
    if (!semis.length) {
      competition.complete = true;
      return true;
    }
    competition.phase = 'semis';
    competition.fixtures[semiRound - 1] = semis;
    competition.knockout.semis = semis;
    return true;
  }
  if (competition.phase === 'quarters') {
    const qfRound = leagueRounds + 1;
    const quarters = roundGames(competition, qfRound);
    if (!quarters.every(game => game.completed)) return false;
    const winners = quarters.map(knockoutWinner);
    const semiRound = leagueRounds + 2;
    const semiSlot = competition.calendarSlots?.[leagueRounds + 1];
    const semis = buildSemifinalFixturesFromWinners(winners, competition.uf, semiRound, semiSlot);
    competition.phase = 'semis';
    competition.fixtures[semiRound - 1] = semis;
    competition.knockout.semis = semis;
    return true;
  }
  if (competition.phase === 'semis') {
    const semiRound = paulista ? leagueRounds + 2 : leagueRounds + 1;
    const semis = roundGames(competition, semiRound);
    if (!semis.every(game => game.completed)) return false;
    const winners = semis.map(knockoutWinner);
    competition.semifinalists = semis.flatMap(game => [game.home, game.away]);
    const finalRound = paulista ? leagueRounds + 3 : leagueRounds + 2;
    const finalSlot = competition.calendarSlots?.[paulista ? leagueRounds + 2 : leagueRounds + 1];
    const finalGames = buildFinalFixture(winners, competition.uf, finalRound, finalSlot);
    competition.phase = 'final';
    competition.fixtures[finalRound - 1] = finalGames;
    competition.knockout.final = finalGames;
    return true;
  }
  if (competition.phase === 'final') {
    const finalRound = paulista ? leagueRounds + 3 : leagueRounds + 2;
    const finalGames = roundGames(competition, finalRound);
    if (!finalGames.every(game => game.completed)) return false;
    const game = finalGames[0];
    competition.champion =
      game.shootoutWinner || (game.homeGoals >= game.awayGoals ? game.home : game.away);
    competition.runnerUp =
      competition.champion === game.home ? game.away : game.home;
    competition.complete = true;
    ensureStateCopaSlot(competition);
    return true;
  }
  return false;
}

export function createStateLeagueEngine() {
  /** @type {Record<string, object[]>} */
  let byUf = {};
  /** @type {Record<string, Array<{round:number,games:object[]}>>} */
  let historyByUf = {};
  let userUf = 'SP';
  let seasonYear = 2026;

  const rebuildLabels = uf => {
    const tierCount = (byUf[uf] || []).length;
    (byUf[uf] || []).forEach(item => {
      item.label = stateLeagueLabel(uf, item.tier || 1, tierCount);
    });
  };

  const repairAllCompetitions = () => {
    Object.values(byUf)
      .flat()
      .forEach(competition => {
        repairStateLeagueCompetitionCalendar(competition, seasonYear);
        let advanced = true;
        while (advanced) {
          advanced = maybeAdvanceKnockout(competition);
          if (advanced) repairStateLeagueCompetitionCalendar(competition, seasonYear);
        }
        repairKnockoutShootouts(competition);
      });
  };

  const build = ({
    clubs,
    regionalBaseClubs,
    importClubs = [],
    seasonYear: season,
    userUf: originUf,
    userClub,
    membershipByUf = {},
    lotterySeed = null,
  }) => {
    seasonYear = Number(season) || 2026;
    userUf = String(originUf || getRealClub(userClub)?.uf || 'SP').toUpperCase();
    byUf = buildAllStateCompetitions({
      clubs,
      regionalBaseClubs,
      importClubs,
      seasonYear,
      userClub,
      userUf,
      membershipByUf,
      lotterySeed,
    });
    Object.keys(byUf).forEach(rebuildLabels);
    historyByUf = {};
    return byUf;
  };

  const hydrate = (saved, { userUf: originUf, seasonYear: season, clubs = {} } = {}) => {
    if (!saved || typeof saved !== 'object') return false;
    byUf = sanitizeCompetitionsByUf(saved.competitions || {}, clubs);
    historyByUf = saved.historyByUf || {};
    userUf = String(originUf || saved.userUf || 'SP').toUpperCase();
    seasonYear = Number(season || saved.seasonYear) || 2026;
    Object.keys(byUf).forEach(rebuildLabels);
    repairAllCompetitions();
    return true;
  };

  /** Preenche UFs ausentes no save (ex.: checkpoint na nuvem só com UF do usuário). */
  const ensureAllCompetitions = ({
    clubs,
    regionalBaseClubs = [],
    importClubs = [],
    userClub,
    membershipByUf = {},
    lotterySeed = null,
  } = {}) => {
    const missing = BRAZILIAN_UFS.filter(item => !(byUf[item.code]?.length));
    if (!missing.length) return false;
    const full = buildAllStateCompetitions({
      clubs,
      regionalBaseClubs,
      importClubs,
      seasonYear,
      userClub,
      userUf,
      membershipByUf,
      lotterySeed,
    });
    missing.forEach(item => {
      if (full[item.code]?.length) byUf[item.code] = full[item.code];
    });
    Object.keys(byUf).forEach(rebuildLabels);
    repairAllCompetitions();
    return true;
  };

  const serialize = ({ all = false } = {}) => ({
    seasonYear,
    userUf,
    competitions: all ? byUf : (byUf[userUf]?.length ? { [userUf]: byUf[userUf] } : {}),
    historyByUf: all ? historyByUf : (historyByUf[userUf]?.length ? { [userUf]: historyByUf[userUf] } : {}),
    results: exportSeasonResults(),
  });

  const exportSeasonResults = () => {
    const out = {};
    Object.entries(byUf).forEach(([uf, divisions]) => {
      out[uf] = (divisions || []).map(division => ({
        uf,
        tier: division.tier || 1,
        champion: division.champion || null,
        runnerUp: division.runnerUp || null,
        semifinalists: [...(division.semifinalists || [])],
        copaSlot: division.copaSlot || null,
        complete: !!division.complete,
      }));
    });
    return out;
  };

  const getUserDivision = userClub => findUserDivision(byUf, userClub, userUf);

  const allFixturesFlat = () =>
    Object.values(byUf)
      .flat()
      .flatMap(competition => competition.fixtures || [])
      .flat()
      .filter(Boolean);

  const getUserFixtures = userClub => {
    const division = getUserDivision(userClub);
    if (!division) return [];
    return (division.fixtures || []).flat().filter(game => game.home === userClub || game.away === userClub);
  };

  const getUserPendingRound = userClub => {
    const division = getUserDivision(userClub);
    if (!division || division.complete) return null;
    for (let round = 1; round <= (division.fixtures || []).length; round += 1) {
      const games = roundGames(division, round);
      const userGames = games.filter(game => game.home === userClub || game.away === userClub);
      if (!userGames.length) continue;
      if (userGames.some(game => !game.completed)) return round;
    }
    return null;
  };

  const isGameComplete = (game, userClub) => {
    if (!isStateLeagueGame(game)) return false;
    const uf = game.stateUf || getRealClub(userClub)?.uf;
    const division = findDivision(byUf, uf, game.stateTier || 1);
    if (!division) return false;
    const live = (division.fixtures[game.round - 1] || []).find(
      item => item.home === game.home && item.away === game.away,
    );
    if (live?.completed) return true;
    const history = (historyByUf[uf] || []).find(item => item.round === game.round);
    return !!history?.games?.some(entry => entry.home === game.home && entry.away === game.away);
  };

  const simulateDivisionRound = (competition, round, simulateMatch, { skipUserClub = null } = {}) => {
    const games = roundGames(competition, round);
    const results = [];
    games.forEach(game => {
      if (game.completed) return;
      if (skipUserClub && (game.home === skipUserClub || game.away === skipUserClub)) return;
      const result = simulateMatch(game.home, game.away, game);
      recordGame(competition, game, result.homeGoals, result.awayGoals, true);
      results.push({ ...result, game });
    });
    maybeAdvanceKnockout(competition);
    return results;
  };

  const commitRound = (
    round,
    {
      simulateMatch,
      userClub,
      recordLeaders,
      persistHistory = true,
      userLiveGame = null,
      scopeUf = null,
    } = {},
  ) => {
    const snapshots = [];
    Object.entries(byUf).forEach(([uf, divisions]) => {
      if (scopeUf && String(uf).toUpperCase() !== String(scopeUf).toUpperCase()) return;
      divisions.forEach(competition => {
        if (competition.complete) return;
        const games = roundGames(competition, round);
        if (!games.length) return;
        if (userLiveGame && userLiveGame.round === round) {
          const target = games.find(
            game => game.home === userLiveGame.home && game.away === userLiveGame.away,
          );
          if (target && !target.completed) {
            if (userLiveGame.shootoutWinner) {
              Object.assign(target, {
                homeGoals: userLiveGame.homeGoals,
                awayGoals: userLiveGame.awayGoals,
                completed: true,
                shootoutWinner: userLiveGame.shootoutWinner,
                shootoutPenalties: userLiveGame.shootoutPenalties || userLiveGame.penalties,
                penalties: userLiveGame.penalties || userLiveGame.shootoutPenalties,
                winner: userLiveGame.shootoutWinner,
              });
            } else {
              recordGame(competition, target, userLiveGame.homeGoals, userLiveGame.awayGoals, true);
            }
            if (userLiveGame.data) target.data = { ...userLiveGame.data };
            if (userLiveGame.goals) {
              target.goals = {
                home: [...(userLiveGame.goals.home || [])],
                away: [...(userLiveGame.goals.away || [])],
              };
            }
          }
        }
        const results = simulateDivisionRound(competition, round, simulateMatch, { skipUserClub: userClub });
        results.forEach(recordLeaders);
        if (persistHistory) {
          if (!historyByUf[uf]) historyByUf[uf] = [];
          const existing = historyByUf[uf].find(item => item.round === round);
          const payload = {
            round,
            games: games.map(game =>
              compactMatchResult(
                {
                  home: game.home,
                  away: game.away,
                  homeGoals: game.homeGoals,
                  awayGoals: game.awayGoals,
                  competition: game.competition,
                  phase: game.phase,
                  round: game.round,
                  penalties: game.penalties,
                  shootoutWinner: game.shootoutWinner,
                  shootoutPenalties: game.shootoutPenalties,
                  completed: game.completed,
                  data: game.data,
                  goals: game.goals,
                },
                { keepData: game.home === userClub || game.away === userClub },
              ),
            ),
          };
          if (existing) Object.assign(existing, payload);
          else historyByUf[uf].push(payload);
        }
        snapshots.push({ uf, tier: competition.tier, round, results });
      });
    });
    return snapshots;
  };

  const getRoundLimit = competitionId => {
    const division = getDivisionForBrowse(competitionId);
    return Math.max(1, division?.fixtures?.length || 1);
  };

  const getCurrentRound = (competitionId, userClubName) => {
    const division = getDivisionForBrowse(competitionId, userClubName);
    if (!division) return 1;
    if (division.complete) return division.fixtures?.length || 1;
    for (let round = 1; round <= (division.fixtures || []).length; round += 1) {
      const games = roundGames(division, round);
      if (games.some(game => !game.completed)) return round;
    }
    return division.fixtures?.length || 1;
  };

  const getRoundPhaseLabel = (competitionId, round) => {
    const division = getDivisionForBrowse(competitionId);
    return stateRoundPhaseLabel(division, round);
  };

  const getKnockoutPhaseTitle = (competitionId, round) => {
    const division = getDivisionForBrowse(competitionId);
    return stateKnockoutPhaseTitle(division, round);
  };

  const getRoundGamesForBrowse = (competitionId, round, { simulateMatch } = {}) => {
    const parsed = parseStateCompetitionKey(competitionId);
    if (!parsed) return [];
    const division = findDivision(byUf, parsed.uf, parsed.tier);
    if (!division) return [];
    const history = (historyByUf[parsed.uf] || []).find(item => item.round === round);
    const games = roundGames(division, round);
    if (history?.games?.length) {
      return history.games
        .filter(game => game?.home && game?.away)
        .map(game => ({
        home: game.home,
        away: game.away,
        homeGoals: game.homeGoals,
        awayGoals: game.awayGoals,
        penalties: game.penalties || game.shootoutPenalties || null,
        shootoutWinner: game.shootoutWinner || null,
        completed: true,
        round,
        competition: game.competition,
        phase: game.phase,
        game,
      }));
    }
    return games
      .filter(game => game?.home && game?.away)
      .map(game => {
      if (game.completed) {
        return {
          home: game.home,
          away: game.away,
          homeGoals: game.homeGoals,
          awayGoals: game.awayGoals,
          penalties: game.penalties || game.shootoutPenalties || null,
          shootoutWinner: game.shootoutWinner || null,
          completed: true,
          round,
          competition: game.competition,
          phase: game.phase,
          game,
        };
      }
      if (simulateMatch) {
        const result = simulateMatch(game.home, game.away, game);
        return {
          ...result,
          completed: false,
          scheduled: true,
          round,
          competition: game.competition,
          phase: game.phase,
          game,
        };
      }
      return {
        home: game.home,
        away: game.away,
        homeGoals: null,
        awayGoals: null,
        scheduled: true,
        round,
        competition: game.competition,
        phase: game.phase,
        game,
      };
    });
  };

  const previewRound = (uf, round, simulateMatch, tier = 1) => {
    return getRoundGamesForBrowse(stateCompetitionKey(uf, tier), round, { simulateMatch });
  };

  const getDivisionForBrowse = (competitionId, userClub) => {
    const parsed = parseStateCompetitionKey(competitionId);
    if (parsed) return findDivision(byUf, parsed.uf, parsed.tier);
    if (competitionId === 'EST' || competitionId === 'STATE') return getUserDivision(userClub);
    return null;
  };

  const getRnfQualifiers = season =>
    buildStateRnfQualifiersByUf(byUf, Number(season) || seasonYear);

  const getBrowseOptions = userClub => {
    const options = [];
    Object.entries(byUf).forEach(([uf, divisions]) => {
      divisions.forEach(division => {
        options.push({
          id: stateCompetitionKey(uf, division.tier || 1),
          label: division.label || stateLeagueLabel(uf, division.tier || 1, divisions.length),
          uf,
          tier: division.tier || 1,
          isUser: division.teams.some(name => normClubName(name) === normClubName(userClub)),
        });
      });
    });
    return options.sort((a, b) => a.uf.localeCompare(b.uf, 'pt-BR') || a.tier - b.tier);
  };

  const getTiersForUf = uf => (byUf[String(uf || '').toUpperCase()] || []).map(item => item.tier || 1);

  const getGroupRows = (competitionId, groupIndex = 0) => {
    const division = getDivisionForBrowse(competitionId);
    const rows = division?.standings?.[groupIndex] || [];
    return sortStandingsRows([...rows]);
  };

  const getHubStates = userClubName => {
    const normUser = normClubName(userClubName);
    return BRAZILIAN_UFS.map(item => {
      const divisions = byUf[item.code] || [];
      return {
        code: item.code,
        name: item.name,
        available: divisions.length > 0,
        tierCount: divisions.length,
        isUser: divisions.some(division =>
          (division.teams || []).some(name => normClubName(name) === normUser),
        ),
      };
    });
  };

  const advanceThroughDate = (date, { simulateMatch, userClub: skipUserClub = null } = {}) => {
    if (!date || !simulateMatch) return false;
    const refTs = normalizeNoon(date).getTime();
    let changed = false;
    let passChanged = true;
    while (passChanged) {
      passChanged = false;
      Object.values(byUf)
        .flat()
        .forEach(competition => {
          if (competition.complete) return;
          for (let round = 1; round <= (competition.fixtures || []).length; round += 1) {
            const games = roundGames(competition, round);
            if (!games.length) continue;
            if (games.some(game => !game.date)) continue;
            const roundDue = games.every(
              game => normalizeNoon(game.date).getTime() <= refTs,
            );
            if (!roundDue) continue;
            if (games.every(game => game.completed)) {
              if (maybeAdvanceKnockout(competition)) {
                repairStateLeagueCompetitionCalendar(competition, seasonYear);
                passChanged = true;
              }
              continue;
            }
            const userPending =
              skipUserClub &&
              games.some(
                game =>
                  !game.completed &&
                  (game.home === skipUserClub || game.away === skipUserClub),
              );
            if (userPending) continue;
            const results = simulateDivisionRound(competition, round, simulateMatch, {
              skipUserClub: skipUserClub,
            });
            if (results.length) passChanged = true;
          }
        });
      changed = changed || passChanged;
    }
    return changed;
  };

  return {
    build,
    hydrate,
    ensureAllCompetitions,
    serialize,
    exportSeasonResults,
    get competitions() {
      return byUf;
    },
    get history() {
      return historyByUf;
    },
    get userUf() {
      return userUf;
    },
    isStateGame: isStateLeagueGame,
    getUserDivision,
    getUserFixtures,
    getUserPendingRound,
    isGameComplete,
    commitRound,
    previewRound,
    getDivisionForBrowse,
    getBrowseOptions,
    getTiersForUf,
    getGroupRows,
    getHubStates,
    getRnfQualifiers,
    getRoundLimit,
    getCurrentRound,
    getRoundPhaseLabel,
    getKnockoutPhaseTitle,
    getRoundGamesForBrowse,
    stateLeagueAffectsSerieD,
    rankStateRnfCandidates,
    allFixturesFlat,
    advanceThroughDate,
    resolveClubUf: () => null,
  };
}
