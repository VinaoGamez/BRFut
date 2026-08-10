const completed = game => game && game.home && game.away && Number.isFinite(Number(game.homeGoals)) && Number.isFinite(Number(game.awayGoals));
function addGame(stats, game, club) { if (!completed(game) || (game.home !== club && game.away !== club)) return; const home = game.home === club; const own = Number(home ? game.homeGoals : game.awayGoals); const opp = Number(home ? game.awayGoals : game.homeGoals); stats.played += 1; if (own > opp) stats.wins += 1; else if (own < opp) stats.losses += 1; else stats.draws += 1; }
function fixtures(value, result = [], seen = new Set()) { if (!value || typeof value !== 'object' || seen.has(value)) return result; seen.add(value); if (completed(value)) { result.push(value); return result; } Object.values(value).forEach(child => { if (Array.isArray(child)) child.forEach(item => fixtures(item, result, seen)); else fixtures(child, result, seen); }); return result; }
const titleLabels = { A: 'Campeonato Brasileiro Série A', B: 'Campeonato Brasileiro Série B', C: 'Campeonato Brasileiro Série C', D: 'Campeonato Brasileiro Série D', CUP: 'Copa do Brasil', RECOPA: 'Recopa Nacional', LIBERTADORES: 'Libertadores', SUDAMERICANA: 'Sul-Americana', WORLD_CUP: 'Mundial de Clubes', CMU: 'Mundial de Clubes' };
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
      const key = String(log?.fixtureId || log?.id || [
        log?.competition,
        log?.round,
        log?.date,
        log?.home,
        log?.away,
      ].join('|'));
      if (seenGames.has(key)) return;
      seenGames.add(key);
      uniqueLogs.push(log);
    });
  const isLeagueLog = log => {
    const competition = String(log?.competition || '').toUpperCase();
    return ['A', 'B', 'C', 'D', 'LEAGUE', 'BRASILEIRO'].includes(competition)
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
    if (log.competition) current.competitions.push(String(log.competition).replaceAll('_', ' '));
  });
  rankingTitles.filter(item => Number(item.season) === Number(currentSeason)).forEach(item => { const key = titleKey(item.competition); current.titles.push({ key, label: titleLabels[key] || item.competition }); }); current.competitions = [...new Set(current.competitions)];
  return [current, ...archives.map(archive => archiveSeason(archive, clubName))].filter((item, index, all) => all.findIndex(other => Number(other.year) === Number(item.year)) === index).sort((a, b) => Number(b.year) - Number(a.year));
}
