/**
 * Monta a edição continental de uma temporada: quem entra, em que fase, e o
 * ranking que define os potes.
 *
 * Brasil: vagas saem da Série A e da Copa do Brasil da temporada anterior
 * (regra da CBF). Primeiro ano da carreira: não há temporada anterior jogada,
 * então a ordem da Série A vem da força dos elencos — o mesmo critério que o
 * jogo usa para montar a pirâmide inicial.
 *
 * Demais países: tabela da liga nacional simulada (força + sorte) em
 * conmebol-clubs.js.
 */

import {
  CONMEBOL_CLUBS,
  CONMEBOL_FOREIGN_COUNTRIES,
  conmebolClubBasePower,
  conmebolClubMeta,
  simulateForeignLeagueTable,
} from './conmebol-clubs.js';
import {
  brazilLibertadoresBerths,
  brazilSudamericanaBerths,
  foreignCountryBerths,
} from './conmebol-format.js';
import { createConmebolEdition } from './conmebol-competition.js';

/**
 * Pontuação de ranking CONMEBOL (aproximação): força do elenco + histórico
 * continental recente guardado na carreira.
 */
export function conmebolRankingScore(club, { power = 50, history = {} } = {}) {
  const h = history[club] || {};
  return Math.round((power + (h.titles || 0) * 6 + (h.finals || 0) * 2 + (h.points || 0) * 0.15) * 10) / 10;
}

/**
 * Pontos de ranking que uma edição rende (alimenta o pote do ano seguinte).
 */
export function conmebolHistoryAfterEdition(edition, history = {}) {
  const next = JSON.parse(JSON.stringify(history || {}));
  const stagePoints = { F1: 1, F2: 1, F3: 1, FS: 1, G: 2, PO: 2, R16: 3, QF: 4, SF: 5, F: 6 };
  ['libertadores', 'sudamericana'].forEach(id => {
    const weight = id === 'libertadores' ? 1 : 0.5;
    Object.entries(edition?.[id]?.progress || {}).forEach(([club, row]) => {
      const entry = (next[club] = next[club] || { titles: 0, finals: 0, points: 0 });
      entry.points = Math.round(((entry.points || 0) * 0.7 + row.stages.reduce((sum, stage) => sum + (stagePoints[stage] || 0), 0) * weight) * 10) / 10;
      if (row.result === 'champion' && id === 'libertadores') entry.titles = (entry.titles || 0) + 1;
      if ((row.result === 'champion' || row.result === 'runnerUp') && id === 'libertadores') entry.finals = (entry.finals || 0) + 1;
    });
  });
  return next;
}

/**
 * Vagas da temporada.
 *
 * @param {object} params
 * @param {number} params.season ano da edição
 * @param {number} params.careerSeed
 * @param {string[]} params.standingsA Série A da temporada anterior (1º ao 20º)
 * @param {string|null} params.cupChampion
 * @param {string|null} params.cupRunnerUp
 * @param {{libertadores?: string|null, sudamericana?: string|null}} [params.titleHolders]
 * @returns {{libertadores: {group:object[], f2:object[], f1:object[]}, sudamericana: {group:object[], fs:object[]}}}
 */
