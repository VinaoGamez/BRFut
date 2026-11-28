import { competitionRulesHtml } from '../../engine/competition-rules.js';

const esc = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/** Regulamento v2: abas por tema, faixa de posições e onde está o seu clube. */
export function createCompetitionRulesModalFeature({ $, onClick }) {
  let current = null;
  let tab = 0;
  let getUserStanding = () => null;

  const render = () => {
    if (!current) return;
    const body = $('#competitionRulesBody');
    if (!body) return;
    const sections = current.sections || [];
    const tabs = sections.length > 1
      ? `<nav class="rl2-tabs" role="tablist">${sections.map((section, index) => `<button type="button" role="tab" data-rl2-tab="${index}" class="${index === tab ? 'is-active' : ''}" aria-selected="${index === tab}">${esc(section.heading).toUpperCase()}</button>`).join('')}</nav>`
      : '';
    const active = sections[tab] || sections[0];
    const items = active
      ? `<ol class="rl2-items">${active.items.map(item => `<li>${esc(item)}</li>`).join('')}</ol>`
      : '';
    let zones = '';
    if (current.zones?.length && current.size) {
      const toneAt = pos => current.zones.find(zone => pos >= zone.from && pos <= zone.to)?.tone || '';
      const standing = getUserStanding?.(current.competitionId);
      zones = `<div class="rl2-sec">O QUE CADA POSIÇÃO VALE</div>
        <div class="rl2-strip" style="--rl2-n:${current.size}">${Array.from({ length: current.size }, (_, i) => `<span class="${toneAt(i + 1) ? `is-${toneAt(i + 1)}` : ''}${standing?.position === i + 1 ? ' is-user' : ''}">${i + 1}</span>`).join('')}</div>
        <div class="rl2-legend">${current.zones.map(zone => `<span><i class="is-${zone.tone}"></i>${esc(zone.label)}</span>`).join('')}</div>
        ${standing?.position ? `<div class="rl2-user"><b>SEU CLUBE</b><span>${esc(standing.club)} está em <strong>${standing.position}º</strong>${(() => {
          const zone = current.zones.find(item => standing.position >= item.from && standing.position <= item.to);
          return zone ? ` — hoje em: ${esc(zone.label.toLowerCase())}.` : ' — fora das faixas de acesso, título e queda.';
        })()}</span></div>` : ''}`;
    }
    body.innerHTML = `${tabs}${items}${zones}`;
  };

  const open = (competitionId, seasonYear) => {
    current = { ...competitionRulesHtml(competitionId, seasonYear), competitionId };
    tab = 0;
    const kicker = $('#competitionRulesKicker');
    const rulesTitle = $('#competitionRulesTitle');
    if (kicker) kicker.textContent = `REGULAMENTO · ${current.kicker}`;
    if (rulesTitle) rulesTitle.textContent = current.title.replace(/^Regulamento (da |do |— )?/, 'Como funciona ').replace('Como funciona Série', 'Como funciona a Série').replace('Como funciona Copa', 'Como funciona a Copa');
    render();
    $('#competitionRulesModal')?.classList.remove('hidden');
  };

  const close = () => $('#competitionRulesModal')?.classList.add('hidden');

  const bindHandlers = ({ getPageCompetition, getCareerSeason, getUserStanding: standing }) => {
    if (typeof standing === 'function') getUserStanding = standing;
    onClick('#championshipPageRulesBtn', () => open(getPageCompetition(), getCareerSeason()));
    onClick('#closeCompetitionRules', close);
    $('#competitionRulesModal')?.addEventListener('click', event => {
      if (event.target === event.currentTarget) { close(); return; }
      const tabBtn = event.target.closest('[data-rl2-tab]');
      if (tabBtn) { tab = Number(tabBtn.dataset.rl2Tab) || 0; render(); }
    });
  };

  return { open, close, bindHandlers };
}
