/**

 * Formato padrão dos campeonatos estaduais — pontos corridos + semi + final.

 * UFs com >10 clubes geram Divisão 1 / Divisão 2 (cada uma com o mesmo formato).

 */



import { BRAZILIAN_UFS, getAllRealClubs, getRealClub } from './brazilian-clubs-by-uf.js';

import { buildBrazilianLeagueFixtures } from './league-fixtures.js';

import { FUTURE_COMPETITION_MOLD } from './season-calendar-mold.js';

import { listSlotDatesInRange, WEEKDAY } from './season-week-slots.js';
import { parseCalendarDate } from './season-scheduler.js';
import { splitStateDivisions, pickLotteryTeams, createLotteryPicker, rostersToDivisions, STATE_LEAGUE_VISIBLE_TIERS, divisionTargetSize, isValidDivisionSize, filterValidMembershipByUf } from './state-league-divisions.js';

export { splitStateDivisions, STATE_LEAGUE_VISIBLE_TIERS, collectPhaseAdvancers, extractGuaranteedTier4ByUf, divisionTargetSize, isValidDivisionSize, competitionsNeedRepair, sanitizeCompetitionsByUf, filterValidMembershipByUf } from './state-league-divisions.js';



export const STATE_LEAGUE_COMPETITION = 'ESTADUAL';

export const STATE_LEAGUE_MIN_CLUBS = 4;

export const STATE_LEAGUE_MAX_PER_DIVISION = 10;

export const STATE_LEAGUE_KNOCKOUT_SPOTS = 4;

/** Janela CBF: N-1 rodadas de liguista + semi + final. */

export const STATE_LEAGUE_CALENDAR_SLOTS = 11;

export const STATE_LEAGUE_FIRST_SERIE_D_SEASON = 2027;

/** Paulista (SP): 2 grupos × 9, top 4 por grupo → quartas, semi, final. */
export const PAULISTA_UF = 'SP';
export const PAULISTA_DIVISION_SIZE = 18;
export const PAULISTA_GROUP_SIZE = 9;
export const PAULISTA_GROUPS = 2;
export const PAULISTA_ADVANCE_PER_GROUP = 4;

export function isPaulistaFormat(competition) {
  return (
    competition?.format === 'paulista' ||
    (String(competition?.uf || '').toUpperCase() === PAULISTA_UF &&
      Array.isArray(competition?.groups) &&
      competition.groups.length === PAULISTA_GROUPS &&
      (competition?.teams?.length || 0) === PAULISTA_DIVISION_SIZE)
  );
}



/** @deprecated Grupos removidos — mantido só para saves antigos. */

export const STATE_LEAGUE_GROUP_COUNT = 2;

/** @deprecated Use STATE_LEAGUE_KNOCKOUT_SPOTS. */

export const STATE_LEAGUE_ADVANCE_PER_GROUP = 2;



const DIVISION_RANK = Object.freeze({ A: 0, B: 1, C: 2, D: 3, REG: 4 });



export function stateLeagueAffectsSerieD(season) {

  return Number(season) >= STATE_LEAGUE_FIRST_SERIE_D_SEASON;

}



export function stateCompetitionKey(uf, tier = 1) {

  return `EST:${String(uf || '').toUpperCase()}:${tier}`;

}



export function parseStateCompetitionKey(key) {

  const match = String(key || '').match(/^EST:([A-Z]{2}):(\d+)$/);

  if (!match) return null;

  return { uf: match[1], tier: Number(match[2]) || 1 };

}



export function ufLabel(ufCode) {

  return BRAZILIAN_UFS.find(item => item.code === ufCode)?.name || ufCode;

}



export function stateLeagueLabel(ufCode, tier = 1, tierCount = 1) {

  const name = ufLabel(ufCode);

  if (tierCount <= 1) return `Campeonato ${name}`;

  return `Campeonato ${name} · Divisão ${tier}`;

}



function clubPrestige(name, clubs = {}) {

  const club = clubs[name];

  const meta = getRealClub(name);

  const division = club?.division || meta?.division || 'REG';

  const rank = DIVISION_RANK[division] ?? 9;

  const power = Number(club?.power) || 0;

  return { rank, power, name };

}



