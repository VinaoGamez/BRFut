import { MODULE_VERSIONS } from '../../core/constants.js';
import { teamCrestHtml } from '../../ui/team-crest.js';
import { buildChampionEntries } from './champions.js';
import { seasonGoalGauge } from './goal-gauge.js';
import { esc, money, ratingText, retroCompCard, retroTile, shortPlayerName } from './retro-view.js';

const RETRO_TABS = [
  ['resumo', 'Resumo'],
  ['campanha', 'Campanha'],
  ['elenco', 'Elenco'],
  ['financas', 'Finanças'],
  ['brasil', 'Brasil'],
];

const MODAL_HTML = `
<div id="seasonTransitionModal" class="modal hidden">
  <div class="modal-card season-summary-modal retro2" role="dialog" aria-modal="true" aria-labelledby="seasonSummaryTitle">
    <header class="retro-head">
      <div id="seasonRetroCrest" class="retro-head-crest"></div>
      <div class="retro-head-copy">
        <label class="retro-kicker">TEMPORADA CONCLUÍDA</label>
        <h2 id="seasonSummaryTitle">Retrospectiva</h2>
      </div>
      <nav class="retro-tabs" role="tablist" aria-label="Retrospectiva">
        ${RETRO_TABS.map(([key, label], index) => `<button type="button" role="tab" data-retro-tab="${key}" class="${index === 0 ? 'is-active' : ''}" aria-selected="${index === 0}">${label}</button>`).join('')}
      </nav>
    </header>
    <div id="seasonGoalPreviewSwitcher" class="season-goal-preview-switcher hidden" role="tablist" aria-label="Status da meta (preview)">
      <button type="button" data-goal-preview-status="missed">Abaixo</button>
      <button type="button" data-goal-preview-status="near">Quase</button>
      <button type="button" data-goal-preview-status="met">Cumpriu</button>
      <button type="button" data-goal-preview-status="exceeded">Superou</button>
    </div>
    <div class="retro-body">
      <section class="retro-pane is-active" data-retro-pane="resumo"></section>
      <section class="retro-pane" data-retro-pane="campanha"></section>
      <section class="retro-pane" data-retro-pane="elenco"></section>
      <section class="retro-pane" data-retro-pane="financas"></section>
      <section class="retro-pane" data-retro-pane="brasil"></section>
    </div>
    <footer class="retro-foot">
      <span id="seasonTransitionSummary" class="retro-foot-line"></span>
      <div class="season-summary-actions">
        <button id="closeSeasonSummary" type="button" class="season-summary-dismiss">VOLTAR À TEMPORADA</button>
        <button id="startNextSeason" type="button">AVANÇAR TEMPORADA →</button>
      </div>
    </footer>
  </div>
</div>
<div id="idleSeasonSimModal" class="modal hidden">
  <div class="modal-card idle-sim-modal">
    <label>CALENDÁRIO NACIONAL</label>
    <h2>Simulando não humanos</h2>
    <p>Seu clube não tem mais partidas. O restante da temporada está sendo resolvido automaticamente.</p>
    <strong id="idleSeasonSimStatus">Preparando…</strong>
  </div>
</div>`;

/**
 * Resumo de fim de temporada — campeões, líderes e movimentos de divisão.
 */
const PREVIEW_GOAL_SAMPLES = {
  missed: {
    status: 'missed',
    label: 'Conquistar o acesso à Série C',
    feeling: 'Abaixo do combinado. A diretoria cobrará mudanças. Com um pacote comercial alto, a cobrança pela meta ficou mais dura.',
    boardDelta: -17,
  },
  near: {
    status: 'near',
    label: 'Chegar às oitavas do mata-mata',
    feeling: 'Quase lá — a diretoria mantém o projeto, com ressalvas.',
    boardDelta: -3,
  },
  met: {
    status: 'met',
    label: 'Avançar da fase de grupos',
    feeling: 'Meta da temporada cumprida. A diretoria está satisfeita.',
    boardDelta: 4,
  },
  exceeded: {
    status: 'exceeded',
    label: 'Conquistar o acesso à Série C',
    feeling: 'A diretoria celebra: a meta foi superada. O pacote de patrocínio elevado reforçou o crédito junto à diretoria.',
    boardDelta: 18,
  },
};

