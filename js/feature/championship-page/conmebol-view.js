/**
 * Página de Campeonatos — Libertadores e Sul-Americana.
 *
 * Navegação em "passos": preliminares → grupo A … grupo H → playoffs →
 * oitavas → quartas → semi → final. Só aparecem as fases já sorteadas.
 */

import { conmebolGroupTable } from '../../engine/conmebol-competition.js';
import { STAGE_LABELS } from '../../engine/conmebol-format.js';
import { conmebolClubMeta } from '../../engine/conmebol-clubs.js';

export const CONMEBOL_PAGE_IDS = Object.freeze({ LIBERTADORES: 'libertadores', SUDAMERICANA: 'sudamericana', MUNDIAL: 'mundial' });

const STAGE_ORDER = Object.freeze({
  libertadores: ['F1', 'F2', 'F3', 'G', 'R16', 'QF', 'SF', 'F'],
  sudamericana: ['FS', 'G', 'PO', 'R16', 'QF', 'SF', 'F'],
  mundial: ['G', 'R16', 'QF', 'SF', 'F'],
});

const LABEL = Object.freeze({
  libertadores: 'COPA LIBERTADORES',
  sudamericana: 'COPA SUL-AMERICANA',
  recopa: 'RECOPA SUL-AMERICANA',
  intercontinental: 'COPA INTERCONTINENTAL',
  mundial: 'MUNDIAL DE CLUBES DA FIFA',
});

/** A página da Libertadores abre com a Recopa e fecha com o Intercontinental. */
const EXTRA_STEPS = Object.freeze({
  libertadores: { before: [['recopa', 'F']], after: [['intercontinental', 'DA'], ['intercontinental', 'CH'], ['intercontinental', 'IF']] },
});

export function isConmebolPage(pageCompetition) {
  return !!CONMEBOL_PAGE_IDS[pageCompetition];
}

/** Passos navegáveis da competição. */
export function conmebolSteps(edition, competitionId) {
  const comp = edition?.[competitionId];
  if (!comp) return [];
  const steps = [];
  const extra = EXTRA_STEPS[competitionId] || { before: [], after: [] };
  const pushExtra = list => list.forEach(([comp, stage]) => {
    if (edition?.[comp]?.stages?.[stage]) steps.push({ stage, comp });
  });
  pushExtra(extra.before);
  STAGE_ORDER[competitionId].forEach(stage => {
    const record = comp.stages?.[stage];
    if (!record) return;
    if (stage === 'G') Object.keys(record.groups || {}).sort().forEach(group => steps.push({ stage, group, comp: competitionId }));
    else steps.push({ stage, comp: competitionId });
  });
  pushExtra(extra.after);
  return steps;
}

/** Passo onde está o clube do usuário (jogo pendente ou última fase). */
export function conmebolUserStep(edition, competitionId, userClub) {
  const steps = conmebolSteps(edition, competitionId);
  if (!steps.length) return 0;
  const comps = new Set(steps.map(step => step.comp));
  const games = (edition.fixtures || []).filter(game => comps.has(game.competitionId) && (game.home === userClub || game.away === userClub));
  const target = games.find(game => !game.completed) || games[games.length - 1];
  if (!target) {
    // Sem o usuário: mostra a fase mais avançada.
    return steps.length - 1;
  }
  const index = steps.findIndex(step => step.comp === target.competitionId && step.stage === target.stage && (!step.group || step.group === target.group));
  return index >= 0 ? index : steps.length - 1;
}

export function conmebolHeader(edition, competitionId, stepIndex) {
  const steps = conmebolSteps(edition, competitionId);
  const comp = edition?.[competitionId];
  if (!steps.length) {
    return {
      subText: LABEL[competitionId],
      titleText: comp ? 'AGUARDANDO SORTEIO' : 'FORA DA TEMPORADA',
      canPrev: false,
      canNext: false,
      step: 0,
    };
  }
  const step = Math.max(0, Math.min(steps.length - 1, Number(stepIndex) || 0));
  const current = steps[step];
  if (current.comp !== competitionId) {
    const other = edition[current.comp];
    return {
      subText: `${LABEL[current.comp]}${other?.champion ? ' · ENCERRADA' : ''}`,
      titleText: (current.comp === 'recopa' ? 'FINAL · IDA E VOLTA' : STAGE_LABELS[current.stage]).toUpperCase(),
      canPrev: step > 0,
      canNext: step < steps.length - 1,
      step,
    };
  }
  const status = comp.champion
    ? 'ENCERRADA'
    : current.stage === 'G'
      ? 'FASE DE GRUPOS'
      : ['F1', 'F2', 'F3', 'FS'].includes(current.stage)
        ? 'FASES PRELIMINARES'
        : 'MATA-MATA';
  return {
    subText: `${LABEL[competitionId]} · ${status}`,
    titleText: current.stage === 'G' ? `GRUPO ${current.group}` : STAGE_LABELS[current.stage].toUpperCase(),
    canPrev: step > 0,
    canNext: step < steps.length - 1,
    step,
  };
}

function clubCell(name, escapeHtml) {
  const meta = conmebolClubMeta(name);
  const country = meta ? `<small class="conmebol-country">${meta.countryName}</small>` : '<small class="conmebol-country">Brasil</small>';
  return `<span class="club-link">${escapeHtml(name)} ${country}</span>`;
}