export function sortClubsByPrestige(names, clubs = {}) {

  return [...names].sort((a, b) => {

    const pa = clubPrestige(a, clubs);

    const pb = clubPrestige(b, clubs);

    return pa.rank - pb.rank || pb.power - pa.power || pa.name.localeCompare(pb.name, 'pt-BR');

  });

}



/** Contagem de clubes por UF no registry + import Brasfoot + mundo atual. */

export function auditUfClubCounts({ clubs = {}, regionalBaseClubs = [], importClubs = [] } = {}) {

  const counts = Object.fromEntries(BRAZILIAN_UFS.map(item => [item.code, 0]));

  const namesByUf = Object.fromEntries(BRAZILIAN_UFS.map(item => [item.code, new Set()]));



  const register = (name, uf) => {

    if (!name || !uf || !Object.prototype.hasOwnProperty.call(counts, uf)) return;

    namesByUf[uf].add(name);

    counts[uf] = namesByUf[uf].size;

  };



  getAllRealClubs().forEach(club => register(club.name, club.uf));

  (importClubs || [])

    .filter(club => club?.country === 'BRA' && club?.name && club?.uf)

    .forEach(club => register(club.name, String(club.uf).toUpperCase()));

  Object.entries(clubs).forEach(([name, club]) => register(name, club.uf || getRealClub(name)?.uf));

  (regionalBaseClubs || []).forEach(name => {

    const uf = getRealClub(name)?.uf || clubs[name]?.uf;

    if (uf) register(name, uf);

  });



  return BRAZILIAN_UFS.map(item => ({

    uf: item.code,

    name: item.name,

    count: counts[item.code] || 0,

    belowMinimum: (counts[item.code] || 0) < STATE_LEAGUE_MIN_CLUBS,

    needsSplit:
      (counts[item.code] || 0) >
      (item.code === PAULISTA_UF
        ? PAULISTA_DIVISION_SIZE + STATE_LEAGUE_MAX_PER_DIVISION * 2
        : STATE_LEAGUE_MAX_PER_DIVISION * 4),

  }));

}



export function collectParticipantsForUf(

  uf,

  { clubs = {}, regionalBaseClubs = [], importClubs = [], userClub = null, userUf = null } = {},

) {

  const code = String(uf || '').toUpperCase();

  const names = new Set();

  getAllRealClubs()

    .filter(club => club.uf === code)

    .forEach(club => names.add(club.name));

  (importClubs || [])

    .filter(club => club?.country === 'BRA' && String(club.uf).toUpperCase() === code && club?.name)

    .forEach(club => names.add(club.name));

  Object.entries(clubs).forEach(([name, club]) => {

    if ((club?.uf || getRealClub(name)?.uf) === code) names.add(name);

  });

  (regionalBaseClubs || []).forEach(name => {

    if ((getRealClub(name)?.uf || clubs[name]?.uf) === code) names.add(name);

  });

  const originCode = String(userUf || clubs[userClub]?.uf || getRealClub(userClub)?.uf || '').toUpperCase();

  if (userClub && originCode === code) names.add(userClub);

  return sortClubsByPrestige([...names], clubs);

}



function singleRoundRobin(clubs) {

  const teamCount = clubs.length;

  if (teamCount < 2) return [];

  const list = [...clubs];

  const targetRounds = teamCount - 1;

  if (list.length % 2 !== 0) list.push(null);

  const full = buildBrazilianLeagueFixtures(list, {

    balanceHomeAway: true,

    maxHomeAwayStreak: 2,

    balanceScope: 'first-leg-only',

  });

  const firstLeg = full.slice(0, Math.max(1, Math.floor(full.length / 2)));

  return firstLeg

    .map(round => (round || []).filter(game => game?.home && game?.away))

    .slice(0, targetRounds);

}



function emptyStanding(club) {

  return { club, played: 0, wins: 0, draws: 0, losses: 0, goalDiff: 0, points: 0 };

}



export function buildLeagueStandings(teams) {

  return [teams.map(club => emptyStanding(club))];

}



/** @deprecated Saves antigos com grupos — use buildStateLeagueFixtures. */

export function buildGroupStandings(groups) {

  return groups.map(group => group.map(club => emptyStanding(club)));

}



/** Gera rodadas da fase de pontos corridos (turno único, todos contra todos). */

