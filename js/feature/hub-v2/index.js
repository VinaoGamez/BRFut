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
  warn: { bg: '#3a2a0a', fg: '#ffc94f' },
  info: { bg: '#0f2a38', fg: '#7fd6f2' },
  ok: { bg: '#1b2f12', fg: '#bbeb27' },
  danger: { bg: '#3a1212', fg: '#ff7b7b' },
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
      return `<button type="button" class="hub-attention-item" data-hub-action="${index}"><i style="--tone-bg:${tone.bg};--tone-fg:${tone.fg}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[item.icon] || ICONS.mail}"/></svg></i><span><strong>${esc(item.title)}</strong><small>${esc(item.meta)}</small></span><b aria-hidden="true">›</b></button>`;
    }).join('');
  };

  const renderTiles = (tiles = []) => {
    const root = document.getElementById('hubTiles');
    if (!root) return;
    root.innerHTML = tiles.map(tile => `<button type="button" class="card hub-tile" data-hub-tile="${esc(tile.id)}"><label>${esc(tile.label)}</label><strong style="color:${tile.color || '#edf8f5'}">${esc(tile.value)}</strong><small>${esc(tile.note)}</small></button>`).join('');
    root.querySelectorAll('[data-hub-tile]').forEach(button => {
      const tile = tiles.find(item => item.id === button.dataset.hubTile);
      if (tile?.run) button.addEventListener('click', tile.run);
    });
  };

  const bind = () => {
    document.getElementById('hubAttentionList')?.addEventListener('click', event => {
      const button = event.target.closest('[data-hub-action]');
      if (!button) return;
      actions[Number(button.dataset.hubAction)]?.();
    });
  };

  return { bind, renderAttention, renderTiles };
}
