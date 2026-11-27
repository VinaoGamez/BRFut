/**
 * Libertadores + Sul-Americana de uma temporada, como uma edição só.
 *
 * As duas copas andam juntas porque trocam clubes no meio do caminho: os
 * eliminados da 3ª fase da Libertadores caem nos grupos da Sul-Americana, e os
 * terceiros dos grupos da Libertadores jogam os playoffs da Sul-Americana.
 *
 * Módulo puro: não sabe de elenco nem de calendário nacional. Quem integra
 * passa `simulateGame` (o simulador do jogo), `resolveShootout` (pênaltis) e
 * `isUserFixture`. Jogos do usuário nunca são simulados aqui: ficam pendentes
 * até a partida ao vivo gravar o placar.
 *
 * Ordem de fases e regras de sorteio seguem o regulamento 2026 da CONMEBOL
 * (ver conmebol-format.js).
 */

import {
  CONMEBOL_COMPETITIONS,
  LIBERTADORES,
  LIBERTADORES_STAGES,
  STAGE_LABELS,
  SUDAMERICANA,
  SUDAMERICANA_STAGES,
  conmebolPrize,
  conmebolStageWindows,
} from './conmebol-format.js';

export const CONMEBOL_EDITION_VERSION = 1;
const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const DAY_MS = 86_400_000;
const NEUTRAL_FINAL_CITIES = ['Montevidéu', 'Assunção', 'Lima', 'Santiago', 'Buenos Aires', 'Rio de Janeiro', 'Bogotá', 'Quito', 'Barranquilla', 'Córdoba'];

/** Ordem dos confrontos de um grupo de 4 (índices na ordem do sorteio). */
const GROUP_ROUNDS = Object.freeze([
  [[0, 3], [1, 2]],
  [[2, 0], [3, 1]],
  [[0, 1], [2, 3]],
  [[1, 0], [3, 2]],
  [[0, 2], [1, 3]],
  [[3, 0], [2, 1]],
]);

/* --------------------------------------------------------------------------
 * Sorte determinística (estado vai no save)
 * ------------------------------------------------------------------------ */

