/**
 * Modal vertical de contratos — Elenco → Contrato.
 */
import { listRosterContractAlerts, wageMonthlyFromRound } from '../../engine/player-contracts.js';

const esc = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');

export function createRosterContractsFeature(deps) {
  const { $, onClick, getSquad, getUserDivision, getCareerDate, onRenewalRespond } = deps;
  let open = false;

  const getAlerts = () =>
    listRosterContractAlerts(getSquad?.() || [], {
      division: getUserDivision?.() || 'A',
      careerDate: getCareerDate?.() || new Date(),
    });

  const renderRow = (entry, division) => {
    const { player, playerId, inRenewal, wageAsk, wageCurrent } = entry;
    const wageMonthly = wageMonthlyFromRound(wageCurrent, division);
    const askMonthly = wageMonthlyFromRound(wageAsk, division);
    const actions = inRenewal
      ? `<div class="message-reader-transfer-buttons roster-contract-row-buttons">
          <button type="button" class="message-reader-offer-icon is-reject roster-contract-decline" data-contract-player="${esc(playerId)}" aria-label="Recusar renovação" title="Recusar"><span aria-hidden="true">×</span></button>
          <button type="button" class="message-reader-offer-icon is-accept roster-contract-accept" data-contract-player="${esc(playerId)}" aria-label="Aceitar renovação" title="Aceitar"><span aria-hidden="true">✓</span></button>
        </div>`
      : '';
    return `<article class="roster-contract-row ${entry.expired ? 'is-expired' : entry.tone === 'critical' ? 'is-critical' : 'is-warning'}" data-contract-player="${esc(playerId)}">
      <div class="roster-contract-row-main">
        <strong>${esc(player.name)}</strong>
        <span class="roster-contract-row-wage">Salário: R$ ${wageMonthly.toLocaleString('pt-BR')}/mês</span>
        <span class="roster-contract-row-ask">Renovação: R$ ${askMonthly.toLocaleString('pt-BR')}/mês · R$ ${wageAsk.toLocaleString('pt-BR')}/rod</span>
      </div>
      ${actions}
    </article>`;
  };

  const render = () => {
    const modal = $('#rosterContractModal');
    const list = $('#rosterContractList');
    if (!modal || !list) return;

    const division = getUserDivision?.() || 'A';
    const alerts = getAlerts();
    list.innerHTML = alerts.length
      ? alerts.map(entry => renderRow(entry, division)).join('')
      : '<div class="roster-contract-empty">Nenhum contrato a vencer ou vencido no momento.</div>';

    modal.classList.toggle('hidden', !open);
    const btn = $('#rosterContractBtn');
    btn?.classList.toggle('is-open', open);
    btn?.setAttribute('aria-expanded', open ? 'true' : 'false');
    updateButtonBadge(alerts);
  };

  const updateButtonBadge = (alertsInput = null) => {
    const btn = $('#rosterContractBtn');
    const alerts = alertsInput || getAlerts();
    const count = alerts.length;
    const renewalCount = alerts.filter(item => item.inRenewal).length;
    btn?.classList.toggle('has-alerts', count > 0);
    btn?.classList.toggle('has-action', renewalCount > 0);
    const badge = btn?.querySelector('.roster-contract-btn-badge');
    if (badge) {
      badge.textContent = String(count);
      badge.classList.toggle('hidden', count === 0);
    }
    if (btn) {
      btn.title =
        count > 0
          ? `${count} contrato${count === 1 ? '' : 's'} a vencer ou vencido${count === 1 ? '' : 's'}`
          : 'Contratos em vencimento';
    }

    const navBadge = $('#squadNavBadge');
    if (navBadge) {
      navBadge.textContent = String(count);
      navBadge.classList.toggle('hidden', count === 0);
      navBadge.title =
        count > 0
          ? `${count} contrato${count === 1 ? '' : 's'} a vencer ou vencido${count === 1 ? '' : 's'}`
          : '';
    }
    const squadNav = document.querySelector('.nav[data-view="squad"]');
    if (squadNav) {
      squadNav.title =
        count > 0
          ? `${count} contrato${count === 1 ? '' : 's'} precisa${count === 1 ? '' : 'm'} de atenção`
          : '';
    }
  };

  const openPanel = () => {
    open = true;
    render();
  };

  const closePanel = () => {
    open = false;
    render();
  };

  const togglePanel = () => {
    open = !open;
    render();
  };

  const bindHandlers = () => {
    onClick('#rosterContractBtn', () => togglePanel());
    onClick('#closeRosterContractModal', () => closePanel());
    onClick('#closeRosterContractModalFooter', () => closePanel());
    onClick('#rosterContractModal', event => {
      if (event.target.id === 'rosterContractModal') closePanel();
    });
    onClick('#rosterContractList', event => {
      const accept = event.target.closest('.roster-contract-accept');
      const decline = event.target.closest('.roster-contract-decline');
      const playerId = accept?.dataset.contractPlayer || decline?.dataset.contractPlayer;
      if (!playerId || typeof onRenewalRespond !== 'function') return;
      onRenewalRespond({ playerId, accept: !!accept });
      render();
    });
  };

  return {
    bindHandlers,
    render,
    updateButtonBadge,
    openPanel,
    closePanel,
    togglePanel,
  };
}