export function buildStateLeagueFixtures(teams) {

  const rounds = singleRoundRobin(teams);

  return rounds.map((roundGames, roundIndex) =>

    (roundGames || []).map(game => ({

      ...game,

      round: roundIndex + 1,

      competition: STATE_LEAGUE_COMPETITION,

      phase: 'league',

      stateUf: null,

    })),

  );

}



function snakeGroupAssign(sortedTeams, groupCount = PAULISTA_GROUPS) {

  const groups = Array.from({ length: groupCount }, () => []);

  sortedTeams.forEach((team, index) => {

    const cycle = Math.floor(index / groupCount);

    const pos = index % groupCount;

    const groupIndex = cycle % 2 === 0 ? pos : groupCount - 1 - pos;

    groups[groupIndex].push(team);

  });

  return groups;

}



/** Rodadas paralelas por grupo (mesma data, jogos A e B). */

export function buildStateGroupFixtures(groups) {

  const perGroup = groups.map(group => singleRoundRobin(group));

  const rounds = Math.max(...perGroup.map(item => item.length), 0);

  const fixtures = [];

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {

    const games = [];

    perGroup.forEach((groupRounds, groupIndex) => {

      (groupRounds[roundIndex] || []).forEach(game => {

        games.push({

          ...game,

          round: roundIndex + 1,

          competition: STATE_LEAGUE_COMPETITION,

          phase: 'groups',

          groupIndex,

          stateUf: null,

        });

      });

    });

    fixtures.push(games);

  }

  return fixtures;

}



export function scheduleStateLeagueDates(seasonYear, roundCount) {
  const year = Number(seasonYear) || 2026;
  const mold = FUTURE_COMPETITION_MOLD.state_league;
  const start = new Date(year, mold.start[0], mold.start[1], 12, 0, 0, 0);
  const end = new Date(year, mold.end[0], mold.end[1], 12, 0, 0, 0);
  const targetCount = Math.max(1, roundCount || STATE_LEAGUE_CALENDAR_SLOTS);
  const sundays = listSlotDatesInRange(start, end, [WEEKDAY.SUN]);
  const wednesdays = listSlotDatesInRange(start, end, [WEEKDAY.WED]);
  const dates = [...sundays];
  while (dates.length < targetCount && wednesdays.length) {
    const next = wednesdays.shift();
    if (!dates.some(item => item.getTime() === next.getTime())) dates.push(next);
  }
  return dates
    .sort((a, b) => a - b)
    .slice(0, targetCount)
    .map((date, index) => ({
      date,
      time: index % 2 === 0 ? '16:00' : '18:30',
    }));
}

/** Repara saves com slots/domínios faltando (só domingos → semi/final sem data). */
export function repairStateLeagueCompetitionCalendar(competition, seasonYear) {
  if (!competition?.fixtures?.length) return false;
  const slots = scheduleStateLeagueDates(seasonYear, STATE_LEAGUE_CALENDAR_SLOTS);
  competition.calendarSlots = slots;
  const leagueRounds = leagueRoundCountFor(competition);
  const paulista = isPaulistaFormat(competition);
  for (let roundIndex = 0; roundIndex < leagueRounds; roundIndex += 1) {
    const slot = slots[roundIndex];
    (competition.fixtures[roundIndex] || []).forEach(game => {
      if (!game?.home || !slot) return;
      if (game.date && !parseCalendarDate(game.date)) delete game.date;
      game.date = slot.date;
      game.time = slot.time || game.time || '16:00';
    });
  }
  const knockoutPlans = paulista
    ? [
        { round: leagueRounds + 1, slotIndex: leagueRounds },
        { round: leagueRounds + 2, slotIndex: leagueRounds + 1 },
        { round: leagueRounds + 3, slotIndex: leagueRounds + 2 },
      ]
    : [
        { round: leagueRounds + 1, slotIndex: leagueRounds },
        { round: leagueRounds + 2, slotIndex: leagueRounds + 1 },
      ];
  knockoutPlans.forEach(({ round, slotIndex }) => {
    const slot = slots[slotIndex];
    (competition.fixtures[round - 1] || []).forEach(game => {
      if (!game?.home || !slot) return;
      if (game.date && !parseCalendarDate(game.date)) delete game.date;
      game.date = slot.date;
      game.time = slot.time || game.time || '16:00';
    });
  });
  return true;
}



