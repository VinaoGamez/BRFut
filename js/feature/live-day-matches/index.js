import { MODULE_VERSIONS } from '../../core/constants.js';
import { teamCrestHtml } from '../../ui/team-crest.js';
import { sortStandingsRows, applyResultToStanding } from '../../engine/state-league-format.js';

/**
 * Modal "Ao vivo · Rodada" — placar simultâneo dos demais jogos da data.
 * @param {object} deps
 * @param {Function} deps.$
 * @param {Function} deps.$$
 * @param {Function} deps.onClick
 * @param {Function} deps.clamp
 * @param {Function} deps.getLiveMatchGame
 * @param {Function} deps.getMinute
 * @param {Function} deps.getGoals
 * @param {Function} deps.getPreMatchPreparation
 * @param {Function} deps.getMatchFinished
 * @param {Function} deps.getHalftimeShown
 * @param {Function} deps.getUserClub
 * @param {Function} deps.getUserDivision
 * @param {Function} deps.getCurrentRound
 * @param {Function} deps.getClubs
 * @param {Function} deps.getNationalCompetitions
 * @param {Function} deps.getCopaDoBrasilFixtures
 * @param {Function} deps.getSerieDGroups
 * @param {Function} deps.getUserSerieDGroupIndex
 * @param {number} deps.SERIE_D_GROUP_ROUNDS
 * @param {Function} deps.isUserFixture
 * @param {Function} deps.isKnockoutShootoutCompetition
 * @param {Function} deps.fixtureDetails
 * @param {Function} deps.fixtureDateFor
 * @param {Function} deps.calendarKey
 * @param {Function} deps.simulateRoundMatch
 * @param {Function} deps.getCareerCalendarDate
 * @param {Function} deps.getSeasonRoundHistory
 * @param {Function} deps.getCompetitionRoundHistory
 * @param {Function} deps.getCareerSeed
 */