export function buildConmebolEntries({
  season,
  careerSeed = 0,
  standingsA = [],
  cupChampion = null,
  cupRunnerUp = null,
  titleHolders = {},
  countryOf = () => 'BRA',
} = {}) {
  const lib = { group: [], f2: [], f1: [] };
  const sud = { group: [], fs: [] };
  const taken = new Set();
  const entry = (club, country, via) => ({ club, country, via });

  // Campeões continentais entram direto nos grupos da Libertadores.
  const holders = [
    [titleHolders.libertadores, 'Campeão da Libertadores'],
    [titleHolders.sudamericana, 'Campeão da Sul-Americana'],
  ];
  holders.forEach(([club, via]) => {
    if (!club || taken.has(club)) return;
    taken.add(club);
    const meta = conmebolClubMeta(club);
    lib.group.push(entry(club, meta ? meta.country : countryOf(club), via));
  });

  // Primeira temporada da carreira: não houve edição anterior. As duas vagas
  // de campeão continental vão para o melhor brasileiro e o melhor argentino
  // ainda fora (mesmo efeito de 2026: Flamengo campeão, Lanús da Sul).
  const tables = Object.fromEntries(Object.keys(CONMEBOL_FOREIGN_COUNTRIES).map(country => [
    country,
    simulateForeignLeagueTable(country, { careerSeed, seasonYear: season - 1 }),
  ]));
  if (!titleHolders.libertadores) {
    const club = standingsA.find(name => !taken.has(name));
    if (club) { taken.add(club); lib.group.push(entry(club, 'BRA', 'Campeão da Libertadores')); }
  }
  if (!titleHolders.sudamericana) {
    const club = tables.ARG.find(name => !taken.has(name));
    if (club) { taken.add(club); lib.group.push(entry(club, 'ARG', 'Campeão da Sul-Americana')); }
  }

  // Brasil.
  const brLib = brazilLibertadoresBerths({ standingsA, cupChampion, cupRunnerUp, exclude: taken });
  brLib.group.forEach(item => { taken.add(item.club); lib.group.push(entry(item.club, 'BRA', item.via)); });
  brLib.f2.forEach(item => { taken.add(item.club); lib.f2.push(entry(item.club, 'BRA', item.via)); });
  brazilSudamericanaBerths({ standingsA, exclude: taken }).forEach(item => {
    taken.add(item.club);
    sud.group.push(entry(item.club, 'BRA', item.via));
  });

  // Demais países, pela tabela da liga da temporada anterior.
  Object.keys(CONMEBOL_FOREIGN_COUNTRIES).forEach(country => {
    const table = tables[country];
    const berths = foreignCountryBerths(country, table, taken);
    const via = (position, label) => `${position}º do ${CONMEBOL_FOREIGN_COUNTRIES[country].name}${label ? ` · ${label}` : ''}`;
    let position = 0;
    const push = (list, clubs) => clubs.forEach(club => {
      position += 1;
      taken.add(club);
      list.push(entry(club, country, via(table.indexOf(club) + 1)));
    });
    push(lib.group, berths.lib.group);
    push(lib.f2, berths.lib.f2);
    push(lib.f1, berths.lib.f1);
    push(sud.group, berths.sud.group);
    push(sud.fs, berths.sud.fs);
  });

  return { libertadores: lib, sudamericana: sud };
}

/**
 * Cria a edição pronta para jogar.
 *
 * @param {object} params mesmos de buildConmebolEntries, mais:
 * @param {(club:string) => number} params.powerOf força do clube brasileiro
 * @param {object} [params.history] histórico continental da carreira
 * @param {Array<{start:Date,end:Date}>} [params.blocked]
 */
export function buildConmebolEdition(params = {}) {
  const { season, careerSeed = 0, powerOf = () => 55, history = {}, blocked = [], titleHolders = {}, clubWorldCup = null } = params;
  const entries = buildConmebolEntries(params);
  const ranking = {};
  const all = [
    ...Object.values(entries.libertadores).flat(),
    ...Object.values(entries.sudamericana).flat(),
  ];
  all.forEach(({ club, country }) => {
    const meta = conmebolClubMeta(club);
    const power = meta ? conmebolClubBasePower(meta, { careerSeed, seasonYear: season }) + 5 : Number(powerOf(club)) || 55;
    ranking[club] = conmebolRankingScore(club, { power, history });
    if (country === 'BRA') ranking[club] += 0;
  });
  // Recopa Sul-Americana: os dois campeões continentais do ano anterior.
  const holderOf = via => entries.libertadores.group.find(item => item.via === via) || null;
  const recopa = [holderOf('Campeão da Libertadores'), holderOf('Campeão da Sul-Americana')];
  return createConmebolEdition({
    season,
    seed: (Number(careerSeed) * 7919 + Number(season) * 104729) >>> 0,
    entries,
    ranking,
    blocked,
    titleHolder: titleHolders.libertadores || null,
    recopa: recopa.every(Boolean) ? recopa : null,
    clubWorldCup,
  });
}

