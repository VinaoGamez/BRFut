/**
 * Modal vertical de contratos — Elenco → Contrato.
 */
import { listRosterContractAlerts, wageMonthlyFromRound, contractExpiresDate } from '../../engine/player-contracts.js';

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

  const money = value => {
    const n = Math.round(Number(value) || 0);
    if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
    if (Math.abs(n) >= 1_000) return `R$ ${Math.round(n / 1_000).toLocaleString('pt-BR')} mil`;
    return `R$ ${n.toLocaleString('pt-BR')}`;
  };
  const fmtDate = date => (date ? new Date(date).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '').replace(' de ', '/') : '—');

  // Contratos v2: resumo da folha, pedido claro (atual → pedido) e sem lista vazia.
  const renderRow = entry => {
    const { player, playerId, inRenewal, wageAsk, wageCurrent } = entry;
    const tone = entry.expired ? 'bad' : entry.tone === 'critical' ? 'warn' : 'soft';
    const until = entry.expired ? 'VENCIDO' : fmtDate(entry.expires);
    const left = entry.expired ? 'pode sair de graça' : entry.daysLeft != null ? `${entry.daysLeft} dias` : '';
    const actions = inRenewal
      ? `<div class="ct2-actions"><button type="button" class="ct2-btn roster-contract-decline" data-contract-player="${esc(playerId)}">RECUSAR</button><button type="button" class="ct2-btn is-primary roster-contract-accept" data-contract-player="${esc(playerId)}">RENOVAR</button></div>`
      : '<div class="ct2-actions"><small>renovação abre perto do fim</small></div>';
    return `<article class="ct2-row is-${tone}" data-contract-player="${esc(playerId)}">
      <i class="ct2-pos">${esc(player.pos || '—')}</i>
      <div class="ct2-who"><strong>${esc(player.name)}</strong><small>${esc(player.age ?? '—')} anos · OVR ${esc(player.overall ?? '—')}</small></div>
      <div class="ct2-until"><b>${esc(until)}</b><small>${esc(left)}</small></div>
      <div class="ct2-wage"><span>${money(wageCurrent)}</span> → <b>${money(wageAsk)}</b><small>salário por rodada</small></div>
      ${actions}
    </article>`;
  };

  const render = () => {
    const modal = $('#rosterContractModal');
    const list = $('#rosterContractList');
    if (!modal || !list) return;
    const alerts = getAlerts();
    const squad = getSquad?.() || [];
    const payroll = squad.reduce((sum, player) => sum + (Math.round(Number(player.contract?.wagePerRound ?? player.wage) || 0)), 0);
    const pending = alerts.filter(entry => entry.inRenewal);
    const raise = pending.reduce((sum, entry) => sum + Math.max(0, (Number(entry.wageAsk) || 0) - (Number(entry.wageCurrent) || 0)), 0);
    const expired = alerts.filter(entry => entry.expired).length;
    const tile = (label, value, sub, tone = '') => `<div class="ct2-tile${tone ? ` is-${tone}` : ''}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
    const summary = `<div class="ct2-summary">
      ${tile('A VENCER', String(alerts.length - expired), alerts.length - expired ? 'contratos perto do fim' : 'nenhum perto do fim', 'gold')}
      ${tile('VENCIDOS', String(expired), expired ? 'saem de graça no fim' : 'nenhum', expired ? 'red' : '')}
      ${tile('FOLHA ATUAL', money(payroll), 'por rodada')}
      ${tile('SE RENOVAR TODOS', money(payroll + raise), raise ? `+${money(raise)} por rodada` : 'sem aumento', 'cyan')}
    </div>`;
    let rows;
    if (alerts.length) {
      rows = `<div class="ct2-sec">PEDIDOS E VENCIMENTOS · ${alerts.length}</div>${alerts.map(renderRow).join('')}`;
    } else {
      const upcoming = squad
        .map(player => ({ player, expires: contractExpiresDate(player) }))
        .filter(item => item.expires)
        .sort((x, y) => x.expires - y.expires)
        .slice(0, 5);
      rows = `<div class="ct2-sec">NENHUM PEDIDO AGORA · PRÓXIMOS A VENCER</div>${upcoming.length ? upcoming.map(({ player, expires }) => `<article class="ct2-row is-soft"><i class="ct2-pos">${esc(player.pos || '—')}</i><div class="ct2-who"><strong>${esc(player.name)}</strong><small>${esc(player.age ?? '—')} anos · OVR ${esc(player.overall ?? '—')}</small></div><div class="ct2-until"><b>${esc(fmtDate(expires))}</b><small>fim do contrato</small></div><div class="ct2-wage"><span>${money(player.contract?.wagePerRound ?? player.wage)}</span><small>salário por rodada</small></div><div class="ct2-actions"><small>sem pedido ainda</small></div></article>`).join('') : '<div class="ct2-empty">Nenhum contrato com data de término.</div>'}`;
    }
    list.innerHTML = `${summary}${rows}`;

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
    getAlerts,
    updateButtonBadge,
    openPanel,
    closePanel,
    togglePanel,
  };
}
