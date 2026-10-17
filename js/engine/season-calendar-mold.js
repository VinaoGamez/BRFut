/**
 * Molde anual inspirado no [Calendário CBF 2026 — Masculino Profissional](https://stcbfsiteprdimgbrs.blob.core.windows.net/img-site/cdn/Calendario_do_Futebol_do_Brasil_2026_Masculino_Profissional_51fb742efc.pdf).
 *
 * Não replica 100% as datas — define códigos, janelas, slots semanais e bloqueios
 * para encaixar competições em paralelo (grade Seg–Dom × Jan–Dez).
 *
 * Novas competições: registrar em FUTURE_COMPETITION_MOLD + COMPETITION_WEEK_SLOT_MAP.
 */

import { FEATURES } from '../core/constants.js';
import {
  WORLD_CUP_CLUB_RELEASE_LEAD_DAYS,
  effectiveLeagueWindow,
  internationalWindowsForYear,
  isWorldCupYear as isInternationalWorldCupYear,
  worldCupWindow,
} from './international-calendar.js';

/** Ano-âncora da Copa do Mundo (ciclo FIFA quadrienal). */
export const WORLD_CUP_ANCHOR_YEAR = 2026;

// Delegado para o modelo internacional, que é a única fonte da verdade do ciclo.
export function isWorldCupYear(seasonYear) {
  const y = Number(seasonYear) || WORLD_CUP_ANCHOR_YEAR;
  return isInternationalWorldCupYear(y);
}

/** Ano de copa com CMU ligada no build (FEATURES.worldCup). */
export function isWorldCupSeasonActive(seasonYear) {
  return FEATURES.worldCup === true && isWorldCupYear(seasonYear);
}

/**
 * Janelas FIFA de um ano, no formato antigo (id + start + end).
 *
 * @deprecated Use `internationalWindowsForYear(seasonYear)`: as datas dependem do
 * ano e o calendário da FIFA muda. Estas quatro eram fixas e aplicadas a todas
 * as temporadas.
 */
export function fifaFriendlyWindows(seasonYear = WORLD_CUP_ANCHOR_YEAR) {
  return internationalWindowsForYear(seasonYear)
    .map(window => Object.freeze({
      id: window.id,
      start: Object.freeze([...window.start]),
      end: Object.freeze([...window.end]),
    }));
}

/**
 * Janela da Copa de 2026.
 *
 * @deprecated Use `worldCupWindow(seasonYear)`. Isto fixa 2026 e é o que fazia a
 * Copa de 2030 rodar com as datas de 2026.
 */
export const WORLD_CUP_WINDOW = Object.freeze({
  id: 'world_cup',
  start: Object.freeze([5, 11]),
  end: Object.freeze([6, 19]),
});

/** Datas salvas — Recopa Nacional (SCB): jogo único pós-estadual. */
export const RECOPA_NATIONAL_CALENDAR_SLOTS = Object.freeze([
  Object.freeze({ month: 1, day: 8, leg: 'FINAL' }),
]);

/** Datas salvas — Recopa Sul-Americana (REC): ida + volta. */
export const RECOPA_SUDAMERICANA_CALENDAR_SLOTS = Object.freeze([
  Object.freeze({ month: 1, day: 5, leg: 'IDA' }),
  Object.freeze({ month: 1, day: 19, leg: 'VOLTA' }),
]);

/** Bloqueios globais base (FIFA, recesso, janelas). Use `getSeasonBlackouts(year)` para WC. */
export const SEASON_BLACKOUTS = Object.freeze([
  {
    id: 'serie_a_inter',
    code: 'INF',
    label: 'Intertemporada Série A (20 dias)',
    start: [5, 23],
    end: [6, 11],
    divisions: ['A'],
    soft: true,
  },
  {
    id: 'serie_a_recess',
    code: 'INF',
    label: 'Recesso Série A (30 dias)',
    start: [6, 12],
    end: [7, 10],
    divisions: ['A'],
    soft: true,
  },
  {
    id: 'transfer_window_1',
    code: 'ESC',
    label: 'Janela de registros (1)',
    start: [0, 5],
    end: [2, 3],
    soft: true,
  },
  {
    id: 'transfer_window_2',
    code: 'ESC',
    label: 'Janela de registros (2)',
    start: [6, 20],
    end: [8, 11],
    soft: true,
  },
]);

