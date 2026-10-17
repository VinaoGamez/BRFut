/**
 * Nomes por nacionalidade + utilitários de deduplicação e renomeação do elenco.
 *
 * Os pools vivem em `js/data/nomes-jogadores.json`, não aqui. Isso não é
 * estética: com 19 nacionalidades e forma de nome diferente por região, o
 * arquivo inline tinha 433 linhas — das quais 207 eram dado puro, no meio da
 * lógica. Difícil de revisar, impossível de atualizar sem risco.
 *
 * Cada pool declara `forma`, que diz como a string final é montada:
 *
 *   primeiro-sobrenome            João Silva
 *   primeiro-sobrenome-sobrenome  Juan Pérez Gómez  (paterno + materno)
 *   sobrenome-primeiro            Tanaka Hiroshi    (ordem japonesa)
 *
 * Tratar a forma aqui, e não no dado, é o que impede o gerador de produzir
 * "Hiroshi Tanaka" no Japão.
 *
 * Procedência: Brasil vem do IBGE Censo 2022 (`scripts/gerar-nomes.mjs`); as
 * demais pools são de `scripts/nomes-regionais.mjs`.
 */
// O atributo `with { type: 'json' }` é exigência do ESM nativo do Node (é
// como a suíte roda). O Vite também aceita e embute o JSON no bundle, então o
// arquivo continua sendo um JSON editável à mão, sem fetch em runtime.
import NOMES from '../data/nomes-jogadores.json' with { type: 'json' };

const BRAZIL = 'Brasil';

const BRAZIL_MIDDLE_NAMES = [
  'Luiz', 'José', 'Carlos', 'Paulo', 'Antônio', 'Francisco', 'Miguel', 'Bernardo', 'Ricardo', 'Marcelo',
  'Roberto', 'Eduardo', 'Fernando', 'Alexandre', 'Daniel', 'Felipe', 'Guilherme', 'Rafael', 'Rodrigo', 'Thiago',
];

const PATRONYMIC_SUFFIXES = ['Júnior', 'Neto', 'Filho'];

const int = (random, lo, hi) => lo + Math.floor(random() * (hi - lo + 1));

/** Pools do arquivo de dados, com as chaves legacy `first`/`last`. */
const POOLS_DADOS = Object.fromEntries(
  Object.entries(NOMES.pools).map(([nacao, pool]) => [
    nacao,
    {
      ...pool,
      first: pool.primeiros,
      last: pool.sobrenomes,
    },
  ]),
);

/**
 * Nacionalidade -> pool, em três degraus.
 *
 * 1. Pool com o nome da própria nacionalidade (Brasil, Argentina, Portugal...).
 * 2. Pool da região do país (Nigéria -> África Ocidental, Japão -> Leste Asiático).
 * 3. Brasil, porque um elenco brasileiro é majoritariamente brasileiro e
 *    melhor um nome plausível que um nome genérico errado.
 *
 * Sem o degrau 2, todo jogador Africano do jogo sairia com nome japonês: as
 * pools regionais existem justamente para impedir isso.
 */
