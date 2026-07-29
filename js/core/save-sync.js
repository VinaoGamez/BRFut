import { SAVE_KEYS } from './constants.js';
import { parseSavedCalendarDate } from '../engine/career-calendar.js';
import { isLocalStorageCheckpoint } from './local-save-checkpoint.js';

export { isLocalStorageCheckpoint };

/** Timestamp comparável para resolver conflito local vs nuvem. */
export function saveFreshness(value, key = '') {
  if (!value || typeof value !== 'object') return 0;
  const ts = Date.parse(value.updatedAt || value.savedAt || value.createdAt || '');
  if (Number.isFinite(ts) && ts > 0) return ts;
  if (key === SAVE_KEYS.season) {
    const calTs = seasonCalendarTs(value);
    if (calTs > 0) return calTs;
    const round = Number(value.currentRound);
    if (Number.isFinite(round) && round > 0) return round * 86_400_000;
  }
  return 0;
}

function seasonCalendarTs(value) {
  const date = parseSavedCalendarDate(value?.careerCalendarDate, null);
  return date ? date.getTime() : 0;
}

function seasonFromStateLeagues(stateLeagues) {
  return stateLeagues ? { stateLeagues } : null;
}

/** Maior rodada estadual concluída ou currentRound da divisão — progresso real da carreira. */
export function maxStateLeagueRound(season) {
  if (!season?.stateLeagues?.competitions) return Number(season?.stateLeagueProgressRound) || 0;
  let max = Number(season.stateLeagueProgressRound) || 0;
  Object.values(season.stateLeagues.competitions).forEach(divisions => {
    (divisions || []).forEach(division => {
      const cr = Number(division.currentRound) || 0;
      if (cr > max) max = cr;
      (division.fixtures || []).forEach((round, roundIndex) => {
        const roundNo = Number(round?.[0]?.round) || roundIndex + 1;
        (round || []).forEach(game => {
          const played = !!(game?.completed || game?.played || game?.homeGoals != null);
          if (played) max = Math.max(max, Number(game.round) || roundNo);
        });
        const hasOpen = (round || []).some(
          game => game && !game.completed && game.homeGoals == null && game.awayGoals == null,
        );
        if (hasOpen) max = Math.max(max, roundNo - 1);
      });
    });
  });
  return max;
}

export function stateLeagueFixtureRounds(stateLeagues) {
  if (!stateLeagues?.competitions) return 0;
  let rounds = 0;
  Object.values(stateLeagues.competitions).forEach(divisions => {
    (divisions || []).forEach(division => {
      rounds = Math.max(rounds, (division.fixtures || []).length);
    });
  });
  return rounds;
}

/** Save estadual utilizável no boot (não vazio / não só checkpoint quebrado). */
export function hasUsableStateLeagueSave(stateLeagues) {
  if (!stateLeagues?.competitions) return false;
  return Object.values(stateLeagues.competitions).some(
    divisions =>
      Array.isArray(divisions) &&
      divisions.some(division => Array.isArray(division.fixtures) && division.fixtures.length > 0),
  );
}

export function pickRicherStateLeagues(localStateLeagues, remoteStateLeagues) {
  const localRounds = stateLeagueFixtureRounds(localStateLeagues);
  const remoteRounds = stateLeagueFixtureRounds(remoteStateLeagues);
  const localProgress = maxStateLeagueRound(seasonFromStateLeagues(localStateLeagues));
  const remoteProgress = maxStateLeagueRound(seasonFromStateLeagues(remoteStateLeagues));

  if (localRounds !== remoteRounds) {
    return localRounds > remoteRounds ? localStateLeagues : remoteStateLeagues;
  }
  if (localProgress !== remoteProgress) {
    return localProgress > remoteProgress ? localStateLeagues : remoteStateLeagues;
  }
  if (hasUsableStateLeagueSave(localStateLeagues)) return localStateLeagues;
  if (hasUsableStateLeagueSave(remoteStateLeagues)) return remoteStateLeagues;
  return localStateLeagues || remoteStateLeagues || null;
}

function seasonPayloadWeight(value) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

function pickNewerSeasonSave(localValue, remoteValue) {
  const localCal = seasonCalendarTs(localValue);
  const remoteCal = seasonCalendarTs(remoteValue);
  if (localCal !== remoteCal) {
    return localCal > remoteCal ? localValue : remoteValue;
  }
  const localState = maxStateLeagueRound(localValue);
  const remoteState = maxStateLeagueRound(remoteValue);
  if (localState !== remoteState) {
    return localState > remoteState ? localValue : remoteValue;
  }
  const localRound = Number(localValue.currentRound) || 0;
  const remoteRound = Number(remoteValue.currentRound) || 0;
  if (localRound !== remoteRound) {
    return localRound > remoteRound ? localValue : remoteValue;
  }
  const localWeight = seasonPayloadWeight(localValue);
  const remoteWeight = seasonPayloadWeight(remoteValue);
  if (localWeight > remoteWeight + 4096) return localValue;
  if (remoteWeight > localWeight + 4096) return remoteValue;
  return null;
}

