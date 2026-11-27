/**
 * Libertadores + Sul-Americana: formato, vagas, sorteio, avanço e save.
 * node scripts/conmebol-tests.mjs
 */
import assert from 'node:assert/strict';
import { CONMEBOL_CLUBS, buildConmebolClub, conmebolClubMeta } from '../js/engine/conmebol-clubs.js';
import { brazilLibertadoresBerths, brazilSudamericanaBerths, conmebolPrize, conmebolStageWindows } from '../js/engine/conmebol-format.js';
import {
  advanceConmebolThroughDate,
  conmebolClubStatus,
  conmebolEarnings,
  conmebolGroupTable,
  hydrateConmebolEdition,
  serializeConmebolEdition,
} from '../js/engine/conmebol-competition.js';
import { buildClubWorldCupParticipants, buildConmebolEdition, conmebolHistoryAfterEdition } from '../js/engine/conmebol-season.js';
import { getSeasonBlackouts } from '../js/engine/season-calendar-mold.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ok  ${name}`); }
  catch (error) { console.error(`  FAIL ${name}`); throw error; }
};

const BRAZIL = Array.from({ length: 20 }, (_, i) => `Clube BR ${String(i + 1).padStart(2, '0')}`);
const power = Object.fromEntries(BRAZIL.map((club, i) => [club, 66 - i * 0.6]));
const powerOf = club => power[club] ?? (conmebolClubMeta(club) ? 55 : 50);

