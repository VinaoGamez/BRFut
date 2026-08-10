import assert from 'node:assert/strict';
import { buildClubHistory } from '../js/engine/club-history.js';

const league = { id: 'league-1', season: 2028, competition: 'C', home: 'Meu Clube', away: 'Rival', homeGoals: 2, awayGoals: 0 };
const cup = { id: 'cup-1', season: 2028, competition: 'CUP', home: 'Meu Clube', away: 'Outro', homeGoals: 1, awayGoals: 1 };
const current = buildClubHistory({
  clubName: 'Meu Clube',
  currentSeason: 2028,
  currentStanding: { club: 'Meu Clube', division: 'C', played: 10, wins: 5, draws: 3, losses: 2 },
  currentLogs: [league, league, cup, cup],
})[0];
assert.deepEqual(
  { played: current.played, wins: current.wins, draws: current.draws, losses: current.losses },
  { played: 11, wins: 5, draws: 4, losses: 2 },
  'classificação da liga não pode ser duplicada e logs repetidos devem ser ignorados',
);

const archived = buildClubHistory({
  clubName: 'Meu Clube', currentSeason: 2029,
  archives: [{
    careerSeason: 2028,
    standings: { C: [{ club: 'Meu Clube', played: 1, wins: 1, draws: 0, losses: 0 }] },
    champions: { WORLD_CUP: 'Meu Clube' },
    worldCupCompetition: { fixtures: [{ home: 'Meu Clube', away: 'Mundo', homeGoals: 3, awayGoals: 1 }] },
  }],
})[1];
assert.equal(archived.played, 2, 'Mundial deve compor o total histórico de partidas');
assert.ok(archived.competitions.includes('Mundial de Clubes'));
console.log('club history tests passed');
