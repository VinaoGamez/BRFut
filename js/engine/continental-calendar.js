/**
 * Calendário continental CONMEBOL — Libertadores e Sul-Americana.
 *
 * Regra central: **as vagas do Brasil saem do elite doméstico.** São 7 na
 * Libertadores e 6 na Sul-Americana, e todas vêm da Série A e da Série B.
 * Série C e Série D não têm vaga nenhuma — nunca tiveram. Em 2026 as 13 vagas
 * brasileiras foram todas de clubes da Série A.
 *
 * A competição está **desligada in-game** (`enabled: false`). O que existe aqui
 * são as datas reais, reservadas por clube, sem travar a temporada. É o mesmo
 * desenho da Copa do Brasil, que já mexe em 126 clubes sem bloquear ninguém:
 * data reservada é data do clube que joga continental, não um feriado geral.
 *
 * Datas de 2026 (CONMEBOL):
 *   Libertadores  3/fev a 28/nov · grupos 7/abr a 28/mai · oitavas 11 e 18/ago
 *                 · quartas 15 e 21/set · semis 21 e 28/out · final 28/nov
 *   Sul-Americana 3/mar a 21/nov · grupos 7/abr a 28/mai · repescagem 21 e
 *                 28/jul · oitavas 11 e 18/ago · quartas 15 e 21/set
 *                 · semis 20 e 21/out · final 21/nov
 *
 * Mês em base 0, como no resto do calendário do jogo.
 */

export const CONMEBOL_ENABLED = false;

/** Vagas do Brasil, e de qual divisão cada uma pode sair. */
export const CONMEBOL_BERTHS = Object.freeze({
  libertadores: Object.freeze({
    berths: 7,
    eligibleDivisions: Object.freeze(['A']),
    label: 'Libertadores',
  }),
  sudamericana: Object.freeze({
    berths: 6,
    eligibleDivisions: Object.freeze(['A', 'B']),
    label: 'Sul-Americana',
  }),
});

/**
 * Fases e datas. `ida` e `volta` quando a fase é em ida e volta; a final é jogo
 * único em mando neutro.
 *
 * `groupStage` traz as 6 rodadas de grupo, que as duas competições disputam nas
 * mesmas datas.
 */
const GROUP_STAGE_2026 = Object.freeze([
  Object.freeze({ phase: 'FASE DE GRUPOS', round: 1, start: [3, 7], end: [3, 9] }),
  Object.freeze({ phase: 'FASE DE GRUPOS', round: 2, start: [3, 14], end: [3, 16] }),
  Object.freeze({ phase: 'FASE DE GRUPOS', round: 3, start: [3, 28], end: [3, 30] }),
  Object.freeze({ phase: 'FASE DE GRUPOS', round: 4, start: [4, 5], end: [4, 7] }),
  Object.freeze({ phase: 'FASE DE GRUPOS', round: 5, start: [4, 19], end: [4, 21] }),
  Object.freeze({ phase: 'FASE DE GRUPOS', round: 6, start: [4, 26], end: [4, 28] }),
]);

