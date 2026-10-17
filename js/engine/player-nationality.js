/**
 * Nacionalidade dos jogadores — regras de elenco por divisão.
 */

import { isoForNationality } from '../lab/card-nation-flags.js';
import { ensureForeignPlayerNames } from './player-names.js';

export const BRAZIL_NATION = 'Brasil';

export const FOREIGN_NATIONS = [
  'Argentina',
  'Uruguai',
  'Paraguai',
  'Colombia',
  'Venezuela',
  'Equador',
  'Chile',
];

/**
 * Limite de estrangeiros por liga.
 *
 * O valor é o **teto de súmula** — quantos estrangeiros o clube pode Related
 * na lista de partida — e não quantos estão em campo ao mesmo tempo. Os dois
 * não se confundem: um clube brasileiro pode levar 9 estrangeiros na súmula e
 * levar só 5 deles em campo, porque em campo são 11 no total.
 *
 * Só o Brasil está preenchido, e só porque foi conferido no regulamento da CBF
 * (2026, idêntico aos anos anteriores). As demais ligas ficam de fora de propósito:
 * um número plausível e inventado é pior do que um limite honestamente ausente.
 * Quando cada uma for verificada em fonte, entra aqui com o mesmo formato.
 */
export const FOREIGNER_LIMITS = {
  Brasil: {
    A: 9,
    B: 9,
    C: 9,
    D: 9,
    fonte: 'CBF — regulamento do Campeonato Brasileiro 2026: "cada equipe pode colocar na súmula da partida um máximo de nove jogadores de outras nacionalidades".',
    verificado: true,
  },
};

/** Maior número de estrangeiros na súmula de uma divisão. */
export function foreignerLimitFor(division = 'A', country = 'Brasil') {
  const regra = FOREIGNER_LIMITS[country];
  if (!regra) return null;
  const limite = regra[division];
  return typeof limite === 'number' ? limite : null;
}

export const MAX_FOREIGNERS_PER_SQUAD = 9;

/**
 * Distribuição de estrangeiros por divisão.
 *
 * As quatro divisões brasileiras compartilham o mesmo teto legal (9 na súmula),
 * mas a realidade é muito diferente: Série A tem elencos internacionalizados, e
 * Série D quase não tem. Sem essa distinção o jogo gera tanto estrangeiro em D
 * quanto em A, o que não corresponde a nenhuma liga real.
 *
 * A distribuição dentro do teto também segue a concentração real do mercado:
 * o eixo CONMEBOL domina o mercado estrangeiro do futebol brasileiro, e Europa /
 * Ásia / África são raros. Com peso uniforme, Equador gerava tantos jogadores
 * quanto Argentina (medido: 121 e 120).
 */
const FOREIGN_NATION_WEIGHTS = {
  Argentina: 26,
  Uruguai: 18,
  Paraguai: 16,
  Colombia: 14,
  Chile: 8,
  Equador: 7,
  Venezuela: 5,
  Portugal: 2,
  Espanha: 1,
  Alemanha: 1,
  França: 1,
  Inglaterra: 1,
  Nigéria: 1,
  Gana: 1,
  'Costa do Marfim': 1,
  Senegal: 1,
  Japão: 1,
  'Coreia do Sul': 1,
  China: 1,
  'Arábia Saudita': 1,
};

const FOREIGN_COUNT_WEIGHTS = {
  A: [
    { count: 0, w: 1 },
    { count: 2, w: 5 },
    { count: 4, w: 14 },
    { count: 6, w: 26 },
    { count: 7, w: 24 },
    { count: 8, w: 18 },
    { count: 9, w: 12 },
  ],
  B: [
    { count: 0, w: 6 },
    { count: 1, w: 12 },
    { count: 3, w: 24 },
    { count: 5, w: 26 },
    { count: 6, w: 18 },
    { count: 7, w: 10 },
    { count: 8, w: 4 },
  ],
  C: [
    { count: 0, w: 52 },
    { count: 1, w: 26 },
    { count: 2, w: 14 },
    { count: 3, w: 6 },
    { count: 4, w: 2 },
  ],
  D: [
    { count: 0, w: 80 },
    { count: 1, w: 14 },
    { count: 2, w: 5 },
    { count: 3, w: 1 },
  ],
};

function pickWeighted(items, random) {
  const total = items.reduce((sum, row) => sum + row.w, 0);
  let roll = random() * total;
  for (const row of items) {
    roll -= row.w;
    if (roll <= 0) return row.count;
  }
  return items[items.length - 1]?.count ?? 0;
}

function shuffleIndices(size, random) {
  const order = Array.from({ length: size }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Sorteia a nacionalidade estrangeira por peso.
 *
 * Antes era uniforme: Equador saía tantas vezes quanto Argentina (medido, 121 e
 * 120 jogadores). O mercado estrangeiro do futebol brasileiro é dominado pelo
 * eixo CONMEBOL, e Europa/Ásia/África são exceção — a lista por peso reflete
 * isso, e é a mesma lista que o arquivo de nomes conhece.
 */
function pickForeignNation(random) {
  const entradas = Object.entries(FOREIGN_NATION_WEIGHTS).filter(([, w]) => w > 0);
  const total = entradas.reduce((soma, [, w]) => soma + w, 0);
  let roll = random() * total;
  for (const [nacao, peso] of entradas) {
    roll -= peso;
    if (roll <= 0) return nacao;
  }
  return entradas[entradas.length - 1]?.[0] || 'Argentina';
}

/** Aplica nacionalidades a um elenco inteiro, respeitando o teto de súmula. */
export function assignRosterNationalities(roster, division = 'A', random = Math.random) {
  if (!Array.isArray(roster) || !roster.length) return roster;

  const weights = FOREIGN_COUNT_WEIGHTS[division] || FOREIGN_COUNT_WEIGHTS.D;
  const teto = foreignerLimitFor(division, BRAZIL_NATION) ?? MAX_FOREIGNERS_PER_SQUAD;
  const cap = Math.min(teto, roster.length - 1);
  const foreignCount = Math.min(pickWeighted(weights, random), cap);

  const foreignSlots = new Set(shuffleIndices(roster.length, random).slice(0, foreignCount));

  roster.forEach((player, index) => {
    if (!player || typeof player !== 'object') return;
    if (foreignSlots.has(index)) {
      player.nationality = pickForeignNation(random);
    } else {
      player.nationality = BRAZIL_NATION;
    }
    player.nationalityIso = isoForNationality(player.nationality) || undefined;
  });

  ensureForeignPlayerNames(roster, { random });

  return roster;
}

/** Preenche nacionalidade ausente — elenco novo ou migração. */
export function ensureRosterNationalities(roster, division = 'A', random = Math.random) {
  if (!Array.isArray(roster) || !roster.length) return;
  const missing = roster.filter(p => p && !p.nationality);
  if (!missing.length) return;

  const hasAny = roster.some(p => p?.nationality);
  if (!hasAny) {
    assignRosterNationalities(roster, division, random);
    return;
  }

  missing.forEach(player => {
    player.nationality = BRAZIL_NATION;
    player.nationalityIso = isoForNationality(BRAZIL_NATION) || undefined;
  });
}

export function ensurePlayerNationality(player, division = 'A', random = Math.random) {
  if (!player || typeof player !== 'object') return player;
  if (player.nationality) {
    if (!player.nationalityIso) {
      player.nationalityIso = isoForNationality(player.nationality) || undefined;
    }
    return player;
  }
  player.nationality = random() < 0.8 ? BRAZIL_NATION : pickForeignNation(random);
  player.nationalityIso = isoForNationality(player.nationality) || undefined;
  return player;
}