/** Blackouts efetivos do ano (inclui Mundial travado em anos de copa). */
/**
 * As janelas FIFA param o calendário de clubes.
 *
 * A FIFA exige a liberação dos jogadores nesses periods, então não é uma
 * preferência macia: a liga não joga dentro da janela. Antes estas janelas eram
 * quatro datas fixas aplicadas a qualquer ano, e vinham com `soft: true`, o que
 * fazia o agendador simplesmente ignorá-las.
 */
export const INTERNATIONAL_WINDOWS_BLOCK_CLUBS = true;

/**
 * Janelas FIFA de um ano, no formato de blackout.
 *
 * Vêm do calendário oficial da FIFA, que muda de ano para ano. A janela de
 * setembro e outubro é um bloco único de 18 dias — dois periods de 9 dias
 * encostados, não uma janela longa qualquer.
 */
export function internationalWindowBlackouts(seasonYear) {
  return internationalWindowsForYear(seasonYear).map(window => ({
    id: window.id,
    code: 'FIF',
    label: `Janela FIFA (${window.label.toLowerCase()})`,
    start: [...window.start],
    end: [...window.end],
    blocksClubs: INTERNATIONAL_WINDOWS_BLOCK_CLUBS,
    hard: INTERNATIONAL_WINDOWS_BLOCK_CLUBS,
    soft: !INTERNATIONAL_WINDOWS_BLOCK_CLUBS,
    cadence: 'annual',
  }));
}

export function getSeasonBlackouts(seasonYear) {
  const year = Number(seasonYear) || WORLD_CUP_ANCHOR_YEAR;
  const list = [...SEASON_BLACKOUTS, ...internationalWindowBlackouts(year)];
  if (isWorldCupYear(year)) {
    // Blackout da Copa vai da liberação dos jogadores ao fim do torneio — 17
    // dias antes do jogo inicial, que é quando o clube perde o elenco. Não só
    // do primeiro jogo ao último.
    const copa = worldCupWindow(year);
    const liberacao = subtractMoldDays(copa.start, WORLD_CUP_CLUB_RELEASE_LEAD_DAYS);
    list.push({
      id: 'world_cup',
      code: 'CMU',
      label: `Copa do Mundo de Seleções ${copa.exact ? '' : '(datas aproximadas)'} (clubes parados)`,
      start: liberacao,
      end: [...copa.end],
      blocksClubs: true,
      locked: true,
      hard: true,
      cadence: 'quadrennial',
      anchorYear: year,
      exact: copa.exact,
      hosts: [...copa.hosts],
      soft: false,
    });
  }
  return list;
}

/** Subtrai dias de um ponto [mês, dia]. Meses em base 0. */
function subtractMoldDays([month, day], count) {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let m = month;
  let d = day - count;
  while (d < 1) {
    m -= 1;
    if (m < 0) return [0, 1];
    d += lengths[m];
  }
  return [m, d];
}

/**
 * Janela efetiva de uma divisão naquele ano.
 *
 * A janela do mold é a base. Em ano de Copa, uma divisão que não chega a
 * dezembro precisa que o fim estenda pelos dias de paragem, senão as últimas
 * rodadas caem dentro do torneio.
 */
export function leagueDivisionWindow(division, seasonYear = WORLD_CUP_ANCHOR_YEAR) {
  const base = LEAGUE_DIVISION_MOLD[division];
  if (!base) return null;
  const efetiva = effectiveLeagueWindow({ start: base.start, end: base.end }, seasonYear);
  return {
    ...base,
    baseStart: base.start,
    baseEnd: base.end,
    start: efetiva.start,
    end: efetiva.end,
    extended: efetiva.extended,
    extraDays: efetiva.extraDays,
  };
}

/**
 * Divisões nacionais — códigos CBF (BSA/BSB/BSC/BSD) + janela + slot semanal.
 */
