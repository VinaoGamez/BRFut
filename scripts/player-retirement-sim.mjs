/**
 * Simulação — aposentadoria na virada + regens U-20 (legado).
 * Uso: node scripts/player-retirement-sim.mjs [seed] [seasons] [clubs]
 */
import {
  computeRetirementChance,
  processSeasonRetirements,
  shouldRetirePlayer,
} from '../js/engine/player-retirement.js';
import {
  computeLegacyRegenChance,
  eligibleLegacyPool,
  maybeRollLegacyYouthPlayer,
  LEGACY_REGEN_MAX_PER_SEASON,
} from '../js/engine/youth-legacy-regen.js';
import { ROSTER_CAREER_MIN } from '../js/engine/player-generation.js';

const SEED = Number(process.argv[2] || 20260726);
const SEASONS = Number(process.argv[3] || 5);
const CLUB_COUNT = Number(process.argv[4] || 40);
const USER_CLUB = 'Atlético Fênix';

const mulberry32 = seed => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const rnd = (random, min, max) => min + random() * (max - min);
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) : '0.0');
const POS = ['GOL', 'ZAG', 'LAT', 'VOL', 'MC', 'MEI', 'PE', 'PD', 'ATA'];
const FIRST = ['Lucas', 'Gabriel', 'Pedro', 'Rafael', 'Bruno', 'Caio', 'Enzo'];
const LAST = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Almeida', 'Ribeiro'];

function makePlayer(id, random, overrides = {}) {
  const age = overrides.age ?? Math.floor(rnd(random, 20, 40));
  const pos = overrides.pos ?? POS[Math.floor(random() * POS.length)];
  const overall = overrides.overall ?? Math.floor(rnd(random, 62, 82));
  const last = LAST[Math.floor(random() * LAST.length)];
  const first = FIRST[Math.floor(random() * FIRST.length)];
  return {
    playerId: `p-${id}`,
    name: `${first} ${last}`,
    pos,
    age,
    overall,
    nationality: 'BRA',
    originUf: 'SP',
    ...overrides,
  };
}

function buildUserRoster(random) {
  const roster = [];
  let id = 0;
  // elenco base jovem
  for (let i = 0; i < 16; i += 1) {
    roster.push(makePlayer(id++, random, { age: Math.floor(rnd(random, 20, 28)) }));
  }
  // veteranos do user (cenário de teste)
  const veterans = [
    { name: 'Capitão Mendes', age: 36, pos: 'ZAG', overall: 74 },
    { name: 'Maestro Ferreira', age: 37, pos: 'MC', overall: 78 },
    { name: 'Goleiro Lopes', age: 40, pos: 'GOL', overall: 76 },
    { name: 'Lenda Souza', age: 42, pos: 'ATA', overall: 71 },
    { name: 'Reserva Antunes', age: 38, pos: 'VOL', overall: 68 },
  ];
  veterans.forEach(v => {
    roster.push(makePlayer(id++, random, { ...v, playerId: `p-user-vet-${id}` }));
  });
  return roster;
}

function buildWorldClubs(random, count) {
  const clubs = {};
  clubs[USER_CLUB] = { roster: buildUserRoster(random), division: 'A' };
  for (let c = 1; c < count; c += 1) {
    const name = `Clube ${c}`;
    const size = Math.floor(rnd(random, ROSTER_CAREER_MIN, 28));
    const roster = [];
    for (let i = 0; i < size; i += 1) {
      const age = Math.floor(rnd(random, 18, 41));
      roster.push(makePlayer(`${c}-${i}`, random, { age }));
    }
    clubs[name] = { roster, division: ['A', 'B', 'C', 'D'][c % 4] };
  }
  return clubs;
}

function minuteProfile(player) {
  const ovr = Number(player.overall) || 70;
  const age = Number(player.age) || 30;
  if (ovr >= 76) return 1100;
  if (ovr >= 72) return 850;
  if (age >= 38) return 420;
  return 120;
}

function retirementCtx(season, random) {
  return {
    season,
    userClub: USER_CLUB,
    random,
    getSeasonMinutes: player => minuteProfile(player),
  };
}

function cloneClubs(clubs) {
  return Object.fromEntries(
    Object.entries(clubs).map(([name, club]) => [
      name,
      { ...club, roster: club.roster.map(p => ({ ...p })) },
    ]),
  );
}

