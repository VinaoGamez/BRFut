/**
 * Copa do Mundo — competição progressiva (grupos → mata-mata conforme resultados).
 */

import { prepareWorldCupEdition } from './world-cup-history.js';
import { buildWorldCupGroupFixtures, WORLD_CUP_COMPETITION } from './world-cup-calendar.js';
import { WORLD_CUP_WINDOW } from './season-calendar-mold.js';
import {
  computeAllGroupStandings,
  isGroupStageComplete,
} from './world-cup-standings.js';
import {
  buildKnockoutContext,
  buildKnockoutPhaseFixtures,
  isKnockoutStageComplete,
  loserFromGame,
  recordKnockoutResult,
  winnerFromGame,
} from './world-cup-bracket.js';
import { applyShootoutToDecidingGame } from './knockout-shootout.js';
import { simulateProbabilisticShootout } from './shootout-sim.js';

const KNOCKOUT_STAGE_ORDER = Object.freeze(['R32', 'R16', 'QF', 'SF', '3P', 'F']);

function cloneGame(game) {
  return {
    ...game,
    date: game.date ? new Date(game.date) : game.date,
  };
}

/** Simulação leve seleções — teamPower da edição (sem elenco de clubes). */
export function simulateNationalTeamMatch(homeCode, awayCode, teamStrength, random = Math.random) {
  const homeMeta = teamStrength?.[homeCode];
  const awayMeta = teamStrength?.[awayCode];
  const homePower = Number(homeMeta?.teamPower) || 85;
  const awayPower = Number(awayMeta?.teamPower) || 85;
  const diff = (homePower - awayPower) / 18;
  const lamH = Math.max(0.35, 1.25 + diff * 0.45 + 0.12);
  const lamA = Math.max(0.35, 1.25 - diff * 0.45);

  const sampleGoals = lambda => {
    let p = Math.exp(-lambda);
    let sum = p;
    const r = random();
    for (let k = 1; k <= 8; k += 1) {
      p = (p * lambda) / k;
      sum += p;
      if (r <= sum) return k;
    }
    return 8;
  };

  let homeGoals = sampleGoals(lamH);
  let awayGoals = sampleGoals(lamA);

  if (homeGoals === awayGoals && random() < 0.28) {
    homeGoals += random() < 0.5 + diff * 0.02 ? 1 : 0;
    if (homeGoals === awayGoals) awayGoals += random() < 0.5 ? 1 : 0;
  }

  return { homeGoals, awayGoals };
}

/** Prorrogação (~30') — menos gols que o tempo regulamentar. */
export function simulateNationalTeamExtraTime(homeCode, awayCode, teamStrength, random = Math.random) {
  const homeMeta = teamStrength?.[homeCode];
  const awayMeta = teamStrength?.[awayCode];
  const homePower = Number(homeMeta?.teamPower) || 85;
  const awayPower = Number(awayMeta?.teamPower) || 85;
  const diff = (homePower - awayPower) / 18;
  const lamH = Math.max(0.12, 0.42 + diff * 0.18);
  const lamA = Math.max(0.12, 0.42 - diff * 0.18);

  const sampleGoals = lambda => {
    let p = Math.exp(-lambda);
    let sum = p;
    const r = random();
    for (let k = 1; k <= 4; k += 1) {
      p = (p * lambda) / k;
      sum += p;
      if (r <= sum) return k;
    }
    return 4;
  };

  return { homeGoals: sampleGoals(lamH), awayGoals: sampleGoals(lamA) };
}

/**
 * Empate em mata-mata da CMU: prorrogação e, se precisar, pênaltis.
 * Também repara saves antigos que ficaram 0–0 sem vencedor.
 * @returns {boolean} houve resolução
 */