export function buildStateDivisionCompetition(uf, tier, teams, seasonYear, tierCount = 1) {

  const sorted = sortClubsByPrestige(teams);

  if (String(uf).toUpperCase() === PAULISTA_UF && sorted.length === PAULISTA_DIVISION_SIZE) {

    return buildPaulistaDivisionCompetition(uf, tier, sorted, seasonYear, tierCount);

  }

  const leagueRounds = buildStateLeagueFixtures(sorted);

  const leagueRoundCount = leagueRounds.length;

  const calendarSlots = scheduleStateLeagueDates(seasonYear, STATE_LEAGUE_CALENDAR_SLOTS);



  const fixtures = leagueRounds.map((round, roundIndex) =>

    (round || []).map((game, gameIndex) => ({

      ...game,

      date: calendarSlots[roundIndex]?.date || null,

      time: calendarSlots[roundIndex]?.time || '16:00',

      round: roundIndex + 1,

      roundIndex,

      gameIndex,

      stateUf: uf,

      stateTier: tier,

    })),

  );



  fixtures[leagueRoundCount] = [];

  fixtures[leagueRoundCount + 1] = [];



  return {

    uf,

    tier,

    label: stateLeagueLabel(uf, tier, tierCount),

    teams: sorted,

    phase: 'league',

    leagueRoundCount,

    groupRoundCount: leagueRoundCount,

    calendarSlots,

    fixtures,

    standings: buildLeagueStandings(sorted),

    knockout: { semis: [], final: [] },

    champion: null,

    runnerUp: null,

    semifinalists: [],

    complete: false,

    currentRound: 1,

  };

}



function buildPaulistaDivisionCompetition(uf, tier, sorted, seasonYear, tierCount) {

  const groups = snakeGroupAssign(sorted, PAULISTA_GROUPS);

  const groupRounds = buildStateGroupFixtures(groups);

  const groupRoundCount = groupRounds.length;

  const calendarSlots = scheduleStateLeagueDates(seasonYear, STATE_LEAGUE_CALENDAR_SLOTS);



  const fixtures = groupRounds.map((round, roundIndex) =>

    (round || []).map((game, gameIndex) => ({

      ...game,

      date: calendarSlots[roundIndex]?.date || null,

      time: calendarSlots[roundIndex]?.time || '16:00',

      round: roundIndex + 1,

      roundIndex,

      gameIndex,

      stateUf: uf,

      stateTier: tier,

    })),

  );



  fixtures[groupRoundCount] = [];

  fixtures[groupRoundCount + 1] = [];

  fixtures[groupRoundCount + 2] = [];

  while (fixtures.length < STATE_LEAGUE_CALENDAR_SLOTS) fixtures.push([]);



  return {

    uf,

    tier,

    format: 'paulista',

    label: stateLeagueLabel(uf, tier, tierCount),

    teams: sorted,

    groups,

    phase: 'groups',

    leagueRoundCount: groupRoundCount,

    groupRoundCount,

    calendarSlots,

    fixtures,

    standings: buildGroupStandings(groups),

    knockout: { quarters: [], semis: [], final: [] },

    champion: null,

    runnerUp: null,

    semifinalists: [],

    complete: false,

    currentRound: 1,

  };

}



export function buildAllStateCompetitions({

  clubs = {},

  regionalBaseClubs = [],

  importClubs = [],

  seasonYear = 2026,

  userClub = null,

  userUf = null,

  membershipByUf = {},

  lotterySeed = null,

} = {}) {

  const validMembershipByUf = filterValidMembershipByUf(membershipByUf);

  const byUf = {};

  BRAZILIAN_UFS.forEach(item => {

    const participants = collectParticipantsForUf(item.code, {

      clubs,

      regionalBaseClubs,

      importClubs,

      userClub,

      userUf,

    });

    const membership = validMembershipByUf[item.code];
    let divisions;
    if (membership?.rosters && Object.keys(membership.rosters).length) {
      divisions = rostersToDivisions(membership.rosters, item.code);
      divisions.forEach(div => {
        if (div.tier === STATE_LEAGUE_VISIBLE_TIERS) {
          div.lottery = true;
          div.lotteryPoolSize = Math.max(0, participants.length - divisions.reduce((n, d) => n + d.teams.length, 0) + (div.teams?.length || 0));
        }
      });
    } else {
      divisions = splitStateDivisions(participants, clubs, item.code, {
        seasonYear,
        userClub,
        userUf,
        lotterySeed: lotterySeed != null ? `${lotterySeed}-${item.code}-${seasonYear}` : null,
      });
    }

    byUf[item.code] = divisions

      .filter(division => isValidDivisionSize(division.tier || 1, item.code, (division.teams || []).length))

      .map(division => {

        const competition = buildStateDivisionCompetition(

          item.code,

          division.tier,

          division.teams,

          seasonYear,

          divisions.length,

        );

        if (division.lottery) {

          competition.lottery = true;

          competition.lotteryPoolSize = division.lotteryPoolSize || null;

        }

        return competition;

      });

  });

  return byUf;

}



