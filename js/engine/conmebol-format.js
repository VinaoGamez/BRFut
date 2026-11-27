/**
 * Regras da Libertadores e da Sul-Americana (formato em vigor desde 2023, com
 * as vagas do Brasil válidas a partir da edição 2027).
 *
 * Libertadores — 47 clubes
 *   1ª fase   6 clubes (4ª vaga de BOL, ECU, PAR, PER, URU, VEN), ida e volta
 *   2ª fase  16 clubes (3 vencedores + 13 que entram aqui), ida e volta
 *   3ª fase   8 clubes, ida e volta. Vencedores vão aos grupos; perdedores,
 *             à fase de grupos da Sul-Americana
 *   Grupos   32 clubes em 8 grupos de 4, turno e returno. 1º e 2º às oitavas;
 *             3º vai aos playoffs da Sul-Americana
 *   Oitavas, quartas e semis em ida e volta; final em jogo único, campo neutro
 *
 * Sul-Americana — 56 clubes
 *   1ª fase  32 clubes (4 de cada país, exceto ARG e BRA), clássicos nacionais
 *             em jogo único
 *   Grupos   32 clubes (6 ARG + 6 BRA + 16 da 1ª fase + 4 da 3ª fase da Liberta)
 *             Só o 1º vai direto às oitavas
 *   Playoffs 2º da Sul-Americana × 3º da Libertadores, ida e volta
 *   Oitavas, quartas e semis em ida e volta; final em jogo único
 *
 * Vagas do Brasil na Libertadores (CBF, a partir da temporada 2026):
 *   Grupos  — 4 primeiros da Série A + campeão da Copa do Brasil
 *   2ª fase — 5º da Série A + vice da Copa do Brasil
 *   Se o campeão da Copa já entrou pela Série A, o vice herda a vaga nos grupos.
 * Sul-Americana: os 6 melhores da Série A que ficaram fora da Libertadores.
 *
 * Premiação 2026 (CONMEBOL), convertida para a escala da economia do jogo.
 * Mês em base 0 nas datas, como no resto do calendário.
 */

export const LIBERTADORES = 'LIBERTADORES';
export const SUDAMERICANA = 'SUL-AMERICANA';
export const RECOPA_SUL = 'RECOPA SUL-AMERICANA';
export const INTERCONTINENTAL = 'INTERCONTINENTAL';

export const CONMEBOL_COMPETITIONS = Object.freeze({
  libertadores: Object.freeze({ id: 'libertadores', key: LIBERTADORES, label: 'Copa Libertadores', short: 'Libertadores' }),
  sudamericana: Object.freeze({ id: 'sudamericana', key: SUDAMERICANA, label: 'Copa Sul-Americana', short: 'Sul-Americana' }),
  recopa: Object.freeze({ id: 'recopa', key: RECOPA_SUL, label: 'Recopa Sul-Americana', short: 'Recopa Sul-Americana' }),
  intercontinental: Object.freeze({ id: 'intercontinental', key: INTERCONTINENTAL, label: 'Copa Intercontinental da FIFA', short: 'Intercontinental' }),
});

/** Todas as chaves de `game.competition` que a edição CONMEBOL controla. */
export const CONMEBOL_GAME_KEYS = Object.freeze(new Set([LIBERTADORES, SUDAMERICANA, RECOPA_SUL, INTERCONTINENTAL]));

/** Chave de disciplina (cartões) por competição. */
export const CONMEBOL_DISCIPLINE_KEYS = Object.freeze({
  [LIBERTADORES]: 'LIBERTADORES',
  [SUDAMERICANA]: 'SUDAMERICANA',
  [RECOPA_SUL]: 'RECOPA_SUL',
  [INTERCONTINENTAL]: 'INTERCONTINENTAL',
});

/** Nome curto da competição de um jogo (selo, manchete). */
export function conmebolShortName(game) {
  const id = conmebolCompetitionIdFromKey(game?.competition);
  return id ? CONMEBOL_COMPETITIONS[id].short : '';
}