function nextRandom(edition) {
  let t = (edition.rngState = (edition.rngState + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffle(edition, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRandom(edition) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* --------------------------------------------------------------------------
 * Criação
 * ------------------------------------------------------------------------ */

/**
 * @param {object} params
 * @param {number} params.season
 * @param {number} [params.seed]
 * @param {object} params.entries vagas: { libertadores: {group, f2, f1}, sudamericana: {group, fs} },
 *   cada item `{ club, country, via }`
 * @param {Record<string, number>} [params.ranking] pontuação para potes (maior = melhor)
 * @param {Array<{start:Date,end:Date}>} [params.blocked] janelas proibidas (Data FIFA, Copa)
 * @param {string|null} [params.titleHolder] campeão da última Libertadores (cabeça do grupo A)
 */
export function createConmebolEdition({ season, seed = 1, entries, ranking = {}, blocked = [], titleHolder = null } = {}) {
  const edition = {
    version: CONMEBOL_EDITION_VERSION,
    season: Number(season),
    rngState: (Number(seed) >>> 0) || 1,
    ranking: { ...ranking },
    countries: {},
    titleHolder,
    windows: {
      libertadores: serializeWindows(conmebolStageWindows('libertadores', season, { blocked })),
      sudamericana: serializeWindows(conmebolStageWindows('sudamericana', season, { blocked })),
    },
    libertadores: emptyCompetition('libertadores', entries?.libertadores),
    sudamericana: emptyCompetition('sudamericana', entries?.sudamericana),
    fixtures: [],
    events: [],
    nextGameNumber: 1,
  };
  const register = list => (list || []).forEach(entry => {
    if (entry?.club) edition.countries[entry.club] = entry.country || 'BRA';
  });
  Object.values(entries?.libertadores || {}).forEach(register);
  Object.values(entries?.sudamericana || {}).forEach(register);

  openStage(edition, 'libertadores', 'F1');
  openStage(edition, 'sudamericana', 'FS');
  return edition;
}

function emptyCompetition(id, entries = {}) {
  return {
    id,
    key: CONMEBOL_COMPETITIONS[id].key,
    entrants: Object.fromEntries(Object.entries(entries || {}).map(([k, list]) => [k, (list || []).map(e => ({ ...e }))])),
    stages: {},
    progress: {},
    champion: null,
    runnerUp: null,
    finalVenue: null,
  };
}

function serializeWindows(windows) {
  const toIso = w => (w ? { start: w.start.toISOString(), end: w.end.toISOString() } : null);
  const out = {};
  Object.entries(windows).forEach(([stage, spec]) => {
    if (Array.isArray(spec)) out[stage] = spec.map(toIso);
    else out[stage] = { single: toIso(spec.single), ida: toIso(spec.ida), volta: toIso(spec.volta) };
  });
  return out;
}

function windowFor(edition, competitionId, stage, leg, matchday = 1) {
  const spec = edition.windows?.[competitionId]?.[stage];
  if (!spec) return null;
  const raw = Array.isArray(spec) ? spec[matchday - 1] : spec[leg === 'VOLTA' ? 'volta' : leg === 'IDA' ? 'ida' : 'single'] || spec.ida;
  if (!raw) return null;
  return { start: new Date(raw.start), end: new Date(raw.end) };
}

/* --------------------------------------------------------------------------
 * Jogos
 * ------------------------------------------------------------------------ */

function makeGame(edition, competitionId, { stage, home, away, leg = null, matchday = null, group = null, tieId = null, neutral = false, index = 0 }) {
  const comp = CONMEBOL_COMPETITIONS[competitionId];
  const window = windowFor(edition, competitionId, stage, leg, matchday || 1);
  // Liberta joga ter/qua; Sul-Americana, qua/qui. Dentro da janela, espalha.
  const offset = competitionId === 'libertadores' ? index % 2 : 1 + (index % 2);
  const date = window
    ? new Date(Math.min(window.end.getTime(), window.start.getTime() + offset * DAY_MS))
    : null;
  const game = {
    id: `${competitionId}-${edition.season}-${stage}-${edition.nextGameNumber}`,
    gameNumber: edition.nextGameNumber,
    competition: comp.key,
    competitionId,
    season: edition.season,
    stage,
    phase: STAGE_LABELS[stage],
    leg: leg || (matchday ? `${matchday}ª rodada` : 'JOGO ÚNICO'),
    matchday,
    group,
    tieId,
    knockoutRound: tieId ? stageIndex(competitionId, stage) : undefined,
    home,
    away,
    neutral,
    date,
    windowStart: window ? window.start : null,
    windowEnd: window ? window.end : null,
    time: competitionId === 'libertadores' ? (index % 2 ? '21:30' : '19:00') : (index % 2 ? '21:30' : '19:00'),
    completed: false,
    homeGoals: null,
    awayGoals: null,
  };
  edition.nextGameNumber += 1;
  edition.fixtures.push(game);
  return game;
}

function stageIndex(competitionId, stage) {
  const order = competitionId === 'libertadores' ? LIBERTADORES_STAGES : SUDAMERICANA_STAGES;
  return order.indexOf(stage) + 1;
}

function gameById(edition, id) {
  return edition.fixtures.find(game => game.id === id) || null;
}

function isDone(game) {
  return !!game?.completed && Number.isFinite(Number(game.homeGoals)) && Number.isFinite(Number(game.awayGoals));
}

/* --------------------------------------------------------------------------
 * Progresso (premiação e histórico)
 * ------------------------------------------------------------------------ */

function markReached(edition, competitionId, club, stage) {
  const comp = edition[competitionId];
  const row = (comp.progress[club] = comp.progress[club] || { stages: [], groupWins: 0, eliminatedAt: null, result: null });
  if (row.stages.includes(stage)) return;
  row.stages.push(stage);
  edition.events.push({ type: 'stage-entry', competitionId, club, stage, prize: stagePrize(competitionId, stage) });
}

function markEliminated(edition, competitionId, club, stage) {
  const row = edition[competitionId].progress[club];
  if (row && !row.eliminatedAt) row.eliminatedAt = stage;
  edition.events.push({ type: 'eliminated', competitionId, club, stage });
}

function stagePrize(competitionId, stage) {
  if (stage === 'F') return 0;
  return conmebolPrize(competitionId, stage);
}

/** Quanto o clube já faturou de premiação nesta edição. */
export function conmebolEarnings(edition, club) {
  let total = 0;
  ['libertadores', 'sudamericana'].forEach(id => {
    const row = edition?.[id]?.progress?.[club];
    if (!row) return;
    row.stages.forEach(stage => { total += stagePrize(id, stage); });
    total += row.groupWins * conmebolPrize(id, 'groupWin');
    if (row.result === 'champion') total += conmebolPrize(id, 'champion');
    if (row.result === 'runnerUp') total += conmebolPrize(id, 'runnerUp');
  });
  return total;
}

/* --------------------------------------------------------------------------
 * Abertura de fases
 * ------------------------------------------------------------------------ */

function rankScore(edition, club) {
  return Number(edition.ranking?.[club]) || 0;
}

function byRanking(edition, list) {
  return [...list].sort((a, b) => rankScore(edition, b) - rankScore(edition, a) || a.localeCompare(b, 'pt-BR'));
}

function clubsOf(entries) {
  return (entries || []).map(entry => entry.club).filter(Boolean);
}

function openStage(edition, competitionId, stage, participants = null) {
  const comp = edition[competitionId];
  if (comp.stages[stage]) return comp.stages[stage];
  const entrants = comp.entrants;
  let record = null;

  if (competitionId === 'libertadores' && stage === 'F1') {
    const teams = byRanking(edition, clubsOf(entrants.f1));
    record = seededTwoLeg(edition, competitionId, stage, teams);
  } else if (competitionId === 'libertadores' && stage === 'F2') {
    const teams = byRanking(edition, [...clubsOf(entrants.f2), ...(participants || [])]);
    record = seededTwoLeg(edition, competitionId, stage, teams, { avoidSameCountry: true });
  } else if (competitionId === 'libertadores' && stage === 'F3') {
    // C1 × C8, C2 × C7, C3 × C6, C4 × C5 — chave fixa da 2ª fase.
    const winners = participants || [];
    const pairs = [];
    for (let i = 0; i < winners.length / 2; i += 1) pairs.push([winners[i], winners[winners.length - 1 - i]]);
    record = twoLegFromPairs(edition, competitionId, stage, pairs.map(([a, b]) => orderByRanking(edition, a, b)));
  } else if (competitionId === 'sudamericana' && stage === 'FS') {
    record = derbyFirstStage(edition, entrants.fs || []);
  } else if (stage === 'G') {
    record = drawGroups(edition, competitionId, participants || []);
  } else if (competitionId === 'libertadores' && stage === 'R16') {
    record = drawRoundOf16(edition, competitionId, participants.winners, participants.runnersUp, participants.groupOf);
  } else if (competitionId === 'sudamericana' && stage === 'PO') {
    record = twoLegFromPairs(edition, competitionId, stage, participants);
  } else if (competitionId === 'sudamericana' && stage === 'R16') {
    record = drawRoundOf16(edition, competitionId, participants.winners, participants.runnersUp, {});
  } else if (stage === 'QF' || stage === 'SF') {
    const pairs = [];
    for (let i = 0; i < participants.length; i += 2) pairs.push(orderByCampaign(edition, competitionId, participants[i], participants[i + 1]));
    record = twoLegFromPairs(edition, competitionId, stage, pairs);
  } else if (stage === 'F') {
    record = singleFinal(edition, competitionId, participants);
  }
  if (!record) return null;
  record.stage = stage;
  record.completed = false;
  comp.stages[stage] = record;
  allParticipants(record).forEach(club => markReached(edition, competitionId, club, stage));
  edition.events.push({ type: 'stage-open', competitionId, stage });
  return record;
}

function allParticipants(record) {
  if (record.groups) return Object.values(record.groups).flat();
  return (record.ties || []).flatMap(tie => [tie.home, tie.away]).filter(Boolean);
}

/** [hospeda a volta, joga a ida em casa] pela pontuação de ranking. */
function orderByRanking(edition, a, b) {
  return rankScore(edition, a) >= rankScore(edition, b) ? [a, b] : [b, a];
}

/** Pote 1 (melhores) × pote 2, sorteados; o pote 1 manda a volta. */
function seededTwoLeg(edition, competitionId, stage, ranked, { avoidSameCountry = false } = {}) {
  const half = Math.floor(ranked.length / 2);
  const pot1 = shuffle(edition, ranked.slice(0, half));
  let pot2 = shuffle(edition, ranked.slice(half));
  if (avoidSameCountry) pot2 = matchAvoiding(edition, pot1, pot2, (a, b) => edition.countries[a] !== edition.countries[b]);
  const pairs = pot1.map((seed, i) => [seed, pot2[i]]).filter(([a, b]) => a && b);
  return twoLegFromPairs(edition, competitionId, stage, pairs);
}

/** Reordena `pool` para casar com `fixed` respeitando `ok`, se der. */
function matchAvoiding(edition, fixed, pool, ok) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const candidate = attempt ? shuffle(edition, pool) : [...pool];
    if (fixed.every((team, i) => !candidate[i] || ok(team, candidate[i]))) return candidate;
  }
  return pool;
}

/** Cada par é [manda a volta, manda a ida]. */
function twoLegFromPairs(edition, competitionId, stage, pairs) {
  const ties = pairs.map(([seeded, other], index) => {
    const tieId = `${competitionId}-${edition.season}-${stage}-${index + 1}`;
    const ida = makeGame(edition, competitionId, { stage, home: other, away: seeded, leg: 'IDA', tieId, index });
    const volta = makeGame(edition, competitionId, { stage, home: seeded, away: other, leg: 'VOLTA', tieId, index });
    return { id: tieId, index: index + 1, home: other, away: seeded, games: [ida.id, volta.id], winner: null, loser: null };
  });
  return { ties };
}

/** 1ª fase da Sul-Americana: clássicos nacionais em jogo único. */
function derbyFirstStage(edition, entries) {
  const byCountry = {};
  entries.forEach(entry => {
    if (!entry?.club) return;
    (byCountry[entry.country] = byCountry[entry.country] || []).push(entry.club);
  });
  const ties = [];
  let index = 0;
  Object.keys(byCountry).sort().forEach(country => {
    const drawn = shuffle(edition, byCountry[country]);
    for (let i = 0; i + 1 < drawn.length; i += 2) {
      const tieId = `sudamericana-${edition.season}-FS-${index + 1}`;
      const game = makeGame(edition, 'sudamericana', { stage: 'FS', home: drawn[i], away: drawn[i + 1], leg: 'JOGO ÚNICO', tieId, index });
      ties.push({ id: tieId, index: index + 1, home: drawn[i], away: drawn[i + 1], games: [game.id], winner: null, loser: null, single: true });
      index += 1;
    }
  });
  return { ties };
}

/**
 * Sorteio dos grupos: 4 potes de 8 pelo ranking; o campeão da Libertadores é
 * cabeça do grupo A. Dois clubes do mesmo país não caem no mesmo grupo
 * (o sorteio relaxa a regra se não houver saída).
 */
function drawGroups(edition, competitionId, teams) {
  const holder = competitionId === 'libertadores' && teams.includes(edition.titleHolder) ? edition.titleHolder : null;
  const ranked = byRanking(edition, teams.filter(team => team !== holder));
  const ordered = holder ? [holder, ...ranked] : ranked;
  const pots = [0, 1, 2, 3].map(p => ordered.slice(p * 8, p * 8 + 8));

  let groups = null;
  for (let attempt = 0; attempt < 400 && !groups; attempt += 1) {
    const relax = attempt > 300;
    const trial = GROUP_LETTERS.map(() => []);
    const head = holder ? [pots[0][0], ...shuffle(edition, pots[0].slice(1))] : shuffle(edition, pots[0]);
    head.forEach((team, g) => trial[g].push(team));
    let failed = false;
    for (let p = 1; p < 4 && !failed; p += 1) {
      const pot = shuffle(edition, pots[p]);
      for (const team of pot) {
        const country = edition.countries[team];
        const open = trial.map((g, i) => i).filter(i => trial[i].length === p);
        const fit = open.filter(i => relax || !trial[i].some(t => edition.countries[t] === country));
        if (!fit.length) { failed = true; break; }
        trial[fit[0]].push(team);
      }
    }
    if (!failed && trial.every(g => g.length === Math.min(4, pots.filter(pot => pot.length).length))) groups = trial;
  }
  groups = groups || GROUP_LETTERS.map((_, g) => pots.map(pot => pot[g]).filter(Boolean));

  const record = { groups: {} };
  groups.forEach((teamsInGroup, g) => {
    const letter = GROUP_LETTERS[g];
    record.groups[letter] = teamsInGroup;
    GROUP_ROUNDS.forEach((pairs, round) => {
      pairs.forEach(([h, a], k) => {
        const home = teamsInGroup[h];
        const away = teamsInGroup[a];
        if (!home || !away) return;
        makeGame(edition, competitionId, { stage: 'G', home, away, matchday: round + 1, group: letter, index: g * 2 + k });
      });
    });
  });
  return record;
}

/** Oitavas: pote 1 (líderes) × pote 2; o líder manda a volta. */
function drawRoundOf16(edition, competitionId, winners, runnersUp, groupOf = {}) {
  const pot1 = shuffle(edition, winners);
  const pot2 = matchAvoiding(edition, pot1, shuffle(edition, runnersUp), (a, b) => !groupOf[a] || groupOf[a] !== groupOf[b]);
  return twoLegFromPairs(edition, competitionId, 'R16', pot1.map((seed, i) => [seed, pot2[i]]).filter(([a, b]) => a && b));
}

function singleFinal(edition, competitionId, [a, b]) {
  const [first, second] = orderByCampaign(edition, competitionId, a, b);
  const city = NEUTRAL_FINAL_CITIES[Math.floor(nextRandom(edition) * NEUTRAL_FINAL_CITIES.length)];
  const tieId = `${competitionId}-${edition.season}-F-1`;
  const game = makeGame(edition, competitionId, { stage: 'F', home: first, away: second, leg: 'JOGO ÚNICO', tieId, neutral: true, index: 0 });
  game.venue = city;
  edition[competitionId].finalVenue = city;
  return { ties: [{ id: tieId, index: 1, home: first, away: second, games: [game.id], winner: null, loser: null, single: true, final: true }] };
}

/* --------------------------------------------------------------------------
 * Classificação
 * ------------------------------------------------------------------------ */

function blankRow(club) {
  return { club, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, awayGoals: 0, points: 0 };
}

function applyResult(rows, game) {
  const home = rows[game.home] || (rows[game.home] = blankRow(game.home));
  const away = rows[game.away] || (rows[game.away] = blankRow(game.away));
  const hg = Number(game.homeGoals) || 0;
  const ag = Number(game.awayGoals) || 0;
  home.played += 1; away.played += 1;
  home.goalsFor += hg; home.goalsAgainst += ag;
  away.goalsFor += ag; away.goalsAgainst += hg; away.awayGoals += ag;
  if (hg > ag) { home.won += 1; home.points += 3; away.lost += 1; }
  else if (hg < ag) { away.won += 1; away.points += 3; home.lost += 1; }
  else { home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1; }
}

function compareRows(a, b) {
  return (b.points - a.points)
    || ((b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst))
    || (b.goalsFor - a.goalsFor)
    || (b.awayGoals - a.awayGoals)
    || (a.lost - b.lost)
    || a.club.localeCompare(b.club, 'pt-BR');
}

/** Tabela de um grupo, ordenada pelos critérios da CONMEBOL. */
export function conmebolGroupTable(edition, competitionId, letter) {
  const teams = edition?.[competitionId]?.stages?.G?.groups?.[letter] || [];
  const rows = Object.fromEntries(teams.map(club => [club, blankRow(club)]));
  edition.fixtures
    .filter(game => game.competitionId === competitionId && game.stage === 'G' && game.group === letter && isDone(game))
    .forEach(game => applyResult(rows, game));
  return Object.values(rows).sort(compareRows).map(row => ({ ...row, goalDiff: row.goalsFor - row.goalsAgainst }));
}

/** Campanha na competição inteira (para mando nos mata-matas e playoffs). */
function campaignRow(edition, competitionId, club, stages = null) {
  const rows = {};
  edition.fixtures
    .filter(game => game.competitionId === competitionId && (game.home === club || game.away === club) && isDone(game))
    .filter(game => !stages || stages.includes(game.stage))
    .forEach(game => applyResult(rows, game));
  return rows[club] || blankRow(club);
}

/** [melhor campanha manda a volta, o outro manda a ida]. */
function orderByCampaign(edition, competitionId, a, b) {
  const ra = campaignRow(edition, competitionId, a);
  const rb = campaignRow(edition, competitionId, b);
  return compareRows(ra, rb) <= 0 ? [a, b] : [b, a];
}

/* --------------------------------------------------------------------------
 * Resolução de confrontos
 * ------------------------------------------------------------------------ */

function tieGames(edition, tie) {
  return tie.games.map(id => gameById(edition, id)).filter(Boolean);
}

function aggregateOf(games) {
  const totals = new Map();
  games.forEach(game => {
    totals.set(game.home, (totals.get(game.home) || 0) + (Number(game.homeGoals) || 0));
    totals.set(game.away, (totals.get(game.away) || 0) + (Number(game.awayGoals) || 0));
  });
  return totals;
}

function resolveTie(edition, tie, hooks) {
  if (tie.winner) return tie.winner;
  const games = tieGames(edition, tie);
  if (!games.length || !games.every(isDone)) return null;
  const totals = aggregateOf(games);
  const a = tie.home;
  const b = tie.away;
  const ga = totals.get(a) || 0;
  const gb = totals.get(b) || 0;
  let winner = ga > gb ? a : gb > ga ? b : null;
  const decider = games[games.length - 1];
  if (!winner && decider.shootoutWinner) winner = decider.shootoutWinner;
  if (!winner && decider.extraTimeWinner) winner = decider.extraTimeWinner;
  if (!winner) {
    const involvesUser = games.some(game => hooks.isUserFixture?.(game));
    // Jogo do usuário decide nos pênaltis ao vivo; só resolve sozinho se a
    // tela não gravou (ex.: simulação rápida).
    if (involvesUser && !hooks.allowUserAutoShootout) return null;
    const shootout = hooks.resolveShootout?.(decider.home, decider.away, decider) || null;
    winner = shootout?.winner || (rankScore(edition, a) >= rankScore(edition, b) ? a : b);
    decider.shootoutWinner = winner;
    if (shootout?.score) {
      decider.penalties = shootout.score;
      decider.shootoutPenalties = shootout.score;
    }
  }
  tie.winner = winner;
  tie.loser = winner === a ? b : a;
  games.forEach(game => { game.winner = winner; });
  edition.events.push({ type: 'tie-decided', competitionId: decider.competitionId, stage: decider.stage, winner, loser: tie.loser, tieId: tie.id });
  return winner;
}

/* --------------------------------------------------------------------------
 * Avanço
 * ------------------------------------------------------------------------ */

function stageComplete(edition, competitionId, stage, hooks) {
  const record = edition[competitionId].stages[stage];
  if (!record) return false;
  if (record.completed) return true;
  if (record.groups) {
    const games = edition.fixtures.filter(game => game.competitionId === competitionId && game.stage === 'G');
    if (!games.length || !games.every(isDone)) return false;
  } else if (!record.ties.every(tie => resolveTie(edition, tie, hooks))) {
    return false;
  }
  record.completed = true;
  return true;
}

function groupPlacings(edition, competitionId) {
  const record = edition[competitionId].stages.G;
  const placings = { first: [], second: [], third: [], fourth: [], groupOf: {} };
  Object.keys(record.groups).sort().forEach(letter => {
    const table = conmebolGroupTable(edition, competitionId, letter);
    table.forEach((row, i) => {
      placings.groupOf[row.club] = letter;
      [placings.first, placings.second, placings.third, placings.fourth][i]?.push(row.club);
    });
  });
  return placings;
}

function closeGroupStage(edition, competitionId) {
  const record = edition[competitionId].stages.G;
  if (record.closed) return groupPlacings(edition, competitionId);
  record.closed = true;
  const placings = groupPlacings(edition, competitionId);
  // Bônus por vitória na fase de grupos.
  edition.fixtures
    .filter(game => game.competitionId === competitionId && game.stage === 'G' && isDone(game))
    .forEach(game => {
      const winner = game.homeGoals > game.awayGoals ? game.home : game.awayGoals > game.homeGoals ? game.away : null;
      if (winner && edition[competitionId].progress[winner]) edition[competitionId].progress[winner].groupWins += 1;
    });
  const out = competitionId === 'libertadores' ? [...placings.fourth] : [...placings.third, ...placings.fourth];
  out.forEach(club => markEliminated(edition, competitionId, club, 'G'));
  if (competitionId === 'libertadores') {
    placings.third.forEach(club => markEliminated(edition, competitionId, club, 'G'));
  }
  edition.events.push({ type: 'groups-closed', competitionId });
  return placings;
}

function eliminateLosers(edition, competitionId, stage) {
  edition[competitionId].stages[stage].ties.forEach(tie => {
    if (tie.loser) markEliminated(edition, competitionId, tie.loser, stage);
  });
}

function winnersOf(edition, competitionId, stage) {
  return edition[competitionId].stages[stage].ties.map(tie => tie.winner).filter(Boolean);
}

/** Abre as fases seguintes que já estão prontas. Retorna true se algo mudou. */
function cascade(edition, hooks) {
  let changed = false;
  const lib = edition.libertadores;
  const sud = edition.sudamericana;
  const open = (id, stage, participants) => {
    if (edition[id].stages[stage]) return;
    if (openStage(edition, id, stage, participants)) changed = true;
  };

  // Libertadores: preliminares.
  if (lib.stages.F1 && !lib.stages.F2 && stageComplete(edition, 'libertadores', 'F1', hooks)) {
    eliminateLosers(edition, 'libertadores', 'F1');
    open('libertadores', 'F2', winnersOf(edition, 'libertadores', 'F1'));
  }
  if (lib.stages.F2 && !lib.stages.F3 && stageComplete(edition, 'libertadores', 'F2', hooks)) {
    eliminateLosers(edition, 'libertadores', 'F2');
    const ordered = lib.stages.F2.ties.map(tie => tie.winner);
    open('libertadores', 'F3', ordered);
  }
  const f3Done = lib.stages.F3 && stageComplete(edition, 'libertadores', 'F3', hooks);
  const fsDone = sud.stages.FS && stageComplete(edition, 'sudamericana', 'FS', hooks);
  if (f3Done && !lib.stages.G) {
    eliminateLosers(edition, 'libertadores', 'F3');
    open('libertadores', 'G', [...clubsOf(lib.entrants.group), ...winnersOf(edition, 'libertadores', 'F3')]);
  }
  // Sul-Americana: grupos precisam dos vencedores da 1ª fase e dos perdedores
  // da 3ª fase da Libertadores.
  if (f3Done && fsDone && !sud.stages.G) {
    eliminateLosers(edition, 'sudamericana', 'FS');
    const libLosers = lib.stages.F3.ties.map(tie => tie.loser).filter(Boolean);
    libLosers.forEach(club => { edition.countries[club] = edition.countries[club] || 'BRA'; });
    open('sudamericana', 'G', [...clubsOf(sud.entrants.group), ...winnersOf(edition, 'sudamericana', 'FS'), ...libLosers]);
  }

  // Grupos → oitavas e playoffs.
  const libGroupsDone = lib.stages.G && stageComplete(edition, 'libertadores', 'G', hooks);
  const sudGroupsDone = sud.stages.G && stageComplete(edition, 'sudamericana', 'G', hooks);
  if (libGroupsDone && !lib.stages.R16) {
    const placings = closeGroupStage(edition, 'libertadores');
    open('libertadores', 'R16', { winners: placings.first, runnersUp: placings.second, groupOf: placings.groupOf });
  }
  if (libGroupsDone && sudGroupsDone && !sud.stages.PO) {
    const libPlacings = closeGroupStage(edition, 'libertadores');
    const sudPlacings = closeGroupStage(edition, 'sudamericana');
    const sudSeconds = [...sudPlacings.second].sort((a, b) => compareRows(campaignRow(edition, 'sudamericana', a, ['G']), campaignRow(edition, 'sudamericana', b, ['G'])));
    const libThirds = [...libPlacings.third].sort((a, b) => compareRows(campaignRow(edition, 'libertadores', a, ['G']), campaignRow(edition, 'libertadores', b, ['G'])));
    libThirds.forEach(club => { edition.countries[club] = edition.countries[club] || 'BRA'; });
    // Melhor 2º da Sul × pior 3º da Liberta; o da Sul manda a volta.
    const pairs = sudSeconds.map((club, i) => [club, libThirds[libThirds.length - 1 - i]]).filter(([a, b]) => a && b);
    open('sudamericana', 'PO', pairs);
  }
  if (sud.stages.PO && !sud.stages.R16 && stageComplete(edition, 'sudamericana', 'PO', hooks)) {
    eliminateLosers(edition, 'sudamericana', 'PO');
    const placings = groupPlacings(edition, 'sudamericana');
    open('sudamericana', 'R16', { winners: placings.first, runnersUp: winnersOf(edition, 'sudamericana', 'PO') });
  }

  // Mata-mata até a final.
  ['libertadores', 'sudamericana'].forEach(id => {
    const comp = edition[id];
    [['R16', 'QF'], ['QF', 'SF'], ['SF', 'F']].forEach(([from, to]) => {
      if (comp.stages[from] && !comp.stages[to] && stageComplete(edition, id, from, hooks)) {
        eliminateLosers(edition, id, from);
        open(id, to, winnersOf(edition, id, from));
      }
    });
    if (comp.stages.F && !comp.champion && stageComplete(edition, id, 'F', hooks)) {
      const tie = comp.stages.F.ties[0];
      comp.champion = tie.winner;
      comp.runnerUp = tie.loser;
      if (comp.progress[tie.winner]) comp.progress[tie.winner].result = 'champion';
      if (comp.progress[tie.loser]) {
        comp.progress[tie.loser].result = 'runnerUp';
        comp.progress[tie.loser].eliminatedAt = 'F';
      }
      edition.events.push({ type: 'champion', competitionId: id, club: tie.winner, runnerUp: tie.loser });
      changed = true;
    }
  });
  return changed;
}

/**
 * Simula os jogos da IA até `date` (inclusive) e abre as fases que ficarem
 * prontas. Jogos do usuário ficam esperando a partida ao vivo.
 *
 * @param {object} edition
 * @param {Date} date
 * @param {object} hooks
 * @param {(game: object) => {homeGoals:number, awayGoals:number}} hooks.simulateGame
 * @param {(home:string, away:string, game:object) => {winner:string, score?:string}} [hooks.resolveShootout]
 * @param {(game: object) => boolean} [hooks.isUserFixture]
 * @param {(game: object) => string|null} [hooks.resolveExtraTime] vencedor na prorrogação da final
 * @returns {boolean} se algo mudou
 */
export function advanceConmebolThroughDate(edition, date, hooks = {}) {
  if (!edition) return false;
  const limit = date instanceof Date ? date.getTime() : new Date(date).getTime();
  let changed = false;
  for (let guard = 0; guard < 40; guard += 1) {
    let simulated = false;
    edition.fixtures
      .filter(game => !game.completed && game.date && new Date(game.date).getTime() <= limit)
      .sort((a, b) => new Date(a.date) - new Date(b.date) || a.gameNumber - b.gameNumber)
      .forEach(game => {
        if (hooks.isUserFixture?.(game)) return;
        const result = hooks.simulateGame?.(game);
        if (!result) return;
        game.homeGoals = Number(result.homeGoals) || 0;
        game.awayGoals = Number(result.awayGoals) || 0;
        if (result.data) game.data = result.data;
        if (result.goals) game.goals = result.goals;
        game.completed = true;
        if (game.stage === 'F' && game.homeGoals === game.awayGoals) {
          const extra = hooks.resolveExtraTime?.(game);
          if (extra) game.extraTimeWinner = extra;
        }
        simulated = true;
      });
    const opened = cascade(edition, hooks);
    if (simulated || opened) changed = true;
    if (!simulated && !opened) break;
  }
  return changed;
}

/** Depois de gravar o placar ao vivo do usuário, avança o que der. */
export function onConmebolGameCompleted(edition, game, hooks = {}) {
  if (!edition || !game) return false;
  return cascade(edition, hooks);
}

/* --------------------------------------------------------------------------
 * Consultas
 * ------------------------------------------------------------------------ */

export function conmebolFixtures(edition) {
  return edition?.fixtures || [];
}

export function conmebolClubFixtures(edition, club) {
  return conmebolFixtures(edition).filter(game => game.home === club || game.away === club);
}

/** Em qual competição e fase o clube está (ou onde parou). Prefere a que ainda disputa. */
export function conmebolClubStatus(edition, club) {
  const rows = ['libertadores', 'sudamericana']
    .map(id => ({ id, row: edition?.[id]?.progress?.[club] }))
    .filter(item => item.row);
  if (!rows.length) return null;
  const alive = item => !item.row.eliminatedAt && item.row.result !== 'runnerUp';
  const pick = rows.find(alive) || rows[rows.length - 1];
  const lastStage = pick.row.stages[pick.row.stages.length - 1];
  return {
    competitionId: pick.id,
    label: CONMEBOL_COMPETITIONS[pick.id].label,
    stage: lastStage,
    stageLabel: STAGE_LABELS[lastStage],
    eliminatedAt: pick.row.eliminatedAt,
    result: pick.row.result,
    alive: alive(pick),
  };
}

/** Todos os clubes que disputam alguma das copas nesta edição. */
export function conmebolParticipants(edition) {
  return Object.keys(edition?.countries || {});
}

/** Retira os eventos acumulados (mensagens, premiação). */
export function drainConmebolEvents(edition) {
  if (!edition?.events?.length) return [];
  const out = edition.events;
  edition.events = [];
  return out;
}

/* --------------------------------------------------------------------------
 * Save
 * ------------------------------------------------------------------------ */

const DATE_KEYS = ['date', 'windowStart', 'windowEnd'];

export function serializeConmebolEdition(edition) {
  if (!edition) return null;
  return {
    ...edition,
    fixtures: edition.fixtures.map(game => {
      const out = { ...game };
      DATE_KEYS.forEach(key => { if (out[key] instanceof Date) out[key] = out[key].toISOString(); });
      // Estatísticas detalhadas só dos jogos com brasileiro, para o save não inchar.
      if (out.data && edition.countries[out.home] !== 'BRA' && edition.countries[out.away] !== 'BRA') delete out.data;
      return out;
    }),
  };
}

export function hydrateConmebolEdition(saved) {
  if (!saved || saved.version !== CONMEBOL_EDITION_VERSION || !Array.isArray(saved.fixtures)) return null;
  return {
    ...saved,
    events: Array.isArray(saved.events) ? saved.events : [],
    fixtures: saved.fixtures.map(game => {
      const out = { ...game };
      DATE_KEYS.forEach(key => { if (out[key]) out[key] = new Date(out[key]); });
      return out;
    }),
  };
}

export { LIBERTADORES, SUDAMERICANA };