function rngFrom(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const sim = (seed = 9) => {
  const r = rngFrom(seed);
  return game => {
    const diff = (powerOf(game.home) - powerOf(game.away)) / 10;
    const goals = lambda => { let k = 0; let p = Math.exp(-lambda); let sum = p; const u = r(); while (u > sum && k < 7) { k += 1; p *= lambda / k; sum += p; } return k; };
    return { homeGoals: goals(Math.max(0.3, 1.35 + diff * 0.5)), awayGoals: goals(Math.max(0.3, 1.05 - diff * 0.5)) };
  };
};
const hooks = (seed, extra = {}) => ({
  simulateGame: sim(seed),
  resolveShootout: (home, away) => ({ winner: powerOf(home) >= powerOf(away) ? home : away, score: '4–3' }),
  ...extra,
});

const makeEdition = (season = 2027, extra = {}) => buildConmebolEdition({
  season,
  careerSeed: 42,
  standingsA: BRAZIL,
  cupChampion: 'Clube BR 09',
  cupRunnerUp: 'Clube BR 03',
  powerOf,
  ...extra,
});

console.log('CONMEBOL');

test('catálogo tem 96 sul-americanos + 26 de outras confederações, sem nome repetido', () => {
  assert.equal(CONMEBOL_CLUBS.filter(c => c.confederation === 'CONMEBOL').length, 96);
  assert.equal(CONMEBOL_CLUBS.length, 122);
  assert.equal(new Set(CONMEBOL_CLUBS.map(c => c.name)).size, 122);
});

test('elenco estrangeiro é determinístico e maioria local', () => {
  const meta = CONMEBOL_CLUBS.find(c => c.country === 'URU');
  const a = buildConmebolClub(meta, { careerSeed: 3, seasonYear: 2027 });
  const b = buildConmebolClub(meta, { careerSeed: 3, seasonYear: 2027 });
  assert.deepEqual(a.roster.map(p => p.name), b.roster.map(p => p.name));
  assert.ok(a.roster.length >= 22);
  const local = a.roster.filter(p => p.nationality === 'Uruguai').length;
  assert.ok(local / a.roster.length > 0.6, `locais ${local}/${a.roster.length}`);
  assert.equal(a.division, 'INT');
});

test('vagas do Brasil: G4 + campeão da Copa nos grupos, 5º + vice na 2ª fase', () => {
  const berths = brazilLibertadoresBerths({ standingsA: BRAZIL, cupChampion: 'Clube BR 09', cupRunnerUp: 'Clube BR 03' });
  assert.deepEqual(berths.group.map(b => b.club), ['Clube BR 01', 'Clube BR 02', 'Clube BR 03', 'Clube BR 04', 'Clube BR 09']);
  // Vice da Copa (3º) já entrou pela Série A: 6º herda a vaga da 2ª fase.
  assert.deepEqual(berths.f2.map(b => b.club), ['Clube BR 05', 'Clube BR 06']);
});

test('campeão da Copa dentro do G4: vice herda a vaga nos grupos', () => {
  const berths = brazilLibertadoresBerths({ standingsA: BRAZIL, cupChampion: 'Clube BR 02', cupRunnerUp: 'Clube BR 11' });
  assert.deepEqual(berths.group.map(b => b.club), ['Clube BR 01', 'Clube BR 02', 'Clube BR 03', 'Clube BR 04', 'Clube BR 11']);
  assert.deepEqual(berths.f2.map(b => b.club), ['Clube BR 05', 'Clube BR 06']);
});

test('Sul-Americana pega os 6 melhores fora da Libertadores', () => {
  const lib = brazilLibertadoresBerths({ standingsA: BRAZIL, cupChampion: 'Clube BR 09', cupRunnerUp: 'Clube BR 03' });
  const taken = [...lib.group, ...lib.f2].map(b => b.club);
  const sud = brazilSudamericanaBerths({ standingsA: BRAZIL, exclude: taken });
  assert.deepEqual(sud.map(b => b.club), ['Clube BR 07', 'Clube BR 08', 'Clube BR 10', 'Clube BR 11', 'Clube BR 12', 'Clube BR 13']);
});

test('edição nasce com 47 + 44 clubes e as fases certas', () => {
  const ed = makeEdition();
  const lib = ed.libertadores.entrants;
  assert.equal(lib.group.length, 28);
  assert.equal(lib.f2.length, 13);
  assert.equal(lib.f1.length, 6);
  assert.equal(ed.sudamericana.entrants.group.length, 12);
  assert.equal(ed.sudamericana.entrants.fs.length, 32);
  assert.equal(ed.libertadores.stages.F1.ties.length, 3);
  assert.equal(ed.sudamericana.stages.FS.ties.length, 16);
  // 1ª fase da Sul: clássicos nacionais.
  ed.sudamericana.stages.FS.ties.forEach(tie => assert.equal(ed.countries[tie.home], ed.countries[tie.away]));
  const all = [...Object.values(lib).flat(), ...Object.values(ed.sudamericana.entrants).flat()].map(e => e.club);
  assert.equal(new Set(all).size, all.length, 'clube em duas copas');
});

test('temporada completa: grupos, playoffs, mata-mata e campeões', () => {
  const ed = makeEdition();
  advanceConmebolThroughDate(ed, new Date(2027, 11, 31), hooks(5));
  const lib = ed.libertadores;
  const sud = ed.sudamericana;
  assert.ok(lib.champion, 'sem campeão da Libertadores');
  assert.ok(sud.champion, 'sem campeão da Sul-Americana');
  assert.equal(Object.values(lib.stages.G.groups).flat().length, 32);
  assert.equal(Object.values(sud.stages.G.groups).flat().length, 32);
  assert.equal(sud.stages.PO.ties.length, 8);
  assert.equal(lib.stages.R16.ties.length, 8);
  assert.equal(sud.stages.R16.ties.length, 8);
  const count = id => ed.fixtures.filter(g => g.competitionId === id).length;
  assert.equal(count('libertadores'), 155);
  assert.equal(count('sudamericana'), 157);
  assert.ok(ed.fixtures.every(g => g.completed));
  // Grupos sem dois clubes do mesmo país (relaxa só em último caso).
  const clashes = Object.values(lib.stages.G.groups).filter(g => new Set(g.map(c => ed.countries[c])).size < 4).length;
  assert.ok(clashes <= 1, `${clashes} grupos com país repetido`);
  // Perdedores da 3ª fase caem nos grupos da Sul.
  lib.stages.F3.ties.forEach(tie => assert.ok(Object.values(sud.stages.G.groups).flat().includes(tie.loser)));
  // Terceiros da Liberta estão nos playoffs da Sul.
  const thirds = Object.keys(lib.stages.G.groups).map(l => conmebolGroupTable(ed, 'libertadores', l)[2].club);
  const playoffClubs = sud.stages.PO.ties.flatMap(t => [t.home, t.away]);
  thirds.forEach(club => assert.ok(playoffClubs.includes(club), `${club} fora dos playoffs`));
  // Oitavas da Liberta: líder não enfrenta o vice do mesmo grupo.
  const groupOf = {};
  Object.entries(lib.stages.G.groups).forEach(([l, teams]) => teams.forEach(t => { groupOf[t] = l; }));
  lib.stages.R16.ties.forEach(t => assert.notEqual(groupOf[t.home], groupOf[t.away]));
});

test('Recopa: campeões do ano anterior, ida e volta no fim do verão, Liberta manda a volta', () => {
  const ed = makeEdition(2027, { titleHolders: { libertadores: 'Clube BR 05', sudamericana: 'Millonarios de Núñez' } });
  const tie = ed.recopa.stages.F.ties[0];
  const games = ed.fixtures.filter(g => g.competitionId === 'recopa');
  assert.equal(games.length, 2);
  assert.equal(games[1].home, 'Clube BR 05');
  assert.equal(games[0].home, 'Millonarios de Núñez');
  games.forEach(g => assert.ok([1, 2].includes(new Date(g.date).getMonth()), 'Recopa fora de fev/mar'));
  assert.ok(new Date(games[1].date) - new Date(games[0].date) >= 5 * 86400000);
  advanceConmebolThroughDate(ed, new Date(2027, 2, 15), hooks(3));
  assert.ok(ed.recopa.champion, 'Recopa sem campeão');
  assert.equal(tie.winner, ed.recopa.champion);
  assert.ok(!games.some(g => g.extraTimeWinner), 'Recopa não tem prorrogação');
});

test('Intercontinental: campeão da Liberta entra no Derby das Américas e vai até a final', () => {
  const ed = makeEdition();
  advanceConmebolThroughDate(ed, new Date(2027, 11, 31), hooks(5));
  const inter = ed.intercontinental;
  assert.ok(inter.stages.DA, 'sem Derby das Américas');
  assert.equal(inter.stages.DA.ties[0].home, ed.libertadores.champion);
  assert.ok(inter.stages.CH && inter.stages.IF, 'fases faltando');
  assert.ok(inter.champion, 'sem campeão intercontinental');
  const games = ed.fixtures.filter(g => g.competitionId === 'intercontinental');
  assert.equal(games.length, 3);
  games.forEach(g => { assert.equal(g.neutral, true); assert.equal(new Date(g.date).getMonth(), 11); });
  assert.ok(new Date(games[0].date) > new Date(ed.fixtures.find(g => g.competitionId === 'libertadores' && g.stage === 'F').date));
  assert.equal(conmebolClubMeta(inter.stages.IF.ties[0].home)?.confederation, 'UEFA');
  // Empate em jogo único decide na prorrogação ou nos pênaltis, nunca fica aberto.
  games.forEach(g => assert.ok(g.winner));
});

test('save antigo sem Recopa/Intercontinental continua avançando', () => {
  const ed = makeEdition();
  const old = serializeConmebolEdition(ed);
  delete old.recopa; delete old.intercontinental; delete old.windows.recopa; delete old.windows.intercontinental;
  const back = hydrateConmebolEdition(old);
  advanceConmebolThroughDate(back, new Date(2027, 11, 31), hooks(5));
  assert.ok(back.libertadores.champion);
});

test('Mundial de Clubes 2029: 32 clubes, 6 sul-americanos, grupos sem confederação repetida (UEFA até 2)', () => {
  const parts = buildClubWorldCupParticipants({
    season: 2029,
    libertadoresChampions: { 2025: 'Clube BR 01', 2026: 'Millonarios de Núñez', 2027: 'Clube BR 04', 2028: 'Clube BR 01' },
    history: { 'Clube BR 02': { points: 30 }, 'Xeneizes de La Ribera': { titles: 1, points: 25 } },
    powerOf,
  });
  assert.equal(parts.length, 32);
  const sul = parts.filter(p => p.confederation === 'CONMEBOL');
  assert.equal(sul.length, 6);
  assert.ok(!sul.some(p => p.club === 'Clube BR 02'), 'terceiro brasileiro com dois campeões do país');
  const ed = makeEdition(2029, { clubWorldCup: { participants: parts } });
  const confed = club => parts.find(p => p.club === club).confederation;
  Object.values(ed.mundial.stages.G.groups).forEach(group => {
    assert.equal(group.length, 4);
    const counts = {};
    group.forEach(club => { counts[confed(club)] = (counts[confed(club)] || 0) + 1; });
    Object.entries(counts).forEach(([c, n]) => assert.ok(n <= (c === 'UEFA' ? 2 : 1), `grupo com ${n} da ${c}`));
  });
  advanceConmebolThroughDate(ed, new Date(2029, 11, 31), hooks(8));
  assert.ok(ed.mundial.champion, 'Mundial sem campeão');
  const games = ed.fixtures.filter(g => g.competitionId === 'mundial');
  assert.equal(games.length, 63);
  assert.ok(games.every(g => g.neutral && g.completed));
  games.forEach(g => assert.ok([5, 6].includes(new Date(g.date).getMonth()), 'jogo do Mundial fora de jun/jul'));
  assert.ok(games.filter(g => g.stage !== 'G').every(g => g.winner), 'mata-mata sem vencedor');
});

test('2029 tem paragem de clubes no Mundial; 2027 e 2028 não', () => {
  assert.ok(getSeasonBlackouts(2029).some(b => b.id === 'club_world_cup' && b.hard));
  assert.ok(!getSeasonBlackouts(2027).some(b => b.id === 'club_world_cup'));
  assert.ok(!getSeasonBlackouts(2028).some(b => b.id === 'club_world_cup'));
});

test('final é jogo único em campo neutro', () => {
  const ed = makeEdition();
  advanceConmebolThroughDate(ed, new Date(2027, 11, 31), hooks(8));
  ['libertadores', 'sudamericana'].forEach(id => {
    const finals = ed.fixtures.filter(g => g.competitionId === id && g.stage === 'F');
    assert.equal(finals.length, 1);
    assert.ok(finals[0].neutral);
    assert.ok(finals[0].venue);
  });
});

test('datas: grupos antes da Copa, mata-mata depois, final em novembro', () => {
  const ed = makeEdition(2026);
  advanceConmebolThroughDate(ed, new Date(2026, 11, 31), hooks(2));
  const last = id => Math.max(...ed.fixtures.filter(g => g.competitionId === 'libertadores' && g.stage === id).map(g => new Date(g.date)));
  const first = id => Math.min(...ed.fixtures.filter(g => g.competitionId === 'libertadores' && g.stage === id).map(g => new Date(g.date)));
  assert.ok(last('G') < new Date(2026, 5, 1).getTime());
  assert.ok(first('R16') > new Date(2026, 6, 19).getTime());
  const final = ed.fixtures.find(g => g.competitionId === 'libertadores' && g.stage === 'F');
  assert.equal(new Date(final.date).getMonth(), 10);
  // Cada jogo cai na janela da sua fase.
  ed.fixtures.forEach(g => assert.ok(new Date(g.date) >= new Date(g.windowStart) && new Date(g.date) <= new Date(g.windowEnd)));
});

test('janela proibida empurra a semana', () => {
  const blocked = [{ start: new Date(2027, 3, 5), end: new Date(2027, 3, 18) }];
  const w = conmebolStageWindows('libertadores', 2027, { blocked });
  w.G.forEach(md => assert.ok(md.end < blocked[0].start || md.start > blocked[0].end, md.start.toISOString()));
});

test('jogo do usuário espera o ao vivo e trava a fase', () => {
  const ed = makeEdition();
  const user = 'Clube BR 01';
  const isUser = g => g.home === user || g.away === user;
  advanceConmebolThroughDate(ed, new Date(2027, 11, 31), hooks(3, { isUserFixture: isUser }));
  const pending = ed.fixtures.filter(g => !g.completed);
  assert.ok(pending.length > 0 && pending.every(isUser));
  assert.ok(!ed.libertadores.stages.R16, 'abriu oitavas sem o jogo do usuário');
  // Usuário joga seus jogos de grupo.
  pending.forEach(g => { g.homeGoals = g.home === user ? 2 : 0; g.awayGoals = g.away === user ? 2 : 0; g.completed = true; });
  advanceConmebolThroughDate(ed, new Date(2027, 11, 31), hooks(3, { isUserFixture: isUser }));
  assert.ok(ed.libertadores.stages.R16, 'oitavas não abriram');
  assert.equal(conmebolClubStatus(ed, user).competitionId, 'libertadores');
});

test('premiação cresce com a campanha e o campeão leva mais', () => {
  const ed = makeEdition();
  advanceConmebolThroughDate(ed, new Date(2027, 11, 31), hooks(11));
  const champ = ed.libertadores.champion;
  const earned = conmebolEarnings(ed, champ);
  assert.ok(earned >= conmebolPrize('libertadores', 'champion'));
  const groupOut = Object.keys(ed.libertadores.progress).find(c => ed.libertadores.progress[c].eliminatedAt === 'G');
  assert.ok(conmebolEarnings(ed, groupOut) < earned);
  assert.ok(earned > 4_000_000 && earned < 6_500_000, `campeão R$ ${earned}`);
});

test('save ida e volta preserva datas e resultados', () => {
  const ed = makeEdition();
  advanceConmebolThroughDate(ed, new Date(2027, 5, 1), hooks(4));
  const restored = hydrateConmebolEdition(JSON.parse(JSON.stringify(serializeConmebolEdition(ed))));
  assert.equal(restored.fixtures.length, ed.fixtures.length);
  assert.ok(restored.fixtures[0].date instanceof Date);
  advanceConmebolThroughDate(restored, new Date(2027, 11, 31), hooks(4));
  assert.ok(restored.libertadores.champion);
});

test('título continental dá vaga nos grupos no ano seguinte', () => {
  const ed = makeEdition(2027);
  advanceConmebolThroughDate(ed, new Date(2027, 11, 31), hooks(6));
  const history = conmebolHistoryAfterEdition(ed);
  const next = makeEdition(2028, {
    history,
    titleHolders: { libertadores: ed.libertadores.champion, sudamericana: ed.sudamericana.champion },
  });
  const groups = next.libertadores.entrants.group.map(e => e.club);
  assert.ok(groups.includes(ed.libertadores.champion));
  assert.ok(groups.includes(ed.sudamericana.champion));
  assert.equal(next.libertadores.entrants.group.length, 28);
});

console.log(`\n${passed} testes ok`);
