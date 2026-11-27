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

export function createChampionshipV2({ $, getUserClub, getClubForm }) {
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

  const formCell = club => {
    const form = typeof getClubForm === 'function' ? getClubForm(club) || [] : [];
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
    const rows = [...body.querySelectorAll('.league-row[data-club]')].filter(row => row.children.length === 8);
    if (!rows.length) return;
    rows.forEach(row => {
      if (row.dataset.v2) return;
      row.dataset.v2 = '1';
      const name = row.children[1];
      const club = row.dataset.club;
      if (name && !name.querySelector('.champ-v2-crest')) {
        name.insertAdjacentHTML('afterbegin', teamCrestHtml(club, { className: 'champ-v2-crest' }));
      }
      row.insertAdjacentHTML('beforeend', formCell(club));
    });
    const table = body.closest('.championship-page-table');
    table?.classList.add('champ-v2-table');
    if (head && head.children.length === 8) head.insertAdjacentHTML('beforeend', '<span>ÚLTIMOS</span>');

    // Resumo da sua posição, quando o seu time está nesta tabela.
    const userRow = rows.find(row => row.dataset.club === getUserClub());
    let summary = $('#champV2Summary');
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

  const run = () => {
    scheduled = false;
    observer?.disconnect();
    try {
      renderChips();
      enhanceTable();
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
