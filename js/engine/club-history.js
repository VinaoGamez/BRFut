const completed = game => game && game.home && game.away && Number.isFinite(Number(game.homeGoals)) && Number.isFinite(Number(game.awayGoals));
function addGame(stats, game, club) { if (!completed(game) || (game.home !== club && game.away !== club)) return; const home = game.home === club; const own = Number(home ? game.homeGoals : game.awayGoals); const opp = Number(home ? game.awayGoals : game.homeGoals); stats.played += 1; if (own > opp) stats.wins += 1; else if (own < opp) stats.losses += 1; else stats.draws += 1; }
function fixtures(value, result = [], seen = new Set()) { if (!value || typeof value !== 'object' || seen.has(value)) return result; seen.add(value); if (completed(value)) { result.push(value); return result; } Object.values(value).forEach(child => { if (Array.isArray(child)) child.forEach(item => fixtures(item, result, seen)); else fixtures(child, result, seen); }); return result; }
const titleLabels = { A: 'Campeonato Brasileiro Série A', B: 'Campeonato Brasileiro Série B', C: 'Campeonato Brasileiro Série C', D: 'Campeonato Brasileiro Série D', CUP: 'Copa do Brasil', RECOPA: 'Recopa Nacional', LIBERTADORES: 'Libertadores', SUDAMERICANA: 'Sul-Americana', RECOPA_SUL: 'Recopa Sul-Americana', INTERCONTINENTAL: 'Copa Intercontinental', MUNDIAL_CLUBES: 'Copa do Mundo de Clubes da FIFA', WORLD_CUP: 'Mundial de Clubes', CMU: 'Mundial de Clubes' };
const competitionDisplayName = raw => {
  const value = String(raw || '').toUpperCase();
  if (value.startsWith('LEAGUE:')) return `Campeonato Brasileiro Série ${value.slice(7)}`;
  if (value === 'CBR' || value.includes('COPA DO BRASIL')) return 'Copa do Brasil';
  if (value.startsWith('ESTADUAL')) return 'Campeonato Estadual';
  if (value === 'CMU') return 'Mundial de Clubes';
  if (value.includes('SUL-AMERICANA')) return 'Sul-Americana';
  if (value.includes('LIBERTADORES')) return 'Libertadores';
  return String(raw).replaceAll('_', ' ');
};
const titleKey = key => String(key || '').toUpperCase().startsWith('EST') ? 'ESTADUAIS' : String(key || '').toUpperCase();

function archiveSeason(archive, club) {
  const stats = { year: archive.careerSeason, played: 0, wins: 0, draws: 0, losses: 0, competitions: [], titles: [] };
  Object.entries(archive.standings || {}).some(([division, rows]) => { const row = Array.isArray(rows) ? rows.find(item => (item.club || item.name || item.team) === club) : null; if (!row) return false; stats.played += Number(row.played || row.games || 0); stats.wins += Number(row.wins || 0); stats.draws += Number(row.draws || 0); stats.losses += Number(row.losses || 0); stats.competitions.push(`Campeonato Brasileiro Série ${division}`); return true; });
  [['Copa do Brasil', archive.cupCompetition], ['Recopa Nacional', archive.recopaCompetition], ['Mundial de Clubes', archive.worldCupCompetition], ['Campeonato Estadual', archive.stateLeagueSnapshot || archive.stateLeagueResults]].forEach(([label, source]) => { const games = fixtures(source).filter(game => game.home === club || game.away === club); if (!games.length) return; stats.competitions.push(label); games.forEach(game => addGame(stats, game, club)); });
  Object.entries(archive.champions || {}).forEach(([key, champion]) => { if (champion !== club) return; const normalized = titleKey(key); stats.titles.push({ key: normalized, label: titleLabels[normalized] || key }); });
  const state = archive.stateLeagueSnapshot || archive.stateLeagueResults; const stateTitle = Object.values(state || {}).find(item => item?.champion === club); if (stateTitle && !stats.titles.some(item => item.key === 'ESTADUAIS')) stats.titles.push({ key: 'ESTADUAIS', label: stateTitle.label || 'Campeonato Estadual' });
  stats.competitions = [...new Set(stats.competitions)]; return stats;
}