const REGION_POR_PAIS = {
  // CONMEBOL
  Argentina: null, Brasil: null, Chile: null, Colombia: null, Equador: null,
  Paraguai: null, Uruguai: null, Venezuela: null, Bolívia: 'América Latina',
  Peru: 'América Latina', México: 'América Latina', 'Costa Rica': 'Concacaf',
  // Europa
  Portugal: null, Espanha: null, Alemanha: null, França: null, Inglaterra: null,
  Itália: null, Holanda: null, Bélgica: null, Croácia: null, Sérvia: null,
  // África
  Nigéria: 'África Ocidental', Gana: 'África Ocidental', 'Costa do Marfim': 'África Ocidental',
  Senegal: 'África Ocidental', Mali: 'África Ocidental', 'Serra Leoa': 'África Ocidental',
  Camarões: 'África Central', 'Congo': 'África Central', Gabão: 'África Central',
  Chade: 'África Central', Quênia: 'África Oriental', Tanzânia: 'África Oriental',
  Uganda: 'África Oriental', Ruanda: 'África Oriental', Etiópia: 'África Oriental',
  Egito: 'África Setentrional', Marrocos: 'África Setentrional', Argélia: 'África Setentrional',
  Tunísia: 'África Setentrional', Líbia: 'África Setentrional', Sudão: 'África Setentrional',
  'África do Sul': 'África Austral', Zâmbia: 'África Austral', Zimbábue: 'África Austral',
  // Ásia
  'Arábia Saudita': 'Ásia Ocidental', Emirados: 'Ásia Ocidental', Qatar: 'Ásia Ocidental',
  Kuwait: 'Ásia Ocidental', Omã: 'Ásia Ocidental', Bahrein: 'Ásia Ocidental',
  Iraque: 'Ásia Ocidental', Jordânia: 'Ásia Ocidental', Irã: 'Ásia Ocidental',
  Índia: 'Sul da Ásia', Paquistão: 'Sul da Ásia', Bangladesh: 'Sul da Ásia',
  'Sri Lanka': 'Sul da Ásia', Nepal: 'Sul da Ásia',
  Japão: 'Leste Asiático', 'Coreia do Sul': 'Leste Asiático', China: 'Leste Asiático',
  Indonésia: 'Sudeste Asiático', Tailândia: 'Sudeste Asiático', Vietnã: 'Sudeste Asiático',
  Filipinas: 'Sudeste Asiático', Malásia: 'Sudeste Asiático', Singapura: 'Sudeste Asiático',
  // América do Norte e Caribe
  Estados: 'Concacaf', 'Estados Unidos': 'Concacaf', Canadá: 'Concacaf',
  Jamaica: 'Concacaf', Haiti: 'Concacaf', Trinidad: 'Concacaf', Panamá: 'Concacaf',
  Honduras: 'Concacaf', Guatemala: 'Concacaf', 'El Salvador': 'Concacaf',
  'República Dominicana': 'Concacaf', Cuba: 'Concacaf',
};

/**
 * Chave de comparação sem acento e sem caixa.
 *
 * Sem isso, `rollPlayerName({nationality:'Colômbia'})` não acha a pool
 * 'Colombia' e cai no Brasil — o jogador colombiano sai com nome brasileiro em
 * silêncio. A grafia varia entre save antigo, lista da wiki e dado importado,
 * então a comparação precisa tolerar as duas.
 */
const chaveNacao = valor =>
  String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const POOLS_POR_CHAVE = new Map(Object.entries(POOLS_DADOS).map(([k, v]) => [chaveNacao(k), v]));
const REGION_POR_CHAVE = new Map(Object.entries(REGION_POR_PAIS).map(([k, v]) => [chaveNacao(k), v]));

/** Resolve a pool de uma nacionalidade, com os três degraus. */
function poolDaNacao(nationality) {
  const chave = chaveNacao(nationality);
  if (POOLS_POR_CHAVE.has(chave)) return POOLS_POR_CHAVE.get(chave);
  const regiao = REGION_POR_CHAVE.get(chave);
  if (regiao && POOLS_POR_CHAVE.has(chaveNacao(regiao))) return POOLS_POR_CHAVE.get(chaveNacao(regiao));
  return POOLS_POR_CHAVE.get(chaveNacao(BRAZIL));
}

/** Nomes que existem na pool, exposto para os testes e para o fallback. */
export const PLAYER_NAME_POOLS = POOLS_DADOS;

export const PLAYER_NAME_REGIONS = REGION_POR_PAIS;

const normalizeNameKey = value =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');

export function normalizePlayerDisplayName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Monta a string final conforme a `forma` declarada pela pool. */
function montarNome(pool, primeiro, sobrenome, segundoSobrenome = '') {
  if (pool.forma === 'sobrenome-primeiro') {
    // Japão/China/Coreia: sobrenome antes do nome.
    return `${sobrenome} ${primeiro}`;
  }
  if (segundoSobrenome && segundoSobrenome !== sobrenome) {
    return `${primeiro} ${sobrenome} ${segundoSobrenome}`;
  }
  return `${primeiro} ${sobrenome}`;
}

/**
 * Segundo sobrenome: ~12% no Brasil (materno), ~45% no círculo latino, onde
 * quase todo mundo tem nome paterno E materno. `segundosSobrenomes` só existe
 * onde isso faz sentido — não inventar segundo sobrenome japonês.
 */
function segundoSobrenome(pool, nationality, index, random) {
  const declarados = pool.segundosSobrenomes;
  if (!Array.isArray(declarados) || !declarados.length) return '';
  const chance = nationality === BRAZIL ? 0.12 : 0.45;
  if (random() >= chance) return '';
  return declarados[(index * 7 + int(random, 0, declarados.length - 1)) % declarados.length];
}

