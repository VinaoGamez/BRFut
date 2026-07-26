import { FUTURE_COMPETITION_MOLD } from '../../engine/season-calendar-mold.js';

/** trophyKey alinha com COMPETITION_TROPHY_ASSETS em competition-trophies.js */
export function buildPageCompetitionOptions({ FEATURES, savedNewGame }) {
  return [
    { id: 'A', label: 'Brasileirão Série A', trophyKey: 'nacional' },
    { id: 'B', label: 'Brasileirão Série B', trophyKey: 'nacional' },
    { id: 'C', label: 'Brasileirão Série C', trophyKey: 'nacional' },
    { id: 'D', label: 'Brasileirão Série D', trophyKey: 'nacional' },
    { id: 'CUP', label: 'Copa do Brasil', trophyKey: 'copa-nacional' },
    ...(FUTURE_COMPETITION_MOLD.recopa_national.enabled
      ? [{ id: 'RECOPA', label: 'Recopa Nacional', trophyKey: 'recopa-nacional' }]
      : []),
    ...(FEATURES.stateLeague && savedNewGame
      ? [{ id: 'ESTADUAIS', label: 'Estaduais', trophyKey: 'estaduais' }]
      : []),
    ...(FUTURE_COMPETITION_MOLD.libertadores.enabled
      ? [{ id: 'LIBERTADORES', label: 'Copa Libertadores', trophyKey: 'libertadores' }]
      : []),
    ...(FUTURE_COMPETITION_MOLD.sudamericana.enabled
      ? [{ id: 'SUDAMERICANA', label: 'Copa Sul-Americana', trophyKey: 'sul-americana' }]
      : []),
  ];
}

export function isStateChampionshipPage(competition) {
  return String(competition || '').startsWith('EST:');
}

export function championshipPickerActiveId(pageCompetition) {
  return pageCompetition === 'ESTADUAIS' || isStateChampionshipPage(pageCompetition)
    ? 'ESTADUAIS'
    : pageCompetition;
}

export function renderEstaduaisHub({ stateLeagueEngine, userClub, stateFlagMarkup }) {
  const states = stateLeagueEngine.getHubStates(userClub);
  return `<div class="championship-estaduais-hub">${states.map(state => {
    const disabled = state.available ? '' : 'disabled aria-disabled="true"';
    const classes = ['championship-estadual-btn', state.isUser ? 'is-user' : '', state.available ? '' : 'is-unavailable'].filter(Boolean).join(' ');
    const tierHint = state.tierCount > 1 ? `<small>${state.tierCount} divisões</small>` : '';
    return `<button type="button" class="${classes}" data-estadual-uf="${state.code}" ${disabled} aria-label="Campeonato ${state.name}${state.tierCount > 1 ? ` · ${state.tierCount} divisões` : ''}">
        ${stateFlagMarkup(state.code, { className: 'championship-estadual-flag' })}
        <span class="championship-estadual-name">${state.name}</span>
        ${tierHint}
      </button>`;
  }).join('')}</div>`;
}
