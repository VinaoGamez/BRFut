import assert from 'node:assert/strict';
import { resolveCardStatsBucket } from '../js/feature/player-card/roster-card-player.js';

const local = { apps: 8, goals: 3, assists: 2, avgRating: 7.1 };
const staleRemote = { apps: 7, goals: 2, assists: 2, avgRating: 6.9 };
const recoveredRemote = { apps: 10, goals: 4, assists: 3, avgRating: 7.2 };

assert.equal(resolveCardStatsBucket(local, staleRemote), local);
assert.equal(resolveCardStatsBucket(local, recoveredRemote), recoveredRemote);
assert.equal(resolveCardStatsBucket(local, null), local);
assert.equal(resolveCardStatsBucket(null, recoveredRemote), recoveredRemote);

console.log('player-card-stats-source-tests: OK');