function tieSummary(edition, tie, userClub, escapeHtml) {
  const games = (tie.games || []).map(id => edition.fixtures.find(game => game.id === id)).filter(Boolean);
  if (!games.length) return '';
  const goals = club => games.reduce((sum, game) => sum + (game.home === club ? Number(game.homeGoals) || 0 : game.away === club ? Number(game.awayGoals) || 0 : 0), 0);
  const played = games.filter(game => game.completed).length;
  const decider = games[games.length - 1];
  const pens = decider?.shootoutWinner ? ` · pênaltis ${escapeHtml(decider.penalties || '')} para ${escapeHtml(decider.shootoutWinner)}` : '';
  const status = tie.winner
    ? `<strong>${escapeHtml(tie.winner)}</strong> avança${pens}`
    : played
      ? `${played} de ${games.length} jogo(s)`
      : 'A jogar';
  const isUser = tie.home === userClub || tie.away === userClub;
  const aggregate = games.length > 1 && played
    ? `${escapeHtml(tie.home)} ${goals(tie.home)} × ${goals(tie.away)} ${escapeHtml(tie.away)}`
    : `${escapeHtml(tie.home)} × ${escapeHtml(tie.away)}`;
  return `<div class="conmebol-tie${isUser ? ' highlight' : ''}"><span>${aggregate}</span><small>${games.length > 1 ? 'Agregado · ' : ''}${status}</small></div>`;
}

/**
 * Corpo da página para o passo atual.
 *
 * @param {object} params
 * @param {(games: object[], opts: object) => string} params.renderFixtures cartões de jogos da página
 */
export function conmebolBody({ edition, competitionId, stepIndex, userClub, renderFixtures, escapeHtml = s => String(s) }) {
  const steps = conmebolSteps(edition, competitionId);
  if (!steps.length) {
    const message = edition?.[competitionId]
      ? 'Os confrontos aparecem aqui assim que a CONMEBOL fizer o sorteio.'
      : 'A competição não está disponível nesta temporada.';
    return { head: '', html: `<div class="championship-page-empty">${message}</div>` };
  }
  const current = steps[Math.max(0, Math.min(steps.length - 1, Number(stepIndex) || 0))];
  const comp = edition[current.comp || competitionId];

  if (current.stage === 'G') {
    const rows = conmebolGroupTable(edition, competitionId, current.group);
    const advance = competitionId === 'sudamericana' ? 1 : 2;
    const rowsHtml = rows.map((row, index) => {
      const zone = index < advance ? 'promotion' : index === advance && competitionId !== 'mundial' ? 'playoff' : '';
      return `<div class="league-row ${zone} ${row.club === userClub ? 'highlight' : ''}" data-club="${escapeHtml(row.club)}" role="button" tabindex="0"><span>${index + 1}</span>${clubCell(row.club, escapeHtml)}<span>${row.played}</span><span>${row.won}</span><span>${row.drawn}</span><span>${row.lost}</span><span>${row.goalDiff >= 0 ? '+' : ''}${row.goalDiff}</span><span>${row.points}</span></div>`;
    }).join('');
    const legend = competitionId === 'mundial'
      ? '<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>1º e 2º · Oitavas de final</span></div>'
      : competitionId === 'libertadores'
      ? '<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>1º e 2º · Oitavas de final</span><span><i class="playoff" aria-hidden="true"></i>3º · Playoffs da Sul-Americana</span></div>'
      : '<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>1º · Oitavas de final</span><span><i class="playoff" aria-hidden="true"></i>2º · Playoffs contra 3º da Libertadores</span></div>';
    const games = edition.fixtures
      .filter(game => game.competitionId === competitionId && game.stage === 'G' && game.group === current.group)
      .sort((a, b) => (a.matchday - b.matchday) || (new Date(a.date) - new Date(b.date)));
    const fixtures = renderFixtures(games, { completed: games.length > 0 && games.every(game => game.completed) });
    return {
      head: '<span>#</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>',
      html: `<div class="championship-page-league-body"><div class="championship-page-standings-block">${rowsHtml}${legend}</div>${fixtures}</div>`,
    };
  }

  const record = comp.stages[current.stage];
  const ties = record?.ties || [];
  const games = ties
    .flatMap(tie => tie.games.map(id => edition.fixtures.find(game => game.id === id)))
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date) || a.gameNumber - b.gameNumber);
  const summary = ties
    .slice()
    .sort((a, b) => Number(b.home === userClub || b.away === userClub) - Number(a.home === userClub || a.away === userClub))
    .map(tie => tieSummary(edition, tie, userClub, escapeHtml))
    .join('');
  const championNote = comp.champion ? ` · <strong>${escapeHtml(comp.champion)}</strong> campeão` : '';
  let final = '';
  if (current.comp === 'recopa') {
    final = `<div class="conmebol-final-note">Campeão da Libertadores × campeão da Sul-Americana do ano anterior${championNote}</div>`;
  } else if (current.comp === 'intercontinental') {
    const tie = record?.ties?.[0];
    const entrant = name => Object.values(comp.entrants || {}).flat().find(item => item.club === name)?.via;
    const vias = tie ? [tie.home, tie.away].map(name => `${escapeHtml(name)}${entrant(name) ? ` <small>(${escapeHtml(entrant(name))})</small>` : ''}`).join(' × ') : '';
    final = `<div class="conmebol-final-note">${vias}${comp.venue ? ` · jogo único em ${escapeHtml(comp.venue)}` : ''}${current.stage === 'IF' ? championNote : ''}</div>`;
  } else if (current.stage === 'F') {
    final = `<div class="conmebol-final-note">Final em jogo único${comp.finalVenue ? ` em ${escapeHtml(comp.finalVenue)}` : ''}${championNote}</div>`;
  }
  const fixtures = renderFixtures(games, {
    completed: games.length > 0 && games.every(game => game.completed),
    roundLabel: STAGE_LABELS[current.stage],
  });
  return {
    head: '',
    html: `<div class="conmebol-ko">${final}<section class="conmebol-ties">${summary}</section>${fixtures}</div>`,
  };
}
