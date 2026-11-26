import { MEMORY_LIMITS } from '../core/save.js';
import { resolveSerieCOutcome } from './serie-c-standings.js';

/**
 * Fechamento da temporada no ranking nacional de clubes.
 */
export function createNationalRankingFinalize(deps) {
  const ranked = division => {
    const nationalCompetitions = deps.getNationalCompetitions();
    return [...nationalCompetitions[division].standings]
      .sort((a, b) => b.points - a.points || b.wins - a.wins || b.goalDiff - a.goalDiff)
      .map(row => row.club);
  };

  const finalizeNationalRankingSeason = () => {
    const careerSeason = deps.getCareerSeason();
    if (deps.getFinalizedSeasons().has(careerSeason)) return;
    deps.accumulateNationalRankingLeaguePoints(
      deps.getNationalRankingEntries(),
      deps.getNationalCompetitions(),
    );
    const dKnockout = deps.getDKnockout();
    const cupCompetition = deps.getCupCompetition();
    // No formato CBF o campeão da Série C é o vencedor da final, não o líder da
    // primeira fase. Sem final disputada (save antigo) cai no líder da tabela.
    const serieCChampion = resolveSerieCOutcome({
      fixtures: deps.getNationalCompetitions().C?.fixtures,
      clubs: (deps.getDivisionTeams?.()?.C) || [],
      clubsCount: deps.getSerieCClubs?.(),
      relegationSlots: 0,
    }).champion;
    const champions = {
      A: ranked('A')[0],
      B: ranked('B')[0],
      C: serieCChampion || ranked('C')[0],
      D: dKnockout.champion || ranked('D')[0],
      CUP: cupCompetition.champion,
    };
    deps.awardNationalRankingTitles(deps.getNationalRankingEntries(), {
      careerSeason,
      champions,
      rankingTitlesLimit: MEMORY_LIMITS.rankingTitles,
    });
    deps.getFinalizedSeasons().add(careerSeason);
    deps.getRankingViews()?.renderNationalRanking();
    deps.getRankingViews()?.renderManagerRanking();
  };

  return { ranked, finalizeNationalRankingSeason };
}
