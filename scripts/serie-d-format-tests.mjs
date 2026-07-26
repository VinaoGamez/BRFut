import assert from 'node:assert/strict';
import { serieDPhaseIndexForRound } from '../js/engine/serie-d-format.js';

assert.equal(serieDPhaseIndexForRound(10), 1);
assert.equal(serieDPhaseIndexForRound(12), 1);
assert.equal(serieDPhaseIndexForRound(13), 2);
assert.equal(serieDPhaseIndexForRound(21), 6);

console.log('serie-d-format-tests: 4/4 ok');
