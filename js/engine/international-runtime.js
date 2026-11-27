/**
 * Datas FIFA dentro da carreira: convocações, volta dos convocados e
 * Eliminatórias andando com o calendário.
 */

import { clubStoppages } from './international-calendar.js';
import { applyDutyReturn, resolveDutyReturn, selectCallUps } from './international-duty.js';
import {
  advanceQualifiersThroughDate,
  createConmebolQualifiers,
  qualifierTable,
  qualifierTeamName,
  qualifiersCycleForYear,
  QUALIFIERS_VERSION,
} from './conmebol-qualifiers.js';

const DAY_MS = 86_400_000;
const NATIONALITY_TO_CODE = Object.freeze({
  brasil: 'BRA', argentina: 'ARG', uruguai: 'URU', colombia: 'COL', equador: 'ECU',
  paraguai: 'PAR', chile: 'CHI', peru: 'PER', venezuela: 'VEN', bolivia: 'BOL',
});
const norm = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function stoppageDates(stoppage, year) {
  return {
    start: new Date(year, stoppage.start[0], stoppage.start[1], 0),
    end: new Date(year, stoppage.end[0], stoppage.end[1], 23, 59),
  };
}

export function createInternationalRuntime(deps) {
  const {
    getCareerSeason,
    getClubs,
    getUserClub,
    getSavedState = () => null,
    getQualifiersState = () => null,
    setQualifiersState = () => {},
    getCareerSeed = () => 0,
    getCapsLedger = () => ({}),
    setCapsLedger = () => {},
    pushMessage = () => {},
    injurePlayer = () => null,
    random = Math.random,
  } = deps;

  let state = null;

  const findPlayer = (clubName, playerId) => {
    const clubs = getClubs();
    const inClub = clubs?.[clubName]?.roster?.find(player => (player.playerId || player.id || player.name) === playerId);
    if (inClub) return { player: inClub, club: clubName };
    // Pode ter sido vendido durante a convocação.
    for (const [name, club] of Object.entries(clubs || {})) {
      const found = club?.roster?.find(player => (player.playerId || player.id || player.name) === playerId);
      if (found) return { player: found, club: name };
    }
    return null;
  };

  const init = () => {
    const season = Number(getCareerSeason());
    const saved = getSavedState();
    state = saved && Number(saved.season) === season ? { ...saved, windows: { ...(saved.windows || {}) } } : { season, windows: {} };
    // Os elencos são remontados a cada carga: devolve a convocação em curso e
    // o histórico pela seleção a quem tem.
    const ledger = getCapsLedger() || {};
    Object.values(getClubs() || {}).forEach(club => (club?.roster || []).forEach(player => {
      const key = player.playerId || player.id || player.name;
      if (ledger[key] && !player.internationalCareer) player.internationalCareer = { ...ledger[key] };
    }));
    Object.entries(state.windows).forEach(([windowId, entry]) => {
      if (entry?.status !== 'called') return;
      (entry.callups || []).forEach(call => {
        const found = findPlayer(call.club, call.playerId);
        if (found) found.player.internationalDuty = { windowId, team: call.team, worldCup: entry.kind === 'world-cup' };
      });
    });
  };

  const callUp = (stoppage, dates) => {
    const worldCup = stoppage.kind === 'world-cup';
    const calls = selectCallUps({ clubs: getClubs(), worldCup });
    calls.forEach(call => {
      const found = findPlayer(call.club, call.playerId);
      if (found) found.player.internationalDuty = { windowId: stoppage.id, team: call.team, until: dates.end.toISOString(), worldCup };
    });
    state.windows[stoppage.id] = { status: 'called', kind: stoppage.kind, label: stoppage.label, callups: calls };
    const userClub = getUserClub();
    const mine = calls.filter(call => call.club === userClub);
    if (mine.length) {
      pushMessage({
        category: 'club',
        type: 'national-team-callup',
        title: worldCup ? `Convocados para a ${stoppage.label}` : `Convocação · ${stoppage.label}`,
        body: `${mine.map(call => `${call.name} (${call.team})`).join(', ')} ${mine.length > 1 ? 'foram convocados' : 'foi convocado'}. ${worldCup ? 'Voltam depois do torneio.' : 'Voltam ao fim da Data FIFA.'}`,
        meta: { competition: worldCup ? 'Copa do Mundo' : 'Data FIFA' },
      });
    }
    // Notícia: quantos do Brasileirão a Seleção levou.
    const brazil = calls.filter(call => call.team === 'Brasil');
    if (brazil.length && !mine.some(call => call.team === 'Brasil')) {
      pushMessage({
        category: 'news',
        type: 'national-team-news',
        title: `Seleção Brasileira · ${stoppage.label}`,
        body: `Do Brasileirão, foram chamados: ${brazil.map(call => `${call.name} (${call.club})`).join(', ')}.`,
        meta: { competition: 'Seleção' },
        read: true,
      });
    }
  };

  const release = stoppage => {
    const entry = state.windows[stoppage.id];
    if (!entry || entry.status !== 'called') return;
    const userClub = getUserClub();
    const lines = [];
    const ledger = { ...(getCapsLedger() || {}) };
    (entry.callups || []).forEach(call => {
      const found = findPlayer(call.club, call.playerId);
      if (!found) return;
      const result = resolveDutyReturn(found.player, { random, kind: entry.kind === 'world-cup' ? 'world-cup' : 'window' });
      applyDutyReturn(found.player, result, { team: call.team, windowId: stoppage.id });
      ledger[call.playerId] = { ...found.player.internationalCareer };
      let injuryLabel = '';
      if (result.injured) {
        const injury = injurePlayer(found.player, found.club);
        if (injury) injuryLabel = ` · voltou lesionado (${injury.name || 'lesão'}${injury.daysRemaining ? `, ${injury.daysRemaining} dias` : ''})`;
      }
      if (found.club === userClub) {
        const goals = result.goals ? `, ${result.goals} gol${result.goals > 1 ? 's' : ''}` : '';
        lines.push(`${found.player.name}: ${result.caps} jogo${result.caps === 1 ? '' : 's'}${goals}${injuryLabel}`);
      }
    });
    setCapsLedger(ledger);
    entry.status = 'returned';
    if (lines.length) {
      pushMessage({
        category: 'club',
        type: 'national-team-return',
        title: `Volta da seleção · ${stoppage.label}`,
        body: lines.join(' · '),
        meta: { competition: 'Data FIFA' },
      });
    }
  };

  /* ---------------- Eliminatórias ---------------- */

  const ensureQualifiers = () => {
    const cycle = qualifiersCycleForYear(getCareerSeason());
    if (!cycle) return getQualifiersState();
    const current = getQualifiersState();
    if (current && current.version === QUALIFIERS_VERSION && Number(current.cycleYear) === cycle) return current;
    const created = createConmebolQualifiers({ cycleYear: cycle, seed: (Number(getCareerSeed()) * 31 + cycle) >>> 0 });
    setQualifiersState(created);
    return created;
  };

  const advanceQualifiers = date => {
    const qualifiers = ensureQualifiers();
    if (!qualifiers || qualifiers.complete) return false;
    const result = advanceQualifiersThroughDate(qualifiers, date);
    if (!result.changed) return false;
    setQualifiersState(qualifiers);
    // Notícia da rodada do Brasil (e da seleção de quem tem jogador convocado).
    result.completedMatchdays.forEach(matchday => {
      const game = qualifiers.fixtures.find(item => item.matchday === matchday && (item.home === 'BRA' || item.away === 'BRA'));
      if (!game) return;
      const table = qualifierTable(qualifiers);
      const position = table.findIndex(row => row.code === 'BRA') + 1;
      pushMessage({
        category: 'news',
        type: 'qualifiers',
        title: `Eliminatórias · ${matchday}ª rodada`,
        body: `${game.homeName} ${game.homeGoals} × ${game.awayGoals} ${game.awayName}. O Brasil é ${position}º com ${table[position - 1].points} pontos.`,
        meta: { competition: 'Eliminatórias' },
        read: true,
      });
    });
    if (result.finished) {
      const names = qualifiers.qualified.map(qualifierTeamName).join(', ');
      const playoff = qualifiers.playoff ? ` ${qualifierTeamName(qualifiers.playoff.team)} ${qualifiers.playoff.won ? 'venceu' : 'perdeu'} a repescagem.` : '';
      pushMessage({
        category: 'news',
        type: 'qualifiers',
        title: `Eliminatórias encerradas · Copa ${qualifiers.cycleYear}`,
        body: `Classificados da América do Sul: ${names}.${playoff}`,
        meta: { competition: 'Eliminatórias' },
      });
    }
    return true;
  };

  /* ---------------- API ---------------- */

  const advanceTo = date => {
    if (!state || !date) return false;
    const year = Number(getCareerSeason());
    const ts = new Date(date).getTime();
    let changed = false;
    clubStoppages(year).forEach(stoppage => {
      const dates = stoppageDates(stoppage, year);
      const entry = state.windows[stoppage.id];
      if (!entry && ts >= dates.start.getTime()) {
        callUp(stoppage, dates);
        changed = true;
      }
      if (state.windows[stoppage.id]?.status === 'called' && ts > dates.end.getTime() + DAY_MS / 2) {
        release(stoppage);
        changed = true;
      }
    });
    if (advanceQualifiers(date)) changed = true;
    return changed;
  };

  /** Convocação em curso de um jogador (para a ficha e para o elenco). */
  const playerDuty = player => player?.internationalDuty || null;

  const serialize = () => state;

  const qualifiers = () => getQualifiersState();

  return { init, advanceTo, serialize, playerDuty, qualifiers, nationalityCode: nationality => NATIONALITY_TO_CODE[norm(nationality)] || null };
}
