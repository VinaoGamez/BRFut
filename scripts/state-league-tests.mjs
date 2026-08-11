import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  auditUfClubCounts,
  buildAllStateCompetitions,
  buildQuarterfinalFixtures,
  buildSemifinalFixtures,
  collectParticipantsForUf,
  collectPhaseAdvancers,
  extractGuaranteedTier4ByUf,
  groupQualifiers,
  isPaulistaFormat,
  leagueQualifiers,
  stateLeagueGroupPosition,
  PAULISTA_DIVISION_SIZE,
  splitStateDivisions,
  scheduleStateLeagueDates,
  STATE_LEAGUE_CALENDAR_SLOTS,
  repairStateLeagueCompetitionCalendar,
  STATE_LEAGUE_COMPETITION,
  STATE_LEAGUE_MIN_CLUBS,
  STATE_LEAGUE_VISIBLE_TIERS,
  sanitizeCompetitionsByUf,
  stateLeagueBadgeName,
} from '../js/engine/state-league-format.js';
import { createStateLeagueEngine } from '../js/engine/state-league.js';
import { isStateKnockoutPhase } from '../js/engine/knockout-shootout.js';
import { buildStateRnfQualifiersByUf, stateLeagueAffectsSerieD } from '../js/engine/state-league-rnf.js';
import { hasSecuredCopaSlot, resolveStateCopaSlot } from '../js/engine/state-league-copa-slots.js';
import { buildCompetitionRules } from '../js/engine/competition-rules.js';
import { hydrateRealClubsFromImport } from '../js/engine/brazilian-clubs-by-uf.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const importDoc = JSON.parse(readFileSync(join(__dirname, '../public/data/brasfoot-clubs-import.json'), 'utf8'));
const importClubs = importDoc.clubs || [];

hydrateRealClubsFromImport(importClubs);

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

check('audit lists all UFs from Brasfoot import', () => {
  const audit = auditUfClubCounts({ importClubs });
  assert(audit.length === 27, '27 UFs');
  const sp = audit.find(item => item.uf === 'SP');
  assert(sp.count >= 50, 'SP has many real clubs');
  assert(!audit.some(item => item.needsFiller), 'no filler flag');
});

check('collectParticipants uses import only (no fictitious names)', () => {
  const sp = collectParticipantsForUf('SP', { importClubs });
  const importNames = new Set(
    importClubs.filter(club => club?.country === 'BRA' && club.uf === 'SP').map(club => club.name),
  );
  assert(sp.length >= 50, 'SP participants');
  assert(sp.every(name => importNames.has(name)), 'every SP club from Brasfoot import');
});

check('SP has at most 4 visible divisions with tier-4 lottery', () => {
  const userClub = 'Vinaz FC';
  const sp = collectParticipantsForUf('SP', {
    importClubs,
    userClub,
    userUf: 'SP',
    clubs: { [userClub]: { uf: 'SP', division: 'A' } },
  });
  assert(sp.length === 293, '292 import + user club');
  const divisions = splitStateDivisions(sp, { [userClub]: { uf: 'SP' } }, 'SP', {
    seasonYear: 2026,
    userClub,
    userUf: 'SP',
    lotterySeed: 12345,
  });
  assert(divisions.length === STATE_LEAGUE_VISIBLE_TIERS, '4 divisões visíveis');
  assert(divisions[0].teams.length === PAULISTA_DIVISION_SIZE, 'div 1 paulista 18');
  assert(divisions[1].teams.length === 10, 'div 2 com 10');
  assert(divisions[2].teams.length === 10, 'div 3 com 10');
  assert(divisions[3].teams.length === 10, 'div 4 sorteada com 10');
  assert(divisions[3].lottery === true, 'div 4 é sorteio');
  assert(divisions[3].lotteryPoolSize > 10, 'pool maior que vagas');
  const built = buildAllStateCompetitions({
    importClubs,
    userClub,
    userUf: 'SP',
    clubs: { [userClub]: { uf: 'SP', division: 'A' } },
    seasonYear: 2026,
    lotterySeed: 12345,
  });
  assert(built.SP?.length === 4, 'engine gera 4 divisões SP');
  assert(built.SP?.[3]?.lottery === true, 'tier 4 marcada como sorteio');
});

