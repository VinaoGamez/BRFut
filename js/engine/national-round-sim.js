import { MEMORY_LIMITS } from '../core/save.js';
import { clamp } from '../ui/dom.js';

function applySecondaryResult(deps, game, competition) {
  const homeRow = competition.standings.find(row => row.club === game.home);
  const awayRow = competition.standings.find(row => row.club === game.away);
  if (!homeRow || !awayRow) return;
  homeRow.played += 1;
  awayRow.played += 1;
  homeRow.goalDiff += game.homeGoals - game.awayGoals;
  awayRow.goalDiff += game.awayGoals - game.homeGoals;
  if (game.homeGoals > game.awayGoals) {
    homeRow.wins += 1;
    awayRow.losses += 1;
    homeRow.points += 3;
  } else if (game.homeGoals < game.awayGoals) {
    awayRow.wins += 1;
    homeRow.losses += 1;
    awayRow.points += 3;
  } else {
    homeRow.draws += 1;
    awayRow.draws += 1;
    homeRow.points += 1;
    awayRow.points += 1;
  }
  if (game.fatigueAfter) {
    [['home', game.home], ['away', game.away]].forEach(([side, clubName]) => {
      Object.entries(game.fatigueAfter[side] || {}).forEach(([playerName, value]) => {
        const player = deps.getClubs()[clubName]?.roster?.find(candidate => candidate.name === playerName);
        if (player) player.fatigue = clamp(value, 0, 100);
      });
    });
  }
  deps.applyMatchAvailability(game, game.fixture || game);
}

/**
 * Simula rodada nacional nas divisões que não são a do usuário.
 */
export function createNationalRoundSimulator(deps) {
  const simulateNationalRound = () => {
    const userDivision = deps.getUserDivision();
    const currentRound = deps.getCurrentRound();
    const nationalCompetitions = deps.getNationalCompetitions();
    const competitionRoundHistory = deps.getCompetitionRoundHistory();
    const roundPreviewResults = deps.getRoundPreviewResults();
    const clubs = deps.getClubs();

    Object.keys(nationalCompetitions)
      .filter(division => division !== userDivision)
      .forEach(division => {
        const competition = nationalCompetitions[division];
        const fixtures = (Array.isArray(competition?.fixtures) ? competition.fixtures : [])[currentRound - 1] || [];
        if (!fixtures.length) return;
        const previewKey = `${division}-${currentRound}`;
        const playable = fixtures.filter(game => game?.home && game?.away && clubs[game.home] && clubs[game.away]);
        const results = roundPreviewResults[previewKey] || playable.map(game => deps.simulateRoundMatch(game.home, game.away, game));
        results.forEach(deps.recordGameLeaders);
        if (division !== 'D' || currentRound <= 10) {
          results.forEach(game => applySecondaryResult(deps, game, competition));
        }
        deps.creditLeagueHomeTvForGames(results, division);
        competition.standings.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.wins - a.wins);
        competition.standings.forEach((row, index) => {
          if (clubs[row.club]) clubs[row.club].position = index + 1;
        });
        if (!competitionRoundHistory[division]) competitionRoundHistory[division] = [];
        competitionRoundHistory[division].push({
          round: currentRound,
          games: results.map(game => deps.compactMatchResult(game, { keepData: false })),
        });
        if (competitionRoundHistory[division].length > MEMORY_LIMITS.seasonRoundHistory) {
          competitionRoundHistory[division].splice(
            0,
            competitionRoundHistory[division].length - MEMORY_LIMITS.seasonRoundHistory,
          );
        }
      });
    deps.persistPlayerHistory();
  };

  return { simulateNationalRound, applySecondaryResult: (game, competition) => applySecondaryResult(deps, game, competition) };
}