function advanceAges(clubs) {
  Object.values(clubs).forEach(club => {
    club.roster.forEach(p => {
      p.age = (Number(p.age) || 0) + 1;
    });
  });
}

function printUserVeterans(clubs, label) {
  const roster = clubs[USER_CLUB]?.roster || [];
  const vets = roster.filter(p => (Number(p.age) || 0) >= 36);
  console.log(`\n  ${label} — veteranos 36+ no ${USER_CLUB} (${vets.length}):`);
  if (!vets.length) {
    console.log('    (nenhum)');
    return;
  }
  vets
    .sort((a, b) => b.age - a.age)
    .forEach(p => {
      const chance = computeRetirementChance(p, { season: 2026, getSeasonMinutes: minuteProfile });
      console.log(
        `    • ${p.name} · ${p.age}a · ${p.pos} · OVR ${p.overall} · chance ${(chance * 100).toFixed(0)}%`,
      );
    });
}

function simulateScoutSeason(club, pool, season, random, searches = 24) {
  let legacies = 0;
  const hits = [];
  for (let i = 0; i < searches; i += 1) {
    const meta = club.youthLegacyMeta || { season, count: 0 };
    if (meta.season !== season) meta.season = season;
    if (meta.count >= LEGACY_REGEN_MAX_PER_SEASON) break;
    const result = maybeRollLegacyYouthPlayer({
      club,
      clubName: USER_CLUB,
      userClub: USER_CLUB,
      season,
      retiredPool: pool,
      legacyMeta: meta,
      random,
      firstNames: FIRST,
      lastNames: LAST,
      division: 'A',
      uf: 'SP',
    });
    if (result?.player) {
      legacies += 1;
      club.youthLegacyMeta = { season, count: (meta.count || 0) + 1 };
      hits.push({
        name: result.player.name,
        pos: result.player.pos,
        legacyOf: result.player.legacyOf?.retiredName,
      });
    }
  }
  return { legacies, hits, searches };
}

const random = mulberry32(SEED);
let pool = [];
let totalRetired = 0;
let totalUserRetired = 0;
let totalDeferred = 0;
const byAge = {};
const userDeparturesLog = [];

console.log('\n══════════════════════════════════════════════════════════');
console.log('  SIMULAÇÃO · Aposentadoria + Regens U-20 (legado)');
console.log('══════════════════════════════════════════════════════════');
console.log(`  seed=${SEED}  temporadas=${SEASONS}  clubes=${CLUB_COUNT}`);
console.log(`  clube user: ${USER_CLUB}`);

let clubs = buildWorldClubs(random, CLUB_COUNT);
printUserVeterans(clubs, 'Elenco inicial (antes +1 idade)');

console.log('\n── Viradas de temporada ──');

for (let s = 0; s < SEASONS; s += 1) {
  const season = 2026 + s;
  advanceAges(clubs);
  const beforeUser = clubs[USER_CLUB].roster.length;

  const result = processSeasonRetirements(clubs, {
    ...retirementCtx(season, random),
    retiredPool: pool,
  });

  pool = result.pool;
  totalRetired += result.retired.length;
  totalUserRetired += result.userDepartures.length;
  totalDeferred += result.deferred.length;

  result.retired.forEach(row => {
    const age = row.retiredAge;
    byAge[age] = (byAge[age] || 0) + 1;
  });

  const afterUser = clubs[USER_CLUB].roster.length;
  console.log(`\n  Temporada ${season} → ${season + 1}`);
  console.log(
    `    Mundial: ${result.retired.length} aposentados · ${result.deferred.length} adiados (piso ${ROSTER_CAREER_MIN})`,
  );
  console.log(
    `    ${USER_CLUB}: ${beforeUser} → ${afterUser} jogadores · ${result.userDepartures.length} despedida(s)`,
  );

  if (result.userDepartures.length) {
    result.userDepartures.forEach(d => {
      console.log(
        `      ★ ${d.name} · ${d.retiredAge}a · ${d.pos} · OVR ${d.lastOverall}${d.forced ? ' (garantido)' : ''}`,
      );
      userDeparturesLog.push({ season, ...d });
    });
  }

  // próxima temporada: repor elenco IA levemente
  Object.entries(clubs).forEach(([name, club]) => {
    while (club.roster.length < 20) {
      club.roster.push(makePlayer(`${name}-fill-${club.roster.length}`, random, { age: 20 }));
    }
  });
}

