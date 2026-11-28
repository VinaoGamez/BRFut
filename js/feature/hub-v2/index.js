/**
 * Central v2: "Precisa da sua atenção" (até 3 pendências, cada uma leva à
 * tela que resolve) e três tiles (classificação, moral, diretoria).
 */

const ICONS = Object.freeze({
  shirt: 'M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z',
  offer: 'M3 7h18v12H3zM3 11h18M8 15h3',
  pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  medical: 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z',
  money: 'M3 6h18v12H3zM12 9v6M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4',
  board: 'M4 21V7l8-4 8 4v14M9 21v-5h6v5M8 10h2M14 10h2',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  check: 'M5 12l5 5 9-10',
});

const TONES = Object.freeze({
  warn: { bg: '#ff8a2b22', fg: '#ff8a2b' },
  info: { bg: '#11bbed22', fg: '#11bbed' },
  ok: { bg: '#3ddc8422', fg: '#3ddc84' },
  danger: { bg: '#ff4d5e22', fg: '#ff4d5e' },
});

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function createHubV2() {
  let actions = [];

  const renderAttention = (items = []) => {
    const list = document.getElementById('hubAttentionList');
    const count = document.getElementById('hubAttentionCount');
    if (!list) return;
    const shown = items.slice(0, 3);
    actions = shown.map(item => item.run);
    if (count) count.textContent = shown.length ? `${shown.length} ${shown.length === 1 ? 'item' : 'itens'}` : '';
    if (!shown.length) {
      const tone = TONES.ok;
      list.innerHTML = `<div class="hub-attention-item is-clear"><i style="--tone-bg:${tone.bg};--tone-fg:${tone.fg}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS.check}"/></svg></i><span><strong>Tudo em dia</strong><small>Nenhuma pendência antes do próximo compromisso.</small></span></div>`;
      return;
    }
    list.innerHTML = shown.map((item, index) => {
      const tone = TONES[item.tone] || TONES.info;
      return `<button type="button" class="hub-attention-item" data-hub-action="${index}" style="--tone-fg:${tone.fg}"><i style="--tone-bg:${tone.bg};--tone-fg:${tone.fg}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[item.icon] || ICONS.mail}"/></svg></i><span><strong>${esc(item.title)}</strong><small>${esc(item.meta)}</small></span><b aria-hidden="true">›</b></button>`;
    }).join('');
  };

  const renderTiles = (tiles = []) => {
    const root = document.getElementById('hubTiles');
    if (!root) return;
    root.innerHTML = tiles.map(tile => {
      const color = tile.color || '#eaf2ff';
      const pct = Math.max(0, Math.min(100, Number(tile.pct) || 0));
      return `<button type="button" class="card hub-tile" data-hub-tile="${esc(tile.id)}" style="--tile-color:${esc(color)};--tile-pct:${pct}%"><label>${esc(tile.label)}</label><strong style="color:${esc(color)}">${esc(tile.value)}</strong><small>${esc(tile.note)}</small><i class="hub-tile-bar" aria-hidden="true"></i></button>`;
    }).join('');
    root.querySelectorAll('[data-hub-tile]').forEach(button => {
      const tile = tiles.find(item => item.id === button.dataset.hubTile);
      if (tile?.run) button.addEventListener('click', tile.run);
    });
  };

  /**
   * Central aprovada (canvas v2): título "Central do clube", coluna da
   * esquerda (próximo jogo, indicadores, próximos jogos) e da direita
   * (pendências e mini tabela). Move os blocos que já existem; idempotente.
   */
  const arrange = () => {
    const view = document.getElementById('dashboard');
    const grid = view?.querySelector(':scope > .grid');
    if (!view || !grid || grid.dataset.hubArranged) return;
    grid.dataset.hubArranged = '1';
    if (!view.querySelector(':scope > .hub-title')) {
      const title = document.createElement('div');
      title.className = 'title hub-title';
      title.innerHTML = '<p id="hubKicker">TEMPORADA</p><h1>Central do clube</h1>';
      grid.before(title);
    }
    const match = grid.querySelector(':scope > .card.match');
    const attention = document.getElementById('hubAttention');
    const tiles = document.getElementById('hubTiles');
    const standings = view.querySelector('.dashboard-tables .card.standings');
    const upcoming = match?.querySelector('.club-upcoming');
    const left = document.createElement('div');
    left.className = 'hub-col hub-col--left';
    const right = document.createElement('div');
    right.className = 'hub-col hub-col--right';
    if (upcoming) {
      upcoming.classList.add('card', 'hub-upcoming');
      upcoming.querySelector(':scope > label')?.replaceChildren(document.createTextNode('PRÓXIMOS JOGOS'));
    }
    [match, tiles, upcoming].forEach(node => node && left.append(node));
    [attention, standings].forEach(node => node && right.append(node));
    standings?.classList.add('hub-standings');
    grid.prepend(left, right);
  };

  /** Horário grande no centro do cartão do próximo jogo. */
  const setKickoff = ({ date = '', time = '', odds = null } = {}) => {
    const block = document.querySelector('#dashboard .match .match-vs-block');
    if (!block) return;
    let box = block.querySelector('.hub-kickoff');
    if (!box) {
      box = document.createElement('div');
      box.className = 'hub-kickoff';
      box.innerHTML = '<small class="hub-kickoff-date"></small><strong class="hub-kickoff-time"></strong><i class="hub-kickoff-stripe" aria-hidden="true"></i><div class="hub-odds" hidden><div class="hub-odds-bar" aria-hidden="true"><i class="is-win"></i><i class="is-draw"></i><i class="is-loss"></i></div><div class="hub-odds-labels"><span class="is-win"></span><span class="is-draw"></span><span class="is-loss"></span></div></div>';
      block.querySelector('.match-vs-label')?.after(box);
    }
    box.querySelector('.hub-kickoff-date').textContent = date;
    box.querySelector('.hub-kickoff-time').textContent = time;
    block.classList.toggle('has-kickoff', !!time);
    const oddsBox = box.querySelector('.hub-odds');
    if (oddsBox) {
      oddsBox.hidden = !odds;
      if (odds) {
        const parts = [['win', 'V', odds.win], ['draw', 'E', odds.draw], ['loss', 'D', odds.loss]];
        parts.forEach(([key, letter, value]) => {
          const bar = oddsBox.querySelector(`.hub-odds-bar .is-${key}`);
          const label = oddsBox.querySelector(`.hub-odds-labels .is-${key}`);
          if (bar) bar.style.width = `${value}%`;
          if (label) label.textContent = `${letter} ${value}%`;
        });
        oddsBox.title = 'Chance estimada pela força dos titulares e pelo mando de campo';
      }
    }
  };

  /**
   * Chance estimada de vitória/empate/derrota: média de OVR dos titulares de
   * cada lado + mando de campo. Só orientação visual; não afeta o motor.
   */
  const estimateOdds = ({ mine = 0, theirs = 0, home = true } = {}) => {
    if (!mine || !theirs) return null;
    const edge = (mine - theirs) + (home ? 2.5 : -2.5);
    const draw = Math.max(0.16, Math.min(0.3, 0.3 - Math.abs(edge) * 0.008));
    const winShare = Math.max(0.08, Math.min(0.92, 1 / (1 + Math.exp(-edge / 8))));
    const win = Math.round((1 - draw) * winShare * 100);
    const drawPct = Math.round(draw * 100);
    return { win, draw: drawPct, loss: Math.max(0, 100 - win - drawPct) };
  };

  const bind = () => {
    document.getElementById('hubAttentionList')?.addEventListener('click', event => {
      const button = event.target.closest('[data-hub-action]');
      if (!button) return;
      actions[Number(button.dataset.hubAction)]?.();
    });
  };

  return { bind, arrange, setKickoff, estimateOdds, renderAttention, renderTiles };
}
