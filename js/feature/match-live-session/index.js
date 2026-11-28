import { statCompareRow } from '../shared/stat-compare.js';
import { MODULE_VERSIONS } from '../../core/constants.js';

/**
 * Sessão da partida ao vivo — abertura/preparação, encerramento e o resumo
 * final (estatísticas + diagnósticos médicos). Orquestração de minuto a
 * minuto (tick/advance/pênaltis) permanece em `engine/match-live-orchestration.js`.
 * @param {object} deps
 * @param {Function} deps.$
 * @param {Function} deps.onClick
 * @param {Function} deps.getLiveInjuries — () => liveInjuries
 * @param {Function} deps.getLiveDeferredInjuries — () => liveDeferredInjuries
 * @param {Function} deps.getUserClub
 * @param {Function} deps.getMatchClub
 * @param {Function} deps.getClubs
 * @param {Function} deps.applyDeferredInjuryDiagnosis
 * @param {Function} deps.injuryDiagnosisComment
 * @param {Function} deps.calendarLiveSideStats
 * @param {Function} deps.calendarPossessionPair
 * @param {Function} deps.calendarLiveSideGoals
 * @param {Function} deps.getPostMatchMedicalQueue — () => postMatchMedicalQueue
 * @param {Function} deps.processPostMatchMedicalQueue
 * @param {Function} deps.pushMessage
 * @param {Function} deps.getCurrentRound
 * @param {Function} deps.getLiveMatchGame
 * @param {Function} deps.getNextUserGame
 * @param {Function} deps.fixtureDetails
 * @param {Function} deps.advanceCareerCalendarTo
 * @param {Function} deps.getHasCareer — () => !!savedNewGame
 * @param {Function} deps.persistSeason
 * @param {Function} deps.modal — elemento do modal da partida
 * @param {Function} deps.getMatchFinished
 * @param {Function} deps.getRoundCommitted
 * @param {Function} deps.advanceSeasonRound
 * @param {Function} deps.openChampionshipStandings — abre seção Campeonatos na competição do jogo ao vivo
 * @param {Function} deps.simulateRoundResults
 * @param {Function} deps.openRoundResults
 * @param {Function} [deps.openLiveMatchRatings] — abre relatório com notas Brasfoot
 * @param {Function} [deps.onPostMatchModalClosed] — dashboard/CTA após fechar o modal pós-jogo
 * @param {Function} deps.stopMatchClock
 * @param {Function} deps.startMatchClock
 * @param {Function} deps.closeFormationSuggestion
 * @param {Function} deps.getMatchStarted
 * @param {Function} deps.renderLiveMatchHeader
 * @param {Function} deps.score
 * @param {Function} deps.updateLiveMatchClock
 * @param {Function} deps.getShootoutState
 * @param {Function} deps.renderShootoutTrack
 * @param {Function} deps.getPreMatchPreparation
 * @param {Function} deps.renderStats
 * @param {Function} deps.setActivePreparationTitle
 * @param {Function} [deps.onBeginLineupEdit] — snapshot do XI ao abrir pausa (trocas livres até retomar)
 * @param {Function} deps.syncTactics
 * @param {Function} deps.drawBoard
 * @param {Function} deps.renderSubstitutionControls
 * @param {Function} deps.renderTacticalConfrontation
 * @param {object} [deps.matchLiveAudio]
 */
