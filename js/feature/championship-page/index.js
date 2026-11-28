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
import { QUALIFIERS_PAGE_ID, qualifiersBody, qualifiersCurrentMatchday, qualifiersHeader } from './qualifiers-view.js';
import { CONMEBOL_PAGE_IDS, conmebolBody, conmebolHeader, conmebolSteps, conmebolUserStep, isConmebolPage } from './conmebol-view.js';

/**
 * Campeonatos (view table) — classificação, mata-mata inline e modal de chaveamento.
 */
export function resolveChampionshipPageRenderMode({ archiveView = false, knockoutView = false } = {}) {
  if (archiveView) return 'archive';
  return knockoutView ? 'knockout' : 'league';
}

export function worldCupViewModelFromArchive(archive) {
  const source = archive?.worldCupCompetition;
  if (!source) return null;
  const fixtures = (Array.isArray(source.fixtures) ? source.fixtures : []).map(game => ({
    ...game,
    homeCode: game.homeCode || game.home,
    awayCode: game.awayCode || game.away,
  }));
  return {
    ...source,
    phase: source.phase || (source.complete ? 'complete' : 'groups'),
    groupFixtures: fixtures.filter(game => game.group || Number(game.round) <= 3),
    knockoutFixtures: fixtures.filter(game => !game.group && Number(game.round) >= 4),
  };
}

export function stateLeagueViewModelFromArchive(archive, competitionId) {
  const parsed = parseStateCompetitionKey(competitionId);
  if (!parsed) return null;
  const divisions = archive?.stateLeagueSnapshot?.competitions?.[parsed.uf] || [];
  return divisions.find(item => Number(item?.tier || 1) === Number(parsed.tier || 1)) || null;
}

const ARCHIVE_SERIE_D_PHASES = [
  { index: 1, name: '2ª FASE', startRound: 11 },
  { index: 2, name: '3ª FASE', startRound: 13 },
  { index: 3, name: 'OITAVAS DE FINAL', startRound: 15 },
  { index: 4, name: 'QUARTAS DE FINAL', startRound: 17 },
  { index: 5, name: 'SEMIFINAL E REPESCAGEM', startRound: 19 },
  { index: 6, name: 'FINAL', startRound: 21 },
];

export function serieDViewModelFromArchive(archive) {
  const source = archive?.serieDCompetition;
  if (!source) return null;
  const standings = Array.isArray(source.standings) ? source.standings : [];
  const groups = (Array.isArray(source.groups) ? source.groups : []).map((clubs, groupIndex) => ({
    groupIndex,
    clubs: [...(clubs || [])],
    standings: (clubs || [])
      .map(club => standings.find(row => row.club === club) || {
        club, played: 0, wins: 0, draws: 0, losses: 0, goalDiff: 0, points: 0,
      })
      .sort((a, b) => b.points - a.points || b.wins - a.wins || b.goalDiff - a.goalDiff),
    fixtures: (source.fixtures || [])
      .slice(0, SERIE_D_GROUP_ROUNDS)
      .flat()
      .filter(game => Number(game.groupIndex) === groupIndex || (clubs || []).includes(game.home)),
  }));
  const phases = ARCHIVE_SERIE_D_PHASES.map(phase => ({
    ...phase,
    fixtures: [
      ...((source.fixtures || [])[phase.startRound - 1] || []),
      ...((source.fixtures || [])[phase.startRound] || []),
    ],
  })).filter(phase => phase.fixtures.length);
  return { ...source, groups, phases };
}