export function resolveWorldCupKnockoutIfDrawn(game, competition, random = Math.random) {
  if (!game?.knockout && !['R32', 'R16', 'QF', 'SF', '3P', 'F'].includes(game?.stage)) {
    return false;
  }
  if (game.homeGoals == null && !game.completed) return false;
  const hg = Number(game.homeGoals) || 0;
  const ag = Number(game.awayGoals) || 0;
  if (hg !== ag) return false;
  if (game.shootoutWinner || game.winnerCode) return false;

  const et = simulateNationalTeamExtraTime(
    game.homeCode,
    game.awayCode,
    competition?.teamStrength,
    random,
  );
  game.homeGoals = hg + et.homeGoals;
  game.awayGoals = ag + et.awayGoals;
  game.extraTimePlayed = true;
  if (et.homeGoals || et.awayGoals) {
    game.extraTimeScore = `${et.homeGoals}–${et.awayGoals}`;
  }
  game.completed = true;

  if (game.homeGoals !== game.awayGoals) {
    const winner = winnerFromGame(game);
    if (winner) {
      game.winnerCode = winner.code;
      game.winner = winner.name;
    }
    return true;
  }

  const shootout = simulateProbabilisticShootout([game.home, game.away], { random });
  let winnerName = shootout?.winner;
  if (!winnerName) {
    // Seed determinístico pode empatar todas as cobranças — não trava o chaveamento.
    winnerName = random() < 0.5 + ((Number(competition?.teamStrength?.[game.homeCode]?.teamPower) || 85) -
      (Number(competition?.teamStrength?.[game.awayCode]?.teamPower) || 85)) / 200
      ? game.home
      : game.away;
  }
  applyShootoutToDecidingGame(game, winnerName, shootout?.scores || { [game.home]: 0, [game.away]: 0 });
  if (!game.shootoutPenalties && !game.penalties) {
    game.shootoutPenalties = '0–0';
    game.penalties = '0–0';
  }
  game.winnerCode = winnerName === game.home ? game.homeCode : game.awayCode;
  game.winner = winnerName;
  return true;
}

export function createWorldCupCompetition({
  year,
  worldCupHistory = [],
  random = Math.random,
  saved = null,
}) {
  if (saved?.groupFixtures?.length) {
    return hydrateWorldCupCompetition(saved);
  }

  const edition = prepareWorldCupEdition(worldCupHistory, year, random);
  const groupFixtures = buildWorldCupGroupFixtures(year, worldCupHistory, random);

  return {
    year: Number(year),
    edition: edition.edition,
    teamStrength: edition.teamStrength,
    groupFixtures,
    knockoutFixtures: [],
    knockoutContext: null,
    groupStandings: null,
    phase: 'groups',
    knockoutStage: null,
    champion: null,
    bronze: null,
    knockoutGenerated: false,
  };
}

export function hydrateWorldCupCompetition(saved) {
  return {
    year: Number(saved.year),
    edition: saved.edition ?? null,
    teamStrength: saved.teamStrength || {},
    groupFixtures: (saved.groupFixtures || []).map(cloneGame),
    knockoutFixtures: (saved.knockoutFixtures || []).map(cloneGame),
    knockoutContext: saved.knockoutContext || null,
    groupStandings: saved.groupStandings || null,
    phase: saved.phase || 'groups',
    knockoutStage: saved.knockoutStage || null,
    champion: saved.champion || null,
    bronze: saved.bronze || null,
    knockoutGenerated: !!saved.knockoutGenerated,
  };
}

export function serializeWorldCupCompetition(competition) {
  if (!competition) return null;
  return {
    year: competition.year,
    edition: competition.edition,
    teamStrength: competition.teamStrength,
    groupFixtures: competition.groupFixtures,
    knockoutFixtures: competition.knockoutFixtures,
    knockoutContext: competition.knockoutContext,
    groupStandings: competition.groupStandings,
    phase: competition.phase,
    knockoutStage: competition.knockoutStage,
    champion: competition.champion,
    bronze: competition.bronze,
    knockoutGenerated: competition.knockoutGenerated,
  };
}

export function getWorldCupAllFixtures(competition) {
  if (!competition) return [];
  return [...competition.groupFixtures, ...competition.knockoutFixtures];
}

/**
 * Resolve o campeão mesmo antes do próximo avanço de calendário promover
 * o resultado da final para `competition.champion`.
 */
export function resolveWorldCupChampionCode(competition) {
  if (competition?.champion) return competition.champion;
  const finalGame = competition?.knockoutFixtures?.find(game => game?.id === 'F');
  if (!finalGame || (!finalGame.completed && finalGame.homeGoals == null)) return null;
  return finalGame.winnerCode || winnerFromGame(finalGame)?.code || null;
}

function applySimResult(game, result, competition, random) {
  game.homeGoals = result.homeGoals;
  game.awayGoals = result.awayGoals;
  game.completed = true;
  if (game.knockout) {
    resolveWorldCupKnockoutIfDrawn(game, competition, random);
    const winner = winnerFromGame(game);
    const loser = loserFromGame(game, winner);
    if (winner) {
      game.winnerCode = winner.code;
      game.winner = winner.name;
    }
    return { winner, loser };
  }
  return null;
}