export function conmebolCompetitionIdFromKey(key) {
  if (key === LIBERTADORES) return 'libertadores';
  if (key === SUDAMERICANA) return 'sudamericana';
  if (key === RECOPA_SUL) return 'recopa';
  if (key === INTERCONTINENTAL) return 'intercontinental';
  return null;
}

export function isConmebolGame(game) {
  return CONMEBOL_GAME_KEYS.has(game?.competition);
}

/** Nome de cada fase, em português, como aparece na tela. */
export const STAGE_LABELS = Object.freeze({
  F1: '1ª fase',
  F2: '2ª fase',
  F3: '3ª fase',
  FS: '1ª fase',
  G: 'Fase de grupos',
  PO: 'Playoffs',
  R16: 'Oitavas de final',
  QF: 'Quartas de final',
  SF: 'Semifinal',
  F: 'Final',
  DA: 'Derby das Américas',
  CH: 'Desafio Intercontinental',
  IF: 'Final',
});

export const LIBERTADORES_STAGES = Object.freeze(['F1', 'F2', 'F3', 'G', 'R16', 'QF', 'SF', 'F']);
export const SUDAMERICANA_STAGES = Object.freeze(['FS', 'G', 'PO', 'R16', 'QF', 'SF', 'F']);
export const RECOPA_STAGES = Object.freeze(['F']);
export const INTERCONTINENTAL_STAGES = Object.freeze(['DA', 'CH', 'IF']);

export function conmebolStageOrder(competitionId) {
  return {
    libertadores: LIBERTADORES_STAGES,
    sudamericana: SUDAMERICANA_STAGES,
    recopa: RECOPA_STAGES,
    intercontinental: INTERCONTINENTAL_STAGES,
  }[competitionId] || [];
}

/** Jogo único de mata-mata com prorrogação: finais de Liberta/Sula e todo o Intercontinental. */
export function conmebolNeedsExtraTime(game) {
  if (!game) return false;
  if (game.competition === INTERCONTINENTAL) return true;
  return (game.competition === LIBERTADORES || game.competition === SUDAMERICANA) && game.stage === 'F';
}

/**
 * Vagas de cada país. `group`, `f2`, `f1` (Liberta) e `group`, `fs` (Sul) são
 * quantas vagas entram em cada fase, na ordem da tabela nacional.
 */
export const COUNTRY_BERTHS = Object.freeze({
  ARG: Object.freeze({ lib: { group: 5, f2: 1, f1: 0 }, sud: { group: 6, fs: 0 } }),
  BRA: Object.freeze({ lib: { group: 5, f2: 2, f1: 0 }, sud: { group: 6, fs: 0 } }),
  CHI: Object.freeze({ lib: { group: 2, f2: 2, f1: 0 }, sud: { group: 0, fs: 4 } }),
  COL: Object.freeze({ lib: { group: 2, f2: 2, f1: 0 }, sud: { group: 0, fs: 4 } }),
  BOL: Object.freeze({ lib: { group: 2, f2: 1, f1: 1 }, sud: { group: 0, fs: 4 } }),
  ECU: Object.freeze({ lib: { group: 2, f2: 1, f1: 1 }, sud: { group: 0, fs: 4 } }),
  PAR: Object.freeze({ lib: { group: 2, f2: 1, f1: 1 }, sud: { group: 0, fs: 4 } }),
  PER: Object.freeze({ lib: { group: 2, f2: 1, f1: 1 }, sud: { group: 0, fs: 4 } }),
  URU: Object.freeze({ lib: { group: 2, f2: 1, f1: 1 }, sud: { group: 0, fs: 4 } }),
  VEN: Object.freeze({ lib: { group: 2, f2: 1, f1: 1 }, sud: { group: 0, fs: 4 } }),
});