check('tier-4 lottery fills division after relegations from div 3', () => {
  const userClub = 'Vinaz FC';
  const sp = collectParticipantsForUf('SP', { importClubs, userClub, userUf: 'SP', clubs: { [userClub]: { uf: 'SP' } } });
  const divisions = splitStateDivisions(sp, {}, 'SP', {
    seasonYear: 2026,
    lotterySeed: 12345,
    userClub,
    userUf: 'SP',
  });
  const tier4 = divisions[divisions.length - 1];
  assert(tier4.tier === 4, 'última é div 4');
  assert(tier4.lottery === true, 'div 4 usa sorteio na estreia');
});

check('extractGuaranteedTier4ByUf reads phase advancers from tier 4', () => {
  const engine = createStateLeagueEngine();
  engine.build({
    clubs: {},
    regionalBaseClubs: [],
    importClubs,
    seasonYear: 2026,
    userUf: 'PE',
    userClub: 'Sport',
    lotterySeed: 42,
  });
  const pe = engine.competitions.PE?.[3];
  assert(pe, 'PE tem divisão 4');
  pe.standings[0].forEach((row, index) => {
    row.points = 30 - index;
    row.wins = row.points;
    row.played = row.points;
  });
  const advancers = collectPhaseAdvancers(pe);
  assert(advancers.length === 4, 'top 4 avançam');
  const snapshot = extractGuaranteedTier4ByUf(engine.competitions);
  assert(snapshot.PE?.length === 4, 'snapshot PE tier 4');
});

check('paulista QF bracket crosses groups 1A×4B etc', () => {
  const engine = createStateLeagueEngine();
  engine.build({
    clubs: {},
    regionalBaseClubs: [],
    importClubs,
    seasonYear: 2026,
    userUf: 'SP',
    userClub: 'Palmeiras',
  });
  const sp = engine.competitions.SP?.[0];
  sp.standings.forEach(group => {
    group.forEach((row, index) => {
      row.points = 30 - index;
      row.wins = row.points;
      row.played = row.points;
    });
  });
  const qualifiers = groupQualifiers(sp);
  assert(qualifiers.length === 2, '2 grupos');
  assert(qualifiers[0].length === 4 && qualifiers[1].length === 4, 'top 4 por grupo');
  const qf = buildQuarterfinalFixtures(qualifiers, 'SP', sp.groupRoundCount + 1);
  assert(qf[0].home === qualifiers[0][0].club && qf[0].away === qualifiers[1][3].club, '1A×4B');
  assert(qf[1].home === qualifiers[0][1].club && qf[1].away === qualifiers[1][2].club, '2A×3B');
  assert(qf[2].home === qualifiers[1][0].club && qf[2].away === qualifiers[0][3].club, '1B×4A');
  assert(qf[3].home === qualifiers[1][1].club && qf[3].away === qualifiers[0][2].club, '2B×3A');
});

check('stateLeagueGroupPosition uses group table not national rank', () => {
  const engine = createStateLeagueEngine();
  engine.build({
    clubs: {},
    regionalBaseClubs: [],
    importClubs,
    seasonYear: 2026,
    userUf: 'SP',
    userClub: 'Palmeiras',
  });
  const sp = engine.competitions.SP?.[0];
  assert(isPaulistaFormat(sp), 'SP paulista');
  const groupB = sp.groups[1];
  const clubB2 = groupB[1];
  sp.standings[1].forEach((row, index) => {
    row.points = 20 - index * 3;
    row.wins = row.points / 3;
    row.played = row.wins;
  });
  assert(stateLeagueGroupPosition(sp, clubB2, 1) === 2, '2º no grupo B');
  assert(stateLeagueGroupPosition(sp, groupB[0], 1) === 1, '1º no grupo B');
});

