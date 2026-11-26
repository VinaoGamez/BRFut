/**
 * Série C — instalação das fases conforme a primeira fase termina.
 *
 * A primeira fase é turno único. Quando ela acaba, os 8 primeiros viram dois
 * grupos de 4; quando os grupos acabam, os vencedores jogam a final. Nada disso
 * pode ser gerado no início da temporada: depende de quem terminou em cada
 * posição.
 *
 * O gatilho é o número da rodada concluída, igual ao mata-mata da Série D.
 */

import {
  SERIE_C_QUALIFIED,
  SERIE_C_GROUP_ROUNDS,
  SERIE_C_FINAL_ROUNDS,
  serieCGroupComposition,
  serieCPhaseRounds,
} from './serie-c-format.js';
import {
  installSerieCRounds,
  buildSerieCGroupRounds,
  buildSerieCRFinalRounds,
} from './serie-c-season.js';
import { buildBrazilianLeagueFixtures } from './league-fixtures.js';

const CLASSIFY = (a, b) =>
  b.points - a.points || b.wins - a.wins || b.goalDiff - a.goalDiff;

export function createSerieCPhaseAdvance(deps) {
  /** Classificação da primeira fase, na ordem. */
  const phase1Ranking = competition => {
    const rows = Array.isArray(competition?.standings) ? [...competition.standings] : [];
    return rows
      .filter(row => row && row.club)
      .sort((a, b) => CLASSIFY(a, b))
      .map(row => row.club);
  };

  /** Clubs de uma fase dentro de uma lista, já classificados. */
  const rankedWithin = (competition, clubs) =>
    phase1Ranking(competition).filter(club => clubs.includes(club));

  const competition = () => deps.getNationalCompetitions?.()?.C;

  /** Instala a segunda fase (grupos). */
  const installGroups = () => {
    const comp = competition();
    const fixtures = comp?.fixtures;
    if (!Array.isArray(fixtures)) return null;
    const clubs = Number(deps.getSerieCClubs?.()) || 20;
    const { phase1 } = serieCPhaseRounds(clubs);
    const stage = deps.getSerieCState?.();
    if (stage?.groupsInstalled) return stage.groups;

    const ranked = phase1Ranking(comp);
    const qualified = ranked.slice(0, SERIE_C_QUALIFIED);
    if (qualified.length < SERIE_C_QUALIFIED) return null;

    const { groupA, groupB } = serieCGroupComposition(qualified);
    const roundRobin = (list, double) =>
      buildBrazilianLeagueFixtures(list, {
        balanceHomeAway: true,
        maxHomeAwayStreak: 2,
        balanceScope: 'first-leg-only',
        singleLeg: !double,
      });
    const rounds = buildSerieCGroupRounds({ groupA, groupB }, roundRobin);
    if (!rounds.length) return null;
    installSerieCRounds(fixtures, rounds, phase1 + 1);
    deps.setSerieCState?.({ ...(stage || {}), groupsInstalled: true, groups: { groupA, groupB } });
    deps.rebuildCalendarGames?.();
    return { groupA, groupB };
  };

  /** Vencedor de um grupo da segunda fase. */
  const groupWinner = (clubs) => {
    const comp = competition();
    const ordered = rankedWithin(comp, clubs || []);
    return ordered[0] || null;
  };

  /** Instala a final entre os vencedores de grupo. */
  const installFinal = () => {
    const comp = competition();
    const fixtures = comp?.fixtures;
    if (!Array.isArray(fixtures)) return null;
    const clubs = Number(deps.getSerieCClubs?.()) || 20;
    const { phase1, groups } = serieCPhaseRounds(clubs);
    const stage = deps.getSerieCState?.();
    if (stage?.finalInstalled) return stage.final;
    const { groupA, groupB } = stage?.groups || {};
    if (!groupA?.length || !groupB?.length) return null;

    const winnerA = groupWinner(groupA);
    const winnerB = groupWinner(groupB);
    const rounds = buildSerieCRFinalRounds(winnerA, winnerB);
    if (!rounds.length) return null;
    installSerieCRounds(fixtures, rounds, phase1 + groups + 1);
    deps.setSerieCState?.({
      ...(stage || {}),
      finalInstalled: true,
      final: { winnerA, winnerB },
    });
    deps.rebuildCalendarGames?.();
    return { winnerA, winnerB };
  };

  /**
   * Máquina de fases, por rodada concluída.
   *
   * @param {number} completedRound rodada que acabou de ser disputada
   * @returns {{installed: 'groups'|'final'|null}}
   */
  const updateSerieCPhases = completedRound => {
    const comp = competition();
    if (!comp) return { installed: null };
    const clubs = Number(deps.getSerieCClubs?.()) || 20;
    const { phase1 } = serieCPhaseRounds(clubs);
    const round = Number(completedRound);
    if (!Number.isFinite(round)) return { installed: null };

    if (round === phase1) {
      const groups = installGroups();
      if (groups) return { installed: 'groups' };
      return { installed: null };
    }
    if (round === phase1 + SERIE_C_GROUP_ROUNDS) {
      const final = installFinal();
      if (final) return { installed: 'final' };
    }
    return { installed: null };
  };

  /** Série C pronta quando a última rodada da final foi disputada. */
  const isSerieCSeasonComplete = completedRound => {
    const clubs = Number(deps.getSerieCClubs?.()) || 20;
    const { total } = serieCPhaseRounds(clubs);
    return Number(completedRound) >= total;
  };

  return {
    updateSerieCPhases,
    installGroups,
    installFinal,
    groupWinner,
    phase1Ranking,
    isSerieCSeasonComplete,
    SERIE_C_QUALIFIED,
    SERIE_C_FINAL_ROUNDS,
  };
}