export function createSeasonSummaryFeature(deps) {
  const {
    $,
    onStartNextSeason,
    onCloseSeasonSummary,
  } = deps;
  let handlersBound = false;
  let previewMode = false;
  let previewStatus = 'missed';

  const syncPreviewChrome = () => {
    const modal = $('#seasonTransitionModal');
    const switcher = $('#seasonGoalPreviewSwitcher');
    const closeBtn = $('#closeSeasonSummary');
    const startBtn = $('#startNextSeason');
    const label = modal?.querySelector('label');
    modal?.classList.toggle('is-preview', previewMode);
    switcher?.classList.toggle('hidden', !previewMode);
    if (switcher && previewMode) {
      switcher.querySelectorAll('[data-goal-preview-status]').forEach(button => {
        button.classList.toggle('is-active', button.dataset.goalPreviewStatus === previewStatus);
      });
    }
    if (closeBtn) closeBtn.textContent = previewMode ? 'FECHAR PREVIEW' : 'VOLTAR À TEMPORADA';
    if (startBtn) {
      startBtn.classList.toggle('hidden', previewMode);
      startBtn.disabled = previewMode;
    }
    if (label) label.textContent = previewMode ? 'PREVIEW · NÃO ALTERA A CARREIRA' : 'TEMPORADA CONCLUÍDA';
    if (startBtn && previewMode) startBtn.textContent = 'AVANÇAR TEMPORADA →';
  };

  const exitPreview = () => {
    previewMode = false;
    syncPreviewChrome();
    $('#seasonTransitionModal')?.classList.add('hidden');
  };

  const bindHandlers = () => {
    if (handlersBound) return;
    handlersBound = true;
    document.addEventListener('click', event => {
      const previewStatusBtn = event.target.closest('[data-goal-preview-status]');
      if (previewStatusBtn && previewMode) {
        event.preventDefault();
        event.stopPropagation();
        const next = previewStatusBtn.dataset.goalPreviewStatus;
        if (!PREVIEW_GOAL_SAMPLES[next] || next === previewStatus) return;
        previewStatus = next;
        openPreview(previewStatus);
        return;
      }
      const tabBtn = event.target.closest('#seasonTransitionModal [data-retro-tab]');
      if (tabBtn) {
        event.preventDefault();
        selectTab(tabBtn.dataset.retroTab);
        return;
      }
      const brasilBtn = event.target.closest('#seasonTransitionModal [data-retro-brasil]');
      if (brasilBtn && lastData) {
        event.preventDefault();
        const which = brasilBtn.dataset.retroBrasil;
        if (which === 'champions') brasilView.champions = brasilView.champions === 'states' ? 'national' : 'states';
        else brasilView.moves = brasilView.moves === 'all' ? 'mine' : 'all';
        renderBrasil(lastData);
        return;
      }
      const closeBtn = event.target.closest('#seasonTransitionModal #closeSeasonSummary');
      if (closeBtn) {
        event.preventDefault();
        event.stopPropagation();
        if (previewMode) {
          exitPreview();
          return;
        }
        if (onCloseSeasonSummary) onCloseSeasonSummary();
        else $('#seasonTransitionModal')?.classList.add('hidden');
        return;
      }
      const button = event.target.closest('#startNextSeason');
      if (!button) return;
      if (previewMode) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onStartNextSeason?.();
    });
  };

  const injectDom = () => {
    if (!$('#seasonTransitionModal')) {
      document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
    }
    bindHandlers();
  };

  const pane = key => $('#seasonTransitionModal')?.querySelector(`[data-retro-pane="${key}"]`);

  const selectTab = key => {
    const modal = $('#seasonTransitionModal');
    if (!modal) return;
    modal.querySelectorAll('[data-retro-tab]').forEach(button => {
      const active = button.dataset.retroTab === key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    modal.querySelectorAll('[data-retro-pane]').forEach(section => {
      section.classList.toggle('is-active', section.dataset.retroPane === key);
    });
  };

  const sec = (title, extra = '') => `<header class="retro-sec"><h3>${esc(title)}</h3>${extra}</header>`;

  const goalBlock = goal => {
    if (!goal?.label) return '';
    const statusLabel = { exceeded: 'Superou a meta', met: 'Meta cumprida', near: 'Quase alcançou', missed: 'Meta não cumprida' }[goal.status] || 'Avaliação';
    const delta = Number(goal.boardDelta) || 0;
    const deltaText = delta > 0 ? `Diretoria +${delta}` : delta < 0 ? `Diretoria ${delta}` : 'Diretoria sem alteração';
    const status = goal.status || 'met';
    return `<div id="seasonGoalResult" class="retro-goal goal-${esc(status)}">
      ${seasonGoalGauge(status)}
      <div class="retro-goal-copy">
        <span class="retro-goal-kicker">META DA DIRETORIA</span>
        <strong>${esc(goal.label)}</strong>
        <em class="is-${esc(status)}">${esc(statusLabel)} · ${esc(deltaText)}</em>
        ${goal.feeling ? `<small>${esc(goal.feeling)}</small>` : ''}
      </div>
    </div>`;
  };

  const objectivesBlock = result => {
    const items = Array.isArray(result?.items) ? result.items : [];
    if (!items.length) return '';
    const mark = { met: '✓', near: '½', missed: '✕' };
    const word = { met: 'cumprida', near: 'quase', missed: 'não cumprida' };
    return `<div class="retro-objectives">
      ${sec('Metas complementares')}
      <ul>${items
        .slice(0, 4)
        .map(item => `<li class="is-${esc(item.status || 'missed')}"><i>${mark[item.status] || '•'}</i><span>${esc(item.label)}</span><small>${word[item.status] || ''}</small></li>`)
        .join('')}</ul>
    </div>`;
  };

  const renderResumo = (data, retro) => {
    const comps = retro?.competitions || [];
    pane('resumo').innerHTML = `
      ${goalBlock(data.seasonGoalResult)}
      ${comps.length ? `<div class="retro-comps n-${Math.min(comps.length, 4)}">${comps.slice(0, 4).map(comp => retroCompCard(comp)).join('')}</div>` : ''}
      ${objectivesBlock(data.seasonObjectivesResult)}
      ${retro?.president ? `<blockquote class="retro-quote">“${esc(retro.president)}”<cite>— Presidente</cite></blockquote>` : ''}
      ${data.leadText ? `<p class="retro-lead">${esc(data.leadText)}</p>` : ''}`;
  };

  const highlightTile = (label, item, kind) => {
    if (!item) return retroTile(label, '—', '', kind);
    return retroTile(label, item.value, item.detail, kind);
  };

  const signed = n => `${Number(n) > 0 ? '+' : Number(n) < 0 ? '−' : ''}${Math.abs(Number(n) || 0)}`;

  const renderCampanha = retro => {
    const total = retro?.total || { games: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, pct: 0 };
    const review = retro?.review || {};
    const per = retro?.perComp || [];
    const form = retro?.form || [];
    const vs = row => (row ? `vs ${row.opponent}${row.label ? ` · ${row.label}` : ''}` : '');
    const streak = n => (total.games ? { value: String(n || 0), detail: `jogo${n === 1 ? '' : 's'} seguidos` } : null);
    pane('campanha').innerHTML = `
      <div class="retro-tiles n-4">
        ${retroTile('Jogos', String(total.games), `${total.wins}V ${total.draws}E ${total.losses}D`)}
        ${retroTile('Aproveitamento', `${total.pct}%`, `${total.points || 0} pontos somados`, total.pct >= 55 ? 'good' : total.pct >= 40 ? 'mid' : 'bad')}
        ${retroTile('Saldo de gols', signed(total.gd), total.goalsKnown && total.games ? `${total.gf} marcados · ${total.ga} sofridos` : 'todas as competições', (total.gd || 0) >= 0 ? 'good' : 'bad')}
        <article class="retro-tile retro-form"><span>Últimos jogos</span><div class="retro-form-row">${form.length ? form.map(r => `<i class="r-${r === 'V' ? 'w' : r === 'E' ? 'd' : 'l'}">${r}</i>`).join('') : '<small>—</small>'}</div><small>&nbsp;</small></article>
      </div>
      <div class="retro-split">
        <div class="retro-col">
          ${sec('Por competição')}
          <div class="retro-table" role="table">
            <div class="retro-tr is-head" role="row"><span>Competição</span><span>J</span><span>V</span><span>E</span><span>D</span><span>Saldo</span><span>%</span></div>
            ${per.length ? per.map(row => `<div class="retro-tr" role="row"><span>${esc(row.label)}</span><span>${row.games}</span><span>${row.wins}</span><span>${row.draws}</span><span>${row.losses}</span><span>${signed(row.gd)}</span><span>${row.pct}</span></div>`).join('') : '<div class="retro-tr"><span>Nenhum jogo registrado</span></div>'}
          </div>
        </div>
        <div class="retro-col">
          ${sec('Marcas do ano')}
          <div class="retro-tiles n-2">
            ${highlightTile('Maior goleada', review.biggestWin ? { value: review.biggestWin.score, detail: vs(review.biggestWin) } : null, 'good')}
            ${highlightTile('Pior derrota', review.biggestDefeat ? { value: review.biggestDefeat.score, detail: vs(review.biggestDefeat) } : null, 'bad')}
            ${highlightTile('Sequência de vitórias', streak(review.winStreak), 'good')}
            ${highlightTile('Sequência de derrotas', streak(review.lossStreak), 'bad')}
            ${highlightTile('Maior público', review.maxCrowd ? { value: Number(review.maxCrowd.attendance).toLocaleString('pt-BR'), detail: vs(review.maxCrowd) } : null)}
            ${highlightTile('Menor público', review.minCrowd ? { value: Number(review.minCrowd.attendance).toLocaleString('pt-BR'), detail: vs(review.minCrowd) } : null)}
          </div>
        </div>
      </div>`;
  };

  const award = (kicker, row, value, tone) => `
    <div class="retro-award t-${tone}">
      <div><span>${esc(kicker)}</span><strong>${row ? esc(row.name) : '—'}${row?.pos ? ` <small>${esc(row.pos)}${row.age ? ` · ${row.age} anos` : ''}</small>` : ''}</strong></div>
      <b>${row ? esc(value(row)) : '—'}</b>
    </div>`;

  const XI_LAYOUT = {
    GOL: [[50, 88]],
    LAT: [[14, 66], [86, 66]],
    ZAG: [[37, 72], [63, 72]],
    MID: [[28, 47], [50, 52], [72, 47]],
    ATT: [[20, 22], [50, 16], [80, 22]],
  };

  const renderElenco = retro => {
    const a = retro?.awards || {};
    const xi = retro?.xi || {};
    const dots = Object.entries(XI_LAYOUT)
      .flatMap(([group, spots]) =>
        spots.map(([x, y], index) => {
          const row = xi[group]?.[index];
          return `<div class="retro-xi-dot${row ? '' : ' is-empty'}" style="left:${x}%;top:${y}%"><b>${row ? ratingText(row.avgRating) : '—'}</b><small>${row ? esc(shortPlayerName(row.name)) : 'sem nota'}</small></div>`;
        }),
      )
      .join('');
    pane('elenco').innerHTML = `
      <div class="retro-split is-xi">
        <div class="retro-col">
          ${sec('Prêmios da temporada')}
          ${award('Craque da temporada', a.best, row => `nota ${ratingText(row.avgRating)}`, 'lime')}
          ${award('Artilheiro', a.scorer, row => `${row.goals} gol${row.goals === 1 ? '' : 's'}`, 'gold')}
          ${award('Garçom', a.assister, row => `${row.assists} assist.`, 'cyan')}
          ${award('Revelação (até 21 anos)', a.revelation, row => `nota ${ratingText(row.avgRating)}`, 'green')}
          ${award('Mais jogos', a.apps, row => `${row.games} jogos`, 'ink')}
        </div>
        <div class="retro-col">
          ${sec('Seleção da temporada', '<small>melhor nota média por posição</small>')}
          <div class="retro-xi">${dots}</div>
        </div>
      </div>`;
  };

  const INFLOW_LABELS = { gate: 'Bilheteria', sponsorship: 'Patrocínios', naming: 'Naming rights', tv: 'Direitos de TV', prize: 'Premiações', transfers_in: 'Vendas de jogadores', bank_loan: 'Empréstimos', other_in: 'Outras receitas' };
  const OUTFLOW_LABELS = { wages: 'Folha salarial', staff: 'Comissão técnica', scouting: 'Olheiros', stadium: 'Estádio e jogos', upgrades: 'Obras e melhorias', loan_service: 'Juros e empréstimos', transfers_out: 'Contratações', other_out: 'Outras despesas' };

  const flowRows = (map, labels, sign) =>
    Object.entries(map || {})
      .filter(([, value]) => Number(value) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 6)
      .map(([key, value]) => `<div class="retro-line"><span>${esc(labels[key] || key)}</span><b class="${sign > 0 ? 'is-pos' : 'is-neg'}">${sign > 0 ? '+' : '−'}${esc(money(value))}</b></div>`)
      .join('');

  const renderFinancas = (data, retro) => {
    const cash = retro?.cash || {};
    const rewards = data.seasonRewards;
    const fmt = data.formatBudget || money;
    const net = Number(cash.net) || 0;
    const prizeLines = (rewards?.lines || []).slice(0, 4);
    pane('financas').innerHTML = `
      <div class="retro-tiles n-3">
        ${retroTile('Caixa no início', cash.start != null ? fmt(cash.start) : '—', '1º de janeiro')}
        ${retroTile('Caixa agora', cash.balance != null ? fmt(cash.balance) : '—', cash.balance != null ? `${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))} no ano` : '', net >= 0 ? 'good' : 'bad')}
        ${retroTile('Premiação da temporada', rewards?.total ? `+${fmt(rewards.total)}` : '—', rewards?.total ? (rewards.prizeCredited === false ? 'a creditar' : 'creditada no caixa') : 'nenhuma premiação', 'good')}
      </div>
      <div class="retro-split">
        <div class="retro-col">
          ${sec('Entradas do ano', cash.totalIn ? `<small>${esc(fmt(cash.totalIn))}</small>` : '')}
          ${flowRows(cash.inflows, INFLOW_LABELS, 1) || '<div class="retro-line"><span>Sem entradas registradas</span></div>'}
          ${prizeLines.length ? `${sec('Premiações creditadas')}${prizeLines.map(line => `<div class="retro-line"><span>${esc(String(line.label || '').replace(/Campeonato\s+([^·]+?)\s*·\s*Divisão 1/i, 'Estadual $1'))}</span><b class="is-pos">+${esc(fmt(line.amount))}</b></div>`).join('')}` : ''}
        </div>
        <div class="retro-col">
          ${sec('Saídas do ano', cash.totalOut ? `<small>${esc(fmt(cash.totalOut))}</small>` : '')}
          ${flowRows(cash.outflows, OUTFLOW_LABELS, -1) || '<div class="retro-line"><span>Sem saídas registradas</span></div>'}
          <div class="retro-line is-net"><span>Resultado do ano</span><b class="${net >= 0 ? 'is-pos' : 'is-neg'}">${net >= 0 ? '+' : '−'}${esc(fmt(Math.abs(net)))}</b></div>
          <div class="retro-line is-total"><span>Orçamento para ${esc(retro?.next?.year || '')}</span><b>${esc(fmt(rewards?.budgetAfter ?? cash.balance ?? 0))}</b></div>
        </div>
      </div>`;
  };

  let brasilView = { champions: 'national', moves: 'mine' };
  let lastData = null;

  const championChip = entry => `
    <div class="retro-champ${entry.isUserClub ? ' is-user' : ''}">
      ${teamCrestHtml(entry.clubName, { className: 'retro-champ-crest' })}
      <div><span>${esc(entry.label)}</span><strong>${esc(entry.clubName)}</strong></div>
    </div>`;

  const renderBrasil = data => {
    const bundle = buildChampionEntries({
      champions: data.champions,
      championEstaduais: data.championEstaduais,
      userClub: data.userClub,
      userDivision: data.userDivision,
      recopaSubtitle: data.recopaSubtitle,
    });
    const shortState = label => String(label || 'Estadual').replace(/\s*·\s*Divisão 1$/i, '').replace(/^Campeonato\s+/i, 'Estadual ');
    const estaduais = (bundle.estaduais || []).map(entry => ({ ...entry, label: shortState(entry.label) }));
    const national = bundle.nav.filter(entry => entry.competitionId !== 'ESTADUAIS');
    const userState = data.campaign?.stateLeague?.label;
    const myState = estaduais.find(entry => userState && entry.label === shortState(userState));
    if (myState) national.push(myState);
    const showStates = brasilView.champions === 'states' && estaduais.length;
    const champList = showStates ? estaduais : national;
    const division = data.userDivision;
    const touches = move => move.title.includes(`Série ${division}`) || move.clubs.includes(data.userClub);
    const moves = (data.movements || []).filter(move => (brasilView.moves === 'all' ? true : touches(move)));
    pane('brasil').innerHTML = `
      <div class="retro-split">
        <div class="retro-col">
          ${sec(showStates ? `Campeões estaduais (${estaduais.length})` : 'Campeões', estaduais.length ? `<button type="button" class="retro-link" data-retro-brasil="champions">${showStates ? '‹ nacionais' : `estaduais (${estaduais.length}) ›`}</button>` : '')}
          <div class="retro-champs${showStates ? ' is-dense' : ''}">${champList.map(championChip).join('') || '<small>Sem campeões registrados</small>'}</div>
        </div>
        <div class="retro-col">
          ${sec(brasilView.moves === 'all' ? 'Acessos e rebaixamentos' : `Mexe com a Série ${division}`, `<button type="button" class="retro-link" data-retro-brasil="moves">${brasilView.moves === 'all' ? '‹ só a minha série' : 'ver todas as séries ›'}</button>`)}
          <div id="seasonMovements" class="retro-moves${brasilView.moves === 'all' ? ' is-all' : ''}">
            ${moves
              .map(
                move => `<div class="retro-move is-${move.type}">
                  <span>${move.type === 'promote' ? '↑' : '↓'} ${esc(move.title.replace('→', '→'))}</span>
                  <p>${move.clubs.length ? move.clubs.map(name => `<b class="${name === data.userClub ? 'is-user' : ''}">${esc(name)}</b>`).join('') : '<b>—</b>'}</p>
                </div>`,
              )
              .join('')}
          </div>
        </div>
      </div>`;
  };

  const open = data => {
    const {
      userClub,
      careerSeason,
      userLine,
      idleNote = '',
      seasonGoalResult = null,
      preview = false,
      retro = null,
    } = data;
    injectDom();
    lastData = data;
    brasilView = { champions: 'national', moves: 'mine' };
    previewMode = !!preview;
    if (preview && seasonGoalResult?.status && PREVIEW_GOAL_SAMPLES[seasonGoalResult.status]) {
      previewStatus = seasonGoalResult.status;
    }
    $('#seasonSummaryTitle').textContent = `Retrospectiva ${careerSeason}`;
    const crest = $('#seasonRetroCrest');
    if (crest) crest.innerHTML = teamCrestHtml(userClub);
    const summary = $('#seasonTransitionSummary');
    if (summary) {
      summary.className = `retro-foot-line ${data.userStatus || 'neutral'}`;
      summary.textContent = `${userLine}${idleNote}`;
    }
    const startBtn = $('#startNextSeason');
    if (startBtn && !previewMode) startBtn.textContent = `AVANÇAR PARA ${Number(careerSeason) + 1} →`;
    renderResumo(data, retro);
    renderCampanha(retro);
    renderElenco(retro);
    renderFinancas(data, retro);
    renderBrasil(data);
    selectTab('resumo');
    syncPreviewChrome();
    $('#seasonTransitionModal').classList.remove('hidden');
  };

  /**
   * Abre o balanço com dados fictícios só para validar o medidor da meta.
   * Não chama callbacks de temporada e não altera save/carreira.
   */
  const openPreview = (status = 'missed') => {
    previewStatus = PREVIEW_GOAL_SAMPLES[status] ? status : 'missed';
    const sample = PREVIEW_GOAL_SAMPLES[previewStatus];
    const emptyLeaders = { scorers: [], assistants: [] };
    open({
      userClub: 'Atlético Preview',
      careerSeason: 2027,
      userLine: 'Permanecerá na Série D em 2028. (dados fictícios do preview)',
      userStatus: 'neutral',
      leadText: 'Preview seguro: use os botões da meta para trocar o status do medidor. Fechar não altera a carreira.',
      userDivision: 'D',
      champions: {
        A: 'Santos',
        B: 'Athletic',
        C: 'Paysandu',
        D: 'Atlético Preview',
        CUP: 'Santos',
        RECOPA: 'Santos',
      },
      recopaSubtitle: 'Título unificado (Brasileirão + Copa)',
      championEstaduais: [
        { key: 'EST:SP', uf: 'SP', label: 'Paulista', clubName: 'Corinthians' },
        { key: 'EST:RJ', uf: 'RJ', label: 'Carioca', clubName: 'Flamengo' },
      ],
      leadersByDivision: {
        A: emptyLeaders,
        B: emptyLeaders,
        C: emptyLeaders,
        D: emptyLeaders,
        CUP: emptyLeaders,
      },
      movements: [
        { title: 'Acesso à Série C', clubs: ['Clube Norte', 'Clube Sul'], type: 'promote' },
        { title: 'Permanece na Série D', clubs: ['Atlético Preview'], type: 'relegate' },
      ],
      seasonRewards: null,
      seasonGoalResult: { ...sample },
      preview: true,
    });
  };

  const close = () => {
    if (previewMode) {
      exitPreview();
      return;
    }
    $('#seasonTransitionModal')?.classList.add('hidden');
  };

  const setIdleSimStatus = text => {
    injectDom();
    const el = $('#idleSeasonSimStatus');
    if (el) el.textContent = text;
  };

  const openIdleSim = () => {
    injectDom();
    $('#idleSeasonSimModal')?.classList.remove('hidden');
  };

  const closeIdleSim = () => $('#idleSeasonSimModal')?.classList.add('hidden');

  const init = () => injectDom();

  return {
    moduleVersion: MODULE_VERSIONS.seasonSummary,
    init,
    open,
    openPreview,
    close,
    openIdleSim,
    closeIdleSim,
    setIdleSimStatus,
  };
}
