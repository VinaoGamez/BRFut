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
    // `tetoRealista` da Série A é o próprio dado: footystats.org mediu 9,35
    // estrangeiros por clube na Série A 2026, que bate no teto legal. Duas
    // fontes independentes no mesmo número.
    // Série B tem 7,7% de estrangeiros (medido) contra 31,2% da A — a queda é de
    // quatro vezes entre divisões irmãs.
    // Série C, D e estadual não têm dado publicado; os valores seguem a ordem de
    // grandeza do gradiente, não uma estatística.
    A: { tetoLegal: 9, tetoRealista: 9 },
    B: { tetoLegal: 9, tetoRealista: 2 },
    C: { tetoLegal: 9, tetoRealista: 1 },
    D: { tetoLegal: 9, tetoRealista: 1 },
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
/**
 * Nacionalidade estrangeira por peso real.
 *
 * Peso = participação de cada país nos 187 estrangeiros da Série A 2026,
 * medidos em footystats.org (ver `public/data/estrangeiros-por-liga.json`):
 *
 *   Argentina 74 (39,6%) | Colômbia 41 (21,9%) | Uruguai 28 (15,0%)
 *   Equador 9 (4,8%) | Paraguai 6 (3,2%) | Portugal 5 (2,7%) | Chile 5 (2,7%)
 *   Venezuela 4 (2,1%) | Itália 4 (2,1%) | Cabo Verde 2 | Marrocos 2 | Panamá 2
 *   Bolívia, Espanha, Angola, Camarões, Peru 1 cada
 *
 * Duas leituras que os números sustentam:
 *
 *  - O eixo CONMEBOL responde por 84% do estrangeiro brasileiro. A Europa, a
 *    África e a Ásia são cauda longa, com 1-2 jogadores cada.
 *  - A-share da África não é genérica: Cabo Verde e Angola são Atlântico/Norte,
 *    Camarões é Central. É para isso que a pool resolve por região.
 */
const FOREIGN_NATION_WEIGHTS = {
  // As chaves usam EXATAMENTE a grafia que o resto do jogo já usa
  // (FOREIGN_NATIONS: 'Uruguai', 'Colombia', 'Equador'...). Misturar com a
  // grafia da fonte ('Uruguay') faria o jogador nascer com nacionalidade que
  // nada mais no jogo reconhece.
  Argentina: 396,
  Colombia: 219,
  Uruguai: 150,
  Equador: 48,
  Paraguai: 32,
  Portugal: 27,
  Chile: 27,
  Venezuela: 21,
  Itália: 21,
  'Cabo Verde': 11,
  Marrocos: 11,
  Panamá: 11,
  Bolívia: 5,
  Espanha: 5,
  Angola: 5,
  Camarões: 5,
  Peru: 5,
  Inglaterra: 2,
  Alemanha: 2,
  França: 2,
  Holanda: 1,
  Bélgica: 1,
  Croácia: 1,
  Nigéria: 1,
  Gana: 1,
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