export function createLiveDayMatchesFeature(deps) {
  const {
    $,
    onClick,
    clamp,
    getLiveMatchGame,
    getMinute,
    getGoals,
    getPreMatchPreparation,
    getMatchFinished,
    getHalftimeShown,
    getUserClub,
    getUserDivision,
    getCurrentRound,
    getClubs,
    getNationalCompetitions,
    getCopaDoBrasilFixtures,
    getSerieDGroups,
    getUserSerieDGroupIndex,
    SERIE_D_GROUP_ROUNDS,
    isUserFixture,
    isKnockoutShootoutCompetition,
    fixtureDetails,
    fixtureDateFor,
    calendarKey,
    simulateRoundMatch,
    getCareerCalendarDate,
    getSeasonRoundHistory,
    getCompetitionRoundHistory,
    getCareerSeed,
    getStateLeagueEngine,
    getConmebolFixtures,
  } = deps;
  const esc = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  let liveDayMatchSnapshots = null;
  let liveDayMatchFilter = 'ALL';
  let liveDaySerieDGroup = getUserSerieDGroupIndex();

  const liveMatchDayKey = () => {
    const liveMatchGame = getLiveMatchGame();
    if (!liveMatchGame) return null;
    if (liveMatchGame.competition === 'COPA DO BRASIL') return calendarKey(new Date(liveMatchGame.date));
    return calendarKey(fixtureDetails(liveMatchGame).date);
  };

  const liveDayGameKey = game =>
    `${game.competition || 'LEAGUE'}|${game.home}|${game.away}|${game.round || ''}|${game.leg || ''}|${game.phase || ''}|${game.tieId || ''}`;

  const liveDayGameDivision = game => {
    if (game.competition === 'COPA DO BRASIL') return 'CUP';
    if (game._liveDivision && game._liveDivision !== 'CUP') return game._liveDivision;
    const clubs = getClubs();
    return clubs[game.home]?.division || clubs[game.away]?.division || getUserDivision();
  };

  const serieDGroupIndexForGame = game =>
    getSerieDGroups().findIndex(group => group.includes(game.home) && group.includes(game.away));

  const divisionRoundPlayed = division =>
    Math.max(0, ...(getNationalCompetitions()[division]?.standings || []).map(row => row.played || 0));

  const isNationalFixturePending = (game, division) => {
    if (game.competition === 'COPA DO BRASIL' || isKnockoutShootoutCompetition(game)) return !game.completed;
    const history =
      division === getUserDivision() ? getSeasonRoundHistory() : getCompetitionRoundHistory()[division] || [];
    if (history.some(item => (item.games || []).some(entry => entry.home === game.home && entry.away === game.away)))
      return false;
    return (game.round || 0) > divisionRoundPlayed(division);
  };

  const leagueFixtureDate = (division, game) => {
    if (game?.date) return new Date(game.date);
    return fixtureDateFor(division, game.round || getCurrentRound());
  };

  const allNationalFixturesOnDay = dayKey => {
    if (!dayKey) return [];
    const unique = new Map();
    Object.entries(getNationalCompetitions()).forEach(([division, competition]) => {
      (competition.fixtures || []).flat().forEach(game => {
        if (!game?.home || !game?.away || game.competition === 'COPA DO BRASIL') return;
        const date = leagueFixtureDate(division, game);
        if (calendarKey(date) !== dayKey || !isNationalFixturePending(game, division)) return;
        unique.set(liveDayGameKey(game), { ...game, _liveDivision: division });
      });
    });
    const liveMatchGame = getLiveMatchGame();
    getCopaDoBrasilFixtures().forEach(game => {
      if (game.completed) return;
      const sameDay = calendarKey(new Date(game.date)) === dayKey;
      const sameCupPhase =
        liveMatchGame?.competition === 'COPA DO BRASIL' && game.phaseIndex === liveMatchGame.phaseIndex;
      if (!sameDay && !sameCupPhase) return;
      unique.set(liveDayGameKey(game), { ...game, _liveDivision: 'CUP' });
    });
    // Estadual do usuário: mesma rodada (jogo ao vivo do Estadual) ou mesma data.
    const stateEngine = typeof getStateLeagueEngine === 'function' ? getStateLeagueEngine() : null;
    const stateDivision = stateEngine?.getUserDivision?.(getUserClub());
    const liveIsState = !!(liveMatchGame && stateEngine?.isStateGame?.(liveMatchGame));
    (stateDivision?.fixtures || []).flat().forEach(game => {
      if (!game?.home || !game?.away || game.completed) return;
      const match = liveIsState
        ? Number(game.round) === Number(liveMatchGame.round) && (game.phase || '') === (liveMatchGame.phase || '')
        : calendarKey(fixtureDetails(game).date) === dayKey;
      if (!match) return;
      unique.set(liveDayGameKey(game), { ...game, _liveDivision: 'STATE' });
    });
    // Libertadores / Sul-Americana na mesma data.
    (typeof getConmebolFixtures === 'function' ? getConmebolFixtures() || [] : []).forEach(game => {
      if (!game?.home || !game?.away || game.completed) return;
      const date = game.date ? new Date(game.date) : fixtureDetails(game).date;
      if (calendarKey(date) !== dayKey) return;
      unique.set(liveDayGameKey(game), { ...game, _liveDivision: 'CONMEBOL' });
    });
    return [...unique.values()].sort(
      (a, b) =>
        Number(isUserFixture(b)) - Number(isUserFixture(a)) ||
        liveDayGameDivision(a).localeCompare(liveDayGameDivision(b)) ||
        a.home.localeCompare(b.home, 'pt-BR'),
    );
  };

  const liveMatchDayGames = () => allNationalFixturesOnDay(liveMatchDayKey());

  const LIVE_KIND_ORDER = ['STATE', 'A', 'B', 'C', 'D', 'CUP', 'CONMEBOL'];
  const liveDayFilterOptions = games => {
    const available = new Set(games.map(game => liveDayGameDivision(game)));
    return LIVE_KIND_ORDER.filter(kind => available.has(kind));
  };
  const liveKindLabel = (kind, games = []) => {
    if (kind === 'STATE') return 'ESTADUAL';
    if (kind === 'CUP') return 'COPA DO BRASIL';
    if (kind === 'CONMEBOL') return String(games.find(game => liveDayGameDivision(game) === 'CONMEBOL')?.competition || 'CONTINENTAL').toUpperCase();
    return `SÉRIE ${kind}`;
  };

  const groupGamesOnDay = games =>
    games.some(
      game =>
        liveDayGameDivision(game) === 'D' &&
        !isKnockoutShootoutCompetition(game) &&
        (game.round || 0) <= SERIE_D_GROUP_ROUNDS,
    );

  const defaultLiveDayFilter = games => {
    const options = liveDayFilterOptions(games);
    if (!options.length) return 'STATE';
    const userGame = games.find(isUserFixture);
    if (!userGame) return options[0];
    const division = liveDayGameDivision(userGame);
    if (division === 'D' && !isKnockoutShootoutCompetition(userGame) && (userGame.round || 0) <= SERIE_D_GROUP_ROUNDS) {
      liveDaySerieDGroup = Math.max(0, serieDGroupIndexForGame(userGame));
    }
    return division;
  };

  const filterLiveDayGames = games =>
    games.filter(game => {
      if (liveDayGameDivision(game) !== liveDayMatchFilter) return false;
      if (liveDayMatchFilter === 'D' && !isKnockoutShootoutCompetition(game) && (game.round || 0) <= SERIE_D_GROUP_ROUNDS) {
        return serieDGroupIndexForGame(game) === liveDaySerieDGroup;
      }
      return true;
    });

  const seededGoalMinute = (homeClub, awayClub, side, index) => {
    let state =
      ((getCareerSeed() || 2166136261) ^
        getCurrentRound() ^
        homeClub.length ^
        awayClub.length ^
        side.charCodeAt(0) ^
        ((index + 1) * 997)) >>>
      0;
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return clamp(1 + (((state ^ (state >>> 14)) >>> 0) % 89), 1, 89);
  };

  const buildPartialGoalTimeline = (homeClub, awayClub, homeGoals, awayGoals) => {
    const events = [];
    for (let i = 0; i < homeGoals; i++) events.push({ side: 'home', minute: seededGoalMinute(homeClub, awayClub, 'h', i) });
    for (let i = 0; i < awayGoals; i++) events.push({ side: 'away', minute: seededGoalMinute(homeClub, awayClub, 'a', i) });
    return events.sort((a, b) => a.minute - b.minute);
  };

  const ensureLiveDayMatches = () => {
    if (liveDayMatchSnapshots) return;
    liveDayMatchSnapshots = new Map();
    liveMatchDayGames().forEach(game => {
      const id = liveDayGameKey(game);
      if (isUserFixture(game)) {
        liveDayMatchSnapshots.set(id, { game, isUser: true });
        return;
      }
      const result = simulateRoundMatch(game.home, game.away, game);
      liveDayMatchSnapshots.set(id, {
        game,
        isUser: false,
        timeline: buildPartialGoalTimeline(game.home, game.away, result.homeGoals, result.awayGoals),
        final: { homeGoals: result.homeGoals, awayGoals: result.awayGoals },
      });
    });
  };

  const livePartialAtMinute = (entry, atMinute) => {
    if (entry.isUser) {
      const userAtHome = entry.game.home === getUserClub();
      const goals = getGoals();
      return {
        homeGoals: (userAtHome ? goals.home : goals.away).filter(g => (g.minute || 0) <= atMinute).length,
        awayGoals: (userAtHome ? goals.away : goals.home).filter(g => (g.minute || 0) <= atMinute).length,
      };
    }
    const timeline = entry.timeline || [];
    return {
      homeGoals: timeline.filter(e => e.side === 'home' && e.minute <= atMinute).length,
      awayGoals: timeline.filter(e => e.side === 'away' && e.minute <= atMinute).length,
    };
  };

  const liveDayMatchLabel = game => {
    if (game.competition === 'COPA DO BRASIL') return `Copa · ${game.phase}${game.leg ? ` · ${game.leg}` : ''}`;
    if (isKnockoutShootoutCompetition(game)) return `Série D · ${game.leg || 'Elim.'}`;
    const division = liveDayGameDivision(game);
    return `S${division} · Rod. ${game.round || getCurrentRound()}ª`;
  };

  const liveDayMatchShortLabel = game => {
    if (game.competition === 'COPA DO BRASIL') return `${game.phase}${game.leg ? ` · ${game.leg}` : ''}`;
    if (isKnockoutShootoutCompetition(game)) return game.leg || 'Elim.';
    return `Rod. ${game.round || getCurrentRound()}ª`;
  };

  const liveDaySectionKey = game => {
    if (game.competition === 'COPA DO BRASIL') return 'CUP';
    if (game._liveDivision === 'STATE') return Number.isFinite(game.groupIndex) ? `STATE:${game.groupIndex}` : 'STATE';
    if (game._liveDivision === 'CONMEBOL') return game.group ? `CONMEBOL:${game.group}` : 'CONMEBOL';
    const division = liveDayGameDivision(game);
    if (division === 'D') {
      if (isKnockoutShootoutCompetition(game)) return 'D:KO';
      if ((game.round || 0) <= SERIE_D_GROUP_ROUNDS) {
        const groupIndex = serieDGroupIndexForGame(game);
        return groupIndex >= 0 ? `D:${groupIndex}` : 'D:UNK';
      }
      return 'D:KO';
    }
    return division;
  };

  const liveDaySectionLabel = key => {
    if (key === 'CUP') return 'Copa do Brasil';
    if (key === 'STATE') return 'Estadual';
    if (key.startsWith('STATE:')) return `Estadual · Grupo ${String.fromCharCode(65 + Number(key.slice(6)))}`;
    if (key === 'CONMEBOL') return 'Continental';
    if (key.startsWith('CONMEBOL:')) return `Grupo ${key.slice(9)}`;
    if (key === 'A') return 'Brasileirão Série A';
    if (key === 'B') return 'Brasileirão Série B';
    if (key === 'C') return 'Brasileirão Série C';
    if (key === 'D:KO') return 'Série D · Mata-mata';
    if (key === 'D:UNK') return 'Série D';
    if (key.startsWith('D:')) return `Série D · Grupo A${Number(key.slice(2)) + 1}`;
    return key;
  };

  const liveDaySectionSortKey = key => {
    if (key === 'CUP') return '0-CUP';
    if (key === 'A' || key === 'B' || key === 'C') return `1-${key}`;
    if (key === 'D:KO') return '2-KO';
    if (key.startsWith('D:')) return `2-${String(Number(key.slice(2))).padStart(2, '0')}`;
    return `9-${key}`;
  };

  const groupLiveDayGamesAllView = games => {
    const buckets = new Map();
    games.forEach(game => {
      const key = liveDaySectionKey(game);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(game);
    });
    return [...buckets.entries()]
      .sort(([a], [b]) => liveDaySectionSortKey(a).localeCompare(liveDaySectionSortKey(b)))
      .map(([key, sectionGames]) => ({
        key,
        label: liveDaySectionLabel(key),
        games: sectionGames.sort(
          (a, b) => Number(isUserFixture(b)) - Number(isUserFixture(a)) || a.home.localeCompare(b.home, 'pt-BR'),
        ),
      }));
  };

  const liveDayMatchStatus = (game, isUser, atMinute) => {
    if (getPreMatchPreparation()) return 'A iniciar';
    if (isUser && getMatchFinished()) return 'Encerrado';
    if (getHalftimeShown() && atMinute <= 45) return 'Intervalo';
    if (atMinute >= 90) return "90'";
    return `${String(atMinute).padStart(2, '0')}'`;
  };

  // Classificação ao vivo: tabela base + placares parciais dos jogos desta aba.
  const liveTableRows = (dayGames, atMinute) => {
    const live = getLiveMatchGame();
    let base = null;
    let title = '';
    if (liveDayMatchFilter === 'STATE') {
      const division = getStateLeagueEngine?.()?.getUserDivision?.(getUserClub());
      const userGame = dayGames.find(game => liveDayGameDivision(game) === 'STATE' && isUserFixture(game));
      const groupIndex = Number.isFinite(userGame?.groupIndex) ? userGame.groupIndex : 0;
      if (userGame?.phase === 'league' || userGame?.phase === 'groups' || (!userGame && division)) {
        base = division?.standings?.[groupIndex] || null;
        title = division?.standings?.length > 1 ? `Grupo ${String.fromCharCode(65 + groupIndex)}` : 'Estadual';
      }
    } else if (['A', 'B', 'C', 'D'].includes(liveDayMatchFilter)) {
      const rows = getNationalCompetitions()[liveDayMatchFilter]?.standings || [];
      const groupStage = liveDayMatchFilter === 'D' && dayGames.some(game => liveDayGameDivision(game) === 'D' && !isKnockoutShootoutCompetition(game) && (game.round || 0) <= SERIE_D_GROUP_ROUNDS);
      if (groupStage) {
        const group = getSerieDGroups()[liveDaySerieDGroup] || [];
        base = rows.filter(row => group.includes(row.club));
        title = `Série D · Grupo A${liveDaySerieDGroup + 1}`;
      } else if (liveDayMatchFilter !== 'D') {
        base = rows;
        title = `Série ${liveDayMatchFilter}`;
      }
    }
    if (!base?.length) return null;
    const clone = base.map(row => ({ club: row.club, played: Number(row.played) || 0, wins: Number(row.wins) || 0, draws: Number(row.draws) || 0, losses: Number(row.losses) || 0, goalDiff: Number(row.goalDiff) || 0, points: Number(row.points) || 0 }));
    const before = sortStandingsRows(clone.map(row => ({ ...row }))).map(row => row.club);
    const byClub = new Map(clone.map(row => [row.club, row]));
    if (!getPreMatchPreparation()) {
      filterLiveDayGames(dayGames).forEach(game => {
        const home = byClub.get(game.home);
        const away = byClub.get(game.away);
        if (!home || !away) return;
        const entry = liveDayMatchSnapshots?.get(liveDayGameKey(game)) || { game, isUser: isUserFixture(game) };
        const { homeGoals, awayGoals } = livePartialAtMinute(entry, atMinute);
        applyResultToStanding(home, homeGoals, awayGoals);
        applyResultToStanding(away, awayGoals, homeGoals);
      });
    }
    const sorted = sortStandingsRows(clone);
    return { title, rows: sorted.map((row, index) => ({ ...row, pos: index + 1, move: before.indexOf(row.club) - index })) };
  };

  const lastGoalMinute = (entry, atMinute) => {
    if (entry.isUser) {
      const goals = getGoals() || { home: [], away: [] };
      const all = [...(goals.home || []), ...(goals.away || [])].map(goal => Number(goal.minute) || 0).filter(m => m <= atMinute);
      return all.length ? Math.max(...all) : null;
    }
    const all = (entry.timeline || []).map(event => event.minute).filter(m => m <= atMinute);
    return all.length ? Math.max(...all) : null;
  };

  const render = () => {
    ensureLiveDayMatches();
    const preMatchPreparation = getPreMatchPreparation();
    const minute = getMinute();
    const liveMatchGame = getLiveMatchGame();
    const atMinute = preMatchPreparation ? 0 : Math.min(90, Math.max(0, minute));
    const dateSource = liveMatchGame
      ? liveMatchGame.competition === 'COPA DO BRASIL'
        ? new Date(liveMatchGame.date)
        : fixtureDetails(liveMatchGame).date
      : getCareerCalendarDate();
    const dateLabel = dateSource.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const dayGames = liveMatchDayGames();
    const filters = liveDayFilterOptions(dayGames);
    if (!filters.includes(liveDayMatchFilter)) liveDayMatchFilter = defaultLiveDayFilter(dayGames);
    const filteredGames = filterLiveDayGames(dayGames);
    const kicker = $('#liveDayMatchesKicker');
    if (kicker) {
      const stage = liveMatchGame ? (liveMatchGame.round ? `RODADA ${liveMatchGame.round}` : String(liveMatchGame.phase || '').toUpperCase()) : '';
      kicker.textContent = ['AO VIVO', stage, dateLabel].filter(Boolean).join(' · ');
    }
    const tabsEl = $('#liveDayDivisionTabs');
    if (tabsEl) {
      tabsEl.innerHTML = filters
        .map(filter => {
          const count = dayGames.filter(game => liveDayGameDivision(game) === filter).length;
          return `<button type="button" class="${filter === liveDayMatchFilter ? 'is-active' : ''}" data-live-day-division="${filter}">${esc(liveKindLabel(filter, dayGames))} · ${count}</button>`;
        })
        .join('');
    }
    const groupNav = $('#liveDayGroupNav');
    if (groupNav) {
      const groupGames = dayGames.filter(game => liveDayGameDivision(game) === 'D' && !isKnockoutShootoutCompetition(game) && (game.round || 0) <= SERIE_D_GROUP_ROUNDS);
      groupNav.innerHTML = liveDayMatchFilter === 'D' && groupGames.length
        ? `<button type="button" data-live-day-group-step="-1" aria-label="Grupo anterior">‹</button><strong>GRUPO A${liveDaySerieDGroup + 1}</strong><button type="button" data-live-day-group-step="1" aria-label="Próximo grupo">›</button>`
        : '';
    }
    const metaEl = $('#liveDayMatchesMeta');
    if (metaEl) {
      metaEl.textContent = preMatchPreparation
        ? `Os jogos desta data começam com o apito do ${getUserClub()}.`
        : `${liveDayMatchStatus(liveMatchGame, true, atMinute) === 'Intervalo' ? 'Intervalo' : `${atMinute}' de jogo`} · ${dayGames.length} jogo${dayGames.length === 1 ? '' : 's'} nesta data`;
    }
    const listEl = $('#liveDayMatchesList');
    const tableEl = $('#liveDayTable');
    if (!listEl) return;
    if (!dayGames.length) {
      listEl.innerHTML = '<div class="ld2-empty">Nenhuma outra partida nesta data.</div>';
      if (tableEl) tableEl.innerHTML = '';
      return;
    }
    const row = game => {
      const entry = liveDayMatchSnapshots?.get(liveDayGameKey(game)) || { game, isUser: isUserFixture(game) };
      const isUser = isUserFixture(game);
      const { homeGoals, awayGoals } = preMatchPreparation && !entry.isUser ? { homeGoals: 0, awayGoals: 0 } : livePartialAtMinute(entry, atMinute);
      const status = liveDayMatchStatus(game, isUser, atMinute);
      const goalAt = preMatchPreparation ? null : lastGoalMinute(entry, atMinute);
      const flash = goalAt != null && atMinute - goalAt <= 4 ? `<em class="ld2-goal">GOL ${goalAt}'</em>` : '';
      const progress = preMatchPreparation ? 0 : Math.round((Math.min(90, atMinute) / 90) * 100);
      const team = (name, side) => `<span class="ld2-team ld2-${side}${name === getUserClub() ? ' is-user' : ''}">${side === 'home' ? `<b class="club-link" data-club="${esc(name)}" role="button" tabindex="0">${esc(name)}</b>${teamCrestHtml(name, { className: 'ld2-crest' })}` : `${teamCrestHtml(name, { className: 'ld2-crest' })}<b class="club-link" data-club="${esc(name)}" role="button" tabindex="0">${esc(name)}</b>`}</span>`;
      const leg = game.leg ? `<small class="ld2-leg">${esc(game.leg)}</small>` : '';
      return `<div class="ld2-row${isUser ? ' is-user' : ''}${flash ? ' has-goal' : ''}">
        ${team(game.home, 'home')}
        <strong class="ld2-score">${homeGoals} × ${awayGoals}${leg}</strong>
        ${team(game.away, 'away')}
        <span class="ld2-status">${flash}<b>${esc(status)}</b><i class="ld2-bar"><span style="width:${progress}%"></span></i></span>
      </div>`;
    };
    const userGame = filteredGames.find(isUserFixture);
    const others = filteredGames.filter(game => !isUserFixture(game));
    const userSectionKey = userGame ? liveDaySectionKey(userGame) : null;
    const sections = groupLiveDayGamesAllView(others).sort((x, y) => Number(y.key === userSectionKey) - Number(x.key === userSectionKey));
    const sec = (label, tone = '') => `<div class="ld2-sec${tone ? ` is-${tone}` : ''}">${esc(label)}</div>`;
    listEl.innerHTML = (userGame ? `${sec('SEU JOGO', 'lime')}${row(userGame)}` : '')
      + sections.map(section => `${sec(`${userGame ? 'OUTROS JOGOS · ' : ''}${section.label}`.toUpperCase())}${section.games.map(row).join('')}`).join('')
      + (!filteredGames.length ? '<div class="ld2-empty">Nenhuma partida nesta competição nesta data.</div>' : '');
    if (tableEl) {
      const table = liveTableRows(dayGames, atMinute);
      if (!table) {
        tableEl.innerHTML = '';
        tableEl.hidden = true;
      } else {
        tableEl.hidden = false;
        // Até 10 linhas, centradas no clube do usuário (sem rolagem interna).
        const userIndex = table.rows.findIndex(item => item.club === getUserClub());
        const start = userIndex < 0 ? 0 : Math.max(0, Math.min(userIndex - 4, table.rows.length - 10));
        const shown = table.rows.slice(start, start + 10);
        tableEl.innerHTML = `${sec(`CLASSIFICAÇÃO AO VIVO · ${table.title}`.toUpperCase())}
          <div class="ld2-trows">${shown.map(item => `<div class="ld2-trow${item.club === getUserClub() ? ' is-user' : ''}"><b>${item.pos}</b><span>${teamCrestHtml(item.club, { className: 'ld2-tcrest' })}<i>${esc(item.club)}</i></span><strong>${item.points}</strong><em class="${item.move > 0 ? 'up' : item.move < 0 ? 'down' : ''}">${item.move > 0 ? `↑${item.move}` : item.move < 0 ? `↓${-item.move}` : '—'}</em></div>`).join('')}</div>
          <small class="ld2-tnote">Se terminasse agora. Setas: posição antes da rodada.</small>`;
      }
    }
  };

  let refreshTimer = null;
  const open = () => {
    const games = liveMatchDayGames();
    liveDayMatchFilter = defaultLiveDayFilter(games);
    render();
    $('#liveDayMatchesModal')?.classList.remove('hidden');
    // Placar e classificação acompanham o relógio enquanto a janela está aberta.
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if ($('#liveDayMatchesModal')?.classList.contains('hidden')) {
        clearInterval(refreshTimer);
        refreshTimer = null;
        return;
      }
      render();
    }, 1000);
  };

    const injectModal = () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="liveDayMatchesModal" class="modal hidden"><div class="modal-card live-day-matches-modal ld2">
        <header class="ld2-head"><div class="ld2-title"><span class="ld2-kicker" id="liveDayMatchesKicker">AO VIVO</span><h2>Partidas em andamento</h2></div><button id="closeLiveDayMatches" class="close" type="button" aria-label="Fechar">×</button></header>
        <div class="ld2-body"><div id="liveDayMatchesToolbar" class="ld2-toolbar"><div id="liveDayDivisionTabs" class="ld2-tabs"></div><div id="liveDayGroupNav" class="ld2-groupnav"></div><p id="liveDayMatchesMeta" class="ld2-meta"></p></div>
        <div class="ld2-main"><div id="liveDayMatchesList" class="ld2-list"></div><aside id="liveDayTable" class="ld2-table" hidden></aside></div></div>
      </div></div>`,
    );
  };

  const bindHandlers = () => {
    onClick('#liveDayMatches', open);
    onClick('#closeLiveDayMatches', () => {
      $('#liveDayMatchesModal').classList.add('hidden');
    });
    $('#liveDayMatchesModal')?.addEventListener('click', event => {
      const division = event.target.closest('[data-live-day-division]')?.dataset.liveDayDivision;
      if (division) {
        liveDayMatchFilter = division;
        if (division === 'D') {
          const groupGames = liveMatchDayGames().filter(
            game =>
              liveDayGameDivision(game) === 'D' &&
              !isKnockoutShootoutCompetition(game) &&
              (game.round || 0) <= SERIE_D_GROUP_ROUNDS,
          );
          if (groupGames.length && !groupGames.some(game => serieDGroupIndexForGame(game) === liveDaySerieDGroup)) {
            liveDaySerieDGroup = Math.max(0, serieDGroupIndexForGame(groupGames[0]));
          }
        }
        render();
        return;
      }
      const groupStep = Number(event.target.closest('[data-live-day-group-step]')?.dataset.liveDayGroupStep || 0);
      if (groupStep) {
        const serieDGroups = getSerieDGroups();
        liveDaySerieDGroup = (liveDaySerieDGroup + groupStep + serieDGroups.length) % serieDGroups.length;
        render();
      }
    });
  };
  injectModal();
  bindHandlers();

  return {
    moduleVersion: MODULE_VERSIONS.liveDayMatches,
    open,
    render,
    ensure: ensureLiveDayMatches,
    clearSnapshots: () => {
      liveDayMatchSnapshots = null;
    },
    getSnapshots: () => liveDayMatchSnapshots,
  };
}
