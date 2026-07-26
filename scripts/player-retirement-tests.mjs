/**
 * Aposentadoria + regens U-20 — node scripts/player-retirement-tests.mjs
 */
import {
  computeRetirementChance,
  processSeasonRetirements,
  retirementRoll,
  shouldRetirePlayer,
} from '../js/engine/player-retirement.js';
import {
  computeLegacyRegenChance,
  eligibleLegacyPool,
  LEGACY_REGEN_MAX_PER_SEASON,
  maybeRollLegacyYouthPlayer,
} from '../js/engine/youth-legacy-regen.js';

let passed = 0;
let failed = 0;

const check = (label, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${label}`);
    console.error(`  ${error.message}`);
  }
};

const assert = (cond, message) => {
  if (!cond) throw new Error(message || 'assertion failed');
};

const player = (overrides = {}) => ({
  name: 'Veterano Silva',
  playerId: 'p-vet',
  pos: 'MC',
  age: 36,
  overall: 70,
  ...overrides,
});

const clubRoster = (names, count = 20) =>
  Array.from({ length: count }, (_, i) =>
    player({
      playerId: `p-${names}-${i}`,
      name: `Jogador ${i}`,
      age: 24 + (i % 5),
    }),
  );

check('GOL usa linha −2 (38 elegível)', () => {
  assert(computeRetirementChance(player({ pos: 'GOL', age: 38 })) > 0, 'GOL 38 deveria ter chance');
  assert(computeRetirementChance(player({ pos: 'MC', age: 35 })) === 0, 'MC 35 ainda abaixo do mínimo');
});

check('42+ linha garante aposentadoria', () => {
  const r = shouldRetirePlayer(player({ age: 42 }), { season: 2026, clubName: 'A' });
  assert(r.retire && r.forced, '42+ deveria ser forçado');
});

check('veterano forte −25% até 38 anos', () => {
  const base = computeRetirementChance(player({ age: 37, overall: 70 }));
  const star = computeRetirementChance(player({ age: 37, overall: 78 }));
  assert(star < base, 'OVR alto deveria reduzir chance');
});

check('piso 18 impede aposentadoria', () => {
  const clubs = {
    MeuClube: { roster: [player({ age: 42, playerId: 'p-old' })] },
  };
  const result = processSeasonRetirements(clubs, {
    season: 2026,
    userClub: 'MeuClube',
    retiredPool: [],
  });
  assert(result.deferred.length === 1, 'deveria adiar por piso');
  assert(clubs.MeuClube.roster.length === 1, 'jogador permanece');
});

check('aposentadoria remove do elenco e alimenta pool', () => {
  const roster = clubRoster('x', 20);
  roster[0] = player({ age: 42, playerId: 'p-retire', name: 'Capitão' });
  const clubs = { MeuClube: { roster, division: 'A' } };
  const result = processSeasonRetirements(clubs, {
    season: 2026,
    userClub: 'MeuClube',
    retiredPool: [],
  });
  assert(result.retired.length === 1, 'uma aposentadoria');
  assert(clubs.MeuClube.roster.length === 19, 'elenco reduzido');
  assert(result.pool.some(e => e.playerId === 'p-retire'), 'pool atualizado');
});

check('roll determinístico por seed', () => {
  const a = retirementRoll('2026|Clube|p1|retire');
  const b = retirementRoll('2026|Clube|p1|retire');
  const c = retirementRoll('2026|Clube|p2|retire');
  assert(a === b, 'mesma seed → mesmo roll');
  assert(a !== c, 'seeds diferentes → rolls diferentes');
});

check('regen só de aposentados do clube user', () => {
  const pool = [
    { id: 'r1', playerId: 'p1', name: 'A', lastClub: 'MeuClube', retiredSeason: 2025, regenUsed: false },
    { id: 'r2', playerId: 'p2', name: 'B', lastClub: 'Rival', retiredSeason: 2025, regenUsed: false },
  ];
  const eligible = eligibleLegacyPool(pool, 'MeuClube', 2026);
  assert(eligible.length === 1 && eligible[0].playerId === 'p1', 'só clube user');
});

check('cap 1 regen/ano', () => {
  const club = { youthLegacyMeta: { season: 2026, count: LEGACY_REGEN_MAX_PER_SEASON } };
  const pool = [
    { id: 'r1', playerId: 'p1', name: 'A', lastClub: 'MeuClube', retiredSeason: 2025, regenUsed: false, pos: 'MC' },
  ];
  const result = maybeRollLegacyYouthPlayer({
    club,
    clubName: 'MeuClube',
    userClub: 'MeuClube',
    season: 2026,
    retiredPool: pool,
    legacyMeta: club.youthLegacyMeta,
    random: () => 0,
    firstNames: ['Lucas'],
    lastNames: ['Silva'],
    division: 'A',
    uf: 'SP',
  });
  assert(!result, 'cap anual deveria bloquear');
});

check('chance regen respeita teto 25%', () => {
  const entry = { star: true, retiredSeason: 2025, lastClub: 'MeuClube' };
  const chance = computeLegacyRegenChance(entry, { season: 2026 });
  assert(chance <= 0.25, `teto 25%, obteve ${chance}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