/**
 * Vagas do Brasil na Libertadores a partir do que a temporada nacional deu.
 *
 * @param {object} params
 * @param {string[]} params.standingsA Série A do 1º ao 20º
 * @param {string|null} params.cupChampion campeão da Copa do Brasil
 * @param {string|null} params.cupRunnerUp vice da Copa do Brasil
 * @param {Set<string>|string[]} [params.exclude] clubes já classificados por outra via (títulos continentais)
 * @returns {{group: Array<{club:string, via:string}>, f2: Array<{club:string, via:string}>}}
 */
export function brazilLibertadoresBerths({ standingsA = [], cupChampion = null, cupRunnerUp = null, exclude = [] } = {}) {
  const taken = new Set(exclude instanceof Set ? [...exclude] : exclude);
  const group = [];
  const f2 = [];
  const add = (list, club, via) => {
    if (!club || taken.has(club)) return false;
    taken.add(club);
    list.push({ club, via });
    return true;
  };
  const nextLeague = list => {
    for (let i = 0; i < standingsA.length; i += 1) {
      if (add(list, standingsA[i], `${i + 1}º da Série A`)) return true;
    }
    return false;
  };

  // Grupos: G4 da Série A + campeão da Copa. Se o campeão já está no G4, o vice
  // herda a vaga nos grupos (regra da CBF).
  standingsA.slice(0, 4).forEach((club, index) => add(group, club, `${index + 1}º da Série A`));
  if (!add(group, cupChampion, 'Campeão da Copa do Brasil')) {
    add(group, cupRunnerUp, 'Vice da Copa do Brasil');
  }
  while (group.length < 5 && nextLeague(group));

  // 2ª fase: 5º da Série A + vice da Copa; quem já entrou é substituído pelo
  // próximo da tabela.
  if (standingsA[4]) add(f2, standingsA[4], '5º da Série A');
  add(f2, cupRunnerUp, 'Vice da Copa do Brasil');
  while (f2.length < 2 && nextLeague(f2));
  return { group, f2 };
}

/** Os 6 melhores da Série A fora da Libertadores vão à Sul-Americana. */
export function brazilSudamericanaBerths({ standingsA = [], exclude = [] } = {}) {
  const taken = new Set(exclude instanceof Set ? [...exclude] : exclude);
  const out = [];
  for (let i = 0; i < standingsA.length && out.length < 6; i += 1) {
    const club = standingsA[i];
    if (!club || taken.has(club)) continue;
    taken.add(club);
    out.push({ club, via: `${i + 1}º da Série A` });
  }
  return out;
}

/**
 * Vagas de um país estrangeiro, pela tabela nacional.
 * @returns {{lib: {group:string[], f2:string[], f1:string[]}, sud: {group:string[], fs:string[]}}}
 */
export function foreignCountryBerths(country, table = [], exclude = []) {
  const rules = COUNTRY_BERTHS[country];
  const taken = new Set(exclude instanceof Set ? [...exclude] : exclude);
  const pool = table.filter(club => !taken.has(club));
  const take = count => pool.splice(0, Math.max(0, count));
  return {
    lib: { group: take(rules.lib.group), f2: take(rules.lib.f2), f1: take(rules.lib.f1) },
    sud: { group: take(rules.sud.group), fs: take(rules.sud.fs) },
  };
}

/* --------------------------------------------------------------------------
 * Calendário
 * ------------------------------------------------------------------------ */

/**
 * Semanas de 2026, publicadas pela CONMEBOL. Cada entrada é [mês, dia início,
 * dia fim] da semana (ter–qui). Final é [mês, dia].
 */
