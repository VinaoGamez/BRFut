/**
 * Calendário internacional — ciclo de 4 anos, Copas por edição e janelas FIFA.
 *
 * A Copa do Mundo acontece a cada quatro anos. Nos anos intermediários existe
 * campanha de classificatórias: as seleções se Gatheram nas janelas FIFA, mas o
 * custo para os clubes é bem menor que o da Copa, porque a maioria dos
 * jogadores não é liberada e a 분류atória não é disputada por todo mundo.
 *
 * Datas vindas do calendário oficial da FIFA:
 *   · Copa 2026 — 11/jun a 19/jul (Canadá, México, EUA). Último jogo de clube em
 *     24/mai, liberação em 25/mai, com exceção até 30/mai para os vices de
 *     competição continental. Resto + liberação + torneio = 56 dias.
 *   · Copa 2030 — 8/jun a 21/jul (Marrocos, Portugal, Espanha).
 *   · Janelas masculinas 2026–2030, incluindo a de setembro e outubro como um
 *     bloco único de 18 dias.
 *
 * Módulo puro: nenhuma data de `Date`, nenhum save, nenhum clube.
 */

/** Segunda e última edição com calendário publicado. */
export const LAST_KNOWN_WORLD_CUP_EDITION = 2030;

/** Ano da primeira edição com calendário publicado. */
export const FIRST_KNOWN_WORLD_CUP_EDITION = 2026;

/**
 * Dias de antecedência da liberação dos jogadores sobre o início da Copa.
 * Vem de 2026: início em 11/jun, liberação em 25/mai = 17 dias.
 */
export const WORLD_CUP_CLUB_RELEASE_LEAD_DAYS = 17;

/**
 * Dias a mais para quem joga a final de competição continental.
 * Vem de 2026: liberação normal em 25/mai, com exceção até 30/mai.
 */
export const WORLD_CUP_CONTINENTAL_FINALIST_EXTRA_DAYS = 5;

/**
 * Custo para o clube de uma janela internacional, em dias por jogador liberado.
 * A FIFA dá 4 dias de liberação por jogo oficial; como são 2 ou 3 jogos, o clube
 * fica sem ele entre 8 e 12 dias.
 */
export const INTERNATIONAL_RELEASE_DAYS = { single: 4, standard: 8, heavy: 12 };

/**
 * Janelas masculinas da FIFA, por ano. Meses em base 0, como no resto do
 * calendário do jogo (0 = janeiro).
 *
 * A FIFA consolidou setembro e outubro numa janela única de 18 dias — são dois
 * blocos de 9 dias encostados, não uma janela longa qualquer.
 */
export const INTERNATIONAL_WINDOWS = Object.freeze({
  2026: Object.freeze([
    Object.freeze({ id: '2026-11', start: Object.freeze([10, 9]), end: Object.freeze([10, 17]), label: 'Novembro' }),
  ]),
  2027: Object.freeze([
    Object.freeze({ id: '2027-03', start: Object.freeze([2, 22]), end: Object.freeze([2, 30]), label: 'Março' }),
    Object.freeze({ id: '2027-06', start: Object.freeze([5, 7]), end: Object.freeze([5, 15]), label: 'Junho' }),
    Object.freeze({ id: '2027-09', start: Object.freeze([8, 20]), end: Object.freeze([9, 5]), label: 'Setembro/Outubro' }),
    Object.freeze({ id: '2027-11', start: Object.freeze([10, 8]), end: Object.freeze([10, 16]), label: 'Novembro' }),
  ]),
  2028: Object.freeze([
    Object.freeze({ id: '2028-03', start: Object.freeze([2, 20]), end: Object.freeze([2, 28]), label: 'Março' }),
    Object.freeze({ id: '2028-05', start: Object.freeze([4, 29]), end: Object.freeze([5, 6]), label: 'Maio/Junho' }),
    Object.freeze({ id: '2028-09', start: Object.freeze([8, 18]), end: Object.freeze([9, 3]), label: 'Setembro/Outubro' }),
    Object.freeze({ id: '2028-11', start: Object.freeze([10, 13]), end: Object.freeze([10, 21]), label: 'Novembro' }),
  ]),
  2029: Object.freeze([
    Object.freeze({ id: '2029-03', start: Object.freeze([2, 19]), end: Object.freeze([2, 27]), label: 'Março' }),
    Object.freeze({ id: '2029-06', start: Object.freeze([5, 4]), end: Object.freeze([5, 12]), label: 'Junho' }),
    Object.freeze({ id: '2029-09', start: Object.freeze([8, 24]), end: Object.freeze([9, 9]), label: 'Setembro/Outubro' }),
    Object.freeze({ id: '2029-11', start: Object.freeze([10, 12]), end: Object.freeze([10, 20]), label: 'Novembro' }),
  ]),
  2030: Object.freeze([
    Object.freeze({ id: '2030-03', start: Object.freeze([2, 18]), end: Object.freeze([2, 26]), label: 'Março' }),
    Object.freeze({ id: '2030-06', start: Object.freeze([5, 3]), end: Object.freeze([5, 11]), label: 'Junho' }),
    Object.freeze({ id: '2030-09', start: Object.freeze([8, 23]), end: Object.freeze([9, 8]), label: 'Setembro/Outubro' }),
    Object.freeze({ id: '2030-11', start: Object.freeze([10, 11]), end: Object.freeze([10, 19]), label: 'Novembro' }),
  ]),
});

