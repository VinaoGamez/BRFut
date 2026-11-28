/**
 * Eliminatórias da CONMEBOL na página de campeonatos: tabela única de 10
 * seleções e os jogos rodada a rodada.
 */

import { qualifierSlots, qualifierTable, qualifierTeamName } from '../../engine/conmebol-qualifiers.js';

export const QUALIFIERS_PAGE_ID = 'ELIMINATORIAS';

const TOTAL_MATCHDAYS = 18;
const dateLabel = iso => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Rodada a mostrar ao abrir: a próxima a jogar, ou a última. */
export function qualifiersCurrentMatchday(qualifiers) {
  const pending = (qualifiers?.fixtures || []).find(game => !game.completed);
  return pending ? pending.matchday : TOTAL_MATCHDAYS;
}

export function qualifiersHeader(qualifiers, matchday) {
  if (!qualifiers) {
    return { subText: 'ELIMINATÓRIAS', titleText: 'SEM ELIMINATÓRIAS NESTE ANO', canPrev: false, canNext: false, matchday: 1 };
  }
  const md = Math.max(1, Math.min(TOTAL_MATCHDAYS, Number(matchday) || 1));
  return {
    subText: `ELIMINATÓRIAS · COPA ${qualifiers.cycleYear}${qualifiers.complete ? ' · ENCERRADAS' : ''}`,
    titleText: `${md}ª RODADA`,
    canPrev: md > 1,
    canNext: md < TOTAL_MATCHDAYS,
    matchday: md,
  };
}

export function qualifiersBody({ qualifiers, matchday, highlightCode = 'BRA', escapeHtml = s => String(s) }) {
  if (!qualifiers) {
    return {
      head: '',
      html: '<div class="championship-page-empty">As Eliminatórias andam nos três anos entre uma Copa do Mundo e outra. Neste ano a seleção está na Copa.</div>',
    };
  }
  const { hosts, direct, playoff } = qualifierSlots(qualifiers.cycleYear);
  const table = qualifierTable(qualifiers);
  const started = qualifiers.fixtures.some(game => game.completed);
  let rank = 0;
  const rowsHtml = table.map((row, index) => {
    const host = hosts.includes(row.code);
    if (!host) rank += 1;
    const zone = host ? 'promotion' : !started ? '' : rank <= direct ? 'promotion' : playoff && rank === direct + 1 ? 'playoff' : '';
    const hostTag = host ? ' <small class="conmebol-country">sede</small>' : '';
    return `<div class="league-row ${zone} ${row.code === highlightCode ? 'highlight' : ''}"><span>${index + 1}</span><span class="club-link">${escapeHtml(row.name)}${hostTag}</span><span>${row.played}</span><span>${row.won}</span><span>${row.drawn}</span><span>${row.lost}</span><span>${row.goalDiff >= 0 ? '+' : ''}${row.goalDiff}</span><span>${row.points}</span></div>`;
  }).join('');
  const legend = hosts.length
    ? `<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>Sedes e ${direct} primeiros · Copa ${qualifiers.cycleYear}</span><span><i class="playoff" aria-hidden="true"></i>${direct + 1}º · Repescagem</span></div>`
    : `<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>1º ao ${direct}º · Copa ${qualifiers.cycleYear}</span><span><i class="playoff" aria-hidden="true"></i>${direct + 1}º · Repescagem</span></div>`;
  const finalNote = qualifiers.complete
    ? `<div class="conmebol-final-note">Classificados: <strong>${qualifiers.qualified.map(code => escapeHtml(qualifierTeamName(code))).join(', ')}</strong>${qualifiers.playoff ? ` · ${escapeHtml(qualifierTeamName(qualifiers.playoff.team))} ${qualifiers.playoff.won ? 'venceu' : 'perdeu'} a repescagem` : ''}</div>`
    : '';
  const games = qualifiers.fixtures.filter(game => game.matchday === matchday);
  const gamesHtml = games.map(game => {
    const score = game.completed ? `${game.homeGoals} × ${game.awayGoals}` : '×';
    const mine = game.home === highlightCode || game.away === highlightCode;
    return `<div class="conmebol-tie${mine ? ' highlight' : ''}"><span>${escapeHtml(game.homeName)} <strong>${score}</strong> ${escapeHtml(game.awayName)}</span><small>${dateLabel(game.date)}</small></div>`;
  }).join('');
  return {
    head: '<span>#</span><span>SELEÇÃO</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>',
    html: `<div class="championship-page-league-body"><div class="championship-page-standings-block">${rowsHtml}${legend}</div>${finalNote}<section class="conmebol-ties">${gamesHtml}</section></div>`,
  };
}
