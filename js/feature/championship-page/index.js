import { FEATURES, SERIE_D_GROUP_ROUNDS } from '../../core/constants.js';
import { formatKnockoutFixtureScore } from '../../engine/knockout-shootout.js';
import { filterPlayableRoundGames } from '../../engine/round-game-filter.js';
import { serieDPhaseIndexForRound } from '../../engine/serie-d-format.js';
import { isPaulistaFormat, parseStateCompetitionKey, stateCompetitionKey, ufLabel } from '../../engine/state-league-format.js';
import {
  stateLeagueTableZoneMeta,
} from '../../engine/state-league-movement.js';
import { loadSeasonArchive, listSeasonArchiveYears } from '../../core/season-archive-storage.js';
import { computeGroupStandings } from '../../engine/world-cup-standings.js';
import { KNOCKOUT_SCHEDULE } from '../../engine/world-cup-calendar.js';
import { getWorldCupAllFixtures } from '../../engine/world-cup-competition.js';
import { findUserWorldCupGroup } from '../../engine/world-cup/dashboard-context.js';
import { WORLD_CUP_GROUP_LETTERS } from '../../engine/world-cup-history.js';
import { ensureCompetitionTrophy, hydratePickerTrophyIcons, preloadCompetitionTrophy, resolveChampionshipTrophyKey } from '../../ui/competition-trophies.js';
import { teamCrestHtml } from '../../ui/team-crest.js';
import { createCompetitionRulesModalFeature } from '../competition-rules-modal/index.js';
import {
  buildPageCompetitionOptions,
  championshipPickerActiveId,
  isStateChampionshipPage,
  renderEstaduaisHub,
} from './hub.js';
import { createChampionshipPageFocus } from './focus.js';

/**
 * Campeonatos (view table) — classificação, mata-mata inline e modal de chaveamento.
 */