console.log('\n── Resumo aposentadorias ──');
console.log(`  Total mundial (${SEASONS} viradas): ${totalRetired}`);
console.log(`  Despedidas ${USER_CLUB}: ${totalUserRetired}`);
console.log(`  Adiados por piso 18: ${totalDeferred}`);
console.log(`  Pool final: ${pool.length} entradas`);
console.log('  Por idade (mundial):');
Object.keys(byAge)
  .sort((a, b) => Number(a) - Number(b))
  .forEach(age => {
    console.log(`    ${age} anos: ${byAge[age]}`);
  });

const userPool = eligibleLegacyPool(pool, USER_CLUB, 2026 + SEASONS);
console.log(`\n  Elegíveis para regen (${USER_CLUB}): ${userPool.length}`);
userPool.slice(0, 8).forEach(e => {
  const ch = computeLegacyRegenChance(e, { season: 2026 + SEASONS });
  console.log(
    `    • ${e.name} · aposentou ${e.retiredSeason} · OVR ${e.lastOverall}${e.star ? ' ★' : ''} · chance regen ${(ch * 100).toFixed(1)}%`,
  );
});
if (userPool.length > 8) console.log(`    … +${userPool.length - 8} no pool`);

console.log('\n── Simulação olheiros (regens legado) ──');
const scoutClub = { youthLegacyMeta: { season: 2026 + SEASONS, count: 0 } };
const scoutRandom = mulberry32(SEED ^ 0xabc);
const scoutRuns = 200;
let totalLegacies = 0;
const allHits = [];

for (let run = 0; run < scoutRuns; run += 1) {
  const club = { youthLegacyMeta: { season: 2026 + SEASONS, count: 0 } };
  const simPool = pool.map(e => ({ ...e, regenUsed: false }));
  const { legacies, hits } = simulateScoutSeason(club, simPool, 2026 + SEASONS, scoutRandom, 30);
  totalLegacies += legacies;
  allHits.push(...hits);
}

console.log(`  ${scoutRuns} temporadas simuladas × até 30 buscas/olheiro`);
console.log(`  Regens legado gerados: ${totalLegacies} (${pct(totalLegacies, scoutRuns)}% das temporadas)`);
if (allHits.length) {
  console.log('  Exemplos:');
  allHits.slice(0, 6).forEach(h => {
    console.log(`    • ${h.name} (${h.pos}) — legado de ${h.legacyOf}`);
  });
}

console.log('\n── Tabela de chances (referência, 1 jogador) ──');
[36, 37, 38, 39, 40, 41, 42].forEach(age => {
  const ctx = { getSeasonMinutes: () => 900 };
  const mc = computeRetirementChance({ age, pos: 'MC', overall: 70 }, ctx);
  const gol = computeRetirementChance({ age, pos: 'GOL', overall: 70 }, ctx);
  const mcStar = computeRetirementChance({ age, pos: 'MC', overall: 78 }, ctx);
  console.log(
    `  ${age}a  MC ${(mc * 100).toFixed(0)}%  GOL ${(gol * 100).toFixed(0)}%  MC★78 ${(mcStar * 100).toFixed(0)}%`,
  );
});

console.log('\n── Modal (preview UX) ──');
if (userDeparturesLog.length) {
  console.log(`  Título: Despedidas · ${userDeparturesLog[userDeparturesLog.length - 1].season}`);
  console.log(`  Lead: ${userDeparturesLog.length} jogador(es) encerraram a carreira no seu elenco.`);
  userDeparturesLog.forEach(d => {
    console.log(`  • ${d.name} — ${d.retiredAge} anos · ${d.pos} · OVR ${d.lastOverall}`);
  });
  const worldExtra = Math.max(0, totalRetired - totalUserRetired);
  if (worldExtra) console.log(`  Rodapé: + ${worldExtra} aposentadorias no restante do campeonato.`);
} else {
  console.log('  (nesta seed nenhum veterano do user se aposentou — tente seed diferente ou mais temporadas)');
}

console.log('\n══════════════════════════════════════════════════════════\n');