export const CONMEBOL_EDITIONS = Object.freeze({
  2026: Object.freeze({
    year: 2026,
    libertadores: Object.freeze({
      id: 'libertadores',
      label: 'Copa Libertadores',
      start: [1, 3],
      end: [10, 28],
      teams: 47,
      matches: 152,
      groupStage: GROUP_STAGE_2026,
      knockout: Object.freeze([
        Object.freeze({ phase: 'PRECLASSIFICATÓRIA', ida: [1, 3], volta: [1, 10] }),
        Object.freeze({ phase: 'SEGUNDA FASE', ida: [1, 24] }),
        Object.freeze({ phase: 'TERCEIRA FASE', ida: [2, 10] }),
        Object.freeze({ phase: 'OITAVAS', ida: [7, 11], volta: [7, 18] }),
        Object.freeze({ phase: 'QUARTAS', ida: [8, 15], volta: [8, 21] }),
        Object.freeze({ phase: 'SEMI', ida: [9, 21], volta: [9, 28] }),
        Object.freeze({ phase: 'FINAL', jogoUnico: [10, 28] }),
      ]),
    }),
    sudamericana: Object.freeze({
      id: 'sudamericana',
      label: 'Copa Sul-Americana',
      start: [2, 3],
      end: [10, 21],
      teams: 56,
      matches: 154,
      groupStage: GROUP_STAGE_2026,
      knockout: Object.freeze([
        Object.freeze({ phase: 'FASE INICIAL', jogoUnico: [2, 3] }),
        Object.freeze({ phase: 'REPESCAGEM', ida: [6, 21], volta: [6, 28] }),
        Object.freeze({ phase: 'OITAVAS', ida: [7, 11], volta: [7, 18] }),
        Object.freeze({ phase: 'QUARTAS', ida: [8, 15], volta: [8, 21] }),
        Object.freeze({ phase: 'SEMI', ida: [9, 20], volta: [9, 21] }),
        Object.freeze({ phase: 'FINAL', jogoUnico: [10, 21] }),
      ]),
    }),
  }),
});

/** Anos com calendário publicado. */
export const CONMEBOL_YEARS = Object.freeze(Object.keys(CONMEBOL_EDITIONS).map(Number).sort((a, b) => a - b));

/** Competition IDs e a divisão que tem vaga em cada uma. */
export function eligibleDivisionsFor(competitionId) {
  const conf = CONMEBOL_BERTHS[String(competitionId || '').toLowerCase()];
  return conf ? [...conf.eligibleDivisions] : [];
}

/** Quantas vagas o Brasil tem na competição. */
export function berthCountFor(competitionId) {
  const conf = CONMEBOL_BERTHS[String(competitionId || '').toLowerCase()];
  return conf ? conf.berths : 0;
}

/** Essa divisão tem vaga na competição? */
export function divisionHasBerth(division, competitionId) {
  return eligibleDivisionsFor(competitionId).includes(String(division || '').toUpperCase());
}

/**
 * Todas as datas de uma competição, achatadas, no formato do agendador.
 *
 * @param {string} competitionId `libertadores` | `sudamericana`
 * @param {number} seasonYear
 * @returns {Array<{slot: number, phase: string, leg: string, month: number, day: number}>}
 */
export function continentalSlots(competitionId, seasonYear) {
  const edition = CONMEBOL_EDITIONS[Number(seasonYear)];
  if (!edition) return [];
  const conf = edition[String(competitionId || '').toLowerCase()];
  if (!conf) return [];

  const slots = [];
  const push = (phase, leg, [month, day]) => {
    slots.push({ slot: slots.length + 1, phase, leg, month, day });
  };

  conf.knockout.forEach(fase => {
    if (fase.jogoUnico) push(fase.phase, 'JOGO ÚNICO', fase.jogoUnico);
    else if (fase.ida) {
      push(fase.phase, 'IDA', fase.ida);
      if (fase.volta) push(fase.phase, 'VOLTA', fase.volta);
    }
  });
  conf.groupStage.forEach(rodada => {
    push(rodada.phase, `MD${rodada.round}`, rodada.start);
  });
  return slots;
}

/** Datas de uma competição, ordenadas. */
export function continentalDates(competitionId, seasonYear) {
  return continentalSlots(competitionId, seasonYear)
    .slice()
    .sort((a, b) => (a.month - b.month) || (a.day - b.day));
}

/**
 * Vagas de um clube, a partir do que a divisão dele entregou.
 *
 * @param {object} params
 * @param {string[]} params.standingsA clubes da Série A na ordem
 * @param {string[]} params.standingsB clubes da Série B na ordem
 * @param {string|null} params.cupChampion campeão da Copa do Brasil
 * @returns {Array<{club: string, competitionId: string, division: string, berth: number, via: string}>}
 */