/**
 * Os 32 do Mundial de Clubes: 6 sul-americanos (os quatro últimos campeões da
 * Libertadores e os dois melhores do ranking, no máximo dois por país fora os
 * campeões) e os 26 clubes das outras confederações.
 *
 * @param {object} params
 * @param {number} params.season ano do Mundial
 * @param {Record<number,string>} params.libertadoresChampions campeão por ano
 * @param {object} params.history histórico continental (ranking)
 * @param {(club:string) => number} params.powerOf força do clube brasileiro
 * @param {(club:string) => string} [params.countryOf]
 */
export function buildClubWorldCupParticipants({ season, careerSeed = 0, libertadoresChampions = {}, history = {}, powerOf = () => 55, countryOf = () => 'BRA', exists = () => true } = {}) {
  const y = Number(season);
  const countryFor = club => conmebolClubMeta(club)?.country || countryOf(club);
  const strengthFor = club => {
    const meta = conmebolClubMeta(club);
    return meta ? conmebolClubBasePower(meta, { careerSeed, seasonYear: y }) : Number(powerOf(club)) || 55;
  };
  const conmebol = [];
  const taken = new Set();
  [y - 4, y - 3, y - 2, y - 1].forEach(year => {
    const club = libertadoresChampions[year];
    if (!club || taken.has(club) || !(exists(club) || conmebolClubMeta(club))) return;
    taken.add(club);
    conmebol.push({ club, country: countryFor(club), confederation: 'CONMEBOL', via: `Campeão da Libertadores ${year}`, strength: strengthFor(club) });
  });
  const perCountry = {};
  const ranked = Object.keys(history || {})
    .filter(club => !taken.has(club) && (exists(club) || conmebolClubMeta(club)))
    .map(club => ({ club, score: conmebolRankingScore(club, { power: strengthFor(club), history }) }))
    .sort((a, b) => b.score - a.score || a.club.localeCompare(b.club, 'pt-BR'));
  for (const { club } of ranked) {
    if (conmebol.length >= 6) break;
    const country = countryFor(club);
    const championsHere = conmebol.filter(entry => entry.country === country).length;
    if ((perCountry[country] || 0) >= 2 || championsHere >= 2) continue;
    perCountry[country] = (perCountry[country] || 0) + 1;
    taken.add(club);
    conmebol.push({ club, country, confederation: 'CONMEBOL', via: 'Ranking da CONMEBOL', strength: strengthFor(club) });
  }
  // Histórico curto (começo de carreira): completa com os mais fortes do continente.
  if (conmebol.length < 6) {
    const pool = CONMEBOL_CLUBS
      .filter(meta => meta.confederation === 'CONMEBOL' && !taken.has(meta.name))
      .map(meta => ({ club: meta.name, country: meta.country, strength: conmebolClubBasePower(meta, { careerSeed, seasonYear: y }) }))
      .sort((a, b) => b.strength - a.strength || a.club.localeCompare(b.club, 'pt-BR'));
    for (const entry of pool) {
      if (conmebol.length >= 6) break;
      const sameCountry = conmebol.filter(item => item.country === entry.country).length;
      if (sameCountry >= 2) continue;
      taken.add(entry.club);
      conmebol.push({ ...entry, confederation: 'CONMEBOL', via: 'Ranking da CONMEBOL' });
    }
  }
  const world = CONMEBOL_CLUBS.filter(meta => meta.confederation && meta.confederation !== 'CONMEBOL').map(meta => ({
    club: meta.name,
    country: meta.country,
    confederation: meta.confederation,
    via: meta.name === 'Marinheiros de Seattle' ? 'País-sede' : `Vaga da ${meta.confederation}`,
    strength: conmebolClubBasePower(meta, { careerSeed, seasonYear: y }),
  }));
  return [...conmebol, ...world];
}

/** Ordem inicial da Série A no 1º ano: força do elenco. */
export function bootstrapStandingsByPower(clubNames = [], powerOf = () => 0) {
  return [...clubNames].sort((a, b) => (Number(powerOf(b)) || 0) - (Number(powerOf(a)) || 0) || a.localeCompare(b, 'pt-BR'));
}

/** Para testes e depuração: total de estrangeiros no universo. */
export const CONMEBOL_FOREIGN_CLUB_COUNT = CONMEBOL_CLUBS.length;