check('split creates multiple divisions when >10 clubs (non-SP)', () => {
  const sp = collectParticipantsForUf('SP', { importClubs });
  const divisions = splitStateDivisions(sp.slice(0, 35), {}, 'RJ', { seasonYear: 2026, lotterySeed: 1 });
  assert(divisions.length === 3, '35 clubes → 3 divisões de 10 (5 sobram sem divisão)');
  assert(divisions.every(item => item.teams.length === 10), 'cada divisão com exatamente 10');
});

check('UF com sobra não estica divisão (AL 13 → só Div 1)', () => {
  const al = collectParticipantsForUf('AL', { importClubs });
  assert(al.length === 13, 'AL tem 13 clubes');
  const divisions = splitStateDivisions(al, {}, 'AL', { seasonYear: 2026, lotterySeed: 1 });
  assert(divisions.length === 1, 'apenas 1 divisão');
  assert(divisions[0].teams.length === 10, 'Div 1 com exatamente 10');
});

check('sanitize corrige save antigo com divisão esticada (AL 13 → 10)', () => {
  const al = collectParticipantsForUf('AL', { importClubs });
  const bad = {
    AL: [{
      uf: 'AL',
      tier: 1,
      teams: al.slice(0, 13),
      standings: [al.slice(0, 13).map(club => ({ club, played: 1, wins: 0, draws: 0, losses: 1, goalDiff: 0, points: 0 }))],
      phase: 'league',
    }],
  };
  const fixed = sanitizeCompetitionsByUf(bad);
  assert(fixed.AL?.[0]?.teams?.length === 10, 'AL reduzido para 10');
});

check('todas as divisões geradas respeitam tamanho fixo por UF', () => {
  const built = buildAllStateCompetitions({ importClubs, seasonYear: 2026, lotterySeed: 1 });
  const bad = [];
  Object.entries(built).forEach(([uf, divs]) => {
    divs.forEach((d, i) => {
      const tier = d.tier || i + 1;
      const n = d.teams?.length || 0;
      const expected = uf === 'SP' && tier === 1 ? PAULISTA_DIVISION_SIZE : 10;
      if (n !== expected) bad.push({ uf, tier, n, expected });
    });
  });
  assert(bad.length === 0, `divisões inválidas: ${JSON.stringify(bad.slice(0, 5))}`);
});

check('scheduleStateLeagueDates yields 11 slots (Sun + Wed overflow)', () => {
  const slots = scheduleStateLeagueDates(2026, STATE_LEAGUE_CALENDAR_SLOTS);
  assert(slots.length === 11, `expected 11 slots, got ${slots.length}`);
  assert(slots.every(slot => slot.date instanceof Date), 'all slot dates');
  const engine = createStateLeagueEngine();
  engine.build({
    clubs: {},
    regionalBaseClubs: [],
    importClubs,
    seasonYear: 2026,
    userUf: 'RJ',
    userClub: 'Flamengo',
  });
  const rj = engine.competitions.RJ?.[0];
  assert(rj.calendarSlots.length === 11, 'RJ has 11 calendar slots');
  const semiSlot = rj.calendarSlots[rj.leagueRoundCount];
  const finalSlot = rj.calendarSlots[rj.leagueRoundCount + 1];
  assert(semiSlot?.date instanceof Date, 'semi slot has date');
  assert(finalSlot?.date instanceof Date, 'final slot has date');
});

