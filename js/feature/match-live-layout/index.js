/**
 * Partida ao vivo v2 (Revisão 3): nada de caixa rolável dentro do pop-up.
 *
 * - Estado do cartão em `data-mlv`: "live" (jogo rolando), "vest" (intervalo,
 *   pausa técnica ou pré-jogo — o vestiário ocupa o corpo) ou "" (pós-jogo).
 * - Lances: no modo normal o CSS mostra só os 5 mais novos (o mais novo em
 *   cima); "Narração completa" troca a coluna por páginas de 10 lances.
 * - Vestiário com abas Substituições · Tática · Formação.
 * - Celular: abas Lances · Estatísticas no lugar de empilhar tudo.
 * Camada só de apresentação: não muda regras nem o motor da partida.
 */
const PAGE = 10;

export function installMatchLiveLayout({ renderStats } = {}) {
  if (typeof document === 'undefined') return null;
  const modal = document.getElementById('matchModal');
  const card = modal?.querySelector('.modal-card');
  const timeline = document.getElementById('timeline');
  if (!card || !timeline) return null;
  let page = 0;
  let full = false;

  const isHidden = el => !el || el.classList.contains('hidden') || el.hidden;

  const events = () => [...timeline.children].filter(el => el.tagName === 'P' || el.classList.contains('tl-event'));

  const ensureBar = () => {
    let bar = document.getElementById('mlvTimelineBar');
    if (!bar) {
      timeline.insertAdjacentHTML('afterend', '<div id="mlvTimelineBar" class="mlv-tl-bar"><button type="button" data-mlv-prev aria-label="Lances mais novos">‹</button><span data-mlv-page></span><button type="button" data-mlv-next aria-label="Lances anteriores">›</button><button type="button" class="mlv-tl-toggle" data-mlv-full>Narração completa ›</button></div>');
      bar = document.getElementById('mlvTimelineBar');
      bar.addEventListener('click', event => {
        if (event.target.closest('[data-mlv-full]')) {
          full = !full;
          page = 0;
          applyPager();
          return;
        }
        const pages = Math.max(1, Math.ceil(events().length / PAGE));
        if (event.target.closest('[data-mlv-prev]')) page = Math.max(0, page - 1);
        if (event.target.closest('[data-mlv-next]')) page = Math.min(pages - 1, page + 1);
        applyPager();
      });
    }
    return bar;
  };

  const applyPager = () => {
    const bar = ensureBar();
    const list = events();
    card.classList.toggle('mlv-full', full);
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / PAGE));
    if (page > pages - 1) page = pages - 1;
    // Página 0 = os lances mais novos (fim da lista).
    const end = total - page * PAGE;
    const start = Math.max(0, end - PAGE);
    list.forEach((el, index) => el.classList.toggle('mlv-off', full && (index < start || index >= end)));
    const label = bar.querySelector('[data-mlv-page]');
    if (label) label.textContent = full ? `${total ? total - end + 1 : 0}–${total - start} de ${total}` : `${Math.min(5, total)} mais recentes · ${total} lances`;
    bar.querySelector('[data-mlv-prev]').disabled = !full || page <= 0;
    bar.querySelector('[data-mlv-next]').disabled = !full || page >= pages - 1;
    bar.querySelector('[data-mlv-full]').textContent = full ? '‹ Voltar ao jogo' : 'Narração completa ›';
  };

  const ensureVestTabs = () => {
    const controls = card.querySelector('#pausePanel .pause-controls');
    if (!controls || controls.querySelector('.mlv-vest-tabs')) return;
    controls.insertAdjacentHTML('afterbegin', '<nav class="mlv-vest-tabs" role="tablist"><button type="button" data-vest-tab="subs" class="is-active">Substituições</button><button type="button" data-vest-tab="tactic">Tática</button><button type="button" data-vest-tab="formation">Formação</button></nav>');
    card.dataset.vestTab = 'subs';
    controls.querySelector('.mlv-vest-tabs').addEventListener('click', event => {
      const btn = event.target.closest('[data-vest-tab]');
      if (!btn) return;
      card.dataset.vestTab = btn.dataset.vestTab;
      controls.querySelectorAll('[data-vest-tab]').forEach(b => b.classList.toggle('is-active', b === btn));
      // O ajuste tático passa a ser uma aba: sempre visível dentro dela.
      document.getElementById('pauseTacticAdjust')?.classList.remove('hidden');
    });
  };

  const ensureMobileTabs = () => {
    if (document.getElementById('mlvTabs')) return;
    const anchor = document.getElementById('liveVolume') || timeline;
    anchor.insertAdjacentHTML('afterend', '<nav id="mlvTabs" class="mlv-tabs" role="tablist"><button type="button" data-mlv-tab="lances" class="is-active">Lances</button><button type="button" data-mlv-tab="stats">Estatísticas</button></nav>');
    card.dataset.mlvTab = 'lances';
    document.getElementById('mlvTabs').addEventListener('click', event => {
      const btn = event.target.closest('[data-mlv-tab]');
      if (!btn) return;
      card.dataset.mlvTab = btn.dataset.mlvTab;
      document.querySelectorAll('#mlvTabs [data-mlv-tab]').forEach(b => b.classList.toggle('is-active', b === btn));
      if (btn.dataset.mlvTab === 'stats') {
        document.getElementById('stats')?.classList.remove('hidden');
        try { renderStats?.(); } catch { /* estatísticas opcionais */ }
      }
    });
  };

  const sync = () => {
    const post = card.classList.contains('has-post-match');
    const vest = !isHidden(document.getElementById('pausePanel'));
    const state = post ? '' : vest ? 'vest' : 'live';
    if (card.dataset.mlv !== state) {
      card.dataset.mlv = state;
      if (state === 'live') {
        // Estatísticas fazem parte da tela (coluna da direita no PC).
        const stats = document.getElementById('stats');
        if (stats && !stats.innerHTML.trim()) { try { renderStats?.(); } catch { /* sem jogo */ } }
      }
      if (state !== 'live') { full = false; page = 0; }
    }
    ensureVestTabs();
    ensureMobileTabs();
    applyPager();
  };

  const observer = new MutationObserver(() => {
    observer.disconnect();
    try { sync(); } finally { observe(); }
  });
  const observe = () => {
    observer.observe(card, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
  };
  sync();
  observe();
  return { sync };
}
