/**
 * Elenco v2: tabela Simples (5 colunas: jogador, posição, idade, OVR,
 * cansaço) ou Detalhada (todos os atributos). Lembra a escolha.
 */
const KEY = 'brfut-roster-density';

export function bindRosterDensity() {
  const card = document.querySelector('#squad .card.roster');
  const actions = card?.querySelector('.roster-filter-actions');
  if (!card || !actions || actions.querySelector('.roster-density')) return;
  let density = 'simple';
  try { density = localStorage.getItem(KEY) === 'detailed' ? 'detailed' : 'simple'; } catch { /* sem storage */ }
  const group = document.createElement('div');
  group.className = 'roster-density';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Densidade da tabela');
  group.innerHTML = '<button type="button" data-density="simple">Simples</button><button type="button" data-density="detailed">Detalhado</button>';
  actions.prepend(group);
  const apply = value => {
    density = value;
    card.classList.toggle('roster-simple', value === 'simple');
    group.querySelectorAll('[data-density]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.density === value));
    });
    try { localStorage.setItem(KEY, value); } catch { /* sem storage */ }
  };
  group.addEventListener('click', event => {
    const button = event.target.closest('[data-density]');
    if (button) apply(button.dataset.density);
  });
  apply(density);
}
