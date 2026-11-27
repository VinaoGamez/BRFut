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

export const CONMEBOL_COMPETITIONS = Object.freeze({
  libertadores: Object.freeze({ id: 'libertadores', key: LIBERTADORES, label: 'Copa Libertadores', short: 'Libertadores' }),
  sudamericana: Object.freeze({ id: 'sudamericana', key: SUDAMERICANA, label: 'Copa Sul-Americana', short: 'Sul-Americana' }),
});

export function conmebolCompetitionIdFromKey(key) {
  if (key === LIBERTADORES) return 'libertadores';
  if (key === SUDAMERICANA) return 'sudamericana';
  return null;
}

export function isConmebolGame(game) {
  return game?.competition === LIBERTADORES || game?.competition === SUDAMERICANA;
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
});

export const LIBERTADORES_STAGES = Object.freeze(['F1', 'F2', 'F3', 'G', 'R16', 'QF', 'SF', 'F']);
export const SUDAMERICANA_STAGES = Object.freeze(['FS', 'G', 'PO', 'R16', 'QF', 'SF', 'F']);

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
});

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
  const shiftOut = window => {
    let { start, end } = window;
    // Fase de grupos e mata-mata não podem cair em janela FIFA ou na Copa:
    // a CONMEBOL antecipa a semana. Até 6 tentativas, depois desiste.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const hit = blocked.find(b => start <= b.end && end >= b.start);
      if (!hit) break;
      const direction = start < hit.start ? -1 : (attempt < 3 ? -1 : 1);
      start = new Date(start.getTime() + direction * 7 * DAY_MS);
      end = new Date(end.getTime() + direction * 7 * DAY_MS);
    }
    return { start, end };
  };
  const out = {};
  Object.entries(template).forEach(([stage, spec]) => {
    if (Array.isArray(spec)) {
      let previousEnd = null;
      out[stage] = spec.map(entry => {
        let window = shiftOut(windowOf(year, entry));
        // Duas rodadas não podem cair na mesma semana depois do ajuste.
        if (previousEnd && window.start <= previousEnd) {
          window = { start: new Date(previousEnd.getTime() + 5 * DAY_MS), end: new Date(previousEnd.getTime() + 7 * DAY_MS) };
        }
        previousEnd = window.end;
        return window;
      });
      return;
    }
    const stageOut = {};
    if (spec.single) stageOut.single = shiftOut(windowOf(year, spec.single));
    if (spec.ida) stageOut.ida = shiftOut(windowOf(year, spec.ida));
    if (spec.volta) stageOut.volta = shiftOut(windowOf(year, spec.volta));
    out[stage] = stageOut;
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
});

/** Reais do jogo por dólar de premiação. */
export const CONMEBOL_PRIZE_SCALE = 0.13;

export function conmebolPrize(competitionId, key) {
  const usd = CONMEBOL_PRIZE_USD[competitionId]?.[key] || 0;
  return Math.round((usd * CONMEBOL_PRIZE_SCALE) / 1000) * 1000;
}
