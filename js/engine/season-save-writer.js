import { FEATURES, SAVE_KEYS, SERIE_D_GROUP_ROUNDS } from '../core/constants.js';
import {
  MEMORY_LIMITS,
  compactCompetitionHistories,
  compactCupFixture,
  compactRoundHistory,
  pruneClubMemory,
  pruneRankingTitles,
  slimAvailabilitySnapshot,
  slimFatigueSnapshot,
  slimLeaderboard,
  slimSerieDFixturesForSave,
} from '../core/save.js';
import { serializeBankLoan } from './bank-loan.js';
import { slimNationalFixturesForSave } from './competition-calendar.js';
import { serializeUserClubInvestments } from './economy.js';
import { NATIONAL_RANKING_FORMULA_VERSION } from './national-ranking.js';
import { isRecopaNationalEnabled, serializeRecopaNational } from './recopa-national.js';
import { persistSeasonPayload } from './season-save-quota.js';
import { maxStateLeagueRound } from '../core/save-sync.js';
import { serializeCompetitionWindows } from './season-scheduler.js';
import { serializeUserStadium } from './stadium-sectors.js';
import { serializeWorldCupCompetition } from './world-cup-competition.js';

function slimCareerMessages(messages = []) {
  return messages
    .slice(0, MEMORY_LIMITS.seasonMessages)
    .map(message => {
      const slim = { ...message };
      if (typeof slim.body === 'string' && slim.body.length > 600) {
        slim.body = `${slim.body.slice(0, 600)}…`;
      }
      return slim;
    });
}

function serializeManagerJobCrisis(activeCrisis) {
  if (!activeCrisis) return null;
  return {
    status: activeCrisis.status || null,
    reason: activeCrisis.reason || null,
    message: activeCrisis.message || null,
    board: activeCrisis.board,
    finances: activeCrisis.finances,
    cash: activeCrisis.cash,
    debt: activeCrisis.debt,
    boardCrisisStreak: Math.max(0, Number(activeCrisis.boardCrisisStreak) || 0),
    warmCrisisStreak: Math.max(0, Number(activeCrisis.warmCrisisStreak) || 0),
    bufferGraceActive: !!activeCrisis.bufferGraceActive,
    campaignShield: activeCrisis.campaignShield || null,
    warnedBoard: !!activeCrisis.warnedBoard,
    warnedFinances: !!activeCrisis.warnedFinances,
    warnedBoardStreak: !!activeCrisis.warnedBoardStreak,
    warnedCritical: !!activeCrisis.warnedCritical,
    warnedGrace: !!activeCrisis.warnedGrace,
    warnedShield: !!activeCrisis.warnedShield,
    warnedInsolvent: !!activeCrisis.warnedInsolvent,
    lastWarnPopupKey: activeCrisis.lastWarnPopupKey || null,
    warnedPopups: activeCrisis.warnedPopups && typeof activeCrisis.warnedPopups === 'object'
      ? { ...activeCrisis.warnedPopups }
      : {},
    offers: Array.isArray(activeCrisis.offers) ? activeCrisis.offers.map(item => ({ ...item })) : [],
  };
}

/**
 * Monta e persiste o payload completo da temporada (localStorage + espelho de carreira).
 */
