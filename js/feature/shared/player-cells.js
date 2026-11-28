import { clamp } from '../../ui/dom.js';
import { eventIconHtml } from '../../core/event-icons.js';
import { playerDisplayName } from '../../engine/player-display-names.js';
import { resolvePlayerId } from '../../engine/player-identity.js';
import { isPenaltySavingSpecialist, isSetPieceSpecialist, setPieceSpecialistTitle, isCraque, isDestaque } from '../../engine/player-generation.js';

/** Campo vazio em tabelas de atributos. */
export const outfield = value => value || '—';

/** Barra de cansaço padrão para tabelas e listagens. */
export const fatigueCell = player => {
  const fatigue = Math.round(clamp(Number.isFinite(Number(player?.fatigue)) ? Number(player.fatigue) : 100, 0, 100));
  const level = fatigue >= 70 ? 'ok' : fatigue >= 40 ? 'warn' : 'low';
  return `<span class="table-fatigue roster-fatigue" data-level="${level}"><i><b style="width:${fatigue}%"></b></i><em>${fatigue}%</em></span>`;
};

/** Barra de cansaço do Elenco — percentual dentro da barra (sem texto externo). */
export const rosterFatigueCell = (player, { compact = false } = {}) => {
  const fatigue = Math.round(clamp(Number(player?.fatigue) ?? 100, 0, 100));
  const mod = compact ? ' roster-fatigue--compact' : '';
  const level = fatigue >= 70 ? 'ok' : fatigue >= 40 ? 'warn' : 'low';
  return `<span class="roster-fatigue${mod}" data-level="${level}"><i><b style="width:${fatigue}%"></b></i><em>${fatigue}%</em></span>`;
};

/** Linha do campo para a cor do chip de posição: gol, def, mei, ata. */
const POSITION_LINES = Object.freeze({
  GOL: 'gol', ZAG: 'def', LAT: 'def', LD: 'def', LE: 'def',
  VOL: 'mei', MC: 'mei', MEI: 'mei', ME: 'mei', MD: 'mei',
  PD: 'ata', PE: 'ata', ATA: 'ata', SA: 'ata', CA: 'ata',
});
export const positionLine = pos => POSITION_LINES[String(pos || '').toUpperCase()] || 'mei';

const hasMatchOverlay = liveState =>
  !!liveState &&
  !!(liveState.red || liveState.yellow || liveState.injured || liveState.playThroughRisk);

/**
 * Badges de status (suspensão, lesão, cartão ao vivo) para células de jogador.
 * Amarelos acumulados na temporada não são exibidos no Elenco — só suspensão quando aplicável.
 */
function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function formatInjuryReturnDate(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  return `${day} ${month}`;
}

function projectInjuryReturnDate(injury, careerDate, injuryInRestrictedPhase) {
  if (!injury || !careerDate) return null;
  const base = new Date(careerDate);
  base.setHours(12, 0, 0, 0);
  if (injuryInRestrictedPhase?.(injury)) {
    const rtp = injury.returnToPlay;
    const daysLeft = Math.max(0, (rtp?.daysUntilFullFitness ?? 0) - (rtp?.daysCompleted ?? 0));
    if (daysLeft <= 0) return null;
    const projected = new Date(base);
    projected.setDate(projected.getDate() + daysLeft);
    return projected;
  }
  const days = Number(injury.daysRemaining) || 0;
  if (days <= 0) return null;
  const projected = new Date(base);
  projected.setDate(projected.getDate() + days);
  return projected;
}