function tryGenerateKnockout(competition, random) {
  if (competition.knockoutGenerated) return false;
  if (!isGroupStageComplete(competition.groupFixtures)) return false;

  competition.groupStandings = computeAllGroupStandings(competition.groupFixtures, random);
  competition.knockoutContext = buildKnockoutContext(competition.groupStandings, random);
  const startNum = Math.max(0, ...competition.groupFixtures.map(g => g.gameNumber || 0)) + 1;
  const r32 = buildKnockoutPhaseFixtures(competition.year, 'R32', competition.knockoutContext, startNum);
  if (!r32.length) return false;

  competition.knockoutFixtures.push(...r32);
  competition.knockoutGenerated = true;
  competition.phase = 'knockout';
  competition.knockoutStage = 'R32';
  return true;
}

function syncKnockoutResults(competition) {
  if (!competition.knockoutContext) return;
  for (const game of competition.knockoutFixtures) {
    if (!game.completed && game.homeGoals == null) continue;
    const winner = winnerFromGame(game);
    const loser = loserFromGame(game, winner);
    if (winner) recordKnockoutResult(competition.knockoutContext, game.id, winner, loser);
  }
}

function tryAdvanceKnockoutStage(competition) {
  if (!competition.knockoutGenerated || !competition.knockoutContext) return false;

  syncKnockoutResults(competition);
  const current = competition.knockoutStage;
  if (!current || !isKnockoutStageComplete(competition.knockoutFixtures, current)) return false;

  if (current === 'F') {
    const finalGame = competition.knockoutFixtures.find(g => g.id === 'F');
    const winner = finalGame ? winnerFromGame(finalGame) : null;
    competition.champion = winner?.code || null;
    competition.phase = 'complete';
    return true;
  }

  if (current === '3P') {
    const bronzeGame = competition.knockoutFixtures.find(g => g.id === '3P');
    const bronzeWinner = bronzeGame ? winnerFromGame(bronzeGame) : null;
    competition.bronze = bronzeWinner?.code || null;
    if (isKnockoutStageComplete(competition.knockoutFixtures, 'F')) {
      competition.knockoutStage = 'F';
      return true;
    }
    competition.knockoutStage = 'F';
    return false;
  }

  const idx = KNOCKOUT_STAGE_ORDER.indexOf(current);
  const nextStage = KNOCKOUT_STAGE_ORDER[idx + 1];
  if (!nextStage) return false;

  if (competition.knockoutFixtures.some(g => g.stage === nextStage)) {
    competition.knockoutStage = nextStage;
    return true;
  }

  const startNum = Math.max(0, ...getWorldCupAllFixtures(competition).map(g => g.gameNumber || 0)) + 1;

  if (current === 'SF') {
    const thirdFixtures = buildKnockoutPhaseFixtures(
      competition.year,
      '3P',
      competition.knockoutContext,
      startNum,
    );
    const finalFixtures = buildKnockoutPhaseFixtures(
      competition.year,
      'F',
      competition.knockoutContext,
      startNum + thirdFixtures.length,
    );
    competition.knockoutFixtures.push(...thirdFixtures, ...finalFixtures);
    competition.knockoutStage = '3P';
    return true;
  }

  const nextFixtures = buildKnockoutPhaseFixtures(
    competition.year,
    nextStage,
    competition.knockoutContext,
    startNum,
  );
  if (!nextFixtures.length) return false;

  competition.knockoutFixtures.push(...nextFixtures);
  competition.knockoutStage = nextStage;
  return true;
}

export function worldCupWindowEndDate(year) {
  const y = Number(year);
  const [month, day] = WORLD_CUP_WINDOW.end;
  return new Date(y, month, day, 12, 0, 0, 0);
}

export function worldCupWindowStartDate(year) {
  const y = Number(year);
  const [month, day] = WORLD_CUP_WINDOW.start;
  return new Date(y, month, day, 12, 0, 0, 0);
}

/**
 * CMU sem seleção do usuário — simula jogos até a data atual do calendário.
 * Se o calendário já passou da janela (19/jul) e a Copa não fechou, completa o restante.
 */