export function leagueRoundCountFor(competition) {

  return competition?.leagueRoundCount ?? competition?.groupRoundCount ?? 0;

}



export function stateRoundPhaseLabel(competition, round) {

  const index = Number(round) || 1;

  if (!competition) return `Rodada ${index}`;

  const leagueRounds = leagueRoundCountFor(competition);

  if (isPaulistaFormat(competition)) {

    if (index <= leagueRounds) return `Rodada ${index}`;

    if (index === leagueRounds + 1) return 'Quartas de final';

    if (index === leagueRounds + 2) return 'Semifinal';

    return 'Final';

  }

  if (index <= leagueRounds) return `Rodada ${index}`;

  if (index === leagueRounds + 1) return 'Semifinal';

  return 'Final';

}



/** Título curto do mata-mata estadual (página Campeonatos). */
export function stateKnockoutPhaseTitle(competition, round) {
  const index = Number(round) || 1;
  if (!competition) return null;
  const leagueRounds = leagueRoundCountFor(competition);
  if (index <= leagueRounds) return null;
  if (isPaulistaFormat(competition)) {
    if (index === leagueRounds + 1) return 'QUARTAS DE FINAIS';
    if (index === leagueRounds + 2) return 'SEMI-FINAIS';
    return 'FINAL';
  }
  if (index === leagueRounds + 1) return 'SEMI-FINAIS';
  return 'FINAL';
}



export function sortStandingsRows(rows) {

  return [...rows].sort(

    (a, b) => b.points - a.points || b.wins - a.wins || b.goalDiff - a.goalDiff || a.club.localeCompare(b.club, 'pt-BR'),

  );

}



export function applyResultToStanding(row, goalsFor, goalsAgainst) {

  row.played += 1;

  row.goalDiff += goalsFor - goalsAgainst;

  if (goalsFor > goalsAgainst) {

    row.wins += 1;

    row.points += 3;

  } else if (goalsFor < goalsAgainst) {

    row.losses += 1;

  } else {

    row.draws += 1;

    row.points += 1;

  }

}



export function leagueQualifiers(competition) {

  const table = competition?.standings?.[0] || [];

  return sortStandingsRows([...table]).slice(0, STATE_LEAGUE_KNOCKOUT_SPOTS);

}



/** Top 4 por grupo (Paulista) ou top 4 da tabela única (demais UFs). */

export function groupQualifiers(competition) {

  if (isPaulistaFormat(competition)) {

    return (competition.standings || []).map(groupRows =>

      sortStandingsRows([...groupRows]).slice(0, PAULISTA_ADVANCE_PER_GROUP),

    );

  }

  return [leagueQualifiers(competition)];

}



/** Índice do grupo (0=A, 1=B…) no Paulista; 0 na tabela única. */

export function stateLeagueClubGroupIndex(competition, clubName) {

  if (!competition || !clubName) return null;

  if (isPaulistaFormat(competition)) {

    const idx = (competition.groups || []).findIndex(group => group.includes(clubName));

    return idx >= 0 ? idx : null;

  }

  return 0;

}



/** Posição na classificação do grupo (1-based) ou null. */

export function stateLeagueGroupPosition(competition, clubName, groupIndex = null) {

  if (!competition?.standings?.length || !clubName) return null;

  const gIdx = groupIndex ?? stateLeagueClubGroupIndex(competition, clubName);

  if (gIdx == null || gIdx < 0) return null;

  const rows = sortStandingsRows([...(competition.standings[gIdx] || [])]);

  const pos = rows.findIndex(row => row.club === clubName);

  return pos >= 0 ? pos + 1 : null;

}



