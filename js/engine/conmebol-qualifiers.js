/**
 * Eliminatórias Sul-Americanas — pontos corridos, turno e returno, 18 rodadas
 * nas Datas FIFA dos três anos entre uma Copa e outra.
 *
 * Ciclo 2030: Argentina, Uruguai e Paraguai já estão na Copa como sedes do
 * centenário, mas jogam as Eliminatórias normalmente (CONMEBOL confirmou).
 * As outras sete disputam 3 vagas diretas e 1 de repescagem intercontinental.
 * Ciclos sem sede sul-americana: 6 diretas + 1 repescagem (formato de 2026).
 *
 * Altitude conta: Bolívia (La Paz, 3.640 m) e Equador (Quito, 2.850 m)
 * ganham força extra em casa, como sempre ganharam.
 */

import { INTERNATIONAL_WINDOWS } from './international-calendar.js';

export const QUALIFIERS_COMPETITION = 'ELIMINATÓRIAS';
export const QUALIFIERS_VERSION = 1;

export const QUALIFIER_TEAMS = Object.freeze([
  Object.freeze({ code: 'ARG', name: 'Argentina', power: 94 }),
  Object.freeze({ code: 'BRA', name: 'Brasil', power: 94 }),
  Object.freeze({ code: 'URU', name: 'Uruguai', power: 91 }),
  Object.freeze({ code: 'COL', name: 'Colômbia', power: 91 }),
  Object.freeze({ code: 'ECU', name: 'Equador', power: 90, homeBoost: 3 }),
  Object.freeze({ code: 'PAR', name: 'Paraguai', power: 88 }),
  Object.freeze({ code: 'CHI', name: 'Chile', power: 85 }),
  Object.freeze({ code: 'VEN', name: 'Venezuela', power: 84 }),
  Object.freeze({ code: 'PER', name: 'Peru', power: 84 }),
  Object.freeze({ code: 'BOL', name: 'Bolívia', power: 81, homeBoost: 6 }),
]);

const TEAM_BY_CODE = new Map(QUALIFIER_TEAMS.map(team => [team.code, team]));

/** Sedes sul-americanas por Copa (classificadas, mas jogam). */
const HOSTS_BY_CYCLE = Object.freeze({ 2030: Object.freeze(['ARG', 'URU', 'PAR']) });

/** Vagas por ciclo: diretas entre as não-sedes + repescagem. */
export function qualifierSlots(cycleYear) {
  const hosts = HOSTS_BY_CYCLE[cycleYear] || [];
  return hosts.length ? { hosts, direct: 3, playoff: 1 } : { hosts: [], direct: 6, playoff: 1 };
}

/** As 9 janelas FIFA do ciclo (set/out do 1º ano até set/out do 3º). */
export function qualifierWindows(cycleYear) {
  const years = [cycleYear - 3, cycleYear - 2, cycleYear - 1];
  const windows = years.flatMap(year => (INTERNATIONAL_WINDOWS[year] || []).map(w => ({ ...w, year })));
  // Começa na janela de setembro do 1º ano (depois da Copa anterior).
  const startIndex = windows.findIndex(w => w.year === years[0] && w.start[0] >= 7);
  return windows.slice(Math.max(0, startIndex), Math.max(0, startIndex) + 9);
}

