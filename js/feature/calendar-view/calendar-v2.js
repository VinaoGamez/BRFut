import { competitionBadgeMarkup, resolveCompetitionBadge } from '../../ui/competition-badge.js';
import { teamCrestHtml } from '../../ui/team-crest.js';
import { isDateInTransferWindow, getTransferWindowPhase } from '../../engine/transfers.js';
import { competitionColor, userOutcome, weekLoad } from './calendar-v2-model.js';
import { resolveFixtureCompetitionCode, calendarCompetitionLabel, sortCalendarCompetitionCodes } from '../../engine/season-calendar-mold.js';

/**
 * Calendário v2 (Jogos): visão em semanas (padrão), mês compacto e lista,
 * faixa da temporada, carga da semana e painel do dia escolhido.
 * Só lê dados que o calendário já tem; não altera datas nem o motor.
 */

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const VIEW_KEY = 'brfut-calendar-view';

const SHORT_LABELS = { EST: 'Estadual', BSA: 'Série A', BSB: 'Série B', BSC: 'Série C', BSD: 'Série D', CBR: 'Copa do Brasil', LIB: 'Libertadores', CSU: 'Sul-Americana', SCB: 'Supercopa', REC: 'Recopa', RSA: 'Recopa', CMU: 'Copa do Mundo' };
const shortLabel = code => SHORT_LABELS[code] || calendarCompetitionLabel(code);

const esc = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(12, 0, 0, 0);
  return next;
};

