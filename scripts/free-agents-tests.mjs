import assert from 'node:assert/strict';
import {
  createInitialFreeAgentsPool,
  releasePlayerToFreeAgents,
  removeFreeAgent,
  signFreeAgentsForAi,
} from '../js/engine/free-agents.js';
import { ensureYouthState, runYouthSeasonTransition } from '../js/engine/youth-academy.js';

const roster = (prefix, division, count = 22) => Array.from({ length: count }, (_, index) => ({
  playerId: `${prefix}-${index}`,
  name: `${prefix} ${index}`,
  pos: index < 2 ? 'GOL' : index < 6 ? 'ZAG' : 'MC',
  age: 25,
  overall: { A: 60, B: 48, C: 35, D: 18 }[division],
  potential: 65,
  wage: 1000,
  fatigue: 100,
}));

const clubs = {
  A1: { name: 'A1', division: 'A', power: 58, roster: roster('a', 'A') },
  B1: { name: 'B1', division: 'B', power: 46, roster: roster('b', 'B') },
  C1: { name: 'C1', division: 'C', power: 34, roster: roster('c', 'C') },
  D1: { name: 'D1', division: 'D', power: 16, roster: roster('d', 'D') },
};

const initial = createInitialFreeAgentsPool(clubs, { seed: 99, season: 2026, random: () => 0.42 });
for (const division of ['A', 'B', 'C', 'D']) {
  assert.equal(initial.filter(item => item.marketTier === division).length, 3, `10% arredondado na faixa ${division}`);
}
assert.equal(new Set(initial.map(item => item.playerId)).size, initial.length, 'IDs dos livres devem ser únicos');

const released = { playerId: 'released-1', name: 'Dispensado', pos: 'ATA', age: 19, overall: 40, potential: 58, wage: 500 };
const result = releasePlayerToFreeAgents(initial, released, { formerClub: 'B1', division: 'B', season: 2026 });
assert.equal(result.ok, true);
assert.equal(result.entry.player.freeAgent, true);
assert.equal(result.entry.playerId, 'released-1');
assert.equal(result.entry.marketValue > 0, true);
assert.equal(result.entry.wageDemand > 0, true);
assert.equal(removeFreeAgent(initial, 'released-1')?.playerId, 'released-1');

const ai = { AI: { name: 'AI', division: 'D', roster: roster('ai', 'D', 18) } };
const moves = signFreeAgentsForAi(ai, initial, { season: 2026, userClub: 'Outro', targetRoster: 22 });
assert.equal(moves.length, 4);
assert.equal(ai.AI.roster.length, 22);

const youthClub = { name: 'Base IA', division: 'C', roster: roster('pro', 'C', 20), stadiumStructure: 2 };
ensureYouthState(youthClub);
const world = { 'Base IA': youthClub };
const summary = runYouthSeasonTransition(world, { userClub: 'Usuário', season: 2027, random: () => 0.5 });
assert.equal(youthClub.aiYouthInitialized, true);
assert.equal(youthClub.stadiumStructure >= 3, true);
assert.equal(summary.intakes > 0, true);

console.log('free-agents-tests: ok');
