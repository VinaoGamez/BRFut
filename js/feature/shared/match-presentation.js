import { resolveNationalTeam } from '../../engine/national-teams.js';
import { WORLD_CUP_COMPETITION } from '../../engine/world-cup-calendar.js';
import { isKnockoutShootoutCompetition, serieDKnockoutPhaseLabel } from '../../engine/knockout-shootout.js';
import {
  isStateLeagueGame,
  stateLeaguePhaseLabel,
  stateLeagueRoundEmLabel,
  ufLabel,
} from '../../engine/state-league-format.js';
import { findSerieDGroupIndex } from '../../engine/serie-d-formation.js';

export const divisionDisplayName = division => {
  const map = { A: 'Série A', B: 'Série B', C: 'Série C', D: 'Série D' };
  return map[division] || `Série ${division || '—'}`;
};

export const serieDGroupLabel = groupIndex => (groupIndex >= 0 ? `Grupo A${groupIndex + 1}` : '');

export const joinMatchMeta = (...parts) => parts.filter(Boolean).join(' · ');

export const matchCompetitionRoundLabel = (game, userDivision, currentRound = 1, serieDGroupRounds = 10) => {
  if (!game) {
    return userDivision === 'D' ? `Rodada ${currentRound}` : `Rodada ${currentRound} de 38`;
  }
  if (game.competition === 'COPA DO BRASIL') {
    const parts = [game.phase, game.leg].filter(Boolean);
    return parts.join(' · ') || 'Copa do Brasil';
  }
  if (isStateLeagueGame(game)) {
    if (game.phase === 'semis') return 'Semifinal';
    if (game.phase === 'final') return 'Final';
    return `Rodada ${game.round || currentRound || 1}`;
  }
  if (isKnockoutShootoutCompetition(game)) {
    const parts = [serieDKnockoutPhaseLabel(game), game.leg].filter(Boolean);
    if (parts.length) return parts.join(' · ');
    return String(game.competition || '').includes('SÉRIE D') ? 'Eliminatórias' : 'Mata-mata';
  }
  const round = game.round || currentRound || 1;
  if (userDivision === 'D' && round <= serieDGroupRounds) return `Rodada ${round}`;
  return `Rodada ${round} de 38`;
};

export const isWorldCupFixture = game => game?.competition === WORLD_CUP_COMPETITION;

export const isSerieDEnrolledClub = (clubName, clubs, serieDGroups) => {
  const club = clubs?.[clubName];
  if (!club) return false;
  const division = club.division || 'A';
  if (division === 'REG' && findSerieDGroupIndex(clubName, serieDGroups) >= 0) return true;
  return division === 'D';
};

export const isSerieDGroupPhaseContext = (game, userDivision, serieDGroupRounds = 10) => {
  if (userDivision !== 'D') return false;
  if (game && isKnockoutShootoutCompetition(game)) return false;
  if (game && (game.round || 0) > serieDGroupRounds) return false;
  return true;
};

export const resolveClubDivision = (clubName, clubs, serieDGroups) => {
  const club = clubs?.[clubName];
  if (!club) return null;
  let division = club.division || 'A';
  if (division === 'REG' && findSerieDGroupIndex(clubName, serieDGroups) >= 0) division = 'D';
  return division;
};

export const resolveFixtureDivision = (game, fallbackDivision = null) => {
  if (!game || game.competition === 'COPA DO BRASIL' || isStateLeagueGame(game)) return null;
  const explicit = String(game._liveDivision || game.division || game.leagueDivision || '').toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(explicit)) return explicit;
  const competition = String(game.competition || '').toUpperCase();
  const match = competition.match(/S(?:É|E|Ã‰)RIE\s*([ABCD])/);
  if (match) return match[1];
  return ['A', 'B', 'C', 'D'].includes(fallbackDivision) ? fallbackDivision : null;
};

export const clubDivisionLabel = (clubName, clubs, serieDGroups) => {
  const division = resolveClubDivision(clubName, clubs, serieDGroups);
  return division ? divisionDisplayName(division) : '—';
};

export const formatClubPositionLabel = (
  pos,
  { game = null, teamName = null, clubs = null, serieDGroups = [], userDivision = 'A', serieDGroupRounds = 10 } = {},
) => {
  if (game?.competition === 'COPA DO BRASIL' && teamName) {
    return clubDivisionLabel(teamName, clubs, serieDGroups);
  }
  if (pos === '—' || pos == null) return '—';
  if (game && isStateLeagueGame(game) && game.phase === 'groups') {
    return `${pos}º no grupo`;
  }
  if (
    isSerieDGroupPhaseContext(game, userDivision, serieDGroupRounds)
    && teamName
    && isSerieDEnrolledClub(teamName, clubs, serieDGroups)
  ) {
    return `${pos}º no grupo`;
  }
  return `${pos}º colocado`;
};