export function buildClubHistory({ clubName, currentSeason, currentLogs = [], currentStanding = null, archives = [], rankingTitles = [] } = {}) {
  const current = { year: currentSeason, played: 0, wins: 0, draws: 0, losses: 0, competitions: [], titles: [] };
  const uniqueLogs = [];
  const seenGames = new Set();
  currentLogs
    .filter(log => log?.season == null || Number(log.season) === Number(currentSeason))
    .forEach(log => {
      // Mesma partida chega pelo calendário e pelo relatório guardado, com
      // ids e nomes de competição diferentes: a chave usa só o confronto.
      const key = [log?.home, log?.away, log?.homeGoals, log?.awayGoals, log?.leg || ''].join('|');
      if (seenGames.has(key)) return;
      seenGames.add(key);
      uniqueLogs.push(log);
    });
  const isLeagueLog = log => {
    const competition = String(log?.competition || '').toUpperCase();
    return ['A', 'B', 'C', 'D', 'LEAGUE', 'BRASILEIRO'].includes(competition)
      || competition.startsWith('LEAGUE')
      || competition.includes('SERIE')
      || competition.includes('SÉRIE');
  };
  // A classificação é a fonte autoritativa do Brasileiro, inclusive quando o
  // buffer local de partidas foi compactado. Os logs complementam somente as
  // outras competições.
  if (currentStanding) {
    current.played = Number(currentStanding.played || currentStanding.games || 0);
    current.wins = Number(currentStanding.wins || 0); current.draws = Number(currentStanding.draws || 0); current.losses = Number(currentStanding.losses || 0);
    const division = currentStanding.division || currentStanding.group || '';
    current.competitions.push(division ? `Campeonato Brasileiro Série ${division}` : 'Campeonato Brasileiro');
  }
  uniqueLogs.forEach(log => {
    if (!(currentStanding && isLeagueLog(log))) addGame(current, log, clubName);
    if (log.competition) current.competitions.push(competitionDisplayName(log.competition));
  });
  rankingTitles.filter(item => Number(item.season) === Number(currentSeason)).forEach(item => { const key = titleKey(item.competition); current.titles.push({ key, label: titleLabels[key] || item.competition }); }); current.competitions = [...new Set(current.competitions)];
  return [current, ...archives.map(archive => archiveSeason(archive, clubName))].filter((item, index, all) => all.findIndex(other => Number(other.year) === Number(item.year)) === index).sort((a, b) => Number(b.year) - Number(a.year));
}

/* ===== Histórico do clube v2 ===== */
const DIV_ORDER = { A: 1, B: 2, C: 3, D: 4 };
const sortRows = rows => [...rows].sort((a, b) => (b.points || 0) - (a.points || 0) || (b.goalDiff || 0) - (a.goalDiff || 0) || (b.wins || 0) - (a.wins || 0));
const involves = (game, club) => game && (game.home === club || game.away === club);
const done = game => completed(game);
const gameKey = game => [game.home, game.away, game.homeGoals, game.awayGoals, game.leg || '', game.phase || ''].join('|');

function collectGames(value, out = [], seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return out;
  seen.add(value);
  if (value.home && value.away && 'homeGoals' in value) { out.push(value); return out; }
  Object.values(value).forEach(child => {
    if (Array.isArray(child)) child.forEach(item => collectGames(item, out, seen));
    else if (child && typeof child === 'object') collectGames(child, out, seen);
  });
  return out;
}

function stateResult(results, club) {
  for (const divisions of Object.values(results || {})) {
    for (const division of Array.isArray(divisions) ? divisions : []) {
      if (division?.champion === club) return { result: 'CAMPEÃO', tone: 'gold', title: true };
      if (division?.runnerUp === club) return { result: 'Vice', tone: 'mut' };
      if ((division?.semifinalists || []).includes(club)) return { result: 'Semifinal', tone: 'cyan' };
    }
  }
  return null;
}

