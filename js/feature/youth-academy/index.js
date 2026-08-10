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
} from '../../engine/youth-academy.js';
import { estimateStaffBill, getStructureLevel } from '../../engine/economy.js';

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
  } = deps;

  let activeTab = 'squad';
  let pendingRegion = '';
  let pendingScout = '';

  const structureLabel = level =>
    typeof structureLabelFn === 'function' ? structureLabelFn(level) : structureLevelLabel(level);

  const ensureScoutReportModal = () => {
    if (document.getElementById('youthScoutReportModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="youthScoutReportModal" class="youth-scout-report-modal hidden" role="dialog" aria-modal="true" aria-labelledby="youthScoutReportTitle">
        <div class="youth-scout-report-modal__panel">
          <h2 id="youthScoutReportTitle">RELATÓRIO OLHEIRO</h2>
          <p id="youthScoutReportBody" class="youth-scout-report-modal__body"></p>
          <button type="button" id="youthScoutReportClose" class="youth-scout-report-modal__close">FECHAR</button>
        </div>
      </div>
    `);
    onClick('#youthScoutReportClose', () => closeScoutReportModal());
    onClick('#youthScoutReportModal', event => {
      if (event.target.id === 'youthScoutReportModal') closeScoutReportModal();
    });
  };

  const openScoutReportModal = slotIndex => {
    const club = userClubState();
    ensureYouthState(club);
    syncScoutSlots(club);
    const slot = club.scouts.find(row => Number(row.slot) === Number(slotIndex));
    ensureScoutReportModal();
    const modal = $('#youthScoutReportModal');
    const body = $('#youthScoutReportBody');
    if (!modal || !body) return;
    body.textContent = formatScoutReportBody(club, slot, getCareerDate?.() || new Date());
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
    locked.innerHTML = `
      <label>BLOQUEADO</label>
      <strong>Infraestrutura insuficiente</strong>
      <p>Invista na <b>Estrutura do estádio</b> até o nível ${need} (${structureLabel(need)}) para liberar a Categoria de Base, olheiros e elenco U-20.</p>
      <p class="youth-locked-meta">Estádio → Estrutura · atual: ${structureLabel(getStructureLevel(userClubState()))}</p>`;
  };

  const renderInfra = club => {
    const el = $('#youthInfraBody');
    if (!el || !club) return;
    const acLv = getAcademyLevel(club);
    const scLv = getScoutingDeptLevel(club);
    const acCost = acLv < ACADEMY_MAX_LEVEL ? academyUpgradeCost(acLv) : 0;
    const scCost = scLv < SCOUTING_MAX_LEVEL ? scoutingUpgradeCost(scLv) : 0;
    const bal = getBalance(club);
    el.innerHTML = `
      <div class="youth-infra-grid">
        <article class="youth-infra-card">
          <label>INFRAESTRUTURA DA BASE</label>
          <strong>Nível ${acLv}/${ACADEMY_MAX_LEVEL}</strong>
          <p>Mais revelações por temporada e teto de qualidade. <b>1 olheiro regional</b> já incluso ao desbloquear a base.</p>
          <button type="button" class="youth-upgrade-btn" data-youth-buy="academy" ${acLv >= ACADEMY_MAX_LEVEL || bal < acCost ? 'disabled' : ''}>
            ${acLv >= ACADEMY_MAX_LEVEL ? 'NÍVEL MÁXIMO' : `INVESTIR · ${formatBudget(acCost)}`}
          </button>
        </article>
        <article class="youth-infra-card">
          <label>DEPARTAMENTO DE OLHEIROS</label>
          <strong>Nível ${scLv}/${SCOUTING_MAX_LEVEL}</strong>
          <p>Slots extras e precisão das estrelas nos relatórios de captação.</p>
          <button type="button" class="youth-upgrade-btn" data-youth-buy="scouting" ${scLv >= SCOUTING_MAX_LEVEL || bal < scCost ? 'disabled' : ''}>
            ${scLv >= SCOUTING_MAX_LEVEL ? 'NÍVEL MÁXIMO' : `INVESTIR · ${formatBudget(scCost)}`}
          </button>
        </article>
      </div>
      <p class="youth-infra-hint">Elenco U-20: ${youthSlotsUsed(club)}/${YOUTH_ROSTER_MAX} · não conta no limite do elenco profissional.</p>`;
  };

  const renderScouts = club => {
    const el = $('#youthScoutsBody');
    if (!el || !club) return;
    syncScoutSlots(club);
    purgeExpiredScoutReports(club, getCareerDate?.() || new Date());
    const careerDate = getCareerDate?.() || new Date();
    const scLv = getEffectiveScoutingLevel(club);
    const maxSlots = getScoutSlotCount(club);
    const division = getUserDivision?.() || club.division || 'A';
    const offSeason = typeof isOffSeason === 'function' ? !!isOffSeason() : false;
    const staffBill = estimateStaffBill(club, division);
    const maintTotal = estimateScoutStaffBill(club, {
      division,
      staffBill,
      careerDate,
      offSeason,
    });
    const travelCost =
      pendingRegion && isValidScoutRegion(pendingRegion)
        ? estimateScoutTravelCost(club, pendingRegion, {
            division,
            clubName: getUserClub?.(),
            userUf: deps.getUserUf?.(),
          })
        : 0;
    const available = listAvailableScouts(club, careerDate);

    const regionOptions = REGION_OPTIONS.map(
      row => `<option value="${row.id}" ${pendingRegion === row.id ? 'selected' : ''}>${row.label}</option>`,
    ).join('');

    const scoutOptions = club.scouts
      .map(slot => {
        const locked = isScoutLocked(slot, careerDate);
        const grade = scoutGradeLabel(slot.scoutGrade);
        const suffix = locked ? ` · missão até ${formatScoutLockDate(slot.lockedUntil)}` : '';
        return `<option value="${slot.slot}" ${pendingScout === String(slot.slot) ? 'selected' : ''} ${locked ? 'disabled' : ''}>${esc(slot.scoutName)} · Classe ${grade}${suffix}</option>`;
      })
      .join('');

    const oddsHint = ['A', 'B', 'C', 'D']
      .map(grade => {
        const countLine = SCOUT_TALENT_COUNT_ODDS[grade]
          .map(row => `${row.count} talento${row.count === 1 ? '' : 's'}: ${row.weight}%`)
          .join(' · ');
        const starLine = SCOUT_TALENT_STAR_ODDS[grade]
          .map(row => `${row.stars}★: ${row.weight}%`)
          .join(' · ');
        return `<li class="youth-scout-odds-row">
          <strong class="youth-scout-odds-class">Classe ${grade}</strong>
          <p><span class="youth-scout-odds-label">Quantidade:</span> ${countLine}</p>
          <p><span class="youth-scout-odds-label">Estrelas (se achar):</span> ${starLine}</p>
        </li>`;
      })
      .join('');

    const canSearch = available.length > 0 && pendingRegion && pendingScout && available.some(s => String(s.slot) === pendingScout);

    const searchBar =
      maxSlots === 0
        ? '<p class="youth-empty">Amplie a <b>Infraestrutura da Base</b> ou o <b>Departamento de Olheiros</b> para liberar olheiros.</p>'
        : `<div class="youth-scout-search-bar">
            <select id="youthScoutRegionPick" class="youth-scout-region-select" aria-label="Região de busca" ${available.length ? '' : 'disabled'}>
              <option value="">— Região —</option>
              ${regionOptions}
            </select>
            <select id="youthScoutNamePick" class="youth-scout-name-select" aria-label="Olheiro" ${available.length ? '' : 'disabled'}>
              <option value="">— Olheiro —</option>
              ${scoutOptions}
            </select>
            <button type="button" class="youth-scout-search-btn" data-scout-run-search ${canSearch ? '' : 'disabled'}>BUSCAR</button>
          </div>`;

    const statusHtml = club.scouts.length
      ? `<ul class="youth-scout-status">${club.scouts
          .map(slot => {
            const locked = isScoutLocked(slot, careerDate);
            const grade = scoutGradeLabel(slot.scoutGrade);
            return `<li class="${locked ? 'is-locked' : 'is-ready'}">
              <div class="youth-scout-status__main">
                <strong>${esc(slot.scoutName)} <span class="youth-scout-grade youth-scout-grade--${grade.toLowerCase()}">${grade}</span></strong>
                <span>${locked ? `Em missão até ${formatScoutLockDate(slot.lockedUntil)}` : 'Disponível'}</span>
              </div>
              <button type="button" class="youth-scout-reports-btn" data-scout-reports="${slot.slot}">RELATÓRIOS</button>
            </li>`;
          })
          .join('')}</ul>
        <details class="youth-scout-odds">
          <summary>Chances por classe (quantidade e estrelas)</summary>
          <ul>${oddsHint}</ul>
        </details>`
      : '';

    const reports = club.scoutReports || [];
    const reportsHtml =
      reports.length === 0
        ? '<p class="youth-empty">Nenhum relatório pendente. Escolha região e olheiro, depois clique em <b>BUSCAR</b>.</p>'
        : `<div class="youth-grid-table youth-grid-table--capture">
            <div class="youth-grid-table__head" aria-hidden="true">
              <span>Nome</span><span>Idade</span><span>Pos</span><span>Estrelas</span><span>Região</span><span>Olheiro</span><span>Ações</span>
            </div>
            ${reports
              .map(r => {
                const p = r.player || {};
                const legacyTip = p.legacyOf?.retiredName
                  ? `Filho/regen de ${p.legacyOf.retiredName} (aposentado em ${p.legacyOf.retiredSeason ?? '—'})`
                  : '';
                const legacyBadge = legacyTip
                  ? `<span class="youth-legacy-badge" title="${escAttr(legacyTip)}">LEGADO</span>`
                  : '';
                return `<article class="youth-grid-table__row">
                  <span class="youth-grid-table__name">${esc(p.name)} ${legacyBadge}</span>
                  <span class="youth-grid-table__num">${p.age ?? '—'}</span>
                  <span class="youth-grid-table__pos">${p.pos ?? '—'}</span>
                  <span class="youth-grid-table__stars" title="Potencial estimado">${starsMarkup(r.estimatedStars)}</span>
                  <span class="youth-grid-table__region">${scoutRegionLabel(r.originRegion) || r.originUf || '—'}</span>
                  <span class="youth-grid-table__scout">${esc(r.scoutName || '—')}</span>
                  <div class="youth-grid-table__actions">
                    <button type="button" class="youth-action-btn" data-sign-report="${escAttr(r.id)}" ${youthSlotsFree(club) <= 0 ? 'disabled' : ''}>Contratar</button>
                    <button type="button" class="youth-action-btn youth-action-btn--ghost" data-dismiss-report="${escAttr(r.id)}">Descartar</button>
                  </div>
                </article>`;
              })
              .join('')}
          </div>`;

    el.innerHTML = `
      <p class="youth-scout-meta">Olheiros: ${maxSlots} · ${maintTotal > 0 ? `Manutenção: ${formatBudget(maintTotal)}/rodada (piso 35% comissão · missão +20%${offSeason ? ' · entressafra 20%' : ''})` : 'Manutenção: —'} · Missão: ${SCOUT_LOCK_MONTHS} meses${travelCost > 0 ? ` · Viagem estimada: ${formatBudget(travelCost)}` : ''}</p>
      ${searchBar}
      ${statusHtml}
      <h3 class="youth-subtitle">Relatório de captação</h3>
      ${reportsHtml}`;
  };

  const renderSquad = club => {
    const el = $('#youthSquadBody');
    if (!el || !club) return;
    const division = getUserDivision?.() || club.division || 'A';
    const roster = club.youthRoster || [];
    if (!roster.length) {
      el.innerHTML = '<p class="youth-empty">Nenhum jogador na base U-20. Use os olheiros para buscar talentos ou aguarde revelações automáticas da infraestrutura.</p>';
      return;
    }
    el.innerHTML = `<div class="youth-grid-table youth-grid-table--squad">
      <div class="youth-grid-table__head" aria-hidden="true">
        <span>Nome</span><span>Idade</span><span>Pos</span><span>Estrelas</span><span>OVR</span><span>Ações</span>
      </div>
      ${roster
        .map(p => {
          const stars = youthStarRating(p, division);
          const canPromote = (Number(p.age) || 0) >= YOUTH_PROMOTION_MIN_AGE;
          const legacyTip = p.legacyOf?.retiredName
            ? `Filho/regen de ${p.legacyOf.retiredName} (aposentado em ${p.legacyOf.retiredSeason ?? '—'})`
            : '';
          const legacyBadge = legacyTip
            ? `<span class="youth-legacy-badge" title="${escAttr(legacyTip)}">LEGADO</span>`
            : '';
          return `<article class="youth-grid-table__row">
            <span class="youth-grid-table__name"><button type="button" class="youth-name-btn" data-youth-card="${escAttr(p.playerId)}">${esc(p.name)}</button> ${legacyBadge}</span>
            <span class="youth-grid-table__num">${p.age ?? '—'}</span>
            <span class="youth-grid-table__pos">${p.pos ?? '—'}</span>
            <span class="youth-grid-table__stars">${starsMarkup(stars)}</span>
            <span class="youth-grid-table__ovr">${p.overall ?? '—'}</span>
            <div class="youth-grid-table__actions">
              <button type="button" class="youth-action-btn" data-promote-youth="${escAttr(p.playerId)}" ${canPromote ? '' : 'disabled title="Promoção a partir de 17 anos"'}>Promover</button>
              <button type="button" class="youth-action-btn youth-action-btn--ghost" data-release-youth="${escAttr(p.playerId)}">Dispensar</button>
            </div>
          </article>`;
        })
        .join('')}
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
      renderLocked();
      return;
    }
    tabs?.classList.remove('hidden');
    panels?.classList.remove('hidden');
    const locked = $('#youthLocked');
    if (locked) locked.remove();
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
        const released = releaseYouthPlayer(userClubState(), id);
        if (released.ok) deps.onYouthReleased?.(released.player);
        deps.syncUserSquad?.();
        render();
        return;
      }

      const cardBtn = e.target.closest('[data-youth-card]');
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