export const LEAGUE_DIVISION_MOLD = Object.freeze({
  A: Object.freeze({
    code: 'BSA',
    competitionId: 'league_a',
    label: 'Brasileiro Série A',
    start: [0, 28],
    end: [11, 6],
    matchCount: 38,
    weekSlot: 'weekend',
    priority: 2,
    enabled: true,
  }),
  B: Object.freeze({
    code: 'BSB',
    competitionId: 'league_b',
    label: 'Brasileiro Série B',
    // Antes 14/fev a 28/out. Com as janelas FIFA reais, a Copa valendo 17 dias
    // antes do jogo inicial e a Copa do Brasil disputando o mesmo calendário,
    // 38 rodadas não cabiam nesse intervalo.
    start: [1, 25],
    end: [11, 20],
    matchCount: 38,
    weekSlot: 'weekend_b',
    priority: 2,
    enabled: true,
  }),
  C: Object.freeze({
    code: 'BSC',
    competitionId: 'league_c',
    label: 'Brasileiro Série C',
    // Antes 5/abr a 25/out. A Série C termina a temporada em 27 rodadas (35
    // quando chega a 28 clubes, em 2028), e precisa caber com o resto do
    // calendário. `matchCount` fica nulo de propósito: o total depende do
    // tamanho da divisão naquele ano.
    start: [3, 5],
    end: [11, 20],
    matchCount: null,
    weekSlot: 'weekend_b',
    priority: 2,
    enabled: true,
  }),
  D: Object.freeze({
    code: 'BSD',
    competitionId: 'league_d',
    label: 'Brasileiro Série D',
    start: [3, 5],
    end: [8, 13],
    matchCount: 10,
    weekSlot: 'weekend_b',
    priority: 2,
    enabled: true,
  }),
});

/**
 * Slots futuros — programados, sem materialização in-game ainda (`enabled: false`).
 * Ordem sugerida na temporada: estadual → recopas → nacional/copa → CONMEBOL → FIFA.
 */
