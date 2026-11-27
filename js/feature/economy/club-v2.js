import { teamCrestHtml } from '../../ui/team-crest.js';
import { seasonGoalLiveProgress } from '../../engine/season-goals.js';
import { seasonObjectiveLiveProgress } from '../../engine/season-objectives.js';
import { hydrateClubHistoryCard } from '../../ui/club-history-card.js';
import { resolveChampionshipTrophyKey } from '../../ui/competition-trophies.js';

/**
 * Clube v2: Visão geral (aba nova), extras de Finanças (gráfico e projeção),
 * e História (sala de troféus + temporadas). Só lê dados que o jogo já tem;
 * não altera regras de economia, diretoria ou demissão.
 */

const esc = value =>
  String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const clampPct = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const tone = pct => (pct >= 70 ? 'ok' : pct >= 45 ? 'warn' : 'low');
const avg = list => (list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null);

const DIVISION_ROUNDS = { A: 38, B: 38, C: 19, D: 14 };

export function createClubV2(ctx) {
  const {
    $,
    userClubState,
    getUserClub,
    getUserDivision,
    getCareerSeason,
    getCurrentRound,
    getBalance,
    formatBudget,
    formatCapacity,
    estimateRoundRecurringRevenue,
    estimateRoundCostBill,
    evaluateRosterPayroll,
    bankLoanStatus,
    getStructureLevel,
    getPitchLevel,
    getSeasonGoal,
    getSeasonGoalLiveContext,
    getSeasonObjectives,
    getSeasonObjectivesResult,
    getNationalRankingEntries,
    openView,
    buildHistorySeasons,
  } = ctx;

  // ---------- Leituras comuns ----------
  const objectivesWithProgress = club => {
    const goalCtx = getSeasonGoalLiveContext?.(club) || {};
    const results = getSeasonObjectivesResult?.();
    const finalById = results?.items?.length ? Object.fromEntries(results.items.map(item => [item.id, item])) : null;
    const items = [];
    const goal = getSeasonGoal?.();
    if (goal?.label) {
      let progress = { score: 0, status: 'pending' };
      try {
        progress = seasonGoalLiveProgress(goal, goalCtx);
      } catch {
        /* sem contexto */
      }
      items.push({ id: 'goal', label: goal.label, category: 'tournament', progress });
    }
    (getSeasonObjectives?.() || []).forEach(item => {
      const final = finalById?.[item.id];
      let progress = final ? { score: final.score, status: final.status, hint: final.hint } : null;
      if (!progress) {
        try {
          progress = seasonObjectiveLiveProgress(item, goalCtx, club);
        } catch {
          progress = { score: 0, status: 'pending' };
        }
      }
      items.push({ id: item.id, label: item.label, category: item.category, progress });
    });
    return items;
  };

  const isDone = progress => progress?.status === 'met' || progress?.status === 'exceeded' || Number(progress?.score) >= 100;

  const financeSummary = club => {
    const division = getUserDivision?.() || club.division || 'A';
    const staffOpts = { managerReputation: club.managerReputation };
    const revenue = Math.round(estimateRoundRecurringRevenue?.(club, division) || 0);
    const cost = Math.round(estimateRoundCostBill?.(club, division, staffOpts) || 0);
    const payroll = evaluateRosterPayroll?.(club, { division }) || null;
    const rounds = DIVISION_ROUNDS[division] || 38;
    const played = Math.max(0, Math.min(rounds, (Number(getCurrentRound?.()) || 1) - 1));
    const remaining = Math.max(0, rounds - played);
    const balance = getBalance(club);
    const result = revenue - cost;
    return {
      division,
      revenue,
      cost,
      result,
      balance,
      remaining,
      projection: balance + result * remaining,
      payrollPct: payroll?.pctBefore ?? (revenue > 0 ? Math.round(((payroll?.wageBefore || 0) / revenue) * 100) : 0),
      payrollLimitPct: payroll?.revenue > 0 && payroll?.criticalLimit ? Math.round((payroll.criticalLimit / payroll.revenue) * 100) : null,
      wage: payroll?.wageBefore || 0,
      wageLimit: payroll?.criticalLimit || 0,
    };
  };

  // ---------- Visão geral ----------
  const bar = (pct, cls = '') => `<span class="clubv2-bar ${cls}"><i style="width:${clampPct(pct)}%"></i></span>`;
  const pips = (level, max) =>
    `<span class="clubv2-pips" aria-label="Nível ${level} de ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')}</span>`;

  const renderHub = () => {
    const host = $('#clubHubBody');
    const club = userClubState();
    if (!host || !club) return;
    const name = getUserClub();
    const fin = financeSummary(club);
    const objectives = objectivesWithProgress(club);
    const byCat = cat => objectives.filter(item => item.category === cat).map(item => clampPct(item.progress?.score));
    const board = clampPct(club.board ?? 60);
    const environment = clampPct(club.environment ?? 60);
    const financeArea = avg(byCat('economy')) ?? clampPct(club.finances ?? 50);
    const areas = [
      ['Resultados', avg(byCat('tournament')) ?? board],
      ['Finanças', financeArea],
      ['Estrutura', avg(byCat('structure')) ?? 50],
      ['Torcida', environment],
    ];
    const rankEntries = getNationalRankingEntries?.() || {};
    const titles = (rankEntries[name]?.titles || []).length;
    const stadiumCap = Number(club.stadiumCapacity) || 0;

    const identity = `<section class="clubv2-identity">${teamCrestHtml(name, { className: 'clubv2-crest' })}<div class="clubv2-identity-name"><strong>${esc(name)}</strong><span>Série ${esc(fin.division)} · ${esc(club.stadiumName || 'Estádio')}${stadiumCap ? ` (${esc(formatCapacity(stadiumCap))})` : ''}${titles ? ` · ${titles} ${titles === 1 ? 'título' : 'títulos'}` : ''}</span></div><div class="clubv2-identity-stat"><small>SALDO</small><strong class="is-gold">${esc(formatBudget(fin.balance))}</strong></div><div class="clubv2-identity-stat"><small>DIRETORIA</small><strong data-tone="${tone(board)}">${board}%</strong></div><div class="clubv2-identity-stat"><small>TORCIDA</small><strong data-tone="${tone(environment)}">${environment}%</strong></div></section>`;

    const confidence = `<section class="clubv2-card"><span class="clubv2-title">CONFIANÇA DA DIRETORIA</span><div class="clubv2-big"><strong data-tone="${tone(board)}">${board}%</strong><span>${board >= 70 ? 'Diretoria satisfeita' : board >= 45 ? 'Diretoria atenta' : 'Cargo sob pressão'}</span></div>${areas
      .map(([label, value]) => `<div class="clubv2-area"><span>${label}</span>${bar(value, tone(value))}<b data-tone="${tone(value)}">${clampPct(value)}%</b></div>`)
      .join('')}<small class="clubv2-note">Áreas: andamento das metas de cada tipo e ambiente da torcida.</small></section>`;

    const finance = `<section class="clubv2-card"><span class="clubv2-title is-gold">FINANÇAS · POR RODADA</span><div class="clubv2-duo"><div><small>RECEITA</small><strong data-tone="ok">${esc(formatBudget(fin.revenue))}</strong></div><div><small>CUSTO</small><strong data-tone="warn">${esc(formatBudget(fin.cost))}</strong></div></div><div class="clubv2-kv"><span>Resultado por rodada</span><b data-tone="${fin.result >= 0 ? 'ok' : 'low'}">${fin.result >= 0 ? '+ ' : '− '}${esc(formatBudget(Math.abs(fin.result)))}</b></div><div class="clubv2-kv"><span>Folha salarial</span><b>${esc(formatBudget(fin.wage))}${fin.wageLimit ? ` · limite ${esc(formatBudget(fin.wageLimit))}` : ''}</b></div>${bar(fin.wageLimit ? (fin.wage / fin.wageLimit) * 100 : fin.payrollPct, fin.wageLimit && fin.wage > fin.wageLimit * 0.9 ? 'warn' : 'info')}<div class="clubv2-kv"><span>Folha / receita recorrente</span><b>${fin.payrollPct}%</b></div><div class="clubv2-kv"><span>Projeção no fim da temporada</span><b class="is-gold">${esc(formatBudget(fin.projection))}</b></div><button type="button" class="clubv2-btn" data-clubv2-go="office">VER FINANÇAS →</button></section>`;

    const metaIcon = item => (isDone(item.progress) ? 'ok' : item.progress?.status === 'missed' ? 'low' : item.progress?.status === 'near' ? 'warn' : 'pending');
    const metas = `<section class="clubv2-card"><span class="clubv2-title">METAS DA TEMPORADA · ${objectives.filter(item => isDone(item.progress)).length} DE ${objectives.length} EM DIA</span><div class="clubv2-goals">${objectives
      .map(item => `<div class="clubv2-goal" data-tone="${metaIcon(item)}"><i aria-hidden="true">${metaIcon(item) === 'ok' ? '✓' : metaIcon(item) === 'low' ? '×' : metaIcon(item) === 'warn' ? '!' : ''}</i><div><b>${esc(item.label)}</b><small>${esc(item.progress?.hint || `${clampPct(item.progress?.score)}%`)}</small></div></div>`)
      .join('') || '<p class="clubv2-empty">A diretoria ainda não definiu metas.</p>'}</div></section>`;

    // Decisões pendentes: metas de estrutura/finanças em aberto e alertas de caixa.
    const decisions = [];
    if (fin.balance < 0) decisions.push({ tone: 'low', text: 'Caixa no vermelho: o cheque especial está cobrando juros.', go: 'office', label: 'FINANÇAS' });
    if (club.financialRestriction?.active) decisions.push({ tone: 'low', text: 'Restrição financeira: compras de jogadores suspensas.', go: 'office', label: 'FINANÇAS' });
    const loan = bankLoanStatus?.(club, { division: fin.division });
    if (loan?.delinquent) decisions.push({ tone: 'low', text: `Empréstimo em atraso há ${loan.delinquencyStreak} rodada(s).`, go: 'office', label: 'FINANÇAS' });
    objectives
      .filter(item => item.category === 'structure' && !isDone(item.progress))
      .forEach(item => decisions.push({ tone: 'warn', text: `A diretoria pede: <strong>${esc(item.label)}</strong>.`, go: 'stadium', label: 'VER OBRAS' }));
    objectives
      .filter(item => item.category === 'economy' && !isDone(item.progress))
      .forEach(item => decisions.push({ tone: 'info', text: `Meta financeira em aberto: <strong>${esc(item.label)}</strong>.`, go: 'office', label: 'FINANÇAS' }));
    const pending = `<section class="clubv2-card"><span class="clubv2-title is-orange">DECISÕES PENDENTES</span><div class="clubv2-decisions">${
      decisions.length
        ? decisions.slice(0, 4).map(item => `<div class="clubv2-decision" data-tone="${item.tone}"><span>${item.text}</span><button type="button" class="clubv2-btn" data-clubv2-go="${item.go}">${item.label}</button></div>`).join('')
        : '<div class="clubv2-decision" data-tone="ok"><span>Tudo em dia: nenhuma decisão pendente no clube.</span></div>'
    }</div></section>`;

    const structureRow = (label, level, max) => `<div class="clubv2-struct"><span>${label}</span>${pips(level, max)}</div>`;
    const structure = `<section class="clubv2-card"><span class="clubv2-title">ESTRUTURA</span>${structureRow('Estádio', Number(getStructureLevel?.(club)) || 0, 5)}${structureRow('Gramado', Number(getPitchLevel?.(club)) || 0, 5)}${structureRow('Departamento médico', Number(club.medicalInvestment) || 0, 5)}${structureRow('Prevenção de lesões', Number(club.preventionProgram) || 0, 3)}<div class="clubv2-kv"><span>Capacidade</span><b>${esc(formatCapacity(stadiumCap))}</b></div><div class="clubv2-kv"><span>Ambiente no estádio</span><b data-tone="${tone(environment)}">${environment}%</b></div><button type="button" class="clubv2-btn clubv2-btn-end" data-clubv2-go="stadium">VER OBRAS →</button></section>`;

    host.innerHTML = `${identity}<div class="clubv2-grid"><div class="clubv2-cell" style="grid-area:conf">${confidence}</div><div class="clubv2-cell" style="grid-area:fin">${finance}</div><div class="clubv2-cell" style="grid-area:struct">${structure}</div><div class="clubv2-cell" style="grid-area:goals">${metas}</div><div class="clubv2-cell" style="grid-area:dec">${pending}</div></div>`;
  };

  // ---------- Finanças: receitas × custos por rodada + saldo ----------
  const RECURRING_IN = { sponsorship: 'sponsor', naming_rights: 'sponsor', tv_rights: 'tv', tv_advance: 'tv', gate_receipt: 'gate' };
  const RECURRING_OUT = { wages: 'wages', loan_out_wages: 'wages', staff_wages: 'staff', scout_wages: 'staff', scout_travel: 'staff', stadium_ops: 'stadium', matchday_operations: 'stadium' };

  const renderFinanceExtras = () => {
    const club = userClubState();
    const chartHost = $('#clubFinanceChart');
    const saldoHost = $('#clubFinanceSaldo');
    if (!club || !chartHost || !saldoHost) return;
    const fin = financeSummary(club);
    const ledger = Array.isArray(club.budgetLedger) ? club.budgetLedger : [];
    const rounds = new Map();
    ledger.forEach(entry => {
      const key = entry?.round;
      if (key == null || key === '') return;
      const amount = Math.max(0, Number(entry.amount) || 0);
      if (!amount) return;
      const inKey = entry.type === 'credit' ? RECURRING_IN[entry.reason] : null;
      const outKey = entry.type !== 'credit' ? RECURRING_OUT[entry.reason] : null;
      if (!inKey && !outKey) return;
      if (!rounds.has(key)) rounds.set(key, { key, sponsor: 0, tv: 0, gate: 0, wages: 0, staff: 0, stadium: 0 });
      rounds.get(key)[inKey || outKey] += amount;
    });
    // ledger vem do mais novo para o mais antigo
    const past = [...rounds.values()].slice(0, 9).reverse();
    const projected = Array.from({ length: Math.max(3, 12 - past.length) }, (_, i) => ({ key: `+${i + 1}`, projected: true }));
    const columns = [...past, ...projected];
    const values = columns.map(col =>
      col.projected ? { inTotal: fin.revenue, outTotal: fin.cost } : { inTotal: col.sponsor + col.tv + col.gate, outTotal: col.wages + col.staff + col.stadium },
    );
    const max = Math.max(1, ...values.map(v => Math.max(v.inTotal, v.outTotal)));
    const seg = (value, cls) => (value > 0 ? `<i class="${cls}" style="height:${(value / max) * 100}%"></i>` : '');
    const cols = columns
      .map((col, index) => {
        const v = values[index];
        const label = col.projected ? col.key : String(col.key).replace(/^R(?=\d)/, '');
        const ins = col.projected ? seg(v.inTotal, 'in-proj') : `${seg(col.gate, 'in-gate')}${seg(col.tv, 'in-tv')}${seg(col.sponsor, 'in-sponsor')}`;
        const outs = col.projected ? seg(v.outTotal, 'out-proj') : `${seg(col.wages, 'out-wages')}${seg(col.staff, 'out-staff')}${seg(col.stadium, 'out-stadium')}`;
        return `<div class="clubv2-col${col.projected ? ' is-projected' : ''}" title="${col.projected ? 'Projeção' : `Rodada ${esc(label)}`} · entrou ${esc(formatBudget(v.inTotal))} · saiu ${esc(formatBudget(v.outTotal))}"><div class="clubv2-col-bars"><span class="clubv2-col-in">${ins}</span><span class="clubv2-col-out">${outs}</span></div><small>${esc(label)}</small></div>`;
      })
      .join('');
    chartHost.innerHTML = `<div class="clubv2-chart">${cols}</div><div class="clubv2-legend"><span><i class="in-sponsor"></i>Patrocínio</span><span><i class="in-tv"></i>TV</span><span><i class="in-gate"></i>Bilheteria</span><span><i class="out-wages"></i>Folha</span><span><i class="out-staff"></i>Comissão</span><span><i class="out-stadium"></i>Estádio</span><span><i class="in-proj"></i>Projeção</span></div><small class="clubv2-note">${past.length ? 'Rodadas já pagas e, depois, a projeção pelas estimativas atuais.' : 'Ainda sem rodadas pagas: barras mostram a projeção pelas estimativas atuais.'} Transferências e obras ficam fora.</small>`;

    let low = fin.balance;
    let lowRound = 0;
    for (let i = 1; i <= fin.remaining; i += 1) {
      const value = fin.balance + fin.result * i;
      if (value < low) {
        low = value;
        lowRound = i;
      }
    }
    saldoHost.innerHTML = `<strong class="clubv2-saldo${fin.balance < 0 ? ' is-negative' : ''}">${esc(formatBudget(fin.balance))}</strong><div class="clubv2-kv"><span>Resultado por rodada</span><b data-tone="${fin.result >= 0 ? 'ok' : 'low'}">${fin.result >= 0 ? '+ ' : '− '}${esc(formatBudget(Math.abs(fin.result)))}</b></div><div class="clubv2-kv"><span>Rodadas restantes</span><b>${fin.remaining}</b></div><div class="clubv2-kv"><span>Projeção no fim da temporada</span><b class="is-gold">${esc(formatBudget(fin.projection))}</b></div><div class="clubv2-kv"><span>Pior momento previsto</span><b data-tone="${low < 0 ? 'low' : ''}">${lowRound ? `${esc(formatBudget(low))} · em ${lowRound} rodada(s)` : 'Saldo só sobe'}</b></div><small class="clubv2-note">Projeção sem contar transferências, obras e prêmios.</small>`;
  };

  // ---------- História ----------
  const renderHistory = () => {
    const host = $('#clubHistoryBody');
    if (!host) return;
    const name = getUserClub();
    const seasons = buildHistorySeasons?.(name) || [];
    const trophyCount = new Map();
    seasons.forEach(season =>
      (season.titles || []).forEach(title => {
        const current = trophyCount.get(title.key) || { label: title.label, count: 0 };
        current.count += 1;
        trophyCount.set(title.key, current);
      }),
    );
    const totals = seasons.reduce(
      (acc, season) => ({ played: acc.played + (season.played || 0), wins: acc.wins + (season.wins || 0), draws: acc.draws + (season.draws || 0), losses: acc.losses + (season.losses || 0) }),
      { played: 0, wins: 0, draws: 0, losses: 0 },
    );
    // Sala de troféus: todas as competições, mesmo sem título (fica apagada).
    const ROOM = [
      ['A', 'Série A'], ['B', 'Série B'], ['C', 'Série C'], ['D', 'Série D'],
      ['CUP', 'Copa do Brasil'], ['ESTADUAIS', 'Estadual'], ['LIBERTADORES', 'Libertadores'],
      ['SUDAMERICANA', 'Sul-Americana'], ['RECOPA', 'Recopa Nacional'],
    ];
    const extra = [...trophyCount.keys()].filter(key => !ROOM.some(([id]) => id === key)).map(key => [key, trophyCount.get(key).label]);
    const room = [...ROOM, ...extra]
      .map(([key, label]) => {
        const count = trophyCount.get(key)?.count || 0;
        return `<div class="clubv2-trophy${count ? '' : ' is-empty'}"><span data-trophy-key="${esc(resolveChampionshipTrophyKey(key))}" aria-hidden="true"></span><strong>${count}</strong><small>${esc(label)}</small></div>`;
      })
      .join('');
    const pct = totals.played ? Math.round(((totals.wins * 3 + totals.draws) / (totals.played * 3)) * 100) : 0;
    const seasonRows = seasons.length
      ? seasons
          .map(
            season => `<div class="clubv2-season"><strong>${esc(season.year)}</strong><span class="clubv2-season-comps">${esc((season.competitions || []).join(' · ') || '—')}</span><span class="clubv2-season-rec"><b>${season.played || 0}</b> J · <b data-tone="ok">${season.wins || 0}</b> V · <b>${season.draws || 0}</b> E · <b data-tone="low">${season.losses || 0}</b> D</span><span class="clubv2-season-titles">${(season.titles || []).map(title => `<em>${esc(title.label)}</em>`).join('') || '<small>—</small>'}</span></div>`,
          )
          .join('')
      : '<p class="clubv2-empty">Nenhuma temporada registrada ainda.</p>';
    host.innerHTML = `<section class="clubv2-card clubv2-room"><span class="clubv2-title is-gold">SALA DE TROFÉUS</span><div class="clubv2-trophies">${room}</div></section><div class="clubv2-history-grid"><section class="clubv2-card"><span class="clubv2-title">TEMPORADAS</span><div class="clubv2-seasons">${seasonRows}</div></section><section class="clubv2-card"><span class="clubv2-title is-gold">NA SUA CARREIRA</span><div class="clubv2-kv"><span>Temporadas</span><b>${seasons.length}</b></div><div class="clubv2-kv"><span>Jogos</span><b>${totals.played}</b></div><div class="clubv2-kv"><span>Vitórias</span><b data-tone="ok">${totals.wins}</b></div><div class="clubv2-kv"><span>Empates</span><b>${totals.draws}</b></div><div class="clubv2-kv"><span>Derrotas</span><b data-tone="low">${totals.losses}</b></div><div class="clubv2-kv"><span>Aproveitamento</span><b>${pct}%</b></div><div class="clubv2-kv"><span>Títulos</span><b class="is-gold">${[...trophyCount.values()].reduce((s, item) => s + item.count, 0)}</b></div></section></div>`;
    hydrateClubHistoryCard(host);
  };

  const bind = () => {
    ['#clubhub', '#office', '#stadium', '#clubhistory'].forEach(selector => {
      const root = $(selector);
      if (!root || root.dataset.clubv2Bound) return;
      root.dataset.clubv2Bound = '1';
      root.addEventListener('click', event => {
        const go = event.target.closest('[data-clubv2-go]');
        if (go) {
          openView?.(go.dataset.clubv2Go);
          return;
        }
        const loanToggle = event.target.closest('[data-clubv2-loan]');
        if (loanToggle) {
          const card = $('#officeBankLoan');
          const open = !card?.classList.contains('is-open');
          card?.classList.toggle('is-open', open);
          loanToggle.setAttribute('aria-expanded', String(open));
          loanToggle.textContent = open ? 'FECHAR SIMULAÇÃO' : 'SIMULAR EMPRÉSTIMO';
        }
      });
    });
  };

  return { renderHub, renderFinanceExtras, renderHistory, bind, financeSummary };
}