const CALENDAR_2026 = Object.freeze({
  libertadores: Object.freeze({
    F1: { ida: [1, 3, 5], volta: [1, 10, 12] },
    F2: { ida: [1, 17, 19], volta: [1, 24, 26] },
    F3: { ida: [2, 3, 5], volta: [2, 10, 12] },
    G: [[3, 7, 9], [3, 14, 16], [3, 28, 30], [4, 5, 7], [4, 19, 21], [4, 26, 28]],
    R16: { ida: [7, 11, 13], volta: [7, 18, 20] },
    QF: { ida: [8, 15, 17], volta: [8, 22, 24] },
    SF: { ida: [9, 20, 22], volta: [9, 27, 29] },
    F: { single: [10, 28] },
  }),
  sudamericana: Object.freeze({
    FS: { single: [2, 3, 5] },
    G: [[3, 7, 9], [3, 14, 16], [3, 28, 30], [4, 5, 7], [4, 19, 21], [4, 26, 28]],
    PO: { ida: [6, 21, 23], volta: [6, 28, 30] },
    R16: { ida: [7, 11, 13], volta: [7, 18, 20] },
    QF: { ida: [8, 15, 17], volta: [8, 22, 24] },
    SF: { ida: [9, 20, 22], volta: [9, 27, 29] },
    F: { single: [10, 21] },
  }),
  // Recopa 2026: 19 e 26 de fevereiro (quintas). O campeão da Libertadores manda a volta.
  recopa: Object.freeze({
    F: { ida: [1, 18, 19], volta: [1, 25, 26] },
  }),
  // Copa Intercontinental da FIFA (formato desde 2024): Derby das Américas,
  // Desafio e final em sede neutra, em dezembro.
  intercontinental: Object.freeze({
    DA: { single: [11, 9] },
    CH: { single: [11, 12] },
    IF: { single: [11, 16] },
  }),
});

/** Competições de datas fixas: não andam por causa de Data FIFA. */
const FIXED_DATE_COMPETITIONS = new Set(['recopa', 'intercontinental']);

const DAY_MS = 86_400_000;

function isoWeekdayAndWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / DAY_MS + 1) / 7);
  return { week, weekday };
}

function dateFromIsoWeek(year, week, weekday) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Weekday = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() - (jan4Weekday - 1) * DAY_MS + (week - 1) * 7 * DAY_MS);
  const d = new Date(monday.getTime() + (weekday - 1) * DAY_MS);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12);
}

/** Leva uma data de 2026 para o mesmo dia da semana e semana ISO de outro ano. */
function mapFrom2026(year, month, day) {
  const base = new Date(2026, month, day, 12);
  if (Number(year) === 2026) return base;
  const { week, weekday } = isoWeekdayAndWeek(base);
  return dateFromIsoWeek(Number(year), week, weekday);
}

function windowOf(year, [month, start, end]) {
  const from = mapFrom2026(year, month, start);
  const to = end != null ? mapFrom2026(year, month, end) : from;
  return { start: from, end: to };
}

/**
 * Datas de todas as fases de uma competição num ano. Cada janela tem início e
 * fim (ter–qui); a data exata de cada jogo é escolhida dentro da janela, de
 * acordo com a agenda do clube brasileiro.
 *
 * @param {'libertadores'|'sudamericana'} competitionId
 * @param {number} year
 * @param {object} [options]
 * @param {Array<{start:Date,end:Date}>} [options.blocked] janelas proibidas (FIFA, Copa)
 */
