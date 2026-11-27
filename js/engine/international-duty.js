/**
 * Convocações nas Datas FIFA e na Copa do Mundo.
 *
 * A vida real de um clube sul-americano: quando a seleção chama, o jogador
 * some por uma ou duas semanas (Copa: até dois meses), volta cansado, às vezes
 * machucado, e valorizado. O Brasileirão para nas Datas FIFA desde 2026, então
 * o efeito no clube é o retorno, não o desfalque em jogo.
 *
 * Quem é chamado:
 *   · Seleções da CONMEBOL olham os melhores jogadores da nacionalidade que
 *     atuam no Brasil. A régua é alta para quem tem elenco forte na Europa
 *     (Brasil, Argentina) e mais baixa para as menores (Bolívia, Venezuela).
 *   · Seleções de fora da América do Sul chamam só craque (overall ≥ 70).
 *
 * Módulo puro: recebe clubes e sorte, devolve listas e efeitos.
 */

/** Régua por seleção: overall mínimo e quantos do Brasileirão no máximo. */
const CALLUP_RULES = Object.freeze({
  Brasil: { team: 'Brasil', min: 66, max: 3 },
  Argentina: { team: 'Argentina', min: 66, max: 2 },
  Uruguai: { team: 'Uruguai', min: 63, max: 3 },
  Colombia: { team: 'Colômbia', min: 63, max: 3 },
  Equador: { team: 'Equador', min: 62, max: 3 },
  Paraguai: { team: 'Paraguai', min: 60, max: 4 },
  Chile: { team: 'Chile', min: 58, max: 4 },
  Peru: { team: 'Peru', min: 57, max: 4 },
  Venezuela: { team: 'Venezuela', min: 56, max: 4 },
  Bolívia: { team: 'Bolívia', min: 55, max: 4 },
});
const OTHER_NATION_RULE = Object.freeze({ min: 70, max: 2 });

const norm = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const RULE_BY_KEY = new Map(Object.entries(CALLUP_RULES).map(([nation, rule]) => [norm(nation), rule]));

export function callupRuleFor(nationality) {
  const key = norm(nationality);
  if (!key) return null;
  if (RULE_BY_KEY.has(key)) return RULE_BY_KEY.get(key);
  if (key === 'colombia') return CALLUP_RULES.Colombia;
  return { team: nationality, ...OTHER_NATION_RULE };
}

const playerKeyOf = player => player?.playerId || player?.id || player?.name;

/**
 * Lista de convocados entre os clubes da carreira.
 *
 * @param {object} params
 * @param {Record<string, object>} params.clubs clubes da carreira (só os brasileiros)
 * @param {boolean} [params.worldCup] convocação para a Copa do Mundo (régua um pouco mais baixa: 26 vagas)
 * @returns {Array<{club:string, playerId:string, name:string, nationality:string, team:string, overall:number}>}
 */
export function selectCallUps({ clubs = {}, worldCup = false } = {}) {
  const byNation = new Map();
  Object.entries(clubs).forEach(([clubName, club]) => {
    if (!Array.isArray(club?.roster) || club.division === 'INT') return;
    club.roster.forEach(player => {
      if (!player?.nationality || player.injury?.daysRemaining > 14) return;
      const rule = callupRuleFor(player.nationality);
      const overall = Number(player.overall) || 0;
      if (!rule || overall < rule.min - (worldCup ? 1 : 0)) return;
      const list = byNation.get(rule.team) || [];
      list.push({ club: clubName, playerId: playerKeyOf(player), name: player.name, nationality: player.nationality, team: rule.team, overall, pos: player.pos, rule });
      byNation.set(rule.team, list);
    });
  });
  const out = [];
  byNation.forEach(list => {
    const rule = list[0].rule;
    list.sort((a, b) => b.overall - a.overall || String(a.name).localeCompare(String(b.name), 'pt-BR'));
    list.slice(0, rule.max + (worldCup ? 1 : 0)).forEach(({ rule: _rule, ...entry }) => out.push(entry));
  });
  return out.sort((a, b) => a.team.localeCompare(b.team, 'pt-BR') || b.overall - a.overall);
}

/**
 * Efeito da volta da seleção num jogador: cansaço, jogos e gols pela seleção,
 * valorização e chance de voltar machucado.
 *
 * @param {object} player
 * @param {object} params
 * @param {() => number} params.random
 * @param {'window'|'world-cup'} [params.kind]
 * @returns {{fatigueLoss:number, caps:number, goals:number, valueBoost:number, injured:boolean}}
 */
export function resolveDutyReturn(player, { random = Math.random, kind = 'window' } = {}) {
  const worldCup = kind === 'world-cup';
  const caps = worldCup ? 1 + Math.floor(random() * 5) : (random() < 0.75 ? 1 + Math.floor(random() * 2) : 0);
  const attacker = ['ATA', 'PE', 'PD', 'MEI'].includes(player?.pos);
  let goals = 0;
  for (let i = 0; i < caps; i += 1) if (random() < (attacker ? 0.28 : player?.pos === 'GOL' ? 0 : 0.07)) goals += 1;
  const fatigueLoss = Math.round((worldCup ? 14 : 8) + random() * (worldCup ? 12 : 8));
  const valueBoost = caps > 0 ? (worldCup ? 0.06 + goals * 0.02 : 0.02 + goals * 0.01) : 0.005;
  const injured = random() < (worldCup ? 0.09 : 0.05);
  return { fatigueLoss, caps, goals, valueBoost: Math.round(valueBoost * 1000) / 1000, injured };
}

/** Aplica o retorno no jogador (o registro de lesão fica com quem chama). */
export function applyDutyReturn(player, result, { team, windowId } = {}) {
  if (!player || !result) return player;
  player.fatigue = Math.max(35, Math.round((Number(player.fatigue) || 100) - result.fatigueLoss));
  const intl = (player.internationalCareer = player.internationalCareer || { caps: 0, goals: 0, team: team || null, lastWindow: null });
  intl.caps += result.caps;
  intl.goals += result.goals;
  intl.team = team || intl.team;
  intl.lastWindow = windowId || intl.lastWindow;
  if (Number(player.marketValue) > 0 && result.valueBoost > 0) {
    player.marketValue = Math.round(player.marketValue * (1 + result.valueBoost));
  }
  delete player.internationalDuty;
  return player;
}