/**
 * Progresso jogável: true se `candidate` está à frente de `baseline`
 * (rodada/calendário/peso — não só updatedAt da nuvem).
 */
export function isSaveProgressAhead(candidate, baseline, key = '') {
  if (!candidate) return false;
  if (!baseline) return true;
  if (key === SAVE_KEYS.season) {
    const winner = pickNewerSeasonSave(candidate, baseline);
    if (winner === candidate) return true;
    if (winner === baseline) return false;
    return saveFreshness(candidate, key) > saveFreshness(baseline, key);
  }
  if (key === SAVE_KEYS.career) {
    if (!isSlimCareerCheckpoint(candidate) && isSlimCareerCheckpoint(baseline)) return true;
    if (isSlimCareerCheckpoint(candidate) && !isSlimCareerCheckpoint(baseline)) return false;
    const cw = careerPayloadWeight(candidate);
    const bw = careerPayloadWeight(baseline);
    if (cw > bw + 4096) return true;
    if (bw > cw + 4096) return false;
  }
  return saveFreshness(candidate, key) > saveFreshness(baseline, key);
}

/**
 * Combina temporada local + nuvem sem perder progresso estadual.
 * Local é fonte de verdade quando empate; nuvem só atualiza campos mais novos.
 */
export function mergeSeasonSaves(localValue, remoteValue, remoteEnvelopeAt = 0) {
  if (!localValue) return remoteValue ?? null;
  if (!remoteValue) return localValue;
  // Checkpoint local só cede à nuvem se o remoto não estiver atrás do progresso local.
  if (isLocalStorageCheckpoint(localValue) && remoteValue) {
    if (isSaveProgressAhead(localValue, remoteValue, SAVE_KEYS.season)) return localValue;
    return { ...remoteValue };
  }
  if (isLocalStorageCheckpoint(remoteValue) && localValue) return { ...localValue };

  const winner = pickNewerSave(localValue, remoteValue, SAVE_KEYS.season, remoteEnvelopeAt);
  const merged = { ...winner };

  const richerStateLeagues = pickRicherStateLeagues(localValue.stateLeagues, remoteValue.stateLeagues);
  if (richerStateLeagues) merged.stateLeagues = richerStateLeagues;

  merged.stateLeagueProgressRound = Math.max(
    maxStateLeagueRound(localValue),
    maxStateLeagueRound(remoteValue),
    Number(localValue.stateLeagueProgressRound) || 0,
    Number(remoteValue.stateLeagueProgressRound) || 0,
  );

  merged.careerCalendarDate =
    seasonCalendarTs(remoteValue) >= seasonCalendarTs(localValue)
      ? remoteValue.careerCalendarDate || localValue.careerCalendarDate
      : localValue.careerCalendarDate || remoteValue.careerCalendarDate;

  merged.currentRound = Math.max(
    Number(localValue.currentRound) || 0,
    Number(remoteValue.currentRound) || 0,
    Number(winner.currentRound) || 0,
  );

  if (!merged.fatigue || !Object.keys(merged.fatigue).length) {
    merged.fatigue = localValue.fatigue || remoteValue.fatigue;
  }
  if (!Array.isArray(merged.careerMessages) || !merged.careerMessages.length) {
    merged.careerMessages = localValue.careerMessages?.length
      ? localValue.careerMessages
      : remoteValue.careerMessages;
  }

  const localCup = localValue.cupCompetition;
  const remoteCup = remoteValue.cupCompetition;
  const localCupFixtures = cupFixtureCount(localCup);
  const remoteCupFixtures = cupFixtureCount(remoteCup);
  if (remoteCupFixtures > localCupFixtures) merged.cupCompetition = remoteCup;
  else if (localCupFixtures > 0) merged.cupCompetition = localCup;
  else if (remoteCup) merged.cupCompetition = remoteCup;

  const localScorers = Array.isArray(localValue.scorers) ? localValue.scorers : [];
  const remoteScorers = Array.isArray(remoteValue.scorers) ? remoteValue.scorers : [];
  merged.scorers = remoteScorers.length > localScorers.length ? remoteScorers : localScorers.length ? localScorers : remoteScorers;
  const localAssists = Array.isArray(localValue.assistants) ? localValue.assistants : [];
  const remoteAssists = Array.isArray(remoteValue.assistants) ? remoteValue.assistants : [];
  merged.assistants =
    remoteAssists.length > localAssists.length ? remoteAssists : localAssists.length ? localAssists : remoteAssists;

  return merged;
}

function cupFixtureCount(cup) {
  if (!cup || typeof cup !== 'object') return 0;
  return (cup.stages || []).reduce(
    (sum, stage) => sum + (Array.isArray(stage?.fixtures) ? stage.fixtures.length : 0),
    0,
  );
}

