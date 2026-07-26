const escapeHeaderText = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/"/g, '&quot;');

const shortHeaderClub = name => {
  const text = String(name || '—');
  return text.length > 20 ? `${text.slice(0, 18)}…` : text;
};

const headerMatchLine = (game, details, headerMatchContext, { userTag = null, withTime = false } = {}) => {
  const ctx = headerMatchContext(game);
  const tag = userTag || ctx.tag;
  const when = [ctx.stage, details.display, withTime ? details.time : null].filter(Boolean).join(' · ');
  return `<i>${escapeHeaderText(tag)}</i><b>${escapeHeaderText(shortHeaderClub(game.home))} × ${escapeHeaderText(shortHeaderClub(game.away))}</b><em>${escapeHeaderText(when)}</em>`;
};

/** Faixa rolante do header: próximo jogo, agenda e mercado. */
export function createHeaderGuideRenderer({
  $,
  FEATURES,
  getCareerCalendarDate,
  getNextPendingUserEntry,
  getFutureMatches,
  isUserFixture,
  isFixtureCompleted,
  fixtureDetails,
  getTransfersEngine,
  formatBudget,
  headerMatchContext,
}) {
  return () => {
    const track = $('#headerNewsTrack');
    const dateEl = $('#headerDateLabel');
    const careerCalendarDate = getCareerCalendarDate?.();
    if (dateEl && careerCalendarDate) {
      dateEl.textContent = careerCalendarDate
        .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
        .replace(/\./g, '')
        .toUpperCase();
    }
    if (!track) return;

    const items = [];
    const pushItem = (kind, html, user = false) => items.push({ kind, html, user });

    const next = typeof getNextPendingUserEntry === 'function' ? getNextPendingUserEntry() : null;
    if (next?.game) {
      const details = next.details || fixtureDetails(next.game);
      const ctx = headerMatchContext(next.game);
      const userTag = ctx.tag.startsWith('RODADA') || ctx.tag === 'MATA-MATA'
        ? `SEU JOGO · ${ctx.tag}`
        : 'SEU JOGO';
      pushItem('jogo', headerMatchLine(next.game, details, headerMatchContext, { userTag, withTime: true }), true);
    }

    (getFutureMatches?.() || [])
      .filter(game => game && !isUserFixture(game) && !isFixtureCompleted(game))
      .slice(0, 2)
      .forEach(game => {
        const details = fixtureDetails(game);
        pushItem('jogo', headerMatchLine(game, details, headerMatchContext));
      });

    const transfersEngine = getTransfersEngine?.();
    if (FEATURES.transfers && transfersEngine) {
      const phase = transfersEngine.getWindowPhase?.() || {};
      const status = transfersEngine.marketStatus?.() || {};
      if (phase.active) {
        const deadline = phase.isDeadlineDay ? ' · Deadline Day' : phase.isDeadlineWeek ? ' · Semana final' : '';
        pushItem(
          'mercado',
          `<i>MERCADO</i><b>${escapeHeaderText(phase.label || 'Janela aberta')}</b><em>${phase.daysLeft != null ? `${phase.daysLeft}d restantes` : ''}${deadline}</em>`,
        );
      } else {
        pushItem(
          'mercado',
          `<i>MERCADO</i><b>Janela fechada</b><em>${escapeHeaderText(status.nextOpenLabel ? `Abre ${status.nextOpenLabel}` : 'Aguarde a próxima janela')}</em>`,
        );
      }
      const sales = (transfersEngine.snapshotSeasonDeals?.() || [])
        .filter(deal => Number(deal.fee) > 0)
        .sort((a, b) => Number(b.fee) - Number(a.fee))
        .slice(0, 3);
      sales.forEach(deal => {
        pushItem(
          'venda',
          `<i>VENDA</i><b>${escapeHeaderText(deal.playerName || 'Jogador')}</b><em>${escapeHeaderText(shortHeaderClub(deal.from))} → ${escapeHeaderText(shortHeaderClub(deal.to))}</em><strong class="header-news-fee">${escapeHeaderText(formatBudget(deal.fee))}</strong>`,
        );
      });
      if (!sales.length) {
        pushItem('venda', `<i>VENDA</i><b>Sem grandes negócios ainda</b><em>${phase.active ? 'Janela em andamento' : 'Fora da janela'}</em>`);
      }
    } else {
      pushItem('mercado', `<i>MERCADO</i><b>Informações do mercado</b><em>Em breve no informativo</em>`);
    }

    if (!items.length) {
      pushItem('mercado', `<i>INFO</i><b>Informativo da temporada</b><em>Próximos jogos e mercado</em>`);
    }

    const seqHtml = items
      .map(item => `<article class="header-news-item kind-${item.kind}${item.user ? ' is-user' : ''}">${item.html}</article>`)
      .join('');
    track.innerHTML = `<div class="header-news-seq">${seqHtml}</div><div class="header-news-seq" aria-hidden="true">${seqHtml}</div>`;
    requestAnimationFrame(() => {
      const seq = track.querySelector('.header-news-seq');
      const width = seq?.getBoundingClientRect?.().width || seq?.scrollWidth || track.scrollWidth / 2 || 480;
      const seconds = Math.max(28, Math.round(width / 20));
      track.style.animationDuration = `${seconds}s`;
    });
  };
}
