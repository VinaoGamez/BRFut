import { escapeHtml as esc } from '../../core/html-safe.js';
import { resolvePlayerSeasonStats } from '../../engine/player-history.js';
import { playerKey } from '../../engine/player-match-stats.js';
import '../../../css/squad-performance.css';

export function squadPerformanceRows(roster, history, season, club, competition = null, includeFormer = false) {
  const rows = (roster || []).map(player => ({
    player,
    stats: resolvePlayerSeasonStats(history, playerKey(player), season, competition, { clubId: club }),
  }));
  if (includeFormer) {
    const current = new Set((roster || []).map(playerKey));
    const store = history?.getStore?.() || history;
    for (const [key, record] of Object.entries(store?.players || {})) {
      if (current.has(key)) continue;
      const stats = resolvePlayerSeasonStats(store, key, season, competition, { clubId: club });
      if (stats?.apps > 0) rows.push({ player: { playerId: key, name: record.name, pos: record.pos || '—' }, stats, former: true });
    }
  }
  return rows;
}

/** Local history is authoritative; opening this panel never needs the API. */
export function createSquadPerformance({ root, getRoster, getHistory, getSeason, getClub }) {
  let selectedSeason = null;
  let competition = '';
  let sort = 'minutes';
  let includeFormer = true;
  const metrics = [
    ['apps', 'J'], ['starts', 'TIT'], ['minutes', 'MIN'], ['goals', 'G'],
    ['assists', 'A'], ['yellow', 'CA'], ['red', 'CV'], ['avgRating', 'NOTA'],
  ];
  const render = () => {
    if (!root) return;
    const source = getHistory();
    const history = source?.getStore?.() || source;
    const roster = getRoster() || [];
    const years = new Set([String(getSeason())]);
    for (const record of Object.values(history?.players || {})) {
      Object.keys(record.seasons || {}).forEach(year => years.add(year));
    }
    if (!selectedSeason || !years.has(selectedSeason)) selectedSeason = String(getSeason());
    const competitions = new Set();
    for (const record of Object.values(history?.players || {})) {
      const bucket = record.seasons?.[selectedSeason];
      for (const [id, stats] of Object.entries(bucket?.competitions || {})) {
        if (stats.clubs?.[getClub()]) competitions.add(id);
      }
    }
    if (!competitions.has(competition)) competition = '';
    const rows = squadPerformanceRows(roster, history, selectedSeason, getClub(), competition || null, includeFormer);
    rows.sort((a, b) => (Number(b.stats?.[sort]) || 0) - (Number(a.stats?.[sort]) || 0)
      || a.player.name.localeCompare(b.player.name, 'pt-BR'));
    root.innerHTML = `<h2>Desempenho do elenco</h2>
      <p>Números pelo ${esc(getClub())}. “Fora do elenco” identifica registros de jogadores que não estão no plantel atual. “—” indica ausência de registro; zero é um valor registrado.</p>
      <div class="roster-filters">
        <label>JOGADORES<select data-performance="players"><option value="all" ${includeFormer ? 'selected' : ''}>Histórico do clube</option><option value="current" ${!includeFormer ? 'selected' : ''}>Elenco atual</option></select></label>
        <label>TEMPORADA<select data-performance="season">${[...years].sort().reverse().map(year => `<option value="${esc(year)}" ${year === selectedSeason ? 'selected' : ''}>${esc(year)}</option>`).join('')}</select></label>
        <label>COMPETIÇÃO<select data-performance="competition"><option value="">Todas</option>${[...competitions].sort().map(id => `<option value="${esc(id)}" ${id === competition ? 'selected' : ''}>${esc(id)}</option>`).join('')}</select></label>
        <label>ORDENAR<select data-performance="sort">${metrics.map(([id, label]) => `<option value="${id}" ${id === sort ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      </div>
      <div class="roster-scroll"><table><caption>J: jogos · TIT: titularidades · MIN: minutos · G: gols · A: assistências · CA/CV: cartões · NOTA: média</caption>
      <thead><tr><th scope="col">JOGADOR</th><th scope="col">POS</th>${metrics.map(([, label]) => `<th scope="col">${label}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(({ player, stats, former }) => `<tr><th scope="row">${esc(player.name)}${former ? ' <small>(fora do elenco)</small>' : ''}</th><td>${esc(player.pos)}</td>${metrics.map(([id]) => `<td>${!stats || (id === 'avgRating' && stats[id] == null) ? '—' : id === 'avgRating' ? Number(stats[id]).toFixed(2).replace('.', ',') : Number(stats[id]) || 0}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${rows.some(row => row.stats) ? '' : '<p>Nenhuma estatística registrada neste filtro.</p>'}`;
  };
  root?.addEventListener('change', event => {
    const field = event.target.dataset.performance;
    if (field === 'season') selectedSeason = event.target.value;
    if (field === 'competition') competition = event.target.value;
    if (field === 'sort') sort = event.target.value;
    if (field === 'players') includeFormer = event.target.value === 'all';
    if (field) render();
  });
  return { render };
}
