import '../../../css/national-team-offers.css';
import { ALL_NATIONAL_TEAMS as NATIONAL_TEAMS, nationalTeamFlagUrl, nationalTeamPower } from '../../engine/national-teams.js';
import { preloadCompetitionTrophy } from '../../ui/competition-trophies.js';
import {
  NATIONAL_TEAM_OFFER_COUNT,
  NATIONAL_TEAM_OFFER_TEAMS_PER_PROPOSAL,
} from '../../engine/national-team-offers.js';

const MODAL_HTML = `
<div id="nationalTeamOfferModal" class="nto-modal ntov2-modal hidden" role="dialog" aria-modal="true" aria-labelledby="ntOfferTitle">
  <div class="mv2-shell ntov2" data-tone="gold">
    <header class="mv2-head ntov2-head">
      <div>
        <span class="mv2-kicker">COPA DO MUNDO · CONVITE</span>
        <h2 id="ntOfferTitle" class="mv2-title">Convites para Seleções</h2>
      </div>
      <img id="ntOfferTrophy" class="ntov2-trophy competition-trophy-art--world-cup" data-trophy-key="world-cup" src="" alt="" width="56" height="56">
    </header>
    <div class="mv2-body ntov2-body">
      <div class="mv2-tiles ntov2-tiles">
        <div class="mv2-tile"><small>PERÍODO</small><strong id="ntOfferHeroDates">11 JUN — 19 JUL · 2026</strong></div>
        <div class="mv2-tile"><small>FORMATO</small><strong>Grupos + mata-mata</strong></div>
        <div class="mv2-tile"><small>SEU CLUBE</small><strong>Segue em paralelo</strong></div>
      </div>
      <p class="ntov2-sub" id="ntOfferOffersSub">Escolha uma seleção para comandar na Copa.</p>
      <div class="ntov2-list" role="list" aria-label="Propostas de seleções">
        <div class="ntov2-list-head" aria-hidden="true"><span></span><span>SELEÇÃO</span><span>OVR</span><span></span></div>
        <div id="ntOfferOffersBody"></div>
      </div>
      <p class="mv2-note ntov2-note" id="ntOfferFootnote"></p>
    </div>
    <footer class="mv2-foot ntov2-foot">
      <button id="ntOfferDenyAll" class="mv2-btn is-ghost ntov2-deny" type="button">Negar todos</button>
    </footer>
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
        return `<div class="ntov2-row" role="listitem">
          <span class="ntov2-flag">${flagUrl ? `<img src="${escapeHtml(flagUrl)}" alt="">` : ''}</span>
          <span class="ntov2-team"><b>${escapeHtml(offer.name)}</b><small>FIFA ${escapeHtml(offer.fifaRank)}º</small></span>
          <span class="ntov2-ovr">${ovr}</span>
          <span class="ntov2-actions">
            <button type="button" class="mv2-btn is-ghost" data-action="view" data-code="${escapeHtml(offer.code)}">Ver time</button>
            <button type="button" class="mv2-btn is-primary" data-action="accept" data-code="${escapeHtml(offer.code)}" data-offer-id="${escapeHtml(offer.id)}">Aceitar</button>
          </span>
        </div>`;
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
