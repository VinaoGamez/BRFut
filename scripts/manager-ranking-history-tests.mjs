import assert from 'node:assert/strict';
import { createManagerRankingEngine } from '../js/engine/manager-ranking.js';
import { slimSeasonForCloudUpload } from '../js/core/cloud-save-payload.js';

const engine = createManagerRankingEngine({ getSeed: () => 42 });
engine.ensurePool({ clubNames: ['Clube A'], clubDivisions: { 'Clube A': 'A' } });
const manager = engine.byClub('Clube A');
const titles = Array.from({ length: 15 }, (_, index) => ({
  id: `2028:title:${index}`,
  competition: `Taça ${index + 1}`,
  club: 'Clube A',
}));
engine.finalizeSeason({
  season: 2028,
  summariesByClub: { 'Clube A': { club: 'Clube A', games: 50, wins: 30, draws: 10, losses: 10 } },
  titles,
});
const snapshot = engine.snapshot();
assert.equal(snapshot.managers.find(item => item.id === manager.id).titles.length, 15);
assert.equal(snapshot.managers.find(item => item.id === manager.id).careerHistory.seasons[0].titles.length, 15);

const restored = createManagerRankingEngine({ getSeed: () => 42 });
restored.ensurePool({
  clubNames: ['Clube A'],
  clubDivisions: { 'Clube A': 'A' },
  stored: { managers: [{ ...snapshot.managers[0], careerHistory: null }] },
});
assert.equal(restored.byClub('Clube A').careerHistory.seasons[0].titles.length, 15);

const managerRanking = snapshot;
const cloud = slimSeasonForCloudUpload({
  seed: 1,
  userClubName: 'Clube A',
  managerRanking,
  standings: {},
  stateLeagues: {},
  padding: 'x'.repeat(500_000),
});
assert.deepEqual(cloud.managerRanking, managerRanking);

console.log('Manager ranking history tests passed.');
