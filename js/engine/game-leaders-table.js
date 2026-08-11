import { clamp } from '../ui/dom.js';

/**
 * Artilharia/assistências pós-jogo e atualização da tabela da divisão do usuário.
 */
export function createGameLeadersTable(deps) {
  const recordGameLeaders = game => {
    if (!game?.home || !game?.away) return;
    const rosterFor = clubName =>
      deps.getClubs()[clubName]?.roster || deps.getNationalTeamClub(clubName)?.roster || null;
    const allScorers = deps.getAllScorers();
    const allAssistants = deps.getAllAssistants();
    [game.home, game.away].forEach(clubName => {
      const roster = rosterFor(clubName);
      if (!Array.isArray(roster)) return;
      roster.slice(0, 11).forEach(player => {
        const scorer = allScorers.find(item => item.club === clubName && item.name === player.name);
        const assistant = allAssistants.find(item => item.club === clubName && item.name === player.name);
        if (scorer) scorer.games += 1;
        if (assistant) assistant.games += 1;
      });
    });
    if (game.goals) {
      [['home', game.home], ['away', game.away]].forEach(([side, clubName]) => {
        const roster = rosterFor(clubName);
        if (!Array.isArray(roster)) return;
        (game.goals[side] || []).forEach(goal => {
          if (goal?.type === 'own') return;
          const started = name => roster.slice(0, 11).some(player => player.name === name);
          let scorer = allScorers.find(item => item.club === clubName && item.name === goal.name);
          if (!scorer) {
            const player = roster.find(item => item.name === goal.name);
            const division =
              deps.getClubs()[clubName]?.division ||
              deps.getNationalTeamClub(clubName)?.division ||
              deps.getUserDivision();
            scorer = {
              name: goal.name,
              club: clubName,
              division,
              games: 1,
              goals: 0,
              tieValue: (player?.finishing || 50) + (player?.heading || 50) * 0.2,
            };
            allScorers.push(scorer);
          } else if (!started(goal.name)) {
            scorer.games += 1;
          }
          scorer.goals += 1;
          if (goal.assist) {
            let assistant = allAssistants.find(item => item.club === clubName && item.name === goal.assist);
            if (!assistant) {
              const player = roster.find(item => item.name === goal.assist);
              const division =
                deps.getClubs()[clubName]?.division ||
                deps.getNationalTeamClub(clubName)?.division ||
                deps.getUserDivision();
              assistant = {
                name: goal.assist,
                club: clubName,
                division,
                games: 1,
                assists: 0,
                tieValue: (player?.passing || 50) + (player?.playmaking || 50),
              };
              allAssistants.push(assistant);
            } else if (!started(goal.assist)) {
              assistant.games += 1;
            }
            assistant.assists += 1;
          }
        });
      });
    }
    allScorers.sort((a, b) => b.goals - a.goals || b.tieValue - a.tieValue || a.games - b.games);
    allAssistants.sort((a, b) => b.assists - a.assists || b.tieValue - a.tieValue || a.games - b.games);
    deps.recordPlayerHistoryMatch(game, {
      persist: false,
      apiOnly: typeof deps.shouldStoreMatchLocally === 'function'
        ? !deps.shouldStoreMatchLocally(game)
        : false,
      round: game.round ?? deps.getCurrentRound(),
      competition: game.competition,
      leg: game.leg,
    });
  };

  const applyRoundToTable = game => {
    const userDivision = deps.getUserDivision();
    const nationalCompetitions = deps.getNationalCompetitions();
    const table = userDivision === 'D' ? nationalCompetitions.D.standings : deps.getLeagueData();
    const emptyRow = club => ({ club, played: 0, wins: 0, draws: 0, losses: 0, goalDiff: 0, points: 0 });
    let homeRow = table.find(row => row.club === game.home);
    let awayRow = table.find(row => row.club === game.away);
    if (!homeRow) {
      homeRow = emptyRow(game.home);
      table.push(homeRow);
    }
    if (!awayRow) {
      awayRow = emptyRow(game.away);
      table.push(awayRow);
    }
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
  };

  return { recordGameLeaders, applyRoundToTable };
}