check('repair backfills knockout dates on saved competitions', () => {
  const engine = createStateLeagueEngine();
  engine.build({
    clubs: {},
    regionalBaseClubs: [],
    importClubs,
    seasonYear: 2026,
    userUf: 'RJ',
    userClub: 'Flamengo',
  });
  const rj = engine.competitions.RJ[0];
  rj.calendarSlots = rj.calendarSlots.slice(0, 9);
  rj.fixtures.slice(0, rj.leagueRoundCount).forEach((round, index) => {
    round.forEach(game => {
      if (rj.calendarSlots[index]) {
        game.date = rj.calendarSlots[index].date;
      }
    });
  });
  rj.fixtures.slice(0, rj.leagueRoundCount).forEach(round => {
    round.forEach(game => {
      game.completed = true;
      game.homeGoals = 1;
      game.awayGoals = 0;
    });
  });
  repairStateLeagueCompetitionCalendar(rj, 2026);
  engine.hydrate(engine.serialize(), { userUf: 'RJ', seasonYear: 2026 });
  const repaired = engine.competitions.RJ[0];
  assert(repaired.phase === 'semis' || repaired.fixtures[repaired.leagueRoundCount]?.length > 0, 'knockout created');
  const semiGames = repaired.fixtures[repaired.leagueRoundCount] || [];
  assert(semiGames.every(game => game.date instanceof Date), 'semi games dated after repair');
});

check('knockout draw simulates penalties for AI games', () => {
  const engine = createStateLeagueEngine();
  engine.build({
    clubs: {},
    regionalBaseClubs: [],
    importClubs,
    seasonYear: 2026,
    userUf: 'RJ',
    userClub: 'Flamengo',
  });
  const rj = engine.competitions.RJ[0];
  for (let round = 1; round <= rj.leagueRoundCount; round += 1) {
    engine.commitRound(round, {
      simulateMatch: () => ({ homeGoals: 1, awayGoals: 0 }),
      userClub: 'Vinaz FC',
      recordLeaders: () => {},
      scopeUf: 'RJ',
    });
  }
  assert(rj.phase === 'semis', 'advanced to semis');
  let simulated = 0;
  engine.commitRound(rj.leagueRoundCount + 1, {
    simulateMatch: () => {
      simulated += 1;
      return { homeGoals: 0, awayGoals: 0 };
    },
    userClub: 'Vinaz FC',
    recordLeaders: () => {},
    scopeUf: 'RJ',
  });
  assert(simulated > 0, 'simulated semi round');
  const semiGames = rj.fixtures[rj.leagueRoundCount] || [];
  semiGames.forEach(game => {
    assert(isStateKnockoutPhase(game), 'semi fixture tagged');
    if (game.homeGoals === game.awayGoals) {
      assert(game.shootoutWinner, `${game.home} x ${game.away} has shootout winner`);
      assert(game.penalties || game.shootoutPenalties, `${game.home} x ${game.away} has penalty score`);
    }
  });
});

check('engine builds 27 UFs with league fixtures and dates', () => {
  const engine = createStateLeagueEngine();
  engine.build({
    clubs: {},
    regionalBaseClubs: [],
    importClubs,
    seasonYear: 2026,
    userUf: 'SP',
    userClub: 'Palmeiras',
  });
  const ufs = Object.keys(engine.competitions);
  assert(ufs.length === 27, '27 estaduais');
  const sp = engine.competitions.SP?.[0];
  assert(sp?.phase === 'groups', 'SP div 1 in groups phase');
  assert(isPaulistaFormat(sp), 'SP div 1 paulista format');
  assert(sp?.teams?.length === 18, '18 teams division 1');
  assert(sp?.groupRoundCount === 8, '8 group rounds');
  assert(sp?.fixtures?.length === 11, '11 calendar slots (groups + QF + SF + F)');
  assert(sp.fixtures[0]?.[0]?.date instanceof Date, 'locked date');
  assert(sp.fixtures[0]?.[0]?.competition === 'ESTADUAL', 'competition tag');
  assert(sp.fixtures[0]?.[0]?.phase === 'groups', 'groups phase tag');
  assert(!sp.teams.some(name => !importClubs.some(club => club.name === name && club.uf === 'SP')), 'no fictitious clubs');
});