export const clubStandingContext = (
  clubName,
  clubs,
  serieDGroups,
  game = null,
  userDivision = 'A',
  currentRound = 1,
  serieDGroupRounds = 10,
) => {
  const club = clubs?.[clubName];
  if (!club) {
    const nt = resolveNationalTeam(clubName);
    if (nt) return `Copa do Mundo · FIFA ${nt.fifaRank}º`;
    return '';
  }
  const division = resolveFixtureDivision(game, userDivision)
    || resolveClubDivision(clubName, clubs, serieDGroups)
    || 'A';
  const base = divisionDisplayName(division);
  let label = base;
  if (division === 'D') {
    const groupIndex = findSerieDGroupIndex(clubName, serieDGroups);
    const group = serieDGroupLabel(groupIndex);
    label = group ? `${base} · ${group}` : base;
  }
  if (game?.competition === 'COPA DO BRASIL') return '';
  if (game && isKnockoutShootoutCompetition(game)) return label;
  if (isStateLeagueGame(game)) {
    const tierSuffix = game.stateTier > 1 ? ` · Div. ${game.stateTier}` : '';
    const stateName = game.stateUf ? ufLabel(game.stateUf) : '';
    return joinMatchMeta(`Estadual · ${stateName}${tierSuffix}`, stateLeaguePhaseLabel(game));
  }
  return label;
};

export const matchCompetitionPhaseLabel = (
  game,
  userDivision,
  serieDGroups,
  { currentRound = 1, userSerieDGroupIndex = 0, serieDGroupRounds = 10 } = {},
) => {
  if (isWorldCupFixture(game)) {
    return joinMatchMeta('Copa do Mundo', game.phase || game.leg) || 'Copa do Mundo';
  }
  if (game?.competition === 'COPA DO BRASIL') {
    return joinMatchMeta(game.phase, game.leg) || 'Copa do Brasil';
  }
  if (isStateLeagueGame(game)) {
    return joinMatchMeta(stateLeaguePhaseLabel(game), matchCompetitionRoundLabel(game, userDivision, currentRound, serieDGroupRounds));
  }
  if (game && isKnockoutShootoutCompetition(game)) {
    const parts = [serieDKnockoutPhaseLabel(game), game.leg].filter(Boolean);
    if (parts.length) return parts.join(' · ');
    return String(game.competition || '').includes('SÉRIE D') ? 'Eliminatórias' : 'Mata-mata';
  }
  let phase = '';
  if (!game) {
    if (userDivision === 'D') {
      const group = serieDGroupLabel(userSerieDGroupIndex);
      phase = group ? `Fase de grupos · ${group}` : 'Fase de grupos';
    } else {
      phase = currentRound <= 19 ? '1º turno' : '2º turno';
    }
  } else if (userDivision === 'D' && (game.round || 0) <= serieDGroupRounds) {
    const groupIndex = findSerieDGroupIndex(game.home, serieDGroups);
    const awayIndex = findSerieDGroupIndex(game.away, serieDGroups);
    const resolvedIndex = groupIndex >= 0 && awayIndex >= 0 && groupIndex === awayIndex ? groupIndex : groupIndex >= 0 ? groupIndex : awayIndex;
    const group = serieDGroupLabel(resolvedIndex >= 0 ? resolvedIndex : userSerieDGroupIndex);
    phase = group ? `Fase de grupos · ${group}` : 'Fase de grupos';
  } else {
    const round = game.round || currentRound || 1;
    phase = round <= 19 ? '1º turno' : '2º turno';
  }
  return joinMatchMeta(phase, matchCompetitionRoundLabel(game, userDivision, currentRound, serieDGroupRounds));
};

/** Texto do `<em>` ao lado do título (rodada/fase) — espelha o card Próxima Partida. */
export const matchCompetitionRoundEmLabel = (game, userDivision, userSerieDGroupIndex = 0) => {
  if (!game) return '';
  if (isWorldCupFixture(game)) {
    return game.phase || game.leg || 'COPA DO MUNDO';
  }
  if (game.competition === 'COPA DO BRASIL') {
    return `${game.phase || 'COPA'} · ${game.leg || ''}`.replace(/\s·\s$/, '');
  }
  if (isStateLeagueGame(game)) {
    return stateLeagueRoundEmLabel(game);
  }
  if (isKnockoutShootoutCompetition(game)) {
    return joinMatchMeta(serieDKnockoutPhaseLabel(game), game.leg) || 'Eliminatórias';
  }
  const groupSuffix =
    userDivision === 'D' && !isKnockoutShootoutCompetition(game) ? ` · GRUPO A${userSerieDGroupIndex + 1}` : '';
  return `RODADA ${game.round || '—'}${groupSuffix}`;
};