/**
 * Custo, em dias, que cada janela representa para um clube.
 * As janelas de março e novembro são as mais caras: a classificatória de
 * CONFEDERAÇÃO costuma nelas e quase todo elenco é liberado.
 */
export const INTERNATIONAL_WINDOW_COST = Object.freeze({
  '2026-11': INTERNATIONAL_RELEASE_DAYS.heavy,
  '2027-03': INTERNATIONAL_RELEASE_DAYS.heavy,
  '2027-06': INTERNATIONAL_RELEASE_DAYS.single,
  '2027-09': INTERNATIONAL_RELEASE_DAYS.standard,
  '2027-11': INTERNATIONAL_RELEASE_DAYS.heavy,
  '2028-03': INTERNATIONAL_RELEASE_DAYS.heavy,
  '2028-05': INTERNATIONAL_RELEASE_DAYS.single,
  '2028-09': INTERNATIONAL_RELEASE_DAYS.standard,
  '2028-11': INTERNATIONAL_RELEASE_DAYS.heavy,
  '2029-03': INTERNATIONAL_RELEASE_DAYS.heavy,
  '2029-06': INTERNATIONAL_RELEASE_DAYS.single,
  '2029-09': INTERNATIONAL_RELEASE_DAYS.standard,
  '2029-11': INTERNATIONAL_RELEASE_DAYS.heavy,
  '2030-03': INTERNATIONAL_RELEASE_DAYS.heavy,
  '2030-06': INTERNATIONAL_RELEASE_DAYS.single,
  '2030-09': INTERNATIONAL_RELEASE_DAYS.standard,
  '2030-11': INTERNATIONAL_RELEASE_DAYS.heavy,
});

/**
 * Edições da Copa com calendário publicado.
 *
 * `exact: false` numa edição indica data aproximada: a FIFA ainda não publicou
 * o calendário e o jogo herdou o padrão da última edição conhecida.
 */
export const WORLD_CUP_EDITIONS = Object.freeze({
  2026: Object.freeze({
    year: 2026,
    start: Object.freeze([5, 11]),
    end: Object.freeze([6, 19]),
    hosts: Object.freeze(['Canadá', 'México', 'Estados Unidos']),
    teams: 48,
    matches: 104,
    exact: true,
  }),
  2030: Object.freeze({
    year: 2030,
    start: Object.freeze([5, 8]),
    end: Object.freeze([6, 21]),
    hosts: Object.freeze(['Marrocos', 'Portugal', 'Espanha']),
    exact: true,
  }),
});

/** Anos de Copa conhecidos, em ordem. */
export const WORLD_CUP_YEARS = Object.freeze(Object.keys(WORLD_CUP_EDITIONS).map(Number).sort((a, b) => a - b));

/**
 * É ano de Copa do Mundo?
 *
 * A Copa é a cada quatro anos. Uma lista de edições não serve: 2034 não está em
 * `WORLD_CUP_EDITIONS` e mesmo assim é Copa. O que vale é a periodicidade, com
 * 2026 como referência do ciclo.
 */
export function isWorldCupYear(seasonYear) {
  const year = Number(seasonYear);
  const anchor = FIRST_KNOWN_WORLD_CUP_EDITION;
  if (!Number.isFinite(year) || year < anchor) return false;
  return (year - anchor) % 4 === 0;
}

/**
 * Edição da Copa de um ano, herdando a última conhecida quando não há
 * calendário publicado.
 *
 * 2034 herda o padrão de 2030 e vem marcada como aproximada. Tratar toda Copa
 * como se fosse 2026 era o que_existia antes: 2030 usava as datas de 2026.
 *
 * @param {number} seasonYear
 * @returns {{year: number, start: number[], end: number[], hosts: string[], exact: boolean}}
 */