check('top 4 advance to semi bracket 1v4 and 2v3 (league format)', () => {
  const engine = createStateLeagueEngine();
  engine.build({
    clubs: {},
    regionalBaseClubs: [],
    importClubs,
    seasonYear: 2026,
    userUf: 'RJ',
    userClub: 'Flamengo',
  });
  const rj = engine.competitions.RJ?.[0];
  const table = rj.standings[0];
  table.forEach((row, index) => {
    row.points = 30 - index;
    row.wins = row.points;
    row.played = row.points;
  });
  const topFour = leagueQualifiers(rj);
  assert(topFour.length === 4, 'top 4');
  const semis = buildSemifinalFixtures(topFour, 'RJ', rj.leagueRoundCount + 1);
  assert(semis[0].home === topFour[0].club && semis[0].away === topFour[3].club, '1v4');
  assert(semis[1].home === topFour[1].club && semis[1].away === topFour[2].club, '2v3');
});

check('commit round simulates other UFs in parallel', () => {
  const engine = createStateLeagueEngine();
  engine.build({
    clubs: {},
    regionalBaseClubs: [],
    importClubs,
    seasonYear: 2026,
    userUf: 'SP',
    userClub: 'Palmeiras',
  });
  const round = 1;
  engine.commitRound(round, {
    simulateMatch: () => ({ homeGoals: 1, awayGoals: 0 }),
    userClub: 'Palmeiras',
    recordLeaders: () => {},
  });
  const rj = engine.competitions.RJ?.[0];
  const played = (rj?.fixtures?.[round - 1] || []).filter(game => game.completed);
  assert(played.length > 0, 'RJ round 1 simulated');
});

check('calendar simulation records players and manager identity for other UFs', () => {
  const engine = createStateLeagueEngine();
  engine.build({
    clubs: {}, regionalBaseClubs: [], importClubs,
    seasonYear: 2026, userUf: 'SP', userClub: 'Palmeiras',
  });
  const rj = engine.competitions.RJ?.[0];
  const due = rj?.fixtures?.[0]?.[0]?.date;
  const recorded = [];
  engine.advanceThroughDate(due, {
    simulateMatch: (home, away) => ({ home, away, homeGoals: 2, awayGoals: 1, goals: { home: [], away: [] } }),
    userClub: 'Palmeiras',
    recordLeaders: game => recorded.push(game),
    getManagerForClub: club => ({ id: `manager:${club}`, name: `Técnico ${club}` }),
  });
  assert(recorded.some(game => game.homeManagerId === `manager:${game.home}`), 'manager stamped');
  assert(recorded.some(game => game.game?.stateUf === 'RJ'), 'RJ player stats recorded');
});

check('round browse helpers expose fixtures per UF', () => {
  const engine = createStateLeagueEngine();
  engine.build({
    clubs: {},
    regionalBaseClubs: [],
    importClubs,
    seasonYear: 2026,
    userUf: 'SP',
    userClub: 'Palmeiras',
  });
  const key = 'EST:SP:1';
  assert(engine.getRoundLimit(key) >= 3, 'round limit');
  const games = engine.getRoundGamesForBrowse(key, 1, { simulateMatch: () => ({ homeGoals: 0, awayGoals: 0 }) });
  assert(games.length > 0, 'preview games');
});

check('RNF uses estadual from 2027 only', () => {
  assert(stateLeagueAffectsSerieD(2026) === false, '2026 skip');
  assert(stateLeagueAffectsSerieD(2027) === true, '2027 apply');
  const engine = createStateLeagueEngine();
  engine.build({
    clubs: {},
    regionalBaseClubs: [],
    importClubs,
    seasonYear: 2027,
    userUf: 'SP',
    userClub: 'Palmeiras',
  });
  engine.competitions.SP[0].complete = true;
  engine.competitions.SP[0].champion = 'Palmeiras';
  const map2026 = buildStateRnfQualifiersByUf(engine.competitions, 2026);
  const map2027 = buildStateRnfQualifiersByUf(engine.competitions, 2027);
  assert(map2026.size === 0, 'no map 2026');
  assert(map2027.get('SP')?.includes('Palmeiras'), 'champion in RNF 2027');
});