export const FUTURE_COMPETITION_MOLD = Object.freeze({
  /** Campeonatos Estaduais (CBF: 11/jan – 8/mar, ~11 datas). */
  state_league: Object.freeze({
    code: 'EST',
    competitionId: 'state_league',
    label: 'Campeonatos Estaduais',
    category: 'domestic',
    start: [0, 11],
    end: [2, 8],
    matchCount: 11,
    weekSlot: 'weekend_b',
    priority: 1,
    enabled: FEATURES.stateLeague,
  }),
  /** Recopa Nacional — campeão Brasileiro × campeão Copa do Brasil (jogo único). */
  recopa_national: Object.freeze({
    code: 'SCB',
    competitionId: 'recopa_national',
    label: 'Recopa Nacional (Brasileiro × Copa do Brasil)',
    category: 'domestic_supercup',
    start: [0, 25],
    end: [1, 15],
    matchCount: 1,
    calendarSlots: RECOPA_NATIONAL_CALENDAR_SLOTS,
    weekSlot: 'recopa_national',
    idaSlot: 'recopa_national',
    twoLegged: false,
    priority: 2,
    enabled: true,
  }),
  libertadores: Object.freeze({
    code: 'LIB',
    competitionId: 'libertadores',
    label: 'Copa Libertadores',
    category: 'continental',
    start: [1, 1],
    end: [10, 30],
    matchCount: 13,
    weekSlot: 'continental_conmebol',
    idaSlot: 'continental_conmebol',
    voltaSlot: 'continental_conmebol',
    twoLegged: true,
    priority: 3,
    enabled: false,
    skipsWhen: ['world_cup'], // clubes liberados em anos de copa — ajustável
  }),
  /** CONMEBOL Sudamericana (CBF: fev – out) — mesmo slot que Libertadores. */
  sudamericana: Object.freeze({
    code: 'CSU',
    competitionId: 'sudamericana',
    label: 'Copa Sul-Americana',
    category: 'continental',
    start: [1, 1],
    end: [10, 15],
    matchCount: 13,
    weekSlot: 'continental_conmebol',
    idaSlot: 'continental_conmebol',
    voltaSlot: 'continental_conmebol',
    twoLegged: true,
    priority: 3,
    enabled: false,
  }),
  /** Recopa Sul-Americana — campeão Libertadores × campeão Sul-Americana. */
  recopa_sudamericana: Object.freeze({
    code: 'REC',
    competitionId: 'recopa_sudamericana',
    label: 'Recopa Sul-Americana (Libertadores × Sul-Americana)',
    category: 'continental_supercup',
    start: [1, 1],
    end: [2, 28],
    matchCount: 2,
    calendarSlots: RECOPA_SUDAMERICANA_CALENDAR_SLOTS,
    weekSlot: 'continental_conmebol',
    idaSlot: 'continental_conmebol',
    voltaSlot: 'continental_conmebol',
    twoLegged: true,
    priority: 3,
    enabled: false,
  }),
  /** Copas regionais (Nordeste, Verde, etc.) — reserva de slot. */
  regional_cup: Object.freeze({
    code: 'REG',
    competitionId: 'regional_cup',
    label: 'Copas Regionais',
    category: 'domestic',
    start: [2, 1],
    end: [4, 31],
    matchCount: 10,
    weekSlot: 'midweek',
    priority: 1,
    enabled: false,
  }),
  /** Amistosos de seleção — reserva calendário (não gera jogos de clube). */
  fifa_friendlies: Object.freeze({
    code: 'FIF',
    competitionId: 'fifa_friendlies',
    label: 'Amistosos de Seleção (Datas FIFA)',
    category: 'international_break',
    windows: fifaFriendlyWindows(WORLD_CUP_ANCHOR_YEAR),
    matchCount: 0,
    weekSlot: null,
    blocksClubCalendar: true,
    priority: 0,
    enabled: false,
  }),
  /** Copa do Mundo — a cada 4 anos; bloqueia clubes em jun/jul. */
  world_cup: Object.freeze({
    code: 'CMU',
    competitionId: 'world_cup',
    label: 'Copa do Mundo de Seleções',
    category: 'international_tournament',
    cadence: 'quadrennial',
    anchorYear: WORLD_CUP_ANCHOR_YEAR,
    // Datas da edição de 2026. Para outros anos use `worldCupWindow(ano)`: este
    // molde é a âncora, não a resposta para todo o ciclo.
    start: [...worldCupWindow(WORLD_CUP_ANCHOR_YEAR).start],
    end: [...worldCupWindow(WORLD_CUP_ANCHOR_YEAR).end],
    matchCount: 0,
    weekSlot: null,
    blocksClubCalendar: true,
    priority: 0,
    enabled: false,
  }),
});

/** Faixas da Copa do Brasil — calibradas vs CBF 2026. */
export const CUP_CALENDAR_BANDS = Object.freeze({
  early: Object.freeze({ start: [1, 17], end: [2, 18] }),
  mid: Object.freeze({ start: [3, 21], end: [4, 14] }),
  knockout_16: Object.freeze({ start: [7, 1], end: [7, 31] }),
  knockout_8: Object.freeze({ start: [7, 20], end: [8, 16] }),
  // Ida no domingo e volta na quarta com 7 dias de intervalo: como 7 dias após um
  // domingo cai noutro domingo, a volta é sempre o +10. Então a última volta que
  // cabe antes da janela FIFA de novembro (9/nov em 2026) é quarta, 4/nov, vinda
  // da ida de 25/out. A banda antiga terminava em 11/nov, dentro da janela.
  semi: Object.freeze({ start: [9, 25], end: [10, 7] }),
  // Depois da janela FIFA de novembro (9–17) não sobrou nenhum domingo: o
  // Brasileirão joga em 22 e 29 de novembro e em todos os domingos de dezembro.
  // A final aceita quarta (`getCupLegWeekdays` devolve [dom, qua]), então sai na
  // quarta de 18 de novembro, fora da janela e fora do dia de rodada.
  final: Object.freeze({ start: [10, 18], end: [10, 25] }),
});