export function worldCupWindow(seasonYear) {
  const year = Number(seasonYear);
  if (WORLD_CUP_EDITIONS[year]) return WORLD_CUP_EDITIONS[year];
  const ultima = WORLD_CUP_YEARS[WORLD_CUP_YEARS.length - 1];
  const base = WORLD_CUP_EDITIONS[ultima];
  return Object.freeze({
    year,
    start: base.start,
    end: base.end,
    hosts: base.hosts,
    exact: false,
  });
}

/** A Copa deste ano tem calendário publicado? */
export function worldCupDateIsExact(seasonYear) {
  return worldCupWindow(seasonYear).exact === true;
}

/**
 * Posição do ano dentro do ciclo de quatro anos.
 *
 * O ciclo tem quatro anos e não três: o ano da Copa mais os três de
 * classificação. Não existe ano neutro no meio.
 *
 * @returns {'world-cup'|'qualifying'}
 */
export function internationalCyclePhase(seasonYear) {
  return isWorldCupYear(seasonYear) ? 'world-cup' : 'qualifying';
}

/**
 * Ano da Copa que comanda o ciclo de um ano qualquer.
 * 2026 → 2026, 2027/2028/2029 → 2030, 2030 → 2030, 2031–2033 → 2034.
 */
export function cycleAnchorYear(seasonYear) {
  const year = Number(seasonYear);
  const anchor = FIRST_KNOWN_WORLD_CUP_EDITION;
  const safe = Number.isFinite(year) && year >= anchor ? year : anchor;
  const offset = (safe - anchor) % 4;
  return offset === 0 ? safe : safe + (4 - offset);
}

/**
 * Janelas internacionais de um ano.
 *
 * Em ano de Copa a janela de junho é substituída pelo torneio: a Copa é o
 * bloqueio grande, e somar a janela em cima contaria os mesmos dias duas vezes.
 *
 * @param {number} seasonYear
 * @returns {Array<object>}
 */
export function internationalWindowsForYear(seasonYear) {
  const year = Number(seasonYear);
  const janelas = [...(INTERNATIONAL_WINDOWS[year] || [])];
  if (isWorldCupYear(year)) return janelas.filter(window => !coversWorldCup(window, year));
  return janelas;
}

/** A janela cobre o período da Copa? Comparar por mês erraria em 2030. */
function coversWorldCup(window, seasonYear) {
  const copa = worldCupWindow(seasonYear);
  return toComparable(window.start) <= toComparable(copa.start)
    && toComparable(window.end) >= toComparable(copa.start);
}

/**
 * Paragens do calendário de clubes em um ano.
 *
 * Ano de Copa: uma paragem longa, da liberação dos jogadores até o fim do
 * torneio. Ano de classificação: as janelas FIFA, que custam dias, não semanas.
 *
 * @param {number} seasonYear
 * @returns {Array<{id: string, label: string, start: number[], end: number[], days: number, kind: string, cost: number}>}
 */
export function clubStoppages(seasonYear) {
  const year = Number(seasonYear);
  if (isWorldCupYear(year)) {
    const copa = worldCupWindow(year);
    const liberacao = subtractDays(copa.start, WORLD_CUP_CLUB_RELEASE_LEAD_DAYS);
    const dias = daysBetween(liberacao, copa.end) + 1;
    return [{
      id: `copa_${year}`,
      label: `Copa do Mundo ${year}`,
      start: liberacao,
      end: copa.end,
      days: dias,
      kind: 'world-cup',
      cost: dias,
    }];
  }
  return internationalWindowsForYear(year).map(window => {
    const dias = daysBetween(window.start, window.end) + 1;
    // O custo é a liberação por jogador, mas o clube não pode perder mais dias
    // do que a janela ocupa — de resto a liga joga normal.
    const bruto = INTERNATIONAL_WINDOW_COST[window.id] ?? INTERNATIONAL_RELEASE_DAYS.standard;
    return {
      id: window.id,
      label: `Janela FIFA · ${window.label}`,
      start: window.start,
      end: window.end,
      days: dias,
      kind: 'international-window',
      cost: Math.min(bruto, dias),
    };
  });
}

/** Total de dias perdidos por paragem, e a lista. */
export function stoppageSummary(seasonYear) {
  const paragens = clubStoppages(seasonYear);
  return {
    year: Number(seasonYear),
    phase: internationalCyclePhase(seasonYear),
    worldCup: isWorldCupYear(seasonYear),
    stoppages: paragens,
    totalDays: paragens.reduce((acc, p) => acc + p.days, 0),
    // Custo real para o clube: a Copa leva o temporada inteiro, a janela não.
    clubCostDays: paragens.reduce((acc, p) => acc + p.cost, 0),
  };
}

