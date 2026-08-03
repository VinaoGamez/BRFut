import assert from 'node:assert/strict';
import {
  clubStandingContext,
  resolveFixtureDivision,
} from '../js/feature/shared/match-presentation.js';
import { resolveSerieDChampion } from '../js/engine/season-transition.js';

const clubs = {
  'Vinaz Athletic Futebol': { name: 'Vinaz Athletic Futebol', division: 'D' },
  Brusque: { name: 'Brusque', division: 'C' },
};
const staleSerieDGroups = [['Vinaz Athletic Futebol']];
const serieCGame = {
  home: 'Vinaz Athletic Futebol',
  away: 'Brusque',
  competition: 'BRASILEIRÃO SÉRIE C',
  round: 45,
};

assert.equal(resolveFixtureDivision(serieCGame, 'C'), 'C');
assert.equal(
  clubStandingContext('Vinaz Athletic Futebol', clubs, staleSerieDGroups, serieCGame, 'C'),
  'Série C',
  'a competição atual deve prevalecer sobre a divisão antiga restaurada no clube',
);

assert.equal(resolveSerieDChampion({ champion: 'Floresta' }), 'Floresta');
assert.equal(resolveSerieDChampion({ champion: '' }), null);
assert.equal(resolveSerieDChampion({ stages: { final: [] } }), null);

console.log('division-information-flow-tests: OK');