export function createChampionshipPageFeature(deps) {
  const {
    $,
    $$,
    onClick,
    clamp,
    router,
    getUserClub,
    getUserDivision,
    getUserNationalTeamName,
    getUserSerieDGroupIndex,
    getCurrentRound,
    getCareerSeason,
    getWorldCupCompetition,
    getNationalCompetitions,
    getCupCompetition,
    getRecopaCompetition,
    getCupPhaseDefinitions,
    getSerieDKnockoutPhaseDefs,
    getSerieDGroups,
    getCupSerieAEntrants,
    stateLeagueEngine,
    stateFlagMarkup,
    cupClubLabel,
    knockoutShootoutLabel,
    recopaNationalEmptyMessage,
    serieCClubsForSeason,
    leagueClassificationZone,
    serieCRelegationZone,
    standingsRowsForDisplay,
    seriesDGroupRows,
    stateGroupRows,
    applyTablePreviewToRows,
    pendingRoundPreviewGames,
    getMatchFinished,
    getRoundCommitted,
    getLiveMatchGame,
    simulateRoundMatch,
    gameRandom,
    overlayPendingLiveKnockoutGames,
    cupTieGames,
    cupTieAggregate,
    cupGameForDisplay,
    hasPendingLiveKnockoutPostMatch,
    fixtureDetails,
    markCupPhaseSelection,
    markSerieDPhaseSelection,
    serieDKnockoutPhaseMeta,
    serieDStageFixturesMerged,
    setBracketRoundView,
    getBracketRoundView,
    isSerieDKnockoutUiActive,
    isWorldCupDashboardActive,
    getNextPendingUserEntry,
    isKnockoutShootoutCompetition,
    isStateLeagueGame,
    isUserFixture,
    getRealClub,
    getClubs,
    getSavedNewGame,
  } = deps;

  let pageCompetition = getUserDivision();
  let pageStateRound = 1;
  let pageStateGroup = 0;
  let pageStateFixturesMode = 'round';
  let pageStateFixturesOpen = false;
  let pageSerieDGroup = Math.max(0, getUserSerieDGroupIndex());
  let pageSerieDMode = 'groups';
  let pageCupPhase = 1;
  let pageSerieDPhase = 1;
  let pageWorldCupGroup = 0;
  let pageWorldCupRound = 1;
  let pagePickerOpen = false;
  let pageStateTierPickerOpen = false;
  let pageViewSeason = null; // null = temporada viva
  let bracketCompetition = 'CUP';
  let openChampionshipLastGames = () => {};

  const resolvedViewSeason = () => Number(pageViewSeason) || getCareerSeason();
  const isArchiveView = () => Number(resolvedViewSeason()) !== Number(getCareerSeason());
  const getViewArchive = () => {
    if (!isArchiveView()) return null;
    return loadSeasonArchive(resolvedViewSeason(), { seed: getSavedNewGame()?.seed });
  };

  const PAGE_COMPETITION_OPTIONS = buildPageCompetitionOptions({ FEATURES, savedNewGame: getSavedNewGame() });
  const getPageCompetitionOptions = () => {
    const worldCupCompetition = getWorldCupCompetition();
    if (!worldCupCompetition) return PAGE_COMPETITION_OPTIONS;
    const cmu = { id: 'CMU', label: 'Copa do Mundo', trophyKey: 'world-cup' };
    if (PAGE_COMPETITION_OPTIONS.some(option => option.id === 'CMU')) return PAGE_COMPETITION_OPTIONS;
    return [cmu, ...PAGE_COMPETITION_OPTIONS];
  };

  const placeChampionshipPagePickerMenu = () => {
    const btn = $('#championshipPagePickerBtn'), menu = $('#championshipPagePickerMenu');
    if (!btn || !menu || !pagePickerOpen) return;
    const rect = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${Math.round(rect.bottom + 6)}px`;
    menu.style.right = `${Math.round(Math.max(8, window.innerWidth - rect.right))}px`;
    menu.style.left = 'auto';
    menu.style.zIndex = '5000';
  };

  const setChampionshipPagePickerOpen = open => {
    pagePickerOpen = !!open;
    if (pagePickerOpen) setChampionshipPageStateTierPickerOpen(false);
    const btn = $('#championshipPagePickerBtn'), menu = $('#championshipPagePickerMenu');
    const host = $('.championship-page-picker:not(.championship-page-state-tier-picker)');
    btn?.setAttribute('aria-expanded', pagePickerOpen ? 'true' : 'false');
    if (btn) btn.textContent = pagePickerOpen ? 'TODAS AS COMPETIÇÕES ▴' : 'TODAS AS COMPETIÇÕES ▾';
    if (!menu) return;
    menu.classList.toggle('hidden', !pagePickerOpen);
    if (pagePickerOpen) {
      if (menu.parentElement !== document.body) document.body.appendChild(menu);
      placeChampionshipPagePickerMenu();
      hydratePickerTrophyIcons(menu);
    } else {
      menu.style.position = '';
      menu.style.top = '';
      menu.style.right = '';
      menu.style.left = '';
      menu.style.zIndex = '';
      if (host && menu.parentElement !== host) host.appendChild(menu);
    }
  };

  const placeChampionshipPageStateTierPickerMenu = () => {
    const btn = $('#championshipPageStateTierBtn'), menu = $('#championshipPageStateTierMenu');
    if (!btn || !menu || !pageStateTierPickerOpen) return;
    const rect = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${Math.round(rect.bottom + 6)}px`;
    menu.style.right = `${Math.round(Math.max(8, window.innerWidth - rect.right))}px`;
    menu.style.left = 'auto';
    menu.style.zIndex = '5000';
  };

  const setChampionshipPageStateTierPickerOpen = open => {
    pageStateTierPickerOpen = !!open;
    if (pageStateTierPickerOpen) setChampionshipPagePickerOpen(false);
    const btn = $('#championshipPageStateTierBtn'), menu = $('#championshipPageStateTierMenu');
    const host = $('#championshipPageStateTierPicker');
    btn?.setAttribute('aria-expanded', pageStateTierPickerOpen ? 'true' : 'false');
    if (btn && !pageStateTierPickerOpen) {
      const parsed = isStateChampionshipPage(pageCompetition) ? parseStateCompetitionKey(pageCompetition) : null;
      const tier = parsed?.tier || 1;
      const tiers = parsed ? stateLeagueEngine.getTiersForUf(parsed.uf) : [];
      btn.textContent = tiers.length > 1 ? `DIVISÃO ${tier} ▾` : 'DIVISÕES ▾';
    } else if (btn && pageStateTierPickerOpen) {
      btn.textContent = 'DIVISÕES ▴';
    }
    if (!menu) return;
    menu.classList.toggle('hidden', !pageStateTierPickerOpen);
    if (pageStateTierPickerOpen) {
      if (menu.parentElement !== document.body) document.body.appendChild(menu);
      placeChampionshipPageStateTierPickerMenu();
    } else {
      menu.style.position = '';
      menu.style.top = '';
      menu.style.right = '';
      menu.style.left = '';
      menu.style.zIndex = '';
      if (host && menu.parentElement !== host) host.appendChild(menu);
    }
  };

  const championshipPageIsKnockoutView = () =>
    pageCompetition === 'CUP' || pageCompetition === 'RECOPA' || (pageCompetition === 'D' && pageSerieDMode === 'knockout');

  const serieDMaxGeneratedPhaseIndex = () => {
    let max = 0;
    getSerieDKnockoutPhaseDefs().forEach(definition => {
      if (serieDKnockoutPhaseMeta(definition).generated) max = Math.max(max, definition.index);
    });
    return max;
  };

  const cupBracketTieFromStage = (stage, tieId) => {
    const userClub = getUserClub();
    const games = overlayPendingLiveKnockoutGames(cupTieGames(stage, tieId));
    if (!games.length) return null;
    const sideA = games[0].home, sideB = games[0].away;
    const aggregate = cupTieAggregate(games);
    const allDone = games.every(game => game.completed);
    const played = games.some(game => game.completed);
    let winner = games.find(game => game.winner)?.winner || games.find(game => game.shootoutWinner)?.shootoutWinner || null;
    if (!winner && allDone) {
      const goalsA = aggregate.get(sideA) || 0, goalsB = aggregate.get(sideB) || 0;
      if (goalsA !== goalsB) winner = goalsA > goalsB ? sideA : sideB;
    }
    const penLabel = games.map(game => game.penalties || game.shootoutPenalties).find(Boolean) || '';
    const legMeta = games.map(game => {
      const details = fixtureDetails(game);
      const score = game.completed ? formatKnockoutFixtureScore(game, { separator: '-' }) : '×';
      return `${game.leg} ${details.display} ${score}`;
    }).join(' · ');
    return {
      tieId, sideA, sideB, winner, penLabel, legMeta, played, allDone,
      scoreA: played ? String(aggregate.get(sideA) || 0) : '—',
      scoreB: played ? String(aggregate.get(sideB) || 0) : '—',
      userTie: sideA === userClub || sideB === userClub,
    };
  };

  const renderCupTreeTeam = (name, score, { winner = null, plain = false } = {}) => {
    const userClub = getUserClub();
    const classes = ['cup-tree-team'];
    if (name === userClub) classes.push('user-club');
    if (winner === name) classes.push('winner');
    const main = plain ? `<b>${name}</b>` : cupClubLabel(name, { tag: 'b' });
    return `<div class="${classes.join(' ')}">${teamCrestHtml(name)}<span class="cup-tree-team-main">${main}</span><em>${score}</em></div>`;
  };

  const renderCupTreeMatch = (tie, { plain = false } = {}) => {
    const userClub = getUserClub();
    const badge = tie.userTie ? `<div class="cup-tree-user-badge">${tie.winner === userClub ? 'VOCÊ AVANÇOU' : tie.allDone ? 'VOCÊ ELIMINADO' : 'SEU JOGO'}</div>` : '';
    const metaLine = [tie.legMeta, tie.penLabel ? `PÊN. ${tie.penLabel}` : ''].filter(Boolean).join(' · ');
    const winnerLine = tie.winner ? `<strong>Classificado: ${tie.winner}</strong>` : '';
    return `<article class="cup-tree-match ${tie.userTie ? 'user-tie' : ''} ${tie.userTie ? '' : 'dim-tie'}" data-user-tie="${tie.userTie ? '1' : '0'}">
      ${badge}
      ${renderCupTreeTeam(tie.sideA, tie.scoreA, { winner: tie.winner, plain })}
      ${renderCupTreeTeam(tie.sideB, tie.scoreB, { winner: tie.winner, plain })}
      <div class="cup-tree-match-meta"><span>${metaLine}</span>${winnerLine}</div>
    </article>`;
  };

  const renderCupPhase5Pot = () => {
    const userClub = getUserClub();
    const cupCompetition = getCupCompetition();
    const phase4 = cupCompetition.stages.find(item => item.index === 4);
    const fromPhase4 = phase4?.winners?.length
      ? phase4.winners
      : phase4?.fixtures
        ? [...new Set(phase4.fixtures.map(game => game.tieId))]
          .map(tieId => cupBracketTieFromStage(phase4, tieId))
          .map(tie => tie?.winner)
          .filter(Boolean)
        : [];
    const pendingSlots = Math.max(0, 12 - fromPhase4.length);
    const serieA = getCupSerieAEntrants().slice(0, 20);
    const chips = [
      ...serieA.map(name => teamCrestHtml(name, { className: name === userClub ? 'user-club' : '' })),
      ...fromPhase4.map(name => teamCrestHtml(name, { className: name === userClub ? 'user-club' : '' })),
      ...Array.from({ length: pendingSlots }, () => '<i class="tbd">?</i>'),
    ].join('');
    return `<div class="cup-tree-pot"><strong>POTES DO SORTEIO</strong><div class="cup-tree-pot-grid">${chips}</div></div>`;
  };

  const cupBracketPhaseStatus = stage => {
    if (stage?.completed) return 'CONCLUÍDA';
    if (stage) return 'EM DISPUTA';
    return 'AGUARDANDO SORTEIO';
  };

  const cupBracketPhaseNav = phaseIndex => {
    const cupCompetition = getCupCompetition();
    const prevStage = cupCompetition.stages.find(item => item.index === phaseIndex - 1);
    const nextStage = cupCompetition.stages.find(item => item.index === phaseIndex + 1);
    const prevReady = Boolean(prevStage?.fixtures?.length);
    const nextReady = Boolean(nextStage?.fixtures?.length);
    return `<div class="cup-bracket-phase-nav" role="group" aria-label="Navegar fases">
      <button type="button" class="cup-bracket-btn ghost cup-bracket-nav" data-cup-bracket-prev ${prevReady ? '' : 'disabled'} aria-label="Fase anterior" title="${prevReady ? 'Fase anterior' : 'Não há fase anterior'}">←</button>
      <button type="button" class="cup-bracket-btn ghost cup-bracket-nav" data-cup-bracket-next ${nextReady ? '' : 'disabled'} aria-label="Próxima fase" title="${nextReady ? 'Próxima fase' : 'Aguarde o sorteio da próxima fase'}">→</button>
    </div>`;
  };

  const cupBracketActionButtons = (phaseIndex, stage) => {
    const status = cupBracketPhaseStatus(stage);
    const statusClass = stage?.completed ? '' : (stage ? '' : 'is-wait');
    return `<div class="cup-bracket-actions">
      <span class="cup-bracket-status ${statusClass}">${status}</span>
      <button type="button" class="cup-bracket-btn ghost" data-cup-bracket-close>FECHAR</button>
      ${cupBracketPhaseNav(phaseIndex)}
    </div>`;
  };

  const renderCupCenterSummary = (phaseIndex, stage, { userNote = '', tieCount = 0, userTie = false } = {}) => {
    const status = cupBracketPhaseStatus(stage);
    const statusClass = stage?.completed ? 'is-done' : (stage ? '' : 'is-wait');
    return `<aside class="cup-tree-pot ${userTie ? 'has-user' : ''}">
      <div class="cup-tree-pot-info">
        <strong class="cup-tree-pot-phase">${stage?.name || `Fase ${phaseIndex}`}</strong>
        <p class="cup-tree-center-user">${userNote}</p>
        <p class="cup-tree-center-count">${tieCount} confronto${tieCount === 1 ? '' : 's'}</p>
        <span class="cup-tree-pot-status ${statusClass}">${status}</span>
      </div>
      <div class="cup-tree-center-nav">${cupBracketPhaseNav(phaseIndex)}</div>
    </aside>`;
  };

  const renderCupBracket = phaseIndex => {
    const userClub = getUserClub();
    const cupCompetition = getCupCompetition();
    const cupPhaseDefinitions = getCupPhaseDefinitions();
    const definition = cupPhaseDefinitions.find(item => item.index === phaseIndex);
    const stage = cupCompetition.stages.find(item => item.index === phaseIndex);
    const title = $('#cupBracketTitle'), actionsEl = $('#cupBracketActions'), body = $('#cupBracketBody');
    if (!title || !actionsEl || !body) return;
    title.textContent = stage?.name || definition?.name || `Fase ${phaseIndex}`;
    actionsEl.innerHTML = cupBracketActionButtons(phaseIndex, stage);
    if (!stage?.fixtures?.length) {
      body.innerHTML = '<div class="cup-bracket-empty">Aguardando sorteio desta fase.</div>';
      return;
    }
    let ties = [...new Set(stage.fixtures.map(game => game.tieId))]
      .map(tieId => cupBracketTieFromStage(stage, tieId))
      .filter(Boolean);
    const userTies = ties.filter(tie => tie.userTie);
    ties = [...userTies, ...ties.filter(tie => !tie.userTie)];
    if (ties.length === 1) {
      body.innerHTML = `<div class="cup-tree single-final"><div class="cup-tree-center"><div class="cup-tree-final-slot"><span>${stage.name}</span>${renderCupTreeMatch(ties[0])}<div class="cup-tree-center-nav">${cupBracketPhaseNav(phaseIndex)}</div></div></div></div>`;
      return;
    }
    const mid = Math.ceil(ties.length / 2);
    const left = ties.slice(0, mid);
    const right = ties.slice(mid);
    const userTie = userTies[0];
    const userNote = userTie
      ? userTie.winner === userClub
        ? `${userClub} classificado`
        : userTie.allDone
          ? `${userClub} eliminado`
          : `Confronto de ${userClub}`
      : 'Seu clube não está nesta fase';
    const centerHtml = phaseIndex === 5
      ? `${renderCupPhase5Pot()}<div class="cup-tree-center-nav">${cupBracketPhaseNav(phaseIndex)}</div>`
      : renderCupCenterSummary(phaseIndex, stage, { userNote, tieCount: ties.length, userTie: Boolean(userTie) });
    body.innerHTML = `<div class="cup-tree phase-only ${userTies.length ? 'has-user-path' : ''}">
      <div class="cup-tree-wing left"><div class="cup-tree-round"><div class="cup-tree-matches">${left.map(renderCupTreeMatch).join('')}</div></div></div>
      <div class="cup-tree-center">${centerHtml}</div>
      <div class="cup-tree-wing right"><div class="cup-tree-round"><div class="cup-tree-matches">${right.map(renderCupTreeMatch).join('')}</div></div></div>
    </div>`;
    requestAnimationFrame(() => {
      const focus = body.querySelector('[data-user-tie="1"]');
      focus?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  };

  const serieDBracketTieFromStage = (startRound, tieId) => {
    const userClub = getUserClub();
    const games = overlayPendingLiveKnockoutGames(
      serieDStageFixturesMerged(startRound)
        .filter(game => game.tieId === tieId)
        .sort((a, b) => (a.leg === 'IDA' ? 0 : 1) - (b.leg === 'IDA' ? 0 : 1)),
    );
    if (!games.length) return null;
    const sideA = games[0].home, sideB = games[0].away;
    const aggregate = cupTieAggregate(games);
    const allDone = games.every(game => game.completed);
    const played = games.some(game => game.completed);
    let winner = games.find(game => game.winner)?.winner || games.find(game => game.shootoutWinner)?.shootoutWinner || null;
    if (!winner && allDone) {
      const goalsA = aggregate.get(sideA) || 0, goalsB = aggregate.get(sideB) || 0;
      if (goalsA !== goalsB) winner = goalsA > goalsB ? sideA : sideB;
    }
    const penLabel = games.map(game => game.penalties || game.shootoutPenalties).find(Boolean) || '';
    const legMeta = games.map(game => {
      const details = fixtureDetails(game);
      const score = game.completed ? formatKnockoutFixtureScore(game, { separator: '-' }) : '×';
      return `${game.leg || 'JOGO'} ${details.display} ${score}`;
    }).join(' · ');
    return {
      tieId, sideA, sideB, winner, penLabel, legMeta, played, allDone,
      scoreA: played ? String(aggregate.get(sideA) || 0) : '—',
      scoreB: played ? String(aggregate.get(sideB) || 0) : '—',
      userTie: sideA === userClub || sideB === userClub,
    };
  };

  const serieDBracketPhaseNav = phaseIndex => {
    const serieDKnockoutPhaseDefs = getSerieDKnockoutPhaseDefs();
    const prevDef = serieDKnockoutPhaseDefs.find(item => item.index === phaseIndex - 1);
    const nextDef = serieDKnockoutPhaseDefs.find(item => item.index === phaseIndex + 1);
    const prevReady = Boolean(prevDef && serieDKnockoutPhaseMeta(prevDef).generated);
    const nextReady = Boolean(nextDef && serieDKnockoutPhaseMeta(nextDef).generated);
    return `<div class="cup-bracket-phase-nav" role="group" aria-label="Navegar fases">
      <button type="button" class="cup-bracket-btn ghost cup-bracket-nav" data-cup-bracket-prev ${prevReady ? '' : 'disabled'} aria-label="Fase anterior" title="${prevReady ? 'Fase anterior' : 'Não há fase anterior'}">←</button>
      <button type="button" class="cup-bracket-btn ghost cup-bracket-nav" data-cup-bracket-next ${nextReady ? '' : 'disabled'} aria-label="Próxima fase" title="${nextReady ? 'Próxima fase' : 'Aguarde o sorteio da próxima fase'}">→</button>
    </div>`;
  };

  const serieDClubPairKey = (a, b) => [String(a || ''), String(b || '')].sort().join('|');

  const serieDStagePairKeys = stageTies => new Set((stageTies || []).map(tie => serieDClubPairKey(tie.home, tie.away)));

  const sortChampionshipTiesUserFirst = ties => {
    const userTies = ties.filter(tie => tie.userTie);
    return [...userTies, ...ties.filter(tie => !tie.userTie)];
  };

  const splitSerieDSemiPlayoffTies = ties => {
    const nationalCompetitions = getNationalCompetitions();
    const stages = nationalCompetitions.D?.knockout?.stages || {};
    const semiKeys = serieDStagePairKeys(stages.semi);
    const playoffKeys = serieDStagePairKeys(stages.playoff);
    const semi = [], playoff = [], other = [];
    ties.forEach(tie => {
      const key = serieDClubPairKey(tie.sideA, tie.sideB);
      if (playoffKeys.has(key) && !semiKeys.has(key)) playoff.push(tie);
      else if (semiKeys.has(key)) semi.push(tie);
      else other.push(tie);
    });
    if (other.length) {
      const expectedSemi = Math.max(0, (stages.semi || []).length - semi.length);
      other.forEach((tie, index) => (index < expectedSemi ? semi : playoff).push(tie));
    }
    return { semi, playoff };
  };

  const renderSerieDBracket = phaseIndex => {
    const userClub = getUserClub();
    const nationalCompetitions = getNationalCompetitions();
    const serieDKnockoutPhaseDefs = getSerieDKnockoutPhaseDefs();
    const definition = serieDKnockoutPhaseDefs.find(item => item.index === phaseIndex) || serieDKnockoutPhaseDefs[0];
    const meta = serieDKnockoutPhaseMeta(definition);
    const title = $('#cupBracketTitle'), actionsEl = $('#cupBracketActions'), body = $('#cupBracketBody');
    if (!title || !actionsEl || !body) return;
    title.textContent = definition.name;
    const statusClass = meta.completed ? '' : (meta.generated ? '' : 'is-wait');
    actionsEl.innerHTML = `<div class="cup-bracket-actions">
      <span class="cup-bracket-status ${statusClass}">${meta.status}</span>
      <button type="button" class="cup-bracket-btn ghost" data-cup-bracket-close>FECHAR</button>
      ${serieDBracketPhaseNav(definition.index)}
    </div>`;
    if (!meta.generated) {
      body.innerHTML = '<div class="cup-bracket-empty">Aguardando sorteio desta fase.</div>';
      return;
    }
    const fixtures = serieDStageFixturesMerged(definition.startRound);
    let ties = [...new Set(fixtures.map(game => game.tieId).filter(Boolean))]
      .map(tieId => serieDBracketTieFromStage(definition.startRound, tieId))
      .filter(Boolean);
    const userTies = ties.filter(tie => tie.userTie);
    ties = [...userTies, ...ties.filter(tie => !tie.userTie)];
    const hasPlayoff = definition.key === 'semi' && Boolean(nationalCompetitions.D.knockout?.stages?.playoff?.length);
    if (hasPlayoff) {
      const { semi, playoff } = splitSerieDSemiPlayoffTies(ties);
      const renderGroup = (label, hint, groupTies) => !groupTies.length ? '' : `<section class="cup-tree-stage-group">
        <header><h4>${label}</h4><small>${hint}</small></header>
        <div class="cup-tree-matches">${sortChampionshipTiesUserFirst(groupTies).map(tie => renderCupTreeMatch(tie, { plain: true })).join('')}</div>
      </section>`;
      body.innerHTML = `<div class="cup-tree-split-stages">
        <div class="cup-tree-split-nav">${serieDBracketPhaseNav(definition.index)}</div>
        ${renderGroup('SEMIFINAL', 'Vencedores avançam à final · os 4 semifinalistas já estão garantidos na Série C na próxima temporada', semi)}
        ${renderGroup('REPESCAGEM', 'Vencedores conquistam o acesso à Série C', playoff)}
      </div>`;
      requestAnimationFrame(() => {
        const focus = body.querySelector('[data-user-tie="1"]');
        focus?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      return;
    }
    const stageLabel = definition.name;
    if (ties.length === 1) {
      body.innerHTML = `<div class="cup-tree single-final"><div class="cup-tree-center"><div class="cup-tree-final-slot"><span>${stageLabel}</span>${renderCupTreeMatch(ties[0], { plain: true })}<div class="cup-tree-center-nav">${serieDBracketPhaseNav(definition.index)}</div></div></div></div>`;
      return;
    }
    const mid = Math.ceil(ties.length / 2);
    const left = ties.slice(0, mid);
    const right = ties.slice(mid);
    const userTie = userTies[0];
    const userNote = userTie
      ? userTie.winner === userClub
        ? `${userClub} classificado`
        : userTie.allDone
          ? `${userClub} eliminado`
          : `Confronto de ${userClub}`
      : 'Seu clube não está nesta fase';
    const statusClassCenter = meta.completed ? 'is-done' : (meta.generated ? '' : 'is-wait');
    const centerHtml = `<aside class="cup-tree-pot ${userTie ? 'has-user' : ''}">
      <div class="cup-tree-pot-info">
        <strong class="cup-tree-pot-phase">${stageLabel}</strong>
        <p class="cup-tree-center-user">${userNote}</p>
        <p class="cup-tree-center-count">${ties.length} confronto${ties.length === 1 ? '' : 's'}</p>
        <span class="cup-tree-pot-status ${statusClassCenter}">${meta.status}</span>
      </div>
      <div class="cup-tree-center-nav">${serieDBracketPhaseNav(definition.index)}</div>
    </aside>`;
    body.innerHTML = `<div class="cup-tree phase-only ${userTies.length ? 'has-user-path' : ''}">
      <div class="cup-tree-wing left"><div class="cup-tree-round"><div class="cup-tree-matches">${left.map(tie => renderCupTreeMatch(tie, { plain: true })).join('')}</div></div></div>
      <div class="cup-tree-center">${centerHtml}</div>
      <div class="cup-tree-wing right"><div class="cup-tree-round"><div class="cup-tree-matches">${right.map(tie => renderCupTreeMatch(tie, { plain: true })).join('')}</div></div></div>
    </div>`;
    requestAnimationFrame(() => {
      const focus = body.querySelector('[data-user-tie="1"]');
      focus?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  };

  const setBracketCompetitionLabel = text => {
    const label = $('#cupBracketCompetitionLabel');
    if (label) label.textContent = text;
  };

  const openCupBracket = phaseIndex => {
    const index = Number(phaseIndex) || 1;
    bracketCompetition = 'CUP';
    setBracketRoundView(index);
    setBracketCompetitionLabel('CHAVEAMENTO · COPA DO BRASIL');
    markCupPhaseSelection(index);
    renderCupBracket(index);
    $('#cupBracketModal')?.classList.remove('hidden');
  };

  const openSerieDBracket = phaseIndex => {
    const index = Number(phaseIndex) || 1;
    bracketCompetition = 'SERIE_D';
    setBracketRoundView(index);
    setBracketCompetitionLabel('CHAVEAMENTO · SÉRIE D');
    markSerieDPhaseSelection(index);
    renderSerieDBracket(index);
    $('#cupBracketModal')?.classList.remove('hidden');
  };

  const closeCupBracket = () => { $('#cupBracketModal')?.classList.add('hidden'); };

  const goCupBracketPrevPhase = () => {
    const serieDKnockoutPhaseDefs = getSerieDKnockoutPhaseDefs();
    const cupCompetition = getCupCompetition();
    if (bracketCompetition === 'SERIE_D') {
      const current = Number(getBracketRoundView()) || 1;
      const prev = serieDKnockoutPhaseDefs.find(item => item.index === current - 1);
      if (!prev || !serieDKnockoutPhaseMeta(prev).generated) return;
      openSerieDBracket(prev.index);
      return;
    }
    const current = Number(getBracketRoundView()) || 1;
    const prev = cupCompetition.stages.find(item => item.index === current - 1);
    if (!prev?.fixtures?.length) return;
    openCupBracket(prev.index);
  };

  const goCupBracketNextPhase = () => {
    const serieDKnockoutPhaseDefs = getSerieDKnockoutPhaseDefs();
    const cupCompetition = getCupCompetition();
    if (bracketCompetition === 'SERIE_D') {
      const current = Number(getBracketRoundView()) || 1;
      const next = serieDKnockoutPhaseDefs.find(item => item.index === current + 1);
      if (!next || !serieDKnockoutPhaseMeta(next).generated) return;
      openSerieDBracket(next.index);
      return;
    }
    const current = Number(getBracketRoundView()) || 1;
    const next = cupCompetition.stages.find(item => item.index === current + 1);
    if (!next?.fixtures?.length) return;
    openCupBracket(next.index);
  };

  const refreshCupBracketIfOpen = () => {
    if ($('#cupBracketModal')?.classList.contains('hidden')) return;
    if (bracketCompetition === 'SERIE_D') renderSerieDBracket(getBracketRoundView());
    else renderCupBracket(getBracketRoundView() || getCupCompetition().currentPhase || 1);
  };

  const renderChampionshipPageTieSide = (name, side) => {
    const crest = teamCrestHtml(name, { className: 'championship-page-tie-crest' });
    const label = `<span class="championship-page-tie-club">${cupClubLabel(name, { tag: 'b' })}</span>`;
    return side === 'away'
      ? `<div class="championship-page-tie-side is-away">${label}${crest}</div>`
      : `<div class="championship-page-tie-side is-home">${crest}${label}</div>`;
  };

  const renderChampionshipPageTie = tie => {
    if (!tie) return '';
    const score = tie.played ? `${tie.scoreA} — ${tie.scoreB}` : '×';
    const winner = tie.winner ? `<strong class="winner-note">Classificado: ${tie.winner}${tie.penLabel ? ` · Pên. ${tie.penLabel}` : ''}</strong>` : '';
    return `<article class="championship-page-tie ${tie.userTie ? 'user-tie' : ''}">
      <div class="championship-page-tie-line">
        ${renderChampionshipPageTieSide(tie.sideA, 'home')}
        <em>${score}</em>
        ${renderChampionshipPageTieSide(tie.sideB, 'away')}
      </div>
      <div class="championship-page-tie-meta">
        <small>${tie.legMeta || 'Confronto'}</small>
        ${winner}
      </div>
    </article>`;
  };

  const wrapChampionshipPageTies = html => `<div class="championship-page-ties">${html}</div>`;

  const renderChampionshipPageFixtureCards = (games, { completed = false } = {}) => {
    const userClub = getUserClub();
    const userNationalTeamName = getUserNationalTeamName();
    const playable = filterPlayableRoundGames(games);
    if (!playable.length) return '';
    return playable.map(game => {
      const isUser = game.home === userClub || game.away === userClub || (userNationalTeamName && (game.home === userNationalTeamName || game.away === userNationalTeamName));
      const played = completed && game.homeGoals != null;
      const pen = knockoutShootoutLabel(game) || game.penalties || game.shootoutPenalties;
      const score = played ? `${game.homeGoals} — ${game.awayGoals}${pen ? ` (${pen})` : ''}` : '× — ×';
      return `<article class="championship-page-tie ${isUser ? 'user-tie' : ''} ${played ? '' : 'scheduled'}">
        <div class="championship-page-tie-line">
          ${renderChampionshipPageTieSide(game.home, 'home')}
          <em>${score}</em>
          ${renderChampionshipPageTieSide(game.away, 'away')}
        </div>
        ${isUser ? '<div class="championship-page-tie-meta"><small class="user-game-tag">SEU JOGO</small></div>' : ''}
      </article>`;
    }).join('');
  };

  const stateLeagueRoundCompleted = (competitionId, round, games) => {
    const saved = (stateLeagueEngine.history[parseStateCompetitionKey(competitionId)?.uf || ''] || []).find(item => item.round === round);
    return Boolean(saved?.games?.length) || games.every(game => game.completed);
  };

  const renderChampionshipPageFixturesOpenBtn = () =>
    `<section class="championship-page-round-panel is-collapsed"><button type="button" class="championship-page-fixtures-all-btn" data-state-fixtures-open>TODOS OS JOGOS</button></section>`;

  const renderChampionshipPageFixturesToolbar = ({ roundLimit, round } = {}) => {
    const atFirst = (round || 1) <= 1;
    const atLast = (round || 1) >= (roundLimit || 1);
    return `<div class="championship-page-fixtures-toolbar is-open">
      <button type="button" class="championship-page-fixtures-all-btn is-active" data-state-fixtures-open aria-expanded="true">TODOS OS JOGOS</button>
      <div class="championship-page-fixtures-round-nav" role="group" aria-label="Rodada">
        <button type="button" class="championship-page-fixtures-round-btn" data-state-fixtures-round-prev aria-label="Rodada anterior" ${atFirst ? 'disabled' : ''}>‹</button>
        <strong>Rodada ${round || 1}</strong>
        <button type="button" class="championship-page-fixtures-round-btn" data-state-fixtures-round-next aria-label="Próxima rodada" ${atLast ? 'disabled' : ''}>›</button>
      </div>
    </div>`;
  };

  const renderChampionshipPageRoundFixtures = (games, { completed = false, roundLabel = '', toolbarHtml = '' } = {}) => {
    const list = renderChampionshipPageFixtureCards(games, { completed });
    if (!list && !toolbarHtml) return '<div class="championship-page-empty">Nenhum jogo nesta rodada.</div>';
    return `<section class="championship-page-round-panel">${toolbarHtml}${list ? wrapChampionshipPageTies(list) : '<div class="championship-page-empty">Nenhum jogo nesta rodada.</div>'}</section>`;
  };

  const renderChampionshipPageTieGroup = (label, ties, hint = '') => {
    if (!ties.length) return '';
    const list = sortChampionshipTiesUserFirst(ties).map(renderChampionshipPageTie).join('');
    return `<section class="championship-page-tie-group">
      <header class="championship-page-tie-group-head">
        <h4>${label}</h4>
        ${hint ? `<small>${hint}</small>` : ''}
      </header>
      <div class="championship-page-ties">${list}</div>
    </section>`;
  };

  const seriesDGroupRowsForDisplay = groupIndex => {
    const userClub = getUserClub();
    const userDivision = getUserDivision();
    const currentRound = getCurrentRound();
    let rows = seriesDGroupRows(groupIndex).map(row => ({ ...row }));
    const pending = pendingRoundPreviewGames();
    if (pending?.length && userDivision === 'D' && pageSerieDGroup === groupIndex) {
      pending.forEach(game => { rows = applyTablePreviewToRows(rows, game); });
    }
    return rows;
  };

  const stateGroupRowsForDisplay = (competitionId, groupIndex) => {
    const userClub = getUserClub();
    let rows = stateGroupRows(competitionId, groupIndex).map(row => ({ ...row }));
    const liveMatchGame = getLiveMatchGame();
    if (getMatchFinished() && !getRoundCommitted() && liveMatchGame && isStateLeagueGame(liveMatchGame)) {
      const uf = String(liveMatchGame.stateUf || '').toUpperCase();
      const tier = Number(liveMatchGame.stateTier) || 1;
      const gameComp = stateCompetitionKey(uf, tier);
      if (gameComp === competitionId) {
        rows = applyTablePreviewToRows(rows, {
          home: liveMatchGame.home,
          away: liveMatchGame.away,
          homeGoals: Number(liveMatchGame.homeGoals ?? 0),
          awayGoals: Number(liveMatchGame.awayGoals ?? 0),
        });
      }
    }
    return rows;
  };

  const recopaFixtureForDisplay = () => {
    const recopaCompetition = getRecopaCompetition();
    const game = recopaCompetition?.fixture;
    if (!game) return null;
    return typeof cupGameForDisplay === 'function' ? cupGameForDisplay(game) : game;
  };

  const renderChampionshipPageKnockoutBody = () => {
    const recopaCompetition = getRecopaCompetition();
    const cupCompetition = getCupCompetition();
    const cupPhaseDefinitions = getCupPhaseDefinitions();
    const nationalCompetitions = getNationalCompetitions();
    const serieDKnockoutPhaseDefs = getSerieDKnockoutPhaseDefs();

    if (pageCompetition === 'RECOPA') {
      if (!recopaCompetition.ready) {
        return `<div class="championship-page-empty">${recopaNationalEmptyMessage(recopaCompetition)}</div>`;
      }
      if (recopaCompetition.skippedSameClub) {
        return `<div class="championship-page-empty">${recopaNationalEmptyMessage(recopaCompetition)}</div>`;
      }
      const game = recopaFixtureForDisplay();
      if (!game) {
        return `<div class="championship-page-empty">${recopaNationalEmptyMessage(recopaCompetition)}</div>`;
      }
      const list = renderChampionshipPageFixtureCards([game], { completed: recopaCompetition.complete || hasPendingLiveKnockoutPostMatch() });
      return list ? wrapChampionshipPageTies(list) : `<div class="championship-page-empty">${recopaNationalEmptyMessage(recopaCompetition)}</div>`;
    }
    if (pageCompetition === 'CUP') {
      const definition = cupPhaseDefinitions.find(item => item.index === pageCupPhase);
      const stage = cupCompetition.stages.find(item => item.index === pageCupPhase);
      if (!stage?.fixtures?.length) {
        return `<div class="championship-page-empty">Aguardando sorteio${definition ? ` da ${definition.name}` : ' desta fase'}.</div>`;
      }
      let ties = [...new Set(stage.fixtures.map(game => game.tieId))]
        .map(tieId => cupBracketTieFromStage(stage, tieId))
        .filter(Boolean);
      ties = sortChampionshipTiesUserFirst(ties);
      const list = ties.map(renderChampionshipPageTie).join('') || '<div class="championship-page-empty">Sem confrontos nesta fase.</div>';
      return wrapChampionshipPageTies(list);
    }
    const definition = serieDKnockoutPhaseDefs.find(item => item.index === pageSerieDPhase) || serieDKnockoutPhaseDefs[0];
    const meta = serieDKnockoutPhaseMeta(definition);
    if (!meta.generated) {
      return `<div class="championship-page-empty">Aguardando sorteio da ${definition.name.toLowerCase()}.</div>`;
    }
    const fixtures = serieDStageFixturesMerged(definition.startRound);
    let ties = [...new Set(fixtures.map(game => game.tieId).filter(Boolean))]
      .map(tieId => serieDBracketTieFromStage(definition.startRound, tieId))
      .filter(Boolean);
    const hasPlayoff = definition.key === 'semi' && Boolean(nationalCompetitions.D.knockout?.stages?.playoff?.length);
    if (hasPlayoff) {
      const { semi, playoff } = splitSerieDSemiPlayoffTies(ties);
      const groups = [
        renderChampionshipPageTieGroup('SEMIFINAL', semi, 'Vencedores avançam à final · os 4 semifinalistas já estão garantidos na Série C na próxima temporada'),
        renderChampionshipPageTieGroup('REPESCAGEM', playoff, 'Vencedores conquistam o acesso à Série C'),
      ].filter(Boolean).join('');
      return groups
        ? `<div class="championship-page-tie-groups">${groups}</div>`
        : '<div class="championship-page-empty">Sem confrontos nesta fase.</div>';
    }
    ties = sortChampionshipTiesUserFirst(ties);
    const list = ties.map(renderChampionshipPageTie).join('') || '<div class="championship-page-empty">Sem confrontos nesta fase.</div>';
    return wrapChampionshipPageTies(list);
  };

  const syncChampionshipSeasonSelect = () => {
    const select = $('#championshipPageSeasonSelect');
    if (!select) return;
    const careerSeason = getCareerSeason();
    if (pageViewSeason == null) pageViewSeason = careerSeason;
    const years = new Set([
      careerSeason,
      ...listSeasonArchiveYears({ seasonIndex: getSavedNewGame()?.seasonIndex }),
    ]);
    const sorted = [...years].sort((a, b) => b - a);
    const current = resolvedViewSeason();
    select.innerHTML = sorted.map(year => {
      const live = Number(year) === Number(careerSeason);
      const label = live ? `${year} · atual` : `${year} · arquivo`;
      return `<option value="${year}" ${Number(year) === Number(current) ? 'selected' : ''}>${label}</option>`;
    }).join('');
    select.classList.toggle('is-archive', isArchiveView());
  };

  const renderChampionshipPage = () => {
    const userClub = getUserClub();
    const userNationalTeamName = getUserNationalTeamName();
    const careerSeason = getCareerSeason();
    const worldCupCompetition = getWorldCupCompetition();
    const nationalCompetitions = getNationalCompetitions();
    const cupCompetition = getCupCompetition();
    const cupPhaseDefinitions = getCupPhaseDefinitions();
    const serieDGroups = getSerieDGroups();
    const currentRound = getCurrentRound();

    syncChampionshipSeasonSelect();
    if (isArchiveView() && !['A', 'B', 'C', 'D', 'CUP'].includes(pageCompetition)) {
      pageCompetition = 'A';
    }

    const tableCard = $('.championship-page-table');
    const sub = $('#championshipPageSub');
    const title = $('#championshipPageTitle');
    const titleTextEl = $('#championshipPageTitleText');
    const trophyEl = $('#championshipPageTrophy');
    const head = $('#championshipPageHead');
    const body = $('#leagueTable');
    const prevBtn = $('#championshipPagePrev');
    const nextBtn = $('#championshipPageNext');
    const menu = $('#championshipPagePickerMenu');
    const serieDModeTabs = $('#championshipPageSerieDMode');
    const stateTierPicker = $('#championshipPageStateTierPicker');
    const stateTierMenu = $('#championshipPageStateTierMenu');
    if (!body || !title) return;

    const isStateHub = pageCompetition === 'ESTADUAIS';
    const isStateComp = isStateChampionshipPage(pageCompetition);
    const stateParsed = isStateComp ? parseStateCompetitionKey(pageCompetition) : null;
    const stateTiers = stateParsed ? stateLeagueEngine.getTiersForUf(stateParsed.uf) : [];
    const showStateTierPicker = isStateComp && stateTiers.length > 1;
    stateTierPicker?.classList.toggle('hidden', !showStateTierPicker);
    if (stateTierMenu && showStateTierPicker) {
      stateTierMenu.innerHTML = stateTiers.map(tier => {
        const id = stateCompetitionKey(stateParsed.uf, tier);
        const active = id === pageCompetition;
        const division = stateLeagueEngine.getDivisionForBrowse(id, userClub);
        const teamCount = division?.teams?.length || 0;
        const lotteryTag = division?.lottery ? ' · Sorteio' : '';
        return `<button type="button" role="option" data-page-state-tier="${tier}" class="${active ? 'is-active' : ''}" aria-selected="${active ? 'true' : 'false'}">Divisão ${tier}${teamCount ? ` · ${teamCount} clubes` : ''}${lotteryTag}</button>`;
      }).join('');
    }
    if (!showStateTierPicker) setChampionshipPageStateTierPickerOpen(false);

    if (serieDModeTabs) {
      const showSerieDModes = pageCompetition === 'D' && isSerieDKnockoutUiActive();
      serieDModeTabs.classList.toggle('hidden', !showSerieDModes);
      if (showSerieDModes) {
        $$('#championshipPageSerieDMode [data-page-serie-d-mode]').forEach(button => {
          const active = button.dataset.pageSerieDMode === pageSerieDMode;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
      }
    }

    if (pageCompetition === 'D') {
      const lastGroup = Math.max(0, serieDGroups.length - 1);
      pageSerieDGroup = clamp(pageSerieDGroup, 0, lastGroup);
      if (pageSerieDMode === 'knockout') {
        if (!isSerieDKnockoutUiActive()) pageSerieDMode = 'groups';
        else {
          const maxPhase = Math.max(1, serieDMaxGeneratedPhaseIndex());
          pageSerieDPhase = clamp(pageSerieDPhase || 1, 1, maxPhase);
        }
      }
    } else if (pageCompetition === 'CUP') {
      pageCupPhase = clamp(pageCupPhase || cupCompetition.currentPhase || 1, 1, cupPhaseDefinitions.length);
    }

    const knockout = championshipPageIsKnockoutView();
    tableCard?.classList.toggle('is-knockout', knockout);

    if (menu) {
      const pickerActive = championshipPickerActiveId(pageCompetition);
      menu.innerHTML = getPageCompetitionOptions().map(option =>
        `<button type="button" role="option" data-page-competition="${option.id}" class="${option.id === pickerActive ? 'is-active' : ''}" aria-selected="${option.id === pickerActive ? 'true' : 'false'}"><span class="championship-page-picker-trophy-slot" data-trophy-key="${option.trophyKey || 'nacional'}" aria-hidden="true"></span><span>${option.label}</span></button>`,
      ).join('');
    }

    let subText = 'COMPETIÇÃO NACIONAL';
    let titleText = `BRASILEIRÃO SÉRIE ${pageCompetition}`;
    let canPrev = false, canNext = false;
    let stateInLeaguePhase = false;

    if (isArchiveView()) {
      subText = `ARQUIVO · TEMPORADA ${resolvedViewSeason()}`;
    }

    if (isStateHub) {
      subText = 'CAMPEONATOS ESTADUAIS';
      titleText = 'ESCOLHA O ESTADO';
    } else if (pageCompetition === 'RECOPA') {
      const recopaCompetition = getRecopaCompetition();
      const status = recopaCompetition.complete ? 'ENCERRADA' : recopaCompetition.ready ? 'EM DISPUTA' : 'AGUARDANDO';
      subText = `RECOPA NACIONAL · ${status}`;
      titleText = 'FINAL';
    } else if (pageCompetition === 'CUP') {
      const definition = cupPhaseDefinitions.find(item => item.index === pageCupPhase);
      const stage = cupCompetition.stages.find(item => item.index === pageCupPhase);
      const status = stage?.completed ? 'FASE CONCLUÍDA' : stage ? 'EM DISPUTA' : 'AGUARDANDO SORTEIO';
      subText = `COPA DO BRASIL · ${status}`;
      titleText = definition?.name || `Fase ${pageCupPhase}`;
      canPrev = pageCupPhase > 1;
      canNext = pageCupPhase < cupPhaseDefinitions.length;
    } else if (isStateComp) {
      const division = stateLeagueEngine.getDivisionForBrowse(pageCompetition, userClub);
      const roundLimit = stateLeagueEngine.getRoundLimit(pageCompetition);
      pageStateRound = clamp(pageStateRound || stateLeagueEngine.getCurrentRound(pageCompetition, userClub), 1, roundLimit);
      const leagueRounds = division?.leagueRoundCount ?? division?.groupRoundCount ?? 0;
      const paulista = isPaulistaFormat(division);
      stateInLeaguePhase = pageStateRound <= leagueRounds;
      const stateName = stateParsed ? ufLabel(stateParsed.uf) : 'Estadual';
      if (stateInLeaguePhase) {
        if (paulista) {
          subText = division?.complete ? 'ESTADUAL · ENCERRADO' : 'ESTADUAL · FASE DE GRUPOS';
          titleText = `${stateName} · GRUPO ${String.fromCharCode(65 + (pageStateGroup || 0))}`;
          canPrev = (pageStateGroup || 0) > 0;
          canNext = (pageStateGroup || 0) < 1 || roundLimit > leagueRounds;
        } else {
          subText = division?.complete ? 'ESTADUAL · ENCERRADO' : 'ESTADUAL · PONTOS CORRIDOS';
          titleText = `${stateName} · CLASSIFICAÇÃO`;
          canNext = roundLimit > leagueRounds;
        }
      } else {
        subText = division?.complete ? 'ESTADUAL · ENCERRADO' : 'ESTADUAL · MATA-MATA';
        titleText = stateLeagueEngine.getKnockoutPhaseTitle(pageCompetition, pageStateRound) || 'FINAL';
        canPrev = pageStateRound > 1;
        canNext = pageStateRound < roundLimit;
      }
    } else if (pageCompetition === 'CMU') {
      const groups = WORLD_CUP_GROUP_LETTERS;
      pageWorldCupGroup = clamp(pageWorldCupGroup || 0, 0, groups.length - 1);
      const activeGroup = groups[pageWorldCupGroup];
      const inKnockout = (pageWorldCupRound || 1) >= 4 || worldCupCompetition?.phase === 'knockout';
      if (inKnockout) {
        const phaseLabel = KNOCKOUT_SCHEDULE.find(item => item.round === (pageWorldCupRound || 4))?.phase || 'MATA-MATA';
        subText = worldCupCompetition?.complete ? 'COPA DO MUNDO · ENCERRADA' : 'COPA DO MUNDO · MATA-MATA';
        titleText = phaseLabel;
        canPrev = (pageWorldCupRound || 4) > 4;
        canNext = (pageWorldCupRound || 4) < 9;
      } else {
        subText = worldCupCompetition?.complete ? 'COPA DO MUNDO · ENCERRADA' : 'COPA DO MUNDO · FASE DE GRUPOS';
        titleText = `GRUPO ${activeGroup}`;
        canPrev = pageWorldCupGroup > 0;
        canNext = pageWorldCupGroup < groups.length - 1;
      }
    } else if (pageCompetition === 'D' && pageSerieDMode === 'knockout') {
      const serieDKnockoutPhaseDefs = getSerieDKnockoutPhaseDefs();
      const definition = serieDKnockoutPhaseDefs.find(item => item.index === pageSerieDPhase) || serieDKnockoutPhaseDefs[0];
      const meta = serieDKnockoutPhaseMeta(definition);
      const nextDef = serieDKnockoutPhaseDefs.find(item => item.index === pageSerieDPhase + 1);
      subText = `SÉRIE D · MATA-MATA · ${meta.status}`;
      titleText = definition.key === 'semi' && nationalCompetitions.D.knockout?.stages?.playoff?.length
        ? 'SEMIFINAL E REPESCAGEM'
        : definition.name;
      canPrev = true;
      canNext = Boolean(nextDef && serieDKnockoutPhaseMeta(nextDef).generated);
    } else if (pageCompetition === 'D') {
      const lastGroup = Math.max(0, serieDGroups.length - 1);
      subText = 'PRIMEIRA FASE · GRUPOS';
      titleText = `BRASILEIRÃO SÉRIE D · GRUPO A${pageSerieDGroup + 1}`;
      canPrev = pageSerieDGroup > 0;
      canNext = pageSerieDGroup < lastGroup || isSerieDKnockoutUiActive();
    } else {
      const competition = nationalCompetitions[pageCompetition];
      const clubsCount = pageCompetition === 'C'
        ? serieCClubsForSeason(careerSeason)
        : (competition?.teams?.length || competition?.clubs || 20);
      subText = 'COMPETIÇÃO NACIONAL';
      titleText = `BRASILEIRÃO SÉRIE ${pageCompetition}`;
      if (competition?.format) subText = `${clubsCount} CLUBES · PONTOS CORRIDOS`;
    }

    if (sub) sub.textContent = subText;
    if (titleTextEl) titleTextEl.textContent = titleText;
    else if (title) title.textContent = titleText;
    if (trophyEl) {
      void ensureCompetitionTrophy(pageCompetition, trophyEl);
      void preloadCompetitionTrophy(resolveChampionshipTrophyKey(pageCompetition));
    }
    if (prevBtn) prevBtn.disabled = !canPrev;
    if (nextBtn) nextBtn.disabled = !canNext;
    const lastGamesBtn = $('#championshipPageLastGamesBtn');
    if (lastGamesBtn) lastGamesBtn.classList.toggle('hidden', pageCompetition === 'CUP' || pageCompetition === 'RECOPA' || pageCompetition === 'CMU' || isStateHub || isArchiveView());

    if (isStateHub) {
      tableCard?.classList.remove('is-knockout');
      if (head) head.innerHTML = '';
      body.innerHTML = renderEstaduaisHub({ stateLeagueEngine, userClub, stateFlagMarkup });
    } else if (knockout) {
      if (head) head.innerHTML = '';
      body.innerHTML = renderChampionshipPageKnockoutBody();
    } else if (isStateComp && stateInLeaguePhase) {
      tableCard?.classList.remove('is-knockout');
      const division = stateLeagueEngine.getDivisionForBrowse(pageCompetition, userClub);
      const leagueRounds = division?.leagueRoundCount ?? division?.groupRoundCount ?? 0;
      const paulista = isPaulistaFormat(division);
      const groupIndex = paulista ? Math.max(0, Math.min(1, pageStateGroup || 0)) : 0;
      if (head) head.innerHTML = '<span>#</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>';
      const rows = stateGroupRowsForDisplay(pageCompetition, groupIndex);
      const parsed = parseStateCompetitionKey(pageCompetition);
      const tiers = parsed ? stateLeagueEngine.getTiersForUf(parsed.uf) : [];
      const zoneMeta = stateLeagueTableZoneMeta({
        paulista,
        tier: division?.tier || parsed?.tier || 1,
        tierCount: tiers.length || 1,
        rowCount: rows.length,
      });
      const rowsHtml = rows.map((row, index) => {
        const pos = index + 1;
        let zone = '';
        if (index < zoneMeta.promotionSlots) zone = 'promotion';
        else if (zoneMeta.relegationSlots > 0 && index >= rows.length - zoneMeta.relegationSlots) zone = 'relegation';
        return `<div class="league-row ${zone} ${row.club === userClub ? 'highlight' : ''}" data-club="${row.club}" role="button" tabindex="0"><span>${pos}</span><span class="club-link">${row.club}</span><span>${row.played}</span><span>${row.wins}</span><span>${row.draws}</span><span>${row.losses}</span><span>${row.goalDiff >= 0 ? '+' : ''}${row.goalDiff}</span><span>${row.points}</span></div>`;
      }).join('') || '<div class="championship-page-empty">Sem classificação disponível.</div>';
      const legendParts = [
        `<span><i class="promotion" aria-hidden="true"></i>${zoneMeta.promotionLabel}</span>`,
      ];
      if (zoneMeta.relegationLabel) {
        legendParts.push(`<span><i class="relegation" aria-hidden="true"></i>${zoneMeta.relegationLabel}</span>`);
      }
      const zoneLegend = `<div class="championship-page-zone-legend">${legendParts.join('')}</div>`;
      let gamesHtml = '';
      if (!pageStateFixturesOpen) {
        gamesHtml = renderChampionshipPageFixturesOpenBtn();
      } else {
        const roundLimit = stateLeagueEngine.getRoundLimit(pageCompetition);
        const toolbar = renderChampionshipPageFixturesToolbar({ roundLimit, round: pageStateRound });
        const games = stateLeagueEngine.getRoundGamesForBrowse(pageCompetition, pageStateRound, { simulateMatch: simulateRoundMatch });
        const completed = stateLeagueRoundCompleted(pageCompetition, pageStateRound, games);
        gamesHtml = renderChampionshipPageRoundFixtures(games, { completed, toolbarHtml: toolbar });
      }
      body.innerHTML = `<div class="championship-page-league-body"><div class="championship-page-standings-block">${rowsHtml}${zoneLegend}</div>${gamesHtml}</div>`;
    } else if (isStateComp) {
      tableCard?.classList.add('is-knockout');
      const games = stateLeagueEngine.getRoundGamesForBrowse(pageCompetition, pageStateRound, { simulateMatch: simulateRoundMatch });
      const saved = (stateLeagueEngine.history[parseStateCompetitionKey(pageCompetition)?.uf || ''] || []).find(item => item.round === pageStateRound);
      const completed = Boolean(saved?.games?.length) || games.every(game => game.completed);
      const roundLimit = stateLeagueEngine.getRoundLimit(pageCompetition);
      let gamesHtml = '';
      if (!pageStateFixturesOpen) {
        gamesHtml = `${renderChampionshipPageRoundFixtures(games, { completed })}${renderChampionshipPageFixturesOpenBtn()}`;
      } else {
        const toolbar = renderChampionshipPageFixturesToolbar({ roundLimit, round: pageStateRound });
        gamesHtml = renderChampionshipPageRoundFixtures(games, { completed, toolbarHtml: toolbar });
      }
      if (head) head.innerHTML = '';
      body.innerHTML = gamesHtml;
    } else if (pageCompetition === 'CMU') {
      tableCard?.classList.remove('is-knockout');
      const inKnockout = (pageWorldCupRound || 1) >= 4 || worldCupCompetition?.phase === 'knockout';
      if (inKnockout) {
        const round = pageWorldCupRound || 4;
        const games = getWorldCupAllFixtures(worldCupCompetition).filter(game => Number(game.round) === round);
        const phaseLabel = KNOCKOUT_SCHEDULE.find(item => item.round === round)?.phase || `Rodada ${round}`;
        const completed = games.length > 0 && games.every(game => game.completed || game.homeGoals != null);
        if (head) head.innerHTML = '';
        body.innerHTML = renderChampionshipPageRoundFixtures(games, { completed, roundLabel: phaseLabel });
      } else {
        const activeGroup = WORLD_CUP_GROUP_LETTERS[pageWorldCupGroup] || 'A';
        const rows = worldCupCompetition ? computeGroupStandings(activeGroup, worldCupCompetition.groupFixtures, gameRandom) : [];
        if (head) head.innerHTML = '<span>#</span><span>SELEÇÃO</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>';
        const rowsHtml = rows.map((row, index) => {
          const pos = index + 1;
          const advance = index < 2 ? 'promotion' : '';
          return `<div class="league-row ${advance} ${row.name === userNationalTeamName ? 'highlight' : ''}" data-national-team="${row.code || ''}" role="button" tabindex="0"><span>${pos}</span><span class="club-link">${row.name}</span><span>${row.played || 0}</span><span>${row.wins || 0}</span><span>${row.draws || 0}</span><span>${row.losses || 0}</span><span>${row.gd >= 0 ? '+' : ''}${row.gd || 0}</span><span>${row.points || 0}</span></div>`;
        }).join('') || '<div class="championship-page-empty">Sem classificação disponível.</div>';
        const zoneLegend = '<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>2 primeiros · Avançam no grupo</span></div>';
        body.innerHTML = rowsHtml + zoneLegend;
      }
    } else if (isArchiveView() && ['A', 'B', 'C', 'D', 'CUP'].includes(pageCompetition)) {
      tableCard?.classList.toggle('is-knockout', pageCompetition === 'CUP');
      const archive = getViewArchive();
      const year = resolvedViewSeason();
      if (!archive) {
        if (head) head.innerHTML = '';
        body.innerHTML = `<div class="championship-page-empty">Arquivo da temporada ${year} ainda não está disponível neste dispositivo. Ele é gravado ao encerrar a temporada (com servidor, sincroniza depois).</div>`;
      } else if (pageCompetition === 'CUP') {
        if (head) head.innerHTML = '';
        const cup = archive.cupCompetition;
        const champ = cup?.champion || archive.champions?.CUP || '—';
        const stages = (cup?.stages || []).map(stage => {
          const fixtures = (stage.fixtures || []).map(game => {
            const score = game.homeGoals != null ? `${game.homeGoals}–${game.awayGoals}` : '×';
            const date = game.date ? String(game.date).slice(0, 10) : '';
            return `<div class="championship-page-archive-fixture"><strong>${game.home}</strong> ${score} <strong>${game.away}</strong>${date ? `<small>${date}</small>` : ''}</div>`;
          }).join('') || '<div class="championship-page-empty">Sem jogos nesta fase.</div>';
          return `<section class="championship-page-archive-stage"><header><strong>${stage.name || `Fase ${stage.index}`}</strong><small>${stage.completed ? 'Concluída' : ''}</small></header>${fixtures}</section>`;
        }).join('');
        body.innerHTML = `<div class="championship-page-archive-banner">Temporada ${year} · arquivo · Campeão: <strong>${champ}</strong></div>${stages || '<div class="championship-page-empty">Sem dados da Copa neste arquivo.</div>'}`;
      } else {
        if (head) head.innerHTML = '<span>#</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>';
        const rows = [...(archive.standings?.[pageCompetition] || [])]
          .sort((a, b) => b.points - a.points || b.wins - a.wins || b.goalDiff - a.goalDiff);
        const champ = archive.champions?.[pageCompetition];
        const rowsHtml = rows.map((row, index) => {
          const pos = index + 1;
          const zone = pageCompetition === 'D'
            ? (index < 4 ? 'promotion' : '')
            : leagueClassificationZone(pageCompetition, index, rows.length);
          return `<div class="league-row ${zone} ${row.club === userClub ? 'highlight' : ''}" data-club="${row.club}" role="button" tabindex="0"><span>${pos}</span><span class="club-link">${row.club}</span><span>${row.played}</span><span>${row.wins}</span><span>${row.draws}</span><span>${row.losses}</span><span>${row.goalDiff >= 0 ? '+' : ''}${row.goalDiff}</span><span>${row.points}</span></div>`;
        }).join('') || '<div class="championship-page-empty">Sem classificação neste arquivo.</div>';
        const banner = `<div class="championship-page-archive-banner">Temporada ${year} · arquivo${champ ? ` · Campeão: <strong>${champ}</strong>` : ''} · somente leitura</div>`;
        const zoneLegend = pageCompetition === 'A'
          ? '<div class="championship-page-zone-legend"><span><i class="relegation" aria-hidden="true"></i>Z4 · Rebaixamento</span></div>'
          : pageCompetition === 'B'
            ? '<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>G4 · Acesso</span><span><i class="relegation" aria-hidden="true"></i>Z4 · Rebaixamento</span></div>'
            : pageCompetition === 'C'
              ? `<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>G4 · Acesso</span><span><i class="relegation" aria-hidden="true"></i>Z${serieCRelegationZone} · Rebaixamento</span></div>`
              : pageCompetition === 'D'
                ? '<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>4 primeiros · Avançam do grupo</span></div>'
                : '';
        body.innerHTML = banner + rowsHtml + zoneLegend;
      }
    } else {
      if (head) head.innerHTML = '<span>#</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>';
      const rows = ['A', 'B', 'C'].includes(pageCompetition)
        ? standingsRowsForDisplay(pageCompetition)
        : pageCompetition === 'D'
          ? seriesDGroupRowsForDisplay(pageSerieDGroup)
          : [...(nationalCompetitions[pageCompetition]?.standings || [])].sort((a, b) => b.points - a.points || b.wins - a.wins || b.goalDiff - a.goalDiff);
      const rowsHtml = rows.map((row, index) => {
        const pos = index + 1;
        const zone = pageCompetition === 'D'
          ? (index < 4 ? 'promotion' : '')
          : leagueClassificationZone(pageCompetition, index, rows.length);
        return `<div class="league-row ${zone} ${row.club === userClub ? 'highlight' : ''}" data-club="${row.club}" role="button" tabindex="0"><span>${pos}</span><span class="club-link">${row.club}</span><span>${row.played}</span><span>${row.wins}</span><span>${row.draws}</span><span>${row.losses}</span><span>${row.goalDiff >= 0 ? '+' : ''}${row.goalDiff}</span><span>${row.points}</span></div>`;
      }).join('') || '<div class="championship-page-empty">Sem classificação disponível.</div>';
      const zoneLegend = pageCompetition === 'A'
        ? '<div class="championship-page-zone-legend"><span><i class="relegation" aria-hidden="true"></i>Z4 · Rebaixamento</span></div>'
        : pageCompetition === 'B'
          ? '<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>G4 · Acesso</span><span><i class="relegation" aria-hidden="true"></i>Z4 · Rebaixamento</span></div>'
          : pageCompetition === 'C'
            ? `<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>G4 · Acesso</span><span><i class="relegation" aria-hidden="true"></i>Z${serieCRelegationZone} · Rebaixamento</span></div>`
            : pageCompetition === 'D'
              ? `<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>4 primeiros · Avançam do grupo</span>${isSerieDKnockoutUiActive() && pageSerieDGroup === Math.max(0, serieDGroups.length - 1) ? '<span>› Mata-mata disponível</span>' : ''}</div>`
              : '';
      body.innerHTML = rowsHtml + zoneLegend;
    }
    setChampionshipPagePickerOpen(false);
    setChampionshipPageStateTierPickerOpen(false);
  };

  const selectChampionshipPageCompetition = competitionId => {
    const userClub = getUserClub();
    const currentRound = getCurrentRound();
    const worldCupCompetition = getWorldCupCompetition();
    const cupCompetition = getCupCompetition();
    const cupPhaseDefinitions = getCupPhaseDefinitions();
    const userSerieDGroupIndex = getUserSerieDGroupIndex();

    const valid = getPageCompetitionOptions().some(option => option.id === competitionId) || isStateChampionshipPage(competitionId);
    if (!valid) return;
    pageCompetition = competitionId;
    if (competitionId === 'CMU') {
      const letter = findUserWorldCupGroup(worldCupCompetition, getUserNationalTeamName());
      pageWorldCupGroup = Math.max(0, WORLD_CUP_GROUP_LETTERS.indexOf(letter || 'A'));
      const userFixtures = worldCupCompetition ? getWorldCupAllFixtures(worldCupCompetition).filter(game => game.home === getUserNationalTeamName() || game.away === getUserNationalTeamName()) : [];
      const pending = userFixtures.find(game => !game.completed && game.homeGoals == null);
      pageWorldCupRound = pending?.round || userFixtures.filter(game => game.completed || game.homeGoals != null).at(-1)?.round || 1;
    }
    if (isStateChampionshipPage(competitionId)) {
      pageStateRound = stateLeagueEngine.getCurrentRound(competitionId, userClub);
      pageStateGroup = 0;
      pageStateFixturesMode = 'round';
      pageStateFixturesOpen = false;
    }
    if (competitionId === 'ESTADUAIS') {
      pageStateGroup = 0;
    }
    if (competitionId === 'CUP') pageCupPhase = clamp(cupCompetition.currentPhase || 1, 1, cupPhaseDefinitions.length);
    if (competitionId === 'D') {
      if (isSerieDKnockoutUiActive() && currentRound > SERIE_D_GROUP_ROUNDS) {
        pageSerieDMode = 'knockout';
        pageSerieDPhase = serieDPhaseIndexForRound(currentRound);
      } else {
        pageSerieDMode = 'groups';
        pageSerieDGroup = Math.max(0, userSerieDGroupIndex);
      }
    }
    setChampionshipPagePickerOpen(false);
    setChampionshipPageStateTierPickerOpen(false);
    renderChampionshipPage();
  };

  const getChampionshipPageState = () => ({
    pageCompetition,
    pageCupPhase,
    pageStateRound,
    pageStateGroup,
    pageSerieDMode,
    pageSerieDPhase,
    pageSerieDGroup,
    pageWorldCupGroup,
    pageWorldCupRound,
  });

  const patchChampionshipPageState = patch => {
    if (patch.pageCupPhase !== undefined) pageCupPhase = patch.pageCupPhase;
    if (patch.pageStateRound !== undefined) pageStateRound = patch.pageStateRound;
    if (patch.pageStateGroup !== undefined) pageStateGroup = patch.pageStateGroup;
    if (patch.pageSerieDMode !== undefined) pageSerieDMode = patch.pageSerieDMode;
    if (patch.pageSerieDPhase !== undefined) pageSerieDPhase = patch.pageSerieDPhase;
    if (patch.pageSerieDGroup !== undefined) pageSerieDGroup = patch.pageSerieDGroup;
    if (patch.pageWorldCupGroup !== undefined) pageWorldCupGroup = patch.pageWorldCupGroup;
    if (patch.pageWorldCupRound !== undefined) pageWorldCupRound = patch.pageWorldCupRound;
  };

  const { focusChampionshipPageForUserGame, focusChampionshipPageForNextUserGame } = createChampionshipPageFocus({
    getUserDivision,
    getUserClub,
    getClubs,
    clamp,
    cupPhaseDefinitions: getCupPhaseDefinitions(),
    stateLeagueEngine,
    isStateLeagueGame,
    isStateChampionshipPage,
    isKnockoutShootoutCompetition,
    isUserFixture,
    getRealClub,
    stateCompetitionKey,
    getPageState: getChampionshipPageState,
    patchPageState: patchChampionshipPageState,
    selectChampionshipPageCompetition,
    renderChampionshipPage,
    getCurrentRound,
  });

  const openChampionshipStandings = () => {
    router.openView('table');
    focusChampionshipPageForUserGame(getLiveMatchGame());
  };

  const stepChampionshipPageNav = step => {
    const userClub = getUserClub();
    const currentRound = getCurrentRound();
    const cupPhaseDefinitions = getCupPhaseDefinitions();
    const serieDGroups = getSerieDGroups();
    const userSerieDGroupIndex = getUserSerieDGroupIndex();

    if (isStateChampionshipPage(pageCompetition)) {
      const division = stateLeagueEngine.getDivisionForBrowse(pageCompetition, userClub);
      const leagueRounds = division?.leagueRoundCount ?? division?.groupRoundCount ?? 0;
      const limit = stateLeagueEngine.getRoundLimit(pageCompetition);
      const inLeaguePhase = (pageStateRound || 1) <= leagueRounds;
      if (inLeaguePhase) {
        if (isPaulistaFormat(division)) {
          if (step > 0) {
            if (pageStateGroup < 1) pageStateGroup += 1;
            else if (limit > leagueRounds) pageStateRound = leagueRounds + 1;
          } else if (step < 0 && pageStateGroup > 0) {
            pageStateGroup -= 1;
          }
        } else if (step > 0 && limit > leagueRounds) {
          pageStateRound = leagueRounds + 1;
        } else if (step < 0) {
          pageStateRound = clamp((pageStateRound || 1) - 1, 1, leagueRounds);
        }
        renderChampionshipPage();
        return;
      }
      if (step < 0 && pageStateRound <= leagueRounds + 1) {
        if (isPaulistaFormat(division)) {
          pageStateRound = leagueRounds;
          pageStateGroup = 1;
        } else {
          pageStateRound = leagueRounds;
        }
        renderChampionshipPage();
        return;
      }
      pageStateRound = clamp((pageStateRound || 1) + step, 1, limit);
    } else if (pageCompetition === 'CMU') {
      const worldCupCompetition = getWorldCupCompetition();
      const inKnockout = (pageWorldCupRound || 1) >= 4 || worldCupCompetition?.phase === 'knockout';
      if (inKnockout) {
        pageWorldCupRound = clamp((pageWorldCupRound || 4) + step, 4, 9);
      } else if (step > 0) {
        pageWorldCupGroup = Math.min(WORLD_CUP_GROUP_LETTERS.length - 1, (pageWorldCupGroup || 0) + 1);
      } else {
        pageWorldCupGroup = Math.max(0, (pageWorldCupGroup || 0) - 1);
      }
    } else if (pageCompetition === 'CUP') {
      pageCupPhase = clamp(pageCupPhase + step, 1, cupPhaseDefinitions.length);
    } else if (pageCompetition === 'D') {
      const lastGroup = Math.max(0, serieDGroups.length - 1);
      const serieDKnockoutPhaseDefs = getSerieDKnockoutPhaseDefs();
      if (pageSerieDMode === 'knockout') {
        if (step < 0) {
          if (pageSerieDPhase > 1) pageSerieDPhase -= 1;
          else {
            pageSerieDMode = 'groups';
            pageSerieDGroup = lastGroup;
          }
        } else {
          const nextDef = serieDKnockoutPhaseDefs.find(item => item.index === pageSerieDPhase + 1);
          if (nextDef && serieDKnockoutPhaseMeta(nextDef).generated) pageSerieDPhase += 1;
        }
      } else if (step > 0) {
        if (pageSerieDGroup < lastGroup) pageSerieDGroup += 1;
        else if (isSerieDKnockoutUiActive()) {
          pageSerieDMode = 'knockout';
          pageSerieDPhase = 1;
        }
      } else {
        pageSerieDGroup = Math.max(0, pageSerieDGroup - 1);
      }
    } else return;
    renderChampionshipPage();
  };

  let handlersBound = false;

  const bindHandlers = () => {
    if (handlersBound) return;
    handlersBound = true;

    onClick('#openChampionship', () => router.openView('table'));
    router.onView('table', () => {
      if (isWorldCupDashboardActive() && getWorldCupCompetition()) {
        selectChampionshipPageCompetition('CMU');
        return;
      }
      focusChampionshipPageForNextUserGame(getNextPendingUserEntry());
    });

    onClick('#championshipPagePickerBtn', event => {
      event.stopPropagation();
      setChampionshipPagePickerOpen(!pagePickerOpen);
    });
    const seasonSelect = $('#championshipPageSeasonSelect');
    if (seasonSelect && !seasonSelect.dataset.bound) {
      seasonSelect.dataset.bound = '1';
      seasonSelect.addEventListener('change', () => {
        const year = Number(seasonSelect.value);
        pageViewSeason = Number.isFinite(year) ? year : getCareerSeason();
        if (isArchiveView() && !['A', 'B', 'C', 'D', 'CUP'].includes(pageCompetition)) {
          pageCompetition = 'A';
        }
        renderChampionshipPage();
      });
    }
    onClick('#championshipPageStateTierBtn', event => {
      event.stopPropagation();
      setChampionshipPageStateTierPickerOpen(!pageStateTierPickerOpen);
    });
    onClick('#championshipPageStateTierMenu', event => {
      const option = event.target.closest('[data-page-state-tier]');
      if (!option || !isStateChampionshipPage(pageCompetition)) return;
      const parsed = parseStateCompetitionKey(pageCompetition);
      if (!parsed) return;
      const tier = Number(option.dataset.pageStateTier) || 1;
      selectChampionshipPageCompetition(stateCompetitionKey(parsed.uf, tier));
    });
    onClick('#championshipPagePickerMenu', event => {
      const option = event.target.closest('[data-page-competition]');
      if (!option) return;
      selectChampionshipPageCompetition(option.dataset.pageCompetition);
    });
    onClick('#championshipPageSerieDMode', event => {
      const button = event.target.closest('[data-page-serie-d-mode]');
      if (!button || pageCompetition !== 'D' || !isSerieDKnockoutUiActive()) return;
      const mode = button.dataset.pageSerieDMode === 'groups' ? 'groups' : 'knockout';
      if (mode === pageSerieDMode) return;
      pageSerieDMode = mode;
      if (mode === 'knockout') pageSerieDPhase = serieDPhaseIndexForRound(getCurrentRound());
      else pageSerieDGroup = Math.max(0, getUserSerieDGroupIndex());
      renderChampionshipPage();
    });
    onClick('#leagueTable', event => {
      const btn = event.target.closest('[data-estadual-uf]');
      if (btn && pageCompetition === 'ESTADUAIS' && !btn.disabled) {
        selectChampionshipPageCompetition(stateCompetitionKey(btn.dataset.estadualUf, 1));
        return;
      }
      if (!isStateChampionshipPage(pageCompetition)) return;
      const roundLimit = stateLeagueEngine.getRoundLimit(pageCompetition);
      if (event.target.closest('[data-state-fixtures-open]')) {
        pageStateFixturesOpen = true;
        pageStateFixturesMode = 'round';
        pageStateRound = clamp(pageStateRound || stateLeagueEngine.getCurrentRound(pageCompetition, getUserClub()), 1, roundLimit);
        renderChampionshipPage();
        return;
      }
      if (!pageStateFixturesOpen) return;
      if (event.target.closest('[data-state-fixtures-round-prev]')) {
        pageStateFixturesMode = 'round';
        pageStateRound = clamp((pageStateRound || 1) - 1, 1, roundLimit);
        renderChampionshipPage();
        return;
      }
      if (event.target.closest('[data-state-fixtures-round-next]')) {
        pageStateFixturesMode = 'round';
        pageStateRound = clamp((pageStateRound || 1) + 1, 1, roundLimit);
        renderChampionshipPage();
      }
    });
    onClick('#championshipPagePrev', () => stepChampionshipPageNav(-1));
    onClick('#championshipPageNext', () => stepChampionshipPageNav(1));
    onClick('#championshipPageLastGamesBtn', () => openChampionshipLastGames());

    onClick('#closeCupBracket', () => closeCupBracket());
    onClick('#cupBracketModal', event => {
      if (event.target.id === 'cupBracketModal') { closeCupBracket(); return; }
      if (event.target.closest('[data-cup-bracket-close]')) { closeCupBracket(); return; }
      if (event.target.closest('[data-cup-bracket-prev]:not(:disabled)')) { goCupBracketPrevPhase(); return; }
      if (event.target.closest('[data-cup-bracket-next]:not(:disabled)')) { goCupBracketNextPhase(); return; }
    });

    const competitionRulesModal = createCompetitionRulesModalFeature({ $, onClick });
    competitionRulesModal.bindHandlers({
      getPageCompetition: () => pageCompetition,
      getCareerSeason,
    });

    document.addEventListener('click', event => {
      if (pagePickerOpen) {
        if (event.target.closest?.('#championshipPagePickerBtn') || event.target.closest?.('#championshipPagePickerMenu') || event.target.closest?.('.championship-page-picker:not(.championship-page-state-tier-picker)')) return;
        setChampionshipPagePickerOpen(false);
      }
      if (pageStateTierPickerOpen) {
        if (event.target.closest?.('#championshipPageStateTierBtn') || event.target.closest?.('#championshipPageStateTierMenu') || event.target.closest?.('#championshipPageStateTierPicker')) return;
        setChampionshipPageStateTierPickerOpen(false);
      }
    });
    window.addEventListener('resize', () => {
      if (pagePickerOpen) placeChampionshipPagePickerMenu();
      if (pageStateTierPickerOpen) placeChampionshipPageStateTierPickerMenu();
    });
    document.querySelector('main > .view')?.addEventListener('scroll', () => {
      if (pagePickerOpen) placeChampionshipPagePickerMenu();
      if (pageStateTierPickerOpen) placeChampionshipPageStateTierPickerMenu();
    }, { passive: true });
  };

  const setOpenChampionshipLastGames = fn => {
    openChampionshipLastGames = typeof fn === 'function' ? fn : () => {};
  };

  const init = () => {
    bindHandlers();
    renderChampionshipPage();
  };

  return {
    init,
    bindHandlers,
    renderChampionshipPage,
    selectChampionshipPageCompetition,
    getChampionshipPageState,
    patchChampionshipPageState,
    openChampionshipStandings,
    focusChampionshipPageForUserGame,
    focusChampionshipPageForNextUserGame,
    championshipPageIsKnockoutView,
    setChampionshipPagePickerOpen,
    setOpenChampionshipLastGames,
    openCupBracket,
    openSerieDBracket,
    closeCupBracket,
    goCupBracketPrevPhase,
    goCupBracketNextPhase,
    refreshCupBracketIfOpen,
  };
}
