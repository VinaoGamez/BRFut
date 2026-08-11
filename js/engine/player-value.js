/**
 * Valuation e campos de mercado do jogador.
 */

import { estimatePlayerWage, PLAYER_WAGE_MODEL } from './economy.js';
import { ensurePlayerContract } from './player-contracts.js';

const VALUE_BASE = 80_000;
const VALUE_DIVISION_CONTEXT = { A: 1.4, B: 1.25, C: 1.12, D: 1 };
export const PLAYER_VALUE_MODEL = 3;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const valueAgeFactor = age => {
  const years = Number(age) || 28;
  if (years <= 21) return 1.3;
  if (years <= 27) return 1.3 - (years - 21) * 0.035;
  if (years <= 30) return 1.09 - (years - 27) * 0.045;
  return Math.max(0.38, 0.955 * 0.91 ** (years - 30));
};

/**
 * Valor de mercado estimado (fee base em R$).
 * @param {object} player
 * @param {string} [division]
 */
export function estimatePlayerValue(player, division = 'A') {
  const divisionContext = VALUE_DIVISION_CONTEXT[division] ?? VALUE_DIVISION_CONTEXT.D;
  // A escala do BR Fut começa em OVR 10 (Série D), não em 40. O piso antigo
  // tornava atletas OVR 19 e 39 economicamente idênticos e permitia reformar um
  // elenco inteiro pelo caixa inicial.
  const overall = clamp(Number(player?.overall) || 15, 10, 99);
  const potential = clamp(Number(player?.potential) || overall, overall, 99);
  const ovrFactor = 1.12 ** (overall - 15);
  const potentialGap = potential - overall;
  const potFactor = 1 + potentialGap * 0.025 + potentialGap ** 1.35 * 0.006;
  const ageFactor = valueAgeFactor(player?.age);
  const rawForm = Number(player?.form);
  const formFactor = Number.isFinite(rawForm) ? clamp(1 + (rawForm - 60) / 500, 0.88, 1.12) : 1;
  const injuryFactor = player?.injured || player?.injury ? 0.9 : 1;
  return Math.max(
    20_000,
    Math.round(VALUE_BASE * divisionContext * ovrFactor * potFactor * ageFactor * formFactor * injuryFactor),
  );
}

/**
 * Preenche campos de mercado se ausentes.
 * @param {object} player
 * @param {{ division?: string, season?: number }} [ctx]
 */
export function ensureMarketFields(player, ctx = {}) {
  if (!player || typeof player !== 'object') return player;
  const division = ctx.division || 'D';
  const season = Number(ctx.season) || 2026;
  const migrateValue =
    player.marketValueModel !== PLAYER_VALUE_MODEL ||
    player.marketValue == null ||
    !Number.isFinite(Number(player.marketValue));
  if (migrateValue) {
    player.marketValue = estimatePlayerValue(player, division);
    player.marketValueModel = PLAYER_VALUE_MODEL;
  }
  const migrateWage =
    player.wageModel !== PLAYER_WAGE_MODEL ||
    player.wage == null ||
    !Number.isFinite(Number(player.wage));
  if (migrateWage) {
    player.wage = estimatePlayerWage(player, division);
    player.wageModel = PLAYER_WAGE_MODEL;
    if (player.contract && typeof player.contract === 'object') {
      player.contract.wagePerRound = player.wage;
    }
  }
  ensurePlayerContract(player, {
    division,
    season,
    careerDate: ctx.careerDate || null,
  });
  if (typeof player.listed !== 'boolean') player.listed = false;
  if (migrateValue && player.listed) {
    player.askingPrice = player.marketValue;
  } else if (player.askingPrice == null) {
    player.askingPrice = player.listed ? player.marketValue : null;
  }
  return player;
}

/** Recalcula valor/salário (ex.: mudança de divisão). */
export function refreshMarketFields(player, ctx = {}) {
  if (!player || typeof player !== 'object') return player;
  const division = ctx.division || 'D';
  const season = Number(ctx.season) || 2026;
  player.marketValue = estimatePlayerValue(player, division);
  player.marketValueModel = PLAYER_VALUE_MODEL;
  if (
    player.wageModel !== PLAYER_WAGE_MODEL ||
    !Number.isFinite(Number(player.wage)) ||
    Number(player.wage) <= 0
  ) {
    player.wage = estimatePlayerWage(player, division);
    player.wageModel = PLAYER_WAGE_MODEL;
    if (player.contract && typeof player.contract === 'object') {
      player.contract.wagePerRound = player.wage;
    }
  }
  ensurePlayerContract(player, {
    division,
    season,
    careerDate: ctx.careerDate || null,
  });
  if (player.listed && (player.askingPrice == null || player.askingPrice <= 0)) {
    player.askingPrice = player.marketValue;
  }
  return player;
}

export const VALUE_BASE_BY_DIVISION = Object.freeze(
  Object.fromEntries(
    Object.entries(VALUE_DIVISION_CONTEXT).map(([division, factor]) => [
      division,
      Math.round(VALUE_BASE * factor),
    ]),
  ),
);
export { VALUE_DIVISION_CONTEXT };
