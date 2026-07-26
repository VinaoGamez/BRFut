/**
 * Países de clubes — Lab de Times e competições CONMEBOL (Libertadores / Sul-Americana).
 */

/** @typedef {{ code: string, name: string, region: 'CONMEBOL'|'OTHER' }} ClubCountry */

/** @type {ReadonlyArray<ClubCountry>} */
export const CLUB_COUNTRIES = Object.freeze([
  { code: 'BRA', name: 'Brasil', region: 'CONMEBOL' },
  { code: 'ARG', name: 'Argentina', region: 'CONMEBOL' },
  { code: 'URU', name: 'Uruguai', region: 'CONMEBOL' },
  { code: 'PAR', name: 'Paraguai', region: 'CONMEBOL' },
  { code: 'COL', name: 'Colômbia', region: 'CONMEBOL' },
  { code: 'CHI', name: 'Chile', region: 'CONMEBOL' },
  { code: 'ECU', name: 'Equador', region: 'CONMEBOL' },
  { code: 'PER', name: 'Peru', region: 'CONMEBOL' },
  { code: 'BOL', name: 'Bolívia', region: 'CONMEBOL' },
  { code: 'VEN', name: 'Venezuela', region: 'CONMEBOL' },
]);

const COUNTRY_BY_CODE = Object.freeze(
  CLUB_COUNTRIES.reduce((map, country) => {
    map.set(country.code, country);
    return map;
  }, new Map()),
);

const VALID_CODES = new Set(CLUB_COUNTRIES.map(country => country.code));

/** UF fictícia (2 letras) para clubes fora do Brasil — evita colisão com PE, PR, PA. */
export const FOREIGN_CLUB_UF = Object.freeze({
  ARG: 'AR',
  BOL: 'BL',
  CHI: 'CL',
  COL: 'CO',
  ECU: 'EC',
  PAR: 'PG',
  PER: 'PU',
  URU: 'UY',
  VEN: 'VN',
});

/** @param {string} [code] */
export function normalizeClubCountry(code) {
  const value = String(code || 'BRA').trim().toUpperCase();
  return VALID_CODES.has(value) ? value : 'BRA';
}

/** @param {string} [code] */
export function isBrazilianClubCountry(code) {
  return normalizeClubCountry(code) === 'BRA';
}

/** @param {string} [code] */
export function foreignClubUf(code) {
  const country = normalizeClubCountry(code);
  return FOREIGN_CLUB_UF[country] || 'XX';
}

/** @param {string} [code] */
export function clubCountryLabel(code) {
  const normalized = normalizeClubCountry(code);
  return COUNTRY_BY_CODE.get(normalized)?.name || normalized;
}

/** @param {{ country?: string }|null|undefined} club */
export function resolveClubCountry(club) {
  return normalizeClubCountry(club?.country);
}

/** Países sempre visíveis no filtro do Lab. */
export function listFilterCountries() {
  return [...CLUB_COUNTRIES];
}

/** @param {ReadonlyArray<{ country?: string }>} clubs */
export function listCountriesInClubs(clubs) {
  const codes = new Set(clubs.map(club => resolveClubCountry(club)));
  return CLUB_COUNTRIES.filter(country => codes.has(country.code));
}
