/**
 * Elenco v2: tabela Simples (5 colunas: jogador, posição, idade, OVR,
 * cansaço), Detalhada (todos os atributos) ou Desempenho (estatísticas do
 * elenco no lugar da tabela, sem rolar a página). Lembra a escolha.
 */
const KEY = 'brfut-roster-density';
const MODES = ['simple', 'detailed', 'performance'];

export function bindRosterDensity() {
  const card = document.querySelector('#squad .card.roster');
  const actions = card?.querySelector('.roster-filter-actions');
  if (!card || !actions || actions.querySelector('.roster-density')) return;
  let mode = 'simple';
  let lastDensity = 'simple';
  try {
    const saved = localStorage.getItem(KEY);
    if (MODES.includes(saved)) mode = saved;
  } catch { /* sem storage */ }

  // O painel de desempenho passa a morar dentro do cartão do elenco.
  const performance = document.getElementById('squadPerformance');
  const filters = card.querySelector('.roster-filters');
  if (performance && filters) filters.after(performance);

  const group = document.createElement('div');
  group.className = 'roster-density';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Visualização do elenco');
  group.innerHTML = '<button type="button" data-density="simple">Simples</button>'
    + '<button type="button" data-density="detailed">Detalhado</button>'
    + '<button type="button" data-density="performance">Desempenho</button>';
  actions.prepend(group);

  const apply = value => {
    mode = MODES.includes(value) ? value : 'simple';
    if (mode !== 'performance') lastDensity = mode;
    card.classList.toggle('roster-simple', lastDensity === 'simple');
    card.classList.toggle('roster-performance-mode', mode === 'performance');
    group.querySelectorAll('[data-density]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.density === mode));
    });
    try { localStorage.setItem(KEY, mode); } catch { /* sem storage */ }
  };
  group.addEventListener('click', event => {
    const button = event.target.closest('[data-density]');
    if (button) apply(button.dataset.density);
  });
  apply(mode);
}
