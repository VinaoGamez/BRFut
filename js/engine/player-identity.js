/**
 * Identidade estável de jogador para mercado e histórico.
 *
 * O id já é atribuído a 100% dos jogadores do mundo por `stampWorldPlayers`
 * (ver `scripts/player-id-cobertura.mjs`), e sobrevive a transferência porque
 * `ensurePlayerId` não regenera id existente. O que faltava era *usar* o id:
 * o motor ainda localizava jogador pelo nome em ~25 lugares.
 *
 * Localizar por nome só é seguro porque `dedupeRosterNames` garante unicidade
 * dentro do elenco — invariante mantida em `player-names.js` e dependida em
 * `match-ratings.js`, `fatigue.js`, `match-availability.js` e outros. Se algum
 * caminho adicionar jogador sem passar pelo dedupe, o motor entrega os
 * atributos do jogador errado, sem erro nenhum.
 */
import { normalizePlayerDisplayName } from './player-names.js';

function nomeChave(value) {
  return normalizePlayerDisplayName(value).toLocaleLowerCase('pt-BR');
}

/**
 * Localiza um jogador por `playerId`, com queda para o nome.
 *
 * A queda é deliberada e temporária: saves gravados antes do id existir
 * (ou registros antigos dentro de `savedSeason`) só carregam o nome. Ordem de
 * resolução:
 *   1. `playerId` exato — caminho novo, imune a homônimos
 *   2. nome exato — save antigo ou registro sem id
 *
 * @param {Array<object>|undefined} roster
 * @param {string|{playerId?: string, name?: string}} chave id, nome, ou registro
 * @returns {object|undefined}
 */
export function findPlayerInRoster(roster, chave) {
  if (!Array.isArray(roster) || roster.length === 0) return undefined;
  if (!chave) return undefined;

  const id = typeof chave === 'string' ? null : chave.playerId || null;
  const nome = typeof chave === 'string' ? chave : chave.name;

  if (id) {
    const porId = roster.find(p => p?.playerId === id);
    if (porId) return porId;
    // Registro traz id mas o elenco não tem esse jogador (transferência entre
    // save e snapshot). Cai no nome para não perder o vínculo.
  }

  if (!nome) return undefined;
  const alvo = nomeChave(nome);
  return roster.find(p => p?.name && nomeChave(p.name) === alvo);
}

/** Versão que devolve o índice, quando só a posição importa. */
export function findPlayerIndexInRoster(roster, chave) {
  if (!Array.isArray(roster) || roster.length === 0) return -1;
  if (!chave) return -1;
  const id = typeof chave === 'string' ? null : chave.playerId || null;
  if (id) {
    const i = roster.findIndex(p => p?.playerId === id);
    if (i >= 0) return i;
  }
  const nome = typeof chave === 'string' ? chave : chave.name;
  if (!nome) return -1;
  const alvo = nomeChave(nome);
  return roster.findIndex(p => p?.name && nomeChave(p.name) === alvo);
}

/** Verdadeiro quando o registro já carrega identidade estável. */
export function hasStableIdentity(registro) {
  return Boolean(registro && typeof registro === 'object' && registro.playerId);
}

/** Gera id imutável determinístico (seed + clube + índice). */
export function generatePlayerId({ seed = 0, club = '', index = 0 } = {}) {
  let hash = (Number(seed) || 0) ^ Math.imul(Number(index) || 0, 2654435761);
  const text = String(club || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `p-${(hash >>> 0).toString(36)}-${Number(index).toString(36)}`;
}

/** Garante playerId no objeto jogador (mutável). */
export function ensurePlayerId(player, context = {}) {
  if (!player || typeof player !== 'object') return player;
  if (player.playerId) return player;
  player.playerId = generatePlayerId({
    seed: context.seed,
    club: context.club || player.club || '',
    index: context.index ?? 0,
  });
  return player;
}

/** Resolve id de um jogador (preferência: playerId). */
export function resolvePlayerId(player) {
  if (!player) return null;
  if (typeof player === 'string') return player;
  return player.playerId || null;
}
