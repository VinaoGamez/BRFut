/**
 * Modal de card do jogador — clique no nome abre card interativo.
 */

import { resolvePlayerId } from '../../engine/player-identity.js';
import { fetchPlayerSeasonStats } from '../../core/player-stats-sync.js';
import { positionLine } from '../shared/player-cells.js';
import { clubCrestUrl } from '../../engine/club-crests.js';
import { cardArtForPlayer } from '../../engine/player-card-art.js';
import { rosterPlayerToCardPlayer } from '../player-card/roster-card-player.js';
import { topThreeStats, barStats, careerSnapshot } from '../../lab/card-back.js';
import { wageMonthlyFromRound } from '../../engine/player-contracts.js';

// A arte entra aqui, e nao no adaptador de dados: e o unico lugar que ja
// depende da camada visual, entao nao ha import dinamico nem PNG arrastado
// para quem so precisa da parte de stats.
const withCardArt = context => ({ ...context, resolveArt: cardArtForPlayer });

const MODAL_ID = 'playerCardModal';
let cardHandlersBound = false;

function ensureModal() {
  if (document.getElementById(MODAL_ID)) return;
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div id="${MODAL_ID}" class="modal hidden player-card-modal" role="dialog" aria-modal="true" aria-labelledby="playerCardV2Name">
      <div class="player-card-modal-shell mv2-shell pcv2" data-tone="lime">
        <header class="mv2-head pcv2-head">
          <img class="pcv2-crest" id="playerCardV2Crest" alt="" hidden>
          <div class="pcv2-head-text">
            <span class="mv2-kicker" id="playerCardV2Kicker">ELENCO</span>
            <h2 class="mv2-title pcv2-name" id="playerCardV2Name">Jogador</h2>
          </div>
          <button type="button" class="mv2-close" data-pcv2-close aria-label="Fechar">×</button>
        </header>
        <div class="pcv2-grid">
          <div class="pcv2-photo" id="playerCardV2Photo" aria-hidden="true"></div>
          <div class="pcv2-info" id="playerCardV2Info"></div>
        </div>
        <footer class="mv2-foot pcv2-foot">
          <p class="pcv2-foot-hint" id="playerCardV2Hint"></p>
          <button type="button" class="mv2-btn is-ghost" data-pcv2-action="loan">EMPRESTAR</button>
          <button type="button" class="mv2-btn is-primary" data-pcv2-action="main">VENDER</button>
        </footer>
      </div>
    </div>`,
  );
}

const escHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const money = value => {
  const amount = Math.round(Number(value) || 0);
  if (amount <= 0) return '—';
  if (amount >= 1_000_000) return `R$ ${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1).replace('.', ',')} mi`;
  if (amount >= 1_000) return `R$ ${Math.round(amount / 1_000)} mil`;
  return `R$ ${amount}`;
};

const FOOT_LABEL = { right: 'Destro', left: 'Canhoto', both: 'Ambidestro', direito: 'Destro', esquerdo: 'Canhoto', ambos: 'Ambidestro', r: 'Destro', l: 'Canhoto', d: 'Destro', e: 'Canhoto' };

const statColor = value => (value >= 75 ? 'lime' : value >= 60 ? 'cyan' : value >= 45 ? 'muted' : 'low');

/** Painel de informações da ficha v2 (atributos, temporada, contrato). */
export function playerCardInfoMarkup(card, { division = null, isOwn = false } = {}) {
  if (!card) return '';
  const pos = card.pos || 'GOL';
  const ovr = Math.round(Number(card.overall) || 0) || '—';
  const pot = Math.round(Number(card.potential) || 0);
  const age = Math.round(Number(card.age) || 0);
  const foot = FOOT_LABEL[String(card.preferredFoot || card.foot || '').toLowerCase()] || null;
  const fatigue = Number.isFinite(Number(card.fatigue)) ? Math.round(Number(card.fatigue)) : null;
  const injured = !!(card.injury && (card.injury.roundsLeft > 0 || card.injury.weeksLeft > 0 || card.injury.active));
  const chips = [
    `<span class="pcv2-chip is-pos" data-line="${positionLine(pos)}">${escHtml(pos)}</span>`,
    age ? `<span class="pcv2-chip">${age} anos</span>` : '',
    foot ? `<span class="pcv2-chip">${foot}</span>` : '',
    card.nationality ? `<span class="pcv2-chip">${escHtml(card.nationality)}</span>` : '',
    injured ? '<span class="pcv2-chip is-bad">Lesionado</span>' : '',
  ].join('');
  const top = topThreeStats(card, pos);
  const rest = barStats(card, pos).slice(0, 6);
  const attrRow = (s, highlight) => `<div class="pcv2-attr${highlight ? ' is-top' : ''}" data-tone="${statColor(s.value)}">
      <span>${escHtml(s.label)}</span><i><b style="width:${Math.max(4, Math.min(100, s.value))}%"></b></i><strong>${s.value}</strong></div>`;
  const attrs = top.length || rest.length
    ? top.map(s => attrRow(s, true)).join('') + rest.map(s => attrRow(s, false)).join('')
    : '<p class="pcv2-empty">Sem atributos registrados.</p>';
  const career = careerSnapshot(card);
  const rating = Number(career.avgRating);
  const tile = (label, value, cls = '') => `<div class="mv2-tile"><small>${label}</small><strong class="${cls}">${value}</strong></div>`;
  const contract = card.contract || {};
  const expires = contract.expiresDate ? String(contract.expiresDate).slice(0, 4) : (card.contractUntil ? String(card.contractUntil).slice(0, 4) : '—');
  const wageRound = Number(contract.wagePerRound ?? card.wage) || 0;
  const wageMonth = wageRound ? wageMonthlyFromRound(wageRound, division || card.clubDivision || 'A') : 0;
  const condition = fatigue == null ? '' : `<div class="pcv2-cond" data-level="${fatigue >= 70 ? 'ok' : fatigue >= 40 ? 'warn' : 'low'}">
      <small>CONDIÇÃO</small><i><b style="width:${fatigue}%"></b></i><strong>${fatigue}%</strong></div>`;
  const potential = pot && pot > Number(card.overall)
    ? `<div class="pcv2-pot"><small>POTENCIAL</small><strong>${pot}</strong><em>+${pot - Math.round(Number(card.overall) || 0)}</em></div>`
    : '';
  return `
    <div class="pcv2-top">
      <div class="pcv2-ovr" data-tone="${statColor(Number(card.overall) || 0)}"><small>OVR</small><strong>${ovr}</strong></div>
      <div class="pcv2-id">
        <div class="pcv2-chips">${chips}</div>
        ${condition}
      </div>
      ${potential}
    </div>
    <section class="pcv2-sec">
      <h3 class="pcv2-h">ATRIBUTOS</h3>
      <div class="pcv2-attrs">${attrs}</div>
    </section>
    <section class="pcv2-sec">
      <h3 class="pcv2-h">TEMPORADA</h3>
      <div class="mv2-tiles">
        ${tile('JOGOS', career.apps || 0)}
        ${tile('GOLS', career.goals || 0)}
        ${tile('ASSIST.', career.assists || 0)}
        ${tile('NOTA', Number.isFinite(rating) && rating > 0 ? rating.toFixed(1).replace('.', ',') : '—', 'is-lime')}
      </div>
    </section>
    <section class="pcv2-sec">
      <h3 class="pcv2-h">${isOwn ? 'CONTRATO' : 'MERCADO'}</h3>
      <div class="mv2-tiles">
        ${tile('ATÉ', expires)}
        ${tile('SALÁRIO / MÊS', money(wageMonth), 'is-money')}
        ${tile('VALOR', money(card.marketValue), 'is-money')}
      </div>
    </section>`;
}

export function createPlayerCardModal(deps = {}) {
  ensureModal();

  const modal = () => document.getElementById(MODAL_ID);
  const photoEl = () => document.getElementById('playerCardV2Photo');
  let openCtx = null;

  const close = () => {
    modal()?.classList.add('hidden');
    const photo = photoEl();
    if (photo) photo.innerHTML = '';
    openCtx = null;
  };

  const resolvePlayer = (playerId, clubName) => {
    if (!playerId) return null;
    const finder = deps.findPlayerInWorld;
    if (typeof finder === 'function') {
      const found = finder(playerId);
      if (found?.player) return { player: found.player, clubName: found.clubName || clubName || null };
    }
    const squad = deps.getUserSquad?.() || [];
    const local = squad.find(p => resolvePlayerId(p) === playerId);
    if (local) return { player: local, clubName: deps.getUserClub?.() || null };
    return null;
  };

  const open = async ({ playerId, clubName = null } = {}) => {
    const resolved = resolvePlayer(playerId, clubName);
    if (!resolved?.player) return false;

    const { player, clubName: ownerClub } = resolved;
    const userClub = deps.getUserClub?.() || '';
    const isOwn = ownerClub === userClub;
    const transfers = deps.getTransfersUi?.();
    const engine = deps.getTransfersEngine?.();
    const marketOpen = engine?.marketOpen?.() ?? false;
    const canLoadTransfers = !!transfers || typeof deps.ensureTransfersUi === 'function';
    const actionsEnabled = marketOpen && canLoadTransfers;
    const withTransfers = fn => Promise.resolve(transfers || deps.ensureTransfersUi?.()).then(ui => { if (ui) fn(ui); }).catch(() => {});
    const actionMode = isOwn ? 'sell' : 'buy';

    openCtx = { playerId: resolvePlayerId(player), isOwn, ownerClub };

    const cardContext = {
      playerHistory: deps.getPlayerHistory?.(),
      careerSeason: deps.getCareerSeason?.(),
      clubName: ownerClub,
      clubDivision: ownerClub ? deps.getClubs?.()?.[ownerClub]?.division : null,
    };
    const cardPlayer = await rosterPlayerToCardPlayer(player, withCardArt(cardContext));

    modal()?.classList.remove('hidden');

    const division = cardContext.clubDivision || null;
    const shell = modal()?.querySelector('.pcv2');
    const kicker = document.getElementById('playerCardV2Kicker');
    const nameEl = document.getElementById('playerCardV2Name');
    if (kicker) {
      const div = division ? ` · SÉRIE ${String(division).toUpperCase()}` : '';
      kicker.textContent = ownerClub ? `${isOwn ? 'SEU ELENCO' : ownerClub.toUpperCase()}${div}` : 'JOGADOR LIVRE';
    }
    if (nameEl) {
      nameEl.textContent = player.name || 'Jogador';
      nameEl.title = player.name || '';
    }
    const crestEl = document.getElementById('playerCardV2Crest');
    if (crestEl) {
      const url = ownerClub ? clubCrestUrl(ownerClub) : null;
      crestEl.hidden = !url;
      if (url) crestEl.src = url;
      else crestEl.removeAttribute('src');
    }
    const mainBtn = modal()?.querySelector('[data-pcv2-action="main"]');
    const loanBtn = modal()?.querySelector('[data-pcv2-action="loan"]');
    const hint = document.getElementById('playerCardV2Hint');
    if (mainBtn) {
      mainBtn.textContent = isOwn ? 'VENDER' : 'COMPRAR';
      mainBtn.disabled = !actionsEnabled;
    }
    if (loanBtn) loanBtn.disabled = !actionsEnabled;
    if (hint) {
      hint.textContent = actionsEnabled ? '' : (canLoadTransfers ? 'Mercado fechado: negociações só durante a janela.' : '');
      hint.hidden = !hint.textContent;
    }
    if (shell) {
      shell.dataset.pcv2Own = isOwn ? '1' : '0';
      shell._pcv2Actions = {
        main: () => {
          if (!actionsEnabled) return;
          close();
          withTransfers(ui => (isOwn ? ui.openSellFromCard?.(resolvePlayerId(player)) : ui.openBuyFromCard?.(resolvePlayerId(player))));
        },
        loan: () => {
          if (!actionsEnabled) return;
          close();
          withTransfers(ui => (isOwn ? ui.openLoanOutFromCard?.(resolvePlayerId(player)) : ui.openLoanInFromCard?.(resolvePlayerId(player))));
        },
      };
    }

    const renderCard = currentCard => {
      const info = document.getElementById('playerCardV2Info');
      if (info) info.innerHTML = playerCardInfoMarkup(currentCard, { division, isOwn });
      const photo = photoEl();
      if (photo) {
        photo.dataset.line = positionLine(currentCard.pos);
        const art = currentCard._cardArt;
        photo.innerHTML = art
          ? `<span class="pcv2-photo-frame"><img src="${escHtml(art)}" alt="" decoding="async"></span>`
          : `<span class="pcv2-photo-empty">${escHtml(currentCard.pos || '')}</span>`;
      }
    };
    renderCard(cardPlayer);

    // O card abre com o save local. Estatísticas da API são apenas um
    // enriquecimento eventual e nunca bloqueiam a interação do jogador.
    void fetchPlayerSeasonStats(resolvePlayerId(player), deps.getCareerSeason?.(), ownerClub)
      .then(async remoteStats => {
        if (!remoteStats || openCtx?.playerId !== resolvePlayerId(player) || modal()?.classList.contains('hidden')) return;
        const refreshedCard = await rosterPlayerToCardPlayer(player, { ...withCardArt(cardContext), remoteStats });
        if (openCtx?.playerId === resolvePlayerId(player)) renderCard(refreshedCard);
      })
      .catch(() => {});

    return true;
  };

  const bindHandlers = () => {
    if (cardHandlersBound) return;
    cardHandlersBound = true;
    const blockedCardRoot =
      '.match-report-modal, .match-report-ratings, .match-report-name, #matchReportContent';

    const handleCardTrigger = (event, trigger) => {
      if (!trigger || trigger.closest(blockedCardRoot)) return false;
      event.preventDefault();
      event.stopPropagation();
      const playerId = trigger.dataset.playerId;
      const clubName = trigger.dataset.playerClub || null;
      open({ playerId, clubName });
      return true;
    };

    document.addEventListener('click', event => {
      const trigger = event.target.closest('[data-open-player-card]');
      if (!trigger) return;
      handleCardTrigger(event, trigger);
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const trigger = event.target.closest('[data-open-player-card]');
      if (!trigger) return;
      if (handleCardTrigger(event, trigger)) event.preventDefault();
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (modal()?.classList.contains('hidden')) return;
      close();
    });

    modal()?.addEventListener('click', event => {
      if (event.target === modal()) { close(); return; }
      if (event.target.closest('[data-pcv2-close]')) { close(); return; }
      const actionBtn = event.target.closest('[data-pcv2-action]');
      if (actionBtn && !actionBtn.disabled) {
        const shell = modal()?.querySelector('.pcv2');
        shell?._pcv2Actions?.[actionBtn.dataset.pcv2Action]?.();
      }
    });

    window.addEventListener('brfut:player-stats-updated', () => {
      if (!openCtx || modal()?.classList.contains('hidden')) return;
      void open({ playerId: openCtx.playerId, clubName: openCtx.ownerClub });
    });
  };

  return { open, close, bindHandlers };
}