export function advanceWorldCupSpectatorThroughWindow(competition, careerDate, year, options = {}) {
  if (!competition || competition.phase === 'complete') return false;
  const date = careerDate instanceof Date ? careerDate : new Date(careerDate);
  if (Number.isNaN(date.getTime())) return false;
  const windowStart = worldCupWindowStartDate(year);
  if (date.getTime() < windowStart.getTime()) return false;

  let changed = advanceWorldCupThroughDate(competition, date, {
    ...options,
    isUserTeam: () => false,
  });

  const windowEnd = worldCupWindowEndDate(year);
  if (competition.phase !== 'complete' && date.getTime() > windowEnd.getTime()) {
    changed =
      advanceWorldCupThroughDate(competition, date, {
        ...options,
        isUserTeam: () => false,
      }) || changed;
  }

  return changed;
}

/**
 * Simula jogos da CMU até a data (CPU). Gera mata-mata quando grupos encerram.
 * Quando o calendário já passou das datas, faz catch-up de várias fases na mesma chamada
 * (simula → avança chaveamento → simula de novo) até estabilizar ou bloquear em jogo do usuário.
 * @returns {boolean} houve mudança
 */
export function advanceWorldCupThroughDate(competition, date, {
  random = Math.random,
  isUserTeam = () => false,
  simulate = simulateNationalTeamMatch,
} = {}) {
  if (!competition || competition.phase === 'complete') return false;
  const cutoff = date?.getTime?.() ?? 0;
  if (!cutoff) return false;

  let changed = false;

  for (const game of competition.groupFixtures) {
    if (game.completed || game.homeGoals != null) continue;
    if (isUserTeam(game)) continue;
    const when = new Date(game.date).getTime();
    if (when > cutoff) continue;
    const result = simulate(game.homeCode, game.awayCode, competition.teamStrength, random);
    applySimResult(game, result, competition, random);
    changed = true;
  }

  if (tryGenerateKnockout(competition, random)) changed = true;

  // Catch-up: calendário à frente da Copa — várias fases numa passagem.
  let guard = 0;
  while (competition.phase !== 'complete' && guard < 24) {
    guard += 1;
    let passChanged = false;

    for (const game of competition.knockoutFixtures) {
      if (game.homeGoals == null && !game.completed) continue;
      if (!resolveWorldCupKnockoutIfDrawn(game, competition, random)) continue;
      const winner = winnerFromGame(game);
      const loser = loserFromGame(game, winner);
      if (winner && competition.knockoutContext) {
        recordKnockoutResult(competition.knockoutContext, game.id, winner, loser);
      }
      passChanged = true;
    }

    for (const game of competition.knockoutFixtures) {
      if (game.completed || game.homeGoals != null) continue;
      if (isUserTeam(game)) continue;
      const when = new Date(game.date).getTime();
      if (when > cutoff) continue;
      const result = simulate(game.homeCode, game.awayCode, competition.teamStrength, random);
      const ko = applySimResult(game, result, competition, random);
      if (ko?.winner) recordKnockoutResult(competition.knockoutContext, game.id, ko.winner, ko.loser);
      passChanged = true;
    }

    if (tryAdvanceKnockoutStage(competition)) passChanged = true;

    if (!passChanged) break;
    changed = true;
  }

  if (competition.phase !== 'groups' && !competition.groupStandings) {
    competition.groupStandings = computeAllGroupStandings(competition.groupFixtures, random);
  }

  return changed;
}

/**
 * Próximo jogo do usuário na CMU ainda pendente (grupos ou mata-mata).
 * Usado para rebobinar o calendário se a data da carreira passou do jogo.
 */
export function earliestPendingWorldCupUserFixture(competition, isUserTeam = () => false) {
  if (!competition) return null;
  const pending = getWorldCupAllFixtures(competition).filter(
    game =>
      isUserTeam(game) &&
      !game.completed &&
      game.homeGoals == null &&
      game.date,
  );
  if (!pending.length) return null;
  pending.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return pending[0];
}

export function isWorldCupUserFixture(game, userNationalTeamName) {
  if (!game || game.competition !== WORLD_CUP_COMPETITION || !userNationalTeamName) return false;
  return game.home === userNationalTeamName || game.away === userNationalTeamName;
}

export function worldCupCalendarSummary(competition) {
  if (!competition) return { groupCount: 0, knockoutCount: 0, totalScheduled: 0 };
  const groupCount = competition.groupFixtures.length;
  const knockoutCount = competition.knockoutFixtures.length;
  return {
    groupCount,
    knockoutCount,
    totalScheduled: groupCount + knockoutCount,
    phase: competition.phase,
    knockoutGenerated: competition.knockoutGenerated,
  };
}
