import { teamCrestHtml } from '../../ui/team-crest.js';
import { managerCardLayoutStyle } from '../../ui/manager-card-layout.js';
import {
  resolveNationalRankingEntry,
  sortNationalRankingEntries,
} from '../../engine/national-ranking.js';

const STAFF_ROUNDS_PER_MONTH = 4;
const MANAGER_CARD_ART_COUNT = 17;
const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const normalizeClubSearch = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const managerCardArtUrl = manager => {
  const key = String(manager?.id || manager?.name || 'manager');
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const artIndex = (hash >>> 0) % MANAGER_CARD_ART_COUNT + 1;
  return `./manager-cards/manager-${String(artIndex).padStart(2, '0')}.png`;
};

/** Rankings nacionais de clubes e técnicos (views Ranking / Técnicos). */
export function createRankingViewsFeature(deps) {
  const {
    $,
    on,
    onClick,
    getUserClub,
    getCareerProfile,
    getManagerRanking,
    getNationalRankingEntries,
    getClubs,
    getNationalCompetitions,
    getCareerSeason,
    getNationalRankingFinalizedSeasons,
    getCupChampion,
    getCareerSeed,
    estimateStaffBill,
    formatBudget,
    getUserClubInitials,
  } = deps;

  let nationalRankingSearchQuery = '';
  let openTrophyManagerId = null;

  const currentNationalRanking = () => {
    const entries = Object.values(getNationalRankingEntries())
      .map(entry => resolveNationalRankingEntry(entry, {
        clubs: getClubs(),
        nationalCompetitions: getNationalCompetitions(),
        careerSeason: getCareerSeason(),
        finalizedSeasons: getNationalRankingFinalizedSeasons(),
        cupChampion: getCupChampion(),
        careerSeed: getCareerSeed(),
      }))
      .filter(Boolean);
    return sortNationalRankingEntries(entries);
  };

  const nationalRankingRowHtml = (entry, position, { pinned = false } = {}) => {
    const userClub = getUserClub();
    const clubMarkup = pinned
      ? `<span class="national-ranking-club-cell">${teamCrestHtml(entry.club, { className: 'national-ranking-row-crest' })}<span class="club-link">${entry.club}</span></span>`
      : `<span class="club-link">${entry.club}</span>`;
    const userRow = entry.club === userClub;
    const scoreHint = `Base ${entry.base.toFixed(1)} + Campeonatos ${entry.championshipPoints.toFixed(1)} + Títulos ${entry.titlePoints.toFixed(1)}`;
    return `<div class="national-ranking-row${pinned ? ' national-ranking-user-row user-ranking' : userRow ? ' user-ranking' : ''}" data-club="${entry.club}" role="button" tabindex="0" aria-label="${entry.club} · ${scoreHint} · Total ${entry.total.toFixed(1)}"><span>${position}</span>${clubMarkup}<span>${entry.division}</span><span class="national-ranking-base national-ranking-col-hidden" aria-hidden="true">${entry.base.toFixed(1)}</span><span class="national-ranking-championships national-ranking-col-hidden" aria-hidden="true">${entry.championshipPoints.toFixed(1)}</span><span class="national-ranking-titles">${entry.titlePoints.toFixed(1)}</span><span class="national-ranking-total" title="${scoreHint}">${entry.total.toFixed(1)}</span></div>`;
  };

  const renderNationalRanking = () => {
    const userClub = getUserClub();
    const ranking = currentNationalRanking();
    const query = normalizeClubSearch(nationalRankingSearchQuery);
    const userIndex = ranking.findIndex(entry => entry.club === userClub);
    const userSlot = $('#nationalRankingUserRow');
    const userMatches = !query || (userIndex >= 0 && normalizeClubSearch(ranking[userIndex].club).includes(query));
    if (userIndex >= 0 && userMatches) {
      userSlot.innerHTML = nationalRankingRowHtml(ranking[userIndex], userIndex + 1, { pinned: true });
      userSlot.hidden = false;
    } else {
      userSlot.innerHTML = '';
      userSlot.hidden = true;
    }
    const filtered = query
      ? ranking.map((entry, index) => ({ entry, position: index + 1 })).filter(({ entry }) => normalizeClubSearch(entry.club).includes(query))
      : ranking.map((entry, index) => ({ entry, position: index + 1 }));
    const table = $('#nationalRankingTable');
    table.innerHTML = filtered.length
      ? filtered.map(({ entry, position }) => nationalRankingRowHtml(entry, position, { pinned: false })).join('')
      : '<div class="national-ranking-empty">Nenhum time encontrado.</div>';
    if (query && filtered.length) {
      requestAnimationFrame(() => {
        const hit = table.querySelector('.national-ranking-row');
        if (!hit) return;
        hit.classList.add('ranking-search-hit');
        hit.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
  };

  const runNationalRankingClubSearch = () => {
    const input = $('#nationalRankingClubSearch');
    nationalRankingSearchQuery = input?.value || '';
    renderNationalRanking();
  };

  const managerMonthlySalary = entry => {
    const clubs = getClubs();
    const preferred = ['A', 'B', 'C', 'D'].includes(entry.preferredDivision) ? entry.preferredDivision : null;
    const division = entry.status === 'employed' ? (entry.division || 'D') : (preferred || 'D');
    const club = entry.club ? clubs[entry.club] : null;
    const perRound = estimateStaffBill(club || {}, division, {
      managerId: entry.id,
      managerName: entry.name,
      managerReputation: entry.reputation,
      preferredDivision: entry.preferredDivision || division,
      titlePoints: entry.titlePoints,
    });
    return Math.max(0, Math.round(perRound * STAFF_ROUNDS_PER_MONTH));
  };

  const managerRankingRowHtml = (entry, position, { pinned = false } = {}) => {
    const userClub = getUserClub();
    const careerProfile = getCareerProfile();
    const isUser = entry.club === userClub || entry.name === careerProfile.managerName;
    const nameCell = pinned
      ? `<span class="national-ranking-club-cell"><i class="crest national-ranking-row-crest" aria-hidden="true">${getUserClubInitials()}</i><span>${entry.name}</span></span>`
      : `<span>${entry.name}</span>`;
    const salary = managerMonthlySalary(entry);
    const salaryLabel = formatBudget(salary);
    const scoreHint = `Base ${entry.base.toFixed(1)} + Temporada ${entry.seasonPoints.toFixed(1)} + Títulos ${entry.titlePoints.toFixed(1)} · Salário ${salaryLabel}/mês`;
    return `<div class="national-ranking-row manager-ranking-row${pinned ? ' national-ranking-user-row user-ranking' : isUser ? ' user-ranking' : ''}${entry.status === 'free' ? ' manager-free' : ''}" data-manager="${entry.id}" ${entry.club ? `data-club="${entry.club}"` : ''} role="button" tabindex="0" aria-label="${entry.name} · ${scoreHint} · Total ${entry.total.toFixed(1)}"><span>${position}</span>${nameCell}<span class="manager-ranking-club">${entry.clubLabel}</span><span>${entry.division}</span><span class="national-ranking-col-hidden" aria-hidden="true">${entry.base.toFixed(1)}</span><span class="manager-ranking-season">${entry.seasonPoints.toFixed(1)}</span><span class="manager-ranking-salary" title="Salário mensal estimado">${salaryLabel}</span><span class="national-ranking-total" title="${scoreHint}">${entry.total.toFixed(1)}</span><span class="manager-ranking-actions"><button type="button" class="manager-trophy-room-btn" data-manager-trophies="${entry.id}" aria-label="Abrir Sala de Troféus de ${escapeHtml(entry.name)}">🏆 <span>SALA DE TROFÉUS</span></button></span></div>`;
  };

  const ensureTrophyRoom = () => {
    let modal = $('#managerTrophyRoomModal');
    if (modal) return modal;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="managerTrophyRoomModal" class="manager-trophy-modal" hidden>
        <button type="button" class="manager-trophy-backdrop" data-close-manager-trophies aria-label="Fechar"></button>
        <section class="manager-trophy-panel" role="dialog" aria-modal="true" aria-labelledby="managerTrophyRoomTitle">
          <h2 id="managerTrophyRoomTitle" class="manager-trophy-sr-title">Sala de Troféus</h2>
          <button type="button" class="manager-trophy-close" data-close-manager-trophies aria-label="Fechar">×</button>
          <div id="managerTrophyRoomBody" class="manager-trophy-body"></div>
        </section>
      </div>`);
    return $('#managerTrophyRoomModal');
  };

  const renderManagerTrophyRoom = managerId => {
    const manager = getManagerRanking().byId(managerId);
    if (!manager) return;
    openTrophyManagerId = manager.id;
    const modal = ensureTrophyRoom();
    $('#managerTrophyRoomTitle').textContent = `Sala de Troféus de ${manager.name}`;
    const seasons = manager.careerHistory?.seasons || [];
    const totalTitles = seasons.reduce((sum, season) => sum + (season.titles?.length || 0), 0);
    const games = seasons.reduce((sum, item) => sum + item.games, 0);
    const wins = seasons.reduce((sum, item) => sum + item.wins, 0);
    const draws = seasons.reduce((sum, item) => sum + item.draws, 0);
    const losses = seasons.reduce((sum, item) => sum + item.losses, 0);
    const ranking = getManagerRanking().currentRanking(deps.getManagerRankingHelpers());
    const rankingPosition = ranking.findIndex(entry => entry.id === manager.id) + 1;
    const rankingEntry = ranking.find(entry => entry.id === manager.id);
    const clubLabel = rankingEntry?.clubLabel || manager.club || 'LIVRE';
    const clubIdentity = manager.club
      ? `<div class="manager-card-club-crest">${teamCrestHtml(manager.club, { className: 'manager-card-team-crest' })}</div><small>${escapeHtml(clubLabel)}</small>`
      : '<strong class="manager-card-free-label">LIVRE</strong><small>SEM CLUBE</small>';
    const trophyRows = seasons.flatMap(season => (season.titles || []).map(title => ({ ...title, season: season.season })));
    $('#managerTrophyRoomBody').innerHTML = `
      <div class="manager-card-scene" style="${managerCardLayoutStyle()}">
        <div class="manager-card-flipper" data-manager-card tabindex="0">
          <article class="manager-card-face manager-card-front" aria-label="Card de ${escapeHtml(manager.name)}">
            <img class="manager-card-art" src="${managerCardArtUrl(manager)}" alt="Ilustração de ${escapeHtml(manager.name)}">
            <div class="manager-card-front-glow" aria-hidden="true"></div>
            <div class="manager-card-front-info">
              <div class="manager-card-name-block"><small>TÉCNICO</small><strong>${escapeHtml(manager.name)}</strong><span>${escapeHtml(manager.style || 'Treinador profissional')}</span></div>
              <div class="manager-card-club-block">${clubIdentity}</div>
            </div>
            <button type="button" class="manager-card-flip-button manager-card-front-button" data-flip-manager-card aria-label="Ver estatísticas de ${escapeHtml(manager.name)}"><span>VER SALA DE TROFÉUS</span><b aria-hidden="true">↻</b></button>
          </article>
          <article class="manager-card-face manager-card-back" aria-label="Estatísticas de ${escapeHtml(manager.name)}">
            <header class="manager-card-back-header">
              <div><small>SALA DE TROFÉUS</small><h3>${escapeHtml(manager.name)}</h3><p>${escapeHtml(clubLabel)}</p></div>
              <div class="manager-card-back-rank"><small>RANKING</small><strong>#${rankingPosition || '—'}</strong></div>
            </header>
            <div class="manager-career-summary">
              <span><strong>${totalTitles}</strong>TÍTULOS</span><span><strong>${games}</strong>JOGOS</span><span><strong>${seasons.length}</strong>TEMPORADAS</span>
            </div>
            <div class="manager-career-record">
              <span><strong>${wins}</strong>VITÓRIAS</span><span><strong>${draws}</strong>EMPATES</span><span><strong>${losses}</strong>DERROTAS</span><span><strong>${games ? Math.round((wins / games) * 100) : 0}%</strong>APROVEIT.</span>
            </div>
            <section class="manager-card-trophy-list" aria-label="Histórico de títulos">
              <h4><span>CONQUISTAS</span><small>${trophyRows.length ? `${trophyRows.length} registrada(s)` : 'histórico anual'}</small></h4>
              ${trophyRows.length ? trophyRows.map(title => `<article><span class="manager-card-trophy-icon" aria-hidden="true">🏆</span><div><strong>${escapeHtml(title.competition)}</strong><small>${escapeHtml(title.club || '')} · ${escapeHtml(title.season)}</small></div></article>`).join('') : '<div class="manager-card-empty"><b aria-hidden="true">🏆</b><span>Nenhum título consolidado</span><small>O histórico é atualizado ao fim de cada temporada.</small></div>'}
            </section>
            <footer class="manager-card-back-footer"><span>BR FOOTBALL</span><small>${rankingEntry ? `${rankingEntry.total.toFixed(1)} PONTOS` : 'CARREIRA'}</small></footer>
            <button type="button" class="manager-card-flip-button manager-card-back-button" data-flip-manager-card aria-label="Voltar para a frente do card"><b aria-hidden="true">↺</b><span>VER CARD</span></button>
          </article>
        </div>
      </div>`;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    modal.querySelector('.manager-trophy-close')?.focus();
  };

  const closeManagerTrophyRoom = () => {
    const modal = $('#managerTrophyRoomModal');
    if (modal) modal.hidden = true;
    openTrophyManagerId = null;
    document.body.classList.remove('modal-open');
  };

  const renderManagerRanking = () => {
    const userClub = getUserClub();
    const careerProfile = getCareerProfile();
    const managerRanking = getManagerRanking();
    const helpers = deps.getManagerRankingHelpers();
    const ranking = managerRanking.currentRanking(helpers);
    const userManager = managerRanking.byClub(userClub) || managerRanking.byName(careerProfile.managerName);
    const userIndex = userManager ? ranking.findIndex(entry => entry.id === userManager.id) : -1;
    const userSlot = $('#managerRankingUserRow');
    if (userSlot) {
      if (userIndex >= 0) {
        userSlot.innerHTML = managerRankingRowHtml(ranking[userIndex], userIndex + 1, { pinned: true });
        userSlot.hidden = false;
      } else {
        userSlot.innerHTML = '';
        userSlot.hidden = true;
      }
    }
    const table = $('#managerRankingTable');
    if (table) {
      table.innerHTML = ranking.map((entry, index) => managerRankingRowHtml(entry, index + 1, { pinned: false })).join('');
    }
  };

  const bindHandlers = () => {
    onClick('#nationalRankingClubSearchBtn', runNationalRankingClubSearch);
    on('#nationalRankingClubSearch', 'keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runNationalRankingClubSearch();
      }
    });
    on(document, 'click', event => {
      const button = event.target.closest?.('[data-manager-trophies]');
      if (button) {
        event.preventDefault();
        event.stopImmediatePropagation();
        renderManagerTrophyRoom(button.dataset.managerTrophies);
        return;
      }
      if (event.target.closest?.('[data-flip-manager-card]')) {
        event.preventDefault();
        event.target.closest('[data-manager-card]')?.classList.toggle('is-flipped');
        return;
      }
      if (event.target.closest?.('[data-close-manager-trophies]')) closeManagerTrophyRoom();
    });
    on(document, 'keydown', event => {
      if (event.key === 'Escape' && openTrophyManagerId) closeManagerTrophyRoom();
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches?.('[data-manager-card]')) {
        event.preventDefault();
        event.target.classList.toggle('is-flipped');
      }
    });
  };

  return {
    renderNationalRanking,
    renderManagerRanking,
    bindHandlers,
  };
}
