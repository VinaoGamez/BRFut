import assert from 'node:assert/strict';
import {
  NATIONAL_LEAGUE_POINT_WEIGHTS,
  bootstrapNationalRankingEntries,
  computeNationalRankingBase,
  resolveNationalRankingEntry,
  roundRankingScore,
} from '../js/engine/national-ranking.js';
import { classificationZone } from '../js/engine/classification-zone.js';

const pruneRankingTitles = titles => (Array.isArray(titles) ? titles : []);

const club = (name, division, overall = 70) => ({
  name,
  division,
  environment: 60,
  roster: Array.from({ length: 11 }, (_, index) => ({ overall: overall - index })),
});

const clubs = {
  Alpha: club('Alpha', 'A', 80),
  Beta: club('Beta', 'B', 72),
};

const { entries } = bootstrapNationalRankingEntries({
  clubs,
  storedNationalRanking: { entries: {}, formulaVersion: 2 },
  pruneRankingTitles,
  careerSeed: 42,
});

assert.ok(entries.Alpha.base > 0);
assert.ok(computeNationalRankingBase(clubs.Alpha, 42) > 0);
assert.equal(roundRankingScore(1.234), 1.2);
assert.equal(classificationZone('A', 16, 20), 'relegation');
// Série C no formato CBF: na fase 1 os 8 primeiros avançam para os grupos, mas
// ninguém sobe direto — o acesso sai dos vencedores de grupo, na final.
assert.equal(classificationZone('C', 2, 20, 2), 'qualified');
assert.equal(classificationZone('C', 7, 20, 2), 'qualified');
assert.equal(classificationZone('C', 8, 20, 2), '');
assert.equal(classificationZone('C', 18, 20, 2), 'relegation');
// Fora da fase 1 (grupos/final) o primeiro colocado da tabela é acesso.
assert.equal(classificationZone('C', 0, 20, 2, { phase: 2 }), 'promotion');

const resolved = resolveNationalRankingEntry(entries.Alpha, {
  clubs,
  nationalCompetitions: {
    A: { standings: [{ club: 'Alpha', points: 10 }] },
  },
  careerSeason: 2026,
  finalizedSeasons: new Set(),
  cupChampion: null,
  careerSeed: 42,
});

assert.ok(resolved.championshipPoints >= entries.Alpha.championshipPoints);
assert.equal(
  resolved.seasonLeaguePoints,
  roundRankingScore(10 * NATIONAL_LEAGUE_POINT_WEIGHTS.A),
);

console.log('national-ranking-tests: 5/5 ok');
