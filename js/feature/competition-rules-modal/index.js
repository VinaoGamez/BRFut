import { competitionRulesHtml } from '../../engine/competition-rules.js';

/** Modal de regulamento da competição (aba Campeonatos). */
export function createCompetitionRulesModalFeature({ $, onClick }) {
  const open = (competitionId, seasonYear) => {
    const rules = competitionRulesHtml(competitionId, seasonYear);
    const kicker = $('#competitionRulesKicker');
    const rulesTitle = $('#competitionRulesTitle');
    const rulesBody = $('#competitionRulesBody');
    if (kicker) kicker.textContent = rules.kicker;
    if (rulesTitle) rulesTitle.textContent = rules.title;
    if (rulesBody) rulesBody.innerHTML = rules.bodyHtml;
    $('#competitionRulesModal')?.classList.remove('hidden');
  };

  const close = () => $('#competitionRulesModal')?.classList.add('hidden');

  const bindHandlers = ({ getPageCompetition, getCareerSeason }) => {
    onClick('#championshipPageRulesBtn', () => open(getPageCompetition(), getCareerSeason()));
    onClick('#closeCompetitionRules', close);
    $('#competitionRulesModal')?.addEventListener('click', event => {
      if (event.target === event.currentTarget) close();
    });
  };

  return { open, close, bindHandlers };
}