export function rollPlayerName({ nationality = BRAZIL, index = 0, random = Math.random } = {}) {
  const pool = poolDaNacao(nationality);
  const first = pool.first[(index + int(random, 0, pool.first.length - 1)) % pool.first.length];
  const last = pool.last[(index * 3 + int(random, 0, pool.last.length - 1)) % pool.last.length];
  return montarNome(pool, first, last, segundoSobrenome(pool, nationality, index, random));
}

function nameSeed(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Sufixo numérico legado ("Henrique Vieira 2") — não usar em nomes novos. */
export function hasTrailingNumericNameSuffix(name) {
  return /\s+\d+$/.test(String(name || '').trim());
}

export function stripTrailingNumericNameSuffix(name) {
  return normalizePlayerDisplayName(String(name || '').replace(/\s+\d+$/, ''));
}

function pickDistinctFromPool(pool, usedKeys, attempt, salt = 0) {
  const size = pool.length;
  for (let offset = 0; offset < size; offset += 1) {
    const value = pool[(attempt * 5 + salt + offset) % size];
    const key = normalizeNameKey(value);
    if (!usedKeys.has(key)) return value;
  }
  return pool[(attempt + salt) % size];
}

/** Gera variante legível sem números (sobrenome extra, meio, Júnior/Neto, inicial, re-roll). */
export function variantPlayerName(baseName, { nationality = BRAZIL, attempt = 0, random = Math.random } = {}) {
  const pool = poolDaNacao(nationality);
  const cleaned = stripTrailingNumericNameSuffix(baseName);
  const parts = cleaned.split(' ').filter(Boolean);
  // Em `sobrenome-primeiro` a primeira parte é o sobrenome, não o nome.
  const primeiro = pool.forma === 'sobrenome-primeiro'
    ? parts[1] || pool.first[attempt % pool.first.length]
    : parts[0] || pool.first[attempt % pool.first.length];
  const last = parts.length > 1 ? parts[parts.length - 1] : primeiro;
  const strategy = attempt % 6;

  if (strategy === 0) {
    return rollPlayerName({ nationality, index: attempt * 17 + nameSeed(cleaned), random });
  }
  if (strategy === 1) {
    const outro = pickDistinctFromPool(pool.last, new Set([normalizeNameKey(last)]), attempt, nameSeed(primeiro));
    return montarNome(pool, primeiro, last, outro);
  }
  if (strategy === 2) {
    const middle =
      nationality === BRAZIL
        ? BRAZIL_MIDDLE_NAMES[attempt % BRAZIL_MIDDLE_NAMES.length]
        : pool.first[(attempt + nameSeed(last)) % pool.first.length];
    return montarNome(pool, primeiro, middle, last);
  }
  if (strategy === 3) {
    // Sufixo é brasileiro por natureza. Aplicar em nome japonês produziria
    // "Tanaka Hiroshi Júnior", que não existe.
    const podeUsar = Array.isArray(pool.sufixos) && pool.sufixos.length > 0;
    if (!podeUsar) return rollPlayerName({ nationality, index: attempt * 31 + nameSeed(last), random });
    const suffix = pool.sufixos[attempt % pool.sufixos.length];
    return `${primeiro} ${last} ${suffix}`;
  }
  if (strategy === 4) {
    const initial = primeiro.charAt(0).toUpperCase();
    const outro = pickDistinctFromPool(pool.last, new Set([normalizeNameKey(last)]), attempt + 3, nameSeed(cleaned));
    return montarNome(pool, initial, last, outro);
  }
  return rollPlayerName({ nationality, index: attempt * 31 + nameSeed(last), random });
}

/** Evita homônimos no elenco sem sufixos numéricos. */
export function dedupeRosterNames(roster, { random = Math.random } = {}) {
  if (!Array.isArray(roster)) return roster;

  roster.forEach(player => {
    if (!player?.name || player.nameCustomized) return;
    if (hasTrailingNumericNameSuffix(player.name)) {
      player.name = stripTrailingNumericNameSuffix(player.name);
    }
  });

  const used = new Set();
  roster.forEach((player, rosterIndex) => {
    if (!player?.name) return;
    if (player.nameCustomized) {
      used.add(normalizeNameKey(player.name));
      return;
    }

    const nationality = player.nationality || BRAZIL;
    let name = normalizePlayerDisplayName(player.name);
    let key = normalizeNameKey(name);

    if (!used.has(key)) {
      player.name = name;
      used.add(key);
      return;
    }

    for (let attempt = 0; attempt < 64; attempt += 1) {
      const candidate = normalizePlayerDisplayName(
        variantPlayerName(name, { nationality, attempt: attempt + rosterIndex, random }),
      );
      key = normalizeNameKey(candidate);
      if (!used.has(key) && candidate.length <= 40) {
        player.name = candidate;
        used.add(key);
        return;
      }
    }

    const fallback = normalizePlayerDisplayName(
      rollPlayerName({ nationality, index: rosterIndex * 997 + used.size, random }),
    );
    player.name = fallback;
    used.add(normalizeNameKey(fallback));
  });
  return roster;
}

/** Estrangeiros recebem nomes do país de origem (geração + migração única). */
export function ensureForeignPlayerNames(roster, { random = Math.random, skipCustomized = true } = {}) {
  if (!Array.isArray(roster)) return roster;
  roster.forEach((player, index) => {
    if (!player || typeof player !== 'object') return;
    if (skipCustomized && player.nameCustomized) return;
    const nationality = player.nationality || BRAZIL;
    if (nationality === BRAZIL) {
      player.nameNationalityKey = BRAZIL;
      return;
    }
    if (player.nameNationalityKey === nationality) return;
    player.name = rollPlayerName({ nationality, index, random });
    player.nameNationalityKey = nationality;
  });
  dedupeRosterNames(roster);
  return roster;
}

export function rosterNameConflict(roster, candidateName, { ignorePlayerId = null } = {}) {
  const key = normalizeNameKey(candidateName);
  if (!key) return 'empty';
  return roster.some(player => {
    if (!player?.name) return false;
    if (ignorePlayerId && player.playerId === ignorePlayerId) return false;
    return normalizeNameKey(player.name) === key;
  })
    ? 'duplicate'
    : null;
}

export function playerRenameBlocked(player, currentSeason) {
  if (!player) return { blocked: true, reason: 'Jogador não encontrado.' };
  const season = Number(currentSeason);
  const renamedSeason = Number(player.nameRenamedSeason);
  if (Number.isFinite(season) && Number.isFinite(renamedSeason) && renamedSeason === season) {
    return {
      blocked: true,
      reason: `Renomeado na temporada ${season}. Nova alteração só na próxima temporada.`,
    };
  }
  return { blocked: false };
}

export function validatePlayerRename(candidateName, roster, { ignorePlayerId = null } = {}) {
  const name = normalizePlayerDisplayName(candidateName);
  if (!name) return { ok: false, error: 'Informe um nome.' };
  if (name.length < 2) return { ok: false, error: 'Nome muito curto (mín. 2 caracteres).' };
  if (name.length > 40) return { ok: false, error: 'Nome muito longo (máx. 40 caracteres).' };
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(name)) return { ok: false, error: 'Use pelo menos uma letra.' };
  const conflict = rosterNameConflict(roster, name, { ignorePlayerId });
  if (conflict === 'duplicate') return { ok: false, error: 'Já existe outro jogador com este nome no elenco.' };
  return { ok: true, name };
}

export function renamePlayerInRoster(roster, playerId, candidateName, { currentSeason = null } = {}) {
  const check = validatePlayerRename(candidateName, roster, { ignorePlayerId: playerId });
  if (!check.ok) return check;
  const player = roster.find(entry => entry?.playerId === playerId);
  if (!player) return { ok: false, error: 'Jogador não encontrado.' };
  const block = playerRenameBlocked(player, currentSeason);
  if (block.blocked) return { ok: false, error: block.reason };
  const normalizedCurrent = normalizeNameKey(player.name);
  const normalizedNext = normalizeNameKey(check.name);
  if (normalizedCurrent === normalizedNext) {
    return { ok: true, name: check.name, player, unchanged: true };
  }
  player.name = check.name;
  player.nameCustomized = true;
  if (Number.isFinite(Number(currentSeason))) {
    player.nameRenamedSeason = Number(currentSeason);
  }
  return { ok: true, name: check.name, player };
}