export function careerPayloadWeight(career) {
  if (!career || typeof career !== 'object') return 0;
  try {
    return JSON.stringify(career).length;
  } catch {
    return 0;
  }
}

/** Checkpoint de nuvem — identidade sem pirâmide/elencos completos. */
export function isSlimCareerCheckpoint(career) {
  if (!career || typeof career !== 'object') return true;
  const hasPyramid =
    career.divisionTeams &&
    typeof career.divisionTeams === 'object' &&
    Object.values(career.divisionTeams).some(list => Array.isArray(list) && list.length > 0);
  const hasWorldRosters =
    career.worldRosters &&
    typeof career.worldRosters === 'object' &&
    Object.keys(career.worldRosters).length > 0;
  const hasRoster = Array.isArray(career.userRoster) && career.userRoster.length >= 18;
  return !hasPyramid && !hasWorldRosters && !hasRoster;
}

/** Combina carreira local + nuvem — nunca substituir save completo por checkpoint slim. */
export function mergeCareerSaves(localValue, remoteValue, remoteEnvelopeAt = 0) {
  if (!localValue) return remoteValue ?? null;
  if (!remoteValue) return localValue;
  if (isLocalStorageCheckpoint(localValue) && remoteValue) {
    // Stub de carreira: hidrata com pirâmide completa da nuvem (progresso está na season).
    if (!isSlimCareerCheckpoint(remoteValue)) return { ...remoteValue };
    if (isSaveProgressAhead(localValue, remoteValue, SAVE_KEYS.career)) return localValue;
    return { ...remoteValue };
  }
  if (isLocalStorageCheckpoint(remoteValue) && localValue) return { ...localValue };

  if (localValue.freshWorld) return localValue;

  const localSlim = isSlimCareerCheckpoint(localValue);
  const remoteSlim = isSlimCareerCheckpoint(remoteValue);
  if (!localSlim && remoteSlim) return localValue;
  if (localSlim && !remoteSlim) return remoteValue;

  const localWeight = careerPayloadWeight(localValue);
  const remoteWeight = careerPayloadWeight(remoteValue);
  if (localWeight > remoteWeight + 4096) return localValue;
  if (remoteWeight > localWeight + 4096) return remoteValue;

  if (localValue.seed !== remoteValue.seed) {
    if (!localSlim) return localValue;
    return pickNewerSave(localValue, remoteValue, SAVE_KEYS.career, remoteEnvelopeAt);
  }

  return pickNewerSave(localValue, remoteValue, SAVE_KEYS.career, remoteEnvelopeAt);
}

export function pickNewerSave(localValue, remoteValue, key, remoteEnvelopeAt = 0) {
  if (!localValue) return remoteValue ?? null;
  if (!remoteValue) return localValue;
  if (isLocalStorageCheckpoint(localValue) && remoteValue) {
    // Stub local: season usa progresso (rodada/calendário); career hidrata se remoto for completo.
    if (key === SAVE_KEYS.career && !isSlimCareerCheckpoint(remoteValue)) return remoteValue;
    if (isSaveProgressAhead(localValue, remoteValue, key)) return localValue;
    return remoteValue;
  }
  if (isLocalStorageCheckpoint(remoteValue) && localValue) return localValue;

  if (key === SAVE_KEYS.season) {
    const seasonWinner = pickNewerSeasonSave(localValue, remoteValue);
    if (seasonWinner) return seasonWinner;
  }

  const localScore = saveFreshness(localValue, key);
  const remoteValueScore = saveFreshness(remoteValue, key);
  const remoteScore = Math.max(remoteValueScore, Number(remoteEnvelopeAt) || 0);

  if (key === SAVE_KEYS.season) {
    const localState = maxStateLeagueRound(localValue);
    const remoteState = maxStateLeagueRound(remoteValue);
    if (localState > remoteState) return localValue;
    if (remoteState > localState) return remoteValue;
    if (seasonPayloadWeight(localValue) > seasonPayloadWeight(remoteValue) + 4096) return localValue;
    // Empate: local vence — navegador é fonte de verdade da sessão ativa.
    return localValue;
  }

  if (remoteScore > localScore && remoteValueScore < localScore) return localValue;
  if (remoteScore > localScore) return remoteValue;
  return localValue;
}

export function stampSyncableSave(key, value) {
  if (key !== SAVE_KEYS.career && key !== SAVE_KEYS.season) return value;
  if (!value || typeof value !== 'object') return value;
  const next = { ...value, updatedAt: new Date().toISOString() };
  if (key === SAVE_KEYS.season) {
    next.stateLeagueProgressRound = Math.max(
      Number(next.stateLeagueProgressRound) || 0,
      maxStateLeagueRound(next),
    );
  }
  return next;
}
