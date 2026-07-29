import { isWorldCupSeasonActive } from './season-calendar-mold.js';
import { NATIONAL_TEAMS, nationalTeamByCode } from './national-teams.js';

/** Março (0-indexed) — 1ª proposta de seleção. */
export const NATIONAL_TEAM_OFFER_MONTH = 2;

export const NATIONAL_TEAM_OFFER_COUNT = 3;

export const NATIONAL_TEAM_OFFER_WEEK_DAYS = 7;

export const WORLD_CUP_2026_YEAR = 2026;

const hashPick = (seed, salt, size) => {
  const x = Math.sin((Number(seed) || 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * Math.max(1, size));
};

const toDate = value => {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dayDiff = (later, earlier) => {
  const end = toDate(later);
  const start = toDate(earlier);
  if (!end || !start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
};

/** Pool de seleções elegíveis ao convite (CMU 2026). */
export function nationalTeamOfferPool({ year = WORLD_CUP_2026_YEAR, userDivision = 'D' } = {}) {
  const all = Object.values(NATIONAL_TEAMS);
  if (Number(year) !== WORLD_CUP_2026_YEAR) return all;

  const division = String(userDivision || 'D').trim().toUpperCase();
  if (division === 'A') return all.filter(team => team.block === 1);
  if (division === 'B') return all.filter(team => team.block === 2);
  return all;
}

export function normalizeNationalTeamOfferState(raw, year) {
  const targetYear = Number(year);
  if (!raw || Number(raw.year) !== targetYear) {
    return {
      year: targetYear,
      offers: [],
      issuedCount: 0,
      lastIssueDate: null,
      snoozedUntil: null,
    };
  }
  return {
    year: targetYear,
    offers: Array.isArray(raw.offers) ? raw.offers.map(offer => ({ ...offer })) : [],
    issuedCount: Math.max(0, Math.min(NATIONAL_TEAM_OFFER_COUNT, Number(raw.issuedCount) || 0)),
    lastIssueDate: raw.lastIssueDate || null,
    snoozedUntil: raw.snoozedUntil || null,
  };
}

export function getNationalTeamOffersRemaining(issuedCount) {
  return Math.max(0, NATIONAL_TEAM_OFFER_COUNT - Math.max(0, Number(issuedCount) || 0));
}

/** @deprecated Prefer `shouldIssueNextNationalTeamOffer` + popup flow. */
export function shouldSendNationalTeamOffers({
  year,
  careerDate,
  userNationalTeamCode = null,
  offersSentYear = null,
  offerState = null,
} = {}) {
  if (!isWorldCupSeasonActive(year)) return false;
  if (userNationalTeamCode) return false;
  if (Number(offersSentYear) === Number(year) && !offerState) return false;
  return shouldIssueNextNationalTeamOffer({ year, careerDate, offerState, legacyOffersSentYear: offersSentYear });
}

export function shouldIssueNextNationalTeamOffer({
  year,
  careerDate,
  offerState = null,
  userNationalTeamCode = null,
  legacyOffersSentYear = null,
} = {}) {
  if (!isWorldCupSeasonActive(year)) return false;
  if (userNationalTeamCode) return false;

  const state = normalizeNationalTeamOfferState(offerState, year);
  if (state.issuedCount >= NATIONAL_TEAM_OFFER_COUNT) return false;
  if (Number(legacyOffersSentYear) === Number(year) && !offerState) return false;

  const date = toDate(careerDate);
  if (!date || date.getFullYear() !== Number(year)) return false;
  if (date.getMonth() < NATIONAL_TEAM_OFFER_MONTH) return false;

  if (state.issuedCount === 0) return true;
  if (!state.lastIssueDate) return true;
  return dayDiff(date, state.lastIssueDate) >= NATIONAL_TEAM_OFFER_WEEK_DAYS;
}

export function shouldShowNationalTeamOfferPopup({
  year,
  careerDate,
  offerState = null,
  userNationalTeamCode = null,
} = {}) {
  if (userNationalTeamCode) return false;
  const state = normalizeNationalTeamOfferState(offerState, year);
  if (!state.offers.length) return false;

  const date = toDate(careerDate);
  if (!date) return false;
  if (state.snoozedUntil) {
    const until = toDate(state.snoozedUntil);
    if (until && date < until) return false;
  }
  return true;
}

export function generateNationalTeamOffers({
  year = WORLD_CUP_2026_YEAR,
  userDivision = 'D',
  seed = 1,
  count = 3,
  excludeCodes = [],
} = {}) {
  const excluded = new Set((excludeCodes || []).map(code => String(code || '').trim().toUpperCase()).filter(Boolean));
  const pool = nationalTeamOfferPool({ year, userDivision }).filter(team => !excluded.has(team.code));
  const shuffled = [...pool].sort(
    (a, b) => hashPick(seed, a.fifaRank, 997) - hashPick(seed, b.fifaRank, 997),
  );
  const picked = [];
  const seen = new Set();
  for (const team of shuffled) {
    if (picked.length >= count) break;
    if (!team?.code || seen.has(team.code)) continue;
    seen.add(team.code);
    picked.push({
      id: `nt-${team.code}-${seed}-${picked.length + 1}`,
      code: team.code,
      name: team.name,
      fifaRank: team.fifaRank,
      contractLabel: `Copa do Mundo ${year}`,
    });
  }
  return picked;
}

export function generateNextNationalTeamOffer({
  year = WORLD_CUP_2026_YEAR,
  userDivision = 'D',
  seed = 1,
  issueIndex = 0,
  existingOffers = [],
} = {}) {
  const excludeCodes = existingOffers.map(offer => offer.code);
  return (
    generateNationalTeamOffers({
      year,
      userDivision,
      seed: (Number(seed) || 1) + issueIndex * 991,
      count: 1,
      excludeCodes,
    })[0] || null
  );
}

export function addDaysToCareerDate(careerDate, days) {
  const base = toDate(careerDate);
  if (!base) return null;
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + Math.max(0, Number(days) || 0));
  return next.toISOString();
}

export function formatNationalTeamOfferLetter(offer, year = WORLD_CUP_2026_YEAR) {
  if (!offer) return '';
  return `${offer.name} busca um técnico para a Copa do Mundo ${year}.\n\nRanking FIFA: ${offer.fifaRank}º\nCompromisso: fase de grupos e mata-mata (paralelo ao seu clube).\n\nAceite para comandar a seleção nos jogos oficiais da CMU.`;
}

export function resolveNationalTeamName(code) {
  return nationalTeamByCode(code)?.name || null;
}
