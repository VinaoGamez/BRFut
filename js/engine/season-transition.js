import {
  SERIE_D_CLUBS,
  SERIE_D_PROMOTIONS,
  SERIE_C_RELEGATION_TO_D,
  normalizeDivisionTeamsSerieC,
} from './serie-c-calendar.js';
import {
  buildSerieDRosterCBF,
  collectSerieDSecondPhaseClubs,
  serieDFormationSummary,
} from './serie-d-formation.js';

function seasonPrizeCreditedTotal(club) {
  const ledger = Array.isArray(club?.budgetLedger) ? club.budgetLedger : [];
  return ledger
    .filter(entry => entry?.reason === 'season_prize')
    .reduce((sum, entry) => sum + Math.abs(Number(entry?.amount) || 0), 0);
}

/**
 * Fim de temporada — promoções/rebaixamentos, prêmios, balanço e simulação idle.
 * Sem DOM direto; callbacks do engine legado.
 */
export function createSeasonTransitionEngine(deps) {
  let pendingDivisionTeams = deps.initialPendingDivisionTeams ?? null;
  let pendingUserDivision = deps.initialPendingUserDivision ?? deps.getUserDivision();
  let pendingSerieDFormation = deps.initialPendingSerieDFormation ?? null;
  let pendingStateLeagueGuaranteed = deps.initialPendingStateLeagueGuaranteed ?? null;
  let pendingStateLeagueMembership = deps.initialPendingStateLeagueMembership ?? null;
  let seasonTransitionPrepared = !!deps.initialSeasonTransitionPrepared;
  let idleSeasonWasSimulated = !!deps.initialIdleSeasonWasSimulated;
  let nonHumanSimRunning = false;

  const ranked = division =>
    [...deps.getNationalCompetitions()[division].standings]
      .sort((a, b) => b.points - a.points || b.wins - a.wins || b.goalDiff - a.goalDiff)
      .map(row => row.club);

  const playoffEdge = (first, second, division) => {
    const table = deps.getNationalCompetitions()[division].standings;
    const a = table.find(row => row.club === first);
    const b = table.find(row => row.club === second);
    const aScore = a.points + deps.getClubs()[first].power * 0.18 + deps.rnd(-2.5, 2.5);
    const bScore = b.points + deps.getClubs()[second].power * 0.18 + deps.rnd(-2.5, 2.5);
    return aScore >= bScore ? first : second;
  };

  const finishRemainingNationalRounds = (fromRound, throughRound = 38) => {
    const nationalCompetitions = deps.getNationalCompetitions();
    const competitionRoundHistory = deps.getCompetitionRoundHistory();
    const lastRound = Math.min(38, Math.max(fromRound, Number(throughRound) || 38));
    for (let round = fromRound; round <= lastRound; round++) {
      ['A', 'B', 'C'].forEach(division => {
        const history = competitionRoundHistory[division] || [];
        // Idempotente: não reaplicar rodada já no histórico (evita J>38 / J=42).
        if (history.some(entry => Number(entry?.round) === round)) return;
        const competition = nationalCompetitions[division];
        const fixtures = (Array.isArray(competition?.fixtures) ? competition.fixtures : [])[round - 1] || [];
        const clubs = deps.getClubs();
        const playable = fixtures.filter(game => {
          if (!game?.home || !game?.away || !clubs[game.home] || !clubs[game.away]) return false;
          if (game.completed) return false;
          return true;
        });
        if (!playable.length) return;
        const results = playable.map(game => deps.simulateRoundMatch(game.home, game.away, game));
        results.forEach(deps.recordGameLeaders);
        results.forEach(game => deps.applySecondaryResult(game, competition));
        results.forEach(game => {
          if (game?.fixture) game.fixture.completed = true;
          else if (game) game.completed = true;
        });
        deps.creditLeagueHomeTvForGames(results, division);
        if (!competitionRoundHistory[division]) competitionRoundHistory[division] = [];
        competitionRoundHistory[division].push({
          round,
          games: results.map(game => deps.compactMatchResult(game, { keepData: false })),
        });
      });
    }
    Object.values(nationalCompetitions).forEach(competition => {
      if (Array.isArray(competition?.standings)) {
        competition.standings.sort((a, b) => b.points - a.points || b.wins - a.wins || b.goalDiff - a.goalDiff);
      }
    });
    deps.persistPlayerHistory();
  };

  const seasonReadyForTransition = () => {
    if (!deps.seasonComplete()) return false;
    if (deps.hasPendingUserFixtures()) return false;
    deps.advanceCupThroughDate(new Date(deps.getCareerSeason(), 11, 31, 12));
    // Fecha a Copa do Mundo (CPU) até o fim da janela — senão some da lista de campeões.
    const seasonYear = deps.getCareerSeason();
    const wcEnd = deps.worldCupWindowEndDate?.(seasonYear)
      || new Date(seasonYear, 6, 19, 12);
    deps.advanceWorldCupThroughDateLocal?.(wcEnd);
    deps.refreshWorldCupFixtures?.();
    deps.refreshCopaDoBrasilFixtures();
    deps.rebuildCalendarGames();
    return !deps.hasPendingUserFixtures();
  };

  const prepareSeasonTransition = () => {
    const userClub = deps.getUserClub();
    const userDivision = deps.getUserDivision();
    const careerSeason = deps.getCareerSeason();
    const currentRound = deps.getCurrentRound();
    const clubs = deps.getClubs();
    const divisionTeams = deps.getDivisionTeams();
    const nationalCompetitions = deps.getNationalCompetitions();
    const serieDGroups = deps.getSerieDGroups();
    const dKnockout = deps.getDKnockout();
    const cupCompetition = deps.getCupCompetition();
    const generatedClubPool = deps.getGeneratedClubPool();

    // Garante campeão da CMU antes de montar a lista (simulação idle pode ter pulado a janela).
    const wcEnd = deps.worldCupWindowEndDate?.(careerSeason) || new Date(careerSeason, 6, 19, 12);
    deps.advanceWorldCupThroughDateLocal?.(wcEnd);
    deps.refreshWorldCupFixtures?.();

    try {
      const returnedLoans = deps.returnExpiredLoans?.() || 0;
      if (returnedLoans > 0) {
        if (clubs[userClub]) {
          deps.assignSquadJerseyNumbers(clubs[userClub].roster);
          deps.syncUserSquadFromClub();
        }
        deps.syncCareerRosters();
      }
      deps.clearSeasonDeals?.();
    } catch {
      /* boot / mercado off */
    }

    const a = ranked('A');
    const b = ranked('B');
    const c = ranked('C');
    const relA = a.slice(-4);
    const promB = [b[0], b[1], playoffEdge(b[2], b[5], 'B'), playoffEdge(b[3], b[4], 'B')];
    const relB = b.slice(-4);
    const promC = c.slice(0, 4);
    const relC = c.slice(-SERIE_C_RELEGATION_TO_D);
    let promD = [...deps.serieDPromotedClubs()];
    if (promD.length < SERIE_D_PROMOTIONS) {
      const groupWinners = serieDGroups
        .map(group =>
          group
            .map(name => nationalCompetitions.D.standings.find(row => row.club === name))
            .filter(Boolean)
            .sort((x, y) => y.points - x.points || y.wins - x.wins || y.goalDiff - x.goalDiff)[0]?.club,
        )
        .filter(Boolean);
      promD = [...new Set([...promD, ...groupWinners])].slice(0, SERIE_D_PROMOTIONS);
    }

    const permanenceClubs = collectSerieDSecondPhaseClubs(serieDGroups, nationalCompetitions.D);
    const dFormation = buildSerieDRosterCBF({
      relegatedFromC: relC,
      promotedFromD: promD,
      previousD: divisionTeams.D,
      permanenceClubs,
      regionalPool: generatedClubPool,
      nationalRankingEntries: deps.getNationalRankingEntries?.() || {},
      clubs,
      userClub,
      stateRnfQualifiersByUf: deps.getStateRnfQualifiers?.(careerSeason + 1) || null,
      careerSeason: careerSeason + 1,
    });

    const next = {
      A: [...divisionTeams.A.filter(name => !relA.includes(name)), ...promB],
      B: [...divisionTeams.B.filter(name => !promB.includes(name) && !relB.includes(name)), ...relA, ...promC],
      C: [...divisionTeams.C.filter(name => !promC.includes(name) && !relC.includes(name)), ...relB, ...promD],
      D: dFormation.roster,
    };

    const nextCNorm = normalizeDivisionTeamsSerieC(next, {
      season: careerSeason + 1,
      userClub,
      fillPool: generatedClubPool,
      dTarget: SERIE_D_CLUBS,
      skipD: true,
    });
    pendingDivisionTeams = nextCNorm.divisionTeams;
    pendingDivisionTeams.D = dFormation.roster.slice(0, SERIE_D_CLUBS);
    deps.setPendingSerieDFormation?.({
      season: careerSeason + 1,
      breakdown: dFormation.breakdown,
      summary: serieDFormationSummary(dFormation.breakdown),
    });
    pendingSerieDFormation = {
      season: careerSeason + 1,
      breakdown: dFormation.breakdown,
      summary: serieDFormationSummary(dFormation.breakdown),
    };
    pendingUserDivision =
      Object.keys(pendingDivisionTeams).find(division => pendingDivisionTeams[division].includes(userClub)) ||
      userDivision;

    pendingStateLeagueGuaranteed = deps.getStateLeagueGuaranteedSnapshot?.() || null;
    pendingStateLeagueMembership = deps.getStateLeagueMembershipSnapshot?.() || null;

    const champions = {
      A: ranked('A')[0],
      B: ranked('B')[0],
      C: ranked('C')[0],
      D: dKnockout.champion || ranked('D')[0],
      CUP: cupCompetition.champion,
    };
    const recopaChampion = deps.getRecopaChampion?.() || null;
    if (recopaChampion) champions.RECOPA = recopaChampion;
    const continentalChampions = deps.getContinentalChampions?.() || {};
    if (continentalChampions.LIBERTADORES) champions.LIBERTADORES = continentalChampions.LIBERTADORES;
    if (continentalChampions.SUDAMERICANA) champions.SUDAMERICANA = continentalChampions.SUDAMERICANA;
    const worldCupChampion = deps.getWorldCupChampion?.();
    if (worldCupChampion) champions.WORLD_CUP = worldCupChampion;
    const championEstaduais = deps.getStateLeagueChampions?.() || [];
    const recopaSubtitle = deps.getRecopaSubtitle?.() || null;
    deps.finalizeManagerSeason?.({
      season: careerSeason,
      champions,
      championEstaduais,
    });
    deps.setPriorSeasonChampions?.({
      season: careerSeason,
      A: champions.A,
      CUP: champions.CUP,
    });
    const userPromoted = promD.includes(userClub) || promC.includes(userClub) || promB.includes(userClub);
    const userRelegated = relA.includes(userClub) || relB.includes(userClub) || relC.includes(userClub);
    const userLine =
      pendingUserDivision === userDivision
        ? `${userClub} permanece na Série ${pendingUserDivision} para ${careerSeason + 1}.`
        : userPromoted
          ? `${userClub} conquistou o acesso à Série ${pendingUserDivision}.`
          : userRelegated
            ? `${userClub} foi rebaixado para a Série ${pendingUserDivision}.`
            : `${userClub} segue na Série ${pendingUserDivision} na próxima temporada.`;
    const idleNote = idleSeasonWasSimulated
      ? ` Sem jogos restantes do clube — o calendário nacional de ${careerSeason} foi simulado até o fim.`
      : '';
    const userStatus = userPromoted ? 'promoted' : userRelegated ? 'relegated' : 'neutral';
    const position = deps.displayedClubPosition(userClub);
    const leagueChampion = champions[userDivision];
    const serieDPhase = userDivision === 'D' ? deps.resolveSerieDPrizePhase(userClub, dKnockout) : null;
    const cupPhase = deps.resolveCupPrizePhase(userClub, cupCompetition);
    const userStateDivision = deps.getUserStateLeagueDivision?.();
    const stateLeague = userStateDivision
      ? {
          phase: deps.resolveStateLeaguePrizePhase(userClub, userStateDivision),
          label: userStateDivision.label || 'Estadual',
          tier: userStateDivision.tier || 1,
        }
      : null;
    const prize = deps.computeSeasonPrize({
      division: userDivision,
      position,
      totalTeams: divisionTeams[userDivision]?.length || 20,
      champion: leagueChampion,
      cupChampion: champions.CUP,
      promoted: userPromoted,
      userClub,
      serieDPhase,
      cupPhase,
      stateLeague,
    });

    const userClubState = clubs[userClub];
    deps.ensureBudget(userClubState, userDivision);
    let budgetAfter = deps.getBalance(userClubState);

    const creditedSoFar = seasonPrizeCreditedTotal(userClubState);
    const prizeDelta = Math.max(0, prize.total - creditedSoFar);

    if (prizeDelta > 0) {
      deps.credit(userClubState, prizeDelta, {
        reason: 'season_prize',
        label:
          creditedSoFar > 0
            ? `Premiação temporada ${careerSeason} (ajuste)`
            : `Premiação temporada ${careerSeason}`,
        meta: { lines: prize.lines, season: careerSeason },
      });
      userClubState.wageShortfall = false;
      deps.syncFinancesFromBudget(userClubState, userDivision);
      deps.renderEnvironmentCard();
      budgetAfter = deps.getBalance(userClubState);
    }

    const savedObjectives = deps.ensureSeasonObjectives();
    const savedObjectivesResult = deps.getSeasonObjectivesResult();
    if (
      seasonTransitionPrepared &&
      savedObjectives?.length &&
      savedObjectivesResult?.items?.length &&
      Number(savedObjectivesResult.rulesVersion) < 2
    ) {
      const correctedResult = deps.evaluateSeasonObjectives(
        savedObjectives,
        deps.buildSeasonObjectiveEvalContext(userClubState),
        userClubState,
      );
      const boardDeltaAdjustment =
        (Number(correctedResult?.boardDelta) || 0) - (Number(savedObjectivesResult.boardDelta) || 0);
      deps.setSeasonObjectivesResult(correctedResult);
      if (boardDeltaAdjustment) {
        deps.applyClubStatusDeltas(clubs[userClub], { board: boardDeltaAdjustment });
        deps.renderEnvironmentCard();
      }
      deps.pushMessage({
        category: 'club',
        type: 'season-objectives-correction',
        title: 'METAS COMPLEMENTARES CORRIGIDAS',
        body: correctedResult.body,
        round: currentRound,
        read: false,
      });
    }

    if (!seasonTransitionPrepared) {
      deps.runSeasonEndDevelopmentPulse();

      const seasonGoal = deps.ensureSeasonGoal();
      let seasonGoalResult = deps.getSeasonGoalResult();
      if (seasonGoal && !seasonGoalResult?.status) {
        seasonGoalResult = deps.evaluateSeasonGoal(seasonGoal, {
          position,
          promoted: userPromoted,
          serieDPhase: serieDPhase || 'group',
          sponsorPressure: Number(clubs[userClub]?.sponsors?.pressure) || 0,
        });
        deps.setSeasonGoalResult(seasonGoalResult);
        if (seasonGoalResult.boardDelta) {
          deps.applyClubStatusDeltas(clubs[userClub], { board: seasonGoalResult.boardDelta });
          deps.renderEnvironmentCard();
        }
        deps.pushMessage({
          category: 'club',
          type: 'season-goal-result',
          title: 'AVALIAÇÃO DA META',
          body: `${seasonGoalResult.feeling}\nMeta: ${seasonGoalResult.label}`,
          round: currentRound,
          read: false,
        });
      }

      const seasonObjectives = deps.ensureSeasonObjectives();
      let seasonObjectivesResult = deps.getSeasonObjectivesResult();
      const objectivesNeedEvaluation =
        seasonObjectives?.length &&
        (!seasonObjectivesResult?.items?.length || Number(seasonObjectivesResult.rulesVersion) < 2);
      if (objectivesNeedEvaluation) {
        const previousBoardDelta = Number(seasonObjectivesResult?.boardDelta) || 0;
        seasonObjectivesResult = deps.evaluateSeasonObjectives(
          seasonObjectives,
          deps.buildSeasonObjectiveEvalContext(userClubState),
          userClubState,
        );
        deps.setSeasonObjectivesResult(seasonObjectivesResult);
        const boardDeltaAdjustment = (Number(seasonObjectivesResult?.boardDelta) || 0) - previousBoardDelta;
        if (boardDeltaAdjustment) {
          deps.applyClubStatusDeltas(clubs[userClub], { board: boardDeltaAdjustment });
          deps.renderEnvironmentCard();
        }
        deps.pushMessage({
          category: 'club',
          type: 'season-objectives-result',
          title: 'METAS COMPLEMENTARES',
          body: seasonObjectivesResult.body,
          round: currentRound,
          read: false,
        });
      }

      deps.pushSeasonEndBrief({ prizeTotal: prize.total, budgetAfter });
      seasonTransitionPrepared = true;
    } else if (prizeDelta <= 0) {
      budgetAfter = deps.getBalance(userClubState);
    }

    const leadersByDivision = {
      A: { scorers: deps.leadersFor('A', 'scorers'), assistants: deps.leadersFor('A', 'assists') },
      B: { scorers: deps.leadersFor('B', 'scorers'), assistants: deps.leadersFor('B', 'assists') },
      C: { scorers: deps.leadersFor('C', 'scorers'), assistants: deps.leadersFor('C', 'assists') },
      D: { scorers: deps.leadersFor('D', 'scorers'), assistants: deps.leadersFor('D', 'assists') },
      CUP: {
        scorers: deps.championshipLeadersFor('CUP', 'scorers'),
        assistants: deps.championshipLeadersFor('CUP', 'assists'),
      },
    };
    if (champions.WORLD_CUP && deps.worldCupLeadersFor) {
      leadersByDivision.WORLD_CUP = {
        scorers: deps.worldCupLeadersFor('scorers'),
        assistants: deps.worldCupLeadersFor('assists'),
      };
    }
    championEstaduais.forEach(item => {
      if (!item?.key || !deps.stateLeagueLeadersFor) return;
      leadersByDivision[item.key] = {
        scorers: deps.stateLeagueLeadersFor(item.uf, item.tier || 1, 'scorers'),
        assistants: deps.stateLeagueLeadersFor(item.uf, item.tier || 1, 'assists'),
      };
    });
    const movements = [
      { title: 'Série B → Série A', clubs: promB, type: 'promote' },
      { title: 'Série A → Série B', clubs: relA, type: 'relegate' },
      { title: 'Série C → Série B', clubs: promC, type: 'promote' },
      { title: 'Série B → Série C', clubs: relB, type: 'relegate' },
      { title: 'Série D → Série C', clubs: promD, type: 'promote' },
      { title: 'Série C → Série D', clubs: relC, type: 'relegate' },
    ];

    deps.archiveSeasonBalance({
      season: careerSeason,
      userClub,
      userDivision,
      userLine,
      userStatus,
      seasonGoal: deps.getSeasonGoal(),
      seasonGoalResult: deps.getSeasonGoalResult(),
      seasonObjectivesResult: deps.getSeasonObjectivesResult(),
      champions,
      movements,
      leadersByDivision,
    });
    deps.commitSeasonArchive?.({
      careerSeason,
      userClub,
      userDivision,
      champions,
      movements,
    });
    deps.persistSeason(true);
    deps.renderClubBudget();
    deps.openSeasonSummary({
      userClub,
      careerSeason,
      userLine,
      idleNote,
      userStatus,
      userDivision,
      champions,
      championEstaduais,
      recopaSubtitle,
      leadersByDivision,
      clubs,
      seasonRewards: {
        total: prize.total,
        lines: prize.lines,
        budgetAfter,
        prizeCredited: creditedSoFar + prizeDelta >= prize.total - 1,
      },
      formatBudget: deps.formatBudget,
      seasonGoalResult: deps.getSeasonGoalResult(),
      seasonObjectivesResult: deps.getSeasonObjectivesResult(),
      movements,
    });
  };

  const tryPrepareSeasonTransition = () => {
    if (!seasonReadyForTransition()) return false;
    prepareSeasonTransition();
    return true;
  };

  const finishStartNextSeason = async () => {
    const userClub = deps.getUserClub();
    const careerSeason = deps.getCareerSeason();
    const savedNewGame = deps.getSavedNewGame();
    const clubs = deps.getClubs();
    const youthSummary = await Promise.resolve(deps.runYouthSeasonTransition?.(clubs, {
      userClub,
      season: (savedNewGame.season || 2026) + 1,
      retiredPool: savedNewGame.retiredPool,
      division: deps.getUserDivision(),
      careerDate: deps.getCareerCalendarDate?.(),
      firstNames: deps.getFirstNames?.(),
      lastNames: deps.getLastNames?.(),
      userUf: savedNewGame.userUf,
    }));
    if (youthSummary?.reports > 0 && userClub) {
      deps.pushYouthReportsMessage?.(youthSummary);
    }
    deps.resetPlayerDevelopment((savedNewGame.season || 2026) + 1);

    const foundingClubName = savedNewGame.foundingClubName || savedNewGame.clubName || userClub;
    const careerClubHistory = [
      ...new Set(
        [...(Array.isArray(savedNewGame.careerClubHistory) ? savedNewGame.careerClubHistory : []), foundingClubName, userClub].filter(
          Boolean,
        ),
      ),
    ];

    const nextSave = {
      ...savedNewGame,
      division: pendingUserDivision,
      divisionTeams: pendingDivisionTeams,
      foundingClubName,
      careerClubHistory,
      userRoster: clubs[userClub].roster.map(player => ({
        ...player,
        fatigue: 100,
        injuryHistory: deps.pruneInjuryHistory(player.injuryHistory),
      })),
      worldRosters: deps.collectWorldRosters(clubs, {
        skipClub: userClub,
        merge: savedNewGame.worldRosters || {},
      }),
      clubStatus: {
        ...(deps.snapshotUserClubStatus() || savedNewGame.clubStatus || {}),
        budget: deps.getBalance(clubs[userClub]),
        bankLoan: deps.serializeBankLoan(clubs[userClub]),
      },
      nationalRanking: {
        formulaVersion: deps.getNationalRankingFormulaVersion(),
        entries: Object.fromEntries(
          Object.entries(deps.getNationalRankingEntries()).map(([name, entry]) => [
            name,
            { ...entry, titles: deps.pruneRankingTitles(entry.titles) },
          ]),
        ),
        finalizedSeasons: [...deps.getNationalRankingFinalizedSeasons()],
      },
      managerRanking: (() => {
        deps.syncManagerSeasonPoints();
        return deps.snapshotManagerRanking();
      })(),
      seasonGoal: null,
      seasonGoalResult: null,
      seasonObjectives: null,
      seasonObjectivesResult: null,
      season: (savedNewGame.season || 2026) + 1,
      priorSeasonChampions: savedNewGame.priorSeasonChampions || null,
      serieDFormation: pendingSerieDFormation,
      stateLeagueGuaranteed:
        pendingStateLeagueGuaranteed || savedNewGame.stateLeagueGuaranteed || {},
      stateLeagueMembership:
        pendingStateLeagueMembership || savedNewGame.stateLeagueMembership || {},
      stadiumName: clubs[userClub]?.stadiumName || savedNewGame.stadiumName || null,
      userStadium: deps.serializeUserStadium(clubs[userClub]),
      userClubInvestments: deps.serializeUserClubInvestments(clubs[userClub]),
      pendingSponsorChoice: true,
      retiredPool: savedNewGame.retiredPool || [],
      seasonIndex: Array.isArray(savedNewGame.seasonIndex) ? [...savedNewGame.seasonIndex] : [],
      createdAt: new Date().toISOString(),
      version: 4,
    };

    // Garante archive do ano que fecha antes de limpar a season viva.
    deps.commitSeasonArchive?.({
      careerSeason,
      userClub,
      userDivision: deps.getUserDivision(),
      champions: savedNewGame.priorSeasonChampions
        ? { A: savedNewGame.priorSeasonChampions.A, CUP: savedNewGame.priorSeasonChampions.CUP }
        : null,
    });
    if (Array.isArray(savedNewGame.seasonIndex)) {
      nextSave.seasonIndex = [...savedNewGame.seasonIndex];
    }

    deps.writeCareerSave(nextSave);
    deps.finalizePlayerHistorySeason(careerSeason, { nextSeason: (savedNewGame.season || 2026) + 1 });
    // Impede beforeunload / nuvem de reidratar a temporada antiga no reload da virada.
    deps.markSkipPersistOnce?.();
    deps.markFreshCareerBoot?.();
    deps.clearSeasonSave();
    pendingDivisionTeams = null;
    pendingSerieDFormation = null;
    pendingStateLeagueGuaranteed = null;
    pendingStateLeagueMembership = null;
    seasonTransitionPrepared = false;
    deps.closeSeasonSummary();
    deps.redirectGame();
    return true;
  };

  const startNextSeason = async () => {
    if (!pendingDivisionTeams || !deps.getSavedNewGame()) return false;
    if (deps.careerCrisisBlocks()) {
      deps.openCareerCrisisModal();
      return false;
    }

    const userClub = deps.getUserClub();
    const careerSeason = deps.getCareerSeason();
    const savedNewGame = deps.getSavedNewGame();
    const clubs = deps.getClubs();
    deps.setSkipPersistOnUnload(true);
    deps.pruneClubMemory(clubs, deps.getNationalRankingEntries());
    deps.advancePlayerAges(clubs);

    const retirement =
      deps.processSeasonRetirements?.(clubs, {
        season: careerSeason,
        userClub,
        retiredPool: savedNewGame.retiredPool || [],
        developmentState: deps.getPlayerDevelopmentState?.(),
        careerDate: deps.getCareerCalendarDate?.(),
        getSeasonMinutes: deps.getSeasonMinutes,
        markRetiredInHistory: deps.markRetiredInHistory,
      }) || { userDepartures: [], retired: [], pool: savedNewGame.retiredPool || [] };

    savedNewGame.retiredPool = retirement.pool;
    deps.syncRostersAfterRetirement?.();

    const userDepartures = retirement.userDepartures || [];
    const worldCount = Math.max(0, (retirement.retired?.length || 0) - userDepartures.length);

    if (userDepartures.length && deps.openRetirementModal) {
      return new Promise(resolve => {
        deps.openRetirementModal({
          season: careerSeason,
          departures: userDepartures,
          worldCount,
          continueFn: async () => {
            const ok = await finishStartNextSeason();
            resolve(ok);
          },
        });
      });
    }

    return finishStartNextSeason();
  };

  const simulateNonHumanSeasonRemainder = () => {
    if (nonHumanSimRunning) return;
    if (deps.isSponsorChoicePending()) {
      deps.openSponsorPickerIfPending();
      return;
    }
    if (deps.careerCrisisBlocks()) {
      deps.openCareerCrisisModal();
      return;
    }
    if (deps.seasonComplete()) {
      tryPrepareSeasonTransition();
      return;
    }
    if (!deps.isUserSeasonIdle()) return;

    nonHumanSimRunning = true;
    deps.openIdleSimOverlay();
    deps.setIdleSimStatus(`Rodada ${deps.getCurrentRound()} de ${deps.seasonMaxRound()}…`);
    deps.navigateDashboard();

    const maxRound = deps.seasonMaxRound();
    const step = () => {
      try {
        if (deps.careerCrisisBlocks()) {
          deps.closeIdleSimOverlay();
          nonHumanSimRunning = false;
          deps.persistSeason(true);
          deps.openCareerCrisisModal();
          return;
        }
        if (deps.getCurrentRound() > maxRound) {
          idleSeasonWasSimulated = true;
          deps.finalizeNationalRankingSeason();
          deps.persistSeason(true);
          deps.refreshSeasonPresentation();
          deps.closeIdleSimOverlay();
          nonHumanSimRunning = false;
          tryPrepareSeasonTransition();
          return;
        }
        deps.setIdleSimStatus(`Simulando rodada ${deps.getCurrentRound()} de ${maxRound}…`);
        const idleResult = deps.simulateIdleRound();
        if (idleResult?.sacked || deps.careerCrisisBlocks()) {
          deps.closeIdleSimOverlay();
          nonHumanSimRunning = false;
          deps.persistSeason(true);
          deps.openCareerCrisisModal();
          return;
        }
        // Série D (e outros): mata-mata pode nascer no meio do idle — volta o controle ao jogador.
        if (!deps.isUserSeasonIdle()) {
          deps.closeIdleSimOverlay();
          nonHumanSimRunning = false;
          deps.persistSeason(true);
          deps.refreshSeasonPresentation();
          deps.navigateDashboard();
          return;
        }
        if (idleResult?.finished || deps.getCurrentRound() > maxRound) {
          idleSeasonWasSimulated = true;
          deps.finalizeNationalRankingSeason();
          deps.persistSeason(true);
          deps.refreshSeasonPresentation();
          deps.closeIdleSimOverlay();
          nonHumanSimRunning = false;
          tryPrepareSeasonTransition();
          return;
        }
        setTimeout(step, 0);
      } catch (error) {
        console.error('Falha ao simular restante da temporada', {
          round: deps.getCurrentRound(),
          division: deps.getUserDivision(),
          cupPhase: deps.getCupCompetition()?.currentPhase,
          dKnockoutStages: Object.keys(deps.getDKnockout()?.stages || {}),
          error,
        });
        deps.closeIdleSimOverlay();
        nonHumanSimRunning = false;
        try {
          deps.persistSeason(true);
        } catch {
          /* quota / persist */
        }
        try {
          deps.refreshSeasonPresentation();
        } catch {
          /* UI */
        }
      }
    };
    setTimeout(step, 0);
  };

  return {
    getPendingDivisionTeams: () => pendingDivisionTeams,
    getPendingUserDivision: () => pendingUserDivision,
    isSeasonTransitionPrepared: () => seasonTransitionPrepared,
    isIdleSeasonWasSimulated: () => idleSeasonWasSimulated,
    isNonHumanSimRunning: () => nonHumanSimRunning,
    setPendingDivisionTeams: value => {
      pendingDivisionTeams = value;
    },
    setPendingUserDivision: value => {
      pendingUserDivision = value;
    },
    setSeasonTransitionPrepared: value => {
      seasonTransitionPrepared = !!value;
    },
    setIdleSeasonWasSimulated: value => {
      idleSeasonWasSimulated = !!value;
    },
    finishRemainingNationalRounds,
    seasonReadyForTransition,
    prepareSeasonTransition,
    tryPrepareSeasonTransition,
    startNextSeason,
    simulateNonHumanSeasonRemainder,
  };
}
