/**
 * Valida distribuição de posições no elenco gerado (ATA vs pontas).
 * Uso: node scripts/squad-role-balance-tests.mjs
 */
import assert from 'node:assert/strict';
import {
  GENERIC_SQUAD_ROLES,
  ROSTER_PRO_MIN,
  ROSTER_PRO_MAX,
  SQUAD_ROLE_MINIMUMS,
  buildSquadRoles,
  countSquadRoles,
  generateSquad,
} from '../js/engine/player-generation.js';

assert.equal(GENERIC_SQUAD_ROLES.length, ROSTER_PRO_MAX);

const full = countSquadRoles(GENERIC_SQUAD_ROLES);
assert.equal(full.GOL, 3);
assert.equal(full.ZAG, 5);
assert.equal(full.LAT, 4);
assert.equal(full.VOL, 4);
assert.equal(full.MC, 4);
assert.equal(full.MEI, 3);
assert.equal(full.ATA, 3);
assert.equal(full.PE, 2);
assert.equal(full.PD, 2);

for (let size = ROSTER_PRO_MIN; size <= ROSTER_PRO_MAX; size += 1) {
  const roles = buildSquadRoles(size);
  assert.equal(roles.length, size);
  const counts = countSquadRoles(roles);
  for (const [pos, min] of Object.entries(SQUAD_ROLE_MINIMUMS)) {
    assert.ok(
      (counts[pos] || 0) >= min,
      `size ${size}: ${pos}=${counts[pos] || 0} < min ${min}`,
    );
  }
  assert.ok((counts.ATA || 0) >= 2, `size ${size} precisa de ATA`);
  assert.ok((counts.PE || 0) + (counts.PD || 0) >= 2, `size ${size} precisa de pontas`);
  // Não pode ter 4 pontas e 0 ATA (bug antigo do slice pelo fim)
  assert.ok(
    !((counts.PE || 0) + (counts.PD || 0) >= 4 && (counts.ATA || 0) === 0),
    `size ${size}: pontas sem ATA`,
  );
}

let n = 0;
const random = () => {
  n += 1;
  return (n * 0.37) % 1;
};
for (let i = 0; i < 40; i += 1) {
  const { roster } = generateSquad({ division: 'D', random });
  const counts = countSquadRoles(roster.map(p => p.pos));
  assert.ok((counts.ATA || 0) >= 2, `generateSquad sem ATA suficiente: ${JSON.stringify(counts)}`);
}

console.log('ok  squad-role-balance-tests');
