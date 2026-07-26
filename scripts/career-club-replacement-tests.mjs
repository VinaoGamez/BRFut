import {
  listClubsByUf,
  careerDivisionForHost,
  getRealClub,
  pickRandomHostClub,
} from '../js/engine/brazilian-clubs-by-uf.js';
import {
  applyCareerHostNameSwap,
  divisionFixturesIncludeClub,
  finalizeHostReplacementCascade,
  hasCareerOriginReplacement,
  injectRealClubsIntoPyramid,
  prepareClubListForFixtures,
  replaceLowestPowerSlot,
  replaceSameUfSlotInSerieD,
  runFullRelegationCascade,
  stablePickIndex,
} from '../js/engine/career-club-replacement.js';
import { getAllRealClubs } from '../js/engine/brazilian-clubs-by-uf.js';

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

check('lista clubes por UF', () => {
  const sp = listClubsByUf('SP');
  assert(sp.some(club => club.name === 'Palmeiras'), 'Palmeiras em SP');
  assert(sp.some(club => club.name === 'Ponte Preta'), 'Ponte Preta em SP');
});

check('careerDivisionForHost trata base regional como Série D', () => {
  assert(careerDivisionForHost({ division: 'REG' }) === 'D', 'REG -> D');
  assert(careerDivisionForHost({ division: 'B' }) === 'B', 'B -> B');
});

check('applyCareerHostNameSwap substitui host na divisão', () => {
  const divisionTeams = {
    A: ['Palmeiras', 'São Paulo', 'Santos'],
    B: ['Ponte Preta'],
    C: [],
    D: [],
  };
  const next = applyCareerHostNameSwap(divisionTeams, {
    userClub: 'Atlético Fênix',
    replacedHostClub: 'Santos',
    hostDivision: 'A',
  });
  assert(next.A.includes('Atlético Fênix'), 'usuário entra na Série A');
  assert(!next.A.includes('Santos'), 'host sai da Série A');
});

check('applyCareerHostNameSwap não duplica clube já presente', () => {
  const divisionTeams = {
    A: ['Palmeiras', 'Vinaz FC', 'São Paulo'],
    B: [],
    C: [],
    D: [],
  };
  const next = applyCareerHostNameSwap(divisionTeams, {
    userClub: 'Vinaz FC',
    replacedHostClub: 'São Paulo',
    hostDivision: 'A',
  });
  assert(next.A.filter(name => name === 'Vinaz FC').length === 1, 'Vinaz FC aparece uma vez');
  assert(!next.A.includes('São Paulo'), 'host substituído');
});

check('replaceLowestPowerSlot expulsa menor OVR para base regional', () => {
  const divisionTeams = { A: [], B: ['Alpha', 'Beta', 'Gamma'], C: [], D: [] };
  const clubs = {
    Alpha: { power: 44 },
    Beta: { power: 41 },
    Gamma: { power: 49 },
  };
  const result = replaceLowestPowerSlot(divisionTeams, clubs, 'B', 'Ponte Preta', []);
  assert(divisionTeams.B.includes('Ponte Preta'), 'host entra na B');
  assert(!divisionTeams.B.includes('Beta'), 'menor OVR sai');
  assert(result.regionalBaseClubs.includes('Beta'), 'expulso vai para regional');
});

check('replaceSameUfSlotInSerieD troca clube do mesmo estado na D', () => {
  const dClubs = getAllRealClubs().filter(club => club.division === 'D');
  const spClub = dClubs.find(club => club.uf === 'SP');
  const rjClub = dClubs.find(club => club.uf === 'RJ');
  assert(spClub && rjClub, 'precisa de clubes reais SP e RJ na Série D');
  const divisionTeams = { A: [], B: [], C: [], D: [spClub.name, rjClub.name] };
  const clubs = {
    [spClub.name]: { power: 55 },
    [rjClub.name]: { power: 70 },
  };
  const incoming = getAllRealClubs().find(club => club.division === 'C' && club.uf === 'SP');
  assert(incoming, 'precisa de clube real da Série C em SP');
  const result = replaceSameUfSlotInSerieD(divisionTeams, clubs, incoming.name, [], {
    pickIndex: () => 0,
    resolveUf: name => {
      if (name === incoming.name) return 'SP';
      if (name === spClub.name) return 'SP';
      if (name === rjClub.name) return 'RJ';
      return null;
    },
  });
  assert(result.matchedUf, 'priorizou mesmo UF');
  assert(result.evicted === spClub.name, 'expulso é o clube de SP da D');
  assert(divisionTeams.D.includes(incoming.name), 'vítima entra na D');
  assert(!divisionTeams.D.includes(spClub.name), 'clube de SP sai da D');
  assert(result.regionalBaseClubs.includes(spClub.name), 'expulso vai para regional');
});