export const CUP_PHASE_MOLD = Object.freeze([
  Object.freeze({ index: 1, slots: 1, twoLegged: false, band: 'early', idaSlot: 'midweek' }),
  Object.freeze({ index: 2, slots: 1, twoLegged: false, band: 'early', idaSlot: 'midweek' }),
  Object.freeze({ index: 3, slots: 1, twoLegged: false, band: 'early', idaSlot: 'midweek' }),
  Object.freeze({ index: 4, slots: 1, twoLegged: false, band: 'early', idaSlot: 'midweek' }),
  Object.freeze({ index: 5, slots: 2, twoLegged: true, band: 'mid', idaSlot: 'midweek', voltaSlot: 'midweek' }),
  Object.freeze({ index: 6, slots: 2, twoLegged: true, band: 'knockout_16', idaSlot: 'knockout_ida', voltaSlot: 'midweek' }),
  Object.freeze({ index: 7, slots: 2, twoLegged: true, band: 'knockout_8', idaSlot: 'knockout_ida', voltaSlot: 'midweek' }),
  Object.freeze({ index: 8, slots: 2, twoLegged: true, band: 'semi', idaSlot: 'knockout_ida', voltaSlot: 'midweek' }),
  Object.freeze({ index: 9, slots: 1, twoLegged: false, band: 'final', idaSlot: 'knockout_ida' }),
]);

export const COMPETITION_CALENDAR_MOLD = Object.freeze({
  league: LEAGUE_DIVISION_MOLD,
  cup: Object.freeze({
    code: 'CBR',
    competitionId: 'cup',
    label: 'Copa do Brasil',
    start: [1, 17],
    end: [11, 6],
    phases: CUP_PHASE_MOLD,
    bands: CUP_CALENDAR_BANDS,
    weekSlot: 'midweek',
    enabled: true,
  }),
  serie_d_knockout: Object.freeze({
    code: 'BSD',
    competitionId: 'serie_d_knockout',
    label: 'Série D · mata-mata',
    start: [7, 15],
    end: [10, 31],
    matchCount: 12,
    weekSlot: 'midweek',
    enabled: true,
  }),
  future: FUTURE_COMPETITION_MOLD,
});

/** Lista planificada de competições futuras (para UI/engine). */
export function listFutureCompetitionMold({ seasonYear = null } = {}) {
  return Object.values(FUTURE_COMPETITION_MOLD).filter(spec => {
    if (spec.competitionId === 'world_cup' && seasonYear != null) {
      return isWorldCupYear(seasonYear);
    }
    return true;
  });
}

/** IDs de competição futura com slot semanal definido. */
export function futureCompetitionIds() {
  return Object.values(FUTURE_COMPETITION_MOLD).map(spec => spec.competitionId);
}

export function leagueWindowsFromMold(mold = LEAGUE_DIVISION_MOLD) {
  return Object.fromEntries(
    Object.entries(mold).map(([division, spec]) => [
      division,
      {
        start: [...spec.start],
        end: [...spec.end],
        priority: spec.priority ?? 2,
        matchCount: spec.matchCount ?? null,
        competitionId: spec.competitionId,
        weekSlot: spec.weekSlot,
        code: spec.code,
      },
    ]),
  );
}

export function leagueCompetitionId(division) {
  return LEAGUE_DIVISION_MOLD[division]?.competitionId || 'league';
}

export function cupPhaseLegSlot(phaseIndex, leg = 'IDA', phases = CUP_PHASE_MOLD) {
  const phase = phases.find(item => item.index === Number(phaseIndex));
  if (!phase) return 'midweek';
  if (leg === 'VOLTA' && phase.twoLegged) return phase.voltaSlot || phase.idaSlot || 'midweek';
  return phase.idaSlot || 'midweek';
}

/** Slot semanal de competição futura (ou ativa). */
export function competitionWeekSlot(competitionId) {
  const future = FUTURE_COMPETITION_MOLD[Object.keys(FUTURE_COMPETITION_MOLD)
    .find(key => FUTURE_COMPETITION_MOLD[key].competitionId === competitionId)];
  if (future?.weekSlot) return future.weekSlot;
  if (future?.idaSlot) return future.idaSlot;
  for (const spec of Object.values(LEAGUE_DIVISION_MOLD)) {
    if (spec.competitionId === competitionId) return spec.weekSlot;
  }
  if (competitionId === 'cup') return 'midweek';
  if (competitionId === 'serie_d_knockout') return 'midweek';
  return 'weekend';
}

