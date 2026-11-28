import {
  ACADEMY_MAX_LEVEL,
  SCOUTING_MAX_LEVEL,
  YOUTH_ROSTER_MAX,
  YOUTH_STRUCTURE_UNLOCK,
  YOUTH_PROMOTION_MIN_AGE,
  REGION_OPTIONS,
  SCOUT_LOCK_MONTHS,
  academyUpgradeCost,
  scoutingUpgradeCost,
  getAcademyLevel,
  getScoutingDeptLevel,
  getEffectiveScoutingLevel,
  getScoutSlotCount,
  isYouthAcademyUnlocked,
  youthSlotsUsed,
  youthSlotsFree,
  starsMarkup,
  youthStarRating,
  purchaseAcademyUpgrade,
  purchaseScoutingUpgrade,
  signScoutReport,
  dismissScoutReport,
  promoteYouthPlayer,
  releaseYouthPlayer,
  syncScoutSlots,
  runScoutSearch,
  listAvailableScouts,
  isScoutLocked,
  formatScoutLockDate,
  scoutRegionLabel,
  scoutGradeLabel,
  SCOUT_TALENT_COUNT_ODDS,
  SCOUT_TALENT_STAR_ODDS,
  estimateScoutStaffBill,
  estimateScoutTravelCost,
  isValidScoutRegion,
  ensureYouthState,
  formatScoutReportBody,
  purgeExpiredScoutReports,
  estimateYouthSigningCost,
  estimateYouthWageBill,
  computeYouthWage,
  INTAKE_BY_ACADEMY,
  SCOUT_SLOTS_BY_DEPT,
  SCOUT_GRADE_ODDS_BY_DEPT,
  YOUTH_AGE_MAX,
} from '../../engine/youth-academy.js';
import { estimateStaffBill, getStructureLevel, listStadiumUpgrades } from '../../engine/economy.js';

/**
 * UI — Categoria de Base (infra, olheiros, elenco U-20).
 */