export function allocateBrazilBerths({ standingsA = [], standingsB = [], cupChampion = null } = {}) {
  const berths = [];
  const escolhidos = new Set();
  const porCompeticao = {};
  // Cada competição tem o seu teto: 7 e 6. Encher até 13 no total dava vaga a
  // mais quando uma competição vinha curta.
  const add = (club, competitionId, division, via) => {
    if (!club || escolhidos.has(club)) return false;
    const usados = porCompeticao[competitionId] || 0;
    if (usados >= berthCountFor(competitionId)) return false;
    porCompeticao[competitionId] = usados + 1;
    escolhidos.add(club);
    berths.push({ club, competitionId, division, berth: usados + 1, via });
    return true;
  };

  // Libertadores: vaga 1 é o campeão da Copa do Brasil e as 6 seguintes são os
  // seis primeiros da Série A. São 7 no total — e o campeão da copa pode já
  // estar entre eles, daí a deduplicação.
  if (cupChampion) {
    add(cupChampion, 'libertadores', 'A', 'Campeão da Copa do Brasil');
  }
  // Sete vagas. Se o campeão da copa já está entre os primeiros da Série A, o
  // sétimo lugar entra no lugar dele — senão a Libertadores fechava com 6.
  standingsA.slice(0, 7).forEach(club => add(club, 'libertadores', 'A', 'Série A'));

  // Sul-Americana: 6 vagas para quem ficou fora da Libertadores, na ordem da
  // Série A. Sobrando vaga, pega da Série B.
  standingsA.forEach(club => add(club, 'sudamericana', 'A', 'Série A, fora da Libertadores'));
  standingsB.forEach(club => add(club, 'sudamericana', 'B', 'Série B'));
  return berths;
}

/**
 * Reserva as datas de um clube continental.
 *
 * Reserva é por clube: ninguém perde rodada por isso. É o que permite a
 * competição existir no calendário sem travar a temporada — o mesmo mecanismo da
 * Copa do Brasil, que mexe em 126 clubes incluindo Série C e D.
 *
 * @param {object} params
 * @param {string} params.club
 * @param {string} params.competitionId
 * @param {number} params.seasonYear
 * @returns {{club: string, competitionId: string, reservations: Array<object>}}
 */
export function reserveContinentalDates({ club, competitionId, seasonYear }) {
  const slots = continentalSlots(competitionId, seasonYear);
  return {
    club,
    competitionId: String(competitionId || '').toLowerCase(),
    enabled: CONMEBOL_ENABLED,
    reservations: slots.map(slot => ({ ...slot, club })),
  };
}

/**
 * Quantos clubes de cada divisão carregam continental num ano.
 *
 * Serve como travão: se alguém reintroduzir Série C/D na lista de elegíveis, a
 * contagem denuncia na hora.
 */
export function berthAudit(berths) {
  const porDivisao = { A: 0, B: 0, C: 0, D: 0 };
  (berths || []).forEach(b => {
    const d = String(b.division || '').toUpperCase();
    if (porDivisao[d] != null) porDivisao[d] += 1;
  });
  return {
    total: (berths || []).length,
    porDivisao,
    serieC: porDivisao.C,
    serieD: porDivisao.D,
    ok: porDivisao.C === 0 && porDivisao.D === 0,
  };
}

/** Resumo para UI e depuração. */
export function describeContinental(seasonYear) {
  const edition = CONMEBOL_EDITIONS[Number(seasonYear)];
  if (!edition) return `CONMEBOL ${seasonYear}: calendário não publicado.`;
  const linhas = [`CONMEBOL ${seasonYear}:`];
  for (const id of ['libertadores', 'sudamericana']) {
    const conf = edition[id];
    const berths = CONMEBOL_BERTHS[id];
    linhas.push(
      `  ${conf.label}: ${days(conf.start)} a ${days(conf.end)} · ${berths.berths} vagas do Brasil (${berths.eligibleDivisions.join('/')})`,
    );
  }
  return linhas.join('\n');
}

function days([month, day]) {
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${day} ${meses[month] || '?'}`;
}