check('runFullRelegationCascade usa regra de UF só na Série D', () => {
  const divisionTeams = {
    A: ['User FC', 'Palmeiras'],
    B: ['Alpha', 'Beta'],
    C: ['Gamma', 'Delta'],
    D: ['Echo SP', 'Foxtrot RJ'],
  };
  const clubs = {
    'User FC': { power: 60 },
    Palmeiras: { power: 62 },
    Alpha: { power: 40 },
    Beta: { power: 45 },
    Gamma: { power: 42 },
    Delta: { power: 44 },
    'Echo SP': { power: 50 },
    'Foxtrot RJ': { power: 48 },
  };
  const cascade = runFullRelegationCascade({
    divisionTeams,
    clubs,
    regionalBaseClubs: [],
    victimClub: 'Host A',
    startDivision: 'A',
    cascadeSeed: 42,
  });
  assert(cascade.divisionTeams.B.includes('Host A'), 'vítima desce para B');
  assert(cascade.divisionTeams.C.includes('Alpha'), 'menor da B desce para C');
  assert(cascade.serieDReplacements.length === 1, 'registra troca na D');
});

check('stablePickIndex é determinístico', () => {
  assert(stablePickIndex(5, 'abc') === stablePickIndex(5, 'abc'), 'mesma chave');
  assert(stablePickIndex(5, 'abc') !== stablePickIndex(5, 'abd'), 'chaves diferentes');
});

check('finalizeHostReplacementCascade desce host uma divisão', () => {
  const divisionTeams = {
    A: ['Atlético Fênix', 'Palmeiras'],
    B: ['Alpha', 'Beta'],
    C: [],
    D: [],
  };
  const clubs = {
    'Atlético Fênix': { power: 58, division: 'A' },
    Palmeiras: { power: 60, division: 'A' },
    Alpha: { power: 43, division: 'B' },
    Beta: { power: 47, division: 'B' },
  };
  const cascade = finalizeHostReplacementCascade({
    divisionTeams,
    clubs,
    regionalBaseClubs: [],
    replacedHostClub: 'Santos',
    hostDivision: 'A',
    userClub: 'Atlético Fênix',
  });
  assert(cascade.divisionTeams.B.includes('Santos'), 'Santos desce para B');
  assert(cascade.regionalBaseClubs.includes('Alpha'), 'menor da B vai para regional');
});

check('hasCareerOriginReplacement exige metadados', () => {
  assert(
    hasCareerOriginReplacement({
      userUf: 'SP',
      replacedHostClub: 'Santos',
      replacementMode: 'manual',
    }),
    'save válido',
  );
  assert(!hasCareerOriginReplacement({ userUf: 'SP' }), 'save incompleto');
});

check('pickRandomHostClub respeita lista', () => {
  const clubs = listClubsByUf('RJ');
  const picked = pickRandomHostClub(clubs, () => 0);
  assert(picked?.name === clubs[0].name, 'sorteio retorna clube da UF');
  assert(getRealClub(picked.name), 'clube existe no registry');
});

check('prepareClubListForFixtures garante contagem par', () => {
  const prepared = prepareClubListForFixtures(
    ['A', 'B', 'C', 'D', 'E'],
    { targetSize: 5, userClub: 'C' },
  );
  assert(prepared.length % 2 === 0, 'lista par');
  assert(prepared.includes('C'), 'usuário preservado');
});

check('divisionFixturesIncludeClub detecta clube', () => {
  const fixtures = [[{ home: 'Vinaz FC', away: 'Palmeiras', round: 1 }]];
  assert(divisionFixturesIncludeClub(fixtures, 'Vinaz FC'), 'encontrou');
  assert(!divisionFixturesIncludeClub(fixtures, 'Santos'), 'ausente');
});

check('injectRealClubsIntoPyramid ignora clube protegido do registry', () => {
  const divisionTeams = {
    A: ['Palmeiras', 'União Manaus'],
    B: ['União Belém'],
    C: [],
    D: [],
  };
  const next = injectRealClubsIntoPyramid(divisionTeams, {
    realClubs: [{ name: 'Vinaz FC', uf: 'SP', division: 'A' }],
    protectedNames: ['Vinaz FC'],
    targets: { A: 2 },
    userClub: 'Vinaz FC',
  });
  assert(!next.A.includes('Vinaz FC'), 'não injeta clube do usuário');
  assert(next.A.length === 2, 'mantém tamanho alvo');
});

check('injectRealClubsIntoPyramid posiciona clubes reais', () => {
  const divisionTeams = {
    A: ['Palmeiras', 'União Manaus'],
    B: ['União Belém', 'União Macapá'],
    C: [],
    D: [],
  };
  const next = injectRealClubsIntoPyramid(divisionTeams, {
    realClubs: [{ name: 'Ponte Preta', uf: 'SP', division: 'B' }],
    protectedNames: [],
  });
  assert(next.B.includes('Ponte Preta'), 'Ponte Preta entra na B');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
