import { seasonGoalLiveProgress } from '../../engine/season-goals.js';
import { seasonGoalGauge } from '../season-summary/goal-gauge.js';

/** Card de meta da temporada no dashboard — só o gráfico de progresso. */
export function createSeasonGoalCardFeature({
  $,
  isWorldCupDashboardActive,
  getWorldCupDashboardCtx,
  ensureSeasonGoal,
  buildSeasonGoalLiveContext,
}) {
  const clearGauge = () => {
    const gaugeEl = $('#dashboardSeasonGoalGauge');
    if (!gaugeEl) return;
    gaugeEl.innerHTML = '';
    gaugeEl.setAttribute('aria-hidden', 'true');
  };

  return () => {
    const gaugeEl = $('#dashboardSeasonGoalGauge');
    if (!gaugeEl) return;

    if (isWorldCupDashboardActive()) {
      const ctx = getWorldCupDashboardCtx?.();
      if (!ctx?.progress) {
        clearGauge();
        return;
      }
      gaugeEl.innerHTML = seasonGoalGauge(ctx.progress, { dashboard: true, hideLegend: true });
      gaugeEl.removeAttribute('aria-hidden');
      return;
    }

    const goal = ensureSeasonGoal();
    if (!goal) {
      clearGauge();
      return;
    }

    try {
      const progress = seasonGoalLiveProgress(goal, buildSeasonGoalLiveContext());
      gaugeEl.innerHTML = seasonGoalGauge(progress, { dashboard: true, hideLegend: true });
      gaugeEl.removeAttribute('aria-hidden');
    } catch {
      clearGauge();
    }
  };
}