function cupResult(cup, club) {
  const stages = [...(cup?.stages || [])].sort((a, b) => (a.index || 0) - (b.index || 0));
  let last = null;
  stages.forEach(stage => { if ((stage.fixtures || []).some(game => involves(game, club))) last = stage; });
  if (!last) return null;
  if (cup.champion === club) return { result: 'CAMPEÃO', tone: 'gold', title: true };
  const won = (last.winners || []).includes(club);
  if (won) return { result: `${last.name} · avançou`, tone: 'cyan' };
  const allDone = (last.fixtures || []).filter(game => involves(game, club)).every(done);
  return { result: last.name, tone: allDone && last.completed ? 'mut' : 'cyan' };
}

function serieDResult(serieD, club) {
  if (!serieD) return null;
  if (serieD.knockout?.champion === club) return { result: 'CAMPEÃO', tone: 'gold', title: true };
  if ((serieD.knockout?.promoted || []).includes(club)) return { result: 'ACESSO', tone: 'green' };
  return null;
}

function seasonFromArchive(archive, club, extra = {}) {
  const season = { year: Number(archive.careerSeason), division: null, position: null, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, comps: [], titles: [], games: [] };
  const games = new Map();
  const add = list => list.filter(game => involves(game, club) && done(game)).forEach(game => games.set(gameKey(game), game));
  // Brasileiro: posição + campanha pela classificação (fonte oficial).
  let leagueRow = null;
  for (const division of ['A', 'B', 'C', 'D']) {
    const rows = archive.standings?.[division] || [];
    const index = rows.findIndex(row => row.club === club);
    if (index < 0) continue;
    leagueRow = rows[index];
    season.division = division;
    season.position = rows.length <= 24 ? sortRows(rows).findIndex(row => row.club === club) + 1 : null;
    break;
  }
  if (leagueRow) {
    season.played += leagueRow.played || 0; season.wins += leagueRow.wins || 0; season.draws += leagueRow.draws || 0; season.losses += leagueRow.losses || 0;
    const dRes = season.division === 'D' ? serieDResult(archive.serieDCompetition, club) : null;
    const champ = archive.champions?.[season.division] === club;
    season.comps.push({ name: `Série ${season.division}`, result: champ ? 'CAMPEÃO' : dRes?.result || (season.position ? `${season.position}º lugar` : 'Fase de grupos'), tone: champ ? 'gold' : dRes?.tone || (season.position && season.position <= 4 ? 'cyan' : 'mut'), title: champ || !!dRes?.title });
  }
  // Jogos de outras competições (contam na campanha).
  const leagueGames = collectGames(archive.competitionRoundHistory || {}).filter(game => involves(game, club) && done(game));
  leagueGames.forEach(game => games.set(gameKey(game), { ...game, _league: true }));
  const cupGames = collectGames(archive.cupCompetition || {}).filter(game => involves(game, club) && done(game));
  const stateGames = collectGames(archive.stateLeagueSnapshot?.competitions || archive.stateLeagueSnapshot || {}).filter(game => involves(game, club) && done(game));
  const extraGames = (extra.games || []).filter(game => involves(game, club) && done(game));
  [...cupGames, ...stateGames, ...extraGames].forEach(game => {
    const key = gameKey(game);
    if (games.has(key)) return;
    games.set(key, game);
    addGame(season, game, club);
  });
  const st = stateResult(archive.stateLeagueResults, club);
  if (stateGames.length || st) season.comps.unshift({ name: 'Estadual', result: st?.result || 'Fase de grupos', tone: st?.tone || 'mut', title: !!st?.title });
  const cr = cupResult(archive.cupCompetition, club);
  if (cr) season.comps.push({ name: 'Copa do Brasil', ...cr });
  (extra.comps || []).forEach(comp => season.comps.push(comp));
  season.titles = season.comps.filter(comp => comp.title).map(comp => comp.name);
  (extra.titles || []).forEach(name => { if (!season.titles.includes(name)) season.titles.push(name); });
  season.games = [...games.values()];
  season.games.forEach(game => {
    const home = game.home === club;
    season.goalsFor += Number(home ? game.homeGoals : game.awayGoals) || 0;
    season.goalsAgainst += Number(home ? game.awayGoals : game.homeGoals) || 0;
  });
  return season;
}

/**
 * Histórico v2: temporadas (posição, campanha, resultado por competição),
 * sala de troféus e recordes. `liveArchive` = temporada em andamento no mesmo formato do arquivo.
 */