export function describeCalendarMold(seasonYear = 2026) {
  const leagues = Object.entries(LEAGUE_DIVISION_MOLD).map(([div, spec]) => ({
    division: div,
    code: spec.code,
    slot: spec.weekSlot,
    start: spec.start,
    end: spec.end,
    enabled: spec.enabled,
  }));
  const cupPhases = CUP_PHASE_MOLD.map(phase => ({
    phase: phase.index,
    band: phase.band,
    ida: phase.idaSlot,
    volta: phase.voltaSlot || null,
  }));
  const future = listFutureCompetitionMold({ seasonYear }).map(spec => ({
    id: spec.competitionId,
    code: spec.code,
    label: spec.label,
    slot: spec.weekSlot || spec.idaSlot || null,
    enabled: spec.enabled,
    category: spec.category,
  }));
  return {
    seasonYear,
    worldCupYear: isWorldCupYear(seasonYear),
    leagues,
    cupPhases,
    future,
    blackouts: getSeasonBlackouts(seasonYear).length,
  };
}

/** Ordem de leitura das tags na grade mensal. */
export const CALENDAR_COMPETITION_TAG_ORDER = Object.freeze([
  'EST',
  'BSA',
  'BSB',
  'BSC',
  'BSD',
  'CBR',
  'SCB',
  'LIB',
  'CSU',
  'REC',
  'REG',
  'CMU',
  'FIF',
]);

const LEAGUE_CODE_BY_DIVISION = Object.freeze(
  Object.fromEntries(Object.entries(LEAGUE_DIVISION_MOLD).map(([division, spec]) => [division, spec.code])),
);

/**
 * Código CBF (BSA, CBR, …) para tag no calendário.
 * @param {object|null} game
 * @param {{ division?: string|null }} [opts]
 */
export function resolveFixtureCompetitionCode(game, { division = null } = {}) {
  if (!game) return null;
  const comp = String(game.competition || '');
  if (comp === 'ESTADUAL') return 'EST';
  if (comp === 'RECOPA NACIONAL') return 'SCB';
  if (comp === 'COPA DO BRASIL' || comp === 'COPA') return COMPETITION_CALENDAR_MOLD.cup.code;
  if (comp === 'COPA DO MUNDO') return 'CMU';
  if (comp === 'SÉRIE D ELIMINATÓRIAS' || (game.tieId && game.knockoutRound != null)) {
    return LEAGUE_CODE_BY_DIVISION.D || 'BSD';
  }
  if (comp.startsWith('LEAGUE:')) {
    const div = comp.split(':')[1];
    return LEAGUE_CODE_BY_DIVISION[div] || null;
  }
  const div = division || game.division || null;
  if (div && LEAGUE_CODE_BY_DIVISION[div]) return LEAGUE_CODE_BY_DIVISION[div];
  return null;
}

export function sortCalendarCompetitionCodes(codes) {
  const order = CALENDAR_COMPETITION_TAG_ORDER;
  return [...codes].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
  });
}

const CALENDAR_COMPETITION_LABEL_BY_CODE = (() => {
  const map = new Map();
  Object.values(LEAGUE_DIVISION_MOLD).forEach(spec => map.set(spec.code, spec.label));
  map.set(COMPETITION_CALENDAR_MOLD.cup.code, COMPETITION_CALENDAR_MOLD.cup.label);
  Object.values(FUTURE_COMPETITION_MOLD).forEach(spec => map.set(spec.code, spec.label));
  map.set('CMU', 'Copa do Mundo');
  map.set('FIF', 'Datas FIFA');
  return map;
})();

/** Nome legível do campeonato a partir do código da tag (BSA, CBR, …). */
export function calendarCompetitionLabel(code) {
  return CALENDAR_COMPETITION_LABEL_BY_CODE.get(code) || code || '';
}
