/**
 * Libertadores e Sul-Americana dentro da carreira.
 *
 * Junta o motor puro (conmebol-competition) com o resto do jogo:
 *   · clubes estrangeiros num registro próprio, que a carreira enxerga por
 *     `clubsWithForeignFallback` (lookup por nome funciona; iteração não);
 *   · datas dos jogos com brasileiro dentro da semana CONMEBOL, longe dos jogos
 *     da liga, e reservadas na agenda antes da Copa do Brasil se encaixar;
 *   · simulação da IA pelo mesmo simulador das rodadas;
 *   · mensagens e premiação do clube do usuário;
 *   · vagas da temporada seguinte.
 */

import { createConmebolClubRegistry, isConmebolForeignClub } from './conmebol-clubs.js';
import {
  CONMEBOL_COMPETITIONS,
  LIBERTADORES,
  STAGE_LABELS,
  SUDAMERICANA,
  conmebolPrize,
  conmebolShortName,
  isConmebolGame,
} from './conmebol-format.js';
import {
  advanceConmebolThroughDate,
  conmebolClubStatus,
  drainConmebolEvents,
  hydrateConmebolEdition,
  onConmebolGameCompleted,
  serializeConmebolEdition,
} from './conmebol-competition.js';
import { bootstrapStandingsByPower, buildConmebolEdition, conmebolHistoryAfterEdition } from './conmebol-season.js';
import { getHardClubBlackouts, moldToDate } from './season-calendar-cycle.js';

export { LIBERTADORES, SUDAMERICANA };

// Mata-mata continental cai na regra genérica de knockout-shootout
// (tieId + knockoutRound). Jogo de grupo não tem tieId e nunca vai aos pênaltis.

const DAY_MS = 86_400_000;

/** Liga e desliga a competição no build. */
export const CONMEBOL_FEATURE_ENABLED = true;

/**
 * Proxy de leitura: `clubs[nome]` acha também o clube estrangeiro, mas
 * `Object.keys/values/entries(clubs)` continua só com os clubes da carreira.
 * Mercado, ranking nacional, base e Série D não enxergam estrangeiro.
 */
export function clubsWithForeignFallback(clubs, getForeign) {
  return new Proxy(clubs, {
    get(target, key, receiver) {
      if (typeof key === 'string' && !(key in target)) {
        const foreign = getForeign(key);
        if (foreign) return foreign;
      }
      return Reflect.get(target, key, receiver);
    },
  });
}

/**
 * Janelas em que clube não joga, na mesma régua do calendário do jogo
 * (Datas FIFA e liberação para a Copa do Mundo).
 */
export function conmebolBlockedWindows(year) {
  return getHardClubBlackouts(year).map(b => ({
    start: moldToDate(year, b.start[0], b.start[1]),
    end: new Date(moldToDate(year, b.end[0], b.end[1]).getTime() + 12 * 3_600_000),
  }));
}

function gameStageLabel(game) {
  const comp = conmebolShortName(game) || 'CONMEBOL';
  const stage = STAGE_LABELS[game.stage] || game.phase || '';
  if (game.stage === 'G') return `${comp} · Grupo ${game.group} · ${game.matchday}ª rodada`;
  if (game.leg && game.leg !== 'JOGO ÚNICO') return `${comp} · ${stage} · ${game.leg === 'IDA' ? 'ida' : 'volta'}`;
  return `${comp} · ${stage}`;
}

export function conmebolGameLabel(game) {
  return gameStageLabel(game);
}

export function isConmebolCompetitionGame(game) {
  return isConmebolGame(game);
}

/**
 * @param {object} deps
 */