export function conmebolStageWindows(competitionId, year, { blocked = [] } = {}) {
  const template = CALENDAR_2026[competitionId];
  if (!template) return {};

  // Lista cronológica de todas as semanas da competição.
  const items = [];
  Object.entries(template).forEach(([stage, spec]) => {
    if (Array.isArray(spec)) {
      spec.forEach((entry, index) => items.push({ stage, key: index, window: windowOf(year, entry) }));
      return;
    }
    ['single', 'ida', 'volta'].forEach(key => {
      if (spec[key]) items.push({ stage, key, window: windowOf(year, spec[key]) });
    });
  });
  items.sort((a, b) => a.window.start - b.window.start);
  if (FIXED_DATE_COMPETITIONS.has(competitionId)) {
    const fixed = {};
    items.forEach(({ stage, key, window }) => { (fixed[stage] = fixed[stage] || {})[key] = window; });
    return fixed;
  }

  const isBlocked = window => blocked.some(b => window.start <= b.end && window.end >= b.start);
  const shift = (window, days) => ({
    start: new Date(window.start.getTime() + days * DAY_MS),
    end: new Date(window.end.getTime() + days * DAY_MS),
  });
  const MIN_GAP = 5 * DAY_MS;

  // Primeiro semestre: se a semana cai em Data FIFA ou na liberação para a Copa,
  // a CONMEBOL antecipa — e as rodadas anteriores recuam junto.
  const pivot = new Date(Number(year), 6, 1).getTime();
  const before = items.filter(item => item.window.start.getTime() < pivot);
  const after = items.filter(item => item.window.start.getTime() >= pivot);
  for (let i = before.length - 1; i >= 0; i -= 1) {
    const next = before[i + 1]?.window || null;
    for (let guard = 0; guard < 10; guard += 1) {
      const tooClose = next && before[i].window.end.getTime() > next.start.getTime() - MIN_GAP;
      if (!isBlocked(before[i].window) && !tooClose) break;
      before[i].window = shift(before[i].window, -7);
    }
  }
  // Segundo semestre: adia para a semana seguinte livre. Ida e volta andam
  // juntas, para o confronto não ficar com um mês entre os jogos.
  const units = [];
  after.forEach(item => {
    const last = units[units.length - 1];
    if (last && last[0].stage === item.stage) last.push(item);
    else units.push([item]);
  });
  let prevEnd = before[before.length - 1]?.window.end || null;
  units.forEach(unit => {
    for (let guard = 0; guard < 10; guard += 1) {
      const tooClose = prevEnd && unit[0].window.start.getTime() < prevEnd.getTime() + MIN_GAP;
      if (!unit.some(item => isBlocked(item.window)) && !tooClose) break;
      unit.forEach(item => { item.window = shift(item.window, 7); });
    }
    prevEnd = unit[unit.length - 1].window.end;
  });

  const out = {};
  items.forEach(({ stage, key, window }) => {
    if (Array.isArray(template[stage])) {
      (out[stage] = out[stage] || [])[key] = window;
    } else {
      (out[stage] = out[stage] || {})[key] = window;
    }
  });
  return out;
}

/* --------------------------------------------------------------------------
 * Premiação
 * ------------------------------------------------------------------------ */

/**
 * Valores oficiais de 2026 em dólares. A economia do jogo é comprimida (o
 * campeão da Copa do Brasil leva R$ 2,2 mi no jogo contra ~R$ 90 mi reais),
 * então tudo passa pelo mesmo fator: o campeão da Libertadores que vence todos
 * os jogos de grupo fecha em ~R$ 5,2 mi, pouco mais que o dobro da Copa do
 * Brasil — a mesma proporção da vida real.
 */
export const CONMEBOL_PRIZE_USD = Object.freeze({
  libertadores: Object.freeze({
    F1: 400_000,
    F2: 500_000,
    F3: 600_000,
    G: 1_000_000,
    groupWin: 340_000,
    R16: 1_250_000,
    QF: 1_700_000,
    SF: 2_300_000,
    runnerUp: 7_000_000,
    champion: 25_000_000,
  }),
  sudamericana: Object.freeze({
    FS: 225_000,
    FSAway: 250_000,
    G: 300_000,
    groupWin: 125_000,
    PO: 500_000,
    R16: 600_000,
    QF: 700_000,
    SF: 800_000,
    runnerUp: 2_500_000,
    champion: 10_000_000,
  }),
  recopa: Object.freeze({
    runnerUp: 850_000,
    champion: 1_850_000,
  }),
  intercontinental: Object.freeze({
    DA: 1_000_000,
    CH: 1_000_000,
    IF: 1_000_000,
    runnerUp: 2_000_000,
    champion: 5_000_000,
  }),
});

/** Reais do jogo por dólar de premiação. */
export const CONMEBOL_PRIZE_SCALE = 0.13;

export function conmebolPrize(competitionId, key) {
  const usd = CONMEBOL_PRIZE_USD[competitionId]?.[key] || 0;
  return Math.round((usd * CONMEBOL_PRIZE_SCALE) / 1000) * 1000;
}
