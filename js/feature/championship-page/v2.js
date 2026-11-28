import { teamCrestHtml } from '../../ui/team-crest.js';

/**
 * Competições v2: chips por competição (na cor da tag), escudos e forma
 * recente na tabela e resumo da sua posição. Camada visual sobre a página
 * de campeonato existente: observa a tabela e enriquece as linhas, sem
 * mudar regras, filtros ou navegação.
 */
const CHIP_META = {
  A: ['Série A', 'var(--av-cyan)'],
  B: ['Série B', 'var(--av-cyan)'],
  C: ['Série C', 'var(--av-cyan)'],
  D: ['Série D', 'var(--av-cyan)'],
  CUP: ['Copa do Brasil', 'var(--av-orange)'],
  RECOPA: ['Recopa', 'var(--av-gold)'],
  ESTADUAIS: ['Estaduais', 'var(--av-green)'],
  LIBERTADORES: ['Libertadores', 'var(--av-gold)'],
  SUDAMERICANA: ['Sul-Americana', 'var(--av-red)'],
  ELIMINATORIAS: ['Eliminatórias', 'var(--av-gold)'],
  CMU: ['Copa do Mundo', 'var(--av-gold)'],
  MUNDIAL: ['Mundial', 'var(--av-gold)'],
};

const esc = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export function createChampionshipV2({ $, getUserClub, getUserNationalTeam, getNationalForm, getClubForm, getSideRound, getScorers, getUserNationalRank, openRanking }) {
  const sideRounds = new Map();
  let scheduled = false;
  let observer = null;

  const renderChips = () => {
    const card = $('.championship-page-table');
    const menu = $('#championshipPagePickerMenu');
    if (!card || !menu) return;
    let bar = $('#champV2Chips');
    if (!bar) {
      card.insertAdjacentHTML('afterbegin', '<nav id="champV2Chips" class="champ-v2-chips" aria-label="Competições"></nav>');
      bar = $('#champV2Chips');
    }
    const options = [...menu.querySelectorAll('[data-page-competition]')];
    const html = options
      .map(option => {
        const id = option.dataset.pageCompetition;
        const [label, color] = CHIP_META[id] || [option.textContent.trim(), 'var(--av-cyan)'];
        const active = option.classList.contains('is-active');
        return `<button type="button" data-champ-v2="${esc(id)}" class="${active ? 'is-active' : ''}" aria-pressed="${active}" style="--c:${color}"><i></i>${esc(label)}</button>`;
      })
      .join('');
    if (bar.innerHTML !== html) bar.innerHTML = html;
  };

  const formCell = (club, national = false) => {
    const source = national ? getNationalForm : getClubForm;
    const form = typeof source === 'function' ? source(club) || [] : [];
    const last = form.slice(-5);
    const pads = Array.from({ length: 5 - last.length }, () => '<i data-r="-">·</i>').join('');
    const marks = last
      .map(result => {
        const r = result === 'W' ? 'V' : result === 'L' ? 'D' : 'E';
        return `<i data-r="${r}">${r}</i>`;
      })
      .join('');
    return `<span class="champ-v2-form" aria-label="Últimos jogos">${pads}${marks}</span>`;
  };

  const enhanceTable = () => {
    const body = $('#leagueTable');
    const head = $('#championshipPageHead');
    if (!body) return;
    const rows = [...body.querySelectorAll('.league-row[data-club], .league-row[data-national-team]')].filter(row => row.children.length === 8);
    const summaryNow = $('#champV2Summary');
    if (!rows.length) {
      summaryNow?.remove();
      return;
    }
    const teamOf = row => row.dataset.club || row.children[1]?.textContent?.trim() || '';
    const national = !rows[0].dataset.club;
    rows.forEach(row => {
      if (row.dataset.v2) return;
      row.dataset.v2 = '1';
      const name = row.children[1];
      const club = teamOf(row);
      if (name && !name.querySelector('.champ-v2-crest')) {
        name.insertAdjacentHTML('afterbegin', teamCrestHtml(club, { className: 'champ-v2-crest' }));
      }
      row.insertAdjacentHTML('beforeend', formCell(club, national));
    });
    const table = body.closest('.championship-page-table');
    table?.classList.add('champ-v2-table');
    if (head && head.children.length === 8) head.insertAdjacentHTML('beforeend', '<span>ÚLTIMOS</span>');

    // Resumo da sua posição, quando o seu time (ou a sua seleção) está nesta tabela.
    const me = national ? (typeof getUserNationalTeam === 'function' ? getUserNationalTeam() : '') : getUserClub();
    const userRow = me ? rows.find(row => teamOf(row) === me) : null;
    let summary = summaryNow;
    if (!userRow) {
      summary?.remove();
      return;
    }
    const pos = userRow.children[0]?.textContent?.trim();
    const pts = userRow.children[7]?.textContent?.trim();
    const played = Number(userRow.children[2]?.textContent) || 0;
    const leader = rows[0];
    const leaderPts = Number(leader?.children[7]?.textContent) || 0;
    const gap = leaderPts - (Number(pts) || 0);
    const html = `<div class="champ-v2-stat"><small>SUA POSIÇÃO</small><strong>${esc(pos)}º · ${esc(pts)} PTS</strong></div><div class="champ-v2-stat"><small>JOGOS</small><strong>${played}</strong></div><div class="champ-v2-stat"><small>${leader === userRow ? 'VANTAGEM' : 'PARA O LÍDER'}</small><strong>${leader === userRow ? (rows[1] ? `+${leaderPts - (Number(rows[1].children[7]?.textContent) || 0)} PTS` : '—') : `${gap} ${gap === 1 ? 'PONTO' : 'PONTOS'}`}</strong></div>`;
    if (!summary) {
      (head || body).insertAdjacentHTML('beforebegin', '<div id="champV2Summary" class="champ-v2-summary"></div>');
      summary = $('#champV2Summary');
    }
    if (summary.innerHTML !== html) summary.innerHTML = html;
  };

  // ---------- Coluna lateral: rodada, artilharia e ranking ----------
  const fixtureRow = game => {
    const done = game.scheduled !== true && (game.completed === true || (game.homeGoals != null && game.awayGoals != null));
    const user = getUserClub();
    const side = (club, align) => `<span class="champ-v2-fx-team ${align}${club === user ? ' is-user' : ''}">${align === 'right' ? `<b>${esc(club)}</b>${teamCrestHtml(club, { className: 'champ-v2-fx-crest' })}` : `${teamCrestHtml(club, { className: 'champ-v2-fx-crest' })}<b>${esc(club)}</b>`}</span>`;
    return `<div class="champ-v2-fx" data-club="${esc(game.home === user ? game.away : game.home)}">${side(game.home, 'right')}<strong class="${done ? 'is-done' : ''}">${done ? `${game.homeGoals}–${game.awayGoals}` : '×'}</strong>${side(game.away, 'left')}</div>`;
  };

  const renderSide = () => {
    const card = $('.championship-page-table');
    if (!card) return;
    let side = $('#champV2Side');
    if (!side) {
      card.insertAdjacentHTML('afterend', '<aside id="champV2Side" class="champ-v2-side" aria-label="Rodada e destaques"></aside>');
      side = $('#champV2Side');
      side.addEventListener('click', event => {
        const step = event.target.closest('[data-champ-v2-round]');
        if (step) {
          const view = typeof getSideRound === 'function' ? getSideRound(null) : null;
          if (!view) return;
          const now = sideRounds.get(view.key) || view.current;
          const next = Math.max(1, Math.min(view.limit, now + Number(step.dataset.champV2Round)));
          sideRounds.set(view.key, next);
          renderSide();
          return;
        }
        if (event.target.closest('[data-champ-v2-ranking]')) openRanking?.();
      });
    }
    const parts = [];
    const base = typeof getSideRound === 'function' ? getSideRound(null) : null;
    if (base) {
      const view = getSideRound(sideRounds.get(base.key) || base.current) || base;
      const games = (view.games || []).filter(game => game?.home && game?.away);
      const user = getUserClub();
      games.sort((a, b) => Number(b.home === user || b.away === user) - Number(a.home === user || a.away === user));
      parts.push(`<section class="champ-v2-card"><header class="champ-v2-round-nav"><button type="button" data-champ-v2-round="-1" aria-label="Rodada anterior" ${view.round <= 1 ? 'disabled' : ''}>‹</button><strong>RODADA ${view.round}${view.round === view.current ? ' · ATUAL' : ''}</strong><button type="button" data-champ-v2-round="1" aria-label="Próxima rodada" ${view.round >= view.limit ? 'disabled' : ''}>›</button></header>${games.map(fixtureRow).join('') || '<p class="champ-v2-empty">Sem jogos nesta rodada.</p>'}</section>`);
    }
    // Artilharia entre os clubes da tabela em tela.
    const clubs = new Set([...document.querySelectorAll('#leagueTable .league-row[data-club]')].map(row => row.dataset.club));
    const scorers = (typeof getScorers === 'function' ? getScorers() || [] : [])
      .filter(player => clubs.has(player.club) && Number(player.goals) > 0)
      .slice(0, 5);
    if (clubs.size) {
      parts.push(`<section class="champ-v2-card"><span class="champ-v2-card-title is-gold">ARTILHARIA</span>${scorers.length ? scorers.map((player, index) => `<div class="champ-v2-scorer"><strong>${index + 1}</strong>${teamCrestHtml(player.club, { className: 'champ-v2-fx-crest' })}<span>${esc(player.name)}</span><b>${Number(player.goals)}</b></div>`).join('') : '<p class="champ-v2-empty">Ainda sem gols marcados.</p>'}<small class="champ-v2-note">Gols na temporada dos clubes desta tabela.</small></section>`);
    }
    const rank = typeof getUserNationalRank === 'function' ? getUserNationalRank() : null;
    if (rank) {
      const fmt = value => Number(value || 0).toFixed(1).replace('.', ',');
      const line = rank.position === 1 ? `líder · ${fmt(rank.lead)} à frente` : `a ${fmt(rank.leaderGap)} do líder`;
      parts.push(`<section class="champ-v2-card champ-v2-rank"><div><span class="champ-v2-card-title">RANKING NACIONAL</span><p>Você é o <strong>${rank.position}º</strong> · ${fmt(rank.total)} pts · ${line}</p></div><button type="button" data-champ-v2-ranking>VER →</button></section>`);
    }
    const html = parts.join('');
    if (side.innerHTML !== html) side.innerHTML = html;
    side.hidden = !html;
  };

  const run = () => {
    scheduled = false;
    observer?.disconnect();
    try {
      renderChips();
      enhanceTable();
      renderSide();
    } finally {
      const card = $('.championship-page-table');
      if (card && observer) observer.observe(card, { childList: true, subtree: true });
    }
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  };

  const init = () => {
    const card = $('.championship-page-table');
    if (!card || observer) return;
    observer = new MutationObserver(schedule);
    observer.observe(card, { childList: true, subtree: true });
    card.addEventListener('click', event => {
      const chip = event.target.closest('[data-champ-v2]');
      if (!chip) return;
      const target = $(`#championshipPagePickerMenu [data-page-competition="${chip.dataset.champV2}"]`);
      target?.click();
    });
    schedule();
  };

  return { init, refresh: schedule };
}