import { createChampionshipV2 } from './v2.js';

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
    getSerieCView,
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
    overlayPendingLiveGames = games => games,
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
  const getConmebolEdition = deps.getConmebolEdition || (() => null);
  const pageConmebolStep = { libertadores: 0, sudamericana: 0 };
  const getConmebolQualifiers = deps.getConmebolQualifiers || (() => null);
  const getQualifiersHighlight = deps.getQualifiersHighlight || (() => 'BRA');
  let pageQualifiersMatchday = 1;
  const escapeConmebol = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  let pageCompetition = getUserDivision();
  let pageStateRound = 1;
  let pageStateGroup = 0;
  let pageStateFixturesMode = 'round';
  let pageStateFixturesOpen = false;
  let pageSerieDGroup = Math.max(0, getUserSerieDGroupIndex());
  let pageSerieDMode = 'groups';
  // Série C tem três fases com tabelas próprias (fase 1, grupos, final).
  let pageSerieCPhase = 1;
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
    // Mundial de Clubes só no ano do torneio (2029, 2033…).
    const base = getConmebolEdition()?.mundial
      ? [...PAGE_COMPETITION_OPTIONS, { id: 'MUNDIAL', label: 'Mundial de Clubes', trophyKey: 'world-cup' }]
      : PAGE_COMPETITION_OPTIONS;
    const worldCupCompetition = worldCupForView();
    const archiveHasWorldCup = !!getViewArchive()?.worldCupCompetition;
    if (!worldCupCompetition && !archiveHasWorldCup) return base;
    const cmu = { id: 'CMU', label: 'Copa do Mundo', trophyKey: 'world-cup' };
    if (base.some(option => option.id === 'CMU')) return base;
    return [cmu, ...base];
  };
  const worldCupForView = () =>
    isArchiveView() ? worldCupViewModelFromArchive(getViewArchive()) : getWorldCupCompetition();

  const archiveSupportsCompetition = competition => {
    const archive = getViewArchive();
    if (!archive) return ['A', 'B', 'C', 'D', 'CUP'].includes(competition);
    if (['A', 'B', 'C', 'D', 'CUP'].includes(competition)) return true;
    if (competition === 'RECOPA') return !!archive.recopaCompetition;
    if (competition === 'CMU') return !!archive.worldCupCompetition;
    if (competition === 'ESTADUAIS') {
      return Object.keys(archive.stateLeagueSnapshot?.competitions || archive.stateLeagueResults || {}).length > 0;
    }
    if (isStateChampionshipPage(competition)) {
      const parsed = parseStateCompetitionKey(competition);
      return !!parsed && (
        Array.isArray(archive.stateLeagueSnapshot?.competitions?.[parsed.uf])
        || Array.isArray(archive.stateLeagueResults?.[parsed.uf])
      );
    }
    return false;
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

  /* ===== Chaveamento v2 (cb2): abas de fase, seu caminho, árvore e grade paginada ===== */
  const bracketView = { page: 0, filter: 'all', phase: null };
  const cbEsc = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const shortPhase = name => String(name || '').replace('OITAVAS DE FINAL', 'OITAVAS').replace('QUARTAS DE FINAL', 'QUARTAS').replace('SEMIFINAL', 'SEMI');

  const bracketModel = () => {
    if (bracketCompetition === 'SERIE_D') {
      const nationalCompetitions = getNationalCompetitions();
      return {
        label: 'SÉRIE D',
        rule: 'Ida e volta · empate no agregado vai para os pênaltis',
        phases: getSerieDKnockoutPhaseDefs().map(def => {
          const meta = serieDKnockoutPhaseMeta(def);
          let ties = [];
          if (meta.generated) {
            const fixtures = serieDStageFixturesMerged(def.startRound);
            ties = [...new Set(fixtures.map(game => game.tieId).filter(Boolean))]
              .map(tieId => serieDBracketTieFromStage(def.startRound, tieId)).filter(Boolean);
            if (def.key === 'semi' && nationalCompetitions.D.knockout?.stages?.playoff?.length) {
              const { semi, playoff } = splitSerieDSemiPlayoffTies(ties);
              ties = [...semi.map(tie => ({ ...tie, group: 'SEMIFINAL' })), ...playoff.map(tie => ({ ...tie, group: 'REPESCAGEM · ACESSO À SÉRIE C' }))];
            }
          }
          return { index: def.index, name: def.name, teams: def.teams, generated: meta.generated, completed: meta.completed, ties, date: null, twoLegged: true };
        }),
      };
    }
    const cup = getCupCompetition();
    return {
      label: 'COPA DO BRASIL',
      phases: getCupPhaseDefinitions().map(def => {
        const stage = cup.stages.find(item => item.index === def.index);
        const ties = stage?.fixtures?.length
          ? [...new Set(stage.fixtures.map(game => game.tieId))].map(tieId => cupBracketTieFromStage(stage, tieId)).filter(Boolean)
          : [];
        return { index: def.index, name: stage?.name || def.name, teams: def.teams, generated: ties.length > 0, completed: !!stage?.completed, ties, date: def.dates?.[0] || null, twoLegged: !!def.twoLegged };
      }),
    };
  };

  const cbDivision = name => getClubs?.()?.[name]?.division || null;
  const cbTie = (tie, { compact = false } = {}) => {
    const userClub = getUserClub();
    const line = (name, score) => {
      const lost = tie.winner && tie.winner !== name;
      return `<div class="cb2-side${tie.winner === name ? ' is-winner' : ''}${lost ? ' is-out' : ''}${name === userClub ? ' is-user' : ''}">${teamCrestHtml(name, { className: 'cb2-crest' })}<b class="club-link" data-club="${cbEsc(name)}" role="button" tabindex="0">${cbEsc(name)}</b>${!compact && cbDivision(name) ? `<small>${cbDivision(name)}</small>` : ''}<em>${cbEsc(score)}</em></div>`;
    };
    const meta = [tie.legMeta, tie.penLabel ? `pênaltis ${tie.penLabel}` : ''].filter(Boolean).join(' · ');
    return `<article class="cb2-tie${tie.userTie ? ' is-user' : ''}">${line(tie.sideA, tie.scoreA)}${line(tie.sideB, tie.scoreB)}<small class="cb2-meta">${cbEsc(meta)}</small></article>`;
  };
  const cbPlaceholder = () => '<article class="cb2-tie is-tbd"><span>a definir</span></article>';

  const renderBracketV2 = phaseIndex => {
    const model = bracketModel();
    const userClub = getUserClub();
    const phase = model.phases.find(item => item.index === phaseIndex) || model.phases.find(item => item.generated) || model.phases[0];
    if (!phase) return;
    if (bracketView.phase !== phase.index) { bracketView.phase = phase.index; bracketView.page = 0; bracketView.filter = 'all'; }
    setBracketRoundView(phase.index);
    const title = $('#cupBracketTitle'), actionsEl = $('#cupBracketActions'), body = $('#cupBracketBody');
    if (!title || !actionsEl || !body) return;
    const fmtDate = date => (date ? new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '');
    title.textContent = phase.generated ? `${phase.name.charAt(0)}${phase.name.slice(1).toLowerCase()} · ${phase.ties.length} confronto${phase.ties.length === 1 ? '' : 's'}` : phase.name.charAt(0) + phase.name.slice(1).toLowerCase();
    // Abas das fases com status.
    const tabs = model.phases.map(item => {
      const status = item.completed ? 'done' : item.generated ? 'live' : 'wait';
      const tip = item.completed ? 'Concluída' : item.generated ? 'Em disputa' : `Aguardando sorteio${item.date ? ` · jogos a partir de ${fmtDate(item.date)}` : ''}`;
      return `<button type="button" class="cb2-phase is-${status}${item.index === phase.index ? ' is-active' : ''}" data-bracket-phase="${item.index}" ${item.generated ? '' : 'disabled'} title="${tip}"><i></i>${cbEsc(shortPhase(item.name))}</button>`;
    }).join('');
    // Seu caminho.
    const steps = model.phases.filter(item => item.ties.some(tie => tie.userTie)).map(item => {
      const tie = item.ties.find(entry => entry.userTie);
      const opp = tie.sideA === userClub ? tie.sideB : tie.sideA;
      const own = tie.sideA === userClub ? tie.scoreA : tie.scoreB;
      const other = tie.sideA === userClub ? tie.scoreB : tie.scoreA;
      const state = tie.winner === userClub ? ['✓', 'is-win'] : tie.winner ? ['✗', 'is-loss'] : ['EM DISPUTA', 'is-live'];
      return `<span class="cb2-step"><b>${cbEsc(shortPhase(item.name))}</b>${teamCrestHtml(opp, { className: 'cb2-step-crest' })}<span>${cbEsc(own)} × ${cbEsc(other)}</span><i class="${state[1]}">${state[0]}</i></span>`;
    });
    const alive = steps.length && !model.phases.some(item => item.ties.some(tie => tie.userTie && tie.winner && tie.winner !== userClub));
    const nextPhase = alive ? model.phases.find(item => !item.ties.some(tie => tie.userTie) && item.index > Math.max(...model.phases.filter(p => p.ties.some(t => t.userTie)).map(p => p.index))) : null;
    if (nextPhase && model.phases.find(item => item.ties.some(tie => tie.userTie && tie.winner === userClub && item.index === nextPhase.index - 1))) {
      steps.push(`<span class="cb2-step is-next"><b>${cbEsc(shortPhase(nextPhase.name))}</b><span>aguardando sorteio</span></span>`);
    }
    const path = steps.length
      ? `<div class="cb2-path"><span class="cb2-path-label">SEU CAMINHO</span>${steps.join('<i class="cb2-arrow">›</i>')}</div>`
      : `<div class="cb2-path is-empty"><span class="cb2-path-label">SEU CAMINHO</span><span>${cbEsc(userClub)} ainda não entrou nesta competição.</span></div>`;
    const rule = model.rule || (phase.twoLegged ? 'Ida e volta · empate no agregado vai para os pênaltis' : 'Jogo único · empate vai para os pênaltis');
    actionsEl.innerHTML = `<nav class="cb2-phases" role="tablist">${tabs}</nav>${path}`;
    // Árvore: das oitavas (16 clubes) até a final, quando não há repescagem.
    const treeStartIndex = model.phases.find(item => item.teams === 16)?.index;
    const treePhases = treeStartIndex != null ? model.phases.filter(item => item.index >= treeStartIndex) : [];
    const useTree = treePhases.length && phase.index >= treeStartIndex && !treePhases.some(item => item.ties.some(tie => tie.group));
    if (useTree) {
      const expected = item => Math.max(1, Math.round((item.teams || 2) / 2));
      const half = (item, side) => {
        const n = expected(item);
        const list = item.ties.length ? item.ties : Array.from({ length: n }, () => null);
        const mid = Math.ceil(list.length / 2);
        const slice = side === 'left' ? list.slice(0, mid) : list.slice(mid);
        return slice.map(tie => (tie ? cbTie(tie, { compact: true }) : cbPlaceholder())).join('');
      };
      const nonFinal = treePhases.filter(item => item.teams > 2);
      const final = treePhases.find(item => item.teams === 2);
      const col = (item, side) => `<div class="cb2-col${item.index === phase.index ? ' is-active' : ''}"><span class="cb2-col-title">${cbEsc(shortPhase(item.name))}</span><div class="cb2-col-ties">${half(item, side)}</div></div>`;
      const finalTie = final?.ties?.[0];
      const narrow = document.documentElement.classList.contains('is-mobile') || (Number(globalThis.innerWidth) || 1440) <= 1100;
      if (narrow) {
        // Celular: uma fase inteira por bloco, das oitavas até a final.
        const fullCol = item => {
          const n = expected(item);
          const inner = item.ties.length
            ? item.ties.map(tie => cbTie(tie, { compact: true })).join('')
            : `<article class="cb2-tie is-tbd"><span>${n} confronto${n === 1 ? '' : 's'} a definir${item.date ? ` · a partir de ${fmtDate(item.date)}` : ''}</span></article>`;
          return `<div class="cb2-col${item.index === phase.index ? ' is-active' : ''}"><span class="cb2-col-title">${cbEsc(shortPhase(item.name))}</span><div class="cb2-col-ties">${inner}</div></div>`;
        };
        body.innerHTML = `<div class="cb2-tree">${treePhases.map(fullCol).join('')}</div><p class="cb2-rule">${cbEsc(rule)}</p>`;
        return;
      }
      body.innerHTML = `<div class="cb2-tree">
        ${nonFinal.map(item => col(item, 'left')).join('')}
        <div class="cb2-final${final && final.index === phase.index ? ' is-active' : ''}"><svg class="cb2-cup" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v3a6 6 0 0 1-4 5.7V15h3v3H7v-3h3v-3.3A6 6 0 0 1 6 6z"/><path d="M4 4h2v3H4zM18 4h2v3h-2z" opacity=".6"/></svg><span class="cb2-col-title">FINAL</span>${finalTie ? cbTie(finalTie, { compact: true }) : cbPlaceholder()}${final?.date ? `<small>a partir de ${fmtDate(final.date)}</small>` : ''}</div>
        ${[...nonFinal].reverse().map(item => col(item, 'right')).join('')}
      </div><p class="cb2-rule">${cbEsc(rule)}</p>`;
      return;
    }
    // Grade paginada.
    if (!phase.generated) {
      body.innerHTML = `<div class="cb2-empty">Sorteio desta fase ainda não aconteceu${phase.date ? ` · jogos a partir de ${fmtDate(phase.date)}` : ''}.</div>`;
      return;
    }
    const divRank = name => ({ A: 1, B: 2, C: 3, D: 4 }[cbDivision(name)] || 5);
    const isUpset = tie => tie.winner && divRank(tie.winner) > divRank(tie.winner === tie.sideA ? tie.sideB : tie.sideA);
    let ties = [...phase.ties.filter(tie => tie.userTie), ...phase.ties.filter(tie => !tie.userTie)];
    const upsets = ties.filter(isUpset).length;
    if (bracketView.filter === 'upsets') ties = ties.filter(isUpset);
    const PAGE = 12;
    const shown = ties.slice(0, PAGE * (bracketView.page + 1));
    const groups = [...new Set(shown.map(tie => tie.group || ''))];
    const grid = groups.map(group => `${group ? `<div class="cb2-group">${cbEsc(group)}</div>` : ''}<div class="cb2-grid">${shown.filter(tie => (tie.group || '') === group).map(tie => cbTie(tie)).join('')}</div>`).join('');
    const filters = upsets
      ? `<nav class="cb2-filters"><button type="button" data-bracket-filter="all" class="${bracketView.filter === 'all' ? 'is-active' : ''}">TODOS</button><button type="button" data-bracket-filter="upsets" class="${bracketView.filter === 'upsets' ? 'is-active' : ''}">ZEBRAS · ${upsets}</button></nav>`
      : '<span></span>';
    const more = ties.length > shown.length ? `<button type="button" class="cb2-more" data-bracket-more>VER MAIS ${Math.min(PAGE, ties.length - shown.length)}</button>` : '';
    body.innerHTML = `<div class="cb2-gridbar">${filters}<small>${cbEsc(rule)}</small></div>${grid || '<div class="cb2-empty">Nenhum confronto neste filtro.</div>'}<div class="cb2-pager"><small>Mostrando ${shown.length} de ${ties.length}</small>${more}</div>`;
  };

  const setBracketCompetitionLabel = text => {
    const label = $('#cupBracketCompetitionLabel');
    if (label) label.textContent = text;
  };

  const openCupBracket = phaseIndex => {
    const index = Number(phaseIndex) || 1;
    bracketCompetition = 'CUP';
    setBracketRoundView(index);
    setBracketCompetitionLabel(`CHAVEAMENTO · COPA DO BRASIL ${getCareerSeason?.() || ''}`.trim());
    markCupPhaseSelection(index);
    renderBracketV2(index);
    $('#cupBracketModal')?.classList.remove('hidden');
  };

  const openSerieDBracket = phaseIndex => {
    const index = Number(phaseIndex) || 1;
    bracketCompetition = 'SERIE_D';
    setBracketRoundView(index);
    setBracketCompetitionLabel(`CHAVEAMENTO · SÉRIE D ${getCareerSeason?.() || ''}`.trim());
    markSerieDPhaseSelection(index);
    renderBracketV2(index);
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
    renderBracketV2(Number(getBracketRoundView()) || (bracketCompetition === 'SERIE_D' ? 1 : getCupCompetition().currentPhase || 1));
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
      const played = game.homeGoals != null && (completed || game.completed || game.awayGoals != null);
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
        // Placar final ao vivo (o jogo só grava homeGoals no AVANÇAR).
        const shown = overlayPendingLiveGames([liveMatchGame])[0] || liveMatchGame;
        if (shown.homeGoals != null && shown.awayGoals != null) {
          rows = applyTablePreviewToRows(rows, {
            home: liveMatchGame.home,
            away: liveMatchGame.away,
            homeGoals: Number(shown.homeGoals),
            awayGoals: Number(shown.awayGoals),
          });
        }
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
    const worldCupCompetition = worldCupForView();
    const nationalCompetitions = getNationalCompetitions();
    const cupCompetition = getCupCompetition();
    const cupPhaseDefinitions = getCupPhaseDefinitions();
    const archive = getViewArchive();
    const archiveSerieD = isArchiveView() ? serieDViewModelFromArchive(archive) : null;
    const serieDGroups = archiveSerieD?.groups || getSerieDGroups();
    const currentRound = getCurrentRound();

    syncChampionshipSeasonSelect();
    if (isArchiveView() && !archiveSupportsCompetition(pageCompetition)) {
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
    const stateTiers = stateParsed
      ? (isArchiveView()
          ? (archive?.stateLeagueSnapshot?.competitions?.[stateParsed.uf] || []).map(item => Number(item.tier || 1))
          : stateLeagueEngine.getTiersForUf(stateParsed.uf))
      : [];
    const showStateTierPicker = isStateComp && stateTiers.length > 1;
    stateTierPicker?.classList.toggle('hidden', !showStateTierPicker);
    if (stateTierMenu && showStateTierPicker) {
      stateTierMenu.innerHTML = stateTiers.map(tier => {
        const id = stateCompetitionKey(stateParsed.uf, tier);
        const active = id === pageCompetition;
        const division = isArchiveView()
          ? stateLeagueViewModelFromArchive(archive, id)
          : stateLeagueEngine.getDivisionForBrowse(id, userClub);
        const teamCount = division?.teams?.length || 0;
        const lotteryTag = division?.lottery ? ' · Sorteio' : '';
        return `<button type="button" role="option" data-page-state-tier="${tier}" class="${active ? 'is-active' : ''}" aria-selected="${active ? 'true' : 'false'}">Divisão ${tier}${teamCount ? ` · ${teamCount} clubes` : ''}${lotteryTag}</button>`;
      }).join('');
    }
    if (!showStateTierPicker) setChampionshipPageStateTierPickerOpen(false);

    if (serieDModeTabs) {
      const showSerieDModes = pageCompetition === 'D'
        && (isArchiveView() ? archiveSerieD?.phases?.length > 0 : isSerieDKnockoutUiActive());
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
      const effectiveGroups = isArchiveView() ? (archiveSerieD?.groups || []) : serieDGroups;
      const lastGroup = Math.max(0, effectiveGroups.length - 1);
      pageSerieDGroup = clamp(pageSerieDGroup, 0, lastGroup);
      if (pageSerieDMode === 'knockout') {
        if (isArchiveView() && !archiveSerieD?.phases?.length) pageSerieDMode = 'groups';
        else if (!isArchiveView() && !isSerieDKnockoutUiActive()) pageSerieDMode = 'groups';
        else {
          const maxPhase = isArchiveView()
            ? Math.max(1, archiveSerieD.phases.at(-1)?.index || 1)
            : Math.max(1, serieDMaxGeneratedPhaseIndex());
          pageSerieDPhase = clamp(pageSerieDPhase || 1, 1, maxPhase);
        }
      }
    } else if (pageCompetition === 'CUP') {
      pageCupPhase = clamp(pageCupPhase || cupCompetition.currentPhase || 1, 1, cupPhaseDefinitions.length);
    }

    const renderMode = resolveChampionshipPageRenderMode({
      archiveView: isArchiveView(),
      knockoutView: championshipPageIsKnockoutView(),
    });
    const knockout = renderMode === 'knockout';
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
      titleText = pageCompetition === 'CUP'
        ? 'COPA DO BRASIL'
        : pageCompetition === 'RECOPA'
          ? 'RECOPA NACIONAL'
          : pageCompetition === 'CMU'
            ? 'COPA DO MUNDO'
            : pageCompetition === 'ESTADUAIS' || isStateComp
              ? 'CAMPEONATOS ESTADUAIS'
              : `BRASILEIRÃO SÉRIE ${pageCompetition}`;
      if (pageCompetition === 'CUP') {
        const stages = getViewArchive()?.cupCompetition?.stages || [];
        const indexes = stages.map(stage => Number(stage.index)).filter(Number.isFinite);
        const min = Math.min(...indexes, 1);
        const max = Math.max(...indexes, 1);
        pageCupPhase = clamp(pageCupPhase || min, min, max);
        const stage = stages.find(item => Number(item.index) === Number(pageCupPhase));
        titleText = stage?.name || `FASE ${pageCupPhase}`;
        canPrev = pageCupPhase > min;
        canNext = pageCupPhase < max;
      } else if (pageCompetition === 'CMU') {
        const inKnockout = (pageWorldCupRound || 1) >= 4;
        if (inKnockout) {
          titleText = KNOCKOUT_SCHEDULE.find(item => item.round === pageWorldCupRound)?.phase || 'MATA-MATA';
          canPrev = pageWorldCupRound > 4;
          canNext = pageWorldCupRound < 9;
        } else {
          const activeGroup = WORLD_CUP_GROUP_LETTERS[pageWorldCupGroup] || 'A';
          titleText = `GRUPO ${activeGroup}`;
          canPrev = pageWorldCupGroup > 0;
          canNext =
            pageWorldCupGroup < WORLD_CUP_GROUP_LETTERS.length - 1
            || (worldCupCompetition?.knockoutFixtures || []).length > 0;
        }
      } else if (pageCompetition === 'D' && archiveSerieD) {
        if (pageSerieDMode === 'knockout' && archiveSerieD.phases.length) {
          const phase = archiveSerieD.phases.find(item => item.index === pageSerieDPhase)
            || archiveSerieD.phases[0];
          pageSerieDPhase = phase.index;
          titleText = phase.name;
          canPrev = pageSerieDPhase > archiveSerieD.phases[0].index;
          canNext = pageSerieDPhase < archiveSerieD.phases.at(-1).index;
        } else {
          const lastGroup = Math.max(0, archiveSerieD.groups.length - 1);
          pageSerieDGroup = clamp(pageSerieDGroup, 0, lastGroup);
          titleText = `BRASILEIRÃO SÉRIE D · GRUPO A${pageSerieDGroup + 1}`;
          canPrev = pageSerieDGroup > 0;
          canNext = pageSerieDGroup < lastGroup || archiveSerieD.phases.length > 0;
        }
      } else if (isStateComp) {
        const division = stateLeagueViewModelFromArchive(archive, pageCompetition);
        const leagueRounds = division?.leagueRoundCount ?? division?.groupRoundCount ?? 0;
        const roundLimit = Math.max(1, division?.fixtures?.length || leagueRounds);
        pageStateRound = clamp(pageStateRound || 1, 1, roundLimit);
        stateInLeaguePhase = pageStateRound <= leagueRounds;
        const paulista = isPaulistaFormat(division);
        const stateName = stateParsed ? ufLabel(stateParsed.uf) : 'Estadual';
        if (stateInLeaguePhase) {
          titleText = paulista
            ? `${stateName} · GRUPO ${String.fromCharCode(65 + (pageStateGroup || 0))}`
            : `${stateName} · CLASSIFICAÇÃO`;
          canPrev = paulista && pageStateGroup > 0;
          canNext = (paulista && pageStateGroup < 1) || roundLimit > leagueRounds;
        } else {
          const games = division?.fixtures?.[pageStateRound - 1] || [];
          titleText = games[0]?.phase
            ? String(games[0].phase).toUpperCase()
            : pageStateRound === roundLimit ? 'FINAL' : 'MATA-MATA';
          canPrev = pageStateRound > leagueRounds;
          canNext = pageStateRound < roundLimit;
        }
      }
    } else if (isStateHub) {
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
    } else if (pageCompetition === QUALIFIERS_PAGE_ID) {
      const header = qualifiersHeader(getConmebolQualifiers(), pageQualifiersMatchday);
      pageQualifiersMatchday = header.matchday;
      subText = header.subText;
      titleText = header.titleText;
      canPrev = header.canPrev;
      canNext = header.canNext;
    } else if (isConmebolPage(pageCompetition)) {
      const competitionId = CONMEBOL_PAGE_IDS[pageCompetition];
      const header = conmebolHeader(getConmebolEdition(), competitionId, pageConmebolStep[competitionId]);
      pageConmebolStep[competitionId] = header.step;
      subText = header.subText;
      titleText = header.titleText;
      canPrev = header.canPrev;
      canNext = header.canNext;
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
        canNext =
          pageWorldCupGroup < groups.length - 1
          || (worldCupCompetition?.knockoutFixtures || []).length > 0;
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
      if (pageCompetition === 'C') {
        const phases = (getSerieCView?.()?.available || [1]);
        pageSerieCPhase = phases.includes(pageSerieCPhase) ? pageSerieCPhase : phases[0];
        const label = { 1: 'FASE 1', 2: 'GRUPOS', 3: 'FINAL' }[pageSerieCPhase];
        const index = phases.indexOf(pageSerieCPhase);
        subText = phases.length > 1
          ? `${clubsCount} CLUBES · ${label}`
          : `${clubsCount} CLUBES · TURNO ÚNICO`;
        titleText = `BRASILEIRÃO SÉRIE C · ${label}`;
        canPrev = index > 0;
        canNext = index < phases.length - 1;
      }
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
    if (lastGamesBtn) lastGamesBtn.classList.toggle('hidden', pageCompetition === 'CUP' || pageCompetition === 'RECOPA' || pageCompetition === 'CMU' || pageCompetition === QUALIFIERS_PAGE_ID || isConmebolPage(pageCompetition) || isStateHub || isArchiveView());

    if (isStateHub && !isArchiveView()) {
      tableCard?.classList.remove('is-knockout');
      if (head) head.innerHTML = '';
      body.innerHTML = renderEstaduaisHub({ stateLeagueEngine, userClub, stateFlagMarkup });
    } else if (knockout) {
      if (head) head.innerHTML = '';
      body.innerHTML = renderChampionshipPageKnockoutBody();
    } else if (isStateComp && stateInLeaguePhase && !isArchiveView()) {
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
    } else if (isStateComp && !isArchiveView()) {
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
    } else if (pageCompetition === QUALIFIERS_PAGE_ID && !isArchiveView()) {
      const view = qualifiersBody({ qualifiers: getConmebolQualifiers(), matchday: pageQualifiersMatchday, highlightCode: getQualifiersHighlight(), escapeHtml: escapeConmebol });
      tableCard?.classList.toggle('is-knockout', !view.head);
      if (head) head.innerHTML = view.head;
      body.innerHTML = view.html;
    } else if (isConmebolPage(pageCompetition) && !isArchiveView()) {
      const competitionId = CONMEBOL_PAGE_IDS[pageCompetition];
      const view = conmebolBody({
        edition: getConmebolEdition(),
        competitionId,
        stepIndex: pageConmebolStep[competitionId],
        userClub,
        renderFixtures: renderChampionshipPageRoundFixtures,
        escapeHtml: escapeConmebol,
      });
      tableCard?.classList.toggle('is-knockout', !view.head);
      if (head) head.innerHTML = view.head;
      body.innerHTML = view.html;
    } else if (pageCompetition === 'CMU') {
      tableCard?.classList.remove('is-knockout');
      const inKnockout = (pageWorldCupRound || 1) >= 4;
      if (inKnockout) {
        const round = pageWorldCupRound || 4;
        const games = getWorldCupAllFixtures(worldCupCompetition).filter(game => Number(game.round) === round);
        const phaseLabel = KNOCKOUT_SCHEDULE.find(item => item.round === round)?.phase || `Rodada ${round}`;
        const completed = games.length > 0 && games.every(game => game.completed || game.homeGoals != null);
        if (head) head.innerHTML = '';
        body.innerHTML = renderChampionshipPageRoundFixtures(games, { completed, roundLabel: phaseLabel });
      } else {
        const activeGroup = WORLD_CUP_GROUP_LETTERS[pageWorldCupGroup] || 'A';
        const rows = worldCupCompetition
          ? (typeof deps.getWorldCupGroupRows === 'function' && !isArchiveView() ? deps.getWorldCupGroupRows(activeGroup) : computeGroupStandings(activeGroup, overlayPendingLiveGames(worldCupCompetition.groupFixtures), gameRandom))
          : [];
        const groupGames = overlayPendingLiveGames((worldCupCompetition?.groupFixtures || []).filter(game => game.group === activeGroup));
        if (head) head.innerHTML = '<span>#</span><span>SELEÇÃO</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>';
        const rowsHtml = rows.map((row, index) => {
          const pos = index + 1;
          const advance = index < 2 ? 'promotion' : '';
          return `<div class="league-row ${advance} ${row.name === userNationalTeamName ? 'highlight' : ''}" data-national-team="${row.code || ''}" role="button" tabindex="0"><span>${pos}</span><span class="club-link">${row.name}</span><span>${row.played || 0}</span><span>${row.wins || 0}</span><span>${row.draws || 0}</span><span>${row.losses || 0}</span><span>${row.gd >= 0 ? '+' : ''}${row.gd || 0}</span><span>${row.points || 0}</span></div>`;
        }).join('') || '<div class="championship-page-empty">Sem classificação disponível.</div>';
        const zoneLegend = '<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>2 primeiros · Avançam no grupo</span></div>';
        const results = renderChampionshipPageRoundFixtures(groupGames, {
          completed: groupGames.length > 0 && groupGames.every(game => game.completed || game.homeGoals != null),
        });
        body.innerHTML = `<div class="championship-page-league-body"><div class="championship-page-standings-block">${rowsHtml}${zoneLegend}</div>${results}</div>`;
      }
    } else if (isArchiveView() && archiveSupportsCompetition(pageCompetition)) {
      tableCard?.classList.toggle('is-knockout', pageCompetition === 'CUP');
      const archive = getViewArchive();
      const year = resolvedViewSeason();
      if (!archive) {
        if (head) head.innerHTML = '';
        body.innerHTML = `<div class="championship-page-empty">Arquivo da temporada ${year} ainda não está disponível neste dispositivo. Ele é gravado ao encerrar a temporada (com servidor, sincroniza depois).</div>`;
      } else if (pageCompetition === 'CUP') {
        if (head) head.innerHTML = '';
        const cup = archive.cupCompetition;
        const stage = (cup?.stages || []).find(item => Number(item.index) === Number(pageCupPhase));
        const fixtures = stage?.fixtures || [];
        body.innerHTML = renderChampionshipPageRoundFixtures(fixtures, {
          completed: fixtures.length > 0 && fixtures.every(game => game.completed || game.homeGoals != null),
          roundLabel: stage?.name || `Fase ${pageCupPhase}`,
        });
      } else if (pageCompetition === 'RECOPA') {
        if (head) head.innerHTML = '';
        const fixtures = archive.recopaCompetition?.fixtures || [];
        body.innerHTML = renderChampionshipPageRoundFixtures(fixtures, {
          completed: fixtures.length > 0 && fixtures.every(game => game.completed || game.homeGoals != null),
          roundLabel: 'Final',
        });
      } else if (pageCompetition === 'ESTADUAIS') {
        if (head) head.innerHTML = '';
        const states = Object.entries(archive.stateLeagueSnapshot?.competitions || {})
          .filter(([, divisions]) => Array.isArray(divisions) && divisions.length)
          .sort(([a], [b]) => a.localeCompare(b));
        const cards = states.map(([uf, divisions]) => {
          const top = divisions.find(item => Number(item.tier || 1) === 1) || divisions[0];
          return `<button type="button" class="championship-page-archive-stage" data-estadual-uf="${uf}">
            <header><strong>${ufLabel(uf)}</strong><small>${divisions.length} divisão(ões)</small></header>
            <div class="championship-page-archive-fixture"><strong>${top?.teams?.length || 0} clubes na elite</strong><small>Abrir tabelas e resultados</small></div>
          </button>`;
        }).join('');
        body.innerHTML = cards || '<div class="championship-page-empty">Este arquivo antigo não possui tabelas estaduais completas.</div>';
      } else if (isStateChampionshipPage(pageCompetition)) {
        const division = stateLeagueViewModelFromArchive(archive, pageCompetition);
        if (!division) {
          if (head) head.innerHTML = '';
          body.innerHTML = '<div class="championship-page-empty">Este arquivo antigo possui apenas o campeão estadual, sem tabela e partidas completas.</div>';
        } else {
          const leagueRounds = division.leagueRoundCount ?? division.groupRoundCount ?? 0;
          const paulista = isPaulistaFormat(division);
          const groupIndex = paulista ? clamp(pageStateGroup || 0, 0, 1) : 0;
          const standings = Array.isArray(division.standings?.[0])
            ? (division.standings[groupIndex] || [])
            : (division.standings || []);
          const rows = [...standings].sort((a, b) => b.points - a.points || b.wins - a.wins || b.goalDiff - a.goalDiff);
          const games = division.fixtures?.[pageStateRound - 1] || [];
          const roundLimit = Math.max(1, division.fixtures?.length || leagueRounds);
          if (pageStateRound <= leagueRounds) {
            tableCard?.classList.remove('is-knockout');
            if (head) head.innerHTML = '<span>#</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>';
            const rowsHtml = rows.map((row, index) => `<div class="league-row ${row.club === userClub ? 'highlight' : ''}" data-club="${row.club}" role="button" tabindex="0"><span>${index + 1}</span><span class="club-link">${row.club}</span><span>${row.played || 0}</span><span>${row.wins || 0}</span><span>${row.draws || 0}</span><span>${row.losses || 0}</span><span>${row.goalDiff >= 0 ? '+' : ''}${row.goalDiff || 0}</span><span>${row.points || 0}</span></div>`).join('');
            const toolbar = renderChampionshipPageFixturesToolbar({ roundLimit, round: pageStateRound });
            const fixtures = renderChampionshipPageRoundFixtures(games, { completed: true, toolbarHtml: toolbar });
            body.innerHTML = `<div class="championship-page-league-body"><div class="championship-page-standings-block">${rowsHtml}</div>${fixtures}</div>`;
          } else {
            tableCard?.classList.add('is-knockout');
            if (head) head.innerHTML = '';
            const toolbar = renderChampionshipPageFixturesToolbar({ roundLimit, round: pageStateRound });
            body.innerHTML = renderChampionshipPageRoundFixtures(games, { completed: true, toolbarHtml: toolbar });
          }
        }
      } else if (pageCompetition === 'D' && archiveSerieD) {
        if (pageSerieDMode === 'knockout' && archiveSerieD.phases.length) {
          tableCard?.classList.add('is-knockout');
          if (head) head.innerHTML = '';
          const phase = archiveSerieD.phases.find(item => item.index === pageSerieDPhase) || archiveSerieD.phases[0];
          body.innerHTML = renderChampionshipPageRoundFixtures(phase.fixtures, {
            completed: true,
            roundLabel: phase.name,
          });
        } else {
          tableCard?.classList.remove('is-knockout');
          const group = archiveSerieD.groups[pageSerieDGroup];
          if (head) head.innerHTML = '<span>#</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>';
          const rowsHtml = (group?.standings || []).map((row, index) => `<div class="league-row ${index < 4 ? 'promotion' : ''} ${row.club === userClub ? 'highlight' : ''}" data-club="${row.club}" role="button" tabindex="0"><span>${index + 1}</span><span class="club-link">${row.club}</span><span>${row.played || 0}</span><span>${row.wins || 0}</span><span>${row.draws || 0}</span><span>${row.losses || 0}</span><span>${row.goalDiff >= 0 ? '+' : ''}${row.goalDiff || 0}</span><span>${row.points || 0}</span></div>`).join('');
          const fixtures = renderChampionshipPageRoundFixtures(group?.fixtures || [], { completed: true });
          body.innerHTML = `<div class="championship-page-league-body"><div class="championship-page-standings-block">${rowsHtml}</div>${fixtures}</div>`;
        }
      } else {
        if (head) head.innerHTML = '<span>#</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>';
        const rows = [...(archive.standings?.[pageCompetition] || [])]
          .sort((a, b) => b.points - a.points || b.wins - a.wins || b.goalDiff - a.goalDiff);
        const rowsHtml = rows.map((row, index) => {
          const pos = index + 1;
          const zone = pageCompetition === 'D'
            ? (index < 4 ? 'promotion' : '')
            : leagueClassificationZone(pageCompetition, index, rows.length);
          return `<div class="league-row ${zone} ${row.club === userClub ? 'highlight' : ''}" data-club="${row.club}" role="button" tabindex="0"><span>${pos}</span><span class="club-link">${row.club}</span><span>${row.played}</span><span>${row.wins}</span><span>${row.draws}</span><span>${row.losses}</span><span>${row.goalDiff >= 0 ? '+' : ''}${row.goalDiff}</span><span>${row.points}</span></div>`;
        }).join('') || '<div class="championship-page-empty">Sem classificação neste arquivo.</div>';
        const zoneLegend = pageCompetition === 'A'
          ? '<div class="championship-page-zone-legend"><span><i class="relegation" aria-hidden="true"></i>Z4 · Rebaixamento</span></div>'
          : pageCompetition === 'B'
            ? '<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>G4 · Acesso</span><span><i class="relegation" aria-hidden="true"></i>Z4 · Rebaixamento</span></div>'
            : pageCompetition === 'C'
              ? `<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>G4 · Acesso</span><span><i class="relegation" aria-hidden="true"></i>Z${serieCRelegationZone} · Rebaixamento</span></div>`
              : pageCompetition === 'D'
                ? '<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>4 primeiros · Avançam do grupo</span></div>'
                : '';
        body.innerHTML = rowsHtml + zoneLegend;
      }
    } else {
      if (head) head.innerHTML = '<span>#</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>';
      const tableRowHtml = (row, pos, zone) => `<div class="league-row ${zone} ${row.club === userClub ? 'highlight' : ''}" data-club="${row.club}" role="button" tabindex="0"><span>${pos}</span><span class="club-link">${row.club}</span><span>${row.played}</span><span>${row.wins}</span><span>${row.draws}</span><span>${row.losses}</span><span>${row.goalDiff >= 0 ? '+' : ''}${row.goalDiff}</span><span>${row.points}</span></div>`;

      // Série C: cada fase tem a sua tabela, e a legenda muda junto.
      if (pageCompetition === 'C' && pageSerieCPhase > 1) {
        const view = getSerieCView?.() || {};
        if (pageSerieCPhase === 2) {
          const tables = (view.groups || [])
            .map(group => {
              const rows = (group.rows || []).map((row, index) => tableRowHtml(row, index + 1, index === 0 ? 'promotion' : '')).join('');
              if (!rows) return '';
              return `<div class="championship-page-standings-block"><h4 class="championship-page-group-title">${group.label}</h4>${rows}</div>`;
            })
            .join('');
          body.innerHTML = tables
            + '<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>1º de cada grupo · Acesso à Série B</span></div>'
            || '<div class="championship-page-empty">Os grupos são formados ao fim da primeira fase.</div>';
        } else {
          const jogos = (view.finalGames || []).map(game => {
            const placar = game.completed ? `${game.homeGoals ?? 0} × ${game.awayGoals ?? 0}` : '×';
            return `<div class="league-row"><span>${game.leg === 'VOLTA' ? 'VOLTA' : 'IDA'}</span><span class="club-link">${game.home}</span><span>${placar}</span><span class="club-link">${game.away}</span></div>`;
          }).join('');
          const campeao = view.champion
            ? `<div class="championship-page-zone-legend"><span>★ Campeão: ${view.champion}</span></div>`
            : '';
          body.innerHTML = (jogos || '<div class="championship-page-empty">A final começa ao fim dos grupos.</div>') + campeao;
        }
        setChampionshipPagePickerOpen(false);
        setChampionshipPageStateTierPickerOpen(false);
        return;
      }

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
        return tableRowHtml(row, pos, zone);
      }).join('') || '<div class="championship-page-empty">Sem classificação disponível.</div>';
      // Na Série C quem avança aos grupos são os 8 primeiros — não há acesso
      // direto. A promoção para a B sai dos vencedores de grupo.
      const zoneLegend = pageCompetition === 'A'
        ? '<div class="championship-page-zone-legend"><span><i class="relegation" aria-hidden="true"></i>Z4 · Rebaixamento</span></div>'
        : pageCompetition === 'B'
          ? '<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>G4 · Acesso</span><span><i class="relegation" aria-hidden="true"></i>Z4 · Rebaixamento</span></div>'
          : pageCompetition === 'C'
            ? `<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>G8 · Avançam aos grupos</span><span><i class="relegation" aria-hidden="true"></i>Z${serieCRelegationZone} · Rebaixamento</span></div>`
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
    const worldCupCompetition = worldCupForView();
    const cupCompetition = getCupCompetition();
    const cupPhaseDefinitions = getCupPhaseDefinitions();
    const userSerieDGroupIndex = getUserSerieDGroupIndex();

    const valid = getPageCompetitionOptions().some(option => option.id === competitionId) || isStateChampionshipPage(competitionId);
    if (!valid) return;
    pageCompetition = competitionId;
    if (competitionId === QUALIFIERS_PAGE_ID) pageQualifiersMatchday = qualifiersCurrentMatchday(getConmebolQualifiers());
    if (isConmebolPage(competitionId)) {
      const id = CONMEBOL_PAGE_IDS[competitionId];
      pageConmebolStep[id] = conmebolUserStep(getConmebolEdition(), id, userClub);
    }
    if (competitionId === 'CMU') {
      const letter = findUserWorldCupGroup(worldCupCompetition, getUserNationalTeamName());
      pageWorldCupGroup = Math.max(0, WORLD_CUP_GROUP_LETTERS.indexOf(letter || 'A'));
      const userFixtures = worldCupCompetition ? getWorldCupAllFixtures(worldCupCompetition).filter(game => game.home === getUserNationalTeamName() || game.away === getUserNationalTeamName()) : [];
      const pending = userFixtures.find(game => !game.completed && game.homeGoals == null);
      pageWorldCupRound = pending?.round || userFixtures.filter(game => game.completed || game.homeGoals != null).at(-1)?.round || 1;
    }
    if (isStateChampionshipPage(competitionId)) {
      pageStateRound = stateLeagueEngine.getCurrentRound(competitionId, userClub);
      // Abre no grupo do seu time (formato com dois grupos).
      pageStateGroup = 0;
      try {
        if ((stateGroupRows(competitionId, 1) || []).some(row => row.club === userClub)) pageStateGroup = 1;
      } catch {
        pageStateGroup = 0;
      }
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
    const archive = getViewArchive();
    const archiveSerieD = isArchiveView() ? serieDViewModelFromArchive(archive) : null;
    const serieDGroups = archiveSerieD?.groups || getSerieDGroups();
    const userSerieDGroupIndex = getUserSerieDGroupIndex();

    if (isStateChampionshipPage(pageCompetition)) {
      const division = isArchiveView()
        ? stateLeagueViewModelFromArchive(archive, pageCompetition)
        : stateLeagueEngine.getDivisionForBrowse(pageCompetition, userClub);
      const leagueRounds = division?.leagueRoundCount ?? division?.groupRoundCount ?? 0;
      const limit = isArchiveView()
        ? Math.max(1, division?.fixtures?.length || leagueRounds)
        : stateLeagueEngine.getRoundLimit(pageCompetition);
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
    } else if (pageCompetition === QUALIFIERS_PAGE_ID) {
      pageQualifiersMatchday = clamp((pageQualifiersMatchday || 1) + step, 1, 18);
    } else if (isConmebolPage(pageCompetition)) {
      const id = CONMEBOL_PAGE_IDS[pageCompetition];
      const total = conmebolSteps(getConmebolEdition(), id).length;
      pageConmebolStep[id] = clamp((pageConmebolStep[id] || 0) + step, 0, Math.max(0, total - 1));
    } else if (pageCompetition === 'CMU') {
      const worldCupCompetition = worldCupForView();
      const inKnockout = (pageWorldCupRound || 1) >= 4;
      if (inKnockout) {
        if (step < 0 && pageWorldCupRound <= 4) {
          pageWorldCupRound = 3;
          pageWorldCupGroup = WORLD_CUP_GROUP_LETTERS.length - 1;
        } else {
          pageWorldCupRound = clamp((pageWorldCupRound || 4) + step, 4, 9);
        }
      } else if (step > 0) {
        if (
          pageWorldCupGroup >= WORLD_CUP_GROUP_LETTERS.length - 1
          && (worldCupCompetition?.knockoutFixtures || []).length
        ) {
          pageWorldCupRound = 4;
        } else {
          pageWorldCupGroup = Math.min(WORLD_CUP_GROUP_LETTERS.length - 1, (pageWorldCupGroup || 0) + 1);
        }
      } else {
        pageWorldCupGroup = Math.max(0, (pageWorldCupGroup || 0) - 1);
      }
    } else if (pageCompetition === 'CUP') {
      pageCupPhase = clamp(pageCupPhase + step, 1, cupPhaseDefinitions.length);
    } else if (pageCompetition === 'C') {
      const phases = getSerieCView?.()?.available || [1];
      const index = phases.indexOf(pageSerieCPhase);
      const next = clamp((index < 0 ? 0 : index) + step, 0, phases.length - 1);
      pageSerieCPhase = phases[next];
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
          const nextAvailable = isArchiveView()
            ? archiveSerieD?.phases?.some(item => item.index === pageSerieDPhase + 1)
            : nextDef && serieDKnockoutPhaseMeta(nextDef).generated;
          if (nextAvailable) pageSerieDPhase += 1;
        }
      } else if (step > 0) {
        if (pageSerieDGroup < lastGroup) pageSerieDGroup += 1;
        else if (isArchiveView() ? archiveSerieD?.phases?.length : isSerieDKnockoutUiActive()) {
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
        if (isArchiveView() && !archiveSupportsCompetition(pageCompetition)) {
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
      const archiveSerieD = isArchiveView() ? serieDViewModelFromArchive(getViewArchive()) : null;
      const knockoutAvailable = isArchiveView()
        ? archiveSerieD?.phases?.length > 0
        : isSerieDKnockoutUiActive();
      if (!button || pageCompetition !== 'D' || !knockoutAvailable) return;
      const mode = button.dataset.pageSerieDMode === 'groups' ? 'groups' : 'knockout';
      if (mode === pageSerieDMode) return;
      pageSerieDMode = mode;
      if (mode === 'knockout') {
        pageSerieDPhase = isArchiveView()
          ? (archiveSerieD?.phases?.[0]?.index || 1)
          : serieDPhaseIndexForRound(getCurrentRound());
      }
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
      const archiveDivision = isArchiveView()
        ? stateLeagueViewModelFromArchive(getViewArchive(), pageCompetition)
        : null;
      const roundLimit = isArchiveView()
        ? Math.max(1, archiveDivision?.fixtures?.length || archiveDivision?.leagueRoundCount || 1)
        : stateLeagueEngine.getRoundLimit(pageCompetition);
      if (event.target.closest('[data-state-fixtures-open]')) {
        pageStateFixturesOpen = true;
        pageStateFixturesMode = 'round';
        pageStateRound = clamp(
          pageStateRound || (isArchiveView() ? 1 : stateLeagueEngine.getCurrentRound(pageCompetition, getUserClub())),
          1,
          roundLimit,
        );
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
      const phaseBtn = event.target.closest('[data-bracket-phase]:not(:disabled)');
      if (phaseBtn) {
        const index = Number(phaseBtn.dataset.bracketPhase);
        if (bracketCompetition === 'SERIE_D') openSerieDBracket(index); else openCupBracket(index);
        return;
      }
      const filterBtn = event.target.closest('[data-bracket-filter]');
      if (filterBtn) { bracketView.filter = filterBtn.dataset.bracketFilter; bracketView.page = 0; renderBracketV2(bracketView.phase); return; }
      if (event.target.closest('[data-bracket-more]')) { bracketView.page += 1; renderBracketV2(bracketView.phase); return; }
    });

    const competitionRulesModal = createCompetitionRulesModalFeature({ $, onClick });
    competitionRulesModal.bindHandlers({
      getPageCompetition: () => pageCompetition,
      getCareerSeason,
      getUserStanding: competitionId => {
        const division = String(competitionId || '').toUpperCase();
        if (!['A', 'B', 'C'].includes(division)) return null;
        const rows = getNationalCompetitions()?.[division]?.standings || [];
        const sorted = [...rows].sort((a, b) => (b.points || 0) - (a.points || 0) || (b.goalDiff || 0) - (a.goalDiff || 0) || (b.wins || 0) - (a.wins || 0));
        const index = sorted.findIndex(row => row.club === getUserClub());
        return index >= 0 ? { club: getUserClub(), position: index + 1 } : null;
      },
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

  /**
   * Rodada para a coluna lateral (Competições v2): só ligas por pontos
   * (Séries e estaduais na fase de classificação). Retorna null nos demais.
   */
  const getSideRound = requested => {
    try {
      if (isArchiveView() || championshipPageIsKnockoutView()) return null;
      const userClub = getUserClub();
      if (isStateChampionshipPage(pageCompetition)) {
        const limit = stateLeagueEngine.getRoundLimit(pageCompetition);
        const current = stateLeagueEngine.getCurrentRound(pageCompetition, userClub);
        const round = clamp(requested || current, 1, Math.max(1, limit));
        let games = stateLeagueEngine.getRoundGamesForBrowse(pageCompetition, round) || [];
        // Fase de grupos: só os jogos do grupo em destaque na tabela.
        const groupClubs = new Set((stateGroupRows(pageCompetition, pageStateGroup) || []).map(row => row.club));
        const inGroup = games.filter(game => groupClubs.has(game.home) && groupClubs.has(game.away));
        if (groupClubs.size && inGroup.length) games = inGroup;
        return { key: `${pageCompetition}:${pageStateGroup}`, round, current, limit, games: overlayPendingLiveGames(games) };
      }
      if (['A', 'B', 'C', 'D'].includes(pageCompetition)) {
        const fixtures = getNationalCompetitions()?.[pageCompetition]?.fixtures || [];
        if (!fixtures.length) return null;
        const current = clamp(getCurrentRound(), 1, fixtures.length);
        const round = clamp(requested || current, 1, fixtures.length);
        let games = fixtures[round - 1] || [];
        let key = pageCompetition;
        // Série D na 1ª fase: só os jogos do grupo em destaque na tabela.
        if (pageCompetition === 'D') {
          const group = (getSerieDGroups?.() || [])[pageSerieDGroup] || [];
          const inGroup = group.length ? games.filter(game => group.includes(game.home) && group.includes(game.away)) : [];
          if (inGroup.length) { games = inGroup; key = `D:${pageSerieDGroup}`; }
        }
        return { key, round, current, limit: fixtures.length, games: overlayPendingLiveGames(games) };
      }
    } catch {
      return null;
    }
    return null;
  };

  const champV2 = createChampionshipV2({
    $,
    getUserClub: () => getUserClub(),
    getUserNationalTeam: () => (typeof getUserNationalTeamName === 'function' ? getUserNationalTeamName() : ''),
    getNationalForm: deps.getNationalForm,
    getClubForm: deps.getClubForm,
    getSideRound,
    getScorers: deps.getScorers,
    getUserNationalRank: deps.getUserNationalRank,
    openRanking: () => deps.openView?.('ranking'),
  });

  const init = () => {
    champV2.init();
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
