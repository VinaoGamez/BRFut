import { teamCrestHtml } from '../../ui/team-crest.js';
import {
  resolveNationalRankingEntry,
  sortNationalRankingEntries,
} from '../../engine/national-ranking.js';

const STAFF_ROUNDS_PER_MONTH = 4;

const normalizeClubSearch = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

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
    return `<div class="national-ranking-row manager-ranking-row${pinned ? ' national-ranking-user-row user-ranking' : isUser ? ' user-ranking' : ''}${entry.status === 'free' ? ' manager-free' : ''}" data-manager="${entry.id}" ${entry.club ? `data-club="${entry.club}"` : ''} role="button" tabindex="0" aria-label="${entry.name} · ${scoreHint} · Total ${entry.total.toFixed(1)}"><span>${position}</span>${nameCell}<span class="manager-ranking-club">${entry.clubLabel}</span><span>${entry.division}</span><span class="national-ranking-col-hidden" aria-hidden="true">${entry.base.toFixed(1)}</span><span class="manager-ranking-season">${entry.seasonPoints.toFixed(1)}</span><span class="manager-ranking-salary" title="Salário mensal estimado">${salaryLabel}</span><span class="national-ranking-total" title="${scoreHint}">${entry.total.toFixed(1)}</span></div>`;
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
  };

  return {
    renderNationalRanking,
    renderManagerRanking,
    bindHandlers,
  };
}