check('Copa slot passes when champion is Serie A', () => {
  assert(hasSecuredCopaSlot('Palmeiras', { Palmeiras: { division: 'A' } }), 'A has secure slot');
  const competition = {
    complete: true,
    champion: 'Palmeiras',
    runnerUp: 'Santos',
    semifinalists: [],
    standings: [[{ club: 'Santos', points: 10 }, { club: 'Corinthians', points: 8 }]],
  };
  const resolved = resolveStateCopaSlot(competition, {
    Palmeiras: { division: 'A' },
    Santos: { division: 'A' },
    Corinthians: { division: 'B' },
  });
  assert(resolved.holders[0] === 'Corinthians', 'passes to next without secure slot');
  assert(resolved.passedFrom.some(item => item.skipped === 'Palmeiras'), 'champion skipped');
});

check('custom user club enters estadual of origin UF', () => {
  const engine = createStateLeagueEngine();
  const userClub = 'Vinaz FC';
  engine.build({
    clubs: {
      [userClub]: { name: userClub, division: 'A', uf: 'SP', power: 78 },
      Palmeiras: { name: 'Palmeiras', division: 'A', uf: 'SP', power: 85 },
    },
    regionalBaseClubs: [],
    importClubs,
    seasonYear: 2026,
    userUf: 'SP',
    userClub,
  });
  const division = engine.getUserDivision(userClub);
  assert(division, 'user division exists');
  assert(division.teams.includes(userClub), 'user in SP estadual');
  const fixtures = engine.getUserFixtures(userClub);
  assert(fixtures.length > 0, 'user has estadual fixtures');
  const firstDate = fixtures[0]?.date;
  assert(firstDate instanceof Date, 'estadual date set');
  assert(firstDate.getMonth() <= 2, 'estadual starts Jan–Mar window');
});

check('estadual badge label uses state name', () => {
  const game = { competition: STATE_LEAGUE_COMPETITION, stateUf: 'SP' };
  assert(stateLeagueBadgeName(game) === 'Estadual · São Paulo', 'badge name');
});

check('rules for EST:SP render paulista format', () => {
  const rules = buildCompetitionRules('EST:SP', 2027);
  assert(rules.title.includes('Paulista') || rules.kicker.includes('SP'), 'SP rules');
  const movementSection = rules.sections.find(item => item.heading === 'Acesso e rebaixamento');
  assert(movementSection?.items?.some(text => text.includes('2 piores de cada grupo')), 'paulista relegation documented');
  const copaSection = rules.sections.find(item => item.heading === 'Copa do Brasil');
  assert(copaSection?.items?.some(text => text.includes('vaga segura')), 'copa repasse documented');
});

check('ensureAllCompetitions backfills all hub states after partial hydrate', () => {
  const ctx = {
    clubs: {},
    regionalBaseClubs: [],
    importClubs,
    seasonYear: 2026,
    userUf: 'MT',
    userClub: 'Cuiabá',
    lotterySeed: 99,
  };
  const fullEngine = createStateLeagueEngine();
  fullEngine.build(ctx);
  const expectedAvailable = fullEngine.getHubStates('Cuiabá').filter(state => state.available).length;

  const slim = fullEngine.serialize();
  assert(Object.keys(slim.competitions).length === 1, 'serialize keeps user UF only');

  const partial = createStateLeagueEngine();
  partial.hydrate(slim, { userUf: 'MT', seasonYear: 2026 });
  assert(partial.getHubStates('Cuiabá').filter(state => state.available).length === 1, 'hydrate alone is partial');

  partial.ensureAllCompetitions(ctx);
  assert(
    partial.getHubStates('Cuiabá').filter(state => state.available).length === expectedAvailable,
    'ensureAllCompetitions matches full build availability',
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
