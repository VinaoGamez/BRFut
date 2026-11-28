import { teamCrestHtml } from '../../ui/team-crest.js';
import { clubCrestUrl } from '../../engine/club-crests.js';
import {
  resolveNationalRankingEntry,
  sortNationalRankingEntries,
} from '../../engine/national-ranking.js';
import { fetchStructuredManagerHistory } from '../../core/career-history-sync.js';
import { fetchManagerMatchStats } from '../../core/player-stats-sync.js';

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
  return `./manager-cards/manager-${String(artIndex).padStart(2, '0')}.webp`;
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
    // Ranking v2: escudo em todas as linhas.
    const clubMarkup = `<span class="national-ranking-club-cell">${teamCrestHtml(entry.club, { className: 'national-ranking-row-crest' })}<span class="club-link">${entry.club}</span></span>`;
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
      // Ranking v2: cartão "Você" com a distância para o líder e para quem está à frente.
      const mine = ranking[userIndex];
      const leader = ranking[0];
      const ahead = userIndex > 0 ? ranking[userIndex - 1] : null;
      const behind = ranking[userIndex + 1] || null;
      const fmt = value => value.toFixed(1).replace('.', ',');
      const gapLeader = leader && leader !== mine ? `<div><small>PARA O LÍDER</small><strong>${fmt(leader.total - mine.total)} pts</strong></div>` : behind ? `<div><small>VANTAGEM</small><strong>+${fmt(mine.total - behind.total)} pts</strong></div>` : '';
      const gapAhead = ahead && ahead !== leader ? `<div><small>PARA O ${userIndex}º</small><strong>${fmt(ahead.total - mine.total)} pts</strong></div>` : '';
      userSlot.innerHTML = `<div class="ranking-v2-you" data-club="${mine.club}" role="button" tabindex="0"><span class="ranking-v2-you-pos"><small>VOCÊ</small><strong>${userIndex + 1}º</strong></span>${teamCrestHtml(mine.club, { className: 'ranking-v2-you-crest' })}<span class="ranking-v2-you-name"><b>${mine.club}</b><small>Série ${mine.division} · ${fmt(mine.total)} pts</small></span><div class="ranking-v2-you-stats">${gapLeader}${gapAhead}<div><small>TÍTULOS</small><strong>${fmt(mine.titlePoints)}</strong></div></div></div>`;
      userSlot.hidden = false;
    } else {
      userSlot.innerHTML = '';
      userSlot.hidden = true;
    }
    const filtered = query
      ? ranking.map((entry, index) => ({ entry, position: index + 1 })).filter(({ entry }) => normalizeClubSearch(entry.club).includes(query))
      : ranking.map((entry, index) => ({ entry, position: index + 1 }));
    const table = $('#nationalRankingTable');
    // Ranking v2: pódio dos 3 primeiros (fora da busca).
    let podium = $('#nationalRankingPodium');
    if (!podium) {
      $('#ranking .national-ranking-table')?.insertAdjacentHTML('beforebegin', '<div id="nationalRankingPodium" class="ranking-v2-podium"></div>');
      podium = $('#nationalRankingPodium');
    }
    if (podium) {
      podium.hidden = !!query || ranking.length < 3;
      podium.innerHTML = query ? '' : ranking.slice(0, 3).map((entry, index) => `<div class="ranking-v2-podium-card${entry.club === userClub ? ' is-user' : ''}" data-place="${index + 1}" data-club="${entry.club}" role="button" tabindex="0"><span class="ranking-v2-place">${index + 1}º</span>${teamCrestHtml(entry.club, { className: 'ranking-v2-podium-crest' })}<b>${entry.club}</b><small>Série ${entry.division}</small><strong>${entry.total.toFixed(1).replace('.', ',')} <em>PTS</em></strong></div>`).join('');
    }
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

  const fmtPts = value => (Number(value) || 0).toFixed(1).replace('.', ',');

  /** Resumo da carreira do técnico (temporadas guardadas no histórico). */
  const managerCareer = manager => {
    const seasons = manager?.careerHistory?.seasons || [];
    const sum = key => seasons.reduce((total, item) => total + (Number(item[key]) || 0), 0);
    const clubsSet = new Set();
    seasons.forEach(item => (item.clubs || []).forEach(club => club && clubsSet.add(String(club))));
    if (manager?.club) clubsSet.add(manager.club);
    const trophies = seasons.flatMap(season => (season.titles || []).map(title => ({ ...title, season: season.season })))
      .sort((x, y) => Number(y.season) - Number(x.season));
    const games = sum('games');
    const wins = sum('wins');
    return {
      seasons: seasons.length,
      games,
      wins,
      draws: sum('draws'),
      losses: sum('losses'),
      clubs: clubsSet.size,
      trophies,
      pct: games ? Math.round((wins / games) * 100) : null,
    };
  };

  const isUserManager = entry => {
    const careerProfile = getCareerProfile();
    return entry.club === getUserClub() || entry.name === careerProfile.managerName;
  };

  const managerCrest = (club, cls) => (club
    ? `<span class="mrv2-crest ${cls || ''}" data-club="${escapeHtml(club)}" role="button" tabindex="0" title="Ver ${escapeHtml(club)}">${teamCrestHtml(club, { className: 'mrv2-crest-img' })}</span>`
    : `<span class="mrv2-crest is-free ${cls || ''}" aria-hidden="true">—</span>`);

  const managerRankingRowHtml = (entry, position) => {
    const manager = getManagerRanking().byId(entry.id) || entry;
    const career = managerCareer(manager);
    const salaryLabel = formatBudget(managerMonthlySalary(entry));
    const scoreHint = `Base ${entry.base.toFixed(1)} + Temporada ${entry.seasonPoints.toFixed(1)} + Títulos ${entry.titlePoints.toFixed(1)}`;
    const titles = career.trophies.length;
    return `<div class="mrv2-row${isUserManager(entry) ? ' is-user' : ''}${entry.status === 'free' ? ' is-free' : ''}" data-manager="${escapeHtml(entry.id)}" role="button" tabindex="0" aria-label="Ficha de ${escapeHtml(entry.name)} · ${position}º · ${fmtPts(entry.total)} pontos">`
      + `<span class="mrv2-pos">${position}</span>${managerCrest(entry.club)}`
      + `<span class="mrv2-name"><b>${escapeHtml(entry.name)}</b><small>${escapeHtml(entry.clubLabel || 'Livre')}</small></span>`
      + `<span class="mrv2-col-club">${escapeHtml(entry.clubLabel || 'Livre')}</span>`
      + `<span>${escapeHtml(entry.division || '—')}</span>`
      + `<span class="mrv2-col-season">${fmtPts(entry.seasonPoints)}</span>`
      + `<span class="mrv2-col-salary">${salaryLabel}</span>`
      + `<span class="mrv2-col-titles${titles ? ' has-titles' : ''}">${titles ? `<i aria-hidden="true"></i>${titles}` : '—'}</span>`
      + `<strong class="mrv2-total" title="${scoreHint}">${fmtPts(entry.total)}</strong></div>`;
  };

  const MANAGER_MODAL_ID = 'managerCardModal';
  const ensureManagerModal = () => {
    let modal = document.getElementById(MANAGER_MODAL_ID);
    if (modal) return modal;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="${MANAGER_MODAL_ID}" class="modal hidden manager-card-modal-v2" role="dialog" aria-modal="true" aria-labelledby="managerCardV2Name">
        <div class="mv2-shell pcv2 mcv2" data-tone="gold">
          <header class="mv2-head pcv2-head">
            <img class="pcv2-crest" id="managerCardV2Crest" alt="" hidden>
            <div class="pcv2-head-text">
              <span class="mv2-kicker" id="managerCardV2Kicker">TÉCNICO</span>
              <h2 class="mv2-title pcv2-name" id="managerCardV2Name">Técnico</h2>
            </div>
            <button type="button" class="mv2-close" data-mcv2-close aria-label="Fechar">×</button>
          </header>
          <div class="pcv2-grid">
            <div class="pcv2-photo is-manager" id="managerCardV2Photo" aria-hidden="true"></div>
            <div class="pcv2-info" id="managerCardV2Info"></div>
          </div>
          <footer class="mv2-foot pcv2-foot">
            <button type="button" class="mv2-btn is-ghost" id="managerCardV2Club">VER CLUBE</button>
            <button type="button" class="mv2-btn is-primary" data-mcv2-close>FECHAR</button>
          </footer>
        </div>
      </div>`);
    return document.getElementById(MANAGER_MODAL_ID);
  };

  const managerInfoMarkup = (manager, { position, entry }) => {
    const career = managerCareer(manager);
    const tile = (label, value, cls = '') => `<div class="mv2-tile"><small>${label}</small><strong class="${cls}">${value}</strong></div>`;
    const chips = [
      manager.style ? `<span class="pcv2-chip is-pos" data-line="def">${escapeHtml(manager.style)}</span>` : '',
      career.seasons ? `<span class="pcv2-chip">${career.seasons} ${career.seasons === 1 ? 'temporada' : 'temporadas'}</span>` : '<span class="pcv2-chip">Primeira temporada</span>',
      entry?.status === 'free' || !manager.club ? '<span class="pcv2-chip is-bad">Sem clube</span>' : '',
      entry && isUserManager(entry) ? '<span class="pcv2-chip is-you">Você</span>' : '',
    ].join('');
    const t = career.wins + career.draws + career.losses;
    const record = t
      ? `<div class="mcv2-record"><div class="mcv2-record-bar"><b class="is-w" style="width:${(career.wins / t) * 100}%"></b><b class="is-d" style="width:${(career.draws / t) * 100}%"></b><b class="is-l" style="width:${(career.losses / t) * 100}%"></b></div>
         <div class="mcv2-record-legend"><span><strong class="is-w">${career.wins}</strong> vitórias</span><span><strong>${career.draws}</strong> empates</span><span><strong class="is-l">${career.losses}</strong> derrotas</span></div></div>`
      : '';
    const trophies = career.trophies.length
      ? `<div class="mcv2-trophies">${career.trophies.map(title => `<div class="mcv2-trophy"><i aria-hidden="true"></i><span><b>${escapeHtml(title.competition || 'Título')}</b><small>${escapeHtml(title.club || '')}</small></span><strong>${escapeHtml(title.season || '')}</strong></div>`).join('')}</div>`
      : '<p class="pcv2-empty">Nenhum título ainda. O histórico é atualizado ao fim de cada temporada.</p>';
    const salary = entry ? formatBudget(managerMonthlySalary(entry)) : '—';
    return `
      <div class="pcv2-top">
        <div class="mcv2-rank"><small>RANKING</small><strong>${position ? `${position}º` : '—'}</strong></div>
        <div class="pcv2-id">
          <div class="pcv2-chips">${chips}</div>
          <p class="mcv2-score">Pontuação <b>${entry ? fmtPts(entry.total) : '—'}</b>${entry ? ` · temporada <b>${entry.seasonPoints >= 0 ? '+' : ''}${fmtPts(entry.seasonPoints)}</b>` : ''}</p>
        </div>
        <div class="pcv2-pot mcv2-titles"><small>TÍTULOS</small><strong>${career.trophies.length}</strong></div>
      </div>
      <section class="pcv2-sec">
        <h3 class="pcv2-h">CARREIRA</h3>
        <div class="mv2-tiles">
          ${tile('JOGOS', career.games)}
          ${tile('TEMPORADAS', career.seasons)}
          ${tile('CLUBES', career.clubs)}
          ${tile('APROVEIT.', career.pct == null ? '—' : `${career.pct}%`, 'is-lime')}
        </div>
        ${record}
      </section>
      <section class="pcv2-sec">
        <h3 class="pcv2-h">CONQUISTAS</h3>
        ${trophies}
      </section>
      <section class="pcv2-sec">
        <h3 class="pcv2-h">CONTRATO</h3>
        <div class="mv2-tiles">
          ${tile('CLUBE ATUAL', escapeHtml(entry?.clubLabel || manager.club || 'Livre'))}
          ${tile('DIVISÃO', escapeHtml(entry?.division || '—'))}
          ${tile('SALÁRIO / MÊS', salary, 'is-money')}
        </div>
      </section>`;
  };

  const renderManagerTrophyRoom = (managerId, { skipRemote = false } = {}) => {
    const manager = getManagerRanking().byId(managerId);
    if (!manager) return;
    openTrophyManagerId = manager.id;
    const modal = ensureManagerModal();
    const ranking = getManagerRanking().currentRanking(deps.getManagerRankingHelpers());
    const position = ranking.findIndex(item => item.id === manager.id) + 1;
    const entry = ranking.find(item => item.id === manager.id) || null;
    const club = manager.club || entry?.club || null;
    const division = entry?.division ? ` · SÉRIE ${String(entry.division).toUpperCase()}` : '';
    const kicker = document.getElementById('managerCardV2Kicker');
    if (kicker) kicker.textContent = club ? `TÉCNICO · ${String(entry?.clubLabel || club).toUpperCase()}${division}` : 'TÉCNICO · SEM CLUBE';
    const nameEl = document.getElementById('managerCardV2Name');
    if (nameEl) { nameEl.textContent = manager.name; nameEl.title = manager.name; }
    const crestEl = document.getElementById('managerCardV2Crest');
    if (crestEl) {
      const url = club ? clubCrestUrl(club) : null;
      crestEl.hidden = !url;
      if (url) crestEl.src = url; else crestEl.removeAttribute('src');
    }
    const photo = document.getElementById('managerCardV2Photo');
    if (photo) photo.innerHTML = `<span class="pcv2-photo-frame"><img src="${managerCardArtUrl(manager)}" alt="" decoding="async"></span>`;
    const info = document.getElementById('managerCardV2Info');
    if (info) info.innerHTML = managerInfoMarkup(manager, { position, entry });
    const clubBtn = document.getElementById('managerCardV2Club');
    if (clubBtn) {
      clubBtn.hidden = !club;
      if (club) clubBtn.dataset.club = club; else delete clubBtn.dataset.club;
    }
    modal.classList.remove('hidden');
    if (!skipRemote) {
      void Promise.all([
        fetchStructuredManagerHistory(manager.id),
        fetchManagerMatchStats(manager.id),
      ]).then(([remote, live]) => {
        if (openTrophyManagerId !== manager.id) return;
        const local = manager.careerHistory?.seasons || [];
        const normalized = (remote?.seasons || []).map(row => ({
          season: Number(row.season), clubs: row.clubs || [], games: Number(row.games) || 0,
          wins: Number(row.wins) || 0, draws: Number(row.draws) || 0, losses: Number(row.losses) || 0,
          teamAverage: row.team_average == null ? null : Number(row.team_average), titles: row.titles || [],
        }));
        const matchSeasons = new Map();
        (live?.competitions || []).forEach(row => {
          const year = Number(row.season);
          if (!year) return;
          const current = matchSeasons.get(year) || { season: year, clubs: [], games: 0, wins: 0, draws: 0, losses: 0 };
          if (row.club_id && !current.clubs.includes(row.club_id)) current.clubs.push(row.club_id);
          current.games += Number(row.games) || 0;
          current.wins += Number(row.wins) || 0;
          current.draws += Number(row.draws) || 0;
          current.losses += Number(row.losses) || 0;
          matchSeasons.set(year, current);
        });
        const bases = [...normalized, ...local]
          .filter((row, index, all) => all.findIndex(item => Number(item.season) === Number(row.season)) === index);
        matchSeasons.forEach((stats, year) => {
          const base = bases.find(row => Number(row.season) === year);
          const merged = { ...base, ...stats, titles: base?.titles || [], teamAverage: base?.teamAverage ?? null };
          const index = bases.findIndex(row => Number(row.season) === year);
          if (index >= 0) bases[index] = merged;
          else bases.push(merged);
        });
        if (!bases.length) return;
        manager.careerHistory = {
          version: 1,
          seasons: bases.sort((a, b) => Number(b.season) - Number(a.season)),
        };
        renderManagerTrophyRoom(manager.id, { skipRemote: true });
      }).catch(() => {});
    }
  };

  const closeManagerTrophyRoom = () => {
    document.getElementById(MANAGER_MODAL_ID)?.classList.add('hidden');
    openTrophyManagerId = null;
  };

  const userManagerEntry = () => {
    const managerRanking = getManagerRanking();
    const careerProfile = getCareerProfile();
    return managerRanking.byClub(getUserClub()) || managerRanking.byName(careerProfile.managerName) || null;
  };

  const openOwnManagerCard = () => {
    const mine = userManagerEntry();
    if (mine) renderManagerTrophyRoom(mine.id);
    else deps.openView?.('managers');
  };

  const renderManagerRanking = () => {
    const managerRanking = getManagerRanking();
    const ranking = managerRanking.currentRanking(deps.getManagerRankingHelpers());
    const mine = userManagerEntry();
    const userIndex = mine ? ranking.findIndex(entry => entry.id === mine.id) : -1;
    const podium = $('#managerRankingPodium');
    if (podium) {
      podium.innerHTML = ranking.slice(0, 3).map((entry, index) => {
        const career = managerCareer(managerRanking.byId(entry.id) || entry);
        return `<div class="mrv2-podium-card${isUserManager(entry) ? ' is-user' : ''}" data-place="${index + 1}" data-manager="${escapeHtml(entry.id)}" role="button" tabindex="0">`
          + `<span class="mrv2-place">${index + 1}º</span>${managerCrest(entry.club, 'is-lg')}`
          + `<span class="mrv2-name"><b>${escapeHtml(entry.name)}</b><small>${escapeHtml(entry.clubLabel || 'Livre')} · ${career.trophies.length} ${career.trophies.length === 1 ? 'título' : 'títulos'}</small></span>`
          + `<strong>${fmtPts(entry.total)}</strong></div>`;
      }).join('');
      podium.hidden = ranking.length < 3;
    }
    const table = $('#managerRankingTable');
    if (table) {
      table.innerHTML = ranking.slice(3).map((entry, index) => managerRankingRowHtml(entry, index + 4)).join('')
        || '<p class="pcv2-empty">Sem outros técnicos no ranking.</p>';
    }
    const userSlot = $('#managerRankingUserRow');
    if (userSlot) {
      if (userIndex >= 0) {
        const entry = ranking[userIndex];
        const career = managerCareer(managerRanking.byId(entry.id) || entry);
        const top10 = ranking[9];
        const ahead = userIndex > 0 ? ranking[userIndex - 1] : null;
        let goal = '';
        if (userIndex >= 10 && top10) goal = `Faltam <b>${fmtPts(top10.total - entry.total)} pts</b> para o top 10.`;
        else if (ahead) goal = `Faltam <b>${fmtPts(ahead.total - entry.total)} pts</b> para passar ${escapeHtml(ahead.name)} (${userIndex}º).`;
        else goal = 'Você lidera o ranking de técnicos.';
        userSlot.innerHTML = `
          <h3 class="mrv2-you-kicker">VOCÊ</h3>
          <div class="mrv2-you-id">${managerCrest(entry.club, 'is-lg')}<span class="mrv2-name"><b>${escapeHtml(entry.name)}</b><small>${escapeHtml(entry.clubLabel || 'Livre')}${entry.division ? ` · Série ${escapeHtml(entry.division)}` : ''}</small></span></div>
          <div class="mv2-tiles"><div class="mv2-tile"><small>RANKING</small><strong class="is-money">${userIndex + 1}º</strong></div><div class="mv2-tile"><small>PONTOS</small><strong class="is-cyan">${fmtPts(entry.total)}</strong></div></div>
          <div class="mv2-tiles"><div class="mv2-tile"><small>JOGOS</small><strong>${career.games}</strong></div><div class="mv2-tile"><small>TÍTULOS</small><strong>${career.trophies.length}</strong></div></div>
          <p class="mrv2-you-goal">${goal} Títulos e campanha acima da meta somam mais pontos.</p>
          <button type="button" class="mv2-btn is-primary mrv2-you-btn" data-manager="${escapeHtml(entry.id)}">VER MINHA FICHA</button>`;
        userSlot.hidden = false;
      } else {
        userSlot.innerHTML = '';
        userSlot.hidden = true;
      }
    }
    syncRankingSwitch('managers');
  };

  const syncRankingSwitch = view => {
    document.querySelectorAll('[data-ranking-switch]').forEach(button => {
      const active = button.dataset.rankingSwitch === view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    // Técnicos é uma sub-tela de Ranking: mantém a aba Ranking acesa.
    document.querySelector('#sectionTabs .nav[data-view="ranking"]')?.classList.toggle('is-subview-active', view === 'managers');
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
      const target = event.target;
      if (target.closest?.('[data-manager-self]')) {
        event.preventDefault();
        openOwnManagerCard();
        return;
      }
      const sw = target.closest?.('[data-ranking-switch]');
      if (sw) {
        event.preventDefault();
        deps.openView?.(sw.dataset.rankingSwitch);
        return;
      }
      const modal = document.getElementById(MANAGER_MODAL_ID);
      if (modal && !modal.classList.contains('hidden')) {
        if (target === modal || target.closest('[data-mcv2-close]')) { closeManagerTrophyRoom(); return; }
        if (target.closest('#managerCardV2Club')) { closeManagerTrophyRoom(); return; } // o handler global de [data-club] abre o clube
      }
      // Escudo abre o clube (handler global); o resto da linha abre a ficha.
      if (target.closest?.('[data-club]')) return;
      const row = target.closest?.('[data-manager]');
      if (row) {
        event.preventDefault();
        renderManagerTrophyRoom(row.dataset.manager);
      }
    });
    on(document, 'keydown', event => {
      if (event.key === 'Escape' && openTrophyManagerId) { closeManagerTrophyRoom(); return; }
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches?.('[data-manager]:not(button)')) {
        event.preventDefault();
        renderManagerTrophyRoom(event.target.dataset.manager);
      }
    });
  };

  const renderNationalRankingWithSwitch = () => {
    renderNationalRanking();
    syncRankingSwitch('ranking');
  };

  return {
    renderNationalRanking: renderNationalRankingWithSwitch,
    renderManagerRanking,
    openManagerCard: renderManagerTrophyRoom,
    openOwnManagerCard,
    bindHandlers,
  };
}
