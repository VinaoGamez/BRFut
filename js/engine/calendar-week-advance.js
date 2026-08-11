/**
 * Avanço semanal do calendário de carreira e salto até o próximo jogo do usuário.
 */
export function createCalendarWeekAdvance(deps) {
  const advanceCalendarWeek = () => {
    if (deps.isSponsorChoicePending()) {
      deps.openSponsorPickerIfPending();
      return null;
    }
    if (typeof deps.isLiveMatchInProgress === 'function' && deps.isLiveMatchInProgress()) {
      return { stopped: 'live_match' };
    }
    if (!deps.getSavedNewGame() || deps.isUserSeasonIdle()) return null;
    if (deps.seasonFullyComplete()) return null;
    deps.ensureCalendarMatchConsistency();
    if (deps.isOnPendingMatchDay()) {
      deps.pushMatchDayBrief(deps.userMatchOnDate(deps.getCareerCalendarDate()) || deps.nextPendingUserEntry()?.game);
      deps.refreshSeasonPresentation();
      return { stopped: 'match' };
    }
    const transferPhase = deps.getTransferWindowPhase() || {};
    if (transferPhase.active) {
      void deps.ensureTransfersUi();
      const result = deps.advanceTransferCalendar();
      deps.renderCalendar();
      if (!result?.ok) {
        deps.refreshSeasonPresentation();
        return { stopped: result?.reason || 'failed', days: 0, transfer: true, result };
      }
      return {
        stopped: result.stoppedMatch ? 'match' : null,
        game: result.stoppedMatch || null,
        days: result.days || 0,
        transfer: true,
        mode: result.mode,
        report: result.report || null,
      };
    }
    const seasonEnd = deps.seasonEndDate();
    let simulatedDays = 0;
    deps.beginCalendarBatch();
    try {
      for (let step = 0; step < 7; step += 1) {
        const nextDay = new Date(deps.getCareerCalendarDate());
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(12, 0, 0, 0);
        if (nextDay > seasonEnd) break;
        const pendingMatch = deps.userMatchOnDate(nextDay);
        if (pendingMatch) {
          deps.advanceCareerCalendarTo(nextDay);
          deps.processContractsForDate(nextDay);
          deps.advanceCupThroughDate(nextDay);
          deps.advanceStateLeagueThroughDate(nextDay);
          deps.advanceWorldCupThroughDateLocal(nextDay);
          deps.setSelectedCalendarDate(nextDay);
          simulatedDays += 1;
          deps.persistSeason(true);
          deps.pushMatchDayBrief(pendingMatch);
          deps.refreshSeasonPresentation();
          return { stopped: 'match', game: pendingMatch, days: simulatedDays };
        }
        deps.applyCalendarTrainingDay(deps.trainingTypeForDate(nextDay));
        deps.advanceCareerCalendarTo(nextDay);
        deps.processContractsForDate(nextDay);
        deps.advanceCupThroughDate(nextDay);
        deps.advanceStateLeagueThroughDate(nextDay);
        deps.advanceWorldCupThroughDateLocal(nextDay);
        simulatedDays += 1;
      }
    } finally {
      deps.endCalendarBatch();
      deps.flushCupScheduleRefresh();
      if (simulatedDays > 0) {
        deps.flushWeeklyTrainingReport();
        try {
          deps.syncCareerRosters();
        } catch {
          /* ignore */
        }
        try {
          deps.renderRoster();
        } catch {
          /* ignore */
        }
      }
    }
    deps.setSelectedCalendarDate(deps.getCareerCalendarDate());
    if (simulatedDays > 0) {
      deps.maybeSendNationalTeamOffers();
      deps.persistSeason(true);
      deps.refreshSeasonPresentation();
      if (deps.getTransferWindowPhase()?.active) deps.showTransferWindowOpenAlert?.();
    } else {
      deps.renderCalendar();
    }
    return { stopped: null, days: simulatedDays };
  };

  const advanceToMatchDay = () => {
    if (deps.isSponsorChoicePending()) {
      deps.openSponsorPickerIfPending();
      return null;
    }
    if (!deps.getSavedNewGame() || deps.isUserSeasonIdle()) return null;
    if (deps.seasonFullyComplete()) return null;
    deps.ensureCalendarMatchConsistency();
    deps.rebuildCalendarGames();
    if (deps.isOnPendingMatchDay()) {
      deps.pushMatchDayBrief(deps.userMatchOnDate(deps.getCareerCalendarDate()) || deps.nextPendingUserEntry()?.game);
      deps.refreshSeasonPresentation();
      return { stopped: 'already' };
    }
    const nextEntry = deps.nextPendingUserEntry();
    if (!nextEntry) return null;
    const targetDate = new Date(nextEntry.details.date);
    targetDate.setHours(12, 0, 0, 0);
    const seasonEnd = deps.seasonEndDate();
    if (targetDate > seasonEnd) {
      return { stopped: 'failed', days: 0 };
    }
    let simulatedDays = 0;
    let transferWindowTouched = !!deps.getTransferWindowPhase()?.active;
    deps.beginCalendarBatch();
    try {
      let safety = 400;
      while (
        !deps.sameCalendarDay(deps.getCareerCalendarDate(), targetDate) &&
        !deps.isOnPendingMatchDay() &&
        simulatedDays < safety
      ) {
        const nextDay = new Date(deps.getCareerCalendarDate());
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(12, 0, 0, 0);
        if (nextDay > seasonEnd) break;
        deps.applyCalendarTrainingDay(deps.trainingTypeForDate(nextDay));
        deps.advanceCareerCalendarTo(nextDay);
        deps.processContractsForDate(nextDay);
        deps.advanceCupThroughDate(nextDay);
        deps.advanceStateLeagueThroughDate(nextDay);
        deps.advanceWorldCupThroughDateLocal(nextDay);
        simulatedDays += 1;
        if (deps.getTransferWindowPhase()?.active) transferWindowTouched = true;
      }
    } finally {
      deps.endCalendarBatch();
      if (simulatedDays > 0) {
        deps.flushWeeklyTrainingReport();
        if (transferWindowTouched) {
          deps.setSuppressTransferOfferPopup(true);
          try {
            const phase = deps.getTransferWindowPhase() || {};
            const weeks = Math.max(1, Math.min(8, Math.ceil(simulatedDays / 7)));
            for (let w = 0; w < weeks; w += 1) {
              if (!deps.isTransferMarketOpen()) break;
              deps.processAiMarketTickCore({
                quietDigest: true,
                tickKind: phase.mode === 'day' ? 'deadline' : 'week',
                skipUserOffers: w < weeks - 1,
                skipSeed: w > 0,
                silent: true,
              });
            }
          } catch {
            /* tick */
          } finally {
            deps.setSuppressTransferOfferPopup(false);
          }
        }
        try {
          deps.syncCareerRosters();
        } catch {
          /* ignore */
        }
        try {
          deps.renderRoster();
        } catch {
          /* ignore */
        }
      }
    }
    deps.setSelectedCalendarDate(deps.getCareerCalendarDate());
    const reachedTarget =
      deps.sameCalendarDay(deps.getCareerCalendarDate(), targetDate) && !deps.isFixtureCompleted(nextEntry.game);
    const deferredOffers = [...new Set(deps.getPendingTransferOfferPopupIds())].filter(Boolean);
    if (reachedTarget || deps.isOnPendingMatchDay()) {
      deps.pushMatchDayBrief(nextEntry.game);
      deps.persistSeason(true);
      deps.refreshSeasonPresentation();
      deps.renderTransfersUi?.();
      if (deps.getTransferWindowPhase()?.active) deps.showTransferWindowOpenAlert?.();
      if (deferredOffers.length) {
        deps.presentTransferOffersAfterAdvance({ ok: true, days: simulatedDays, newOfferIds: deferredOffers });
      }
      return { stopped: 'match', days: simulatedDays, game: nextEntry.game };
    }
    if (simulatedDays > 0) {
      deps.persistSeason(true);
      deps.refreshSeasonPresentation();
      deps.renderTransfersUi?.();
      if (deps.getTransferWindowPhase()?.active) deps.showTransferWindowOpenAlert?.();
      if (deferredOffers.length) {
        deps.presentTransferOffersAfterAdvance({ ok: true, days: simulatedDays, newOfferIds: deferredOffers });
      }
    }
    return { stopped: 'failed', days: simulatedDays };
  };

  return { advanceCalendarWeek, advanceToMatchDay };
}