export function buildClubHistoryV2({ clubName, liveArchive = null, liveExtra = {}, archives = [], rankingTitles = [] } = {}) {
  const club = clubName;
  const list = [...archives.filter(Boolean)];
  if (liveArchive) list.push(liveArchive);
  const byYear = new Map();
  list.forEach(archive => byYear.set(Number(archive.careerSeason), archive));
  const years = [...byYear.keys()].filter(Number.isFinite).sort((a, b) => a - b);
  const seasons = years.map(year => {
    const archive = byYear.get(year);
    const isLive = archive === liveArchive;
    const extraTitles = rankingTitles.filter(item => Number(item.season) === year).map(item => titleLabels[titleKey(item.competition)] || item.competition);
    const season = seasonFromArchive(archive, club, isLive ? { ...liveExtra, titles: extraTitles } : { titles: extraTitles });
    season.live = isLive;
    return season;
  }).filter(season => season.division || season.comps.length || season.played);
  // Acesso / queda: divisão da temporada seguinte.
  seasons.forEach((season, index) => {
    const next = seasons[index + 1];
    if (!next || !season.division || !next.division) return;
    const diff = DIV_ORDER[next.division] - DIV_ORDER[season.division];
    season.move = diff < 0 ? 'up' : diff > 0 ? 'down' : null;
  });
  // Troféus por competição.
  const cabinet = new Map();
  seasons.forEach(season => season.comps.forEach(comp => {
    const entry = cabinet.get(comp.name) || { name: comp.name, count: 0, years: [], best: null, bestRank: 99 };
    if (comp.title) { entry.count += 1; entry.years.push(season.year); }
    const rank = comp.title ? 0 : comp.tone === 'cyan' || comp.tone === 'green' ? 1 : 2;
    if (rank < entry.bestRank) { entry.bestRank = rank; entry.best = `${comp.result} em ${season.year}`; }
    cabinet.set(comp.name, entry);
  }));
  seasons.forEach(season => season.titles.forEach(name => {
    if (cabinet.has(name) && cabinet.get(name).years.includes(season.year)) return;
    const entry = cabinet.get(name) || { name, count: 0, years: [], best: null, bestRank: 99 };
    entry.count += 1; entry.years.push(season.year);
    cabinet.set(name, entry);
  }));
  const trophies = [...cabinet.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
  // Recordes a partir dos jogos conhecidos.
  const allGames = seasons.flatMap(season => season.games.map(game => ({ ...game, year: season.year })));
  const margin = game => {
    const home = game.home === club;
    return (Number(home ? game.homeGoals : game.awayGoals) || 0) - (Number(home ? game.awayGoals : game.homeGoals) || 0);
  };
  const describe = game => {
    if (!game) return null;
    const home = game.home === club;
    const own = home ? game.homeGoals : game.awayGoals;
    const opp = home ? game.awayGoals : game.homeGoals;
    return { score: `${own} × ${opp}`, opponent: home ? game.away : game.home, year: game.year };
  };
  const biggestWin = allGames.filter(game => margin(game) > 0).sort((a, b) => margin(b) - margin(a) || (b.homeGoals + b.awayGoals) - (a.homeGoals + a.awayGoals))[0];
  const worstLoss = allGames.filter(game => margin(game) < 0).sort((a, b) => margin(a) - margin(b))[0];
  const totals = seasons.reduce((acc, season) => {
    acc.played += season.played; acc.wins += season.wins; acc.draws += season.draws; acc.losses += season.losses;
    acc.goalsFor += season.goalsFor; acc.goalsAgainst += season.goalsAgainst; return acc;
  }, { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 });
  const best = seasons.filter(season => season.division && season.position)
    .sort((a, b) => DIV_ORDER[a.division] - DIV_ORDER[b.division] || a.position - b.position)[0] || null;
  return {
    seasons: seasons.sort((a, b) => b.year - a.year),
    trophies,
    totals,
    best: best ? { label: `${best.position}º Série ${best.division}`, year: best.year } : null,
    records: { biggestWin: describe(biggestWin), worstLoss: describe(worstLoss) },
  };
}