/** Tabela de turno único pelo método do círculo (10 times → 9 rodadas). */
function roundRobin(codes) {
  const teams = [...codes];
  const rounds = [];
  for (let r = 0; r < teams.length - 1; r += 1) {
    const pairs = [];
    for (let i = 0; i < teams.length / 2; i += 1) {
      const a = teams[i];
      const b = teams[teams.length - 1 - i];
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    teams.splice(1, 0, teams.pop());
  }
  return rounds;
}

/**
 * @param {object} params
 * @param {number} params.cycleYear ano da Copa (2030, 2034…)
 * @param {number} [params.seed]
 */
export function createConmebolQualifiers({ cycleYear, seed = 1 } = {}) {
  const codes = QUALIFIER_TEAMS.map(team => team.code);
  // Ordem embaralhada de forma determinística para o calendário mudar por carreira.
  let state = (Number(seed) >>> 0) || 1;
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const shuffled = [...codes].sort(() => rand() - 0.5);
  const firstLeg = roundRobin(shuffled);
  const allRounds = [...firstLeg, ...firstLeg.map(pairs => pairs.map(([home, away]) => [away, home]))];
  const windows = qualifierWindows(cycleYear);
  const fixtures = [];
  allRounds.forEach((pairs, index) => {
    const window = windows[Math.floor(index / 2)];
    if (!window) return;
    const offset = index % 2 === 0 ? 3 : 8;
    const date = new Date(window.year, window.start[0], window.start[1] + offset, 21);
    pairs.forEach(([home, away], k) => {
      fixtures.push({
        id: `elim-${cycleYear}-${index + 1}-${k + 1}`,
        competition: QUALIFIERS_COMPETITION,
        cycleYear,
        matchday: index + 1,
        windowId: window.id,
        home,
        away,
        homeName: TEAM_BY_CODE.get(home).name,
        awayName: TEAM_BY_CODE.get(away).name,
        date: date.toISOString(),
        completed: false,
        homeGoals: null,
        awayGoals: null,
      });
    });
  });
  return {
    version: QUALIFIERS_VERSION,
    cycleYear,
    fixtures,
    complete: false,
    qualified: [],
    playoff: null,
    rngState: state,
  };
}

function nextRandom(qualifiers) {
  qualifiers.rngState = (Math.imul(qualifiers.rngState || 1, 1664525) + 1013904223) >>> 0;
  return qualifiers.rngState / 4294967296;
}

/** Força com mando (altitude incluída). */
export function qualifierStrength(code, { home = false } = {}) {
  const team = TEAM_BY_CODE.get(code);
  if (!team) return 85;
  return team.power + (home ? 1.5 + (team.homeBoost || 0) : 0);
}

/** Placar pelo mesmo modelo de Poisson da Copa (força vem de fora). */
function simulateQualifier(qualifiers, game) {
  const diff = (qualifierStrength(game.home, { home: true }) - qualifierStrength(game.away)) / 18;
  const lamH = Math.max(0.35, 1.2 + diff * 0.45);
  const lamA = Math.max(0.3, 1.05 - diff * 0.45);
  const sample = lambda => {
    let p = Math.exp(-lambda);
    let sum = p;
    let k = 0;
    const u = nextRandom(qualifiers);
    while (u > sum && k < 7) {
      k += 1;
      p *= lambda / k;
      sum += p;
    }
    return k;
  };
  return { homeGoals: sample(lamH), awayGoals: sample(lamA) };
}

/** Tabela, pelos critérios da CONMEBOL (pontos, saldo, gols). */
export function qualifierTable(qualifiers) {
  const rows = Object.fromEntries(QUALIFIER_TEAMS.map(team => [team.code, {
    code: team.code, name: team.name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
  }]));
  (qualifiers?.fixtures || []).filter(game => game.completed).forEach(game => {
    const h = rows[game.home];
    const a = rows[game.away];
    if (!h || !a) return;
    h.played += 1; a.played += 1;
    h.goalsFor += game.homeGoals; h.goalsAgainst += game.awayGoals;
    a.goalsFor += game.awayGoals; a.goalsAgainst += game.homeGoals;
    if (game.homeGoals > game.awayGoals) { h.won += 1; h.points += 3; a.lost += 1; }
    else if (game.homeGoals < game.awayGoals) { a.won += 1; a.points += 3; h.lost += 1; }
    else { h.drawn += 1; a.drawn += 1; h.points += 1; a.points += 1; }
  });
  return Object.values(rows)
    .map(row => ({ ...row, goalDiff: row.goalsFor - row.goalsAgainst }))
    .sort((x, y) => (y.points - x.points) || (y.goalDiff - x.goalDiff) || (y.goalsFor - x.goalsFor) || x.name.localeCompare(y.name, 'pt-BR'));
}

/**
 * Joga as rodadas com data até `date`. Fecha a classificação quando acabar.
 * @returns {{changed: boolean, completedMatchdays: number[], finished: boolean}}
 */
export function advanceQualifiersThroughDate(qualifiers, date) {
  if (!qualifiers || qualifiers.complete) return { changed: false, completedMatchdays: [], finished: false };
  const limit = new Date(date).getTime();
  const matchdays = new Set();
  qualifiers.fixtures.forEach(game => {
    if (game.completed || new Date(game.date).getTime() > limit) return;
    Object.assign(game, simulateQualifier(qualifiers, game), { completed: true });
    matchdays.add(game.matchday);
  });
  let finished = false;
  if (qualifiers.fixtures.length && qualifiers.fixtures.every(game => game.completed)) {
    const { hosts, direct, playoff } = qualifierSlots(qualifiers.cycleYear);
    const table = qualifierTable(qualifiers).filter(row => !hosts.includes(row.code));
    const directCodes = table.slice(0, direct).map(row => row.code);
    const playoffTeam = playoff ? table[direct]?.code : null;
    // Repescagem intercontinental: chance pela força (Bolívia em 2026 caiu nela).
    const playoffWin = playoffTeam ? nextRandom(qualifiers) < Math.min(0.8, Math.max(0.25, (qualifierStrength(playoffTeam) - 76) / 20)) : false;
    qualifiers.qualified = [...hosts, ...directCodes, ...(playoffWin ? [playoffTeam] : [])];
    qualifiers.playoff = playoffTeam ? { team: playoffTeam, won: playoffWin } : null;
    qualifiers.complete = true;
    finished = true;
  }
  return { changed: matchdays.size > 0 || finished, completedMatchdays: [...matchdays].sort((a, b) => a - b), finished };
}

export function qualifierTeamName(code) {
  return TEAM_BY_CODE.get(code)?.name || code;
}

/** Ciclo das Eliminatórias em andamento num ano (null em ano de Copa). */
export function qualifiersCycleForYear(year) {
  const y = Number(year);
  const anchor = 2026;
  if (!Number.isFinite(y) || y <= anchor) return null;
  const offset = (y - anchor) % 4;
  if (offset === 0) return null;
  return y + (4 - offset);
}