export function createSeasonSaveWriter({
  getSavedNewGame,
  getUserClub,
  getUserDivision,
  getSeasonGoal,
  getSeasonGoalResult,
  getSeasonObjectives,
  getSeasonObjectivesResult,
  getManagerJobCrisis,
  getClubs,
  getNationalRankingEntries,
  getNationalCompetitions,
  getCompetitionRoundHistory,
  getCupCompetition,
  getRecopaCompetition,
  getWorldCupCompetition,
  getCurrentRound,
  getCareerCalendarDate,
  calendarKey,
  getTrainingRules,
  getContractAlertKeys,
  getUserSeasonCrowds,
  getFormation,
  getSerieDGroups,
  getCareerSeason,
  getSeasonRoundHistory,
  getNationalRankingFinalizedSeasons,
  getNationalTeamOffersSentYear,
  getNationalTeamOfferState,
  getPlayerDevelopment,
  getPendingSponsorChoice,
  getPendingSponsorOffers,
  getAllScorers,
  getAllAssistants,
  ensureStadium,
  getBalance,
  getMessages,
  getTransfersEngine,
  getValidSavedSeason,
  getSavedSeason,
  getTactics,
  getStateLeagueEngine,
  getSeasonTransition,
  getManagerRanking,
  managerRankingHelpers,
  persistCareer,
  persistActiveLiveMatch,
  saveQuotaState,
  tvHomeSlots,
}) {
  return function writeSeasonSave(opts = {}) {
    const savedNewGame = getSavedNewGame();
    if (!savedNewGame) return false;

    const userClub = getUserClub();
    const userDivision = getUserDivision();
    const activeUserClub = opts.userClub || userClub;
    const activeDivision = opts.userDivision || userDivision;
    const activeGoal = opts.seasonGoal !== undefined ? opts.seasonGoal : getSeasonGoal();
    const activeGoalResult = opts.seasonGoalResult !== undefined ? opts.seasonGoalResult : getSeasonGoalResult();
    const activeObjectives = opts.seasonObjectives !== undefined ? opts.seasonObjectives : getSeasonObjectives();
    const activeObjectivesResult = opts.seasonObjectivesResult !== undefined
      ? opts.seasonObjectivesResult
      : getSeasonObjectivesResult();
    const activeCrisis = opts.managerJobCrisis !== undefined ? opts.managerJobCrisis : getManagerJobCrisis();

    const clubs = getClubs();
    const nationalRankingEntries = getNationalRankingEntries();
    const nationalCompetitions = getNationalCompetitions();
    const competitionRoundHistory = getCompetitionRoundHistory();
    const cupCompetition = getCupCompetition();
    const careerSeason = getCareerSeason();
    const validSavedSeason = getValidSavedSeason();
    const savedSeason = getSavedSeason();
    const transfersEngine = getTransfersEngine();
    const seasonTransition = getSeasonTransition();
    const stateLeagueEngine = getStateLeagueEngine();
    const managerRanking = getManagerRanking();
    const tactics = getTactics();
    const pendingSponsorChoice = getPendingSponsorChoice();
    const pendingSponsorOffers = getPendingSponsorOffers();
    const userSeasonCrowds = getUserSeasonCrowds();
    const formation = getFormation();
    const serieDGroups = getSerieDGroups();
    const seasonRoundHistory = getSeasonRoundHistory();
    const playerDevelopment = getPlayerDevelopment();
    const currentRound = getCurrentRound();
    const careerCalendarDate = getCareerCalendarDate();
    const trainingRules = getTrainingRules();
    const contractAlertKeys = getContractAlertKeys();
    const recopaCompetition = getRecopaCompetition();
    const worldCupCompetition = getWorldCupCompetition();
    const nationalRankingFinalizedSeasons = getNationalRankingFinalizedSeasons();
    const nationalTeamOffersSentYear = getNationalTeamOffersSentYear();
    const nationalTeamOfferState = getNationalTeamOfferState?.() ?? null;

    pruneClubMemory(clubs, nationalRankingEntries);
    const standings = Object.fromEntries(
      Object.entries(nationalCompetitions).map(([division, competition]) => [
        division,
        competition.standings.map(row => ({ ...row })),
      ]),
    );
    const fatigue = slimFatigueSnapshot(clubs);
    const compactCompetitions = compactCompetitionHistories(competitionRoundHistory, activeUserClub);
    const compactCup = {
      currentPhase: cupCompetition.currentPhase,
      champion: cupCompetition.champion,
      stages: cupCompetition.stages.map(stage => ({
        index: stage.index,
        name: stage.name,
        twoLegged: stage.twoLegged,
        entrants: stage.entrants,
        completed: stage.completed,
        winners: stage.winners,
        fixtures: stage.fixtures.map(game => compactCupFixture(game, activeUserClub)),
      })),
    };
    const availability = slimAvailabilitySnapshot(clubs, activeUserClub);
    const clubMedical = Object.fromEntries(
      Object.entries(clubs).map(([clubName, club]) => [
        clubName,
        {
          medicalInvestment: club.medicalInvestment ?? 0,
          preventionProgram: club.preventionProgram ?? 0,
          pitchCondition: club.pitchCondition || 'good',
          pitchLevel: club.pitchLevel ?? null,
          stadiumStructure: club.stadiumStructure ?? null,
        },
      ]),
    );
    const userClubState = clubs[activeUserClub];
    if (!userClubState) return false;

    ensureStadium(userClubState, activeDivision);
    const userStadium = serializeUserStadium(userClubState);
    const userClubInvestments = serializeUserClubInvestments(userClubState);
    const userSponsors = !opts.resetUserEconomy && userClubState.sponsors
      ? {
        season: userClubState.sponsors.season,
        division: userClubState.sponsors.division,
        total: userClubState.sponsors.total,
        credited: !!userClubState.sponsors.credited,
        installments: Number(userClubState.sponsors.installments) || (activeDivision === 'D' ? 22 : 38),
        paidAmount: Number(userClubState.sponsors.paidAmount) || 0,
        paidInstallments: Number(userClubState.sponsors.paidInstallments) || 0,
        lastInstallmentRound: Number.isFinite(Number(userClubState.sponsors.lastInstallmentRound))
          ? Number(userClubState.sponsors.lastInstallmentRound)
          : null,
        pressure: Number.isFinite(Number(userClubState.sponsors.pressure))
          ? Number(userClubState.sponsors.pressure)
          : null,
        master: userClubState.sponsors.master ? { ...userClubState.sponsors.master } : null,
        secondaries: Array.isArray(userClubState.sponsors.secondaries)
          ? userClubState.sponsors.secondaries.map(item => ({ ...item }))
          : [],
      }
      : null;
    const userTvRights = !opts.resetUserEconomy && userClubState.tvRights && Number(userClubState.tvRights.total) > 0
      ? {
        season: userClubState.tvRights.season,
        division: userClubState.tvRights.division,
        total: Number(userClubState.tvRights.total),
        credited: !!userClubState.tvRights.credited,
        homeMode: true,
        installments: Number(userClubState.tvRights.installments) || tvHomeSlots(activeDivision),
        paidAmount: Number(userClubState.tvRights.paidAmount) || 0,
        paidInstallments: Number(userClubState.tvRights.paidInstallments) || 0,
        lastInstallmentRound: Number.isFinite(Number(userClubState.tvRights.lastInstallmentRound))
          ? Number(userClubState.tvRights.lastInstallmentRound)
          : null,
        lastHomeGameKey: userClubState.tvRights.lastHomeGameKey || null,
        advanced: !!userClubState.tvRights.advanced,
        advancedAt: userClubState.tvRights.advancedAt || null,
        advancedRound: Number.isFinite(Number(userClubState.tvRights.advancedRound))
          ? Number(userClubState.tvRights.advancedRound)
          : null,
        advancedGross: Number(userClubState.tvRights.advancedGross) || 0,
        advancedNet: Number(userClubState.tvRights.advancedNet) || 0,
        advancedHaircut: Number(userClubState.tvRights.advancedHaircut) || 0,
      }
      : null;
    const rankingEntries = Object.fromEntries(
      Object.entries(nationalRankingEntries).map(([clubName, entry]) => [
        clubName,
        { ...entry, titles: pruneRankingTitles(entry.titles) },
      ]),
    );
    const statusSnapshot = opts.userClubStatus && typeof opts.userClubStatus === 'object'
      ? {
        environment: opts.userClubStatus.environment,
        support: opts.userClubStatus.support,
        board: opts.userClubStatus.board,
        finances: opts.userClubStatus.finances,
        budget: Number.isFinite(Number(opts.userClubStatus.budget))
          ? Number(opts.userClubStatus.budget)
          : getBalance(userClubState),
      }
      : {
        environment: userClubState.environment,
        support: userClubState.support,
        board: userClubState.board,
        finances: userClubState.finances,
        budget: getBalance(userClubState),
      };
    const seasonBudget = Number.isFinite(Number(opts.userBudget)) ? Number(opts.userBudget) : statusSnapshot.budget;
    const seasonLedger = opts.resetUserEconomy
      ? []
      : Array.isArray(userClubState?.budgetLedger)
        ? userClubState.budgetLedger.map(entry => ({ ...entry }))
        : [];
    const savedMessages = slimCareerMessages(getMessages());

    const transferDealsRaw = FEATURES.transfers && transfersEngine?.snapshotSeasonDeals
      ? transfersEngine.snapshotSeasonDeals()
      : (validSavedSeason && Array.isArray(savedSeason?.seasonTransferDeals)
        ? savedSeason.seasonTransferDeals.map(item => ({ ...item }))
        : []);
    const transferOffersRaw = FEATURES.transfers && transfersEngine?.snapshotPendingOffers
      ? transfersEngine.snapshotPendingOffers()
      : (validSavedSeason && Array.isArray(savedSeason?.pendingTransferOffers)
        ? savedSeason.pendingTransferOffers.map(item => ({ ...item }))
        : []);

    const liveMatchCtx = persistActiveLiveMatch?.({ seed: savedNewGame.seed, activeUserClub }) || {};
    const activeLiveMatch = liveMatchCtx.activeLiveMatch ?? null;

    const seasonPayload = {
      seed: savedNewGame.seed,
      careerSeason,
      userClubName: activeUserClub,
      currentRound,
      careerCalendarDate: calendarKey(careerCalendarDate),
      trainingRules: { ...trainingRules },
      standings,
      fatigue,
      availability,
      clubMedical,
      userBudget: seasonBudget,
      userBudgetLedger: seasonLedger,
      userStaffContract: userClubState.staffContract && Number(userClubState.staffContract.amountPerRound) > 0
        ? {
          managerId: userClubState.staffContract.managerId || null,
          amountPerRound: Number(userClubState.staffContract.amountPerRound),
          season: userClubState.staffContract.season ?? null,
          score: Number.isFinite(Number(userClubState.staffContract.score))
            ? Number(userClubState.staffContract.score)
            : null,
          at: userClubState.staffContract.at || null,
          signedDate: userClubState.staffContract.signedDate || null,
          expiresDate: userClubState.staffContract.expiresDate || null,
          term: userClubState.staffContract.term || null,
        }
        : null,
      contractAlertKeys: [...contractAlertKeys],
      userBankLoan: opts.resetUserEconomy ? null : serializeBankLoan(userClubState),
      userClubStatus: statusSnapshot,
      userStadium,
      userClubInvestments,
      userSponsors,
      pendingSponsorChoice: !!pendingSponsorChoice,
      pendingSponsorOffers: pendingSponsorChoice && pendingSponsorOffers
        ? {
          division: pendingSponsorOffers.division || activeDivision,
          master: Array.isArray(pendingSponsorOffers.master)
            ? pendingSponsorOffers.master.map(item => ({ ...item }))
            : [],
          secondaries: Array.isArray(pendingSponsorOffers.secondaries)
            ? pendingSponsorOffers.secondaries.map(item => ({ ...item }))
            : [],
          reshufflesUsed: Number(pendingSponsorOffers.reshufflesUsed) || 0,
        }
        : null,
      userTvRights,
      userSeasonCashflow: !opts.resetUserEconomy && userClubState.seasonCashflow
        ? {
          season: userClubState.seasonCashflow.season ?? null,
          inflows: { ...(userClubState.seasonCashflow.inflows || {}) },
          outflows: { ...(userClubState.seasonCashflow.outflows || {}) },
          movementCount: Number(userClubState.seasonCashflow.movementCount) || 0,
        }
        : null,
      userSeasonCrowds: opts.resetUserEconomy ? [] : userSeasonCrowds.map(entry => ({ ...entry })),
      userTactics: { ...tactics.getTacticalValues() },
      userFormation: formation,
      userLineupOrder: clubs[activeUserClub]?.roster?.map(player => player.name) || [],
      careerMessages: savedMessages,
      pendingTransferOffers: transferOffersRaw,
      seasonTransferDeals: Array.isArray(transferDealsRaw)
        ? transferDealsRaw.slice(-MEMORY_LIMITS.seasonTransferDeals)
        : [],
      scorers: slimLeaderboard(getAllScorers(), 'goals'),
      assistants: slimLeaderboard(getAllAssistants(), 'assists'),
      serieDGroups,
      nationalFixtures: {
        A: slimNationalFixturesForSave(nationalCompetitions.A.fixtures),
        B: slimNationalFixturesForSave(nationalCompetitions.B.fixtures),
        C: slimNationalFixturesForSave(nationalCompetitions.C.fixtures),
        D: slimNationalFixturesForSave((nationalCompetitions.D.fixtures || []).slice(0, SERIE_D_GROUP_ROUNDS)),
      },
      competitionWindows: serializeCompetitionWindows(careerSeason),
      dFixtures: slimSerieDFixturesForSave(nationalCompetitions.D.fixtures),
      dKnockout: nationalCompetitions.D.knockout,
      cupCompetition: compactCup,
      recopaCompetition: isRecopaNationalEnabled() ? serializeRecopaNational(recopaCompetition) : null,
      priorSeasonChampions: savedNewGame?.priorSeasonChampions || null,
      worldCupCompetition: serializeWorldCupCompetition(worldCupCompetition),
      nationalTeamOffersSentYear: nationalTeamOffersSentYear ?? null,
      nationalTeamOfferState: nationalTeamOfferState ?? null,
      nationalRanking: {
        formulaVersion: NATIONAL_RANKING_FORMULA_VERSION,
        entries: rankingEntries,
        finalizedSeasons: [...nationalRankingFinalizedSeasons],
      },
      managerRanking: (() => {
        managerRanking.syncSeasonPointsFromClubs(managerRankingHelpers().getClubSeasonPoints);
        return managerRanking.snapshot();
      })(),
      seasonGoal: activeGoal
        ? { ...activeGoal, evaluate: activeGoal.evaluate ? { ...activeGoal.evaluate } : null }
        : null,
      seasonGoalResult: activeGoalResult ? { ...activeGoalResult } : null,
      seasonObjectives: Array.isArray(activeObjectives)
        ? activeObjectives.map(item => ({ ...item, evaluate: item.evaluate ? { ...item.evaluate } : null }))
        : null,
      seasonObjectivesResult: activeObjectivesResult
        ? {
          ...activeObjectivesResult,
          items: Array.isArray(activeObjectivesResult.items)
            ? activeObjectivesResult.items.map(item => ({ ...item }))
            : [],
        }
        : null,
      managerJobCrisis: serializeManagerJobCrisis(activeCrisis),
      seasonRoundHistory: compactRoundHistory(seasonRoundHistory, activeUserClub),
      competitionRoundHistory: compactCompetitions,
      stateLeagues: FEATURES.stateLeague && savedNewGame ? stateLeagueEngine.serialize() : null,
      seasonTransitionPrepared: !!seasonTransition?.isSeasonTransitionPrepared?.(),
      playerDevelopment: {
        season: playerDevelopment?.season ?? careerSeason,
        pulsesDone: Array.isArray(playerDevelopment?.pulsesDone) ? [...playerDevelopment.pulsesDone] : [],
        yearDeltaByPlayer: { ...(playerDevelopment?.yearDeltaByPlayer || {}) },
        ovrMarkByPlayer: { ...(playerDevelopment?.ovrMarkByPlayer || {}) },
        statusAlertByPlayer: { ...(playerDevelopment?.statusAlertByPlayer || {}) },
        trainingByPlayer: { ...(playerDevelopment?.trainingByPlayer || {}) },
        snapByPlayer: {},
      },
      pendingDivisionTeams: seasonTransition?.getPendingDivisionTeams?.()
        ? {
          A: [...(seasonTransition.getPendingDivisionTeams().A || [])],
          B: [...(seasonTransition.getPendingDivisionTeams().B || [])],
          C: [...(seasonTransition.getPendingDivisionTeams().C || [])],
          D: [...(seasonTransition.getPendingDivisionTeams().D || [])],
        }
        : null,
      pendingUserDivision: seasonTransition?.getPendingDivisionTeams?.()
        ? seasonTransition.getPendingUserDivision()
        : null,
      activeLiveMatch,
      liveMatchSnapshot: null,
      updatedAt: new Date().toISOString(),
    };
    seasonPayload.stateLeagueProgressRound = maxStateLeagueRound(seasonPayload);

    if (savedNewGame) {
      savedNewGame.clubStatus = {
        ...(savedNewGame.clubStatus && typeof savedNewGame.clubStatus === 'object' ? savedNewGame.clubStatus : {}),
        ...(statusSnapshot || {}),
        budget: seasonBudget,
        bankLoan: opts.resetUserEconomy ? null : serializeBankLoan(userClubState),
      };
      if (!opts.resetUserEconomy && userStadium) {
        savedNewGame.userStadium = userStadium;
      }
      if (!opts.resetUserEconomy && userClubInvestments) {
        savedNewGame.userClubInvestments = userClubInvestments;
      }
    }

    const seasonSaveResult = persistSeasonPayload(seasonPayload, { compactCompetitions, savedMessages });
    let ok = seasonSaveResult.ok;
    if (seasonSaveResult.slimmed && !saveQuotaState.warned) {
      saveQuotaState.warned = true;
      console.warn('[brfut] save de temporada compactado por cota do navegador.');
    }
    if (!ok && !saveQuotaState.warned) {
      saveQuotaState.warned = true;
      console.warn('[brfut] Não foi possível salvar a temporada (memória do navegador cheia).');
      try {
        window.dispatchEvent(new CustomEvent('brfut:save-quota', { detail: { key: SAVE_KEYS.season } }));
      } catch { /* ignore */ }
    }
    if (ok && savedNewGame) {
      try {
        persistCareer({ ...savedNewGame });
      } catch (error) {
        console.warn('[brfut] falha ao espelhar carreira após save de temporada', error);
      }
    }
    return ok;
  };
}