export function buildQuarterfinalFixtures(qualifiers, uf, startRound, dateSlot = null) {

  if (!qualifiers || qualifiers.length < 2) return [];

  const a = qualifiers[0].map(row => row.club);

  const b = qualifiers[1].map(row => row.club);

  if (a.length < 4 || b.length < 4) return [];

  const dateFields = dateSlot ? { date: dateSlot.date, time: dateSlot.time || '16:00' } : {};

  const base = {

    round: startRound,

    competition: STATE_LEAGUE_COMPETITION,

    phase: 'quarters',

    stateUf: uf,

  };

  return [

    { ...base, home: a[0], away: b[3], tieId: `${uf}-qf-1`, ...dateFields },

    { ...base, home: a[1], away: b[2], tieId: `${uf}-qf-2`, ...dateFields },

    { ...base, home: b[0], away: a[3], tieId: `${uf}-qf-3`, ...dateFields },

    { ...base, home: b[1], away: a[2], tieId: `${uf}-qf-4`, ...dateFields },

  ];

}



export function buildSemifinalFixturesFromWinners(winners, uf, startRound, dateSlot = null) {

  if (!winners || winners.length < 4) return [];

  const dateFields = dateSlot ? { date: dateSlot.date, time: dateSlot.time || '16:00' } : {};

  const base = {

    round: startRound,

    competition: STATE_LEAGUE_COMPETITION,

    phase: 'semis',

    stateUf: uf,

  };

  return [

    { ...base, home: winners[0], away: winners[1], tieId: `${uf}-semi-1`, ...dateFields },

    { ...base, home: winners[2], away: winners[3], tieId: `${uf}-semi-2`, ...dateFields },

  ];

}



export function buildSemifinalFixtures(topFourRows, uf, startRound, dateSlot = null) {

  if (!topFourRows || topFourRows.length < 4) return [];

  const [first, second, third, fourth] = topFourRows.map(row => row.club || row);

  const dateFields = dateSlot ? { date: dateSlot.date, time: dateSlot.time || '16:00' } : {};

  const base = {

    round: startRound,

    competition: STATE_LEAGUE_COMPETITION,

    phase: 'semis',

    stateUf: uf,

  };

  return [

    { ...base, home: first, away: fourth, tieId: `${uf}-semi-1`, ...dateFields },

    { ...base, home: second, away: third, tieId: `${uf}-semi-2`, ...dateFields },

  ];

}



export function buildFinalFixture(winners, uf, round, dateSlot = null) {

  if (winners.length < 2) return [];

  const dateFields = dateSlot ? { date: dateSlot.date, time: dateSlot.time || '16:00' } : {};

  return [

    {

      home: winners[0],

      away: winners[1],

      round,

      competition: STATE_LEAGUE_COMPETITION,

      phase: 'final',

      stateUf: uf,

      tieId: `${uf}-final`,

      ...dateFields,

    },

  ];

}



export function isStateLeagueGame(game) {

  return String(game?.competition || '') === STATE_LEAGUE_COMPETITION;

}



/** Selo visual: "Estadual · São Paulo" (CSS aplica uppercase). */

export function stateLeagueBadgeName(game) {

  const uf = game?.stateUf;

  const stateName = uf ? ufLabel(uf) : 'Brasil';

  return `Estadual · ${stateName}`;

}



export function stateLeagueGroupLabel(groupIndex) {

  if (groupIndex == null || Number.isNaN(Number(groupIndex))) return '';

  return `Grupo ${String.fromCharCode(65 + Number(groupIndex))}`;

}



export function stateLeaguePhaseLabel(game) {

  if (!game) return '';

  if (game.phase === 'semis') return 'Semifinal';

  if (game.phase === 'quarters') return 'Quartas de final';

  if (game.phase === 'final') return 'Final';

  if (game.phase === 'groups') {

    const group = stateLeagueGroupLabel(game.groupIndex);

    return group ? `Fase de grupos · ${group}` : 'Fase de grupos';

  }

  return 'Pontos corridos';

}



export function stateLeagueRoundEmLabel(game) {

  if (!game) return '';

  if (game.phase === 'semis') return 'SEMIFINAL';

  if (game.phase === 'quarters') return 'QUARTAS DE FINAL';

  if (game.phase === 'final') return 'FINAL';

  return `RODADA ${game.round || '—'}`;

}