export function createConmebolRuntime(deps) {
  const {
    getCareerSeason,
    getCareerSeed = () => 0,
    getClubs,
    getUserClub,
    getDivisionTeams,
    getSavedEdition = () => null,
    getPriorSeasonChampions = () => null,
    getHistory = () => ({}),
    getFirstNames = () => [],
    getLastNames = () => [],
  } = deps;

  const registry = createConmebolClubRegistry({
    careerSeed: getCareerSeed(),
    firstNames: getFirstNames(),
    lastNames: getLastNames(),
  });
  registry.setSeason(getCareerSeason());

  const fixtures = [];
  let edition = null;

  const isDomestic = name => !!name && !isConmebolForeignClub(name);

  const powerOf = name => {
    const club = getClubs()?.[name];
    return Number(club?.power) || 55;
  };

  const createForSeason = season => {
    const prior = getPriorSeasonChampions() || {};
    const priorValid = Number(prior.season) === season - 1;
    const serieA = getDivisionTeams()?.A || [];
    let standingsA = priorValid && Array.isArray(prior.standingsA) && prior.standingsA.length ? prior.standingsA : null;
    let cupChampion = priorValid ? prior.CUP || null : null;
    let cupRunnerUp = priorValid ? prior.CUP_RUNNER_UP || null : null;
    if (!standingsA) {
      // 1º ano da carreira: Série A pela força dos elencos; Copa do Brasil fica
      // com um clube do meio da tabela (como costuma acontecer).
      standingsA = bootstrapStandingsByPower(serieA, powerOf);
      cupChampion = cupChampion || standingsA[7] || null;
      cupRunnerUp = cupRunnerUp || standingsA[10] || null;
    }
    // Só clube que ainda existe na carreira entra (rebaixado continua valendo:
    // a vaga é do ano anterior, como na vida real).
    const exists = name => !!getClubs()?.[name];
    standingsA = standingsA.filter(exists);
    return buildConmebolEdition({
      season,
      careerSeed: getCareerSeed(),
      standingsA,
      cupChampion: exists(cupChampion) ? cupChampion : null,
      cupRunnerUp: exists(cupRunnerUp) ? cupRunnerUp : null,
      titleHolders: priorValid
        ? { libertadores: prior.LIBERTADORES || null, sudamericana: prior.SUDAMERICANA || null }
        : {},
      history: getHistory() || {},
      powerOf,
      blocked: conmebolBlockedWindows(season),
    });
  };

  const refreshFixtures = () => {
    fixtures.length = 0;
    if (edition) fixtures.push(...edition.fixtures);
  };

  const init = () => {
    if (!CONMEBOL_FEATURE_ENABLED) return;
    const season = Number(getCareerSeason());
    const saved = hydrateConmebolEdition(getSavedEdition());
    edition = saved && Number(saved.season) === season ? saved : createForSeason(season);
    // Eventos de criação (sorteios iniciais) não viram mensagem retroativa.
    if (!saved) drainConmebolEvents(edition);
    refreshFixtures();
  };

  /* ---------------- Agenda ---------------- */

  /**
   * Escolhe a data de cada jogo com clube brasileiro dentro da semana CONMEBOL
   * (um dia de folga para cada lado), maximizando o descanso em relação aos
   * jogos já marcados do clube. Reserva a data na agenda.
   *
   * @param {Map<string, number[]>} occupancy agenda nacional (liga, recopa)
   * @param {object} [options]
   * @param {Date} [options.floor] não remarca jogo antes desta data
   */
  const scheduleAndReserve = (occupancy, { floor = null, obstacles = null } = {}) => {
    if (!edition || !occupancy) return 0;
    // Datas que o clube já tem fora da agenda passada (ex.: Copa do Brasil, que
    // se reacomoda depois mas tem semanas fixas da CBF). Pesam na escolha, não
    // são reservadas aqui.
    const extra = club => obstacles?.get?.(club) || [];
    let moved = 0;
    const floorTs = floor ? floor.getTime() : -Infinity;
    const games = edition.fixtures
      .filter(game => isDomestic(game.home) || isDomestic(game.away))
      .sort((a, b) => new Date(a.date) - new Date(b.date) || a.gameNumber - b.gameNumber);
    games.forEach(game => {
      const sides = [game.home, game.away].filter(isDomestic);
      const reserve = ts => sides.forEach(club => {
        const list = occupancy.get(club) || [];
        if (!list.includes(ts)) list.push(ts);
        occupancy.set(club, list);
      });
      const current = game.date ? new Date(game.date) : null;
      if (game.completed || !game.windowStart || (current && current.getTime() < floorTs)) {
        if (current) reserve(current.getTime());
        return;
      }
      const start = new Date(game.windowStart).getTime() - DAY_MS;
      const end = new Date(game.windowEnd).getTime() + DAY_MS;
      const nominal = current ? current.getTime() : new Date(game.windowStart).getTime();
      let best = null;
      for (let ts = start; ts <= end; ts += DAY_MS) {
        if (ts < floorTs) continue;
        // Folga mínima até o jogo mais próximo de cada clube brasileiro.
        const gap = Math.min(...sides.map(club => {
          const others = [...(occupancy.get(club) || []), ...extra(club)].filter(other => Math.abs(other - ts) < 20 * DAY_MS);
          if (!others.length) return 99;
          return Math.min(...others.map(other => Math.abs(other - ts) / DAY_MS));
        }));
        const inWindow = ts >= new Date(game.windowStart).getTime() && ts <= new Date(game.windowEnd).getTime();
        const score = Math.min(gap, 4) * 10 + (inWindow ? 3 : 0) - Math.abs(ts - nominal) / DAY_MS;
        if (!best || score > best.score) best = { ts, score };
      }
      if (best) {
        const date = new Date(best.ts);
        date.setHours(12, 0, 0, 0);
        if (!current || current.getTime() !== date.getTime()) {
          game.date = date;
          moved += 1;
        }
        reserve(date.getTime());
      }
    });
    return moved;
  };

  /* ---------------- Simulação ---------------- */

  /** Estrangeiro chega descansado a cada rodada continental. */
  const restForeign = name => {
    const club = registry.get(name);
    if (!club) return;
    club.roster.forEach(player => {
      player.fatigue = Math.max(player.fatigue ?? 100, 94);
      if (player.injury && player.injury.daysOut != null) player.injury = null;
    });
  };

  const simulateGame = game => {
    if (!isDomestic(game.home)) restForeign(game.home);
    if (!isDomestic(game.away)) restForeign(game.away);
    const result = deps.simulateRoundMatch(game.home, game.away, game);
    if (!result) return null;
    try {
      deps.applyMatchEffects?.(game, result);
    } catch (error) {
      console.warn('[brfut] efeitos do jogo continental', error);
    }
    deps.recordPlayerHistoryMatch?.(
      { ...result, home: game.home, away: game.away, round: game.matchday || game.knockoutRound || 0, competition: game.competition, leg: game.leg, tieId: game.tieId },
      { persist: false, competition: game.competition, round: game.matchday || game.knockoutRound || 0, leg: game.leg, id: game.id },
    );
    return result;
  };

  const resolveShootout = (home, away) => {
    const winner = deps.penaltyWinner?.(home, away) || (powerOf(home) >= powerOf(away) ? home : away);
    const loserGoals = 2 + Math.floor(Math.random() * 3);
    const score = winner === home ? `${loserGoals + 1}–${loserGoals}` : `${loserGoals}–${loserGoals + 1}`;
    return { winner, score };
  };

  const resolveExtraTime = game => {
    // Final: prorrogação decide em ~1/3 dos empates; o resto vai aos pênaltis.
    if (Math.random() > 0.34) return null;
    const ph = powerOf(game.home);
    const pa = powerOf(game.away);
    return Math.random() < 0.5 + (ph - pa) / 60 ? game.home : game.away;
  };

  const hooks = () => ({
    simulateGame,
    resolveShootout,
    resolveExtraTime,
    isUserFixture: deps.isUserFixture,
  });

  /* ---------------- Mensagens e premiação ---------------- */

  const competitionLabel = id => CONMEBOL_COMPETITIONS[id]?.label || id;

  const handleEvents = () => {
    if (!edition) return;
    const userClub = getUserClub();
    const events = drainConmebolEvents(edition);
    events.forEach(event => {
      if (event.club && event.club !== userClub && event.winner !== userClub && event.loser !== userClub && event.runnerUp !== userClub) {
        if (event.type === 'champion') {
          deps.pushMessage?.({
            category: 'competition',
            type: 'conmebol',
            title: `${competitionLabel(event.competitionId)} · Campeão`,
            body: `${event.club} vence ${event.runnerUp} e conquista a ${competitionLabel(event.competitionId)} ${edition.season}.`,
            meta: { competition: competitionLabel(event.competitionId) },
          });
        }
        return;
      }
      const label = competitionLabel(event.competitionId);
      if (event.type === 'stage-entry' && event.club === userClub) {
        if (event.prize > 0) deps.creditUserPrize?.(event.prize, `${label} · ${STAGE_LABELS[event.stage]}`);
        if (event.stage === 'G') {
          const group = Object.entries(edition[event.competitionId].stages.G?.groups || {}).find(([, teams]) => teams.includes(userClub));
          if (group) {
            deps.pushMessage?.({
              category: 'competition',
              type: 'conmebol',
              title: `${label} · Sorteio dos grupos`,
              body: `${userClub} caiu no Grupo ${group[0]}: ${group[1].filter(t => t !== userClub).join(', ')}.`,
              meta: { competition: label, phase: 'Fase de grupos' },
            });
          }
        } else if (['F2', 'F3', 'PO', 'R16', 'QF', 'SF', 'F', 'DA', 'CH', 'IF'].includes(event.stage)) {
          const tie = (edition[event.competitionId].stages[event.stage]?.ties || []).find(t => t.home === userClub || t.away === userClub);
          const rival = tie ? (tie.home === userClub ? tie.away : tie.home) : null;
          deps.pushMessage?.({
            category: 'competition',
            type: 'conmebol',
            title: `${label} · ${STAGE_LABELS[event.stage]}`,
            body: rival
              ? `${userClub} enfrenta ${rival} ${(event.stage === 'F' || event.stage === 'IF') && edition[event.competitionId].finalVenue ? `na final em ${edition[event.competitionId].finalVenue}` : event.competitionId === 'recopa' ? 'na Recopa Sul-Americana, em ida e volta' : event.competitionId === 'intercontinental' ? `no ${STAGE_LABELS[event.stage]}, em ${edition.intercontinental.venue}` : `na ${STAGE_LABELS[event.stage].toLowerCase()}`}.`
              : `${userClub} avança para ${STAGE_LABELS[event.stage]}.`,
            meta: { competition: label, phase: STAGE_LABELS[event.stage] },
          });
        }
      }
      if (event.type === 'eliminated' && event.club === userClub) {
        const status = conmebolClubStatus(edition, userClub);
        const dropped = event.competitionId === 'libertadores' && status?.competitionId === 'sudamericana' && status.alive;
        deps.pushMessage?.({
          category: 'competition',
          type: 'conmebol',
          title: `${label} · ${dropped ? 'Vaga na Sul-Americana' : 'Eliminação'}`,
          body: dropped
            ? `${userClub} sai da Libertadores e segue na Copa Sul-Americana.`
            : event.competitionId === 'intercontinental'
              ? `${userClub} se despede da ${label} no ${STAGE_LABELS[event.stage] || 'torneio'}.`
              : `${userClub} se despede da ${label} na ${(STAGE_LABELS[event.stage] || '').toLowerCase()}.`,
          meta: { competition: label },
        });
      }
      if (event.type === 'champion' && event.club === userClub) {
        deps.creditUserPrize?.(conmebolPrize(event.competitionId, 'champion'), `${label} · Campeão`);
        deps.pushMessage?.({
          category: 'competition',
          type: 'conmebol',
          title: `${label} · CAMPEÃO`,
          body: event.competitionId === 'intercontinental'
            ? `${userClub} é campeão do mundo! Conquista a ${label} ${edition.season} em ${edition.intercontinental.venue}.`
            : event.competitionId === 'recopa'
              ? `${userClub} conquista a ${label} ${edition.season}.`
              : `${userClub} é campeão da ${label} ${edition.season}! Vaga garantida nos grupos da próxima Libertadores e na Recopa Sul-Americana.${event.competitionId === 'libertadores' ? ' Em dezembro tem Copa Intercontinental.' : ''}`,
          meta: { competition: label, phase: 'Final' },
        });
      }
      if (event.type === 'champion' && event.runnerUp === userClub) {
        deps.creditUserPrize?.(conmebolPrize(event.competitionId, 'runnerUp'), `${label} · Vice-campeão`);
        deps.pushMessage?.({
          category: 'competition',
          type: 'conmebol',
          title: `${label} · Vice-campeão`,
          body: `${userClub} perde para ${event.club} e fica com o vice da ${label} ${edition.season}.`,
          meta: { competition: label, phase: 'Final' },
        });
      }
    });
    // Bônus de vitória na fase de grupos sai quando o grupo fecha.
    ['libertadores', 'sudamericana'].forEach(id => {
      const row = edition[id].progress[userClub];
      const record = edition[id].stages.G;
      if (!row || !record?.closed || row.groupWinsCredited) return;
      row.groupWinsCredited = true;
      if (row.groupWins > 0) {
        deps.creditUserPrize?.(row.groupWins * conmebolPrize(id, 'groupWin'), `${competitionLabel(id)} · ${row.groupWins} vitória(s) na fase de grupos`);
      }
    });
  };

  /* ---------------- API ---------------- */

  const advanceThroughDate = date => {
    if (!edition || !date) return false;
    registry.setSeason(edition.season);
    const before = edition.fixtures.length;
    const changed = advanceConmebolThroughDate(edition, date, hooks());
    if (changed) {
      refreshFixtures();
      deps.onFixturesChanged?.();
    }
    // Fase nova sorteada: encaixa as datas dos brasileiros na agenda nacional
    // (e a Copa do Brasil se reacomoda em volta).
    if (edition.fixtures.length > before) deps.onScheduleNeeded?.();
    handleEvents();
    return changed;
  };

  /** Placar ao vivo do usuário já gravado no `game`. */
  const completeUserGame = game => {
    if (!edition || !game) return false;
    game.completed = true;
    const before = edition.fixtures.length;
    const changed = onConmebolGameCompleted(edition, game, hooks());
    refreshFixtures();
    if (edition.fixtures.length > before) deps.onScheduleNeeded?.();
    handleEvents();
    deps.onFixturesChanged?.();
    return changed;
  };

  /** Jogos do confronto (para agregado e pênaltis ao vivo). */
  const tieGames = game => (game?.tieId ? edition.fixtures.filter(other => other.tieId === game.tieId) : [game]);

  /** O jogo decide nos pênaltis se o agregado empatar? */
  const isDecidingLeg = game => {
    if (!game?.tieId) return false;
    const games = tieGames(game);
    return games[games.length - 1] === game;
  };

  const getForeignClub = name => registry.get(name);

  const serialize = () => serializeConmebolEdition(edition);

  /**
   * Fecha a edição e devolve o que vai para o save da carreira: histórico de
   * ranking e campeões (vagas do ano seguinte).
   */
  const seasonSummary = () => {
    if (!edition) return null;
    return {
      season: edition.season,
      LIBERTADORES: edition.libertadores.champion || null,
      SUDAMERICANA: edition.sudamericana.champion || null,
      RECOPA_SUL: edition.recopa?.champion || null,
      INTERCONTINENTAL: edition.intercontinental?.champion || null,
      history: conmebolHistoryAfterEdition(edition, getHistory() || {}),
    };
  };

  const userStatus = () => (edition ? conmebolClubStatus(edition, getUserClub()) : null);

  return {
    init,
    get edition() {
      return edition;
    },
    fixtures: () => fixtures,
    advanceThroughDate,
    completeUserGame,
    scheduleAndReserve,
    tieGames,
    isDecidingLeg,
    getForeignClub,
    isForeignClub: isConmebolForeignClub,
    serialize,
    seasonSummary,
    userStatus,
    gameLabel: gameStageLabel,
  };
}
