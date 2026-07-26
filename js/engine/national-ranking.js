export const NATIONAL_RANKING_FORMULA_VERSION = 2;

export const NATIONAL_TITLE_BONUSES = { A: 40, B: 28, C: 20, D: 12, CUP: 35 };

export const NATIONAL_DIVISION_PRESTIGE = { A: 14, B: 10, C: 6, D: 2 };

export const NATIONAL_DIVISION_BENCHMARKS = { A: 82, B: 76, C: 70, D: 65 };

export const NATIONAL_LEAGUE_POINT_WEIGHTS = { A: 1, B: 0.75, C: 0.55, D: 0.35 };

export const roundRankingScore = value => Math.round(Number(value || 0) * 10) / 10;

export const clubSquadOverall = club => Math.round(
  club.roster.slice(0, 11).reduce((total, player) => total + player.overall, 0)
  / Math.max(1, club.roster.slice(0, 11).length),
);

export function computeNationalRankingBase(club, careerSeed = 2166136261) {
  const overall = clubSquadOverall(club);
  let identityHash = ((careerSeed || 2166136261) ^ club.name.length) >>> 0;
  for (let index = 0; index < club.name.length; index++) {
    identityHash = Math.imul(identityHash ^ club.name.charCodeAt(index), 16777619) >>> 0;
  }
  const clubReputation = (identityHash / 4294967295) * 6 - 3;
  const divisionalExcellence = Math.max(0, overall - NATIONAL_DIVISION_BENCHMARKS[club.division]) * 0.8;
  return roundRankingScore(
    overall * 0.68
    + club.environment * 0.15
    + NATIONAL_DIVISION_PRESTIGE[club.division]
    + divisionalExcellence
    + clubReputation,
  );
}

export function bootstrapNationalRankingEntries({ clubs, storedNationalRanking, pruneRankingTitles, careerSeed }) {
  const finalizedSeasons = new Set(storedNationalRanking?.finalizedSeasons || []);
  const legacyFormula = Number(storedNationalRanking?.formulaVersion || 1) < NATIONAL_RANKING_FORMULA_VERSION;
  const entries = Object.fromEntries(Object.values(clubs).map(club => {
    const stored = storedNationalRanking?.entries?.[club.name];
    const base = computeNationalRankingBase(club, careerSeed);
    const storedChampionshipPoints = Number(stored?.championshipPoints || 0);
    const championshipPoints = legacyFormula
      ? roundRankingScore(storedChampionshipPoints * NATIONAL_LEAGUE_POINT_WEIGHTS[club.division])
      : roundRankingScore(storedChampionshipPoints);
    return [club.name, {
      club: club.name,
      base,
      championshipPoints,
      titlePoints: roundRankingScore(stored?.titlePoints || 0),
      titles: pruneRankingTitles(Array.isArray(stored?.titles) ? stored.titles : []),
    }];
  }));
  return { entries, finalizedSeasons };
}

export function resolveNationalRankingEntry(entry, {
  clubs,
  nationalCompetitions,
  careerSeason,
  finalizedSeasons,
  cupChampion,
  careerSeed,
}) {
  const club = clubs[entry.club];
  if (!club) return null;
  const base = computeNationalRankingBase(club, careerSeed);
  const seasonFinalized = finalizedSeasons.has(careerSeason);
  const rawLeaguePoints = seasonFinalized
    ? 0
    : (nationalCompetitions[club.division]?.standings.find(row => row.club === entry.club)?.points || 0);
  const seasonLeaguePoints = roundRankingScore(rawLeaguePoints * NATIONAL_LEAGUE_POINT_WEIGHTS[club.division]);
  const storedChampionshipPoints = roundRankingScore(entry.championshipPoints);
  const championshipPoints = roundRankingScore(storedChampionshipPoints + seasonLeaguePoints);
  const cupTitleProvisional = (
    !seasonFinalized
    && cupChampion === entry.club
    && !entry.titles.some(title => title.season === careerSeason && title.competition === 'COPA DO BRASIL')
  ) ? NATIONAL_TITLE_BONUSES.CUP : 0;
  const storedTitlePoints = roundRankingScore(entry.titlePoints);
  const titlePoints = roundRankingScore(storedTitlePoints + cupTitleProvisional);
  const total = roundRankingScore(base + championshipPoints + titlePoints);
  return {
    ...entry,
    base,
    seasonLeaguePoints,
    storedChampionshipPoints,
    storedTitlePoints,
    cupTitleProvisional,
    championshipPoints,
    titlePoints,
    total,
    division: club.division,
    overall: clubSquadOverall(club),
    environment: club.environment,
  };
}

export function sortNationalRankingEntries(entries) {
  return entries.sort((a, b) => b.total - a.total
    || b.titlePoints - a.titlePoints
    || b.championshipPoints - a.championshipPoints
    || a.club.localeCompare(b.club, 'pt-BR'));
}

export function getClubSeasonLeagueRankingPoints(clubName, {
  clubs,
  nationalCompetitions,
  careerSeason,
  finalizedSeasons,
}) {
  const club = clubs[clubName];
  if (!club) return 0;
  if (finalizedSeasons.has(careerSeason)) return 0;
  const raw = nationalCompetitions[club.division]?.standings.find(row => row.club === clubName)?.points || 0;
  return roundRankingScore(raw * (NATIONAL_LEAGUE_POINT_WEIGHTS[club.division] || 1));
}

export function accumulateNationalRankingLeaguePoints(entries, nationalCompetitions) {
  Object.entries(nationalCompetitions).forEach(([division, competition]) => {
    competition.standings.forEach(row => {
      const entry = entries[row.club];
      if (entry) {
        entry.championshipPoints = roundRankingScore(
          entry.championshipPoints + row.points * NATIONAL_LEAGUE_POINT_WEIGHTS[division],
        );
      }
    });
  });
}

export function awardNationalRankingTitles(entries, { careerSeason, champions, rankingTitlesLimit }) {
  Object.entries(champions).forEach(([competition, clubName]) => {
    if (!clubName) return;
    const entry = entries[clubName];
    const label = competition === 'CUP' ? 'COPA DO BRASIL' : `SÉRIE ${competition}`;
    const token = `${careerSeason}-${competition}`;
    if (!entry || entry.titles.some(title => title.token === token)) return;
    const points = NATIONAL_TITLE_BONUSES[competition];
    entry.titlePoints = roundRankingScore(entry.titlePoints + points);
    entry.titles.push({ token, season: careerSeason, competition: label, points });
    if (entry.titles.length > rankingTitlesLimit) {
      entry.titles = entry.titles.slice(-rankingTitlesLimit);
    }
  });
}