const dayDiff = (a, b) =>
  Math.round(
    (new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000,
  );

const weekStartOf = date => {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(12, 0, 0, 0);
  return start;
};

export function createCalendarV2(ctx) {
  const {
    $,
    calendarKey,
    getUserClub,
    getUserDivision,
    getCareerSeason,
    getCareerCalendarDate,
    getCalendarGames,
    isUserFixture,
    isFixtureCompleted,
    fixtureDetails,
    fixtureResultLabel,
    getTrainingRules,
    freeDaySummary,
    getSelected,
    selectDate,
    moveMonth,
    getReport,
    openReport,
    openView,
    getMatchOdds,
    getTiredStarters,
  } = ctx;

  let view = 'weeks';
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === 'weeks' || saved === 'month' || saved === 'list') view = saved;
  } catch {
    /* sem storage */
  }
  let weekCursor = null;
  let lastTodayKey = null;
  let listFilter = 'all';
  let windowCache = { season: null, ranges: [] };

  const isMobile = () => document.documentElement.classList.contains('is-mobile');

  const userGameOn = (games, key) => (games.get(key) || []).find(isUserFixture) || null;

  const codeOf = game => resolveFixtureCompetitionCode(game, { division: getUserDivision() }) || 'BSA';

  const badgeOf = game => {
    const badge = resolveCompetitionBadge(game, { userDivision: getUserDivision() });
    return competitionBadgeMarkup({ id: null, nameId: null, name: badge.name, kind: badge.kind, extraClass: 'cal2-badge' });
  };

  const allUserGames = () => {
    const games = getCalendarGames();
    const list = [];
    games.forEach((dayGames, key) => {
      dayGames.forEach(game => {
        if (isUserFixture(game)) list.push({ key, game, date: fixtureDetails(game).date });
      });
    });
    return list
      .filter(item => item.date instanceof Date && !Number.isNaN(item.date.getTime()))
      .sort((a, b) => a.date - b.date);
  };

  const transferRanges = () => {
    const season = getCareerSeason();
    if (windowCache.season === season) return windowCache.ranges;
    const ranges = [];
    let open = null;
    for (let day = new Date(season, 0, 1, 12); day.getFullYear() === season; day = addDays(day, 1)) {
      const inside = isDateInTransferWindow(day);
      if (inside && !open) open = new Date(day);
      if (!inside && open) {
        ranges.push([open, addDays(day, -1)]);
        open = null;
      }
    }
    if (open) ranges.push([open, new Date(season, 11, 31, 12)]);
    windowCache = { season, ranges };
    return ranges;
  };

  const yearFraction = date => {
    const season = getCareerSeason();
    const start = new Date(season, 0, 1, 12);
    const days = dayDiff(start, new Date(season, 11, 31, 12)) + 1;
    return Math.max(0, Math.min(1, dayDiff(start, date) / days));
  };

  // ---------- Faixa da temporada ----------
  const renderSeasonStrip = userGames => {
    const host = $('#cal2Season');
    if (!host) return;
    const byCode = new Map();
    userGames.forEach(({ game, date }) => {
      const code = codeOf(game);
      if (!byCode.has(code)) byCode.set(code, []);
      byCode.get(code).push(date);
    });
    const codes = sortCalendarCompetitionCodes([...byCode.keys()]);
    const rows = codes
      .map(code => {
        const dates = byCode.get(code);
        const first = yearFraction(dates[0]);
        const last = yearFraction(dates[dates.length - 1]);
        const ticks = dates
          .map(date => `<i style="left:${((yearFraction(date) - first) / Math.max(last - first, 0.004)) * 100}%"></i>`)
          .join('');
        return `<div class="cal2-band-row"><span class="cal2-band" style="--c:${competitionColor(code)};left:${first * 100}%;width:${Math.max((last - first) * 100, 0.6)}%" title="${esc(calendarCompetitionLabel(code))} · ${dates.length} jogos"><b>${esc(shortLabel(code))}</b><span class="cal2-ticks">${ticks}</span></span></div>`;
      })
      .join('');
    const windows = transferRanges()
      .map(([from, to]) => `<span class="cal2-window" style="left:${yearFraction(from) * 100}%;width:${(yearFraction(to) - yearFraction(from)) * 100}%"><b>JANELA</b></span>`)
      .join('');
    const today = yearFraction(getCareerCalendarDate());
    const selectedMonth = getSelected().getMonth();
    host.innerHTML = `<div class="cal2-months">${MONTHS.map((m, i) => `<button type="button" data-cal2-month="${i}" class="${i === selectedMonth ? 'is-active' : ''}">${m}</button>`).join('')}</div><div class="cal2-bands">${rows}<div class="cal2-band-row cal2-window-row">${windows}</div><span class="cal2-today" style="left:${today * 100}%"><em>HOJE</em></span></div>`;
  };

  // ---------- Pedaços comuns ----------
  const trainingFor = (key, trainingMap, hasGame) => {
    const activities = trainingMap.get(key) || [];
    if (activities.length) {
      const act = activities[0];
      return { type: act.type, label: act.label };
    }
    if (hasGame) return null;
    return { type: 'free', label: freeDaySummary(getTrainingRules()) };
  };

  const trainingPill = training =>
    training ? `<span class="cal2-train" data-type="${training.type}"><i></i>${esc(training.label)}</span>` : '';

  const venueChip = atHome => `<span class="cal2-venue ${atHome ? 'home' : 'away'}">${atHome ? 'CASA' : 'FORA'}</span>`;

  const matchCard = (game, { compact = false } = {}) => {
    const userClub = getUserClub();
    const atHome = game.home === userClub;
    const opponent = atHome ? game.away : game.home;
    const code = codeOf(game);
    const completed = isFixtureCompleted(game);
    const result = completed ? userOutcome(fixtureResultLabel(game), atHome) : null;
    const details = fixtureDetails(game);
    const bottom = result
      ? `<span class="cal2-result"><span class="cal2-outcome" data-o="${result.outcome}">${result.outcome}</span><strong>${result.mine}–${result.theirs}</strong></span>`
      : `<span class="cal2-when"><strong>${esc(details.time || '')}</strong>${venueChip(atHome)}</span>`;
    return `<span class="cal2-match${compact ? ' is-compact' : ''}" style="--c:${competitionColor(code)}"><span class="cal2-opp">${teamCrestHtml(opponent, { className: 'cal2-crest' })}<b>${atHome ? 'vs' : '@'} ${esc(opponent)}</b></span>${bottom}</span>`;
  };

  const weekHeader = (start, userGames) => {
    const end = addDays(start, 6);
    const inWeek = userGames.filter(({ date }) => date >= addDays(start, -0.5) && date <= addDays(end, 0.5)).map(item => item.date);
    const load = weekLoad(inWeek);
    const today = getCareerCalendarDate();
    const isCurrent = today >= addDays(start, -0.5) && today <= addDays(end, 0.5);
    const label = `${String(start.getDate()).padStart(2, '0')}${start.getMonth() !== end.getMonth() ? ` ${MONTHS[start.getMonth()]}` : ''} – ${String(end.getDate()).padStart(2, '0')} ${MONTHS[end.getMonth()]}${isCurrent ? ' · ESTA SEMANA' : ''}`;
    return { label, load };
  };

  const loadBar = load =>
    `<span class="cal2-load" data-level="${load.level}"><em>${esc(load.label)}</em><i><b style="width:${load.pct}%"></b></i></span>`;

  // ---------- Visão em semanas ----------
  const renderWeeks = (userGames, trainingMap) => {
    const host = $('#cal2Weeks');
    if (!host) return;
    const games = getCalendarGames();
    const todayKey = calendarKey(getCareerCalendarDate());
    const selectedKey = calendarKey(getSelected());
    const season = getCareerSeason();
    if (!weekCursor) weekCursor = weekStartOf(getSelected());

    const dayCell = (date, { mobileChip = false } = {}) => {
      const key = calendarKey(date);
      const game = userGameOn(games, key);
      const outside = date.getFullYear() !== season;
      const past = date < getCareerCalendarDate() && key !== todayKey;
      const phase = !outside && isDateInTransferWindow(date) ? getTransferWindowPhase(date) : null;
      const cls = [
        'cal2-day',
        past ? 'is-past' : '',
        key === todayKey ? 'is-today' : '',
        key === selectedKey ? 'is-selected' : '',
        outside ? 'is-outside' : '',
        phase ? 'in-window' : '',
        phase?.isDeadlineDay ? 'is-deadline' : '',
      ]
        .filter(Boolean)
        .join(' ');
      if (mobileChip) {
        return `<button type="button" class="${cls} cal2-chip" data-cal2-date="${key}"${game ? ` style="--c:${competitionColor(codeOf(game))}"` : ''}><small>${WEEKDAYS[date.getDay()]}</small><strong>${date.getDate()}</strong><i class="${game ? 'has-game' : ''}"></i></button>`;
      }
      const training = trainingFor(key, trainingMap, !!game);
      return `<button type="button" class="${cls}" data-cal2-date="${key}" aria-pressed="${key === selectedKey}"><span class="cal2-day-top"><strong>${date.getDate()}</strong>${key === todayKey ? '<span class="cal2-today-chip">HOJE</span>' : phase?.isDeadlineDay ? '<span class="cal2-deadline-chip">DEADLINE</span>' : ''}</span>${trainingPill(training)}${game ? matchCard(game) : ''}</button>`;
    };

    if (isMobile()) {
      const start = weekCursor;
      const { label, load } = weekHeader(start, userGames);
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      const rows = days
        .map(date => {
          const key = calendarKey(date);
          const game = userGameOn(games, key);
          const past = date < getCareerCalendarDate() && key !== todayKey;
          const training = trainingFor(key, trainingMap, !!game);
          const body = game
            ? `<span class="cal2-row-match" style="--c:${competitionColor(codeOf(game))}">${badgeOf(game)}${matchCard(game, { compact: true })}</span>`
            : `<span class="cal2-row-train">${trainingPill(training)}${key === todayKey ? '<span class="cal2-today-chip">HOJE</span>' : ''}</span>`;
          return `<button type="button" class="cal2-row${past ? ' is-past' : ''}${key === selectedKey ? ' is-selected' : ''}" data-cal2-date="${key}"><span class="cal2-row-date"><small>${WEEKDAYS[date.getDay()]}</small><strong>${date.getDate()}</strong></span>${body}</button>`;
        })
        .join('');
      host.innerHTML = `<div class="cal2-week-nav"><button type="button" data-cal2-week="-1" aria-label="Semana anterior">‹</button><strong>${label}</strong><button type="button" data-cal2-week="1" aria-label="Próxima semana">›</button></div><div class="cal2-chips">${days.map(date => dayCell(date, { mobileChip: true })).join('')}</div>${loadBar(load)}<div class="cal2-rows">${rows}</div>`;
      return;
    }

    const heads = `<div class="cal2-weekdays">${WEEKDAYS.map(d => `<span>${d}</span>`).join('')}</div>`;
    const weeks = [0, 1, 2]
      .map(offset => {
        const start = addDays(weekCursor, offset * 7);
        const { label, load } = weekHeader(start, userGames);
        const cells = Array.from({ length: 7 }, (_, i) => dayCell(addDays(start, i))).join('');
        return `<section class="cal2-week"><header><strong>${label}</strong><span class="cal2-rule"></span>${loadBar(load)}</header><div class="cal2-grid">${cells}</div></section>`;
      })
      .join('');
    host.innerHTML = heads + weeks;
  };

  // ---------- Lista ----------
  const renderList = userGames => {
    const host = $('#cal2List');
    if (!host) return;
    const codes = sortCalendarCompetitionCodes([...new Set(userGames.map(({ game }) => codeOf(game)))]);
    const filters = `<div class="cal2-filters"><button type="button" data-cal2-filter="all" class="${listFilter === 'all' ? 'is-active' : ''}">TODAS</button>${codes
      .map(code => `<button type="button" data-cal2-filter="${code}" class="${listFilter === code ? 'is-active' : ''}" style="--c:${competitionColor(code)}"><i></i>${esc(shortLabel(code))}</button>`)
      .join('')}</div>`;
    const userClub = getUserClub();
    let month = -1;
    const rows = userGames
      .filter(({ game }) => listFilter === 'all' || codeOf(game) === listFilter)
      .map(({ key, game, date }) => {
        const atHome = game.home === userClub;
        const completed = isFixtureCompleted(game);
        const result = completed ? userOutcome(fixtureResultLabel(game), atHome) : null;
        const monthHead = date.getMonth() !== month ? `<h3 class="cal2-list-month">${MONTHS[date.getMonth()]}</h3>` : '';
        month = date.getMonth();
        const side = (team, isUser) => `<span class="cal2-list-team${isUser ? ' is-user' : ''}">${teamCrestHtml(team, { className: 'cal2-crest' })}<b>${esc(team)}</b></span>`;
        const right = result
          ? `<span class="cal2-result"><span class="cal2-outcome" data-o="${result.outcome}">${result.outcome}</span><strong>${result.mine}–${result.theirs}</strong></span>`
          : `<span class="cal2-when"><strong>${esc(fixtureDetails(game).time || '')}</strong>${venueChip(atHome)}</span>`;
        return `${monthHead}<button type="button" class="cal2-list-row${completed ? ' is-past' : ''}" data-cal2-date="${key}"><span class="cal2-list-date"><small>${WEEKDAYS[date.getDay()]}</small><strong>${String(date.getDate()).padStart(2, '0')}</strong></span><span class="cal2-list-main">${badgeOf(game)}<span class="cal2-list-teams">${side(game.home, atHome)}<i>×</i>${side(game.away, !atHome)}</span></span>${right}</button>`;
      })
      .join('');
    host.innerHTML = filters + (rows || '<p class="cal2-empty">Nenhum jogo nesta competição.</p>');
  };

  // ---------- Painel do dia ----------
  const renderDayPanel = (userGames, trainingMap) => {
    const host = $('#cal2Day');
    if (!host) return;
    const selected = getSelected();
    const key = calendarKey(selected);
    const games = getCalendarGames();
    const game = userGameOn(games, key);
    const userClub = getUserClub();
    const dateLabel = selected
      .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' })
      .replace('.', '')
      .toUpperCase();
    const today = getCareerCalendarDate();
    const nextPending = userGames.find(({ game: g }) => !isFixtureCompleted(g));
    let card = '';
    if (game) {
      const atHome = game.home === userClub;
      const opponent = atHome ? game.away : game.home;
      const completed = isFixtureCompleted(game);
      const result = completed ? userOutcome(fixtureResultLabel(game), atHome) : null;
      const details = fixtureDetails(game);
      const team = name => `<span class="cal2-day-team${name === userClub ? ' is-user' : ''}">${teamCrestHtml(name, { className: 'cal2-day-crest' })}<b>${esc(name)}</b></span>`;
      const center = result
        ? `<span class="cal2-day-score"><span class="cal2-outcome" data-o="${result.outcome}">${result.outcome === 'V' ? 'VITÓRIA' : result.outcome === 'D' ? 'DERROTA' : 'EMPATE'}</span><strong>${esc(fixtureResultLabel(game).replace(/—/g, '–'))}</strong></span>`
        : `<strong class="cal2-day-time">${esc(details.time || '')}</strong>`;
      let odds = '';
      if (!completed && typeof getMatchOdds === 'function') {
        const o = getMatchOdds(game);
        if (o) odds = `<div class="cal2-odds"><div><i class="w" style="width:${o.win}%"></i><i class="d" style="width:${o.draw}%"></i><i class="l" style="width:${o.loss}%"></i></div><p><span class="w">V ${o.win}%</span><span>E ${o.draw}%</span><span class="l">D ${o.loss}%</span></p></div>`;
      }
      const report = completed ? getReport(game) : null;
      const isNext = nextPending?.game === game;
      const onMatchDay = calendarKey(today) === key;
      let primary = '';
      if (report) primary = `<button type="button" class="cal2-primary" data-cal2-report="${key}">VER RELATÓRIO</button>`;
      else if (isNext && onMatchDay) primary = '<button type="button" class="cal2-primary" data-cal2-go="play">IR PARA O JOGO</button>';
      else if (isNext) primary = `<button type="button" class="cal2-primary" data-cal2-go="advance">${esc(($('#calendarAdvanceWeek')?.textContent || 'AVANÇAR').replace('›', '').trim())} ›</button>`;
      card = `<div class="cal2-day-head"><span>${dateLabel}</span>${venueChip(atHome)}</div>${badgeOf(game)}<div class="cal2-day-teams">${team(game.home)}${center}${team(game.away)}</div>${odds}<div class="cal2-day-actions"><button type="button" class="cal2-secondary" data-club="${esc(opponent)}">VER ADVERSÁRIO</button>${primary}</div>`;
    } else {
      const training = trainingFor(key, trainingMap, false);
      const others = (games.get(key) || []).length;
      card = `<div class="cal2-day-head"><span>${dateLabel}</span></div><p class="cal2-day-free"><strong>Sem jogo do seu time</strong>${training ? `<span>${esc(training.label)}</span>` : ''}${others ? `<em>${others} ${others === 1 ? 'jogo' : 'jogos'} de outros clubes neste dia</em>` : ''}</p>`;
    }

    // Rotina: treino do dia, descanso desde o último jogo e próximo jogo.
    const before = [...userGames].reverse().find(({ date }) => dayDiff(date, selected) > 0);
    const after = userGames.find(({ date }) => dayDiff(selected, date) > 0);
    const training = trainingFor(key, trainingMap, !!game);
    const kv = (k, v, tone = '') => `<div class="cal2-kv"><span>${k}</span><strong${tone ? ` data-tone="${tone}"` : ''}>${v}</strong></div>`;
    const routine = [
      training ? kv('Treino do dia', esc(training.label)) : '',
      before ? kv('Último jogo', `há ${dayDiff(before.date, selected)} ${dayDiff(before.date, selected) === 1 ? 'dia' : 'dias'}`, dayDiff(before.date, selected) <= 2 ? 'warn' : 'ok') : '',
      after ? kv('Próximo jogo', `em ${dayDiff(selected, after.date)} ${dayDiff(selected, after.date) === 1 ? 'dia' : 'dias'}`) : '',
    ].join('');

    // Semana puxada.
    const start = weekStartOf(selected);
    const inWeek = userGames.filter(({ date }) => date >= addDays(start, -0.5) && date <= addDays(start, 6.5)).map(item => item.date);
    const load = weekLoad(inWeek);
    const tired = typeof getTiredStarters === 'function' ? getTiredStarters() : 0;
    const alert =
      load.level === 'high'
        ? `<section class="cal2-card cal2-alert"><span class="cal2-card-title">SEMANA PUXADA</span><p>${esc(load.label.replace(' · carga alta', ''))}.${tired ? ` ${tired} ${tired === 1 ? 'titular está' : 'titulares estão'} abaixo de 80% de condição.` : ''}</p><button type="button" class="cal2-secondary" data-cal2-go="training">AJUSTAR TREINO →</button></section>`
        : '';

    // Prazos: janela aberta (fecha em) ou próxima janela (abre em).
    const phase = getTransferWindowPhase(today);
    let deadline = '';
    if (phase.active) {
      deadline = kv('Janela de transferências', phase.daysLeft === 0 ? 'último dia' : `fecha em ${phase.daysLeft} ${phase.daysLeft === 1 ? 'dia' : 'dias'}`, phase.isDeadlineWeek ? 'warn' : '');
    } else {
      const nextWindow = transferRanges().find(([from]) => from > today);
      if (nextWindow) deadline = kv('Próxima janela', `abre em ${dayDiff(today, nextWindow[0])} dias`);
    }

    host.innerHTML = `<section class="cal2-card cal2-day-card">${card}</section>${routine ? `<section class="cal2-card"><span class="cal2-card-title">ROTINA</span>${routine}</section>` : ''}${alert}${deadline ? `<section class="cal2-card cal2-deadlines"><span class="cal2-card-title">PRAZOS</span>${deadline}</section>` : ''}`;
  };

  // ---------- Montagem ----------
  const inject = () => {
    const layout = $('#calendar .season-calendar-layout');
    if (!layout || $('#cal2Season')) return;
    layout.insertAdjacentHTML(
      'beforebegin',
      `<div id="cal2Season" class="cal2-season" aria-label="Linha do tempo da temporada"></div><div class="cal2-toolbar"><div class="cal2-views" role="group" aria-label="Modo de visualização"><button type="button" data-cal2-view="weeks">SEMANAS</button><button type="button" data-cal2-view="month">MÊS</button><button type="button" data-cal2-view="list">LISTA</button></div><div class="cal2-nav"><button type="button" data-cal2-step="-1" aria-label="Anterior">‹</button><button type="button" data-cal2-step="0">HOJE</button><button type="button" data-cal2-step="1" aria-label="Próximo">›</button></div><span class="cal2-toolbar-advance"></span></div>`,
    );
    const calendarCard = $('#calendar .season-calendar');
    calendarCard?.insertAdjacentHTML('beforebegin', '<div id="cal2Weeks" class="cal2-weeks"></div><div id="cal2List" class="cal2-list"></div>');
    $('#calendar .calendar-sidebar')?.insertAdjacentHTML('afterbegin', '<div id="cal2Day" class="cal2-day-panel"></div>');
    const advance = $('#calendarAdvanceWeek');
    if (advance) $('#calendar .cal2-toolbar-advance')?.appendChild(advance);
  };

  const applyView = () => {
    const root = $('#calendar');
    if (!root) return;
    root.dataset.cal2View = view;
    root.querySelectorAll('[data-cal2-view]').forEach(button => {
      const on = button.dataset.cal2View === view;
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  };

  /** Quando o dia da carreira anda, o dia escolhido volta para hoje. */
  const syncToday = () => {
    const todayKey = calendarKey(getCareerCalendarDate());
    if (todayKey === lastTodayKey) return false;
    lastTodayKey = todayKey;
    weekCursor = weekStartOf(getCareerCalendarDate());
    return true;
  };

  const render = trainingMap => {
    if (!$('#cal2Season')) inject();
    if (!$('#cal2Season')) return;
    const userGames = allUserGames();
    applyView();
    renderSeasonStrip(userGames);
    if (view === 'weeks') renderWeeks(userGames, trainingMap);
    if (view === 'list') renderList(userGames);
    renderDayPanel(userGames, trainingMap);
  };

  const pick = key => {
    const [y, m, d] = key.split('-').map(Number);
    selectDate(new Date(y, m - 1, d, 12));
  };

  const bind = () => {
    const root = $('#calendar');
    if (!root || root.dataset.cal2Bound) return;
    root.dataset.cal2Bound = '1';
    root.addEventListener('click', event => {
      const target = event.target;
      const viewBtn = target.closest('[data-cal2-view]');
      if (viewBtn) {
        view = viewBtn.dataset.cal2View;
        try {
          localStorage.setItem(VIEW_KEY, view);
        } catch {
          /* sem storage */
        }
        weekCursor = weekStartOf(getSelected());
        ctx.rerender();
        return;
      }
      const step = target.closest('[data-cal2-step]');
      if (step) {
        const dir = Number(step.dataset.cal2Step);
        if (dir === 0) {
          weekCursor = weekStartOf(getCareerCalendarDate());
          selectDate(getCareerCalendarDate());
          return;
        }
        if (view === 'month') {
          moveMonth(dir);
          return;
        }
        weekCursor = addDays(weekCursor || weekStartOf(getSelected()), dir * 7);
        ctx.rerender();
        return;
      }
      const week = target.closest('[data-cal2-week]');
      if (week) {
        weekCursor = addDays(weekCursor || weekStartOf(getSelected()), Number(week.dataset.cal2Week) * 7);
        ctx.rerender();
        return;
      }
      const month = target.closest('[data-cal2-month]');
      if (month) {
        const date = new Date(getCareerSeason(), Number(month.dataset.cal2Month), 1, 12);
        const today = getCareerCalendarDate();
        const pickDate = today.getMonth() === date.getMonth() && today.getFullYear() === date.getFullYear() ? today : date;
        weekCursor = weekStartOf(pickDate);
        selectDate(pickDate);
        return;
      }
      const filter = target.closest('[data-cal2-filter]');
      if (filter) {
        listFilter = filter.dataset.cal2Filter;
        ctx.rerender();
        return;
      }
      const report = target.closest('[data-cal2-report]');
      if (report) {
        const game = userGameOn(getCalendarGames(), report.dataset.cal2Report);
        const entry = game ? getReport(game) : null;
        if (entry) openReport(entry);
        return;
      }
      const go = target.closest('[data-cal2-go]');
      if (go) {
        const action = go.dataset.cal2Go;
        if (action === 'training') openView('training');
        else if (action === 'advance') $('#calendarAdvanceWeek')?.click();
        else if (action === 'play') openView('dashboard');
        return;
      }
      if (target.closest('[data-club]')) return;
      const day = target.closest('[data-cal2-date]');
      if (day) {
        // Na visão em semanas o cursor não pula ao escolher um dia.
        pick(day.dataset.cal2Date);
      }
    });
  };

  const resetWeek = () => {
    weekCursor = null;
  };

  return { inject, render, bind, resetWeek, syncToday, getView: () => view };
}
