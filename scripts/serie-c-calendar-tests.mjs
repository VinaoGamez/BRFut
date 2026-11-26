import {
  serieCClubsForSeason,
  serieCRelegationSlots,
  serieCRelegationCountForTransition,
  normalizeDivisionTeamsSerieC,
  SERIE_D_CLUBS,
  SERIE_C_RELEGATION_TO_D,
} from '../js/engine/serie-c-calendar.js';

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

check('CBF sizes by season', () => {
  assert(serieCClubsForSeason(2026) === 20, '2026 → 20');
  assert(serieCClubsForSeason(2027) === 24, '2027 → 24');
  assert(serieCClubsForSeason(2028) === 28, '2028 → 28');
  assert(serieCClubsForSeason(2030) === 28, '2030 → 28');
});

check('rebaixamento acompanha o tamanho da Série C', () => {
  // A CBF fixa a vaga garantida na Série D por temporada, e ela muda com o
  // tamanho da divisão: 20 clubes -> Z2, 24 -> Z4, 28 -> Z6. A constante fixa
  // de 4 não fechava com o tamanho da divisão nem com a Série D (promove 6).
  assert(serieCRelegationSlots(2026) === 2, '2026 (20 clubes) -> Z2');
  assert(serieCRelegationSlots(2027) === 4, '2027 (24 clubes) -> Z4');
  assert(serieCRelegationSlots(2028) === 6, '2028 (28 clubes) -> Z6');
  assert(serieCRelegationSlots(2030) === 6, '2030 (28 clubes) -> Z6');
  assert(serieCRelegationCountForTransition(20, 2027) === 4, 'transição usa a temporada destino');
  // A regra exibida e a executada precisam sair da mesma função.
  assert(serieCRelegationSlots() === serieCRelegationSlots(2026), 'sem argumento = temporada atual');
});

check('normalize skipD nao repoe D automaticamente', () => {
  const d = Array.from({ length: 94 }, (_, i) => `D${i}`);
  const { divisionTeams } = normalizeDivisionTeamsSerieC(
    { A: [], B: [], C: Array.from({ length: 18 }, (_, i) => `C${i}`), D: d },
    { season: 2026, userClub: 'Manager FC', fillPool: ['Pool A', 'Pool B'], skipD: true },
  );
  assert(divisionTeams.C.length === 20, 'C filled to 20');
  assert(divisionTeams.D.length === 92, 'D perde 2 p/ C mas nao recebe fill do pool');
});

check('normalize shrinks bloated C and keeps user club', () => {
  const c = Array.from({ length: 36 }, (_, i) => `Clube C${i + 1}`);
  c[10] = 'Atlético Maceió';
  const d = Array.from({ length: 80 }, (_, i) => `Clube D${i + 1}`);
  const { divisionTeams, changed, target } = normalizeDivisionTeamsSerieC(
    { A: [], B: [], C: c, D: d },
    {
      season: 2030,
      userClub: 'Atlético Maceió',
      fillPool: Array.from({ length: 40 }, (_, i) => `Pool ${i + 1}`),
      dTarget: SERIE_D_CLUBS,
    },
  );
  assert(changed, 'should change');
  assert(target === 28, 'target 28');
  assert(divisionTeams.C.length === 28, `C=${divisionTeams.C.length}`);
  assert(divisionTeams.C.includes('Atlético Maceió'), 'keeps user');
  assert(divisionTeams.D.length === SERIE_D_CLUBS, `D=${divisionTeams.D.length}`);
});

check('normalize fills short C from D', () => {
  const { divisionTeams } = normalizeDivisionTeamsSerieC(
    {
      A: [],
      B: [],
      C: Array.from({ length: 18 }, (_, i) => `C${i}`),
      D: Array.from({ length: 96 }, (_, i) => `D${i}`),
    },
    { season: 2026, userClub: 'Manager FC', fillPool: [] },
  );
  assert(divisionTeams.C.length === 20, 'C filled to 20');
  assert(divisionTeams.D.length === 94, 'D lost 2');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
