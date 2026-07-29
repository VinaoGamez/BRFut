import { $, $$, on, onClick, redirectGame, clamp, cleanCareerText } from '../ui/dom.js';
import { markBootReady } from '../ui/boot-gate.js';
import { clubLabelHtml, clubCrestTitleHtml } from '../ui/club-label.js';
import { applyTeamCrestToElement, teamCrestHtml, clubCrestInitials as teamCrestInitials } from '../ui/team-crest.js';
import { bindBoardRosterHover } from '../ui/board-roster-hover.js';
import { createHeaderGuideRenderer } from '../ui/header-guide.js';
import { ensureCompetitionTrophy, hydratePickerTrophyIcons, preloadCompetitionTrophy, resolveChampionshipTrophyKey } from '../ui/competition-trophies.js';
import {
  buildPageCompetitionOptions,
  championshipPickerActiveId,
  isStateChampionshipPage,
  renderEstaduaisHub,
} from '../feature/championship-page/hub.js';
import { createChampionshipPageFocus } from '../feature/championship-page/focus.js';
import { createChampionshipLastGamesOpener } from '../feature/championship-page/last-games.js';
import { createCompetitionRulesModalFeature } from '../feature/competition-rules-modal/index.js';
import { createSeasonGoalCardFeature } from '../feature/season-goal-card/index.js';
import { serieDPhaseIndexForRound } from '../engine/serie-d-format.js';
import { filterPlayableRoundGames, isPlayableRoundGame } from '../engine/round-game-filter.js';
import { createRankingViewsFeature } from '../feature/ranking-views/index.js';
import { classificationZone } from '../engine/classification-zone.js';
import {
  NATIONAL_RANKING_FORMULA_VERSION,
  accumulateNationalRankingLeaguePoints,
  awardNationalRankingTitles,
  bootstrapNationalRankingEntries,
  clubSquadOverall,
  getClubSeasonLeagueRankingPoints,
  resolveNationalRankingEntry,
  sortNationalRankingEntries,
} from '../engine/national-ranking.js';
import { createRouter } from '../ui/router.js';
import { createMessagesFeature, isNationalTeamOfferMessage, isNationalTeamActionRequired, isContractRenewalActionRequired } from '../feature/messages/index.js';
import { createDashboardFeature } from '../feature/dashboard/index.js';
import { createTacticsFeature } from '../feature/tactics/index.js';
import { createSeasonSummaryFeature } from '../feature/season-summary/index.js';
import { createRetirementModalFeature } from '../feature/retirement-modal/index.js';
import {
  buildPlayerStatusFingerprint,
  countActiveRosterChangeAlerts,
  getActiveRosterChangeAlert,
  rosterChangeRowClass,
  scanRosterStatusChanges,
} from '../engine/roster-change-alerts.js';
import { processSeasonRetirements, markRetiredInHistoryStore } from '../engine/player-retirement.js';
import { createPlayerCells, outfield, fatigueCell, rosterFatigueCell } from '../feature/shared/player-cells.js';
import { renderTableFootIcon } from '../lab/card-back.js';
import { createPlayerRenameFeature } from '../feature/player-rename/index.js';
import { createRosterContractsFeature } from '../feature/roster-contracts/index.js';
import { SAVE_KEYS, FEATURES, SERIE_D_GROUP_ROUNDS } from '../core/constants.js';
import { isCloudStorageActive, probeBackend } from '../core/storage-api.js';
import { collectWorldRosters, applyWorldRosters, stampWorldPlayers } from '../engine/world-rosters.js';
import {
  computeRenewalWageAsk,
  ensurePlayerContract,
  contractUiTone,
  formatContractDate,
  isContractExpired,
  processAiClubContractsSilent,
  processClubContractCalendar,
  signSemesterContract,
  wageMonthlyFromRound,
} from '../engine/player-contracts.js';
import {
  collectStateLeagueClubNames,
  ensureMatchClubRosters,
  ensureStateLeagueRosters,
} from '../engine/regional-club-roster.js';
import { createTransfersEngine } from '../engine/transfers.js';
import { createLazyFeature } from '../engine/lazy-feature-loader.js';
import {
  takeBankLoan,
  repayBankLoan,
  payBankLoanMinimum,
  serviceBankLoan,
  bankLoanStatus,
  serializeBankLoan,
  applyBankLoanSnapshot,
  clearBankLoan,
  getBankLoan,
  bankLoanBalance,
} from '../engine/bank-loan.js';
import {
  resolveClubBankruptcyRisk,
  resolveFinancialRestriction,
  applyFinancialRestriction,
} from '../engine/club-solvency.js';
import { createClubBankruptcyFeature } from '../feature/club-bankruptcy/index.js';
import { createClubInsolvencyWarnFeature } from '../feature/club-insolvency-warn/index.js';
import { createClubFinancialRestrictionFeature } from '../feature/club-financial-restriction/index.js';
import {
  formatIncomingOfferLetter,
  formatUserRejectOfferLetter,
  formatOfferExpiredLetter,
  formatSellerRejectLetter,
} from '../engine/transfer-offer-copy.js';
import { createPlayerCardModal } from '../feature/player-card-modal/index.js';
import {
  normalizeDevelopmentState,
  emptyDevelopmentState,
  ensureCalendarDevelopmentPulses,
  runDevelopmentPulse,
  advancePlayerAges,
  getActiveOvrMark,
  formatOvrMarkHtml,
  OVR_MARK_WEEKS,
  PULSE_IDS,
  syncClubPowers,
} from '../engine/player-development.js';
import {
  normalizeTrainingRules,
  applyDevelopmentTrainingDay,
  emptyWeeklyTrainingReport,
  finalizeWeeklyTrainingReport,
  DEVELOPMENT_FOCUSES,
  TRAINING_FREE_MODES,
  developmentFocusOptionsForRoster,
  developmentFocusOptionsForClub,
  formatRosterTrainingXpHtml,
  getTrainingProgressForPlayer,
  summarizeSquadTrainingXp,
  XP_PER_ATTR_POINT,
} from '../engine/training-development.js';
import { collectYouthTrainingPlayers } from '../engine/youth-academy.js';
import {
  generatePlayer as generatePlayerCore,
  GENERIC_SQUAD_ROLES,
  DIVISION_CLUB_POWER,
  pickStarterFlags,
  rollProfessionalSquadSize,
  sanitizeSetPieceForDivision,
} from '../engine/player-generation.js';
import { resolvePlayerId, ensurePlayerId } from '../engine/player-identity.js';
import { dedupeRosterNames } from '../engine/player-names.js';
import { playerKey as historyPlayerKey, formatMatchRating, buildMatchPlayerSheets, playerKey } from '../engine/player-match-stats.js';
import {
  loadCareerSave,
  purgeOrphanSeasonForCareer,
  loadSeasonSave,
  isSeasonValidForCareer,
  hydrateMessages,
  clearSeasonSave,
  clearCareerStorage,
  markSkipPersistOnce,
  markSkipSessionEndOnce,
  writeJson,
  MEMORY_LIMITS,
  compactMatchResult,
  compactRoundHistory,
  compactCompetitionHistories,
  compactCupFixture,
  slimLeaderboard,
  slimAvailabilitySnapshot,
  slimFatigueSnapshot,
  slimSerieDFixturesForSave,
  pruneInjuryHistory,
  pruneRankingTitles,
  pruneClubMemory,
  involvesClub,
} from '../core/save.js';
import { hasUsableStateLeagueSave } from '../core/save-sync.js';
import { applyCareerPreferences, mergePreferencesIntoCareer } from '../core/save-preferences.js';
import { createMatchRatingsEngine, DEFAULT_USER_TACTICS, blankMatchStats } from '../engine/match-ratings.js';
import { createSeasonTransitionEngine } from '../engine/season-transition.js';
import { createSeasonSaveWriter } from '../engine/season-save-writer.js';
import { serializeUserStadium, applySavedUserStadium } from '../engine/stadium-sectors.js';
import { createInjuryEngine } from '../engine/injury.js';
import {
  applyMedicalLevelClinicalEffects,
  buildTreatmentOptions,
  computeTreatmentQuote,
  medicalDiscountPreview,
  treatmentLedgerLabel,
  treatmentLedgerReason,
} from '../engine/medical-costs.js';
import { createFatigueEngine } from '../engine/fatigue.js';
import { createDisciplineEngine } from '../engine/discipline.js';
import { createEconomyEngine, serializeUserClubInvestments, applySavedUserClubInvestments } from '../engine/economy.js';
import { createClubStatusEngine } from '../engine/club-status.js';
import { createManagerRankingEngine } from '../engine/manager-ranking.js';
import { pickSeasonGoal, evaluateSeasonGoal, seasonGoalLiveProgress } from '../engine/season-goals.js';
import {
  pickSeasonObjectives,
  seasonObjectiveLiveProgress,
  evaluateSeasonObjectives,
} from '../engine/season-objectives.js';
import { createPlayerHistoryEngine, PLAYER_HISTORY_LIMITS, seasonAverageRating, clubSeasonRatingSummary as computeClubSeasonRatingSummary, clubSeasonLeadersFromHistory, backfillClubSeasonMatchLogs } from '../engine/player-history.js';
import { recordKnockoutResult, winnerFromGame, loserFromGame } from '../engine/world-cup-bracket.js';
import {
  SERIE_D_CLUBS,
  SERIE_D_GROUPS,
  SERIE_D_PROMOTIONS,
  serieCClubsForSeason,
  serieCRelegationSlots,
  normalizeDivisionTeamsSerieC,
} from '../engine/serie-c-calendar.js';
import {
  getAllRealClubs,
  getRealClub,
  hydrateRealClubsFromImport,
  normClubName,
  SERIE_A_SEED,
  BRAZILIAN_UFS,
} from '../engine/brazilian-clubs-by-uf.js';
import {
  loadOfficialBrazilWorld,
  ensureImportClubsForUfs,
  ensureAllImportClubs,
  pickCascadeVictim,
  serieDGroupSizes,
  buildOfficialSerieDGroups,
  repairDivisionTeamsWithOfficial,
  serieDCascadeReplacementsToMap,
  applySerieDCascadeReplacementsToGroups,
} from '../engine/brazil-official-pyramid.js';
import {
  findSerieDGroupIndex,
  ensureSerieDGroupMembership,
  rebalanceSerieDGroups,
  serieDGroupsNeedRebalance,
} from '../engine/serie-d-formation.js';
import {
  applyCareerHostNameSwap,
  buildSerieATemplate,
  divisionFixturesIncludeClub,
  finalizeHostReplacementCascade,
  findClubDivision,
  hasCareerOriginReplacement,
  injectRealClubsIntoPyramid,
  prepareClubListForFixtures,
  dedupeAllDivisionTeams,
  resolveHostClubMeta,
  runFullRelegationCascade,
  ensureCascadePyramidIntegrity,
  ensureSerieDUserEnrollment,
} from '../engine/career-club-replacement.js';
import {
  buildCompetitionRoundRobinFixtures,
  hydrateNationalFixtures,
  slimNationalFixturesForSave,
  findRecordedGame,
  gameMatchesRecorded,
  applySavedSerieDFixtures,
} from '../engine/competition-calendar.js';
import {
  LEAGUE_CALENDAR_WINDOWS,
  DEFAULT_MIN_REST_DAYS,
  DEFAULT_TWO_LEG_GAP_DAYS,
  serializeCompetitionWindows,
  nominalRoundDate,
  gameScheduledDate,
  parseCalendarDate,
  formatFixtureDateLabel,
} from '../engine/season-scheduler.js';
import { createCupCalendarEngine } from '../engine/cup-calendar.js';
import { advanceStateLeagueThroughDateCore, createRoundAdvanceEngine } from '../engine/round-advance.js';
import { createCalendarWeekAdvance } from '../engine/calendar-week-advance.js';
import { createRoundResultsSimulator } from '../engine/round-results.js';
import { createRoundResultsBrowser } from '../engine/round-results-browser.js';
import { createNationalRoundSimulator } from '../engine/national-round-sim.js';
import { createCupFixtureRuntime } from '../engine/cup-fixture-runtime.js';
import { createNationalRankingFinalize } from '../engine/national-ranking-finalize.js';
import { createLiveKnockoutCommit } from '../engine/live-knockout-commit.js';
import { createGameLeadersTable } from '../engine/game-leaders-table.js';
import { createFixtureDetailsResolver } from '../engine/fixture-details.js';
import { createUserScheduleEngine } from '../engine/user-schedule.js';
import { collectStateLeagueDashboardGames as buildStateLeagueDashboardGames } from '../engine/state-league-dashboard-games.js';
import {
  buildCupPhaseNominalDates,
  seasonEndDate as planSeasonEndDate,
} from '../engine/season-calendar-plan.js';
import { resolveFixtureCompetitionCode, isWorldCupSeasonActive } from '../engine/season-calendar-mold.js';
import {
  isRecopaNationalGame,
  isRecopaNationalEnabled,
  restoreRecopaNational,
  serializeRecopaNational,
  materializeRecopaNational,
  recopaNationalFixtures,
  recopaBracketTie,
  completeRecopaNationalFixture,
  recopaNationalEmptyMessage,
  RECOPA_NATIONAL_COMPETITION,
} from '../engine/recopa-national.js';
import {
  buildWorldCupCalendarFixtures,
  WORLD_CUP_COMPETITION,
  WORLD_CUP_CALENDAR_CODE,
  WORLD_CUP_GROUP_FIXTURE_COUNT,
  KNOCKOUT_SCHEDULE,
} from '../engine/world-cup-calendar.js';
import { WORLD_CUP_GROUP_LETTERS } from '../engine/world-cup-history.js';
import { computeGroupStandings } from '../engine/world-cup-standings.js';
import {
  createWorldCupCompetition,
  getWorldCupAllFixtures,
  advanceWorldCupThroughDate,
  serializeWorldCupCompetition,
  worldCupCalendarSummary,
} from '../engine/world-cup-competition.js';
import { nationalTeamByCode, resolveNationalTeam } from '../engine/national-teams.js';
import {
  buildNationalTeamClub,
  findPlayerInNationalTeamClubs,
  resolveWorldCupOpponentName,
} from '../engine/national-team-club.js';
import {
  cloneNationalTeamRoster,
  isWorldCupUserFixture,
  resolveUserSideClub,
  resolveUserSideName,
} from '../engine/world-cup/context.js';
import {
  getNationalTeamFormation,
  getNationalTeamTactics,
} from '../engine/world-cup/national-team-tactics.js';
import {
  buildWorldCupDashboardEnvironment,
  buildWorldCupDashboardGoalContext,
  findUserWorldCupGroup,
  getUserWorldCupGroupTable,
  isWorldCupDashboardActive,
  resolveDashboardStandingsFocus,
} from '../engine/world-cup/dashboard-context.js';
import {
  formatNationalTeamOfferLetter,
  normalizeNationalTeamOfferState,
  shouldIssueNextNationalTeamOffer,
  shouldShowNationalTeamOfferPopup,
  generateNextNationalTeamOffer,
  getCurrentNationalTeamProposalTeams,
  repairNationalTeamOfferBatches,
  addDaysToCareerDate,
  NATIONAL_TEAM_OFFER_WEEK_DAYS,
  NATIONAL_TEAM_OFFER_COUNT,
} from '../engine/national-team-offers.js';
import { createNationalTeamOffersUiFeature } from '../feature/national-team-offers-ui/index.js';
import { createStateLeagueEngine } from '../engine/state-league.js';
import { isPaulistaFormat, isStateLeagueGame, parseStateCompetitionKey, scheduleStateLeagueDates, sortStandingsRows, stateCompetitionKey, STATE_LEAGUE_CALENDAR_SLOTS, STATE_LEAGUE_COMPETITION, stateLeagueBadgeName, stateLeagueClubGroupIndex, stateLeaguePhaseLabel, ufLabel, collectParticipantsForUf } from '../engine/state-league-format.js';
import { extractGuaranteedTier4ByUf, createLotteryPicker } from '../engine/state-league-divisions.js';
import { buildMembershipSnapshot } from '../engine/state-league-movement.js';
import { stateFlagMarkup } from '../ui/brazilian-state-flag.js';
import { createCareerPersistence } from '../engine/career-persistence.js';
import { createCareerCalendar, parseSavedCalendarDate } from '../engine/career-calendar.js';
import {
  resolveBoardJobRisk,
  resolveCampaignShield,
  hydrateManagerJobCrisis,
  shouldResetJobWarningState,
  generateJobOffers,
  buildManagerHireStatus,
  MANAGER_JOB_HONEYMOON_ROUNDS,
} from '../engine/manager-job.js';
import { composeBoardBrief } from '../engine/board-brief.js';
import { createManagerSackFeature } from '../feature/manager-sack/index.js';
import { createManagerJobWarnFeature } from '../feature/manager-job-warn/index.js';
import { createEconomyFeature } from '../feature/economy/index.js';
import { createSponsorPickerFeature } from '../feature/sponsor-picker/index.js';
import { createOptionsFeature } from '../feature/options/index.js';
import { createLiveDayMatchesFeature } from '../feature/live-day-matches/index.js';
import { createMatchLiveUiFeature } from '../feature/match-live-ui/index.js';
import { createMatchLiveAudioFeature } from '../feature/match-live-audio/index.js';
import { createMatchAvailability } from '../engine/match-availability.js';
import { createAwaySubController } from '../engine/match-live-away-subs.js';
import { createLiveMatchOrchestration } from '../engine/match-live-orchestration.js';
import { createMatchLiveSessionFeature } from '../feature/match-live-session/index.js';
import { tacticalKickoffMessage } from '../feature/tactics/tactical-confrontation.js';
import {
  ENGINE_TUNING,
  engineFoulRisk,
  engineProgressiveFoulRisk as engineProgressiveFoulRiskBase,
  engineBlowoutDamp,
  engineScoreDamp,
  matchDifficultyForClub,
  createSimLineupBuilder,
  FATIGUE_SUB_THRESHOLD,
} from '../engine/match-tuning.js';
import { FORMATION_PERFORMANCE, COMPATIBLE_ROLES, roundTactic } from '../engine/match-core.js';
import { createRoundMatchSimulator } from '../engine/match-sim.js';
import { createLiveMatchActions } from '../engine/match-live.js';
import {
  createLiveMatchPersistController,
  buildLiveMatchSnapshot,
  hydrateLiveMatchSnapshot,
  isValidLiveMatchSnapshot,
  loadLiveMatchSave,
  saveLiveMatchSave,
  clearLiveMatchSave,
  fixtureIdFromGame,
} from '../engine/live-match-persist.js';
import {
  KNOCKOUT_COMPETITIONS,
  isKnockoutShootoutCompetition,
  isStateKnockoutPhase,
  knockoutCompetitionLabel,
  knockoutShootoutLabel,
  serieDKnockoutPhaseLabel,
  resolveKnockoutTieWinner,
  projectedKnockoutNeedsShootout,
  knockoutTieNeedsPlayedShootout,
  formatKnockoutFixtureScore,
  clearStaleKnockoutShootout,
  sanitizeKnockoutShootoutSave,
  sameKnockoutFixture,
} from '../engine/knockout-shootout.js';
import { rosterShootoutKickPair, simulateProbabilisticShootout } from '../engine/shootout-sim.js';
import { createCupTieAdvanceEngine } from '../engine/cup-tie-advance.js';
import { createSerieDKnockoutAdvance } from '../engine/serie-d-knockout-advance.js';

/** Motor legado — migração incremental para módulos (Alpha 02). */
export async function bootEngine({
  bus,
  openAccountLogin,
  registerWelcomeAuthSync,
  registerCareerCreator,
} = {}) {
  try {
  const savedNewGame = loadCareerSave();
  if (savedNewGame && !Array.isArray(savedNewGame.retiredPool)) savedNewGame.retiredPool = [];
  purgeOrphanSeasonForCareer(savedNewGame);
  if (savedNewGame) {
    applyCareerPreferences(savedNewGame);
    if (!savedNewGame.preferences) {
      mergePreferencesIntoCareer(savedNewGame, {
        pace: localStorage.getItem(SAVE_KEYS.pace) || 'standard',
      });
    }
  }
  const persistenceCtx = { userClub: '' };
  const careerPersistence = createCareerPersistence({
    getSavedNewGame: () => savedNewGame,
    getClubs: () => clubs,
    getUserClub: () => persistenceCtx.userClub || userClub,
    collectWorldRosters,
  });
  careerPersistence.consumeBootSkip();
  const persistCareer = payload => careerPersistence.persistCareer(payload);
  const prepareForNewCareer = () => careerPersistence.prepareForNewCareer();
  const savedSeason = loadSeasonSave();
  const validSavedSeason = isSeasonValidForCareer(savedNewGame, savedSeason);
  const careerProfile={
    clubName:cleanCareerText(savedNewGame?.clubName,'Atlético Fênix'),
    managerName:cleanCareerText(savedNewGame?.managerName,'Mister'),
    division:['A','B','C','D'].includes(savedNewGame?.division)?savedNewGame.division:'A'
  };
  const userClub=careerProfile.clubName;
  persistenceCtx.userClub = userClub;
  const userDivision=careerProfile.division;
  let userNationalTeamCode=savedNewGame?.nationalTeamCode?String(savedNewGame.nationalTeamCode).trim().toUpperCase():null;
  let userNationalTeamName=userNationalTeamCode?nationalTeamByCode(userNationalTeamCode)?.name||null:null;
  const DEFAULT_CAREER_SEASON=2026;
  const careerSeason=Number(savedNewGame?.season)||DEFAULT_CAREER_SEASON;
  let officialBrazilWorld=null;
  if(savedNewGame&&FEATURES.stateLeague){
    try{
      officialBrazilWorld=await loadOfficialBrazilWorld();
      const userOriginUf=savedNewGame.userUf||getRealClub(userClub)?.uf||'SP';
      await ensureImportClubsForUfs([userOriginUf]);
      hydrateRealClubsFromImport(officialBrazilWorld?.importClubs);
    }catch(err){
      console.warn('[brfut] Pirâmide oficial indisponível',err);
    }
  }
  let seededState=(savedNewGame?.seed||0)>>>0;
  const gameRandom=()=>{if(!savedNewGame)return Math.random();seededState+=0x6D2B79F5;let value=seededState;value=Math.imul(value^value>>>15,value|1);value^=value+Math.imul(value^value>>>7,value|61);return((value^value>>>14)>>>0)/4294967296;};
  const rnd = (min, max) => min + gameRandom() * (max - min);
  const int = (min, max) => Math.floor(rnd(min, max + 1));
  let currentRound;
  const careerDateHolder = { date: null };
  /** @type {ReturnType<typeof createCareerCalendar>} */
  let careerCalendar;
  const injuryEngine = createInjuryEngine({
    rnd,
    int,
    gameRandom,
    getCurrentRound: () => currentRound,
    getCareerSeason: () => careerSeason,
  });
  const {
    injuryCatalog,
    clubMedicalQuality,
    pitchInjuryModifier,
    pitchLabel,
    preventionWorkloadEase,
    effectiveWorkloadRisk,
    medicalRecoveryModifier,
    medicalPreventionModifier,
    medicalDiagnosisModifier,
    medicalRehabSupport,
    resolveInjuryTreatment,
    treatmentLabel,
    injuryAllowsTreatmentChoice,
    normalizeInjury,
    injuryInAcutePhase,
    injuryInRestrictedPhase,
    playerInRestrictedReturn,
    playerRehabMaxMinutes,
    injuryStatModifier,
    matchPlayerStat,
    rehabMinuteOverload,
    recurrenceReturnModifier,
    fatigueExhaustionRisk,
    ageInjuryRisk,
    pronenessInjuryRisk,
    previousInjuryModifier,
    tacticalInjuryRisk,
    defaultWorkload,
    ensureWorkload,
    workloadRisk,
    recoveryRisk,
    tacticalMechanismRisk,
    matchIntensityFactor,
    decayPlayerWorkload,
    refreshWorkloadWindows,
    recordPlayerMatchWorkload,
    workloadLabel,
    injuryEventTypeFromPhase,
    injuryMechanismFromEvent,
    eventInjuryBaseRisk,
    calculateEventInjuryChance,
    pickInjuryVictim,
    selectInjuryMechanism,
    selectInjuryCategory,
    selectInjuryType,
    determineInjuryGrade,
    calculateRecoveryTime,
    buildInjuryRecord,
    classifyIncidentTier,
    discomfortMatchComment,
    resolvePhysicalIncident,
    createInjuryRecord,
    injuryAvailabilityLabel,
    injuryMatchComment,
    injuryDiagnosisComment,
    buildDeferredInjuryEntry,
    calculatePlayThroughSubChance,
    resolvePostMatchDiagnosis,
    injuryPostMatchReport,
    finalizeInjuryRecovery,
    beginRestrictedReturn,
    advanceRestrictedRehab,
    clearInjuryFully,
    playerUnavailable: playerInjuryUnavailable,
    injurySeverityLabel,
  } = injuryEngine;
  const discipline = createDisciplineEngine();
  const {
    YELLOW_SUSPENSION_LIMIT,
    normalizePlayerDiscipline,
    competitionKeyFromFixture,
    competitionLabel,
    getYellowAccumulation,
    activeSuspensions,
    isSuspendedForCompetition,
    isSuspendedAnywhere,
    directRedDismissalType,
    directRedSuspensionGames,
    applyDisciplineCard,
    serveCompetitionSuspensions,
    disciplineBadgeCompetitionKeys,
  } = discipline;
  const economy = createEconomyEngine();
  const {
    initialBudget,
    formatBudget,
    formatCapacity,
    formatTicketPrice,
    computeSeasonPrize,
    resolveSerieDPrizePhase,
    resolveCupPrizePhase,
    ensureBudget,
    ensureStadium,
    getStructureLevel,
    getPitchLevel,
    maxPitchForStructure,
    pitchTierLabel,
    structureLevelLabel,
    computeSectorBreakdown,
    canOfferStadiumNaming,
    getStadiumInvestments,
    credit,
    spend,
    canAfford,
    getBalance,
    estimateWageBill,
    estimateRoundRecurringRevenue,
    evaluateRosterPayroll,
    estimateStaffBill,
    estimateStadiumOpsBill,
    estimateRoundCostBill,
    estimateWageRunway,
    resolveOverdraftRate,
    isOverdrawn,
    ensureStaffContract,
    chargeRoundCosts,
    serviceOverdraft,
    chargeWageBill,
    listUpgrades,
    listStadiumUpgrades,
    purchaseUpgrade,
    purchaseStadiumUpgrade,
    getTicketPrices,
    adjustTicketPrice,
    adjustSectorTicketPrice,
    estimateGateReceipt,
    competitionAttraction,
    computeMatchAttendance,
    attachMatchAttendance,
    creditHomeGate,
    ensureSponsors,
    generateSponsorOffers,
    applySponsorChoice,
    purchaseStadiumNameRights,
    nameRightsCost,
    estimateSponsorInstallment,
    creditSponsorInstallment,
    creditNamingInstallment,
    generateNamingOffers,
    assignNamingContract,
    estimateNamingRound,
    getNamingRights,
    namingStatusLabel,
    SPONSOR_POOL,
    ensureTvRights,
    estimateTvInstallment,
    estimateTvRemaining,
    tvAdvanceStatus,
    advanceTvRights,
    creditHomeTv,
    tvHomeSlots,
    ensureSeasonCashflow,
    getSeasonCashflowStatement,
    getSponsors,
    getTvRights,
    TICKET_PRICE_RANGE,
    sponsorLogoSlug,
  } = economy;
  let economyUi;
  let youthUi;
  // Declarados cedo: playerUnavailable / orderRosterForFormation leem durante o boot.
  let liveMatchGame = null;
  let nextUserGame = null;
  let matchStarted = false;
  let matchFinished = false;
  let roundCommitted = false;
  const userLeagueDisciplineKey = () => `LEAGUE:${userDivision}`;
  const fixtureCompetitionKey = fixture =>
    competitionKeyFromFixture(fixture, { isKnockoutShootout: isKnockoutShootoutCompetition, clubs });
  const playerUnavailable = (player, competitionKey = undefined) => {
    if (playerInjuryUnavailable(player)) return true;
    const resolvedKey =
      competitionKey !== undefined && competitionKey !== null
        ? competitionKey
        : liveMatchGame || nextUserGame
          ? fixtureCompetitionKey(liveMatchGame || nextUserGame)
          : null;
    if (resolvedKey) return isSuspendedForCompetition(player, resolvedKey);
    return isSuspendedAnywhere(player);
  };
  const playerUnavailableForFixture = (player, fixture) =>
    playerUnavailable(player, fixture ? fixtureCompetitionKey(fixture) : null);
  const playerStarterBlocked = player =>
    playerUnavailableForFixture(player, liveMatchGame || nextUserGame) || playerInRestrictedReturn(player);
  const { playerNameCell, playerStatusBadges } = createPlayerCells({
    injuryInAcutePhase,
    injuryInRestrictedPhase,
    injurySeverityLabel,
    injuryAvailabilityLabel,
    getCareerCalendarDate: () => careerDateHolder.date,
    YELLOW_SUSPENSION_LIMIT,
    getYellowAccumulation,
    activeSuspensions,
    disciplineBadgeCompetitionKeys,
    competitionLabel,
    userLeagueDisciplineKey,
    getFocusCompetitionKey: () => fixtureCompetitionKey(liveMatchGame || nextUserGame) || userLeagueDisciplineKey(),
  });
const rosterChangeAlertHolder = { fn: null };
  const engineTuning = ENGINE_TUNING;
  let buildSimLineup;
  let substitutionPriority;
  let engineProgressiveFoulRisk;
  let simulateRoundMatch;
  let addPasses;
  let shot;
  let planPenaltyOutcome;
  let takeFreeKick;
  let penaltyTaker;
  let buildAttack;
  // O ambiente continua representando o momento interno do clube, mas uma
  // carreira nova respeita faixas compatíveis com a estrutura de cada divisão.
  // Durante a carreira esses valores poderão ultrapassar os limites iniciais.
  const initialEnvironmentRanges={A:[58,92],B:[55,88],C:[52,84],D:[50,80]};
  const indicatorTone = value => value > 75 ? 'positive' : value > 40 ? 'medium' : 'negative';
  const setIndicatorTone = (element,value) => { if(!element) return; element.classList.remove('positive','medium','negative'); element.classList.add(indicatorTone(value)); };
  // Placeholder visual até a carreira carregar os indicadores institucionais reais.
  $$('[data-dashboard-factor]').forEach(item => { const value=Math.round(rnd(Number(item.dataset.min),Number(item.dataset.max))); item.textContent=`${value}%`; setIndicatorTone(item.parentElement,value); });
  const dashboardEnvironment=$('.dashboard-environment'); if(dashboardEnvironment) setIndicatorTone(dashboardEnvironment,86);

  $('.pause-heading h2').id='pauseHeading';
  document.body.classList.add('dark-mode');
  let startMatchClock=()=>{};
  let openSeasonGoalPreview=()=>{};
  const matchLiveAudio=createMatchLiveAudioFeature();
  matchLiveAudio.syncControls?.();
  const optionsUi=createOptionsFeature({
    $, $$, onClick, redirectGame, cleanCareerText, writeJson, clearSeasonSave, clearCareerStorage, markSkipPersistOnce, prepareForNewCareer, SAVE_KEYS,
    hasCareer: !!savedNewGame,
    getSavedCareer: () => savedNewGame,
    initialBudget,
    defaultCareerSeason: DEFAULT_CAREER_SEASON,
    initialEnvironmentRanges,
    matchLiveAudio,
    openAccountLogin,
    onPaceChanged: () => {
      const penaltyClosed=$('#penaltyDuelModal')?$('#penaltyDuelModal').classList.contains('hidden'):$('#penaltyChoice').classList.contains('hidden');
      if(matchStarted&&!matchFinished&&$('#pausePanel').classList.contains('hidden')&&$('#liveOpponentModal').classList.contains('hidden')&&penaltyClosed&&!shootoutState)startMatchClock();
    },
    onPreviewSeasonGoal:()=>openSeasonGoalPreview(),
    onManualSave:()=>careerPersistence.manualSaveAll(),
    onPreferencesPersist:()=>{
      if(!savedNewGame)return;
      mergePreferencesIntoCareer(savedNewGame);
      persistCareer({...savedNewGame});
    },
  });
  registerWelcomeAuthSync?.(optionsUi.syncWelcomeAuth);
  registerCareerCreator?.(optionsUi.openCareerCreator);
  void probeBackend().then(ok => {
    optionsUi.syncWelcomeAuth?.({ loggedIn: isCloudStorageActive(), hasBackend: ok });
  });
  
  const clubInitials=userClub.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase();
  const managerFirstName=careerProfile.managerName.split(/\s+/)[0].toUpperCase();
  const syncUserClubCrestBranding=()=>{
    const sidebarCrest=$('.club>b');
    if(sidebarCrest){
      sidebarCrest.classList.add('crest','sidebar-club-crest');
      applyTeamCrestToElement(sidebarCrest,userClub);
    }
    const heroCrest=$('.hero .crest');
    if(heroCrest)applyTeamCrestToElement(heroCrest,userClub);
  };
  $('.season').textContent=`TEMPORADA ${careerSeason}`;$('.club strong').textContent=userClub;$('.club small').textContent=`Série ${userDivision} · ${careerSeason}`;
  $('.hero p').textContent=`BOA TARDE, ${managerFirstName}`;$('.hero>div>span').textContent=`Prepare o ${userClub} para mais uma rodada.`;
  syncUserClubCrestBranding();
  $('#calendar .title p').textContent=`BRASILEIRÃO SÉRIE ${userDivision} · TEMPORADA ${careerSeason}`;
  $('#openChampionship').firstChild.nodeValue=`BRASILEIRÃO SÉRIE ${userDivision} `;

  // Atributos completos: os 11 primeiros compõem o time titular.
  const squad = [
    {name:'R. Almeida',pos:'GOL',age:31,overall:78,dribble:24,speed:54,marking:18,tackling:16,finishing:15,passing:65,heading:42,positioning:86,penaltySaving:79,reflexes:84,freeKick:8,penaltyTaking:14,playmaking:18,fatigue:13},
    {name:'Caio Mendes',pos:'ZAG',age:27,overall:76,dribble:46,speed:70,marking:82,tackling:83,finishing:42,passing:64,heading:82,positioning:0,penaltySaving:0,reflexes:0,freeKick:12,penaltyTaking:34,playmaking:30,fatigue:11},
    {name:'L. Valente',pos:'ZAG',age:29,overall:75,dribble:41,speed:67,marking:80,tackling:80,finishing:39,passing:61,heading:80,positioning:0,penaltySaving:0,reflexes:0,freeKick:9,penaltyTaking:30,playmaking:29,fatigue:14},
    {name:'Pedro Lima',pos:'LAT',age:24,overall:77,dribble:71,speed:82,marking:73,tackling:75,finishing:61,passing:72,heading:58,positioning:0,penaltySaving:0,reflexes:0,freeKick:28,penaltyTaking:48,playmaking:58,fatigue:8},
    {name:'Matheus Reis',pos:'LAT',age:26,overall:74,dribble:66,speed:77,marking:71,tackling:73,finishing:57,passing:68,heading:61,positioning:0,penaltySaving:0,reflexes:0,freeKick:24,penaltyTaking:45,playmaking:55,fatigue:10},
    {name:'Bruno Serra',pos:'VOL',age:28,overall:80,dribble:65,speed:70,marking:82,tackling:84,finishing:64,passing:79,heading:71,positioning:0,penaltySaving:0,reflexes:0,freeKick:35,penaltyTaking:57,playmaking:72,fatigue:12},
    {name:'Thiago Nunes',pos:'MC',age:25,overall:79,dribble:77,speed:75,marking:61,tackling:58,finishing:72,passing:84,heading:55,positioning:0,penaltySaving:0,reflexes:0,freeKick:89,penaltyTaking:74,playmaking:89,fatigue:9},
    {name:'Davi Castro',pos:'MC',age:23,overall:76,dribble:76,speed:78,marking:60,tackling:57,finishing:70,passing:78,heading:52,positioning:0,penaltySaving:0,reflexes:0,freeKick:31,penaltyTaking:68,playmaking:77,fatigue:7},
    {name:'Enzo Rocha',pos:'PE',age:22,overall:81,dribble:88,speed:87,marking:42,tackling:37,finishing:84,passing:75,heading:60,positioning:0,penaltySaving:0,reflexes:0,freeKick:40,penaltyTaking:71,playmaking:82,fatigue:7},
    {name:'G. Azevedo',pos:'ATA',age:27,overall:82,dribble:80,speed:84,marking:35,tackling:32,finishing:90,passing:70,heading:78,positioning:0,penaltySaving:0,reflexes:0,freeKick:26,penaltyTaking:89,playmaking:57,fatigue:11},
    {name:'Rafael Silva',pos:'PD',age:24,overall:78,dribble:82,speed:85,marking:41,tackling:39,finishing:79,passing:73,heading:57,positioning:0,penaltySaving:0,reflexes:0,freeKick:37,penaltyTaking:69,playmaking:74,fatigue:8},
    {name:'Hugo Pires',pos:'GOL',age:21,overall:70,dribble:19,speed:49,marking:16,tackling:14,finishing:12,passing:56,heading:39,positioning:77,penaltySaving:70,reflexes:75,freeKick:6,penaltyTaking:10,playmaking:15,fatigue:6},
    {name:'Igor Ramos',pos:'ZAG',age:20,overall:69,dribble:43,speed:72,marking:73,tackling:71,finishing:36,passing:60,heading:76,positioning:0,penaltySaving:0,reflexes:0,freeKick:11,penaltyTaking:28,playmaking:26,fatigue:6},
    {name:'Samuel Costa',pos:'LAT',age:19,overall:68,dribble:67,speed:80,marking:65,tackling:67,finishing:54,passing:66,heading:52,positioning:0,penaltySaving:0,reflexes:0,freeKick:22,penaltyTaking:43,playmaking:53,fatigue:5},
    {name:'Vitor Maia',pos:'VOL',age:30,overall:73,dribble:58,speed:63,marking:78,tackling:80,finishing:58,passing:73,heading:70,positioning:0,penaltySaving:0,reflexes:0,freeKick:18,penaltyTaking:51,playmaking:66,fatigue:16},
    {name:'Lucas Freitas',pos:'MC',age:26,overall:74,dribble:72,speed:74,marking:54,tackling:53,finishing:68,passing:77,heading:48,positioning:0,penaltySaving:0,reflexes:0,freeKick:29,penaltyTaking:64,playmaking:75,fatigue:10},
    {name:'Natan Alves',pos:'ATA',age:21,overall:72,dribble:73,speed:82,marking:28,tackling:25,finishing:78,passing:63,heading:69,positioning:0,penaltySaving:0,reflexes:0,freeKick:17,penaltyTaking:72,playmaking:51,fatigue:6}
  ];
  let worldCupMatchSquad=null;
  let activeUserSquad=squad;
  /** Camisas 1…N por ordem do elenco. `number` nunca é seed de geração. */
  const assignSquadJerseyNumbers=roster=>{
    if(!Array.isArray(roster))return roster;
    roster.forEach((player,index)=>{if(player)player.number=index+1;});
    return roster;
  };
  assignSquadJerseyNumbers(squad);
  const useCareerOriginFlow=FEATURES.stateLeague&&hasCareerOriginReplacement(savedNewGame);
  if(useCareerOriginFlow&&savedNewGame?.replacementMode==='cascade'&&!savedNewGame?.replacedHostClub&&officialBrazilWorld){
    const victim=pickCascadeVictim({
      division:savedNewGame.targetDivision||savedNewGame.division||userDivision,
      uf:savedNewGame.userUf,
      seed:savedNewGame.seed,
      excludeNames:[userClub,savedNewGame.foundingClubName||userClub,...(savedNewGame.careerClubHistory||[])].filter(Boolean),
    });
    if(victim){
      savedNewGame.replacedHostClub=victim.name;
      savedNewGame.hostDivision=victim.division;
      savedNewGame.cascadeVictimPendingReveal=true;
      persistCareer({...savedNewGame});
    }
  }
  const careerHostMeta=useCareerOriginFlow?resolveHostClubMeta(savedNewGame):null;
  const teams=[...buildSerieATemplate(userClub,useCareerOriginFlow)];
  const starterRoles=['GOL','LAT','ZAG','ZAG','LAT','VOL','MC','MC','PE','ATA','PD'];
  const benchRoles=['GOL','ZAG','LAT','VOL','MC','MEI','ATA'];
  const firstNames=['Adriano','André','Arthur','Breno','Bruno','Caio','Carlos','Cristian','Daniel','Davi','Diego','Douglas','Eduardo','Enzo','Erick','Fábio','Felipe','Fernando','Gabriel','Guilherme','Gustavo','Heitor','Henrique','Hugo','Igor','Ítalo','João','Kaique','Leandro','Leonardo','Lucas','Luiz','Marcelo','Marcos','Matheus','Miguel','Murilo','Nathan','Nicolas','Otávio','Paulo','Pedro','Rafael','Renan','Rodrigo','Samuel','Thiago','Vitor','Victor','Wesley'];
  const lastNames=['Almeida','Alves','Amaral','Andrade','Araújo','Barbosa','Batista','Cardoso','Carvalho','Castro','Correia','Costa','Cunha','Dias','Duarte','Esteves','Ferreira','Freitas','Garcia','Gomes','Henrique','Leite','Lima','Lopes','Machado','Marques','Martins','Mendes','Monteiro','Moreira','Moura','Nascimento','Neves','Nunes','Oliveira','Pereira','Pires','Ramos','Reis','Ribeiro','Rocha','Rodrigues','Santos','Silva','Soares','Souza','Teixeira','Vieira'];
  const formationsForClubs=['4-3-3','4-4-2','3-5-2','4-2-3-1','4-1-4-1','5-3-2','4-3-1-2','3-4-3'];
  const divisionRules={
    A:{name:'Série A',clubs:20,power:DIVISION_CLUB_POWER.A,format:'38 rodadas em turno e returno',promotion:0,relegation:4},
    B:{name:'Série B',clubs:20,power:DIVISION_CLUB_POWER.B,format:'38 rodadas; 1º e 2º sobem, 3º–6º disputam playoffs',promotion:4,relegation:4},
    C:{name:'Série C',clubs:serieCClubsForSeason(careerSeason),power:DIVISION_CLUB_POWER.C,format:'pontos corridos em turno e returno',promotion:4,relegation:serieCRelegationSlots()},
    D:{name:'Série D',clubs:SERIE_D_CLUBS,power:DIVISION_CLUB_POWER.D,format:'16 grupos de 6; fase de grupos; 4 avançam por grupo; mata-mata e playoffs em ida e volta',promotion:SERIE_D_PROMOTIONS,relegation:0}
  };
  function generatedPlayer(role,index,clubPower,division='A',starterBoost=true){
    return generatePlayerCore({
      role,
      index,
      clubPower,
      division,
      random:gameRandom,
      firstNames,
      lastNames,
      starterBoost,
    });
  }
  const brazilianCities=['Amazônia','Manaus','Belém','Macapá','Boa Vista','Porto Velho','Rio Branco','Palmas','São Luís','Teresina','Fortaleza','Natal','João Pessoa','Recife','Maceió','Aracaju','Salvador','Cerrado','Goiânia','Anápolis','Cuiabá','Pantanal','Campo Grande','Brasília','Uberaba','Belo Horizonte','Juiz de Fora','Vitória','Serra','Niterói','Petrópolis','Campinas','Santos','Sorocaba','Londrina','Maringá','Curitiba','Joinville','Florianópolis','Chapecó','Caxias','Pelotas','Santa Maria','Porto Alegre','Vale Verde','Nova Esperança','Rio Dourado','Monte Azul'];
  const clubSuffixes=['Atlético','Esporte Clube','União','Futebol Clube'];
  const generatedClubPool=[];
  if(officialBrazilWorld?.regionalNames?.length){
    generatedClubPool.push(...officialBrazilWorld.regionalNames);
  }else{
    brazilianCities.forEach(city=>clubSuffixes.forEach(suffix=>generatedClubPool.push(`${suffix} ${city}`)));
    for(let index=generatedClubPool.length-1;index>0;index--){const swap=int(0,index),value=generatedClubPool[index];generatedClubPool[index]=generatedClubPool[swap];generatedClubPool[swap]=value;}
  }
  const divisionTeams={A:[...teams],B:[],C:[],D:[]};
  let careerWorldNeedsPersist=false;
  let serieCSizeRepaired=false;
  let serieDLayoutRepaired=false;
  let careerPyramidFreshlyGenerated=false;
  if(savedNewGame){
    const worldSeedMatches=!savedNewGame.worldSeed||savedNewGame.worldSeed===savedNewGame.seed;
    const restoredDivisions=!savedNewGame.freshWorld
      &&worldSeedMatches
      &&savedNewGame.divisionTeams
      &&Object.keys(divisionRules).every(division=>Array.isArray(savedNewGame.divisionTeams[division]));
    const foundingClubName=savedNewGame.foundingClubName||savedNewGame.clubName||userClub;
    const careerClubHistory=Array.isArray(savedNewGame.careerClubHistory)
      ?savedNewGame.careerClubHistory.filter(Boolean)
      :[foundingClubName].filter(Boolean);
    if(restoredDivisions){
      Object.keys(divisionRules).forEach(division=>divisionTeams[division]=[...savedNewGame.divisionTeams[division]]);
      Object.assign(divisionTeams,dedupeAllDivisionTeams(divisionTeams));
    }else{
      // Mundo ainda não persistido: pirâmide oficial CBF 2026 ou fallback fictício legado.
      const protectedNames=new Set(
        [userClub,foundingClubName,...careerClubHistory,careerHostMeta?.hostName]
          .filter(Boolean)
          .map(name=>name.toLocaleLowerCase('pt-BR')),
      );
      if(officialBrazilWorld){
        divisionTeams.A=[...officialBrazilWorld.divisionTeams.A];
        divisionTeams.B=[...officialBrazilWorld.divisionTeams.B];
        divisionTeams.C=[...officialBrazilWorld.divisionTeams.C];
        divisionTeams.D=[...officialBrazilWorld.divisionTeams.D];
        if(!Array.isArray(savedNewGame.regionalBaseClubs)||!savedNewGame.regionalBaseClubs.length){
          savedNewGame.regionalBaseClubs=[...officialBrazilWorld.regionalNames];
        }
      }else{
        divisionTeams.A=[...teams];
        const available=generatedClubPool.filter(name=>!protectedNames.has(name.toLocaleLowerCase('pt-BR')));
        while(divisionTeams.A.length<divisionRules.A.clubs){
          const filler=available.shift();
          if(!filler)break;
          divisionTeams.A.push(filler);
        }
        Object.keys(divisionRules).forEach(division=>{
          if(division==='A')return;
          const generatedCount=divisionRules[division].clubs;
          const generated=available.splice(0,generatedCount);
          divisionTeams[division]=generated;
        });
        Object.assign(
          divisionTeams,
          injectRealClubsIntoPyramid(divisionTeams,{
            protectedNames:[userClub,foundingClubName,...careerClubHistory,careerHostMeta?.hostName].filter(Boolean),
            realClubs:getAllRealClubs(),
            userClub,
            targets:{
              A:divisionRules.A.clubs,
              B:divisionRules.B.clubs,
              C:divisionRules.C.clubs,
              D:divisionRules.D.clubs,
            },
          }),
        );
      }
      if(useCareerOriginFlow&&careerHostMeta?.hostName){
        Object.assign(
          divisionTeams,
          applyCareerHostNameSwap(divisionTeams,{
            userClub,
            replacedHostClub:careerHostMeta.hostName,
            hostDivision:careerHostMeta.hostDivision,
          }),
        );
      }else{
        Object.keys(divisionRules).forEach(division=>{
          if(division!==userDivision)return;
          if(divisionTeams[division].some(name=>normClubName(name)===normClubName(userClub)))return;
          const swapIndex=divisionTeams[division].findIndex(name=>!protectedNames.has(name.toLocaleLowerCase('pt-BR')));
          if(swapIndex>=0)divisionTeams[division][swapIndex]=userClub;
          else divisionTeams[division].unshift(userClub);
        });
      }
      Object.assign(divisionTeams,dedupeAllDivisionTeams(divisionTeams));
      careerWorldNeedsPersist=true;
      careerPyramidFreshlyGenerated=true;
    }
    const namesInWorld=()=>{
      const keys=new Set();
      Object.values(divisionTeams).flat().forEach(name=>{
        if(name)keys.add(normClubName(name));
      });
      return keys;
    };
    [foundingClubName,...careerClubHistory].filter(Boolean).forEach(name=>{
      if(namesInWorld().has(normClubName(name)))return;
      divisionTeams.D.push(name);
      careerWorldNeedsPersist=true;
    });
    // CBF 2026+: corrige Série C inflada (bug antigo: +4 clubes/temporada sem teto).
    const serieCNorm=normalizeDivisionTeamsSerieC(divisionTeams,{
      season:careerSeason,
      userClub,
      fillPool:generatedClubPool,
      dTarget:SERIE_D_CLUBS,
    });
    if(serieCNorm.changed){
      Object.keys(divisionRules).forEach(division=>{
        divisionTeams[division]=[...serieCNorm.divisionTeams[division]];
      });
      careerWorldNeedsPersist=true;
      serieCSizeRepaired=true;
    }
    if(officialBrazilWorld&&restoredDivisions&&savedNewGame?.replacementMode!=='cascade'){
      const pyramidRepair=repairDivisionTeamsWithOfficial(divisionTeams,officialBrazilWorld,{
        userClub,
        userDivision,
        foundingClubName,
        careerClubHistory,
        replacedHostClub:savedNewGame?.replacedHostClub||careerHostMeta?.hostName||null,
      });
      if(pyramidRepair.changed){
        Object.keys(divisionRules).forEach(division=>{
          divisionTeams[division]=[...pyramidRepair.divisionTeams[division]];
        });
        careerWorldNeedsPersist=true;
        serieDLayoutRepaired=true;
      }
    }
    if(!savedNewGame.foundingClubName||!Array.isArray(savedNewGame.divisionTeams))careerWorldNeedsPersist=true;
    divisionRules.C.clubs=serieCClubsForSeason(careerSeason);
    divisionRules.C.relegation=serieCRelegationSlots();
    Object.keys(divisionRules).forEach(division=>{
      if(division==='C')return;
      divisionRules[division].clubs=divisionTeams[division].length;
    });
    divisionRules.C.clubs=divisionTeams.C.length;
    teams.splice(0,teams.length,...divisionTeams[userDivision]);
    if(careerWorldNeedsPersist){
      Object.assign(savedNewGame,{
        foundingClubName,
        careerClubHistory:[...new Set([foundingClubName,...careerClubHistory,userClub].filter(Boolean))],
        divisionTeams:Object.fromEntries(Object.keys(divisionRules).map(division=>[division,[...divisionTeams[division]]])),
        regionalBaseClubs:Array.isArray(savedNewGame.regionalBaseClubs)?[...savedNewGame.regionalBaseClubs]:[],
        worldSeed:savedNewGame.seed,
      });
      delete savedNewGame.freshWorld;
      persistCareer({...savedNewGame});
    }
  }
  const clubs={};
  const createClub=(club,division,index)=>{
    const rule=divisionRules[division];
    const basePower=int(rule.power[0],rule.power[1]);
    const formation=club===userClub?'4-3-3':formationsForClubs[int(0,formationsForClubs.length-1)];
    const roles=[...GENERIC_SQUAD_ROLES].slice(0, rollProfessionalSquadSize(gameRandom));
    const starterFlags=pickStarterFlags(roles.length,gameRandom);
    const roster=roles.map((role,playerIndex)=>generatedPlayer(role,playerIndex+index*29,basePower,division,starterFlags[playerIndex]));
    dedupeRosterNames(roster);
    assignSquadJerseyNumbers(roster);
    const top11=[...roster].sort((a,b)=>b.overall-a.overall).slice(0,11);
    const power=Math.round(top11.reduce((sum,player)=>sum+player.overall,0)/11);
    const environmentRange=initialEnvironmentRanges[division];
    const clubUf=getRealClub(club)?.uf||(club===userClub?savedNewGame?.userUf:null)||null;
    return{name:club,division,uf:clubUf,power,roster,formation,style:['Posse de bola','Contra-ataque','Pressão alta'][int(0,2)],mentality:['Defensiva','Equilibrada','Ofensiva'][int(0,2)],position:index+1,environment:int(...environmentRange),support:int(38,94),board:int(38,94),finances:int(35,96)};
  };
  if(savedNewGame){
    Object.entries(divisionTeams).forEach(([division,names])=>names.forEach((club,index)=>{clubs[club]=createClub(club,division,index);}));
    if(useCareerOriginFlow&&careerHostMeta?.hostName&&(careerPyramidFreshlyGenerated||savedNewGame?.replacementMode==='cascade')){
      const isCascadeCareer=savedNewGame?.replacementMode==='cascade';
      if(isCascadeCareer){
        const cascadeFix=ensureCascadePyramidIntegrity({
          divisionTeams,
          clubs,
          regionalBaseClubs:savedNewGame.regionalBaseClubs||[],
          userClub,
          victimClub:careerHostMeta.hostName,
          startDivision:savedNewGame.targetDivision||userDivision,
          cascadeSeed:savedNewGame.seed||0,
        });
        if(cascadeFix.applied){
          Object.keys(divisionRules).forEach(division=>{
            divisionTeams[division]=[...cascadeFix.divisionTeams[division]];
          });
          savedNewGame.regionalBaseClubs=[...cascadeFix.regionalBaseClubs];
          if(Array.isArray(cascadeFix.serieDReplacements)&&cascadeFix.serieDReplacements.length){
            savedNewGame.serieDCascadeReplacements=cascadeFix.serieDReplacements;
          }
          serieDLayoutRepaired=true;
        }
        const victimDivision=cascadeFix.victimDivision||findClubDivision(divisionTeams,careerHostMeta.hostName);
        if(victimDivision&&!clubs?.[careerHostMeta.hostName]){
          const hostIndex=divisionTeams[victimDivision].findIndex(name=>name===careerHostMeta.hostName);
          clubs[careerHostMeta.hostName]=createClub(
            careerHostMeta.hostName,
            victimDivision,
            Math.max(0,hostIndex),
          );
        }else if(clubs[careerHostMeta.hostName]&&victimDivision){
          clubs[careerHostMeta.hostName].division=victimDivision;
        }
        if(clubs[userClub])clubs[userClub].division=cascadeFix.userDivision||userDivision;
        if(cascadeFix.applied){
          teams.splice(0,teams.length,...divisionTeams[userDivision]);
          Object.assign(savedNewGame,{
            divisionTeams:Object.fromEntries(Object.keys(divisionRules).map(division=>[division,[...divisionTeams[division]]])),
            regionalBaseClubs:[...savedNewGame.regionalBaseClubs],
          });
          persistCareer({...savedNewGame});
          careerWorldNeedsPersist=true;
        }
      }else{
        const cascade=finalizeHostReplacementCascade({
          divisionTeams,
          clubs,
          regionalBaseClubs:savedNewGame.regionalBaseClubs||[],
          replacedHostClub:careerHostMeta.hostName,
          hostDivision:careerHostMeta.hostDivision,
          userClub,
        });
        Object.keys(divisionRules).forEach(division=>{
          divisionTeams[division]=[...cascade.divisionTeams[division]];
        });
        savedNewGame.regionalBaseClubs=[...cascade.regionalBaseClubs];
        const victimDivision=findClubDivision(cascade.divisionTeams,careerHostMeta.hostName)||cascade.hostClubDivision;
        const victimNeedsClub=cascade.hostClubCreated&&cascade.hostClubDivision;
        if(victimNeedsClub&&victimDivision){
          const hostIndex=divisionTeams[victimDivision].findIndex(name=>name===careerHostMeta.hostName);
          clubs[careerHostMeta.hostName]=createClub(
            careerHostMeta.hostName,
            victimDivision,
            Math.max(0,hostIndex),
          );
        }else if(clubs[careerHostMeta.hostName]&&victimDivision){
          clubs[careerHostMeta.hostName].division=victimDivision;
        }
        cascade.regionalBaseClubs.forEach(clubName=>{
          if(clubs[clubName])clubs[clubName].regionalBase=true;
        });
        if(clubs[userClub])clubs[userClub].division=cascade.userDivision||userDivision;
        teams.splice(0,teams.length,...divisionTeams[userDivision]);
        Object.assign(savedNewGame,{
          divisionTeams:Object.fromEntries(Object.keys(divisionRules).map(division=>[division,[...divisionTeams[division]]])),
          regionalBaseClubs:[...savedNewGame.regionalBaseClubs],
        });
        persistCareer({...savedNewGame});
        careerWorldNeedsPersist=true;
      }
    }
    // Elencos do mundo (IA + usuário) — base do mercado de transferências.
    if(savedNewGame.worldRosters&&typeof savedNewGame.worldRosters==='object'){
      applyWorldRosters(clubs,savedNewGame.worldRosters,{
        seed:savedNewGame.seed,
        season:careerSeason,
      });
    }
    const user=clubs[userClub];
    if(Array.isArray(savedNewGame.userRoster)&&savedNewGame.userRoster.length>=18)user.roster=savedNewGame.userRoster.map(player=>({injuryHistory:[],workload:{minutesLast7Days:0,minutesLast14Days:0,matchesLast14Days:0,consecutiveStarts:0,highIntensityLoad:0,lastMatchRound:0},...player,fatigue:100}));
    let userSetPieceRepaired=0;
    user.roster.forEach(player=>{
      if(sanitizeSetPieceForDivision(player,user.division||userDivision))userSetPieceRepaired+=1;
    });
    user._setPieceRepaired=userSetPieceRepaired;
    assignSquadJerseyNumbers(user.roster);
    squad.splice(0,squad.length,...user.roster);
    // Carreira nova: faixa estável (55–88). Continuação: permite variação
    // acumulada na temporada (28–98) sem “resetar” o painel ao recarregar.
    const userEnvironmentRange=initialEnvironmentRanges[userDivision],initialStatus=savedNewGame.clubStatus||{environment:int(...userEnvironmentRange),support:int(55,88),board:int(55,88),finances:int(55,88)};
    const continuingCareer=!!(validSavedSeason||Array.isArray(savedNewGame.userRoster));
    // Só força 4-3-3 / estilo padrão em carreira nova — não apagar tática salva.
    if(!continuingCareer){user.formation='4-3-3';user.style='Posse de bola';user.mentality='Equilibrada';}
    if(continuingCareer){
      user.environment=clamp(initialStatus.environment,28,98);
      user.support=clamp(initialStatus.support,28,98);
      user.board=clamp(initialStatus.board,28,98);
      user.finances=clamp(initialStatus.finances,28,98);
    }else{
      user.environment=clamp(initialStatus.environment,...userEnvironmentRange);
      user.support=clamp(initialStatus.support,55,88);
      user.board=clamp(initialStatus.board,55,88);
      user.finances=clamp(initialStatus.finances,55,88);
    }
    user.budget=Math.max(0,Number(initialStatus.budget??initialBudget(userDivision)));
    ensureBudget(user,userDivision);
  }
  else teams.forEach((club,index)=>{
    if(club===userClub){
      clubs[club]={name:club,division:'A',roster:squad,formation:'4-3-3',style:'Posse de bola',mentality:'Equilibrada',position:4};
      return;
    }
    const power=int(...DIVISION_CLUB_POWER.A);
    const squadSize = rollProfessionalSquadSize(gameRandom);
    const roles = [...GENERIC_SQUAD_ROLES].slice(0, squadSize);
    const starterFlags = pickStarterFlags(roles.length, gameRandom);
    const roster = assignSquadJerseyNumbers(
      roles.map((role, i) => generatedPlayer(role, i + index * 5, power, 'A', starterFlags[i])),
    );
    const top11=[...roster].sort((a,b)=>b.overall-a.overall).slice(0,11);
    clubs[club]={
      name:club,
      division:'A',
      power:Math.round(top11.reduce((sum,p)=>sum+p.overall,0)/11),
      roster,
      formation:formationsForClubs[int(0,formationsForClubs.length-1)],
      style:['Posse de bola','Contra-ataque','Pressão alta'][int(0,2)],
      mentality:['Defensiva','Equilibrada','Ofensiva'][int(0,2)],
      position:index+1,
    };
  });
  const setPieceRepaired=stampWorldPlayers(clubs,{seed:savedNewGame?.seed||0,season:careerSeason})
    +(clubs[userClub]?._setPieceRepaired||0);
  if(clubs[userClub])delete clubs[userClub]._setPieceRepaired;
  if(savedNewGame){
    // Primeira gravação ou migração de snapshot gordo (estourava cota do localStorage).
    const worldSample=Object.values(savedNewGame.worldRosters||{}).find(roster=>Array.isArray(roster)&&roster[0])?.[0];
    const worldFat=!!(worldSample&&(worldSample.workload||Array.isArray(worldSample.injuryHistory)||worldSample.injuryHistory));
    if(!savedNewGame.worldRosters||worldFat||setPieceRepaired>0){
      savedNewGame.worldRosters=collectWorldRosters(clubs,{skipClub:userClub,merge:savedNewGame.worldRosters||{}});
      if(Array.isArray(clubs[userClub]?.roster))savedNewGame.userRoster=clubs[userClub].roster;
      persistCareer({...savedNewGame});
    }
  }
  const continuingCareer=!!(validSavedSeason||(savedNewGame&&Array.isArray(savedNewGame.userRoster)&&savedNewGame.userRoster.length>=18));
  Object.values(clubs).forEach(club=>{
    const attackers=club.roster.filter(p=>['ATA','PE','PD','MEI','MC'].includes(p.pos)).sort((a,b)=>(b.finishing+b.heading*.2)-(a.finishing+a.heading*.2));
    const creators=club.roster.filter(p=>p.pos!=='GOL').sort((a,b)=>(b.passing+b.playmaking)-(a.passing+a.playmaking));
    club.environment=club.environment??(club.name===userClub?86:int(...initialEnvironmentRanges[club.division||'A']));
    club.support=club.support??int(42,92);
    club.board=club.board??int(42,92);
    club.finances=club.finances??int(40,94);
    if(club.name===userClub){
      if(savedNewGame?.stadiumName)club.stadiumName=String(savedNewGame.stadiumName).trim();
      ensureBudget(club,club.division||userDivision);
      ensureStadium(club,club.division||userDivision,{newGame:!continuingCareer});
    }
    club.medicalInvestment=club.medicalInvestment??0;
    club.preventionProgram=club.preventionProgram??0;
    // Setores v2: ensureStadium() no bloco do usuário define estrutura/gramado/setores.
    if(club.name!==userClub){
      club.pitchCondition=club.pitchCondition||'good';
      club.pitchLevel=Number.isFinite(Number(club.pitchLevel))?club.pitchLevel:3;
      club.stadiumStructure=Number.isFinite(Number(club.stadiumStructure))?club.stadiumStructure:2;
    }
    club.seasonLeaders={scorer:attackers[0]||club.roster[0],goals:savedNewGame?0:int(4,18),assistant:creators[0]||club.roster[1],assists:savedNewGame?0:int(3,14)};
  });
  // Os quatro indicadores institucionais atuam em áreas distintas e em escala
  // moderada. Eles inclinam probabilidades, mas nunca substituem elenco, tática,
  // atributos individuais ou a aleatoriedade natural de uma partida.
  const clubInstitutionalContext=(club,isHome=false)=>{
    const environment=Number.isFinite(Number(club?.environment))?Number(club.environment):60;
    const support=Number.isFinite(Number(club?.support))?Number(club.support):60;
    const board=Number.isFinite(Number(club?.board))?Number(club.board):60;
    const finances=Number.isFinite(Number(club?.finances))?Number(club.finances):60;
    const morale=(environment-60)/40;
    const supporters=(support-60)/40;
    const boardNorm=(board-60)/40;
    const financesNorm=(finances-60)/40;
    const crowd=supporters*(isHome?1:.16);
    return {
      overall:clamp(morale*.88+boardNorm*.42+financesNorm*.24+crowd*.32,-2.25,2.25),
      attack:clamp(morale*.82+crowd*.92+boardNorm*.14,-2.6,2.6),
      passing:clamp(morale*.86+boardNorm*.52+financesNorm*.18,-2.35,2.35),
      defense:clamp(morale*.42+boardNorm*.68+crowd*.24,-2.25,2.25),
      keeper:clamp(morale*.34+boardNorm*.28,-1.25,1.25),
      discipline:clamp((52-board)/420+(50-environment)/540,-.065,.13),
      wear:clamp(1-(finances-50)/900-(environment-50)/1800,.94,1.06),
      recovery:clamp(1+(finances-50)/500+(environment-50)/1000,.90,1.15),
      volatility:clamp(1+(55-environment)/125+(55-board)/180,.82,1.28)
    };
  };
  const formatTreatmentRecurrenceDelta=delta=>{
    if(!delta)return'';
    const pct=Math.round(Math.abs(delta)*100);
    if(delta>0)return`+${pct}% recaída`;
    if(delta<0)return`−${pct}% recaída`;
    return'';
  };
  const populateTreatmentModal=(player,injury,club)=>{
    const division=club?.division||userDivision||'A';
    const options=buildTreatmentOptions(injury,club,division);
    const consMeta=$('#treatmentConservativeMeta'),surgeryMeta=$('#treatmentSurgeryMeta'),medMeta=$('#treatmentMedicalMeta');
    if(consMeta)consMeta.textContent=`${formatBudget(options.conservative.cost)} · ~${options.conservative.days} dias${formatTreatmentRecurrenceDelta(options.conservative.recurrenceDelta)?` · ${formatTreatmentRecurrenceDelta(options.conservative.recurrenceDelta)}`:''}`;
    if(surgeryMeta)surgeryMeta.textContent=`${formatBudget(options.surgery.cost)} · ~${options.surgery.days} dias${formatTreatmentRecurrenceDelta(options.surgery.recurrenceDelta)?` · ${formatTreatmentRecurrenceDelta(options.surgery.recurrenceDelta)}`:''}`;
    if(medMeta){
      const medLevel=options.conservative.medLevel;
      medMeta.textContent=medLevel>0?`Departamento médico ${medLevel}/5 · ${medicalDiscountPreview(medLevel)}`:'Sem desconto médico ainda — invista no departamento no Escritório.';
    }
    const surgeryBtn=$('#treatmentSurgery');
    if(surgeryBtn){
      const affordable=canAfford(club,options.surgery.cost);
      surgeryBtn.disabled=!affordable;
      surgeryBtn.classList.toggle('treatment-choice-disabled',!affordable);
      surgeryBtn.title=affordable?'':`Saldo insuficiente para cirurgia (${formatBudget(options.surgery.cost)})`;
    }
    $('#treatmentPlayerName').textContent=player.name;
    $('#treatmentInjuryName').textContent=injury.name;
  };
  const applyTreatmentChoice=(player,injury,choice,club)=>{
    const adjusted=applyMedicalLevelClinicalEffects(injury,club,choice);
    return assignPlayerInjury(player,adjusted,currentRound,{skipTreatmentPrompt:true,club});
  };
  let pendingTreatmentDecision=null,postMatchMedicalQueue=[];
  const processPostMatchMedicalQueue=()=>{
    if(pendingTreatmentDecision||!postMatchMedicalQueue.length)return;
    const next=postMatchMedicalQueue.shift();
    pendingTreatmentDecision={player:next.player,injury:next.injury,club:next.club,liveContext:null};
    $('#treatmentModalText').textContent='O departamento médico aguarda sua decisão pós-jogo. Compare custo, prazo de retorno e risco de recaída antes de confirmar.';
    populateTreatmentModal(next.player,next.injury,next.club);
    $('#treatmentModal').classList.remove('hidden');
  };
  const offerTreatmentChoice=(player,injury,club,liveContext=null)=>{
    if(!injuryAllowsTreatmentChoice(injury)||club?.name!==userClub)return assignPlayerInjury(player,injury,currentRound,{skipTreatmentPrompt:true,club});
    if(liveContext){
      postMatchMedicalQueue.push({player,injury:{...injury},club});
      return assignPlayerInjury(player,injury,currentRound,{skipTreatmentPrompt:true,club});
    }
    if(pendingTreatmentDecision)return assignPlayerInjury(player,injury,currentRound,{skipTreatmentPrompt:true,club});
    pendingTreatmentDecision={player,injury,club,liveContext:null};
    $('#treatmentModalText').textContent='O departamento médico recomenda avaliar o tratamento. Compare custo, prazo de retorno e risco de recaída antes de confirmar.';
    populateTreatmentModal(player,injury,club);
    $('#treatmentModal').classList.remove('hidden');
    return null;
  };
  const finishTreatmentChoice=choice=>{
    if(!pendingTreatmentDecision)return;
    const {player,injury,club,liveContext}=pendingTreatmentDecision;
    const division=club?.division||userDivision||'A';
    const quote=computeTreatmentQuote(injury,club,division,choice);
    if(choice==='surgery'&&!canAfford(club,quote.cost))return;
    if(!canAfford(club,quote.cost))return;
    const payment=spend(club,quote.cost,{reason:treatmentLedgerReason(choice),label:treatmentLedgerLabel(choice,player.name),meta:{player:player.name,injury:injury.name,injuryType:injury.type,grade:injury.grade,days:quote.days,cost:quote.cost}});
    if(!payment.ok)return;
    const record=applyTreatmentChoice(player,injury,choice,club);
    pendingTreatmentDecision=null;
    $('#treatmentModal').classList.add('hidden');
    renderClubBudget?.();
    // Enquanto houver fila, a ação médica continua pendente no badge vermelho.
    if(!postMatchMedicalQueue.length){
      messages?.resolveActionRequiredMessages?.({category:'medical',type:'treatment-pending'});
    }
    if(club?.name===userClub&&record)pushMessage?.({category:'medical',type:'treatment',title:'Tratamento definido',body:`${player.name}: ${treatmentLabel(record.treatment)} para ${record.name} (${formatBudget(quote.cost)}). Retorno estimado em ${record.daysRemaining} dias.`,round:currentRound,meta:{competition:'Departamento médico'}});
    if(liveContext&&record){
      const {side,index}=liveContext;
      cards[side][index].injured=true;liveInjuries[side].push({name:player.name,injury:{...record}});
      log(injuryDiagnosisComment(player,record,club),'injury',side);
      pushLiveVolumeIncident(side,'injury',{name:player.name});
      if(side==='home'){
        $('#matchStatus').textContent='Partida pausada: jogador lesionado. Faça a substituição ou reorganize a equipe.';
        openPreparation('LESÃO');
      }else{
        const bench=club.roster.slice(11).filter(candidate=>!playerUnavailable(candidate)&&!liveInjuries.away.some(item=>item.name===candidate.name));
        if(bench.length&&liveInjuries.away.length<=5){const expected=player.pos,compatible=bench.filter(candidate=>candidate.pos===expected||(compatibleRoles[expected]||[]).includes(candidate.pos)),incoming=[...(compatible.length?compatible:bench)].sort((a,b)=>b.overall-a.overall)[0],incomingIndex=club.roster.indexOf(incoming);[club.roster[index],club.roster[incomingIndex]]=[incoming,player];cards.away[index]={yellow:0,red:false,dismissal:null,injured:false,playThroughRisk:false};liveMinutesPlayed.away.set(incoming.name,liveMinutesPlayed.away.get(incoming.name)??0);log(`${club.name} substitui o lesionado ${player.name} por ${incoming.name}.`,'injury-substitution');pushLiveVolumeIncident('away','substitution',{name:`${player.name} → ${incoming.name}`});}
      }
      renderRoster();drawBoard();renderSubstitutionControls();renderStats();
    }
    if(!liveContext&&postMatchMedicalQueue.length)processPostMatchMedicalQueue();
    return record;
  };
  const summarizeMatchInjuries=result=>{
    const summary={confirmedInMatch:0,deferred:0,cleared:0,monitoring:0,confirmedPostMatch:0,totalDaysOut:0,incidents:0};
    ['home','away'].forEach(side=>{
      const clubName=result[side],club=clubs[clubName];
      summary.confirmedInMatch+=(result.injuries?.[side]?.length||0);
      (result.deferredInjuries?.[side]||[]).forEach(entry=>{
        summary.deferred++;summary.incidents++;
        const player=club?.roster?.find(candidate=>candidate.name===entry.name);
        if(!player)return;
        const diagnosis=resolvePostMatchDiagnosis(player,entry.injury,{...entry,club});
        if(diagnosis.outcome==='cleared')summary.cleared++;
        else if(diagnosis.outcome==='monitoring'){summary.monitoring++;summary.totalDaysOut+=diagnosis.injury?.daysRemaining||0;}
        else{summary.confirmedPostMatch++;summary.totalDaysOut+=diagnosis.injury?.daysRemaining||0;}
      });
      (result.injuries?.[side]||[]).forEach(entry=>{summary.incidents++;summary.totalDaysOut+=entry.injury?.daysRemaining||0;});
    });
    return summary;
  };
  let renderHeaderGuide=()=>{};
  let rankingViews=null;
  let renderSeasonGoalCard=()=>{};
  let competitionRulesModal=null;
  const renderClubBudget=()=>{
    const club=clubs[userClub];
    if(club)ensureBudget(club,userDivision);
    const budget=getBalance(club);
    const label=formatBudget(budget);
    const headerBudget=$('#headerBudget');
    if(headerBudget)headerBudget.textContent=label;
    const dashboardBudget=$('#dashboardBudget');
    if(dashboardBudget){
      dashboardBudget.textContent=label;
      setIndicatorTone(dashboardBudget.parentElement,Math.min(100,Math.round(budget/200_000)));
    }
    economyUi?.renderOffice?.();
    economyUi?.renderStadium?.();
    try{renderHeaderGuide();}catch{/* boot */}
  };
  let isWorldCupDashboard=()=>false;
  let dashboardStandingsFocus=()=>'club';
  let worldCupDashboardCtx=()=>null;
  const CLUB_ONLY_NAV_VIEWS=new Set(['office','stadium','youth','training']);
  let openNavView=null;
  const syncNationalTeamCommandUi=()=>{
    const active=isWorldCupDashboard()&&!!userNationalTeamName;
    document.body.classList.toggle('national-team-command',active);
    if(!active)return;
    const activeNav=$$('.nav.active')[0];
    if(activeNav&&CLUB_ONLY_NAV_VIEWS.has(activeNav.dataset.view)){
      openNavView?.('dashboard');
    }
  };
  const renderEnvironmentCard=()=>{
    if(!savedNewGame)return;
    syncNationalTeamCommandUi();
    const envLabel=$('.environment-card > label');
    const goalLabel=$('#dashboardSeasonGoalCard > label');
    const factorLabels=$$('.dashboard-factors > div > small');
    const budgetWrap=$('#dashboardBudget')?.parentElement;
    const sideMini=$('.side-mini-cards');
    const dashboardRoot=$('#dashboard');
    const ntCommand=isWorldCupDashboard();
    if(ntCommand)sideMini?.classList.add('hidden');
    else sideMini?.classList.remove('hidden');
    if(dashboardStandingsFocus()==='worldcup'){
      dashboardRoot?.classList.add('dashboard-wc-mode');
      if(envLabel)envLabel.textContent='AMBIENTE DA SELEÇÃO';
      if(goalLabel)goalLabel.textContent='META NA COPA';
      const snap=buildWorldCupDashboardEnvironment({
        userNationalTeamName,
        userNationalTeamCode,
        getNationalTeamClub,
        competition:worldCupCompetition,
        random:gameRandom,
      });
      const overallEl=$('.dashboard-overall strong');
      if(overallEl)overallEl.textContent=snap.overall;
      if(dashboardEnvironment){
        dashboardEnvironment.style.setProperty('--environment',snap.environment);
        const envStrong=dashboardEnvironment.querySelector('strong');
        if(envStrong)envStrong.textContent=`${snap.environment}%`;
        setIndicatorTone(dashboardEnvironment,snap.environment);
      }
      if(budgetWrap)budgetWrap.classList.add('hidden');
      return;
    }
    dashboardRoot?.classList.remove('dashboard-wc-mode');
    if(envLabel)envLabel.textContent='AMBIENTE DO ELENCO';
    if(goalLabel)goalLabel.textContent='META DA TEMPORADA';
    const defaultFactors=['ORÇAMENTO DO CLUBE','APOIO DA TORCIDA','DIRETORIA','SAÚDE FINANCEIRA'];
    $$('.dashboard-factors > div').forEach((row,index)=>{
      const labelEl=row.querySelector('small');
      if(labelEl&&defaultFactors[index])labelEl.textContent=defaultFactors[index];
    });
    const user=clubs[userClub];
    if(!user)return;
    const overall=Math.round(user.roster.slice(0,11).reduce((sum,player)=>sum+player.overall,0)/11);
    const environment=user.environment;
    const overallEl=$('.dashboard-overall strong');
    if(overallEl)overallEl.textContent=overall;
    if(dashboardEnvironment){
      dashboardEnvironment.style.setProperty('--environment',environment);
      const envStrong=dashboardEnvironment.querySelector('strong');
      if(envStrong)envStrong.textContent=`${environment}%`;
      setIndicatorTone(dashboardEnvironment,environment);
    }
    const note=$('.dashboard-environment-note');
    if(note){
      const environmentLabel=environment>75?['Vestiário em alta','O elenco está motivado.']:environment>40?['Ambiente estável','O grupo trabalha sem grande pressão.']:['Vestiário pressionado','O elenco precisa reagir.'];
      const strong=note.querySelector('strong');
      const small=note.querySelector('small');
      if(strong)strong.textContent=environmentLabel[0];
      if(small)small.textContent=environmentLabel[1];
    }
    [user.support,user.board,user.finances].forEach((value,index)=>{
      const element=$$('[data-dashboard-factor]')[index];
      if(!element)return;
      element.textContent=`${value}%`;
      setIndicatorTone(element.parentElement,value);
    });
    renderClubBudget();
  };
  const clubStatus=createClubStatusEngine({
    clamp,
    getClubs:()=>clubs,
    getUserClub:()=>userClub,
    getUserDivision:()=>userDivision,
    getBalance:club=>getBalance(club),
    persistCareerStatus:status=>{
      if(!savedNewGame||!status)return;
      savedNewGame.clubStatus={
        environment:status.environment,
        support:status.support,
        board:status.board,
        finances:status.finances,
        budget:status.budget??getBalance(clubs[userClub]),
        // Dívida bancária acompanha o clube entre temporadas (não some no clearSeasonSave).
        bankLoan:serializeBankLoan(clubs[userClub]),
      };
    },
    onStatusChanged:()=>renderEnvironmentCard(),
  });
  const userStandingSnapshot=()=>{
    const standings=nationalCompetitions[userDivision]?.standings||[];
    const index=standings.findIndex(row=>row.club===userClub);
    if(index<0)return null;
    const row=standings[index];
    return {position:index+1,clubsCount:standings.length,points:row.points||0,played:row.played||0};
  };
  const applyClubStatusAfterRound=(games,fillRate=null)=>{
    if(!savedNewGame||!games?.length)return;
    const campaign=buildManagerCampaignContext();
    clubStatus.applyRoundImpacts(games,{
      userStanding:userStandingSnapshot(),
      fillRateByUserMatch:Number.isFinite(Number(fillRate))?Number(fillRate):null,
      campaignFactor:campaign.shield.campaignFactor,
    });
  };
  /** Custos + parcela de patrocínio na rodada nacional (não roda em Copa avulsa). */
  const applyUserWageBillForRound=round=>{
    if(!savedNewGame||!clubs[userClub])return null;
    const manager=managerRanking.byClub(userClub)||managerRanking.byName(careerProfile.managerName);
    const reputation=manager?.reputation??60;
    clubs[userClub].managerReputation=reputation;
    clubs[userClub].managerName=manager?.name||careerProfile.managerName||clubs[userClub].managerName;
    const installments=userDivision==='D'?22:38;
    const result=chargeRoundCosts(clubs[userClub],{
      division:userDivision,
      round,
      season:careerSeason,
      clubName:userClub,
      clubs,
      managerId:manager?.id||null,
      managerName:manager?.name||careerProfile.managerName||null,
      managerReputation:reputation,
      preferredDivision:manager?.preferredDivision||userDivision,
      titlePoints:manager?.titlePoints||0,
    });
    creditSponsorInstallment(clubs[userClub],{round,installments});
    creditNamingInstallment(clubs[userClub],{round,division:userDivision,season:careerSeason});
    // TV: parcela no mando de campo (creditHomeTv / creditLeagueHomeTvForGames).
    // Serviço do empréstimo bancário (juros + amortização mínima) na rodada nacional.
    serviceBankLoan(clubs[userClub],{division:userDivision,round,season:careerSeason});
    // Cheque especial: juros sobre saldo negativo.
    serviceOverdraft(clubs[userClub],{division:userDivision,round});
    clubStatus.syncFinancesFromBudget(clubs[userClub],userDivision);
    renderEnvironmentCard();
    return result;
  };
  if(savedNewGame){
    renderEnvironmentCard();
    const specialistRows=Object.keys(divisionRules).map(division=>{const divisionClubs=divisionTeams[division],freeClubs=divisionClubs.filter(name=>clubs[name].roster.some(player=>player.setPieceSpecialist==='freeKick'||player.setPieceSpecialist==='both')).length,penaltyClubs=divisionClubs.filter(name=>clubs[name].roster.some(player=>player.setPieceSpecialist==='penalty'||player.setPieceSpecialist==='both')).length;return `<span class="division-stat"><b>Série ${division}</b>${divisionClubs.length} clubes · ${freeClubs} com especialista em faltas · ${penaltyClubs} em pênaltis</span>`;}).join('');
    $('.new-game-action').insertAdjacentHTML('afterend',`<div class="generated-world-summary"><small>CARREIRA ATUAL</small><span class="career-current"><b class="career-club-name">${userClub}</b><span class="career-division">Série ${userDivision}</span></span><small class="career-manager-line">${careerProfile.managerName}</small><small>UNIVERSO NACIONAL</small>${specialistRows}</div>`);
  }
  const resolveOpponentClubName=()=>{
    const game=liveMatchGame||nextUserGame;
    if(game?.competition===WORLD_CUP_COMPETITION&&userNationalTeamName){
      const opp=resolveWorldCupOpponentName(game,userNationalTeamName);
      if(opp)return opp;
    }
    if(game){
      if(game.home===userClub)return game.away;
      if(game.away===userClub)return game.home;
      const ntOpp=resolveWorldCupOpponentName(game,userNationalTeamName);
      if(ntOpp)return ntOpp;
      const name=game.home===userClub?game.away:game.home;
      if(clubs[name])return name;
      if(getNationalTeamClub(name))return name;
    }
    return Object.keys(clubs).find(name=>name!==userClub&&clubs[name]?.roster)||Object.keys(clubs).find(name=>name!==userClub)||userClub;
  };
  const matchClub=()=>{
    const name=resolveOpponentClubName();
    return clubs[name]||getNationalTeamClub(name)||clubs[Object.keys(clubs).find(n=>n!==userClub)]||clubs[userClub];
  };
  // Calendário nacional: gerado por campeonato (política em competition-calendar.js).
  // Fixtures persistidos no save — não regenerar temporada em andamento.
  let restoredNationalFixtures=validSavedSeason&&savedSeason.nationalFixtures?{...savedSeason.nationalFixtures}:null;
  if(validSavedSeason&&!serieDLayoutRepaired&&!restoredNationalFixtures?.D&&Array.isArray(savedSeason.dFixtures)&&savedSeason.dFixtures.length>=SERIE_D_GROUP_ROUNDS){
    restoredNationalFixtures={
      ...(restoredNationalFixtures||{}),
      D:hydrateNationalFixtures(savedSeason.dFixtures.slice(0,SERIE_D_GROUP_ROUNDS),SERIE_D_GROUP_ROUNDS)
        ||savedSeason.dFixtures.slice(0,SERIE_D_GROUP_ROUNDS),
    };
  }
  const resolveDivisionFixtures=(divisionKey,clubList,competitionKey,expectedRounds)=>{
    const prepared=prepareClubListForFixtures(clubList,{
      targetSize:divisionRules[divisionKey]?.clubs||clubList.length,
      userClub,
    });
    const saved=hydrateNationalFixtures(restoredNationalFixtures?.[divisionKey],expectedRounds);
    if(saved){
      const hasGames=saved.some(round=>Array.isArray(round)&&round.length>0);
      const userOk=divisionKey!==userDivision||!userClub||divisionFixturesIncludeClub(saved,userClub);
      if(hasGames&&userOk)return saved;
    }
    const built=buildCompetitionRoundRobinFixtures(prepared,competitionKey);
    if(built?.flat()?.length)return built;
    return buildCompetitionRoundRobinFixtures(
      prepareClubListForFixtures(prepared,{userClub}),
      competitionKey,
    );
  };
  const serieAFixtures=resolveDivisionFixtures('A',divisionTeams.A,'brasileirao',38);
  const serieBFixtures=savedNewGame?resolveDivisionFixtures('B',divisionTeams.B,'brasileirao',38):[];
  const serieCFixtures=savedNewGame?resolveDivisionFixtures('C',divisionTeams.C,'brasileirao',null):[];
  const restoredSerieDGroups=!!(!officialBrazilWorld&&!serieDLayoutRepaired&&savedNewGame&&!serieCSizeRepaired&&savedSeason&&savedSeason.seed===savedNewGame.seed&&Array.isArray(savedSeason.serieDGroups)&&savedSeason.serieDGroups.length===16)?savedSeason.serieDGroups:null;
  const buildSerieDGroups=()=>{
    if(officialBrazilWorld){
      const replacements=serieDCascadeReplacementsToMap(savedNewGame?.serieDCascadeReplacements);
      return buildOfficialSerieDGroups(divisionTeams.D,{replacements});
    }
    const sizes=serieDGroupSizes(divisionTeams.D.length,SERIE_D_GROUPS);
    let state=((savedNewGame?.seed||0)^careerSeason^0x53E21D)>>>0;
    const draw=()=>{state+=0x6D2B79F5;let value=state;value=Math.imul(value^value>>>15,value|1);value^=value+Math.imul(value^value>>>7,value|61);return((value^value>>>14)>>>0)/4294967296;};
    const shuffle=values=>{const result=[...values];for(let index=result.length-1;index>0;index--){const swap=Math.floor(draw()*(index+1)),item=result[index];result[index]=result[swap];result[swap]=item;}return result;};
    const ordered=shuffle([...divisionTeams.D]);
    const groups=[];
    let offset=0;
    for(const size of sizes){
      groups.push(ordered.slice(offset,offset+size));
      offset+=size;
    }
    return groups;
  };
  let serieDGroups=restoredSerieDGroups&&!restoredSerieDGroups.some(group=>group.includes(userClub))
    ?(savedNewGame?buildSerieDGroups():[])
    :(restoredSerieDGroups?restoredSerieDGroups.map(group=>[...group]):savedNewGame?buildSerieDGroups():[]);
  if(Array.isArray(savedNewGame?.serieDCascadeReplacements)&&savedNewGame.serieDCascadeReplacements.length){
    serieDGroups=applySerieDCascadeReplacementsToGroups(serieDGroups,savedNewGame.serieDCascadeReplacements);
  }
  serieDGroups=ensureSerieDGroupMembership(divisionTeams,serieDGroups);
  if(savedNewGame&&userDivision==='D'){
    const serieDEnrollment=ensureSerieDUserEnrollment({
      divisionTeams,
      serieDGroups,
      userClub,
      userDivision,
      clubs,
      rebuildGroups:divisionD=>{
        if(officialBrazilWorld){
          const replacements=serieDCascadeReplacementsToMap(savedNewGame?.serieDCascadeReplacements);
          return buildOfficialSerieDGroups(divisionD,{replacements});
        }
        const prev=divisionTeams.D;
        divisionTeams.D=[...divisionD];
        const rebuilt=buildSerieDGroups();
        divisionTeams.D=prev;
        return rebuilt;
      },
    });
    if(serieDEnrollment.repaired){
      serieDGroups=serieDEnrollment.groups;
      if(serieDEnrollment.divisionTeams){
        Object.keys(divisionRules).forEach(division=>{
          divisionTeams[division]=[...serieDEnrollment.divisionTeams[division]];
        });
        teams.splice(0,teams.length,...divisionTeams[userDivision]);
      }
      serieDLayoutRepaired=true;
    }
  }
  serieDGroups=ensureSerieDGroupMembership(divisionTeams,serieDGroups);
  if(savedNewGame&&serieDGroupsNeedRebalance(serieDGroups)){
    serieDGroups=rebalanceSerieDGroups(divisionTeams,serieDGroups);
    serieDLayoutRepaired=true;
  }
  const userSerieDGroupIndexFound=findSerieDGroupIndex(userClub,serieDGroups);
  const userSerieDGroupIndex=userSerieDGroupIndexFound>=0?userSerieDGroupIndexFound:0;
  const userSerieDGroup=serieDGroups[userSerieDGroupIndexFound]||[];
  /** Fases do mata-mata Série D (espelho de updateSeriesDKnockout). */
  const serieDKnockoutPhaseDefs=[
    {index:1,key:'second',name:'2ª FASE',startRound:11,teams:64},
    {index:2,key:'third',name:'3ª FASE',startRound:13,teams:32},
    {index:3,key:'round16',name:'OITAVAS DE FINAL',startRound:15,teams:16},
    {index:4,key:'quarter',name:'QUARTAS DE FINAL',startRound:17,teams:8},
    {index:5,key:'semi',name:'SEMIFINAL',startRound:19,teams:8},
    {index:6,key:'final',name:'FINAL',startRound:21,teams:2},
  ];
  const normalizeSerieDGroupFixtures=fixtures=>{
    if(!Array.isArray(fixtures))return fixtures;
    fixtures.slice(0,SERIE_D_GROUP_ROUNDS).forEach((roundGames,roundIndex)=>{
      if(!Array.isArray(roundGames))return;
      const targetRound=roundIndex+1;
      roundGames.forEach(game=>{if(game&&typeof game==='object'&&!isKnockoutShootoutCompetition(game))game.round=targetRound;});
    });
    return fixtures;
  };
  const buildSerieDGroupFixtures=groups=>{
    if(serieDLayoutRepaired){
      return normalizeSerieDGroupFixtures(Array.from({length:SERIE_D_GROUP_ROUNDS},(_,roundIndex)=>groups.flatMap(group=>(buildCompetitionRoundRobinFixtures(group,'serie-d-groups')[roundIndex]||[]).map(game=>({...game,round:roundIndex+1})))));
    }
    const savedD=hydrateNationalFixtures(restoredNationalFixtures?.D,SERIE_D_GROUP_ROUNDS);
    if(savedD&&(!userClub||userDivision!=='D'||divisionFixturesIncludeClub(savedD,userClub)))return normalizeSerieDGroupFixtures(savedD);
    return normalizeSerieDGroupFixtures(Array.from({length:SERIE_D_GROUP_ROUNDS},(_,roundIndex)=>groups.flatMap(group=>(buildCompetitionRoundRobinFixtures(group,'serie-d-groups')[roundIndex]||[]).map(game=>({...game,round:roundIndex+1})))));
  };
  let serieDGroupFixtures=savedNewGame?buildSerieDGroupFixtures(serieDGroups):[];
  if(savedNewGame&&userDivision==='D'&&userClub&&!divisionFixturesIncludeClub(serieDGroupFixtures,userClub)){
    serieDGroups=rebalanceSerieDGroups(divisionTeams,serieDGroups);
    serieDLayoutRepaired=true;
    serieDGroupFixtures=buildSerieDGroupFixtures(serieDGroups);
  }
  const championshipFixtures=savedNewGame?{A:serieAFixtures,B:serieBFixtures,C:serieCFixtures,D:serieDGroupFixtures}[userDivision]:serieAFixtures;
  const scheduledMatchCount=(Array.isArray(championshipFixtures)?championshipFixtures:[]).reduce((total,round)=>total+(Array.isArray(round)?round.length:0),0);
  $('#calendar .title span').textContent=`${scheduledMatchCount} jogos da fase atual foram definidos no início da temporada.`;
  const nationalCompetitions={
    A:{...divisionRules.A,teams:divisionTeams.A,fixtures:serieAFixtures,standings:[]},
    B:{...divisionRules.B,teams:divisionTeams.B,fixtures:serieBFixtures,standings:[]},
    C:{...divisionRules.C,teams:divisionTeams.C,fixtures:serieCFixtures,standings:[],secondStage:{groups:2,clubsPerGroup:4}},
    D:{...divisionRules.D,teams:divisionTeams.D,groups:serieDGroups,fixtures:serieDGroupFixtures,standings:[],knockout:{qualifiedPerGroup:4,promotionSlots:SERIE_D_PROMOTIONS,promoted:[],twoLegged:true}}
  };
  const seasonRoundHistory=validSavedSeason&&Array.isArray(savedSeason.seasonRoundHistory)?compactRoundHistory(savedSeason.seasonRoundHistory,userClub):[];
  /** Log de público em casa — sobrevive ao prune de ledger/mensagens (resumo de temporada). */
  let userSeasonCrowds=validSavedSeason&&Array.isArray(savedSeason.userSeasonCrowds)
    ?savedSeason.userSeasonCrowds
      .filter(entry=>entry&&entry.home===userClub&&Number(entry.attendance)>0)
      .map(entry=>({
        home:entry.home,
        away:entry.away||entry.opponent||'—',
        attendance:Math.round(Number(entry.attendance)),
        fillRate:Number.isFinite(Number(entry.fillRate))?Number(entry.fillRate):null,
        gateRevenue:Number.isFinite(Number(entry.gateRevenue))?Number(entry.gateRevenue):null,
        competition:entry.competition||null,
        label:entry.label||null,
        phase:entry.phase||null,
        leg:entry.leg||null,
        round:entry.round??null,
      }))
    :[];
  const initialCareerMessages=hydrateMessages(savedSeason,validSavedSeason);
  const competitionRoundHistory=validSavedSeason&&savedSeason.competitionRoundHistory
    ?{A:[],B:[],C:[],D:[],...compactCompetitionHistories(savedSeason.competitionRoundHistory,userClub)}
    :{A:[],B:[],C:[],D:[]};
  const stateLeagueEngine=createStateLeagueEngine();
  if(FEATURES.stateLeague&&savedNewGame){
    const userOriginUf=savedNewGame.userUf||getRealClub(userClub)?.uf||'SP';
    if(validSavedSeason&&hasUsableStateLeagueSave(savedSeason.stateLeagues)){
      stateLeagueEngine.hydrate(savedSeason.stateLeagues,{userUf:userOriginUf,seasonYear:careerSeason,clubs});
      stateLeagueEngine.ensureAllCompetitions({
        clubs,
        regionalBaseClubs:savedNewGame.regionalBaseClubs||[],
        importClubs:officialBrazilWorld?.importClubs||[],
        userClub,
        membershipByUf:savedNewGame.stateLeagueMembership||{},
        lotterySeed:savedNewGame.seed??null,
      });
      void ensureAllImportClubs().then(()=>hydrateRealClubsFromImport(officialBrazilWorld?.importClubs)).catch(()=>{});
    }else{
      hydrateRealClubsFromImport(officialBrazilWorld?.importClubs);
      void ensureAllImportClubs().then(()=>hydrateRealClubsFromImport(officialBrazilWorld?.importClubs)).catch(()=>{});
      stateLeagueEngine.build({
        clubs,
        regionalBaseClubs:savedNewGame.regionalBaseClubs||[],
        importClubs:officialBrazilWorld?.importClubs||[],
        seasonYear:careerSeason,
        userUf:userOriginUf,
        userClub,
        membershipByUf:savedNewGame.stateLeagueMembership||{},
        lotterySeed:savedNewGame.seed??null,
      });
    }
    const stateCompetitions=stateLeagueEngine.competitions;
    const regionalRosterCtx={
      careerSeed:savedNewGame.seed??0,
      seasonYear:careerSeason,
      firstNames,
      lastNames,
    };
    try{
      ensureStateLeagueRosters(stateCompetitions,clubs,regionalRosterCtx);
      const stateSavedRosters={};
      collectStateLeagueClubNames(stateCompetitions).forEach(clubName=>{
        const saved=savedNewGame.worldRosters?.[clubName];
        if(Array.isArray(saved)&&saved.length>=11)stateSavedRosters[clubName]=saved;
      });
      if(Object.keys(stateSavedRosters).length){
        applyWorldRosters(clubs,stateSavedRosters,{seed:savedNewGame.seed,season:careerSeason});
      }
      stampWorldPlayers(clubs,{seed:savedNewGame.seed||0,season:careerSeason});
    }catch(err){
      console.warn('[brfut] Elencos estaduais indisponíveis',err);
    }
  }
  Object.values(nationalCompetitions).forEach(competition=>{competition.standings=competition.teams.map(club=>({club,played:0,wins:0,draws:0,losses:0,goalDiff:0,points:0}));});
  let leagueData=teams.map((club,index)=>{if(savedNewGame)return{club,played:0,wins:0,draws:0,losses:0,goalDiff:0,points:0};const played=13,wins=int(2,9),draws=int(1,5),losses=played-wins-draws,goalDiff=int(-8,14);return{club,played,wins,draws,losses,goalDiff,points:wins*3+draws};}).sort((a,b)=>b.points-a.points||b.goalDiff-a.goalDiff);
  if(savedNewGame&&userDivision==='D'){
    const seen=new Set(leagueData.map(row=>row.club));
    divisionTeams.D.forEach(club=>{
      if(club&&!seen.has(club)){
        leagueData.push({club,played:0,wins:0,draws:0,losses:0,goalDiff:0,points:0});
        seen.add(club);
      }
    });
    if(userClub&&!seen.has(userClub)){
      leagueData.push({club:userClub,played:0,wins:0,draws:0,losses:0,goalDiff:0,points:0});
    }
  }
  nationalCompetitions[userDivision].standings=leagueData;
  if(userDivision==='D')nationalCompetitions.D.standings=leagueData;
  if(validSavedSeason){
    Object.entries(savedSeason.standings||{}).forEach(([division,rows])=>{const competition=nationalCompetitions[division];if(!competition)return;rows.forEach(saved=>{const row=competition.standings.find(item=>item.club===saved.club);if(row)Object.assign(row,saved);});competition.standings.sort((a,b)=>b.points-a.points||b.goalDiff-a.goalDiff||b.wins-a.wins);competition.standings.forEach((row,index)=>clubs[row.club].position=index+1);});
    Object.entries(savedSeason.fatigue||{}).forEach(([clubName,players])=>Object.entries(players).forEach(([playerName,value])=>{const player=clubs[clubName]?.roster.find(item=>item.name===playerName);if(player)player.fatigue=clamp(value,0,100);}));
    if(!serieDLayoutRepaired){
      applySavedSerieDFixtures(nationalCompetitions.D.fixtures,savedSeason.dFixtures,SERIE_D_GROUP_ROUNDS);
    }
    if(savedSeason.dKnockout)Object.assign(nationalCompetitions.D.knockout,savedSeason.dKnockout);
    // Remove entradas de histórico sem jogo do usuário concluído (anti-loop pós-migração de mandos).
    for(let index=seasonRoundHistory.length-1;index>=0;index--){
      const entry=seasonRoundHistory[index];
      const round=entry?.round;
      if(!round)continue;
      const userGame=(nationalCompetitions[userDivision]?.fixtures?.[round-1]||[]).find(item=>item?.home===userClub||item?.away===userClub);
      if(!userGame)continue;
      const played=nationalCompetitions[userDivision]?.standings?.find(row=>row.club===userClub)?.played||0;
      if(played>=round)continue;
      if(findRecordedGame(userGame,entry.games||[]))continue;
      seasonRoundHistory.splice(index,1);
    }
  }
  const isSerieDKnockoutUiActive=()=>Boolean(nationalCompetitions.D?.knockout?.stages?.second?.length);
  const applyDeferredInjuryDiagnosis=(player,entry,club=null)=>{
    const ownerClub=club||entry.club;
    const diagnosis=resolvePostMatchDiagnosis(player,entry.injury,{...entry,club:ownerClub});
    if(diagnosis.outcome==='cleared')return {outcome:'cleared',report:injuryPostMatchReport(player,{outcome:'cleared',category:entry.injury.category,club:ownerClub})};
    const record=assignPlayerInjury(player,diagnosis.injury,currentRound,{skipTreatmentPrompt:ownerClub?.name!==userClub,club:ownerClub});
    return {outcome:diagnosis.outcome,injury:record,report:injuryPostMatchReport(player,{...diagnosis,injury:record||diagnosis.injury,club:ownerClub}),pending:!record};
  };
  const assignPlayerInjury=(player,injury,round=currentRound,options={})=>{
    if(!options.skipTreatmentPrompt&&injuryAllowsTreatmentChoice(injury)&&options.club?.name===userClub){
      const offered=offerTreatmentChoice(player,injury,options.club,options.liveContext||null);
      if(offered===null)return null;
    }
    const record=normalizeInjury({...injury,startedRound:injury.startedRound??round,rehabilitationStage:injury.rehabilitationStage||'acute',returnToPlay:null,medicallyCleared:false});
    player.injury=record;
    player.injuryHistory=player.injuryHistory||[];
    player.injuryHistory.push({type:record.type,bodyPart:record.bodyPart,side:record.side,severity:record.severity,season:careerSeason,daysOut:record.totalDays,recoveredAt:null});
    if(player.injuryHistory.length>MEMORY_LIMITS.injuryHistory)player.injuryHistory=player.injuryHistory.slice(-MEMORY_LIMITS.injuryHistory);
    return record;
  };
  // Disponibilidade do atleta persiste entre rodadas. Suspensões: 3 amarelos
  // por competição ou expulsão (vermelho direto com gravidade variável).
  const restoredAvailability=validSavedSeason?savedSeason.availability||{}:{};
  const restoredClubMedical=validSavedSeason?savedSeason.clubMedical||{}:{};
  const restoredUserBudget=validSavedSeason&&Number.isFinite(Number(savedSeason.userBudget))?Number(savedSeason.userBudget):null;
  let pendingSponsorChoice=!!(savedNewGame?.pendingSponsorChoice||(validSavedSeason&&savedSeason?.pendingSponsorChoice));
  let pendingSponsorOffers=validSavedSeason&&savedSeason?.pendingSponsorOffers&&typeof savedSeason.pendingSponsorOffers==='object'
    ?{
      division:savedSeason.pendingSponsorOffers.division||userDivision,
      master:Array.isArray(savedSeason.pendingSponsorOffers.master)?savedSeason.pendingSponsorOffers.master.map(item=>({...item})):[],
      secondaries:Array.isArray(savedSeason.pendingSponsorOffers.secondaries)?savedSeason.pendingSponsorOffers.secondaries.map(item=>({...item})):[],
      reshufflesUsed:Number(savedSeason.pendingSponsorOffers.reshufflesUsed)||0,
    }
    :null;
  const contractAlertKeys=new Set(
    validSavedSeason&&Array.isArray(savedSeason?.contractAlertKeys)?savedSeason.contractAlertKeys.filter(Boolean):[],
  );
  if(clubs[userClub]){
    // Só aplica economia/status da temporada se for do mesmo clube (evita herdar métricas após troca de emprego).
    let seasonStatusForClub=validSavedSeason&&(!savedSeason?.userClubName||savedSeason.userClubName===userClub);
    // Legado (sem userClubName): se carreira e temporada divergem em board+caixa, preferir carreira
    // — típico de troca de emprego gravada só no career save.
    if(seasonStatusForClub&&!savedSeason?.userClubName&&savedNewGame?.clubStatus&&savedSeason?.userClubStatus){
      const careerSnap=savedNewGame.clubStatus;
      const seasonSnap=savedSeason.userClubStatus;
      const boardDiff=Math.abs(Number(careerSnap.board)-Number(seasonSnap.board));
      const budgetDiff=Math.abs(Number(careerSnap.budget)-Number(seasonSnap.budget));
      if(boardDiff>=8&&budgetDiff>=100_000)seasonStatusForClub=false;
    }
    if(restoredUserBudget!=null&&seasonStatusForClub)clubs[userClub].budget=restoredUserBudget;
    else if(Number.isFinite(Number(savedNewGame?.clubStatus?.budget)))clubs[userClub].budget=Number(savedNewGame.clubStatus.budget);
    ensureBudget(clubs[userClub],userDivision);
    if(seasonStatusForClub&&Array.isArray(savedSeason?.userBudgetLedger))clubs[userClub].budgetLedger=savedSeason.userBudgetLedger.map(entry=>({...entry}));
    else clubs[userClub].budgetLedger=[];
    const savedStatus=validSavedSeason&&seasonStatusForClub&&savedSeason.userClubStatus&&typeof savedSeason.userClubStatus==='object'?savedSeason.userClubStatus:null;
    if(savedStatus){
      const user=clubs[userClub];
      if(Number.isFinite(Number(savedStatus.environment)))user.environment=clamp(Number(savedStatus.environment),clubStatus.STATUS_MIN,clubStatus.STATUS_MAX);
      if(Number.isFinite(Number(savedStatus.support)))user.support=clamp(Number(savedStatus.support),clubStatus.STATUS_MIN,clubStatus.STATUS_MAX);
      if(Number.isFinite(Number(savedStatus.board)))user.board=clamp(Number(savedStatus.board),clubStatus.STATUS_MIN,clubStatus.STATUS_MAX);
      if(Number.isFinite(Number(savedStatus.finances)))user.finances=clamp(Number(savedStatus.finances),clubStatus.STATUS_MIN,clubStatus.STATUS_MAX);
    }else{
      clubStatus.syncFinancesFromBudget(clubs[userClub],userDivision);
    }
    renderEnvironmentCard();
    const savedStadium=(validSavedSeason&&savedSeason?.userStadium)||savedNewGame?.userStadium;
    if(savedStadium&&typeof savedStadium==='object'){
      applySavedUserStadium(clubs[userClub],savedStadium);
    }else if(savedNewGame?.stadiumName){
      clubs[userClub].stadiumName=String(savedNewGame.stadiumName).trim();
    }
    ensureStadium(clubs[userClub],userDivision);
    const savedSponsors=validSavedSeason?savedSeason?.userSponsors:null;
    if(savedSponsors)clubs[userClub].sponsors={
      ...savedSponsors,
      master:savedSponsors.master?{...savedSponsors.master}:null,
      secondaries:Array.isArray(savedSponsors.secondaries)?savedSponsors.secondaries.map(item=>({...item})):[],
    };
    const hasChosenSponsors=!!(
      clubs[userClub].sponsors?.master?.name
      && Array.isArray(clubs[userClub].sponsors?.secondaries)
      && clubs[userClub].sponsors.secondaries.length===3
      && Number(clubs[userClub].sponsors?.season)===Number(careerSeason)
    );
    if(pendingSponsorChoice&&hasChosenSponsors)pendingSponsorChoice=false;
    if(pendingSponsorChoice){
      ensureSponsors(clubs[userClub],{pendingChoice:true});
      if(!pendingSponsorOffers?.master?.length||pendingSponsorOffers.secondaries?.length!==5){
        // Math.random (não o PRNG da carreira): ofertas variam entre Novo Jogo.
        pendingSponsorOffers=generateSponsorOffers({division:userDivision,random:Math.random});
      }
    }else{
      ensureSponsors(clubs[userClub],{
        division:userDivision,
        season:careerSeason,
        random:Math.random,
        savedSponsors,
        creditPackage:false,
        installments:userDivision==='D'?22:38,
      });
    }
    const savedTvRights=validSavedSeason?savedSeason?.userTvRights:null;
    if(savedTvRights&&typeof savedTvRights==='object'){
      clubs[userClub].tvRights={...savedTvRights};
    }
    ensureTvRights(clubs[userClub],{
      division:userDivision,
      season:careerSeason,
      random:gameRandom,
      savedTvRights,
      installments:tvHomeSlots(userDivision),
    });
    const savedSeasonCashflow=validSavedSeason?savedSeason?.userSeasonCashflow:null;
    if(savedSeasonCashflow&&typeof savedSeasonCashflow==='object'){
      clubs[userClub].seasonCashflow={
        season:savedSeasonCashflow.season??careerSeason,
        inflows:{...(savedSeasonCashflow.inflows||{})},
        outflows:{...(savedSeasonCashflow.outflows||{})},
        movementCount:Number(savedSeasonCashflow.movementCount)||0,
      };
    }
    ensureSeasonCashflow(clubs[userClub],careerSeason);
    const savedStaffContract=savedSeason?.userStaffContract;
    if(savedStaffContract&&typeof savedStaffContract==='object'&&Number(savedStaffContract.amountPerRound)>0){
      clubs[userClub].staffContract={
        managerId:savedStaffContract.managerId||null,
        amountPerRound:Number(savedStaffContract.amountPerRound),
        season:savedStaffContract.season??null,
        score:Number.isFinite(Number(savedStaffContract.score))?Number(savedStaffContract.score):null,
        at:savedStaffContract.at||null,
        signedDate:savedStaffContract.signedDate||null,
        expiresDate:savedStaffContract.expiresDate||null,
        term:savedStaffContract.term||null,
      };
    }
    // Empréstimo bancário: temporada atual, senão carreira (virada de temporada limpa o season save).
    const savedBankLoan=seasonStatusForClub
      ?(savedSeason?.userBankLoan||savedNewGame?.clubStatus?.bankLoan||null)
      :null;
    if(savedBankLoan&&Number(savedBankLoan.balance)>0){
      applyBankLoanSnapshot(clubs[userClub],savedBankLoan);
    }else{
      clearBankLoan(clubs[userClub]);
    }
  }
  Object.entries(clubs).forEach(([clubName,club])=>{
    const medical=restoredClubMedical[clubName];
    if(medical){
      club.medicalInvestment=medical.medicalInvestment??club.medicalInvestment??0;
      club.preventionProgram=medical.preventionProgram??club.preventionProgram??0;
      club.pitchCondition=medical.pitchCondition||club.pitchCondition||'good';
      if(Number.isFinite(Number(medical.pitchLevel)))club.pitchLevel=Number(medical.pitchLevel);
      if(Number.isFinite(Number(medical.stadiumStructure)))club.stadiumStructure=Number(medical.stadiumStructure);
    }
    club.roster.forEach(player=>{
    const restored=restoredAvailability[clubName]?.[player.name]||{};
    player.injuryHistory=pruneInjuryHistory(Array.isArray(restored.injuryHistory)?restored.injuryHistory:Array.isArray(player.injuryHistory)?player.injuryHistory:[]);
    player.workload={minutesLast7Days:0,minutesLast14Days:0,matchesLast14Days:0,consecutiveStarts:0,highIntensityLoad:0,lastMatchRound:0,...player.workload,...restored.workload};
    player.injury=restored.injury?normalizeInjury({...restored.injury}):player.injury?normalizeInjury({...player.injury}):null;
    player.discipline=normalizePlayerDiscipline(restored.discipline,{defaultLeagueKey:`LEAGUE:${clubs[clubName]?.division||userDivision}`});
    if(player.injury&&!injuryInAcutePhase(player.injury)&&!injuryInRestrictedPhase(player.injury)){
      if(player.injury.legacy||player.injury.rehabilitationStage==='fit')player.injury=null;
      else beginRestrictedReturn(player,club);
    }
    });
  });
  const savedUserInvestments=savedSeason?.userClubInvestments||savedNewGame?.userClubInvestments;
  if(savedUserInvestments&&typeof savedUserInvestments==='object'&&clubs[userClub]){
    applySavedUserClubInvestments(clubs[userClub],savedUserInvestments);
  }
  leagueData.forEach((row,index)=>clubs[row.club].position=index+1);
  const emptySerieDStanding=club=>({club,played:0,wins:0,draws:0,losses:0,goalDiff:0,points:0});
  const seriesDGroupRows=groupIndex=>{
    const group=serieDGroups[groupIndex]||[];
    return group.map(club=>nationalCompetitions.D.standings.find(row=>normClubName(row.club)===normClubName(club))||emptySerieDStanding(club)).sort((a,b)=>b.points-a.points||b.wins-a.wins||b.goalDiff-a.goalDiff);
  };
  const displayedLeagueRows=()=>userDivision==='D'?seriesDGroupRows(userSerieDGroupIndex):[...leagueData].sort((a,b)=>b.points-a.points||b.wins-a.wins||b.goalDiff-a.goalDiff);
  const DASHBOARD_TABLE_ROWS=5;
  const stateLeagueGroupPositionFor=(clubName,game)=>{
    if(!game||!isStateLeagueGame(game)||!stateLeagueEngine)return null;
    const tier=game.stateTier||1;
    const compId=stateCompetitionKey(game.stateUf,tier);
    const division=stateLeagueEngine.getDivisionForBrowse(compId,clubName);
    if(!division)return null;
    let groupIndex=game.groupIndex;
    if(groupIndex==null)groupIndex=stateLeagueClubGroupIndex(division,clubName);
    const rows=stateGroupRows(compId,groupIndex??0);
    const pos=rows.findIndex(row=>row.club===clubName);
    return pos>=0?pos+1:null;
  };
  const isSerieDEnrolledClub=clubName=>{
    const div=clubs[clubName]?.division;
    if(div==='D')return true;
    if(div==='REG'&&findSerieDGroupIndex(clubName,serieDGroups)>=0)return true;
    return false;
  };
  const displayedClubPosition=(clubName,game=null)=>{
    if(game&&isStateLeagueGame(game)){
      const groupPos=stateLeagueGroupPositionFor(clubName,game);
      if(groupPos)return groupPos;
    }
    if(isSerieDEnrolledClub(clubName)){
      const groupIndex=findSerieDGroupIndex(clubName,serieDGroups);
      if(groupIndex<0)return '—';
      const pos=seriesDGroupRows(groupIndex).findIndex(row=>normClubName(row.club)===normClubName(clubName));
      return pos>=0?pos+1:'—';
    }
    if(clubs[clubName]?.division==='REG')return '—';
    return clubs[clubName]?.position||'—';
  };
  let pageCompetition=userDivision;
  let openChampionshipLastGames=()=>{};
  let pageStateRound=1;
  let pageStateGroup=0;
  let pageStateFixturesMode='round';
  let pageStateFixturesOpen=false;
  let pageSerieDGroup=userSerieDGroupIndexFound>=0?userSerieDGroupIndexFound:0;
  let pageSerieDMode='groups'; // groups | knockout
  let pageCupPhase=1;
  let pageSerieDPhase=1;
  let pageWorldCupGroup=0;
  let pageWorldCupRound=1;
  let pagePickerOpen=false;
  let pageStateTierPickerOpen=false;
  let renderChampionshipPage=()=>{};
  const PAGE_COMPETITION_OPTIONS=buildPageCompetitionOptions({FEATURES,savedNewGame});
  const getPageCompetitionOptions=()=>{
    if(!worldCupCompetition||!userNationalTeamName)return PAGE_COMPETITION_OPTIONS;
    const cmu={id:'CMU',label:'Copa do Mundo',trophyKey:'nacional'};
    if(PAGE_COMPETITION_OPTIONS.some(option=>option.id==='CMU'))return PAGE_COMPETITION_OPTIONS;
    return [cmu,...PAGE_COMPETITION_OPTIONS];
  };
  const stateGroupRows=(competitionId,groupIndex)=>stateLeagueEngine.getGroupRows(competitionId,groupIndex);
  const storedNationalRanking=(validSavedSeason?savedSeason.nationalRanking:null)||savedNewGame?.nationalRanking||{entries:{}};
  const {entries:nationalRankingEntries,finalizedSeasons:nationalRankingFinalizedSeasons}=bootstrapNationalRankingEntries({
    clubs,
    storedNationalRanking,
    pruneRankingTitles,
    careerSeed:savedNewGame?.seed??0,
  });
  pruneClubMemory(clubs,nationalRankingEntries);
  const managerRanking=createManagerRankingEngine({getSeed:()=>savedNewGame?.seed||1});
  const storedManagerRanking=(validSavedSeason?savedSeason.managerRanking:null)||savedNewGame?.managerRanking||null;
  managerRanking.ensurePool({
    clubNames:Object.keys(clubs),
    clubDivisions:Object.fromEntries(Object.values(clubs).map(club=>[club.name,club.division])),
    userClub,
    userManagerName:careerProfile.managerName,
    userDivision,
    stored:storedManagerRanking,
  });
  managerRanking.getManagers().forEach(manager=>{
    if(manager.club&&clubs[manager.club])clubs[manager.club].managerName=manager.name;
  });
  if(clubs[userClub]){
    const bootManager=managerRanking.byClub(userClub)||managerRanking.byName(careerProfile.managerName);
    clubs[userClub].managerReputation=bootManager?.reputation??clubs[userClub].managerReputation??60;
    ensureStaffContract(clubs[userClub],{
      division:userDivision,
      season:careerSeason,
      managerId:bootManager?.id||null,
      managerName:bootManager?.name||careerProfile.managerName||null,
      managerReputation:bootManager?.reputation??60,
      preferredDivision:bootManager?.preferredDivision||userDivision,
      titlePoints:bootManager?.titlePoints||0,
      force:false,
    });
  }
  const managerRankingHelpers=()=>({
    getClubDivision:clubName=>clubs[clubName]?.division||'—',
    getClubSeasonPoints:clubName=>getClubSeasonLeagueRankingPoints(clubName,{
      clubs,
      nationalCompetitions,
      careerSeason,
      finalizedSeasons:nationalRankingFinalizedSeasons,
    }),
  });
  let seasonGoal=(validSavedSeason&&savedSeason.seasonGoal?.id?savedSeason.seasonGoal:null)
    ||(savedNewGame?.seasonGoal?.id?savedNewGame.seasonGoal:null)
    ||null;
  let seasonGoalResult=(validSavedSeason&&savedSeason.seasonGoalResult?.status?savedSeason.seasonGoalResult:null)||null;
  let seasonObjectives=(validSavedSeason&&Array.isArray(savedSeason.seasonObjectives)&&savedSeason.seasonObjectives.length?savedSeason.seasonObjectives:null)
    ||(savedNewGame?.seasonObjectives?.length?savedNewGame.seasonObjectives:null)
    ||null;
  let seasonObjectivesResult=(validSavedSeason&&savedSeason.seasonObjectivesResult?.items?.length?savedSeason.seasonObjectivesResult:null)||null;
  let seasonGoalJustCreated=false;
  const buildSeasonObjectives=()=>pickSeasonObjectives({
    division:userDivision,
    seed:(savedNewGame?.seed||1)^(careerSeason*31),
    club:clubs[userClub],
    inCup:true,
  });
  const ensureSeasonObjectives=()=>{
    if(!savedNewGame)return [];
    if(seasonObjectives?.length)return seasonObjectives;
    ensureSeasonGoal();
    seasonObjectives=buildSeasonObjectives();
    return seasonObjectives;
  };
  const ensureSeasonGoal=()=>{
    if(!savedNewGame)return null;
    if(seasonGoal?.id)return seasonGoal;
    seasonGoal=pickSeasonGoal({
      division:userDivision,
      overall:clubSquadOverall(clubs[userClub]),
      seed:savedNewGame.seed||careerSeason,
    });
    seasonGoalResult=null;
    seasonObjectivesResult=null;
    seasonGoalJustCreated=true;
    seasonObjectives=buildSeasonObjectives();
    return seasonGoal;
  };
  const buildSeasonObjectiveEvalContext=(clubState)=>{
    const ctx=buildSeasonGoalLiveContext();
    const club=clubState||clubs[userClub];
    const cupPhase=resolveCupPrizePhase(userClub,cupCompetition);
    const cupPhaseIndex=cupPhase==='champion'?9:Number(cupPhase)||0;
    return {
      ...ctx,
      balance:getBalance(club),
      finances:club?.finances,
      runway:estimateWageRunway(club,userDivision,{managerReputation:club?.managerReputation}),
      cupPhaseIndex,
      cupPhaseLabel:cupPhase==='champion'?'Campeão da Copa':cupPhaseIndex?`Copa · fase ${cupPhaseIndex}`:'Copa do Brasil',
      season:careerSeason,
    };
  };
  const buildSeasonGoalLiveContext=()=>{
    const knockout=nationalCompetitions.D?.knockout||{};
    const serieDPhase=userDivision==='D'?resolveSerieDPrizePhase(userClub,knockout):null;
    const promotedList=Array.isArray(knockout.promoted)?knockout.promoted:[];
    const promoted=userDivision==='D'&&promotedList.includes(userClub);
    let position=null,clubsCount=null,points=0,played=0,wins=0,draws=0,losses=0,goalDiff=0;
    let standingsSnapshot=[];
    if(userDivision==='D'){
      const rows=seriesDGroupRows(userSerieDGroupIndex);
      standingsSnapshot=rows.map(row=>({
        club:row.club,
        points:row.points||0,
        played:row.played||0,
        wins:row.wins||0,
        goalDiff:row.goalDiff||0,
      }));
      const index=rows.findIndex(row=>row.club===userClub);
      if(index>=0){
        const row=rows[index];
        position=index+1;
        clubsCount=rows.length;
        points=row.points||0;
        played=row.played||0;
        wins=row.wins||0;
        draws=row.draws||0;
        losses=row.losses||0;
        goalDiff=row.goalDiff||0;
      }
    }else{
      const standing=userStandingSnapshot();
      const standings=nationalCompetitions[userDivision]?.standings||[];
      standingsSnapshot=standings.map(row=>({
        club:row.club,
        points:row.points||0,
        played:row.played||0,
        wins:row.wins||0,
        goalDiff:row.goalDiff||0,
      }));
      const row=standings.find(item=>item.club===userClub);
      position=standing?.position||clubs[userClub]?.position||null;
      clubsCount=standing?.clubsCount||standings.length||20;
      if(row){
        points=row.points||0;
        played=row.played||0;
        wins=row.wins||0;
        draws=row.draws||0;
        losses=row.losses||0;
        goalDiff=row.goalDiff||0;
      }
    }
    const form=[];
    for(let index=seasonRoundHistory.length-1;index>=0&&form.length<8;index--){
      const games=seasonRoundHistory[index]?.games||[];
      const game=games.find(item=>involvesClub(item,userClub));
      if(!game||game.homeGoals==null||game.awayGoals==null)continue;
      const userHome=game.home===userClub;
      const userGoals=userHome?game.homeGoals:game.awayGoals;
      const oppGoals=userHome?game.awayGoals:game.homeGoals;
      form.unshift(userGoals>oppGoals?'W':userGoals<oppGoals?'L':'D');
    }
    return {
      club:userClub,
      position,
      clubsCount,
      points,
      played,
      wins,
      draws,
      losses,
      goalDiff,
      standings:standingsSnapshot,
      form,
      serieDPhase:serieDPhase||'group',
      promoted,
      seasonRounds:userDivision==='D'?SERIE_D_GROUP_ROUNDS:38,
      division:userDivision,
    };
  };
  const buildManagerCampaignContext=()=>{
    const standing=userStandingSnapshot();
    const goal=seasonGoal;
    if(!goal?.evaluate){
      return {shield:resolveCampaignShield({}),standing};
    }
    const live=seasonGoalLiveProgress(goal,buildSeasonGoalLiveContext());
    const goalMax=goal.evaluate?.type==='position'?Number(goal.evaluate.max)||null:null;
    return {
      shield:resolveCampaignShield({
        goalProgress:live.score,
        goalStatus:live.status,
        position:standing?.position??null,
        goalMax,
      }),
      standing,
      goalProgress:live.score,
    };
  };
  renderSeasonGoalCard=createSeasonGoalCardFeature({
    $,
    isWorldCupDashboardActive:()=>dashboardStandingsFocus()==='worldcup',
    getWorldCupDashboardCtx:()=>worldCupDashboardCtx(),
    ensureSeasonGoal,
    buildSeasonGoalLiveContext,
  });
  const allScorers=Object.values(clubs).flatMap(club=>club.roster.map(player=>({name:player.name,club:club.name,division:club.division,games:savedNewGame?0:int(9,13),goals:savedNewGame?0:int(0,8),tieValue:player.finishing+player.heading*.2}))).sort((a,b)=>b.goals-a.goals||b.tieValue-a.tieValue);
  const allAssistants=Object.values(clubs).flatMap(club=>club.roster.filter(player=>player.pos!=='GOL').map(player=>({name:player.name,club:club.name,division:club.division,games:savedNewGame?0:int(9,13),assists:savedNewGame?0:int(0,7),tieValue:player.passing+player.playmaking}))).sort((a,b)=>b.assists-a.assists||b.tieValue-a.tieValue);
  if(validSavedSeason){(savedSeason.scorers||[]).forEach(saved=>{const row=allScorers.find(item=>item.club===saved.club&&item.name===saved.name);if(row)Object.assign(row,saved);});(savedSeason.assistants||[]).forEach(saved=>{const row=allAssistants.find(item=>item.club===saved.club&&item.name===saved.name);if(row)Object.assign(row,saved);});allScorers.sort((a,b)=>b.goals-a.goals);allAssistants.sort((a,b)=>b.assists-a.assists);}
  const leadersFor=(division,mode)=>{const metric=mode==='scorers'?'goals':'assists',source=mode==='scorers'?allScorers:allAssistants;return source.filter(player=>player.division===division).sort((a,b)=>b[metric]-a[metric]||b.tieValue-a.tieValue||a.games-b.games);};
  const resolveClubForStats=name=>clubs[name]||getNationalTeamClub(name)||null;
  const clubSeasonLeaders=clubName=>{
    if(!clubName)return {scorer:{name:'—'},goals:0,assistant:{name:'—'},assists:0};
    const fromHistory=playerHistory
      ?clubSeasonLeadersFromHistory(playerHistory.getStore(),clubName,careerSeason,{getClub:resolveClubForStats})
      :null;
    const scorers=allScorers.filter(player=>player.club===clubName&&player.goals>0).sort((a,b)=>b.goals-a.goals||b.tieValue-a.tieValue||a.games-b.games);
    const assistants=allAssistants.filter(player=>player.club===clubName&&player.assists>0).sort((a,b)=>b.assists-a.assists||b.tieValue-a.tieValue||a.games-b.games);
    const scorer=fromHistory?.goals>0?fromHistory.scorer:scorers[0];
    const assistant=fromHistory?.assists>0?fromHistory.assistant:assistants[0];
    return {
      scorer:scorer||{name:'—'},
      goals:fromHistory?.goals>0?fromHistory.goals:(scorer?.goals||0),
      assistant:assistant||{name:'—'},
      assists:fromHistory?.assists>0?fromHistory.assists:(assistant?.assists||0),
    };
  };
  const dashboardStatsClub=()=>(isWorldCupDashboard()&&userNationalTeamName?userNationalTeamName:userClub);
  const championshipLeadersFor=(division,mode)=>{const metric=mode==='scorers'?'goals':'assists',source=mode==='scorers'?allScorers:allAssistants;if(division==='CUP'){const cupClubs=new Set(copaDoBrasilFixtures.flatMap(game=>[game.home,game.away]));return source.filter(player=>cupClubs.has(player.club)).sort((a,b)=>b[metric]-a[metric]||b.tieValue-a.tieValue||a.games-b.games);}return leadersFor(division,mode);};
  currentRound=validSavedSeason?savedSeason.currentRound:Math.max(...leagueData.map(row=>row.played))+1;
  const userLeaguePlayed=()=>nationalCompetitions[userDivision]?.standings?.find(row=>row.club===userClub)?.played||0;
  const userGroupStageComplete=()=>userDivision!=='D'||userLeaguePlayed()>=SERIE_D_GROUP_ROUNDS;
  const reconcileCurrentRound=()=>{
    if(!savedNewGame)return;
    const played=userLeaguePlayed();
    const histMax=(seasonRoundHistory||[]).reduce((max,entry)=>Math.max(max,entry?.round||0),0);
    const floor=Math.max(played+1,histMax+1);
    if(currentRound<floor)currentRound=floor;
    if(currentRound<=played)currentRound=played+1;
  };
  reconcileCurrentRound();
  let persistSeason=()=>{};
  let respondToIncomingTransferOffer=()=>{};
  let respondToContractRenewal=()=>{};
  let respondToNationalTeamOffer=()=>{};
  let openNationalTeamScout=()=>{};
  let maybeSendNationalTeamOffers=()=>false;
  let issueNationalTeamOfferIfDue=()=>false;
  let maybeShowNationalTeamOfferPopup=()=>false;
  let acceptNationalTeamOfferFromPopup=()=>{};
  let denyAllNationalTeamOffers=()=>{};
  const openMedicalActionFlow=()=>{
    messages.openMedicalActionMessage?.();
    processPostMatchMedicalQueue?.();
  };
  const messages=createMessagesFeature({
    $,$$,onClick,
    initialMessages:initialCareerMessages,
    getHasCareer:()=>!!savedNewGame,
    getCurrentRound:()=>currentRound,
    getCareerDateIso:()=>careerCalendarDate.toISOString(),
    getCareerDate:()=>careerCalendarDate,
    onPush:message=>bus?.emit('message:push',message),
    onMedicalActionRequired:()=>{
      // Abre leitor + modal de tratamento quando a ação médica chega.
      queueMicrotask(()=>openMedicalActionFlow());
    },
    onTransferActionRequired:message=>{
      // Durante avanço da janela: acumula sync e apresenta ao final (fila).
      if(suppressTransferOfferPopup){
        if(message?.id)pendingTransferOfferPopupIds.push(message.id);
        return;
      }
      queueMicrotask(()=>{
        messages.updateMessageBadge?.();
        // Evita abrir o leitor a cada rodada na simulação idle.
        if(seasonTransition?.isNonHumanSimRunning?.())return;
        messages.presentTransferActionMessages?.();
      });
    },
    onTransferOfferRespond:opts=>respondToIncomingTransferOffer(opts),
    onContractRenewalRespond:opts=>respondToContractRenewal(opts),
    onNationalTeamOfferRespond:opts=>respondToNationalTeamOffer(opts),
    onViewNationalTeam:code=>openNationalTeamScout(code),
    getHideClubContractMessages:()=>isWorldCupDashboard(),
    onNationalTeamActionRequired:()=>{
      queueMicrotask(()=>messages.updateMessageBadge?.());
    },
  });
  let suppressTransferOfferPopup=false;
  let pendingTransferOfferPopupIds=[];
  const pushMessage=messages.pushMessage.bind(messages);
  const renderMessages=messages.renderMessages.bind(messages);
  const renderDashboardMessagesFeed=messages.renderDashboardMessagesFeed.bind(messages);
  const updateMessageBadge=messages.updateMessageBadge.bind(messages);
  const autoMarkStaleMessages=messages.autoMarkStaleMessages.bind(messages);
  const applyDisciplineToPlayer=(player,card,round=currentRound,clubName=null,fixture=null)=>{
    if(!player||!card)return [];
    const competitionKey=fixtureCompetitionKey(fixture||liveMatchGame||{division:clubs[clubName||userClub]?.division||userDivision});
    const opponent=clubName===userClub&&fixture?fixture.home===userClub?fixture.away:fixture.home:clubName===userClub&&liveMatchGame?liveMatchGame.home===userClub?liveMatchGame.away:liveMatchGame.home:null;
    return applyDisciplineCard(player,card,{competitionKey,round,isUserClub:clubName===userClub,opponent});
  };
  const pushDisciplineDigest=(lines,round,contextLabel,fixture=null)=>{
    if(!lines.length)return;
    const shortMeta=fixture?matchdayMetaForGame(fixture):{
      competition:`Brasileirão ${userDivision}`,
      roundLabel:`Rodada ${round}`,
    };
    const opponent=String(contextLabel||'').replace(/^vs\s+/i,'').trim()||null;
    pushMessage({
      category:'discipline',
      type:'digest',
      title:'DISCIPLINA',
      body:lines.map(line=>`• ${line}`).join('\n'),
      round,
      meta:{
        competition:shortMeta.competition,
        roundLabel:shortMeta.roundLabel,
        opponent,
      },
    });
  };
  const matchAvailability=createMatchAvailability({
    getClubs:()=>clubs,
    getUserClub:()=>userClub,
    getUserSideName:()=>userSideNameForGame(liveMatchGame),
    resolveClubByName:name=>clubs[name]||getNationalTeamClub(name),
    getCurrentRound:()=>currentRound,
    recordPlayerMatchWorkload,
    roundTactic,
    applyDisciplineToPlayer,
    assignPlayerInjury,
    applyDeferredInjuryDiagnosis,
    pushDisciplineDigest,
    injuryInAcutePhase,
    injuryInRestrictedPhase,
    beginRestrictedReturn,
    advanceRestrictedRehab,
    decayPlayerWorkload,
    refreshWorkloadWindows,
    getAvailabilityCommitted:()=>availabilityCommitted,
    setAvailabilityCommitted:v=>{availabilityCommitted=v;},
    getMatchStarted:()=>matchStarted,
    getLiveMatchGame:()=>liveMatchGame,
    getMatchDiscipline:()=>matchDiscipline,
    getLiveMinutesPlayed:()=>liveMinutesPlayed,
    getLiveOpeningLineup:()=>liveOpeningLineup,
    tacticFor:(...args)=>tacticFor(...args),
  });
  const {applyMatchWorkload,applyMatchAvailability,serveAvailability,commitLiveAvailability}=matchAvailability;
  const serveDisciplineSuspensionsForRound=()=>{
    Object.entries(nationalCompetitions).forEach(([division,competition])=>{
      const fixtures=competition.fixtures?.[currentRound-1]||[];
      if(!fixtures.length)return;
      const participants=new Set(fixtures.flatMap(game=>[game.home,game.away]));
      const competitionKey=division==='D'&&currentRound>SERIE_D_GROUP_ROUNDS&&fixtures.some(isKnockoutShootoutCompetition)?'SERIE_D_KO':`LEAGUE:${division}`;
      serveCompetitionSuspensions(clubs,participants,competitionKey,currentRound);
    });
    const cupFixturesOnRound=copaDoBrasilFixtures.filter(game=>!game.completed&&game.round===currentRound);
    if(cupFixturesOnRound.length){
      const participants=new Set(cupFixturesOnRound.flatMap(game=>[game.home,game.away]));
      serveCompetitionSuspensions(clubs,participants,'COPA',currentRound);
    }
  };
  let futureMatches=championshipFixtures[currentRound-1] || championshipFixtures[0];
  const currentRoundFixtures=()=>{
    if(userDivision==='D'&&currentRound>10){
      const knockoutRound=nationalCompetitions.D.fixtures[currentRound-1];
      if(Array.isArray(knockoutRound)&&knockoutRound.length)return knockoutRound;
    }
    return championshipFixtures[currentRound-1]||[];
  };
  const fixtureTimes=['19:00','21:30','16:00','20:00'];
  const seasonStartDate=()=>new Date(careerSeason,0,1,12);
  const leagueCalendarRange=LEAGUE_CALENDAR_WINDOWS;
  const roundDateFromFixtures=(division,round)=>{
    const roundGames=nationalCompetitions[division]?.fixtures?.[round-1];
    const dated=Array.isArray(roundGames)?roundGames.find(game=>game?.date):null;
    if(dated?.date)return new Date(dated.date);
    const window=LEAGUE_CALENDAR_WINDOWS[division];
    const total=(nationalCompetitions[division]?.fixtures||[]).length;
    return window?nominalRoundDate(careerSeason,round,total,window):seasonStartDate();
  };
  const fixtureDateFor=(division,round)=>roundDateFromFixtures(division,round);
  const fixtureDateForGame=(division,game)=>{
    const parsed=parseCalendarDate(game?.date);
    if(parsed)return parsed;
    return roundDateFromFixtures(division,game?.round||1);
  };
  const fixtureDate=round=>fixtureDateFor(userDivision,round);
  let careerCalendarDate=seasonStartDate();
  careerCalendar = createCareerCalendar({
    dateHolder: careerDateHolder,
    initialDate:
      parseSavedCalendarDate(validSavedSeason && savedSeason.careerCalendarDate, null) || careerCalendarDate,
  });
  careerCalendarDate = careerCalendar.date;
  let nationalTeamOffersSentYear=validSavedSeason&&savedSeason.nationalTeamOffersSentYear!=null?Number(savedSeason.nationalTeamOffersSentYear):null;
  let nationalTeamOfferState=normalizeNationalTeamOfferState(
    validSavedSeason?savedSeason.nationalTeamOfferState:null,
    careerSeason,
  );
  let nationalTeamOffersUi=null;
  const beginCalendarBatch=()=>careerCalendar.beginCalendarBatch();
  const endCalendarBatch=()=>careerCalendar.endCalendarBatch();
  const isCalendarBatch=()=>careerCalendar.isCalendarBatch();
  const advanceCareerCalendarTo=date=>{
    careerCalendar.advanceCareerCalendarTo(date);
    careerCalendarDate=careerCalendar.date;
  };
  const sameCalendarDay=(left,right)=>careerCalendar.sameCalendarDay(left,right);
  const cupPhaseMeta=[
    {index:1,name:'1ª FASE',teams:28,twoLegged:false},
    {index:2,name:'2ª FASE',teams:88,twoLegged:false},
    {index:3,name:'3ª FASE',teams:48,twoLegged:false},
    {index:4,name:'4ª FASE',teams:24,twoLegged:false},
    {index:5,name:'5ª FASE',teams:32,twoLegged:true},
    {index:6,name:'OITAVAS DE FINAL',teams:16,twoLegged:true},
    {index:7,name:'QUARTAS DE FINAL',teams:8,twoLegged:true},
    {index:8,name:'SEMIFINAL',teams:4,twoLegged:true},
    {index:9,name:'FINAL',teams:2,twoLegged:false},
  ];
  const buildCupPhaseDefinitions=()=>{
    const nominals=buildCupPhaseNominalDates(careerSeason,{twoLegGapDays:DEFAULT_TWO_LEG_GAP_DAYS});
    return cupPhaseMeta.map(meta=>({
      ...meta,
      dates:(nominals[meta.index]||[]).map(date=>new Date(date)),
    }));
  };
  let cupPhaseDefinitions=buildCupPhaseDefinitions();
  const refreshCupPhaseNominalDates=()=>{
    const nominals=buildCupPhaseNominalDates(careerSeason,{twoLegGapDays:DEFAULT_TWO_LEG_GAP_DAYS});
    cupPhaseDefinitions.forEach(def=>{
      if(nominals[def.index])def.dates=nominals[def.index].map(date=>new Date(date));
    });
  };
  // Critérios técnicos de 2026: 102 vagas estaduais, quatro entradas especiais
  // na 3ª fase e os 20 clubes da Série A apenas na 5ª fase.
  const cupNonSerieA=Object.values(clubs).filter(club=>club.division!=='A').sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name,'pt-BR'));
  let cupSpecialEntrants=cupNonSerieA.slice(0,4).map(club=>club.name),cupStateEntrants=cupNonSerieA.slice(4,106),cupSerieAEntrants=divisionTeams.A.slice();
  let cupSecondDirect=cupStateEntrants.slice(0,74).map(club=>club.name),cupFirstRanked=cupStateEntrants.slice(-28).sort((a,b)=>b.power-a.power).map(club=>club.name);
  if(savedNewGame&&userDivision!=='A'){
    const inCupPool=name=>cupSpecialEntrants.includes(name)||cupSecondDirect.includes(name)||cupFirstRanked.includes(name);
    if(!inCupPool(userClub)){
      cupFirstRanked=[...cupFirstRanked.slice(0,Math.max(0,cupFirstRanked.length-1)),userClub];
    }
  }
  const shuffleCup=entries=>{const values=[...entries];for(let index=values.length-1;index>0;index--){const swap=int(0,index),item=values[index];values[index]=values[swap];values[swap]=item;}return values;};
  const copaDoBrasilFixtures=[];
  let nationalTeamClubsByName={};
  let nationalTeamClubsReady=null;
  const preloadNationalTeamClubs=()=>{
    if(!worldCupCompetition)return Promise.resolve();
    if(nationalTeamClubsReady)return nationalTeamClubsReady;
    nationalTeamClubsReady=(async()=>{
      try{
        const {NATIONAL_TEAMS}=await import('../engine/national-teams.js');
        const {loadWorldCupSquads,getWorldCupTeam}=await import('../engine/world-cup-squads.js');
        const data=await loadWorldCupSquads();
        const byName={};
        Object.values(NATIONAL_TEAMS).forEach(meta=>{
          const team=getWorldCupTeam(data,meta.code);
          if(!team?.players?.length)return;
          const strength=worldCupCompetition?.teamStrength?.[meta.code];
          const club=buildNationalTeamClub(meta,team,{teamPower:strength?.teamPower});
          if(club)byName[meta.name]=club;
        });
        nationalTeamClubsByName=byName;
      }catch(error){
        console.warn('[brfut] elencos seleção (cache)',error);
      }
    })();
    return nationalTeamClubsReady;
  };
  const getNationalTeamClub=name=>{
    const meta=resolveNationalTeam(name);
    return meta?nationalTeamClubsByName[meta.name]||null:null;
  };
  let worldCupCompetition=isWorldCupSeasonActive(careerSeason)
    ?createWorldCupCompetition({
      year:careerSeason,
      worldCupHistory:savedNewGame?.worldCupHistory||[],
      random:gameRandom,
      saved:validSavedSeason?savedSeason.worldCupCompetition:null,
    })
    :null;
  const worldCupFixtures=[];
  const refreshWorldCupFixtures=()=>{
    worldCupFixtures.length=0;
    if(worldCupCompetition)worldCupFixtures.push(...getWorldCupAllFixtures(worldCupCompetition));
  };
  refreshWorldCupFixtures();
  preloadNationalTeamClubs();
  let advanceWorldCupThroughDateLocal=()=>false;
  let onCupScheduleChanged=()=>{};
  const restoredCup=validSavedSeason&&savedSeason.cupCompetition?.stages?.length?savedSeason.cupCompetition:null;
  const cupCompetition=restoredCup?{currentPhase:restoredCup.currentPhase||1,champion:restoredCup.champion||null,stages:restoredCup.stages.map(stage=>({...stage,fixtures:(stage.fixtures||[]).map(game=>({...game,date:new Date(game.date)}))}))}:{currentPhase:1,champion:null,stages:[]};
  let cupGameNumber=Math.max(0,...(cupCompetition.stages||[]).flatMap(stage=>(Array.isArray(stage?.fixtures)?stage.fixtures:[]).map(game=>game.gameNumber||0)))+1;
  const priorSeasonChampions=savedNewGame?.priorSeasonChampions||savedSeason?.priorSeasonChampions||null;
  const restoredRecopa=validSavedSeason&&savedSeason.recopaCompetition?savedSeason.recopaCompetition:null;
  let recopaCompetition=restoreRecopaNational(restoredRecopa,careerSeason);
  if(isRecopaNationalEnabled()&&!recopaCompetition.complete&&priorSeasonChampions&&Number(priorSeasonChampions.season)===careerSeason-1){
    materializeRecopaNational(recopaCompetition,{seasonYear:careerSeason,priorChampions:priorSeasonChampions});
  }
  const recopaFixtures=[];
  const refreshRecopaFixtures=()=>{recopaFixtures.length=0;recopaFixtures.push(...recopaNationalFixtures(recopaCompetition));};
  refreshRecopaFixtures();
  const cupGameNumberHolder={value:cupGameNumber};
  const cupCalendar=createCupCalendarEngine({
    getCupCompetition:()=>cupCompetition,
    cupGameNumberHolder,
    getCopaDoBrasilFixtures:()=>copaDoBrasilFixtures,
    getRecopaCompetition:()=>recopaCompetition,
    refreshRecopaFixtures,
    getNationalCompetitions:()=>nationalCompetitions,
    getCareerSeason:()=>careerSeason,
    getCareerCalendarDate:()=>careerCalendarDate,
    getFixtureTimes:()=>fixtureTimes,
    seasonStartDate,
    getCupPhaseDefinitions:()=>cupPhaseDefinitions,
    refreshCupPhaseNominalDates,
    getClubs:()=>clubs,
    shuffleCup,
    onCupScheduleChanged:()=>onCupScheduleChanged(),
  });
  cupGameNumber=cupGameNumberHolder.value;
  const {
    leagueScheduleMaterializedFresh,
    refreshCopaDoBrasilFixtures,
    rescheduleAllCupFixtures,
    calendarIntervalLabel,
    createCupStage,
    bootstrapSavedCupStages,
    calculateRestConflicts,
  }=cupCalendar;
  bootstrapSavedCupStages();
  const knockoutShootoutSanitized=sanitizeKnockoutShootoutSave({cupCompetition,serieDFixtures:nationalCompetitions.D.fixtures});
  let restConflictCount=0;
  const fixtureDetails=createFixtureDetailsResolver({
    getCareerSeason:()=>careerSeason,
    getChampionshipFixtures:()=>championshipFixtures,
    getFixtureTimes:()=>fixtureTimes,
    fixtureDate,
    seasonStartDate,
  });
  const {
    invalidateUserScheduleCache,
    isUserFixture,
    isFixtureCompleted,
    userKnockoutFixtures,
    userSchedule,
    pendingUserSchedule,
    lastCompletedUserEntry,
    leagueUserGameForRound,
    nextPendingUserEntry,
    daysUntilNextFixtureFromToday,
    restDaysUntilNextFixture,
    intervalDaysForRoundAdvance,
    ensureCalendarMatchConsistency,
    fixtureResultLabel,
    isPendingFixtureOverdue,
  }=createUserScheduleEngine({
    fixtureDetails,
    getUserClub:()=>userClub,
    getUserDivision:()=>userDivision,
    getUserNationalTeamName:()=>userNationalTeamName,
    getChampionshipFixtures:()=>championshipFixtures,
    getCopaDoBrasilFixtures:()=>copaDoBrasilFixtures,
    getRecopaFixtures:()=>recopaFixtures,
    getWorldCupCompetition:()=>worldCupCompetition,
    getWorldCupAllFixtures,
    getStateLeagueEngine:()=>stateLeagueEngine,
    getSavedNewGame:()=>savedNewGame,
    getSeasonRoundHistory:()=>seasonRoundHistory,
    userLeaguePlayed,
    userGroupStageComplete,
    getNationalCompetitionsD:()=>nationalCompetitions.D,
    getCareerCalendarDate:()=>careerCalendarDate,
    advanceCareerCalendarTo,
    rescheduleAllCupFixtures,
  });
  const clubCrestInitials=teamCrestInitials;
  /** Badge de divisão só no chaveamento da Copa (evita poluir tabelas/listas). */
  const cupClubLabel=(name,opts)=>clubLabelHtml(name,{clubs,userClub,userDivision},opts);
  const matchVenueFor=homeClubName=>{
    if(homeClubName===userClub){
      const userVenue=ensureStadium(clubs[userClub],userDivision);
      return {name:userVenue?.name||'Estádio Solar',capacity:userVenue?.capacity||42000};
    }
    const club=clubs[homeClubName],seed=[...homeClubName].reduce((sum,char)=>sum+char.charCodeAt(0),0)+(club?.power||70)*17,capacity=Math.round((18000+(seed%52000))/1000)*1000,lastWord=homeClubName.split(' ').filter(Boolean).pop()||homeClubName;
    return {name:`Estádio ${lastWord}`,capacity};
  };
  /** Lotação do dia — Ambiente, preço, fase e ruído do fixture (AO VIVO e bilheteria). */
  const buildAttendanceContext=(game,homeDivision)=>{
    const div=homeDivision||userDivision;
    const competition=nationalCompetitions[div];
    const relegation=Number(divisionRules?.[div]?.relegation)||4;
    return {
      standings:competition?.standings||[],
      seasonRounds:div==='D'?SERIE_D_GROUP_ROUNDS:38,
      currentRound:game?.round??currentRound,
      relegationZone:Math.max(0,relegation),
      division:div,
    };
  };
  const resolveMatchAttendance=game=>{
    if(!game?.home||!clubs[game.home])return null;
    const homeClub=clubs[game.home];
    const homeDivision=homeClub.division||userDivision;
    const venue=matchVenueFor(game.home);
    if(game.home!==userClub){
      ensureStadium(homeClub,homeDivision);
      homeClub.stadiumCapacity=venue.capacity;
    }
    return attachMatchAttendance(homeClub,game,{
      division:homeDivision,
      capacity:game.home===userClub?(homeClub.stadiumCapacity||venue.capacity):venue.capacity,
      attendanceContext:buildAttendanceContext(game,homeDivision),
    });
  };
  const formatVenueCrowdLine=game=>{
    const venue=matchVenueFor(game.home);
    const crowd=resolveMatchAttendance(game);
    const homeTag=game.home===userClub?'EM CASA':'FORA';
    const parts=[homeTag,venue.name];
    if(crowd){
      parts.push(crowd.attendance.toLocaleString('pt-BR'));
      parts.push(`${Math.round(crowd.fillRate*100)}%`);
    }
    if(game.home===userClub&&clubs[userClub]){
      const gateAmount=Number.isFinite(Number(game.gateRevenue))
        ?Number(game.gateRevenue)
        :Math.round(estimateGateReceipt(clubs[userClub],{
          channel:game.competition==='COPA DO BRASIL'?'cups':'national',
          division:userDivision,
        }).revenue||0);
      if(gateAmount>0)parts.push(`Renda ${formatBudget(gateAmount)}`);
    }
    return parts.join(' · ');
  };
  const isUserHomeMatch=game=>!!game&&game.home===userClub&&game.away!==userClub;
  const crowdEntryKey=entry=>`${entry.home}|${entry.away}|${entry.round??''}|${entry.leg??''}|${entry.phase??''}|${entry.competition??''}`;
  const crowdCompetitionLabel=game=>{
    if(isStateLeagueGame(game))return `${stateLeagueBadgeName(game)} · ${stateLeaguePhaseLabel(game)}`;
    if(game?.competition==='COPA DO BRASIL')return `Copa · ${game.phase||''}${game.leg?` · ${game.leg}`:''}`.replace(/\s·\s$/,'').trim();
    if(isKnockoutShootoutCompetition(game))return `Série D · ${joinMatchMeta(serieDKnockoutPhaseLabel(game),game.leg)}`;
    return `Rodada ${game?.round??currentRound}`;
  };
  const upsertUserSeasonCrowd=entry=>{
    if(!entry||entry.home!==userClub)return;
    const attendance=Math.round(Number(entry.attendance));
    if(!Number.isFinite(attendance)||attendance<=0)return;
    const normalized={
      home:entry.home,
      away:entry.away||entry.opponent||'—',
      attendance,
      fillRate:Number.isFinite(Number(entry.fillRate))?Number(entry.fillRate):null,
      gateRevenue:Number.isFinite(Number(entry.gateRevenue))?Number(entry.gateRevenue):null,
      competition:entry.competition||null,
      label:entry.label||crowdCompetitionLabel(entry)||'Jogo em casa',
      phase:entry.phase||null,
      leg:entry.leg||null,
      round:entry.round??null,
    };
    const key=crowdEntryKey(normalized);
    const index=userSeasonCrowds.findIndex(item=>crowdEntryKey(item)===key);
    if(index>=0)userSeasonCrowds[index]={...userSeasonCrowds[index],...normalized};
    else userSeasonCrowds.push(normalized);
  };
  const recordUserHomeCrowd=(game,gateResult=null)=>{
    if(!isUserHomeMatch(game))return;
    const crowd=Number.isFinite(Number(game.attendance))
      ?{attendance:Number(game.attendance),fillRate:game.fillRate}
      :resolveMatchAttendance(game);
    if(!crowd||!Number.isFinite(Number(crowd.attendance)))return;
    upsertUserSeasonCrowd({
      home:game.home,
      away:game.away,
      attendance:crowd.attendance,
      fillRate:crowd.fillRate,
      gateRevenue:gateResult?.ok?gateResult.entry?.amount:game.gateRevenue,
      competition:game.competition||'LEAGUE',
      label:crowdCompetitionLabel(game),
      phase:game.phase||null,
      leg:game.leg||null,
      round:game.round??null,
    });
  };
  const creditUserHomeGate=game=>{
    // Só mando de campo — visitante nunca recebe bilheteria.
    if(!isUserHomeMatch(game)||!clubs[userClub])return null;
    const venue=matchVenueFor(userClub);
    const userStadium=ensureStadium(clubs[userClub],userDivision);
    const result=creditHomeGate(clubs[userClub],game,{
      division:userDivision,
      capacity:userStadium?.capacity||clubs[userClub].stadiumCapacity||venue.capacity,
      attendanceContext:buildAttendanceContext(game,userDivision),
    });
    // TV do pool da série: só mando nacional (Copa é ignorada em creditHomeTv).
    creditHomeTv(clubs[userClub],game,{division:userDivision,season:careerSeason});
    if(result?.ok){
      recordUserHomeCrowd(game,result);
      renderClubBudget();
      economyUi?.renderOffice?.();
      persistSeason();
    }
    return result;
  };
  /** Credita parcela de TV para o mandante de cada jogo nacional (jogador e IA). */
  const creditLeagueHomeTvForGames=(games,division=null)=>{
    if(!Array.isArray(games)||!games.length)return;
    games.forEach(game=>{
      if(!game?.home||!clubs[game.home])return;
      if(game.competition==='COPA DO BRASIL'||game.competition===KNOCKOUT_COMPETITIONS.COPA)return;
      const club=clubs[game.home];
      const div=division||club.division||userDivision;
      creditHomeTv(club,game,{division:div,season:careerSeason});
    });
  };
  /** Resultado da partida + público/bilheteria (mando de campo) numa única mensagem. */
  const pushUserMatchResultMessage=(game,gateResult=null)=>{
    if(!game||roundResultMessagePushed)return;
    if(game.home!==userClub&&game.away!==userClub)return;
    roundResultMessagePushed=true;
    const userAtHome=isUserHomeMatch(game);
    const calendarScores=(()=>{
      if(Number.isFinite(Number(game.homeGoals))&&Number.isFinite(Number(game.awayGoals))){
        return {home:Number(game.homeGoals),away:Number(game.awayGoals)};
      }
      return calendarLiveScores();
    })();
    const homeGoals=calendarScores.home,awayGoals=calendarScores.away;
    const userGoals=userAtHome?homeGoals:awayGoals;
    const oppGoals=userAtHome?awayGoals:homeGoals;
    const outcome=userGoals>oppGoals?'Vitória':userGoals<oppGoals?'Derrota':'Empate';
    const scoreLabel=game.penalties
      ? `${homeGoals}—${awayGoals} (${game.penalties})`
      : `${homeGoals}—${awayGoals}`;
    const crowd=resolveMatchAttendance(game);
    const lines=[
      `${game.home} ${scoreLabel} ${game.away}`,
      `${outcome} · ${competitionLabelForGame(game)}`,
    ];
    if(crowd){
      lines.push(`Público: ${crowd.attendance.toLocaleString('pt-BR')} (${Math.round(crowd.fillRate*100)}% lotação)`);
    }
    if(userAtHome&&gateResult?.ok&&gateResult.entry?.amount>0){
      lines.push(`Bilheteria (casa): +${formatBudget(gateResult.entry.amount)} · caixa ${formatBudget(gateResult.balance)}`);
    }
    if(userAtHome)recordUserHomeCrowd(game,gateResult);
    const resultMeta=matchdayMetaForGame(game);
    pushMessage({
      category:'competition',
      type:'match-result',
      title:'RESULTADO DA PARTIDA',
      body:lines.join('\n'),
      round:currentRound,
      meta:{
        competition:resultMeta.competition,
        roundLabel:resultMeta.roundLabel,
        outcome,
        home:game.home,
        away:game.away,
        homeGoals,
        awayGoals,
        attendance:crowd?.attendance??null,
        fillRate:crowd?.fillRate??null,
        gateRevenue:gateResult?.ok?gateResult.entry.amount:null,
      },
    });
  };
  const fixtureCompetitionLabel=game=>{if(game.competition==='COPA DO BRASIL')return `Copa ${game.leg}`;if(isKnockoutShootoutCompetition(game))return `Série D · ${game.leg||'Eliminatórias'}`;return `${game.round}ª`;};
  advanceWorldCupThroughDateLocal=date=>{
    if(!worldCupCompetition||!date)return false;
    const changed=advanceWorldCupThroughDate(worldCupCompetition,date,{
      random:gameRandom,
      isUserTeam:game=>game.competition===WORLD_CUP_COMPETITION&&isUserFixture(game),
    });
    if(changed)refreshWorldCupFixtures();
    return changed;
  };
  isWorldCupDashboard=()=>dashboardStandingsFocus()==='worldcup';
  dashboardStandingsFocus=()=>resolveDashboardStandingsFocus({
    pendingUserSchedule:pendingUserSchedule(),
    nextPendingEntry:nextPendingUserEntry(),
    userNationalTeamName,
    userClub,
    careerCalendarDate,
    sameCalendarDay,
  });
  worldCupDashboardCtx=()=>{
    if(dashboardStandingsFocus()!=='worldcup'||!worldCupCompetition)return null;
    return buildWorldCupDashboardGoalContext({
      competition:worldCupCompetition,
      userNationalTeamName,
      userNationalTeamCode,
      getNationalTeamClub,
      random:gameRandom,
    });
  };
  if(!cupCompetition.stages.length&&cupFirstRanked.length===28)createCupStage(1,cupFirstRanked);
  else rescheduleAllCupFixtures();
  restConflictCount=calculateRestConflicts();
  if(restConflictCount)console.warn(`Calendário gerado com ${restConflictCount} conflito(s) de descanso.`);
  const seasonMaxRound=()=>userDivision==='D'?22:38;
  const seasonComplete=()=>currentRound>seasonMaxRound();
  const hasPendingUserFixtures=()=>pendingUserSchedule().length>0;
  const dashboardLeagueRoundLabel=()=>{
    if(dashboardStandingsFocus()==='worldcup'){
      const ctx=worldCupDashboardCtx();
      return ctx?.groupLetter?`GRUPO ${ctx.groupLetter} · COPA DO MUNDO`:'COPA DO MUNDO';
    }
    const max=seasonMaxRound();
    if(currentRound>max&&hasPendingUserFixtures()){
      const cupEntry=pendingUserSchedule().find(entry=>entry.game.competition==='COPA DO BRASIL');
      if(cupEntry)return `COPA · ${cupEntry.game.phase||'DO BRASIL'}`;
      return 'PÓS-TEMPORADA';
    }
    return `RODADA ${Math.min(currentRound,max)}`;
  };
  /** Nacional encerrado e sem partidas do usuário (inclui Copa) — UI de temporada fechada. */
  const seasonFullyComplete=()=>seasonComplete()&&!hasPendingUserFixtures();
  const isUserSeasonIdle=()=>!!savedNewGame&&!pendingUserSchedule().length&&!seasonComplete();
  let calendarBootRepaired=false;
  if(validSavedSeason){
    const played=userLeaguePlayed();
    const atSeasonStart=sameCalendarDay(careerCalendarDate,seasonStartDate());
    const lastCompleted=userSchedule().filter(entry=>isFixtureCompleted(entry.game)).pop();
    const nextPending=nextPendingUserEntry();
    const progressDate=lastCompleted?.details?.date
      ??nextPending?.details?.date
      ??(played>0||currentRound>1?fixtureDate(Math.max(1,Math.max(played,currentRound-1))):null);
    if(!savedSeason.careerCalendarDate){
      if(progressDate){
        advanceCareerCalendarTo(progressDate);
        calendarBootRepaired=true;
      }
    }else if(lastCompleted?.details?.date&&careerCalendarDate.getTime()<lastCompleted.details.date.getTime()){
      advanceCareerCalendarTo(lastCompleted.details.date);
      calendarBootRepaired=true;
    }else if(atSeasonStart&&(played>0||currentRound>1)&&progressDate){
      advanceCareerCalendarTo(progressDate);
      calendarBootRepaired=true;
    }
    ensureCalendarMatchConsistency();
  }
  let userUpcomingGames=[];
  const refreshUserFixtures=()=>{
    userUpcomingGames=pendingUserSchedule().slice(0,5).map(entry=>entry.game);
    nextUserGame=nextPendingUserEntry()?.game||null;
  };
  let rosterSort={key:'pos',dir:'asc'};
  let rosterFilters={pos:'',foot:'',personality:''};
  const playerRenameCallbacks={syncCareerRosters:()=>{},renderTacticRoster:()=>{}};
  const playerRename=createPlayerRenameFeature({
    playerNameCell,
    getUserClub:()=>userClub,
    getCareerSeason:()=>careerSeason,
    getRoster:()=>clubs[userClub]?.roster||squad,
    canRenamePlayer:()=>!(matchStarted&&!matchFinished),
    onRenamed:()=>{
      playerRenameCallbacks.syncCareerRosters();
      renderRoster();
      playerRenameCallbacks.renderTacticRoster();
      playerRename.focusActiveInput();
    },
  });
  const rosterSortValue=(p,key)=>{
    switch(key){
      case 'name':return String(p.name||'');
      case 'pos':return String(p.pos||'');
      case 'age':return Number(p.age)||0;
      case 'height':return Number(p.height)||0;
      case 'foot':return String(p.preferredFoot||'');
      case 'personality':return String(p.personality||'');
      case 'ovr':return Number(p.overall)||0;
      case 'speed':return Number(p.speed)||0;
      case 'dribble':return Number(p.dribble)||0;
      case 'marking':return Number(p.marking)||0;
      case 'tackling':return Number(p.tackling)||0;
      case 'heading':return Number(p.heading)||0;
      case 'finishing':return Number(p.finishing)||0;
      case 'passing':return Number(p.passing)||0;
      case 'playmaking':return Number(p.playmaking)||0;
      case 'freeKick':return Number(p.freeKick)||0;
      case 'penaltyTaking':return Number(p.penaltyTaking)||0;
      case 'positioning':return Number(p.positioning)||0;
      case 'penaltySaving':return Number(p.penaltySaving)||0;
      case 'reflexes':return Number(p.reflexes)||0;
      case 'fatigue':return Number(p.fatigue)||0;
      case 'trainingXp':{
        const id=resolvePlayerId(p)||playerKey(p)||historyPlayerKey(p);
        return Number(getTrainingProgressForPlayer(playerDevelopment,id)?.xpSeason)||0;
      }
      default:return 0;
    }
  };
  const syncRosterFilterOptions=()=>{
    const fill=(sel,values,allLabel,current)=>{
      if(!sel)return;
      const opts=['<option value="">'+allLabel+'</option>']
        .concat([...values].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(v=>`<option value="${v}">${v}</option>`));
      sel.innerHTML=opts.join('');
      sel.value=[...sel.options].some(o=>o.value===current)?current:'';
    };
    const pos=new Set(),foot=new Set(),personality=new Set();
    squad.forEach(p=>{
      if(p.pos)pos.add(p.pos);
      if(p.preferredFoot)foot.add(p.preferredFoot);
      if(p.personality)personality.add(p.personality);
    });
    fill($('#rosterFilters [data-roster-filter="pos"]'),pos,'Todas',rosterFilters.pos);
    fill($('#rosterFilters [data-roster-filter="foot"]'),foot,'Todos',rosterFilters.foot);
    fill($('#rosterFilters [data-roster-filter="personality"]'),personality,'Todos',rosterFilters.personality);
  };
  const ROSTER_ATTR_KEYS_OUTFIELD=['speed','dribble','marking','tackling','heading','finishing','passing','playmaking','freeKick','penaltyTaking'];
  /** Top 3 atributos do jogador (GOL prioriza stats de goleiro; linha usa campo). */
  const topRosterAttrKeys=(player,limit=3)=>{
    const keys=player?.pos==='GOL'
      ?['positioning','penaltySaving','reflexes','passing','speed','dribble','marking','tackling','heading','finishing','playmaking','freeKick','penaltyTaking']
      :ROSTER_ATTR_KEYS_OUTFIELD;
    return new Set(
      keys
        .map(key=>({key,value:Number(player?.[key])}))
        .filter(row=>Number.isFinite(row.value)&&row.value>0)
        .sort((a,b)=>b.value-a.value||a.key.localeCompare(b.key))
        .slice(0,limit)
        .map(row=>row.key),
    );
  };
  const rosterAttrCell=(player,key,groupClass,display,topKeys)=>{
    const top=topKeys.has(key);
    return `<span class="${groupClass}${top?' is-top-attr':''}">${display}</span>`;
  };
  /** HTML da seta de OVR — preenchido após init de playerDevelopment. */
  let playerDevelopment=null;
  let rosterOvrMarkHtml=()=> '';
  /** HTML da coluna XP de treino — preenchido após init de playerDevelopment. */
  let rosterTrainingXpHtml=()=> '';
  let scanUserRosterChangeAlerts=()=>{};
  let updateSquadChangeNavBadge=()=>{};
  const rosterContracts=createRosterContractsFeature({
    $,
    $$,
    onClick,
    getSquad:()=>squad,
    getUserDivision:()=>userDivision,
    getCareerDate:()=>careerCalendarDate,
    onRenewalRespond:opts=>respondToContractRenewal(opts),
  });
  const renderRoster=()=>{
    try{scanUserRosterChangeAlerts();}catch{/* boot */}
    const list=$('#playerList');
    if(!list)return;
    syncRosterFilterOptions();
    let rows=squad.slice();
    if(rosterFilters.pos)rows=rows.filter(p=>p.pos===rosterFilters.pos);
    if(rosterFilters.foot)rows=rows.filter(p=>p.preferredFoot===rosterFilters.foot);
    if(rosterFilters.personality)rows=rows.filter(p=>p.personality===rosterFilters.personality);
    const dir=rosterSort.dir==='asc'?1:-1;
    const key=rosterSort.key;
    rows.sort((a,b)=>{
      const va=rosterSortValue(a,key),vb=rosterSortValue(b,key);
      if(typeof va==='string'||typeof vb==='string'){
        return String(va).localeCompare(String(vb),'pt-BR')*dir||String(a.name||'').localeCompare(String(b.name||''),'pt-BR');
      }
      return (va-vb)*dir||String(a.name||'').localeCompare(String(b.name||''),'pt-BR');
    });
    list.innerHTML=rows.map(p=>{
      const top=topRosterAttrKeys(p);
      ensurePlayerContract(p,{division:userDivision,careerDate:careerCalendarDate,season:careerSeason});
      const contractTone=contractUiTone(p,careerCalendarDate);
      const contractClass=
        contractTone==='warning'?' roster-contract-warning':
        contractTone==='critical'?' roster-contract-critical':
        contractTone==='expired'?' roster-contract-expired':'';
      const changeId=resolvePlayerId(p)||playerKey(p)||historyPlayerKey(p);
      const changeAlert=playerDevelopment?getActiveRosterChangeAlert(playerDevelopment,changeId,careerCalendarDate):null;
      const changeClass=rosterChangeRowClass(changeAlert);
      return `<div class="player-row roster-expanded${contractClass}${changeClass?` ${changeClass}`:''}">
      <span>${playerRename.renderNameCell(p,{showLoan:true,clubName:userClub,allowRename:true})}</span>
      <span class="badge">${p.pos}</span>
      <span>${p.age}</span>
      <span class="roster-ovr roster-col-ovr">${p.overall}${rosterOvrMarkHtml(p)}</span>
      <span>${p.height?`${p.height} cm`:'—'}</span>
      <span class="roster-foot-col">${renderTableFootIcon(p)}</span>
      <span>${p.personality||'—'}</span>
      ${rosterAttrCell(p,'speed','roster-group-phys',p.speed,top)}
      ${rosterAttrCell(p,'dribble','roster-group-phys',p.dribble,top)}
      ${rosterAttrCell(p,'marking','roster-group-def',p.marking,top)}
      ${rosterAttrCell(p,'tackling','roster-group-def',p.tackling,top)}
      ${rosterAttrCell(p,'heading','roster-group-def',p.heading,top)}
      ${rosterAttrCell(p,'finishing','roster-group-atk',p.finishing,top)}
      ${rosterAttrCell(p,'passing','roster-group-atk',p.passing,top)}
      ${rosterAttrCell(p,'playmaking','roster-group-atk',p.playmaking,top)}
      ${rosterAttrCell(p,'freeKick','roster-group-set',p.freeKick,top)}
      ${rosterAttrCell(p,'penaltyTaking','roster-group-set',p.penaltyTaking,top)}
      ${rosterAttrCell(p,'positioning','roster-group-gk',outfield(p.positioning),top)}
      ${rosterAttrCell(p,'penaltySaving','roster-group-gk',outfield(p.penaltySaving),top)}
      ${rosterAttrCell(p,'reflexes','roster-group-gk',outfield(p.reflexes),top)}
      ${rosterTrainingXpHtml(p)}
      <span>${rosterFatigueCell(p)}</span>
    </div>`;
    }).join('');
    playerRename.focusActiveInput();
    $$('#rosterHead [data-roster-sort]').forEach(btn=>{
      const active=btn.dataset.rosterSort===rosterSort.key;
      btn.classList.toggle('is-sorted',active);
      btn.classList.toggle('is-asc',active&&rosterSort.dir==='asc');
      btn.classList.toggle('is-desc',active&&rosterSort.dir==='desc');
    });
    rosterContracts.updateButtonBadge?.();
    try{updateSquadChangeNavBadge();}catch{/* boot */}
    const contractModal=$('#rosterContractModal');
    if(contractModal&&!contractModal.classList.contains('hidden')){
      rosterContracts.render?.();
    }
  };
  onClick('#rosterHead',event=>{
    const sortBtn=event.target.closest('[data-roster-sort]');
    if(!sortBtn)return;
    const key=sortBtn.dataset.rosterSort;
    if(rosterSort.key===key)rosterSort.dir=rosterSort.dir==='asc'?'desc':'asc';
    else{
      rosterSort.key=key;
      rosterSort.dir=['name','pos','foot','personality'].includes(key)?'asc':'desc';
    }
    renderRoster();
  });
  on('#rosterFilters','change',event=>{
    const sel=event.target.closest('[data-roster-filter]');
    if(!sel)return;
    const kind=sel.getAttribute('data-roster-filter');
    if(kind==='pos'||kind==='foot'||kind==='personality'){
      rosterFilters[kind]=sel.value||'';
      renderRoster();
    }
  });
  playerRename.bindHandlers('#squad');
  rosterContracts.bindHandlers();
  renderRoster();
  const leagueRow=(row,index)=>`<div class="league-row ${row.club === userClub ? 'highlight' : ''}" data-club="${row.club}" role="button" tabindex="0"><span>${userDivision==='D'?index+1:clubs[row.club].position}</span><span class="club-link">${row.club}</span><span>${row.played}</span><span>${row.wins}</span><span>${row.draws}</span><span>${row.losses}</span><span>${row.goalDiff>=0?'+':''}${row.goalDiff}</span><span>${row.points}</span></div>`;
  // leagueTable preenchido por renderChampionshipPage após helpers de fase.
  $('.upcoming-dashboard label em').textContent=dashboardLeagueRoundLabel();
  rankingViews=createRankingViewsFeature({
    $,
    on,
    onClick,
    getUserClub:()=>userClub,
    getCareerProfile:()=>careerProfile,
    getManagerRanking:()=>managerRanking,
    getManagerRankingHelpers:managerRankingHelpers,
    getNationalRankingEntries:()=>nationalRankingEntries,
    getClubs:()=>clubs,
    getNationalCompetitions:()=>nationalCompetitions,
    getCareerSeason:()=>careerSeason,
    getNationalRankingFinalizedSeasons:()=>nationalRankingFinalizedSeasons,
    getCupChampion:()=>cupCompetition.champion,
    getCareerSeed:()=>savedNewGame?.seed??0,
    estimateStaffBill,
    formatBudget,
    getUserClubInitials:()=>clubInitials,
  });
  rankingViews.bindHandlers();
  rankingViews.renderNationalRanking();
  rankingViews.renderManagerRanking();
  const router=createRouter({ $$, onClick });
  openNavView=viewId=>router.openView(viewId);
  router.onView('ranking',()=>rankingViews.renderNationalRanking());
  router.onView('managers',()=>rankingViews.renderManagerRanking());
  router.onView('messages',renderMessages);
  router.bindNav();
  messages.bindHandlers({ openView:viewId=>router.openView(viewId) });
  if(savedNewGame&&!messages.getMessages().length)pushMessage({category:'club',type:'welcome',title:'Nova temporada',body:`${userClub} inicia a temporada ${careerSeason} na Série ${userDivision}. A jornada começa em 1º de janeiro; os campeonatos seguem o calendário nacional da CBF.`,round:currentRound,read:true});
  if(savedNewGame?.cascadeVictimPendingReveal&&savedNewGame?.replacedHostClub){
    const hostDiv=savedNewGame.hostDivision||careerHostMeta?.hostDivision||userDivision;
    pushMessage({
      category:'club',
      type:'cascade-victim',
      title:'Vaga na pirâmide',
      body:`${savedNewGame.replacedHostClub} (${hostDiv}) cedeu lugar a ${userClub}. A reorganização em cascata já foi aplicada na pirâmide nacional.`,
      round:currentRound,
      read:false,
    });
    savedNewGame.cascadeVictimPendingReveal=false;
    persistCareer({...savedNewGame});
  }
  renderSeasonGoalCard();
  if(savedNewGame&&seasonGoalJustCreated&&seasonGoal){
    pushMessage({category:'club',type:'season-goal',title:'META DA TEMPORADA',body:`A diretoria definiu a expectativa para ${careerSeason}: ${seasonGoal.label}.`,round:currentRound,read:false});
    seasonGoalJustCreated=false;
  }
  autoMarkStaleMessages();
  updateMessageBadge();renderDashboardMessagesFeed();
  // Retoma ação médica pendente (badge vermelho + janelas).
  if(savedNewGame&&(messages.getMedicalActionMessages?.().length||postMatchMedicalQueue.length||pendingTreatmentDecision)){
    queueMicrotask(()=>openMedicalActionFlow());
  }
  let seasonCalendarFixtures=[
    ...(FEATURES.stateLeague&&savedNewGame?stateLeagueEngine.allFixturesFlat():[]),
    ...championshipFixtures.flat(),
    ...copaDoBrasilFixtures,
    ...recopaFixtures,
    ...worldCupFixtures,
  ].sort((a,b)=>fixtureDetails(a).date-fixtureDetails(b).date);
  const calendarKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const calendarDate=key=>{const [year,month,day]=key.split('-').map(Number);return new Date(year,month-1,day,12);};
  const matchBriefAlreadySent=briefKey=>messages.getMessages().some(message=>message.meta?.briefKey===briefKey);
  const opponentForGame=game=>game.home===userClub?game.away:game.home;
  const competitionLabelForGame=game=>isStateLeagueGame(game)?`${stateLeagueBadgeName(game)} · ${stateLeaguePhaseLabel(game)}`:game.competition===RECOPA_NATIONAL_COMPETITION?'Recopa Nacional · Final':game.competition==='COPA DO BRASIL'?`Copa do Brasil · ${game.phase||game.leg||''}`:isKnockoutShootoutCompetition(game)?`Série D · ${game.leg||'Eliminatórias'}`:`Brasileirão Série ${userDivision} · Rodada ${game.round??currentRound}`;
  const matchdayMetaForGame=game=>{
    if(isStateLeagueGame(game)){
      return {
        competition:stateLeagueBadgeName(game),
        roundLabel:stateLeaguePhaseLabel(game),
      };
    }
    if(game.competition===RECOPA_NATIONAL_COMPETITION){
      return {competition:'Recopa Nacional',roundLabel:game.phase||'Final'};
    }
    if(game.competition==='COPA DO BRASIL'){
      return {
        competition:'Copa do Brasil',
        roundLabel:[game.phase,game.leg].filter(Boolean).join(' · ')||'Copa',
      };
    }
    if(isKnockoutShootoutCompetition(game)){
      return {competition:'Brasileirão D',roundLabel:game.leg||'Eliminatórias'};
    }
    return {
      competition:`Brasileirão ${userDivision}`,
      roundLabel:`Rodada ${game.round??currentRound}`,
    };
  };
  const pushMatchDayBrief=game=>{
    if(!game)return;
    const opponent=opponentForGame(game),details=fixtureDetails(game),briefKey=`brfut-${game.home}-${game.away}-${calendarKey(details.date)}`;
    if(matchBriefAlreadySent(briefKey))return;
    const leaders=clubSeasonLeaders(opponent),venue=game.home===userClub?'Casa':'Fora';
    const day=String(details.date.getDate()).padStart(2,'0');
    const month=String(details.date.getMonth()+1).padStart(2,'0');
    const meta=matchdayMetaForGame(game);
    const body=[
      `${day}/${month} · ${details.time} · ${venue}.`,
      '',
      `Destaques do adversário: artilheiro ${leaders.scorer.name} (${leaders.goals} gols) · assistências ${leaders.assistant.name} (${leaders.assists}).`,
    ].join('\n');
    pushMessage({
      category:'competition',
      type:'matchday',
      title:'JOGO DO DIA',
      body,
      round:currentRound,
      meta:{competition:meta.competition,roundLabel:meta.roundLabel,briefKey,opponent},
    });
  };
  const pushSeasonEndBrief=({prizeTotal=0,budgetAfter=null}={})=>{
    const row=nationalCompetitions[userDivision]?.standings?.find(item=>item.club===userClub),position=displayedClubPosition(userClub);
    const prizeLine=prizeTotal>0?` Premiação creditada: +${formatBudget(prizeTotal)} · orçamento ${formatBudget(budgetAfter??clubs[userClub]?.budget??0)}.`:'';
    pushMessage({category:'competition',type:'season-end',title:`Temporada ${careerSeason} encerrada`,body:`${userClub} terminou em ${position}º na Série ${userDivision}${row?` · ${row.points} pts (${row.wins}V-${row.draws}E-${row.losses}D · saldo ${row.goalDiff>=0?'+':''}${row.goalDiff})`:''}.${prizeLine} Confira acessos, rebaixamentos, campeões e premiação na transição de temporada.`,round:currentRound,meta:{competition:`Brasileirão Série ${userDivision}`}});
  };
  const notifySerieDKnockoutPhase=(startRound,label)=>{
    const fixtures=(nationalCompetitions.D.fixtures[startRound-1]||[]).concat(nationalCompetitions.D.fixtures[startRound]||[]);
    if(!fixtures.some(game=>game.home===userClub||game.away===userClub))return;
    const briefKey=`serie-d-ko-${startRound}`;
    if(matchBriefAlreadySent(briefKey))return;
    pushMessage({category:'competition',type:'phase-advance',title:`Série D · ${label}`,body:`${userClub} avançou para ${label}. Os confrontos em ida e volta já estão no calendário.`,round:currentRound,meta:{competition:'Série D · Eliminatórias',briefKey}});
  };
  const calendarGames=new Map();
  const calendarCompetitionTagsByDate=new Map();
  const addCalendarCompetitionTag=(date,code)=>{
    if(!date||!code)return;
    const key=calendarKey(date);
    if(!calendarCompetitionTagsByDate.has(key))calendarCompetitionTagsByDate.set(key,new Set());
    calendarCompetitionTagsByDate.get(key).add(code);
  };
  const rebuildCalendarCompetitionTags=()=>{
    calendarCompetitionTagsByDate.clear();
    if(FEATURES.stateLeague&&savedNewGame){
      stateLeagueEngine.allFixturesFlat().forEach(game=>{
        if(!game?.home||!game?.date)return;
        const code=resolveFixtureCompetitionCode(game);
        if(code)addCalendarCompetitionTag(new Date(game.date),code);
      });
    }
    Object.entries(nationalCompetitions).forEach(([division,competition])=>{
      (competition.fixtures||[]).flat().forEach(game=>{
        if(!game?.home)return;
        const code=resolveFixtureCompetitionCode(game,{division});
        if(!code)return;
        const date=gameScheduledDate(game,game.round?fixtureDateFor(division,game.round):null);
        if(date)addCalendarCompetitionTag(date,code);
      });
    });
    copaDoBrasilFixtures.forEach(game=>{
      if(!game?.date)return;
      addCalendarCompetitionTag(new Date(game.date),resolveFixtureCompetitionCode(game));
    });
    recopaFixtures.forEach(game=>{
      if(!game?.date)return;
      addCalendarCompetitionTag(new Date(game.date),resolveFixtureCompetitionCode(game));
    });
    worldCupFixtures.forEach(game=>{
      if(!game?.date)return;
      addCalendarCompetitionTag(new Date(game.date),WORLD_CUP_CALENDAR_CODE);
    });
  };
  const rebuildCalendarGames=()=>{
    invalidateUserScheduleCache();
    seasonCalendarFixtures=[
      ...(FEATURES.stateLeague&&savedNewGame?stateLeagueEngine.allFixturesFlat():[]),
      ...championshipFixtures.flat(),
      ...userKnockoutFixtures(),
      ...copaDoBrasilFixtures,
      ...recopaFixtures,
      ...worldCupFixtures,
    ].sort((a,b)=>fixtureDetails(a).date-fixtureDetails(b).date);
    calendarGames.clear();
    seasonCalendarFixtures.forEach(game=>{const key=calendarKey(fixtureDetails(game).date);if(!calendarGames.has(key))calendarGames.set(key,[]);calendarGames.get(key).push(game);});
    rebuildCalendarCompetitionTags();
    restConflictCount=calculateRestConflicts();
  };
  rebuildCalendarGames();
  advanceWorldCupThroughDateLocal=date=>{
    if(!worldCupCompetition||!date)return false;
    const changed=advanceWorldCupThroughDate(worldCupCompetition,date,{
      random:gameRandom,
      isUserTeam:game=>game.competition===WORLD_CUP_COMPETITION&&isUserFixture(game),
    });
    if(changed){
      refreshWorldCupFixtures();
      rebuildCalendarGames();
    }
    return changed;
  };
  if(worldCupCompetition){
    advanceWorldCupThroughDateLocal(careerCalendarDate);
  }
  const persistNationalTeamCode=code=>{
    if(!savedNewGame)return;
    const normalized=code?String(code).trim().toUpperCase():null;
    if(normalized){
      savedNewGame.nationalTeamCode=normalized;
      userNationalTeamCode=normalized;
      userNationalTeamName=nationalTeamByCode(normalized)?.name||null;
    }else{
      delete savedNewGame.nationalTeamCode;
      userNationalTeamCode=null;
      userNationalTeamName=null;
    }
    persistCareer({...savedNewGame});
  };
  const syncNationalTeamOfferStateToSave=()=>{
    if(!savedSeason)return;
    savedSeason.nationalTeamOfferState={...nationalTeamOfferState,year:careerSeason};
  };
  const refreshNationalTeamOfferState=()=>{
    nationalTeamOfferState=normalizeNationalTeamOfferState(
      nationalTeamOfferState?.year===careerSeason?nationalTeamOfferState:savedSeason?.nationalTeamOfferState,
      careerSeason,
    );
    const repaired=repairNationalTeamOfferBatches(nationalTeamOfferState,{
      year:careerSeason,
      userDivision,
      seed:savedNewGame?.seed||1,
    });
    if(repaired.changed){
      nationalTeamOfferState=repaired.state;
      syncNationalTeamOfferStateToSave();
    }
  };
  issueNationalTeamOfferIfDue=()=>{
    if(userNationalTeamCode)return false;
    refreshNationalTeamOfferState();
    if(!shouldIssueNextNationalTeamOffer({
      year:careerSeason,
      careerDate:careerCalendarDate,
      offerState:nationalTeamOfferState,
      userNationalTeamCode,
      legacyOffersSentYear:nationalTeamOffersSentYear,
    }))return false;
    const nextBatch=generateNextNationalTeamOffer({
      year:careerSeason,
      userDivision,
      seed:savedNewGame?.seed||1,
      issueIndex:nationalTeamOfferState.issuedCount,
      existingOffers:nationalTeamOfferState.offers,
    });
    if(!nextBatch?.teams?.length)return false;
    nationalTeamOfferState.offers=[...nationalTeamOfferState.offers,nextBatch];
    nationalTeamOfferState.issuedCount+=1;
    nationalTeamOfferState.lastIssueDate=careerCalendarDate.toISOString();
    nationalTeamOfferState.snoozedUntil=null;
    nationalTeamOfferState.year=careerSeason;
    nationalTeamOffersSentYear=careerSeason;
    syncNationalTeamOfferStateToSave();
    persistSeason(true);
    return true;
  };
  maybeShowNationalTeamOfferPopup=()=>{
    if(!nationalTeamOffersUi||nationalTeamOffersUi.isOpen())return false;
    refreshNationalTeamOfferState();
    if(!shouldShowNationalTeamOfferPopup({
      year:careerSeason,
      careerDate:careerCalendarDate,
      offerState:nationalTeamOfferState,
      userNationalTeamCode,
    }))return false;
    nationalTeamOffersUi.open({
      offers:getCurrentNationalTeamProposalTeams(nationalTeamOfferState.offers),
      issuedCount:nationalTeamOfferState.issuedCount,
    });
    return true;
  };
  acceptNationalTeamOfferFromPopup=code=>{
    const normalized=code?String(code).trim().toUpperCase():'';
    if(!normalized)return;
    persistNationalTeamCode(normalized);
    preloadNationalTeamClubs();
    nationalTeamOfferState={
      year:careerSeason,
      offers:[],
      issuedCount:NATIONAL_TEAM_OFFER_COUNT,
      lastIssueDate:nationalTeamOfferState.lastIssueDate,
      snoozedUntil:null,
    };
    syncNationalTeamOfferStateToSave();
    invalidateUserScheduleCache();
    rebuildCalendarGames();
    refreshSeasonPresentation();
    persistSeason(true);
  };
  denyAllNationalTeamOffers=()=>{
    refreshNationalTeamOfferState();
    nationalTeamOfferState.snoozedUntil=addDaysToCareerDate(
      careerCalendarDate,
      NATIONAL_TEAM_OFFER_WEEK_DAYS,
    );
    syncNationalTeamOfferStateToSave();
    persistSeason(true);
  };
  maybeSendNationalTeamOffers=()=>{
    const issued=issueNationalTeamOfferIfDue();
    const shown=maybeShowNationalTeamOfferPopup();
    return issued||shown;
  };
  respondToNationalTeamOffer=({offerId,accept}={})=>{
    const message=messages.findMessage?.({offerId});
    if(!message||!isNationalTeamOfferMessage(message))return;
    const teamCode=message.meta?.nationalTeamCode;
    const teamName=message.meta?.nationalTeamName||nationalTeamByCode(teamCode)?.name||'Seleção';
    if(accept&&teamCode){
      persistNationalTeamCode(teamCode);
      preloadNationalTeamClubs();
      messages.replaceMessage?.(
        {offerId},
        {
          type:'national-team-accepted',
          title:`Seleção aceita — ${teamName}`,
          body:`Você passará a comandar ${teamName} nos jogos oficiais da Copa do Mundo 2026, em paralelo ao ${userClub}.`,
          resolveAction:true,
          actionResult:'accepted',
          meta:{
            competition:'Copa do Mundo 2026',
            offerId,
            offerKind:'national-team',
            nationalTeamCode:teamCode,
            nationalTeamName:teamName,
            requiresAction:false,
            actionResolved:true,
          },
        },
      );
      messages.getMessages?.().forEach(other=>{
        if(!isNationalTeamActionRequired(other))return;
        if(other.meta?.offerId===offerId)return;
        messages.replaceMessage?.(
          {offerId:other.meta.offerId},
          {
            type:'national-team-declined',
            title:'Convite encerrado',
            body:`Você aceitou outra seleção. O convite de ${other.meta?.nationalTeamName||'seleção'} foi automaticamente recusado.`,
            resolveAction:true,
            actionResult:'superseded',
            meta:{
              competition:'Copa do Mundo 2026',
              offerId:other.meta.offerId,
              offerKind:'national-team',
              nationalTeamCode:other.meta?.nationalTeamCode,
              nationalTeamName:other.meta?.nationalTeamName,
              requiresAction:false,
              actionResolved:true,
            },
          },
        );
      });
      invalidateUserScheduleCache();
      rebuildCalendarGames();
      refreshSeasonPresentation();
    }else{
      messages.replaceMessage?.(
        {offerId},
        {
          type:'national-team-declined',
          title:'Convite recusado',
          body:`Você recusou o convite de ${teamName} para a Copa do Mundo 2026.`,
          resolveAction:true,
          actionResult:'rejected',
          meta:{
            competition:'Copa do Mundo 2026',
            offerId,
            nationalTeamCode:teamCode,
            nationalTeamName:teamName,
            requiresAction:false,
            actionResolved:true,
          },
        },
      );
    }
    persistSeason(true);
  };
  if(validSavedSeason)issueNationalTeamOfferIfDue();
  const initialCalendarDate=validSavedSeason?careerCalendarDate:seasonStartDate();
  const trainingOptions={before:['Preparação tática','Treino leve','Descanso'],after:['Recuperação','Descanso total','Análise do jogo'],free:['Treino equilibrado','Treino técnico','Descanso intermitente']};
  let trainingRules=normalizeTrainingRules({before:'Preparação tática',after:'Recuperação',free:'Treino equilibrado'});
  if(validSavedSeason&&savedSeason.trainingRules)trainingRules=normalizeTrainingRules({...trainingRules,...savedSeason.trainingRules});
  else try{trainingRules=normalizeTrainingRules({...trainingRules,...JSON.parse(localStorage.getItem('brfut-training-rules')||'{}')});}catch{}
  const fatigueEngine=createFatigueEngine({
    clamp,
    getClubs:()=>clubs,
    getUserClub:()=>userClub,
    clubInstitutionalContext,
    getTrainingRules:()=>trainingRules,
    getMatchClub:()=>matchClub(),
  });
  const {
    trainingRecoveryMultiplier,
    recoverPlayers,
    recoverOtherClubs,
    applyTrainingDay,
    applyPreMatchTraining,
    applyMinuteWearToLineup,
  }=fatigueEngine;
  let applyCalendarTrainingDay=type=>applyTrainingDay(type);
  let weeklyTrainingAccumulator=emptyWeeklyTrainingReport();
  let lastWeeklyTrainingReport=null;
  const seasonEndDate=()=>planSeasonEndDate(careerSeason);
  const weekBounds=date=>{const start=new Date(date);start.setDate(start.getDate()-start.getDay());start.setHours(12,0,0,0);const end=new Date(start);end.setDate(end.getDate()+6);end.setHours(12,0,0,0);return{start,end};};
  const formatWeekDay=date=>`${String(date.getDate()).padStart(2,'0')} ${date.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase()}`;
  const isPostMatchPendingForGame=game=>{
    if(!(matchFinished&&!roundCommitted&&liveMatchGame&&game))return false;
    return game.home===liveMatchGame.home
      &&game.away===liveMatchGame.away
      &&(game.round??null)===(liveMatchGame.round??null)
      &&String(game.competition||'')===String(liveMatchGame.competition||'');
  };
  const userMatchOnDate=date=>{
    const fromMap=(calendarGames.get(calendarKey(date))||[]).find(game=>isUserFixture(game)&&!isFixtureCompleted(game)&&!isPostMatchPendingForGame(game));
    if(fromMap)return fromMap;
    return pendingUserSchedule().find(entry=>sameCalendarDay(entry.details.date,date)&&!isPostMatchPendingForGame(entry.game))?.game||null;
  };
  const completedUserMatchOnDate=date=>(calendarGames.get(calendarKey(date))||[]).find(game=>isUserFixture(game)&&isFixtureCompleted(game))||null;
  const isOnPendingMatchDay=()=>!!userMatchOnDate(careerCalendarDate);
  const trainingTypeForDate=date=>{const tomorrow=new Date(date);tomorrow.setDate(tomorrow.getDate()+1);if(userMatchOnDate(tomorrow))return'before';const yesterday=new Date(date);yesterday.setDate(yesterday.getDate()-1);if(completedUserMatchOnDate(yesterday))return'after';return'free';};
  const calendarTrainingMap=()=>{const map=new Map(),add=(date,type)=>{const key=calendarKey(date);if(!map.has(key))map.set(key,[]);if(!map.get(key).some(item=>item.type===type)){const label=type==='free'&&trainingRules.freeMode===TRAINING_FREE_MODES.development?`Desenvolvimento · ${DEVELOPMENT_FOCUSES[trainingRules.developmentFocus]?.label||'Individual'}`:trainingRules[type];map.get(key).push({type,label});}};seasonCalendarFixtures.filter(isUserFixture).forEach(game=>{const matchDate=fixtureDetails(game).date,before=new Date(matchDate),after=new Date(matchDate);before.setDate(before.getDate()-1);after.setDate(after.getDate()+1);add(before,'before');add(after,'after');});const {start,end}=weekBounds(careerCalendarDate);for(let cursor=new Date(start);cursor<=end;cursor.setDate(cursor.getDate()+1)){const key=calendarKey(cursor);if(map.has(key))continue;if(!(calendarGames.get(key)||[]).some(isUserFixture))add(new Date(cursor),'free');}return map;};
  document.body.insertAdjacentHTML('beforeend',`<div id="treatmentModal" class="modal hidden"><div class="modal-card treatment-modal"><button id="closeTreatmentModal" class="close" type="button">×</button><label>DECISÃO MÉDICA</label><h2 id="treatmentPlayerName"></h2><p id="treatmentInjuryName" class="treatment-injury-name"></p><p id="treatmentModalText"></p><p id="treatmentMedicalMeta" class="treatment-medical-meta"></p><div class="treatment-actions"><button id="treatmentConservative" type="button"><span class="treatment-choice-label">TRATAMENTO CONSERVADOR</span><span id="treatmentConservativeMeta" class="treatment-choice-meta"></span></button><button id="treatmentSurgery" type="button"><span class="treatment-choice-label">CIRURGIA</span><span id="treatmentSurgeryMeta" class="treatment-choice-meta"></span></button></div></div></div>`);
  onClick('#closeTreatmentModal',()=>{if(pendingTreatmentDecision)finishTreatmentChoice('conservative');});
  onClick('#treatmentConservative',()=>finishTreatmentChoice('conservative'));
  onClick('#treatmentSurgery',()=>finishTreatmentChoice('surgery'));
  const isCompletedDashboardGame=game=>game&&(game.completed||game.homeGoals!=null||game.awayGoals!=null);
  let championshipDivision=userDivision;
  let championshipSerieDMode='knockout'; // groups | knockout (só quando mata-mata existe)
  let openChampionship=()=>{};
  let focusChampionshipPageForUserGame=()=>{};
  let focusChampionshipPageForNextUserGame=()=>{};
  let openChampionshipStandings=()=>{};
  let calendarView = null;
  let dashboard;
  let playerHistory = null;
  let transfersEngine=null;
  let rawOnCupScheduleChanged=()=>{};
  const buildCalendarDeps=()=>({
    $,$$,onClick,writeJson,
    getUserClub:()=>userClub,
    getUserDivision:()=>userDivision,
    getCurrentRound:()=>currentRound,
    getCareerSeason:()=>careerSeason,
    getCareerCalendarDate:()=>careerCalendarDate,
    getChampionshipFixtures:()=>championshipFixtures,
    getCopaFixtures:()=>copaDoBrasilFixtures,
    getWorldCupFixtures:()=>worldCupFixtures,
    getWorldCupSummary:()=>worldCupCalendarSummary(worldCupCompetition),
    getCalendarGames:()=>calendarGames,
    getCalendarCompetitionTags:()=>calendarCompetitionTagsByDate,
    rebuildCalendarGames,
    getRestConflictCount:()=>restConflictCount,
    calendarIntervalLabel,
    isUserFixture,
    isFixtureCompleted,
    fixtureDetails,
    fixtureResultLabel,
    fixtureDate,
    seasonComplete,
    seasonFullyComplete,
    isUserSeasonIdle,
    nextPendingUserEntry,
    restDaysUntilNextFixture,
    trainingRecoveryMultiplier,
    getSeasonRoundHistory:()=>seasonRoundHistory,
    getTrainingRules:()=>trainingRules,
    setTrainingRule:(type,value)=>{trainingRules[type]=value;},
    setTrainingFreeMode:mode=>{
      trainingRules.freeMode=mode===TRAINING_FREE_MODES.development?TRAINING_FREE_MODES.development:TRAINING_FREE_MODES.load;
      try{renderRoster();}catch{/* boot */}
    },
    setDevelopmentFocus:focus=>{if(DEVELOPMENT_FOCUSES[focus])trainingRules.developmentFocus=focus;},
    getDevelopmentFocusOptions:()=>developmentFocusOptionsForClub(clubs[userClub]||{}),
    getLastWeeklyTrainingReport:()=>lastWeeklyTrainingReport,
    getHasCareer:()=>!!savedNewGame,
    openView:viewId=>router.openView(viewId),
    getChampionshipDivision:()=>championshipDivision,
    openChampionship,
    weekBounds,
    formatWeekDay,
    userMatchOnDate,
    isOnPendingMatchDay,
    calendarTrainingMap,
    trainingOptions,
    findMatchLog:query=>playerHistory?.findMatchLog?.(query)||null,
    formatMatchRating,
    formatVenueCrowdLine,
    getMarketDayBrief:date=>transfersEngine?.getMarketDayBrief?.(date)||null,
  });
  const calendarLazy=createLazyFeature(async()=>{
    const {createCalendarViewFeature}=await import('../feature/calendar-view/index.js');
    const cv=createCalendarViewFeature(buildCalendarDeps());
    calendarView=cv;
    rawOnCupScheduleChanged=cv.onCupScheduleChanged;
    return cv;
  });
  const ensureCalendarView=()=>calendarLazy.ensure();
  const renderCalendar=()=>{void calendarLazy.call('renderCalendar');};
  const openCalendarMatchReport=(...args)=>{void calendarLazy.call('openCalendarMatchReport',...args);};
  const calendarGameResult=(...args)=>{
    const cv=calendarLazy.get();
    if(cv)return cv.calendarGameResult(...args);
    return null;
  };
  const openDashboardCalendarView=()=>{void calendarLazy.call('openDashboardCalendarView');};
  const setSelectedCalendarDate=date=>{void calendarLazy.call('setSelectedCalendarDate',date);};
  let cupScheduleRefreshPending=false;
  onCupScheduleChanged=()=>{
    if(isCalendarBatch()){
      cupScheduleRefreshPending=true;
      return;
    }
    if(calendarView)rawOnCupScheduleChanged();
    else void ensureCalendarView().then(cv=>cv.onCupScheduleChanged?.());
  };
  const flushCupScheduleRefresh=()=>{
    if(!cupScheduleRefreshPending)return;
    cupScheduleRefreshPending=false;
    if(calendarView)rawOnCupScheduleChanged();
    else void ensureCalendarView().then(cv=>cv.onCupScheduleChanged?.());
  };
  let advanceTransferCalendarFn=()=>({ok:false,reason:'no_club'});
  let advanceCalendarWeekFn=()=>null;
  let transfersUi=null;
  const collectStateLeagueDashboardGames=()=>buildStateLeagueDashboardGames({
    fixtureDetails,
    getSavedNewGame:()=>savedNewGame,
    getStateLeagueEngine:()=>stateLeagueEngine,
    getUserClub:()=>userClub,
  });
  dashboard=createDashboardFeature({
    $,$$,onClick,
    getUserClub:()=>userClub,
    getUserNationalTeamName:()=>userNationalTeamName,
    getUserNationalTeamCode:()=>userNationalTeamCode,
    isWorldCupDashboardActive:()=>isWorldCupDashboard(),
    getDashboardStandingsFocus:()=>dashboardStandingsFocus(),
    getWorldCupCompetition:()=>worldCupCompetition,
    getWorldCupFixtures:()=>worldCupFixtures,
    getWorldCupGroupTable:()=>getUserWorldCupGroupTable(worldCupCompetition,userNationalTeamName,gameRandom),
    getUserNationalTeamClub:()=>getNationalTeamClub(userNationalTeamName),
    getUserDivision:()=>userDivision,
    getCurrentRound:()=>currentRound,
    getCareerSeason:()=>careerSeason,
    getCareerCalendarDate:()=>careerCalendarDate,
    getClubs:()=>clubs,
    getDisplayedLeagueRows:displayedLeagueRows,
    getFutureMatches:()=>futureMatches,
    isUserFixture,
    isFixtureCompleted,
    seasonComplete,
    seasonFullyComplete,
    isUserSeasonIdle,
    nextPendingUserEntry,
    pendingUserSchedule,
    fixtureDetails,
    displayedClubPosition,
    sameCalendarDay,
    daysUntilNextFixtureFromToday,
    restDaysUntilNextFixture,
    leagueUserGameForRound,
    isKnockoutShootoutCompetition,
    knockoutCompetitionLabel,
    leadersFor,
    clubSeasonLeaders,
    getDashboardStatsClub:()=>dashboardStatsClub(),
    clubSeasonRatingSummary:clubName=>computeClubSeasonRatingSummary(playerHistory?.getStore?.(),clubName,careerSeason,{getClub:resolveClubForStats}),
    getSeasonRoundHistory:()=>seasonRoundHistory,
    getCopaFixtures:()=>copaDoBrasilFixtures,
    getNationalCompetitions:()=>nationalCompetitions,
    getCareerMessages:()=>messages.getMessages(),
    getUserBudgetLedger:()=>Array.isArray(clubs[userClub]?.budgetLedger)?clubs[userClub].budgetLedger:[],
    getUserSeasonCrowds:()=>userSeasonCrowds,
    getStateLeagueCompletedGames:collectStateLeagueDashboardGames,
    openCalendarMatchReport,
    calendarGameResult,
    isCompletedDashboardGame,
    fixtureDate,
    getUserSerieDGroupIndex:()=>userSerieDGroupIndex,
    getSerieDGroups:()=>serieDGroups,
    SERIE_D_GROUP_ROUNDS,
    isSponsorChoicePending:()=>!!pendingSponsorChoice,
    onRequestSponsorPicker:()=>openSponsorPickerIfPending?.(),
    // Visível só com pós-jogo pendente e modal fechado (×). Some no AVANÇAR / avanço de rodada.
    canReopenLivePostMatch:()=>{
      // Pós-jogo pendente (ainda sem AVANÇAR) + modal fechado → CTA PÓS-JOGO no dashboard.
      if(!(matchStarted&&matchFinished&&!roundCommitted&&liveMatchGame))return false;
      return !!$('#matchModal')?.classList.contains('hidden');
    },
    getTransferWindowPhase:()=>transfersEngine?.getWindowPhase?.()||null,
    isTransferMarketOpen:()=>!!transfersEngine?.marketStatus?.()?.open,
    advanceTransferCalendar:(...args)=>advanceTransferCalendarFn(...args),
    advanceCalendarWeek:(...args)=>advanceCalendarWeekFn(...args),
    showTransferWindowReport:report=>transfersUi?.showWindowReport?.(report),
    isOnPendingMatchDay:()=>isOnPendingMatchDay(),
    isLiveMatchInProgress:()=>matchStarted&&!matchFinished,
  });
  let openSponsorPickerIfPending=()=>{};
  const {renderDashboardMiniTable,renderDashboardUpcoming,renderUserMatchPresentation,renderLeaders,renderRecentResults,renderTeamStatsCard,renderDashboardStadiumPreview}=dashboard;
  const backfillUserSeasonCrowds=()=>{
    const before=userSeasonCrowds.length;
    messages.getMessages().forEach(message=>{
      if(message?.type!=='match-result')return;
      const meta=message.meta||{};
      if(meta.home!==userClub||!Number.isFinite(Number(meta.attendance)))return;
      upsertUserSeasonCrowd({
        home:meta.home,
        away:meta.away,
        attendance:meta.attendance,
        fillRate:meta.fillRate,
        gateRevenue:meta.gateRevenue,
        competition:meta.competition||'LEAGUE',
        label:meta.competition||'Jogo em casa',
        round:message.round??null,
      });
    });
    (clubs[userClub]?.budgetLedger||[]).forEach(entry=>{
      if(entry?.reason!=='gate_receipt')return;
      const meta=entry.meta||{};
      if(!Number.isFinite(Number(meta.attendance)))return;
      upsertUserSeasonCrowd({
        home:userClub,
        away:meta.opponent||'—',
        attendance:meta.attendance,
        fillRate:meta.fillRate,
        gateRevenue:entry.amount,
        competition:meta.competition||'LEAGUE',
        label:entry.label||'Bilheteria',
        phase:meta.phase||null,
      });
    });
    seasonRoundHistory.forEach(round=>{
      (round.games||[]).forEach(game=>{
        if(game?.home!==userClub||!Number.isFinite(Number(game.attendance)))return;
        upsertUserSeasonCrowd({
          home:game.home,
          away:game.away,
          attendance:game.attendance,
          fillRate:game.fillRate,
          gateRevenue:game.gateRevenue,
          competition:'LEAGUE',
          label:`Rodada ${round.round}`,
          round:round.round,
        });
      });
    });
    copaDoBrasilFixtures.forEach(game=>{
      if(game?.home!==userClub||!game.completed||!Number.isFinite(Number(game.attendance)))return;
      recordUserHomeCrowd(game,null);
    });
    if(userSeasonCrowds.length>before)persistSeason(true);
  };
  backfillUserSeasonCrowds();
  if(savedNewGame){
    void ensureCalendarView().then(cv=>cv.init(initialCalendarDate));
    const preloadCalendar=()=>{void ensureCalendarView();};
    if(typeof requestIdleCallback==='function')requestIdleCallback(preloadCalendar,{timeout:4000});
    else setTimeout(preloadCalendar,1500);
  }
  dashboard.init();
  economyUi=createEconomyFeature({
    $,
    onClick,
    listUpgrades,
    listStadiumUpgrades,
    purchaseUpgrade,
    purchaseStadiumUpgrade,
    formatBudget,
    formatCapacity,
    formatTicketPrice,
    getBalance,
    estimateWageBill,
    estimateRoundRecurringRevenue,
    evaluateRosterPayroll,
    estimateStaffBill,
    estimateStadiumOpsBill,
    estimateRoundCostBill,
    estimateWageRunway,
    resolveOverdraftRate,
    isOverdrawn,
    ensureStadium,
    getTicketPrices,
    adjustTicketPrice,
    adjustSectorTicketPrice,
    estimateGateReceipt,
    getSponsors,
    estimateSponsorInstallment,
    estimateTvInstallment,
    tvAdvanceStatus,
    advanceTvRights,
    tvHomeSlots,
    getSeasonCashflowStatement,
    takeBankLoan,
    repayBankLoan,
    payBankLoanMinimum,
    bankLoanStatus,
    getStructureLevel,
    getPitchLevel,
    maxPitchForStructure,
    pitchTierLabel,
    structureLevelLabel,
    computeSectorBreakdown,
    canOfferStadiumNaming,
    getStadiumInvestments,
    generateNamingOffers,
    assignNamingContract,
    estimateNamingRound,
    getNamingRights,
    namingStatusLabel,
    SPONSOR_POOL,
    sponsorLogoSlug,
    TICKET_PRICE_RANGE,
    getUserClub:()=>userClub,
    getClubs:()=>clubs,
    getUserDivision:()=>userDivision,
    getCareerSeason:()=>careerSeason,
    getSeasonGoal:()=>ensureSeasonGoal(),
    getSeasonGoalResult:()=>seasonGoalResult,
    getSeasonObjectives:()=>ensureSeasonObjectives(),
    getSeasonObjectivesResult:()=>seasonObjectivesResult,
    getSeasonGoalLiveContext:()=>buildSeasonObjectiveEvalContext(),
    seasonObjectiveLiveProgress,
    getBoardBriefContext:club=>{
      const target=club||clubs[userClub];
      if(!target)return null;
      const standing=userStandingSnapshot();
      const form=[];
      for(let index=seasonRoundHistory.length-1;index>=0&&form.length<5;index--){
        const games=seasonRoundHistory[index]?.games||[];
        const game=games.find(item=>involvesClub(item,userClub));
        if(!game||game.homeGoals==null||game.awayGoals==null)continue;
        const userHome=game.home===userClub;
        const userGoals=userHome?game.homeGoals:game.awayGoals;
        const oppGoals=userHome?game.awayGoals:game.homeGoals;
        form.unshift(userGoals>oppGoals?'W':userGoals<oppGoals?'L':'D');
      }
      const goal=ensureSeasonGoal();
      return composeBoardBrief({
        board:target.board,
        finances:target.finances,
        form,
        position:standing?.position||target.position||null,
        played:standing?.played||form.length,
        goalLabel:goal?.label||null,
        wageShortfall:!!target.wageShortfall,
      });
    },
    onBudgetChanged:()=>{
      if(clubs[userClub])clubStatus.syncFinancesFromBudget(clubs[userClub],userDivision);
      renderEnvironmentCard();
      persistSeason();
      updateMessageBadge();
      renderDashboardMessagesFeed();
    },
    refreshDashboardStadiumPreview:renderDashboardStadiumPreview,
    pushMessage,
    getCurrentRound:()=>currentRound,
    openView:viewId=>router.openView(viewId),
  });
  economyUi.init();
  router.onView('office',()=>economyUi.renderOffice());
  router.onView('stadium',()=>economyUi.renderStadium());
  router.onView('training',()=>{void calendarLazy.call('renderTrainingRules');});
  const syncCareerRosters=()=>careerPersistence.syncCareerRosters();
  playerRenameCallbacks.syncCareerRosters=syncCareerRosters;
  const clubFormFromHistory=clubName=>{
    const form=[];
    for(let index=seasonRoundHistory.length-1;index>=0&&form.length<5;index--){
      const games=seasonRoundHistory[index]?.games||[];
      const game=games.find(item=>involvesClub(item,clubName));
      if(!game||game.homeGoals==null||game.awayGoals==null)continue;
      const home=game.home===clubName;
      const goals=home?game.homeGoals:game.awayGoals;
      const opp=home?game.awayGoals:game.homeGoals;
      form.unshift(goals>opp?'W':goals<opp?'L':'D');
    }
    return form;
  };
  const formatTransferMoney=value=>{
    const amount=Math.round(Number(value)||0);
    if(amount>=1_000_000)return `R$ ${(amount/1_000_000).toFixed(amount>=10_000_000?0:1)} mi`;
    if(amount>=1_000)return `R$ ${(amount/1_000).toFixed(0)} mil`;
    return `R$ ${amount}`;
  };
  const currentNationalRanking=()=>{
    const entries=Object.values(nationalRankingEntries)
      .map(entry=>resolveNationalRankingEntry(entry,{
        clubs,
        nationalCompetitions,
        careerSeason,
        finalizedSeasons:nationalRankingFinalizedSeasons,
        cupChampion:cupCompetition.champion,
        careerSeed:savedNewGame?.seed??0,
      }))
      .filter(Boolean);
    return sortNationalRankingEntries(entries);
  };
  transfersEngine=FEATURES.transfers?createTransfersEngine({
    getClubs:()=>clubs,
    getUserClub:()=>userClub,
    getCareerSeason:()=>careerSeason,
    spend,
    credit,
    canAfford,
    isMarketOpen:()=>!(matchStarted&&!matchFinished)&&!(seasonTransition?.isSeasonTransitionPrepared?.()??false),
    getCurrentRound:()=>currentRound,
    getSeasonRoundCount:()=>seasonMaxRound(),
    getCareerDate:()=>careerCalendarDate,
    initialPendingOffers:validSavedSeason&&Array.isArray(savedSeason.pendingTransferOffers)
      ?savedSeason.pendingTransferOffers.map(item=>({...item}))
      :[],
    initialSeasonDeals:validSavedSeason&&Array.isArray(savedSeason.seasonTransferDeals)
      ?savedSeason.seasonTransferDeals.map(item=>({...item}))
      :[],
    resolveOfferMessage:messageId=>messages.resolveMessageById?.(messageId),
    getNationalRank:clubName=>{
      const ranking=currentNationalRanking();
      const position=ranking.findIndex(entry=>entry.club===clubName)+1;
      if(!position)return { position: ranking.length || 1, total: ranking.length || 1, size: ranking.length || 1 };
      return { position, total: ranking.length, size: ranking.length };
    },
    getClubForm:clubFormFromHistory,
    getUserManager:()=>{
      const manager=managerRanking.byClub(userClub)||managerRanking.byName(careerProfile?.managerName);
      if(!manager)return null;
      const entry=managerRanking.resolveEntry(manager,{
        getClubDivision:name=>clubs[name]?.division||userDivision,
      });
      return {
        reputation:Number(manager.reputation??60)||60,
        total:Number(entry?.total??manager.reputation??60)||60,
        name:manager.name||null,
      };
    },
    onAfterTransfer:result=>{
      transfersEngine?.invalidatePlayerWorldIndex?.();
      if(result?.ok&&result.player){
        const hist=playerHistory?.getPlayer?.(playerKey(result.player));
        if(hist)hist.club=result.to;
        playerHistory?.persist?.();
        if(result.from&&clubs[result.from])clubs[result.from]._rosterPersist=true;
        if(result.to&&clubs[result.to])clubs[result.to]._rosterPersist=true;
      }
      if(clubs[userClub]){
        assignSquadJerseyNumbers(clubs[userClub].roster);
        squad.splice(0,squad.length,...clubs[userClub].roster);
        if(result?.ok){
          orderRosterForFormation(clubs[userClub].roster,formation);
          syncClubPowers(clubs);
        }
      }
      syncCareerRosters();
      try{renderRoster();}catch{/* boot */}
      try{renderEnvironmentCard();}catch{/* boot */}
    },
  }):null;
  const notifyIncomingTransferOffers=offers=>{
    (offers||[]).forEach(offer=>{
      const isLoan=offer.type==='loan';
      const title=isLoan?'PROPOSTA DE EMPRÉSTIMO':'PROPOSTA DE COMPRA';
      const body=formatIncomingOfferLetter({
        fromClub:offer.fromClub,
        playerName:offer.playerName,
        feeLabel:isLoan?null:formatTransferMoney(offer.fee),
        offerType:isLoan?'loan':'buy',
      });
      const msg=pushMessage({
        category:'transfer',
        type:'incoming-offer',
        title,
        body,
        round:currentRound,
        meta:{
          competition:'Mercado',
          requiresAction:true,
          offerId:offer.id,
          offerType:offer.type,
          playerId:offer.playerId,
          playerName:offer.playerName,
          fromClub:offer.fromClub,
          fee:offer.fee,
          expiresRound:offer.expiresRound,
        },
      });
      if(msg)transfersEngine?.attachOfferMessageId?.(offer.id,msg.id);
    });
  };
  const processAiMarketTickCore=({quietDigest=false,tickKind='week',skipUserOffers=false,skipSeed=false,silent=false}={})=>{
    if(!transfersEngine)return null;
    const expired=silent?[]:(transfersEngine.expirePendingOffers(currentRound)||[]);
    if(!silent){
      expired.forEach(offer=>{
        const body=formatOfferExpiredLetter({
          fromClub:offer.fromClub,
          playerName:offer.playerName,
        });
        const replaced=messages.replaceMessage?.(
          { offerId:offer.id, messageId:offer.messageId },
          {
            type:'offer-expired',
            title:'Proposta expirada',
            body,
            resolveAction:true,
            actionResult:'expired',
            meta:{ competition:'Mercado', offerId:offer.id, playerId:offer.playerId },
          },
        );
        if(!replaced){
          pushMessage({
            category:'transfer',
            type:'offer-expired',
            title:'Proposta expirada',
            body,
            round:currentRound,
            meta:{competition:'Mercado',offerId:offer.id,playerId:offer.playerId},
          });
        }
      });
    }else{
      try{transfersEngine.expirePendingOffers?.(currentRound);}catch{/* */}
    }
    if(!transfersEngine.marketOpen())return { expired, tick: null };
    const tick=transfersEngine.runAiMarketTick({ tickKind, skipUserOffers, skipSeed });
    if(!silent&&tick?.digest?.total&&!quietDigest){
      const buyN=tick.digest.buyCount||0;
      const loanN=tick.digest.loanCount||0;
      const loanBuyN=tick.digest.loanBuyCount||0;
      const parts=[
        `${buyN} compra${buyN===1?'':'s'}`,
        `${loanN} empréstimo${loanN===1?'':'s'}`,
      ];
      if(loanBuyN>0)parts.push(`${loanBuyN} opção${loanBuyN===1?'':'ões'} de compra`);
      pushMessage({
        category:'transfer',
        type:'market-digest',
        title:'Mercado movimentado',
        body:`Mercado: ${tick.digest.total} negócio${tick.digest.total===1?'':'s'} entre clubes (${parts.join(', ')}).`,
        round:currentRound,
        meta:{competition:'Mercado'},
      });
    }
    (tick?.deals||[]).forEach(deal=>{
      if(silent)return;
      if(deal?.type!=='loan_buy'||deal.from!==userClub||!deal.player)return;
      const feeLabel=formatTransferMoney(deal.fee);
      pushMessage({
        category:'transfer',
        type:'loan-buy-exercised',
        title:'Opção de compra exercida',
        body:`${deal.to} exerceu a opção de compra de ${deal.player.name} por ${feeLabel}. O jogador não retorna ao seu elenco.`,
        round:currentRound,
        meta:{
          competition:'Mercado',
          playerId:deal.player.playerId||null,
          playerName:deal.player.name,
          fromClub:deal.from,
          toClub:deal.to,
          fee:deal.fee,
        },
      });
    });
    if(!silent&&tick?.offers?.length)notifyIncomingTransferOffers(tick.offers);
    if(silent&&tick?.offers?.length){
      tick.offers.forEach(offer=>{
        const id=offer?.id;
        if(id)pendingTransferOfferPopupIds.push(id);
      });
    }
    return { expired, tick };
  };
  const presentTransferOffersAfterAdvance=(result={})=>{
    const showReport=()=>{
      if(result?.report)void ensureTransfersUi().then(ui=>ui.showWindowReport?.(result.report));
    };
    pendingTransferOfferPopupIds=[];
    // Todas as propostas ainda pendentes — evita perder oportunidade só na caixa.
    const opened=messages.presentTransferActionMessages?.({
      onQueueEmpty:showReport,
    });
    if(!opened)showReport();
    return !!opened;
  };
  const processAiMarketAfterRound=()=>{
    if(!transfersEngine)return;
    try{
      processAiMarketTickCore({quietDigest:false,tickKind:'postRound'});
      transfersUi?.render?.();
    }catch{/* mercado off / boot */}
  };
  /**
   * Avanço de tempo na janela (estilo FIFA Career): semana, ou dia na última semana (Deadline Day).
   * No fechamento da janela, devolve relatório com a maior transferência.
   */
  const advanceTransferCalendar=(opts={})=>{
    const batch=opts.batch===true;
    if(!transfersEngine||!savedNewGame)return { ok:false, reason:'no_club' };
    if(pendingSponsorChoice){openSponsorPickerIfPending();return { ok:false, reason:'sponsor' };}
    if(matchStarted&&!matchFinished)return { ok:false, reason:'market_closed' };
    if(seasonTransition?.isSeasonTransitionPrepared?.())return { ok:false, reason:'market_closed' };
    if(!batch){
      ensureCalendarMatchConsistency();
      rebuildCalendarGames();
    }
    // Jogo atrasado / dia de jogo: não segue avançando a janela.
    if(isOnPendingMatchDay()){
      const stoppedMatch=userMatchOnDate(careerCalendarDate);
      if(!batch){
        pushMatchDayBrief(stoppedMatch);
        setSelectedCalendarDate(careerCalendarDate);
        persistSeason(true);
        refreshSeasonPresentation();
      }
      return {ok:true,days:0,stoppedMatch,phaseBefore:transfersEngine.getWindowPhase?.()||{},phaseAfter:transfersEngine.getWindowPhase?.()||{},report:null,newOfferIds:[]};
    }
    const phaseBefore=transfersEngine.getWindowPhase?.()||{};
    if(!phaseBefore.active)return { ok:false, reason:'window_closed', status:transfersEngine.marketStatus() };
    const daysToAdvance=phaseBefore.mode==='day'?1:7;
    const seasonEnd=seasonEndDate();
    let simulatedDays=0;
    let stoppedMatch=null;
    suppressTransferOfferPopup=true;
    pendingTransferOfferPopupIds=[];
    try{
      for(let step=0;step<daysToAdvance;step++){
        const nextDay=new Date(careerCalendarDate);
        nextDay.setDate(nextDay.getDate()+1);
        nextDay.setHours(12,0,0,0);
        if(nextDay>seasonEnd)break;
        const pendingMatch=userMatchOnDate(nextDay);
        if(pendingMatch){
          applyCalendarTrainingDay(trainingTypeForDate(nextDay));
          advanceCareerCalendarTo(nextDay);
          processContractsForDate(nextDay);
          advanceCupThroughDate(nextDay);
          advanceStateLeagueThroughDate(nextDay);
          advanceWorldCupThroughDateLocal(nextDay);
          simulatedDays+=1;
          stoppedMatch=pendingMatch;
          if(!batch)pushMatchDayBrief(pendingMatch);
          break;
        }
        applyCalendarTrainingDay(trainingTypeForDate(nextDay));
        advanceCareerCalendarTo(nextDay);
        processContractsForDate(nextDay);
        advanceCupThroughDate(nextDay);
        advanceStateLeagueThroughDate(nextDay);
        advanceWorldCupThroughDateLocal(nextDay);
        simulatedDays+=1;
        // Mercado: 1 tick no fim da semana (modo semana) ou 1/dia no Deadline — não a cada dia intermediário.
        if(!batch){
          try{
            if(transfersEngine.marketOpen()&&phaseBefore.mode==='day'){
              processAiMarketTickCore({quietDigest:false,tickKind:'deadline'});
            }
          }catch{/* tick */}
        }
      }
      // Semana: um único tick de mercado ao final (Deadline já rodou por dia acima).
      try{
        if(
          !batch &&
          phaseBefore.mode==='week' &&
          !stoppedMatch &&
          transfersEngine.marketOpen()
        ){
          processAiMarketTickCore({quietDigest:false,tickKind:'week'});
        }
      }catch{/* tick */}
    }finally{
      suppressTransferOfferPopup=false;
    }
    setSelectedCalendarDate(careerCalendarDate);
    maybeSendNationalTeamOffers();
    const phaseAfter=transfersEngine.getWindowPhase?.()||{};
    let report=null;
    if(phaseBefore.active&&!phaseAfter.active){
      report=transfersEngine.buildWindowClosingReport({
        windowKey:phaseBefore.windowKey,
        label:phaseBefore.label,
      });
      if(!batch){
        pushMessage({
          category:'transfer',
          type:'window-report',
          title:`Relatório · ${phaseBefore.label||'Janela'}`,
          body:report.biggest
            ?`Janela encerrada. Maior transferência: ${report.biggest.playerName} (${report.biggest.from} → ${report.biggest.to}) por ${formatTransferMoney(report.biggest.fee)}. ${report.dealCount} negócios · total ${formatTransferMoney(report.totalFees)}.`
            :`Janela encerrada sem transferências à vista registradas no mercado.`,
          round:currentRound,
          meta:{competition:'Mercado',report},
        });
      }
    }
    if(!batch){
      if(simulatedDays>0)flushWeeklyTrainingReport();
      persistSeason(true);
      refreshSeasonPresentation();
      transfersUi?.render?.();
    }
    const result={
      ok:true,
      days:simulatedDays,
      mode:phaseBefore.mode,
      phaseBefore,
      phaseAfter,
      report,
      stoppedMatch,
      newOfferIds:[...new Set(pendingTransferOfferPopupIds)].filter(Boolean),
    };
    if(!batch)presentTransferOffersAfterAdvance(result);
    return result;
  };
  advanceTransferCalendarFn=advanceTransferCalendar;
  const aiContractRoll=(clubName,date)=>{
    const key=`${clubName}:${calendarKey(date)}`;
    let h=0;
    for(let i=0;i<key.length;i+=1)h=(h*31+key.charCodeAt(i))>>>0;
    return (h%1000)/1000;
  };
  const processContractsForDate=dateInput=>{
    if(!savedNewGame)return;
    const date=dateInput instanceof Date?new Date(dateInput):new Date(dateInput);
    if(Number.isNaN(date.getTime()))return;
    date.setHours(12,0,0,0);
    if(clubs[userClub]&&!isWorldCupDashboard()){
      processClubContractCalendar({
        club:clubs[userClub],
        division:userDivision,
        careerDate:date,
        pushMessage,
        currentRound,
        alertedKeys:contractAlertKeys,
        userClub:true,
      });
      void import('../engine/youth-academy.js').then(({purgeExpiredScoutReports})=>{
        purgeExpiredScoutReports(clubs[userClub],date);
      }).catch(()=>{});
    }
    Object.entries(clubs).forEach(([clubName,club])=>{
      if(clubName===userClub||!Array.isArray(club?.roster)||!club.roster.length)return;
      processAiClubContractsSilent(club,club.division||'A',date,()=>aiContractRoll(clubName,date));
    });
  };
  respondToContractRenewal=({playerId,accept,messageId}={})=>{
    if(!playerId||!clubs[userClub])return;
    const player=clubs[userClub].roster.find(item=>(item.playerId||item.name)===playerId);
    if(!player)return;
    const msg=
      (messageId&&messages.findMessage?.({messageId}))||
      messages.getMessages().find(item=>isContractRenewalActionRequired(item)&&item.meta?.playerId===playerId);
    if(accept){
      const expired=isContractExpired(player,careerCalendarDate);
      const wageAsk=Math.round(
        Number(msg?.meta?.wageAsk) ||
        computeRenewalWageAsk(player,userDivision,{careerDate:careerCalendarDate,expired}),
      );
      signSemesterContract(player,{
        wagePerRound:wageAsk,
        signedDate:careerCalendarDate,
        division:userDivision,
      });
      messages.replaceMessage?.(
        {messageId:msg?.id||messageId},
        {
          type:'contract-renewed',
          title:'CONTRATO · Renovado',
          body:`${player.name} renovou por 6 meses (até ${formatContractDate(player.contract?.expiresDate)}). Salário: R$ ${wageMonthlyFromRound(player.wage,userDivision).toLocaleString('pt-BR')}/mês.`,
          resolveAction:true,
          meta:{
            competition:'Contratos',
            playerId,
            requiresAction:false,
            actionResolved:true,
          },
        },
      );
    }else{
      ensurePlayerContract(player,{division:userDivision,careerDate:careerCalendarDate,season:careerSeason});
      player.contract.status='expired';
      messages.replaceMessage?.(
        {messageId:msg?.id||messageId},
        {
          type:'contract-declined',
          title:'CONTRATO · Sem acordo',
          body:`${player.name} segue sem contrato vigente. Pode ser vendido sem multa ou renegociado na janela.`,
          resolveAction:true,
          meta:{
            competition:'Contratos',
            playerId,
            requiresAction:false,
            actionResolved:true,
          },
        },
      );
    }
    assignSquadJerseyNumbers(clubs[userClub].roster);
    squad.splice(0,squad.length,...clubs[userClub].roster);
    syncCareerRosters();
    persistSeason(true);
    try{renderRoster();}catch{/* */}
    messages.updateMessageBadge?.();
    messages.closeMessageReader?.();
    rosterContracts.render?.();
  };
  respondToIncomingTransferOffer=({offerId,accept}={})=>{
    if(!transfersEngine||!offerId)return;
    const result=accept
      ?transfersEngine.acceptIncomingOffer(offerId)
      :transfersEngine.rejectIncomingOffer(offerId);
    if(!result?.ok){
      const errBody=`Não foi possível ${accept?'aceitar':'recusar'} a proposta (${result?.reason||'erro'}).`;
      // Atualiza a proposta existente — não cria alerta no inbox.
      messages.replaceMessage?.(
        { offerId },
        {
          type:'offer-error',
          title:'Proposta não concluída',
          body:errBody,
          resolveAction:false,
          meta:{ competition:'Mercado', offerId },
        },
      );
      transfersUi?.showActionAlert?.({
        title:'Proposta não concluída',
        lead:errBody,
        body:result?.reason==='payroll_pressure'||result?.reason==='roster_full'||result?.reason==='roster_hard_full'
          ?'O clube comprador/anfitrião não comporta a folha. Tente outro destino ou aguarde.'
          :'Revise a proposta e tente de novo.',
        tone:'block',
        payroll:result?.payroll||null,
      });
      transfersUi?.render?.();
      return;
    }
    const offer=result.offer;
    const accepted=!!(accept&&result.deal);
    const title=accepted
      ?(offer.type==='loan'?'Empréstimo aceito':'Venda aceita')
      :'Proposta recusada';
    const body=accepted
      ?(offer.type==='loan'
        ?`${offer.playerName} foi cedido por empréstimo ao ${offer.fromClub}.`
        :`${offer.playerName} foi vendido ao ${offer.fromClub} por ${formatTransferMoney(offer.fee)}.`)
      :formatUserRejectOfferLetter({
        fromClub:offer.fromClub,
        playerName:offer.playerName,
        offerType:offer.type==='loan'?'loan':'buy',
      });
    // Resolve a mensagem da proposta no inbox (mesma thread) — impacto vai só no alerta efêmero.
    messages.replaceMessage?.(
      { offerId:offer.id, messageId:offer.messageId },
      {
        type:accepted?'deal':'offer-rejected',
        title,
        body,
        resolveAction:true,
        actionResult:accepted?'accepted':'rejected',
        meta:{
          competition:'Mercado',
          offerId:offer.id,
          playerId:offer.playerId,
          requiresAction:false,
          actionResolved:true,
        },
      },
    );
    if(accepted&&clubs[userClub])clubStatus.syncFinancesFromBudget(clubs[userClub],userDivision);
    const payroll=result.deal?.payroll||transfersEngine.evaluateUserPayroll?.()||null;
    const alertTone=accepted?(payroll?.tone||'relief'):'ok';
    const alertBody=accepted
      ?(payroll
        ?(alertTone==='warn'
          ?'Folha no limite — cuidado com novas contratações.'
          :alertTone==='relief'
            ?'Folha mais leve após esta operação.'
            :'Folha confortável.')
        :'Operação concluída no mercado.')
      :'Nenhuma mudança de elenco ou folha.';
    transfersUi?.showActionAlert?.({
      title,
      lead:body,
      body:alertBody,
      tone:alertTone,
      payroll:accepted?payroll:null,
    });
    messages.closeMessageReader?.();
    persistSeason(true);
    transfersUi?.render?.();
    renderEnvironmentCard();
  };
  const buildTransfersUiDeps=()=>({
    $,
    onClick,
    on,
    getTransfersEngine:()=>transfersEngine,
    getBalance:()=>getBalance(clubs[userClub]),
    getUserClub:()=>userClub,
    getUserDivision:()=>userDivision,
    formatBudget,
    pushMessage,
    getCurrentRound:()=>currentRound,
    playerNameCell,
    onTransferOfferRespond:opts=>respondToIncomingTransferOffer(opts),
    openOfferMessage:offer=>{
      const msg=messages.findMessage?.({ messageId:offer?.messageId, offerId:offer?.id });
      if(msg)messages.openMessageReader?.(msg.id);
    },
    onDealComplete:()=>{
      if(clubs[userClub])clubStatus.syncFinancesFromBudget(clubs[userClub],userDivision);
      persistSeason(true);
      renderEnvironmentCard();
    },
  });
  const transfersUiLazy=createLazyFeature(async()=>{
    const {createTransfersFeature}=await import('../feature/transfers/index.js');
    const ui=createTransfersFeature(buildTransfersUiDeps());
    transfersUi=ui;
    ui.bindHandlers();
    return ui;
  });
  const ensureTransfersUi=()=>transfersUiLazy.ensure();
  if(FEATURES.transfers){
    router.onView('transfers',()=>{void ensureTransfersUi().then(ui=>ui.render());});
  }
  /** Rótulo do informativo: RODADA N ou MATA-MATA + fase/leg. */
  const headerMatchContext=game=>{
    if(!game)return { tag:'JOGO', stage:'' };
    if(game.competition==='COPA DO BRASIL'){
      const stage=[game.phase,game.leg].filter(Boolean).join(' · ');
      return { tag:'MATA-MATA', stage:stage||'Copa do Brasil' };
    }
    if(typeof isKnockoutShootoutCompetition==='function'&&isKnockoutShootoutCompetition(game)){
      const phaseLabel=serieDKnockoutPhaseLabel(game);
      const stage=[phaseLabel,game.leg].filter(Boolean).join(' · ');
      return { tag:'MATA-MATA', stage };
    }
    const round=game.round??currentRound;
    return { tag:`RODADA ${round}`, stage:'' };
  };
  renderHeaderGuide=createHeaderGuideRenderer({
    $,
    FEATURES,
    getCareerCalendarDate:()=>careerCalendarDate,
    getNextPendingUserEntry:()=>(typeof nextPendingUserEntry==='function'?nextPendingUserEntry():null),
    getFutureMatches:()=>futureMatches,
    isUserFixture,
    isFixtureCompleted,
    fixtureDetails,
    getTransfersEngine:()=>transfersEngine,
    formatBudget,
    headerMatchContext,
  });
  const renderDashboardHero=()=>{
    const heroSpan=$('.hero>div>span');
    if(!heroSpan)return;
    if(dashboardStandingsFocus()==='worldcup'&&userNationalTeamName){
      heroSpan.textContent=`Comande ${userNationalTeamName} na Copa do Mundo ${careerSeason}.`;
      return;
    }
    heroSpan.textContent=`Prepare o ${userClub} para mais uma rodada.`;
  };
  const refreshSeasonPresentation=({skipChampionshipPage=false}={})=>{
    reconcileCurrentRound();
    if(ensureCalendarMatchConsistency()){
      // Datas da Copa / dia de carreira corrigidos — reconstrói a grade.
    }
    rebuildCalendarGames();
    futureMatches=currentRoundFixtures();
    refreshUserFixtures();
    leagueData.sort((a,b)=>b.points-a.points||b.goalDiff-a.goalDiff||b.wins-a.wins);
    leagueData.forEach((row,index)=>clubs[row.club].position=index+1);
    const tableViewActive=$('#table')?.classList.contains('active');
    if(!skipChampionshipPage||tableViewActive)renderChampionshipPage();
    if(!$('#cupBracketModal')?.classList.contains('hidden')){
      if(bracketCompetition==='SERIE_D')renderSerieDBracket(championshipRoundView);
      else renderCupBracket(championshipRoundView||cupCompetition.currentPhase||1);
    }
    renderDashboardHero();
    renderDashboardMiniTable();
    renderDashboardUpcoming();
    $('.upcoming-dashboard label em').textContent=dashboardLeagueRoundLabel();
    renderUserMatchPresentation();
    renderEnvironmentCard();
    renderClubBudget();
    renderHeaderGuide();
    rankingViews?.renderNationalRanking();
    rankingViews?.renderManagerRanking();
    renderSeasonGoalCard();
    renderTeamStatsCard();
    renderDashboardStadiumPreview();
    renderCalendar(); renderLeaders(); renderRecentResults();
  };

  const formations = {'4-3-3':[[50,91],[14,74],[38,76],[62,76],[86,74],[25,58],[50,60],[75,58],[18,27],[50,18],[82,27]],'4-4-2':[[50,91],[14,74],[38,76],[62,76],[86,74],[16,56],[38,58],[62,58],[84,56],[38,25],[62,25]],'3-5-2':[[50,91],[25,76],[50,78],[75,76],[12,56],[32,58],[50,55],[68,58],[88,56],[38,25],[62,25]],'4-2-3-1':[[50,91],[14,74],[38,76],[62,76],[86,74],[35,59],[65,59],[18,40],[50,42],[82,40],[50,19]],'4-1-4-1':[[50,91],[14,74],[38,76],[62,76],[86,74],[50,64],[16,44],[38,46],[62,46],[84,44],[50,19]],'5-3-2':[[50,91],[10,74],[30,77],[50,78],[70,77],[90,74],[27,57],[50,59],[73,57],[38,25],[62,25]],'4-3-1-2':[[50,91],[14,74],[38,76],[62,76],[86,74],[25,59],[50,64],[75,59],[50,43],[37,23],[63,23]],'3-4-3':[[50,91],[26,76],[50,78],[74,76],[15,57],[39,58],[61,58],[85,57],[18,27],[50,18],[82,27]]};
  const formationRoles={
    '4-3-3':['GOL','LAT','ZAG','ZAG','LAT','VOL','MC','MC','PE','ATA','PD'],
    '4-4-2':['GOL','LAT','ZAG','ZAG','LAT','PE','MC','MC','PD','ATA','ATA'],
    '3-5-2':['GOL','ZAG','ZAG','ZAG','LAT','VOL','MC','MEI','LAT','ATA','ATA'],
    '4-2-3-1':['GOL','LAT','ZAG','ZAG','LAT','VOL','VOL','PE','MEI','PD','ATA'],
    '4-1-4-1':['GOL','LAT','ZAG','ZAG','LAT','VOL','PE','MC','MC','PD','ATA'],
    '5-3-2':['GOL','LAT','ZAG','ZAG','ZAG','LAT','VOL','MC','MC','ATA','ATA'],
    '4-3-1-2':['GOL','LAT','ZAG','ZAG','LAT','VOL','MC','MC','MEI','ATA','ATA'],
    '3-4-3':['GOL','ZAG','ZAG','ZAG','LAT','MC','MC','LAT','PE','ATA','PD']
  };
  const formationPerformance = FORMATION_PERFORMANCE;
  const compatibleRoles = COMPATIBLE_ROLES;
  const formationNotes = {'4-3-3':'Amplitude e pressão com três atacantes.','4-4-2':'Bloco equilibrado e duas referências.','3-5-2':'Superioridade no meio-campo.','4-2-3-1':'Controle entre as linhas.','4-1-4-1':'Proteção defensiva e ocupação dos corredores.','5-3-2':'Linha defensiva forte.','4-3-1-2':'Diamante compacto para atacar pelo centro.','3-4-3':'Formação agressiva, com três homens de frente.'};
  let formation = '4-3-3',positionAssignments=[...formationRoles['4-3-3']];
  const roleAttributeScore=(player,role)=>{
    const fatigue=clamp(player.fatigue,0,100),m=stat=>matchPlayerStat(player,stat),scores={
      GOL:player.overall*.38+m('reflexes')*.27+m('positioning')*.22+m('penaltySaving')*.07+fatigue*.06,
      ZAG:player.overall*.31+m('marking')*.22+m('tackling')*.22+m('heading')*.12+m('speed')*.05+m('passing')*.03+fatigue*.05,
      LAT:player.overall*.28+m('speed')*.20+m('marking')*.14+m('tackling')*.14+m('passing')*.10+m('dribble')*.08+fatigue*.06,
      VOL:player.overall*.27+m('marking')*.16+m('tackling')*.18+m('passing')*.15+m('playmaking')*.11+m('heading')*.05+fatigue*.08,
      MC:player.overall*.27+m('passing')*.21+m('playmaking')*.21+m('dribble')*.08+m('tackling')*.06+m('speed')*.05+fatigue*.12,
      MEI:player.overall*.25+m('passing')*.20+m('playmaking')*.22+m('dribble')*.12+m('finishing')*.08+m('speed')*.05+fatigue*.08,
      PE:player.overall*.24+m('speed')*.20+m('dribble')*.20+m('finishing')*.13+m('passing')*.08+m('playmaking')*.07+fatigue*.08,
      PD:player.overall*.24+m('speed')*.20+m('dribble')*.20+m('finishing')*.13+m('passing')*.08+m('playmaking')*.07+fatigue*.08,
      ATA:player.overall*.27+m('finishing')*.25+m('heading')*.14+m('speed')*.11+m('dribble')*.09+m('playmaking')*.05+fatigue*.09
    };
    if(role==='GOL'&&player.pos!=='GOL')return -100;
    if(role!=='GOL'&&player.pos==='GOL')return -80;
    const adaptation=player.pos===role?14:(compatibleRoles[role]||[]).includes(player.pos)?3:-22;
    return (scores[role]??player.overall)+adaptation;
  };
  const lineupForRoles=(players,roles,slotIndexes=roles.map((_,index)=>index))=>{
    const available=[...players],assignment=new Map(),priority={GOL:0,PE:1,PD:1,ATA:2,LAT:3,ZAG:4,VOL:5,MEI:6,MC:7};
    [...slotIndexes].sort((a,b)=>(priority[roles[a]]??9)-(priority[roles[b]]??9)).forEach(slot=>{
      if(!available.length)return;
      available.sort((a,b)=>roleAttributeScore(b,roles[slot])-roleAttributeScore(a,roles[slot])||b.overall-a.overall||b.fatigue-a.fatigue);
      assignment.set(slot,available.shift());
    });
    return assignment;
  };
  ({ buildSimLineup, substitutionPriority } = createSimLineupBuilder({
    formationRoles,
    lineupForRoles,
    playerUnavailable,
    playerStarterBlocked,
    playerInRestrictedReturn,
    workloadLabel,
    workloadRisk,
    playerRehabMaxMinutes,
    matchDifficultyForClub,
  }));
  ({ simulateRoundMatch } = createRoundMatchSimulator({
    clamp,
    rnd,
    random: Math.random,
    getClubs: () => clubs,
    getLeagueData: () => leagueData,
    clubInstitutionalContext,
    buildSimLineup,
    substitutionPriority,
    engineTuning,
    engineFoulRisk,
    engineBlowoutDamp,
    engineScoreDamp,
    formationPerformance,
    compatibleRoles,
    matchPlayerStat,
    playerRehabMaxMinutes,
    injurySeverityLabel,
    resolvePhysicalIncident,
    buildDeferredInjuryEntry,
    calculatePlayThroughSubChance,
    pickInjuryVictim,
    directRedDismissalType,
    resolveStoppageEligibility:fixture=>{
      if(!fixture)return {knockout:false,round:0,totalRounds:0};
      if(isKnockoutShootoutCompetition(fixture))return {knockout:true,round:0,totalRounds:0};
      const round=Number(fixture.round)||currentRound;
      const division=clubs[fixture.home]?.division||clubs[fixture.away]?.division||userDivision;
      const totalRounds=division==='D'
        ?SERIE_D_GROUP_ROUNDS
        :Math.max(2,nationalCompetitions[division]?.fixtures?.length||38);
      return {knockout:false,round,totalRounds};
    },
  }));
  const simulateRoundMatchBase=simulateRoundMatch;
  simulateRoundMatch=(home,away,fixture)=>{
    if(FEATURES.stateLeague&&savedNewGame){
      ensureMatchClubRosters(home,away,clubs,stateLeagueEngine.competitions,{
        careerSeed:savedNewGame.seed??0,
        seasonYear:careerSeason,
        firstNames,
        lastNames,
      });
    }
    return simulateRoundMatchBase(home,away,fixture);
  };
  const orderRosterForFormation=(roster,targetFormation)=>{
    if(!Array.isArray(roster))return;
    const roles=formationRoles[targetFormation]||formationRoles['4-3-3'],eligible=roster.filter(player=>!playerUnavailable(player)),starterPool=eligible.filter(player=>!playerStarterBlocked(player)),pool=starterPool.length>=roles.length?starterPool:eligible,assignment=lineupForRoles(pool,roles),lineup=roles.map((_,slot)=>assignment.get(slot)).filter(Boolean),selected=new Set(lineup),availableBench=eligible.filter(player=>!selected.has(player)&&!playerInRestrictedReturn(player)),restrictedBench=eligible.filter(player=>!selected.has(player)&&playerInRestrictedReturn(player)),unavailable=roster.filter(player=>!selected.has(player)&&playerUnavailable(player));
    roster.splice(0,roster.length,...lineup,...availableBench,...restrictedBench,...unavailable);
  };
  /** Restaura ordem do elenco (titulares + banco) sem recalcular encaixe. */
  const applyRosterOrderByNames=(roster,orderedNames)=>{
    if(!Array.isArray(orderedNames)||orderedNames.length<11||!roster?.length)return false;
    const byName=new Map(roster.map(player=>[player.name,player]));
    const next=[];
    orderedNames.forEach(name=>{const player=byName.get(name);if(player){next.push(player);byName.delete(name);}});
    byName.forEach(player=>next.push(player));
    if(next.length!==roster.length)return false;
    roster.splice(0,roster.length,...next);
    return true;
  };
  const userSideNameForGame=game=>resolveUserSideName(game,{userClub,userNationalTeamName});
  const userSideClubForGame=game=>resolveUserSideClub(game,{userClub,userNationalTeamName,clubs,getNationalTeamClub});
  const resolveUserMatchFormation=game=>{
    if(isWorldCupUserFixture(game,userNationalTeamName)&&userNationalTeamCode){
      return getNationalTeamFormation(userNationalTeamCode);
    }
    return formation;
  };
  const bindSquadForUserFixtureSync=game=>{
    if(!isWorldCupUserFixture(game,userNationalTeamName)){
      activeUserSquad=squad;
      worldCupMatchSquad=null;
      return true;
    }
    const ntClub=getNationalTeamClub(userNationalTeamName);
    if(!ntClub?.roster?.length){
      console.warn('[brfut] elenco seleção indisponível',userNationalTeamName);
      return false;
    }
    worldCupMatchSquad=cloneNationalTeamRoster(ntClub.roster);
    activeUserSquad=worldCupMatchSquad;
    const matchFormation=getNationalTeamFormation(userNationalTeamCode);
    formation=matchFormation;
    orderRosterForFormation(activeUserSquad,matchFormation);
    positionAssignments=[...(formationRoles[matchFormation]||formationRoles['4-3-3'])];
    return true;
  };
  const bindSquadForUserFixture=async game=>{
    if(!isWorldCupUserFixture(game,userNationalTeamName))return bindSquadForUserFixtureSync(game);
    await preloadNationalTeamClubs();
    return bindSquadForUserFixtureSync(game);
  };
  const releaseWorldCupSquadBinding=()=>{
    activeUserSquad=squad;
    worldCupMatchSquad=null;
    const clubFormation=clubs[userClub]?.formation;
    if(clubFormation&&formationRoles[clubFormation]){
      formation=clubFormation;
      positionAssignments=[...formationRoles[clubFormation]];
    }
  };
  /** Troca titulares indisponíveis sem redesenhar a escalação organizada. */
  const sanitizeUserStartersForMatch=()=>{
    const matchFormation=resolveUserMatchFormation(liveMatchGame||nextUserGame);
    const roles=formationRoles[matchFormation]||formationRoles['4-3-3'];
    for(let slot=0;slot<11;slot++){
      const starter=activeUserSquad[slot];
      if(starter&&!playerUnavailable(starter)&&!playerStarterBlocked(starter))continue;
      const expected=roles[slot]||starter?.pos;
      const bench=activeUserSquad.slice(11).filter(player=>!playerUnavailable(player)&&!playerStarterBlocked(player));
      if(!bench.length)continue;
      const compatible=bench.filter(player=>player.pos===expected||(compatibleRoles[expected]||[]).includes(player.pos));
      const incoming=(compatible.length?compatible:bench).sort((a,b)=>roleAttributeScore(b,expected)-roleAttributeScore(a,expected)||b.overall-a.overall)[0];
      if(!incoming)continue;
      const benchIndex=activeUserSquad.indexOf(incoming);
      if(benchIndex<11)continue;
      [activeUserSquad[slot],activeUserSquad[benchIndex]]=[incoming,starter];
    }
  };
  const autoSelectUserLineup=(targetFormation,{restrictToField=false,liveCards=null}={})=>{
    const roles=formationRoles[targetFormation]||formationRoles['4-3-3'];positionAssignments=[...roles];
    if(!isWorldCupUserFixture(liveMatchGame||nextUserGame,userNationalTeamName))clubs[userClub].formation=targetFormation;
    if(restrictToField&&liveCards){
      const current=activeUserSquad.slice(0,11),activeSlots=roles.map((_,slot)=>slot).filter(slot=>!liveCards[slot]?.red),activePlayers=activeSlots.map(slot=>current[slot]),assignment=lineupForRoles(activePlayers,roles,activeSlots),cardByPlayer=new Map(current.map((player,index)=>[player,liveCards[index]])),next=[...current],nextCards=[...liveCards];
      activeSlots.forEach(slot=>{next[slot]=assignment.get(slot);nextCards[slot]=cardByPlayer.get(next[slot])||{yellow:0,red:false};});
      activeUserSquad.splice(0,11,...next);liveCards.splice(0,liveCards.length,...nextCards);return;
    }
    orderRosterForFormation(activeUserSquad,targetFormation);
    if(liveCards)liveCards.splice(0,liveCards.length,...roles.map(()=>({yellow:0,red:false})));
  };
  const suggestFormationLineup=(targetFormation,liveCards)=>{
    const roles=formationRoles[targetFormation]||formationRoles['4-3-3'],current=activeUserSquad.slice(0,11),activeSlots=roles.map((_,slot)=>slot).filter(slot=>!liveCards?.[slot]?.red),activePlayers=activeSlots.map(slot=>current[slot]),assignment=lineupForRoles(activePlayers,roles,activeSlots),moves=activeSlots.filter(slot=>assignment.get(slot)&&assignment.get(slot)!==current[slot]).map(slot=>({player:assignment.get(slot),role:roles[slot]}));
    tactics?.openFormationSuggestion?.(targetFormation,liveCards,moves);
  };
  let tactics;
  let draw=()=>{},drawBoard=()=>{},renderTacticRoster=()=>{},renderSubstitutionControls=()=>{},makeSubstitution=()=>{},syncTactics=()=>{},applyTacticSuggestion=()=>{},closeFormationSuggestion=()=>{},tacticFor;
  clubs[userClub].roster=squad;
  Object.values(clubs).filter(club=>club.name!==userClub).forEach(club=>orderRosterForFormation(club.roster,club.formation));
  const fieldMarkup='<div class="field-markings"><i class="mid-line"></i><i class="centre-circle"></i><i class="centre-spot"></i><i class="area area-top"></i><i class="area area-bottom"></i><i class="six-yard six-top"></i><i class="six-yard six-bottom"></i><i class="spot spot-top"></i><i class="spot spot-bottom"></i><i class="goal goal-top"></i><i class="goal goal-bottom"></i></div>';

  const matchLiveUi=createMatchLiveUiFeature({
    $,onClick,clamp,fieldMarkup,
    getMinute:()=>minute,
    getStoppageElapsed:()=>stoppageElapsed,
    getStoppageActive:()=>stoppageActive,
    getStoppageFirst:()=>stoppageFirst,
    getStoppageSecond:()=>stoppageSecond,
    getMatchStarted:()=>matchStarted,
    getMatchFinished:()=>matchFinished,
    getPreMatchPreparation:()=>preMatchPreparation,
    getHalftimeShown:()=>halftimeShown,
    getSecondHalfStarted:()=>secondHalfStarted,
    getShootoutState:()=>shootoutState,
    getScores:()=>calendarLiveScores(),
    getGoals:()=>calendarLiveSideGoals(),
    getVolumeSamples:()=>liveVolumeSamples,
    getVolumeIncidents:()=>calendarLiveVolumeIncidents(),
    getUserClub:()=>userClub,
    getUserNationalTeamName:()=>userNationalTeamName,
    getUserAtHome:()=>userAtHomeInLiveMatch(),
    getUserDivision:()=>userDivision,
    getCurrentRound:()=>currentRound,
    getClubs:()=>clubs,
    getSerieDGroups:()=>serieDGroups,
    getUserSerieDGroupIndex:()=>userSerieDGroupIndex,
    displayedClubPosition,
    serieDGroupRounds:SERIE_D_GROUP_ROUNDS,
    fixtureDetails,
    formatVenueCrowdLine,
    clubCrestInitials,
    getMatchClub:()=>matchClub(),
    getStats:()=>stats,
    getCards:()=>cards,
    getFormations:()=>formations,
    getTactics:()=>tactics,
    playerNameCell,
    fatigueCell,
    getClubManagerName:clubName=>managerRanking.byClub(clubName)?.name||clubs[clubName]?.managerName||getNationalTeamClub(clubName)?.managerName||'—',
    getPauses:()=>pauses,
    incrementPauses:()=>++pauses,
    openPreparation:title=>openPreparation(title),
    renderStats:()=>renderStats(),
    stopMatchClock:()=>stopMatchClock(),
    startMatchClock:()=>startMatchClock(),
    matchLiveAudio,
  });
  matchLiveUi.injectOpponentModal();
  const renderLiveMatchHeader=matchLiveUi.renderHeader;
  const score=matchLiveUi.score;
  const log=matchLiveUi.log;
  const renderLiveOpponent=matchLiveUi.renderLiveOpponent;
  const openLiveOpponentAnalysis=matchLiveUi.openLiveOpponentAnalysis;
  const bindLiveActions=matchLiveUi.bindLiveActions;
  const updateLiveMatchClock=matchLiveUi.updateClock;
  
  
  
  
  
  
  
  
  
  
  
  
  
  document.body.insertAdjacentHTML('beforeend',`<div id="teamScoutModal" class="modal hidden"><div class="modal-card scout-modal"><button id="closeTeamScout" class="close">×</button><h2 id="scoutClubName"></h2><div id="scoutClubMeta"></div><div class="scout-layout"><div class="scout-roster"><h3>Titulares</h3><div id="scoutStarters"></div><h3>Reservas</h3><div id="scoutBench"></div></div><div class="scout-side"><div class="pause-pitch tactical-board scout-pitch">${fieldMarkup}<div id="scoutPitchPlayers"></div></div><p class="scout-manager" id="scoutManager"><small>TÉCNICO</small><strong>—</strong></p><section id="scoutSummary" class="club-summary"><div class="summary-top"><div class="overall-box"><small>OVERALL</small><strong id="scoutOverall"></strong></div><div id="scoutEnvironment" class="environment-gauge"><div><strong></strong><small>AMBIENTE</small></div></div></div><div class="leader-table"><small>DESTAQUES DA TEMPORADA</small><div><span>ARTILHEIRO</span><b id="scoutScorer"></b><em id="scoutGoals"></em></div><div><span>ASSISTÊNCIAS</span><b id="scoutAssistant"></b><em id="scoutAssists"></em></div></div></section></div></div></div></div>`);
  
  
  
  // Padrão único para todas as tabelas e listagens geradas pelo jogo.
  
  
  
  const playerSeasonAvgLabel=player=>{
    const key=playerKey(player);
    const bucket=playerHistory?.getPlayer?.(key)?.seasons?.[String(careerSeason)];
    const avg=bucket?.avgRating!=null?Number(bucket.avgRating):seasonAverageRating(bucket);
    return formatMatchRating(avg);
  };
  const analysisTable=(title,players,{numbered=false,slotOffset=0,clubName=''}={})=>`<section class="analysis-roster"><h3>${title}</h3><div class="analysis-head"><span>JOGADOR</span><span>POS.</span><span>OVR</span><span>MÉDIA</span><span>CANSAÇO</span></div>${players.map((player,index)=>`<div class="analysis-player" data-slot="${slotOffset+index}" tabindex="0">${playerNameCell(player.name,player,{prefix:numbered?(index+1)+'. ': '',openCard:true,clubName})}<span>${player.pos}</span><span>${player.overall}</span><span class="analysis-avg">${playerSeasonAvgLabel(player)}</span>${fatigueCell(player)}</div>`).join('')}</section>`;
  const clubManagerName=clubName=>managerRanking.byClub(clubName)?.name||clubs[clubName]?.managerName||(clubName===userClub?careerProfile.managerName:null)||'—';
  let unbindScoutBoardHover=null;
  const scoutBoardPlayerLabel=name=>{
    const labelOf=tactics?.boardPlayerLabel||(n=>{
      const parts=(n||'').split(' ').filter(Boolean);
      const short=parts.length>1?parts[parts.length-1]:parts[0]||n;
      return short.length>8?`${short.slice(0,7)}…`:short;
    });
    return labelOf(name,8);
  };
  const renderScoutPitchBoard=(starters,formationKey)=>{
    const coords=formations[formationKey]||formations['4-3-3'];
    $('#scoutPitchPlayers').innerHTML=coords.map((p,i)=>{
      const player=starters[i];
      const label=scoutBoardPlayerLabel(player?.name||'—');
      const title=player?.name||'—';
      const top=p[1]===91?90:p[1];
      return `<div class="board-player" data-slot="${i}" title="${title}" style="left:${p[0]}%;top:${top}%"><i style="--energy:${clamp(player?.fatigue??0,0,100)}%"><span>${i+1}</span></i><small>${label}</small></div>`;
    }).join('');
    unbindScoutBoardHover?.();
    const scoutRoster=$('#teamScoutModal .scout-roster');
    unbindScoutBoardHover=bindBoardRosterHover({
      rosterRoot:scoutRoster,
      pitchRoot:()=>$('#scoutPitchPlayers'),
      rowSelector:'.analysis-player[data-slot]',
    });
  };
  const openScout=name=>{
    const nt=resolveNationalTeam(name);
    if(nt){openNationalTeamScout(nt.code);return;}
    const club=clubs[name];
    if(!club)return;
    const leaders=clubSeasonLeaders(name);
    const roster=club.roster.map((player,index)=>ensurePlayerId(player,{club:name,index}));
    const coords=formations[club.formation]||formations['4-3-3'];
    const overall=Math.round(roster.slice(0,11).reduce((sum,p)=>sum+p.overall,0)/11);
    $('#scoutClubName').innerHTML=clubCrestTitleHtml(club.name,{initialsFn:clubCrestInitials});
    $('#scoutClubMeta').innerHTML=`<div class="scout-club-meta"><span class="scout-meta-chip"><small>FORMAÇÃO</small><b>${club.formation||'—'}</b></span><span class="scout-meta-chip"><small>ESTILO</small><b>${club.style||'—'}</b></span><span class="scout-meta-chip"><small>MENTALIDADE</small><b>${club.mentality||'—'}</b></span><span class="scout-meta-chip"><small>CLASSIFICAÇÃO</small><b>${club.position!=null?`${club.position}º na tabela`:'—'}</b></span></div>`;
    const managerEl=$('#scoutManager strong');
    if(managerEl)managerEl.textContent=clubManagerName(name);
    $('#scoutOverall').textContent=overall;
    setIndicatorTone($('#scoutEnvironment'),club.environment);
    $('#scoutEnvironment').style.setProperty('--environment',club.environment);
    $('#scoutEnvironment strong').textContent=`${club.environment}%`;
    $('#scoutScorer').textContent=leaders.scorer.name;$('#scoutGoals').textContent=`${leaders.goals} G`;
    $('#scoutAssistant').textContent=leaders.assistant.name;$('#scoutAssists').textContent=`${leaders.assists} A`;
    $('#scoutStarters').innerHTML=analysisTable('TITULARES',roster.slice(0,11),{numbered:true,slotOffset:0,clubName:name});
    $('#scoutBench').innerHTML=analysisTable('RESERVAS',roster.slice(11),{slotOffset:11,clubName:name});
    renderScoutPitchBoard(roster.slice(0,11),club.formation||'4-3-3');
    $('#teamScoutModal').classList.remove('hidden');
  };
  openNationalTeamScout=async code=>{
    const meta=nationalTeamByCode(code);
    if(!meta)return;
    await preloadNationalTeamClubs();
    const cached=getNationalTeamClub(meta.name);
    const ntTactics=getNationalTeamTactics(code);
    const ntFormation=ntTactics.formation;
    try{
      let roster=cached?.roster;
      let teamPower=cached?.power;
      if(!roster?.length){
        const {loadWorldCupSquads,getWorldCupTeam}=await import('../engine/world-cup-squads.js');
        const data=await loadWorldCupSquads();
        const team=getWorldCupTeam(data,code);
        if(!team?.players?.length)return;
        const strength=worldCupCompetition?.teamStrength?.[meta.code];
        const club=buildNationalTeamClub(meta,team,{teamPower:strength?.teamPower||team.teamPower});
        roster=club?.roster;
        teamPower=club?.power;
        if(!roster?.length)return;
      }
      const displayRoster=cloneNationalTeamRoster(roster);
      orderRosterForFormation(displayRoster,ntFormation);
      const overall=Math.round(
        displayRoster.slice(0,11).reduce((sum,player)=>sum+(Number(player.overall)||0),0)/Math.max(1,Math.min(11,displayRoster.length)),
      );
      unbindScoutBoardHover?.();
      unbindScoutBoardHover=null;
      $('#scoutClubName').innerHTML=clubCrestTitleHtml(meta.name,{initialsFn:clubCrestInitials});
      $('#scoutClubMeta').innerHTML=`<div class="scout-club-meta"><span class="scout-meta-chip"><small>FORMAÇÃO</small><b>${ntFormation}</b></span><span class="scout-meta-chip"><small>ESTILO</small><b>${ntTactics.style}</b></span><span class="scout-meta-chip"><small>MENTALIDADE</small><b>${ntTactics.mentality}</b></span><span class="scout-meta-chip"><small>RANKING FIFA</small><b>${meta.fifaRank}º</b></span><span class="scout-meta-chip"><small>FORÇA CMU</small><b>${teamPower}</b></span></div>`;
      const managerEl=$('#scoutManager strong');
      if(managerEl)managerEl.textContent='Convite técnico · Copa do Mundo';
      $('#scoutOverall').textContent=overall;
      setIndicatorTone($('#scoutEnvironment'),teamPower);
      $('#scoutEnvironment').style.setProperty('--environment',teamPower);
      $('#scoutEnvironment strong').textContent=String(teamPower);
      $('#scoutScorer').textContent='—';
      $('#scoutGoals').textContent='—';
      $('#scoutAssistant').textContent='—';
      $('#scoutAssists').textContent='—';
      $('#scoutStarters').innerHTML=analysisTable('TITULARES',displayRoster.slice(0,11),{numbered:true,slotOffset:0,clubName:meta.name});
      $('#scoutBench').innerHTML=analysisTable('RESERVAS',displayRoster.slice(11),{slotOffset:11,clubName:meta.name});
      renderScoutPitchBoard(displayRoster.slice(0,11),ntFormation);
      const scoutRoster=$('#teamScoutModal .scout-roster');
      scoutRoster?.classList.remove('scout-roster-disabled');
      $('#teamScoutModal').classList.remove('hidden');
    }catch(error){
      console.warn('[brfut] elenco seleção',error);
    }
  };
  nationalTeamOffersUi=createNationalTeamOffersUiFeature({
    $,
    getCareerSeason:()=>careerSeason,
    onAccept:({code})=>acceptNationalTeamOfferFromPopup(code),
    onViewTeam:code=>openNationalTeamScout(code),
    onDenyAll:()=>denyAllNationalTeamOffers(),
  });
  nationalTeamOffersUi.init();
  queueMicrotask(()=>maybeShowNationalTeamOfferPopup());
  const openClubFromTable=target=>{
    const clubTarget=target.closest?.('[data-club],[data-national-team]');
    if(!clubTarget)return false;
    const ntCode=clubTarget.dataset.nationalTeam;
    if(ntCode){openNationalTeamScout(ntCode);return true;}
    const name=clubTarget?.dataset.club;
    if(!name)return false;
    const nt=resolveNationalTeam(name);
    if(nt){openNationalTeamScout(nt.code);return true;}
    if(!clubs[name])return false;
    if(matchStarted&&!matchFinished&&name===matchClub()?.name){openLiveOpponentAnalysis();return true;}
    openScout(name);
    return true;
  };
  document.addEventListener('click',event=>openClubFromTable(event.target));
  document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&openClubFromTable(event.target))event.preventDefault();});
  
  
  
  
  document.body.insertAdjacentHTML('beforeend',`<div id="competitionRulesModal" class="modal hidden"><div class="modal-card competition-rules-modal"><button id="closeCompetitionRules" class="close" type="button">×</button><label id="competitionRulesKicker">REGULAMENTO</label><h2 id="competitionRulesTitle">Regras</h2><div id="competitionRulesBody" class="competition-rules-body"></div></div></div>`);
  document.body.insertAdjacentHTML('beforeend',`<div id="championshipModal" class="modal hidden"><div class="modal-card championship-modal"><button id="closeChampionship" class="close">×</button><label id="championshipDivisionLabel">CAMPEONATO BRASILEIRO · SÉRIE A</label><h2>Brasileirão 2026</h2><small id="championshipFormat" class="championship-format"></small><div id="divisionTabs" class="division-tabs">${Object.keys(divisionRules).map(division=>`<button data-division="${division}">SÉRIE ${division}</button>`).join('')}<button data-competition="CUP">COPA DO BRASIL</button></div><div id="serieDModeTabs" class="serie-d-mode-tabs hidden" role="tablist" aria-label="Fase da Série D"><button type="button" data-serie-d-mode="groups">GRUPOS</button><button type="button" data-serie-d-mode="knockout">MATA-MATA</button></div><div class="championship-grid"><section><h3>Tabela</h3><div class="champ-head"><span>#</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span></div><div id="championshipTable"></div></section><aside class="championship-sidebar"></aside></div></div></div>`);
  let championshipRoundView=currentRound,championshipGroupView=userSerieDGroupIndex,championshipLeaderMode='scorers';
  const serieCRelegationZone=serieCRelegationSlots();
  const leagueClassificationZone=(division,index,total)=>classificationZone(division,index,total,serieCRelegationZone);
  const championshipRoundLimit=division=>{
    if(String(division||'').startsWith('EST:'))return stateLeagueEngine.getRoundLimit(division);
    if(division==='CUP')return Math.max(1,(cupCompetition.stages||[]).length);
    return Math.max(1,Array.isArray(nationalCompetitions[division]?.fixtures)?nationalCompetitions[division].fixtures.length:1);
  };
  const championshipRoundHistory=division=>{
    if(String(division||'').startsWith('EST:')){
      const parsed=parseStateCompetitionKey(division);
      return parsed?(stateLeagueEngine.history[parsed.uf]||[]):[];
    }
    return (division===userDivision?seasonRoundHistory:competitionRoundHistory[division])||[];
  };
  const isStateChampionshipDivision=division=>String(division||'').startsWith('EST:');
  const renderChampionshipLeaders=()=>{
    const scope=$('#championshipLeaderScope'),table=$('#championshipLeadersTable');
    if(!scope||!table)return;
    const division=championshipDivision,mode=championshipLeaderMode,metric=mode==='scorers'?'goals':'assists',entries=championshipLeadersFor(division,mode);
    scope.textContent=division==='CUP'?'Copa do Brasil':`Série ${division}`;
    $('#championshipLeaderValueName').textContent=mode==='scorers'?'GOLS':'AST';
    $$('[data-championship-leader-tab]').forEach(button=>button.classList.toggle('active',button.dataset.championshipLeaderTab===mode));
    table.innerHTML=entries.slice(0,5).length?entries.slice(0,5).map((entry,index)=>`<div class="championship-leader-row ${entry.club===userClub?'user-leader':''}"><span>${index+1}</span><span><b>${entry.name}</b><small class="club-link" data-club="${entry.club}" role="button" tabindex="0">${entry.club}</small></span><span>${entry[metric]}</span></div>`).join(''):'<div class="championship-leaders-empty">Aguardando estatísticas oficiais da competição.</div>';
  };
  const renderChampionshipRound=()=>{
    const limit=championshipRoundLimit(championshipDivision);championshipRoundView=clamp(championshipRoundView,1,limit);
    if(championshipDivision==='CUP'){
      const stage=cupCompetition.stages[championshipRoundView-1],games=stage?.fixtures||[],completed=Boolean(stage?.completed);
      $('#championshipRoundTitle').textContent=stage?.name||'Fase aguardando sorteio';$('#championshipRoundStatus').textContent=completed?'FASE CONCLUÍDA':stage?'CONFRONTOS CONFIRMADOS':'AGUARDANDO SORTEIO';$('#championshipPreviousRound').disabled=championshipRoundView<=1;$('#championshipNextRound').disabled=championshipRoundView>=limit;
      $('#futureMatches').innerHTML=games.map(game=>{const displayGame=cupGameForDisplay(game),userGame=isUserFixture(displayGame),score=displayGame.completed?`<strong class="round-score">${displayGame.homeGoals} — ${displayGame.awayGoals}${displayGame.penalties?` (${displayGame.penalties})`:''}</strong>`:'<i>×</i>';return `<div class="fixture-row round-browser-row ${displayGame.completed?'completed':''} ${userGame?'user-round':''}"><small>JOGO ${displayGame.gameNumber} · ${displayGame.leg}${userGame?' · SEU JOGO':''} · ${fixtureDetails(displayGame).display}</small><b class="round-fixture-line"><span class="club-link" data-club="${displayGame.home}" role="button" tabindex="0">${displayGame.home}</span>${score}<span class="club-link" data-club="${displayGame.away}" role="button" tabindex="0">${displayGame.away}</span></b></div>`;}).join('')||'<div class="fixture-row round-empty"><small>AGUARDANDO SORTEIO</small><b>A próxima fase será criada somente após a conclusão de todos os confrontos atuais.</b></div>';
      renderChampionshipLeaders();
      return;
    }
    if(isStateChampionshipDivision(championshipDivision)){
      const division=stateLeagueEngine.getDivisionForBrowse(championshipDivision,userClub);
      const saved=championshipRoundHistory(championshipDivision).find(item=>item.round===championshipRoundView);
      let games=stateLeagueEngine.getRoundGamesForBrowse(championshipDivision,championshipRoundView,{simulateMatch:simulateRoundMatch});
      let completed=Boolean(saved?.games?.length)||games.every(game=>game.completed);
      const phaseLabel=stateLeagueEngine.getRoundPhaseLabel(championshipDivision,championshipRoundView);
      $('#championshipRoundTitle').textContent=phaseLabel;
      $('#championshipRoundStatus').textContent=completed?'RODADA CONCLUÍDA':games.length?'RODADA PROGRAMADA':'FASE A DEFINIR';
      $('#championshipPreviousRound').disabled=championshipRoundView<=1;
      $('#championshipNextRound').disabled=championshipRoundView>=limit;
      $('#futureMatches').innerHTML=games.map(game=>{const userGame=isUserFixture(game),score=completed&&game.homeGoals!=null?`<strong class="round-score">${game.homeGoals} — ${game.awayGoals}</strong>`:'<i>×</i>';return `<div class="fixture-row round-browser-row ${completed&&game.homeGoals!=null?'completed':''} ${userGame?'user-round':''}"><small>${completed&&game.homeGoals!=null?'ENCERRADO':phaseLabel}${userGame?' · SEU JOGO':''}${game.phase==='groups'&&Number.isFinite(game.game?.groupIndex)?` · Grupo ${String.fromCharCode(65+game.game.groupIndex)}`:''}</small><b class="round-fixture-line"><span class="club-link" data-club="${game.home}" role="button" tabindex="0">${game.home}</span>${score}<span class="club-link" data-club="${game.away}" role="button" tabindex="0">${game.away}</span></b></div>`;}).join('')||'<div class="fixture-row round-empty"><small>AGUARDANDO DEFINIÇÃO</small><b>Os confrontos desta fase ainda serão definidos pelo campeonato.</b></div>';
      if($('#championshipGroupNav')){$('#championshipGroupNav').classList.add('hidden');$('#championshipGroupNav').innerHTML='';}
      renderChampionshipLeaders();
      return;
    }
    const competition=nationalCompetitions[championshipDivision],saved=championshipRoundHistory(championshipDivision).find(item=>item.round===championshipRoundView),fixtures=competition.fixtures[championshipRoundView-1]||[];
    const roundPreview=championshipDivision===userDivision&&championshipRoundView===currentRound?pendingRoundPreviewGames():null;
    let games=saved?.games?.length?saved.games:fixtures,completed=Boolean(saved?.games?.length);
    if(roundPreview?.length){games=roundPreview;completed=true;}status=completed?'RODADA CONCLUÍDA':games.length?'RODADA PROGRAMADA':'FASE A DEFINIR';$('#championshipRoundTitle').textContent=`Rodada ${championshipRoundView}`;$('#championshipRoundStatus').textContent=status;$('#championshipPreviousRound').disabled=championshipRoundView<=1;$('#championshipNextRound').disabled=championshipRoundView>=limit;
    let displayGames=games;
    const groupNav=$('#championshipGroupNav');
    if(championshipDivision==='D'&&championshipRoundView<=10){
      championshipGroupView=clamp(championshipGroupView,0,Math.max(0,serieDGroups.length-1));
      const groupSet=new Set(serieDGroups[championshipGroupView]||[]);
      displayGames=games.filter(game=>groupSet.has(game.home)&&groupSet.has(game.away));
      if(groupNav){
        groupNav.classList.remove('hidden');
        const userGroup=championshipGroupView===userSerieDGroupIndex;
        groupNav.innerHTML=`<button class="round-navigation" type="button" data-championship-group-step="-1" aria-label="Grupo anterior">←</button><div><small>${userGroup?'SEU GRUPO':'CONFRONTOS DO GRUPO'}</small><h4>Grupo A${championshipGroupView+1}</h4></div><button class="round-navigation" type="button" data-championship-group-step="1" aria-label="Próximo grupo">→</button>`;
      }
    }else if(groupNav){groupNav.classList.add('hidden');groupNav.innerHTML='';}
    $('#futureMatches').innerHTML=displayGames.map(game=>{const userGame=isUserFixture(game),score=completed?`<strong class="round-score">${game.homeGoals} — ${game.awayGoals}${game.penalties?` (${game.penalties})`:''}</strong>`:'<i>×</i>';return `<div class="fixture-row round-browser-row ${completed?'completed':''} ${userGame?'user-round':''}"><small>${completed?'ENCERRADO':`RODADA ${championshipRoundView}`}${isKnockoutShootoutCompetition(game)?` · ${game.leg}`:''}${userGame?' · SEU JOGO':''}</small><b class="round-fixture-line"><span class="club-link" data-club="${game.home}" role="button" tabindex="0">${game.home}</span>${score}<span class="club-link" data-club="${game.away}" role="button" tabindex="0">${game.away}</span></b></div>`;}).join('')||'<div class="fixture-row round-empty"><small>AGUARDANDO DEFINIÇÃO</small><b>Os confrontos desta fase ainda serão definidos pelo campeonato.</b></div>';
    if(championshipDivision==='D')$$('[data-championship-group]').forEach(card=>card.classList.toggle('active-view',Number(card.dataset.championshipGroup)===championshipGroupView));
    renderChampionshipLeaders();
  };
  const renderSerieDGroupCard=(group,groupIndex,competition,{featured=false}={})=>{
    const slots=competition.knockout?.qualifiedPerGroup||4;
    const previewStandings=userDivision==='D'?standingsRowsForDisplay('D'):competition.standings;
    const groupRows=group.map(club=>previewStandings.find(row=>row.club===club)||emptySerieDStanding(club))
      .sort((a,b)=>b.points-a.points||b.wins-a.wins||b.goalDiff-a.goalDiff);
    // Destaque (grupo do usuário): colunas completas no padrão BR Fut. Compacto: # / clube / J / PTS.
    const head=featured
      ?'<div class="d-group-head d-group-head-full"><span>#</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span></div>'
      :'<div class="d-group-head"><span>#</span><span>CLUBE</span><span>J</span><span>PTS</span></div>';
    const rows=groupRows.map((row,index)=>{
      const zone=index<slots?'qualified':'';
      const mine=row.club===userClub?'user-club':'';
      if(featured){
        const sg=row.goalDiff>=0?`+${row.goalDiff}`:String(row.goalDiff);
        return `<div class="d-group-row d-group-row-full ${zone} ${mine}" data-club="${row.club}" role="button" tabindex="0"><span>${index+1}</span><span class="club-link">${row.club}</span><span>${row.played}</span><span>${row.wins}</span><span>${row.draws}</span><span>${row.losses}</span><span>${sg}</span><span>${row.points}</span></div>`;
      }
      return `<div class="d-group-row ${zone} ${mine}" data-club="${row.club}" role="button" tabindex="0"><span>${index+1}</span><span class="club-link">${row.club}</span><span>${row.played}</span><span>${row.points}</span></div>`;
    }).join('');
    return `<article class="d-group-card ${featured?'user-group-card':''} ${!featured?'compact':''}" data-championship-group="${groupIndex}" role="button" tabindex="0" title="Ver jogos do Grupo A${groupIndex+1}"><h4>GRUPO A${groupIndex+1}${featured?'<em>SEU GRUPO</em>':''}</h4>${head}${rows}</article>`;
  };
  const markCupPhaseSelection=phaseIndex=>{
    $$('#championshipTable [data-cup-phase]').forEach(button=>{
      const index=Number(button.dataset.cupPhase);
      button.classList.toggle('current',index===phaseIndex);
    });
  };
  const markSerieDPhaseSelection=phaseIndex=>{
    $$('#championshipTable [data-serie-d-phase]').forEach(button=>{
      const index=Number(button.dataset.serieDPhase);
      button.classList.toggle('current',index===phaseIndex);
    });
  };
  const serieDRoundHistoryGames=round=>{
    const history=(userDivision==='D'?seasonRoundHistory:competitionRoundHistory.D)||[];
    return history.find(item=>item.round===round)?.games||[];
  };
  const serieDStageFixturesMerged=startRound=>{
    const fixtures=nationalCompetitions.D.fixtures||[];
    const raw=[...(fixtures[startRound-1]||[]),...(fixtures[startRound]||[])];
    const historyGames=[...serieDRoundHistoryGames(startRound),...serieDRoundHistoryGames(startRound+1)];
    return raw.map(fixture=>{
      const played=historyGames.find(item=>item.home===fixture.home&&item.away===fixture.away);
      if(!played)return {...fixture};
      return {
        ...fixture,
        ...played,
        completed:true,
        penalties:played.penalties||fixture.penalties,
        shootoutWinner:played.shootoutWinner||fixture.shootoutWinner,
        winner:played.winner||fixture.winner,
      };
    });
  };
  const serieDKnockoutPhaseMeta=definition=>{
    const stageTies=nationalCompetitions.D.knockout?.stages?.[definition.key];
    if(!stageTies?.length)return {status:'AGUARDANDO SORTEIO',generated:false,completed:false};
    const fixtures=serieDStageFixturesMerged(definition.startRound);
    const tieIds=[...new Set(fixtures.map(game=>game.tieId).filter(Boolean))];
    const completed=tieIds.length>0&&tieIds.every(tieId=>{
      const games=fixtures.filter(game=>game.tieId===tieId);
      return games.length>0&&games.every(game=>game.completed);
    });
    return {status:completed?'CONCLUÍDA':'EM DISPUTA',generated:true,completed};
  };
  const syncSerieDModeTabs=()=>{
    const tabs=$('#serieDModeTabs');
    if(!tabs)return;
    const show=championshipDivision==='D'&&isSerieDKnockoutUiActive();
    tabs.classList.toggle('hidden',!show);
    if(!show)return;
    $$('#serieDModeTabs [data-serie-d-mode]').forEach(button=>{
      const active=button.dataset.serieDMode===championshipSerieDMode;
      button.classList.toggle('active',active);
      button.setAttribute('aria-selected',active?'true':'false');
    });
  };
  const pendingRoundPreviewGames=()=>{
    if(!(matchFinished&&!roundCommitted&&liveMatchGame))return null;
    if(liveMatchGame.competition==='COPA DO BRASIL')return null;
    if(userDivision==='D'&&currentRound>SERIE_D_GROUP_ROUNDS)return null;
    return simulateRoundResults();
  };
  const applyTablePreviewToRows=(rows,game)=>{
    if(!game||!rows?.length)return rows;
    const next=rows.map(row=>({...row}));
    const homeRow=next.find(row=>row.club===game.home);
    const awayRow=next.find(row=>row.club===game.away);
    if(!homeRow||!awayRow)return rows;
    homeRow.played++;awayRow.played++;
    homeRow.goalDiff+=game.homeGoals-game.awayGoals;
    awayRow.goalDiff+=game.awayGoals-game.homeGoals;
    if(game.homeGoals>game.awayGoals){homeRow.wins++;awayRow.losses++;homeRow.points+=3;}
    else if(game.homeGoals<game.awayGoals){awayRow.wins++;homeRow.losses++;awayRow.points+=3;}
    else{homeRow.draws++;awayRow.draws++;homeRow.points++;awayRow.points++;}
    return next;
  };
  const standingsRowsForDisplay=(division)=>{
    const competition=nationalCompetitions[division];
    if(!competition?.standings?.length)return [];
    let rows=competition.standings.map(row=>({...row}));
    const pendingGames=pendingRoundPreviewGames();
    if(pendingGames?.length&&division===userDivision){
      pendingGames.forEach(game=>{
        rows=applyTablePreviewToRows(rows,{
          home:game.home,
          away:game.away,
          homeGoals:game.homeGoals,
          awayGoals:game.awayGoals,
        });
      });
    }
    return rows.sort((a,b)=>b.points-a.points||b.goalDiff-a.goalDiff||b.wins-a.wins);
  };
  openChampionship=(division=championshipDivision)=>{
    championshipDivision=division;
    const table=$('#championshipTable'),head=$('#championshipModal .champ-head'),heading=$('#championshipModal .championship-grid>section>h3'),championshipGrid=$('#championshipModal .championship-grid');
    if(isStateChampionshipDivision(division)){
      const stateDivision=stateLeagueEngine.getDivisionForBrowse(division,userClub);
      $$('#divisionTabs button').forEach(button=>button.classList.toggle('active',false));
      championshipGrid?.classList.remove('serie-d-view','cup-view');
      $('#championshipDivisionLabel').textContent=`CAMPEONATO ESTADUAL · ${stateDivision?.uf||''}`;
      $('#championshipModal>div>h2').textContent=stateDivision?.label||'Campeonato Estadual';
      $('#championshipFormat').textContent=`${stateDivision?.teams?.length||0} CLUBES · PONTOS CORRIDOS + SEMI + FINAL · ${stateDivision?.complete?'ENCERRADO':'EM DISPUTA'}`;
      heading.textContent='Classificação';
      head.style.display='grid';
      head.innerHTML='<span>#</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>';
      table.className='';
      const rows=sortStandingsRows([...(stateDivision?.standings?.[0]||[])]);
      table.innerHTML=rows.map((row,index)=>`<div class="champ-row ${index<4?'promotion':''} ${row.club===userClub?'highlight':''}" data-club="${row.club}" role="button" tabindex="0"><span>${index+1}</span><span class="club-link">${row.club}</span><span>${row.played}</span><span>${row.wins}</span><span>${row.draws}</span><span>${row.losses}</span><span>${row.goalDiff>=0?'+':''}${row.goalDiff}</span><span>${row.points}</span></div>`).join('')||'<div class="championship-leaders-empty">Sem classificação disponível.</div>';
      championshipRoundView=clamp(stateLeagueEngine.getCurrentRound(division,userClub),1,championshipRoundLimit(division));
      syncSerieDModeTabs();
      renderChampionshipRound();
      $('#championshipModal').classList.remove('hidden');
      return;
    }
    const serieDKoAvailable=division==='D'&&isSerieDKnockoutUiActive();
    if(serieDKoAvailable){
      if(championshipSerieDMode!=='groups'&&championshipSerieDMode!=='knockout')championshipSerieDMode='knockout';
    }else if(division==='D'){
      championshipSerieDMode='groups';
    }
    const serieDKo=serieDKoAvailable&&championshipSerieDMode==='knockout';
    $$('#divisionTabs button').forEach(button=>button.classList.toggle('active',button.dataset.division===division||button.dataset.competition===division));
    championshipGrid?.classList.toggle('serie-d-view',division==='D'&&!serieDKo);
    championshipGrid?.classList.toggle('cup-view',division==='CUP'||serieDKo);
    if(division==='CUP'){
      $('#championshipDivisionLabel').textContent='COMPETIÇÃO NACIONAL · COPA DO BRASIL';
      $('#championshipModal>div>h2').textContent=`Copa do Brasil ${careerSeason}`;
      $('#championshipFormat').textContent='126 CLUBES · 9 FASES · SORTEIOS PROGRESSIVOS · FASE ATUAL CONFIRMADA APÓS A ANTERIOR';
      heading.textContent='Fases da competição';
      head.style.display='none';
      table.className='cup-stage-table';
      const stageCount=Math.max(1,cupCompetition.stages.length||1);
      championshipRoundView=clamp(championshipRoundView||cupCompetition.currentPhase||1,1,stageCount);
      table.innerHTML=cupPhaseDefinitions.map(definition=>{
        const stage=cupCompetition.stages.find(item=>item.index===definition.index);
        const status=stage?.completed?'CONCLUÍDA':stage?'EM DISPUTA':'AGUARDANDO SORTEIO';
        const classes=['cup-stage-row'];
        if(stage)classes.push('generated');
        if(stage?.completed)classes.push('completed');
        return `<button class="${classes.join(' ')}" type="button" data-cup-phase="${definition.index}" ${stage?'':'disabled'}><span>${definition.index}</span><b>${definition.name}</b><small>${definition.teams} CLUBES · ${definition.twoLegged?'IDA E VOLTA':'JOGO ÚNICO'}</small><em>${status}</em></button>`;
      }).join('');
      markCupPhaseSelection(championshipRoundView);
      syncSerieDModeTabs();
      $('#championshipModal').classList.remove('hidden');
      return;
    }
    const competition=nationalCompetitions[division],rows=standingsRowsForDisplay(division);
    $('#championshipDivisionLabel').textContent=`CAMPEONATO BRASILEIRO · SÉRIE ${division}`;
    $('#championshipModal>div>h2').textContent=`Brasileirão ${careerSeason}`;
    if(serieDKo){
      $('#championshipFormat').textContent='SÉRIE D · MATA-MATA · IDA E VOLTA · FASE CONFIRMADA APÓS A ANTERIOR';
      heading.textContent='Fases eliminatórias';
      head.style.display='none';
      table.className='cup-stage-table';
      championshipRoundView=clamp(championshipRoundView||serieDPhaseIndexForRound(currentRound),1,serieDKnockoutPhaseDefs.length);
      table.innerHTML=serieDKnockoutPhaseDefs.map(definition=>{
        const meta=serieDKnockoutPhaseMeta(definition);
        const classes=['cup-stage-row'];
        if(meta.generated)classes.push('generated');
        if(meta.completed)classes.push('completed');
        return `<button class="${classes.join(' ')}" type="button" data-serie-d-phase="${definition.index}" ${meta.generated?'':'disabled'}><span>${definition.index}</span><b>${definition.name}</b><small>${definition.teams} CLUBES · IDA E VOLTA${definition.key==='semi'?' · + REPESCAGEM':''}</small><em>${meta.status}</em></button>`;
      }).join('');
      markSerieDPhaseSelection(championshipRoundView);
      syncSerieDModeTabs();
      $('#championshipModal').classList.remove('hidden');
      return;
    }
    $('#championshipFormat').textContent=division==='D'
      ?(serieDKoAvailable
        ?`${userClub} · GRUPO A${userSerieDGroupIndex+1} · FASE DE GRUPOS CONCLUÍDA · 4 primeiros avançaram`
        :`${userClub} · GRUPO A${userSerieDGroupIndex+1} · 4 primeiros avançam`)
      :`${competition.clubs} CLUBES · ${competition.format.toUpperCase()} · ${competition.promotion?`${competition.promotion} ACESSOS`:''}${competition.relegation?` · ${competition.relegation} REBAIXADOS`:''}`;
    if(division==='D'){
      // Destaque fixo no grupo do usuário; a lateral continua podendo trocar o filtro de confrontos.
      const userIdx=clamp(Math.max(0,userSerieDGroupIndex),0,Math.max(0,(competition.groups?.length||1)-1));
      championshipGroupView=userIdx;
      if(championshipRoundView>SERIE_D_GROUP_ROUNDS)championshipRoundView=SERIE_D_GROUP_ROUNDS;
      heading.textContent=`Fase de grupos · A${userIdx+1}`;head.style.display='none';table.className='series-d-table';
      const focusGroupHtml=renderSerieDGroupCard(competition.groups[userIdx],userIdx,competition,{featured:true});
      const othersHtml=competition.groups.map((group,groupIndex)=>groupIndex===userIdx?'':renderSerieDGroupCard(group,groupIndex,competition)).filter(Boolean).join('');
      table.innerHTML=`<div class="series-d-layout">${focusGroupHtml}<div class="d-group-others"><p class="d-group-others-label">Demais grupos</p><div class="d-group-grid d-group-grid-compact">${othersHtml}</div></div></div>`;
    }else{
      heading.textContent='Tabela';head.style.display='grid';table.className='';
      table.innerHTML=rows.map((row,index)=>`<div class="champ-row ${leagueClassificationZone(division,index,rows.length)} ${row.club===userClub?'highlight':''}" data-club="${row.club}" role="button" tabindex="0"><span>${index+1}</span><span class="club-link">${row.club}</span><span>${row.played}</span><span>${row.wins}</span><span>${row.draws}</span><span>${row.losses}</span><span>${row.goalDiff>=0?'+':''}${row.goalDiff}</span><span>${row.points}</span></div>`).join('');
    }
    renderChampionshipRound();
    syncSerieDModeTabs();
    $('#championshipModal').classList.remove('hidden');
  };
  onClick('#divisionTabs',event=>{
    const button=event.target.closest('[data-division],[data-competition]');
    if(!button)return;
    const competition=button.dataset.competition||button.dataset.division;
    if(competition==='CUP')championshipRoundView=cupCompetition.currentPhase;
    else if(competition==='D'&&isSerieDKnockoutUiActive()){
      championshipSerieDMode='knockout';
      championshipRoundView=serieDPhaseIndexForRound(currentRound);
    }else{
      championshipRoundView=clamp(currentRound,1,championshipRoundLimit(competition));
    }
    openChampionship(competition);
  });
  onClick('#serieDModeTabs',event=>{
    const button=event.target.closest('[data-serie-d-mode]');
    if(!button||championshipDivision!=='D'||!isSerieDKnockoutUiActive())return;
    const mode=button.dataset.serieDMode==='groups'?'groups':'knockout';
    if(mode===championshipSerieDMode)return;
    championshipSerieDMode=mode;
    if(mode==='knockout')championshipRoundView=serieDPhaseIndexForRound(currentRound);
    else{
      championshipGroupView=Math.max(0,userSerieDGroupIndex);
      championshipRoundView=Math.min(currentRound,SERIE_D_GROUP_ROUNDS)||SERIE_D_GROUP_ROUNDS;
    }
    openChampionship('D');
  });
  onClick('#championshipTable',event=>{
    const phase=event.target.closest('[data-cup-phase]');
    if(phase&&championshipDivision==='CUP'&&!phase.disabled){
      championshipRoundView=Number(phase.dataset.cupPhase);
      markCupPhaseSelection(championshipRoundView);
      openCupBracket(championshipRoundView);
      return;
    }
    const serieDPhase=event.target.closest('[data-serie-d-phase]');
    if(serieDPhase&&championshipDivision==='D'&&!serieDPhase.disabled){
      championshipRoundView=Number(serieDPhase.dataset.serieDPhase);
      markSerieDPhaseSelection(championshipRoundView);
      openSerieDBracket(championshipRoundView);
      return;
    }
    const groupCard=event.target.closest('[data-championship-group]');
    if(groupCard&&championshipDivision==='D'&&!event.target.closest('[data-club]')){
      championshipGroupView=Number(groupCard.dataset.championshipGroup);
      renderChampionshipRound();
    }
  });
  onClick('#inspectOpponent',()=>openScout(matchClub().name));
  onClick('#closeTeamScout',()=>{
    unbindScoutBoardHover?.();
    unbindScoutBoardHover=null;
    $('#teamScoutModal').classList.add('hidden');
  });
  onClick('#closeChampionship',()=>{closeCupBracket();$('#championshipModal').classList.add('hidden');});

  // A janela completa do campeonato mantém foco na classificação e na agenda.
  
  const championshipSidebar=$('#championshipModal .championship-grid aside');
  championshipSidebar.className='championship-sidebar';
  // Ordem BR Fut Série D: Grupo primeiro, Rodada depois (confrontos abaixo).
  championshipSidebar.innerHTML=`<section class="championship-upcoming"><div id="championshipGroupNav" class="round-browser-nav championship-group-nav hidden"></div><div class="round-browser-nav"><button id="championshipPreviousRound" class="round-navigation" type="button" aria-label="Rodada anterior">←</button><div><small id="championshipRoundStatus">RODADA PROGRAMADA</small><h3 id="championshipRoundTitle">Rodada ${currentRound}</h3></div><button id="championshipNextRound" class="round-navigation" type="button" aria-label="Próxima rodada">→</button></div><div id="futureMatches"></div></section><section id="championshipLeadersPanel" class="championship-leaders"><label>LÍDERES DO CAMPEONATO<em id="championshipLeaderScope">Série A</em></label><div class="championship-leader-tabs" role="tablist"><button class="active" type="button" data-championship-leader-tab="scorers">ARTILHEIROS</button><button type="button" data-championship-leader-tab="assists">ASSISTÊNCIAS</button></div><div class="championship-leader-head"><span>#</span><span>JOGADOR</span><span id="championshipLeaderValueName">GOLS</span></div><div id="championshipLeadersTable"></div></section>`;
  onClick('#championshipPreviousRound',()=>{championshipRoundView--;renderChampionshipRound();});
  onClick('#championshipNextRound',()=>{championshipRoundView++;renderChampionshipRound();});
  championshipSidebar.addEventListener('click',event=>{const leaderTab=event.target.closest('[data-championship-leader-tab]');if(leaderTab){championshipLeaderMode=leaderTab.dataset.championshipLeaderTab;renderChampionshipLeaders();return;}const groupStep=Number(event.target.closest('[data-championship-group-step]')?.dataset.championshipGroupStep||0);if(!groupStep||championshipDivision!=='D'||championshipRoundView>10)return;championshipGroupView=(championshipGroupView+groupStep+serieDGroups.length)%serieDGroups.length;renderChampionshipRound();});

  document.body.insertAdjacentHTML('beforeend',`<div id="cupBracketModal" class="modal hidden cup-bracket-modal"><div class="modal-card"><button id="closeCupBracket" class="close" type="button" aria-label="Fechar">×</button><header class="cup-bracket-head"><div class="cup-bracket-titles"><label id="cupBracketCompetitionLabel">CHAVEAMENTO · COPA DO BRASIL</label><h2 id="cupBracketTitle">Fase</h2></div><div id="cupBracketActions"></div></header><div id="cupBracketBody" class="cup-bracket-body"></div></div></div>`);
  let bracketCompetition='CUP';
  let openCupBracket=()=>{};
  let openSerieDBracket=()=>{};
  let closeCupBracket=()=>{$('#cupBracketModal')?.classList.add('hidden');};
  let goCupBracketNextPhase=()=>{};
  let goCupBracketPrevPhase=()=>{};
  const setBracketCompetitionLabel=text=>{
    const label=$('#cupBracketCompetitionLabel');
    if(label)label.textContent=text;
  };
  onClick('#closeCupBracket',()=>closeCupBracket());
  onClick('#cupBracketModal',event=>{
    if(event.target.id==='cupBracketModal'){closeCupBracket();return;}
    if(event.target.closest('[data-cup-bracket-close]')){closeCupBracket();return;}
    if(event.target.closest('[data-cup-bracket-prev]:not(:disabled)')){goCupBracketPrevPhase();return;}
    if(event.target.closest('[data-cup-bracket-next]:not(:disabled)')){goCupBracketNextPhase();return;}
  });

  const starters = () => activeUserSquad.slice(0,11);
  const activeStarters=()=>starters().filter((player,index)=>!playerUnavailable(player)&&!cards?.home?.[index]?.red&&!cards?.home?.[index]?.injured);
  const seasonContext = {home:{streak:2,position:4,isHome:true},away:{streak:1,position:9,isHome:false}};
  const contextFactor = context => clamp(1 + context.streak*.004 + (context.isHome?.028:0) + (10-context.position)*.001 + rnd(-.009,.009),.975,1.038);
  let timer, minute, home, away, pauses, stats, cards, halftimeShown, secondHalfStarted=false, pendingPenalty, shootoutState=null, matchFactors, goals, liveVolumeSamples=[], liveVolumePrev=null, liveVolumePulse={home:0.1,away:0.1}, liveVolumeIncidents=[], disciplineEvents, preMatchPreparation=false, substitutions=0, awaySubstitutions=0, awaySubWindows=0, substitutedOut=new Set(), activePreparationTitle='', matchDiscipline={home:new Map(),away:new Map()},liveInjuries={home:[],away:[]},liveDeferredInjuries={home:[],away:[]},liveOpeningLineup={home:[],away:[]},liveMinutesPlayed={home:new Map(),away:new Map()},availabilityCommitted=false,roundResultMessagePushed=false,preMatchTacticSnapshot=null,pauseLineupBaseline=null,stoppageFirst=0,stoppageSecond=0,stoppageElapsed=0,stoppageActive=null,stoppageHalfSnap=null;
  const matchRatingsEngine=createMatchRatingsEngine({
    clamp,
    matchPlayerStat,
    clubInstitutionalContext,
    playerUnavailable,
    formationPerformance,
    compatibleRoles,
    getTactics:()=>tactics,
    getFormation:()=>formation,
    getStarters:starters,
    getClubs:()=>clubs,
    getUserClub:()=>userClub,
    getMatchClub:matchClub,
    getNextUserGame:()=>nextUserGame,
    getMatchFactors:()=>matchFactors,
    getCards:()=>cards,
    getStats:()=>stats,
    getHomeScore:()=>home,
    getAwayScore:()=>away,
    getPositionAssignments:()=>positionAssignments,
    getTacticFor:side=>tacticFor(side),
  });
  tacticFor=side=>{
    if(tactics?.tacticFor)return tactics.tacticFor(side);
    return matchRatingsEngine.defaultTacticFor(side);
  };
  const {profile,opponentForMatch,actorData,playerFor,tacticalDiscipline,liveOverall,cautionPenalty}=matchRatingsEngine;
  const blank=blankMatchStats;
  const influencePossession = (side, value) => {
    const rival=side === 'home' ? 'away' : 'home';
    stats[side].momentum=clamp(stats[side].momentum+value*.52,-12,12);
    stats[rival].momentum=clamp(stats[rival].momentum-value*.22,-12,12);
  };
  engineProgressiveFoulRisk=(otherSide,attacker,defender)=>engineProgressiveFoulRiskBase(otherSide,attacker,defender,tacticalDiscipline);
  const totalCards = () => disciplineEvents || 0;
  playerHistory=createPlayerHistoryEngine({
    getClub:name=>resolveClubForStats(name),
    // Buffer de logs = só a temporada corrente, limitado ao nº real de jogos (ligas + copa).
    getMatchLogBudget:()=>{
      let total=0;
      Object.values(nationalCompetitions||{}).forEach(competition=>{
        total+=(competition.fixtures||[]).reduce((sum,round)=>sum+(Array.isArray(round)?round.length:0),0);
      });
      total+=(copaDoBrasilFixtures||[]).length;
      total+=(worldCupFixtures||[]).length;
      const cap=PLAYER_HISTORY_LIMITS.maxMatchLogsPerSeason;
      return total>0?Math.min(total,cap):cap;
    },
  });
  const syncLeaderboardFromPlayerHistory=clubName=>{
    if(!playerHistory||!clubName)return;
    const fromHistory=clubSeasonLeadersFromHistory(playerHistory.getStore(),clubName,careerSeason,{getClub:resolveClubForStats});
    const division=clubs[clubName]?.division||getNationalTeamClub(clubName)?.division||userDivision;
    const upsertLeader=(list,metric,person,value)=>{
      if(!person?.name||person.name==='—'||!(value>0))return;
      let row=list.find(item=>item.club===clubName&&item.name===person.name);
      if(!row){
        const player=(clubs[clubName]?.roster||getNationalTeamClub(clubName)?.roster||[]).find(item=>item.name===person.name);
        row={name:person.name,club:clubName,division,games:0,goals:0,assists:0,tieValue:0};
        if(metric==='goals')row.tieValue=(player?.finishing||50)+(player?.heading||50)*.2;
        else row.tieValue=(player?.passing||50)+(player?.playmaking||50);
        list.push(row);
      }
      if((Number(row[metric])||0)<value)row[metric]=value;
    };
    upsertLeader(allScorers,'goals',fromHistory.scorer,fromHistory.goals);
    upsertLeader(allAssistants,'assists',fromHistory.assistant,fromHistory.assists);
    allScorers.sort((a,b)=>b.goals-a.goals||b.tieValue-a.tieValue||a.games-b.games);
    allAssistants.sort((a,b)=>b.assists-a.assists||b.tieValue-a.tieValue||a.games-b.games);
  };
  const backfillClubHistoryFromSave=(clubName,{roundHistory=[],extraGames=[],competitionForRound}={})=>{
    if(!playerHistory||!clubName)return;
    const histStore=playerHistory.getStore();
    if(histStore.season==null)histStore.season=careerSeason;
    backfillClubSeasonMatchLogs(playerHistory,{
      clubName,
      season:careerSeason,
      roundHistory,
      extraGames,
      competitionForRound,
    });
    syncLeaderboardFromPlayerHistory(clubName);
  };
  if(validSavedSeason||savedNewGame){
    backfillClubHistoryFromSave(userClub,{
      roundHistory:seasonRoundHistory,
      extraGames:(copaDoBrasilFixtures||[]).filter(game=>game?.completed&&Number.isFinite(Number(game.homeGoals))&&(game.home===userClub||game.away===userClub)),
      competitionForRound:()=>`LEAGUE:${userDivision}`,
    });
    if(userNationalTeamName){
      backfillClubHistoryFromSave(userNationalTeamName,{
        roundHistory:[],
        extraGames:(worldCupFixtures||[]).filter(game=>game?.completed&&Number.isFinite(Number(game.homeGoals))&&(game.home===userNationalTeamName||game.away===userNationalTeamName)),
        competitionForRound:()=>WORLD_CUP_COMPETITION,
      });
    }
    playerHistory.persist();
  }
  renderTeamStatsCard?.();
  playerDevelopment=normalizeDevelopmentState(
    validSavedSeason?savedSeason?.playerDevelopment:null,
    careerSeason,
  );
  rosterOvrMarkHtml=player=>{
    const id=resolvePlayerId(player)||playerKey(player)||historyPlayerKey(player);
    const mark=getActiveOvrMark(playerDevelopment,id,careerCalendarDate,{weeks:OVR_MARK_WEEKS});
    if(!mark)return '';
    return formatOvrMarkHtml(mark.delta,{weeks:OVR_MARK_WEEKS});
  };
  const rosterChangePlayerId=player=>resolvePlayerId(player)||playerKey(player)||historyPlayerKey(player);
  scanUserRosterChangeAlerts=()=>{
    if(!playerDevelopment||!squad?.length)return;
    scanRosterStatusChanges(squad,playerDevelopment,careerCalendarDate,{
      getPlayerId:rosterChangePlayerId,
      fingerprint:p=>buildPlayerStatusFingerprint(p,{injuryInAcutePhase,injuryInRestrictedPhase}),
    });
  };
  updateSquadChangeNavBadge=()=>{
    if(!playerDevelopment)return;
    const count=countActiveRosterChangeAlerts(squad,playerDevelopment,careerCalendarDate,rosterChangePlayerId,{forNav:true});
    const badge=$('#squadChangeNavBadge');
    badge?.classList.toggle('hidden',count<=0);
    const nav=document.querySelector('.nav[data-view="squad"]');
    if(nav&&count>0){
      nav.dataset.changeAlerts=String(count);
    }else if(nav){
      delete nav.dataset.changeAlerts;
    }
  };
  rosterChangeAlertHolder.fn=player=>getActiveRosterChangeAlert(playerDevelopment,rosterChangePlayerId(player),careerCalendarDate);
  scanUserRosterChangeAlerts();
  rosterTrainingXpHtml=player=>{
    const id=resolvePlayerId(player)||playerKey(player)||historyPlayerKey(player);
    const progress=getTrainingProgressForPlayer(playerDevelopment,id);
    const active=trainingRules.freeMode===TRAINING_FREE_MODES.development;
    return formatRosterTrainingXpHtml(progress,{active});
  };
  const getDevelopmentSeasonBucket=player=>{
    const key=historyPlayerKey(player);
    if(!key)return null;
    return playerHistory.getPlayer(key)?.seasons?.[String(careerSeason)]||null;
  };
  const accumulateWeeklyTraining=result=>{
    if(!result?.dayApplied)return;
    weeklyTrainingAccumulator.days+=1;
    weeklyTrainingAccumulator.totalXp+=Number(result.totalXp)||0;
    if(result.avgEnergy!=null)weeklyTrainingAccumulator.avgEnergy=result.avgEnergy;
    if(result.blockedCount)weeklyTrainingAccumulator.blockedCount+=result.blockedCount;
    if(result.exhaustedWarning)weeklyTrainingAccumulator.exhaustedWarning=true;
    (result.gains||[]).forEach(entry=>{
      const key=`${entry.playerId}|${entry.attr}`;
      const row=weeklyTrainingAccumulator.gains.find(item=>`${item.playerId}|${item.attr}`===key);
      if(row){
        row.attrDelta=(row.attrDelta||0)+(entry.attrDelta||0);
        row.ovrDelta=(row.ovrDelta||0)+(entry.ovrDelta||0);
      }else weeklyTrainingAccumulator.gains.push({...entry});
    });
  };
  const flushWeeklyTrainingReport=()=>{
    if(!weeklyTrainingAccumulator.days)return;
    const report=finalizeWeeklyTrainingReport(weeklyTrainingAccumulator,trainingRules);
    const roster=clubs[userClub]?.roster||squad||[];
    const rosterById=new Map();
    roster.forEach(player=>{
      const id=resolvePlayerId(player)||playerKey(player)||historyPlayerKey(player);
      if(id)rosterById.set(id,player);
    });
    (report.playerEntries||[]).forEach(entry=>{
      const player=rosterById.get(entry.playerId);
      if(player)entry.overall=Number(player.overall)||null;
    });
    lastWeeklyTrainingReport=report;
    pushMessage({
      category:'club',
      type:'training-weekly',
      title:'RELATÓRIOS DE TREINAMENTOS',
      body:report.body,
      round:currentRound,
      read:false,
      meta:{
        trainingMode:trainingRules.freeMode,
        developmentFocus:trainingRules.developmentFocus,
        days:report.days,
        trainingModeLabel:report.modeLabel,
        evolvedPlayers:report.playerEntries,
        avgEnergy:report.avgEnergy,
      },
    });
    weeklyTrainingAccumulator=emptyWeeklyTrainingReport();
  };
  applyCalendarTrainingDay=type=>{
    if(type==='free'&&trainingRules.freeMode===TRAINING_FREE_MODES.development){
      const club=clubs[userClub];
      const isYouthFocus=trainingRules.developmentFocus==='youth';
      const roster=isYouthFocus?collectYouthTrainingPlayers(club):(club?.roster||[]);
      if(!roster?.length){recoverOtherClubs(1,1);return;}
      const result=applyDevelopmentTrainingDay({
        roster,
        focus:isYouthFocus?'youth':trainingRules.developmentFocus,
        state:playerDevelopment,
        getPlayerId:player=>resolvePlayerId(player)||playerKey(player)||historyPlayerKey(player),
        getSeasonMinutes:player=>isYouthFocus?0:(Number(getDevelopmentSeasonBucket(player)?.minutes)||0),
        institutionRecovery:clubInstitutionalContext(club).recovery,
        careerDate:careerCalendarDate,
      });
      accumulateWeeklyTraining(result);
      if(result.changed&&!isYouthFocus){
        syncClubPowers(clubs);
        if(clubs[userClub]?.roster)squad.splice(0,squad.length,...clubs[userClub].roster);
      }else if(result.changed&&isYouthFocus){
        try{persistSeason();}catch{/* boot */}
      }
      try{renderRoster();}catch{/* boot */}
      recoverOtherClubs(1,1);
      return;
    }
    applyTrainingDay(type);
  };
  const playerCardModal=createPlayerCardModal({
    getUserClub:()=>userClub,
    getUserSquad:()=>activeUserSquad,
    getCareerSeason:()=>careerSeason,
    getPlayerHistory:()=>playerHistory,
    getTransfersUi:()=>transfersUi,
    getTransfersEngine:()=>transfersEngine,
    getClubs:()=>clubs,
    findPlayerInWorld:playerId=>{
      const fromTransfers=transfersEngine?.findPlayerInWorld?.(playerId);
      if(fromTransfers?.player)return fromTransfers;
      const youth=clubs[userClub]?.youthRoster?.find(p=>resolvePlayerId(p)===playerId);
      if(youth)return{player:youth,clubName:userClub};
      return findPlayerInNationalTeamClubs(playerId,nationalTeamClubsByName,resolvePlayerId);
    },
  });
  playerCardModal.bindHandlers();
  const youthUiLazy=createLazyFeature(async()=>{
    const {createYouthAcademyFeature}=await import('../feature/youth-academy/index.js');
    const ui=createYouthAcademyFeature({
      $,
      onClick,
      formatBudget,
      getBalance,
      getUserClub:()=>userClub,
      userClubState:()=>clubs[userClub],
      getClubs:()=>clubs,
      getUserDivision:()=>userDivision,
      getCareerSeason:()=>careerSeason,
      getCareerDate:()=>careerCalendarDate,
      getUserUf:()=>savedNewGame?.userUf||getRealClub(userClub)?.uf||'SP',
      getRetiredPool:()=>savedNewGame?.retiredPool||[],
      evaluateRosterPayroll,
      pushMessage,
      openPlayerCard:payload=>playerCardModal.open(payload),
      syncUserSquad:()=>{if(clubs[userClub])squad.splice(0,squad.length,...clubs[userClub].roster);syncCareerRosters();},
      structureLevelLabel,
      getStructureLevel,
      firstNames,
      lastNames,
      onBudgetChanged:()=>{renderClubBudget();economyUi?.renderOffice?.();},
    });
    youthUi=ui;
    return ui;
  });
  router.onView('youth',()=>{void youthUiLazy.ensure().then(ui=>ui.render?.());});
  const applyDevelopmentPulseResult=result=>{
    if(!result||result.skipped)return false;
    playerDevelopment=result.state;
    if(clubs[userClub]?.roster){
      squad.splice(0,squad.length,...clubs[userClub].roster);
      try{syncCareerRosters();}catch{/* boot */}
    }
    try{renderRoster();}catch{/* boot */}
    return true;
  };
  const syncCalendarDevelopmentPulses=()=>{
    if(!savedNewGame)return;
    const {state,results}=ensureCalendarDevelopmentPulses({
      clubs,
      date:careerCalendarDate,
      season:careerSeason,
      state:playerDevelopment,
      getSeasonBucket:getDevelopmentSeasonBucket,
    });
    playerDevelopment=state;
    if(results.some(item=>!item.skipped)){
      if(clubs[userClub]?.roster){
        squad.splice(0,squad.length,...clubs[userClub].roster);
        if(!isCalendarBatch()){
          try{syncCareerRosters();}catch{/* boot */}
          try{renderRoster();}catch{/* boot */}
        }
      }
    }
  };
  const runSeasonEndDevelopmentPulse=()=>{
    if(!savedNewGame)return;
    const result=runDevelopmentPulse({
      clubs,
      pulseId:PULSE_IDS.seasonEnd,
      season:careerSeason,
      state:playerDevelopment,
      getSeasonBucket:getDevelopmentSeasonBucket,
      date:careerCalendarDate,
    });
    applyDevelopmentPulseResult(result);
  };
  careerCalendar.setOnAdvanced(()=>{
    autoMarkStaleMessages?.();
    syncCalendarDevelopmentPulses();
    try{scanUserRosterChangeAlerts();updateSquadChangeNavBadge();}catch{/* boot */}
  });
  syncCalendarDevelopmentPulses();
  try{renderRoster();}catch{/* boot */}
  const liveSideMapsToFixture=game=>{
    if(!liveMatchGame||!game)return {swap:false};
    if(game.home!==liveMatchGame.home||game.away!==liveMatchGame.away)return {swap:false};
    return {swap:liveMatchGame.home!==userSideNameForGame(liveMatchGame)};
  };
  const disciplineMapToList=map=>{
    if(!map)return [];
    const entries=map instanceof Map?[...map.entries()]:Object.entries(map);
    return entries.map(([name,card])=>({
      name,
      yellow:card?.dismissal?0:(Number(card?.yellow)||0),
      dismissal:card?.dismissal||null,
      redContext:card?.redContext||null,
    })).filter(entry=>entry.yellow||entry.dismissal);
  };
  const enrichGameForHistory=game=>{
    if(!game?.home||!game?.away)return game;
    if(game.workload?.home?.length||game.workload?.away?.length)return game;
    const {swap}=liveSideMapsToFixture(game);
    if(!liveMatchGame||(game.home!==liveMatchGame.home&&game.home!==liveMatchGame.away))return game;
    const userSide='home',oppSide='away';
    const fixtureHomeLive=swap?oppSide:userSide;
    const fixtureAwayLive=swap?userSide:oppSide;
    const workloadFrom=side=>{
      const raw=liveMinutesPlayed?.[side];
      const entries=raw instanceof Map?[...raw.entries()]:Object.entries(raw||{});
      const opening=Array.isArray(liveOpeningLineup?.[side])?liveOpeningLineup[side]:[];
      return entries
        .filter(([,mins])=>(Number(mins)||0)>0)
        .map(([name,mins])=>({
          name,
          minutes:Math.round(Number(mins)||0),
          started:opening.includes(name),
        }));
    };
    const dataFromStats=()=>{
      const h=stats?.home||{},a=stats?.away||{};
      if(!swap){
        return {
          homePasses:Number(h.passes)||0,awayPasses:Number(a.passes)||0,
          homeAccurate:Number(h.accurate)||0,awayAccurate:Number(a.accurate)||0,
          homeShots:Number(h.shots)||0,awayShots:Number(a.shots)||0,
          homeOnTarget:Number(h.on)||0,awayOnTarget:Number(a.on)||0,
          homeSaved:Number(h.saved)||0,awaySaved:Number(a.saved)||0,
          homeKeeperSaves:Number(h.keeperSaves??h.saved)||0,awayKeeperSaves:Number(a.keeperSaves??a.saved)||0,
          homeYellow:Number(h.yellow)||0,awayYellow:Number(a.yellow)||0,
          homeRed:Number(h.red)||0,awayRed:Number(a.red)||0,
          homePossession:Number(h.possession)||0,awayPossession:Number(a.possession)||0,
          homeXg:Number(h.xg)||0,awayXg:Number(a.xg)||0,
        };
      }
      return {
        homePasses:Number(a.passes)||0,awayPasses:Number(h.passes)||0,
        homeAccurate:Number(a.accurate)||0,awayAccurate:Number(h.accurate)||0,
        homeShots:Number(a.shots)||0,awayShots:Number(h.shots)||0,
        homeOnTarget:Number(a.on)||0,awayOnTarget:Number(h.on)||0,
        homeSaved:Number(a.saved)||0,awaySaved:Number(h.saved)||0,
        homeKeeperSaves:Number(a.keeperSaves??a.saved)||0,awayKeeperSaves:Number(h.keeperSaves??h.saved)||0,
        homeYellow:Number(a.yellow)||0,awayYellow:Number(h.yellow)||0,
        homeRed:Number(a.red)||0,awayRed:Number(h.red)||0,
        homePossession:Number(a.possession)||0,awayPossession:Number(h.possession)||0,
        homeXg:Number(a.xg)||0,awayXg:Number(h.xg)||0,
      };
    };
    return {
      ...game,
      data:game.data||liveMatchGame.data||dataFromStats(),
      goals:game.goals||(swap
        ?{home:[...(goals?.away||[])],away:[...(goals?.home||[])]}
        :{home:[...(goals?.home||[])],away:[...(goals?.away||[])]}),
      workload:{home:workloadFrom(fixtureHomeLive),away:workloadFrom(fixtureAwayLive)},
      discipline:{home:disciplineMapToList(matchDiscipline[fixtureHomeLive]),away:disciplineMapToList(matchDiscipline[fixtureAwayLive])},
    };
  };
  const recordPlayerHistoryMatch=(game,meta={})=>{
    const enriched=enrichGameForHistory(game);
    return playerHistory.recordMatch(enriched,{
      season:careerSeason,
      round:meta.round??game.round??currentRound,
      competition:meta.competition||game.competition||`LEAGUE:${clubs[game.home]?.division||userDivision}`,
      leg:meta.leg||game.leg||null,
      date:meta.date||null,
      id:meta.id,
      persist:meta.persist!==false,
    });
  };
  const beginPauseLineupEdit=()=>{
    if(preMatchPreparation){pauseLineupBaseline=null;return;}
    pauseLineupBaseline=starters().map(player=>player.name);
  };
  const finalizePauseLineupEdits=()=>{
    if(!pauseLineupBaseline)return;
    const currentXI=new Set(starters().map(player=>player.name));
    const entered=starters().filter(player=>!pauseLineupBaseline.includes(player.name)).map(player=>player.name);
    let enterAt=0;
    pauseLineupBaseline.forEach(name=>{
      if(currentXI.has(name)||substitutedOut.has(name))return;
      const wasInjured=liveInjuries.home.some(entry=>entry.name===name);
      substitutions++;
      substitutedOut.add(name);
      if(wasInjured)liveInjuries.home=liveInjuries.home.filter(entry=>entry.name!==name);
      const incomingName=entered[enterAt++]||null;
      log(`Substituição no ${userClub}: sai ${name}${incomingName?`, entra ${incomingName}`:''}.`,'substitution','home');
      // Só registra no volume quando há par completo (evita seta vermelha sem quem entrou).
      if(incomingName)pushLiveVolumeIncident('home','substitution',{name:`${name} → ${incomingName}`});
    });
    pauseLineupBaseline=null;
  };
  /** Marcadores do Volume: cartões/lesões/pênalti perdido/substituição com minuto (lado do motor). */
  const pushLiveVolumeIncident=(engineSide,type,meta={})=>{
    if(engineSide!=='home'&&engineSide!=='away')return;
    if(!['yellow','red','injury','penalty-miss','substitution'].includes(type))return;
    const stoppageMin=stoppageActive?Math.max(0,Number(stoppageElapsed)||0):0;
    liveVolumeIncidents.push({
      minute:Math.min(90,Math.max(0,Number(minute)||0)),
      stoppage:stoppageMin||undefined,
      side:engineSide,
      type,
      name:meta.name||null,
    });
    matchLiveUi?.refreshMatchFeed?.();
  };
  const calendarLiveVolumeIncidents=()=>{
    if(userAtHomeInLiveMatch())return liveVolumeIncidents.map(item=>({...item}));
    return liveVolumeIncidents.map(item=>({...item,side:item.side==='home'?'away':'home'}));
  };
  const liveDayMatches=createLiveDayMatchesFeature({
    $, $$, onClick, clamp,
    getLiveMatchGame: () => liveMatchGame,
    getMinute: () => minute,
    getGoals: () => goals,
    getPreMatchPreparation: () => preMatchPreparation,
    getMatchFinished: () => matchFinished,
    getHalftimeShown: () => halftimeShown,
    getUserClub: () => userClub,
    getUserDivision: () => userDivision,
    getCurrentRound: () => currentRound,
    getClubs: () => clubs,
    getNationalCompetitions: () => nationalCompetitions,
    getCopaDoBrasilFixtures: () => copaDoBrasilFixtures,
    getSerieDGroups: () => serieDGroups,
    getUserSerieDGroupIndex: () => userSerieDGroupIndex,
    SERIE_D_GROUP_ROUNDS,
    isUserFixture,
    isKnockoutShootoutCompetition,
    fixtureDetails,
    fixtureDateFor,
    calendarKey,
    simulateRoundMatch,
    getCareerCalendarDate: () => careerCalendarDate,
    getSeasonRoundHistory: () => seasonRoundHistory,
    getCompetitionRoundHistory: () => competitionRoundHistory,
    getCareerSeed: () => savedNewGame?.seed,
  });
  const modal = $('#matchModal'), timeline = $('#timeline');
  const stopMatchClock=()=>{clearInterval(timer);matchLiveUi.stopLiveSecondTimer();};
  startMatchClock=()=>{stopMatchClock();timer=setInterval(tick,optionsUi.getPaceMs());if(matchStarted&&!matchFinished&&!preMatchPreparation)matchLiveUi.startLiveSecondTimer();updateLiveMatchClock();};
  const userAtHomeInLiveMatch=()=>{
    if(!liveMatchGame)return true;
    if(liveMatchGame.competition===WORLD_CUP_COMPETITION&&userNationalTeamName){
      return liveMatchGame.home===userNationalTeamName;
    }
    return liveMatchGame.home===userClub;
  };
  const calendarLiveScores=()=>userAtHomeInLiveMatch()?{home,away}:{home:away,away:home};
  const calendarLiveSideStats=()=>userAtHomeInLiveMatch()?{home:stats.home,away:stats.away}:{home:stats.away,away:stats.home};
  const calendarLiveSideGoals=()=>{
    const empty={home:[],away:[]};
    if(!goals)return empty;
    return userAtHomeInLiveMatch()
      ?{home:goals.home||[],away:goals.away||[]}
      :{home:goals.away||[],away:goals.home||[]};
  };
  const volumeSideSnapshot=sideStats=>({
    attacks:Number(sideStats?.attacks)||0,
    goodAttacks:Number(sideStats?.goodAttacks)||0,
    shots:Number(sideStats?.shots)||0,
    on:Number(sideStats?.on)||0,
    corners:Number(sideStats?.corners)||0,
  });
  /**
   * Volume = pressão ofensiva do tick.
   * Sobe em ataques/chegadas/chutes/gols; cai rápido quando o time não ataca.
   */
  const recordLiveVolumeSample=()=>{
    if(!stats||!matchStarted||preMatchPreparation)return;
    const cur={
      home:volumeSideSnapshot(stats.home),
      away:volumeSideSnapshot(stats.away),
      goalsHome:(goals?.home||[]).length,
      goalsAway:(goals?.away||[]).length,
    };
    const prev=liveVolumePrev||cur;
    const attackPressure=side=>{
      const d=key=>Math.max(0,(cur[side][key]||0)-(prev[side][key]||0));
      // Só sinais de ataque — defesa/posse não empurram a barra.
      const pressure=
        d('attacks')*.48+
        d('goodAttacks')*.85+
        d('shots')*1.05+
        d('on')*.55+
        d('corners')*.6;
      if(pressure>0){
        liveVolumePulse[side]=clamp(Math.max(liveVolumePulse[side]*.28,pressure),.08,1);
      }else{
        liveVolumePulse[side]=clamp(liveVolumePulse[side]*.48,.03,.85);
      }
      return liveVolumePulse[side];
    };
    let homeAmp=attackPressure('home');
    let awayAmp=attackPressure('away');
    if(cur.goalsHome>(prev.goalsHome||0))homeAmp=liveVolumePulse.home=1;
    if(cur.goalsAway>(prev.goalsAway||0))awayAmp=liveVolumePulse.away=1;
    liveVolumePrev=cur;
    if(!userAtHomeInLiveMatch())[homeAmp,awayAmp]=[awayAmp,homeAmp];
    const sampleMinute=Math.min(90,Math.max(0,minute));
    const sampleStoppage=stoppageActive?Math.max(0,Number(stoppageElapsed)||0):0;
    const last=liveVolumeSamples[liveVolumeSamples.length-1];
    if(last&&last.minute===sampleMinute&&(Number(last.stoppage)||0)===sampleStoppage){
      // Mantém o pico ofensivo do minuto; só baixa se ambos os lados esfriaram.
      last.home=Math.max(homeAmp,last.home*.55);
      last.away=Math.max(awayAmp,last.away*.55);
      return;
    }
    liveVolumeSamples.push({minute:sampleMinute,stoppage:sampleStoppage||undefined,home:homeAmp,away:awayAmp});
    if(liveVolumeSamples.length>MEMORY_LIMITS.liveVolumeSamples){
      liveVolumeSamples.splice(0,liveVolumeSamples.length-MEMORY_LIMITS.liveVolumeSamples);
    }
  };
  const ensureTacticalConfrontationSlots=()=>{
    if(!$('#tacticalConfrontationPause')&&$('#pausePanel')){
      const heading=$('#pausePanel .pause-heading');
      if(heading)heading.insertAdjacentHTML('afterend','<div id="tacticalConfrontationPause"></div>');
    }
    if(!$('#tacticalConfrontationTactics')&&$('#tactics .controls')){
      $('#tactics .controls').insertAdjacentHTML('afterbegin','<div id="tacticalConfrontationTactics"></div>');
    }
  };
  const renderTacticalConfrontation=()=>{
    // Confronto tático oculto — pré-jogo, pausa, táticas e estatísticas ao vivo.
    ensureTacticalConfrontationSlots();
    const pauseSlot=$('#tacticalConfrontationPause');
    const tacticsSlot=$('#tacticalConfrontationTactics');
    if(pauseSlot)pauseSlot.innerHTML='';
    if(tacticsSlot)tacticsSlot.innerHTML='';
  };
  const percent = (a,b) => b ? `${Math.round(a / b * 100)}%` : '0%';
  const calendarPossessionPair = () => {
    // Faixa alinhada ao motor ao vivo (posse típica BR ~36–64, com vermelho um pouco mais larga).
    const userShare = clamp(Number(stats?.home?.possession) || 50, 30, 70);
    const homeShare = Math.round(userAtHomeInLiveMatch() ? userShare : 100 - userShare);
    return { home: homeShare, away: 100 - homeShare };
  };
  let scheduleLiveMatchPersist=()=>{};
  let flushLiveMatchPersist=()=>null;
  let clearLiveMatchPersist=()=>{};
  const renderStats = () => {
    recordLiveVolumeSample();
    const {home:h,away:a}=calendarLiveSideStats(),{home:hp,away:ap}=calendarPossessionPair();
    const rows = [['Posse de bola',`${hp}%`,`${ap}%`,'possession'],['Passes','','','group'],['Total de Passes',h.passes,a.passes],['% passes certos',percent(h.accurate,h.passes),percent(a.accurate,a.passes)],['Passes errados',h.passes-h.accurate,a.passes-a.accurate],['Ataque','','','group'],['Finalizações',h.shots,a.shots],['Para Fora',h.off,a.off],['No Gol',h.on,a.on],['Defendidas',h.saved,a.saved],['Pênaltis marcados',h.penalties,a.penalties],['Escanteios',h.corners,a.corners],['Impedimentos',h.offsides,a.offsides],['Defesa','','','group'],['Defesas do Goleiro',h.keeperSaves,a.keeperSaves],['Desarmes',h.tackles,a.tackles],['Faltas Cometidas',h.fouls,a.fouls],['Cartões Amarelos',h.yellow,a.yellow,'yellow'],['Cartões Vermelhos',h.red,a.red,'red']];
    const statsBody=rows.map(r => r[3] === 'group' ? `<div class="stat-group">${r[0]}</div>` : `<div class="stat ${r[3] || ''}"><span>${r[1]}</span><span>${r[0]}</span><span>${r[2]}</span></div>`).join('');
    $('#stats').innerHTML=statsBody;
    renderLiveOpponent?.();
    matchLiveUi.refreshMatchFeed?.();
    scheduleLiveMatchPersist();
  };
  tactics=createTacticsFeature({
    $,$$,playerNameCell,
    renderPlayerNameCell:(player,options)=>playerRename.renderNameCell(player,options),
    onTacticsChanged:()=>{renderTacticalConfrontation({context:'tactics'});if(matchStarted&&!matchFinished&&!preMatchPreparation&&$('#stats')&&!$('#stats').classList.contains('hidden'))renderStats();},
    getFormations:()=>formations,
    getFormationRoles:()=>formationRoles,
    getFormationNotes:()=>formationNotes,
    getUserClub:()=>userSideNameForGame(liveMatchGame||nextUserGame),
    getClubs:()=>clubs,
    getHasCareer:()=>!!savedNewGame,
    getSquad:()=>activeUserSquad,
    getFormation:()=>formation,
    setFormation:next=>{
      formation=next;
      if(!isWorldCupUserFixture(liveMatchGame||nextUserGame,userNationalTeamName))clubs[userClub].formation=next;
    },
    getPositionAssignments:()=>positionAssignments,
    setPositionAssignments:next=>{positionAssignments=next;},
    playerUnavailable,
    playerStarterBlocked,
    matchPlayerStat,
    roleAttributeScore,
    lineupForRoles,
    autoSelectUserLineup,
    suggestFormationLineup,
    renderRoster,
    renderStats,
    log,
    getLiveState:()=>({
      cards,matchStarted,matchFinished,preMatchPreparation,substitutions,substitutedOut,liveDeferredInjuries,liveMinutesPlayed,positionAssignments,activePreparationTitle,
      // Enquanto o painel de preparação/pausa estiver aberto, trocas não travam reserva.
      freeSubEdits:!!$('#pausePanel')&&!$('#pausePanel').classList.contains('hidden'),
      competitionKey:fixtureCompetitionKey(liveMatchGame||nextUserGame)||userLeagueDisciplineKey(),
    }),
    commitLiveSubstitution:(outgoingName,{wasInjured=false,wasAtRisk=false,incomingName=null}={})=>{
      substitutions++;
      substitutedOut.add(outgoingName);
      if(wasInjured)liveInjuries.home=liveInjuries.home.filter(entry=>entry.name!==outgoingName);
      if(incomingName)pushLiveVolumeIncident('home','substitution',{name:`${outgoingName} → ${incomingName}`});
      const injuredStillOnField=cards.home.some(card=>card?.injured);
      const atRiskStillOnField=cards.home.some(card=>card?.playThroughRisk);
      if(activePreparationTitle==='LESÃO'&&wasInjured&&!injuredStillOnField)$('#matchStatus').textContent='Substituição realizada. Retome a partida quando estiver pronto.';
      else if(activePreparationTitle==='ALERTA MÉDICO'&&wasAtRisk&&!atRiskStillOnField)$('#matchStatus').textContent='Substituição realizada. Retome a partida quando estiver pronto.';
    },
    tacticForAway:()=>{
      const club=matchClub();
      const base=roundTactic(club);
      return{...base,mentality:club.mentality==='Defensiva'?25:club.mentality==='Ofensiva'?75:50,possession:club.style==='Posse de bola'?78:club.style==='Contra-ataque'?22:50,press:club.style==='Pressão alta'?82:club.mentality==='Defensiva'?35:55};
    },
  });
  ({draw,drawBoard,renderTacticRoster,renderSubstitutionControls,makeSubstitution,syncTactics,applyTacticSuggestion,closeFormationSuggestion,tacticFor}=tactics);
  playerRenameCallbacks.renderTacticRoster=renderTacticRoster;
  tactics.init(validSavedSeason?savedSeason?.userTactics:null);
  {
    const savedFormation=validSavedSeason?.userFormation;
    if(savedFormation&&formationRoles[savedFormation]){
      formation=savedFormation;
      clubs[userClub].formation=savedFormation;
      positionAssignments=[...formationRoles[savedFormation]];
    }else if(clubs[userClub]?.formation&&formationRoles[clubs[userClub].formation]){
      formation=clubs[userClub].formation;
      positionAssignments=[...formationRoles[formation]];
    }
    const restoredLineup=validSavedSeason?.userLineupOrder;
    if(Array.isArray(restoredLineup)&&restoredLineup.length>=11&&applyRosterOrderByNames(squad,restoredLineup)){
      clubs[userClub].formation=formation;
    }else if(!validSavedSeason){
      // Carreira nova / sem save de temporada: monta XI sugerido uma vez.
      autoSelectUserLineup(formation);
    }else{
      // Save antigo sem ordem: preserva roster da carreira, só sincroniza formação.
      clubs[userClub].formation=formation;
      positionAssignments=[...(formationRoles[formation]||formationRoles['4-3-3'])];
    }
  }
  renderRoster();
  refreshUserFixtures();
  draw();
  renderTacticalConfrontation({context:'tactics'});
  const openLiveMatchRatings=()=>{
    if(!liveMatchGame){
      console.warn('[NOTAS] Sem partida ao vivo ativa.');
      return;
    }
    const {home:h,away:a}=calendarLiveSideStats();
    const {home:homeGoals,away:awayGoals}=calendarLiveScores();
    const sideGoals=calendarLiveSideGoals();
    const {home:hp,away:ap}=calendarPossessionPair();
    const data={
      homePossession:hp,awayPossession:ap,
      homePasses:h.passes,awayPasses:a.passes,
      homeAccurate:h.accurate,awayAccurate:a.accurate,
      homeShots:h.shots,awayShots:a.shots,
      homeOnTarget:h.on,awayOnTarget:a.on,
      homeOff:h.off,awayOff:a.off,
      homeSaved:h.saved,awaySaved:a.saved,
      homePenalties:h.penalties,awayPenalties:a.penalties,
      homeOffsides:h.offsides,awayOffsides:a.offsides,
      homeKeeperSaves:h.keeperSaves,awayKeeperSaves:a.keeperSaves,
      homeTackles:h.tackles,awayTackles:a.tackles,
      homeFouls:h.fouls,awayFouls:a.fouls,
      homeYellow:h.yellow,awayYellow:a.yellow,
      homeRed:h.red,awayRed:a.red,
      homeXg:Number(h.xg)||0,awayXg:Number(a.xg)||0,
    };
    const draft={
      home:liveMatchGame.home,
      away:liveMatchGame.away,
      round:liveMatchGame.round,
      competition:liveMatchGame.competition,
      leg:liveMatchGame.leg,
      homeGoals,
      awayGoals,
      goals:{home:[...sideGoals.home],away:[...sideGoals.away]},
      data,
    };
    const enriched=enrichGameForHistory(draft);
    const built=buildMatchPlayerSheets(enriched,{getClub:name=>clubs[name]||null});
    const ratingPlayers=[...(built.home||[]),...(built.away||[])];
    openCalendarMatchReport({
      game:liveMatchGame,
      result:{
        homeGoals,
        awayGoals,
        penalties:liveMatchGame.penalties||liveMatchGame.shootoutPenalties||null,
      },
      data,
      goals:{home:[...sideGoals.home],away:[...sideGoals.away]},
      ratingPlayers,
      incidents:calendarLiveVolumeIncidents(),
    });
  };
  const matchLiveSession=createMatchLiveSessionFeature({
    $,
    onClick,
    getLiveInjuries:()=>liveInjuries,
    getLiveDeferredInjuries:()=>liveDeferredInjuries,
    getUserClub:()=>userClub,
    getMatchClub:()=>matchClub(),
    getClubs:()=>clubs,
    applyDeferredInjuryDiagnosis,
    injuryDiagnosisComment,
    calendarLiveSideStats,
    calendarPossessionPair,
    calendarLiveSideGoals,
    getPostMatchMedicalQueue:()=>postMatchMedicalQueue,
    processPostMatchMedicalQueue,
    pushMessage,
    getCurrentRound:()=>currentRound,
    getLiveMatchGame:()=>liveMatchGame,
    getNextUserGame:()=>nextUserGame,
    fixtureDetails,
    advanceCareerCalendarTo,
    getHasCareer:()=>!!savedNewGame,
    persistSeason:(...args)=>persistSeason(...args),
    modal,
    getMatchFinished:()=>matchFinished,
    getRoundCommitted:()=>roundCommitted,
    advanceSeasonRound:(...args)=>advanceSeasonRound(...args),
    openChampionshipStandings:()=>openChampionshipStandings(),
    simulateRoundResults:(...args)=>simulateRoundResults(...args),
    openRoundResults:(...args)=>openRoundResults(...args),
    openLiveMatchRatings,
    onPostMatchModalClosed:()=>renderUserMatchPresentation(),
    stopMatchClock,
    startMatchClock:(...args)=>startMatchClock(...args),
    closeFormationSuggestion,
    getMatchStarted:()=>matchStarted,
    renderLiveMatchHeader,
    score:(...args)=>score(...args),
    updateLiveMatchClock,
    getShootoutState:()=>shootoutState,
    renderShootoutTrack:(...args)=>renderShootoutTrack(...args),
    getPreMatchPreparation:()=>preMatchPreparation,
    renderStats,
    setActivePreparationTitle:v=>{activePreparationTitle=v;},
    onBeginLineupEdit:beginPauseLineupEdit,
    syncTactics,
    drawBoard,
    renderSubstitutionControls,
    renderTacticalConfrontation,
    matchLiveAudio,
  });
  const {renderFinalSummary,showFinalActions,exitLiveMatch,reopenMatchWindow:reopenMatchWindowBase,openPreparation}=matchLiveSession;
  let reopenMatchWindow=reopenMatchWindowBase;
  let roundResults = null, roundPreviewResults={};
  let simulateRoundResults=()=>[];
  let openRoundResults=()=>{};
  let buildLiveKnockoutStats=()=>({homeGoals:0,awayGoals:0,goals:{home:[],away:[]},data:{}});
  let commitLiveKnockoutResult=()=>false;
  const cupPenaltyWinner=(first,second)=>{
    const strength=name=>{
      const club=clubs[name];
      if(!club?.roster?.length)return 0;
      const lineup=club.roster.slice(0,11);
      const takers=[...lineup].filter(player=>player.pos!=='GOL').sort((a,b)=>b.penaltyTaking-a.penaltyTaking).slice(0,5);
      const keeper=lineup.find(player=>player.pos==='GOL')||lineup[0];
      return takers.reduce((sum,player)=>sum+player.penaltyTaking,0)/Math.max(1,takers.length)+(keeper?.penaltySaving||50)*.32+(club.power||50)*.18+rnd(-9,9);
    };
    return strength(first)>=strength(second)?first:second;
  };
  const knockoutShootoutKickPair=(clubName,attemptIndex)=>rosterShootoutKickPair(clubs[clubName],attemptIndex);
  const applyCupFatigue=(game,result)=>fatigueEngine.applyCupFatigue(game,result,applyMatchAvailability);
  const {
    nextCupEntrants,
    cupTieGames,
    cupTieAggregate,
    simulateCupComputerGame,
  }=createCupFixtureRuntime({
    getCupSecondDirect:()=>cupSecondDirect,
    getCupSpecialEntrants:()=>cupSpecialEntrants,
    getCupSerieAEntrants:()=>cupSerieAEntrants,
    isUserFixture,
    simulateRoundMatch,
    applyCupFatigue,
    recordPlayerHistoryMatch,
  });
  /** Pós-jogo pendente (× no modal) — espelha placar ao vivo no chaveamento sem gravar o save. */
  const hasPendingLiveKnockoutPostMatch=()=>matchFinished&&!roundCommitted&&liveMatchGame&&isKnockoutShootoutCompetition(liveMatchGame);
  const overlayPendingLiveKnockoutGames=games=>{
    if(!hasPendingLiveKnockoutPostMatch())return games;
    const liveStats=buildLiveKnockoutStats();
    return games.map(game=>{
      if(!sameKnockoutFixture(game,liveMatchGame))return game;
      return {
        ...game,
        homeGoals:liveStats.homeGoals,
        awayGoals:liveStats.awayGoals,
        goals:liveStats.goals,
        data:liveStats.data,
        completed:true,
        penalties:liveMatchGame.penalties??game.penalties,
        shootoutWinner:liveMatchGame.shootoutWinner??game.shootoutWinner,
        shootoutPenalties:liveMatchGame.shootoutPenalties??game.shootoutPenalties,
        winner:liveMatchGame.shootoutWinner||liveMatchGame.winner||game.winner,
      };
    });
  };
  const cupGameForDisplay=game=>{
    if(!hasPendingLiveKnockoutPostMatch()||!sameKnockoutFixture(game,liveMatchGame))return game;
    const liveStats=buildLiveKnockoutStats();
    return {
      ...game,
      homeGoals:liveStats.homeGoals,
      awayGoals:liveStats.awayGoals,
      goals:liveStats.goals,
      data:liveStats.data,
      completed:true,
      penalties:liveMatchGame.penalties??game.penalties,
      shootoutWinner:liveMatchGame.shootoutWinner??game.shootoutWinner,
      shootoutPenalties:liveMatchGame.shootoutPenalties??game.shootoutPenalties,
    };
  };
  const cupBracketTieFromStage=(stage,tieId)=>{
    const games=overlayPendingLiveKnockoutGames(cupTieGames(stage,tieId));
    if(!games.length)return null;
    const sideA=games[0].home,sideB=games[0].away;
    const aggregate=cupTieAggregate(games);
    const allDone=games.every(game=>game.completed);
    const played=games.some(game=>game.completed);
    let winner=games.find(game=>game.winner)?.winner||games.find(game=>game.shootoutWinner)?.shootoutWinner||null;
    if(!winner&&allDone){
      const goalsA=aggregate.get(sideA)||0,goalsB=aggregate.get(sideB)||0;
      if(goalsA!==goalsB)winner=goalsA>goalsB?sideA:sideB;
    }
    const penLabel=games.map(game=>game.penalties||game.shootoutPenalties).find(Boolean)||'';
    const legMeta=games.map(game=>{
      const details=fixtureDetails(game);
      const score=game.completed?formatKnockoutFixtureScore(game,{separator:'-'}):'×';
      return `${game.leg} ${details.display} ${score}`;
    }).join(' · ');
    return {
      tieId,sideA,sideB,winner,penLabel,legMeta,played,allDone,
      scoreA:played?String(aggregate.get(sideA)||0):'—',
      scoreB:played?String(aggregate.get(sideB)||0):'—',
      userTie:sideA===userClub||sideB===userClub,
    };
  };
  const renderCupTreeTeam=(name,score,{winner=null,plain=false}={})=>{
    const classes=['cup-tree-team'];
    if(name===userClub)classes.push('user-club');
    if(winner===name)classes.push('winner');
    const main=plain?`<b>${name}</b>`:cupClubLabel(name,{tag:'b'});
    return `<div class="${classes.join(' ')}">${teamCrestHtml(name)}<span class="cup-tree-team-main">${main}</span><em>${score}</em></div>`;
  };
  const renderCupTreeMatch=(tie,{plain=false}={})=>{
    const badge=tie.userTie?`<div class="cup-tree-user-badge">${tie.winner===userClub?'VOCÊ AVANÇOU':tie.allDone?'VOCÊ ELIMINADO':'SEU JOGO'}</div>`:'';
    const metaLine=[tie.legMeta,tie.penLabel?`PÊN. ${tie.penLabel}`:''].filter(Boolean).join(' · ');
    const winnerLine=tie.winner?`<strong>Classificado: ${tie.winner}</strong>`:'';
    return `<article class="cup-tree-match ${tie.userTie?'user-tie':''} ${tie.userTie?'':'dim-tie'}" data-user-tie="${tie.userTie?'1':'0'}">
      ${badge}
      ${renderCupTreeTeam(tie.sideA,tie.scoreA,{winner:tie.winner,plain})}
      ${renderCupTreeTeam(tie.sideB,tie.scoreB,{winner:tie.winner,plain})}
      <div class="cup-tree-match-meta"><span>${metaLine}</span>${winnerLine}</div>
    </article>`;
  };
  const renderCupPhase5Pot=()=>{
    const phase4=cupCompetition.stages.find(item=>item.index===4);
    const fromPhase4=phase4?.winners?.length
      ?phase4.winners
      :phase4?.fixtures
        ?[...new Set(phase4.fixtures.map(game=>game.tieId))]
          .map(tieId=>cupBracketTieFromStage(phase4,tieId))
          .map(tie=>tie?.winner)
          .filter(Boolean)
        :[];
    const pendingSlots=Math.max(0,12-fromPhase4.length);
    const serieA=cupSerieAEntrants.slice(0,20);
    const chips=[
      ...serieA.map(name=>teamCrestHtml(name,{className:name===userClub?'user-club':''})),
      ...fromPhase4.map(name=>teamCrestHtml(name,{className:name===userClub?'user-club':''})),
      ...Array.from({length:pendingSlots},()=>'<i class="tbd">?</i>'),
    ].join('');
    return `<div class="cup-tree-pot"><strong>POTES DO SORTEIO</strong><div class="cup-tree-pot-grid">${chips}</div></div>`;
  };
  const cupBracketPhaseStatus=(stage)=>{
    if(stage?.completed)return 'CONCLUÍDA';
    if(stage)return 'EM DISPUTA';
    return 'AGUARDANDO SORTEIO';
  };
  const cupBracketPhaseNav=(phaseIndex)=>{
    const prevStage=cupCompetition.stages.find(item=>item.index===phaseIndex-1);
    const nextStage=cupCompetition.stages.find(item=>item.index===phaseIndex+1);
    const prevReady=Boolean(prevStage?.fixtures?.length);
    const nextReady=Boolean(nextStage?.fixtures?.length);
    return `<div class="cup-bracket-phase-nav" role="group" aria-label="Navegar fases">
      <button type="button" class="cup-bracket-btn ghost cup-bracket-nav" data-cup-bracket-prev ${prevReady?'':'disabled'} aria-label="Fase anterior" title="${prevReady?'Fase anterior':'Não há fase anterior'}">←</button>
      <button type="button" class="cup-bracket-btn ghost cup-bracket-nav" data-cup-bracket-next ${nextReady?'':'disabled'} aria-label="Próxima fase" title="${nextReady?'Próxima fase':'Aguarde o sorteio da próxima fase'}">→</button>
    </div>`;
  };
  const cupBracketActionButtons=(phaseIndex,stage)=>{
    const status=cupBracketPhaseStatus(stage);
    const statusClass=stage?.completed?'':(stage?'':'is-wait');
    return `<div class="cup-bracket-actions">
      <span class="cup-bracket-status ${statusClass}">${status}</span>
      <button type="button" class="cup-bracket-btn ghost" data-cup-bracket-close>FECHAR</button>
      ${cupBracketPhaseNav(phaseIndex)}
    </div>`;
  };
  const renderCupCenterSummary=(phaseIndex,stage,{userNote='',tieCount=0,userTie=false}={})=>{
    const status=cupBracketPhaseStatus(stage);
    const statusClass=stage?.completed?'is-done':(stage?'':'is-wait');
    return `<aside class="cup-tree-pot ${userTie?'has-user':''}">
      <div class="cup-tree-pot-info">
        <strong class="cup-tree-pot-phase">${stage?.name||`Fase ${phaseIndex}`}</strong>
        <p class="cup-tree-center-user">${userNote}</p>
        <p class="cup-tree-center-count">${tieCount} confronto${tieCount===1?'':'s'}</p>
        <span class="cup-tree-pot-status ${statusClass}">${status}</span>
      </div>
      <div class="cup-tree-center-nav">${cupBracketPhaseNav(phaseIndex)}</div>
    </aside>`;
  };
  const renderCupBracket=(phaseIndex)=>{
    const definition=cupPhaseDefinitions.find(item=>item.index===phaseIndex);
    const stage=cupCompetition.stages.find(item=>item.index===phaseIndex);
    const title=$('#cupBracketTitle'),actionsEl=$('#cupBracketActions'),body=$('#cupBracketBody');
    if(!title||!actionsEl||!body)return;
    title.textContent=stage?.name||definition?.name||`Fase ${phaseIndex}`;
    actionsEl.innerHTML=cupBracketActionButtons(phaseIndex,stage);
    if(!stage?.fixtures?.length){
      body.innerHTML='<div class="cup-bracket-empty">Aguardando sorteio desta fase.</div>';
      return;
    }
    // Só a fase clicada — sem colunas de fase anterior/seguinte nem slots inventados.
    let ties=[...new Set(stage.fixtures.map(game=>game.tieId))]
      .map(tieId=>cupBracketTieFromStage(stage,tieId))
      .filter(Boolean);
    const userTies=ties.filter(tie=>tie.userTie);
    ties=[...userTies,...ties.filter(tie=>!tie.userTie)];
    if(ties.length===1){
      body.innerHTML=`<div class="cup-tree single-final"><div class="cup-tree-center"><div class="cup-tree-final-slot"><span>${stage.name}</span>${renderCupTreeMatch(ties[0])}<div class="cup-tree-center-nav">${cupBracketPhaseNav(phaseIndex)}</div></div></div></div>`;
      return;
    }
    const mid=Math.ceil(ties.length/2);
    const left=ties.slice(0,mid);
    const right=ties.slice(mid);
    const userTie=userTies[0];
    const userNote=userTie
      ?userTie.winner===userClub
        ?`${userClub} classificado`
        :userTie.allDone
          ?`${userClub} eliminado`
          :`Confronto de ${userClub}`
      :'Seu clube não está nesta fase';
    const centerHtml=phaseIndex===5
      ?`${renderCupPhase5Pot()}<div class="cup-tree-center-nav">${cupBracketPhaseNav(phaseIndex)}</div>`
      :renderCupCenterSummary(phaseIndex,stage,{userNote,tieCount:ties.length,userTie:Boolean(userTie)});
    body.innerHTML=`<div class="cup-tree phase-only ${userTies.length?'has-user-path':''}">
      <div class="cup-tree-wing left"><div class="cup-tree-round"><div class="cup-tree-matches">${left.map(renderCupTreeMatch).join('')}</div></div></div>
      <div class="cup-tree-center">${centerHtml}</div>
      <div class="cup-tree-wing right"><div class="cup-tree-round"><div class="cup-tree-matches">${right.map(renderCupTreeMatch).join('')}</div></div></div>
    </div>`;
    requestAnimationFrame(()=>{
      const focus=body.querySelector('[data-user-tie="1"]');
      focus?.scrollIntoView({block:'nearest',behavior:'smooth'});
    });
  };
  const serieDBracketTieFromStage=(startRound,tieId)=>{
    const games=overlayPendingLiveKnockoutGames(
      serieDStageFixturesMerged(startRound)
        .filter(game=>game.tieId===tieId)
        .sort((a,b)=>(a.leg==='IDA'?0:1)-(b.leg==='IDA'?0:1)),
    );
    if(!games.length)return null;
    const sideA=games[0].home,sideB=games[0].away;
    const aggregate=cupTieAggregate(games);
    const allDone=games.every(game=>game.completed);
    const played=games.some(game=>game.completed);
    let winner=games.find(game=>game.winner)?.winner||games.find(game=>game.shootoutWinner)?.shootoutWinner||null;
    if(!winner&&allDone){
      const goalsA=aggregate.get(sideA)||0,goalsB=aggregate.get(sideB)||0;
      if(goalsA!==goalsB)winner=goalsA>goalsB?sideA:sideB;
    }
    const penLabel=games.map(game=>game.penalties||game.shootoutPenalties).find(Boolean)||'';
    const legMeta=games.map(game=>{
      const details=fixtureDetails(game);
      const score=game.completed?formatKnockoutFixtureScore(game,{separator:'-'}):'×';
      return `${game.leg||'JOGO'} ${details.display} ${score}`;
    }).join(' · ');
    return {
      tieId,sideA,sideB,winner,penLabel,legMeta,played,allDone,
      scoreA:played?String(aggregate.get(sideA)||0):'—',
      scoreB:played?String(aggregate.get(sideB)||0):'—',
      userTie:sideA===userClub||sideB===userClub,
    };
  };
  const serieDBracketPhaseNav=phaseIndex=>{
    const prevDef=serieDKnockoutPhaseDefs.find(item=>item.index===phaseIndex-1);
    const nextDef=serieDKnockoutPhaseDefs.find(item=>item.index===phaseIndex+1);
    const prevReady=Boolean(prevDef&&serieDKnockoutPhaseMeta(prevDef).generated);
    const nextReady=Boolean(nextDef&&serieDKnockoutPhaseMeta(nextDef).generated);
    return `<div class="cup-bracket-phase-nav" role="group" aria-label="Navegar fases">
      <button type="button" class="cup-bracket-btn ghost cup-bracket-nav" data-cup-bracket-prev ${prevReady?'':'disabled'} aria-label="Fase anterior" title="${prevReady?'Fase anterior':'Não há fase anterior'}">←</button>
      <button type="button" class="cup-bracket-btn ghost cup-bracket-nav" data-cup-bracket-next ${nextReady?'':'disabled'} aria-label="Próxima fase" title="${nextReady?'Próxima fase':'Aguarde o sorteio da próxima fase'}">→</button>
    </div>`;
  };
  const renderSerieDBracket=phaseIndex=>{
    const definition=serieDKnockoutPhaseDefs.find(item=>item.index===phaseIndex)||serieDKnockoutPhaseDefs[0];
    const meta=serieDKnockoutPhaseMeta(definition);
    const title=$('#cupBracketTitle'),actionsEl=$('#cupBracketActions'),body=$('#cupBracketBody');
    if(!title||!actionsEl||!body)return;
    title.textContent=definition.name;
    const statusClass=meta.completed?'':(meta.generated?'':'is-wait');
    actionsEl.innerHTML=`<div class="cup-bracket-actions">
      <span class="cup-bracket-status ${statusClass}">${meta.status}</span>
      <button type="button" class="cup-bracket-btn ghost" data-cup-bracket-close>FECHAR</button>
      ${serieDBracketPhaseNav(definition.index)}
    </div>`;
    if(!meta.generated){
      body.innerHTML='<div class="cup-bracket-empty">Aguardando sorteio desta fase.</div>';
      return;
    }
    const fixtures=serieDStageFixturesMerged(definition.startRound);
    let ties=[...new Set(fixtures.map(game=>game.tieId).filter(Boolean))]
      .map(tieId=>serieDBracketTieFromStage(definition.startRound,tieId))
      .filter(Boolean);
    const userTies=ties.filter(tie=>tie.userTie);
    ties=[...userTies,...ties.filter(tie=>!tie.userTie)];
    const hasPlayoff=definition.key==='semi'&&Boolean(nationalCompetitions.D.knockout?.stages?.playoff?.length);
    if(hasPlayoff){
      const {semi,playoff}=splitSerieDSemiPlayoffTies(ties);
      const renderGroup=(label,hint,groupTies)=>!groupTies.length?'':`<section class="cup-tree-stage-group">
        <header><h4>${label}</h4><small>${hint}</small></header>
        <div class="cup-tree-matches">${sortChampionshipTiesUserFirst(groupTies).map(tie=>renderCupTreeMatch(tie,{plain:true})).join('')}</div>
      </section>`;
      body.innerHTML=`<div class="cup-tree-split-stages">
        <div class="cup-tree-split-nav">${serieDBracketPhaseNav(definition.index)}</div>
        ${renderGroup('SEMIFINAL','Vencedores avançam à final · os 4 semifinalistas já estão garantidos na Série C na próxima temporada',semi)}
        ${renderGroup('REPESCAGEM','Vencedores conquistam o acesso à Série C',playoff)}
      </div>`;
      requestAnimationFrame(()=>{
        const focus=body.querySelector('[data-user-tie="1"]');
        focus?.scrollIntoView({block:'nearest',behavior:'smooth'});
      });
      return;
    }
    const stageLabel=definition.name;
    if(ties.length===1){
      body.innerHTML=`<div class="cup-tree single-final"><div class="cup-tree-center"><div class="cup-tree-final-slot"><span>${stageLabel}</span>${renderCupTreeMatch(ties[0],{plain:true})}<div class="cup-tree-center-nav">${serieDBracketPhaseNav(definition.index)}</div></div></div></div>`;
      return;
    }
    const mid=Math.ceil(ties.length/2);
    const left=ties.slice(0,mid);
    const right=ties.slice(mid);
    const userTie=userTies[0];
    const userNote=userTie
      ?userTie.winner===userClub
        ?`${userClub} classificado`
        :userTie.allDone
          ?`${userClub} eliminado`
          :`Confronto de ${userClub}`
      :'Seu clube não está nesta fase';
    const statusClassCenter=meta.completed?'is-done':(meta.generated?'':'is-wait');
    const centerHtml=`<aside class="cup-tree-pot ${userTie?'has-user':''}">
      <div class="cup-tree-pot-info">
        <strong class="cup-tree-pot-phase">${stageLabel}</strong>
        <p class="cup-tree-center-user">${userNote}</p>
        <p class="cup-tree-center-count">${ties.length} confronto${ties.length===1?'':'s'}</p>
        <span class="cup-tree-pot-status ${statusClassCenter}">${meta.status}</span>
      </div>
      <div class="cup-tree-center-nav">${serieDBracketPhaseNav(definition.index)}</div>
    </aside>`;
    body.innerHTML=`<div class="cup-tree phase-only ${userTies.length?'has-user-path':''}">
      <div class="cup-tree-wing left"><div class="cup-tree-round"><div class="cup-tree-matches">${left.map(tie=>renderCupTreeMatch(tie,{plain:true})).join('')}</div></div></div>
      <div class="cup-tree-center">${centerHtml}</div>
      <div class="cup-tree-wing right"><div class="cup-tree-round"><div class="cup-tree-matches">${right.map(tie=>renderCupTreeMatch(tie,{plain:true})).join('')}</div></div></div>
    </div>`;
    requestAnimationFrame(()=>{
      const focus=body.querySelector('[data-user-tie="1"]');
      focus?.scrollIntoView({block:'nearest',behavior:'smooth'});
    });
  };
  openCupBracket=phaseIndex=>{
    const index=Number(phaseIndex)||1;
    bracketCompetition='CUP';
    championshipRoundView=index;
    setBracketCompetitionLabel('CHAVEAMENTO · COPA DO BRASIL');
    markCupPhaseSelection(index);
    renderCupBracket(index);
    $('#cupBracketModal')?.classList.remove('hidden');
  };
  openSerieDBracket=phaseIndex=>{
    const index=Number(phaseIndex)||1;
    bracketCompetition='SERIE_D';
    championshipRoundView=index;
    setBracketCompetitionLabel('CHAVEAMENTO · SÉRIE D');
    markSerieDPhaseSelection(index);
    renderSerieDBracket(index);
    $('#cupBracketModal')?.classList.remove('hidden');
  };
  closeCupBracket=()=>{$('#cupBracketModal')?.classList.add('hidden');};
  goCupBracketPrevPhase=()=>{
    if(bracketCompetition==='SERIE_D'){
      const current=Number(championshipRoundView)||1;
      const prev=serieDKnockoutPhaseDefs.find(item=>item.index===current-1);
      if(!prev||!serieDKnockoutPhaseMeta(prev).generated)return;
      openSerieDBracket(prev.index);
      return;
    }
    const current=Number(championshipRoundView)||1;
    const prev=cupCompetition.stages.find(item=>item.index===current-1);
    if(!prev?.fixtures?.length)return;
    openCupBracket(prev.index);
  };
  goCupBracketNextPhase=()=>{
    if(bracketCompetition==='SERIE_D'){
      const current=Number(championshipRoundView)||1;
      const next=serieDKnockoutPhaseDefs.find(item=>item.index===current+1);
      if(!next||!serieDKnockoutPhaseMeta(next).generated)return;
      openSerieDBracket(next.index);
      return;
    }
    const current=Number(championshipRoundView)||1;
    const next=cupCompetition.stages.find(item=>item.index===current+1);
    if(!next?.fixtures?.length)return;
    openCupBracket(next.index);
  };

  const placeChampionshipPagePickerMenu=()=>{
    const btn=$('#championshipPagePickerBtn'),menu=$('#championshipPagePickerMenu');
    if(!btn||!menu||!pagePickerOpen)return;
    const rect=btn.getBoundingClientRect();
    menu.style.position='fixed';
    menu.style.top=`${Math.round(rect.bottom+6)}px`;
    menu.style.right=`${Math.round(Math.max(8,window.innerWidth-rect.right))}px`;
    menu.style.left='auto';
    menu.style.zIndex='5000';
  };
  const setChampionshipPagePickerOpen=open=>{
    pagePickerOpen=!!open;
    if(pagePickerOpen)setChampionshipPageStateTierPickerOpen(false);
    const btn=$('#championshipPagePickerBtn'),menu=$('#championshipPagePickerMenu');
    const host=$('.championship-page-picker:not(.championship-page-state-tier-picker)');
    btn?.setAttribute('aria-expanded',pagePickerOpen?'true':'false');
    if(btn)btn.textContent=pagePickerOpen?'TODAS AS COMPETIÇÕES ▴':'TODAS AS COMPETIÇÕES ▾';
    if(!menu)return;
    menu.classList.toggle('hidden',!pagePickerOpen);
    if(pagePickerOpen){
      // Portal para body: evita clip do overflow da view/tabela.
      if(menu.parentElement!==document.body)document.body.appendChild(menu);
      placeChampionshipPagePickerMenu();
      hydratePickerTrophyIcons(menu);
    }else{
      menu.style.position='';
      menu.style.top='';
      menu.style.right='';
      menu.style.left='';
      menu.style.zIndex='';
      if(host&&menu.parentElement!==host)host.appendChild(menu);
    }
  };
  const placeChampionshipPageStateTierPickerMenu=()=>{
    const btn=$('#championshipPageStateTierBtn'),menu=$('#championshipPageStateTierMenu');
    if(!btn||!menu||!pageStateTierPickerOpen)return;
    const rect=btn.getBoundingClientRect();
    menu.style.position='fixed';
    menu.style.top=`${Math.round(rect.bottom+6)}px`;
    menu.style.right=`${Math.round(Math.max(8,window.innerWidth-rect.right))}px`;
    menu.style.left='auto';
    menu.style.zIndex='5000';
  };
  const setChampionshipPageStateTierPickerOpen=open=>{
    pageStateTierPickerOpen=!!open;
    if(pageStateTierPickerOpen)setChampionshipPagePickerOpen(false);
    const btn=$('#championshipPageStateTierBtn'),menu=$('#championshipPageStateTierMenu');
    const host=$('#championshipPageStateTierPicker');
    btn?.setAttribute('aria-expanded',pageStateTierPickerOpen?'true':'false');
    if(btn&&!pageStateTierPickerOpen){
      const parsed=isStateChampionshipPage(pageCompetition)?parseStateCompetitionKey(pageCompetition):null;
      const tier=parsed?.tier||1;
      const tiers=parsed?stateLeagueEngine.getTiersForUf(parsed.uf):[];
      btn.textContent=tiers.length>1?`DIVISÃO ${tier} ▾`:'DIVISÕES ▾';
    }else if(btn&&pageStateTierPickerOpen){
      btn.textContent='DIVISÕES ▴';
    }
    if(!menu)return;
    menu.classList.toggle('hidden',!pageStateTierPickerOpen);
    if(pageStateTierPickerOpen){
      if(menu.parentElement!==document.body)document.body.appendChild(menu);
      placeChampionshipPageStateTierPickerMenu();
    }else{
      menu.style.position='';
      menu.style.top='';
      menu.style.right='';
      menu.style.left='';
      menu.style.zIndex='';
      if(host&&menu.parentElement!==host)host.appendChild(menu);
    }
  };
  const championshipPageIsKnockoutView=()=>pageCompetition==='CUP'||pageCompetition==='RECOPA'||(pageCompetition==='D'&&pageSerieDMode==='knockout');
  const serieDMaxGeneratedPhaseIndex=()=>{
    let max=0;
    serieDKnockoutPhaseDefs.forEach(definition=>{
      if(serieDKnockoutPhaseMeta(definition).generated)max=Math.max(max,definition.index);
    });
    return max;
  };
  const renderChampionshipPageTieSide=(name,side)=>{
    const crest=teamCrestHtml(name,{className:'championship-page-tie-crest'});
    const label=`<span class="championship-page-tie-club">${cupClubLabel(name,{tag:'b'})}</span>`;
    return side==='away'
      ?`<div class="championship-page-tie-side is-away">${label}${crest}</div>`
      :`<div class="championship-page-tie-side is-home">${crest}${label}</div>`;
  };
  const renderChampionshipPageTie=tie=>{
    if(!tie)return '';
    const score=tie.played?`${tie.scoreA} — ${tie.scoreB}`:'×';
    const winner=tie.winner?`<strong class="winner-note">Classificado: ${tie.winner}${tie.penLabel?` · Pên. ${tie.penLabel}`:''}</strong>`:'';
    return `<article class="championship-page-tie ${tie.userTie?'user-tie':''}">
      <div class="championship-page-tie-line">
        ${renderChampionshipPageTieSide(tie.sideA,'home')}
        <em>${score}</em>
        ${renderChampionshipPageTieSide(tie.sideB,'away')}
      </div>
      <div class="championship-page-tie-meta">
        <small>${tie.legMeta||'Confronto'}</small>
        ${winner}
      </div>
    </article>`;
  };
  const wrapChampionshipPageTies=html=>`<div class="championship-page-ties">${html}</div>`;
  const renderChampionshipPageFixtureCards=(games,{completed=false}={})=>{
    const playable=filterPlayableRoundGames(games);
    if(!playable.length)return '';
    return playable.map(game=>{
      const isUser=game.home===userClub||game.away===userClub||(userNationalTeamName&&(game.home===userNationalTeamName||game.away===userNationalTeamName));
      const played=completed&&game.homeGoals!=null;
      const pen=knockoutShootoutLabel(game)||game.penalties||game.shootoutPenalties;
      const score=played?`${game.homeGoals} — ${game.awayGoals}${pen?` (${pen})`:''}`:'× — ×';
      return `<article class="championship-page-tie ${isUser?'user-tie':''} ${played?'':'scheduled'}">
        <div class="championship-page-tie-line">
          ${renderChampionshipPageTieSide(game.home,'home')}
          <em>${score}</em>
          ${renderChampionshipPageTieSide(game.away,'away')}
        </div>
        ${isUser?'<div class="championship-page-tie-meta"><small class="user-game-tag">SEU JOGO</small></div>':''}
      </article>`;
    }).join('');
  };
  const stateLeagueRoundCompleted=(competitionId,round,games)=>{
    const saved=(stateLeagueEngine.history[parseStateCompetitionKey(competitionId)?.uf||'']||[]).find(item=>item.round===round);
    return Boolean(saved?.games?.length)||games.every(game=>game.completed);
  };
  const renderChampionshipPageFixturesOpenBtn=()=>`<section class="championship-page-round-panel is-collapsed"><button type="button" class="championship-page-fixtures-all-btn" data-state-fixtures-open>TODOS OS JOGOS</button></section>`;
  const renderChampionshipPageFixturesToolbar=({roundLimit,round}={})=>{
    const atFirst=(round||1)<=1;
    const atLast=(round||1)>=(roundLimit||1);
    return `<div class="championship-page-fixtures-toolbar is-open">
      <button type="button" class="championship-page-fixtures-all-btn is-active" data-state-fixtures-open aria-expanded="true">TODOS OS JOGOS</button>
      <div class="championship-page-fixtures-round-nav" role="group" aria-label="Rodada">
        <button type="button" class="championship-page-fixtures-round-btn" data-state-fixtures-round-prev aria-label="Rodada anterior" ${atFirst?'disabled':''}>‹</button>
        <strong>Rodada ${round||1}</strong>
        <button type="button" class="championship-page-fixtures-round-btn" data-state-fixtures-round-next aria-label="Próxima rodada" ${atLast?'disabled':''}>›</button>
      </div>
    </div>`;
  };
  const renderChampionshipPageRoundFixtures=(games,{completed=false,roundLabel='',toolbarHtml=''}={})=>{
    const list=renderChampionshipPageFixtureCards(games,{completed});
    if(!list&&!toolbarHtml)return '<div class="championship-page-empty">Nenhum jogo nesta rodada.</div>';
    return `<section class="championship-page-round-panel">${toolbarHtml}${list?wrapChampionshipPageTies(list):'<div class="championship-page-empty">Nenhum jogo nesta rodada.</div>'}</section>`;
  };
  const renderChampionshipPageAllRoundFixtures=(competitionId,roundLimit)=>{
    const groups=[];
    for(let round=1;round<=roundLimit;round+=1){
      const games=stateLeagueEngine.getRoundGamesForBrowse(competitionId,round,{simulateMatch:simulateRoundMatch});
      if(!games.length)continue;
      const completed=stateLeagueRoundCompleted(competitionId,round,games);
      const cards=renderChampionshipPageFixtureCards(games,{completed});
      if(cards)groups.push(`<div class="championship-page-all-round-group"><header class="championship-page-all-round-label">Rodada ${round}</header>${wrapChampionshipPageTies(cards)}</div>`);
    }
    return groups.join('')||'<div class="championship-page-empty">Nenhum jogo disponível.</div>';
  };
  const serieDClubPairKey=(a,b)=>[String(a||''),String(b||'')].sort().join('|');
  const serieDStagePairKeys=stageTies=>new Set((stageTies||[]).map(tie=>serieDClubPairKey(tie.home,tie.away)));
  const sortChampionshipTiesUserFirst=ties=>{
    const userTies=ties.filter(tie=>tie.userTie);
    return [...userTies,...ties.filter(tie=>!tie.userTie)];
  };
  /** Na fase de semi, fixtures misturam semi + repescagem no mesmo round — separa pelo stages. */
  const splitSerieDSemiPlayoffTies=ties=>{
    const stages=nationalCompetitions.D?.knockout?.stages||{};
    const semiKeys=serieDStagePairKeys(stages.semi);
    const playoffKeys=serieDStagePairKeys(stages.playoff);
    const semi=[],playoff=[],other=[];
    ties.forEach(tie=>{
      const key=serieDClubPairKey(tie.sideA,tie.sideB);
      if(playoffKeys.has(key)&&!semiKeys.has(key))playoff.push(tie);
      else if(semiKeys.has(key))semi.push(tie);
      else other.push(tie);
    });
    // Índices sem match nos stages: primeiros vão para semi (ordem de installTieRounds).
    if(other.length){
      const expectedSemi=Math.max(0,(stages.semi||[]).length-semi.length);
      other.forEach((tie,index)=>(index<expectedSemi?semi:playoff).push(tie));
    }
    return {semi,playoff};
  };
  const renderChampionshipPageTieGroup=(label,ties,hint='')=>{
    if(!ties.length)return '';
    const list=sortChampionshipTiesUserFirst(ties).map(renderChampionshipPageTie).join('');
    return `<section class="championship-page-tie-group">
      <header class="championship-page-tie-group-head">
        <h4>${label}</h4>
        ${hint?`<small>${hint}</small>`:''}
      </header>
      <div class="championship-page-ties">${list}</div>
    </section>`;
  };
  const seriesDGroupRowsForDisplay=groupIndex=>{
    let rows=seriesDGroupRows(groupIndex).map(row=>({...row}));
    const pending=pendingRoundPreviewGames();
    if(pending?.length&&userDivision==='D'&&pageSerieDGroup===groupIndex){
      pending.forEach(game=>{rows=applyTablePreviewToRows(rows,game);});
    }
    return rows;
  };
  const stateGroupRowsForDisplay=(competitionId,groupIndex)=>{
    let rows=stateGroupRows(competitionId,groupIndex).map(row=>({...row}));
    if(matchFinished&&!roundCommitted&&liveMatchGame&&isStateLeagueGame(liveMatchGame)){
      const uf=String(liveMatchGame.stateUf||'').toUpperCase();
      const tier=Number(liveMatchGame.stateTier)||1;
      const gameComp=stateCompetitionKey(uf,tier);
      if(gameComp===competitionId){
        rows=applyTablePreviewToRows(rows,{
          home:liveMatchGame.home,
          away:liveMatchGame.away,
          homeGoals:Number(liveMatchGame.homeGoals??0),
          awayGoals:Number(liveMatchGame.awayGoals??0),
        });
      }
    }
    return rows;
  };
  const recopaFixtureForDisplay=()=>{
    const game=recopaCompetition?.fixture;
    if(!game)return null;
    return typeof cupGameForDisplay==='function'?cupGameForDisplay(game):game;
  };
  const renderChampionshipPageKnockoutBody=()=>{
    if(pageCompetition==='RECOPA'){
      if(!recopaCompetition.ready){
        return `<div class="championship-page-empty">${recopaNationalEmptyMessage(recopaCompetition)}</div>`;
      }
      if(recopaCompetition.skippedSameClub){
        return `<div class="championship-page-empty">${recopaNationalEmptyMessage(recopaCompetition)}</div>`;
      }
      const game=recopaFixtureForDisplay();
      if(!game){
        return `<div class="championship-page-empty">${recopaNationalEmptyMessage(recopaCompetition)}</div>`;
      }
      const list=renderChampionshipPageFixtureCards([game],{completed:recopaCompetition.complete||hasPendingLiveKnockoutPostMatch()});
      return list?wrapChampionshipPageTies(list):`<div class="championship-page-empty">${recopaNationalEmptyMessage(recopaCompetition)}</div>`;
    }
    if(pageCompetition==='CUP'){
      const definition=cupPhaseDefinitions.find(item=>item.index===pageCupPhase);
      const stage=cupCompetition.stages.find(item=>item.index===pageCupPhase);
      if(!stage?.fixtures?.length){
        return `<div class="championship-page-empty">Aguardando sorteio${definition?` da ${definition.name}`:' desta fase'}.</div>`;
      }
      let ties=[...new Set(stage.fixtures.map(game=>game.tieId))]
        .map(tieId=>cupBracketTieFromStage(stage,tieId))
        .filter(Boolean);
      ties=sortChampionshipTiesUserFirst(ties);
      const list=ties.map(renderChampionshipPageTie).join('')||'<div class="championship-page-empty">Sem confrontos nesta fase.</div>';
      return wrapChampionshipPageTies(list);
    }
    const definition=serieDKnockoutPhaseDefs.find(item=>item.index===pageSerieDPhase)||serieDKnockoutPhaseDefs[0];
    const meta=serieDKnockoutPhaseMeta(definition);
    if(!meta.generated){
      return `<div class="championship-page-empty">Aguardando sorteio da ${definition.name.toLowerCase()}.</div>`;
    }
    const fixtures=serieDStageFixturesMerged(definition.startRound);
    let ties=[...new Set(fixtures.map(game=>game.tieId).filter(Boolean))]
      .map(tieId=>serieDBracketTieFromStage(definition.startRound,tieId))
      .filter(Boolean);
    const hasPlayoff=definition.key==='semi'&&Boolean(nationalCompetitions.D.knockout?.stages?.playoff?.length);
    if(hasPlayoff){
      const {semi,playoff}=splitSerieDSemiPlayoffTies(ties);
      const groups=[
        renderChampionshipPageTieGroup('SEMIFINAL',semi,'Vencedores avançam à final · os 4 semifinalistas já estão garantidos na Série C na próxima temporada'),
        renderChampionshipPageTieGroup('REPESCAGEM',playoff,'Vencedores conquistam o acesso à Série C'),
      ].filter(Boolean).join('');
      return groups
        ?`<div class="championship-page-tie-groups">${groups}</div>`
        :'<div class="championship-page-empty">Sem confrontos nesta fase.</div>';
    }
    ties=sortChampionshipTiesUserFirst(ties);
    const list=ties.map(renderChampionshipPageTie).join('')||'<div class="championship-page-empty">Sem confrontos nesta fase.</div>';
    return wrapChampionshipPageTies(list);
  };
  renderChampionshipPage=()=>{
    const tableCard=$('.championship-page-table');
    const sub=$('#championshipPageSub');
    const title=$('#championshipPageTitle');
    const titleTextEl=$('#championshipPageTitleText');
    const trophyEl=$('#championshipPageTrophy');
    const head=$('#championshipPageHead');
    const body=$('#leagueTable');
    const prevBtn=$('#championshipPagePrev');
    const nextBtn=$('#championshipPageNext');
    const menu=$('#championshipPagePickerMenu');
    const serieDModeTabs=$('#championshipPageSerieDMode');
    const stateTierPicker=$('#championshipPageStateTierPicker');
    const stateTierMenu=$('#championshipPageStateTierMenu');
    if(!body||!title)return;

    const isStateHub=pageCompetition==='ESTADUAIS';
    const isStateComp=isStateChampionshipPage(pageCompetition);
    const stateParsed=isStateComp?parseStateCompetitionKey(pageCompetition):null;
    const stateTiers=stateParsed?stateLeagueEngine.getTiersForUf(stateParsed.uf):[];
    const showStateTierPicker=isStateComp&&stateTiers.length>1;
    stateTierPicker?.classList.toggle('hidden',!showStateTierPicker);
    if(stateTierMenu&&showStateTierPicker){
      stateTierMenu.innerHTML=stateTiers.map(tier=>{
        const id=stateCompetitionKey(stateParsed.uf,tier);
        const active=id===pageCompetition;
        const division=stateLeagueEngine.getDivisionForBrowse(id,userClub);
        const teamCount=division?.teams?.length||0;
        const lotteryTag=division?.lottery?' · Sorteio':'';
        return `<button type="button" role="option" data-page-state-tier="${tier}" class="${active?'is-active':''}" aria-selected="${active?'true':'false'}">Divisão ${tier}${teamCount?` · ${teamCount} clubes`:''}${lotteryTag}</button>`;
      }).join('');
    }
    if(!showStateTierPicker)setChampionshipPageStateTierPickerOpen(false);

    if(serieDModeTabs){
      const showSerieDModes=pageCompetition==='D'&&isSerieDKnockoutUiActive();
      serieDModeTabs.classList.toggle('hidden',!showSerieDModes);
      if(showSerieDModes){
        $$('#championshipPageSerieDMode [data-page-serie-d-mode]').forEach(button=>{
          const active=button.dataset.pageSerieDMode===pageSerieDMode;
          button.classList.toggle('is-active',active);
          button.setAttribute('aria-selected',active?'true':'false');
        });
      }
    }

    if(pageCompetition==='D'){
      const lastGroup=Math.max(0,serieDGroups.length-1);
      pageSerieDGroup=clamp(pageSerieDGroup,0,lastGroup);
      if(pageSerieDMode==='knockout'){
        if(!isSerieDKnockoutUiActive())pageSerieDMode='groups';
        else{
          const maxPhase=Math.max(1,serieDMaxGeneratedPhaseIndex());
          pageSerieDPhase=clamp(pageSerieDPhase||1,1,maxPhase);
        }
      }
    }else if(pageCompetition==='CUP'){
      pageCupPhase=clamp(pageCupPhase||cupCompetition.currentPhase||1,1,cupPhaseDefinitions.length);
    }

    const knockout=championshipPageIsKnockoutView();
    tableCard?.classList.toggle('is-knockout',knockout);

    if(menu){
      const pickerActive=championshipPickerActiveId(pageCompetition);
      menu.innerHTML=getPageCompetitionOptions().map(option=>`<button type="button" role="option" data-page-competition="${option.id}" class="${option.id===pickerActive?'is-active':''}" aria-selected="${option.id===pickerActive?'true':'false'}"><span class="championship-page-picker-trophy-slot" data-trophy-key="${option.trophyKey||'nacional'}" aria-hidden="true"></span><span>${option.label}</span></button>`).join('');
    }

    let subText='COMPETIÇÃO NACIONAL';
    let titleText=`BRASILEIRÃO SÉRIE ${pageCompetition}`;
    let canPrev=false,canNext=false;
    let stateInLeaguePhase=false;

    if(isStateHub){
      subText='CAMPEONATOS ESTADUAIS';
      titleText='ESCOLHA O ESTADO';
    }else if(pageCompetition==='RECOPA'){
      const status=recopaCompetition.complete?'ENCERRADA':recopaCompetition.ready?'EM DISPUTA':'AGUARDANDO';
      subText=`RECOPA NACIONAL · ${status}`;
      titleText='FINAL';
      canPrev=false;
      canNext=false;
    }else if(pageCompetition==='CUP'){
      const definition=cupPhaseDefinitions.find(item=>item.index===pageCupPhase);
      const stage=cupCompetition.stages.find(item=>item.index===pageCupPhase);
      const status=stage?.completed?'FASE CONCLUÍDA':stage?'EM DISPUTA':'AGUARDANDO SORTEIO';
      subText=`COPA DO BRASIL · ${status}`;
      titleText=definition?.name||`Fase ${pageCupPhase}`;
      canPrev=pageCupPhase>1;
      canNext=pageCupPhase<cupPhaseDefinitions.length;
    }else if(isStateComp){
      const division=stateLeagueEngine.getDivisionForBrowse(pageCompetition,userClub);
      const roundLimit=stateLeagueEngine.getRoundLimit(pageCompetition);
      pageStateRound=clamp(pageStateRound||stateLeagueEngine.getCurrentRound(pageCompetition,userClub),1,roundLimit);
      const leagueRounds=division?.leagueRoundCount??division?.groupRoundCount??0;
      const paulista=isPaulistaFormat(division);
      stateInLeaguePhase=pageStateRound<=leagueRounds;
      const stateName=stateParsed?ufLabel(stateParsed.uf):'Estadual';
      if(stateInLeaguePhase){
        if(paulista){
          subText=division?.complete?'ESTADUAL · ENCERRADO':'ESTADUAL · FASE DE GRUPOS';
          titleText=`${stateName} · GRUPO ${String.fromCharCode(65+(pageStateGroup||0))}`;
          canPrev=(pageStateGroup||0)>0;
          canNext=(pageStateGroup||0)<1||roundLimit>leagueRounds;
        }else{
          subText=division?.complete?'ESTADUAL · ENCERRADO':'ESTADUAL · PONTOS CORRIDOS';
          titleText=`${stateName} · CLASSIFICAÇÃO`;
          canPrev=false;
          canNext=roundLimit>leagueRounds;
        }
      }else{
        subText=division?.complete?'ESTADUAL · ENCERRADO':'ESTADUAL · MATA-MATA';
        titleText=stateLeagueEngine.getKnockoutPhaseTitle(pageCompetition,pageStateRound)||'FINAL';
        canPrev=pageStateRound>1;
        canNext=pageStateRound<roundLimit;
      }
    }else if(pageCompetition==='CMU'){
      const groups=WORLD_CUP_GROUP_LETTERS;
      pageWorldCupGroup=clamp(pageWorldCupGroup||0,0,groups.length-1);
      const activeGroup=groups[pageWorldCupGroup];
      const inKnockout=(pageWorldCupRound||1)>=4||worldCupCompetition?.phase==='knockout';
      if(inKnockout){
        const phaseLabel=KNOCKOUT_SCHEDULE.find(item=>item.round===(pageWorldCupRound||4))?.phase||'MATA-MATA';
        subText=worldCupCompetition?.complete?'COPA DO MUNDO · ENCERRADA':'COPA DO MUNDO · MATA-MATA';
        titleText=phaseLabel;
        canPrev=(pageWorldCupRound||4)>4;
        canNext=(pageWorldCupRound||4)<9;
      }else{
        subText=worldCupCompetition?.complete?'COPA DO MUNDO · ENCERRADA':'COPA DO MUNDO · FASE DE GRUPOS';
        titleText=`GRUPO ${activeGroup}`;
        canPrev=pageWorldCupGroup>0;
        canNext=pageWorldCupGroup<groups.length-1;
      }
    }else if(pageCompetition==='D'&&pageSerieDMode==='knockout'){
      const definition=serieDKnockoutPhaseDefs.find(item=>item.index===pageSerieDPhase)||serieDKnockoutPhaseDefs[0];
      const meta=serieDKnockoutPhaseMeta(definition);
      const nextDef=serieDKnockoutPhaseDefs.find(item=>item.index===pageSerieDPhase+1);
      subText=`SÉRIE D · MATA-MATA · ${meta.status}`;
      titleText=definition.key==='semi'&&nationalCompetitions.D.knockout?.stages?.playoff?.length
        ?'SEMIFINAL E REPESCAGEM'
        :definition.name;
      canPrev=true;
      canNext=Boolean(nextDef&&serieDKnockoutPhaseMeta(nextDef).generated);
    }else if(pageCompetition==='D'){
      const lastGroup=Math.max(0,serieDGroups.length-1);
      subText='PRIMEIRA FASE · GRUPOS';
      titleText=`BRASILEIRÃO SÉRIE D · GRUPO A${pageSerieDGroup+1}`;
      canPrev=pageSerieDGroup>0;
      canNext=pageSerieDGroup<lastGroup||isSerieDKnockoutUiActive();
    }else{
      const competition=nationalCompetitions[pageCompetition];
      const clubsCount=pageCompetition==='C'
        ?serieCClubsForSeason(careerSeason)
        :(competition?.teams?.length||competition?.clubs||20);
      subText='COMPETIÇÃO NACIONAL';
      titleText=`BRASILEIRÃO SÉRIE ${pageCompetition}`;
      if(competition?.format)subText=`${clubsCount} CLUBES · PONTOS CORRIDOS`;
    }

    if(sub)sub.textContent=subText;
    if(titleTextEl)titleTextEl.textContent=titleText;
    else if(title)title.textContent=titleText;
    if(trophyEl){
      void ensureCompetitionTrophy(pageCompetition,trophyEl);
      void preloadCompetitionTrophy(resolveChampionshipTrophyKey(pageCompetition));
    }
    if(prevBtn)prevBtn.disabled=!canPrev;
    if(nextBtn)nextBtn.disabled=!canNext;
    const lastGamesBtn=$('#championshipPageLastGamesBtn');
    if(lastGamesBtn)lastGamesBtn.classList.toggle('hidden',pageCompetition==='CUP'||pageCompetition==='RECOPA'||pageCompetition==='CMU'||isStateHub);

    if(isStateHub){
      tableCard?.classList.remove('is-knockout');
      if(head)head.innerHTML='';
      body.innerHTML=renderEstaduaisHub({stateLeagueEngine,userClub,stateFlagMarkup});
    }else if(knockout){
      if(head)head.innerHTML='';
      body.innerHTML=renderChampionshipPageKnockoutBody();
    }else if(isStateComp&&stateInLeaguePhase){
      tableCard?.classList.remove('is-knockout');
      const division=stateLeagueEngine.getDivisionForBrowse(pageCompetition,userClub);
      const leagueRounds=division?.leagueRoundCount??division?.groupRoundCount??0;
      const paulista=isPaulistaFormat(division);
      const groupIndex=paulista?Math.max(0,Math.min(1,pageStateGroup||0)):0;
      if(head)head.innerHTML='<span>#</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>';
      const rows=stateGroupRowsForDisplay(pageCompetition,groupIndex);
      const rowsHtml=rows.map((row,index)=>{
        const pos=index+1;
        const advance=index<4?'promotion':'';
        return `<div class="league-row ${advance} ${row.club===userClub?'highlight':''}" data-club="${row.club}" role="button" tabindex="0"><span>${pos}</span><span class="club-link">${row.club}</span><span>${row.played}</span><span>${row.wins}</span><span>${row.draws}</span><span>${row.losses}</span><span>${row.goalDiff>=0?'+':''}${row.goalDiff}</span><span>${row.points}</span></div>`;
      }).join('')||'<div class="championship-page-empty">Sem classificação disponível.</div>';
      const zoneLegend=paulista
        ?'<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>4 primeiros · Quartas de final</span></div>'
        :'<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>4 primeiros · Semifinal</span></div>';
      let gamesHtml='';
      if(!pageStateFixturesOpen){
        gamesHtml=renderChampionshipPageFixturesOpenBtn();
      }else{
        const roundLimit=stateLeagueEngine.getRoundLimit(pageCompetition);
        const toolbar=renderChampionshipPageFixturesToolbar({roundLimit,round:pageStateRound});
        const games=stateLeagueEngine.getRoundGamesForBrowse(pageCompetition,pageStateRound,{simulateMatch:simulateRoundMatch});
        const completed=stateLeagueRoundCompleted(pageCompetition,pageStateRound,games);
        gamesHtml=renderChampionshipPageRoundFixtures(games,{completed,toolbarHtml:toolbar});
      }
      body.innerHTML=`<div class="championship-page-league-body"><div class="championship-page-standings-block">${rowsHtml}${zoneLegend}</div>${gamesHtml}</div>`;
    }else if(isStateComp){
      tableCard?.classList.add('is-knockout');
      const games=stateLeagueEngine.getRoundGamesForBrowse(pageCompetition,pageStateRound,{simulateMatch:simulateRoundMatch});
      const saved=(stateLeagueEngine.history[parseStateCompetitionKey(pageCompetition)?.uf||'']||[]).find(item=>item.round===pageStateRound);
      const completed=Boolean(saved?.games?.length)||games.every(game=>game.completed);
      const roundLimit=stateLeagueEngine.getRoundLimit(pageCompetition);
      const phaseLabel=stateLeagueEngine.getRoundPhaseLabel(pageCompetition,pageStateRound);
      let gamesHtml='';
      if(!pageStateFixturesOpen){
        gamesHtml=`${renderChampionshipPageRoundFixtures(games,{completed,roundLabel:phaseLabel})}${renderChampionshipPageFixturesOpenBtn()}`;
      }else{
        const toolbar=renderChampionshipPageFixturesToolbar({roundLimit,round:pageStateRound});
        gamesHtml=renderChampionshipPageRoundFixtures(games,{completed,toolbarHtml:toolbar});
      }
      if(head)head.innerHTML='';
      body.innerHTML=gamesHtml;
    }else if(pageCompetition==='CMU'){
      tableCard?.classList.remove('is-knockout');
      const inKnockout=(pageWorldCupRound||1)>=4||worldCupCompetition?.phase==='knockout';
      if(inKnockout){
        const round=pageWorldCupRound||4;
        const games=getWorldCupAllFixtures(worldCupCompetition).filter(game=>Number(game.round)===round);
        const phaseLabel=KNOCKOUT_SCHEDULE.find(item=>item.round===round)?.phase||`Rodada ${round}`;
        const completed=games.length>0&&games.every(game=>game.completed||game.homeGoals!=null);
        if(head)head.innerHTML='';
        body.innerHTML=renderChampionshipPageRoundFixtures(games,{completed,roundLabel:phaseLabel});
      }else{
        const activeGroup=WORLD_CUP_GROUP_LETTERS[pageWorldCupGroup]||'A';
        const rows=worldCupCompetition?computeGroupStandings(activeGroup,worldCupCompetition.groupFixtures,gameRandom):[];
        if(head)head.innerHTML='<span>#</span><span>SELEÇÃO</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>';
        const rowsHtml=rows.map((row,index)=>{
          const pos=index+1;
          const advance=index<2?'promotion':'';
          return `<div class="league-row ${advance} ${row.name===userNationalTeamName?'highlight':''}" data-national-team="${row.code||''}" role="button" tabindex="0"><span>${pos}</span><span class="club-link">${row.name}</span><span>${row.played||0}</span><span>${row.wins||0}</span><span>${row.draws||0}</span><span>${row.losses||0}</span><span>${row.gd>=0?'+':''}${row.gd||0}</span><span>${row.points||0}</span></div>`;
        }).join('')||'<div class="championship-page-empty">Sem classificação disponível.</div>';
        const zoneLegend='<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>2 primeiros · Avançam no grupo</span></div>';
        body.innerHTML=rowsHtml+zoneLegend;
      }
    }else{
      if(head)head.innerHTML='<span>#</span><span>CLUBE</span><span>J</span><span>V</span><span>E</span><span>D</span><span>SG</span><span>PTS</span>';
      const rows=['A','B','C'].includes(pageCompetition)
        ?standingsRowsForDisplay(pageCompetition)
        :pageCompetition==='D'
          ?seriesDGroupRowsForDisplay(pageSerieDGroup)
          :[...(nationalCompetitions[pageCompetition]?.standings||[])].sort((a,b)=>b.points-a.points||b.wins-a.wins||b.goalDiff-a.goalDiff);
      const rowsHtml=rows.map((row,index)=>{
        const pos=index+1;
        const zone=pageCompetition==='D'
          ?(index<4?'promotion':'')
          :leagueClassificationZone(pageCompetition,index,rows.length);
        return `<div class="league-row ${zone} ${row.club===userClub?'highlight':''}" data-club="${row.club}" role="button" tabindex="0"><span>${pos}</span><span class="club-link">${row.club}</span><span>${row.played}</span><span>${row.wins}</span><span>${row.draws}</span><span>${row.losses}</span><span>${row.goalDiff>=0?'+':''}${row.goalDiff}</span><span>${row.points}</span></div>`;
      }).join('')||'<div class="championship-page-empty">Sem classificação disponível.</div>';
      const zoneLegend=pageCompetition==='A'
        ?'<div class="championship-page-zone-legend"><span><i class="relegation" aria-hidden="true"></i>Z4 · Rebaixamento</span></div>'
        :pageCompetition==='B'
          ?'<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>G4 · Acesso</span><span><i class="relegation" aria-hidden="true"></i>Z4 · Rebaixamento</span></div>'
          :pageCompetition==='C'
            ?`<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>G4 · Acesso</span><span><i class="relegation" aria-hidden="true"></i>Z${serieCRelegationZone} · Rebaixamento</span></div>`
            :pageCompetition==='D'
              ?`<div class="championship-page-zone-legend"><span><i class="promotion" aria-hidden="true"></i>4 primeiros · Avançam do grupo</span>${isSerieDKnockoutUiActive()&&pageSerieDGroup===Math.max(0,serieDGroups.length-1)?'<span>› Mata-mata disponível</span>':''}</div>`
              :'';
      body.innerHTML=rowsHtml+zoneLegend;
    }
    setChampionshipPagePickerOpen(false);
    setChampionshipPageStateTierPickerOpen(false);
  };
  const selectChampionshipPageCompetition=competitionId=>{
    const valid=getPageCompetitionOptions().some(option=>option.id===competitionId)||isStateChampionshipPage(competitionId);
    if(!valid)return;
    pageCompetition=competitionId;
    if(competitionId==='CMU'){
      const letter=findUserWorldCupGroup(worldCupCompetition,userNationalTeamName);
      pageWorldCupGroup=Math.max(0,WORLD_CUP_GROUP_LETTERS.indexOf(letter||'A'));
      const userFixtures=worldCupCompetition?getWorldCupAllFixtures(worldCupCompetition).filter(game=>game.home===userNationalTeamName||game.away===userNationalTeamName):[];
      const pending=userFixtures.find(game=>!game.completed&&game.homeGoals==null);
      pageWorldCupRound=pending?.round||userFixtures.filter(game=>game.completed||game.homeGoals!=null).at(-1)?.round||1;
    }
    if(isStateChampionshipPage(competitionId)){
      pageStateRound=stateLeagueEngine.getCurrentRound(competitionId,userClub);
      pageStateGroup=0;
      pageStateFixturesMode='round';
      pageStateFixturesOpen=false;
    }
    if(competitionId==='ESTADUAIS'){
      pageStateGroup=0;
    }
    if(competitionId==='CUP')pageCupPhase=clamp(cupCompetition.currentPhase||1,1,cupPhaseDefinitions.length);
    if(competitionId==='D'){
      if(isSerieDKnockoutUiActive()&&currentRound>SERIE_D_GROUP_ROUNDS){
        pageSerieDMode='knockout';
        pageSerieDPhase=serieDPhaseIndexForRound(currentRound);
      }else{
        pageSerieDMode='groups';
        pageSerieDGroup=Math.max(0,userSerieDGroupIndex);
      }
    }
    setChampionshipPagePickerOpen(false);
    setChampionshipPageStateTierPickerOpen(false);
    renderChampionshipPage();
  };
  const getChampionshipPageState=()=>({
    pageCompetition,
    pageCupPhase,
    pageStateRound,
    pageStateGroup,
    pageSerieDMode,
    pageSerieDPhase,
    pageSerieDGroup,
    pageWorldCupGroup,
    pageWorldCupRound,
  });
  const patchChampionshipPageState=patch=>{
    if(patch.pageCupPhase!==undefined)pageCupPhase=patch.pageCupPhase;
    if(patch.pageStateRound!==undefined)pageStateRound=patch.pageStateRound;
    if(patch.pageStateGroup!==undefined)pageStateGroup=patch.pageStateGroup;
    if(patch.pageSerieDMode!==undefined)pageSerieDMode=patch.pageSerieDMode;
    if(patch.pageSerieDPhase!==undefined)pageSerieDPhase=patch.pageSerieDPhase;
    if(patch.pageSerieDGroup!==undefined)pageSerieDGroup=patch.pageSerieDGroup;
    if(patch.pageWorldCupGroup!==undefined)pageWorldCupGroup=patch.pageWorldCupGroup;
    if(patch.pageWorldCupRound!==undefined)pageWorldCupRound=patch.pageWorldCupRound;
  };
  ({focusChampionshipPageForUserGame,focusChampionshipPageForNextUserGame}=createChampionshipPageFocus({
    getUserDivision:()=>userDivision,
    getUserClub:()=>userClub,
    getClubs:()=>clubs,
    clamp,
    cupPhaseDefinitions,
    stateLeagueEngine,
    isStateLeagueGame,
    isStateChampionshipPage,
    isKnockoutShootoutCompetition,
    isUserFixture,
    getRealClub,
    stateCompetitionKey,
    getPageState:getChampionshipPageState,
    patchPageState:patchChampionshipPageState,
    selectChampionshipPageCompetition,
    renderChampionshipPage,
    getCurrentRound:()=>currentRound,
  }));
  openChampionshipStandings=()=>{
    router.openView('table');
    focusChampionshipPageForUserGame(liveMatchGame);
  };
  // Mini-tabela do Dashboard: vai para a seção Campeonatos (não abre o modal).
  onClick('#openChampionship',()=>router.openView('table'));
  router.onView('table',()=>{
    if(isWorldCupDashboard()&&worldCupCompetition){
      selectChampionshipPageCompetition('CMU');
      return;
    }
    focusChampionshipPageForNextUserGame(nextPendingUserEntry);
  });
  const stepChampionshipPageNav=step=>{
    if(isStateChampionshipPage(pageCompetition)){
      const division=stateLeagueEngine.getDivisionForBrowse(pageCompetition,userClub);
      const leagueRounds=division?.leagueRoundCount??division?.groupRoundCount??0;
      const limit=stateLeagueEngine.getRoundLimit(pageCompetition);
      const inLeaguePhase=(pageStateRound||1)<=leagueRounds;
      if(inLeaguePhase){
        if(isPaulistaFormat(division)){
          if(step>0){
            if(pageStateGroup<1)pageStateGroup+=1;
            else if(limit>leagueRounds)pageStateRound=leagueRounds+1;
          }else if(step<0&&pageStateGroup>0){
            pageStateGroup-=1;
          }
        }else if(step>0&&limit>leagueRounds){
          pageStateRound=leagueRounds+1;
        }else if(step<0){
          pageStateRound=clamp((pageStateRound||1)-1,1,leagueRounds);
        }
        renderChampionshipPage();
        return;
      }
      if(step<0&&pageStateRound<=leagueRounds+1){
        if(isPaulistaFormat(division)){
          pageStateRound=leagueRounds;
          pageStateGroup=1;
        }else{
          pageStateRound=leagueRounds;
        }
        renderChampionshipPage();
        return;
      }
      pageStateRound=clamp((pageStateRound||1)+step,1,limit);
    }else if(pageCompetition==='CMU'){
      const inKnockout=(pageWorldCupRound||1)>=4||worldCupCompetition?.phase==='knockout';
      if(inKnockout){
        pageWorldCupRound=clamp((pageWorldCupRound||4)+step,4,9);
      }else if(step>0){
        pageWorldCupGroup=Math.min(WORLD_CUP_GROUP_LETTERS.length-1,(pageWorldCupGroup||0)+1);
      }else{
        pageWorldCupGroup=Math.max(0,(pageWorldCupGroup||0)-1);
      }
    }else if(pageCompetition==='CUP'){
      pageCupPhase=clamp(pageCupPhase+step,1,cupPhaseDefinitions.length);
    }else if(pageCompetition==='D'){
      const lastGroup=Math.max(0,serieDGroups.length-1);
      if(pageSerieDMode==='knockout'){
        if(step<0){
          if(pageSerieDPhase>1)pageSerieDPhase-=1;
          else{
            pageSerieDMode='groups';
            pageSerieDGroup=lastGroup;
          }
        }else{
          const nextDef=serieDKnockoutPhaseDefs.find(item=>item.index===pageSerieDPhase+1);
          if(nextDef&&serieDKnockoutPhaseMeta(nextDef).generated)pageSerieDPhase+=1;
        }
      }else if(step>0){
        if(pageSerieDGroup<lastGroup)pageSerieDGroup+=1;
        else if(isSerieDKnockoutUiActive()){
          pageSerieDMode='knockout';
          pageSerieDPhase=1;
        }
      }else{
        pageSerieDGroup=Math.max(0,pageSerieDGroup-1);
      }
    }else return;
    renderChampionshipPage();
  };
  onClick('#championshipPagePickerBtn',event=>{
    event.stopPropagation();
    setChampionshipPagePickerOpen(!pagePickerOpen);
  });
  onClick('#championshipPageStateTierBtn',event=>{
    event.stopPropagation();
    setChampionshipPageStateTierPickerOpen(!pageStateTierPickerOpen);
  });
  onClick('#championshipPageStateTierMenu',event=>{
    const option=event.target.closest('[data-page-state-tier]');
    if(!option||!isStateChampionshipPage(pageCompetition))return;
    const parsed=parseStateCompetitionKey(pageCompetition);
    if(!parsed)return;
    const tier=Number(option.dataset.pageStateTier)||1;
    selectChampionshipPageCompetition(stateCompetitionKey(parsed.uf,tier));
  });
  onClick('#championshipPagePickerMenu',event=>{
    const option=event.target.closest('[data-page-competition]');
    if(!option)return;
    selectChampionshipPageCompetition(option.dataset.pageCompetition);
  });
  onClick('#championshipPageSerieDMode',event=>{
    const button=event.target.closest('[data-page-serie-d-mode]');
    if(!button||pageCompetition!=='D'||!isSerieDKnockoutUiActive())return;
    const mode=button.dataset.pageSerieDMode==='groups'?'groups':'knockout';
    if(mode===pageSerieDMode)return;
    pageSerieDMode=mode;
    if(mode==='knockout')pageSerieDPhase=serieDPhaseIndexForRound(currentRound);
    else pageSerieDGroup=Math.max(0,userSerieDGroupIndex);
    renderChampionshipPage();
  });
  onClick('#leagueTable',event=>{
    const btn=event.target.closest('[data-estadual-uf]');
    if(btn&&pageCompetition==='ESTADUAIS'&&!btn.disabled){
      selectChampionshipPageCompetition(stateCompetitionKey(btn.dataset.estadualUf,1));
      return;
    }
    if(!isStateChampionshipPage(pageCompetition))return;
    const division=stateLeagueEngine.getDivisionForBrowse(pageCompetition,userClub);
    const roundLimit=stateLeagueEngine.getRoundLimit(pageCompetition);
    if(event.target.closest('[data-state-fixtures-open]')){
      pageStateFixturesOpen=true;
      pageStateFixturesMode='round';
      pageStateRound=clamp(pageStateRound||stateLeagueEngine.getCurrentRound(pageCompetition,userClub),1,roundLimit);
      renderChampionshipPage();
      return;
    }
    if(!pageStateFixturesOpen)return;
    if(event.target.closest('[data-state-fixtures-round-prev]')){
      pageStateFixturesMode='round';
      pageStateRound=clamp((pageStateRound||1)-1,1,roundLimit);
      renderChampionshipPage();
      return;
    }
    if(event.target.closest('[data-state-fixtures-round-next]')){
      pageStateFixturesMode='round';
      pageStateRound=clamp((pageStateRound||1)+1,1,roundLimit);
      renderChampionshipPage();
    }
  });
  onClick('#championshipPagePrev',()=>stepChampionshipPageNav(-1));
  onClick('#championshipPageNext',()=>stepChampionshipPageNav(1));
  competitionRulesModal=createCompetitionRulesModalFeature({$,onClick});
  competitionRulesModal.bindHandlers({
    getPageCompetition:()=>pageCompetition,
    getCareerSeason:()=>careerSeason,
  });
  onClick('#championshipPageLastGamesBtn',()=>openChampionshipLastGames());
  document.addEventListener('click',event=>{
    if(pagePickerOpen){
      if(event.target.closest?.('#championshipPagePickerBtn')||event.target.closest?.('#championshipPagePickerMenu')||event.target.closest?.('.championship-page-picker:not(.championship-page-state-tier-picker)'))return;
      setChampionshipPagePickerOpen(false);
    }
    if(pageStateTierPickerOpen){
      if(event.target.closest?.('#championshipPageStateTierBtn')||event.target.closest?.('#championshipPageStateTierMenu')||event.target.closest?.('#championshipPageStateTierPicker'))return;
      setChampionshipPageStateTierPickerOpen(false);
    }
  });
  window.addEventListener('resize',()=>{
    if(pagePickerOpen)placeChampionshipPagePickerMenu();
    if(pageStateTierPickerOpen)placeChampionshipPageStateTierPickerMenu();
  });
  document.querySelector('main > .view')?.addEventListener('scroll',()=>{
    if(pagePickerOpen)placeChampionshipPagePickerMenu();
    if(pageStateTierPickerOpen)placeChampionshipPageStateTierPickerMenu();
  },{passive:true});
  renderChampionshipPage();

  const {
    resolveCupTie,
    finalizeCupStageIfReady,
    advanceCupComputerTies,
    advanceCupThroughDate,
  }=createCupTieAdvanceEngine({
    getCupCompetition:()=>cupCompetition,
    getUserClub:()=>userClub,
    getCurrentRound:()=>currentRound,
    isUserFixture,
    cupTieGames,
    cupTieAggregate,
    simulateCupComputerGame,
    cupPenaltyWinner,
    int,
    gameRandom,
    knockoutShootoutKickPair,
    pushMessage,
    nextCupEntrants,
    createCupStage,
    onCupScheduleChanged,
    persistPlayerHistory:()=>playerHistory.persist(),
    invalidateUserScheduleCache,
  });
  let advanceStateLeagueThroughDate=()=>false;
  let advancePostMatchDay=()=>{};
  let advanceStateLeagueRound=()=>false;
  let advanceSeasonRound=()=>{};
  let advanceCupRound=()=>{};
  let simulateIdleRound=()=>({sacked:false,finished:false});
  if(validSavedSeason&&FEATURES.stateLeague&&savedNewGame){
    advanceStateLeagueThroughDateCore({
      getSavedNewGame:()=>savedNewGame,
      getStateLeagueEngine:()=>stateLeagueEngine,
      simulateRoundMatch,
      getUserClub:()=>userClub,
      rebuildCalendarGames,
      persistPlayerHistory:()=>playerHistory.persist(),
      invalidateUserScheduleCache,
    },careerCalendarDate);
  }
  const reconcileSerieACupEntry=()=>{
    if(userDivision!=='A'||!cupSerieAEntrants.includes(userClub))return false;
    const userHadCup=cupCompetition.stages.some(stage=>stage.fixtures.some(game=>game.home===userClub||game.away===userClub));
    if(userHadCup)return false;
    const phase4=cupCompetition.stages.find(stage=>stage.index===4),phase5=cupCompetition.stages.find(stage=>stage.index===5);
    if(!phase4?.completed||phase5?.entrants?.includes(userClub))return false;
    const winners=Array.isArray(phase4.winners)&&phase4.winners.length?phase4.winners:[];
    if(!winners.length){
      const tieIds=[...new Set(phase4.fixtures.map(game=>game.tieId))];
      tieIds.forEach(tieId=>{const winner=resolveCupTie(phase4,tieId);if(winner)winners.push(winner);});
      if(winners.length!==tieIds.length)return false;
      phase4.winners=winners;phase4.completed=true;
    }
    if(phase5){
      const phaseIndex=cupCompetition.stages.findIndex(stage=>stage.index===5);
      if(phaseIndex>=0)cupCompetition.stages.splice(phaseIndex,1);
    }
    createCupStage(5,nextCupEntrants(4,phase4.winners));
    refreshCopaDoBrasilFixtures();
    return true;
  };
  let advanceCalendarWeek=()=>{};
  let seasonTransition=null;
  let tryPrepareSeasonTransition=()=>false;
  let prepareSeasonTransition=()=>{};
  let finishRemainingNationalRounds=()=>{};
  let simulateNonHumanSeasonRemainder=()=>{};
  if(new URLSearchParams(location.search).has('engineTest')||new URLSearchParams(location.search).has('cupAudit')){
    window.__brfutEngineBenchmark=(count=1000)=>{
      const sample=Math.max(1,Math.min(10000,Number(count)||1000)),fixtures=futureMatches.length?futureMatches:Object.values(nationalCompetitions[userDivision]?.fixtures||{})[0]||[],totals={matches:sample,goals:0,shots:0,onTarget:0,draws:0,scoreless:0,overFour:0,homeWins:0,awayWins:0,maxGoals:0};
      for(let index=0;index<sample;index++){const fixture=fixtures[index%fixtures.length],result=simulateRoundMatch(fixture.home,fixture.away,fixture),goals=result.homeGoals+result.awayGoals;totals.goals+=goals;totals.shots+=result.data.homeShots+result.data.awayShots;totals.onTarget+=result.data.homeOnTarget+result.data.awayOnTarget;totals.draws+=result.homeGoals===result.awayGoals?1:0;totals.scoreless+=goals===0?1:0;totals.overFour+=goals>=5?1:0;totals.homeWins+=result.homeGoals>result.awayGoals?1:0;totals.awayWins+=result.awayGoals>result.homeGoals?1:0;totals.maxGoals=Math.max(totals.maxGoals,goals);}
      return {...totals,goalsPerMatch:Number((totals.goals/sample).toFixed(3)),shotsPerMatch:Number((totals.shots/sample).toFixed(3)),onTargetPerMatch:Number((totals.onTarget/sample).toFixed(3)),drawRate:Number((totals.draws/sample*100).toFixed(1)),scorelessRate:Number((totals.scoreless/sample*100).toFixed(1)),overFourRate:Number((totals.overFour/sample*100).toFixed(1)),homeWinRate:Number((totals.homeWins/sample*100).toFixed(1)),awayWinRate:Number((totals.awayWins/sample*100).toFixed(1))};
    };
    window.__brfutEngineExports={clubs,simulateRoundMatch,savedNewGame:!!savedNewGame,userDivision,createInjuryRecord,normalizeInjury,injuryCatalog,calculateEventInjuryChance,injuryMechanismFromEvent,workloadRisk,recoveryRisk,recordPlayerMatchWorkload,ensureWorkload,injuryInRestrictedPhase,matchPlayerStat,playerRehabMaxMinutes,beginRestrictedReturn,advanceRestrictedRehab,clearInjuryFully,clubMedicalQuality,medicalRecoveryModifier,medicalPreventionModifier,resolveInjuryTreatment,summarizeMatchInjuries,engineTuning,buildSimLineup,engineFoulRisk,engineBlowoutDamp};
    window.__matchdayEngineBenchmark=window.__brfutEngineBenchmark;
    window.__matchdayEngineExports=window.__brfutEngineExports;
  }
  // A tabela da rodada respeita exatamente os confrontos definidos no calendário.
  const normalizeRoundGames=filterPlayableRoundGames;
  simulateRoundResults=createRoundResultsSimulator({
    getRoundResults:()=>roundResults,
    setRoundResults:value=>{roundResults=value;},
    currentRoundFixtures,
    isUserFixture,
    simulateRoundMatch,
    getUserClub:()=>userClub,
    getHomeGoals:()=>home,
    getAwayGoals:()=>away,
    getLiveSideGoals:()=>goals,
    getLiveMatchGame:()=>liveMatchGame,
  });
  
  const roundResultsBrowser=createRoundResultsBrowser({
    $,
    onClick,
    filterPlayableRoundGames,
    normalizeRoundGames,
    getUserDivision:()=>userDivision,
    getCurrentRound:()=>currentRound,
    getUserClub:()=>userClub,
    getUserSerieDGroupIndex:()=>userSerieDGroupIndex,
    getSeasonRoundHistory:()=>seasonRoundHistory,
    getCompetitionRoundHistory:()=>competitionRoundHistory,
    getWorldCupCompetition:()=>worldCupCompetition,
    getNationalCompetitions:()=>nationalCompetitions,
    isStateChampionshipDivision,
    stateLeagueEngine,
    getWorldCupAllFixtures,
    simulateRoundMatch,
    simulateRoundResults:()=>simulateRoundResults(),
    getRoundPreviewResults:()=>roundPreviewResults,
    setRoundPreviewResults:value=>{roundPreviewResults=value;},
    isWorldCupDashboard,
    getUserNationalTeamName:()=>userNationalTeamName,
    WORLD_CUP_GROUP_LETTERS,
    findUserWorldCupGroup,
    KNOCKOUT_SCHEDULE,
    getSerieDGroups:()=>serieDGroups,
    resolveNationalTeam,
  });
  openRoundResults=roundResultsBrowser.openRoundResults;
  const renderRoundResultsBrowser=roundResultsBrowser.renderRoundResultsBrowser;
  const {
    setRoundBrowserLockedCompetition,
    setRoundBrowserDivision,
    setRoundBrowserRound,
    setRoundBrowserGroup,
    setRoundBrowserWorldCupGroup,
    bindCloseHandler,
  }=roundResultsBrowser;
  openChampionshipLastGames=createChampionshipLastGamesOpener({
    getPageCompetition:()=>pageCompetition,
    getUserClub:()=>userClub,
    getCurrentRound:()=>currentRound,
    stateLeagueEngine,
    getPageState:getChampionshipPageState,
    championshipPageIsKnockoutView,
    setChampionshipPagePickerOpen,
    setRoundBrowserLockedCompetition,
    setRoundBrowserDivision,
    setRoundBrowserRound,
    setRoundBrowserGroup,
    setRoundBrowserWorldCupGroup,
    renderRoundResultsBrowser,
    openRoundResultsModal:()=>$('#roundResultsModal').classList.remove('hidden'),
  });
  bindCloseHandler(()=>{
    // Pós-jogo pendente: volta ao resumo; senão só atualiza o CTA do dashboard.
    if(matchStarted&&matchFinished&&!roundCommitted&&liveMatchGame)reopenMatchWindow();
    renderUserMatchPresentation();
  });
  const saveQuotaState={warned:false};
  window.addEventListener('brfut:save-quota',()=>{
    if(saveQuotaState.warned)return;
    saveQuotaState.warned=true;
    pushMessage({
      category:'system',
      type:'warning',
      title:'Memória do navegador cheia',
      body:'Não foi possível salvar todo o progresso. O jogo tentou compactar históricos e dados secundários. Feche abas extras, use Ctrl+Shift+R e, se persistir, limpe dados antigos do site (Configurações do navegador → Armazenamento para este endereço).',
    });
  });
  let latestLiveMatchSnapshot=null;
  let managerJobCrisis=validSavedSeason&&savedSeason.managerJobCrisis
    ?hydrateManagerJobCrisis(savedSeason.managerJobCrisis)
    :null;
  const initialPendingDivisionTeams=(validSavedSeason&&savedSeason.pendingDivisionTeams?.A&&savedSeason.pendingDivisionTeams?.B&&savedSeason.pendingDivisionTeams?.C&&savedSeason.pendingDivisionTeams?.D)
    ?normalizeDivisionTeamsSerieC({
      A:[...savedSeason.pendingDivisionTeams.A],
      B:[...savedSeason.pendingDivisionTeams.B],
      C:[...savedSeason.pendingDivisionTeams.C],
      D:[...savedSeason.pendingDivisionTeams.D],
    },{season:careerSeason+1,userClub,fillPool:generatedClubPool,dTarget:SERIE_D_CLUBS}).divisionTeams
    :null;
  const initialPendingUserDivision=(validSavedSeason&&initialPendingDivisionTeams&&savedSeason.pendingUserDivision)
    ?savedSeason.pendingUserDivision
    :userDivision;
  const initialSeasonTransitionPrepared=!!(validSavedSeason&&(savedSeason.seasonTransitionPrepared||(Array.isArray(savedSeason.userBudgetLedger)&&savedSeason.userBudgetLedger.some(entry=>entry?.reason==='season_prize'))));
  const writeSeasonSave=createSeasonSaveWriter({
    getSavedNewGame:()=>savedNewGame,
    getUserClub:()=>userClub,
    getUserDivision:()=>userDivision,
    getSeasonGoal:()=>seasonGoal,
    getSeasonGoalResult:()=>seasonGoalResult,
    getSeasonObjectives:()=>seasonObjectives,
    getSeasonObjectivesResult:()=>seasonObjectivesResult,
    getManagerJobCrisis:()=>managerJobCrisis,
    getClubs:()=>clubs,
    getNationalRankingEntries:()=>nationalRankingEntries,
    getNationalCompetitions:()=>nationalCompetitions,
    getCompetitionRoundHistory:()=>competitionRoundHistory,
    getCupCompetition:()=>cupCompetition,
    getRecopaCompetition:()=>recopaCompetition,
    getWorldCupCompetition:()=>worldCupCompetition,
    getCurrentRound:()=>currentRound,
    getCareerCalendarDate:()=>careerCalendarDate,
    calendarKey,
    getTrainingRules:()=>trainingRules,
    getContractAlertKeys:()=>contractAlertKeys,
    getUserSeasonCrowds:()=>userSeasonCrowds,
    getFormation:()=>formation,
    getSerieDGroups:()=>serieDGroups,
    getCareerSeason:()=>careerSeason,
    getSeasonRoundHistory:()=>seasonRoundHistory,
    getNationalRankingFinalizedSeasons:()=>nationalRankingFinalizedSeasons,
    getNationalTeamOffersSentYear:()=>nationalTeamOffersSentYear,
    getNationalTeamOfferState:()=>nationalTeamOfferState,
    getPlayerDevelopment:()=>playerDevelopment,
    getPendingSponsorChoice:()=>pendingSponsorChoice,
    getPendingSponsorOffers:()=>pendingSponsorOffers,
    getAllScorers:()=>allScorers,
    getAllAssistants:()=>allAssistants,
    ensureStadium,
    getBalance,
    getMessages:()=>messages.getMessages(),
    getTransfersEngine:()=>transfersEngine,
    getValidSavedSeason:()=>validSavedSeason,
    getSavedSeason:()=>savedSeason,
    getTactics:()=>tactics,
    getStateLeagueEngine:()=>stateLeagueEngine,
    getSeasonTransition:()=>seasonTransition,
    getManagerRanking:()=>managerRanking,
    managerRankingHelpers,
    persistCareer,
    saveQuotaState,
    tvHomeSlots,
    persistActiveLiveMatch:({seed,activeUserClub})=>{
      if(!matchStarted||!liveMatchGame||roundCommitted)return {activeLiveMatch:null};
      const snap=latestLiveMatchSnapshot||buildLiveMatchSnapshot({
        seed,
        liveMatchGame,
        minute,home,away,pauses,halftimeShown,secondHalfStarted,matchStarted,matchFinished,preMatchPreparation,
        activePreparationTitle,substitutions,awaySubstitutions,awaySubWindows,substitutedOut,
        disciplineEvents,availabilityCommitted,roundResultMessagePushed,stats,cards,goals,matchFactors,
        liveInjuries,liveDeferredInjuries,liveOpeningLineup,liveMinutesPlayed,matchDiscipline,
        liveVolumeSamples,liveVolumePrev,liveVolumePulse,liveVolumeIncidents,postMatchMedicalQueue,
        shootoutState,pendingPenalty,preMatchTacticSnapshot,
        stoppageFirst,stoppageSecond,stoppageElapsed,stoppageActive,stoppageHalfSnap,
        userFormation:formation,
        userLineupOrder:activeUserSquad.map(player=>player.name),
        awayFormation:matchClub()?.formation,
        awayLineupOrder:matchClub()?.roster?.map(player=>player.name)||[],
        liveClockSeconds:matchLiveUi.getLiveClockSeconds?.()||0,
        timelineHtml:timeline?.innerHTML||'',
        matchStatusText:$('#matchStatus')?.textContent||'',
        ui:{
          pauseOpen:!!$('#pausePanel')&&!$('#pausePanel').classList.contains('hidden'),
          statsOpen:!!$('#stats')&&!$('#stats').classList.contains('hidden'),
          penaltyOpen:!!$('#penaltyChoice')&&!$('#penaltyChoice').classList.contains('hidden'),
          shootoutOpen:!!$('#shootoutPanel')&&!$('#shootoutPanel').classList.contains('hidden'),
        },
      });
      if(snap){
        latestLiveMatchSnapshot=snap;
        saveLiveMatchSave(snap);
      }
      return {
        activeLiveMatch:{
          fixtureId:fixtureIdFromGame(liveMatchGame),
          home:liveMatchGame.home,
          away:liveMatchGame.away,
          competition:liveMatchGame.competition||null,
          round:liveMatchGame.round??currentRound,
        },
      };
    },
  });
  careerPersistence.bindWriteSeasonSave(()=>writeSeasonSave());
  persistSeason=careerPersistence.persistSeason.bind(careerPersistence);
  const persistAfterRoundAdvance=careerPersistence.persistAfterRoundAdvance.bind(careerPersistence);
  const notifyUserMatchPlayed=careerPersistence.notifyUserMatchPlayed.bind(careerPersistence);
  dashboard.setPersist(persistSeason);
  void ensureCalendarView().then(cv=>cv.setPersist?.(persistSeason));
  tactics.setPersist(persistSeason);
  messages.setPersist(persistSeason);
  void ensureTransfersUi().then(ui=>ui.setPersist?.(persistSeason));
  let bootPersistPending=false;
  if(validSavedSeason&&(savedSeason.currentRound!==currentRound||knockoutShootoutSanitized))bootPersistPending=true;
  if(calendarBootRepaired&&validSavedSeason)bootPersistPending=true;
  if(leagueScheduleMaterializedFresh&&validSavedSeason)bootPersistPending=true;
  careerPersistence.bindBeforeUnloadPersist();
  careerPersistence.bindPeriodicAutosave();
  let advanceToMatchDay=()=>null;
  onClick('#openDashboardCalendar',()=>advanceToMatchDay());
  onClick('#calendarAdvanceWeek',()=>advanceCalendarWeek());
  if(!new URLSearchParams(location.search).has('cupAudit')&&reconcileSerieACupEntry()){
    console.warn(`Copa do Brasil: ${userClub} reintegrado à 5ª fase (save inconsistente corrigido).`);
    rebuildCalendarGames();
    $('#calendar .title span').textContent=`Agenda nacional de janeiro a dezembro · ${championshipFixtures.flat().length} jogos do Brasileiro · ${copaDoBrasilFixtures.length} jogos confirmados da Copa do Brasil · ${calendarIntervalLabel(restConflictCount)}.`;
    refreshSeasonPresentation();
    bootPersistPending=true;
  }
  if(bootPersistPending)persistSeason(true);
  const { recordGameLeaders, applyRoundToTable } = createGameLeadersTable({
    getClubs: () => clubs,
    getNationalTeamClub,
    getAllScorers: () => allScorers,
    getAllAssistants: () => allAssistants,
    getUserDivision: () => userDivision,
    getCurrentRound: () => currentRound,
    recordPlayerHistoryMatch,
    getNationalCompetitions: () => nationalCompetitions,
    getLeagueData: () => leagueData,
    applyMatchAvailability,
  });
  ({
    buildLiveKnockoutStats,
    commitLiveKnockoutResult,
  } = createLiveKnockoutCommit({
    calendarLiveSideStats,
    calendarLiveScores,
    calendarLiveSideGoals,
    calendarPossessionPair,
    getLiveMatchGame: () => liveMatchGame,
    getAvailabilityCommitted: () => availabilityCommitted,
    commitLiveAvailability,
    recordGameLeaders,
    persistPlayerHistory: () => playerHistory.persist(),
    getCupCompetition: () => cupCompetition,
    resolveCupTie,
    finalizeCupStageIfReady,
    completeRecopaNationalFixture,
    getRecopaCompetition: () => recopaCompetition,
    refreshRecopaFixtures,
    rebuildCalendarGames,
  }));
  const buildLiveCupStats = buildLiveKnockoutStats;
  const commitLiveCupResult = commitLiveKnockoutResult;
  const { simulateNationalRound, applySecondaryResult } = createNationalRoundSimulator({
    getUserDivision: () => userDivision,
    getCurrentRound: () => currentRound,
    getNationalCompetitions: () => nationalCompetitions,
    getCompetitionRoundHistory: () => competitionRoundHistory,
    getRoundPreviewResults: () => roundPreviewResults,
    getClubs: () => clubs,
    simulateRoundMatch,
    recordGameLeaders,
    creditLeagueHomeTvForGames,
    compactMatchResult,
    persistPlayerHistory: () => playerHistory.persist(),
    applyMatchAvailability,
  });
  const dKnockout=nationalCompetitions.D.knockout;
  const{
    serieDPromotedClubs,
    getKnockoutTieGames,
    updateSeriesDKnockout,
  }=createSerieDKnockoutAdvance({
    getDKnockout:()=>dKnockout,
    getNationalCompetitions:()=>nationalCompetitions,
    getUserDivision:()=>userDivision,
    getSeasonRoundHistory:()=>seasonRoundHistory,
    getCompetitionRoundHistory:()=>competitionRoundHistory,
    getSerieDGroups:()=>serieDGroups,
    isUserFixture,
    cupTieGames,
    getCupCompetition:()=>cupCompetition,
    isStateKnockoutPhase,
    isKnockoutShootoutCompetition,
    KNOCKOUT_COMPETITIONS,
    sameKnockoutFixture,
    resolveKnockoutTieWinner,
    knockoutTieNeedsPlayedShootout,
    cupPenaltyWinner,
    int,
    gameRandom,
    knockoutShootoutKickPair,
    notifySerieDKnockoutPhase,
    rebuildCalendarGames,
    SERIE_D_PROMOTIONS,
  });
  const { finalizeNationalRankingSeason } = createNationalRankingFinalize({
    getCareerSeason: () => careerSeason,
    getFinalizedSeasons: () => nationalRankingFinalizedSeasons,
    getNationalRankingEntries: () => nationalRankingEntries,
    getNationalCompetitions: () => nationalCompetitions,
    getDKnockout: () => dKnockout,
    getCupCompetition: () => cupCompetition,
    accumulateNationalRankingLeaguePoints,
    awardNationalRankingTitles,
    getRankingViews: () => rankingViews,
  });
  const careerCrisisBlocks=()=>
    managerJobCrisis?.status==='sacked'||managerJobCrisis?.status==='bankrupt';
  /** Evita cobrança financeira / avisos de emprego sobre simulação idle ou balanço de fim de temporada. */
  const isCareerPopupDeferred=()=>{
    if(seasonTransition?.isNonHumanSimRunning?.())return true;
    if(seasonTransition?.isSeasonTransitionPrepared?.())return true;
    const idle=$('#idleSeasonSimModal');
    if(idle&&!idle.classList.contains('hidden'))return true;
    const summary=$('#seasonTransitionModal');
    if(summary&&!summary.classList.contains('hidden'))return true;
    return false;
  };
  const closeDeferredCareerPopups=()=>{
    managerJobWarnUi?.close?.();
    clubFinancialRestrictionUi?.close?.();
    clubInsolvencyWarnUi?.close?.();
  };
  const openCareerCrisisModal=()=>{
    if(managerJobCrisis?.status==='bankrupt'){
      openClubBankruptcyModal();
      return true;
    }
    if(managerJobCrisis?.status==='sacked'){
      openManagerSackModal();
      return true;
    }
    return false;
  };
  const openManagerSackModal=()=>{
    if(!managerJobCrisis||managerJobCrisis.status!=='sacked')return;
    managerSackUi.open({
      clubName:userClub,
      managerName:careerProfile.managerName,
      message:managerJobCrisis.message,
      board:managerJobCrisis.board,
      finances:managerJobCrisis.finances,
      offers:managerJobCrisis.offers||[],
      division:userDivision,
    });
  };
  const openClubBankruptcyModal=()=>{
    if(!managerJobCrisis||managerJobCrisis.status!=='bankrupt')return;
    clubBankruptcyUi.open({
      clubName:userClub,
      managerName:careerProfile.managerName,
      message:managerJobCrisis.message,
      board:managerJobCrisis.board,
      finances:managerJobCrisis.finances,
      cash:managerJobCrisis.cash,
      debt:managerJobCrisis.debt,
      reason:managerJobCrisis.reason,
    });
  };
  const evaluateClubSolvencyRisk=()=>{
    if(!savedNewGame||!clubs[userClub])return false;
    if(managerJobCrisis?.status==='bankrupt'){
      openClubBankruptcyModal();
      return true;
    }
    const club=clubs[userClub];
    const standing=userStandingSnapshot();
    const loan=getBankLoan(club);
    const solvency=resolveClubBankruptcyRisk({
      cash:getBalance(club),
      roundCost:estimateRoundCostBill(club,userDivision,{managerReputation:club.managerReputation}),
      overdraftStreak:club.overdraftStreak||0,
      finances:club.finances,
      loanBalance:bankLoanBalance(club),
      delinquencyStreak:loan?.delinquencyStreak||0,
      loanServiceShortfall:!!club.loanServiceShortfall,
      played:standing?.played||0,
      honeymoonRounds:MANAGER_JOB_HONEYMOON_ROUNDS,
      alreadyBankrupt:false,
    });
    if(solvency.status==='warn_insolvent'&&!managerJobCrisis?.warnedInsolvent){
      managerJobCrisis={
        ...(managerJobCrisis||{}),
        warnedInsolvent:true,
        board:club.board,
        finances:club.finances,
      };
      if(!isCareerPopupDeferred()){
        // One-shot em tela — não vai para a inbox (evita sobrecarregar a caixa).
        clubInsolvencyWarnUi.open({
          clubName:userClub,
          message:solvency.message,
          cash:getBalance(club),
          debt:bankLoanBalance(club),
          delinquencyStreak:solvency.delinquencyStreak,
        });
      }
      persistSeason(true);
    }
    if(solvency.status!=='bankrupt'){
      const restriction=resolveFinancialRestriction({
        active:!!club.financialRestriction?.active,
        sinceRound:club.financialRestriction?.sinceRound,
        warnedInsolvent:!!managerJobCrisis?.warnedInsolvent||solvency.status==='warn_insolvent',
        cash:getBalance(club),
        overdraftStreak:club.overdraftStreak||0,
        delinquencyStreak:loan?.delinquencyStreak||0,
        round:currentRound,
      });
      applyFinancialRestriction(club,restriction);
      if(restriction.justEntered){
        if(!isCareerPopupDeferred()){
          clubFinancialRestrictionUi.open({
            clubName:userClub,
            message:restriction.message,
            cash:getBalance(club),
            debt:bankLoanBalance(club),
          });
        }
        persistSeason(true);
      }else if(restriction.justCleared){
        persistSeason(true);
      }
    }
    if(solvency.status==='bankrupt'){
      managerJobCrisis={
        status:'bankrupt',
        reason:solvency.reason,
        message:solvency.message,
        board:Math.round(club.board||0),
        finances:Math.round(club.finances||0),
        cash:getBalance(club),
        debt:bankLoanBalance(club),
        overdraftStreak:solvency.overdraftStreak,
        delinquencyStreak:solvency.delinquencyStreak,
        warnedInsolvent:true,
        warnedBoard:true,
        warnedFinances:true,
        offers:[],
      };
      applyFinancialRestriction(club,{active:false,sinceRound:null,reason:null});
      clubInsolvencyWarnUi.close();
      clubFinancialRestrictionUi.close();
      pushMessage({
        category:'club',
        type:'club-bankrupt',
        title:'FALÊNCIA DO CLUBE',
        body:solvency.message,
        round:currentRound,
        read:false,
        meta:{requiresAction:true},
      });
      persistSeason(true);
      openClubBankruptcyModal();
      return true;
    }
    return false;
  };
  const MANAGER_JOB_WARN_TITLES={
    warn_finances:'Cobrança financeira',
    warn_board:'Diretoria inquieta',
    warn_board_final:'Diretoria no limite',
    critical:'Projeto sob ameaça',
    critical_grace:'Última chance',
    warn_warm:'Desequilíbrio institucional',
    warn_imminent:'Demissão iminente',
    shield_fortress:'Projeto protegido',
  };
  const pushManagerJobInbox=(risk)=>{
    if(!risk?.message||!risk.popupKind)return;
    const map={
      warn_finances:['COBRANÇA FINANCEIRA','manager-warn-finances'],
      warn_board:['DIRETORIA INQUIETA','manager-warn-board'],
      warn_board_final:['DIRETORIA NO LIMITE','manager-warn-board-final'],
      critical:['PROJETO SOB AMEAÇA','manager-warn-critical'],
      critical_grace:['ÚLTIMA CHANCE','manager-warn-grace'],
      warn_warm:['DESEQUILÍBRIO INSTITUCIONAL','manager-warn-warm'],
      warn_imminent:['DEMISSÃO IMINENTE','manager-warn-imminent'],
      shield_fortress:['PROJETO PROTEGIDO','manager-warn-shield'],
    };
    const [title,type]=map[risk.popupKind]||['ALERTA DE EMPREGO','manager-warn'];
    pushMessage({category:'club',type,title,body:risk.message,round:currentRound,read:false});
  };
  const openManagerJobWarnPopup=(risk,shield)=>{
    if(!risk?.popupKind||risk.status==='sacked'||risk.status==='ok')return;
    if(isCareerPopupDeferred())return;
    const kind=risk.popupKind;
    const repeatOk=kind==='warn_imminent'||kind==='warn_warm'||kind==='warn_board_final';
    const warnedPopups=managerJobCrisis?.warnedPopups||{};
    if(!repeatOk&&warnedPopups[kind])return;
    const dedupeKey=`${kind}-${currentRound}-${risk.reason||''}`;
    if(managerJobCrisis?.lastWarnPopupKey===dedupeKey&&!repeatOk)return;
    managerJobWarnUi.open({
      kind,
      title:MANAGER_JOB_WARN_TITLES[kind]||'Alerta de emprego',
      message:risk.message,
      clubName:userClub,
      board:risk.board,
      finances:risk.finances,
      shieldLabel:shield?.label||'',
    });
    managerJobCrisis={
      ...(managerJobCrisis||{}),
      lastWarnPopupKey:dedupeKey,
      warnedPopups:{...warnedPopups,[kind]:true},
    };
  };
  const evaluateManagerJobRisk=()=>{
    if(!savedNewGame||!clubs[userClub])return false;
    if(evaluateClubSolvencyRisk())return true;
    if(managerJobCrisis?.status==='sacked'){
      openManagerSackModal();
      return true;
    }
    const campaign=buildManagerCampaignContext();
    const club=clubs[userClub];
    const risk=resolveBoardJobRisk({
      board:club.board,
      finances:club.finances,
      played:campaign.standing?.played||0,
      honeymoonRounds:MANAGER_JOB_HONEYMOON_ROUNDS,
      boardCrisisStreak:managerJobCrisis?.boardCrisisStreak||0,
      warmCrisisStreak:managerJobCrisis?.warmCrisisStreak||0,
      alreadySacked:false,
      campaignShield:campaign.shield,
      bufferGraceActive:!!managerJobCrisis?.bufferGraceActive,
    });
    const streak=Math.max(0,Number(risk.boardCrisisStreak)||0);
    const warmStreak=Math.max(0,Number(risk.warmCrisisStreak)||0);
    const nextBufferGrace=
      risk.status==='critical_grace'?true:
      risk.status==='sacked'?false:
      risk.status==='ok'&&shouldResetJobWarningState(club.board,club.finances)?false:
      !!managerJobCrisis?.bufferGraceActive;
    if(risk.status==='ok'&&shouldResetJobWarningState(club.board,club.finances)){
      managerJobCrisis={
        board:risk.board,
        finances:risk.finances,
        boardCrisisStreak:0,
        warmCrisisStreak:0,
        bufferGraceActive:false,
        campaignShield:risk.campaignShield||campaign.shield.level,
      };
      persistSeason(true);
      return false;
    }
    managerJobCrisis={
      ...(managerJobCrisis||{}),
      board:risk.board,
      finances:risk.finances,
      boardCrisisStreak:streak,
      warmCrisisStreak:warmStreak,
      bufferGraceActive:nextBufferGrace,
      campaignShield:risk.campaignShield||campaign.shield.level,
    };
    if(risk.status==='sacked'){
      const offers=generateJobOffers({
        clubs,
        userClub,
        userDivision,
        managerRanking,
        seed:savedNewGame.seed||careerSeason,
        count:3,
      });
      managerJobCrisis={
        status:'sacked',
        reason:risk.reason,
        message:risk.message,
        board:risk.board,
        finances:risk.finances,
        boardCrisisStreak:streak,
        warmCrisisStreak:warmStreak,
        bufferGraceActive:false,
        warnedBoard:true,
        warnedFinances:true,
        warnedBoardStreak:true,
        warnedPopups:managerJobCrisis?.warnedPopups||{},
        offers,
      };
      managerJobWarnUi.close();
      pushMessage({
        category:'club',
        type:'manager-sacked',
        title:'DEMISSÃO',
        body:risk.message,
        round:currentRound,
        read:false,
        meta:{requiresAction:true},
      });
      persistSeason(true);
      openManagerSackModal();
      return true;
    }
    const shouldInbox=(
      (risk.status==='warn_finances'&&!managerJobCrisis?.warnedFinances)||
      ((risk.status==='warn_board'||risk.status==='warn_board_final')&&(
        !managerJobCrisis?.warnedBoard||(
          risk.status==='warn_board_final'&&!managerJobCrisis?.warnedBoardStreak
        )
      ))||
      (risk.status==='critical'&&!managerJobCrisis?.warnedCritical)||
      (risk.status==='critical_grace'&&!managerJobCrisis?.warnedGrace)||
      (risk.status==='warn_imminent')||
      (risk.status==='warn_warm')||
      (risk.status==='warn_shield'&&!managerJobCrisis?.warnedShield)
    );
    if(shouldInbox){
      if(risk.status==='warn_finances')managerJobCrisis={...managerJobCrisis,warnedFinances:true};
      if(risk.status==='warn_board'||risk.status==='warn_board_final'){
        managerJobCrisis={
          ...managerJobCrisis,
          warnedBoard:true,
          warnedBoardStreak:risk.status==='warn_board_final'?true:!!managerJobCrisis.warnedBoardStreak,
        };
      }
      if(risk.status==='critical')managerJobCrisis={...managerJobCrisis,warnedCritical:true,warnedBoard:true,warnedFinances:true};
      if(risk.status==='critical_grace')managerJobCrisis={...managerJobCrisis,warnedGrace:true};
      if(risk.status==='warn_shield')managerJobCrisis={...managerJobCrisis,warnedShield:true};
      pushManagerJobInbox(risk);
    }
    if(risk.popupKind)openManagerJobWarnPopup(risk,campaign.shield);
    if(risk.status!=='ok')persistSeason(true);
    return false;
  };
  const acceptManagerJobOffer=offer=>{
    if(!savedNewGame||!offer?.club||!clubs[offer.club])return;
    careerPersistence.setSkipPersistOnUnload();
    const oldClubName=userClub;
    const newClubName=offer.club;
    const newClub=clubs[newClubName];
    const newDivision=newClub.division||'D';
    const userManager=managerRanking.byClub(oldClubName)||managerRanking.byName(careerProfile.managerName);
    managerRanking.sack(oldClubName);
    managerRanking.hireFreeAgentForClub(oldClubName,clubs[oldClubName]?.division||userDivision);
    if(userManager)managerRanking.hire(newClubName,userManager.id);
    const aiOld=managerRanking.byClub(oldClubName);
    if(aiOld&&clubs[oldClubName])clubs[oldClubName].managerName=aiOld.name;
    newClub.managerName=careerProfile.managerName;
    if(clubs[oldClubName])clubs[oldClubName].staffContract=null;
    ensureStaffContract(newClub,{
      division:newDivision,
      season:careerSeason,
      managerId:userManager?.id||null,
      managerName:careerProfile.managerName,
      managerReputation:userManager?.reputation??60,
      preferredDivision:userManager?.preferredDivision||newDivision,
      titlePoints:userManager?.titlePoints||0,
      force:true,
    });
    // Status fresco do novo clube — nunca herda Ambiente/Diretoria/Caixa do anterior.
    const hireSeed=(Number(savedNewGame.seed)||1)^(careerSeason*31)^(newClubName.length*97);
    const hireStatus=buildManagerHireStatus({
      club:newClub,
      division:newDivision,
      seed:hireSeed,
      environmentRanges:initialEnvironmentRanges,
      initialBudget,
    });
    newClub.environment=hireStatus.environment;
    newClub.support=hireStatus.support;
    newClub.board=hireStatus.board;
    newClub.budget=hireStatus.budget;
    newClub.budgetLedger=[];
    newClub.sponsors=null;
    newClub.tvRights=null;
    newClub.seasonCashflow=null;
    newClub.wageShortfall=false;
    clearBankLoan(newClub);
    if(clubs[oldClubName])clearBankLoan(clubs[oldClubName]);
    ensureBudget(newClub,newDivision);
    ensureStadium(newClub,newDivision);
    clubStatus.syncFinancesFromBudget(newClub,newDivision);
    const statusSnapshot={
      environment:newClub.environment,
      support:newClub.support,
      board:newClub.board,
      finances:newClub.finances,
      budget:getBalance(newClub),
    };
    const nextGoal=pickSeasonGoal({
      division:newDivision,
      overall:clubSquadOverall(newClub),
      seed:(savedNewGame.seed||1)^(careerSeason*17),
    });
    const nextObjectives=pickSeasonObjectives({
      division:newDivision,
      seed:(savedNewGame.seed||1)^(careerSeason*31),
      club:newClub,
      inCup:true,
    });
    managerRanking.syncSeasonPointsFromClubs(managerRankingHelpers().getClubSeasonPoints);
    const rankingSnap=managerRanking.snapshot();
    pendingSponsorChoice=true;
    pendingSponsorOffers=null;
    const foundingClubName=savedNewGame.foundingClubName||oldClubName;
    const careerClubHistory=[...new Set([
      ...(Array.isArray(savedNewGame.careerClubHistory)?savedNewGame.careerClubHistory:[]),
      foundingClubName,
      oldClubName,
      newClubName,
    ].filter(Boolean))];
    const nextCareer={
      ...savedNewGame,
      clubName:newClubName,
      managerName:careerProfile.managerName,
      division:newDivision,
      foundingClubName,
      careerClubHistory,
      // Pirâmide completa: sem isso o boot regenera o mundo só com o novo clube.
      divisionTeams:Object.fromEntries(Object.keys(divisionRules).map(division=>[division,[...divisionTeams[division]]])),
      stadiumName:newClub.stadiumName||savedNewGame.stadiumName||null,
      pendingSponsorChoice:true,
      userRoster:assignSquadJerseyNumbers(newClub.roster.map(player=>({
        ...player,
        injuryHistory:pruneInjuryHistory(player.injuryHistory),
      }))),
      worldRosters:collectWorldRosters(clubs,{skipClub:newClubName,merge:savedNewGame?.worldRosters||{}}),
      clubStatus:statusSnapshot,
      managerRanking:rankingSnap,
      seasonGoal:nextGoal?{...nextGoal,evaluate:nextGoal.evaluate?{...nextGoal.evaluate}:null}:null,
      seasonGoalResult:null,
      seasonObjectives:nextObjectives,
      seasonObjectivesResult:null,
      createdAt:new Date().toISOString(),
      version:4,
    };
    persistCareer(nextCareer);
    managerJobCrisis=null;
    writeSeasonSave({
      userClub:newClubName,
      userDivision:newDivision,
      seasonGoal:nextGoal,
      seasonGoalResult:null,
      seasonObjectives:nextObjectives,
      seasonObjectivesResult:null,
      managerJobCrisis:null,
      userClubStatus:statusSnapshot,
      userBudget:statusSnapshot.budget,
      resetUserEconomy:true,
    });
    managerSackUi.close();
    redirectGame();
  };
  const refuseManagerCareer=()=>{
    careerPersistence.setSkipPersistOnUnload();
    markSkipPersistOnce();
    clearCareerStorage({clearTraining:true});
    managerSackUi.close();
    clubBankruptcyUi.close();
    clubInsolvencyWarnUi.close();
    clubFinancialRestrictionUi.close();
    managerJobWarnUi.close();
    markSkipSessionEndOnce();
    location.replace('home.html');
  };
  const managerJobWarnUi=createManagerJobWarnFeature({$});
  const managerSackUi=createManagerSackFeature({
    $,
    onAcceptOffer:acceptManagerJobOffer,
    onRefuseCareer:refuseManagerCareer,
    onViewRoster:clubName=>openScout(clubName),
  });
  const clubBankruptcyUi=createClubBankruptcyFeature({
    $,
    formatBudget,
    onEndCareer:refuseManagerCareer,
  });
  const clubInsolvencyWarnUi=createClubInsolvencyWarnFeature({
    $,
    formatBudget,
  });
  const clubFinancialRestrictionUi=createClubFinancialRestrictionFeature({
    $,
    formatBudget,
  });
  managerJobWarnUi.init();
  managerSackUi.init();
  clubBankruptcyUi.init();
  clubInsolvencyWarnUi.init();
  clubFinancialRestrictionUi.init();
  if(managerJobCrisis?.status==='bankrupt'){
    setTimeout(()=>openClubBankruptcyModal(),0);
  }else if(managerJobCrisis?.status==='sacked'){
    setTimeout(()=>openManagerSackModal(),0);
  }
  const sponsorPickerUi=createSponsorPickerFeature({
    $,
    onClick,
    formatBudget,
    onOffersChanged:nextOffers=>{
      if(!nextOffers?.master?.length)return;
      pendingSponsorOffers={
        division:nextOffers.division||userDivision,
        master:nextOffers.master.map(item=>({...item})),
        secondaries:Array.isArray(nextOffers.secondaries)?nextOffers.secondaries.map(item=>({...item})):[],
        reshufflesUsed:Number(nextOffers.reshufflesUsed)||0,
      };
      persistSeason(true);
    },
    onConfirmSponsors:({master,secondaries})=>{
      const applied=applySponsorChoice(clubs[userClub],{
        master,
        secondaries,
        division:userDivision,
        season:careerSeason,
        installments:userDivision==='D'?22:38,
      });
      if(!applied)return;
      // Fecha pendência antes de esconder o modal — evita ghost-click reabrir o picker.
      pendingSponsorChoice=false;
      pendingSponsorOffers=null;
      if(savedNewGame){
        savedNewGame.pendingSponsorChoice=false;
        persistCareer({...savedNewGame,pendingSponsorChoice:false});
      }
      persistSeason(true);
      sponsorPickerUi.close();
      // Próximo frame: UI de fundo, depois que o clique atual já consumiu.
      requestAnimationFrame(()=>{
        economyUi?.renderSponsors?.();
        economyUi?.renderOffice?.();
        refreshSeasonPresentation();
      });
    },
  });
  sponsorPickerUi.init();
  openSponsorPickerIfPending=()=>{
    if(!pendingSponsorChoice||!clubs[userClub])return;
    // Já aberto: não chamar open() de novo (zera seleção e parece fechar/reabrir).
    if(sponsorPickerUi.isOpen())return;
    if(!pendingSponsorOffers?.master?.length||pendingSponsorOffers.secondaries?.length!==5){
      pendingSponsorOffers=generateSponsorOffers({division:userDivision,random:Math.random});
    }
    sponsorPickerUi.open({season:careerSeason,offers:pendingSponsorOffers});
  };
  if(pendingSponsorChoice&&!careerCrisisBlocks()){
    // Dois ticks: garante modal após o primeiro paint do dashboard.
    setTimeout(()=>openSponsorPickerIfPending(),0);
    setTimeout(()=>{
      if(pendingSponsorChoice&&!sponsorPickerUi.isOpen())openSponsorPickerIfPending();
    },120);
  }
  const seasonSummary=createSeasonSummaryFeature({
    $,
    clubCrestInitials,
    clubSeasonLeaders,
    clubSeasonRatingSummary:clubName=>computeClubSeasonRatingSummary(playerHistory?.getStore?.(),clubName,careerSeason,{getClub:resolveClubForStats}),
    formatMatchRating,
    onStartNextSeason:()=>seasonTransition?.startNextSeason?.(),
    onCloseSeasonSummary:()=>{
      seasonSummary.close();
      refreshSeasonPresentation();
      $$('.nav').find(button=>button.dataset.view==='dashboard')?.click();
    },
  });
  seasonSummary.init();
  const retirementModal = createRetirementModalFeature({ $ });
  openSeasonGoalPreview=()=>seasonSummary.openPreview('missed');
  if(new URLSearchParams(location.search).get('preview')==='season-goal'){
    setTimeout(()=>openSeasonGoalPreview(),0);
  }
  ({
    advanceStateLeagueThroughDate,
    advancePostMatchDay,
    advanceStateLeagueRound,
    advanceSeasonRound,
    advanceCupRound,
    simulateIdleRound,
  }=createRoundAdvanceEngine({
    getSavedNewGame:()=>savedNewGame,
    getStateLeagueEngine:()=>stateLeagueEngine,
    simulateRoundMatch,
    getUserClub:()=>userClub,
    getUserDivision:()=>userDivision,
    getCareerSeason:()=>careerSeason,
    getCareerCalendarDate:()=>careerCalendarDate,
    getCurrentRound:()=>currentRound,
    setCurrentRound:value=>{currentRound=value;},
    getLiveMatchGame:()=>liveMatchGame,
    setLiveMatchGame:value=>{liveMatchGame=value;},
    getRoundCommitted:()=>roundCommitted,
    setRoundCommitted:value=>{roundCommitted=value;},
    getHomeGoals:()=>home,
    getAwayGoals:()=>away,
    getAvailabilityCommitted:()=>availabilityCommitted,
    getSeasonRoundHistory:()=>seasonRoundHistory,
    getNationalCompetitions:()=>nationalCompetitions,
    getChampionshipFixtures:()=>championshipFixtures,
    getWorldCupCompetition:()=>worldCupCompetition,
    refreshWorldCupFixtures,
    rebuildCalendarGames,
    persistPlayerHistory:()=>playerHistory.persist(),
    invalidateUserScheduleCache,
    seasonEndDate,
    applyCalendarTrainingDay,
    trainingTypeForDate,
    advanceCareerCalendarTo,
    advanceCupThroughDate,
    advanceWorldCupThroughDateLocal,
    setSelectedCalendarDate,
    creditUserHomeGate,
    pushUserMatchResultMessage,
    commitLiveAvailability,
    recordGameLeaders,
    resolveMatchAttendance,
    applyClubStatusAfterRound,
    orderAllClubFormations:()=>Object.values(clubs).forEach(club=>orderRosterForFormation(club.roster,club.formation)),
    renderRoster,
    drawBoard:draw,
    recoverPlayers,
    intervalDaysForRoundAdvance,
    trainingRecoveryMultiplier,
    persistSeason,
    persistAfterRoundAdvance,
    notifyUserMatchPlayed,
    refreshSeasonPresentation,
    renderTeamStatsCard,
    closeRoundResultsModal:()=>$('#roundResultsModal').classList.add('hidden'),
    closeMatchModal:()=>modal.classList.add('hidden'),
    stopMatchClock,
    setMatchStarted:value=>{matchStarted=value;},
    setMatchFinished:value=>{matchFinished=value;},
    releaseWorldCupSquadBinding,
    clearLiveDaySnapshots:()=>liveDayMatches.clearSnapshots(),
    setRoundResults:value=>{roundResults=value;},
    setRoundResultMessagePushed:value=>{roundResultMessagePushed=value;},
    setRoundPreviewResults:value=>{roundPreviewResults=value;},
    clearLiveMatchPersist,
    evaluateManagerJobRisk,
    navigateToDashboard:()=>{$$('.nav').find(button=>button.dataset.view==='dashboard')?.click();},
    buildLiveKnockoutStats,
    commitLiveKnockoutResult,
    leagueUserGameForRound,
    userLeaguePlayed,
    isFixtureCompleted,
    simulateRoundResults,
    applyRoundToTable,
    serveDisciplineSuspensionsForRound,
    serveAvailability,
    applyUserWageBillForRound,
    creditLeagueHomeTvForGames,
    simulateNationalRound,
    getLiveSideStats:()=>stats,
    getLiveSideGoals:()=>goals,
    updateSeriesDKnockout,
    finishRemainingNationalRounds:(...args)=>finishRemainingNationalRounds(...args),
    reconcileCurrentRound,
    processAiMarketAfterRound,
    fixtureDate,
    maybeSendNationalTeamOffers,
    finalizeNationalRankingSeason,
    tryPrepareSeasonTransition:()=>tryPrepareSeasonTransition(),
    isUserSeasonIdle,
    simulateNonHumanSeasonRemainder:()=>simulateNonHumanSeasonRemainder(),
    getCupCompetition:()=>cupCompetition,
    getClubs:()=>clubs,
    getCompetitionRoundHistory:()=>competitionRoundHistory,
    serveCompetitionSuspensions:(participants,competitionKey,round)=>serveCompetitionSuspensions(clubs,participants,competitionKey,round),
    advanceCupComputerTies,
    seasonComplete,
  }));
  ({
    advanceCalendarWeek,
    advanceToMatchDay,
  }=createCalendarWeekAdvance({
    getSavedNewGame:()=>savedNewGame,
    isSponsorChoicePending:()=>!!pendingSponsorChoice,
    openSponsorPickerIfPending,
    isUserSeasonIdle,
    seasonFullyComplete,
    ensureCalendarMatchConsistency,
    isOnPendingMatchDay,
    isLiveMatchInProgress:()=>matchStarted&&!matchFinished,
    pushMatchDayBrief,
    userMatchOnDate,
    nextPendingUserEntry,
    refreshSeasonPresentation,
    getTransferWindowPhase:()=>transfersEngine?.getWindowPhase?.()||{},
    ensureTransfersUi,
    advanceTransferCalendar,
    renderCalendar,
    getCareerCalendarDate:()=>careerCalendarDate,
    seasonEndDate,
    beginCalendarBatch,
    endCalendarBatch,
    advanceCareerCalendarTo,
    processContractsForDate,
    advanceCupThroughDate,
    advanceStateLeagueThroughDate,
    advanceWorldCupThroughDateLocal,
    setSelectedCalendarDate,
    applyCalendarTrainingDay,
    trainingTypeForDate,
    flushCupScheduleRefresh,
    flushWeeklyTrainingReport,
    syncCareerRosters,
    renderRoster,
    maybeSendNationalTeamOffers,
    persistSeason,
    rebuildCalendarGames,
    sameCalendarDay,
    isFixtureCompleted,
    isTransferMarketOpen:()=>!!transfersEngine?.marketOpen?.(),
    processAiMarketTickCore,
    setSuppressTransferOfferPopup:value=>{suppressTransferOfferPopup=value;},
    getPendingTransferOfferPopupIds:()=>pendingTransferOfferPopupIds,
    renderTransfersUi:()=>transfersUi?.render?.(),
    presentTransferOffersAfterAdvance,
  }));
  advanceCalendarWeekFn=advanceCalendarWeek;
  let pendingSerieDFormation=null;
  seasonTransition=createSeasonTransitionEngine({
    initialPendingDivisionTeams,
    initialPendingUserDivision,
    initialSeasonTransitionPrepared,
    rnd,
    getUserClub:()=>userClub,
    getUserDivision:()=>userDivision,
    getCareerSeason:()=>careerSeason,
    getCurrentRound:()=>currentRound,
    getClubs:()=>clubs,
    getDivisionTeams:()=>divisionTeams,
    getNationalCompetitions:()=>nationalCompetitions,
    getCompetitionRoundHistory:()=>competitionRoundHistory,
    getSerieDGroups:()=>serieDGroups,
    getDKnockout:()=>dKnockout,
    getCupCompetition:()=>cupCompetition,
    setPriorSeasonChampions:payload=>{
      if(!savedNewGame)return;
      savedNewGame.priorSeasonChampions=payload;
      persistCareer(savedNewGame);
    },
    getGeneratedClubPool:()=>generatedClubPool,
    simulateRoundMatch,
    recordGameLeaders,
    applySecondaryResult,
    creditLeagueHomeTvForGames,
    compactMatchResult,
    persistPlayerHistory:()=>playerHistory.persist(),
    seasonComplete,
    hasPendingUserFixtures,
    advanceCupThroughDate,
    refreshCopaDoBrasilFixtures,
    rebuildCalendarGames,
    returnExpiredLoans:()=>transfersEngine?.returnExpiredLoans?.()||0,
    assignSquadJerseyNumbers,
    syncUserSquadFromClub:()=>{if(clubs[userClub])squad.splice(0,squad.length,...clubs[userClub].roster);},
    syncCareerRosters,
    clearSeasonDeals:()=>transfersEngine?.clearSeasonDeals?.(),
    serieDPromotedClubs,
    displayedClubPosition,
    resolveSerieDPrizePhase,
    resolveCupPrizePhase,
    computeSeasonPrize,
    ensureBudget,
    getBalance,
    runSeasonEndDevelopmentPulse,
    credit,
    syncFinancesFromBudget:(club,division)=>clubStatus.syncFinancesFromBudget(club,division),
    renderEnvironmentCard,
    ensureSeasonGoal,
    getSeasonGoal:()=>seasonGoal,
    getSeasonGoalResult:()=>seasonGoalResult,
    setSeasonGoalResult:value=>{seasonGoalResult=value;},
    evaluateSeasonGoal,
    ensureSeasonObjectives,
    getSeasonObjectivesResult:()=>seasonObjectivesResult,
    setSeasonObjectivesResult:value=>{seasonObjectivesResult=value;},
    evaluateSeasonObjectives,
    buildSeasonObjectiveEvalContext,
    pushMessage,
    pushSeasonEndBrief,
    leadersFor,
    championshipLeadersFor,
    archiveSeasonBalance:payload=>playerHistory.archiveSeasonBalance(payload),
    persistSeason,
    renderClubBudget,
    openSeasonSummary:payload=>{
      closeDeferredCareerPopups();
      seasonSummary.open(payload);
    },
    evaluateManagerJobRisk,
    careerCrisisBlocks,
    openCareerCrisisModal,
    isSponsorChoicePending:()=>!!pendingSponsorChoice,
    openSponsorPickerIfPending,
    isUserSeasonIdle,
    openIdleSimOverlay:()=>{
      closeDeferredCareerPopups();
      seasonSummary.openIdleSim();
    },
    setIdleSimStatus:status=>seasonSummary.setIdleSimStatus(status),
    navigateDashboard:()=>{$$('.nav').find(button=>button.dataset.view==='dashboard')?.click();},
    seasonMaxRound,
    finalizeNationalRankingSeason,
    refreshSeasonPresentation,
    closeIdleSimOverlay:()=>seasonSummary.closeIdleSim(),
    simulateIdleRound,
    getSavedNewGame:()=>savedNewGame,
    setSkipPersistOnUnload:()=>careerPersistence.setSkipPersistOnUnload(),
    getRecopaChampion:()=>{
      if(!isRecopaNationalEnabled())return null;
      if(!recopaCompetition?.champion)return null;
      if(!recopaCompetition.complete&&!recopaCompetition.skippedSameClub)return null;
      return recopaCompetition.champion;
    },
    getRecopaSubtitle:()=>{
      if(!isRecopaNationalEnabled()||!recopaCompetition?.champion)return null;
      if(recopaCompetition.skippedSameClub)return 'Título unificado (Brasileirão + Copa)';
      return 'Campeão da Recopa Nacional';
    },
    getStateLeagueChampions:()=>{
      if(!FEATURES.stateLeague)return [];
      const out=[];
      Object.entries(stateLeagueEngine.competitions||{}).forEach(([uf,divisions])=>{
        (divisions||[]).forEach(division=>{
          if(division?.complete&&division.champion){
            out.push({
              key:`EST:${uf}:${division.tier||1}`,
              uf,
              label:division.label||uf,
              clubName:division.champion,
            });
          }
        });
      });
      return out.sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
    },
    getContinentalChampions:()=>({}),
    pruneClubMemory,
    getNationalRankingEntries:()=>nationalRankingEntries,
    getStateRnfQualifiers:season=>stateLeagueEngine.getRnfQualifiers(season),
    getStateLeagueGuaranteedSnapshot:()=>extractGuaranteedTier4ByUf(stateLeagueEngine.competitions),
    getStateLeagueMembershipSnapshot:()=>{
      const participantsByUf={};
      BRAZILIAN_UFS.forEach(item=>{
        participantsByUf[item.code]=collectParticipantsForUf(item.code,{
          clubs,
          regionalBaseClubs:savedNewGame?.regionalBaseClubs||[],
          importClubs:officialBrazilWorld?.importClubs||[],
          userClub,
          userUf:savedNewGame?.userUf||getRealClub(userClub)?.uf||'SP',
        });
      });
      return buildMembershipSnapshot(stateLeagueEngine.competitions,participantsByUf,{
        lotteryPick:createLotteryPicker({
          lotterySeed:savedNewGame?.seed??null,
          userUf:savedNewGame?.userUf||getRealClub(userClub)?.uf||'SP',
          userClub,
        }),
        userClub,
      });
    },
    setPendingSerieDFormation:payload=>{pendingSerieDFormation=payload;},
    advancePlayerAges,
    processSeasonRetirements,
    openRetirementModal:payload=>retirementModal.open(payload),
    getPlayerDevelopmentState:()=>playerDevelopment,
    getCareerCalendarDate:()=>careerCalendarDate,
    getSeasonMinutes:player=>Number(getDevelopmentSeasonBucket(player)?.minutes)||0,
    markRetiredInHistory:(player,meta)=>{
      if(!playerHistory)return;
      markRetiredInHistoryStore(playerHistory.getStore(),meta.historyKey,{
        ...meta,
        name:player.name,
        retiredAge:Number(player.age)||0,
      });
      try{playerHistory.persist();}catch{/* quota */}
    },
    syncRostersAfterRetirement:()=>{
      if(clubs[userClub]){
        assignSquadJerseyNumbers(clubs[userClub].roster);
        squad.splice(0,squad.length,...clubs[userClub].roster);
      }
      syncCareerRosters();
      try{renderRoster();}catch{/* boot */}
      if(savedNewGame){
        savedNewGame.retiredPool=savedNewGame.retiredPool||[];
        try{persistCareer({...savedNewGame});}catch{/* quota */}
      }
      try{persistSeason(true);}catch{/* quota */}
    },
    runYouthSeasonTransition:(clubsList,ctx)=>import('../engine/youth-academy.js').then(({runYouthSeasonTransition})=>runYouthSeasonTransition(clubsList,{
      ...ctx,
      userClub,
      division:userDivision,
      careerDate:careerCalendarDate,
      season:(savedNewGame?.season||2026)+1,
      random:rnd,
      firstNames,
      lastNames,
      userUf:savedNewGame?.userUf||getRealClub(userClub)?.uf||'SP',
      retiredPool:savedNewGame?.retiredPool||ctx.retiredPool||[],
    })),
    resetPlayerDevelopment:year=>{playerDevelopment=emptyDevelopmentState(year);},
    pruneInjuryHistory,
    collectWorldRosters,
    snapshotUserClubStatus:()=>clubStatus.snapshotUserStatus(),
    initialBudget,
    serializeBankLoan,
    serializeUserStadium,
    serializeUserClubInvestments,
    getNationalRankingFormulaVersion:()=>NATIONAL_RANKING_FORMULA_VERSION,
    getNationalRankingFinalizedSeasons:()=>nationalRankingFinalizedSeasons,
    pruneRankingTitles,
    syncManagerSeasonPoints:()=>managerRanking.syncSeasonPointsFromClubs(managerRankingHelpers().getClubSeasonPoints),
    snapshotManagerRanking:()=>managerRanking.snapshot(),
    writeCareerSave:save=>persistCareer(save),
    pushYouthReportsMessage:summary=>{
      if(!summary?.reports)return;
      pushMessage({
        category:'club',
        type:'info',
        title:'Olheiros · relatório',
        body:`${summary.reports} jovem(ns) indicado(s) para a base. Abra Categoria de Base → Olheiros.`,
      });
    },
    finalizePlayerHistorySeason:(season,opts)=>playerHistory.finalizeSeason(season,opts),
    clearSeasonSave,
    closeSeasonSummary:()=>seasonSummary.close(),
    redirectGame,
    applyClubStatusDeltas:(club,deltas)=>clubStatus.applyDeltas(club,deltas),
    formatBudget,
  });
  tryPrepareSeasonTransition=()=>seasonTransition.tryPrepareSeasonTransition();
  prepareSeasonTransition=()=>seasonTransition.prepareSeasonTransition();
  finishRemainingNationalRounds=(...args)=>seasonTransition.finishRemainingNationalRounds(...args);
  simulateNonHumanSeasonRemainder=()=>seasonTransition.simulateNonHumanSeasonRemainder();
  const matchLiveAwaySubs=createAwaySubController({
    getMatchClub:()=>matchClub(),
    playerUnavailable,
    getLiveInjuries:()=>liveInjuries,
    getLiveDeferredInjuries:()=>liveDeferredInjuries,
    getCards:()=>cards,
    getLiveMinutesPlayed:()=>liveMinutesPlayed,
    getAwaySubstitutions:()=>awaySubstitutions,
    incrementAwaySubstitutions:()=>{awaySubstitutions++;},
    getAwaySubWindows:()=>awaySubWindows,
    incrementAwaySubWindows:()=>{awaySubWindows++;},
    getMatchStarted:()=>matchStarted,
    getPreMatchPreparation:()=>preMatchPreparation,
    getMatchFinished:()=>matchFinished,
    getMinute:()=>minute,
    getHomeGoals:()=>home,
    getAwayGoals:()=>away,
    engineTuning,
    FATIGUE_SUB_THRESHOLD,
    substitutionPriority:(...args)=>substitutionPriority(...args),
    compatibleRoles,
    clamp,
    log,
    renderRoster,
    drawBoard,
    renderStats,
    renderLiveOpponent,
    pushLiveVolumeIncident,
  });
  const {awayBenchPlayers,replaceAwayPlayer,maxAwaySubWindows,buildLiveAwaySubState,makeAwayFatigueSubstitution}=matchLiveAwaySubs;
  const matchLiveOrchestration=createLiveMatchOrchestration({
    $,
    clamp,
    rnd,
    log,
    getMinute:()=>minute,
    setMinute:v=>{minute=v;},
    getHalftimeShown:()=>halftimeShown,
    setHalftimeShown:v=>{halftimeShown=v;},
    getMatchFinished:()=>matchFinished,
    setMatchFinished:v=>{matchFinished=v;},
    getMatchStarted:()=>matchStarted,
    getStats:()=>stats,
    getCards:()=>cards,
    getShootoutState:()=>shootoutState,
    setShootoutState:v=>{shootoutState=v;},
    getPendingPenalty:()=>pendingPenalty,
    setPendingPenalty:v=>{pendingPenalty=v;},
    getDisciplineEvents:()=>disciplineEvents,
    setDisciplineEvents:v=>{disciplineEvents=v;},
    getMatchDiscipline:()=>matchDiscipline,
    getLiveInjuries:()=>liveInjuries,
    getLiveDeferredInjuries:()=>liveDeferredInjuries,
    getLiveMinutesPlayed:()=>liveMinutesPlayed,
    getPostMatchMedicalQueue:()=>postMatchMedicalQueue,
    pushLiveVolumeIncident,
    getUserClub:()=>userClub,
    getClubs:()=>clubs,
    getMatchClub:()=>matchClub(),
    getLiveMatchGame:()=>liveMatchGame,
    getNextUserGame:()=>nextUserGame,
    getStarters:()=>starters(),
    getActiveStarters:()=>activeStarters(),
    getCurrentRound:()=>currentRound,
    userAtHomeInLiveMatch,
    profile,
    opponentForMatch,
    liveOverall,
    cautionPenalty,
    tacticFor:(...args)=>tacticFor(...args),
    playerFor,
    actorData,
    tacticalDiscipline,
    totalCards,
    influencePossession,
    engineTuning,
    compatibleRoles,
    playerUnavailable,
    injuryInAcutePhase,
    playerRehabMaxMinutes,
    resolvePhysicalIncident,
    assignPlayerInjury,
    buildDeferredInjuryEntry,
    calculatePlayThroughSubChance,
    injurySeverityLabel,
    pickInjuryVictim,
    directRedDismissalType,
    directRedSuspensionGames,
    applyMinuteWearToLineup,
    clubInstitutionalContext,
    stopMatchClock,
    startMatchClock:(...args)=>startMatchClock(...args),
    openPreparation,
    renderRoster,
    drawBoard,
    renderSubstitutionControls,
    renderStats,
    renderLiveOpponent,
    makeAwayFatigueSubstitution,
    simulateRoundResults,
    renderFinalSummary,
    showFinalActions,
    cupLiveMatchNeedsShootout:(...args)=>cupLiveMatchNeedsShootout(...args),
    optionsUi,
    knockoutCompetitionLabel,
    getKnockoutTieGames,
    matchLiveAudio,
    shot:(...args)=>shot(...args),
    planPenaltyOutcome:(...args)=>planPenaltyOutcome?.(...args),
    takeFreeKick:(...args)=>takeFreeKick(...args),
    penaltyTaker:(...args)=>penaltyTaker(...args),
    buildAttack:(...args)=>buildAttack(...args),
    addPasses:(...args)=>addPasses(...args),
    timeline,
    resetLiveClockSeconds:(...args)=>matchLiveUi.resetLiveClockSeconds(...args),
    updateLiveMatchClock,
    getAwaySubstitutions:()=>awaySubstitutions,
    incrementAwaySubstitutions:()=>{awaySubstitutions++;},
    getSubstitutions:()=>substitutions,
    getStoppageFirst:()=>stoppageFirst,
    setStoppageFirst:v=>{stoppageFirst=Number(v)||0;},
    getStoppageSecond:()=>stoppageSecond,
    setStoppageSecond:v=>{stoppageSecond=Number(v)||0;},
    getStoppageElapsed:()=>stoppageElapsed,
    setStoppageElapsed:v=>{stoppageElapsed=Number(v)||0;},
    getStoppageActive:()=>stoppageActive,
    setStoppageActive:v=>{stoppageActive=v||null;},
    getHomeScore:()=>home,
    getAwayScore:()=>away,
    getStoppageHalfSnap:()=>stoppageHalfSnap,
    setStoppageHalfSnap:v=>{stoppageHalfSnap=v&&typeof v==='object'?{fouls:Number(v.fouls)||0,yellow:Number(v.yellow)||0,red:Number(v.red)||0,subs:Number(v.subs)||0,goals:Number(v.goals)||0}:null;},
    getLeaguePhaseRounds:game=>{
      if(isKnockoutShootoutCompetition(game))return 0;
      const division=clubs[game?.home]?.division||clubs[game?.away]?.division||userDivision;
      if(division==='D')return SERIE_D_GROUP_ROUNDS;
      return Math.max(2,nationalCompetitions[division]?.fixtures?.length||championshipFixtures.length||38);
    },
  });
  const {
    tryLiveEventInjury,escalateLivePlayThroughInjury,handleLivePlayThroughIncident,checkMinuteAggravation,enforceLiveRehabLimit,
    applyWear,tick,foul,advance,
    shootoutGoalsCount,shootoutAttemptsCount,currentShootoutClub,shootoutLineup,shootoutCardsFor,renderShootoutTrack,logShootout,
    evaluateShootoutWinner,pickShootoutCpuTaker,executeShootoutKick,startShootoutTakerChoice,startShootoutCpuKick,scheduleNextShootoutKick,
    resumeShootoutFlow,reconcileShootoutState,
    completePenaltyShootout,startPenaltyShootout,startPenaltyChoice,startPenaltyAgainst,
    openPenaltyDuel,closePenaltyDuel,isPenaltyDuelOpen,runPenaltyDuelResolve,
  }=matchLiveOrchestration;
  reopenMatchWindow=()=>{
    const opened=reopenMatchWindowBase();
    if(opened&&shootoutState&&!matchFinished)resumeShootoutFlow();
    return opened;
  };
  ({ addPasses, shot, takeFreeKick, penaltyTaker, buildAttack, planPenaltyOutcome } = createLiveMatchActions({
    clamp,
    rnd,
    random: Math.random,
    getStats: () => stats,
    getMinute: () => minute,
    getStoppageElapsed: () => stoppageElapsed,
    getStoppageActive: () => stoppageActive,
    getGoals: () => goals,
    getUserClub: () => userClub,
    getMatchClub: () => matchClub(),
    getLiveMatchGame: () => liveMatchGame,
    getStarters: () => starters(),
    getCards: () => cards,
    incrementScore: side => { if (side === 'home') home++; else away++; },
    updateScoreboard: () => score(),
    log,
    playerFor,
    actorData,
    influencePossession,
    engineTuning,
    engineBlowoutDamp,
    engineScoreDamp,
    engineFoulRisk,
    engineProgressiveFoulRisk,
    tacticFor,
    tryLiveEventInjury,
    foul,
    pickInjuryVictim,
    pushLiveVolumeIncident,
    matchLiveAudio,
  }));
  const cupLiveMatchNeedsShootout=()=>liveKnockoutNeedsShootout();
  /** Empate no AGREGADO (ida+volta) — não exige empate no placar da volta. */
  const liveKnockoutNeedsShootout=()=>{
    if(!liveMatchGame||!isKnockoutShootoutCompetition(liveMatchGame))return false;
    if(liveMatchGame.shootoutWinner||shootoutState)return false;
    const games=getKnockoutTieGames(liveMatchGame);
    if(!games.length)return false;
    const liveStats=buildLiveKnockoutStats();
    return projectedKnockoutNeedsShootout(games,liveMatchGame,liveStats);
  };
  const collectLiveMatchPersistState=()=>({
    seed:savedNewGame?.seed,
    liveMatchGame,
    minute,home,away,pauses,halftimeShown,secondHalfStarted,matchStarted,matchFinished,preMatchPreparation,
    activePreparationTitle,substitutions,awaySubstitutions,awaySubWindows,substitutedOut,
    disciplineEvents,availabilityCommitted,roundResultMessagePushed,stats,cards,goals,matchFactors,
    liveInjuries,liveDeferredInjuries,liveOpeningLineup,liveMinutesPlayed,matchDiscipline,
    liveVolumeSamples,liveVolumePrev,liveVolumePulse,liveVolumeIncidents,postMatchMedicalQueue,
    shootoutState,pendingPenalty,preMatchTacticSnapshot,
    stoppageFirst,stoppageSecond,stoppageElapsed,stoppageActive,stoppageHalfSnap,
    userFormation:formation,
    userLineupOrder:activeUserSquad.map(player=>player.name),
    awayFormation:matchClub()?.formation,
    awayLineupOrder:matchClub()?.roster?.map(player=>player.name)||[],
    liveClockSeconds:matchLiveUi.getLiveClockSeconds?.()||0,
    timelineHtml:timeline?.innerHTML||'',
    matchStatusText:$('#matchStatus')?.textContent||'',
    ui:{
      pauseOpen:!!$('#pausePanel')&&!$('#pausePanel').classList.contains('hidden'),
      statsOpen:!!$('#stats')&&!$('#stats').classList.contains('hidden'),
      penaltyOpen:typeof isPenaltyDuelOpen==='function'?isPenaltyDuelOpen():!!$('#penaltyChoice')&&!$('#penaltyChoice').classList.contains('hidden'),
      shootoutOpen:!!$('#shootoutPanel')&&!$('#shootoutPanel').classList.contains('hidden'),
    },
  });
  const liveMatchPersist=createLiveMatchPersistController({
    getState:collectLiveMatchPersistState,
    onFlush:snap=>{latestLiveMatchSnapshot=snap;},
  });
  scheduleLiveMatchPersist=()=>liveMatchPersist.schedule();
  flushLiveMatchPersist=()=>liveMatchPersist.flush();
  careerPersistence.bindFlushLiveMatchPersist(()=>liveMatchPersist.flush());
  clearLiveMatchPersist=()=>{
    liveMatchPersist.clear();
    latestLiveMatchSnapshot=null;
  };
  const applyNamedLineupOrder=(roster,names)=>{
    if(!roster||!Array.isArray(names)||!names.length)return;
    const byName=new Map(roster.map(player=>[player.name,player]));
    const next=[];
    names.forEach(name=>{
      const player=byName.get(name);
      if(player){next.push(player);byName.delete(name);}
    });
    byName.forEach(player=>next.push(player));
    roster.splice(0,roster.length,...next);
  };
  const findFixtureForLiveSnapshot=ref=>{
    if(!ref)return null;
    const wanted=fixtureIdFromGame(ref);
    const fromSchedule=userSchedule().find(entry=>fixtureIdFromGame(entry.game)===wanted)?.game;
    if(fromSchedule)return fromSchedule;
    for(const stage of cupCompetition.stages||[]){
      const hit=(stage.fixtures||[]).find(game=>fixtureIdFromGame(game)===wanted);
      if(hit)return hit;
    }
    for(const roundGames of championshipFixtures||[]){
      const hit=(roundGames||[]).find(game=>fixtureIdFromGame(game)===wanted);
      if(hit)return hit;
    }
    return null;
  };
  const resolvePersistedLiveSnapshot=()=>{
    if(!savedNewGame?.seed)return null;
    const discardWorldCupSnap=snap=>{
      if(!snap?.fixture)return snap;
      if(snap.fixture.competition===WORLD_CUP_COMPETITION&&!isWorldCupSeasonActive(careerSeason)){
        clearLiveMatchSave();
        return null;
      }
      return snap;
    };
    const fromKey=loadLiveMatchSave();
    if(isValidLiveMatchSnapshot(fromKey,savedNewGame.seed)){
      const hydrated=hydrateLiveMatchSnapshot(fromKey);
      const kept=discardWorldCupSnap(hydrated);
      if(kept)return kept;
    }
    const fromSeason=validSavedSeason?savedSeason.liveMatchSnapshot:null;
    if(isValidLiveMatchSnapshot(fromSeason,savedNewGame.seed)){
      const hydrated=hydrateLiveMatchSnapshot(fromSeason);
      const kept=discardWorldCupSnap(hydrated);
      if(kept)return kept;
    }
    return null;
  };
  const forceCompleteLockedLiveMatch=lock=>{
    if(!lock?.home||!lock?.away)return false;
    const ref={home:lock.home,away:lock.away,competition:lock.competition,round:lock.round,tieId:lock.tieId,leg:lock.leg,date:lock.date,gameNumber:lock.gameNumber};
    const game=findFixtureForLiveSnapshot(ref)||ref;
    if(isFixtureCompleted(game)){
      clearLiveMatchPersist();
      persistSeason(true);
      return false;
    }
    const result=simulateRoundMatch(game.home,game.away,game);
    liveMatchGame=game;
    const userAtHome=game.home===userClub;
    home=userAtHome?result.homeGoals:result.awayGoals;
    away=userAtHome?result.awayGoals:result.homeGoals;
    goals=result.goals?{home:[...(result.goals.home||[])],away:[...(result.goals.away||[])]}:{home:[],away:[]};
    stats=result.data?{
      home:{...blank(),possession:result.data.homePossession??50,passes:result.data.homePasses||0,accurate:result.data.homeAccurate||0,shots:result.data.homeShots||0,on:result.data.homeOnTarget||0,off:result.data.homeOff||0,saved:result.data.homeSaved||0,penalties:result.data.homePenalties||0,offsides:result.data.homeOffsides||0,keeperSaves:result.data.homeKeeperSaves||0,tackles:result.data.homeTackles||0,fouls:result.data.homeFouls||0,yellow:result.data.homeYellow||0,red:result.data.homeRed||0},
      away:{...blank(),possession:result.data.awayPossession??50,passes:result.data.awayPasses||0,accurate:result.data.awayAccurate||0,shots:result.data.awayShots||0,on:result.data.awayOnTarget||0,off:result.data.awayOff||0,saved:result.data.awaySaved||0,penalties:result.data.awayPenalties||0,offsides:result.data.awayOffsides||0,keeperSaves:result.data.awayKeeperSaves||0,tackles:result.data.awayTackles||0,fouls:result.data.awayFouls||0,yellow:result.data.awayYellow||0,red:result.data.awayRed||0},
    }:{home:blank(),away:blank()};
    minute=90;matchStarted=true;matchFinished=true;preMatchPreparation=false;halftimeShown=true;
    cards={home:starters().map(()=>({yellow:0,red:false,dismissal:null,injured:false,playThroughRisk:false})),away:matchClub().roster.slice(0,11).map(()=>({yellow:0,red:false,dismissal:null,injured:false,playThroughRisk:false}))};
    timeline.innerHTML=`<p class="tl-event">Partida interrompida foi concluída automaticamente (anti recomeço).</p>`;
    $('#matchStatus').textContent='Partida concluída automaticamente após interrupção.';
    renderLiveMatchHeader(liveMatchGame);
    modal.classList.remove('hidden');
    score();
    renderFinalSummary();
    showFinalActions({openRatings:true});
    clearLiveMatchSave();
    latestLiveMatchSnapshot=null;
    persistSeason(true);
    return true;
  };
  const restoreLiveMatchFromSnapshot=(raw,{openModal=true}={})=>{
    if(!isValidLiveMatchSnapshot(raw,savedNewGame?.seed))return false;
    const snap=hydrateLiveMatchSnapshot(raw);
    const linked=findFixtureForLiveSnapshot(snap.fixture);
    const game=linked||{...snap.fixture};
    if(linked){
      if(snap.fixture.penalties!=null)linked.penalties=snap.fixture.penalties;
      if(snap.fixture.shootoutWinner!=null)linked.shootoutWinner=snap.fixture.shootoutWinner;
      if(snap.fixture.shootoutPenalties!=null)linked.shootoutPenalties=snap.fixture.shootoutPenalties;
      if(snap.fixture.homeGoals!=null)linked.homeGoals=snap.fixture.homeGoals;
      if(snap.fixture.awayGoals!=null)linked.awayGoals=snap.fixture.awayGoals;
      if(snap.fixture.completed)linked.completed=true;
    }
    if(isFixtureCompleted(game)&&!snap.matchFinished){
      clearLiveMatchPersist();
      return false;
    }
    liveMatchGame=game;
    if(!bindSquadForUserFixtureSync(game))return false;
    if(snap.userFormation&&formations[snap.userFormation]){
      formation=snap.userFormation;
      if(!isWorldCupUserFixture(game,userNationalTeamName))clubs[userClub].formation=formation;
    }
    applyNamedLineupOrder(activeUserSquad,snap.userLineupOrder);
    if(!isWorldCupUserFixture(game,userNationalTeamName))clubs[userClub].roster=squad;
    positionAssignments=[...(formationRoles[formation]||formationRoles['4-3-3'])];
    const awayClub=matchClub();
    if(snap.awayFormation&&formations[snap.awayFormation])awayClub.formation=snap.awayFormation;
    applyNamedLineupOrder(awayClub.roster,snap.awayLineupOrder);
    minute=Number(snap.minute)||0;
    home=Number(snap.home)||0;
    away=Number(snap.away)||0;
    pauses=Number(snap.pauses)||0;
    halftimeShown=!!snap.halftimeShown;
    secondHalfStarted=!!snap.secondHalfStarted||(
      !!snap.halftimeShown&&
      Number(snap.minute)>=45&&
      !snap.preMatchPreparation&&
      snap.activePreparationTitle!=='INTERVALO'&&
      !snap.ui?.pauseOpen
    );
    stoppageFirst=Number(snap.stoppageFirst)||0;
    stoppageSecond=Number(snap.stoppageSecond)||0;
    stoppageElapsed=Number(snap.stoppageElapsed)||0;
    stoppageActive=snap.stoppageActive||null;
    stoppageHalfSnap=snap.stoppageHalfSnap&&typeof snap.stoppageHalfSnap==='object'?{fouls:Number(snap.stoppageHalfSnap.fouls)||0,yellow:Number(snap.stoppageHalfSnap.yellow)||0,red:Number(snap.stoppageHalfSnap.red)||0,subs:Number(snap.stoppageHalfSnap.subs)||0,goals:Number(snap.stoppageHalfSnap.goals)||0}:null;
    matchStarted=true;
    matchFinished=!!snap.matchFinished;
    preMatchPreparation=!!snap.preMatchPreparation;
    activePreparationTitle=snap.activePreparationTitle||'';
    substitutions=Number(snap.substitutions)||0;
    awaySubstitutions=Number(snap.awaySubstitutions)||0;
    awaySubWindows=Number(snap.awaySubWindows)||0;
    substitutedOut=snap.substitutedOut instanceof Set?snap.substitutedOut:new Set(snap.substitutedOut||[]);
    disciplineEvents=Number(snap.disciplineEvents)||0;
    availabilityCommitted=!!snap.availabilityCommitted;
    roundResultMessagePushed=!!snap.roundResultMessagePushed;
    stats=snap.stats||{home:blank(),away:blank()};
    cards=snap.cards||{home:starters().map(()=>({yellow:0,red:false})),away:awayClub.roster.slice(0,11).map(()=>({yellow:0,red:false}))};
    goals=snap.goals||{home:[],away:[]};
    matchFactors=snap.matchFactors||null;
    liveInjuries=snap.liveInjuries||{home:[],away:[]};
    liveDeferredInjuries=snap.liveDeferredInjuries||{home:[],away:[]};
    liveOpeningLineup=snap.liveOpeningLineup||{home:[],away:[]};
    liveMinutesPlayed=snap.liveMinutesPlayed||{home:new Map(),away:new Map()};
    matchDiscipline=snap.matchDiscipline||{home:new Map(),away:new Map()};
    liveVolumeSamples=snap.liveVolumeSamples||[];
    liveVolumePrev=snap.liveVolumePrev||null;
    liveVolumePulse=snap.liveVolumePulse||{home:0.1,away:0.1};
    liveVolumeIncidents=snap.liveVolumeIncidents||[];
    postMatchMedicalQueue=Array.isArray(snap.postMatchMedicalQueue)?snap.postMatchMedicalQueue:[];
    shootoutState=snap.shootoutState||null;
    pendingPenalty=snap.pendingPenalty||null;
    preMatchTacticSnapshot=snap.preMatchTacticSnapshot||null;
    roundResults=null;
    liveDayMatches.clearSnapshots();
    matchLiveUi.setLiveClockSeconds?.(Number(snap.liveClockSeconds)||0);
    if(preMatchPreparation){
      timeline.innerHTML='';
      timeline.classList.add('hidden');
      $('#liveVolume')?.classList.add('hidden');
    }else{
      const html=snap.timelineHtml||`<p>${minute}' · Partida retomada após recarregar a página.</p>`;
      timeline.innerHTML=/PRÉ-JOGO\s*·\s*Aguardando/.test(html)?'':html;
      timeline.classList.toggle('hidden',!timeline.innerHTML.trim());
    }
    $('#matchStatus').textContent=snap.matchStatusText||(matchFinished?'Partida encerrada.':preMatchPreparation?'Organize sua equipe antes de iniciar a partida.':'A partida está em andamento…');
    $('#matchActions').innerHTML='<button id="pauseMatch">Ⅱ PAUSA TÉCNICA <small id="pauseCounter">0/3</small></button><button id="liveStats">ESTATÍSTICAS AO VIVO</button><button id="liveOpponent">VER ADVERSÁRIO</button>';
    bindLiveActions();
    $('#pauseCounter').textContent=`${pauses}/3`;
    if(typeof closePenaltyDuel==='function')closePenaltyDuel();
    else $('#penaltyChoice')?.classList.add('hidden');
    $('#shootoutPanel').classList.add('hidden');
    $('#liveOpponentModal').classList.add('hidden');
    $('#pausePanel').classList.add('hidden');
    $('#stats').classList.add('hidden');
    renderLiveMatchHeader(liveMatchGame);
    score();
    updateLiveMatchClock();
    renderRoster();
    drawBoard();
    latestLiveMatchSnapshot=buildLiveMatchSnapshot(collectLiveMatchPersistState());
    saveLiveMatchSave(latestLiveMatchSnapshot);
    if(!openModal)return true;
    if(matchFinished){
      stopMatchClock();
      modal.classList.remove('hidden');
      // Save antigo / bug: empate no agregado sem disputa → reabre pênaltis
      if(!shootoutState&&!liveMatchGame?.shootoutWinner&&liveKnockoutNeedsShootout()){
        matchFinished=false;
        startPenaltyShootout();
        return true;
      }
      if(shootoutState){renderShootoutTrack();$('#shootoutPanel').classList.remove('hidden');}
      else if(liveMatchGame?.penalties){$('#shootoutTitle').textContent=`Shootout ${liveMatchGame.penalties}`;$('#shootoutPanel').classList.remove('hidden');}
      renderFinalSummary({processMedical:false});
      showFinalActions({reopen:true});
      return true;
    }
    modal.classList.remove('hidden');
    if(pendingPenalty?.mode==='against'&&pendingPenalty?.current&&pendingPenalty?.other){
      startPenaltyAgainst(pendingPenalty.current,pendingPenalty.other);
      return true;
    }
    if(pendingPenalty?.current&&pendingPenalty?.other){
      startPenaltyChoice(pendingPenalty.current,pendingPenalty.other);
      return true;
    }
    if(shootoutState&&!matchFinished){
      stopMatchClock();
      $('#matchActions').classList.add('hidden');
      $('#shootoutPanel').classList.remove('hidden');
      resumeShootoutFlow();
      return true;
    }
    if(preMatchPreparation||snap.ui?.pauseOpen||activePreparationTitle){
      openPreparation(activePreparationTitle||(preMatchPreparation?'PRÉ-JOGO':'PAUSA TÉCNICA'));
      return true;
    }
    $('#matchActions').classList.remove('hidden');
    startMatchClock();
    matchLiveAudio.startStadiumAmbient?.();
    scheduleLiveMatchPersist();
    return true;
  };
  const tryRestoreLiveMatch=({openModal=true}={})=>{
    if(matchStarted&&liveMatchGame)return reopenMatchWindow();
    const snap=resolvePersistedLiveSnapshot();
    if(snap)return restoreLiveMatchFromSnapshot(snap,{openModal});
    const lock=validSavedSeason?.activeLiveMatch;
    if(lock&&savedNewGame?.seed&&(!validSavedSeason.seed||validSavedSeason.seed===savedNewGame.seed)){
      return forceCompleteLockedLiveMatch(lock);
    }
    return false;
  };
  onClick('#playMatch',async()=>{
    if(pendingSponsorChoice){
      openSponsorPickerIfPending();
      return;
    }
    refreshUserFixtures();
    if(isUserSeasonIdle()){
      renderUserMatchPresentation();
      simulateNonHumanSeasonRemainder();
      return;
    }
    if(seasonFullyComplete()||(seasonComplete()&&!nextPendingUserEntry())){
      renderUserMatchPresentation();
      if(!tryPrepareSeasonTransition()){
        // Sem jogos do clube: abre o balanço mesmo se a Copa CPU já tiver sido resolvida no save.
        if(!hasPendingUserFixtures())prepareSeasonTransition();
      }
      return;
    }
    // Partida persistida (refresh) tem prioridade sobre o fluxo de calendário.
    if(tryRestoreLiveMatch()) return;
    if(reopenMatchWindow()) return;
    if(!nextPendingUserEntry()){
      renderUserMatchPresentation();
      return;
    }
    const nextEntry=nextPendingUserEntry();
    // Libera jogo no dia agendado ou se o calendário passou do jogo (atrasado).
    if(nextEntry&&isPendingFixtureOverdue(nextEntry)===false&&!sameCalendarDay(nextEntry.details.date,careerCalendarDate)){
      $$('.nav').find(button=>button.dataset.view==='calendar')?.click();
      return;
    }
    pushMatchDayBrief(nextEntry?.game);
    liveMatchGame=nextEntry?.game||nextUserGame;
    if(!(await bindSquadForUserFixture(liveMatchGame))){
      pushMessage?.({category:'match',type:'error',title:'Elenco indisponível',body:'Não foi possível carregar o elenco da seleção. Recarregue a página e tente novamente.',round:currentRound,meta:{competition:'Copa do Mundo'}});
      liveMatchGame=null;
      return;
    }
    renderLiveMatchHeader(liveMatchGame);
    // NÃO cumprir suspensão no pré-jogo — o banimento vale para esta partida.
    // O cumprimento (serve) ocorre só após o jogo / avanço de rodada.
    // Mantém a escalação/formação da tela Táticas; só limpa titulares indisponíveis.
    sanitizeUserStartersForMatch();
    orderRosterForFormation(matchClub().roster,matchClub().formation);
    if(!isWorldCupUserFixture(liveMatchGame,userNationalTeamName))clubs[userClub].formation=formation;
    else formation=resolveUserMatchFormation(liveMatchGame);
    positionAssignments=[...(formationRoles[formation]||formationRoles['4-3-3'])];
    const userSideClub=userSideClubForGame(liveMatchGame)||clubs[userClub];
    matchStarted=true; matchFinished=false; preMatchPreparation=true; minute=0;home=0;away=0;pauses=0;halftimeShown=false;secondHalfStarted=false;pendingPenalty=null;shootoutState=null;disciplineEvents=0;substitutions=0;awaySubstitutions=0;awaySubWindows=0;stoppageFirst=0;stoppageSecond=0;stoppageElapsed=0;stoppageActive=null;stoppageHalfSnap=null;substitutedOut=new Set();roundResults=null;roundResultMessagePushed=false;postMatchMedicalQueue=[];matchDiscipline={home:new Map(),away:new Map()};liveInjuries={home:[],away:[]};liveDeferredInjuries={home:[],away:[]};liveOpeningLineup={home:starters().map(player=>player.name),away:matchClub().roster.slice(0,11).map(player=>player.name)};liveMinutesPlayed={home:new Map(starters().map(player=>[player.name,0])),away:new Map(matchClub().roster.slice(0,11).map(player=>[player.name,0]))};availabilityCommitted=false;liveDayMatches.clearSnapshots();preMatchTacticSnapshot=null;matchFactors={home:contextFactor({...seasonContext.home,position:userSideClub?.position||userSideClub?.fifaRank||clubs[userClub].position,isHome:isUserHomeMatch(liveMatchGame)}),away:contextFactor({...seasonContext.away,position:matchClub().position,isHome:!isUserHomeMatch(liveMatchGame)})};cards={home:starters().map(() => ({yellow:0,red:false,dismissal:null,injured:false,playThroughRisk:false})),away:matchClub().roster.slice(0,11).map(() => ({yellow:0,red:false,dismissal:null,injured:false,playThroughRisk:false}))};goals={home:[],away:[]};liveVolumeSamples=[];liveVolumePrev=null;liveVolumePulse={home:0.1,away:0.1};liveVolumeIncidents=[];stats={home:blank(),away:blank()};score();timeline.innerHTML='';timeline.classList.add('hidden');$('#liveVolume')?.classList.add('hidden');$('#matchActions').innerHTML='<button id="pauseMatch">Ⅱ PAUSA TÉCNICA <small id="pauseCounter">0/3</small></button><button id="liveStats">ESTATÍSTICAS AO VIVO</button><button id="liveOpponent">VER ADVERSÁRIO</button>';bindLiveActions();$('#pauseCounter').textContent='0/3';$('#matchStatus').textContent='Organize sua equipe antes de iniciar a partida.';modal.classList.remove('hidden');$('#penaltyChoice').classList.add('hidden');$('#shootoutPanel').classList.add('hidden');$('#liveOpponentModal').classList.add('hidden');updateLiveMatchClock();openPreparation('PRÉ-JOGO');
    flushLiveMatchPersist();
    persistSeason(true);
  });
  onClick('#simulateRemainder',()=>simulateNonHumanSeasonRemainder());
  const openLastPostMatchView=()=>{
    if(!(matchStarted&&matchFinished&&!roundCommitted&&liveMatchGame))return false;
    $('#calendarMatchReportModal')?.classList.add('hidden');
    const opened=reopenMatchWindow();
    if(opened){
      renderUserMatchPresentation();
      // Reabrir pelo CTA não força NOTAS de novo — o usuário abre pelo botão NOTAS.
    }
    return opened;
  };
  onClick('#reopenPostMatch',()=>{openLastPostMatchView();});
  onClick('#closeMatch',()=>{
    // Pós-jogo: × só fecha a janela — AVANÇAR é quem confirma e avança a rodada.
    if(matchFinished&&!roundCommitted){
      flushLiveMatchPersist();
      if(matchStarted)persistSeason(true);
      stopMatchClock();
      matchLiveAudio.stopAll();
      closeFormationSuggestion();
      $('#calendarMatchReportModal')?.classList.add('hidden');
      $('#liveOpponentModal').classList.add('hidden');
      modal.classList.add('hidden');
      renderUserMatchPresentation();
      return;
    }
    flushLiveMatchPersist();
    if(matchStarted)persistSeason(true);
    stopMatchClock();
    matchLiveAudio.stopAll();
    modal.classList.add('hidden');$('#liveOpponentModal').classList.add('hidden');closeFormationSuggestion();
    $('#calendarMatchReportModal')?.classList.add('hidden');
    renderUserMatchPresentation();
  });
  onClick('#resumeMatch',()=>{
    matchLiveAudio.unlock();
    const startingMatch=preMatchPreparation;
    const startingSecondHalf=!startingMatch&&halftimeShown&&!matchFinished&&minute<=45;
    if(startingMatch)pauseLineupBaseline=null;
    else finalizePauseLineupEdits();
    preMatchPreparation=false;
    activePreparationTitle='';
    $('#pausePanel').classList.add('hidden');
    $('#stats').classList.add('hidden');
    $('#matchActions').classList.remove('hidden');
    $('#matchStatus').textContent='A partida está em andamento…';
    const resumeClock=()=>{
      updateLiveMatchClock();
      matchLiveUi.refreshMatchFeed?.();
      startMatchClock();
      matchLiveAudio.startStadiumAmbient?.();
      flushLiveMatchPersist();
    };
    if(startingMatch){
      matchLiveUi.resetLiveClockSeconds();liveDayMatches.clearSnapshots();liveDayMatches.ensure();applyPreMatchTraining();renderRoster();
      liveOpeningLineup={home:starters().map(player=>player.name),away:matchClub().roster.slice(0,11).map(player=>player.name)};
      preMatchTacticSnapshot={...(tactics?.getTacticalValues?.()??DEFAULT_USER_TACTICS)};
      const venue=matchVenueFor(liveMatchGame?.home||userClub);
      const crowd=liveMatchGame?resolveMatchAttendance(liveMatchGame):null;
      const crowdLine=crowd
        ? ` Público: ${crowd.attendance.toLocaleString('pt-BR')} (${Math.round(crowd.fillRate*100)}% da capacidade).`
        : '';
      const kickoff=tacticalKickoffMessage(preMatchTacticSnapshot);
      if(kickoff)log(kickoff,'tactic');
      if(!liveVolumeSamples.length)liveVolumeSamples=[{minute:0,home:0.14,away:0.14}];
      const whistleReady=matchLiveAudio.playKickoff();
      const onKickoffWhistle=()=>{
        timeline.classList.remove('hidden');
        timeline.innerHTML=`<p>0' · A bola está rolando no ${venue.name}!${crowdLine}</p>`;
        resumeClock();
      };
      if(whistleReady?.then)whistleReady.then(onKickoffWhistle);
      else onKickoffWhistle();
      return;
    }
    if(startingSecondHalf){
      stoppageActive=null;
      stoppageElapsed=0;
      minute=45;
      secondHalfStarted=true;
      matchLiveUi.resetLiveClockSeconds();
      log('Início do 2º tempo.','');
      matchLiveAudio.playSecondHalf?.();
      resumeClock();
      return;
    }
    const whistleReady=matchLiveAudio.playResumeWhistle();
    if(whistleReady?.then)whistleReady.then(resumeClock);
    else resumeClock();
  });
  onClick('#penaltyTakers',e=>{
    const button=e.target.closest('button');
    if(!button||button.disabled)return;
    if(pendingPenalty?.mode==='against'||pendingPenalty?.mode==='shootout-cpu')return;
    const takerName=button.dataset.taker;
    // Shootout: se o pending foi apagado após a cobrança da IA, recupera pela vez atual.
    const shootoutKickClub=pendingPenalty?.mode==='shootout'
      ?pendingPenalty.kickingClub
      :(shootoutState&&currentShootoutClub()===userClub?userClub:null);
    if(shootoutKickClub){
      const lineup=shootoutLineup(shootoutKickClub),taker=lineup.find(player=>player.name===takerName);
      if(!taker)return;
      const kickingClub=shootoutKickClub;
      const isUser=kickingClub===userClub;
      const current=isUser?profile():opponentForMatch();
      const other=isUser?opponentForMatch():profile();
      const side=isUser?'home':'away';
      const plan=planPenaltyOutcome(side,{...current,attack:current.attack+9},other,{taker:taker.name,penaltySkill:taker.penaltyTaking,shootout:true});
      if(!plan?.outcome)return;
      pendingPenalty={mode:'shootout',kickingClub};
      const beginShootoutDuel=()=>{
        runPenaltyDuelResolve(takerName,plan,()=>{
          pendingPenalty=null;
          executeShootoutKick(kickingClub,taker,plan);
        });
      };
      const kickCue=matchLiveAudio.playPenaltyKick();
      if(kickCue?.then)kickCue.then(beginShootoutDuel);
      else beginShootoutDuel();
      return;
    }
    const taker=starters().find(p=>p.name===takerName);
    if(!taker||!pendingPenalty)return;
    const pending={...pendingPenalty};
    const plan=planPenaltyOutcome('home',{...pending.current,attack:pending.current.attack+9},pending.other,{taker:taker.name,penaltySkill:taker.penaltyTaking});
    if(!plan?.outcome)return;
    const beginPenaltyDuel=()=>{
      runPenaltyDuelResolve(takerName,plan,()=>{
        shot('home',{...pending.current,attack:pending.current.attack+9},pending.other,{
          penalty:true,
          taker:taker.name,
          penaltySkill:taker.penaltyTaking,
          forcedOutcome:plan.outcome,
        });
        closePenaltyDuel();
        $('#matchActions').classList.remove('hidden');
        $('#matchStatus').textContent='A partida está em andamento…';
        pendingPenalty=null;
        renderStats();
        startMatchClock();
      });
    };
    const kickCue=matchLiveAudio.playPenaltyKick();
    if(kickCue?.then)kickCue.then(beginPenaltyDuel);
    else beginPenaltyDuel();
  });
  
  bindLiveActions();
  const autoBenchmarkCount=Number(new URLSearchParams(location.search).get('autoBenchmark'));
  if(autoBenchmarkCount>0&&typeof simulateRoundMatch==='function'){
    const percentile=(sorted,p)=>{const index=(sorted.length-1)*p,lower=Math.floor(index),upper=Math.ceil(index);return lower===upper?sorted[lower]:sorted[lower]+(sorted[upper]-sorted[lower])*(index-lower);};
    const sample=Math.max(100,Math.min(20000,autoBenchmarkCount)),clubNames=Object.keys(clubs),fixtures=[],pairingMode=new URLSearchParams(location.search).get('pairing')||'mixed';
    if(pairingMode==='round'){
      const roundList=futureMatches.length?futureMatches:Object.values(nationalCompetitions[userDivision]?.fixtures||{})[0]||[];
      for(let index=0;index<sample;index++){const game=roundList[index%Math.max(1,roundList.length)];fixtures.push({home:game.home,away:game.away});}
    }else for(let index=0;index<sample;index++){const home=clubNames[index%clubNames.length],away=clubNames[(index*7+3)%clubNames.length];if(home!==away)fixtures.push({home,away});}
    const scoreDist={},goalsPerMatch=[],shotsPerMatch=[],xgPerMatch=[],homePossession=[],powerGapBuckets={even:{n:0,homeWins:0,goals:0},slight:{n:0,homeWins:0,goals:0},strong:{n:0,homeWins:0,goals:0}};
    const totals={matches:0,goals:0,homeGoals:0,awayGoals:0,draws:0,homeWins:0,awayWins:0,scoreless:0,over25:0,over35:0,over45:0,maxGoals:0,shots:0,onTarget:0,fouls:0,yellows:0,reds:0,corners:0,offsides:0,penalties:0,injuries:0,subs:0,xg:0,injuryConfirmedInMatch:0,injuryDeferred:0,injuryCleared:0,injuryMonitoring:0,injuryConfirmedPostMatch:0,injuryDaysOffTotal:0};
    const started=performance.now();
    fixtures.forEach(({home,away})=>{
      const result=simulateRoundMatch(home,away),d=result.data,hg=result.homeGoals,ag=result.awayGoals,tg=hg+ag,key=`${hg}-${ag}`;
      scoreDist[key]=(scoreDist[key]||0)+1;totals.matches++;totals.goals+=tg;totals.homeGoals+=hg;totals.awayGoals+=ag;
      totals.draws+=hg===ag?1:0;totals.homeWins+=hg>ag?1:0;totals.awayWins+=ag>hg?1:0;totals.scoreless+=tg===0?1:0;
      totals.over25+=tg>=3?1:0;totals.over35+=tg>=4?1:0;totals.over45+=tg>=5?1:0;totals.maxGoals=Math.max(totals.maxGoals,tg);
      totals.shots+=(d.homeShots||0)+(d.awayShots||0);totals.onTarget+=(d.homeOnTarget||0)+(d.awayOnTarget||0);
      totals.fouls+=(d.homeFouls||0)+(d.awayFouls||0);totals.yellows+=(d.homeYellow||0)+(d.awayYellow||0);totals.reds+=(d.homeRed||0)+(d.awayRed||0);
      totals.corners+=(d.homeCorners||0)+(d.awayCorners||0);totals.offsides+=(d.homeOffsides||0)+(d.awayOffsides||0);
      totals.penalties+=(d.homePenalties||0)+(d.awayPenalties||0);totals.injuries+=(result.injuries?.home?.length||0)+(result.injuries?.away?.length||0);
      const injurySummary=summarizeMatchInjuries(result);
      totals.injuryConfirmedInMatch+=injurySummary.confirmedInMatch;totals.injuryDeferred+=injurySummary.deferred;totals.injuryCleared+=injurySummary.cleared;totals.injuryMonitoring+=injurySummary.monitoring;totals.injuryConfirmedPostMatch+=injurySummary.confirmedPostMatch;totals.injuryDaysOffTotal+=injurySummary.totalDaysOut;
      totals.subs+=(result.substitutions?.home||0)+(result.substitutions?.away||0);const matchXg=(d.homeXg||0)+(d.awayXg||0);totals.xg+=matchXg;
      goalsPerMatch.push(tg);shotsPerMatch.push((d.homeShots||0)+(d.awayShots||0));xgPerMatch.push(matchXg);homePossession.push(d.homePossession||50);
      const gap=(clubs[home]?.power||75)-(clubs[away]?.power||75),bucket=Math.abs(gap)<=2?'even':Math.abs(gap)<=6?'slight':'strong';
      powerGapBuckets[bucket].n++;powerGapBuckets[bucket].goals+=tg;powerGapBuckets[bucket].homeWins+=hg>ag?1:0;
    });
    goalsPerMatch.sort((a,b)=>a-b);shotsPerMatch.sort((a,b)=>a-b);xgPerMatch.sort((a,b)=>a-b);homePossession.sort((a,b)=>a-b);
    const n=totals.matches,report={
      sampleSize:n,elapsedMs:Math.round(performance.now()-started),mode:savedNewGame?'career':'demo',division:userDivision,pairing:pairingMode,
      builtIn:typeof window.__brfutEngineBenchmark==='function'?window.__brfutEngineBenchmark(Math.min(n,1000)):null,
      rates:{
        goalsPerMatch:Number((totals.goals/n).toFixed(3)),homeGoalsPerMatch:Number((totals.homeGoals/n).toFixed(3)),awayGoalsPerMatch:Number((totals.awayGoals/n).toFixed(3)),
        drawRate:Number((totals.draws/n*100).toFixed(2)),homeWinRate:Number((totals.homeWins/n*100).toFixed(2)),awayWinRate:Number((totals.awayWins/n*100).toFixed(2)),
        scorelessRate:Number((totals.scoreless/n*100).toFixed(2)),over25Rate:Number((totals.over25/n*100).toFixed(2)),over35Rate:Number((totals.over35/n*100).toFixed(2)),over45Rate:Number((totals.over45/n*100).toFixed(2)),
        shotsPerMatch:Number((totals.shots/n).toFixed(2)),onTargetPerMatch:Number((totals.onTarget/n).toFixed(2)),onTargetPct:Number((totals.onTarget/Math.max(1,totals.shots)*100).toFixed(2)),
        conversionPct:Number((totals.goals/Math.max(1,totals.onTarget)*100).toFixed(2)),foulsPerMatch:Number((totals.fouls/n).toFixed(2)),yellowsPerMatch:Number((totals.yellows/n).toFixed(2)),
        redsPerMatch:Number((totals.reds/n).toFixed(2)),cornersPerMatch:Number((totals.corners/n).toFixed(2)),offsidesPerMatch:Number((totals.offsides/n).toFixed(2)),
        penaltiesPerMatch:Number((totals.penalties/n).toFixed(2)),injuriesPerMatch:Number((totals.injuries/n).toFixed(2)),subsPerMatch:Number((totals.subs/n).toFixed(2)),
        injuryConfirmedInMatchPerMatch:Number((totals.injuryConfirmedInMatch/n).toFixed(3)),injuryDeferredPerMatch:Number((totals.injuryDeferred/n).toFixed(3)),injuryClearedPerMatch:Number((totals.injuryCleared/n).toFixed(3)),injuryMonitoringPerMatch:Number((totals.injuryMonitoring/n).toFixed(3)),injuryConfirmedPostMatchPerMatch:Number((totals.injuryConfirmedPostMatch/n).toFixed(3)),injuryDaysOffPerMatch:Number((totals.injuryDaysOffTotal/n).toFixed(2)),
        xgPerMatch:Number((totals.xg/n).toFixed(3)),xgToGoalsRatio:Number((totals.goals/Math.max(0.001,totals.xg)).toFixed(3))
      },
      percentiles:{goals:{p10:percentile(goalsPerMatch,.1),p25:percentile(goalsPerMatch,.25),p50:percentile(goalsPerMatch,.5),p75:percentile(goalsPerMatch,.75),p90:percentile(goalsPerMatch,.9)},shots:{p50:percentile(shotsPerMatch,.5),p90:percentile(shotsPerMatch,.9)},xg:{p50:percentile(xgPerMatch,.5),p90:percentile(xgPerMatch,.9)},homePossession:{p25:percentile(homePossession,.25),p50:percentile(homePossession,.5),p75:percentile(homePossession,.75)}},
      topScores:Object.entries(scoreDist).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([score,count])=>({score,count,pct:Number((count/n*100).toFixed(2))})),
      powerGapBuckets:Object.fromEntries(Object.entries(powerGapBuckets).map(([key,value])=>[key,{matches:value.n,homeWinRate:value.n?Number((value.homeWins/value.n*100).toFixed(2)):0,goalsPerMatch:value.n?Number((value.goals/value.n).toFixed(3)):0}])),
      references:{brasileiraoSerieA:{goalsPerMatch:'2.45-2.55',drawRate:'24-27%',homeWinRate:'45-48%',shotsPerMatch:'22-28',foulsPerMatch:'24-30'},topLeagues:{goalsPerMatch:'2.6-2.9',drawRate:'22-26%',homeWinRate:'44-46%'}}
    };
    document.body.innerHTML=`<pre id="benchmark-json">${JSON.stringify(report,null,2)}</pre>`;document.title='BENCHMARK_DONE';
  }
  const autoBenchmarkShootoutCount=Number(new URLSearchParams(location.search).get('autoBenchmarkShootout'));
  if(autoBenchmarkShootoutCount>0){
    const percentile=(sorted,p)=>{const index=(sorted.length-1)*p,lower=Math.floor(index),upper=Math.ceil(index);return lower===upper?sorted[lower]:sorted[lower]+(sorted[upper]-sorted[lower])*(index-lower);};
    const sample=Math.max(100,Math.min(20000,autoBenchmarkShootoutCount)),clubNames=Object.keys(clubs);
    const scoreDist={},goalsPerShootout=[],kicksPerShootout=[],convSamples=[];
    const totals={shootouts:0,goals:0,kicks:0,scored:0,suddenDeath:0};
    const started=performance.now();
    for(let index=0;index<sample;index++){
      const home=clubNames[index%clubNames.length],away=clubNames[(index*7+3)%clubNames.length];
      if(home===away)continue;
      const getKickPair=(clubName,attemptIndex)=>rosterShootoutKickPair(clubs[clubName],attemptIndex);
      const result=simulateProbabilisticShootout([home,away],{random:gameRandom,getKickPair});
      if(!result?.winner)continue;
      const g0=result.scores[home]||0,g1=result.scores[away]||0,tg=g0+g1;
      const kicks=result.totalKicks||((result.results[home]?.length||0)+(result.results[away]?.length||0));
      totals.shootouts++;totals.goals+=tg;totals.kicks+=kicks;
      Object.values(result.results||{}).flat().forEach(hit=>{if(hit)totals.scored++;});
      if(result.suddenDeath)totals.suddenDeath++;
      const key=`${g0}-${g1}`;scoreDist[key]=(scoreDist[key]||0)+1;
      goalsPerShootout.push(tg);kicksPerShootout.push(kicks);
      convSamples.push(tg/Math.max(1,kicks));
    }
    goalsPerShootout.sort((a,b)=>a-b);kicksPerShootout.sort((a,b)=>a-b);convSamples.sort((a,b)=>a-b);
    const n=Math.max(1,totals.shootouts),report={
      sampleSize:n,elapsedMs:Math.round(performance.now()-started),mode:'shootout-only',
      note:'Disputa de pênaltis — não entra na média de gols (GPM) do campeonato.',
      rates:{
        goalsPerShootout:Number((totals.goals/n).toFixed(3)),
        kicksPerShootout:Number((totals.kicks/n).toFixed(2)),
        conversionPct:Number((totals.scored/Math.max(1,totals.kicks)*100).toFixed(2)),
        suddenDeathRate:Number((totals.suddenDeath/n*100).toFixed(2)),
      },
      percentiles:{
        goals:{p25:percentile(goalsPerShootout,.25),p50:percentile(goalsPerShootout,.5),p75:percentile(goalsPerShootout,.75),p90:percentile(goalsPerShootout,.9)},
        kicks:{p50:percentile(kicksPerShootout,.5),p90:percentile(kicksPerShootout,.9)},
        conversion:{p50:Number((percentile(convSamples,.5)*100).toFixed(2)),p90:Number((percentile(convSamples,.9)*100).toFixed(2))},
      },
      topScores:Object.entries(scoreDist).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([score,count])=>({score,count,pct:Number((count/n*100).toFixed(2))})),
      references:{typicalShootout:{goalsPerShootout:'6-9',conversionPct:'74-80%',kicksPerShootout:'10-14'}},
    };
    document.body.innerHTML=`<pre id="benchmark-shootout-json">${JSON.stringify(report,null,2)}</pre>`;document.title='BENCHMARK_SHOOTOUT_DONE';
  }
  const expectedCupEntryPhase=()=>{
    if(userDivision==='A')return 5;
    if(cupSpecialEntrants.includes(userClub))return 3;
    if(cupSecondDirect.includes(userClub))return 2;
    if(cupFirstRanked.includes(userClub))return 1;
    return null;
  };
  const userCupFixtures=()=>(cupCompetition.stages||[]).flatMap(stage=>(Array.isArray(stage?.fixtures)?stage.fixtures:[]).filter(game=>game.home===userClub||game.away===userClub));
  const runCupCareerAudit=()=>{
    const expected=expectedCupEntryPhase(),seasonEnd=new Date(careerSeason,11,31,12),mayCheck=new Date(careerSeason,4,1,12);
    const fixturesAtStart=userCupFixtures().length,pendingAtStart=pendingUserSchedule().filter(entry=>entry.game.competition==='COPA DO BRASIL').length;
    // Marcos do calendário da Copa — evita avançar dia a dia (pesado em benchmarks em massa).
    const cupMilestones=buildCupPhaseNominalDates(careerSeason);
    const auditDates=[seasonStartDate(),...(cupMilestones[1]||[]),...(cupMilestones[4]||[]),...(cupMilestones[6]||[]),seasonEnd];
    auditDates.forEach(date=>{
      advanceCareerCalendarTo(date);
      advanceCupThroughDate(date);
      advanceStateLeagueThroughDate(date);
    });
    for(let pass=0;pass<20;pass++){
      let progressed=false;
      cupCompetition.stages.forEach(stage=>{
        [...new Set(stage.fixtures.map(game=>game.tieId))].forEach(tieId=>{
          const games=cupTieGames(stage,tieId);
          if(!games.some(isUserFixture))return;
          games.forEach(game=>{
            if(game.completed)return;
            const result=simulateRoundMatch(game.home,game.away,game);
            let homeGoals=result.homeGoals,awayGoals=result.awayGoals;
            const userHome=game.home===userClub,userGoals=userHome?homeGoals:awayGoals,oppGoals=userHome?awayGoals:homeGoals;
            if(userGoals<=oppGoals){if(userHome)homeGoals=oppGoals+1;else awayGoals=oppGoals+1;}
            Object.assign(game,{completed:true,homeGoals,awayGoals,data:result.data,goals:result.goals});
            progressed=true;
          });
          if(resolveCupTie(stage,tieId))progressed=true;
          if(finalizeCupStageIfReady(stage))progressed=true;
        });
      });
      refreshCopaDoBrasilFixtures();
      if(!progressed)break;
    }
    const fixtures=userCupFixtures(),pendingCup=pendingUserSchedule().filter(entry=>entry.game.competition==='COPA DO BRASIL');
    const everInCup=fixtures.length>0,anomalies=[];
    if(expected===null&&userDivision!=='A')anomalies.push('missing_from_pool');
    if(!everInCup&&careerCalendarDate>=mayCheck&&expected!==null)anomalies.push('never_entered_copa');
    if(userDivision==='A'&&!everInCup&&cupCompetition.stages.some(stage=>stage.index>=4&&stage.completed))anomalies.push('serie_a_missing_after_phase4');
    if(isUserSeasonIdle()&&!seasonComplete()&&expected!==null&&!everInCup)anomalies.push('idle_without_copa');
    cupCompetition.stages.forEach(stage=>{
      [...new Set(stage.fixtures.map(game=>game.tieId))].forEach(tieId=>{
        const games=cupTieGames(stage,tieId);
        if(!games.some(isUserFixture))return;
        if(games.some(game=>!game.completed)&&games.some(game=>game.winner))anomalies.push(`tie_resolved_before_user_play:F${stage.index}:${tieId}`);
      });
    });
    const phase4=cupCompetition.stages.find(stage=>stage.index===4),phase5=cupCompetition.stages.find(stage=>stage.index===5);
    if(userDivision==='A'&&phase4?.completed&&!everInCup&&(!phase5||!phase5.entrants?.includes(userClub)))anomalies.push('serie_a_not_in_phase5');
    return{
      seed:savedNewGame?.seed??null,club:userClub,division:userDivision,expectedEntryPhase:expected,
      entryPath:expected===1?'1a_fase':expected===2?'2a_fase_direta':expected===3?'3a_fase_especial':expected===5?'5a_fase_serie_a':null,
      fixturesAtStart,pendingCupAtStart:pendingAtStart,cupFixturesTotal:fixtures.length,cupFixturesCompleted:fixtures.filter(game=>game.completed).length,
      cupFixturesPending:pendingCup.length,cupCurrentPhase:cupCompetition.currentPhase,cupChampion:cupCompetition.champion,
      calendarDate:calendarKey(careerCalendarDate),currentRound,seasonIdle:isUserSeasonIdle(),seasonComplete:seasonComplete(),everInCup,anomalies
    };
  };
  window.__brfutRunCupCareerAudit=runCupCareerAudit;
  window.__matchdayRunCupCareerAudit=window.__brfutRunCupCareerAudit;
  if(new URLSearchParams(location.search).has('cupAudit')&&savedNewGame){
    const audit=runCupCareerAudit();
    document.body.innerHTML=`<pre id="cup-audit-json">${JSON.stringify(audit,null,2)}</pre>`;
    document.title=audit.anomalies.length?'CUP_AUDIT_FAIL':'CUP_AUDIT_OK';
    window.__cupAuditResult=audit;
  }
  // Pinta o dashboard com dados reais antes de liberar a shell — evita placeholders do index.html.
  const skipPresentationHydration=new URLSearchParams(location.search).has('benchmark')||new URLSearchParams(location.search).has('cupAudit');
  if(savedNewGame&&!skipPresentationHydration)refreshSeasonPresentation();
  markBootReady();
  // Pós-boot leve: partida ao vivo, simulação idle ou transição de temporada.
  if(savedNewGame&&!skipPresentationHydration){
    const hydratePostBoot=()=>{
      const restoredLive=tryRestoreLiveMatch({openModal:true});
      if(!restoredLive){
        if(isUserSeasonIdle())setTimeout(()=>simulateNonHumanSeasonRemainder(),0);
        else if(seasonComplete())tryPrepareSeasonTransition();
      }
    };
    if(typeof requestIdleCallback==='function')requestIdleCallback(hydratePostBoot,{timeout:120});
    else setTimeout(hydratePostBoot,0);
  }
  } catch(error) {
    markBootReady();
    document.documentElement.dataset.bootError=String(error?.stack||error);
    console.error('BR Fut failed to initialize',error);
    throw error;
  }
}