export function createYouthAcademyFeature(deps) {
  const {
    $,
    onClick,
    formatBudget,
    getBalance,
    getUserClub,
    userClubState,
    getClubs,
    getUserDivision,
    getCareerSeason,
    getCareerDate,
    evaluateRosterPayroll,
    pushMessage,
    openPlayerCard,
    structureLevelLabel: structureLabelFn,
    firstNames,
    lastNames,
    onBudgetChanged,
    getRetiredPool,
    isOffSeason,
    openView,
  } = deps;

  const YOUTH_AGE_MAX_UI = YOUTH_AGE_MAX;
  let activeTab = 'squad';
  let pendingRegion = '';
  let pendingScout = '';

  const structureLabel = level =>
    typeof structureLabelFn === 'function' ? structureLabelFn(level) : structureLevelLabel(level);

  // Relatório do olheiro v2: um cartão por talento, decisão dentro do relatório.
  let scoutReportSlot = null;
  const ensureScoutReportModal = () => {
    const old = document.getElementById('youthScoutReportModal');
    if (old && !old.querySelector('.sr3')) old.remove();
    if (document.getElementById('youthScoutReportModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="youthScoutReportModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="youthScoutReportTitle">
        <div class="modal-card sr3">
          <header class="sr3-head"><div class="sr3-title"><span class="sr3-kicker">BASE · RELATÓRIO DO OLHEIRO</span><h2 id="youthScoutReportTitle">Relatório</h2></div><button type="button" class="close" id="youthScoutReportX" aria-label="Fechar">×</button></header>
          <div class="sr3-body" id="youthScoutReportBody"></div>
          <footer class="sr3-foot"><button type="button" id="youthScoutReportClose" class="av2-btn">FECHAR</button></footer>
        </div>
      </div>
    `);
    const modal = document.getElementById('youthScoutReportModal');
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('#youthScoutReportClose') || event.target.closest('#youthScoutReportX')) { closeScoutReportModal(); return; }
      const sign = event.target.closest('[data-sr3-sign]');
      const dismiss = event.target.closest('[data-sr3-dismiss]');
      if (!sign && !dismiss) return;
      const club = userClubState();
      if (sign) {
        const res = signScoutReport(club, sign.dataset.sr3Sign, ctx());
        if (res?.ok) pushMessage?.({ category: 'club', type: 'info', title: 'Base U-20', body: `${res.player.name} assinou contrato de formação.` });
        else if (res?.error) sign.closest('.sr3-card')?.querySelector('.sr3-err')?.replaceChildren(document.createTextNode(res.error === 'no_slots' || res.error === 'full' ? 'Sem vaga na base.' : 'Não foi possível assinar agora.'));
      } else {
        dismissScoutReport(club, dismiss.dataset.sr3Dismiss);
      }
      onBudgetChanged?.();
      render();
      openScoutReportModal(scoutReportSlot);
    });
  };

  const openScoutReportModal = slotIndex => {
    const club = userClubState();
    ensureYouthState(club);
    syncScoutSlots(club);
    scoutReportSlot = slotIndex;
    const careerDate = getCareerDate?.() || new Date();
    purgeExpiredScoutReports(club, careerDate);
    const slot = club.scouts.find(row => Number(row.slot) === Number(slotIndex));
    ensureScoutReportModal();
    const modal = $('#youthScoutReportModal');
    const body = $('#youthScoutReportBody');
    const title = $('#youthScoutReportTitle');
    if (!modal || !body) return;
    const reports = (club.scoutReports || []).filter(report => Number(report.scoutSlot) === Number(slot?.slot));
    const name = slot?.scoutName || reports[0]?.scoutName || `Olheiro ${slot?.slot ?? ''}`;
    const grade = scoutGradeLabel(reports[0]?.scoutGrade || slot?.scoutGrade);
    const region = scoutRegionLabel(reports[0]?.originRegion || slot?.region) || reports[0]?.originUf || '—';
    if (title) title.textContent = reports.length ? `Missão: ${region}` : name;
    const esc2 = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const stars = n => Array.from({ length: 5 }, (_, i) => `<span class="${i < n ? 'is-on' : ''}">★</span>`).join('');
    const locked = slot && isScoutLocked(slot, careerDate) && slot.lockedUntil ? ` · em missão até ${formatScoutLockDate(slot.lockedUntil)}` : '';
    const head = `<div class="sr3-scout"><span class="sr3-grade">${esc2(grade || '—')}</span><div><strong>${esc2(name)} · classe ${esc2(grade || '—')}</strong><small>Região ${esc2(region)}${locked}</small></div>${reports.length ? `<em class="sr3-count">${reports.length} TALENTO${reports.length === 1 ? '' : 'S'}</em>` : ''}</div>`;
    const cards = reports.length
      ? `<div class="sr3-cards">${reports.map(report => {
          const p = report.player || {};
          const legacy = p.legacyOf?.retiredName ? `<small class="sr3-legacy">LEGADO · ${esc2(p.legacyOf.retiredName)}</small>` : `<small>visto em ${esc2(report.originUf || region)}</small>`;
          return `<article class="sr3-card${(report.estimatedStars || 0) >= 4 ? ' is-top' : ''}">
            <div class="sr3-card-head"><i class="sr3-pos">${esc2(p.pos || '—')}</i><strong>${esc2(p.name || '—')}</strong><small>${esc2(p.age ?? '—')} anos</small></div>
            <div class="sr3-stars">${stars(Number(report.estimatedStars) || 0)}<small>estimativa · confiança ${esc2(String(report.confidence || '—').toLowerCase())}</small></div>
            ${legacy}
            <small class="sr3-err"></small>
            <div class="sr3-actions"><button type="button" class="av2-btn" data-sr3-dismiss="${esc2(report.id)}">DISPENSAR</button><button type="button" class="av2-btn is-primary" data-sr3-sign="${esc2(report.id)}">LEVAR PARA A BASE</button></div>
          </article>`;
        }).join('')}</div>`
      : `<p class="sr3-empty">${esc2(slot?.lastMissionReport?.summary || 'Este olheiro ainda não realizou buscas de captação.')}</p>`;
    const expires = reports[0]?.expiresAt ? `<small class="sr3-note">Relatório vale até ${esc2(formatScoutLockDate(reports[0].expiresAt))}. Depois disso os jogadores vão para outros clubes.</small>` : '';
    body.innerHTML = `${head}${cards}${expires}`;
    modal.classList.remove('hidden');
  };

  const closeScoutReportModal = () => {
    $('#youthScoutReportModal')?.classList.add('hidden');
  };

  const setTab = tab => {
    activeTab = tab;
    document.querySelectorAll('.youth-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.youthTab === tab);
    });
    document.querySelectorAll('.youth-panel').forEach(panel => {
      panel.classList.toggle('hidden', panel.dataset.youthPanel !== tab);
    });
  };

  const renderLocked = () => {
    const main = $('#youthMain');
    if (!main) return;
    let locked = $('#youthLocked');
    if (!locked) {
      locked = document.createElement('article');
      locked.id = 'youthLocked';
      locked.className = 'card youth-locked-card';
      main.prepend(locked);
    }
    const need = YOUTH_STRUCTURE_UNLOCK;
    const club = userClubState();
    const current = getStructureLevel(club);
    const missing = Math.max(0, need - current);
    let nextCost = '—';
    try {
      const row = listStadiumUpgrades(club, getUserDivision?.() || club?.division).find(item => item.id === 'structure');
      if (row && row.cost > 0 && typeof formatBudget === 'function') nextCost = formatBudget(row.cost);
    } catch { /* economia indisponível */ }
    const pips = Array.from({ length: need }, (_, index) => `<i class="${index < current ? 'is-on' : ''}"></i>`).join('');
    locked.classList.add('youth-v2-locked');
    locked.innerHTML = `
      <div class="youth-v2-locked-main">
        <span class="youth-v2-kicker">BLOQUEADA · ESTRUTURA ${current} DE ${need}</span>
        <strong class="youth-v2-title">Categoria de Base</strong>
        <p class="youth-v2-lead">Libere a base investindo na <b>Estrutura do estádio</b> até o nível ${need} (${esc(structureLabel(need))}).</p>
        <ul class="youth-v2-perks">
          <li data-tone="lime"><b>Elenco U-20</b><span>jovens que treinam e sobem para o profissional</span></li>
          <li data-tone="cyan"><b>Olheiros</b><span>missões pelo país em busca de talentos</span></li>
          <li data-tone="gold"><b>Joias da base</b><span>reforço barato ou venda com lucro</span></li>
        </ul>
        <div class="youth-v2-preview" aria-hidden="true">${['GOL', 'MEI', 'ATA'].map(pos => `<span><b>??</b><small>${pos} · sub-20</small></span>`).join('')}</div>
      </div>
      <aside class="youth-v2-locked-side">
        <span class="youth-v2-kicker">PARA LIBERAR</span>
        <div class="youth-v2-pips" aria-label="Estrutura ${current} de ${need}">${pips}</div>
        <div class="mv2-tiles">
          <div class="mv2-tile"><small>FALTAM</small><strong>${missing} ${missing === 1 ? 'nível' : 'níveis'}</strong></div>
          <div class="mv2-tile"><small>PRÓXIMO NÍVEL</small><strong class="is-money">${nextCost}</strong></div>
        </div>
        <p class="youth-v2-meta">Atual: ${esc(structureLabel(current))}</p>
        <button type="button" class="mv2-btn is-primary youth-v2-go" data-youth-go-structure>IR PARA ESTRUTURA</button>
      </aside>`;
    locked.querySelector('[data-youth-go-structure]')?.addEventListener('click', () => {
      if (typeof openView === 'function') openView('stadium');
      else document.querySelector('#sectionTabs .nav[data-view="stadium"]')?.click() || document.querySelector('.section-btn[data-section="clube"]')?.click();
    });
  };

  // ---------- Etapa 4: helpers ----------
  const DEPT_MARGIN = { 0: 8, 1: 6, 2: 4, 3: 2 };
  const GRADE_MARGIN = { A: 2, B: 5, C: 6, D: 9 };
  const ATTR_LABEL = {
    finishing: 'Finalização', passing: 'Passe', marking: 'Marcação', tackling: 'Desarme', dribble: 'Drible',
    speed: 'Velocidade', heading: 'Cabeceio', playmaking: 'Armação', reflexes: 'Reflexos', positioning: 'Posicionamento',
    penaltySaving: 'Pênaltis',
  };
  const ATTR_BY_POS = {
    GOL: ['reflexes', 'positioning', 'penaltySaving', 'passing'], ZAG: ['marking', 'tackling', 'heading', 'passing'],
    LAT: ['speed', 'tackling', 'passing', 'dribble'], VOL: ['tackling', 'marking', 'passing', 'heading'],
    MC: ['passing', 'dribble', 'tackling', 'finishing'], MEI: ['passing', 'dribble', 'finishing', 'speed'],
    PE: ['speed', 'dribble', 'finishing', 'passing'], PD: ['speed', 'dribble', 'finishing', 'passing'],
    ATA: ['finishing', 'heading', 'speed', 'dribble'],
  };
  const POS_GROUP = { GOL: 'gol', ZAG: 'def', LAT: 'def', VOL: 'mid', MC: 'mid', MEI: 'mid', PE: 'att', PD: 'att', ATA: 'att' };
  let squadFilter = 'all';
  let squadPage = 1;
  let selectedYouth = null;
  const PAGE = 7;

  const proAverage = club => {
    const list = (club.roster || []).map(p => Number(p.overall) || 0).filter(Boolean).sort((x, y) => y - x).slice(0, 16);
    return list.length ? list.reduce((t, v) => t + v, 0) / list.length : 60;
  };
  const relStars = (potential, avg) => {
    const diff = Number(potential || 0) - avg;
    return diff >= 8 ? 5 : diff >= 3 ? 4 : diff >= -2 ? 3 : diff >= -8 ? 2 : 1;
  };
  const potRange = (player, margin) => {
    const ovr = Number(player.overall) || 0;
    const pot = Math.max(ovr, Number(player.potential) || ovr);
    return [Math.max(ovr, pot - margin), Math.min(99, pot + margin)];
  };
  const posChip = position => `<span class="yb2-pos g-${POS_GROUP[position] || 'mid'}">${esc(position || '—')}</span>`;
  const starRow = n => `<span class="yb2-stars" aria-label="${n} de 5 estrelas">${Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'on' : ''}">★</i>`).join('')}</span>`;
  const potBar = (ovr, lo, hi) => {
    const sc = v => Math.max(0, Math.min(100, ((Number(v) || 0) - 40) / 50 * 100));
    return `<span class="yb2-potbar"><b style="width:${sc(ovr)}%"></b><i style="left:${sc(lo)}%;width:${Math.max(2, sc(hi) - sc(lo))}%"></i></span>`;
  };
  const tileHtml = (label, value, detail = '', tone = '') =>
    `<div class="yb2-tile${tone ? ` t-${tone}` : ''}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${detail ? esc(detail) : '&nbsp;'}</small></div>`;
  const monthly = value => (typeof deps.wageMonthly === 'function' ? deps.wageMonthly(value) : value);
  const careerNow = () => getCareerDate?.() || new Date();
  const monthsUntilBirthdayAge = player => {
    // Idade sobe na virada do ano: meses até janeiro.
    const now = careerNow();
    return Math.max(1, 12 - now.getMonth());
  };

  const youthStatus = (player, avg) => {
    const age = Number(player.age) || 0;
    const stars = relStars(player.potential, avg);
    if (age >= YOUTH_AGE_MAX_UI) return { key: 'decide', label: 'DECIDIR', tone: 'orange', note: 'última temporada na base · sai aos 21' };
    if (age >= YOUTH_PROMOTION_MIN_AGE) {
      if (age >= 19 && stars <= 2) return { key: 'decide', label: 'DECIDIR', tone: 'orange', note: `sai da base aos 21 · ${21 - age} temporada${21 - age === 1 ? '' : 's'}` };
      return { key: 'ready', label: 'PRONTO', tone: 'green', note: 'pode promover agora' };
    }
    const wait = monthsUntilBirthdayAge(player);
    const until = YOUTH_PROMOTION_MIN_AGE - age;
    const note = until <= 1 ? `promove aos 17 · faltam ${wait} ${wait === 1 ? 'mês' : 'meses'}` : `promove aos 17 · ${until} temporadas`;
    if (player.craque || stars >= 5) return { key: 'talent', label: 'TALENTO', tone: 'lime', note };
    if (player.destaque || stars >= 4) return { key: 'talent', label: 'DESTAQUE', tone: 'gold', note };
    return { key: 'young', label: '', tone: '', note };
  };

  const coordinatorNote = (player, status, stars) => {
    const attrs = (ATTR_BY_POS[player.pos] || []).map(key => [key, Number(player[key]) || 0]).sort((x, y) => y[1] - x[1]);
    const best = attrs[0] ? `${ATTR_LABEL[attrs[0][0]] || attrs[0][0]} acima da média para a idade` : 'perfil equilibrado';
    const weak = attrs[attrs.length - 1] ? `precisa evoluir em ${String(ATTR_LABEL[attrs[attrs.length - 1][0]] || '').toLowerCase()}` : '';
    let plan;
    if (status.key === 'ready' && stars >= 4) plan = 'Pronto para o profissional: promova e dê minutos aos poucos.';
    else if (status.key === 'ready') plan = 'Pode subir como opção de elenco; sem pressa se o grupo estiver cheio.';
    else if (status.key === 'decide') plan = stars <= 2 ? 'Teto baixo para o nível do elenco — considere dispensar ou negociar.' : 'Última chance na base: promova antes de perdê-lo aos 21.';
    else if (stars >= 4) plan = 'Manter na base e promover aos 17 — pode virar titular.';
    else plan = 'Seguir no sub-20 e reavaliar na próxima temporada.';
    return `${best}; ${weak}. ${plan}`;
  };

  const renderSummary = club => {
    const el = $('#youthSummary');
    if (!el) return;
    const division = getUserDivision?.() || club.division || 'A';
    const roster = club.youthRoster || [];
    const avg = proAverage(club);
    const ready = roster.filter(p => (Number(p.age) || 0) >= YOUTH_PROMOTION_MIN_AGE).length;
    const best = [...roster].sort((x, y) => (Number(y.potential) || 0) - (Number(x.potential) || 0))[0];
    const bill = estimateYouthWageBill(club, division);
    const careerDate = careerNow();
    const busy = (club.scouts || []).filter(slot => isScoutLocked(slot, careerDate));
    const nextBack = busy.map(slot => slot.lockedUntil).filter(Boolean).sort()[0];
    const reports = (club.scoutReports || []).length;
    const margin = DEPT_MARGIN[getScoutingDeptLevel(club)] ?? 6;
    el.innerHTML = [
      tileHtml('ELENCO SUB-20', `${roster.length} / ${YOUTH_ROSTER_MAX}`, `${Math.max(0, YOUTH_ROSTER_MAX - roster.length)} vagas`),
      tileHtml('PRONTOS P/ SUBIR', String(ready), '17 anos ou mais', ready ? 'good' : ''),
      tileHtml('MELHOR PROMESSA', best ? `${shortName(best.name)} · ${potRange(best, margin)[1]}` : '—', best ? `${best.pos} · ${best.age} anos` : 'sem jogadores', 'lime'),
      tileHtml('FOLHA DA BASE', `${formatBudget(monthly(bill))}/mês`, 'fora do profissional', 'gold'),
      tileHtml('OLHEIROS', reports ? `${reports} relatório${reports === 1 ? '' : 's'}` : busy.length ? `${busy.length} em missão` : `${getScoutSlotCount(club)} livre${getScoutSlotCount(club) === 1 ? '' : 's'}`, nextBack ? `volta em ${formatScoutLockDate(nextBack)}` : reports ? 'aguardando decisão' : 'pronto para nova missão', 'cyan'),
    ].join('');
    void avg;
  };

  const shortName = name => {
    const parts = String(name || '').trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.` : parts[0] || '—';
  };

  const upgradeCard = ({ key, title, level, max, tone, now, next, cost, balance }) => {
    const maxed = level >= max;
    const pips = Array.from({ length: max }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('');
    return `<article class="yb2-up t-${tone}">
      <header><span>${esc(title)}</span><strong>Nível ${level}/${max}</strong></header>
      <div class="yb2-pips">${pips}</div>
      <div class="yb2-up-grid">
        <div><em>HOJE</em>${now.map(x => `<p>${esc(x)}</p>`).join('')}</div>
        <div class="is-next"><em>${maxed ? 'NÍVEL MÁXIMO' : `NO NÍVEL ${level + 1}`}</em>${(maxed ? ['Tudo liberado'] : next).map(x => `<p>${esc(x)}</p>`).join('')}</div>
      </div>
      <footer>
        <button type="button" class="yb2-btn is-primary" data-youth-buy="${key}" ${maxed || balance < cost ? 'disabled' : ''}>${maxed ? 'NÍVEL MÁXIMO' : `INVESTIR · ${formatBudget(cost)}`}</button>
        <small>${maxed ? '' : balance < cost ? `faltam ${formatBudget(cost - balance)}` : `caixa depois: ${formatBudget(balance - cost)}`}</small>
      </footer>
    </article>`;
  };

  const renderInfra = club => {
    const el = $('#youthInfraBody');
    if (!el || !club) return;
    const division = getUserDivision?.() || club.division || 'A';
    const acLv = getAcademyLevel(club);
    const scLv = getScoutingDeptLevel(club);
    const acCost = acLv < ACADEMY_MAX_LEVEL ? academyUpgradeCost(acLv) : 0;
    const scCost = scLv < SCOUTING_MAX_LEVEL ? scoutingUpgradeCost(scLv) : 0;
    const bal = getBalance(club);
    const pct = v => `${String(Math.round(v * 1000) / 10).replace('.', ',')}%`;
    const acLines = lv => [
      `${INTAKE_BY_ACADEMY[lv] || 0} revelaç${(INTAKE_BY_ACADEMY[lv] || 0) === 1 ? 'ão' : 'ões'} por temporada`,
      `Teto de potencial +${Math.round(lv * 4 + scLv * 3)}%`,
      `Chance de destaque: ${pct(0.02 + lv * 0.004 + scLv * 0.006)} por jogador`,
    ];
    const gradeOdds = lv => {
      const table = SCOUT_GRADE_ODDS_BY_DEPT[Math.max(1, lv)] || [];
      const total = table.reduce((t, r) => t + r.weight, 0) || 1;
      const ab = table.filter(r => r.grade === 'A' || r.grade === 'B').reduce((t, r) => t + r.weight, 0);
      return Math.round(ab / total * 100);
    };
    const scLines = lv => [
      `${SCOUT_SLOTS_BY_DEPT[lv] ?? 0} olheiro${(SCOUT_SLOTS_BY_DEPT[lv] ?? 0) === 1 ? '' : 's'}${lv === 0 ? ' (1 regional incluso)' : ''}`,
      `Faixa de potencial: ±${DEPT_MARGIN[lv] ?? 6}`,
      `Olheiro classe A/B: ${gradeOdds(lv)}%`,
    ];
    const staffBill = estimateStaffBill(club, division);
    const scoutBill = estimateScoutStaffBill(club, { division, staffBill, careerDate: careerNow(), offSeason: typeof isOffSeason === 'function' ? !!isOffSeason() : false });
    const travel = estimateScoutTravelCost(club, REGION_OPTIONS[0]?.id, { division, clubName: getUserClub?.(), userUf: deps.getUserUf?.() });
    el.innerHTML = `
      <div class="yb2-up-row">
        ${upgradeCard({ key: 'academy', title: 'INFRAESTRUTURA DA BASE', level: acLv, max: ACADEMY_MAX_LEVEL, tone: 'lime', now: acLines(acLv), next: acLines(Math.min(ACADEMY_MAX_LEVEL, acLv + 1)), cost: acCost, balance: bal })}
        ${upgradeCard({ key: 'scouting', title: 'DEPARTAMENTO DE OLHEIROS', level: scLv, max: SCOUTING_MAX_LEVEL, tone: 'cyan', now: scLines(scLv), next: scLines(Math.min(SCOUTING_MAX_LEVEL, scLv + 1)), cost: scCost, balance: bal })}
      </div>
      <div class="yb2-info-row">
        <article class="yb2-info"><header>CUSTOS DA BASE</header>
          <p><span>Folha sub-20</span><b>${formatBudget(monthly(estimateYouthWageBill(club, division)))}/mês</b></p>
          <p><span>Olheiros</span><b>${scoutBill > 0 ? `${formatBudget(scoutBill)}/rodada` : '—'}</b></p>
          <p><span>Viagem (a partir de)</span><b>${travel > 0 ? formatBudget(travel) : '—'}</b></p>
        </article>
        <article class="yb2-info"><header>CALENDÁRIO DA BASE</header>
          <p><span>Revelações da base</span><b>virada do ano</b></p>
          <p><span>Idade +1</span><b>virada do ano</b></p>
          <p><span>Saem da base</span><b>aos 21 anos</b></p>
        </article>
        <article class="yb2-info"><header>REGRAS</header>
          <p class="is-text">Sub-20 com até ${YOUTH_ROSTER_MAX} vagas, fora do limite do profissional. Promoção a partir dos ${YOUTH_PROMOTION_MIN_AGE} anos. Missão de olheiro dura ${SCOUT_LOCK_MONTHS} meses e o relatório vale 21 dias.</p>
        </article>
      </div>`;
  };

  const renderScouts = club => {
    const el = $('#youthScoutsBody');
    if (!el || !club) return;
    syncScoutSlots(club);
    purgeExpiredScoutReports(club, careerNow());
    const careerDate = careerNow();
    const maxSlots = getScoutSlotCount(club);
    const division = getUserDivision?.() || club.division || 'A';
    const offSeason = typeof isOffSeason === 'function' ? !!isOffSeason() : false;
    const staffBill = estimateStaffBill(club, division);
    const maintTotal = estimateScoutStaffBill(club, { division, staffBill, careerDate, offSeason });
    const available = listAvailableScouts(club, careerDate);
    if (pendingScout && !available.some(s => String(s.slot) === pendingScout)) pendingScout = '';
    if (!pendingScout && available.length === 1) pendingScout = String(available[0].slot);
    const travelFor = id => estimateScoutTravelCost(club, id, { division, clubName: getUserClub?.(), userUf: deps.getUserUf?.() });
    const avg = proAverage(club);

    const reports = club.scoutReports || [];
    const today = careerDate.getTime();
    const reportsHtml = reports.length
      ? reports.map(r => {
          const p = r.player || {};
          const margin = GRADE_MARGIN[r.scoutGrade] ?? 6;
          const [lo, hi] = potRange(p, margin);
          const days = r.expiresAt ? Math.max(0, Math.ceil((new Date(r.expiresAt).getTime() - today) / 86400000)) : null;
          const cost = estimateYouthSigningCost(p, division);
          const wage = monthly(computeYouthWage(p, division));
          const legacy = p.legacyOf?.retiredName ? `<em class="yb2-legacy" title="Filho/regen de ${escAttr(p.legacyOf.retiredName)}">LEGADO</em>` : '';
          return `<div class="yb2-row is-report">
            ${posChip(p.pos)}
            <div class="yb2-name"><strong>${esc(p.name)} ${legacy}</strong><small>${esc(scoutRegionLabel(r.originRegion) || r.originUf || '—')} · por ${esc(r.scoutName || 'olheiro')}${days != null ? ` · expira em ${days} dia${days === 1 ? '' : 's'}` : ''}</small></div>
            <span class="yb2-num">${p.age ?? '—'}</span>
            <div class="yb2-pot">${potBar(p.overall, lo, hi)}<small>OVR ${p.overall ?? '—'} · teto ${lo}–${hi}</small></div>
            ${starRow(relStars(p.potential, avg))}
            <div class="yb2-cost"><b>${formatBudget(cost)}</b><small>${formatBudget(wage)}/mês</small></div>
            <div class="yb2-actions">
              <button type="button" class="yb2-btn is-primary" data-sign-report="${escAttr(r.id)}" ${youthSlotsFree(club) <= 0 || getBalance(club) < cost ? 'disabled' : ''} title="${youthSlotsFree(club) <= 0 ? 'Sub-20 cheio' : getBalance(club) < cost ? 'Saldo insuficiente' : ''}">CONTRATAR</button>
              <button type="button" class="yb2-btn is-ghost" data-dismiss-report="${escAttr(r.id)}">DESCARTAR</button>
            </div>
          </div>`;
        }).join('')
      : '<p class="yb2-empty">Nenhum relatório pendente. Envie um olheiro em uma missão para encontrar talentos.</p>';

    const scoutCards = club.scouts.map(slot => {
      const locked = isScoutLocked(slot, careerDate);
      const grade = scoutGradeLabel(slot.scoutGrade);
      const counts = SCOUT_TALENT_COUNT_ODDS[grade] || [];
      const minC = Math.min(...counts.filter(c => c.weight > 0).map(c => c.count));
      const maxC = Math.max(...counts.filter(c => c.weight > 0).map(c => c.count));
      let progress = 0;
      if (locked && slot.lockedUntil) {
        const end = new Date(slot.lockedUntil).getTime();
        const start = end - SCOUT_LOCK_MONTHS * 30.4 * 86400000;
        progress = Math.max(4, Math.min(100, Math.round((today - start) / (end - start) * 100)));
      }
      return `<article class="yb2-scout g-${grade.toLowerCase()}${locked ? ' is-busy' : ''}">
        <header><strong>${esc(slot.scoutName)}</strong><span class="yb2-grade">CLASSE ${grade}</span></header>
        <small>Acha ${minC === maxC ? minC : `${minC}–${maxC}`} talento${maxC === 1 ? '' : 's'} por missão · faixa de potencial ±${GRADE_MARGIN[grade] ?? 6}</small>
        <div class="yb2-progress"><b style="width:${locked ? progress : 0}%"></b></div>
        <p>${locked ? `Em missão${slot.region ? ` no ${esc(scoutRegionLabel(slot.region))}` : ''} · volta em ${esc(formatScoutLockDate(slot.lockedUntil))} (${progress}%)` : 'Livre para nova missão'}</p>
        <button type="button" class="yb2-link" data-scout-reports="${slot.slot}">último relatório ›</button>
      </article>`;
    }).join('');
    const extraSlot = getScoutingDeptLevel(club) < SCOUTING_MAX_LEVEL
      ? `<article class="yb2-scout is-add"><strong>+ ${maxSlots + 1}º OLHEIRO</strong><small>Departamento de olheiros nível ${getScoutingDeptLevel(club) + 1} · ${formatBudget(scoutingUpgradeCost(getScoutingDeptLevel(club)))}</small><button type="button" class="yb2-link" data-youth-tab="infra">ver estrutura ›</button></article>`
      : '';

    const pickedGrade = pendingScout ? scoutGradeLabel(club.scouts.find(s => String(s.slot) === pendingScout)?.scoutGrade) : null;
    const oddsBar = (rows, fmt, cls) => {
      const total = rows.reduce((t, r) => t + r.weight, 0) || 1;
      return `<div class="yb2-odds ${cls}">${rows.filter(r => r.weight > 0).map(r => `<b style="flex:${r.weight}" title="${r.weight}%">${fmt(r)}</b>`).join('')}</div>`;
      void total;
    };
    const regions = REGION_OPTIONS.map(row => {
      const cost = travelFor(row.id);
      return `<button type="button" class="yb2-region${pendingRegion === row.id ? ' is-on' : ''}" data-scout-region="${row.id}" ${available.length ? '' : 'disabled'}><b>${esc(row.label)}</b><small>${cost > 0 ? `viagem ${formatBudget(cost)}` : '—'}</small></button>`;
    }).join('');
    const scoutsPick = available.length
      ? available.map(slot => `<button type="button" class="yb2-pick${pendingScout === String(slot.slot) ? ' is-on' : ''}" data-scout-pick="${slot.slot}">${esc(slot.scoutName)} · classe ${esc(scoutGradeLabel(slot.scoutGrade))}</button>`).join('')
      : `<p class="yb2-empty">Nenhum olheiro livre${club.scouts.length ? ` — ${esc(club.scouts[0].scoutName)} volta em ${esc(formatScoutLockDate(club.scouts.map(s => s.lockedUntil).filter(Boolean).sort()[0]))}` : ''}.</p>`;
    const canSearch = available.length > 0 && pendingRegion && pendingScout;
    const travel = pendingRegion ? travelFor(pendingRegion) : 0;
    const mission = maxSlots === 0
      ? '<p class="yb2-empty">Amplie a infraestrutura da base ou o departamento de olheiros para liberar olheiros.</p>'
      : `<span class="yb2-step">1. Escolha a região</span><div class="yb2-regions">${regions}</div>
         <span class="yb2-step">2. Escolha o olheiro</span><div class="yb2-picks">${scoutsPick}</div>
         <span class="yb2-step">3. O que esperar${pickedGrade ? ` (classe ${pickedGrade})` : ''}</span>
         ${pickedGrade ? `<div class="yb2-odds-row"><span>Talentos</span>${oddsBar(SCOUT_TALENT_COUNT_ODDS[pickedGrade] || [], r => r.count, 'is-count')}</div>
         <div class="yb2-odds-row"><span>Estrelas</span>${oddsBar(SCOUT_TALENT_STAR_ODDS[pickedGrade] || [], r => `${r.stars}★`, 'is-stars')}</div>` : '<p class="yb2-empty">Escolha um olheiro para ver as chances.</p>'}
         <p class="yb2-costline"><span>Custo da missão (${SCOUT_LOCK_MONTHS} meses)</span><b>${travel > 0 ? `${formatBudget(travel)} + ` : ''}${maintTotal > 0 ? `${formatBudget(maintTotal)}/rodada` : '—'}</b></p>
         <button type="button" class="yb2-btn is-primary yb2-send" data-scout-run-search ${canSearch ? '' : 'disabled'}>ENVIAR OLHEIRO →</button>`;

    el.innerHTML = `
      <div class="yb2-scouts-grid">
        <div class="yb2-col">
          <header class="yb2-sec"><h3>Relatórios prontos · ${reports.length}</h3></header>
          ${reports.length ? '<div class="yb2-head-row is-report"><span>POS</span><span>JOGADOR</span><span>IDADE</span><span>HOJE → TETO</span><span>ESTRELAS</span><span>CUSTO</span><span></span></div>' : ''}
          ${reportsHtml}
          <header class="yb2-sec is-cyan"><h3>Seus olheiros · ${club.scouts.length} de ${Math.max(1, maxSlots)} vaga${maxSlots === 1 ? '' : 's'}</h3></header>
          <div class="yb2-scouts">${scoutCards}${extraSlot}</div>
        </div>
        <aside class="yb2-mission"><strong class="yb2-mission-title">Nova missão</strong>${mission}</aside>
      </div>`;
  };

  const renderSquad = club => {
    const el = $('#youthSquadBody');
    if (!el || !club) return;
    const roster = club.youthRoster || [];
    if (!roster.length) {
      el.innerHTML = '<p class="yb2-empty">Nenhum jogador no sub-20. Envie olheiros em missão (aba Olheiros) para encontrar talentos.</p>';
      return;
    }
    const avg = proAverage(club);
    const margin = DEPT_MARGIN[getScoutingDeptLevel(club)] ?? 6;
    const division = getUserDivision?.() || club.division || 'A';
    const enriched = roster.map(p => {
      const status = youthStatus(p, avg);
      const stars = relStars(p.potential, avg);
      const [lo, hi] = potRange(p, margin);
      return { p, status, stars, lo, hi };
    }).sort((x, y) => y.hi - x.hi || (Number(y.p.overall) || 0) - (Number(x.p.overall) || 0));
    const counts = {
      all: enriched.length,
      ready: enriched.filter(e => e.status.key === 'ready').length,
      talent: enriched.filter(e => e.status.key === 'talent').length,
      decide: enriched.filter(e => e.status.key === 'decide').length,
    };
    if (squadFilter !== 'all' && !counts[squadFilter]) squadFilter = 'all';
    const list = enriched.filter(e => squadFilter === 'all' || e.status.key === squadFilter);
    const shown = list.slice(0, squadPage * PAGE);
    if (!selectedYouth || !roster.some(p => p.playerId === selectedYouth)) selectedYouth = enriched[0]?.p.playerId || null;
    const sel = enriched.find(e => e.p.playerId === selectedYouth) || enriched[0];
    const filterBtn = (key, label) => `<button type="button" class="yb2-filter${squadFilter === key ? ' is-on' : ''}" data-youth-filter="${key}" ${counts[key] || key === 'all' ? '' : 'disabled'}>${label} (${counts[key]})</button>`;
    const rows = shown.map(({ p, status, stars, lo, hi }) => {
      const canPromote = (Number(p.age) || 0) >= YOUTH_PROMOTION_MIN_AGE;
      return `<div class="yb2-row${p.playerId === selectedYouth ? ' is-sel' : ''}" data-youth-select="${escAttr(p.playerId)}">
        ${posChip(p.pos)}
        <div class="yb2-name"><strong>${esc(p.name)}${p.legacyOf?.retiredName ? ' <em class="yb2-legacy">LEGADO</em>' : ''}</strong><small>${esc(status.note)}</small></div>
        <span class="yb2-num">${p.age ?? '—'}</span>
        <span class="yb2-ovr">${p.overall ?? '—'}</span>
        <div class="yb2-pot">${potBar(p.overall, lo, hi)}<small>potencial ${lo}–${hi}</small></div>
        ${starRow(stars)}
        <span>${status.label ? `<em class="yb2-tag t-${status.tone}">${status.label}</em>` : ''}</span>
        <div class="yb2-actions">
          ${canPromote ? `<button type="button" class="yb2-btn ${status.key === 'ready' ? 'is-primary' : 'is-sec'}" data-promote-youth="${escAttr(p.playerId)}">PROMOVER</button>` : '<span class="yb2-wait">aos 17</span>'}
          <button type="button" class="yb2-btn is-ghost is-icon" data-release-youth="${escAttr(p.playerId)}" title="Dispensar" aria-label="Dispensar ${escAttr(p.name)}">✕</button>
        </div>
      </div>`;
    }).join('');
    const more = list.length > shown.length
      ? `<button type="button" class="yb2-more" data-youth-more>ver mais ${Math.min(PAGE, list.length - shown.length)} jogador${list.length - shown.length === 1 ? '' : 'es'} ›</button>`
      : squadPage > 1 ? '<button type="button" class="yb2-more" data-youth-less>‹ mostrar menos</button>' : '';
    let side = '';
    if (sel) {
      const p = sel.p;
      const attrs = (ATTR_BY_POS[p.pos] || []).map(key => `<p><span>${esc(ATTR_LABEL[key] || key)}</span><b>${Math.round(Number(p[key]) || 0)}</b></p>`).join('');
      const wage = monthly(computeYouthWage(p, division));
      side = `<aside class="yb2-side">
        <header>${posChip(p.pos)}<strong>${esc(p.name)}</strong></header>
        <small>${p.age} anos${p.originUf ? ` · ${esc(p.originUf)}` : ''}${p.youthSignedDate ? ` · na base desde ${esc(String(p.youthSignedDate).slice(0, 4))}` : ''}</small>
        <div class="yb2-side-tiles">${tileHtml('OVR', String(p.overall ?? '—'))}${tileHtml('TETO', `${sel.lo}–${sel.hi}`, '', 'lime')}${tileHtml('SALÁRIO', formatBudget(wage), 'por mês', 'gold')}</div>
        <p class="yb2-coord"><b>Coordenador da base:</b> ${esc(coordinatorNote(p, sel.status, sel.stars))}</p>
        <div class="yb2-attrs">${attrs}</div>
        <footer>
          <button type="button" class="yb2-btn is-sec" data-youth-card="${escAttr(p.playerId)}">VER FICHA</button>
          ${(Number(p.age) || 0) >= YOUTH_PROMOTION_MIN_AGE ? `<button type="button" class="yb2-btn is-primary" data-promote-youth="${escAttr(p.playerId)}">PROMOVER</button>` : '<span class="yb2-wait">promove aos 17</span>'}
        </footer>
      </aside>`;
    }
    el.innerHTML = `<div class="yb2-squad">
      <div class="yb2-col">
        <div class="yb2-filters">${filterBtn('all', 'TODOS')}${filterBtn('ready', 'PRONTOS')}${filterBtn('talent', 'TALENTOS')}${filterBtn('decide', 'DECIDIR')}<span class="yb2-sort">ordem: potencial</span></div>
        <div class="yb2-head-row"><span>POS</span><span>JOGADOR</span><span>IDADE</span><span>OVR</span><span>HOJE → TETO</span><span>ESTRELAS</span><span>STATUS</span><span></span></div>
        ${rows}
        ${more}
      </div>
      ${side}
    </div>`;
  };

  const ctx = () => ({
    division: getUserDivision?.() || userClubState()?.division || 'A',
    careerDate: getCareerDate?.() || new Date(),
    season: getCareerSeason?.(),
    clubName: getUserClub?.(),
    userClub: getUserClub?.(),
    clubs: getClubs?.(),
    retiredPool: getRetiredPool?.() || [],
    evaluateRosterPayroll,
    firstNames,
    lastNames,
    userUf: deps.getUserUf?.(),
  });

  const render = () => {
    const club = userClubState();
    ensureYouthState(club);
    const meta = $('#youthMeta');
    const tabs = document.querySelector('.youth-tabs');
    const panels = document.querySelector('.youth-panels');
    if (meta) {
      if (!isYouthAcademyUnlocked(club)) {
        meta.textContent = `Exige estrutura ${structureLabel(YOUTH_STRUCTURE_UNLOCK)}`;
      } else {
        meta.textContent = `U-20 ${youthSlotsUsed(club)}/${YOUTH_ROSTER_MAX} · Base ${getAcademyLevel(club)}/${ACADEMY_MAX_LEVEL} · Olheiros ${getScoutSlotCount(club)} slot(s) · Dept. ${getScoutingDeptLevel(club)}/${SCOUTING_MAX_LEVEL}`;
      }
    }
    if (!isYouthAcademyUnlocked(club)) {
      tabs?.classList.add('hidden');
      panels?.classList.add('hidden');
      $('#youthSummary')?.classList.add('hidden');
      renderLocked();
      return;
    }
    tabs?.classList.remove('hidden');
    panels?.classList.remove('hidden');
    const locked = $('#youthLocked');
    if (locked) locked.remove();
    $('#youthSummary')?.classList.remove('hidden');
    renderSummary(club);
    renderSquad(club);
    renderScouts(club);
    renderInfra(club);
    setTab(activeTab);
  };

  const bindHandlers = () => {
    onClick('#youthMain', e => {
      const tabBtn = e.target.closest('[data-youth-tab]');
      if (tabBtn) {
        const tab = tabBtn.dataset.youthTab;
        if (tab) setTab(tab);
        return;
      }

      const filterBtn = e.target.closest('[data-youth-filter]');
      if (filterBtn) {
        squadFilter = filterBtn.dataset.youthFilter || 'all';
        squadPage = 1;
        renderSquad(userClubState());
        return;
      }
      if (e.target.closest('[data-youth-more]')) {
        squadPage += 1;
        renderSquad(userClubState());
        return;
      }
      if (e.target.closest('[data-youth-less]')) {
        squadPage = 1;
        renderSquad(userClubState());
        return;
      }
      const regionBtn = e.target.closest('[data-scout-region]');
      if (regionBtn) {
        pendingRegion = regionBtn.dataset.scoutRegion || '';
        renderScouts(userClubState());
        return;
      }
      const pickBtn = e.target.closest('[data-scout-pick]');
      if (pickBtn) {
        pendingScout = pickBtn.dataset.scoutPick || '';
        renderScouts(userClubState());
        return;
      }

      if (e.target.closest('[data-youth-buy="academy"]')) {
        const club = userClubState();
        const res = purchaseAcademyUpgrade(club);
        if (!res.ok) return;
        onBudgetChanged?.();
        render();
        return;
      }

      if (e.target.closest('[data-youth-buy="scouting"]')) {
        const club = userClubState();
        const res = purchaseScoutingUpgrade(club);
        if (!res.ok) return;
        onBudgetChanged?.();
        render();
        return;
      }

      if (e.target.closest('[data-scout-reports]')) {
        const btn = e.target.closest('[data-scout-reports]');
        openScoutReportModal(btn?.dataset.scoutReports);
        return;
      }

      if (e.target.closest('[data-scout-run-search]')) {
        const club = userClubState();
        const region = pendingRegion || $('#youthScoutRegionPick')?.value;
        const scoutSlot = pendingScout || $('#youthScoutNamePick')?.value;
        if (!region || !scoutSlot) return;
        const res = runScoutSearch(club, {
          region,
          scoutSlot: Number(scoutSlot),
          clubName: getUserClub?.(),
          ...ctx(),
        });
        if (!res.ok) {
          if (res.error === 'insufficient_funds') {
            pushMessage?.({
              category: 'club',
              type: 'warning',
              title: 'Olheiros',
              body: `Saldo insuficiente para a viagem (${formatBudget(res.travelCost || 0)}).`,
            });
          }
          return;
        }
        onBudgetChanged?.();
        render();
        return;
      }

      const signBtn = e.target.closest('[data-sign-report]');
      if (signBtn) {
        const id = signBtn.dataset.signReport;
        if (!id) return;
        const club = userClubState();
        const res = signScoutReport(club, id, ctx());
        if (!res.ok) return;
        pushMessage?.({
          category: 'club',
          type: 'info',
          title: 'Base U-20',
          body: `${res.player.name} assinou contrato de formação.`,
        });
        render();
        return;
      }

      const dismissBtn = e.target.closest('[data-dismiss-report]');
      if (dismissBtn) {
        const id = dismissBtn.dataset.dismissReport;
        if (!id) return;
        dismissScoutReport(userClubState(), id);
        render();
        return;
      }

      const promoteBtn = e.target.closest('[data-promote-youth]');
      if (promoteBtn) {
        const id = promoteBtn.dataset.promoteYouth;
        if (!id) return;
        const club = userClubState();
        const res = promoteYouthPlayer(club, id, ctx());
        if (!res.ok) {
          if (res.error === 'too_young') return;
          if (res.error === 'roster_full' || res.error === 'roster_hard_full' || res.error === 'payroll_pressure') {
            pushMessage?.({
              category: 'club',
              type: 'warning',
              title: 'Promoção bloqueada',
              body: 'Elenco ou folha profissional não comporta mais um jogador.',
            });
          }
          return;
        }
        deps.syncUserSquad?.();
        pushMessage?.({
          category: 'club',
          type: 'info',
          title: 'Promovido',
          body: `${res.player.name} integra o elenco principal.`,
        });
        render();
        return;
      }

      const releaseBtn = e.target.closest('[data-release-youth]');
      if (releaseBtn) {
        const id = releaseBtn.dataset.releaseYouth;
        if (!id) return;
        // Dois cliques: o 1º arma o botão (evita dispensa acidental).
        if (releaseBtn.dataset.armed !== '1') {
          releaseBtn.dataset.armed = '1';
          releaseBtn.classList.add('is-armed');
          releaseBtn.textContent = 'DISPENSAR?';
          setTimeout(() => {
            if (!releaseBtn.isConnected) return;
            releaseBtn.dataset.armed = '';
            releaseBtn.classList.remove('is-armed');
            releaseBtn.textContent = '✕';
          }, 3000);
          return;
        }
        const released = releaseYouthPlayer(userClubState(), id);
        if (released.ok) deps.onYouthReleased?.(released.player);
        deps.syncUserSquad?.();
        render();
        return;
      }

      const cardBtn = e.target.closest('[data-youth-card]');
      if (!cardBtn) {
        const row = e.target.closest('[data-youth-select]');
        if (row) {
          selectedYouth = row.dataset.youthSelect;
          if (window.matchMedia?.('(max-width: 760px)').matches && openPlayerCard) {
            openPlayerCard({ playerId: selectedYouth, clubName: getUserClub?.() });
            return;
          }
          renderSquad(userClubState());
          return;
        }
      }
      if (cardBtn && openPlayerCard) {
        const id = cardBtn.dataset.youthCard;
        if (!id) return;
        openPlayerCard({ playerId: id, clubName: getUserClub?.() });
      }
    });

    const youthMain = $('#youthMain');
    youthMain?.addEventListener('change', e => {
      if (e.target.id === 'youthScoutRegionPick') {
        pendingRegion = e.target.value;
        render();
        return;
      }
      if (e.target.id === 'youthScoutNamePick') {
        pendingScout = e.target.value;
        render();
      }
    });
  };

  bindHandlers();

  return { render, isUnlocked: () => isYouthAcademyUnlocked(userClubState()) };
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(s) {
  return esc(s).replace(/'/g, '&#39;');
}
