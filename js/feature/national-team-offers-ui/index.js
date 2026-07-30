import '../../../css/national-team-offers.css';
import { NATIONAL_TEAMS, nationalTeamFlagUrl, nationalTeamPower } from '../../engine/national-teams.js';
import { preloadCompetitionTrophy } from '../../ui/competition-trophies.js';
import {
  NATIONAL_TEAM_OFFER_COUNT,
  NATIONAL_TEAM_OFFER_TEAMS_PER_PROPOSAL,
} from '../../engine/national-team-offers.js';

const MODAL_HTML = `
<div id="nationalTeamOfferModal" class="nto-modal hidden" role="dialog" aria-modal="true" aria-labelledby="ntOfferTitle">
  <div class="nto-modal-card">
    <div class="nto-layout-stage">
      <div class="nto-hero-column">
        <p class="nto-hero-kicker">COPA DO MUNDO</p>
        <div class="nto-trophy-wrap">
          <img id="ntOfferTrophy" class="nto-trophy competition-trophy-art--world-cup" data-trophy-key="world-cup" src="" alt="" width="120" height="120">
        </div>
        <p class="nto-hero-dates" id="ntOfferHeroDates">11 JUN — 19 JUL · 2026</p>
        <p class="nto-hero-meta">Fase de grupos + mata-mata · Paralelo ao seu clube</p>
      </div>
      <h2 id="ntOfferTitle" class="nto-offers-title">Convites para Seleções</h2>
      <p class="nto-offers-sub" id="ntOfferOffersSub">Escolha uma seleção para comandar na CMU.</p>
      <div class="nto-table-wrap">
        <table class="nto-table" aria-label="Propostas de seleções">
          <thead>
            <tr>
              <th scope="col" class="nto-col-flag"></th>
              <th scope="col">Seleção</th>
              <th scope="col" class="nto-col-ovr">OVR</th>
              <th scope="col" class="nto-col-actions">Ações</th>
            </tr>
          </thead>
          <tbody id="ntOfferOffersBody"></tbody>
        </table>
      </div>
      <p class="nto-footnote" id="ntOfferFootnote"></p>
      <button id="ntOfferDenyAll" class="nto-deny-all" type="button">Negar todos</button>
    </div>
  </div>
</div>`;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createNationalTeamOffersUiFeature(deps) {
  const { $, onAccept, onViewTeam, onDenyAll, getCareerSeason } = deps;
  let handlersBound = false;
  let session = null;

  const injectDom = () => {
    if (!$('#nationalTeamOfferModal')) {
      document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
    }
    bindHandlers();
    preloadCompetitionTrophy('world-cup').then(url => {
      const img = $('#ntOfferTrophy');
      if (img && url) {
        img.src = url;
        img.alt = 'Troféu Copa do Mundo';
        img.dataset.trophyKey = 'world-cup';
        img.classList.add('competition-trophy-art--world-cup');
      }
    });
  };

  const bindHandlers = () => {
    if (handlersBound) return;
    handlersBound = true;

    $('#ntOfferDenyAll')?.addEventListener('click', () => {
      onDenyAll?.();
      close();
    });

    $('#ntOfferOffersBody')?.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const code = button.dataset.code || '';
      const offerId = button.dataset.offerId || '';
      if (button.dataset.action === 'accept') {
        onAccept?.({ code, offerId });
        close();
        return;
      }
      if (button.dataset.action === 'view') {
        onViewTeam?.(code);
      }
    });
  };

  const render = ({ offers = [], issuedCount = 0 } = {}) => {
    const isLastProposalWindow = issuedCount >= NATIONAL_TEAM_OFFER_COUNT;
    const offersSub = $('#ntOfferOffersSub');
    const footnote = $('#ntOfferFootnote');
    const offersBody = $('#ntOfferOffersBody');
    const year = getCareerSeason?.() || 2026;

    if (offersSub) {
      offersSub.textContent =
        !isLastProposalWindow
          ? `Nova proposta disponível · ${NATIONAL_TEAM_OFFER_TEAMS_PER_PROPOSAL} seleções para escolher`
          : 'Última proposta — escolha uma seleção para comandar.';
    }
    if (footnote) {
      footnote.textContent = isLastProposalWindow
        ? 'Você não receberá mais convite(s) nesta temporada de Copa.'
        : 'Próxima proposta chega em 7 dias. Você ainda receberá convite(s) nesta temporada de Copa.';
    }
    if ($('#ntOfferHeroDates')) {
      $('#ntOfferHeroDates').textContent = `11 JUN — 19 JUL · ${year}`;
    }
    if (!offersBody) return;

    offersBody.innerHTML = offers
      .map(offer => {
        const meta = NATIONAL_TEAMS[offer.code];
        const flagUrl = meta ? nationalTeamFlagUrl(meta.iso) : '';
        const ovr = meta ? nationalTeamPower(meta.block) : 88;
        return `<tr>
          <td><div class="nto-flag"><img src="${escapeHtml(flagUrl)}" alt=""></div></td>
          <td>
            <span class="nto-team-name">${escapeHtml(offer.name)}</span>
            <span class="nto-team-rank">FIFA ${escapeHtml(offer.fifaRank)}º</span>
          </td>
          <td class="nto-col-ovr"><span class="nto-ovr">${ovr}</span></td>
          <td class="nto-col-actions">
            <div class="nto-row-actions">
              <button type="button" class="nto-action nto-action--accept" data-action="accept" data-code="${escapeHtml(offer.code)}" data-offer-id="${escapeHtml(offer.id)}">Aceitar</button>
              <button type="button" class="nto-action nto-action--view" data-action="view" data-code="${escapeHtml(offer.code)}">Ver Time</button>
            </div>
          </td>
        </tr>`;
      })
      .join('');
  };

  const open = payload => {
    injectDom();
    session = payload;
    render(payload);
    $('#nationalTeamOfferModal')?.classList.remove('hidden');
  };

  const close = () => {
    session = null;
    $('#nationalTeamOfferModal')?.classList.add('hidden');
  };

  const isOpen = () => !$('#nationalTeamOfferModal')?.classList.contains('hidden');

  const init = () => injectDom();

  return { init, open, close, isOpen, render };
}