/**
 * Rodadas de liga que caem dentro das janelas internacionais.
 *
 * São as rodadas que a seleção consome. Num ano de classificação são poucas e
 * espaçadas; num ano de Copa já estão dentro da paragem grande e não contam duas
 * vezes.
 *
 * @param {number} seasonYear
 * @returns {Array<{window: string, start: number[], end: number[]}>}
 */
export function qualifyingMatchdays(seasonYear) {
  const year = Number(seasonYear);
  if (isWorldCupYear(year)) return [];
  return internationalWindowsForYear(year).map(window => ({
    window: window.id,
    start: window.start,
    end: window.end,
    cost: INTERNATIONAL_WINDOW_COST[window.id] ?? INTERNATIONAL_RELEASE_DAYS.standard,
  }));
}

/**
 * A partir de qual mês a divisão absorve a Copa sozinha.
 *
 * Quem chega a dezembro tem folga no fim do calendário e reorganiza as rodadas
 * em torno da Copa. Quem termina antes não: a Copa cai no meio da temporada e
 * as rodadas do fim precisam de calendário novo.
 */
export const WC_ABSORPTION_MONTH = 11;

/**
 * Janela efetiva de uma divisão: a que vale para aquele ano.
 *
 * Uma divisão que já chega a dezembro absorve a Copa sozinha. Uma que termina
 * antes precisa que o fim estenda pelos dias de paragem, senão as rodadas do
 * fim da temporada caem dentro da Copa.
 *
 * @param {{start: number[], end: number[]}} divisionWindow
 * @param {number} seasonYear
 * @returns {{start: number[], end: number[], extended: boolean, extraDays: number}}
 */
export function effectiveLeagueWindow(divisionWindow, seasonYear) {
  const year = Number(seasonYear);
  const semMudanca = { start: divisionWindow.start, end: divisionWindow.end, extended: false, extraDays: 0 };
  if (Number(divisionWindow.end?.[0]) >= WC_ABSORPTION_MONTH) return semMudanca;

  const paragens = clubStoppages(year).filter(paragem => overlaps(paragem, divisionWindow));
  if (!paragens.length) return semMudanca;

  const extraDays = paragens.reduce((acc, p) => acc + p.days, 0);
  if (extraDays <= 0) return semMudanca;
  return {
    start: divisionWindow.start,
    end: addDays(divisionWindow.end, extraDays),
    extended: true,
    extraDays,
  };
}

/** A paragem cai dentro da janela da divisão? */
function overlaps(paragem, janela) {
  return toComparable(paragem.start) <= toComparable(janela.end)
    && toComparable(paragem.end) >= toComparable(janela.start);
}

// ------------------------------------------------------------------ auxiliares

/** [mês, dia] → número ordenável (mês * 1000 + dia). Serve só para comparar. */
function toComparable([month, day]) {
  return Number(month) * 1000 + Number(day);
}

/** Dias entre dois pontos [mês, dia]. */
function daysBetween(from, to) {
  let acc = 0;
  let [month, day] = from;
  while (month < to[0] || (month === to[0] && day < to[1])) {
    day += 1;
    if (day > daysInMonth(month)) {
      day = 1;
      month += 1;
    }
    acc += 1;
  }
  return acc;
}

/** Soma dias a um ponto [mês, dia]. */
function addDays([month, day], count) {
  let m = month;
  let d = day + count;
  while (d > daysInMonth(m)) {
    d -= daysInMonth(m);
    m += 1;
  }
  return [m, d];
}

/** Subtrai dias de um ponto [mês, dia]. */
function subtractDays([month, day], count) {
  let m = month;
  let d = day - count;
  while (d < 1) {
    m -= 1;
    if (m < 0) return [0, 1];
    d += daysInMonth(m);
  }
  return [m, d];
}

/** Dias no mês. Fevereiro fixo em 28: o calendário do jogo não tem ano real. */
function daysInMonth(month) {
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(month)] || 30;
}

/** Descrição do ciclo para UI e depuração. */
export function describeInternationalCycle(seasonYear) {
  const year = Number(seasonYear);
  const summary = stoppageSummary(year);
  if (summary.worldCup) {
    const copa = worldCupWindow(year);
    const marca = copa.exact ? '' : ' (datas aproximadas)';
    return `Ano de Copa do Mundo ${year}${marca}: ${summary.totalDays} dias de paragem, Copa de ${copa.hosts.join(', ')}.`;
  }
  return `Ano de classificação para ${cycleAnchorYear(year)}: ${summary.stoppages.length} janelas FIFA, ${summary.clubCostDays} dias de custo para o clube.`;
}