export function createMatchLiveSessionFeature(deps) {
  const {
    $,
    onClick,
    getLiveInjuries,
    getLiveDeferredInjuries,
    getUserClub,
    getMatchClub,
    getClubs,
    applyDeferredInjuryDiagnosis,
    injuryDiagnosisComment,
    calendarLiveSideStats,
    calendarPossessionPair,
    calendarLiveSideGoals,
    getPostMatchMedicalQueue,
    processPostMatchMedicalQueue,
    pushMessage,
    getCurrentRound,
    getLiveMatchGame,
    getNextUserGame,
    fixtureDetails,
    advanceCareerCalendarTo,
    getHasCareer,
    persistSeason,
    modal,
    getMatchFinished,
    getRoundCommitted,
    advanceSeasonRound,
    openChampionshipStandings,
    simulateRoundResults,
    openRoundResults,
    openLiveMatchRatings,
    onPostMatchModalClosed,
    stopMatchClock,
    startMatchClock,
    closeFormationSuggestion,
    getMatchStarted,
    renderLiveMatchHeader,
    score,
    updateLiveMatchClock,
    getShootoutState,
    renderShootoutTrack,
    getPreMatchPreparation,
    renderStats,
    setActivePreparationTitle,
    onBeginLineupEdit,
    syncTactics,
    drawBoard,
    renderSubstitutionControls,
    renderTacticalConfrontation,
    matchLiveAudio,
  } = deps;

  const prepStopWhistleTitles = new Set([
    'CARTÃO VERMELHO',
    'LESÃO',
    'ALERTA MÉDICO',
    'LIMITE MÉDICO',
    'PAUSA TÉCNICA',
  ]);

  const dismissPostMatchChrome = () => {
    $('#calendarMatchReportModal')?.classList.add('hidden');
    $('#liveOpponentModal')?.classList.add('hidden');
    modal.classList.add('hidden');
    if (typeof onPostMatchModalClosed === 'function') onPostMatchModalClosed();
  };

  const renderFinalSummary = ({ processMedical = true } = {}) => {
    const userClub = getUserClub(), club = getMatchClub(), clubs = getClubs(), currentRound = getCurrentRound();
    const liveInjuries = getLiveInjuries(), liveDeferredInjuries = getLiveDeferredInjuries();
    const medicalReports = [['home', liveInjuries.home, clubs[userClub]], ['away', liveInjuries.away, club]].flatMap(([, entries, matchClub]) => entries.map(entry => {
      entry.injury.diagnosisPending = false;
      return { text: injuryDiagnosisComment({ name: entry.name }, entry.injury, matchClub), outcome: 'confirmed' };
    }));
    [['home', userClub], ['away', club.name]].forEach(([side, clubName]) => {
      liveDeferredInjuries[side].forEach(entry => {
        const player = clubs[clubName].roster.find(candidate => candidate.name === entry.name);
        if (!player || liveInjuries[side].some(item => item.name === entry.name)) return;
        const result = applyDeferredInjuryDiagnosis(player, entry, clubs[clubName]);
        if (result.injury) entry.injury = { ...result.injury };
        medicalReports.push({ text: result.report, outcome: result.outcome });
      });
    });
    const h = calendarLiveSideStats().home, a = calendarLiveSideStats().away, { home: hp, away: ap } = calendarPossessionPair();
    const sideGoals = calendarLiveSideGoals();
    const groupGoalsByScorer = goals => {
      const order = [];
      const byKey = new Map();
      (goals || []).forEach(goal => {
        const own = goal?.type === 'own';
        const key = `${own ? 'own:' : ''}${goal?.name || '—'}`;
        if (!byKey.has(key)) {
          byKey.set(key, { name: goal?.name || '—', own, stamps: [] });
          order.push(key);
        }
        byKey.get(key).stamps.push({
          minute: Number(goal.minute) || 0,
          stoppage: Number(goal.stoppage) || 0,
        });
      });
      return order.map(key => {
        const entry = byKey.get(key);
        const minutes = entry.stamps
          .slice()
          .sort((a, b) => a.minute - b.minute || a.stoppage - b.stoppage)
          .map(stamp => {
            const base = stamp.stoppage > 0 ? (stamp.minute <= 45 ? 45 : 90) : stamp.minute;
            const label = stamp.stoppage > 0 ? `${base}+${stamp.stoppage}` : String(base);
            return `${label}'`;
          })
          .join(', ');
        return { name: entry.own ? `${entry.name} (GC)` : entry.name, minutes };
      });
    };
    const scorers = side =>
      sideGoals[side].length
        ? groupGoalsByScorer(sideGoals[side])
            .map(entry => `<span>${entry.name} ${entry.minutes}</span>`)
            .join('')
        : '<span>Nenhum gol</span>';
    const liveMatchGame = getLiveMatchGame(), nextUserGame = getNextUserGame();
    const rows = [['Posse de bola', `${hp}%`, `${ap}%`], ['Total de Passes', h.passes, a.passes], ['Finalizações', h.shots, a.shots], ['Pênaltis marcados', h.penalties, a.penalties], ['Faltas Cometidas', h.fouls, a.fouls], ['Cartões Amarelos', h.yellow, a.yellow], ['Cartões Vermelhos', h.red, a.red]];
    const shootoutSection = liveMatchGame?.shootoutPenalties
      ? `<section class="final-shootout"><h3>DISPUTA DE PÊNALTIS</h3><p class="final-shootout-score"><strong>${liveMatchGame.shootoutPenalties}</strong>${liveMatchGame.shootoutWinner ? ` · ${liveMatchGame.shootoutWinner} venceu` : ''}</p><small>Não entra na média de gols do jogo — só decide o mata-mata.</small></section>`
      : '';
    const injuryReports = medicalReports.map(item => item.text);
    const injurySection = injuryReports.length ? `<section class="final-injuries"><h3>DIAGNÓSTICOS MÉDICOS</h3>${medicalReports.map(item => `<p class="${item.outcome === 'cleared' ? 'cleared' : item.outcome === 'monitoring' ? 'monitoring' : ''}">${item.text}</p>`).join('')}</section>` : '';
    const homeClub = (liveMatchGame || nextUserGame)?.home || userClub, awayClub = (liveMatchGame || nextUserGame)?.away || club.name;
    // Pós-jogo v2: gols já aparecem embaixo de cada time no placar; aqui ficam
    // as estatísticas em barras de comparação (mandante × visitante).
    const cmpRow = row => statCompareRow(row);
    $('#stats').innerHTML = `<section class="final-basic pm2-stats"><h3 class="pm2-h">ESTATÍSTICAS</h3><div class="pm2-cmp-teams"><span>${escHtml(homeClub)}</span><span>${escHtml(awayClub)}</span></div>${rows.map(cmpRow).join('')}</section>${shootoutSection}${injurySection}`;
    $('#stats').classList.remove('hidden');
    if (!processMedical) return;
    const postMatchMedicalQueue = getPostMatchMedicalQueue();
    if (postMatchMedicalQueue.length) {
      if (postMatchMedicalQueue.length === 1) {
        const item = postMatchMedicalQueue[0];
        pushMessage({ category: 'medical', type: 'treatment-pending', title: 'Ação médica pós-jogo', body: `${item.player.name} — ${item.injury.name}. Escolha cirurgia ou tratamento conservador para concluir a avaliação do departamento médico.`, round: currentRound, meta: { competition: 'Departamento médico', requiresAction: true, player: item.player.name } });
      } else {
        pushMessage({ category: 'medical', type: 'treatment-pending', title: `Ações médicas pós-jogo (${postMatchMedicalQueue.length})`, body: postMatchMedicalQueue.map(item => `• ${item.player.name} — ${item.injury.name}`).join('\n') + '\n\nEscolha cirurgia ou tratamento conservador para cada caso pendente.', round: currentRound, meta: { competition: 'Departamento médico', requiresAction: true } });
      }
      processPostMatchMedicalQueue();
    }
    const medicalDigest = medicalReports.filter(item => item.outcome !== 'confirmed');
    if (medicalDigest.length) {
      pushMessage({ category: 'medical', type: 'digest', title: 'Relatório médico pós-jogo', body: medicalDigest.map(item => `• ${item.text}`).join('\n'), round: currentRound, meta: { competition: 'Departamento médico' } });
    }
  };

  const escHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /** Pós-jogo v2: narração mostra só os lances principais, com botão para a completa. */
  const ensureTimelineToggle = () => {
    const timeline = $('#timeline');
    if (!timeline) return;
    let toggle = $('#pm2TimelineToggle');
    if (!toggle) {
      timeline.insertAdjacentHTML('afterend', '<button type="button" id="pm2TimelineToggle" class="pm2-timeline-toggle" aria-expanded="false">Ver narração completa ›</button>');
      toggle = $('#pm2TimelineToggle');
      toggle.addEventListener('click', () => {
        const open = !timeline.classList.contains('pm2-full');
        timeline.classList.toggle('pm2-full', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.textContent = open ? 'Só lances principais ‹' : 'Ver narração completa ›';
      });
    }
    timeline.classList.remove('pm2-full');
    requestAnimationFrame(() => { timeline.scrollTop = 0; });
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Ver narração completa ›';
  };

  /** Pós-jogo v2 (canvas Arcade Noturno): resultado, craque e números do jogo. */
  const renderPostMatchHero = () => {
    const card = $('#matchModal .modal-card');
    const score = card?.querySelector('.score.live-score');
    if (!card || !score) return;
    let hero = card.querySelector('#postMatchHero');
    const summary = typeof deps.getPostMatchSummary === 'function' ? deps.getPostMatchSummary() : null;
    if (!summary) {
      hero?.remove();
      card.classList.remove('has-post-match');
      return;
    }
    if (!hero) {
      hero = document.createElement('section');
      hero.id = 'postMatchHero';
      hero.className = 'post-match-hero';
      hero.setAttribute('aria-label', 'Resumo do jogo');
      score.after(hero);
    }
    card.classList.add('has-post-match');
    const agg = summary.aggregate || null;
    const decided = agg && agg.qualified != null;
    const label = decided ? (agg.qualified ? 'CLASSIFICADO!' : 'ELIMINADO') : summary.result === 'V' ? 'VITÓRIA!' : summary.result === 'D' ? 'DERROTA' : 'EMPATE';
    const tone = decided ? (agg.qualified ? 'win' : 'loss') : summary.result === 'V' ? 'win' : summary.result === 'D' ? 'loss' : 'draw';
    card.dataset.postResult = tone;
    const star = summary.star;
    const starLine = star ? [star.goals ? `${star.goals} gol${star.goals > 1 ? 's' : ''}` : '', star.assists ? `${star.assists} assist.` : ''].filter(Boolean).join(' · ') : '';
    const tiles = [
      agg ? { label: 'Agregado', value: `${agg.home} — ${agg.away}`, sub: decided ? (agg.qualified ? 'Avança de fase' : 'Fora da competição') : 'Decisão nos pênaltis', tone: decided ? (agg.qualified ? 'lime' : 'red') : '' } : null,
      { label: 'Nota do time', value: summary.teamAverage ? summary.teamAverage.toFixed(1).replace('.', ',') : '—', tone: 'lime' },
      summary.crowd ? { label: 'Público', value: summary.crowd, sub: summary.occupancy ? `${summary.occupancy}% do estádio` : '' } : null,
      summary.userIsHome && summary.renda ? { label: 'Bilheteria', value: summary.renda.replace(/^R\$\s*/, 'R$ '), money: true } : null,
      summary.shootout ? { label: 'Pênaltis', value: summary.shootout } : null,
    ].filter(Boolean);
    hero.style.setProperty('--pm2-tiles', String(tiles.length || 1));
    // Linha do estádio sem público/renda (já estão nos números do jogo).
    const venue = $('#liveMatchVenue');
    if (venue) {
      if (!venue.dataset.full) venue.dataset.full = venue.textContent || '';
      venue.textContent = venue.dataset.full
        .split(' · ')
        .filter(part => !/^[\d.]+$/.test(part.trim()) && !/%$/.test(part.trim()) && !/^Renda/i.test(part.trim()))
        .join(' · ');
    }
    ensureTimelineToggle();
    hero.innerHTML = `<span class="post-match-result is-${tone}">${label}</span>${star ? `<div class="post-match-star"><i aria-hidden="true">${escHtml(star.pos || '')}</i><span><small>CRAQUE DO JOGO</small><strong>${escHtml(star.name)}</strong>${starLine ? `<em>${escHtml(starLine)}</em>` : ''}</span><b>${Number(star.rating || 0).toFixed(1).replace('.', ',')}</b></div>` : ''}<div class="post-match-tiles">${tiles.map(tile => `<div class="post-match-tile${tile.money ? ' is-money' : ''}${tile.tone ? ` is-${tile.tone}` : ''}"><small>${escHtml(tile.label)}</small><strong>${escHtml(tile.value)}</strong>${tile.sub ? `<em>${escHtml(tile.sub)}</em>` : ''}</div>`).join('')}</div>`;
  };

  const showFinalActions = ({ reopen = false, openRatings = !reopen } = {}) => {
    const liveMatchGame = getLiveMatchGame();
    if (!reopen && liveMatchGame) {
      const matchDate = liveMatchGame.competition === 'COPA DO BRASIL' ? new Date(liveMatchGame.date) : fixtureDetails(liveMatchGame).date;
      if (matchDate) advanceCareerCalendarTo(matchDate);
      if (getHasCareer()) persistSeason(true);
    }
    const actions = $('#matchActions');
    actions.classList.remove('hidden');
    actions.innerHTML =
      '<button type="button" id="finalRatings">NOTAS</button><button type="button" id="finalDashboard">CLASSIFICAÇÃO</button><button type="button" id="finalTable">TABELA DE JOGOS</button><button type="button" id="finalNext">CONTINUAR</button>';
    renderPostMatchHero();
    // Bind direto nos botões novos (evita listener órfão se o nó foi recriado).
    actions.querySelector('#finalRatings')?.addEventListener('click', () => {
      if (typeof openLiveMatchRatings === 'function') openLiveMatchRatings();
    });
    // CLASSIFICAÇÃO / TABELA só navegam — não avançam a rodada (isso fica no AVANÇAR).
    actions.querySelector('#finalDashboard')?.addEventListener('click', () => {
      dismissPostMatchChrome();
      openChampionshipStandings();
    });
    actions.querySelector('#finalTable')?.addEventListener('click', () => {
      simulateRoundResults();
      dismissPostMatchChrome();
      openRoundResults(getLiveMatchGame?.());
    });
    actions.querySelector('#finalNext')?.addEventListener('click', () => exitLiveMatch());
    if (openRatings && typeof openLiveMatchRatings === 'function') {
      queueMicrotask(() => openLiveMatchRatings());
    }
  };

  const exitLiveMatch = () => {
    if (!getMatchFinished() || getRoundCommitted()) return;
    $('#postMatchHero')?.remove();
    $('#pm2TimelineToggle')?.remove();
    $('#timeline')?.classList.remove('pm2-full');
    const venueEl = $('#liveMatchVenue');
    if (venueEl?.dataset.full) { venueEl.textContent = venueEl.dataset.full; delete venueEl.dataset.full; }
    const modalCard = $('#matchModal .modal-card');
    modalCard?.classList.remove('has-post-match');
    if (modalCard) delete modalCard.dataset.postResult;
    stopMatchClock();
    $('#shootoutPanel')?.classList.add('hidden');
    $('#penaltyDuelModal')?.classList.add('hidden');
    $('#penaltyChoice')?.classList.add('hidden');
    $('#penaltyCompare')?.classList.add('hidden');
    $('#liveOpponentModal')?.classList.add('hidden');
    $('#calendarMatchReportModal')?.classList.add('hidden');
    closeFormationSuggestion();
    advanceSeasonRound();
  };

  const reopenMatchWindow = () => {
    if (!getMatchStarted()) return false;
    const liveMatchGame = getLiveMatchGame(), shootoutState = getShootoutState(), preMatchPreparation = getPreMatchPreparation();
    renderLiveMatchHeader(liveMatchGame);
    $('#roundResultsModal')?.classList.add('hidden');
    $('#liveOpponentModal').classList.add('hidden');
    modal.classList.remove('hidden');
    score();
    updateLiveMatchClock();
    if (getMatchFinished()) {
      stopMatchClock();
      $('#pausePanel').classList.add('hidden');
      $('#penaltyDuelModal')?.classList.add('hidden');
      $('#penaltyChoice').classList.add('hidden');
      if (shootoutState) { renderShootoutTrack(); $('#shootoutPanel').classList.remove('hidden'); }
      else if (liveMatchGame?.penalties) { $('#shootoutTitle').textContent = `Disputa ${liveMatchGame.penalties}`; $('#shootoutPanel').classList.remove('hidden'); }
      $('#matchStatus').textContent = shootoutState ? 'Disputa de pênaltis em andamento.' : liveMatchGame?.penalties ? `Partida encerrada · Disputa ${liveMatchGame.penalties}.` : 'Partida encerrada.';
      // Reabertura: não reprocessa fila médica / calendário (já feitos no fim do jogo).
      renderFinalSummary({ processMedical: false });
      showFinalActions({ reopen: true });
      return true;
    }
    const penaltyOpen = !!$('#penaltyDuelModal')
      ? !$('#penaltyDuelModal').classList.contains('hidden')
      : !$('#penaltyChoice').classList.contains('hidden');
    const awaitingDecision = !$('#pausePanel').classList.contains('hidden') || penaltyOpen || shootoutState;
    if (awaitingDecision) {
      stopMatchClock();
      $('#matchActions').classList.add('hidden');
      if (shootoutState) { $('#shootoutPanel').classList.remove('hidden'); renderShootoutTrack(); }
      if (penaltyOpen) $('#penaltyDuelModal')?.classList.remove('hidden');
      $('#stats').classList.toggle('hidden', preMatchPreparation);
      if (!preMatchPreparation) renderStats();
    } else {
      $('#matchActions').classList.remove('hidden');
      startMatchClock();
    }
    return true;
  };

  const setPauseTacticsOpen = open => {
    const panel = $('#pauseTacticAdjust');
    const toggle = $('#togglePauseTactics');
    if (!panel || !toggle) return;
    panel.classList.toggle('hidden', !open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.classList.toggle('open', !!open);
    toggle.textContent = open ? '✕ FECHAR AJUSTE TÁTICO' : '⚙ AJUSTE TÁTICO';
    $('#pausePanel')?.classList.toggle('tactics-open', !!open);
  };

  let pauseTacticsBound = false;
  const bindPauseTacticsToggle = () => {
    if (pauseTacticsBound) return;
    pauseTacticsBound = true;
    onClick('#togglePauseTactics', () => {
      const panel = $('#pauseTacticAdjust');
      if (!panel) return;
      setPauseTacticsOpen(panel.classList.contains('hidden'));
    });
  };

  const openPreparation = title => {
    stopMatchClock();
    const preMatchPreparation = getPreMatchPreparation();
    if (!preMatchPreparation && prepStopWhistleTitles.has(title)) {
      matchLiveAudio?.playStopWhistle?.();
    }
    matchLiveAudio?.pauseStadiumAmbient?.();
    setActivePreparationTitle(title);
    onBeginLineupEdit?.();
    const pauseTitle = $('#pauseTitle');
    if (pauseTitle) {
      if (preMatchPreparation) {
        pauseTitle.textContent = '';
        pauseTitle.classList.add('hidden');
      } else {
        pauseTitle.textContent = title;
        pauseTitle.classList.remove('hidden');
      }
    }
    $('#pauseHeading').textContent = preMatchPreparation ? 'Preparação da Partida' : 'Ajuste do Time';
    $('.pause-heading small').textContent = preMatchPreparation ? 'Organize a formação, a tática e a escalação antes do apito inicial.' : title === 'CARTÃO VERMELHO' ? 'Arraste um jogador para a vaga destacada ou troque posições; a nova organização será aplicada ao motor.' : title === 'LESÃO' ? 'O atleta lesionado não participa mais das ações. Substitua-o ou reorganize o time antes de retomar.' : title === 'ALERTA MÉDICO' ? 'O atleta apresenta incômodo físico. Substitua-o para evitar agravamento ou mantenha-o em campo assumindo o risco.' : 'Altere a formação, a tática e os jogadores antes de retomar.';
    $('#resumeMatch').textContent = preMatchPreparation ? 'INICIAR PARTIDA →' : 'RETOMAR PARTIDA →';
    $('#stats').before($('#pausePanel'));
    $('#matchActions').classList.add('hidden');
    $('#stats').classList.toggle('hidden', preMatchPreparation);
    $('#pausePanel').classList.remove('hidden');
    bindPauseTacticsToggle();
    setPauseTacticsOpen(false);
    syncTactics(); drawBoard(); renderSubstitutionControls(); renderTacticalConfrontation({ context: 'pause' });
    if (!preMatchPreparation) renderStats();
    updateLiveMatchClock();
  };

  return {
    moduleVersion: MODULE_VERSIONS.matchLiveSession,
    renderFinalSummary,
    showFinalActions,
    exitLiveMatch,
    reopenMatchWindow,
    openPreparation,
  };
}
