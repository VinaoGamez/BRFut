/**
 * Testes leves — seed + regras de persistência (sem importar player-generation).
 * node scripts/regional-club-roster-tests.mjs
 */

import assert from 'node:assert/strict';
import { rosterSeedKey, hashSeedString } from '../js/engine/club-roster-seed.js';

const NATIONAL = new Set(['A', 'B', 'C', 'D']);

function shouldPersistWorldRoster(_name, club) {
  if (!Array.isArray(club?.roster) || club.roster.length < 11) return false;
  if (NATIONAL.has(club.division)) return true;
  return !!club._rosterPersist;
}

function collectWorldRosters(clubs, options = {}) {
  const skip = options.skipClub || null;
  const filter = options.filter || shouldPersistWorldRoster;
  const out = { ...(options.merge && typeof options.merge === 'object' ? options.merge : {}) };
  Object.entries(clubs || {}).forEach(([clubName, club]) => {
    if (skip && clubName === skip) return;
    if (!filter(clubName, club)) return;
    out[clubName] = club.roster.map(p => ({ name: p.name, overall: p.overall, pos: p.pos }));
  });
  return out;
}

{
  const clubs = {
    Nacional: { division: 'C', roster: Array.from({ length: 18 }, (_, i) => ({ name: `N${i}`, overall: 40, pos: 'MC' })) },
    Regional: { division: 'REG', roster: Array.from({ length: 18 }, (_, i) => ({ name: `R${i}`, overall: 15, pos: 'MC' })) },
    RegionalDirty: {
      division: 'REG',
      _rosterPersist: true,
      roster: Array.from({ length: 18 }, (_, i) => ({ name: `D${i}`, overall: 16, pos: 'MC' })),
    },
  };
  const snap = collectWorldRosters(clubs);
  assert.ok(snap.Nacional);
  assert.equal(snap.Regional, undefined);
  assert.ok(snap.RegionalDirty);
}

{
  const clubs = {
    Nacional: { division: 'D', roster: Array.from({ length: 18 }, (_, i) => ({ name: `A${i}`, overall: 20, pos: 'MC' })) },
  };
  const merged = collectWorldRosters(clubs, {
    merge: { 'Velho-REG': [{ name: 'B', overall: 14, pos: 'ATA' }] },
  });
  assert.ok(merged['Velho-REG']);
  assert.ok(merged.Nacional);
}

assert.equal(typeof hashSeedString(rosterSeedKey(1, 'Test', 2026)), 'number');
assert.equal(rosterSeedKey(1, 'Test', 2026), '1|Test|2026');

console.log('regional-club-roster-tests: 3/3 ok');
