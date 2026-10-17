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
 * São duas coisas diferentes, e a distinção é o ponto:
 *
 *   `tetoLegal`    o que o regulamento permite. **Este é o único número
 *                  verificado**, e vem com a citação da fonte.
 *   `tetoRealista` o que os clubes de fato ocupam desse teto. **Não é medido**:
 *                  é decisão de design, motivada pela ordem de grandeza
 *                  econômica entre as divisões. Ajustar aqui é seguro.
 *
 * Confundir os dois foi o erro original: o jogo usava 5, que é o número de
 * jogadores em campo (em campo são 11), e não o limite de súmula.
 *
 * Só o Brasil está preenchido, e só o `tetoLegal`, conferido no regulamento da
 * CBF. As demais ligas ficam vazias de propósito — número plausível e inventado
 * é pior que limite honestamente ausente. Quando cada uma for verificada em
 * fonte, entra aqui no mesmo formato.
 */
export const FOREIGNER_LIMITS = {
  Brasil: {
    tetoLegal: 9,
    fonte:
      'CBF — regulamento do Campeonato Brasileiro de Futebol 2026: "cada equipe pode colocar na súmula da partida um máximo de nove jogadores de outras nacionalidades".',
    // Verificado: teto idêntico nas quatro divisões, conforme o mesmo regulamento.
    A: { tetoLegal: 9, tetoRealista: 9 },
    B: { tetoLegal: 9, tetoRealista: 7 },
    C: { tetoLegal: 9, tetoRealista: 3 },
    D: { tetoLegal: 9, tetoRealista: 2 },
    REG: { tetoLegal: 9, tetoRealista: 1 },
  },
};

/** Teto legal de estrangeiros na súmula de uma divisão. */
export function foreignerLimitFor(division = 'A', country = 'Brasil') {
  const regra = FOREIGNER_LIMITS[country]?.[division];
  return typeof regra?.tetoLegal === 'number' ? regra.tetoLegal : null;
}

/**
 * Teto realmente ocupado por uma divisão.
 *
 * É o que impede o absurdo que motivou isto: um clube de nível regional com 9
 * estrangeiros na súmula. O teto legal é 9 em toda parte, mas a distância entre
 * o orçamento de uma Série A e o de um estadual é de ordens de grandeza, e
 * estrangeiro é a linha mais cara do elenco.
 *
 * Devolve `null` quando a liga não tem dado — aí o chamador não impõe nada,
 * em vez de chutar.
 */
export function realisticForeignerLimit(division = 'A', country = 'Brasil') {
  const regra = FOREIGNER_LIMITS[country]?.[division];
  return typeof regra?.tetoRealista === 'number' ? regra.tetoRealista : null;
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
  // Formato: { count: n, w: peso }. O teto vem de `tetoRealista`, não daqui —
  // os pesos dão a forma, o teto dá o limite.
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
    { count: 0, w: 8 },
    { count: 1, w: 14 },
    { count: 3, w: 26 },
    { count: 5, w: 28 },
    { count: 6, w: 16 },
    { count: 7, w: 8 },
  ],
  C: [
    { count: 0, w: 62 },
    { count: 1, w: 28 },
    { count: 2, w: 10 },
  ],
  D: [
    { count: 0, w: 84 },
    { count: 1, w: 14 },
    { count: 2, w: 2 },
  ],
  // Estadual: clube sem orcamento para estrangeiro. O teto cai para 1.
  REG: [
    { count: 0, w: 94 },
    { count: 1, w: 6 },
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
  // O teto legal é 9 em toda parte; o que segura o jogo é o
  // `tetoRealista` da divisão. Sem liga conhecida, não se impõe teto.
  const legal = foreignerLimitFor(division, BRAZIL_NATION);
  const realista = realisticForeignerLimit(division, BRAZIL_NATION);
  const teto = realista ?? legal ?? MAX_FOREIGNERS_PER_SQUAD;
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