export function createPlayerCells({
  getPlayerRoster,
  injuryInAcutePhase,
  injuryInRestrictedPhase,
  injurySeverityLabel,
  injuryAvailabilityLabel,
  getCareerCalendarDate,
  YELLOW_SUSPENSION_LIMIT,
  getYellowAccumulation,
  activeSuspensions,
  disciplineBadgeCompetitionKeys,
  competitionLabel,
  userLeagueDisciplineKey,
  getFocusCompetitionKey,
}) {
  // 3 amarelos = suspensão; pip ativo máx. = 2 (contagem ainda usada em suspensão).

  const focusKey = () =>
    (typeof getFocusCompetitionKey === 'function' && getFocusCompetitionKey()) ||
    userLeagueDisciplineKey?.() ||
    'LEAGUE:A';

  // Selos de status com o conjunto único de ícones (js/core/event-icons.js).
  const statusIcon = (kind, extraClass, title) =>
    eventIconHtml(kind, { size: 16, className: `player-badge ${extraClass}`, label: title, attrs: `title="${escapeAttr(title)}"` });

  const playerStatusBadges = (player, liveState = null, options = {}) => {
    const { allCompetitions = false } = options;
    const parts = [];

    const discipline = player?.discipline || {};
    // Igual aos amarelos: no jogo/preparação só a competição em foco; elenco pode ver todas.
    const suspensions = allCompetitions
      ? activeSuspensions?.(discipline) || []
      : activeSuspensions?.(discipline, focusKey()) || [];
    if (suspensions.length) {
      const summary = suspensions
        .map(
          entry =>
            `${entry.gamesRemaining} jogo${entry.gamesRemaining === 1 ? '' : 's'} · ${competitionLabel?.(entry.competitionKey) || entry.competitionKey}`,
        )
        .join('; ');
      parts.push(statusIcon('suspended', 'player-badge-suspended', `Suspenso: ${summary}`));
    }

    const injury = player?.injury;
    if (injury && (injuryInAcutePhase(injury) || injuryInRestrictedPhase(injury))) {
      const grade = injury.grade ?? (injury.severity === 'Grave' ? 3 : injury.severity === 'Mediana' ? 2 : 1);
      const severity = injury.severity || injurySeverityLabel(grade);
      const tone = grade >= 3 ? 'severe' : grade === 2 ? 'moderate' : 'mild';
      const legend = buildInjuryLegend(injury);
      parts.push(statusIcon(tone === 'mild' ? 'knock' : 'injury', `player-badge-injury ${tone}`, legend || `Lesão ${severity}`));
    }

    if (hasMatchOverlay(liveState)) {
      if (liveState.red) {
        parts.push(statusIcon('red', 'player-badge-red', 'Vermelho nesta partida'));
      } else if (liveState.yellow) {
        const title = 'Amarelo nesta partida';
        // Na partida: no máx. 1 pip de overlay (já advertido hoje).
        parts.push(statusIcon('yellow', 'player-badge-yellow player-badge-yellow-match', title));
      }
      if (liveState.injured) {
        parts.push(statusIcon('injury', 'player-badge-injury severe', 'Lesionado nesta partida'));
      } else if (liveState.playThroughRisk) {
        parts.push(statusIcon('knock', 'player-badge-injury mild', 'Incômodo físico nesta partida'));
      }
    }

    // Empréstimo fica em linha própria (playerLoanLine) — não compete com o nome.
    return parts.length ? `<span class="player-status-badges">${parts.join('')}</span>` : '';
  };

  const buildInjuryLegend = injury => {
    if (!injury) return '';
    const name = String(injury.name || '').trim();
    const label = name && !/^les[aã]o (leve|mediana|grave)$/i.test(name)
      ? name
      : injuryAvailabilityLabel?.(injury) || name || 'Lesão';
    const careerDate = getCareerCalendarDate?.();
    const returnDate = projectInjuryReturnDate(injury, careerDate, injuryInRestrictedPhase);
    const returnText = returnDate
      ? formatInjuryReturnDate(returnDate)
      : injury.daysRemaining
        ? `${injury.daysRemaining} ${injury.daysRemaining === 1 ? 'dia' : 'dias'}`
        : '';
    return returnText ? `${label} · volta ${returnText}` : label;
  };

  /** Legenda de lesão — linha abaixo do nome (Elenco / Táticas). */
  const playerInjuryLine = player => {
    const injury = player?.injury;
    if (!injury || (!injuryInAcutePhase(injury) && !injuryInRestrictedPhase(injury))) return '';
    const legend = buildInjuryLegend(injury);
    if (!legend) return '';
    return `<span class="player-injury-line"><small class="player-injury-tag" title="${escapeAttr(legend)}">${legend}</small></span>`;
  };

  /** Tags EMPR. + clube — só Elenco (showLoan). Linha abaixo do nome. */
  const playerLoanLine = player => {
    if (!player?.onLoan) return '';
    const from = player.loanFrom ? ` de ${player.loanFrom}` : '';
    const club = player.loanFrom
      ? `<small class="player-loan-tag player-loan-tag-club" title="Clube de origem">${player.loanFrom}</small>`
      : '';
    return `<span class="player-loan-line"><small class="player-loan-tag" title="Emprestado${from} até o fim da temporada">EMPR.</small>${club}</span>`;
  };

  /** Convocado: linha "SELEÇÃO · <time>" enquanto estiver fora com a seleção. */
  const playerNationalLine = player => {
    const duty = player?.internationalDuty;
    if (!duty?.team) return '';
    const caps = Number(player?.internationalCareer?.caps) || 0;
    const title = `Convocado pela seleção ${duty.team}${caps ? ` · ${caps} jogos pela seleção` : ''}`;
    return `<span class="player-loan-line"><small class="player-loan-tag player-national-tag" title="${escapeAttr(title)}">${duty.worldCup ? 'COPA' : 'SELEÇÃO'}</small><small class="player-loan-tag player-loan-tag-club">${escapeAttr(duty.team)}</small></span>`;
  };

  const playerStarBadge = player => {
    if (isCraque(player)) {
      const title = 'Craque · estrela dourada';
      return `<span class="player-specialist-star player-specialist-star--gold" title="${title}" aria-label="${title}">★</span>`;
    }
    if (isDestaque(player)) {
      const title = 'Destaque · estrela prata';
      return `<span class="player-specialist-star player-specialist-star--silver" title="${title}" aria-label="${title}">★</span>`;
    }
    if (isSetPieceSpecialist(player)) {
      const title = setPieceSpecialistTitle(player);
      return `<span class="player-specialist-star" title="${title}" aria-label="${title}">★</span>`;
    }
    if (isPenaltySavingSpecialist(player)) {
      const title = 'Especialista em defesa de pênaltis';
      return `<span class="player-specialist-star" title="${title}" aria-label="${title}">★</span>`;
    }
    return '';
  };

  const playerNameCell = (
    name,
    player,
    { prefix = '', liveState = null, allCompetitions = false, showLoan = false, openCard = false, clubName = '' } = {},
  ) => {
    const displayName = playerDisplayName(name, getPlayerRoster?.(player, clubName) || []);
    const loanLine = showLoan ? playerLoanLine(player) : '';
    const injuryLine = playerInjuryLine(player);
    const nationalLine = playerNationalLine(player);
    const badges = playerStatusBadges(player, liveState, { allCompetitions, showLoan: false });
    const playerId = resolvePlayerId(player) || '';
    const cellMods = [(loanLine || nationalLine) && 'has-loan', injuryLine && 'has-injury'].filter(Boolean).join(' ');
    const cardAttrs =
      openCard && playerId
        ? ` role="button" tabindex="0" class="player-name-text is-card-trigger" data-open-player-card data-player-id="${escapeAttr(playerId)}"${clubName ? ` data-player-club="${escapeAttr(clubName)}"` : ''}`
        : ' class="player-name-text"';
    return `<b class="player-name-cell${cellMods ? ` ${cellMods}` : ''}"><span class="player-name-line">${prefix ? `<span class="player-name-prefix">${prefix}</span>` : ''}<span${cardAttrs} title="${escapeAttr(name)}">${escapeAttr(displayName)}</span>${playerStarBadge(player)}${badges}</span>${injuryLine}${nationalLine}${loanLine}</b>`;
  };

  return { playerNameCell, playerStatusBadges, playerInjuryLine };
}

/**
 * Mini-carta de jogador no campinho (padrão v2): OVR, chip de posição e
 * barra de condição. Usada em Táticas, pausa ao vivo, análise de adversário.
 * Com `vacant`, mostra um × no lugar (expulso/vaga).
 */
export const boardCardMarkup = (player, { vacant = false } = {}) => {
  if (vacant || !player) {
    return '<span class="pp-card pp-card--vacant"><span class="pp-top"><b class="pp-ovr">×</b></span></span>';
  }
  const energy = Math.round(clamp(Number.isFinite(Number(player.fatigue)) ? Number(player.fatigue) : 100, 0, 100));
  const level = energy >= 80 ? 'ok' : energy >= 60 ? 'warn' : 'low';
  return `<span class="pp-card"><span class="pp-top"><b class="pp-ovr">${player.overall ?? '—'}</b><em class="pos-chip" data-line="${positionLine(player.pos)}">${player.pos || ''}</em></span><i class="pp-cond" data-level="${level}"><b style="width:${energy}%"></b></i></span>`;
};
