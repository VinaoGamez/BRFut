import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hydrateRealClubsFromImport } from '../js/engine/brazilian-clubs-by-uf.js';
import { buildAllStateCompetitions, collectParticipantsForUf, sortStandingsRows } from '../js/engine/state-league-format.js';
import {
  buildNextSeasonRosters,
  collectDivision1Relegated,
  collectLeagueBottom,
  collectPaulistaGroupRelegated,
  collectSemifinalistsForPromotion,
  computeMovementsForUf,
} from '../js/engine/state-league-movement.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const importDoc = JSON.parse(readFileSync(join(__dirname, '../public/data/brasfoot-clubs-import.json'), 'utf8'));
hydrateRealClubsFromImport(importDoc.clubs || []);

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

check('Div 1 Paulista relegates 2 worst per group', () => {
  const built = buildAllStateCompetitions({
    importClubs: importDoc.clubs,
    seasonYear: 2026,
    lotterySeed: 1,
  });
  const sp1 = built.SP[0];
  sp1.standings.forEach(group => {
    group.forEach((row, index) => {
      row.points = index;
      row.played = 1;
    });
  });
  const relegated = collectPaulistaGroupRelegated(sp1);
  assert(relegated.length === 4, '4 rebaixados');
});

check('Div 2 promotes 4 semifinalists and relegates 4 bottom', () => {
  const built = buildAllStateCompetitions({
    importClubs: importDoc.clubs,
    seasonYear: 2026,
    lotterySeed: 1,
  });
  const sp2 = built.SP[1];
  const table = sp2.standings[0];
  table.forEach((row, index) => {
    row.points = 100 - index;
    row.played = 1;
  });
  sp2.semifinalists = sortStandingsRows([...table])
    .slice(0, 4)
    .map(row => row.club);
  const promoted = collectSemifinalistsForPromotion(sp2);
  const relegated = collectLeagueBottom(sp2);
  assert(promoted.length === 4, '4 acessos');
  assert(relegated.length === 4, '4 rebaixados');
  const bottom = sortStandingsRows([...table])
    .slice(-4)
    .map(row => row.club);
  assert(relegated.every(name => bottom.includes(name)), 'piores da tabela');
});

check('next season rosters swap promoted and relegated clubs', () => {
  const participants = collectParticipantsForUf('SP', { importClubs: importDoc.clubs });
  const built = buildAllStateCompetitions({
    importClubs: importDoc.clubs,
    seasonYear: 2026,
    lotterySeed: 42,
  });
  const d1 = built.SP[0];
  const d2 = built.SP[1];
  const d3 = built.SP[2];
  d1.standings.forEach(group => {
    group.forEach((row, index) => {
      row.points = 100 - index;
      row.played = 1;
    });
  });
  [d2, d3].forEach(division => {
    const table = division.standings[0];
    table.forEach((row, index) => {
      row.points = 100 - index;
      row.played = 1;
    });
    division.semifinalists = sortStandingsRows([...table])
      .slice(0, 4)
      .map(row => row.club);
  });
  const movements = computeMovementsForUf(built.SP, 'SP');
  const { rosters } = buildNextSeasonRosters('SP', participants, built.SP, movements, {
    lotteryPick: (pool, slots) => pool.slice(0, slots),
  });
  movements.promotedTo1.forEach(name => assert(rosters[1].includes(name), `${name} subiu para div 1`));
  movements.relegatedFrom1.forEach(name => assert(rosters[2].includes(name), `${name} desceu para div 2`));
  assert(rosters[4].length === 10, 'div 4 com 10 clubes');
  movements.relegatedFrom3.forEach(name => assert(rosters[4].includes(name), `rebaixado ${name} na última div`));
});

check('última divisão visível forma com rebaixados da divisão acima', () => {
  const participants = collectParticipantsForUf('RJ', { importClubs: importDoc.clubs });
  const built = buildAllStateCompetitions({
    importClubs: importDoc.clubs,
    seasonYear: 2026,
    lotterySeed: 7,
  });
  const movements = computeMovementsForUf(built.RJ, 'RJ');
  const maxTier = movements.maxTier;
  assert(maxTier >= 2, 'RJ tem pelo menos 2 divisões');
  built.RJ[maxTier - 2].standings[0].forEach((row, index) => {
    row.points = index;
    row.played = 1;
  });
  movements.relegatedFrom[maxTier - 1] = collectLeagueBottom(built.RJ[maxTier - 2]);
  const { rosters } = buildNextSeasonRosters('RJ', participants, built.RJ, movements, {
    lotteryPick: (pool, slots) => pool.slice(0, slots),
  });
  const last = rosters[maxTier];
  assert(last?.length === 10, 'última div com exatamente 10 clubes');
  movements.relegatedFrom[maxTier - 1].forEach(name => assert(last.includes(name), `${name} rebaixado na última`));
});

check('UF com uma divisão troca só os 3 últimos', () => {
  const participants = collectParticipantsForUf('MT', { importClubs: importDoc.clubs });
  const built = buildAllStateCompetitions({
    importClubs: importDoc.clubs,
    seasonYear: 2026,
    lotterySeed: 99,
  });
  assert(built.MT?.length === 1, 'MT tem uma só divisão estadual');
  const mt1 = built.MT[0];
  const table = mt1.standings[0];
  table.forEach((row, index) => {
    row.points = 100 - index;
    row.played = 1;
  });
  const champion = sortStandingsRows([...table])[0].club;
  const bottom = collectLeagueBottom(mt1, 3);
  assert(bottom.length === 3, '3 saem da única divisão');
  assert(!bottom.includes(champion), 'campeão não está entre os que saem');

  const movements = computeMovementsForUf(built.MT, 'MT');
  assert(movements.maxTier === 1, 'maxTier 1');
  assert(movements.relegatedFrom[1]?.length === 3, '3 rebaixados na única div');

  const { rosters } = buildNextSeasonRosters('MT', participants, built.MT, movements, {
    lotteryPick: (pool, slots) => pool.slice(0, slots),
  });
  assert(rosters[1]?.length === 10, 'div única com 10 clubes');
  assert(rosters[1].includes(champion), `campeão ${champion} permanece`);
  bottom.forEach(name => assert(!rosters[1].includes(name), `${name} saiu da única divisão`));
  const keptFromPrev = mt1.teams.filter(name => !bottom.includes(name));
  assert(keptFromPrev.length === 7, '7 permanecem');
  keptFromPrev.forEach(name => assert(rosters[1].includes(name), `${name} permanece`));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
