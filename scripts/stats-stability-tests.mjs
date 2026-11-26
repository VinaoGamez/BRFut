import assert from 'node:assert/strict';
import { createPlayerHistoryEngine, resolvePlayerSeasonStats } from '../js/engine/player-history.js';
import { rosterPlayerToCardPlayer } from '../js/feature/player-card/roster-card-player.js';
import { reclaimLocalStorageSpace, invalidateStoragePressureCache, writeJson } from '../js/core/save.js';
import { slimPlayerHistoryForCloudUpload } from '../js/core/cloud-save-payload.js';

const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
  key: index => [...memory.keys()][index] ?? null,
  get length() { return memory.size; },
};
globalThis.sessionStorage = { getItem: () => null };

// A large history, live match and inactive slot survive both reclaim modes.
memory.set('brfut-player-history', JSON.stringify({ padding: 'x'.repeat(126000) }));
memory.set('brfut-live-match', '{"minute":73}');
memory.set('brfut-slot-other-career', 'x'.repeat(2300000));
const original = new Map(memory);
for (const aggressive of [false, true]) {
  invalidateStoragePressureCache();
  reclaimLocalStorageSpace({ aggressive });
  for (const [key, value] of original) assert.equal(memory.get(key), value);
}
const setItem = localStorage.setItem;
localStorage.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
assert.equal(writeJson('brfut-season', { round: 3 }), false);
for (const [key, value] of original) assert.equal(memory.get(key), value);
localStorage.setItem = setItem;
memory.clear();
invalidateStoragePressureCache();

const homePlayer = { playerId: 'a', name: 'Atacante A', pos: 'ATA' };
const clubs = {
  A: { name: 'A', division: 'D', roster: [homePlayer] },
  B: { name: 'B', division: 'D', roster: [{ playerId: 'b', name: 'Atacante B', pos: 'ATA' }] },
};
const deps = { getClub: name => clubs[name], getMatchLogBudget: () => 1 };
let history = createPlayerHistoryEngine(deps);
const game = { home: 'A', away: 'B', homeGoals: 0, awayGoals: 0 };
const record = (id, extra = {}) => history.recordMatch(game, {
  id, season: 2026, competition: 'LEAGUE:D', persist: false, deferApi: true, ...extra,
});
const stats = () => resolvePlayerSeasonStats(history, 'a', 2026, null, { clubId: 'A' });
record('first');
record('second');
assert.equal(history.getStore().matchLogs.length, 1);
assert.equal(stats().apps, 2);
record('first');
assert.equal(stats().apps, 2, 'pruned match is not counted twice');

// Replacing a retained report must not erase the contribution of a pruned one.
record('second', { replaceExisting: true });
assert.equal(stats().apps, 2);
assert.equal(stats().minutes, 180);
assert.equal(stats().ratingCount, 2);
assert.ok(history.persist());
history = createPlayerHistoryEngine(deps);
record('first');
assert.equal(stats().apps, 2, 'ledger survives save/load');

const card = await rosterPlayerToCardPlayer(homePlayer, { playerHistory: history, careerSeason: 2026, clubName: 'A' });
assert.equal(card.cardStats.clubApps, 2);
const remoteCard = await rosterPlayerToCardPlayer(homePlayer, {
  careerSeason: 2026, remoteStats: { total: { apps: 3, goals: 2, assists: 1, avg_rating: 7.5 } },
});
assert.equal(remoteCard.cardStats.goals, 2);
assert.equal(remoteCard.cardStats.avgRating, 7.5);

// Existing saves gain a ledger from their available logs without resetting totals.
const saved = JSON.parse(memory.get('brfut-player-history'));
delete saved.processedMatches;
memory.set('brfut-player-history', JSON.stringify(saved));
history = createPlayerHistoryEngine(deps);
assert.equal(stats().apps, 2);
assert.ok(Object.hasOwn(history.getStore().processedMatches, 'second'));

const cloud = slimPlayerHistoryForCloudUpload({ ...saved, processedMatches: { first: 2026 }, padding: 'x'.repeat(1000000) });
assert.equal(cloud.processedMatches.first, 2026);
assert.equal(cloud.statsModelVersion, saved.statsModelVersion);
console.log('stats-stability: OK — reclaim, quota, deduplication, replacement, reload, migration and cards');
